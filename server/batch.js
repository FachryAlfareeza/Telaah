export function prepareChecks(body) {
  if (!Array.isArray(body.checks) || body.checks.length < 1 || body.checks.length > 10) throw Error('Masukkan 1–10 baris pemeriksaan.');
  const ids = new Set();
  for (const row of body.checks) {
    if (!row || typeof row.id !== 'string' || !row.id || row.id.length>100 || ids.has(row.id) || typeof row.aspect !== 'string' || !row.aspect.trim() || row.aspect.length>100 || typeof row.detail !== 'string' || !row.detail.trim() || row.detail.length>600) throw Error('Lengkapi aspek dan pemeriksaan pada setiap baris; ID harus unik.');
    ids.add(row.id);
  }
  body.prompt = body.checks.map((r,i)=>`${i+1}. ${r.aspect}: ${r.detail}`).join('\n');
}
export function coverRequestedChecks(raw, requested = []) {
  if (!requested.length) return raw;
  if (!Array.isArray(raw?.findings)) throw Error('AI tidak mengembalikan tabel hasil.');
  const findings = requested.flatMap(row => {
    const matches = raw.findings.filter(f => f.checkId === row.id);
    return matches.length ? matches.map(f => ({...f,aspect:row.aspect})) : [{checkId:row.id,aspect:row.aspect,status:'insufficient',torQuote:'',torLocation:'',reasoning:'AI belum menjawab baris pemeriksaan ini.',recommendation:'Ulangi pemeriksaan dengan lingkup yang lebih spesifik.',calculation:'Belum dapat dihitung: bukti belum tersedia.',citations:[]}];
  });
  return {...raw,findings};
}
