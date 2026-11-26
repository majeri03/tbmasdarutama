"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import UserTable from "./UserTable";
import { UserFormModal } from "./UserFormModal";

// Definisi tipe data yang sesuai dengan output getUsers()
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

interface UsersClientProps {
  initialUsers: UserData[];
}

export default function UsersClient({ initialUsers }: UsersClientProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm font-medium"
        >
            <Plus className="w-4 h-4" />
            Tambah User
        </button>
      </div>

      {/* Passing data yang sudah bertipe UserData[] ke UserTable */}
      <UserTable users={initialUsers} />

      <UserFormModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />
    </>
  );
}