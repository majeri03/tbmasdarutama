import { CartItem, CartCalculation, POSCustomer } from "@/types/pos";
import { CustomerType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Get customer discount based on type
export function getCustomerDiscount(customerType: CustomerType): number {
  switch (customerType) {
    case "GROSIR":
      return 5;
    case "PROYEK":
      return 10;
      case "REGULER":
      return 0;
    default:
      return 0;
  }
}
export function isDefaultCustomer(customerCode: string): boolean {
  return customerCode === "CUST-00001"; 
}

// Convert Prisma Decimal to number
export function decimalToNumber(decimal: number | Decimal): number {
  if (typeof decimal === "number") {
    return decimal;
  }
  return parseFloat(decimal.toString());
}
export function calculateCart(
  items: CartItem[],
  customer: POSCustomer | null,
  additionalDiscount: number = 0
): CartCalculation {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const customerDiscountPercent = customer ? getCustomerDiscount(customer.type) : 0;
  const customerDiscount = (subtotal - itemDiscount) * (customerDiscountPercent / 100);
  const totalDiscount = itemDiscount + additionalDiscount + customerDiscount;
  const tax = 0;
  const grandTotal = subtotal - totalDiscount + tax;

  return {
    subtotal,
    itemDiscount,
    totalDiscount,
    customerDiscount,
    tax,
    grandTotal: Math.max(0, grandTotal),
  };
}

// Format currency (Rupiah)
export function formatCurrency(amount: number | Decimal): string {
  const numericAmount = typeof amount === "number" ? amount : decimalToNumber(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

// Calculate change
export function calculateChange(paid: number, total: number): number {
  return Math.max(0, paid - total);
}

// Validate stock availability
export function validateStock(
  cartItems: CartItem[],
  productId: string,
  requestedQty: number,
  currentStock: number
): { valid: boolean; message?: string } {
  const existingItem = cartItems.find((item) => item.productId === productId);
  const cartQty = existingItem ? existingItem.quantity : 0;
  const totalNeeded = cartQty + requestedQty;

  if (totalNeeded > currentStock) {
    return {
      valid: false,
      message: `Stock tidak cukup! Tersedia: ${currentStock}, Di keranjang: ${cartQty}, Diminta: ${requestedQty}`,
    };
  }

  return { valid: true };
}


export function generateSearchQuery(input: string): {
  barcode?: string;
  code?: string;
  name?: string;
} {
  const trimmedInput = input.trim();
  
  // If starts with "PRD-" or "BAR-", it's a code/barcode
  if (/^(PRD-|BAR-)/i.test(trimmedInput)) {
    return { 
      barcode: trimmedInput, 
      code: trimmedInput 
    };
  }
  
  // If all uppercase/numbers/dash, could be code or barcode
  if (/^[A-Z0-9-]+$/.test(trimmedInput)) {
    return { 
      barcode: trimmedInput, 
      code: trimmedInput,
      name: trimmedInput
    };
  }
  
  return { name: trimmedInput };
}