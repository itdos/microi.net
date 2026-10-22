import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const webosIconReleaseTime = '2026-09-02 12:05:00';
const webosIconTitle = 'WebOS iOS 拟物透明图标升级';
const webosIconContent = '将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。';
const webosIconDataSetContent = `${webosIconContent} SaaS 基础包新增 99 条 microi_icon Upsert 数据，使其他吾码用户安装或更新平台后获得同一图标目录。`;

export const officialPackageChangeLogDefinitions = Object.freeze({
  "app.microi.form-engine.json": Object.freeze({
  "version": "v7.7.7",
  "title": "关联记录历史与模块标题物理兼容",
  "changeType": "Fix",
  "content": "补齐三个模块标题共享列。配套平台前后端支持当前管理员按需读取安全字段历史、日志展开及跨记录清理；普通用户、访问密钥、掩码与敏感字段权限保持。应用包本身不替换平台二进制。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.module-engine.json": Object.freeze({
  "version": "v8.4.6",
  "title": "评论日志版本 Tab 自定义文字",
  "changeType": "Feature",
  "content": "新增 DataCommentTitle、DataLogTitle、DataVersionTitle 三个模块字段及可空 varchar(100) 物理列；留空使用原标签，自定义文字同步作用于页签和工具栏。保留现有模块和租户值，需配套新版平台前端与 MCP。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.store.json": Object.freeze({
  "version": "v8.6.4",
  "title": "SQL Server 可空唯一索引安装修复",
  "changeType": "Fix",
  "content": "安装器升级至 v3.0.14：先同步声明列，再按 SQL Server 实际可空键生成过滤唯一索引，修复 SaaS 等应用多条 NULL 被误判重复的问题。复合键保留非空唯一约束，历史同名同列索引缺失过滤时原子修复并回读；同版本重装复用正确索引，真实重复键和未知定义继续报错，保留业务数据与租户配置。",
  "releaseTime": "2026-10-22 17:58:37"
}),
  "app.microi.saas-engine.json": Object.freeze({
  "version": "v8.4.25",
  "title": "布局偏好及模块标题新租户快照",
  "changeType": "Fix",
  "content": "新租户账号快照补齐侧栏与角色树宽度、折叠四字段，并同步三个模块标题可空列；保留租户连接、密钥、现有偏好和业务数据。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.sso.json": Object.freeze({
  "version": "v8.3.6",
  "title": "共享模块标题物理快照",
  "changeType": "Fix",
  "content": "同步模块评论、日志和版本 Tab 自定义标题的三个可空物理列，保持共享表快照一致；不覆盖租户标题或其它业务配置。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.sys_user.json": Object.freeze({
  "version": "v8.4.12",
  "title": "个人侧栏与角色树布局偏好",
  "changeType": "Feature",
  "content": "新增个人侧栏及角色树宽度、折叠四字段；托管偏好接口 v1.1.7 仅保存当前可信用户且保留个性化 Hook，宽度限整数160至600、空值恢复默认。同步三个模块标题共享列；需配套新版平台前端。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.sys-config.json": Object.freeze({
  "version": "v8.4.11",
  "title": "共享模块标题物理快照",
  "changeType": "Fix",
  "content": "同步模块评论、日志和版本 Tab 自定义标题的三个可空物理列，保持共享表快照一致；不覆盖租户标题或其它业务配置。",
  "releaseTime": "2026-10-17 20:17:35"
}),
  "app.microi.message-notification.json": Object.freeze({
  "version": "v8.3.24",
  "title": "聊天跨月跨年游标分页",
  "changeType": "Fix",
  "content": "聊天消息按租户、年份数据库和月份集合保存；历史查询兼容旧年度集合，采用有界游标异步分页，跨月和跨年不中断。PC 与移动端滚动保留阅读位置，SignalR 仅向请求者回传历史。需配套 Core、MongoDB、API 与前端新版，应用包本身不替换二进制或清空历史数据。",
  "releaseTime": "2026-10-22 18:30:00"
}),
  "app.microi.ai-engine.json": Object.freeze({
  "version": "v7.7.7",
  "title": "Agent 官方媒体接口引擎统一接入",
  "changeType": "Optimize",
  "content": "Microi Agent 官方模型目录、媒体生成和原任务查询统一经受限 Managed 接口引擎调用，复用后端可信租户身份与持久任务。新增图片任务原子和媒体模型目录能力，保留音乐、视频、账户与租户扩展。需同步部署 Core、AI、API 与 Agent，应用包不修改用户模型密钥或历史。",
  "releaseTime": "2026-10-22 18:30:00"
}),
  "app.microi.sys-log.json": Object.freeze({
  "version": "v8.4.13",
  "title": "共享模块标题物理快照",
  "changeType": "Fix",
  "content": "同步模块评论、日志和版本 Tab 自定义标题的三个可空物理列，保持共享表快照一致；不覆盖租户标题或其它业务配置。",
  "releaseTime": "2026-10-17 20:17:35"
})
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
