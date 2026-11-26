// LINE 1-15, TAMBAHKAN import:
"use client";

import { useState, useEffect, useCallback } from "react";  // ✅ tambah useCallback
import { ShoppingCart, Filter, FileText, Pencil, ChevronLeft, ChevronRight } from "lucide-react";  // ✅ hapus Download
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/utils/role";
import { getSales } from "@/lib/actions/sale.actions";
import { SalesStats } from "./_components/SalesStats";
import { SaleFormModal } from "./_components/SaleFormModal";
import { SaleViewModal } from "./_components/SaleViewModal";
import { SaleInvoicePDF } from "./_components/SaleInvoicePDF";
import { EditSaleModal } from "./_components/EditSaleModal";
import { ShareInvoiceWhatsApp } from "./_components/ShareInvoiceWhatsApp";
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
    // Salesman ditambahkan PKG-A (Sale.salesmanId + relasi + getSales include).
    // Opsional supaya halaman tetap jalan sebelum PKG-A: tanpa data, tampil "-".
    salesman?: {
        name: string;
    } | null;
}

export default function SalesPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters — WS-D item 47: ada DUA state filter. Input di atas hanya
    // mengubah "draf"; yang dikirim ke server adalah appliedFilters, yang
    // baru berubah saat "Terapkan Filter" ditekan. Dulu setiap ketikan
    // langsung memicu fetch, sehingga banyak request in-flight saling
    // berlomba dan respons basi (tanpa filter / filter prefix "INV")
    // bisa tiba paling akhir dan menimpa hasil pencarian yang benar —
    // daftar tampak "tetap 8 baris" walau pencarian sudah diketik.
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    interface AppliedSalesFilters {
        search: string;
        status: string;
        paymentMethod: string;
        dateFrom: string;
        dateTo: string;
    }
    const EMPTY_FILTERS: AppliedSalesFilters = {
        search: "",
        status: "",
        paymentMethod: "",
        dateFrom: "",
        dateTo: "",
    };
    const [appliedFilters, setAppliedFilters] = useState<AppliedSalesFilters>(EMPTY_FILTERS);

    // WS-D item 46: dulu page/limit di-hardcode (page 1, limit 30) tanpa
    // kontrol pagination sama sekali.
    const PAGE_SIZE = 10;
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    // WS-D item 46: kartu statistik (SalesStats) dimuat sekali saat mount
    // dan tidak pernah ikut termuat ulang. Kunci ini dinaikkan setiap kali
    // daftar berhasil dimuat ulang, supaya kartu ikut segar.
    const [statsKey, setStatsKey] = useState(0);

    const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

    // Invoice Modal
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    // Edit Modal (izin EDIT_SALE = ADMIN+, dicek juga di server)
    const [editSaleId, setEditSaleId] = useState<string | null>(null);
    const { data: session } = useSession();
    const canEdit = hasPermission(session, "EDIT_SALE");

    // Prefill pencarian dari URL (?search=INV-...) — dipakai saat ketuk
    // notifikasi (pusat notifikasi mengarah ke sini dengan nomor invoice).
    // WS-D item 47: isi draf DAN filter yang diterapkan, supaya pencarian
    // dari notifikasi langsung jalan tanpa menekan Terapkan Filter dulu.
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("search");
        if (q) {
            setSearchTerm(q);
            setAppliedFilters((f) => ({ ...f, search: q }));
        }
    }, []);


    const loadSales = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await getSales({
                search: appliedFilters.search || undefined,
                status: (appliedFilters.status || undefined) as SaleStatus | undefined,
                paymentMethod: (appliedFilters.paymentMethod || undefined) as PaymentMethod | undefined,
                dateFrom: appliedFilters.dateFrom ? new Date(appliedFilters.dateFrom) : undefined,
                dateTo: appliedFilters.dateTo ? new Date(appliedFilters.dateTo) : undefined,
                page,
                limit: PAGE_SIZE,
            });

            if (result.success && result.data) {
                setSales(result.data.map((sale) => ({
                    ...sale,
                    grandTotal: Number(sale.grandTotal),
                })));
                const tp = result.pagination?.totalPages || 1;
                setTotalPages(tp);
                setTotalCount(result.pagination?.total ?? result.data.length);
                // WS-D item 46: daftar segar -> kartu statistik ikut segar.
                setStatsKey((k) => k + 1);
                if (page > tp) setPage(tp);
            } else {
                setError(result.error || "Gagal memuat data penjualan");
            }
        } catch {
            setError("Gagal memuat data penjualan");
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page]);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    const handleFilter = () => {
        // WS-D item 47: baru di sini draf diterapkan + kembali ke halaman 1.
        // Mengetik saja TIDAK memicu fetch lagi (tidak ada race respons basi).
        setAppliedFilters({
            search: searchTerm,
            status: statusFilter,
            paymentMethod: paymentMethodFilter,
            dateFrom,
            dateTo,
        });
        setPage(1);
    };

    const handleReset = () => {
        setSearchTerm("");
        setStatusFilter("");
        setPaymentMethodFilter("");
        setDateFrom("");
        setDateTo("");
        // WS-D item 47: dulu Reset memanggil loadSales() langsung dengan
        // closure lama, sehingga filter lama tetap terkirim. Sekarang Reset
        // mengosongkan filter yang diterapkan; useEffect yang memuat ulang.
        setAppliedFilters(EMPTY_FILTERS);
        setPage(1);
    };

    const handleShowInvoice = (saleId: string) => {
        setSelectedSaleId(saleId);
        setShowInvoiceModal(true);
    };

    const handleCloseInvoice = () => {
        setShowInvoiceModal(false);
        setSelectedSaleId(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-100">Manajemen Penjualan</h1>
                    <p className="page-subtitle">Kelola transaksi penjualan</p>
                </div>
                <SaleFormModal onSuccess={loadSales} />
            </div>

            {/* Stats */}
            <SalesStats refreshKey={statsKey} />

            {/* Filters */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-stone-400" />
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
                <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-lg text-red-300">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden bg-white/15 border-white/10">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="spinner-large"></div>
                        </div>
                    ) : sales.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                            <p className="text-stone-400">
                                {hasActiveFilters
                                    ? "Tidak ada penjualan yang cocok dengan filter yang diterapkan"
                                    : "Belum ada data penjualan"}
                            </p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No. Invoice</th>
                                    <th>Tanggal</th>
                                    <th>Customer</th>
                                    <th>Kasir</th>
                                    <th>Sales</th>
                                    <th>Status</th>
                                    <th>Pembayaran</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((sale) => (
                                    <tr key={sale.id}>
                                        <td>
                                            <span className="font-mono font-semibold text-[#E5484D]">
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
                                                <p className="text-xs text-stone-400">{sale.customer?.code || "-"}</p>
                                            </div>
                                        </td>
                                        <td>{sale.cashier.name}</td>
                                        <td>{sale.salesman?.name || "-"}</td>
                                        <td>
                                            <SaleStatusBadge status={sale.status} />
                                        </td>
                                        <td>
                                            <PaymentMethodBadge method={sale.paymentMethod} />
                                        </td>
                                        <td className="text-right font-semibold tabular-nums">
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
                                                <ShareInvoiceWhatsApp saleId={sale.id} label="" />
                                                {canEdit && sale.status !== "CANCELLED" && sale.status !== "RETURN" && (
                                                    <button
                                                        onClick={() => setEditSaleId(sale.id)}
                                                        className="btn-icon"
                                                        title="Edit transaksi (ADMIN)"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <DeleteSaleDialog sale={sale} onSuccess={loadSales} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* WS-D item 46: kontrol pagination — dulu tidak ada sama
                    sekali (page 1, limit 30, hardcode). */}
                {!loading && sales.length > 0 && (
                    <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-sm text-stone-400">
                            Menampilkan {(page - 1) * PAGE_SIZE + 1}–
                            {Math.min(page * PAGE_SIZE, totalCount)} dari{" "}
                            {totalCount} penjualan
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn-secondary btn-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Prev
                            </button>
                            <span className="text-sm text-stone-400">
                                Halaman {page} dari {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="btn-secondary btn-sm"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Invoice Modal */}
            {selectedSaleId && (
                <SaleInvoicePDF
                    isOpen={showInvoiceModal}
                    onClose={handleCloseInvoice}
                    saleId={selectedSaleId}
                />
            )}

            {/* Edit Modal */}
            {editSaleId && (
                <EditSaleModal
                    saleId={editSaleId}
                    onClose={() => setEditSaleId(null)}
                    onSuccess={() => {
                        setEditSaleId(null);
                        loadSales();
                    }}
                />
            )}
        </div>
    );
}