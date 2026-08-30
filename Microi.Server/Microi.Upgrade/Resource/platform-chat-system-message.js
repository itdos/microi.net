/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-chat-system-message
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
// ApiRoutes 兼容旧 DiyChat 地址时，仍把动作归一为唯一的受管消息写入语义。
var systemMessageRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '').toLowerCase();
if (systemMessageRoute === '/api/diychat/sendsystemmessage') {
  V8.Param.Action = 'PersistSystemMessage';
  if (!V8.Param.RequestId) V8.Param.RequestId = V8.Method.NewUlid();
}

/* V8 ApiEngine | ApiEngineKey: platform-chat-system-message | Version: v1.1.0 */

var param = V8.Param || {};

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function fail(message, code) {
  return { Code: code || 0, Msg: message };
}

if (!V8.CurrentUser || !V8.CurrentUser.Id) return fail('登录身份已过期，请重新登录。', 1001);
var isAdmin = V8.CurrentUser._IsAdmin === true || Number(V8.CurrentUser.Level || 0) >= 9999;
if (!isAdmin) return fail('只有平台超级管理员可以发送系统消息。');
if (String(param.Action || '').trim() !== 'PersistSystemMessage') return fail('不支持的系统消息动作。');

var toUserId = text(param.ToUserId, 100);
var rawContent = String(param.Content === null || typeof param.Content === 'undefined' ? '' : param.Content);
var requestId = text(param.RequestId, 200);
if (!requestId || !toUserId || !rawContent.trim()) return fail('RequestId、消息内容和接收用户不能为空。');
if (rawContent.length > 200000) return fail('系统消息内容不能超过 200000 个字符。');

// 系统消息策略入口不再读写聊天业务数据；所有持久化、联系人、未读和幂等
// 统一由消息通知应用唯一拥有的固定 Managed runtime 完成。
return V8.ApiEngine.Run('platform-chat-runtime', {
  Action: 'PersistSystemMessage',
  RequestId: requestId,
  ToUserId: toUserId,
  Content: rawContent,
  OtherInfo: text(param.OtherInfo, 20000),
  IsRead: param.IsRead === true,
  Type: '系统消息'
}, V8.DbTrans);
