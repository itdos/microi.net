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
    limitMemory: 8192,
  }),
  Object.freeze({
    resourceName: 'bulk-import-packages.js',
    apiEngineKey: 'bulk-import-microi-store-packages',
    publishedStandalone: false,
  }),
  Object.freeze({
    resourceName: 'get-microi-store-list.js',
    apiEngineKey: 'get-microi-store',
    publishedStandalone: false,
  }),
  Object.freeze({
    resourceName: 'get-microi-store-model.js',
    apiEngineKey: 'get-microi-store-model',
    publishedStandalone: false,
  }),
  Object.freeze({
    resourceName: 'get-microi-store-versions.js',
    apiEngineKey: 'get-microi-store-versions',
    publishedStandalone: false,
  }),
  Object.freeze({
    resourceName: 'ai-app-publish-store.js',
    apiEngineKey: 'ai_app_publish_store',
    publishedStandalone: true,
  }),
  Object.freeze({
    resourceName: 'ai-app-prepare-store-assets.js',
    apiEngineKey: 'ai_app_prepare_store_assets',
    publishedStandalone: false,
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

function findEmbeddedEngine(packageModel, apiEngineKey) {
  const engines = Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : [];
  return engines.find(item => item.ApiEngineKey === apiEngineKey) || null;
}

function tryGetEmbeddedEngineSource(packageContent, apiEngineKey) {
  const engine = findEmbeddedEngine(parsePackage(packageContent), apiEngineKey);
  return engine ? normalizeText(engine.ApiV8Code || '') : null;
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

function splitEngineSource(source) {
  const normalized = normalizeText(source);
  const match = normalized.match(/^(\s*\/\*[\s\S]*?\*\/)(?:[ \t]*\n)+([\s\S]*)$/);
  if (!match) return { header: '', body: normalized };
  return {
    header: match[1].trimEnd(),
    body: normalizeText(match[2]),
  };
}

function normalizeEngineVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  return match ? `v${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : '';
}

function bumpEngineVersion(value) {
  const normalized = normalizeEngineVersion(value);
  if (!normalized) return '';
  let [major, minor, patch] = normalized.substring(1).split('.').map(Number);
  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }
  return `v${major}.${minor}.${patch}`;
}

function highestEngineVersion(...sources) {
  let selected = '';
  for (const source of sources) {
    const candidate = normalizeEngineVersion(engineVersion(source));
    if (candidate && (!selected || compareSemanticVersions(candidate, selected) > 0)) {
      selected = candidate;
    }
  }
  return selected;
}

function replaceHeaderVersion(header, version) {
  if (!header || !version) return header;
  return header.replace(
    /(Version\s*:\s*)v?\d+\.\d+\.\d+/i,
    (_match, prefix) => `${prefix}${version}`,
  );
}

function composeEngineSource(header, body, version) {
  if (!header) return normalizeText(body);
  return normalizeText(`${replaceHeaderVersion(header, version)}\n\n${normalizeText(body).trimEnd()}`);
}

function preferredEngineHeader(leftSource, rightSource, preferRight) {
  const leftVersion = engineVersion(leftSource);
  const rightVersion = engineVersion(rightSource);
  const comparison = compareSemanticVersions(leftVersion, rightVersion);
  if (comparison > 0) return splitEngineSource(leftSource).header;
  if (comparison < 0) return splitEngineSource(rightSource).header;
  return splitEngineSource(preferRight ? rightSource : leftSource).header;
}

async function mergeEngineSources(resourceName, baseSource, leftSource, rightSource, preferRight) {
  const base = normalizeText(baseSource);
  const left = normalizeText(leftSource);
  const right = normalizeText(rightSource);
  if (left === right) return left;
  if (left === base) return right;
  if (right === base) return left;

  const baseParts = splitEngineSource(base);
  const leftParts = splitEngineSource(left);
  const rightParts = splitEngineSource(right);
  const selectedVersion = highestEngineVersion(base, left, right);
  const selectedHeader = preferredEngineHeader(left, right, preferRight);

  // 接口说明和 Version 都属于发布元数据。真实开发中本地与官网每次保存都会
  // 独立递增 Version；若把文件头一起交给 git merge-file，即使正文修改完全
  // 不重叠，也会只因 Version 行不同而产生永久性的伪冲突。
  if (leftParts.body === rightParts.body) {
    return composeEngineSource(selectedHeader, leftParts.body, selectedVersion);
  }
  if (leftParts.body === baseParts.body) {
    return composeEngineSource(selectedHeader, rightParts.body, selectedVersion);
  }
  if (rightParts.body === baseParts.body) {
    return composeEngineSource(selectedHeader, leftParts.body, selectedVersion);
  }

  const mergedBody = await mergeJavascriptResource(
    `${resourceName} 可执行正文`,
    baseParts.body,
    leftParts.body,
    rightParts.body,
  );
  const synthesized = mergedBody !== leftParts.body && mergedBody !== rightParts.body;
  const mergedVersion = synthesized ? bumpEngineVersion(selectedVersion) : selectedVersion;
  return composeEngineSource(selectedHeader, mergedBody, mergedVersion);
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
    const engine = findEmbeddedEngine(packageModel, mapping.apiEngineKey);
    const baseEngine = findEmbeddedEngine(basePackageModel, mapping.apiEngineKey);
    // A newly introduced embedded engine legitimately does not exist in the
    // previous common baseline or on the remote package. Leave that local JSON
    // array element unmasked so the normal three-way merge can add it.
    if (!engine || !baseEngine) continue;
    engine.ApiV8Code = normalizeText(baseEngine.ApiV8Code || '');
    engine.Version = baseEngine.Version;
  }
  return canonicalizeResource(applicationStorePackageName, JSON.stringify(packageModel));
}

function restoreMissingReplicatedEngineSkeletons(
  packageContent,
  basePackageContent,
  missingMappings,
) {
  if (!missingMappings.length) {
    return canonicalizeResource(applicationStorePackageName, packageContent);
  }

  const packageModel = parsePackage(packageContent);
  const basePackageModel = parsePackage(basePackageContent);
  const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
  packageModel.SysApiEngines = engines;

  for (const mapping of missingMappings) {
    if (findEmbeddedEngine(packageModel, mapping.apiEngineKey)) continue;
    const baseEngine = findEmbeddedEngine(basePackageModel, mapping.apiEngineKey);
    if (!baseEngine) continue;

    const idCollision = baseEngine.Id
      ? engines.find(item => item.Id === baseEngine.Id && item.ApiEngineKey !== mapping.apiEngineKey)
      : null;
    if (idCollision) {
      throw new Error(
        `${applicationStorePackageName} 官网缺少接口引擎 ${mapping.apiEngineKey}，`
        + `且共同基线 Id ${baseEngine.Id} 已被 ${idCollision.ApiEngineKey || '(空 Key)'} 占用，不能自动恢复`,
      );
    }

    // The mapping is still part of the release contract, so a one-sided remote
    // deletion is an incomplete logical replica rather than an accepted removal.
    // Restore only the established structural skeleton; executable code is
    // reconciled independently below and written back after the JSON merge.
    engines.push(JSON.parse(JSON.stringify(baseEngine)));
  }

  return canonicalizeResource(applicationStorePackageName, JSON.stringify(packageModel));
}

function synchronizeBulkInstallButton(packageModel) {
  const menu = (packageModel.SysMenus || []).find(item => item.Url === '/microi-store');
  // 资源合并单元测试会使用只包含接口引擎的最小包；完整商城包仍由
  // refresh-resources.mjs 的发布门强制校验菜单和按钮。
  if (!menu) return;
  const buttons = typeof menu.PageBtns === 'string' ? JSON.parse(menu.PageBtns) : menu.PageBtns;
  const bulk = (buttons || []).find(item => item.Id === '01KMARKETPLACEBULKINSTALL1');
  if (!bulk) return;
  bulk.V8Code = `V8.ConfirmTips('将只安装未安装的官方平台应用，并更新存在新版本的官方平台应用；已是最新版的应用不会重新安装。任务进度可在右上角后台任务中心查看。', async function () {
  try {
    // BULK_QUEUE_PREFLIGHT_DIAGNOSTICS_V1：新后端可在排队前返回工作器与任务表
    // 就绪状态；旧后端没有此接口时保持兼容，仍允许提交后台任务。
    var workerStatus = null;
    try {
      if (V8.PostAsync) {
        workerStatus = await V8.PostAsync('/api/BackgroundTask/WorkerStatus', {}, null, null, 'json');
      }
    } catch (workerStatusError) {
      workerStatus = null;
    }
    var worker = workerStatus && workerStatus.Code == 1 ? workerStatus.Data : null;
    var readiness = worker && worker.Readiness ? worker.Readiness : null;
    if (worker && (worker.LoopHealthy !== true || (readiness && readiness.SchemaReady === false))) {
      var notReadyReason = (readiness && readiness.Reason) || worker.LastError || '后台任务工作器循环未运行';
      V8.Tips('后台任务工作器未就绪：' + notReadyReason + '。解决方案：确认 API 节点健康、mci_background_task 表已升级并等待工作器心跳恢复后重试。', false);
      return;
    }
    var selectApi = String((V8.SysMenuModel && V8.SysMenuModel.SelectApi) || 'https://api.itdos.com/apiengine/get-microi-store-list?OsClient=iTdos');
    var parsed = new URL(selectApi, window.location.origin);
    var sourceOsClient = parsed.searchParams.get('OsClient') || 'iTdos';
    var operationId = Date.now() + '-' + Math.random().toString(36).substring(2);
    var result = await V8.ApiEngine.RunBackground('bulk-import-microi-store-packages', {
      StoreApiBase: parsed.origin,
      StoreOsClient: sourceOsClient,
      ApplicationType: 'Platform'
    }, '应用商城全部安装/更新', {
      IdempotencyKey: 'microi-store-bulk:' + operationId,
      ConcurrencyKey: 'bulk-import-microi-store-packages',
      MaxAttempts: 3,
      RetryOnFailure: true
    });
    if (!result || result.Code != 1) {
      V8.Tips('启动全部安装/更新失败：' + ((result && result.Msg) || '接口无返回'), false);
      return;
    }
    var queuedTask = result.Data || {};
    var queuedTaskId = queuedTask.Id || queuedTask.TaskId || queuedTask.BackgroundTaskId || '';
    var slotHint = readiness
      ? '；工作器槽位 ' + Number(readiness.RunningSlotCount || 0) + '/' + Number(readiness.MaxParallelTaskCount || 0)
        + '，平台已保留普通任务执行槽'
      : '';
    V8.Tips('官方平台应用的全部安装/更新已进入后台任务'
      + (queuedTaskId ? '（任务ID：' + queuedTaskId + '）' : '')
      + slotHint + '，请在右上角后台任务中心查看进度。', true);
  } catch (error) {
    V8.Tips('启动全部安装/更新失败：' + error.message, false);
  }
}, null, { Title: '全部安装/更新', OkText: '开始执行', Icon: 'warning' });`;
  bulk.Workload = {
    ExpectedItems: 29,
    FanOutOperations: 29,
    ExpectedSeconds: 600,
  };
  menu.PageBtns = JSON.stringify(buttons);
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
    if (mapping.limitMemory) engine.LimitMemory = mapping.limitMemory;
  }
  if (packageModel.PackageInfo) {
    packageModel.PackageInfo.ApiEngineCount = Array.isArray(packageModel.SysApiEngines)
      ? packageModel.SysApiEngines.length
      : 0;
  }
  synchronizeBulkInstallButton(packageModel);
  return canonicalizeResource(applicationStorePackageName, JSON.stringify(packageModel));
}

export function assertApplicationStoreEnginesSynchronized(
  packageContent,
  standaloneContents,
  mappings = applicationStoreReplicaMappings,
) {
  for (const mapping of mappings) {
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
  const missingRemoteEmbeddedMappings = [];

  for (const mapping of applicationStoreReplicaMappings) {
    const baseEmbedded = tryGetEmbeddedEngineSource(basePackageContent, mapping.apiEngineKey);
    const localEmbedded = getEmbeddedEngineSource(localPackageContent, mapping.apiEngineKey);
    const localStandalone = localStandaloneContents.get(mapping.resourceName);

    // New replica mappings have no three-way baseline yet. They may be safely
    // introduced only when the local standalone fact source and the package
    // embedded source are identical, and the remote side has no conflicting
    // pre-existing implementation. This keeps first publication automatic
    // without weakening conflict protection for established replicas.
    if (baseEmbedded == null) {
      if (localStandalone == null) {
        throw new Error(`${mapping.resourceName} 本地独立源码不存在，不能首次发布新副本`);
      }
      if (normalizeText(localStandalone) !== normalizeText(localEmbedded)) {
        throw new Error(
          `${mapping.resourceName} 首次发布前与应用商城内嵌 ${mapping.apiEngineKey} 不一致`,
        );
      }
      const remoteEmbedded = tryGetEmbeddedEngineSource(remotePackageContent, mapping.apiEngineKey);
      const remoteStandalone = mapping.publishedStandalone
        ? remoteStandaloneContents.get(mapping.resourceName)
        : null;
      const remoteCandidate = remoteStandalone ?? remoteEmbedded;
      if (remoteStandalone != null && remoteEmbedded != null
        && normalizeText(remoteStandalone) !== normalizeText(remoteEmbedded)) {
        throw new Error(
          `${mapping.resourceName} 官网独立源码与商城内嵌 ${mapping.apiEngineKey} 不一致，不能首次建立基线`,
        );
      }
      if (remoteCandidate != null
        && normalizeText(remoteCandidate) !== normalizeText(localStandalone)) {
        throw new Error(`${mapping.resourceName} 尚无共同基线且本地与官网实现不同`);
      }
      resolvedStandaloneContents.set(
        mapping.resourceName,
        canonicalizeResource(mapping.resourceName, localStandalone),
      );
      continue;
    }
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

    const localResolved = await reconcileReplicaPair(
      mapping.resourceName,
      '本地 ',
      baseEmbedded,
      localStandaloneContents.get(mapping.resourceName),
      localEmbedded,
    );

    const actualRemoteEmbedded = tryGetEmbeddedEngineSource(
      remotePackageContent,
      mapping.apiEngineKey,
    );
    if (actualRemoteEmbedded == null) missingRemoteEmbeddedMappings.push(mapping);
    const remoteEmbedded = actualRemoteEmbedded ?? baseEmbedded;
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
  const restoredRemotePackage = restoreMissingReplicatedEngineSkeletons(
    remotePackageContent,
    basePackageContent,
    missingRemoteEmbeddedMappings,
  );
  const maskedRemotePackage = maskReplicatedEngineFields(restoredRemotePackage, basePackageContent);
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
