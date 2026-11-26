"use client";

import { Building2, Users, Award, TrendingUp } from "lucide-react";

interface Props {
  content: string;
}

export default function LandingAbout({ content }: Props) {
  const stats = [
    { icon: Building2, label: "Tahun Berpengalaman", value: "10+" },
    { icon: Users, label: "Pelanggan Setia", value: "500+" },
    { icon: Award, label: "Produk Berkualitas", value: "1000+" },
    { icon: TrendingUp, label: "Pertumbuhan", value: "25%" },
  ];

  return (
    <section id="about" className="py-20 relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FFFFFF' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-stone-100 mb-4">
            Tentang <span className="text-[#E5484D]">Kami</span>
          </h2>
          <div className="w-24 h-1 bg-[#7F1D1D] mx-auto rounded-full" />
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Text Content */}
          <div className="glass-card p-8 animate-slide-up animation-delay-200">
            <div className="prose prose-lg max-w-none text-stone-300 leading-relaxed whitespace-pre-line">
              {content}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6 animate-slide-up animation-delay-400">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-white/[0.08] flex items-center justify-center">
                  <stat.icon className="w-8 h-8 text-[#E5484D]" />
                </div>
                <div className="text-3xl font-bold text-stone-100 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-stone-400 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}