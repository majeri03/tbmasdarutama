"use client";

import { Eye, Truck, Trash2, Printer } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { DeliveryStatus } from "@prisma/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface DeliveryOrderTableProps {
  deliveryOrders: DeliveryOrderData[];
  onView: (order: DeliveryOrderData) => void;
  onUpdateStatus: (order: DeliveryOrderData) => void;
  onDelete: (order: DeliveryOrderData) => void;
  onPrint: (order: DeliveryOrderData) => void;
}

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Menunggu",
    className: "bg-yellow-100 text-yellow-800",
  },
  IN_TRANSIT: {
    label: "Dalam Pengiriman",
    className: "bg-blue-100 text-blue-800",
  },
  DELIVERED: {
    label: "Terkirim",
    className: "bg-green-100 text-green-800",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "bg-red-100 text-red-800",
  },
};

export function DeliveryOrderTable({
  deliveryOrders,
  onView,
  onUpdateStatus,
  onDelete,
  onPrint,
}: DeliveryOrderTableProps) {
  if (deliveryOrders.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-gray-500">Tidak ada data surat jalan</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                No. Surat Jalan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tanggal Kirim
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pengemudi
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kendaraan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deliveryOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {order.doNumber}
                    </p>
                    {order.sale && (
                      <p className="text-xs text-gray-500">
                        Invoice: {order.sale.invoiceNumber}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {order.customer.name}
                    </p>
                    <p className="text-gray-500">{order.customer.code}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {format(new Date(order.deliveryDate), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {order.driver || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {order.vehicle || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-blue-600">
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
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPrint(order)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Print Surat Jalan"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {order.status !== "DELIVERED" &&
                      order.status !== "CANCELLED" && (
                        <button
                          onClick={() => onUpdateStatus(order)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Update Status"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => onDelete(order)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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