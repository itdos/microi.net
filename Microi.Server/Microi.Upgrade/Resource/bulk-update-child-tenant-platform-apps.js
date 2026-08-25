/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：bulk-update-child-tenant-platform-apps
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * ApiEngineKey: bulk-update-child-tenant-platform-apps
 * Version: v1.2.8
 * 主租户编排器：按当前运行环境的 SaaS 目录，为每个启用的子租户创建一个
 * “安装/更新全部平台应用”持久后台任务。租户识别和目标任务投递由可信 C# 原子完成。
 */
// CHILD_PLATFORM_APP_BOOTSTRAP_V1：投递原子会先补齐目标租户运行时物理前置列及固定商城工作器。
// CHILD_TASK_TERMINAL_AGGREGATION_V1：父任务持续汇总全部子任务终态，只有全部成功才成功。
// CHILD_TASK_AGGREGATE_PROGRESS_V1：后台任务 Current/Total 固定为百分比单位，避免排队数量把父任务提前推到 99%。
// CHILD_TASK_PARTIAL_QUEUE_MONITOR_V1：单个租户投递失败不提前终止，继续监控全部已投递子任务并合并终态。
// CHILD_TASK_RUNTIME_RELOAD_FALLBACK_V1：兼容尚未升级控制面 C# 的节点，遇到未加载 OsClient 时受控重载后重试。
// CHILD_STARTUP_SCOPE_CHILD_PARAM_PATCH_V1：兼容滚动发布中的旧控制面节点；事故恢复任务入队后，
// 在父任务事务提交前强制写入并回读子任务范围，写入失败时先请求取消，绝不退化为全量安装。
// CHILD_STARTUP_NO_REQUEUE_REFRESH_V1：后台任务每个分片都会按 ApiEngineKey 读取当前最新工作器源码，
// 因此在途父任务升级后只迁移检查点并继续监控原 ChildTasks；严禁再次调用投递原子“刷新”工作器，
// 避免历史任务幂等键格式变化时创建第二批安装任务。旧 RefreshBootstrap 检查点也只归一化回 Monitor。
// CHILD_STARTUP_TARGET_FILTER_V1：受信 StartupDependencies 后台任务可以显式限定目标租户集合，
// 用于只修复单个历史租户；目标必须来自当前运行环境的权威子租户目录，缺失或越界时失败关闭。
var startupBootstrapRevision = 'startup-api-live-worker-v6-no-requeue';
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
function missingRuntimeOsClient(message) {
    var match = /未找到OsClient[：:]\s*([A-Za-z0-9._-]{1,100})/.exec(text(message));
    return match ? text(match[1]) : '';
}
function discoverTargetsWithRuntimeRecovery(executionParam) {
    var recovered = {};
    for (var attempt = 0; attempt < 500; attempt++) {
        var result = V8.Method.GetChildTenantPlatformAppMaintenanceTargets(executionParam);
        if (result && result.Code == 1) return result;
        var missingOsClient = missingRuntimeOsClient(result && result.Msg);
        var missingKey = missingOsClient.toLowerCase();
        if (!missingKey || recovered[missingKey] || !V8.Method.ReloadOsClient) return result;
        recovered[missingKey] = true;
        var reload = V8.Method.ReloadOsClient(missingOsClient);
        if (!reload || reload.Code != 1) {
            return {
                Code: 0,
                Msg: '自动重载子租户 ' + missingOsClient + ' 失败：'
                    + ((reload && reload.Msg) || '服务无返回')
            };
        }
    }
    return { Code: 0, Msg: '子租户运行时自动重载超过500个安全上限。' };
}
function cancelUnsafeChildTask(taskIdValue, reason) {
    var cancelMessage = '启动依赖范围校验失败，已停止任务：' + text(reason || '未知错误');
    try {
        V8.Db.FromSql(
            "UPDATE mci_background_task SET CancelRequested=1, "
            + "Status=CASE WHEN Status='Pending' THEN 'Canceled' ELSE Status END, "
            + "StatusText=CASE WHEN Status='Pending' THEN '已停止' ELSE StatusText END, "
            + 'Msg=@p0 WHERE Id=@p1 AND Status NOT IN (\'Succeeded\',\'Failed\',\'Canceled\')'
        ).AddInParameter('@p0', cancelMessage)
            .AddInParameter('@p1', taskIdValue)
            .ExecuteNonQuery();
    } catch (cancelError) {
        return cancelMessage + '；取消写入异常：' + text(cancelError && cancelError.message || cancelError);
    }
    return cancelMessage;
}
function enforceStartupDependencyScope(taskIdValue, targetOsClient, targetName) {
    var rowResult = V8.FormEngine.GetFormData('mci_background_task', {
        Id: taskIdValue,
        _SelectFields: ['Id', 'Title', 'Status', 'CancelRequested', 'ParamJson']
    });
    if (!rowResult || rowResult.Code != 1 || !rowResult.Data) {
        var missingMessage = '未读取到刚创建的子任务，无法确认启动依赖范围：'
            + ((rowResult && rowResult.Msg) || '服务无返回');
        cancelUnsafeChildTask(taskIdValue, missingMessage);
        return { Code: 0, Msg: missingMessage };
    }

    var childParam = parseObject(rowResult.Data.ParamJson);
    childParam.RequiredAppIds = ['app.microi.saas-engine'];
    childParam.MaintenanceScope = 'StartupDependencies';
    var scopedTitle = '恢复平台启动接口';
    var affected = 0;
    try {
        affected = toInt(V8.Db.FromSql(
            "UPDATE mci_background_task SET ParamJson=@p0, Title=@p1 "
            + "WHERE Id=@p2 AND Status='Pending' AND CancelRequested=0"
        ).AddInParameter('@p0', JSON.stringify(childParam))
            .AddInParameter('@p1', scopedTitle)
            .AddInParameter('@p2', taskIdValue)
            .ExecuteNonQuery(), 0);
    } catch (patchError) {
        var patchException = '写入子任务启动依赖范围异常：'
            + text(patchError && patchError.message || patchError);
        cancelUnsafeChildTask(taskIdValue, patchException);
        return { Code: 0, Msg: patchException };
    }
    if (affected != 1) {
        var stateMessage = '子任务已被其它节点领取或状态异常，未在 Pending 阶段写入启动依赖范围。';
        cancelUnsafeChildTask(taskIdValue, stateMessage);
        return { Code: 0, Msg: stateMessage };
    }

    var verifyResult = V8.FormEngine.GetFormData('mci_background_task', {
        Id: taskIdValue,
        _SelectFields: ['Id', 'Title', 'Status', 'CancelRequested', 'ParamJson']
    });
    var verifyRow = verifyResult && verifyResult.Data || {};
    var verifyParam = parseObject(verifyRow.ParamJson);
    var requiredAppIds = toArray(verifyParam.RequiredAppIds).map(function (item) {
        return text(item);
    }).filter(function (item) { return !!item; });
    var verified = verifyResult && verifyResult.Code == 1
        && text(verifyRow.Title) == scopedTitle
        && toInt(verifyRow.CancelRequested, 0) == 0
        && text(verifyParam.MaintenanceScope) == 'StartupDependencies'
        && requiredAppIds.length == 1
        && requiredAppIds[0] == 'app.microi.saas-engine';
    if (!verified) {
        var verifyMessage = '子任务启动依赖范围强回读不一致，拒绝继续：'
            + text(targetName || targetOsClient) + '（' + text(targetOsClient) + '）。';
        cancelUnsafeChildTask(taskIdValue, verifyMessage);
        return { Code: 0, Msg: verifyMessage };
    }
    return { Code: 1, Data: { TaskId: taskIdValue, RequiredAppIds: requiredAppIds } };
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
// CHILD_STARTUP_DEPENDENCY_INCIDENT_SCOPE_V1：常规按钮仍维护全部平台应用；
// 只有受信后台任务显式传 StartupDependencies 时，才将子任务收窄到
// SaaS 启动依赖，用于跨全部子租户的快速故障恢复。
var maintenanceScope = text(checkpoint.MaintenanceScope || V8.Param.MaintenanceScope);
if (maintenanceScope && maintenanceScope != 'StartupDependencies') {
    return { Code: 0, Msg: 'MaintenanceScope 仅支持 StartupDependencies。' };
}
var requestedTargetOsClients = toArray(
    checkpoint.TargetOsClients || V8.Param.TargetOsClients
).map(function (item) {
    return text(item);
}).filter(function (item) { return !!item; });
if (requestedTargetOsClients.length > 0 && maintenanceScope != 'StartupDependencies') {
    return { Code: 0, Msg: 'TargetOsClients 仅允许用于 StartupDependencies 事故恢复范围。' };
}
if (requestedTargetOsClients.length > 100) {
    return { Code: 0, Msg: 'TargetOsClients 最多允许 100 个目标租户。' };
}
var requestedTargetMap = {};
for (var requestedIndex = 0; requestedIndex < requestedTargetOsClients.length; requestedIndex++) {
    var requestedTarget = requestedTargetOsClients[requestedIndex];
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(requestedTarget)) {
        return { Code: 0, Msg: 'TargetOsClients 包含格式不正确的租户标识。' };
    }
    requestedTargetMap[requestedTarget.toLowerCase()] = true;
}
requestedTargetOsClients = Object.keys(requestedTargetMap);
var targets = [];
// CHILD_TASK_MONITOR_CHECKPOINT_ONLY_V1：租户发现与工作器自举只允许发生在 Queue。
// Monitor 必须只汇总已经持久化的 ChildTasks，避免运行中再次读取目录或修复工作器，
// 让无关的租户配置/源码格式差异把已经正常执行的整批任务误判成失败。
if (phase == 'Queue') {
    var executionParam = {
        _BackgroundTaskId: taskId,
        _BackgroundTaskFencingToken: fencingToken
    };
    var targetsResult = discoverTargetsWithRuntimeRecovery(executionParam);
    if (!targetsResult || targetsResult.Code != 1) {
        return {
            Code: 0,
            Msg: '读取子租户目录失败：' + ((targetsResult && targetsResult.Msg) || '服务无返回')
        };
    }
    targets = toArray(targetsResult.Data && targetsResult.Data.Targets);
    if (requestedTargetOsClients.length > 0) {
        var availableTargetMap = {};
        for (var availableIndex = 0; availableIndex < targets.length; availableIndex++) {
            var availableKey = text(targets[availableIndex] && targets[availableIndex].OsClient).toLowerCase();
            if (availableKey) availableTargetMap[availableKey] = true;
        }
        var missingRequestedTargets = requestedTargetOsClients.filter(function (item) {
            return !availableTargetMap[item];
        });
        if (missingRequestedTargets.length > 0) {
            return {
                Code: 0,
                Msg: '指定目标不属于当前运行环境、未启用或已经不是子租户：'
                    + missingRequestedTargets.join(',')
            };
        }
        targets = targets.filter(function (item) {
            return !!requestedTargetMap[text(item && item.OsClient).toLowerCase()];
        });
    }
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
var bootstrapRefreshFailures = [];

// 兼容 v1.2.1-v1.2.6 留下的 RefreshBootstrap 检查点。任务运行时会按
// ApiEngineKey 获取最新源码，所以这里只迁移状态，绝不再次投递子任务。
if (maintenanceScope == 'StartupDependencies'
    && (phase == 'RefreshBootstrap'
        || (phase == 'Monitor'
            && text(checkpoint.BootstrapRevision) != startupBootstrapRevision))) {
    phase = 'Monitor';
    checkpoint.BootstrapRevision = startupBootstrapRevision;
}

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
            TargetOsClient: targetOsClient,
            MaintenanceScope: maintenanceScope
        });
        if ((!queued || queued.Code != 1)
            && missingRuntimeOsClient(queued && queued.Msg)
            && V8.Method.ReloadOsClient) {
            var targetReload = V8.Method.ReloadOsClient(targetOsClient);
            if (targetReload && targetReload.Code == 1) {
                queued = V8.Method.QueueChildTenantPlatformAppMaintenance({
                    _BackgroundTaskId: taskId,
                    _BackgroundTaskFencingToken: fencingToken,
                    TargetOsClient: targetOsClient,
                    MaintenanceScope: maintenanceScope
                });
            } else {
                queued = {
                    Code: 0,
                    Msg: '自动重载目标租户失败：' + ((targetReload && targetReload.Msg) || '服务无返回')
                };
            }
        }
        attemptedMap[targetKey] = true;
        attemptedTargets.push(targetKey);
        processedThisSlice++;
        if (!queued || queued.Code != 1 || !queued.Data || !text(queued.Data.TaskId)) {
            failures.push({
                OsClient: targetOsClient,
                Name: targetName,
                Stage: 'Queue',
                Msg: (queued && queued.Msg) || '任务投递无返回'
            });
        } else {
            var queuedTaskId = text(queued.Data.TaskId);
            var scopePatch = maintenanceScope == 'StartupDependencies'
                ? enforceStartupDependencyScope(queuedTaskId, targetOsClient, targetName)
                : { Code: 1 };
            if (!scopePatch || scopePatch.Code != 1) {
                failures.push({
                    OsClient: targetOsClient,
                    Name: targetName,
                    TaskId: queuedTaskId,
                    Stage: 'ScopePatch',
                    Msg: (scopePatch && scopePatch.Msg) || '启动依赖范围写入无返回'
                });
            } else {
                childTasks.push({
                    OsClient: targetOsClient,
                    Name: targetName,
                    TaskId: queuedTaskId
                });
            }
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
            MaintenanceScope: maintenanceScope,
            TargetOsClients: requestedTargetOsClients,
            AttemptedTargets: attemptedTargets,
            ChildTasks: childTasks,
            Failures: failures
        }, Math.max(1, Math.min(5, Math.floor(attemptedTargets.length * 5 / targets.length))),
        attemptedTargets.length, targets.length,
        '已创建 ' + childTasks.length + ' 个子租户任务，继续处理剩余 ' + remaining + ' 个租户');
    }

    if (failures.length > 0 && childTasks.length <= 0) {
        var queueFailureDetail = failures.slice(0, 5).map(function (item) {
            return text(item.Name || item.OsClient) + '：' + text(item.Msg || '未知错误');
        }).join('；');
        var queueFailureMessage = '子租户任务投递失败：成功 ' + childTasks.length
            + '，失败 ' + failures.length + (queueFailureDetail ? '。' + queueFailureDetail : '');
        report(5, attemptedTargets.length, targets.length, queueFailureMessage);
        if (failures.some(function (item) { return text(item && item.Stage) == 'ScopePatch'; })) {
            return continuation({
                Version: 2,
                TaskId: taskId,
                Phase: 'Abort',
                MaintenanceScope: maintenanceScope,
                TargetOsClients: requestedTargetOsClients,
                AttemptedTargets: attemptedTargets,
                ChildTasks: [],
                Failures: failures
            }, 5, attemptedTargets.length, targets.length,
            queueFailureMessage + '。已持久化停止请求，下一片段确认失败终态。', 1);
        }
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
        Version: 3,
        TaskId: taskId,
        Phase: 'Monitor',
        MaintenanceScope: maintenanceScope,
        TargetOsClients: requestedTargetOsClients,
        BootstrapRevision: maintenanceScope == 'StartupDependencies'
            ? startupBootstrapRevision
            : '',
        AttemptedTargets: attemptedTargets,
        ChildTasks: childTasks,
        Failures: failures,
        BootstrapRefreshFailures: bootstrapRefreshFailures
    }, 5, 0, childTasks.length,
    '已创建 ' + childTasks.length + ' 个子租户任务'
        + (failures.length > 0 ? '，另有 ' + failures.length + ' 个租户投递失败' : '')
        + '，开始汇总实际安装进度', 2);
}

if (phase == 'Abort') {
    return {
        Code: 0,
        Data: {
            FailureStage: 'ScopePatch',
            TargetCount: attemptedTargets.length,
            QueuedCount: 0,
            FailedCount: failures.length,
            Failures: failures
        },
        Msg: '启动依赖范围写入失败，相关子任务均已请求停止；未执行全量平台应用安装。'
    };
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

var immediateFailures = failures.slice();
var succeeded = [];
var terminalFailures = immediateFailures.slice();
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

var totalTargetCount = childTasks.length + immediateFailures.length;
var terminalCount = succeeded.length + terminalFailures.length;
var aggregateProgress = totalTargetCount > 0
    ? Math.max(5, Math.min(99, 5 + Math.floor(94 * (progressTotal + immediateFailures.length * 100)
        / (100 * totalTargetCount))))
    : 100;
var monitorMessage = '子租户安装进度：成功 ' + succeeded.length
    + '，失败 ' + terminalFailures.length + '，进行中 ' + runningCount
    + '（' + terminalCount + '/' + totalTargetCount + '）';
report(aggregateProgress, terminalCount, totalTargetCount, monitorMessage);

if (runningCount > 0) {
    return continuation({
        Version: 3,
        TaskId: taskId,
        Phase: 'Monitor',
        MaintenanceScope: maintenanceScope,
        TargetOsClients: requestedTargetOsClients,
        BootstrapRevision: text(checkpoint.BootstrapRevision),
        AttemptedTargets: attemptedTargets,
        ChildTasks: childTasks,
        Failures: immediateFailures,
        BootstrapRefreshFailures: bootstrapRefreshFailures
    }, aggregateProgress, terminalCount, totalTargetCount, monitorMessage, 3);
}

if (terminalFailures.length > 0) {
    return {
        Code: 0,
        Data: {
            FailureStage: 'ChildTerminal',
            TargetCount: totalTargetCount,
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
        TargetCount: totalTargetCount,
        SucceededCount: succeeded.length,
        FailedCount: 0,
        Results: succeeded
    },
    Msg: '全部 ' + childTasks.length + ' 个子租户平台应用均已安装/更新成功。'
};
