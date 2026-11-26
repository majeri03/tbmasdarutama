"use client";

import { CheckCircle, Shield, Truck, Headphones, Clock, ThumbsUp } from "lucide-react";

interface Props {
  content: string;
}

export default function LandingFeatures({ content }: Props) {
  const features = [
    {
      icon: CheckCircle,
      title: "Produk Berkualitas",
      description: "Hanya menjual produk original dan berkualitas tinggi",
    },
    {
      icon: Shield,
      title: "Terpercaya",
      description: "Dipercaya oleh ratusan pelanggan sejak tahun 2015",
    },
    {
      icon: Truck,
      title: "Pengiriman Cepat",
      description: "Layanan pengiriman ke seluruh wilayah dengan cepat",
    },
    {
      icon: Headphones,
      title: "Customer Support",
      description: "Tim support siap membantu Anda 24/7",
    },
    {
      icon: Clock,
      title: "Stok Lengkap",
      description: "Stok selalu tersedia untuk kebutuhan proyek Anda",
    },
    {
      icon: ThumbsUp,
      title: "Harga Kompetitif",
      description: "Harga terbaik dengan kualitas terjamin",
    },
  ];

  return (
    <section className="py-20 bg-[#FAFAF8] relative overflow-hidden">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1C1917] mb-4">
            Mengapa Memilih <span className="text-[#7F1D1D]">Kami?</span>
          </h2>
          <div className="w-24 h-1 bg-[#7F1D1D] mx-auto rounded-full mb-6" />
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            {content}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass-card p-8 hover:scale-105 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
                <feature.icon className="w-8 h-8 text-[#7F1D1D]" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-[#1C1917] mb-3">
                {feature.title}
              </h3>
              <p className="text-stone-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}