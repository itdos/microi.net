/*
 * 协作租约：共享数据库为事实源；租约只减少冲突，最终保存仍由内容哈希CAS保护。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法使用协作租约。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var resourceType = text(V8.Param && V8.Param.ResourceType), resourceId = text(V8.Param && V8.Param.ResourceId), action = text(V8.Param && V8.Param.Action), clientLeaseId = text(V8.Param && V8.Param.ClientLeaseId);
if (!resourceType || !resourceId || ['Acquire', 'Renew', 'Release', 'Inspect'].indexOf(action) < 0) return fail('ResourceType、ResourceId和有效Action不能为空。');
if (action !== 'Inspect' && (!clientLeaseId || clientLeaseId.length > 120)) return fail('ClientLeaseId不能为空且不能超过120字符。');
var userId = String(V8.CurrentUser.Id || ''), holderName = String(V8.CurrentUser.Name || V8.CurrentUser.Account || ''), now = System.DateTime.UtcNow, nowText = now.ToString('yyyy-MM-dd HH:mm:ss'), expires = now.AddSeconds(45).ToString('yyyy-MM-dd HH:mm:ss');
var existing = V8.FormEngine.GetFormData('mci_collaboration_session', { _Where: [['ResourceType', '=', resourceType], ['AND', 'ResourceId', '=', resourceId]] });
var row = existing && existing.Code === 1 ? existing.Data : null;
if (action === 'Inspect') return { Code: 1, Data: row && row.State === 'Active' && String(row.LeaseExpiresAt || '') > nowText ? row : null };
if (!row) {
  if (action !== 'Acquire') return fail('协作租约不存在，请先Acquire。');
  var sessionId = V8.Method.NewUlid();
  var add = V8.FormEngine.AddFormData('mci_collaboration_session', { Id: sessionId, ResourceType: resourceType, ResourceId: resourceId, ClientLeaseId: clientLeaseId, HolderUserId: userId, HolderName: holderName, State: 'Active', FencingToken: 1, LeaseExpiresAt: expires, LastHeartbeatTime: nowText, CommentCount: 0 });
  if (add && add.Code === 1) return { Code: 1, Data: { SessionId: sessionId, HolderUserId: userId, HolderName: holderName, State: 'Active', FencingToken: 1, LeaseExpiresAt: expires, Acquired: true } };
  existing = V8.FormEngine.GetFormData('mci_collaboration_session', { _Where: [['ResourceType', '=', resourceType], ['AND', 'ResourceId', '=', resourceId]] });
  row = existing && existing.Code === 1 ? existing.Data : null;
  if (!row) return add || fail('获取协作租约失败。');
}
var owned = String(row.HolderUserId || '') === userId && String(row.ClientLeaseId || '') === clientLeaseId, expired = row.State !== 'Active' || String(row.LeaseExpiresAt || '') <= nowText;
if (action === 'Release') {
  if (!owned && Number(V8.CurrentUser.Level || 0) < 9999) return fail('只有租约持有人或超级管理员可以释放。', { HolderName: row.HolderName, LeaseExpiresAt: row.LeaseExpiresAt });
  var release = V8.FormEngine.UptFormDataByWhere('mci_collaboration_session', { _Where: [['Id', '=', row.Id], ['AND', 'FencingToken', '=', Number(row.FencingToken || 0)]], State: 'Released', LeaseExpiresAt: nowText, LastHeartbeatTime: nowText });
  if (!release || release.Code !== 1) return release || fail('释放协作租约发生并发冲突。');
  return { Code: 1, Data: { SessionId: row.Id, State: 'Released', FencingToken: row.FencingToken } };
}
if (action === 'Renew' && !owned) return fail('协作租约不属于当前客户端。', { HolderName: row.HolderName, LeaseExpiresAt: row.LeaseExpiresAt });
if (action === 'Acquire' && !owned && !expired) return fail('资源正在由其他用户编辑。', { Locked: true, HolderName: row.HolderName, LeaseExpiresAt: row.LeaseExpiresAt, FencingToken: row.FencingToken });
var fence = Number(row.FencingToken || 0) + (owned ? 0 : 1);
var update = V8.FormEngine.UptFormDataByWhere('mci_collaboration_session', {
  _Where: [['Id', '=', row.Id], ['AND', 'FencingToken', '=', Number(row.FencingToken || 0)]],
  ClientLeaseId: clientLeaseId, HolderUserId: userId, HolderName: holderName, State: 'Active', FencingToken: fence, LeaseExpiresAt: expires, LastHeartbeatTime: nowText
});
var verify = V8.FormEngine.GetFormData('mci_collaboration_session', { Id: row.Id });
if (!update || update.Code !== 1 || !verify || verify.Code !== 1 || String(verify.Data.ClientLeaseId || '') !== clientLeaseId || Number(verify.Data.FencingToken || 0) !== fence) return fail('协作租约条件更新失败，请重试。');
return { Code: 1, Data: { SessionId: row.Id, HolderUserId: userId, HolderName: holderName, State: 'Active', FencingToken: fence, LeaseExpiresAt: expires, Acquired: !owned } };
