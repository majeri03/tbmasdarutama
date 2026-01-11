import { SaleStatus } from "@prisma/client";

interface SaleStatusBadgeProps {
  status: SaleStatus;
}

export function SaleStatusBadge({ status }: SaleStatusBadgeProps) {
  const statusConfig: Record<SaleStatus, { label: string; className: string }> = {
    COMPLETED: {
      label: "Selesai",
      className: "badge-success",
    },
    PENDING: {
      label: "Pending",
      className: "badge-warning",
    },
    CANCELLED: {
      label: "Dibatalkan",
      className: "badge-danger",
    },
    RETURN: {
      label: "Retur",
      className: "badge-info",
    },
  };

  const config = statusConfig[status];

  return <span className={`badge ${config.className}`}>{config.label}</span>;
}