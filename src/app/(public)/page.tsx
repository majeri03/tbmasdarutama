import { getPublicLandingData } from "@/lib/actions/landing-public.actions";
import LandingNavbar from "../_components/LandingNavbar";
import LandingHero from "../_components/LandingHero";
import LandingAbout from "../_components/LandingAbout";
import LandingFeatures from "../_components/LandingFeatures";
import LandingProducts from "../_components/LandingProducts";
import LandingContact from "../_components/LandingContact";
import LandingFooter from "../_components/LandingFooter";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const result = await getPublicLandingData();

  if (!result.success || !result.data) {
    // Jika belum ada data, redirect ke setup atau dashboard
    redirect("/dashboard");
  }

  const { landing, store, products } = result.data;

  return (
    <div className="min-h-screen bg-[#141210] text-stone-100">
      {/* Navbar */}
      <LandingNavbar store={store} />

      {/* Hero Section */}
      <LandingHero landing={landing} />

      {/* About Section */}
      {landing?.aboutUs && <LandingAbout content={landing.aboutUs} />}

      {/* Features Section */}
      {landing?.whyChooseUs && <LandingFeatures content={landing.whyChooseUs} />}

      {/* Produk / Katalog — SELALU dirender (bukan hanya saat toggle
          showFeaturedProducts aktif dan produk tersedia), supaya:
          1) tautan nav "Produk" (#products) tidak pernah mengarah ke
             anchor yang tidak ada di halaman (item 205), dan
          2) bagian katalog dengan harga selalu terlihat pengunjung.
          Kalau belum ada produk, komponen menampilkan status kosong
          yang anggun beserta CTA hubungi kami. Toggle
          showFeaturedProducts saat ini tidak lagi menyembunyikan
          section ini; lihat NOTES.md bila perilaku lama diinginkan. */}
      <LandingProducts products={products ?? []} />

      {/* Contact Section */}
      <LandingContact store={store} mapUrl={landing?.contactMapUrl} />

      {/* Footer */}
      <LandingFooter store={store} />
    </div>
  );
}
