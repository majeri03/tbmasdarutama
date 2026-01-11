import { PaymentMethod, DebtStatus } from "@prisma/client";

export interface CustomerDebtData {
  id: string;
  debtNumber: string;
  saleId: string;
  customerId: string;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  dueDate: Date;
  status: DebtStatus;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
  };
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: Date;
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
  createdBy: string;
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
  notes?: string;
}