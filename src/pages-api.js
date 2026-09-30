import {newSubmission,submissionInput,referenceInput,referenceActive,todayJakarta,publicSubmission,decide,requireRocan} from '../shared/workflow.js';
import {simulationScreening} from '../shared/workflow-simulation.js';

// Pages has no server. Keep uploaded demo files in this browser only.
function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('telaah-pages-demo',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Penyimpanan browser tidak tersedia. Izinkan penyimpanan situs untuk menjalankan demo.'));
  });
}
async function transaction(mode,callback) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records',mode),store=tx.objectStore('records');let value;
    tx.oncomplete=()=>{db.close();resolve(value);};
    tx.onerror=()=>{db.close();reject(Error('Data tidak dapat disimpan. Penyimpanan browser mungkin penuh.'));};
    tx.onabort=()=>{db.close();reject(Error('Penyimpanan dibatalkan. Coba kembali.'));};
    callback(store,result=>{value=result;});
  });
}
const all=()=>transaction('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result);});
const save=(kind,record)=>transaction('readwrite',(store,done)=>{store.put({...record,kind});done(record);});

export async function pagesApi(user,path,method='GET',body={}) {
  if(!['satker','rocan'].includes(user.role)||!user.email)throw Error('Masuk kembali untuk menjalankan demo.');
  const url=new URL(path,'https://demo.local/'),[kind,id,action]=url.pathname.slice(1).split('/'),rows=await all();
  if(kind==='references') {
    requireRocan(user);
    const docs=rows.filter(r=>r.kind==='reference'),d=docs.find(r=>r.id===id);
    if(method==='GET'&&!id)return docs.map(({file,...r})=>({...r,file:{name:file.name},activeNow:referenceActive(r,todayJakarta())}));
    if(method==='GET'&&action==='file'&&d)return d.file;
    if(method==='POST'&&!id){const record={...referenceInput(body),id:crypto.randomUUID(),createdAt:new Date().toISOString(),by:user.name};await save('reference',record);return {id:record.id};}
    if(method==='PATCH'&&d){await save('reference',{...d,...referenceInput({...d,...body,file:d.file}),updatedAt:new Date().toISOString(),by:user.name});return {ok:true};}
  }
  if(kind==='submissions') {
    const submissions=rows.filter(r=>r.kind==='submission'&&(user.role==='rocan'||r.owner===user.email));
    if(method==='GET'&&!id)return submissions.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(s=>publicSubmission(s,user));
    if(method==='POST'&&!id){if(user.role!=='satker')throw Error('Pengajuan dibuat oleh Satker.');const s=newSubmission(body,user);await save('submission',s);return publicSubmission(s,user,true);}
    const s=submissions.find(r=>r.id===id);if(!s)throw Error('Pengajuan tidak ditemukan.');
    if(method==='GET'&&action==='file'){const file=url.searchParams.get('kind')==='rab'?s.rab:s.tor;if(!file)throw Error('Berkas tidak tersedia.');return file;}
    if(method==='GET'&&!action)return publicSubmission(s,user,true);
    if(method==='PUT'&&!action){
      if(user.role!=='satker'||!['needs_revision','pending_screening'].includes(s.status))throw Error('Pengajuan ini tidak dapat diedit.');
      if(body.combined===true&&!s.combined&&!body.tor)throw Error('Unggah PDF gabungan baru yang memuat TOR dan RAB.');
      const now=new Date().toISOString(),updated={...s,...submissionInput({...body,tor:body.tor||s.tor,rab:body.rab||s.rab}),status:'pending_screening',screening:null,screeningError:null,decision:null,updatedAt:now,history:[...s.history,{at:now,by:user.name,action:'Diajukan ulang'}]};
      await save('submission',updated);return publicSubmission(updated,user,true);
    }
    if(method==='POST'&&action==='screen'){
      if(body.demo!==true)throw Error('GitHub Pages hanya menyediakan simulasi. AI nyata memerlukan server.');
      if(s.status!=='pending_screening')throw Error('Pengajuan ini sudah menjalani screening.');
      const screening=simulationScreening([],body.scenario),status=screening.fatal?'needs_revision':'queued',now=new Date().toISOString();
      const updated={...s,screening,status,screeningError:null,updatedAt:now,history:[...s.history,{at:now,by:'Simulasi',action:status}]};
      await save('submission',updated);return publicSubmission(updated,user,true);
    }
    if(method==='POST'&&action==='decision'){const updated=decide(s,user,body);await save('submission',updated);return publicSubmission(updated,user,true);}
  }
  throw Error('Tindakan tidak tersedia pada demo ini.');
}
