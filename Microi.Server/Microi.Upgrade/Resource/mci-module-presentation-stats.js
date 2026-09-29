/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：mci-module-presentation-stats
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-module-presentation-stats
 * Version: v1.1.3
 * Function:
 * - 按当前菜单元数据和账号实时权限批量读取模块、页签与指标统计；所有计数绑定真实菜单范围，拒绝请求注入。
 */

// DECLARATIVE_MODULE_STATISTICS_V1
// Count definitions live with their menu, tab and metric. Request-supplied tables,
// predicates and identities are never used. No executable tab code is evaluated.
var param = V8.Param || {};
var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
function array(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { return []; } }
    if (!value || typeof value === 'string' || typeof value.length !== 'number') return [];
    var result = []; for (var i = 0; i < value.length; i++) result.push(value[i]); return result;
}
function object(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { throw new Error('统计配置 JSON 无效'); } }
    return value && typeof value === 'object' ? value : {};
}
function identity(value) { return String(value || '').trim().toLowerCase(); }
function roleIds(value) {
    var rows = array(value), result = [];
    for (var i = 0; i < rows.length; i++) {
        var id = identity(typeof rows[i] === 'object' ? rows[i].Id : rows[i]);
        if (id && result.indexOf(id) < 0) result.push(id);
    }
    return result.sort();
}
function readRows(table, where, fields, max) {
    var result = [], page = 1;
    while (true) {
        var response = V8.FormEngine.GetTableData(table, { _Where: where, _SelectFields: fields, _PageSize: 200, _PageIndex: page });
        if (!response || Number(response.Code) !== 1) throw new Error('统计所需权限或配置读取失败');
        var rows = array(response.Data); result = result.concat(rows);
        if (result.length > max) throw new Error('统计配置超出允许数量');
        if (rows.length < 200 || Number(response.DataCount) <= result.length) return result;
        page++;
    }
}
function empty(denied) { return { Value: 0, Count: 0, Total: 0, Buttons: Object.create(null), Metrics: Object.create(null), Configured: false, Denied: !!denied }; }

try {
    var trusted = V8.CurrentUser || {};
    if (!trusted.Id) return { Code: 1001, Msg: '请先登录' };
    var users = readRows('sys_user', [['Id', '=', trusted.Id]], ['Id', 'Level', 'State', 'RoleIds', 'IsDeleted'], 1);
    if (users.length !== 1 || Number(users[0].State) !== 1 || Number(users[0].IsDeleted || 0) === 1)
        return { Code: 1001, Msg: '当前账号不可用，请刷新登录状态' };
    var actor = users[0], roles = roleIds(actor.RoleIds);
    if (roles.length > 200) throw new Error('账号角色数量超出统计边界');
    if (Number(actor.Level) !== Number(trusted.Level) || JSON.stringify(roles) !== JSON.stringify(roleIds(trusted.RoleIds)))
        return { Code: 1001, Msg: '账号权限已变更，请刷新登录状态' };
    var activeRoles = roles.length ? readRows('sys_role', [['Id', 'In', roles]], ['Id', 'Level', 'IsDeleted'], 200) : [];
    var effectiveRoles = [], platformRole = false;
    for (var ri = 0; ri < activeRoles.length; ri++) {
        if (Number(activeRoles[ri].IsDeleted || 0) === 1) continue;
        effectiveRoles.push(identity(activeRoles[ri].Id));
        if (Number(activeRoles[ri].Level) >= 9999) platformRole = true;
    }
    var administrator = Number(actor.Level) >= 9999 && platformRole;
    var grants = {};
    if (!administrator && effectiveRoles.length) {
        var limits = readRows('sys_rolelimit', [['RoleId', 'In', effectiveRoles], ['Type', '=', 'Menu']], ['RoleId', 'FkId', 'Permission', 'Type'], 4000);
        for (var li = 0; li < limits.length; li++) {
            var permissions = array(limits[li].Permission);
            if (effectiveRoles.indexOf(identity(limits[li].RoleId)) < 0 || String(limits[li].Type).toLowerCase() !== 'menu') continue;
            for (var pi = 0; pi < permissions.length; pi++)
                if (String(permissions[pi]).toLowerCase() === 'read') grants['$' + identity(limits[li].FkId)] = true;
        }
    }
    function allowed(menuId) { return administrator || grants['$' + identity(menuId)] === true; }

    var many = array(param.MenuRequests), batched = many.length > 0;
    var requests = batched ? many : [param];
    if (requests.length > 200) throw new Error('单次最多查询 200 个菜单');
    var requestedIds = [];
    for (var rq = 0; rq < requests.length; rq++) {
        var requestId = identity(requests[rq].SysMenuId || requests[rq]._SysMenuId);
        if (requestId && requestedIds.indexOf(requestId) < 0 && allowed(requestId)) requestedIds.push(requestId);
    }
    var menus = {}, menuFields = ['Id', 'DiyTableId', 'PageTabs', 'ViewSchema', 'SelectApi', 'IsDeleted'];
    function loadMenus(ids) {
        if (!ids.length) return;
        var rows = readRows('sys_menu', [['Id', 'In', ids]], menuFields, 400);
        for (var i = 0; i < rows.length; i++) if (Number(rows[i].IsDeleted || 0) !== 1) menus['$' + identity(rows[i].Id)] = rows[i];
    }
    loadMenus(requestedIds);
    var configurations = {}, extraScopes = [];
    function definition(value, hostId) {
        var source = object(value), where = array(source.Where);
        if (!own(source, 'Where') || !source.Where || typeof source.Where === 'string'
            || typeof source.Where.length !== 'number' || where.length > 64) throw new Error('计数条件缺失或超出允许数量');
        var scope = identity(source.ScopeMenuId || hostId);
        if (!scope) throw new Error('计数缺少菜单范围');
        if (!own(menus, '$' + scope) && extraScopes.indexOf(scope) < 0 && allowed(scope)) extraScopes.push(scope);
        return { ScopeMenuId: scope, Where: where };
    }
    for (var mi = 0; mi < requestedIds.length; mi++) {
        var menuId = requestedIds[mi], menu = menus['$' + menuId];
        if (!menu) continue;
        var schema = object(menu.ViewSchema), stats = object(schema.PresentationStatistics);
        if (Number(stats.Version) !== 1) continue;
        var config = { Menu: stats.MenuCountEnabled === false ? null : definition({ Where: stats.MenuWhere || [] }, menuId), Tabs: {}, Metrics: {} };
        var tabs = array(menu.PageTabs);
        for (var ti = 0; ti < tabs.length; ti++) {
            var tab = tabs[ti] || {};
            if (tab.BadgeApiEngineKey === 'mci-module-presentation-stats' && tab.BadgeCount)
                config.Tabs['$' + String(tab.Id)] = definition(tab.BadgeCount, menuId);
        }
        var views = array(schema.Views);
        for (var vi = 0; vi < views.length; vi++) {
            var view = views[vi] || {}, viewRoles = roleIds(view.RoleIds);
            if (view.Enabled === false || view.Enabled === 0) continue;
            if (viewRoles.length && !viewRoles.some(function (r) { return effectiveRoles.indexOf(r) >= 0; })) continue;
            var metrics = array(view.Layout && view.Layout.Hero && view.Layout.Hero.Metrics);
            for (var ki = 0; ki < metrics.length; ki++) {
                var metric = metrics[ki] || {};
                if (metric.ApiEngineKey !== 'mci-module-presentation-stats' || !metric.Count) continue;
                var key = '$' + String(metric.Key), resolved = definition(metric.Count, menuId);
                if (own(config.Metrics, key) && JSON.stringify(config.Metrics[key]) !== JSON.stringify(resolved))
                    throw new Error('同名指标存在不同计数条件');
                config.Metrics[key] = resolved;
            }
        }
        configurations['$' + menuId] = config;
    }
    if (extraScopes.length > 200) throw new Error('跨菜单统计范围过多');
    loadMenus(extraScopes);
    var tableIds = [];
    for (var mk in menus) if (own(menus, mk)) {
        var tableId = identity(menus[mk].DiyTableId);
        if (tableId && tableIds.indexOf(tableId) < 0) tableIds.push(tableId);
    }
    var tables = {}, tableRows = tableIds.length ? readRows('diy_table', [['Id', 'In', tableIds]], ['Id', 'Name', 'IsDeleted'], 400) : [];
    for (var tr = 0; tr < tableRows.length; tr++) if (Number(tableRows[tr].IsDeleted || 0) !== 1)
        tables['$' + identity(tableRows[tr].Id)] = String(tableRows[tr].Name || '');

    // A menu grant cannot override the host's administrator-only table boundary.
    // Read the same native policy used by FormEngine; never copy its table list.
    var tableReadPolicies = {};
    if (!administrator) {
        if (!V8.Method || typeof V8.Method.GetDirectTableGrantPolicies !== 'function')
            throw new Error('服务端表权限策略不可用');
        var nativePolicy = V8.Method.GetDirectTableGrantPolicies();
        if (!nativePolicy || Number(nativePolicy.Code) !== 1 || !nativePolicy.Data)
            throw new Error('服务端表权限策略读取失败');
        var nativeRows = nativePolicy.Data;
        var policyLength = typeof nativeRows.length === 'number' ? nativeRows.length : Number(nativeRows.Count || 0);
        if (!policyLength || policyLength > 1024) throw new Error('服务端表权限策略为空或数量无效');
        for (var ni = 0; ni < policyLength; ni++) {
            var nativeRow = nativeRows[ni] || {}, policyName = identity(nativeRow.TableName), policyMode = identity(nativeRow.Mode);
            if (!policyName || ['administratoronly', 'readonly', 'rolemanaged'].indexOf(policyMode) < 0)
                throw new Error('服务端表权限策略格式无效');
            var nativePermissions = nativeRow.AllowedPermissions || [];
            var permissionLength = typeof nativePermissions.length === 'number' ? nativePermissions.length : Number(nativePermissions.Count || 0);
            var permitsRead = false;
            for (var npi = 0; npi < permissionLength; npi++) if (identity(nativePermissions[npi]) === 'read') permitsRead = true;
            tableReadPolicies['$' + policyName] = policyMode !== 'administratoronly' && permitsRead;
        }
    }
    function canCount(menuId) {
        if (!allowed(menuId)) return false;
        var scopedMenu = menus['$' + identity(menuId)];
        if (!scopedMenu) throw new Error('统计引用的菜单不存在');
        var scopedTable = tables['$' + identity(scopedMenu.DiyTableId)];
        if (!scopedTable) throw new Error('统计菜单未绑定有效表');
        var policyKey = '$' + identity(scopedTable);
        return administrator || !own(tableReadPolicies, policyKey) || tableReadPolicies[policyKey] === true;
    }

    var specs = [], bySignature = {}, values = {}, plans = [];
    function add(def) {
        if (!canCount(def.ScopeMenuId)) return null;
        var sourceMenu = menus['$' + def.ScopeMenuId];
        if (!sourceMenu) throw new Error('统计引用的菜单不存在');
        var selectApi = String(sourceMenu.SelectApi || '').trim();
        if (selectApi && !/^\/api\/formengine\/gettabledata\/?$/i.test(selectApi)) throw new Error('自定义列表数据源不能使用本地表计数');
        var table = tables['$' + identity(sourceMenu.DiyTableId)];
        if (!table) throw new Error('统计菜单未绑定有效表');
        var signature = JSON.stringify([def.ScopeMenuId, table, def.Where]);
        if (!own(bySignature, signature)) {
            if (specs.length >= 512) throw new Error('单次计数条件过多');
            bySignature[signature] = true;
            specs.push({ Signature: signature, FormEngineKey: table, _SysMenuId: sourceMenu.Id, _Where: def.Where });
        }
        return signature;
    }
    function selectedKeys(value) { var keys = array(value); if (keys.length > 100) throw new Error('请求的指标或页签过多'); return keys; }
    for (var qi = 0; qi < requests.length; qi++) {
        var request = requests[qi] || {}, id = identity(request.SysMenuId || request._SysMenuId), cfg = configurations['$' + id];
        var plan = { Id: String(request.SysMenuId || request._SysMenuId || '').trim(), Result: empty(!allowed(id)), Buttons: Object.create(null), Metrics: Object.create(null) };
        if (cfg && allowed(id) && !canCount(id)) { plan.Result = empty(true); cfg = null; }
        if (cfg && allowed(id)) {
            plan.Result.Configured = true;
            plan.Count = cfg.Menu ? add(cfg.Menu) : null;
            var valueOnly = request.ValueOnly === true || Number(request.ValueOnly) === 1 || String(request.ValueOnly).toLowerCase() === 'true';
            plan.Total = !cfg.Menu ? null : valueOnly ? plan.Count : add({ ScopeMenuId: cfg.Menu.ScopeMenuId, Where: [] });
            var buttonKeys = selectedKeys(request.ButtonKeys), metricKeys = selectedKeys(request.MetricKeys);
            for (var bi = 0; bi < buttonKeys.length; bi++) {
                var bk = String(buttonKeys[bi]); if (own(cfg.Tabs, '$' + bk)) plan.Buttons[bk] = add(cfg.Tabs['$' + bk]);
            }
            for (var ki = 0; ki < metricKeys.length; ki++) {
                var metricKey = String(metricKeys[ki]); if (own(cfg.Metrics, '$' + metricKey)) plan.Metrics[metricKey] = add(cfg.Metrics['$' + metricKey]);
            }
        }
        plans.push(plan);
    }
    function countNumber(value) {
        var number = Number(value);
        if (value === null || value === undefined || !isFinite(number) || number < 0) throw new Error('计数返回无效结果');
        return number;
    }
    for (var offset = 0; offset < specs.length; offset += 64) {
        var batch = [], slice = specs.slice(offset, offset + 64);
        for (var si = 0; si < slice.length; si++) batch.push({ FormEngineKey: slice[si].FormEngineKey, _SysMenuId: slice[si]._SysMenuId, _Where: slice[si]._Where });
        if (typeof V8.FormEngine.GetTableDataCountBatch === 'function') {
            var counted = V8.FormEngine.GetTableDataCountBatch(batch);
            if (!counted || Number(counted.Code) !== 1) throw new Error('菜单范围计数失败');
            var counts = array(counted.Data), seen = {};
            for (var ci = 0; ci < counts.length; ci++) {
                var item = counts[ci], index = Number(item.Index);
                if (Number(item.Code) !== 1 || !isFinite(index) || index % 1 !== 0 || index < 0 || index >= slice.length || seen['$' + index])
                    throw new Error('批量计数返回缺失、重复或失败项');
                seen['$' + index] = true; values[slice[index].Signature] = countNumber(item.Count);
            }
            if (counts.length !== slice.length) throw new Error('批量计数结果不完整');
        } else {
            for (var fi = 0; fi < slice.length; fi++) {
                var single = V8.FormEngine.GetTableDataCount(slice[fi].FormEngineKey, { _SysMenuId: slice[fi]._SysMenuId, _Where: slice[fi]._Where });
                if (!single || Number(single.Code) !== 1) throw new Error('菜单范围计数失败');
                var count = single.DataCount !== undefined ? single.DataCount : single.Count !== undefined ? single.Count : single.Data;
                values[slice[fi].Signature] = countNumber(count);
            }
        }
    }
    var results = Object.create(null), processed = 0;
    for (var oi = 0; oi < plans.length; oi++) {
        var p = plans[oi], result = p.Result;
        if (result.Configured) {
            result.Value = result.Count = p.Count === null ? null : values[p.Count];
            result.Total = p.Total === null ? null : values[p.Total];
            result.MenuCountAvailable = p.Count !== null;
            for (var button in p.Buttons) if (own(p.Buttons, button) && p.Buttons[button] !== null) result.Buttons[button] = values[p.Buttons[button]];
            for (var metricName in p.Metrics) if (own(p.Metrics, metricName) && p.Metrics[metricName] !== null) result.Metrics[metricName] = values[p.Metrics[metricName]];
        }
        if (!batched) return { Code: 1, Data: result };
        if (p.Id && !own(results, p.Id)) { results[p.Id] = result; processed++; }
    }
    return { Code: 1, Data: { Menus: results, Count: processed, Batched: true } };
} catch (error) {
    return { Code: 0, Msg: '模块统计失败：' + String(error && error.message || error) };
}
