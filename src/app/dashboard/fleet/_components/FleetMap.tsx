// Peta armada live — tanpa dependensi peta baru. Tile OpenStreetMap
// dirender langsung (rumus slippy map), marker dari posisi terakhir
// kendaraan (GET /api/fleet/vehicles, polling 15 detik, sama seperti APK).
// Posisi dikirim dari HP sopir (POST /api/fleet/location, ADMIN+).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Navigation, RefreshCw, Plus, Minus, Truck, Clock } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType?: string | null;
  brand?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  lastLocationAt?: string | null;
}

const TILE = 256;
const DEFAULT_CENTER = { lat: -5.147, lng: 119.43 }; // Makassar
const POLL_MS = 15000;

function lngToX(lng: number, z: number) {
  return ((lng + 180) / 360) * TILE * Math.pow(2, z);
}
function latToY(lat: number, z: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z)
  );
}
function xToLng(x: number, z: number) {
  return (x / (TILE * Math.pow(2, z))) * 360 - 180;
}
function yToLat(y: number, z: number) {
  const n = Math.PI * (1 - (2 * y) / (TILE * Math.pow(2, z)));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function statusColor(status?: string | null) {
  if (status === "ACTIVE") return "bg-green-500";
  if (status === "IDLE") return "bg-amber-500";
  return "bg-gray-400";
}

export function FleetMap() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet/vehicles");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setVehicles(json.data);
        setLastUpdate(new Date());
        setError("");
      } else {
        setError(json.message || "Gagal memuat data armada");
      }
    } catch {
      setError("Gagal memuat data armada");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
    const t = setInterval(loadVehicles, POLL_MS);
    return () => clearInterval(t);
  }, [loadVehicles]);

  // Ukur ukuran wadah peta supaya tile yang dirender pas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ w: el.clientWidth || 800, h: el.clientHeight || 520 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centerPx = lngToX(center.lng, zoom);
  const centerPy = latToY(center.lat, zoom);
  const x0 = Math.floor((centerPx - size.w / 2) / TILE);
  const x1 = Math.floor((centerPx + size.w / 2) / TILE);
  const y0 = Math.floor((centerPy - size.h / 2) / TILE);
  const y1 = Math.floor((centerPy + size.h / 2) / TILE);
  const tiles: Array<{ x: number; y: number; left: number; top: number }> = [];
  const maxTile = Math.pow(2, zoom) - 1;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y > maxTile) continue;
      const wrappedX = ((x % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
      tiles.push({
        x: wrappedX,
        y,
        left: x * TILE - centerPx + size.w / 2,
        top: y * TILE - centerPy + size.h / 2,
      });
    }
  }

  const withLocation = vehicles.filter(
    (v) => typeof v.latitude === "number" && typeof v.longitude === "number"
  );
  const selected = vehicles.find((v) => v.id === selectedId) || null;

  const focusVehicle = (v: Vehicle) => {
    if (typeof v.latitude === "number" && typeof v.longitude === "number") {
      setCenter({ lat: v.latitude, lng: v.longitude });
      setZoom(Math.max(zoom, 14));
      setSelectedId(v.id);
    }
  };

  const recenter = () => {
    if (withLocation.length > 0) {
      const lat =
        withLocation.reduce((s, v) => s + (v.latitude || 0), 0) / withLocation.length;
      const lng =
        withLocation.reduce((s, v) => s + (v.longitude || 0), 0) / withLocation.length;
      setCenter({ lat, lng });
    } else {
      setCenter(DEFAULT_CENTER);
    }
  };

  // Geser peta dengan drag mouse/sentuhan.
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, lat: center.lat, lng: center.lng };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const newX = lngToX(d.lng, zoom) - dx;
    const newY = latToY(d.lat, zoom) - dy;
    setCenter({ lat: yToLat(newY, zoom), lng: xToLng(newX, zoom) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Armada &amp; GPS Live</h1>
          <p className="page-subtitle">
            Posisi terakhir kendaraan — diperbarui otomatis tiap 15 detik dari HP sopir
          </p>
        </div>
        <button onClick={loadVehicles} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Peta */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div
            ref={containerRef}
            className="relative w-full h-[520px] bg-[#aad3df] overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
                <div className="spinner-large" />
              </div>
            ) : (
              <>
                {tiles.map((t) => (
                  <img
                    key={`${t.x}-${t.y}-${zoom}`}
                    src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
                    alt=""
                    draggable={false}
                    className="absolute w-[256px] h-[256px] max-w-none"
                    style={{ left: t.left, top: t.top }}
                  />
                ))}
                {withLocation.map((v) => {
                  const left = lngToX(v.longitude as number, zoom) - centerPx + size.w / 2;
                  const top = latToY(v.latitude as number, zoom) - centerPy + size.h / 2;
                  const active = v.id === selectedId;
                  return (
                    <button
                      key={v.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(v.id);
                      }}
                      className="absolute z-10 -translate-x-1/2 -translate-y-full"
                      style={{ left, top }}
                      title={`${v.plateNumber} — ${v.driverName || "-"}`}
                    >
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg whitespace-nowrap ${
                          active ? "bg-blue-600 ring-2 ring-white" : "bg-gray-800/90"
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        {v.plateNumber}
                      </span>
                      <span
                        className={`block w-3 h-3 mx-auto rounded-full border-2 border-white ${statusColor(
                          v.status
                        )}`}
                      />
                    </button>
                  );
                })}
              </>
            )}

            {/* Kontrol zoom */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(18, z + 1))}
                className="w-9 h-9 bg-white rounded-lg shadow flex items-center justify-center hover:bg-gray-50"
                aria-label="Perbesar"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(5, z - 1))}
                className="w-9 h-9 bg-white rounded-lg shadow flex items-center justify-center hover:bg-gray-50"
                aria-label="Perkecil"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={recenter}
                className="w-9 h-9 bg-white rounded-lg shadow flex items-center justify-center hover:bg-gray-50"
                aria-label="Pusatkan ke armada"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute bottom-2 left-2 z-20 text-[11px] bg-white/80 px-2 py-0.5 rounded">
              © OpenStreetMap contributors
              {lastUpdate && (
                <span className="text-gray-500">
                  {" • "}update {format(lastUpdate, "HH:mm:ss")}
                </span>
              )}
            </div>
          </div>

          {selected && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-gray-900">
                    {selected.plateNumber} — {selected.brand || selected.vehicleType || "-"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Sopir: {selected.driverName || "-"}
                    {selected.driverPhone ? ` (${selected.driverPhone})` : ""}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {selected.address || "Alamat tidak diketahui"}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold text-white ${statusColor(
                    selected.status
                  )}`}
                >
                  {selected.status || "-"}
                </span>
              </div>
              {selected.lastLocationAt && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Lokasi terakhir:{" "}
                  {format(new Date(selected.lastLocationAt), "dd MMM yyyy, HH:mm", {
                    locale: localeId,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Daftar kendaraan */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Kendaraan ({vehicles.length})
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500">Memuat...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-gray-500">
              Belum ada kendaraan. Tambah kendaraan lewat menu Pengaturan / API armada.
            </p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => {
                const hasLoc =
                  typeof v.latitude === "number" && typeof v.longitude === "number";
                return (
                  <button
                    key={v.id}
                    onClick={() => focusVehicle(v)}
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      v.id === selectedId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{v.plateNumber}</p>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${statusColor(v.status)}`}
                        title={v.status || ""}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      {v.brand || v.vehicleType || "-"} • {v.driverName || "Tanpa sopir"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {hasLoc
                        ? v.address || `${v.latitude}, ${v.longitude}`
                        : "Belum ada lokasi GPS"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Lokasi dikirim otomatis dari HP sopir yang login sebagai ADMIN saat tombol
            &quot;Mulai GPS&quot; di APK aktif.
          </p>
        </div>
      </div>
    </div>
  );
}
