/*
 * 组织快照：部门树与用户归属采用稳定排序、最小字段和内容哈希保存不可变时间切片。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能创建组织快照。');
function rows(result) { return result && result.Code === 1 && result.Data ? result.Data : []; }
var deptResult = V8.FormEngine.GetTableData('Sys_Dept', { _SelectFields: ['Id', 'Name', 'ParentId', 'ParentIds', 'Sort', 'State'], _OrderBy: 'Id', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 5000 });
if (!deptResult || deptResult.Code !== 1) return deptResult || fail('读取部门结构失败。');
var userResult = V8.FormEngine.GetTableData('Sys_User', { _SelectFields: ['Id', 'Account', 'Name', 'DeptId', 'DeptIds', 'RoleIds', 'State'], _OrderBy: 'Id', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 10000 });
if (!userResult || userResult.Code !== 1) return userResult || fail('读取用户归属失败。');
var depts = rows(deptResult), users = rows(userResult);
depts.sort(function (a, b) { return String(a.Id || '') < String(b.Id || '') ? -1 : 1; });
users.sort(function (a, b) { return String(a.Id || '') < String(b.Id || '') ? -1 : 1; });
var snapshot = { Departments: depts, Users: users }, snapshotJson = JSON.stringify(snapshot), hash = String(V8.EncryptHelper.Sha256Hex(snapshotJson)).toLowerCase();
var previous = V8.FormEngine.GetTableData('mci_org_snapshot', { _OrderBy: 'SnapshotTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 1 });
var previousRow = previous && previous.Code === 1 && previous.Data && previous.Data.length ? previous.Data[0] : null;
if (previousRow && String(previousRow.ContentHash || '').toLowerCase() === hash) return { Code: 1, Data: { SnapshotId: previousRow.Id, SnapshotKey: previousRow.SnapshotKey, ContentHash: hash, Reused: true, DeptCount: depts.length, UserCount: users.length }, Msg: '组织结构未变化，复用最近快照。' };
var now = DateNow('yyyy-MM-dd HH:mm:ss'), snapshotKey = String((V8.Param && V8.Param.SnapshotKey) || ('org-' + now.replace(/[^0-9]/g, '')));
var add = V8.FormEngine.AddFormData('mci_org_snapshot', {
  SnapshotKey: snapshotKey, ContentHash: hash, DeptCount: depts.length, UserCount: users.length,
  Source: String((V8.Param && V8.Param.Source) || 'Manual'),
  ChangeSummary: String((V8.Param && V8.Param.ChangeSummary) || '组织结构快照'),
  SnapshotJson: snapshotJson, SnapshotTime: now
});
if (!add || add.Code !== 1) return add || fail('保存组织快照失败。');
return { Code: 1, Data: { SnapshotId: add.Data && add.Data.Id ? add.Data.Id : '', SnapshotKey: snapshotKey, ContentHash: hash, Reused: false, DeptCount: depts.length, UserCount: users.length, PreviousHash: previousRow ? previousRow.ContentHash : '' }, Msg: '组织结构快照已保存。' };
