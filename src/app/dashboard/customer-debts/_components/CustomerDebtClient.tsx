"use client";

import { useState, useCallback, useEffect } from "react";
import { Search } from "lucide-react";
import { CustomerDebtStats } from "./CustomerDebtStats";
import { CustomerDebtTable } from "./CustomerDebtTable";
import { PaymentModal } from "./PaymentModal";
import { DebtDetailModal } from "./DebtDetailModal";
import { DeleteDebtDialog } from "./DeleteDebtDialog";
import { CustomerDebtData } from "@/types/customer-debt";
import { DebtStatus } from "@prisma/client";
import {
  getAllCustomerDebts,
  getCustomerDebtStatistics,
  updateOverdueDebts,
} from "@/lib/actions/customer-debt.actions";

export function CustomerDebtClient() {
  const [debts, setDebts] = useState<CustomerDebtData[]>([]);
  const [stats, setStats] = useState({
    activeDebts: 0,
    overdueCount: 0,
    paidThisMonth: 0,
    totalActive: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DebtStatus | "">("");

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<CustomerDebtData | null>(
    null
  );

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Update overdue status first
      await updateOverdueDebts();

      const [debtsResult, statsResult] = await Promise.all([
        getAllCustomerDebts({
          search: search || undefined,
          status: selectedStatus || undefined,
        }),
        getCustomerDebtStatistics(),
      ]);

      if (debtsResult.success && debtsResult.data) {
        const mappedDebts = debtsResult.data.map(debt => ({
          ...debt,
          payments: debt.payments.map(payment => ({
            ...payment,
            createdBy: payment.adminId,
          })),
        }));
        setDebts(mappedDebts);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleView = (debt: CustomerDebtData) => {
    setSelectedDebt(debt);
    setIsDetailOpen(true);
  };

  const handlePay = (debt: CustomerDebtData) => {
    setSelectedDebt(debt);
    setIsPaymentOpen(true);
  };

  const handleDelete = (debt: CustomerDebtData) => {
    setSelectedDebt(debt);
    setIsDeleteOpen(true);
  };

  const handleSuccess = () => {
    loadData();
    setSelectedDebt(null);
  };

  const handleClosePayment = () => {
    setIsPaymentOpen(false);
    setSelectedDebt(null);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedDebt(null);
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
    setSelectedDebt(null);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <CustomerDebtStats stats={stats} />

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari customer, no. piutang, atau invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as DebtStatus | "")}
            className="input-field w-full md:w-48"
          >
            <option value="">Semua Status</option>
            <option value="UNPAID">Belum Bayar</option>
            <option value="PARTIAL">Cicilan</option>
            <option value="PAID">Lunas</option>
            <option value="OVERDUE">Jatuh Tempo</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      ) : (
        <CustomerDebtTable
          debts={debts}
          onView={handleView}
          onPay={handlePay}
          onDelete={handleDelete}
        />
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={handleClosePayment}
        onSuccess={handleSuccess}
        debt={selectedDebt}
      />

      <DebtDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        debtId={selectedDebt?.id || null}
      />

      <DeleteDebtDialog
        isOpen={isDeleteOpen}
        onClose={handleCloseDelete}
        onSuccess={handleSuccess}
        debt={selectedDebt}
      />
    </div>
  );
}