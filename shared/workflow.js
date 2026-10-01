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
export function programInput(b){return {programName:required(b.programName,'Nama program'),programMission:required(b.programMission,'Misi program',3000),programOutput:required(b.programOutput,'Output program',3000),programTarget:required(b.programTarget,'Sasaran program',1000)};}
export function newProgram(b,actor){if(actor.role!=='satker')throw Error('Program dibuat oleh Satker.');return {...programInput(b),id:randomUUID(),owner:actor.email,satker:actor.satker,createdAt:new Date().toISOString()};}
export function programList(programs,submissions){
  const list=[...programs];
  for(const s of submissions)if((!s.programId||s.programId===`legacy-${s.id}`)&&!list.some(p=>p.id===`legacy-${s.id}`))list.push({id:`legacy-${s.id}`,owner:s.owner,satker:s.satker,createdAt:s.createdAt,programName:s.programName||s.title,programMission:s.programMission||s.description,programOutput:s.programOutput||'Belum diisi',programTarget:s.programTarget||'Belum diisi',legacy:true});
  return list;
}
export function attachProgram(body,actor,programs,existing){
  const id=existing?(existing.programId||`legacy-${existing.id}`):body.programId;
  if(existing&&body.programId&&body.programId!==id)throw Error('Program induk pengajuan tidak dapat diubah.');
  const p=programs.find(p=>p.id===id&&p.owner===actor.email);
  if(!p)throw Error('Pilih program milik Satker Anda.');
  return {...body,...programInput(p),programId:p.id};
}
export function outputRows(s){return Array.isArray(s.ros)?s.ros:s.roName?[{id:'legacy-ro',code:s.roCode||'',name:s.roName,volume:s.roVolume,unit:s.roUnit}]:[];}
function validateOutputs(body){
  const rows=outputRows(body);
  if(!rows.length||rows.length>100)throw Error('Isi 1 sampai 100 Rincian Output.');
  const ids=new Set();
  return rows.map(r=>{if(!r||typeof r!=='object')throw Error('Rincian Output tidak valid.');const id=typeof r.id==='string'&&r.id.length<=100?r.id:randomUUID();if(ids.has(id))throw Error('ID Rincian Output harus unik.');ids.add(id);if(!Number.isFinite(Number(r.volume))||Number(r.volume)<=0)throw Error('Volume RO harus lebih dari nol.');return {id,code:typeof r.code==='string'?r.code.trim().slice(0,100):'',name:required(r.name,'Nama Rincian Output',1000),volume:Number(r.volume),unit:required(r.unit,'Satuan RO',100)};});
}
export function submissionInput(body) {
  if(!validDate(body.date)) throw Error('Tanggal kegiatan tidak valid.');
  if(typeof body.combined!=='boolean') throw Error('Pilih susunan dokumen TOR/RAB.');
  if(!Object.hasOwn(urgencies,body.urgency)) throw Error('Pilih tingkat urgensi kegiatan.');
  const ros=validateOutputs(body);
  return {programName:required(body.programName,'Nama program'),programMission:required(body.programMission,'Misi program',3000),programOutput:required(body.programOutput,'Output program',3000),programTarget:required(body.programTarget,'Sasaran program',1000),title:required(body.title,'Judul'),description:required(body.description,'Deskripsi',5000),date:body.date,type:required(body.type,'Jenis kegiatan'),otherType:body.type==='Lainnya'?required(body.otherType,'Jenis kegiatan lainnya'):'',urgency:body.urgency,urgencyReason:required(body.urgencyReason,'Alasan urgensi',3000),programId:body.programId||null,ros,combined:body.combined,tor:validatePdf(body.tor),rab:body.combined?null:validatePdf(body.rab)};
}
export const urgencies={'1':'Kategori 1','2':'Kategori 2','3':'Kategori 3','4':'Kategori 4'};
export const proposalFields={programName:'Nama program',programMission:'Misi program',programOutput:'Output program',programTarget:'Sasaran program',title:'Nama kegiatan',description:'Deskripsi kegiatan',date:'Tanggal kegiatan',type:'Jenis kegiatan',otherType:'Jenis lainnya',urgency:'Urgensi',urgencyReason:'Alasan urgensi',ros:'Rincian Output',combined:'Susunan dokumen'};
export function proposalSnapshot(s){return Object.fromEntries([...Object.keys(proposalFields),'programId','tor','rab'].map(k=>[k,k==='ros'?outputRows(s):s[k]??null]));}
export function proposalChanges(before,after){
  const changes=Object.keys(proposalFields).filter(k=>JSON.stringify(k==='ros'?outputRows(before):before[k]??null)!==JSON.stringify(k==='ros'?outputRows(after):after[k]??null)).map(field=>({field,before:field==='ros'?outputRows(before):before[field]??null,after:field==='ros'?outputRows(after):after[field]??null}));
  for(const field of ['tor','rab'])if(before[field]?.data!==after[field]?.data||before[field]?.name!==after[field]?.name)changes.push({field,before:before[field]?.name||null,after:after[field]?.name||null,replaced:!!before[field]&&!!after[field]&&before[field].data!==after[field].data});
  return changes;
}
export function proposalVersions(s){return s.versions?.length?s.versions:[{number:1,at:s.updatedAt||s.createdAt,by:s.owner,legacy:true,proposal:proposalSnapshot(s),changes:[]}];}
export function reviseSubmission(s,body,actor){
  if(actor.role!=='satker'||s.owner!==actor.email||!['needs_revision','pending_screening'].includes(s.status))throw Error('Pengajuan ini tidak dapat diedit.');
  if(body.combined===true&&!s.combined&&!body.tor)throw Error('Unggah PDF gabungan baru yang memuat TOR dan RAB.');
  const proposal=submissionInput({...body,tor:body.tor||s.tor,rab:body.rab||s.rab}),now=new Date().toISOString(),versions=proposalVersions(s);
  return {...s,...proposal,status:'pending_screening',screening:null,screeningError:null,decision:null,updatedAt:now,versions:[...versions,{number:versions.length+1,at:now,by:actor.name,proposal,changes:proposalChanges(s,proposal)}],history:[...s.history,{at:now,by:actor.name,action:'Diajukan ulang',note:`Versi ${versions.length+1}`} ]};
}
export function submissionFile(s,kind,version){
  const source=version?proposalVersions(s).find(v=>String(v.number)===version)?.proposal:s;
  const file=source?.[kind==='rab'?'rab':'tor'];if(!file)throw Error('Berkas atau versi tidak tersedia.');return file;
}
export function referenceInput(body) {
  if(!validDate(body.start)|| (body.end && (!validDate(body.end)||body.end<body.start))) throw Error('Periode acuan tidak valid. Tanggal akhir harus setelah atau sama dengan tanggal mulai.');
  return {title:required(body.title,'Judul acuan'),type:required(body.type,'Jenis acuan'),start:body.start,end:body.end||null,enabled:body.enabled!==false,file:validatePdf(body.file)};
}
export function referenceActive(doc,date) { return doc.enabled && doc.start<=date && (!doc.end||doc.end>=date); }
export function todayJakarta() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function publicSubmission(s,actor,detail=false) {
  const {tor,rab,screening,versions,...rest}=s;
  const screen = !screening ? null : actor.role==='rocan' ? screening : {demo:screening.demo,summary:screening.demo?'Simulasi alur, bukan pemeriksaan dokumen.':screening.fatal?'Perbaiki temuan berikut dan ajukan ulang.':'Screening awal selesai. Menunggu peninjauan Rocan.',findings:screening.findings.filter(f=>f.status!=='aligned').map(({confidence,...f})=>f)};
  return {...rest,isSimulation:screening?.demo===true,tor:{name:tor.name},rab:rab?{name:rab.name}:null,...(detail?{screening:screen,versions:proposalVersions(s).map(v=>({...v,proposal:{...v.proposal,tor:v.proposal.tor?{name:v.proposal.tor.name}:null,rab:v.proposal.rab?{name:v.proposal.rab.name}:null}}))}:{})};
}
export function newSubmission(body,actor) { const now=new Date().toISOString(),proposal=submissionInput(body); return {...proposal,id:randomUUID(),owner:actor.email,satker:actor.satker,status:'pending_screening',createdAt:now,updatedAt:now,screening:null,versions:[{number:1,at:now,by:actor.name,proposal,changes:[]}],history:[{at:now,by:actor.name,action:'Diajukan',note:'Versi 1'}]}; }
export function decide(s,actor,body) {
  requireRocan(actor);
  if(!['queued','manual_review'].includes(s.status)) throw Error('Pengajuan belum siap atau sudah diputuskan.');
  if(!['approved','rejected','needs_revision'].includes(body.decision)) throw Error('Keputusan tidak valid.');
  const note=required(body.note,'Catatan keputusan',3000), now=new Date().toISOString();
  return {...s,status:body.decision,updatedAt:now,decision:{by:actor.name,at:now,note,status:body.decision},history:[...s.history,{at:now,by:actor.name,action:body.decision,note}]};
}
