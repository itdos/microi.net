import fs from 'node:fs';

const tableId = '0234e89e-2e80-4ae0-b86a-f53635e29460';
const mongoFieldId = '17b947c8-a42d-42ed-8743-a37f9a1917ea';
const component = '/job-engine/ExecutionLogs';

// 同一声明式布局进入 SaaS 启动包与独立任务调度包，不触碰任何业务任务/历史日志行。
for (const relative of ['./app.microi.saas-engine.json', './StandaloneApplications/app.microi.job.json']) {
  const file = new URL(relative, import.meta.url);
  const original = fs.readFileSync(file, 'utf8');
  const model = JSON.parse(original);
  const isSaas = relative.includes('saas-engine');
  const previousVersion = isSaas ? 'v8.3.31' : 'v6.2.5';
  const version = isSaas ? 'v8.3.32' : 'v6.2.6';
  if (![previousVersion, version].includes(model.PackageInfo.Version)) throw new Error(`${relative}: 包版本已被其它工作更新，请先合并`);
  const content = '任务日志改为 MongoDB 按月存储与游标查询；表单运行日志改为双页签，保留历史关系库入口并补充查询索引。提供只读 Quartz 状态诊断，不携带或覆盖租户业务任务与日志。';
  if (model.PackageInfo.Version !== version && model.PackageInfo.ChangeHistory)
    model.PackageInfo.ChangeHistory = `2026-09-15 ${version} ${content}\n` + model.PackageInfo.ChangeHistory;
  model.PackageInfo.Version = version;
  model.PackageInfo.ServerMinVersion = '8.3.6';
  model.PackageInfo.ClientMinVersion = '8.3.6';
  model.PackageInfo.ChangeLog = { Version: version, Title: '任务日志分库与调度诊断', ChangeType: 'Fix', Content: content, ReleaseTime: '2026-09-15 13:00:00' };
  const fields = model.DiyFields.filter(field => field.TableId === tableId);
  const group = fields.find(field => field.Name === 'RenwuZHRZ');
  const history = fields.find(field => field.Name === 'RizhiLB');
  if (!group || !history) throw new Error(`${relative}: 任务日志布局不存在`);
  Object.assign(group, {
    Component: 'Tabs', Type: '', Label: '运行日志', Sort: 2100, FormWidth: 24, Visible: 1, AppVisible: 1,
    Config: JSON.stringify({ FieldTabs: {
      ScopeMode: 'FieldCount', TotalFieldCount: 2, DefaultActiveKey: 'mongo', Type: 'card', Position: 'top',
      ShowFieldCount: false, CaptureRest: false,
      Tabs: [{ Key: 'mongo', Title: '运行日志', FieldCount: 1 }, { Key: 'history', Title: '历史日志', FieldCount: 1 }]
    } })
  });
  Object.assign(history, {
    Component: 'DevComponent', Type: '', Label: '历史日志', Sort: 2200, FormWidth: 24, Visible: 1, AppVisible: 1,
    Config: JSON.stringify({ DevComponentName: 'MicroiScheduleExecutionLogs', DevComponentPath: component, ScheduleLogSource: 'History' })
  });
  let mongo = fields.find(field => field.Name === 'MongoRunLogs');
  if (!mongo) {
    mongo = { Id: mongoFieldId, TableId: tableId, Name: 'MongoRunLogs' };
    model.DiyFields.push(mongo);
  }
  Object.assign(mongo, {
    Component: 'DevComponent', Type: '', Label: '运行日志', Sort: 2150, FormWidth: 24, Visible: 1, AppVisible: 1,
    Config: JSON.stringify({ DevComponentName: 'MicroiScheduleExecutionLogs', DevComponentPath: component, ScheduleLogSource: 'MongoDB' })
  });
  const index = 'idx_schedule_job_history_cursor';
  if (!model.DDLStatements.some(item => item.DDL?.includes(index))) model.DDLStatements.push({
    TableName: 'diy_schedule_job_log', TableId: '46a20630-dd2d-4dcb-8771-c21b6216d94a',
    DDL: `CREATE INDEX ${index} ON diy_schedule_job_log (JobName,CreateTime,Id);`
  });
  for (const engine of model.SysApiEngines || []) if (engine.ApiEngineKey === 'platform-schedule-job') {
    engine.ApiV8Code = fs.readFileSync(new URL('./platform-schedule-job.js', import.meta.url), 'utf8');
    engine.Version = engine.ApiV8Code.match(/Version:\s*(v[\d.]+)/)?.[1];
  }
  model.PackageInfo.FieldCount = model.DiyFields.length;
  model.PackageInfo.DDLCount = model.DDLStatements.length;
  fs.writeFileSync(file, JSON.stringify(model, null, original.includes('\n  "PackageInfo"') ? 2 : 0) + '\n');
  console.log(`${relative}: Tabs + MongoDB/历史日志；仅追加历史查询索引`);
}
