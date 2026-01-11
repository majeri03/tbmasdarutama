"use client";

import { useState, useEffect } from "react";
import { X, FileText, Printer } from "lucide-react";
import { DeliveryStatus } from "@prisma/client";
import { getDeliveryOrderById } from "@/lib/actions/delivery-order.actions";
import { printDeliveryOrder } from "@/lib/utils/delivery-order-generator";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { DeliveryOrderData } from "@/types/delivery-order";

interface DeliveryOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryOrderId: string | null;
}

interface DeliveryOrderDetail {
  id: string;
  doNumber: string;
  deliveryDate: Date;
  driver: string | null;
  vehicle: string | null;
  notes: string | null;
  status: DeliveryStatus;
  receivedBy: string | null;
  receivedDate: Date | null;
  createdAt: Date;
  customer: {
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  deliveryItems: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    product: {
      code: string;
      name: string;
    };
    unit: {
      name: string;
      symbol: string;
    };
  }>;
  sale?: {
    id: string;
    invoiceNumber: string;
    saleDate: Date;
    grandTotal: number;
  } | null;
}

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  PENDING: { label: "Menunggu", className: "bg-yellow-100 text-yellow-800" },
  IN_TRANSIT: { label: "Dalam Pengiriman", className: "bg-blue-100 text-blue-800" },
  DELIVERED: { label: "Terkirim", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Dibatalkan", className: "bg-red-100 text-red-800" },
};

export function DeliveryOrderDetailModal({
  isOpen,
  onClose,
  deliveryOrderId,
}: DeliveryOrderDetailModalProps) {
  const [deliveryOrder, setDeliveryOrder] = useState<DeliveryOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDeliveryOrder = async () => {
      if (!deliveryOrderId) return;

      setIsLoading(true);
      try {
        const result = await getDeliveryOrderById(deliveryOrderId);
        if (result.success && result.data) {
          setDeliveryOrder(result.data as DeliveryOrderDetail);
        }
      } catch (error) {
        console.error("Error loading delivery order:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && deliveryOrderId) {
      loadDeliveryOrder();
    }
  }, [isOpen, deliveryOrderId]);

  const handlePrint = () => {
    if (deliveryOrder) {
      printDeliveryOrder(deliveryOrder as unknown as DeliveryOrderData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Detail Surat Jalan</h2>
          <div className="flex items-center gap-2">
            {deliveryOrder && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : deliveryOrder ? (
          <div className="p-6 space-y-6">
            {/* DO Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Informasi Surat Jalan
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">No. Surat Jalan:</span>
                    <span className="font-semibold">{deliveryOrder.doNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statusConfig[deliveryOrder.status].className
                      }`}
                    >
                      {statusConfig[deliveryOrder.status].label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tanggal Kirim:</span>
                    <span className="text-sm">
                      {format(new Date(deliveryOrder.deliveryDate), "dd MMM yyyy", {
                        locale: id,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dibuat:</span>
                    <span className="text-sm">
                      {format(new Date(deliveryOrder.createdAt), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })}
                    </span>
                  </div>
                  {deliveryOrder.driver && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pengemudi:</span>
                      <span className="font-semibold">{deliveryOrder.driver}</span>
                    </div>
                  )}
                  {deliveryOrder.vehicle && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Kendaraan:</span>
                      <span className="font-semibold">{deliveryOrder.vehicle}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Informasi Customer
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Kode:</span>
                    <span className="font-semibold">{deliveryOrder.customer.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Nama:</span>
                    <span className="font-semibold">{deliveryOrder.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Telepon:</span>
                    <span className="text-sm">{deliveryOrder.customer.phone || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Alamat:</span>
                    <span className="text-sm text-right max-w-[200px]">
                      {deliveryOrder.customer.address || "-"}
                    </span>
                  </div>
                  {deliveryOrder.sale && (
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">No. Invoice:</span>
                      <span className="font-semibold">
                        {deliveryOrder.sale.invoiceNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="glass-card p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Items Pengiriman ({deliveryOrder.deliveryItems.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        No.
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Kode Produk
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Nama Produk
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                        Jumlah
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                        Satuan
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deliveryOrder.deliveryItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{index + 1}</td>
                        <td className="px-4 py-3 text-sm">{item.product.code}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {item.product.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-semibold">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {item.unit.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Received Info */}
            {deliveryOrder.status === "DELIVERED" && (
              <div className="glass-card p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Informasi Penerimaan
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Diterima Oleh:</span>
                    <span className="font-semibold">
                      {deliveryOrder.receivedBy || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tanggal Diterima:</span>
                    <span className="text-sm">
                      {deliveryOrder.receivedDate
                        ? format(
                            new Date(deliveryOrder.receivedDate),
                            "dd MMM yyyy HH:mm",
                            { locale: id }
                          )
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {deliveryOrder.notes && (
              <div className="glass-card p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Catatan</h3>
                <p className="text-sm text-gray-600">{deliveryOrder.notes}</p>
              </div>
            )}

            {/* Created By */}
            <div className="text-center text-sm text-gray-500">
              Dibuat oleh: <span className="font-semibold">{deliveryOrder.createdBy.name}</span>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500">Data tidak ditemukan</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="btn-secondary w-full">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}