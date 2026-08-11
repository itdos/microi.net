/*
 * 服务实例注册：服务目录是控制面，实例令牌哈希、租约、行版本与栅栏令牌是共享事实。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能注册服务实例。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var serviceKey = text(V8.Param && V8.Param.ServiceKey), instanceKey = text(V8.Param && V8.Param.InstanceKey), endpoint = text(V8.Param && V8.Param.Endpoint);
if (!serviceKey || !instanceKey || !endpoint) return fail('ServiceKey、InstanceKey和Endpoint不能为空。');
if (!/^https?:\/\//i.test(endpoint) || endpoint.length > 2000) return fail('Endpoint必须是长度不超过2000的HTTP(S)绝对地址。');
if (!/^[A-Za-z0-9._:-]{1,160}$/.test(instanceKey)) return fail('InstanceKey只能包含字母、数字、点、下划线、冒号和短横线。');
var serviceResult = V8.FormEngine.GetFormData('mci_service_registry', { _Where: [['ServiceKey', '=', serviceKey]] });
if (!serviceResult || serviceResult.Code !== 1 || !serviceResult.Data) return { Code: 2, Msg: '服务目录项不存在。' };
var service = serviceResult.Data;
if (Number(service.Enabled || 0) !== 1) return fail('服务目录项未启用。');
var leaseSeconds = Math.max(15, Math.min(300, parseInt((V8.Param && V8.Param.LeaseSeconds) || 60, 10) || 60));
var now = System.DateTime.UtcNow, expires = now.AddSeconds(leaseSeconds).ToString('yyyy-MM-dd HH:mm:ss'), nowText = now.ToString('yyyy-MM-dd HH:mm:ss');
var existing = V8.FormEngine.GetFormData('mci_service_instance', { _Where: [['ServiceId', '=', service.Id], ['AND', 'InstanceKey', '=', instanceKey]] });
var suppliedToken = text(V8.Param && V8.Param.InstanceToken), issuedToken = '', tokenHash = '';
if (existing && existing.Code === 1 && existing.Data) {
  var row = existing.Data;
  if (!suppliedToken || String(V8.EncryptHelper.Sha256Hex(suppliedToken)).toLowerCase() !== String(row.TokenHash || '').toLowerCase()) return fail('实例已存在，必须提供首次注册返回的InstanceToken。');
  tokenHash = String(row.TokenHash || '').toLowerCase();
  var rowVersion = Number(row.RowVersion || 0), fence = Number(row.FencingToken || 0) + 1;
  var update = V8.FormEngine.UptFormDataByWhere('mci_service_instance', {
    _Where: [['Id', '=', row.Id], ['AND', 'RowVersion', '=', rowVersion], ['AND', 'TokenHash', '=', tokenHash]],
    Endpoint: endpoint,
    VersionNo: text(V8.Param && V8.Param.VersionNo),
    Zone: text(V8.Param && V8.Param.Zone),
    LabelsJson: JSON.stringify((V8.Param && V8.Param.Labels) || {}),
    State: 'Ready',
    Weight: Math.max(0, Math.min(1000, parseInt((V8.Param && V8.Param.Weight) || row.Weight || 100, 10) || 0)),
    LeaseSeconds: leaseSeconds,
    LeaseExpiresAt: expires,
    LastHeartbeatTime: nowText,
    FencingToken: fence,
    RowVersion: rowVersion + 1,
    DrainingSince: ''
  });
  if (!update || update.Code !== 1) return update || fail('实例注册发生并发冲突，请重试。');
  var verify = V8.FormEngine.GetFormData('mci_service_instance', { Id: row.Id });
  if (!verify || verify.Code !== 1 || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('实例注册回读失败。');
  V8.FormEngine.UptFormData('mci_service_registry', { Id: service.Id, HealthState: 'Healthy', LastSeenTime: nowText });
  return { Code: 1, Data: { InstanceId: row.Id, InstanceKey: instanceKey, ServiceKey: serviceKey, State: 'Ready', LeaseExpiresAt: expires, FencingToken: fence, RowVersion: rowVersion + 1, Reused: true }, Msg: '服务实例已重新取得租约。' };
}
issuedToken = V8.Method.NewUlid() + V8.Method.NewGuid().replace(/-/g, '');
tokenHash = String(V8.EncryptHelper.Sha256Hex(issuedToken)).toLowerCase();
var instanceId = V8.Method.NewUlid();
var add = V8.FormEngine.AddFormData('mci_service_instance', {
  Id: instanceId, ServiceId: service.Id, InstanceKey: instanceKey, Endpoint: endpoint,
  VersionNo: text(V8.Param && V8.Param.VersionNo), Zone: text(V8.Param && V8.Param.Zone),
  LabelsJson: JSON.stringify((V8.Param && V8.Param.Labels) || {}), State: 'Ready',
  Weight: Math.max(0, Math.min(1000, parseInt((V8.Param && V8.Param.Weight) || 100, 10) || 0)),
  TokenHash: tokenHash, LeaseSeconds: leaseSeconds, LeaseExpiresAt: expires,
  LastHeartbeatTime: nowText, FencingToken: 1, RowVersion: 1, StartedTime: nowText
});
if (!add || add.Code !== 1) {
  var raced = V8.FormEngine.GetFormData('mci_service_instance', { _Where: [['ServiceId', '=', service.Id], ['AND', 'InstanceKey', '=', instanceKey]] });
  if (raced && raced.Code === 1 && raced.Data) return fail('实例被并发注册，请使用该实例的既有InstanceToken重试。', { Conflict: true, InstanceId: raced.Data.Id });
  return add || fail('注册服务实例失败。');
}
V8.FormEngine.UptFormData('mci_service_registry', { Id: service.Id, HealthState: 'Healthy', LastSeenTime: nowText });
return { Code: 1, Data: { InstanceId: instanceId, InstanceKey: instanceKey, InstanceToken: issuedToken, ServiceKey: serviceKey, State: 'Ready', LeaseExpiresAt: expires, FencingToken: 1, RowVersion: 1, Reused: false }, Msg: '服务实例注册成功；InstanceToken只返回本次，请安全保存。' };
