export const CATEGORIES = [
  { key: "magang", label: "Magang", color: "#136A40", hint: "lowongan internship, program magang perusahaan/startup/lab" },
  { key: "loker", label: "Loker", color: "#0F4D30", hint: "lowongan kerja full-time/part-time/freelance, bukan magang" },
  { key: "akademik", label: "Akademik", color: "#3E7CB1", hint: "kuliah, jadwal kelas, ujian, nilai, tugas, dosen, prodi, perwalian, KRS, wisuda" },
  { key: "proker_hmif", label: "Proker HMIF", color: "#22A866", hint: "program kerja atau kegiatan yang diselenggarakan HMIF ITB" },
  { key: "kegiatan_angkatan", label: "Kegiatan Angkatan", color: "#C9BBA7", hint: "acara internal satu angkatan: makrab, bukber, foto angkatan, iuran angkatan" },
  { key: "kegiatan_eksternal", label: "Kegiatan External", color: "#8A6D3B", hint: "acara dari luar HMIF: webinar, seminar, workshop, event unit/kampus lain, perusahaan" },
  { key: "perlombaan", label: "Perlombaan", color: "#B5562B", hint: "lomba, kompetisi, hackathon, CTF, call for team" },
  { key: "merch", label: "Merch", color: "#7A5BA6", hint: "penjualan merchandise, PO jaket/kaos/stiker, danusan" },
  { key: "beasiswa", label: "Beasiswa", color: "#9A6700", hint: "beasiswa, bantuan dana pendidikan, pendaftaran beasiswa" },
  { key: "lainnya", label: "Lainnya", color: "#9AA59F", hint: "tidak cocok dengan kategori lain" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];
export const categoryOf = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[9];
