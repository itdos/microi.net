/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-saas-public-trial
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-public-trial
 * Version: v1.0.5
 * Function:
 * - 固定主租户匿名空库申请、验证码与推广能力票据校验、稳定申请编号及安全任务进度查询。
 */

var p=JSON.parse(JSON.stringify(V8.Param || {}));
var action=String(p.Action || 'Bootstrap');
var allowed=action==='Progress'?['Action','RequestId','ProgressToken']:action==='Create'?
 ['Action','RequestId','TenantKey','SystemName','ContactName','ContactPhone','AdminPassword','CaptchaId','CaptchaValue','ReferralUserId','LinkToken','Website']:
 ['Action','ReferralUserId','LinkToken'];
// ApiEngineController 会加入可信协议上下文；只接受并丢弃这些已知字段，不能传入开通原子作为业务授权。
var transport=['OsClient','ApiEngineKey','ApiAddress','_CurrentUser','_DeviceId','_InvokeType',
 '_HttpMethod','_RequestPath','_RequestScheme','_RequestHost','_RequestPathBase','_RawBody','_ContentType','_RouteValues',
 '_BackgroundTaskId','_BackgroundTaskFenceToken','TestParam1'];
if(Object.keys(p).some(function(k){return allowed.indexOf(k)<0 && transport.indexOf(k)<0;}))return {Code:0,Msg:'公开开通请求包含不支持的字段。'};
// 旧宿主会注入 TestParam1 占位值；只兼容有界标量，永远不作为开通参数传递。
if(p.TestParam1!=null && (typeof p.TestParam1==='object' || String(p.TestParam1).length>200))return {Code:0,Msg:'兼容占位参数不符合安全约束。'};
if(action==='Create' && p.Website)return {Code:0,Msg:'开通请求未通过校验。'};
var clean={Action:action==='Create'?'Queue':action};
allowed.forEach(function(k){if(k==='Action'||k==='Website')return;if(p[k]!=null)clean[k]=String(p[k]);});
if(['TenantKey','SystemName','ContactName','ContactPhone'].some(function(k){return clean[k] && /[\u0000-\u001f\u007f]/.test(clean[k]);}))return {Code:0,Msg:'开通信息包含无效字符。'};
return V8.Method.SaasPublicTrialAtom(clean);
