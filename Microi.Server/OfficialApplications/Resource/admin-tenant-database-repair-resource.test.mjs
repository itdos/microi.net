import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const engineKey = 'admin_repair_saas_tenant_database_access';
const source = fs.readFileSync(
  path.join(resourceDir, 'admin-repair-saas-tenant-database-access.js'),
  'utf8',
).replaceAll('\r\n', '\n');
const execute = new Function('V8', source);

function validParam(overrides = {}) {
  return {
    TenantId: '01M168BVFYYAE81T1T1RQDAR85',
    TenantKey: 'jisu1',
    ExpectedDatabaseName: 'jisu1',
    Type: 'Product',
    Network: 'Internal',
    ...overrides,
  };
}

function run(param, method, currentUser = { Id: 'admin', Level: 9999 }) {
  return execute({
    Param: param,
    CurrentUser: currentUser,
    Method: method,
    OsClient: 'congshi',
  });
}

test('resource declares Managed ownership, compiles and generator owns the fixed engine', () => {
  assert.match(source, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(source, new RegExp(`ApiEngineKey：${engineKey}`));
  assert.match(source, /Version: v1\.0\.3/);
  assert.match(source, /platform-runtime-custom-hook（CreateIfMissing）/);
  assert.doesNotThrow(() => new Function('V8', source));

  const generator = fs.readFileSync(
    path.join(resourceDir, 'configure-platform-runtime-engines.mjs'),
    'utf8',
  );
  assert.match(generator, new RegExp(`key: '${engineKey}'`));
  assert.match(generator, /file: 'admin-repair-saas-tenant-database-access\.js'/);
  assert.match(generator, /id: '019e2d5f-9940-7f91-8c01-000000000001', enableLog: 0, lock: 1/);
  assert.match(generator, /lock: 1/);
  assert.match(generator, /'V8\.Method\.RepairAdminTenantDatabaseAccess'/);
  assert.match(generator, new RegExp(`'ApiEngine:${engineKey}'`));
  assert.match(generator, /tenantDatabaseRepairPackageVersion = 'v7\.7\.19'/);
  assert.match(generator, /tenantDatabaseRepairMcpCompatibilityPackageVersion = 'v7\.7\.22'/);
  assert.match(generator, /tenantDatabaseStaleReadRepairPackageVersion = 'v7\.7\.23'/);
});

test('identity and host capability gates fail closed before any repair call', () => {
  let called = false;
  const method = {
    RepairAdminTenantDatabaseAccess() {
      called = true;
      return { Code: 1 };
    },
  };
  assert.equal(run(validParam({ ValidateOnly: true }), method, null).Code, 1001);
  assert.equal(run(validParam({
    ValidateOnly: true,
    _CurrentUser: { Id: 'forged-admin', Level: 9999 },
  }), method, null).Code, 1001);
  assert.equal(run(validParam({ ValidateOnly: true }), method, { Id: 'user', Level: 9998 }).Code, 0);
  assert.equal(run(validParam({ ValidateOnly: true }), {}, { Id: 'admin', Level: 9999 }).Code, 0);
  assert.equal(called, false);
});

test('ValidateOnly is side-effect free and returns the exact confirmation contract', () => {
  let called = false;
  const result = run(validParam({ ValidateOnly: true }), {
    RepairAdminTenantDatabaseAccess() {
      called = true;
      throw new Error('must not execute');
    },
  });
  assert.equal(result.Code, 1);
  assert.equal(result.Data.ValidationScope, 'RequestContractOnly');
  assert.equal(result.Data.RequiredConfirmExecution,
    '01M168BVFYYAE81T1T1RQDAR85:jisu1:jisu1');
  assert.equal(called, false);
});

test('trusted MCP runtime fields are accepted only when their context is exact', () => {
  const method = {
    RepairAdminTenantDatabaseAccess() {
      throw new Error('ValidateOnly must remain side-effect free');
    },
  };
  const runtimeParam = validParam({
    OsClient: 'congshi',
    ApiEngineKey: engineKey,
    _InvokeType: 'Server',
    _CurrentUser: { Id: 'admin', Level: 9999 },
    TestParam1: 'legacy-runtime-placeholder',
    ValidateOnly: true,
  });
  assert.equal(run(runtimeParam, method).Code, 1);
  assert.equal(run({ ...runtimeParam, OsClient: 'other' }, method).Code, 0);
  assert.equal(run({ ...runtimeParam, ApiEngineKey: 'other-engine' }, method).Code, 0);
  assert.equal(run({ ...runtimeParam, _InvokeType: 'Client' }, method).Code, 0);
  assert.equal(run({ ...runtimeParam, TestParam1: { nested: true } }, method).Code, 0);
  assert.equal(run({ ...runtimeParam, TestParam1: 'x'.repeat(201) }, method).Code, 0);
});

test('unknown fields, malformed targets and mismatched confirmation are rejected', () => {
  const method = { RepairAdminTenantDatabaseAccess: () => ({ Code: 1 }) };
  assert.equal(run(validParam({ Password: 'must-never-enter' }), method).Code, 0);
  assert.equal(run(validParam({ DbConn: 'must-never-enter' }), method).Code, 0);
  assert.equal(run(validParam({ Token: 'must-never-enter' }), method).Code, 0);
  assert.equal(run(validParam({ ExpectedDatabaseName: 'other_database', ValidateOnly: true }), method).Code, 0);
  assert.equal(run(validParam({ ExpectedStaleReadDatabaseName: 'bad-name', ValidateOnly: true }), method).Code, 0);
  assert.equal(run(validParam({ ExpectedStaleReadDatabaseName: 'jisu1', ValidateOnly: true }), method).Code, 0);
  assert.equal(run(validParam({ ConfirmExecution: 'wrong' }), method).Code, 0);
});

test('stale read replacement requires its exact database name in the confirmation and host request', () => {
  let called = false;
  const validateResult = run(validParam({
    ExpectedStaleReadDatabaseName: 'wuma_beilun',
    ValidateOnly: true,
  }), {
    RepairAdminTenantDatabaseAccess() {
      called = true;
      return { Code: 1 };
    },
  });
  assert.equal(validateResult.Code, 1);
  assert.equal(validateResult.Data.RequiredConfirmExecution,
    '01M168BVFYYAE81T1T1RQDAR85:jisu1:jisu1:replace-stale-read:wuma_beilun');
  assert.equal(called, false);

  let hostParam;
  const result = run(validParam({
    ExpectedStaleReadDatabaseName: 'wuma_beilun',
    ConfirmExecution:
      '01M168BVFYYAE81T1T1RQDAR85:jisu1:jisu1:replace-stale-read:wuma_beilun',
  }), {
    RepairAdminTenantDatabaseAccess(value) {
      hostParam = value;
      return {
        Code: 1,
        Data: {
          CredentialScope: 'DatabaseOnly',
          DurableConfigurationUpdated: true,
          RuntimeReloaded: true,
          StaleReadConnectionReplaced: true,
        },
      };
    },
  });
  assert.deepEqual(hostParam, {
    TenantId: '01M168BVFYYAE81T1T1RQDAR85',
    TenantKey: 'jisu1',
    ExpectedDatabaseName: 'jisu1',
    OsClientType: 'Product',
    OsClientNetwork: 'Internal',
    ExpectedStaleReadDatabaseName: 'wuma_beilun',
  });
  assert.equal(result.Code, 1);
  assert.equal(result.Data.StaleReadConnectionReplaced, true);
});

test('execution forwards only the five safe locators and sanitizes host success', () => {
  let hostParam;
  const param = validParam({
    ConfirmExecution: '01M168BVFYYAE81T1T1RQDAR85:jisu1:jisu1',
  });
  const result = run(param, {
    RepairAdminTenantDatabaseAccess(value) {
      hostParam = value;
      return {
        Code: 1,
        Msg: 'do-not-forward-host-message',
        DataAppend: { Password: 'must-not-leak' },
        Data: {
          TenantId: value.TenantId,
          OsClient: value.TenantKey,
          OsClientType: value.OsClientType,
          OsClientNetwork: value.OsClientNetwork,
          DatabaseName: value.ExpectedDatabaseName,
          CredentialScope: 'DatabaseOnly',
          PreviousPrincipalPreserved: true,
          DurableConfigurationUpdated: true,
          RuntimeReloaded: true,
          Password: 'must-not-leak',
          DbConn: 'must-not-leak',
        },
      };
    },
  });

  assert.deepEqual(hostParam, {
    TenantId: '01M168BVFYYAE81T1T1RQDAR85',
    TenantKey: 'jisu1',
    ExpectedDatabaseName: 'jisu1',
    OsClientType: 'Product',
    OsClientNetwork: 'Internal',
  });
  assert.equal(result.Code, 1);
  assert.equal(result.Data.DurableConfigurationUpdated, true);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /must-not-leak|do-not-forward-host-message|Password|DbConn|DataAppend|ConnectionFingerprint/);
});

test('host failures are reduced to safe state and never forward arbitrary messages', () => {
  const result = run(validParam({
    ConfirmExecution: '01M168BVFYYAE81T1T1RQDAR85:jisu1:jisu1',
  }), {
    RepairAdminTenantDatabaseAccess() {
      return {
        Code: 0,
        Msg: 'connection material must not be forwarded',
        Data: {
          TenantId: '01M168BVFYYAE81T1T1RQDAR85',
          OsClient: 'jisu1',
          DatabaseName: 'jisu1',
          DurableConfigurationUpdated: false,
          Password: 'must-not-leak',
        },
      };
    },
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Data.DurableConfigurationUpdated, false);
  assert.doesNotMatch(JSON.stringify(result), /connection material|must-not-leak|Password/);
});
