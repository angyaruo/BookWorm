import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId } from '../src/request-id.js';

test('request ID uses native UUID with the correct receiver when available', () => {
  const cryptoApi = { randomUUID() { assert.equal(this, cryptoApi); return 'native-uuid'; } };
  assert.equal(createRequestId(cryptoApi), 'native-uuid');
});
test('HTTP request ID uses 128 random bits without randomUUID', () => {
  const cryptoApi = { getRandomValues(bytes) {
    assert.equal(this, cryptoApi);
    assert.equal(bytes.length, 16);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i;
    return bytes;
  } };
  assert.equal(createRequestId(cryptoApi), 'bw-000102030405060708090a0b0c0d0e0f');
  cryptoApi.randomUUID = () => { throw new Error('Restricted'); };
  assert.equal(createRequestId(cryptoApi), 'bw-000102030405060708090a0b0c0d0e0f');
});
test('missing or restricted Web Crypto still produces distinct bounded IDs', t => {
  t.mock.method(Date, 'now', () => 1000);
  t.mock.method(Math, 'random', () => 0.5);
  const unavailable = { randomUUID() { throw new Error('Restricted'); }, getRandomValues() { throw new Error('Restricted'); } };
  const ids = Array.from({length:100}, (_, i) => createRequestId([null, {}, unavailable][i % 3]));
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 150));
});
