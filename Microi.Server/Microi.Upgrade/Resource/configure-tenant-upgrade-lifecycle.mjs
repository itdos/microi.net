#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(root, 'app.microi.saas-engine.json');
const storePackagePath = resolve(root, 'app.microi.store.json');
const engineSourcePath = resolve(root, 'admin-upgrade-saas-tenant-database.js');
const domainBindingSourcePath = resolve(root, 'admin-ensure-saas-tenant-domain-binding.js');
const externalDomainBindingSourcePath = resolve(
  root,
  'admin-ensure-external-saas-tenant-domain-binding.js',
);
const progressContractPath = resolve(
  root,
  '..',
  '..',
  'Microi.Core',
  'Runtime',
  'TenantProvisioningProgressContract.cs',
);
const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
const storePackageModel = JSON.parse(await readFile(storePackagePath, 'utf8'));
const upgradeSource = await readFile(engineSourcePath, 'utf8');
const domainBindingSource = await readFile(domainBindingSourcePath, 'utf8');
const externalDomainBindingSource = await readFile(externalDomainBindingSourcePath, 'utf8');
const progressContractSource = await readFile(progressContractPath, 'utf8');
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
const saasOnly = process.argv.includes('--saas-only');

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

const progressTotalMatch = progressContractSource.match(
  /public\s+const\s+int\s+TotalSteps\s*=\s*(\d+)\s*;/,
);
const tenantProvisioningTotalSteps = Number(required(
  progressTotalMatch?.[1],
  '租户开通进度契约缺少 TotalSteps',
));
if (!Number.isSafeInteger(tenantProvisioningTotalSteps)
    || tenantProvisioningTotalSteps < 1) {
  throw new Error('租户开通进度契约 TotalSteps 不合法');
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label} 替换数量异常：${count}`);
  return source.replace(search, replacement);
}

function replaceSectionOnce(source, start, end, replacement, label) {
  const startCount = source.split(start).length - 1;
  const endCount = source.split(end).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(`${label} 边界数量异常：start=${startCount}, end=${endCount}`);
  }
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < startIndex) throw new Error(`${label} 结束边界早于开始边界`);
  return source.slice(0, startIndex)
    + replacement
    + source.slice(endIndex + end.length);
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
if (createEngine.Version === 'v1.0.4') {
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
if (createEngine.Version === 'v1.0.5') {
  const launchHelpers = String.raw`
function normalizeRuntimeBase(value) {
  var raw = toText(value);
  if (!raw) return '';
  var match = raw.match(/^(https?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?(\/[a-z0-9._~!$&'()*+,;=:@%/-]*)?$/i);
  if (!match) return '';
  var port = match[3] ? parseInt(match[3], 10) : 0;
  if (port > 65535) return '';
  return raw.replace(/\/+$/, '');
}

function copyProvisionData(source) {
  source = source || {};
  var result = {};
  var fields = [
    'OsClient', 'DbName', 'SystemName', 'DomainName',
    'OsClientType', 'OsClientNetwork', 'DbType', 'AdminAccount',
    'DatabaseSource', 'DatabaseZipName', 'DatabaseImport', 'Upgrade'
  ];
  for (var index = 0; index < fields.length; index++) {
    var field = fields[index];
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

function applyLaunchProjection(data) {
  var target = data || {};
  var launchUrl = runtimeApiBase && runtimeWebBase
    ? runtimeWebBase + '/?ApiBase=' + encodeURIComponent(runtimeApiBase)
      + '&OsClient=' + encodeURIComponent(tenantKey)
    : '';
  target.OsClient = target.OsClient || tenantKey;
  target.DomainName = target.DomainName || domainName;
  target.Url = launchUrl;
  target.LaunchUrl = launchUrl;
  target.LaunchUrlAvailable = !!launchUrl;
  target.LaunchApiBase = runtimeApiBase;
  target.LaunchWebBase = runtimeWebBase;
  target.LaunchContextSource = launchUrl ? 'HostRuntimeContext' : 'Unavailable';
  target.BareDomainUrl = domainName ? 'https://' + domainName : '';
  target.BareDomainReady = false;
  target.DomainBindingRequired = true;
  target.DomainBindingStatus = 'PendingExternalBinding';
  target.DomainBindingMessage = '该域名目前仅完成租户登记；DNS、证书与 Web 网关绑定并验证通过前，请使用安全启动地址。';
  return target;
}
`;
  createSource = replaceOnce(createSource, 'Version: v1.0.5', 'Version: v1.0.6', '管理员创建安全启动版本注释');
  createSource = replaceOnce(
    createSource,
    "function toBool(value) {\n  return value === true || value === 1 || toText(value).toLowerCase() === 'true';\n}\n",
    "function toBool(value) {\n  return value === true || value === 1 || toText(value).toLowerCase() === 'true';\n}\n" + launchHelpers,
    '管理员创建安全启动帮助方法',
  );
  createSource = replaceOnce(
    createSource,
    "var databaseZipName = toText(V8.Param.DatabaseZipName || V8.Param.SqlZipName);\nvar validateOnly = toBool(V8.Param.ValidateOnly);",
    "var databaseZipName = toText(V8.Param.DatabaseZipName || V8.Param.SqlZipName);\nvar runtimeApiBaseRaw = toText(V8.Param.RuntimeApiBase);\nvar runtimeWebBaseRaw = toText(V8.Param.RuntimeWebBase);\nvar runtimeApiBase = normalizeRuntimeBase(runtimeApiBaseRaw);\nvar runtimeWebBase = normalizeRuntimeBase(runtimeWebBaseRaw);\nvar validateOnly = toBool(V8.Param.ValidateOnly);",
    '管理员创建宿主运行地址输入',
  );
  createSource = replaceOnce(
    createSource,
    "if (dbType !== 'MySql') return fail(1, '当前 SaaS 租户开通能力仅支持 MySql。');",
    "if (runtimeApiBaseRaw && !runtimeApiBase) {\n  return fail(1, '当前宿主 ApiBase 不是安全的 http/https 根地址，已拒绝生成租户启动链接。');\n}\nif (runtimeWebBaseRaw && !runtimeWebBase) {\n  return fail(1, '当前宿主 WebBase 不是安全的 http/https 根地址，已拒绝生成租户启动链接。');\n}\nif (dbType !== 'MySql') return fail(1, '当前 SaaS 租户开通能力仅支持 MySql。');",
    '管理员创建宿主运行地址校验',
  );
  createSource = replaceOnce(
    createSource,
    "    Data: {\n      OsClient: tenantKey,\n      SystemName: systemName,\n      OsClientType: osClientType,\n      OsClientNetwork: osClientNetwork,\n      DomainName: domainName,\n      DbType: dbType,\n      DatabaseSource: useCustomZip ? 'CustomZip' : 'OfficialEmpty',\n      ValidateOnly: true\n    }",
    "    Data: applyLaunchProjection({\n      OsClient: tenantKey,\n      SystemName: systemName,\n      OsClientType: osClientType,\n      OsClientNetwork: osClientNetwork,\n      DomainName: domainName,\n      DbType: dbType,\n      DatabaseSource: useCustomZip ? 'CustomZip' : 'OfficialEmpty',\n      ValidateOnly: true\n    })",
    '管理员创建预检启动投影',
  );
  createSource = replaceOnce(
    createSource,
    '  Data: provisionResult.Data,',
    '  Data: applyLaunchProjection(copyProvisionData(provisionResult.Data)),',
    '管理员创建结果启动投影',
  );
}
const domainBindingFlow = String.raw`
var responseData = applyLaunchProjection(copyProvisionData(provisionResult.Data));
responseData.DomainBindingCompensationApi = 'admin_ensure_saas_tenant_domain_binding';
responseData.DomainBindingRetryable = true;
var domainBindingResult = null;
if (V8.ApiEngine && typeof V8.ApiEngine.Run === 'function') {
  report(${tenantProvisioningTotalSteps - 1}, '租户数据库已创建，正在绑定精确访问域名');
  try {
    domainBindingResult = V8.ApiEngine.Run('admin_ensure_saas_tenant_domain_binding', {
      TenantKey: tenantKey
    });
  } catch (bindingError) {
    domainBindingResult = {
      Code: 0,
      Data: { DomainBindingStatus: 'Failed' }
    };
  }
} else {
  domainBindingResult = {
    Code: 0,
    Data: { DomainBindingStatus: 'PendingCapabilityUpgrade' }
  };
}

var domainBindingData = domainBindingResult && domainBindingResult.Data
  ? domainBindingResult.Data
  : {};
responseData.ControlPlaneVerified = domainBindingData.ControlPlaneVerified === true;
responseData.DataPlaneStatus = toText(domainBindingData.DataPlaneStatus) || 'NotProbed';
responseData.HttpStatus = domainBindingData.HttpStatus === null
    || domainBindingData.HttpStatus === undefined
  ? null
  : Number(domainBindingData.HttpStatus);
responseData.DomainBindingDiagnostic = toText(domainBindingData.Diagnostic);
responseData.OriginProtectionDiagnosticStatus = toText(
  domainBindingData.OriginProtectionDiagnosticStatus
);
responseData.OriginProtection = toText(domainBindingData.OriginProtection);
responseData.OriginConverge = toText(domainBindingData.OriginConverge);
responseData.AutoConfirmIPList = toText(domainBindingData.AutoConfirmIPList);
responseData.NeedUpdate = domainBindingData.NeedUpdate === true;
var domainBindingVerified = !!(
  domainBindingResult && domainBindingResult.Code === 1
  && domainBindingData.DomainBindingStatus === 'Verified'
  && domainBindingData.ControlPlaneVerified === true
  && domainBindingData.BareDomainReady === true
  && domainBindingData.DataPlaneStatus === 'Ready'
  && Number(domainBindingData.HttpStatus) >= 100
  && Number(domainBindingData.HttpStatus) < 500
);
if (domainBindingVerified) {
  responseData.BareDomainReady = true;
  responseData.DomainBindingRequired = false;
  responseData.DomainBindingRetryable = false;
  responseData.DomainBindingStatus = 'Verified';
  responseData.DomainBindingAction = toText(domainBindingData.Action);
  responseData.DomainBindingMessage = '精确域名已完成 ESA 控制面强回读与 HTTPS 数据面验证。';
  responseData.Url = responseData.BareDomainUrl || responseData.LaunchUrl;
  responseData.LaunchContextSource = 'ExactEsaDomainBinding';
  report(${tenantProvisioningTotalSteps}, 'SaaS 租户创建成功，精确访问域名已完成控制面与数据面验证');
} else {
  responseData.BareDomainReady = false;
  responseData.DomainBindingRequired = true;
  responseData.DomainBindingRetryable = true;
  responseData.DomainBindingStatus = toText(domainBindingData.DomainBindingStatus) || 'Failed';
  responseData.DomainBindingMessage = responseData.ControlPlaneVerified
    ? (responseData.DomainBindingDiagnostic
      || 'ESA 控制面已验证，但 HTTPS 数据面尚未就绪，可使用相同 TenantKey 幂等重试。')
    : '租户与数据库已创建；精确域名绑定未完成，可使用相同 TenantKey 幂等补偿。';
  report(
    ${tenantProvisioningTotalSteps},
    responseData.ControlPlaneVerified
      ? 'SaaS 租户创建成功；精确域名控制面已验证，HTTPS 数据面待就绪'
      : 'SaaS 租户创建成功；精确域名绑定待幂等补偿'
  );
}

return {
  Code: 1,
  Msg: domainBindingVerified
    ? 'SaaS 租户创建成功，精确域名绑定已验证。'
    : 'SaaS 租户创建成功；精确域名绑定待幂等补偿。',
  Data: responseData,
  DataAppend: provisionResult.DataAppend || {}
};
`;
if (createEngine.Version === 'v1.0.6') {
  createSource = replaceOnce(
    createSource,
    'Version: v1.0.6',
    'Version: v1.0.7',
    '管理员创建精确域名绑定版本注释',
  );
  createSource = replaceOnce(
    createSource,
    'var totalSteps = 12;',
    `var totalSteps = ${tenantProvisioningTotalSteps};`,
    '管理员创建精确域名绑定总步骤',
  );
  createSource = replaceOnce(
    createSource,
    "report(12, 'SaaS 租户创建及数据库升级检查成功');\nreturn {\n  Code: 1,\n  Msg: provisionResult.Msg || 'SaaS 租户创建成功。',\n  Data: applyLaunchProjection(copyProvisionData(provisionResult.Data)),\n  DataAppend: provisionResult.DataAppend || {}\n};",
    domainBindingFlow.trim(),
    '管理员创建精确域名绑定闭环',
  );
  createEngine.Version = 'v1.0.7';
}
if (createEngine.Version === 'v1.0.7') {
  createSource = replaceOnce(
    createSource,
    'Version: v1.0.7',
    'Version: v1.0.8',
    '管理员创建域名数据面验收版本注释',
  );
  createEngine.Version = 'v1.0.8';
}
if (createEngine.Version === 'v1.0.8') {
  createSource = replaceSectionOnce(
    createSource,
    'var responseData = applyLaunchProjection(copyProvisionData(provisionResult.Data));',
    '  DataAppend: provisionResult.DataAppend || {}\n};',
    domainBindingFlow.trim(),
    '管理员创建精确域名绑定数据面投影',
  );
}
if (createEngine.Version !== 'v1.0.8') {
  throw new Error(`不支持从 ${createEngine.Version || '(空版本)'} 更新 admin_create_empty_saas_tenant`);
}
const progressTotalDeclarations = createSource.match(/var\s+totalSteps\s*=\s*\d+\s*;/g) || [];
if (progressTotalDeclarations.length !== 1) {
  throw new Error('admin_create_empty_saas_tenant 的 totalSteps 声明数量异常');
}
createSource = createSource.replace(
  /var\s+totalSteps\s*=\s*\d+\s*;/,
  `var totalSteps = ${tenantProvisioningTotalSteps};`,
);
createSource = createSource
  .replace(
    /report\(\d+, '租户数据库已创建，正在绑定精确访问域名'\);/,
    `report(${tenantProvisioningTotalSteps - 1}, '租户数据库已创建，正在绑定精确访问域名');`,
  )
  .replace(
    /report\(\d+, 'SaaS 租户创建成功，精确访问域名已完成 ESA 强回读'\);/,
    `report(${tenantProvisioningTotalSteps}, 'SaaS 租户创建成功，精确访问域名已完成 ESA 强回读');`,
  )
  .replace(
    /report\(\d+, 'SaaS 租户创建成功；精确域名绑定待幂等补偿'\);/,
    `report(${tenantProvisioningTotalSteps}, 'SaaS 租户创建成功；精确域名绑定待幂等补偿');`,
  );
createEngine.ApiV8Code = createSource;
createEngine.Version = 'v1.0.8';
createEngine.StopHttp = 1;
createEngine.UpdateTime = releaseTime;
createEngine.ApiRemark = '主租户超级管理员通过持久后台任务创建 SaaS 租户；数据库成功后自动绑定单标签 microi.net 精确域名，失败不回滚大库并返回幂等补偿状态。';
createEngine.ChangeHistory = prependUnique(
  createEngine.ChangeHistory,
  `${releaseTime} v1.0.8 精确域名必须同时通过 ESA 控制面强回读与 HTTPS 数据面探测才标记就绪；522 保留已成功导入的租户数据库，并返回只读源站防护诊断供幂等补偿。`,
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

const domainBindingEngine = {
  IsDeleted: 0,
  UserName: '管理员',
  UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
  UpdateTime: releaseTime,
  CreateTime: releaseTime,
  Id: '657dd025-e954-4c0f-9c7f-cf7f26f3c61d',
  ChangeHistory: `${releaseTime} v1.0.3 控制面强回读后增加固定公网 IP 的有界 HTTPS 数据面验收；仅非 5xx 才就绪，522 返回只读 ESA 源站防护 CIDR 诊断且不修改白名单。\n${releaseTime} v1.0.2 兼容 MCP/接口调试运行时追加的短标量 TestParam1 占位字段；该值完全丢弃，对象、数组、超长值及其它未知字段继续失败关闭。\n${releaseTime} v1.0.1 兼容 MCP/接口运行时注入的角色授权标记与 W3C traceparent；仅接受 true/1 与严格合法链路值，其它未知或畸形字段继续失败关闭。\n${releaseTime} v1.0.0 新增 SaaS 租户单标签 microi.net 精确 ESA CNAME 绑定；凭据只取当前主租户运行配置，目标与源站均从权威 sys_osclients 回读，失败可幂等补偿。`,
  Version: 'v1.0.3',
  LimitRecursion: 5000,
  LimitMemory: 512,
  MaxStatements: 1000000,
  Timeout: 300,
  StopHttp: 1,
  EnableLog: 0,
  Category: '系统',
  Files: '[]',
  AllowAnonymous: 0,
  ApiAddress: '/apiengine/admin_ensure_saas_tenant_domain_binding',
  TestParam: JSON.stringify({ TenantKey: 'sample-tenant' }),
  ApiRemark: '主租户超级管理员按 TenantKey 或 Id 幂等绑定精确 SaaS 域名；禁止通配符，不接收域名、源站或 ESA 凭据。',
  Lock: 0,
  ApiV8Code: domainBindingSource,
  ApiRole: '[]',
  IsEnable: 1,
  ApiEngineKey: 'admin_ensure_saas_tenant_domain_binding',
  ApiName: '[SaaS引擎]绑定租户精确访问域名',
};
const existingDomainBindingIndex = engines.findIndex(
  item => item?.ApiEngineKey === domainBindingEngine.ApiEngineKey,
);
if (existingDomainBindingIndex >= 0) engines[existingDomainBindingIndex] = domainBindingEngine;
else engines.push(domainBindingEngine);

const externalDomainBindingEngine = {
  IsDeleted: 0,
  UserName: '管理员',
  UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
  UpdateTime: releaseTime,
  CreateTime: releaseTime,
  Id: 'cdfc126b-7766-4515-9ba8-3fe144a5f63f',
  ChangeHistory: `${releaseTime} v1.0.2 控制面强回读后增加固定公网 IP 的有界 HTTPS 数据面验收；仅非 5xx 才就绪，522 返回只读 ESA 源站防护 CIDR 诊断且不修改白名单。\n${releaseTime} v1.0.1 改用独立 AuthorizeExternalSaasTenantDomainBinding 宿主授权原子，精确固定新接口 Key 与 iTdos 官方租户，不再复用本地租户域名绑定权限。\n${releaseTime} v1.0.0 新增不下放 ESA 凭据的官方运营控制面；仅允许平台超级管理员将一个单标签 TenantKey.microi.net 绑定到独立纯主机源站，并强回读全部固定 ESA 安全策略。`,
  Version: 'v1.0.2',
  LimitRecursion: 5000,
  LimitMemory: 512,
  MaxStatements: 1000000,
  Timeout: 300,
  StopHttp: 1,
  EnableLog: 0,
  Category: '系统',
  Files: '[]',
  AllowAnonymous: 0,
  ApiAddress: '/apiengine/admin_ensure_external_saas_tenant_domain_binding',
  TestParam: JSON.stringify({
    TenantKey: 'sample-tenant',
    OriginDomain: 'dev.example.com',
  }),
  ApiRemark: 'iTdos 官方运营超级管理员为外部 SaaS 幂等绑定精确 microi.net 域名；凭据仅留在 iTdos 运行时。',
  LockKey: 'TenantKey',
  Lock: 1,
  ApiV8Code: externalDomainBindingSource,
  ApiRole: '[]',
  IsEnable: 1,
  ApiEngineKey: 'admin_ensure_external_saas_tenant_domain_binding',
  ApiName: '[SaaS引擎]官方运营绑定外部租户域名',
};
const existingExternalDomainBindingIndex = engines.findIndex(
  item => item?.ApiEngineKey === externalDomainBindingEngine.ApiEngineKey,
);
if (existingExternalDomainBindingIndex >= 0) {
  engines[existingExternalDomainBindingIndex] = externalDomainBindingEngine;
} else {
  engines.push(externalDomainBindingEngine);
}

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
packageModel.ResourcePolicies.ApiEngines[domainBindingEngine.ApiEngineKey] = {
  Ownership: 'Platform',
  UpgradePolicy: 'Managed',
};
packageModel.ResourcePolicies.ApiEngines[externalDomainBindingEngine.ApiEngineKey] = {
  Ownership: 'Platform',
  UpgradePolicy: 'Managed',
};
ensureCapability('V8.Method.UpgradeAdminTenantDatabase');
ensureCapability('IMicroiUpgrade.UpgradeTenantAsync');
packageModel.PackageInfo.RequiredPlatformCapabilities = (
  packageModel.PackageInfo.RequiredPlatformCapabilities || []
).filter(item => !String(item).startsWith('ApiEngine:admin_create_empty_saas_tenant@'));
ensureCapability('ApiEngine:admin_create_empty_saas_tenant@v1.0.8');
packageModel.PackageInfo.RequiredPlatformCapabilities = (
  packageModel.PackageInfo.RequiredPlatformCapabilities || []
).filter(item => !String(item).startsWith('ApiEngine:admin_upgrade_saas_tenant_database@'));
ensureCapability('ApiEngine:admin_upgrade_saas_tenant_database@v1.0.8');
packageModel.PackageInfo.RequiredPlatformCapabilities = (
  packageModel.PackageInfo.RequiredPlatformCapabilities || []
).filter(item => !String(item).startsWith('ApiEngine:admin_ensure_saas_tenant_domain_binding@'));
ensureCapability('ApiEngine:admin_ensure_saas_tenant_domain_binding@v1.0.3');
packageModel.PackageInfo.RequiredPlatformCapabilities = (
  packageModel.PackageInfo.RequiredPlatformCapabilities || []
).filter(item => !String(item)
  .startsWith('ApiEngine:admin_ensure_external_saas_tenant_domain_binding@'));
ensureCapability('ApiEngine:admin_ensure_external_saas_tenant_domain_binding@v1.0.2');
ensureCapability('V8.Method.AuthorizeAdminTenantDomainBinding');
ensureCapability('V8.Method.AuthorizeExternalSaasTenantDomainBinding');
ensureCapability('V8.Alidns.EnsureExactESACnameRecord');
ensureCapability('MicroServiceRoute:microi-platform-service/tenant-database-upgrade');
packageModel.PackageInfo.ApiEngineCount = engines.length;
if (!['v7.8.22', 'v7.8.23'].includes(packageModel.PackageInfo.Version)) {
  throw new Error(`SaaS 包版本不是预期的 v7.8.22/v7.8.23：${packageModel.PackageInfo.Version}`);
}
packageModel.PackageInfo.Version = 'v7.8.23';
packageModel.PackageInfo.Description = 'SaaS 引擎基础资源。提供租户开通、启动运行时、自动数据库升级、精确访问域名 ESA 控制面与 HTTPS 数据面双重验收、522 只读源站防护诊断、不下放密钥的官方运营绑定，以及主租户受控的子租户数据库连接修复与幂等升级入口。';
const changeLogContent = '修正 SaaS 精确域名就绪判定：ESA CNAME、代理、源站、Host 与 SNI 的控制面强回读成功后，继续对同一精确域名执行 DNS 单次解析并固定公网 IP 的有界 HTTPS 探测；仅 HTTP 非 5xx 才返回 BareDomainReady=true，DNS、TLS、网络超时、5xx 与 522 均保持可重试未就绪。仅在 522 时只读返回 GetOriginProtection 的当前、最新及差异 CIDR、NeedUpdate 与截断状态，绝不自动修改或确认白名单；租户数据库已成功时继续保留，不因域名数据面故障回滚或删除。';
const historyLine = `${releaseTime.slice(0, 10)} ${packageModel.PackageInfo.Version} ${changeLogContent}`;
packageModel.PackageInfo.ChangeHistory = prependUnique(packageModel.PackageInfo.ChangeHistory, historyLine);
packageModel.PackageInfo.ChangeLog = {
  Version: packageModel.PackageInfo.Version,
  Title: 'ESA域名绑定增加真实数据面验收',
  ChangeType: 'Fix',
  Content: changeLogContent,
  ReleaseTime: releaseTime,
};

if (!saasOnly) {
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
}

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
if (!saasOnly) {
  await writeFile(storePackagePath, `${JSON.stringify(storePackageModel, null, 2)}\n`, 'utf8');
}
process.stdout.write(JSON.stringify({
  packageVersion: packageModel.PackageInfo.Version,
  storePackageVersion: storePackageModel.PackageInfo.Version,
  apiEngineCount: engines.length,
  createEngineVersion: createEngine.Version,
  workerEngineVersion: workerEngine.Version,
  upgradeEngineVersion: newEngine.Version,
  domainBindingEngineVersion: domainBindingEngine.Version,
  externalDomainBindingEngineVersion: externalDomainBindingEngine.Version,
  moreButtonCount: moreButtons.length,
}, null, 2) + '\n');
