/*
 * 可恢复导入后台 Worker：按持久检查点分片提交；每行通过稳定Id和状态保持幂等。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
function parse(value) { try { return JSON.parse(String(value || '{}')); } catch (error) { return null; } }
function count(jobId, status) {
  var r = V8.FormEngine.GetTableDataCount('mci_import_row', { _Where: [['JobId', '=', jobId], ['AND', 'Status', '=', status]] });
  return r && r.Code === 1 ? Number(r.Data || 0) : 0;
}
if (!admin()) return fail('权限不足：只有超级管理员才能执行导入批次。');
var taskId = String((V8.Param && V8.Param._BackgroundTaskId) || '');
var task = (V8.Param && V8.Param._BackgroundTask) || {};
var fence = parseInt((V8.Param && V8.Param._BackgroundTaskFencingToken) || 0, 10) || 0;
if (!taskId || !fence || String(task.Id || '') !== taskId) return fail('可恢复导入必须通过平台持久化后台任务入口执行。');
var jobId = String((V8.Param && V8.Param.ImportJobId) || '');
if (!jobId) return fail('ImportJobId不能为空。');
var jobResult = V8.FormEngine.GetFormData('mci_import_job', { Id: jobId });
if (!jobResult || jobResult.Code !== 1 || !jobResult.Data) return fail('导入批次不存在。');
var job = jobResult.Data, status = String(job.Status || '');
if (status === 'Paused' || status === 'Cancelled') return { Code: 1, Data: { JobId: jobId, Status: status }, Msg: status === 'Paused' ? '导入已在安全分片边界暂停。' : '导入已取消。' };
if (status === 'Completed' || status === 'CompletedWithErrors') return { Code: 1, Data: job, Msg: '导入批次已结束，已幂等返回。' };
if (status === 'RollingBack' || status === 'RolledBack') return fail('导入批次正在回滚或已回滚，不能继续执行。');
var previousFence = Number(job.BackgroundTaskFencingToken || 0);
if (previousFence > fence) return fail('后台任务租约已经转移，旧执行者不能继续写入。');
var claim = V8.FormEngine.UptFormDataByWhere('mci_import_job', {
  _Where: [
    ['Id', '=', jobId],
    ['AND', '(', 'BackgroundTaskFencingToken', '=', null],
    ['OR', 'BackgroundTaskFencingToken', '<=', fence, ')']
  ],
  Status: 'Running', BackgroundTaskId: taskId, BackgroundTaskFencingToken: fence,
  StartedTime: job.StartedTime || DateNow('yyyy-MM-dd HH:mm:ss'), LastError: ''
});
if (!claim || claim.Code !== 1) return claim || fail('导入批次抢占失败。');
var checkpoint = (V8.Param && V8.Param._BackgroundTaskCheckpoint) || {};
var lastRowNo = parseInt(checkpoint.LastRowNo || 0, 10) || 0;
var chunkSize = Math.max(1, Math.min(200, parseInt(job.ChunkSize || 50, 10) || 50));
var page = V8.FormEngine.GetTableData('mci_import_row', {
  _Where: [['JobId', '=', jobId], ['AND', 'Status', '=', 'Pending'], ['AND', 'RowNo', '>', lastRowNo]],
  _OrderBy: 'RowNo', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: chunkSize
});
if (!page || page.Code !== 1) return page || fail('读取待导入行失败。');
var rows = page.Data || [], targetTable = String(job.TargetTable || '');
for (var i = 0; i < rows.length; i++) {
  var row = rows[i], data = parse(row.NormalizedJson), action = String(row.Action || '');
  lastRowNo = Math.max(lastRowNo, Number(row.RowNo || 0));
  if (!data || typeof data !== 'object') {
    V8.FormEngine.UptFormData('mci_import_row', { Id: row.Id, Status: 'Failed', ErrorCode: 'InvalidNormalizedJson', ErrorMessage: '规范化数据不是有效JSON。', FencingToken: fence, AppliedTime: DateNow('yyyy-MM-dd HH:mm:ss') }, V8.DbTrans);
    continue;
  }
  if (action === 'Skip') {
    V8.FormEngine.UptFormData('mci_import_row', { Id: row.Id, Status: 'Skipped', ErrorCode: 'SkippedByOperator', ErrorMessage: '操作员将该行标记为跳过。', FencingToken: fence, AppliedTime: DateNow('yyyy-MM-dd HH:mm:ss') }, V8.DbTrans);
    continue;
  }
  var before = {}, targetId = String(data.Id || row.TargetId || '');
  try {
    if (action === 'Update') {
      if (!targetId) throw new Error('更新动作缺少Id。');
      var currentResult = V8.FormEngine.GetFormData(targetTable, { Id: targetId }, V8.DbTrans);
      if (!currentResult || currentResult.Code !== 1 || !currentResult.Data) throw new Error('目标数据不存在或无权读取。');
      var changedKeys = Object.keys(data);
      before.Id = targetId;
      for (var b = 0; b < changedKeys.length; b++) if (changedKeys[b] !== 'Id') before[changedKeys[b]] = currentResult.Data[changedKeys[b]];
      data._InvokeType = 'Client';
      var updateResult = V8.FormEngine.UptFormData(targetTable, data, V8.DbTrans);
      delete data._InvokeType;
      if (!updateResult || updateResult.Code !== 1) throw new Error(updateResult && updateResult.Msg ? updateResult.Msg : '更新失败。');
    } else {
      targetId = targetId || (V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());
      data.Id = targetId; data._InvokeType = 'Client';
      var addResult = V8.FormEngine.AddFormData(targetTable, data, V8.DbTrans);
      delete data._InvokeType;
      if (!addResult || addResult.Code !== 1) throw new Error(addResult && addResult.Msg ? addResult.Msg : '新增失败。');
    }
    var afterResult = V8.FormEngine.GetFormData(targetTable, { Id: targetId }, V8.DbTrans);
    if (!afterResult || afterResult.Code !== 1 || !afterResult.Data) throw new Error('写入后回读失败。');
    var after = { Id: targetId }, keys = Object.keys(data);
    for (var a = 0; a < keys.length; a++) if (keys[a] !== 'Id' && keys[a].charAt(0) !== '_') after[keys[a]] = afterResult.Data[keys[a]];
    V8.FormEngine.UptFormData('mci_import_row', {
      Id: row.Id, Status: 'Succeeded', TargetId: targetId, BeforeJson: JSON.stringify(before), AfterJson: JSON.stringify(after),
      ErrorCode: '', ErrorMessage: '', FencingToken: fence, AppliedTime: DateNow('yyyy-MM-dd HH:mm:ss')
    }, V8.DbTrans);
  } catch (error) {
    V8.FormEngine.UptFormData('mci_import_row', {
      Id: row.Id, Status: 'Failed', TargetId: targetId, BeforeJson: JSON.stringify(before),
      ErrorCode: 'WriteFailed', ErrorMessage: String(error && error.message ? error.message : error).slice(0, 1900),
      FencingToken: fence, AppliedTime: DateNow('yyyy-MM-dd HH:mm:ss')
    }, V8.DbTrans);
  }
}
var latest = V8.FormEngine.GetFormData('mci_import_job', { Id: jobId });
if (latest && latest.Code === 1 && latest.Data && (latest.Data.Status === 'Paused' || latest.Data.Status === 'Cancelled')) {
  return { Code: 1, Data: { JobId: jobId, Status: latest.Data.Status }, Msg: latest.Data.Status === 'Paused' ? '导入已在安全分片边界暂停。' : '导入已取消。' };
}
var success = count(jobId, 'Succeeded'), failed = count(jobId, 'Failed'), skipped = count(jobId, 'Skipped'), pending = count(jobId, 'Pending');
var current = success + failed + skipped, total = Number(job.TotalCount || current), progress = total > 0 ? Math.floor(current * 100 / total) : 0;
var updateJob = V8.FormEngine.UptFormDataByWhere('mci_import_job', {
  _Where: [['Id', '=', jobId], ['AND', 'BackgroundTaskFencingToken', '=', fence]],
  SuccessCount: success, FailedCount: failed, Progress: progress,
  Status: pending > 0 ? 'Running' : (failed > 0 || skipped > 0 ? 'CompletedWithErrors' : 'Completed'),
  FinishedTime: pending > 0 ? null : DateNow('yyyy-MM-dd HH:mm:ss'),
  ResultJson: JSON.stringify({ Success: success, Failed: failed, Skipped: skipped, Pending: pending, LastRowNo: lastRowNo })
});
if (!updateJob || updateJob.Code !== 1) return updateJob || fail('导入进度回写失败。');
if (pending > 0) return { Code: 1, Data: { BackgroundTask: { HasMore: true, Checkpoint: { LastRowNo: lastRowNo }, Current: current, Total: total, NextDelaySeconds: 0, Msg: '已提交第' + current + '行，继续下一分片' } } };
return { Code: 1, Data: { JobId: jobId, Success: success, Failed: failed, Skipped: skipped, Total: total }, Msg: failed > 0 || skipped > 0 ? '导入完成，部分行需要修正或已跳过。' : '导入完成。' };
