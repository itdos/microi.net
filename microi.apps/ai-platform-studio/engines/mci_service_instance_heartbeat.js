/*
 * 服务实例心跳：持有实例令牌才能续租；令牌原文不入库、不写日志。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法续租服务实例。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var serviceKey = text(V8.Param && V8.Param.ServiceKey), instanceKey = text(V8.Param && V8.Param.InstanceKey), token = text(V8.Param && V8.Param.InstanceToken);
if (!serviceKey || !instanceKey || !token) return fail('ServiceKey、InstanceKey和InstanceToken不能为空。');
var serviceResult = V8.FormEngine.GetFormData('mci_service_registry', { _Where: [['ServiceKey', '=', serviceKey]] });
if (!serviceResult || serviceResult.Code !== 1 || !serviceResult.Data) return { Code: 2, Msg: '服务目录项不存在。' };
var instanceResult = V8.FormEngine.GetFormData('mci_service_instance', { _Where: [['ServiceId', '=', serviceResult.Data.Id], ['AND', 'InstanceKey', '=', instanceKey]] });
if (!instanceResult || instanceResult.Code !== 1 || !instanceResult.Data) return { Code: 2, Msg: '服务实例不存在。' };
var instance = instanceResult.Data, tokenHash = String(V8.EncryptHelper.Sha256Hex(token)).toLowerCase();
if (tokenHash !== String(instance.TokenHash || '').toLowerCase()) return fail('实例令牌校验失败。');
var requestedLease = parseInt((V8.Param && V8.Param.LeaseSeconds) || instance.LeaseSeconds || 60, 10) || 60;
var leaseSeconds = Math.max(15, Math.min(300, requestedLease));
var now = System.DateTime.UtcNow, nowText = now.ToString('yyyy-MM-dd HH:mm:ss'), expires = now.AddSeconds(leaseSeconds).ToString('yyyy-MM-dd HH:mm:ss');
var rowVersion = Number(instance.RowVersion || 0), fence = Number(instance.FencingToken || 0) + 1;
var requestedState = text(V8.Param && V8.Param.State);
var nextState = String(instance.State || '') === 'Draining' ? 'Draining' : (requestedState === 'Starting' ? 'Starting' : 'Ready');
var update = V8.FormEngine.UptFormDataByWhere('mci_service_instance', {
  _Where: [['Id', '=', instance.Id], ['AND', 'RowVersion', '=', rowVersion], ['AND', 'TokenHash', '=', tokenHash]],
  State: nextState,
  VersionNo: text(V8.Param && V8.Param.VersionNo) || instance.VersionNo,
  LabelsJson: V8.Param && V8.Param.Labels ? JSON.stringify(V8.Param.Labels) : (instance.LabelsJson || '{}'),
  LeaseSeconds: leaseSeconds,
  LeaseExpiresAt: expires,
  LastHeartbeatTime: nowText,
  FencingToken: fence,
  RowVersion: rowVersion + 1
});
if (!update || update.Code !== 1) return update || fail('心跳发生并发冲突，请立即重试。');
var verify = V8.FormEngine.GetFormData('mci_service_instance', { Id: instance.Id });
if (!verify || verify.Code !== 1 || Number(verify.Data.RowVersion || 0) !== rowVersion + 1 || Number(verify.Data.FencingToken || 0) !== fence) return fail('心跳租约回读失败。');
V8.FormEngine.UptFormData('mci_service_registry', { Id: serviceResult.Data.Id, HealthState: nextState === 'Ready' ? 'Healthy' : 'Degraded', LastSeenTime: nowText });
return { Code: 1, Data: { InstanceId: instance.Id, InstanceKey: instanceKey, State: nextState, LeaseExpiresAt: expires, FencingToken: fence, RowVersion: rowVersion + 1 }, Msg: '服务实例租约已续期。' };
