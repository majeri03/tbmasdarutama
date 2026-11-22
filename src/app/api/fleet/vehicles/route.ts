import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
} from "@/lib/utils/api";
import { hasMinimumRole } from "@/lib/utils/role";

type DriverInfo = { id: string; name: string; phone: string | null } | null;

type DriverCheck =
  | { ok: true; driver: DriverInfo; coDriver: DriverInfo }
  | { ok: false; message: string };

/**
 * PENTEST FIX (22 Nov 2026, L17): whitelist jenis & status kendaraan dan
 * validasi tahun. Sebelumnya `year: "abc"` jadi NaN dan diteruskan ke
 * Prisma, serta `status`/`vehicleType` bebas diisi apa pun.
 * Nilai yang dipakai form web: jenis TRUCK/PICKUP/MOTOR/VAN/OTHER,
 * status ACTIVE/IDLE/MAINTENANCE/OFF (lihat FleetMap.tsx).
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

/**
 * Validasi penugasan sopir: id harus milik user yang ada, dan sopir utama
 * tidak boleh sama dengan sopir pendamping. Id kosong / bukan string
 * dianggap tidak ditugaskan (null).
 */
async function checkDrivers(
  driverUserId: unknown,
  coDriverUserId: unknown
): Promise<DriverCheck> {
  const dId =
    typeof driverUserId === "string" && driverUserId.trim()
      ? driverUserId.trim()
      : null;
  const cId =
    typeof coDriverUserId === "string" && coDriverUserId.trim()
      ? coDriverUserId.trim()
      : null;
  if (dId && cId && dId === cId) {
    return {
      ok: false,
      message: "Sopir utama dan sopir pendamping tidak boleh orang yang sama.",
    };
  }
  let driver: DriverInfo = null;
  let coDriver: DriverInfo = null;
  if (dId) {
    driver = await prisma.user.findUnique({
      where: { id: dId },
      select: { id: true, name: true, phone: true },
    });
    if (!driver) {
      return { ok: false, message: "Sopir utama tidak ditemukan." };
    }
  }
  if (cId) {
    coDriver = await prisma.user.findUnique({
      where: { id: cId },
      select: { id: true, name: true, phone: true },
    });
    if (!coDriver) {
      return { ok: false, message: "Sopir pendamping tidak ditemukan." };
    }
  }
  return { ok: true, driver, coDriver };
}

/**
 * GET /api/fleet/vehicles
 * Mengambil daftar armada dan posisi terakhirnya.
 * FIX (22 Nov 2026, rombakan armada): blok seed INITIAL_VEHICLES dihapus —
 * data contoh palsu (Pak Syamsul dkk.) tidak boleh masuk produksi, dan seed
 * itu punya perangkap: count() menghitung baris nonaktif sedangkan DELETE
 * hanya soft-delete, jadi sekali contoh dihapus daftar jadi "Kendaraan (0)"
 * selamanya. Kendaraan sekarang hanya dari pendaftaran (POST).
 *
 * PENTEST FIX (22 Nov 2026, M21): dulu tanpa cek role — KASIR mana pun
 * melihat GPS live + no. HP semua sopir. Sekarang ADMIN+ mendapat daftar
 * penuh; non-ADMIN hanya kendaraannya sendiri (driver/co-driver) dan
 * driverPhone disembunyikan.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const isAdmin = hasMinimumRole(session, "ADMIN");
    const vehicles = await prisma.fleetVehicle.findMany({
      where: isAdmin
        ? { isActive: true }
        : {
            isActive: true,
            OR: [
              { driverUserId: session.user.id },
              { coDriverUserId: session.user.id },
            ],
          },
      orderBy: { updatedAt: "desc" },
      include: {
        driverUser: { select: { id: true, name: true } },
        coDriverUser: { select: { id: true, name: true } },
      },
    });

    const formatted = vehicles.map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      brand: v.brand,
      year: v.year,
      driverName: v.driverName,
      // PENTEST FIX (M21): no. HP sopir hanya untuk ADMIN+.
      driverPhone: isAdmin ? v.driverPhone : undefined,
      driverUserId: v.driverUserId,
      coDriverUserId: v.coDriverUserId,
      driverUserName: v.driverUser?.name || undefined,
      coDriverName: v.coDriverUser?.name || undefined,
      status: v.status,
      lastLocation:
        v.latitude !== null && v.longitude !== null
          ? {
              latitude: v.latitude,
              longitude: v.longitude,
              address: v.address || undefined,
              updatedAt: v.lastLocationAt ? v.lastLocationAt.toISOString() : v.updatedAt.toISOString(),
            }
          : undefined,
      registeredAt: v.createdAt.toISOString(),
    }));

    return successResponse(formatted);
  } catch (error) {
    console.error("[API_FLEET_VEHICLES_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat memuat data armada.");
  }
}

/**
 * POST /api/fleet/vehicles
 * Mendaftarkan armada baru. (Admin/Super Admin)
 * Menerima driverUserId / coDriverUserId (nullable). Kalau driverUserId
 * diisi dan driverName kosong, nama + no HP diambil dari akun user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const { plateNumber, vehicleType, brand, year, driverName, driverPhone, status } = body;

    if (!plateNumber || !String(plateNumber).trim()) {
      return validationErrorResponse("Nomor Plat wajib diisi.");
    }

    const meta = validateVehicleMeta(vehicleType, status, year);
    if (!meta.ok) return validationErrorResponse(meta.message);

    const check = await checkDrivers(body.driverUserId, body.coDriverUserId);
    if (!check.ok) return validationErrorResponse(check.message);

    // Nama sopir boleh kosong kalau sopir dipilih dari daftar akun — isi
    // dari nama akun. No HP juga ikut dari akun kalau tidak diketik.
    let finalDriverName =
      typeof driverName === "string" ? driverName.trim() : "";
    if (!finalDriverName && check.driver) finalDriverName = check.driver.name;
    if (!finalDriverName) {
      return validationErrorResponse(
        "Nama Sopir wajib diisi (atau pilih sopir dari daftar akun)."
      );
    }
    const finalDriverPhone =
      typeof driverPhone === "string" && driverPhone.trim()
        ? driverPhone.trim()
        : check.driver?.phone || null;

    const formattedPlate = plateNumber.trim().toUpperCase();

    // Check duplicate plate
    const existing = await prisma.fleetVehicle.findUnique({
      where: { plateNumber: formattedPlate },
    });

    if (existing) {
      if (!existing.isActive) {
        // Re-activate
        const updated = await prisma.fleetVehicle.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            vehicleType: meta.vehicleType ?? existing.vehicleType,
            brand: brand || existing.brand,
            year: meta.year !== undefined ? meta.year : existing.year,
            driverName: finalDriverName,
            driverPhone: finalDriverPhone,
            driverUserId: check.driver ? check.driver.id : null,
            coDriverUserId: check.coDriver ? check.coDriver.id : null,
            status: meta.status ?? "ACTIVE",
          },
        });
        return successResponse(updated, "Armada berhasil diaktifkan kembali.", 200);
      }
      return errorResponse(`Nomor Plat ${formattedPlate} sudah terdaftar!`, 400);
    }

    const newVehicle = await prisma.fleetVehicle.create({
      data: {
        plateNumber: formattedPlate,
        vehicleType: meta.vehicleType ?? "PICKUP",
        brand: brand ? brand.trim() : null,
        year: meta.year ?? null,
        driverName: finalDriverName,
        driverPhone: finalDriverPhone,
        driverUserId: check.driver ? check.driver.id : null,
        coDriverUserId: check.coDriver ? check.coDriver.id : null,
        status: meta.status ?? "ACTIVE",
        // FIX (22 Nov 2026): kendaraan baru TIDAK diberi lokasi palsu
        // Makassar — lokasi hanya muncul setelah HP sopir mengirim GPS.
      },
    });

    return successResponse(newVehicle, "Armada berhasil ditambahkan.", 201);
  } catch (error) {
    console.error("[API_FLEET_VEHICLES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat menambahkan armada.");
  }
}
