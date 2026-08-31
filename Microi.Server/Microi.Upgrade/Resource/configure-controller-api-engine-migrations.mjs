import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOfficialNotice } from './official-api-engine-notice.mjs';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoots = [resourceDir, path.join(resourceDir, '.resource-sync-base')];
const messageSystemSource = fs.readFileSync(
  path.join(resourceDir, 'platform-chat-system-message.js'),
  'utf8',
).replace(/^\uFEFF/, '');

function officialNotice(appName, key, body) {
  return `/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：${appName}
 * ApiEngineKey：${key}
 * 从可信吾码官方应用源安装、更新或重新安装“${appName}”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议只修改本接口调用的 CreateIfMissing 个性化 Hook；官方升级不会覆盖该 Hook。
 */

${body.trim()}
`;
}

function tenantHookNotice(appName, key) {
  return `/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1
 * 【重要：这是租户个性化接口，官方升级不会覆盖】
 * 所属官方应用：${appName}
 * ApiEngineKey：${key}
 * 首次安装仅在接口不存在时创建；后续安装、更新或重新安装都保留用户代码。
 * 请把个性化业务写在这里，不要直接修改调用本 Hook 的官方 Managed 接口。
 */

return { Code : 1 };
`;
}

function baseEngine({
  id, key, name, address, routes = '', code, allowAnonymous = 0, responseType,
  version = 'v1.0.0', changeHistory,
}) {
  const engine = {
    IsDeleted: 0,
    UserName: '管理员',
    UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
    CreateTime: '2026-08-30 12:00:00',
    Id: id,
    ChangeHistory: changeHistory
      || `2026-08-30 v1.0.0 迁移旧 Controller 路由到官方 Managed 接口引擎，并由多路由保持历史客户端兼容。\n`,
    Version: version,
    LimitRecursion: 5000,
    LimitMemory: 2048,
    MaxStatements: 100000000,
    Timeout: 600,
    StopHttp: 0,
    EnableLog: 0,
    Category: '平台核心',
    Files: '[]',
    AllowAnonymous: allowAnonymous,
    ApiAddress: address,
    ApiRoutes: routes,
    Lock: 0,
    ApiV8Code: code,
    ApiRole: '[]',
    IsEnable: 1,
    ApiEngineKey: key,
    ApiName: name,
  };
  if (responseType) engine.ResponseType = responseType;
  return engine;
}

const accessKeyCode = fs.readFileSync(
  path.join(resourceDir, 'platform-user-access-key.js'),
  'utf8',
).replace(/^\uFEFF/, '');

const workflowRoutes = [
  'SaveWFFlowDesign', 'GetWFHistory', 'RecallWork', 'CancelFlow', 'HandOverWork',
  'GetWFNodeModel', 'GetStartWFNode', 'StartWork', 'SendWork', 'StartWorkWithForm',
  'SendWorkWithForm', 'GetWFWork', 'GetWFFlow', 'GetWFStats', 'MarkCopyRead',
  'GetNextNodeConfirmUsers',
].map((action) => `/api/WorkFlow/${action}`).join(';');

const workflowCode = officialNotice('SaaS引擎', 'platform-workflow', `
/*
 * V8 ApiEngine
 * ApiEngineKey: platform-workflow
 * Version: v1.0.1
 * Function:
 * - 统一承载工作流旧 Controller 路由，并按大小写无关方式归一化历史动作名。
 */
var route = String(V8.Param._RequestPath || V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var action = String(V8.Param.Action || '').trim();
if(!action && route){
  var segments = route.split('/');
  action = segments[segments.length - 1] || '';
}
var allowed = ${JSON.stringify([
  'SaveWFFlowDesign', 'GetWFHistory', 'RecallWork', 'CancelFlow', 'HandOverWork',
  'GetWFNodeModel', 'GetStartWFNode', 'StartWork', 'SendWork', 'StartWorkWithForm',
  'SendWorkWithForm', 'GetWFWork', 'GetWFFlow', 'GetWFStats', 'MarkCopyRead',
  'GetNextNodeConfirmUsers',
])};
var actionNames = {};
for(var actionIndex = 0; actionIndex < allowed.length; actionIndex++){
  actionNames[String(allowed[actionIndex]).toLowerCase()] = allowed[actionIndex];
}
action = actionNames[String(action).toLowerCase()] || '';
if(!action) return { Code:0, Msg:'不支持的工作流动作。' };

var hook = V8.ApiEngine.Run('platform-workflow-custom-hook', {
  Stage:'BeforeWorkFlowAction', Action:action,
  SourceApiEngineKey:'platform-workflow', TableRowId:V8.Param.TableRowId || ''
});
if(!hook || hook.Code !== 1) return hook || { Code:0, Msg:'工作流个性化 Hook 未返回结果。' };

var request = V8.Param || {};
request.Action = action;
return V8.Method.ManageWorkFlow(request);`);

const marketplaceRuntimeDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var marketplaceRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var marketplaceAction = String(V8.Param.Action || '').trim();
if(!marketplaceAction && marketplaceRoute){
  var marketplaceSegments = marketplaceRoute.split('/');
  marketplaceAction = marketplaceSegments[marketplaceSegments.length - 1] || '';
}
if(['Discover','Captcha','Login','Query','Disconnect'].indexOf(marketplaceAction) >= 0){
  return V8.Method.RunPlatformApiRuntime({
    RuntimeKey:'MarketplaceSource', Action:marketplaceAction, Param:V8.Param || {}
  });
}
`;

const externalLoginCode = officialNotice('SaaS引擎', 'platform-external-login', `
/* V8 ApiEngine | ApiEngineKey: platform-external-login | Version: v1.0.0 */
var route = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var action = String(V8.Param.Action || '').trim();
if(!action && route){
  var segments = route.split('/');
  action = segments[segments.length - 1] || '';
}
var allowed = ['Begin','CompleteLogin','ListBindings','RevokeBinding'];
if(allowed.indexOf(action) < 0) return { Code:0, Msg:'不支持的外部登录动作。' };
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'ExternalLogin', Action:action, Param:V8.Param || {}
});`);

const externalLoginCallbackCode = officialNotice('SaaS引擎', 'platform-external-login-callback', `
/* V8 ApiEngine | ApiEngineKey: platform-external-login-callback | Version: v1.0.0 */
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'ExternalLogin', Action:'Callback', Param:V8.Param || {}
});`);

const wechatContentSecurityCode = officialNotice('SaaS引擎', 'platform-wechat-content-security', `
/* V8 ApiEngine | ApiEngineKey: platform-wechat-content-security | Version: v1.0.0 */
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'WeChatContentSecurity', Action:'Status', Param:V8.Param || {}
});`);

const wechatContentSecurityCallbackCode = officialNotice('SaaS引擎', 'platform-wechat-content-security-callback', `
/* V8 ApiEngine | ApiEngineKey: platform-wechat-content-security-callback | Version: v1.0.0 */
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'WeChatContentSecurity', Action:'Callback', Param:V8.Param || {}
});`);

const wechatOAuthCode = officialNotice('SaaS引擎', 'platform-wechat-oauth', `
/* V8 ApiEngine | ApiEngineKey: platform-wechat-oauth | Version: v1.0.0 */
var route = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var action = String(V8.Param.Action || '').trim();
if(!action && route){
  var segments = route.split('/');
  action = segments[segments.length - 1] || '';
}
if(['BindSysUser','UserInfoCallback'].indexOf(action) < 0){
  return { Code:0, Msg:'不支持的微信 OAuth 动作。' };
}
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'WeChatOAuth', Action:action, Param:V8.Param || {}
});`);

const tenantSettingsRuntimeDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var tenantSettingsRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var tenantSettingsAction = String(V8.Param.Action || '').trim();
if(!tenantSettingsAction && tenantSettingsRoute){
  var tenantSettingsSegments = tenantSettingsRoute.split('/');
  tenantSettingsAction = tenantSettingsSegments[tenantSettingsSegments.length - 1] || '';
}
if(['GetPublic','GetMapRuntime','Save','GetRevealChallenge','Reveal'].indexOf(tenantSettingsAction) >= 0){
  return V8.Method.RunPlatformApiRuntime({
    RuntimeKey:'TenantSystemSettings', Action:tenantSettingsAction, Param:V8.Param || {}
  });
}
V8.Param.Action = tenantSettingsAction;
`;

const sysUserSessionCode = officialNotice('SaaS引擎', 'platform-sys-user-session', `
/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-user-session
 * Version: v1.0.1
 * Function:
 * - 统一承载用户登录、Token 续签、Token 登录、退出与管理员凭据会话协议；兼容历史 SysUser 多路由，并按大小写无关方式归一化动作名。
 */

var route = String(V8.Param._RequestPath || V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
var action = String(V8.Param.Action || '').trim();
if(!action && route){
  var segments = route.split('/');
  action = segments[segments.length - 1] || '';
}
var actionNames = {
  login:'Login', setpassword:'SetPassword',
  getownedtenantadminpassword:'GetOwnedTenantAdminPassword',
  resetownedtenantadminpassword:'ResetOwnedTenantAdminPassword',
  refreshtoken:'RefreshToken', tokenlogin:'TokenLogin', logout:'Logout',
  getsysuserpassword:'GetSysUserPassword'
};
action = actionNames[String(action).toLowerCase()] || '';
if(!action) return { Code:0, Msg:'不支持的用户会话动作。' };
var postOnly = ['Login','SetPassword','GetOwnedTenantAdminPassword','ResetOwnedTenantAdminPassword','RefreshToken','Logout'];
if(postOnly.indexOf(action) >= 0 && String(V8.Param._HttpMethod || '').toUpperCase() !== 'POST'){
  return { Code:0, Msg:'该用户会话动作仅支持 POST 请求。' };
}
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'SysUserSession', Action:action, Param:V8.Param || {}
});`);

const identityVerificationActions = [
  'GetCapabilities',
  'BeginPasskeyRegistration', 'CompletePasskeyRegistration',
  'BeginPasskeyAuthentication', 'CompletePasskeyAuthentication',
  'ListAuthenticators', 'RenameAuthenticator', 'RevokeAuthenticator',
  'UpdateAuthenticatorPolicy',
  'BeginTotpEnrollment', 'CompleteTotpEnrollment',
  'ListTotpAuthenticators', 'RevokeTotpAuthenticator', 'VerifyTotp',
  'BeginFaceVerification', 'CompleteFaceVerification',
];

const identityVerificationCode = officialNotice('SaaS引擎', 'platform-identity-verification', `
/* V8 ApiEngine | ApiEngineKey: platform-identity-verification | Version: v1.0.0 */
var route = String(V8.Param.ApiAddress || V8.Param._RequestPath || '').replace(/\\?.*$/, '');
var action = String(V8.Param.Action || '').trim();
if(!action && route){
  var segments = route.split('/');
  action = segments[segments.length - 1] || '';
}
var allowed = ${JSON.stringify(identityVerificationActions)};
if(allowed.indexOf(action) < 0) return { Code:0, Msg:'不支持的强身份验证动作。' };

// WebAuthn/FIDO2 验签、挑战原子消费、TOTP 防重放和人脸网关密钥均属于可信后端边界；
// 接口引擎只负责编排路由，运行时仍会逐动作校验登录态、租户和票据用途。
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'IdentityVerification', Action:action, Param:V8.Param || {}
});`);

const sysUserAdminRouteDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var sysUserAdminRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '');
if(!V8.Param.Action && sysUserAdminRoute){
  var sysUserAdminSegments = sysUserAdminRoute.split('/');
  V8.Param.Action = sysUserAdminSegments[sysUserAdminSegments.length - 1] || '';
}
`;

const privateFileLegacyDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var privateFileRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '').toLowerCase();
if(privateFileRoute === '/api/hdfs/getprivatefileurl' || privateFileRoute === '/api/hdfs/mallfileurl'){
  // 历史移动会员 Token 只在后端固定缓存键中解析，原始 Token 永不进入 V8。
  return V8.Method.GetAuthorizedPrivateFileUrl(V8.Param || {});
}
`;

const aiRuntimeLegacyDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var aiRuntimeRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '').toLowerCase();
var aiRuntimeActions = {
  '/api/ai/updateconversationtitle':'UpdateConversationTitle',
  '/api/ai/recognizeintent':'RecognizeIntent',
  '/api/ai/chat':'Chat',
  '/api/ai/nl2sql':'NL2SQL',
  '/api/ai/nl2v8enginesync':'NL2V8EngineSync'
};
if(aiRuntimeActions[aiRuntimeRoute]) V8.Param.Action = aiRuntimeActions[aiRuntimeRoute];
`;

const aiAccountLegacyDispatch = `/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var aiAccountRoute = String(V8.Param.ApiAddress || '').replace(/\\?.*$/, '').toLowerCase();
var aiAccountActions = {
  '/api/ai/relaytokensummary':'GetRelayTokenSummary',
  '/api/ai/subgetplans':'GetPlans',
  '/api/ai/subgetinfo':'GetSubscription',
  '/api/ai/getuseraiapikey':'EnsureUserAiApiKey',
  '/api/ai/resetuseraiapikey':'ResetUserAiApiKey',
  '/api/ai/getuseraiusage':'GetRelayTokenUsage',
  '/api/ai/subcreateorder':'CreateOrder',
  '/api/ai/subcreatealipay':'CreateAlipay',
  '/api/ai/subgetorders':'GetOrders',
  '/api/ai/subconsumequota':'ConsumeQuota',
  '/api/ai/subgetorderstatus':'GetOrderStatus',
  '/api/ai/subgetapikeylist':'GetApiKeyList',
  '/api/ai/subgetapikeybindusers':'GetApiKeyBindUsers',
  '/api/ai/subgetapikeycapacity':'GetApiKeyCapacity',
  '/api/ai/generateprofileavatar':'GenerateProfileAvatar',
  '/api/ai/createminimaxvideo':'CreateMiniMaxVideo',
  '/api/ai/getminimaxvideotask':'GetMiniMaxVideoTask',
  '/api/ai/getminimaxvideofile':'GetMiniMaxVideoFile',
  '/api/ai/persistminimaxvideofile':'PersistMiniMaxVideoFile',
  '/api/ai/proxygetquotastatus':'GetSubscription',
  '/api/ai/subgetmodels':'GetModels'
};
if(aiAccountActions[aiAccountRoute]){
  V8.Param.Action = aiAccountActions[aiAccountRoute];
  if(V8.Param.PageIndex === undefined && V8.Param.pageIndex !== undefined) V8.Param.PageIndex = V8.Param.pageIndex;
  if(V8.Param.PageSize === undefined && V8.Param.pageSize !== undefined) V8.Param.PageSize = V8.Param.pageSize;
  if(V8.Param.OrderId === undefined && V8.Param.orderId !== undefined) V8.Param.OrderId = V8.Param.orderId;
  if(V8.Param.ApiKeyId === undefined && V8.Param.apiKeyId !== undefined) V8.Param.ApiKeyId = V8.Param.apiKeyId;
}
`;

const osLegacyActions = [
  'GetOsVersion', 'CreateQRCode', 'CreateQRCodeImage', 'GetMicroiNetVersion',
  'GetOsClient', 'GetHID', 'GetDateTimeNow', 'MicroiNetInitCheck',
];

const osLegacyCode = officialNotice('SaaS引擎', 'platform-os-legacy-compatibility', `
/* V8 ApiEngine | ApiEngineKey: platform-os-legacy-compatibility | Version: v1.0.0 */
var route = String(V8.Param.ApiAddress || V8.Param._RequestPath || '').replace(/\\?.*$/, '');
var segments = route.split('/');
var action = String(V8.Param.Action || segments[segments.length - 1] || '').trim();
var allowed = ${JSON.stringify(osLegacyActions)};
if(allowed.indexOf(action) < 0) return { Code:0, Msg:'不支持的旧 OS 兼容动作。' };
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'LegacyOs', Action:action, Param:V8.Param || {}
});`);

const packageUpdates = {
  'app.microi.sys_user.json': {
    version: 'v7.6.3',
    description: '系统账号、个人偏好与访问密钥的官方低代码资源；历史 HTTP 地址由接口引擎多路由兼容。',
    history: '2026-08-30 v7.6.3 将用户访问密钥四个旧控制器入口迁入 platform-user-access-key Managed 接口引擎，并与系统账号旧路由统一纳入多路由闭包。',
    capabilities: [
      'ApiEngine:platform-user-access-key@v1.0.0',
      'V8.Method.ManageUserAccessKey',
      'ServerField:sys_apiengine.ApiRoutes',
    ],
    aliases: {
      'platform-sys-user-admin': [
        '/api/SysUser/AddSysUser', '/api/SysUser/UptSysUser',
        '/api/SysUser/DelSysUser', '/api/SysUser/GetSysUser',
        '/api/SysUser/RefreshLoginUser',
      ],
      'platform-user-update-preferences': ['/api/SysUser/UpdateMyDefaultIndexUrl'],
      'platform-user-update-profile': ['/api/SysUser/UpdateCurrentProfile'],
    },
    runtimeDispatches: {
      'platform-sys-user-admin': sysUserAdminRouteDispatch,
    },
    engines: [baseEngine({
      id: '019d35f0-7b04-7b91-9801-000000000001',
      key: 'platform-user-access-key',
      name: '用户访问密钥可信管理',
      address: '/apiengine/platform-user-access-key',
      routes: '/api/SysUserAccessKey/Create;/api/SysUserAccessKey/List;/api/SysUserAccessKey/Revoke;/api/SysUserAccessKey/Exchange',
      code: accessKeyCode,
      allowAnonymous: 1,
    })],
  },
  'app.microi.saas-engine.json': {
    version: 'v7.7.10',
    description: 'SaaS 多租户平台运行时、身份能力与工作流接口引擎闭包。',
    history: '2026-08-30 v7.7.10 platform-workflow 按大小写无关方式归一化旧 WorkFlow 动作，兼容 getWFWork/getWFFlow，避免首次进入首页误报不支持的工作流动作。',
    capabilities: [
      'ApiEngine:platform-workflow@v1.0.1',
      'ApiEngine:platform-workflow-custom-hook@v1.0.0',
      'V8.Method.ManageWorkFlow',
      'V8.Method.RunPlatformApiRuntime:ExternalLogin',
      'ApiEngineHttpResponseContract:v1',
      'V8.Method.RunPlatformApiRuntime:WeChatContentSecurity',
      'V8.Method.RunPlatformApiRuntime:WeChatOAuth',
      'V8.Method.RunPlatformApiRuntime:SysUserSession',
      'ApiEngine:platform-sys-user-session@v1.0.1',
      'V8.Method.RunPlatformApiRuntime:IdentityVerification',
      'ServerField:sys_apiengine.ApiRoutes',
    ],
    aliases: {
      'platform-service-health': [
        '/api/Diagnostics/health', '/api/Diagnostics/liveness', '/itdos-heart',
      ],
      'platform-current-user': ['/api/SysUser/GetCurrentUser'],
      'platform-sys-user-public-info': ['/api/SysUser/GetSysUserPublicInfo'],
      'platform-create-tenant': ['/api/SysUser/CreateTenant'],
      'platform_auth_sms_login': ['/api/SysUser/SmsLogin'],
      'platform-data-source-run': ['/api/DataSourceEngine/Run', '/api/DataSourceEngine/GetData'],
      'platform-os-client-by-domain': ['/api/Os/GetOsClientByDomain'],
      'platform-sys-config': ['/api/FormEngine/GetSysConfig', '/api/DiyTable/GetSysConfig'],
      'platform-lang-bundle': ['/api/FormEngine/GetLangBundle'],
      'platform-login-wallpapers': ['/api/FormEngine/GetLoginWallpapers'],
      'platform-private-file-url': ['/api/HDFS/GetPrivateFileUrl', '/api/HDFS/MallFileUrl'],
    },
    runtimeDispatches: {
      'platform-private-file-url': privateFileLegacyDispatch,
    },
    enginePatches: {
      // 旧移动会员 Token 由可信原子重新校验；普通匿名请求仍返回 1001。
      'platform-private-file-url': { AllowAnonymous: 1 },
    },
    engines: [
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000002',
        key: 'platform-workflow',
        name: '工作流统一接口',
        address: '/apiengine/platform-workflow',
        routes: workflowRoutes,
        code: workflowCode,
        version: 'v1.0.1',
        changeHistory: '2026-08-30 v1.0.1 按大小写无关方式归一化历史 WorkFlow 动作，兼容 getWFWork 与 getWFFlow。\n2026-08-30 v1.0.0 迁移旧 Controller 路由到官方 Managed 接口引擎，并由多路由保持历史客户端兼容。\n',
      }),
      {
        ...baseEngine({
          id: '019d35f0-7b04-7b91-9801-000000000003',
          key: 'platform-workflow-custom-hook',
          name: '工作流个性化扩展',
          address: '/apiengine/platform-workflow-custom-hook',
          code: tenantHookNotice('SaaS引擎', 'platform-workflow-custom-hook'),
        }),
        StopHttp: 1,
        Ownership: 'Tenant',
        UpgradePolicy: 'CreateIfMissing',
      },
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000004',
        key: 'platform-external-login',
        name: '外部账号登录统一接口',
        address: '/apiengine/platform-external-login',
        routes: '/api/ExternalLogin/Begin;/api/ExternalLogin/CompleteLogin;/api/ExternalLogin/ListBindings;/api/ExternalLogin/RevokeBinding',
        code: externalLoginCode,
        allowAnonymous: 1,
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000005',
        key: 'platform-external-login-callback',
        name: '外部账号 OAuth 回调',
        address: '/apiengine/platform-external-login-callback',
        routes: '/api/ExternalLogin/Callback',
        code: externalLoginCallbackCode,
        allowAnonymous: 1,
        responseType: 'HTTP',
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-00000000000b',
        key: 'platform-os-legacy-compatibility',
        name: '旧客户端 OS 协议兼容接口',
        address: '/apiengine/platform-os-legacy-compatibility',
        routes: osLegacyActions.map((action) => `/api/Os/${action}`).join(';'),
        code: osLegacyCode,
        allowAnonymous: 1,
        responseType: 'HTTP',
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000009',
        key: 'platform-sys-user-session',
        name: '用户登录与会话统一接口',
        address: '/apiengine/platform-sys-user-session',
        routes: '/api/SysUser/Login;/api/SysUser/SetPassword;/api/SysUser/GetOwnedTenantAdminPassword;/api/SysUser/ResetOwnedTenantAdminPassword;/api/SysUser/RefreshToken;/api/SysUser/TokenLogin;/api/SysUser/Logout;/api/SysUser/GetSysUserPassword',
        code: sysUserSessionCode,
        allowAnonymous: 1,
        version: 'v1.0.1',
        changeHistory: '2026-08-30 v1.0.1 按大小写无关方式归一化历史 SysUser 动作，兼容 refreshToken 与 tokenlogin。\n2026-08-30 v1.0.0 迁移旧 Controller 路由到官方 Managed 接口引擎，并由多路由保持历史客户端兼容。\n',
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-00000000000a',
        key: 'platform-identity-verification',
        name: '强身份验证统一接口',
        address: '/apiengine/platform-identity-verification',
        routes: identityVerificationActions
          .map((action) => `/api/IdentityVerification/${action}`).join(';'),
        code: identityVerificationCode,
        // 登录前的能力探测、Passkey/TOTP/人脸认证需要匿名进入；运行时按动作强制校验。
        allowAnonymous: 1,
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000008',
        key: 'platform-wechat-oauth',
        name: '微信公众号 OAuth 统一入口',
        address: '/apiengine/platform-wechat-oauth',
        routes: '/api/WeChat/BindSysUser;/api/WeChat/UserInfoCallback;/WeChat/UserInfoCallback',
        code: wechatOAuthCode,
        allowAnonymous: 1,
        responseType: 'HTTP',
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000006',
        key: 'platform-wechat-content-security',
        name: '微信内容安全状态',
        address: '/apiengine/platform-wechat-content-security',
        routes: '/api/WeChatContentSecurity/Status',
        code: wechatContentSecurityCode,
        allowAnonymous: 1,
      }),
      baseEngine({
        id: '019d35f0-7b04-7b91-9801-000000000007',
        key: 'platform-wechat-content-security-callback',
        name: '微信内容安全回调',
        address: '/apiengine/platform-wechat-content-security-callback',
        routes: '/api/WeChatContentSecurity/Callback;/api/WeChatContentSecurity/Callback--OsClient--{OsClient}--',
        code: wechatContentSecurityCallbackCode,
        allowAnonymous: 1,
        responseType: 'HTTP',
      }),
    ],
  },
  'app.microi.store.json': {
    version: 'v7.7.15',
    description: '吾码官方应用商城、平台菜单与安装升级控制面。',
    history: '2026-08-30 v7.7.15 将 MarketplaceSourceController 五个入口迁入 platform-marketplace-source，多路由兼容旧地址，凭据与上游网络边界由 Microi.net 最小可信原子处理。',
    capabilities: [
      'ServerField:sys_apiengine.ApiRoutes',
      'V8.Method.RunPlatformApiRuntime:MarketplaceSource',
    ],
    aliases: {
      'platform-sys-menu': [
        '/api/SysMenu/AddSysMenu', '/api/SysMenu/DelSysMenu',
        '/api/SysMenu/UptSysMenu', '/api/SysMenu/GetSysMenu',
        '/api/SysMenu/GetSysMenuModel', '/api/SysMenu/GetSysMenuStep',
        '/api/SysMenu/GetSysRoleLimitByMenuId',
        '/api/SysMenu/UpdateSysRoleLimitByMenuId',
      ],
      'platform-marketplace-source': [
        '/api/MarketplaceSource/Discover', '/api/MarketplaceSource/Captcha',
        '/api/MarketplaceSource/Login', '/api/MarketplaceSource/Query',
        '/api/MarketplaceSource/Disconnect',
      ],
    },
    runtimeDispatches: {
      'platform-marketplace-source': marketplaceRuntimeDispatch,
    },
    engines: [],
  },
  'app.microi.sys-config.json': {
    version: 'v6.3.9',
    description: '吾码系统设置、租户私密配置与安全服务接入。',
    history: '2026-08-30 v6.3.9 将 TenantSystemSettingsController 迁入 platform-tenant-system-settings；多路由统一普通 CRUD、地图运行时、Secret 保存与二次认证揭示。',
    capabilities: [
      'ServerField:sys_apiengine.ApiRoutes',
      'V8.Method.RunPlatformApiRuntime:TenantSystemSettings',
    ],
    aliases: {
      'platform-tenant-system-settings': [
        '/api/TenantSystemSettings/GetPublic', '/api/TenantSystemSettings/GetMapRuntime',
        '/api/TenantSystemSettings/Save', '/api/TenantSystemSettings/GetRevealChallenge',
        '/api/TenantSystemSettings/Reveal', '/api/TenantSystemSettings/List',
        '/api/TenantSystemSettings/Delete',
      ],
    },
    runtimeDispatches: {
      'platform-tenant-system-settings': tenantSettingsRuntimeDispatch,
    },
    enginePatches: {
      'platform-tenant-system-settings': { AllowAnonymous: 1 },
    },
    engines: [],
  },
  'app.microi.message-notification.json': {
    version: 'v1.0.13',
    description: '消息通知、聊天持久化与旧移动端系统消息兼容资源。',
    history: '2026-08-30 v1.0.13 完成 /api/DiyChat/SendSystemMessage 多路由、事务提交后实时投递与官方包追加式发布历史闭包。',
    capabilities: [
      'ServerField:sys_apiengine.ApiRoutes',
      'ApiEngineChatDelivery:v1',
    ],
    aliases: {
      'platform-chat-system-message': ['/api/DiyChat/SendSystemMessage'],
    },
    enginePatches: {
      // 独立源码文件是唯一事实源，避免兼容动作注入后应用包与源码基线漂移。
      'platform-chat-system-message': { ApiV8Code: messageSystemSource, StopHttp: 0 },
    },
    engines: [],
  },
  'app.microi.ai-engine.json': {
    version: 'v7.6.1',
    description: 'AI 助手、模型运行时、订阅与旧 AI Controller 地址兼容资源。',
    history: '2026-08-30 v7.6.1 将旧 /api/Ai 非流式地址全部收入 platform-ai-runtime 与 platform-ai-account 多路由，动作映射和管理员复核保持不变。',
    capabilities: [
      'ServerField:sys_apiengine.ApiRoutes',
    ],
    aliases: {
      'platform-ai-runtime': [
        '/api/Ai/UpdateConversationTitle', '/api/Ai/RecognizeIntent',
        '/api/Ai/Chat', '/api/Ai/NL2SQL', '/api/Ai/NL2V8EngineSync',
      ],
      'platform-ai-account': [
        '/api/Ai/RelayTokenSummary', '/api/Ai/SubGetPlans', '/api/Ai/SubGetInfo',
        '/api/Ai/GetUserAiApiKey', '/api/Ai/ResetUserAiApiKey',
        '/api/Ai/GetUserAiUsage', '/api/Ai/SubCreateOrder',
        '/api/Ai/SubCreateAlipay', '/api/Ai/SubGetOrders',
        '/api/Ai/SubConsumeQuota', '/api/Ai/SubGetOrderStatus',
        '/api/Ai/SubGetApiKeyList', '/api/Ai/SubGetApiKeyBindUsers',
        '/api/Ai/SubGetApiKeyCapacity', '/api/Ai/GenerateProfileAvatar',
        '/api/Ai/CreateMiniMaxVideo', '/api/Ai/GetMiniMaxVideoTask',
        '/api/Ai/GetMiniMaxVideoFile', '/api/Ai/PersistMiniMaxVideoFile',
        '/api/Ai/ProxyGetQuotaStatus', '/api/Ai/SubGetModels',
      ],
    },
    runtimeDispatches: {
      'platform-ai-runtime': aiRuntimeLegacyDispatch,
      'platform-ai-account': aiAccountLegacyDispatch,
    },
    engines: [],
  },
};

function updatePackage(filePath, update) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  pkg.PackageInfo ??= {};
  pkg.PackageInfo.Version = update.version;
  pkg.PackageInfo.Description = update.description;
  const oldHistory = String(pkg.PackageInfo.ChangeHistory || '');
  if (!oldHistory.includes(update.history)) {
    pkg.PackageInfo.ChangeHistory = `${update.history}\n${oldHistory}`;
  }
  pkg.PackageInfo.RequiredPlatformCapabilities ??= [];
  for (const capability of update.capabilities) {
    if (!pkg.PackageInfo.RequiredPlatformCapabilities.includes(capability))
      pkg.PackageInfo.RequiredPlatformCapabilities.push(capability);
  }
  pkg.SysApiEngines ??= [];
  pkg.ResourcePolicies ??= { SchemaVersion: 1, ApiEngines: {} };
  pkg.ResourcePolicies.ApiEngines ??= {};
  for (const [key, aliases] of Object.entries(update.aliases || {})) {
    const target = pkg.SysApiEngines.find((item) => item.ApiEngineKey === key);
    if (!target) throw new Error(`${path.basename(filePath)} 缺少待追加多路由的接口：${key}`);
    const merged = new Set(
      String(target.ApiRoutes || '').split(';').map((item) => item.trim()).filter(Boolean),
    );
    for (const alias of aliases) merged.add(alias);
    target.ApiRoutes = [...merged].join(';');
  }
  for (const [key, dispatch] of Object.entries(update.runtimeDispatches || {})) {
    const target = pkg.SysApiEngines.find((item) => item.ApiEngineKey === key);
    if (!target) throw new Error(`${path.basename(filePath)} 缺少待接入可信运行时的接口：${key}`);
    // 独立 JS 文件是官方 Managed 源码的唯一事实源。兼容路由需要注入动作分派时，
    // 同步更新独立源码和两个应用包，防止应用包能运行但源码基线/商城升级门禁漂移。
    const standalonePath = path.join(resourceDir, `${key}.js`);
    const hasStandalone = fs.existsSync(standalonePath);
    let currentCode = hasStandalone
      ? fs.readFileSync(standalonePath, 'utf8').replace(/^\uFEFF/, '')
      : String(target.ApiV8Code || '');
    if (!currentCode.includes('PLATFORM_RUNTIME_DISPATCH_MARKER_V1')) {
      const bodyMarker = '/* V8 ApiEngine';
      const markerIndex = currentCode.indexOf(bodyMarker);
      const noticeIndex = currentCode.indexOf('OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1');
      const noticeEnd = noticeIndex >= 0 ? currentCode.indexOf('*/', noticeIndex) + 2 : -1;
      const insertIndex = markerIndex >= 0 ? markerIndex : noticeEnd;
      currentCode = insertIndex >= 0
        ? `${currentCode.slice(0, insertIndex)}\n${dispatch}\n${currentCode.slice(insertIndex)}`
        : `${dispatch}\n${currentCode}`;
    }
    currentCode = applyOfficialNotice(currentCode, {
      appName: String(pkg.PackageInfo?.Name || path.basename(filePath)),
      key,
      policy: pkg.ResourcePolicies.ApiEngines[key] || {
        Ownership: 'Platform', UpgradePolicy: 'Managed',
      },
    });
    if (hasStandalone) fs.writeFileSync(standalonePath, currentCode, 'utf8');
    target.ApiV8Code = currentCode;
  }
  for (const [key, patch] of Object.entries(update.enginePatches || {})) {
    const target = pkg.SysApiEngines.find((item) => item.ApiEngineKey === key);
    if (!target) throw new Error(`${path.basename(filePath)} 缺少待修正元数据的接口：${key}`);
    Object.assign(target, patch);
  }
  for (const engine of update.engines) {
    const index = pkg.SysApiEngines.findIndex((item) => item.ApiEngineKey === engine.ApiEngineKey);
    if (index >= 0) pkg.SysApiEngines[index] = engine;
    else pkg.SysApiEngines.push(engine);
    pkg.ResourcePolicies.ApiEngines[engine.ApiEngineKey] = {
      Ownership: engine.Ownership || 'Platform',
      UpgradePolicy: engine.UpgradePolicy || 'Managed',
    };
  }
  pkg.PackageInfo.ApiEngineCount = pkg.SysApiEngines.length;
  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

for (const [fileName, update] of Object.entries(packageUpdates)) {
  for (const root of packageRoots) {
    const filePath = path.join(root, fileName);
    if (fs.existsSync(filePath)) updatePackage(filePath, update);
  }
}

console.log('Controller → ApiEngine migration resources configured.');
