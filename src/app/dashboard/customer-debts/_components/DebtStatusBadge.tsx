import { DebtStatus } from "@prisma/client";
import { CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";

interface DebtStatusBadgeProps {
  status: DebtStatus;
}

export function DebtStatusBadge({ status }: DebtStatusBadgeProps) {
  const config = {
    UNPAID: {
      label: "Belum Bayar",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <XCircle className="w-3 h-3" />,
    },
    PARTIAL: {
      label: "Cicilan",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: <Clock className="w-3 h-3" />,
    },
    PAID: {
      label: "Lunas",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    OVERDUE: {
      label: "Jatuh Tempo",
      color: "bg-gray-800 text-white border-gray-900",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
  };

  const { label, color, icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}
    >
      {icon}
      {label}
    </span>
  );
}