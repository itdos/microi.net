import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resource = JSON.parse(fs.readFileSync(path.join(directory, 'app.microi.sso.json'), 'utf8'));
const fieldByName = new Map((resource.DiyFields || []).map((field) => [field.Name, field]));

test('SSO official package has stable identity and no tenant data', () => {
  assert.equal(resource.PackageInfo.Name, 'SSO 身份联邦');
  assert.equal(resource.PackageInfo.AppId, 'app.microi.sso');
  assert.equal(resource.PackageInfo.Version, 'v7.5.5');
  assert.deepEqual(resource.PackageInfo.RequiredPlatformCapabilities, [
    'POST /api/Sso/Begin',
    'POST /api/Sso/CompleteAuthorization',
    'GET /sso/{OsClient}/.well-known/openid-configuration',
    'GET /saml/{OsClient}/metadata',
    'GET /cas/{OsClient}/login',
    'ApiEngine:sso_capabilities',
    'ApiEngine:sso_complete_login',
    'V8.Method.CreateFederatedUser',
    'V8.Method.CreateSsoLoginTicket',
    'V8.Method.CompleteSsoLogin',
    'V8.Method.RotateSsoClientSecret',
    'ClientFeature:SsoFederationV1'
  ]);
  assert.equal(resource.SysMenus.length, 1);
  assert.equal(resource.DiyTables.length, 1);
  assert.deepEqual(resource.DataSets, []);
  assert.equal(resource.SysApiEngines.length, 11);
  assert.equal(Object.keys(resource.ResourcePolicies.ApiEngines).length, 11);
  assert.equal(resource.PackageInfo.FieldCount, resource.DiyFields.length);
  assert.equal(resource.PackageInfo.PhysicalColumnCount, resource.PhysicalColumns.length);
});

test('SSO business orchestration is packaged as canonical ApiEngines', () => {
  const expected = [
    'sso_capabilities',
    'sso_legacy_capabilities',
    'sso_connection_runtime',
    'sso_resolve_federated_identity',
    'sso_protocol_event',
    'sso_event_hook',
    'sso_outbound_claims',
    'sso_complete_login',
    'sso_rotate_client_secret',
    'sso_legacy_token_login',
    'sso_user_runtime'
  ];
  assert.deepEqual(resource.SysApiEngines.map((engine) => engine.ApiEngineKey), expected);
  assert.equal(resource.PackageInfo.ApiEngineCount, expected.length);

  const sourceDirectory = path.resolve(
    directory,
    '..', '..', '..',
    'Microi-V8-Engine',
    'Microi吾码 (api.itdos.com)',
    'iTdos.Product.Internal',
    '接口引擎',
    'SSO身份联邦'
  );
  for (const engine of resource.SysApiEngines) {
    const sourceFile = fs.readdirSync(sourceDirectory)
      .find((file) => file.endsWith(`(${engine.ApiEngineKey}).js`));
    assert.ok(sourceFile, `canonical source is missing for ${engine.ApiEngineKey}`);
    const source = fs.readFileSync(path.join(sourceDirectory, sourceFile), 'utf8')
      .replace(/\r\n?/g, '\n').replace(/\n*$/g, '\n');
    assert.equal(engine.ApiV8Code, source, `${engine.ApiEngineKey} package code drifted`);
    const policy = resource.ResourcePolicies.ApiEngines[engine.ApiEngineKey];
    if (engine.ApiEngineKey === 'sso_event_hook') {
      assert.deepEqual(policy, { Ownership: 'Tenant', UpgradePolicy: 'CreateIfMissing' });
    } else {
      assert.deepEqual(policy, { Ownership: 'Application', UpgradePolicy: 'Managed' });
    }
  }
});

test('SSO package carries both directions and all standard web SSO protocols', () => {
  const directionData = JSON.parse(fieldByName.get('Direction').Data);
  const protocolData = JSON.parse(fieldByName.get('Protocol').Data);
  assert.deepEqual(directionData.map((item) => item.Key), ['ExternalToMicroi', 'MicroiToExternal']);
  assert.deepEqual(protocolData.map((item) => item.Key), ['OIDC', 'SAML2', 'CAS']);
  for (const required of [
    'SsoKey', 'Name', 'Issuer', 'DiscoveryUrl', 'ClientId', 'ClientAuthMethod',
    'RedirectUris', 'EntityId', 'SingleSignOnUrl', 'AssertionConsumerServiceUrl',
    'CasServerUrl', 'ProvisioningMode', 'ClaimMappings', 'RoleMappings'
  ]) assert.ok(fieldByName.has(required), `missing SSO field ${required}`);
});

test('SSO package stores secret references rather than secret values', () => {
  for (const keyField of [
    'ClientSecretSettingKey', 'SigningCertificateSettingKey',
    'ValidateCertSettingKey', 'EncryptCertSettingKey'
  ]) {
    const field = fieldByName.get(keyField);
    assert.ok(field);
    assert.match(field.Description, /设置键|Key/);
  }
  const serialized = JSON.stringify(resource);
  assert.doesNotMatch(serialized, /client_secret_value|BEGIN PRIVATE KEY|PfxBase64/i);
});

test('SSO secure defaults and form groups are present', () => {
  for (const name of ['RequirePkce', 'RequireNonce', 'ValidateIssuer', 'ValidateAudience', 'RequireSignedAssertions']) {
    assert.equal(fieldByName.get(name).DefaultValue, '1', `${name} must be secure by default`);
  }
  assert.equal(fieldByName.get('ProvisioningMode').DefaultValue, 'BoundOnly');
  assert.equal(fieldByName.get('AccessTokenLifetimeMinutes').DefaultValue, '15');
  const tabs = JSON.parse(resource.DiyTables[0].Tabs);
  assert.deepEqual(tabs.map((tab) => tab.Id), ['basic', 'oidc', 'saml', 'cas', 'mapping', 'security', 'legacy']);
});

test('SSO DDL, physical columns and module presentation agree', () => {
  const ddl = resource.DDLStatements.find((item) => item.TableName === 'diy_sso').DDL;
  const physicalNames = new Set(resource.PhysicalColumns
    .filter((column) => column.TABLE_NAME === 'diy_sso')
    .map((column) => column.COLUMN_NAME));
  for (const name of fieldByName.keys()) {
    const field = fieldByName.get(name);
    if (!field.Type) continue;
    assert.match(ddl, new RegExp(`\\b${name}\\b`));
    assert.ok(physicalNames.has(name), `missing physical column ${name}`);
  }
  const menu = resource.SysMenus[0];
  const views = JSON.parse(menu.ViewSchema).Views;
  const pageTabs = JSON.parse(menu.PageTabs);
  assert.equal(menu.Url, '/system/sso');
  assert.equal(menu.ViewConfigVersion, 3);
  assert.equal(views.length, 2);
  assert.deepEqual(pageTabs.slice(1, 6).map((tab) => tab.Name), [
    '身份源 → 吾码', '吾码 → 外部系统', 'OIDC', 'SAML2', 'CAS'
  ]);
});

test('official resource pipeline allowlists the SSO package', () => {
  const publisher = fs.readFileSync(path.join(directory, 'mcp-resource-publisher.mjs'), 'utf8');
  const refresh = fs.readFileSync(path.join(directory, 'refresh-resources.mjs'), 'utf8');
  const api = fs.readFileSync(path.join(directory, 'official-resource-api.js'), 'utf8');
  const syncCore = fs.readFileSync(path.join(directory, 'resource-sync-core.mjs'), 'utf8');
  for (const source of [publisher, refresh, api, syncCore]) assert.match(source, /app\.microi\.sso/);
  assert.match(api, /"app\.microi\.sso\.json": "SSO 身份联邦"/);
});

test('official sync base records the published SSO contract', () => {
  const basePath = path.join(directory, '.resource-sync-base', 'app.microi.sso.json');
  assert.equal(fs.existsSync(basePath), true);
  const published = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  assert.equal(published.PackageInfo.Name, resource.PackageInfo.Name);
  assert.equal(published.PackageInfo.Version, resource.PackageInfo.Version);
  assert.equal(published.PackageInfo.AppId, 'app.microi.sso');
  assert.equal(published.SysMenus.length, 1);
  assert.equal(published.DiyTables.length, 1);
  assert.equal(published.DiyFields.length, 64);
  assert.deepEqual(published.ResourcePolicies, resource.ResourcePolicies);

  const publishedFields = new Map(published.DiyFields.map((field) => [field.Name, field]));
  const contractProperties = [
    'Label', 'Type', 'Component', 'Tab', 'DefaultValue',
    'Visible', 'AppVisible', 'Description'
  ];
  for (const [name, localField] of fieldByName) {
    const publishedField = publishedFields.get(name);
    assert.ok(publishedField, `published package is missing ${name}`);
    for (const property of contractProperties) {
      assert.equal(
        String(publishedField[property] ?? ''),
        String(localField[property] ?? ''),
        `${name}.${property} differs from the official package`
      );
    }
  }
});
