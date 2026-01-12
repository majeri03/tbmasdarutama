"use client";

import { useState, useEffect } from "react";
import { Menu, X, Phone, Mail, LogIn } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Props {
  store: {
    name: string;
    logoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

export default function LandingNavbar({ store }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#home", label: "Home" },
    { href: "#about", label: "Tentang Kami" },
    { href: "#products", label: "Produk" },
    { href: "#contact", label: "Kontak" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-card shadow-lg backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            {store?.logoUrl ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/20 group-hover:ring-blue-400 transition-all">
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {store?.name.charAt(0) || "T"}
              </div>
            )}
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                {store?.name || "TB Masdar Utama"}
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}

            {/* Contact Info */}
            {store?.phone && (
              <a
                href={`tel:${store.phone}`}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">{store.phone}</span>
              </a>
            )}

            {/* Login Button */}
            <Link href="/login" className="btn-primary btn-sm">
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-gray-800" />
            ) : (
              <Menu className="w-6 h-6 text-gray-800" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden glass-card border-t">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}

            {store?.phone && (
              <a
                href={`tel:${store.phone}`}
                className="flex items-center gap-2 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                {store.phone}
              </a>
            )}

            {store?.email && (
              <a
                href={`mailto:${store.email}`}
                className="flex items-center gap-2 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {store.email}
              </a>
            )}

            <Link href="/login" className="btn-primary w-full mt-4">
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}