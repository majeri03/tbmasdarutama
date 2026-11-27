// Edit transaksi penjualan (web) — memakai PUT /api/sales/[id] yang sudah
// ada (izin EDIT_SALE, ADMIN+). Server menghitung ulang harga dari harga
// master dan selisih stok, jadi harga satuan di form ini hanya tampilan —
// yang bisa diubah: customer, qty, diskon per item, tambah/hapus item,
// metode bayar, jumlah bayar, catatan.
//
// productUnitId tidak diserialisasi getSaleById (model SaleItem hanya punya
// unitId), jadi modal ini mencarinya lewat getProducts berdasarkan kode
// produk saat memuat penjualan.

"use client";

import { useState, useEffect } from "react";
import { X, Search, Trash2, Pencil, Loader2 } from "lucide-react";
import { getSaleById } from "@/lib/actions/sale.actions";
import { getCustomers } from "@/lib/actions/customer.actions";
import { getProducts } from "@/lib/actions/product.actions";
import { PaymentMethod } from "@prisma/client";
import { useToast, Toast } from "@/components/ui/toast";

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  productUnits: Array<{
    id: string;
    unitId: string;
    conversionValue: number;
    sellPrice: number;
    isPrimary: boolean;
    unit: { id: string; name: string; symbol: string | null };
  }>;
}

interface EditItem {
  productId: string;
  productCode: string;
  productName: string;
  productUnitId: string;
  unitId: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface EditSaleModalProps {
  saleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PROOF_TAG_RE = /\[BUKTI_TF\]:\s*[^\s\]\n]+/g;

export function EditSaleModal({ saleId, onClose, onSuccess }: EditSaleModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<EditItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saleStatus, setSaleStatus] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [proofTag, setProofTag] = useState("");
  const [error, setError] = useState("");
  const [unresolvedItems, setUnresolvedItems] = useState<string[]>([]);

  const [searchProduct, setSearchProduct] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // Cari productUnitId dari (productId, unitId) lewat master produk.
  const resolveUnitId = async (productCode: string, unitId: string): Promise<string> => {
    const res = await getProducts({ search: productCode, limit: 5, isActive: true });
    if (res.success && res.data) {
      const product = res.data.find((p) => p.code === productCode) || res.data[0];
      const unit = product?.productUnits?.find((u) => u.unitId === unitId);
      if (unit) return unit.id;
    }
    return "";
  };

  const loadSale = async () => {
    setLoading(true);
    setError("");
    try {
      const [saleRes, custRes] = await Promise.all([
        getSaleById(saleId),
        getCustomers({}),
      ]);
      if (!saleRes.success || !saleRes.data) {
        setError(saleRes.error || "Gagal memuat transaksi");
        return;
      }
      const sale = saleRes.data as unknown as {
        invoiceNumber: string;
        status: string;
        customerId: string;
        paymentMethod: PaymentMethod;
        discount: number;
        tax: number;
        paidAmount: number;
        notes?: string | null;
        saleItems: Array<{
          productId: string;
          unitId: string;
          quantity: number;
          unitPrice: number;
          discount: number;
          subtotal: number;
          product: { code: string; name: string };
          unit: { name: string; symbol?: string | null };
        }>;
      };
      setInvoiceNumber(sale.invoiceNumber);
      setSaleStatus(sale.status);
      setCustomerId(sale.customerId);
      setPaymentMethod(sale.paymentMethod);
      setDiscountAmount(Number(sale.discount) || 0);
      setTaxAmount(Number(sale.tax) || 0);
      setPaidAmount(Number(sale.paidAmount) || 0);

      // Tag bukti transfer dipertahankan terpisah supaya tidak hilang saat edit.
      const rawNotes = sale.notes || "";
      const tags = rawNotes.match(PROOF_TAG_RE) || [];
      setProofTag(tags.join(" "));
      setNotes(rawNotes.replace(PROOF_TAG_RE, "").trim());

      if (custRes.success && custRes.data) setCustomers(custRes.data);

      const unresolved: string[] = [];
      const mapped: EditItem[] = [];
      for (const item of sale.saleItems || []) {
        const productUnitId = await resolveUnitId(item.product.code, item.unitId);
        if (!productUnitId) unresolved.push(item.product.name);
        mapped.push({
          productId: item.productId,
          productCode: item.product.code,
          productName: item.product.name,
          productUnitId,
          unitId: item.unitId,
          unitName: item.unit?.symbol || item.unit?.name || "",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount) || 0,
          subtotal: Number(item.subtotal),
        });
      }
      setItems(mapped);
      setUnresolvedItems(unresolved);
    } catch {
      setError("Gagal memuat transaksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const loadProducts = async (query = "") => {
    const result = await getProducts({ search: query, limit: 20, isActive: true });
    if (result.success && result.data) setProducts(result.data);
  };

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(searchProduct), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchProduct]);

  const addToCart = (product: Product, unitId: string) => {
    const unit = product.productUnits.find((u) => u.unitId === unitId);
    if (!unit) return;
    const existingIndex = items.findIndex(
      (i) => i.productId === product.id && i.unitId === unitId
    );
    if (existingIndex >= 0) {
      const next = [...items];
      next[existingIndex].quantity += 1;
      next[existingIndex].subtotal =
        next[existingIndex].quantity * next[existingIndex].unitPrice -
        next[existingIndex].discount;
      setItems(next);
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          productUnitId: unit.id,
          unitId,
          unitName: unit.unit.symbol || unit.unit.name,
          quantity: 1,
          unitPrice: Number(unit.sellPrice),
          discount: 0,
          subtotal: Number(unit.sellPrice),
        },
      ]);
    }
    setSearchProduct("");
    setShowProductDropdown(false);
  };

  const updateItem = (index: number, field: "quantity" | "discount", value: number) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: Math.max(field === "quantity" ? 1 : 0, value) };
    next[index].subtotal =
      next[index].quantity * next[index].unitPrice - next[index].discount;
    setItems(next);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const totalAmount = items.reduce((s, i) => s + i.subtotal, 0);
  const grandTotal = Math.max(0, totalAmount - discountAmount + taxAmount);
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const notEditable = saleStatus === "CANCELLED" || saleStatus === "RETURN";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("Tambahkan minimal 1 produk");
      return;
    }
    if (!customerId) {
      setError("Pilih customer terlebih dahulu");
      return;
    }
    if (unresolvedItems.length > 0) {
      setError(
        `Satuan produk berikut tidak ditemukan di master, perbaiki data produk dulu: ${unresolvedItems.join(", ")}`
      );
      return;
    }
    if (paymentMethod !== PaymentMethod.CREDIT && paidAmount < grandTotal) {
      setError("Jumlah bayar kurang dari total");
      return;
    }
    setSaving(true);
    try {
      const finalNotes = [notes.trim(), proofTag].filter(Boolean).join(" ") || null;
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: items.map((i) => ({
            productId: i.productId,
            productUnitId: i.productUnitId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            subtotal: i.subtotal,
          })),
          totalAmount,
          discount: discountAmount,
          tax: taxAmount,
          grandTotal,
          paymentMethod,
          paidAmount,
          changeAmount,
          notes: finalNotes,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast("Transaksi berhasil diubah");
        setTimeout(() => onSuccess(), 500);
      } else {
        setError(json.message || json.error || "Gagal mengedit transaksi");
      }
    } catch {
      setError("Gagal mengedit transaksi");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.code.toLowerCase().includes(searchProduct.toLowerCase())
  );

  return (
    <div className="modal-overlay overflow-y-auto">
      <div className="modal-container max-w-4xl animate-modal-slide-up">
        <div className="modal-header bg-amber-600">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Penjualan {invoiceNumber ? `#${invoiceNumber}` : ""}
          </h2>
          <button onClick={onClose} className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-colors" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#E5484D]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}
            {notEditable && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
                Transaksi {saleStatus === "CANCELLED" ? "yang dibatalkan" : "yang di-return"} tidak
                bisa diubah.
              </div>
            )}
            <p className="text-xs text-stone-400">
              Harga satuan mengikuti harga master saat ini; total akhir dihitung ulang oleh
              server saat disimpan. Stok disesuaikan otomatis dari selisih item lama dan baru.
            </p>

            {/* Customer + pembayaran */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="input-field [color-scheme:dark]"
                  disabled={notEditable}
                >
                  <option value="">Pilih customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="input-field [color-scheme:dark]"
                  disabled={notEditable}
                >
                  <option value="CASH">Tunai</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="QRIS">QRIS</option>
                  <option value="DEBIT_CARD">Kartu Debit</option>
                  <option value="CREDIT">Kredit</option>
                </select>
              </div>
            </div>

            {/* Tambah produk */}
            <div className="relative">
              <label className="label">Tambah Produk</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Cari nama / kode produk..."
                  className="input-field pl-9"
                  disabled={notEditable}
                />
              </div>
              {showProductDropdown && searchProduct && filteredProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-[#1C1917] border border-white/10 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="p-3 border-b border-white/10 last:border-0">
                      <p className="font-medium text-sm">
                        {p.name} <span className="text-stone-500">({p.code})</span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.productUnits.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => addToCart(p, u.unitId)}
                            className="px-2 py-1 text-xs bg-[#E5484D]/10 text-red-300 rounded hover:bg-[#E5484D]/15"
                          >
                            {u.unit.symbol || u.unit.name} — Rp{" "}
                            {Number(u.sellPrice).toLocaleString("id-ID")}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daftar item */}
            <div>
              <label className="label">Item Penjualan</label>
              {items.length === 0 ? (
                <p className="text-sm text-stone-400 py-4 text-center border border-dashed rounded-xl">
                  Belum ada item
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${item.unitId}`}
                      className="flex flex-wrap items-center gap-2 p-3 border border-white/10 rounded-xl"
                    >
                      <div className="flex-1 min-w-[140px]">
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-stone-400">
                          {item.productCode} • {item.unitName} • Rp{" "}
                          {item.unitPrice.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="input-field w-20 ml-1"
                          disabled={notEditable}
                        />
                      </label>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                        Diskon
                        <input
                          type="number"
                          min={0}
                          value={item.discount}
                          onChange={(e) => updateItem(idx, "discount", parseFloat(e.target.value) || 0)}
                          className="input-field w-24 ml-1"
                          disabled={notEditable}
                        />
                      </label>
                      <p className="font-semibold text-sm w-28 text-right">
                        Rp {item.subtotal.toLocaleString("id-ID")}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-400"
                        disabled={notEditable}
                        aria-label="Hapus item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total + bayar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Diskon Total (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="input-field"
                  disabled={notEditable}
                />
              </div>
              <div>
                <label className="label">Pajak (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                  className="input-field"
                  disabled={notEditable}
                />
              </div>
              <div>
                <label className="label">Jumlah Bayar (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="input-field"
                  disabled={notEditable}
                />
              </div>
              <div>
                <label className="label">Grand Total</label>
                <p className="text-lg font-bold text-stone-100 pt-2">
                  Rp {grandTotal.toLocaleString("id-ID")}
                </p>
                {paymentMethod !== PaymentMethod.CREDIT && (
                  <p className="text-xs text-stone-400">
                    Kembalian: Rp {changeAmount.toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
                rows={2}
                disabled={notEditable}
              />
              {proofTag && (
                <p className="text-xs text-stone-400 mt-1">
                  Bukti transfer terlampir dipertahankan ({proofTag.slice(0, 40)}...)
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn-secondary">
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || notEditable}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      </div>
    </div>
  );
}
