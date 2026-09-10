import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeResource } from './resource-sync-core.mjs';
import { synchronizeApplicationStoreEngines, publishedApplicationStoreReplicaMappings } from './application-store-replica-sync.mjs';

test('官方资源控制面与发布的独立源码保持相同字节，消除 CRLF 和末尾空行造成的投影失败', () => {
  const name = 'official-resource-api.js';
  const source = '/* Version: v1.3.9 */\r\nreturn { Code: 1 };\r\n\r\n';
  const canonical = canonicalizeResource(name, source);
  const model = { PackageInfo: { Version: 'v1.0.0' }, SysApiEngines: [{ ApiEngineKey: 'get-microi-upgrade-resource', Version: 'v1.3.9', ApiV8Code: source }], SysMenus: [] };
  const result = synchronizeApplicationStoreEngines(JSON.stringify(model), new Map([[name, source]]));
  assert.equal(JSON.parse(result).SysApiEngines[0].ApiV8Code, canonical);
  assert.ok(publishedApplicationStoreReplicaMappings.some(item => item.resourceName === name));
  assert.equal(synchronizeApplicationStoreEngines(result, new Map([[name, canonical]])), result);
});
