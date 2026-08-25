/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-tencent-im
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-tencent-im
// Version: v1.0.0
// 腾讯 IM Secret 只在后端私有设置与签名原子能力中使用，浏览器不得提交 SecretKey。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var userId = String(V8.Param.UserId || V8.Param.Identifier || '').trim();
var signature = V8.Method.GenerateTencentImUserSig({
  UserId: userId,
  Expire: Number(V8.Param.Expire || 86400)
});
if (!signature || signature.Code != 1) return signature || { Code:0, Msg:'生成腾讯 IM UserSig 失败。' };
if (action === 'GetUserSig') return signature;
if (action !== 'MultiAccountImport' && action !== 'MultiAccountDelete') {
  return { Code:0, Msg:'不支持的腾讯 IM 动作。' };
}
if (!signature.Data.Identifier) return { Code:0, Msg:'当前租户尚未配置 TencentImIdentifier。' };
var apiName = action === 'MultiAccountImport' ? 'multiaccount_import' : 'account_delete';
var random = Number(String(V8.Method.GetTimestamp()).slice(-8));
var url = 'https://console.tim.qq.com/v4/im_open_login_svc/' + apiName
  + '?sdkappid=' + encodeURIComponent(String(signature.Data.SdkAppId))
  + '&identifier=' + encodeURIComponent(signature.Data.Identifier)
  + '&usersig=' + encodeURIComponent(signature.Data.UserSig)
  + '&random=' + random
  + '&contenttype=json';
var body = action === 'MultiAccountImport'
  ? { AccountList: V8.Param.AccountList || [] }
  : { DeleteItem: V8.Param.DeleteItem || [] };
var response = V8.Http.Post({
  Url: url,
  PostParamString: JSON.stringify(body),
  ParamType: 'json',
  Timeout: 60
});
try {
  var data = typeof response === 'string' ? JSON.parse(response) : response;
  if (data && Number(data.ErrorCode || 0) !== 0) {
    return { Code:0, Data:data, Msg:data.ErrorInfo || '腾讯 IM 操作失败。' };
  }
  return { Code:1, Data:data, Msg:'腾讯 IM 操作成功。' };
} catch (error) {
  return { Code:0, Msg:'腾讯 IM 返回了无效 JSON：' + error.message };
}
