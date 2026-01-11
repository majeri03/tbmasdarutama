"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { createPurchase, updatePurchase } from "@/lib/actions/purchase.actions";
import { getSuppliers } from "@/lib/actions/supplier.actions";
import { getPOSProducts } from "@/lib/actions/pos.actions";
import { PurchaseData, PurchaseProduct, PurchaseItem } from "@/types/purchase";
import { PaymentMethod } from "@prisma/client";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PurchaseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    purchase?: PurchaseData;
}

interface Supplier {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
    isActive: boolean;
}

export function PurchaseFormModal({ isOpen, onClose, onSuccess, purchase }: PurchaseFormModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<PurchaseProduct[]>([]);
    const [searchProduct, setSearchProduct] = useState("");
    const { showToast } = useToast();

    // Form states
    const [supplierId, setSupplierId] = useState(purchase?.supplier.id || "");
    const [purchaseDate, setPurchaseDate] = useState(
        purchase ? new Date(purchase.purchaseDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    const [items, setItems] = useState<PurchaseItem[]>(purchase?.purchaseItems || []);
    const [discount, setDiscount] = useState(purchase?.discount || 0);
    const [tax, setTax] = useState(purchase?.tax || 0);
    const [notes, setNotes] = useState(purchase?.notes || "");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(purchase?.paymentMethod || "");
    const [paidAmount, setPaidAmount] = useState(purchase?.paidAmount || 0);

    useEffect(() => {
        if (isOpen && purchase) {
            // Edit mode - Load purchase data
            setSupplierId(purchase.supplier.id);
            setPurchaseDate(new Date(purchase.purchaseDate).toISOString().split("T")[0]);
            setItems(purchase.purchaseItems || []);
            setDiscount(purchase.discount);
            setTax(purchase.tax);
            setNotes(purchase.notes || "");
            setPaymentMethod(purchase.paymentMethod || "");
            setPaidAmount(purchase.paidAmount);
        } else if (isOpen && !purchase) {
            // Create mode - Reset form
            setSupplierId("");
            setPurchaseDate(new Date().toISOString().split("T")[0]);
            setItems([]);
            setDiscount(0);
            setTax(0);
            setNotes("");
            setPaymentMethod("");
            setPaidAmount(0);
        }
    }, [isOpen, purchase]);
    
    // Load suppliers and products
    useEffect(() => {
        if (isOpen) {
            loadSuppliers();
            loadProducts();
        }
    }, [isOpen]);

    const loadSuppliers = async () => {
        const result = await getSuppliers();
        if (result.success && result.data) {
            // Filter only active suppliers
            const activeSuppliers = result.data.filter((s) => s.isActive === true);
            setSuppliers(activeSuppliers);
        }
    };

    const loadProducts = async () => {
        const result = await getPOSProducts();
        if (result.success && result.data) {
            // Transform data to match PurchaseProduct type
            const transformedProducts = result.data.map((p) => ({
                ...p,
                purchasePrice: p.productUnits?.[0]?.buyPrice || 0,
                units: p.productUnits.map((pu) => ({
                    unit: pu.unit,
                    conversionValue: pu.conversionValue,
                    isPrimary: pu.isPrimary,
                })),
            }));
            setProducts(transformedProducts as PurchaseProduct[]);
        }
    };

    // Calculations
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const grandTotal = totalAmount - discount + tax;
    const remainingDebt = grandTotal - paidAmount;

    // Add item
    const handleAddItem = (product: PurchaseProduct) => {
        const primaryUnit = product.units.find((u) => u.isPrimary);
        if (!primaryUnit) return;

        const newItem: PurchaseItem = {
            productId: product.id,
            product: {
                id: product.id,
                code: product.code,
                name: product.name,
            },
            unitId: primaryUnit.unit.id,
            unit: {
                id: primaryUnit.unit.id,
                name: primaryUnit.unit.name,
            },
            quantity: 1,
            unitPrice: product.purchasePrice || 0,
            discount: 0,
            subtotal: product.purchasePrice || 0,
        };

        setItems([...items, newItem]);
        setSearchProduct("");
    };

    // Update item
    const handleUpdateItem = (index: number, field: keyof PurchaseItem, value: number | string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Recalculate subtotal
        const item = newItems[index];
        item.subtotal = item.quantity * item.unitPrice - item.discount;

        setItems(newItems);
    };

    // Remove item
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // Change unit
    // Change unit
    const handleChangeUnit = (index: number, unitId: string) => {
        const item = items[index];
        const product = products.find((p) => p.id === item.productId);
        if (!product) return;

        const unit = product.units.find((u) => u.unit.id === unitId);
        if (!unit) return;

        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            unitId: unitId,
            unit: {
                id: unit.unit.id,
                name: unit.unit.name,
            },
        };
        setItems(newItems);
    };

    // Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supplierId) {
            showToast("Pilih supplier terlebih dahulu", "error");
            return;
        }

        if (items.length === 0) {
            showToast("Tambahkan minimal 1 produk", "error");
            return;
        }

        setIsLoading(true);

        try {
            const input = {
                supplierId,
                purchaseDate: new Date(purchaseDate),
                items: items.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    subtotal: item.subtotal,
                })),
                discount,
                tax,
                notes: notes || undefined,
                paymentMethod: paymentMethod || undefined,
                paidAmount,
            };

            const result = purchase
                ? await updatePurchase({ ...input, id: purchase.id })
                : await createPurchase(input);

            if (result.success) {
                showToast(result.message || "Purchase Order berhasil disimpan", "success");
                onSuccess();
                onClose();
            } else {
                showToast(result.error || "Gagal menyimpan Purchase Order", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredProducts = products.filter(
        (p) =>
            (p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                p.code.toLowerCase().includes(searchProduct.toLowerCase())) &&
            !items.some((item) => item.productId === p.id)
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {purchase ? "Edit Purchase Order" : "Buat Purchase Order Baru"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
                    {/* Supplier & Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Supplier <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Pilih Supplier</option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.code} - {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tanggal PO <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Product Search */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cari & Tambah Produk
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                placeholder="Ketik nama atau kode produk..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Product Dropdown */}
                        {searchProduct && filteredProducts.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 glass-card max-h-60 overflow-y-auto">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => handleAddItem(product)}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{product.name}</p>
                                            <p className="text-xs text-gray-500">{product.code}</p>
                                        </div>
                                        <Plus className="w-4 h-4 text-blue-600" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Items Table */}
                    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Produk</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Satuan</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Harga</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Diskon</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                                                Belum ada produk. Cari produk di atas untuk menambahkan.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, index) => {
                                            const product = products.find((p) => p.id === item.productId);
                                            return (
                                                <tr key={index}>
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium text-sm">{item.product?.name}</div>
                                                        <div className="text-xs text-gray-500">{item.product?.code}</div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) =>
                                                                handleUpdateItem(index, "quantity", parseFloat(e.target.value) || 1)
                                                            }
                                                            className="w-20 px-2 py-1 text-center border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <select
                                                            value={item.unitId}
                                                            onChange={(e) => handleChangeUnit(index, e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            {product?.units.map((unit) => (
                                                                <option key={unit.unit.id} value={unit.unit.id}>
                                                                    {unit.unit.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.unitPrice}
                                                            onChange={(e) =>
                                                                handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                                                            }
                                                            className="w-28 px-2 py-1 text-right border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.discount}
                                                            onChange={(e) =>
                                                                handleUpdateItem(index, "discount", parseFloat(e.target.value) || 0)
                                                            }
                                                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold">
                                                        {formatCurrency(item.subtotal)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="p-1 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary & Payment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Catatan tambahan (opsional)"
                            />
                        </div>

                        {/* Right: Totals */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Total Barang:</label>
                                <span className="text-lg font-semibold">{formatCurrency(totalAmount)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Diskon:</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Pajak:</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={tax}
                                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                <label className="text-base font-bold text-gray-900">Grand Total:</label>
                                <span className="text-xl font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Pilih Metode</option>
                                    <option value="CASH">Cash</option>
                                    <option value="TRANSFER">Transfer</option>
                                    <option value="CREDIT">Kredit/Tempo</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Dibayar</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={grandTotal}
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                />
                            </div>

                            {remainingDebt > 0 && (
                                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                    <span className="text-sm font-medium text-red-700">Sisa Utang:</span>
                                    <span className="text-lg font-bold text-red-600">{formatCurrency(remainingDebt)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || items.length === 0}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
                    >
                        {isLoading ? "Menyimpan..." : purchase ? "Update PO" : "Buat PO"}
                    </button>
                </div>
            </div>
        </div>
    );
}