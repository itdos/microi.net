/*
 * 动态用户组预览：支持安全字段条件、明确用户和标签集合运算；永不接收 SQL。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能预览用户组。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function array(value) {
  if (!value) return [];
  if (value.length !== undefined && typeof value !== 'string') { var output = []; for (var i = 0; i < value.length; i++) output.push(value[i]); return output; }
  try { var parsed = JSON.parse(text(value)); if (parsed && parsed.length !== undefined) return parsed; } catch (error) {}
  return [];
}
function unique(values) { var seen = {}, result = []; for (var i = 0; i < values.length; i++) { var value = text(values[i]); if (value && !seen[value]) { seen[value] = true; result.push(value); } } result.sort(); return result; }
function parseRule(value) { if (!value) return {}; if (typeof value === 'string') { try { return JSON.parse(value); } catch (error) { throw new Error('RuleJson不是有效JSON。'); } } return value; }
var groupId = text(V8.Param && V8.Param.GroupId), group = null, groupType = text(V8.Param && V8.Param.GroupType) || 'Dynamic';
var ruleSource = V8.Param && V8.Param.RuleJson;
if (groupId) {
  var groupResult = V8.FormEngine.GetFormData('mci_identity_group', { Id: groupId });
  if (!groupResult || groupResult.Code !== 1 || !groupResult.Data) return { Code: 2, Msg: '用户组不存在。' };
  group = groupResult.Data; groupType = text(group.GroupType) || 'Dynamic'; ruleSource = group.RuleJson;
}
var rule;
try { rule = parseRule(ruleSource); } catch (error) { return fail(error.message); }
var where = array(rule.Where || rule._Where || (rule.length !== undefined ? rule : []));
if (where.length > 20) return fail('用户组条件最多20条。');
var allowedFields = { Id: 1, Account: 1, Name: 1, DeptId: 1, DeptIds: 1, RoleIds: 1, State: 1, Phone: 1, Email: 1, Level: 1, CreateTime: 1 };
var allowedOperators = { '=': 1, '==': 1, '<>': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, Like: 1, NotLike: 1, StartLike: 1, EndLike: 1, In: 1, NotIn: 1 };
var normalizedWhere = [];
for (var i = 0; i < where.length; i++) {
  var item = array(where[i]);
  if (item.length !== 3 && item.length !== 4) return fail('第' + (i + 1) + '条条件格式无效。');
  var offset = item.length === 4 ? 1 : 0, join = offset ? text(item[0]).toUpperCase() : '';
  var field = text(item[offset]), operator = text(item[offset + 1]), value = item[offset + 2];
  if (offset && join !== 'AND' && join !== 'OR') return fail('条件连接符只允许AND/OR。');
  if (!allowedFields[field]) return fail('用户组条件不允许字段：' + field);
  if (!allowedOperators[operator]) return fail('用户组条件不允许操作符：' + operator);
  if ((operator === 'In' || operator === 'NotIn') && array(value).length > 200) return fail('In/NotIn单条最多200个值。');
  if (text(value).length > 1000) return fail('单个条件值不能超过1000字符。');
  normalizedWhere.push(offset ? [join, field, operator, value] : [field, operator, value]);
}
var userIds = unique(array(rule.UserIds)), allTagIds = unique(array(rule.AllTagIds)), anyTagIds = unique(array(rule.AnyTagIds)), excludeTagIds = unique(array(rule.ExcludeTagIds));
if (userIds.length > 5000) return fail('明确用户最多5000名。');
var tagIds = unique(allTagIds.concat(anyTagIds).concat(excludeTagIds));
if (tagIds.length > 20) return fail('单个人群规则最多引用20个标签。');
if (groupType === 'Static' && !userIds.length) return fail('静态用户组必须在RuleJson.UserIds中明确成员，拒绝退化为全量用户。');
if (groupType === 'Directory' && !userIds.length) return fail('目录用户组必须由同步结果写入RuleJson.UserIds，拒绝退化为全量用户。');
if (!normalizedWhere.length && !userIds.length && !tagIds.length && rule.MatchAll !== true) return fail('空规则不会匹配全部用户；确需全量时必须显式设置MatchAll=true。');
if (tagIds.length) {
  var tagsResult = V8.FormEngine.GetTableData('mci_identity_tag', { _Where: [['Id', 'In', tagIds], ['AND', 'Enabled', '=', 1]], _SelectFields: ['Id', 'TagKey', 'Name'], _PageIndex: 1, _PageSize: 50 });
  if (!tagsResult || tagsResult.Code !== 1) return tagsResult || fail('读取标签字典失败。');
  if ((tagsResult.Data || []).length !== tagIds.length) return fail('规则引用了不存在或未启用的标签。');
}
var candidateWhere = normalizedWhere.slice(0);
if (userIds.length) candidateWhere.push([candidateWhere.length ? 'AND' : '', 'Id', 'In', userIds]);
if (candidateWhere.length && candidateWhere[0].length === 4 && !candidateWhere[0][0]) candidateWhere[0] = candidateWhere[0].slice(1);
var countResult = V8.FormEngine.GetTableDataCount('Sys_User', { _Where: candidateWhere });
if (!countResult || countResult.Code !== 1) return countResult || fail('统计用户组候选成员失败。');
var candidateCount = Number(countResult.Data || countResult.DataCount || 0);
if (candidateCount > 5000) return fail('用户组候选成员超过5000名，请收窄字段或标签规则。', { CandidateCount: candidateCount });
var usersResult = V8.FormEngine.GetTableData('Sys_User', {
  _Where: candidateWhere,
  _SelectFields: ['Id', 'Account', 'Name', 'DeptId', 'DeptName', 'RoleIds', 'State'],
  _OrderBy: 'Account', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 5000
});
if (!usersResult || usersResult.Code !== 1) return usersResult || fail('读取用户组候选成员失败。');
var candidates = usersResult.Data || [], tagSets = {}, now = DateNow('yyyy-MM-dd HH:mm:ss');
for (var t = 0; t < tagIds.length; t++) tagSets[tagIds[t]] = {};
for (var start = 0; start < candidates.length && tagIds.length; start += 200) {
  var batchIds = [];
  for (var bi = start; bi < candidates.length && bi < start + 200; bi++) batchIds.push(text(candidates[bi].Id));
  var assignmentsResult = V8.FormEngine.GetTableData('mci_identity_tag_assignment', {
    _Where: [['TagId', 'In', tagIds], ['AND', 'UserId', 'In', batchIds], ['AND', 'Status', '=', 'Active']],
    _SelectFields: ['TagId', 'UserId', 'EffectiveFrom', 'ExpiresAt'], _PageIndex: 1, _PageSize: 5000
  });
  if (!assignmentsResult || assignmentsResult.Code !== 1) return assignmentsResult || fail('读取标签分配失败。');
  var assignments = assignmentsResult.Data || [];
  for (var a = 0; a < assignments.length; a++) {
    var assignment = assignments[a] || {}, effective = text(assignment.EffectiveFrom), expires = text(assignment.ExpiresAt);
    if ((!effective || effective <= now) && (!expires || expires > now) && tagSets[text(assignment.TagId)]) tagSets[text(assignment.TagId)][text(assignment.UserId)] = true;
  }
}
function hasAll(userId, ids) { for (var i = 0; i < ids.length; i++) if (!tagSets[ids[i]] || !tagSets[ids[i]][userId]) return false; return true; }
function hasAny(userId, ids) { if (!ids.length) return true; for (var i = 0; i < ids.length; i++) if (tagSets[ids[i]] && tagSets[ids[i]][userId]) return true; return false; }
function hasExcluded(userId, ids) { for (var i = 0; i < ids.length; i++) if (tagSets[ids[i]] && tagSets[ids[i]][userId]) return true; return false; }
var members = [], memberIds = [];
for (var c = 0; c < candidates.length; c++) {
  var candidate = candidates[c] || {}, candidateId = text(candidate.Id);
  if (!hasAll(candidateId, allTagIds) || !hasAny(candidateId, anyTagIds) || hasExcluded(candidateId, excludeTagIds)) continue;
  members.push(candidate); memberIds.push(candidateId);
}
var canonicalRule = { Where: normalizedWhere, UserIds: userIds, AllTagIds: allTagIds, AnyTagIds: anyTagIds, ExcludeTagIds: excludeTagIds, MatchAll: rule.MatchAll === true };
return {
  Code: 1,
  Data: {
    GroupId: groupId, GroupKey: group && group.GroupKey ? group.GroupKey : '', GroupType: groupType,
    RuleHash: String(V8.EncryptHelper.Sha256Hex(JSON.stringify(canonicalRule))).toLowerCase(),
    NormalizedRule: canonicalRule, NormalizedWhere: normalizedWhere, MemberIds: memberIds,
    MemberCount: memberIds.length, Sample: members.slice(0, 50), Truncated: members.length > 50
  }
};
