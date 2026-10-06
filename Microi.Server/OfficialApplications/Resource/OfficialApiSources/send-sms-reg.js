/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：send-sms-reg
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: send-sms-reg
 * Version: v1.0.6
 * Function:
 * - 官网注册短信验证码接口：遵循系统图形验证码开关；启用时一次性消费图形验证码，始终限流后调用内部短信发送接口。
 */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function fail(msg) {
  return { Code: 0, Msg: msg || '验证码发送失败。', Data: null };
}

function getClientIp() {
  try {
    var result = V8.Method.GetClientIP();
    return text(result && result.Data ? result.Data : result);
  } catch (ex) {
    return '';
  }
}

function increaseCounter(key) {
  var count = Number(V8.Cache.HashIncrement(key, 'count', 1));
  if (count === 1 && !V8.Cache.Expire(key, 600)) throw new Error('注册限流状态未保存');
  return count;
}

// GetCaptcha 当前返回 {OsClient}:Captcha:{Id}。兼容历史只返回 Captcha:{Id}
// 或已经包含 Microi: 前缀的客户端，避免再次拼接租户导致永远查询不到验证码。
function getCaptchaCacheKey(osClient, captchaId) {
  var id = text(captchaId);
  if (id.indexOf('Microi:') === 0) id = id.substring(7);
  if (id.indexOf(osClient + ':') === 0) id = id.substring(osClient.length + 1);
  if (!/^Captcha:[A-Za-z0-9-]{16,80}$/.test(id)) return '';
  return 'Microi:' + osClient + ':' + id;
}

var osClient = text(V8.OsClient);
if (!osClient || (text(V8.Param.OsClient) && text(V8.Param.OsClient).toLowerCase() !== osClient.toLowerCase())) {
  return fail('禁止跨租户发送注册验证码。');
}
var phone = text(V8.Param.Phone);
var captchaId = text(V8.Param._CaptchaId);
var captchaInput = text(V8.Param._CaptchaValue);
var clientIp = getClientIp();
var actorKey = clientIp || phone;
var failKey = 'Microi:' + osClient + ':OfficialRegisterV2:CaptchaFail:' + actorKey;
var sendKey = 'Microi:' + osClient + ':OfficialRegisterV2:SmsSend:' + actorKey;
var phoneKey = 'Microi:' + osClient + ':OfficialRegisterV2:PhoneSend:' + phone;

if (!/^1\d{10}$/.test(phone)) return fail('请输入正确的11位手机号！');
var configResult = V8.FormEngine.GetFormData('sys_config', {
  _Where: [['IsEnable', '=', 1]], _SelectFields: ['EnableCaptcha']
});
if (!configResult || configResult.Code !== 1 || !configResult.Data) return fail('系统验证码设置读取失败，请稍后重试。');
var configuredCaptcha = configResult.Data.EnableCaptcha;
var captchaRequired = configuredCaptcha === 1 || configuredCaptcha === true || String(configuredCaptcha).toLowerCase() === 'true' || String(configuredCaptcha) === '1';
if (captchaRequired) {
  if (!captchaId) return fail('请先获取图形验证码！');
  if (!captchaInput) return fail('请输入图形验证码！');
  
  var failedCount = parseInt(V8.Cache.HashGet(failKey, 'count') || '0', 10);
  if (!isNaN(failedCount) && failedCount >= 8) {
    return fail('验证码错误次数过多，请10分钟后重试！');
  }
  
  var sentCount = parseInt(V8.Cache.HashGet(sendKey, 'count') || '0', 10);
  var phoneCount = parseInt(V8.Cache.HashGet(phoneKey, 'count') || '0', 10);
  if ((!isNaN(sentCount) && sentCount >= 5) || (!isNaN(phoneCount) && phoneCount >= 5)) {
    return fail('短信发送过于频繁，请10分钟后重试！');
  }
  
  var captchaKey = getCaptchaCacheKey(osClient, captchaId);
  if (!captchaKey) return fail('图形验证码不属于当前租户或格式不正确。');
  var captchaValue = text(V8.Cache.HashGet(captchaKey, 'data'));
  if (!captchaValue) {
    increaseCounter(failKey);
    return fail('图形验证码已失效，请刷新后重试！');
  }
  if (captchaValue.toLowerCase() !== captchaInput.toLowerCase()) {
    increaseCounter(failKey);
    return { Code: 1004, Msg: '图形验证码错误！', Data: null };
  }
  
  // HDEL 的返回值是原子竞争结果；读到相同验证码的另一请求不能再次发信。
  if (!V8.Cache.HashDelete(captchaKey, 'data')) return fail('图形验证码已使用，请刷新后重试。');
  V8.Cache.Remove(failKey);
}
if (increaseCounter(sendKey) > 5 || increaseCounter(phoneKey) > 5) return fail('短信发送过于频繁，请10分钟后重试！');
// 找回密码也从本入口消费验证码，不能删除验证码后再次调用公开校验入口。
// Purpose 只缩小发送范围，不授予免验证码能力；不存在的手机号不发信。
var passwordReset = String(V8.Param.Purpose || '') === 'PasswordReset';
var resetSuccess = { Code: 1, Msg: '若该手机号已注册，短信验证码将很快送达。', Data: null };
if (passwordReset) {
  var userResult = V8.FormEngine.GetFormData('Sys_User', {
    _Where: [['Phone', '=', phone]], _SelectFields: ['Id']
  });
  if (userResult && userResult.Code === 2) return resetSuccess;
  if (!userResult || userResult.Code !== 1 || !userResult.Data || !userResult.Data.Id) return fail('账号校验失败，请稍后重试！');
}
// 唯一、不向客户端回显的一次性派发证明，绑定当前租户和手机号。
var proof = text(V8.Method.NewGuid()).replace(/-/g, '');
var proofKey = 'Microi:' + osClient + ':SmsDispatchProof:' + proof;
if (!V8.Cache.HashSet(proofKey, 'phone', phone) || !V8.Cache.Expire(proofKey, 30)) return fail('验证码服务繁忙，请稍后重试。');

var sendResult = V8.ApiEngine.Run('send_sms_reg', {
  Phone: phone,
  OsClient: osClient,
  _DispatchProof: proof
});
if (!sendResult || sendResult.Code !== 1) {
  return fail(sendResult && sendResult.Msg ? sendResult.Msg : '短信验证码发送失败。');
}

try {
  V8.Method.AddSysLog({
    Type: '官网安全日志',
    Title: passwordReset ? '找回密码短信验证码已发送' : '注册短信验证码已发送',
    Content: 'Phone:' + phone.substring(0, 3) + '****' + phone.substring(7),
    Level: 1
  });
} catch (ex) {
}

return passwordReset ? resetSuccess : { Code: 1, Msg: '短信验证码已发送。', Data: null };
