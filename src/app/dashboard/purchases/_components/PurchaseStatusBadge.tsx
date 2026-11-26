import { PurchaseStatus } from "@prisma/client";

interface PurchaseStatusBadgeProps {
  status: PurchaseStatus;
}

export function PurchaseStatusBadge({ status }: PurchaseStatusBadgeProps) {
  const getStatusStyle = () => {
    switch (status) {
      case "PENDING":
        return {
          className: "badge-warning",
          label: "Pending",
        };
      case "RECEIVED":
        return {
          className: "badge-success",
          label: "Received",
        };
      case "PARTIAL":
        return {
          className: "badge-info",
          label: "Partial",
        };
      case "CANCELLED":
        return {
          className: "badge-danger",
          label: "Cancelled",
        };
      default:
        return {
          className: "badge-info",
          label: status,
        };
    }
  };

  const style = getStatusStyle();

  return (
    <span className={`badge ${style.className}`}>
      {style.label}
    </span>
  );
}