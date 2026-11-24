// Kebijakan password TB Masdar Utama (24 Nov 2026).
//
// SATU-SATUNYA sumber kebenaran untuk aturan password — dipakai server-side
// oleh SEMUA tempat password diatur (buat user, edit user, ganti password,
// reset password, route API ganti password) DAN client-side (checklist +
// zod schema) supaya client tidak bisa mem-bypass server.
//
// Aturan (diputuskan user, berlaku persis):
//   - minimal 8 karakter
//   - maksimal 128 karakter
//   - minimal 1 huruf BESAR (A-Z)
//   - minimal 1 angka (0-9)
//   - minimal 1 simbol (karakter apa pun selain huruf/angka, mis. ! @ # $ %)
// Tidak ada syarat huruf kecil.
//
// File ini murni TypeScript tanpa import server — aman dipakai di server
// action, route API, zod schema, DAN komponen client.
//
// Password lama yang sudah tersimpan di DB TIDAK dipaksa berubah oleh patch
// ini; kebijakan baru berlaku saat password berikutnya dibuat/diubah.
// Password default bersama kasir/admin yang lemah sebaiknya segera diganti
// lewat form ganti password (aturan baru akan memaksa password yang kuat).

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Satu pesan penolakan yang sama di semua tempat, supaya mudah dites dan
// mudah dikenali user.
export const PASSWORD_ERROR_MESSAGE =
  "Password harus minimal 8 karakter, maksimal 128 karakter, mengandung minimal 1 huruf besar, 1 angka, dan 1 simbol.";

export interface PasswordRule {
  id: "minLength" | "maxLength" | "uppercase" | "number" | "symbol";
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "minLength",
    label: "Minimal 8 karakter",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "maxLength",
    label: "Maksimal 128 karakter",
    test: (password) => password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "uppercase",
    label: "Ada huruf besar (A-Z)",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "Ada angka (0-9)",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "symbol",
    label: "Ada simbol (mis. ! @ # $ %)",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export interface PasswordChecklistItem {
  id: PasswordRule["id"];
  label: string;
  passed: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  /** Aturan yang belum terpenuhi (kosong kalau valid). */
  failedRules: PasswordChecklistItem[];
  /** Semua aturan beserta status lolos/tidaknya — untuk checklist client. */
  checklist: PasswordChecklistItem[];
}

/** Cek satu password terhadap semua aturan. */
export function validatePassword(password: string): PasswordValidationResult {
  const checklist: PasswordChecklistItem[] = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password ?? ""),
  }));
  const failedRules = checklist.filter((item) => !item.passed);
  return { valid: failedRules.length === 0, failedRules, checklist };
}

/** Jalan pintas boolean — true hanya kalau semua aturan lolos. */
export function isStrongPassword(password: string): boolean {
  return validatePassword(password).valid;
}

export type PasswordStrengthLabel = "Lemah" | "Cukup" | "Kuat" | "Sangat kuat";

export interface PasswordStrength {
  /** Jumlah aturan yang lolos (0-5). */
  score: number;
  label: PasswordStrengthLabel;
}

/**
 * Indikator kekuatan sederhana. Hanya tampilan — yang menentukan
 * boleh/tidaknya password tetap validatePassword().
 * Password yang belum lolos semua aturan maksimal dinilai "Cukup",
 * supaya checklist tidak pernah menyebut password yang ditolak itu kuat.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "Lemah" };
  const result = validatePassword(password);
  const passed = result.checklist.filter((item) => item.passed).length;
  if (!result.valid) {
    return { score: passed, label: passed <= 2 ? "Lemah" : "Cukup" };
  }
  if (password.length >= 12) return { score: 5, label: "Sangat kuat" };
  return { score: 4, label: "Kuat" };
}
