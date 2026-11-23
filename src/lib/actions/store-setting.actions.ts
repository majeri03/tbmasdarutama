"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { storeSettingSchema } from "@/lib/validations/store-setting.schema";
import { revalidatePath } from "next/cache";
import { requirePermission, type AuthSession } from "../utils/role";
import { confirmR2File, deleteR2FileByUrl } from "@/lib/utils/r2-tracking";

export async function getStoreSetting(externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    requirePermission(session, "VIEW_SETTINGS");
    const setting = await prisma.storeSetting.findFirst();
    return { success: true, data: setting };
  } catch (error) {
    console.error("[GET_STORE_SETTING_ERROR]", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Gagal mengambil data toko" 
    };
  }
}

export async function updateStoreSetting(formData: unknown, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    requirePermission(session, "MANAGE_STORE_SETTINGS");

    const validated = storeSettingSchema.parse(formData);

    const existing = await prisma.storeSetting.findFirst();
    // FIX (22 Nov 2026, R2): catat logo lama SEBELUM ditimpa.
    const oldLogoUrl = existing?.logoUrl ?? null;

    let result;

    if (existing) {
      // Hanya update field yang disertakan, agar tab Invoice dan tab Toko tidak saling menimpa
      const updateData: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(validated)) {
        if (val !== undefined) {
          if (val === "" && key !== "name") {
            updateData[key] = null;
          } else if (val !== "") {
            updateData[key] = val;
          }
        }
      }

      result = await prisma.storeSetting.update({
        where: { id: existing.id },
        // PKG-A: cast diperluas dengan number supaya field numerik baru
        // (pointsRupiahPerPoint) tersimpan dengan tipe yang benar.
        data: updateData as { [key: string]: string | boolean | number | null },
      });
    } else {
      const createData: Record<string, unknown> = {
        name: validated.name || "TB Masdar Utama",
        tagline: validated.tagline || "Distributor Bahan Bangunan Terpercaya",
        phone: validated.phone || "6285398346677",
        address: validated.address || "Jl. Poros Maros - Pangkep, Maccini Baji, Kec. Lau, Kabupaten Maros, Sulawesi Selatan",
        invoiceLayoutType: validated.invoiceLayoutType || "STRUK_KECIL",
        invoicePaperSize: validated.invoicePaperSize || "58mm",
        invoiceDocumentPaperSize: validated.invoiceDocumentPaperSize || "A4",
        invoiceShowHeader: validated.invoiceShowHeader ?? true,
        invoiceShowLogo: validated.invoiceShowLogo ?? true,
        invoiceShowCustomerInfo: validated.invoiceShowCustomerInfo ?? true,
        invoiceShowPaymentInfo: validated.invoiceShowPaymentInfo ?? true,
        invoiceShowSignature: validated.invoiceShowSignature ?? true,
        invoiceShowFooter: validated.invoiceShowFooter ?? true,
        invoiceFooterTerms: validated.invoiceFooterTerms || "BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.",
      };
      for (const [k, v] of Object.entries(validated)) {
        if (v !== undefined && v !== null && v !== "") {
          createData[k] = v;
        }
      }
      result = await prisma.storeSetting.create({
        // PKG-A: cast diperluas dengan number (pointsRupiahPerPoint).
        data: createData as { [key: string]: string | boolean | number },
      });
    }

    // FIX (22 Nov 2026, R2): logo diganti -> hapus file lama dari R2;
    // logo baru dikonfirmasi ACTIVE milik pengaturan toko ini.
    const newLogoUrl = (result as { logoUrl?: string | null }).logoUrl ?? null;
    if (oldLogoUrl && oldLogoUrl !== newLogoUrl) {
      await deleteR2FileByUrl(oldLogoUrl);
    }
    if (newLogoUrl) {
      await confirmR2File(newLogoUrl, "LOGO", (result as { id: string }).id);
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return { success: true, data: result };
  } catch (error) {
    console.error("[UPDATE_STORE_SETTING_ERROR]", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal menyimpan data toko",
    };
  }
}
