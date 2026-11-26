// Panel keranjang yang ditahan (hold cart) — daftar, lanjutkan, hapus.

"use client";

import { X, Play, Trash2, Pause } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { parkedCartTotal, type ParkedCart } from "@/lib/utils/hold-cart";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface HoldCartPanelProps {
  isOpen: boolean;
  carts: ParkedCart[];
  onClose: () => void;
  onResume: (cart: ParkedCart) => void;
  onDelete: (id: string) => void;
}

export function HoldCartPanel({ isOpen, carts, onClose, onResume, onDelete }: HoldCartPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
            <Pause className="w-5 h-5 text-[#E5484D]" />
            Keranjang Ditahan ({carts.length})
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {carts.length === 0 ? (
            <p className="text-center text-stone-400 py-8">
              Belum ada keranjang yang ditahan.
            </p>
          ) : (
            carts.map((cart) => (
              <div key={cart.id} className="p-3 border border-white/10 bg-white/[0.04] rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stone-100">
                      {cart.customer?.name || "Customer Umum"}
                    </p>
                    <p className="text-xs text-stone-400">
                      {format(new Date(cart.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                      {" • "}
                      {cart.items.length} item
                    </p>
                    <p className="text-sm text-stone-400 mt-1">
                      {cart.items
                        .slice(0, 3)
                        .map((i) => `${i.productName} x${i.quantity}`)
                        .join(", ")}
                      {cart.items.length > 3 ? ` +${cart.items.length - 3} lagi` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-stone-100 whitespace-nowrap">
                    {formatCurrency(parkedCartTotal(cart))}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onResume(cart)}
                    className="flex-1 px-3 py-2 bg-[#16A34A] text-white rounded-lg hover:bg-[#15803D] flex items-center justify-center gap-1 text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Lanjutkan
                  </button>
                  <button
                    onClick={() => onDelete(cart.id)}
                    className="px-3 py-2 border border-[rgba(229,72,77,0.3)] text-[#E5484D] rounded-lg hover:bg-[rgba(229,72,77,0.08)] flex items-center justify-center gap-1 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
