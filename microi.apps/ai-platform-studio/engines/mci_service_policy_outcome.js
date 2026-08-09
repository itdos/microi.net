/*
 * 服务调用结果回报：调用许可归属校验、持久幂等台账和同事务拓扑聚合。
 * 熔断状态由申请端从持久结果重建，避免节点强杀造成Redis增量与数据库事实不一致。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法回报服务调用结果。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (ignore) { return fallback; } }
function boolean(value) { return value === true || value === 1 || text(value) === '1' || text(value).toLowerCase() === 'true'; }
var param = V8.Param || {}, currentUser = V8.CurrentUser || {}, isAdmin = Number(currentUser.Level || 0) >= 9999, permitId = text(param.PermitId);
if (!/^[A-Za-z0-9-]{10,80}$/.test(permitId)) return fail('PermitId格式无效。');
var outcomeKey = text(V8.EncryptHelper.Sha256Hex(permitId)).toLowerCase(), existing = V8.FormEngine.GetFormData('mci_service_call_outcome', { _Where: [['OutcomeKey', '=', outcomeKey]] }, V8.DbTrans);
if (existing && existing.Code === 1 && existing.Data) {
  if (!isAdmin && text(existing.Data.CallerUserId) !== text(currentUser.Id)) return fail('调用许可不属于当前用户。');
  return { Code: 1, Data: { OutcomeId: existing.Data.Id, OutcomeKey: outcomeKey, Status: existing.Data.Status, Success: Number(existing.Data.Success || 0) === 1, Reused: true }, Msg: '已幂等复用服务调用结果。' };
}
var permit = parse(V8.Cache.Get('mci:service:permit:' + permitId), null);
if (!permit) return fail('调用许可不存在或已过期。');
if (!isAdmin && text(permit.CallerUserId) !== text(currentUser.Id)) return fail('调用许可不属于当前用户。');
if (Number(permit.ExpiresTimestamp || 0) < Number(V8.Method.GetTimestamp())) return fail('调用许可已过期。');
var claimKey = 'mci:service:outcome-claim:' + outcomeKey;
if (!V8.Cache.SetIfNotExists(claimKey, text(currentUser.Id), 30)) {
  existing = V8.FormEngine.GetFormData('mci_service_call_outcome', { _Where: [['OutcomeKey', '=', outcomeKey]] }, V8.DbTrans);
  if (existing && existing.Code === 1 && existing.Data && (isAdmin || text(existing.Data.CallerUserId) === text(currentUser.Id))) return { Code: 1, Data: { OutcomeId: existing.Data.Id, OutcomeKey: outcomeKey, Status: existing.Data.Status, Success: Number(existing.Data.Success || 0) === 1, Reused: true }, Msg: '已幂等复用服务调用结果。' };
  return fail('该调用结果正在其它节点处理，请稍后重试。', { Retryable: true });
}
var success = boolean(param.Success), statusCode = Math.max(0, Math.min(999, Math.floor(Number(param.StatusCode || (success ? 200 : 500))))), durationMs = Math.max(0, Math.min(3600000, Number(param.DurationMs || 0))), traceId = text(param.TraceId || permit.TraceId);
if (traceId.length > 100 || !isFinite(durationMs)) return fail('TraceId或DurationMs格式无效。');
var service = permit.Service || {}, selected = permit.Selected || {}, policy = permit.Policy || {}, nowTimestamp = Number(V8.Method.GetTimestamp()), now = DateNow('yyyy-MM-dd HH:mm:ss'), resultData = { CircuitSource: 'PersistentOutcomeLedger', EdgeRecorded: false };
var add = V8.FormEngine.AddFormData('mci_service_call_outcome', { OutcomeKey: outcomeKey, PermitId: permitId, CallerUserId: text(permit.CallerUserId), ServiceId: text(service.Id), InstanceId: text(selected.Id), PolicyKey: text(policy.PolicyKey), PolicyHash: text(policy.ContentHash || 'default'), FromServiceKey: text(permit.FromServiceKey), Success: success ? 1 : 0, StatusCode: statusCode, DurationMs: durationMs, TraceId: traceId, Status: 'Applied', AppliedTimestamp: nowTimestamp, AppliedTime: now, ResultJson: JSON.stringify(resultData) }, V8.DbTrans);
if (!add || add.Code !== 1) return add || fail('保存服务调用结果失败。');
if (text(permit.FromServiceKey) && text(permit.FromServiceKey) !== text(service.ServiceKey)) {
  var edge = V8.ApiEngine.Run('mci-service-edge-record', { FromServiceKey: text(permit.FromServiceKey), ToServiceKey: text(service.ServiceKey), Environment: text(service.Environment), CallCount: 1, ErrorCount: success ? 0 : 1, P95DurationMs: durationMs, TraceId: traceId }, V8.DbTrans);
  if (!edge || edge.Code !== 1) return edge || fail('聚合服务调用拓扑失败。');
  resultData.EdgeRecorded = true; resultData.EdgeKey = edge.Data && edge.Data.EdgeKey;
}
var saved = V8.FormEngine.GetFormData('mci_service_call_outcome', { _Where: [['OutcomeKey', '=', outcomeKey]] }, V8.DbTrans);
if (!saved || saved.Code !== 1 || !saved.Data) return fail('服务调用结果回读失败，事务已回滚。');
if (resultData.EdgeRecorded) {
  var update = V8.FormEngine.UptFormDataByWhere('mci_service_call_outcome', { _Where: [['Id', '=', saved.Data.Id], ['AND', 'OutcomeKey', '=', outcomeKey]], ResultJson: JSON.stringify(resultData) }, V8.DbTrans);
  if (!update || update.Code !== 1) return update || fail('更新服务调用结果证据失败。');
}
return { Code: 1, Data: { OutcomeId: saved.Data.Id, OutcomeKey: outcomeKey, Status: 'Applied', Success: success, Reused: false, EdgeRecorded: resultData.EdgeRecorded }, Msg: '服务调用结果已幂等入账。' };
