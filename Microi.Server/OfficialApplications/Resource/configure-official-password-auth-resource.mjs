import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOfficialApiSource } from './official-api-source.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const releaseTime = '2026-10-26 12:00:00';
export const passwordAuthReleases = [
  {
    file: 'app.microi.saas-engine.json', previous: 'v8.6.12', version: 'v8.6.13',
    content: '官网短信重置通过可信原子同时更新密码哈希与编码标识并撤销会话；密码登录支持唯一手机号别名、透传语言并保持已验证用户Id。仅State=1可登录；需后端8.7.5。',
    engines: [
      { key: 'official_sms_login', version: 'v1.1.7', id: '01KWTB17DXX1SEQ6KPK0QEWDFK' },
      { key: 'platform_auth_sms_login', version: 'v1.0.4', id: '76000000-1000-4000-8000-000000000001' },
      { key: 'official_password_reset', version: 'v1.0.1', id: '01KXNQH47N7WWYSREPC300N39Q' }
    ],
    capabilities: ['V8.Method.ResetPlatformSmsPassword', 'ApiEngine:official_sms_login@v1.1.7', 'ApiEngine:platform_auth_sms_login@v1.0.4', 'ApiEngine:official_password_reset@v1.0.1']
  },
  {
    file: 'app.microi.sys_user.json', previous: 'v8.4.12', version: 'v8.4.13',
    content: '系统账号管理增加历史密码编码不一致的管理员修复入口；可信原子复核主库管理员、限定用户与编码类型，支持只读预览并禁止进入租户Hook；需后端8.7.5。',
    engines: [{ key: 'platform-sys-user-admin', version: 'v1.0.5', id: '019d2a01-9d63-7f91-8c02-000000000009' }],
    capabilities: ['V8.Method.RepairPlatformPasswordEncoding', 'ApiEngine:platform-sys-user-admin@v1.0.5']
  }
];

function prepend(history, line) {
  const lines = String(history || '').split('\n').filter(Boolean);
  return `${[line, ...lines.filter(item => item !== line)].join('\n')}\n`;
}

// 只投影本修复拥有的四个接口；其它字段、安装种子和嵌入应用保持原样。
export function configurePasswordAuthPackage(pkg, release, sources) {
  if (![release.previous, release.version].includes(pkg.PackageInfo.Version)) {
    throw new Error(`${release.file}版本已变化，须重新选择发行版本，禁止覆盖并行发行。`);
  }
  const output = structuredClone(pkg);
  for (const spec of release.engines) {
    const source = sources[spec.key];
    if (!source || !source.includes(`Version: ${spec.version}`)) throw new Error(`接口源码版本无效：${spec.key}`);
    let engine = output.SysApiEngines.find(item => item.ApiEngineKey === spec.key);
    if (!engine) {
      if (spec.key !== 'official_password_reset') throw new Error(`现行包缺少接口：${spec.key}`);
      engine = {
        Id: spec.id, ApiEngineKey: spec.key, ApiName: '[官网]短信重置密码',
        IsDeleted: 0, IsEnable: 1, AllowAnonymous: 1, StopHttp: 0, EnableLog: 0,
        ApiAddress: `/apiengine/${spec.key}`, ApiRoutes: null,
        ApiRole: '[]', Category: '系统/身份与登录', Files: '[]',
        CreateTime: releaseTime, LimitRecursion: 5000, LimitMemory: 2048,
        MaxStatements: 100000000, Timeout: 120, Lock: 0
      };
      output.SysApiEngines.push(engine);
    }
    engine.ApiV8Code = source;
    engine.Version = spec.version;
    engine.UpdateTime = releaseTime;
    engine.ChangeHistory = prepend(engine.ChangeHistory, `2026-10-26 ${spec.version} ${release.content}`);
    output.ResourcePolicies ||= {};
    output.ResourcePolicies.ApiEngines ||= {};
    output.ResourcePolicies.ApiEngines[spec.key] = { Ownership: 'Platform', UpgradePolicy: 'Managed' };
  }
  const info = output.PackageInfo;
  info.Version = release.version;
  const current = String(info.ServerMinVersion || '0').replace(/^v/, '').split('.').map(Number);
  if (current[0] < 8 || (current[0] === 8 && (current[1] < 7 || (current[1] === 7 && (current[2] || 0) < 5)))) info.ServerMinVersion = '8.7.5';
  info.ApiEngineCount = output.SysApiEngines.length;
  info.RequiredPlatformCapabilities = [...new Set([...(info.RequiredPlatformCapabilities || []), ...release.capabilities])];
  info.ChangeHistory = prepend(info.ChangeHistory, `2026-10-26 ${release.version} ${release.content}`);
  info.ChangeLog = { Version: release.version, Title: '官网密码重置与登录修复', ChangeType: 'Fix', Content: release.content, ReleaseTime: releaseTime };
  return output;
}

export function configurePasswordAuthResources(root = directory) {
  const sources = {
    official_sms_login: readOfficialApiSource('official_sms_login'),
    platform_auth_sms_login: readOfficialApiSource('platform_auth_sms_login'),
    official_password_reset: readOfficialApiSource('official_password_reset'),
    'platform-sys-user-admin': fs.readFileSync(path.join(root, 'platform-sys-user-admin.js'), 'utf8').replace(/\r\n?/g, '\n')
  };
  // 先验证两包均无发行版本冲突，再执行有限写入。
  const candidates = passwordAuthReleases.map(release => {
    const file = path.join(root, release.file);
    return { file, value: configurePasswordAuthPackage(JSON.parse(fs.readFileSync(file, 'utf8')), release, sources) };
  });
  for (const candidate of candidates) fs.writeFileSync(candidate.file, `${JSON.stringify(candidate.value, null, 2)}\n`, 'utf8');
  return candidates.map(candidate => ({ file: path.basename(candidate.file), version: candidate.value.PackageInfo.Version, serverMinVersion: candidate.value.PackageInfo.ServerMinVersion }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(configurePasswordAuthResources()));
