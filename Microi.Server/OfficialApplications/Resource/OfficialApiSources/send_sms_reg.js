/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：send_sms_reg
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: send_sms_reg
 * Version: v1.0.2
 * Function:
 * - 发送阿里云短信验证码；租户后端私有设置优先，旧 SaaS 字段仅作成对凭据兼容回退。
 */

// 保留旧公开地址，但任何无有效内部派发证明的请求都经过统一图形校验。
var requestedTenant = String(V8.Param.OsClient || '').trim();
var actualTenant = String(V8.OsClient || '').trim();
if (!actualTenant || (requestedTenant && requestedTenant.toLowerCase() !== actualTenant.toLowerCase())) {
  return { Code: 0, Msg: '禁止跨租户发送注册验证码。' };
}
var dispatchProof = String(V8.Param._DispatchProof || '');
if (!dispatchProof) {
  return V8.ApiEngine.Run('send-sms-reg', {
    Phone: V8.Param.Phone, _CaptchaId: V8.Param._CaptchaId,
    _CaptchaValue: V8.Param._CaptchaValue, OsClient: actualTenant
  });
}
if (!/^[a-f0-9]{32}$/i.test(dispatchProof)) return { Code: 0, Msg: '短信派发校验失败，请重新获取图形验证码。' };
var dispatchKey = 'Microi:' + actualTenant + ':SmsDispatchProof:' + dispatchProof;
var dispatchPhone = V8.Cache.HashGet(dispatchKey, 'phone');
if (String(dispatchPhone || '') !== String(V8.Param.Phone || '') || !V8.Cache.HashDelete(dispatchKey, 'phone')) {
  return { Code: 0, Msg: '短信派发校验已失效，请重新获取图形验证码。' };
}
//var apiAddress = 'https://dysmsapi.aliyuncs.com/';
if(!V8.Param.Phone || V8.Param.Phone.length != 11){
  return { Code : 0, Msg : '手机号错误！' };
}
//生成短信验证码。5分钟内没必要重新生成，直接发送之前的。
var smsCode = V8.Cache.Get(`Microi:${V8.OsClient}:SmsCaptcha:` + V8.Param.Phone);
if(!smsCode){
  // NewGuid 由可信后端产生随机值；六位码不再出现 Math.random 生成的短码。
  smsCode = String(100000 + parseInt(String(V8.Method.NewGuid()).replace(/-/g, '').substring(0, 8), 16) % 900000);
}
//判断30秒内不能重复发送短信
var smsCodeTime = parseInt(V8.Cache.Get(`Microi:${V8.OsClient}:SmsCaptcha:` + V8.Param.Phone + '_time'));
var timeChang = (parseInt(new Date().getTime() / 1000) - smsCodeTime);
if(smsCodeTime && timeChang < 30){
  return { Code : 0, Msg : `请[${30 - timeChang}]秒后重试！` };
}
// 租户自治配置优先从 mci_system_setting 的后端私有投影读取；旧租户尚未迁移时
// 才兼容 sys_osclients 历史字段。ServerPrivateSettings 不会下发浏览器。
var privateSettings = V8.SysConfig && V8.SysConfig.ServerPrivateSettings
  ? V8.SysConfig.ServerPrivateSettings
  : {};
var legacySmsSettings = V8.OsClientModel || {};
var tenantAccessKeyId = privateSettings['Sms.Aliyun.AccessKeyId'] || '';
var tenantAccessKeySecret = privateSettings['Sms.Aliyun.AccessKeySecret'] || '';
// AccessKey ID/Secret 必须成对取自同一来源，避免租户只启用一项时与旧值混用。
var usingTenantSmsSettings = !!tenantAccessKeyId && !!tenantAccessKeySecret;
var accessKeyId = usingTenantSmsSettings ? tenantAccessKeyId : (legacySmsSettings.AliSmsAccessKeyId || '');
var accessKeySecret = usingTenantSmsSettings ? tenantAccessKeySecret : (legacySmsSettings.AliSmsAccessKeySecret || '');
var signName = privateSettings['Sms.Aliyun.SignName'] || '小吾科技';
var templateCode = privateSettings['Sms.Aliyun.TemplateCode'] || 'SMS_7870008';
if (!accessKeyId || !accessKeySecret) {
  return { Code: 0, Msg: '当前租户尚未配置阿里云短信凭据，请在系统设置的“安全与服务接入”中完成配置。' };
}
var postParam = {
  SignName: signName,//注册验证 身份验证  宁波小吾科技
  AccessKeyId : accessKeyId,
  AccessKeySecret : accessKeySecret,
  //SMS_7870004 ：验证码${code}，您正在注册成为${product}用户，感谢您的支持！
  //SMS_7870008 ：验证码${code}，您正在进行${product}身份验证，打死不要告诉别人哦！
  TemplateCode: templateCode,
  PhoneNumbers : V8.Param.Phone,//发信发送的目的号码.多个号码之间用半角逗号隔开 
  TemplateParam : `{ "code" : "${smsCode}", "product" : "[Microi吾码]" }`,
};
var result = V8.Sms.Send(postParam);

function getAliSmsBody(resp) {
  try {
    if (resp && resp.Data && resp.Data.Body) {
      return resp.Data.Body;
    }
    if (resp && resp.Body) {
      return resp.Body;
    }
  } catch (e) {}
  return null;
}

function getAliSmsMsg(body) {
  if (!body) return '短信服务无响应';
  var code = body.Code || '';
  var msg = body.Message || body.Msg || '';
  if (code && msg) return code + '：' + msg;
  return msg || code || '短信发送失败';
}

var aliBody = getAliSmsBody(result);
var aliCode = aliBody && aliBody.Code ? String(aliBody.Code) : '';
var isAliSuccess = result && result.Code == 1 && aliCode == 'OK';

result.DataAppend = {
  Provider: 'Aliyun',
  ConfigSource: usingTenantSmsSettings ? 'TenantSystemSettings' : 'LegacySaaS'
};

if (!isAliSuccess) {
  result.Code = 0;
  result.Msg = getAliSmsMsg(aliBody);
  return result;
}

//如果发送成功：将验证码缓存起来
if(result.Code){
  V8.Cache.Set(`Microi:${V8.OsClient}:SmsCaptcha:` + V8.Param.Phone, smsCode, '0.00:10:00');
  V8.Cache.Set(`Microi:${V8.OsClient}:SmsCaptcha:` + V8.Param.Phone + '_time', (new Date().getTime() / 1000).toString(), '0.00:10:00');
  //清除图形验证码缓存
  // V8.Cache.HashRemove(`DefaultRedis:${V8.Param._CaptchaId}`);
}
return result;
