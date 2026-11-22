"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { landingPageSchema } from "@/lib/validations/landing-page.schema";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/utils/role";
import { confirmR2File, deleteR2FileByUrl } from "@/lib/utils/r2-tracking";
export async function getLandingPageSettings() {
  const session = await auth();
requirePermission(session, "VIEW_SETTINGS");
  try {
    const settings = await prisma.landingPageSetting.findFirst({
      include: {
        heroImages: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
      },
    });
    
    return { success: true, data: settings };
  } catch (error) {
    console.error("[GET_LANDING_PAGE_ERROR]", error);
    return { success: false, error: "Gagal mengambil data landing page" };
  }
}

export async function updateLandingPageSettings(formData: unknown) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_LANDING_PAGE");
    const validated = landingPageSchema.parse(formData);
    
    const existing = await prisma.landingPageSetting.findFirst();
    
    let result;
    
    if (existing) {
      result = await prisma.landingPageSetting.update({
        where: { id: existing.id },
        data: validated,
      });
    } else {
      result = await prisma.landingPageSetting.create({
        data: validated,
      });
    }
    
    revalidatePath("/dashboard/settings");
    revalidatePath("/");
    
    return { success: true, data: result };
  } catch (error) {
    console.error("[UPDATE_LANDING_PAGE_ERROR]", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Gagal menyimpan data landing page" 
    };
  }
}

export async function addHeroImage(imageUrl: string) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_LANDING_PAGE");
    // Get or create landing page setting
    let landing = await prisma.landingPageSetting.findFirst();
    
    if (!landing) {
      landing = await prisma.landingPageSetting.create({
        data: {},
      });
    }

    // Check max 10 images
    const count = await prisma.heroImage.count({
      where: { landingId: landing.id, isActive: true },
    });

    if (count >= 10) {
      return { success: false, error: "Maksimal 10 gambar hero" };
    }

    // Get next order
    const maxOrder = await prisma.heroImage.aggregate({
      where: { landingId: landing.id },
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const heroImage = await prisma.heroImage.create({
      data: {
        landingId: landing.id,
        imageUrl,
        order: nextOrder,
      },
    });

    // FIX (22 Nov 2026, R2): gambar hero baru dikonfirmasi ACTIVE.
    await confirmR2File(imageUrl, "HERO", heroImage.id);

    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return { success: true, data: heroImage };
  } catch (error) {
    console.error("[ADD_HERO_IMAGE_ERROR]", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Gagal menambahkan gambar hero" 
    };
  }
}

export async function deleteHeroImage(id: string) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_LANDING_PAGE");
    // FIX (22 Nov 2026, R2): hapus hero = hapus juga file R2-nya.
    // Sebelumnya hanya baris DB yang dihapus — file jadi yatim.
    const hero = await prisma.heroImage.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
    await prisma.heroImage.delete({
      where: { id },
    });
    if (hero?.imageUrl) await deleteR2FileByUrl(hero.imageUrl);

    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("[DELETE_HERO_IMAGE_ERROR]", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Gagal menghapus gambar hero" 
    };
  }
}

export async function reorderHeroImages(images: { id: string; order: number }[]) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_LANDING_PAGE");
    await prisma.$transaction(
      images.map((img) =>
        prisma.heroImage.update({
          where: { id: img.id },
          data: { order: img.order },
        })
      )
    );

    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("[REORDER_HERO_IMAGES_ERROR]", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Gagal mengatur ulang urutan gambar" 
    };
  }
}