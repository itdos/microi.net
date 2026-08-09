/*
 * 告警评估：支持手工/推送与定时查询，窗口台账防跨节点重复，活动事件自动聚合和恢复。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function adminOrJob() { var u = V8.CurrentUser || {}; return (u && u.Id && Number(u.Level || 0) >= 9999) || text(V8.Param && V8.Param.JobName) === 'MciAiPlatformMinuteSweep'; }
if (!adminOrJob()) return fail('权限不足：只有超级管理员或平台维护任务才能执行告警评估。');
function list(value) { if (!value) return []; if (value.length !== undefined && typeof value !== 'string') { var a = []; for (var i = 0; i < value.length; i++) a.push(value[i]); return a; } try { var parsed = JSON.parse(text(value)); return parsed && parsed.length !== undefined ? parsed : []; } catch (error) { return []; } }
function parse(value) { if (!value) return {}; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error('QueryJson不是有效JSON。'); } }
function compare(actual, operator, threshold) { if (operator === '>') return actual > threshold; if (operator === '>=') return actual >= threshold; if (operator === '<') return actual < threshold; if (operator === '<=') return actual <= threshold; if (operator === '=') return actual === threshold; if (operator === '<>') return actual !== threshold; return false; }
function safeWhere(value) { var where = list(value); if (where.length > 20) throw new Error('FormEngineCount最多20条条件。'); for (var i = 0; i < where.length; i++) { var row = list(where[i]); if (row.length !== 3 && row.length !== 4) throw new Error('FormEngineCount条件格式无效。'); } return where; }
function resolveSignal(policy, query, windowSeconds) {
  var supplied = V8.Param && V8.Param.ObservedValue;
  if (supplied !== undefined && supplied !== null && supplied !== '' && !isNaN(Number(supplied))) return { ObservedValue: Number(supplied), SignalType: 'Supplied', Metrics: { Source: 'Supplied', ObservedValue: Number(supplied) } };
  var source = text(query.Source || query.SourceType || 'SystemLog'), metric = text(query.Metric || policy.MetricName || 'TotalCount');
  if (source === 'SystemLog') {
    var signal = V8.Method.QuerySystemLogSignal({ WindowSeconds: windowSeconds, Keyword: text(query.Keyword), Type: text(query.Type), Category: text(query.Category), Source: text(query.LogSource), ServiceName: text(query.ServiceName), LevelMin: query.LevelMin });
    if (!signal || signal.Code !== 1 || !signal.Data) throw new Error(text(signal && signal.Msg) || '系统日志信号查询失败。');
    var data = signal.Data, observed;
    if (metric === 'ErrorCount') observed = Number(data.ErrorCount || 0);
    else if (metric === 'ErrorRate') observed = Number(data.ErrorRate || 0);
    else if (metric === 'P95DurationMs' || metric === 'P95') observed = Number(data.P95DurationMs || 0);
    else if (metric === 'NoData') observed = Number(data.TotalCount || 0) === 0 ? 1 : 0;
    else observed = Number(data.TotalCount || 0);
    return { ObservedValue: observed, SignalType: metric, Metrics: data };
  }
  if (source === 'ServiceEdge') {
    var serviceId = text(query.ServiceId || policy.ServiceId), where = [];
    if (serviceId) where = [['FromServiceId', '=', serviceId], ['OR', 'ToServiceId', '=', serviceId]];
    var edgesResult = V8.FormEngine.GetTableData('mci_service_call_edge', { _Where: where, _PageIndex: 1, _PageSize: 1000 });
    if (!edgesResult || edgesResult.Code !== 1) throw new Error(text(edgesResult && edgesResult.Msg) || '服务拓扑信号查询失败。');
    var edges = edgesResult.Data || [], cutoff = System.DateTime.Now.AddSeconds(-windowSeconds).ToString('yyyy-MM-dd HH:mm:ss'), calls = 0, errors = 0, p95 = 0, active = 0;
    for (var e = 0; e < edges.length; e++) { var edge = edges[e] || {}; if (text(edge.LastSeenTime) < cutoff) continue; active++; calls += Number(edge.CallCount || 0); errors += Number(edge.ErrorCount || 0); p95 = Math.max(p95, Number(edge.P95DurationMs || 0)); }
    var edgeObserved = metric === 'ErrorCount' ? errors : (metric === 'ErrorRate' ? (calls ? errors / calls : 0) : (metric === 'P95DurationMs' || metric === 'P95' ? p95 : (metric === 'NoData' ? (active ? 0 : 1) : calls)));
    return { ObservedValue: edgeObserved, SignalType: metric, Metrics: { Source: 'ServiceEdge', ActiveEdges: active, CallCount: calls, ErrorCount: errors, ErrorRate: calls ? errors / calls : 0, P95DurationMs: p95 } };
  }
  if (source === 'FormEngineCount') {
    var tableName = text(query.Table || query.FormEngineKey);
    if (!/^(mci_|diy_)[A-Za-z0-9_]{1,120}$/.test(tableName)) throw new Error('FormEngineCount只允许mci_或diy_业务表。');
    var countResult = V8.FormEngine.GetTableDataCount(tableName, { _Where: safeWhere(query.Where || query._Where) });
    if (!countResult || countResult.Code !== 1) throw new Error(text(countResult && countResult.Msg) || '业务表计数失败。');
    var count = Number(countResult.Data || countResult.DataCount || 0);
    return { ObservedValue: metric === 'NoData' ? (count === 0 ? 1 : 0) : count, SignalType: metric, Metrics: { Source: 'FormEngineCount', Table: tableName, Count: count } };
  }
  throw new Error('QueryJson.Source只允许SystemLog、ServiceEdge或FormEngineCount。');
}
var policyId = text(V8.Param && V8.Param.PolicyId);
if (!policyId) return fail('PolicyId不能为空。');
var policyResult = V8.FormEngine.GetFormData('mci_observability_policy', { Id: policyId }, V8.DbTrans);
if (!policyResult || policyResult.Code !== 1 || !policyResult.Data) return { Code: 2, Msg: '可观测策略不存在。' };
var policy = policyResult.Data;
if (Number(policy.Enabled || 0) !== 1) return { Code: 1, Data: { Triggered: false, Reason: '策略未启用。' } };
var query; try { query = parse(policy.QueryJson); } catch (error) { return fail(error.message); }
var windowSeconds = Math.max(60, Math.min(86400, Number(policy.WindowSeconds || 300))), eventIdInput = text(V8.Param && V8.Param.EventId), timestamp = Number(V8.Method.GetTimestamp());
if (eventIdInput.length > 120) return fail('EventId长度不能超过120。');
var windowKey = eventIdInput || (policyId + ':' + Math.floor(timestamp / windowSeconds));
var evaluationKey = policyId + ':' + windowKey, existingEvaluation = V8.FormEngine.GetFormData('mci_observability_evaluation', { _Where: [['EvaluationKey', '=', evaluationKey]] }, V8.DbTrans);
if (existingEvaluation && existingEvaluation.Code === 1 && existingEvaluation.Data) return { Code: 1, Data: existingEvaluation.Data, Msg: '该策略窗口已评估，已幂等回放。' };
var signal; try { signal = resolveSignal(policy, query, windowSeconds); } catch (error) { return fail(error.message); }
var actual = Number(signal.ObservedValue);
if (isNaN(actual)) return fail('策略信号不是有效数值。');
var rawTriggered = compare(actual, text(policy.Operator || '>='), Number(policy.Threshold || 0)), now = DateNow('yyyy-MM-dd HH:mm:ss'), evaluationId = V8.Method.NewUlid();
var addEvaluation = V8.FormEngine.AddFormData('mci_observability_evaluation', { Id: evaluationId, EvaluationKey: evaluationKey, PolicyId: policyId, WindowKey: windowKey, SignalType: signal.SignalType, ObservedValue: actual, Triggered: rawTriggered ? 1 : 0, Status: 'Running', MetricsJson: JSON.stringify(signal.Metrics || {}), AlertId: '', ErrorMessage: '', EvaluatedTime: now }, V8.DbTrans);
if (!addEvaluation || addEvaluation.Code !== 1) {
  existingEvaluation = V8.FormEngine.GetFormData('mci_observability_evaluation', { _Where: [['EvaluationKey', '=', evaluationKey]] }, V8.DbTrans);
  if (existingEvaluation && existingEvaluation.Code === 1 && existingEvaluation.Data) return { Code: 1, Data: existingEvaluation.Data, Msg: '该策略窗口正在或已经由其它节点评估。' };
  return addEvaluation || fail('创建策略窗口评估台账失败。');
}
var triggerTarget = Math.max(1, Math.min(20, Number(policy.ConsecutiveWindows || 1))), recoveryTarget = Math.max(1, Math.min(20, Number(policy.RecoveryWindows || 1)));
var triggerCount = rawTriggered ? Number(policy.ConsecutiveTriggerCount || 0) + 1 : 0, recoveryCount = rawTriggered ? 0 : Number(policy.ConsecutiveRecoveryCount || 0) + 1;
var shouldTrigger = rawTriggered && triggerCount >= triggerTarget, activeAlertId = text(policy.ActiveEventId), alertId = activeAlertId, recovered = false, created = false, reopened = false, suppressed = false;
var dedupKey = text(query.DedupKey) || ('policy:' + text(policy.PolicyKey || policy.Id));
if (shouldTrigger) {
  var alert = null;
  if (activeAlertId) { var activeResult = V8.FormEngine.GetFormData('mci_alert_event', { Id: activeAlertId }, V8.DbTrans); alert = activeResult && activeResult.Code === 1 ? activeResult.Data : null; }
  if (!alert) {
    var suppressSeconds = Math.max(0, Math.min(86400, Number(policy.SuppressSeconds || 0)));
    if (suppressSeconds > 0) {
      var recentResult = V8.FormEngine.GetTableData('mci_alert_event', { _Where: [['DedupKey', '=', dedupKey]], _OrderBy: 'LastSeenTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 1 }, V8.DbTrans);
      var recent = recentResult && recentResult.Code === 1 && recentResult.Data && recentResult.Data.length ? recentResult.Data[0] : null;
      if (recent && text(recent.LastSeenTime) >= System.DateTime.Now.AddSeconds(-suppressSeconds).ToString('yyyy-MM-dd HH:mm:ss')) {
        var recentStatus = text(recent.Status);
        if (recentStatus === 'Resolved' || recentStatus === 'Closed') {
          suppressed = true;
          alertId = text(recent.Id);
          var suppressUpdate = V8.FormEngine.UptFormData('mci_alert_event', { Id: alertId, ObservedValue: actual, Threshold: policy.Threshold, LastSeenTime: now, TriggerCount: Number(recent.TriggerCount || 0) + 1 }, V8.DbTrans);
          if (!suppressUpdate || suppressUpdate.Code !== 1) return suppressUpdate || fail('记录告警抑制窗口失败。');
        } else alert = recent;
      }
    }
  }
  var contextJson = JSON.stringify({ WindowKey: windowKey, SignalType: signal.SignalType, Metrics: signal.Metrics || {}, Source: text(query.Source || 'Supplied') });
  if (suppressed) {
    activeAlertId = '';
  } else if (alert) {
    alertId = text(alert.Id); reopened = alert.Status === 'Resolved' || alert.Status === 'Closed';
    var updateAlert = V8.FormEngine.UptFormData('mci_alert_event', { Id: alertId, Status: reopened ? 'New' : alert.Status, ObservedValue: actual, Threshold: policy.Threshold, ContextJson: contextJson, LastSeenTime: now, TriggerCount: Number(alert.TriggerCount || 0) + 1, RecoveryTime: reopened ? '' : alert.RecoveryTime, Resolution: reopened ? '信号再次触发，自动重新打开。' : alert.Resolution }, V8.DbTrans);
    if (!updateAlert || updateAlert.Code !== 1) return updateAlert || fail('聚合活动告警失败。');
  } else {
    alertId = V8.Method.NewUlid();
    var stableEventId = eventIdInput || ('alert-' + text(V8.EncryptHelper.Sha256Hex(dedupKey + ':' + windowKey)).toLowerCase().slice(0, 64));
    var addAlert = V8.FormEngine.AddFormData('mci_alert_event', { Id: alertId, EventId: stableEventId, PolicyId: policy.Id, ServiceId: text(V8.Param && V8.Param.ServiceId) || text(policy.ServiceId), Title: text(V8.Param && V8.Param.Title) || (text(policy.Name) + '触发告警'), Severity: policy.Severity || 'Warning', Status: 'New', ObservedValue: actual, Threshold: policy.Threshold, ContextJson: contextJson, FirstSeenTime: now, LastSeenTime: now, DedupKey: dedupKey, TriggerCount: 1, RecoveryTime: '' }, V8.DbTrans);
    if (!addAlert || addAlert.Code !== 1) {
      var concurrentAlert = V8.FormEngine.GetFormData('mci_alert_event', { _Where: [['EventId', '=', stableEventId]] }, V8.DbTrans);
      if (!concurrentAlert || concurrentAlert.Code !== 1 || !concurrentAlert.Data) return addAlert || fail('保存告警事件失败。');
      alertId = text(concurrentAlert.Data.Id);
    } else created = true;
  }
  if (created || reopened) {
    var notify = V8.ApiEngine.Run('mci-alert-dispatch', { JobName: text(V8.Param && V8.Param.JobName), AlertId: alertId, EscalationLevel: 0, EventKind: reopened ? 'Reopen' : 'Trigger' }, V8.DbTrans);
    if (!notify || notify.Code !== 1) return notify || fail('告警通知派发失败。');
  }
} else if (!rawTriggered && activeAlertId && recoveryCount >= recoveryTarget) {
  var activeAlertResult = V8.FormEngine.GetFormData('mci_alert_event', { Id: activeAlertId }, V8.DbTrans);
  if (activeAlertResult && activeAlertResult.Code === 1 && activeAlertResult.Data) {
    var currentStatus = text(activeAlertResult.Data.Status), recover = V8.FormEngine.UptFormDataByWhere('mci_alert_event', { _Where: [['Id', '=', activeAlertId], ['AND', 'Status', 'In', ['New', 'Acknowledged']]], Status: 'Resolved', ObservedValue: actual, LastSeenTime: now, RecoveryTime: now, Resolution: '连续' + recoveryTarget + '个窗口恢复，系统自动解决。' }, V8.DbTrans);
    if ((currentStatus === 'New' || currentStatus === 'Acknowledged') && (!recover || recover.Code !== 1)) return recover || fail('告警自动恢复发生并发冲突。');
    alertId = activeAlertId; recovered = true; activeAlertId = '';
    var recoveryNotify = V8.ApiEngine.Run('mci-alert-dispatch', { JobName: text(V8.Param && V8.Param.JobName), AlertId: alertId, EscalationLevel: 0, EventKind: 'Recovery' }, V8.DbTrans);
    if (!recoveryNotify || recoveryNotify.Code !== 1) return recoveryNotify || fail('告警恢复通知派发失败。');
  } else activeAlertId = '';
}
if (shouldTrigger && alertId && !suppressed) activeAlertId = alertId;
var rawRowVersion = policy.RowVersion, rowVersion = Number(rawRowVersion || 0), expectedRowVersion = (rawRowVersion === null || rawRowVersion === undefined || rawRowVersion === '') ? null : rowVersion;
var updatePolicy = V8.FormEngine.UptFormDataByWhere('mci_observability_policy', { _Where: [['Id', '=', policyId], ['AND', 'RowVersion', '=', expectedRowVersion]], LastWindowKey: windowKey, LastObservedValue: actual, ConsecutiveTriggerCount: triggerCount, ConsecutiveRecoveryCount: recoveryCount, ActiveEventId: activeAlertId, LastEvaluationTime: now, RowVersion: rowVersion + 1 }, V8.DbTrans);
var verifyPolicy = V8.FormEngine.GetFormData('mci_observability_policy', { Id: policyId }, V8.DbTrans);
if (!updatePolicy || updatePolicy.Code !== 1 || !verifyPolicy || verifyPolicy.Code !== 1 || Number(verifyPolicy.Data.RowVersion || 0) !== rowVersion + 1 || text(verifyPolicy.Data.LastWindowKey) !== windowKey) return fail('策略状态发生并发修改，当前窗口事务已回滚。', { Conflict: true });
var resultData = { EvaluationId: evaluationId, EvaluationKey: evaluationKey, WindowKey: windowKey, RawTriggered: rawTriggered, Triggered: shouldTrigger && !suppressed, Suppressed: suppressed, Recovered: recovered, AlertId: alertId, Created: created, Reopened: reopened, ObservedValue: actual, Threshold: Number(policy.Threshold || 0), TriggerCount: triggerCount, RecoveryCount: recoveryCount, SignalType: signal.SignalType, Metrics: signal.Metrics || {} };
var finishEvaluation = V8.FormEngine.UptFormData('mci_observability_evaluation', { Id: evaluationId, Status: 'Completed', AlertId: alertId, Triggered: shouldTrigger ? 1 : 0, MetricsJson: JSON.stringify(resultData), EvaluatedTime: now }, V8.DbTrans);
if (!finishEvaluation || finishEvaluation.Code !== 1) return finishEvaluation || fail('完成策略窗口评估台账失败。');
return { Code: 1, Data: resultData, Msg: recovered ? '告警信号已连续恢复。' : (suppressed ? '告警信号处于抑制窗口，已记录但未重新打开。' : (shouldTrigger ? '告警信号已触发或聚合。' : (rawTriggered ? '信号已越阈值，尚未达到连续窗口数。' : '信号未触发告警。'))) };
