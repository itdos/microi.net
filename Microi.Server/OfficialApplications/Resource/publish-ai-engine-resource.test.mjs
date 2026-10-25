import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_RESOURCE, TARGET_ENGINE, CLOSURE, sha256, verifyCandidate, verifyResource,
  expectedEngine, snapshotsFor, auditLive, runAiRelease } from './publish-ai-engine-resource.mjs';

function fixture() {
  const resources = new Map(CLOSURE.map((name, i) => {
    const key = name === AI_RESOURCE ? TARGET_ENGINE : `engine-${i}`;
    const model = { PackageInfo: { Version: 'v1.0.0' }, SysApiEngines: [{ Id: `id-${i}`, ApiEngineKey: key, ApiV8Code: 'old', Version: 'v1.0.0' }],
      ResourcePolicies: { ApiEngines: { [key]: { UpgradePolicy: 'Managed' } } } };
    const content = JSON.stringify(model);
    return [name, { name, model, content, sha256: sha256(content), version: 'v1.0.0', bytes: Buffer.byteLength(content) }];
  }));
  const old = resources.get(AI_RESOURCE), model = structuredClone(old.model);
  model.PackageInfo.Version = 'v1.0.1'; model.SysApiEngines[0].ApiV8Code = 'new'; model.SysApiEngines[0].Version = 'v1.0.1';
  const content = JSON.stringify(model), candidate = { ...old, model, content, version: 'v1.0.1', sha256: sha256(content), bytes: Buffer.byteLength(content) };
  let rows = snapshotsFor(resources).flatMap(x => x.apiEngines.map(x => expectedEngine(x.engine)));
  const calls = { publish: 0, project: 0, read: 0 };
  const io = { readResources: async () => { calls.read++; return new Map(resources); }, readLive: async () => structuredClone(rows),
    publish: async changes => { calls.publish++; assert.equal(changes.length, 1); assert.equal(changes[0].name, AI_RESOURCE); resources.set(AI_RESOURCE, candidate); },
    project: async snapshots => { calls.project++; rows = snapshots.flatMap(x => x.apiEngines.map(x => expectedEngine(x.engine))); return { VerifiedApiEngineCount: rows.length }; } };
  return { resources, candidate, calls, io, rows, setRows(value) { rows = value; } };
}
test('默认只读计划固定9包与唯一账户引擎差异，不调用写入', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  assert.equal(plan.packages.length, 9); assert.equal(plan.ready, true);
  assert.deepEqual(plan.live.changes.map(x => x.key), [TARGET_ENGINE]);
  assert.equal(f.calls.publish + f.calls.project, 0);
  assert.equal(JSON.stringify(plan).includes('ApiV8Code":"old'), false);
});
test('只发布AI单项、先CAS再强回读，同内容重跑零写入', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  const args = { candidate: f.candidate, phase: 'publish', plan, runtimeConfirmed: '8.7.0' };
  const first = await runAiRelease(args, f.io), second = await runAiRelease(args, f.io);
  assert.equal(first.publish.matched, true); assert.equal(second.publish.reused, true);
  assert.equal(f.calls.publish, 1); assert.equal(f.calls.project, 0);
});
test('投影只在正式AI包匹配后执行并读回，其余8包保持线上正式闭包', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  await assert.rejects(runAiRelease({ candidate: f.candidate, phase: 'project', plan, runtimeConfirmed: '8.7.0' }, f.io), /PACKAGE_NOT_PUBLISHED/);
  f.resources.set(AI_RESOURCE, f.candidate);
  const args = { candidate: f.candidate, phase: 'project', plan, runtimeConfirmed: '8.7.0' };
  assert.equal((await runAiRelease(args, f.io)).projection.matched, true);
  assert.equal((await runAiRelease(args, f.io)).projection.reused, true); assert.equal(f.calls.project, 1);
});
test('发布未知结果仅回读，不重试；匹配可恢复，不匹配保持失败', async () => {
  for (const committed of [false, true]) {
    const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
    f.io.publish = async () => { f.calls.publish++; if (committed) f.resources.set(AI_RESOURCE, f.candidate); throw Error('timeout with sensitive detail'); };
    const promise = runAiRelease({ candidate: f.candidate, phase: 'publish', plan, runtimeConfirmed: '8.7.0' }, f.io);
    if (committed) {
      const result = await promise;
      assert.equal(result.publish.recoveredAfterError, true);
      assert.equal(result.writeAttempted, true); assert.equal(result.writesPerformed, true);
    }
    else await assert.rejects(promise, /PUBLISH_UNKNOWN_READBACK_NOT_MATCHED/);
    assert.equal(f.calls.publish, 1);
  }
});
test('投影未知结果只读核验，不自动二次写入', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  f.resources.set(AI_RESOURCE, f.candidate);
  f.io.project = async snapshots => { f.calls.project++; f.setRows(snapshots.flatMap(x => x.apiEngines.map(x => expectedEngine(x.engine)))); throw Error('timeout'); };
  const result = await runAiRelease({ candidate: f.candidate, phase: 'project', plan, runtimeConfirmed: '8.7.0' }, f.io);
  assert.equal(result.projection.recoveredAfterError, true); assert.equal(f.calls.project, 1);
  assert.equal(result.writeAttempted, true); assert.equal(result.writesPerformed, true);
});
test('同版本不同正文、线上包漂移、无部署确认都在写入前拒绝', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  const args = { candidate: f.candidate, phase: 'publish', plan, runtimeConfirmed: '8.7.0' };
  await assert.rejects(runAiRelease({ ...args, runtimeConfirmed: undefined }, f.io), /RUNTIME_DEPLOYMENT_CONFIRMATION_REQUIRED/);
  f.resources.get(CLOSURE[0]).sha256 = '1'.repeat(64);
  await assert.rejects(runAiRelease(args, f.io), /REMOTE_PLAN_DRIFT/);
  f.resources.get(AI_RESOURCE).version = f.candidate.version;
  await assert.rejects(runAiRelease(args, f.io), /SAME_OR_NEWER_VERSION_DIFFERENT_CONTENT/);
  assert.equal(f.calls.publish, 0);
});
test('其它Managed漂移或缺失Hook只产生阻断计划，执行不落库', async () => {
  const f = fixture(); f.rows[0].ApiV8Code = 'concurrent-edit';
  const plan = await runAiRelease({ candidate: f.candidate }, f.io);
  assert.equal(plan.ready, false);
  await assert.rejects(runAiRelease({ candidate: f.candidate, phase: 'publish', plan, runtimeConfirmed: '8.7.0' }, f.io), /NON_TARGET_LIVE_DRIFT/);
  const snapshots = snapshotsFor(f.resources); snapshots[0].apiEngines[0].policy = 'CreateIfMissing';
  assert.equal(auditLive(snapshots, f.rows.slice(1)).changes[0].fields[0], 'missing');
  assert.equal(f.calls.publish + f.calls.project, 0);
});
test('正式正文SHA、重复Key和候选预期SHA严格校验', async () => {
  const f = fixture(), old = f.resources.get(AI_RESOURCE);
  const row = { ResourceName: AI_RESOURCE, Content: old.content, Sha256: old.sha256, AppVersion: old.version };
  assert.equal(verifyResource(AI_RESOURCE, row).sha256, old.sha256);
  assert.throws(() => verifyResource(AI_RESOURCE, { ...row, Content: old.content + ' ' }), /RESOURCE_HASH_MISMATCH/);
  assert.throws(() => auditLive(snapshotsFor(f.resources), [...f.rows, f.rows[0]]), /LIVE_KEY_DUPLICATE/);
  // 历史发行入口使用内存夹具，不绑定日后持续升版的正式AI包。
  const content = JSON.stringify({ PackageInfo: { Name: 'AI助手', Version: 'v7.7.8', ServerMinVersion: '8.7.0',
    ChangeLog: { Version: 'v7.7.8', Title: '额度管理', ChangeType: 'Feature', Content: '增加受控额度管理', ReleaseTime: '2026-10-25 22:41:42' },
    ChangeHistory: [{ Version: 'v7.7.8', Date: '2026-10-25', Description: '增加受控额度管理' }] },
    SysApiEngines: [{ ApiEngineKey: TARGET_ENGINE, Version: 'v1.1.1', ApiV8Code: '// RELAY_TOKEN_LIMIT_ADMIN_V1' }] });
  assert.equal(verifyCandidate(content, sha256(content), 'v7.7.8').model.PackageInfo.ServerMinVersion, '8.7.0');
  assert.throws(() => verifyCandidate(content, '0'.repeat(64), 'v7.7.8'), /CANDIDATE_HASH_MISMATCH/);
});
test('计划必须包含完整且唯一9包，候选外接口变化不可夹带', async () => {
  const f = fixture(), plan = await runAiRelease({ candidate: f.candidate }, f.io);
  await assert.rejects(runAiRelease({ candidate: f.candidate, phase: 'publish', plan: { ...plan, packages: [] }, runtimeConfirmed: '8.7.0' }, f.io), /PLAN_CLOSURE_INVALID/);
  f.candidate.model.SysApiEngines.push({ Id: 'extra', ApiEngineKey: 'unrelated', ApiV8Code: 'no' });
  await assert.rejects(runAiRelease({ candidate: f.candidate }, f.io), /NON_TARGET_PACKAGE_ENGINE_CHANGED/);
  assert.equal(f.calls.publish + f.calls.project, 0);
});
test('投影期间正式包回退或非目标接口变化均不能报成功', async () => {
  for (const kind of ['package', 'engine']) {
    const f = fixture(), old = f.resources.get(AI_RESOURCE), plan = await runAiRelease({ candidate: f.candidate }, f.io);
    f.resources.set(AI_RESOURCE, f.candidate);
    const original = f.io.project;
    f.io.project = async snapshots => {
      const result = await original(snapshots);
      if (kind === 'package') f.resources.set(AI_RESOURCE, old);
      else { const rows = await f.io.readLive(); rows[0].ApiV8Code = 'other edit'; f.setRows(rows); }
      return result;
    };
    await assert.rejects(runAiRelease({ candidate: f.candidate, phase: 'project', plan, runtimeConfirmed: '8.7.0' }, f.io), kind === 'package' ? /PROJECTION_PACKAGE_READBACK_MISMATCH/ : /PROJECTION_READBACK_MISMATCH/);
    assert.equal(f.calls.project, 1);
  }
});
