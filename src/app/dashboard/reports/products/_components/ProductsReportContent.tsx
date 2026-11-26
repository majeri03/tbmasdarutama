import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import type { ReportStoreInfo } from "../../_components/report-types";
import { formatCurrency } from "@/lib/utils/pdf-helpers";

interface ProductUnit {
  buyPrice: number;
  sellPrice: number;
  unit: { name: string };
}

interface ProductData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currentStock: number;
  minStock: number;
  // Kategori wajib di schema, supplier OPSIONAL (supplierId nullable) —
  // keduanya ditype-kan nullable supaya satu produk tanpa supplier tidak
  // menjatuhkan seluruh katalog (item 144).
  category: { name: string } | null;
  subCategory: { name: string } | null;
  supplier: { name: string } | null;
  productUnits: ProductUnit[];
  productImages: Array<{ imageUrl: string }>;
}

interface ProductsReportContentProps {
  data: {
    products: ProductData[];
    store?: ReportStoreInfo | null;
  };
}

export default function ProductsReportContent({ data }: ProductsReportContentProps) {
  const { products, store } = data;

  return (
    <div id="print-content" className="bg-[#1C1917] print:bg-white p-8 min-h-[297mm] text-stone-100 print:text-stone-100 print:text-[#111111]">
      <ReportHeader
        title="Daftar Produk"
        storeName={store?.name}
        storeAddress={store?.address}
        storePhone={store?.phone}
      />

      <ReportSummary
        title="Ringkasan"
        items={[{ label: "Total Produk", value: String(products.length) }]}
      />

      {/* Products Grid */}
      <ReportSectionTitle>Produk</ReportSectionTitle>
      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => {
          const primaryUnit = product.productUnits[0];
          const imageUrl = product.productImages[0]?.imageUrl || null;

          return (
            <div key={product.id} className="border border-white/10 print:border-gray-200 bg-white/[0.04] print:bg-white rounded-lg p-4 break-inside-avoid">
              <div className="flex gap-4">
                {/* Product Image — <img> biasa, BUKAN next/image (item 144):
                    next/image menolak URL remote yang host-nya tidak ada di
                    next.config images.remotePatterns; foto produk tersimpan
                    di R2 (host tidak terdaftar) sehingga render katalog
                    melempar error dan halaman crash ("client-side
                    exception"). <img> tidak butuh konfigurasi host. Kalau
                    URL rusak, gambar disembunyikan (onError), bukan crash.
                    File fallback lama '/placeholder-product.png' tidak ada
                    di public/, jadi produk tanpa foto menampilkan kotak
                    "Tanpa Gambar", bukan gambar rusak. */}
                <div className="w-20 h-20 bg-white/[0.06] print:bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-stone-400 print:text-[#6B7280] text-center px-1">Tanpa Gambar</span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-stone-100 print:text-[#111111] text-sm leading-tight">{product.name}</h3>
                    <span className="text-xs font-mono text-stone-400 print:text-[#6B7280] ml-2">{product.code}</span>
                  </div>

                  <div className="text-xs text-stone-400 print:text-[#6B7280] space-y-1">
                    <p>
                      <span className="font-semibold text-stone-100 print:text-[#111111]">Kategori:</span> {product.category?.name ?? "—"}
                      {product.subCategory && ` / ${product.subCategory.name}`}
                    </p>
                    <p><span className="font-semibold text-stone-100 print:text-[#111111]">Supplier:</span> {product.supplier?.name ?? "—"}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-stone-100 print:text-[#111111]">
                        Stok: {product.currentStock}
                      </span>
                      <span className="text-stone-400 print:text-[#6B7280]">Min: {product.minStock}</span>
                    </div>

                    {primaryUnit && (
                      <div className="mt-2 pt-2 border-t border-white/10 print:border-gray-200 flex justify-between">
                        <div>
                          <p className="text-xs text-stone-400 print:text-[#6B7280]">Harga Beli</p>
                          <p className="font-bold text-stone-100 print:text-[#111111]">{formatCurrency(Number(primaryUnit.buyPrice))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-stone-400 print:text-[#6B7280]">Harga Jual</p>
                          <p className="font-bold text-stone-100 print:text-[#111111]">{formatCurrency(Number(primaryUnit.sellPrice))}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {product.description && (
                <p className="text-xs text-stone-400 print:text-[#6B7280] mt-2 line-clamp-2">{product.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12 text-stone-400 print:text-[#6B7280]">
          Tidak ada produk yang ditemukan
        </div>
      )}

      <ReportFooter storeName={store?.name ?? undefined} />
    </div>
  );
}
