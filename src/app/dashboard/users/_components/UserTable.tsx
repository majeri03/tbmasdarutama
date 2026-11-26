"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, Trash2, Shield, ShieldAlert, User as UserIcon, CheckCircle, XCircle, Mail, Clock, Loader2, KeyRound } from "lucide-react";
import { UserFormModal } from "./UserFormModal";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { resendUserVerificationOtp } from "@/lib/actions/email-verification.actions";
import { useToast, Toast } from "@/components/ui/toast";

// Tipe data untuk UI (exclude password)
interface UserData {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "KASIR";
  phone: string | null;
  address: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  // PKG-I: true kalau akun nonaktif DAN ada token OTP yang masih berlaku.
  hasPendingVerification: boolean;
  createdAt: Date;
}

export default function UserTable({ users }: { users: UserData[] }) {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const handleResendOtp = async (user: UserData) => {
    setResendingId(user.id);
    try {
      const result = await resendUserVerificationOtp(user.id);
      if (result.success) {
        showToast(result.message || "Kode verifikasi dikirim", "success");
      } else {
        throw new Error(result.error || "Gagal mengirim ulang kode");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengirim ulang kode", "error");
    } finally {
      setResendingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#7F1D1D]/10 text-[#7F1D1D] flex items-center gap-1 w-fit"><ShieldAlert className="w-3 h-3"/> Super Admin</span>;
      case "ADMIN":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-stone-200 text-stone-700 flex items-center gap-1 w-fit"><Shield className="w-3 h-3"/> Admin</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 flex items-center gap-1 w-fit"><UserIcon className="w-3 h-3"/> Kasir</span>;
    }
  };

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-700 font-semibold border-b border-stone-200">
              <tr>
                <th className="px-6 py-4">Nama User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Kontak</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="text-xs">{user.phone || "-"}</div>
                    <div className="text-[10px] text-gray-400 max-w-[150px] truncate">{user.address}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.isActive ? (
                        <span className="inline-flex justify-center text-green-600" title="Aktif"><CheckCircle className="w-4 h-4"/></span>
                    ) : user.hasPendingVerification ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap" title="Menunggu verifikasi email"><Clock className="w-3 h-3"/> Menunggu verifikasi</span>
                    ) : (
                        <span className="inline-flex justify-center text-red-500" title="Non-Aktif"><XCircle className="w-4 h-4"/></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.hasPendingVerification && (
                        <>
                          <button
                            onClick={() => handleResendOtp(user)}
                            disabled={resendingId === user.id}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Kirim ulang kode OTP"
                          >
                            {resendingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          </button>
                          {/* FIX (24 Nov 2026, OTP): baris "Menunggu verifikasi"
                              sekarang juga menautkan langsung ke halaman tempat
                              kode OTP dimasukkan (email sudah terisi). */}
                          <Link
                            href={`/verify-email?email=${encodeURIComponent(user.email)}`}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors inline-flex"
                            title="Buka halaman verifikasi OTP (masukkan kode)"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Link>
                        </>
                      )}
                      <button
                        onClick={() => { setSelectedUser(user); setIsEditOpen(true); }}
                        className="p-2 text-[#7F1D1D] hover:bg-[#7F1D1D]/[0.06] rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                 <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada data user.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit */}
      {selectedUser && (
        <UserFormModal
          isOpen={isEditOpen}
          onClose={() => { setIsEditOpen(false); setSelectedUser(null); }}
          initialData={selectedUser}
        />
      )}

      {/* Dialog Delete */}
      {selectedUser && (
        <DeleteUserDialog
          isOpen={isDeleteOpen}
          onClose={() => { setIsDeleteOpen(false); setSelectedUser(null); }}
          user={selectedUser}
        />
      )}
    </>
  );
}