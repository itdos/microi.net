import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeResource,
  hasPlatformServiceBundleChanged,
  isTemporaryOfficialResourceFailure,
  mergeJavascriptResource,
  mergeJsonResource,
  normalizeOfficialPackageExecutionLimits,
  planOfficialResourcePublishBatches,
  selectOfficialPackageMergeBase,
  validateReadableOfficialResource,
  verifyOfflineReleaseSafety,
} from './resource-sync-core.mjs';
import {
  assertApplicationStoreEnginesSynchronized,
  choosePublishablePackageVersion,
  getEmbeddedEngineSource,
  mergeApplicationStoreReplicas,
} from './application-store-replica-sync.mjs';
import {
  findItDosMcpServer,
  readResourcesViaConfiguredMcp,
  resolveItDosMcpLaunch,
  validateItDosMcpServer,
} from './mcp-resource-publisher.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const refreshSource = await readFile(resolve(testDirectory, 'refresh-resources.mjs'), 'utf8');
const releaseSource = await readFile(resolve(testDirectory, '../../../Microi一键编译发布.sh'), 'utf8');
const officialEngineSource = await readFile(resolve(testDirectory, 'official-resource-api.js'), 'utf8');
const mcpPublisherSource = await readFile(resolve(testDirectory, 'mcp-resource-publisher.mjs'), 'utf8');

function engineSource(key, version, body, description = '测试接口') {
  return [
    '/*',
    ' * V8 ApiEngine',
    ` * ApiEngineKey: ${key}`,
    ` * Version: ${version}`,
    ' * Function:',
    ` * - ${description}`,
    ' */',
    '',
    body,
    '',
  ].join('\n');
}

function engineVersion(source) {
  return (source.match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i) || [])[1] || '';
}

const defaultBulkImporter = engineSource(
  'bulk-import-microi-store-packages',
  'v1.1.4',
  'return { Code: 1 };',
);

const defaultAssetPreparer = engineSource(
  'ai_app_prepare_store_assets',
  'v1.0.0',
  'return { Code: 1 };',
);

const defaultAppCreate = engineSource(
  'ai_app_create',
  'v1.2.0',
  'return { Code: 1 };',
);

const defaultStoreList = engineSource(
  'get-microi-store',
  'v1.4.0',
  'return { Code: 1, Data: [] };',
);

const defaultStoreModel = engineSource(
  'get-microi-store-model',
  'v1.2.0',
  'return { Code: 1, Data: {} };',
);

const defaultStoreVersions = engineSource(
  'get-microi-store-versions',
  'v1.0.0',
  'return { Code: 1, Data: [] };',
);

function applicationStorePackage({
  importer,
  publisher,
  builder,
  bulk = defaultBulkImporter,
  appCreate = defaultAppCreate,
  preparer = defaultAssetPreparer,
  storeList = defaultStoreList,
  storeModel = defaultStoreModel,
  storeVersions = defaultStoreVersions,
  version = 'v6.6.1',
}) {
  return JSON.stringify({
    PackageInfo: { Name: '应用商城', Version: version },
    SysApiEngines: [
      {
        Id: 'engine-importer',
        ApiEngineKey: 'import-microi-store-package',
        Version: engineVersion(importer),
        ApiV8Code: importer,
        StopHttp: 1,
      },
      {
        Id: 'engine-publisher',
        ApiEngineKey: 'ai_app_publish_store',
        Version: engineVersion(publisher),
        ApiV8Code: publisher,
        StopHttp: 0,
      },
      {
        Id: 'engine-app-create',
        ApiEngineKey: 'ai_app_create',
        Version: engineVersion(appCreate),
        ApiV8Code: appCreate,
        StopHttp: 0,
      },
      {
        Id: 'engine-bulk-importer',
        ApiEngineKey: 'bulk-import-microi-store-packages',
        Version: engineVersion(bulk),
        ApiV8Code: bulk,
        StopHttp: 0,
      },
      {
        Id: 'engine-builder',
        ApiEngineKey: 'ai_app_build',
        Version: engineVersion(builder),
        ApiV8Code: builder,
        StopHttp: 0,
      },
      {
        Id: 'engine-store-list',
        ApiEngineKey: 'get-microi-store',
        Version: engineVersion(storeList),
        ApiV8Code: storeList,
        StopHttp: 0,
      },
      {
        Id: 'engine-store-model',
        ApiEngineKey: 'get-microi-store-model',
        Version: engineVersion(storeModel),
        ApiV8Code: storeModel,
        StopHttp: 0,
      },
      {
        Id: 'engine-store-versions',
        ApiEngineKey: 'get-microi-store-versions',
        Version: engineVersion(storeVersions),
        ApiV8Code: storeVersions,
        StopHttp: 0,
      },
      {
        Id: 'engine-asset-preparer',
        ApiEngineKey: 'ai_app_prepare_store_assets',
        Version: engineVersion(preparer),
        ApiV8Code: preparer,
        StopHttp: 1,
      },
    ],
  });
}

function replicaMaps({
  importer,
  publisher,
  builder,
  bulk = defaultBulkImporter,
  appCreate = defaultAppCreate,
  preparer = defaultAssetPreparer,
  storeList = defaultStoreList,
  storeModel = defaultStoreModel,
  storeVersions = defaultStoreVersions,
}) {
  return new Map([
    ['import-package.js', importer],
    ['bulk-import-packages.js', bulk],
    ['get-microi-store-list.js', storeList],
    ['get-microi-store-model.js', storeModel],
    ['get-microi-store-versions.js', storeVersions],
    ['ai-app-publish-store.js', publisher],
    ['ai-app-create.js', appCreate],
    ['ai-app-prepare-store-assets.js', preparer],
    ['ai-app-build.js', builder],
  ]);
}

function withoutEmbeddedEngine(content, apiEngineKey) {
  const model = JSON.parse(content);
  model.SysApiEngines = model.SysApiEngines.filter(
    engine => engine.ApiEngineKey !== apiEngineKey,
  );
  return JSON.stringify(model);
}

async function mergeReplicaFixture({
  baseImporter,
  basePublisher,
  baseBuilder,
  baseBulk = defaultBulkImporter,
  localImporter = baseImporter,
  localPublisher = basePublisher,
  localBuilder = baseBuilder,
  localBulk = baseBulk,
  localEmbeddedPublisher = localPublisher,
  localEmbeddedBuilder = localBuilder,
  remoteImporter = baseImporter,
  remotePublisher = basePublisher,
  remoteEmbeddedPublisher = remotePublisher,
  remoteEmbeddedBuilder = baseBuilder,
  remoteBulk = baseBulk,
}) {
  return mergeApplicationStoreReplicas({
    basePackageContent: applicationStorePackage({
      importer: baseImporter,
      publisher: basePublisher,
      builder: baseBuilder,
      bulk: baseBulk,
    }),
    localPackageContent: applicationStorePackage({
      importer: localImporter,
      publisher: localEmbeddedPublisher,
      builder: localEmbeddedBuilder,
      bulk: localBulk,
    }),
    remotePackageContent: applicationStorePackage({
      importer: remoteImporter,
      publisher: remoteEmbeddedPublisher,
      builder: remoteEmbeddedBuilder,
      bulk: remoteBulk,
    }),
    baseStandaloneContents: replicaMaps({
      importer: baseImporter,
      publisher: basePublisher,
      builder: baseBuilder,
      bulk: baseBulk,
    }),
    localStandaloneContents: replicaMaps({
      importer: localImporter,
      publisher: localPublisher,
      builder: localBuilder,
      bulk: localBulk,
    }),
    remoteStandaloneContents: replicaMaps({
      importer: remoteImporter,
      publisher: remotePublisher,
      builder: remoteEmbeddedBuilder,
      bulk: remoteBulk,
    }),
  });
}

test('应用商城包允许失败重跑版本与官网独立升版并保留最高版本', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const publisher = engineSource('ai_app_publish_store', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePackage = applicationStorePackage({ importer, publisher, builder, version: 'v7.4.14' });
  const localPackage = applicationStorePackage({ importer, publisher, builder, version: 'v7.5.0' });
  const remotePackage = applicationStorePackage({ importer, publisher, builder, version: 'v7.4.15' });
  const replicas = replicaMaps({ importer, publisher, builder });

  const merged = await mergeApplicationStoreReplicas({
    basePackageContent: basePackage,
    localPackageContent: localPackage,
    remotePackageContent: remotePackage,
    baseStandaloneContents: replicas,
    localStandaloneContents: replicas,
    remoteStandaloneContents: replicas,
  });

  assert.equal(JSON.parse(merged.packageContent).PackageInfo.Version, 'v7.5.0');
});

test('JSON 三方合并保留本地与官网的非冲突修改', () => {
  const base = JSON.stringify({ PackageInfo: { Version: 'v1.0.0' }, Config: { Local: 1, Remote: 1 } });
  const local = JSON.stringify({ PackageInfo: { Version: 'v1.0.0' }, Config: { Local: 2, Remote: 1 } });
  const remote = JSON.stringify({ PackageInfo: { Version: 'v1.0.0' }, Config: { Local: 1, Remote: 3 } });
  const merged = JSON.parse(mergeJsonResource('package.json', base, local, remote));
  assert.deepEqual(merged.Config, { Local: 2, Remote: 3 });
});

test('JSON 按稳定 Id 合并数组元素而不是整段覆盖', () => {
  const base = JSON.stringify({ SysMenus: [{ Id: 'menu-1', Name: '菜单', Sort: 1 }] });
  const local = JSON.stringify({ SysMenus: [{ Id: 'menu-1', Name: '本地菜单', Sort: 1 }] });
  const remote = JSON.stringify({ SysMenus: [{ Id: 'menu-1', Name: '菜单', Sort: 2 }] });
  const merged = JSON.parse(mergeJsonResource('package.json', base, local, remote));
  assert.deepEqual(merged.SysMenus, [{ Id: 'menu-1', Name: '本地菜单', Sort: 2 }]);
});

test('官方包能力集合和追加式更新日志可安全合并并保留双方内容', () => {
  const base = JSON.stringify({ PackageInfo: {
    RequiredPlatformCapabilities: ['Base'],
    ChangeHistory: '2026-08-28 v1.0.0 基线。\n',
  } });
  const local = JSON.stringify({ PackageInfo: {
    RequiredPlatformCapabilities: ['Base', 'Local'],
    ChangeHistory: '2026-08-30 v1.0.2 本地更新。\n2026-08-28 v1.0.0 基线。\n',
  } });
  const remote = JSON.stringify({ PackageInfo: {
    RequiredPlatformCapabilities: ['Base', 'Remote'],
    ChangeHistory: '2026-08-29 v1.0.1 远端更新。\n2026-08-28 v1.0.0 基线。\n',
  } });
  const merged = JSON.parse(mergeJsonResource('package.json', base, local, remote));
  assert.deepEqual(merged.PackageInfo.RequiredPlatformCapabilities, ['Base', 'Local', 'Remote']);
  assert.equal(
    merged.PackageInfo.ChangeHistory,
    '2026-08-30 v1.0.2 本地更新。\n2026-08-29 v1.0.1 远端更新。\n2026-08-28 v1.0.0 基线。\n',
  );
});

test('追加式更新日志仍拒绝同一版本被双方写成不同内容', () => {
  const base = JSON.stringify({ PackageInfo: { ChangeHistory: '2026-08-28 v1.0.0 基线。\n' } });
  const local = JSON.stringify({ PackageInfo: { ChangeHistory: '2026-08-30 v1.0.1 本地。\n2026-08-28 v1.0.0 基线。\n' } });
  const remote = JSON.stringify({ PackageInfo: { ChangeHistory: '2026-08-30 v1.0.1 远端。\n2026-08-28 v1.0.0 基线。\n' } });
  assert.throws(() => mergeJsonResource('package.json', base, local, remote), /版本 v1\.0\.1 被两端追加为不同内容/);
});

test('共同基线高于官网时仅沿完整追加历史恢复官网作为有效合并基点', () => {
  const packageContent = (version, history) => JSON.stringify({
    PackageInfo: {
      Name: '应用商城',
      Version: version,
      ChangeHistory: history,
    },
  });
  const remote = packageContent('v1.0.1', '2026-08-28 v1.0.1 官网祖先。\n');
  const base = packageContent(
    'v1.0.2',
    '2026-08-29 v1.0.2 已记录但未完成发布。\n2026-08-28 v1.0.1 官网祖先。\n',
  );
  const local = packageContent(
    'v1.0.3',
    '2026-08-30 v1.0.3 本地候选。\n2026-08-29 v1.0.2 已记录但未完成发布。\n2026-08-28 v1.0.1 官网祖先。\n',
  );

  const selected = selectOfficialPackageMergeBase('app.microi.store.json', base, local, remote);
  assert.equal(selected.recoveredFromAheadBaseline, true);
  assert.equal(selected.remoteVersion, 'v1.0.1');
  assert.equal(selected.baseVersion, 'v1.0.2');
  assert.equal(selected.localVersion, 'v1.0.3');
  assert.equal(selected.content, canonicalizeResource('app.microi.store.json', remote));
});

test('共同基线高于官网但官网存在候选未继承的历史时失败关闭', () => {
  const packageContent = (version, history) => JSON.stringify({
    PackageInfo: { Name: '应用商城', Version: version, ChangeHistory: history },
  });
  const remote = packageContent(
    'v1.0.1',
    '2026-08-28 v1.0.1 官网祖先。\n2026-08-27 v1.0.0 其他成员历史。\n',
  );
  const base = packageContent(
    'v1.0.2',
    '2026-08-29 v1.0.2 本地基线。\n2026-08-28 v1.0.1 官网祖先。\n',
  );
  const local = packageContent(
    'v1.0.3',
    '2026-08-30 v1.0.3 本地候选。\n2026-08-29 v1.0.2 本地基线。\n2026-08-28 v1.0.1 官网祖先。\n',
  );

  assert.throws(
    () => selectOfficialPackageMergeBase('app.microi.store.json', base, local, remote),
    /不能证明官网是共同基线的祖先/,
  );
});

test('JSON 同一字段被两端改为不同值时阻止发布', () => {
  assert.throws(
    () => mergeJsonResource(
      'package.json',
      '{"PackageInfo":{"Version":"v1.0.0"}}',
      '{"PackageInfo":{"Version":"v1.0.1"}}',
      '{"PackageInfo":{"Version":"v1.0.2"}}',
    ),
    /JSON 冲突/,
  );
});

test('JS 三方合并保留不同代码行上的双向修改', async () => {
  const base = [
    'function localFeature() {',
    '  return 1;',
    '}',
    '',
    '// 保持两个修改位于不同补丁上下文',
    '',
    'function remoteFeature() {',
    '  return 1;',
    '}',
    '',
  ].join('\n');
  const local = base.replace('function localFeature() {\n  return 1;', 'function localFeature() {\n  return 2;');
  const remote = base.replace('function remoteFeature() {\n  return 1;', 'function remoteFeature() {\n  return 3;');
  const merged = await mergeJavascriptResource('engine.js', base, local, remote);
  assert.match(merged, /function localFeature\(\) \{\n  return 2;/);
  assert.match(merged, /function remoteFeature\(\) \{\n  return 3;/);
});

test('JS 同一代码行冲突时阻止发布', async () => {
  await assert.rejects(
    mergeJavascriptResource(
      'engine.js',
      'var value = 1;\n',
      'var value = 2;\n',
      'var value = 3;\n',
    ),
    /三方合并冲突/,
  );
});

test('官网停留共同基线时允许本地新版进入三方合并并向前发布', async () => {
  const baseAndRemote = engineSource(
    'import-microi-store-package',
    'v1.7.3',
    'var readiness = "PRUNE_ASSET_IDS_WITH_DELFORM_V1";\nreturn readiness;',
  );
  const local = baseAndRemote
    .replace('Version: v1.7.3', 'Version: v1.7.4')
    .replace(
      'return readiness;',
      'var bootstrap = "BACKGROUND_TASK_BOOTSTRAP_READINESS_V1";\nreturn readiness + bootstrap;',
    );

  assert.doesNotThrow(() => validateReadableOfficialResource('import-package.js', baseAndRemote));
  const merged = await mergeJavascriptResource(
    'import-package.js',
    baseAndRemote,
    local,
    baseAndRemote,
  );
  assert.equal(merged, canonicalizeResource('import-package.js', local));
  assert.match(merged, /Version: v1\.7\.4/);
  assert.match(merged, /BACKGROUND_TASK_BOOTSTRAP_READINESS_V1/);
});

test('官网读取门只校验稳定身份和可解析性，不把旧版本误判为网络故障', () => {
  assert.doesNotThrow(() => validateReadableOfficialResource(
    'ai-app-publish-store.js',
    engineSource('ai_app_publish_store', 'v1.0.0', 'return { Code: 1 };'),
  ));
  assert.doesNotThrow(() => validateReadableOfficialResource(
    'app.microi.store.json',
    JSON.stringify({ PackageInfo: { Name: '应用商城', Version: 'v1.0.0' } }),
  ));
  assert.doesNotThrow(() => validateReadableOfficialResource(
    'app.microi.sso.json',
    JSON.stringify({ PackageInfo: { Name: 'SSO 身份联邦', Version: 'v7.5.0' } }),
  ));
  assert.throws(
    () => validateReadableOfficialResource('import-package.js', '/* missing identity */'),
    /缺少稳定资源标识/,
  );
  assert.throws(
    () => validateReadableOfficialResource('app.microi.store.json', '{bad json'),
    /不是有效 JSON/,
  );
  assert.throws(
    () => validateReadableOfficialResource('unknown.js', 'content'),
    /固定白名单/,
  );
});

test('应用商城逻辑副本自动消除同版本同正文的说明文字误冲突', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.3',
    'var runtime = getRuntime();\nreturn runtime;',
    '旧说明',
  );
  const changedBody = [
    'var runtime = getRuntime();',
    'if (!runtime && V8.Param.MicroService) runtime = V8.Param.MicroService;',
    'return runtime;',
  ].join('\n');
  const localPublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.4',
    changedBody,
    '本地说明',
  );
  const remotePublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.4',
    changedBody,
    '官网更完整的功能说明',
  );

  const merged = await mergeReplicaFixture({
    baseImporter: importer,
    basePublisher,
    baseBuilder: builder,
    localPublisher,
    localEmbeddedPublisher: localPublisher,
    remotePublisher,
    remoteEmbeddedPublisher: basePublisher,
  });
  assert.equal(merged.standaloneContents.get('ai-app-publish-store.js'), remotePublisher);
  assert.equal(
    getEmbeddedEngineSource(merged.packageContent, 'ai_app_publish_store'),
    remotePublisher,
  );
  assert.doesNotThrow(() => assertApplicationStoreEnginesSynchronized(
    merged.packageContent,
    merged.standaloneContents,
  ));
});

test('应用商城逻辑副本自动合并独立文件和内嵌代码的不同代码段修改', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.3',
    'function localFeature() {\n  return 1;\n}\n\n// 独立合并上下文\n\nfunction remoteFeature() {\n  return 1;\n}',
  );
  const localPublisher = basePublisher.replace('function localFeature() {\n  return 1;', 'function localFeature() {\n  return 2;');
  const remoteEmbeddedPublisher = basePublisher.replace('function remoteFeature() {\n  return 1;', 'function remoteFeature() {\n  return 3;');

  const merged = await mergeReplicaFixture({
    baseImporter: importer,
    basePublisher,
    baseBuilder: builder,
    localPublisher,
    localEmbeddedPublisher: basePublisher,
    remotePublisher: basePublisher,
    remoteEmbeddedPublisher,
  });
  const resolved = merged.standaloneContents.get('ai-app-publish-store.js');
  assert.match(resolved, /function localFeature\(\) \{\n  return 2;/);
  assert.match(resolved, /function remoteFeature\(\) \{\n  return 3;/);
  assert.equal(getEmbeddedEngineSource(merged.packageContent, 'ai_app_publish_store'), resolved);
});

test('应用商城逻辑副本忽略两端独立递增的版本头并为合成正文自动升版', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.4',
    'function localFeature() {\n  return 1;\n}\n\n// 两端保存时都会独立升版\n\nfunction remoteFeature() {\n  return 1;\n}',
    '共同基线',
  );
  const localPublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.5',
    'function localFeature() {\n  return 2;\n}\n\n// 两端保存时都会独立升版\n\nfunction remoteFeature() {\n  return 1;\n}',
    '本地功能',
  );
  const remotePublisher = engineSource(
    'ai_app_publish_store',
    'v1.5.6',
    'function localFeature() {\n  return 1;\n}\n\n// 两端保存时都会独立升版\n\nfunction remoteFeature() {\n  return 3;\n}',
    '官网功能',
  );

  const merged = await mergeReplicaFixture({
    baseImporter: importer,
    basePublisher,
    baseBuilder: builder,
    localPublisher,
    localEmbeddedPublisher: basePublisher,
    remotePublisher,
    remoteEmbeddedPublisher: basePublisher,
  });
  const resolved = merged.standaloneContents.get('ai-app-publish-store.js');
  assert.match(resolved, /Version: v1\.5\.7/);
  assert.match(resolved, /function localFeature\(\) \{\n  return 2;/);
  assert.match(resolved, /function remoteFeature\(\) \{\n  return 3;/);
  assert.equal(getEmbeddedEngineSource(merged.packageContent, 'ai_app_publish_store'), resolved);
});

test('应用商城逻辑副本仍阻止同一代码行被本地和官网改成不同实现', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePublisher = engineSource('ai_app_publish_store', 'v1.5.3', 'var value = 1;\nreturn value;');
  const localPublisher = engineSource('ai_app_publish_store', 'v1.5.4', 'var value = 2;\nreturn value;');
  const remotePublisher = engineSource('ai_app_publish_store', 'v1.5.5', 'var value = 3;\nreturn value;');

  await assert.rejects(
    mergeReplicaFixture({
      baseImporter: importer,
      basePublisher,
      baseBuilder: builder,
      localPublisher,
      localEmbeddedPublisher: basePublisher,
      remotePublisher,
      remoteEmbeddedPublisher: basePublisher,
    }),
    /真实代码冲突/,
  );
});

test('ai-app-build 保持本地事实源并同步写入官网商城包内嵌副本', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const publisher = engineSource('ai_app_publish_store', 'v1.5.3', 'return { Code: 1 };');
  const baseBuilder = engineSource('ai_app_build', 'v1.3.0', 'var value = 1;\nreturn value;');
  const localBuilder = engineSource('ai_app_build', 'v1.3.1', 'var value = 2;\nreturn value;');

  const merged = await mergeReplicaFixture({
    baseImporter: importer,
    basePublisher: publisher,
    baseBuilder,
    localBuilder,
    localEmbeddedBuilder: baseBuilder,
    remoteEmbeddedBuilder: baseBuilder,
  });
  assert.equal(merged.standaloneContents.get('ai-app-build.js'), localBuilder);
  assert.equal(getEmbeddedEngineSource(merged.packageContent, 'ai_app_build'), localBuilder);
});

test('首次新增内嵌商城引擎时允许从一致的本地事实源建立副本基线', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const publisher = engineSource('ai_app_publish_store', 'v1.5.3', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.3.0', 'return { Code: 1 };');
  const bulk = engineSource(
    'bulk-import-microi-store-packages',
    'v1.0.0',
    'return { Code: 1, Data: { BackgroundTask: { HasMore: false } } };',
  );
  const basePackage = withoutEmbeddedEngine(
    applicationStorePackage({ importer, publisher, builder, bulk }),
    'bulk-import-microi-store-packages',
  );
  const localPackage = applicationStorePackage({ importer, publisher, builder, bulk });
  const remotePackage = withoutEmbeddedEngine(
    applicationStorePackage({ importer, publisher, builder, bulk }),
    'bulk-import-microi-store-packages',
  );
  const establishedReplicas = replicaMaps({ importer, publisher, builder, bulk });
  establishedReplicas.delete('bulk-import-packages.js');

  const merged = await mergeApplicationStoreReplicas({
    basePackageContent: basePackage,
    localPackageContent: localPackage,
    remotePackageContent: remotePackage,
    baseStandaloneContents: establishedReplicas,
    localStandaloneContents: replicaMaps({ importer, publisher, builder, bulk }),
    remoteStandaloneContents: establishedReplicas,
  });

  assert.equal(
    getEmbeddedEngineSource(merged.packageContent, 'bulk-import-microi-store-packages'),
    bulk,
  );
  assert.equal(merged.standaloneContents.get('bulk-import-packages.js'), bulk);
});

test('共同基线已有内嵌引擎但官网副本缺失时自动恢复且不丢本地升级', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const publisher = engineSource('ai_app_publish_store', 'v1.5.3', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.3.0', 'return { Code: 1 };');
  const baseBulk = engineSource(
    'bulk-import-microi-store-packages',
    'v1.1.2',
    'return { Code: 1, Data: { Version: 2 } };',
  );
  const localBulk = engineSource(
    'bulk-import-microi-store-packages',
    'v1.1.4',
    'return { Code: 1, Data: { Version: 4 } };',
  );
  const basePackage = applicationStorePackage({ importer, publisher, builder, bulk: baseBulk });
  const localPackage = applicationStorePackage({ importer, publisher, builder, bulk: localBulk });
  const remotePackage = withoutEmbeddedEngine(
    basePackage,
    'bulk-import-microi-store-packages',
  );

  const merged = await mergeApplicationStoreReplicas({
    basePackageContent: basePackage,
    localPackageContent: localPackage,
    remotePackageContent: remotePackage,
    baseStandaloneContents: replicaMaps({ importer, publisher, builder, bulk: baseBulk }),
    localStandaloneContents: replicaMaps({ importer, publisher, builder, bulk: localBulk }),
    remoteStandaloneContents: replicaMaps({ importer, publisher, builder, bulk: baseBulk }),
  });

  assert.equal(
    getEmbeddedEngineSource(merged.packageContent, 'bulk-import-microi-store-packages'),
    localBulk,
  );
  assert.equal(merged.standaloneContents.get('bulk-import-packages.js'), localBulk);
  const mergedPackage = JSON.parse(merged.packageContent);
  assert.equal(mergedPackage.PackageInfo.ApiEngineCount, mergedPackage.SysApiEngines.length);
});

test('官网缺少已建立的内嵌副本时保留官网独立源码更新并重建副本', async () => {
  const baseImporter = engineSource(
    'import-microi-store-package',
    'v1.8.7',
    'return { Code: 1, Data: { Version: 7 } };',
  );
  const remoteImporter = engineSource(
    'import-microi-store-package',
    'v1.8.8',
    'return { Code: 1, Data: { Version: 8 } };',
  );
  const publisher = engineSource('ai_app_publish_store', 'v1.5.3', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.3.0', 'return { Code: 1 };');
  const basePackage = applicationStorePackage({ importer: baseImporter, publisher, builder });
  const remotePackage = withoutEmbeddedEngine(
    basePackage,
    'import-microi-store-package',
  );

  const merged = await mergeApplicationStoreReplicas({
    basePackageContent: basePackage,
    localPackageContent: basePackage,
    remotePackageContent: remotePackage,
    baseStandaloneContents: replicaMaps({ importer: baseImporter, publisher, builder }),
    localStandaloneContents: replicaMaps({ importer: baseImporter, publisher, builder }),
    remoteStandaloneContents: replicaMaps({ importer: remoteImporter, publisher, builder }),
  });

  assert.equal(
    getEmbeddedEngineSource(merged.packageContent, 'import-microi-store-package'),
    remoteImporter,
  );
  assert.equal(merged.standaloneContents.get('import-package.js'), remoteImporter);
});

test('官网缺失副本但共同基线引擎 Id 已被其它 Key 占用时阻止自动恢复', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const publisher = engineSource('ai_app_publish_store', 'v1.5.3', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.3.0', 'return { Code: 1 };');
  const bulk = engineSource('bulk-import-microi-store-packages', 'v1.1.4', 'return { Code: 1 };');
  const basePackage = applicationStorePackage({ importer, publisher, builder, bulk });
  const remoteModel = JSON.parse(basePackage);
  remoteModel.SysApiEngines.find(
    engine => engine.ApiEngineKey === 'bulk-import-microi-store-packages',
  ).ApiEngineKey = 'different-engine-using-the-same-id';

  await assert.rejects(
    mergeApplicationStoreReplicas({
      basePackageContent: basePackage,
      localPackageContent: basePackage,
      remotePackageContent: JSON.stringify(remoteModel),
      baseStandaloneContents: replicaMaps({ importer, publisher, builder, bulk }),
      localStandaloneContents: replicaMaps({ importer, publisher, builder, bulk }),
      remoteStandaloneContents: replicaMaps({ importer, publisher, builder, bulk }),
    }),
    /共同基线 Id engine-bulk-importer 已被 different-engine-using-the-same-id 占用/,
  );
});

test('商城包写回时优先使用更高正式版本，否则独立递增包补丁版本', () => {
  assert.equal(choosePublishablePackageVersion('v6.6.1', 'v6.6.1', '6.7.4'), 'v6.7.4');
  assert.equal(choosePublishablePackageVersion('v6.7.5', 'v6.6.1', '6.7.4'), 'v6.7.5');
  assert.equal(choosePublishablePackageVersion('v6.8.0', 'v6.8.0', '6.7.9'), 'v6.8.1');
  assert.equal(choosePublishablePackageVersion('v6.6.1', 'v6.7.4', '6.7.4'), 'v6.7.5');
  assert.equal(choosePublishablePackageVersion('v6.6.1', 'not-semver', '6.7.4'), null);
});

test('资源规范化统一换行和 JSON 缩进', () => {
  assert.equal(canonicalizeResource('engine.js', 'var x = 1;\r\n'), 'var x = 1;\n');
  assert.equal(canonicalizeResource('package.json', '{"a":1}'), '{\n  "a": 1\n}\n');
});

test('官方应用包候选不会持久化超过运行时硬上限的递归深度', () => {
  const normalized = JSON.parse(normalizeOfficialPackageExecutionLimits(
    'app.microi.store.json',
    JSON.stringify({
      PackageInfo: { Name: '应用商城' },
      SysApiEngines: [
        { ApiEngineKey: 'legacy-high', LimitRecursion: 10000 },
        { ApiEngineKey: 'ordinary', LimitRecursion: 2000 },
        { ApiEngineKey: 'unlimited', LimitRecursion: 0 },
      ],
    }),
  ));

  assert.equal(normalized.SysApiEngines[0].LimitRecursion, 5000);
  assert.equal(normalized.SysApiEngines[1].LimitRecursion, 2000);
  assert.equal(normalized.SysApiEngines[2].LimitRecursion, 0);
});

test('当前全部官方应用包都已落盘运行时允许的递归深度', async () => {
  const packageNames = [
    'app.microi.form-engine.json',
    'app.microi.module-engine.json',
    'app.microi.saas-engine.json',
    'app.microi.sso.json',
    'app.microi.store.json',
    'app.microi.sys_user.json',
    'app.microi.sys-config.json',
    'app.microi.message-notification.json',
    'app.microi.ai-engine.json',
  ];
  const offenders = [];
  for (const packageName of packageNames) {
    const packageModel = JSON.parse(await readFile(resolve(testDirectory, packageName), 'utf8'));
    for (const engine of packageModel.SysApiEngines || []) {
      if (Number(engine.LimitRecursion) > 5000) {
        offenders.push(`${packageName}:${engine.ApiEngineKey}=${engine.LimitRecursion}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('官方应用生成器不会重新写入超过运行时硬上限的递归深度', async () => {
  const generatorNames = (await readdir(testDirectory))
    .filter(name => name.startsWith('configure-') && name.endsWith('.mjs'));
  const offenders = [];
  for (const generatorName of generatorNames) {
    const source = await readFile(resolve(testDirectory, generatorName), 'utf8');
    for (const match of source.matchAll(/LimitRecursion\s*:\s*(\d+)/g)) {
      if (Number(match[1]) > 5000) offenders.push(`${generatorName}:${match[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('官网临时故障识别只放行网络、限流和服务端错误', () => {
  assert.equal(isTemporaryOfficialResourceFailure(new Error('服务器内部错误，请稍后重试。')), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('import-package.js HTTP 503')), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('fetch failed', { cause: { code: 'ECONNRESET' } })), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('import-package.js HTTP 401')), false);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('资源名不正确')), false);
});

test('仅当平台内置微服务包内容变化时要求验证唯一源码', () => {
  const packageContent = bundle => JSON.stringify({
    PackageInfo: { Name: '应用商城', Version: 'v1.0.0' },
    ApplicationBundles: [bundle],
  });
  const unchanged = {
    Application: { AppKey: 'microi-platform-service', BuildVersion: 'v1.0.0' },
    BuildAssets: [{ Path: 'index.html', Sha256: 'same' }],
  };
  const reordered = {
    BuildAssets: [{ Sha256: 'same', Path: 'index.html' }],
    Application: { BuildVersion: 'v1.0.0', AppKey: 'microi-platform-service' },
  };
  const changed = {
    ...unchanged,
    BuildAssets: [{ Path: 'index.html', Sha256: 'changed' }],
  };
  assert.equal(
    hasPlatformServiceBundleChanged(
      'app.microi.store.json',
      packageContent(unchanged),
      packageContent(reordered),
    ),
    false,
  );
  assert.equal(
    hasPlatformServiceBundleChanged(
      'app.microi.store.json',
      packageContent(unchanged),
      packageContent(changed),
    ),
    true,
  );
  assert.throws(
    () => hasPlatformServiceBundleChanged(
      'app.microi.store.json',
      packageContent(unchanged),
      JSON.stringify({ PackageInfo: { Name: '应用商城' }, ApplicationBundles: [] }),
    ),
    /必须且只能包含一个 microi-platform-service 应用包/,
  );
  assert.match(refreshSource, /changedPlatformServicePackages/);
  assert.match(refreshSource, /两个内置包与官网内容一致/);
});

test('离线发布仅允许全部本地资源与共同基线完全一致', () => {
  const names = ['a.js', 'b.json'];
  const local = new Map([['a.js', 'a\n'], ['b.json', '{}\n']]);
  const base = new Map(local);
  assert.doesNotThrow(() => verifyOfflineReleaseSafety(names, local, base));
  assert.throws(
    () => verifyOfflineReleaseSafety(names, new Map([['a.js', 'changed\n'], ['b.json', '{}\n']]), base),
    /本地已有未同步修改：a\.js/,
  );
  assert.throws(
    () => verifyOfflineReleaseSafety(names, local, new Map([['a.js', 'a\n']])),
    /缺少共同基线：b\.json/,
  );
});

test('后端发布前强制执行官网三方同步和发布后回读', () => {
  assert.match(releaseSource, /refresh-resources\.mjs --publish --allow-verified-offline/);
  assert.match(refreshSource, /发布后回读与合并结果不一致，未推进共同基线/);
  assert.match(refreshSource, /ExpectedRemoteSha256/);
  assert.match(refreshSource, /PackageInfo\.Version 自动提升为/);
  assert.match(refreshSource, /无法根据包版本[\s\S]*?生成更高的语义版本/);
  assert.match(refreshSource, /未写入官网、未修改本地资源、未推进共同基线/);
  assert.match(refreshSource, /publishResourcesViaConfiguredMcp/);
  assert.match(refreshSource, /readResourcesViaConfiguredMcp/);
  assert.match(refreshSource, /MICROI_UPGRADE_RESOURCE_TRANSPORT/);
  assert.match(refreshSource, /MICROI_UPGRADE_RESOURCE_TOKEN/);
  assert.match(refreshSource, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(refreshSource, /Token:\s*token/);
  assert.match(refreshSource, /validateReadableOfficialResource\(name, content\)/);
  assert.match(refreshSource, /validateReleaseCandidate\(name, content\)/);
});

test('共同基线只能通过显式官网回读修复且不能伴随发布', () => {
  assert.match(refreshSource, /--repair-base-from-remote/);
  assert.match(
    refreshSource,
    /repairBaseFromRemote && \(initializeBase \|\| publish \|\| allowVerifiedOffline\)/,
  );
  assert.match(
    refreshSource,
    /assertApplicationStoreEnginesSynchronized\([\s\S]*?remotePackageContent/,
  );
  assert.match(refreshSource, /remoteReplicaMappings/);
  assert.match(refreshSource, /remoteEngineKeys\.has\(mapping\.apiEngineKey\)/);
  assert.match(refreshSource, /按官网回读修复共同基线/);
});

test('无显式 Token 时只允许复用绑定官方 iTdos 的 MCP', () => {
  const valid = {
    type: 'stdio',
    command: 'node',
    args: ['mcp-server.js'],
    env: { MICROI_API_URL: 'https://api.itdos.com/', MICROI_OS_CLIENT: 'iTdos' },
  };
  assert.equal(validateItDosMcpServer(valid), valid);
  assert.throws(
    () => validateItDosMcpServer({ ...valid, env: { ...valid.env, MICROI_API_URL: 'https://example.com' } }),
    /未绑定吾码官方 API/,
  );
  assert.throws(
    () => validateItDosMcpServer({ ...valid, env: { ...valid.env, MICROI_OS_CLIENT: 'other' } }),
    /未绑定 iTdos 租户/,
  );
});

test('官网 MCP 发布器在插件升级后自动改用最新可用入口和当前 Node', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-mcp-launch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extensionsRoot = join(root, 'extensions');
  const oldEntry = join(extensionsRoot, 'microi.v8-engine-4.2.9', 'dist', 'mcp-server.js');
  const currentExtensionRoot = join(extensionsRoot, 'microi.v8-engine-4.10.0');
  const currentEntry = join(currentExtensionRoot, 'dist', 'mcp-server.js');
  await mkdir(dirname(currentEntry), { recursive: true });
  await writeFile(currentEntry, '/* test MCP server */\n', 'utf8');

  const server = {
    type: 'stdio',
    command: 'C:\\old-editor\\Code.exe',
    args: [oldEntry],
    cwd: dirname(dirname(oldEntry)),
    env: {
      MICROI_API_URL: 'https://api.itdos.com',
      MICROI_OS_CLIENT: 'itdos',
      MICROI_TOKEN_FILE: join(root, 'token.json'),
    },
  };
  const configPath = join(root, '.mcp.json');
  await writeFile(configPath, JSON.stringify({ mcpServers: { microi_itdos: server } }), 'utf8');

  const launch = await resolveItDosMcpLaunch(server, configPath);
  assert.equal(launch.command, process.execPath);
  assert.equal(launch.args[0], currentEntry);
  assert.equal(launch.cwd, currentExtensionRoot);
  assert.equal(launch.launchSource, 'newest-installed-extension');
  assert.equal(launch.env.MICROI_TOKEN_FILE, server.env.MICROI_TOKEN_FILE);

  const found = await findItDosMcpServer(root, configPath);
  assert.equal(found.path, configPath);
  assert.equal(found.server.args[0], currentEntry);
});

test('官网 MCP 发布器兼容带 API 主机后缀的稳定服务器名称', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-mcp-host-suffix-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'plugin', 'dist', 'mcp-server.js');
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, '/* test MCP server */\n', 'utf8');

  const server = {
    type: 'stdio',
    command: 'node',
    args: [entry],
    env: {
      MICROI_API_URL: 'https://api.itdos.com',
      MICROI_OS_CLIENT: 'iTdos',
      MICROI_TOKEN_FILE: join(root, 'token.json'),
    },
  };
  const configPath = join(root, '.mcp.json');
  await writeFile(configPath, JSON.stringify({
    mcpServers: { microi_itdos_api_itdos_com: server },
  }), 'utf8');

  const found = await findItDosMcpServer(root, configPath);
  assert.equal(found.path, configPath);
  assert.equal(found.server.args[0], entry);
  assert.equal(found.server.env.MICROI_TOKEN_FILE, server.env.MICROI_TOKEN_FILE);
});

test('官网 MCP 发布器支持 Codex 插件生成的 microi-cli-mcp 稳定入口', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-codex-mcp-entry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pluginRoot = join(root, 'plugins', 'microi', '4.9.2');
  const entry = join(pluginRoot, 'scripts', 'microi-cli-mcp.js');
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, "require('./mcp-server.js');\n", 'utf8');

  const server = {
    type: 'stdio',
    command: 'node',
    args: [entry],
    env: {
      MICROI_API_URL: 'https://api.itdos.com',
      MICROI_OS_CLIENT: 'iTdos',
      MICROI_TOKEN_FILE: join(root, 'token.json'),
    },
  };
  const configPath = join(root, '.mcp.json');
  const launch = await resolveItDosMcpLaunch(server, configPath);

  assert.equal(launch.command, process.execPath);
  assert.equal(launch.args[0], entry);
  assert.equal(launch.cwd, pluginRoot);
  assert.equal(launch.launchSource, 'configured');
  assert.equal(launch.env.MICROI_TOKEN_FILE, server.env.MICROI_TOKEN_FILE);
});

test('官网 MCP 发布器不会被仍存在的旧插件入口锁住', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-mcp-stale-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extensionsRoot = join(root, 'extensions');
  const oldExtensionRoot = join(extensionsRoot, 'microi.v8-engine-4.6.2');
  const oldEntry = join(oldExtensionRoot, 'dist', 'mcp-server.js');
  const newExtensionRoot = join(extensionsRoot, 'microi.v8-engine-4.6.3');
  const newEntry = join(newExtensionRoot, 'dist', 'mcp-server.js');
  await mkdir(dirname(oldEntry), { recursive: true });
  await mkdir(dirname(newEntry), { recursive: true });
  await writeFile(oldEntry, '/* old MCP server */\n', 'utf8');
  await writeFile(newEntry, '/* fixed MCP server */\n', 'utf8');

  const server = {
    type: 'stdio',
    command: 'C:\\old-editor\\Code.exe',
    args: [oldEntry],
    cwd: oldExtensionRoot,
    env: {
      MICROI_API_URL: 'https://api.itdos.com',
      MICROI_OS_CLIENT: 'itdos',
      MICROI_TOKEN_FILE: join(root, 'token.json'),
    },
  };
  const configPath = join(root, '.mcp.json');
  const launch = await resolveItDosMcpLaunch(server, configPath);

  assert.equal(launch.command, process.execPath);
  assert.equal(launch.args[0], newEntry);
  assert.equal(launch.cwd, newExtensionRoot);
  assert.equal(launch.launchSource, 'newest-installed-extension');
});

test('官网资源通过 microi_itdos MCP 单入口读取完整内容', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-mcp-read-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extensionRoot = join(root, 'extensions', 'microi.v8-engine-1.0.0');
  const entry = join(extensionRoot, 'dist', 'mcp-server.js');
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, [
    "let buffer = '';",
    "process.stdin.setEncoding('utf8');",
    "function send(id, result) {",
    "  const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n', 'utf8');",
    "  const marker = payload.indexOf(Buffer.from('🧠', 'utf8'));",
    "  if (marker < 0) { process.stdout.write(payload); return; }",
    "  process.stdout.write(payload.subarray(0, marker + 1));",
    "  setTimeout(() => process.stdout.write(payload.subarray(marker + 1)), 1);",
    "}",
    "process.stdin.on('data', chunk => {",
    "  buffer += chunk;",
    "  let index;",
    "  while ((index = buffer.indexOf('\\n')) >= 0) {",
    "    const line = buffer.slice(0, index).trim();",
    "    buffer = buffer.slice(index + 1);",
    "    if (!line) continue;",
    "    const message = JSON.parse(line);",
    "    if (message.id == null) continue;",
    "    if (message.method === 'initialize') { send(message.id, { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake', version: '1' } }); continue; }",
    "    if (message.method === 'tools/list') { send(message.id, { tools: [{ name: 'microi_codex' }] }); continue; }",
    "    const name = message.params.arguments.params.params.Name;",
    "    const execution = { Result: { Code: 1, Data: { ResourceName: name, Content: 'ApiEngineKey: ai_app_publish_store | 🧠\\n', Sha256: 'a'.repeat(64) }, Msg: '' }, ConsoleOutput: [] };",
    "    send(message.id, { content: [{ type: 'text', text: '## Execution Result\\n- **Code**: 1\\n```json\\n' + JSON.stringify(execution, null, 2) + '\\n```' }] });",
    "  }",
    "});",
    '',
  ].join('\n'), 'utf8');
  const configPath = join(root, '.mcp.json');
  await writeFile(configPath, JSON.stringify({
    mcpServers: {
      microi_itdos: {
        type: 'stdio',
        command: 'old-editor',
        args: [entry],
        cwd: extensionRoot,
        env: { MICROI_API_URL: 'https://api.itdos.com', MICROI_OS_CLIENT: 'iTdos' },
      },
    },
  }), 'utf8');

  const readResult = await readResourcesViaConfiguredMcp(
    ['ai-app-publish-store.js'],
    { startDirectory: root, configPath },
  );
  assert.equal(readResult.configPath, configPath);
  assert.equal(
    readResult.resources.get('ai-app-publish-store.js').Content,
    'ApiEngineKey: ai_app_publish_store | 🧠\n',
  );
});

test('官网 MCP 发布器拒绝不含标准服务入口的启动参数', async t => {
  const root = await mkdtemp(join(tmpdir(), 'microi-mcp-missing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = join(root, '.mcp.json');
  const server = {
    type: 'stdio',
    command: 'missing-editor',
    args: [join(root, 'extensions', 'microi.v8-engine-9.9.9', 'dist', 'other-server.js')],
    env: { MICROI_API_URL: 'https://api.itdos.com', MICROI_OS_CLIENT: 'itdos' },
  };
  await assert.rejects(
    resolveItDosMcpLaunch(server, configPath),
    /args 中缺少 mcp-server\.js 或 microi-cli-mcp\.js/,
  );
});

test('官网发布接口以固定白名单、事务行锁和哈希保护多节点写入', () => {
  assert.match(officialEngineSource, /Version: v1\.3\.4/);
  assert.match(officialEngineSource, /V8\.Method\.AuthorizeOfficialResourcePublish\(\)/);
  assert.doesNotMatch(officialEngineSource, /Number\(currentUser\.Level/);
  assert.match(officialEngineSource, /function lockPublishRows\(\)/);
  assert.equal((officialEngineSource.match(/FOR UPDATE/g) || []).length, 3);
  assert.match(officialEngineSource, /ExpectedRemoteSha256/);
  assert.match(officialEngineSource, /发布升级资源\[" \+ name \+ "\]后回读内容哈希不一致/);
  assert.match(officialEngineSource, /商城版本[\s\S]*?与包内版本/);
  assert.match(officialEngineSource, /function validateOfficialApiEnginePolicies\(/);
  assert.match(officialEngineSource, /function validateTableClosure\(/);
  assert.match(officialEngineSource, /mci_ai_token_log[\s\S]*PromptPreview/);
  assert.match(officialEngineSource, /Sys_User\.AiApiKey|Sys_User\s*AiApiKey/);
  assert.match(officialEngineSource, /CreateIfMissing[\s\S]*return \{ Code : 1 \};/);
  assert.match(officialEngineSource, /OFFICIAL_RESOURCE_EXACT_SELECTION_V1/);
  assert.match(officialEngineSource, /SelectApiEngine:\s*selectionJson\(exactSelections\.SelectApiEngine\)/);
  assert.match(officialEngineSource, /SelectTable:\s*selectionJson\(exactSelections\.SelectTable\)/);
  assert.match(officialEngineSource, /storedSelectionEquals\([\s\S]*verified\.Data\.SelectApiEngine/);
  assert.match(officialEngineSource, /storedSelectionEquals\([\s\S]*verified\.Data\.SelectTable/);
});

test('官网控制面滚动升级同时保留当前 live 与候选版本能力标记', async () => {
  const source = await readFile(
    resolve(testDirectory, 'configure-platform-runtime-dependencies-resource.mjs'),
    'utf8',
  );
  assert.match(source, /ApiEngine:get-microi-upgrade-resource@v1\.3\.2/);
  assert.match(source, /ApiEngine:get-microi-upgrade-resource@v1\.3\.3/);
});

test('官网控制面变更时拆成自举与剩余资源两个 CAS 批次', () => {
  const changes = [
    { name: 'app.microi.store.json', content: 'package' },
    { name: 'official-resource-api.js', content: 'control-plane' },
    { name: 'app.microi.sys_user.json', content: 'users' },
  ];
  const batches = planOfficialResourcePublishBatches(changes);
  assert.deepEqual(batches.map(batch => batch.map(item => item.name)), [
    ['official-resource-api.js'],
    ['app.microi.store.json', 'app.microi.sys_user.json'],
  ]);
});

test('live 投影超时审计会重试旧源码摘要而不是只重试缺失接口', () => {
  assert.match(
    mcpPublisherSource,
    /if \(sourceHash === expectedHash \|\| attempt === 6\) return sourceHash/,
  );
});

test('官网资源回读后以独立第二次 RPC 投影 Managed 并保留 CreateIfMissing', async () => {
  const packageNames = [
    'app.microi.form-engine.json', 'app.microi.module-engine.json', 'app.microi.saas-engine.json',
    'app.microi.sso.json', 'app.microi.store.json', 'app.microi.sys_user.json',
    'app.microi.sys-config.json', 'app.microi.message-notification.json', 'app.microi.ai-engine.json',
  ];
  const seenKeys = new Set();
  let managedCount = 0;
  let createIfMissingCount = 0;
  for (const packageName of packageNames) {
    const packageModel = JSON.parse(await readFile(resolve(testDirectory, packageName), 'utf8'));
    for (const engine of packageModel.SysApiEngines || []) {
      const key = String(engine.ApiEngineKey || '').toLowerCase();
      assert.ok(key, `${packageName} 存在空 ApiEngineKey`);
      assert.equal(seenKeys.has(key), false, `${key} 跨包重复`);
      seenKeys.add(key);
      const policy = packageModel.ResourcePolicies?.ApiEngines?.[engine.ApiEngineKey]?.UpgradePolicy;
      if (policy === 'Managed') managedCount += 1;
      else if (policy === 'CreateIfMissing') createIfMissingCount += 1;
      else assert.fail(`${key} 缺少受支持的资源策略`);
    }
  }
  assert.equal(seenKeys.size, 148);
  assert.equal(managedCount, 139);
  assert.equal(createIfMissingCount, 9);

  assert.match(officialEngineSource, /action === "reconcilepublishedapiengines"/);
  assert.match(officialEngineSource, /function preparePublishedApiEngineProjection\(\)/);
  assert.match(officialEngineSource, /LOWER\(ApiEngineKey\)=LOWER\(@p0\)/);
  assert.match(officialEngineSource, /WHERE Id=@p0/);
  assert.match(officialEngineSource, /UPDATE sys_apiengine SET Id=@p0 WHERE Id=@p1/);
  assert.match(officialEngineSource, /"ApiName", "ApiEngineKey", "ApiAddress", "ApiRoutes"/);
  assert.match(officialEngineSource, /text\(expectedEngine\.ApiRoutes\)/);
  assert.doesNotMatch(officialEngineSource, /sys_apiengine[^\n]*(?:WHERE|SET)[^\n]*OsClient/);
  assert.match(officialEngineSource, /官方 Managed 接口稳定 Id 对齐失败/);
  assert.match(officialEngineSource, /plan\.Projection\.Policy === "CreateIfMissing" && plan\.Existing[\s\S]*TenantHookPreserved\+\+[\s\S]*continue/);
  assert.match(officialEngineSource, /projection\.Policy === "Managed"[\s\S]*ManagedUpdated\+\+/);
  assert.match(mcpPublisherSource, /export async function reconcilePublishedApiEnginesViaConfiguredMcp/);
  assert.match(mcpPublisherSource, /Action: 'ReconcilePublishedApiEngines'/);
  assert.match(mcpPublisherSource, /recoverReconcileAfterAmbiguousTimeout/);
  assert.match(mcpPublisherSource, /return match \? match\[1\]\.toLowerCase\(\) : null/);
  assert.match(mcpPublisherSource, /attempt <= 6/);
  assert.match(mcpPublisherSource, /只重查尚未出现的 Key/);
  assert.match(mcpPublisherSource, /未找到接口引擎\|NoExistData\|不存在的数据/);
  assert.match(mcpPublisherSource, /Math\.min\(3, managed\.length\)/);
  assert.match(mcpPublisherSource, /HTTP\\s\*524\|Origin Time-out/);
  assert.match(mcpPublisherSource, /'microi_get_table_data'/);
  assert.match(mcpPublisherSource, /'microi_get_engine_code'/);
  assert.match(mcpPublisherSource, /'ApiName', 'ApiEngineKey', 'ApiAddress', 'ApiRoutes'/);
  assert.match(mcpPublisherSource, /expected\.ApiRoutes/);
  assert.match(mcpPublisherSource, /Full source SHA-256/);
  assert.match(refreshSource, /apiEngines:\s*engines\.map/);
  assert.match(refreshSource, /524 后经 MCP 逐项回读确认事务已提交/);

  const readbackIndex = refreshSource.indexOf("const verifiedRemote = await downloadAllWithRetry('发布后回读')");
  const verifiedContentIndex = refreshSource.indexOf(
    'verifiedRemote.get(name).content !== mergedResources.get(name)',
    readbackIndex,
  );
  const reconcileIndex = refreshSource.indexOf('await reconcilePublishedApiEngines(verifiedRemote)');
  const baseAdvanceIndex = refreshSource.indexOf('await mkdir(baseDirectory', reconcileIndex);
  assert.ok(readbackIndex >= 0 && verifiedContentIndex > readbackIndex);
  assert.ok(reconcileIndex > verifiedContentIndex);
  assert.ok(baseAdvanceIndex > reconcileIndex);
  assert.match(refreshSource, /if \(publish\) \{[\s\S]*await reconcilePublishedApiEngines\(verifiedRemote\)/);

  const executablePrefix = officialEngineSource.slice(0, officialEngineSource.indexOf('var action ='));
  const helpers = new Function(
    'V8',
    `${executablePrefix}\nreturn { buildLiveApiEngineModel, liveManagedEngineEquals };`,
  )({ Param: {} });
  const expected = helpers.buildLiveApiEngineModel({
    Id: 'source-id',
    Name: '历史名称字段',
    ApiEngineKey: 'test-managed',
    ApiAddress: '/apiengine/test-managed',
    ApiV8Code: '/* ApiEngineKey: test-managed | Version: v1.0.0 */\nreturn { Code: 1 };',
  }, 'live-id');
  assert.equal(expected.Id, 'live-id');
  assert.equal(expected.ApiName, '历史名称字段');
  assert.equal(expected.LockKey, '');
  assert.equal(expected.ResponseFile, 0);
  assert.equal(expected.V8Limit, 0);
  assert.equal(expected.V8Unlimited, 0);
  assert.equal(expected.Version, 'v1.0.0');
  assert.equal(helpers.buildLiveApiEngineModel({ ...expected, LockKey: 'tenant-lock' }, 'live-id').LockKey, 'tenant-lock');
  assert.equal(helpers.liveManagedEngineEquals({ ...expected, ResponseFile: 1 }, expected), false);
  assert.equal(helpers.liveManagedEngineEquals({ ...expected, LockKey: 'tenant-lock' }, expected), false);
  assert.equal(helpers.liveManagedEngineEquals({ ...expected, Id: 'different-id' }, expected), false);
  assert.equal(helpers.liveManagedEngineEquals(expected, expected), true);
});

test('官网发布选择元数据精确来自已验证包并拒绝旧 Key 或旧表残留', async () => {
  const executablePrefix = officialEngineSource.slice(0, officialEngineSource.indexOf('var action ='));
  const helpers = new Function(
    'V8',
    `${executablePrefix}\nreturn { exactPackageSelections, storedSelectionEquals };`,
  )({ Param: {} });
  const packageModel = JSON.parse(await readFile(resolve(testDirectory, 'app.microi.sys_user.json'), 'utf8'));
  const expected = helpers.exactPackageSelections(packageModel, 'app.microi.sys_user.json');

  assert.deepEqual(
    expected.SelectApiEngine.map(item => Object.keys(item)),
    expected.SelectApiEngine.map(() => ['Id', 'ApiName', 'ApiEngineKey']),
  );
  assert.deepEqual(
    expected.SelectApiEngine.map(item => item.ApiEngineKey),
    packageModel.SysApiEngines.map(item => item.ApiEngineKey),
  );
  assert.deepEqual(
    expected.SelectTable.map(item => Object.keys(item)),
    expected.SelectTable.map(() => ['Id', 'Name']),
  );
  assert.equal(helpers.storedSelectionEquals(JSON.stringify(expected.SelectApiEngine), expected.SelectApiEngine), true);
  assert.equal(helpers.storedSelectionEquals(JSON.stringify([
    ...expected.SelectApiEngine,
    { Id: 'stale-id', ApiName: '旧接口', ApiEngineKey: 'removed-old-key' },
  ]), expected.SelectApiEngine), false);
  assert.equal(helpers.storedSelectionEquals(JSON.stringify([
    ...expected.SelectTable,
    { Id: 'stale-table-id', Name: 'removed_old_table' },
  ]), expected.SelectTable), false);
});

test('官网发布接口接受当前九个官方应用包并拒绝 AI schema 缺口', async () => {
  const executablePrefix = officialEngineSource.slice(0, officialEngineSource.indexOf('var action ='));
  const validatePublishResource = new Function(
    'V8',
    `${executablePrefix}\nreturn validatePublishResource;`,
  )({ Param: {} });
  const packageNames = [
    'app.microi.form-engine.json', 'app.microi.module-engine.json', 'app.microi.saas-engine.json',
    'app.microi.sso.json', 'app.microi.store.json', 'app.microi.sys_user.json',
    'app.microi.sys-config.json', 'app.microi.message-notification.json', 'app.microi.ai-engine.json',
  ];
  for (const packageName of packageNames) {
    const content = await readFile(resolve(testDirectory, packageName), 'utf8');
    assert.doesNotThrow(() => validatePublishResource(packageName, content), packageName);
  }

  const ai = JSON.parse(await readFile(resolve(testDirectory, 'app.microi.ai-engine.json'), 'utf8'));
  ai.PhysicalColumns = ai.PhysicalColumns.filter((column) => (
    String(column.TABLE_NAME).toLowerCase() !== 'mci_ai_token_log'
    || String(column.COLUMN_NAME).toLowerCase() !== 'promptpreview'
  ));
  assert.throws(
    () => validatePublishResource('app.microi.ai-engine.json', JSON.stringify(ai)),
    /PromptPreview|PackageInfo 计数/,
  );

  const sysUser = JSON.parse(await readFile(resolve(testDirectory, 'app.microi.sys_user.json'), 'utf8'));
  const oldSysUser = structuredClone(sysUser);
  oldSysUser.PackageInfo.Version = 'v6.3.1';
  assert.throws(
    () => validatePublishResource('app.microi.sys_user.json', JSON.stringify(oldSysUser)),
    /v6\.3\.2|Managed v1\.0\.2/,
  );

  const oldAdmin = structuredClone(sysUser);
  oldAdmin.SysApiEngines.find(item => item.ApiEngineKey === 'platform-sys-user-admin').Version = 'v1.0.1';
  assert.throws(
    () => validatePublishResource('app.microi.sys_user.json', JSON.stringify(oldAdmin)),
    /Managed v1\.0\.2/,
  );

  const missingPasswordMarker = structuredClone(sysUser);
  const markerAdmin = missingPasswordMarker.SysApiEngines
    .find(item => item.ApiEngineKey === 'platform-sys-user-admin');
  markerAdmin.ApiV8Code = markerAdmin.ApiV8Code
    .replace('authorization.DataAppend.ChangesPassword === true', 'false');
  assert.throws(
    () => validatePublishResource('app.microi.sys_user.json', JSON.stringify(missingPasswordMarker)),
    /Managed v1\.0\.2/,
  );

  const saas = JSON.parse(await readFile(resolve(testDirectory, 'app.microi.saas-engine.json'), 'utf8'));
  const microiInit = saas.SysApiEngines.find(item => item.ApiEngineKey === 'microi-init');
  microiInit.ApiV8Code = microiInit.ApiV8Code.replace('GetLegacyInitMenuTree(rawToken, osClient)', 'GetTableDataTree()');
  assert.throws(
    () => validatePublishResource('app.microi.saas-engine.json', JSON.stringify(saas)),
    /microi-init/,
  );
});
