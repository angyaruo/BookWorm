// Local visual/test harness. Dictionary data is real; AI responses are simulated.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createDictionary } from '../src/dictionary.js';
const dictionary = createDictionary(path => readFile(new URL(`../data/${path}`, import.meta.url),'utf8'));
export function previewServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/lookup') {
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify(await dictionary.lookup(url.searchParams.get('q') || '')));
        return;
      }
      const files = { '/':['../tests/preview.html','text/html'], '/preview.js':['../tests/preview.js','text/javascript'], '/dist/frontend.js':['../dist/frontend.js','text/javascript'] };
      const file = files[url.pathname];
      if (!file) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type',`${file[1]}; charset=utf-8`);
      res.end(await readFile(new URL(file[0],import.meta.url)));
    } catch (error) { res.writeHead(500,{'Content-Type':'text/plain'}).end(error.message); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  previewServer().listen(4173,'127.0.0.1',() => console.log('BookWorm preview: http://127.0.0.1:4173 (AI simulated)'));
}
