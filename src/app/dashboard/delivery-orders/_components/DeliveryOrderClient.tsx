"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, Calendar } from "lucide-react";
import { DeliveryStatus } from "@prisma/client";
import { DeliveryOrderData } from "@/types/delivery-order";
import { getAllDeliveryOrders, getDeliveryOrderStatistics } from "@/lib/actions/delivery-order.actions";
import { DeliveryOrderStats } from "./DeliveryOrderStats";
import { DeliveryOrderTable } from "./DeliveryOrderTable";
import { DeliveryOrderFormModal } from "./DeliveryOrderFormModal";
import { DeliveryOrderDetailModal } from "./DeliveryOrderDetailModal";
import { ReceiveDeliveryModal } from "./ReceiveDeliveryModal";
import { DeleteDeliveryDialog } from "./DeleteDeliveryDialog";
import { printDeliveryOrder } from "@/lib/utils/delivery-order-generator";

export function DeliveryOrderClient() {
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrderData[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<DeliveryOrderData[]>([]);
    const [statistics, setStatistics] = useState({
        totalDeliveries: 0,
        inTransit: 0,
        deliveredToday: 0,
        pendingCount: 0,
    });

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderData | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deliveryOrders, searchQuery, statusFilter, dateFrom, dateTo]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [ordersResult, statsResult] = await Promise.all([
                getAllDeliveryOrders(),
                getDeliveryOrderStatistics(),
            ]);

            if (ordersResult.success && ordersResult.data) {
                setDeliveryOrders(ordersResult.data);
            }

            if (statsResult.success && statsResult.data) {
                setStatistics(statsResult.data);
            }
        } catch (error) {
            console.error("Error loading delivery orders:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterOrders = () => {
        let filtered = [...deliveryOrders];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (order) =>
                    order.doNumber.toLowerCase().includes(query) ||
                    order.customer.name.toLowerCase().includes(query) ||
                    order.customer.code.toLowerCase().includes(query) ||
                    order.driver?.toLowerCase().includes(query) ||
                    order.vehicle?.toLowerCase().includes(query)
            );
        }

        // Status filter
        if (statusFilter !== "ALL") {
            filtered = filtered.filter((order) => order.status === statusFilter);
        }

        // Date range filter
        if (dateFrom) {
            filtered = filtered.filter(
                (order) =>
                    new Date(order.deliveryDate) >= new Date(dateFrom)
            );
        }

        if (dateTo) {
            filtered = filtered.filter(
                (order) =>
                    new Date(order.deliveryDate) <= new Date(dateTo)
            );
        }

        setFilteredOrders(filtered);
    };

    const handleView = (order: DeliveryOrderData) => {
        setSelectedOrderId(order.id);
        setIsDetailModalOpen(true);
    };

    const handleUpdateStatus = (order: DeliveryOrderData) => {
        setSelectedOrder(order);
        setIsReceiveModalOpen(true);
    };

    const handleDelete = (order: DeliveryOrderData) => {
        setSelectedOrder(order);
        setIsDeleteDialogOpen(true);
    };

    const handlePrint = (order: DeliveryOrderData) => {
        printDeliveryOrder(order);
    };

    const handleSuccess = () => {
        loadData();
    };

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setDateFrom("");
        setDateTo("");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Memuat data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Surat Jalan</h1>
                    <p className="text-gray-600 mt-1">
                        Kelola surat jalan dan tracking pengiriman
                    </p>
                </div>
                <button
                    onClick={() => setIsFormModalOpen(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Buat Surat Jalan
                </button>
            </div>

            {/* Statistics */}
            <DeliveryOrderStats stats={statistics} />

            {/* Filters */}
            <div className="glass-card p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari surat jalan..."
                            className="input-field pl-10"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "ALL")}
                            className="input-field pl-10"
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="PENDING">Menunggu</option>
                            <option value="IN_TRANSIT">Dalam Pengiriman</option>
                            <option value="DELIVERED">Terkirim</option>
                            <option value="CANCELLED">Dibatalkan</option>
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="input-field pl-10"
                            placeholder="Dari tanggal"
                        />
                    </div>

                    {/* Date To */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="input-field pl-10"
                            placeholder="Sampai tanggal"
                        />
                    </div>
                </div>

                {/* Filter Info & Clear */}
                {(searchQuery || statusFilter !== "ALL" || dateFrom || dateTo) && (
                    <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            Menampilkan {filteredOrders.length} dari {deliveryOrders.length} surat jalan
                        </p>
                        <button
                            onClick={clearFilters}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Reset Filter
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <DeliveryOrderTable
                deliveryOrders={filteredOrders}
                onView={handleView}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDelete}
                onPrint={handlePrint}
            />

            {/* Modals */}
            <DeliveryOrderFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSuccess={handleSuccess}
            />

            <DeliveryOrderDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedOrderId(null);
                }}
                deliveryOrderId={selectedOrderId}
            />

            <ReceiveDeliveryModal
                isOpen={isReceiveModalOpen}
                onClose={() => {
                    setIsReceiveModalOpen(false);
                    setSelectedOrder(null);
                }}
                onSuccess={handleSuccess}
                deliveryOrder={selectedOrder}
            />

            <DeleteDeliveryDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setSelectedOrder(null);
                }}
                onSuccess={handleSuccess}
                deliveryOrder={selectedOrder}
            />
        </div>
    );
}