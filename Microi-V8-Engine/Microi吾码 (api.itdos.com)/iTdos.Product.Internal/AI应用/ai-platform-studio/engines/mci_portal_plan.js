/*
 * 门户发布计划：生成确定性快照和哈希，不写数据库。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能生成门户发布计划。');
function rows(table, where, orderBy) {
  var result = V8.FormEngine.GetTableData(table, {
    _Where: where,
    _OrderBy: orderBy || 'Sort',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 2000
  });
  if (!result || result.Code !== 1) throw new Error(result && result.Msg ? result.Msg : '读取数据失败');
  return result.Data || [];
}
function pick(value, fields) {
  var target = {};
  for (var i = 0; i < fields.length; i++) target[fields[i]] = value[fields[i]] === undefined ? null : value[fields[i]];
  return target;
}
function stableSort(list, first, second) {
  return list.sort(function (a, b) {
    var av = String(a[first] === undefined ? '' : a[first]);
    var bv = String(b[first] === undefined ? '' : b[first]);
    if (av === bv && second) {
      av = String(a[second] === undefined ? '' : a[second]);
      bv = String(b[second] === undefined ? '' : b[second]);
    }
    return av < bv ? -1 : (av > bv ? 1 : 0);
  });
}

var projectId = String((V8.Param && V8.Param.ProjectId) || '');
if (!projectId) return fail('ProjectId不能为空。');
var projectResult = V8.FormEngine.GetFormData('mci_portal_project', { Id: projectId });
if (!projectResult || projectResult.Code !== 1 || !projectResult.Data) return fail('门户项目不存在。');
var project = projectResult.Data;
var slots = rows('mci_portal_slot', [['ProjectId', '=', projectId]], 'Sort');
var assets = rows('mci_portal_asset', [['ProjectId', '=', projectId]], 'Sort');
var issues = [];
var slotKeys = {};
var slotIds = {};
for (var i = 0; i < slots.length; i++) {
  var slotKey = String(slots[i].SlotKey || '');
  if (!slotKey) issues.push({ Level: 'Error', Path: 'Slots[' + i + '].SlotKey', Message: '插槽Key不能为空。' });
  if (slotKeys[slotKey]) issues.push({ Level: 'Error', Path: 'Slots[' + i + '].SlotKey', Message: '插槽Key重复：' + slotKey });
  slotKeys[slotKey] = true;
  slotIds[String(slots[i].Id || '')] = true;
}
for (var a = 0; a < assets.length; a++) {
  if (!slotIds[String(assets[a].SlotId || '')]) {
    issues.push({ Level: 'Error', Path: 'Assets[' + a + '].SlotId', Message: '资源未绑定到当前项目有效插槽。' });
  }
  if (!assets[a].ContentJson && !assets[a].AssetUrl) {
    issues.push({ Level: 'Warning', Path: 'Assets[' + a + ']', Message: '资源既没有结构化内容，也没有资源地址。' });
  }
}
var snapshot = {
  SchemaVersion: 1,
  Project: pick(project, ['Id', 'ProjectKey', 'Name', 'Description', 'ThemeJson', 'SeoJson', 'Status']),
  Slots: stableSort(slots.map(function (item) {
    return pick(item, ['Id', 'SlotKey', 'Name', 'LayoutType', 'GridJson', 'VisibilityRuleJson', 'Sort', 'Enabled']);
  }), 'Sort', 'Id'),
  Assets: stableSort(assets.map(function (item) {
    return pick(item, ['Id', 'SlotId', 'AssetKey', 'Name', 'AssetType', 'ContentJson', 'AssetUrl', 'TargetUrl', 'VisibilityRuleJson', 'StartTime', 'EndTime', 'Sort', 'Enabled']);
  }), 'Sort', 'Id')
};
var snapshotJson = JSON.stringify(snapshot);
var snapshotHash = String(V8.EncryptHelper.Sha256Hex(snapshotJson)).toLowerCase();
var extension = V8.ApiEngine.Run('mci-portal-publish-extension', {
  HookKey: 'PortalPublish', Phase: 'Plan', Project: snapshot.Project, SnapshotHash: snapshotHash
});
if (extension && extension.Code !== 1) issues.push({ Level: 'Error', Path: 'Extension', Message: extension.Msg || '租户扩展拒绝发布。' });

var hasError = false;
for (var x = 0; x < issues.length; x++) if (issues[x].Level === 'Error') hasError = true;
return {
  Code: 1,
  Data: {
    CanPublish: !hasError,
    Snapshot: snapshot,
    SnapshotJson: snapshotJson,
    SnapshotHash: snapshotHash,
    Issues: issues,
    Counts: { Slots: slots.length, Assets: assets.length },
    ExpectedProjectUpdateTime: project.UpdateTime || ''
  }
};
