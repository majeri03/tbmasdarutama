export const PAGE_KEYS = [
  { key: "pos", label: "Halaman POS" },
  { key: "reports_settings", label: "Halaman Reports dan Settings" },
  { key: "po", label: "PO Barang (Purchase Order)" },
  { key: "invoice_layout", label: "Desain dan Layout Invoice" },
  { key: "stock_opname", label: "Stock Opname" },
] as const;

export type PageKey = typeof PAGE_KEYS[number]["key"];
