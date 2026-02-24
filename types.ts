
export interface AnalysisResult {
  elemen: string;
  deskripsiCP: string;
  tpInsersiKBC: string;
  materi: string;
  kelas: string;
  dpl: number[];
  topikPancaCinta: number[];
  materiKBC: string;
}

export interface SelectedElement {
  elemen: string;
  cp: string;
  isManual: boolean;
  selectedPoints?: string[];
}

export interface AnalysisData {
  satuanPendidikan: string;
  namaGuru: string;
  nipGuru: string;
  namaKepala: string;
  nipKepala: string;
  mapel: string;
  fase: string;
  kelas: string;
  tahunPelajaran: string;
  titimangsa: string;
  selectedElements: SelectedElement[];
}

export interface GeneratedContent {
  integrasiKBC: string;
  lintasDisiplin: string;
  kemitraan: string;
  lingkungan: string;
  pemanfaatanDigital: string;
  pengalamanBelajar: {
    pertemuan: number;
    memahami: string[];
    mengaplikasi: string[];
    refleksi: string[];
  }[];
  asesmenAwal: string;
  asesmenProses: string;
  asesmenAkhir: string;
  lkpd: {
    pertemuan: number;
    isi: string;
  }[];
}
