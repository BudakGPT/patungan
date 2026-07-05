/** Renders a raw integer token amount (1 minor-unit = Rp1, §4.4) as Indonesian Rupiah. */
export function formatIDR(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? amount : Math.trunc(amount);
  return `Rp${n.toLocaleString("id-ID")}`;
}
