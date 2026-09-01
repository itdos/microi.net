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
    version: 'v7.7.28',
    title: '应用商城路由兼容与紧凑交互',
    changeType: 'Fix',
    content: '内嵌 microi-platform-service v1.9.3 / CurrentVersion 46；正式列表地址仅在 404 或 NoExistData 时有界回退旧地址，错误统一通过平台 Tips 显示友好中文；首屏升级为紧凑 Banner 与语义 Tab，商城来源使用单选，应用分类、应用类型和可见范围使用常显复选，并修复筛选请求竞态。',
    releaseTime: '2026-09-01 08:53:30',
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
