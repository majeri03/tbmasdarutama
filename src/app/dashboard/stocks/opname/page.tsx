// Stock Opname web — sesi hitung stok: cari/scan produk, isi jumlah hasil
// hitungan, selisih vs stok sistem tampil live, simpan lewat
// createStockAdjustment yang sudah ada (ADJUSTMENT = stok akhir; kalau
// hasil hitungan 0, dipakai OUT sebesar stok sistem supaya stok jadi 0 —
// skema adjustment menolak quantity 0).

"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ScanBarcode, Trash2, ClipboardCheck, Loader2, Save } from "lucide-react";
import { getProducts } from "@/lib/actions/product.actions";
import {
  createStockAdjustment,
  getStockMovements,
} from "@/lib/actions/stock.actions";
import { BarcodeScannerModal } from "@/app/dashboard/pos/_components/BarcodeScannerModal";
import PageGuard from "@/components/PageGuard";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Product {
  id: string;
  code: string;
  name: string;
  barcode?: string | null;
  currentStock: number;
  productUnits: Array<{
    unit: { name: string; symbol: string | null };
    isPrimary: boolean;
  }>;
}

interface OpnameRow {
  productId: string;
  code: string;
  name: string;
  unitName: string;
  systemStock: number;
  counted: number | "";
}

interface RecentMovement {
  id: string;
  createdAt: string | Date;
  quantity: number;
  type: string;
  notes?: string | null;
  product: { name: string; code: string };
}

function primaryUnitName(p: Product): string {
  const primary = p.productUnits?.find((u) => u.isPrimary) || p.productUnits?.[0];
  return primary?.unit?.symbol || primary?.unit?.name || "";
}

export default function StockOpnamePage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [rows, setRows] = useState<OpnameRow[]>([]);
  const [sessionNote, setSessionNote] = useState("Stock Opname");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [recent, setRecent] = useState<RecentMovement[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await getStockMovements({ page: 1, limit: 20 });
      if (res.success && res.data) {
        setRecent(
          (res.data as unknown as RecentMovement[]).filter((m) =>
            (m.notes || "").includes("Stock Opname")
          )
        );
      }
    } catch {
      // riwayat opsional — gagal memuat tidak menghalangi opname
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const searchProducts = useCallback(async (query: string) => {
    const res = await getProducts({ search: query, limit: 20, isActive: true });
    if (res.success && res.data) setResults(res.data as unknown as Product[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim()) searchProducts(search.trim());
      else setResults([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, searchProducts]);

  const addProduct = (p: Product) => {
    if (rows.some((r) => r.productId === p.id)) {
      setSearch("");
      setShowResults(false);
      return;
    }
    setRows([
      ...rows,
      {
        productId: p.id,
        code: p.code,
        name: p.name,
        unitName: primaryUnitName(p),
        systemStock: p.currentStock,
        counted: "",
      },
    ]);
    setSearch("");
    setShowResults(false);
  };

  const handleScanned = (code: string) => {
    setSearch(code);
    setShowResults(true);
    void searchProducts(code);
  };

  const updateCounted = (productId: string, value: string) => {
    const num = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, counted: num } : r))
    );
  };

  const changedRows = rows.filter(
    (r) => r.counted !== "" && r.counted !== r.systemStock
  );

  const handleSubmit = async () => {
    setError("");
    setResult("");
    if (changedRows.length === 0) {
      setError("Belum ada produk yang jumlah hitungannya berbeda dari stok sistem.");
      return;
    }
    setSaving(true);
    const ok: string[] = [];
    const failed: string[] = [];
    const note = sessionNote.trim() || "Stock Opname";
    for (const row of changedRows) {
      const counted = row.counted as number;
      try {
        const res =
          counted === 0
            ? await createStockAdjustment({
                productId: row.productId,
                type: "OUT",
                quantity: row.systemStock,
                notes: `${note} — ${row.name} (hasil hitung 0)`,
                referenceType: "Stock Opname",
              })
            : await createStockAdjustment({
                productId: row.productId,
                type: "ADJUSTMENT",
                quantity: counted,
                notes: `${note} — ${row.name}`,
                referenceType: "Stock Opname",
              });
        if (res.success) ok.push(row.name);
        else failed.push(`${row.name}: ${res.error || "gagal"}`);
      } catch {
        failed.push(`${row.name}: gagal`);
      }
    }
    // Perbarui stok sistem untuk baris yang berhasil disimpan.
    if (ok.length > 0) {
      const refreshed = await Promise.all(
        rows.map(async (r) => {
          if (!ok.includes(r.name)) return r;
          const res = await getProducts({ search: r.code, limit: 5, isActive: true });
          const p = (res.data as unknown as Product[] | undefined)?.find(
            (x) => x.code === r.code
          );
          return p ? { ...r, systemStock: p.currentStock, counted: "" as const } : r;
        })
      );
      setRows(refreshed);
      loadRecent();
    }
    setResult(
      `Tersimpan: ${ok.length} produk.${failed.length > 0 ? ` Gagal: ${failed.join("; ")}` : ""}`
    );
    if (failed.length > 0) setError(failed.join("; "));
    setSaving(false);
  };

  return (
    <PageGuard pageKey="stock_opname">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            Stock Opname
          </h1>
          <p className="page-subtitle">
            Hitung stok fisik, isi jumlahnya — selisih terhadap stok sistem langsung
            terlihat, lalu simpan sekaligus.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {result}
          </div>
        )}

        {/* Cari produk */}
        <div className="glass-card p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Cari produk (nama / kode / barcode)..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showResults && results.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.code} • Stok sistem: {p.currentStock} {primaryUnitName(p)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="btn-secondary whitespace-nowrap"
            >
              <ScanBarcode className="w-4 h-4" />
              Scan
            </button>
          </div>
          <div className="mt-3">
            <label className="label">Catatan sesi opname</label>
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              className="input-field"
              placeholder="Stock Opname"
            />
          </div>
        </div>

        {/* Daftar opname */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-center text-gray-500 py-12">
                Belum ada produk. Cari produk di atas atau scan barcode untuk menambahkannya.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Stok Sistem</th>
                    <th className="text-right">Hasil Hitungan</th>
                    <th className="text-right">Selisih</th>
                    <th className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const diff =
                      row.counted === "" ? null : row.counted - row.systemStock;
                    return (
                      <tr key={row.productId}>
                        <td>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-gray-500">{row.code}</p>
                        </td>
                        <td className="text-right">
                          {row.systemStock} {row.unitName}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.counted}
                            onChange={(e) => updateCounted(row.productId, e.target.value)}
                            placeholder="0"
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td
                          className={`text-right font-semibold ${
                            diff === null
                              ? "text-gray-400"
                              : diff === 0
                                ? "text-gray-500"
                                : diff > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                          }`}
                        >
                          {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() =>
                              setRows(rows.filter((r) => r.productId !== row.productId))
                            }
                            className="text-red-500 hover:text-red-700"
                            aria-label="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 0 && (
            <div className="p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {changedRows.length} dari {rows.length} produk berubah
              </p>
              <button
                onClick={handleSubmit}
                disabled={saving || changedRows.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Opname ({changedRows.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Riwayat opname terakhir */}
        {recent.length > 0 && (
          <div className="glass-card p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Opname Terakhir</h2>
            <div className="space-y-2">
              {recent.slice(0, 10).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{m.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(m.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                      {m.notes ? ` • ${m.notes}` : ""}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${
                      m.type === "IN" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {m.type === "IN" ? "+" : "-"}
                    {m.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanned={handleScanned}
        />
      </div>
    </PageGuard>
  );
}
