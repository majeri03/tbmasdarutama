"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { type AuthSession } from "../utils/role";

export interface FleetVehicleOption {
  id: string;
  plateNumber: string;
  vehicleType: string;
  brand: string | null;
  driverName: string;
  driverPhone: string | null;
  status: string;
  isActive: boolean;
}

/**
 * Mendapatkan daftar armada/kendaraan yang aktif untuk dropdown pengiriman.
 */
export async function getFleetVehicles(externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const vehicles = await prisma.fleetVehicle.findMany({
      where: { isActive: true },
      orderBy: { plateNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        vehicleType: true,
        brand: true,
        driverName: true,
        driverPhone: true,
        status: true,
        isActive: true,
      },
    });

    return {
      success: true,
      data: vehicles,
    };
  } catch (error) {
    console.error("[GET_FLEET_VEHICLES_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data armada",
    };
  }
}
