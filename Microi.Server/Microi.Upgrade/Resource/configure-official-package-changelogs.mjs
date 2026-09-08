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
  "version": "v7.7.2",
  "title": "旧客户端接口引擎保存兼容",
  "changeType": "Fix",
  "content": "接口引擎修改历史子表的空字符串占位在前后端保存事件中规范为0，避免旧版客户端将空串写入 ChangeHistoryRows 整数列；保留现有路由校验、历史明细及业务代码。",
  "releaseTime": "2026-09-06 12:30:00"
}),
  "app.microi.module-engine.json": Object.freeze({
  "version": "v7.6.4",
  "title": "基础应用可选工作流依赖修复",
  "changeType": "Fix",
  "content": "修复导出器无条件混入未使用的工作流物理字段，基础应用在未安装工作流的旧租户也能独立安装；导入器兼容旧包，实际工作流资源和显式表依赖继续严格校验。发布前自动阻止同类未使用插件依赖。",
  "releaseTime": "2026-09-05 19:16:00"
}),
  "app.microi.store.json": Object.freeze({
  "version": "v8.2.5",
  "title": "批量租户字段映射规划查询优化",
  "changeType": "Fix",
  "content": "导入器 v2.8.4 将当前字段映射分片的自然键和主键读取合并为两次有界参数化查询；重复自然键与超限结果回退原有单条校验，保留软删除、主键冲突、检查点复用和租户隔离，减少所有子租户安装平台应用时的重复查询。",
  "releaseTime": "2026-09-07 03:00:00"
}),
  "app.microi.saas-engine.json": Object.freeze({
  "version": "v8.2.3",
  "title": "空数据库邮件与运行历史脱敏",
  "changeType": "Fix",
  "content": "主库空数据库保留邮件与视觉能力的表结构，但清空邮件账户、邮件内容、同步日志、接口代码历史及视觉请求、主体、样本等运行数据；补齐导出前零残留门禁，避免将持续新增的业务与历史数据交付到新租户。官方可在同一发布租约下撤回固定的七种空库文件。",
  "releaseTime": "2026-09-07 04:10:00"
}),
  "app.microi.sso.json": Object.freeze({
  "version": "v7.6.0",
  "title": "恢复 SSO 完整历史更新说明",
  "changeType": "Fix",
  "content": "从已提交的 v7.5.10 官方源码恢复八条被错误字符串化的历史更新记录，保留 v7.5.11 的可选工作流依赖修复；本次只修复发行元数据，不改变 SSO 引擎、表、字段、菜单、权限、协议或租户配置。",
  "releaseTime": "2026-09-06 19:50:00"
}),
  "app.microi.sys_user.json": Object.freeze({
  "version": "v7.6.6",
  "title": "基础应用可选工作流依赖修复",
  "changeType": "Fix",
  "content": "修复导出器无条件混入未使用的工作流物理字段，基础应用在未安装工作流的旧租户也能独立安装；导入器兼容旧包，实际工作流资源和显式表依赖继续严格校验。发布前自动阻止同类未使用插件依赖。",
  "releaseTime": "2026-09-05 19:16:00"
}),
  "app.microi.sys-config.json": Object.freeze({
  "version": "v6.4.0",
  "title": "全局函数库与日期基础能力",
  "changeType": "Fix",
  "content": "新增系统设置全局函数子表及前后端 DateNow/DateFormat/DateAdd 六条幂等种子；按目标启用配置绑定外键，不覆盖已有全局代码或函数源码；运行时按租户缓存，真实提交后跨节点失效。需配套更新后端。",
  "releaseTime": "2026-09-06 12:30:00"
}),
  "app.microi.message-notification.json": Object.freeze({
  "version": "v1.0.16",
  "title": "基础应用可选工作流依赖修复",
  "changeType": "Fix",
  "content": "修复导出器无条件混入未使用的工作流物理字段，基础应用在未安装工作流的旧租户也能独立安装；导入器兼容旧包，实际工作流资源和显式表依赖继续严格校验。发布前自动阻止同类未使用插件依赖。",
  "releaseTime": "2026-09-05 19:16:00"
}),
  "app.microi.ai-engine.json": Object.freeze({
  "version": "v7.7.3",
  "title": "音乐持久任务与原结果恢复",
  "changeType": "Fix",
  "content": "音乐生成改用持久后台任务和原任务轮询，浏览器停止等待或刷新不会取消后台生成；保存官方 Music3 事件编号与完成文件地址，断流或下载失败可恢复原结果且不重新作曲。失败与不确定状态保留诊断，图片和音乐中转等待任务合并限流并预留供应商执行槽。需同步更新平台 Core、AI、API、前端及使用的吾码中转节点；应用包不会替换二进制，未保存回执的历史请求不自动重发。保留租户模型、密钥、策略与会话数据。",
  "releaseTime": "2026-09-08 15:30:00"
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
