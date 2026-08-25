/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：bulk-import-microi-store-packages
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: bulk-import-microi-store-packages
 * Version: v1.3.4
 * Function:
 * - 规划并逐个安装或更新全部官方平台应用；持久化计划、不可变商城快照标识与子检查点，并透传结构化失败详情。
 */

// BACKGROUND_TASK_CHECKPOINT_PLAN_V2：应用商城批量计划只依赖平台已有的
// mci_background_task.CheckpointJson，不要求目标租户预先安装额外业务表。
// BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1：旧版后端需要 StopHttp=0 才能进入本引擎，
// 但 HTTP 控制器会剥离可信标记；这里再同时校验任务 Id、信封和 fencing token，
// 普通 HTTP 即使伪造任务参数也不能执行批量安装。
// BULK_PLATFORM_ONLY_PLAN_V1：页面上的“全部安装/更新”只面向 29 个官方平台
// 应用。UniApp、Web、MicroService 等社区/AI 应用必须由用户逐个选择，禁止把
// 整个商城的上千个应用和数千张业务表误装到租户。
// BULK_BOUNDED_PACKAGE_SLICES_V1：所有官方包均保留导入器内部的有界分片与
// 检查点；不能仅按资源数量把系统设置、系统帐号等 CPU/DDL 重包误判为小包，
// 否则单次事务可能长期占用工作器且无法从中间进度恢复。
// BULK_FAILURE_RECOVERY_DIAGNOSTICS_V1：失败终态必须带任务、阶段、应用序号和
// 可执行恢复建议，后台任务中心不能再只显示“接口无返回”或无法定位的笼统错误。
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
// MARKETPLACE_PRIVATE_SOURCE_CREDENTIAL_V1：后台任务和检查点只保存凭据 Key；
// Token 原文仅从当前租户后端 V8.SysConfig.ServerPrivateSettings 读取。
function loadMarketplaceSourceCredential(credentialKey, expectedApiBase, expectedOsClient) {
    var key = trim(credentialKey);
    if (!key) return null;
    var privateSettings = V8.SysConfig && V8.SysConfig.ServerPrivateSettings
        ? V8.SysConfig.ServerPrivateSettings
        : {};
    var raw = privateSettings[key];
    if (!raw) throw new Error('商城源登录已失效，请在商城源管理中重新登录。');
    var credential = raw;
    if (typeof credential == 'string') {
        try { credential = JSON.parse(credential); }
        catch (parseError) { throw new Error('商城源登录凭据格式无效，请重新登录。'); }
    }
    var token = trim(credential.Token || credential.token).replace(/^Bearer\s+/i, '');
    var boundBase = trim(credential.ApiBase || credential.apiBase).replace(/\/+$/, '');
    var boundOsClient = trim(credential.OsClient || credential.osClient);
    if (!token) throw new Error('商城源登录 Token 为空，请重新登录。');
    if (boundBase.toLowerCase() != String(expectedApiBase || '').replace(/\/+$/, '').toLowerCase()
        || boundOsClient.toLowerCase() != String(expectedOsClient || '').toLowerCase()) {
        throw new Error('商城源登录凭据与当前 ApiBase/OsClient 不匹配，请重新发现并登录该来源。');
    }
    var expiresAt = trim(credential.ExpiresAtUtc || credential.expiresAtUtc);
    if (expiresAt) {
        var expiresAtTime = Date.parse(expiresAt);
        if (!isNaN(expiresAtTime) && expiresAtTime <= Date.now()) {
            throw new Error('商城源登录已过期，请重新登录。');
        }
    }
    return { authorization: token, did: trim(credential.Did || credential.did) };
}
// BULK_CHILD_FAILURE_DETAIL_V1：子导入器会把字段级异常放在
// Data['失败详情（共N条）'] 中。批量任务必须把首批详情带到任务中心，
// 否则只能看到“请查看失败详情”，却没有任何可查看的内容。
function childFailureDetail(result) {
    var data = result && result.Data;
    data = parseJson(data, data);
    var details = [];
    var seen = {};
    var addDetail = function (value) {
        var detail = trim(value);
        if (!detail || seen[detail] || details.length >= 3) return;
        seen[detail] = true;
        details.push(detail);
    };
    var scan = function (value, depth, force) {
        if (details.length >= 3 || value === null || value === undefined || depth > 3) return;
        value = parseJson(value, value);
        if (typeof value != 'object') {
            if (force) addDetail(value);
            return;
        }
        if (value.length !== undefined) {
            var rows = toArray(value);
            for (var rowIndex = 0; rowIndex < rows.length && details.length < 3; rowIndex++) {
                scan(rows[rowIndex], depth + 1, true);
            }
            return;
        }
        var direct = value.详情 || value.Detail || value.Msg || value.Message
            || value.错误信息 || value.Error || value.error;
        var identifier = value.标识 || value.Identifier || value.Key || value.key;
        if (direct !== null && direct !== undefined && identifier) {
            addDetail(trim(identifier) + '：' + trim(direct));
            return;
        }
        if (direct !== null && direct !== undefined) scan(direct, depth + 1, true);
        for (var key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key) || details.length >= 3) continue;
            var normalizedKey = text(key).toLowerCase();
            var isDetailKey = text(key).indexOf('失败详情') === 0
                || text(key) == '错误信息'
                || normalizedKey == 'errors'
                || normalizedKey == 'error'
                || normalizedKey == 'details';
            if (isDetailKey) scan(value[key], depth + 1, true);
        }
    };
    // BULK_STRUCTURED_CHILD_ERRORS_V1：同时支持导入器预检的 Data.Errors、
    // catch 分支的错误信息，以及旧版“失败详情（共N条）”结构。
    scan(data, 0, false);
    return details.join('；');
}
// BULK_STORAGE_FAILURE_RECOVERY_V1：存储类失败不能再给出“处理冲突或数据问题”
// 这种无关建议。按子导入器的稳定 ErrorType/HTTP 线索返回可执行恢复步骤。
function childRecoveryHint(message, completed) {
    var value = text(message).toLowerCase();
    if (value.indexOf('marketplace_version_snapshot') >= 0
        || value.indexOf('不可变安装快照') >= 0
        || value.indexOf('版本快照尚未就绪') >= 0) {
        return '商城发布版本的不可变快照尚未就绪；请等待发布事务完成后重新发起。'
            + '系统不会混装两个版本，前 ' + completed + ' 个已完成应用会幂等跳过。';
    }
    if (value.indexOf('object_storage_forbidden') >= 0
        || value.indexOf('403') >= 0
        || value.indexOf('forbidden') >= 0
        || value.indexOf('accessdenied') >= 0) {
        return '目标租户对象存储拒绝访问：请核对 SaaS 引擎 HDFS 类型、桶与 Endpoint，'
            + '并为当前凭证补齐对象读取存在性和写入权限；不要修改已完成应用。修复后重新发起，前 '
            + completed + ' 个应用会幂等跳过。';
    }
    if (value.indexOf('object_storage_unreachable') >= 0
        || value.indexOf('hdfs') >= 0
        || value.indexOf('minio') >= 0
        || value.indexOf('oss') >= 0) {
        return '请检查目标租户 SaaS 引擎中的 HDFS/OSS/MinIO Endpoint、网络路由、桶和凭证完整性；'
            + '修复后重新发起，前 ' + completed + ' 个应用会幂等跳过。';
    }
    return '先按失败详情处理冲突或数据问题，再重新发起全部安装/更新；前 '
        + completed + ' 个已完成应用会幂等跳过。';
}
// BULK_MONOTONIC_CHILD_PROGRESS_V1：批量协调器每次恢复子导入器前，必须继承
// 子检查点的精确 Progress；兼容旧检查点时按阶段取保守下限。否则即使子导入器
// 已保持 55%，外层仍会在每个分片开头按已完成应用数把进度压回 3%。
function childCheckpointProgress(value) {
    value = value && typeof value == 'object' ? value : {};
    var exact = parseInt(value.Progress, 10);
    if (!isNaN(exact)) return Math.max(0, Math.min(99, exact));
    var phaseFloors = {
        Ddl: toInt(value.Index, 0) > 0 ? 10 : 0,
        Tables: 25,
        PlanFields: 40,
        Fields: 40,
        Physical: 55,
        ApplicationAssets: 65,
        PostSchema: 70,
        ScheduleJobs: 97
    };
    return phaseFloors[text(value.Phase)] || 0;
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
var checkpointVersion = toInt(checkpoint.Version, 0);
if (phase == 'Install' && checkpointVersion > 0 && checkpointVersion < 3) {
    // 旧版计划没有应用类型，曾把社区/AI 应用一并纳入。热更新后必须重新盘点，
    // 已完成的平台应用会由 InstalledVersions 自动跳过，不能继续沿用错误计划。
    checkpoint = {};
    phase = 'Discover';
}
var bulkApplicationType = 'Platform';
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
var sourceCredentialKey = trim(
    checkpoint.SourceCredentialKey
    || V8.Param.StoreCredentialKey
    || V8.Param.SourceCredentialKey
);
function normalizeRequiredAppIds(value) {
    var values = toArray(value);
    var result = [];
    var seen = {};
    for (var index = 0; index < values.length; index++) {
        var appId = trim(values[index]).toLowerCase();
        if (!appId || seen[appId]) continue;
        seen[appId] = true;
        result.push(appId);
    }
    return result;
}
// BULK_REQUIRED_APP_SCOPE_V1：控制面事故修复可把同一受信工作器收窄到
// 明确的官方 AppId；普通“全部安装/更新”不传此参数，行为保持不变。
var requiredAppIds = normalizeRequiredAppIds(
    checkpoint.RequiredAppIds || V8.Param.RequiredAppIds
);
var requiredAppIdMap = {};
for (var requiredIndex = 0; requiredIndex < requiredAppIds.length; requiredIndex++) {
    requiredAppIdMap[requiredAppIds[requiredIndex]] = true;
}
function planItemAllowed(item) {
    if (requiredAppIds.length <= 0) return true;
    return requiredAppIdMap[trim(item && (item.AppId || item.AppKey)).toLowerCase()] === true;
}
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
function failure(message, detail, recoveryHint) {
    var data = detail && typeof detail == 'object' ? detail : {};
    data.TaskId = taskId;
    data.Phase = phase;
    data.CheckpointVersion = checkpointVersion;
    data.RecoveryHint = recoveryHint || '确认后台任务工作器健康后重新发起；已提交的应用会由安装版本和幂等键自动跳过。';
    return {
        Code: 0,
        Data: data,
        Msg: message + '；解决方案：' + data.RecoveryHint
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
        if (trim(item.ApplicationType || item.AppType) != bulkApplicationType) continue;
        if (!planItemAllowed(item)) continue;
        var key = planItemKey(item);
        if (!key || seen[key]) continue;
        seen[key] = true;
        result.push({
            StoreId: trim(item.StoreId),
            AppId: trim(item.AppId),
            AppName: trim(item.AppName || item.Name || item.AppId || item.StoreId),
            AppVersion: trim(item.AppVersion || item.Version),
            StoreVersionId: trim(item.StoreVersionId || item.DataVersionId),
            ApplicationType: bulkApplicationType,
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
        if (trim(row.ApplicationType || row.AppType) != bulkApplicationType) continue;
        if (!planItemAllowed(row)) continue;
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
            StoreVersionId: trim(row.StoreVersionId || row.DataVersionId),
            ApplicationType: bulkApplicationType,
            InstallAction: status == 'Outdated' ? 'Update' : 'Install'
        });
    }
}
function prioritizeBootstrapPlan(plan) {
    // 只在 Discover 完整结束后排序一次；Install 恢复阶段绝不重排已有 CurrentIndex。
    // PLATFORM_STARTUP_PACKAGE_PRIORITY_V1：应用商城自身先获得最新导入器，
    // SaaS 引擎紧随其后补齐 platform-sys-config 等匿名启动接口；其余平台
    // 应用继续保持商城原始顺序。这样新前端不会等待全部平台包安装完才可启动。
    function priority(item) {
        var appId = trim(item && item.AppId).toLowerCase();
        if (appId == 'app.microi.store') return 0;
        if (appId == 'app.microi.saas-engine') return 1;
        return 2;
    }
    return plan.map(function (item, index) { return { Item: item, Index: index }; })
        .sort(function (left, right) {
            var leftBootstrap = priority(left.Item);
            var rightBootstrap = priority(right.Item);
            return leftBootstrap != rightBootstrap
                ? leftBootstrap - rightBootstrap
                : left.Index - right.Index;
        })
        .map(function (entry) { return entry.Item; });
}

if (phase == 'Discover') {
    var pageIndex = Math.max(1, toInt(checkpoint.PageIndex, 1));
    var plan = normalizePlan(checkpoint.Plan);
    var installedVersions = loadInstalledVersions();
    report(1, pageIndex - 1, null, '正在盘点商城中未安装和可更新的应用');
    var sourceRequestHeaders = {};
    try {
        sourceRequestHeaders = loadMarketplaceSourceCredential(
            sourceCredentialKey,
            sourceApiBase,
            sourceOsClient
        ) || {};
    } catch (credentialError) {
        return failure(
            credentialError.message || String(credentialError),
            { FailureStage: 'SourceAuthentication', SourceApiBase: sourceApiBase, SourceOsClient: sourceOsClient },
            '在应用商城的来源管理中重新登录该私有来源，然后重新发起全部安装/更新。'
        );
    }
    // MARKETPLACE_LIST_CUSTOM_ADDRESS_V1：接口引擎的 ApiEngineKey 是
    // get-microi-store，但对外自定义地址固定为 get-microi-store-list。
    // 远程商城调用必须使用 ApiAddress；把 Key 当作路径会在官方源返回
    // sys_apiengine NoExistData，并让所有子租户的批量升级反复重试。
    var listResult = V8.Http.Post({
        Url: sourceApiBase + '/apiengine/get-microi-store-list?OsClient=' + encodeURIComponent(sourceOsClient),
        PostParam: {
            _PageIndex: pageIndex,
            _PageSize: pageSize,
            ApplicationType: bulkApplicationType,
            BulkInstallPlan: true,
            InstalledVersions: installedVersions
        },
        ParamType: 'json',
        Headers: sourceRequestHeaders,
        Timeout: 120
    });
    listResult = parseJson(listResult, listResult);
    if (!listResult || listResult.Code != 1) {
        return failure(
            '读取应用商城批量安装计划失败：' + ((listResult && listResult.Msg) || '接口无返回'),
            {
                FailureStage: 'Discover',
                SourceApiBase: sourceApiBase,
                SourceOsClient: sourceOsClient,
                PageIndex: pageIndex
            },
            '检查商城源地址、源租户和网络连通性；修正后重新发起，盘点阶段不会写入应用资源。'
        );
    }

    var rows = toArray(listResult.Data);
    appendPlanRows(plan, rows);
    var dataCount = toInt(listResult.DataCount, rows.length);
    if (pageIndex * pageSize < dataCount) {
        return continuation({
            Version: 4,
            TaskId: taskId,
            Phase: 'Discover',
            PageIndex: pageIndex + 1,
            Plan: plan,
            ApplicationType: bulkApplicationType,
            SourceApiBase: sourceApiBase,
            SourceOsClient: sourceOsClient,
            SourceCredentialKey: sourceCredentialKey,
            RequiredAppIds: requiredAppIds
        }, 2, pageIndex * pageSize, dataCount, '商城应用盘点已完成一页，将从后台任务检查点继续');
    }

    plan = prioritizeBootstrapPlan(plan);
    if (plan.length <= 0) {
        report(100, 0, 0, '所有应用均已是最新版，无需安装或更新');
        return {
            Code: 1,
            Data: { Planned: 0, Installed: 0, Updated: 0, SkippedInstalled: dataCount },
            Msg: '所有应用均已是最新版，无需安装或更新。'
        };
    }
    return continuation({
        Version: 4,
        TaskId: taskId,
        Phase: 'Install',
        CurrentIndex: 0,
        Installed: 0,
        Updated: 0,
        ChildCheckpoint: {},
        Plan: plan,
        ApplicationType: bulkApplicationType,
        SourceApiBase: sourceApiBase,
        SourceOsClient: sourceOsClient,
        SourceCredentialKey: sourceCredentialKey,
        RequiredAppIds: requiredAppIds
    }, 3, 0, plan.length, '批量安装计划已写入后台任务检查点，开始逐个安装/更新');
}

if (phase != 'Install') {
    return failure(
        '未知的批量安装检查点阶段：' + phase,
        { FailureStage: 'CheckpointValidation', Checkpoint: checkpoint },
        '该检查点与当前应用包版本不兼容，请让任务进入失败终态后重新发起，系统会重新盘点。'
    );
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
var resumedChildProgress = childCheckpointProgress(childCheckpoint);
var childParam = {
    StoreId: item.StoreId,
    AppId: item.AppId,
    AppName: item.AppName,
    AppVersion: item.AppVersion,
    StoreVersionId: item.StoreVersionId,
    StoreApiBase: sourceApiBase,
    StoreOsClient: sourceOsClient,
    StoreCredentialKey: sourceCredentialKey,
    ResumeInstall: true,
    InstallAction: item.InstallAction,
    InstallOperationId: taskId + ':' + (item.StoreId || item.AppId),
    BulkCurrentIndex: currentIndex,
    BulkTotal: total,
    BulkAdaptiveSingleSlice: false,
    // STARTUP_DEPENDENCY_API_FAST_BOOTSTRAP_V1：RequiredAppIds 被可信父任务
    // 精确收窄为 SaaS 引擎时，允许官方导入器先补齐缺失的六个启动接口；
    // 普通“全部安装/更新”与其它应用包永远不会进入该快速路径。
    StartupDependencyRecovery: requiredAppIds.length == 1
        && requiredAppIds[0] == 'app.microi.saas-engine',
    _BackgroundTaskId: taskId,
    _BackgroundTask: taskEnvelope,
    _BackgroundTaskFencingToken: fencingToken,
    _BackgroundTaskCheckpoint: childCheckpoint,
    _TrustedServerInvocation: true
};
report(Math.max(3, Math.min(99,
    Math.floor(((currentIndex + resumedChildProgress / 100) / total) * 100))),
    currentIndex + resumedChildProgress / 100, total,
    '[' + (currentIndex + 1) + '/' + total + '] 正在' + (item.InstallAction == 'Update' ? '更新' : '安装') + item.AppName);
var childResult = V8.ApiEngine.Run('import-microi-store-package', childParam);
childResult = parseJson(childResult, childResult);
if (!childResult || childResult.Code != 1) {
    var childMsg = (childResult && childResult.Msg) || '子安装接口无返回';
    var childDetail = childFailureDetail(childResult);
    return failure(
        '应用【' + item.AppName + '】安装/更新失败：' + childMsg
            + (childDetail ? '；失败详情：' + childDetail : ''),
        {
            FailureStage: 'Install',
            FailedIndex: currentIndex + 1,
            Completed: currentIndex,
            Total: total,
            FailedItem: item,
            ChildData: childResult && childResult.Data ? childResult.Data : null
        },
        childRecoveryHint(childMsg + '；' + childDetail, currentIndex)
    );
}

var childBackground = childResult.Data && childResult.Data.BackgroundTask;
if (childBackground && childBackground.HasMore === true) {
    var childProgress = toInt(childBackground.Progress, 0);
    var overallProgress = Math.max(3, Math.min(99,
        Math.floor(((currentIndex + childProgress / 100) / total) * 100)));
    return continuation({
        Version: 4,
        TaskId: taskId,
        Phase: 'Install',
        CurrentIndex: currentIndex,
        Installed: installedCount,
        Updated: updatedCount,
        ChildCheckpoint: childBackground.Checkpoint || {},
        Plan: installPlan,
        ApplicationType: bulkApplicationType,
        SourceApiBase: sourceApiBase,
        SourceOsClient: sourceOsClient,
        SourceCredentialKey: sourceCredentialKey,
        RequiredAppIds: requiredAppIds
    }, overallProgress, currentIndex + childProgress / 100, total,
    '[' + (currentIndex + 1) + '/' + total + '] ' + (childBackground.Msg || '应用安装分片已提交'));
}

if (item.InstallAction == 'Update') updatedCount++;
else installedCount++;
currentIndex++;
return continuation({
    Version: 4,
    TaskId: taskId,
    Phase: 'Install',
    CurrentIndex: currentIndex,
    Installed: installedCount,
    Updated: updatedCount,
    ChildCheckpoint: {},
    Plan: installPlan,
    ApplicationType: bulkApplicationType,
    SourceApiBase: sourceApiBase,
    SourceOsClient: sourceOsClient,
    SourceCredentialKey: sourceCredentialKey,
    RequiredAppIds: requiredAppIds
}, Math.min(99, Math.floor((currentIndex / total) * 100)), currentIndex, total,
'已完成【' + item.AppName + '】，继续处理剩余应用');
