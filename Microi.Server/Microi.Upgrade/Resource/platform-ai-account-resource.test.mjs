import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(directory, '..', '..');
const managed = fs.readFileSync(path.join(directory, 'platform-ai-account.js'), 'utf8');
const hook = fs.readFileSync(path.join(directory, 'platform-ai-custom-hook.js'), 'utf8');
const coreFacade = fs.readFileSync(path.join(
  serverRoot,
  'Microi.Core', 'V8Engine', 'Runtime', 'V8Method.AiPlatformFacade.cs',
), 'utf8');
const pluginRuntime = fs.readFileSync(path.join(
  serverRoot,
  'Microi.AI', 'AiPlatformRuntime.cs',
), 'utf8');
const subscription = fs.readFileSync(path.join(
  serverRoot,
  'Microi.AI', 'SubscriptionService.cs',
), 'utf8');
const relaySchema = fs.readFileSync(path.join(
  serverRoot,
  'Microi.AI', 'RelayUsageSchema.cs',
), 'utf8');
const controller = fs.readFileSync(path.join(
  serverRoot,
  'Microi.net.Api', 'Controllers', 'AiController.cs',
), 'utf8');

test('AI account resources declare Managed ownership and an app-wide non-overwritten tenant hook', () => {
  assert.match(managed, /OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(managed, /所属官方应用：AI助手/);
  assert.match(managed, /ApiEngineKey：platform-ai-account/);
  assert.match(managed, /platform-ai-custom-hook/);
  assert.doesNotMatch(managed, /platform-ai-account-custom-hook/);
  assert.match(hook, /OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.match(hook, /ApiEngineKey：platform-ai-custom-hook/);
  assert.match(hook, /return \{ Code : 1 \};\s*$/);
});

test('plans, subscriptions and orders are orchestrated by V8 instead of Controller business code', () => {
  assert.match(managed, /function getPlans\(\)[\s\S]{0,400}ManageAiPlatform\(\{ Action: 'GetPlans' \}\)/);
  assert.doesNotMatch(
    managed,
    /GetTableDataAnonymous|GetFormDataAnonymous|V8\.Db(?:Read)?\s*\.\s*FromSql/,
  );
  assert.match(managed, /GetFormData\('mic_sub_user'/);
  assert.match(managed, /AddFormData\('mic_sub_order'/);
  assert.match(managed, /GetTableData\('mic_sub_order'/);
  assert.match(managed, /GetOrderStatus[\s\S]*GetFormData\('mic_sub_order'/);

  const bridgeActions = [
    ['SubGetPlans', 'GetPlans'],
    ['SubGetInfo', 'GetSubscription'],
    ['GetUserAiApiKey', 'EnsureUserAiApiKey'],
    ['ResetUserAiApiKey', 'ResetUserAiApiKey'],
    ['RelayTokenSummary', 'GetRelayTokenSummary'],
    ['GetUserAiUsage', 'GetRelayTokenUsage'],
    ['SubCreateOrder', 'CreateOrder'],
    ['SubCreateAlipay', 'CreateAlipay'],
    ['SubGetOrders', 'GetOrders'],
    ['SubConsumeQuota', 'ConsumeQuota'],
    ['SubGetOrderStatus', 'GetOrderStatus'],
    ['GenerateProfileAvatar', 'GenerateProfileAvatar'],
    ['CreateMiniMaxVideo', 'CreateMiniMaxVideo'],
    ['GetMiniMaxVideoTask', 'GetMiniMaxVideoTask'],
    ['GetMiniMaxVideoFile', 'GetMiniMaxVideoFile'],
    ['PersistMiniMaxVideoFile', 'PersistMiniMaxVideoFile'],
    ['ProxyGetQuotaStatus', 'GetSubscription'],
    ['SubGetModels', 'GetModels'],
  ];
  for (const [method, action] of bridgeActions) {
    assert.match(
      controller,
      new RegExp(`Task<JsonResult> ${method}\\b[\\s\\S]{0,700}RunAiPlatformCompatibilityAsync\\(\\s*"${action}"`),
      `${method} must remain only a compatibility bridge to ${action}`,
    );
  }
});

test('Alipay callback keeps only protocol verification in C# and completes payment transactionally in Managed V8', () => {
  assert.match(controller, /VerifyAlipayNotifyForTenant\(/);
  assert.match(controller, /RunTrustedProtocolAsync\(\s*AiPlatformAccountEngineKey/);
  assert.match(controller, /trustedRequest\["Action"\] = "CompletePayment"/);
  assert.doesNotMatch(controller, /ProcessAlipayNotify|HandlePaySuccess/);
  assert.match(subscription, /VerifyAlipayNotifyForTenant/);
  assert.match(subscription, /CheckSignV2/);
  assert.match(subscription, /callbackAppId/);
  assert.doesNotMatch(subscription, /HandlePaySuccess|ProcessAlipayNotify/);

  assert.match(managed, /PAYMENT_COMPLETE_MANAGED_V1/);
  assert.match(managed, /action === 'CompletePayment'[\s\S]{0,300}RequireManagedProtocolContext/);
  assert.match(managed, /function completePayment/);
  assert.match(managed, /runTenantHook\(action, param, V8\.DbTrans\)/);
  assert.match(managed, /UptFormDataByWhere\('mic_sub_order'[\s\S]{0,500}\['PayStatus', '=', 0\]/);
  assert.match(managed, /UptFormDataByWhere\('mic_sub_order'[\s\S]{0,800}V8\.DbTrans\)/);
  assert.match(managed, /GetFormData\('mic_sub_user'/);
  assert.match(managed, /AddFormData\('mic_sub_user'/);
  assert.match(managed, /AddFormData\('mic_sub_user'[\s\S]{0,800}V8\.DbTrans\)/);
  assert.match(managed, /assignDefaultProviderApiKey/);
  assert.match(managed, /IdempotentReplay/);
});

test('supplier secrets and platform Authorization never enter the tenant hook', () => {
  const hookStart = managed.indexOf('function runTenantHook');
  const hookEnd = managed.indexOf('function getPlans', hookStart);
  const hookSource = managed.slice(hookStart, hookEnd);
  assert.ok(hookStart > 0 && hookEnd > hookStart);
  assert.doesNotMatch(
    hookSource,
    /Prompt|Answer|Authorization|ApiKey\b|TaskHandle|FileHandle|TaskId|FileId|task_id|file_id|FirstFrameImage|LastFrameImage|Response|TradeNo|TotalAmount/,
  );
  assert.doesNotMatch(managed, /PrivateKey|AlipayPublicKey|mic_sub_alipay_config/);

  assert.match(controller, /OpenAIUsage[\s\S]{0,500}GetUsageByPlatformApiKeyAsync/);
  assert.doesNotMatch(
    controller.match(/OpenAIUsage[\s\S]{0,650}/)?.[0] || '',
    /RunAiPlatformCompatibilityAsync|ManagedApiEngineCompatibility/,
  );
  assert.doesNotMatch(pluginRuntime, /case "openaiusage"/i);
});

test('Core binds the atom to the exact engine, server identity and action-level authorization', () => {
  assert.match(coreFacade, /AiPlatformAccountEngineKey = "platform-ai-account"/);
  assert.match(coreFacade, /RequireTrustedApiEngine\(AiPlatformAccountEngineKey\)/);
  assert.match(coreFacade, /V8TrustedExecutionContext\.CurrentUser/);
  assert.match(coreFacade, /UserAccessKeySecurity\.IsSession/);
  assert.match(coreFacade, /PlatformAdministratorSecurity\.IsCurrentPlatformAdministrator/);
  assert.match(coreFacade, /"AuthorizeAction"/);
  assert.doesNotMatch(coreFacade, /request\["OsClient"\]/);
  assert.doesNotMatch(coreFacade, /AI 平台原子调用失败[^\n]*ex\.Message/);
  assert.match(managed, /Action: 'AuthorizeAction',[\s\S]*TargetAction: action/);
});

test('anonymous legacy discovery preserves the server-resolved tenant and rejects payload override', () => {
  assert.match(controller, /var osClient = DiyToken\.GetCurrentOsClient\(false\)/);
  assert.match(controller, /if \(string\.IsNullOrWhiteSpace\(osClient\)\)[\s\S]{0,100}OsClient\.GetConfigOsClient\(\)/);
  assert.match(controller, /request\.Properties\(\)[\s\S]{0,500}"_OsClient"[\s\S]{0,300}property\.Remove\(\)/);
  assert.match(controller, /request\["OsClient"\] = TenantConfigurationSecurity\.NormalizeTenantId\(osClient\)/);
  assert.doesNotMatch(
    controller,
    /if \(allowAnonymous\)[\s\S]{0,120}osClient = OsClient\.GetConfigOsClient\(\)/,
  );
});

test('Microi.AI keeps only sensitive atoms and returns safe admin and model projections', () => {
  assert.match(pluginRuntime, /class AiPlatformRuntime : IAiPlatformRuntime/);
  assert.match(pluginRuntime, /CreateAlipayForUser/);
  assert.match(pluginRuntime, /ConsumeQuota/);
  assert.match(pluginRuntime, /GenerateAuthenticatedAvatarAsync/);
  assert.match(pluginRuntime, /CreateAuthenticatedVideoAsync/);
  assert.match(pluginRuntime, /PersistAuthenticatedVideoFileAsync/);
  assert.match(pluginRuntime, /"KeyName"[\s\S]*"CurrentUsers"[\s\S]*"TotalCalls"/);
  assert.match(pluginRuntime, /"DisplayName"[\s\S]*"ModelId"[\s\S]*"IsRelayModel"/);
  assert.doesNotMatch(pluginRuntime, /SanitizeList\([\s\S]{0,300}"ApiKey"/);
  assert.doesNotMatch(pluginRuntime, /SanitizeList\([\s\S]{0,300}"Endpoint"/);
});

test('subscription quota deduction is distributed-atomic and schema drift fails closed', () => {
  assert.match(subscription, /LockTakeAsync\(/);
  assert.match(subscription, /LockReleaseAsync\(/);
  assert.match(subscription, /共享 Redis 不可用，未扣减额度以避免并发超额/);
  assert.match(subscription, /ConsumeQuotaUnderLock/);
  assert.doesNotMatch(subscription, /AddColumn\(/);
  assert.match(subscription, /请先升级官方系统账号应用/);
  assert.doesNotMatch(relaySchema, /CreateTable<|AddColumn\(/);
  assert.match(relaySchema, /请先升级官方 AI助手应用/);
  assert.match(relaySchema, /运行时不会再自动创建业务表/);
  assert.match(relaySchema, /运行时不会再修改业务表结构/);
});
