"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Package,
  Volume2,
  AlertCircle,
  Image as ImageIcon,
  X,
} from "lucide-react";
import Link from "next/link";

interface Category { id: string; name: string; }
interface SubCategory { id: string; name: string; categoryId: string; }
interface Supplier { id: string; code: string; name: string; }
interface Unit { id: string; name: string; }

interface BulkProductRow {
  id: string;
  name: string;
  categoryId: string;
  subCategoryId: string;
  supplierId: string;
  barcode: string;
  description: string;
  minStock: number;
  isActive: boolean;
  buyPrice: number;
  sellPrice: number;
  unitId: string;
  imageUrl: string;
  _status?: "idle" | "success" | "error";
  _error?: string;
  _code?: string;
}

const createEmptyRow = (): BulkProductRow => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  categoryId: "",
  subCategoryId: "",
  supplierId: "",
  barcode: "",
  description: "",
  minStock: 0,
  isActive: true,
  buyPrice: 0,
  sellPrice: 0,
  unitId: "",
  imageUrl: "",
  _status: "idle",
});

interface Props {
  categories: Category[];
  subCategories: SubCategory[];
  suppliers: Supplier[];
  units: Unit[];
}

export function BulkImportClient({ categories, subCategories, suppliers, units }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<BulkProductRow[]>([createEmptyRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<any[] | null>(null);
  
  const [localCategories, setLocalCategories] = useState(categories);
  const [localUnits, setLocalUnits] = useState(units);
  
  const recognitionRef = useRef<any>(null);
  const imageInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // ── Quick Add Kategori & Satuan ──────────────────────────────────────────
  const handleQuickAddCategory = async () => {
    const name = window.prompt("Masukkan nama kategori baru:");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.data) {
         setLocalCategories(prev => [...prev, data.data].sort((a,b) => a.name.localeCompare(b.name)));
      } else {
         alert(data.error || "Gagal menambah kategori");
      }
    } catch {
       alert("Terjadi kesalahan koneksi");
    }
  };

  const handleQuickAddUnit = async () => {
    const name = window.prompt("Masukkan nama satuan baru (misal: box, lusin):");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.data) {
         setLocalUnits(prev => [...prev, data.data].sort((a,b) => a.name.localeCompare(b.name)));
      } else {
         alert(data.error || "Gagal menambah satuan");
      }
    } catch {
       alert("Terjadi kesalahan koneksi");
    }
  };

  // ── Voice Input (Otomatis + Manual per Cell) ─────────────────────────────
  const [voiceSession, setVoiceSession] = useState<{
    rowId: string;
    field: string;
    status: "listening" | "processing";
    isSequential: boolean;
  } | null>(null);

  const fieldSequence = [
    { key: "name", label: "Nama Produk", parse: (t: string) => t },
    { key: "categoryId", label: "Kategori", parse: (t: string) => {
        const lowerT = t.toLowerCase().trim();
        const found = localCategories.find(c => 
           c.name.toLowerCase() === lowerT || 
           c.name.toLowerCase().includes(lowerT) || 
           lowerT.includes(c.name.toLowerCase()) || 
           lowerT.split(/\s+/).some(w => w.length > 2 && c.name.toLowerCase().includes(w))
        );
        return found ? found.id : "";
    } },
    { key: "unitId", label: "Satuan", parse: (t: string) => {
        let normalized = t.toLowerCase().trim();
        if (normalized.includes("pis") || normalized.includes("pises") || normalized === "pc" || normalized === "pes") normalized = "pcs";
        if (normalized.includes("kilo")) normalized = "kg";
        if (normalized.includes("mili")) normalized = "ml";
        
        const found = localUnits.find(u => 
           u.name.toLowerCase() === normalized || 
           u.name.toLowerCase().includes(normalized) || 
           normalized.includes(u.name.toLowerCase())
        );
        return found ? found.id : "";
    } },
    { key: "buyPrice", label: "Harga Beli", parse: (t: string) => parseFloat(t.replace(/[^\d]/g, "")) || 0 },
    { key: "sellPrice", label: "Harga Jual", parse: (t: string) => parseFloat(t.replace(/[^\d]/g, "")) || 0 },
    { key: "supplierId", label: "Supplier", parse: (t: string) => {
        const lowerT = t.toLowerCase().trim();
        if (!lowerT || lowerT === "kosong" || lowerT === "lewat") return "";
        const found = suppliers.find(s => 
           s.name.toLowerCase() === lowerT || 
           s.name.toLowerCase().includes(lowerT) || 
           lowerT.includes(s.name.toLowerCase())
        );
        return found ? found.id : "";
    } },
    { key: "minStock", label: "Min Stok", parse: (t: string) => parseInt(t.replace(/[^\d]/g, "")) || 0 },
  ];

  const getNextEmptyField = (row: BulkProductRow, currentField?: string): string | null => {
    const seq = fieldSequence.map(f => f.key);
    const startIndex = currentField ? seq.indexOf(currentField) + 1 : 0;
    
    for (let i = startIndex; i < seq.length; i++) {
       const f = seq[i] as keyof BulkProductRow;
       const val = row[f];
       // Deteksi kosong
       if (val === undefined || val === null || val === "" || (typeof val === "number" && val === 0)) {
           return f;
       }
    }
    return null;
  };

  const startVoice = useCallback((rowId: string, field: string, isSequential: boolean = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung Voice Input. Gunakan Chrome atau Edge.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      try { recognitionRef.current.abort(); } catch(e){}
    }

    setVoiceSession({ rowId, field, status: "listening", isSequential });

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      if (recognitionRef.current) recognitionRef.current._lastTranscript = t;
    };

    recognition.onend = () => {
      const t = recognitionRef.current?._lastTranscript;
      if (t) {
        setVoiceSession((prev) => prev ? { ...prev, status: "processing" } : null);
        
        setTimeout(() => {
          const fieldDef = fieldSequence.find(f => f.key === field);
          const parsedValue = fieldDef ? fieldDef.parse(t) : t;
          
          let nextFieldToStart: string | null = null;

          setRows(currentRows => {
             const updatedRows = currentRows.map((r) => {
                if (r.id === rowId) {
                   if (parsedValue !== "" && parsedValue !== 0 && parsedValue !== undefined) {
                      return { ...r, [field]: parsedValue };
                   }
                }
                return r;
             });

             if (isSequential) {
                const targetRow = updatedRows.find(r => r.id === rowId);
                if (targetRow) {
                   nextFieldToStart = getNextEmptyField(targetRow, field);
                }
             }
             return updatedRows;
          });

          setTimeout(() => {
             if (isSequential && nextFieldToStart) {
                startVoice(rowId, nextFieldToStart, true);
             } else {
                setVoiceSession(null);
             }
          }, 100);

        }, 400); // jeda sedikit agar user melihat kolom terisi
      } else {
        setVoiceSession(null);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech Recognition Error:", e.error);
      if (e.error === "not-allowed" || e.error === "aborted") {
         setVoiceSession(null);
      }
    };

    recognitionRef.current = recognition;
    recognitionRef.current._lastTranscript = "";
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setVoiceSession(null);
    }
  }, [localCategories, localUnits, suppliers]);

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      try { recognitionRef.current.stop(); } catch(e){}
    }
    setVoiceSession(null);
  };

  const getInputClass = (rowId: string, field: string) => {
    const isActive = voiceSession?.rowId === rowId && voiceSession?.field === field;
    return `w-full glass-input text-sm py-1.5 pr-9 transition-all duration-300 ${isActive ? "ring-2 ring-purple-500 bg-purple-50 border-purple-300 shadow-inner" : ""}`;
  };

  const FieldWrapper = ({ rowId, field, children }: { rowId: string, field: string, children: React.ReactNode }) => {
    const isActive = voiceSession?.rowId === rowId && voiceSession?.field === field;
    const label = fieldSequence.find(f => f.key === field)?.label || "";

    return (
      <div className="relative flex items-center w-full">
        {isActive && (
          <div className="absolute top-11 left-0 bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg animate-bounce whitespace-nowrap z-[100] flex items-center gap-1.5 font-medium">
            <div className="absolute -top-1 left-4 w-2.5 h-2.5 bg-purple-600 rotate-45"></div>
            {voiceSession.status === "listening" ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {voiceSession.status === "listening" ? `Sebutkan ${label}...` : `Memproses...`}
          </div>
        )}
        <div className="w-full relative flex items-center">
           {children}
           <button
             type="button"
             onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
             onClick={(e) => {
               e.preventDefault();
               e.stopPropagation();
               if (isActive) stopVoiceInput();
               else startVoice(rowId, field, false);
             }}
             className={`absolute right-1 p-1.5 rounded-md transition-all z-10 flex-shrink-0 ${
               isActive ? "text-purple-600 bg-purple-100 animate-pulse" : "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
             }`}
             title={`Dikte ${label}`}
           >
             {isActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
           </button>
        </div>
      </div>
    );
  };

  // ── Row Operations ───────────────────────────────────────────
  const updateRow = (id: string, field: keyof BulkProductRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const duplicateRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const newRow = { ...row, id: Math.random().toString(36).slice(2), name: row.name + " (copy)", _status: "idle" as const };
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  // ── Image Upload & Compress ─────────────────────────────────────────────
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            } else {
              reject(new Error("Gagal mengkompresi gambar"));
            }
          }, "image/jpeg", 0.7);
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (rowId: string, file: File) => {
    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressedFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) updateRow(rowId, "imageUrl", data.url);
    } catch {
      alert("Gagal upload gambar");
    }
  };

  // ── Save All ─────────────────────────────────────────────────
  const handleSaveAll = async () => {
    const validRows = rows.filter((r) => r.name && r.categoryId && r.unitId);
    if (validRows.length === 0) {
      alert("Minimal 1 produk harus diisi lengkap (nama, kategori, satuan)");
      return;
    }

    setIsSaving(true);
    setSaveResults(null);

    try {
      const payload = validRows.map((r) => ({
        name: r.name,
        barcode: r.barcode || null,
        description: r.description || null,
        categoryId: r.categoryId,
        subCategoryId: r.subCategoryId || null,
        supplierId: r.supplierId || null,
        minStock: r.minStock,
        isActive: r.isActive,
        units: r.unitId
          ? [{ unitId: r.unitId, conversionValue: 1, buyPrice: r.buyPrice, sellPrice: r.sellPrice, isPrimary: true }]
          : [],
        images: r.imageUrl ? [{ imageUrl: r.imageUrl, isPrimary: true }] : [],
      }));

      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: payload }),
      });

      const data = await res.json();
      setSaveResults(data.results || []);

      if (data.results) {
        let resultIndex = 0;
        setRows((prev) =>
          prev.map((r) => {
            // Cocokkan dengan kondisi validRows di atas
            if (r.name && r.categoryId && r.unitId) {
              const result = data.results[resultIndex];
              resultIndex++;
              if (!result) return r;
              return { ...r, _status: result.success ? "success" : "error", _error: result.error, _code: result.code };
            }
            return r;
          })
        );
      }
    } catch (err) {
      alert("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const successCount = saveResults?.filter((r) => r.success).length || 0;
  const failCount = saveResults?.filter((r) => !r.success).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <Link href="/dashboard/products" className="btn-secondary whitespace-nowrap flex-shrink-0 mt-1 sm:mt-0">
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Kembali</span>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" />
            Import Massal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Gunakan <strong>Voice Input</strong> dengan klik ikon Mic di dalam kolom, atau klik Mic biru di kanan untuk otomatis.
          </p>
        </div>
      </div>

      {/* Save Results Banner */}
      {saveResults && (
        <div className={`rounded-xl p-4 border flex items-center gap-3 ${
          failCount === 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
        }`}>
          {failCount === 0 ? (
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          )}
          <div>
            <p className="font-bold text-gray-900">
              {successCount} produk berhasil disimpan
              {failCount > 0 && `, ${failCount} gagal`}
            </p>
            <p className="text-sm text-gray-500">
              Produk yang berhasil sudah tersimpan ke database
            </p>
          </div>
          {failCount === 0 && (
            <button
              onClick={() => router.push("/dashboard/products")}
              className="ml-auto btn-primary"
            >
              Lihat Produk
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-visible">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Daftar Produk ({rows.length})</h2>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-visible pb-24" style={{ minHeight: "350px" }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-3 w-8">#</th>
                <th className="px-3 py-3 min-w-[180px]">Nama Produk *</th>
                <th className="px-3 py-3 min-w-[150px]">
                  <div className="flex items-center justify-between">
                     <span>Kategori *</span>
                     <button onClick={handleQuickAddCategory} className="p-1 hover:bg-gray-200 rounded text-blue-600 transition-colors" title="Tambah Kategori Baru">
                        <Plus className="w-3.5 h-3.5" />
                     </button>
                  </div>
                </th>
                <th className="px-3 py-3 min-w-[130px]">
                  <div className="flex items-center justify-between">
                     <span>Satuan *</span>
                     <button onClick={handleQuickAddUnit} className="p-1 hover:bg-gray-200 rounded text-blue-600 transition-colors" title="Tambah Satuan Baru">
                        <Plus className="w-3.5 h-3.5" />
                     </button>
                  </div>
                </th>
                <th className="px-3 py-3 min-w-[130px]">Harga Beli</th>
                <th className="px-3 py-3 min-w-[130px]">Harga Jual</th>
                <th className="px-3 py-3 min-w-[150px]">Supplier</th>
                <th className="px-3 py-3 min-w-[110px]">Min Stok</th>
                <th className="px-3 py-3 min-w-[80px]">Gambar</th>
                <th className="px-3 py-3 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    row._status === "success"
                      ? "bg-green-50/50"
                      : row._status === "error"
                      ? "bg-red-50/50"
                      : "hover:bg-gray-50/50"
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    {row._status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    ) : row._status === "error" ? (
                      <span title={row._error || "Error"}>
                        <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs font-medium">{idx + 1}</span>
                    )}
                  </td>

                  {/* Nama */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="name">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, "name", e.target.value)}
                        placeholder="Nama produk..."
                        className={getInputClass(row.id, "name")}
                      />
                    </FieldWrapper>
                    {row._status === "error" && row._error && (
                      <p className="text-xs text-red-600 mt-0.5">{row._error}</p>
                    )}
                  </td>

                  {/* Kategori */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="categoryId">
                      <select
                        value={row.categoryId}
                        onChange={(e) => updateRow(row.id, "categoryId", e.target.value)}
                        className={getInputClass(row.id, "categoryId")}
                      >
                        <option value="">Pilih...</option>
                        {localCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                  </td>

                  {/* Satuan */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="unitId">
                      <select
                        value={row.unitId}
                        onChange={(e) => updateRow(row.id, "unitId", e.target.value)}
                        className={getInputClass(row.id, "unitId")}
                      >
                        <option value="">Pilih...</option>
                        {localUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                  </td>

                  {/* Harga Beli */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="buyPrice">
                      <input
                        type="number"
                        min={0}
                        value={row.buyPrice || ""}
                        onChange={(e) => updateRow(row.id, "buyPrice", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={getInputClass(row.id, "buyPrice")}
                      />
                    </FieldWrapper>
                  </td>

                  {/* Harga Jual */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="sellPrice">
                      <input
                        type="number"
                        min={0}
                        value={row.sellPrice || ""}
                        onChange={(e) => updateRow(row.id, "sellPrice", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={getInputClass(row.id, "sellPrice")}
                      />
                    </FieldWrapper>
                  </td>

                  {/* Supplier */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="supplierId">
                      <select
                        value={row.supplierId}
                        onChange={(e) => updateRow(row.id, "supplierId", e.target.value)}
                        className={getInputClass(row.id, "supplierId")}
                      >
                        <option value="">- Kosong -</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                  </td>

                  {/* Min Stok */}
                  <td className="px-2 py-1.5 relative">
                    <FieldWrapper rowId={row.id} field="minStock">
                      <input
                        type="number"
                        min={0}
                        value={row.minStock}
                        onChange={(e) => updateRow(row.id, "minStock", parseInt(e.target.value) || 0)}
                        className={getInputClass(row.id, "minStock")}
                      />
                    </FieldWrapper>
                  </td>

                  {/* Gambar */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      {row.imageUrl ? (
                        <div className="relative">
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="w-9 h-9 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => updateRow(row.id, "imageUrl", "")}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={(el) => { imageInputRefs.current[row.id] = el; }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(row.id, file);
                            }}
                          />
                          <button
                            onClick={() => imageInputRefs.current[row.id]?.click()}
                            className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                            title="Upload gambar (opsional)"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Aksi */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                           e.preventDefault();
                           const active = voiceSession?.rowId === row.id && voiceSession.isSequential;
                           if (active) {
                              stopVoiceInput();
                           } else {
                              const nextField = getNextEmptyField(row) || "name";
                              startVoice(row.id, nextField, true);
                           }
                        }}
                        className={`p-2 rounded-lg transition-all shadow-sm ${
                          voiceSession?.rowId === row.id && voiceSession?.isSequential
                            ? "bg-purple-600 text-white animate-pulse ring-2 ring-purple-300" 
                            : "bg-gradient-to-br from-blue-600 to-purple-600 text-white hover:scale-105"
                        }`}
                        title={voiceSession?.rowId === row.id && voiceSession?.isSequential ? "Stop Voice Otomatis" : "Mulai Voice Otomatis (Cari Kolom Kosong)"}
                      >
                        {voiceSession?.rowId === row.id && voiceSession?.isSequential ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => duplicateRow(row.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Duplikasi baris"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 text-purple-500" />
              Tip: Hover (arahkan mouse) ke dalam kotak input untuk melihat Mic manual, atau gunakan tombol biru di kanan untuk otomatis.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addRow} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" />
              Tambah Baris
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Menyimpan {rows.filter(r => r.name).length} produk...</span></>
              ) : (
                <><Upload className="w-4 h-4" /><span>Simpan Semua ({rows.filter(r => r.name && r.categoryId && r.unitId).length} valid)</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
