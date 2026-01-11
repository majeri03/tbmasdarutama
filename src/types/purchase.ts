import { Product, Unit, PurchaseStatus, PaymentMethod } from "@prisma/client";

export interface PurchaseProduct extends Product {
  purchasePrice: number;
  units: {
    unit: Unit;
    conversionValue: number;
    isPrimary: boolean;
  }[];
}

export interface PurchaseItem {
  id?: string;
  productId: string;
  product?: {
    id: string;
    code: string;
    name: string;
  };
  unitId: string;
  unit?: {
    id: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface PurchaseData {
  id: string;
  poNumber: string;
  purchaseDate: Date;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  status: PurchaseStatus;
  receivedDate: Date | null;
  supplier: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  admin: {
    id: string;
    name: string;
    email: string;
  };
  purchaseItems: PurchaseItem[];
  _count?: {
    purchaseItems: number;
  };
}