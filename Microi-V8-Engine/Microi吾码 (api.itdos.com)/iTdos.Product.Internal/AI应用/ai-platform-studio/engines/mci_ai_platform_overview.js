/*
 * Microi吾码 AI 平台治理总览。
 * 只读取共享数据库事实，不依赖进程内状态。
 */
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return { Code: 0, Msg: '权限不足：只有超级管理员才能查看平台治理总览。' };
function count(tableName, where) {
  var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: where || [] });
  if (!result || result.Code !== 1) return 0;
  if (typeof result.Data === 'number') return result.Data;
  if (result.Data && result.Data.Count !== undefined) return Number(result.Data.Count || 0);
  return Number(result.DataCount || 0);
}
function list(tableName, where, fields, orderBy, size) {
  var result = V8.FormEngine.GetTableData(tableName, {
    _Where: where || [],
    _SelectFields: fields || ['Id'],
    _OrderBy: orderBy || 'CreateTime',
    _OrderByType: 'DESC',
    _PageIndex: 1,
    _PageSize: size || 8
  });
  return result && result.Code === 1 ? (result.Data || []) : [];
}

var activeAlerts = count('mci_alert_event', [['Status', 'In', ['New', 'Acknowledged']]]);
var criticalAlerts = count('mci_alert_event', [
  ['Status', 'In', ['New', 'Acknowledged']],
  ['AND', 'Severity', 'In', ['Critical', 'High']]
]);
var syncConflicts = count('mci_identity_sync_conflict', [['Status', '=', 'Open']]);
var releasePending = count('mci_release_plan', [['Status', 'In', ['Draft', 'Checking', 'Blocked']]]);
var unhealthyServices = count('mci_service_registry', [['HealthState', 'In', ['Degraded', 'Down', 'Unknown']]]);
var importIssues = count('mci_import_job', [['Status', 'In', ['Failed', 'CompletedWithErrors', 'Paused']]]);

return {
  Code: 1,
  Data: {
    Metrics: {
      PortalProjects: count('mci_portal_project', [['Status', '<>', 'Archived']]),
      EnabledFlags: count('mci_feature_flag', [['Enabled', '=', 1]]),
      RegisteredServices: count('mci_service_registry', [['Enabled', '=', 1]]),
      ActiveAlerts: activeAlerts
    },
    Attention: {
      CriticalAlerts: criticalAlerts,
      IdentityConflicts: syncConflicts,
      PendingReleases: releasePending,
      UnhealthyServices: unhealthyServices,
      ImportIssues: importIssues
    },
    RecentAlerts: list('mci_alert_event', [], ['Id', 'Title', 'Severity', 'Status', 'CreateTime'], 'CreateTime', 6),
    RecentReleases: list('mci_release_plan', [], ['Id', 'Name', 'VersionNo', 'Environment', 'Status', 'LastCheckTime'], 'UpdateTime', 6),
    GeneratedAt: DateNow('yyyy-MM-dd HH:mm:ss')
  }
};
