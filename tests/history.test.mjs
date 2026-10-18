import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, historyLimit } from '../src/history.js';

const entry = (query, mode = 'tot') => ({query, mode, answer:`Answer for ${query}`});
const valid = value => value && typeof value.query === 'string' && typeof value.answer === 'string';
test('history limit defaults and validates integer bounds', () => {
  for (const value of [undefined,null,NaN,Infinity,0,51,-1,1.5,'12']) assert.equal(historyLimit(value),5);
  for (const value of [1,7,50]) assert.equal(historyLimit(value),value);
  assert.equal(historyLimit(0,12),12);
});
test('legacy history is preserved, invalid records ignored, defaults remain five', () => {
  const existing = Array.from({length:7},(_,i) => entry(String(i)));
  const history = createHistory({read:() => [null,{},...existing],write:() => {},isValid:valid});
  assert.deepEqual(history.list(),existing.slice(0,5));
  const copy = history.list(); copy.pop();
  assert.equal(history.list().length,5);
});
test('custom retention keeps full results, deduplicates by tool and trims oldest', () => {
  let saved;
  const history = createHistory({read:() => [],write:value => {saved=value;},isValid:valid,limit:8});
  for (let i=0;i<10;i++) history.record(entry(String(i)));
  assert.deepEqual(saved.map(e=>e.query),['9','8','7','6','5','4','3','2']);
  const detailed = {...entry('5'),lookup:{entries:[{definition:'A full definition'}]},warning:'Partial answer'};
  history.record(detailed);
  assert.deepEqual(saved[0],detailed);
  assert.equal(saved.length,8);
  history.record(entry('5','thesaurus'));
  assert.equal(saved.filter(e=>e.query==='5').length,2);
  history.setLimit(3);
  assert.equal(saved.length,3);
  history.setLimit(50);
  assert.equal(saved.length,3);
});
test('unavailable storage and quota errors retain usable session history', () => {
  const history = createHistory({read:() => {throw Error('disabled');},write:() => {throw Error('quota');},isValid:valid});
  assert.equal(history.record(entry('saved for session')),false);
  assert.equal(history.list()[0].answer,'Answer for saved for session');
  assert.equal(history.setLimit(1),false);
  assert.equal(history.list().length,1);
});
test('malformed history and invalid limit updates cannot break the store', () => {
  const history = createHistory({read:() => ({broken:true}),write:() => {},isValid:valid,limit:2});
  history.setLimit(-100);
  for (let i=0;i<3;i++) history.record(entry(String(i)));
  assert.deepEqual(history.list().map(e=>e.query),['2','1']);
});
