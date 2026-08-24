/*
 * V8 ApiEngine
 * ApiEngineKey: compact-microi-store-packages
 * Version: v1.1.2
 * Function:
 * - 分批把 sys_microistore 与 mic_data_version 中的旧内联 AppPakcet 外置为已回读校验的 HDFS 内容包，保留全部版本元数据并释放数据库大字段空间。
 */

function text(value) { return value === null || value === undefined ? '' : String(value); }
function trim(value) { return text(value).replace(/^\s+|\s+$/g, ''); }
function flag(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  var normalized = trim(value).toLowerCase();
  return value === true || value === 1 || ['1', 'true', 'yes', 'on', 'enabled'].indexOf(normalized) >= 0;
}
function currentLevel() {
  var user = V8.CurrentUser || {};
  if (user.Level !== null && user.Level !== undefined) return parseInt(user.Level || 0, 10) || 0;
  try {
    var token = V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    return parseInt(token && token.CurrentUser && token.CurrentUser.Level || 0, 10) || 0;
  } catch (error) { return 0; }
}
function parseObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (error) { return null; }
}
function copyPointer(target, pointer) {
  target.PackageId = pointer.PackageId;
  target.PackageStorageMode = pointer.PackageStorageMode;
  target.PackageHdfsPath = pointer.PackageHdfsPath;
  target.PackageSha256 = pointer.PackageSha256;
  target.PackageSize = pointer.PackageSize;
  target.PackageContentType = pointer.PackageContentType;
  target.PackageFormatVersion = pointer.PackageFormatVersion;
  target.PackageUploadedAt = pointer.PackageUploadedAt;
  return target;
}
function storePackage(storeId, appVersion, isPublic, packageText) {
  var result = V8.ApiEngine.Run('microi-store-package-storage', {
    Action: 'Store',
    StoreId: storeId,
    AppVersion: appVersion,
    IsPublic: isPublic,
    Package: packageText,
    // 只在管理员历史容量治理中兼容早期非 SemVer 包；正常发布仍严格拒绝。
    AllowLegacyVersion: true,
    TrustContentAddressedCache: true
  });
  if (!result || result.Code !== 1 || !result.Data || !result.Data.PackageHdfsPath) {
    throw new Error('HDFS 外置失败：' + ((result && result.Msg) || '接口无返回'));
  }
  return result.Data;
}
function affectedRows(value) {
  if (typeof value === 'number') return value;
  if (value && value.Data !== undefined) return Number(value.Data || 0);
  return Number(value || 0);
}
function compactCurrentRow(row) {
  var packageText = text(row.AppPakcet);
  if (!packageText) return { Skipped: true, Bytes: 0 };
  var pointer = storePackage(row.Id, row.AppVersion, flag(row.IsPublic, true), packageText);
  var command = V8.Db.FromSql(
    'UPDATE sys_microistore SET PackageId=@p0,PackageStorageMode=@p1,PackageHdfsPath=@p2,'
      + 'PackageSha256=@p3,PackageSize=@p4,PackageContentType=@p5,PackageFormatVersion=@p6,'
      + 'PackageUploadedAt=@p7,AppPakcet=NULL WHERE Id=@p8 AND AppPakcet=@p9'
  )
    .AddInParameter('@p0', pointer.PackageId)
    .AddInParameter('@p1', pointer.PackageStorageMode)
    .AddInParameter('@p2', pointer.PackageHdfsPath)
    .AddInParameter('@p3', pointer.PackageSha256)
    .AddInParameter('@p4', pointer.PackageSize)
    .AddInParameter('@p5', pointer.PackageContentType)
    .AddInParameter('@p6', pointer.PackageFormatVersion)
    .AddInParameter('@p7', pointer.PackageUploadedAt)
    .AddInParameter('@p8', row.Id)
    .AddInParameter('@p9', packageText);
  var affected = affectedRows(command.ExecuteNonQuery());
  if (affected !== 1) throw new Error('当前商城行 CAS 更新失败：' + row.Id);
  return { Skipped: false, Bytes: Number(pointer.PackageSize || 0), StoreId: row.Id, AppVersion: row.AppVersion };
}
function compactHistoryRow(versionRow) {
  var snapshot = parseObject(versionRow.Data);
  if (!snapshot || !snapshot.Id || !snapshot.AppPakcet) return { Skipped: true, Bytes: 0 };
  var oldData = text(versionRow.Data);
  var pointer = storePackage(snapshot.Id, snapshot.AppVersion || snapshot.Version, flag(snapshot.IsPublic, true), text(snapshot.AppPakcet));
  delete snapshot.AppPakcet;
  copyPointer(snapshot, pointer);
  snapshot.PackageCompactedAt = DateNow('yyyy-MM-dd HH:mm:ss');
  var newData = JSON.stringify(snapshot);
  var affected = affectedRows(V8.Db.FromSql(
    'UPDATE mic_data_version SET Data=@p0,UpdateTime=CURRENT_TIMESTAMP WHERE Id=@p1 AND Data=@p2'
  )
    .AddInParameter('@p0', newData)
    .AddInParameter('@p1', versionRow.Id)
    .AddInParameter('@p2', oldData)
    .ExecuteNonQuery());
  if (affected !== 1) throw new Error('历史快照 CAS 更新失败：' + versionRow.Id);
  return {
    Skipped: false,
    Bytes: Math.max(0, oldData.length - newData.length),
    StoreId: snapshot.Id,
    AppVersion: snapshot.AppVersion || snapshot.Version,
    VersionId: versionRow.Id
  };
}
function databaseKind() {
  var value = trim(V8.OsClientModel && (V8.OsClientModel.DbType || V8.OsClientModel.OsClientDbType)).toLowerCase();
  if (value.indexOf('sqlserver') >= 0 || value.indexOf('mssql') >= 0) return 'sqlserver';
  if (value.indexOf('oracle') >= 0) return 'oracle';
  return 'mysql';
}
function limitedSelect(fields, fromWhere, orderBy, limit) {
  var count = Math.max(1, Math.min(100, parseInt(limit || 1, 10) || 1));
  var kind = databaseKind();
  if (kind === 'sqlserver') return 'SELECT TOP (' + count + ') ' + fields + ' ' + fromWhere + ' ' + orderBy;
  if (kind === 'oracle') return 'SELECT ' + fields + ' ' + fromWhere + ' ' + orderBy + ' FETCH FIRST ' + count + ' ROWS ONLY';
  return 'SELECT ' + fields + ' ' + fromWhere + ' ' + orderBy + ' LIMIT ' + count;
}
function scalarNumber(sql, parameterValue) {
  var command = V8.DbRead.FromSql(sql);
  if (parameterValue !== undefined) command = command.AddInParameter('@p0', parameterValue);
  return Number(command.ToScalar() || 0);
}
function readCurrentCount() {
  return scalarNumber("SELECT COUNT(*) FROM sys_microistore WHERE AppPakcet IS NOT NULL AND AppPakcet <> '' AND (IsDeleted IS NULL OR IsDeleted <> 1)");
}
function readCurrentRows(batchSize) {
  var sql = limitedSelect(
    'Id,AppKey,AppVersion,IsPublic,AppPakcet',
    "FROM sys_microistore WHERE AppPakcet IS NOT NULL AND AppPakcet <> '' AND (IsDeleted IS NULL OR IsDeleted <> 1)",
    'ORDER BY Id ASC',
    batchSize
  );
  return V8.DbRead.FromSql(sql).ToArray() || [];
}
function readHistoryCandidateCount() {
  return scalarNumber('SELECT COUNT(*) FROM mic_data_version WHERE TableName=@p0', 'sys_microistore');
}
function readHistoryRows(scanSize, afterId) {
  var sql = limitedSelect(
    'Id,TableRowId,Version,CreateTime,UpdateTime,Data',
    'FROM mic_data_version WHERE TableName=@p0 AND Id>@p1',
    'ORDER BY Id ASC',
    scanSize
  );
  return V8.DbRead.FromSql(sql)
    .AddInParameter('@p0', 'sys_microistore')
    .AddInParameter('@p1', trim(afterId))
    .ToArray() || [];
}

if (currentLevel() < 9999) return { Code: 0, Msg: '权限不足：只有超级管理员才能执行商城包容量治理。' };
var schemaResult = V8.ApiEngine.Run('microi-store-package-storage', { Action: 'EnsureSchema' });
if (!schemaResult || schemaResult.Code !== 1) {
  return { Code: 0, Msg: '应用商城包容量治理前置结构自愈失败：' + ((schemaResult && schemaResult.Msg) || '接口无返回') };
}
var taskId = trim(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId);
var checkpoint = parseObject(V8.Param._BackgroundTaskCheckpoint) || {};
if (checkpoint.TaskId && trim(checkpoint.TaskId) !== taskId) checkpoint = {};
var action = trim(V8.Param.Action || 'Plan');
var scope = trim(checkpoint.Scope || V8.Param.Scope || 'All');
if (['All', 'Current', 'History'].indexOf(scope) < 0) return { Code: 0, Msg: 'Scope 仅支持 All、Current、History。' };
var batchSize = Math.max(1, Math.min(50, parseInt(checkpoint.BatchSize || V8.Param.BatchSize || 10, 10) || 10));
// limitedSelect 为避免一次把数百个历史大 JSON 拉入 Jint，固定最多读取 100 行。
// 扫描窗口必须使用同一上限，否则 rows.length < scanSize 会把 100/500 误判为 EOF。
var scanSize = Math.max(batchSize, Math.min(100, parseInt(checkpoint.ScanSize || V8.Param.ScanSize || 50, 10) || 50));
var historyAfterId = trim(checkpoint.HistoryAfterId || V8.Param.HistoryAfterId || V8.Param.Cursor);

if (action === 'Plan') {
  var currentCount = scope === 'History' ? 0 : readCurrentCount();
  var historyCandidates = scope === 'Current' ? 0 : readHistoryCandidateCount();
  var historySample = scope === 'Current' ? [] : readHistoryRows(Math.min(scanSize, 5), historyAfterId);
  var sampleInline = 0;
  for (var sampleIndex = 0; sampleIndex < historySample.length; sampleIndex++) {
    var sampleSnapshot = parseObject(historySample[sampleIndex].Data);
    if (sampleSnapshot && sampleSnapshot.AppPakcet) sampleInline++;
  }
  return {
    Code: 1,
    Data: {
      DryRun: true,
      Scope: scope,
      BatchSize: batchSize,
      ScanSize: scanSize,
      CurrentInlineCount: currentCount,
      HistoryCandidateCount: historyCandidates,
      HistoryInlineCount: null,
      HistoryAfterId: historyAfterId,
      HistoryInlineInNextScan: sampleInline,
      NextScanHistory: historySample.length,
      Confirmation: 'COMPACT_MARKETPLACE_PACKAGES',
      Recovery: '原始 JSON 先上传并完成大小/SHA-256 回读，随后才以原值 CAS 清空数据库包体；HDFS 对象和 sys_microistore_package 元数据保留。历史扫描使用 Id 游标，不再对 5GB Data 字段执行全表 LIKE/COUNT。'
    },
    Msg: '容量治理预检完成，未修改任何数据。'
  };
}
if (action !== 'Run') return { Code: 0, Msg: 'Action 仅支持 Plan 或 Run。' };
if (trim(V8.Param.ConfirmExecution) !== 'COMPACT_MARKETPLACE_PACKAGES') {
  return { Code: 0, Msg: '执行确认不匹配；请先运行 Action=Plan。' };
}

var currentRows = scope === 'History' ? [] : readCurrentRows(batchSize);
var initialCurrent = Number(checkpoint.InitialCurrent || (scope === 'History' ? 0 : readCurrentCount()));
var initialHistoryCandidates = Number(checkpoint.InitialHistoryCandidates || (scope === 'Current' ? 0 : readHistoryCandidateCount()));
var processed = Number(checkpoint.Processed || 0);
var phase = currentRows.length > 0 ? 'Current' : 'History';
var historyRows = phase === 'History' && scope !== 'Current' ? readHistoryRows(scanSize, historyAfterId) : [];
var rows = phase === 'Current' ? currentRows : historyRows;
var compacted = [];
var skipped = 0;
var reclaimedBytes = 0;
var nextHistoryAfterId = historyAfterId;
var stoppedAtBatchLimit = false;
for (var index = 0; index < rows.length; index++) {
  if (phase === 'History') nextHistoryAfterId = trim(rows[index].Id);
  var item = phase === 'Current' ? compactCurrentRow(rows[index]) : compactHistoryRow(rows[index]);
  if (item.Skipped) skipped++;
  else {
    compacted.push(item);
    reclaimedBytes += Number(item.Bytes || 0);
    if (phase === 'History' && compacted.length >= batchSize && index < rows.length - 1) {
      stoppedAtBatchLimit = true;
      break;
    }
  }
}
var remainingCurrent = scope === 'History' ? 0 : readCurrentCount();
var historyScanComplete = scope === 'Current'
  || (phase === 'History' && !stoppedAtBatchLimit && historyRows.length < scanSize);
var hasMoreHistory = scope !== 'Current' && !historyScanComplete;
var hasMore = remainingCurrent > 0 || hasMoreHistory;
processed += phase === 'Current' ? rows.length : (stoppedAtBatchLimit ? (skipped + compacted.length) : historyRows.length);
var totalCandidates = Math.max(1, initialCurrent + initialHistoryCandidates);
var progress = hasMore ? Math.max(1, Math.min(99, Math.floor(processed * 100 / totalCandidates))) : 100;
var responseData = {
  DryRun: false,
  Phase: phase,
  Compacted: compacted.length,
  Skipped: skipped,
  ReclaimedBytesThisBatch: reclaimedBytes,
  RemainingCurrent: remainingCurrent,
  RemainingHistory: null,
  HistoryAfterId: nextHistoryAfterId,
  HistoryScanComplete: historyScanComplete,
  HasMore: hasMore,
  Progress: progress,
  ProcessedCandidates: processed,
  TotalCandidates: totalCandidates,
  Rows: compacted
};
if (taskId && hasMore) {
  responseData.BackgroundTask = {
    HasMore: true,
    Checkpoint: {
      Version: 1,
      TaskId: taskId,
      Scope: scope,
      BatchSize: batchSize,
      ScanSize: scanSize,
      HistoryAfterId: nextHistoryAfterId,
      InitialCurrent: initialCurrent,
      InitialHistoryCandidates: initialHistoryCandidates,
      Processed: processed
    },
    Progress: progress,
    Current: processed,
    Total: totalCandidates,
    Msg: phase === 'Current' ? '正在外置当前商城包' : '正在按 Id 游标治理商城历史包'
  };
}
return {
  Code: 1,
  Data: responseData,
  Msg: compacted.length + ' 个内联包已迁移到 HDFS，数据库仅保留可校验指针。'
};
