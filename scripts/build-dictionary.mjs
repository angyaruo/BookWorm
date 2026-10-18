// Reproducible conversion of the official OEWN 2025 WNDB archive.
// Usage: npm run build:dictionary -- /path/to/extracted/oewn2025
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('Pass the extracted OEWN 2025 WNDB directory. See data/README.md.');
const output = resolve('data/lexicon');
const normalize = s => s.normalize('NFKC').toLowerCase().replace(/_/g, ' ').trim();
const display = s => s.replace(/\((?:a|p|ip)\)$/, '').replace(/_/g, ' ');
const posOf = p => p === 's' ? 'a' : p;
const synsets = new Map();
const wordIndex = Object.create(null);
const exceptions = Object.create(null);
const hashes = {};
async function lines(name) {
  const bytes = await readFile(resolve(source, name));
  hashes[name] = createHash('sha256').update(bytes).digest('hex');
  return bytes.toString('utf8').split(/\r?\n/);
}

for (const part of ['noun', 'verb', 'adj', 'adv']) {
  const input = await lines(`data.${part}`);
  if (part === 'noun') {
    await mkdir('licenses', { recursive: true });
    await writeFile('licenses/WORDNET-NOTICE.txt', input.filter(l => /^\s+\d+ /.test(l)).map(l => l.replace(/^\s+\d+ /, '').trimEnd()).join('\n') + '\n');
  }
  for (const line of input) {
    if (!/^\d{8} /.test(line)) continue;
    const divider = line.indexOf('|');
    const fields = line.slice(0, divider).trim().split(/\s+/);
    const gloss = line.slice(divider + 1).trim();
    const pos = posOf(fields[2]);
    const count = parseInt(fields[3], 16);
    const words = Array.from({ length: count }, (_, i) => display(fields[4 + i * 2]));
    let cursor = 4 + count * 2;
    const pointerCount = Number(fields[cursor++]);
    const pointers = [];
    for (let i = 0; i < pointerCount; i++) {
      const [type, offset, targetPos, slots] = fields.slice(cursor, cursor + 4);
      cursor += 4;
      if (type === '!' || type === '&' || type === '^') {
        pointers.push({ type, id: posOf(targetPos) + offset, from: parseInt(slots.slice(0, 2), 16), to: parseInt(slots.slice(2), 16) });
      }
    }
    // Examples are semicolon-delimited double-quoted clauses in WNDB glosses.
    const examples = [];
    const definition = gloss.replace(/(?:^|;\s*)"([^"]*)"(?=;|\s*$)/g, (_, example) => { examples.push(example); return ''; }).replace(/;\s*$/, '').trim();
    synsets.set(pos + fields[0], { pos, definition, examples, words, pointers });
  }
}

for (const [part, pos] of [['noun', 'n'], ['verb', 'v'], ['adj', 'a'], ['adv', 'r']]) {
  for (const line of await lines(`index.${part}`)) {
    if (!line || /^\s/.test(line)) continue;
    const fields = line.trim().split(/\s+/);
    const word = normalize(fields[0]);
    const offsets = fields.slice(6 + Number(fields[3]));
    const refs = offsets.map(offset => pos + offset);
    for (const ref of refs) if (!synsets.has(ref)) throw new Error(`Missing sense ${ref} for ${word}`);
    wordIndex[word] = [...(wordIndex[word] || []), ...refs];
  }
  for (const line of await lines(`${part}.exc`)) {
    if (!line.trim()) continue;
    const [form, ...bases] = line.trim().split(/\s+/).map(normalize);
    exceptions[form] = [...(exceptions[form] || []), ...bases.map(word => [word, pos])];
  }
}

const senseShards = new Map();
for (const [id, sense] of synsets) {
  const antonyms = [];
  const related = new Set();
  for (const pointer of sense.pointers) {
    const target = synsets.get(pointer.id);
    if (!target) continue;
    if (pointer.type === '!') {
      if (sense.words[pointer.from - 1] && target.words[pointer.to - 1]) {
        antonyms.push([normalize(sense.words[pointer.from - 1]), target.words[pointer.to - 1]]);
      }
    } else {
      for (const word of target.words) if (!sense.words.includes(word)) related.add(word);
    }
  }
  delete sense.pointers;
  sense.antonyms = antonyms;
  sense.related = [...related];
  const shard = id.slice(0, 3);
  if (!senseShards.has(shard)) senseShards.set(shard, Object.create(null));
  senseShards.get(shard)[id] = sense;
}
const indexShards = new Map();
for (const word of Object.keys(wordIndex).sort()) {
  const shard = /^[a-z]/.test(word) ? word[0] : '_';
  if (!indexShards.has(shard)) indexShards.set(shard, Object.create(null));
  indexShards.get(shard)[word] = wordIndex[word];
}
await mkdir(resolve(output, 'senses'), { recursive: true });
await mkdir(resolve(output, 'index'), { recursive: true });
let bytes = 0;
async function save(path, value) {
  const json = JSON.stringify(value) + '\n';
  bytes += Buffer.byteLength(json);
  await writeFile(resolve(output, path), json);
}
for (const [key, shard] of indexShards) await save(`index/${key}.json`, shard);
for (const [key, shard] of senseShards) await save(`senses/${key}.json`, shard);
await save('words.json', Object.keys(wordIndex).sort());
await save('exceptions.json', exceptions);
await save('metadata.json', {
  schema: 1, source: 'Open English WordNet', version: '2025',
  url: 'https://en-word.net/downloads', license: 'CC-BY-4.0',
  words: Object.keys(wordIndex).length, senses: synsets.size,
  archiveSha256: '38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93',
  inputSha256: hashes,
});
console.log(JSON.stringify({ words: Object.keys(wordIndex).length, senses: synsets.size, megabytes: +(bytes / 1024 / 1024).toFixed(2) }));
