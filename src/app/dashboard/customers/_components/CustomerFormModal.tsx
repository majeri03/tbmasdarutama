"use client";

import { useState, useEffect } from "react";
import { X, Loader2, User, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { CustomerType } from "@prisma/client";
import { createCustomer, updateCustomer } from "@/lib/actions/customer.actions";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/validations/customer.schema";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  type: CustomerType;
  isActive: boolean;
}

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  customer?: Customer;
  mode: "create" | "edit";
}

export function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
  mode,
}: CustomerFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    province: "",
    type: CustomerType.REGULER,
  });

  // Reset form when modal opens/closes or customer changes
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && customer) {
        setFormData({
          name: customer.name,
          phone: customer.phone || "",
          email: customer.email || "",
          address: customer.address || "",
          city: customer.city || "",
          province: customer.province || "",
          type: customer.type,
        });
      } else {
        setFormData({
          name: "",
          phone: "",
          email: "",
          address: "",
          city: "",
          province: "",
          type: CustomerType.REGULER,
        });
      }
    }
  }, [isOpen, mode, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;

      if (mode === "create") {
        result = await createCustomer(formData);
      } else {
        result = await updateCustomer(
          customer!.id,
          formData as UpdateCustomerInput
        );
      }

      if (result.success) {
        onSuccess(
          result.message ||
            `Customer berhasil ${mode === "create" ? "ditambahkan" : "diperbarui"}!`
        );
        onClose();
      } else {
        alert(result.error || "Terjadi kesalahan");
      }
    } catch (error) {
      console.error("Error submitting customer:", error);
      alert("Terjadi kesalahan saat menyimpan customer");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === "create" ? "Tambah Customer Baru" : "Edit Customer"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {mode === "create"
                ? "Isi informasi customer yang akan ditambahkan"
                : `Edit data customer: ${customer?.code}`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Informasi Dasar
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Customer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Contoh: PT. Sumber Jaya"
                  required
                  className="glass-input"
                  disabled={loading}
                />
              </div>

              {/* Customer Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipe Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as CustomerType,
                    })
                  }
                  required
                  className="glass-input"
                  disabled={loading}
                >
                  <option value={CustomerType.REGULER}>Reguler</option>
                  <option value={CustomerType.GROSIR}>Grosir</option>
                  <option value={CustomerType.PROYEK}>Proyek</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.type === CustomerType.REGULER &&
                    "Customer dengan pembelian normal"}
                  {formData.type === CustomerType.GROSIR &&
                    "Customer dengan pembelian dalam jumlah besar"}
                  {formData.type === CustomerType.PROYEK &&
                    "Customer untuk proyek khusus"}
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Nomor Telepon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="08123456789"
                  className="glass-input"
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="customer@example.com"
                  className="glass-input"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Alamat
            </h3>

            <div className="space-y-4">
              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alamat Lengkap
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Jl. Contoh No. 123"
                  rows={3}
                  className="glass-input resize-none"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Kota/Kabupaten
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Contoh: Jakarta"
                    className="glass-input"
                    disabled={loading}
                  />
                </div>

                {/* Province */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Provinsi
                  </label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                    placeholder="Contoh: DKI Jakarta"
                    className="glass-input"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>
                  {mode === "create" ? "Tambah Customer" : "Simpan Perubahan"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}