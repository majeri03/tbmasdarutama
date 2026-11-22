// Bagikan invoice via WhatsApp (wa.me) — isi pesan teks ringkasan invoice.
// Nomor diambil dari telepon customer (08xx -> 62xx); kalau tidak ada nomor,
// wa.me dibuka tanpa nomor supaya pengguna memilih kontak sendiri.

"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { getSaleById } from "@/lib/actions/sale.actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
  CREDIT: "Kredit",
  DEBIT_CARD: "Debit",
};

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  if (digits.startsWith("8")) digits = "62" + digits;
  return digits.length >= 9 ? digits : null;
}

interface ShareInvoiceWhatsAppProps {
  saleId: string;
  /** Teks tombol (default ikon + "WhatsApp"). */
  label?: string;
  className?: string;
}

export function ShareInvoiceWhatsApp({
  saleId,
  label = "WhatsApp",
  className = "btn-icon-success",
}: ShareInvoiceWhatsAppProps) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const result = await getSaleById(saleId);
      if (!result.success || !result.data) {
        alert(result.error || "Gagal memuat invoice");
        return;
      }
      const sale = result.data as unknown as {
        invoiceNumber: string;
        saleDate: string | Date;
        grandTotal: number;
        paidAmount: number;
        changeAmount: number;
        paymentMethod: string;
        customer?: { name?: string; phone?: string | null } | null;
        saleItems: Array<{
          quantity: number;
          unitPrice: number;
          subtotal: number;
          product: { name: string };
          unit: { name: string };
        }>;
      };

      const lines: string[] = [];
      lines.push("*TB Masdar Utama*");
      lines.push(`Invoice: ${sale.invoiceNumber}`);
      lines.push(
        `Tanggal: ${format(new Date(sale.saleDate), "dd MMM yyyy, HH:mm", { locale: localeId })}`
      );
      if (sale.customer?.name) lines.push(`Pelanggan: ${sale.customer.name}`);
      lines.push("----------------------");
      for (const item of sale.saleItems || []) {
        lines.push(
          `- ${item.product.name} ${item.quantity} ${item.unit?.name || ""} x Rp ${Number(
            item.unitPrice
          ).toLocaleString("id-ID")} = Rp ${Number(item.subtotal).toLocaleString("id-ID")}`
        );
      }
      lines.push("----------------------");
      lines.push(`Total: Rp ${Number(sale.grandTotal).toLocaleString("id-ID")}`);
      lines.push(
        `Bayar (${PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod}): Rp ${Number(
          sale.paidAmount
        ).toLocaleString("id-ID")}`
      );
      if (Number(sale.changeAmount) > 0) {
        lines.push(`Kembalian: Rp ${Number(sale.changeAmount).toLocaleString("id-ID")}`);
      }
      lines.push("");
      lines.push("Terima kasih sudah berbelanja di TB Masdar Utama.");

      const phone = normalizePhone(sale.customer?.phone);
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`
        : `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
      window.open(url, "_blank");
    } catch {
      alert("Gagal membagikan invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className={className}
      title="Bagikan invoice via WhatsApp"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MessageCircle className="w-4 h-4" />
      )}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
