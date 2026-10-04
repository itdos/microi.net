/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_user_runtime
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_user_runtime
 * Version: v1.0.3
 * Function:
 * - 向 SSO 标准协议网关返回已启用用户的最小运行时投影；不返回密码、DiyToken 或访问密钥信息。
 */

if (!V8.Param || V8.Param._TrustedSsoProtocol !== true) {
  return { Code: 0, Msg: '仅 SSO 标准协议网关可以读取用户运行时。' };
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

var userId = text(V8.Param.UserId);
if (!/^[A-Za-z0-9_-]{8,80}$/.test(userId)) {
  return { Code: 0, Msg: 'SSO 用户标识无效。' };
}

var query = V8.FormEngine.GetFormData('sys_user', {
  Id: userId,
  _Where: [['State', '=', 1], ['IsDeleted', '=', 0]],
  _SelectFields: [
    'Id', 'Account', 'Name', 'Email', 'Avatar', 'HeadImgUrl',
    'RoleIds', 'RoleName', 'DeptId', 'DeptIds', 'DeptName', 'Level', 'State', 'IsDeleted'
  ]
});
if (!query || query.Code !== 1 || !query.Data) {
  return { Code: 0, Msg: 'SSO 用户不存在或已停用。' };
}

var user = V8.Method.SetSysUserRoleInfo(query.Data, V8.OsClient);
return {
  Code: 1,
  Data: {
    Id: text(user.Id),
    Account: text(user.Account),
    Name: text(user.Name),
    Email: text(user.Email),
    Avatar: text(user.Avatar),
    HeadImgUrl: text(user.HeadImgUrl),
    RoleIds: user.RoleIds || [],
    RoleName: user.RoleName || [],
    DeptId: text(user.DeptId),
    DeptIds: user.DeptIds || [],
    DeptName: user.DeptName || [],
    Level: user.Level === undefined || user.Level === null ? 0 : user.Level
  }
};
