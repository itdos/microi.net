import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialPackageExecutionLimits } from './resource-sync-core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(directory, 'app.microi.saas-engine.json');
const storePackagePath = path.join(directory, 'app.microi.store.json');
const officialResourcePath = path.join(directory, 'official-resource-api.js');
const pagePath = path.join(directory, 'platform-home-page.json');
const packageVersion = 'v7.8.12';
const storePackageVersion = 'v7.9.8';
const officialResourceVersion = 'v1.3.5';
const releaseTime = '2026-09-03 18:00:00';
const changeLogContent = '首页首屏复用完整 AI 对话代码；新增 homeoverview 组件，以当前账号真实菜单访问聚合展示常用应用、趋势和个人指标，保留工作中心、日历与公告并适配明暗主题。';
const history = `2026-09-03 ${packageVersion} ${changeLogContent}`;
const storeChangeLogContent = '修复应用商城包内嵌控制面末尾多余空行，使其与已发布的 v1.3.5 独立控制面保持精确字节一致；保留系统账号首页统计资源闭包校验并恢复发布后的 live 接口投影。';
const storeHistory = `2026-09-03 ${storePackageVersion} ${storeChangeLogContent}`;

function prependOnce(value, line) {
  const current = String(value || '');
  return current.split(/\r?\n/).includes(line) ? current : `${line}\n${current}`;
}

const pageResource = JSON.parse(fs.readFileSync(pagePath, 'utf8'));
if (pageResource.Id !== 'd50ea9ce-c4d1-445f-b1f6-1e456bd4cd90'
    || pageResource.Number !== 'PAGE5'
    || pageResource.RoutePath !== '/') {
  throw new Error('platform-home-page.json 首页身份不正确。');
}
const widgets = (pageResource.JsonObj?.wrapperList || [])
  .flatMap(wrapper => wrapper.widgetList || [])
  .map(widget => String(widget.type || ''));
for (const required of ['aiengine', 'homeoverview', 'workcenter', 'diycalendar', 'diytable']) {
  if (!widgets.includes(required)) throw new Error(`platform-home-page.json 缺少 ${required}。`);
}

let packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (packageModel?.PackageInfo?.Name !== 'SaaS引擎') throw new Error('SaaS引擎官方包身份不正确。');

packageModel.DataSets ||= [];
packageModel.DataSets = packageModel.DataSets.filter(
  dataSet => String(dataSet.TableName || '').toLowerCase() !== 'mic_page',
);
packageModel.DataSets.push({
  TableId: 'f41b3c12-3bab-412e-a891-22835e45d15a',
  TableName: 'mic_page',
  TableDescription: '界面引擎',
  SelectionMode: 'Ids',
  RowIds: [pageResource.Id],
  Where: [],
  ConflictPolicy: 'UpsertById',
  ConflictFields: ['Id'],
  Rows: [{
    Id: pageResource.Id,
    CreateTime: '2025-12-23 13:33:26',
    UpdateTime: releaseTime,
    UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
    UserName: '管理员',
    IsDeleted: 0,
    Title: pageResource.Title,
    Number: pageResource.Number,
    Desc: pageResource.Desc,
    JsonObj: JSON.stringify(pageResource.JsonObj),
    RoutePath: pageResource.RoutePath,
    ComponentPath: pageResource.ComponentPath,
  }],
});

const info = packageModel.PackageInfo;
info.Version = packageVersion;
info.ChangeHistory = prependOnce(info.ChangeHistory, history);
info.ChangeLog = {
  Version: packageVersion,
  Title: '界面引擎智能工作首页',
  ChangeType: 'Feature',
  Content: changeLogContent,
  ReleaseTime: releaseTime,
};
const capabilities = Array.isArray(info.RequiredPlatformCapabilities)
  ? info.RequiredPlatformCapabilities
  : [];
const names = new Set([
  'ClientFeature:PageEngineHomeOverviewV1',
  'PageEngineWidget:homeoverview',
  'ApiEngine:platform-home-overview',
  'PageEngineResource:PAGE5',
]);
info.RequiredPlatformCapabilities = Array.from(new Set([
  ...capabilities.filter(value => !names.has(String(value || '').split('@')[0])),
  'ClientFeature:PageEngineHomeOverviewV1',
  'PageEngineWidget:homeoverview',
  'ApiEngine:platform-home-overview@v1.0.0',
  'PageEngineResource:PAGE5@v2.0.0',
]));
info.DataSetCount = packageModel.DataSets.length;
info.DataRowCount = packageModel.DataSets.reduce(
  (count, dataSet) => count + (Array.isArray(dataSet.Rows) ? dataSet.Rows.length : 0),
  0,
);

packageModel = JSON.parse(normalizeOfficialPackageExecutionLimits(
  path.basename(packagePath),
  JSON.stringify(packageModel),
));
fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');

const officialResourceSource = fs.readFileSync(officialResourcePath, 'utf8')
  .replace(/\r\n?/g, '\n')
  .replace(/\n*$/, '\n');
if (!officialResourceSource.includes(`Version: ${officialResourceVersion}`)
    || !officialResourceSource.includes('platform-home-overview')
    || !officialResourceSource.includes('HomeUsageStats')) {
  throw new Error(`official-resource-api.js 尚未同步到 ${officialResourceVersion} 首页资源闭包验证。`);
}

let storePackageModel = JSON.parse(fs.readFileSync(storePackagePath, 'utf8'));
const storeInfo = storePackageModel.PackageInfo || (storePackageModel.PackageInfo = {});
if (storeInfo.Name !== '应用商城') throw new Error('应用商城官方包身份不正确。');
if (![storePackageVersion, 'v7.9.7'].includes(String(storeInfo.Version || ''))) {
  throw new Error(`app.microi.store.json 当前版本为 ${storeInfo.Version || '(空)'}，只允许从 v7.9.7 幂等生成 ${storePackageVersion}。`);
}
const storeEngines = Array.isArray(storePackageModel.SysApiEngines)
  ? storePackageModel.SysApiEngines
  : [];
const officialResourceEngine = storeEngines.find(
  engine => engine.ApiEngineKey === 'get-microi-upgrade-resource',
);
if (!officialResourceEngine) throw new Error('应用商城包缺少 get-microi-upgrade-resource。');
officialResourceEngine.ApiV8Code = officialResourceSource;
officialResourceEngine.Version = officialResourceVersion;
officialResourceEngine.UpdateTime = releaseTime;
officialResourceEngine.ChangeHistory = prependOnce(
  officialResourceEngine.ChangeHistory,
  `${releaseTime} ${officialResourceVersion} 新增系统账号首页统计接口与隐藏字段的唯一所有权闭包校验`,
);
storeInfo.Version = storePackageVersion;
storeInfo.ChangeHistory = prependOnce(storeInfo.ChangeHistory, storeHistory);
storeInfo.ChangeLog = {
  Version: storePackageVersion,
  Title: '首页资源闭包发布控制面',
  ChangeType: 'Fix',
  Content: storeChangeLogContent,
  ReleaseTime: releaseTime,
};
for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
  storeInfo[fieldName] = Array.from(new Set([
    ...(Array.isArray(storeInfo[fieldName]) ? storeInfo[fieldName] : []),
    `ApiEngine:get-microi-upgrade-resource@${officialResourceVersion}`,
  ]));
}
storeInfo.ApiEngineCount = storeEngines.length;
storePackageModel.ResourcePolicies ||= { SchemaVersion: 1 };
storePackageModel.ResourcePolicies.ApiEngines ||= {};
storePackageModel.ResourcePolicies.ApiEngines['get-microi-upgrade-resource'] = {
  Ownership: 'Platform',
  UpgradePolicy: 'Managed',
};
storePackageModel = JSON.parse(normalizeOfficialPackageExecutionLimits(
  path.basename(storePackagePath),
  JSON.stringify(storePackageModel),
));
fs.writeFileSync(storePackagePath, `${JSON.stringify(storePackageModel, null, 2)}\n`, 'utf8');

process.stdout.write(`${path.basename(packagePath)}\t${packageVersion}\t${widgets.join(',')}\n`);
process.stdout.write(`${path.basename(storePackagePath)}\t${storePackageVersion}\t${officialResourceVersion}\n`);
