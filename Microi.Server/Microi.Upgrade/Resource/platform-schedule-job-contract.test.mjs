import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const packageData = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const engineCode = fs.readFileSync(new URL('./platform-schedule-job.js', import.meta.url), 'utf8').trim();
const eventCode = fs.readFileSync(new URL('./platform-schedule-job-submit-before.js', import.meta.url), 'utf8').trim();
const statsCode = fs.readFileSync(new URL('./mci-module-presentation-stats.js', import.meta.url), 'utf8').trim();
const legacyRoutes = [
  '/api/Job/GetAllJob',
  '/api/Job/GetJobDetail',
  '/api/Job/AddJob',
  '/api/Job/UpdateJob',
  '/api/Job/PauseJob',
  '/api/Job/ResumeJob',
  '/api/Job/DeleteJob'
];

function runEngine(param) {
  const calls = [];
  const context = {
    V8: {
      Param: param,
      FormEngine: {
        GetTableData(tableName, query) {
          calls.push({ type: 'list', tableName, query });
          return { Code: 1, Data: [], DataCount: 0 };
        },
        GetFormData(tableName, query) {
          calls.push({ type: 'detail', tableName, query });
          return { Code: 1, Data: { Id: query.Id, JobName: 'CompatJob' } };
        },
        UptFormData(tableName, row) {
          calls.push({ type: 'update', tableName, row });
          return { Code: 1, Data: row };
        }
      },
      Method: {
        ManageScheduleJob(request) {
          calls.push({ type: 'manage', request });
          if (request.Action === 'GetByNames') return { Code: 1, Data: [] };
          if (request.Action === 'GetDetail') {
            return { Code: 1, Data: { Status: '正常', LastTime: '', NextTime: '', CronExpression: '0 0 0 1 1 ? 2099' } };
          }
          return { Code: 1, Data: { JobName: request.JobName } };
        },
        SaveScheduleJob(request) {
          calls.push({ type: 'save', request });
          return {
            Code: 1,
            Data: { JobId: request.Id, JobName: request.JobName, Status: '正常', LastTime: '', NextTime: '2099-01-01 00:00:00' }
          };
        }
      }
    }
  };
  const result = vm.runInNewContext(`(function () {\n${engineCode}\n})()`, context);
  return { calls, result };
}

test('SaaS 官方包包含 Managed 定时任务接口引擎', () => {
  const engine = packageData.SysApiEngines.find(item => item.ApiEngineKey === 'platform-schedule-job');
  assert.ok(engine);
  assert.equal(engine.ApiV8Code.replace(/\r\n/g, '\n').trim(), engineCode.replace(/\r\n/g, '\n'));
  assert.equal(engine.Version, 'v1.0.1');
  assert.equal(engine.ApiRoutes, legacyRoutes.join(';'));
  assert.deepEqual(packageData.ResourcePolicies.ApiEngines['platform-schedule-job'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed'
  });
});

test('七条旧 Job 路由按可信请求路径映射动作且请求体不能改写动作', () => {
  const cases = [
    ['/api/Job/GetAllJob', 'list'],
    ['/api/Job/GetJobDetail', 'detail'],
    ['/api/Job/AddJob', 'save'],
    ['/api/Job/UpdateJob', 'save'],
    ['/api/Job/PauseJob', 'Pause'],
    ['/api/Job/ResumeJob', 'Resume'],
    ['/api/Job/DeleteJob', 'Delete']
  ];
  for (const [requestPath, expected] of cases) {
    const { calls, result } = runEngine({
      _RequestPath: requestPath,
      _HttpMethod: 'POST',
      Action: 'Delete',
      Id: 'compat-id',
      JobName: 'CompatJob',
      ApiEngineKey: 'platform-service-health',
      CronExpression: '0 0 0 1 1 ? 2099'
    });
    assert.equal(result.Code, 1, requestPath);
    if (expected === 'list' || expected === 'detail' || expected === 'save') {
      assert.ok(calls.some(item => item.type === expected), `${requestPath} 应执行 ${expected}`);
    } else {
      assert.ok(calls.some(item => item.type === 'manage' && item.request.Action === expected), `${requestPath} 应执行 ${expected}`);
    }
  }
});

test('旧 Job 路由兼容路径租户后缀、拒绝非 POST，规范入口动作大小写不敏感', () => {
  const suffixResult = runEngine({
    _RequestPath: '/api/Job/PauseJob--OsClient--iTdos--',
    _HttpMethod: 'POST',
    Id: 'compat-id',
    JobName: 'CompatJob'
  });
  assert.ok(suffixResult.calls.some(item => item.type === 'manage' && item.request.Action === 'Pause'));

  const getResult = runEngine({
    _RequestPath: '/api/Job/PauseJob',
    _HttpMethod: 'GET',
    Id: 'compat-id',
    JobName: 'CompatJob'
  });
  assert.equal(getResult.result.Code, 0);
  assert.equal(getResult.calls.length, 0);

  const canonicalResult = runEngine({
    _RequestPath: '/apiengine/platform-schedule-job',
    _HttpMethod: 'POST',
    Action: 'pAuSe',
    Id: 'compat-id',
    JobName: 'CompatJob'
  });
  assert.ok(canonicalResult.calls.some(item => item.type === 'manage' && item.request.Action === 'Pause'));
});

test('diy_schedule_job 只通过接口引擎编排且不再调用旧 Job Controller', () => {
  const table = packageData.DiyTables.find(item => String(item.Name || '').toLowerCase() === 'diy_schedule_job');
  assert.ok(table);
  assert.equal(table.SubmitBeforeServerV8.replace(/\r\n/g, '\n').trim(), eventCode.replace(/\r\n/g, '\n'));
  assert.match(table.SubmitBeforeServerV8, /V8\.ApiEngine\.Run\('platform-schedule-job'/);
  assert.doesNotMatch(`${table.SubmitBeforeServerV8}\n${table.OutFormV8}`, /\/api\/Job\//i);
});

test('任务调度菜单随 SaaS 官方包交付完整列表、搜索、排序和移动端字段', () => {
  const menu = packageData.SysMenus.find(item => item.Id === 'b08cce71-3a9e-4c4c-a2af-b0936b47b9a8');
  assert.ok(menu);
  assert.equal(menu.Url, '/job-engine');
  assert.equal(menu.DiyTableId, '0234e89e-2e80-4ae0-b86a-f53635e29460');
  assert.deepEqual(
    JSON.parse(menu.SearchFieldIds).map(item => item.Name),
    ['JobName', 'JobDesc', 'Status', 'ApiEngineKey', 'CronExpression', 'CronDesc']
  );
  assert.deepEqual(
    JSON.parse(menu.SelectFields).map(item => item.Name),
    ['JobName', 'JobDesc', 'JobType', 'JobParam', 'Status', 'LastTime', 'NextTime', 'ApiEngineKey', 'CronExpression', 'CronDesc']
  );
  assert.deepEqual(JSON.parse(menu.DefaultOrderBy).map(item => [item.Name, item.Type]), [['CreateTime', 'DESC']]);
  assert.deepEqual(
    JSON.parse(menu.MobileListFields).map(item => item.Name),
    ['JobName', 'JobDesc', 'Status', 'NextTime', 'ApiEngineKey']
  );
  assert.equal(menu.HiddenIndex, 1);
  assert.equal(menu.ViewConfigVersion, 5);
  const viewSchema = JSON.parse(menu.ViewSchema);
  const listView = viewSchema.Views.find(item => item.Scene === 'List');
  const dataCountMetric = listView.Layout.Hero.Metrics.find(item => item.Key === 'DataCount');
  const descriptionLine = listView.Layout.List.Columns[0].Lines.find(item => item.Name === 'JobDesc');
  assert.equal(dataCountMetric.Color, 'var(--mci-text-primary, #334155)');
  assert.equal(descriptionLine.ShowLabel, false);
  assert.equal(descriptionLine.Color, 'var(--mci-text-secondary, #475569)');
  const buttons = JSON.parse(menu.MoreBtns);
  assert.match(buttons.find(item => item.Name === '暂停').V8Code, /\/api\/Job\/PauseJob/);
  assert.match(buttons.find(item => item.Name === '恢复').V8Code, /\/api\/Job\/ResumeJob/);
});

test('任务调度启用指标按真实“正常”状态统计', () => {
  const engine = packageData.SysApiEngines.find(item => item.ApiEngineKey === 'mci-module-presentation-stats');
  assert.ok(engine);
  assert.equal(engine.Version, 'v1.0.7');
  assert.equal(engine.ApiV8Code.replace(/\r\n/g, '\n').trim(), statsCode.replace(/\r\n/g, '\n'));
  assert.match(statsCode, /Metric_2_Status\.Where = \[\['Status', '=', '正常'\]\]/);
});

test('官方包元数据与接口引擎数量一致', () => {
  assert.equal(packageData.PackageInfo.ApiEngineCount, packageData.SysApiEngines.length);
  assert.equal(packageData.PackageInfo.MenuCount, packageData.SysMenus.length);
});
