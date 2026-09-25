export const categories = [
  { id: 'III.A', title: 'Keselarasan strategis', description: 'Selaras dengan PN/RPJMN/RKP/PKPN/Renstra/Direktif Presiden/Direktif Menteri?', short: 'Keselarasan strategis', items: [
    { id: 'III.A.1', criteria: 'Terdapat keterkaitan dengan PN/RPJMN/RKP/PKPN/Renstra/Direktif Presiden/Direktif Menteri?', source: 'Kepmen', feedback: 'Tambahkan informasi keterkaitan dengan PN/RPJMN/RKP/PKPN/Renstra/Direktif Presiden/Direktif Menteri?' }
  ] },
  { id: 'III.B', title: 'Kerangka logis', description: 'Sesuai dengan kerangka logis?', short: 'Kerangka logis', items: [
    { id: 'III.B.1', criteria: 'Terdapat Output dan Sasaran Kegiatan yang memiliki keterkaitan logis dengan kinerja di atasnya', source: 'Kepmen', feedback: 'Tambahkan informasi Output dan Sasaran Kegiatan yang memiliki keterkaitan logis dengan kinerja di atasnya' },
    { id: 'III.B.2', criteria: 'Terdapat Sasaran Kegiatan yang memiliki keterkaitan logis dengan indikator dan target dalam Rencana Kerja Pemerintah (RKP)', source: 'Kepmen', feedback: 'Tambahkan informasi Sasaran Kegiatan yang memiliki keterkaitan logis dengan indikator dan target dalam Rencana Kerja Pemerintah (RKP)' },
    { id: 'III.B.3', criteria: 'Terdapat penjelasanan mengenai keterkaitan Komponen terhadap pencapaian Rincian Output', source: 'Kepmen', feedback: 'Tambahkan penjelasan mengenai keterkaitan Komponen terhadap pencapaian Rincian Output' },
    { id: 'III.B.4', criteria: 'Terdapat informasi yang sesuai dengan prinsip SMART yaitu Spesific, Measurable, Achivable, Relevant, dan Time-Bound', source: 'Kepmen', feedback: 'Tambahkan informasi yang sesuai dengan prinsip SMART yaitu Spesific, Measurable, Achivable, Relevant, dan Time-Bound' }
  ] },
  { id: 'III.C', title: 'Kualitas dokumen', description: 'Sesuai standar kualitas dokumen perencanaan?', short: 'Kualitas dokumen', items: [
    { id: 'III.C.1', criteria: 'Terdapat penjelesan mengenai Rincian Output dalam aspek 5W + 1H (what, why, who, when, where, how)', source: 'Kepmen', feedback: 'Tambahkan penjelasan mengenai Rincian Output dalam aspek 5W + 1H (what, why, who, when, where, how)' },
    { id: 'III.C.2', criteria: 'Terdapat penjelasan mengenai manajemen risiko program yang berupa identifikasi kejadian, kondisi, atau faktor yang berpotensi memengaruhi pencapaian Rincian Output, beserta strategi mitigasinya', source: 'Kepmen', feedback: 'Tambahkan penjelasan mengenai manajemen risiko program yang berupa identifikasi kejadian, kondisi, atau faktor yang berpotensi memengaruhi pencapaian Rincian Output, beserta strategi mitigasinya' }
  ] }
];
export const checklist = categories.flatMap(category => category.items.map(item => ({ ...item, category: category.id, key: item.id.replaceAll('.', '_') })));
