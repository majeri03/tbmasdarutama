"use client";

import PageGuard from "@/components/PageGuard";
import PointsManager from "./_components/PointsManager";

export default function PointsPage() {
  return (
    <PageGuard pageKey="points">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Poin Loyalitas</h1>
          <p className="page-subtitle">
            Pengaturan poin, saldo poin customer, dan penyesuaian manual poin
          </p>
        </div>
        <div className="glass-card p-6">
          <PointsManager />
        </div>
      </div>
    </PageGuard>
  );
}
