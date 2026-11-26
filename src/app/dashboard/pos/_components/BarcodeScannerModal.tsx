// Scan barcode/QR pakai kamera HP/laptop — tanpa dependensi baru.
// Memakai BarcodeDetector bawaan browser (Chrome/Edge di Android & desktop).
// Kalau browser tidak mendukung, tetap ada input manual sebagai fallback.

"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, Loader2, Keyboard } from "lucide-react";

// BarcodeDetector belum ada di lib.dom TypeScript — deklarasi minimal lokal.
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

export function isCameraScanSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    getBarcodeDetector() !== null
  );
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

const FORMATS = ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"];

export function BarcodeScannerModal({ isOpen, onClose, onScanned }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scannedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "unsupported" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStatus("idle");
      setErrorMessage("");
      setManualCode("");
      scannedRef.current = false;
      return;
    }

    const start = async () => {
      const Detector = getBarcodeDetector();
      if (!Detector) {
        setStatus("unsupported");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("scanning");

        const detector = new Detector({ formats: FORMATS });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        intervalRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || scannedRef.current || !ctx) return;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const codes = await detector.detect(canvas);
            if (codes.length > 0 && codes[0].rawValue) {
              scannedRef.current = true;
              const code = codes[0].rawValue;
              stopCamera();
              onScanned(code);
              onClose();
            }
          } catch {
            // frame gagal dibaca — coba lagi di interval berikutnya
          }
        }, 400);
      } catch (err) {
        setStatus("error");
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setErrorMessage("Izin kamera ditolak. Izinkan akses kamera di browser, lalu coba lagi.");
        } else if (err instanceof DOMException && err.name === "NotFoundError") {
          setErrorMessage("Tidak ada kamera yang ditemukan di perangkat ini.");
        } else {
          setErrorMessage("Kamera tidak bisa dibuka. Periksa izin browser.");
        }
      }
    };

    start();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    onScanned(code);
    onClose();
  };

  return (
    <div className="modal-overlay z-[60]">
      <div className="modal-container w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E5484D]" />
            Scan Barcode / QR
          </h2>
          <button onClick={onClose} className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {status === "starting" && (
            <div className="aspect-video bg-stone-900 rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}

          {(status === "scanning" || status === "starting") && (
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {status === "scanning" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-3/4 h-1/2 border-2 border-green-500/50 rounded-xl" />
                </div>
              )}
              <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white bg-black/70 py-1">
                Arahkan kamera ke barcode / QR produk
              </p>
            </div>
          )}

          {status === "unsupported" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300">
              Browser ini tidak mendukung scan kamera (butuh BarcodeDetector —
              Chrome/Edge terbaru). Pakai input manual di bawah atau scanner
              barcode fisik (ketik + Enter).
            </div>
          )}

          {status === "error" && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Fallback input manual — selalu ada */}
          <div>
            <label className="label mb-1">
              <Keyboard className="w-4 h-4 inline mr-1" />
              Atau ketik kode manual
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                }}
                placeholder="Kode / barcode produk..."
                className="flex-1 px-3 py-2 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E5484D]"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-red-900 text-white rounded-xl hover:bg-red-800 disabled:opacity-50"
              >
                Cari
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
