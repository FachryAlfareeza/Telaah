import { readFileSync } from 'node:fs';
import { openDatabase, importDocuments, library } from './database.js';
if (!process.argv[2]) { console.error('Usage: node --env-file-if-exists=.env server/import-references.js references.json'); process.exit(1); }
const db = openDatabase();
try { importDocuments(db,JSON.parse(readFileSync(process.argv[2],'utf8'))); console.log(`Reference library: ${library(db).length} active documents.`); } finally { db.close(); }
