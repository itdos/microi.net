import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));

export const officialPackageChangeLogDefinitions = Object.freeze({
  'app.microi.form-engine.json': Object.freeze({
    version: 'v7.6.7',
    title: '历史长表名升级兼容',
    changeType: 'Fix',
    content: '将 diy_field.TableName 的新装结构、物理字段元数据和表单字段元数据统一扩容为 varchar(255)，兼容历史长表名并避免升级复制 diy_table.Name 时中断。',
    releaseTime: '2026-08-26 14:30:00',
  }),
  'app.microi.module-engine.json': Object.freeze({
    version: 'v7.6.1',
    title: '模块引擎资源所有权与 V8 优先契约闭合',
    changeType: 'Feature',
    content: '补齐模块引擎官方包的 ResourcePolicies 结构并与 V8 优先应用所有权契约对齐；菜单、展示和子租户维护继续由低代码资源交付，同时增加结构化更新日志与发布硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
  }),
  'app.microi.store.json': Object.freeze({
    version: 'v7.6.16',
    title: 'WebOS 菜单统一迁入官方接口闭包',
    changeType: 'Fix',
    content: 'WebOS 菜单统一调用 platform-sys-menu，接口在执行权威菜单原子前调用应用商城 CreateIfMissing 个性化 Hook；旧商城列表地址与九包可信重放兼容继续保留。',
    releaseTime: '2026-08-26 18:30:00',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.6.21',
    title: '官方运行时接口闭包补全',
    changeType: 'Fix',
    content: '补齐在线终端、缓存管理与系统观测三个官方 Managed 接口；后端启动仍从九个官方应用包计算并强回读完整接口引擎闭包，同时保护租户 CreateIfMissing 个性化源码。',
    releaseTime: '2026-08-26 18:30:00',
  }),
  'app.microi.sso.json': Object.freeze({
    version: 'v7.5.8',
    title: 'SSO 官方资源归属重放修复',
    changeType: 'Fix',
    content: '将全部官方 Managed SSO 接口固化为 Platform 所有权，CreateIfMissing 个性化 Hook 继续归租户且永不覆盖，避免 Upgrade13 重放内置包时被误判为资源降级。',
    releaseTime: '2026-08-26 14:30:00',
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

export function configureOfficialPackageChangeLogs(root = resourceRoot) {
  const summaries = [];
  for (const [fileName, definition] of Object.entries(officialPackageChangeLogDefinitions)) {
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
  process.stdout.write(`${JSON.stringify(configureOfficialPackageChangeLogs(), null, 2)}\n`);
}
