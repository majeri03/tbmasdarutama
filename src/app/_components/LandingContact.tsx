"use client";

import { MapPin, Phone, Mail, Clock, Facebook, Instagram } from "lucide-react";

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

export default function LandingContact({ store, mapUrl }: Props) {
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
      color: "from-pink-500 to-purple-600",
    },
    {
      icon: Facebook,
      label: "Facebook",
      value: store?.facebook,
      href: store?.facebook ? `https://facebook.com/${store.facebook}` : null,
      color: "from-blue-500 to-blue-600",
    },
  ];

  return (
    <section id="contact" className="py-20 bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Hubungi <span className="text-gradient">Kami</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full mb-6" />
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Kami siap membantu kebutuhan bahan bangunan Anda
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            {contactInfo.map((info, index) => (
              <div key={index} className="glass-card p-6 hover:scale-105 transition-transform">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <info.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {info.label}
                    </h3>
                    {info.href ? (
                      <a
                        href={info.href}
                        className="text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p className="text-gray-600">{info.value}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Social Media */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
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
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${social.color} flex items-center justify-center hover:scale-110 transition-transform`}
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
            <h3 className="font-semibold text-gray-800 mb-4">
              Lokasi Kami
            </h3>
            {mapUrl ? (
              <iframe
                src={mapUrl}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-lg"
              />
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