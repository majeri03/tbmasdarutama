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
 * Aturan (22 Nov 2026, rombakan armada): boleh ADMIN+ (SUPER_ADMIN/ADMIN)
 * untuk kendaraan apa pun, ATAU sopir yang ditugaskan ke kendaraan itu
 * (driverUserId / coDriverUserId — boleh role apa pun, termasuk KASIR)
 * untuk kendaraannya sendiri. Sopir yang ditugaskan tidak lagi ditolak 403.
 *
 * PENTEST FIX (22 Nov 2026, M22 + L14): koordinat divalidasi supaya tidak
 * bisa dipalsukan bebas — rentang lat/lng, akurasi (meter, maks 100 m),
 * timestamp maks ±5 menit dari jam server, dan frekuensi maks 1x per
 * 10 detik per kendaraan. Kendaraan nonaktif ditolak, dan endpoint ini
 * tidak lagi mengubah status kendaraan (OFF tidak dihidupkan lagi).
 */
const LOCATION_MIN_INTERVAL_MS = 10_000; // 10 detik
const LOCATION_MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // ±5 menit
const LOCATION_MAX_ACCURACY_M = 100; // meter

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { vehicleId, latitude, longitude, accuracy, address, timestamp } = body;

    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return validationErrorResponse("vehicleId, latitude, dan longitude wajib disertakan.");
    }

    // PENTEST FIX (M22): tolak koordinat mustahil / bukan angka.
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return validationErrorResponse("Latitude tidak valid (harus -90 sampai 90).");
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return validationErrorResponse("Longitude tidak valid (harus -180 sampai 180).");
    }

    // PENTEST FIX (M22): akurasi GPS (meter) — tolak kalau terlalu kasar.
    if (accuracy !== undefined && accuracy !== null) {
      const acc = Number(accuracy);
      if (!Number.isFinite(acc) || acc < 0) {
        return validationErrorResponse("Accuracy tidak valid.");
      }
      if (acc > LOCATION_MAX_ACCURACY_M) {
        return validationErrorResponse(
          `Akurasi GPS terlalu rendah (${Math.round(acc)} m, maks ${LOCATION_MAX_ACCURACY_M} m) — tunggu sinyal GPS membaik.`
        );
      }
    }

    // PENTEST FIX (M22): timestamp harus dekat dengan jam server.
    const now = new Date();
    let locationAt = now;
    if (timestamp !== undefined && timestamp !== null) {
      const ts = new Date(timestamp);
      if (Number.isNaN(ts.getTime())) {
        return validationErrorResponse("Timestamp tidak valid.");
      }
      if (Math.abs(ts.getTime() - now.getTime()) > LOCATION_MAX_TIMESTAMP_SKEW_MS) {
        return validationErrorResponse("Timestamp terlalu jauh dari waktu server (maks ±5 menit).");
      }
      locationAt = ts;
    }

    const vehicle = await prisma.fleetVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return errorResponse("Armada tidak ditemukan.", 404);
    }

    // PENTEST FIX (L14): kendaraan yang sudah dihapus (soft-delete) tidak
    // boleh menerima GPS lagi.
    if (!vehicle.isActive) {
      return errorResponse("Armada sudah tidak aktif.", 404);
    }

    // ADMIN+ boleh untuk kendaraan apa pun; sopir yang ditugaskan hanya
    // untuk kendaraannya sendiri (utama atau pendamping).
    const isAdmin = hasMinimumRole(session, "ADMIN");
    const isAssignedDriver =
      session.user.id === vehicle.driverUserId ||
      session.user.id === vehicle.coDriverUserId;
    if (!isAdmin && !isAssignedDriver) {
      return forbiddenResponse(
        "Hanya sopir yang ditugaskan atau ADMIN yang boleh memperbarui lokasi kendaraan ini."
      );
    }

    // PENTEST FIX (M22): batasi frekuensi — maks 1x per 10 detik.
    if (vehicle.lastLocationAt) {
      const sinceLast = now.getTime() - vehicle.lastLocationAt.getTime();
      if (sinceLast >= 0 && sinceLast < LOCATION_MIN_INTERVAL_MS) {
        return errorResponse("Terlalu cepat — kirim lokasi berikutnya setelah 10 detik.", 429);
      }
    }

    const updated = await prisma.fleetVehicle.update({
      where: { id: vehicleId },
      data: {
        latitude: lat,
        longitude: lng,
        address: address || vehicle.address,
        lastLocationAt: locationAt,
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
