/*
 * 可恢复导入暂存：重算预检哈希，按幂等键创建批次与不可变来源行。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能暂存导入批次。');
var expectedHash = String((V8.Param && V8.Param.ExpectedPlanHash) || '').toLowerCase();
var idempotencyKey = String((V8.Param && V8.Param.IdempotencyKey) || '').replace(/^\s+|\s+$/g, '');
if (!expectedHash || !idempotencyKey) return fail('ExpectedPlanHash和IdempotencyKey不能为空。');
if (idempotencyKey.length > 200) return fail('IdempotencyKey不能超过200字符。');
var existing = V8.FormEngine.GetFormData('mci_import_job', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '已返回相同幂等键的导入批次。' };
var plan = V8.ApiEngine.Run('mci-import-plan', {
  TargetTable: V8.Param.TargetTable,
  Records: V8.Param.Records || [],
  FileByteBase64: V8.Param.FileByteBase64 || '',
  FileName: V8.Param.FileName || '',
  SheetIndex: V8.Param.SheetIndex || 0,
  Mapping: V8.Param.Mapping || {}
});
if (!plan || plan.Code !== 1 || !plan.Data) return plan || fail('导入预检失败。');
if (String(plan.Data.PlanHash).toLowerCase() !== expectedHash) return fail('导入内容或字段映射已变化，请重新预检。', { ActualPlanHash: plan.Data.PlanHash });
if (!plan.Data.CanStage) return fail('预检没有可执行行，请先修正数据或字段映射。');
var jobId = V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
var importKey = String((V8.Param && V8.Param.ImportKey) || ('import-' + jobId));
var chunkSize = Math.max(1, Math.min(200, parseInt((V8.Param && V8.Param.ChunkSize) || 50, 10) || 50));
var addJob = V8.FormEngine.AddFormData('mci_import_job', {
  Id: jobId,
  ImportKey: importKey,
  IdempotencyKey: idempotencyKey,
  TargetTable: plan.Data.Target.Name,
  FileName: String((V8.Param && V8.Param.FileName) || ''),
  FileHash: plan.Data.FileHash,
  PlanHash: plan.Data.PlanHash,
  Status: 'Staged',
  TotalCount: plan.Data.Summary.Total,
  SuccessCount: 0,
  FailedCount: plan.Data.Summary.Invalid,
  RolledBackCount: 0,
  ChunkSize: chunkSize,
  MappingJson: JSON.stringify(plan.Data.Mapping || {}),
  Progress: 0,
  LastError: '',
  ResultJson: JSON.stringify({ Summary: plan.Data.Summary, StagedAt: DateNow('yyyy-MM-dd HH:mm:ss') })
});
if (!addJob || addJob.Code !== 1) {
  var raced = V8.FormEngine.GetFormData('mci_import_job', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
  return raced && raced.Code === 1 && raced.Data ? { Code: 1, Data: raced.Data, Msg: '并发提交已由相同幂等键复用。' } : (addJob || fail('创建导入批次失败。'));
}
var stagedRows = [];
for (var i = 0; i < plan.Data.Rows.length; i++) {
  var row = plan.Data.Rows[i];
  stagedRows.push({
    FormEngineKey: 'mci_import_row',
    Id: V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid(),
    JobId: jobId,
    RowNo: row.RowNo,
    RowHash: row.RowHash,
    Status: row.Errors && row.Errors.length ? 'Failed' : 'Pending',
    Action: row.Errors && row.Errors.length ? 'Skip' : row.Action,
    SourceJson: JSON.stringify(row.Source || {}),
    NormalizedJson: JSON.stringify(row.Normalized || {}),
    BeforeJson: '{}',
    AfterJson: '{}',
    ErrorCode: row.Errors && row.Errors.length ? 'Validation' : '',
    ErrorMessage: row.Errors && row.Errors.length ? row.Errors.join('；') : ''
  });
}
var addRows = V8.FormEngine.AddTableData(stagedRows);
if (!addRows || addRows.Code !== 1) return addRows || fail('暂存导入行失败。');
var readback = V8.FormEngine.GetTableDataCount('mci_import_row', { _Where: [['JobId', '=', jobId]] });
if (!readback || readback.Code !== 1 || Number(readback.Data || 0) !== Number(plan.Data.Summary.Total || 0)) return fail('导入暂存回读不一致，事务已回滚。');
return { Code: 1, Data: { JobId: jobId, ImportKey: importKey, Status: 'Staged', PlanHash: plan.Data.PlanHash, Summary: plan.Data.Summary, ChunkSize: chunkSize }, Msg: '导入批次已安全暂存。' };
