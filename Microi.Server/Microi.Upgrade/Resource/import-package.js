/*
 * V8 ApiEngine
 * ApiEngineKey: import-microi-store-package
 * Version: v1.10.2
 * Function:
 * - 统一使用 sys_microistore 作为应用主表；mci_ai_app_file 与 mci_ai_app_version 继续保存私有源码和构建版本。
 * - 接口引擎按 Managed/CreateIfMissing 资源策略升级，并用安装基线阻止覆盖租户修改。
 */

// ==================== 参数接收与校验 ====================

var Package = V8.Param.Package;  // 应用数据包
var InstallParentSysMenuId = V8.Param.InstallParentSysMenuId;  // 安装在哪个父级系统菜单Id下

// 执行日志收集（用于最终构建中文报告）
var debugLog = {};
// 大型源码包可能超过反向代理的单次请求时限。默认启用可恢复安装：同一
// AppId + FilePath 且摘要一致的文件直接复用，完整上传后再清理旧版本残留。
var resumeInstall = V8.Param.ResumeInstall !== false
    && String(V8.Param.ResumeInstall || '').toLowerCase() != 'false';

var invokeType = String(V8.InvokeType || V8.Param._InvokeType || '').toLowerCase();
if (invokeType == 'client') {
    var currentUser = V8.CurrentUser || {};
    if (!currentUser || !currentUser.Id || currentUser.Level === null || currentUser.Level === undefined) {
        var currentToken = V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
        if (currentToken && currentToken.CurrentUser) currentUser = currentToken.CurrentUser;
    }
    var level = parseInt(currentUser.Level || 0, 10);
    if (isNaN(level) || level < 9999) {
        return {
            Code: 0,
            Msg: '权限不足：只有超级管理员才能安装应用。'
        };
    }
}

var backgroundTaskId = V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId || '';
var installAction = String(V8.Param.InstallAction || V8.Param.Action || 'Install');
var installOperationId = String(V8.Param.InstallOperationId || V8.Param.OperationId || backgroundTaskId || '');
if (!installOperationId && V8.Method && V8.Method.NewGuid) installOperationId = String(V8.Method.NewGuid());
var backgroundTaskEnvelope = V8.Param._BackgroundTask || {};
var backgroundChunkingEnabled = !!backgroundTaskId && (
    V8.Param._TrustedServerInvocation === true
    || String(V8.Param._TrustedServerInvocation || '').toLowerCase() == 'true'
    || (String(backgroundTaskEnvelope.Id || '') == String(backgroundTaskId)
        && V8.Param._BackgroundTaskFencingToken !== null
        && V8.Param._BackgroundTaskFencingToken !== undefined)
);
// APPLICATION_ASSET_BACKGROUND_CHUNKS_V1：商城应用资产必须按后台任务切片。
// Jint 的 LimitMemory 统计的是当前执行片段的累计托管分配，不是存活堆；即使
// 单个文件上传完成并被 GC 回收，长循环仍会把历史分配全部累计到同一片段。
// 每片只做少量真实上传，已完成文件按 AppId + FilePath + Hash 在下一片复用，
// 最后一片才切换运行元数据和清理旧资产。旧后端仍可依靠 3GB 片段预算完成大包。
var backgroundCheckpoint = V8.Param._BackgroundTaskCheckpoint || {};
if (typeof backgroundCheckpoint == 'string') {
    try { backgroundCheckpoint = JSON.parse(backgroundCheckpoint); } catch (checkpointError) { backgroundCheckpoint = {}; }
}
var checkpointTaskId = String(backgroundCheckpoint.TaskId || '');
if (checkpointTaskId && checkpointTaskId != String(backgroundTaskId || '')) backgroundCheckpoint = {};
if (!backgroundChunkingEnabled && backgroundCheckpoint.Phase) backgroundCheckpoint = {};
if (backgroundChunkingEnabled && backgroundCheckpoint.Phase && !checkpointTaskId) {
    var isLegacyAssetCheckpoint = String(backgroundCheckpoint.Phase) == 'ApplicationAssets'
        && (backgroundCheckpoint.AssetKind
            || backgroundCheckpoint.ApplicationAssetUploaded !== null
                && backgroundCheckpoint.ApplicationAssetUploaded !== undefined);
    if (!isLegacyAssetCheckpoint) backgroundCheckpoint = {};
}
// SCHEMA_BACKGROUND_CHUNKS_V1：旧后端仍使用 Jint 累计分配预算，因此在应用
// 资产之前的 DDL、表定义、字段 Id 规划、字段写入和物理列复核也必须独立提交。
// 检查点只保存阶段、游标和非同值 Id 映射；Package 仍由持久任务 ParamJson 持有，
// 不依赖进程内对象，节点重启或租约转移后可以从最后一次已提交分片继续。
var backgroundCheckpointPhase = String(backgroundCheckpoint.Phase || 'Ddl');
var supportedBackgroundCheckpointPhases = {
    Ddl: true,
    Tables: true,
    PlanFields: true,
    Fields: true,
    Physical: true,
    ApplicationAssets: true,
    PostSchema: true,
    ScheduleJobs: true
};
if (!supportedBackgroundCheckpointPhases[backgroundCheckpointPhase]) backgroundCheckpointPhase = 'Ddl';
var backgroundCheckpointIndex = parseInt(backgroundCheckpoint.Index || 0, 10);
if (isNaN(backgroundCheckpointIndex) || backgroundCheckpointIndex < 0) backgroundCheckpointIndex = 0;
// MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1：MySQL 宽表把失败的 varchar 配置列提升为
// mediumtext 后，后续后台分片必须继续沿用同一物理类型。覆盖只保存表名、字段名和
// 行外文本类型，不保存租户数据；节点切换或进程重启后仍能幂等恢复。
var mysqlOffpageTypeOverrides = {};
var storedMysqlOffpageTypeOverrides = backgroundCheckpoint.MySqlOffpageTypeOverrides || {};
for (var storedOffpageKey in storedMysqlOffpageTypeOverrides) {
    if (!Object.prototype.hasOwnProperty.call(storedMysqlOffpageTypeOverrides, storedOffpageKey)) continue;
    var storedOffpageType = String(storedMysqlOffpageTypeOverrides[storedOffpageKey] || '').toLowerCase();
    if (storedOffpageType == 'mediumtext' || storedOffpageType == 'longtext') {
        mysqlOffpageTypeOverrides[String(storedOffpageKey).toLowerCase()] = storedOffpageType;
    }
}
var schemaDdlChunkSize = parseInt(V8.Param.SchemaDdlChunkSize || 1, 10);
if (isNaN(schemaDdlChunkSize)) schemaDdlChunkSize = 1;
schemaDdlChunkSize = Math.max(1, Math.min(4, schemaDdlChunkSize));
var schemaTableChunkSize = parseInt(V8.Param.SchemaTableChunkSize || 2, 10);
if (isNaN(schemaTableChunkSize)) schemaTableChunkSize = 2;
schemaTableChunkSize = Math.max(1, Math.min(4, schemaTableChunkSize));
var schemaFieldPlanChunkSize = parseInt(V8.Param.SchemaFieldPlanChunkSize || 32, 10);
if (isNaN(schemaFieldPlanChunkSize)) schemaFieldPlanChunkSize = 32;
schemaFieldPlanChunkSize = Math.max(1, Math.min(64, schemaFieldPlanChunkSize));
var schemaFieldChunkSize = parseInt(V8.Param.SchemaFieldChunkSize || 8, 10);
if (isNaN(schemaFieldChunkSize)) schemaFieldChunkSize = 8;
schemaFieldChunkSize = Math.max(1, Math.min(16, schemaFieldChunkSize));
var schemaPhysicalTableChunkSize = parseInt(V8.Param.SchemaPhysicalTableChunkSize || 1, 10);
if (isNaN(schemaPhysicalTableChunkSize)) schemaPhysicalTableChunkSize = 1;
schemaPhysicalTableChunkSize = Math.max(1, Math.min(2, schemaPhysicalTableChunkSize));

var copyPersistentIdMaps = function (sourceMaps) {
    var result = { Table: {}, Field: {} };
    if (!sourceMaps || typeof sourceMaps != 'object') return result;
    var names = ['Table', 'Field'];
    for (var nameIndex = 0; nameIndex < names.length; nameIndex++) {
        var mapName = names[nameIndex];
        var sourceMap = sourceMaps[mapName];
        if (!sourceMap || typeof sourceMap != 'object') continue;
        for (var sourceId in sourceMap) {
            if (!Object.prototype.hasOwnProperty.call(sourceMap, sourceId)) continue;
            var targetId = sourceMap[sourceId];
            if (sourceId && targetId && String(sourceId) != String(targetId)) {
                result[mapName][String(sourceId)] = String(targetId);
            }
        }
    }
    return result;
};

var buildPersistentCheckpoint = function (phase, index, extra) {
    var checkpoint = {
        Version: 1,
        TaskId: String(backgroundTaskId || ''),
        Phase: phase,
        Index: Math.max(0, parseInt(index || 0, 10) || 0)
    };
    var checkpointPackageInfo = typeof Package != 'undefined' && Package && Package.PackageInfo
        ? Package.PackageInfo
        : {};
    var checkpointPackageVersion = String(
        checkpointPackageInfo.Version || checkpointPackageInfo.AppVersion || V8.Param.AppVersion || ''
    );
    var checkpointPackageIdentity = String(
        checkpointPackageInfo.AppId || checkpointPackageInfo.AppKey || V8.Param.AppId
        || V8.Param.AppKey || V8.Param.StoreId || checkpointPackageInfo.Name || ''
    );
    if (checkpointPackageVersion) checkpoint.PackageVersion = checkpointPackageVersion;
    if (checkpointPackageIdentity) checkpoint.PackageIdentity = checkpointPackageIdentity;
    if (backgroundCheckpoint.IdMapsPlanned === true
        || phase == 'Fields'
        || phase == 'Physical'
        || phase == 'ApplicationAssets'
        || phase == 'PostSchema'
        || phase == 'ScheduleJobs') {
        checkpoint.IdMapsPlanned = true;
    }
    var maps = null;
    try {
        if (typeof snapshotPersistentIdMaps == 'function') maps = snapshotPersistentIdMaps();
    } catch (snapshotError) { maps = null; }
    if (!maps) maps = copyPersistentIdMaps(backgroundCheckpoint.IdMaps);
    if (maps && (Object.keys(maps.Table).length > 0 || Object.keys(maps.Field).length > 0)) {
        checkpoint.IdMaps = maps;
    }
    var schemaStats = null;
    try {
        if (typeof snapshotPersistentSchemaStats == 'function') schemaStats = snapshotPersistentSchemaStats();
    } catch (schemaStatsError) { schemaStats = null; }
    if (!schemaStats && backgroundCheckpoint.SchemaStats) schemaStats = backgroundCheckpoint.SchemaStats;
    if (schemaStats) checkpoint.SchemaStats = schemaStats;
    if (Object.keys(mysqlOffpageTypeOverrides).length > 0) {
        var offpageSnapshot = {};
        for (var offpageSnapshotKey in mysqlOffpageTypeOverrides) {
            if (Object.prototype.hasOwnProperty.call(mysqlOffpageTypeOverrides, offpageSnapshotKey)) {
                offpageSnapshot[offpageSnapshotKey] = mysqlOffpageTypeOverrides[offpageSnapshotKey];
            }
        }
        checkpoint.MySqlOffpageTypeOverrides = offpageSnapshot;
    }
    extra = extra || {};
    for (var extraKey in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, extraKey)) checkpoint[extraKey] = extra[extraKey];
    }
    return checkpoint;
};

var buildSchemaContinuation = function (phase, index, progress, msg) {
    return {
        Code: 1,
        Data: {
            BackgroundTask: {
                HasMore: true,
                Checkpoint: buildPersistentCheckpoint(phase, index),
                Progress: progress,
                Msg: msg
            }
        },
        Msg: msg
    };
};
var applicationAssetChunkMaxFiles = parseInt(V8.Param.ApplicationAssetChunkMaxFiles || 8, 10);
if (isNaN(applicationAssetChunkMaxFiles)) applicationAssetChunkMaxFiles = 8;
applicationAssetChunkMaxFiles = Math.max(1, Math.min(50, applicationAssetChunkMaxFiles));
var applicationAssetChunkMaxBase64Chars = parseInt(V8.Param.ApplicationAssetChunkMaxBase64Chars || (32 * 1024 * 1024), 10);
if (isNaN(applicationAssetChunkMaxBase64Chars)) applicationAssetChunkMaxBase64Chars = 32 * 1024 * 1024;
applicationAssetChunkMaxBase64Chars = Math.max(1024 * 1024, Math.min(256 * 1024 * 1024, applicationAssetChunkMaxBase64Chars));
var applicationAssetChunkUploads = 0;
var applicationAssetChunkBase64Chars = 0;
var applicationAssetPreviouslyUploaded = parseInt(backgroundCheckpoint.ApplicationAssetUploaded || 0, 10);
if (isNaN(applicationAssetPreviouslyUploaded)) applicationAssetPreviouslyUploaded = 0;

var applicationAssetContentLength = function (file) {
    file = file || {};
    var value = file.FileByteBase64 || file.ContentBase64 || file.Base64;
    if (value !== null && value !== undefined) return String(value).length;
    if (file.Content !== null && file.Content !== undefined) return String(file.Content).length * 2;
    return 0;
};

var shouldContinueApplicationAssets = function (file) {
    if (!backgroundChunkingEnabled || applicationAssetChunkUploads <= 0) return false;
    var nextLength = applicationAssetContentLength(file);
    return applicationAssetChunkUploads >= applicationAssetChunkMaxFiles
        || applicationAssetChunkBase64Chars + nextLength > applicationAssetChunkMaxBase64Chars;
};

var markApplicationAssetUploaded = function (file) {
    applicationAssetChunkUploads++;
    applicationAssetChunkBase64Chars += applicationAssetContentLength(file);
};

var buildApplicationAssetContinuation = function (bundleIndex, assetKind, assetIndex, totalAssets) {
    var uploaded = applicationAssetPreviouslyUploaded + applicationAssetChunkUploads;
    return {
        Code: 1,
        Data: {
            BackgroundTask: {
                HasMore: true,
                Checkpoint: buildPersistentCheckpoint('ApplicationAssets', 0, {
                    BundleIndex: bundleIndex,
                    AssetKind: assetKind,
                    AssetIndex: assetIndex,
                    ApplicationAssetUploaded: uploaded
                }),
                Current: uploaded,
                Total: totalAssets > 0 ? totalAssets : null,
                Progress: 65,
                Msg: '应用资产已完成一个安全分片，将从持久化检查点继续'
            }
        },
        Msg: '应用资产分片已提交，后台任务将自动继续'
    };
};
var installUser = V8.CurrentUser || (typeof currentUser !== 'undefined' ? currentUser : {}) || {};
if ((!installUser || !installUser.Id) && V8.Method && V8.Method.GetCurrentToken) {
    try {
        var installToken = V8.Method.GetCurrentToken();
        if (installToken && installToken.CurrentUser) installUser = installToken.CurrentUser;
    } catch (installUserError) { }
}
var reportProgress = function (progress, msg) {
    if (!backgroundTaskId || !V8.Method || !V8.Method.UpdateBackgroundTask) return;
    try {
        var bulkIndex = parseInt(V8.Param.BulkCurrentIndex || 0, 10);
        var bulkTotal = parseInt(V8.Param.BulkTotal || 0, 10);
        var mappedProgress = progress;
        var current = progress;
        var total = 100;
        if (!isNaN(bulkIndex) && !isNaN(bulkTotal) && bulkTotal > 0) {
            mappedProgress = Math.max(0, Math.min(99, Math.floor(((bulkIndex + (progress / 100)) / bulkTotal) * 100)));
            current = Math.max(0, Math.min(bulkTotal, bulkIndex + (progress / 100)));
            total = bulkTotal;
            msg = '[' + (bulkIndex + 1) + '/' + bulkTotal + '] ' + msg;
        }
        V8.Method.UpdateBackgroundTask({
            _BackgroundTaskId: backgroundTaskId,
            Progress: mappedProgress,
            Msg: msg,
            Message: msg,
            Current: current,
            Total: total
        });
    } catch (progressError) {
        debugLog['background_progress_error_' + progress] = progressError.message;
    }
};

var firstTextParam = function (values) {
    if (!values || !values.length) return '';
    for (var i = 0; i < values.length; i++) {
        var item = values[i];
        if (item === null || item === undefined) continue;
        var text = String(item);
        if (text.replace(/^\s+|\s+$/g, '') !== '') return text;
    }
    return '';
};

var countPageTabs = function (value) {
    if (value === null || value === undefined) return 0;
    var tabs = value;
    if (typeof tabs == 'string') {
        var text = tabs.replace(/^\s+|\s+$/g, '');
        if (!text || text == '[]' || text == '{}') return 0;
        try {
            tabs = JSON.parse(text);
        } catch (parseError) {
            return 0;
        }
    }
    return tabs && tabs.length !== undefined ? Number(tabs.length) || 0 : 0;
};

// 老库的系统设置可能尚未定义全局 DateNow，也可能额外维护了自己的全局函数。
// 导入器必须自包含时间能力，不能通过覆盖 sys_config 全局V8来修复。
var nowText = function (format) {
    var dateFormat = firstTextParam([format, 'yyyy-MM-dd HH:mm:ss']);
    try {
        if (typeof DateNow == 'function') return DateNow(dateFormat);
    } catch (dateNowError) {
        debugLog.local_time_datenow_fallback = dateNowError.message || String(dateNowError);
    }
    try {
        return System.DateTime.Now.ToString(dateFormat);
    } catch (systemDateError) {
        debugLog.local_time_system_fallback = systemDateError.message || String(systemDateError);
    }
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

var trimRightSlash = function (url) {
    return firstTextParam([url]).replace(/\/+$/g, '');
};

var syncStoreMetaFromRow = function () {
    var row = V8.Param.Form || V8.Param.Row || V8.Param.StoreRow || {};
    if (!row) row = {};
    if (!V8.Param.StoreId) V8.Param.StoreId = firstTextParam([row.StoreId, row.Id]);
    if (!V8.Param.AppId) V8.Param.AppId = firstTextParam([row.AppId, row.AppKey, row.Id]);
    if (!V8.Param.AppName) V8.Param.AppName = firstTextParam([row.AppName, row.Name]);
    if (!V8.Param.AppVersion) V8.Param.AppVersion = firstTextParam([row.AppVersion, row.Version]);
    if (!V8.Param.AppAuthor) V8.Param.AppAuthor = firstTextParam([row.AppAuthor, row.Author]);
    if (!V8.Param.StoreApiBase) V8.Param.StoreApiBase = firstTextParam([row.StoreApiBase, row.AppStoreApiBase]);
    if (!V8.Param.StoreOsClient) V8.Param.StoreOsClient = firstTextParam([row.StoreOsClient, row.AppStoreOsClient, row.SourceOsClient]);
    return row;
};

var storeRow = syncStoreMetaFromRow();
var storeApiBase = trimRightSlash(firstTextParam([V8.Param.StoreApiBase, storeRow.StoreApiBase, storeRow.AppStoreApiBase, 'https://api.itdos.com']));
var storeOsClient = firstTextParam([V8.Param.StoreOsClient, V8.Param.AppStoreOsClient, storeRow.StoreOsClient, storeRow.AppStoreOsClient, storeRow.SourceOsClient, 'iTdos']);
if (!Package && storeRow && storeRow.AppPakcet) {
    Package = storeRow.AppPakcet;
}
if (!Package && firstTextParam([V8.Param.StoreId, V8.Param.Id, storeRow.Id])) {
    reportProgress(3, '正在从应用商城源获取应用数据包');
    var storeId = firstTextParam([V8.Param.StoreId, V8.Param.Id, storeRow.Id]);
    var storeModelResult = V8.Http.Post({
        Url: storeApiBase + '/apiengine/get-microi-store-model?OsClient=' + encodeURIComponent(storeOsClient),
        PostParam: { Id: storeId },
        ParamType: 'json',
        Timeout: 120
    });
    if (typeof (storeModelResult) == 'string') {
        storeModelResult = JSON.parse(storeModelResult);
    }
    if (storeModelResult && storeModelResult.Code == 1 && storeModelResult.Data) {
        var storeModel = storeModelResult.Data;
        Package = storeModel.AppPakcet;
        if (!V8.Param.AppId) V8.Param.AppId = firstTextParam([storeModel.AppId, storeModel.AppKey, storeModel.Id]);
        if (!V8.Param.AppName) V8.Param.AppName = firstTextParam([storeModel.AppName, storeModel.Name]);
        if (!V8.Param.AppVersion) V8.Param.AppVersion = firstTextParam([storeModel.AppVersion, storeModel.Version]);
        if (!V8.Param.AppAuthor) V8.Param.AppAuthor = firstTextParam([storeModel.AppAuthor, storeModel.Author]);
    }
}

// 参数校验
if (!Package) {
    return {
        Code: 0,
        Msg: '参数错误：Package不能为空，且未能从应用商城源获取应用数据包'
    };
}
if (typeof (Package) == 'string') {
    Package = JSON.parse(Package);
}

if (!Package.PackageInfo) {
    return {
        Code: 0,
        Msg: '参数错误：Package.PackageInfo不能为空'
    };
}

// BULK_SMALL_PACKAGE_SINGLE_SLICE_V1：批量安装本身已经按“一个应用一个外层
// checkpoint”持久化。对规模可控的官方平台包，再把同一个应用拆成几十个内部
// Worker 片段只会反复下载和解析同一包体，调度成本远大于数据库写入。可信批量
// 任务可让小包在一个事务中完成；大型 Schema、远程 ZIP 或大资产仍保留原有分片。
var bulkAdaptiveSingleSliceRequested = V8.Param.BulkAdaptiveSingleSlice === true
    || String(V8.Param.BulkAdaptiveSingleSlice || '').toLowerCase() == 'true';
var trustedBulkAdaptiveInvocation = bulkAdaptiveSingleSliceRequested
    && backgroundChunkingEnabled
    && (V8.Param._TrustedServerInvocation === true
        || String(V8.Param._TrustedServerInvocation || '').toLowerCase() == 'true')
    && !!backgroundTaskId
    && String(backgroundTaskEnvelope.Id || '') == String(backgroundTaskId)
    && parseInt(V8.Param._BackgroundTaskFencingToken || 0, 10) > 0
    && parseInt(V8.Param.BulkTotal || 0, 10) > 0;
var listSize = function (value) {
    return value && value.length !== undefined ? Number(value.length) || 0 : 0;
};
var bulkAdaptivePackageEligible = function (packageModel) {
    packageModel = packageModel || {};
    var fieldCount = listSize(packageModel.DiyFields);
    var tableCount = listSize(packageModel.DiyTables);
    var ddlCount = listSize(packageModel.DDLStatements);
    var menuCount = listSize(packageModel.SysMenus);
    var apiEngineCount = listSize(packageModel.SysApiEngines);
    var scheduleJobCount = listSize(packageModel.ScheduleJobs);
    var workflowUnitCount = listSize(packageModel.WorkFlows || packageModel.Workflows)
        + listSize(packageModel.WFNodes || packageModel.WorkFlowNodes)
        + listSize(packageModel.WFLines || packageModel.WorkFlowLines);
    var dataRowCount = 0;
    var dataSets = packageModel.DataSets || [];
    for (var dataSetIndex = 0; dataSetIndex < listSize(dataSets); dataSetIndex++) {
        var dataSet = dataSets[dataSetIndex] || {};
        dataRowCount += listSize(dataSet.Rows || dataSet.Data);
    }

    var bundles = [];
    var packageBundles = packageModel.ApplicationBundles || [];
    for (var bundleIndex = 0; bundleIndex < listSize(packageBundles); bundleIndex++) {
        if (packageBundles[bundleIndex]) bundles.push(packageBundles[bundleIndex]);
    }
    var legacyBundle = packageModel.ApplicationBundle || packageModel.AiApplication || packageModel.FrontendApplication;
    if (legacyBundle) bundles.push(legacyBundle);
    var assetFileCount = 0;
    var assetContentChars = 0;
    var hasRemoteZipOnlyAssets = false;
    for (var adaptiveBundleIndex = 0; adaptiveBundleIndex < bundles.length; adaptiveBundleIndex++) {
        var adaptiveBundle = bundles[adaptiveBundleIndex] || {};
        var sourceFiles = adaptiveBundle.SourceFiles || adaptiveBundle.Files || [];
        var buildAssets = adaptiveBundle.BuildAssets || adaptiveBundle.Assets || [];
        var embeddedCount = listSize(sourceFiles) + listSize(buildAssets);
        var packageAssets = adaptiveBundle.PackageAssets || adaptiveBundle.ZipAssets || null;
        if (typeof packageAssets == 'string') {
            try { packageAssets = JSON.parse(packageAssets); } catch (adaptiveAssetParseError) { return false; }
        }
        if (packageAssets && packageAssets.length !== undefined && !packageAssets.BuildZip && !packageAssets.SourceZip) {
            packageAssets = packageAssets.length ? packageAssets[0] : null;
        }
        if (embeddedCount == 0 && packageAssets && (packageAssets.BuildZip || packageAssets.SourceZip)) {
            hasRemoteZipOnlyAssets = true;
        }
        var adaptiveFiles = [];
        var sourceFileCount = listSize(sourceFiles);
        var buildAssetCount = listSize(buildAssets);
        for (var sourceFileIndex = 0; sourceFileIndex < sourceFileCount; sourceFileIndex++) adaptiveFiles.push(sourceFiles[sourceFileIndex]);
        for (var buildAssetIndex = 0; buildAssetIndex < buildAssetCount; buildAssetIndex++) adaptiveFiles.push(buildAssets[buildAssetIndex]);
        assetFileCount += adaptiveFiles.length;
        for (var adaptiveFileIndex = 0; adaptiveFileIndex < adaptiveFiles.length; adaptiveFileIndex++) {
            assetContentChars += applicationAssetContentLength(adaptiveFiles[adaptiveFileIndex]);
        }
    }

    return fieldCount <= 160
        && tableCount <= 12
        && ddlCount <= 16
        && menuCount <= 20
        && apiEngineCount <= 40
        && scheduleJobCount == 0
        && workflowUnitCount <= 200
        && dataRowCount <= 500
        && assetFileCount <= 20
        && assetContentChars <= 8 * 1024 * 1024
        && !hasRemoteZipOnlyAssets;
};
if (trustedBulkAdaptiveInvocation && bulkAdaptivePackageEligible(Package)) {
    backgroundChunkingEnabled = false;
    backgroundCheckpoint = {};
    backgroundCheckpointPhase = 'Ddl';
    backgroundCheckpointIndex = 0;
    debugLog.bulk_small_package_single_slice = '可信批量任务使用单应用单事务快速路径';
}

// PACKAGE_REPLAY_VERSION_GUARD_V1：identifier-only 后台任务会在每片从商城源
// 重新读取包体。发布方若在任务中途切换版本，旧检查点不能与新包混用；宁可让
// 当前任务明确失败并以新幂等请求重新开始，也不能把两个版本的 DDL/字段拼在一起。
if (backgroundChunkingEnabled) {
    var currentPackageVersion = String(
        Package.PackageInfo.Version || Package.PackageInfo.AppVersion || V8.Param.AppVersion || ''
    );
    var currentPackageIdentity = String(
        Package.PackageInfo.AppId || Package.PackageInfo.AppKey || V8.Param.AppId
        || V8.Param.AppKey || V8.Param.StoreId || Package.PackageInfo.Name || ''
    );
    if (backgroundCheckpoint.PackageVersion
        && String(backgroundCheckpoint.PackageVersion) != currentPackageVersion) {
        return {
            Code: 0,
            Msg: '应用包版本在后台分片期间发生变化：检查点='
                + backgroundCheckpoint.PackageVersion + '，当前=' + currentPackageVersion
                + '。已停止混合安装，请重新提交更新任务。'
        };
    }
    if (backgroundCheckpoint.PackageIdentity
        && String(backgroundCheckpoint.PackageIdentity) != currentPackageIdentity) {
        return {
            Code: 0,
            Msg: '应用包身份与后台检查点不一致，已停止混合安装，请重新提交更新任务。'
        };
    }
}

var validateScheduleJobPackage = function (packageModel) {
    packageModel = packageModel || {};
    var errors = [];
    var rawJobs = packageModel.ScheduleJobs || [];
    if (typeof rawJobs == 'string') {
        try { rawJobs = JSON.parse(rawJobs || '[]'); }
        catch (parseJobsError) {
            return { Jobs: [], Errors: ['ScheduleJobs 不是有效 JSON：' + parseJobsError.message] };
        }
    }
    if (!rawJobs || rawJobs.length === undefined) {
        return { Jobs: [], Errors: ['ScheduleJobs 必须是数组'] };
    }
    if (rawJobs.length > 50) errors.push('单个应用包最多包含 50 个定时任务');

    var packageEngineMap = {};
    var packageEngines = packageModel.SysApiEngines || [];
    for (var packageEngineIndex = 0; packageEngineIndex < listSize(packageEngines); packageEngineIndex++) {
        var packageEngine = packageEngines[packageEngineIndex] || {};
        var packageEngineKey = String(packageEngine.ApiEngineKey || '').toLowerCase();
        if (packageEngineKey) packageEngineMap[packageEngineKey] = true;
    }

    var names = {};
    var jobs = [];
    for (var packageJobIndex = 0; packageJobIndex < Math.min(rawJobs.length, 51); packageJobIndex++) {
        var sourceJob = rawJobs[packageJobIndex] || {};
        var jobName = String(sourceJob.JobName || '').trim();
        var apiEngineKey = String(sourceJob.ApiEngineKey || '').trim();
        var cronExpression = String(sourceJob.CronExpression || '').trim();
        var jobType = String(sourceJob.JobType || '1');
        var prefix = '第' + (packageJobIndex + 1) + '个定时任务';
        if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(jobName)) errors.push(prefix + ' JobName 不合法');
        if (jobName && names[jobName.toLowerCase()]) errors.push(prefix + ' JobName 重复：' + jobName);
        if (jobName) names[jobName.toLowerCase()] = true;
        if (!/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(apiEngineKey)) errors.push(prefix + ' ApiEngineKey 不合法');
        if (apiEngineKey && !packageEngineMap[apiEngineKey.toLowerCase()]) {
            errors.push(prefix + ' 引用的接口引擎未包含在当前应用包：' + apiEngineKey);
        }
        if (jobType != '1') errors.push(prefix + ' 只允许 JobType=1 的接口引擎任务');
        if (!cronExpression || cronExpression.length > 200) errors.push(prefix + ' CronExpression 不合法');
        if (String(sourceJob.JobParam || '').length > 16384
            || String(sourceJob.JobDesc || sourceJob.Description || '').length > 500
            || String(sourceJob.CronDesc || '').length > 500
            || String(sourceJob.TimeZoneId || '').length > 100) {
            errors.push(prefix + ' 参数或说明超过安全长度限制');
        }
        if (sourceJob.DllName || sourceJob.JobPath) errors.push(prefix + ' 不允许携带 DLL 或类型路径');
        jobs.push({
            JobName: jobName,
            JobDesc: String(sourceJob.JobDesc || sourceJob.Description || ''),
            JobParam: String(sourceJob.JobParam || ''),
            CronDesc: String(sourceJob.CronDesc || ''),
            CronExpression: cronExpression,
            TimeZoneId: String(sourceJob.TimeZoneId || ''),
            JobType: '1',
            ApiEngineKey: apiEngineKey
        });
    }
    return { Jobs: jobs, Errors: errors };
};
var scheduleJobContract = validateScheduleJobPackage(Package);

// 仅检查包体结构，不写数据库、不上传文件。用于发布前及跨平台安装前的安全验收。
if (V8.Param.ValidateOnly === true || String(V8.Param.Action || '').toLowerCase() == 'validate') {
    var validationErrors = [];
    for (var validationJobErrorIndex = 0; validationJobErrorIndex < scheduleJobContract.Errors.length; validationJobErrorIndex++) {
        validationErrors.push(scheduleJobContract.Errors[validationJobErrorIndex]);
    }
    var validationBundles = [];
    var rawBundles = Package.ApplicationBundles;
    if (rawBundles && rawBundles.length !== undefined) {
        for (var validationBundleIndex = 0; validationBundleIndex < rawBundles.length; validationBundleIndex++) {
            validationBundles.push(rawBundles[validationBundleIndex]);
        }
    }
    var legacyBundle = Package.ApplicationBundle || Package.AiApplication || Package.FrontendApplication;
    if (legacyBundle) validationBundles.push(legacyBundle);

    var supportedTypes = ['Web', 'UniApp', 'MicroService'];
    var validationSummary = [];
    for (var validationIndex = 0; validationIndex < validationBundles.length; validationIndex++) {
        var bundle = validationBundles[validationIndex] || {};
        var application = bundle.Application || {};
        var applicationType = String(bundle.ApplicationType || application.AppType || '');
        var packageAssets = bundle.PackageAssets || bundle.ZipAssets || null;
        if (typeof packageAssets == 'string') {
            try { packageAssets = JSON.parse(packageAssets); } catch (validationAssetError) { packageAssets = null; }
        }
        if (packageAssets && !packageAssets.BuildZip && !packageAssets.SourceZip && packageAssets.length !== undefined && typeof packageAssets != 'string') packageAssets = packageAssets.length ? packageAssets[0] : null;
        var sourceCount = packageAssets && packageAssets.SourceZip ? 1 : (bundle.SourceFiles && bundle.SourceFiles.length !== undefined ? bundle.SourceFiles.length : 0);
        var assetCount = packageAssets && packageAssets.BuildZip ? 1 : (bundle.BuildAssets && bundle.BuildAssets.length !== undefined ? bundle.BuildAssets.length : 0);
        var routeCount = bundle.Routes && bundle.Routes.length !== undefined ? bundle.Routes.length : 0;
        var validationSourceExpected = (packageAssets && packageAssets.IncludeSource)
            || bundle.IncludeSource === true || bundle.IncludeSource === 1 || String(bundle.IncludeSource || '').toLowerCase() == 'true'
            || Package.PackageInfo.IncludeSource === true || Package.PackageInfo.IncludeSource === 1 || String(Package.PackageInfo.IncludeSource || '').toLowerCase() == 'true';
        var embeddedSources = bundle.SourceFiles && bundle.SourceFiles.length !== undefined ? bundle.SourceFiles : [];
        var embeddedAssets = bundle.BuildAssets && bundle.BuildAssets.length !== undefined ? bundle.BuildAssets : [];
        var emptySourceContent = 0;
        var emptyBuildContent = 0;
        for (var validationSourceIndex = 0; validationSourceIndex < embeddedSources.length; validationSourceIndex++) {
            var validationSource = embeddedSources[validationSourceIndex] || {};
            if (!validationSource.FileByteBase64 && validationSource.Content === undefined && !validationSource.ContentBase64 && !validationSource.Base64) emptySourceContent++;
        }
        for (var validationAssetIndex = 0; validationAssetIndex < embeddedAssets.length; validationAssetIndex++) {
            var validationAsset = embeddedAssets[validationAssetIndex] || {};
            if (!validationAsset.FileByteBase64 && validationAsset.Content === undefined && !validationAsset.ContentBase64 && !validationAsset.Base64) emptyBuildContent++;
        }
        if (supportedTypes.indexOf(applicationType) < 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用类型不受支持：' + applicationType);
        if (!application.AppKey) validationErrors.push('第' + (validationIndex + 1) + '个AI应用缺少 Application.AppKey');
        if (!application.Name) validationErrors.push('第' + (validationIndex + 1) + '个AI应用缺少 Application.Name');
        if (validationSourceExpected && sourceCount < 1) validationErrors.push('第' + (validationIndex + 1) + '个AI应用声明包含源码但没有源码文件');
        if (emptySourceContent > 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用有' + emptySourceContent + '个源码文件缺少内嵌内容');
        if (emptyBuildContent > 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用有' + emptyBuildContent + '个编译文件缺少内嵌内容');
        if (assetCount < 1) validationErrors.push('第' + (validationIndex + 1) + '个AI应用没有公有编译产物');
        if (applicationType == 'MicroService' && !bundle.MicroService) validationErrors.push('第' + (validationIndex + 1) + '个微服务应用缺少 MicroService 运行配置');
        if (applicationType == 'MicroService' && routeCount < 1) validationErrors.push('第' + (validationIndex + 1) + '个微服务应用没有可安装路由');
        validationSummary.push({
            AppKey: application.AppKey || '',
            Name: application.Name || '',
            ApplicationType: applicationType,
            SourceFileCount: sourceCount,
            BuildAssetCount: assetCount,
            RouteCount: routeCount
        });
    }

    if (validationErrors.length > 0) {
        return {
            Code: 0,
            Data: { Errors: validationErrors, Applications: validationSummary },
            Msg: '应用数据包校验失败'
        };
    }
    return {
        Code: 1,
        Data: {
            PackageName: Package.PackageInfo.Name || '',
            PackageVersion: Package.PackageInfo.Version || Package.PackageInfo.AppVersion || '',
            ApplicationCount: validationBundles.length,
            Applications: validationSummary,
            MenuCount: Package.SysMenus && Package.SysMenus.length !== undefined ? Package.SysMenus.length : 0,
            TableCount: Package.DiyTables && Package.DiyTables.length !== undefined ? Package.DiyTables.length : 0,
            DataSetCount: Package.DataSets && Package.DataSets.length !== undefined ? Package.DataSets.length : 0,
            JobCount: scheduleJobContract.Jobs.length
        },
        Msg: '应用数据包结构校验通过，未执行写入'
    };
}

try {
    if (scheduleJobContract.Errors.length > 0) {
        throw new Error('定时任务资源校验失败：' + scheduleJobContract.Errors.join('；'));
    }
    if (scheduleJobContract.Jobs.length > 0 && !backgroundChunkingEnabled) {
        throw new Error('包含定时任务的应用必须通过持久后台任务安装，以便在资源事务提交后幂等调度。');
    }
    debugLog.startTime = new Date().toISOString();
    debugLog.packageInfo = Package.PackageInfo;
    reportProgress(5, '开始导入应用数据包');

    // ==================== 辅助函数：判断数据是否存在 ====================

    var checkExists = function (tableName, id) {
        var result = V8.FormEngine.GetFormData(tableName, {
            OsClient: V8.OsClient,
            Id: id
        });
        return result.Code == 1 && result.Data;
    };

    var writeResultMessage = function (value) {
        if (!value) return '';
        if (value.Msg !== undefined && value.Msg !== null) return String(value.Msg);
        if (value.message !== undefined && value.message !== null) return String(value.message);
        return String(value);
    };

    var isTransientDbWriteError = function (value) {
        return /deadlock|try restarting transaction|lock wait timeout|operation has timed out|connection.*timeout/i
            .test(writeResultMessage(value));
    };

    var isDuplicatePrimaryError = function (value) {
        return /duplicate entry.+primary/i.test(writeResultMessage(value));
    };

    var runWriteWithRetry = function (action, label) {
        var result = null;
        var maxAttempts = 6;
        for (var attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                result = action();
            } catch (writeError) {
                result = { Code: 0, Msg: writeError.message || String(writeError) };
            }
            if (result && result.Code == 1) return result;
            if (!isTransientDbWriteError(result) || attempt == maxAttempts) return result;

            var delay = Math.min(2000, 80 * attempt * attempt);
            debugLog['write_retry_' + label + '_' + attempt] = writeResultMessage(result);
            try { System.Threading.Thread.Sleep(delay); } catch (sleepError) { }
        }
        return result;
    };

    // Reinstalling a package must not run the expensive diy_field update path
    // for definitions that already match. Besides unnecessary DDL/cache work,
    // dozens of no-op FormEngine updates can exhaust Jint's allocation budget.
    var comparableFieldValue = function (value) {
        if (value === undefined) return '__undefined__';
        if (value === null) return '__null__';
        if (typeof value == 'object') {
            try { return JSON.stringify(value); } catch (error) { return String(value); }
        }
        return String(value);
    };
    var fieldDefinitionNeedsUpdate = function (oldField, fieldCopy) {
        if (!oldField) return true;
        var ignored = {
            Id: true,
            CreateTime: true,
            UpdateTime: true,
            CreateUser: true,
            CreateUserId: true,
            UserId: true,
            UserName: true
        };
        for (var fieldKey in fieldCopy) {
            if (!Object.prototype.hasOwnProperty.call(fieldCopy, fieldKey) || ignored[fieldKey]) continue;
            if (comparableFieldValue(oldField[fieldKey]) != comparableFieldValue(fieldCopy[fieldKey])) return true;
        }
        return false;
    };

    // ==================== 统计变量 ====================

    var stats = {
        TableInserted: 0,
        TableUpdated: 0,
        TableIdRemapped: 0,
        FieldInserted: 0,
        FieldUpdated: 0,
        FieldSkipped: 0,
        FieldIdRemapped: 0,
        MenuInserted: 0,
        MenuUpdated: 0,
        MenuIdRemapped: 0,
        AdminRoleLimitInserted: 0,
        AdminRoleLimitUpdated: 0,
        AdminRoleLimitSkipped: 0,
        ReferenceRowsUpdated: 0,
        FlowInserted: 0,
        FlowUpdated: 0,
        NodeInserted: 0,
        NodeUpdated: 0,
        LineInserted: 0,
        LineUpdated: 0,
        ApiEngineInserted: 0,
        ApiEngineUpdated: 0,
        ApiEngineSkipped: 0,
        VersionRecordUpdated: 0,
        ApplicationInstalled: 0,
        ApplicationSourceFiles: 0,
        ApplicationSourceFilesReused: 0,
        ApplicationBuildAssets: 0,
        ApplicationBuildAssetsReused: 0,
        AssetRowsPruned: 0,
        MicroServicePages: 0,
        MicroServiceMenus: 0,
        MicroServiceMenusPreserved: 0,
        DataSetCount: 0,
        DataInserted: 0,
        DataUpdated: 0,
        DataSkipped: 0,
        ScheduleJobSaved: 0
    };

    var savePackageScheduleJobs = function () {
        if (scheduleJobContract.Jobs.length === 0) return;
        if (!V8.Method || !V8.Method.SaveScheduleJob) {
            throw new Error('当前平台版本不支持应用定时任务安装，请先升级 Microi吾码平台。');
        }
        for (var scheduleJobIndex = 0; scheduleJobIndex < scheduleJobContract.Jobs.length; scheduleJobIndex++) {
            var scheduleJob = scheduleJobContract.Jobs[scheduleJobIndex];
            var scheduleResult = V8.Method.SaveScheduleJob(scheduleJob);
            if (!scheduleResult || scheduleResult.Code != 1) {
                throw new Error('保存定时任务失败：' + scheduleJob.JobName + '，'
                    + ((scheduleResult && scheduleResult.Msg) || '接口无返回'));
            }
            stats.ScheduleJobSaved++;
        }
    };

    var persistentSchemaStatNames = [
        'DDLExecuted', 'DDLSkipped', 'FieldsAdded',
        'TableInserted', 'TableUpdated', 'TableIdRemapped',
        'FieldInserted', 'FieldUpdated', 'FieldSkipped', 'FieldIdRemapped',
        'PhysicalFieldsAdded', 'PhysicalFieldsRenamed', 'PhysicalFieldsModified',
        'PhysicalFieldsSkipped', 'PhysicalFieldsErrors'
    ];
    var snapshotPersistentSchemaStats = function () {
        var result = {};
        for (var schemaStatIndex = 0; schemaStatIndex < persistentSchemaStatNames.length; schemaStatIndex++) {
            var schemaStatName = persistentSchemaStatNames[schemaStatIndex];
            var schemaStatValue = Number(stats[schemaStatName] || 0);
            if (schemaStatValue) result[schemaStatName] = schemaStatValue;
        }
        return result;
    };
    if (backgroundChunkingEnabled
        && backgroundCheckpoint.SchemaStats
        && String(backgroundCheckpoint.TaskId || '') == String(backgroundTaskId || '')) {
        for (var restoreStatIndex = 0; restoreStatIndex < persistentSchemaStatNames.length; restoreStatIndex++) {
            var restoreStatName = persistentSchemaStatNames[restoreStatIndex];
            var restoreStatValue = Number(backgroundCheckpoint.SchemaStats[restoreStatName] || 0);
            if (!isNaN(restoreStatValue) && restoreStatValue >= 0) stats[restoreStatName] = restoreStatValue;
        }
    }

    var assertSchemaChunkSucceeded = function (label) {
        var chunkErrors = [];
        for (var chunkLogKey in debugLog) {
            if (Object.prototype.hasOwnProperty.call(debugLog, chunkLogKey)
                && chunkLogKey.indexOf('_error_') > -1) {
                chunkErrors.push(chunkLogKey + ': ' + String(debugLog[chunkLogKey] || '未知错误'));
            }
        }
        if (chunkErrors.length > 0) {
            throw new Error(label + '分片存在' + chunkErrors.length + '个错误：' + chunkErrors.slice(0, 3).join('；'));
        }
    };

    // 微服务页面安装完成后，再按路由元数据迁移目标库中的历史 Vue 菜单。
    // 保留旧 Url 兼容书签，只把运行入口切换到已发布的微服务宿主。
    var applicationMenuBindings = [];

    var normalizeRouteMeta = function (route) {
        route = route || {};
        var meta = {};
        if (route.RouteMetaJson) {
            try { meta = JSON.parse(route.RouteMetaJson) || {}; } catch (routeMetaError) { meta = {}; }
        }
        var metaFields = [
            'PageKey', 'PageName', 'PageTitle', 'RoutePath', 'EntryPath',
            'Sort', 'IsHome', 'IsEnable', 'LegacyMenuUrls', 'LegacyMenuUrl',
            'LegacyComponentPaths', 'LegacyComponentPath'
        ];
        for (var metaFieldIndex = 0; metaFieldIndex < metaFields.length; metaFieldIndex++) {
            var metaField = metaFields[metaFieldIndex];
            if ((meta[metaField] === undefined || meta[metaField] === null || meta[metaField] === '')
                && route[metaField] !== undefined && route[metaField] !== null && route[metaField] !== '') {
                meta[metaField] = route[metaField];
            }
        }
        return meta;
    };

    var legacyRouteValues = function (route, pluralName, singleName) {
        route = route || {};
        var meta = normalizeRouteMeta(route);
        var value = meta[pluralName] || meta[singleName] || route[pluralName] || route[singleName] || [];
        if (typeof value == 'string') {
            var trimmed = value.replace(/^\s+|\s+$/g, '');
            if (!trimmed) return [];
            try { value = JSON.parse(trimmed); } catch (legacyValueError) { value = [trimmed]; }
        }
        if (!value || value.length === undefined) value = [value];
        var result = [];
        for (var legacyIndex = 0; legacyIndex < value.length; legacyIndex++) {
            var item = firstTextParam([value[legacyIndex]]).replace(/^\s+|\s+$/g, '');
            if (item && result.indexOf(item) < 0) result.push(item);
        }
        return result;
    };

    // ==================== Web / UniApp / MicroService 应用资产安装 ====================

    var normalizeApplicationPath = function (value) {
        var path = firstTextParam([value]).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        var parts = path.split('/');
        var safe = [];
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (!part || part == '.' || part == '..') continue;
            safe.push(part.replace(/[:*?"<>|]/g, '_'));
        }
        return safe.join('/');
    };

    var applicationFileName = function (path) {
        var normalized = normalizeApplicationPath(path);
        var parts = normalized.split('/');
        return parts[parts.length - 1] || 'file';
    };

    var applicationFileDir = function (path) {
        var normalized = normalizeApplicationPath(path);
        var index = normalized.lastIndexOf('/');
        return index > -1 ? normalized.substring(0, index) : '';
    };

    var applicationFileType = function (path) {
        var fileName = applicationFileName(path);
        var index = fileName.lastIndexOf('.');
        return index > -1 ? fileName.substring(index + 1).toLowerCase() : 'bin';
    };

    // 安装包是跨租户资产：HTML 中的发布端 ApiBase/OsClient 不能原样带到目标环境。
    // 每次安装都按目标租户重写运行时上下文，因此公开入口无需查询参数。
    var rewriteApplicationRuntimeContext = function (rootPath, relativePath, base64) {
        if (!/^(ai-app-publish|micro-app)\//i.test(String(rootPath || '')) || !/\.html?$/i.test(String(relativePath || ''))) {
            return base64;
        }
        var apiBase = firstTextParam([V8.SysConfig && V8.SysConfig.ApiBase]).replace(/\/+$/g, '');
        if (!apiBase) throw new Error('SysConfig.ApiBase不能为空，无法写入应用运行时上下文');
        var contextJson = JSON.stringify({ ApiBase: apiBase, OsClient: String(V8.OsClient || '') })
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
        var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(String(base64 || '')));
        var runtimeScript = '<script data-microi-runtime-context="true">(function(){var c=' + contextJson + ';window.__MICROI_APP_CONTEXT__=Object.assign({},window.__MICROI_APP_CONTEXT__||{},c);window.MICROI_API_BASE=c.ApiBase;window.MICROI_OS_CLIENT=c.OsClient;})();<\/script>';
        var existing = /<script\b[^>]*data-microi-runtime-context=["']true["'][^>]*>[\s\S]*?<\/script>/i;
        if (existing.test(html)) html = html.replace(existing, runtimeScript);
        else {
            var head = /<head\b[^>]*>/i.exec(html);
            html = head
                ? html.substring(0, head.index + head[0].length) + runtimeScript + html.substring(head.index + head[0].length)
                : runtimeScript + html;
        }
        return System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(html));
    };

    var getUploadedHdfsPath = function (uploadResult) {
        var data = uploadResult && uploadResult.Data ? uploadResult.Data : {};
        if (data && data.length && data[0]) data = data[0];
        return firstTextParam([data.FilePathName, data.FilePath, data.Path, data.Url, data.url]);
    };

    var base64DecodedSize = function (value) {
        var text = String(value || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
        if (!text) return 0;
        var padding = text.substring(Math.max(0, text.length - 2)).replace(/[^=]/g, '').length;
        return Math.max(0, Math.floor(text.length * 3 / 4) - padding);
    };

    var uploadApplicationAsset = function (rootPath, file, limit) {
        var relativePath = normalizeApplicationPath(file.Path || file.FilePath || file.RelativePath || file.FileName);
        if (!relativePath) throw new Error('应用资产路径不能为空');
        var base64 = firstTextParam([file.FileByteBase64, file.ContentBase64, file.Base64]);
        if (!base64 && file.Content !== undefined && file.Content !== null) {
            base64 = V8.Base64.StringToBase64(String(file.Content));
        }
        if (!base64) throw new Error('应用资产缺少文件内容：' + relativePath);
        var originalBase64 = base64;
        base64 = rewriteApplicationRuntimeContext(rootPath, relativePath, base64);
        var runtimeContextChanged = base64 !== originalBase64;
        var dir = applicationFileDir(relativePath);
        var files = {};
        files[applicationFileName(relativePath)] = base64;
        var result = V8.Method.Upload({
            OsClient: V8.OsClient,
            Path: rootPath + (dir ? '/' + dir : ''),
            Limit: limit === true,
            Preview: false,
            FilesByteBase64: files
        });
        if (!result || result.Code != 1) {
            throw new Error('HDFS 存储不可用或上传失败：' + relativePath + '，' + ((result && result.Msg) || '接口无返回'));
        }
        var hdfsPath = getUploadedHdfsPath(result);
        if (!hdfsPath) throw new Error('HDFS 上传成功但未返回文件路径：' + relativePath);
        // ASSET_METADATA_WITHOUT_SECOND_DECODE_V1：Upload 已经完成一次 Base64 解码，
        // 非 HTML 资产直接复用包内摘要/大小，禁止为了统计再次构造完整 byte[]。
        var packagedSize = Number(file.Size || 0);
        var packagedHash = firstTextParam([file.Sha256, file.Hash, file.ContentHash]).toLowerCase();
        var actualSize = !runtimeContextChanged && packagedSize > 0
            ? packagedSize
            : base64DecodedSize(base64);
        var actualHash = !runtimeContextChanged && packagedHash
            ? packagedHash
            : (V8.EncryptHelper && V8.EncryptHelper.Sha256Hex
                ? String(V8.EncryptHelper.Sha256Hex(base64)).toLowerCase()
                : packagedHash);
        return { Path: relativePath, HdfsPath: hdfsPath, FilePathName: hdfsPath, Size: actualSize, Hash: actualHash };
    };

    var getApplicationRow = function (tableName, rowId, where) {
        if (rowId) {
            var existingById = V8.FormEngine.GetFormData(tableName, { Id: rowId, _PageSize: 1 });
            if (existingById && existingById.Code == 1 && existingById.Data && existingById.Data.Id) {
                return existingById.Data;
            }
        }
        if (!where || !where.length) return null;
        var existingByWhere = V8.FormEngine.GetFormData(tableName, { _Where: where, _PageSize: 1 });
        return existingByWhere && existingByWhere.Code == 1 && existingByWhere.Data && existingByWhere.Data.Id
            ? existingByWhere.Data
            : null;
    };

    var upsertApplicationRow = function (tableName, where, row) {
        row = row || {};
        var existing = getApplicationRow(tableName, row.Id, where);
        if (existing && existing.Id) {
            row.Id = existing.Id;
            return runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData(tableName, row);
            }, 'app_upt_' + tableName + '_' + row.Id);
        }
        return runWriteWithRetry(function () {
            return V8.FormEngine.AddFormData(tableName, row);
        }, 'app_add_' + tableName + '_' + (row.Id || 'new'));
    };

    var loadExistingApplicationAssets = function (appId) {
        var existingApplicationAssets = {};
        if (!resumeInstall || !appId) return existingApplicationAssets;
        var result = V8.FormEngine.GetTableData('mci_ai_app_file', {
            _Where: [['AppId', '=', appId]],
            _SelectFields: ['Id', 'FilePath', 'HdfsPath', 'PublishHdfsPath', 'ContentHash', 'Size'],
            _PageIndex: 1,
            _PageSize: 20000
        });
        var rows = result && result.Code == 1 && result.Data ? result.Data : [];
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            var row = rows[rowIndex] || {};
            var path = normalizeApplicationPath(row.FilePath);
            if (path) existingApplicationAssets[path.toLowerCase()] = row;
        }
        return existingApplicationAssets;
    };

    var reuseApplicationAsset = function (existingApplicationAssets, filePath, file) {
        if (!resumeInstall) return null;
        var normalizedPath = normalizeApplicationPath(filePath);
        var existing = existingApplicationAssets[normalizedPath.toLowerCase()];
        if (!existing || !existing.Id || !existing.HdfsPath) return null;
        var expectedHash = firstTextParam([file && file.Sha256, file && file.Hash, file && file.ContentHash]).toLowerCase();
        var actualHash = firstTextParam([existing.ContentHash]).toLowerCase();
        if (expectedHash && actualHash != expectedHash) return null;
        var expectedSize = Number((file && file.Size) || 0);
        var actualSize = Number(existing.Size || 0);
        if (!expectedHash && expectedSize > 0 && actualSize != expectedSize) return null;
        if (!expectedHash && expectedSize <= 0) return null;
        return {
            Path: normalizedPath,
            HdfsPath: existing.HdfsPath,
            FilePathName: existing.HdfsPath,
            Size: actualSize,
            Hash: actualHash,
            Reused: true
        };
    };

    var pruneApplicationAssets = function (appId, expectedPaths) {
        if (!resumeInstall || !appId) return;
        var existingApplicationAssets = loadExistingApplicationAssets(appId);
        var staleIds = [];
        for (var existingPath in existingApplicationAssets) {
            if (!expectedPaths[existingPath]) staleIds.push(String(existingApplicationAssets[existingPath].Id));
        }
        if (!staleIds.length) return;
        // PRUNE_ASSET_IDS_WITH_DELFORM_V1：Jint 数组无法稳定匹配 DelTableData 的
        // .NET 重载；统一走 DelFormData + Ids 批量删除，避免后台任务在清理阶段失败。
        var pruneResult = V8.FormEngine.DelFormData('mci_ai_app_file', { Ids: staleIds });
        if (!pruneResult || pruneResult.Code != 1) {
            throw new Error('清理应用旧文件元数据失败：' + ((pruneResult && pruneResult.Msg) || '接口无返回'));
        }
        stats.AssetRowsPruned += staleIds.length;
    };

    var getApplicationAssetUrl = function (asset) {
        asset = asset || {};
        var direct = firstTextParam([asset.FullPath, asset.Url, asset.url, asset.FileUrl]);
        if (/^https?:\/\//i.test(direct)) return direct;
        var filePathName = firstTextParam([asset.FilePathName, asset.HdfsPath, asset.FilePath, asset.Path, direct]);
        if (!filePathName) throw new Error('ZIP资产缺少公开下载地址');
        var urlResult = V8.Method.GetPrivateFileUrl({
            OsClient: V8.OsClient,
            FilePathName: filePathName,
            Limit: false
        });
        if (!urlResult || urlResult.Code != 1) throw new Error('获取ZIP公开地址失败：' + filePathName);
        var data = urlResult.Data || {};
        return typeof data == 'string' ? data : firstTextParam([data.Url, data.url, data.FileUrl, data.FullPath, data.Path]);
    };

    // 发布端使用 Sha256Hex(Base64文本) 生成 ZIP 摘要，导入端必须保持相同口径。
    var applicationSha256Base64 = function (base64) {
        if (!V8.EncryptHelper || !V8.EncryptHelper.Sha256Hex) {
            throw new Error('当前平台不支持ZIP SHA256校验，请先升级V8引擎');
        }
        return String(V8.EncryptHelper.Sha256Hex(String(base64 || ''))).toLowerCase();
    };

    var downloadApplicationZip = function (asset, role) {
        if (!asset) return [];
        var url = getApplicationAssetUrl(asset);
        if (!url) throw new Error(role + ' ZIP 未返回公开下载地址');
        var response = V8.Http.GetResponse({ Url: url, Timeout: 300 });
        if (!response || !response.RawBytes) throw new Error('下载' + role + ' ZIP失败');
        var zipBase64 = System.Convert.ToBase64String(response.RawBytes);
        var expectedHash = firstTextParam([asset.Sha256, asset.Hash, asset.ContentHash]).toLowerCase();
        if (expectedHash && applicationSha256Base64(zipBase64) != expectedHash) {
            throw new Error(role + ' ZIP SHA256校验失败，文件可能已损坏');
        }
        var extractResult = V8.Method.ExtractZip({
            FileByteBase64: zipBase64,
            MaxFileCount: 20000,
            MaxEntryBytes: 268435456,
            MaxTotalBytes: 2147483648,
            MaxCompressionRatio: 200
        });
        if (!extractResult || extractResult.Code != 1 || !extractResult.Data) {
            throw new Error('解压' + role + ' ZIP失败：' + ((extractResult && extractResult.Msg) || '接口无返回'));
        }
        var entries = extractResult.Data.Entries || [];
        var files = [];
        for (var zipIndex = 0; zipIndex < entries.length; zipIndex++) {
            var entry = entries[zipIndex] || {};
            if (String(entry.Path || '') == 'microi-app-version.json') continue;
            files.push(entry);
        }
        return files;
    };

    var parsePackageAssets = function (value) {
        if (!value) return null;
        if (typeof value == 'string') {
            try { value = JSON.parse(value); } catch (assetParseError) { throw new Error('PackageAssets不是有效JSON'); }
        }
        if (value && (value.BuildZip || value.SourceZip)) return value;
        if (value && value.length !== undefined && typeof value != 'string') return value.length ? value[0] : null;
        return value;
    };

    var installApplicationBundle = function (bundle, bundleIndex) {
        if (!bundle) return;

        var app = bundle.Application || bundle.App || {};
        var appType = firstTextParam([bundle.ApplicationType, app.ApplicationType, app.AppType, Package.PackageInfo.ApplicationType, 'Web']);
        if (['Web', 'UniApp', 'MicroService'].indexOf(appType) < 0) {
            throw new Error('不支持的应用类型：' + appType);
        }
        var microServiceConfig = bundle.MicroService || {};
        var runtimeStorageMode = String(appType == 'MicroService'
            ? firstTextParam([microServiceConfig.StorageMode, 'file'])
            : 'file').replace(/^\s+|\s+$/g, '');
        var inlineRuntimeBuild = /^(db|database)$/i.test(runtimeStorageMode);
        if (inlineRuntimeBuild) runtimeStorageMode = 'db';
        var appKey = firstTextParam([app.AppKey, app.MsKey, V8.Param.AppId, Package.PackageInfo.AppId]);
        if (!appKey) throw new Error('ApplicationBundle.Application.AppKey 不能为空');
        var appId = firstTextParam([app.Id, bundle.AppId, V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid()]);
        var appName = firstTextParam([app.Name, app.MsName, Package.PackageInfo.Name, appKey]);
        var existingApp = getApplicationRow('sys_microistore', appId, [['AppKey', '=', appKey]]);
        var preserveExistingNativeMenus = !!(existingApp && existingApp.Id);
        var previousAppKey = '';
        if (existingApp && existingApp.Id) {
            appId = existingApp.Id;
            previousAppKey = firstTextParam([existingApp.AppKey]);
        }
        var sourceRoot = 'ai-app-source/' + appId;
        var existingApplicationAssets = loadExistingApplicationAssets(appId);
        var expectedApplicationPaths = {};
        var packageAssets = parsePackageAssets(bundle.PackageAssets || bundle.ZipAssets || null);
        // 真离线包优先使用 JSON 内嵌文件；没有内嵌文件时才兼容商城公网 ZIP。
        var embeddedSourceFiles = bundle.SourceFiles || bundle.Files || [];
        var sourceFiles = embeddedSourceFiles && embeddedSourceFiles.length !== undefined && embeddedSourceFiles.length
            ? embeddedSourceFiles
            : (packageAssets && packageAssets.SourceZip ? downloadApplicationZip(packageAssets.SourceZip, '源码') : []);
        var sourceExpected = bundle.IncludeSource === true || bundle.IncludeSource === 1
            || String(bundle.IncludeSource || '').toLowerCase() == 'true'
            || Package.PackageInfo.IncludeSource === true || Package.PackageInfo.IncludeSource === 1
            || String(Package.PackageInfo.IncludeSource || '').toLowerCase() == 'true';
        if (sourceExpected && (!sourceFiles || !sourceFiles.length)) {
            throw new Error('安装包声明包含私有源码，但源码文件为空，已停止安装，避免只安装运行产物。');
        }
        var uploadedSource = [];
        reportProgress(60, '正在写入' + appType + '应用私有源码');
        var totalBundleAssets = sourceFiles.length;
        for (var i = 0; i < sourceFiles.length; i++) {
            var sourceFile = sourceFiles[i] || {};
            var sourcePath = normalizeApplicationPath(sourceFile.Path || sourceFile.FilePath || sourceFile.RelativePath || sourceFile.FileName);
            expectedApplicationPaths[sourcePath.toLowerCase()] = true;
            var sourceUpload = reuseApplicationAsset(existingApplicationAssets, sourcePath, sourceFile);
            if (!sourceUpload) {
                if (shouldContinueApplicationAssets(sourceFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'Source', i, totalBundleAssets);
                }
                sourceUpload = uploadApplicationAsset(sourceRoot, sourceFile, true);
                markApplicationAssetUploaded(sourceFile);
            }
            uploadedSource.push(sourceUpload);
            if (sourceUpload.Reused) {
                stats.ApplicationSourceFilesReused++;
                continue;
            }
            var sourceRow = {
                AppId: appId,
                AppName: appName,
                FilePath: sourceUpload.Path,
                FileName: applicationFileName(sourceUpload.Path),
                FileType: applicationFileType(sourceUpload.Path),
                HdfsPath: sourceUpload.HdfsPath,
                StorageScope: 'Private',
                ContentHash: sourceUpload.Hash,
                Size: sourceUpload.Size,
                IsDirectory: 0,
                Version: parseInt(sourceFile.Version || 1, 10) || 1
            };
            var sourceResult = upsertApplicationRow('mci_ai_app_file', [
                ['AppId', '=', appId],
                ['AND', 'FilePath', '=', sourceUpload.Path]
            ], sourceRow);
            if (!sourceResult || sourceResult.Code != 1) throw new Error('写入应用源码元数据失败：' + sourceUpload.Path + '，' + ((sourceResult && sourceResult.Msg) || ''));
            stats.ApplicationSourceFiles++;
        }

        var versionNo = firstTextParam([bundle.VersionNo, app.BuildVersion, Package.PackageInfo.Version, 'v1.0.0']);
        if (versionNo.charAt(0).toLowerCase() != 'v') versionNo = 'v' + versionNo;
        var buildRoot = appType == 'MicroService'
            ? 'micro-app/' + appKey + '/' + versionNo
            : 'ai-app-publish/' + appKey + '/versions/' + versionNo;
        var embeddedBuildAssets = bundle.BuildAssets || bundle.Assets || [];
        var buildAssets = embeddedBuildAssets && embeddedBuildAssets.length !== undefined && embeddedBuildAssets.length
            ? embeddedBuildAssets
            : (packageAssets && packageAssets.BuildZip ? downloadApplicationZip(packageAssets.BuildZip, '编译') : []);
        totalBundleAssets += buildAssets.length;
        var uploadedBuild = [];
        var runtimeDbAssets = [];
        var moveBuildToStablePath = function (buildUpload, stableBuildPath) {
            if (!V8.Method.MoveObject || !buildUpload.HdfsPath || !stableBuildPath) return false;
            if (normalizeApplicationPath(buildUpload.HdfsPath).toLowerCase() == stableBuildPath.toLowerCase()) {
                buildUpload.HdfsPath = stableBuildPath;
                buildUpload.FilePathName = stableBuildPath;
                buildUpload.PublishHdfsPath = stableBuildPath;
                return true;
            }
            try {
                var moveBuildResult = V8.Method.MoveObject({
                    OsClient: V8.OsClient,
                    FilePathName: buildUpload.HdfsPath,
                    Path: stableBuildPath,
                    Limit: false
                });
                if (moveBuildResult && moveBuildResult.Code == 1) {
                    buildUpload.HdfsPath = stableBuildPath;
                    buildUpload.FilePathName = stableBuildPath;
                    buildUpload.PublishHdfsPath = stableBuildPath;
                    return true;
                }
            } catch (moveBuildError) {
                // 老版本存储实现可能不支持 MoveObject；调用方保留或重传可用对象。
            }
            return false;
        };
        reportProgress(65, '正在写入' + appType + '应用公有编译文件');
        for (var b = 0; b < buildAssets.length; b++) {
            var buildFile = buildAssets[b] || {};
            var buildRelativePath = normalizeApplicationPath(buildFile.Path || buildFile.FilePath || buildFile.RelativePath || buildFile.FileName);
            var buildMetadataPath = 'dist/' + buildRelativePath;
            expectedApplicationPaths[buildMetadataPath.toLowerCase()] = true;
            var buildUpload = reuseApplicationAsset(existingApplicationAssets, buildMetadataPath, buildFile);
            var buildWasReused = !!buildUpload;
            var reusedBuildHdfsPath = buildWasReused ? normalizeApplicationPath(buildUpload.HdfsPath).toLowerCase() : '';
            if (buildWasReused) {
                buildUpload.Path = buildRelativePath;
                stats.ApplicationBuildAssetsReused++;
            } else {
                if (shouldContinueApplicationAssets(buildFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'Build', b, totalBundleAssets);
                }
                buildUpload = uploadApplicationAsset(buildRoot, buildFile, false);
                markApplicationAssetUploaded(buildFile);
            }
            var normalizedBuildPath = normalizeApplicationPath(buildUpload.Path);
            // MICRO_APP_PUBLIC_HDFS_PATH_V1：公有桶对象 Key 必须带租户前缀。
            // MoveObject 的 Path 是目标对象完整 Key，不是目录；移动成功后运行清单
            // 也必须切换到同一个真实 Key，不能继续保留已被删除的临时上传路径。
            var stableBuildPath = appType == 'MicroService'
                ? normalizeApplicationPath(String(V8.OsClient || '').toLowerCase() + '/' + buildRoot + '/' + normalizedBuildPath)
                : normalizeApplicationPath(String(V8.OsClient || '').toLowerCase() + '/ai-app-publish/' + appKey + '/' + normalizedBuildPath);
            var buildPathRepaired = moveBuildToStablePath(buildUpload, stableBuildPath);
            // SKIP_MOVE_FOR_REUSED_BUILD_V1：已处于当前租户稳定 Key 的断点资产不重复移动。
            // 旧版错误 Key 若已被移动或删除，则从本次自包含包重传，再尝试写入正确 Key。
            if (buildWasReused && !buildPathRepaired) {
                if (shouldContinueApplicationAssets(buildFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'BuildRepair', b, totalBundleAssets);
                }
                buildUpload = uploadApplicationAsset(buildRoot, buildFile, false);
                markApplicationAssetUploaded(buildFile);
                buildUpload.Path = buildRelativePath;
                stats.ApplicationBuildAssetsReused--;
                buildWasReused = false;
                moveBuildToStablePath(buildUpload, stableBuildPath);
            }
            uploadedBuild.push(buildUpload);
            // DB_RUNTIME_BUILD_ASSETS_V1：目标环境的 FileServer/CDN 可能与开发环境不同。
            // 离线包显式选择 db/database 时，把公有编译产物同步写入运行清单；
            // 私有源码与编译资产仍照常上传 HDFS，保持开发、重建与切回 file 模式能力。
            if (inlineRuntimeBuild) {
                var runtimeBuildBase64 = firstTextParam([buildFile.FileByteBase64, buildFile.ContentBase64, buildFile.Base64]);
                if (!runtimeBuildBase64 && buildFile.Content !== undefined && buildFile.Content !== null) {
                    runtimeBuildBase64 = V8.Base64.StringToBase64(String(buildFile.Content));
                }
                if (!runtimeBuildBase64) {
                    throw new Error('DB运行模式缺少内嵌编译内容：' + normalizedBuildPath);
                }
                runtimeDbAssets.push({
                    Path: normalizedBuildPath,
                    FileName: buildFile.FileName || applicationFileName(normalizedBuildPath),
                    ContentType: buildFile.ContentType || '',
                    ContentBase64: runtimeBuildBase64,
                    Size: buildUpload.Size,
                    Hash: buildUpload.Hash,
                    IsEntry: buildFile.IsEntry === true || buildFile.IsEntry === 1
                });
            }
            if (buildWasReused && buildPathRepaired
                && reusedBuildHdfsPath == stableBuildPath.toLowerCase()) continue;
            // 安装后的 Web/UniApp 仍须保留真实 dist 元数据，才能继续编辑源码、
            // 重新构建并打包，而不是退回只生成一张兼容预览页。
            var buildAssetRow = {
                AppId: appId,
                AppName: appName,
                FilePath: 'dist/' + normalizedBuildPath,
                FileName: applicationFileName(normalizedBuildPath),
                FileType: applicationFileType(normalizedBuildPath),
                HdfsPath: buildUpload.HdfsPath,
                PublishHdfsPath: buildUpload.HdfsPath,
                StorageScope: 'PrivateSource+PublicBuild',
                ContentHash: buildUpload.Hash,
                Size: buildUpload.Size,
                IsDirectory: 0,
                Version: 1
            };
            var buildAssetResult = upsertApplicationRow('mci_ai_app_file', [
                ['AppId', '=', appId],
                ['AND', 'FilePath', '=', buildAssetRow.FilePath]
            ], buildAssetRow);
            if (!buildAssetResult || buildAssetResult.Code != 1) {
                throw new Error('写入应用编译资产元数据失败：' + normalizedBuildPath + '，' + ((buildAssetResult && buildAssetResult.Msg) || ''));
            }
            if (!buildWasReused) stats.ApplicationBuildAssets++;
        }

        // 只有源码和编译产物都完整走完后才移除旧路径。请求中途超时时，已上传
        // 文件仍保留并可在下一次 ResumeInstall 调用中复用，不会形成无限重传。
        pruneApplicationAssets(appId, expectedApplicationPaths);

        var entryPath = firstTextParam([bundle.EntryPath, app.EntryPath, 'index.html']);
        var entryHdfsPath = '';
        for (var ep = 0; ep < uploadedBuild.length; ep++) {
            if (normalizeApplicationPath(uploadedBuild[ep].Path).toLowerCase() == normalizeApplicationPath(entryPath).toLowerCase()) {
                entryHdfsPath = uploadedBuild[ep].HdfsPath;
                break;
            }
        }
        if (!entryHdfsPath && uploadedBuild.length) entryHdfsPath = uploadedBuild[0].HdfsPath;
        var previewUrl = entryHdfsPath;
        if (entryHdfsPath && V8.Method.GetPrivateFileUrl) {
            var urlResult = V8.Method.GetPrivateFileUrl({ OsClient: V8.OsClient, FilePathName: entryHdfsPath, Limit: false });
            if (urlResult && urlResult.Code == 1) {
                var urlData = urlResult.Data || {};
                previewUrl = typeof urlData == 'string' ? urlData : firstTextParam([urlData.Url, urlData.url, urlData.FileUrl, urlData.Path, entryHdfsPath]);
            }
        }

        var appRow = {
            Id: appId,
            Name: appName,
            AppName: appName,
            AppKey: appKey,
            AppId: appKey,
            AppType: appType,
            ApplicationType: appType,
            Category: firstTextParam([app.Category, bundle.Category, 'other']),
            PublisherType: firstTextParam([app.PublisherType, bundle.PublisherType, '官方应用']),
            OwnerUserId: firstTextParam([existingApp && existingApp.OwnerUserId, installUser.Id, app.OwnerUserId, app.UserId]),
            OwnerName: firstTextParam([existingApp && existingApp.OwnerName, installUser.Name, installUser.Account, app.OwnerName, app.UserName]),
            Description: firstTextParam([app.Description, app.Remark, Package.PackageInfo.Description]),
            AppDetail: firstTextParam([app.Description, app.Remark, Package.PackageInfo.Description]),
            AppDetail: firstTextParam([app.Description, app.Remark, Package.PackageInfo.Description]),
            AppDetail: firstTextParam([app.Description, app.Remark, Package.PackageInfo.Description]),
            Status: uploadedBuild.length ? 'Published' : 'Draft',
            BuildStatus: uploadedBuild.length ? 'Success' : 'Changed',
            CurrentVersion: parseInt(app.CurrentVersion || 1, 10) || 1,
            AppVersion: versionNo,
            IsApprove: uploadedBuild.length ? 1 : 0,
            PreviewUrl: previewUrl,
            PrivateSourcePath: uploadedSource.length ? sourceRoot : firstTextParam([existingApp && existingApp.PrivateSourcePath, app.PrivateSourcePath]),
            PublicPublishPath: buildRoot
        };
        var appResult = upsertApplicationRow('sys_microistore', [['AppKey', '=', appKey]], appRow);
        if (!appResult || appResult.Code != 1) throw new Error('写入统一应用商城失败：' + ((appResult && appResult.Msg) || ''));
        if (sourceExpected) {
            var installedSources = V8.FormEngine.GetTableData('mci_ai_app_file', {
                _Where: [['AppId', '=', appId]],
                _SelectFields: ['Id'],
                _PageIndex: 1,
                _PageSize: 1
            });
            if (!installedSources || installedSources.Code != 1 || !installedSources.Data || !installedSources.Data.length) {
                throw new Error('私有源码写入后回读为空，已停止安装，请检查目标租户私有 HDFS 配置。');
            }
        }

        if (uploadedBuild.length) {
            var versionRow = {
                AppId: appId,
                AppName: appName,
                VersionNo: versionNo,
                VersionName: versionNo,
                Status: 'Published',
                PublishPath: buildRoot,
                PreviewUrl: previewUrl,
                BuildLog: '',
                ChangeSummary: '从应用商城安装',
                FileCount: uploadedBuild.length,
                TotalSize: 0
            };
            upsertApplicationRow('mci_ai_app_version', [['AppId', '=', appId], ['AND', 'VersionNo', '=', versionNo]], versionRow);
        }

        if (appType == 'MicroService') {
            var ms = microServiceConfig;
            var existingService = getApplicationRow('sys_microiservice', firstTextParam([ms.Id]), [['MsKey', '=', appKey]]);
            if (!existingService && previousAppKey && previousAppKey != appKey) {
                existingService = getApplicationRow('sys_microiservice', '', [['MsKey', '=', previousAppKey]]);
            }
            var serviceRow = {
                MsKey: appKey,
                MsName: appName,
                MsType: firstTextParam([ms.MsType, '前端']),
                Runtime: firstTextParam([ms.Runtime, 'micro-app']),
                StorageMode: runtimeStorageMode,
                IsEnable: ms.IsEnable === 0 ? 0 : 1,
                SourceDirName: firstTextParam([ms.SourceDirName, appKey]),
                EntryPath: entryPath,
                BuildVersion: versionNo,
                AssetCount: uploadedBuild.length,
                AssetsJson: JSON.stringify(inlineRuntimeBuild ? runtimeDbAssets : uploadedBuild),
                AssetManifestJson: JSON.stringify({ MsKey: appKey, BuildVersion: versionNo, EntryPath: entryPath, Assets: uploadedBuild }),
                PublishTime: nowText('yyyy-MM-dd HH:mm:ss')
            };
            if (existingService && existingService.Id) {
                serviceRow.Id = existingService.Id;
            } else if (ms.Id) {
                serviceRow.Id = ms.Id;
            }
            var serviceResult = upsertApplicationRow('sys_microiservice', [['MsKey', '=', appKey]], serviceRow);
            if (!serviceResult || serviceResult.Code != 1) throw new Error('写入微服务运行元数据失败：' + ((serviceResult && serviceResult.Msg) || ''));
            var serviceData = V8.FormEngine.GetFormData('sys_microiservice', { _Where: [['MsKey', '=', appKey]] });
            var serviceId = serviceData && serviceData.Code == 1 && serviceData.Data ? serviceData.Data.Id : '';
            var routes = bundle.Routes || bundle.Pages || [];
            if (!routes.length) routes = [{ PageKey: 'home', PageName: '首页', PageTitle: '首页', RoutePath: '/', EntryPath: entryPath, Sort: 0, IsHome: 1 }];
            for (var r = 0; r < routes.length; r++) {
                var route = routes[r] || {};
                var routeMeta = normalizeRouteMeta(route);
                var routePath = firstTextParam([route.RoutePath, route.Path, routeMeta.RoutePath, '/']);
                var pageRow = {
                    MicroServiceId: serviceId,
                    MicroServiceKey: appKey,
                    PageKey: firstTextParam([route.PageKey, route.Key, routeMeta.PageKey, 'page-' + (r + 1)]),
                    PageName: firstTextParam([route.PageName, route.Name, route.PageTitle, routeMeta.PageName, routeMeta.PageTitle, '页面' + (r + 1)]),
                    PageTitle: firstTextParam([route.PageTitle, route.Title, route.PageName, routeMeta.PageTitle, routeMeta.PageName, '页面' + (r + 1)]),
                    RoutePath: routePath,
                    EntryPath: firstTextParam([route.EntryPath, routeMeta.EntryPath, entryPath]),
                    MenuUrl: firstTextParam([route.MenuUrl, '/micro-app/' + appKey + routePath]),
                    Sort: route.Sort || routeMeta.Sort || r,
                    IsHome: route.IsHome === 0 || routeMeta.IsHome === 0 ? 0 : (route.IsHome || routeMeta.IsHome || (r == 0 ? 1 : 0)),
                    IsEnable: route.IsEnable === 0 || routeMeta.IsEnable === 0 ? 0 : 1,
                    BuildVersion: versionNo,
                    RouteMetaJson: JSON.stringify(routeMeta)
                };
                var pageResult = upsertApplicationRow('sys_microiservice_page', [['MicroServiceId', '=', serviceId], ['AND', 'RoutePath', '=', routePath]], pageRow);
                if (!pageResult || pageResult.Code != 1) throw new Error('写入微服务页面失败：' + routePath + '，' + ((pageResult && pageResult.Msg) || ''));
                var installedPage = getApplicationRow('sys_microiservice_page', '', [['MicroServiceId', '=', serviceId], ['AND', 'RoutePath', '=', routePath]]);
                applicationMenuBindings.push({
                    ServiceId: serviceId,
                    ServiceKey: appKey,
                    PageId: installedPage && installedPage.Id ? installedPage.Id : '',
                    RoutePath: routePath,
                    PreserveExistingNativeMenus: preserveExistingNativeMenus,
                    LegacyMenuUrls: legacyRouteValues(routeMeta, 'LegacyMenuUrls', 'LegacyMenuUrl'),
                    LegacyComponentPaths: legacyRouteValues(routeMeta, 'LegacyComponentPaths', 'LegacyComponentPath')
                });
                stats.MicroServicePages++;
            }
        }

        stats.ApplicationInstalled++;
        debugLog.application_bundle_result = appType + '应用安装完成：' + appName + '，源码' + uploadedSource.length + '个，编译文件' + uploadedBuild.length + '个';
    };

    // ==================== 辅助函数：导入 Id 对齐和引用修复 ====================

    var idMaps = {
        Table: {},
        Field: {},
        Menu: {}
    };

    var menuJsonFields = [
        'SelectFields', 'MobileListFields', 'SearchFieldIds', 'SortFieldIds',
        'TableDiyFieldIds', 'NotShowFields', 'StatisticsFields', 'FixedFields',
        'TableHeaders', 'InTableEditFields', 'MoreBtns', 'FormBtns', 'PageBtns',
        'PageTabs', 'BatchSelectMoreBtns', 'ExportMoreBtns', 'JoinTables'
    ];
    var fieldJsonFields = ['Config', 'Data', 'BindRole'];

    var addInParameters = function (db, params) {
        for (var pIndex = 0; pIndex < params.length; pIndex++) {
            db = db.AddInParameter('@p' + pIndex, params[pIndex]);
        }
        return db;
    };

    var execNonQuery = function (sql, params) {
        return addInParameters(V8.Db.FromSql(sql), params || []).ExecuteNonQuery();
    };

    var firstText = function (values) {
        for (var i = 0; i < values.length; i++) {
            var value = values[i];
            if (value !== undefined && value !== null && String(value) !== '') {
                return String(value);
            }
        }
        return '';
    };

    var parseJsonObject = function (value, fallback) {
        if (!value) return fallback || {};
        if (typeof value == 'object') return value;
        try { return JSON.parse(String(value)); }
        catch (error) { return fallback || {}; }
    };

    // LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1：历史安装记录可能只有
    // AppName、没有 StoreId/AppId。按新标识优先、旧名称兜底读取，并在本次
    // 安装成功后更新同一行，避免列表永久停留在“更新”。
    var buildInstallVersionIdentity = function () {
        var pkgInfo = Package.PackageInfo || {};
        var storeId = firstText([V8.Param.StoreId, V8.Param.MicroiStoreId, V8.Param.Id]);
        var appId = firstText([V8.Param.AppId, V8.Param.AppKey, pkgInfo.AppId, storeId]);
        var appName = firstText([V8.Param.AppName, V8.Param.Name, pkgInfo.Name, appId]);
        return { StoreId: storeId, AppId: appId, AppName: appName };
    };

    var buildInstallVersionCandidates = function (identity) {
        var candidates = [];
        if (identity.AppId) candidates.push([['AppId', '=', identity.AppId]]);
        if (identity.StoreId) candidates.push([['StoreId', '=', identity.StoreId]]);
        if (identity.AppName) candidates.push([['AppName', '=', identity.AppName]]);
        return candidates;
    };

    var findInstallVersionRecord = function (identity) {
        var candidates = buildInstallVersionCandidates(identity);
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
            var where = candidates[candidateIndex];
            var result = V8.FormEngine.GetFormData('sys_microistoreversion', {
                _Where: where,
                _OrderBy: 'InstallTime',
                _OrderByType: 'DESC',
                _PageSize: 1
            });
            if (result && result.Code == 1 && result.Data && result.Data.Id) {
                return { Where: where, Result: result, Data: result.Data };
            }
        }
        return {
            Where: candidates.length > 0 ? candidates[0] : [],
            Result: null,
            Data: null
        };
    };

    // API_ENGINE_RESOURCE_BASELINE_V1：安装成功记录同时保存每个受管接口引擎
    // 的上游代码摘要。更新时只有 Local==Base 才允许替换为 Incoming；一旦租户
    // 修改了受管代码就明确冲突并回滚，绝不静默覆盖。CreateIfMissing 资源始终
    // 归租户维护，首次创建后后续应用更新只跳过。
    var installedVersionIdentity = buildInstallVersionIdentity();
    var installedVersionLookup = findInstallVersionRecord(installedVersionIdentity);
    var previousApiEngineResourceState = {};
    var nextApiEngineResourceState = {};
    if (installedVersionLookup.Data) {
        var installedVersionResult = installedVersionLookup.Result;
        if (installedVersionResult && installedVersionResult.Code == 1 && installedVersionResult.Data) {
            var previousInstallResult = parseJsonObject(installedVersionResult.Data.InstallResult, {});
            var previousResourceState = previousInstallResult.ResourceState || {};
            previousApiEngineResourceState = previousResourceState.ApiEngines || {};
        }
    }
    for (var previousStateKey in previousApiEngineResourceState) {
        if (Object.prototype.hasOwnProperty.call(previousApiEngineResourceState, previousStateKey)) {
            nextApiEngineResourceState[previousStateKey] = previousApiEngineResourceState[previousStateKey];
        }
    }

    var upsertMicroiStoreVersionRecord = function () {
        try {
            var pkgInfoForVersion = Package.PackageInfo || {};
            var storeId = firstText([V8.Param.StoreId, V8.Param.MicroiStoreId, V8.Param.Id]);
            var appId = firstText([V8.Param.AppId, V8.Param.AppKey, pkgInfoForVersion.AppId, storeId]);
            var appName = firstText([V8.Param.AppName, V8.Param.Name, pkgInfoForVersion.Name, appId]);
            var appVersion = firstText([V8.Param.AppVersion, V8.Param.Version, pkgInfoForVersion.Version, pkgInfoForVersion.AppVersion]);
            if (!storeId && !appId && !appName) {
                debugLog.version_record_skip = '未传入应用商城元数据，跳过安装版本记录';
                return;
            }

            var versionIdentity = { StoreId: storeId, AppId: appId, AppName: appName };
            var existingLookup = findInstallVersionRecord(versionIdentity);

            var now = nowText('yyyy-MM-dd HH:mm:ss');
            var model = {
                StoreId: storeId,
                AppId: appId,
                AppName: appName,
                AppVersion: appVersion,
                AppVersionInstall: appVersion,
                AppAuthor: firstText([V8.Param.AppAuthor, pkgInfoForVersion.AppAuthor, pkgInfoForVersion.CreateUser]),
                InstallStatus: 'Installed',
                InstallOsClient: V8.OsClient,
                InstallTime: now,
                LastCheckTime: now,
                InstallUserId: V8.CurrentUser ? firstText([V8.CurrentUser.Id]) : '',
                InstallUserName: V8.CurrentUser ? firstText([V8.CurrentUser.Name, V8.CurrentUser.Account]) : '',
                PackageName: firstText([pkgInfoForVersion.Name, appName]),
                PackageVersion: firstText([pkgInfoForVersion.Version, appVersion]),
                PackageOsClient: firstText([V8.Param.StoreOsClient, V8.Param.AppStoreOsClient, pkgInfoForVersion.OsClient]),
                InstallResult: JSON.stringify({
                    TableInserted: stats.TableInserted,
                    TableUpdated: stats.TableUpdated,
                    FieldInserted: stats.FieldInserted,
                    FieldUpdated: stats.FieldUpdated,
                    MenuInserted: stats.MenuInserted,
                    MenuUpdated: stats.MenuUpdated,
                    ApiEngineInserted: stats.ApiEngineInserted,
                    ApiEngineUpdated: stats.ApiEngineUpdated,
                    ApiEngineSkipped: stats.ApiEngineSkipped,
                    ResourceState: {
                        SchemaVersion: 1,
                        ApiEngines: nextApiEngineResourceState
                    }
                }),
                Remark: '应用商城安装完成'
            };

            var existing = existingLookup.Result;
            var saveResult;
            if (existing && existing.Code == 1 && existing.Data && existing.Data.Id) {
                model.Id = existing.Data.Id;
                saveResult = V8.FormEngine.UptFormData('sys_microistoreversion', model);
            } else {
                saveResult = V8.FormEngine.AddFormData('sys_microistoreversion', model);
            }
            if (saveResult && saveResult.Code == 1) {
                stats.VersionRecordUpdated++;
                debugLog.version_record_result = '已写入应用安装版本：' + appName + ' ' + appVersion;
                // SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1：平台随版本内置的
                // 基础应用包不是一次商城点击安装，不携带 StoreId/AppId。此时本地
                // 版本记录仍然有效，但不得向官方计数接口发送空标识，更不能把统计
                // 接口的参数校验失败升级为应用包事务失败。
                var marketplaceInstallIdentity = firstTextParam([model.StoreId, model.AppId]);
                if (!marketplaceInstallIdentity) {
                    debugLog.install_count_skipped_no_identity = '安装包未携带官方商城 StoreId/AppId，已跳过安装次数累计';
                    return;
                }
                try {
                    var installationKey = V8.EncryptHelper.SHA256(
                        marketplaceInstallIdentity + '|' + V8.OsClient + '|' + installOperationId
                    );
                    var remoteStat = V8.Http.Post({
                        Url: storeApiBase + '/apiengine/official_marketplace_install_stat?OsClient=' + encodeURIComponent(storeOsClient),
                        PostParam: {
                            StoreId: model.StoreId,
                            AppId: model.AppId,
                            AppName: model.AppName,
                            AppVersion: appVersion,
                            TargetOsClient: V8.OsClient,
                            InstallAction: installAction,
                            OperationId: installOperationId,
                            InstallationKey: installationKey
                        },
                        ParamType: 'json',
                        Timeout: 30
                    });
                    // MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1：V8.Http.Post 在不同
                    // 运行版本中可能直接返回对象，也可能返回 JSON 字符串。官方接口已
                    // 成功执行但未解析字符串时，不能把本地安装误判失败并反复回滚。
                    if (typeof remoteStat == 'string') {
                        remoteStat = JSON.parse(remoteStat);
                    }
                    if (remoteStat && remoteStat.Code == 1) {
                        debugLog.install_count_result = '官方商城安装次数已累计，操作Id=' + installOperationId;
                    } else {
                        debugLog.install_count_error_remote = '官方商城安装次数累计失败：'
                            + ((remoteStat && remoteStat.Msg) || '接口无返回') + '，操作Id=' + installOperationId;
                    }
                } catch (statError) {
                    debugLog.install_count_error_remote = (statError.message || String(statError))
                        + '，操作Id=' + installOperationId;
                }
            } else {
                debugLog.version_record_error = saveResult ? saveResult.Msg : '未知错误';
            }
        } catch (versionError) {
            debugLog.version_record_error = versionError.message || String(versionError);
        }
    };

    var normalizeId = function (id) {
        if (id === undefined || id === null) return '';
        return String(id);
    };

    var addIdMap = function (type, oldId, newId, label) {
        var oldKey = normalizeId(oldId);
        var newKey = normalizeId(newId);
        if (!oldKey || !newKey || oldKey == newKey) return;
        if (!idMaps[type]) idMaps[type] = {};
        if (idMaps[type][oldKey] == newKey) return;

        idMaps[type][oldKey] = newKey;
        idMaps[type][oldKey.toLowerCase()] = newKey;

        if (type == 'Table') stats.TableIdRemapped++;
        else if (type == 'Field') stats.FieldIdRemapped++;
        else if (type == 'Menu') stats.MenuIdRemapped++;

        debugLog['id_remap_' + type + '_' + oldKey] = (label || '') + '：' + oldKey + ' -> ' + newKey;
    };

    var findMappedId = function (value) {
        if (typeof value !== 'string') return value;
        var lowerValue = value.toLowerCase();
        var mapNames = ['Table', 'Field', 'Menu'];
        for (var m = 0; m < mapNames.length; m++) {
            var map = idMaps[mapNames[m]];
            if (map[value]) return map[value];
            if (map[lowerValue]) return map[lowerValue];
        }
        return value;
    };

    var hasAnyIdMap = function () {
        for (var mapName in idMaps) {
            if (Object.prototype.hasOwnProperty.call(idMaps, mapName)) {
                var map = idMaps[mapName];
                for (var key in map) {
                    if (Object.prototype.hasOwnProperty.call(map, key)) return true;
                }
            }
        }
        return false;
    };

    var replaceIdsDeep = function (value, state) {
        if (value === null || value === undefined) return value;
        if (typeof value == 'string') {
            var mapped = findMappedId(value);
            if (mapped !== value) state.changed = true;
            return mapped;
        }
        if (Array.isArray(value)) {
            var arr = [];
            for (var a = 0; a < value.length; a++) {
                arr.push(replaceIdsDeep(value[a], state));
            }
            return arr;
        }
        if (typeof value == 'object') {
            var obj = {};
            for (var key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    obj[key] = replaceIdsDeep(value[key], state);
                }
            }
            return obj;
        }
        return value;
    };

    var replaceIdsInJsonText = function (text) {
        if (!text || typeof text !== 'string') return text;
        var trimText = text.trim();
        if (!trimText || (trimText.charAt(0) != '{' && trimText.charAt(0) != '[')) return text;
        try {
            var parsed = JSON.parse(text);
            var state = { changed: false };
            var mapped = replaceIdsDeep(parsed, state);
            return state.changed ? JSON.stringify(mapped) : text;
        } catch (jsonError) {
            return text;
        }
    };

    var applyDirectIdMaps = function (row, fields) {
        var changed = false;
        for (var f = 0; f < fields.length; f++) {
            var fieldName = fields[f];
            if (row[fieldName]) {
                var mapped = findMappedId(row[fieldName]);
                if (mapped !== row[fieldName]) {
                    row[fieldName] = mapped;
                    changed = true;
                }
            }
        }
        return changed;
    };

    var applyJsonIdMaps = function (row, fields) {
        var changed = false;
        for (var f = 0; f < fields.length; f++) {
            var fieldName = fields[f];
            if (row[fieldName]) {
                var mapped = replaceIdsInJsonText(row[fieldName]);
                if (mapped !== row[fieldName]) {
                    row[fieldName] = mapped;
                    changed = true;
                }
            }
        }
        return changed;
    };

    var applyPackageIdMaps = function () {
        if (!hasAnyIdMap()) return;

        var packageFields = Package.DiyFields || [];
        for (var pf = 0; pf < packageFields.length; pf++) {
            applyDirectIdMaps(packageFields[pf], ['TableId']);
            applyJsonIdMaps(packageFields[pf], fieldJsonFields);
        }

        var packageMenus = Package.SysMenus || [];
        for (var pm = 0; pm < packageMenus.length; pm++) {
            applyDirectIdMaps(packageMenus[pm], ['ParentId', 'DiyTableId']);
            applyJsonIdMaps(packageMenus[pm], menuJsonFields);
        }

        var packageDdl = Package.DDLStatements || [];
        for (var pd = 0; pd < packageDdl.length; pd++) {
            applyDirectIdMaps(packageDdl[pd], ['TableId']);
        }
    };

    var syncMappedReferences = function () {
        if (!hasAnyIdMap()) return 0;
        // 新版始终保留目标库已有主键，只把包内Id映射到目标Id。
        // 因此只需修正本次内存中的包对象；不再全表扫描并重写客户现有引用，
        // 避免批量安装时对 diy_field/sys_menu 形成反向锁序和死锁。
        applyPackageIdMaps();
        return 0;
    };

    var snapshotPersistentIdMaps = function () {
        return copyPersistentIdMaps(idMaps);
    };

    var restorePersistentIdMaps = function () {
        if (!backgroundChunkingEnabled
            || !backgroundCheckpoint.IdMaps
            || String(backgroundCheckpoint.TaskId || '') != String(backgroundTaskId || '')) {
            return;
        }
        var storedMaps = copyPersistentIdMaps(backgroundCheckpoint.IdMaps);
        var mapNames = ['Table', 'Field'];
        for (var mapIndex = 0; mapIndex < mapNames.length; mapIndex++) {
            var mapName = mapNames[mapIndex];
            var storedMap = storedMaps[mapName] || {};
            for (var storedId in storedMap) {
                if (!Object.prototype.hasOwnProperty.call(storedMap, storedId)) continue;
                var storedTarget = String(storedMap[storedId] || '');
                if (!storedId || !storedTarget || storedId == storedTarget) continue;
                idMaps[mapName][storedId] = storedTarget;
                idMaps[mapName][String(storedId).toLowerCase()] = storedTarget;
            }
        }
    };

    var rebuildLegacyCheckpointIdMaps = function () {
        if (!backgroundChunkingEnabled
            || backgroundCheckpoint.IdMapsPlanned === true
            || (backgroundCheckpointPhase != 'ApplicationAssets' && backgroundCheckpointPhase != 'PostSchema')) {
            return;
        }
        var packageTables = Package.DiyTables || [];
        for (var legacyTableIndex = 0; legacyTableIndex < packageTables.length; legacyTableIndex++) {
            var legacyTable = packageTables[legacyTableIndex] || {};
            if (!legacyTable.Id || !legacyTable.Name) continue;
            var targetTable = V8.Db.FromSql(
                'SELECT Id FROM diy_table WHERE LOWER(Name) = LOWER(@p0) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', legacyTable.Name).First();
            if (targetTable && targetTable.Id) {
                addIdMap('Table', legacyTable.Id, String(targetTable.Id), legacyTable.Name + '旧检查点表主键恢复');
            }
        }
        applyPackageIdMaps();
        var packageFields = Package.DiyFields || [];
        for (var legacyFieldIndex = 0; legacyFieldIndex < packageFields.length; legacyFieldIndex++) {
            var legacyField = packageFields[legacyFieldIndex] || {};
            if (!legacyField.Id || !legacyField.TableId || !legacyField.Name) continue;
            var targetField = V8.Db.FromSql(
                'SELECT Id FROM diy_field WHERE TableId = @p0 AND LOWER(Name) = LOWER(@p1) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', legacyField.TableId)
                .AddInParameter('@p1', legacyField.Name)
                .First();
            if (targetField && targetField.Id) {
                addIdMap('Field', legacyField.Id, String(targetField.Id), legacyField.Name + '旧检查点字段主键恢复');
            }
        }
        applyPackageIdMaps();
    };

    var fieldMapTarget = function (sourceId) {
        var key = normalizeId(sourceId);
        return idMaps.Field[key] || idMaps.Field[key.toLowerCase()] || '';
    };

    // Id 映射先规划、后写入。这样字段 A 的 JSON 即使引用稍后才处理且发生
    // 主键冲突的字段 B，A 在保存前也已经拿到 B 的最终目标 Id。随机生成的冲突
    // Id 会进入共享 CheckpointJson；重试同一分片或换节点不会再次生成新 Id。
    var planPackageFieldIdMaps = function (startIndex, endIndex) {
        var packageFields = Package.DiyFields || [];
        for (var planIndex = startIndex; planIndex < endIndex; planIndex++) {
            var packageField = packageFields[planIndex] || {};
            var sourceFieldId = normalizeId(packageField.Id);
            var targetTableId = normalizeId(packageField.TableId);
            var fieldName = String(packageField.Name || '');
            if (!sourceFieldId || !targetTableId || !fieldName) continue;

            var naturalField = V8.Db.FromSql(
                'SELECT Id, TableId, Name FROM diy_field WHERE TableId = @p0 AND LOWER(Name) = LOWER(@p1) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', targetTableId)
                .AddInParameter('@p1', fieldName)
                .First();
            if (naturalField && naturalField.Id) {
                addIdMap('Field', sourceFieldId, String(naturalField.Id), fieldName + '字段主键预对齐');
                continue;
            }

            var rawSource = V8.Db.FromSql(
                'SELECT Id, TableId, Name FROM diy_field WHERE Id = @p0 LIMIT 1'
            ).AddInParameter('@p0', sourceFieldId).First();
            var rawSourceMatches = rawSource && rawSource.Id
                && normalizeId(rawSource.TableId).toLowerCase() == targetTableId.toLowerCase()
                && String(rawSource.Name || '').toLowerCase() == fieldName.toLowerCase();
            if (rawSourceMatches) continue;

            var plannedTargetId = fieldMapTarget(sourceFieldId);
            if (plannedTargetId) {
                var rawPlanned = V8.Db.FromSql(
                    'SELECT Id, TableId, Name FROM diy_field WHERE Id = @p0 LIMIT 1'
                ).AddInParameter('@p0', plannedTargetId).First();
                var plannedTargetSafe = !rawPlanned || !rawPlanned.Id
                    || (normalizeId(rawPlanned.TableId).toLowerCase() == targetTableId.toLowerCase()
                        && String(rawPlanned.Name || '').toLowerCase() == fieldName.toLowerCase());
                if (plannedTargetSafe) continue;
            }

            if (rawSource && rawSource.Id) {
                var generatedTargetId = '';
                for (var idAttempt = 0; idAttempt < 5 && !generatedTargetId; idAttempt++) {
                    var candidateId = String(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());
                    var candidateExists = V8.Db.FromSql(
                        'SELECT Id FROM diy_field WHERE Id = @p0 LIMIT 1'
                    ).AddInParameter('@p0', candidateId).First();
                    if (!candidateExists || !candidateExists.Id) generatedTargetId = candidateId;
                }
                if (!generatedTargetId) throw new Error('字段主键冲突规划失败：' + fieldName);
                addIdMap('Field', sourceFieldId, generatedTargetId, fieldName + '字段主键冲突预规划');
            }
        }
    };

    restorePersistentIdMaps();
    rebuildLegacyCheckpointIdMaps();

    // ==================== 步骤0：执行DDL创建表和字段 ====================

    reportProgress(10, '正在创建和检查物理表');
    debugLog.step0 = '开始执行DDL创建表';

    var allDdlStatements = Package.DDLStatements || [];
    var ddlChunkStart = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Ddl'
        ? Math.min(backgroundCheckpointIndex, allDdlStatements.length)
        : 0;
    var ddlChunkEnd = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Ddl'
        ? Math.min(allDdlStatements.length, ddlChunkStart + schemaDdlChunkSize)
        : allDdlStatements.length;
    var ddlStatements = [];
    if (!backgroundChunkingEnabled || backgroundCheckpointPhase == 'Ddl') {
        for (var ddlCopyIndex = ddlChunkStart; ddlCopyIndex < ddlChunkEnd; ddlCopyIndex++) {
            ddlStatements.push(allDdlStatements[ddlCopyIndex]);
        }
    }
    var ddlExecuted = 0;
    var ddlSkipped = 0;
    var fieldsAdded = 0;

    // 定义审计字段（与export-package.js保持一致）
    var fixedDiyField = [
        { Name: "Id", Label: "Id", Type: "varchar(36)", Component: "Guid", Sort: 1, Visible: 0, TableWidth: 150 },
        { Name: "CreateTime", Label: "创建时间", Type: "datetime", Component: "DateTime", Sort: 2, Visible: 1, TableWidth: 150 },
        { Name: "UpdateTime", Label: "修改时间", Type: "datetime", Component: "DateTime", Sort: 3, Visible: 1, TableWidth: 150 },
        { Name: "UserId", Label: "创建人Id", Type: "varchar(36)", Component: "Guid", Sort: 4, Visible: 0, TableWidth: 150 },
        { Name: "UserName", Label: "创建人", Type: "varchar(255)", Component: "Text", Sort: 5, Visible: 1, TableWidth: 150 },
        { Name: "IsDeleted", Label: "是否已删除", Type: "int", Component: "Switch", Sort: 6, Visible: 0, TableWidth: 50 }
    ];

    // MySQL类型映射函数（与导出保持一致）
    var mapToMySQLType = function (diyType) {
        if (!diyType) return 'varchar(255)';

        // 安全转换为字符串并小写
        var typeStr = '';
        try {
            typeStr = String.prototype.toLowerCase.call(String(diyType));
        } catch (e) {
            return 'varchar(255)';
        }

        if (typeStr.match(/^(varchar|int|bigint|datetime|text|longtext|decimal|double|float|tinyint|date|time|timestamp|json)\(/)) {
            return String(diyType);
        }
        if (typeStr == 'int' || typeStr == 'bigint' || typeStr == 'text' || typeStr == 'mediumtext' || typeStr == 'longtext' ||
            typeStr == 'datetime' || typeStr == 'date' || typeStr == 'time' || typeStr == 'timestamp' ||
            typeStr == 'json' || typeStr == 'tinyint' || typeStr == 'double' || typeStr == 'float') {
            return String(diyType);
        }

        if (typeStr.indexOf('mediumtext') == 0) return String(diyType);
        if (typeStr.indexOf('varchar') == 0) return String(diyType);
        if (typeStr.indexOf('decimal') == 0) return String(diyType);

        return 'varchar(255)';
    };

    var isSafeIdentifier = function (name) {
        return !!name && /^[A-Za-z0-9_]+$/.test(String(name));
    };

    var sqlString = function (value) {
        return String(value || '').replace(/'/g, "''");
    };

    var normalizeSqlType = function (value) {
        return String(value || '').toLowerCase().replace(/\s+/g, '');
    };

    // 应用包只能扩宽目标库已有字段，不能为了与来源库完全一致而缩窄字段。
    // 否则目标库中已经存在的配置 JSON、富文本等数据会在 MODIFY COLUMN 时丢失或直接报错。
    var getTextTypeCapacity = function (value) {
        var type = normalizeSqlType(value);
        var varcharMatch = type.match(/^varchar\((\d+)\)/);
        var charMatch = type.match(/^char\((\d+)\)/);
        if (varcharMatch) return parseInt(varcharMatch[1], 10);
        if (charMatch) return parseInt(charMatch[1], 10);
        if (type.indexOf('tinytext') == 0) return 255;
        if (type.indexOf('mediumtext') == 0) return 16777215;
        if (type.indexOf('longtext') == 0) return 4294967295;
        if (type == 'text' || type.indexOf('text(') == 0) return 65535;
        return 0;
    };

    var getIntegerTypeRank = function (value) {
        var type = normalizeSqlType(value);
        if (/^tinyint(\(|$)/.test(type)) return 1;
        if (/^smallint(\(|$)/.test(type)) return 2;
        if (/^mediumint(\(|$)/.test(type)) return 3;
        if (/^int(eger)?(\(|$)/.test(type)) return 4;
        if (/^bigint(\(|$)/.test(type)) return 5;
        return 0;
    };

    var isNumericSqlType = function (value) {
        var type = normalizeSqlType(value);
        // MYSQL_BIT_NUMERIC_COMPAT_V1：MySQL BIT(1) 经 ORM 读取可能是原始
        // 00/01 字节；它属于数值类型，不能按文本脏数据规则复核。
        return /^(bit|tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|double|float)(\(|$)/.test(type);
    };

    var isIntegerSqlType = function (value) {
        return getIntegerTypeRank(value) > 0;
    };

    var chooseCompatibleColumnType = function (sourceType, targetType) {
        var sourceTextCapacity = getTextTypeCapacity(sourceType);
        var targetTextCapacity = getTextTypeCapacity(targetType);
        if (sourceTextCapacity > 0 && targetTextCapacity > sourceTextCapacity) {
            return String(targetType);
        }

        var sourceIntegerRank = getIntegerTypeRank(sourceType);
        var targetIntegerRank = getIntegerTypeRank(targetType);
        if (sourceIntegerRank > 0 && targetIntegerRank > sourceIntegerRank) {
            return String(targetType);
        }

        return String(sourceType);
    };

    var getPhysicalValue = function (row, names) {
        for (var i = 0; i < names.length; i++) {
            if (row[names[i]] !== undefined && row[names[i]] !== null) return row[names[i]];
        }
        return null;
    };

    var buildPhysicalColumnDefinition = function (column, includePrimaryKey, overrideColumnType) {
        var columnName = getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']);
        var columnType = overrideColumnType || getPhysicalValue(column, ['COLUMN_TYPE', 'ColumnType', 'Type']);
        if (!columnName || !columnType || !isSafeIdentifier(columnName)) return '';

        var definition = '`' + columnName + '` ' + String(columnType);
        var nullable = String(getPhysicalValue(column, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        definition += nullable == 'NO' ? ' NOT NULL' : ' NULL';

        var extra = getPhysicalValue(column, ['EXTRA', 'Extra']);
        var columnDefault = getPhysicalValue(column, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
        if (columnDefault !== null && columnDefault !== undefined && columnDefault !== '' &&
            !/text|blob|json/i.test(String(columnType)) && !/auto_increment/i.test(String(extra || ''))) {
            var defaultText = String(columnDefault);
            if (/^current_timestamp(\(\))?$/i.test(defaultText) || /^CURRENT_TIMESTAMP/i.test(defaultText)) {
                definition += ' DEFAULT ' + defaultText;
            } else if (/^b'.*'$/i.test(defaultText)) {
                definition += ' DEFAULT ' + defaultText;
            } else {
                definition += " DEFAULT '" + sqlString(defaultText) + "'";
            }
        }
        if (extra && /auto_increment|on update/i.test(String(extra))) definition += ' ' + String(extra);

        var comment = getPhysicalValue(column, ['COLUMN_COMMENT', 'ColumnComment', 'Comment']);
        if (comment) definition += " COMMENT '" + sqlString(comment) + "'";

        var columnKey = String(getPhysicalValue(column, ['COLUMN_KEY', 'ColumnKey']) || '').toUpperCase();
        if (includePrimaryKey && columnKey == 'PRI') {
            definition += ' PRIMARY KEY';
        }

        return definition;
    };

    var buildDiyFieldAddColumnSql = function (tableName, field, overrideColumnType) {
        field = field || {};
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(field.Name)) return '';
        var columnType = overrideColumnType || mapToMySQLType(field.Type);
        var sql = 'ALTER TABLE `' + tableName + '` ADD COLUMN `' + field.Name + '` ' + columnType;
        sql += field.Name == 'Id' ? ' NOT NULL PRIMARY KEY' : ' NULL';
        if (field.Label && String(field.Label) !== String(field.Name)) {
            sql += " COMMENT '" + sqlString(field.Label) + "'";
        }
        return sql;
    };

    var isMysqlRowSizeTooLargeError = function (error) {
        var message = String(error && error.message ? error.message : error || '');
        return /row\s+size\s+too\s+large|maximum\s+row\s+size[^\n]*65535/i.test(message);
    };

    var mysqlOffpageOverrideKey = function (tableName, columnName) {
        return String(tableName || '').toLowerCase() + '.' + String(columnName || '').toLowerCase();
    };

    var packageFieldBelongsToTable = function (field, tableName, tableId) {
        field = field || {};
        var fieldTableName = String(field.TableName || '').toLowerCase();
        var expectedTableName = String(tableName || '').toLowerCase();
        if (fieldTableName) return fieldTableName == expectedTableName;
        return !!tableId && String(field.TableId || '') == String(tableId);
    };

    // LEGACY_SWITCH_BOOLEAN_TEXT_V1：只有应用包明确声明为 Switch 的字段，
    // 才允许兼容早期数据库中由
    // JSON/ORM 写入的 True/False 文本。普通数值字段继续失败关闭，避免
    // 把真实脏数据静默转换成 0。
    var isPackageSwitchColumn = function (tableName, columnName) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return false;
        var tableId = '';
        var packageDeclaresSameNameSwitch = false;
        var packageTables = Package.DiyTables || [];
        for (var tableIndex = 0; tableIndex < packageTables.length; tableIndex++) {
            var packageTable = packageTables[tableIndex] || {};
            if (String(packageTable.Name || '').toLowerCase() == String(tableName).toLowerCase()) {
                tableId = String(packageTable.Id || '');
                break;
            }
        }
        var packageFields = Package.DiyFields || [];
        for (var fieldIndex = 0; fieldIndex < packageFields.length; fieldIndex++) {
            var packageField = packageFields[fieldIndex] || {};
            if (String(packageField.Name || '').toLowerCase() != String(columnName).toLowerCase()) continue;
            if (String(packageField.Component || '').toLowerCase() != 'switch') continue;
            packageDeclaresSameNameSwitch = true;
            if (packageFieldBelongsToTable(packageField, tableName, tableId)) return true;
        }
        if (!packageDeclaresSameNameSwitch) return false;

        // 后台分片恢复时，旧 Jint 会把 Package 中已经应用 IdMap 的 TableId 与
        // 原始 DiyTables.Id 分开呈现；个别旧包对象还会丢失字段 TableName。
        // 此时必须由“包内同名 Switch 声明 + 目标端同表同名 Switch 元数据”双重
        // 证明，不能仅凭字段名放宽数值迁移。
        var targetSwitchRows = V8.Db.FromSql(
            'SELECT COUNT(1) AS SwitchCount FROM diy_field df ' +
            'INNER JOIN diy_table dt ON dt.Id = df.TableId ' +
            'WHERE LOWER(dt.Name) = LOWER(@p0) AND LOWER(df.Name) = LOWER(@p1) ' +
            "AND LOWER(COALESCE(df.Component, '')) = 'switch' " +
            'AND (df.IsDeleted <> 1 OR df.IsDeleted IS NULL) ' +
            'AND (dt.IsDeleted <> 1 OR dt.IsDeleted IS NULL)'
        ).AddInParameter('@p0', tableName)
            .AddInParameter('@p1', columnName)
            .ToArray();
        var targetSwitchCount = targetSwitchRows && targetSwitchRows.length > 0
            ? getScalarCount(targetSwitchRows[0], ['SwitchCount', 'SWITCHCOUNT', 'switchcount'])
            : 0;
        if (targetSwitchCount > 0) {
            debugLog['physical_schema_switch_metadata_fallback_' + tableName + '_' + columnName] =
                '包内与目标端均声明为Switch，已兼容分片Id映射后的字段关联';
            return true;
        }
        return false;
    };

    var isPackageColumnIndexed = function (tableName, columnName) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return true;
        var ddlList = Package.DDLStatements || [];
        var columnPattern = new RegExp('(^|[^A-Za-z0-9_])' + columnName + '([^A-Za-z0-9_]|$)', 'i');
        for (var ddlIndex = 0; ddlIndex < ddlList.length; ddlIndex++) {
            var ddlRow = ddlList[ddlIndex] || {};
            if (String(ddlRow.TableName || '').toLowerCase() != String(tableName).toLowerCase()) continue;
            var ddlText = String(ddlRow.DDL || '');
            var indexPattern = /(?:PRIMARY\s+KEY|UNIQUE\s+(?:KEY|INDEX)|(?:KEY|INDEX)\s+[`"A-Za-z0-9_]+)[\s\S]{0,240}?\(([^)]*)\)/ig;
            var indexMatch = null;
            while ((indexMatch = indexPattern.exec(ddlText)) !== null) {
                if (columnPattern.test(String(indexMatch[1] || '').replace(/`/g, ''))) return true;
            }
        }
        return false;
    };

    var rewritePackageDdlColumnType = function (tableName, columnName, targetType) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return 0;
        var ddlList = Package.DDLStatements || [];
        var changed = 0;
        var typePattern = new RegExp('(`?' + columnName + '`?\\s+)(?:var)?char\\s*\\(\\s*\\d+\\s*\\)', 'ig');
        for (var ddlIndex = 0; ddlIndex < ddlList.length; ddlIndex++) {
            var ddlRow = ddlList[ddlIndex] || {};
            if (String(ddlRow.TableName || '').toLowerCase() != String(tableName).toLowerCase()) continue;
            var sourceDdl = String(ddlRow.DDL || '');
            var nextDdl = sourceDdl.replace(typePattern, '$1' + targetType);
            if (nextDdl != sourceDdl) {
                ddlRow.DDL = nextDdl;
                changed++;
            }
        }
        return changed;
    };

    var applyPackageColumnTypeOverride = function (tableName, tableId, columnName, targetType, reason) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return false;
        targetType = String(targetType || '').toLowerCase();
        if (targetType != 'mediumtext' && targetType != 'longtext') return false;
        if (isPackageColumnIndexed(tableName, columnName)) return false;

        var matched = false;
        var previousTypes = [];
        var packageFields = Package.DiyFields || [];
        for (var fieldIndex = 0; fieldIndex < packageFields.length; fieldIndex++) {
            var packageField = packageFields[fieldIndex] || {};
            if (!packageFieldBelongsToTable(packageField, tableName, tableId)
                || String(packageField.Name || '').toLowerCase() != String(columnName).toLowerCase()) continue;
            var currentFieldType = String(packageField.Type || '');
            if (!/^(?:var)?char\s*\(\s*\d+\s*\)$/i.test(currentFieldType)
                && !/^(?:medium|long)?text$/i.test(currentFieldType)) return false;
            previousTypes.push(currentFieldType);
            packageField.Type = targetType;
            matched = true;
        }

        var physicalColumns = Package.PhysicalColumns || [];
        for (var physicalIndex = 0; physicalIndex < physicalColumns.length; physicalIndex++) {
            var physicalColumn = physicalColumns[physicalIndex] || {};
            var physicalTableName = getPhysicalValue(physicalColumn, ['TABLE_NAME', 'TableName']);
            var physicalColumnName = getPhysicalValue(physicalColumn, ['COLUMN_NAME', 'ColumnName', 'Name']);
            if (String(physicalTableName || '').toLowerCase() != String(tableName).toLowerCase()
                || String(physicalColumnName || '').toLowerCase() != String(columnName).toLowerCase()) continue;
            previousTypes.push(String(getPhysicalValue(physicalColumn, ['COLUMN_TYPE', 'ColumnType', 'Type']) || ''));
            physicalColumn.COLUMN_TYPE = targetType;
            physicalColumn.DATA_TYPE = targetType;
            if (physicalColumn.ColumnType !== undefined) physicalColumn.ColumnType = targetType;
            if (physicalColumn.Type !== undefined) physicalColumn.Type = targetType;
            matched = true;
        }

        if (!matched) return false;
        rewritePackageDdlColumnType(tableName, columnName, targetType);
        mysqlOffpageTypeOverrides[mysqlOffpageOverrideKey(tableName, columnName)] = targetType;
        debugLog['mysql_row_offpage_fallback_' + tableName + '_' + columnName] =
            (reason || 'MySQL宽表行内上限') + '：' + (previousTypes.join('/') || 'varchar') + ' -> ' + targetType;
        return true;
    };

    var promoteWidePackageColumnsForTable = function (tableName, tableId, minimumLength, reason) {
        var packageFields = Package.DiyFields || [];
        var candidates = [];
        for (var fieldIndex = 0; fieldIndex < packageFields.length; fieldIndex++) {
            var packageField = packageFields[fieldIndex] || {};
            if (!packageFieldBelongsToTable(packageField, tableName, tableId)) continue;
            var varcharMatch = String(packageField.Type || '').toLowerCase().match(/^varchar\s*\(\s*(\d+)\s*\)$/);
            if (!varcharMatch || parseInt(varcharMatch[1], 10) < minimumLength) continue;
            if (!isSafeIdentifier(packageField.Name) || isPackageColumnIndexed(tableName, packageField.Name)) continue;
            candidates.push(String(packageField.Name));
        }
        var promoted = 0;
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
            if (applyPackageColumnTypeOverride(
                tableName,
                tableId,
                candidates[candidateIndex],
                'mediumtext',
                reason
            )) promoted++;
        }
        return promoted;
    };

    var applyPersistedMysqlOffpageOverrides = function () {
        for (var overrideKey in mysqlOffpageTypeOverrides) {
            if (!Object.prototype.hasOwnProperty.call(mysqlOffpageTypeOverrides, overrideKey)) continue;
            var separatorIndex = String(overrideKey).indexOf('.');
            if (separatorIndex <= 0 || separatorIndex >= String(overrideKey).length - 1) continue;
            var tableName = String(overrideKey).substring(0, separatorIndex);
            var columnName = String(overrideKey).substring(separatorIndex + 1);
            applyPackageColumnTypeOverride(
                tableName,
                '',
                columnName,
                mysqlOffpageTypeOverrides[overrideKey],
                '从后台任务检查点恢复行外文本类型'
            );
        }
    };

    applyPersistedMysqlOffpageOverrides();

    var getScalarCount = function (row, names) {
        var value = getPhysicalValue(row || {}, names);
        var numberValue = parseInt(value || 0, 10);
        return isNaN(numberValue) ? 0 : numberValue;
    };

    // DDLStatements may contain CREATE TABLE and standalone index statements.
    // Classify them before executing so reinstalling the same package is
    // idempotent instead of treating an existing index as an install failure.
    var classifyDdlStatement = function (ddl, fallbackTableName) {
        var sql = String(ddl || '');
        var createTable = sql.match(/^\s*CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"\[]?([A-Za-z0-9_]+)/i);
        if (createTable) {
            return { Kind: 'table', TableName: createTable[1], IndexName: '' };
        }

        var createIndex = sql.match(/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"\[]?([A-Za-z0-9_]+)[`"\]]?\s+ON\s+[`"\[]?([A-Za-z0-9_]+)/i);
        if (createIndex) {
            return { Kind: 'index', TableName: createIndex[2], IndexName: createIndex[1] };
        }

        var alterIndex = sql.match(/^\s*ALTER\s+TABLE\s+[`"\[]?([A-Za-z0-9_]+)[`"\]]?\s+ADD\s+(?:UNIQUE\s+)?(?:INDEX|KEY)\s+[`"\[]?([A-Za-z0-9_]+)/i);
        if (alterIndex) {
            return { Kind: 'index', TableName: alterIndex[1], IndexName: alterIndex[2] };
        }

        return { Kind: 'other', TableName: String(fallbackTableName || ''), IndexName: '' };
    };

    var ddlTableExists = function (tableName) {
        if (!isSafeIdentifier(tableName)) return false;
        var rows = V8.Db.FromSql(
            'SELECT COUNT(1) AS ObjectCount FROM INFORMATION_SCHEMA.TABLES ' +
            'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0)'
        ).AddInParameter('@p0', tableName).ToArray();
        return rows && rows.length > 0 && getScalarCount(rows[0], ['ObjectCount', 'OBJECTCOUNT', 'objectcount']) > 0;
    };

    var ddlIndexExists = function (tableName, indexName) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(indexName)) return false;
        var rows = V8.Db.FromSql(
            'SELECT COUNT(1) AS ObjectCount FROM INFORMATION_SCHEMA.STATISTICS ' +
            'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0) AND LOWER(INDEX_NAME) = LOWER(@p1)'
        ).AddInParameter('@p0', tableName)
            .AddInParameter('@p1', indexName)
            .ToArray();
        return rows && rows.length > 0 && getScalarCount(rows[0], ['ObjectCount', 'OBJECTCOUNT', 'objectcount']) > 0;
    };

    // MySQL 严格模式不允许把历史 varchar 空字符串直接改成 int/decimal。
    // 空字符串在平台旧数据中表示“未填写”，可安全规范为 NULL；Switch 字段还兼容
    // 老版本写入的 True/False 文本。其它非数字内容必须阻止迁移，不能静默转成 0。
    var prepareNumericColumnData = function (tableName, columnName, sourceColumn, sourceType, targetType) {
        var normalized = { BlankCount: 0, LegacyBooleanCount: 0, LegacySwitchNumericCount: 0 };
        if (!isNumericSqlType(sourceType) || isNumericSqlType(targetType)) return normalized;

        var regexp = isIntegerSqlType(sourceType)
            ? '^[+-]?[0-9]+$'
            : '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$';
        var isSwitchColumn = isPackageSwitchColumn(tableName, columnName);
        var rawTextExpression = "TRIM(CAST(`" + columnName + "` AS CHAR))";
        // JSON_SWITCH_LITERAL_UNQUOTE_V1：旧 ORM 可能把 bool/0/1 作为 JSON
        // 字面量或 JSON 字符串写入 varchar。只对白名单 Switch 使用 MySQL JSON
        // 校验和解包；无效 JSON 保持原文并继续走严格非数字拦截。
        var normalizedTextExpression = isSwitchColumn
            ? "LOWER(TRIM(CASE WHEN JSON_VALID(" + rawTextExpression + ") " +
                "THEN JSON_UNQUOTE(" + rawTextExpression + ") ELSE " + rawTextExpression + " END))"
            : rawTextExpression;
        var invalidWhere =
            "WHERE `" + columnName + "` IS NOT NULL " +
            "AND TRIM(CAST(`" + columnName + "` AS CHAR)) <> '' " +
            "AND " + normalizedTextExpression + " NOT REGEXP @p0";
        if (isSwitchColumn) {
            // Dos.ORM/Jint 在部分旧运行时中会把 IN(@p1,@p2) 的字符串参数按
            // 集合参数再次包装，导致数据库仍把 True/False 统计成非法值。
            // 这里只有固定、不可由包或请求控制的布尔字面量，直接写入静态 SQL
            // 可跨旧运行时稳定工作，同时继续只对白名单 Switch 字段生效。
            invalidWhere +=
                " AND " + normalizedTextExpression + " <> 'true'" +
                " AND " + normalizedTextExpression + " <> 'false'";
        }
        var invalidSql =
            "SELECT COUNT(1) AS InvalidCount FROM `" + tableName + "` " + invalidWhere;
        var invalidRows = V8.Db.FromSql(
            invalidSql
        ).AddInParameter('@p0', regexp);
        invalidRows = invalidRows.ToArray();
        var invalidCount = invalidRows && invalidRows.length > 0
            ? getScalarCount(invalidRows[0], ['InvalidCount', 'INVALIDCOUNT', 'invalidcount'])
            : 0;
        if (invalidCount > 0) {
            var invalidHex = '';
            if (isSwitchColumn) {
                var invalidSampleRows = V8.Db.FromSql(
                    "SELECT DISTINCT LEFT(HEX(CAST(`" + columnName + "` AS CHAR)), 64) AS InvalidHex " +
                    "FROM `" + tableName + "` " + invalidWhere + " LIMIT 3"
                ).AddInParameter('@p0', regexp).ToArray();
                var invalidHexList = [];
                for (var invalidSampleIndex = 0; invalidSampleIndex < invalidSampleRows.length; invalidSampleIndex++) {
                    var invalidHexValue = String(getPhysicalValue(invalidSampleRows[invalidSampleIndex],
                        ['InvalidHex', 'INVALIDHEX', 'invalidhex']) || '');
                    if (invalidHexValue) invalidHexList.push(invalidHexValue);
                }
                if (invalidHexList.length > 0) invalidHex = '，样本HEX=' + invalidHexList.join(',');
            }
            throw new Error(
                '字段存在' + invalidCount + '条非数字数据，已阻止转换为' + sourceType +
                '，请先清理数据；导入器=v1.9.8，Switch双重声明=' +
                (isSwitchColumn ? '已命中' : '未命中') + invalidHex
            );
        }

        if (isSwitchColumn) {
            var normalizeSwitchLiteral = function (literal, numericValue) {
                if (literal != 'true' && literal != 'false' && literal != '1' && literal != '0') {
                    throw new Error('不支持的Switch历史字面量');
                }
                var literalSql = "'" + literal + "'";
                var countRows = V8.Db.FromSql(
                    "SELECT COUNT(1) AS LegacyBooleanCount FROM `" + tableName + "` " +
                    "WHERE " + normalizedTextExpression + " = " + literalSql
                ).ToArray();
                var count = countRows && countRows.length > 0
                    ? getScalarCount(countRows[0], ['LegacyBooleanCount', 'LEGACYBOOLEANCOUNT', 'legacybooleancount'])
                    : 0;
                if (count > 0) {
                    V8.Db.FromSql(
                        "UPDATE `" + tableName + "` SET `" + columnName + "` = @p0 " +
                        "WHERE " + normalizedTextExpression + " = " + literalSql
                    ).AddInParameter('@p0', numericValue)
                        .ExecuteNonQuery();
                }
                return count;
            };
            normalized.LegacyBooleanCount = normalizeSwitchLiteral('true', 1)
                + normalizeSwitchLiteral('false', 0);
            normalized.LegacySwitchNumericCount = normalizeSwitchLiteral('1', 1)
                + normalizeSwitchLiteral('0', 0);
        }

        var blankRows = V8.Db.FromSql(
            "SELECT COUNT(1) AS BlankCount FROM `" + tableName + "` " +
            "WHERE `" + columnName + "` IS NOT NULL AND TRIM(CAST(`" + columnName + "` AS CHAR)) = ''"
        ).ToArray();
        var blankCount = blankRows && blankRows.length > 0
            ? getScalarCount(blankRows[0], ['BlankCount', 'BLANKCOUNT', 'blankcount'])
            : 0;
        if (blankCount == 0) return normalized;

        var sourceNullable = String(getPhysicalValue(sourceColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        if (sourceNullable == 'NO') {
            throw new Error('字段存在' + blankCount + '条空字符串，但目标字段不允许NULL，已阻止数值类型转换');
        }

        V8.Db.FromSql(
            "UPDATE `" + tableName + "` SET `" + columnName + "` = NULL " +
            "WHERE `" + columnName + "` IS NOT NULL AND TRIM(CAST(`" + columnName + "` AS CHAR)) = ''"
        ).ExecuteNonQuery();
        normalized.BlankCount = blankCount;
        return normalized;
    };

    // PHYSICAL_NOT_NULL_BACKFILL_V1：老租户可能已经创建了新字段，但历史行仍为
    // NULL。MySQL 会在 MODIFY ... NOT NULL 之前校验既有数据，因此必须先使用包内
    // 明确声明的默认值做参数化回填，再收紧列约束。没有默认值时失败关闭，不能猜值。
    var prepareNotNullColumnData = function (tableName, columnName, sourceColumn, targetColumn) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return 0;

        var sourceNullable = String(getPhysicalValue(sourceColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        var targetNullable = String(getPhysicalValue(targetColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        if (sourceNullable != 'NO' || targetNullable == 'NO') return 0;

        var nullRows = V8.Db.FromSql(
            "SELECT COUNT(1) AS NullCount FROM `" + tableName + "` WHERE `" + columnName + "` IS NULL"
        ).ToArray();
        var nullCount = nullRows && nullRows.length > 0
            ? getScalarCount(nullRows[0], ['NullCount', 'NULLCOUNT', 'nullcount'])
            : 0;
        if (nullCount == 0) return 0;

        var sourceDefault = getPhysicalValue(sourceColumn, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
        if (sourceDefault === null || sourceDefault === undefined) {
            throw new Error(
                '字段存在' + nullCount + '条NULL数据，但应用包要求NOT NULL且未声明可回填的默认值，已阻止修改'
            );
        }

        var columnType = String(getPhysicalValue(sourceColumn, ['COLUMN_TYPE', 'ColumnType', 'Type']) || '');
        var defaultText = String(sourceDefault);
        var updateSql = "UPDATE `" + tableName + "` SET `" + columnName + "` = @p0 WHERE `" + columnName + "` IS NULL";
        var isCurrentTimestamp = /^(?:CURRENT_TIMESTAMP)(?:\(\d*\))?$/i.test(defaultText)
            && /^(?:datetime|timestamp)(?:\(|$)/i.test(normalizeSqlType(columnType));
        var isBitLiteral = /^b'[01]+'$/i.test(defaultText)
            && /^bit(?:\(|$)/i.test(normalizeSqlType(columnType));

        if (isCurrentTimestamp || isBitLiteral) {
            updateSql = "UPDATE `" + tableName + "` SET `" + columnName + "` = " + defaultText
                + " WHERE `" + columnName + "` IS NULL";
            V8.Db.FromSql(updateSql).ExecuteNonQuery();
        } else {
            V8.Db.FromSql(updateSql)
                .AddInParameter('@p0', sourceDefault)
                .ExecuteNonQuery();
        }
        return nullCount;
    };

    var getTargetPhysicalColumns = function (tableName) {
        var map = {};
        if (!isSafeIdentifier(tableName)) return map;

        var rows = V8.Db.FromSql(
            "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT " +
            "FROM INFORMATION_SCHEMA.COLUMNS " +
            "WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0)"
        ).AddInParameter('@p0', tableName).ToArray();

        for (var i = 0; i < rows.length; i++) {
            var columnName = rows[i].COLUMN_NAME;
            if (!columnName) continue;
            map[String(columnName).toLowerCase()] = rows[i];
        }
        return map;
    };

    var groupPackagePhysicalColumns = function (columns, tableFilterMap) {
        var grouped = {};
        columns = columns || [];
        for (var i = 0; i < columns.length; i++) {
            var column = columns[i];
            var tableName = getPhysicalValue(column, ['TABLE_NAME', 'TableName']);
            var columnName = getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']);
            if (!tableName || !columnName || !isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) continue;

            var tableKey = String(tableName).toLowerCase();
            if (tableFilterMap && !tableFilterMap[tableKey]) continue;
            if (!grouped[tableKey]) {
                grouped[tableKey] = {
                    TableName: String(tableName),
                    Columns: []
                };
            }
            grouped[tableKey].Columns.push(column);
        }
        return grouped;
    };

    var syncPhysicalColumnsFromPackage = function (tableFilterMap) {
        var columns = Package.PhysicalColumns || [];
        var grouped = groupPackagePhysicalColumns(columns, tableFilterMap);
        var result = { Added: 0, Modified: 0, Skipped: 0, Errors: 0 };

        for (var tableKey in grouped) {
            if (!Object.prototype.hasOwnProperty.call(grouped, tableKey)) continue;
            if (tableFilterMap && !tableFilterMap[tableKey]) continue;

            var group = grouped[tableKey];
            var tableName = group.TableName;
            if (!isSafeIdentifier(tableName)) continue;

            var targetColumns = {};
            try {
                targetColumns = getTargetPhysicalColumns(tableName);
            } catch (targetError) {
                debugLog['physical_schema_target_error_' + tableName] = targetError.message;
                result.Errors++;
                continue;
            }

            for (var i = 0; i < group.Columns.length; i++) {
                var sourceColumn = group.Columns[i];
                var columnName = getPhysicalValue(sourceColumn, ['COLUMN_NAME', 'ColumnName', 'Name']);
                var columnType = getPhysicalValue(sourceColumn, ['COLUMN_TYPE', 'ColumnType', 'Type']);
                if (!columnName || !columnType || !isSafeIdentifier(columnName)) continue;

                var targetColumn = targetColumns[String(columnName).toLowerCase()];
                try {
                    if (!targetColumn) {
                        var definition = buildPhysicalColumnDefinition(sourceColumn, false);
                        if (!definition) continue;
                        var addSql = 'ALTER TABLE `' + tableName + '` ADD COLUMN ' + definition;
                        try {
                            V8.Db.FromSql(addSql).ExecuteNonQuery();
                        } catch (physicalAddError) {
                            if (!isMysqlRowSizeTooLargeError(physicalAddError)
                                || !applyPackageColumnTypeOverride(
                                    tableName,
                                    '',
                                    columnName,
                                    'mediumtext',
                                    '物理列新增触发MySQL 65535字节行宽上限'
                                )) throw physicalAddError;
                            definition = buildPhysicalColumnDefinition(sourceColumn, false, 'mediumtext');
                            addSql = 'ALTER TABLE `' + tableName + '` ADD COLUMN ' + definition;
                            V8.Db.FromSql(addSql).ExecuteNonQuery();
                        }
                        result.Added++;
                        debugLog['physical_schema_added_' + tableName + '_' + columnName] =
                            String(mysqlOffpageTypeOverrides[mysqlOffpageOverrideKey(tableName, columnName)] || columnType);
                        continue;
                    }

                    var sourceNullable = String(getPhysicalValue(sourceColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
                    var targetNullable = String(targetColumn.IS_NULLABLE || '').toUpperCase();
                    var sourceDefault = getPhysicalValue(sourceColumn, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
                    var targetDefault = targetColumn.COLUMN_DEFAULT;
                    var sourceComment = String(getPhysicalValue(sourceColumn, ['COLUMN_COMMENT', 'ColumnComment', 'Comment']) || '');
                    var targetComment = String(targetColumn.COLUMN_COMMENT || '');
                    var effectiveColumnType = chooseCompatibleColumnType(columnType, targetColumn.COLUMN_TYPE);
                    var typeChanged = normalizeSqlType(targetColumn.COLUMN_TYPE) != normalizeSqlType(effectiveColumnType);
                    var nullChanged = sourceNullable && sourceNullable != targetNullable;
                    var defaultChanged = String(sourceDefault === null || sourceDefault === undefined ? '' : sourceDefault) !=
                        String(targetDefault === null || targetDefault === undefined ? '' : targetDefault);
                    var commentChanged = sourceComment != targetComment;

                    if (typeChanged || nullChanged || defaultChanged || commentChanged) {
                        if (normalizeSqlType(effectiveColumnType) != normalizeSqlType(columnType)) {
                            debugLog['physical_schema_compat_' + tableName + '_' + columnName] =
                                '保留目标库较宽类型：package=' + columnType + ', target=' + targetColumn.COLUMN_TYPE;
                        }
                        var normalizedNumericData = prepareNumericColumnData(
                            tableName,
                            columnName,
                            sourceColumn,
                            effectiveColumnType,
                            targetColumn.COLUMN_TYPE
                        );
                        if (normalizedNumericData.LegacyBooleanCount > 0) {
                            debugLog['physical_schema_normalized_boolean_' + tableName + '_' + columnName] =
                                '已将' + normalizedNumericData.LegacyBooleanCount + '条历史True/False开关值规范为1/0';
                        }
                        if (normalizedNumericData.BlankCount > 0) {
                            debugLog['physical_schema_normalized_' + tableName + '_' + columnName] =
                                '已将' + normalizedNumericData.BlankCount + '条历史空字符串规范为NULL';
                        }
                        var backfilledNullCount = prepareNotNullColumnData(
                            tableName,
                            columnName,
                            sourceColumn,
                            targetColumn
                        );
                        if (backfilledNullCount > 0) {
                            debugLog['physical_schema_backfilled_' + tableName + '_' + columnName] =
                                '已按应用包默认值回填' + backfilledNullCount + '条历史NULL数据';
                        }
                        var definition = buildPhysicalColumnDefinition(sourceColumn, false, effectiveColumnType);
                        if (!definition) continue;
                        var modifySql = 'ALTER TABLE `' + tableName + '` MODIFY COLUMN ' + definition;
                        V8.Db.FromSql(modifySql).ExecuteNonQuery();
                        result.Modified++;
                        debugLog['physical_schema_modified_' + tableName + '_' + columnName] =
                            'type:' + targetColumn.COLUMN_TYPE + '->' + effectiveColumnType + ', null:' + targetNullable + '->' + sourceNullable;
                    } else {
                        result.Skipped++;
                    }
                } catch (syncError) {
                    debugLog['physical_schema_sync_error_' + tableName + '_' + columnName] = syncError.message;
                    result.Errors++;
                }
            }
        }

        return result;
    };

    var buildPhysicalTableFilter = function (tableNames) {
        if (!tableNames || tableNames.length == 0) return null;
        var map = {};
        for (var i = 0; i < tableNames.length; i++) {
            if (isSafeIdentifier(tableNames[i])) {
                map[String(tableNames[i]).toLowerCase()] = true;
            }
        }
        return map;
    };

    /* BACKGROUND_TASK_BOOTSTRAP_READINESS_V1 */
    /* BACKGROUND_TASK_RUNTIME_SCOPE_V1 */
    var isBackgroundTaskBootstrapPackage = function () {
        var packageInfo = Package.PackageInfo || {};
        var appKey = firstTextParam([
            V8.Param.AppId,
            V8.Param.AppKey,
            packageInfo.AppId,
            packageInfo.AppKey,
            packageInfo.SourceAppId,
            packageInfo.SourceAppKey
        ]);
        return appKey.toLowerCase() == 'app.microi.background-task';
    };

    // The bootstrap package is installed in the foreground because it cannot
    // enqueue itself. Do not report success until the complete worker schema and
    // all distributed-runtime indexes can be read back from the physical database.
    var validateBackgroundTaskBootstrapReadiness = function () {
        if (!isBackgroundTaskBootstrapPackage()) return null;

        var tableName = 'mci_background_task';
        var requiredColumns = [
            'Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted', 'OsClient',
            'UserKey', 'Title', 'Type', 'ApiEngineKey', 'Status', 'StatusText', 'Progress',
            'ProgressMode', 'WorkCurrent', 'WorkTotal', 'Msg', 'Log', 'StartTime', 'EndTime',
            'HeartbeatTime', 'EstimatedEndTime', 'RemainingSeconds', 'EstimateConfidence',
            'CancelRequested', 'ResultJson', 'ParamJson', 'TrustedUserJson', 'IdempotencyKey',
            'ConcurrencyKey', 'LeaseOwner', 'LeaseExpiresAt', 'FencingToken', 'AttemptCount',
            'MaxAttempts', 'ExecutionCount', 'RetryOnFailure', 'NextRunTime', 'ProgressSampleTime',
            'ProgressSampleCurrent', 'ThroughputPerSecond', 'ProgressSampleCount', 'CheckpointJson',
            'LastError', 'BusinessTable', 'BusinessId', 'BusinessStatusField',
            'BusinessTaskIdField', 'BusinessProgressField', 'BusinessEtaField',
            'RuntimeOsClientType', 'RuntimeOsClientNetwork'
        ];
        var physicalColumns = getTargetPhysicalColumns(tableName);
        var missingColumns = [];
        for (var columnIndex = 0; columnIndex < requiredColumns.length; columnIndex++) {
            var requiredColumn = requiredColumns[columnIndex];
            if (!physicalColumns[String(requiredColumn).toLowerCase()]) missingColumns.push(requiredColumn);
        }
        if (missingColumns.length > 0) {
            throw new Error(
                '后台任务基础能力未就绪：物理表 ' + tableName + ' 缺少字段 ' + missingColumns.join(',')
                + '；本次安装不会标记为成功，请修复安装包后重试'
            );
        }

        var indexRows = V8.Db.FromSql(
            'SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS ' +
            'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0) ORDER BY INDEX_NAME, SEQ_IN_INDEX'
        ).AddInParameter('@p0', tableName).ToArray() || [];
        var actualIndexes = {};
        for (var indexRowIndex = 0; indexRowIndex < indexRows.length; indexRowIndex++) {
            var indexRow = indexRows[indexRowIndex] || {};
            var indexName = getPhysicalValue(indexRow, ['INDEX_NAME', 'IndexName', 'Key_name', 'Name']);
            var indexColumn = getPhysicalValue(indexRow, ['COLUMN_NAME', 'ColumnName']);
            var sequence = parseInt(getPhysicalValue(indexRow, ['SEQ_IN_INDEX', 'SeqInIndex']) || 1, 10);
            var nonUnique = parseInt(getPhysicalValue(indexRow, ['NON_UNIQUE', 'NonUnique']) || 0, 10);
            if (!indexName || !indexColumn) continue;
            var indexKey = String(indexName).toLowerCase();
            if (!actualIndexes[indexKey]) actualIndexes[indexKey] = { Columns: [], Unique: nonUnique == 0 };
            actualIndexes[indexKey].Columns[Math.max(0, sequence - 1)] = String(indexColumn);
        }

        var requiredIndexes = [
            { Name: 'ux_mci_bg_task_runtime_idem', Aliases: ['ux_mci_background_task_idempotency'], Columns: ['OsClient', 'RuntimeOsClientType', 'RuntimeOsClientNetwork', 'IdempotencyKey'], Unique: true },
            { Name: 'ix_mci_bg_task_runtime_claim', Aliases: ['ix_mci_background_task_claim'], Columns: ['OsClient', 'RuntimeOsClientType', 'RuntimeOsClientNetwork', 'Status', 'NextRunTime', 'LeaseExpiresAt', 'CreateTime'], Unique: false },
            { Name: 'ix_mci_background_task_user', Columns: ['OsClient', 'UserKey', 'IsDeleted', 'CreateTime'], Unique: false },
            { Name: 'ix_mci_background_task_concurrency', Columns: ['OsClient', 'ConcurrencyKey', 'Status', 'LeaseExpiresAt'], Unique: false }
        ];
        var invalidIndexes = [];
        for (var requiredIndexIndex = 0; requiredIndexIndex < requiredIndexes.length; requiredIndexIndex++) {
            var requiredIndex = requiredIndexes[requiredIndexIndex];
            var candidateNames = [requiredIndex.Name].concat(requiredIndex.Aliases || []);
            var actualIndex = null;
            for (var candidateNameIndex = 0; candidateNameIndex < candidateNames.length; candidateNameIndex++) {
                var candidateIndex = actualIndexes[String(candidateNames[candidateNameIndex]).toLowerCase()];
                if (!candidateIndex) continue;
                var candidateColumns = candidateIndex.Columns.join(',').toLowerCase();
                if (candidateColumns == requiredIndex.Columns.join(',').toLowerCase()
                    && candidateIndex.Unique == requiredIndex.Unique) {
                    actualIndex = candidateIndex;
                    break;
                }
            }
            var actualColumns = actualIndex ? actualIndex.Columns.join(',').toLowerCase() : '';
            var requiredColumnText = requiredIndex.Columns.join(',').toLowerCase();
            if (!actualIndex || actualColumns != requiredColumnText || actualIndex.Unique != requiredIndex.Unique) {
                invalidIndexes.push(requiredIndex.Name + '(' + requiredIndex.Columns.join(',') + ')');
            }
        }
        if (invalidIndexes.length > 0) {
            throw new Error(
                '后台任务基础能力未就绪：缺少或不匹配的物理索引 ' + invalidIndexes.join('；')
                + '；请先更新“应用商城”后再重新安装本应用'
            );
        }

        return { ColumnCount: requiredColumns.length, IndexCount: requiredIndexes.length };
    };

    var ddlTablesChecked = {};
    for (var i = 0; i < ddlStatements.length; i++) {
        var ddlItem = ddlStatements[i];
        if (!ddlItem.DDL || !ddlItem.TableName) continue;

        var ddlInfo = classifyDdlStatement(ddlItem.DDL, ddlItem.TableName);
        var ddlLogKey = ddlInfo.TableName + (ddlInfo.IndexName ? '_' + ddlInfo.IndexName : '_' + i);
        var alreadyExists = ddlInfo.Kind == 'table'
            ? ddlTableExists(ddlInfo.TableName)
            : (ddlInfo.Kind == 'index' ? ddlIndexExists(ddlInfo.TableName, ddlInfo.IndexName) : false);

        if (alreadyExists) {
            ddlSkipped++;
            debugLog['ddl_skip_' + ddlLogKey] = ddlInfo.Kind == 'index' ? '索引已存在' : '表已存在';
        } else {
            try {
                V8.Db.FromSql(ddlItem.DDL).ExecuteNonQuery();
                ddlExecuted++;
                debugLog['ddl_execute_' + ddlLogKey] = ddlInfo.Kind == 'index' ? '索引创建成功' : 'DDL执行成功';
            } catch (ddlError) {
                var finalDdlError = ddlError;
                var recoveredFromRowSize = false;
                if (ddlInfo.Kind == 'table' && isMysqlRowSizeTooLargeError(ddlError)) {
                    var promotedWideColumns = promoteWidePackageColumnsForTable(
                        ddlInfo.TableName,
                        ddlItem.TableId,
                        500,
                        'CREATE TABLE触发MySQL 65535字节行宽上限'
                    );
                    if (promotedWideColumns > 0) {
                        try {
                            V8.Db.FromSql(ddlItem.DDL).ExecuteNonQuery();
                            recoveredFromRowSize = true;
                            ddlExecuted++;
                            debugLog['ddl_row_size_recovered_' + ddlLogKey] =
                                '已将' + promotedWideColumns + '个非索引长varchar列提升为mediumtext后创建成功';
                        } catch (ddlRetryError) {
                            finalDdlError = ddlRetryError;
                        }
                    }
                }

                if (!recoveredFromRowSize) {
                    // 多节点或重复请求可能在存在性检查之后抢先创建对象。
                    // 失败后再次回读；对象已存在即按幂等成功处理。
                    var existsAfterError = ddlInfo.Kind == 'table'
                        ? ddlTableExists(ddlInfo.TableName)
                        : (ddlInfo.Kind == 'index' ? ddlIndexExists(ddlInfo.TableName, ddlInfo.IndexName) : false);
                    if (existsAfterError) {
                        ddlSkipped++;
                        debugLog['ddl_race_skip_' + ddlLogKey] = '其它节点已创建，按幂等成功跳过';
                    } else {
                        debugLog['ddl_execute_error_' + ddlLogKey] = String(
                            finalDdlError && finalDdlError.message ? finalDdlError.message : finalDdlError
                        );
                        ddlSkipped++;
                    }
                }
            }
        }

        // 每张表只检查一次字段；索引语句不能重复触发相同的物理字段同步。
        var ddlTableKey = String(ddlInfo.TableName || ddlItem.TableName).toLowerCase();
        if (ddlInfo.Kind == 'index' || ddlTablesChecked[ddlTableKey]) continue;
        ddlTablesChecked[ddlTableKey] = true;

        // 无论表是新创建还是已存在，都检查并补充缺失的字段。
        try {
            // 查询表的所有字段
            var checkColumnsSQL = "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + ddlItem.TableName + "'";
            var columnsData = V8.Db.FromSql(checkColumnsSQL).ToArray();

            if (!columnsData || columnsData.length == 0) {
                debugLog['ddl_check_columns_' + ddlItem.TableName] = '表不存在或查询字段失败';
                continue;
            }

            var existingColumns = {};
            var existingColumnTypes = {};
            for (var c = 0; c < columnsData.length; c++) {
                try {
                    var colName = columnsData[c].COLUMN_NAME;
                    if (colName != null && colName !== undefined) {
                        // 使用String.prototype确保安全
                        var colNameStr = String.prototype.toLowerCase.call(String(colName));
                        existingColumns[colNameStr] = true;
                        existingColumnTypes[colNameStr] = String(columnsData[c].COLUMN_TYPE || '');
                    }
                } catch (e) {
                    debugLog['field_parse_error_' + ddlItem.TableName + '_' + c] = 'Column: ' + JSON.stringify(columnsData[c]) + ', Error: ' + e.message;
                }
            }

            // 获取该表应有的所有字段：合并审计字段和自定义字段
            var diyFields = Package.DiyFields || [];
            var tableFields = [];

            // 1. 先添加审计字段（fixedDiyField）
            for (var ff = 0; ff < fixedDiyField.length; ff++) {
                tableFields.push(fixedDiyField[ff]);
            }

            // 2. 再添加该表的自定义字段（从Package.DiyFields中筛选）
            // 排除已在fixedDiyField中的字段名（比较时忽略大小写，但保持原始大小写）
            var fixedFieldNames = {};
            for (var ff = 0; ff < fixedDiyField.length; ff++) {
                if (fixedDiyField[ff].Name) {
                    // 用小写作为key来判断重复，但不改变原始字段名
                    var fixedNameKey = ('' + fixedDiyField[ff].Name).toLowerCase();
                    fixedFieldNames[fixedNameKey] = true;
                }
            }

            for (var f = 0; f < diyFields.length; f++) {
                if (diyFields[f].TableId == ddlItem.TableId && diyFields[f].Name) {
                    // 用小写key判断是否重复，但添加的是原始对象（保持大驼峰）
                    var diyNameKey = ('' + diyFields[f].Name).toLowerCase();
                    if (!fixedFieldNames[diyNameKey]) {
                        tableFields.push(diyFields[f]);  // 保持原始大小写
                        fixedFieldNames[diyNameKey] = true; // 同一应用包内同表同名字段只处理一次
                    }
                }
            }

            // 检查缺失的字段并添加
            var fieldsAddedForTable = 0;
            for (var f = 0; f < tableFields.length; f++) {
                var field = tableFields[f];
                var fieldName = field.Name;

                if (!fieldName) continue;

                // Type为空、null或"1"表示虚拟字段，不应存在于物理表
                var fieldType = field.Type;
                if (!fieldType || fieldType === '' || fieldType === '1' || fieldType === 1) {
                    debugLog['field_virtual_' + ddlItem.TableName + '_' + fieldName] = '虚拟字段(Type=' + fieldType + ')，跳过物理表同步';
                    continue;
                }

                // 转换为字符串确保安全 - 使用最安全的转换方式
                var fieldNameStr = ('' + fieldName);

                // MySQL字段名长度限制为64字符
                if (fieldNameStr.length > 64) {
                    debugLog['field_name_too_long_' + ddlItem.TableName + '_' + fieldNameStr.substring(0, 30)] = '字段名过长，已跳过：' + fieldNameStr.length + '字符';
                    continue;
                }

                // 字段已存在，跳过（忽略大小写）
                try {
                    var existingColumnKey = fieldNameStr.toLowerCase();
                    if (existingColumns[existingColumnKey]) {
                        var existingColumnType = String(existingColumnTypes[existingColumnKey] || '').toLowerCase();
                        if ((existingColumnType == 'mediumtext' || existingColumnType == 'longtext')
                            && getTextTypeCapacity(existingColumnType) > getTextTypeCapacity(field.Type)) {
                            applyPackageColumnTypeOverride(
                                ddlItem.TableName,
                                ddlItem.TableId,
                                fieldName,
                                existingColumnType,
                                '目标库已使用较宽的行外文本类型'
                            );
                        }
                        continue;
                    }
                } catch (e) {
                    debugLog['field_check_error_' + ddlItem.TableName + '_' + fieldNameStr] = 'Error checking field: ' + e.message;
                    continue;
                }

                var fieldType = mapToMySQLType(field.Type);
                var alterSQL = buildDiyFieldAddColumnSql(ddlItem.TableName, field, fieldType);

                try {
                    V8.Db.FromSql(alterSQL).ExecuteNonQuery();
                    existingColumns[existingColumnKey] = true;
                    existingColumnTypes[existingColumnKey] = fieldType;
                    fieldsAdded++;
                    fieldsAddedForTable++;
                    debugLog['field_added_' + ddlItem.TableName + '_' + fieldName] = '字段已添加';
                } catch (alterError) {
                    var alterMessage = String(alterError && alterError.message ? alterError.message : alterError);
                    var recoveredFieldAdd = false;
                    if (isMysqlRowSizeTooLargeError(alterError)
                        && applyPackageColumnTypeOverride(
                            ddlItem.TableName,
                            ddlItem.TableId,
                            fieldName,
                            'mediumtext',
                            'ADD COLUMN触发MySQL 65535字节行宽上限'
                        )) {
                        var offpageAlterSql = buildDiyFieldAddColumnSql(ddlItem.TableName, field, 'mediumtext');
                        try {
                            V8.Db.FromSql(offpageAlterSql).ExecuteNonQuery();
                            existingColumns[existingColumnKey] = true;
                            existingColumnTypes[existingColumnKey] = 'mediumtext';
                            fieldsAdded++;
                            fieldsAddedForTable++;
                            recoveredFieldAdd = true;
                            debugLog['field_add_row_size_recovered_' + ddlItem.TableName + '_' + fieldName] =
                                'varchar新增失败后已安全改用mediumtext';
                        } catch (offpageAlterError) {
                            alterError = offpageAlterError;
                            alterMessage = String(
                                offpageAlterError && offpageAlterError.message
                                    ? offpageAlterError.message
                                    : offpageAlterError
                            );
                        }
                    }
                    if (recoveredFieldAdd) {
                        continue;
                    } else if (/duplicate\s+column\s+name/i.test(alterMessage)) {
                        existingColumns[existingColumnKey] = true;
                        debugLog['field_add_skipped_' + ddlItem.TableName + '_' + fieldName] = '字段已存在，按幂等安装跳过';
                    } else {
                        debugLog['field_add_error_' + ddlItem.TableName + '_' + fieldName] = alterMessage;
                    }
                }
            }

            if (fieldsAddedForTable > 0) {
                debugLog['ddl_alter_' + ddlItem.TableName] = '添加了' + fieldsAddedForTable + '个字段';
            }

        } catch (checkError) {
            debugLog['ddl_check_error_' + ddlItem.TableName] = checkError.message;
        }
    }

    stats.DDLExecuted = (stats.DDLExecuted || 0) + ddlExecuted;
    stats.DDLSkipped = (stats.DDLSkipped || 0) + ddlSkipped;
    stats.FieldsAdded = (stats.FieldsAdded || 0) + fieldsAdded;
    debugLog.step0Result = 'DDL执行完成：创建表' + ddlExecuted + '，跳过' + ddlSkipped + '，添加字段' + fieldsAdded;

    var earlyPhysicalSync = backgroundChunkingEnabled
        ? { Added: 0, Modified: 0, Skipped: 0, Errors: 0 }
        : syncPhysicalColumnsFromPackage(null);
    stats.PhysicalFieldsAdded = (stats.PhysicalFieldsAdded || 0) + earlyPhysicalSync.Added;
    stats.PhysicalFieldsModified = (stats.PhysicalFieldsModified || 0) + earlyPhysicalSync.Modified;
    stats.PhysicalFieldsSkipped = (stats.PhysicalFieldsSkipped || 0) + earlyPhysicalSync.Skipped;
    stats.PhysicalFieldsErrors = (stats.PhysicalFieldsErrors || 0) + earlyPhysicalSync.Errors;
    debugLog.step0_5Result = '真实物理字段预同步完成：修改' + earlyPhysicalSync.Modified + '，新增' + earlyPhysicalSync.Added + '，跳过' + earlyPhysicalSync.Skipped + '，异常' + earlyPhysicalSync.Errors;

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Ddl') {
        assertSchemaChunkSucceeded('DDL');
        var nextDdlPhase = ddlChunkEnd < allDdlStatements.length ? 'Ddl' : 'Tables';
        var nextDdlIndex = ddlChunkEnd < allDdlStatements.length ? ddlChunkEnd : 0;
        var ddlProgress = allDdlStatements.length > 0
            ? 10 + Math.floor(10 * ddlChunkEnd / allDdlStatements.length)
            : 20;
        return buildSchemaContinuation(
            nextDdlPhase,
            nextDdlIndex,
            ddlProgress,
            nextDdlPhase == 'Ddl' ? 'DDL 分片已提交，将继续创建物理结构' : 'DDL 已提交，将继续导入表定义'
        );
    }

    // ==================== 步骤1：处理diy_table数据 ====================

    reportProgress(25, '正在导入表单引擎表定义');
    debugLog.step1 = '开始处理diy_table数据';

    var allDiyTables = Package.DiyTables || [];
    var tableChunkStart = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Tables'
        ? Math.min(backgroundCheckpointIndex, allDiyTables.length)
        : 0;
    var tableChunkEnd = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Tables'
        ? Math.min(allDiyTables.length, tableChunkStart + schemaTableChunkSize)
        : allDiyTables.length;
    var diyTables = [];
    if (!backgroundChunkingEnabled || backgroundCheckpointPhase == 'Tables') {
        for (var tableCopyIndex = tableChunkStart; tableCopyIndex < tableChunkEnd; tableCopyIndex++) {
            diyTables.push(allDiyTables[tableCopyIndex]);
        }
    }

    for (var i = 0; i < diyTables.length; i++) {
        var table = diyTables[i];

        if (!table.Id) {
            debugLog['table_no_id_' + i] = '跳过无Id的表数据';
            continue;
        }

        // 目标库主键优先：老客户的业务引用可能已经使用自己的 TableId，不能为了
        // 对齐应用包而修改目标库主键。只把包内Id映射到目标Id，再修正本次包对象。
        var packageTableId = table.Id;
        var rawTableById = V8.Db.FromSql(
            'SELECT Id, Name, OsClient, IsDeleted FROM diy_table WHERE Id = @p0 LIMIT 1'
        ).AddInParameter('@p0', packageTableId).First();
        var naturalTable = table.Name
            ? V8.Db.FromSql(
                'SELECT Id, Name FROM diy_table WHERE LOWER(Name) = LOWER(@p0) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', table.Name).First()
            : null;

        if (naturalTable && naturalTable.Id) {
            var targetTableId = String(naturalTable.Id);
            execNonQuery(
                'UPDATE diy_table SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                [V8.OsClient, targetTableId]
            );
            if (targetTableId != packageTableId) {
                addIdMap('Table', packageTableId, targetTableId, table.Name || '表主键对齐');
                table.Id = targetTableId;
            }
        } else if (rawTableById && rawTableById.Id
            && String(rawTableById.Name || '').toLowerCase() == String(table.Name || '').toLowerCase()) {
            execNonQuery(
                'UPDATE diy_table SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                [V8.OsClient, packageTableId]
            );
        } else if (rawTableById && rawTableById.Id) {
            var newTableId = String(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());
            addIdMap('Table', packageTableId, newTableId, table.Name || '表主键冲突');
            table.Id = newTableId;
        }

        var exists = checkExists('diy_table', table.Id);
        var modelCopy = {};
        for (var key in table) {
            modelCopy[key] = table[key];
        }
        // DiyConfig is a retired compatibility column. New package installs
        // must use dedicated physical columns exposed through DIY metadata.
        delete modelCopy.DiyConfig;
        modelCopy.OsClient = V8.OsClient;
        modelCopy.Id = table.Id;
        if (exists) {
            var uptResult = runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData('diy_table', modelCopy);
            }, 'table_upt_' + table.Id);
            if (uptResult.Code == 1) {
                stats.TableUpdated++;
            } else {
                debugLog['table_upt_error_' + table.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('diy_table', modelCopy);
            }, 'table_add_' + table.Id);
            if (addResult.Code == 1) {
                stats.TableInserted++;
            } else {
                debugLog['table_add_error_' + table.Id] = addResult.Msg;
            }
        }

        //清除缓存
        var delCaheResult1 = V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${table.Id.toLowerCase()}`);
        debugLog['delCaheResult1_' + table.Id] = delCaheResult1;

        var delCaheResult2 = V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${table.Name.toLowerCase()}`);
        debugLog['delCaheResult2_' + table.Name] = delCaheResult2;

        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${table.Id}`);
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${table.Name.toLowerCase()}`);
    }

    // TableId 映射必须在字段阶段之前应用，确保字段自然键查询命中目标库现有表。
    applyPackageIdMaps();

    debugLog.step1Result = '表数据处理完成：新增' + stats.TableInserted + '，修改' + stats.TableUpdated;

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Tables') {
        assertSchemaChunkSucceeded('表定义');
        var nextTablePhase = tableChunkEnd < allDiyTables.length ? 'Tables' : 'PlanFields';
        var nextTableIndex = tableChunkEnd < allDiyTables.length ? tableChunkEnd : 0;
        var tableProgress = allDiyTables.length > 0
            ? 20 + Math.floor(15 * tableChunkEnd / allDiyTables.length)
            : 35;
        return buildSchemaContinuation(
            nextTablePhase,
            nextTableIndex,
            tableProgress,
            nextTablePhase == 'Tables' ? '表定义分片已提交，将继续处理' : '表定义已提交，将规划字段主键映射'
        );
    }

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'PlanFields') {
        var fieldsForPlanning = Package.DiyFields || [];
        var fieldPlanStart = Math.min(backgroundCheckpointIndex, fieldsForPlanning.length);
        var fieldPlanEnd = Math.min(fieldsForPlanning.length, fieldPlanStart + schemaFieldPlanChunkSize);
        planPackageFieldIdMaps(fieldPlanStart, fieldPlanEnd);
        assertSchemaChunkSucceeded('字段主键规划');
        var nextFieldPlanPhase = fieldPlanEnd < fieldsForPlanning.length ? 'PlanFields' : 'Fields';
        var nextFieldPlanIndex = fieldPlanEnd < fieldsForPlanning.length ? fieldPlanEnd : 0;
        var fieldPlanProgress = fieldsForPlanning.length > 0
            ? 35 + Math.floor(5 * fieldPlanEnd / fieldsForPlanning.length)
            : 40;
        return buildSchemaContinuation(
            nextFieldPlanPhase,
            nextFieldPlanIndex,
            fieldPlanProgress,
            nextFieldPlanPhase == 'PlanFields'
                ? '字段主键映射规划分片已持久化，将继续规划'
                : '字段主键映射已持久化，将开始导入字段定义'
        );
    }

    // ==================== 步骤2：处理diy_field数据 ====================

    reportProgress(40, '正在导入字段定义');
    debugLog.step2 = '开始处理diy_field数据';

    var allDiyFields = Package.DiyFields || [];
    var fieldChunkStart = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Fields'
        ? Math.min(backgroundCheckpointIndex, allDiyFields.length)
        : 0;
    var fieldChunkEnd = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Fields'
        ? Math.min(allDiyFields.length, fieldChunkStart + schemaFieldChunkSize)
        : allDiyFields.length;
    var diyFields = [];
    if (!backgroundChunkingEnabled || backgroundCheckpointPhase == 'Fields') {
        for (var fieldCopyIndex = fieldChunkStart; fieldCopyIndex < fieldChunkEnd; fieldCopyIndex++) {
            var sourceFieldForChunk = allDiyFields[fieldCopyIndex] || {};
            var fieldForChunk = {};
            for (var sourceFieldKey in sourceFieldForChunk) {
                if (Object.prototype.hasOwnProperty.call(sourceFieldForChunk, sourceFieldKey)) {
                    fieldForChunk[sourceFieldKey] = sourceFieldForChunk[sourceFieldKey];
                }
            }
            if (sourceFieldForChunk && sourceFieldForChunk.Id) {
                var plannedFieldTargetId = fieldMapTarget(sourceFieldForChunk.Id);
                if (plannedFieldTargetId) fieldForChunk.Id = plannedFieldTargetId;
            }
            diyFields.push(fieldForChunk);
        }
    }
    debugLog.step2_totalFields = diyFields.length;
    var fieldChanges = []; // 记录字段的变化（Name、Type、Label）

    for (var i = 0; i < diyFields.length; i++) {
        var field = diyFields[i];

        // SelectApi 专项追踪
        var isSelectApi = (field.Name === 'SelectApi');
        if (isSelectApi) {
            debugLog['★SelectApi_found_at_index'] = i;
            debugLog['★SelectApi_Id'] = field.Id;
            debugLog['★SelectApi_TableId'] = field.TableId;
        }

        if (!field.Id) {
            debugLog['field_no_id_' + i] = '跳过无Id的字段数据';
            continue;
        }

        var packageFieldId = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Fields'
            && allDiyFields[fieldChunkStart + i]
            ? allDiyFields[fieldChunkStart + i].Id
            : field.Id;
        var exists = checkExists('diy_field', field.Id);

        // FormEngine 默认会过滤软删除或租户标识异常的数据，但物理主键仍然存在。
        // 如果只按 FormEngine 的“不存在”结果继续 INSERT，会触发 diy_field.PRIMARY 重复。
        // 先直查物理主键：同一逻辑字段则恢复后更新；真正的 Id 冲突则给包内字段
        // 分配新 Id，并记录映射，后续统一修复菜单/字段 JSON 中的引用。
        if (!exists) {
            var rawFieldById = V8.Db.FromSql(
                'SELECT Id, TableId, Name, OsClient, IsDeleted FROM diy_field WHERE Id = @p0 LIMIT 1'
            ).AddInParameter('@p0', field.Id).First();

            if (rawFieldById && rawFieldById.Id) {
                var sameLogicalField = normalizeId(rawFieldById.TableId).toLowerCase() == normalizeId(field.TableId).toLowerCase()
                    && String(rawFieldById.Name || '').toLowerCase() == String(field.Name || '').toLowerCase();

                if (sameLogicalField) {
                    execNonQuery(
                        'UPDATE diy_field SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                        [V8.OsClient, field.Id]
                    );
                    exists = checkExists('diy_field', field.Id);
                    debugLog['field_primary_recovered_' + field.Id] = '检测到物理主键已存在，已恢复后按更新处理';
                } else {
                    var naturalFieldResult = V8.Db.FromSql(
                        'SELECT Id FROM diy_field WHERE TableId = @p0 AND LOWER(Name) = LOWER(@p1) ORDER BY IsDeleted ASC LIMIT 1'
                    ).AddInParameter('@p0', field.TableId)
                        .AddInParameter('@p1', field.Name)
                        .First();
                    var targetFieldId = naturalFieldResult && naturalFieldResult.Id
                        ? String(naturalFieldResult.Id)
                        : String(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());

                    addIdMap('Field', packageFieldId, targetFieldId, field.Name || '字段主键冲突');
                    field.Id = targetFieldId;
                    exists = checkExists('diy_field', field.Id);
                    if (naturalFieldResult && naturalFieldResult.Id) {
                        execNonQuery(
                            'UPDATE diy_field SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                            [V8.OsClient, field.Id]
                        );
                        exists = checkExists('diy_field', field.Id);
                    }
                    debugLog['field_primary_remapped_' + packageFieldId] = packageFieldId + ' -> ' + targetFieldId;
                }
            }
        }
        if (isSelectApi) {
            debugLog['★SelectApi_existsById'] = exists;
        }

        if (!exists && field.TableId && field.Name) {
            var rawNaturalField = V8.Db.FromSql(
                'SELECT Id FROM diy_field WHERE TableId = @p0 AND LOWER(Name) = LOWER(@p1) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', field.TableId)
                .AddInParameter('@p1', field.Name)
                .First();
            if (rawNaturalField && rawNaturalField.Id) {
                var naturalFieldId = String(rawNaturalField.Id);
                execNonQuery(
                    'UPDATE diy_field SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                    [V8.OsClient, naturalFieldId]
                );
                if (naturalFieldId != field.Id) {
                    addIdMap('Field', packageFieldId, naturalFieldId, field.Name || '字段主键对齐');
                    field.Id = naturalFieldId;
                }
                exists = checkExists('diy_field', field.Id);
            }
        }

        if (!exists) {
            //判断根据Name和TableId是否存在，如果存在，则需要将Id改到以应用商城的为准
            var checkByNameResult = V8.FormEngine.GetFormData('diy_field', {
                OsClient: V8.OsClient,
                _Where: [
                    ['TableId', '=', field.TableId],
                    ['Name', '=', field.Name]
                ]
            });
            if (isSelectApi) {
                debugLog['★SelectApi_checkByName_Code'] = checkByNameResult.Code;
                debugLog['★SelectApi_checkByName_HasData'] = !!(checkByNameResult.Data);
            }
            if (checkByNameResult.Code == 1) {
                var oldFieldId = checkByNameResult.Data && checkByNameResult.Data.Id;
                if (oldFieldId && oldFieldId != field.Id) {
                    addIdMap('Field', packageFieldId, oldFieldId, field.Name || '字段主键对齐');
                    field.Id = oldFieldId;
                }
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${field.TableId.toLowerCase()}`);
                exists = true;
            }
        }

        if (exists) {
            // 存在则修改 - 先查询旧数据，记录变化
            var oldFieldResult = V8.FormEngine.GetFormData('diy_field', {
                OsClient: V8.OsClient,
                Id: field.Id
            });
            if (oldFieldResult.Code == 1 && oldFieldResult.Data) {
                var oldField = oldFieldResult.Data;
                var hasChange = false;
                var changeInfo = {
                    Id: field.Id,
                    TableName: oldField.TableName, // 使用旧的TableName
                    OldName: oldField.Name,
                    NewName: field.Name,
                    OldType: oldField.Type,
                    NewType: field.Type,
                    OldLabel: oldField.Label,
                    NewLabel: field.Label
                };

                // 检测是否有变化
                if (oldField.Name != field.Name) {
                    hasChange = true;
                    debugLog['field_name_changed_' + field.Id] = oldField.Name + ' → ' + field.Name;
                }
                if (oldField.Type != field.Type) {
                    hasChange = true;
                    debugLog['field_type_changed_' + field.Id] = oldField.Type + ' → ' + field.Type;
                }
                if (oldField.Label != field.Label) {
                    hasChange = true;
                }

                if (hasChange) {
                    fieldChanges.push(changeInfo);
                }
            }

            // 创建副本，避免污染原始数据（步骤2.5需要用到TableId）
            var fieldCopy = {};
            for (var key in field) {
                fieldCopy[key] = field[key];
            }
            delete fieldCopy.DiyConfig;
            fieldCopy.OsClient = V8.OsClient;
            fieldCopy.Id = field.Id;
            fieldCopy.NameConfirm = 1;

            // 检测僵尸记录：由旧版 _FormData wrapper bug 创建，Name/TableId/OsClient 均为 null
            // FormEngine.UptFormData 内部走 UptDiyField → ChangeColumn(from=null, to=Name)，
            // 这条路径对 null→非null 的字段名变更有副作用，改为直接 SQL 全量覆盖
            var isZombieRecord = (oldFieldResult.Code == 1 && oldFieldResult.Data &&
                (!oldFieldResult.Data.OsClient || !oldFieldResult.Data.Name || !oldFieldResult.Data.TableId));

            if (isSelectApi) {
                debugLog['★SelectApi_isZombieRecord'] = isZombieRecord;
                debugLog['★SelectApi_fieldCopy_Name'] = fieldCopy.Name;
                debugLog['★SelectApi_fieldCopy_OsClient'] = fieldCopy.OsClient;
                debugLog['★SelectApi_oldData_Name'] = oldFieldResult.Data ? oldFieldResult.Data.Name : null;
                debugLog['★SelectApi_oldData_TableId'] = oldFieldResult.Data ? oldFieldResult.Data.TableId : null;
            }

            if (!isZombieRecord && oldFieldResult.Code == 1 && oldFieldResult.Data
                && !fieldDefinitionNeedsUpdate(oldFieldResult.Data, fieldCopy)) {
                stats.FieldSkipped++;
                debugLog['field_unchanged_' + field.Id] = '字段定义未变化，按幂等安装跳过';
            } else if (isZombieRecord) {
                // 僵尸记录：用直接 SQL 全量覆盖所有字段
                // 使用 sqle()/sqln() 转义，0个SQL参数，彻底绕过 Jint 的 params object[] 限制
                var sqle = function(s) { return s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'"; };
                var sqln = function(n) { return n == null ? 'NULL' : Number(n); };
                try {
                    var rawSql = "UPDATE diy_field SET " +
                        "TableId=" + sqle(fieldCopy.TableId) + "," +
                        "TableName=" + sqle(fieldCopy.TableName) + "," +
                        "Name=" + sqle(fieldCopy.Name) + "," +
                        "Label=" + sqle(fieldCopy.Label) + "," +
                        "Type=" + sqle(fieldCopy.Type) + "," +
                        "Component=" + sqle(fieldCopy.Component) + "," +
                        "Sort=" + sqln(fieldCopy.Sort) + "," +
                        "Visible=" + sqln(fieldCopy.Visible) + "," +
                        "Readonly=" + sqln(fieldCopy.Readonly) + "," +
                        "NotEmpty=" + sqln(fieldCopy.NotEmpty) + "," +
                        "Tab=" + sqle(fieldCopy.Tab) + "," +
                        "FormWidth=" + sqln(fieldCopy.FormWidth) + "," +
                        "TableWidth=" + sqln(fieldCopy.TableWidth) + "," +
                        "Config=" + sqle(fieldCopy.Config) + "," +
                        "Data=" + sqle(fieldCopy.Data) + "," +
                        "`Unique`=" + sqln(fieldCopy.Unique) + "," +
                        "Placeholder=" + sqle(fieldCopy.Placeholder) + "," +
                        "BindRole=" + sqle(fieldCopy.BindRole) + "," +
                        "InTableEdit=" + sqln(fieldCopy.InTableEdit) + "," +
                        "IsLockField=" + sqln(fieldCopy.IsLockField) + "," +
                        "Encrypt=" + sqln(fieldCopy.Encrypt) + "," +
                        "AppVisible=" + sqln(fieldCopy.AppVisible) + "," +
                        "NameConfirm=1," +
                        "OsClient=" + sqle(V8.OsClient) + "," +
                        "IsDeleted=0," +
                        "UpdateTime=NOW() " +
                        "WHERE Id='" + field.Id + "'";
                    var zombieRawCount = V8.Db.FromSql(rawSql).ExecuteNonQuery();
                    if (isSelectApi) {
                        debugLog['★SelectApi_zombieRawCount'] = zombieRawCount;
                    }
                    if (zombieRawCount > 0) {
                        stats.FieldUpdated++;
                    } else {
                        // 影响0行，说明记录根本不存在，改为新增
                        var recoveredZombieDuplicate = false;
                        var addFallback2 = runWriteWithRetry(function () {
                            return V8.FormEngine.AddFormData('diy_field', fieldCopy);
                        }, 'field_zombie_add_' + field.Id);
                        if (addFallback2.Code != 1 && isDuplicatePrimaryError(addFallback2)) {
                            recoveredZombieDuplicate = true;
                            execNonQuery(
                                'UPDATE diy_field SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                                [V8.OsClient, field.Id]
                            );
                            addFallback2 = runWriteWithRetry(function () {
                                return V8.FormEngine.UptFormData('diy_field', fieldCopy);
                            }, 'field_zombie_recover_' + field.Id);
                        }
                        if (addFallback2.Code == 1) {
                            if (recoveredZombieDuplicate) stats.FieldUpdated++;
                            else stats.FieldInserted++;
                        } else {
                            debugLog['field_zombie_add_error_' + field.Id] = addFallback2.Msg;
                        }
                    }
                } catch(zombieRawErr) {
                    debugLog['field_zombie_raw_error_' + field.Id] = zombieRawErr.message;
                }
            } else {
                // 正常记录：使用 FormEngine 更新（默认不触发V8事件）
                var uptResult = runWriteWithRetry(function () {
                    return V8.FormEngine.UptFormData('diy_field', fieldCopy);
                }, 'field_upt_' + field.Id);
                if (isSelectApi) {
                    debugLog['★SelectApi_uptResult_Code'] = uptResult.Code;
                    debugLog['★SelectApi_uptResult_Msg'] = uptResult.Msg || '';
                }
                if (uptResult.Code == 1) {
                    stats.FieldUpdated++;
                } else {
                    // 更新失败：可能被软删(IsDeleted=1)，先修复再重试
                    try {
                        V8.Db.FromSql("UPDATE diy_field SET IsDeleted=0, OsClient='" + V8.OsClient + "' WHERE Id='" + field.Id + "'").ExecuteNonQuery();
                    } catch(fixErr) {
                        debugLog['field_fix_isdeleted_error_' + field.Id] = fixErr.message;
                    }
                    var uptRetryResult = runWriteWithRetry(function () {
                        return V8.FormEngine.UptFormData('diy_field', fieldCopy);
                    }, 'field_recover_' + field.Id);
                    if (uptRetryResult.Code == 1) {
                        stats.FieldUpdated++;
                    } else {
                        // 已确认物理主键存在时绝不能降级为 INSERT，否则会把真实更新错误
                        // 伪装成 Duplicate PRIMARY，并让任务以“成功但有异常”结束。
                        debugLog['field_upt_error_' + field.Id] = writeResultMessage(uptRetryResult);
                    }
                }
            }
        } else {
            var fieldCopy = {};
            for (var key in field) {
                fieldCopy[key] = field[key];
            }
            delete fieldCopy.DiyConfig;
            fieldCopy.OsClient = V8.OsClient;
            fieldCopy.Id = field.Id;
            // 不存在则新增
            var recoveredDuplicateField = false;
            var addResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('diy_field', fieldCopy);
            }, 'field_add_' + field.Id);
            if (addResult.Code != 1 && isDuplicatePrimaryError(addResult)) {
                recoveredDuplicateField = true;
                execNonQuery(
                    'UPDATE diy_field SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                    [V8.OsClient, field.Id]
                );
                addResult = runWriteWithRetry(function () {
                    return V8.FormEngine.UptFormData('diy_field', fieldCopy);
                }, 'field_duplicate_recover_' + field.Id);
                if (addResult.Code == 1) stats.FieldUpdated++;
            }
            if (isSelectApi) {
                debugLog['★SelectApi_action'] = 'AddFormData';
                debugLog['★SelectApi_addResult_Code'] = addResult.Code;
                debugLog['★SelectApi_addResult_Msg'] = addResult.Msg || '';
                debugLog['★SelectApi_fieldCopy_keys'] = Object.keys(fieldCopy).join(',');
                debugLog['★SelectApi_fieldCopy_Name'] = fieldCopy.Name;
            }
            if (addResult.Code == 1 && !recoveredDuplicateField) {
                stats.FieldInserted++;
            } else if (addResult.Code != 1) {
                debugLog['field_add_error_' + field.Id] = addResult.Msg;
            }

        }
    }

    var step2ReferenceRowsUpdated = syncMappedReferences();
    if (step2ReferenceRowsUpdated > 0) {
        debugLog.step2ReferenceRowsUpdated = step2ReferenceRowsUpdated;
    }

    for (var i = 0; i < diyTables.length; i++) {
        var table = diyTables[i];

        if (!table.Id) {
            debugLog['table_no_id_' + i] = '跳过无Id的表数据';
            continue;
        }
        //清除缓存
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${table.Id}`);
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${table.Name.toLowerCase()}`);
    }

    debugLog.step2Result = '字段数据处理完成：新增' + stats.FieldInserted + '，修改' + stats.FieldUpdated + '，检测到' + fieldChanges.length + '个字段变化';

    // SelectApi 执行后验证
    try {
        var verifySelectApi = V8.FormEngine.GetFormData('diy_field', {
            OsClient: V8.OsClient,
            _Where: [
                ['TableId', '=', '1d28e502-70ea-4a2b-9793-699b3f42234e'],
                ['Name', '=', 'SelectApi']
            ]
        });
        debugLog['★SelectApi_verify_Code'] = verifySelectApi.Code;
        if (verifySelectApi.Code == 1 && verifySelectApi.Data) {
            debugLog['★SelectApi_verify'] = '✅ 存在于diy_field，Id=' + verifySelectApi.Data.Id + ', Name=' + verifySelectApi.Data.Name;
        } else {
            // 再按Id查一次
            var verifyById = V8.FormEngine.GetFormData('diy_field', {
                OsClient: V8.OsClient,
                Id: '01KGE0ZVAK801D2F3K1MWRMNTV'
            });
            if (verifyById.Code == 1 && verifyById.Data) {
                debugLog['★SelectApi_verify'] = '⚠️ Id存在但Name不匹配，当前Name=' + verifyById.Data.Name + ', Type=' + verifyById.Data.Type + ', TableId=' + verifyById.Data.TableId;
            } else {
                debugLog['★SelectApi_verify'] = '❌ diy_field中不存在（按Name和Id均未找到）';
                debugLog['★SelectApi_verifyById_Code'] = verifyById.Code;
                debugLog['★SelectApi_verifyById_Msg'] = verifyById.Msg || '';
            }
        }
    } catch (verifyError) {
        debugLog['★SelectApi_verify_error'] = verifyError.message;
    }

    // ==================== 步骤2.5：同步物理表字段（补充所有表的缺失字段） ====================

    reportProgress(55, '正在同步物理表字段');
    debugLog.step2_5 = '开始同步物理表字段';

    var physicalFieldsAdded = 0;
    var physicalFieldsRenamed = 0;
    var physicalFieldsModified = 0;
    var fieldChunkDefinitions = diyFields || [];
    var packageTablesForPhysicalSync = Package.DiyTables || [];
    var packageFieldsForPhysicalSync = Package.DiyFields || [];
    var physicalPackageTableNames = [];
    var physicalPackageTableNameMap = {};
    var packagePhysicalColumns = Package.PhysicalColumns || [];
    for (var physicalNameIndex = 0; physicalNameIndex < packagePhysicalColumns.length; physicalNameIndex++) {
        var physicalName = String(getPhysicalValue(packagePhysicalColumns[physicalNameIndex], ['TABLE_NAME', 'TableName']) || '');
        var physicalNameKey = physicalName.toLowerCase();
        if (physicalName && !physicalPackageTableNameMap[physicalNameKey]) {
            physicalPackageTableNameMap[physicalNameKey] = true;
            physicalPackageTableNames.push(physicalName);
        }
    }
    var physicalChunkStart = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Physical'
        ? Math.min(backgroundCheckpointIndex, physicalPackageTableNames.length)
        : 0;
    var physicalChunkEnd = backgroundChunkingEnabled && backgroundCheckpointPhase == 'Physical'
        ? Math.min(physicalPackageTableNames.length, physicalChunkStart + schemaPhysicalTableChunkSize)
        : physicalPackageTableNames.length;
    var activePhysicalTableNames = {};
    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Fields') {
        for (var touchedFieldIndex = 0; touchedFieldIndex < fieldChunkDefinitions.length; touchedFieldIndex++) {
            var touchedTableId = normalizeId(fieldChunkDefinitions[touchedFieldIndex] && fieldChunkDefinitions[touchedFieldIndex].TableId).toLowerCase();
            if (touchedTableId) activePhysicalTableNames['id:' + touchedTableId] = true;
        }
    } else if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Physical') {
        for (var physicalBatchIndex = physicalChunkStart; physicalBatchIndex < physicalChunkEnd; physicalBatchIndex++) {
            activePhysicalTableNames['name:' + physicalPackageTableNames[physicalBatchIndex].toLowerCase()] = true;
        }
    }

    var diyTables = [];
    var diyFields = [];
    if (!backgroundChunkingEnabled) {
        diyTables = packageTablesForPhysicalSync;
        diyFields = packageFieldsForPhysicalSync;
    } else if (backgroundCheckpointPhase == 'Fields') {
        diyFields = fieldChunkDefinitions;
        for (var touchedTableIndex = 0; touchedTableIndex < packageTablesForPhysicalSync.length; touchedTableIndex++) {
            var touchedTableSource = packageTablesForPhysicalSync[touchedTableIndex] || {};
            var touchedTableTargetId = idMaps.Table[touchedTableSource.Id]
                || idMaps.Table[String(touchedTableSource.Id || '').toLowerCase()]
                || touchedTableSource.Id;
            if (!activePhysicalTableNames['id:' + normalizeId(touchedTableTargetId).toLowerCase()]) continue;
            var touchedTableCopy = {};
            for (var touchedTableKey in touchedTableSource) {
                if (Object.prototype.hasOwnProperty.call(touchedTableSource, touchedTableKey)) {
                    touchedTableCopy[touchedTableKey] = touchedTableSource[touchedTableKey];
                }
            }
            touchedTableCopy.Id = touchedTableTargetId;
            diyTables.push(touchedTableCopy);
        }
    } else if (backgroundCheckpointPhase == 'Physical') {
        for (var physicalTableIndex = 0; physicalTableIndex < packageTablesForPhysicalSync.length; physicalTableIndex++) {
            var physicalTableSource = packageTablesForPhysicalSync[physicalTableIndex] || {};
            if (!activePhysicalTableNames['name:' + String(physicalTableSource.Name || '').toLowerCase()]) continue;
            var physicalTableCopy = {};
            for (var physicalTableKey in physicalTableSource) {
                if (Object.prototype.hasOwnProperty.call(physicalTableSource, physicalTableKey)) {
                    physicalTableCopy[physicalTableKey] = physicalTableSource[physicalTableKey];
                }
            }
            physicalTableCopy.Id = idMaps.Table[physicalTableSource.Id]
                || idMaps.Table[String(physicalTableSource.Id || '').toLowerCase()]
                || physicalTableSource.Id;
            diyTables.push(physicalTableCopy);
        }
    }

    // 辅助函数：判断字段Type是否为虚拟字段
    var isVirtualFieldType = function (fieldType) {
        return !fieldType || fieldType === '' || fieldType === '1' || fieldType === 1;
    };

    // 阶段0：执行字段变更（重命名、修改类型/注释）
    debugLog.step2_5_phase0 = '开始处理字段变更';
    for (var i = 0; i < fieldChanges.length; i++) {
        var change = fieldChanges[i];
        if (!change.TableName || !change.OldName || !change.NewName) continue;

        // 如果新Type或旧Type是虚拟字段，跳过物理表变更
        // 新Type是虚拟：不需要修改物理列
        // 旧Type是虚拟：物理列本就不存在，无法修改（缺失的物理字段由phase1/2处理添加）
        if (isVirtualFieldType(change.NewType) || isVirtualFieldType(change.OldType)) {
            debugLog['change_skip_virtual_' + change.TableName + '_' + change.NewName] = '虚拟字段(OldType=' + change.OldType + ', NewType=' + change.NewType + ')，跳过物理表变更';
            continue;
        }

        var tableName = change.TableName;
        var oldName = change.OldName;
        var newName = change.NewName;
        var newType = mapToMySQLType(change.NewType);
        var newLabel = change.NewLabel;

        try {
            // 如果字段名发生变化，执行重命名
            if (oldName != newName) {
                var oldColumnCount = V8.Db.FromSql(
                    'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1'
                ).AddInParameter('@p0', tableName)
                    .AddInParameter('@p1', oldName)
                    .ToScalar();
                var newColumnCount = V8.Db.FromSql(
                    'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1'
                ).AddInParameter('@p0', tableName)
                    .AddInParameter('@p1', newName)
                    .ToScalar();

                if (Number(newColumnCount || 0) > 0) {
                    debugLog['rename_skipped_target_exists_' + tableName + '_' + oldName] =
                        '目标列 ' + newName + ' 已存在，按幂等安装跳过重命名';
                    continue;
                }
                if (Number(oldColumnCount || 0) < 1) {
                    debugLog['rename_skipped_source_missing_' + tableName + '_' + oldName] =
                        '源列 ' + oldName + ' 已不存在，按幂等安装跳过重命名';
                    continue;
                }
                // MySQL 重命名字段语法：ALTER TABLE table CHANGE COLUMN old_name new_name type
                var renameSQL = 'ALTER TABLE `' + tableName + '` CHANGE COLUMN `' + oldName + '` `' + newName + '` ' + newType;

                if (newName == 'Id') {
                    renameSQL += ' NOT NULL PRIMARY KEY';
                } else {
                    renameSQL += ' NULL';
                }

                if (newLabel && newLabel !== newName) {
                    var comment = newLabel.replace(/'/g, "''");
                    renameSQL += " COMMENT '" + comment + "'";
                }

                try {
                    V8.Db.FromSql(renameSQL).ExecuteNonQuery();
                    physicalFieldsRenamed++;
                    debugLog['rename_' + tableName + '_' + oldName] = '重命名为 ' + newName;
                } catch (renameError) {
                    debugLog['rename_error_' + tableName + '_' + oldName] = renameError.message;
                }
            }
            // 如果只是类型或注释变化，执行修改
            else if (change.OldType != change.NewType || change.OldLabel != change.NewLabel) {
                // MySQL 修改字段类型/注释：ALTER TABLE table MODIFY COLUMN field_name type
                var modifySQL = 'ALTER TABLE `' + tableName + '` MODIFY COLUMN `' + newName + '` ' + newType;

                if (newName == 'Id') {
                    modifySQL += ' NOT NULL PRIMARY KEY';
                } else {
                    modifySQL += ' NULL';
                }

                if (newLabel && newLabel !== newName) {
                    var comment = newLabel.replace(/'/g, "''");
                    modifySQL += " COMMENT '" + comment + "'";
                }

                try {
                    V8.Db.FromSql(modifySQL).ExecuteNonQuery();
                    physicalFieldsModified++;
                    debugLog['modify_' + tableName + '_' + newName] = '类型/注释已修改';
                } catch (modifyError) {
                    debugLog['modify_error_' + tableName + '_' + newName] = modifyError.message;
                }
            }
        } catch (changeError) {
            debugLog['change_error_' + tableName + '_' + oldName] = changeError.message;
        }
    }

    // 阶段1：按TableId分组字段
    var fieldsByTable = {};
    for (var i = 0; i < diyFields.length; i++) {
        var field = diyFields[i];
        if (field.TableId && field.Name) {
            if (!fieldsByTable[field.TableId]) {
                fieldsByTable[field.TableId] = [];
            }
            fieldsByTable[field.TableId].push(field);
        }
    }

    // 阶段2：遍历所有表，添加缺失字段
    debugLog.step2_5_phase1 = '开始添加缺失字段';
    for (var i = 0; i < diyTables.length; i++) {
        var table = diyTables[i];
        if (!table.Name || !table.Id) continue;

        // 使用原始表名（保持大小写）
        var tableName = table.Name;
        var tableFields = fieldsByTable[table.Id] || [];

        if (tableFields.length == 0) {
            debugLog['sync_skip_' + tableName] = '无字段定义，跳过';
            continue;
        }

        try {
            // 查询物理表的所有字段（不区分大小写），同时获取实际表名
            var checkColumnsSQL = "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER('" + tableName + "')";
            var columnsData = V8.Db.FromSql(checkColumnsSQL).ToArray();

            if (!columnsData || columnsData.length == 0) {
                debugLog['sync_table_not_exist_' + tableName] = '表不存在，跳过字段同步';
                continue;
            }

            // 获取实际的物理表名（安全转换）
            var actualTableName = tableName;
            try {
                if (columnsData[0] && columnsData[0].TABLE_NAME) {
                    actualTableName = String(columnsData[0].TABLE_NAME);
                }
            } catch (e) {
                debugLog['sync_tablename_error_' + tableName] = e.message;
            }

            // 构建已存在的字段Map（小写key）
            var existingColumns = {};
            var columnsCount = 0;
            try {
                columnsCount = Number(columnsData.length) || 0;
            } catch (e) {
                debugLog['sync_count_error_' + tableName] = e.message;
                continue;
            }

            for (var c = 0; c < columnsCount; c++) {
                try {
                    if (!columnsData[c]) continue;
                    var colName = columnsData[c].COLUMN_NAME;
                    if (colName != null && colName !== undefined) {
                        // 使用最安全的方式转换
                        var colNameStr = String(colName);
                        var colNameLower = String.prototype.toLowerCase.call(colNameStr);
                        existingColumns[colNameLower] = true;
                    }
                } catch (e) {
                    debugLog['sync_parse_error_' + tableName + '_' + c] = e.message;
                }
            }

            // 检查并添加缺失的字段
            var fieldsAddedForTable = 0;
            for (var f = 0; f < tableFields.length; f++) {
                try {
                    var field = tableFields[f];
                    if (!field) continue;

                    var fieldName = field.Name;
                    if (!fieldName) continue;

                    // Type为空、null或"1"表示虚拟字段，不应存在于物理表
                    var fieldType = field.Type;
                    if (!fieldType || fieldType === '' || fieldType === '1' || fieldType === 1) {
                        debugLog['sync_virtual_' + tableName + '_' + fieldName] = '虚拟字段(Type=' + fieldType + ')，跳过物理表同步';
                        continue;
                    }

                    // 安全转换字段名
                    var fieldNameStr = '';
                    try {
                        fieldNameStr = String(fieldName);
                    } catch (e) {
                        debugLog['sync_fieldname_convert_error_' + tableName + '_' + f] = e.message;
                        continue;
                    }

                    // MySQL字段名长度限制（安全检查）
                    var fieldNameLength = 0;
                    try {
                        fieldNameLength = Number(fieldNameStr.length) || 0;
                    } catch (e) {
                        debugLog['sync_length_error_' + tableName + '_' + f] = e.message;
                        continue;
                    }

                    if (fieldNameLength > 64) {
                        try {
                            var shortName = String.prototype.substring.call(fieldNameStr, 0, 30);
                            debugLog['sync_name_too_long_' + tableName + '_' + shortName] = '字段名过长：' + fieldNameLength;
                        } catch (e) {
                            debugLog['sync_name_too_long_' + tableName + '_' + f] = '字段名过长：' + fieldNameLength;
                        }
                        continue;
                    }

                    // 字段已存在，跳过（忽略大小写比较）
                    var fieldNameLower = '';
                    try {
                        fieldNameLower = String.prototype.toLowerCase.call(fieldNameStr);
                    } catch (e) {
                        debugLog['sync_lowercase_error_' + tableName + '_' + f] = e.message;
                        continue;
                    }

                    if (existingColumns[fieldNameLower]) {
                        continue;
                    }
                } catch (outerError) {
                    debugLog['sync_field_loop_error_' + tableName + '_' + f] = outerError.message;
                    continue;
                }

                // 字段不存在，需要添加（使用实际的物理表名）
                try {
                    var fieldType = mapToMySQLType(field.Type);
                    var alterSQL = 'ALTER TABLE `' + actualTableName + '` ADD COLUMN `' + fieldNameStr + '` ' + fieldType;

                    // Id字段特殊处理
                    if (fieldNameStr == 'Id') {
                        alterSQL += ' NOT NULL PRIMARY KEY';
                    } else {
                        alterSQL += ' NULL';
                    }

                    // 添加字段说明
                    if (field.Label && field.Label !== fieldNameStr) {
                        try {
                            var comment = String(field.Label).replace(/'/g, "''");
                            alterSQL += " COMMENT '" + comment + "'";
                        } catch (e) {
                            debugLog['sync_comment_error_' + tableName + '_' + fieldNameStr] = e.message;
                        }
                    }

                    try {
                        V8.Db.FromSql(alterSQL).ExecuteNonQuery();
                        physicalFieldsAdded++;
                        fieldsAddedForTable++;
                        debugLog['sync_added_' + tableName + '_' + fieldNameStr] = '字段已添加';
                    } catch (alterError) {
                        debugLog['sync_add_error_' + tableName + '_' + fieldNameStr] = alterError.message;
                    }
                } catch (buildSqlError) {
                    debugLog['sync_buildsql_error_' + tableName + '_' + f] = buildSqlError.message;
                }
            }

            if (fieldsAddedForTable > 0) {
                debugLog['sync_table_' + tableName] = '添加了' + fieldsAddedForTable + '个字段';
            }

        } catch (checkError) {
            debugLog['sync_error_' + tableName] = checkError.message;
        }
    }

    var physicalSyncTableNames = [];
    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Physical') {
        for (var activePhysicalIndex = physicalChunkStart; activePhysicalIndex < physicalChunkEnd; activePhysicalIndex++) {
            physicalSyncTableNames.push(physicalPackageTableNames[activePhysicalIndex]);
        }
    } else {
        for (var ps = 0; ps < diyTables.length; ps++) {
            if (diyTables[ps] && diyTables[ps].Name) physicalSyncTableNames.push(diyTables[ps].Name);
        }
    }
    var packagePhysicalSync = (!backgroundChunkingEnabled || backgroundCheckpointPhase == 'Physical')
        ? syncPhysicalColumnsFromPackage(buildPhysicalTableFilter(physicalSyncTableNames))
        : { Added: 0, Modified: 0, Skipped: 0, Errors: 0 };
    physicalFieldsAdded += packagePhysicalSync.Added;
    physicalFieldsModified += packagePhysicalSync.Modified;
    stats.PhysicalFieldsSkipped = (stats.PhysicalFieldsSkipped || 0) + packagePhysicalSync.Skipped;
    stats.PhysicalFieldsErrors = (stats.PhysicalFieldsErrors || 0) + packagePhysicalSync.Errors;
    debugLog.step2_5_physicalPackageSync =
        '真实物理字段复核完成：修改' + packagePhysicalSync.Modified + '，新增' + packagePhysicalSync.Added + '，跳过' + packagePhysicalSync.Skipped + '，异常' + packagePhysicalSync.Errors;

    stats.PhysicalFieldsAdded = (stats.PhysicalFieldsAdded || 0) + physicalFieldsAdded;
    stats.PhysicalFieldsRenamed = (stats.PhysicalFieldsRenamed || 0) + physicalFieldsRenamed;
    stats.PhysicalFieldsModified = (stats.PhysicalFieldsModified || 0) + physicalFieldsModified;
    debugLog.step2_5Result = '物理表字段同步完成：重命名' + physicalFieldsRenamed + '，修改' + physicalFieldsModified + '，新增' + physicalFieldsAdded;

    var shouldValidateBackgroundTaskReadiness = !backgroundChunkingEnabled
        || (backgroundCheckpointPhase == 'Physical' && physicalChunkEnd >= physicalPackageTableNames.length);
    var backgroundTaskReadiness = shouldValidateBackgroundTaskReadiness
        ? validateBackgroundTaskBootstrapReadiness()
        : null;
    if (backgroundTaskReadiness) {
        debugLog.background_task_readiness_verified =
            '后台任务基础能力已完成物理回读：字段' + backgroundTaskReadiness.ColumnCount
            + '个，运行索引' + backgroundTaskReadiness.IndexCount + '个';
    }

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Fields') {
        assertSchemaChunkSucceeded('字段定义');
        var nextFieldPhase = fieldChunkEnd < allDiyFields.length ? 'Fields' : 'Physical';
        var nextFieldIndex = fieldChunkEnd < allDiyFields.length ? fieldChunkEnd : 0;
        var fieldProgress = allDiyFields.length > 0
            ? 40 + Math.floor(15 * fieldChunkEnd / allDiyFields.length)
            : 55;
        return buildSchemaContinuation(
            nextFieldPhase,
            nextFieldIndex,
            fieldProgress,
            nextFieldPhase == 'Fields'
                ? '字段定义与对应物理列分片已提交，将继续处理'
                : '字段定义已提交，将复核包内物理列'
        );
    }

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'Physical') {
        assertSchemaChunkSucceeded('物理列复核');
        var nextPhysicalPhase = physicalChunkEnd < physicalPackageTableNames.length ? 'Physical' : 'ApplicationAssets';
        var nextPhysicalIndex = physicalChunkEnd < physicalPackageTableNames.length ? physicalChunkEnd : 0;
        var physicalProgress = physicalPackageTableNames.length > 0
            ? 55 + Math.floor(5 * physicalChunkEnd / physicalPackageTableNames.length)
            : 60;
        return buildSchemaContinuation(
            nextPhysicalPhase,
            nextPhysicalIndex,
            physicalProgress,
            nextPhysicalPhase == 'Physical'
                ? '物理列复核分片已提交，将继续处理'
                : 'Schema 已全部提交，将继续安装在线应用资产'
        );
    }

    // ==================== 步骤3：处理sys_menu数据 ====================

    // 应用资产依赖 sys_microistore / mci_ai_app_file / sys_microiservice 等基础表，必须在 DDL、表定义、字段和物理列完成后再安装。
    var applicationBundles = [];
    var shouldInstallApplicationBundles = !backgroundChunkingEnabled
        || backgroundCheckpointPhase == 'ApplicationAssets';
    if (shouldInstallApplicationBundles) {
        var packageBundles = Package.ApplicationBundles;
        if (packageBundles && packageBundles.length != null) {
            for (var bundleIndex = 0; bundleIndex < packageBundles.length; bundleIndex++) {
                if (packageBundles[bundleIndex]) applicationBundles.push(packageBundles[bundleIndex]);
            }
        }
        var singleApplicationBundle = Package.ApplicationBundle || Package.AiApplication || Package.FrontendApplication;
        if (singleApplicationBundle) applicationBundles.push(singleApplicationBundle);
    }
    for (var installBundleIndex = 0; installBundleIndex < applicationBundles.length; installBundleIndex++) {
        var applicationBundleResult = installApplicationBundle(applicationBundles[installBundleIndex], installBundleIndex);
        if (applicationBundleResult && applicationBundleResult.Data && applicationBundleResult.Data.BackgroundTask
            && applicationBundleResult.Data.BackgroundTask.HasMore === true) {
            return applicationBundleResult;
        }
    }

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'ApplicationAssets') {
        assertSchemaChunkSucceeded('在线应用资产');
        return buildSchemaContinuation(
            'PostSchema',
            0,
            70,
            '在线应用资产已提交，将在新执行片中导入菜单、流程、接口和随包数据'
        );
    }

    if (backgroundChunkingEnabled && backgroundCheckpointPhase == 'ScheduleJobs') {
        reportProgress(98, '正在幂等安装定时任务');
        savePackageScheduleJobs();
        upsertMicroiStoreVersionRecord();
        return {
            Code: 1,
            Data: {
                应用包信息: {
                    名称: Package.PackageInfo.Name || '未命名',
                    版本: Package.PackageInfo.Version || Package.PackageInfo.AppVersion || ''
                },
                执行概览: {
                    定时任务: '保存' + stats.ScheduleJobSaved + '个',
                    应用安装版本: '写入' + (stats.VersionRecordUpdated || 0) + '条'
                }
            },
            Msg: '导入成功'
        };
    }

    reportProgress(70, '正在导入菜单和按钮配置');
    debugLog.step3 = '开始处理sys_menu数据';

    var sysMenus = Package.SysMenus || [];
    var packageAppIdLower = firstTextParam([
        V8.Param.AppId,
        V8.Param.AppKey,
        Package.PackageInfo.AppId,
        Package.PackageInfo.AppKey
    ]).toLowerCase();
    var packageName = firstTextParam([V8.Param.AppName, Package.PackageInfo.Name]);
    var preserveInterfaceEnginePageTabs = packageAppIdLower == 'app.microi.api-engine'
        || packageName == '接口引擎';
    var legacyMenuDiyConfigFields = [
        'SelectApi', 'AddBtnText', 'SaveBtnText', 'AddBtnType', 'SaveType',
        'HiddenIndex', 'GeneralSeaarch', 'ImportApi', 'ImportProgressApi', 'ExportApi'
    ];
    var parseLegacyMenuDiyConfig = function (value, label) {
        if (!value) return {};
        if (typeof value == 'object') return value;
        try {
            var parsed = JSON.parse(String(value));
            return parsed && typeof parsed == 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            debugLog['menu_diyconfig_parse_warning_' + label] =
                'DiyConfig不是合法JSON，已保留可识别的物理字段：' + error.message;
            return {};
        }
    };
    var mergeLegacyMenuDiyConfig = function (target, source) {
        if (!source || typeof source != 'object') return;
        for (var sourceKey in source) {
            if (!Object.prototype.hasOwnProperty.call(source, sourceKey)
                || sourceKey == '__proto__'
                || sourceKey == 'constructor'
                || sourceKey == 'prototype') {
                continue;
            }
            target[sourceKey] = source[sourceKey];
        }
    };

    // ADMIN_MENU_PERMISSION_V1
    // 应用新增菜单必须立即对目标租户所有系统管理员可用。只处理本次新建或
    // 从删除状态恢复的菜单，避免应用升级覆盖客户为既有菜单维护的角色策略。
    var administratorRolesForMenuGrant = null;
    var parseMenuPermissionArray = function (value) {
        if (value === null || value === undefined || value === '') return [];
        if (Array.isArray(value)) return value;
        if (typeof value == 'object' && value.length !== undefined) return value;
        var text = String(value).replace(/^\s+|\s+$/g, '');
        if (!text) return [];
        try {
            var parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (parsed !== null && parsed !== undefined && parsed !== '') return [parsed];
        } catch (parseError) {
            // 历史数据偶尔保存为逗号分隔文本；保留可识别值，不能因补权限而丢失。
            return text.replace(/^\[|\]$/g, '').split(',');
        }
        return [];
    };
    var appendUniqueMenuPermission = function (values, seen, value) {
        if (value === null || value === undefined) return;
        var text = String(value).replace(/^\s+|\s+$/g, '').replace(/^['\"]|['\"]$/g, '');
        if (!text || seen[text]) return;
        seen[text] = true;
        values.push(text);
    };
    var collectAdministratorMenuPermissions = function (menuModel) {
        var permissions = [];
        var seen = {};
        var basePermissions = ['Read', 'Add', 'Edit', 'Del', 'Export', 'Import'];
        for (var baseIndex = 0; baseIndex < basePermissions.length; baseIndex++) {
            appendUniqueMenuPermission(permissions, seen, basePermissions[baseIndex]);
        }
        var buttonFields = ['MoreBtns', 'ExportMoreBtns', 'BatchSelectMoreBtns', 'PageBtns', 'PageTabs', 'FormBtns'];
        for (var fieldIndex = 0; fieldIndex < buttonFields.length; fieldIndex++) {
            var buttonList = parseMenuPermissionArray((menuModel || {})[buttonFields[fieldIndex]]);
            for (var buttonIndex = 0; buttonIndex < buttonList.length; buttonIndex++) {
                var button = buttonList[buttonIndex] || {};
                if (typeof button == 'object') {
                    appendUniqueMenuPermission(permissions, seen, button.Id);
                    appendUniqueMenuPermission(permissions, seen, button.Name);
                }
            }
        }
        return permissions;
    };
    var getAdministratorRolesForMenuGrant = function () {
        if (administratorRolesForMenuGrant !== null) return administratorRolesForMenuGrant;
        var roleResult = V8.FormEngine.GetTableData('sys_role', {
            _Where: [['Level', '>=', 9999]],
            _SelectFields: ['Id', 'Name', 'Level', 'IsDeleted'],
            _OrderBy: 'Level',
            _OrderByType: 'DESC',
            _PageIndex: 1,
            _PageSize: 1000
        });
        if (!roleResult || (roleResult.Code != 1 && roleResult.Code != 2)) {
            throw new Error('查询系统管理员角色失败：' + ((roleResult && roleResult.Msg) || '接口无返回'));
        }
        var roleRows = roleResult && roleResult.Code == 1 && roleResult.Data ? roleResult.Data : [];
        administratorRolesForMenuGrant = [];
        for (var roleIndex = 0; roleIndex < roleRows.length; roleIndex++) {
            var role = roleRows[roleIndex] || {};
            if (role.Id && Number(role.Level || 0) >= 9999 && Number(role.IsDeleted || 0) !== 1) {
                administratorRolesForMenuGrant.push(role);
            }
        }
        if (administratorRolesForMenuGrant.length === 0) {
            throw new Error('未找到有效的系统管理员角色（sys_role.Level >= 9999），已阻止提交，避免新菜单无人可管理');
        }
        return administratorRolesForMenuGrant;
    };
    var readAdministratorMenuRoleLimits = function (roleId, menuId) {
        var limitResult = V8.FormEngine.GetTableData('sys_rolelimit', {
            _Where: [
                ['RoleId', '=', roleId],
                ['AND', 'FkId', '=', menuId],
                ['AND', 'Type', '=', 'Menu']
            ],
            _SelectFields: ['Id', 'Permission'],
            _PageIndex: 1,
            _PageSize: 1000
        });
        if (!limitResult || (limitResult.Code != 1 && limitResult.Code != 2)) {
            throw new Error('查询系统管理员菜单权限失败：' + ((limitResult && limitResult.Msg) || '接口无返回'));
        }
        return limitResult && limitResult.Code == 1 && limitResult.Data ? limitResult.Data : [];
    };
    var assertAdministratorMenuPermissionReadback = function (role, menuModel, requiredPermissions) {
        var persistedRows = readAdministratorMenuRoleLimits(role.Id, menuModel.Id);
        var persistedSeen = {};
        for (var persistedIndex = 0; persistedIndex < persistedRows.length; persistedIndex++) {
            var persistedPermissions = parseMenuPermissionArray((persistedRows[persistedIndex] || {}).Permission);
            for (var permissionIndex = 0; permissionIndex < persistedPermissions.length; permissionIndex++) {
                appendUniqueMenuPermission([], persistedSeen, persistedPermissions[permissionIndex]);
            }
        }
        var missingPermissions = [];
        for (var requiredIndex = 0; requiredIndex < requiredPermissions.length; requiredIndex++) {
            if (!persistedSeen[requiredPermissions[requiredIndex]]) {
                missingPermissions.push(requiredPermissions[requiredIndex]);
            }
        }
        if (persistedRows.length === 0 || missingPermissions.length > 0) {
            throw new Error('系统管理员[' + (role.Name || role.Id) + ']菜单[' + (menuModel.Name || menuModel.Id)
                + ']权限写后回读不完整，缺少：' + (missingPermissions.join(',') || '权限记录'));
        }
    };
    var mergeAdministratorMenuRoleLimits = function (role, menuModel, requiredPermissions, roleLimits) {
        var merged = [];
        var seen = {};
        for (var requiredIndex = 0; requiredIndex < requiredPermissions.length; requiredIndex++) {
            appendUniqueMenuPermission(merged, seen, requiredPermissions[requiredIndex]);
        }
        for (var limitIndex = 0; limitIndex < roleLimits.length; limitIndex++) {
            var existingPermissions = parseMenuPermissionArray((roleLimits[limitIndex] || {}).Permission);
            for (var existingIndex = 0; existingIndex < existingPermissions.length; existingIndex++) {
                appendUniqueMenuPermission(merged, seen, existingPermissions[existingIndex]);
            }
        }
        var permissionJson = JSON.stringify(merged);
        var updatedAny = false;
        for (var updateIndex = 0; updateIndex < roleLimits.length; updateIndex++) {
            var roleLimit = roleLimits[updateIndex] || {};
            if (!roleLimit.Id) continue;
            var currentValues = parseMenuPermissionArray(roleLimit.Permission);
            var currentSeen = {};
            for (var currentIndex = 0; currentIndex < currentValues.length; currentIndex++) {
                appendUniqueMenuPermission([], currentSeen, currentValues[currentIndex]);
            }
            var needsUpdate = false;
            for (var mergedIndex = 0; mergedIndex < merged.length; mergedIndex++) {
                if (!currentSeen[merged[mergedIndex]]) {
                    needsUpdate = true;
                    break;
                }
            }
            if (!needsUpdate) continue;
            var updateResult = runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData('sys_rolelimit', {
                    Id: roleLimit.Id,
                    Permission: permissionJson
                });
            }, 'admin_menu_permission_upt_' + role.Id + '_' + menuModel.Id + '_' + roleLimit.Id);
            if (!updateResult || updateResult.Code != 1) {
                throw new Error('更新系统管理员[' + (role.Name || role.Id) + ']菜单[' + (menuModel.Name || menuModel.Id)
                    + ']权限失败：' + ((updateResult && updateResult.Msg) || '接口无返回'));
            }
            updatedAny = true;
        }
        assertAdministratorMenuPermissionReadback(role, menuModel, requiredPermissions);
        if (updatedAny) stats.AdminRoleLimitUpdated++;
        else stats.AdminRoleLimitSkipped++;
    };
    var grantAdministratorPermissionsForNewMenu = function (menuModel) {
        var roles = getAdministratorRolesForMenuGrant();
        var requiredPermissions = collectAdministratorMenuPermissions(menuModel);
        for (var roleIndex = 0; roleIndex < roles.length; roleIndex++) {
            var role = roles[roleIndex] || {};
            var roleLimits = readAdministratorMenuRoleLimits(role.Id, menuModel.Id);
            if (roleLimits.length > 0) {
                mergeAdministratorMenuRoleLimits(role, menuModel, requiredPermissions, roleLimits);
                continue;
            }
            var deterministicId = String(V8.EncryptHelper.MD5Encrypt(
                'app-menu-admin|' + String(V8.OsClient || '').toLowerCase() + '|'
                + String(role.Id || '').toLowerCase() + '|' + String(menuModel.Id || '').toLowerCase()
            )).toLowerCase();
            var addPermissionResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('sys_rolelimit', {
                    Id: deterministicId,
                    Customer: V8.OsClient,
                    RoleId: role.Id,
                    FkId: menuModel.Id,
                    Type: 'Menu',
                    Permission: JSON.stringify(requiredPermissions),
                    CreateTime: nowText()
                });
            }, 'admin_menu_permission_add_' + role.Id + '_' + menuModel.Id);
            if (addPermissionResult && addPermissionResult.Code == 1) {
                assertAdministratorMenuPermissionReadback(role, menuModel, requiredPermissions);
                stats.AdminRoleLimitInserted++;
                continue;
            }
            if (isDuplicatePrimaryError(addPermissionResult)) {
                roleLimits = readAdministratorMenuRoleLimits(role.Id, menuModel.Id);
                if (roleLimits.length > 0) {
                    mergeAdministratorMenuRoleLimits(role, menuModel, requiredPermissions, roleLimits);
                    continue;
                }
            }
            throw new Error('新增系统管理员[' + (role.Name || role.Id) + ']菜单[' + (menuModel.Name || menuModel.Id)
                + ']权限失败：' + ((addPermissionResult && addPermissionResult.Msg) || '接口无返回'));
        }
    };
    // ADMIN_MENU_PERMISSION_V1_END
    var syncLegacyMenuDiyConfig = function (model, existingDiyConfig, label) {
        var config = {};
        // 先保留目标库中仅旧版使用的未知配置，再合并包内显式配置。
        mergeLegacyMenuDiyConfig(config, parseLegacyMenuDiyConfig(existingDiyConfig, label + '_existing'));
        mergeLegacyMenuDiyConfig(config, parseLegacyMenuDiyConfig(model.DiyConfig, label + '_package'));
        for (var fieldIndex = 0; fieldIndex < legacyMenuDiyConfigFields.length; fieldIndex++) {
            var fieldName = legacyMenuDiyConfigFields[fieldIndex];
            var physicalValue = model[fieldName];
            var physicalPresent = physicalValue !== null
                && physicalValue !== undefined
                && !(typeof physicalValue == 'string' && physicalValue.trim() == '');
            var configValue = config[fieldName];
            var configPresent = configValue !== null
                && configValue !== undefined
                && !(typeof configValue == 'string' && configValue.trim() == '');
            if (physicalPresent) {
                // 包内新版物理字段是本次安装的显式变更，镜像给旧版。
                config[fieldName] = physicalValue;
            } else if (configPresent) {
                // 旧版配置仍有值时补齐新版物理字段。
                model[fieldName] = configValue;
            }
        }
        var hasConfig = false;
        for (var configKey in config) {
            if (Object.prototype.hasOwnProperty.call(config, configKey)) {
                hasConfig = true;
                break;
            }
        }
        if (hasConfig) {
            model.DiyConfig = JSON.stringify(config);
        } else {
            delete model.DiyConfig;
        }
    };

    // 按ParentId排序，确保父菜单先导入
    var sortedMenus = [];
    var menuMap = {};

    for (var i = 0; i < sysMenus.length; i++) {
        menuMap[sysMenus[i].Id] = sysMenus[i];
    }

    // 先导入没有ParentId的根菜单
    for (var i = 0; i < sysMenus.length; i++) {
        if (!sysMenus[i].ParentId || sysMenus[i].ParentId == null) {
            sortedMenus.push(sysMenus[i]);
        }
    }

    // 再导入有ParentId的子菜单
    for (var i = 0; i < sysMenus.length; i++) {
        if (sysMenus[i].ParentId && sysMenus[i].ParentId !== null) {
            sortedMenus.push(sysMenus[i]);
        }
    }

    for (var i = 0; i < sortedMenus.length; i++) {
        var menu = sortedMenus[i];

        applyDirectIdMaps(menu, ['ParentId', 'DiyTableId']);
        applyJsonIdMaps(menu, menuJsonFields);

        if (!menu.Id) {
            debugLog['menu_no_id_' + i] = '跳过无Id的菜单数据';
            continue;
        }

        var packageMenuId = menu.Id;
        var exists = checkExists('sys_menu', menu.Id);
        var revivedDeletedMenu = false;
        if (!exists) {
            var rawMenuById = V8.Db.FromSql(
                'SELECT Id, ModuleEngineKey, Url FROM sys_menu WHERE Id = @p0 LIMIT 1'
            ).AddInParameter('@p0', menu.Id).First();
            if (rawMenuById && rawMenuById.Id) {
                var sameMenuByKey = menu.ModuleEngineKey
                    && String(rawMenuById.ModuleEngineKey || '').toLowerCase() == String(menu.ModuleEngineKey).toLowerCase();
                var sameMenuByUrl = menu.Url
                    && String(rawMenuById.Url || '').toLowerCase() == String(menu.Url).toLowerCase();
                if (sameMenuByKey || sameMenuByUrl) {
                    execNonQuery(
                        'UPDATE sys_menu SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                        [V8.OsClient, menu.Id]
                    );
                    exists = checkExists('sys_menu', menu.Id);
                    revivedDeletedMenu = !!exists;
                }
            }
        }
        if (!exists) {
            var matchedMenu = null;
            if (menu.ModuleEngineKey) {
                var menuByKeyResult = V8.FormEngine.GetFormData('sys_menu', {
                    OsClient: V8.OsClient,
                    _Where: [['ModuleEngineKey', '=', menu.ModuleEngineKey]],
                    _PageSize: 1
                });
                if (menuByKeyResult.Code == 1 && menuByKeyResult.Data) {
                    matchedMenu = menuByKeyResult.Data;
                }
            }
            if (!matchedMenu && menu.Url) {
                var menuByUrlResult = V8.FormEngine.GetFormData('sys_menu', {
                    OsClient: V8.OsClient,
                    _Where: [['Url', '=', menu.Url]],
                    _PageSize: 1
                });
                if (menuByUrlResult.Code == 1 && menuByUrlResult.Data) {
                    matchedMenu = menuByUrlResult.Data;
                }
            }
            if (!matchedMenu && rawMenuById && rawMenuById.Id) {
                var newMenuId = String(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());
                addIdMap('Menu', packageMenuId, newMenuId, menu.Name || '菜单主键冲突');
                menu.Id = newMenuId;
            }
            if (matchedMenu && matchedMenu.Id && matchedMenu.Id != menu.Id) {
                addIdMap('Menu', packageMenuId, matchedMenu.Id, menu.Name || menu.ModuleEngineKey || menu.Url);
                menu.Id = matchedMenu.Id;
                exists = true;
            }
        }

        //如果传入了 InstallParentSysMenuId，并且当前菜单的ParentId并不存在于待导入的菜单中
        if (InstallParentSysMenuId && sysMenus.findIndex(m => m.Id === menu.ParentId) === -1) {
            //并且当前菜单的ParentId等于InstallParentSysMenuId，则将ParentId修改为新导入应用的根菜单Id
            menu.ParentId = InstallParentSysMenuId;
        }
        //如果当前菜单的ParentId并不存在于待导入的菜单中，并且当前菜单的Id不存在于sys_menu表中，则置为顶级
        else if (menu.ParentId
            && menu.ParentId != '00000000000000000000000000'
            && menu.ParentId != '00000000-0000-0000-0000-000000000000'
            && sysMenus.findIndex(m => m.Id === menu.ParentId) === -1) {
            var existsParent = checkExists('sys_menu', menu.ParentId);
            if (!existsParent) {
                menu.ParentId = '00000000000000000000000000';
            }
        }
        var modelCopy = {};
        for (var key in menu) {
            modelCopy[key] = menu[key];
        }
        modelCopy.OsClient = V8.OsClient;
        modelCopy.Id = menu.Id;
        var existingMenuVisibility = null;

        // 应用包升级只能更新菜单功能配置，不能反向覆盖客户已经维护的桌面端/移动端显隐。
        // 新增菜单继续采用包内默认值；仅对目标库中已存在且值明确的菜单保留原值。
        if (exists) {
            var existingMenuVisibilityResult = V8.FormEngine.GetFormData('sys_menu', {
                Id: menu.Id,
                _SelectFields: ['Display', 'AppDisplay', 'DiyConfig']
            });
            existingMenuVisibility = existingMenuVisibilityResult
                && existingMenuVisibilityResult.Code == 1
                ? existingMenuVisibilityResult.Data
                : null;
            if (existingMenuVisibility) {
                if (existingMenuVisibility.Display !== null && existingMenuVisibility.Display !== undefined) {
                    modelCopy.Display = Number(existingMenuVisibility.Display);
                }
                if (existingMenuVisibility.AppDisplay !== null && existingMenuVisibility.AppDisplay !== undefined) {
                    modelCopy.AppDisplay = Number(existingMenuVisibility.AppDisplay);
                }
                debugLog['preserve_existing_menu_visibility_' + menu.Id] =
                    '已保留目标库菜单的Display/AppDisplay配置';
            }
        }
        syncLegacyMenuDiyConfig(
            modelCopy,
            existingMenuVisibility ? existingMenuVisibility.DiyConfig : null,
            String(menu.Id || i)
        );

        var menuNeedsAdministratorPermission = !exists || revivedDeletedMenu;
        var menuWriteSucceeded = false;

        // 接口引擎的 PageTabs 是每个客户按接口分类长期维护的V8按钮集合。
        // 只对 app.microi.api-engine 保留目标库已有的真正多Tab配置（至少2个）；其它字段、
        // 其它菜单及其它应用继续按应用包覆盖，避免把通用合并规则扩大到所有应用。
        if (exists && preserveInterfaceEnginePageTabs
            && (String(menu.ModuleEngineKey || '').toLowerCase() == 'sys_apiengine'
                || String(menu.Url || '').toLowerCase() == '/api-engine')) {
            var existingInterfaceMenu = V8.FormEngine.GetFormData('sys_menu', {
                OsClient: V8.OsClient,
                Id: menu.Id,
                _SelectFields: ['Id', 'PageTabs']
            });
            var existingPageTabs = existingInterfaceMenu && existingInterfaceMenu.Code == 1
                && existingInterfaceMenu.Data
                ? existingInterfaceMenu.Data.PageTabs
                : null;
            var existingPageTabsCount = countPageTabs(existingPageTabs);
            if (existingPageTabsCount > 1) {
                modelCopy.PageTabs = typeof existingPageTabs == 'string'
                    ? existingPageTabs
                    : JSON.stringify(existingPageTabs);
                debugLog['preserve_interface_engine_pagetabs_' + menu.Id] =
                    '已保留目标库接口引擎页面' + existingPageTabsCount + '个Tab分类V8按钮';
            }
        }

        if (exists) {
            // 存在则修改
            var uptResult = runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData('sys_menu', modelCopy);
            }, 'menu_upt_' + menu.Id);
            if (uptResult.Code == 1) {
                stats.MenuUpdated++;
                menuWriteSucceeded = true;
            } else {
                debugLog['menu_upt_error_' + menu.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var recoveredDuplicateMenu = false;
            var addResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('sys_menu', modelCopy);
            }, 'menu_add_' + menu.Id);
            if (addResult.Code != 1 && isDuplicatePrimaryError(addResult)) {
                recoveredDuplicateMenu = true;
                execNonQuery(
                    'UPDATE sys_menu SET OsClient = @p0, IsDeleted = 0 WHERE Id = @p1',
                    [V8.OsClient, menu.Id]
                );
                addResult = runWriteWithRetry(function () {
                    return V8.FormEngine.UptFormData('sys_menu', modelCopy);
                }, 'menu_duplicate_recover_' + menu.Id);
                if (addResult.Code == 1) {
                    stats.MenuUpdated++;
                    menuWriteSucceeded = true;
                }
            }
            if (addResult.Code == 1) {
                if (!recoveredDuplicateMenu) {
                    stats.MenuInserted++;
                    menuWriteSucceeded = true;
                }
            } else if (addResult.Msg && addResult.Msg.indexOf('[Url]已存在唯一值') > -1 && modelCopy.Url) {
                // Url重复，自动追加后缀重试
                var originalUrl = modelCopy.Url;
                var urlCount = V8.Db.FromSql("SELECT COUNT(Id) FROM sys_menu WHERE Url='" + originalUrl.replace(/'/g, "''") + "'").ToScalar();
                var newUrl = originalUrl + '-' + (Number(urlCount) + 1);
                modelCopy.Url = newUrl;
                debugLog['menu_url_retry_' + menu.Id] = originalUrl + ' → ' + newUrl;
                var retryResult = runWriteWithRetry(function () {
                    return V8.FormEngine.AddFormData('sys_menu', modelCopy);
                }, 'menu_url_retry_' + menu.Id);
                if (retryResult.Code == 1) {
                    stats.MenuInserted++;
                    menuWriteSucceeded = true;
                } else {
                    debugLog['menu_add_error_' + menu.Id] = retryResult.Msg;
                }
            } else {
                debugLog['menu_add_error_' + menu.Id] = addResult.Msg;
            }
        }

        if (menuWriteSucceeded && menuNeedsAdministratorPermission) {
            grantAdministratorPermissionsForNewMenu(modelCopy);
        }

        //清除缓存
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.Id.toLowerCase()}`);
        if (menu.ModuleEngineKey) {
            V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.ModuleEngineKey.toLowerCase()}`);
        }
    }

    var migratedMenuIds = {};
    var migrateLegacyMenus = function (binding, fieldName, values) {
        if (!binding || !values || !values.length) return;
        var menuResult = V8.FormEngine.GetTableData('sys_menu', {
            _Where: [[fieldName, 'In', values]],
            _PageIndex: 1,
            _PageSize: 1000
        });
        var menus = menuResult && menuResult.Code == 1 && menuResult.Data ? menuResult.Data : [];
        // v1.4.1 曾把旧 Url 覆盖成稳定微服务 Url。再次安装时同时按微服务绑定回查，
        // 才能恢复旧书签，而不是因为旧 Url 已丢失就永远无法命中。
        var recoverBoundMicroserviceMenus = V8.FormEngine.GetTableData('sys_menu', {
            _Where: [
                ['MicroServiceKey', '=', binding.ServiceKey],
                ['AND', 'MicroServiceRoutePath', '=', binding.RoutePath]
            ],
            _PageIndex: 1,
            _PageSize: 1000
        });
        var boundMenus = recoverBoundMicroserviceMenus && recoverBoundMicroserviceMenus.Code == 1 && recoverBoundMicroserviceMenus.Data
            ? recoverBoundMicroserviceMenus.Data
            : [];
        var menuIdMap = {};
        var mergedMenus = [];
        var appendMenus = function (rows) {
            for (var appendIndex = 0; appendIndex < rows.length; appendIndex++) {
                var appendMenu = rows[appendIndex] || {};
                var appendKey = String(appendMenu.Id || 'index-' + appendIndex);
                if (menuIdMap[appendKey]) continue;
                menuIdMap[appendKey] = true;
                mergedMenus.push(appendMenu);
            }
        };
        appendMenus(menus);
        appendMenus(boundMenus);
        menus = mergedMenus;
        for (var legacyMenuIndex = 0; legacyMenuIndex < menus.length; legacyMenuIndex++) {
            var legacyMenu = menus[legacyMenuIndex] || {};
            if (!legacyMenu.Id || migratedMenuIds[legacyMenu.Id]) continue;
            var openType = String(legacyMenu.OpenType || '').toLowerCase();
            var componentPath = String(legacyMenu.ComponentPath || '').toLowerCase();
            var isExistingNativeComponent = openType != 'microservice'
                && Number(legacyMenu.IsMicroiService || 0) !== 1
                && componentPath
                && componentPath != '/micro-app/host';
            if (binding.PreserveExistingNativeMenus && isExistingNativeComponent) {
                migratedMenuIds[legacyMenu.Id] = true;
                stats.MicroServiceMenusPreserved++;
                continue;
            }
            var stableRoutePath = String(binding.RoutePath || '/');
            if (stableRoutePath.charAt(0) != '/') stableRoutePath = '/' + stableRoutePath;
            var stableMenuUrl = '/micro-app/' + binding.ServiceKey + (stableRoutePath == '/' ? '' : stableRoutePath);
            var currentMenuUrl = firstTextParam([legacyMenu.Url]);
            var preservedLegacyUrl = currentMenuUrl || stableMenuUrl;
            if (fieldName == 'Url' && currentMenuUrl == stableMenuUrl && values.length) {
                preservedLegacyUrl = values[Math.min(legacyMenuIndex, values.length - 1)];
            }
            var migrateResult = runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData('sys_menu', {
                    Id: legacyMenu.Id,
                    Url: preservedLegacyUrl,
                    OpenType: 'MicroService',
                    IsMicroiService: 1,
                    ComponentPath: '/micro-app/host',
                    MicroServiceId: binding.ServiceId,
                    MicroServiceKey: binding.ServiceKey,
                    MsKey: binding.ServiceKey,
                    MicroServicePageId: binding.PageId,
                    MicroServiceRoutePath: binding.RoutePath
                });
            }, 'migrate_microservice_menu_' + legacyMenu.Id);
            if (migrateResult && migrateResult.Code == 1) {
                migratedMenuIds[legacyMenu.Id] = true;
                stats.MicroServiceMenus++;
                V8.Cache.Remove('Microi:' + V8.OsClient + ':FormData:sys_menu:' + String(legacyMenu.Id).toLowerCase());
                if (legacyMenu.ModuleEngineKey) {
                    V8.Cache.Remove('Microi:' + V8.OsClient + ':FormData:sys_menu:' + String(legacyMenu.ModuleEngineKey).toLowerCase());
                }
            } else {
                debugLog['migrate_microservice_menu_error_' + legacyMenu.Id] = (migrateResult && migrateResult.Msg) || '接口无返回';
            }
        }
    };
    for (var bindingIndex = 0; bindingIndex < applicationMenuBindings.length; bindingIndex++) {
        var binding = applicationMenuBindings[bindingIndex];
        migrateLegacyMenus(binding, 'Url', binding.LegacyMenuUrls);
        migrateLegacyMenus(binding, 'ComponentPath', binding.LegacyComponentPaths);
    }

    var step3ReferenceRowsUpdated = syncMappedReferences();
    if (step3ReferenceRowsUpdated > 0) {
        debugLog.step3ReferenceRowsUpdated = step3ReferenceRowsUpdated;
    }

    debugLog.step3Result = '菜单数据处理完成：新增' + stats.MenuInserted + '，修改' + stats.MenuUpdated
        + '，系统管理员权限新增' + stats.AdminRoleLimitInserted + '、补齐' + stats.AdminRoleLimitUpdated + '、已完整' + stats.AdminRoleLimitSkipped
        + '，迁移微服务旧菜单' + stats.MicroServiceMenus + '，保留现有原生菜单' + stats.MicroServiceMenusPreserved;

    // ==================== 步骤4：处理wf_flowdesign数据（可选） ====================

    if (Package.WfFlowDesigns && Package.WfFlowDesigns.length > 0) {
        reportProgress(80, '正在导入工作流设计');
        debugLog.step4 = '开始处理wf_flowdesign数据';

        var wfFlows = Package.WfFlowDesigns;

        for (var i = 0; i < wfFlows.length; i++) {
            var flow = wfFlows[i];

            if (!flow.Id) {
                debugLog['flow_no_id_' + i] = '跳过无Id的工作流数据';
                continue;
            }

            var exists = checkExists('wf_flowdesign', flow.Id);
            var modelCopy = {};
            for (var key in flow) {
                modelCopy[key] = flow[key];
            }
            modelCopy.OsClient = V8.OsClient;
            modelCopy.Id = flow.Id;
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('wf_flowdesign', modelCopy);
                if (uptResult.Code == 1) {
                    stats.FlowUpdated++;
                } else {
                    debugLog['flow_upt_error_' + flow.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_flowdesign', modelCopy);
                if (addResult.Code == 1) {
                    stats.FlowInserted++;
                } else {
                    debugLog['flow_add_error_' + flow.Id] = addResult.Msg;
                }
            }
        }

        debugLog.step4Result = '工作流数据处理完成：新增' + stats.FlowInserted + '，修改' + stats.FlowUpdated;
    }

    // ==================== 步骤5：处理wf_node数据（可选） ====================

    if (Package.WfNodes && Package.WfNodes.length > 0) {
        reportProgress(85, '正在导入工作流节点');
        debugLog.step5 = '开始处理wf_node数据';

        var wfNodes = Package.WfNodes;

        for (var i = 0; i < wfNodes.length; i++) {
            var node = wfNodes[i];

            if (!node.Id) {
                debugLog['node_no_id_' + i] = '跳过无Id的节点数据';
                continue;
            }

            var exists = checkExists('wf_node', node.Id);
            var modelCopy = {};
            for (var key in node) {
                modelCopy[key] = node[key];
            }
            modelCopy.OsClient = V8.OsClient;
            modelCopy.Id = node.Id;
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('wf_node', modelCopy);
                if (uptResult.Code == 1) {
                    stats.NodeUpdated++;
                } else {
                    debugLog['node_upt_error_' + node.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_node', modelCopy);
                if (addResult.Code == 1) {
                    stats.NodeInserted++;
                } else {
                    debugLog['node_add_error_' + node.Id] = addResult.Msg;
                }
            }
        }

        debugLog.step5Result = '节点数据处理完成：新增' + stats.NodeInserted + '，修改' + stats.NodeUpdated;
    }

    // ==================== 步骤6：处理wf_line数据（可选） ====================

    if (Package.WfLines && Package.WfLines.length > 0) {
        reportProgress(90, '正在导入工作流连线');
        debugLog.step6 = '开始处理wf_line数据';

        var wfLines = Package.WfLines;

        for (var i = 0; i < wfLines.length; i++) {
            var line = wfLines[i];

            if (!line.Id) {
                debugLog['line_no_id_' + i] = '跳过无Id的连线数据';
                continue;
            }

            var exists = checkExists('wf_line', line.Id);
            var modelCopy = {};
            for (var key in line) {
                modelCopy[key] = line[key];
            }
            modelCopy.OsClient = V8.OsClient;
            modelCopy.Id = line.Id;
            if (exists) {
                // 存在则修改
                var uptResult = V8.FormEngine.UptFormData('wf_line', modelCopy);
                if (uptResult.Code == 1) {
                    stats.LineUpdated++;
                } else {
                    debugLog['line_upt_error_' + line.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_line', modelCopy);
                if (addResult.Code == 1) {
                    stats.LineInserted++;
                } else {
                    debugLog['line_add_error_' + line.Id] = addResult.Msg;
                }
            }
        }

        debugLog.step6Result = '连线数据处理完成：新增' + stats.LineInserted + '，修改' + stats.LineUpdated;
    }

    function isMissingValue(value) {
        return typeof value === 'undefined' || value === null || value === '';
    }

    function normalizeApiEngineModel(model) {
        if (isMissingValue(model.IsEnable)) model.IsEnable = 1;
        if (isMissingValue(model.IsDeleted)) model.IsDeleted = 0;
        if (isMissingValue(model.StopHttp)) model.StopHttp = 0;
        if (isMissingValue(model.AllowAnonymous)) model.AllowAnonymous = 0;
        if (isMissingValue(model.Lock)) model.Lock = 0;
        if (isMissingValue(model.ResponseFile)) model.ResponseFile = 0;
        if (isMissingValue(model.EnableLog)) model.EnableLog = 0;
    }

    function removeApiEngineCacheValue(value) {
        if (isMissingValue(value)) return;
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(value).toLowerCase()}`);
    }

    function refreshApiEngineCache(apiEngineKey, apiEngineId, apiAddress) {
        removeApiEngineCacheValue(apiEngineKey);
        removeApiEngineCacheValue(apiEngineId);
        removeApiEngineCacheValue(apiAddress);

        var latest = null;
        if (!isMissingValue(apiEngineKey)) {
            var latestByKey = V8.FormEngine.GetFormData('sys_apiengine', {
                OsClient: V8.OsClient,
                _Where: [['ApiEngineKey', '=', apiEngineKey]],
                _PageSize: 1
            });
            if (latestByKey.Code == 1 && latestByKey.Data) {
                latest = latestByKey.Data;
            }
        }
        if (!latest && !isMissingValue(apiEngineId)) {
            var latestById = V8.FormEngine.GetFormData('sys_apiengine', {
                OsClient: V8.OsClient,
                Id: apiEngineId,
                _PageSize: 1
            });
            if (latestById.Code == 1 && latestById.Data) {
                latest = latestById.Data;
            }
        }
        if (!latest && !isMissingValue(apiAddress)) {
            var latestByAddress = V8.FormEngine.GetFormData('sys_apiengine', {
                OsClient: V8.OsClient,
                _Where: [['ApiAddress', '=', apiAddress]],
                _PageSize: 1
            });
            if (latestByAddress.Code == 1 && latestByAddress.Data) {
                latest = latestByAddress.Data;
            }
        }

        if (!latest) return null;
        normalizeApiEngineModel(latest);
        // IV8Cache.Set 的 value 参数是 string。直接传 Jint/.NET 对象会被转换成
        // "System..." 类型名，污染 v3 与 v6 共用的 sys_apiengine JSON 缓存。
        var latestCacheJson = JSON.stringify(latest);
        if (!isMissingValue(latest.ApiEngineKey)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.ApiEngineKey).toLowerCase()}`, latestCacheJson);
        }
        if (!isMissingValue(latest.Id)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.Id).toLowerCase()}`, latestCacheJson);
        }
        if (!isMissingValue(latest.ApiAddress)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.ApiAddress).toLowerCase()}`, latestCacheJson);
        }
        return latest;
    }

    function parseApiEngineVersion(model) {
        model = model || {};
        var versionText = firstText([model.Version, model.ApiVersion]);
        if (!versionText && model.ApiV8Code) {
            var codeMatch = String(model.ApiV8Code).match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
            if (codeMatch) versionText = codeMatch[1] + '.' + codeMatch[2] + '.' + codeMatch[3];
        }
        var match = String(versionText || '').match(/v?(\d+)\.(\d+)\.(\d+)/i);
        if (!match) return null;
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    }

    function compareApiEngineVersion(left, right) {
        if (!left && !right) return 0;
        if (left && !right) return 1;
        if (!left && right) return -1;
        for (var versionIndex = 0; versionIndex < 3; versionIndex++) {
            if (left[versionIndex] > right[versionIndex]) return 1;
            if (left[versionIndex] < right[versionIndex]) return -1;
        }
        return 0;
    }

    function apiEngineHash(code) {
        if (!V8.EncryptHelper || !V8.EncryptHelper.Sha256Hex) {
            throw new Error('接口引擎资源升级需要 V8.EncryptHelper.Sha256Hex');
        }
        return String(V8.EncryptHelper.Sha256Hex(String(code || ''))).toLowerCase();
    }

    var resourcePolicies = parseJsonObject(Package.ResourcePolicies, {});
    var apiEnginePolicies = parseJsonObject(resourcePolicies.ApiEngines, {});
    function getApiEngineResourcePolicy(apiEngineKey) {
        var key = String(apiEngineKey || '').toLowerCase();
        var source = apiEnginePolicies[key] || apiEnginePolicies[apiEngineKey] || null;
        if (!source) return { UpgradePolicy: 'LegacyOverwrite', Ownership: 'Application' };
        if (typeof source == 'string') source = { UpgradePolicy: source };
        var upgradePolicy = String(source.UpgradePolicy || source.Policy || 'Managed');
        if (upgradePolicy != 'Managed' && upgradePolicy != 'CreateIfMissing') {
            throw new Error('接口引擎资源策略不受支持：' + apiEngineKey + ' -> ' + upgradePolicy);
        }
        return {
            UpgradePolicy: upgradePolicy,
            Ownership: String(source.Ownership || (upgradePolicy == 'CreateIfMissing' ? 'Tenant' : 'Application')),
            BaseHash: String(source.BaseHash || '').toLowerCase()
        };
    }

    function findPreviousApiEngineState(apiEngineKey) {
        var key = String(apiEngineKey || '').toLowerCase();
        return previousApiEngineResourceState[key]
            || previousApiEngineResourceState[apiEngineKey]
            || null;
    }

    function recordApiEngineResourceState(apiEngine, policy) {
        if (!apiEngine || !apiEngine.ApiEngineKey || policy.UpgradePolicy == 'LegacyOverwrite') return;
        var key = String(apiEngine.ApiEngineKey).toLowerCase();
        nextApiEngineResourceState[key] = {
            ResourceType: 'ApiEngine',
            ResourceKey: String(apiEngine.ApiEngineKey),
            Ownership: policy.Ownership,
            UpgradePolicy: policy.UpgradePolicy,
            BaseHash: apiEngineHash(apiEngine.ApiV8Code),
            PackageVersion: firstText([
                Package.PackageInfo && Package.PackageInfo.Version,
                Package.PackageInfo && Package.PackageInfo.AppVersion,
                V8.Param.AppVersion
            ])
        };
    }

    // PACKAGE_API_ENGINE_READBACK_V1：菜单按钮与其依赖的接口引擎必须作为一个
    // 原子应用能力交付。接口引擎写入失败、被元数据静默忽略或回读内容不一致时，
    // 整个应用导入必须失败并回滚，禁止只留下一个运行时必然报“不存在”的按钮。
    function assertPersistedApiEngine(expected, latest) {
        var expectedKey = String((expected && expected.ApiEngineKey) || '').toLowerCase();
        var actualKey = String((latest && latest.ApiEngineKey) || '').toLowerCase();
        if (!latest || !expectedKey || actualKey !== expectedKey) {
            throw new Error('接口引擎写入后回读失败：' + (expectedKey || (expected && expected.Id) || '未知接口'));
        }
        if (Number(latest.IsDeleted || 0) === 1) {
            throw new Error('接口引擎写入后仍处于删除状态：' + expected.ApiEngineKey);
        }
        if (!isMissingValue(expected.IsEnable)
            && Number(latest.IsEnable || 0) !== Number(expected.IsEnable || 0)) {
            throw new Error('接口引擎写入后启用状态不一致：' + expected.ApiEngineKey);
        }
        if (!isMissingValue(expected.StopHttp)
            && Number(latest.StopHttp || 0) !== Number(expected.StopHttp || 0)) {
            throw new Error('接口引擎写入后HTTP状态不一致：' + expected.ApiEngineKey);
        }
        var expectedCode = String(expected.ApiV8Code || '');
        var actualCode = String(latest.ApiV8Code || '');
        if (expectedCode && actualCode !== expectedCode) {
            throw new Error('接口引擎写入后源码回读不一致：' + expected.ApiEngineKey);
        }
        if (expected.Id && String(latest.Id || '') !== String(expected.Id)) {
            throw new Error('接口引擎写入后Id回读不一致：' + expected.ApiEngineKey);
        }
    }

    // ==================== 步骤7：处理sys_apiengine数据（可选） ====================

    if (Package.SysApiEngines && Package.SysApiEngines.length > 0) {
        reportProgress(95, '正在导入接口引擎');
        debugLog.step7 = '开始处理sys_apiengine数据';

        var sysApiEngines = Package.SysApiEngines;

        for (var i = 0; i < sysApiEngines.length; i++) {
            var apiEngine = sysApiEngines[i];
            var apiEnginePolicy = getApiEngineResourcePolicy(apiEngine.ApiEngineKey);

            // 升级资源入口只在官方租户独立维护，禁止应用数据包覆盖或安装它。
            var apiEngineKeyLower = apiEngine.ApiEngineKey ? String(apiEngine.ApiEngineKey).toLowerCase() : '';
            if (apiEngineKeyLower === 'get-microi-upgrade-resource') {
                debugLog['apiengine_protected_' + i] = '跳过受保护接口引擎：' + apiEngine.ApiEngineKey;
                continue;
            }

            // 导入器可以由更高版本的应用商城升级，但禁止旧包或同版本包覆盖当前正在工作的导入器。
            // 这可避免应用商城安装成功后，又把刚修复的导入逻辑降级回包内旧代码。
            if (apiEngineKeyLower === 'import-microi-store-package') {
                var currentImporterResult = V8.FormEngine.GetFormData('sys_apiengine', {
                    OsClient: V8.OsClient,
                    _Where: [['ApiEngineKey', '=', apiEngine.ApiEngineKey]],
                    _PageSize: 1
                });
                if (currentImporterResult && currentImporterResult.Code == 1 && currentImporterResult.Data) {
                    var currentImporterVersion = parseApiEngineVersion(currentImporterResult.Data);
                    var packageImporterVersion = parseApiEngineVersion(apiEngine);
                    if (compareApiEngineVersion(currentImporterVersion, packageImporterVersion) >= 0) {
                        debugLog['apiengine_version_protected_' + i] =
                            '跳过导入器降级或同版本覆盖：current=' +
                            (currentImporterVersion ? currentImporterVersion.join('.') : 'unknown') +
                            ', package=' + (packageImporterVersion ? packageImporterVersion.join('.') : 'unknown');
                        continue;
                    }
                }
            }

            if (!apiEngine.Id && !apiEngine.ApiEngineKey) {
                debugLog['apiengine_no_id_key_' + i] = '跳过无Id和ApiEngineKey的接口引擎数据';
                continue;
            }

            // 根据Id或ApiEngineKey判断是否存在
            var existsById = false;
            var existsByKey = false;
            var existingId = null;
            var existingApiEngine = null;
            var existingApiEngineById = null;
            var existingApiEngineByKey = null;

            if (apiEngine.Id) {
                existsById = checkExists('sys_apiengine', apiEngine.Id);
                if (existsById) {
                    existingId = apiEngine.Id;
                    var existingByIdResult = V8.FormEngine.GetFormData('sys_apiengine', {
                        OsClient: V8.OsClient,
                        Id: apiEngine.Id,
                        _PageSize: 1
                    });
                    if (existingByIdResult && existingByIdResult.Code == 1) {
                        existingApiEngineById = existingByIdResult.Data;
                        existingApiEngine = existingApiEngineById;
                    }
                }
            }

            if (!existsById && apiEngine.ApiEngineKey) {
                var checkByKeyResult = V8.FormEngine.GetFormData('sys_apiengine', {
                    OsClient: V8.OsClient,
                    _Where: [['ApiEngineKey', '=', apiEngine.ApiEngineKey]],
                    _PageSize: 1
                });
                existsByKey = checkByKeyResult.Code == 1 && checkByKeyResult.Data;
                if (existsByKey) {
                    existingApiEngineByKey = checkByKeyResult.Data;
                    existingApiEngine = existingApiEngineByKey;
                    existingId = existingApiEngineByKey.Id;
                }
            }

            if (existsById && existingApiEngineById
                && String(existingApiEngineById.ApiEngineKey || '').toLowerCase() != apiEngineKeyLower) {
                throw new Error(
                    '接口引擎稳定Id冲突：' + apiEngine.Id + ' 已被 '
                    + String(existingApiEngineById.ApiEngineKey || 'unknown') + ' 占用，拒绝覆盖。'
                );
            }
            if (existsById && existsByKey
                && String(existingApiEngineById && existingApiEngineById.Id || '').toLowerCase()
                    != String(existingApiEngineByKey && existingApiEngineByKey.Id || '').toLowerCase()) {
                throw new Error(
                    '接口引擎稳定Key冲突：' + apiEngine.ApiEngineKey
                    + ' 与目标 Id 分别命中两条记录，拒绝自动合并。'
                );
            }

            var exists = existsById || existsByKey;
            if (exists && apiEnginePolicy.UpgradePolicy == 'CreateIfMissing') {
                stats.ApiEngineSkipped++;
                debugLog['apiengine_tenant_owned_skip_' + i] =
                    '保留租户接口引擎，不覆盖：' + apiEngine.ApiEngineKey;
                recordApiEngineResourceState(existingApiEngine || apiEngine, apiEnginePolicy);
                continue;
            }

            if (exists && apiEnginePolicy.UpgradePolicy == 'Managed') {
                var incomingHash = apiEngineHash(apiEngine.ApiV8Code);
                var localHash = apiEngineHash(existingApiEngine && existingApiEngine.ApiV8Code);
                var previousState = findPreviousApiEngineState(apiEngine.ApiEngineKey) || {};
                // TENANT_API_ENGINE_POLICY_IMMUTABLE_V1：一旦资源按 CreateIfMissing
                // 交给租户维护，后续版本不得悄悄改回 Managed 接管并覆盖代码。
                // 若确需变更所有权，必须发布新的 ApiEngineKey 并显式迁移。
                if (String(previousState.UpgradePolicy || '') == 'CreateIfMissing') {
                    throw new Error(
                        '接口引擎资源所有权冲突：' + apiEngine.ApiEngineKey
                        + ' 已归当前租户维护，应用更新不得改回 Managed。请发布新的受管接口 Key。'
                    );
                }
                var baseHash = String(previousState.BaseHash || apiEnginePolicy.BaseHash || '').toLowerCase();
                if (localHash != incomingHash && (!baseHash || localHash != baseHash)) {
                    throw new Error(
                        '接口引擎升级冲突：' + apiEngine.ApiEngineKey
                        + ' 已被当前租户修改，应用更新不会覆盖。请将本地改动迁移到租户扩展接口，'
                        + '或人工确认后恢复上游基线再重试。Base=' + (baseHash || 'none')
                        + '，Local=' + localHash + '，Incoming=' + incomingHash
                    );
                }
            }

            // 如果按Key命中但Id不同，仅在已经通过资源冲突检查后再对齐稳定Id。
            if (!existsById && existsByKey && apiEngine.Id) {
                var oldApiEngineId = existingApiEngine && existingApiEngine.Id;
                try {
                    V8.Db.FromSql('UPDATE sys_apiengine SET Id = @p0 WHERE ApiEngineKey = @p1 AND (IsDeleted<>1 OR IsDeleted IS NULL)')
                        .AddInParameter('@p0', apiEngine.Id)
                        .AddInParameter('@p1', apiEngine.ApiEngineKey)
                        .ExecuteNonQuery();
                } catch (idAlignmentError) { }

                // 清除旧Id、旧Key的缓存（Id已被替换，旧缓存失效）
                if (oldApiEngineId) V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(oldApiEngineId).toLowerCase()}`);
                if (existingApiEngine && existingApiEngine.ApiEngineKey) {
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(existingApiEngine.ApiEngineKey).toLowerCase()}`);
                }
                if (existingApiEngine && existingApiEngine.ApiAddress) {
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(existingApiEngine.ApiAddress).toLowerCase()}`);
                }
                existingId = apiEngine.Id;
            }

            var modelCopy = {};
            for (var key in apiEngine) {
                modelCopy[key] = apiEngine[key];
            }
            modelCopy.OsClient = V8.OsClient;
            modelCopy.Id = apiEngine.Id;
            normalizeApiEngineModel(modelCopy);
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('sys_apiengine', modelCopy);
                if (uptResult.Code == 1) {
                    stats.ApiEngineUpdated++;
                    var updatedEngine = refreshApiEngineCache(apiEngine.ApiEngineKey, apiEngine.Id, apiEngine.ApiAddress);
                    assertPersistedApiEngine(apiEngine, updatedEngine);
                    recordApiEngineResourceState(apiEngine, apiEnginePolicy);
                } else {
                    debugLog['apiengine_upt_error_' + existingId] = uptResult.Msg;
                    throw new Error('更新接口引擎失败：' + apiEngine.ApiEngineKey + '，' + (uptResult.Msg || '接口无返回'));
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('sys_apiengine', modelCopy);
                if (addResult.Code == 1) {
                    stats.ApiEngineInserted++;
                    var insertedEngine = refreshApiEngineCache(apiEngine.ApiEngineKey, apiEngine.Id, apiEngine.ApiAddress);
                    assertPersistedApiEngine(apiEngine, insertedEngine);
                    recordApiEngineResourceState(apiEngine, apiEnginePolicy);
                } else {
                    debugLog['apiengine_add_error_' + (apiEngine.Id || apiEngine.ApiEngineKey)] = addResult.Msg;
                    throw new Error('新增接口引擎失败：' + apiEngine.ApiEngineKey + '，' + (addResult.Msg || '接口无返回'));
                }
            }
        }

        debugLog.step7Result = '接口引擎数据处理完成：新增' + stats.ApiEngineInserted
            + '，修改' + stats.ApiEngineUpdated + '，保留租户扩展' + stats.ApiEngineSkipped;
    }

    // ==================== 步骤8：导入应用随包数据 ====================

    // DATASET_INSERT_IF_MISSING_V1：配置种子可声明 InsertIfMissing，并用
    // ConflictFields 做稳定业务键存在性检查。应用更新不得覆盖客户已经修改过的
    // 定时任务等配置；并发安装在 Add 失败后回读，已由其它节点插入则按幂等跳过。
    var packageDataSets = Package.DataSets || [];
    if (typeof packageDataSets == 'string') packageDataSets = JSON.parse(packageDataSets || '[]');
    var dataSets = [];
    if (packageDataSets && packageDataSets.length != null) {
        for (var dataSetCopyIndex = 0; dataSetCopyIndex < packageDataSets.length; dataSetCopyIndex++) {
            dataSets.push(packageDataSets[dataSetCopyIndex]);
        }
    }
    var protectedDataTables = {
        'diy_table': true, 'diy_field': true, 'sys_menu': true, 'sys_user': true,
        'sys_role': true, 'sys_rolelimit': true, 'sys_osclients': true,
        'sys_config': true, 'sys_apiengine': true, 'sys_token': true,
        'sys_userlogin': true, 'sys_microistore': true
    };
    var isSafeDataTableName = function (name) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ''));
    };
    var isMissingDataResult = function (result) {
        if (!result) return false;
        if (result.Code == 2) return true;
        return result.Code == 0 && String(result.Msg || '').indexOf('NoExistData') >= 0;
    };
    var normalizeDataConflictFields = function (dataSet, sourceRow, dataTableName, conflictPolicy) {
        if (conflictPolicy != 'InsertIfMissing') return ['Id'];
        var rawFields = dataSet.ConflictFields || ['Id'];
        if (typeof rawFields == 'string') {
            try { rawFields = JSON.parse(rawFields || '[]'); }
            catch (conflictFieldsError) {
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的 ConflictFields 不是有效JSON');
            }
        }
        var fields = [];
        var fieldMap = {};
        if (rawFields && rawFields.length != null) {
            for (var conflictFieldIndex = 0; conflictFieldIndex < rawFields.length; conflictFieldIndex++) {
                var conflictField = String(rawFields[conflictFieldIndex] || '');
                if (!isSafeDataTableName(conflictField)) {
                    throw new Error('应用数据导入失败：表 ' + dataTableName + ' 存在不合法的 ConflictFields 字段');
                }
                var conflictFieldKey = conflictField.toLowerCase();
                if (!fieldMap[conflictFieldKey]) {
                    fields.push(conflictField);
                    fieldMap[conflictFieldKey] = true;
                }
            }
        }
        if (fields.length == 0) fields.push('Id');
        if (fields.length > 5) {
            throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的 ConflictFields 最多5个字段');
        }
        for (var validateConflictIndex = 0; validateConflictIndex < fields.length; validateConflictIndex++) {
            var validateConflictField = fields[validateConflictIndex];
            if (validateConflictField == 'Id') continue;
            if (!Object.prototype.hasOwnProperty.call(sourceRow, validateConflictField)) {
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的冲突字段缺少值：' + validateConflictField);
            }
            var conflictValue = sourceRow[validateConflictField];
            var conflictValueType = typeof conflictValue;
            if (conflictValue === null || conflictValue === undefined || String(conflictValue).trim() === ''
                || (conflictValueType != 'string' && conflictValueType != 'number' && conflictValueType != 'boolean')
                || String(conflictValue).length > 500) {
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的冲突字段值不安全：' + validateConflictField);
            }
        }
        return fields;
    };
    var findExistingPackageData = function (dataTableName, sourceRow, conflictPolicy, conflictFields) {
        var existingById = V8.FormEngine.GetFormData(dataTableName, { Id: String(sourceRow.Id) });
        if (existingById && existingById.Code == 1 && existingById.Data) {
            return { Exists: true, Match: 'Id', Result: existingById };
        }
        if (!isMissingDataResult(existingById)) {
            throw new Error('应用数据导入失败：读取表 ' + dataTableName + ' 的既有 Id 失败，'
                + ((existingById && existingById.Msg) || '接口无返回'));
        }
        if (conflictPolicy != 'InsertIfMissing') return { Exists: false, Match: '', Result: existingById };

        var conflictWhere = [];
        for (var conflictWhereIndex = 0; conflictWhereIndex < conflictFields.length; conflictWhereIndex++) {
            var conflictWhereField = conflictFields[conflictWhereIndex];
            if (conflictWhereField == 'Id') continue;
            conflictWhere.push([conflictWhereField, '=', sourceRow[conflictWhereField]]);
        }
        if (conflictWhere.length == 0) return { Exists: false, Match: '', Result: existingById };
        var existingByConflict = V8.FormEngine.GetFormData(dataTableName, {
            _Where: conflictWhere,
            _SelectFields: ['Id'],
            _PageSize: 1
        });
        if (existingByConflict && existingByConflict.Code == 1 && existingByConflict.Data) {
            return { Exists: true, Match: conflictFields.join(','), Result: existingByConflict };
        }
        if (!isMissingDataResult(existingByConflict)) {
            throw new Error('应用数据导入失败：读取表 ' + dataTableName + ' 的业务冲突键失败，'
                + ((existingByConflict && existingByConflict.Msg) || '接口无返回'));
        }
        return { Exists: false, Match: '', Result: existingByConflict };
    };
    var protectedDataRowFields = {
        osclient: true,
        createtime: true,
        updatetime: true,
        userid: true,
        username: true,
        createuserid: true,
        updateuserid: true,
        createuser: true,
        updateuser: true
    };

    if (dataSets.length > 0) {
        reportProgress(96, '正在导入应用随包数据');
    }
    for (var dataSetIndex = 0; dataSetIndex < dataSets.length; dataSetIndex++) {
        var dataSet = dataSets[dataSetIndex] || {};
        var dataTableName = String(dataSet.TableName || '');
        var lowerDataTableName = dataTableName.toLowerCase();
        if (!isSafeDataTableName(dataTableName) || protectedDataTables[lowerDataTableName] || lowerDataTableName.indexOf('wf_') == 0) {
            throw new Error('应用数据导入被拒绝：表 ' + dataTableName + ' 不允许写入');
        }
        var conflictPolicy = String(dataSet.ConflictPolicy || 'UpsertById');
        if (conflictPolicy != 'UpsertById' && conflictPolicy != 'InsertIfMissing') {
            throw new Error('应用数据导入失败：表 ' + dataTableName + ' 仅支持 UpsertById 或 InsertIfMissing 冲突策略');
        }

        var tableDefinitionResult = V8.FormEngine.GetFormData('diy_table', {
            _Where: [['Name', '=', dataTableName]],
            _SelectFields: ['Id', 'Name']
        });
        if (!tableDefinitionResult || tableDefinitionResult.Code != 1 || !tableDefinitionResult.Data) {
            throw new Error('应用数据导入失败：目标表 ' + dataTableName + ' 尚未创建');
        }

        var sourceRows = [];
        var packageRows = dataSet.Rows || [];
        if (packageRows && packageRows.length != null) {
            for (var packageRowIndex = 0; packageRowIndex < packageRows.length; packageRowIndex++) {
                sourceRows.push(packageRows[packageRowIndex]);
            }
        }
        if (sourceRows.length > 5000) {
            throw new Error('应用数据导入失败：表 ' + dataTableName + ' 单个数据集超过5000条限制');
        }

        for (var dataRowIndex = 0; dataRowIndex < sourceRows.length; dataRowIndex++) {
            var sourceRow = sourceRows[dataRowIndex] || {};
            if (!sourceRow.Id) {
                stats.DataSkipped++;
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 第' + (dataRowIndex + 1) + '条数据缺少Id');
            }
            var conflictFields = normalizeDataConflictFields(dataSet, sourceRow, dataTableName, conflictPolicy);
            var existingData = findExistingPackageData(dataTableName, sourceRow, conflictPolicy, conflictFields);
            if (conflictPolicy == 'InsertIfMissing' && existingData.Exists) {
                stats.DataSkipped++;
                debugLog['data_insert_if_missing_skip_' + dataTableName + '_' + dataRowIndex]
                    = '已存在，匹配字段：' + existingData.Match;
                continue;
            }
            var targetRow = {};
            for (var dataFieldName in sourceRow) {
                if (!Object.prototype.hasOwnProperty.call(sourceRow, dataFieldName)) continue;
                if (protectedDataRowFields[String(dataFieldName).toLowerCase()]
                    || dataFieldName.indexOf('_Raw') == 0 || dataFieldName.charAt(0) == '_') continue;
                targetRow[dataFieldName] = sourceRow[dataFieldName];
            }
            targetRow.Id = String(sourceRow.Id);
            targetRow.OsClient = V8.OsClient;

            var writeDataResult;
            if (existingData.Exists) {
                writeDataResult = V8.FormEngine.UptFormData(dataTableName, targetRow);
                if (writeDataResult && writeDataResult.Code == 1) stats.DataUpdated++;
            } else {
                writeDataResult = V8.FormEngine.AddFormData(dataTableName, targetRow);
                if (writeDataResult && writeDataResult.Code == 1) stats.DataInserted++;
                if ((!writeDataResult || writeDataResult.Code != 1) && conflictPolicy == 'InsertIfMissing') {
                    var concurrentData = findExistingPackageData(dataTableName, sourceRow, conflictPolicy, conflictFields);
                    if (concurrentData.Exists) {
                        stats.DataSkipped++;
                        debugLog['data_insert_if_missing_race_' + dataTableName + '_' + dataRowIndex]
                            = '并发节点已插入，匹配字段：' + concurrentData.Match;
                        continue;
                    }
                }
            }
            if (!writeDataResult || writeDataResult.Code != 1) {
                throw new Error('应用数据导入失败：表 ' + dataTableName + '，Id=' + targetRow.Id + '，' + ((writeDataResult && writeDataResult.Msg) || '未知错误'));
            }
        }
        stats.DataSetCount++;
    }
    debugLog.step8Result = '随包数据处理完成：数据集' + stats.DataSetCount + '，新增' + stats.DataInserted + '，修改' + stats.DataUpdated;

    if (backgroundChunkingEnabled
        && backgroundCheckpointPhase == 'PostSchema'
        && scheduleJobContract.Jobs.length > 0) {
        assertSchemaChunkSucceeded('任务前置资源');
        return buildSchemaContinuation(
            'ScheduleJobs',
            0,
            97,
            '表、菜单、引擎和随包数据已提交，将在独立执行片中幂等安装定时任务'
        );
    }

    var hasInstallErrorsBeforeVersion = false;
    for (var debugKeyBeforeVersion in debugLog) {
        if (debugKeyBeforeVersion.indexOf('_error_') > -1) {
            hasInstallErrorsBeforeVersion = true;
            break;
        }
    }
    if (hasInstallErrorsBeforeVersion) {
        debugLog.version_record_skipped = '本次导入存在异常，不写入成功安装版本，修复后可安全重试';
        reportProgress(97, '检测到导入异常，已跳过成功版本记录');
    } else {
        reportProgress(97, '正在写入应用安装版本记录');
        upsertMicroiStoreVersionRecord();
    }

    debugLog.endTime = new Date().toISOString();

    // ==================== 构建中文执行日志 ====================

    var errors = [];
    for (var key in debugLog) {
        if (key.indexOf('_error_') > -1) {
            errors.push({ 标识: key, 详情: debugLog[key] });
        }
    }

    var urlRetries = [];
    for (var key in debugLog) {
        if (key.indexOf('_url_retry_') > -1) {
            urlRetries.push(debugLog[key]);
        }
    }

    var pkgInfo = Package.PackageInfo || {};
    var startTime = debugLog.startTime || '';
    var endTime = debugLog.endTime || '';

    var resultData = {
        应用包信息: {
            名称: pkgInfo.Name || '未命名',
            版本: pkgInfo.Version || '',
            来源租户: pkgInfo.OsClient || '',
            创建人: pkgInfo.CreateUser || '',
            创建时间: pkgInfo.CreateTime || '',
            导入开始: startTime,
            导入结束: endTime
        },
        执行概览: {
            DDL建表: '执行' + (stats.DDLExecuted || 0) + '条，跳过' + (stats.DDLSkipped || 0) + '条，补充物理字段' + (stats.FieldsAdded || 0) + '个',
            表结构: '新增' + stats.TableInserted + '条，修改' + stats.TableUpdated + '条，Id对齐' + stats.TableIdRemapped + '条',
            字段定义: '新增' + stats.FieldInserted + '条，修改' + stats.FieldUpdated + '条，幂等跳过' + (stats.FieldSkipped || 0) + '条，Id对齐' + stats.FieldIdRemapped + '条',
            物理字段同步: '重命名' + (stats.PhysicalFieldsRenamed || 0) + '个，修改' + (stats.PhysicalFieldsModified || 0) + '个，新增' + (stats.PhysicalFieldsAdded || 0) + '个',
            菜单: '新增' + stats.MenuInserted + '条，修改' + stats.MenuUpdated + '条，Id对齐' + stats.MenuIdRemapped + '条',
            系统管理员菜单权限: '新增' + stats.AdminRoleLimitInserted + '条，补齐' + stats.AdminRoleLimitUpdated + '条，已完整' + stats.AdminRoleLimitSkipped + '条',
            引用修复: '更新' + stats.ReferenceRowsUpdated + '行',
            工作流: '新增' + stats.FlowInserted + '条，修改' + stats.FlowUpdated + '条',
            工作流节点: '新增' + stats.NodeInserted + '条，修改' + stats.NodeUpdated + '条',
            工作流连线: '新增' + stats.LineInserted + '条，修改' + stats.LineUpdated + '条',
            接口引擎: '新增' + stats.ApiEngineInserted + '条，修改' + stats.ApiEngineUpdated
                + '条，保留租户扩展' + stats.ApiEngineSkipped + '条',
            选择数据: '数据集' + stats.DataSetCount + '个，新增' + stats.DataInserted + '条，修改' + stats.DataUpdated + '条，跳过' + stats.DataSkipped + '条',
            定时任务: '保存' + stats.ScheduleJobSaved + '个',
            在线应用: '安装' + stats.ApplicationInstalled + '个，私有源码新增' + stats.ApplicationSourceFiles + '个/复用' + stats.ApplicationSourceFilesReused + '个，公有编译文件新增' + stats.ApplicationBuildAssets + '个/复用' + stats.ApplicationBuildAssetsReused + '个，清理旧文件元数据' + stats.AssetRowsPruned + '个，微服务页面' + stats.MicroServicePages + '个，迁移旧菜单' + stats.MicroServiceMenus + '个，保留原生菜单' + stats.MicroServiceMenusPreserved + '个',
            应用安装版本: '写入' + (stats.VersionRecordUpdated || 0) + '条'
        }
    };

    if (urlRetries.length > 0) {
        resultData['菜单Url自动重命名'] = urlRetries;
    }

    if (errors.length > 0) {
        resultData['失败详情（共' + errors.length + '条）'] = errors;
    }

    // ==================== 返回结果 ====================
    // 注意：平台会根据返回Code自动管理事务
    // Code=1 时自动提交事务，Code=0 时自动回滚事务

    var hasErrors = errors.length > 0;
    reportProgress(98, hasErrors ? '导入完成，正在整理异常详情' : '导入完成，正在返回结果');
    return {
        Code: hasErrors ? 0 : 1,
        Data: resultData,
        Msg: hasErrors ? '导入失败，共' + errors.length + '条异常；事务已回滚，请查看失败详情' : '导入成功'
    };

} catch (error) {
    // ==================== 异常处理 ====================
    // 注意：返回Code=0时，平台会自动回滚事务

    return {
        Code: 0,
        Msg: '导入失败：' + error.message,
        Data: {
            错误信息: error.message,
            错误堆栈: error.stack
        }
    };
}
