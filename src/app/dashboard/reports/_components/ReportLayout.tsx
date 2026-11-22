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
        <div className="no-print rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[#111111] p-3">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#111111]">{title}</h1>
                <p className="mt-1 text-[#6B7280]">{description}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {onPrint && (
                <button
                  onClick={onPrint}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#111111] bg-white px-4 py-2 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {filters && <div className="mt-6 pt-6 border-t border-gray-200 no-print">{filters}</div>}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
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
