import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 统一门禁按唯一版本化契约读取应用事实源，不扫描相似目录，也不把远端镜像择新。
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const contract = JSON.parse(await readFile(new URL('./event-lottery-release.json', import.meta.url), 'utf8'));
assert.equal(contract.SchemaVersion, 1);
assert.equal(contract.AppKey, 'event-lottery-studio');
const source = path.resolve(workspace, contract.SourceRoot);
const sourceRelative = path.relative(workspace, source);
assert.ok(sourceRelative && !sourceRelative.startsWith('..') && !path.isAbsolute(sourceRelative), '应用源码必须位于契约指定的工作区内');
const behavior = path.resolve(source, contract.BehaviorTest);
const testRelative = path.relative(source, behavior);
assert.ok(testRelative && !testRelative.startsWith('..') && !path.isAbsolute(testRelative));
assert.ok((await stat(behavior)).isFile(), '统一门禁必须执行真实 V8 行为测试');
await import(pathToFileURL(behavior).href);
for (const relativeFile of contract.DeliveryTests) {
  const file = path.resolve(source, relativeFile);
  const applicationRelative = path.relative(path.dirname(source), file);
  assert.ok(applicationRelative && !applicationRelative.startsWith('..') && !path.isAbsolute(applicationRelative));
  await import(pathToFileURL(file).href);
}
