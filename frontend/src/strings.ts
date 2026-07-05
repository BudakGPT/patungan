/** All UI copy lives here (Bahasa-first, §10). Components import from this module, never inline strings. */
export const strings = {
  appName: "Patungan",
  nav: {
    landing: "Beranda",
    results: "Hasil",
    operator: "Operator",
  },
  landing: {
    title: "Patungan",
    subtitle: "Urunan bersama, dicocokkan secara adil.",
  },
  project: {
    backToLanding: "Kembali ke beranda",
  },
  results: {
    title: "Hasil Pencocokan",
  },
  operator: {
    title: "Konsol Operator",
    gated: "Hubungkan wallet admin untuk mengakses konsol ini.",
  },
  loading: "Memuat…",
  empty: "Belum ada proyek",
  errorGeneric: "Terjadi kesalahan. Coba lagi.",
  retry: "Coba lagi",
} as const;
