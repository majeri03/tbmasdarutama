"use client";

import { useState } from "react";
import { Edit, Trash2, Shield, ShieldAlert, User as UserIcon, CheckCircle, XCircle } from "lucide-react";
import { UserFormModal } from "./UserFormModal";
import { DeleteUserDialog } from "./DeleteUserDialog";

// Tipe data untuk UI (exclude password)
interface UserData {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "KASIR";
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
}

export default function UserTable({ users }: { users: UserData[] }) {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 flex items-center gap-1 w-fit"><ShieldAlert className="w-3 h-3"/> Super Admin</span>;
      case "ADMIN":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1 w-fit"><Shield className="w-3 h-3"/> Admin</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 flex items-center gap-1 w-fit"><UserIcon className="w-3 h-3"/> Kasir</span>;
    }
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 font-semibold border-b border-gray-200">
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
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
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
                    ) : (
                        <span className="inline-flex justify-center text-red-500" title="Non-Aktif"><XCircle className="w-4 h-4"/></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedUser(user); setIsEditOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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