// Cetak struk thermal via Web Bluetooth API (Chrome/Edge di Android & desktop).
// Tanpa dependensi baru. Printer thermal BLE umumnya memakai service
// 0xFFE0 / 0xFF00 / 0x18F0 dengan characteristic tulis — kode ini mencoba
// semuanya sampai ada yang bisa ditulis.
//
// Catatan: Web Bluetooth TIDAK tersedia di Safari/Firefox dan di WebView.
// Selalu cek isWebBluetoothSupported() dulu dan tampilkan pesan yang jelas.

import type { InvoiceData, StoreSetting } from "./invoice-printer";

// ---------- Tipe minimal Web Bluetooth (belum ada di lib.dom TS) ----------
interface BluetoothRemoteGATTCharacteristic {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  id: string;
  name?: string | null;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
}

type BluetoothServiceUUID = number | string;

interface Bluetooth {
  getDevices?: () => Promise<BluetoothDevice[]>;
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: BluetoothServiceUUID[];
  }): Promise<BluetoothDevice>;
}

function getBluetooth(): Bluetooth | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { bluetooth?: Bluetooth };
  return nav.bluetooth ?? null;
}

export function isWebBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}

const SAVED_PRINTER_KEY = "masdar-thermal-printer";

export function getSavedPrinterName(): string | null {
  try {
    return localStorage.getItem(SAVED_PRINTER_KEY);
  } catch {
    return null;
  }
}

function savePrinterName(name: string) {
  try {
    localStorage.setItem(SAVED_PRINTER_KEY, name);
  } catch {
    // abaikan — penyimpanan lokal tidak wajib
  }
}

// ---------- Bangun byte ESC/POS dari data invoice ----------
// Format mengikuti generateThermalReceiptString di APK (invoicePdf.ts):
// header toko, meta, daftar barang, total, bayar, footer. Lebar kolom:
// kertas 58mm = 32 karakter, 80mm = 48 karakter.

const ESC = 0x1b;
const GS = 0x1d;

function textBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function alignCmd(n: 0 | 1 | 2): number[] {
  return [ESC, 0x61, n];
}

function boldCmd(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

function center(text: string, cols: number): string {
  const t = text.length >= cols ? text.slice(0, cols) : text;
  const pad = Math.max(0, Math.floor((cols - t.length) / 2));
  return " ".repeat(pad) + t;
}

function leftRight(left: string, right: string, cols: number): string {
  const r = right.length > cols ? right.slice(-cols) : right;
  const space = Math.max(1, cols - left.length - r.length);
  return left + " ".repeat(space) + r;
}

function formatRp(n: number): string {
  return `Rp ${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer",
    QRIS: "QRIS",
    CREDIT: "Kredit",
    DEBIT_CARD: "Debit",
  };
  return map[method] || method;
}

export function paperCols(store: StoreSetting | null | undefined): number {
  const size = String(store?.invoicePaperSize || store?.invoiceDocumentPaperSize || "");
  return size.includes("80") ? 48 : 32;
}

export function buildThermalReceiptBytes(
  invoice: InvoiceData,
  store: StoreSetting | null | undefined
): Uint8Array {
  const cols = paperCols(store);
  const sep = "-".repeat(cols);
  const dsep = "=".repeat(cols);
  const out: number[] = [];
  const push = (...b: number[]) => out.push(...b);
  const line = (text: string, align: 0 | 1 | 2 = 0, bold = false) => {
    push(...alignCmd(align), ...boldCmd(bold), ...textBytes(text), 0x0a, ...boldCmd(false));
  };

  push(ESC, 0x40); // init printer

  // Header toko
  line(store?.name || "TB Masdar Utama", 1, true);
  if (store?.tagline) line(store.tagline, 1);
  if (store?.address) line(store.address, 1);
  if (store?.phone) line(`Telp: ${store.phone}`, 1);
  line(sep, 1);

  // Meta
  const dateStr = new Date(invoice.saleDate).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  line(`No. INV: ${invoice.invoiceNumber}`);
  line(`Tanggal: ${dateStr}`);
  line(`Kasir  : ${invoice.cashier?.name || "-"}`);
  if (invoice.customer) line(`Plgn   : ${invoice.customer.name}`);
  line(dsep, 1);
  line("DAFTAR BARANG", 0, true);

  // Item
  for (const item of invoice.saleItems || []) {
    line(item.product.name, 0, true);
    line(
      `${item.quantity} ${item.unit?.name || "Unit"} x ${formatRp(item.unitPrice)}`
    );
    if (Number(item.discount) > 0) line(`Diskon: -${formatRp(item.discount)}`);
    line(leftRight("", formatRp(item.subtotal), cols), 2);
  }

  // Total
  line(sep, 1);
  line(leftRight("Subtotal", formatRp(invoice.totalAmount), cols));
  if (Number(invoice.discount) > 0)
    line(leftRight("Diskon", `-${formatRp(invoice.discount)}`, cols));
  if (Number(invoice.tax) > 0) line(leftRight("Pajak", formatRp(invoice.tax), cols));
  line(leftRight("GRAND TOTAL", formatRp(invoice.grandTotal), cols), 0, true);
  line(sep, 1);
  line(
    leftRight(
      `Bayar (${paymentLabel(invoice.paymentMethod)})`,
      formatRp(invoice.paidAmount),
      cols
    )
  );
  line(leftRight("Kembalian", formatRp(invoice.changeAmount), cols));

  // Footer
  if (store?.invoiceShowFooter !== false) {
    line(sep, 1);
    line("TERIMA KASIH", 1, true);
    line(
      store?.invoiceFooterTerms ||
        "Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan",
      1
    );
  }

  push(0x0a, 0x0a, 0x0a);
  push(GS, 0x56, 0x00); // potong kertas
  return new Uint8Array(out);
}

// ---------- Koneksi & cetak ----------

export interface ThermalPrinterHandle {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

let cachedHandle: ThermalPrinterHandle | null = null;

// Service BLE yang umum dipakai printer thermal ESC/POS.
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  0xffe0,
  0xff00,
  0x18f0,
  "0000ffe0-0000-1000-8000-00805f9a34fb",
  "0000ff00-0000-1000-8000-00805f9a34fb",
  "000018f0-0000-1000-8000-00805f9a34fb",
];

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const serviceUuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties.writeWithoutResponse || c.properties.write
      );
      if (writable) return writable;
    } catch {
      // service tidak ada di printer ini — coba berikutnya
    }
  }
  return null;
}

export async function connectThermalPrinter(): Promise<ThermalPrinterHandle> {
  const bluetooth = getBluetooth();
  if (!bluetooth) {
    throw new Error(
      "Browser ini tidak mendukung Web Bluetooth. Pakai Chrome/Edge terbaru (Android/Windows)."
    );
  }

  // 1. Coba sambung ulang ke printer yang pernah diizinkan (tanpa picker).
  if (typeof bluetooth.getDevices === "function") {
    try {
      const devices = await bluetooth.getDevices();
      const savedName = getSavedPrinterName();
      const known = devices.find((d) => (savedName ? d.name === savedName : true));
      if (known?.gatt) {
        const server = await known.gatt.connect();
        const characteristic = await findWritableCharacteristic(server);
        if (characteristic) {
          cachedHandle = { device: known, characteristic };
          return cachedHandle;
        }
      }
    } catch {
      // lanjut ke picker
    }
  }

  // 2. Picker: pengguna pilih printer thermal dari daftar Bluetooth.
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  if (!device.gatt) throw new Error("Perangkat tidak menyediakan koneksi GATT.");

  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    throw new Error(
      "Printer tidak menyediakan characteristic tulis ESC/POS. Coba printer thermal Bluetooth lain."
    );
  }
  if (device.name) savePrinterName(device.name);
  device.addEventListener("gattserverdisconnected", () => {
    cachedHandle = null;
  });
  cachedHandle = { device, characteristic };
  return cachedHandle;
}

async function writeChunked(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
) {
  // MTU BLE kecil — kirim per 100 byte dengan jeda supaya printer tidak
  // kehilangan potongan (pola yang sama dipakai banyak printer thermal BLE).
  const CHUNK = 100;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk as BufferSource);
    } else {
      await characteristic.writeValue(chunk as BufferSource);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Cetak struk invoice ke printer thermal Bluetooth (sambung dulu kalau perlu). */
export async function printThermalReceipt(
  invoice: InvoiceData,
  store: StoreSetting | null | undefined
): Promise<void> {
  const handle = cachedHandle ?? (await connectThermalPrinter());
  const bytes = buildThermalReceiptBytes(invoice, store);
  await writeChunked(handle.characteristic, bytes);
}

export function disconnectThermalPrinter() {
  cachedHandle = null;
}
