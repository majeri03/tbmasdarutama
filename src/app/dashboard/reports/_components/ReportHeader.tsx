import { COMPANY_INFO } from "@/lib/constants/company";
import { getCurrentDateTime } from "@/lib/utils/pdf-helpers";

interface ReportHeaderProps {
  title: string;
  period?: string;
}

export default function ReportHeader({ title, period }: ReportHeaderProps) {
  return (
    <div className="mb-8 pb-6 border-b-2 border-gray-300">
      {/* Company Info */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{COMPANY_INFO.name}</h1>
        <p className="text-sm text-gray-600 mt-1">{COMPANY_INFO.address}</p>
        <p className="text-sm text-gray-600">Telp: {COMPANY_INFO.phone}</p>
      </div>

      {/* Report Title */}
      <div className="text-center mt-6">
        <h2 className="text-xl font-bold text-gray-900 uppercase">{title}</h2>
        {period && <p className="text-sm text-gray-600 mt-1">Periode: {period}</p>}
        <p className="text-xs text-gray-500 mt-2">Dicetak: {getCurrentDateTime()}</p>
      </div>
    </div>
  );
}