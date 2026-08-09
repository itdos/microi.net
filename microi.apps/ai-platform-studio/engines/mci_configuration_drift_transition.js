/* 配置漂移处置状态机：忽略必须说明原因，修复必须先由巡检证明摘要一致。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能处置配置漂移。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var param = V8.Param || {}, driftId = text(param.DriftId), action = text(param.Action), reason = text(param.Reason), expectedVersion = Number(param.ExpectedRowVersion);
if (!driftId || ['Ignore', 'Reopen', 'Resolve'].indexOf(action) < 0 || !isFinite(expectedVersion)) return fail('DriftId、Action或ExpectedRowVersion无效。');
var result = V8.FormEngine.GetFormData('mci_configuration_drift', { Id: driftId }, V8.DbTrans); if (!result || result.Code !== 1 || !result.Data) return { Code: 2, Msg: '配置漂移记录不存在。' };
var row = result.Data, currentVersion = Number(row.RowVersion || 0); if (currentVersion !== expectedVersion) return fail('配置漂移记录已变化，请刷新后重试。', { Conflict: true, CurrentRowVersion: currentVersion });
var nextStatus = text(row.Status), ignoredReason = text(row.IgnoredReason), resolvedTime = text(row.ResolvedTime);
if (action === 'Ignore') { if (!reason) return fail('忽略配置漂移必须填写原因。'); nextStatus = 'Ignored'; ignoredReason = reason; resolvedTime = ''; }
if (action === 'Reopen') { nextStatus = text(row.BaselineHash) === text(row.ActualHash) ? 'Matched' : 'Changed'; ignoredReason = ''; resolvedTime = ''; }
if (action === 'Resolve') { if (text(row.BaselineHash) !== text(row.ActualHash)) return fail('当前摘要仍不一致，请先修复目标配置并重新巡检。'); nextStatus = 'Resolved'; ignoredReason = reason; resolvedTime = DateNow('yyyy-MM-dd HH:mm:ss'); }
var update = V8.FormEngine.UptFormDataByWhere('mci_configuration_drift', { _Where: [['Id', '=', driftId], ['AND', 'RowVersion', '=', currentVersion]], Status: nextStatus, IgnoredReason: ignoredReason, ResolvedTime: resolvedTime, RowVersion: currentVersion + 1 }, V8.DbTrans);
if (!update || update.Code !== 1) return update || fail('配置漂移处置发生并发冲突。');
var verify = V8.FormEngine.GetFormData('mci_configuration_drift', { Id: driftId }, V8.DbTrans); if (!verify || verify.Code !== 1 || Number(verify.Data.RowVersion || 0) !== currentVersion + 1 || text(verify.Data.Status) !== nextStatus) return fail('配置漂移处置回读失败，事务已回滚。');
return { Code: 1, Data: { DriftId: driftId, Status: nextStatus, RowVersion: currentVersion + 1 }, Msg: '配置漂移状态已更新。' };
