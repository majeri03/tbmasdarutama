"use client";

import { ReactNode } from "react";
import { FileText, Download, Printer } from "lucide-react";

interface ReportLayoutProps {
  title: string;
  description: string;
  filters?: ReactNode;
  onDownload?: () => void;
  onPrint?: () => void;
  isLoading?: boolean;
  children: ReactNode;
}

export default function ReportLayout({
  title,
  description,
  filters,
  onDownload,
  onPrint,
  isLoading,
  children,
}: ReportLayoutProps) {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header layar */}
        <div className="no-print glass-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[#7F1D1D] p-3">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-stone-100">{title}</h1>
                <p className="mt-1 text-stone-400">{description}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {onPrint && (
                <button
                  onClick={onPrint}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#7F1D1D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {filters && <div className="mt-6 pt-6 border-t border-white/10 no-print">{filters}</div>}
        </div>

        {/* Content */}
        <div className="glass-card p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner-large" />
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
