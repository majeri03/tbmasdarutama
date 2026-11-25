import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import type { ReportStoreInfo } from "../../_components/report-types";
import { formatCurrency } from "@/lib/utils/pdf-helpers";

interface ProductData {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minStock: number;
  // Kategori wajib di schema, supplier OPSIONAL (supplierId nullable) —
  // keduanya ditype-kan nullable supaya satu produk tanpa supplier tidak
  // menjatuhkan seluruh laporan (item 141).
  category: { name: string } | null;
  subCategory: { name: string } | null;
  supplier: { name: string } | null;
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
    store?: ReportStoreInfo | null;
  };
}

export default function InventoryReportContent({ data }: InventoryReportContentProps) {
  const { products, summary, store } = data;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm] text-[#111111]">
      <ReportHeader
        title="Laporan Stok Inventory"
        storeName={store?.name}
        storeAddress={store?.address}
        storePhone={store?.phone}
      />

      <ReportSummary
        title="Ringkasan"
        items={[
          { label: "Total Produk", value: String(summary.totalProducts) },
          { label: "Nilai Stok", value: formatCurrency(summary.totalStockValue) },
          { label: "Stok Menipis", value: String(summary.lowStockProducts) },
          { label: "Stok Habis", value: String(summary.outOfStockProducts) },
        ]}
      />

      <ReportSummary
        title="Kategori"
        items={Object.entries(summary.categoriesBreakdown).map(([category, count]) => ({
          label: category,
          value: `${count} produk`,
        }))}
      />

      {/* Products Table */}
      <div className="overflow-x-auto">
        <ReportSectionTitle>Detail Stok Produk</ReportSectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#111111]">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Kode</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Nama Produk</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Kategori</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Supplier</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Stok</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Min</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Harga Beli</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Harga Jual</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const primaryUnit = product.productUnits[0];
              const stockStatus =
                product.currentStock === 0 ? 'Habis' :
                product.currentStock <= product.minStock ? 'Menipis' : 'Aman';

              return (
                <tr key={product.id} className="border-b border-gray-200 even:bg-[#FAFAFA]">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{product.code}</td>
                  <td className="px-3 py-2">{product.name}</td>
                  <td className="px-3 py-2 text-xs">{product.category?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{product.supplier?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{product.currentStock}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[#6B7280]">{product.minStock}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(Number(primaryUnit?.buyPrice || 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(Number(primaryUnit?.sellPrice || 0))}
                  </td>
                  <td className="px-3 py-2 text-center">{stockStatus}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ReportFooter storeName={store?.name ?? undefined} />
    </div>
  );
}
