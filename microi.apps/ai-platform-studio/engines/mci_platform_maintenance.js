/*
 * 平台维护任务：精确校验JobName；租约、标签、临时授权和告警升级均以共享数据条件更新保证幂等。
 * 兼容旧平台的 Quartz 已保存、任务元数据未落库状态；自愈动作仅超级管理员可调用，且不覆盖已有配置。
 */
var action = String((V8.Param && V8.Param.Action) || '');
if (action === 'RepairScheduleMetadataAfterQuartzSave') {
  var currentUser = V8.CurrentUser || {};
  if (!currentUser.Id || Number(currentUser.Level || 0) < 9999) return { Code: 0, Msg: '只有超级管理员可以修复平台任务元数据。' };
  var expectedJobName = String((V8.Param && V8.Param.ExpectedJobName) || '');
  var expectedJobId = String((V8.Param && V8.Param.ExpectedJobId) || '');
  if (expectedJobName !== 'MciAiPlatformMinuteSweep' || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(expectedJobId) || V8.Param.QuartzSaveConfirmed !== true) {
    return { Code: 0, Msg: '必须提供已成功保存的固定 Quartz 任务证明。' };
  }
  var existingJob = V8.FormEngine.GetFormData('diy_schedule_job', { _Where: [['JobName', '=', expectedJobName]] });
  if (existingJob && existingJob.Code === 1 && existingJob.Data) {
    return { Code: 1, Data: { Job: existingJob.Data, Repaired: false }, Msg: '任务元数据已存在，未覆盖现有配置。' };
  }
  var jobRow = {
    Id: expectedJobId,
    _InvokeType: 'Server',
    JobName: expectedJobName,
    JobDesc: 'AI平台服务租约、协作租约、临时授权、标签有效期、告警评估、升级与可靠送达维护',
    Description: 'AI平台服务租约、协作租约、临时授权、标签有效期、告警评估、升级与可靠送达维护',
    CronDesc: '每分钟执行一次',
    CronExpression: '0 0/1 * * * ?',
    JobType: '1',
    ApiEngineKey: 'mci-platform-maintenance',
    JobParam: JSON.stringify({ Scope: 'LeasesAccessTagsAlertEvaluationAndDelivery' }),
    DllName: '',
    JobPath: '',
    TimeZoneId: '',
    Status: '正常'
  };
  var addJobMetadata = V8.FormEngine.AddFormData('diy_schedule_job', jobRow);
  if (!addJobMetadata || addJobMetadata.Code !== 1) return addJobMetadata || { Code: 0, Msg: '修复平台任务元数据失败。' };
  var repairedJob = V8.FormEngine.GetFormData('diy_schedule_job', { _Where: [['JobName', '=', expectedJobName]] });
  if (!repairedJob || repairedJob.Code !== 1 || !repairedJob.Data || String(repairedJob.Data.ApiEngineKey || '') !== 'mci-platform-maintenance') {
    return { Code: 0, Msg: '平台任务元数据写后回读不一致。' };
  }
  return { Code: 1, Data: { Job: repairedJob.Data, Repaired: true }, Msg: '平台任务元数据已自愈并完成回读。' };
}
var jobName = String((V8.Param && V8.Param.JobName) || '');
if (jobName !== 'MciAiPlatformMinuteSweep') return { Code: 0, Msg: '拒绝非预期平台维护任务调用。' };
var now = System.DateTime.UtcNow, nowText = now.ToString('yyyy-MM-dd HH:mm:ss');
var expiredResult = V8.FormEngine.GetTableData('mci_service_instance', { _Where: [['State', 'In', ['Starting', 'Ready']], ['AND', 'LeaseExpiresAt', '<=', nowText]], _PageIndex: 1, _PageSize: 500 });
if (!expiredResult || expiredResult.Code !== 1) return expiredResult || { Code: 0, Msg: '扫描过期实例失败。' };
var expired = expiredResult.Data || [], expiredCount = 0;
for (var i = 0; i < expired.length; i++) {
  var row = expired[i] || {}, update = V8.FormEngine.UptFormDataByWhere('mci_service_instance', { _Where: [['Id', '=', row.Id], ['AND', 'RowVersion', '=', Number(row.RowVersion || 0)], ['AND', 'LeaseExpiresAt', '<=', nowText]], State: 'Expired', Weight: 0, RowVersion: Number(row.RowVersion || 0) + 1, FencingToken: Number(row.FencingToken || 0) + 1 });
  if (update && update.Code === 1) expiredCount++;
}
var sessionsResult = V8.FormEngine.GetTableData('mci_collaboration_session', { _Where: [['State', '=', 'Active'], ['AND', 'LeaseExpiresAt', '<=', nowText]], _PageIndex: 1, _PageSize: 500 });
var sessions = sessionsResult && sessionsResult.Code === 1 ? (sessionsResult.Data || []) : [], sessionCount = 0;
for (var s = 0; s < sessions.length; s++) {
  var session = sessions[s] || {}, expiredSession = V8.FormEngine.UptFormDataByWhere('mci_collaboration_session', { _Where: [['Id', '=', session.Id], ['AND', 'FencingToken', '=', Number(session.FencingToken || 0)], ['AND', 'LeaseExpiresAt', '<=', nowText]], State: 'Expired' });
  if (expiredSession && expiredSession.Code === 1) sessionCount++;
}
var tagResult = V8.FormEngine.GetTableData('mci_identity_tag_assignment', { _Where: [['Status', '=', 'Active'], ['AND', 'ExpiresAt', '<=', nowText]], _SelectFields: ['Id', 'EvidenceHash'], _PageIndex: 1, _PageSize: 500 });
var tags = tagResult && tagResult.Code === 1 ? (tagResult.Data || []) : [], expiredTags = 0;
for (var t = 0; t < tags.length; t++) {
  var tag = tags[t] || {}, expireTag = V8.FormEngine.UptFormDataByWhere('mci_identity_tag_assignment', { _Where: [['Id', '=', tag.Id], ['AND', 'EvidenceHash', '=', tag.EvidenceHash || ''], ['AND', 'Status', '=', 'Active'], ['AND', 'ExpiresAt', '<=', nowText]], Status: 'Expired', RevokedTime: nowText, EvidenceHash: String(V8.EncryptHelper.Sha256Hex(String(tag.Id) + ':Expired:' + nowText + ':' + String(tag.EvidenceHash || ''))).toLowerCase() });
  if (expireTag && expireTag.Code === 1) expiredTags++;
}
var entitlementResult = V8.ApiEngine.Run('mci-access-entitlement-expire', { JobName: jobName, Force: false });
if (!entitlementResult || entitlementResult.Code !== 1) return entitlementResult || { Code: 0, Msg: '临时授权到期回收失败。' };
var alertScanResult = V8.ApiEngine.Run('mci-alert-scan', { JobName: jobName });
if (!alertScanResult || alertScanResult.Code !== 1) return alertScanResult || { Code: 0, Msg: '定时告警策略评估失败。' };
var alertsResult = V8.FormEngine.GetTableData('mci_alert_event', { _Where: [['Status', 'In', ['New', 'Acknowledged']]], _OrderBy: 'FirstSeenTime', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 500 });
var alerts = alertsResult && alertsResult.Code === 1 ? (alertsResult.Data || []) : [], escalated = 0;
for (var a = 0; a < alerts.length; a++) {
  var alert = alerts[a] || {}, first;
  try { first = System.DateTime.Parse(String(alert.FirstSeenTime || alert.CreateTime)); } catch (error) { continue; }
  var ageMinutes = now.Subtract(first).TotalMinutes;
  if (ageMinutes < 15) continue;
  var level = Math.min(3, Math.max(1, Math.floor(ageMinutes / 30) + 1));
  var dispatch = V8.ApiEngine.Run('mci-alert-dispatch', { JobName: jobName, AlertId: alert.Id, EscalationLevel: level, EventKind: 'Escalation' });
  if (dispatch && dispatch.Code === 1) escalated++;
}
var deliveryResult = V8.ApiEngine.Run('mci-alert-delivery-send', { JobName: jobName });
if (!deliveryResult || deliveryResult.Code !== 1) return deliveryResult || { Code: 0, Msg: '告警可靠送达扫描失败。' };
return { Code: 1, Data: { WindowKey: now.ToString('yyyyMMddHHmm'), ExpiredInstances: expiredCount, ExpiredCollaborationLeases: sessionCount, ExpiredTags: expiredTags, ReclaimedEntitlements: Number(entitlementResult.Data && entitlementResult.Data.Reclaimed || 0), EntitlementConflicts: Number(entitlementResult.Data && entitlementResult.Data.Conflicts || 0), AlertEvaluation: alertScanResult.Data || {}, EscalatedAlerts: escalated, AlertDelivery: deliveryResult.Data || {} }, Msg: '平台维护扫描完成。' };
