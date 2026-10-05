// 系统日志/监控统一写接口（Managed）。接口引擎只做动作白名单，租户、操作者、
// IP 校验、权限复核与审计全部由可信 V8 原子方法决定。
var p = V8.Param || {};
var action = String(p.Action || "");

var legacyMenuContracts = [
    { Id: "fe06ab66-7a10-4f3c-bced-523605f4c65e", Name: "系统日志", Url: "/syslog" },
    { Id: "01KMQNYHKVGTT7TDSQZ8A9HAFF", Name: "系统监控", Url: "/mic-system-monitor" },
    { Id: "01KW6Q2V343B07RWR28NAPJTJW", Name: "安全访问日志", Url: "/mci-security-access-log" },
    { Id: "01KW6Q2TF6Q8T8X4DEH87HQT5N", Name: "恶意攻击事件", Url: "/mci-security-attack-event" },
    { Id: "01KW6Q2TT4W3YPDQ06T8X1PXPC", Name: "IP封锁记录", Url: "/mci-security-ip-block" }
];

function getObservability(args) {
    try {
        return V8.Method.GetSystemObservability(args);
    } catch (e) {
        var message = String(e && e.message ? e.message : e || "");
        if (message.indexOf("GetSystemObservability") >= 0) {
            return { Code: 0, Msg: "当前后端版本缺少系统观测原子能力，请先升级到 v7.5.8 或更高版本。" };
        }
        return { Code: 0, Msg: "系统观测权限校验失败，请查看服务端系统日志。" };
    }
}

function manageObservability(args) {
    try {
        return V8.Method.ManageSystemObservability(args);
    } catch (e) {
        var message = String(e && e.message ? e.message : e || "");
        if (message.indexOf("ManageSystemObservability") >= 0) {
            return { Code: 0, Msg: "当前后端版本缺少系统观测原子能力，请先升级到 v7.5.8 或更高版本。" };
        }
        return { Code: 0, Msg: "系统观测操作失败，请查看服务端系统日志。" };
    }
}

function retireLegacyMenus() {
    var authority = getObservability({
        Action: "Snapshot",
        IncludeHost: false,
        WindowMinutes: 1,
        Top: 1
    });
    if (!authority || authority.Code != 1) return authority || { Code: 0, Msg: "平台管理员权限校验失败。" };

    var ids = [];
    for (var i = 0; i < legacyMenuContracts.length; i++) ids.push(legacyMenuContracts[i].Id);
    var result = V8.FormEngine.GetTableData("sys_menu", {
        Ids: ids,
        _SelectFields: ["Id", "Name", "Url"],
        _PageIndex: 1,
        _PageSize: legacyMenuContracts.length
    });
    if (!result || result.Code != 1) return result || { Code: 0, Msg: "读取旧菜单失败。" };

    var rows = result.Data || [];
    var matchedIds = [];
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        var row = rows[rowIndex];
        var contract = null;
        for (var contractIndex = 0; contractIndex < legacyMenuContracts.length; contractIndex++) {
            if (String(legacyMenuContracts[contractIndex].Id) == String(row.Id)) {
                contract = legacyMenuContracts[contractIndex];
                break;
            }
        }
        if (!contract || String(row.Name || "") != contract.Name || String(row.Url || "") != contract.Url) {
            return { Code: 0, Msg: "检测到旧菜单标识已被租户改作其它用途，已停止迁移，请人工核对。" };
        }
        matchedIds.push(String(row.Id));
    }

    if (matchedIds.length == 0) {
        return { Code: 1, Data: { Planned: 0, Deleted: 0, NoOp: true }, Msg: "旧菜单已完成合并，无需重复处理。" };
    }

    var deleteResult = V8.FormEngine.DelFormData("sys_menu", { Ids: matchedIds });
    if (!deleteResult || deleteResult.Code != 1) return deleteResult || { Code: 0, Msg: "删除旧菜单失败。" };

    try {
        V8.Method.AddSysLog({
            Type: "系统日志/监控",
            Title: "完成旧菜单合并",
            Content: "已软删除 " + matchedIds.length + " 个官方标准旧菜单。",
            Level: 1
        });
        V8.Method.RefreshLoginUser(V8.CurrentUser.Id, V8.OsClient);
    } catch (ignored) {}

    return {
        Code: 1,
        Data: { Planned: matchedIds.length, Deleted: matchedIds.length, NoOp: false },
        Msg: "旧菜单已完成合并，请刷新平台菜单。"
    };
}

if (action == "RetireLegacyMenus") {
    return retireLegacyMenus();
}

if (action != "BlockIp" && action != "UnblockIp") {
    return { Code: 0, Msg: "只允许 BlockIp、UnblockIp 或 RetireLegacyMenus。" };
}
return manageObservability({
    Action: action,
    Ip: p.Ip,
    BlockMinutes: p.BlockMinutes,
    Reason: p.Reason
});
