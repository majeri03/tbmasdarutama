"use client";

import { X, User, Phone, Mail, MapPin, Building2, Tag, Calendar, CheckCircle, XCircle } from "lucide-react";
import { CustomerType } from "@prisma/client";

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
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerViewModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerViewModal({
  customer,
  isOpen,
  onClose,
}: CustomerViewModalProps) {
  if (!isOpen || !customer) return null;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getCustomerTypeLabel = (type: CustomerType) => {
    const types = {
      [CustomerType.UMUM]: { label: "Umum", color: "gray" },
      [CustomerType.REGULER]: { label: "Reguler", color: "blue" },
      [CustomerType.GROSIR]: { label: "Grosir", color: "green" },
      [CustomerType.PROYEK]: { label: "Proyek", color: "purple" },
    };
    return types[type];
  };

  const typeInfo = getCustomerTypeLabel(customer.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Detail Customer
              </h2>
              <p className="text-sm text-gray-600 mt-1">{customer.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Type Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                customer.isActive
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {customer.isActive ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span
                className={`text-sm font-semibold ${
                  customer.isActive ? "text-green-700" : "text-red-700"
                }`}
              >
                {customer.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            {/* Type Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-${typeInfo.color}-50 border border-${typeInfo.color}-200`}
            >
              <Tag className={`w-5 h-5 text-${typeInfo.color}-600`} />
              <span className={`text-sm font-semibold text-${typeInfo.color}-700`}>
                {typeInfo.label}
              </span>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Informasi Dasar
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Nama Customer:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {customer.name}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Kode Customer:</span>
                <span className="text-sm font-mono font-semibold text-blue-600">
                  {customer.code}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Tipe Customer:</span>
                <span className={`text-sm font-semibold text-${typeInfo.color}-600`}>
                  {typeInfo.label}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`text-sm font-semibold ${
                    customer.isActive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {customer.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              Informasi Kontak
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                <Phone className="w-4 h-4 text-gray-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-gray-600">Telepon:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customer.phone || "-"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-gray-600">Email:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customer.email || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Alamat
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600 block mb-1">
                  Alamat Lengkap:
                </span>
                <span className="text-sm text-gray-900">
                  {customer.address || "-"}
                </span>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-gray-600">Kota:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customer.city || "-"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-gray-600">Provinsi:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customer.province || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Informasi Waktu
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Dibuat pada:</span>
                <span className="text-sm text-gray-900">
                  {formatDate(customer.createdAt)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-600">
                  Terakhir diperbarui:
                </span>
                <span className="text-sm text-gray-900">
                  {formatDate(customer.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction History Placeholder */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Riwayat Transaksi
            </h3>
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600">
                Riwayat transaksi akan ditampilkan di sini
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (Coming soon: Fitur POS & Penjualan)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 p-6">
          <button onClick={onClose} className="w-full btn-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}