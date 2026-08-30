import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resource = JSON.parse(fs.readFileSync(path.join(directory, 'app.microi.sso.json'), 'utf8'));
const fieldByName = new Map((resource.DiyFields || []).map((field) => [field.Name, field]));
const managedNotice = '/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1';
const tenantNotice = '/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1';

function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(String(value || ''));
  assert.ok(match, `invalid semantic version: ${value}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function executableBody(source) {
  let body = String(source || '').trimStart();
  while (body.startsWith('/*')) {
    body = body.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  }
  return body.trim();
}

test('SSO official package has stable identity and no tenant data', () => {
  assert.equal(resource.PackageInfo.Name, 'SSO 身份联邦');
  assert.equal(resource.PackageInfo.AppId, 'app.microi.sso');
  assert.equal(resource.PackageInfo.Version, 'v7.5.9');
  assert.equal(resource.PackageInfo.ApplicationType, 'Platform');
  assert.deepEqual(resource.PackageInfo.RequiredPlatformCapabilities, [
    'ApiEngine:sso_capabilities',
    'ApiEngine:sso_complete_login',
    'ApiEngine:sso_http_begin',
    'ApiEngine:sso_http_oidc_discovery',
    'ApiEngine:sso_http_saml_idp_metadata',
    'ApiEngine:sso_http_cas_login',
    'ApiEngine:ResponseType=HTTP',
    'ApiEngine:TemplateRouteV1',
    'V8.Method.RunSsoProtocol',
    'V8.Method.CreateFederatedUser',
    'V8.Method.CreateSsoLoginTicket',
    'V8.Method.CompleteSsoLogin',
    'V8.Method.RotateSsoClientSecret',
    'ClientFeature:SsoFederationV1'
  ]);
  assert.equal(resource.SysMenus.length, 1);
  assert.equal(resource.DiyTables.length, 1);
  assert.deepEqual(resource.DataSets, []);
  assert.equal(resource.SysApiEngines.length, 35);
  assert.equal(Object.keys(resource.ResourcePolicies.ApiEngines).length, 35);
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
    'sso_user_runtime',
    'sso_http_begin',
    'sso_http_complete_authorization',
    'sso_http_oidc_callback',
    'sso_http_oidc_discovery',
    'sso_http_oidc_jwks',
    'sso_http_oidc_authorize',
    'sso_http_oidc_token',
    'sso_http_oidc_userinfo',
    'sso_http_oidc_introspect',
    'sso_http_oidc_revoke',
    'sso_http_oidc_logout',
    'sso_http_cas_callback',
    'sso_http_cas_login',
    'sso_http_cas_service_validate',
    'sso_http_cas_p3_service_validate',
    'sso_http_cas_validate',
    'sso_http_cas_logout',
    'sso_http_saml_begin',
    'sso_http_saml_acs',
    'sso_http_saml_login',
    'sso_http_saml_complete',
    'sso_http_saml_idp_metadata',
    'sso_http_saml_sp_metadata',
    'sso_http_saml_logout'
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
      .replace(/\r\n?/g, '\n').trimEnd() + '\n';
    assert.equal(
      engine.ApiV8Code.replace(/\r\n?/g, '\n').trimEnd(),
      source.trimEnd(),
      `${engine.ApiEngineKey} package code drifted`
    );
    assert.match(engine.ApiV8Code.replace(/\r\n?/g, '\n'), /[^\n]\n$/);
    assert.equal(engine.Version, 'v1.0.3');
    const policy = resource.ResourcePolicies.ApiEngines[engine.ApiEngineKey];
    if (engine.ApiEngineKey === 'sso_event_hook') {
      assert.deepEqual(policy, { Ownership: 'Tenant', UpgradePolicy: 'CreateIfMissing' });
      assert.ok(engine.ApiV8Code.startsWith(tenantNotice));
      assert.equal(executableBody(engine.ApiV8Code), 'return { Code : 1 };');
    } else {
      assert.deepEqual(policy, { Ownership: 'Platform', UpgradePolicy: 'Managed' });
      assert.ok(engine.ApiV8Code.startsWith(managedNotice));
    }
  }
});

test('all former SSO Controller routes are Managed HTTP ApiEngines', () => {
  const routes = new Map(resource.SysApiEngines
    .filter((engine) => engine.ApiEngineKey.startsWith('sso_http_'))
    .map((engine) => [engine.ApiEngineKey, engine]));
  const expectedAddresses = {
    sso_http_begin: '/api/Sso/Begin',
    sso_http_complete_authorization: '/api/Sso/CompleteAuthorization',
    sso_http_oidc_callback: '/api/Sso/OidcCallback',
    sso_http_oidc_discovery: '/sso/{OsClient}/.well-known/openid-configuration',
    sso_http_oidc_jwks: '/sso/{OsClient}/jwks',
    sso_http_oidc_authorize: '/sso/{OsClient}/authorize',
    sso_http_oidc_token: '/sso/{OsClient}/token',
    sso_http_oidc_userinfo: '/sso/{OsClient}/userinfo',
    sso_http_oidc_introspect: '/sso/{OsClient}/introspect',
    sso_http_oidc_revoke: '/sso/{OsClient}/revoke',
    sso_http_oidc_logout: '/sso/{OsClient}/logout',
    sso_http_cas_callback: '/api/Sso/CasCallback',
    sso_http_cas_login: '/cas/{OsClient}/login',
    sso_http_cas_service_validate: '/cas/{OsClient}/serviceValidate',
    sso_http_cas_p3_service_validate: '/cas/{OsClient}/p3/serviceValidate',
    sso_http_cas_validate: '/cas/{OsClient}/validate',
    sso_http_cas_logout: '/cas/{OsClient}/logout',
    sso_http_saml_begin: '/api/Sso/SamlBegin',
    sso_http_saml_acs: '/api/Sso/SamlAcs',
    sso_http_saml_login: '/saml/{OsClient}/login',
    sso_http_saml_complete: '/api/Sso/SamlComplete',
    sso_http_saml_idp_metadata: '/saml/{OsClient}/metadata',
    sso_http_saml_sp_metadata: '/saml/{OsClient}/sp/{ConnectionKey}/metadata',
    sso_http_saml_logout: '/saml/{OsClient}/logout'
  };
  assert.equal(routes.size, 24);
  for (const [key, apiAddress] of Object.entries(expectedAddresses)) {
    const engine = routes.get(key);
    assert.ok(engine, `missing protocol endpoint ${key}`);
    assert.equal(engine.ApiAddress, apiAddress);
    assert.equal(engine.ResponseType, 'HTTP');
    assert.equal(engine.StopHttp, 0);
    assert.deepEqual(resource.ResourcePolicies.ApiEngines[key], {
      Ownership: 'Platform', UpgradePolicy: 'Managed'
    });
    assert.ok(engine.ApiV8Code.startsWith(managedNotice));
    assert.match(engine.ApiV8Code, /return V8\.Method\.RunSsoProtocol\(\{/);
  }
  assert.equal(routes.get('sso_http_complete_authorization').AllowAnonymous, 0);
  for (const [key, engine] of routes) {
    if (key !== 'sso_http_complete_authorization') assert.equal(engine.AllowAnonymous, 1);
  }
});

test('SSO Managed flow invokes the tenant Hook only through a safe event whitelist', () => {
  const engines = new Map(resource.SysApiEngines.map((engine) => [engine.ApiEngineKey, engine]));
  for (const [key, engine] of engines) {
    const directHookCalls = engine.ApiV8Code.match(/V8\.ApiEngine\.Run\(['"]sso_event_hook['"]/g) || [];
    assert.equal(directHookCalls.length, key === 'sso_protocol_event' ? 1 : 0, `${key} direct Hook call count`);
  }

  const protocolCode = engines.get('sso_protocol_event').ApiV8Code;
  assert.match(protocolCode, /SSO_TENANT_HOOK_SAFE_PAYLOAD_V1/);
  const eventObject = /var event = \{([\s\S]*?)\n\};/.exec(protocolCode);
  assert.ok(eventObject, 'sso_protocol_event must build an explicit Hook event object');
  const eventKeys = [...eventObject[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]);
  assert.deepEqual(eventKeys, [
    'EventId', 'Action', 'UserId', 'ConnectionKey',
    'Protocol', 'Success', 'Reason', 'OccurredAt'
  ]);
  assert.doesNotMatch(eventObject[0], /token|secret|credential|assertion|claim|raw/i);
});

test('SSO generator preserves future package versions instead of reverting to its minimum', () => {
  const generator = fs.readFileSync(path.join(directory, 'configure-sso-resource.mjs'), 'utf8');
  assert.match(generator, /minimumPackageVersion = 'v7\.5\.9'/);
  assert.match(generator, /compareSemanticVersions\(pkg\.PackageInfo\?\.Version, minimumPackageVersion\) >= 0/);
  assert.match(generator, /normalizeOfficialApiEnginePolicies\(pkg, 'app\.microi\.sso\.json'\)/);
  assert.ok(!generator.includes(".replace(/\\n*$/g, '\\n')"));
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

test('backend startup embeds, checks, installs and verifies SSO after SaaS', () => {
  const upgradeDirectory = path.resolve(directory, '..');
  const project = fs.readFileSync(path.join(upgradeDirectory, 'Microi.Upgrade.csproj'), 'utf8');
  const upgrade = fs.readFileSync(path.join(upgradeDirectory, '13-UpgradeAppStore.cs'), 'utf8');
  assert.match(project, /EmbeddedResource Include="Resource\\app\.microi\.sso\.json"/);
  assert.match(upgrade, /GetInstalledSsoRuntimeRepairReason\(client\.Db\)/);
  assert.match(upgrade, /HasPackagedSsoRuntime\(package\)/);
  assert.match(upgrade, /ValidateInstalledSsoRuntimeDependencies\(osClient, msgs\)/);
  const saasInstall = upgrade.indexOf('InstallUpgradePackage(osClient, msgs, SaaSEnginePackageResourceName');
  const ssoInstall = upgrade.indexOf('InstallUpgradePackage(osClient, msgs, SsoPackageResourceName');
  const aiPublisher = upgrade.indexOf('#region AI应用发布到商城V8');
  assert.ok(saasInstall >= 0 && ssoInstall > saasInstall && aiPublisher > ssoInstall);
});

test('official sync base records the published SSO contract', () => {
  const basePath = path.join(directory, '.resource-sync-base', 'app.microi.sso.json');
  assert.equal(fs.existsSync(basePath), true);
  const published = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  assert.equal(published.PackageInfo.Name, resource.PackageInfo.Name);
  assert.ok(compareVersions(published.PackageInfo.Version, resource.PackageInfo.Version) <= 0);
  assert.equal(published.PackageInfo.AppId, 'app.microi.sso');
  assert.equal(published.SysMenus.length, 1);
  assert.equal(published.DiyTables.length, 1);
  assert.equal(published.DiyFields.length, 64);
  // 发布前允许本地包新增 Managed 端点；已发布基线中的每项策略必须保持一致。
  for (const [key, policy] of Object.entries(published.ResourcePolicies.ApiEngines || {})) {
    assert.deepEqual(policy, resource.ResourcePolicies.ApiEngines[key], `${key} published policy drifted`);
  }

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
