/**
 * Curated local photography for campaigns without an uploaded image, keyed to the seeded
 * campaign ids (0–4) and cycled for anything beyond. Files live in `public/projects/` so the
 * demo never depends on a third-party CDN or hotlink policy.
 */
const visuals = [
  {
    // 0 · Atap Sekolah SDN 2 Cianjur
    image: "/projects/school.jpg",
    fundingTarget: 75_000_000n,
    location: "Cianjur, Jawa Barat",
    story:
      "Perbaikan atap kelas dan talang air sebelum musim hujan agar siswa bisa belajar aman.",
  },
  {
    // 1 · Sumur Bor Dusun Sumber
    image: "/projects/well.jpg",
    fundingTarget: 50_000_000n,
    location: "Lombok Timur, NTB",
    story:
      "Sumur bor komunitas memangkas 3 km perjalanan warga demi air bersih setiap hari.",
  },
  {
    // 2 · Dapur Umum Banjir Demak
    image: "/projects/flood.jpg",
    fundingTarget: 30_000_000n,
    location: "Demak, Jawa Tengah",
    story:
      "Dapur umum menyediakan makan hangat bagi keluarga terdampak banjir rob.",
  },
  {
    // 3 · Kebun Pangan Warga RW 5
    image: "/projects/garden.jpg",
    fundingTarget: 20_000_000n,
    location: "Blitar, Jawa Timur",
    story:
      "Bibit, kompos, dan irigasi tetes untuk kebun pangan yang dikelola warga.",
  },
  {
    // 4 · smoke-test / overflow
    image: "/projects/village.jpg",
    fundingTarget: 25_000_000n,
    location: "Blitar, Jawa Timur",
    story:
      "Kampanye komunitas yang dikurasi bersama warga desa.",
  },
  {
    image: "/projects/classroom.jpg",
    fundingTarget: 40_000_000n,
    location: "Sumedang, Jawa Barat",
    story:
      "Program belajar bersama untuk anak-anak usia sekolah dasar.",
  },
] as const;

/** Landing hero backdrop — local for the same no-hotlink reason. */
export const heroVisual = { image: "/projects/hero.jpg" } as const;

export function getProjectVisual(id: number) {
  return visuals[((id % visuals.length) + visuals.length) % visuals.length];
}
