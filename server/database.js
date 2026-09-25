import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function openDatabase(path = resolve(process.env.REFERENCE_DB || 'data/references.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, version TEXT NOT NULL, url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS passages (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, location TEXT NOT NULL, text TEXT NOT NULL);`);
  if (!db.prepare('PRAGMA table_info(documents)').all().some(c => c.name === 'is_demo')) db.exec('ALTER TABLE documents ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
  return db;
}
export function importDocuments(db, docs) {
  if (!Array.isArray(docs) || !docs.length) throw Error('Expected a nonempty array of reference documents.');
  const ids = new Set();
  for (const d of docs) {
    if (!d || !['id','title','type','version'].every(k => typeof d[k] === 'string' && d[k].trim()) || !Array.isArray(d.passages) || !d.passages.length || ids.has(d.id)) throw Error('Every document needs a unique id, title, type, version, and passages.');
    ids.add(d.id);
    if (d.url && !/^https?:\/\//i.test(d.url)) throw Error('Reference URLs must use http or https.');
    for (const p of d.passages) if (!p || !p.location?.trim() || !p.text?.trim() || p.text.length > 10000) throw Error('Each passage needs a location and text (maximum 10,000 characters); split long sections.');
  }
  db.exec('BEGIN');
  try {
    for (const d of docs) {
      db.prepare('INSERT INTO documents (id,title,type,version,url,active,is_demo) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,type=excluded.type,version=excluded.version,url=excluded.url,active=excluded.active,is_demo=excluded.is_demo').run(d.id,d.title,d.type,d.version,d.url || '',d.active === false ? 0 : 1,d.isDemo === true ? 1 : 0);
      db.prepare('DELETE FROM passages WHERE document_id = ?').run(d.id);
      d.passages.forEach((p,i) => db.prepare('INSERT INTO passages VALUES (?, ?, ?, ?)').run(`${d.id}:${i+1}`,d.id,p.location,p.text));
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function library(db) { return db.prepare('SELECT d.*, count(p.id) as passages FROM documents d LEFT JOIN passages p ON p.document_id=d.id WHERE d.active=1 GROUP BY d.id ORDER BY d.title').all(); }
export function retrieve(db, prompt, limit = 60000) {
  const all = db.prepare('SELECT p.id, p.document_id, p.location, p.text, d.title, d.type, d.version, d.url FROM passages p JOIN documents d ON d.id=p.document_id WHERE d.active=1 AND d.is_demo=0 ORDER BY p.id').all();
  const stop = new Set(['apakah','dengan','dalam','yang','sesuai','pada','untuk','dan','tor','the','with','this']);
  const terms = [...new Set(prompt.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].filter(t => !stop.has(t));
  const expanded = new Set(terms);
  if (terms.some(t => /peserta|participant|volume/.test(t))) ['peserta','participant','volume','kuota','orang'].forEach(t => expanded.add(t));
  if (terms.some(t => /pendapatan|revenue|penerimaan|tarif/.test(t))) ['pendapatan','revenue','penerimaan','tarif','pnbp','biaya'].forEach(t => expanded.add(t));
  const ranked = all.map(p => ({ ...p, rank: [...expanded].reduce((n,t) => n + (`${p.title} ${p.location} ${p.text}`.toLowerCase().includes(t) ? 1 : 0), 0) })).sort((a,b) => b.rank - a.rank);
  const passages = []; let size = 0;
  for (const p of ranked) { if (size + p.text.length > limit) continue; passages.push(p); size += p.text.length; }
  return { passages, totalPassages: all.length, omittedPassages: all.length - passages.length };
}
