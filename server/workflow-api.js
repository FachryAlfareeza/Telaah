import { randomUUID } from 'node:crypto';
import { initWorkflow,records,save,actorFrom,requireRocan,referenceInput,referenceActive,todayJakarta,publicSubmission,newProgram,programList,attachProgram,newSubmission,reviseSubmission,submissionFile,decide } from './workflow.js';
import { screenSubmission,simulationScreening } from './workflow-screening.js';
const busy=new Set();
export async function workflowApi(req,res,db,send,readBody) {
  const url=new URL(req.url,'http://localhost'), path=url.pathname;
  if(!path.startsWith('/api/workflow/')) return false;
  initWorkflow(db);
  try {
    const actor=actorFrom(req);
    if(req.method!=='GET' && req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)) {send(res,403,{error:'Asal permintaan tidak diizinkan.'});return true;}
    const parts=path.split('/').filter(Boolean), kind=parts[2], id=parts[3], action=parts[4];
    const programs=programList(records(db,'program'),records(db,'submission'));
    if(kind==='programs'){
      if(req.method==='GET'&&!id){send(res,200,programs.filter(p=>actor.role==='rocan'||p.owner===actor.email));return true;}
      if(req.method==='POST'&&!id){const p=newProgram(await readBody(req),actor);save(db,'program',p);send(res,201,p);return true;}
    }
    if(kind==='references') {
      requireRocan(actor);
      const docs=records(db,'reference');
      if(req.method==='GET'&&!id) {send(res,200,docs.map(({file,...d})=>({...d,file:{name:file.name},activeNow:referenceActive(d,todayJakarta())})));return true;}
      if(req.method==='GET'&&id&&action==='file') {const d=docs.find(d=>d.id===id);if(!d)throw Error('Acuan tidak ditemukan.');send(res,200,d.file);return true;}
      const body=await readBody(req);
      if(req.method==='POST'&&!id) { const d={...referenceInput(body),id:randomUUID(),createdAt:new Date().toISOString(),by:actor.name};save(db,'reference',d);send(res,201,{id:d.id});return true; }
      if(req.method==='PATCH'&&id) {const d=docs.find(d=>d.id===id);if(!d)throw Error('Acuan tidak ditemukan.'); const updated=referenceInput({...d,...body,file:d.file});save(db,'reference',{...d,...updated,updatedAt:new Date().toISOString(),by:actor.name});send(res,200,{ok:true});return true;}
    }
    if(kind==='submissions') {
      const all=records(db,'submission'), canSee=s=>actor.role==='rocan'||s.owner===actor.email;
      if(req.method==='GET'&&!id) {send(res,200,all.filter(canSee).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(s=>publicSubmission(s,actor)));return true;}
      if(req.method==='POST'&&!id) {if(actor.role!=='satker')throw Error('Pengajuan dibuat oleh Satker.');const s=newSubmission(attachProgram(await readBody(req),actor,programs),actor);save(db,'submission',s);send(res,201,publicSubmission(s,actor,true));return true;}
      const s=all.find(s=>s.id===id&&canSee(s));
      if(!s) {send(res,404,{error:'Pengajuan tidak ditemukan.'});return true;}
      if(req.method==='GET'&&action==='file') {const f=submissionFile(s,url.searchParams.get('kind'),url.searchParams.get('version'));send(res,200,f);return true;}
      if(req.method==='GET'&&!action) {send(res,200,publicSubmission(s,actor,true));return true;}
      if(req.method==='PUT'&&!action) {
        if(actor.role!=='satker'||!['needs_revision','pending_screening'].includes(s.status)||busy.has(id))throw Error('Pengajuan ini tidak dapat diedit.');
        const body=await readBody(req), now=new Date().toISOString();
        if(body.combined===true&&!s.combined&&!body.tor) throw Error('Unggah PDF gabungan baru yang memuat TOR dan RAB.');
        const latest=records(db,'submission').find(r=>r.id===id);
        if(latest.updatedAt!==s.updatedAt||busy.has(id)) throw Error('Pengajuan telah berubah. Muat ulang sebelum mengedit.');
        const updated=reviseSubmission(s,attachProgram(body,actor,programs,s),actor);save(db,'submission',updated);send(res,200,publicSubmission(updated,actor,true));return true;
      }
      if(req.method==='POST'&&action==='decision') {const body=await readBody(req),latest=records(db,'submission').find(r=>r.id===id);const updated=decide(latest,actor,body);save(db,'submission',updated);send(res,200,publicSubmission(updated,actor,true));return true;}
      if(req.method==='POST'&&action==='screen') {
        if(s.status!=='pending_screening')throw Error('Screening hanya untuk pengajuan yang menunggu screening.');
        if(busy.has(id)||busy.size>=2)throw Error('Screening sedang berjalan. Coba lagi nanti.');
        const body=await readBody(req);
        if(busy.has(id)||busy.size>=2||records(db,'submission').find(r=>r.id===id).updatedAt!==s.updatedAt)throw Error('Pengajuan berubah atau screening sedang berjalan. Muat ulang.');
        busy.add(id);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
        try {
          const refs=records(db,'reference').filter(d=>referenceActive(d,s.date));
          const screening=body.demo===true?simulationScreening(refs,body.scenario):await screenSubmission(s,refs,{signal:controller.signal});
          const status=screening.fatal?'needs_revision':screening.findings.some(f=>f.status==='insufficient')?'manual_review':'queued';
          const updated={...s,screening,status,screeningError:null,updatedAt:new Date().toISOString(),history:[...s.history,{at:new Date().toISOString(),by:screening.demo?'Simulasi':'AI',action:status}]};save(db,'submission',updated);send(res,200,publicSubmission(updated,actor,true));
        } catch(e) {save(db,'submission',{...s,screeningError:e.message});send(res,503,{error:e.message});}
        finally {clearTimeout(timer);busy.delete(id);} return true;
      }
    }
    send(res,404,{error:'Endpoint tidak ditemukan.'});
  } catch(e) {send(res,400,{error:e.message});} return true;
}
