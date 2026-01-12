import type { Metadata } from "next";
import { getPublicLandingData } from "@/lib/actions/landing-public.actions";

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPublicLandingData();
  const store = result.data?.store;

  return {
    title: store?.name || "TB Masdar Utama",
    description: store?.tagline || "Distributor Bahan Bangunan Terpercaya",
    keywords: [
      "toko bangunan",
      "bahan bangunan",
      "distributor",
      store?.name || "",
      store?.city || "",
    ],
    openGraph: {
      title: store?.name || "TB Masdar Utama",
      description: store?.tagline || "Distributor Bahan Bangunan Terpercaya",
      images: store?.logoUrl ? [store.logoUrl] : [],
      type: "website",
    },
  };
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}