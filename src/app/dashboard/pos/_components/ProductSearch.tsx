"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Search, Barcode, Loader2, ScanBarcode } from "lucide-react";
import { BarcodeScannerModal } from "./BarcodeScannerModal";

interface ProductSearchProps {
  onSearch: (query: string) => void;
  onBarcodeScanned: (barcode: string) => void;
  // BUG #25 (batch 1b): Enter di kolom pencarian utama harus memasukkan
  // produk ke keranjang kalau hasil pencarian tinggal satu produk (atau
  // cocok persis dengan kode/barcode) — sebelumnya Enter hanya memfilter
  // grid dan tidak menambah apa pun.
  onSearchEnter?: (query: string) => void;
  isLoading?: boolean;
}
export interface ProductSearchHandle {
  focus: () => void;
}
export const ProductSearch = forwardRef<ProductSearchHandle, ProductSearchProps>(
  function ProductSearch({ onSearch, onBarcodeScanned, onSearchEnter, isLoading }, ref) {
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // ✅ Debounce search - tunggu 500ms setelah user berhenti ketik
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        onSearch(searchQuery.trim());
      } else {
        onSearch(""); // Load all products if search empty
      }
    }, 500); // ✅ 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);
  useImperativeHandle(ref, () => ({
      focus: () => {
        searchInputRef.current?.focus();
      },
    }));
  // Barcode scanner detection
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if user is typing in search input
      if (document.activeElement === searchInputRef.current) {
        return;
      }

      // Detect barcode scanner (rapid key presses ending with Enter)
      if (e.key === "Enter" && barcodeBuffer.length > 0) {
        e.preventDefault();
        onBarcodeScanned(barcodeBuffer);
        setBarcodeBuffer("");
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
      } else if (e.key.length === 1) {
        // Accumulate characters
        setBarcodeBuffer((prev) => prev + e.key);

        // Clear buffer after 100ms of no input (human typing is slower)
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
        barcodeTimerRef.current = setTimeout(() => {
          setBarcodeBuffer("");
        }, 100);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
    };
  }, [barcodeBuffer, onBarcodeScanned]);

  return (
    <div className="glass-card p-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearchEnter?.(searchQuery.trim());
            }
          }}
          placeholder="Cari produk (nama/kode) atau scan barcode..."
          className="w-full pl-10 md:pl-12 pr-24 py-2 md:py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F1D1D] text-sm md:text-base"
        />
        {isLoading ? (
          <Loader2 className="absolute right-14 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7F1D1D] animate-spin" />
        ) : (
          <Barcode className="absolute right-14 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        )}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#7F1D1D] hover:bg-[rgba(127,29,29,0.06)]"
          title="Scan barcode pakai kamera"
          aria-label="Scan barcode pakai kamera"
        >
          <ScanBarcode className="w-5 h-5" />
        </button>
      </div>

      {/* Search Tips */}
      <div className="mt-2 flex items-center gap-4 text-xs text-stone-500">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-stone-100 rounded font-mono">F2</kbd>
          <span>Focus pencarian</span>
        </div>
        <div className="flex items-center gap-1">
          <Barcode className="w-3 h-3" />
          <span>Scan barcode otomatis terdeteksi</span>
        </div>
        <div className="flex items-center gap-1">
          <ScanBarcode className="w-3 h-3" />
          <span>atau scan pakai kamera</span>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={onBarcodeScanned}
      />
    </div>
  );
}
);