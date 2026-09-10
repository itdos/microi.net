import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
const code = readFileSync(new URL('../../Microi.Upgrade/Resource/platform-reminder-model.js', import.meta.url), 'utf8');
const model = new Function(code + '; return createPlatformReminderModel();')();
const now = Date.parse('2026-09-10T00:00:00Z');
const admin = { Administrator: true, IsMainTenant: true, IsOfficialPlatform: false };
const input = { Title: '维护公告', Content: '<script>只显示文本</script>', AllTargets: true, ScopeType: 'Users', StartsAt: '2026-09-10T00:00:00Z', EndsAt: '2026-09-20T00:00:00Z' };
test('普通用户、子租户和非官方不能扩大接收范围', () => {
  assert.throws(() => model.normalize(input, {}, now), /管理员/);
  assert.throws(() => model.normalize({ ...input, ScopeType: 'Tenants' }, { Administrator: true }, now), /主租户/);
  assert.throws(() => model.normalize({ ...input, ScopeType: 'Editions' }, admin, now), /官方/);
});
test('官方必须明确选择版本，不会隐式发送给付费版', () => {
  const ctx = { ...admin, IsOfficialPlatform: true };
  assert.throws(() => model.normalize({ ...input, ScopeType: 'Editions' }, ctx, now), /接收对象/);
  const rule = model.normalize({ ...input, ScopeType: 'Editions', TargetKeys: ['OpenSource'] }, ctx, now);
  assert.equal(model.matches(rule, 'Editions', 'Enterprise'), false);
  assert.equal(model.matches(rule, 'Editions', 'OpenSource'), true);
});
test('时间边界、失联跨周期和双节点 occurrence 一致', () => {
  const rule = model.normalize({ ...input, ReminderType: 'Scheduled', RepeatMode: 'Interval', IntervalMinutes: 5 }, admin, now);
  assert.equal(model.occurrence(rule, now - 1), null);
  assert.equal(model.occurrence(rule, now).Slot, 0);
  assert.equal(model.occurrence(rule, now + 300000).Slot, 1);
  assert.equal(model.occurrence(rule, now + 3600000).Slot, 12);
  assert.deepEqual(model.occurrence(rule, now + 3600000), model.occurrence(rule, now + 3600000));
  assert.equal(model.occurrence(rule, Date.parse(rule.EndsAt)), null);
});
test('试用提前提醒绑定单租户，保存 UTC 绝对时间', () => {
  const trial = { ...input, ScopeType: 'Tenants', AllTargets: false, TargetKeys: ['tenant-a'], ReminderType: 'Trial', TrialExpiresAt: '2026-09-11T08:00:00+08:00', AdvanceMinutes: 1440 };
  assert.equal(model.normalize(trial, admin, now).StartsAt, '2026-09-10T00:00:00.000Z');
  assert.throws(() => model.normalize({ ...trial, AllTargets: true }, admin, now), /具体子租户/);
});
test('空对象、危险链接、非法图标、无时区和无限计划拒绝', () => {
  for (const patch of [{ Title: '' }, { Icon: '<img>' }, { LinkUrl: 'javascript:alert(1)' }, { LinkUrl: '//evil.test' }, { StartsAt: '2026-09-10 08:00:00' }, { EndsAt: '' }, { Priority: -1 }]) {
    assert.throws(() => model.normalize({ ...input, ...patch }, admin, now));
  }
});
test('重复目标去重、撤回隐藏、发布快照不受草稿影响', () => {
  const rule = model.normalize({ ...input, AllTargets: false, TargetKeys: ['user-a', 'USER-A'] }, admin, now);
  assert.equal(rule.TargetKeys.length, 1);
  const batch = { Id: 'batch1', State: 'Published', SnapshotJson: JSON.stringify(rule) };
  rule.Title = '草稿修改';
  assert.equal(model.project(batch, 'Local', now).Title, '维护公告');
  assert.equal(model.project({ ...batch, State: 'Withdrawn' }, 'Local', now), null);
});
test('发布接收范围写入失败时，规则和发布快照同时回滚', () => {
  const body = readFileSync(new URL('../../Microi.Upgrade/Resource/platform-reminder-runtime.body.js', import.meta.url), 'utf8');
  const id = 'a'.repeat(32), future = new Date(Date.now()+86400000).toISOString();
  const initial = {Id:id,Revision:1,Status:'Draft',PublishedBatchId:'',RuleJson:JSON.stringify({...input,EndsAt:future})};
  const committed = structuredClone(initial), working = structuredClone(initial);
  function sql(row){return {FromSql(){const params={};return {AddInParameter(k,v){params[k]=v;return this},ExecuteNonQuery(){row.PublishedBatchId=params['@batch'];row.Status=params['@status'];return 1}}}}}
  const V8 = {Param:{Action:'Publish',Id:id,ExpectedRevision:1,RequestId:'regression-publish-12345'},OsClient:'test',
    Db:sql(committed),DbTrans:sql(working),
    EncryptHelper:{Sha256Hex:value=>createHash('sha256').update(value).digest('hex')},
    Method:{RunPlatformApiRuntime:()=>({Code:1,Data:{...admin,UserId:'admin'}})},
    FormEngine:{GetFormData:(table,key)=>table==='mci_platform_reminder'?{Code:1,Data:working}:{Code:2},
      GetTableData:()=>({Code:1,Data:[]}),UptFormDataByWhere:()=>({Code:1}),AddFormData:()=>({Code:1}),
      AddTableData:()=>({Code:0,Msg:'injected target failure'})}};
  const result = new Function('V8',code+';'+body)(V8);
  assert.equal(result.Code,0);assert.match(result.Msg,/injected target failure/);
  assert.deepEqual(committed,initial,'failed publication must not commit the rule claim outside the transaction');
});
