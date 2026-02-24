import React, { useState, useEffect } from 'react';
import { AnalysisData, AnalysisResult } from './types';
import { MASTER_CP, PANCA_CINTA_KBC } from './database';
import Groq from "groq-sdk";
import { 
  Database, 
  ChevronRight, 
  FileText, 
  Edit3, 
  Trash2, 
  Plus, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Printer,
  Loader2
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  
  const [formData, setFormData] = useState<AnalysisData>({
    satuanPendidikan: '',
    namaGuru: '',
    nipGuru: '',
    namaKepala: '',
    nipKepala: '',
    mapel: 'Akidah Akhlak',
    fase: 'B',
    kelas: '3',
    tahunPelajaran: '2025/2026',
    titimangsa: `Pamarican, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    selectedElements: []
  });

  // Auto-populate elements from database when mapel/fase changes
  useEffect(() => {
    const phaseData = (MASTER_CP as any)[formData.fase];
    if (phaseData && phaseData[formData.mapel]) {
      const elements = phaseData[formData.mapel];
      // By default, we don't select anything, or maybe we select all?
      // The user wants to see all elements and then select.
      // Let's just reset selectedElements when mapel/fase changes if they are not manual
      setFormData(prev => ({
        ...prev,
        selectedElements: []
      }));
    }
  }, [formData.mapel, formData.fase]);

  const toggleElement = (elemen: string, cp: string, points?: string[]) => {
    setFormData(prev => {
      const exists = prev.selectedElements.find(e => e.elemen === elemen);
      if (exists) {
        return {
          ...prev,
          selectedElements: prev.selectedElements.filter(e => e.elemen !== elemen)
        };
      } else {
        return {
          ...prev,
          selectedElements: [...prev.selectedElements, { elemen, cp, isManual: false, selectedPoints: points ? [...points] : [] }]
        };
      }
    });
  };

  const togglePoint = (elementIdx: number, point: string) => {
    setFormData(prev => {
      const newElements = [...prev.selectedElements];
      const el = newElements[elementIdx];
      const currentPoints = el.selectedPoints || [];
      
      if (currentPoints.includes(point)) {
        el.selectedPoints = currentPoints.filter(p => p !== point);
      } else {
        el.selectedPoints = [...currentPoints, point];
      }
      
      return { ...prev, selectedElements: newElements };
    });
  };

  const updatePointText = (elementIdx: number, pointIdx: number, newText: string) => {
    setFormData(prev => {
      const newElements = [...prev.selectedElements];
      const el = newElements[elementIdx];
      if (el.selectedPoints) {
        const newPoints = [...el.selectedPoints];
        newPoints[pointIdx] = newText;
        el.selectedPoints = newPoints;
      }
      return { ...prev, selectedElements: newElements };
    });
  };

  const addManualElement = () => {
    setFormData(prev => ({
      ...prev,
      selectedElements: [...prev.selectedElements, { elemen: '', cp: '', isManual: true, selectedPoints: [''] }]
    }));
  };

  const addManualPoint = (elementIdx: number) => {
    setFormData(prev => {
      const newElements = [...prev.selectedElements];
      newElements[elementIdx].selectedPoints = [...(newElements[elementIdx].selectedPoints || []), ''];
      return { ...prev, selectedElements: newElements };
    });
  };

  const removeManualPoint = (elementIdx: number, pointIdx: number) => {
    setFormData(prev => {
      const newElements = [...prev.selectedElements];
      newElements[elementIdx].selectedPoints = newElements[elementIdx].selectedPoints?.filter((_, i) => i !== pointIdx);
      return { ...prev, selectedElements: newElements };
    });
  };

  const updateSelectedElement = (index: number, field: 'elemen' | 'cp', value: string) => {
    setFormData(prev => {
      const newElements = [...prev.selectedElements];
      newElements[index] = { ...newElements[index], [field]: value };
      return { ...prev, selectedElements: newElements };
    });
  };

  const removeSelectedElement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedElements: prev.selectedElements.filter((_, i) => i !== index)
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updateResultField = (idx: number, field: keyof AnalysisResult, value: any) => {
    setResults(prev => {
      const newResults = [...prev];
      newResults[idx] = { ...newResults[idx], [field]: value };
      return newResults;
    });
  };

  const toggleResultDpl = (idx: number, dplNum: number) => {
    setResults(prev => {
      const newResults = [...prev];
      const currentDpl = newResults[idx].dpl || [];
      if (currentDpl.includes(dplNum)) {
        newResults[idx].dpl = currentDpl.filter(d => d !== dplNum);
      } else {
        newResults[idx].dpl = [...currentDpl, dplNum];
      }
      return newResults;
    });
  };

  const toggleResultKbc = (idx: number, kbcNum: number) => {
    setResults(prev => {
      const newResults = [...prev];
      const currentKbc = newResults[idx].topikPancaCinta || [];
      if (currentKbc.includes(kbcNum)) {
        newResults[idx].topikPancaCinta = currentKbc.filter(k => k !== kbcNum);
      } else {
        newResults[idx].topikPancaCinta = [...currentKbc, kbcNum];
      }
      return newResults;
    });
  };

  const analyzeCP = async () => {
    if (formData.selectedElements.length === 0) {
      alert("Mohon pilih atau masukkan minimal satu elemen CP.");
      return;
    }

    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("Groq API Key tidak ditemukan. Silakan tambahkan VITE_GROQ_API_KEY di environment variables.");
      }
      
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      
      // Prepare elements for analysis - each point becomes a separate analysis task
      const tasks: { elemen: string; cp: string; point: string }[] = [];
      formData.selectedElements.forEach(el => {
        if (el.isManual || !el.selectedPoints || el.selectedPoints.length === 0) {
          tasks.push({ elemen: el.elemen, cp: el.cp, point: el.cp });
        } else {
          el.selectedPoints.forEach(p => {
            tasks.push({ elemen: el.elemen, cp: el.cp, point: p });
          });
        }
      });

      const prompt = `
        Tugas: Lakukan Analisis CP ke TP dengan Insersi KBC (Kurikulum Berbasis Cinta) untuk poin-poin spesifik berikut.
        Data Input:
        - Mapel: ${formData.mapel}
        - Fase: ${formData.fase}
        - Kelas: ${formData.kelas}
        
        Poin-poin yang dianalisis:
        ${tasks.map((t, i) => `${i+1}. [Elemen: ${t.elemen}] Poin: ${t.point}`).join('\n')}
        
        Referensi Panca Cinta KBC (Gunakan data ini untuk mengisi kolom MATERI KBC):
        ${JSON.stringify(PANCA_CINTA_KBC)}

        Output harus berupa JSON OBJECT dengan key "results" yang berisi ARRAY of objects dengan struktur:
        {
          "results": [{
            "elemen": "nama elemen",
            "deskripsiCP": "teks poin CP asli",
            "tpInsersiKBC": "Rumusan TP yang sudah menyisipkan nilai Panca Cinta (Gunakan format **teks** untuk mencetak tebal nilai KBC-nya).",
            "materi": "Uraikan materi esensial/pokok yang terkandung dalam CP asli tersebut.",
            "kelas": "${formData.kelas}",
            "dpl": [nomor DPL 1-8 yang relevan],
            "topikPancaCinta": [nomor Topik 1-5 yang relevan],
            "materiKBC": "Pilih 1-2 poin materi yang relevan dari referensi Panca Cinta KBC yang disediakan."
          }]
        }
        PENTING: 
        1. Jumlah objek dalam array "results" HARUS SAMA dengan jumlah poin yang dikirim (${tasks.length}).
        2. Kolom "materiKBC" HARUS mengambil referensi dari data Panca Cinta KBC yang disediakan, sedangkan kolom "materi" diisi dengan materi pokok dari CP.
        Berikan HANYA JSON object, tanpa teks penjelasan lain.
      `;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "Anda adalah pakar kurikulum MI yang ahli dalam integrasi KBC. Berikan output JSON murni berupa object dengan key 'results'." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
      });

      const content = chatCompletion.choices[0]?.message?.content || '{"results": []}';
      const parsed = JSON.parse(content);
      const resultData = parsed.results || parsed.data || (Array.isArray(parsed) ? parsed : []);
      
      setResults(resultData);
      setStep(2);
    } catch (error: any) {
      console.error(error);
      alert(`Gagal menganalisis: ${error.message || "Terjadi kesalahan pada AI"}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="green-gradient text-white p-4 shadow-md sticky top-0 z-50 no-print">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8" />
            <h1 className="text-xl font-bold uppercase tracking-tight">Analisis CP-TP Insersi KBC</h1>
          </div>
          <p className="text-xs opacity-80 hidden md:block">Aplikasi Pemetaan Kurikulum MI 2026</p>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 max-w-6xl">
        {loading && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 text-green-700 animate-spin" />
            <p className="font-bold text-green-900">AI sedang membedah CP & menyisipkan nilai KBC...</p>
          </div>
        )}

        {step === 1 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Identity */}
            <div className="lg:col-span-1 space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <FileText size={18} className="text-green-600" /> Identitas & Filter
              </h2>
              <div className="space-y-4">
                <Input label="Satuan Pendidikan" name="satuanPendidikan" value={formData.satuanPendidikan} onChange={handleInputChange} placeholder="MI ..." />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Fase" name="fase" value={formData.fase} onChange={handleInputChange} options={['A', 'B', 'C']} />
                  <Select label="Kelas" name="kelas" value={formData.kelas} onChange={handleInputChange} options={['1', '2', '3', '4', '5', '6']} />
                </div>
                <Select 
                  label="Mata Pelajaran" 
                  name="mapel" 
                  value={formData.mapel} 
                  onChange={handleInputChange} 
                  options={Object.keys((MASTER_CP as any)[formData.fase] || {})} 
                />
                <Input label="Nama Guru" name="namaGuru" value={formData.namaGuru} onChange={handleInputChange} />
                <Input label="NIP Guru" name="nipGuru" value={formData.nipGuru} onChange={handleInputChange} placeholder="198..." />
                <Input label="Nama Kepala" name="namaKepala" value={formData.namaKepala} onChange={handleInputChange} />
                <Input label="NIP Kepala" name="nipKepala" value={formData.nipKepala} onChange={handleInputChange} placeholder="197..." />
                <Input label="Titimangsa (Tempat, Tanggal)" name="titimangsa" value={formData.titimangsa} onChange={handleInputChange} placeholder="Contoh: Jatinagara, 23 Februari 2026" />
              </div>
            </div>

            {/* Right: CP Input */}
            <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Edit3 size={18} className="text-green-600" /> Capaian Pembelajaran (CP)
                </h2>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold uppercase">Multi-Element Mode</span>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Pilih Elemen (Dari Database)</label>
                    <button 
                      onClick={() => {
                        const allElements = (MASTER_CP as any)[formData.fase]?.[formData.mapel] || [];
                        setFormData(prev => ({
                          ...prev,
                          selectedElements: allElements.map((e: any) => ({ 
                            elemen: e.elemen, 
                            cp: e.cp, 
                            isManual: false, 
                            selectedPoints: e.points || [] 
                          }))
                        }));
                      }}
                      className="text-[10px] font-bold text-green-600 hover:underline flex items-center gap-1"
                    >
                      <CheckSquare size={12} /> Pilih Semua
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {((MASTER_CP as any)[formData.fase]?.[formData.mapel] || []).map((e: any) => {
                      const isSelected = formData.selectedElements.some(se => se.elemen === e.elemen);
                      return (
                        <button
                          key={e.elemen}
                          onClick={() => toggleElement(e.elemen, e.cp, e.points)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${isSelected ? 'bg-green-700 text-white border-green-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-green-400'}`}
                        >
                          {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}{e.elemen}
                        </button>
                      );
                    })}
                    <button
                      onClick={addManualElement}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 flex items-center gap-1.5"
                    >
                      <Plus size={12} /> Tambah Elemen Manual
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {formData.selectedElements.map((el, idx) => (
                    <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3 relative group animate-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={() => removeSelectedElement(idx)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Hapus Elemen"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Nama Elemen</label>
                        {el.isManual ? (
                          <input
                            type="text"
                            value={el.elemen}
                            onChange={(e) => updateSelectedElement(idx, 'elemen', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="Masukkan nama elemen..."
                          />
                        ) : (
                          <div className="text-sm font-bold text-green-800">{el.elemen}</div>
                        )}
                      </div>

                      {!el.isManual && (MASTER_CP as any)[formData.fase]?.[formData.mapel]?.find((e: any) => e.elemen === el.elemen)?.points && (
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">Pilih & Edit Poin CP (TP)</label>
                          <div className="grid grid-cols-1 gap-2">
                            {(MASTER_CP as any)[formData.fase][formData.mapel].find((e: any) => e.elemen === el.elemen).points.map((point: string, pIdx: number) => {
                              const isSelected = el.selectedPoints?.includes(point);
                              const selectedIdx = el.selectedPoints?.indexOf(point);
                              return (
                                <div key={pIdx} className="flex items-start gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected} 
                                    onChange={() => togglePoint(idx, point)}
                                    className="mt-1.5 h-4 w-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                                  />
                                  {isSelected ? (
                                    <textarea
                                      value={el.selectedPoints?.[selectedIdx!] || ''}
                                      onChange={(e) => updatePointText(idx, selectedIdx!, e.target.value)}
                                      className="flex-1 text-xs text-slate-700 leading-tight bg-white border border-green-200 rounded p-1 focus:ring-1 focus:ring-green-500 outline-none"
                                      rows={2}
                                    />
                                  ) : (
                                    <span className="text-xs text-slate-400 leading-tight py-1">{point}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {el.isManual && (
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">Poin CP (TP) Manual</label>
                          <div className="space-y-2">
                            {el.selectedPoints?.map((p, pIdx) => (
                              <div key={pIdx} className="flex gap-2">
                                <textarea
                                  value={p}
                                  onChange={(e) => updatePointText(idx, pIdx, e.target.value)}
                                  className="flex-1 text-xs text-slate-700 leading-tight border border-slate-200 rounded p-2 focus:ring-1 focus:ring-green-500 outline-none"
                                  placeholder={`Poin CP ${pIdx + 1}...`}
                                  rows={2}
                                />
                                <button onClick={() => removeManualPoint(idx, pIdx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                              </div>
                            ))}
                            <button onClick={() => addManualPoint(idx)} className="text-[10px] font-bold text-green-600 flex items-center gap-1 hover:underline"><Plus size={12} /> Tambah Poin</button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">
                          {el.isManual ? 'Deskripsi CP' : 'Deskripsi CP Lengkap (Referensi)'}
                        </label>
                        <textarea
                          value={el.cp}
                          onChange={(e) => updateSelectedElement(idx, 'cp', e.target.value)}
                          rows={el.isManual ? 4 : 2}
                          className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-green-500 outline-none transition-all"
                          placeholder="Masukkan deskripsi CP..."
                        />
                      </div>
                    </div>
                  ))}
                  
                  {formData.selectedElements.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                      <Database className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-sm">Belum ada elemen yang dipilih.<br/>Silakan pilih dari database atau tambah manual.</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={analyzeCP}
                  disabled={formData.selectedElements.length === 0}
                  className={`w-full py-4 green-gradient text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 ${formData.selectedElements.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                >
                  MULAI ANALISIS <Sparkles size={20} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Hasil Analisis LK-1</h2>
                <p className="text-sm text-slate-500">{formData.mapel} - Fase {formData.fase} - Kelas {formData.kelas}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setStep(1)} 
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Edit Data
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    window.focus();
                    setTimeout(() => {
                      window.print();
                    }, 250);
                  }} 
                  className="flex items-center gap-2 px-6 py-2 green-gradient text-white rounded-lg text-sm font-bold shadow-md hover:opacity-90 cursor-pointer transition-all active:scale-95"
                >
                  <Printer size={18} /> CETAK PDF
                </button>
              </div>
            </div>

            <div id="analysis-table" className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 overflow-x-auto print-page">
              <div className="mb-4 no-print text-[10px] text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-100 flex items-center gap-2">
                <Sparkles size={14} /> <b>Tips:</b> Anda dapat mengedit teks langsung di dalam tabel sebelum mendownload atau mencetak.
              </div>
              <div className="header-section mb-8">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                  <div className="flex-1">
                    <h3 className="header-title font-bold text-xl uppercase tracking-tight mb-4">LK-1 PEMETAAN CP-TP DENGAN 8 DPL DAN PANCA CINTA KBC</h3>
                    <table className="info-table text-sm font-medium">
                      <tbody>
                        <tr>
                          <td className="font-bold w-32">MATA PELAJARAN</td>
                          <td>: {formData.mapel.toUpperCase()}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">FASE</td>
                          <td>: {formData.fase}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">KLS</td>
                          <td>: {formData.kelas}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="legend-wrapper flex flex-col sm:flex-row gap-3 text-[9px] leading-tight no-print-flex">
                    {/* DPL Legend */}
                    <div className="legend-box bg-amber bg-amber-50 border border-amber-200 p-2 rounded-lg w-full sm:w-72">
                      <p className="font-bold mb-1 border-b border-amber-200 pb-1 uppercase">DPL (Dimensi Profil Lulusan)</p>
                      <div className="grid grid-cols-2 gap-x-3">
                        <div>1. Imtaq kpd Tuhan YME</div>
                        <div>5. Kolaborasi</div>
                        <div>2. Kewargaan</div>
                        <div>6. Kemandirian</div>
                        <div>3. Penalaran Kritis</div>
                        <div>7. Kesehatan</div>
                        <div>4. Kreativitas</div>
                        <div>8. Komunikasi</div>
                      </div>
                    </div>
                    {/* KBC Legend */}
                    <div className="legend-box bg-emerald bg-emerald-50 border border-emerald-200 p-2 rounded-lg w-full sm:w-56">
                      <p className="font-bold mb-1 border-b border-emerald-200 pb-1 uppercase">KBC (Kurikulum Berbasis Cinta)</p>
                      <div className="space-y-0.5">
                        <div>1. Cinta Allah dan Rasul-Nya</div>
                        <div>2. Cinta Ilmu</div>
                        <div>3. Cinta Lingkungan</div>
                        <div>4. Cinta diri dan sesama</div>
                        <div>5. Cinta Tanah Air</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse text-[10px] md:text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="border border-slate-400 p-2 w-20">ELEMEN</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-48">DESKRIPSI CP</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-64">TUJUAN PEMBELAJARAN INSERSI KBC</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-32">MATERI</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-12">KELAS</th>
                    <th colSpan={8} className="border border-slate-400 p-1 text-center bg-yellow-50">DIMENSI PROFIL LULUSAN (DPL)</th>
                    <th colSpan={5} className="border border-slate-400 p-1 text-center bg-green-50">TOPIK PANCA CINTA</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-48">MATERI KBC</th>
                  </tr>
                  <tr className="bg-slate-50">
                    {[1,2,3,4,5,6,7,8].map(n => <th key={n} className="border border-slate-400 p-1 w-6">{n}</th>)}
                    {[1,2,3,4,5].map(n => <th key={n} className="border border-slate-400 p-1 w-6">{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-400 p-2 font-bold text-center">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'elemen', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                        >
                          {row.elemen}
                        </div>
                      </td>
                      <td className="border border-slate-400 p-2 text-justify leading-tight">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'deskripsiCP', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                        >
                          {row.deskripsiCP}
                        </div>
                      </td>
                      <td className="border border-slate-400 p-2 text-justify leading-tight">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'tpInsersiKBC', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                          dangerouslySetInnerHTML={{ __html: (row.tpInsersiKBC || '').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }}
                        />
                      </td>
                      <td className="border border-slate-400 p-2">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'materi', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                        >
                          {row.materi}
                        </div>
                      </td>
                      <td className="border border-slate-400 p-2 text-center">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'kelas', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                        >
                          {row.kelas}
                        </div>
                      </td>
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <td key={n} className="border border-slate-400 p-1 text-center font-bold cursor-pointer hover:bg-yellow-100" onClick={() => toggleResultDpl(idx, n)}>
                          {row.dpl?.includes(n) ? 'V' : ''}
                        </td>
                      ))}
                      {[1,2,3,4,5].map(n => (
                        <td key={n} className="border border-slate-400 p-1 text-center font-bold bg-green-50/30 cursor-pointer hover:bg-green-100" onClick={() => toggleResultKbc(idx, n)}>
                          {row.topikPancaCinta?.includes(n) ? 'V' : ''}
                        </td>
                      ))}
                      <td className="border border-slate-400 p-2 italic text-slate-600">
                        <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updateResultField(idx, 'materiKBC', e.currentTarget.textContent)}
                          className="outline-none focus:bg-green-50 min-h-[1em]"
                        >
                          {row.materiKBC}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-8 grid grid-cols-2 gap-12 text-center text-sm">
                <div className="space-y-16">
                  <p>Mengetahui,<br/>Kepala Madrasah</p>
                  <div>
                    <p className="font-bold underline">{formData.namaKepala || '..............................'}</p>
                    <p>NIP. {formData.nipKepala || '..............................'}</p>
                  </div>
                </div>
                <div className="space-y-16">
                  <p>{formData.titimangsa || '..............................'}<br/>Guru Bidang</p>
                  <div>
                    <p className="font-bold underline">{formData.namaGuru || '..............................'}</p>
                    <p>NIP. {formData.nipGuru || '..............................'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t p-4 text-center text-xs text-slate-400 no-print">
        <p>&copy; 2026 Faisal Amin - Pamarican</p>
      </footer>
    </div>
  );
};

const Input = ({ label, name, value, onChange, placeholder }: any) => (
  <div className="space-y-1">
    <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
    <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm" />
  </div>
);

const Select = ({ label, name, value, onChange, options }: any) => (
  <div className="space-y-1">
    <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
    <select name={name} value={value} onChange={onChange} className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm bg-white">
      {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

export default App;
