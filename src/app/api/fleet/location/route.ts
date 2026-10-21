import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/utils/api";

/**
 * POST /api/fleet/location
 * Menerima pembaruan koordinat GPS lokasi armada dari aplikasi mobile.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

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
