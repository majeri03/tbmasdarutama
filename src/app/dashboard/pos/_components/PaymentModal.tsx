"use client";

import { useState, useEffect, useRef } from "react";
import { CartItem, POSCustomer } from "@/types/pos";
import { PaymentMethod } from "@prisma/client";
import { createPosTransaction } from "@/lib/actions/pos.actions";
import { formatCurrency, calculateCart, calculateChange } from "@/lib/utils/pos-helpers";
import { X, Loader2, CreditCard, Banknote, Wallet, QrCode, Landmark, ImagePlus, Trash2 } from "lucide-react";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: CartItem[];
    customer: POSCustomer;
    discount: number;
    onSuccess: (invoiceNumber: string, saleId: string) => void;
    showToast: (message: string, type?: "success" | "error" | "info") => void;
    // PKG-A (23 Nov 2026, perbaikan 7 item #5): salesperson yang menangani
    // penjualan ini — dioper dari halaman POS (PKG-C). Opsional; diteruskan
    // ke createPosTransaction/createSale. Dicatat internal saja — TIDAK
    // PERNAH dicetak di invoice/struk/surat jalan.
    salesmanId?: string | null;
}

export function PaymentModal({ isOpen, onClose, items, customer, discount, onSuccess, showToast, salesmanId }: PaymentModalProps) {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
    const [paidAmount, setPaidAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    // Bukti transfer/QRIS — disimpan sebagai tag [BUKTI_TF]: <url> di notes,
    // sama seperti APK (folder proofs_payment di R2).
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [proofUploading, setProofUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const calculation = calculateCart(items, customer, discount);
    const changeAmount = calculateChange(paidAmount, calculation.grandTotal);
    const isTransferOrQris = paymentMethod === "TRANSFER" || paymentMethod === "QRIS";

    // Reset paid amount when modal opens
    useEffect(() => {
        if (isOpen) {
            setPaidAmount(calculation.grandTotal);
            setProofUrl(null);
        }
    }, [isOpen, calculation.grandTotal]);

    // Transfer/QRIS selalu lunas persis — jumlah bayar = grand total.
    useEffect(() => {
        if (isTransferOrQris) {
            setPaidAmount(calculation.grandTotal);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentMethod]);

    const handleProofUpload = async (file: File) => {
        setProofUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "proofs_payment");
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const json = await res.json();
            if (res.ok && json.url) {
                setProofUrl(json.url);
            } else {
                showToast(json.error || "Gagal mengunggah bukti", "error");
            }
        } catch {
            showToast("Gagal mengunggah bukti", "error");
        } finally {
            setProofUploading(false);
        }
    };

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

        // Transfer wajib foto bukti (seperti APK); QRIS opsional.
        if (paymentMethod === "TRANSFER" && !proofUrl) {
            showToast("Upload foto bukti transfer dulu", "error");
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
                // Tag bukti dipakai APK + laporan keuangan untuk menemukan foto.
                notes: proofUrl ? `[BUKTI_TF]: ${proofUrl}` : null,
                // PKG-A (23 Nov 2026, perbaikan 7 item #5): salesman dari
                // halaman POS (PKG-C). createSaleSchema sudah menerima
                // salesmanId; createSale memvalidasi (harus ada + aktif)
                // dan menyimpannya di Sale.salesmanId.
                salesmanId: salesmanId || null,
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
        { value: "CASH", label: "Cash", icon: Banknote, color: "bg-green-600" },
        { value: "TRANSFER", label: "Transfer", icon: Landmark, color: "bg-teal-600" },
        { value: "QRIS", label: "QRIS", icon: QrCode, color: "bg-stone-600" },
        { value: "DEBIT_CARD", label: "Debit", icon: CreditCard, color: "bg-[#7F1D1D]" },
        { value: "CREDIT", label: "Kredit", icon: Wallet, color: "bg-orange-600" },
    ];

    return (
        <>
            {/* Backdrop */}
            <div className="modal-overlay">
                {/* Modal */}
                <div className="modal-container w-full max-w-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-stone-100">Pembayaran</h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Customer Info */}
                        <div className="p-3 bg-[#E5484D]/10 rounded-xl">
                            <p className="text-sm text-stone-400">Customer</p>
                            <p className="font-semibold text-stone-100">{customer.name}</p>
                            <p className="text-xs text-stone-400">{customer.code} • {customer.type}</p>
                        </div>

                        {/* Total */}
                        <div className="p-4 bg-red-900 rounded-xl text-white">
                            <p className="text-sm opacity-90">Total Pembayaran</p>
                            <p className="text-3xl font-bold">{formatCurrency(calculation.grandTotal)}</p>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="label mb-2">
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
                                            className={`p-3 rounded-xl border-2 transition-all ${isSelected
                                                ? `border-[#E5484D] bg-[#E5484D]/10`
                                                : "border-white/10 hover:border-white/15"
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full ${method.color} mx-auto mb-2 flex items-center justify-center`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <p className="text-xs font-medium text-stone-100">{method.label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bukti transfer / QRIS */}
                        {isTransferOrQris && (
                            <div>
                                <label className="label mb-2">
                                    Foto Bukti Pembayaran
                                    {paymentMethod === "TRANSFER" ? " (wajib)" : " (opsional)"}
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleProofUpload(file);
                                        e.target.value = "";
                                    }}
                                />
                                {proofUrl ? (
                                    <div className="relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={proofUrl}
                                            alt="Bukti pembayaran"
                                            className="w-full max-h-48 object-contain rounded-xl border border-white/10 bg-white/5"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setProofUrl(null)}
                                            disabled={isLoading}
                                            className="absolute top-2 right-2 p-2 bg-[#1C1917] rounded-full shadow text-red-300 hover:bg-red-500/10"
                                            aria-label="Hapus bukti"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading || proofUploading}
                                        className="w-full py-3 border-2 border-dashed border-white/15 rounded-xl text-stone-400 hover:border-[#E5484D] hover:text-[#E5484D] flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {proofUploading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Mengunggah...
                                            </>
                                        ) : (
                                            <>
                                                <ImagePlus className="w-5 h-5" />
                                                Upload Foto Bukti
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Paid Amount (only for CASH/DEBIT) */}
                        {paymentMethod !== "CREDIT" && (
                            <>
                                <div>
                                    <label className="label mb-1">
                                        Jumlah Bayar
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">Rp</span>
                                        <input
                                            type="number"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                            disabled={isLoading || isTransferOrQris}
                                            className="w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#E5484D] disabled:bg-white/5"
                                        />
                                    </div>
                                    {/* Quick Amount Buttons */}
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {[50000, 100000, 200000, 500000].map((amount) => (
                                            <button
                                                key={amount}
                                                onClick={() => setPaidAmount(calculation.grandTotal + amount)}
                                                disabled={isLoading}
                                                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/15 rounded transition-colors"
                                            >
                                                +{amount / 1000}k
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Change */}
                                <div className="p-3 bg-green-500/10 rounded-xl">
                                    <p className="text-sm text-stone-400">Kembalian</p>
                                    <p className="text-2xl font-bold text-green-400">{formatCurrency(changeAmount)}</p>
                                </div>
                            </>
                        )}

                        {/* Credit Warning */}
                        {paymentMethod === "CREDIT" && (
                            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                                <p className="text-sm text-orange-300">
                                    ⚠️ Pembayaran kredit akan dicatat sebagai utang customer
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 flex gap-2 bg-white/5">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || (paymentMethod !== "CREDIT" && paidAmount < calculation.grandTotal)}
                            className="flex-1 px-4 py-3 bg-red-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 hover:bg-red-800"
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