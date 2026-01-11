import { SupplierDebtClient } from "./_component/SupplierDebtClient";

export const metadata = {
  title: "Utang Supplier | TB Masdar Utama",
  description: "Kelola utang supplier",
};

export default function SupplierDebtsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Utang Supplier</h1>
        <p className="text-gray-600 mt-2">
          Kelola dan monitor utang ke supplier
        </p>
      </div>

      <SupplierDebtClient />
    </div>
  );
}