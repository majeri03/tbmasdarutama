"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Package, Search } from "lucide-react";
import { createDeliveryOrder } from "@/lib/actions/delivery-order.actions";
import { getCustomers } from "@/lib/actions/customer.actions";
import { getProducts } from "@/lib/actions/product.actions";
import { useToast } from "@/components/ui/toast";

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

interface DeliveryItem {
  productId: string;
  unitId: string;
  quantity: number;
  notes: string;
  productName?: string;
  unitName?: string;
}

export function DeliveryOrderFormModal({
  isOpen,
  onClose,
  onSuccess,
}: DeliveryOrderFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProducts, setSearchProducts] = useState<string[]>([]);

  // Form fields
  const [customerId, setCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([
    { productId: "", unitId: "", quantity: 1, notes: "" },
  ]);

  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [customersResult, productsResult] = await Promise.all([
        getCustomers({ status: "ACTIVE" }),
        getProducts({}),
      ]);

      if (customersResult.success && customersResult.data) {
        setCustomers(customersResult.data);
      }

      if (productsResult.success && productsResult.data) {
        const mappedProducts = productsResult.data.map((product) => ({
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
        setProducts(mappedProducts);
        setSearchProducts(Array(items.length).fill(""));
        setItems([{ productId: "", unitId: "", quantity: 1, notes: "" }]);
      }
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
      const product = products.find((p) => p.id === value);
      newItems[index].unitId = "";
      newItems[index].productName = product?.name;
      
      // Update search text
      const newSearch = [...searchProducts];
      newSearch[index] = product ? `${product.code} - ${product.name}` : "";
      setSearchProducts(newSearch);
    }

    if (field === "unitId") {
      const product = products.find((p) => p.id === newItems[index].productId);
      const productUnit = product?.units.find((pu) => pu.unitId === value);
      newItems[index].unitName = productUnit?.unit.name;
    }

    setItems(newItems);
  };

  const handleSearchChange = (index: number, value: string) => {
    const newSearch = [...searchProducts];
    newSearch[index] = value;
    setSearchProducts(newSearch);
  };

  const getFilteredProducts = (index: number) => {
    const search = searchProducts[index]?.toLowerCase() || "";
    if (!search) return products;
    
    return products.filter(
      (p) =>
        p.code.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search)
    );
  };

  const getAvailableUnits = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.units || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validItems = items.filter(
        (item) => item.productId && item.unitId && item.quantity > 0
      );

      if (validItems.length === 0) {
        showToast("Tambahkan minimal 1 item", "error");
        setIsLoading(false);
        return;
      }

      const result = await createDeliveryOrder({
        customerId,
        deliveryDate: new Date(deliveryDate),
        driver: driver || undefined,
        vehicle: vehicle || undefined,
        notes: notes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      });

      if (result.success) {
        showToast(
          result.message || "Surat jalan berhasil dibuat",
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
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDriver("");
    setVehicle("");
    setNotes("");
    setItems([{ productId: "", unitId: "", quantity: 1, notes: "" }]);
    setSearchProducts([""]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">
            Buat Surat Jalan Baru
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Pilih Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Kirim <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          {/* Driver & Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pengemudi
              </label>
              <input
                type="text"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                className="input-field"
                placeholder="Nama pengemudi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kendaraan
              </label>
              <input
                type="text"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="input-field"
                placeholder="No. polisi / jenis kendaraan"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Items <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="glass-card p-5 relative"
                >
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-3 right-3 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    {/* Row 1: Product Search & Unit */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Product - Searchable */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Produk *
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={searchProducts[index] || ""}
                            onChange={(e) => handleSearchChange(index, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field pl-10"
                            placeholder="Cari kode atau nama produk..."
                            list={`products-${index}`}
                          />
                          <datalist id={`products-${index}`}>
                            {getFilteredProducts(index).map((product) => (
                              <option
                                key={product.id}
                                value={`${product.code} - ${product.name}`}
                                onClick={() =>
                                  handleItemChange(index, "productId", product.id)
                                }
                              />
                            ))}
                          </datalist>
                        </div>
                        {/* Product Selector (hidden but functional) */}
                        <select
                          value={item.productId}
                          onChange={(e) =>
                            handleItemChange(index, "productId", e.target.value)
                          }
                          className="hidden"
                          required
                        >
                          <option value="">Pilih Produk</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.code} - {product.name}
                            </option>
                          ))}
                        </select>
                        {/* Quick select dropdown */}
                        {searchProducts[index] && getFilteredProducts(index).length > 0 && (
                          <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                            {getFilteredProducts(index).slice(0, 5).map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  handleItemChange(index, "productId", product.id);
                                  handleSearchChange(index, `${product.code} - ${product.name}`);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                              >
                                <span className="font-semibold text-blue-600">{product.code}</span>
                                {" - "}
                                <span className="text-gray-700">{product.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Unit */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Satuan *
                        </label>
                        <select
                          value={item.unitId}
                          onChange={(e) =>
                            handleItemChange(index, "unitId", e.target.value)
                          }
                          className="input-field"
                          required
                          disabled={!item.productId}
                        >
                          <option value="">Pilih Satuan</option>
                          {getAvailableUnits(item.productId).map((pu) => (
                            <option key={pu.unitId} value={pu.unitId}>
                              {pu.unit.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Quantity & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Quantity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Jumlah *
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="input-field"
                          placeholder="0"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Catatan Item
                        </label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) =>
                            handleItemChange(index, "notes", e.target.value)
                          }
                          className="input-field"
                          placeholder="Catatan untuk item ini (opsional)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Pengiriman
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="Catatan tambahan untuk pengiriman (opsional)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                "Memproses..."
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Buat Surat Jalan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}