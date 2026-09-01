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
    version: 'v7.6.2',
    title: '菜单隐藏字段损坏配置自愈',
    changeType: 'Fix',
    content: '声明 NotShowFields 前后端规范化能力：新版平台会在菜单通用读写、缓存与 SysMenuLogic 边界过滤 null、空字符串和非法对象，客户端同时保留空值防护，避免列表或子表因单条损坏配置停止渲染。',
    releaseTime: '2026-09-01 20:05:00',
  }),
  'app.microi.store.json': Object.freeze({
    version: 'v7.7.29',
    title: '界面引擎跨租户表引用修复',
    changeType: 'Fix',
    content: '应用商城导入器升级至 v2.5.2；安装包含 mic_page 的应用时，对嵌套 diytable 组件先执行资源 Id 映射，再以目标 sys_menu 的实际 DiyTableId 纠正 widgetParams[0]，覆盖普通容器与 Tab 容器；目标菜单或表缺失时失败回滚，避免首页运行时访问发布端旧 diy_table Id。',
    releaseTime: '2026-09-01 15:55:00',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.7.18',
    title: '权限快照自愈与离线运行时同步',
    changeType: 'Fix',
    content: '在 v7.7.16 已发布基线之上，合并 microi-platform-service v1.9.3 / CurrentVersion 46 的 DatabaseOnly 商城运行时；声明 ClientFeature:AuthorizationSnapshotBootstrapRepairV1，需配合 Microi v7.8.1 将登录/续签的角色与权限投影改为主库权威读取、失败不覆盖缓存，并在路由生成前自动修复异常快照，管理员无需重新登录即可恢复“新增/编辑”等按钮；菜单底部默认模板支持 {{ OsVersion }} 和 {{ YYYY }}，且不携带 Sys_Config 租户数据。',
    releaseTime: '2026-09-01 09:10:00',
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
    version: 'v6.3.11',
    title: '菜单底部动态年份安装包修订',
    changeType: 'Feature',
    content: '在 v6.3.10 基础上补齐官方升级资源的结构化历史、客户端能力标记和日志类型；模块底部信息继续交付支持 {{ OsVersion }} 和 {{ YYYY }} 的默认模板，不携带 Sys_Config 租户数据。',
    releaseTime: '2026-09-01 08:30:15',
  }),
  'app.microi.message-notification.json': Object.freeze({
    version: 'v1.0.14',
    title: '聊天运行时时间能力自包含',
    changeType: 'Fix',
    content: '修复历史租户未定义 DateNow 时 SignalR 聊天发送失败；官方 Managed 运行时使用本地时间回退且不覆盖租户全局 V8。',
    releaseTime: '2026-09-01 14:30:00',
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
