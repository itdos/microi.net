/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-role
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-role
 * Version: v1.1.0
 * Function:
 * - 系统角色查询与维护，旧地址固定动作并复用目录权限校验。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/sysrole/addsysrole": "AddSysRole",
  "/api/sysrole/addsysrolefrombody": "AddSysRole",
  "/api/sysrole/delsysrole": "DelSysRole",
  "/api/sysrole/uptsysrole": "UptSysRole",
  "/api/sysrole/uptsysrolefrombody": "UptSysRole",
  "/api/sysrole/getsysrolemodel": "GetSysRoleModel",
  "/api/sysrole/getsysrole": "GetSysRole",
  "/api/sysrole/getsysrolestep": "GetSysRoleStep",
  "/api/sysrole/getdirecttablegrantpolicies": "GetDirectTableGrantPolicies"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
// Microi官方接口引擎：platform-sys-role
// Version: v1.0.0
// 角色目录业务编排由应用商城交付；非管理员列表仍服从 sys_user 表权限与可分配角色范围。
var action = String((V8.Param && V8.Param.Action) || '').trim();
// 此片段由配置脚本嵌入 platform-sys-role。角色授权与角色编辑共用 sys_rolelimit。
if (action == 'GetMcpRolePermissions' || action == 'SaveMcpRolePermissions') {
    var authorized = V8.Method.ManageSystemDirectory({ Domain: 'SysRole', Action: 'AuthorizeMcpRoleManagement' });
    if (!authorized || authorized.Code != 1) return authorized;
    var request = V8.Param || {};
    function versionOf(rows) {
        if (!rows || rows.length === 0) return 'none';
        if (rows.length != 1 || rows[0].FkId != 'McpDevelopment') throw new Error('MCP 授权存在重复或异常记录，请管理员修复。');
        return V8.EncryptHelper.Sha256Hex(String(rows[0].Permission || ''));
    }
    function readLimits(roleId) {
        var result = V8.FormEngine.GetTableData('sys_rolelimit', {
            _Where: [['RoleId', '=', roleId], ['Type', '=', 'McpDevelopment']],
            _SelectFields: ['Id', 'RoleId', 'FkId', 'Permission'], _PageSize: 3
        }, V8.DbTrans);
        if (!result || result.Code != 1) throw new Error(result ? result.Msg : '读取 MCP 授权失败');
        return result.Data || [];
    }
    if (action == 'GetMcpRolePermissions') {
        var where = [];
        if (request.RoleId) where.push(['Id', '=', String(request.RoleId)]);
        if (request.Keyword) where.push(['Name', 'Like', String(request.Keyword).slice(0, 100)]);
        var roles = V8.FormEngine.GetTableData('sys_role', {
            _Where: where, _SelectFields: ['Id', 'Name', 'Level'], _OrderBy: 'Name',
            _PageIndex: Math.max(1, Number(request.PageIndex) || 1), _PageSize: Math.min(100, Math.max(1, Number(request.PageSize) || 50))
        }, V8.DbTrans);
        if (!roles || roles.Code != 1) return roles;
        var list = [];
        for (var i = 0; roles.Data && i < roles.Data.length; i++) {
            var row = roles.Data[i], limits = readLimits(row.Id), version = versionOf(limits);
            var policy = limits.length ? JSON.parse(limits[0].Permission) : { Enabled: false, Scope: 'Role', CanWrite: false, CanDelete: false };
            var checked = V8.Method.ManageSystemDirectory({ Domain: 'SysRole', Action: 'ValidateMcpRolePermission', Param: { Policy: policy } });
            if (!checked || checked.Code != 1) return checked;
            list.push({ Id: row.Id, Name: row.Name, Level: row.Level, Policy: checked.Data, Version: version });
        }
        return { Code: 1, Data: list, DataCount: roles.DataCount };
    }
    var changes = request.Roles;
    if (!changes || typeof changes.length != 'number' || typeof changes == 'string' || changes.length < 1 || changes.length > 100)
        return { Code: 0, Msg: '请提交 1 至 100 个角色的变更。' };
    var seen = {}, prepared = [];
    // 先验证整批；任一冲突失败即回滚，不部分保存，也不覆盖同时打开的角色编辑页。
    for (var index = 0; index < changes.length; index++) {
        var change = changes[index], roleId = String(change.Id || '').trim(), key = roleId.toLowerCase();
        if (!key || seen[key]) return { Code: 0, Msg: '角色标识为空或重复。' };
        seen[key] = true;
        var role = V8.FormEngine.GetFormData('sys_role', { Id: roleId, _SelectFields: ['Id', 'Level'] }, V8.DbTrans);
        if (!role || role.Code != 1 || !role.Data) return { Code: 0, Msg: '角色不存在或已删除。' };
        var validated = V8.Method.ManageSystemDirectory({ Domain: 'SysRole', Action: 'ValidateMcpRolePermission', Param: { Policy: change.Policy } });
        if (!validated || validated.Code != 1) return validated;
        var existing = readLimits(roleId), version = versionOf(existing);
        if (String(change.Version || '') != version) return { Code: 0, Msg: '角色 MCP 授权已被修改，请刷新后重试。' };
        prepared.push({ Id: roleId, Existing: existing.length ? existing[0] : null, Policy: JSON.stringify(validated.Data) });
    }
    for (var writeIndex = 0; writeIndex < prepared.length; writeIndex++) {
        var item = prepared[writeIndex];
        if (item.Existing) {
            // 角色编辑会回传未改变的授权；保持原记录，不把 MySQL 的零变更行误判为保存失败。
            // 此分支不写任何 MCP 字段，并发的新授权也不会被旧窗口覆盖。
            if (item.Policy == String(item.Existing.Permission || '')) continue;
            // 参数化 CAS；不同 API 节点的并发保存也不会丢失更新。
            var count = V8.DbTrans.FromSql('UPDATE sys_rolelimit SET Permission=@new WHERE Id=@id AND RoleId=@role AND Type=@type AND Permission=@old')
                .AddInParameter('@new', item.Policy).AddInParameter('@id', item.Existing.Id)
                .AddInParameter('@role', item.Id).AddInParameter('@type', 'McpDevelopment')
                .AddInParameter('@old', item.Existing.Permission).ExecuteNonQuery();
            if (count != 1) return { Code: 0, Msg: '角色授权发生并发修改或未确认写入，请刷新后重试。' };
        } else {
            var added = V8.FormEngine.AddFormData('sys_rolelimit', {
                Id: V8.EncryptHelper.Sha256Hex('McpDevelopment:' + item.Id.toLowerCase()).slice(0, 32),
                RoleId: item.Id, FkId: 'McpDevelopment', Type: 'McpDevelopment', Permission: item.Policy
            }, V8.DbTrans);
            if (!added || added.Code != 1) return added;
        }
    }
    return { Code: 1, Data: { Saved: prepared.length }, Msg: 'MCP 角色授权已保存。' };
}

var allowed = {
  AddSysRole: 1,
  DelSysRole: 1,
  UptSysRole: 1,
  GetSysRole: 1,
  GetSysRoleModel: 1,
  GetSysRoleStep: 1,
  GetDirectTableGrantPolicies: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的角色动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysRole',
  Action: action,
  Param: V8.Param
});
