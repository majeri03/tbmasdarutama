"use client";

import { Check, X } from "lucide-react";
import {
  getPasswordStrength,
  validatePassword,
} from "@/lib/utils/password";

/**
 * Checklist aturan password + indikator kekuatan, live mengikuti ketikan.
 * Satu komponen dipakai di semua form yang mengatur password:
 * reset password, ganti password (Pengaturan), dan tambah/edit user.
 * Submit tetap diblokir client-side DAN ditolak server-side kalau ada
 * aturan yang belum lolos — komponen ini hanya tampilan.
 */
export default function PasswordChecklist({
  password,
  showStrength = true,
}: {
  password: string;
  showStrength?: boolean;
}) {
  const { checklist } = validatePassword(password);
  const strength = getPasswordStrength(password);
  const strengthColor =
    strength.label === "Sangat kuat"
      ? "bg-green-500"
      : strength.label === "Kuat"
        ? "bg-emerald-500"
        : strength.label === "Cukup"
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-1">
        {checklist.map((item) => (
          <li
            key={item.id}
            className={`flex items-center gap-1.5 text-xs ${ item.passed ? "text-green-400" : "text-stone-400" }`}
          >
            {item.passed ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 shrink-0 text-red-400" />
            )}
            <span className={item.passed ? "line-through opacity-70" : ""}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      {showStrength && password.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${strengthColor}`}
              style={{ width: `${(strength.score / 5) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-stone-400 whitespace-nowrap">
            Kekuatan: {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
