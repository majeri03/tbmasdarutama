"use client";

import { useState, useEffect, useCallback } from "react";
import { POSCustomer } from "@/types/pos";
import { getPOSCustomers } from "@/lib/actions/pos.actions";
import { getCustomerDiscount } from "@/lib/utils/pos-helpers";
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
                    // Customer Umum (CUST-00001) di paling atas
                    if (a.code === "CUST-00001") return -1;
                    if (b.code === "CUST-00001") return 1;
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
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-gray-500">Customer</p>
                        <p className="font-semibold text-gray-900">
                            {selectedCustomer ? selectedCustomer.name : "Pilih Customer"}
                        </p>
                        {selectedCustomer && (
                            <p className="text-xs text-blue-600">
                                {selectedCustomer.type} • Diskon {selectedCustomer.discountPercent}%
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-gray-400">
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
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card shadow-xl max-h-96 flex flex-col">
                        {/* Search */}
                        <div className="p-3 border-b border-gray-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari customer..."
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="p-3 border-b border-gray-200 flex items-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="text-sm font-medium">Tambah Customer Baru</span>
                        </button>

                        {/* Customer List */}
                        <div className="overflow-y-auto flex-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <p className="text-sm">Customer tidak ditemukan</p>
                                </div>
                            ) : (
                                customers.map((customer) => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelect(customer)}
                                        className="w-full p-3 flex items-center gap-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                                                {/* ✅ PENANDA CUSTOMER UMUM */}
                                                {customer.code === "CUST-00001" && (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                                                        UMUM
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {customer.code} • {customer.type}
                                                {customer.discountPercent > 0 && ` • Diskon ${customer.discountPercent}%`}
                                            </p>
                                            {customer.phone && (
                                                <p className="text-xs text-gray-400">{customer.phone}</p>
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