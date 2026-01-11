"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { POSLayout } from "./_components/POSLayout";
import { ProductSearch, ProductSearchHandle } from "./_components/ProductSearch";
import { ProductGrid } from "./_components/ProductGrid";
import { ShoppingCart } from "./_components/ShoppingCart";
import { CustomerSelector } from "./_components/CustomerSelector";
import { QuickAddCustomer } from "./_components/QuickAddCustomer";
import { PaymentModal } from "./_components/PaymentModal";
import { InvoicePreview } from "./_components/InvoicePreview";
import { POSKeyboardShortcuts } from "./_components/POSKeyboardShortcuts";
import { POSProduct, CartItem, POSCustomer } from "@/types/pos";
import { getPOSProducts, getProductByBarcode, getPOSCustomers } from "@/lib/actions/pos.actions";
import { validateStock, getCustomerDiscount } from "@/lib/utils/pos-helpers";
import { useToast } from "@/components/ui/toast";

export default function POSPage() {
    // States
    const [products, setProducts] = useState<POSProduct[]>([]);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
    const [discount, setDiscount] = useState(0);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInvoicePreview, setShowInvoicePreview] = useState(false);
    const [lastInvoice, setLastInvoice] = useState({ number: "", saleId: "" });

    const searchRef = useRef<ProductSearchHandle>(null);
    const { showToast } = useToast();

    // Load default customer (Customer Umum)
    const loadDefaultCustomer = useCallback(async () => {
        const result = await getPOSCustomers();
        if (result.success && result.data) {
            const customerUmum = result.data.find((c) => c.code === "CUST-00001");
            if (customerUmum) {
                setSelectedCustomer({
                    ...customerUmum,
                    email: null,
                    address: null,
                    city: null,
                    province: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    discountPercent: getCustomerDiscount(customerUmum.type),
                });
            }
        }
    }, []);

    // Load products
    const loadProducts = useCallback(async (search?: string) => {
        setIsLoadingProducts(true);
        const result = await getPOSProducts(search);
        if (result.success && result.data) {
            setProducts(result.data);
        }
        setIsLoadingProducts(false);
    }, []);

    // Load on mount
    useEffect(() => {
        loadDefaultCustomer();
        loadProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle search
    const handleSearch = useCallback((query: string) => {
        loadProducts(query);
    }, [loadProducts]);

    // Handle barcode scan
    const handleBarcodeScanned = async (barcode: string) => {
        const result = await getProductByBarcode(barcode);
        if (result.success && result.data) {
            handleAddToCart(result.data);
        } else {
            showToast(result.error || "Produk tidak ditemukan", "error");
        }
    };

    // Handle add to cart
    const handleAddToCart = (product: POSProduct) => {
        const primaryUnit = product.productUnits.find((pu) => pu.isPrimary);
        if (!primaryUnit) {
            showToast("Unit produk tidak ditemukan", "error");
            return;
        }

        // Validate stock
        const stockCheck = validateStock(cartItems, product.id, 1, product.currentStock);
        if (!stockCheck.valid) {
            showToast(stockCheck.message || "Stock tidak cukup", "error");
            return;
        }

        // Check if item already in cart
        const existingItemIndex = cartItems.findIndex(
            (item) => item.productId === product.id && item.unitId === primaryUnit.unitId
        );

        if (existingItemIndex >= 0) {
            // Update quantity
            const updatedItems = [...cartItems];
            updatedItems[existingItemIndex].quantity += 1;
            updatedItems[existingItemIndex].subtotal =
                updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unitPrice -
                updatedItems[existingItemIndex].discount;
            setCartItems(updatedItems);
        } else {
            // Add new item
            const unitPrice = primaryUnit.sellPrice;
            const newItem: CartItem = {
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                productUnitId: primaryUnit.id,
                unitId: primaryUnit.unitId,
                unitName: primaryUnit.unit.name,
                quantity: 1,
                unitPrice,
                discount: 0,
                subtotal: unitPrice,
            };
            setCartItems([...cartItems, newItem]);
        }

        showToast(`${product.name} ditambahkan ke keranjang`, "success");
    };

    // Handle update quantity
    const handleUpdateQuantity = (productId: string, unitId: string, quantity: number) => {
        if (quantity < 1) return;

        const updatedItems = cartItems.map((item) => {
            if (item.productId === productId && item.unitId === unitId) {
                const newSubtotal = quantity * item.unitPrice - item.discount;
                return { ...item, quantity, subtotal: newSubtotal };
            }
            return item;
        });

        setCartItems(updatedItems);
    };

    // Handle update discount
    const handleUpdateDiscount = (productId: string, unitId: string, discount: number) => {
        const updatedItems = cartItems.map((item) => {
            if (item.productId === productId && item.unitId === unitId) {
                const newSubtotal = item.quantity * item.unitPrice - discount;
                return { ...item, discount, subtotal: newSubtotal };
            }
            return item;
        });

        setCartItems(updatedItems);
    };

    // Handle remove item
    const handleRemoveItem = (productId: string, unitId: string) => {
        setCartItems(cartItems.filter((item) => !(item.productId === productId && item.unitId === unitId)));
    };

    // Handle clear cart
    const handleClearCart = () => {
        setCartItems([]);
        setDiscount(0);
    };

    // Handle checkout
    const handleCheckout = () => {
        if (cartItems.length === 0) {
            showToast("Keranjang masih kosong", "error");
            return;
        }
        if (!selectedCustomer) {
            showToast("Pilih customer terlebih dahulu", "error");
            return;
        }
        setShowPaymentModal(true);
    };

    // Handle payment success
    const handlePaymentSuccess = (invoiceNumber: string, saleId: string) => {
        setLastInvoice({ number: invoiceNumber, saleId });
        setShowPaymentModal(false);
        setShowInvoicePreview(true);
        handleClearCart();
    };

    // Handle quick add customer
    const handleQuickAddSuccess = () => {
        // Reload customer list
        loadDefaultCustomer();
        setShowQuickAddCustomer(false);
    };

    // Keyboard shortcuts handlers
    const handleSearchFocus = () => {
        searchRef.current?.focus();
    };

    return (
        <>
            <POSLayout
                customer={
                    <CustomerSelector
                        selectedCustomer={selectedCustomer}
                        onSelectCustomer={setSelectedCustomer}
                        onQuickAdd={() => setShowQuickAddCustomer(true)}
                    />
                }
                cart={
                    <ShoppingCart
                        items={cartItems}
                        customer={selectedCustomer}
                        discount={discount}
                        onUpdateQuantity={handleUpdateQuantity}
                        onUpdateDiscount={handleUpdateDiscount}
                        onRemoveItem={handleRemoveItem}
                        onDiscountChange={setDiscount}
                        onClear={handleClearCart}
                    />
                }
            >
                {/* Search */}
                <ProductSearch
                    ref={searchRef}
                    onSearch={handleSearch}
                    onBarcodeScanned={handleBarcodeScanned}
                    isLoading={isLoadingProducts}
                />

                {/* Products Grid */}
                <div className="mt-4">
                    <ProductGrid
                        products={products}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoadingProducts}
                    />
                </div>

                {/* Checkout Button (Floating) */}
                {cartItems.length > 0 && (
                    <div className="fixed bottom-6 right-[25rem] z-40">
                        <button
                            onClick={handleCheckout}
                            className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full shadow-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 flex items-center gap-2 text-lg font-semibold"
                        >
                            <span>Checkout ({cartItems.length} item)</span>
                            <kbd className="px-2 py-1 bg-white/20 rounded text-sm">F9</kbd>
                        </button>
                    </div>
                )}
            </POSLayout>

            {/* Modals */}
            <QuickAddCustomer
                isOpen={showQuickAddCustomer}
                onClose={() => setShowQuickAddCustomer(false)}
                onSuccess={handleQuickAddSuccess}
            />

            {selectedCustomer && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    items={cartItems}
                    customer={selectedCustomer}
                    discount={discount}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            <InvoicePreview
                isOpen={showInvoicePreview}
                onClose={() => setShowInvoicePreview(false)}
                invoiceNumber={lastInvoice.number}
                saleId={lastInvoice.saleId}
            />

            {/* Keyboard Shortcuts */}
            <POSKeyboardShortcuts
                onSearchFocus={handleSearchFocus}
                onCheckout={handleCheckout}
                onClearCart={handleClearCart}
                canCheckout={cartItems.length > 0 && !!selectedCustomer}
            />
        </>
    );
}