import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureMinimumPackageVersion } from './resource-sync-core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resourcePath = path.join(directory, 'app.microi.saas-engine.json');
const sourceDirectory = path.resolve(
  directory,
  '..', '..', '..',
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '接口引擎',
  '系统',
  '身份与登录'
);
const legacySmsSourceDirectory = path.resolve(
  directory,
  '..', '..', '..',
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '接口引擎',
  '未分类'
);
const pkg = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));
const specs = [
  {
    id: '76000000-1000-4000-8000-000000000001',
    key: 'platform_auth_sms_login',
    name: '平台短信登录注册',
    file: '[系统]短信登录注册(platform_auth_sms_login).js',
    allowAnonymous: 1,
    stopHttp: 0,
    ownership: 'Platform',
    policy: 'Managed'
  },
  {
    id: '76000000-1000-4000-8000-000000000002',
    key: 'platform_auth_login_event',
    name: '平台登录事件',
    file: '[系统]登录事件(platform_auth_login_event).js',
    allowAnonymous: 0,
    stopHttp: 1,
    ownership: 'Platform',
    policy: 'Managed'
  },
  {
    id: '76000000-1000-4000-8000-000000000003',
    key: 'platform_auth_login_hook',
    name: '平台登录事件租户扩展',
    file: '[系统]登录事件租户扩展(platform_auth_login_hook).js',
    allowAnonymous: 0,
    stopHttp: 1,
    ownership: 'Tenant',
    policy: 'CreateIfMissing'
  },
  {
    id: '75f53822-864e-4633-8a58-4b0dc1627892',
    key: 'send_sms_reg',
    name: '[系统]发送阿里云短信',
    file: '[系统]发送阿里云短信(send_sms_reg).js',
    sourceDirectory: legacySmsSourceDirectory,
    allowAnonymous: 1,
    stopHttp: 0,
    ownership: 'Platform',
    policy: 'Managed',
    createTime: '2024-11-25 11:36:39',
    updateTime: '2026-08-21 15:00:00',
    version: 'v1.0.1',
    timeout: 600,
    category: '未分类',
    lockKey: '',
    responseFile: 0,
    responseType: '',
    v8Unlimited: 1,
    apiRemark: '需要输入正确的图形验证码后才能发送短信验证码，防止短信验证码接口被肉鸡。\n第三方短信验证码文档见附件。\n必传Phone（手机号）、_CaptchaId（验证码Id）、_CaptchaValue（验证码值）\nV8引擎代码中要用到的短信帐号密码均从系统设置中读取，而非超级管理员查看系统设置信息时无法查看到真实的短信帐号密码。',
    testParam: '{ "Phone" : "13967896935" }',
    changeHistory: '2026-08-21 15:00:00 v1.0.1 优先读取租户后端私有短信配置，旧 SaaS 凭据仅作成对兼容回退且响应不再回显 AccessKey。\n2026-07-06 16:45:45 短信发送结果按阿里云业务 Code 判断，流控等错误返回 Code=0\n'
  }
];
pkg.SysApiEngines ||= [];
for (const spec of specs) {
  const source = fs.readFileSync(path.join(spec.sourceDirectory || sourceDirectory, spec.file), 'utf8')
    .replace(/\r\n?/g, '\n')
    .replace(/\n*$/, '\n');
  const engine = {
    IsDeleted: 0,
    UserName: '管理员',
    UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
    CreateTime: spec.createTime || '2026-08-21 14:00:00',
    ...(spec.updateTime ? { UpdateTime: spec.updateTime } : {}),
    Id: spec.id,
    ChangeHistory: spec.changeHistory || `2026-08-21 14:00:00 v1.0.1 创建接口引擎 ${spec.key}\n`,
    Version: spec.version || 'v1.0.1',
    LimitRecursion: 5000,
    LimitMemory: 2048,
    MaxStatements: 100000000,
    Timeout: spec.timeout || 120,
    StopHttp: spec.stopHttp,
    EnableLog: 0,
    Category: spec.category || '系统/身份与登录',
    Files: '[]',
    AllowAnonymous: spec.allowAnonymous,
    ApiAddress: `/apiengine/${spec.key}`,
    Lock: 0,
    ...(spec.lockKey !== undefined ? { LockKey: spec.lockKey } : {}),
    ApiV8Code: source,
    ApiRole: '[]',
    ...(spec.responseFile !== undefined ? { ResponseFile: spec.responseFile } : {}),
    ...(spec.responseType !== undefined ? { ResponseType: spec.responseType } : {}),
    ...(spec.testParam !== undefined ? { TestParam: spec.testParam } : {}),
    ...(spec.v8Unlimited !== undefined ? { V8Unlimited: spec.v8Unlimited } : {}),
    ...(spec.apiRemark ? { ApiRemark: spec.apiRemark } : {}),
    IsEnable: 1,
    ApiEngineKey: spec.key,
    ApiName: spec.name
  };
  const existingIndex = pkg.SysApiEngines.findIndex(item => item.ApiEngineKey === spec.key);
  if (existingIndex >= 0) pkg.SysApiEngines[existingIndex] = engine;
  else pkg.SysApiEngines.push(engine);
}

pkg.ResourcePolicies ||= {};
pkg.ResourcePolicies.ApiEngines ||= {};
for (const spec of specs) {
  pkg.ResourcePolicies.ApiEngines[spec.key] = {
    Ownership: spec.ownership,
    UpgradePolicy: spec.policy
  };
}

const capabilities = new Set(pkg.PackageInfo.RequiredPlatformCapabilities || []);
for (const capability of [
  'ApiEngine:platform_auth_sms_login',
  'ApiEngine:platform_auth_login_event',
  'ApiEngine:send_sms_reg',
  'V8.Method.CreatePlatformSmsProof',
  'V8.Method.CreatePlatformSmsUser',
  'V8.Method.CompletePlatformSmsLogin'
]) capabilities.add(capability);
const releaseLine = '2026-08-21 v7.5.7 内嵌 microi-platform-service 升级至 v1.6.9，统一交付满高系统设置、清爽应用商城与主题化明暗模式。';
const smsLine = '2026-08-21 v7.5.5 将 send_sms_reg 作为 Managed/Platform 资源纳入 SaaS 基础包，保留匿名 HTTP 契约并优先读取租户后端私有短信配置。';
const identityLine = '2026-08-21 v7.5.2 将短信注册登录和登录事件迁入接口引擎，新增租户 CreateIfMissing 登录 Hook；后端仅保留验证码原子消费、现代密码哈希与 DiyToken 原子。';
const historyLines = String(pkg.PackageInfo.ChangeHistory || '').split('\n').filter(Boolean);
const uniqueHistoryLines = [...new Set(historyLines)];
if (!uniqueHistoryLines.includes(identityLine)) uniqueHistoryLines.push(identityLine);
if (!uniqueHistoryLines.includes(smsLine)) uniqueHistoryLines.push(smsLine);
if (!uniqueHistoryLines.includes(releaseLine)) uniqueHistoryLines.unshift(releaseLine);
ensureMinimumPackageVersion(pkg.PackageInfo, 'v7.5.7');
Object.assign(pkg.PackageInfo, {
  Description: 'SaaS 引擎基础资源。密码登录保留未安装应用时可用的最小后端启动内核；短信注册登录、统一登录审计与租户扩展由 Managed/CreateIfMissing 接口引擎编排。',
  ChangeHistory: `${uniqueHistoryLines.join('\n')}\n`,
  RequiredPlatformCapabilities: [...capabilities],
  ApiEngineCount: pkg.SysApiEngines.length
});

fs.writeFileSync(resourcePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  version: pkg.PackageInfo.Version,
  apiEngineCount: pkg.SysApiEngines.length,
  managedKeys: specs.map((item) => item.key)
}));
