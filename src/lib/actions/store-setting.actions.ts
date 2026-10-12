"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { storeSettingSchema } from "@/lib/validations/store-setting.schema";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../utils/role";

export async function getStoreSetting() {
  try {
    const session = await auth();
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

export async function updateStoreSetting(formData: unknown) {
  try {
    const session = await auth();
    requirePermission(session, "MANAGE_STORE_SETTINGS");

    const validated = storeSettingSchema.parse(formData);

    const existing = await prisma.storeSetting.findFirst();

    let result;

    if (existing) {
      // Hanya update field yang disertakan, agar tab Invoice dan tab Toko tidak saling menimpa
      const updateData: Record<string, any> = {};
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
        data: updateData,
      });
    } else {
      const createData: any = {
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
        data: createData,
      });
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
