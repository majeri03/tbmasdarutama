"use client";

import { useState, useEffect } from "react";
import { Store, Lock, Globe, User, ShieldAlert } from "lucide-react";
import StoreSettingsTab from "./_components/StoreSettingsTab";
import PasswordSettingsTab from "./_components/PasswordSettingsTab";
import LandingPageTab from "./_components/LandingPageTab";
import ProfileSettingsTab from "./_components/ProfileSettingsTab";
import DataManagementTab from "./_components/DataManagementTab";
import InvoiceSettingsTab from "./_components/InvoiceSettingsTab";
import PageGuard from "@/components/PageGuard";

type TabType = "profile" | "store" | "invoice" | "password" | "landing" | "data";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [allowedPages, setAllowedPages] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/page-access")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.allowedPages) {
          setAllowedPages(res.data.allowedPages);
        }
      })
      .catch((e) => console.error("Error loading page access:", e));
  }, []);

  const tabs = [
    { id: "profile" as TabType, label: "Profil Akun", icon: User },
    { id: "store" as TabType, label: "Info Toko", icon: Store },
    { id: "invoice" as TabType, label: "Pengaturan Invoice", icon: Store },
    { id: "password" as TabType, label: "Ganti Password", icon: Lock },
    { id: "landing" as TabType, label: "Landing Page", icon: Globe },
    { id: "data" as TabType, label: "Manajemen Data", icon: ShieldAlert },
  ];

  const filteredTabs = tabs.filter((tab) => {
    if (tab.id === "invoice") {
      return allowedPages.includes("invoice_layout");
    }
    return true;
  });

  return (
    <PageGuard pageKey="reports_settings">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="glass-card p-6">
          <h1 className="text-2xl font-bold text-gray-800">Pengaturan</h1>
          <p className="text-sm text-gray-600 mt-1">
            Kelola informasi toko, keamanan, dan tampilan website
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="glass-card p-2">
          <div className="flex gap-2 overflow-x-auto">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id ? "active" : ""
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="glass-card p-6">
          {activeTab === "profile" && <ProfileSettingsTab />}
          {activeTab === "store" && <StoreSettingsTab />}
          {activeTab === "invoice" && <InvoiceSettingsTab />}
          {activeTab === "password" && <PasswordSettingsTab />}
          {activeTab === "landing" && <LandingPageTab />}
          {activeTab === "data" && <DataManagementTab />}
        </div>
      </div>
    </PageGuard>
  );
}