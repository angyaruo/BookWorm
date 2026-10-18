import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createDictionary, normalizeWord } from '../src/dictionary.js';
import { registerBackend, TOKEN_LIMITS } from '../src/backend.js';
import { renderMarkdown } from '../src/markdown.js';

const read = path => readFile(new URL(`../data/${path}`, import.meta.url), 'utf8');
const dictionary = createDictionary(read);
test('real corpus: definitions, lexical antonyms, synonyms and examples', async () => {
  const happy = await dictionary.lookup('happy');
  assert(happy.entries.some(e => e.antonyms.includes('unhappy')));
  assert(happy.entries.some(e => e.examples.length));
  assert(happy.entries.every(e => e.definition && e.partOfSpeech));
  const obsolete = await dictionary.lookup('obsolete');
  assert(obsolete.entries.some(e => e.synonyms.length));
});
test('normalization, inflection and irregular forms', async () => {
  assert.equal(normalizeWord('  Ice_CREAM  '), 'ice cream');
  for (const [query, lemma, pos] of [['children','child','noun'], ['running','run','verb'], ['walked','walk','verb'], ['happier','happy','adjective']]) {
    assert((await dictionary.lookup(query)).entries.some(e => e.word === lemma && e.partOfSpeech === pos), query);
  }
  assert((await dictionary.lookup('ice cream')).entries.length);
});
test('missing words suggest corrections and malformed input is safe', async () => {
  assert((await dictionary.lookup('hapy')).suggestions.includes('happy'));
  assert.equal((await dictionary.lookup('<img src=x onerror=alert(1)>')).entries.length, 0);
  await dictionary.lookup('__proto__');
  await assert.rejects(dictionary.lookup(' '), /Search/);
  await assert.rejects(dictionary.lookup('a'.repeat(101)), /100/);
});
test('cached reads, concurrent lookups and recovery after failed reads', async () => {
  let reads = 0;
  const cached = createDictionary(path => { reads++; return read(path); });
  await Promise.all([cached.lookup('happy'), cached.lookup('happy')]);
  const count = reads;
  await cached.lookup('happy');
  assert.equal(reads, count);
  let broken = true;
  const retry = createDictionary(path => broken ? Promise.reject(new Error('missing')) : read(path));
  await assert.rejects(retry.lookup('happy'));
  broken = false;
  assert((await retry.lookup('happy')).entries.length);
});
test('all bundled index references resolve to complete senses', async () => {
  const root = new URL('../data/lexicon/', import.meta.url);
  const senses = {};
  for (const name of await readdir(new URL('senses/', root))) Object.assign(senses, JSON.parse(await readFile(new URL(`senses/${name}`, root))));
  let count = 0;
  for (const name of await readdir(new URL('index/', root))) {
    const index = JSON.parse(await readFile(new URL(`index/${name}`, root)));
    for (const [word, refs] of Object.entries(index)) {
      count++;
      for (const ref of refs) assert(senses[ref]?.definition, `${word}: ${ref}`);
    }
  }
  const metadata = JSON.parse(await read('lexicon/metadata.json'));
  assert.equal(count, metadata.words);
  assert.equal(Object.keys(senses).length, metadata.senses);
});

function backend(overrides = {}) {
  const messages = [], inputs = [], users = [];
  const api = {
    storage: { read }, log: { error() {} }, onFrontendMessage() {},
    sendToFrontend: (data, user) => messages.push({ ...data, user }),
    connections: { list: async user => { users.push(user); return [{ id:'test', is_default:true }]; } },
    generate: { quiet: async input => { inputs.push(input); return { content:'A complete answer.', finish_reason:'stop' }; } },
    ...overrides,
  };
  return { handle:registerBackend(api), messages, inputs, users };
}
const request = (extra = {}) => ({ type:'bookworm:consult', requestId:'request-1', query:'a word for old', mode:'tot', ...extra });
test('offline lookup and legacy thesaurus never use connections or generation', async () => {
  const fail = () => { throw new Error('must not be called'); };
  const b = backend({ connections:{list:fail}, generate:{quiet:fail} });
  for (const type of ['bookworm:lookup_word', 'bookworm:consult']) {
    await b.handle(request({type, mode:'thesaurus',query:'happy'}), 'user-1');
    assert(b.messages.at(-1).lookup.entries.length);
    assert.equal(b.messages.at(-1).user, 'user-1');
  }
});
test('quiet fallback preserves operator scope and increases output budget', async () => {
  const b = backend();
  await b.handle(request(), 'operator-9');
  assert.equal(b.inputs[0].userId, 'operator-9');
  assert.equal(b.inputs[0].type, 'quiet');
  assert.equal(b.inputs[0].parameters.max_tokens, TOKEN_LIMITS.tot);
  assert.equal(b.users[0], 'operator-9');
  await b.handle(request({mode:'translate', extendedOutput:true}), 'operator-9');
  assert.equal(b.inputs[1].parameters.max_tokens, 8192);
});
test('streaming preserves user scope, terminal content and length warning', async () => {
  let input;
  const b = backend({generate:{ async *quietStream(value) {
    input = value;
    yield {type:'token',token:'draft'};
    yield {type:'done',content:'<think>hidden</think>Final answer',finish_reason:'length'};
  } }});
  await b.handle(request(), 'operator-7');
  assert.equal(input.userId, 'operator-7');
  assert.equal(b.messages[0].text, 'draft');
  assert.equal(b.messages.at(-1).answer, 'Final answer');
  assert.match(b.messages.at(-1).warning, /output limit/);
});
test('cancellation is user-scoped and keeps partial output even when provider ignores abort', async () => {
  let sentFirst;
  const first = new Promise(resolve => { sentFirst = resolve; });
  let signal;
  const b = backend({generate:{quietStream(input) {
    signal = input.signal;
    let count = 0;
    return { [Symbol.asyncIterator]() { return this; }, next() {
      if (!count++) { sentFirst(); return Promise.resolve({value:{type:'token',token:'Already written.'},done:false}); }
      return new Promise(() => {});
    }, return() { return Promise.resolve({done:true}); } };
  } }});
  const pending = b.handle(request(), 'owner');
  await first;
  await new Promise(resolve => setImmediate(resolve));
  await b.handle({type:'bookworm:cancel',requestId:'request-1'}, 'other');
  assert.equal(signal.aborted, false);
  await b.handle({type:'bookworm:cancel',requestId:'request-1'}, 'owner');
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(b.messages.at(-1).answer, 'Already written.');
  assert.match(b.messages.at(-1).warning, /Stopped/);
});
test('timeout bounds a hung provider without dropping partial text', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const b = backend({generate:{async *quietStream() {
    yield {type:'token',token:'Partial sentence'};
    await new Promise(() => {});
  }}});
  const pending = b.handle(request({timeoutSeconds:300}), 'user');
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(299999);
  assert.equal(b.messages.at(-1).type, 'bookworm:result_chunk');
  t.mock.timers.tick(1);
  await pending;
  assert.equal(b.messages.at(-1).answer, 'Partial sentence');
  assert.match(b.messages.at(-1).warning, /300-second/);
});
test('missing saved connection does not silently use another provider', async () => {
  const b = backend();
  await b.handle(request({connectionId:'deleted'}),'user');
  assert.equal(b.inputs.length, 0);
  assert.match(b.messages.at(-1).error, /connection/);
});
test('stream failure preserves partial output and reports failure', async () => {
  const b = backend({generate:{async *quietStream() {
    yield {type:'token',token:'A useful beginning.'};
    throw new Error('Provider disconnected');
  }}});
  await b.handle(request(),'user');
  assert.equal(b.messages.at(-1).answer,'A useful beginning.');
  assert.match(b.messages.at(-1).warning,/Provider disconnected/);
});
test('bad lookup input and missing dictionary return actionable errors', async () => {
  const b = backend({storage:{read:async () => { throw new Error('ENOENT'); }}});
  await b.handle(request({type:'bookworm:lookup_word',query:'a'.repeat(101)}),'user');
  assert.match(b.messages.at(-1).error,/100 characters/);
  await b.handle(request({type:'bookworm:lookup_word',query:'happy'}),'user');
  assert.match(b.messages.at(-1).error,/reinstall BookWorm/);
});
test('installable manifest includes required dictionary and license seeds', async () => {
  const manifest = JSON.parse(await readFile(new URL('../spindle.json',import.meta.url)));
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
  assert.equal(manifest.version,pkg.version);
  assert(manifest.storage_seed_files.some(s => s.from === 'data/lexicon/' && s.to === 'lexicon/' && s.required && s.overwrite));
  assert(manifest.storage_seed_files.some(s => s.from === 'licenses/' && s.required));
  assert((await readFile(new URL('../licenses/CC-BY-4.0.txt',import.meta.url),'utf8')).includes('Creative Commons'));
});
test('safe Markdown renders headings, quotes and code without enabling HTML', () => {
  const html = renderMarkdown('# Title\n\n> **Quote**\n\n`code`\n\n```js\n<img onerror=evil()>\n```');
  assert.match(html, /<h1/); assert.match(html, /<blockquote/); assert.match(html, /<strong>Quote/);
  assert.match(html, /<code/); assert(!html.includes('<img'));
  assert(!renderMarkdown('<script>alert(1)</script>').includes('<script>'));
});
