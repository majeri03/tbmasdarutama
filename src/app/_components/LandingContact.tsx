"use client";

import { MapPin, Phone, Mail, Clock, Facebook, Instagram, ExternalLink } from "lucide-react";

interface Props {
  store: {
    name: string;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    facebook?: string | null;
  } | null;
  mapUrl?: string | null;
}

/**
 * Hanya URL embed Google Maps yang boleh masuk ke <iframe>.
 * - https://www.google.com/maps/embed?... (tombol "Bagikan > Sematkan peta")
 * - https://maps.google.com/maps?...&output=embed
 * - https://www.google.com/maps?...&output=embed
 *
 * URL lain (mis. tautan berbagi biasa https://maps.app.goo.gl/... atau
 * https://www.google.com/maps/place/...) TIDAK bisa di-iframe: browser
 * menampilkan halaman error, dan terlihat seperti "peta diblokir".
 * Untuk URL seperti itu, tampilkan kartu fallback berisi tautan
 * "Buka di Google Maps" — jangan iframe-kan.
 */
function getEmbedUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname;
    const isGoogleHost =
      host === "www.google.com" || host === "google.com";
    if (isGoogleHost && url.pathname.startsWith("/maps/embed")) return url.toString();
    if (
      (host === "maps.google.com" && url.pathname === "/maps") ||
      (isGoogleHost && url.pathname === "/maps")
    ) {
      if (url.searchParams.get("output") === "embed") return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export default function LandingContact({ store, mapUrl }: Props) {
  const embedUrl = getEmbedUrl(mapUrl);
  const fullAddress = [store?.address, store?.city, store?.province]
    .filter(Boolean)
    .join(", ");
  // Tautan cadangan kalau iframe terblokir (mis. oleh CSP) — pengunjung
  // tetap bisa membuka lokasi di Google Maps.
  const mapsSearchUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : "https://www.google.com/maps/search/?api=1&query=TB+Masdar+Utama";

  const contactInfo = [
    {
      icon: MapPin,
      label: "Alamat",
      value: store?.address 
        ? `${store.address}, ${store.city || ''}, ${store.province || ''}`
        : "Belum ada alamat",
      href: null,
    },
    {
      icon: Phone,
      label: "Telepon",
      value: store?.phone || "-",
      href: store?.phone ? `tel:${store.phone}` : null,
    },
    {
      icon: Mail,
      label: "Email",
      value: store?.email || "-",
      href: store?.email ? `mailto:${store.email}` : null,
    },
    {
      icon: Clock,
      label: "Jam Operasional",
      value: "Senin - Sabtu: 08:00 - 17:00",
      href: null,
    },
  ];

  const socialMedia = [
    {
      icon: Instagram,
      label: "Instagram",
      value: store?.instagram,
      href: store?.instagram ? `https://instagram.com/${store.instagram.replace('@', '')}` : null,
    },
    {
      icon: Facebook,
      label: "Facebook",
      value: store?.facebook,
      href: store?.facebook ? `https://facebook.com/${store.facebook}` : null,
    },
  ];

  return (
    <section id="contact" className="py-20 bg-[#FAFAF8] relative overflow-hidden scroll-mt-24">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1C1917] mb-4">
            Hubungi <span className="text-[#7F1D1D]">Kami</span>
          </h2>
          <div className="w-24 h-1 bg-[#7F1D1D] mx-auto rounded-full mb-6" />
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            Kami siap membantu kebutuhan bahan bangunan Anda
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            {contactInfo.map((info, index) => (
              <div key={index} className="glass-card p-6 hover:scale-105 transition-transform">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#7F1D1D] flex items-center justify-center flex-shrink-0">
                    <info.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1C1917] mb-1">
                      {info.label}
                    </h3>
                    {info.href ? (
                      <a
                        href={info.href}
                        className="text-stone-600 hover:text-[#7F1D1D] transition-colors"
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p className="text-stone-600">{info.value}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Social Media */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-[#1C1917] mb-4">
                Ikuti Kami
              </h3>
              <div className="flex gap-4">
                {socialMedia.map((social, index) => (
                  social.href && (
                    <a
                      key={index}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-xl bg-[#7F1D1D] flex items-center justify-center hover:scale-110 transition-transform"
                      aria-label={social.label}
                    >
                      <social.icon className="w-6 h-6 text-white" />
                    </a>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="glass-card p-6 animate-slide-up animation-delay-400">
            <h3 className="font-semibold text-[#1C1917] mb-4">
              Lokasi Kami
            </h3>
            {embedUrl ? (
              <>
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Peta lokasi TB Masdar Utama"
                  className="rounded-lg"
                />
                <a
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#7F1D1D] hover:text-[#991B1B] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buka di Google Maps
                </a>
              </>
            ) : mapUrl ? (
              // URL peta ada tapi bukan URL embed yang valid -> jangan
              // iframe-kan (akan tampil halaman error "diblokir").
              <div className="w-full h-96 rounded-lg bg-gray-100 flex items-center justify-center">
                <div className="text-center px-6">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 mb-4">
                    Peta tidak dapat ditampilkan di halaman ini.
                  </p>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary px-6 py-3 inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka di Google Maps
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-96 rounded-lg bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Peta belum tersedia</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
