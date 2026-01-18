import { Role } from "@prisma/client";
import { Session } from "next-auth";

// ==================== ROLE HIERARCHY ====================
export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  KASIR: 1,
};

// ==================== PERMISSION MAPPING ====================
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_FULL_STATS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // POS
  ACCESS_POS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  
  // Sales
  VIEW_SALES: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_SALE: ["SUPER_ADMIN", "ADMIN"] as Role[],
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
  VIEW_CUSTOMERS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  CREATE_CUSTOMER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_CUSTOMER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_CUSTOMER: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Suppliers
  VIEW_SUPPLIERS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  CREATE_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EDIT_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_SUPPLIER: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Debts
  VIEW_CUSTOMER_DEBTS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  MANAGE_CUSTOMER_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_SUPPLIER_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  MANAGE_SUPPLIER_DEBTS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Delivery Orders
  VIEW_DELIVERY_ORDERS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  CREATE_DELIVERY_ORDER: ["SUPER_ADMIN", "ADMIN"] as Role[],
  UPDATE_DELIVERY_STATUS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  DELETE_DELIVERY_ORDER: ["SUPER_ADMIN"] as Role[],

  // Categories & Units
  VIEW_CATEGORIES: ["SUPER_ADMIN", "ADMIN"] as Role[],
  MANAGE_CATEGORIES: ["SUPER_ADMIN", "ADMIN"] as Role[],
  VIEW_UNITS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  MANAGE_UNITS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Reports
  VIEW_REPORTS: ["SUPER_ADMIN", "ADMIN"] as Role[],
  EXPORT_REPORTS: ["SUPER_ADMIN", "ADMIN"] as Role[],

  // Settings
  VIEW_SETTINGS: ["SUPER_ADMIN", "ADMIN", "KASIR"] as Role[],
  MANAGE_STORE_SETTINGS: ["SUPER_ADMIN"] as Role[],
  MANAGE_LANDING_PAGE: ["SUPER_ADMIN"] as Role[],
  MANAGE_USERS: ["SUPER_ADMIN"] as Role[],

} as const;

export type Permission = keyof typeof PERMISSIONS;

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user has specific role
 */
export function hasRole(session: Session | null, role: Role): boolean {
  if (!session?.user?.role) return false;
  return session.user.role === role;
}

/**
 * Check if user has role with minimum level
 */
export function hasMinimumRole(session: Session | null, minimumRole: Role): boolean {
  if (!session?.user?.role) return false;
  const userRole = session.user.role as Role;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(session: Session | null, permission: Permission): boolean {
  if (!session?.user?.role) return false;
  const userRole = session.user.role as Role;
  return PERMISSIONS[permission].includes(userRole);
}

/**
 * Get user role or null
 */
export function getUserRole(session: Session | null): Role | null {
  if (!session?.user?.role) return null;
  return session.user.role as Role;
}

/**
 * Check if user is Super Admin
 */
export function isSuperAdmin(session: Session | null): boolean {
  return hasRole(session, "SUPER_ADMIN");
}

/**
 * Check if user is Admin or higher
 */
export function isAdmin(session: Session | null): boolean {
  return hasMinimumRole(session, "ADMIN");
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(session: Session | null): boolean {
  return !!session?.user;
}

/**
 * Require specific role (throw error if not authorized)
 */
export function requireRole(session: Session | null, role: Role): void {
  if (!hasRole(session, role)) {
    throw new Error(`Unauthorized. Required role: ${role}`);
  }
}

/**
 * Require minimum role (throw error if not authorized)
 */
export function requireMinimumRole(session: Session | null, minimumRole: Role): void {
  if (!hasMinimumRole(session, minimumRole)) {
    throw new Error(`Unauthorized. Minimum required role: ${minimumRole}`);
  }
}

/**
 * Require specific permission (throw error if not authorized)
 */
export function requirePermission(session: Session | null, permission: Permission): void {
  if (!hasPermission(session, permission)) {
    throw new Error(`Unauthorized. Required permission: ${permission}`);
  }
}

/**
 * Require authentication (throw error if not logged in)
 */
export function requireAuth(session: Session | null): void {
  if (!isAuthenticated(session)) {
    throw new Error("Unauthorized. Please login.");
  }
}