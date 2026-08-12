/* 配置漂移：比较两个已发布配置的有效结果并保存有界语义差异。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能执行配置漂移巡检。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function diff(left, right, path, rows, depth) {
  if (rows.length >= 500 || depth > 60) return;
  if (JSON.stringify(left) === JSON.stringify(right)) return;
  var leftObject = left && typeof left === 'object' && left.length === undefined, rightObject = right && typeof right === 'object' && right.length === undefined;
  if (leftObject && rightObject) { var keys = {}, lk = Object.keys(left), rk = Object.keys(right), i; for (i = 0; i < lk.length; i++) keys[lk[i]] = true; for (i = 0; i < rk.length; i++) keys[rk[i]] = true; var ordered = Object.keys(keys).sort(); for (i = 0; i < ordered.length; i++) diff(left[ordered[i]], right[ordered[i]], path ? path + '.' + ordered[i] : ordered[i], rows, depth + 1); return; }
  rows.push({ Path: path || '$', Type: left === undefined ? 'Added' : right === undefined ? 'Removed' : 'Changed', Baseline: left === undefined ? null : left, Actual: right === undefined ? null : right });
}
var param = V8.Param || {}, baselineId = text(param.BaselineProfileId), targetId = text(param.TargetProfileId);
if (!baselineId || !targetId || baselineId === targetId) return fail('基线和目标配置不能为空且不能相同。');
var baseline = V8.ApiEngine.Run('mci-configuration-resolve', { ProfileId: baselineId }), target = V8.ApiEngine.Run('mci-configuration-resolve', { ProfileId: targetId });
if (!baseline || baseline.Code !== 1) return baseline || fail('解析基线配置失败。'); if (!target || target.Code !== 1) return target || fail('解析目标配置失败。');
var differences = []; diff({ Schema: baseline.Data.Schema, Values: baseline.Data.Values, SecretReferences: baseline.Data.SecretReferences }, { Schema: target.Data.Schema, Values: target.Data.Values, SecretReferences: target.Data.SecretReferences }, '', differences, 0);
var truncated = differences.length >= 500, status = differences.length ? 'Changed' : 'Matched', driftKey = text(V8.EncryptHelper.Sha256Hex(baselineId + ':' + targetId)).toLowerCase(), now = DateNow('yyyy-MM-dd HH:mm:ss'), existing = V8.FormEngine.GetFormData('mci_configuration_drift', { _Where: [['DriftKey', '=', driftKey]] }, V8.DbTrans), row = existing && existing.Code === 1 ? existing.Data : null;
if (row && text(row.Status) === 'Ignored' && text(row.BaselineHash) === text(baseline.Data.EffectiveHash) && text(row.ActualHash) === text(target.Data.EffectiveHash)) status = 'Ignored';
var data = { DriftKey: driftKey, BaselineProfileId: baselineId, TargetProfileId: targetId, Environment: text(target.Data.Environment), BaselineHash: text(baseline.Data.EffectiveHash), ActualHash: text(target.Data.EffectiveHash), Status: status, DiffJson: JSON.stringify({ Differences: differences, Truncated: truncated }), DetectedTime: now, RowVersion: Number(row && row.RowVersion || 0) + 1 };
if (param.DryRun === true || Number(param.DryRun || 0) === 1) return { Code: 1, Data: { DryRun: true, DriftKey: driftKey, Status: status, BaselineHash: data.BaselineHash, ActualHash: data.ActualHash, Differences: differences, Truncated: truncated }, Msg: differences.length ? '发现配置漂移，尚未写入。' : '配置与基线一致。' };
var save;
if (row) { data._Where = [['Id', '=', row.Id], ['AND', 'RowVersion', '=', row.RowVersion === null || row.RowVersion === undefined || row.RowVersion === '' ? null : Number(row.RowVersion || 0)]]; save = V8.FormEngine.UptFormDataByWhere('mci_configuration_drift', data, V8.DbTrans); }
else save = V8.FormEngine.AddFormData('mci_configuration_drift', data, V8.DbTrans);
if (!save || save.Code !== 1) return save || fail('保存配置漂移发生并发冲突。');
var verify = V8.FormEngine.GetFormData('mci_configuration_drift', { _Where: [['DriftKey', '=', driftKey]] }, V8.DbTrans); if (!verify || verify.Code !== 1 || !verify.Data || Number(verify.Data.RowVersion || 0) !== data.RowVersion) return fail('配置漂移回读失败，事务已回滚。');
return { Code: 1, Data: { DriftId: verify.Data.Id, DriftKey: driftKey, Status: status, BaselineHash: data.BaselineHash, ActualHash: data.ActualHash, Differences: differences, Truncated: truncated, RowVersion: data.RowVersion }, Msg: differences.length ? '配置漂移巡检完成，发现差异。' : '配置漂移巡检完成，基线一致。' };
