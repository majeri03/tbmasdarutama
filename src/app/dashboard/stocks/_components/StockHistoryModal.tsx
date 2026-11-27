"use client";

import { X, Calendar, Package, TrendingUp, TrendingDown, Edit } from "lucide-react";
import { MovementType } from "@prisma/client";

interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
}

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: StockMovement | null;
  productName?: string;
}

export function StockHistoryModal({
  isOpen,
  onClose,
  movement,
  productName,
}: StockHistoryModalProps) {
  if (!isOpen || !movement) return null;

  const getMovementTypeInfo = (type: MovementType) => {
    switch (type) {
      case MovementType.IN:
        return {
          label: "Stock Masuk",
          icon: TrendingUp,
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
        };
      case MovementType.OUT:
        return {
          label: "Stock Keluar",
          icon: TrendingDown,
          color: "text-red-300",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
        };
      case MovementType.ADJUSTMENT:
        return {
          label: "Adjustment Stock",
          icon: Edit,
          color: "text-stone-300",
          bgColor: "bg-white/10",
          borderColor: "border-white/10",
        };
      default:
        return {
          label: "Unknown",
          icon: Package,
          color: "text-stone-400",
          bgColor: "bg-white/5",
          borderColor: "border-white/10",
        };
    }
  };

  const typeInfo = getMovementTypeInfo(movement.type);
  const Icon = typeInfo.icon;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  /* WS-3 (perbaikan ke-4) — pola backdrop-saudara yang sama dengan
     StockAdjustmentModal (lihat komentar di sana): .modal-overlay
     (fixed, z-50, backdrop-blur-md) sebagai saudara panel membuat
     blur menutupi panel modal sendiri + halaman di belakangnya,
     dan semua klik di modal mengenai backdrop. Diperbaiki ke pola
     standar: .modal-overlay sebagai induk, .modal-container anak. */
  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Modal */}
      <div
        className="modal-container relative max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${typeInfo.bgColor} rounded-xl`}>
                <Package className={`w-6 h-6 ${typeInfo.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-100">
                  Detail Pergerakan Stock
                </h2>
                <p className="text-sm text-stone-400">
                  Informasi lengkap movement stock
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Movement Type Card */}
            <div className={`p-6 rounded-xl border-2 ${typeInfo.borderColor} ${typeInfo.bgColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Icon className={`w-12 h-12 ${typeInfo.color}`} />
                  <div>
                    <div className={`text-sm font-medium ${typeInfo.color} mb-1`}>
                      {typeInfo.label}
                    </div>
                    <div className={`text-4xl font-bold ${typeInfo.color}`}>
                      {movement.type === MovementType.IN && "+"}
                      {movement.type === MovementType.OUT && "-"}
                      {movement.quantity} unit
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Info */}
            {productName && (
              <div>
                <label className="label mb-2">
                  Produk
                </label>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-semibold text-stone-100">{productName}</div>
                </div>
              </div>
            )}

            {/* Reference Info */}
            <div>
              <label className="label mb-2">
                Referensi
              </label>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="font-medium text-stone-100">
                  {movement.referenceType}
                </div>
                {movement.referenceId && (
                  <div className="text-sm text-stone-400 font-mono mt-1">
                    ID: {movement.referenceId}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {movement.notes && (
              <div>
                <label className="label mb-2">
                  Catatan
                </label>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                  <p className="text-stone-300 italic">{movement.notes}</p>
                </div>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="label mb-2">
                Tanggal & Waktu
              </label>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <Calendar className="w-5 h-5 text-stone-500" />
                <span className="text-stone-300">{formatDate(movement.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4 bg-white/5">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-stone-700 hover:bg-stone-600 text-white font-semibold rounded-xl transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
    </div>
  );
}