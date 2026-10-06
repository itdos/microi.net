import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../../OfficialApplications/Resource/license-expiry-model.js', import.meta.url), 'utf8');
const model = new Function(code + ';return createLicenseExpiryModel()')();
const now = Date.parse('2026-09-26T00:00:00Z'), end = new Date(now + 5 * 86400000 + 19 * 3600000 + 38 * 60000).toISOString();
test('默认七天边界和文案分钟倒计时', () => {
  const result = model.project(null, 'Enterprise', end, now, false);
  assert.match(result.Content, /倒计时5天19小时38分/);
  assert.equal(result.TitleTone, 'danger');
  assert.match(model.project(null, 'Enterprise', end.replace('.000Z','.123Z'), now, false).Content, /2026-10-01 19:38:00 UTC/);
  assert.equal(model.project(null, 'Enterprise', end, now - 2 * 86400000, false), null);
  assert.equal(model.project(null, 'OpenSource', end, now, false), null);
  assert.equal(model.project(null, 'Enterprise', '0001-01-01T00:00:00Z', now, false), null);
  assert.match(model.project(null, 'Personal', end, Date.parse(end), false).Content, /倒计时0天0小时0分/);
});
test('官方和父级阈值独立，不要求官方提醒先触发', () => {
  const policy = { Enterprise: { AdvanceDays: 30, Content: '{版本} {到期时间} 还有{倒计时}' } };
  assert.match(model.project(policy, 'Enterprise', end, now - 10 * 86400000, true).Content, /企业版.*15天19小时38分/);
  assert.equal(model.project(null, 'Enterprise', end, now - 10 * 86400000, false), null);
  assert.match(model.project({Enterprise:{Content:'请续费'}}, 'Enterprise', end, now, false).Content, /请续费\n倒计时/);
});
test('异常、超长与非法阈值拒绝，空模板回到默认', () => {
  for (const value of [0, -1, 1.5, 3651, 'bad']) assert.throws(() => model.normalize({Enterprise:{AdvanceDays:value}}));
  assert.throws(() => model.normalize({Personal:{Content:'x'.repeat(8001)}}));
  assert.equal(model.normalize(null).Enterprise.AdvanceDays, 7);
});
