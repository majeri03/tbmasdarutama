// Ganti keseluruhan file dengan ini:

"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = "success", duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-stone-400" />,
  };

  const styles = {
    success: "border-green-400/40",
    error: "border-red-400/40",
    info: "border-white/15",
  };

  return (
    <div
      className={`fixed top-6 right-6 z-[9999] glass-card p-4 min-w-[300px] max-w-md animate-slide-up ${styles[type]}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{icons[type]}</div>
        <p className="flex-1 text-sm text-stone-100 font-medium">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-stone-400 hover:text-stone-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Hook untuk menggunakan Toast
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return { toast, showToast, hideToast };
}