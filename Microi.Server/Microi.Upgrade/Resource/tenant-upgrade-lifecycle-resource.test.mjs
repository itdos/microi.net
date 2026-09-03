import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(resourceDir, name), 'utf8');
const progressContractSource = fs.readFileSync(path.resolve(
  resourceDir,
  '..',
  '..',
  'Microi.Core',
  'Runtime',
  'TenantProvisioningProgressContract.cs',
), 'utf8');
const progressTotalMatch = progressContractSource.match(
  /public\s+const\s+int\s+TotalSteps\s*=\s*(\d+)\s*;/,
);
const tenantProvisioningTotalSteps = Number(progressTotalMatch?.[1]);
const packageModel = JSON.parse(read('app.microi.saas-engine.json'));
const storePackage = JSON.parse(read('app.microi.store.json'));
const engineSource = read('admin-upgrade-saas-tenant-database.js').replaceAll('\r\n', '\n');
const domainBindingSource = read('admin-ensure-saas-tenant-domain-binding.js')
  .replaceAll('\r\n', '\n');
const externalDomainBindingSource = read('admin-ensure-external-saas-tenant-domain-binding.js')
  .replaceAll('\r\n', '\n');
const execute = new Function('V8', engineSource);
const executeDomainBinding = new Function('V8', domainBindingSource);
const executeExternalDomainBinding = new Function('V8', externalDomainBindingSource);
const engines = new Map((packageModel.SysApiEngines || []).map(item => [item.ApiEngineKey, item]));

function buttons(value) {
  return typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
}

function domainBindingFixture(options = {}) {
  const accessKeyId = 'test-access-key-id';
  const accessKeySecret = 'test-access-key-secret';
  const target = {
    Id: 'tenant-row-id',
    OsClient: 'hongdi-dev',
    DomainName: 'hongdi-dev.microi.net',
    IsEnable: 1,
    ...(options.target || {}),
  };
  const main = {
    Id: 'main-row-id',
    OsClient: 'iTdos',
    DomainName: 'dev.chongstech.com',
    IsEnable: 1,
    ...(options.main || {}),
  };
  const state = {
    queries: [],
    atomicCalls: [],
    authorizationCalls: 0,
    accessKeyId,
    accessKeySecret,
  };
  const V8 = {
    Param: { TenantKey: 'hongdi-dev', ...(options.param || {}) },
    OsClient: 'iTdos',
    CurrentUser: { Level: options.level ?? 9999 },
    OsClientModel: {
      Id: main.Id,
      OsClient: main.OsClient,
      AlidnsKeyId: accessKeyId,
      AlidnsKeySecret: accessKeySecret,
      ...(options.mainModel || {}),
    },
    Method: {
      AuthorizeAdminTenantDomainBinding() {
        state.authorizationCalls += 1;
        return options.authorizationResult || { Code: 1 };
      },
    },
    FormEngine: {
      GetFormData(table, query) {
        state.queries.push({ table, query });
        const where = query._Where || [];
        const osClient = where.find(item => item[0] === 'OsClient')?.[2];
        const id = where.find(item => item[0] === 'Id')?.[2];
        if (String(osClient || '').toLowerCase() === 'itdos') {
          return { Code: 1, Data: main };
        }
        if ((osClient && String(osClient).toLowerCase() === target.OsClient.toLowerCase())
            || (id && String(id) === target.Id)) {
          return { Code: 1, Data: target };
        }
        return { Code: 2, Data: null };
      },
    },
    Alidns: {
      EnsureExactESACnameRecord(value) {
        state.atomicCalls.push(value);
        if (options.atomicResult) return options.atomicResult;
        return {
          Code: 1,
          Data: {
            Action: 'Created',
            ControlPlaneVerified: true,
            BareDomainReady: true,
            DataPlaneStatus: 'Ready',
            HttpStatus: 200,
            Diagnostic: 'ready',
            SiteName: 'microi.net',
            RecordId: 20002,
            RecordName: target.DomainName,
            RecordType: 'CNAME',
            OriginDomain: main.DomainName,
            OriginHost: main.DomainName,
            OriginSni: main.DomainName,
            HostPolicy: 'follow_origin_domain',
            Proxied: true,
          },
        };
      },
    },
  };
  if (options.noAuthorizationAtom) delete V8.Method;
  if (options.noAtom) delete V8.Alidns;
  return { V8, state, target, main };
}

function externalDomainBindingFixture(options = {}) {
  const accessKeyId = 'official-test-access-key-id';
  const accessKeySecret = 'official-test-access-key-secret';
  const originDomain = options.originDomain ?? 'dev.chongstech.com';
  const tenantKey = options.tenantKey ?? 'hongdi-dev';
  const recordName = `${String(tenantKey).toLowerCase()}.microi.net`;
  const state = {
    authorizationCalls: 0,
    atomicCalls: [],
    accessKeyId,
    accessKeySecret,
  };
  const V8 = {
    Param: {
      TenantKey: tenantKey,
      OriginDomain: originDomain,
      ...(options.param || {}),
    },
    OsClient: options.osClient ?? 'iTdos',
    CurrentUser: { Level: options.level ?? 9999 },
    OsClientModel: {
      OsClient: options.modelOsClient ?? 'iTdos',
      AlidnsKeyId: accessKeyId,
      AlidnsKeySecret: accessKeySecret,
      ...(options.mainModel || {}),
    },
    Method: {
      AuthorizeExternalSaasTenantDomainBinding() {
        state.authorizationCalls += 1;
        if (options.authorizationThrows) throw new Error('sensitive authorization failure');
        return options.authorizationResult || { Code: 1 };
      },
    },
    Alidns: {
      EnsureExactESACnameRecord(value) {
        state.atomicCalls.push(value);
        if (options.atomicThrows) throw new Error('sensitive ESA failure');
        if (Object.prototype.hasOwnProperty.call(options, 'atomicResult')) {
          return options.atomicResult;
        }
        return {
          Code: 1,
          Data: {
            Action: 'Created',
            ControlPlaneVerified: true,
            BareDomainReady: true,
            DataPlaneStatus: 'Ready',
            HttpStatus: 200,
            Diagnostic: 'ready',
            SiteName: 'microi.net',
            RecordId: 30003,
            RecordName: recordName,
            RecordType: 'CNAME',
            OriginDomain: String(originDomain).toLowerCase(),
            OriginHost: String(originDomain).toLowerCase(),
            OriginSni: String(originDomain).toLowerCase(),
            SourceType: 'Domain',
            BizName: 'web',
            HostPolicy: 'follow_origin_domain',
            HttpPorts: '80',
            HttpsPorts: '443',
            Ttl: 1,
            Proxied: true,
          },
        };
      },
    },
  };
  if (options.noAuthorizationAtom) delete V8.Method;
  if (options.noAtom) delete V8.Alidns;
  return { V8, state, tenantKey, recordName, originDomain };
}

test('official package owns the automatic and manual tenant upgrade lifecycle', () => {
  assert.equal(tenantProvisioningTotalSteps, 13);
  assert.equal(packageModel.PackageInfo.Version, 'v7.8.23');
  assert.equal(packageModel.PackageInfo.ChangeLog.Version, packageModel.PackageInfo.Version);
  assert.equal(storePackage.PackageInfo.Version, 'v7.9.19');
  assert.equal(storePackage.PackageInfo.ChangeLog.Version, storePackage.PackageInfo.Version);
  assert.equal(packageModel.PackageInfo.ApiEngineCount, 70);
  assert.equal(engines.size, 70);
  assert.equal(
    new Set((packageModel.SysApiEngines || []).map(item => item.Id)).size,
    packageModel.SysApiEngines.length,
  );

  assert.equal(engines.get('admin_create_empty_saas_tenant')?.Version, 'v1.0.8');
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('ApiEngine:admin_create_empty_saas_tenant@v1.0.8'));
  assert.equal(engines.get('admin_ensure_saas_tenant_domain_binding')?.Version, 'v1.0.3');
  assert.equal(engines.get('admin_ensure_saas_tenant_domain_binding')?.StopHttp, 1);
  assert.equal(engines.get('admin_ensure_saas_tenant_domain_binding')?.EnableLog, 0);
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines.admin_ensure_saas_tenant_domain_binding.UpgradePolicy,
    'Managed',
  );
  assert.equal(
    engines.get('admin_ensure_saas_tenant_domain_binding')?.ApiV8Code,
    domainBindingSource,
  );
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('ApiEngine:admin_ensure_saas_tenant_domain_binding@v1.0.3'));
  assert.equal(
    engines.get('admin_ensure_external_saas_tenant_domain_binding')?.Version,
    'v1.0.2',
  );
  assert.equal(engines.get('admin_ensure_external_saas_tenant_domain_binding')?.StopHttp, 1);
  assert.equal(engines.get('admin_ensure_external_saas_tenant_domain_binding')?.EnableLog, 0);
  assert.equal(engines.get('admin_ensure_external_saas_tenant_domain_binding')?.Lock, 1);
  assert.equal(
    engines.get('admin_ensure_external_saas_tenant_domain_binding')?.LockKey,
    'TenantKey',
  );
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines
      .admin_ensure_external_saas_tenant_domain_binding.UpgradePolicy,
    'Managed',
  );
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines
      .admin_ensure_external_saas_tenant_domain_binding.Ownership,
    'Platform',
  );
  assert.equal(engines.get('admin_ensure_external_saas_tenant_domain_binding')?.AllowAnonymous, 0);
  assert.equal(engines.get('admin_ensure_external_saas_tenant_domain_binding')?.IsEnable, 1);
  assert.equal(
    engines.get('admin_ensure_external_saas_tenant_domain_binding')?.ApiAddress,
    '/apiengine/admin_ensure_external_saas_tenant_domain_binding',
  );
  assert.equal(
    engines.get('admin_ensure_external_saas_tenant_domain_binding')?.ApiV8Code,
    externalDomainBindingSource,
  );
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('ApiEngine:admin_ensure_external_saas_tenant_domain_binding@v1.0.2'));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('V8.Method.AuthorizeExternalSaasTenantDomainBinding'));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('V8.Method.AuthorizeAdminTenantDomainBinding'));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities
    .includes('V8.Alidns.EnsureExactESACnameRecord'));
  assert.equal(engines.get('official_create_tenant_worker')?.Version, 'v1.1.4');
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.Version, 'v1.0.8');
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.StopHttp, 1);
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.EnableLog, 0);
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines.admin_upgrade_saas_tenant_database.UpgradePolicy,
    'Managed',
  );
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.ApiV8Code, engineSource);

  const createSource = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const workerSource = engines.get('official_create_tenant_worker')?.ApiV8Code || '';
  assert.match(createSource, /ProvisionAdminTenant/);
  assert.match(createSource, /RuntimeApiBase/);
  assert.match(createSource, /RuntimeWebBase/);
  assert.match(createSource, /PendingExternalBinding/);
  assert.match(createSource, /admin_ensure_saas_tenant_domain_binding/);
  assert.match(createSource, /DomainBindingCompensationApi/);
  assert.match(
    createSource,
    new RegExp(`var totalSteps = ${tenantProvisioningTotalSteps};`),
  );
  assert.match(
    createSource,
    new RegExp(`report\\(${tenantProvisioningTotalSteps - 1}, '租户数据库已创建`),
  );
  assert.match(
    createSource,
    new RegExp(`report\\(${tenantProvisioningTotalSteps}, 'SaaS 租户创建成功`),
  );
  assert.doesNotMatch(createSource, /Url\s*=\s*'https:\/\/'\s*\+\s*domainName/);
  assert.match(createSource, /_BackgroundTaskFencingToken:\s*backgroundTaskFencingToken/);
  assert.match(workerSource, /Upgrade:\s*atomicData\.Upgrade/);
  assert.match(workerSource, /done\('upgrade'/);
  assert.match(workerSource, /_BackgroundTaskFencingToken:\s*backgroundTaskFencingToken/);

  const menu = packageModel.SysMenus.find(item => item.Id === '42078414-512a-4840-9843-9b75ab79ba79');
  const moreButton = buttons(menu.MoreBtns)
    .find(item => item.Id === 'admin-upgrade-saas-tenant-database-row-btn');
  assert.ok(moreButton);
  assert.match(moreButton.V8Code, /RoutePath:\s*'\/tenant-database-upgrade'/);
  assert.match(moreButton.V8Code, /TenantId:\s*V8\.Form\.Id/);
  assert.match(moreButton.V8CodeShow, /9999/);

  const backupButton = buttons(menu.PageBtns)
    .find(item => item.Id === 'database-backup-page-btn');
  assert.equal((backupButton.V8Code.match(/BodyHeight/g) || []).length, 1);
});

test('automatic tenant creation binds the exact domain after provisioning succeeds', () => {
  const source = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const executeCreate = new Function('V8', source);
  let hostRequest;
  let bindingRequest;
  let bindingEngineKey;
  const result = executeCreate({
    Param: {
      TenantKey: 'hongdi-dev',
      SystemName: '宁波鸿地-开发环境',
      AdminPassword: 'test-password',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      DomainName: 'hongdi-dev.microi.net',
      RuntimeApiBase: 'https://api-dev.chongstech.com/',
      RuntimeWebBase: 'https://dev.chongstech.com/',
      _BackgroundTaskId: 'task-id',
      _BackgroundTaskFencingToken: 7,
    },
    CurrentUser: { Level: 9999 },
    EncryptHelper: { DESEncode: () => 'encrypted' },
    ApiEngine: {
      Run(engineKey, value) {
        bindingEngineKey = engineKey;
        bindingRequest = value;
        return {
          Code: 1,
          Data: {
            DomainBindingStatus: 'Verified',
            ControlPlaneVerified: true,
            BareDomainReady: true,
            DataPlaneStatus: 'Ready',
            HttpStatus: 200,
            Diagnostic: 'ready',
            Action: 'Created',
          },
        };
      },
    },
    Method: {
      UpdateBackgroundTask() {},
      ProvisionAdminTenant(value) {
        hostRequest = value;
        return {
          Code: 1,
          Data: {
            OsClient: 'hongdi-dev',
            DbName: 'microi_hongdi_dev',
            SystemName: '宁波鸿地-开发环境',
            DomainName: 'hongdi-dev.microi.net',
            Upgrade: { AfterVersion: '7.9.3' },
          },
          Msg: '完成',
        };
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.equal(
    result.Data.LaunchUrl,
    'https://dev.chongstech.com/?ApiBase=https%3A%2F%2Fapi-dev.chongstech.com&OsClient=hongdi-dev',
  );
  assert.equal(result.Data.Url, 'https://hongdi-dev.microi.net');
  assert.equal(result.Data.BareDomainUrl, 'https://hongdi-dev.microi.net');
  assert.equal(result.Data.BareDomainReady, true);
  assert.equal(result.Data.DomainBindingRequired, false);
  assert.equal(result.Data.DomainBindingRetryable, false);
  assert.equal(result.Data.DomainBindingStatus, 'Verified');
  assert.equal(result.Data.ControlPlaneVerified, true);
  assert.equal(result.Data.DataPlaneStatus, 'Ready');
  assert.equal(result.Data.HttpStatus, 200);
  assert.equal(result.Data.DomainBindingAction, 'Created');
  assert.equal(result.Data.DomainBindingCompensationApi, 'admin_ensure_saas_tenant_domain_binding');
  assert.equal(result.Data.Upgrade.AfterVersion, '7.9.3');
  assert.equal(hostRequest.RuntimeApiBase, undefined);
  assert.equal(hostRequest.RuntimeWebBase, undefined);
  assert.equal(bindingEngineKey, 'admin_ensure_saas_tenant_domain_binding');
  assert.deepEqual(bindingRequest, { TenantKey: 'hongdi-dev' });
});

test('automatic tenant creation keeps the imported database when exact binding needs compensation', () => {
  const source = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const executeCreate = new Function('V8', source);
  let provisionCalls = 0;
  let bindingCalls = 0;
  const result = executeCreate({
    Param: {
      TenantKey: 'hongdi-dev',
      SystemName: '宁波鸿地-开发环境',
      AdminPassword: 'test-password',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      DomainName: 'hongdi-dev.microi.net',
      RuntimeApiBase: 'https://api-dev.chongstech.com',
      RuntimeWebBase: 'https://dev.chongstech.com',
      _BackgroundTaskId: 'task-id',
      _BackgroundTaskFencingToken: 7,
    },
    CurrentUser: { Level: 9999 },
    EncryptHelper: { DESEncode: () => 'encrypted' },
    ApiEngine: {
      Run() {
        bindingCalls += 1;
        return {
          Code: 0,
          Data: { DomainBindingStatus: 'Failed' },
          Msg: 'safe failure',
        };
      },
    },
    Method: {
      UpdateBackgroundTask() {},
      ProvisionAdminTenant() {
        provisionCalls += 1;
        return {
          Code: 1,
          Data: {
            OsClient: 'hongdi-dev',
            DomainName: 'hongdi-dev.microi.net',
            DatabaseImport: { Imported: true },
          },
        };
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.equal(provisionCalls, 1);
  assert.equal(bindingCalls, 1);
  assert.equal(result.Data.DatabaseImport.Imported, true);
  assert.equal(result.Data.Url, result.Data.LaunchUrl);
  assert.equal(result.Data.BareDomainReady, false);
  assert.equal(result.Data.DomainBindingRequired, true);
  assert.equal(result.Data.DomainBindingRetryable, true);
  assert.equal(result.Data.DomainBindingStatus, 'Failed');
  assert.match(result.Msg, /待幂等补偿/);
});

test('automatic tenant creation keeps success but exposes control-plane-only 522 state', () => {
  const source = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const executeCreate = new Function('V8', source);
  const result = executeCreate({
    Param: {
      TenantKey: 'hongdi-dev',
      SystemName: '宁波鸿地-开发环境',
      AdminPassword: 'test-password',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      DomainName: 'hongdi-dev.microi.net',
      RuntimeApiBase: 'https://api-dev.chongstech.com',
      RuntimeWebBase: 'https://dev.chongstech.com',
      _BackgroundTaskId: 'task-id',
      _BackgroundTaskFencingToken: 7,
    },
    CurrentUser: { Level: 9999 },
    EncryptHelper: { DESEncode: () => 'encrypted' },
    ApiEngine: {
      Run() {
        return {
          Code: 1,
          Data: {
            DomainBindingStatus: 'DataPlaneUnavailable',
            ControlPlaneVerified: true,
            BareDomainReady: false,
            DataPlaneStatus: 'OriginConnectionTimeout',
            HttpStatus: 522,
            Diagnostic: '精确域名返回 HTTP 522，ESA 尚未成功连接源站。',
            OriginProtectionDiagnosticStatus: 'Available',
            OriginProtection: 'on',
            OriginConverge: 'off',
            AutoConfirmIPList: 'off',
            NeedUpdate: true,
          },
        };
      },
    },
    Method: {
      UpdateBackgroundTask() {},
      ProvisionAdminTenant() {
        return {
          Code: 1,
          Data: {
            OsClient: 'hongdi-dev',
            DomainName: 'hongdi-dev.microi.net',
            DatabaseImport: { Imported: true },
          },
        };
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.equal(result.Data.DatabaseImport.Imported, true);
  assert.equal(result.Data.BareDomainReady, false);
  assert.equal(result.Data.ControlPlaneVerified, true);
  assert.equal(result.Data.DomainBindingStatus, 'DataPlaneUnavailable');
  assert.equal(result.Data.DataPlaneStatus, 'OriginConnectionTimeout');
  assert.equal(result.Data.HttpStatus, 522);
  assert.match(result.Data.DomainBindingMessage, /HTTP 522/);
  assert.equal(result.Data.OriginProtectionDiagnosticStatus, 'Available');
  assert.equal(result.Data.NeedUpdate, true);
  assert.equal(result.Data.Url, result.Data.LaunchUrl);
});

test('automatic tenant creation rejects unsafe host context and never presents a bare domain as ready', () => {
  const source = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const executeCreate = new Function('V8', source);
  let provisionCalls = 0;
  const makeV8 = param => ({
    Param: {
      TenantKey: 'hongdi-dev', SystemName: '宁波鸿地-开发环境',
      AdminPassword: 'test-password', OsClientType: 'Product',
      OsClientNetwork: 'Internal', ValidateOnly: true, ...param,
    },
    CurrentUser: { Level: 9999 },
    EncryptHelper: { DESEncode: () => 'encrypted' },
    Method: {
      UpdateBackgroundTask() {},
      ProvisionAdminTenant() { provisionCalls += 1; },
    },
  });

  const unsafe = executeCreate(makeV8({ RuntimeWebBase: 'https://user:pwd@evil.example' }));
  assert.equal(unsafe.Code, 0);
  assert.equal(provisionCalls, 0);

  const unavailable = executeCreate(makeV8({ RuntimeApiBase: 'https://api-dev.chongstech.com' }));
  assert.equal(unavailable.Code, 1);
  assert.equal(unavailable.Data.Url, '');
  assert.equal(unavailable.Data.LaunchUrlAvailable, false);
  assert.equal(unavailable.Data.BareDomainReady, false);
  assert.equal(unavailable.Data.DomainBindingStatus, 'PendingExternalBinding');
});

test('managed exact-domain engine reads authority and passes only the fixed ESA policy inputs', () => {
  assert.match(domainBindingSource, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.doesNotThrow(() => new Function('V8', domainBindingSource));
  assert.doesNotMatch(domainBindingSource, /dns_sync_ip|UptESADomainRecord/);
  assert.match(domainBindingSource, /V8\.Method\.AuthorizeAdminTenantDomainBinding\(\)/);

  const fixture = domainBindingFixture();
  const binding = executeDomainBinding(fixture.V8);

  assert.equal(binding.Code, 1);
  assert.equal(binding.Data.DomainBindingStatus, 'Verified');
  assert.equal(binding.Data.BareDomainReady, true);
  assert.equal(binding.Data.DomainName, 'hongdi-dev.microi.net');
  assert.equal(binding.Data.OriginDomain, 'dev.chongstech.com');
  assert.equal(binding.Data.OriginHost, 'dev.chongstech.com');
  assert.equal(binding.Data.OriginSni, 'dev.chongstech.com');
  assert.equal(binding.Data.HostPolicy, 'follow_origin_domain');
  assert.equal(fixture.state.atomicCalls.length, 1);
  assert.equal(fixture.state.authorizationCalls, 1);
  assert.deepEqual(fixture.state.atomicCalls[0], {
    SiteName: 'microi.net',
    RecordName: 'hongdi-dev.microi.net',
    OriginDomain: 'dev.chongstech.com',
    AccessKeyId: fixture.state.accessKeyId,
    AccessKeySecret: fixture.state.accessKeySecret,
  });
  assert.equal(fixture.state.queries.length, 2);
  for (const { table, query } of fixture.state.queries) {
    assert.equal(table, 'sys_osclients');
    assert.deepEqual(query._SelectFields, ['Id', 'OsClient', 'DomainName', 'IsEnable']);
  }
  const serialized = JSON.stringify(binding);
  assert.doesNotMatch(serialized, new RegExp(fixture.state.accessKeyId));
  assert.doesNotMatch(serialized, new RegExp(fixture.state.accessKeySecret));
});

test('managed exact-domain compensation accepts Id as the only target locator', () => {
  const fixture = domainBindingFixture({ param: { TenantKey: undefined, Id: 'tenant-row-id' } });
  const binding = executeDomainBinding(fixture.V8);

  assert.equal(binding.Code, 1);
  assert.equal(binding.Data.TenantId, 'tenant-row-id');
  assert.ok(fixture.state.queries[0].query._Where.some(
    item => item[0] === 'Id' && item[2] === 'tenant-row-id',
  ));
  assert.equal(fixture.state.atomicCalls.length, 1);
});

test('both domain-binding engines expose 522 data-plane and read-only origin-protection diagnostics', () => {
  const diagnostic = {
    ControlPlaneVerified: true,
    BareDomainReady: false,
    DataPlaneStatus: 'OriginConnectionTimeout',
    HttpStatus: 522,
    Diagnostic: '精确域名返回 HTTP 522，ESA 尚未成功连接源站。',
    OriginProtectionDiagnosticStatus: 'Available',
    OriginProtection: 'on',
    OriginConverge: 'off',
    AutoConfirmIPList: 'off',
    NeedUpdate: true,
    CurrentIPv4Cidrs: ['47.0.0.0/8'],
    LatestIPv4Cidrs: ['47.0.0.0/8', '8.8.8.0/24'],
    AddedIPv4Cidrs: ['8.8.8.0/24'],
    RemovedIPv4Cidrs: [],
    UnchangedIPv4Cidrs: ['47.0.0.0/8'],
  };
  const managedBase = domainBindingFixture();
  const managedAtomic = managedBase.V8.Alidns.EnsureExactESACnameRecord({}).Data;
  const managed = domainBindingFixture({
    atomicResult: { Code: 1, Data: { ...managedAtomic, ...diagnostic } },
  });
  const externalBase = externalDomainBindingFixture();
  const externalAtomic = externalBase.V8.Alidns.EnsureExactESACnameRecord({}).Data;
  const external = externalDomainBindingFixture({
    atomicResult: { Code: 1, Data: { ...externalAtomic, ...diagnostic } },
  });

  for (const binding of [
    executeDomainBinding(managed.V8),
    executeExternalDomainBinding(external.V8),
  ]) {
    assert.equal(binding.Code, 1);
    assert.equal(binding.Data.ControlPlaneVerified, true);
    assert.equal(binding.Data.BareDomainReady, false);
    assert.equal(binding.Data.DomainBindingStatus, 'DataPlaneUnavailable');
    assert.equal(binding.Data.DomainBindingRetryable, true);
    assert.equal(binding.Data.DataPlaneStatus, 'OriginConnectionTimeout');
    assert.equal(binding.Data.HttpStatus, 522);
    assert.match(binding.Data.Diagnostic, /HTTP 522/);
    assert.equal(binding.Data.OriginProtectionDiagnosticStatus, 'Available');
    assert.equal(binding.Data.OriginProtection, 'on');
    assert.equal(binding.Data.OriginConverge, 'off');
    assert.equal(binding.Data.AutoConfirmIPList, 'off');
    assert.equal(binding.Data.NeedUpdate, true);
    assert.deepEqual(binding.Data.CurrentIPv4Cidrs, ['47.0.0.0/8']);
    assert.deepEqual(binding.Data.AddedIPv4Cidrs, ['8.8.8.0/24']);
  }
});

test('managed exact-domain engine accepts only valid MCP runtime metadata values', () => {
  const traceParent = '00-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-01';
  const testParamValues = [undefined, null, '', 'runtime-placeholder', 0, 1, false, true];
  for (const authorizationMarker of [true, 1]) {
    for (const testParamValue of testParamValues) {
      const fixture = domainBindingFixture({
        param: {
          _RequireApiRoleAuthorization: authorizationMarker,
          _TraceParent: traceParent,
          TestParam1: testParamValue,
        },
      });
      const binding = executeDomainBinding(fixture.V8);

      assert.equal(binding.Code, 1);
      assert.equal(binding.Data.DomainBindingStatus, 'Verified');
      assert.equal(fixture.state.authorizationCalls, 1);
      assert.equal(fixture.state.atomicCalls.length, 1);
      assert.equal('TestParam1' in fixture.state.atomicCalls[0], false);
    }
  }
});

test('managed exact-domain engine rejects malformed runtime metadata before authority reads', () => {
  const invalidParams = [
    { _RequireApiRoleAuthorization: false },
    { _RequireApiRoleAuthorization: '1' },
    { _TraceParent: 'invalid' },
    { _TraceParent: '00-00000000000000000000000000000000-c015ba856c2e9d69-01' },
    { _TraceParent: '00-daa279013d1e7446c25bab27f05118d6-0000000000000000-01' },
    { _TraceParent: 'ff-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-01' },
    { TestParam1: { nested: true } },
    { TestParam1: ['not', 'scalar'] },
    { TestParam1: 'x'.repeat(201) },
    { TestParam1() {} },
    { UnexpectedRuntimeField: true },
  ];
  for (const param of invalidParams) {
    const fixture = domainBindingFixture({ param });
    const binding = executeDomainBinding(fixture.V8);

    assert.equal(binding.Code, 0);
    assert.equal(binding.Data.DomainBindingStatus, 'RejectedInput');
    assert.equal(fixture.state.queries.length, 0);
    assert.equal(fixture.state.authorizationCalls, 0);
    assert.equal(fixture.state.atomicCalls.length, 0);
  }
});

test('managed exact-domain engine rejects caller-controlled domains, wildcard records and same-site origins', () => {
  const unknownInput = domainBindingFixture({ param: { DomainName: 'victim.microi.net' } });
  const unknownResult = executeDomainBinding(unknownInput.V8);
  assert.equal(unknownResult.Code, 0);
  assert.equal(unknownResult.Data.DomainBindingStatus, 'RejectedInput');
  assert.equal(unknownInput.state.queries.length, 0);
  assert.equal(unknownInput.state.atomicCalls.length, 0);

  const wildcard = domainBindingFixture({ target: { DomainName: '*.microi.net' } });
  const wildcardResult = executeDomainBinding(wildcard.V8);
  assert.equal(wildcardResult.Code, 0);
  assert.equal(wildcardResult.Data.DomainBindingStatus, 'UnsupportedDomain');
  assert.equal(wildcard.state.atomicCalls.length, 0);

  const sameSiteOrigin = domainBindingFixture({ main: { DomainName: 'dev.microi.net' } });
  const sameSiteResult = executeDomainBinding(sameSiteOrigin.V8);
  assert.equal(sameSiteResult.Code, 0);
  assert.equal(sameSiteResult.Data.DomainBindingStatus, 'UnsafeOrigin');
  assert.equal(sameSiteOrigin.state.atomicCalls.length, 0);
});

test('managed exact-domain engine fails closed for forged, non-admin and missing host capabilities', () => {
  const nonAdmin = domainBindingFixture({ level: 1 });
  const nonAdminResult = executeDomainBinding(nonAdmin.V8);
  assert.equal(nonAdminResult.Code, 0);
  assert.equal(nonAdminResult.Data.DomainBindingStatus, 'Unauthorized');
  assert.equal(nonAdmin.state.queries.length, 0);
  assert.equal(nonAdmin.state.authorizationCalls, 0);

  const forgedLevel = domainBindingFixture({
    level: 9999,
    authorizationResult: { Code: 0, Msg: 'sensitive authorization detail' },
  });
  const forgedLevelResult = executeDomainBinding(forgedLevel.V8);
  assert.equal(forgedLevelResult.Code, 0);
  assert.equal(forgedLevelResult.Data.DomainBindingStatus, 'Unauthorized');
  assert.doesNotMatch(JSON.stringify(forgedLevelResult), /sensitive authorization detail/);
  assert.equal(forgedLevel.state.authorizationCalls, 1);
  assert.equal(forgedLevel.state.queries.length, 0);
  assert.equal(forgedLevel.state.atomicCalls.length, 0);

  const missingAuthorization = domainBindingFixture({ noAuthorizationAtom: true });
  const missingAuthorizationResult = executeDomainBinding(missingAuthorization.V8);
  assert.equal(missingAuthorizationResult.Code, 0);
  assert.equal(missingAuthorizationResult.Data.DomainBindingStatus, 'PendingCapabilityUpgrade');
  assert.equal(missingAuthorization.state.queries.length, 0);
  assert.equal(missingAuthorization.state.atomicCalls.length, 0);

  const missingAtom = domainBindingFixture({ noAtom: true });
  const missingAtomResult = executeDomainBinding(missingAtom.V8);
  assert.equal(missingAtomResult.Code, 0);
  assert.equal(missingAtomResult.Data.DomainBindingStatus, 'PendingCapabilityUpgrade');
  assert.equal(missingAtom.state.atomicCalls.length, 0);
});

test('official external-domain control plane derives one exact record and never returns credentials', () => {
  assert.match(externalDomainBindingSource, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.doesNotThrow(() => new Function('V8', externalDomainBindingSource));
  assert.doesNotMatch(externalDomainBindingSource, /FormEngine|dns_sync_ip|UptESADomainRecord/);
  assert.match(
    externalDomainBindingSource,
    /V8\.Method\.AuthorizeExternalSaasTenantDomainBinding\(\)/,
  );
  assert.doesNotMatch(
    externalDomainBindingSource,
    /V8\.Method\.AuthorizeAdminTenantDomainBinding\(\)/,
  );

  const fixture = externalDomainBindingFixture({
    tenantKey: 'Hongdi-Dev',
    originDomain: 'DEV.CHONGSTECH.COM',
    param: {
      ApiEngineKey: 'admin_ensure_external_saas_tenant_domain_binding',
      OsClient: 'iTdos',
      _InvokeType: 'Client',
      _RequireApiRoleAuthorization: true,
      _TraceParent: '00-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-01',
      TestParam1: 'runtime-placeholder',
    },
  });
  const binding = executeExternalDomainBinding(fixture.V8);

  assert.equal(binding.Code, 1);
  assert.equal(binding.Data.TenantKey, 'hongdi-dev');
  assert.equal(binding.Data.DomainName, 'hongdi-dev.microi.net');
  assert.equal(binding.Data.DomainBindingStatus, 'Verified');
  assert.equal(binding.Data.BareDomainReady, true);
  assert.equal(binding.Data.RecordType, 'CNAME');
  assert.equal(binding.Data.Proxied, true);
  assert.equal(binding.Data.OriginDomain, 'dev.chongstech.com');
  assert.equal(binding.Data.OriginHost, 'dev.chongstech.com');
  assert.equal(binding.Data.OriginSni, 'dev.chongstech.com');
  assert.equal(binding.Data.HostPolicy, 'follow_origin_domain');
  assert.equal(fixture.state.authorizationCalls, 1);
  assert.deepEqual(fixture.state.atomicCalls, [{
    SiteName: 'microi.net',
    RecordName: 'hongdi-dev.microi.net',
    OriginDomain: 'dev.chongstech.com',
    AccessKeyId: fixture.state.accessKeyId,
    AccessKeySecret: fixture.state.accessKeySecret,
  }]);
  const serialized = JSON.stringify(binding);
  assert.doesNotMatch(serialized, new RegExp(fixture.state.accessKeyId));
  assert.doesNotMatch(serialized, new RegExp(fixture.state.accessKeySecret));
  assert.equal('TestParam1' in fixture.state.atomicCalls[0], false);
});

test('official external-domain control plane accepts only short scalar TestParam1 metadata', () => {
  for (const testParamValue of [undefined, null, '', 'runtime-placeholder', 0, 1, false, true]) {
    const fixture = externalDomainBindingFixture({ param: { TestParam1: testParamValue } });
    const binding = executeExternalDomainBinding(fixture.V8);

    assert.equal(binding.Code, 1);
    assert.equal(binding.Data.DomainBindingStatus, 'Verified');
    assert.equal(fixture.state.authorizationCalls, 1);
    assert.equal(fixture.state.atomicCalls.length, 1);
  }

  for (const testParamValue of [
    { nested: true },
    ['not', 'scalar'],
    'x'.repeat(201),
    function maliciousPlaceholder() {},
  ]) {
    const fixture = externalDomainBindingFixture({ param: { TestParam1: testParamValue } });
    const binding = executeExternalDomainBinding(fixture.V8);

    assert.equal(binding.Code, 0);
    assert.equal(binding.Data.DomainBindingStatus, 'RejectedInput');
    assert.equal(fixture.state.authorizationCalls, 0);
    assert.equal(fixture.state.atomicCalls.length, 0);
  }
});

test('official external-domain control plane accepts exact DNS length boundaries', () => {
  for (const options of [
    { tenantKey: 'a' },
    { tenantKey: 'a'.repeat(50) },
    { originDomain: `${'a'.repeat(63)}.example.com` },
  ]) {
    const fixture = externalDomainBindingFixture(options);
    const binding = executeExternalDomainBinding(fixture.V8);

    assert.equal(binding.Code, 1);
    assert.equal(binding.Data.DomainBindingStatus, 'Verified');
    assert.equal(fixture.state.authorizationCalls, 1);
    assert.equal(fixture.state.atomicCalls.length, 1);
  }
});

test('official external-domain control plane rejects malformed keys, origins and runtime metadata before authorization', () => {
  const invalidCases = [
    { tenantKey: '*.microi.net' },
    { tenantKey: 'bad.name' },
    { tenantKey: '-hongdi' },
    { tenantKey: 'hongdi-' },
    { tenantKey: 'x'.repeat(51) },
    { tenantKey: '宁波鸿地' },
    { param: { OriginDomain: '*.chongstech.com' } },
    { param: { OriginDomain: 'microi.net' } },
    { param: { OriginDomain: 'origin.microi.net' } },
    { param: { OriginDomain: 'https://dev.chongstech.com' } },
    { param: { OriginDomain: 'dev.chongstech.com:443' } },
    { param: { OriginDomain: 'dev.chongstech.com/path' } },
    { param: { OriginDomain: 'user@dev.chongstech.com' } },
    { param: { OriginDomain: '127.0.0.1' } },
    { param: { OriginDomain: '2001:db8::1' } },
    { param: { OriginDomain: 'localhost' } },
    { param: { OriginDomain: 'dev\\chongstech.com' } },
    { param: { OriginDomain: 'dev..chongstech.com' } },
    { param: { OriginDomain: `${'a'.repeat(64)}.example.com` } },
    { param: { OriginDomain: Array(4).fill('a'.repeat(63)).join('.') } },
    { param: { UnexpectedField: true } },
    { param: { _RequireApiRoleAuthorization: false } },
    { param: { _TraceParent: 'invalid' } },
    { param: { _InvokeType: 'BackgroundTask' } },
    { param: { ApiEngineKey: 'admin_ensure_saas_tenant_domain_binding' } },
    { param: { OsClient: 'another-tenant' } },
  ];

  for (const options of invalidCases) {
    const fixture = externalDomainBindingFixture(options);
    const binding = executeExternalDomainBinding(fixture.V8);

    assert.equal(binding.Code, 0);
    assert.equal(fixture.state.authorizationCalls, 0);
    assert.equal(fixture.state.atomicCalls.length, 0);
  }
});

test('official external-domain control plane fails closed for identity, capability and strong-readback drift', () => {
  const nonAdmin = externalDomainBindingFixture({ level: 1 });
  assert.equal(executeExternalDomainBinding(nonAdmin.V8).Data.DomainBindingStatus, 'Unauthorized');
  assert.equal(nonAdmin.state.authorizationCalls, 0);
  assert.equal(nonAdmin.state.atomicCalls.length, 0);

  const forged = externalDomainBindingFixture({
    authorizationResult: { Code: 0, Msg: 'sensitive authorization detail' },
  });
  const forgedResult = executeExternalDomainBinding(forged.V8);
  assert.equal(forgedResult.Data.DomainBindingStatus, 'Unauthorized');
  assert.doesNotMatch(JSON.stringify(forgedResult), /sensitive authorization detail/);
  assert.equal(forged.state.atomicCalls.length, 0);

  const missingAuthorization = externalDomainBindingFixture({ noAuthorizationAtom: true });
  assert.equal(
    executeExternalDomainBinding(missingAuthorization.V8).Data.DomainBindingStatus,
    'PendingCapabilityUpgrade',
  );
  assert.equal(missingAuthorization.state.atomicCalls.length, 0);

  const missingAtom = externalDomainBindingFixture({ noAtom: true });
  assert.equal(
    executeExternalDomainBinding(missingAtom.V8).Data.DomainBindingStatus,
    'PendingCapabilityUpgrade',
  );
  assert.equal(missingAtom.state.atomicCalls.length, 0);

  const authorizationThrows = externalDomainBindingFixture({ authorizationThrows: true });
  const authorizationThrowsResult = executeExternalDomainBinding(authorizationThrows.V8);
  assert.equal(authorizationThrowsResult.Data.DomainBindingStatus, 'Unauthorized');
  assert.doesNotMatch(JSON.stringify(authorizationThrowsResult), /sensitive authorization failure/);
  assert.equal(authorizationThrows.state.atomicCalls.length, 0);

  const missingCredential = externalDomainBindingFixture({
    mainModel: { AlidnsKeyId: '', AlidnsKeySecret: '' },
  });
  assert.equal(
    executeExternalDomainBinding(missingCredential.V8).Data.DomainBindingStatus,
    'MissingCredential',
  );
  assert.equal(missingCredential.state.atomicCalls.length, 0);

  const modelMismatch = externalDomainBindingFixture({ modelOsClient: 'another-tenant' });
  assert.equal(
    executeExternalDomainBinding(modelMismatch.V8).Data.DomainBindingStatus,
    'RejectedContext',
  );
  assert.equal(modelMismatch.state.atomicCalls.length, 0);

  const atomicThrows = externalDomainBindingFixture({ atomicThrows: true });
  const atomicThrowsResult = executeExternalDomainBinding(atomicThrows.V8);
  assert.equal(atomicThrowsResult.Data.DomainBindingStatus, 'Failed');
  assert.doesNotMatch(JSON.stringify(atomicThrowsResult), /sensitive ESA failure/);
  assert.equal(atomicThrows.state.atomicCalls.length, 1);

  for (const atomicResult of [null, { Code: 0, Msg: 'sensitive provider failure' }]) {
    const atomFailure = externalDomainBindingFixture({ atomicResult });
    const atomFailureResult = executeExternalDomainBinding(atomFailure.V8);
    assert.equal(atomFailureResult.Data.DomainBindingStatus, 'Failed');
    assert.doesNotMatch(JSON.stringify(atomFailureResult), /sensitive provider failure/);
    assert.doesNotMatch(JSON.stringify(atomFailureResult), new RegExp(atomFailure.state.accessKeyId));
    assert.doesNotMatch(
      JSON.stringify(atomFailureResult),
      new RegExp(atomFailure.state.accessKeySecret),
    );
    assert.equal(atomFailure.state.atomicCalls.length, 1);
  }

  const desiredReadback = {
    Action: 'Updated', SiteName: 'microi.net', RecordId: 30003,
    ControlPlaneVerified: true, BareDomainReady: true,
    DataPlaneStatus: 'Ready', HttpStatus: 200, Diagnostic: 'ready',
    RecordName: 'hongdi-dev.microi.net', RecordType: 'CNAME',
    OriginDomain: 'dev.chongstech.com', OriginHost: 'dev.chongstech.com',
    OriginSni: 'dev.chongstech.com', SourceType: 'Domain', BizName: 'web',
    HostPolicy: 'follow_origin_domain', HttpPorts: '80', HttpsPorts: '443',
    Ttl: 1, Proxied: true,
  };
  const readbackDrifts = [
    ['SiteName', 'example.com'],
    ['RecordName', 'other.microi.net'],
    ['RecordType', 'A'],
    ['OriginDomain', 'other.example.com'],
    ['OriginHost', 'other.example.com'],
    ['OriginSni', 'other.example.com'],
    ['SourceType', 'IP'],
    ['BizName', 'api'],
    ['HostPolicy', 'follow_hostname'],
    ['HttpPorts', '8080'],
    ['HttpsPorts', '8443'],
    ['Ttl', 60],
    ['Proxied', false],
  ];
  for (const [field, value] of readbackDrifts) {
    const drift = externalDomainBindingFixture({
      atomicResult: {
      Code: 1,
        Data: { ...desiredReadback, [field]: value },
      },
    });
    const driftResult = executeExternalDomainBinding(drift.V8);
    assert.equal(driftResult.Code, 0, field);
    assert.equal(driftResult.Data.DomainBindingStatus, 'ReadbackMismatch', field);
    assert.equal(drift.state.atomicCalls.length, 1, field);
  }
});

test('manual engine accepts only a durable task and forwards safe tenant locators', () => {
  assert.match(engineSource, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.doesNotThrow(() => new Function('V8', engineSource));
  assert.doesNotMatch(engineSource, /DbConn|DbReadConn|ExpectedDatabaseName|Password\s*:/);

  let hostRequest;
  const progress = [];
  const result = execute({
    Param: {
      TenantId: 'tenant-row-id',
      TenantKey: 'jisu1',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      _BackgroundTaskId: 'task-id',
      _BackgroundTaskFencingToken: 7,
      ApiEngineKey: 'admin_upgrade_saas_tenant_database',
      OsClient: 'iTdos',
      _RequireApiRoleAuthorization: true,
      _TraceParent: '00-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-00',
      _BackgroundTaskTitle: '租户数据库升级',
      _BackgroundTaskIdempotencyKey: 'upgrade:test-tenant:v1',
      _BackgroundTaskAttempt: 1,
      _TrustedServerInvocation: true,
      _BackgroundTask: { Id: 'task-id', FencingToken: 7 },
      _InvokeType: 'Client',
    },
    Method: {
      UpdateBackgroundTask(value) { progress.push(value); },
      UpgradeAdminTenantDatabase(value) {
        hostRequest = value;
        return {
          Code: 1,
          Data: { BeforeVersion: '7.8.5', TargetVersion: '7.8.6', AfterVersion: '7.8.6' },
          Msg: '完成',
        };
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.deepEqual(hostRequest, {
    TenantId: 'tenant-row-id',
    TenantKey: 'jisu1',
    OsClientType: 'Product',
    OsClientNetwork: 'Internal',
    _BackgroundTaskId: 'task-id',
    _BackgroundTaskFencingToken: 7,
  });
  assert.equal(progress.at(0).Progress, 1);
  assert.equal(progress.at(-1).Progress, 100);
  assert.doesNotMatch(JSON.stringify(hostRequest), /Password|DbConn/);
});

test('manual engine fails closed without the task fence or trusted host atom', () => {
  const base = {
    TenantId: 'tenant-row-id', TenantKey: 'jisu1',
    OsClientType: 'Product', OsClientNetwork: 'Internal',
    _BackgroundTaskId: 'task-id', _BackgroundTaskFencingToken: 7,
    _TrustedServerInvocation: true, _InvokeType: 'Client',
  };
  assert.equal(execute({ Param: { ...base, _BackgroundTaskFencingToken: 0 }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: base, Method: { UpdateBackgroundTask() {} } }).Code, 0);
  assert.equal(execute({ Param: { ...base, Password: 'must-not-enter-logs' }, Method: {} }).Code, 0);
  assert.match(
    execute({ Param: { ...base, UnexpectedTransportField: 'secret-value' }, Method: {} }).Msg,
    /UnexpectedTransportField/,
  );
  assert.doesNotMatch(
    execute({ Param: { ...base, UnexpectedTransportField: 'secret-value' }, Method: {} }).Msg,
    /secret-value/,
  );
  assert.equal(execute({ Param: { ...base, _RequireApiRoleAuthorization: false }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TrustedServerInvocation: false }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TrustedServerInvocation: undefined }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _InvokeType: 'Server' }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _BackgroundTaskAttempt: -1 }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TraceParent: 'invalid' }, Method: {} }).Code, 0);
});

test('both embedded platform-service bundles contain the progress route and same runtime', () => {
  const findBundle = model => model.ApplicationBundles
    .find(item => item.Application?.AppKey === 'microi-platform-service');
  const saasBundle = findBundle(packageModel);
  const storeBundle = findBundle(storePackage);
  for (const bundle of [saasBundle, storeBundle]) {
    assert.equal(bundle.VersionNo, 'v1.9.16');
    assert.equal(bundle.Application.CurrentVersion, 58);
    assert.ok(bundle.Routes.some(route => route.RoutePath === '/tenant-database-upgrade'));
  }
  assert.equal(saasBundle.MicroService.DistHash, storeBundle.MicroService.DistHash);
});
