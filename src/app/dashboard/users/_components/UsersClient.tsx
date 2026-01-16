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
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
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