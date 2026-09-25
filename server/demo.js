import { demoTor, demoQuestion } from '../src/demo-content.js';
import { importDocuments } from './database.js';
import { groundAnalysis } from './analysis.js';
export function seedDemo(db) {
  if (db.prepare('SELECT id FROM documents WHERE id=?').get('demo-training')) return;
  importDocuments(db,[{ id:'demo-training',title:'Acuan Simulasi Pelatihan — BUKAN peraturan nyata',type:'Contoh fiktif',version:'Simulasi v1',isDemo:true,passages:[{ location:'Ketentuan contoh §1 · Volume',text:'Untuk program contoh, satu angkatan pelatihan wajib diikuti paling sedikit 100 peserta.' },{ location:'Ketentuan contoh §2 · Penerimaan',text:'Tarif program contoh adalah Rp250.000 per peserta. Target penerimaan dihitung dari jumlah peserta dikalikan tarif per peserta.' }] }]);
}
export function demoAnalysis(db) {
  const passages = db.prepare('SELECT p.*, d.title,d.version,d.url FROM passages p JOIN documents d ON d.id=p.document_id WHERE d.id=?').all('demo-training');
  const raw = { summary:'Simulasi menemukan dua hal untuk ditinjau: volume 80 peserta berada di bawah minimum contoh, dan penerimaan belum konsisten dengan tarif × volume.',findings:[
    { aspect:'Volume peserta',status:'discrepancy',torQuote:'Kegiatan menargetkan 80 peserta dalam satu angkatan.',torLocation:'Bagian 2 · Volume peserta',reasoning:'Acuan fiktif menetapkan minimum 100 peserta per angkatan. TOR contoh mencantumkan 80 peserta, kurang 20 peserta (20% dari minimum). Ini perbandingan dalam lingkup satu angkatan yang sama.',recommendation:'Pertimbangkan penyesuaian volume menjadi paling sedikit 100 peserta, atau klarifikasi apakah ada pengecualian yang sah.',citations:[{ passageId:'demo-training:1',quote:passages.find(p => p.id === 'demo-training:1').text }] },
    { aspect:'Target penerimaan',status:'partial',torQuote:'Tarif ditetapkan Rp250.000 per peserta. Target penerimaan adalah Rp18.000.000.',torLocation:'Bagian 3 · Penerimaan',reasoning:'Tarif Rp250.000 sesuai acuan contoh. Namun 80 × Rp250.000 = Rp20.000.000, bukan Rp18.000.000 (selisih Rp2.000.000). Jika volume menjadi 100 peserta, target menjadi Rp25.000.000. Periksa apakah ada pembebasan tarif sebelum mengubah TOR.',recommendation:'Rekonsiliasi volume, tarif, dan target penerimaan. Dokumentasikan pengecualian apabila ada.',citations:[{ passageId:'demo-training:2',quote:passages.find(p => p.id === 'demo-training:2').text }] }
  ],limitations:['Seluruh TOR, ketentuan, dan jawaban ini adalah contoh fiktif yang telah disiapkan; bukan hasil panggilan AI.', 'Persentase hanya merangkum dua aspek pada simulasi ini, bukan akurasi atau kelayakan TOR secara keseluruhan.'] };
  return { ...groundAnalysis(raw,passages,{ kind:'text',text:demoTor }),demo:true,question:demoQuestion,generatedAt:new Date().toISOString(),inputKind:'text',scope:{ usedPassages:2,totalPassages:2,omittedPassages:0 } };
}
