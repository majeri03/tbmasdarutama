"use client";

import { hasPermission } from "@/lib/utils/role";
import { Package } from "lucide-react";
import { useSession } from "next-auth/react";

interface ProductUnit {
  id: string;
  conversionValue: number;
  buyPrice: number;
  sellPrice: number;
  isPrimary: boolean;
  unit: {
    id: string;
    name: string;
  };
}

interface ProductUnitDisplayProps {
  units: ProductUnit[];
  variant?: "full" | "compact";
}

export function ProductUnitDisplay({ units, variant = "compact" }: ProductUnitDisplayProps) {
  const { data: session } = useSession();
  
  // Check if user can view purchase price
  const canViewPurchasePrice = hasPermission(session, "EDIT_PRODUCT");
  if (!units || units.length === 0) {
    return (
      <span className="text-sm text-gray-500 italic">Belum ada satuan</span>
    );
  }

  // Sort: primary first
  const sortedUnits = [...units].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  if (variant === "compact") {
    // Show only primary unit for compact view
    const primaryUnit = sortedUnits.find((u) => u.isPrimary) || sortedUnits[0];

    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"
        >
          <Package className="w-3 h-3" />
          {primaryUnit.unit.name}
        </span>
        <div className="text-xs text-gray-600">
          <span className="font-semibold">
            Rp {primaryUnit.sellPrice.toLocaleString("id-ID")}
          </span>
        </div>
        {units.length > 1 && (
          <span className="text-xs text-gray-500">
            +{units.length - 1} satuan
          </span>
        )}
      </div>
    );
  }

  // Full variant - show all units
  return (
    <div className="space-y-2">
      {sortedUnits.map((unit) => (
        <div
          key={unit.id}
          className={`flex items-center justify-between p-2 rounded-lg border ${
            unit.isPrimary
              ? "bg-blue-50 border-blue-200"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900">
                  {unit.unit.name}
                </span>
                {unit.isPrimary && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold">
                    UTAMA
                  </span>
                )}
              </div>
              {!unit.isPrimary && (
                <p className="text-xs text-gray-600">
                  Konversi: 1 = {unit.conversionValue}x satuan utama
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              Rp {unit.sellPrice.toLocaleString("id-ID")}
            </p>
             {canViewPurchasePrice && (
            <div>
            <p className="text-xs text-gray-600">
              Beli: Rp {unit.buyPrice.toLocaleString("id-ID")}
            </p>
            </div>
             )}
          </div>
        </div>
      ))}
    </div>
  );
}