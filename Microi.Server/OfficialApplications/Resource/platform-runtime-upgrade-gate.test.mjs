import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const packageUrl = new URL('./app.microi.saas-engine.json', import.meta.url);
const upgradeUrl = new URL('../../Microi.Upgrade/13-UpgradeAppStore.cs', import.meta.url);
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
  'mci-system-observability-action',
  'platform-data-source-run',
  'platform-module-data',
  'platform-ocr-recognize',
  'platform-office-export-word-by-template',
  'platform-translate-runtime',
  'platform-user-behavior-signal',
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
  assert.ok(
    version[0] > 7
      || (version[0] === 7 && version[1] > 6)
      || (version[0] === 7 && version[1] === 7 && version[2] >= 1),
    `controller slimming package must be at least v7.7.1, got ${packageModel.PackageInfo.Version}`,
  );

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

test('upgrade gate installs only the recovery package and reads back its dependencies', async () => {
  const source = await readFile(upgradeUrl, 'utf8');
  assert.match(source, /public const string Version = "7\.6\.15\.0"/);
  assert.match(source, /RequiredResourceNames = \{ ImportPackageResourceName, BootstrapPackageResourceName \}/);
  const install = source.indexOf('await InstallUpgradePackage(osClient, errors, BootstrapPackageResourceName');
  const readback = source.indexOf('dependencies = await EnsureStartupDependenciesUnderLeaseAsync(client)', install);
  assert.ok(install >= 0 && readback > install);
  assert.doesNotMatch(source, /InstallUpgradePackage[^\n]*(?:SaaS|Sso|AiEngine|MessageNotification)PackageResourceName/);
});

test('startup recovery preserves existing tenant hooks including disabled and soft-deleted records', async () => {
  const source = await readFile(upgradeUrl, 'utf8');
  const method = source.slice(source.indexOf('private static string GetStartupDependencyContractError'), source.indexOf('private static bool HasNewerManagedVersion'));
  assert.match(method, /if \(IsCreateIfMissingRuntimeDependency\(source\)\) return string\.Empty/);
  assert.ok(method.indexOf('IsCreateIfMissingRuntimeDependency(source)') < method.indexOf('row["IsDeleted"]'));
  assert.match(source, /LOWER\(\{apiEngineKey\}\)=LOWER\(@p0\)/);
  assert.doesNotMatch(source, /GetInstalledSsoRuntimeRepairReason/);
});
