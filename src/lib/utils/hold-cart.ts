// Hold cart (tahan keranjang) POS — client-side saja di localStorage,
// tanpa perubahan skema database. Satu keranjang yang ditahan menyimpan
// item, customer, dan diskon apa adanya.

import type { CartItem, POSCustomer } from "@/types/pos";

export interface ParkedCart {
  id: string;
  createdAt: string; // ISO
  items: CartItem[];
  customer: POSCustomer | null;
  discount: number;
}

const STORAGE_KEY = "masdar-parked-carts";

export function loadParkedCarts(): ParkedCart[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParkedCart[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveParkedCarts(carts: ParkedCart[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
  } catch {
    // localStorage penuh / tidak tersedia — keranjang tetap di memori halaman
  }
}

export function parkCart(
  items: CartItem[],
  customer: POSCustomer | null,
  discount: number
): ParkedCart {
  const cart: ParkedCart = {
    id: `parked-${Date.now()}`,
    createdAt: new Date().toISOString(),
    items,
    customer,
    discount,
  };
  saveParkedCarts([cart, ...loadParkedCarts()]);
  return cart;
}

export function removeParkedCart(id: string): ParkedCart[] {
  const next = loadParkedCarts().filter((c) => c.id !== id);
  saveParkedCarts(next);
  return next;
}

export function parkedCartTotal(cart: ParkedCart): number {
  return cart.items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);
}
