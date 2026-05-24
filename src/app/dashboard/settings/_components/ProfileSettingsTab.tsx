"use client";

import { useState } from "react";
import { User, Mail } from "lucide-react";
import { useSession } from "next-auth/react";

export default function ProfileSettingsTab() {
  const { data: session } = useSession();
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="text-sm text-gray-500">
          Informasi profil Anda. (Saat ini hanya untuk melihat data).
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nama Lengkap
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              readOnly
              value={session?.user?.name || ""}
              className="glass-input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alamat Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              readOnly
              value={session?.user?.email || ""}
              className="glass-input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Peran (Role)
          </label>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={session?.user?.role || ""}
              className="glass-input bg-gray-50 text-gray-500 cursor-not-allowed uppercase font-semibold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
