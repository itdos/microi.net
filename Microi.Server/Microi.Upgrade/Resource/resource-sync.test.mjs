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

const testDirectory = dirname(fileURLToPath(import.meta.url));
const refreshSource = await readFile(resolve(testDirectory, 'refresh-resources.mjs'), 'utf8');
const releaseSource = await readFile(resolve(testDirectory, '../../../Microi一键编译发布.sh'), 'utf8');
const officialEngineSource = await readFile(resolve(testDirectory, 'official-resource-api.js'), 'utf8');

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
  assert.match(refreshSource, /PackageInfo\.Version，避免商城自动版本与包内版本不一致/);
  assert.match(refreshSource, /未写入官网、未修改本地资源、未推进共同基线/);
});

test('官网发布接口以固定白名单、事务行锁和哈希保护多节点写入', () => {
  assert.match(officialEngineSource, /function lockPublishRows\(\)/);
  assert.equal((officialEngineSource.match(/FOR UPDATE/g) || []).length, 2);
  assert.match(officialEngineSource, /ExpectedRemoteSha256/);
  assert.match(officialEngineSource, /发布升级资源\[" \+ name \+ "\]后回读内容哈希不一致/);
  assert.match(officialEngineSource, /商城版本[\s\S]*?与包内版本/);
});
