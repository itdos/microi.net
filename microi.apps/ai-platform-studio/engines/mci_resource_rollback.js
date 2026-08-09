/*
 * 通用资源回滚。当前版本哈希不匹配时拒绝，Portal 通过活动版本指针原子恢复。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能回滚治理资源。');
function getVersion(id) {
  var result = V8.FormEngine.GetFormData('mci_resource_version', { Id: id });
  return result && result.Code === 1 ? result.Data : null;
}
var resourceType = String((V8.Param && V8.Param.ResourceType) || 'Portal');
var resourceId = String((V8.Param && V8.Param.ResourceId) || '');
var targetVersionId = String((V8.Param && V8.Param.TargetVersionId) || '');
var expectedCurrentHash = String((V8.Param && V8.Param.ExpectedCurrentHash) || '').toLowerCase();
if (!resourceId || !targetVersionId || !expectedCurrentHash) return fail('ResourceId、TargetVersionId和ExpectedCurrentHash不能为空。');
if (resourceType !== 'Portal') return fail('当前版本仅允许回滚Portal资源；其它资源须由对应受管原子方法实现。');
var projectResult = V8.FormEngine.GetFormData('mci_portal_project', { Id: resourceId });
if (!projectResult || projectResult.Code !== 1 || !projectResult.Data) return fail('门户项目不存在。');
var project = projectResult.Data;
var target = getVersion(targetVersionId);
if (!target || String(target.ResourceType) !== resourceType || String(target.ResourceId) !== resourceId) return fail('目标版本不属于当前资源。');
var currentVersion = getVersion(project.ActiveVersionId || '');
var currentHash = currentVersion ? String(currentVersion.ContentHash || '').toLowerCase() : String(project.PublishedHash || '').toLowerCase();
if (String(target.ContentHash || '').toLowerCase() === currentHash) {
  return { Code: 1, Data: { VersionId: project.ActiveVersionId || target.Id, ContentHash: target.ContentHash, Reused: true, IdempotencyKey: String((V8.Param && V8.Param.IdempotencyKey) || '') }, Msg: '目标内容已经是当前发布版本，已幂等复用。' };
}
if (currentHash !== expectedCurrentHash) return fail('当前发布版本已变化，请刷新后重试。', { ActualCurrentHash: currentHash });
var rollbackVersionId = V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
var add = V8.FormEngine.AddFormData('mci_resource_version', {
  Id: rollbackVersionId,
  ResourceType: resourceType,
  ResourceId: resourceId,
  ResourceKey: target.ResourceKey || project.ProjectKey || resourceId,
  VersionNo: DateNow('yyyyMMddHHmmss'),
  ContentHash: target.ContentHash,
  SnapshotJson: target.SnapshotJson,
  SourceVersionId: target.Id,
  ChangeSummary: String((V8.Param && V8.Param.ChangeSummary) || ('回滚到版本 ' + target.VersionNo)),
  Status: 'Published',
  PublishedTime: DateNow('yyyy-MM-dd HH:mm:ss')
});
if (!add || add.Code !== 1) return add || fail('创建回滚版本失败。');
var update = V8.FormEngine.UptFormDataByWhere('mci_portal_project', {
  _Where: [['Id', '=', resourceId], ['AND', 'PublishedHash', '=', expectedCurrentHash]],
  ActiveVersionId: rollbackVersionId,
  PublishedHash: target.ContentHash,
  PublishedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  Status: 'Published'
});
if (!update || update.Code !== 1) return update || fail('并发回滚失败。');
var verify = V8.FormEngine.GetFormData('mci_portal_project', { Id: resourceId });
if (!verify || verify.Code !== 1 || !verify.Data || String(verify.Data.ActiveVersionId) !== String(rollbackVersionId)) return fail('回滚回读不一致，事务已回滚。');
return { Code: 1, Data: { VersionId: rollbackVersionId, ContentHash: target.ContentHash, Reused: false }, Msg: '资源回滚成功。' };
