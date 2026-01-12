"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  landing: {
    heroTitle: string;
    heroSubtitle: string;
    heroImages: Array<{
      id: string;
      imageUrl: string;
      order: number;
    }>;
  } | null;
}

export default function LandingHero({ landing }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = landing?.heroImages || [];
  const hasImages = images.length > 0;

  useEffect(() => {
    if (!hasImages) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [hasImages, images.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Carousel */}
      {hasImages ? (
        <>
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={image.imageUrl}
                alt={`Hero ${index + 1}`}
                fill
                className="object-cover"
                priority={index === 0}
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
            </div>
          ))}

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 glass-card p-3 hover:scale-110 transition-transform"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 glass-card p-3 hover:scale-110 transition-transform"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>

              {/* Dots Indicator */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-white w-8"
                        : "bg-white/50 hover:bg-white/70"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        // Fallback gradient background
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500" />
      )}

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-slide-up">
          {landing?.heroTitle || "TB Masdar Utama"}
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 animate-slide-up animation-delay-200">
          {landing?.heroSubtitle || "Distributor Bahan Bangunan Terpercaya"}
        </p>

        <div className="flex flex-wrap gap-4 justify-center animate-slide-up animation-delay-400">
          <a href="#products" className="btn-primary px-8 py-4 text-lg">
            Lihat Produk
          </a>
          <a href="#contact" className="btn-secondary px-8 py-4 text-lg text-white border-white hover:bg-white/20">
            Hubungi Kami
          </a>
        </div>
      </div>
    </section>
  );
}