import { DebtStatus } from "@prisma/client";
import { CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";

interface DebtStatusBadgeProps {
  status: DebtStatus;
}

export function DebtStatusBadge({ status }: DebtStatusBadgeProps) {
  const config = {
    UNPAID: {
      label: "Belum Bayar",
      color: "badge-danger",
      icon: <XCircle className="w-3 h-3" />,
    },
    PARTIAL: {
      label: "Cicilan",
      color: "badge-warning",
      icon: <Clock className="w-3 h-3" />,
    },
    PAID: {
      label: "Lunas",
      color: "badge-success",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    OVERDUE: {
      label: "Jatuh Tempo",
      color: "badge-danger",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
  };

  const { label, color, icon } = config[status];

  return (
    <span
      className={`badge ${color}`}
    >
      {icon}
      {label}
    </span>
  );
}