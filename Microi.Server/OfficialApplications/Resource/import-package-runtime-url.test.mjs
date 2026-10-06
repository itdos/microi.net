import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
function resolve(mode, url, key = 'sample-app', entry = 'index.html') {
  const body = source.match(/var resolveInstalledMicroServiceUrl = function[\s\S]*?\n    \};/);
  assert.ok(body, '跨租户安装必须重新生成受托管运行时入口');
  const context = { V8: { OsClient: 'target-tenant' } };
  vm.runInNewContext(body[0], context);
  return context.resolveInstalledMicroServiceUrl(mode, url, key, entry);
}
for (const mode of ['file', 'hdfs', 'oss', 'cdn', 'object', 'objectstorage']) {
  test(`installed ${mode} runtime uses the target tenant and app key`, () => {
    const expected = '/micro-app/target-tenant/sample-app/index.html';
    assert.equal(resolve(mode, '/micro-app/source-tenant/old-app/index.html'), expected);
    assert.equal(resolve(mode, expected), expected);
    assert.equal(resolve(mode, 'https://source.example/old.html'), expected);
  });
}
test('database and explicitly external runtimes retain their storage contracts', () => {
  assert.equal(resolve('database', '/micro-app/source/x/index.html'), 'db');
  assert.equal(resolve('db', 'old'), 'db');
  assert.equal(resolve('external', 'https://external.example/app'), 'https://external.example/app');
  assert.equal(resolve('file', '', 'app space', 'pages/main view.html'), '/micro-app/target-tenant/app%20space/pages/main%20view.html');
  assert.match(source, /MsUrl:\s*resolveInstalledMicroServiceUrl\(runtimeStorageMode, ms\.MsUrl, appKey, entryPath\)/);
});
