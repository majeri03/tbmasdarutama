"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Search, Barcode, Loader2 } from "lucide-react";

interface ProductSearchProps {
  onSearch: (query: string) => void;
  onBarcodeScanned: (barcode: string) => void;
  isLoading?: boolean;
}
export interface ProductSearchHandle {
  focus: () => void;
}
export const ProductSearch = forwardRef<ProductSearchHandle, ProductSearchProps>(
  function ProductSearch({ onSearch, onBarcodeScanned, isLoading }, ref) {
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari produk (nama/kode) atau scan barcode..."
          className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
        {isLoading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 animate-spin" />
        ) : (
          <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Search Tips */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">F2</kbd>
          <span>Focus pencarian</span>
        </div>
        <div className="flex items-center gap-1">
          <Barcode className="w-3 h-3" />
          <span>Scan barcode otomatis terdeteksi</span>
        </div>
      </div>
    </div>
  );
}
);