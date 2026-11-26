"use client";

import { Eye, Truck, Trash2, Printer, Pencil, Camera } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { DeliveryStatus } from "@prisma/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface DeliveryOrderTableProps {
  deliveryOrders: DeliveryOrderData[];
  onView: (order: DeliveryOrderData) => void;
  onUpdateStatus: (order: DeliveryOrderData) => void;
  onEdit?: (order: DeliveryOrderData) => void;
  onDelete: (order: DeliveryOrderData) => void;
  onPrint: (order: DeliveryOrderData) => void;
}

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Menunggu",
    className: "bg-amber-500/15 text-amber-300",
  },
  IN_TRANSIT: {
    label: "Dalam Pengiriman",
    className: "bg-white/10 text-stone-400 border border-white/10",
  },
  DELIVERED: {
    label: "Terkirim",
    className: "bg-green-500/15 text-green-300",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "bg-red-500/15 text-red-300",
  },
};

export function DeliveryOrderTable({
  deliveryOrders,
  onView,
  onUpdateStatus,
  onEdit,
  onDelete,
  onPrint,
}: DeliveryOrderTableProps) {
  if (deliveryOrders.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-stone-400">Tidak ada data surat jalan</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden bg-white/15 border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                No. Surat Jalan
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Tanggal Kirim
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Pengemudi
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Kendaraan
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {deliveryOrders.map((order) => (
              <tr key={order.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-stone-100">
                        {order.doNumber}
                      </p>
                      {(order.proofImage ||
                        order.notes?.includes("[BUKTI_KIRIM]") ||
                        order.notes?.includes("[FOTO_LOKASI]")) && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-300 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/25"
                          title="Ada Bukti Foto Pengiriman"
                        >
                          <Camera className="w-3 h-3 text-green-400" />
                          Foto Bukti
                        </span>
                      )}
                    </div>
                    {order.sale && (
                      <p className="text-xs text-stone-400">
                        Invoice: {order.sale.invoiceNumber}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="font-medium text-stone-100">
                      {order.customer.name}
                    </p>
                    <p className="text-stone-400">{order.customer.code}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-stone-100">
                    {format(new Date(order.deliveryDate), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-stone-100">
                    {order.driver || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-stone-100">
                    {order.vehicle || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-stone-400">
                    {order.deliveryItems.length} items
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusConfig[order.status].className
                    }`}
                  >
                    {statusConfig[order.status].label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onView(order)}
                      className="p-2 text-stone-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPrint(order)}
                      className="p-2 text-stone-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Print Surat Jalan"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(order)}
                        className="p-2 text-stone-400 hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit Surat Jalan (Admin/Superadmin)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {/* FIX WS-H (25 Nov 2026, batch 4 item 120): tombol
                        Update Status juga tampil untuk DO Terkirim, supaya
                        foto bukti lain bisa diunggah lewat modal status
                        (server mengizinkan refresh DELIVERED -> DELIVERED
                        tanpa potong stok lagi). Hanya DO Dibatalkan yang
                        tidak lagi bisa diubah statusnya. */}
                    {order.status !== "CANCELLED" && (
                      <button
                        onClick={() => onUpdateStatus(order)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title={order.status === "DELIVERED" ? "Update Status / Ganti Foto Bukti" : "Update Status"}
                      >
                        <Truck className="w-4 h-4" />
                      </button>
                    )}
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => onDelete(order)}
                        className="p-2 text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}