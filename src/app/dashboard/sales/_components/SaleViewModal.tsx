"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, X, User, Calendar, CreditCard, Printer, Download } from "lucide-react";
import { getSaleById } from "@/lib/actions/sale.actions";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { PaymentMethodBadge } from "./PaymentMethodBadge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SaleStatus, PaymentMethod } from "@prisma/client";
interface SaleItem {
    id: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    product: {
        id: string;
        code: string;
        name: string;
    };
    unit: {
        id: string;
        name: string;
        symbol: string | null;
    };
}

// LINE 29-51, GANTI LAGI dengan:
interface SaleDetail {
    id: string;
    invoiceNumber: string;
    saleDate: Date;
    status: SaleStatus;  // ✅ FIX: use imported type
    paymentMethod: PaymentMethod;  // ✅ FIX: use imported type
    totalAmount: number;
    discount: number;
    tax: number;
    grandTotal: number;
    paidAmount: number;
    changeAmount: number;
    notes: string | null;
    customer: {
        name: string;
        phone: string | null;
    } | null;
    cashier: {
        name: string;
    };
    saleItems: SaleItem[];
    customerDebt?: {  // ✅ TAMBAH INI
        totalDebt: number;
        paidAmount: number;
        remainingDebt: number;
        status: string;
    } | null;
}

interface SaleViewModalProps {
    saleId: string;
}

export function SaleViewModal({ saleId }: SaleViewModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sale, setSale] = useState<SaleDetail | null>(null);
    const [error, setError] = useState("");

    const loadSale = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await getSaleById(saleId);
            if (result.success && result.data) {
                setSale(result.data as unknown as SaleDetail);
            } else {
                setError(result.error || "Gagal memuat data");
                setIsOpen(false);
            }
        } catch {
            setError("Gagal memuat detail penjualan");
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    }, [saleId]);

    useEffect(() => {
        if (isOpen) {
            loadSale();
        }
    }, [isOpen, loadSale]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        setError("Fitur PDF sedang dalam pengembangan");
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn-icon-info"
                title="Lihat Detail"
            >
                <Eye className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="modal-overlay">
                    <div className="modal-container max-w-4xl animate-modal-slide-up">
                        <div className="modal-header bg-gradient-to-r from-blue-500 to-blue-600">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                Detail Penjualan
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {error && (
                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                    {error}
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="modal-body">
                                <div className="flex items-center justify-center py-12">
                                    <div className="spinner-large"></div>
                                </div>
                            </div>
                        ) : sale ? (
                            <div className="modal-body">
                                {/* Header Info */}
                                <div className="glass-card p-6 mb-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-800 mb-2">
                                                {sale.invoiceNumber}
                                            </h3>
                                            <div className="flex items-center gap-2 mb-2">
                                                <SaleStatusBadge status={sale.status} />
                                                <PaymentMethodBadge method={sale.paymentMethod} />
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Calendar className="w-4 h-4" />
                                                {format(new Date(sale.saleDate), "dd MMMM yyyy, HH:mm", {
                                                    locale: localeId,
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <User className="w-4 h-4 text-gray-400 mt-1" />
                                                <div>
                                                    <p className="text-xs text-gray-500">Customer</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {sale.customer?.name || "Customer Umum"}
                                                    </p>
                                                    {sale.customer?.phone && (
                                                        <p className="text-sm text-gray-600">{sale.customer.phone}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CreditCard className="w-4 h-4 text-gray-400 mt-1" />
                                                <div>
                                                    <p className="text-xs text-gray-500">Kasir</p>
                                                    <p className="font-semibold text-gray-800">{sale.cashier.name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="glass-card p-6 mb-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Detail Item</h3>
                                    <div className="overflow-x-auto">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>No</th>
                                                    <th>Produk</th>
                                                    <th>Satuan</th>
                                                    <th className="text-right">Qty</th>
                                                    <th className="text-right">Harga</th>
                                                    <th className="text-right">Diskon</th>
                                                    <th className="text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sale.saleItems.map((item: SaleItem, index: number) => (
                                                    <tr key={item.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <div>
                                                                <p className="font-medium">{item.product.name}</p>
                                                                <p className="text-xs text-gray-500">{item.product.code}</p>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-info">
                                                                {item.unit.symbol || item.unit.name}
                                                            </span>
                                                        </td>
                                                        <td className="text-right">{item.quantity}</td>
                                                        <td className="text-right">
                                                            Rp {Number(item.unitPrice).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="text-right">
                                                            Rp {Number(item.discount).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="text-right font-semibold">
                                                            Rp {Number(item.subtotal).toLocaleString("id-ID")}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Payment Summary */}
                                <div className="glass-card p-6">
                                    <div className="space-y-3 max-w-md ml-auto">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total:</span>
                                            <span className="font-semibold">
                                                Rp {Number(sale.totalAmount).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Diskon:</span>
                                            <span className="font-semibold text-red-600">
                                                - Rp {Number(sale.discount).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Pajak:</span>
                                            <span className="font-semibold">
                                                Rp {Number(sale.tax).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                        <div className="border-t pt-3 flex justify-between">
                                            <span className="font-bold text-lg">Grand Total:</span>
                                            <span className="font-bold text-xl text-blue-600">
                                                Rp {Number(sale.grandTotal).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm border-t pt-2">
                                            <span className="text-gray-600">Dibayar:</span>
                                            <span className="font-semibold text-green-600">
                                                Rp {Number(sale.paidAmount).toLocaleString("id-ID")}
                                            </span>
                                        </div>

                                        {/* ✅ TAMBAH INFO SISA HUTANG */}
                                        {sale.customerDebt && sale.customerDebt.remainingDebt > 0 && (
                                            <div className="flex justify-between text-sm bg-yellow-50 p-2 rounded">
                                                <span className="text-gray-700 font-medium">Sisa Hutang:</span>
                                                <span className="font-bold text-red-600">
                                                    Rp {Number(sale.customerDebt.remainingDebt).toLocaleString("id-ID")}
                                                </span>
                                            </div>
                                        )}
                                        {sale.changeAmount > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Kembalian:</span>
                                                <span className="font-semibold text-green-600">
                                                    Rp {Number(sale.changeAmount).toLocaleString("id-ID")}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {sale.notes && (
                                        <div className="mt-4 pt-4 border-t">
                                            <p className="text-sm text-gray-600">
                                                <span className="font-semibold">Catatan:</span> {sale.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        <div className="modal-footer" style={{ position: 'sticky', bottom: 0, backgroundColor: 'white', zIndex: 10 }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn-secondary"
                            >
                                Tutup
                            </button>
                            <button onClick={handlePrint} className="btn-info">
                                <Printer className="w-4 h-4" />
                                Print
                            </button>
                            <button onClick={handleDownloadPDF} className="btn-primary">
                                <Download className="w-4 h-4" />
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}