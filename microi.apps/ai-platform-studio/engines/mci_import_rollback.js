/*
 * 可恢复导入后台回滚：只在目标仍与导入后快照一致时执行反向操作，避免覆盖后续业务修改。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
function parse(value) { try { return JSON.parse(String(value || '{}')); } catch (error) { return null; } }
function sameSubset(current, expected) {
  if (!current || !expected) return false;
  var keys = Object.keys(expected);
  for (var i = 0; i < keys.length; i++) if (JSON.stringify(current[keys[i]]) !== JSON.stringify(expected[keys[i]])) return false;
  return true;
}
function count(jobId, status) {
  var r = V8.FormEngine.GetTableDataCount('mci_import_row', { _Where: [['JobId', '=', jobId], ['AND', 'Status', '=', status]] });
  return r && r.Code === 1 ? Number(r.Data || 0) : 0;
}
if (!admin()) return fail('权限不足：只有超级管理员才能回滚导入批次。');
var taskId = String((V8.Param && V8.Param._BackgroundTaskId) || ''), task = (V8.Param && V8.Param._BackgroundTask) || {};
var fence = parseInt((V8.Param && V8.Param._BackgroundTaskFencingToken) || 0, 10) || 0;
if (!taskId || !fence || String(task.Id || '') !== taskId) return fail('导入回滚必须通过平台持久化后台任务入口执行。');
var jobId = String((V8.Param && V8.Param.ImportJobId) || '');
var jobResult = V8.FormEngine.GetFormData('mci_import_job', { Id: jobId });
if (!jobResult || jobResult.Code !== 1 || !jobResult.Data) return fail('导入批次不存在。');
var job = jobResult.Data, status = String(job.Status || '');
if (status === 'RolledBack') return { Code: 1, Data: job, Msg: '导入批次已回滚，已幂等返回。' };
if (status === 'Running' || status === 'Staged' || status === 'Paused') return fail('导入尚未完成，不能回滚；请先取消并确认后台任务停止。');
if (Number(job.BackgroundTaskFencingToken || 0) > fence) return fail('后台任务租约已经转移，旧回滚执行者不能继续写入。');
var claim = V8.FormEngine.UptFormDataByWhere('mci_import_job', {
  _Where: [
    ['Id', '=', jobId],
    ['AND', '(', 'BackgroundTaskFencingToken', '=', null],
    ['OR', 'BackgroundTaskFencingToken', '<=', fence, ')']
  ],
  Status: 'RollingBack', BackgroundTaskId: taskId, BackgroundTaskFencingToken: fence, LastError: ''
});
if (!claim || claim.Code !== 1) return claim || fail('导入回滚抢占失败。');
var checkpoint = (V8.Param && V8.Param._BackgroundTaskCheckpoint) || {}, beforeRowNo = parseInt(checkpoint.BeforeRowNo || 2147483647, 10) || 2147483647;
var chunkSize = Math.max(1, Math.min(200, parseInt(job.ChunkSize || 50, 10) || 50));
var page = V8.FormEngine.GetTableData('mci_import_row', {
  _Where: [['JobId', '=', jobId], ['AND', 'Status', '=', 'Succeeded'], ['AND', 'RowNo', '<', beforeRowNo]],
  _OrderBy: 'RowNo', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: chunkSize
});
if (!page || page.Code !== 1) return page || fail('读取可回滚行失败。');
var rows = page.Data || [], targetTable = String(job.TargetTable || ''), conflicts = 0;
for (var i = 0; i < rows.length; i++) {
  var row = rows[i], after = parse(row.AfterJson), before = parse(row.BeforeJson), targetId = String(row.TargetId || '');
  beforeRowNo = Math.min(beforeRowNo, Number(row.RowNo || beforeRowNo));
  try {
    var currentResult = V8.FormEngine.GetFormData(targetTable, { Id: targetId }, V8.DbTrans);
    var current = currentResult && currentResult.Code === 1 ? currentResult.Data : null;
    if (String(row.Action) === 'Add') {
      if (current && !sameSubset(current, after)) throw new Error('目标数据已被后续业务修改，拒绝删除。');
      if (current) {
        var del = V8.FormEngine.DelFormData(targetTable, { Id: targetId, _InvokeType: 'Client' }, V8.DbTrans);
        if (!del || del.Code !== 1) throw new Error(del && del.Msg ? del.Msg : '删除回滚失败。');
      }
    } else {
      if (!current) throw new Error('目标数据已不存在。');
      if (!sameSubset(current, after)) throw new Error('目标数据已被后续业务修改，拒绝覆盖。');
      before.Id = targetId; before._InvokeType = 'Client';
      var update = V8.FormEngine.UptFormData(targetTable, before, V8.DbTrans);
      if (!update || update.Code !== 1) throw new Error(update && update.Msg ? update.Msg : '更新回滚失败。');
    }
    V8.FormEngine.UptFormData('mci_import_row', { Id: row.Id, Status: 'RolledBack', RolledBackTime: DateNow('yyyy-MM-dd HH:mm:ss'), ErrorCode: '', ErrorMessage: '', FencingToken: fence }, V8.DbTrans);
  } catch (error) {
    conflicts++;
    V8.FormEngine.UptFormData('mci_import_row', { Id: row.Id, Status: 'Skipped', ErrorCode: 'RollbackConflict', ErrorMessage: String(error && error.message ? error.message : error).slice(0, 1900), FencingToken: fence }, V8.DbTrans);
  }
}
var succeeded = count(jobId, 'Succeeded'), rolledBack = count(jobId, 'RolledBack'), skipped = count(jobId, 'Skipped');
var total = Number(job.SuccessCount || rolledBack + succeeded + skipped), current = rolledBack + skipped;
if (succeeded > 0) return { Code: 1, Data: { BackgroundTask: { HasMore: true, Checkpoint: { BeforeRowNo: beforeRowNo }, Current: current, Total: total, NextDelaySeconds: 0, Msg: '已回滚' + current + '行，继续下一分片' } } };
var finalStatus = skipped > 0 ? 'CompletedWithErrors' : 'RolledBack';
var finish = V8.FormEngine.UptFormDataByWhere('mci_import_job', {
  _Where: [['Id', '=', jobId], ['AND', 'BackgroundTaskFencingToken', '=', fence]],
  Status: finalStatus, RolledBackCount: rolledBack, Progress: 100, FinishedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  LastError: skipped > 0 ? '部分行因后续业务数据已变化而跳过回滚。' : '',
  ResultJson: JSON.stringify({ RolledBack: rolledBack, Conflicts: skipped })
});
if (!finish || finish.Code !== 1) return finish || fail('回滚结果回写失败。');
return { Code: 1, Data: { JobId: jobId, RolledBack: rolledBack, Conflicts: skipped }, Msg: skipped > 0 ? '回滚完成，部分行存在冲突。' : '导入批次已完整回滚。' };
