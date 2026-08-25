import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(resourceDir, '..', '..', '..');

const read = (filePath) => fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
const readResource = (name) => read(path.join(resourceDir, name));
const readPackage = (name) => JSON.parse(readResource(name));
const normalizeSource = (source) => `${String(source || '').replace(/\r\n?/g, '\n').trimEnd()}\n`;

const messagePackage = readPackage('app.microi.message-notification.json');
const storePackage = readPackage('app.microi.store.json');
const saasPackage = readPackage('app.microi.saas-engine.json');
const officialPackages = [
  'app.microi.store.json',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.sys_user.json',
  'app.microi.sys-config.json',
  'app.microi.message-notification.json',
  'app.microi.ai-engine.json',
].map(readPackage);

const MESSAGE_SELECTED_API_ENGINE_KEYS = Object.freeze([
  'msg_event',
  'msg_internal_list',
  'msg_internal_mark_read',
  'platform-chat-system-message',
  'platform-chat-runtime',
  'platform-message-notification-custom-hook',
]);

const STORE_SELECTED_API_ENGINE_KEYS = Object.freeze([
  'ai_app_build_file',
  'ai_app_prepare_store_assets',
  'ai_app_publish_store',
  'get-microi-upgrade-resource',
  'ai_app_download_build_zip',
  'ai_app_download_source_zip',
  'ai_app_preview',
  'ai_app_build',
  'ai_app_create',
  'ai_app_save_file',
  'ai_app_get_file',
  'ai_app_detail',
  'ai_app_list',
  'import-microi-store-package',
  'export-microi-store-package',
  'get-microi-store-model',
  'get-microi-store',
  'bulk-import-microi-store-packages',
  'get-microi-store-versions',
  'microi-store-package-storage',
  'compact-microi-store-packages',
  'platform-background-task',
  'platform-sys-menu',
  'platform-marketplace-source',
  'platform-marketplace-source-hook',
]);

function engine(packageModel, key) {
  const matches = (packageModel.SysApiEngines || []).filter(
    (item) => item.ApiEngineKey === key,
  );
  assert.equal(matches.length, 1, `${packageModel.PackageInfo?.Name}:${key}`);
  return matches[0];
}

function stripLeadingBlockComments(source) {
  let body = normalizeSource(source).trimStart();
  while (body.startsWith('/*')) {
    const end = body.indexOf('*/');
    assert.notEqual(end, -1, 'unterminated leading block comment');
    body = body.slice(end + 2).trimStart();
  }
  return body.trim();
}

function assertPackageKeyClosure(packageModel, expectedKeys) {
  const actualKeys = (packageModel.SysApiEngines || []).map((item) => item.ApiEngineKey);
  const policyKeys = Object.keys(packageModel.ResourcePolicies?.ApiEngines || {});
  assert.deepEqual([...actualKeys].sort(), [...expectedKeys].sort());
  assert.deepEqual([...policyKeys].sort(), [...expectedKeys].sort());
  assert.equal(packageModel.PackageInfo.ApiEngineCount, expectedKeys.length);
}

function assertOfficialPair({
  packageModel,
  appName,
  managedKey,
  managedFile,
  managedVersion = 'v1.0.0',
  hookKey,
  hookFile,
}) {
  const managed = engine(packageModel, managedKey);
  const hook = engine(packageModel, hookKey);
  const policies = packageModel.ResourcePolicies.ApiEngines;

  assert.deepEqual(policies[managedKey], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.deepEqual(policies[hookKey], {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  });
  for (const item of [managed, hook]) {
    assert.equal(item.IsEnable, 1, `${item.ApiEngineKey}:IsEnable`);
    assert.equal(item.StopHttp, 1, `${item.ApiEngineKey}:StopHttp`);
    assert.equal(item.AllowAnonymous, 0, `${item.ApiEngineKey}:AllowAnonymous`);
  }

  assert.match(managed.ApiV8Code, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(managed.ApiV8Code, new RegExp(appName));
  assert.match(managed.ApiV8Code, /安装、更新或重新安装/);
  assert.match(managed.ApiV8Code, /CreateIfMissing/);
  assert.match(hook.ApiV8Code, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.match(hook.ApiV8Code, new RegExp(appName));
  assert.match(hook.ApiV8Code, /官方升级不会覆盖/);
  assert.equal(stripLeadingBlockComments(hook.ApiV8Code), 'return { Code : 1 };');

  assert.equal(managed.ApiV8Code, normalizeSource(readResource(managedFile)));
  assert.equal(hook.ApiV8Code, normalizeSource(readResource(hookFile)));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    `ApiEngine:${managedKey}@${managedVersion}`,
  ));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    `ApiEngine:${hookKey}@v1.0.0`,
  ));
}

test('message-notification and Store selected ApiEngine key sets stay exact and policy-closed', () => {
  assertPackageKeyClosure(messagePackage, MESSAGE_SELECTED_API_ENGINE_KEYS);
  assertPackageKeyClosure(storePackage, STORE_SELECTED_API_ENGINE_KEYS);
  assert.equal(messagePackage.PackageInfo.Version, 'v1.0.9');
  assert.equal(storePackage.PackageInfo.Version, 'v7.6.9');
});

test('official package ApiEngine stable identities are globally unique', () => {
  const ids = new Map();
  const keys = new Map();
  for (const packageModel of officialPackages) {
    const packageName = packageModel.PackageInfo?.Name || 'unknown';
    for (const item of packageModel.SysApiEngines || []) {
      const id = String(item.Id || '').trim().toLowerCase();
      const key = String(item.ApiEngineKey || '').trim().toLowerCase();
      assert.ok(id, `${packageName}:${key || 'unknown'} must have a stable Id`);
      assert.ok(key, `${packageName}:${id} must have an ApiEngineKey`);
      assert.equal(ids.has(id), false,
        `stable Id ${id} is shared by ${ids.get(id)} and ${packageName}:${key}`);
      assert.equal(keys.has(key), false,
        `ApiEngineKey ${key} is shared by ${keys.get(key)} and ${packageName}:${id}`);
      ids.set(id, `${packageName}:${key}`);
      keys.set(key, `${packageName}:${id}`);
    }
  }
});

test('official Managed cores and CreateIfMissing hooks carry immutable package contracts', () => {
  assertOfficialPair({
    packageModel: messagePackage,
    appName: '消息通知',
    managedKey: 'platform-chat-system-message',
    managedFile: 'platform-chat-system-message.js',
    managedVersion: 'v1.1.0',
    hookKey: 'platform-message-notification-custom-hook',
    hookFile: 'platform-message-notification-custom-hook.js',
  });
  assertOfficialPair({
    packageModel: storePackage,
    appName: '应用商城',
    managedKey: 'platform-marketplace-source',
    managedFile: 'platform-marketplace-source.js',
    hookKey: 'platform-marketplace-source-hook',
    hookFile: 'platform-marketplace-source-hook.js',
  });

  const chatRuntime = engine(messagePackage, 'platform-chat-runtime');
  assert.deepEqual(messagePackage.ResourcePolicies.ApiEngines['platform-chat-runtime'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.equal(chatRuntime.Version, 'v1.0.1');
  assert.equal(chatRuntime.StopHttp, 1);
  assert.equal(chatRuntime.AllowAnonymous, 0);
  assert.equal(chatRuntime.ApiV8Code, normalizeSource(readResource('platform-chat-runtime.js')));
  assert.ok(messagePackage.PackageInfo.RequiredPlatformCapabilities.includes(
    'ApiEngine:platform-chat-runtime@v1.0.1',
  ));
  assert.ok(messagePackage.PackageInfo.RequiredPlatformCapabilities.includes(
    'V8.Method.RequireManagedProtocolContext',
  ));
  assert.ok(messagePackage.PackageInfo.RequiredPlatformCapabilities.includes(
    'V8.MongoDb.UptFormDataByWhere',
  ));
  assert.ok(messagePackage.PackageInfo.RequiredPlatformCapabilities.includes(
    'V8.MongoDb.DelFormDataByWhere',
  ));
  assert.match(engine(messagePackage, 'platform-chat-system-message').ApiV8Code,
    /V8\.ApiEngine\.Run\('platform-chat-runtime',[\s\S]*V8\.DbTrans\)/);
  assert.match(chatRuntime.ApiV8Code,
    /V8\.ApiEngine\.Run\([\s\S]*HOOK_KEY[\s\S]*V8\.DbTrans\)/);
  assert.match(chatRuntime.ApiV8Code, /CHAT_SIGNALR_TRUSTED_PROTOCOL_V1/);
  assert.match(chatRuntime.ApiV8Code, /V8\.Method\.RequireManagedProtocolContext\(\)/);
  assert.match(engine(storePackage, 'platform-marketplace-source').ApiV8Code,
    /V8\.ApiEngine\.Run\('platform-marketplace-source-hook',[\s\S]*V8\.DbTrans\)/);
});

test('external-login and WeChat persistence remain locked Managed SaaS engines', () => {
  for (const [key, file] of [
    ['platform-external-login-binding', 'platform-external-login-binding.js'],
    ['platform-wechat-user-binding', 'platform-wechat-user-binding.js'],
  ]) {
    const item = engine(saasPackage, key);
    assert.equal(item.IsEnable, 1, key);
    assert.equal(item.StopHttp, 1, key);
    assert.equal(item.AllowAnonymous, 0, key);
    assert.equal(item.Lock, 1, key);
    assert.deepEqual(saasPackage.ResourcePolicies.ApiEngines[key], {
      Ownership: 'Platform',
      UpgradePolicy: 'Managed',
    });
    assert.equal(item.ApiV8Code, normalizeSource(readResource(file)));
    assert.match(item.ApiV8Code, /StopHttp=1, AllowAnonymous=0, Lock=1/);
  }
});

test('Store pre-authorization hook receives only the minimal safe payload and gates the operation', () => {
  const source = engine(storePackage, 'platform-marketplace-source').ApiV8Code;
  const execute = new Function('V8', 'DateNow', source);
  const dbTrans = { id: 'shared-transaction' };
  const calls = [];
  const baseV8 = {
    OsClient: 'tenant-a',
    CurrentUser: { Id: 'admin-1', Name: 'Admin', Level: 999 },
    DbTrans: dbTrans,
    ApiEngine: {
      Run: (key, payload, transaction) => {
        calls.push({ key, payload, transaction });
        return { Code: 1 };
      },
    },
  };

  const loginResult = execute({
    ...baseV8,
    Param: {
      Action: 'AuthorizeOperation',
      AuditAction: 'MarketplaceSourceLogin',
      SourceId: 'official',
      ApiBase: 'https://private.example.test',
      RemoteOsClient: 'private-tenant',
      Account: 'private-account',
      Password: 'private-password',
      Token: 'private-token',
    },
  }, () => '2026-08-25 12:00:00');
  assert.equal(loginResult.Code, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, 'platform-marketplace-source-hook');
  assert.equal(calls[0].transaction, dbTrans);
  assert.deepEqual(calls[0].payload, {
    Stage: 'BeforeMarketplaceSourceLogin',
    SourceApiEngineKey: 'platform-marketplace-source',
    Action: 'MarketplaceSourceLogin',
    SourceId: 'official',
  });
  assert.doesNotMatch(JSON.stringify(calls[0].payload),
    /ApiBase|RemoteOsClient|Account|Password|Token|private/i);

  calls.length = 0;
  const disconnectResult = execute({
    ...baseV8,
    Param: {
      Action: 'AuthorizeOperation',
      AuditAction: 'MarketplaceSourceDisconnect',
      SourceId: 'official',
      Token: 'private-token',
    },
  }, () => '2026-08-25 12:00:00');
  assert.equal(disconnectResult.Code, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].transaction, dbTrans);
  assert.deepEqual(calls[0].payload, {
    Stage: 'BeforeMarketplaceSourceDisconnect',
    SourceApiEngineKey: 'platform-marketplace-source',
    Action: 'MarketplaceSourceDisconnect',
    SourceId: 'official',
  });
  assert.doesNotMatch(JSON.stringify(calls[0].payload), /Token|private/i);

  let auditWritten = false;
  const denied = { Code: 0, Msg: 'tenant hook denied' };
  const deniedResult = execute({
    ...baseV8,
    Param: {
      Action: 'AuthorizeOperation',
      AuditAction: 'MarketplaceSourceDisconnect',
      SourceId: 'official',
    },
    ApiEngine: { Run: () => denied },
    Method: { AddSysLog: () => { auditWritten = true; return { Code: 1 }; } },
  }, () => '2026-08-25 12:00:00');
  assert.deepEqual(deniedResult, denied);
  assert.equal(auditWritten, false);
});

test('MarketplaceSourceController authorizes before remote login, credential save, or delete', () => {
  const controller = read(path.join(
    workspaceRoot,
    'Microi.Server',
    'Microi.net.Api',
    'Controllers',
    'MarketplaceSourceController.cs',
  ));
  const loginStart = controller.indexOf('public async Task<JsonResult> Login');
  const queryStart = controller.indexOf('public async Task<JsonResult> Query', loginStart);
  const disconnectStart = controller.indexOf('public async Task<JsonResult> Disconnect', queryStart);
  const readCountStart = controller.indexOf('private async Task<int> ReadApplicationCountAsync', disconnectStart);
  assert.ok(loginStart >= 0 && queryStart > loginStart);
  assert.ok(disconnectStart > queryStart && readCountStart > disconnectStart);

  const loginBody = controller.slice(loginStart, queryStart);
  const loginAuthorize = loginBody.indexOf('AuthorizeOperationAsync(');
  assert.ok(loginAuthorize >= 0);
  assert.ok(loginAuthorize < loginBody.indexOf('SendJsonAsync('));
  assert.ok(loginAuthorize < loginBody.indexOf('SendFormAsync('));
  assert.ok(loginAuthorize < loginBody.indexOf('SaveCredentialAsync('));

  const disconnectBody = controller.slice(disconnectStart, readCountStart);
  const disconnectAuthorize = disconnectBody.indexOf('AuthorizeOperationAsync(');
  assert.ok(disconnectAuthorize >= 0);
  assert.ok(disconnectAuthorize < disconnectBody.indexOf('DelFormDataAsync('));

  const authorizeMethodStart = controller.indexOf('private static async Task<JObject> AuthorizeOperationAsync');
  const recordAuditMethodStart = controller.indexOf('private static async Task<JObject> RecordAuditAsync');
  const authorizeMethod = controller.slice(authorizeMethodStart, recordAuditMethodStart);
  const payloadFields = [...authorizeMethod.matchAll(/\["([^"]+)"\]\s*=/g)]
    .map((match) => match[1]);
  assert.deepEqual(payloadFields, ['Action', 'OsClient', 'AuditAction', 'SourceId']);
});
