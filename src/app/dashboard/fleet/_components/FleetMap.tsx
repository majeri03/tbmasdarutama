// Peta armada live — tanpa dependensi peta baru. Tile OpenStreetMap
// dirender langsung (rumus slippy map), marker dari posisi terakhir
// kendaraan (GET /api/fleet/vehicles, polling 15 detik, sama seperti APK).
// Posisi dikirim dari HP sopir yang ditugaskan lewat
// POST /api/fleet/location saat tombol "Mulai GPS" di APK aktif.
// FIX (22 Nov 2026, rombakan armada): API mengembalikan lokasi BERSARANG
// (lastLocation: {latitude, longitude, address, updatedAt}) — versi lama
// komponen ini membaca v.latitude datar sehingga marker tidak pernah muncul.
// Manajemen kendaraan (tambah/edit/nonaktifkan, SUPER_ADMIN saja —
// WS-1, 25 Nov 2026) juga ditambahkan di halaman ini; seed kendaraan
// contoh sudah dihapus dari API.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Navigation, RefreshCw, Plus, Minus, Truck, Clock, Pencil, Power, X } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useSession } from "next-auth/react";
import { hasMinimumRole } from "@/lib/utils/role";

interface VehicleLocation {
  latitude: number;
  longitude: number;
  address?: string;
  updatedAt: string;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType?: string | null;
  brand?: string | null;
  year?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverUserId?: string | null;
  coDriverUserId?: string | null;
  driverUserName?: string | null;
  coDriverName?: string | null;
  status?: string | null;
  lastLocation?: VehicleLocation | null;
}

interface DriverOption {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
}

interface VehicleForm {
  plateNumber: string;
  vehicleType: string;
  brand: string;
  year: string;
  driverUserId: string;
  coDriverUserId: string;
  driverName: string;
  driverPhone: string;
  status: string;
}

const EMPTY_FORM: VehicleForm = {
  plateNumber: "",
  vehicleType: "PICKUP",
  brand: "",
  year: "",
  driverUserId: "",
  coDriverUserId: "",
  driverName: "",
  driverPhone: "",
  status: "ACTIVE",
};

const TILE = 256;
const DEFAULT_CENTER = { lat: -5.147, lng: 119.43 }; // Makassar
const POLL_MS = 15000;

const VEHICLE_TYPES = ["TRUCK", "PICKUP", "MOTOR", "VAN", "OTHER"];
const VEHICLE_STATUSES = ["ACTIVE", "IDLE", "MAINTENANCE", "OFF"];

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
  if (status === "ACTIVE") return "bg-[#16A34A]";
  if (status === "IDLE") return "bg-[#D97706]";
  return "bg-stone-500";
}

/** Lokasi terakhir kendaraan (bersarang dari API), atau null kalau belum ada GPS. */
function locOf(v: Vehicle): VehicleLocation | null {
  const l = v.lastLocation;
  if (l && typeof l.latitude === "number" && typeof l.longitude === "number") {
    return l;
  }
  return null;
}

/** Waktu relatif dari ISO string, mis. "5 mnt lalu". */
function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "baru saja";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return format(new Date(iso), "dd MMM yyyy, HH:mm", { locale: localeId });
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

  // Manajemen kendaraan (SUPER_ADMIN saja — WS-1, 25 Nov 2026: ADMIN hanya
  // boleh lihat; server juga mengecek di API).
  const { data: session } = useSession();
  const canManage = hasMinimumRole(session, "SUPER_ADMIN");
  // KASIR hanya melihat kendaraannya sendiri (filter server M21) — kalau
  // daftarnya kosong, hampir pasti karena belum ditugaskan, bukan karena
  // belum ada armada. Bedakan pesan empty state-nya (WS-1).
  const isKasir =
    hasMinimumRole(session, "KASIR") && !hasMinimumRole(session, "ADMIN");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const loadDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDrivers(json.data);
      }
    } catch {
      // Dropdown tetap bisa dipakai manual (nama sopir diketik tangan).
    }
  }, []);

  useEffect(() => {
    loadVehicles();
    const t = setInterval(loadVehicles, POLL_MS);
    return () => clearInterval(t);
  }, [loadVehicles]);

  useEffect(() => {
    if (canManage) loadDrivers();
  }, [canManage, loadDrivers]);

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

  const withLocation = vehicles.filter((v) => locOf(v) !== null);
  const selected = vehicles.find((v) => v.id === selectedId) || null;

  const focusVehicle = (v: Vehicle) => {
    const loc = locOf(v);
    if (loc) {
      setCenter({ lat: loc.latitude, lng: loc.longitude });
      setZoom(Math.max(zoom, 14));
      setSelectedId(v.id);
    }
  };

  const recenter = () => {
    if (withLocation.length > 0) {
      const lat =
        withLocation.reduce((s, v) => s + (locOf(v)?.latitude || 0), 0) /
        withLocation.length;
      const lng =
        withLocation.reduce((s, v) => s + (locOf(v)?.longitude || 0), 0) /
        withLocation.length;
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

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType || "PICKUP",
      brand: v.brand || "",
      year: v.year ? String(v.year) : "",
      driverUserId: v.driverUserId || "",
      coDriverUserId: v.coDriverUserId || "",
      driverName: v.driverName || "",
      driverPhone: v.driverPhone || "",
      status: v.status || "ACTIVE",
    });
    setFormError("");
    setShowForm(true);
  };

  // Pilih sopir dari daftar akun: nama + no HP ikut terisi otomatis kalau
  // kolomnya masih kosong (server juga mengisi dari akun bila kosong).
  const onDriverSelect = (field: "driverUserId" | "coDriverUserId", userId: string) => {
    setForm((f) => {
      const next = { ...f, [field]: userId };
      if (field === "driverUserId" && userId) {
        const u = drivers.find((d) => d.id === userId);
        if (u) {
          if (!next.driverName.trim()) next.driverName = u.name;
          if (!next.driverPhone.trim() && u.phone) next.driverPhone = u.phone;
        }
      }
      return next;
    });
  };

  const submitForm = async () => {
    setFormError("");
    if (!form.plateNumber.trim()) {
      setFormError("Nomor plat wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        brand: form.brand.trim() || null,
        year: form.year ? Number(form.year) : null,
        driverUserId: form.driverUserId || null,
        coDriverUserId: form.coDriverUserId || null,
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim() || null,
        status: form.status,
      };
      const res = await fetch(
        editingId ? `/api/fleet/vehicles/${editingId}` : "/api/fleet/vehicles",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) {
        setFormError(json.message || "Gagal menyimpan kendaraan.");
        return;
      }
      setShowForm(false);
      setEditingId(null);
      loadVehicles();
    } catch {
      setFormError("Gagal menyimpan kendaraan.");
    } finally {
      setSaving(false);
    }
  };

  const deactivateVehicle = async (v: Vehicle) => {
    if (
      !window.confirm(
        `Nonaktifkan kendaraan ${v.plateNumber}? Kendaraan tidak tampil di peta, tapi bisa diaktifkan lagi dengan mendaftarkan plat yang sama.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/fleet/vehicles/${v.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Gagal menonaktifkan kendaraan.");
        return;
      }
      if (selectedId === v.id) setSelectedId(null);
      loadVehicles();
    } catch {
      setError("Gagal menonaktifkan kendaraan.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Armada &amp; GPS Live</h1>
          <p className="text-sm text-stone-400">
            Posisi terakhir kendaraan — diperbarui otomatis tiap 15 detik dari HP sopir
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={openAddForm} className="btn-primary">
              <Plus className="w-4 h-4" />
              Tambah Kendaraan
            </button>
          )}
          <button onClick={loadVehicles} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(229,72,77,0.10)] border border-[rgba(229,72,77,0.25)] rounded-lg text-[#E5484D]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Peta */}
        <div className="lg:col-span-2 glass-card overflow-hidden rounded-3xl">
          <div
            ref={containerRef}
            className="relative w-full h-[520px] bg-[#aad3df] overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#141210]/70 z-20">
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
                  const loc = locOf(v)!;
                  const left = lngToX(loc.longitude, zoom) - centerPx + size.w / 2;
                  const top = latToY(loc.latitude, zoom) - centerPy + size.h / 2;
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
                      title={`${v.plateNumber} — ${v.driverName || "-"} • ${timeAgo(loc.updatedAt)}`}
                    >
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg whitespace-nowrap ${
                          active ? "bg-[#7F1D1D] ring-2 ring-white" : "bg-stone-800/90"
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
                className="w-9 h-9 bg-[#211E1B] border border-white/10 rounded-lg shadow-lg text-stone-100 flex items-center justify-center hover:bg-white/10"
                aria-label="Perbesar"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(5, z - 1))}
                className="w-9 h-9 bg-[#211E1B] border border-white/10 rounded-lg shadow-lg text-stone-100 flex items-center justify-center hover:bg-white/10"
                aria-label="Perkecil"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={recenter}
                className="w-9 h-9 bg-[#211E1B] border border-white/10 rounded-lg shadow-lg text-stone-100 flex items-center justify-center hover:bg-white/10"
                aria-label="Pusatkan ke armada"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute bottom-2 left-2 z-20 text-[11px] bg-black/60 text-stone-300 px-2 py-0.5 rounded">
              © OpenStreetMap contributors
              {lastUpdate && (
                <span className="text-stone-400">
                  {" • "}update {format(lastUpdate, "HH:mm:ss")}
                </span>
              )}
            </div>
          </div>

          {selected && (
            <div className="p-4 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-stone-100">
                    {selected.plateNumber} — {selected.brand || selected.vehicleType || "-"}
                  </p>
                  <p className="text-sm text-stone-400">
                    Sopir: {selected.driverName || "-"}
                    {selected.driverPhone ? ` (${selected.driverPhone})` : ""}
                    {selected.coDriverName ? ` • Pendamping: ${selected.coDriverName}` : ""}
                  </p>
                  <p className="text-sm text-stone-400 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {locOf(selected)?.address || "Alamat tidak diketahui"}
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
              {locOf(selected) && (
                <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Lokasi terakhir:{" "}
                  {format(new Date(locOf(selected)!.updatedAt), "dd MMM yyyy, HH:mm", {
                    locale: localeId,
                  })}
                  {" • "}
                  {timeAgo(locOf(selected)!.updatedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Daftar kendaraan */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-stone-100 mb-3">
            Kendaraan ({vehicles.length})
          </h2>
          {loading ? (
            <p className="text-sm text-stone-400">Memuat...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-stone-400">
              {isKasir
                ? "Kamu belum ditugaskan ke kendaraan apa pun — hubungi admin."
                : canManage
                  ? "Belum ada kendaraan. Tekan \"Tambah Kendaraan\" untuk mendaftarkan armada pertama."
                  : "Belum ada kendaraan. Minta SUPER_ADMIN untuk mendaftarkan kendaraan."}
            </p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => {
                const loc = locOf(v);
                return (
                  <div
                    key={v.id}
                    onClick={() => focusVehicle(v)}
                    className={`w-full text-left p-3 border rounded-lg transition-colors cursor-pointer ${
                      v.id === selectedId
                        ? "border-[#E5484D] bg-[rgba(229,72,77,0.08)]"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-stone-100">{v.plateNumber}</p>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${statusColor(v.status)}`}
                        title={v.status || ""}
                      />
                    </div>
                    <p className="text-xs text-stone-400">
                      {v.brand || v.vehicleType || "-"} • {v.driverName || "Tanpa sopir"}
                      {v.coDriverName ? ` • Pendamping: ${v.coDriverName}` : ""}
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      {loc
                        ? `${loc.address || `${loc.latitude}, ${loc.longitude}`} • ${timeAgo(loc.updatedAt)}`
                        : "Belum ada lokasi GPS"}
                    </p>
                    {canManage && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(v);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-[#E5484D] hover:text-[#F87171]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deactivateVehicle(v);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-[#E5484D] hover:text-[#F87171]"
                        >
                          <Power className="w-3.5 h-3.5" />
                          Nonaktifkan
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-stone-400 mt-4">
            Lokasi dikirim otomatis dari HP sopir yang ditugaskan
            saat tombol &quot;Mulai GPS&quot; di APK aktif.
          </p>
        </div>
      </div>

      {/* Form tambah / edit kendaraan (SUPER_ADMIN saja) */}
      {/* WS-3 (perbaikan ke-4): dulu wrapper bg-black/40 + panel
          .glass-card (putih 10% + blur) — di atas peta OSM yang
          TERANG, peta menembus panel dan form tidak terbaca.
          Sekarang pola modal standar: overlay bg-black/80 blur-md
          + panel .modal-container hampir solid (0.98), selaras
          perbaikan kaca modal paket ke-3 item 9. */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-container w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-stone-100">
                {editingId ? "Edit Kendaraan" : "Tambah Kendaraan"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300 hover:bg-white/10"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-[rgba(229,72,77,0.10)] border border-[rgba(229,72,77,0.25)] rounded-lg text-sm text-[#E5484D]">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Nomor Plat *
                </label>
                <input
                  className="input-field w-full uppercase"
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  placeholder="DD 1234 AB"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-1">
                    Jenis Kendaraan
                  </label>
                  <select
                    className="input-field w-full"
                    value={form.vehicleType}
                    onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-1">
                    Status
                  </label>
                  <select
                    className="input-field w-full"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {VEHICLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-1">
                    Merek
                  </label>
                  <input
                    className="input-field w-full"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Mitsubishi Canter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-1">
                    Tahun
                  </label>
                  <input
                    className="input-field w-full"
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="2022"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Sopir Utama (akun)
                </label>
                <select
                  className="input-field w-full"
                  value={form.driverUserId}
                  onChange={(e) => onDriverSelect("driverUserId", e.target.value)}
                >
                  <option value="">— Pilih akun sopir —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.role})
                    </option>
                  ))}
                  {editingId &&
                    form.driverUserId &&
                    !drivers.some((d) => d.id === form.driverUserId) && (
                      <option value={form.driverUserId}>
                        {form.driverName || "Sopir terdaftar"}
                      </option>
                    )}
                </select>
                <p className="text-xs text-stone-400 mt-1">
                  Sopir boleh ADMIN / KASIR — siapa pun yang akunnya dipilih
                  bisa mengirim GPS kendaraan ini dari HP-nya.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Sopir Pendamping (opsional)
                </label>
                <select
                  className="input-field w-full"
                  value={form.coDriverUserId}
                  onChange={(e) => onDriverSelect("coDriverUserId", e.target.value)}
                >
                  <option value="">— Tanpa pendamping —</option>
                  {drivers
                    .filter((d) => d.id !== form.driverUserId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.role})
                      </option>
                    ))}
                  {editingId &&
                    form.coDriverUserId &&
                    !drivers.some((d) => d.id === form.coDriverUserId) && (
                      <option value={form.coDriverUserId}>
                        Sopir pendamping terdaftar
                      </option>
                    )}
                </select>
                <p className="text-xs text-stone-400 mt-1">
                  Untuk dua sopir yang jalan bareng di kendaraan yang sama.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Nama Sopir
                </label>
                <input
                  className="input-field w-full"
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  placeholder="Nama sopir (otomatis dari akun kalau dipilih)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  No HP Sopir
                </label>
                <input
                  className="input-field w-full"
                  value={form.driverPhone}
                  onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Batal
                </button>
                <button onClick={submitForm} className="btn-primary" disabled={saving}>
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Daftarkan Kendaraan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
