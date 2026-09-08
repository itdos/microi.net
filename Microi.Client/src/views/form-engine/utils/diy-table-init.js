export function scheduleTableInit(context, args) {
    if (!context || typeof context.Init !== "function") {
        return Promise.resolve();
    }

    context._pendingTableInitArgs = Array.isArray(args) ? args : [];
    if (context._tableInitScheduled) {
        return context._tableInitPromise || Promise.resolve();
    }

    context._tableInitScheduled = true;
    var run = async function() {
        context._tableInitScheduled = false;
        var pendingArgs = context._pendingTableInitArgs || [];
        context._pendingTableInitArgs = null;
        if (context._isDestroyed || context._isBeingDestroyed || context.ParentFormLoadFinish === false) {
            return;
        }
        return context.Init.apply(context, pendingArgs);
    };

    context._tableInitPromise = typeof context.$nextTick === "function"
        ? context.$nextTick(run)
        : Promise.resolve().then(run);
    return context._tableInitPromise;
}

// 左右树表切换的是同一模块的过滤条件，不应重新加载所有字段数据源。
// 同一轮父记录/PropsWhere 变更合并为一次查询，沿用列表请求的取消和版本保护。
export function scheduleTableFilterReload(context) {
    if (!context.PropsFilterReloadOnly) return context.ScheduleInit();
    if (context._tableFilterReloadScheduled) return context._tableFilterReloadPromise;
    context._tableFilterReloadScheduled = true;
    const run = () => {
        context._tableFilterReloadScheduled = false;
        if (context._isDestroyed || context._isBeingDestroyed || context.ParentFormLoadFinish === false) return;
        // 首次元数据加载完成后会按最新 props 查询，不能再次启动并行 Init。
        if (context.moduleShellLoading || !context.SysMenuModel?.Id) return;
        context.TableMultipleSelection = [];
        return context.GetDiyTableRow({ _PageIndex: 1 });
    };
    context._tableFilterReloadPromise = typeof context.$nextTick === "function"
        ? context.$nextTick(run) : Promise.resolve().then(run);
    return context._tableFilterReloadPromise;
}
