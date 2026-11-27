"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Package, Search, Camera, Loader2 } from "lucide-react";
import { createDeliveryOrder } from "@/lib/actions/delivery-order.actions";
import { getCustomers } from "@/lib/actions/customer.actions";
import { getProducts } from "@/lib/actions/product.actions";
import { getSales } from "@/lib/actions/sale.actions";
import { getFleetVehicles, FleetVehicleOption } from "@/lib/actions/fleet.actions";
import { useToast, Toast } from "@/components/ui/toast";

interface DeliveryOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface SaleOption {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  saleDate: Date;
  customer: {
    code: string;
    name: string;
    type: string;
  } | null;
  saleItems: Array<{
    id: string;
    productId: string;
    unitId: string;
    quantity: number;
    product: {
      code: string;
      name: string;
    };
    unit: {
      id: string;
      name: string;
      symbol: string | null;
    };
  }>;
  deliveryOrder?: {
    id: string;
    doNumber: string;
    status: string;
  } | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  units: Array<{
    id: string;
    unitId: string;
    unit: {
      id: string;
      name: string;
      symbol: string;
    };
  }>;
}

// UPDATE: Tambahkan availableUnits agar dropdown unit tidak hilang saat searching
interface DeliveryItem {
  productId: string;
  unitId: string;
  quantity: number;
  notes: string;
  productName?: string;
  unitName?: string;
  availableUnits?: Product["units"]; // Simpan opsi unit disini
}

export function DeliveryOrderFormModal({
  isOpen,
  onClose,
  onSuccess,
}: DeliveryOrderFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesList, setSalesList] = useState<SaleOption[]>([]);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleSearching, setSaleSearching] = useState(false);
  const [saleDropdownOpen, setSaleDropdownOpen] = useState(false);
  const saleSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [fleetList, setFleetList] = useState<FleetVehicleOption[]>([]);
  const { toast, showToast, hideToast } = useToast();
  // State untuk teks input pencarian
  const [searchProducts, setSearchProducts] = useState<string[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<DeliveryItem[]>([
    { productId: "", unitId: "", quantity: 1, notes: "" },
  ]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset saat tutup modal
      setProducts([]);
      setSearchProducts([]);
      setSalesList([]);
      setFleetList([]);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      // Penjualan TIDAK dimuat di sini lagi: dulu 100 sale berat dimuat tiap
      // buka modal, dan sale di luar 100 terbaru tidak bisa dipilih sama
      // sekali. Sekarang sale hanya dicari saat user mengetik (lihat
      // handleSaleSearchChange) — 0 request saat buka, max 10 hasil per cari.
      const [customersResult, fleetResult] = await Promise.all([
        getCustomers({ status: "ACTIVE" }),
        getFleetVehicles(),
      ]);

      if (customersResult.success && customersResult.data) {
        setCustomers(customersResult.data);
      }

      if (fleetResult.success && fleetResult.data) {
        setFleetList(fleetResult.data);
      }

      // Reset form
      setSelectedSaleId("");
      setSaleSearch("");
      setSalesList([]);
      setSaleDropdownOpen(false);
      setSearchProducts([""]);
      setItems([{ productId: "", unitId: "", quantity: 1, notes: "" }]);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { productId: "", unitId: "", quantity: 1, notes: "" },
    ]);
    setSearchProducts([...searchProducts, ""]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
      setSearchProducts(searchProducts.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof DeliveryItem,
    value: string | number
  ) => {
    const newItems = [...items];

    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "productId") {
      // Cari produk dari hasil pencarian saat ini
      const product = products.find((p) => p.id === value);

      if (product) {
        newItems[index].unitId = "";
        newItems[index].productName = product.name;

        // PENTING: Simpan daftar unit ke dalam item itu sendiri
        // Agar saat user mencari produk lain, unit baris ini tidak hilang
        newItems[index].availableUnits = product.units;

        // Update teks input agar sesuai nama produk yang dipilih
        const newSearch = [...searchProducts];
        newSearch[index] = `${product.code} - ${product.name}`;
        setSearchProducts(newSearch);
      }
    }

    setItems(newItems);
  };

  const handleSearchChange = (index: number, value: string) => {
    // 1. Update teks input segera
    const newSearch = [...searchProducts];
    newSearch[index] = value;
    setSearchProducts(newSearch);

    // 2. Debounce Search ke Server
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        // Hanya cari jika ada teks, kalau kosong jangan panggil server
        if (!value.trim()) return;

        const result = await getProducts({
          search: value,
          limit: 20 // Ambil 20 hasil teratas
        });

        if (result.success && result.data) {
          // Mapping data
          const mappedProducts = result.data.map((product) => ({
            id: product.id,
            code: product.code,
            name: product.name,
            units: product.productUnits.map((pu) => ({
              id: pu.id,
              unitId: pu.unitId,
              unit: {
                id: pu.unit.id,
                name: pu.unit.name,
                symbol: pu.unit.symbol || "",
              },
            })),
          }));

          // Update state global products (hanya untuk dropdown)
          setProducts(mappedProducts);
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }, 400); // Tunggu 400ms
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar (JPG, PNG, WebP)", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 5MB", "error");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "proofs_delivery");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Gagal mengupload foto");
      }

      setProofImage(data.url);
      showToast("Foto bukti pengiriman berhasil diunggah", "success");
    } catch (err) {
      console.error("[Upload Proof Error]", err);
      showToast(err instanceof Error ? err.message : "Gagal mengunggah foto bukti", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Pencarian penjualan server-side (debounce 400ms, pola sama dengan
  // pencarian produk di bawah). Cari No. Invoice atau nama pelanggan.
  const handleSaleSearchChange = (value: string) => {
    setSaleSearch(value);
    setSaleDropdownOpen(true);
    if (saleSearchTimeout.current) {
      clearTimeout(saleSearchTimeout.current);
    }
    if (!value.trim() || value.trim().length < 2) {
      setSalesList([]);
      setSaleSearching(false);
      return;
    }
    setSaleSearching(true);
    saleSearchTimeout.current = setTimeout(async () => {
      try {
        const result = await getSales({ search: value.trim(), limit: 10, sortOrder: "desc" });
        if (result.success && result.data) {
          // Filter yang sama seperti dulu: buang batal/return & yang sudah punya DO aktif
          const availableSales = (result.data as any[]).filter((s) => {
            if (s.status === "CANCELLED" || s.status === "RETURN") return false;
            if (s.deliveryOrder && s.deliveryOrder.status !== "CANCELLED") return false;
            return true;
          });
          setSalesList(availableSales as SaleOption[]);
        }
      } catch (error) {
        console.error("Search sale error:", error);
      } finally {
        setSaleSearching(false);
      }
    }, 400);
  };

  const handleSaleSelect = (saleId: string) => {
    setSelectedSaleId(saleId);
    setSaleDropdownOpen(false);
    if (!saleId) return;

    const selectedSale = salesList.find((s) => s.id === saleId);
    if (!selectedSale) return;

    setSaleSearch(
      `${selectedSale.invoiceNumber} • ${selectedSale.customer?.name || "Pelanggan"}`
    );

    // 1. Sinkron Customer
    if (selectedSale.customerId) {
      setCustomerId(selectedSale.customerId);
    }

    // 2. Sinkron Items dari Penjualan
    if (selectedSale.saleItems && selectedSale.saleItems.length > 0) {
      const newItems: DeliveryItem[] = selectedSale.saleItems.map((si) => ({
        productId: si.productId,
        unitId: si.unitId,
        quantity: Number(si.quantity),
        notes: `Dari Faktur: ${selectedSale.invoiceNumber}`,
        productName: si.product?.name,
        unitName: si.unit?.name,
        availableUnits: [
          {
            id: si.unitId,
            unitId: si.unitId,
            unit: {
              id: si.unit?.id || si.unitId,
              name: si.unit?.name || "",
              symbol: si.unit?.symbol || "",
            },
          },
        ],
      }));
      setItems(newItems);
      setSearchProducts(
        selectedSale.saleItems.map(
          (si) => `${si.product?.code || ""} - ${si.product?.name || ""}`
        )
      );
    }
  };

  const handleDriverSelect = (driverName: string) => {
    setDriver(driverName);
    // Jika sopir ini terhubung dengan armada di database, otomatis isi kendaraannya
    if (driverName) {
      const match = fleetList.find(
        (f) => f.driverName.toLowerCase().trim() === driverName.toLowerCase().trim()
      );
      if (match && match.plateNumber) {
        const vehicleDesc = match.brand
          ? `${match.plateNumber} (${match.brand})`
          : match.plateNumber;
        setVehicle(vehicleDesc);
      }
    }
  };

  const handleVehicleSelect = (plateVal: string) => {
    setVehicle(plateVal);
    // Jika kendaraan dipilih, otomatis isi sopirnya jika tersedia
    if (plateVal) {
      const match = fleetList.find((f) => {
        const desc = f.brand ? `${f.plateNumber} (${f.brand})` : f.plateNumber;
        return f.plateNumber === plateVal || desc === plateVal;
      });
      if (match && match.driverName && !driver) {
        setDriver(match.driverName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Cegah double click

    setIsLoading(true);

    try {
      const validItems = items.filter(
        (item) => item.productId && item.unitId && item.quantity > 0
      );

      if (validItems.length === 0) {
        showToast("Tambahkan minimal 1 item yang lengkap", "error");
        setIsLoading(false);
        return;
      }

      if (!customerId) {
        showToast("Pilih customer terlebih dahulu", "error");
        setIsLoading(false);
        return;
      }

      const result = await createDeliveryOrder({
        customerId,
        saleId: selectedSaleId || undefined,
        deliveryDate: new Date(deliveryDate),
        driver: driver || undefined,
        vehicle: vehicle || undefined,
        notes: notes || undefined,
        proofImage: proofImage || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          quantity: Number(item.quantity),
          notes: item.notes || undefined,
        })),
      });

      if (result.success) {
        const autoInv = (result.data as any)?.autoInvoiceNumber as string | undefined;
        showToast(
          autoInv
            ? `${result.message || "Surat jalan berhasil dibuat"} Invoice otomatis: ${autoInv} (jatuh tempo 30 hari).`
            : result.message || "Surat jalan berhasil dibuat",
          "success"
        );
        onSuccess();
        onClose();
        resetForm();
      } else {
        showToast(result.error || "Gagal membuat surat jalan", "error");
      }
    } catch (error) {
      console.error("Error creating delivery order:", error);
      showToast("Terjadi kesalahan sistem", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSaleId("");
    setSaleSearch("");
    setSalesList([]);
    setSaleDropdownOpen(false);
    setCustomerId("");
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDriver("");
    setVehicle("");
    setNotes("");
    setProofImage("");
    setItems([{ productId: "", unitId: "", quantity: 1, notes: "" }]);
    setSearchProducts([""]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#1C1917] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold tracking-tight text-stone-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#E5484D]" />
            Buat Surat Jalan Baru
          </h2>
          <button onClick={onClose} className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
          {/* Section: Pilih Penjualan POS (Otomatis DO) */}
          <div className="p-4 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#E5484D]">
                Pilih Dari Transaksi Penjualan (DO Otomatis)
              </label>
              {selectedSaleId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSaleId("");
                    setSaleSearch("");
                    setSalesList([]);
                    setSaleDropdownOpen(false);
                    setItems([{ productId: "", unitId: "", quantity: 1, notes: "" }]);
                    setSearchProducts([""]);
                  }}
                  className="text-xs text-[#E5484D] hover:text-red-300 underline font-medium"
                >
                  Reset / Buat DO Manual
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={saleSearch}
                onChange={(e) => handleSaleSearchChange(e.target.value)}
                onFocus={() => {
                  if (salesList.length > 0) setSaleDropdownOpen(true);
                }}
                placeholder="Ketik No. Invoice / nama pelanggan... (min. 2 huruf, kosong = DO Manual)"
                className="w-full px-3 py-2 bg-[#1C1917] border border-[#E5484D]/40 rounded-xl text-sm text-stone-200 focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all font-medium"
              />
              {saleDropdownOpen &&
                (saleSearching || salesList.length > 0 || saleSearch.trim().length >= 2) && (
                  <div className="absolute z-20 mt-1 w-full bg-[#1C1917] border border-[#E5484D]/30 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {saleSearching ? (
                      <div className="px-3 py-2 text-sm text-stone-400">Mencari...</div>
                    ) : salesList.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-stone-400">
                        Tidak ada transaksi yang cocok. Coba kata kunci lain, atau kosongkan untuk DO Manual.
                      </div>
                    ) : (
                      salesList.map((sale) => (
                        <button
                          type="button"
                          key={sale.id}
                          onClick={() => handleSaleSelect(sale.id)}
                          className="w-full text-left px-3 py-2 hover:bg-[#E5484D]/10 text-sm text-stone-200 border-b border-white/10 last:border-b-0"
                        >
                          <span className="font-semibold">{sale.invoiceNumber}</span> •{" "}
                          {sale.customer?.name || "Pelanggan"}
                          <span className="block text-xs text-stone-400">
                            {new Date(sale.saleDate).toLocaleDateString("id-ID")} • Rp{" "}
                            {Number((sale as any).grandTotal || 0).toLocaleString("id-ID")} •{" "}
                            {(sale as any).status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
            </div>
            <p className="text-xs text-red-300">
              {selectedSaleId
                ? "✓ Data customer dan barang terisi otomatis dari transaksi penjualan yang dipilih."
                : "💡 Anda juga bisa membuat DO secara manual tanpa memilih penjualan (invoice & hutang otomatis terbuat dan tersinkron)."}
            </p>
          </div>

          {/* Customer & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-4 rounded-xl border border-white/10">
            <div>
              <label className="label mb-1.5">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={!!selectedSaleId}
                title={selectedSaleId ? "Pelanggan terkunci dari invoice yang dipilih" : undefined}
                className="w-full px-3 py-2 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all disabled:bg-white/10 disabled:text-stone-400 [color-scheme:dark]"
                required
              >
                <option value="">Pilih Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </option>
                ))}
              </select>
              {selectedSaleId && (
                <p className="text-xs text-red-300 mt-1">
                  Pelanggan terkunci dari invoice yang dipilih. Pilih "Reset / Buat DO Manual" untuk mengganti.
                </p>
              )}
            </div>

            <div>
              <label className="label mb-1.5">
                Tanggal Kirim <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all [color-scheme:dark]"
                required
              />
            </div>

            {/* Driver & Vehicle: Dropdown Database Armada */}
            <div>
              <label className="label mb-1.5">
                Pengemudi / Sopir (Fitur Armada)
              </label>
              <select
                value={driver}
                onChange={(e) => handleDriverSelect(e.target.value)}
                className="w-full px-3 py-2 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all [color-scheme:dark]"
              >
                <option value="">-- Pilih Sopir dari Armada --</option>
                {Array.from(new Set(fleetList.map((f) => f.driverName).filter(Boolean))).map(
                  (dName) => {
                    const match = fleetList.find((f) => f.driverName === dName);
                    return (
                      <option key={dName} value={dName}>
                        {dName} {match ? `(${match.plateNumber}${match.brand ? ` - ${match.brand}` : ""})` : ""}
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            <div>
              <label className="label mb-1.5">
                Kendaraan / Plat Nomor (Fitur Armada)
              </label>
              <select
                value={vehicle}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="w-full px-3 py-2 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all [color-scheme:dark]"
              >
                <option value="">-- Pilih Kendaraan dari Armada --</option>
                {fleetList.map((f) => {
                  const desc = f.brand ? `${f.plateNumber} (${f.brand})` : f.plateNumber;
                  return (
                    <option key={f.id} value={desc}>
                      {desc} — Sopir: {f.driverName || "-"}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="label">
                Daftar Barang
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#E5484D]/10 text-[#E5484D] rounded-xl hover:bg-[#E5484D]/15 transition-colors border border-[#E5484D]/30"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baris
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="relative bg-white/5 p-4 rounded-xl border border-white/10 shadow-sm hover:border-[#E5484D]/40 transition-all">

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute -top-2 -right-2 p-1.5 bg-[#1C1917] text-red-500 border border-red-500/20 rounded-full shadow-sm hover:bg-red-500/10 z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                    {/* 1. PRODUCT SEARCH (Input Text + Datalist) */}
                    <div className="md:col-span-5 relative">
                      <label className="block text-xs font-medium text-stone-400 mb-1">Produk</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        <input
                          type="text"
                          value={searchProducts[index] || ""}
                          onChange={(e) => handleSearchChange(index, e.target.value)}
                          onFocus={() => handleSearchChange(index, searchProducts[index] || "")}
                          className="w-full pl-9 pr-3 py-2 border border-white/15 rounded-xl text-sm focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D]"
                          placeholder="Ketik nama produk..."
                          list={`products-${index}`}
                        />
                        {/* Datalist hanya untuk suggest, value asli di-set lewat onInput/onChange event logic di atas */}
                        <datalist id={`products-${index}`}>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.code} - {product.name}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {/* --- FIX UTAMA: HAPUS SELECT HIDDEN DISINI --- */}
                      {/* Kita ganti dengan logika custom dropdown manual jika datalist bermasalah, 
                          tapi untuk sekarang kita pakai trick mapping ID */}

                      {/* Helper UI: Jika produk ada di hasil search, tampilkan tombol pilih manual (opsional tapi membantu UX) */}
                      {searchProducts[index] && !item.productId && products.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1C1917] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {products.map((product) => (
                            <div
                              key={product.id}
                              className="px-4 py-2 text-sm hover:bg-[#E5484D]/10 cursor-pointer border-b border-white/10 last:border-0"
                              onClick={() => {
                                // Set Product ID manual saat diklik
                                handleItemChange(index, "productId", product.id);
                              }}
                            >
                              <span className="font-bold">{product.code}</span> - {product.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. UNIT (Dropdown) */}
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-stone-400 mb-1">Satuan</label>
                      <select
                        value={item.unitId}
                        onChange={(e) => handleItemChange(index, "unitId", e.target.value)}
                        className="w-full px-3 py-2 border border-white/15 rounded-xl text-sm bg-white/5 [color-scheme:dark]"
                        required
                        disabled={!item.productId}
                      >
                        <option value="">Pilih</option>
                        {/* --- FIX: AMBIL UNIT DARI ITEM SENDIRI --- */}
                        {(item.availableUnits || []).map((pu) => (
                          <option key={pu.unitId} value={pu.unitId}>
                            {pu.unit.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. QTY (No Decimal) */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-stone-400 mb-1">Jumlah</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="w-full px-3 py-2 border border-white/15 rounded-xl text-sm text-center"
                        min="1"
                        step="1"
                        required
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>

                    {/* 4. NOTES */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-stone-400 mb-1">Catatan</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                        className="w-full px-3 py-2 border border-white/15 rounded-xl text-sm"
                        placeholder="..."
                      />
                    </div>
                    {/* Notes / Catatan Keseluruhan */}
                  </div>
                </div>
              ))}
                    <div className="mt-6">
                      <label className="label mb-2">
                        Catatan Pengiriman
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-white/15 rounded-xl text-sm focus:ring-2 focus:ring-[#E5484D]/30 focus:border-[#E5484D] transition-all"
                        rows={3}
                        placeholder="Catatan tambahan untuk pengiriman (opsional)"
                      />
                    </div>

                    {/* Foto Bukti Pengiriman */}
                    <div className="mt-6">
                      <label className="label mb-2">
                        Foto Bukti Pengiriman (Opsional)
                      </label>
                      <p className="text-xs text-stone-400 mb-2">
                        Unggah foto bukti muat barang / pengiriman (Maksimal 5MB, format JPG/PNG/WebP)
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />

                      {proofImage ? (
                        <div className="relative inline-block border rounded-xl overflow-hidden shadow-sm bg-white/5 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={proofImage}
                            alt="Bukti Pengiriman"
                            className="w-48 h-36 object-cover rounded-xl"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className="px-2.5 py-1 text-xs bg-white/10 text-stone-100 font-medium rounded shadow hover:bg-white/15"
                            >
                              Ganti
                            </button>
                            <button
                              type="button"
                              onClick={() => setProofImage("")}
                              disabled={isUploading}
                              className="px-2.5 py-1 text-xs bg-red-900 text-white font-medium rounded shadow hover:bg-red-800"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-full py-4 border-2 border-dashed border-white/15 rounded-xl hover:border-[#E5484D] hover:bg-[#E5484D]/10 transition-colors flex flex-col items-center justify-center gap-2 text-stone-400 cursor-pointer disabled:opacity-50"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin text-[#E5484D]" />
                              <span className="text-sm font-medium text-[#E5484D]">Mengunggah foto bukti...</span>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-full bg-[#E5484D]/10 flex items-center justify-center text-[#E5484D]">
                                <Camera className="w-5 h-5" />
                              </div>
                              <span className="text-sm font-medium">Klik untuk upload foto bukti pengiriman</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white/5 border-t border-white/10 pt-4 mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-300 bg-white/10 border border-white/15 rounded-xl hover:bg-white/15 transition-colors"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit" // Trigger handleSubmit
              className="px-6 py-2 text-sm font-medium text-white bg-red-900 rounded-xl hover:bg-red-800 transition-colors flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? "Memproses..." : "Simpan Surat Jalan"}
            </button>
          </div>
        </form>
        {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    )}
      </div>
    </div>
  );
}