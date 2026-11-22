import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/utils/api";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

type DriverInfo = { id: string; name: string; phone: string | null } | null;

type DriverCheck =
  | { ok: true; driver: DriverInfo; coDriver: DriverInfo }
  | { ok: false; message: string };

/**
 * Validasi penugasan sopir: id harus milik user yang ada, dan sopir utama
 * tidak boleh sama dengan sopir pendamping. (Duplikat kecil dari
 * src/app/api/fleet/vehicles/route.ts — sengaja tidak diimpor lintas route
 * agar tiap route tetap berdiri sendiri.)
 */
async function checkDrivers(
  driverUserId: string | null,
  coDriverUserId: string | null
): Promise<DriverCheck> {
  if (driverUserId && coDriverUserId && driverUserId === coDriverUserId) {
    return {
      ok: false,
      message: "Sopir utama dan sopir pendamping tidak boleh orang yang sama.",
    };
  }
  let driver: DriverInfo = null;
  let coDriver: DriverInfo = null;
  if (driverUserId) {
    driver = await prisma.user.findUnique({
      where: { id: driverUserId },
      select: { id: true, name: true, phone: true },
    });
    if (!driver) {
      return { ok: false, message: "Sopir utama tidak ditemukan." };
    }
  }
  if (coDriverUserId) {
    coDriver = await prisma.user.findUnique({
      where: { id: coDriverUserId },
      select: { id: true, name: true, phone: true },
    });
    if (!coDriver) {
      return { ok: false, message: "Sopir pendamping tidak ditemukan." };
    }
  }
  return { ok: true, driver, coDriver };
}

/** Normalisasi id sopir dari body: undefined = tidak diubah, "" = hapus (null). */
function normalizeDriverId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/**
 * PUT /api/fleet/vehicles/[id]
 * Memperbarui data armada.
 * Menerima driverUserId / coDriverUserId (nullable): string = tugaskan,
 * null / "" = lepas penugasan, tidak dikirim = biarkan seperti semula.
 * Kalau sopir utama baru ditugaskan dan driverName tidak diketik, nama
 * diambil dari akun user. Kalau penugasan dilepas, driverName tetap
 * seperti yang diketik / sebelumnya.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const { plateNumber, vehicleType, brand, year, driverName, driverPhone, status } = body;

    const existing = await prisma.fleetVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFoundResponse("Armada");
    }

    // Nilai penugasan hasil akhir (baru vs yang sudah ada), untuk validasi.
    const newDriverIdRaw = normalizeDriverId(body.driverUserId);
    const newCoDriverIdRaw = normalizeDriverId(body.coDriverUserId);
    const newDriverId =
      newDriverIdRaw === undefined ? existing.driverUserId : newDriverIdRaw;
    const newCoDriverId =
      newCoDriverIdRaw === undefined
        ? existing.coDriverUserId
        : newCoDriverIdRaw;

    const check = await checkDrivers(newDriverId, newCoDriverId);
    if (!check.ok) return validationErrorResponse(check.message);

    // Nama sopir: yang diketik menang; kalau sopir utama BARU ditugaskan
    // dan nama tidak diketik, pakai nama akunnya.
    let finalDriverName =
      driverName !== undefined && driverName !== null && String(driverName).trim()
        ? String(driverName).trim()
        : existing.driverName;
    const driverNewlyAssigned =
      newDriverId && newDriverId !== existing.driverUserId;
    if (
      driverNewlyAssigned &&
      check.driver &&
      (driverName === undefined ||
        driverName === null ||
        !String(driverName).trim())
    ) {
      finalDriverName = check.driver.name;
    }

    const updated = await prisma.fleetVehicle.update({
      where: { id },
      data: {
        plateNumber: plateNumber ? plateNumber.trim().toUpperCase() : existing.plateNumber,
        vehicleType: vehicleType || existing.vehicleType,
        brand: brand !== undefined ? (brand ? brand.trim() : null) : existing.brand,
        year: year !== undefined ? (year ? Number(year) : null) : existing.year,
        driverName: finalDriverName,
        driverPhone: driverPhone !== undefined ? (driverPhone ? driverPhone.trim() : null) : existing.driverPhone,
        driverUserId: newDriverId,
        coDriverUserId: newCoDriverId,
        status: status || existing.status,
      },
    });

    return successResponse(updated, "Data armada berhasil diperbarui.");
  } catch (error) {
    console.error("[API_FLEET_VEHICLE_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat memperbarui armada.");
  }
}

/**
 * DELETE /api/fleet/vehicles/[id]
 * Menghapus armada (soft-delete).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;

    const existing = await prisma.fleetVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFoundResponse("Armada");
    }

    await prisma.fleetVehicle.update({
      where: { id },
      data: { isActive: false },
    });

    return successResponse(null, "Armada berhasil dihapus.");
  } catch (error) {
    console.error("[API_FLEET_VEHICLE_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat menghapus armada.");
  }
}
