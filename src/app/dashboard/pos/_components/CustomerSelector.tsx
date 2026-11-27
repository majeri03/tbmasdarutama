"use client";

import { useState, useEffect, useCallback } from "react";
import { POSCustomer } from "@/types/pos";
import { getPOSCustomers } from "@/lib/actions/pos.actions";
import { getCustomerDiscount } from "@/lib/utils/pos-helpers";
import { CustomerType } from "@prisma/client";
import { User, Search, Loader2, UserPlus } from "lucide-react";

interface CustomerSelectorProps {
    selectedCustomer: POSCustomer | null;
    onSelectCustomer: (customer: POSCustomer | null) => void;
    onQuickAdd: () => void;
}

export function CustomerSelector({ selectedCustomer, onSelectCustomer, onQuickAdd }: CustomerSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customers, setCustomers] = useState<POSCustomer[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Pindahkan loadCustomers ke atas SEBELUM useEffect
    const loadCustomers = useCallback(async (searchQuery?: string) => {
        setIsLoading(true);
        const result = await getPOSCustomers(searchQuery);
        if (result.success && result.data) {
            const customersWithDiscount = result.data
                .map((c) => ({
                    ...c,
                    email: null,
                    address: null,
                    city: null,
                    province: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    discountPercent: getCustomerDiscount(c.type),
                } as POSCustomer))
                .sort((a, b) => {
                    // Customer Umum (tipe UMUM) di paling atas — dikenali dari
                    // tipe, BUKAN dari kode hardcoded (tidak ada kode CUST-*
                    // yang boleh diasumsikan di sini).
                    if (a.type === CustomerType.UMUM) return -1;
                    if (b.type === CustomerType.UMUM) return 1;
                    // Sisanya sort by name
                    return a.name.localeCompare(b.name);
                });
            setCustomers(customersWithDiscount);
        }
        setIsLoading(false);
    }, []);

    // Load customers on open
    useEffect(() => {
        if (isOpen) {
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Search customers
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                loadCustomers(search);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [search, isOpen, loadCustomers]);

    const handleSelect = (customer: POSCustomer) => {
        onSelectCustomer(customer);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div className="relative">
            {/* Selected Customer Display */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full glass-card p-2 md:p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#7F1D1D] flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-stone-400">Customer</p>
                        <p className="font-semibold text-stone-100">
                            {selectedCustomer ? selectedCustomer.name : "Pilih Customer"}
                        </p>
                        {selectedCustomer && (
                            <p className="text-xs text-[#E5484D]">
                                {selectedCustomer.type} • Diskon {selectedCustomer.discountPercent}% • {selectedCustomer.points ?? 0} poin
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-stone-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    {/* Dropdown Content */}
                    {/* WS-3 (perbaikan ke-4): dulu .glass-card (putih 10%
                        + blur) — kartu produk di belakang menembus dan
                        daftar customer bercampur dengan produk; label
                        baris di belakang ("Sales") ikut terlihat
                        menumpuk dengan isi dropdown. Sekarang panel
                        solid #211E1B (sama seperti dropdown hasil
                        pencarian Stock Opname yang sudah terbaca)
                        + bayangan kuat, supaya daftar customer
                        selalu di atas dan terbaca. */}
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#211E1B] border border-white/10 rounded-2xl shadow-2xl max-h-96 flex flex-col overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari customer..."
                                    className="w-full pl-10 pr-3 py-2 border border-white/15 bg-white/[0.06] text-stone-100 placeholder:text-stone-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F1D1D]"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Quick Add Button */}
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onQuickAdd();
                            }}
                            className="p-3 border-b border-white/10 flex items-center gap-2 text-[#E5484D] hover:bg-[rgba(127,29,29,0.06)] transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="text-sm font-medium">Tambah Customer Baru</span>
                        </button>

                        {/* Customer List */}
                        <div className="overflow-y-auto flex-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#E5484D]" />
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="p-8 text-center text-stone-400">
                                    <p className="text-sm">Customer tidak ditemukan</p>
                                </div>
                            ) : (
                                customers.map((customer) => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelect(customer)}
                                        className="w-full p-3 flex items-center gap-3 hover:bg-[rgba(127,29,29,0.06)] transition-colors border-b border-white/[0.07] last:border-0"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-stone-100 truncate">{customer.name}</p>
                                                {/* ✅ PENANDA CUSTOMER UMUM (berdasar tipe, bukan kode) */}
                                                {customer.type === CustomerType.UMUM && (
                                                    <span className="px-2 py-0.5 bg-[rgba(229,72,77,0.12)] text-[#E5484D] text-[10px] font-medium rounded">
                                                        UMUM
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-stone-400">
                                                {customer.code} • {customer.type}
                                                {customer.discountPercent > 0 && ` • Diskon ${customer.discountPercent}%`}
                                                {` • ${customer.points ?? 0} poin`}
                                            </p>
                                            {customer.phone && (
                                                <p className="text-xs text-stone-400">{customer.phone}</p>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}