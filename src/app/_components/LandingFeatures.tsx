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
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: Shield,
      title: "Terpercaya",
      description: "Dipercaya oleh ratusan pelanggan sejak tahun 2015",
      color: "from-green-500 to-green-600",
    },
    {
      icon: Truck,
      title: "Pengiriman Cepat",
      description: "Layanan pengiriman ke seluruh wilayah dengan cepat",
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: Headphones,
      title: "Customer Support",
      description: "Tim support siap membantu Anda 24/7",
      color: "from-orange-500 to-orange-600",
    },
    {
      icon: Clock,
      title: "Stok Lengkap",
      description: "Stok selalu tersedia untuk kebutuhan proyek Anda",
      color: "from-pink-500 to-pink-600",
    },
    {
      icon: ThumbsUp,
      title: "Harga Kompetitif",
      description: "Harga terbaik dengan kualitas terjamin",
      color: "from-indigo-500 to-indigo-600",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 relative overflow-hidden">
      {/* Decorative Circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Mengapa Memilih <span className="text-gradient">Kami?</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full mb-6" />
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
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
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}