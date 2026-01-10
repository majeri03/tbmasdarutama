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
            case CustomerType.REGULER:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Tag className="w-3 h-3" />
                        Reguler
                    </span>
                );
            case CustomerType.GROSIR:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <Tag className="w-3 h-3" />
                        Grosir
                    </span>
                );
            case CustomerType.PROYEK:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        <Tag className="w-3 h-3" />
                        Proyek
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-400" />
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
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset Filter
                        </button>
                        <span className="text-sm text-gray-600">
                            {customers.length} hasil ditemukan
                        </span>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Kontak
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Lokasi
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Tipe
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Filter className="w-12 h-12 text-gray-300" />
                                            <p className="text-sm text-gray-500">
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
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        {/* Customer */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="font-semibold text-gray-900">
                                                    {customer.name}
                                                </div>
                                                <div className="text-sm text-gray-500 font-mono">
                                                    {customer.code}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {customer.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Phone className="w-3 h-3" />
                                                        <span>{customer.phone}</span>
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Mail className="w-3 h-3" />
                                                        <span className="truncate max-w-[200px]">
                                                            {customer.email}
                                                        </span>
                                                    </div>
                                                )}
                                                {!customer.phone && !customer.email && (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Location */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
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
                                                    ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                                                    : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
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
                                                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {/* Edit Button */}
                                                <button
                                                    onClick={() => onEdit(customer)}
                                                    className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => onDelete(customer)}
                                                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
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
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            Halaman {currentPage} dari {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Sebelumnya
                            </button>
                            <button
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
