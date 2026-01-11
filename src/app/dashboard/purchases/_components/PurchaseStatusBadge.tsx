import { PurchaseStatus } from "@prisma/client";

interface PurchaseStatusBadgeProps {
  status: PurchaseStatus;
}

export function PurchaseStatusBadge({ status }: PurchaseStatusBadgeProps) {
  const getStatusStyle = () => {
    switch (status) {
      case "PENDING":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pending",
        };
      case "RECEIVED":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Received",
        };
      case "PARTIAL":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Partial",
        };
      case "CANCELLED":
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Cancelled",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          label: status,
        };
    }
  };

  const style = getStatusStyle();

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}