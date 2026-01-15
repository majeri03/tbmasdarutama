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

// Cart item structure
export interface CartItem {
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