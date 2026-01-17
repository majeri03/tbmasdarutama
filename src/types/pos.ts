import { Product, ProductUnit, Unit, Customer} from "@prisma/client";

// Product with units for POS
export interface POSProduct extends Omit<Product, "productUnits"> {
  productUnits: Array<
    Omit<ProductUnit, "buyPrice" | "sellPrice"> & {
      buyPrice: number;
      sellPrice: number;
      unit: Unit;
    }
  >;
  productImages: { imageUrl: string; isPrimary: boolean }[];
  category?: { name: string };
}
export interface ProductUnitData {
  id: string;      // ID dari tabel ProductUnit
  unitId: string;  // ID dari tabel Unit (Master Data)
  unitName: string; // Nama satuan (Pcs, Box, Pack)
  conversionFactor: number;
  price: number;   // Harga khusus untuk satuan ini
  isBase: boolean;
}

// Cart item structure
export interface CartItem {
  id: string; // Unique identifier for the cart item units
  productId: string;
  productCode: string;
  productName: string;
  productUnitId: string;
  unitId: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;

  originalPrice: number;
  // -- TAMBAHAN UNTUK MULTI-UNIT --
  availableUnits: ProductUnitData[];
}
// Cart state
export interface CartState {
  items: CartItem[];
  selectedCustomerId: string;
  discount: number;
  notes: string;
}

// Calculation result
export interface CartCalculation {
  subtotal: number;
  itemDiscount: number;
  totalDiscount: number;
  customerDiscount: number;
  tax: number;
  grandTotal: number;
}

// Customer with type
export interface POSCustomer extends Customer {
  discountPercent: number;
}