#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeResource,
  isTemporaryOfficialResourceFailure,
  mergeResource,
  validateReadableOfficialResource,
  verifyOfflineReleaseSafety,
} from './resource-sync-core.mjs';
import {
  applicationStorePackageName,
  assertApplicationStoreEnginesSynchronized,
  choosePublishablePackageVersion,
  compareSemanticVersions,
  mergeApplicationStoreReplicas,
  publishedApplicationStoreReplicaMappings,
  synchronizeApplicationStoreEngines,
} from './application-store-replica-sync.mjs';
import { publishResourcesViaConfiguredMcp } from './mcp-resource-publisher.mjs';

const resourceNames = [
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.store.json',
];
const endpoint = process.env.MICROI_UPGRADE_RESOURCE_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos';
const publishEndpoint = process.env.MICROI_UPGRADE_RESOURCE_PUBLISH_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource--OsClient--iTdos--';
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const baseDirectory = resolve(outputDirectory, '.resource-sync-base');

function validateReleaseCandidate(name, content) {
  if (!content.trim()) throw new Error(`${name} 内容为空`);
  if (name === 'import-package.js') {
    if (!content.includes('import-microi-store-package')) {
      throw new Error(`${name} 缺少 import-microi-store-package`);
    }
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (versionNumber < 1_007_004
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
      || !content.includes('MICRO_APP_PUBLIC_HDFS_PATH_V1')
      || !content.includes('DB_RUNTIME_BUILD_ASSETS_V1')
      || !content.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')
      || !content.includes('BACKGROUND_TASK_BOOTSTRAP_READINESS_V1')) {
      throw new Error(`${name} 低于 v1.7.4 或缺少后台任务基础包完整回读、断点复用、微服务公有HDFS稳定路径、DB运行产物兜底、Jint安全清理及统一应用商城能力，拒绝降级本地基线`);
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
  if (name === 'official-resource-api.js') {
    if (!content.includes('ApiEngineKey: get-microi-upgrade-resource')
      || !content.includes('ExpectedRemoteSha256')
      || !content.includes('function lockPublishRows()')
      || (content.match(/FOR UPDATE/g) || []).length !== 2
      || !content.includes('发布升级资源[')
      || !content.includes('后回读内容哈希不一致')) {
      throw new Error(`${name} 缺少固定白名单、SHA 乐观锁、事务行锁或发布后回读保护`);
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
      const engineVersionNumber = engine => {
        const parts = String(engine?.Version || '')
          .replace(/^v/i, '')
          .split('.')
          .map(item => Number(item) || 0);
        return (parts[0] || 0) * 1_000_000
          + (parts[1] || 0) * 1_000
          + (parts[2] || 0);
      };
      const importerVersion = String(importerEngine?.Version || '').replace(/^v/i, '');
      const importerVersionParts = importerVersion.split('.').map(item => Number(item) || 0);
      const importerVersionNumber = (importerVersionParts[0] || 0) * 1_000_000
        + (importerVersionParts[1] || 0) * 1_000
        + (importerVersionParts[2] || 0);
      const importerCode = String(importerEngine?.ApiV8Code || '');
      if (versionNumber < 6_005_014
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
        || engineVersionNumber(buildZipEngine) < 1_002_000
        || !String(buildZipEngine?.ApiV8Code || '').includes('REAL_BUILD_ZIP_ASSETS_V1')
        || engineVersionNumber(sourceZipEngine) < 1_002_000
        || !String(sourceZipEngine?.ApiV8Code || '').includes('SOURCE_ONLY_ZIP_ROOT_V1')
        || importerVersionNumber < 1_007_004
        || !importerCode.includes('SKIP_MOVE_FOR_REUSED_BUILD_V1')
        || !importerCode.includes('MICRO_APP_PUBLIC_HDFS_PATH_V1')
        || !importerCode.includes('DB_RUNTIME_BUILD_ASSETS_V1')
        || !importerCode.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')
        || !importerCode.includes('BACKGROUND_TASK_BOOTSTRAP_READINESS_V1')) {
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
  validateReadableOfficialResource(name, content);
  const downloadedSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const reportedSha256 = String(payload.Data.Sha256 || '').toLowerCase();
  if (reportedSha256 && reportedSha256 !== downloadedSha256) {
    throw new Error(`${name} 官网返回内容与 Sha256 不一致`);
  }
  return {
    content: canonicalizeResource(name, content),
    sha256: reportedSha256 || downloadedSha256,
    appVersion: String(payload.Data.AppVersion || ''),
  };
}

const readAttempts = Math.max(
  1,
  Number.parseInt(process.env.MICROI_UPGRADE_RESOURCE_READ_ATTEMPTS || '3', 10) || 3,
);
const retryDelayMilliseconds = Math.max(
  0,
  Number.parseInt(process.env.MICROI_UPGRADE_RESOURCE_RETRY_DELAY_MS || '5000', 10) || 5000,
);

async function downloadAllWithRetry(stage) {
  let lastError;
  for (let attempt = 1; attempt <= readAttempts; attempt += 1) {
    try {
      return new Map(await Promise.all(resourceNames.map(async name => [name, await download(name)])));
    } catch (error) {
      lastError = error;
      if (!isTemporaryOfficialResourceFailure(error) || attempt >= readAttempts) throw error;
      process.stderr.write(
        `官网升级资源${stage}暂时失败（第 ${attempt}/${readAttempts} 次）：${error.message}\n`
        + `${retryDelayMilliseconds / 1000} 秒后重试...\n`,
      );
      await new Promise(resolvePromise => setTimeout(resolvePromise, retryDelayMilliseconds));
    }
  }
  throw lastError;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function publishResources(changes) {
  const token = String(process.env.MICROI_UPGRADE_RESOURCE_TOKEN || '').trim();
  if (!token) {
    process.stdout.write('未设置 MICROI_UPGRADE_RESOURCE_TOKEN，使用已配置并登录的 microi_itdos MCP 安全发布...\n');
    try {
      await publishResourcesViaConfiguredMcp(changes, { startDirectory: outputDirectory });
      return;
    } catch (error) {
      throw new Error(
        `本地合并结果需要写回官网，但 microi_itdos MCP 发布失败：${error.message}。`
        + '请登录并正确配置官方 iTdos MCP，或设置 MICROI_UPGRADE_RESOURCE_TOKEN 后重试',
        { cause: error },
      );
    }
  }
  const response = await fetch(publishEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Token: token,
      OsClient: 'iTdos',
      apiengine: '1',
    },
    body: JSON.stringify({
      Action: 'PublishBatch',
      Resources: changes.map(item => ({
        Name: item.name,
        Content: item.content,
        ExpectedRemoteSha256: item.expectedRemoteSha256,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`发布官网升级资源 HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.Code !== 1) {
    throw new Error(`发布官网升级资源失败：${payload?.Msg || '未知错误'}`);
  }
}

function printResource(name, content, direction) {
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  process.stdout.write(
    `${name}\t${Buffer.byteLength(content, 'utf8')} bytes\tsha256=${sha256}\t${direction}\n`,
  );
}

async function readCurrentReleaseVersion() {
  const configured = String(process.env.MICROI_RELEASE_VERSION || '').trim();
  if (configured) return configured;
  try {
    const clientPackage = JSON.parse(
      await readFile(resolve(outputDirectory, '../../../Microi.Client/package.json'), 'utf8'),
    );
    if (clientPackage?.version) return String(clientPackage.version);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    const upgradeProject = await readFile(resolve(outputDirectory, '../Microi.Upgrade.csproj'), 'utf8');
    const versionMatch = upgradeProject.match(/<Version>([^<]+)<\/Version>/i);
    if (versionMatch) return versionMatch[1].trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return '';
}

await mkdir(outputDirectory, { recursive: true });
if (process.argv.includes('--synchronize-local')) {
  const importerSource = await readFile(resolve(outputDirectory, 'import-package.js'), 'utf8');
  const publisherSource = await readFile(resolve(outputDirectory, 'ai-app-publish-store.js'), 'utf8');
  const builderSource = await readFile(resolve(outputDirectory, 'ai-app-build.js'), 'utf8');
  const packagePath = resolve(outputDirectory, 'app.microi.store.json');
  const packageContent = await readFile(packagePath, 'utf8');
  const standaloneContents = new Map([
    ['import-package.js', importerSource],
    ['ai-app-publish-store.js', publisherSource],
    ['ai-app-build.js', builderSource],
  ]);
  const synchronized = synchronizeApplicationStoreEngines(packageContent, standaloneContents);
  validateReleaseCandidate('app.microi.store.json', synchronized);
  await writeFile(packagePath, synchronized, 'utf8');
  printResource('app.microi.store.json', synchronized, '同步本地副本');
} else {
  const initializeBase = process.argv.includes('--initialize-base');
  const publish = process.argv.includes('--publish');
  const allowVerifiedOffline = process.argv.includes('--allow-verified-offline');
  const localResources = new Map();
  const rawLocalResources = new Map();
  const baseResources = new Map();
  for (const name of resourceNames) {
    const rawLocalContent = await readFile(resolve(outputDirectory, name), 'utf8');
    rawLocalResources.set(name, rawLocalContent);
    const localContent = canonicalizeResource(name, rawLocalContent);
    validateReleaseCandidate(name, localContent);
    localResources.set(name, localContent);
    const baseContent = await readOptional(resolve(baseDirectory, name));
    if (baseContent !== null) {
      baseResources.set(name, canonicalizeResource(name, baseContent));
    }
  }
  const builderPath = resolve(outputDirectory, 'ai-app-build.js');
  const rawBuilderSource = await readFile(builderPath, 'utf8');
  const localStandaloneContents = new Map([
    ...publishedApplicationStoreReplicaMappings.map(mapping => [
      mapping.resourceName,
      localResources.get(mapping.resourceName),
    ]),
    ['ai-app-build.js', canonicalizeResource('ai-app-build.js', rawBuilderSource)],
  ]);

  let remoteResources;
  try {
    remoteResources = await downloadAllWithRetry('读取');
  } catch (error) {
    if (!allowVerifiedOffline
      || initializeBase
      || !isTemporaryOfficialResourceFailure(error)) {
      throw error;
    }
    verifyOfflineReleaseSafety(resourceNames, localResources, baseResources);
    assertApplicationStoreEnginesSynchronized(
      localResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
    process.stderr.write(
      '\n⚠ 官网升级资源接口在重试后仍暂时不可用；6 项本地资源与上次官网成功回读的共同基线完全一致。\n'
      + '  本次仅允许继续后端编译发布：未写入官网、未修改本地资源、未推进共同基线。\n'
      + `  故障原因：${error.message}\n\n`,
    );
    for (const name of resourceNames) {
      printResource(name, localResources.get(name), '已验证离线基线（未实时同步官网）');
    }
    process.exit(0);
  }

  if (initializeBase) {
    for (const name of resourceNames) {
      if (localResources.get(name) !== remoteResources.get(name).content) {
        throw new Error(`${name} 本地与官网尚不一致，不能初始化共同基线`);
      }
    }
    assertApplicationStoreEnginesSynchronized(
      localResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
    await mkdir(baseDirectory, { recursive: true });
    for (const name of resourceNames) {
      await writeFile(resolve(baseDirectory, name), localResources.get(name), 'utf8');
      printResource(name, localResources.get(name), '建立共同基线');
    }
    process.exit(0);
  }

  const replicaBaseReady = baseResources.has(applicationStorePackageName)
    && publishedApplicationStoreReplicaMappings.every(mapping => baseResources.has(mapping.resourceName));
  let replicaMerge = null;
  if (replicaBaseReady) {
    replicaMerge = await mergeApplicationStoreReplicas({
      basePackageContent: baseResources.get(applicationStorePackageName),
      localPackageContent: localResources.get(applicationStorePackageName),
      remotePackageContent: remoteResources.get(applicationStorePackageName).content,
      baseStandaloneContents: baseResources,
      localStandaloneContents,
      remoteStandaloneContents: new Map(
        publishedApplicationStoreReplicaMappings.map(mapping => [
          mapping.resourceName,
          remoteResources.get(mapping.resourceName).content,
        ]),
      ),
    });
  }

  const mergedResources = new Map();
  for (const name of resourceNames) {
    if (replicaMerge && name === applicationStorePackageName) {
      mergedResources.set(name, replicaMerge.packageContent);
      continue;
    }
    const publishedReplica = publishedApplicationStoreReplicaMappings
      .find(mapping => mapping.resourceName === name);
    if (replicaMerge && publishedReplica) {
      mergedResources.set(name, replicaMerge.standaloneContents.get(name));
      continue;
    }

    const localContent = localResources.get(name);
    const remoteContent = remoteResources.get(name).content;
    const baseContent = baseResources.get(name);
    if (!baseContent) {
      if (localContent !== remoteContent) {
        throw new Error(`${name} 尚无共同基线且本地与官网不同；请先完成人工首次同步，再运行 --initialize-base`);
      }
      mergedResources.set(name, localContent);
      continue;
    }
    mergedResources.set(name, await mergeResource(name, baseContent, localContent, remoteContent));
  }
  if (!replicaMerge) {
    assertApplicationStoreEnginesSynchronized(
      mergedResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
  }
  const resolvedBuilderSource = replicaMerge
    ? replicaMerge.standaloneContents.get('ai-app-build.js')
    : localStandaloneContents.get('ai-app-build.js');
  if (process.env.MICROI_UPGRADE_RESOURCE_DEBUG === '1') {
    const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
    process.stderr.write(`${JSON.stringify({
      resource: 'app.microi.store.json',
      base: digest(baseResources.get('app.microi.store.json')),
      local: digest(localResources.get('app.microi.store.json')),
      remote: digest(remoteResources.get('app.microi.store.json').content),
      mergedAfterReplicaReconcile: digest(mergedResources.get(applicationStorePackageName)),
    })}\n`);
  }

  let currentReleaseVersion;
  for (const name of resourceNames) {
    let content = canonicalizeResource(name, mergedResources.get(name));
    if (name.endsWith('.json') && remoteResources.get(name).content !== content) {
      const packageModel = JSON.parse(content);
      const packageVersion = String(packageModel?.PackageInfo?.Version || '');
      const remoteVersion = remoteResources.get(name).appVersion;
      if (remoteVersion && compareSemanticVersions(packageVersion, remoteVersion) <= 0) {
        currentReleaseVersion ??= await readCurrentReleaseVersion();
        const selectedVersion = choosePublishablePackageVersion(
          packageVersion,
          remoteVersion,
          currentReleaseVersion,
        );
        if (!selectedVersion) {
          throw new Error(
            `${name} 内容需要写回官网，但无法根据包版本 ${packageVersion || '(空)'}、当前发布版本 ${currentReleaseVersion || '(未找到)'} 和官网版本 ${remoteVersion} 生成更高的语义版本`,
          );
        }
        packageModel.PackageInfo.Version = selectedVersion;
        content = canonicalizeResource(name, JSON.stringify(packageModel));
        process.stdout.write(`${name}\tPackageInfo.Version 自动提升为 ${selectedVersion}\n`);
      }
    }
    mergedResources.set(name, content);
  }

  const remoteChanges = [];
  for (const name of resourceNames) {
    const content = canonicalizeResource(name, mergedResources.get(name));
    validateReleaseCandidate(name, content);
    mergedResources.set(name, content);
    if (rawLocalResources.get(name) !== content) {
      await writeFile(resolve(outputDirectory, name), content, 'utf8');
    }
    if (remoteResources.get(name).content !== content) {
      remoteChanges.push({
        name,
        content,
        expectedRemoteSha256: remoteResources.get(name).sha256,
      });
    }
  }
  if (canonicalizeResource('ai-app-build.js', rawBuilderSource) !== resolvedBuilderSource) {
    await writeFile(builderPath, resolvedBuilderSource, 'utf8');
  }

  if (remoteChanges.length && !publish) {
    throw new Error(
      `已完成三方合并，但有 ${remoteChanges.length} 个资源需要写回官网（${remoteChanges.map(item => item.name).join('、')}）；请检查本地差异后使用 --publish`,
    );
  }
  if (remoteChanges.length) await publishResources(remoteChanges);

  const verifiedRemote = await downloadAllWithRetry('发布后回读');
  await mkdir(baseDirectory, { recursive: true });
  for (const name of resourceNames) {
    const content = mergedResources.get(name);
    if (verifiedRemote.get(name).content !== content) {
      throw new Error(`${name} 发布后回读与合并结果不一致，未推进共同基线`);
    }
    await writeFile(resolve(baseDirectory, name), content, 'utf8');
    const localChanged = localResources.get(name) !== content;
    const remoteChanged = remoteResources.get(name).content !== content;
    const direction = localChanged && remoteChanged
      ? '双向合并并已回读'
      : localChanged
        ? '官网→本地并已回读'
        : remoteChanged
          ? '本地→官网并已回读'
          : '两端一致';
    printResource(name, content, direction);
  }
  printResource(
    'ai-app-build.js',
    resolvedBuilderSource,
    '本地独立文件与官网商城包内嵌副本一致',
  );
}
