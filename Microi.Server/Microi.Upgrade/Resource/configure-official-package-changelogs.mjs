import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));

export const officialPackageChangeLogDefinitions = Object.freeze({
  'app.microi.form-engine.json': Object.freeze({
    version: 'v7.6.6',
    title: '表单引擎接口优先交付与官方基线治理',
    changeType: 'Feature',
    content: '表单设计器搜索索引维护改由 Managed 接口引擎编排；copy_table 官方核心补齐醒目恢复提示和 Managed 所有权，并为当前应用版本补齐结构化更新日志与发布硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
  }),
  'app.microi.module-engine.json': Object.freeze({
    version: 'v7.6.1',
    title: '模块引擎资源所有权与 V8 优先契约闭合',
    changeType: 'Feature',
    content: '补齐模块引擎官方包的 ResourcePolicies 结构并与 V8 优先应用所有权契约对齐；菜单、展示和子租户维护继续由低代码资源交付，同时增加结构化更新日志与发布硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
  }),
  'app.microi.saas-engine.json': Object.freeze({
    version: 'v7.6.1',
    title: '平台高频接口全面迁移至 V8 接口引擎',
    changeType: 'Feature',
    content: '租户发现、公开系统设置、语言包、当前用户、私有文件授权、公共用户信息和登录壁纸迁入 Managed 接口引擎；创建租户、外部身份与微信绑定由可信原子配合 CreateIfMissing Hook 扩展，并补齐结构化更新日志硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
  }),
  'app.microi.sso.json': Object.freeze({
    version: 'v7.5.7',
    title: 'SSO Managed 编排与租户 Hook 收口',
    changeType: 'Feature',
    content: '统一官方 Managed 接口醒目恢复提示；SSO 安全事件只通过脱敏白名单调用 CreateIfMissing 租户 Hook，默认 Hook 直接返回成功且后续官方升级永不覆盖，并补齐结构化更新日志硬门禁。',
    releaseTime: '2026-08-25 16:00:00',
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
