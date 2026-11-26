"use client";

import { useState, useEffect, useRef } from "react";
import {
    Search,
    Filter,
    Eye,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Phone,
    Mail,
    MapPin,
    Tag,
    X,
    RotateCcw,
} from "lucide-react";
import { CustomerType } from "@prisma/client";

interface Customer {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    type: CustomerType;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface CustomerTableProps {
    customers: Customer[];
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onView: (customer: Customer) => void;
    onEdit: (customer: Customer) => void;
    onDelete: (customer: Customer) => void;
    onToggleStatus: (customer: Customer) => void;
    onRefresh: (filters: {
        search?: string;
        page?: number;
        typeFilter?: CustomerType;
        statusFilter?: boolean | null;
    }) => void;
}

export function CustomerTable({
    customers,
    currentPage,
    totalPages,
    onPageChange,
    onView,
    onEdit,
    onDelete,
    onToggleStatus,
    onRefresh,
}: CustomerTableProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<CustomerType | "">("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [isClient, setIsClient] = useState(false);
    // ✅ Debounce timer
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsClient(true); // Mark as client-side

        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const urlSearch = urlParams.get("search") || "";
            const urlType = (urlParams.get("type") as CustomerType | "") || "";
            const urlStatus = urlParams.get("status") || "";

            // ✅ Use setTimeout to avoid cascading renders
            setTimeout(() => {
                setSearch(urlSearch);
                setTypeFilter(urlType);
                setStatusFilter(urlStatus);
            }, 0);
        }
    }, []);  

    // ✅ Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);


    // ✅ Handle search with debounce (800ms delay)
    const handleSearch = (value: string) => {
        setSearch(value);

        // Clear previous timer
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        // Set new timer
        searchTimerRef.current = setTimeout(() => {
            onRefresh({
                search: value || undefined,
                page: 1,
                typeFilter: typeFilter || undefined,
                statusFilter:
                    statusFilter === ""
                        ? null
                        : statusFilter === "true"
                            ? true
                            : statusFilter === "false"
                                ? false
                                : null,
            });
        }, 800); // Wait 800ms after user stops typing
    };

    // ✅ Handle type filter (instant)
    const handleTypeFilter = (value: string) => {
        const newType = value as CustomerType | "";
        setTypeFilter(newType);
        onRefresh({
            search: search || undefined,
            page: 1,
            typeFilter: newType || undefined,
            statusFilter:
                statusFilter === ""
                    ? null
                    : statusFilter === "true"
                        ? true
                        : statusFilter === "false"
                            ? false
                            : null,
        });
    };

    // ✅ Handle status filter (instant)
    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        onRefresh({
            search: search || undefined,
            page: 1,
            typeFilter: typeFilter || undefined,
            statusFilter:
                value === "" ? null : value === "true" ? true : value === "false" ? false : null,
        });
    };

    // ✅ Handle reset filters
    const handleResetFilters = () => {
        // Clear state first
        setSearch("");
        setTypeFilter("");
        setStatusFilter("");

        // Then navigate to clean URL
        window.location.href = "/dashboard/customers";
    };

    // ✅ Check if any filter is active
    const hasActiveFilters = search !== "" || typeFilter !== "" || statusFilter !== "";

    const getCustomerTypeBadge = (type: CustomerType) => {
        switch (type) {
            // WS-F item 4 — dulu tidak ada case UMUM, jadi getCustomerTypeBadge
            // mengembalikan undefined dan kolom TIPE customer UMUM (mis.
            // CUST-00006) tampil kosong.
            case CustomerType.UMUM:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-400 border border-white/10">
                        <Tag className="w-3 h-3" />
                        Umum
                    </span>
                );
            case CustomerType.REGULER:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-400 border border-white/10">
                        <Tag className="w-3 h-3" />
                        Reguler
                    </span>
                );
            case CustomerType.GROSIR:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-400 border border-white/10">
                        <Tag className="w-3 h-3" />
                        Grosir
                    </span>
                );
            case CustomerType.PROYEK:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-400 border border-white/10">
                        <Tag className="w-3 h-3" />
                        Proyek
                    </span>
                );
            // Pengaman: tipe apa pun yang tidak dikenal tetap tampil sebagai
            // teks (bukan sel kosong) supaya tidak terulang seperti UMUM.
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-400 border border-white/10">
                        <Tag className="w-3 h-3" />
                        {type}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Search & Filters */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Cari customer (nama, kode, telepon, email)..."
                            className="glass-input pl-10"
                        />
                        {isClient && search && (
                            <button
                                onClick={() => handleSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-4 h-4 text-stone-400" />
                            </button>
                        )}
                    </div>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => handleTypeFilter(e.target.value)}
                        className="glass-input md:w-48"
                    >
                        <option value="">Semua Tipe</option>
                        {/* WS-F item 4 — dulu tidak ada pilihan UMUM, jadi
                            customer UMUM tidak bisa difilter. */}
                        <option value={CustomerType.UMUM}>Umum</option>
                        <option value={CustomerType.REGULER}>Reguler</option>
                        <option value={CustomerType.GROSIR}>Grosir</option>
                        <option value={CustomerType.PROYEK}>Proyek</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusFilter(e.target.value)}
                        className="glass-input md:w-48"
                    >
                        <option value="">Semua Status</option>
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                    </select>
                </div>

                {/* Reset Filter Button */}
                {isClient && hasActiveFilters && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset Filter
                        </button>
                        <span className="text-sm text-stone-400">
                            {customers.length} hasil ditemukan
                        </span>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden bg-white/15 border-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Kontak
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Lokasi
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Tipe
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Filter className="w-12 h-12 text-stone-300" />
                                            <p className="text-sm text-stone-400">
                                                {hasActiveFilters
                                                    ? "Tidak ada customer yang sesuai dengan filter"
                                                    : "Belum ada customer"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        {/* Customer */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="font-semibold text-stone-100">
                                                    {customer.name}
                                                </div>
                                                <div className="text-sm text-stone-400 font-mono">
                                                    {customer.code}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {customer.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-stone-400">
                                                        <Phone className="w-3 h-3" />
                                                        <span>{customer.phone}</span>
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center gap-2 text-sm text-stone-400">
                                                        <Mail className="w-3 h-3" />
                                                        <span className="truncate max-w-[200px]">
                                                            {customer.email}
                                                        </span>
                                                    </div>
                                                )}
                                                {!customer.phone && !customer.email && (
                                                    <span className="text-sm text-stone-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Location */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-stone-400">
                                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate max-w-[150px]">
                                                    {customer.city || customer.province || "-"}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Type */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getCustomerTypeBadge(customer.type)}
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => onToggleStatus(customer)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${customer.isActive
                                                    ? "bg-green-500/10 text-green-300 border border-green-500/25 hover:bg-green-500/15"
                                                    : "bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/15"
                                                    }`}
                                            >
                                                {customer.isActive ? (
                                                    <>
                                                        <CheckCircle className="w-3 h-3" />
                                                        Aktif
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-3 h-3" />
                                                        Nonaktif
                                                    </>
                                                )}
                                            </button>
                                        </td>

                                        {/* ✅ Actions - Direct Icon Buttons */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* View Button */}
                                                <button
                                                    onClick={() => onView(customer)}
                                                    className="p-2 hover:bg-white/10 text-stone-400 rounded-lg transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {/* Edit Button */}
                                                <button
                                                    onClick={() => onEdit(customer)}
                                                    className="p-2 hover:bg-white/10 text-stone-400 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => onDelete(customer)}
                                                    className="p-2 hover:bg-red-500/10 text-red-300 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-sm text-stone-400">
                            Halaman {currentPage} dari {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-medium text-stone-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Sebelumnya
                            </button>
                            <button
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-sm font-medium text-stone-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
