import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/utils/api";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Get keys from env
const getApiKeys = () => {
  const keysStr = process.env.GROQ_API_KEYS;
  if (!keysStr) return [];
  return keysStr.split(",").map((k) => k.trim()).filter((k) => k.length > 20);
};

// Deteksi kompleksitas dari pesan terakhir
const detectTaskComplexity = (messages: any[]): "simple" | "complex" => {
  if (messages.length > 6) return "complex";
  
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const lower = lastUserMsg.toLowerCase();

  const simpleKeywords = [
    "stok", "berapa", "lihat", "cek", "tampil", "daftar", "list",
    "laporan", "omzet", "hutang", "piutang", "produk apa", "ada apa",
    "siapa", "dimana", "kapan", "harga", "total", "jumlah",
  ];
  const hasSimpleKeyword = simpleKeywords.some((kw) => lower.includes(kw));

  const complexKeywords = [
    "buat", "bikin", "catat", "tambah", "hapus", "ubah", "bayar",
    "transaksi", "invoice", "po ", "purchase", "surat jalan", "konfirmasi",
  ];
  const hasComplexKeyword = complexKeywords.some((kw) => lower.includes(kw));

  if (hasSimpleKeyword && !hasComplexKeyword) return "simple";
  return "complex";
};

// Global state untuk melacak index key (berlaku di server memory sementara)
let currentKeyIndex = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return errorResponse("Messages are required and must be an array", 400);
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      return errorResponse("API Key Groq belum dikonfigurasi di server.", 500);
    }

    const primaryModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const taskComplexity = detectTaskComplexity(messages);
    const model = taskComplexity === "simple" ? "llama-3.1-8b-instant" : primaryModel;

    // Batasi context
    const limitedMessages = messages.slice(-14);
    let lastError = null;

    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const currentKey = apiKeys[currentKeyIndex % apiKeys.length];

      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: limitedMessages,
            temperature: 0.05,
            max_tokens: 2048,
            stop: null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.error?.message || `HTTP ${response.status}`;

          if (response.status === 429 || response.status === 401 || response.status === 403) {
            console.warn(`[AI Chat] Key ${currentKeyIndex} failed [${response.status}]. Rotating...`);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            lastError = new Error(`Key failed: ${errMsg}`);
            continue;
          }

          throw new Error(`Groq API Error: ${errMsg}`);
        }

        const data = await response.json();
        return NextResponse.json({ success: true, data });
      } catch (error: any) {
        if (!error.message.startsWith("Groq API Error:")) {
          console.warn(`[AI Chat] Network error on key ${currentKeyIndex}: ${error.message}. Rotating...`);
          currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    return errorResponse(`Semua ${apiKeys.length} API Key Groq gagal. Error: ${lastError?.message}`, 500);
  } catch (error: any) {
    console.error("[API_AI_CHAT_ERROR]", error);
    return errorResponse(error.message || "Terjadi kesalahan server saat memproses AI.");
  }
}
