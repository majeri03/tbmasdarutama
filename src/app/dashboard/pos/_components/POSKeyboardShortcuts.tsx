"use client";

import { useEffect } from "react";

interface POSKeyboardShortcutsProps {
  onSearchFocus: () => void;
  onCheckout: () => void;
  onClearCart: () => void;
  canCheckout: boolean;
}

export function POSKeyboardShortcuts({
  onSearchFocus,
  onCheckout,
  onClearCart,
  canCheckout,
}: POSKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // F2 - Focus search
      if (e.key === "F2") {
        e.preventDefault();
        onSearchFocus();
      }

      // F9 - Checkout
      if (e.key === "F9" && canCheckout) {
        e.preventDefault();
        onCheckout();
      }

      // F12 - Clear cart
      if (e.key === "F12") {
        e.preventDefault();
        if (confirm("Kosongkan keranjang?")) {
          onClearCart();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onSearchFocus, onCheckout, onClearCart, canCheckout]);

  return (
    <div className="hidden md:block fixed bottom-4 left-4 glass-card p-3 text-xs text-gray-600 shadow-lg">
      <p className="font-semibold text-gray-900 mb-1">Shortcut Keyboard:</p>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-0.5 bg-gray-200 rounded text-[10px] font-mono">F2</kbd>
          <span>Focus Pencarian</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-0.5 bg-gray-200 rounded text-[10px] font-mono">F9</kbd>
          <span>Checkout</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-0.5 bg-gray-200 rounded text-[10px] font-mono">F12</kbd>
          <span>Kosongkan Keranjang</span>
        </div>
      </div>
    </div>
  );
}