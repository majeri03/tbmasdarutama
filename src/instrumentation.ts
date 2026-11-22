/**
 * instrumentation.ts — Next.js 16: register() jalan sekali saat server
 * (Node.js) mulai.
 *
 * SECURITY FIX (22 Nov 2026, pentest L-4): validasi env di src/lib/env.ts
 * sebelumnya TIDAK PERNAH berjalan — tidak ada satu file pun yang
 * meng-import-nya, jadi hard-fail production tidak pernah terjadi dan
 * salah konfigurasi (mis. MOBILE_JWT_SECRET kosong/pendek) tidak
 * ketahuan saat boot. Di sini env di-import saat server mulai, sehingga
 * getParsedEnv() jalan: di production env tidak valid = server gagal
 * start (sengaja); secret < 32 karakter = warning di log (bukan hard-fail,
 * lihat env.ts — panjang secret produksi belum diketahui).
 *
 * Pengaman: register() dilewati saat `next build` (NEXT_PHASE =
 * phase-production-build) supaya build tidak gagal hanya karena env
 * build-time belum lengkap; dan hanya jalan di runtime Node.js.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import saja sudah menjalankan getParsedEnv() (lihat src/lib/env.ts).
    await import("@/lib/env");
    console.log("[ENV] Validasi environment selesai.");
  }
}
