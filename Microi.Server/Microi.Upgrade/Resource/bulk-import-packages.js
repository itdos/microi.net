/*
 * V8 ApiEngine
 * ApiEngineKey: bulk-import-microi-store-packages
 * Version: v1.1.1
 * Function:
 * - 只规划并安装“未安装/可更新”应用，绝不重新安装已是最新版的应用。
 * - 计划和子检查点写入后台任务 CheckpointJson，支持多节点租约转移、进程重启和幂等重试。
 */

// BACKGROUND_TASK_CHECKPOINT_PLAN_V2：应用商城批量计划只依赖平台已有的
// mci_background_task.CheckpointJson，不要求目标租户预先安装额外业务表。
// BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1：旧版后端需要 StopHttp=0 才能进入本引擎，
// 但 HTTP 控制器会剥离可信标记；这里再同时校验任务 Id、信封和 fencing token，
// 普通 HTTP 即使伪造任务参数也不能执行批量安装。
function text(value, fallback) {
    return value === null || value === undefined ? (fallback || '') : String(value);
}
function trim(value) {
    return text(value).replace(/^\s+|\s+$/g, '');
}
function toArray(value) {
    var result = [];
    if (!value || value.length === undefined) return result;
    for (var i = 0; i < value.length; i++) result.push(value[i]);
    return result;
}
function parseJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value == 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return fallback; }
}
function toInt(value, fallback) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? (fallback || 0) : parsed;
}

var currentUser = V8.CurrentUser || {};
var level = parseInt(currentUser.Level || 0, 10);
if (isNaN(level) || level < 9999) {
    return { Code: 0, Msg: '权限不足：只有超级管理员才能执行全部安装/更新。' };
}

var taskId = trim(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId);
var taskEnvelope = V8.Param._BackgroundTask || {};
var fencingToken = V8.Param._BackgroundTaskFencingToken;
var trustedInvocation = V8.Param._TrustedServerInvocation === true
    || String(V8.Param._TrustedServerInvocation || '').toLowerCase() == 'true';
var trustedBackground = trustedInvocation
    && !!taskId
    && text(taskEnvelope.Id) == taskId
    && fencingToken !== null
    && fencingToken !== undefined
    && toInt(fencingToken, 0) > 0;
if (!trustedBackground) {
    return { Code: 0, Msg: '全部安装/更新必须通过持久化后台任务执行。' };
}

var checkpoint = parseJson(V8.Param._BackgroundTaskCheckpoint, {}) || {};
if (checkpoint.TaskId && text(checkpoint.TaskId) != taskId) checkpoint = {};
var phase = text(checkpoint.Phase, 'Discover');
var sourceApiBase = trim(
    checkpoint.SourceApiBase
    || V8.Param.StoreApiBase
    || V8.Param.AppStoreApiBase
    || 'https://api.itdos.com'
).replace(/\/+$/, '');
var sourceOsClient = trim(
    checkpoint.SourceOsClient
    || V8.Param.StoreOsClient
    || V8.Param.AppStoreOsClient
    || 'iTdos'
);
var pageSize = 100;

function report(progress, current, total, message) {
    if (!V8.Method || !V8.Method.UpdateBackgroundTask) return;
    V8.Method.UpdateBackgroundTask({
        _BackgroundTaskId: taskId,
        Progress: progress,
        Current: current,
        Total: total,
        Msg: message,
        Message: message
    });
}
function continuation(nextCheckpoint, progress, current, total, message) {
    return {
        Code: 1,
        Data: {
            BackgroundTask: {
                HasMore: true,
                Checkpoint: nextCheckpoint,
                Progress: progress,
                Current: current,
                Total: total,
                Msg: message
            }
        },
        Msg: message
    };
}
function loadInstalledVersions() {
    try {
        var result = V8.FormEngine.GetTableData('sys_microistoreversion', {
            _SelectFields: ['Id', 'StoreId', 'AppId', 'AppName', 'AppVersion', 'AppVersionInstall', 'InstallStatus'],
            _PageIndex: 1,
            _PageSize: 5000
        });
        return result && result.Code == 1 ? toArray(result.Data) : [];
    } catch (error) {
        return [];
    }
}
function planItemKey(item) {
    return trim(item && (item.StoreId || item.AppId)).toLowerCase();
}
function normalizePlan(value) {
    var source = toArray(value);
    var result = [];
    var seen = {};
    for (var i = 0; i < source.length; i++) {
        var item = source[i] || {};
        var key = planItemKey(item);
        if (!key || seen[key]) continue;
        seen[key] = true;
        result.push({
            StoreId: trim(item.StoreId),
            AppId: trim(item.AppId),
            AppName: trim(item.AppName || item.Name || item.AppId || item.StoreId),
            AppVersion: trim(item.AppVersion || item.Version),
            InstallAction: text(item.InstallAction) == 'Update' ? 'Update' : 'Install'
        });
    }
    return result;
}
function appendPlanRows(plan, rows) {
    var seen = {};
    for (var p = 0; p < plan.length; p++) seen[planItemKey(plan[p])] = true;
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        var row = rows[rowIndex] || {};
        var status = text(row.StoreInstallStatus);
        if (status != 'Uninstalled' && status != 'Outdated') continue;
        var storeId = trim(row.StoreId || row.Id);
        var appId = trim(row.AppId || row.AppKey || storeId);
        var key = trim(storeId || appId).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        plan.push({
            StoreId: storeId,
            AppId: appId,
            AppName: trim(row.AppName || row.Name || appId),
            AppVersion: trim(row.AppVersion || row.Version),
            InstallAction: status == 'Outdated' ? 'Update' : 'Install'
        });
    }
}

if (phase == 'Discover') {
    var pageIndex = Math.max(1, toInt(checkpoint.PageIndex, 1));
    var plan = normalizePlan(checkpoint.Plan);
    var installedVersions = loadInstalledVersions();
    report(1, pageIndex - 1, null, '正在盘点商城中未安装和可更新的应用');
    var listResult = V8.Http.Post({
        Url: sourceApiBase + '/apiengine/get-microi-store-list?OsClient=' + encodeURIComponent(sourceOsClient),
        PostParam: {
            _PageIndex: pageIndex,
            _PageSize: pageSize,
            InstalledVersions: installedVersions
        },
        ParamType: 'json',
        Timeout: 120
    });
    listResult = parseJson(listResult, listResult);
    if (!listResult || listResult.Code != 1) {
        return { Code: 0, Msg: '读取应用商城批量安装计划失败：' + ((listResult && listResult.Msg) || '接口无返回') };
    }

    var rows = toArray(listResult.Data);
    appendPlanRows(plan, rows);
    var dataCount = toInt(listResult.DataCount, rows.length);
    if (pageIndex * pageSize < dataCount) {
        return continuation({
            Version: 2,
            TaskId: taskId,
            Phase: 'Discover',
            PageIndex: pageIndex + 1,
            Plan: plan,
            SourceApiBase: sourceApiBase,
            SourceOsClient: sourceOsClient
        }, 2, pageIndex * pageSize, dataCount, '商城应用盘点已完成一页，将从后台任务检查点继续');
    }

    if (plan.length <= 0) {
        report(100, 0, 0, '所有应用均已是最新版，无需安装或更新');
        return {
            Code: 1,
            Data: { Planned: 0, Installed: 0, Updated: 0, SkippedInstalled: dataCount },
            Msg: '所有应用均已是最新版，无需安装或更新。'
        };
    }
    return continuation({
        Version: 2,
        TaskId: taskId,
        Phase: 'Install',
        CurrentIndex: 0,
        Installed: 0,
        Updated: 0,
        ChildCheckpoint: {},
        Plan: plan,
        SourceApiBase: sourceApiBase,
        SourceOsClient: sourceOsClient
    }, 3, 0, plan.length, '批量安装计划已写入后台任务检查点，开始逐个安装/更新');
}

if (phase != 'Install') {
    return { Code: 0, Msg: '未知的批量安装检查点阶段：' + phase };
}

var installPlan = normalizePlan(checkpoint.Plan);
var currentIndex = Math.max(0, toInt(checkpoint.CurrentIndex, 0));
var installedCount = Math.max(0, toInt(checkpoint.Installed, 0));
var updatedCount = Math.max(0, toInt(checkpoint.Updated, 0));
var total = installPlan.length;
if (currentIndex >= total) {
    report(100, total, total, '全部安装/更新任务已完成');
    return {
        Code: 1,
        Data: { Planned: total, Completed: total, Installed: installedCount, Updated: updatedCount },
        Msg: '全部安装/更新任务已完成。'
    };
}

var item = installPlan[currentIndex];
var childCheckpoint = parseJson(checkpoint.ChildCheckpoint, {}) || {};
var childParam = {
    StoreId: item.StoreId,
    AppId: item.AppId,
    AppName: item.AppName,
    AppVersion: item.AppVersion,
    StoreApiBase: sourceApiBase,
    StoreOsClient: sourceOsClient,
    ResumeInstall: true,
    InstallAction: item.InstallAction,
    InstallOperationId: taskId + ':' + (item.StoreId || item.AppId),
    BulkCurrentIndex: currentIndex,
    BulkTotal: total,
    _BackgroundTaskId: taskId,
    _BackgroundTask: taskEnvelope,
    _BackgroundTaskFencingToken: fencingToken,
    _BackgroundTaskCheckpoint: childCheckpoint,
    _TrustedServerInvocation: true
};
report(Math.max(3, Math.floor((currentIndex / total) * 100)), currentIndex, total,
    '[' + (currentIndex + 1) + '/' + total + '] 正在' + (item.InstallAction == 'Update' ? '更新' : '安装') + item.AppName);
var childResult = V8.ApiEngine.Run('import-microi-store-package', childParam);
if (!childResult || childResult.Code != 1) {
    return {
        Code: 0,
        Msg: '应用【' + item.AppName + '】安装/更新失败：' + ((childResult && childResult.Msg) || '子安装接口无返回')
    };
}

var childBackground = childResult.Data && childResult.Data.BackgroundTask;
if (childBackground && childBackground.HasMore === true) {
    var childProgress = toInt(childBackground.Progress, 0);
    var overallProgress = Math.max(3, Math.min(99,
        Math.floor(((currentIndex + childProgress / 100) / total) * 100)));
    return continuation({
        Version: 2,
        TaskId: taskId,
        Phase: 'Install',
        CurrentIndex: currentIndex,
        Installed: installedCount,
        Updated: updatedCount,
        ChildCheckpoint: childBackground.Checkpoint || {},
        Plan: installPlan,
        SourceApiBase: sourceApiBase,
        SourceOsClient: sourceOsClient
    }, overallProgress, currentIndex + childProgress / 100, total,
    '[' + (currentIndex + 1) + '/' + total + '] ' + (childBackground.Msg || '应用安装分片已提交'));
}

if (item.InstallAction == 'Update') updatedCount++;
else installedCount++;
currentIndex++;
return continuation({
    Version: 2,
    TaskId: taskId,
    Phase: 'Install',
    CurrentIndex: currentIndex,
    Installed: installedCount,
    Updated: updatedCount,
    ChildCheckpoint: {},
    Plan: installPlan,
    SourceApiBase: sourceApiBase,
    SourceOsClient: sourceOsClient
}, Math.min(99, Math.floor((currentIndex / total) * 100)), currentIndex, total,
'已完成【' + item.AppName + '】，继续处理剩余应用');
