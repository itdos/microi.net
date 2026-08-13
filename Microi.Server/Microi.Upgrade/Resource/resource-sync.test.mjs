import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeResource,
  isTemporaryOfficialResourceFailure,
  mergeJavascriptResource,
  mergeJsonResource,
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

function applicationStorePackage({
  importer,
  publisher,
  builder,
  bulk = defaultBulkImporter,
  preparer = defaultAssetPreparer,
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
  preparer = defaultAssetPreparer,
}) {
  return new Map([
    ['import-package.js', importer],
    ['bulk-import-packages.js', bulk],
    ['ai-app-publish-store.js', publisher],
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
  const establishedReplicas = new Map([
    ['import-package.js', importer],
    ['ai-app-publish-store.js', publisher],
    ['ai-app-prepare-store-assets.js', defaultAssetPreparer],
    ['ai-app-build.js', builder],
  ]);

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

test('官网临时故障识别只放行网络、限流和服务端错误', () => {
  assert.equal(isTemporaryOfficialResourceFailure(new Error('服务器内部错误，请稍后重试。')), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('import-package.js HTTP 503')), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('fetch failed', { cause: { code: 'ECONNRESET' } })), true);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('import-package.js HTTP 401')), false);
  assert.equal(isTemporaryOfficialResourceFailure(new Error('资源名不正确')), false);
});

test('离线发布仅允许七项本地资源与共同基线完全一致', () => {
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
  assert.match(officialEngineSource, /function lockPublishRows\(\)/);
  assert.equal((officialEngineSource.match(/FOR UPDATE/g) || []).length, 2);
  assert.match(officialEngineSource, /ExpectedRemoteSha256/);
  assert.match(officialEngineSource, /发布升级资源\[" \+ name \+ "\]后回读内容哈希不一致/);
  assert.match(officialEngineSource, /商城版本[\s\S]*?与包内版本/);
});
