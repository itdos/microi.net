import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { configurePackageModel, packageDefinitions } from './configure-v8-first-platform-packages.mjs';

const source = fs.readFileSync(new URL('./platform-ai-account.js', import.meta.url), 'utf8');
const execute = new Function('V8', source);
const definition = packageDefinitions.find(item => item.file === 'app.microi.ai-engine.json');
const loadPackage = () => JSON.parse(fs.readFileSync(new URL('./app.microi.ai-engine.json', import.meta.url), 'utf8'));
const tableName = 'mci_ai_token_account';
const fieldNames = ['IsUnlimited', 'UnlimitedUpdatedBy', 'UnlimitedUpdatedAt'];

function invoke(param, options = {}) {
  const calls = [];
  const result = execute({
    Param: param,
    CurrentUser: options.anonymous ? {} : { Id: 'fixture-admin' },
    Method: {
      ManageAiPlatform(request) {
        calls.push(structuredClone(request));
        if (request.Action === 'AuthorizeAction') return options.authorization ?? { Code: 1 };
        return options.atomResult ?? { Code: 1, Data: { IsUnlimited: request.IsUnlimited ?? false } };
      },
    },
    ApiEngine: { Run() { assert.fail('relay limit administration must not enter a tenant hook'); } },
    FormEngine: new Proxy({}, { get() { assert.fail('managed resource must not directly access account records'); } }),
  });
  return { result, calls };
}

test('relay administration requires login and trusted action authorization before account access', () => {
  for (const Action of ['GetRelayTokenAccount', 'SetRelayTokenLimit']) {
    const request = { Action, TargetUserId: 'fixture-user', IsUnlimited: true, ExpectedUnlimited: false };
    const anonymous = invoke(request, { anonymous: true });
    assert.equal(anonymous.result.Code, 1001);
    assert.equal(anonymous.calls.length, 0);
    const denied = { Code: 0, Msg: 'administrator required' };
    const unauthorized = invoke(request, { authorization: denied });
    assert.equal(unauthorized.result, denied);
    assert.deepEqual(unauthorized.calls, [{ Action: 'AuthorizeAction', TargetAction: Action }]);
  }
});

test('relay account read forwards only exact target identity to the trusted atom', () => {
  const { result, calls } = invoke({ Action: 'GetRelayTokenAccount', TargetUserId: 'fixture-user',
    UserId: 'other', OsClient: 'other-tenant', CurrentUser: { Level: 9999 },
    IsUnlimited: true, ApiKey: 'not-a-secret-fixture', RemainingTokens: 999999999 });
  assert.equal(result.Code, 1);
  assert.deepEqual(calls.at(-1), { Action: 'GetRelayTokenAccount', TargetUserId: 'fixture-user' });
});

test('relay limit grant and revoke forward strict booleans and CAS without balance or tenant overrides', () => {
  for (const IsUnlimited of [true, false]) {
    const { result, calls } = invoke({ Action: 'SetRelayTokenLimit', TargetUserId: 'fixture-user',
      IsUnlimited, ExpectedUnlimited: !IsUnlimited, osclient: 'other-tenant',
      GiftTokens: 999, RemainingTokens: 999, UsedTokens: 0, UnlimitedUpdatedBy: 'forged',
      UnlimitedUpdatedAt: 'forged', RequestId: 'irrelevant' });
    assert.equal(result.Code, 1);
    assert.deepEqual(calls.at(-1), { Action: 'SetRelayTokenLimit', TargetUserId: 'fixture-user',
      IsUnlimited, ExpectedUnlimited: !IsUnlimited });
  }
});

test('missing, coerced and malformed relay administration parameters fail before the account atom', () => {
  const valid = { Action: 'SetRelayTokenLimit', TargetUserId: 'fixture-user', IsUnlimited: true, ExpectedUnlimited: false };
  const invalid = [
    ...[undefined, null, '', ' ', 123, {}, []].map(TargetUserId => ({ ...valid, TargetUserId })),
    ...[undefined, null, 0, 1, 'true', 'false', {}, []].flatMap(value => [
      { ...valid, IsUnlimited: value }, { ...valid, ExpectedUnlimited: value },
    ]),
  ];
  for (const param of invalid) {
    const { result, calls } = invoke(param);
    assert.equal(result.Code, 0, JSON.stringify(param));
    assert.ok(calls.every(call => call.Action === 'AuthorizeAction'));
  }
});

test('trusted atom conflict and missing-schema failures remain failures', () => {
  for (const Msg of ['compare-and-set conflict', 'upgrade official AI application']) {
    const atomResult = { Code: 0, Msg };
    const { result, calls } = invoke({ Action: 'SetRelayTokenLimit', TargetUserId: 'fixture-user',
      IsUnlimited: true, ExpectedUnlimited: false }, { atomResult });
    assert.equal(result, atomResult);
    assert.equal(calls.length, 2);
  }
});

function assertAccountSchema(model) {
  const table = model.DiyTables.filter(row => row.Name === tableName);
  assert.equal(table.length, 1);
  const ddl = model.DDLStatements.filter(row => row.TableName === tableName);
  assert.equal(ddl.length, 1);
  assert.equal(ddl[0].TableId, table[0].Id);
  assert.match(ddl[0].DDL, /`IsUnlimited` int NULL DEFAULT 0(?:\s|,)/);
  const types = ['int', 'varchar(50)', 'varchar(25)'];
  for (let i = 0; i < fieldNames.length; i++) {
    const name = fieldNames[i];
    const columns = model.PhysicalColumns.filter(row => row.TABLE_NAME === tableName && row.COLUMN_NAME === name);
    const fields = model.DiyFields.filter(row => row.TableName === tableName && row.Name === name);
    assert.equal(columns.length, 1, name);
    assert.equal(fields.length, 1, name);
    assert.equal(columns[0].COLUMN_TYPE, types[i]);
    assert.equal(columns[0].IS_NULLABLE, 'YES');
    assert.equal(columns[0].COLUMN_DEFAULT, i === 0 ? '0' : null);
    assert.equal(fields[0].TableId, table[0].Id);
    assert.equal(fields[0].Type, types[i]);
    assert.equal(fields[0].Readonly, 1, 'entitlements and audit fields are not ordinary editable form values');
  }
  assert.equal(model.DiyFields.find(row => row.TableName === tableName && row.Name === 'IsUnlimited').Component, 'Switch');
  assert.equal(model.DataSets.filter(row => row.TableName === tableName || row.TableName === 'mci_ai_token_log').length, 0);
}

test('official package owns the relay limit DDL, physical columns and read-only form metadata without account seeds', () => {
  const model = loadPackage();
  assertAccountSchema(model);
  const account = model.SysApiEngines.find(row => row.ApiEngineKey === 'platform-ai-account');
  assert.equal(account.ApiV8Code.replace(/\r\n?/g, '\n').trimEnd(), source.replace(/\r\n?/g, '\n').trimEnd());
  assert.deepEqual(model.ResourcePolicies.ApiEngines['platform-ai-account'], { Ownership: 'Platform', UpgradePolicy: 'Managed' });
});

test('AI package generation repairs absent account metadata and remains idempotent without copying records', () => {
  const input = loadPackage();
  const oldTable = input.DiyTables.find(row => row.Name === tableName);
  input.DiyTables = input.DiyTables.filter(row => row.Name !== tableName);
  input.DiyFields = input.DiyFields.filter(row => row.TableName !== tableName && row.TableId !== oldTable.Id);
  const once = configurePackageModel(input, definition);
  assertAccountSchema(once);
  const fields = once.DiyFields.filter(row => row.TableName === tableName);
  const columns = once.PhysicalColumns.filter(row => row.TABLE_NAME === tableName);
  assert.deepEqual(fields.map(row => row.Name).sort(), columns.map(row => row.COLUMN_NAME).sort());
  assert.equal(new Set(fields.map(row => row.Id)).size, fields.length);
  assert.deepEqual(configurePackageModel(structuredClone(once), definition), once);
  assertAccountSchema(configurePackageModel(structuredClone(loadPackage()), definition));
});

test('relay schema regeneration retains a newer package release and unrelated media resources', () => {
  const before = loadPackage();
  before.PackageInfo.Version = 'v999.0.0';
  before.PackageInfo.ChangeHistory = 'fixture newer release history';
  before.PackageInfo.ChangeLog = { Version: 'v999.0.0', Title: 'fixture newer release' };
  const after = configurePackageModel(structuredClone(before), definition);
  assert.equal(after.PackageInfo.Version, before.PackageInfo.Version);
  assert.deepEqual(after.PackageInfo.ChangeLog, before.PackageInfo.ChangeLog);
  assert.ok(after.PackageInfo.ChangeHistory.includes(before.PackageInfo.ChangeHistory));
  assert.deepEqual(after.DataSets, before.DataSets);
  for (const engine of before.SysApiEngines.filter(row => row.ApiEngineKey !== 'platform-ai-account')) {
    assert.deepEqual(after.SysApiEngines.find(row => row.ApiEngineKey === engine.ApiEngineKey), engine);
  }
});

test('account and usage tables remain in the administrator-only resource catalog', () => {
  // This is a source contract; runtime authorization and database CAS are tested by the backend suite.
  const security = fs.readFileSync(new URL('../../Microi.Core/Security/PlatformResourceSecurity.cs', import.meta.url), 'utf8');
  const catalog = security.match(/AdministratorOnlyTableNameValues\s*=\s*\{([\s\S]*?)\};/)?.[1];
  assert.ok(catalog);
  assert.match(catalog, /"mci_ai_token_account"/);
  assert.match(catalog, /"mci_ai_token_log"/);
});

test('release package binds the new account contract to backend 8.7.0 and retains the control-plane capability', () => {
  const model = loadPackage();
  assert.equal(definition.version, 'v7.7.8');
  assert.equal(definition.serverMinVersion, '8.7.0');
  assert.equal(model.PackageInfo.Version, 'v7.7.8');
  assert.equal(model.PackageInfo.ServerMinVersion, '8.7.0');
  assert.equal(model.PackageInfo.ChangeLog.Version, 'v7.7.8');
  assert.match(model.PackageInfo.ChangeHistory, /^2026-10-25 v7\.7\.8 /);
  assert.match(model.PackageInfo.ChangeHistory, /2026-10-22 v7\.7\.7 /);
  for (const version of ['v1.1.0', 'v1.1.1']) {
    assert.ok(model.PackageInfo.RequiredPlatformCapabilities.includes(`ApiEngine:platform-ai-account@${version}`));
  }
  const engine = model.SysApiEngines.find(row => row.ApiEngineKey === 'platform-ai-account');
  assert.equal(engine.Version, 'v1.1.1');
  assert.match(engine.ApiV8Code, /Version: v1\.1\.1/);
  assert.match(engine.ApiV8Code, /RELAY_TOKEN_LIMIT_ADMIN_V1/);
});

test('the actual importer rejects the release on Core 8.6.9 or an unavailable runtime version', () => {
  const importer = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
  const start = importer.indexOf('function readPackageRuntimeVersion(');
  const end = importer.indexOf('var Package = V8.Param.Package', start);
  assert.ok(start >= 0 && end > start);
  const check = new Function('V8', 'info', importer.slice(start, end) + '\nreturn checkPackageRuntimeCompatibility(info);');
  const info = loadPackage().PackageInfo;
  for (const [version, error] of [
    ['v8.6.9', 'PACKAGE_RUNTIME_VERSION_TOO_LOW'],
    ['', 'PACKAGE_RUNTIME_VERSION_UNAVAILABLE'],
    [undefined, 'PACKAGE_RUNTIME_VERSION_UNAVAILABLE'],
  ]) {
    const result = check({ Method: version === undefined ? {} : { GetBackendVersion: () => version },
      Param: { BackendVersion: '99.0.0', SkipVersionCheck: true } }, info);
    assert.equal(result.Code, 0);
    assert.equal(result.Data.ErrorType, error);
  }
  const allowed = check({ Method: { GetBackendVersion: () => 'v8.7.0' } }, info);
  assert.equal(allowed.Code, 1);
  assert.equal(allowed.Data.ServerStatus, 'Compatible');
});

test('the new AI package satisfies the existing official publication gate without weakening it', () => {
  const control = fs.readFileSync(new URL('./official-resource-api.js', import.meta.url), 'utf8');
  const end = control.indexOf('var action = text(PARAM.Action)');
  assert.ok(end > 0);
  const validate = new Function('V8', control.slice(0, end) + '\nreturn validatePublishResource;')({ Param: {} });
  const model = loadPackage();
  const result = validate('app.microi.ai-engine.json', JSON.stringify(model));
  assert.equal(result.Version, 'v7.7.8');
  model.PackageInfo.RequiredPlatformCapabilities = model.PackageInfo.RequiredPlatformCapabilities
    .filter(value => value !== 'ApiEngine:platform-ai-account@v1.1.0');
  assert.throws(() => validate('app.microi.ai-engine.json', JSON.stringify(model)), /缺少能力/);
});
