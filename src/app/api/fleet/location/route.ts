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

/**
 * POST /api/fleet/location
 * Menerima pembaruan koordinat GPS lokasi armada dari aplikasi mobile.
 * Role: ADMIN+ (SUPER_ADMIN/ADMIN).
 * FIX (22 Nov 2026): sebelumnya user login mana pun bisa mengubah GPS
 * vehicleId mana pun. Tidak ada kaitan sopir↔akun di model FleetVehicle
 * (driver hanya nama bebas), jadi dibatasi ke ADMIN+.
 * PERHATIAN: tombol "Mulai GPS" di APK tidak dibatasi role — kalau sopir
 * login sebagai KASIR, update GPS-nya akan ditolak (403) setelah patch
 * ini. Pastikan HP pelacak login sebagai ADMIN/SUPER_ADMIN, atau tambahkan
 * kaitan sopir↔akun dulu sebelum mengaktifkan GPS untuk KASIR.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse("Hanya ADMIN yang boleh memperbarui lokasi armada.");

    const body = await request.json();
    const { vehicleId, latitude, longitude, accuracy, address, timestamp } = body;

    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return validationErrorResponse("vehicleId, latitude, dan longitude wajib disertakan.");
    }

    const vehicle = await prisma.fleetVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return errorResponse("Armada tidak ditemukan.", 404);
    }

    const updated = await prisma.fleetVehicle.update({
      where: { id: vehicleId },
      data: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || vehicle.address,
        lastLocationAt: timestamp ? new Date(timestamp) : new Date(),
        status: vehicle.status === "OFF" ? "ACTIVE" : vehicle.status,
      },
    });

    return successResponse(
      {
        vehicleId: updated.id,
        latitude: updated.latitude,
        longitude: updated.longitude,
        updatedAt: updated.lastLocationAt,
      },
      "Lokasi armada berhasil diperbarui."
    );
  } catch (error) {
    console.error("[API_FLEET_LOCATION_POST_ERROR]", error);
    return errorResponse("Gagal memperbarui lokasi armada.");
  }
}
