import { Role } from "@prisma/client";
import { Session } from "next-auth";

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  KASIR: 1,
};

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_FULL_STATS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // POS
  ACCESS_POS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  
  // Sales
  // KEPUTUSAN PEMILIK (22 Nov 2026, pentest H6 — BY-DESIGN): KASIR BOLEH
  // membaca semua penjualan/invoice/DO/piutang toko (tanpa filter
  // cashierId = dirinya sendiri) karena kasir butuh data itu untuk
  // bertransaksi dan mengerjakan DO. Akses baca ini BY-DESIGN, bukan
  // kebocoran — jangan "diperbaiki" dengan membatasi ke miliknya sendiri.
  VIEW_SALES: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_SALE: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  // FIX (22 Nov 2026): edit penjualan sebelumnya memakai CREATE_SALE, jadi
  // KASIR mana pun bisa mengedit transaksi apa pun. Sekarang izin sendiri,
  // ADMIN+ saja (pola yang sama seperti EDIT_PRODUCT / EDIT_PURCHASE).
  EDIT_SALE: ["SUPER_ADMIN", "ADMIN"] as Role[],
  CANCEL_SALE: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_SALE: ["SUPER_ADMIN"] as Role[],

  // Products
  VIEW_PRODUCTS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_PRODUCT: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_PRODUCT: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_PRODUCT: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Purchases
  VIEW_PURCHASES: ["SUPER_ADMIN", "ADMIN"] as Role[],
  CREATE_PURCHASE: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_PURCHASE: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_PURCHASE: ["SUPER_ADMIN", "ADMIN"] as Role[],
  RECEIVE_PURCHASE: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Stock
  VIEW_STOCK: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  ADJUST_STOCK: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_STOCK_MOVEMENT: ["SUPER_ADMIN"] as Role[],

  // Customers
  // BY-DESIGN (22 Nov 2026, pentest M27): KASIR BOLEH membaca profil +
  // riwayat keuangan customer (utang/cicilan) karena kasir butuh info
  // piutang untuk menerima pembayaran. Bukan kebocoran.
  VIEW_CUSTOMERS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_CUSTOMER: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  EDIT_CUSTOMER: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  DELETE_CUSTOMER: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Suppliers
  VIEW_SUPPLIERS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Debts
  // BY-DESIGN (22 Nov 2026, pentest H6): KASIR BOLEH membaca semua piutang
  // customer — kasir butuh data itu untuk menerima pembayaran cicilan.
  VIEW_CUSTOMER_DEBTS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  MANAGE_CUSTOMER_DEBTS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  VIEW_SUPPLIER_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  MANAGE_SUPPLIER_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Delivery Orders
  // BY-DESIGN (22 Nov 2026, pentest H6): KASIR BOLEH membaca semua Surat
  // Jalan toko — kasir ikut mengerjakan DO. Bukan kebocoran.
  VIEW_DELIVERY_ORDERS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_DELIVERY_ORDER: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  // FIX PENTEST (22 Nov 2026, H5): KASIR hanya boleh mengubah status ke
  // IN_TRANSIT. CANCELLED (menghapus hutang auto-DO) dan DELIVERED
  // (memotong stok) khusus ADMIN+ lewat izin di bawah ini.
  UPDATE_DELIVERY_STATUS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CANCEL_DELIVERY_ORDER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  CONFIRM_DELIVERY_ORDER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_DELIVERY_ORDER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_DELIVERY_ORDER: ["SUPER_ADMIN"] as Role[],

  // Categories & Units
  VIEW_CATEGORIES: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  MANAGE_CATEGORIES: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_UNITS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  MANAGE_UNITS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Reports
  VIEW_REPORTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EXPORT_REPORTS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Settings
  VIEW_SETTINGS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  // FIX PENTEST (22 Nov 2026, M11): dulu ADMIN juga boleh — padahal komentar
  // route menyebut SUPER_ADMIN only, dan pengaturan berisi rekening bank /
  // NPWP. Sekarang SUPER_ADMIN saja.
  MANAGE_STORE_SETTINGS: ["SUPER_ADMIN"] as Role[],
  MANAGE_LANDING_PAGE: ["SUPER_ADMIN"] as Role[],
  MANAGE_USERS: ["SUPER_ADMIN"] as Role[],


  // Salesman & poin loyalitas (24 Nov 2026, pisah dari tab "Sales & Poin"
  // di Pengaturan ke halaman /dashboard/salesmen dan /dashboard/points).
  // Baca: KASIR+ (kasir butuh daftar salesman di POS + saldo poin).
  // Tulis tetap SUPER_ADMIN saja — dicek di server actions / API routes,
  // izin ini hanya mengatur tampilnya menu di sidebar.
  VIEW_SALESMEN: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  VIEW_POINTS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],

  // View menu
  VIEW_MENU_PRODUCTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_MENU_STOCK: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_MENU_SALES: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_MENU_SETTINGS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_MENU_DASHBOARD: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_MENU_CUSTOMERS_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;


export interface AuthSession {
  user?: {
    // FIX BUILD (22 Nov 2026, susulan pentest): id WAJIB string, bukan
    // opsional. Setiap sesi terautentikasi selalu membawa id:
    // getAuthenticatedUser() hanya mengembalikan sesi kalau
    // session.user.id ada (web) atau payload token mobile ada id-nya.
    // Sebelumnya id?: string membuat SEMUA pemakaian session.user.id
    // (adminId / createdById / cashierId / userId di ~20 tempat di
    // sale, purchase, delivery-order, debt, product, stock) gagal
    // compile dengan "string | undefined is not assignable to string"
    // sejak M18 (externalSession) memperkenalkan tipe ini.
    id: string;
    email?: string;
    name?: string;
    role?: string;
  };
  data?: {
    user?: {
      role?: string;
    };
  };
}

/**
 * Check if user has specific role
 */
export function hasRole(session: AuthSession | null | undefined, role: Role): boolean {
  if (!session) return false;
  const userRole = (session.user?.role || session.data?.user?.role as string || "").toUpperCase();
  return userRole === (role as string).toUpperCase();
}

export function hasMinimumRole(session: AuthSession | null | undefined, minimumRole: Role): boolean {
  if (!session) return false;
  const userRole = (session.user?.role || session.data?.user?.role as string || "").toUpperCase() as Role;
  const targetRole = (minimumRole as string).toUpperCase() as Role;
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[targetRole] || 0);
}

export function hasPermission(session: AuthSession | null | undefined, permission: Permission): boolean {
  if (!session) return false;
  const userRole = (session.user?.role || session.data?.user?.role as string || "").toUpperCase() as Role;
  const allowedRoles = PERMISSIONS[permission] as readonly Role[];
  return allowedRoles.includes(userRole);
}

export function getUserRole(session: AuthSession | null | undefined): Role | null {
  if (!session) return null;
  const userRole = (session.user?.role || session.data?.user?.role as string || "").toUpperCase();
  return userRole ? (userRole as Role) : null;
}

/**
 * Check if user is Super Admin
 */
export function isSuperAdmin(session: Session | AuthSession | null | undefined): boolean {
  return hasRole(session, "SUPER_ADMIN");
}

/**
 * Check if user is Admin or higher
 */
export function isAdmin(session: Session | AuthSession | null | undefined): boolean {
  return hasMinimumRole(session, "ADMIN");
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(session: Session | AuthSession | null | undefined): boolean {
  return !!session?.user;
}

/**
 * Require specific role (throw error if not authorized)
 */
export function requireRole(session: Session | AuthSession | null | undefined, role: Role): void {
  if (!hasRole(session, role)) {
    throw new Error(`Unauthorized. Required role: ${role}`);
  }
}

/**
 * Require minimum role (throw error if not authorized)
 */
export function requireMinimumRole(session: Session | AuthSession | null | undefined, minimumRole: Role): void {
  if (!hasMinimumRole(session, minimumRole)) {
    throw new Error(`Unauthorized. Minimum required role: ${minimumRole}`);
  }
}

/**
 * Require specific permission (throw error if not authorized)
 */
export function requirePermission(session: Session | AuthSession | null | undefined, permission: Permission): void {
  if (!hasPermission(session, permission)) {
    throw new Error(`Unauthorized. Required permission: ${permission}`);
  }
}

/**
 * Require authentication (throw error if not logged in)
 */
export function requireAuth(session: Session | AuthSession | null | undefined): void {
  if (!isAuthenticated(session)) {
    throw new Error("Unauthorized. Please login.");
  }
}