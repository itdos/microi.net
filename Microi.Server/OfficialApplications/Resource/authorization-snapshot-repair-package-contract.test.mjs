import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readPackage = fileName => JSON.parse(fs.readFileSync(
  new URL(`./${fileName}`, import.meta.url),
  'utf8',
));
const saasPackage = readPackage('app.microi.saas-engine.json');
const storePackage = readPackage('app.microi.store.json');
const capability = 'ClientFeature:AuthorizationSnapshotBootstrapRepairV1';

test('SaaS package declares the platform authorization-snapshot repair boundary', () => {
  const info = saasPackage.PackageInfo;
  assert.equal(info.ChangeLog.Version, info.Version);
  assert.equal(info.RequiredPlatformCapabilities.filter(item => item === capability).length, 1);
  const authorizationRepairHistory = String(info.ChangeHistory || '')
    .split(/\r?\n/)
    .find(line => /^2026-09-01 v7\.7\.18\s/.test(line));
  assert.ok(authorizationRepairHistory, '缺少 v7.7.18 权限快照自愈历史');
  assert.match(authorizationRepairHistory, /Microi v7\.8\.1/);
  assert.match(authorizationRepairHistory, /登录\/续签/);
  assert.match(authorizationRepairHistory, /失败不覆盖缓存/);
  assert.match(authorizationRepairHistory, /无需重新登录/);
  assert.match(authorizationRepairHistory, /\{\{ YYYY \}\}/);
  assert.match(authorizationRepairHistory, /不携带 Sys_Config 租户数据/);
  assert.deepEqual(saasPackage.ResourcePolicies.ApiEngines['platform-current-user'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
});

test('authorization repair remains owned by SaaS rather than the marketplace package', () => {
  assert.equal(storePackage.PackageInfo.ChangeLog.Version, storePackage.PackageInfo.Version);
  assert.equal(
    (storePackage.PackageInfo.RequiredPlatformCapabilities || []).includes(capability),
    false,
  );
});
