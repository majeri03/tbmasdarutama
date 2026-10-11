/**
 * Re-export Prisma client sebagai `db` untuk konsistensi import
 * di seluruh file API (terutama mobile API).
 * Gunakan `import { db } from "@/lib/db"` di mana saja.
 */
import prisma from "./prisma";

export const db = prisma;
export default prisma;
