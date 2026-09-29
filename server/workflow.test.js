import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from './database.js';
import {initWorkflow,submissionInput,referenceInput,referenceActive,records,save,newSubmission,publicSubmission,decide} from './workflow.js';
import {normalizeScreening,screenSubmission,requiredAspects} from './workflow-screening.js';
import {workflowApi} from './workflow-api.js';
const pdf={name:'contoh.pdf',data:Buffer.from('%PDF-1.4\nTest fixture only\n%%EOF').toString('base64')};
const satker={role:'satker',email:'unit@example.test',name:'Unit Test',satker:'Satker A'},rocan={role:'rocan',email:'review@example.test',name:'Rocan Test'};
const input={title:'Pelatihan contoh',description:'Tujuan kegiatan contoh',date:'2026-09-29',type:'Pelatihan',combined:true,tor:pdf};
const ref={id:'r1',title:'Acuan contoh',type:'Renstra',start:'2026-03-01',end:null,enabled:true,file:pdf};
const finding={key:'goals',aspect:'Tujuan',status:'aligned',severity:'info',location:'TOR halaman 1',quote:'Tujuan contoh',reason:'Sesuai acuan',calculation:'Kualitatif',correction:'Tinjau',confidence:85,references:[{id:'r1',location:'Halaman 1',quote:'Sasaran contoh'}]};
test('Combined and separate TOR/RAB uploads enforce required documents and valid dates',()=>{
  assert.equal(submissionInput(input).rab,null);
  assert.throws(()=>submissionInput({...input,combined:false}),/PDF/);
  assert.equal(submissionInput({...input,combined:false,rab:pdf}).rab.name,pdf.name);
  assert.throws(()=>submissionInput({...input,date:'2026-02-30'}),/Tanggal/);
  assert.throws(()=>submissionInput({...input,tor:{...pdf,data:'bm90IHBkZg=='}}),/PDF/);
});
test('Reference periods are inclusive, allow open ends, and respect manual disable',()=>{
  assert.equal(referenceActive(ref,'2026-02-28'),false);
  assert.equal(referenceActive(ref,'2026-03-01'),true);
  assert.equal(referenceActive(ref,'2030-01-01'),true);
  assert.equal(referenceActive({...ref,end:'2026-09-29'},'2026-09-29'),true);
  assert.equal(referenceActive({...ref,end:'2026-09-29'},'2026-09-30'),false);
  assert.equal(referenceActive({...ref,enabled:false},'2026-09-29'),false);
  assert.throws(()=>referenceInput({...ref,start:'2026-10-01',end:'2026-09-01'}),/Periode/);
});
test('Missing aspects and invalid references never masquerade as complete screening',()=>{
  const result=normalizeScreening({summary:'Contoh',findings:[finding]},[ref]);
  assert.equal(result.findings.length,6);assert.equal(result.confidence,null);
  const bad=normalizeScreening({summary:'Contoh',findings:[{...finding,status:'discrepancy',severity:'fatal',references:[{id:'unknown',quote:'x',location:'x'}]}]},[ref]);
  assert.equal(bad.fatal,false);assert.equal(bad.findings[0].status,'insufficient');
  const good=normalizeScreening({summary:'Contoh',findings:Object.keys(requiredAspects).map(key=>({...finding,key}))},[ref]);
  assert.equal(good.confidence,85);assert.equal(good.fatal,false);
});
test('Satker sees correction findings only; Rocan sees full results and confidence',()=>{
  const s={...newSubmission(input,satker),screening:{summary:'Full',demo:false,fatal:false,confidence:85,findings:[finding,{...finding,status:'partial'}]}};
  const publicResult=publicSubmission(s,satker,true);
  assert.equal(publicResult.screening.findings.length,1);assert.equal(publicResult.screening.confidence,undefined);assert.equal(publicResult.screening.findings[0].confidence,undefined);assert.equal(publicResult.tor.data,undefined);
  assert.equal(publicSubmission(s,rocan,true).screening.confidence,85);
});
test('Only Rocan decides queued submissions; decisions require reasons and cannot repeat',()=>{
  const s={...newSubmission(input,satker),status:'queued'};
  assert.throws(()=>decide(s,satker,{decision:'approved',note:'x'}),/Rocan/);
  assert.throws(()=>decide(s,rocan,{decision:'approved',note:''}),/Catatan/);
  const approved=decide(s,rocan,{decision:'approved',note:'Dokumen ditinjau.'});
  assert.equal(approved.status,'approved');assert.equal(approved.history.length,2);
  assert.throws(()=>decide(approved,rocan,{decision:'rejected',note:'x'}),/sudah/);
});
test('Workflow API persists revision/resubmission/decision flow and enforces role boundaries',async()=>{
  const db=openDatabase(':memory:');initWorkflow(db);
  const call=async(actor,path,method='GET',body={})=>{let result;await workflowApi({url:'/api/workflow/'+path,method,headers:{'x-telaah-profile':encodeURIComponent(JSON.stringify(actor)),host:'localhost'}},{},db,(res,status,data)=>{result={status,data};},async()=>body);return result;};
  try {
    assert.equal((await call(satker,'references','POST',ref)).status,400);
    assert.equal((await call(rocan,'references','POST',ref)).status,201);
    const doc=records(db,'reference')[0];
    assert.equal((await call(rocan,`references/${doc.id}`,'PATCH',{enabled:false})).status,200);
    assert.equal(records(db,'reference')[0].enabled,false);
    assert.equal((await call(rocan,`references/${doc.id}`,'PATCH',{enabled:true,end:'2025-01-01'})).status,400);
    const created=await call(satker,'submissions','POST',input),id=created.data.id;assert.equal(created.status,201);
    assert.equal((await call({...satker,email:'other@example.test'},`submissions/${id}`)).status,404);
    assert.equal((await call({...satker,email:'other@example.test'},'submissions')).data.length,0);
    const revision=await call(satker,`submissions/${id}/screen`,'POST',{demo:true,scenario:'revision'});assert.equal(revision.data.status,'needs_revision');assert.equal(revision.data.screening.findings.length,2);
    const retry=await call(satker,`submissions/${id}`,'PUT',{...input,title:'Revisi kegiatan'});assert.equal(retry.data.status,'pending_screening');
    const screened=await call(satker,`submissions/${id}/screen`,'POST',{demo:true,scenario:'pass'});assert.equal(screened.data.status,'queued');assert.equal(screened.data.screening.findings.length,0);
    const full=await call(rocan,`submissions/${id}`);assert.equal(full.data.screening.confidence,88);assert.equal(full.data.screening.findings.length,2);
    assert.equal((await call(satker,`submissions/${id}/decision`,'POST',{decision:'approved',note:'Ya'})).status,400);
    assert.equal((await call(rocan,`submissions/${id}/decision`,'POST',{decision:'approved',note:'Ditinjau.'})).data.status,'approved');
    assert.equal(records(db,'submission')[0].status,'approved');
    assert.equal((await call(satker,`submissions/${id}`,'PUT',input)).status,400);
    const pending=await call(satker,'submissions','POST',{...input,combined:false,rab:pdf});
    assert.equal((await call(satker,`submissions/${pending.data.id}`,'PUT',{...input,tor:null})).status,400);
    assert.equal((await call(rocan,`submissions/${pending.data.id}/decision`,'POST',{decision:'approved',note:'x'})).status,400);
  } finally {db.close();}
});
test('AI request includes separate RAB and reference PDFs; response confidence is validated',async()=>{
  const oldKey=process.env.OPENAI_API_KEY,oldModel=process.env.OPENAI_MODEL;process.env.OPENAI_API_KEY='test-only';process.env.OPENAI_MODEL='test-only';
  try {
    let payload;
    const result=await screenSubmission({...input,rab:pdf},[ref],{fetchImpl:async(url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'Contoh',findings:Object.keys(requiredAspects).map(key=>({...finding,key}))})}]}]})};}});
    assert.equal(payload.input[0].content.filter(c=>c.type==='input_file').length,3);assert.equal(payload.store,false);assert.equal(result.confidence,85);
    await assert.rejects(()=>screenSubmission(input,[]),/acuan aktif/);
  } finally {if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=oldModel;}
});
