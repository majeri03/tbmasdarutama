import ReportHeader from "../../_components/ReportHeader";
import { formatCurrency } from "@/lib/utils/pdf-helpers";
import Image from "next/image";

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
  category: { name: string };
  subCategory: { name: string } | null;
  supplier: { name: string };
  productUnits: ProductUnit[];
  productImages: Array<{ imageUrl: string }>;
}

interface ProductsReportContentProps {
  data: {
    products: ProductData[];
  };
}

export default function ProductsReportContent({ data }: ProductsReportContentProps) {
  const { products } = data;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Daftar Produk" />

      {/* Summary */}
      <div className="mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
        <p className="text-lg">
          <span className="font-semibold">Total Produk:</span> 
          <span className="text-2xl font-bold text-blue-600 ml-3">{products.length}</span>
        </p>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => {
          const primaryUnit = product.productUnits[0];
          const imageUrl = product.productImages[0]?.imageUrl || '/placeholder-product.png';

          return (
            <div key={product.id} className="border-2 border-gray-200 rounded-lg p-4 break-inside-avoid">
              <div className="flex gap-4">
                {/* Product Image */}
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                  <Image 
                    src={imageUrl} 
                    alt={product.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{product.name}</h3>
                    <span className="text-xs font-mono text-gray-500 ml-2">{product.code}</span>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      <span className="font-semibold">Kategori:</span> {product.category.name}
                      {product.subCategory && ` / ${product.subCategory.name}`}
                    </p>
                    <p><span className="font-semibold">Supplier:</span> {product.supplier.name}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        product.currentStock === 0 ? 'bg-red-100 text-red-700' :
                        product.currentStock <= product.minStock ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        Stok: {product.currentStock}
                      </span>
                      <span className="text-gray-500">Min: {product.minStock}</span>
                    </div>

                    {primaryUnit && (
                      <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Harga Beli</p>
                          <p className="font-bold text-gray-900">{formatCurrency(Number(primaryUnit.buyPrice))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Harga Jual</p>
                          <p className="font-bold text-blue-600">{formatCurrency(Number(primaryUnit.sellPrice))}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {product.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Tidak ada produk yang ditemukan
        </div>
      )}
    </div>
  );
}