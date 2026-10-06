/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统账号
 * ApiEngineKey：platform-user-access-key
 * 从可信吾码官方应用源安装、更新或重新安装“系统账号”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-user-access-key | Version: v1.0.0 */
var route = String(V8.Param.ApiAddress || '').toLowerCase();
var action = String(V8.Param.Action || '');
if (!action) {
  if (route.indexOf('/create') >= 0) action = 'Create';
  else if (route.indexOf('/list') >= 0) action = 'List';
  else if (route.indexOf('/revoke') >= 0) action = 'Revoke';
  else if (route.indexOf('/exchange') >= 0) action = 'Exchange';
}
if (['Create', 'List', 'Revoke', 'Exchange'].indexOf(action) < 0) {
  return { Code: 0, Msg: '不支持的访问密钥动作。' };
}

// 个性化 Hook 永远拿不到访问密钥明文；Exchange 也不把待兑换凭据交给租户代码。
if (action !== 'Exchange') {
  var hook = V8.ApiEngine.Run('platform-user-custom-hook', {
    Stage: 'BeforeUserAccessKey', Action: action,
    TargetUserId: V8.Param.TargetUserId || '', Name: V8.Param.Name || '',
    Scopes: V8.Param.Scopes || [], Remark: V8.Param.Remark || ''
  });
  if (hook && hook.Code !== 1) return hook;
}

return V8.Method.ManageUserAccessKey({
  Action: action,
  TargetUserId: V8.Param.TargetUserId || '',
  Name: V8.Param.Name || '',
  Scopes: V8.Param.Scopes || [],
  AllowedRoutes: V8.Param.AllowedRoutes || [],
  RedirectPath: V8.Param.RedirectPath || '',
  AllowedTableNames: V8.Param.AllowedTableNames || [],
  AllowedApiEngineKeys: V8.Param.AllowedApiEngineKeys || [],
  AllowedDataSourceKeys: V8.Param.AllowedDataSourceKeys || [],
  Permanent: V8.Param.Permanent === true || Number(V8.Param.Permanent || 0) === 1,
  ExpiresAt: V8.Param.ExpiresAt || '', Remark: V8.Param.Remark || '',
  Id: V8.Param.Id || '', AccessKey: V8.Param.AccessKey || '',
  OsClient: V8.Param.OsClient || V8.OsClient, Did: V8.Param.Did || ''
});
