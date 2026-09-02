#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(root, 'app.microi.saas-engine.json');
const storePackagePath = resolve(root, 'app.microi.store.json');
const engineSourcePath = resolve(root, 'admin-upgrade-saas-tenant-database.js');
const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
const storePackageModel = JSON.parse(await readFile(storePackagePath, 'utf8'));
const upgradeSource = await readFile(engineSourcePath, 'utf8');
function formatLocalDateTime(value = new Date()) {
  const pad = part => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} `
    + `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function normalizeReleaseTime(value) {
  const text = String(value || '').trim();
  if (!text) return formatLocalDateTime();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (!match) {
    throw new Error('--release-time 必须是 yyyy-MM-dd HH:mm:ss 或带时区的 ISO 日期时间');
  }
  return `${match[1]} ${match[2]}`;
}

const releaseTime = normalizeReleaseTime(
  process.argv.find(value => value.startsWith('--release-time='))?.slice(15),
);

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label} 替换数量异常：${count}`);
  return source.replace(search, replacement);
}

function prependUnique(text, line) {
  const current = String(text || '');
  return current.includes(line) ? current : `${line}\n${current}`;
}

function ensureCapability(capability) {
  const list = packageModel.PackageInfo.RequiredPlatformCapabilities
    || (packageModel.PackageInfo.RequiredPlatformCapabilities = []);
  if (!list.includes(capability)) list.push(capability);
}

const engines = packageModel.SysApiEngines || [];
const createEngine = required(
  engines.find(item => item?.ApiEngineKey === 'admin_create_empty_saas_tenant'),
  '缺少 admin_create_empty_saas_tenant',
);
let createSource = String(createEngine.ApiV8Code || '');
if (createEngine.Version !== 'v1.0.5') {
  createSource = replaceOnce(createSource, 'Version: v1.0.4', 'Version: v1.0.5', '管理员创建版本注释');
  createSource = replaceOnce(createSource, 'var totalSteps = 10;', 'var totalSteps = 12;', '管理员创建总步骤');
  createSource = replaceOnce(
    createSource,
    "var backgroundTaskId = toText(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId);",
    "var backgroundTaskId = toText(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId);\nvar backgroundTaskFencingToken = V8.Param._BackgroundTaskFencingToken || V8.Param.BackgroundTaskFencingToken || 0;",
    '管理员创建后台任务栅栏',
  );
  createSource = replaceOnce(
    createSource,
    "    DatabaseZipName: useCustomZip ? databaseZipName : ''\n  });",
    "    DatabaseZipName: useCustomZip ? databaseZipName : '',\n    _BackgroundTaskId: backgroundTaskId,\n    _BackgroundTaskFencingToken: backgroundTaskFencingToken\n  });",
    '管理员创建可信任务参数',
  );
  createSource = replaceOnce(createSource, "return fail(9, '创建 SaaS 租户异常：'", "return fail(11, '创建 SaaS 租户异常：'", '管理员创建异常步骤');
  createSource = replaceOnce(createSource, 'return fail(9, provisionResult', 'return fail(11, provisionResult', '管理员创建失败步骤');
  createSource = replaceOnce(createSource, "report(10, 'SaaS 租户创建成功');", "report(12, 'SaaS 租户创建及数据库升级检查成功');", '管理员创建成功步骤');
}
createEngine.ApiV8Code = createSource;
createEngine.Version = 'v1.0.5';
createEngine.StopHttp = 1;
createEngine.UpdateTime = releaseTime;
createEngine.ApiRemark = '主租户超级管理员通过持久后台任务创建 SaaS 租户；导入完成后自动执行幂等后端数据库升级并在弹窗展示真实进度。';
createEngine.ChangeHistory = prependUnique(
  createEngine.ChangeHistory,
  `${releaseTime} v1.0.5 新租户加载运行配置后自动执行统一后端升级协调器，任务日志展示真实迁移进度与版本结果。`,
);

const workerEngine = required(
  engines.find(item => item?.ApiEngineKey === 'official_create_tenant_worker'),
  '缺少 official_create_tenant_worker',
);
let workerSource = String(workerEngine.ApiV8Code || '');
if (workerEngine.Version !== 'v1.1.4') {
  workerSource = replaceOnce(workerSource, 'Version: v1.1.3', 'Version: v1.1.4', '官网工作器版本注释');
  workerSource = replaceOnce(
    workerSource,
    "  { Key: 'reload', Title: '刷新SaaS引擎缓存', Detail: '让新租户无需重启即可访问。', Status: 'pending' }",
    "  { Key: 'reload', Title: '刷新SaaS引擎缓存', Detail: '让新租户无需重启即可访问。', Status: 'pending' },\n  { Key: 'upgrade', Title: '升级租户数据库', Detail: '读取 ServerVersion，只执行未覆盖迁移并复检当前运行时结构。', Status: 'pending' }",
    '官网工作器升级步骤',
  );
  workerSource = workerSource.replaceAll(
    '    EncryptedPwd: adminEncryptedPwd\n  });',
    '    EncryptedPwd: adminEncryptedPwd,\n    _BackgroundTaskId: backgroundTaskId,\n    _BackgroundTaskFencingToken: backgroundTaskFencingToken\n  });',
  );
  workerSource = workerSource.replaceAll(
    '    AiApiKey: currentUserAiApiKey\n  });',
    '    AiApiKey: currentUserAiApiKey,\n    _BackgroundTaskId: backgroundTaskId,\n    _BackgroundTaskFencingToken: backgroundTaskFencingToken\n  });',
  );
  workerSource = replaceOnce(
    workerSource,
    "  done('reload', 'SaaS 引擎缓存刷新成功。');\n\n  var atomicData = atomicResult.Data || {};",
    "  done('reload', 'SaaS 引擎缓存刷新成功。');\n\n  var atomicData = atomicResult.Data || {};\n  done('upgrade', atomicData.Upgrade && atomicData.Upgrade.AlreadyCurrent\n    ? '数据库版本已覆盖，当前运行时结构复检通过。'\n    : '数据库未覆盖版本迁移与运行时结构复检已完成。');",
    '官网工作器原子升级结果',
  );
  workerSource = replaceOnce(
    workerSource,
    "    RemainingQuota: Math.max(tenantDatabaseQuota - usedQuota - 1, 0),\n    Steps: steps\n  }, 'reload');",
    "    RemainingQuota: Math.max(tenantDatabaseQuota - usedQuota - 1, 0),\n    Upgrade: atomicData.Upgrade || null,\n    Steps: steps\n  }, 'upgrade');",
    '官网工作器升级响应',
  );
}
if (!workerSource.includes('_BackgroundTaskFencingToken: backgroundTaskFencingToken')) {
  throw new Error('官网工作器没有透传后台任务栅栏令牌');
}
workerEngine.ApiV8Code = workerSource;
workerEngine.Version = 'v1.1.4';
workerEngine.UpdateTime = releaseTime;
workerEngine.ChangeHistory = prependUnique(
  workerEngine.ChangeHistory,
  `${releaseTime} v1.1.4 官网新租户原子开通完成后自动执行 ServerVersion 门禁升级，并回传升级前、目标与升级后版本。`,
);

const newEngine = {
  IsDeleted: 0,
  UserName: '管理员',
  UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
  UpdateTime: releaseTime,
  CreateTime: releaseTime,
  Id: '8a5dc338-e118-46e5-a975-796a6f9aa5fe',
  ChangeHistory: `${releaseTime} v1.0.8 兼容持久后台任务注入的授权、调用链、任务封装与 Client 语义，同时依靠可信服务端标记和栅栏失败关闭。\n${releaseTime} v1.0.0 新增主租户持久后台任务手动补跑子租户数据库升级。`,
  Version: 'v1.0.8',
  LimitRecursion: 5000,
  LimitMemory: 2048,
  MaxStatements: 100000000,
  Timeout: 3600,
  StopHttp: 1,
  EnableLog: 0,
  Category: '系统',
  Files: '[]',
  AllowAnonymous: 0,
  ApiAddress: '/apiengine/admin_upgrade_saas_tenant_database',
  TestParam: JSON.stringify({ TenantId: 'validate-only', TenantKey: 'tenant_key', OsClientType: 'Product', OsClientNetwork: 'Internal' }),
  ApiRemark: '主租户超级管理员通过持久后台任务幂等升级精确选中的子租户数据库；不接收数据库连接串。',
  LockKey: 'TenantKey',
  Lock: 1,
  ApiV8Code: upgradeSource,
  ApiRole: '[]',
  IsEnable: 1,
  ApiEngineKey: 'admin_upgrade_saas_tenant_database',
  ApiName: '[SaaS引擎]升级租户数据库',
};
const existingUpgradeIndex = engines.findIndex(item => item?.ApiEngineKey === newEngine.ApiEngineKey);
if (existingUpgradeIndex >= 0) engines[existingUpgradeIndex] = newEngine;
else engines.push(newEngine);

const saasMenu = required(
  (packageModel.SysMenus || []).find(item => item?.Id === '42078414-512a-4840-9843-9b75ab79ba79'),
  '缺少 SaaS 引擎菜单',
);
const moreButtons = typeof saasMenu.MoreBtns === 'string'
  ? JSON.parse(saasMenu.MoreBtns || '[]')
  : (saasMenu.MoreBtns || []);
const upgradeButton = {
  Id: 'admin-upgrade-saas-tenant-database-row-btn',
  Sort: 20,
  Name: '升级租户数据库',
  Icon: 'fas fa-database',
  BtnStyle: 'success',
  ShowRow: true,
  IsVisible: true,
  V8CodeShow: "V8.Result = !!(V8.CurrentUser && parseInt(V8.CurrentUser.Level || 0, 10) >= 9999); return V8.Result;",
  V8Code: `V8.OpenAppDialog({
  AppKey: 'microi-platform-service',
  RoutePath: '/tenant-database-upgrade',
  Title: '升级租户数据库',
  Width: 'min(860px, calc(100vw - 24px))',
  BodyHeight: 'min(760px, calc(100vh - 140px))',
  Data: {
    TenantId: V8.Form.Id,
    TenantKey: V8.Form.OsClient,
    OsClientType: V8.Form.OsClientType,
    OsClientNetwork: V8.Form.OsClientNetwork
  },
  OnSuccess: function(result) {
    V8.Tips((result && result.AlreadyCurrent) ? '数据库版本已覆盖，运行时结构复检通过。' : '租户数据库升级完成。', true);
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnError: function(error) {
    V8.Tips('升级页面加载失败：' + ((error && error.message) || '未知错误'), false);
  }
});`,
  _RawName: '升级租户数据库',
};
const existingButtonIndex = moreButtons.findIndex(item => item?.Id === upgradeButton.Id);
if (existingButtonIndex >= 0) moreButtons[existingButtonIndex] = upgradeButton;
else moreButtons.push(upgradeButton);
moreButtons.sort((left, right) => Number(left?.Sort || 0) - Number(right?.Sort || 0));
saasMenu.MoreBtns = typeof saasMenu.MoreBtns === 'string'
  ? JSON.stringify(moreButtons)
  : moreButtons;

packageModel.ResourcePolicies.ApiEngines[newEngine.ApiEngineKey] = {
  Ownership: 'Platform',
  UpgradePolicy: 'Managed',
};
ensureCapability('V8.Method.UpgradeAdminTenantDatabase');
ensureCapability('IMicroiUpgrade.UpgradeTenantAsync');
packageModel.PackageInfo.RequiredPlatformCapabilities = (
  packageModel.PackageInfo.RequiredPlatformCapabilities || []
).filter(item => !String(item).startsWith('ApiEngine:admin_upgrade_saas_tenant_database@'));
ensureCapability('ApiEngine:admin_upgrade_saas_tenant_database@v1.0.8');
ensureCapability('MicroServiceRoute:microi-platform-service/tenant-database-upgrade');
packageModel.PackageInfo.ApiEngineCount = engines.length;
packageModel.PackageInfo.Description = 'SaaS 引擎基础资源。提供租户开通、启动运行时、自动数据库升级，以及主租户受控的子租户数据库连接修复与幂等升级入口。';
const changeLogContent = '新建或上传数据库的租户在返回成功前自动执行 ServerVersion 门禁升级；创建与手动补跑弹窗持续展示真实进度、执行记录和版本结果。';
const historyLine = `2026-09-02 ${packageModel.PackageInfo.Version} ${changeLogContent}`;
packageModel.PackageInfo.ChangeHistory = prependUnique(packageModel.PackageInfo.ChangeHistory, historyLine);
packageModel.PackageInfo.ChangeLog = {
  Version: packageModel.PackageInfo.Version,
  Title: 'SaaS租户数据库自动升级与可视化补跑',
  ChangeType: 'Fix',
  Content: changeLogContent,
  ReleaseTime: releaseTime,
};

const storeChangeLogContent = '内嵌 microi-platform-service v1.9.9 / CurrentVersion 52，新增租户数据库升级弹窗路由；创建租户与手动补跑均持续展示真实进度、执行记录和版本结果。';
const storeHistoryLine = `2026-09-02 ${storePackageModel.PackageInfo.Version} ${storeChangeLogContent}`;
storePackageModel.PackageInfo.ChangeHistory = prependUnique(
  storePackageModel.PackageInfo.ChangeHistory,
  storeHistoryLine,
);
storePackageModel.PackageInfo.ChangeLog = {
  Version: storePackageModel.PackageInfo.Version,
  Title: 'SaaS租户数据库升级弹窗交付',
  ChangeType: 'Fix',
  Content: storeChangeLogContent,
  ReleaseTime: releaseTime,
};

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
await writeFile(storePackagePath, `${JSON.stringify(storePackageModel, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  packageVersion: packageModel.PackageInfo.Version,
  storePackageVersion: storePackageModel.PackageInfo.Version,
  apiEngineCount: engines.length,
  createEngineVersion: createEngine.Version,
  workerEngineVersion: workerEngine.Version,
  upgradeEngineVersion: newEngine.Version,
  moreButtonCount: moreButtons.length,
}, null, 2) + '\n');
