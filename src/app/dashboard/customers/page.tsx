import { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CustomersClient } from "./_components/CustomersClient";
import { CustomerType, Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "Customer | TB Masdar Utama",
  description: "Kelola data customer dan pelanggan",
};

interface SearchParams {
  page?: string;
  search?: string;
  type?: CustomerType;
  status?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>; // ✅ Next.js 15: searchParams is Promise
}

export default async function CustomersPage({ searchParams }: PageProps) {
  // Check authentication
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // ✅ Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Parse query parameters
  const page = parseInt(params.page || "1");
  const limit = 10;
  const skip = (page - 1) * limit;
  const search = params.search || "";
  const typeFilter = params.type;
  
  // ✅ Fixed: Status filter logic
  let statusFilter: boolean | undefined = undefined;
  if (params.status === "true") {
    statusFilter = true;
  } else if (params.status === "false") {
    statusFilter = false;
  }
  // Build where clause
  const where: Prisma.CustomerWhereInput = {};

  // Search filter
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Type filter
  if (typeFilter) {
    where.type = typeFilter;
  }

  // Status filter
  if (statusFilter !== undefined) {
    where.isActive = statusFilter;
  }

  // Fetch customers with pagination
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  // Fetch statistics
  const [totalCustomers, activeCustomers, inactiveCustomers] =
    await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: false } }),
    ]);

  // TODO: Calculate total debts when debt management is implemented
  const totalDebts = 0;

  return (
    <CustomersClient
      initialCustomers={customers}
      initialTotal={total}
      initialPage={page}
      initialLimit={limit}
      totalCustomers={totalCustomers}
      activeCustomers={activeCustomers}
      inactiveCustomers={inactiveCustomers}
      totalDebts={totalDebts}
    />
  );
}