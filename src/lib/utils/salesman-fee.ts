// Hitung fee salesman satu invoice.
//
// File ini SENGAJA tanpa "use server": Next.js melarang fungsi export
// yang bukan async di dalam file "use server" (build gagal dengan
// "Server Actions must be async functions"), padahal calcSalesmanFee
// memang fungsi murni (pure function) tanpa I/O. Karena itu fungsinya
// tinggal di sini dan di-import dari src/lib/actions/salesman.actions.ts.

// Hitung fee satu invoice. Pure function — dipakai getSalesmanDetail dan
// bisa dipakai ulang di tempat lain supaya angkanya selalu sama.
export function calcSalesmanFee(
  grandTotal: number,
  globalEnabled: boolean,
  globalPercent: number,
  saleFeeEnabled: boolean | null | undefined,
  saleFeePercent: number | null | undefined
): { enabled: boolean; percent: number; amount: number } {
  // MASTER RULE: global MATI -> fee Rp0, apa pun override per invoice.
  const enabled = globalEnabled && (saleFeeEnabled ?? true);
  const percent = saleFeePercent ?? globalPercent;
  const amount = enabled ? Math.floor((grandTotal * percent) / 100) : 0;
  return { enabled, percent, amount };
}
