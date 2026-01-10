"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CustomerType } from "@prisma/client";
import { CustomerStats } from "./CustomerStats";
import { CustomerTable } from "./CustomerTable";
import { CustomerFormModal } from "./CustomerFormModal";
import { CustomerViewModal } from "./CustomerViewModal";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";
import { toggleCustomerStatus } from "@/lib/actions/customer.actions";
import { Toast, useToast } from "@/components/ui/toast";
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

interface CustomersClientProps {
    initialCustomers: Customer[];
    initialTotal: number;
    initialPage: number;
    initialLimit: number;
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    totalDebts: number;
}

export function CustomersClient({
    initialCustomers,
    initialTotal,
    initialPage,
    initialLimit,
    totalCustomers,
    activeCustomers,
    inactiveCustomers,
    totalDebts,
}: CustomersClientProps) {
    const { toast, showToast, hideToast } = useToast();
    // Modal states
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
        null
    );
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    // Calculate total pages
    const totalPages = Math.ceil(initialTotal / initialLimit);

    // Handle success
    const handleSuccess = (message: string) => {
       showToast(message, "success"); 
        setTimeout(() => {
            const currentParams = new URLSearchParams(window.location.search);
            window.location.href = `/dashboard/customers?${currentParams.toString()}&t=${Date.now()}`;
        }, 1500);
    };

    // Handle error
    const handleError = (message: string) => {
        showToast(message, "error"); 
    };

    // Handle page change
    const handlePageChange = (page: number) => {
        window.location.href = `/dashboard/customers?page=${page}`;
    };

    // Handle refresh with filters
    const handleRefresh = (filters: {
        search?: string;
        page?: number;
        typeFilter?: CustomerType;
        statusFilter?: boolean | null;
    }) => {
        const params = new URLSearchParams();

        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", filters.page.toString());
        if (filters.typeFilter) params.set("type", filters.typeFilter);
        if (filters.statusFilter !== null && filters.statusFilter !== undefined) {
            params.set("status", filters.statusFilter.toString());
        }

        window.location.href = `/dashboard/customers?${params.toString()}`;
    };

    // Handle view customer
    const handleView = (customer: Customer) => {
        setSelectedCustomer(customer);
        setViewModalOpen(true);
    };

    // Handle edit customer
    const handleEdit = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormMode("edit");
        setFormModalOpen(true);
    };

    // Handle delete customer
    const handleDelete = (customer: Customer) => {
        setSelectedCustomer(customer);
        setDeleteDialogOpen(true);
    };

    // Handle toggle status
    const handleToggleStatus = async (customer: Customer) => {
        const confirmed = confirm(
            `Apakah Anda yakin ingin ${customer.isActive ? "menonaktifkan" : "mengaktifkan"
            } customer "${customer.name}"?`
        );

        if (!confirmed) return;
        showToast(
            `${customer.isActive ? "Menonaktifkan" : "Mengaktifkan"} customer...`,
            "info"
        );
        const result = await toggleCustomerStatus(customer.id);

        if (result.success) {
            handleSuccess(result.message || "Status customer berhasil diubah!");
        } else {
            handleError(result.error || "Gagal mengubah status customer");
        }
    };

    // Handle add customer
    const handleAddCustomer = () => {
        setSelectedCustomer(null);
        setFormMode("create");
        setFormModalOpen(true);
    };

    return (
        <div className="min-h-screen p-6"> {/* ✅ Fixed: removed p-6 */}
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customer</h1>
                    <p className="text-gray-600 mt-1">
                        Kelola data customer dan pelanggan
                    </p>
                </div>
                <button onClick={handleAddCustomer} className="btn-primary">
                    <Plus className="w-5 h-5" />
                    <span>Tambah Customer</span>
                </button>
            </div>

            {/* Statistics */}
            <CustomerStats
                totalCustomers={totalCustomers}
                activeCustomers={activeCustomers}
                inactiveCustomers={inactiveCustomers}
                totalDebts={totalDebts}
            />

            {/* Customer Table */}
            <CustomerTable
                customers={initialCustomers}
                currentPage={initialPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                onRefresh={handleRefresh}
            />

            {/* Modals */}
            <CustomerFormModal
                isOpen={formModalOpen}
                onClose={() => setFormModalOpen(false)}
                onSuccess={handleSuccess}
                customer={selectedCustomer || undefined}
                mode={formMode}
            />

            <CustomerViewModal
                customer={selectedCustomer}
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
            />

            <DeleteCustomerDialog
                customer={
                    selectedCustomer
                        ? {
                            id: selectedCustomer.id,
                            code: selectedCustomer.code,
                            name: selectedCustomer.name,
                        }
                        : { id: "", code: "", name: "" }
                }
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onSuccess={handleSuccess}
                onError={handleError}
            />
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}
        </div>
    );
}