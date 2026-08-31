import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));

export const officialPackageChangeLogDefinitions = Object.freeze({
  'app.microi.form-engine.json': Object.freeze({
    version: 'v7.6.8',
    title: '接口引擎多路由字段与缓存契约',
    changeType: 'Feature',
    content: '新增 sys_apiengine.ApiRoutes“多路由”物理列与字段元数据；英文分号分隔的旧地址与主路由共同参与精确匹配、冲突检查和缓存。',
    releaseTime: '2026-08-30 12:00:00',
  }),
  'app.microi.module-engine.json': Object.freeze({
    version: 'v7.6.1',
    title: '模块引擎资源所有权与 V8 优先契约闭合',
    changeType: 'Feature',
    content: '补齐模块引擎官方包的 ResourcePolicies 结构并与 V8 优先应用所有权契约对齐；菜单、展示和子租户维护继续由低代码资源交付，同时增加结构化更新日志与发布硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
  }),
  'app.microi.store.json': Object.freeze({
    version: 'v7.7.27',
    title: '旧租户安装自愈与平台应用默认筛选',
    changeType: 'Fix',
    content: '应用商城导入器升级至 v2.5.1，在任何字段查询前幂等补齐旧库 diy_field.OsClient，恢复旧 sys_menu 记录时不再错误写入非契约 OsClient 物理列，FormEngine 回读为空时按参数化物理事实重建接口缓存，并在失败结果中返回当前导入阶段；同时内嵌 microi-platform-service v1.9.2 / CurrentVersion 45，首次进入商城默认只展示平台应用，仍可主动切换全部或其它类型。',
    releaseTime: '2026-09-01 00:54:53',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.7.13',
    title: '应用商城默认平台应用筛选',
    changeType: 'Fix',
    content: '内嵌 microi-platform-service v1.9.2 / CurrentVersion 45；应用市场首次进入默认只查询并展示平台应用，保留“全部类型”及其它类型的手动筛选入口，SaaS 离线运行时与官网正式版本、源码和构建哈希一致。',
    releaseTime: '2026-08-31 22:00:21',
  }),
  'app.microi.sso.json': Object.freeze({
    version: 'v7.5.9',
    title: 'SSO 公开协议路由全面接口引擎化',
    changeType: 'Optimize',
    content: '将原 SsoProtocolGatewayController 的 24 个 OIDC、SAML2、CAS 与登录编排路由全部迁入官方 Managed 接口引擎；新增受控 HTTP 响应与 {OsClient} 路径模板能力，C# 仅保留不可由租户覆盖的协议、安全和票据原子，CreateIfMissing 个性化 Hook 继续归租户维护。',
    releaseTime: '2026-08-30 12:00:00',
  }),
  'app.microi.sys_user.json': Object.freeze({
    version: 'v7.6.3',
    title: '系统账号多路由与访问密钥闭包',
    changeType: 'Optimize',
    content: '将用户访问密钥四个旧控制器入口迁入 platform-user-access-key Managed 接口引擎，并与系统账号旧路由统一纳入多路由闭包。',
    releaseTime: '2026-08-30 12:00:00',
  }),
  'app.microi.sys-config.json': Object.freeze({
    version: 'v6.3.9',
    title: '租户系统设置接口引擎化',
    changeType: 'Optimize',
    content: '将 TenantSystemSettingsController 迁入 platform-tenant-system-settings；多路由统一普通 CRUD、地图运行时、Secret 保存与二次认证揭示。',
    releaseTime: '2026-08-30 12:00:00',
  }),
  'app.microi.message-notification.json': Object.freeze({
    version: 'v1.0.13',
    title: '系统消息多路由与发布历史闭包',
    changeType: 'Optimize',
    content: '完成 /api/DiyChat/SendSystemMessage 多路由、事务提交后实时投递与官方包追加式发布历史闭包。',
    releaseTime: '2026-08-30 12:00:00',
  }),
  'app.microi.ai-engine.json': Object.freeze({
    version: 'v7.6.1',
    title: 'AI 历史非流式路由接口引擎化',
    changeType: 'Optimize',
    content: '将旧 /api/Ai 非流式地址全部收入 platform-ai-runtime 与 platform-ai-account 多路由，动作映射和管理员复核保持不变。',
    releaseTime: '2026-08-30 12:00:00',
  }),
});

function historyLine(definition) {
  return `${definition.releaseTime.substring(0, 10)} ${definition.version} ${definition.content}`;
}

function compareSemver(left, right) {
  const parse = value => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(String(value || '').trim());
    return match ? match.slice(1).map(Number) : [0, 0, 0];
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function ensureCurrentHistory(packageInfo, definition) {
  const existing = packageInfo.ChangeHistory;
  if (Array.isArray(existing)) {
    const first = existing[0];
    if (String(first?.Version || '') === definition.version
      && String(first?.Date || '') === definition.releaseTime.substring(0, 10)
      && String(first?.Description || '') === definition.content) {
      return;
    }
    const withoutCurrent = existing.filter(item => String(item?.Version || '') !== definition.version);
    packageInfo.ChangeHistory = [{
      Version: definition.version,
      Date: definition.releaseTime.substring(0, 10),
      Description: definition.content,
    }, ...withoutCurrent];
    return;
  }

  const line = historyLine(definition);
  const lines = String(existing || '').split(/\r?\n/).filter(Boolean);
  if (lines[0] === line) return;
  const withoutCurrent = lines.filter(item => !item.includes(` ${definition.version} `));
  packageInfo.ChangeHistory = [line, ...withoutCurrent].join('\n') + '\n';
}

export function configureOfficialPackageChangeLogs(root = resourceRoot, { fileNames = null } = {}) {
  const summaries = [];
  const requested = Array.isArray(fileNames) && fileNames.length ? new Set(fileNames) : null;
  for (const [fileName, definition] of Object.entries(officialPackageChangeLogDefinitions)) {
    if (requested && !requested.has(fileName)) continue;
    const filePath = path.join(root, fileName);
    const packageModel = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const packageInfo = packageModel.PackageInfo ||= {};
    if (compareSemver(packageInfo.Version, definition.version) > 0) {
      throw new Error(
        `${fileName} 当前版本 ${packageInfo.Version} 高于日志生成器定义 ${definition.version}，` +
        '请先维护 configure-official-package-changelogs.mjs 后再发布。',
      );
    }

    packageInfo.Version = definition.version;

    packageInfo.ChangeLog = {
      Version: definition.version,
      Title: definition.title,
      ChangeType: definition.changeType,
      Content: definition.content,
      ReleaseTime: definition.releaseTime,
    };
    ensureCurrentHistory(packageInfo, definition);
    fs.writeFileSync(filePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
    summaries.push({ fileName, version: definition.version });
  }
  return summaries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageIndex = process.argv.indexOf('--package');
  const requestedPackage = packageIndex >= 0 ? String(process.argv[packageIndex + 1] || '').trim() : '';
  if (packageIndex >= 0 && !requestedPackage) throw new Error('--package 必须提供官方包文件名');
  process.stdout.write(`${JSON.stringify(configureOfficialPackageChangeLogs(resourceRoot, {
    fileNames: requestedPackage ? [requestedPackage] : null,
  }), null, 2)}\n`);
}
