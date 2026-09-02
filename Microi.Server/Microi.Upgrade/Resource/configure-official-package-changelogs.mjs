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
    version: 'v7.9.1',
    title: '应用新建安装目录长度兼容修复',
    changeType: 'Fix',
    content: '内嵌 microi-platform-service v1.9.7 / CurrentVersion 50，并保留 v7.9.0 的资源清单预检、菜单挂载选择、管理员权限与即时菜单刷新能力；导入器 v2.6.1 将新建安装目录的稳定 ModuleEngineKey 固定为46字符，兼容 sys_menu.ModuleEngineKey varchar(50) 的历史物理契约，修复目标租户创建父目录时 Data too long 导致事务回滚。',
    releaseTime: '2026-09-02 15:57:00',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.8.7',
    title: '平台内置应用商城安装体验升级',
    changeType: 'Fix',
    content: '内嵌 microi-platform-service v1.9.7 / CurrentVersion 50，与应用商城包保持同一运行产物：支持安装资源预检、菜单挂载位置选择、临时新建目录、超级管理员权限自动补齐及安装成功后左侧菜单即时刷新。',
    releaseTime: '2026-09-02 15:00:20',
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
