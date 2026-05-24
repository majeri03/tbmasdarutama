"use client";

import { useState, useEffect } from "react";
import { CartItem, POSCustomer } from "@/types/pos";
import { PaymentMethod } from "@prisma/client";
import { createPosTransaction } from "@/lib/actions/pos.actions";
import { formatCurrency, calculateCart, calculateChange } from "@/lib/utils/pos-helpers";
import { X, Loader2, CreditCard, Banknote, Wallet } from "lucide-react";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: CartItem[];
    customer: POSCustomer;
    discount: number;
    onSuccess: (invoiceNumber: string, saleId: string) => void;
    showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function PaymentModal({ isOpen, onClose, items, customer, discount, onSuccess, showToast }: PaymentModalProps) {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
    const [paidAmount, setPaidAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const calculation = calculateCart(items, customer, discount);
    const changeAmount = calculateChange(paidAmount, calculation.grandTotal);

    // Reset paid amount when modal opens
    useEffect(() => {
        if (isOpen) {
            setPaidAmount(calculation.grandTotal);
        }
    }, [isOpen, calculation.grandTotal]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        // Validation
        if (!paymentMethod) {
            showToast("Pilih metode pembayaran", "error");
            return;
        }
        if (items.length === 0) {
            showToast("Keranjang masih kosong", "error");
            return;
        }

        if (!customer) {
            showToast("Pilih customer terlebih dahulu", "error");
            return;
        }

        if (paymentMethod !== "CREDIT" && paidAmount < calculation.grandTotal) {
            showToast("Jumlah bayar kurang dari total", "error");
            return;
        }

        // Check if customer is "Customer Umum" for CREDIT
        if (paymentMethod === "CREDIT" && customer.code === "CUST-00000") {
            showToast("Pembayaran CREDIT tidak tersedia untuk Customer Umum", "error");
            return;
        }

        setIsLoading(true);

        try {
            console.log("🔄 Processing payment..."); // ✅ Add log
            console.log("Items:", items);
            const result = await await createPosTransaction({
                customerId: customer.id,
                items: items.map((item) => ({
                    productId: item.productId,
                    productUnitId: item.productUnitId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    subtotal: item.subtotal,
                })),
                totalAmount: calculation.subtotal,
                discount: discount + calculation.itemDiscount + calculation.customerDiscount,
                tax: calculation.tax,
                grandTotal: calculation.grandTotal,
                paymentMethod,
                paidAmount: paymentMethod === "CREDIT" ? 0 : paidAmount,
                changeAmount: paymentMethod === "CREDIT" ? 0 : changeAmount,
                notes: null,
            });
            console.log("✅ Payment result:", result); 
            if (result.success && result.data) {
                onSuccess(result.data.invoiceNumber, result.data.id);
            } else {
                console.error("❌ Payment failed:", result.error);
                showToast(result.error || "Gagal menyimpan transaksi", "error");
            }
        } catch (error) {
            console.error("❌ Payment error:", error);
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const paymentMethods = [
        { value: "CASH", label: "Cash", icon: Banknote, color: "from-green-500 to-green-600" },
        { value: "DEBIT_CARD", label: "Debit", icon: CreditCard, color: "from-blue-500 to-blue-600" },
        { value: "CREDIT", label: "Kredit", icon: Wallet, color: "from-orange-500 to-orange-600" },
    ];

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                {/* Modal */}
                <div className="glass-card w-full max-w-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Pembayaran</h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Customer Info */}
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Customer</p>
                            <p className="font-semibold text-gray-900">{customer.name}</p>
                            <p className="text-xs text-gray-500">{customer.code} • {customer.type}</p>
                        </div>

                        {/* Total */}
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-white">
                            <p className="text-sm opacity-90">Total Pembayaran</p>
                            <p className="text-3xl font-bold">{formatCurrency(calculation.grandTotal)}</p>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Metode Pembayaran
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {paymentMethods.map((method) => {
                                    const Icon = method.icon;
                                    const isSelected = paymentMethod === method.value;
                                    return (
                                        <button
                                            key={method.value}
                                            onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                                            disabled={isLoading}
                                            className={`p-3 rounded-lg border-2 transition-all ${isSelected
                                                ? `border-blue-500 bg-blue-50`
                                                : "border-gray-200 hover:border-gray-300"
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${method.color} mx-auto mb-2 flex items-center justify-center`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <p className="text-xs font-medium text-gray-900">{method.label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Paid Amount (only for CASH/DEBIT) */}
                        {paymentMethod !== "CREDIT" && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Jumlah Bayar
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                                        <input
                                            type="number"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                            disabled={isLoading}
                                            className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    {/* Quick Amount Buttons */}
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {[50000, 100000, 200000, 500000].map((amount) => (
                                            <button
                                                key={amount}
                                                onClick={() => setPaidAmount(calculation.grandTotal + amount)}
                                                disabled={isLoading}
                                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                            >
                                                +{amount / 1000}k
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Change */}
                                <div className="p-3 bg-green-50 rounded-lg">
                                    <p className="text-sm text-gray-600">Kembalian</p>
                                    <p className="text-2xl font-bold text-green-600">{formatCurrency(changeAmount)}</p>
                                </div>
                            </>
                        )}

                        {/* Credit Warning */}
                        {paymentMethod === "CREDIT" && (
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm text-orange-800">
                                    ⚠️ Pembayaran kredit akan dicatat sebagai utang customer
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || (paymentMethod !== "CREDIT" && paidAmount < calculation.grandTotal)}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                "Proses Pembayaran"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}