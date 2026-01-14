"use server";

import prisma from "@/lib/prisma";
import { cache } from "react";
import { decimalToNumber } from "@/lib/utils";

export const getPublicLandingData = cache(async () => {
  try {
    const [landingPage, storeSetting, featuredProducts] = await Promise.all([
      prisma.landingPageSetting.findFirst({
        include: {
          heroImages: {
            where: { isActive: true },
            orderBy: { order: "asc" },
          },
        },
      }),

      prisma.storeSetting.findFirst(),

      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          productImages: {
            some: {},
          },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          category: {
            select: {
              name: true,
            },
          },
          productUnits: {
            where: {
              isPrimary: true,
            },
            select: {
              sellPrice: true,
              unit: {
                select: {
                  name: true,
                },
              },
            },
            take: 1,
          },
          productImages: {
            where: {
              isPrimary: true,
            },
            select: {
              imageUrl: true,
            },
            take: 1,
          },
        },
      }),
    ]);

    // Transform products data
    const transformedProducts = featuredProducts.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sellingPrice: product.productUnits[0]?.sellPrice 
        ? decimalToNumber(product.productUnits[0].sellPrice) // ✅ Convert
        : 0,
      imageUrl: product.productImages[0]?.imageUrl || null,
      category: product.category,
      unit: product.productUnits[0]?.unit || { name: "Unit" },
    }));

    return {
      success: true,
      data: {
        landing: landingPage,
        store: storeSetting,
        products: transformedProducts,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_LANDING_ERROR]", error);
    return {
      success: false,
      error: "Gagal memuat data landing page",
      data: null,
    };
  }
});