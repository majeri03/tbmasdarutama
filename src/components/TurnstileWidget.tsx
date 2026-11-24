"use client";

import { useEffect, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/actions/turnstile.actions";

// Widget Cloudflare Turnstile (gratis) — hardening 24 Nov 2026.
// Dipakai form web: login, lupa password, reset password, verifikasi email.
// - Kalau site key belum diisi (Turnstile belum dipasang), widget TIDAK
//   tampil dan onToken(null) — form tetap jalan (fail open).
// - Kalau site key ada tapi script Cloudflare gagal dimuat, tampil pesan
//   kecil; submit tanpa token akan ditolak server (fail closed).
// - resetSignal: naikkan setelah tiap submit supaya widget menerbitkan
//   token baru (token Turnstile tidak boleh dipakai dua kali).

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export default function TurnstileWidget({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTurnstileSiteKey()
      .then((key) => {
        if (cancelled) return;
        setSiteKey(key);
        setChecked(true);
        if (!key) onTokenRef.current(null);
      })
      .catch(() => {
        if (cancelled) return;
        setChecked(true);
        onTokenRef.current(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!checked || !siteKey || !containerRef.current) return;
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => {
            setLoadError(true);
            onTokenRef.current(null);
          },
        });
      } catch {
        setLoadError(true);
      }
    };
    if (window.turnstile) {
      renderWidget();
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      script.onerror = () => setLoadError(true);
      document.head.appendChild(script);
    } else {
      existing.addEventListener("load", renderWidget, { once: true });
    }
    return () => {
      cancelled = true;
    };
  }, [checked, siteKey]);

  // Terbitkan token baru setelah tiap submit.
  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Abaikan — token lama kedaluwarsa sendiri.
      }
      onTokenRef.current(null);
    }
  }, [resetSignal]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Abaikan.
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Belum dicek / belum dipasang: tidak tampil apa-apa (fail open).
  if (!checked || !siteKey) return null;

  return (
    <div>
      <div ref={containerRef} />
      {loadError && (
        <p className="text-xs text-red-500 mt-1">
          Verifikasi keamanan tidak bisa dimuat. Periksa koneksi lalu muat
          ulang halaman.
        </p>
      )}
    </div>
  );
}
