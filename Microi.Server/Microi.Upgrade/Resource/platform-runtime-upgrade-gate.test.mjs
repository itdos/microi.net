import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const packageUrl = new URL('./app.microi.saas-engine.json', import.meta.url);
const upgradeUrl = new URL('../13-UpgradeAppStore.cs', import.meta.url);
const requiredKeys = [
  'platform-runtime-custom-hook',
  'platform-os-client-by-domain',
  'platform-sys-config',
  'platform-service-health',
  'platform-lang-bundle',
  'platform-current-user',
  'platform-private-file-url',
  'platform-sys-user-public-info',
  'platform-login-wallpapers',
  'microi-init',
];

test('SaaS package carries the complete platform runtime upgrade set', async () => {
  const packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
  const version = packageModel.PackageInfo.Version.replace(/^v/i, '').split('.').map(Number);
  assert.ok(
    version[0] > 7
      || (version[0] === 7 && version[1] > 5)
      || (version[0] === 7 && version[1] === 5 && version[2] >= 46),
    `SaaS package must be at least v7.5.46, got ${packageModel.PackageInfo.Version}`,
  );
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);

  for (const key of requiredKeys) {
    const engines = packageModel.SysApiEngines.filter(item => item.ApiEngineKey === key);
    assert.equal(engines.length, 1, `${key} must appear exactly once`);
    assert.ok(
      packageModel.PackageInfo.RequiredPlatformCapabilities.includes(`ApiEngine:${key}`),
      `${key} must be declared as a platform capability`,
    );
    assert.equal(engines[0].IsEnable, 1);

    const policy = packageModel.ResourcePolicies.ApiEngines[key];
    if (key === 'platform-runtime-custom-hook') {
      assert.equal(engines[0].StopHttp, 1);
      assert.equal(policy.Ownership, 'Tenant');
      assert.equal(policy.UpgradePolicy, 'CreateIfMissing');
    } else {
      assert.equal(engines[0].StopHttp, 0);
      assert.equal(policy.UpgradePolicy, 'Managed');
    }
  }
});

test('upgrade gate checks old tenants, validates the package, and reads back after SaaS install', async () => {
  const source = await readFile(upgradeUrl, 'utf8');
  const versionMatch = source.match(/public static string Version = "(\d+)\.(\d+)\.(\d+)\.(\d+)"/);
  assert.ok(versionMatch, 'upgrade version must be declared');
  const version = versionMatch.slice(1).map(Number);
  assert.ok(
    version[0] > 6
      || (version[0] === 6 && version[1] > 4)
      || (version[0] === 6 && version[1] === 4 && version[2] >= 10),
    `upgrade version must be at least 6.4.10.0, got ${version.join('.')}`,
  );

  const needRefresh = source.slice(
    source.indexOf('public static Task<bool> NeedRefreshAsync'),
    source.indexOf('private static bool HasRows'),
  );
  assert.match(needRefresh, /GetInstalledPlatformRuntimeRepairReason\(client\.Db\)/);
  assert.match(source, /if \(!HasPackagedPlatformRuntime\(package\)\)/);

  const saasInstall = source.indexOf(
    'InstallUpgradePackage(osClient, msgs, SaaSEnginePackageResourceName',
  );
  const readback = source.indexOf(
    'ValidateInstalledPlatformRuntimeDependencies(osClient, msgs)',
    saasInstall,
  );
  assert.ok(saasInstall >= 0 && readback > saasInstall, 'SaaS install must be followed by runtime readback');
});

test('installed tenant hook gate checks existence only', async () => {
  const source = await readFile(upgradeUrl, 'utf8');
  const method = source.slice(
    source.indexOf('private static bool HasExpectedPlatformRuntimeEngineContract'),
    source.indexOf('private static bool HasPackagedPlatformRuntime'),
  );
  const hookBranch = method.slice(
    method.indexOf('if (string.Equals(key, PlatformRuntimeCustomHookEngineKey'),
    method.indexOf('if (!ManagedPlatformRuntimeEngineKeys.Contains'),
  );

  assert.match(hookBranch, /if \(!validateTenantTemplate\) return true/);

  const installedReadback = source.slice(
    source.indexOf('private static string GetInstalledPlatformRuntimeRepairReason'),
    source.indexOf('private static string GetInstalledSsoRuntimeRepairReason'),
  );
  assert.match(installedReadback, /validateTenantTemplate:\s*false/);
  assert.match(installedReadback, /LOWER\(ApiEngineKey\)=LOWER\(@p0\)/);
  const platformHookContinue = installedReadback.indexOf('if (isTenantHook) continue;');
  const platformContractCheck = installedReadback.indexOf(
    'HasExpectedPlatformRuntimeEngineContract(engine, validateTenantTemplate: false)',
  );
  assert.ok(
    platformHookContinue >= 0 && platformHookContinue < platformContractCheck,
    'case-variant platform hook must satisfy installed existence gate before exact Managed checks',
  );
  assert.doesNotMatch(installedReadback, /必须存在、启用|保持 StopHttp/);

  const installedSsoReadback = source.slice(
    source.indexOf('private static string GetInstalledSsoRuntimeRepairReason'),
    source.indexOf('private static string GetMarketplaceRuntimeRepairReason'),
  );
  const installedHookBranch = installedSsoReadback.slice(
    installedSsoReadback.indexOf('if (string.Equals(key, "sso_event_hook"'),
    installedSsoReadback.indexOf('if (!HasExpectedSsoEngineContract'),
  );
  assert.match(installedHookBranch, /continue;/);
  assert.doesNotMatch(installedHookBranch, /IsEnable|StopHttp|AllowAnonymous|ApiV8Code|Version/);
  assert.match(installedSsoReadback, /LOWER\(ApiEngineKey\)=LOWER\(@p0\)/);
});
