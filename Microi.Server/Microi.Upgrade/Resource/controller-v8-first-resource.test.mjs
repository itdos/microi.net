import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(resourceDir, '..', '..', '..');
const serverRoot = path.join(repoRoot, 'Microi.Server');
const apiControllerDir = path.join(serverRoot, 'Microi.net.Api', 'Controllers');
const apiHandlerDir = path.join(serverRoot, 'Microi.net.Api', 'Handler');
const read = (file) => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const resources = {
  external: read(path.join(resourceDir, 'platform-external-login-binding.js')),
  wechat: read(path.join(resourceDir, 'platform-wechat-user-binding.js')),
  chat: read(path.join(resourceDir, 'platform-chat-system-message.js')),
  chatRuntime: read(path.join(resourceDir, 'platform-chat-runtime.js')),
  messageHook: read(path.join(resourceDir, 'platform-message-notification-custom-hook.js')),
  marketplace: read(path.join(resourceDir, 'platform-marketplace-source.js')),
  marketplaceHook: read(path.join(resourceDir, 'platform-marketplace-source-hook.js')),
};

const execute = Object.fromEntries(Object.entries(resources)
  .filter(([key]) => !key.endsWith('Hook'))
  .map(([key, source]) => [key, new Function('V8', 'DateNow', source)]));
const now = () => '2026-08-25 12:00:00';

test('standalone engines declare official ownership notices and compile', () => {
  for (const [key, source] of Object.entries(resources)) {
    assert.match(source, /OFFICIAL_(?:MANAGED|CREATE_IF_MISSING)_API_ENGINE_NOTICE_V1/, key);
    assert.match(source, /ApiEngineKey：platform-/, key);
  }
  assert.match(resources.marketplaceHook, /OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.match(resources.marketplaceHook, /return \{ Code : 1 \};/);
  assert.match(resources.messageHook, /OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.match(resources.messageHook, /return \{ Code : 1 \};/);
  assert.doesNotThrow(() => new Function(resources.marketplaceHook));
  assert.doesNotThrow(() => new Function(resources.messageHook));
  assert.match(resources.external, /StopHttp=1, AllowAnonymous=0, Lock=1/);
  assert.match(resources.wechat, /StopHttp=1, AllowAnonymous=0, Lock=1/);
  for (const key of ['external', 'wechat', 'chat', 'chatRuntime', 'marketplace']) {
    assert.match(resources[key], /ApiEngine\.Run\([\s\S]*V8\.DbTrans\)/, key);
  }
});

test('forged protocol booleans cannot authorize external or WeChat persistence', () => {
  let touched = false;
  const deniedMethod = {
    RequireManagedProtocolContext: () => ({ Code: 0, Msg: 'denied' }),
    NewGuid: () => 'new-id',
  };
  const formEngine = new Proxy({}, { get: () => () => { touched = true; throw new Error('must not query'); } });
  const externalResult = execute.external({
    Param: {
      Action: 'Resolve',
      ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
      _TrustedExternalLoginProtocol: true,
    },
    Method: deniedMethod,
    FormEngine: formEngine,
  }, now);
  const wechatResult = execute.wechat({
    Param: {
      Action: 'Bind',
      TrustedUserId: 'user-1',
      WxMpId: 'mp-1',
      WxOpenId: 'openid-secret',
      _TrustedWeChatProtocol: true,
    },
    Method: deniedMethod,
    FormEngine: formEngine,
  }, now);
  assert.equal(externalResult.Code, 0);
  assert.equal(wechatResult.Code, 0);
  assert.equal(touched, false);
  assert.doesNotMatch(resources.external, /param\._TrustedExternalLoginProtocol/);
  assert.doesNotMatch(resources.wechat, /param\._TrustedWeChatProtocol/);
});

test('external identity lookup propagates Code=0 and only Code=2 means missing', () => {
  const hooks = [];
  const result = execute.external({
    Param: { Action: 'Resolve', ProviderKey: 'GitHub', ProviderSubject: 'subject-secret' },
    Method: { RequireManagedProtocolContext: () => ({ Code: 1 }) },
    ApiEngine: { Run: (_key, payload) => { hooks.push(payload); return { Code: 1 }; } },
    FormEngine: { GetFormData: () => ({ Code: 0, Msg: 'database unavailable' }) },
  }, now);
  assert.deepEqual(result, { Code: 0, Msg: 'database unavailable' });
  assert.equal(hooks.length, 1);
  assert.doesNotMatch(JSON.stringify(hooks), /subject-secret|ProviderSubject/i);

  let inserted = false;
  const bindLookups = [
    { Code: 1, Data: { Id: 'user-1' } },
    { Code: 2 },
    { Code: 0, Msg: 'secondary lookup failed' },
  ];
  const bindResult = execute.external({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
    },
    Method: {
      RequireManagedProtocolContext: () => ({ Code: 1 }),
      NewGuid: () => 'binding-1',
    },
    ApiEngine: { Run: () => ({ Code: 1 }) },
    FormEngine: {
      GetFormData: () => bindLookups.shift(),
      AddFormData: () => { inserted = true; return { Code: 1 }; },
    },
  }, now);
  assert.deepEqual(bindResult, { Code: 0, Msg: 'secondary lookup failed' });
  assert.equal(inserted, false);

  const malformedSubjectResult = execute.external({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
    },
    Method: {
      RequireManagedProtocolContext: () => ({ Code: 1 }),
      NewGuid: () => 'binding-1',
    },
    ApiEngine: { Run: () => ({ Code: 1 }) },
    FormEngine: {
      GetFormData: (() => {
        const results = [{ Code: 1, Data: { Id: 'user-1' } }, { Code: 1, Data: null }];
        return () => results.shift();
      })(),
      AddFormData: () => { inserted = true; return { Code: 1 }; },
    },
  }, now);
  assert.equal(malformedSubjectResult.Code, 0);
  assert.equal(inserted, false);

  const malformedUserProviderResult = execute.external({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
    },
    Method: {
      RequireManagedProtocolContext: () => ({ Code: 1 }),
      NewGuid: () => 'binding-1',
    },
    ApiEngine: { Run: () => ({ Code: 1 }) },
    FormEngine: {
      GetFormData: (() => {
        const results = [
          { Code: 1, Data: { Id: 'user-1' } },
          { Code: 2 },
          { Code: 1, Data: null },
        ];
        return () => results.shift();
      })(),
      AddFormData: () => { inserted = true; return { Code: 1 }; },
    },
  }, now);
  assert.equal(malformedUserProviderResult.Code, 0);
  assert.equal(inserted, false);
});

test('external binding hooks receive only safe identifiers and gate persistence', () => {
  const hooks = [];
  const calls = [];
  const lookupResults = [
    { Code: 1, Data: { Id: 'user-1' } },
    { Code: 2 },
    { Code: 2 },
  ];
  const result = execute.external({
    Param: {
      Action: 'Bind',
      TrustedUserId: 'user-1',
      ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
      AccountName: 'octocat',
      Email: 'private@example.test',
    },
    Method: {
      RequireManagedProtocolContext: () => ({ Code: 1 }),
      NewGuid: () => 'binding-1',
    },
    ApiEngine: { Run: (key, payload) => { hooks.push({ key, payload }); return { Code: 1 }; } },
    FormEngine: {
      GetFormData: () => lookupResults.shift(),
      AddFormData: (table, model) => { calls.push({ table, model }); return { Code: 1 }; },
      UptFormData: () => { throw new Error('unexpected update'); },
    },
  }, now);
  assert.equal(result.Code, 1);
  assert.equal(calls.length, 1);
  assert.equal(hooks.length, 2);
  const hookJson = JSON.stringify(hooks);
  assert.doesNotMatch(hookJson, /subject-secret|private@example\.test|ProviderSubject|Email/i);
  assert.match(hookJson, /BeforeExternalIdentityBind/);
  assert.match(hookJson, /AfterExternalIdentityBind/);
});

test('WeChat hooks stay secret-safe and system chat delegates only to the fixed runtime', () => {
  const wechatHooks = [];
  const wechatResult = execute.wechat({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', WxMpId: 'mp-1',
      WxOpenId: 'openid-secret', WxNickName: 'nickname-secret', WxAvatar: 'avatar-secret',
    },
    Method: { RequireManagedProtocolContext: () => ({ Code: 1 }) },
    ApiEngine: { Run: (key, payload) => { wechatHooks.push({ key, payload }); return { Code: 1 }; } },
    FormEngine: {
      GetFormData: (() => {
        const results = [{ Code: 1, Data: { Id: 'user-1', WxMpId: 'mp-1' } }, { Code: 2 }];
        return () => results.shift();
      })(),
      UptFormData: () => ({ Code: 1 }),
    },
  }, now);
  assert.equal(wechatResult.Code, 1);
  assert.doesNotMatch(JSON.stringify(wechatHooks), /openid-secret|nickname-secret|avatar-secret|WxOpenId/i);

  const chatCalls = [];
  const chatResult = execute.chat({
    Param: {
      Action: 'PersistSystemMessage', RequestId: 'request-1', ToUserId: 'user-2',
      Content: 'message-content', Assistant: { UserId: 'forged-sender' },
    },
    CurrentUser: { Id: 'admin-1', Level: 9999 },
    ApiEngine: { Run: (key, payload) => { chatCalls.push({ key, payload }); return { Code: 1 }; } },
  }, now);
  assert.equal(chatResult.Code, 1);
  assert.equal(chatCalls.length, 1);
  assert.equal(chatCalls[0].key, 'platform-chat-runtime');
  assert.equal(chatCalls[0].payload.Content, 'message-content');
  assert.doesNotMatch(JSON.stringify(chatCalls), /forged-sender|Assistant/i);
});

test('marketplace audit uses its independent hook without leaking gateway secrets', () => {
  const hooks = [];
  let log = null;
  const result = execute.marketplace({
    Param: {
      Action: 'RecordAudit', AuditAction: 'MarketplaceSourceLogin', Success: true,
      SourceId: 'official', ApiBase: 'https://store.example.test', RemoteOsClient: 'remote',
      Token: 'must-never-enter-engine', Password: 'must-never-enter-engine',
    },
    OsClient: 'tenant-a',
    CurrentUser: { Id: 'admin-1', Name: 'Admin', Level: 9999 },
    ApiEngine: { Run: (key, payload) => { hooks.push({ key, payload }); return { Code: 1 }; } },
    Method: { AddSysLog: (payload) => { log = payload; return { Code: 1 }; } },
  }, now);
  assert.equal(result.Code, 1);
  assert.equal(log.Action, 'MarketplaceSourceLogin');
  assert.equal(hooks.length, 1);
  assert.ok(hooks.every(item => item.key === 'platform-marketplace-source-hook'));
  assert.equal(hooks[0].payload.Stage, 'AfterMarketplaceSourceLogin');
  assert.doesNotMatch(JSON.stringify(hooks), /ApiBase|RemoteOsClient|Token|Password|store\.example/i);

  const authorizeHooks = [];
  const authorizeResult = execute.marketplace({
    Param: {
      Action: 'AuthorizeOperation', AuditAction: 'MarketplaceSourceLogin',
      SourceId: 'official', ApiBase: 'https://store.example.test',
      Token: 'must-never-enter-hook',
    },
    OsClient: 'tenant-a',
    CurrentUser: { Id: 'admin-1', Name: 'Admin', Level: 9999 },
    ApiEngine: { Run: (key, payload) => { authorizeHooks.push({ key, payload }); return { Code: 1 }; } },
  }, now);
  assert.equal(authorizeResult.Code, 1);
  assert.equal(authorizeHooks.length, 1);
  assert.equal(authorizeHooks[0].payload.Stage, 'BeforeMarketplaceSourceLogin');
  assert.doesNotMatch(JSON.stringify(authorizeHooks), /ApiBase|Token|store\.example/i);
});

test('tenant hook failures are returned and block each Before stage', () => {
  const denied = { Code: 0, Msg: 'tenant hook denied' };

  let externalSaved = false;
  const externalLookups = [
    { Code: 1, Data: { Id: 'user-1' } },
    { Code: 2 },
    { Code: 2 },
  ];
  const externalResult = execute.external({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', ProviderKey: 'GitHub',
      ProviderSubject: 'subject-secret',
    },
    Method: { RequireManagedProtocolContext: () => ({ Code: 1 }), NewGuid: () => 'binding-1' },
    ApiEngine: { Run: () => denied },
    FormEngine: {
      GetFormData: () => externalLookups.shift(),
      AddFormData: () => { externalSaved = true; return { Code: 1 }; },
      UptFormData: () => { externalSaved = true; return { Code: 1 }; },
    },
  }, now);
  assert.deepEqual(externalResult, denied);
  assert.equal(externalSaved, false);

  let wechatSaved = false;
  const wechatLookups = [
    { Code: 1, Data: { Id: 'user-1', WxMpId: 'mp-1' } },
    { Code: 2 },
  ];
  const wechatResult = execute.wechat({
    Param: {
      Action: 'Bind', TrustedUserId: 'user-1', WxMpId: 'mp-1', WxOpenId: 'openid-secret',
    },
    Method: { RequireManagedProtocolContext: () => ({ Code: 1 }) },
    ApiEngine: { Run: () => denied },
    FormEngine: {
      GetFormData: () => wechatLookups.shift(),
      UptFormData: () => { wechatSaved = true; return { Code: 1 }; },
    },
  }, now);
  assert.deepEqual(wechatResult, denied);
  assert.equal(wechatSaved, false);

  let chatRead = false;
  const chatResult = execute.chat({
    Param: { Action: 'PersistSystemMessage', RequestId: 'request-1', ToUserId: 'user-2', Content: 'secret' },
    CurrentUser: { Id: 'admin-1', Level: 9999 },
    ApiEngine: { Run: () => denied },
    FormEngine: { GetFormData: () => { chatRead = true; return { Code: 1 }; } },
  }, now);
  assert.deepEqual(chatResult, denied);
  assert.equal(chatRead, false);

  let auditWritten = false;
  const marketplaceResult = execute.marketplace({
    Param: {
      Action: 'AuthorizeOperation', AuditAction: 'MarketplaceSourceLogin',
      SourceId: 'official',
    },
    OsClient: 'tenant-a',
    CurrentUser: { Id: 'admin-1', Level: 9999 },
    ApiEngine: { Run: () => denied },
    Method: { AddSysLog: () => { auditWritten = true; return { Code: 1 }; } },
  }, now);
  assert.deepEqual(marketplaceResult, denied);
  assert.equal(auditWritten, false);
});

test('controllers use fixed Managed keys while protocol and transport shells remain in C#', () => {
  const external = read(path.join(apiControllerDir, 'ExternalLoginController.cs'));
  const wechat = read(path.join(apiControllerDir, 'WeChatController.cs'));
  const chat = read(path.join(apiControllerDir, 'LegacyMobileCompatibilityController.cs'));
  const marketplace = read(path.join(apiControllerDir, 'MarketplaceSourceController.cs'));
  const chatHub = read(path.join(apiHandlerDir, 'DiyWebSocket.cs'));
  const bridge = read(path.join(serverRoot, 'Microi.Core', 'ApiEngine', 'ManagedApiEngineCompatibility.cs'));
  const trustedContext = read(path.join(serverRoot, 'Microi.Core', 'Runtime', 'V8TrustedExecutionContext.cs'));
  const publicApiEngine = read(path.join(serverRoot, 'Microi.Core', 'ApiEngine', 'IApiEngine.cs'));
  const hostRunner = read(path.join(serverRoot, 'Microi.Core', 'ApiEngine', 'IManagedApiEngineCompatibilityRunner.cs'));
  const apiEngineImpl = read(path.join(serverRoot, 'Microi.net', 'ApiEngine', 'ApiEngine.cs'));

  assert.match(external, /BindingApiEngineKey = "platform-external-login-binding"/);
  assert.match(external, /RunTrustedProtocolAsync\(/);
  assert.match(external, /if \(resolveCode == 2\)/);
  assert.match(external, /if \(resolveCode != 1\)/);
  assert.match(external, /BindingLookupFailed/);
  assert.match(external, /StringGetDeleteAsync|GetAccessToken|GetAccessToken\(/);
  assert.doesNotMatch(external, /BindingTable|UpsertBindingAsync|FindOwnedBindingAsync/);
  assert.doesNotMatch(external, /_TrustedExternalLoginProtocol/);

  assert.match(wechat, /UserBindingApiEngineKey = "platform-wechat-user-binding"/);
  assert.match(wechat, /RunTrustedProtocolAsync\(/);
  assert.match(wechat, /UserInfoCallback\?OsClient=/);
  assert.doesNotMatch(wechat, /UserInfoCallback\?o=/);
  assert.match(wechat, /授权票据租户参数不一致/);
  assert.match(wechat, /OAuthApi\.GetAccessToken\(appId, appSecret, code\)/);
  assert.doesNotMatch(wechat, /_TrustedWeChatProtocol|UptFormDataAsync/);

  assert.match(chat, /SystemMessageApiEngineKey = "platform-chat-system-message"/);
  assert.match(chat, /ManagedApiEngineCompatibility\.RunAsync\(/);
  assert.match(chat, /new DiyWebSocket\(null\)\.DeliverPreparedMessageAsync\(/);
  assert.doesNotMatch(chat, /diyWebSocket\.SendToUser\(msgParam\)/);
  assert.doesNotMatch(chat, /FormEngine\.GetFormData/);

  assert.match(chatHub, /ChatRuntimeApiEngineKey = "platform-chat-runtime"/);
  assert.match(chatHub, /RunTrustedProtocolAsync\([\s\S]*ChatRuntimeApiEngineKey,[\s\S]*trustedOsClient,[\s\S]*request,[\s\S]*trustedCurrentUser/);
  assert.doesNotMatch(chatHub, /RunAsync\([\s\S]*ChatRuntimeApiEngineKey,[\s\S]*request,[\s\S]*trustedCurrentUser/);

  assert.match(marketplace, /MarketplaceSourceApiEngineKey = "platform-marketplace-source"/);
  assert.match(marketplace, /AuthorizeOperationAsync/);
  assert.match(marketplace, /RecordAuditAsync/);
  assert.match(marketplace, /ProtectSecret|NormalizeToken|SendJsonAsync/);
  assert.doesNotMatch(marketplace, /QueueSysLog/);
  const auditMethod = marketplace.match(/private static async Task<JObject> RecordAuditAsync[\s\S]*?^        }/m)?.[0] || '';
  assert.ok(auditMethod);
  assert.doesNotMatch(auditMethod, /\["(?:Token|Password|Account)"\]/);

  assert.match(bridge, /RunTrustedProtocolAsync/);
  assert.match(bridge, /EnterManagedProtocol/);
  assert.match(bridge, /ManagedCompatibilityApiEngine\.RunManagedCompatibilityAsync/);
  assert.match(bridge, /trustedRequest\["OsClient"\] = normalizedOsClient/);
  assert.match(bridge, /RunAsync\([\s\S]*managedApiEngineKey,[\s\S]*trustedRequest,[\s\S]*trustedCurrentUser/);
  assert.doesNotMatch(publicApiEngine, /RunManagedCompatibilityAsync/);
  assert.match(hostRunner, /internal interface IManagedApiEngineCompatibilityRunner/);
  assert.match(apiEngineImpl, /IManagedApiEngineCompatibilityRunner\.RunManagedCompatibilityAsync/);
  assert.doesNotMatch(apiEngineImpl, /public\s+async\s+Task<dynamic>\s+RunManagedCompatibilityAsync/);
  assert.match(trustedContext, /TryConsumeManagedProtocol/);
  assert.match(trustedContext, /Interlocked\.CompareExchange\(ref state\.Consumed, 1, 0\)/);
});
