"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, CheckCircle, Search } from "lucide-react";
import { confirmWaOrder } from "@/lib/actions/wa-order.actions";

type WaOrder = {
  id: string;
  rawMessage: string;
  senderName: string;
  senderPhone: string;
  customerName?: string | null;
};

type Customer = { id: string; name: string; code: string; phone?: string | null };
type Product = {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  productUnits: Array<{ unitId: string; unit: { id: string; name: string; symbol: string | null }; sellPrice: number }>;
};

type OrderItem = {
  productId: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  notes: string;
};

export default function ConfirmWaOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: WaOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState(order.customerName || "");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ productId: "", productName: "", unitId: "", unitName: "", quantity: 1, notes: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch customers
    fetch("/api/customers?limit=200")
      .then((r) => r.json())
      .then((d) => setCustomers(d.data || d || []))
      .catch(() => {});
    // Fetch products with units
    fetch("/api/products?limit=500&includeUnits=true")
      .then((r) => r.json())
      .then((d) => setProducts(d.data || d || []))
      .catch(() => {});
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch) ||
      c.code.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addItem = () => {
    setItems([...items, { productId: "", productName: "", unitId: "", unitName: "", quantity: 1, notes: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };

    // Auto-set first available unit when product changes
    if (field === "productId") {
      const product = products.find((p) => p.id === value);
      if (product?.productUnits?.length) {
        updated[idx].unitId = product.productUnits[0].unitId;
        updated[idx].unitName = product.productUnits[0].unit.name;
        updated[idx].productName = product.name;
      }
    }
    if (field === "unitId") {
      const product = products.find((p) => p.id === updated[idx].productId);
      const pu = product?.productUnits?.find((u) => u.unitId === value);
      if (pu) updated[idx].unitName = pu.unit.name;
    }

    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedCustomerId) { setError("Pilih customer terlebih dahulu"); return; }
    if (items.some((i) => !i.productId || !i.unitId || i.quantity <= 0)) {
      setError("Lengkapi semua item orderan"); return;
    }

    setLoading(true);
    const res = await confirmWaOrder(order.id, {
      customerId: selectedCustomerId,
      deliveryDate: new Date(deliveryDate),
      driver: driver || undefined,
      vehicle: vehicle || undefined,
      notes: notes || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        unitId: i.unitId,
        quantity: i.quantity,
        notes: i.notes || undefined,
      })),
    });
    setLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || "Gagal konfirmasi orderan");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Konfirmasi Orderan WA</h2>
            <p className="text-xs text-gray-500 mt-0.5">dari {order.senderName} ({order.senderPhone})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Pesan asli */}
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-green-700 mb-1">Pesan WA:</p>
            <p className="text-sm text-green-800 whitespace-pre-wrap">&ldquo;{order.rawMessage}&rdquo;</p>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama / no HP / kode..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            {customerSearch && !selectedCustomerId && (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-gray-400 px-3 py-2">Tidak ditemukan</p>
                ) : (
                  filteredCustomers.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-gray-400">{c.phone || c.code}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedCustomerId && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Customer dipilih
              </p>
            )}
          </div>

          {/* Tanggal, Driver, Kendaraan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tanggal Kirim <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Supir</label>
              <input
                type="text"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                placeholder="Nama supir..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kendaraan</label>
            <input
              type="text"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Nopol / jenis kendaraan..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Item Orderan <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
              >
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const selectedProduct = products.find((p) => p.id === item.productId);
                return (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      {/* Produk */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 mb-1">Produk</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(idx, "productId", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                        >
                          <option value="">-- Pilih produk --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Satuan */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Satuan</label>
                        <select
                          value={item.unitId}
                          onChange={(e) => updateItem(idx, "unitId", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                          disabled={!item.productId}
                        >
                          <option value="">-- Satuan --</option>
                          {selectedProduct?.productUnits?.map((pu) => (
                            <option key={pu.unitId} value={pu.unitId}>{pu.unit.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Qty */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                      {/* Hapus */}
                      <div className="col-span-1 flex items-end pb-1">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          className="text-red-400 hover:text-red-600 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan tambahan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan pengiriman..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Konfirmasi & Buat Surat Jalan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
