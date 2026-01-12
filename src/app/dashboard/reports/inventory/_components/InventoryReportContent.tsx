import ReportHeader from "../../_components/ReportHeader";
import { formatCurrency } from "@/lib/utils/pdf-helpers";

interface ProductData {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minStock: number;
  category: { name: string };
  subCategory: { name: string } | null;
  supplier: { name: string };
  productUnits: Array<{
    buyPrice: number;
    sellPrice: number;
    unit: { name: string };
  }>;
}

interface InventorySummary {
  totalProducts: number;
  totalStockValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  categoriesBreakdown: Record<string, number>;
}

interface InventoryReportContentProps {
  data: {
    products: ProductData[];
    summary: InventorySummary;
  };
}

export default function InventoryReportContent({ data }: InventoryReportContentProps) {
  const { products, summary } = data;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Laporan Stok Inventory" />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Total Produk</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalProducts}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Nilai Stok</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalStockValue)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <p className="text-sm text-gray-600 mb-1">Stok Menipis</p>
          <p className="text-2xl font-bold text-orange-600">{summary.lowStockProducts}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600 mb-1">Stok Habis</p>
          <p className="text-2xl font-bold text-red-600">{summary.outOfStockProducts}</p>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Breakdown Kategori</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(summary.categoriesBreakdown).map(([category, count]) => (
            <div key={category} className="bg-gray-50 p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600">{category}</p>
              <p className="text-lg font-bold text-gray-900">{count} produk</p>
            </div>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Detail Stok Produk</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Kode</th>
              <th className="px-3 py-2 text-left font-semibold">Nama Produk</th>
              <th className="px-3 py-2 text-left font-semibold">Kategori</th>
              <th className="px-3 py-2 text-left font-semibold">Supplier</th>
              <th className="px-3 py-2 text-center font-semibold">Stok</th>
              <th className="px-3 py-2 text-center font-semibold">Min</th>
              <th className="px-3 py-2 text-right font-semibold">Harga Beli</th>
              <th className="px-3 py-2 text-right font-semibold">Harga Jual</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const primaryUnit = product.productUnits[0];
              const stockStatus = 
                product.currentStock === 0 ? 'Habis' : 
                product.currentStock <= product.minStock ? 'Menipis' : 'Aman';
              const statusColor = 
                product.currentStock === 0 ? 'bg-red-100 text-red-700' : 
                product.currentStock <= product.minStock ? 'bg-orange-100 text-orange-700' : 
                'bg-green-100 text-green-700';

              return (
                <tr key={product.id} className="border-b border-gray-200">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{product.code}</td>
                  <td className="px-3 py-2">{product.name}</td>
                  <td className="px-3 py-2 text-xs">{product.category.name}</td>
                  <td className="px-3 py-2 text-xs">{product.supplier.name}</td>
                  <td className="px-3 py-2 text-center font-semibold">{product.currentStock}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{product.minStock}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(Number(primaryUnit?.buyPrice || 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(Number(primaryUnit?.sellPrice || 0))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>
                      {stockStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}