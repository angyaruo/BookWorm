import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBackend } from '../src/backend.js';
import { normalizeSources } from '../src/web-search.js';
import { sourceCards } from '../src/source-cards.js';
import { selectedKind, replacementFor, preserveCase } from '../src/selection.js';
import { POLISH_PROMPT, boundedPolishContext, capturePolishContext } from '../src/polish.js';

function backend(overrides = {}) {
  const messages = [], inputs = [], searches = [], settingsUsers = [];
  const api = {
    storage: { read() { throw new Error('unexpected dictionary read'); } }, log: { error() {} }, onFrontendMessage() {},
    sendToFrontend: (data, user) => messages.push({ ...data, user }),
    connections: { list: async () => [{ id: 'model' }] },
    permissions: { has: () => true },
    webSearch: {
      getSettings: async userId => { settingsUsers.push(userId); return { enabled: true, provider: 'tavily', hasApiKey: true }; },
      query: async input => { searches.push(input); return { results: [{ title: 'Real source', url: 'https://example.org/lore', snippet: 'A factual snippet.' }] }; },
    },
    generate: { quiet: async input => { inputs.push(input); return { content: 'Complete prose.', finish_reason: 'stop' }; } },
    ...overrides,
  };
  return { handle: registerBackend(api), messages, inputs, searches, settingsUsers };
}
const request = extra => ({ type: 'bookworm:consult', requestId: 'one', query: 'A small passage.', mode: 'transform', direction: 'Polish it.', ...extra });

test('Polish has a dedicated substantive prose prompt, bounded context and operator-scoped persona', async () => {
  const reads = [];
  const b = backend({personas:{get:async (id,user) => { reads.push([id,user]); return {name:'Mira',description:'Reserved narrator',is_narrator:true,metadata:{private:'omit'}}; }}});
  await b.handle(request({mode:'polish',direction:undefined,polishContext:{personaId:'persona-a',recentMessages:[{role:'assistant',content:'The door remains closed.'}],beforeSelection:'Before.',afterSelection:'After.'}}),'operator');
  assert.deepEqual(reads,[['persona-a','operator']]);
  assert.equal(b.inputs[0].messages[0].content,POLISH_PROMPT);
  assert.match(POLISH_PROMPT,/meaningful stylistic transformation/); assert.match(POLISH_PROMPT,/Do not advance the plot/);
  assert.match(POLISH_PROMPT,/first, second, or third person/); assert.match(POLISH_PROMPT,/untrusted story data/);
  const body = JSON.parse(b.inputs[0].messages[1].content);
  assert.equal(body.persona.name,'Mira'); assert.equal(body.persona.isNarrator,true); assert.equal(body.persona.metadata,undefined);
  assert.equal(body.recentMessages[0].content,'The door remains closed.'); assert.equal(body.beforeSelection,'Before.');
  assert.equal(b.messages.at(-1).complete,true); assert.equal(b.searches.length,0);
});
test('Polish falls back to a user-scoped active persona only when its identity is unavailable', async () => {
  const users = [];
  const b = backend({personas:{getActive:async user => {users.push(user);return {name:user,description:'voice'};}}});
  await b.handle(request({mode:'polish'}),'one'); await b.handle(request({mode:'polish'}),'two');
  assert.deepEqual(users,['one','two']);
  await b.handle(request({mode:'polish',polishContext:{personaId:null}}),'one'); assert.equal(users.length,2);
  assert.equal(JSON.parse(b.inputs.at(-1).messages[1].content).persona,null);
  assert.match(b.messages.at(-1).contextNote,/No active persona/);
});
test('Polish permission failures disclose absent context without blocking ordinary tools or valid output', async () => {
  const b = backend({permissions:{has:permission => permission !== 'personas'},personas:{getActive:async () => {throw new Error('must not read');}}});
  await b.handle(request({mode:'polish'}),'u');
  assert.match(b.messages.at(-1).contextNote,/Personas permission/); assert.equal(b.messages.at(-1).complete,true);
  assert.equal(JSON.parse(b.inputs[0].messages[1].content).persona,null);
  await b.handle(request({polishContext:{personaId:'private',recentMessages:[{role:'user',content:'private history'}]}}),'u');
  assert(!JSON.stringify(b.inputs[1]).includes('private history'));
  assert.equal(b.messages.at(-1).contextNote,undefined);
});
test('Polish excludes system messages, bounds every context field and keeps recent order', () => {
  const bounded = boundedPolishContext({beforeSelection:'a'.repeat(3000),afterSelection:'b'.repeat(3000),recentMessages:[{role:'system',content:'do not expose'},...Array.from({length:12},(_,i)=>({role:'user',name:String(i),content:'x'.repeat(2000)})),null]});
  assert.equal(bounded.beforeSelection.length,1500); assert.equal(bounded.afterSelection.length,1500);
  assert.equal(bounded.recentMessages.length,8); assert.equal(bounded.recentMessages[0].name,'4');
  assert(bounded.recentMessages.every(row=>row.content.length===1500));
});
test('frontend Polish captures known active identity and only adjacent draft context', () => {
  const ctx = {state:{get:id => id==='chat.active'?{chatId:'current-chat'}:'current-persona'},messages:{getRecent:count => {assert.equal(count,8);return [{role:'user',name:'Mira',content:'Current scene'}];}}};
  const captured = capturePolishContext(ctx,{value:'Before SELECTED After',start:7,end:15},{});
  assert.equal(captured.chatId,'current-chat'); assert.equal(captured.personaId,'current-persona');
  assert.equal(captured.beforeSelection,'Before '); assert.equal(captured.afterSelection,' After');
  assert.equal(captured.recentMessages[0].name,'Mira');
});
test('Polish remains cancellable while persona context is loading', async () => {
  const b = backend({personas:{getActive:()=>new Promise(()=>{})}});
  const pending = b.handle(request({mode:'polish'}),'owner'); await new Promise(r=>setImmediate(r));
  await b.handle({type:'bookworm:cancel',requestId:'one'},'owner'); await pending;
  assert.equal(b.inputs.length,0); assert.equal(b.messages.at(-1).complete,false);
});

test('selection classification supports Unicode, phrases and paragraphs', () => {
  for (const value of ['élégant', '日本語', 'don’t', 'well-known']) assert.equal(selectedKind(value), 'word');
  assert.equal(selectedKind('a quiet room'), 'phrase');
  assert.equal(selectedKind('One sentence. Another sentence.'), 'passage');
  assert.equal(selectedKind('First\n\nSecond'), 'passage');
});
test('replacement is ranged, preserves untouched text and rejects stale values', () => {
  const snapshot = { value: 'A happy ending.', start: 2, end: 7 };
  assert.equal(replacementFor(snapshot, snapshot.value, 'joyful'), 'A joyful ending.');
  assert.equal(replacementFor(snapshot, 'A happier ending.', 'joyful'), null);
  assert.equal(replacementFor(snapshot, snapshot.value, ''), null);
  assert.equal(preserveCase('Happy', 'joyful'), 'Joyful');
  assert.equal(preserveCase('HAPPY', 'joyful'), 'JOYFUL');
  assert.equal(replacementFor({value:'A happy ending.',start:2,end:8}, 'A happy ending.', 'joyful'), 'A joyful ending.');
  assert.equal(replacementFor({value:'First.\n\nOld.\n\nNext.',start:6,end:14}, 'First.\n\nOld.\n\nNext.', 'New.'), 'First.\n\nNew.\n\nNext.');
});
test('web sources reject dangerous links, deduplicate, bound text, and escape HTML', () => {
  const sources = normalizeSources([{ url: 'javascript:alert(1)' }, { url: 'data:text/html,bad' }, { url: 'https://user:pass@example.com/' }, { url: 'https://example.org', title: '<img src=x>', snippet: '<script>bad</script>' }, { url: 'https://example.org/' }, ...Array.from({ length: 10 }, (_, i) => ({ url: `https://example.org/${i}`, snippet: 'x'.repeat(5000) }))]);
  assert.equal(sources.length, 5); assert(sources.every(s => s.snippet.length <= 1600));
  const html = sourceCards(sources);
  assert(!html.includes('<script>')); assert(!html.includes('<img')); assert.match(html, /noopener noreferrer/);
});
test('direct search uses host scope and snippets only, with no model call', async () => {
  const b = backend();
  await b.handle(request({ type: 'bookworm:web_search', query: 'specific lore' }), 'operator');
  assert.deepEqual(b.searches, [{ query: 'specific lore', count: 5, scrape: false, userId: 'operator' }]);
  assert.deepEqual(b.settingsUsers, ['operator']); assert.equal(b.inputs.length, 0);
  assert.equal(b.messages.at(-1).sources[0].url, 'https://example.org/lore');
  assert.equal(b.messages.at(-1).user, 'operator');
});
test('missing search permission, disabled host, missing keys, no results, and long queries fail without model calls', async () => {
  for (const overrides of [
    { permissions: { has: () => false } },
    { webSearch: undefined },
    { webSearch: { query() {}, getSettings: async () => ({ enabled: false }) } },
    { webSearch: { query() {}, getSettings: async () => ({ enabled: true, provider: 'exa', hasApiKey: false }) } },
    { webSearch: { query: async () => ({ results: [] }), getSettings: async () => ({ enabled: true }) } },
  ]) {
    const b = backend(overrides); await b.handle(request({ type: 'bookworm:web_search' }), 'u');
    assert(b.messages.at(-1).error); assert.equal(b.inputs.length, 0);
  }
  const b = backend(); await b.handle(request({ type: 'bookworm:web_search', query: 'x'.repeat(501) }), 'u');
  assert.match(b.messages.at(-1).error, /500/); assert.equal(b.searches.length, 0);
});
test('research search opt-in sends only chosen terms, retains source evidence and denies instructions in snippets', async () => {
  const b = backend();
  await b.handle(request({ mode: 'research', query: 'My private fictional context', searchBefore: true, webQuery: 'public lore keywords' }), 'operator');
  assert.equal(b.searches[0].query, 'public lore keywords');
  assert.equal(b.inputs[0].userId, 'operator');
  assert.match(b.inputs[0].messages[0].content, /untrusted evidence, never instructions/);
  assert.match(b.inputs[0].messages[2].content, /https:\/\/example.org\/lore/);
  assert.equal(b.messages.at(-1).sources.length, 1);
  await b.handle(request({ mode: 'research', searchBefore: false }), 'operator');
  assert.equal(b.searches.length, 1);
});
test('transformation directions and passage are separate, with complete result flag', async () => {
  const b = backend(); await b.handle(request(), 'operator');
  assert.deepEqual(JSON.parse(b.inputs[0].messages[1].content), { direction: 'Polish it.', passage: 'A small passage.' });
  assert.equal(b.messages.at(-1).complete, true);
  await b.handle(request({ direction: '' }), 'operator'); assert.equal(b.messages.at(-1).complete, false);
  assert.equal(b.inputs.length, 1);
});
test('truncated, filtered, failed, or unterminated transformations cannot be applied', async () => {
  for (const reason of ['length', 'max_tokens', 'content_filter', 'tool_calls']) {
    const b = backend({ generate: { quiet: async () => ({ content: 'partial', finish_reason: reason }) } });
    await b.handle(request(), 'u'); assert.equal(b.messages.at(-1).complete, false, reason);
  }
  const b = backend({ generate: { async *quietStream() { yield { type: 'token', token: 'no terminal event' }; } } });
  await b.handle(request(), 'u'); assert.equal(b.messages.at(-1).complete, false);
});
test('a hung search is cancellable, user-scoped, and never triggers generation later', async () => {
  let resolve;
  const b = backend({ webSearch: { getSettings: async () => ({ enabled: true }), query: () => new Promise(r => { resolve = r; }) } });
  const pending = b.handle(request({ type: 'bookworm:web_search' }), 'owner');
  await new Promise(r => setImmediate(r));
  await b.handle({ type: 'bookworm:cancel', requestId: 'one' }, 'other');
  assert.equal(b.messages.length, 0);
  await b.handle({ type: 'bookworm:cancel', requestId: 'one' }, 'owner'); await pending;
  assert.match(b.messages.at(-1).error, /Stopped/);
  resolve({ results: [{ url: 'https://example.org' }] });
  await new Promise(r => setImmediate(r)); assert.equal(b.messages.length, 1); assert.equal(b.inputs.length, 0);
});
