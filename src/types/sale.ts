import { Sale, SaleItem, Customer, User, PaymentMethod, SaleStatus } from "@prisma/client";

export interface SaleWithRelations extends Sale {
  customer: Pick<Customer, "id" | "code" | "name" | "type" | "phone" | "address"> | null;
  cashier: Pick<User, "id" | "name" | "email">;
  saleItems: (SaleItem & {
    product: {
      id: string;
      code: string;
      name: string;
    };
    unit: {
      id: string;
      name: string;
      symbol: string | null;
    };
  })[];
}

export interface SaleData {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  cashierId: string;
  saleDate: Date;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  changeAmount: number;
  notes: string | null;
  status: SaleStatus;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    code: string;
    name: string;
    type: string;
    phone: string | null;
    address: string | null;
  } | null;
  cashier: {
    id: string;
    name: string;
    email: string;
  };
  saleItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    product: {
      id: string;
      code: string;
      name: string;
    };
    unit: {
      id: string;
      name: string;
      symbol: string | null;
    };
  }[];
}

export interface SaleFilters {
  search?: string;
  customerId?: string;
  cashierId?: string;
  paymentMethod?: PaymentMethod;
  status?: SaleStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface SaleStats {
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  pendingSales: number;
}