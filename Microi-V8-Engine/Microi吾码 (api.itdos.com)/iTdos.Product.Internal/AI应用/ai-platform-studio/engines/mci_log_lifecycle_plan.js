/*
 * 日志生命周期计划：验证留存、配额、法律保留与物理执行范围，默认只读。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能生成日志生命周期计划。');
var policyId = String((V8.Param && V8.Param.PolicyId) || '');
if (!policyId) return fail('PolicyId不能为空。');
var policyResult = V8.FormEngine.GetFormData('mci_log_policy', { Id: policyId });
if (!policyResult || policyResult.Code !== 1 || !policyResult.Data) return { Code: 2, Msg: '日志策略不存在。' };
var policy = policyResult.Data;
if (Number(policy.Enabled || 0) !== 1) return fail('日志策略未启用。');
var hotDays = parseInt(policy.HotDays || 0, 10) || 0, warmDays = parseInt(policy.WarmDays || 0, 10) || 0, coldDays = parseInt(policy.ColdDays || 0, 10) || 0;
if (hotDays < 1 || hotDays > 3650) return fail('HotDays必须在1到3650之间。');
if (warmDays < hotDays || warmDays > 3650) return fail('WarmDays必须大于等于HotDays且不超过3650。');
if (coldDays < warmDays || coldDays > 3650) return fail('ColdDays必须大于等于WarmDays且不超过3650。');
var cutoff = System.DateTime.UtcNow.AddDays(-coldDays).ToString('yyyy-MM-dd HH:mm:ss');
var match = {};
try { match = JSON.parse(String(policy.MatchJson || '{}')); } catch (error) { return fail('MatchJson不是有效JSON。'); }
var allowedMatch = {};
if (match.Type) allowedMatch.Type = String(match.Type).slice(0, 200);
if (match.Category) allowedMatch.Category = String(match.Category).slice(0, 200);
if (match.Source) allowedMatch.Source = String(match.Source).slice(0, 200);
var physical = V8.Method.PlanSystemLogLifecycle({ CutoffTime: cutoff, Match: allowedMatch, MaxCollections: 120 });
if (!physical || physical.Code !== 1) return physical || fail('读取日志物理计划失败。');
var plan = {
  PolicyId: policy.Id, PolicyKey: policy.PolicyKey, SourceType: policy.SourceType,
  HotDays: hotDays, WarmDays: warmDays, ColdDays: coldDays,
  DailyQuotaMB: Number(policy.DailyQuotaMB || 0), TotalQuotaMB: Number(policy.TotalQuotaMB || 0),
  OverQuotaAction: policy.OverQuotaAction || 'Alert', ArchiveMode: policy.ArchiveMode || 'PrivateHdfs',
  LegalHold: Number(policy.LegalHold || 0) === 1, CutoffTime: cutoff, Match: allowedMatch,
  Physical: physical.Data || {}
};
var planHash = String(V8.EncryptHelper.Sha256Hex(JSON.stringify(plan))).toLowerCase();
return { Code: 1, Data: { Plan: plan, PlanHash: planHash, CanExecute: !plan.LegalHold, BlockReason: plan.LegalHold ? '法律保留已启用。' : '', EstimatedCount: Number((physical.Data && physical.Data.EstimatedCount) || 0) } };
