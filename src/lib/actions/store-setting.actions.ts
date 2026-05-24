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
      result = await prisma.storeSetting.update({
        where: { id: existing.id },
        data: validated,
      });
    } else {
      result = await prisma.storeSetting.create({
        data: validated,
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
