/*
 * 跨资源变更门禁：生产变更必须同时有资源版本、测试回读和回滚计划。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能验证变更集。');
var changeSetId = String((V8.Param && V8.Param.ChangeSetId) || '');
if (!changeSetId) return fail('ChangeSetId不能为空。');
var result = V8.FormEngine.GetFormData('mci_change_set', { Id: changeSetId });
if (!result || result.Code !== 1 || !result.Data) return { Code: 2, Msg: '变更集不存在。' };
var change = result.Data, resources = [], evidence = {}, rollback = {}, checks = [];
try { resources = JSON.parse(String(change.ResourcesJson || '[]')); evidence = JSON.parse(String(change.EvidenceJson || '{}')); rollback = JSON.parse(String(change.RollbackJson || '{}')); } catch (error) { return fail('变更集JSON配置无效。'); }
checks.push({ Key: 'resources', Passed: resources.length > 0, Message: resources.length ? '已声明' + resources.length + '项资源。' : '没有声明变更资源。' });
checks.push({ Key: 'plan-hash', Passed: !!change.PlanHash, Message: change.PlanHash ? '计划哈希已固定。' : '缺少计划哈希。' });
var evidenceCount = evidence && typeof evidence === 'object' ? Object.keys(evidence).length : 0, rollbackCount = rollback && typeof rollback === 'object' ? Object.keys(rollback).length : 0;
checks.push({ Key: 'evidence', Passed: change.Environment !== 'Production' || evidenceCount > 0, Message: evidenceCount ? '已记录测试与回读证据。' : '生产变更必须记录测试与回读证据。' });
checks.push({ Key: 'rollback', Passed: change.Environment !== 'Production' || rollbackCount > 0, Message: rollbackCount ? '已记录回滚计划。' : '生产变更必须记录回滚计划。' });
var passed = true; for (var i = 0; i < checks.length; i++) if (!checks[i].Passed) passed = false;
var actualPlanHash = String(V8.EncryptHelper.Sha256Hex(JSON.stringify({ Environment: change.Environment, Resources: resources, Rollback: rollback }))).toLowerCase();
checks.push({ Key: 'content-hash', Passed: !change.PlanHash || String(change.PlanHash).toLowerCase() === actualPlanHash, Message: !change.PlanHash || String(change.PlanHash).toLowerCase() === actualPlanHash ? '变更内容与计划哈希一致。' : '变更内容已偏离计划哈希。' });
if (change.PlanHash && String(change.PlanHash).toLowerCase() !== actualPlanHash) passed = false;
if (!(V8.Param && V8.Param.DryRun === true)) V8.FormEngine.UptFormData('mci_change_set', { Id: changeSetId, PlanHash: change.PlanHash || actualPlanHash, Status: passed ? 'Approved' : 'Reviewing' });
return { Code: 1, Data: { Passed: passed, Checks: checks, PlanHash: change.PlanHash || actualPlanHash, ValidatedAt: DateNow('yyyy-MM-dd HH:mm:ss') }, Msg: passed ? '变更集门禁通过。' : '变更集门禁未通过。' };
