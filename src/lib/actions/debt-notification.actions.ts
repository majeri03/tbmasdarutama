"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireMinimumRole, type AuthSession } from "../utils/role";
import { NotificationService } from "@/lib/services/notification.service";
import {
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";

// PKG-H (23 Nov 2026, email pengingat utang): kelola daftar email
// penerima ringkasan utang jatuh tempo + info terakhir terkirim + kirim
// email tes. SEMUA aksi di sini SUPER_ADMIN saja (sama seperti
// pengaturan poin di tab Sales — MANAGE_STORE_SETTINGS).
// Daftar penerima disimpan di model DebtNotificationRecipient (bukan
// array di StoreSetting) supaya bisa diaktifkan/dinonaktifkan per
// alamat dan dicatat siapa yang menambahkan.

const recipientSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid").max(100, "Email maksimal 100 karakter"),
  name: z.string().trim().max(100, "Nama maksimal 100 karakter").optional().nullable(),
});

export type DebtRecipientInput = z.infer<typeof recipientSchema>;

// Rate limit kirim email tes: 5x/jam per user (supaya tombol tes tidak
// dipakai membanjiri inbox penerima).
const TEST_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const TEST_EMAIL_MAX = 5;

async function requireDebtAdmin(externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  if (!session?.user) throw new Error("Unauthorized");
  requireMinimumRole(session, "SUPER_ADMIN");
  return session;
}

//   GET ALL RECIPIENTS
export async function getDebtRecipients(externalSession?: AuthSession | null) {
  try {
    await requireDebtAdmin(externalSession);
    const recipients = await prisma.debtNotificationRecipient.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { success: true, data: recipients };
  } catch (error) {
    console.error("[GET_DEBT_RECIPIENTS_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil daftar penerima email." };
  }
}

//   ADD RECIPIENT
export async function addDebtRecipient(data: DebtRecipientInput, externalSession?: AuthSession | null) {
  try {
    const session = await requireDebtAdmin(externalSession);
    // FIX BUILD (23 Nov 2026, pkg-h2): TS18048 — narrowing dari
    // requireDebtAdmin tidak terbawa ke tipe return-nya (AuthSession.user
    // opsional), jadi guard + ekstrak userId di sini (pola yang sama
    // seperti z3: const langsung setelah guard, jangan pakai session.user.*
    // di bawah).
    if (!session?.user) throw new Error("Unauthorized");
    const userId = session.user.id;
    const validated = recipientSchema.parse(data);

    const existing = await prisma.debtNotificationRecipient.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      return { success: false, error: `Email ${validated.email} sudah terdaftar sebagai penerima.` };
    }

    const recipient = await prisma.debtNotificationRecipient.create({
      data: {
        email: validated.email,
        name: validated.name || null,
        isActive: true,
        createdBy: userId,
      },
    });

    revalidatePath("/dashboard/settings");
    return {
      success: true,
      data: recipient,
      message: `Email ${recipient.email} ditambahkan sebagai penerima pengingat utang.`,
    };
  } catch (error) {
    console.error("[ADD_DEBT_RECIPIENT_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menambahkan penerima email.",
    };
  }
}

//   DELETE RECIPIENT
export async function deleteDebtRecipient(id: string, externalSession?: AuthSession | null) {
  try {
    await requireDebtAdmin(externalSession);
    const recipient = await prisma.debtNotificationRecipient.findUnique({ where: { id } });
    if (!recipient) {
      return { success: false, error: "Penerima tidak ditemukan." };
    }
    await prisma.debtNotificationRecipient.delete({ where: { id } });
    revalidatePath("/dashboard/settings");
    return { success: true, message: `Email ${recipient.email} dihapus dari daftar penerima.` };
  } catch (error) {
    console.error("[DELETE_DEBT_RECIPIENT_ERROR]", error);
    return { success: false, error: "Gagal menghapus penerima email." };
  }
}

//   TOGGLE ACTIVE STATUS
export async function toggleDebtRecipient(id: string, externalSession?: AuthSession | null) {
  try {
    await requireDebtAdmin(externalSession);
    const recipient = await prisma.debtNotificationRecipient.findUnique({ where: { id } });
    if (!recipient) {
      return { success: false, error: "Penerima tidak ditemukan." };
    }
    const updated = await prisma.debtNotificationRecipient.update({
      where: { id },
      data: { isActive: !recipient.isActive },
    });
    revalidatePath("/dashboard/settings");
    return {
      success: true,
      data: updated,
      message: `Email ${updated.email} berhasil ${updated.isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  } catch (error) {
    console.error("[TOGGLE_DEBT_RECIPIENT_ERROR]", error);
    return { success: false, error: "Gagal mengubah status penerima." };
  }
}

//   GET LAST SENT LOG (info "terakhir terkirim" di tab Pengaturan)
export async function getLastDebtEmailLog(externalSession?: AuthSession | null) {
  try {
    await requireDebtAdmin(externalSession);
    const log = await prisma.debtEmailLog.findFirst({
      orderBy: { sentAt: "desc" },
    });
    if (!log) return { success: true, data: null };
    // Decimal diserialkan jadi number supaya aman dibawa ke client.
    return {
      success: true,
      data: {
        ...log,
        totalCustomer: Number(log.totalCustomer),
        totalSupplier: Number(log.totalSupplier),
      },
    };
  } catch (error) {
    console.error("[GET_LAST_DEBT_EMAIL_LOG_ERROR]", error);
    return { success: false, error: "Gagal mengambil info pengiriman terakhir." };
  }
}

//   SEND TEST EMAIL
export async function sendTestDebtEmail(externalSession?: AuthSession | null) {
  try {
    const session = await requireDebtAdmin(externalSession);
    // FIX BUILD (23 Nov 2026, pkg-h2): TS18048 — guard + ekstrak di sini
    // (alasan sama seperti di addDebtRecipient di atas).
    if (!session?.user) throw new Error("Unauthorized");
    const userId = session.user.id;
    const userEmail = session.user.email;

    const rateKey = `debt-test-email:user:${userId}`;
    if (await isRateLimited(rateKey, TEST_EMAIL_MAX, TEST_EMAIL_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak kirim email tes. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(rateKey, TEST_EMAIL_WINDOW_MS);

    const result = await NotificationService.sendTestDebtEmail(userEmail ?? undefined);
    if (!result.sent) {
      return { success: false, error: result.error || "Gagal mengirim email tes." };
    }
    revalidatePath("/dashboard/settings");
    return {
      success: true,
      message: `Email tes terkirim ke ${result.recipientCount} penerima. Cek inbox (dan folder spam) — subjek diawali "[TES]".`,
    };
  } catch (error) {
    console.error("[SEND_TEST_DEBT_EMAIL_ERROR]", error);
    return { success: false, error: "Gagal mengirim email tes." };
  }
}
