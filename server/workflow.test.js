import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from './database.js';
import {initWorkflow,submissionInput,referenceInput,referenceActive,records,save,newSubmission,publicSubmission,decide,reviseSubmission,submissionFile,newProgram,programList,attachProgram,outputRows} from './workflow.js';
import {normalizeScreening,screenSubmission,requiredAspects} from './workflow-screening.js';
import {workflowApi} from './workflow-api.js';
const pdf={name:'contoh.pdf',data:Buffer.from('%PDF-1.4\nTest fixture only\n%%EOF').toString('base64')};
const satker={role:'satker',email:'unit@example.test',name:'Unit Test',satker:'Satker A'},rocan={role:'rocan',email:'review@example.test',name:'Rocan Test'};
const input={programName:'Program A',programMission:'Meningkatkan kompetensi',programOutput:'Lulusan pelatihan',programTarget:'Pegawai',urgency:'2',urgencyReason:'Kebutuhan tahunan',roName:'Peserta terlatih',roVolume:30,roUnit:'orang',title:'Pelatihan contoh',description:'Tujuan kegiatan contoh',date:'2026-09-29',type:'Pelatihan',combined:true,tor:pdf};
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
    const program=await call(satker,'programs','POST',input);assert.equal(program.status,201);
    assert.equal((await call(rocan,'programs','POST',input)).status,400);
    assert.equal((await call({...satker,email:'other@example.test'},'programs')).data.length,0);
    assert.equal((await call({...satker,email:'other@example.test'},'submissions','POST',{...input,programId:program.data.id})).status,400);
    const sibling=await call(satker,'submissions','POST',{...input,programId:program.data.id,title:'Sibling event',ros:[{id:'a',name:'Peserta',volume:30,unit:'orang'},{id:'b',name:'Laporan',volume:1,unit:'dokumen'}]});assert.equal(sibling.status,201);assert.equal(sibling.data.ros.length,2);
    const created=await call(satker,'submissions','POST',{...input,programId:program.data.id}),id=created.data.id;assert.equal(created.status,201);
    assert.equal((await call({...satker,email:'other@example.test'},`submissions/${id}`)).status,404);
    assert.equal((await call({...satker,email:'other@example.test'},'submissions')).data.length,0);
    const revision=await call(satker,`submissions/${id}/screen`,'POST',{demo:true,scenario:'revision'});assert.equal(revision.data.status,'needs_revision');assert.equal(revision.data.screening.findings.length,2);
    const retry=await call(satker,`submissions/${id}`,'PUT',{...input,title:'Revisi kegiatan'});assert.equal(retry.data.status,'pending_screening');
    const screened=await call(satker,`submissions/${id}/screen`,'POST',{demo:true,scenario:'pass'});assert.equal(screened.data.status,'queued');assert.equal(screened.data.screening.findings.length,0);
    const full=await call(rocan,`submissions/${id}`);assert.equal(full.data.screening.confidence,88);assert.equal(full.data.screening.findings.length,2);
    assert.equal((await call(satker,`submissions/${id}/decision`,'POST',{decision:'approved',note:'Ya'})).status,400);
    assert.equal((await call(rocan,`submissions/${id}/decision`,'POST',{decision:'approved',note:'Ditinjau.'})).data.status,'approved');
    assert.equal(records(db,'submission').find(s=>s.id===id).status,'approved');
    assert.equal((await call(satker,`submissions/${id}`,'PUT',input)).status,400);
    const pending=await call(satker,'submissions','POST',{...input,programId:program.data.id,combined:false,rab:pdf});
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

test('Planning fields, categories, and other activity type are validated',()=>{
  for(const urgency of ['1','2','3','4']) assert.equal(submissionInput({...input,urgency}).urgency,urgency);
  for(const invalid of [{urgency:'5'},{programName:''},{roVolume:0},{type:'Lainnya',otherType:''}])assert.throws(()=>submissionInput({...input,...invalid}));
  assert.equal(submissionInput({...input,type:'Lainnya',otherType:'Pendampingan teknis'}).otherType,'Pendampingan teknis');
});
test('Versions preserve old PDFs and field differences without leaking bytes in public responses',()=>{
  const first=newSubmission(input,satker),replacement={...pdf,data:Buffer.from('%PDF-1.4 new contents').toString('base64')};
  const second=reviseSubmission(first,{...input,title:'Judul baru',tor:replacement},satker);
  assert.equal(second.versions.length,2);assert.equal(second.versions[0].proposal.title,input.title);
  assert.equal(second.versions[1].changes.find(c=>c.field==='tor').replaced,true);
  assert.equal(submissionFile(second,'tor','1').data,pdf.data);assert.equal(submissionFile(second,'tor','2').data,replacement.data);
  assert.throws(()=>submissionFile(second,'tor','99'));
  assert.equal(publicSubmission(second,satker,true).versions[0].proposal.tor.data,undefined);
  assert.equal(publicSubmission(second,rocan).versions,undefined);
  assert.throws(()=>reviseSubmission(first,input,{...satker,email:'other@example.test'}));
  const {versions,...legacy}=first;
  assert.equal(reviseSubmission(legacy,input,satker).versions[0].legacy,true);
});

test('One program owns multiple independent events with multiple outputs and immutable version snapshots',()=>{
  const p=newProgram(input,satker),ros=[{id:'r1',code:'001',name:'Peserta terlatih',volume:30,unit:'orang'},{id:'r2',code:'002',name:'Laporan evaluasi',volume:1,unit:'laporan'}];
  const body=attachProgram({...input,programId:p.id,ros},satker,[p]);
  const a=newSubmission(body,satker),b=newSubmission({...body,title:'Kegiatan kedua'},satker);
  assert.equal(a.programId,b.programId);assert.notEqual(a.id,b.id);assert.equal(a.ros.length,2);
  const changed=reviseSubmission(a,{...body,ros:[{...ros[0],volume:40},ros[1],{id:'r3',name:'Panduan',volume:1,unit:'dokumen'}]},satker);
  assert.equal(changed.versions[0].proposal.ros.length,2);assert.equal(changed.versions[0].proposal.ros[0].volume,30);
  assert.equal(changed.versions[1].changes.find(c=>c.field==='ros').after.length,3);
  assert.equal(b.ros[0].volume,30);
  assert.throws(()=>attachProgram(body,{...satker,email:'other@example.test'},[p]));
  assert.throws(()=>attachProgram({...body,programId:'other'},satker,[p],a));
  for(const invalid of [[],[{...ros[0],volume:0}],[ros[0],ros[0]]])assert.throws(()=>submissionInput({...body,ros:invalid}));
  const old={...a,programId:null,ros:undefined,roName:'Legacy output',roVolume:2,roUnit:'orang'};
  assert.equal(outputRows(old).length,1);
  const parents=programList([], [old]);assert.equal(parents.length,1);
  const revised={...old,...attachProgram(input,satker,parents,old)};
  assert.equal(programList([], [revised]).length,1);
});
