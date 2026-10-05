/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统账号
 * ApiEngineKey：official_account_invitations
 * 从可信吾码官方应用源安装、更新或重新安装“系统账号”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: official_account_invitations
 * Version: v1.0.0
 * Function:
 * - 按当前用户身份校验多级邀请树，公开头像投影、分支分页与子节点聚合，拒绝越权查询。
 */

// 官网邀请关系：仅返回当前登录用户的后代，按分支分页加载。
function text(v) { return v == null ? '' : String(v).trim(); }
var userId = text(V8.CurrentUser && V8.CurrentUser.Id);
if (!userId) return { Code: 1001, Msg: '请先登录。' };
var parentId = text(V8.Param.ParentId) || userId;
if (!/^[A-Za-z0-9-]{1,36}$/.test(parentId)) return { Code: 0, Msg: '邀请节点无效。' };
if (parentId !== userId) {
  var parent = V8.FormEngine.GetFormData('sys_user', { Id: parentId, _SelectFields: ['Id','InvitationPath'] });
  if (parent.Code !== 1 || ('/' + text(parent.Data.InvitationPath).replace(/^\/+|\/+$/g, '') + '/').indexOf('/' + userId + '/') < 0)
    return { Code: 0, Msg: '无权查看该邀请节点。' };
}
var pageIndex = Math.max(1, Math.min(10000, parseInt(V8.Param.PageIndex, 10) || 1));
var where = [['InviterUserId', '=', parentId], ['IsDeleted', '=', 0]];
var result = V8.FormEngine.GetTableData('sys_user', {
  _Where: where, _SelectFields: ['Id','Account','Name','PublicAvatar','CreateTime','LastWebsiteLoginTime'],
  _PageIndex: pageIndex, _PageSize: 30, _OrderBy: 'CreateTime', _OrderByType: 'DESC'
});
if (result.Code !== 1) return result;
var rows = result.Data || [];
// 一次聚合当前页的子节点计数，避免逐人查询。
var ids = []; for (var i=0; i<rows.length; i++) ids.push(text(rows[i].Id));
var counts = {};
if (ids.length) {
  var parameters = []; for (var p=0; p<ids.length; p++) parameters.push('@p' + p);
  var query = V8.Db.FromSql('SELECT InviterUserId FROM sys_user WHERE IsDeleted = 0 AND InviterUserId IN (' + parameters.join(',') + ') GROUP BY InviterUserId');
  for (var q=0; q<ids.length; q++) query = query.AddInParameter('@p' + q, ids[q]);
  var aggregate = query.ToArray();
  for (var j=0; j<aggregate.length; j++) counts[text(aggregate[j].InviterUserId)] = true;
}
var nodes = [];
for (var n=0; n<rows.length; n++) nodes.push({
  Id: rows[n].Id, Account: rows[n].Account, Name: rows[n].Name, Avatar: rows[n].PublicAvatar || '',
  CreateTime: rows[n].CreateTime, LastWebsiteLoginTime: rows[n].LastWebsiteLoginTime || '',
  HasChildren: !!counts[text(rows[n].Id)]
});
return { Code: 1, Data: { InviteCode: userId, ParentId: parentId, Nodes: nodes,
  PageIndex: pageIndex, PageSize: 30, Total: Number(result.DataCount || 0) } };
