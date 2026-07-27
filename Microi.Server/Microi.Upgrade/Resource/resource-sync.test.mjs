import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeResource,
  isTemporaryOfficialResourceFailure,
  mergeJavascriptResource,
  mergeJsonResource,
  verifyOfflineReleaseSafety,
} from './resource-sync-core.mjs';
import {
  assertApplicationStoreEnginesSynchronized,
  choosePublishablePackageVersion,
  getEmbeddedEngineSource,
  mergeApplicationStoreReplicas,
} from './application-store-replica-sync.mjs';
import { validateItDosMcpServer } from './mcp-resource-publisher.mjs';

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

function applicationStorePackage({ importer, publisher, builder, version = 'v6.6.1' }) {
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
        Id: 'engine-builder',
        ApiEngineKey: 'ai_app_build',
        Version: engineVersion(builder),
        ApiV8Code: builder,
        StopHttp: 0,
      },
    ],
  });
}

function replicaMaps({ importer, publisher, builder }) {
  return new Map([
    ['import-package.js', importer],
    ['ai-app-publish-store.js', publisher],
    ['ai-app-build.js', builder],
  ]);
}

async function mergeReplicaFixture({
  baseImporter,
  basePublisher,
  baseBuilder,
  localImporter = baseImporter,
  localPublisher = basePublisher,
  localBuilder = baseBuilder,
  localEmbeddedPublisher = localPublisher,
  localEmbeddedBuilder = localBuilder,
  remoteImporter = baseImporter,
  remotePublisher = basePublisher,
  remoteEmbeddedPublisher = remotePublisher,
  remoteEmbeddedBuilder = baseBuilder,
}) {
  return mergeApplicationStoreReplicas({
    basePackageContent: applicationStorePackage({
      importer: baseImporter,
      publisher: basePublisher,
      builder: baseBuilder,
    }),
    localPackageContent: applicationStorePackage({
      importer: localImporter,
      publisher: localEmbeddedPublisher,
      builder: localEmbeddedBuilder,
    }),
    remotePackageContent: applicationStorePackage({
      importer: remoteImporter,
      publisher: remoteEmbeddedPublisher,
      builder: remoteEmbeddedBuilder,
    }),
    baseStandaloneContents: replicaMaps({
      importer: baseImporter,
      publisher: basePublisher,
      builder: baseBuilder,
    }),
    localStandaloneContents: replicaMaps({
      importer: localImporter,
      publisher: localPublisher,
      builder: localBuilder,
    }),
    remoteStandaloneContents: replicaMaps({
      importer: remoteImporter,
      publisher: remotePublisher,
      builder: remoteEmbeddedBuilder,
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

test('应用商城逻辑副本仍阻止同一代码行被本地和官网改成不同实现', async () => {
  const importer = engineSource('import-microi-store-package', 'v1.0.0', 'return { Code: 1 };');
  const builder = engineSource('ai_app_build', 'v1.0.0', 'return { Code: 1 };');
  const basePublisher = engineSource('ai_app_publish_store', 'v1.5.3', 'var value = 1;\nreturn value;');
  const localPublisher = basePublisher.replace('var value = 1;', 'var value = 2;');
  const remotePublisher = basePublisher.replace('var value = 1;', 'var value = 3;');

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

test('商城包写回时可使用更高的当前发布版本自动推进 PackageInfo.Version', () => {
  assert.equal(choosePublishablePackageVersion('v6.6.1', 'v6.6.1', '6.7.4'), 'v6.7.4');
  assert.equal(choosePublishablePackageVersion('v6.7.5', 'v6.6.1', '6.7.4'), 'v6.7.5');
  assert.equal(choosePublishablePackageVersion('v6.6.1', 'v6.7.4', '6.7.4'), null);
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

test('离线发布仅允许六项本地资源与共同基线完全一致', () => {
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
  assert.match(refreshSource, /当前发布版本[\s\S]*?均未高于官网/);
  assert.match(refreshSource, /未写入官网、未修改本地资源、未推进共同基线/);
  assert.match(refreshSource, /publishResourcesViaConfiguredMcp/);
  assert.match(refreshSource, /MICROI_UPGRADE_RESOURCE_TOKEN/);
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

test('官网发布接口以固定白名单、事务行锁和哈希保护多节点写入', () => {
  assert.match(officialEngineSource, /function lockPublishRows\(\)/);
  assert.equal((officialEngineSource.match(/FOR UPDATE/g) || []).length, 2);
  assert.match(officialEngineSource, /ExpectedRemoteSha256/);
  assert.match(officialEngineSource, /发布升级资源\[" \+ name \+ "\]后回读内容哈希不一致/);
  assert.match(officialEngineSource, /商城版本[\s\S]*?与包内版本/);
});
