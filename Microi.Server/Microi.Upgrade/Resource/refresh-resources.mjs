#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceNames = [
  'import-package.js',
  'ai-app-publish-store.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.store.json',
];
const endpoint = process.env.MICROI_UPGRADE_RESOURCE_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos';
const outputDirectory = dirname(fileURLToPath(import.meta.url));

function validate(name, content) {
  if (!content.trim()) throw new Error(`${name} 内容为空`);
  if (name === 'import-package.js') {
    if (!content.includes('import-microi-store-package')) {
      throw new Error(`${name} 缺少 import-microi-store-package`);
    }
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (versionNumber < 1_006_003
      || !content.includes('preserve_interface_engine_pagetabs_')
      || !content.includes('System.DateTime.Now.ToString')
      || !content.includes('OwnerUserId')
      || !content.includes('MicroServiceMenusPreserved')
      || !content.includes('sourceExpected')
      || !content.includes('validationSourceExpected')
      || !content.includes('stableMenuUrl')
      || !content.includes('normalizeRouteMeta')
      || !content.includes('recoverBoundMicroserviceMenus')
      || !content.includes('preservedLegacyUrl')
      || !content.includes("upsertApplicationRow('sys_microistore'")
      || !content.includes('official_marketplace_install_stat')
      || !content.includes('SKIP_MOVE_FOR_REUSED_BUILD_V1')
      || !content.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')) {
      throw new Error(`${name} 低于 v1.6.3 或缺少断点复用、Jint安全清理及统一应用商城能力，拒绝降级本地基线`);
    }
  }
  if (name === 'ai-app-publish-store.js') {
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (!content.includes('ai_app_publish_store')
      || versionNumber < 1_004_004
      || !content.includes('selectionValues(existingStore.SelectTable')
      || !content.includes('selectionValues(existingStore.SelectApiEngine')
      || !content.includes('IncludeSource: includeSource')
      || !content.includes("action === 'PackageOnly'")
      || !content.includes('ReturnPackageModel')
      || !content.includes("GetFormData('sys_microistore'")
      || !content.includes('ApplicationType || app.AppType')
      || !content.includes('PublishHdfsPath')
      || !content.includes("Source: 'CompiledAssets'")
      || !content.includes('SOURCE_BUILD_ARCHIVE_ROOTS_V1')) {
    throw new Error(`${name} 缺少 v1.4.4 统一应用商城、历史 BuildLog 兼容入口、严格源码/编译分根目录及自包含 PackageOnly 能力`);
    }
  }
  if (name.endsWith('.json')) {
    const packageModel = JSON.parse(content);
    const expectedNames = {
      'app.microi.form-engine.json': '表单引擎',
      'app.microi.module-engine.json': '模块引擎',
      'app.microi.store.json': '应用商城',
    };
    if (packageModel?.PackageInfo?.Name !== expectedNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
    }
    if (name === 'app.microi.store.json') {
      const version = String(packageModel?.PackageInfo?.Version || '').replace(/^v/i, '');
      const versionParts = version.split('.').map(item => Number(item) || 0);
      const versionNumber = (versionParts[0] || 0) * 1_000_000
        + (versionParts[1] || 0) * 1_000
        + (versionParts[2] || 0);
      const expectedTabs = ['平台应用', '我安装的应用', '我发布的应用', 'UniApp', 'Web', '微服务'];
      const menus = Array.isArray(packageModel?.SysMenus) ? packageModel.SysMenus : [];
      const menuTabsValid = menus.length === 3 && menus.every(menu => {
        try {
          const tabs = typeof menu.PageTabs === 'string' ? JSON.parse(menu.PageTabs) : menu.PageTabs;
          return Array.isArray(tabs)
            && tabs.map(tab => tab.Name).join('|') === expectedTabs.join('|');
        } catch {
          return false;
        }
      });
      const fields = Array.isArray(packageModel?.DiyFields) ? packageModel.DiyFields : [];
      const applicationType = fields.find(field => field.Name === 'ApplicationType');
      const applicationTypeOptions = String(applicationType?.Data || '');
      const engines = Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : [];
      const buildZipEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_download_build_zip');
      const sourceZipEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_download_source_zip');
      const importerEngine = engines.find(engine => engine.ApiEngineKey === 'import-microi-store-package');
      const importerVersion = String(importerEngine?.Version || '').replace(/^v/i, '');
      const importerVersionParts = importerVersion.split('.').map(item => Number(item) || 0);
      const importerVersionNumber = (importerVersionParts[0] || 0) * 1_000_000
        + (importerVersionParts[1] || 0) * 1_000
        + (importerVersionParts[2] || 0);
      const importerCode = String(importerEngine?.ApiV8Code || '');
      if (versionNumber < 6_005_008
        || !content.includes('TargetSysMenuId')
        || !content.includes('01KXFSG7MZ40CY8KCWCZZZJH2M')
        || !content.includes('01KXFSG8153B3VZPZ45WNCCFHR')
        || !content.includes('PublisherTypes')
        || !content.includes('StoreInstallStatus')
        || !menuTabsValid
        || applicationType?.Component !== 'Radio'
        || !applicationTypeOptions.includes('"Key":"Platform"')
        || !applicationTypeOptions.includes('"Key":"UniApp"')
        || !applicationTypeOptions.includes('"Key":"Web"')
        || !applicationTypeOptions.includes('"Key":"MicroService"')
        || buildZipEngine?.Version !== 'v1.2.0'
        || !String(buildZipEngine?.ApiV8Code || '').includes('REAL_BUILD_ZIP_ASSETS_V1')
        || sourceZipEngine?.Version !== 'v1.2.0'
        || !String(sourceZipEngine?.ApiV8Code || '').includes('SOURCE_ONLY_ZIP_ROOT_V1')
        || importerVersionNumber < 1_006_003
        || !importerCode.includes('SKIP_MOVE_FOR_REUSED_BUILD_V1')
        || !importerCode.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')) {
        throw new Error(`${name} 版本过旧，或缺少统一商城及严格 SourceZip/BuildZip 资产边界能力`);
      }
    }
  }
}

async function download(name) {
  const response = await fetch(`${endpoint}&Name=${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.Code !== 1 || payload?.Data?.ResourceName !== name || payload?.Data?.Content == null) {
    throw new Error(`${name} 官方响应格式或资源名不正确：${payload?.Msg || ''}`);
  }
  const content = typeof payload.Data.Content === 'string'
    ? payload.Data.Content
    : `${JSON.stringify(payload.Data.Content, null, 2)}\n`;
  validate(name, content);
  return content;
}

await mkdir(outputDirectory, { recursive: true });
const downloaded = await Promise.all(resourceNames.map(async name => [name, await download(name)]));
for (const [name, content] of downloaded) {
  await writeFile(resolve(outputDirectory, name), content, 'utf8');
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  process.stdout.write(`${name}\t${Buffer.byteLength(content, 'utf8')} bytes\tsha256=${sha256}\n`);
}
