import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageData = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const engineCode = fs.readFileSync(new URL('./platform-schedule-job.js', import.meta.url), 'utf8').trim();
const eventCode = fs.readFileSync(new URL('./platform-schedule-job-submit-before.js', import.meta.url), 'utf8').trim();

test('SaaS 官方包包含 Managed 定时任务接口引擎', () => {
  const engine = packageData.SysApiEngines.find(item => item.ApiEngineKey === 'platform-schedule-job');
  assert.ok(engine);
  assert.equal(engine.ApiV8Code.replace(/\r\n/g, '\n').trim(), engineCode.replace(/\r\n/g, '\n'));
  assert.deepEqual(packageData.ResourcePolicies.ApiEngines['platform-schedule-job'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed'
  });
});

test('diy_schedule_job 只通过接口引擎编排且不再调用旧 Job Controller', () => {
  const table = packageData.DiyTables.find(item => String(item.Name || '').toLowerCase() === 'diy_schedule_job');
  assert.ok(table);
  assert.equal(table.SubmitBeforeServerV8.replace(/\r\n/g, '\n').trim(), eventCode.replace(/\r\n/g, '\n'));
  assert.match(table.SubmitBeforeServerV8, /V8\.ApiEngine\.Run\('platform-schedule-job'/);
  assert.doesNotMatch(`${table.SubmitBeforeServerV8}\n${table.OutFormV8}`, /\/api\/Job\//i);
});

test('官方包元数据与接口引擎数量一致', () => {
  assert.equal(packageData.PackageInfo.ApiEngineCount, packageData.SysApiEngines.length);
});
