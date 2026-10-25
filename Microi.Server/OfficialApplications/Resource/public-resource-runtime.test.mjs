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
test('real MCP and HTTP host fields do not block management or become trusted business input', () => {
  const calls=[], method={ManagePublicResourceOffload:p=>{calls.push(JSON.parse(JSON.stringify(p)));return {Code:1}}};
  const actor={ClientKey:'host-user',ActorKey:'host-user',UserId:'host-user',UserName:'host-name',_CurrentUser:{Id:'ignored-host-user',Level:99999},TestParam1:'legacy-placeholder'};
  const http={_DeviceId:'MCP:fixture',_RequestApiEngineKey:'other',_RouteValues:{SourceTenant:'wrong'},_HttpMethod:'POST',_RequestPath:'/apiengine/mci-file-resource-runtime',_RequestScheme:'https',_RequestHost:'api.itdos.com',_RequestPathBase:'',_RawBody:'{"Ready":true}',_ContentType:'application/json'};
  for(const host of [actor,{...actor,...http}]){
    assert.equal(run('mci-file-resource-runtime',{Action:'PinHistoricalHotspot',SourceTenant:'tenant',AppKey:'app',OsClient:'iTdos',ApiEngineKey:'mci-file-resource-runtime',_InvokeType:'Server',...host},method).Code,1);
    assert.deepEqual(calls.at(-1),{Action:'PinHistoricalHotspot',SourceTenant:'tenant',AppKey:'app'});
  }
  const rejected=run('mci-file-resource-runtime',{Action:'Prepare',SourceTenant:'tenant',AppKey:'app',...actor,Ready:true},method);
  assert.equal(rejected.Code,0);assert.deepEqual(Array.from(rejected.Data.RejectedArgumentNames),['Ready']);
  assert.equal(calls.length,2);
  for(const TestParam1 of [{Ready:true},'x'.repeat(201)]) assert.equal(run('mci-file-resource-runtime',{Action:'Prepare',TestParam1},method).Code,0);
  assert.equal(calls.length,2);
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
