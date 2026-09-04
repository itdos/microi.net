import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialPackageExecutionLimits } from './resource-sync-core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(directory, 'app.microi.saas-engine.json');
const storePackagePath = path.join(directory, 'app.microi.store.json');
const officialResourcePath = path.join(directory, 'official-resource-api.js');
const importerPath = path.join(directory, 'import-package.js');
const pagePath = path.join(directory, 'platform-home-page.json');
const packageVersion = 'v7.8.24';
const storePackageVersion = 'v7.9.20';
const officialResourceVersion = 'v1.3.5';
const importerVersion = 'v2.7.2';
const releaseTime = '2026-09-04 18:00:00';
const changeLogContent = '智能首页菜单绑定界面引擎并固定 PAGE5 身份；为所有有效角色幂等补齐首页及组件菜单 Read 权限，新建或重存角色自动保留首页只读基线，日历与公告查询显式携带菜单上下文。';
const history = `2026-09-04 ${packageVersion} ${changeLogContent}`;
const storeChangeLogContent = '导入器 v2.7.2 新增受信官方包 MenuReadGrants 合同，只允许为全部有效角色幂等补 Read，保留既有权限并强回读、失效授权缓存。';
const storeHistory = `2026-09-04 ${storePackageVersion} ${storeChangeLogContent}`;
const homePageId = 'd50ea9ce-c4d1-445f-b1f6-1e456bd4cd90';
const homeMenuId = 'daa16941-afa8-4263-a77d-26a14b679bbd';
const pageTableId = 'f41b3c12-3bab-412e-a891-22835e45d15a';
const calendarMenuId = 'a283360d-9f1f-43d3-9380-074d60b87375';
const calendarTableId = 'b86834b1-cf01-4be1-a700-9977aa0189b1';
const workMenuId = '299b8094-7e9e-4862-8e3c-62fdc4cc8a09';
const flowMenuId = '01KX884VMCV672GN43Z5RCT84X';
const noticeMenuId = '01KX884VXENKCJQMMTYPS2PK63';

function prependOnce(value, line) {
  const current = String(value || '');
  return current.split(/\r?\n/).includes(line) ? current : `${line}\n${current}`;
}

const pageResource = JSON.parse(fs.readFileSync(pagePath, 'utf8'));
if (pageResource.Id !== homePageId
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
const noticeWidget = (pageResource.JsonObj?.wrapperList || [])
  .flatMap(wrapper => wrapper.widgetList || [])
  .find(widget => String(widget.type || '').toLowerCase() === 'diytable');
if (noticeWidget?.referencePolicy?.onMissing !== 'RemoveWidget') {
  throw new Error('platform-home-page.json 公告组件必须显式声明 referencePolicy.onMissing=RemoveWidget。');
}
const workCenterWidget = (pageResource.JsonObj?.wrapperList || [])
  .flatMap(wrapper => wrapper.widgetList || [])
  .find(widget => String(widget.type || '').toLowerCase() === 'workcenter');
const calendarWidget = (pageResource.JsonObj?.wrapperList || [])
  .flatMap(wrapper => wrapper.widgetList || [])
  .find(widget => String(widget.type || '').toLowerCase() === 'diycalendar');
if (workCenterWidget?.widgetParams?.[3]?.value !== noticeMenuId
    || workCenterWidget?.widgetParams?.[4]?.value !== calendarMenuId
    || calendarWidget?.widgetParams?.[0]?.value !== calendarMenuId) {
  throw new Error('platform-home-page.json 首页表单组件缺少明确的菜单权限上下文。');
}

let packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (packageModel?.PackageInfo?.Name !== 'SaaS引擎') throw new Error('SaaS引擎官方包身份不正确。');

packageModel.SysMenus ||= [];
packageModel.SysMenus = packageModel.SysMenus.filter(menu => ![homeMenuId, calendarMenuId].includes(menu.Id));
packageModel.SysMenus.push(
  {
    Id: homeMenuId,
    Name: '首页',
    Description: '所有登录账号可只读访问的智能工作首页。',
    Code: 'PlatformHome',
    Url: '/',
    ParentId: '00000000-0000-0000-0000-000000000000',
    Sort: -10000,
    IconClass: 'HomeFilled',
    OpenType: 'Diy',
    ComponentName: '界面引擎',
    ComponentPath: `/page-engine/renderer?Id=${homePageId}`,
    DiyTableId: pageTableId,
    DiyTableName: 'mic_page',
    MultRun: 1,
    Display: 1,
    AppDisplay: 1,
    IsDeleted: 0,
  },
  {
    Id: calendarMenuId,
    Name: '首页日历只读数据',
    Description: '智能首页日历组件的隐藏权限锚点。',
    Code: 'PlatformHomeCalendar',
    Url: '/platform-home-calendar',
    ParentId: '00000000-0000-0000-0000-000000000000',
    Sort: 99999,
    IconClass: 'Calendar',
    OpenType: 'Diy',
    ComponentName: '日历',
    ComponentPath: '/fullcalendar/fullcalendar',
    DiyTableId: calendarTableId,
    DiyTableName: 'microi_calendar',
    MultRun: 1,
    Display: 0,
    AppDisplay: 0,
    IsDeleted: 0,
  },
);

const roleTable = (packageModel.DiyTables || []).find(table => String(table.Name || '').toLowerCase() === 'sys_role');
if (!roleTable || !String(roleTable.SubmitBeforeServerV8 || '').includes('var originalMenuLimits = normalizedMenuLimits.slice(0);')) {
  throw new Error('SaaS引擎包缺少可升级的 sys_role SubmitBeforeServerV8 锚点。');
}
if (!String(roleTable.SubmitBeforeServerV8).includes('ROLE_REQUIRED_HOME_READ_V1')) {
  roleTable.SubmitBeforeServerV8 = String(roleTable.SubmitBeforeServerV8)
    .replace('Version: v1.0.5', 'Version: v1.0.6')
    .replace(
      'var originalMenuLimits = normalizedMenuLimits.slice(0);',
      [
        '// ROLE_REQUIRED_HOME_READ_V1：所有角色始终保留首页及已安装首页组件的只读菜单。',
        `var requiredHomeMenuIds = ${JSON.stringify([homeMenuId, calendarMenuId, workMenuId, flowMenuId, noticeMenuId])};`,
        'for (var requiredHomeIndex = 0; requiredHomeIndex < requiredHomeMenuIds.length; requiredHomeIndex++) {',
        '    var requiredHomeMenuId = requiredHomeMenuIds[requiredHomeIndex];',
        '    var requiredHomeKey = requiredHomeMenuId.toLowerCase();',
        '    if (menuModelById[requiredHomeKey] && !normalizedMenuById[requiredHomeKey]) {',
        '        var requiredHomeLimit = { Id: requiredHomeMenuId, Permission: \'["Read"]\' };',
        '        normalizedMenuLimits.push(requiredHomeLimit);',
        '        normalizedMenuById[requiredHomeKey] = requiredHomeLimit;',
        '    }',
        '}',
        'var originalMenuLimits = normalizedMenuLimits.slice(0);',
      ].join('\n'),
    );
}
if (!String(roleTable.SubmitBeforeServerV8).includes('mustLoadRequiredHomeMenus')) {
  roleTable.SubmitBeforeServerV8 = String(roleTable.SubmitBeforeServerV8).replace(
    'if (normalizedMenuLimits.length > 0) {',
    [
      'var mustLoadRequiredHomeMenus = true;',
      'if (normalizedMenuLimits.length > 0 || mustLoadRequiredHomeMenus) {',
    ].join('\n'),
  );
}

packageModel.ResourcePolicies ||= { SchemaVersion: 2 };
packageModel.ResourcePolicies.SchemaVersion = Math.max(2, Number(packageModel.ResourcePolicies.SchemaVersion || 1));
packageModel.ResourcePolicies.MenuReadGrants = [
  { MenuId: homeMenuId, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Fail' },
  { MenuId: calendarMenuId, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Fail' },
  { MenuId: workMenuId, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
  { MenuId: flowMenuId, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
  { MenuId: noticeMenuId, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
];

packageModel.DataSets ||= [];
packageModel.DataSets = packageModel.DataSets.filter(
  dataSet => String(dataSet.TableName || '').toLowerCase() !== 'mic_page',
);
packageModel.DataSets.push({
  TableId: pageTableId,
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
    'Importer:PageEngineOptionalReferenceV1',
    'Installer:AllRoleMenuReadGrantV1',
    'RoleEvent:RequiredHomeReadV1',
    'ClientFeature:PageEngineMenuScopedReadV1',
]);
info.RequiredPlatformCapabilities = Array.from(new Set([
  ...capabilities.filter(value => !names.has(String(value || '').split('@')[0])),
  'ClientFeature:PageEngineHomeOverviewV1',
  'PageEngineWidget:homeoverview',
    'ApiEngine:platform-home-overview@v1.0.0',
    'PageEngineResource:PAGE5@v2.0.0',
    'Importer:PageEngineOptionalReferenceV1',
    'Installer:AllRoleMenuReadGrantV1',
    'RoleEvent:RequiredHomeReadV1',
    'ClientFeature:PageEngineMenuScopedReadV1',
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
if (![storePackageVersion, 'v7.9.19'].includes(String(storeInfo.Version || ''))) {
  throw new Error(`app.microi.store.json 当前版本为 ${storeInfo.Version || '(空)'}，只允许从 v7.9.19 幂等生成 ${storePackageVersion}。`);
}
const changelogTenantColumn = (storePackageModel.PhysicalColumns || []).find(column => (
  String(column.TABLE_NAME || '').toLowerCase() === 'sys_microistore_changelog'
  && String(column.COLUMN_NAME || '').toLowerCase() === 'osclient'
));
if (!changelogTenantColumn || String(changelogTenantColumn.IS_NULLABLE || '').toUpperCase() !== 'NO') {
  throw new Error('应用商城包缺少 sys_microistore_changelog.OsClient NOT NULL 物理字段合同。');
}
if (changelogTenantColumn.COLUMN_DEFAULT !== null
    && changelogTenantColumn.COLUMN_DEFAULT !== undefined) {
  throw new Error('sys_microistore_changelog.OsClient 不得固化发布端租户默认值。');
}
changelogTenantColumn.BACKFILL_VALUE_SOURCE = 'TargetOsClient';
const storeEngines = Array.isArray(storePackageModel.SysApiEngines)
  ? storePackageModel.SysApiEngines
  : [];
const importerSource = fs.readFileSync(importerPath, 'utf8')
  .replace(/\r\n?/g, '\n')
  .replace(/\n*$/, '\n');
if (!importerSource.includes(`Version: ${importerVersion}`)
    || !importerSource.includes('PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1')
    || !importerSource.includes('PAGE_ENGINE_OPTIONAL_REFERENCE_V1')
    || !importerSource.includes('ALL_ROLE_MENU_READ_GRANT_V1')) {
  throw new Error(`import-package.js 尚未同步到 ${importerVersion} 安装加固合同。`);
}
const importerEngine = storeEngines.find(
  engine => engine.ApiEngineKey === 'import-microi-store-package',
);
if (!importerEngine) throw new Error('应用商城包缺少 import-microi-store-package。');
importerEngine.ApiV8Code = importerSource;
importerEngine.Version = importerVersion;
importerEngine.UpdateTime = releaseTime;
importerEngine.ChangeHistory = prependOnce(
  importerEngine.ChangeHistory,
  `${releaseTime} ${importerVersion} 新增受信官方包全角色菜单只读基线合同`,
);
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
    ...(Array.isArray(storeInfo[fieldName]) ? storeInfo[fieldName] : [])
      .filter(value => !String(value || '').startsWith('ApiEngine:import-microi-store-package@')),
    `ApiEngine:import-microi-store-package@${importerVersion}`,
    `ApiEngine:get-microi-upgrade-resource@${officialResourceVersion}`,
    'Importer:PhysicalNotNullTenantBackfillV1',
    'Importer:PageEngineOptionalReferenceV1',
    'Importer:AllRoleMenuReadGrantV1',
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
