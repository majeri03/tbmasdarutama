import { PaymentMethod } from "@prisma/client";

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
  const methodConfig = {
    CASH: { label: "Tunai", className: "badge-success" },
    TRANSFER: { label: "Transfer", className: "badge-info" },
    CREDIT: { label: "Kredit", className: "badge-warning" },
    QRIS: { label: "QRIS", className: "badge-info" },
    DEBIT_CARD: { label: "Kartu Debit", className: "badge-info" },
  };

  const config = methodConfig[method];

  return <span className={`badge ${config.className}`}>{config.label}</span>;
}