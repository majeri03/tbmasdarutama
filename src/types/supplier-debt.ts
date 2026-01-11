import { PaymentMethod, DebtStatus } from "@prisma/client";

export interface SupplierDebtData {
  id: string;
  debtNumber: string;
  purchaseId: string;
  supplierId: string;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  dueDate: Date;
  status: DebtStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
  };
  purchase: {
    id: string;
    poNumber: string;
    purchaseDate: Date;
    grandTotal: number;
  };
  payments: DebtPaymentData[];
  _count?: {
    payments: number;
  };
}

export interface DebtPaymentData {
  id: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
  adminId: string;
  admin?: {
    id: string;
    name: string;
  };
}

export interface AddPaymentInput {
  debtId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string | null;
}