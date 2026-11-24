"use client";

import PageGuard from "@/components/PageGuard";
import SalesmenManager from "./_components/SalesmenManager";

export default function SalesmenPage() {
  return (
    <PageGuard pageKey="salesmen">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salesman</h1>
          <p className="page-subtitle">
            Kelola salesman toko — dipilih per transaksi di POS, tidak pernah dicetak di invoice
          </p>
        </div>
        <div className="glass-card p-6">
          <SalesmenManager />
        </div>
      </div>
    </PageGuard>
  );
}
