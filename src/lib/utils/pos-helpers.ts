import { CartItem, CartCalculation, POSCustomer } from "@/types/pos";
import { CustomerType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Get customer discount based on type
export function getCustomerDiscount(customerType: CustomerType): number {
  switch (customerType) {
    case "GROSIR":
      return 5; // 5%
    case "PROYEK":
      return 10; // 10%
      case "REGULER": // ✅ FIXED: REGULER bukan REGULAR
      return 0;
    default:
      return 0; // Regular = no discount
  }
}
export function isDefaultCustomer(customerCode: string): boolean {
  return customerCode === "CUST-00001"; 
}

// ✅ Convert Prisma Decimal to number
export function decimalToNumber(decimal: number | Decimal): number {
  if (typeof decimal === "number") {
    return decimal;
  }
  return parseFloat(decimal.toString());
}
// Calculate cart totals
export function calculateCart(
  items: CartItem[],
  customer: POSCustomer | null,
  additionalDiscount: number = 0
): CartCalculation {
  // 1. Calculate subtotal (sum of all item subtotals)
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // 2. Calculate total item discount
  const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0);

  // 3. Calculate customer discount (percentage based)
  const customerDiscountPercent = customer ? getCustomerDiscount(customer.type) : 0;
  const customerDiscount = (subtotal - itemDiscount) * (customerDiscountPercent / 100);

  // 4. Total discount (item + additional + customer)
  const totalDiscount = itemDiscount + additionalDiscount + customerDiscount;

  // 5. Tax (currently 0, prepared for future)
  const tax = 0;

  // 6. Grand total
  const grandTotal = subtotal - totalDiscount + tax;

  return {
    subtotal,
    itemDiscount,
    totalDiscount,
    customerDiscount,
    tax,
    grandTotal: Math.max(0, grandTotal), // Prevent negative
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
  // Check existing quantity in cart
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

// Generate barcode search query
// Generate barcode search query
export function generateSearchQuery(input: string): {
  barcode?: string;
  code?: string;
  name?: string;
} {
  const trimmedInput = input.trim();
  
  // ✅ If starts with "PRD-" or "BAR-", it's a code/barcode
  if (/^(PRD-|BAR-)/i.test(trimmedInput)) {
    return { 
      barcode: trimmedInput, 
      code: trimmedInput 
    };
  }
  
  // ✅ If all uppercase/numbers/dash, could be code or barcode
  if (/^[A-Z0-9-]+$/.test(trimmedInput)) {
    return { 
      barcode: trimmedInput, 
      code: trimmedInput,
      name: trimmedInput // Also search in name
    };
  }
  
  // ✅ Otherwise, it's a product name
  return { name: trimmedInput };
}