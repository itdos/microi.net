import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const directory = new URL('./', import.meta.url);
const packageModel = JSON.parse(await readFile(new URL('app.microi.store.json', directory), 'utf8'));
const importer = await readFile(new URL('import-package.js', directory), 'utf8');
const storeList = await readFile(new URL('get-microi-store-list.js', directory), 'utf8');
const engines = new Map((packageModel.SysApiEngines || []).map(engine => [engine.ApiEngineKey, engine]));
const normalize = value => `${String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;

test('application-store package embeds package-aware installation and immediate menu availability', () => {
  assert.match(packageModel.PackageInfo.Version, /^v7\.9\.\d+$/);
  assert.equal(packageModel.PackageInfo.ChangeLog?.Version, packageModel.PackageInfo.Version);
  assert.ok(String(packageModel.PackageInfo.ChangeLog?.Title || '').trim());
  assert.ok(String(packageModel.PackageInfo.ChangeLog?.Content || '').trim());

  const importerEngine = engines.get('import-microi-store-package');
  const listEngine = engines.get('get-microi-store');
  assert.equal(importerEngine?.Version, 'v2.7.4');
  assert.equal(listEngine?.Version, 'v1.5.0');
  assert.equal(normalize(importerEngine?.ApiV8Code), normalize(importer));
  assert.equal(normalize(listEngine?.ApiV8Code), normalize(storeList));

  for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
    const capabilities = packageModel.PackageInfo[fieldName] || [];
    assert.ok(capabilities.includes('ApiEngine:import-microi-store-package@v2.7.4'));
    assert.ok(capabilities.includes('Importer:MarketplaceChangelogTenantCollisionRepairV1'));
    assert.ok(capabilities.includes('ApiEngine:get-microi-store-model@v1.4.0'));
    assert.ok(capabilities.includes('ApiEngine:get-microi-store@v1.5.0'));
    assert.ok(capabilities.includes('Marketplace:StableApplicationIdentityV1'));
    assert.ok(capabilities.includes('Marketplace:PlatformNoticeRowIsolationV1'));
    assert.ok(capabilities.includes('Marketplace:InstalledVersionTombstonePrecedenceV1'));
    assert.ok(capabilities.includes('ClientFeature:OfficialPlatformNoticeRowIsolationV1'));
    assert.ok(capabilities.includes('Marketplace:PublicApplicationEntryUrlV1'));
    assert.ok(capabilities.includes('Installer:StandaloneApplicationLaunchMenuV1'));
    assert.ok(capabilities.includes('Installer:PackageRuntimeVersionSeparationV1'));
    assert.ok(capabilities.includes('Marketplace:InstalledApplicationPreviewV1'));
    assert.ok(capabilities.includes('Marketplace:PackageSummaryV1'));
    assert.ok(capabilities.includes('Installer:InstallParentMenuV1'));
    assert.ok(capabilities.includes('Installer:AdministratorMenuPermissionV1'));
    assert.ok(capabilities.includes('ClientFeature:MarketplaceMenuRefreshV1'));
    assert.ok(capabilities.includes('Importer:PhysicalNotNullTenantBackfillV1'));
    assert.ok(capabilities.includes('Importer:PageEngineOptionalReferenceV1'));
    assert.ok(capabilities.includes('Importer:SqlServerPhysicalSchemaV1'));
    assert.ok(!capabilities.some(item => /^ApiEngine:import-microi-store-package@(?!v2\.7\.4$)/.test(item)));
    assert.ok(!capabilities.some(item => /^ApiEngine:get-microi-store@(?!v1\.5\.0$)/.test(item)));
  }
});

test('installer and list engines carry executable repair markers', () => {
  assert.match(importer, /PUBLIC_APPLICATION_ENTRY_URL_V1/);
  assert.match(importer, /PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1/);
  assert.match(importer, /MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1/);
  assert.match(importer, /PAGE_ENGINE_OPTIONAL_REFERENCE_V1/);
  assert.match(importer, /STANDALONE_APPLICATION_LAUNCH_MENU_V1/);
  assert.match(importer, /PACKAGE_RUNTIME_VERSION_SEPARATION_V1/);
  assert.match(importer, /buildPublicApplicationAssetUrl/);
  assert.match(importer, /ensureStandaloneApplicationLaunchMenus/);
  assert.match(storeList, /publicObjectUrl/);
  assert.match(storeList, /\.html\?\(\?:\[\?#\]\|\$\)/);
});
