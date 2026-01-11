import { CustomerDebtClient } from "./_components/CustomerDebtClient";

export const metadata = {
  title: "Piutang Customer | TB Masdar Utama",
  description: "Kelola piutang customer",
};

export default function CustomerDebtsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Piutang Customer</h1>
        <p className="text-gray-600 mt-2">
          Kelola dan monitor piutang pelanggan
        </p>
      </div>

      <CustomerDebtClient />
    </div>
  );
}