/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-user-public-info
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-sys-user-public-info | Version: v1.0.0 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function numberInRange(value, fallback, min, max) {
  var parsed = Number(value);
  return isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function copyList(value, max) {
  var output = [];
  if (!value || value.length === undefined) return output;
  for (var i = 0; i < value.length && output.length < max; i++) {
    var item = text(value[i]);
    if (item) output.push(item);
  }
  return output;
}

var beforeHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeGetSysUserPublicInfo',
  SourceApiEngineKey: 'platform-sys-user-public-info',
  UserId: String(V8.CurrentUser.Id)
});
if (!beforeHook || beforeHook.Code !== 1) return beforeHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };

var param = V8.Param || {};
var where = [['IsDeleted', '<>', 1]];
if (param.State !== undefined && param.State !== null && text(param.State) !== '') {
  where.push(['AND', 'State', '=', param.State]);
}
var keyword = text(param._Keyword || param.Keyword);
if (keyword.length > 200) keyword = keyword.substring(0, 200);
if (keyword) {
  where.push(['AND', '(', 'Name', 'Like', keyword]);
  where.push(['OR', 'Account', 'Like', keyword, ')']);
}
var query = {
  _Where: where,
  _SelectFields: ['Id', 'Name', 'Account', 'Avatar'],
  _OrderBy: 'Name',
  _OrderByType: 'ASC',
  _PageIndex: numberInRange(param._PageIndex, 1, 1, 1000),
  _PageSize: numberInRange(param._PageSize, 15, 1, 100)
};
var ids = copyList(param.Ids, 100);
if (ids.length) query.Ids = ids;

var result = V8.FormEngine.GetTableData('sys_user', query);
if (!result || result.Code !== 1) return result || { Code: 0, Msg: '公共用户目录读取失败。' };
var rows = result.Data || [];
var output = [];
for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
  var row = rows[rowIndex] || {};
  output.push({
    Id: text(row.Id),
    Name: text(row.Name) || text(row.Account) || '未命名用户',
    Avatar: text(row.Avatar)
  });
}
var afterHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'AfterGetSysUserPublicInfo',
  SourceApiEngineKey: 'platform-sys-user-public-info',
  UserId: String(V8.CurrentUser.Id),
  ResultCount: output.length
});
if (!afterHook || afterHook.Code !== 1) return afterHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };
return { Code: 1, Data: output, DataCount: result.DataCount === undefined ? output.length : result.DataCount };
