import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { apiMiddleware } from './api.js';
const root = resolve('dist');
createServer((req,res) => apiMiddleware(req,res,async () => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const path = resolve(root,'.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    let data, extension;
    try { data = await readFile(path); extension = extname(path); } catch { data = await readFile(resolve(root,'index.html')); extension = '.html'; }
    const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png' };
    res.writeHead(200,{ 'Content-Type':types[extension] || 'application/octet-stream','X-Content-Type-Options':'nosniff' }); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Build the app before starting the production server.'); }
})).listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`Telaah: http://127.0.0.1:${process.env.PORT || 4173}`));
