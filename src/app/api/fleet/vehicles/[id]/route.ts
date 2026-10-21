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

/**
 * PUT /api/fleet/vehicles/[id]
 * Memperbarui data armada.
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

    const updated = await prisma.fleetVehicle.update({
      where: { id },
      data: {
        plateNumber: plateNumber ? plateNumber.trim().toUpperCase() : existing.plateNumber,
        vehicleType: vehicleType || existing.vehicleType,
        brand: brand !== undefined ? (brand ? brand.trim() : null) : existing.brand,
        year: year !== undefined ? (year ? Number(year) : null) : existing.year,
        driverName: driverName ? driverName.trim() : existing.driverName,
        driverPhone: driverPhone !== undefined ? (driverPhone ? driverPhone.trim() : null) : existing.driverPhone,
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
