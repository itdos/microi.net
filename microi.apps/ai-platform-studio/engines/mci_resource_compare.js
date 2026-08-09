/*
 * 通用资源版本语义比较。数组优先按 Id/Key 匹配，忽略纯排序变化。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能比较治理资源版本。');
function getVersion(id) {
  var result = V8.FormEngine.GetFormData('mci_resource_version', { Id: id });
  return result && result.Code === 1 ? result.Data : null;
}
function parse(value) {
  try { return JSON.parse(String(value || '{}')); }
  catch (error) { throw new Error('版本快照不是有效JSON。'); }
}
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
function scalar(value) {
  if (value === undefined) return null;
  return value;
}
function identity(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  var keys = ['Id', 'id', 'Key', 'key', 'Name', 'name'];
  for (var i = 0; i < keys.length; i++) if (item[keys[i]] !== undefined && item[keys[i]] !== null) return keys[i] + ':' + String(item[keys[i]]);
  return '';
}
function add(changes, kind, path, before, after) {
  if (changes.length >= 500) return;
  changes.push({ Kind: kind, Path: path || '/', Before: scalar(before), After: scalar(after) });
}
function walk(left, right, path, depth, changes) {
  if (changes.length >= 500) return;
  if (depth > 8) { add(changes, 'Changed', path, '[depth-limit]', '[depth-limit]'); return; }
  var lt = typeOf(left), rt = typeOf(right);
  if (lt !== rt) { add(changes, 'Changed', path, left, right); return; }
  if (lt === 'object') {
    var keys = {}, key;
    for (key in left) if (Object.prototype.hasOwnProperty.call(left, key)) keys[key] = true;
    for (key in right) if (Object.prototype.hasOwnProperty.call(right, key)) keys[key] = true;
    var names = Object.keys(keys).sort();
    for (var i = 0; i < names.length; i++) {
      key = names[i];
      var nextPath = (path || '') + '/' + key;
      if (!Object.prototype.hasOwnProperty.call(left, key)) add(changes, 'Added', nextPath, undefined, right[key]);
      else if (!Object.prototype.hasOwnProperty.call(right, key)) add(changes, 'Removed', nextPath, left[key], undefined);
      else walk(left[key], right[key], nextPath, depth + 1, changes);
    }
    return;
  }
  if (lt === 'array') {
    var keyed = true, lmap = {}, rmap = {};
    for (var l = 0; l < left.length; l++) { var lk = identity(left[l]); if (!lk || lmap[lk]) keyed = false; lmap[lk] = left[l]; }
    for (var r = 0; r < right.length; r++) { var rk = identity(right[r]); if (!rk || rmap[rk]) keyed = false; rmap[rk] = right[r]; }
    if (keyed) {
      var all = {}, name;
      for (name in lmap) all[name] = true;
      for (name in rmap) all[name] = true;
      var identities = Object.keys(all).sort();
      for (var x = 0; x < identities.length; x++) {
        name = identities[x];
        var itemPath = (path || '') + '[' + name + ']';
        if (!Object.prototype.hasOwnProperty.call(lmap, name)) add(changes, 'Added', itemPath, undefined, rmap[name]);
        else if (!Object.prototype.hasOwnProperty.call(rmap, name)) add(changes, 'Removed', itemPath, lmap[name], undefined);
        else walk(lmap[name], rmap[name], itemPath, depth + 1, changes);
      }
    } else {
      var max = Math.max(left.length, right.length);
      for (var index = 0; index < max; index++) {
        if (index >= left.length) add(changes, 'Added', (path || '') + '[' + index + ']', undefined, right[index]);
        else if (index >= right.length) add(changes, 'Removed', (path || '') + '[' + index + ']', left[index], undefined);
        else walk(left[index], right[index], (path || '') + '[' + index + ']', depth + 1, changes);
      }
    }
    return;
  }
  if (JSON.stringify(left) !== JSON.stringify(right)) add(changes, 'Changed', path, left, right);
}

var leftId = String((V8.Param && V8.Param.LeftVersionId) || '');
var rightId = String((V8.Param && V8.Param.RightVersionId) || '');
if (!leftId || !rightId) return fail('LeftVersionId和RightVersionId不能为空。');
var leftVersion = getVersion(leftId), rightVersion = getVersion(rightId);
if (!leftVersion || !rightVersion) return fail('比较版本不存在。');
if (String(leftVersion.ResourceType) !== String(rightVersion.ResourceType) || String(leftVersion.ResourceId) !== String(rightVersion.ResourceId)) {
  return fail('只能比较同一资源的两个版本。');
}
var changes = [];
try { walk(parse(leftVersion.SnapshotJson), parse(rightVersion.SnapshotJson), '', 0, changes); }
catch (error) { return fail(error.message); }
return {
  Code: 1,
  Data: {
    Left: { Id: leftVersion.Id, VersionNo: leftVersion.VersionNo, ContentHash: leftVersion.ContentHash },
    Right: { Id: rightVersion.Id, VersionNo: rightVersion.VersionNo, ContentHash: rightVersion.ContentHash },
    Changes: changes,
    ChangeCount: changes.length,
    Truncated: changes.length >= 500
  }
};
