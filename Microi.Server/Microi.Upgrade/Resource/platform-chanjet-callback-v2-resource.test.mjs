import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageModel = JSON.parse(fs.readFileSync(
  path.join(currentDir, 'app.microi.saas-engine.json'),
  'utf8'));
const managedSource = fs.readFileSync(
  path.join(currentDir, 'platform-chanjet-callback-v2.js'),
  'utf8');
const hookSource = fs.readFileSync(
  path.join(currentDir, 'platform-chanjet-callback-v2-hook.js'),
  'utf8');

function engine(key) {
  return packageModel.SysApiEngines.find(item => item.ApiEngineKey === key);
}

test('Chanjet V2 callback is an internal Managed engine with a tenant hook', () => {
  const managed = engine('platform-chanjet-callback-v2');
  const hook = engine('platform-chanjet-callback-v2-hook');
  assert.ok(managed);
  assert.ok(hook);
  assert.equal(managed.StopHttp, 1);
  assert.equal(managed.AllowAnonymous, 0);
  assert.equal(managed.EnableLog, 0);
  assert.equal(managed.Version, 'v1.0.0');
  assert.equal(hook.StopHttp, 1);
  assert.equal(hook.AllowAnonymous, 0);
  assert.equal(managed.ApiV8Code, managedSource);
  assert.equal(hook.ApiV8Code, hookSource);
  assert.match(managedSource, /RequireManagedProtocolContext\(\)/);
  assert.match(managedSource, /platform-chanjet-callback-v2-hook/);
  assert.match(hookSource, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.equal(hookSource.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim(), 'return { Code : 1 };');
});

test('Chanjet callback resource policies prevent managed drift and preserve tenant code', () => {
  assert.deepEqual(
    packageModel.ResourcePolicies.ApiEngines['platform-chanjet-callback-v2'],
    { Ownership: 'Platform', UpgradePolicy: 'Managed' });
  assert.deepEqual(
    packageModel.ResourcePolicies.ApiEngines['platform-chanjet-callback-v2-hook'],
    { Ownership: 'Tenant', UpgradePolicy: 'CreateIfMissing' });
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    'ApiEngine:platform-chanjet-callback-v2@v1.0.0'));
});
