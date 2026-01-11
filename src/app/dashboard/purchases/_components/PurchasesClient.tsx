"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { PurchaseStats } from "./PurchaseStats";
import { PurchaseTable } from "./PurchaseTable";
import { PurchaseFormModal } from "./PurchaseFormModal";
import { PurchaseViewModal } from "./PurchaseViewModal";
import { ReceivePurchaseModal } from "./ReceivePurchaseModal";
import { DeletePurchaseDialog } from "./DeletePurchaseDialog";
import { getAllPurchases, getPurchaseStatistics } from "@/lib/actions/purchase.actions";
import { getSuppliers } from "@/lib/actions/supplier.actions";
import { PurchaseData } from "@/types/purchase";
import { PurchaseStatus } from "@prisma/client";

interface Supplier {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
}

export function PurchasesClient() {
    const [purchases, setPurchases] = useState<PurchaseData[]>([]);
    const [stats, setStats] = useState({
        totalPurchases: 0,
        pendingCount: 0,
        totalThisMonth: 0,
        totalValue: 0,
    });
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<PurchaseStatus | "">("");
    const [showFilters, setShowFilters] = useState(false);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isReceiveOpen, setIsReceiveOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<PurchaseData | null>(null);

    // Load data with useCallback to fix dependency warning
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [purchasesResult, statsResult] = await Promise.all([
                getAllPurchases({
                    search,
                    supplierId: selectedSupplier || undefined,
                    status: selectedStatus || undefined,
                }),
                getPurchaseStatistics(),
            ]);

            if (purchasesResult.success && purchasesResult.data) {
                // Transform Decimal to number
                const transformedPurchases = purchasesResult.data.map((purchase) => ({
                    ...purchase,
                    totalAmount: Number(purchase.totalAmount),
                    discount: Number(purchase.discount),
                    tax: Number(purchase.tax),
                    grandTotal: Number(purchase.grandTotal),
                    paidAmount: Number(purchase.paidAmount),
                    purchaseItems: purchase.purchaseItems.map((item) => ({
                        ...item,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unitPrice),
                        discount: Number(item.discount),
                        subtotal: Number(item.subtotal),
                    })),
                }));
                setPurchases(transformedPurchases);
            }

            if (statsResult.success && statsResult.data) {
                // Transform Decimal to number
                setStats({
                    totalPurchases: statsResult.data.totalPurchases,
                    pendingCount: statsResult.data.pendingCount,
                    totalThisMonth: statsResult.data.totalThisMonth,
                    totalValue: Number(statsResult.data.totalValue),
                });
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [search, selectedSupplier, selectedStatus]);

    const loadSuppliers = async () => {
        const result = await getSuppliers();
        if (result.success && result.data) {
            setSuppliers(result.data);
        }
    };

    // Load data
    useEffect(() => {
        loadData();
        loadSuppliers();
    }, [loadData]);

    // Handlers
    const handleCreate = () => {
        setSelectedPurchase(null);
        setIsFormOpen(true);
    };

    const handleView = (purchase: PurchaseData) => {
        setSelectedPurchase(purchase);
        setIsViewOpen(true);
    };

    const handleEdit = (purchase: PurchaseData) => {
        setSelectedPurchase(purchase);
        setIsFormOpen(true);
    };

    const handleReceive = (purchase: PurchaseData) => {
        setSelectedPurchase(purchase);
        setIsReceiveOpen(true);
    };

    const handleDelete = (purchase: PurchaseData) => {
        setSelectedPurchase(purchase);
        setIsDeleteOpen(true);
    };

    const handleSuccess = () => {
        loadData();
    };

    const handleClearFilters = () => {
        setSearch("");
        setSelectedSupplier("");
        setSelectedStatus("");
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <PurchaseStats stats={stats} />

            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Kelola pembelian barang dari supplier
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>

                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Buat PO
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="glass-card p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cari PO / Supplier
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Ketik PO number atau nama supplier..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Supplier Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Supplier
                            </label>
                            <select
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Semua Supplier</option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value as PurchaseStatus)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Semua Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="RECEIVED">Received</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {(search || selectedSupplier || selectedStatus) && (
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Menampilkan {purchases.length} hasil
                            </p>
                            <button
                                onClick={handleClearFilters}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Reset Filter
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Table */}
            {isLoading ? (
                <div className="glass-card p-8">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Memuat data...</span>
                    </div>
                </div>
            ) : (
                <PurchaseTable
                    purchases={purchases}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReceive={handleReceive}
                />
            )}

            {/* Modals */}
            <PurchaseFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setSelectedPurchase(null);
                }}
                onSuccess={handleSuccess}
                purchase={selectedPurchase || undefined}
            />

            <PurchaseViewModal
                isOpen={isViewOpen}
                onClose={() => {
                    setIsViewOpen(false);
                    setSelectedPurchase(null);
                }}
                purchase={selectedPurchase}
            />

            <ReceivePurchaseModal
                isOpen={isReceiveOpen}
                onClose={() => {
                    setIsReceiveOpen(false);
                    setSelectedPurchase(null);
                }}
                onSuccess={handleSuccess}
                purchase={selectedPurchase}
            />

            <DeletePurchaseDialog
                isOpen={isDeleteOpen}
                onClose={() => {
                    setIsDeleteOpen(false);
                    setSelectedPurchase(null);
                }}
                onSuccess={handleSuccess}
                purchase={selectedPurchase}
            />
        </div>
    );
}