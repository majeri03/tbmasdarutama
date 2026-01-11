"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getSalesForTable } from "@/lib/actions/sale.actions";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { PaymentMethodBadge } from "./PaymentMethodBadge";
import { SaleViewModal } from "./SaleViewModal";
import { DeleteSaleDialog } from "./DeleteSaleDialog";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SaleStatus, PaymentMethod } from "@prisma/client";

interface SaleData {
  id: string;
  invoiceNumber: string;
  saleDate: Date;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  customer: {
    id: string;
    code: string;
    name: string;
  } | null;
  cashier: {
    id: string;
    name: string;
  };
}

export function SalesTable() {
  const [sales, setSales] = useState<SaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SaleStatus | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getSalesForTable({
        search: search || undefined,
        status: status || undefined,
        paymentMethod: paymentMethod || undefined,
        page,
        limit: 10,
      });

      if (result.success && result.data) {
        setSales(result.data);
        setTotalPages(result.pagination?.totalPages || 1);
      } else {
        setError(result.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data penjualan");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, paymentMethod]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value as SaleStatus | "");
    setPage(1);
  };

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value as PaymentMethod | "");
    setPage(1);
  };

  return (
    <div className="glass-card">
      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Cari invoice atau customer..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input-field"
            >
              <option value="">Semua Status</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

          <div>
            <select
              value={paymentMethod}
              onChange={(e) => handlePaymentMethodChange(e.target.value)}
              className="input-field"
            >
              <option value="">Semua Pembayaran</option>
              <option value="CASH">Tunai</option>
              <option value="TRANSFER">Transfer</option>
              <option value="CREDIT">Kredit</option>
              <option value="QRIS">QRIS</option>
              <option value="DEBIT_CARD">Kartu Debit</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner-large"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Tidak ada data penjualan</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tanggal</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Pembayaran</th>
                <th>Status</th>
                <th>Kasir</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <span className="font-semibold text-blue-600">
                      {sale.invoiceNumber}
                    </span>
                  </td>
                  <td>
                    {format(new Date(sale.saleDate), "dd MMM yyyy", {
                      locale: localeId,
                    })}
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{sale.customer?.name || "Customer Umum"}</p>
                      {sale.customer?.code && (
                        <p className="text-xs text-gray-500">{sale.customer.code}</p>
                      )}
                    </div>
                  </td>
                  <td className="font-semibold">
                    Rp {Number(sale.grandTotal).toLocaleString("id-ID")}
                  </td>
                  <td>
                    <PaymentMethodBadge method={sale.paymentMethod} />
                  </td>
                  <td>
                    <SaleStatusBadge status={sale.status} />
                  </td>
                  <td>{sale.cashier.name}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <SaleViewModal saleId={sale.id} />
                      <DeleteSaleDialog sale={sale} onSuccess={loadSales} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && sales.length > 0 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
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
  );
}