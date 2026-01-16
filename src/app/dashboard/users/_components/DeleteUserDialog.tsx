"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { deleteUser } from "@/lib/actions/user.actions";
// 1. IMPORT TOAST COMPONENT DAN HOOK
import { useToast, Toast } from "@/components/ui/toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string };
}

export function DeleteUserDialog({ isOpen, onClose, user }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  
  // 2. AMBIL 'toast' (STATE) DAN 'showToast' (FUNGSI)
  const { toast, showToast, hideToast } = useToast();

  const handleDelete = async () => {
    if (!user?.id) {
        showToast("Error: ID User tidak ditemukan", "error");
        return;
    }

    // console.log("Memulai proses delete untuk ID:", user.id); 
    setIsLoading(true);

    try {
      const result = await deleteUser(user.id);

      if (result.success) {
        // 3. TAMPILKAN TOAST SUKSES
        showToast("User berhasil dihapus", "success");
        
        // PENTING: Karena toast ini ada di dalam modal, jika modal langsung ditutup,
        // toastnya ikut hilang. Kita beri jeda sedikit sebelum menutup modal.
        setTimeout(() => {
            onClose();
        }, 1500); 
      } else {
        showToast(result.error || "Gagal menghapus user", "error");
      }
    } catch (error) {
      console.error("Error Client Side:", error);
      showToast("Terjadi kesalahan sistem", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 relative">
        {/* 4. RENDER KOMPONEN TOAST DI SINI AGAR MUNCUL */}
        {toast && (
            <Toast 
                message={toast.message} 
                type={toast.type} 
                onClose={hideToast} 
            />
        )}

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus User?</h3>
          <p className="text-sm text-gray-500 mb-6">
            Apakah Anda yakin ingin menghapus user <span className="font-semibold text-gray-900">{user.name}</span>? 
            Tindakan ini tidak dapat dibatalkan.
          </p>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Proses...</span>
                </>
              ) : (
                "Ya, Hapus"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}