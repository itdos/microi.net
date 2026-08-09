/*
 * 服务实例排空：管理员或实例令牌持有人可进入排空；恢复接流必须显式Undrain。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法改变实例状态。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var instanceId = text(V8.Param && V8.Param.InstanceId), action = text(V8.Param && V8.Param.Action);
if (!instanceId || (action !== 'Drain' && action !== 'Undrain' && action !== 'Unavailable')) return fail('InstanceId不能为空，Action只允许Drain、Undrain或Unavailable。');
var instanceResult = V8.FormEngine.GetFormData('mci_service_instance', { Id: instanceId });
if (!instanceResult || instanceResult.Code !== 1 || !instanceResult.Data) return { Code: 2, Msg: '服务实例不存在。' };
var instance = instanceResult.Data, isAdmin = Number((V8.CurrentUser && V8.CurrentUser.Level) || 0) >= 9999;
var suppliedToken = text(V8.Param && V8.Param.InstanceToken);
if (!isAdmin && (!suppliedToken || String(V8.EncryptHelper.Sha256Hex(suppliedToken)).toLowerCase() !== String(instance.TokenHash || '').toLowerCase())) return fail('只有超级管理员或实例令牌持有人可以改变状态。');
var rowVersion = Number(instance.RowVersion || 0), fence = Number(instance.FencingToken || 0) + 1, now = System.DateTime.UtcNow, nowText = now.ToString('yyyy-MM-dd HH:mm:ss');
var nextState = action === 'Drain' ? 'Draining' : (action === 'Undrain' ? 'Ready' : 'Unavailable');
var update = V8.FormEngine.UptFormDataByWhere('mci_service_instance', {
  _Where: [['Id', '=', instance.Id], ['AND', 'RowVersion', '=', rowVersion]],
  State: nextState,
  Weight: nextState === 'Ready' ? Math.max(1, Number(instance.Weight || 100)) : 0,
  DrainingSince: nextState === 'Draining' ? nowText : '',
  LeaseExpiresAt: nextState === 'Unavailable' ? nowText : instance.LeaseExpiresAt,
  FencingToken: fence,
  RowVersion: rowVersion + 1
});
if (!update || update.Code !== 1) return update || fail('实例状态发生并发冲突，请重试。');
var verify = V8.FormEngine.GetFormData('mci_service_instance', { Id: instance.Id });
if (!verify || verify.Code !== 1 || String(verify.Data.State || '') !== nextState || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('实例状态回读失败。');
return { Code: 1, Data: { InstanceId: instance.Id, State: nextState, FencingToken: fence, RowVersion: rowVersion + 1 }, Msg: nextState === 'Draining' ? '实例已进入排空，不再分配新流量。' : (nextState === 'Ready' ? '实例已恢复接流。' : '实例已标记不可用。') };
