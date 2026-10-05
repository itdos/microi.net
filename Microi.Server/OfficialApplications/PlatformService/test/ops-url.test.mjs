import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpsUrl } from '../src/ops-url.js';
test('Ops entry accepts explicit HTTPS and local test URLs', () => {
  assert.equal(normalizeOpsUrl('https://ops.example.com'), 'https://ops.example.com/');
  assert.equal(normalizeOpsUrl('http://localhost:61880'), 'http://localhost:61880/');
  assert.equal(normalizeOpsUrl(''), '');
});
test('Ops entry never propagates credentials, tokens or script URLs', () => {
  for (const value of ['javascript:alert(1)', 'https://user:pwd@ops.example.com', 'https://ops.example.com?token=x', 'https://ops.example.com#token=x', 'http://ops.example.com']) assert.throws(() => normalizeOpsUrl(value));
});
