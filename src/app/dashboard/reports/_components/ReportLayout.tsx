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
        {/* Header */}
        <div className="glass-card p-6 no-print">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                <p className="text-gray-600 mt-1">{description}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {onPrint && (
                <button
                  onClick={onPrint}
                  disabled={isLoading}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  disabled={isLoading}
                  className="btn-primary flex items-center gap-2"
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