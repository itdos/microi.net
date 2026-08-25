import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialApiEnginePolicies } from './official-api-engine-notice.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
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

function readPackage(name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
}

test('all official application ApiEngines declare policy and carry an overwrite notice', () => {
  for (const packageName of packageNames) {
    const packageModel = readPackage(packageName);
    const policies = packageModel.ResourcePolicies?.ApiEngines || {};
    for (const engine of packageModel.SysApiEngines || []) {
      const policy = policies[engine.ApiEngineKey];
      assert.ok(policy, `${packageName}:${engine.ApiEngineKey} missing ResourcePolicies.ApiEngines`);
      assert.ok(['Managed', 'CreateIfMissing'].includes(policy.UpgradePolicy));
      assert.equal(
        policy.Ownership,
        policy.UpgradePolicy === 'CreateIfMissing' ? 'Tenant' : 'Platform',
        `${packageName}:${engine.ApiEngineKey} has non-canonical official ownership`,
      );
      const source = String(engine.ApiV8Code || '');
      if (policy.UpgradePolicy === 'CreateIfMissing') {
        assert.match(source, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
        assert.match(source, /官方升级不会覆盖/);
      } else {
        assert.match(source, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
        assert.match(source, /禁止直接承载个性化代码/);
        assert.match(source, new RegExp(String(packageModel.PackageInfo.Name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }
    assert.equal(
      Object.keys(policies).length,
      (packageModel.SysApiEngines || []).length,
      `${packageName} should not have missing or orphan engine policies`,
    );
  }
});

test('platform runtime facades are Managed and only authenticated facades call the tenant-owned hook', () => {
  const packageModel = readPackage('app.microi.saas-engine.json');
  const managedKeys = [
    'platform-os-client-by-domain',
    'platform-sys-config',
    'platform-service-health',
    'platform-lang-bundle',
    'platform-current-user',
    'platform-private-file-url',
    'platform-sys-user-public-info',
    'platform-login-wallpapers',
    'microi-init',
    'platform-create-tenant',
    'platform-external-login-binding',
    'platform-wechat-user-binding',
  ];
  const anonymousKeys = new Set([
    'platform-os-client-by-domain',
    'platform-sys-config',
    'platform-service-health',
    'platform-lang-bundle',
    'platform-login-wallpapers',
    'microi-init',
  ]);
  for (const key of managedKeys) {
    const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === key);
    assert.ok(engine, `missing ${key}`);
    assert.deepEqual(packageModel.ResourcePolicies.ApiEngines[key], {
      Ownership: 'Platform',
      UpgradePolicy: 'Managed',
    });
    if (anonymousKeys.has(key)) {
      assert.doesNotMatch(engine.ApiV8Code, /V8\.ApiEngine\.Run\('platform-runtime-custom-hook'/);
    } else {
      assert.match(engine.ApiV8Code, /V8\.ApiEngine\.Run\('platform-runtime-custom-hook'/);
    }
  }
  const hook = packageModel.SysApiEngines.find(
    item => item.ApiEngineKey === 'platform-runtime-custom-hook',
  );
  assert.ok(hook);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines[hook.ApiEngineKey], {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  });
  assert.match(hook.ApiV8Code, /return \{ Code : 1 \};\s*$/);
});

test('anonymous platform bootstrap facades remain minimal and public', () => {
  const packageModel = readPackage('app.microi.saas-engine.json');
  for (const key of [
    'platform-os-client-by-domain',
    'platform-sys-config',
    'platform-service-health',
    'platform-lang-bundle',
    'microi-init',
  ]) {
    const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === key);
    assert.equal(engine.AllowAnonymous, 1, `${key} must stay anonymous`);
    assert.equal(engine.StopHttp, 0, `${key} must stay callable by official clients`);
  }
});

test('notice normalization preserves Managed compatibility hashes', () => {
  const packageModel = {
    PackageInfo: { Name: '测试官方应用' },
    ResourcePolicies: {
      SchemaVersion: 1,
      ApiEngines: {
        test_engine: {
          Ownership: 'Platform',
          UpgradePolicy: 'Managed',
          BaseHash: 'base-hash',
          CompatibleBaseHashes: ['compatible-hash'],
        },
      },
    },
    SysApiEngines: [{ ApiEngineKey: 'test_engine', ApiV8Code: 'return { Code: 1 };' }],
  };
  normalizeOfficialApiEnginePolicies(packageModel, 'test.json');
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines.test_engine, {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
    BaseHash: 'base-hash',
    CompatibleBaseHashes: ['compatible-hash'],
  });
});

test('embedded Platform packages canonicalize legacy Application ownership before Upgrade13 replay', () => {
  const packageModel = {
    PackageInfo: { Name: '测试平台应用', ApplicationType: 'Platform' },
    ResourcePolicies: {
      SchemaVersion: 1,
      ApiEngines: {
        core: { Ownership: 'Application', UpgradePolicy: 'Managed' },
        hook: { Ownership: 'Tenant', UpgradePolicy: 'CreateIfMissing' },
      },
    },
    SysApiEngines: [
      { ApiEngineKey: 'core', ApiV8Code: 'return { Code: 1 };' },
      { ApiEngineKey: 'hook', ApiV8Code: 'return { Code : 1 };' },
    ],
  };
  normalizeOfficialApiEnginePolicies(packageModel, 'platform.json');
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines.core, {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines.hook, {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  });
});
