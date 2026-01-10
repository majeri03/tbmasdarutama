import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StockClient } from "./_components/StockClient";
import {
    getStockMovements,
    getStockStatistics,
    getLowStockProducts,
} from "@/lib/actions/stock.actions";
import prisma from "@/lib/prisma";
import { MovementType } from "@prisma/client";

export const metadata: Metadata = {
    title: "Stock Control | TB Masdar Utama",
    description: "Kelola dan monitoring stock produk",
};

interface StockPageProps {
    searchParams: {
        search?: string;
        type?: MovementType;
        page?: string;
        limit?: string;
    };
}

export default async function StockPage({ searchParams }: StockPageProps) {
    const params = await searchParams;
    // Check authentication
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    // Parse search params
    const search = params.search || "";
    const movementType = params.type;
    const page = parseInt(params.page || "1");
    const limit = parseInt(params.limit || "10");

    // Fetch stock movements
    const movementsResult = await getStockMovements({
        search,
        movementType,
        page,
        limit,
    });

    if (!movementsResult.success) {
        return (
            <div className="p-6">
                <div className="glass-card p-8 text-center">
                    <p className="text-red-600 font-semibold">
                        {movementsResult.error || "Gagal memuat data stock movements"}
                    </p>
                </div>
            </div>
        );
    }

    // Fetch statistics
    const statsResult = await getStockStatistics();

    if (!statsResult.success) {
        return (
            <div className="p-6">
                <div className="glass-card p-8 text-center">
                    <p className="text-red-600 font-semibold">
                        {statsResult.error || "Gagal memuat statistik stock"}
                    </p>
                </div>
            </div>
        );
    }

    // Fetch all active products for adjustment modal
    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            deletedAt: null,
        },
        select: {
            id: true,
            code: true,
            name: true,
            currentStock: true,
        },
        orderBy: {
            name: "asc",
        },
    });

    // Fetch low stock products
    const lowStockResult = await getLowStockProducts();
    const lowStockProducts = lowStockResult.success ? lowStockResult.data : [];

    return (
        <StockClient
            initialMovements={movementsResult.data || []}
            initialTotal={movementsResult.pagination?.total || 0}
            initialPage={page}
            initialLimit={limit}
            statistics={statsResult.data || {
                totalProducts: 0,
                totalBuyValue: 0,
                totalSellValue: 0,
                lowStockCount: 0,
                movementsToday: 0,
                stockInMonth: 0,
                stockOutMonth: 0,
            }}
            products={products}
            lowStockProducts={lowStockProducts || []}
        />
    );
}