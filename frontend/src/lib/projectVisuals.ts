/**
 * Curated local photography for campaigns without an uploaded image, keyed to the seeded
 * campaign ids (0–6) and cycled for anything beyond. Files live in `public/projects/` so the
 * demo never depends on a third-party CDN or hotlink policy. Keep this array in the SAME order the
 * seed submits campaigns (scripts/seed.ts `CAMPAIGNS`) — the id is the index, so a reorder there
 * must be mirrored here or a campaign shows an unrelated photo.
 *
 * Note: the local set has no medical or place-of-worship photo, so the Health (#1) and Faith (#2)
 * campaigns fall back to the closest neutral image (children / village). Swap in a real photo by
 * dropping a file in `public/projects/` and pointing its entry here, or upload one per-campaign.
 */
const visuals = [
  {
    // 0 · Atap Sekolah SDN 2 Cianjur — Education
    image: "/projects/school.jpg",
    fundingTarget: 75_000_000n,
    location: "Cianjur, Jawa Barat",
    story:
      "Perbaikan atap kelas dan talang air sebelum musim hujan agar siswa bisa belajar aman.",
  },
  {
    // 1 · Operasi Jantung Bayi Arka — Health (no medical photo locally; children stand-in)
    image: "/projects/classroom.jpg",
    fundingTarget: 40_000_000n,
    location: "Bandung, Jawa Barat",
    story:
      "Menutup biaya operasi dan perawatan pascaoperasi bayi dengan kelainan jantung bawaan.",
  },
  {
    // 2 · Renovasi Masjid Al-Ikhlas — Faith & Community (no mosque photo locally; village stand-in)
    image: "/projects/village.jpg",
    fundingTarget: 35_000_000n,
    location: "Pekalongan, Jawa Tengah",
    story:
      "Memperbaiki atap dan tempat wudu masjid yang jadi pusat kegiatan warga nelayan.",
  },
  {
    // 3 · Tanam Mangrove Pesisir Demak — Environment & Animals
    image: "/projects/garden.jpg",
    fundingTarget: 30_000_000n,
    location: "Demak, Jawa Tengah",
    story:
      "Penanaman bibit mangrove menahan abrasi dan memulihkan habitat kepiting di pesisir.",
  },
  {
    // 4 · Sumur Bor Dusun Sumber — Developing Regions
    image: "/projects/well.jpg",
    fundingTarget: 50_000_000n,
    location: "Lombok Timur, NTB",
    story:
      "Sumur bor komunitas memangkas 3 km perjalanan warga demi air bersih setiap hari.",
  },
  {
    // 5 · Dapur Umum Banjir Demak — Disaster Relief
    image: "/projects/flood.jpg",
    fundingTarget: 30_000_000n,
    location: "Demak, Jawa Tengah",
    story:
      "Dapur umum menyediakan makan hangat bagi keluarga terdampak banjir rob.",
  },
  {
    // 6 · Kebun Pangan Warga RW 5 — Developing Regions
    image: "/projects/garden.jpg",
    fundingTarget: 20_000_000n,
    location: "Blitar, Jawa Timur",
    story:
      "Bibit, kompos, dan irigasi tetes untuk kebun pangan yang dikelola warga.",
  },
] as const;

/** Landing hero backdrop — local for the same no-hotlink reason. */
export const heroVisual = { image: "/projects/hero.jpg" } as const;

export function getProjectVisual(id: number) {
  return visuals[((id % visuals.length) + visuals.length) % visuals.length];
}
