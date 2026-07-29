import {
  canonicalizeResource,
  mergeJavascriptResource,
  mergeJsonResource,
  normalizeText,
} from './resource-sync-core.mjs';

export const applicationStorePackageName = 'app.microi.store.json';

export const applicationStoreReplicaMappings = Object.freeze([
  Object.freeze({
    resourceName: 'import-package.js',
    apiEngineKey: 'import-microi-store-package',
    publishedStandalone: true,
  }),
  Object.freeze({
    resourceName: 'ai-app-publish-store.js',
    apiEngineKey: 'ai_app_publish_store',
    publishedStandalone: true,
  }),
  Object.freeze({
    resourceName: 'ai-app-build.js',
    apiEngineKey: 'ai_app_build',
    publishedStandalone: false,
  }),
]);

export const publishedApplicationStoreReplicaMappings = Object.freeze(
  applicationStoreReplicaMappings.filter(item => item.publishedStandalone),
);

function parsePackage(content) {
  return JSON.parse(canonicalizeResource(applicationStorePackageName, content));
}

function getEmbeddedEngine(packageModel, apiEngineKey) {
  const engines = Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : [];
  const engine = engines.find(item => item.ApiEngineKey === apiEngineKey);
  if (!engine) throw new Error(`${applicationStorePackageName} 缺少接口引擎 ${apiEngineKey}`);
  return engine;
}

export function getEmbeddedEngineSource(packageContent, apiEngineKey) {
  return normalizeText(getEmbeddedEngine(parsePackage(packageContent), apiEngineKey).ApiV8Code || '');
}

function engineVersion(source) {
  const match = normalizeText(source).match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i);
  return match ? match[1] : '';
}

export function compareSemanticVersions(left, right) {
  const parts = value => String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map(item => Number(item) || 0);
  const leftParts = parts(left);
  const rightParts = parts(right);
  for (let index = 0; index < 3; index += 1) {
    if ((leftParts[index] || 0) !== (rightParts[index] || 0)) {
      return (leftParts[index] || 0) > (rightParts[index] || 0) ? 1 : -1;
    }
  }
  return 0;
}

export function choosePublishablePackageVersion(currentVersion, remoteVersion, releaseVersion) {
  if (!remoteVersion) {
    return currentVersion;
  }
  const remoteMatch = String(remoteVersion).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!remoteMatch) return null;
  if (compareSemanticVersions(currentVersion, remoteVersion) > 0) return currentVersion;
  if (releaseVersion && compareSemanticVersions(releaseVersion, remoteVersion) > 0) {
    const normalized = String(releaseVersion).replace(/^v/i, '');
    return `v${normalized}`;
  }
  // Application package versions are independent monotonic delivery versions.
  // A platform release can legitimately be lower than an application package
  // that has already advanced several times. In that case, bump the remote
  // package patch version instead of forcing a manual platform-version change.
  return `v${Number(remoteMatch[1])}.${Number(remoteMatch[2])}.${Number(remoteMatch[3]) + 1}`;
}

function executableBody(source) {
  const normalized = normalizeText(source);
  return normalizeText(normalized.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

async function mergeEngineSources(resourceName, baseSource, leftSource, rightSource, preferRight) {
  const base = normalizeText(baseSource);
  const left = normalizeText(leftSource);
  const right = normalizeText(rightSource);
  if (left === right) return left;
  if (left === base) return right;
  if (right === base) return left;

  // V8 文件头只保存接口说明与版本。若可执行正文完全一致，不把说明文字差异
  // 误判成业务代码冲突；优先更高版本，同版本按调用方指定的事实源取值。
  if (executableBody(left) === executableBody(right)) {
    const versionComparison = compareSemanticVersions(engineVersion(left), engineVersion(right));
    if (versionComparison > 0) return left;
    if (versionComparison < 0) return right;
    return preferRight ? right : left;
  }

  return mergeJavascriptResource(resourceName, base, left, right);
}

async function reconcileReplicaPair(resourceName, sideName, baseSource, standaloneSource, embeddedSource) {
  if (standaloneSource == null) {
    throw new Error(`${sideName}${resourceName} 独立源码不存在，不能与应用商城内嵌副本合并`);
  }
  try {
    // 同一侧以独立源码为首选事实源；只有代码正文不同才执行真正的 JS 三方合并。
    return await mergeEngineSources(resourceName, baseSource, standaloneSource, embeddedSource, false);
  } catch (error) {
    throw new Error(`${sideName}${resourceName} 与应用商城内嵌副本存在真实代码冲突：${error.message}`, {
      cause: error,
    });
  }
}

function maskReplicatedEngineFields(packageContent, basePackageContent) {
  const packageModel = parsePackage(packageContent);
  const basePackageModel = parsePackage(basePackageContent);
  for (const mapping of applicationStoreReplicaMappings) {
    const engine = getEmbeddedEngine(packageModel, mapping.apiEngineKey);
    const baseEngine = getEmbeddedEngine(basePackageModel, mapping.apiEngineKey);
    engine.ApiV8Code = normalizeText(baseEngine.ApiV8Code || '');
    engine.Version = baseEngine.Version;
  }
  return canonicalizeResource(applicationStorePackageName, JSON.stringify(packageModel));
}

export function synchronizeApplicationStoreEngines(packageContent, standaloneContents) {
  const packageModel = parsePackage(packageContent);
  for (const mapping of applicationStoreReplicaMappings) {
    const source = standaloneContents.get(mapping.resourceName);
    if (source == null) {
      throw new Error(`同步应用商城内嵌接口引擎时缺少 ${mapping.resourceName}`);
    }
    const engine = getEmbeddedEngine(packageModel, mapping.apiEngineKey);
    const normalizedSource = normalizeText(source);
    engine.ApiV8Code = normalizedSource;
    const versionMatch = normalizedSource.match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i);
    if (versionMatch) {
      engine.Version = versionMatch[1].startsWith('v') ? versionMatch[1] : `v${versionMatch[1]}`;
    }
  }
  return canonicalizeResource(applicationStorePackageName, JSON.stringify(packageModel));
}

export function assertApplicationStoreEnginesSynchronized(packageContent, standaloneContents) {
  for (const mapping of applicationStoreReplicaMappings) {
    const standalone = standaloneContents.get(mapping.resourceName);
    if (standalone == null) throw new Error(`缺少应用商城接口引擎事实源 ${mapping.resourceName}`);
    const embedded = getEmbeddedEngineSource(packageContent, mapping.apiEngineKey);
    if (normalizeText(standalone) !== embedded) {
      throw new Error(
        `${mapping.resourceName} 与应用商城内嵌 ${mapping.apiEngineKey} 不一致，不能建立或使用共同基线`,
      );
    }
  }
}

export async function mergeApplicationStoreReplicas({
  basePackageContent,
  localPackageContent,
  remotePackageContent,
  baseStandaloneContents,
  localStandaloneContents,
  remoteStandaloneContents,
}) {
  const resolvedStandaloneContents = new Map();

  for (const mapping of applicationStoreReplicaMappings) {
    const baseEmbedded = getEmbeddedEngineSource(basePackageContent, mapping.apiEngineKey);
    const baseStandalone = mapping.publishedStandalone
      ? baseStandaloneContents.get(mapping.resourceName)
      : baseEmbedded;
    if (baseStandalone == null) {
      throw new Error(`${mapping.resourceName} 尚未建立共同基线`);
    }
    if (mapping.publishedStandalone && normalizeText(baseStandalone) !== baseEmbedded) {
      throw new Error(
        `${mapping.resourceName} 的共同基线与应用商城内嵌 ${mapping.apiEngineKey} 不一致，请先修复基线`,
      );
    }

    const localEmbedded = getEmbeddedEngineSource(localPackageContent, mapping.apiEngineKey);
    const localResolved = await reconcileReplicaPair(
      mapping.resourceName,
      '本地 ',
      baseEmbedded,
      localStandaloneContents.get(mapping.resourceName),
      localEmbedded,
    );

    const remoteEmbedded = getEmbeddedEngineSource(remotePackageContent, mapping.apiEngineKey);
    const remoteResolved = mapping.publishedStandalone
      ? await reconcileReplicaPair(
        mapping.resourceName,
        '官网 ',
        baseEmbedded,
        remoteStandaloneContents.get(mapping.resourceName),
        remoteEmbedded,
      )
      : remoteEmbedded;

    let resolved;
    try {
      // 跨本地/官网合并时，同版本同正文优先官网独立源码的文件头说明。
      resolved = await mergeEngineSources(
        mapping.resourceName,
        baseEmbedded,
        localResolved,
        remoteResolved,
        true,
      );
    } catch (error) {
      throw new Error(`${mapping.resourceName} 本地与官网存在真实代码冲突：${error.message}`, {
        cause: error,
      });
    }
    resolvedStandaloneContents.set(mapping.resourceName, canonicalizeResource(mapping.resourceName, resolved));
  }

  const maskedBasePackage = maskReplicatedEngineFields(basePackageContent, basePackageContent);
  const maskedLocalPackage = maskReplicatedEngineFields(localPackageContent, basePackageContent);
  const maskedRemotePackage = maskReplicatedEngineFields(remotePackageContent, basePackageContent);
  const mergedPackage = mergeJsonResource(
    applicationStorePackageName,
    maskedBasePackage,
    maskedLocalPackage,
    maskedRemotePackage,
  );
  const synchronizedPackage = synchronizeApplicationStoreEngines(
    mergedPackage,
    resolvedStandaloneContents,
  );

  return {
    packageContent: synchronizedPackage,
    standaloneContents: resolvedStandaloneContents,
  };
}
