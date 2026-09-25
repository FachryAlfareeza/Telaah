import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, importDocuments, library, retrieve } from './database.js';
import { seedDemo, demoAnalysis } from './demo.js';
import { validateInput, groundAnalysis, analyzeWithAI } from './analysis.js';
const fixture = [{ id:'test',title:'Test reference',type:'Fixture',version:'1',passages:[{ location:'Section 1',text:'Minimum 100 participants.' }] }];
const tor = { kind:'text',text:'We plan 80 participants.' };
const passage = { id:'test:1',title:'Test reference',version:'1',location:'Section 1',url:'',text:'Minimum 100 participants.' };
const raw = { summary:'Review volume.',findings:[{ aspect:'Volume',status:'discrepancy',torQuote:'80 participants',torLocation:'Volume section',reasoning:'80 is 20 below the minimum of 100.',recommendation:'Review volume.',citations:[{ passageId:'test:1',quote:'Minimum 100 participants.' }] }],limitations:['Fixture only'] };
test('Database imports and updates atomically, retrieves only real active references',() => {
  const db=openDatabase(':memory:'); seedDemo(db); importDocuments(db,fixture); assert.equal(library(db).length,2); assert.equal(retrieve(db,'participants').passages.length,1);
  importDocuments(db,[{ ...fixture[0],active:false }]); assert.equal(retrieve(db,'participants').passages.length,0); db.close();
});
test('Simulated result is explicitly labeled and never enters real retrieval',() => { const db=openDatabase(':memory:'); seedDemo(db); const r=demoAnalysis(db); assert.equal(r.demo,true); assert.equal(r.score,25); assert.equal(r.coverage,100); assert.equal(retrieve(db,'peserta').passages.length,0); db.close(); });
test('Citations must match the database and TOR text',() => {
  assert.equal(groundAnalysis(raw,[passage],tor).score,0);
  const forged=structuredClone(raw); forged.findings[0].citations[0].quote='Minimum 50 participants.';
  assert.equal(groundAnalysis(forged,[passage],tor).score,null);
  const wrongTor=structuredClone(raw); wrongTor.findings[0].torQuote='500 participants';
  assert.equal(groundAnalysis(wrongTor,[passage],tor).findings[0].status,'insufficient');
});
test('Unavailable evidence is excluded from denominator and remains a visible gap',() => { const r=structuredClone(raw); r.findings.push({ ...r.findings[0],aspect:'Revenue',status:'insufficient',citations:[] }); const out=groundAnalysis(r,[passage],tor); assert.equal(out.coverage,50); assert.equal(out.total,2); assert.equal(out.score,0); });
test('PDF input has signature and size validation',() => { assert.throws(() => validateInput({prompt:'Check',tor:{kind:'pdf',data:Buffer.from('not a PDF').toString('base64')}})); assert.doesNotThrow(() => validateInput({prompt:'Check',tor:{kind:'pdf',data:Buffer.from('%PDF-1.7\nfixture').toString('base64')}})); assert.throws(() => validateInput({prompt:'',tor})); });
test('Responses request uses server-side references and structured output',async () => {
  let sent;
  const result=await analyzeWithAI({prompt:'Check volume',tor,references:{passages:[passage],totalPassages:1,omittedPassages:0},apiKey:'test-only',model:'test-model',fetchImpl:async (url,options) => { sent=JSON.parse(options.body); return {ok:true,json:async () => ({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(raw)}]}]})}; }});
  assert.equal(sent.store,false); assert.equal(sent.text.format.strict,true); assert.equal(result.findings[0].citations[0].location,'Section 1'); assert.equal(result.score,0);
});
test('Incomplete model responses are not presented as an analysis',async () => { await assert.rejects(analyzeWithAI({prompt:'Check',tor,references:{passages:[]},apiKey:'test',model:'test',fetchImpl:async () => ({ok:true,json:async () => ({status:'incomplete'})})}),/tidak selesai/); });
test('PDF is delivered as native input, with TOR citations marked for review',async () => {
  let sent; const pdf={kind:'pdf',data:Buffer.from('%PDF-1.7 fixture').toString('base64')};
  const out=await analyzeWithAI({prompt:'Check',tor:pdf,references:{passages:[passage]},apiKey:'test',model:'test',fetchImpl:async (url,options) => { sent=JSON.parse(options.body); return {ok:true,json:async () => ({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(raw)}]}]})}; }});
  assert.equal(sent.input[0].content[1].type,'input_file'); assert.ok(out.findings[0].checks.some(c=>c.includes('PDF asli')));
});
