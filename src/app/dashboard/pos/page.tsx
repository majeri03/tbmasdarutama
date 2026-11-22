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
import { HoldCartPanel } from "./_components/HoldCartPanel";
import { POSProduct, CartItem, POSCustomer } from "@/types/pos";
import { getPOSProducts, getProductByBarcode, getPOSCustomers } from "@/lib/actions/pos.actions";
import { validateStock, getCustomerDiscount } from "@/lib/utils/pos-helpers";
import {
    loadParkedCarts,
    parkCart,
    removeParkedCart,
    type ParkedCart,
} from "@/lib/utils/hold-cart";
import { Toast, useToast } from "@/components/ui/toast";
import { X, Pause } from "lucide-react";
import PageGuard from "@/components/PageGuard";
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
    // Hold cart — keranjang ditahan tersimpan di localStorage saja.
    const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
    const [showHoldPanel, setShowHoldPanel] = useState(false);

    const searchRef = useRef<ProductSearchHandle>(null);
    const [showMobileCart, setShowMobileCart] = useState(false);
    const { showToast, toast, hideToast } = useToast();

    // Load default customer (Customer Umum)
    const loadDefaultCustomer = useCallback(async () => {
        const result = await getPOSCustomers();
        if (result.success && result.data) {
            const customerUmum = result.data.find((c) => c.code === "CUST-001");
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
    // Handle mobile cart modal
    useEffect(() => {
        const handleOpenMobileCart = () => {
            setShowMobileCart(true);
        };
        window.addEventListener('openMobileCart', handleOpenMobileCart);
        return () => window.removeEventListener('openMobileCart', handleOpenMobileCart);
    }, []);
    // Load on mount
    useEffect(() => {
        loadDefaultCustomer();
        loadProducts();
        setParkedCarts(loadParkedCarts());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Hold cart: tahan keranjang saat ini, lanjutkan yang ditahan, hapus.
    const handleParkCart = () => {
        if (cartItems.length === 0) {
            showToast("Keranjang masih kosong", "error");
            return;
        }
        parkCart(cartItems, selectedCustomer, discount);
        setParkedCarts(loadParkedCarts());
        handleClearCart();
        showToast("Keranjang ditahan — bisa dilanjutkan nanti", "success");
    };

    const handleResumeParked = (parked: ParkedCart) => {
        setCartItems(parked.items);
        if (parked.customer) setSelectedCustomer(parked.customer);
        setDiscount(parked.discount);
        setParkedCarts(removeParkedCart(parked.id));
        setShowHoldPanel(false);
        showToast("Keranjang ditahan dilanjutkan", "success");
    };

    const handleDeleteParked = (id: string) => {
        setParkedCarts(removeParkedCart(id));
    };

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
                id: `${product.id}-${primaryUnit.unitId}-${Date.now()}`,
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                productUnitId: primaryUnit.id,
                unitId: primaryUnit.unitId,
                unitName: primaryUnit.unit.name,
                quantity: 1,
                unitPrice,
                originalPrice: unitPrice,
                discount: 0,
                subtotal: unitPrice,
                availableUnits: product.productUnits.map((pu) => ({
                    id: pu.id,
                    unitId: pu.unitId,
                    unitName: pu.unit.name,
                    conversionFactor: pu.conversionValue,
                    price: pu.sellPrice,
                    isBase: pu.conversionValue === 1,
                })),
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
    const handleUpdateUnit = (cartId: string, newUnitId: string, newPrice: number) => {
        setCartItems((prevItems) => {
            // 1. Ambil item yang sedang diedit
            const currentItem = prevItems.find((i) => i.id === cartId);
            if (!currentItem) return prevItems;

            // 2. CEK OTOMATIS: Apakah sudah ada item LAIN dengan produk sama & satuan tujuan sama?
            const existingItemIndex = prevItems.findIndex(
                (i) =>
                    i.id !== cartId && // Pastikan bukan item yang sedang kita edit
                    i.productId === currentItem.productId && // Produknya sama
                    i.unitId === newUnitId // Satuannya sama dengan tujuan
            );

            if (existingItemIndex !== -1) {
                // Gabungkan quantity item ini ke item yang sudah ada, lalu hapus item ini.

                const updatedItems = [...prevItems];
                const targetItem = updatedItems[existingItemIndex];

                // Tambahkan quantity
                targetItem.quantity += currentItem.quantity;

                // Hitung ulang subtotal target
                targetItem.subtotal = (targetItem.quantity * targetItem.unitPrice) - targetItem.discount;

                // Hapus item yang sedang diedit (karena sudah digabung ke target)
                return updatedItems.filter((i) => i.id !== cartId);
            }

            else {
             

                return prevItems.map((item) => {
                    if (item.id === cartId) {
                        // Cari nama unit baru untuk ditampilkan
                        const selectedUnit = item.availableUnits.find((u) => u.unitId === newUnitId);

                        return {
                            ...item,
                            unitId: newUnitId, // Update ID Satuan
                            productUnitId: selectedUnit ? selectedUnit.id : item.productUnitId, // Update ProductUnit ID
                            unitName: selectedUnit ? selectedUnit.unitName : item.unitName, // Update Nama
                            unitPrice: newPrice, // Update Harga Baru
                            originalPrice: newPrice, // Reset harga asli
                            subtotal: item.quantity * newPrice - item.discount, // Hitung ulang subtotal
                        };
                    }
                    return item;
                });
            }
        });
        showToast("Satuan diperbarui", "success");
    }
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
            showToast("Transaksi berhasil!", "success");
            setTimeout(() => {
                setShowInvoicePreview(true);
            }, 300);
            handleClearCart();
            loadProducts();
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
            <PageGuard pageKey="pos">
                <POSLayout
                    cartItemsCount={cartItems.length}
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
                            onUpdateUnit={handleUpdateUnit}
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

                    {/* Checkout + Hold Cart Buttons (Floating) */}
                    {cartItems.length > 0 && (
                        <div className="fixed bottom-6 right-[25rem] z-40 flex items-center gap-2">
                            <button
                                onClick={handleParkCart}
                                className="px-5 py-4 bg-white text-gray-800 border border-gray-200 rounded-full shadow-lg hover:bg-gray-50 transition-all flex items-center gap-2 text-base font-semibold"
                                title="Tahan keranjang ini dan layani pelanggan berikutnya"
                            >
                                <Pause className="w-5 h-5" />
                                <span>Tahan</span>
                            </button>
                            <button
                                onClick={handleCheckout}
                                className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full shadow-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 flex items-center gap-2 text-lg font-semibold"
                            >
                                <span>Checkout ({cartItems.length} item)</span>
                                <kbd className="px-2 py-1 bg-white/20 rounded text-sm">F9</kbd>
                            </button>
                        </div>
                    )}
                    {parkedCarts.length > 0 && (
                        <button
                            onClick={() => setShowHoldPanel(true)}
                            className="fixed bottom-6 left-6 z-40 px-4 py-3 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 transition-all flex items-center gap-2 font-semibold"
                        >
                            <Pause className="w-5 h-5" />
                            <span>Ditahan ({parkedCarts.length})</span>
                        </button>
                    )}
                    <HoldCartPanel
                        isOpen={showHoldPanel}
                        carts={parkedCarts}
                        onClose={() => setShowHoldPanel(false)}
                        onResume={handleResumeParked}
                        onDelete={handleDeleteParked}
                    />
                </POSLayout>

                {/* Modals */}
                <QuickAddCustomer
                    isOpen={showQuickAddCustomer}
                    onClose={() => setShowQuickAddCustomer(false)}
                    onSuccess={handleQuickAddSuccess}
                    showToast={showToast}
                />

                {selectedCustomer && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => setShowPaymentModal(false)}
                        items={cartItems}
                        customer={selectedCustomer}
                        discount={discount}
                        onSuccess={handlePaymentSuccess}
                        showToast={showToast}
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
                {/* Mobile Cart Modal */}
                {showMobileCart && (
                    <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex flex-col">
                        {/* Header */}
                        <div className="glass-card p-4 flex items-center justify-between border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Keranjang Belanja</h2>
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Cart Content */}
                        <div className="flex-1 overflow-hidden">
                            <ShoppingCart
                                items={cartItems}
                                customer={selectedCustomer}
                                discount={discount}
                                onUpdateQuantity={handleUpdateQuantity}
                                onUpdateDiscount={handleUpdateDiscount}
                                onRemoveItem={handleRemoveItem}
                                onDiscountChange={setDiscount}
                                onClear={handleClearCart}
                                onUpdateUnit={handleUpdateUnit}
                            />
                        </div>

                        {/* Checkout Button */}
                        {cartItems.length > 0 && (
                            <div className="p-4 glass-card border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        setShowMobileCart(false);
                                        handleCheckout();
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold text-lg"
                                >
                                    Checkout ({cartItems.length} item)
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={hideToast}
                    />
                )}
            </PageGuard>
        );
    }