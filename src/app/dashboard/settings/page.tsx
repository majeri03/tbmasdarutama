"use client";

import { useState } from "react";
import { Store, Lock, Globe } from "lucide-react";
import StoreSettingsTab from "./_components/StoreSettingsTab";
import PasswordSettingsTab from "./_components/PasswordSettingsTab";
import LandingPageTab from "./_components/LandingPageTab";

type TabType = "store" | "password" | "landing";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("store");

  const tabs = [
    { id: "store" as TabType, label: "Info Toko", icon: Store },
    { id: "password" as TabType, label: "Ganti Password", icon: Lock },
    { id: "landing" as TabType, label: "Landing Page", icon: Globe },
  ];

  return (
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
          {tabs.map((tab) => (
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
        {activeTab === "store" && <StoreSettingsTab />}
        {activeTab === "password" && <PasswordSettingsTab />}
        {activeTab === "landing" && <LandingPageTab />}
      </div>
    </div>
  );
}