import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const webosIconReleaseTime = '2026-09-02 12:05:00';
const webosIconTitle = 'WebOS iOS 拟物透明图标升级';
const webosIconContent = '将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。';
const webosIconDataSetContent = `${webosIconContent} SaaS 基础包新增 99 条 microi_icon Upsert 数据，使其他吾码用户安装或更新平台后获得同一图标目录。`;

export const officialPackageChangeLogDefinitions = Object.freeze({
  'app.microi.form-engine.json': Object.freeze({
    version: 'v7.7.0',
    title: '表单设计器字段身份修复',
    changeType: 'Fix',
    content: '修复 diy_table.FormBannerEnabled 与 V8Limit 历史包内字段 Id 重复的问题，保留 FormBannerEnabled 稳定 Id，并将 V8Limit 恢复为其声明的唯一稳定 Id，避免安装器唯一性校验失败。',
    releaseTime: '2026-09-02 15:00:00',
  }),
  'app.microi.module-engine.json': Object.freeze({
    version: 'v7.6.3',
    title: webosIconTitle,
    changeType: 'Optimize',
    content: webosIconContent,
    releaseTime: webosIconReleaseTime,
  }),
  'app.microi.store.json': Object.freeze({
    version: 'v7.9.25',
    title: 'AI 应用业务失败保留登录态',
    changeType: 'Fix',
    content: '修复 AI 应用脚手架将 Code=-1 的普通业务失败误判为登录过期并清理 DiyToken；继续保留 401、1001、1002 的认证失效处理。保留主线导入器 v2.7.4 与 SQL Server 修复，角色权限仍由租户管理员配置。',
    releaseTime: '2026-09-05 15:50:00',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.8.16',
    title: '首页可选公告引用兼容',
    changeType: 'Fix',
    content: '首页公告 diytable 明确声明为可选引用；目标租户未安装公告表或菜单时，导入器只移除公告组件与空容器，其余智能首页继续完整安装，数据库读取异常仍严格失败。',
    releaseTime: '2026-09-03 22:00:00',
  }),
  'app.microi.sso.json': Object.freeze({
    version: 'v7.5.10',
    title: webosIconTitle,
    changeType: 'Optimize',
    content: webosIconContent,
    releaseTime: webosIconReleaseTime,
  }),
  'app.microi.sys_user.json': Object.freeze({
    version: 'v7.6.4',
    title: webosIconTitle,
    changeType: 'Optimize',
    content: webosIconContent,
    releaseTime: webosIconReleaseTime,
  }),
  'app.microi.sys-config.json': Object.freeze({
    version: 'v6.3.12',
    title: webosIconTitle,
    changeType: 'Optimize',
    content: webosIconContent,
    releaseTime: webosIconReleaseTime,
  }),
  'app.microi.message-notification.json': Object.freeze({
    version: 'v1.0.15',
    title: webosIconTitle,
    changeType: 'Optimize',
    content: webosIconContent,
    releaseTime: webosIconReleaseTime,
  }),
  'app.microi.ai-engine.json': Object.freeze({
    version: 'v7.6.4',
    title: 'AI 图像工作台与参考图编辑',
    changeType: 'Feature',
    content: '重构 AI助手能力导航，新增文生图、图生图、高清重绘、消除、扩图、去水印、证件照、多图融合、抠图、上色及精确图片处理；参考图私有存储，结果写入租户 HDFS。',
    releaseTime: '2026-09-03 12:00:00',
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
