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

/**
 * PENTEST FIX (22 Nov 2026, L17): whitelist jenis & status kendaraan dan
 * validasi tahun — sama seperti POST (lihat vehicles/route.ts).
 */
const VEHICLE_TYPES = ["TRUCK", "PICKUP", "MOTOR", "VAN", "OTHER"];
const VEHICLE_STATUSES = ["ACTIVE", "IDLE", "MAINTENANCE", "OFF"];

function validateVehicleMeta(
  vehicleType: unknown,
  status: unknown,
  year: unknown
):
  | {
      ok: true;
      vehicleType?: string;
      status?: string;
      year?: number | null;
    }
  | { ok: false; message: string } {
  let normType: string | undefined;
  if (vehicleType !== undefined && vehicleType !== null && String(vehicleType).trim() !== "") {
    normType = String(vehicleType).trim().toUpperCase();
    if (!VEHICLE_TYPES.includes(normType)) {
      return { ok: false, message: `Jenis kendaraan tidak valid (pilih: ${VEHICLE_TYPES.join(", ")}).` };
    }
  }
  let normStatus: string | undefined;
  if (status !== undefined && status !== null && String(status).trim() !== "") {
    normStatus = String(status).trim().toUpperCase();
    if (!VEHICLE_STATUSES.includes(normStatus)) {
      return { ok: false, message: `Status kendaraan tidak valid (pilih: ${VEHICLE_STATUSES.join(", ")}).` };
    }
  }
  let normYear: number | null | undefined;
  if (year !== undefined && year !== null && String(year).trim() !== "") {
    const n = Number(year);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(n) || n < 1950 || n > maxYear) {
      return { ok: false, message: `Tahun kendaraan tidak valid (1950–${maxYear}).` };
    }
    normYear = n;
  } else if (year !== undefined) {
    normYear = null;
  }
  return { ok: true, vehicleType: normType, status: normStatus, year: normYear };
}

/** Normalisasi id sopir dari body: undefined = tidak diubah, "" = hapus (null). */
function normalizeDriverId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/**
 * PUT /api/fleet/vehicles/[id]
 * Memperbarui data armada. (Super Admin saja — WS-1, 25 Nov 2026.)
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
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const { plateNumber, vehicleType, brand, year, driverName, driverPhone, status } = body;

    const existing = await prisma.fleetVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFoundResponse("Armada");
    }

    const meta = validateVehicleMeta(vehicleType, status, year);
    if (!meta.ok) return validationErrorResponse(meta.message);

    // PENTEST FIX (L17): PUT dulu tidak memeriksa duplikat plat — plat
    // kendaraan lain bisa ditimpa (hanya berakhir 500 dari constraint unik).
    const newPlate = plateNumber ? String(plateNumber).trim().toUpperCase() : existing.plateNumber;
    if (newPlate !== existing.plateNumber) {
      const plateTaken = await prisma.fleetVehicle.findUnique({
        where: { plateNumber: newPlate },
      });
      if (plateTaken) {
        return errorResponse(`Nomor Plat ${newPlate} sudah terdaftar pada kendaraan lain!`, 400);
      }
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
        plateNumber: newPlate,
        vehicleType: meta.vehicleType ?? existing.vehicleType,
        brand: brand !== undefined ? (brand ? brand.trim() : null) : existing.brand,
        year: meta.year !== undefined ? meta.year : existing.year,
        driverName: finalDriverName,
        driverPhone: driverPhone !== undefined ? (driverPhone ? driverPhone.trim() : null) : existing.driverPhone,
        driverUserId: newDriverId,
        coDriverUserId: newCoDriverId,
        status: meta.status ?? existing.status,
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
 * Menghapus armada (soft-delete). (Super Admin saja — WS-1, 25 Nov 2026.)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

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
