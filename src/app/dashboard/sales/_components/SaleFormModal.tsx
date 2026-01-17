"use client";

import { useState, useEffect } from "react";
import { Plus, X, Search, Trash2, ShoppingCart } from "lucide-react";
import { getCustomers } from "@/lib/actions/customer.actions";
import { getProducts } from "@/lib/actions/product.actions";
import { createSale } from "@/lib/actions/sale.actions";
import { PaymentMethod } from "@prisma/client";

interface SaleFormModalProps {
    onSuccess: () => void;
}

interface Customer {
    id: string;
    code: string;
    name: string;
    type: string;
}

interface Product {
    id: string;
    code: string;
    name: string;
    currentStock: number;
    productUnits: Array<{
        id: string;
        unitId: string;
        conversionValue: number;  // ✅ FIX: dari API response
        sellPrice: number;        // ✅ FIX: dari API response
        buyPrice: number;         // ✅ FIX: dari API response
        isPrimary: boolean;
        unit: {
            id: string;
            name: string;
            symbol: string | null;
        };
    }>;
}

interface CartItem {
    productId: string;
    productCode: string;
    productName: string;
    unitId: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
}

export function SaleFormModal({ onSuccess }: SaleFormModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Form state
    const [customerId, setCustomerId] = useState("");
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [tax, setTax] = useState(0);
    const [paidAmount, setPaidAmount] = useState(0);
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Product search
    const [searchProduct, setSearchProduct] = useState("");
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [, setIsSearching] = useState(false);

    const loadCustomers = async () => {
        const result = await getCustomers({});
        if (result.success && result.data) {
            setCustomers(result.data);
        }
    };

    const loadProducts = async (query = "") => {
        setIsSearching(true);
        // Kita hanya minta 20 produk yang relevan saja, bukan 2000!
        const result = await getProducts({ 
            search: query, 
            limit: 20,
            isActive: true // Pastikan hanya produk aktif
        });
        
        if (result.success && result.data) {
            setProducts(result.data);
        }
        setIsSearching(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadCustomers();
            loadProducts(); // Load default (tanpa search)
        } else {
            resetForm();
        }
    }, [isOpen]);

    // 3. LOGIC DEBOUNCE: Panggil server hanya saat user selesai mengetik (jeda 500ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) { // Hanya cari kalau modal terbuka
                loadProducts(searchProduct);
            }
        }, 500); // Tunggu 500ms setelah user stop mengetik

        return () => clearTimeout(timer); // Cleanup timer jika user mengetik lagi
    }, [searchProduct, isOpen]);

   

    const addToCart = (product: Product, unitId: string) => {
        const unit = product.productUnits.find((u) => u.unitId === unitId);
        if (!unit) return;

        const existingIndex = cart.findIndex(
            (item) => item.productId === product.id && item.unitId === unitId
        );

        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += 1;
            newCart[existingIndex].subtotal =
                newCart[existingIndex].quantity * newCart[existingIndex].unitPrice -
                newCart[existingIndex].discount;
            setCart(newCart);
        } else {
            const newItem: CartItem = {
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                unitId: unitId,
                unitName: unit.unit.symbol || unit.unit.name,
                quantity: 1,
                unitPrice: Number(unit.sellPrice),
                discount: 0,
                subtotal: Number(unit.sellPrice),
            };
            setCart([...cart, newItem]);
        }

        setSearchProduct("");
        setShowProductDropdown(false);
    };

    const updateCartItem = (index: number, field: keyof CartItem, value: number) => {
        const newCart = [...cart];
        newCart[index] = { ...newCart[index], [field]: value };

        if (field === "quantity" || field === "unitPrice" || field === "discount") {
            newCart[index].subtotal =
                newCart[index].quantity * newCart[index].unitPrice - newCart[index].discount;
        }

        setCart(newCart);
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const calculateTotals = () => {
        const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const discountAmount = (totalAmount * globalDiscount) / 100;
        const afterDiscount = totalAmount - discountAmount;
        const taxAmount = (afterDiscount * tax) / 100;
        const grandTotal = afterDiscount + taxAmount;
        const changeAmount = Math.max(0, paidAmount - grandTotal);

        return { totalAmount, discountAmount, taxAmount, grandTotal, changeAmount };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (cart.length === 0) {
            setError("Tambahkan minimal 1 produk");
            return;
        }

        if (!customerId) {
            setError("Pilih customer terlebih dahulu");
            return;
        }

        const totals = calculateTotals();

        if (paymentMethod !== PaymentMethod.CREDIT && paidAmount < totals.grandTotal) {
            setError("Jumlah bayar kurang dari total");
            return;
        }

        setLoading(true);
        try {
            const result = await createSale({
                customerId,
                items: cart.map((item) => ({
                    productId: item.productId,
                    productUnitId: item.unitId,  // ✅ FIX: ganti ke productUnitId
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    subtotal: item.subtotal,  // ✅ FIX: tambahkan subtotal
                })),
                discount: totals.discountAmount,
                tax: totals.taxAmount,
                paymentMethod,
                paidAmount,
                totalAmount: totals.totalAmount,  // ✅ FIX: tambahkan totalAmount
                grandTotal: totals.grandTotal,    // ✅ FIX: tambahkan grandTotal
                changeAmount: totals.changeAmount,
                notes: notes || undefined,
            });

            if (result.success) {
                setSuccess("Penjualan berhasil dibuat");
                setTimeout(() => {
                    setIsOpen(false);
                    onSuccess();
                }, 1000);
            } else {
                setError(result.error || "Gagal membuat penjualan");
            }
        } catch {
            setError("Gagal membuat penjualan");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCustomerId("");
        setSaleDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod(PaymentMethod.CASH);
        setGlobalDiscount(0);
        setTax(0);
        setPaidAmount(0);
        setNotes("");
        setCart([]);
        setError("");
        setSuccess("");
    };

    const totals = calculateTotals();

    // Filter products based on search input (case-insensitive, by name or code)
    const filteredProducts = products.filter(
        (product) =>
            product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
            product.code.toLowerCase().includes(searchProduct.toLowerCase())
    );

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Tambah Penjualan
            </button>

            {isOpen && (
                <div className="modal-overlay overflow-y-auto">
                    <div className="modal-container max-w-7xl my-8 animate-modal-slide-up">
                        <form onSubmit={handleSubmit}>
                            <div className="modal-header bg-gradient-to-r from-blue-500 to-blue-600">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5" />
                                    Tambah Penjualan Baru
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                        {success}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div>
                                        <label className="label-required">Customer</label>
                                        <select
                                            value={customerId}
                                            onChange={(e) => setCustomerId(e.target.value)}
                                            className="input-field"
                                            required
                                        >
                                            <option value="">Pilih Customer</option>
                                            {customers.map((customer) => (
                                                <option key={customer.id} value={customer.id}>
                                                    {customer.code} - {customer.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="label-required">Tanggal</label>
                                        <input
                                            type="date"
                                            value={saleDate}
                                            onChange={(e) => setSaleDate(e.target.value)}
                                            className="input-field"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="label-required">Metode Pembayaran</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                            className="input-field"
                                            required
                                        >
                                            <option value={PaymentMethod.CASH}>Tunai</option>
                                            <option value={PaymentMethod.TRANSFER}>Transfer</option>
                                            <option value={PaymentMethod.CREDIT}>Kredit</option>
                                            <option value={PaymentMethod.QRIS}>QRIS</option>
                                            <option value={PaymentMethod.DEBIT_CARD}>Kartu Debit</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Product Search */}
                                <div className="mb-4">
                                    <label className="label">Cari Produk</label>
                                    <div className="relative">
                                        <div className="search-box">
                                            <Search className="search-icon" />
                                            <input
                                                type="text"
                                                placeholder="Ketik nama atau kode produk..."
                                                value={searchProduct}
                                                onChange={(e) => {
                                                    setSearchProduct(e.target.value);
                                                    setShowProductDropdown(true);
                                                }}
                                                onFocus={() => setShowProductDropdown(true)}
                                                onBlur={() => {
                                                    // Delay to allow button click
                                                    setTimeout(() => setShowProductDropdown(false), 200);
                                                }}
                                                className="search-input"
                                            />
                                        </div>

                                        {showProductDropdown && searchProduct && filteredProducts.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                                {filteredProducts.slice(0, 10).map((product) => (
                                                    <div key={product.id} className="p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-900">{product.name}</p>
                                                                <p className="text-xs text-gray-500">{product.code} • Stock: {product.currentStock}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {product.productUnits.map((unit) => (
                                                                <button
                                                                    key={unit.id}
                                                                    type="button"
                                                                    onClick={() => addToCart(product, unit.unitId)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                                                                >
                                                                    + {unit.unit.symbol || unit.unit.name} - Rp {Number(unit.sellPrice).toLocaleString("id-ID")}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Cart Table */}
                                {cart.length > 0 && (
                                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold text-gray-900">Keranjang Belanja</h3>
                                            <span className="text-sm text-gray-500">{cart.length} item</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Produk</th>
                                                        <th>Satuan</th>
                                                        <th className="w-24">Qty</th>
                                                        <th className="w-32">Harga</th>
                                                        <th className="w-32">Diskon</th>
                                                        <th className="text-right">Subtotal</th>
                                                        <th className="w-16"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cart.map((item, index) => (
                                                        <tr key={index}>
                                                            <td>
                                                                <p className="font-medium">{item.productName}</p>
                                                                <p className="text-xs text-gray-500">{item.productCode}</p>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-info">{item.unitName}</span>
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) =>
                                                                        updateCartItem(index, "quantity", parseInt(e.target.value) || 1)
                                                                    }
                                                                    className="input-field text-center"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) =>
                                                                        updateCartItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                                                                    }
                                                                    className="input-field text-right"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.discount}
                                                                    onChange={(e) =>
                                                                        updateCartItem(index, "discount", parseFloat(e.target.value) || 0)
                                                                    }
                                                                    className="input-field text-right"
                                                                />
                                                            </td>
                                                            <td className="text-right font-semibold">
                                                                Rp {item.subtotal.toLocaleString("id-ID")}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFromCart(index)}
                                                                    className="btn-icon-danger"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Catatan</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="input-field"
                                            rows={4}
                                            placeholder="Catatan tambahan..."
                                        />
                                    </div>

                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="label">Diskon Global (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={globalDiscount}
                                                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                                                    className="input-field text-right"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="label">Pajak (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={tax}
                                                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                                                    className="input-field text-right"
                                                />
                                            </div>

                                            <div className="border-t pt-3 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Total:</span>
                                                    <span className="font-semibold">
                                                        Rp {totals.totalAmount.toLocaleString("id-ID")}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Diskon:</span>
                                                    <span className="text-red-600">
                                                        - Rp {totals.discountAmount.toLocaleString("id-ID")}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Pajak:</span>
                                                    <span>Rp {totals.taxAmount.toLocaleString("id-ID")}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-lg border-t pt-2">
                                                    <span>Grand Total:</span>
                                                    <span className="text-blue-600">
                                                        Rp {totals.grandTotal.toLocaleString("id-ID")}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                <label className="label-required">Dibayar:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={paidAmount}
                                                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                                    className="input-field text-right"
                                                    required
                                                />
                                            </div>

                                            {totals.changeAmount > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Kembalian:</span>
                                                    <span className="font-semibold">
                                                        Rp {totals.changeAmount.toLocaleString("id-ID")}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">
                                    Batal
                                </button>
                                <button type="submit" className="btn-primary" disabled={loading || cart.length === 0}>
                                    {loading ? (
                                        <>
                                            <div className="spinner"></div>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <ShoppingCart className="w-4 h-4" />
                                            Simpan Penjualan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}