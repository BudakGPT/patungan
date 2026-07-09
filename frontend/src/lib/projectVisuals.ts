const visuals = [
  {
    image:
      "https://cloudfront-us-east-1.images.arcpublishing.com/radiofreeasia/BIBYFOKS5ZOP5AGPRCYE4CKRGA.jpg",
    location: "Blitar, Jawa Timur",
    tag: "Crowd-backed",
    story:
      "Perbaikan atap kelas dan talang air sebelum musim hujan agar siswa bisa belajar aman.",
  },
  {
    image:
      "https://img.antaranews.com/cache/1200x800/2020/08/04/AC732DD5-3DB1-4AE8-AC65-9E86ECC76966.jpeg.webp",
    location: "Lombok Timur, NTB",
    tag: "Community",
    story:
      "Bibit, kompos, dan irigasi tetes untuk kebun komunitas yang dikelola kelompok ibu desa.",
  },
  {
    image:
      "https://www.greenpeace.org/static/planet4-indonesia-stateless/2023/06/7ba40bcd-gp0stwr23.jpg",
    location: "Demak, Jawa Tengah",
    tag: "Whale-funded",
    story:
      "Pompa dan instalasi air bersih untuk keluarga di area pesisir yang rawan kekeringan.",
  },
] as const;

export function getProjectVisual(id: number) {
  return visuals[id] ?? visuals[0];
}
