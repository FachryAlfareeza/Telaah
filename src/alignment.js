export const ratings = { aligned: { label: 'Selaras', value: 1 }, partial: { label: 'Sebagian selaras', value: 0.5 }, discrepancy: { label: 'Ada ketidaksesuaian', value: 0 } };
const normalize = v => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
export function evidenceIssues(a = {}, sources = [], tor = '') {
  if (!ratings[a.rating]) return ['Belum ditinjau'];
  const issues = [], source = sources.find(s => s.key === a.sourceKey);
  if (!a.torLocation?.trim()) issues.push('Lengkapi lokasi TOR');
  if (!normalize(a.torQuote) || !normalize(tor).includes(normalize(a.torQuote))) issues.push('Kutipan TOR harus terdapat pada teks TOR');
  if (!source?.title?.trim()) issues.push('Pilih dokumen pendukung yang bernama');
  if (!a.sourceLocation?.trim()) issues.push('Lengkapi pasal / halaman acuan');
  if (!normalize(a.sourceQuote) || !normalize(source?.text).includes(normalize(a.sourceQuote))) issues.push('Kutipan acuan harus terdapat pada teks dokumen pendukung');
  if (!a.reason?.trim()) issues.push('Jelaskan dasar perbandingan');
  if (!a.confirmed) issues.push('Konfirmasikan hasil tinjauan');
  return issues;
}
export function summarize(items, answers = {}, sources = [], tor = '') {
  const reviewed = items.filter(i => !evidenceIssues(answers[i.key], sources, tor).length);
  const points = reviewed.reduce((sum, i) => sum + ratings[answers[i.key].rating].value, 0);
  return { total: items.length, reviewed: reviewed.length, pending: items.length - reviewed.length, coverage: Math.round(reviewed.length / items.length * 100), alignment: reviewed.length ? Math.round(points / reviewed.length * 100) : null, discrepancies: reviewed.filter(i => answers[i.key].rating !== 'aligned').length, points };
}
