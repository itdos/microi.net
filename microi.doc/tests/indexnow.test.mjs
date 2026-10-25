import test from 'node:test'
import assert from 'node:assert/strict'
import { payload, notify } from '../scripts/indexnow.mjs'
const key = 'a'.repeat(64), url = 'https://microi.net/doc/'
test('notification rejects foreign hosts, utility pages and noncanonical query URLs', () => {
  for (const value of ['https://other.example/doc/', 'https://microi.net/profile.html', url + '?token=private', 'https://microi.net/doc/index.html']) assert.throws(() => payload(key, [value]))
  assert.deepEqual(payload(key, [url, url]).urlList, [url])
})
test('a missing live site proof prevents every submission', async () => {
  let calls = 0
  const report = await notify({ key, urls: [url], fetchImpl: async () => { calls++; return new Response('different', { status: 200 }) } })
  assert.equal(calls, 1); assert.equal(report.status, 'PreflightFailed'); assert.equal(report.indexingConfirmed, false)
})
test('withdrawn or unlisted pages are rejected by the live sitemap', async () => {
  let calls = 0
  const report = await notify({ key, urls: [url], fetchImpl: async () => new Response(++calls === 1 ? key : '<urlset/>') })
  assert.equal(calls, 2); assert.equal(report.status, 'PreflightFailed')
})
test('HTTP 202 is received with pending key validation and never reported as indexing', async () => {
  const calls = []
  const report = await notify({ key, urls: [url], fetchImpl: async (target, options) => {
    calls.push({ target, options })
    return new Response(calls.length === 1 ? key : calls.length === 2 ? `<urlset><url><loc>${url}</loc></url></urlset>` : '', { status: calls.length === 3 ? 202 : 200 })
  } })
  assert.equal(calls.length, 3); assert.equal(JSON.parse(calls[2].options.body).host, 'microi.net')
  assert.equal(report.status, 'ReceivedKeyValidationPending'); assert.equal(report.accepted, true); assert.equal(report.indexingConfirmed, false)
  assert.ok(!JSON.stringify(report).includes(key))
})
test('a transport failure after POST remains unknown without automatic replay', async () => {
  let calls = 0
  const report = await notify({ key, urls: [url], fetchImpl: async () => { calls++; if (calls === 3) throw new Error('connection lost'); return new Response(calls === 1 ? key : `<loc>${url}</loc>`) } })
  assert.equal(calls, 3); assert.equal(report.status, 'SubmissionOutcomeUnknown'); assert.equal(report.retries, 0)
})
