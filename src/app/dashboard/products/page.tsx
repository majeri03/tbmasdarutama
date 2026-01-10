import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProductsClient } from "./_components/ProductsClient";
import { Package } from "lucide-react";
import { Prisma } from "@prisma/client";

interface SearchParams {
    search?: string;
    page?: string;
    categoryId?: string;
    supplierId?: string;
    isActive?: string;
    lowStock?: string;
}

async function getProductsData(searchParams: SearchParams) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const search = searchParams.search || "";
    const page = parseInt(searchParams.page || "1");
    const limit = 10;
    const categoryId = searchParams.categoryId || "";
    const supplierId = searchParams.supplierId || "";
    const isActive = searchParams.isActive === "true" ? true : searchParams.isActive === "false" ? false : undefined;
    const lowStock = searchParams.lowStock === "true";

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            { barcode: { contains: search, mode: "insensitive" as const } },
        ];
    }

    if (categoryId) {
        where.categoryId = categoryId;
    }

    if (supplierId) {
        where.supplierId = supplierId;
    }

    if (isActive !== undefined) {
        where.isActive = isActive;
    }

    // Fetch products with pagination
    const [productsRaw, total] = await Promise.all([
        prisma.product.findMany({
            where: lowStock
                ? {
                    ...where,
                    currentStock: {
                        lte: prisma.product.fields.minStock,
                    },
                }
                : where,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                subCategory: {
                    select: {
                        id: true,
                        name: true,
                        categoryId: true,
                    },
                },
                supplier: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        phone: true,
                    },
                },
                productUnits: {
                    include: {
                        unit: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        isPrimary: "desc",
                    },
                },
                productImages: {
                    orderBy: {
                        isPrimary: "desc",
                    },
                },
                _count: {
                    select: {
                        productImages: true,
                        saleItems: true,
                        purchaseItems: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.product.count({ where: lowStock ? { ...where, currentStock: { lte: prisma.product.fields.minStock } } : where }),
    ]);

    // Transform Decimal to number for client
    const products = productsRaw.map(product => ({
        ...product,
        productUnits: product.productUnits.map(pu => ({
            ...pu,
            buyPrice: pu.buyPrice.toNumber(),
            sellPrice: pu.sellPrice.toNumber(),
        })),
    }));

    // Fetch stats
    const [totalProducts, activeProducts, inactiveProducts, lowStockCount] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { isActive: true } }),
        prisma.product.count({ where: { isActive: false } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
  SELECT COUNT(*)::int as count
  FROM products
  WHERE "currentStock" <= "minStock"
`,
    ]);

    const lowStockProducts = Number(lowStockCount[0]?.count || 0);

    // Fetch categories, subcategories, suppliers, units
    const [categories, subCategories, suppliers, units] = await Promise.all([
        prisma.category.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
        prisma.subCategory.findMany({
            select: {
                id: true,
                name: true,
                categoryId: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
        prisma.supplier.findMany({
            select: {
                id: true,
                code: true,
                name: true,
                phone: true,
            },
            where: {
                isActive: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
        prisma.unit.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
    ]);

    return {
        products,
        total,
        page,
        limit,
        totalProducts,
        activeProducts,
        inactiveProducts,
        lowStockProducts,
        categories,
        subCategories,
        suppliers,
        units,
    };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
    const data = await getProductsData(await searchParams);

    return (
        <div className="p-6">
            <Suspense fallback={<ProductsLoading />}>
                <ProductsClient
                    initialProducts={data.products}
                    initialTotal={data.total}
                    initialPage={data.page}
                    initialLimit={data.limit}
                    totalProducts={data.totalProducts}
                    activeProducts={data.activeProducts}
                    inactiveProducts={data.inactiveProducts}
                    lowStockProducts={data.lowStockProducts}
                    categories={data.categories}
                    subCategories={data.subCategories}
                    suppliers={data.suppliers}
                    units={data.units}
                />
            </Suspense>
        </div>
    );
}

// Loading component
function ProductsLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative">
                <Package className="w-16 h-16 text-blue-600 animate-bounce" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            </div>
            <p className="mt-6 text-lg font-semibold text-gray-700 animate-pulse">
                Memuat data produk...
            </p>
            <p className="text-sm text-gray-500 mt-2">Harap tunggu sebentar</p>
        </div>
    );
}

// Metadata
export const metadata = {
    title: "Manajemen Produk | TB Masda Rutama",
    description: "Kelola produk, stok, harga, dan informasi produk lainnya",
};