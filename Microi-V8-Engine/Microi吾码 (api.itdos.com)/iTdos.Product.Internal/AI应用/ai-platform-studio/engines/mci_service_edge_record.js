/*
 * 服务拓扑聚合：接收有界聚合样本，EdgeKey和RowVersion保证跨节点条件累加。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法记录服务拓扑。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var fromKey = text(V8.Param && V8.Param.FromServiceKey), toKey = text(V8.Param && V8.Param.ToServiceKey), environment = text(V8.Param && V8.Param.Environment);
if (!fromKey || !toKey || fromKey === toKey) return fail('FromServiceKey和ToServiceKey不能为空且不能相同。');
var fromResult = V8.FormEngine.GetFormData('mci_service_registry', { _Where: [['ServiceKey', '=', fromKey]] }, V8.DbTrans);
var toResult = V8.FormEngine.GetFormData('mci_service_registry', { _Where: [['ServiceKey', '=', toKey]] }, V8.DbTrans);
if (!fromResult || fromResult.Code !== 1 || !fromResult.Data || !toResult || toResult.Code !== 1 || !toResult.Data) return fail('来源或目标服务不存在。');
var count = Math.max(1, Math.min(1000000, parseInt((V8.Param && V8.Param.CallCount) || 1, 10) || 1));
var errors = Math.max(0, Math.min(count, parseInt((V8.Param && V8.Param.ErrorCount) || 0, 10) || 0));
var p95 = Math.max(0, Math.min(3600000, Number((V8.Param && V8.Param.P95DurationMs) || 0)));
var edgeKey = String(V8.EncryptHelper.Sha256Hex(fromResult.Data.Id + ':' + toResult.Data.Id + ':' + environment)).toLowerCase(), now = DateNow('yyyy-MM-dd HH:mm:ss');
for (var attempt = 0; attempt < 3; attempt++) {
  var existing = V8.FormEngine.GetFormData('mci_service_call_edge', { _Where: [['EdgeKey', '=', edgeKey]] }, V8.DbTrans);
  if (!existing || existing.Code !== 1 || !existing.Data) {
    var add = V8.FormEngine.AddFormData('mci_service_call_edge', { EdgeKey: edgeKey, FromServiceId: fromResult.Data.Id, ToServiceId: toResult.Data.Id, Environment: environment, CallCount: count, ErrorCount: errors, P95DurationMs: p95, LastTraceId: text(V8.Param && V8.Param.TraceId), LastSeenTime: now, RowVersion: 1 }, V8.DbTrans);
    if (add && add.Code === 1) return { Code: 1, Data: { EdgeKey: edgeKey, Created: true, RowVersion: 1 } };
    continue;
  }
  var row = existing.Data, version = Number(row.RowVersion || 0);
  var weightedP95 = (Number(row.P95DurationMs || 0) * Number(row.CallCount || 0) + p95 * count) / Math.max(1, Number(row.CallCount || 0) + count);
  var update = V8.FormEngine.UptFormDataByWhere('mci_service_call_edge', {
    _Where: [['Id', '=', row.Id], ['AND', 'RowVersion', '=', version]],
    CallCount: Number(row.CallCount || 0) + count,
    ErrorCount: Number(row.ErrorCount || 0) + errors,
    P95DurationMs: Math.round(weightedP95 * 100) / 100,
    LastTraceId: text(V8.Param && V8.Param.TraceId) || row.LastTraceId,
    LastSeenTime: now,
    RowVersion: version + 1
  }, V8.DbTrans);
  var verify = V8.FormEngine.GetFormData('mci_service_call_edge', { Id: row.Id }, V8.DbTrans);
  if (update && update.Code === 1 && verify && verify.Code === 1 && Number(verify.Data.RowVersion || 0) === version + 1) return { Code: 1, Data: { EdgeKey: edgeKey, Created: false, RowVersion: version + 1 } };
}
return fail('服务拓扑聚合发生持续并发冲突，请重试。', { Retryable: true });
