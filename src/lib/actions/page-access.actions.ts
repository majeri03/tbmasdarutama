"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { PAGE_KEYS } from "@/lib/constants/page-access";

/**
 * Initializes the default PageAccess matrix if it doesn't exist.
 */
export async function initializePageAccess() {
  try {
    const count = await prisma.pageAccess.count();
    if (count > 0) return;

    // Seed defaults: all 5 pages = disabled (false) for ADMIN and KASIR
    const defaultAccess: { pageKey: string; role: Role; enabled: boolean }[] = [];
    const roles: Role[] = [Role.ADMIN, Role.KASIR];

    for (const page of PAGE_KEYS) {
      for (const role of roles) {
        defaultAccess.push({
          pageKey: page.key,
          role,
          enabled: false,
        });
      }
    }

    await prisma.pageAccess.createMany({
      data: defaultAccess,
    });
    console.log("Initialized page access matrix with default values.");
  } catch (error) {
    console.error("[INITIALIZE_PAGE_ACCESS_ERROR]", error);
  }
}

/**
 * Reads the full PageAccess matrix (Only for SUPER_ADMIN).
 */
export async function getPageAccessMatrix() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized. Hanya SUPER_ADMIN yang diizinkan." };
    }

    await initializePageAccess();

    const data = await prisma.pageAccess.findMany({
      orderBy: [{ pageKey: "asc" }, { role: "asc" }],
    });

    return { success: true, data };
  } catch (error) {
    console.error("[GET_PAGE_ACCESS_MATRIX_ERROR]", error);
    return { success: false, error: "Gagal mengambil matriks akses halaman." };
  }
}

/**
 * Updates a specific PageAccess rule (Only for SUPER_ADMIN).
 */
export async function updatePageAccess(pageKey: string, role: Role, enabled: boolean) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized. Hanya SUPER_ADMIN yang diizinkan." };
    }

    const updated = await prisma.pageAccess.upsert({
      where: {
        pageKey_role: { pageKey, role },
      },
      update: {
        enabled,
        updatedBy: session.user.name || session.user.email,
        updatedAt: new Date(),
      },
      create: {
        pageKey,
        role,
        enabled,
        updatedBy: session.user.name || session.user.email,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/page-access");
    return { success: true, data: updated };
  } catch (error) {
    console.error("[UPDATE_PAGE_ACCESS_ERROR]", error);
    return { success: false, error: "Gagal memperbarui akses halaman." };
  }
}

/**
 * Returns allowed page keys for the current user's role.
 */
export async function getAllowedPagesForRole(role: Role): Promise<string[]> {
  try {
    if (role === "SUPER_ADMIN") {
      // Superadmin has absolute access to all pages
      return PAGE_KEYS.map((p) => p.key);
    }

    await initializePageAccess();

    const allowed = await prisma.pageAccess.findMany({
      where: {
        role,
        enabled: true,
      },
      select: {
        pageKey: true,
      },
    });

    return allowed.map((a) => a.pageKey);
  } catch (error) {
    console.error("[GET_ALLOWED_PAGES_ERROR]", error);
    return [];
  }
}
