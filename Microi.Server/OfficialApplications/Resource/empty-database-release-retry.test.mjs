import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const source = pkg.SysApiEngines.find(x => x.ApiEngineKey === 'admin_build_sanitized_empty_database').ApiV8Code;
const busy = { Code: 0, Msg: '准备主库空数据库失败。InvalidOperationException: 另一项主库空数据库发布任务仍在执行，当前任务未修改临时数据库。' };
function run(prepareResult, checkpoint = {}, extra = {}, parameters = {}) {
  let cleanup = 0, prepare = 0, audit = 0;
  const context = vm.createContext({
    DateNow: () => '2026-09-07 03:38:00', console: { error() {} },
    V8: { OsClient: 'iTdos', CurrentUser: { Id: 'admin', Level: 9999 },
      Param: { _BackgroundTaskId: 'task', _BackgroundTaskCheckpoint: checkpoint, ...parameters },
      ApiEngine: { Run: () => ({ Code: 1, Data: { Sql: 'DELETE FROM some_optional_table;' } }) },
      Method: {
        UpdateBackgroundTask() {}, AddSysLog() { audit++; },
        PrepareEmptyDatabaseRelease() { prepare++; return prepareResult; },
        ApplyEmptyDatabaseSanitization() { return { Code: 1, Data: {} }; },
        PublishEmptyDatabaseRelease() { return { Code: 1, Data: { PackageCount: 7 } }; },
        CleanupEmptyDatabaseRelease() { cleanup++; return { Code: 1 }; }, ...extra
      }
    }
  });
  const result = vm.runInContext('(function(){' + source + '\n})()', context);
  return { result: JSON.parse(JSON.stringify(result)), cleanup, prepare, audit };
}

test('busy release before mutation keeps Prepare checkpoint and yields without cleanup', () => {
  const x = run(busy);
  assert.equal(x.result.Code, 1);
  assert.equal(x.result.Data.BackgroundTask.HasMore, true);
  assert.equal(x.result.Data.BackgroundTask.NextDelaySeconds, 30);
  assert.deepEqual(x.result.Data.BackgroundTask.Checkpoint, { Phase: 'Prepare', ReleaseLeaseWaitCount: 1 });
  assert.equal(x.cleanup, 0);
});
test('repeated lease contention increments wait evidence without duplicating start audit', () => {
  const x = run(busy, { Phase: 'Prepare', ReleaseLeaseWaitCount: 4 });
  assert.equal(x.result.Data.BackgroundTask.Checkpoint.ReleaseLeaseWaitCount, 5);
  assert.equal(x.audit, 0);
  assert.equal(x.cleanup, 0);
});
test('prepare resumes normally after the previous release relinquishes its lease', () => {
  const x = run({ Code: 1, Data: { SourceTableCount: 200 } }, { Phase: 'Prepare', ReleaseLeaseWaitCount: 4 });
  assert.equal(x.result.Data.BackgroundTask.Checkpoint.Phase, 'Sanitize');
  assert.equal(x.result.Data.BackgroundTask.NextDelaySeconds, 0);
  assert.equal(x.cleanup, 0);
});
test('real copy failures still fail and clean only the current release', () => {
  const x = run({ Code: 0, Msg: 'database write failed' });
  assert.equal(x.result.Code, 0);
  assert.match(x.result.Msg, /database write failed/);
  assert.equal(x.cleanup, 1);
});
test('generic lock messages and absent responses are not accepted as safe contention', () => {
  for (const response of [null, { Code: 0, Msg: 'lock timeout' }, { Code: 0, Msg: '另一项主库空数据库发布任务仍在执行' }]) {
    const x = run(response);
    assert.equal(x.result.Code, 0);
    assert.equal(x.cleanup, 1);
  }
});
test('a sanitation error is not retried as a harmless pre-mutation wait', () => {
  const x = run(null, { Phase: 'Sanitize' }, { ApplyEmptyDatabaseSanitization: () => busy });
  assert.equal(x.result.Code, 0);
  assert.equal(x.cleanup, 1);
  assert.equal(x.prepare, 0);
});
test('publish checkpoint still completes the seven-database release normally', () => {
  const x = run(null, { Phase: 'Publish', Prepare: { SourceTableCount: 200 } });
  assert.equal(x.result.Code, 1);
  assert.equal(x.result.Data.PackageCount, 7);
  assert.equal(x.cleanup, 0);
});

test('withdrawal forwards the trusted task fence and requires all seven verified removals', () => {
  let request;
  const x = run(null, {}, {
    CleanupEmptyDatabaseRelease(value) {
      request = value;
      return { Code: 1, Data: { WithdrawnFiles: Array.from({ length: 7 }, (_, i) => 'file' + i) } };
    }
  }, { Action: 'WithdrawPublicRelease', _BackgroundTaskFencingToken: 42 });
  assert.equal(x.result.Code, 1);
  assert.equal(x.prepare, 0);
  assert.equal(request.WithdrawPublicPackages, true);
  assert.equal(request._BackgroundTaskId, 'task');
  assert.equal(request._BackgroundTaskFencingToken, 42);
});

test('withdrawal fails closed on an old backend, incomplete removal or a denied lease', () => {
  for (const response of [{ Code: 1 }, { Code: 1, Data: { WithdrawnFiles: ['only-one'] } }, { Code: 0, Msg: 'lease denied' }]) {
    const x = run(null, {}, { CleanupEmptyDatabaseRelease: () => response }, { Action: 'WithdrawPublicRelease' });
    assert.equal(x.result.Code, 0);
    assert.equal(x.prepare, 0);
  }
});
