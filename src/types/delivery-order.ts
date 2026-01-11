import { DeliveryStatus } from "@prisma/client";

export interface DeliveryOrderData {
  id: string;
  doNumber: string;
  customerId: string;
  saleId: string | null;
  deliveryDate: Date;
  driver: string | null;
  vehicle: string | null;
  notes: string | null;
  status: DeliveryStatus;
  receivedBy: string | null;
  receivedDate: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  createdBy: {
    id: string;
    name: string;
  };
  deliveryItems: DeliveryItemData[];
  sale?: {
    id: string;
    invoiceNumber: string;
  } | null;
}

export interface DeliveryItemData {
  id: string;
  deliveryOrderId: string;
  productId: string;
  unitId: string;
  quantity: number;
  notes: string | null;
  product: {
    id: string;
    name: string;
    code: string;
  };
  unit: {
    id: string;
    name: string;
    symbol: string | null;
  };
}

export interface CreateDeliveryOrderInput {
  customerId: string;
  saleId?: string;
  deliveryDate: Date;
  driver?: string;
  vehicle?: string;
  notes?: string;
  items: {
    productId: string;
    unitId: string;
    quantity: number;
    notes?: string;
  }[];
}

export interface UpdateDeliveryStatusInput {
  id: string;
  status: DeliveryStatus;
  receivedBy?: string;
  receivedDate?: Date;
}