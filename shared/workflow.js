const randomUUID = () => globalThis.crypto.randomUUID();

export function initWorkflow(db) {
  db.exec('CREATE TABLE IF NOT EXISTS workflow_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL)');
}
export function records(db, kind) { return db.prepare('SELECT data FROM workflow_records WHERE kind=?').all(kind).map(r=>JSON.parse(r.data)); }
export function save(db, kind, value) { db.prepare('INSERT INTO workflow_records VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(value.id,kind,JSON.stringify(value)); return value; }
export function actorFrom(req) {
  let actor; try { actor=JSON.parse(decodeURIComponent(req.headers['x-telaah-profile'] || '')); } catch {}
  if (!actor || !['satker','rocan'].includes(actor.role) || typeof actor.email!=='string' || !actor.email.trim() || (actor.role==='satker' && !actor.satker?.trim())) throw Error('Masuk kembali dan pilih peran.');
  return actor;
}
export function requireRocan(actor) { if(actor.role!=='rocan') throw Error('Hanya Rocan yang dapat melakukan tindakan ini.'); }
export function validDate(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
export function validatePdf(file) {
  if(!file || typeof file.name!=='string' || !file.name.toLowerCase().endsWith('.pdf') || typeof file.data!=='string' || file.data.length>14000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.data)) throw Error('Unggah PDF yang valid, maksimum 10 MB per berkas.');
  const bytes=atob(file.data);
  if(bytes.length>10*1024*1024 || !bytes.slice(0,1024).includes('%PDF-')) throw Error('Isi berkas harus berupa PDF.');
  return {name:file.name.slice(0,200),data:file.data};
}
function required(value,label,max=200) { if(typeof value!=='string'||!value.trim()||value.length>max) throw Error(`${label} wajib diisi (maksimum ${max} karakter).`); return value.trim(); }
export function submissionInput(body) {
  if(!validDate(body.date)) throw Error('Tanggal kegiatan tidak valid.');
  if(typeof body.combined!=='boolean') throw Error('Pilih susunan dokumen TOR/RAB.');
  return {title:required(body.title,'Judul'),description:required(body.description,'Deskripsi',5000),date:body.date,type:required(body.type,'Jenis kegiatan'),combined:body.combined,tor:validatePdf(body.tor),rab:body.combined?null:validatePdf(body.rab)};
}
export function referenceInput(body) {
  if(!validDate(body.start)|| (body.end && (!validDate(body.end)||body.end<body.start))) throw Error('Periode acuan tidak valid. Tanggal akhir harus setelah atau sama dengan tanggal mulai.');
  return {title:required(body.title,'Judul acuan'),type:required(body.type,'Jenis acuan'),start:body.start,end:body.end||null,enabled:body.enabled!==false,file:validatePdf(body.file)};
}
export function referenceActive(doc,date) { return doc.enabled && doc.start<=date && (!doc.end||doc.end>=date); }
export function todayJakarta() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function publicSubmission(s,actor,detail=false) {
  const {tor,rab,screening,...rest}=s;
  const screen = !screening ? null : actor.role==='rocan' ? screening : {demo:screening.demo,summary:screening.demo?'Simulasi alur, bukan pemeriksaan dokumen.':screening.fatal?'Perbaiki temuan berikut dan ajukan ulang.':'Screening awal selesai. Menunggu peninjauan Rocan.',findings:screening.findings.filter(f=>f.status!=='aligned').map(({confidence,...f})=>f)};
  return {...rest,isSimulation:screening?.demo===true,tor:{name:tor.name},rab:rab?{name:rab.name}:null,...(detail?{screening:screen}:{})};
}
export function newSubmission(body,actor) { const now=new Date().toISOString(); return {...submissionInput(body),id:randomUUID(),owner:actor.email,satker:actor.satker,status:'pending_screening',createdAt:now,updatedAt:now,screening:null,history:[{at:now,by:actor.name,action:'Diajukan'}]}; }
export function decide(s,actor,body) {
  requireRocan(actor);
  if(!['queued','manual_review'].includes(s.status)) throw Error('Pengajuan belum siap atau sudah diputuskan.');
  if(!['approved','rejected','needs_revision'].includes(body.decision)) throw Error('Keputusan tidak valid.');
  const note=required(body.note,'Catatan keputusan',3000), now=new Date().toISOString();
  return {...s,status:body.decision,updatedAt:now,decision:{by:actor.name,at:now,note,status:body.decision},history:[...s.history,{at:now,by:actor.name,action:body.decision,note}]};
}
