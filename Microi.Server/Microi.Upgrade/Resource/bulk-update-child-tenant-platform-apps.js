/*
 * ApiEngineKey: bulk-update-child-tenant-platform-apps
 * Version: v1.1.5
 * 主租户编排器：按当前运行环境的 SaaS 目录，为每个启用的子租户创建一个
 * “安装/更新全部平台应用”持久后台任务。租户识别和目标任务投递由可信 C# 原子完成。
 */
// CHILD_PLATFORM_APP_BOOTSTRAP_V1：投递原子会先补齐目标租户运行时物理前置列及固定商城工作器。
// CHILD_TASK_TERMINAL_AGGREGATION_V1：父任务持续汇总全部子任务终态，只有全部成功才成功。
// CHILD_TASK_AGGREGATE_PROGRESS_V1：后台任务 Current/Total 固定为百分比单位，避免排队数量把父任务提前推到 99%。
function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}
function toInt(value, fallback) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}
function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    var result = [];
    if (typeof value.length == 'number') {
        for (var i = 0; i < value.length; i++) result.push(value[i]);
    }
    return result;
}
function parseObject(value) {
    if (!value) return {};
    if (typeof value == 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return {}; }
}
function report(progress, current, total, message) {
    if (!V8.Method || !V8.Method.UpdateBackgroundTask) return;
    var normalizedProgress = Math.max(0, Math.min(100, toInt(progress, 0)));
    V8.Method.UpdateBackgroundTask({
        _BackgroundTaskId: taskId,
        Progress: normalizedProgress,
        Current: normalizedProgress,
        Total: 100,
        Msg: message,
        Message: message
    });
}
function continuation(checkpoint, progress, current, total, message, nextDelaySeconds) {
    var normalizedProgress = Math.max(0, Math.min(100, toInt(progress, 0)));
    var result = {
        Code: 1,
        Data: {
            BackgroundTask: {
                HasMore: true,
                Checkpoint: checkpoint,
                Progress: normalizedProgress,
                Current: normalizedProgress,
                Total: 100,
                Msg: message
            }
        },
        Msg: message
    };
    if (toInt(nextDelaySeconds, 0) > 0) {
        result.Data.BackgroundTask.NextDelaySeconds = toInt(nextDelaySeconds, 0);
    }
    return result;
}

var currentUser = V8.CurrentUser || {};
if (!currentUser.Id || toInt(currentUser.Level, 0) < 9999) {
    return { Code: 0, Msg: '只有主租户 Level >= 9999 的超级管理员可以执行该操作。' };
}

var taskId = text(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId);
var taskEnvelope = V8.Param._BackgroundTask || {};
var fencingToken = V8.Param._BackgroundTaskFencingToken;
var trustedInvocation = V8.Param._TrustedServerInvocation === true
    || text(V8.Param._TrustedServerInvocation).toLowerCase() == 'true';
if (!trustedInvocation
    || !taskId
    || text(taskEnvelope.Id) != taskId
    || toInt(fencingToken, 0) <= 0) {
    return { Code: 0, Msg: '该操作必须通过主租户持久后台任务执行。' };
}

var checkpoint = parseObject(V8.Param._BackgroundTaskCheckpoint);
if (checkpoint.TaskId && text(checkpoint.TaskId) != taskId) checkpoint = {};
var phase = text(checkpoint.Phase || 'Queue');
var targets = [];
// CHILD_TASK_MONITOR_CHECKPOINT_ONLY_V1：租户发现与工作器自举只允许发生在 Queue。
// Monitor 必须只汇总已经持久化的 ChildTasks，避免运行中再次读取目录或修复工作器，
// 让无关的租户配置/源码格式差异把已经正常执行的整批任务误判成失败。
if (phase == 'Queue') {
    var executionParam = {
        _BackgroundTaskId: taskId,
        _BackgroundTaskFencingToken: fencingToken
    };
    var targetsResult = V8.Method.GetChildTenantPlatformAppMaintenanceTargets(executionParam);
    if (!targetsResult || targetsResult.Code != 1) {
        return {
            Code: 0,
            Msg: '读取子租户目录失败：' + ((targetsResult && targetsResult.Msg) || '服务无返回')
        };
    }
    targets = toArray(targetsResult.Data && targetsResult.Data.Targets);
}
var attemptedTargets = toArray(checkpoint.AttemptedTargets).map(function (item) {
    return text(item).toLowerCase();
});
var attemptedMap = {};
for (var attemptedIndex = 0; attemptedIndex < attemptedTargets.length; attemptedIndex++) {
    attemptedMap[attemptedTargets[attemptedIndex]] = true;
}
var failures = toArray(checkpoint.Failures);
var childTasks = toArray(checkpoint.ChildTasks);

if (phase == 'Queue') {
    var batchSize = 20;
    var processedThisSlice = 0;
    for (var targetIndex = 0; targetIndex < targets.length && processedThisSlice < batchSize; targetIndex++) {
        var target = targets[targetIndex] || {};
        var targetOsClient = text(target.OsClient);
        var targetName = text(target.Name || targetOsClient);
        var targetKey = targetOsClient.toLowerCase();
        if (!targetKey || attemptedMap[targetKey]) continue;

        var queued = V8.Method.QueueChildTenantPlatformAppMaintenance({
            _BackgroundTaskId: taskId,
            _BackgroundTaskFencingToken: fencingToken,
            TargetOsClient: targetOsClient
        });
        attemptedMap[targetKey] = true;
        attemptedTargets.push(targetKey);
        processedThisSlice++;
        if (!queued || queued.Code != 1 || !queued.Data || !text(queued.Data.TaskId)) {
            failures.push({
                OsClient: targetOsClient,
                Name: targetName,
                Msg: (queued && queued.Msg) || '任务投递无返回'
            });
        } else {
            childTasks.push({
                OsClient: targetOsClient,
                Name: targetName,
                TaskId: text(queued.Data.TaskId)
            });
        }
        var queuedProgress = targets.length <= 0
            ? 5
            : Math.max(1, Math.min(5, Math.floor(attemptedTargets.length * 5 / targets.length)));
        report(
            queuedProgress,
            attemptedTargets.length,
            targets.length,
            '正在创建子租户平台应用维护任务：' + attemptedTargets.length + '/' + targets.length
        );
    }

    var remaining = 0;
    for (var remainingIndex = 0; remainingIndex < targets.length; remainingIndex++) {
        var remainingKey = text(targets[remainingIndex] && targets[remainingIndex].OsClient).toLowerCase();
        if (remainingKey && !attemptedMap[remainingKey]) remaining++;
    }
    if (remaining > 0) {
        return continuation({
            Version: 2,
            TaskId: taskId,
            Phase: 'Queue',
            AttemptedTargets: attemptedTargets,
            ChildTasks: childTasks,
            Failures: failures
        }, Math.max(1, Math.min(5, Math.floor(attemptedTargets.length * 5 / targets.length))),
        attemptedTargets.length, targets.length,
        '已创建 ' + childTasks.length + ' 个子租户任务，继续处理剩余 ' + remaining + ' 个租户');
    }

    if (failures.length > 0) {
        var queueFailureDetail = failures.slice(0, 5).map(function (item) {
            return text(item.Name || item.OsClient) + '：' + text(item.Msg || '未知错误');
        }).join('；');
        var queueFailureMessage = '子租户任务投递失败：成功 ' + childTasks.length
            + '，失败 ' + failures.length + (queueFailureDetail ? '。' + queueFailureDetail : '');
        report(5, attemptedTargets.length, targets.length, queueFailureMessage);
        return {
            Code: 0,
            Data: {
                FailureStage: 'Queue',
                TargetCount: targets.length,
                QueuedCount: childTasks.length,
                FailedCount: failures.length,
                Failures: failures
            },
            Msg: queueFailureMessage
        };
    }

    if (childTasks.length <= 0) {
        report(100, 0, 0, '当前运行环境没有需要维护的子租户');
        return {
            Code: 1,
            Data: { TargetCount: 0, SucceededCount: 0, FailedCount: 0, Results: [] },
            Msg: '当前运行环境没有启用的子租户。'
        };
    }

    return continuation({
        Version: 2,
        TaskId: taskId,
        Phase: 'Monitor',
        AttemptedTargets: attemptedTargets,
        ChildTasks: childTasks,
        Failures: []
    }, 5, 0, childTasks.length,
    '已创建全部 ' + childTasks.length + ' 个子租户任务，开始汇总实际安装进度', 2);
}

if (phase != 'Monitor') {
    return { Code: 0, Msg: '未知的子租户批量维护检查点阶段：' + phase };
}

var taskIds = childTasks.map(function (item) { return text(item && item.TaskId); })
    .filter(function (value) { return !!value; });
var childRowsResult = V8.FormEngine.GetTableData('mci_background_task', {
    Ids: taskIds,
    _SelectFields: ['Id', 'Status', 'Progress', 'Msg', 'ResultJson', 'UpdateTime'],
    _PageIndex: 1,
    _PageSize: Math.max(20, taskIds.length)
});
if (!childRowsResult || childRowsResult.Code != 1) {
    return {
        Code: 0,
        Data: { FailureStage: 'MonitorReadback' },
        Msg: '读取子租户后台任务终态失败：' + ((childRowsResult && childRowsResult.Msg) || '服务无返回')
    };
}

var childRows = toArray(childRowsResult.Data);
var childRowMap = {};
for (var childRowIndex = 0; childRowIndex < childRows.length; childRowIndex++) {
    var childRow = childRows[childRowIndex] || {};
    childRowMap[text(childRow.Id)] = childRow;
}

var succeeded = [];
var terminalFailures = [];
var runningCount = 0;
var progressTotal = 0;
for (var childIndex = 0; childIndex < childTasks.length; childIndex++) {
    var childTask = childTasks[childIndex] || {};
    var childTaskId = text(childTask.TaskId);
    var row = childRowMap[childTaskId];
    if (!row) {
        terminalFailures.push({
            OsClient: text(childTask.OsClient),
            Name: text(childTask.Name),
            TaskId: childTaskId,
            Status: 'Missing',
            Msg: '主租户后台任务中心未回读到该子任务'
        });
        continue;
    }
    var childStatus = text(row.Status);
    var childProgress = Math.max(0, Math.min(100, toInt(row.Progress, 0)));
    progressTotal += childProgress;
    if (childStatus == 'Succeeded') {
        succeeded.push({
            OsClient: text(childTask.OsClient),
            Name: text(childTask.Name),
            TaskId: childTaskId,
            Status: childStatus,
            Progress: childProgress,
            Msg: text(row.Msg)
        });
    } else if (childStatus == 'Failed' || childStatus == 'Canceled') {
        terminalFailures.push({
            OsClient: text(childTask.OsClient),
            Name: text(childTask.Name),
            TaskId: childTaskId,
            Status: childStatus,
            Progress: childProgress,
            Msg: text(row.Msg)
        });
    } else {
        runningCount++;
    }
}

var terminalCount = succeeded.length + terminalFailures.length;
var aggregateProgress = childTasks.length > 0
    ? Math.max(5, Math.min(99, 5 + Math.floor(94 * progressTotal / (100 * childTasks.length))))
    : 100;
var monitorMessage = '子租户安装进度：成功 ' + succeeded.length
    + '，失败 ' + terminalFailures.length + '，进行中 ' + runningCount
    + '（' + terminalCount + '/' + childTasks.length + '）';
report(aggregateProgress, terminalCount, childTasks.length, monitorMessage);

if (runningCount > 0) {
    return continuation({
        Version: 2,
        TaskId: taskId,
        Phase: 'Monitor',
        AttemptedTargets: attemptedTargets,
        ChildTasks: childTasks,
        Failures: terminalFailures
    }, aggregateProgress, terminalCount, childTasks.length, monitorMessage, 3);
}

if (terminalFailures.length > 0) {
    return {
        Code: 0,
        Data: {
            FailureStage: 'ChildTerminal',
            TargetCount: childTasks.length,
            SucceededCount: succeeded.length,
            FailedCount: terminalFailures.length,
            Results: succeeded,
            Failures: terminalFailures
        },
        Msg: '全部子租户任务已结束：成功 ' + succeeded.length
            + '，失败 ' + terminalFailures.length + '。请按失败租户详情修复后重新发起。'
    };
}

report(100, childTasks.length, childTasks.length,
    '全部 ' + childTasks.length + ' 个子租户平台应用均已安装/更新成功');
return {
    Code: 1,
    Data: {
        TargetCount: childTasks.length,
        SucceededCount: succeeded.length,
        FailedCount: 0,
        Results: succeeded
    },
    Msg: '全部 ' + childTasks.length + ' 个子租户平台应用均已安装/更新成功。'
};
