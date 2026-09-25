import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, library, retrieve } from './database.js';
import { validateInput, analyzeWithAI } from './analysis.js';
import { seedDemo, demoAnalysis } from './demo.js';
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));
let database;
const getDatabase = () => { if (!database) { database = openDatabase(); seedDemo(database); } return database; };
const send = (res,status,body) => { res.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(body)); };
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 15000000) throw Error('Ukuran permintaan terlalu besar (PDF maksimum 10 MB).'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Error('Data permintaan tidak valid.'); }
}
let inFlight = 0;
export async function apiMiddleware(req,res,next) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/')) { next(); return; }
  try {
    if (req.method === 'GET' && path === '/api/status') {
      const documents = library(getDatabase());
      send(res,200,{ aiConfigured:!!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), documents, ready:!!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL && documents.some(d => !d.is_demo)), demoAvailable:true }); return;
    }
    if (req.method !== 'POST' || !['/api/analyze','/api/demo'].includes(path)) { send(res,404,{ error:'Endpoint tidak ditemukan.' }); return; }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) { send(res,403,{ error:'Asal permintaan tidak diizinkan.' }); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { send(res,415,{ error:'Gunakan format JSON.' }); return; }
    if (path === '/api/demo') { send(res,200,demoAnalysis(getDatabase())); return; }
    if (inFlight >= 2) { send(res,429,{ error:'Analisis sedang penuh. Coba kembali setelah analisis lain selesai.' }); return; }
    let body; try { body = await readBody(req); validateInput(body); } catch (error) { send(res,400,{ error:error.message }); return; }
    const references = retrieve(getDatabase(),body.prompt);
    if (!references.passages.length) { send(res,503,{ code:'EMPTY_LIBRARY',error:'Database belum berisi acuan nyata untuk TOR Anda. Contoh fiktif hanya digunakan dalam simulasi. Administrator perlu menambahkan acuan terlebih dahulu.' }); return; }
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) { send(res,503,{ code:'AI_NOT_CONFIGURED',error:'Layanan AI belum dikonfigurasi oleh administrator.' }); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),120000);
    res.on('close',() => controller.abort());
    inFlight++;
    try { const result = await analyzeWithAI({ ...body, references, apiKey:process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL, signal:controller.signal }); if (!res.destroyed) send(res,200,result); }
    catch (error) { if (!res.destroyed) send(res,502,{ error:controller.signal.aborted ? 'Analisis melewati batas waktu. Coba pertanyaan yang lebih spesifik.' : error.message }); }
    finally { clearTimeout(timeout); inFlight--; }
  } catch { if (!res.headersSent) send(res,500,{ error:'Database atau layanan lokal tidak tersedia. Hubungi administrator.' }); }
}
