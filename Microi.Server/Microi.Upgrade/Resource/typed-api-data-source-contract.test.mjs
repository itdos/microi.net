import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const packageModel = JSON.parse(read('./app.microi.saas-engine.json'));

test('SaaS package owns DataSourceType and one shared ApiV8Code editor', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.12');
  const typeFields = packageModel.DiyFields.filter(item => (
    item.TableName === 'sys_apiengine' && item.Name === 'DataSourceType'
  ));
  const codeFields = packageModel.DiyFields.filter(item => (
    item.TableName === 'sys_apiengine' && item.Name === 'ApiV8Code'
  ));
  assert.equal(typeFields.length, 1);
  assert.equal(codeFields.length, 1);
  assert.deepEqual(JSON.parse(typeFields[0].Data), ['V8', 'SQL', 'JSON', 'API']);

  const codeConfig = JSON.parse(codeFields[0].Config).CodeEditor;
  assert.equal(codeConfig.LanguageField, 'DataSourceType');
  assert.equal(codeConfig.LanguageMap.V8, 'javascript');
  assert.equal(codeConfig.LanguageMap.SQL, 'sql');
  assert.equal(codeConfig.LanguageMap.JSON, 'json');
  assert.equal(codeConfig.LanguageMap.API, 'plaintext');

  const physical = packageModel.PhysicalColumns.filter(item => (
    item.TABLE_NAME === 'sys_apiengine' && item.COLUMN_NAME === 'DataSourceType'
  ));
  assert.equal(physical.length, 1);
  assert.equal(physical[0].COLUMN_TYPE, 'varchar(50)');
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    'ServerFeature:ApiEngineDataSourceType',
  ));
});

test('managed legacy entry is versioned and package rows never add old code columns', () => {
  const engines = packageModel.SysApiEngines.filter(
    item => item.ApiEngineKey === 'platform-data-source-run',
  );
  assert.equal(engines.length, 1);
  assert.equal(engines[0].Version, 'v1.1.0');
  assert.match(engines[0].ApiV8Code, /V8\.Method\.RunDataSourceEngine\(p\)/);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['platform-data-source-run'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });

  for (const engine of packageModel.SysApiEngines) {
    for (const legacyField of [
      'NormalDataSource', 'ApiDataSource', 'V8DataSource', 'SqlDataSource', 'JsonDataSource',
    ]) assert.equal(legacyField in engine, false, `${engine.ApiEngineKey}.${legacyField}`);
  }
});

test('historic data-source aliases are ApiRoutes and delegate to the typed API runtime', () => {
  const facade = read('../../Microi.Core/V8Engine/Runtime/V8Method.PlatformClientFacades.cs');
  const runtime = read('../../Microi.Core/ApiEngine/ApiEngineDataSourceRuntime.cs');
  const apiEngine = read('../../Microi.net/ApiEngine/ApiEngine.cs');
  const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'platform-data-source-run');

  assert.equal(fs.existsSync(new URL('../../Microi.net.Api/Controllers/LegacyMobileCompatibilityController.cs', import.meta.url)), false);
  assert.match(engine.ApiRoutes, /\/api\/DataSourceEngine\/Run/);
  assert.match(engine.ApiRoutes, /\/api\/DataSourceEngine\/GetData/);
  assert.match(facade, /RunDataSourceEngine\(dynamic dynamicParam\)/);
  assert.match(facade, /ResolveMigratedDataSourceApiEngineKey/);
  assert.match(runtime, /ExecuteNonV8/);
  assert.match(apiEngine, /DynamicHelper\.GetDynamicStringValue\(apiEngineModel, "DataSourceType", "V8"\)/);
});
