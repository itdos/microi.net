import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { configurePublicResourceRuntime, publicResourceRuntimeEngines } from './configure-public-resource-runtime.mjs';
const code = key => fs.readFileSync(new URL(`../PlatformService/engines/${key}.js`, import.meta.url), 'utf8');
const run = (key, Param, method) => vm.runInNewContext(`(function(){${code(key)}\n})()`, { V8: { Param, Method: method } });
test('management forwards only identity and action; caller supplied evidence cannot authorize offload', () => {
  const calls = [], method = { ManagePublicResourceOffload: p => { calls.push(p); return { Code: 1, Data: { State: 'Queued' } } } };
  assert.equal(run('mci-file-resource-runtime', { Action: 'PinHistoricalHotspot', SourceTenant: 'tenant', AppKey: 'app' }, method).Code, 1);
  assert.equal(calls.length, 1);
  for (const supplied of [{ Ready: true }, { Bytes: 9999999999 }, { Url: 'https://wrong.test' }, { Secret: 'test' }])
    assert.equal(run('mci-file-resource-runtime', { Action: 'Prepare', SourceTenant: 'tenant', AppKey: 'app', ...supplied }, method).Code, 0);
  assert.equal(calls.length, 1);
});
test('public selector never forwards URL signatures, traversal encoding or credential objects', () => {
  const calls = [], method = { GetPublicResourceBackupUrl: p => { calls.push(p); return { Code: 1, Data: { UseBackup: false } } } };
  for (const path of ['https://files.test/public/a.js', 'tenant/a.js?signature=secret', 'tenant/%2e%2e/private/file'])
    assert.equal(run('mci-file-resource-public-url', { FilePathName: path }, method).Data.UseBackup, false);
  assert.equal(calls.length, 0);
  run('mci-file-resource-public-url', { FilePathName: 'tenant/micro-app/app/index.html', Ready: true }, method);
  assert.deepEqual(Object.keys(calls[0]), ['FilePathName']);
});
test('runtime belongs to monitoring package, with anonymous reads separate from administrator writes', () => {
  const input = JSON.parse(fs.readFileSync(new URL('system-observability-package-source.json', import.meta.url), 'utf8'));
  const projected = configurePublicResourceRuntime(input);
  assert.deepEqual(configurePublicResourceRuntime(projected), projected);
  for (const key of publicResourceRuntimeEngines) {
    const row = projected.SysApiEngines.filter(e => e.ApiEngineKey === key); assert.equal(row.length, 1);
    assert.equal(row[0].ApiV8Code, code(key)); assert.equal(row[0].EnableLog, 0);
    assert.equal(row[0].AllowAnonymous, key.endsWith('public-url') ? 1 : 0);
    assert.equal(projected.ResourcePolicies.ApiEngines[key].UpgradePolicy, 'Managed');
  }
  assert.deepEqual(projected.DataSets, input.DataSets); assert.deepEqual(projected.ScheduleJobs, input.ScheduleJobs);
});
