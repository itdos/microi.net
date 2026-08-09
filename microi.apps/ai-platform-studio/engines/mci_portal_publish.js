/*
 * 门户原子发布：计划哈希校验、不可变版本、幂等复用与事务回滚。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能发布门户版本。');
function guid() { return V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid(); }
var projectId = String((V8.Param && V8.Param.ProjectId) || '');
var expectedHash = String((V8.Param && V8.Param.ExpectedSnapshotHash) || '').toLowerCase();
if (!projectId || !expectedHash) return fail('ProjectId和ExpectedSnapshotHash不能为空。');
var plan = V8.ApiEngine.Run('mci-portal-publish-plan', { ProjectId: projectId });
if (!plan || plan.Code !== 1 || !plan.Data) return fail(plan && plan.Msg ? plan.Msg : '生成发布计划失败。');
if (!plan.Data.CanPublish) return fail('发布计划存在阻断问题。', { Issues: plan.Data.Issues || [] });
if (String(plan.Data.SnapshotHash).toLowerCase() !== expectedHash) {
  return fail('门户草稿已变化，请重新预检后发布。', { ActualSnapshotHash: plan.Data.SnapshotHash });
}
var projectResult = V8.FormEngine.GetFormData('mci_portal_project', { Id: projectId });
if (!projectResult || projectResult.Code !== 1 || !projectResult.Data) return fail('门户项目不存在。');
var project = projectResult.Data;
if (String(project.PublishedHash || '').toLowerCase() === expectedHash && project.ActiveVersionId) {
  return { Code: 1, Data: { VersionId: project.ActiveVersionId, SnapshotHash: expectedHash, Reused: true }, Msg: '相同版本已发布，已幂等复用。' };
}
var existing = V8.FormEngine.GetFormData('mci_resource_version', {
  _Where: [
    ['ResourceType', '=', 'Portal'],
    ['AND', 'ResourceId', '=', projectId],
    ['AND', 'ContentHash', '=', expectedHash]
  ]
});
var versionId = existing && existing.Code === 1 && existing.Data ? existing.Data.Id : guid();
if (!(existing && existing.Code === 1 && existing.Data)) {
  var add = V8.FormEngine.AddFormData('mci_resource_version', {
    Id: versionId,
    ResourceType: 'Portal',
    ResourceId: projectId,
    ResourceKey: project.ProjectKey || projectId,
    VersionNo: DateNow('yyyyMMddHHmmss'),
    ContentHash: expectedHash,
    SnapshotJson: plan.Data.SnapshotJson,
    SourceVersionId: project.ActiveVersionId || '',
    ChangeSummary: String((V8.Param && V8.Param.ChangeSummary) || '发布门户配置'),
    Status: 'Published',
    PublishedTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
  if (!add || add.Code !== 1) return add || fail('保存门户版本失败。');
}
var update = V8.FormEngine.UptFormDataByWhere('mci_portal_project', {
  _Where: [
    ['Id', '=', projectId],
    ['AND', 'UpdateTime', '=', project.UpdateTime || null]
  ],
  ActiveVersionId: versionId,
  PublishedHash: expectedHash,
  PublishedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  Status: 'Published'
});
if (!update || update.Code !== 1) return update || fail('门户项目并发更新失败。');
var verify = V8.FormEngine.GetFormData('mci_portal_project', { Id: projectId });
if (!verify || verify.Code !== 1 || !verify.Data || String(verify.Data.PublishedHash || '').toLowerCase() !== expectedHash) {
  return fail('门户发布回读不一致，事务已回滚。');
}
var extension = V8.ApiEngine.Run('mci-portal-publish-extension', {
  HookKey: 'PortalPublish', Phase: 'Published', ProjectId: projectId, VersionId: versionId, SnapshotHash: expectedHash
});
if (extension && extension.Code !== 1) return fail(extension.Msg || '租户发布扩展失败，事务已回滚。');
return { Code: 1, Data: { VersionId: versionId, SnapshotHash: expectedHash, Reused: false }, Msg: '门户版本发布成功。' };
