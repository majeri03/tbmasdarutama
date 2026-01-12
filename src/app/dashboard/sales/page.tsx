// LINE 1-15, TAMBAHKAN import:
"use client";

import { useState, useEffect, useCallback } from "react";  // ✅ tambah useCallback
import { ShoppingCart, Filter, FileText } from "lucide-react";  // ✅ hapus Download
import { getSales } from "@/lib/actions/sale.actions";
import { SalesStats } from "./_components/SalesStats";
import { SaleFormModal } from "./_components/SaleFormModal";
import { SaleViewModal } from "./_components/SaleViewModal";
import { SaleInvoicePDF } from "./_components/SaleInvoicePDF";
import { SaleStatusBadge } from "./_components/SaleStatusBadge";
import { PaymentMethodBadge } from "./_components/PaymentMethodBadge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SaleStatus, PaymentMethod } from "@prisma/client";  // ✅ TAMBAH INI
import { DeleteSaleDialog } from "./_components/DeleteSaleDialog";

interface Sale {
    id: string;
    invoiceNumber: string;
    saleDate: Date;
    status: SaleStatus;  // ✅ FIX: ganti ke SaleStatus
    paymentMethod: PaymentMethod;  // ✅ FIX: ganti ke PaymentMethod
    grandTotal: number;  // sudah benar
    customer: {
        code: string;
        name: string;
    } | null;
    cashier: {
        name: string;
    };
}

export default function SalesPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Invoice Modal
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);



    const loadSales = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await getSales({
                search: searchTerm || undefined,
                status: (statusFilter || undefined) as SaleStatus | undefined,
                paymentMethod: (paymentMethodFilter || undefined) as PaymentMethod | undefined,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
                page: 1,     // ✅ FIX: ubah dari 0 ke 1
                limit: 100,  // ✅ FIX: ubah dari 0 ke 100 (atau sesuai kebutuhan)
            });

            if (result.success && result.data) {
                setSales(result.data.map((sale) => ({
                    ...sale,
                    grandTotal: Number(sale.grandTotal),
                })));
            } else {
                setError(result.error || "Gagal memuat data penjualan");
            }
        } catch {
            setError("Gagal memuat data penjualan");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    const handleFilter = () => {
        loadSales();
    };

    const handleReset = () => {
        setSearchTerm("");
        setStatusFilter("");
        setPaymentMethodFilter("");
        setDateFrom("");
        setDateTo("");
        loadSales();
    };

    const handleShowInvoice = (saleId: string) => {
        setSelectedSaleId(saleId);
        setShowInvoiceModal(true);
    };

    const handleCloseInvoice = () => {
        setShowInvoiceModal(false);
        setSelectedSaleId(null);
    };

    const filteredSales = sales;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manajemen Penjualan</h1>
                    <p className="page-subtitle">Kelola transaksi penjualan</p>
                </div>
                <SaleFormModal onSuccess={loadSales} />
            </div>

            {/* Stats */}
            <SalesStats />

            {/* Filters */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-500" />
                    <h2 className="text-lg font-semibold">Filter & Pencarian</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="label">Cari</label>
                        <input
                            type="text"
                            placeholder="No. Invoice, Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="label">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Semua Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Metode Pembayaran</label>
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Semua Metode</option>
                            <option value="CASH">Tunai</option>
                            <option value="TRANSFER">Transfer</option>
                            <option value="CREDIT">Kredit</option>
                            <option value="QRIS">QRIS</option>
                            <option value="DEBIT_CARD">Kartu Debit</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Dari Tanggal</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="label">Sampai Tanggal</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <button onClick={handleFilter} className="btn-primary">
                        <Filter className="w-4 h-4" />
                        Terapkan Filter
                    </button>
                    <button onClick={handleReset} className="btn-secondary">
                        Reset
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="spinner-large"></div>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Belum ada data penjualan</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No. Invoice</th>
                                    <th>Tanggal</th>
                                    <th>Customer</th>
                                    <th>Kasir</th>
                                    <th>Status</th>
                                    <th>Pembayaran</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id}>
                                        <td>
                                            <span className="font-mono font-semibold text-blue-600">
                                                {sale.invoiceNumber}
                                            </span>
                                        </td>
                                        <td>
                                            {format(new Date(sale.saleDate), "dd MMM yyyy, HH:mm", {
                                                locale: localeId,
                                            })}
                                        </td>
                                        <td>
                                            <div>
                                                <p className="font-medium">{sale.customer?.name || "Customer Umum"}</p>
                                                <p className="text-xs text-gray-500">{sale.customer?.code || "-"}</p>
                                            </div>
                                        </td>
                                        <td>{sale.cashier.name}</td>
                                        <td>
                                            <SaleStatusBadge status={sale.status} />
                                        </td>
                                        <td>
                                            <PaymentMethodBadge method={sale.paymentMethod} />
                                        </td>
                                        <td className="text-right font-semibold">
                                            Rp {Number(sale.grandTotal).toLocaleString("id-ID")}
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-center gap-2">
                                                <SaleViewModal saleId={sale.id} />
                                                <button
                                                    onClick={() => handleShowInvoice(sale.id)}
                                                    className="btn-icon-success"
                                                    title="Cetak Invoice"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <DeleteSaleDialog sale={sale} onSuccess={loadSales} /> 
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Invoice Modal */}
            {selectedSaleId && (
                <SaleInvoicePDF
                    isOpen={showInvoiceModal}
                    onClose={handleCloseInvoice}
                    saleId={selectedSaleId}
                />
            )}
        </div>
    );
}