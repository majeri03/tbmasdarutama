import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export interface DriverVehicleRecord {
  id: string;
  plateNumber: string; // Plat nomor DD
  driverName: string;
  vehicleType: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  lastActive: string;
  status: "AKTIF" | "DI_JALAN" | "STANDBY";
  activeDeliveryOrderId?: string;
  activeDeliveryOrderNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "driver_vehicles.json");

function ensureFile(): DriverVehicleRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const defaultRecords: DriverVehicleRecord[] = [
        {
          id: "vh-001",
          plateNumber: "DD 8452 AB",
          driverName: "Pak Daeng Usman",
          vehicleType: "Truk Engkel",
          phone: "081234567890",
          latitude: -5.147665,
          longitude: 119.432731,
          accuracy: 10,
          status: "AKTIF",
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultRecords, null, 2), "utf8");
      return defaultRecords;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[DRIVER_TRACKING] File read error:", e);
    return [];
  }
}

function saveFile(records: DriverVehicleRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (e) {
    console.error("[DRIVER_TRACKING] File save error:", e);
  }
}

/**
 * GET /api/mobile/driver-tracking
 * Mengambil daftar armada terdaftar dan posisi GPS terkini.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const records = ensureFile();

    // Cek juga Surat Jalan aktif untuk menghubungkan status armada
    const activeDOs = await prisma.deliveryOrder.findMany({
      where: { status: { in: ["PENDING", "IN_TRANSIT"] } },
      select: { id: true, doNumber: true, driver: true, vehicle: true, status: true },
    });

    const enriched = records.map((r) => {
      const matchingDO = activeDOs.find(
        (d) =>
          (d.driver && d.driver.toLowerCase().includes(r.driverName.toLowerCase())) ||
          (d.vehicle && d.vehicle.toLowerCase().includes(r.plateNumber.toLowerCase()))
      );
      return {
        ...r,
        activeDeliveryOrderId: matchingDO?.id ?? r.activeDeliveryOrderId,
        activeDeliveryOrderNumber: matchingDO?.doNumber ?? r.activeDeliveryOrderNumber,
        status: matchingDO?.status === "IN_TRANSIT" ? "DI_JALAN" : r.status,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error("[API_DRIVER_TRACKING_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data armada" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mobile/driver-tracking
 * 1. Mendaftarkan mobil baru dengan Plat DD, Nama Sopir, dan Jenis Mobil
 * 2. ATAU memperbarui lokasi GPS live sopir
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      plateNumber,
      driverName,
      vehicleType,
      phone,
      latitude,
      longitude,
      accuracy,
      status,
      deliveryOrderId,
      notes,
    } = body;

    if (!plateNumber || !driverName || !vehicleType) {
      return NextResponse.json(
        { success: false, message: "Plat DD, nama sopir, dan jenis mobil wajib diisi." },
        { status: 400 }
      );
    }

    const records = ensureFile();
    const nowStr = new Date().toISOString();

    // Format plat nomor agar seragam: contoh "dd 1234 ab" -> "DD 1234 AB"
    const cleanPlate = plateNumber.trim().toUpperCase();

    // Cek apakah armada sudah ada (berdasarkan ID atau Nomor Plat)
    const existingIndex = records.findIndex(
      (r) => (id && r.id === id) || r.plateNumber.replace(/\s+/g, "") === cleanPlate.replace(/\s+/g, "")
    );

    let updatedRecord: DriverVehicleRecord;

    if (existingIndex >= 0) {
      // Update armada yang sudah ada
      const prev = records[existingIndex];
      updatedRecord = {
        ...prev,
        plateNumber: cleanPlate,
        driverName: driverName.trim(),
        vehicleType: vehicleType.trim(),
        phone: phone ? phone.trim() : prev.phone,
        latitude: latitude !== undefined ? Number(latitude) : prev.latitude,
        longitude: longitude !== undefined ? Number(longitude) : prev.longitude,
        accuracy: accuracy !== undefined ? Number(accuracy) : prev.accuracy,
        status: status || prev.status,
        activeDeliveryOrderId: deliveryOrderId || prev.activeDeliveryOrderId,
        notes: notes !== undefined ? notes : prev.notes,
        lastActive: nowStr,
        updatedAt: nowStr,
      };
      records[existingIndex] = updatedRecord;
    } else {
      // Daftarkan armada baru
      const newId = `vh-${Date.now().toString().slice(-6)}`;
      updatedRecord = {
        id: newId,
        plateNumber: cleanPlate,
        driverName: driverName.trim(),
        vehicleType: vehicleType.trim(),
        phone: phone ? phone.trim() : "",
        latitude: latitude !== undefined ? Number(latitude) : undefined,
        longitude: longitude !== undefined ? Number(longitude) : undefined,
        accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
        status: status || "AKTIF",
        activeDeliveryOrderId: deliveryOrderId || undefined,
        notes: notes || "",
        lastActive: nowStr,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      records.unshift(updatedRecord);
    }

    saveFile(records);

    // Jika ada deliveryOrderId yang disertakan, update juga Surat Jalan di DB pusat
    if (deliveryOrderId) {
      try {
        await prisma.deliveryOrder.update({
          where: { id: deliveryOrderId },
          data: {
            driver: updatedRecord.driverName,
            vehicle: `${updatedRecord.plateNumber} (${updatedRecord.vehicleType})`,
          },
        });
      } catch (e) {
        console.warn("[DRIVER_TRACKING] Update DeliveryOrder notice:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Armada ${updatedRecord.plateNumber} (${updatedRecord.driverName}) berhasil disimpan!`,
      data: updatedRecord,
    });
  } catch (error) {
    console.error("[API_DRIVER_TRACKING_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan data armada" },
      { status: 500 }
    );
  }
}
