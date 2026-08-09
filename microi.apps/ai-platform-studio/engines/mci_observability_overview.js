/*
 * 服务目录与可观测策略总览。
 */
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return { Code: 0, Msg: '权限不足：只有超级管理员才能查看可观测治理总览。' };
function read(table, where, fields, orderBy, size) {
  var result = V8.FormEngine.GetTableData(table, {
    _Where: where || [], _SelectFields: fields, _OrderBy: orderBy || 'UpdateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: size || 20
  });
  return result && result.Code === 1 ? (result.Data || []) : [];
}
return {
  Code: 1,
  Data: {
    Services: read('mci_service_registry', [], ['Id', 'ServiceKey', 'Name', 'ServiceType', 'Owner', 'Environment', 'HealthState', 'LastSeenTime', 'Enabled'], 'Name', 200),
    Policies: read('mci_observability_policy', [['Enabled', '=', 1]], ['Id', 'PolicyKey', 'Name', 'ServiceId', 'MetricName', 'Operator', 'Threshold', 'Severity', 'WindowSeconds', 'EvaluationMode', 'QueryJson', 'ConsecutiveWindows', 'RecoveryWindows', 'SuppressSeconds', 'LastObservedValue', 'LastEvaluationTime', 'Enabled'], 'Name', 200),
    Alerts: read('mci_alert_event', [['Status', 'In', ['New', 'Acknowledged']]], ['Id', 'EventId', 'PolicyId', 'ServiceId', 'Title', 'Severity', 'Status', 'ObservedValue', 'Threshold', 'TriggerCount', 'FirstSeenTime', 'LastSeenTime', 'CreateTime'], 'CreateTime', 100),
    GeneratedAt: DateNow('yyyy-MM-dd HH:mm:ss')
  }
};
