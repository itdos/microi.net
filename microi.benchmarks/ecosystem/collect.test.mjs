import test from 'node:test';
import assert from 'node:assert/strict';
import { collect, collectRepository, repositories, summarize } from './collect.mjs';
const since = '2026-07-27T00:00:00.000Z', until = '2026-10-25T00:00:00.000Z';
const inside = '2026-10-20T00:00:00Z';
const commit = (sha, author, date = inside) => ({ sha, author, commit: { committer: { date }, author: { email: 'never-export@example.test', name: 'Private name' } } });
const json = data => new Response(JSON.stringify(data), { status: 200 });
test('提交按 SHA、账号按 Id 去重；不把未知作者算独立人员', () => {
  assert.deepEqual(summarize('commits', [commit('a', { id: 1 }), commit('a', { id: 1 }), commit('b', { id: 1 }), commit('c', null), commit('d', { id: 2, type: 'Bot' }), commit('e', { id: 3 }, until)], since, until), {
    observedRecordsInWindow: 4, identifiedNonBotAccounts: 1, identifiedBotAccounts: 1, recordsWithoutMappedAccount: 1,
  });
});
test('Issue 更新不冒充创建或作者贡献；关闭和合并分别按日期统计', () => {
  const rows = [{ number: 1, updated_at: inside, created_at: '2020-01-01', closed_at: inside, merged_at: null, user: { id: 1 } }];
  const result = summarize('pulls', rows, since, until);
  assert.equal(result.createdInWindow, 0); assert.equal(result.closedInWindow, 1); assert.equal(result.mergedInWindow, 0);
});
test('两站重复提交不翻倍，账号不跨站猜测，响应不得泄漏个人信息', async () => {
  const requests = [];
  const report = await collect({ since, until, fetchImpl: async (url, options) => {
    requests.push(options);
    if (!url.includes('?') && !/\/(issues|pulls)$/.test(url)) return json({ default_branch: 'master' });
    if (url.includes('/commits')) return json([commit('same-sha', { id: 1 })]);
    if (url.includes('/issues')) return json([{ number: 1, updated_at: inside, created_at: inside, pull_request: {}, user: { id: 1 } }]);
    return json([]);
  } });
  assert.equal(report.crossHostCommits.observedUniqueShaCount, 1);
  assert.equal(report.crossHostCommits.complete, true);
  assert.equal(report.repositories[0].datasets.issues.metrics.observedRecordsInWindow, 0);
  assert.equal(report.limits.crossHostUniquePeople, null);
  assert.doesNotMatch(JSON.stringify(report), /never-export|Private name/);
  assert.ok(requests.every(request => request.method === 'GET' && !request.headers.Authorization));
});
test('限流为 unavailable/null，不伪造零活动', async () => {
  const report = await collect({ since, until, fetchImpl: async () => new Response('private diagnostic', { status: 429 }) });
  assert.equal(report.repositories[0].error, 'HTTP_429');
  assert.equal(report.crossHostCommits.complete, false);
  assert.doesNotMatch(JSON.stringify(report), /private diagnostic/);
});
test('分页上限为 partial，保留已观察下限', async () => {
  const fetchImpl = async url => !url.includes('?') ? json({ default_branch: 'master' }) : url.includes('/commits') ? json(Array.from({ length: 100 }, (_, i) => commit(String(i), { id: 1 }))) : json([]);
  const result = await collectRepository(repositories[0], { since, until, maxPages: 1, fetchImpl });
  assert.equal(result.report.datasets.commits.status, 'partial');
  assert.equal(result.report.datasets.commits.metrics.observedRecordsInWindow, 100);
});
test('第二页失败保留已观察结果，错误正文不进入报告', async () => {
  const fetchImpl = async url => !url.includes('?') ? json({ default_branch: 'master' })
    : url.includes('/commits') ? url.includes('page=2') ? new Response('secret response', { status: 503 }) : json(Array.from({ length: 100 }, (_, i) => commit(String(i), { id: 1 }))) : json([]);
  const result = await collectRepository(repositories[0], { since, until, maxPages: 2, fetchImpl });
  assert.equal(result.report.datasets.commits.status, 'partial');
  assert.equal(result.report.datasets.commits.error, 'HTTP_503');
  assert.equal(result.report.datasets.commits.metrics.observedRecordsInWindow, 100);
  assert.doesNotMatch(JSON.stringify(result.report), /secret response/);
});
test('无效时间与页面预算拒绝采集', async () => {
  await assert.rejects(collect({ since: until, until: since }));
  await assert.rejects(collect({ since, until, maxPages: 0 }));
  await assert.rejects(collect({ since, until: '2099-01-01T00:00:00Z' }), /不能晚于/);
});
test('API 行结构缺失不静默变成零条活动', async () => {
  const result = await collectRepository(repositories[0], { since, until, fetchImpl: async url => !url.includes('?') ? json({ default_branch: 'master' }) : url.includes('/commits') ? json([commit('a', null)]) : json([{ number: 1, updated_at: 'invalid-date' }]) });
  assert.equal(result.report.datasets.issues.status, 'unavailable');
  assert.equal(result.report.datasets.issues.metrics, null);
  assert.equal(result.report.datasets.issues.error, 'INVALID_RECORD_SCHEMA');
});
