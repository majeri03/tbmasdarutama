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

// Initial seed armada jika database masih kosong
const INITIAL_VEHICLES = [
  {
    plateNumber: "DD 8234 XY",
    vehicleType: "TRUCK",
    brand: "Mitsubishi Canter FE 74",
    year: 2022,
    driverName: "Pak Syamsul",
    driverPhone: "081245678901",
    status: "ACTIVE",
    latitude: -5.1385,
    longitude: 119.4182,
    address: "Jl. Veteran Selatan, Makassar",
    lastLocationAt: new Date(),
  },
  {
    plateNumber: "DD 8512 AB",
    vehicleType: "PICKUP",
    brand: "Mitsubishi L300",
    year: 2021,
    driverName: "Pak Daeng Rewa",
    driverPhone: "082198765432",
    status: "ACTIVE",
    latitude: -5.1478,
    longitude: 119.4325,
    address: "Jl. Pengayoman, Panakkukang, Makassar",
    lastLocationAt: new Date(),
  },
  {
    plateNumber: "DD 8901 MK",
    vehicleType: "TRUCK",
    brand: "Isuzu Giga",
    year: 2023,
    driverName: "Pak Basir",
    driverPhone: "085211223344",
    status: "IDLE",
    latitude: -5.1224,
    longitude: 119.4116,
    address: "Gudang TB Masdar Utama, Makassar",
    lastLocationAt: new Date(),
  },
];

/**
 * GET /api/fleet/vehicles
 * Mengambil daftar armada dan posisi terakhirnya.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const count = await prisma.fleetVehicle.count();
    if (count === 0) {
      // Auto seed initial Makassar fleet
      for (const v of INITIAL_VEHICLES) {
        await prisma.fleetVehicle.create({ data: v });
      }
    }

    const vehicles = await prisma.fleetVehicle.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = vehicles.map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      brand: v.brand,
      year: v.year,
      driverName: v.driverName,
      driverPhone: v.driverPhone,
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
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const { plateNumber, vehicleType, brand, year, driverName, driverPhone, status } = body;

    if (!plateNumber || !driverName) {
      return validationErrorResponse("Nomor Plat dan Nama Sopir wajib diisi.");
    }

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
            vehicleType: vehicleType || existing.vehicleType,
            brand: brand || existing.brand,
            year: year ? Number(year) : existing.year,
            driverName: driverName.trim(),
            driverPhone: driverPhone ? driverPhone.trim() : null,
            status: status || "ACTIVE",
          },
        });
        return successResponse(updated, "Armada berhasil diaktifkan kembali.", 200);
      }
      return errorResponse(`Nomor Plat ${formattedPlate} sudah terdaftar!`, 400);
    }

    const newVehicle = await prisma.fleetVehicle.create({
      data: {
        plateNumber: formattedPlate,
        vehicleType: vehicleType || "PICKUP",
        brand: brand ? brand.trim() : null,
        year: year ? Number(year) : null,
        driverName: driverName.trim(),
        driverPhone: driverPhone ? driverPhone.trim() : null,
        status: status || "ACTIVE",
        latitude: -5.1385,
        longitude: 119.4182,
        address: "Makassar, Sulawesi Selatan",
        lastLocationAt: new Date(),
      },
    });

    return successResponse(newVehicle, "Armada berhasil ditambahkan.", 201);
  } catch (error) {
    console.error("[API_FLEET_VEHICLES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat menambahkan armada.");
  }
}
