/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统账号
 * ApiEngineKey：platform-sys-user-admin
 * 从可信吾码官方应用源安装、更新或重新安装“系统账号”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-user-admin
 * Version: v1.0.2
 * Function: 系统账号新增、修改、删除、查询与登录投影刷新的官方编排入口。
 */

var PARAM = V8.Param || {};
var ACTIONS = {
  AddSysUser: true,
  UptSysUser: true,
  DelSysUser: true,
  GetSysUser: true,
  RefreshLoginUser: true
};

function text(value) {
  return value === null || value === undefined ? "" : value.toString();
}

function safeTargetUserId(param) {
  return text(param.Id || param.UserId || param.userId).trim();
}

function runHook(stage, action, targetUserId) {
  return V8.ApiEngine.Run("platform-user-custom-hook", {
    Stage: stage,
    Action: action,
    TargetUserId: targetUserId,
    SourceApiEngineKey: "platform-sys-user-admin"
  }, V8.DbTrans);
}

var action = text(PARAM.Action).trim();
if (!ACTIONS[action]) {
  return { Code: 0, Msg: "不支持的系统账号操作。" };
}
if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: "登录身份已过期，请重新登录。" };
}

var targetUserId = safeTargetUserId(PARAM);
var authorization = V8.Method.ManageSysUserAdmin({
  Action: action,
  Param: PARAM,
  AuthorizeOnly: true
});
if (!authorization || authorization.Code !== 1) {
  return authorization || { Code: 0, Msg: "系统账号可信授权预检未返回结果。" };
}

// 密码变更必须先由可信原子消费 step-up 一次性票据。由于 Before Hook 是
// 可由租户维护且可能产生外部副作用，敏感改密不执行 Before，只在操作真正
// 成功后执行 After；普通资料与其它账号操作仍保留可阻断的 Before Hook。
var changesPassword = action === "UptSysUser"
  && authorization.DataAppend
  && authorization.DataAppend.ChangesPassword === true;
if (!changesPassword) {
  var beforeHook = runHook("Before", action, targetUserId);
  if (beforeHook && beforeHook.Code !== 1) {
    return beforeHook;
  }
}

var managedResult = V8.Method.ManageSysUserAdmin({
  Action: action,
  Param: PARAM
});
if (!managedResult || managedResult.Code !== 1) {
  return managedResult || { Code: 0, Msg: "系统账号可信原子未返回结果。" };
}

if (!targetUserId && managedResult.Data && managedResult.Data.Id) {
  targetUserId = text(managedResult.Data.Id).trim();
}
var afterHook = runHook("After", action, targetUserId);
if (afterHook && afterHook.Code !== 1) {
  managedResult.DataAppend = managedResult.DataAppend || {};
  managedResult.DataAppend.CustomHookWarning = afterHook.Msg || "系统账号个性化 After Hook 执行失败。";
}

return managedResult;
