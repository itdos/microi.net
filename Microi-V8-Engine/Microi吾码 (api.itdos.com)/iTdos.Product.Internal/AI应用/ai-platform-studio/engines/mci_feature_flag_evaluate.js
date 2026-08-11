/* 功能开关评估：普通用户只能使用权威登录上下文，超级管理员可显式模拟主体。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法评估功能开关。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) { if (!value) return []; if (typeof value === 'string') { try { value = JSON.parse(value); } catch (ignore) { value = value.split(','); } } if (value.length === undefined) return []; var out = []; for (var i = 0; i < value.length; i++) out.push(text(value[i])); return out; }
function containsAny(actual, expected) { var left = list(actual), right = list(expected); for (var i = 0; i < left.length; i++) for (var j = 0; j < right.length; j++) if (left[i] === right[j]) return true; return false; }
function stable(value, depth) { if (depth > 30) throw new Error('规则JSON嵌套不能超过30层。'); if (value === null || value === undefined) return 'null'; if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value); if (typeof value === 'number') { if (!isFinite(value)) throw new Error('规则包含非有限数字。'); return JSON.stringify(value); } if (value.length !== undefined && typeof value !== 'string') { var rows = []; for (var a = 0; a < value.length; a++) rows.push(stable(value[a], depth + 1)); return '[' + rows.join(',') + ']'; } if (typeof value !== 'object') throw new Error('规则只允许JSON数据。'); var keys = Object.keys(value).sort(), fields = []; for (var k = 0; k < keys.length; k++) { var key = keys[k]; if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('规则包含禁止字段。'); fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1)); } return '{' + fields.join(',') + '}'; }
var param = V8.Param || {}, currentUser = V8.CurrentUser || {}, isAdmin = Number(currentUser.Level || 0) >= 9999, flagKey = text(param.FlagKey);
if (!flagKey) return fail('FlagKey不能为空。');
var result = V8.FormEngine.GetFormData('mci_feature_flag', { _Where: [['FlagKey', '=', flagKey]] }); if (!result || result.Code !== 1 || !result.Data) return { Code: 2, Msg: '功能开关不存在。' };
var flag = result.Data, rules; try { rules = JSON.parse(text(flag.RulesJson) || '{}'); } catch (error) { return fail('RulesJson不是有效JSON。'); }
var snapshot = { FlagKey: text(flag.FlagKey), Name: text(flag.Name), Description: text(flag.Description), Enabled: Number(flag.Enabled || 0) === 1 ? 1 : 0, Percentage: Number(flag.Percentage === undefined ? 100 : flag.Percentage), Variant: text(flag.Variant || 'on'), Rules: rules, StartTime: text(flag.StartTime), EndTime: text(flag.EndTime), Owner: text(flag.Owner), VersionNo: text(flag.VersionNo) };
try { var calculated = text(V8.EncryptHelper.Sha256Hex(stable(snapshot, 0))).toLowerCase(), expectedHash = text(flag.ContentHash).toLowerCase(); if (expectedHash && expectedHash !== calculated) return fail('功能开关完整性校验失败。'); }
catch (error) { return fail(error.message); }
var requested = isAdmin && param.Context && typeof param.Context === 'object' ? param.Context : {}, userId = text(isAdmin && requested.UserId ? requested.UserId : currentUser.Id), subject = text(isAdmin && requested.SubjectKey ? requested.SubjectKey : currentUser.Id), roleIds = isAdmin && requested.RoleIds ? requested.RoleIds : currentUser.RoleIds, deptIds = isAdmin && (requested.DeptIds || requested.DeptId) ? (requested.DeptIds || requested.DeptId) : (currentUser.DeptIds || currentUser.DeptId);
var enabled = snapshot.Enabled === 1, reason = enabled ? '开关已启用。' : '开关已关闭。', now = DateNow('yyyy-MM-dd HH:mm:ss');
if (enabled && snapshot.StartTime && now < snapshot.StartTime) { enabled = false; reason = '尚未到生效时间。'; }
if (enabled && snapshot.EndTime && now > snapshot.EndTime) { enabled = false; reason = '已超过失效时间。'; }
var excluded = list(rules.ExcludedUserIds), users = list(rules.UserIds), depts = list(rules.DeptIds), roles = list(rules.RoleIds);
if (enabled && excluded.indexOf(userId) >= 0) { enabled = false; reason = '用户位于排除名单。'; }
if (enabled && users.length && users.indexOf(userId) < 0) { enabled = false; reason = '用户不在定向名单。'; }
if (enabled && depts.length && !containsAny(deptIds, depts)) { enabled = false; reason = '部门不在定向范围。'; }
if (enabled && roles.length && !containsAny(roleIds, roles)) { enabled = false; reason = '角色不在定向范围。'; }
var percentage = Number(snapshot.Percentage); if (enabled && percentage < 100) { var hash = text(V8.EncryptHelper.Sha256Hex(flagKey + ':' + subject)).substring(0, 8), bucket = parseInt(hash, 16) % 10000; if (bucket >= Math.floor(percentage * 100)) { enabled = false; reason = '未命中稳定灰度桶。'; } }
return { Code: 1, Data: { FlagKey: flagKey, Enabled: enabled, Variant: enabled ? snapshot.Variant : 'off', Reason: reason, SubjectKeyHash: text(V8.EncryptHelper.Sha256Hex(subject)).substring(0, 16), ContextSource: isAdmin && param.Context ? 'AdministratorSimulation' : 'CurrentUser', Integrity: text(flag.ContentHash) ? 'Verified' : 'Legacy', EvaluatedAt: now } };
