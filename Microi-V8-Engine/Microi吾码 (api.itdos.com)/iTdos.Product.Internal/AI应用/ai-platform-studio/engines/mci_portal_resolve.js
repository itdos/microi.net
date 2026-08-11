/*
 * 按 ProjectKey/ProjectId 解析当前已发布门户快照。
 */
var projectKey = String((V8.Param && (V8.Param.ProjectKey || V8.Param.ProjectId)) || '');
if (!projectKey) return { Code: 0, Msg: 'ProjectKey不能为空。' };
var projectResult = V8.FormEngine.GetFormData('mci_portal_project', {
  _Where: [
    ['ProjectKey', '=', projectKey],
    ['OR', 'Id', '=', projectKey]
  ]
});
if (!projectResult || projectResult.Code !== 1 || !projectResult.Data) return { Code: 2, Msg: '门户项目不存在。' };
var project = projectResult.Data;
if (!project.ActiveVersionId) return { Code: 2, Msg: '门户项目尚未发布。' };
var versionResult = V8.FormEngine.GetFormData('mci_resource_version', { Id: project.ActiveVersionId });
if (!versionResult || versionResult.Code !== 1 || !versionResult.Data) return { Code: 2, Msg: '当前发布版本不存在。' };
var version = versionResult.Data;
var snapshot = {};
try { snapshot = JSON.parse(String(version.SnapshotJson || '{}')); }
catch (error) { return { Code: 0, Msg: '门户快照损坏。' }; }
return {
  Code: 1,
  Data: {
    ProjectId: project.Id,
    ProjectKey: project.ProjectKey,
    VersionId: version.Id,
    VersionNo: version.VersionNo,
    ETag: version.ContentHash,
    Snapshot: snapshot,
    PublishedTime: version.PublishedTime
  }
};
