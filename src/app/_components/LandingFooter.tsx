import { Heart } from "lucide-react";
import Link from "next/link";

interface Props {
  store: {
    name: string;
    tagline?: string | null;
  } | null;
}

export default function LandingFooter({ store }: Props) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-3">
              {store?.name || "TB Masdar Utama"}
            </h3>
            <p className="text-gray-400 mb-4">
              {store?.tagline || "Distributor Bahan Bangunan Terpercaya"}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Menu</h4>
            <ul className="space-y-2">
              {["Home", "Tentang Kami", "Produk", "Kontak"].map((item) => (
                <li key={item}>
                  <a
                    href={`#${item.toLowerCase().replace(" ", "-")}`}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Admin Login */}
          <div>
            <h4 className="font-semibold mb-3">Admin</h4>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Login Dashboard
            </Link>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
          <p className="flex items-center justify-center gap-2">
            © {currentYear} {store?.name || "TB Masdar Utama"} • Made with{" "}
            <Heart className="w-4 h-4 text-red-500 fill-current" /> by Your Team
          </p>
        </div>
      </div>
    </footer>
  );
}