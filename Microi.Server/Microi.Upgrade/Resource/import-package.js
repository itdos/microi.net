/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：import-microi-store-package
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: import-microi-store-package
 * Version: v2.9.4
 * Function:
 * - 统一应用商城导入器；支持可信包读取、断点续装、菜单与管理员权限安装、在线应用资产迁移、数据库内联运行时，以及安装后资源和字节完整性强回读。
 */

// INSTALLED_RUNTIME_SUMMARY_V1：入口按目标租户改写后，以实际安装资产的哈希和大小
// 生成本租户运行摘要；禁止沿用发布方摘要或已有微服务的旧 DistHash。
function summarizeInstalledRuntimeAssets(assets) {
    if (!assets || !assets.length || assets.length > 256) throw new Error('数据库运行包资产数量无效');
    var rows = [], seen = {}, total = 0;
    for (var i = 0; i < assets.length; i++) {
        var asset = assets[i] || {}, path = String(asset.Path || '').replace(/\\/g, '/');
        var hash = String(asset.Hash || '').toLowerCase(), size = Number(asset.Size);
        var identity = '$' + path.toLowerCase();
        if (!path || seen[identity] || !/^[a-f0-9]{64}$/.test(hash)
            || !isFinite(size) || size <= 0 || Math.floor(size) !== size) {
            throw new Error('数据库运行包路径、摘要或大小无效：' + path);
        }
        seen[identity] = true;total += size;
        rows.push({ Path: path, Fingerprint: path + '\t' + hash + '\t' + size });
    }
    if (total > 5 * 1024 * 1024) throw new Error('数据库运行包实际字节超过 5MB');
    rows.sort(function(a, b) { return a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0; });
    var lines = [];for (var j = 0; j < rows.length; j++) lines.push(rows[j].Fingerprint);
    return { DistHash: String(V8.EncryptHelper.Sha256Hex(lines.join('\n'))).toLowerCase(), TotalSize: total };
}

// PACKAGE_LAYOUT_FIELD_RETIREMENTS_V1：显式退役包拥有的旧布局入口，仅软删元数据，
// 保留物理列和全部业务数据；按目标表名/字段名定位，不依赖发布方 Id。
// 先校验整个声明和目标组件配置，避免把同名客户组件或核心字段当作废弃入口。
function retirePackageLayoutFields(packageModel, formEngine, cache, osClient) {
    var declarations = packageModel.DiyFieldRetirements || [];
    if (!declarations || declarations.length === undefined || declarations.length > 100)
        throw new Error('DiyFieldRetirements 必须是最多 100 项的数组');
    var tables = packageModel.DiyTables || [], fields = packageModel.DiyFields || [];
    var allowed = { DevComponent: true, Divider: true, Tabs: true, CollapseGroup: true };
    var reserved = { id: true, createtime: true, updatetime: true, userid: true, username: true, isdeleted: true, osclient: true };
    var plans = [], seen = {};
    for (var i = 0; i < declarations.length; i++) {
        var item = declarations[i] || {}, tableName = String(item.TableName || ''), name = String(item.Name || '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
            || reserved[name.toLowerCase()] || !allowed[item.ExpectedComponent])
            throw new Error('仅允许退役明确声明的非系统布局字段');
        var sourceTable = null;
        for (var ti = 0; ti < tables.length; ti++)
            if (String(tables[ti].Name || '').toLowerCase() == tableName.toLowerCase()) sourceTable = tables[ti];
        if (!sourceTable) throw new Error('退役字段的表必须由当前包声明：' + tableName);
        for (var fi = 0; fi < fields.length; fi++)
            if (String(fields[fi].Name || '').toLowerCase() == name.toLowerCase()
                && (String(fields[fi].TableId || '').toLowerCase() == String(sourceTable.Id || '').toLowerCase()
                    || String(fields[fi].TableName || '').toLowerCase() == tableName.toLowerCase()))
                throw new Error('同一字段不能同时声明安装与退役：' + tableName + '.' + name);
        var identity = tableName.toLowerCase() + '.' + name.toLowerCase();
        if (seen[identity]) continue;
        seen[identity] = true;
        var table = formEngine.GetFormData('diy_table', { _Where: [['Name', '=', tableName]], _SelectFields: ['Id', 'Name'] });
        if (!table || Number(table.Code) != 1 || !table.Data || !table.Data.Id)
            throw new Error('无法读取退役字段所属表：' + tableName);
        var query = { _Where: [['TableId', '=', table.Data.Id], ['Name', '=', name]],
            _SelectFields: ['Id', 'TableId', 'Name', 'Component', 'Config', 'IsDeleted'] };
        var found = formEngine.GetFormData('diy_field', query);
        if (found && (Number(found.Code) == 2 || (Number(found.Code) == 1 && found.Data && Number(found.Data.IsDeleted) == 1))) continue;
        if (!found || Number(found.Code) != 1 || !found.Data || !found.Data.Id)
            throw new Error('读取旧布局字段失败：' + identity);
        if (String(found.Data.Component || '') != String(item.ExpectedComponent))
            throw new Error('旧字段组件已变更，不能自动退役：' + identity);
        var expected = item.ExpectedConfig || {}, actual = found.Data.Config || {};
        if (typeof actual == 'string') {
            try { actual = JSON.parse(actual || '{}'); }
            catch (_) { throw new Error('旧字段配置无效：' + identity); }
        }
        for (var configKey in expected)
            if (Object.prototype.hasOwnProperty.call(expected, configKey) && actual[configKey] !== expected[configKey])
                throw new Error('旧字段配置已变更，不能自动退役：' + identity);
        plans.push({ Id: found.Data.Id, TableId: table.Data.Id, TableName: tableName, Query: query });
    }
    for (var pi = 0; pi < plans.length; pi++) {
        var plan = plans[pi], result = formEngine.DelFormData('diy_field', { Id: plan.Id });
        var readback = formEngine.GetFormData('diy_field', plan.Query);
        var missing = readback && (Number(readback.Code) == 2
            || (Number(readback.Code) == 1 && readback.Data && Number(readback.Data.IsDeleted) == 1));
        if (!missing || !result || (Number(result.Code) != 1 && Number(result.Code) != 2))
            throw new Error('旧布局字段退役回读失败：' + plan.TableName + '，' + String(result && result.Msg || ''));
        cache.Remove('Microi:' + osClient + ':FormData:diy_field:' + String(plan.Id).toLowerCase());
        cache.Remove('Microi:' + osClient + ':FormData:diy_table_field_list:' + plan.TableId);
        cache.Remove('Microi:' + osClient + ':FormData:diy_table_field_list:' + String(plan.TableId).toLowerCase());
        cache.Remove('Microi:' + osClient + ':FormData:diy_table_field_list:' + plan.TableName.toLowerCase());
    }
    return { Retired: plans.length };
}

// ==================== 参数接收与校验 ====================

var Package = V8.Param.Package;  // 应用数据包
// SQLSERVER_PHYSICAL_SCHEMA_DIALECT_V1：官方应用包继续保存 MySQL 逻辑类型，
// 导入时按目标租户实际数据库方言生成物理 DDL，禁止 mediumtext/COLUMN_TYPE 等
// MySQL 专有语法进入 SQL Server。
var runtimeDatabaseType = String(
    V8.OsClientModel && (V8.OsClientModel.DbType || V8.OsClientModel.OsClientDbType) || 'MySql'
).toLowerCase();
var runtimeIsSqlServer = runtimeDatabaseType.indexOf('sqlserver') >= 0
    || runtimeDatabaseType.indexOf('mssql') >= 0;
var runtimeIsOracle = runtimeDatabaseType.indexOf('oracle') >= 0;
var quotePhysicalIdentifier = function (name) {
    var value = String(name || '');
    if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('不安全的数据库标识符：' + value);
    if (runtimeIsSqlServer) return '[' + value + ']';
    if (runtimeIsOracle) return '"' + value + '"';
    return '`' + value + '`';
};
var InstallParentSysMenuId = V8.Param.InstallParentSysMenuId;  // 安装在哪个父级系统菜单Id下
var InstallParentSysMenuName = V8.Param.InstallParentSysMenuName;  // 安装时原子创建的新目录名称
var InstallParentCreateUnderSysMenuId = V8.Param.InstallParentCreateUnderSysMenuId;  // 新目录创建在哪个现有菜单下
var startupDependencyBootstrapOnlyRequested = V8.Param.StartupDependencyBootstrapOnly === true
    || String(V8.Param.StartupDependencyBootstrapOnly || '').toLowerCase() == 'true';

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

// GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1：部分历史空库包遗漏了 DiyTable
// GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_BATCH_V1：MySQL 同一张表缺少多个固定前置列时，
// 必须合并为一次 ALTER TABLE，避免旧租户逐列重建元数据表并在首个检查点前耗尽
// 单片超时。SQL Server / Oracle 保留经过验证的逐列兼容路径。
// GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_CHECKPOINT_V1：可信后台任务每个执行片最多
// 修改一张前置元数据表，提交 Prerequisites 检查点后再继续；没有缺列时直接进入
// 原 DDL 阶段，不为现代租户制造空分片。
// 生成实体已经投影的物理列。FormEngine 在读取任意字段元数据前会先物化整条
// diy_table，旧库因此把真实 Unknown column 包装成 Enumerable.Where 的 source
// 为空。导入器在第一次 FormEngine 调用前只补固定平台列；新版后端启动升级仍是
// 主路径，这里为尚未正确跑过物理前置迁移的客户节点提供幂等自愈。
function ensureGeneratedEntityPhysicalPrerequisites(maxChangedTables) {
    var dbType = String(
        V8.OsClientModel && (V8.OsClientModel.DbType || V8.OsClientModel.OsClientDbType) || 'MySql'
    ).toLowerCase();
    var isSqlServer = dbType.indexOf('sqlserver') >= 0 || dbType.indexOf('mssql') >= 0;
    var isOracle = dbType.indexOf('oracle') >= 0;
    var quoteOpen = isSqlServer ? '[' : (isOracle ? '"' : '`');
    var quoteClose = isSqlServer ? ']' : (isOracle ? '"' : '`');
    var added = [];
    maxChangedTables = parseInt(maxChangedTables || 999, 10);
    if (isNaN(maxChangedTables) || maxChangedTables < 1) maxChangedTables = 1;

    function textType(length) {
        if (isOracle) return 'VARCHAR2(' + length + ')';
        return 'varchar(' + length + ')';
    }
    function intType() {
        return isOracle ? 'NUMBER(10)' : 'int';
    }
    function largeTextType() {
        if (isOracle) return 'CLOB';
        if (isSqlServer) return 'nvarchar(max)';
        return 'mediumtext';
    }
    function readColumns(tableName) {
        var sql;
        if (isOracle) {
            sql = 'SELECT COLUMN_NAME AS "ColumnName" FROM USER_TAB_COLUMNS WHERE TABLE_NAME=UPPER(@p0)';
        } else if (isSqlServer) {
            sql = 'SELECT COLUMN_NAME AS ColumnName FROM INFORMATION_SCHEMA.COLUMNS '
                + 'WHERE TABLE_CATALOG=DB_NAME() AND LOWER(TABLE_NAME)=LOWER(@p0)';
        } else {
            sql = 'SELECT COLUMN_NAME AS ColumnName FROM INFORMATION_SCHEMA.COLUMNS '
                + 'WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(@p0)';
        }
        var rows = V8.Db.FromSql(sql).AddInParameter('@p0', tableName).ToArray();
        var map = {};
        if (!rows || rows.length === undefined) return map;
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            var row = rows[rowIndex] || {};
            var name = String(row.ColumnName || row.COLUMN_NAME || row.column_name || '').toLowerCase();
            if (name) map[name] = true;
        }
        return map;
    }
    function ensureTableColumns(tableName, definitions, allowWrite, createInPackageDdl) {
        var existing = readColumns(tableName);
        // ABSENT_PACKAGE_TABLE_DEFER_DDL_V1: first-time installations do not yet
        // have sys_microistore. Its owning package creates it in the DDL phase;
        // ALTER before CREATE would abort every legacy tenant without a store.
        if (createInPackageDdl && Object.keys(existing).length == 0)
            return { Missing: 0, Written: false };
        var pendingDefinitions = [];
        for (var definitionIndex = 0; definitionIndex < definitions.length; definitionIndex++) {
            var definition = definitions[definitionIndex];
            var columnName = String(definition[0]);
            if (existing[columnName.toLowerCase()]) continue;
            pendingDefinitions.push(definition);
        }
        if (pendingDefinitions.length == 0) return { Missing: 0, Written: false };
        if (!allowWrite) return { Missing: pendingDefinitions.length, Written: false };

        if (!isSqlServer && !isOracle) {
            var batchAlterParts = [];
            for (var batchIndex = 0; batchIndex < pendingDefinitions.length; batchIndex++) {
                var batchDefinition = pendingDefinitions[batchIndex];
                batchAlterParts.push(
                    'ADD ' + quoteOpen + String(batchDefinition[0]) + quoteClose
                    + ' ' + batchDefinition[1] + ' NULL'
                );
            }
            var batchAlterSql = 'ALTER TABLE ' + quoteOpen + tableName + quoteClose
                + ' ' + batchAlterParts.join(', ');
            try {
                V8.Db.FromSql(batchAlterSql).ExecuteNonQuery();
            } catch (batchAddColumnError) {
                var batchReadback = readColumns(tableName);
                var unresolvedColumns = [];
                for (var unresolvedIndex = 0; unresolvedIndex < pendingDefinitions.length; unresolvedIndex++) {
                    var unresolvedName = String(pendingDefinitions[unresolvedIndex][0]);
                    if (!batchReadback[unresolvedName.toLowerCase()]) unresolvedColumns.push(unresolvedName);
                }
                if (unresolvedColumns.length > 0) {
                    throw new Error(
                        '批量补齐平台运行时物理列失败：' + tableName + '.' + unresolvedColumns.join(',') + '；'
                        + (batchAddColumnError && batchAddColumnError.message
                            ? batchAddColumnError.message
                            : String(batchAddColumnError))
                    );
                }
            }
            for (var committedIndex = 0; committedIndex < pendingDefinitions.length; committedIndex++) {
                var committedName = String(pendingDefinitions[committedIndex][0]);
                existing[committedName.toLowerCase()] = true;
                added.push(tableName + '.' + committedName);
            }
            return { Missing: pendingDefinitions.length, Written: true };
        }

        for (var pendingIndex = 0; pendingIndex < pendingDefinitions.length; pendingIndex++) {
            var pendingDefinition = pendingDefinitions[pendingIndex];
            var columnName = String(pendingDefinition[0]);
            var alterSql = 'ALTER TABLE ' + quoteOpen + tableName + quoteClose
                + ' ADD ' + quoteOpen + columnName + quoteClose + ' ' + pendingDefinition[1] + ' NULL';
            try {
                V8.Db.FromSql(alterSql).ExecuteNonQuery();
            } catch (addColumnError) {
                // 多节点可能同时首次自愈。仅当并发节点已经把同一列补齐时吞掉重复列；
                // 权限、连接或其它 DDL 异常继续带真实表/列原因失败关闭。
                if (!readColumns(tableName)[columnName.toLowerCase()]) {
                    throw new Error(
                        '补齐平台运行时物理列失败：' + tableName + '.' + columnName + '；'
                        + (addColumnError && addColumnError.message ? addColumnError.message : String(addColumnError))
                    );
                }
            }
            existing[columnName.toLowerCase()] = true;
            added.push(tableName + '.' + columnName);
        }
        return { Missing: pendingDefinitions.length, Written: true };
    }

    var prerequisiteTables = [
        {
            TableName: 'sys_apiengine',
            Definitions: [
                ['StopHttp', intType()], ['Timeout', intType()], ['MaxStatements', intType()],
                ['LimitMemory', intType()], ['LimitRecursion', intType()], ['V8Limit', intType()],
                ['V8Unlimited', intType()], ['Lock', intType()]
            ]
        },
        {
            TableName: 'diy_table',
            Definitions: [
                ['OsClient', textType(255)], ['TableInEdit', intType()],
                ['AddCallbakApi', textType(500)], ['UptCallbakApi', textType(500)],
                ['DelCallbakApi', textType(500)], ['V8Limit', intType()], ['V8Unlimited', intType()],
                ['FormPresentation', largeTextType()], ['FormPresentationMode', textType(50)],
                ['FormPresentationDensity', textType(50)], ['FormNavigationTitle', textType(255)],
                ['FormNavigationCountText', textType(255)], ['FormSectionNavigation', textType(50)],
                ['FormSectionEyebrow', textType(255)], ['FormRequiredCountText', textType(255)],
                ['FormWorkbenchEyebrow', textType(255)], ['FormWorkbenchDescription', largeTextType()],
                ['FormNavigationFooterTitle', textType(255)], ['FormNavigationFooterHtml', largeTextType()],
                ['FormRecordSelectorPlaceholder', textType(255)], ['FormRecordSelectorLabelFields', largeTextType()],
                ['FormBannerEnabled', intType()], ['FormBannerTitleField', textType(100)],
                ['FormBannerSubtitleField', textType(100)], ['FormBannerImageField', textType(100)],
                ['FormBannerIcon', textType(100)], ['FormBannerBackgroundField', textType(100)],
                ['FormBannerTagFields', largeTextType()], ['FormBannerMetrics', largeTextType()]
            ]
        },
        {
            // 早期租户已经存在 diy_field，但尚无 OsClient。字段导入阶段需要先
            // 物理读取并恢复软删除/主键冲突记录；若等到后续 PhysicalColumns
            // 阶段才补列，会先在 SELECT ... OsClient 处失败。
            TableName: 'diy_field',
            Definitions: [
                ['OsClient', textType(255)]
            ]
        },
        {
            // MARKETPLACE_HDFS_PACKAGE_POINTER_SCHEMA_V1：商城包安装前一次性补齐
            // 内容指针列；MySQL 会合并为单条 ALTER，避免大表逐列重建八次。
            TableName: 'sys_microistore',
            CreateInPackageDdl: true,
            Definitions: [
                ['PackageId', textType(50)], ['PackageStorageMode', textType(50)],
                ['PackageHdfsPath', textType(2000)], ['PackageSha256', textType(100)],
                ['PackageSize', isOracle ? 'NUMBER(19)' : 'bigint'],
                ['PackageContentType', textType(100)], ['PackageFormatVersion', intType()],
                ['PackageUploadedAt', textType(25)]
            ]
        }
    ];
    var changedTableCount = 0;
    var remainingTableCount = 0;
    for (var prerequisiteIndex = 0; prerequisiteIndex < prerequisiteTables.length; prerequisiteIndex++) {
        var prerequisiteTable = prerequisiteTables[prerequisiteIndex];
        var prerequisiteResult = ensureTableColumns(
            prerequisiteTable.TableName,
            prerequisiteTable.Definitions,
            changedTableCount < maxChangedTables,
            prerequisiteTable.CreateInPackageDdl === true
        );
        if (prerequisiteResult.Missing < 1) continue;
        if (prerequisiteResult.Written) changedTableCount++;
        else remainingTableCount++;
    }
    return {
        Added: added,
        ChangedTableCount: changedTableCount,
        RemainingTableCount: remainingTableCount
    };
}

var physicalBootstrapTaskId = V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId || '';
var physicalBootstrapEnvelope = V8.Param._BackgroundTask || {};
var physicalBootstrapChunkingEnabled = !!physicalBootstrapTaskId && (
    V8.Param._TrustedServerInvocation === true
    || String(V8.Param._TrustedServerInvocation || '').toLowerCase() == 'true'
    || (String(physicalBootstrapEnvelope.Id || '') == String(physicalBootstrapTaskId)
        && V8.Param._BackgroundTaskFencingToken !== null
        && V8.Param._BackgroundTaskFencingToken !== undefined)
);
var physicalBootstrapCheckpoint = V8.Param._BackgroundTaskCheckpoint || {};
if (typeof physicalBootstrapCheckpoint == 'string') {
    try { physicalBootstrapCheckpoint = JSON.parse(physicalBootstrapCheckpoint); }
    catch (physicalBootstrapCheckpointError) { physicalBootstrapCheckpoint = {}; }
}
if (physicalBootstrapCheckpoint.TaskId
    && String(physicalBootstrapCheckpoint.TaskId) != String(physicalBootstrapTaskId || '')) {
    physicalBootstrapCheckpoint = {};
}
var physicalBootstrapPhase = String(physicalBootstrapCheckpoint.Phase || '');
var physicalBootstrapOwnsSlice = physicalBootstrapChunkingEnabled
    && !startupDependencyBootstrapOnlyRequested
    && (!physicalBootstrapPhase || physicalBootstrapPhase == 'Prerequisites');
var activeImportStage = '物理前置检查';
var activeImportResource = '';

try {
    var generatedEntityPhysicalBootstrap = ensureGeneratedEntityPhysicalPrerequisites(
        physicalBootstrapOwnsSlice ? 1 : 999
    );
    if (generatedEntityPhysicalBootstrap.Added.length > 0) {
        debugLog.generated_entity_physical_bootstrap = generatedEntityPhysicalBootstrap.Added;
    }
    if (physicalBootstrapOwnsSlice && generatedEntityPhysicalBootstrap.ChangedTableCount > 0) {
        var physicalBootstrapHasMore = generatedEntityPhysicalBootstrap.RemainingTableCount > 0;
        var physicalBootstrapNextPhase = physicalBootstrapHasMore ? 'Prerequisites' : 'Ddl';
        var physicalBootstrapProgress = physicalBootstrapHasMore ? 2 : 5;
        var physicalBootstrapPackageInfo = Package && Package.PackageInfo ? Package.PackageInfo : {};
        var physicalBootstrapContinuation = {
            Version: 1,
            TaskId: String(physicalBootstrapTaskId || ''),
            Phase: physicalBootstrapNextPhase,
            Index: 0,
            Progress: physicalBootstrapProgress
        };
        var physicalBootstrapPackageVersion = String(
            physicalBootstrapPackageInfo.Version || physicalBootstrapPackageInfo.AppVersion
            || V8.Param.AppVersion || ''
        );
        var physicalBootstrapPackageIdentity = String(
            physicalBootstrapPackageInfo.AppId || physicalBootstrapPackageInfo.AppKey
            || V8.Param.AppId || V8.Param.AppKey || V8.Param.StoreId
            || physicalBootstrapPackageInfo.Name || ''
        );
        var physicalBootstrapStoreVersionId = String(V8.Param.StoreVersionId || '');
        if (physicalBootstrapPackageVersion) physicalBootstrapContinuation.PackageVersion = physicalBootstrapPackageVersion;
        if (physicalBootstrapPackageIdentity) physicalBootstrapContinuation.PackageIdentity = physicalBootstrapPackageIdentity;
        if (physicalBootstrapStoreVersionId) physicalBootstrapContinuation.StoreVersionId = physicalBootstrapStoreVersionId;
        var physicalBootstrapMessage = physicalBootstrapHasMore
            ? '平台运行时前置物理列已提交，将继续补齐下一张元数据表'
            : '平台运行时前置物理列已提交，将继续导入应用物理结构';
        return {
            Code: 1,
            Data: {
                BackgroundTask: {
                    HasMore: true,
                    Checkpoint: physicalBootstrapContinuation,
                    Progress: physicalBootstrapProgress,
                    Msg: physicalBootstrapMessage
                }
            },
            Msg: physicalBootstrapMessage
        };
    }
} catch (physicalBootstrapError) {
    return {
        Code: 0,
        Data: { '失败阶段': '物理前置检查' },
        Msg: '应用安装前置物理结构自检失败：'
            + (physicalBootstrapError && physicalBootstrapError.message
                ? physicalBootstrapError.message
                : String(physicalBootstrapError))
    };
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
// BACKGROUND_TASK_MONOTONIC_PROGRESS_V1：每个后台分片都会重新从商城源读取包，
// 但恢复任务不能因此把已持久化进度从 55% 等阶段值回写到 3%。优先沿用新版
// 检查点中的精确 Progress；旧检查点按阶段取保守下限，并在本执行片内只增不减。
var backgroundCheckpointProgressFloor = parseInt(backgroundCheckpoint.Progress, 10);
if (isNaN(backgroundCheckpointProgressFloor)) {
    var backgroundCheckpointPhaseProgressFloors = {
        Ddl: backgroundCheckpointIndex > 0 ? 10 : 0,
        Tables: 25,
        PlanFields: 40,
        Fields: 40,
        Physical: 55,
        ApplicationAssets: 65,
        PostSchema: 70,
        ScheduleJobs: 97
    };
    backgroundCheckpointProgressFloor = backgroundCheckpointPhaseProgressFloors[backgroundCheckpointPhase] || 0;
}
backgroundCheckpointProgressFloor = Math.max(0, Math.min(99, backgroundCheckpointProgressFloor));
// BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1：兼容尚未把当前进度放入
// _BackgroundTask 信封的旧平台节点。每个恢复分片从共享任务表回读已提交百分比，
// 与检查点取最大值；读取失败只退回检查点，不把任务本身变成不可恢复故障。
var backgroundEnvelopeProgressFloor = parseInt(backgroundTaskEnvelope.Progress, 10);
if (!isNaN(backgroundEnvelopeProgressFloor)) {
    backgroundCheckpointProgressFloor = Math.max(backgroundCheckpointProgressFloor, backgroundEnvelopeProgressFloor);
}
if (backgroundChunkingEnabled && backgroundTaskId) {
    try {
        var persistedTaskProgressRows = V8.Db.FromSql(
            'SELECT Progress FROM mci_background_task WHERE Id = @p0'
        ).AddInParameter('@p0', backgroundTaskId).ToArray();
        if (persistedTaskProgressRows && persistedTaskProgressRows.length > 0) {
            var persistedTaskProgressFloor = parseInt(persistedTaskProgressRows[0].Progress, 10);
            if (!isNaN(persistedTaskProgressFloor)) {
                backgroundCheckpointProgressFloor = Math.max(backgroundCheckpointProgressFloor, persistedTaskProgressFloor);
            }
        }
    } catch (persistedTaskProgressError) {
        // 旧库只要检查点可用仍可继续；错误会通过持久任务心跳和后续真实失败体现。
    }
}
backgroundCheckpointProgressFloor = Math.max(0, Math.min(99, backgroundCheckpointProgressFloor));
var lastReportedBackgroundProgress = backgroundCheckpointProgressFloor;
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
// 批量安装复用已有 16 字段上限，减少冷库的排队和元数据往返；每片仍独立提交、
// 强回读并保存检查点，后台任务的跨节点租约与续跑延迟保持不变。
if (!V8.Param.SchemaFieldChunkSize && backgroundChunkingEnabled && Number(V8.Param.BulkTotal || 0) > 0) {
    schemaFieldChunkSize = 16;
}
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
    var checkpointStoreVersionId = String(
        V8.Param.StoreVersionId || backgroundCheckpoint.StoreVersionId || ''
    );
    if (checkpointPackageVersion) checkpoint.PackageVersion = checkpointPackageVersion;
    if (checkpointPackageIdentity) checkpoint.PackageIdentity = checkpointPackageIdentity;
    if (checkpointStoreVersionId) checkpoint.StoreVersionId = checkpointStoreVersionId;
    if (backgroundCheckpoint.StartupApiBootstrapDone === true) {
        checkpoint.StartupApiBootstrapDone = true;
    }
    if (backgroundCheckpoint.StartupApiBootstrapRevision) {
        checkpoint.StartupApiBootstrapRevision = String(
            backgroundCheckpoint.StartupApiBootstrapRevision
        );
    }
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
                Checkpoint: buildPersistentCheckpoint(phase, index, { Progress: progress }),
                Progress: progress,
                Msg: msg
            }
        },
        Msg: msg
    };
};
// REMOTE_ZIP_SINGLE_ASSET_SLICE_V1：商城远程 ZIP 会先在可信 .NET 原子能力中
// 下载、校验并解包，再把当前文件交给 V8。Jint 的内存约束统计累计分配而不是
// 存活堆；默认每片只提交一个资产，避免同一片内继续叠加第二次 Base64 上传。
// 已写入的 AppId + FilePath + Hash 会在下一片幂等复用。
var applicationAssetChunkMaxFiles = parseInt(V8.Param.ApplicationAssetChunkMaxFiles || 1, 10);
if (isNaN(applicationAssetChunkMaxFiles)) applicationAssetChunkMaxFiles = 1;
applicationAssetChunkMaxFiles = Math.max(1, Math.min(50, applicationAssetChunkMaxFiles));
var applicationAssetChunkMaxBase64Chars = parseInt(V8.Param.ApplicationAssetChunkMaxBase64Chars || (32 * 1024 * 1024), 10);
if (isNaN(applicationAssetChunkMaxBase64Chars)) applicationAssetChunkMaxBase64Chars = 32 * 1024 * 1024;
applicationAssetChunkMaxBase64Chars = Math.max(1024 * 1024, Math.min(256 * 1024 * 1024, applicationAssetChunkMaxBase64Chars));
var applicationAssetChunkUploads = 0;
var applicationAssetChunkBase64Chars = 0;
var applicationAssetPreviouslyUploaded = parseInt(backgroundCheckpoint.ApplicationAssetUploaded || 0, 10);
if (isNaN(applicationAssetPreviouslyUploaded)) applicationAssetPreviouslyUploaded = 0;
// BACKGROUND_ASSET_RESUME_REQUIRED_V1：每片都会从包头重建运行清单，必须按
// 已持久化文件摘要复用前片资产；禁用复用会使单文件分片永久重传第一项。
if (backgroundChunkingEnabled) resumeInstall = true;

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

var buildApplicationAssetContinuation = function (bundleIndex, assetKind, assetIndex, totalAssets, completedAssets) {
    var uploaded = applicationAssetPreviouslyUploaded + applicationAssetChunkUploads;
    // APPLICATION_ASSET_DISTINCT_PROGRESS_V1：上传尝试次数可能包含旧任务的重复
    // 重传，不能作为完成数。以本片已验证并写入的文件位置报告真实进度。
    var completed = Math.max(0, Number(completedAssets === undefined ? assetIndex : completedAssets) || 0);
    var total = Math.max(0, Number(totalAssets) || 0);
    if (total > 0) completed = Math.min(completed, total);
    // APPLICATION_ASSET_NO_PROGRESS_GUARD_V1：摘要/元数据异常不能伪装成无限
    // 成功分片；允许短暂修复，连续三片停在同一持久位置时保留检查点并报错。
    var sameCursor = String(backgroundCheckpoint.Phase || '') == 'ApplicationAssets'
        && Number(backgroundCheckpoint.BundleIndex || 0) == bundleIndex
        && String(backgroundCheckpoint.AssetKind || '') == assetKind
        && Number(backgroundCheckpoint.AssetIndex || 0) == assetIndex;
    var stalledSlices = sameCursor ? Math.max(0, Number(backgroundCheckpoint.ApplicationAssetStalledSlices) || 0) + 1 : 0;
    if (stalledSlices >= 3) {
        throw new Error('APPLICATION_ASSET_NO_PROGRESS：应用资产连续三片未推进，已停止重复上传。'
            + ' BundleIndex=' + bundleIndex + '，AssetKind=' + assetKind + '，AssetIndex=' + assetIndex
            + '；请核对 mci_ai_app_file 的 AppId/FilePath/ContentHash/Size/HdfsPath 与目标租户运行文件摘要及存储权限。');
    }
    return {
        Code: 1,
        Data: {
            BackgroundTask: {
                HasMore: true,
                Checkpoint: buildPersistentCheckpoint('ApplicationAssets', 0, {
                    BundleIndex: bundleIndex,
                    AssetKind: assetKind,
                    AssetIndex: assetIndex,
                    ApplicationAssetUploaded: uploaded,
                    ApplicationAssetCompleted: completed,
                    ApplicationAssetStalledSlices: stalledSlices,
                    Progress: 65
                }),
                Current: completed,
                Total: total > 0 ? total : null,
                Progress: 65,
                Msg: '应用资产已验证 ' + completed + (total > 0 ? '/' + total : '')
                    + '，将从持久化检查点继续（应用 ' + (bundleIndex + 1) + '，' + assetKind + '，索引 ' + assetIndex + '）'
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
        progress = parseInt(progress, 10);
        if (isNaN(progress)) progress = lastReportedBackgroundProgress;
        progress = Math.max(lastReportedBackgroundProgress, Math.max(0, Math.min(99, progress)));
        lastReportedBackgroundProgress = progress;
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

// MARKETPLACE_PRIVATE_SOURCE_CREDENTIAL_V1：私有源 Token 只存在当前租户后端
// ServerPrivateSettings。前端和后台任务参数只携带稳定 Key，检查点、日志、审计
// 与安装版本表均不得保存 Token 原文。
var loadMarketplaceSourceCredential = function (credentialKey, expectedApiBase, expectedOsClient) {
    var key = firstTextParam([credentialKey]).replace(/^\s+|\s+$/g, '');
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
    var token = firstTextParam([credential.Token, credential.token]).replace(/^Bearer\s+/i, '');
    var boundBase = trimRightSlash(firstTextParam([credential.ApiBase, credential.apiBase]));
    var boundOsClient = firstTextParam([credential.OsClient, credential.osClient]);
    if (!token) throw new Error('商城源登录 Token 为空，请重新登录。');
    if (boundBase.toLowerCase() != trimRightSlash(expectedApiBase).toLowerCase()
        || boundOsClient.toLowerCase() != String(expectedOsClient || '').toLowerCase()) {
        throw new Error('商城源登录凭据与当前 ApiBase/OsClient 不匹配，请重新发现并登录该来源。');
    }
    var expiresAt = firstTextParam([credential.ExpiresAtUtc, credential.expiresAtUtc]);
    if (expiresAt) {
        var expiresAtTime = Date.parse(expiresAt);
        if (!isNaN(expiresAtTime) && expiresAtTime <= Date.now()) {
            throw new Error('商城源登录已过期，请重新登录。');
        }
    }
    return {
        authorization: token,
        did: firstTextParam([credential.Did, credential.did])
    };
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
    if (!V8.Param.StoreCredentialKey) V8.Param.StoreCredentialKey = firstTextParam([row.StoreCredentialKey, row.CredentialKey]);
    if (!V8.Param.StoreVersionId) {
        V8.Param.StoreVersionId = firstTextParam([
            backgroundCheckpoint.StoreVersionId,
            row.StoreVersionId,
            row.DataVersionId
        ]);
    }
    return row;
};

var storeRow = syncStoreMetaFromRow();
var storeApiBase = trimRightSlash(firstTextParam([V8.Param.StoreApiBase, storeRow.StoreApiBase, storeRow.AppStoreApiBase, 'https://api.itdos.com']));
var storeOsClient = firstTextParam([V8.Param.StoreOsClient, V8.Param.AppStoreOsClient, storeRow.StoreOsClient, storeRow.AppStoreOsClient, storeRow.SourceOsClient, 'iTdos']);
var storeCredentialKey = firstTextParam([V8.Param.StoreCredentialKey, storeRow.StoreCredentialKey, storeRow.CredentialKey]);
var storeRequestHeaders = {};
try {
    storeRequestHeaders = loadMarketplaceSourceCredential(storeCredentialKey, storeApiBase, storeOsClient) || {};
} catch (credentialError) {
    return { Code: 0, Msg: credentialError.message || String(credentialError) };
}

// MARKETPLACE_SOURCE_READ_RETRY_V2：后台分片每次都要从商城源重新读取权威包。
// 代理切换、连接复用或上游瞬时超时时，V8.Http 可能短暂返回空字符串；直接
// JSON.parse 会让整个大型应用从外层任务重试。这里只对固定的只读商城请求做
// 有界重试，绝不重试安装写入，也不接受空响应或非成功业务结果。
var postMarketplaceReadWithRetry = function (label, url, postParam, timeoutSeconds) {
    var lastError = '';
    var maxAttempts = 8;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            var request = {
                Url: url,
                PostParam: postParam || {},
                ParamType: 'json',
                Headers: storeRequestHeaders,
                Timeout: timeoutSeconds || 120
            };
            var response = null;
            if (V8.Http.PostResponse) {
                var responseEnvelope = V8.Http.PostResponse(request);
                var responseText = responseEnvelope && responseEnvelope.Content;
                if ((!responseText || !String(responseText).replace(/^\s+|\s+$/g, ''))
                    && responseEnvelope && responseEnvelope.RawBytes
                    && responseEnvelope.RawBytes.Length > 0) {
                    responseText = System.Text.Encoding.UTF8.GetString(responseEnvelope.RawBytes);
                }
                if (!responseText || !String(responseText).replace(/^\s+|\s+$/g, '')) {
                    var statusCode = responseEnvelope ? Number(responseEnvelope.StatusCode || 0) : 0;
                    var transportError = responseEnvelope
                        ? String(responseEnvelope.ErrorMessage || '').replace(/^\s+|\s+$/g, '')
                        : '';
                    throw new Error('商城源返回空响应（HTTP ' + statusCode
                        + (transportError ? '，' + transportError : '') + '）');
                }
                response = responseText;
            } else {
                // 兼容尚未提供完整响应方法的旧节点。
                response = V8.Http.Post(request);
            }
            if (typeof response == 'string') {
                var responseText = String(response || '').replace(/^\s+|\s+$/g, '');
                if (!responseText) throw new Error('商城源返回空响应');
                response = JSON.parse(responseText);
            }
            if (response && response.Code == 1) return response;
            lastError = String((response && response.Msg) || '商城源返回非成功状态');
        } catch (readError) {
            lastError = readError && readError.message ? readError.message : String(readError);
        }
        if (attempt < maxAttempts) {
            try {
                if (V8.Action && V8.Action.Sleep) V8.Action.Sleep(500 * attempt);
                else System.Threading.Thread.Sleep(500 * attempt);
            } catch (sleepError) { }
        }
    }
    throw new Error(label + '失败（已重试' + maxAttempts + '次）：' + (lastError || '商城源无返回'));
};
// MARKETPLACE_CUSTOM_ENGINE_ROUTE_V2：固定商城能力使用引擎自定义地址，
// 使耗时、流量与异常能够精确归因到 ApiEngineKey。宿主对缺失引擎
// 也会返回结构化 DosResult，不再依赖通用 Run 入口避免 404。
var marketplaceEngineUrl = function (apiEngineKey) {
    return storeApiBase + '/apiengine/' + encodeURIComponent(apiEngineKey)
        + '?OsClient=' + encodeURIComponent(storeOsClient);
};
var marketplaceEngineParam = function (apiEngineKey, postParam) {
    var result = {};
    postParam = postParam || {};
    for (var key in postParam) {
        if (Object.prototype.hasOwnProperty.call(postParam, key)) result[key] = postParam[key];
    }
    return result;
};
// MARKETPLACE_HDFS_PACKAGE_POINTER_V1：新版商城响应只返回不可变 HDFS 指针和
// 短期下载地址。安装端完整下载一次后必须核对 UTF-8 字节数和 SHA-256；旧
// AppPakcet 继续兼容，但后台任务与数据库版本快照不再复制大包正文。
var loadMarketplacePackage = function (storeModel, label) {
    storeModel = storeModel || {};
    if (storeModel.AppPakcet) return storeModel.AppPakcet;
    var downloadUrl = firstTextParam([storeModel.PackageDownloadUrl]);
    var expectedSha = firstTextParam([storeModel.PackageSha256]).toLowerCase();
    var expectedSize = parseInt(storeModel.PackageSize || 0, 10) || 0;
    if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)
        || !/^[a-f0-9]{64}$/.test(expectedSha)
        || expectedSize < 1 || expectedSize > 256 * 1024 * 1024) {
        throw new Error((label || '应用包') + '的 HDFS 指针缺少安全下载地址、SHA-256 或合法字节数');
    }
    var response = V8.Http.GetResponse({
        Url: downloadUrl,
        GetParam: {},
        Timeout: 600,
        Headers: { 'Accept': 'application/json' }
    });
    if (!response || Number(response.StatusCode || 0) < 200 || Number(response.StatusCode || 0) >= 300) {
        throw new Error((label || '应用包') + '下载失败（HTTP '
            + Number(response && response.StatusCode || 0) + '）');
    }
    var content = response.Content;
    if ((!content || !String(content).length) && response.RawBytes && response.RawBytes.Length > 0) {
        content = System.Text.Encoding.UTF8.GetString(response.RawBytes);
    }
    content = String(content || '');
    var actualSize = Number(System.Text.Encoding.UTF8.GetByteCount(content));
    var actualSha = String(V8.EncryptHelper.Sha256Hex(content) || '').toLowerCase();
    if (actualSize != expectedSize || actualSha != expectedSha) {
        throw new Error((label || '应用包') + '下载校验失败：size=' + actualSize + '/' + expectedSize
            + '，sha256=' + actualSha + '/' + expectedSha);
    }
    return content;
};
var authoritativeStoreModel = null;
var applicationAssetDownloadUrls = {};
if (!Package && storeRow && storeRow.AppPakcet) {
    Package = storeRow.AppPakcet;
}
if (!Package && firstTextParam([V8.Param.StoreId, V8.Param.Id, storeRow.Id])) {
    reportProgress(3, '正在从应用商城源获取应用数据包');
    var storeId = firstTextParam([V8.Param.StoreId, V8.Param.Id, storeRow.Id]);
    var storeModelResult = postMarketplaceReadWithRetry(
        '读取商城应用包',
        marketplaceEngineUrl('get-microi-store-model'),
        marketplaceEngineParam('get-microi-store-model', {
            Id: storeId,
            StoreVersionId: firstTextParam([V8.Param.StoreVersionId, storeRow.StoreVersionId, storeRow.DataVersionId]),
            ExpectedAppVersion: firstTextParam([V8.Param.AppVersion, storeRow.AppVersion, storeRow.Version]),
            PinCurrentVersion: backgroundChunkingEnabled,
            PackagePointerMode: 'HdfsV1'
        }),
        120
    );
    if (storeModelResult && storeModelResult.Code == 1 && storeModelResult.Data) {
        var storeModel = storeModelResult.Data;
        authoritativeStoreModel = storeModel;
        var storeModelAppend = storeModelResult.DataAppend || {};
        var signedAssetUrls = storeModelAppend.ApplicationAssetDownloadUrls || {};
        if (typeof signedAssetUrls == 'string') {
            try { signedAssetUrls = JSON.parse(signedAssetUrls || '{}'); }
            catch (signedAssetUrlParseError) { signedAssetUrls = {}; }
        }
        if (signedAssetUrls && typeof signedAssetUrls == 'object') {
            applicationAssetDownloadUrls = signedAssetUrls;
        }
        Package = loadMarketplacePackage(storeModel, '商城应用包');
        if (!V8.Param.AppId) V8.Param.AppId = firstTextParam([storeModel.AppId, storeModel.AppKey, storeModel.Id]);
        if (!V8.Param.AppName) V8.Param.AppName = firstTextParam([storeModel.AppName, storeModel.Name]);
        if (!V8.Param.AppVersion) V8.Param.AppVersion = firstTextParam([storeModel.AppVersion, storeModel.Version]);
        if (!V8.Param.AppAuthor) V8.Param.AppAuthor = firstTextParam([storeModel.AppAuthor, storeModel.Author]);
        if (!V8.Param.StoreVersionId) {
            V8.Param.StoreVersionId = firstTextParam([storeModel.StoreVersionId, storeModel.DataVersionId]);
        }
        if (backgroundChunkingEnabled && !V8.Param.StoreVersionId) {
            return {
                Code: 0,
                Data: {
                    ErrorType: 'MARKETPLACE_VERSION_SNAPSHOT_MISSING',
                    StoreId: storeId,
                    AppVersion: firstTextParam([V8.Param.AppVersion, storeModel.AppVersion, storeModel.Version])
                },
                Msg: '商城源未返回不可变安装快照，已停止后台分片安装。'
            };
        }
        if (V8.Param.StoreVersionId) {
            debugLog.marketplace_version_snapshot = String(V8.Param.StoreVersionId);
        }
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

// MARKETPLACE_PACKAGE_IDENTITY_BINDING_V1：商城行、不可变快照与包正文
// 必须是同一 AppKey/版本。这可以直接拒绝历史选择状态把婚礼应用
// 错绑到排班考勤 ZIP 之类的跨应用混装。
if (authoritativeStoreModel) {
    var packageIdentity = firstTextParam([
        Package.PackageInfo.AppId,
        Package.PackageInfo.AppKey,
        Package.ApplicationBundle && Package.ApplicationBundle.Application
            && Package.ApplicationBundle.Application.AppKey
    ]).toLowerCase();
    var storeIdentity = firstTextParam([
        authoritativeStoreModel.AppKey,
        authoritativeStoreModel.AppId
    ]).toLowerCase();
    var packageVersionIdentity = firstTextParam([
        Package.PackageInfo.Version,
        Package.PackageInfo.AppVersion
    ]).toLowerCase();
    var storeVersionIdentity = firstTextParam([
        authoritativeStoreModel.AppVersion,
        authoritativeStoreModel.Version
    ]).toLowerCase();
    if (packageIdentity && storeIdentity && packageIdentity != storeIdentity) {
        return {
            Code: 0,
            Data: { ErrorType: 'MARKETPLACE_PACKAGE_IDENTITY_MISMATCH' },
            Msg: '商城应用与安装包 AppKey 不一致，已停止安装。'
        };
    }
    if (packageVersionIdentity && storeVersionIdentity && packageVersionIdentity != storeVersionIdentity) {
        return {
            Code: 0,
            Data: { ErrorType: 'MARKETPLACE_PACKAGE_VERSION_MISMATCH' },
            Msg: '商城应用与安装包版本不一致，已停止安装。'
        };
    }
}

// TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1：Upgrade13 只从程序集内置白名单读取、
// 完整校验并传入九个官方基础包。可信身份保存在绑定当前租户和本导入器 Key 的
// 宿主 AsyncLocal 中，V8.Param 只能提出消费请求，不能自行伪造授权。
var embeddedOfficialPackageRequested = V8.Param.TrustedEmbeddedOfficialPackage === true
    || String(V8.Param.TrustedEmbeddedOfficialPackage || '').toLowerCase() == 'true';
var embeddedOfficialResourceName = String(V8.Param.EmbeddedOfficialPackageResourceName || '').toLowerCase();
var embeddedOfficialResourceNames = {
    'app.microi.form-engine.json': true,
    'app.microi.module-engine.json': true,
    'app.microi.saas-engine.json': true,
    'app.microi.sso.json': true,
    'app.microi.store.json': true,
    'app.microi.sys_user.json': true,
    'app.microi.sys-config.json': true,
    'app.microi.message-notification.json': true,
    'app.microi.ai-engine.json': true
};
var trustedEmbeddedOfficialPackage = false;
if (embeddedOfficialPackageRequested) {
    var embeddedOfficialTrust = V8.Method.RequireManagedProtocolContext();
    if (!embeddedOfficialTrust || embeddedOfficialTrust.Code != 1) {
        return { Code: 0, Msg: '内置官方应用包导入缺少不可伪造的宿主可信上下文。' };
    }
    if (!embeddedOfficialResourceNames[embeddedOfficialResourceName]) {
        return { Code: 0, Msg: '内置官方应用包资源名不在固定白名单：' + embeddedOfficialResourceName };
    }
    trustedEmbeddedOfficialPackage = true;
}

// TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1：旧版官方平台应用包的资源策略都写成
// Ownership=Application。只有从固定 iTdos 商城实时回读、且商城元数据明确为
// 官方/平台应用时，才把它迁移为 Platform；直接传入的离线包或自定义商城源
// 继续使用包内原策略，不能靠自报 PublisherType 获得平台级宽松处理。
var officialPublisherType = authoritativeStoreModel
    ? String(authoritativeStoreModel.PublisherType || '')
    : '';
var trustedOfficialPlatformPackage = !!authoritativeStoreModel
    && String(storeApiBase || '').toLowerCase() == 'https://api.itdos.com'
    && String(storeOsClient || '').toLowerCase() == 'itdos'
    && String(authoritativeStoreModel.ApplicationType || '').toLowerCase() == 'platform'
    && (officialPublisherType == '官方应用' || officialPublisherType == '平台应用');
trustedOfficialPlatformPackage = trustedOfficialPlatformPackage || trustedEmbeddedOfficialPackage;

var listSize = function (value) {
    return value && value.length !== undefined ? Number(value.length) || 0 : 0;
};
// BACKGROUND_TASK_BOUNDED_PACKAGE_SLICES_V1：历史 BulkAdaptiveSingleSlice
// 只按资源条数估算工作量，会把包含重 DDL、实体生成和权限回填的官方包误判为
// “小包”，造成单事务长期占用且没有可恢复检查点。为兼容旧批量工作器继续接收
// 参数，但后台任务一律保留有界分片；直接前台安装的既有语义不受影响。
var bulkAdaptiveSingleSliceRequested = V8.Param.BulkAdaptiveSingleSlice === true
    || String(V8.Param.BulkAdaptiveSingleSlice || '').toLowerCase() == 'true';
if (bulkAdaptiveSingleSliceRequested && backgroundChunkingEnabled) {
    debugLog.bulk_adaptive_single_slice_ignored = '已保留后台有界分片，忽略旧版单事务请求';
}

// PACKAGE_REPLAY_VERSION_GUARD_V2：identifier-only 后台任务首次按期望 AppVersion
// 解析不可变 StoreVersionId，并把它写入检查点；后续每片只读取该历史快照。
// 版本和身份校验仍失败关闭，防止快照损坏、错误引用或旧任务把两个包混装。
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
    if (backgroundCheckpoint.StoreVersionId
        && String(backgroundCheckpoint.StoreVersionId) != String(V8.Param.StoreVersionId || '')) {
        return {
            Code: 0,
            Msg: '应用包历史快照与后台检查点不一致，已停止混合安装。'
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

// PACKAGE_MENU_RUNTIME_PREFLIGHT_V1：菜单唯一键和菜单依赖的微服务运行时必须
// 在任何 DDL、字段、菜单写入之前完成校验。禁止把一个已知无法运行的菜单先写入
// 租户，再到 98% 才因唯一索引或“微服务不存在”失败。
var validatePackageMenuRuntimeContract = function (packageModel) {
    packageModel = packageModel || {};
    var errors = [];
    var menuUrls = {};
    var menus = packageModel.SysMenus || [];
    for (var menuIndex = 0; menuIndex < listSize(menus); menuIndex++) {
        var menu = menus[menuIndex] || {};
        var url = String(menu.Url || '').replace(/^\s+|\s+$/g, '');
        if (!url) continue;
        var normalizedUrl = url.toLowerCase();
        var currentLabel = String(menu.Name || menu.Id || ('第' + (menuIndex + 1) + '个菜单'));
        if (menuUrls[normalizedUrl] && menuUrls[normalizedUrl].Id != String(menu.Id || '')) {
            errors.push('菜单 Url 重复：' + url + '，同时被【' + menuUrls[normalizedUrl].Label
                + '】和【' + currentLabel + '】占用');
        } else {
            menuUrls[normalizedUrl] = { Id: String(menu.Id || ''), Label: currentLabel };
        }
    }

    // LEGACY_MICROSERVICE_MENU_KEY_INFERENCE_V1：历史官方包可能使用单数
    // ApplicationBundle，且源租户 sys_menu 尚无 MicroServiceKey 物理字段。
    // 仅从包内不可变事实唯一推导 Key；显式 URL 冲突或多候选仍失败关闭。
    var runtimeBundles = {};
    var runtimeBundleKeys = [];
    var bundles = [];
    var pluralBundles = packageModel.ApplicationBundles || [];
    for (var pluralBundleIndex = 0; pluralBundleIndex < listSize(pluralBundles); pluralBundleIndex++) {
        if (pluralBundles[pluralBundleIndex]) bundles.push(pluralBundles[pluralBundleIndex]);
    }
    var singularBundle = packageModel.ApplicationBundle
        || packageModel.AiApplication
        || packageModel.FrontendApplication;
    if (singularBundle) bundles.push(singularBundle);
    for (var bundleIndex = 0; bundleIndex < listSize(bundles); bundleIndex++) {
        var bundle = bundles[bundleIndex] || {};
        var application = bundle.Application || {};
        var microService = bundle.MicroService || {};
        var appKey = firstTextParam([application.AppKey, bundle.AppKey, microService.MsKey]).toLowerCase();
        if (!appKey) continue;
        var routeMap = {};
        var pageIdMap = {};
        var routes = bundle.Routes || [];
        for (var routeIndex = 0; routeIndex < listSize(routes); routeIndex++) {
            var route = routes[routeIndex] || {};
            var routePath = String(route.RoutePath || '').replace(/^\s+|\s+$/g, '');
            if (routePath) routeMap[routePath.toLowerCase()] = true;
            if (route.Id) pageIdMap[String(route.Id).toLowerCase()] = true;
        }
        var runtimeBundleAlreadyKnown = !!runtimeBundles[appKey];
        runtimeBundles[appKey] = {
            Key: appKey,
            ServiceId: String(microService.Id || '').toLowerCase(),
            Routes: routeMap,
            PageIds: pageIdMap
        };
        if (!runtimeBundleAlreadyKnown) runtimeBundleKeys.push(appKey);
    }

    for (var runtimeMenuIndex = 0; runtimeMenuIndex < listSize(menus); runtimeMenuIndex++) {
        var runtimeMenu = menus[runtimeMenuIndex] || {};
        var isMicroServiceMenu = String(runtimeMenu.OpenType || '').toLowerCase() == 'microservice'
            || runtimeMenu.IsMicroiService === true
            || Number(runtimeMenu.IsMicroiService || 0) === 1;
        if (!isMicroServiceMenu) continue;
        var menuKey = firstTextParam([
            runtimeMenu.MicroServiceKey,
            runtimeMenu.MsKey,
            runtimeMenu.MicroServiceAppKey
        ]).toLowerCase();
        var menuLabel = String(runtimeMenu.Name || runtimeMenu.Id || ('第' + (runtimeMenuIndex + 1) + '个菜单'));
        if (!menuKey) {
            var menuUrl = String(runtimeMenu.Url || '').replace(/^\s+|\s+$/g, '');
            var urlKeyMatch = /^\/micro-app\/([^\/?#]+)(?:\/|$)/i.exec(menuUrl);
            if (urlKeyMatch && urlKeyMatch[1]) {
                // URL 是菜单自身的显式稳定绑定。即使包内没有同 Key 运行包也先保留，
                // 后续统一校验会给出准确的“未交付 ApplicationBundle”错误。
                menuKey = String(urlKeyMatch[1]).toLowerCase();
            } else {
                var candidateKeys = [];
                var menuServiceId = String(runtimeMenu.MicroServiceId || '').toLowerCase();
                var menuPageId = String(runtimeMenu.MicroServicePageId || '').toLowerCase();
                var inferredRoutePath = firstTextParam([
                    runtimeMenu.MicroServiceRoutePath,
                    runtimeMenu.RoutePath
                ]).toLowerCase();
                var appendCandidate = function (candidateKey) {
                    for (var candidateIndex = 0; candidateIndex < candidateKeys.length; candidateIndex++) {
                        if (candidateKeys[candidateIndex] == candidateKey) return;
                    }
                    candidateKeys.push(candidateKey);
                };
                for (var runtimeBundleKeyIndex = 0; runtimeBundleKeyIndex < runtimeBundleKeys.length; runtimeBundleKeyIndex++) {
                    var candidateKey = runtimeBundleKeys[runtimeBundleKeyIndex];
                    var candidateBundle = runtimeBundles[candidateKey];
                    if ((menuServiceId && candidateBundle.ServiceId == menuServiceId)
                        || (menuPageId && candidateBundle.PageIds[menuPageId])
                        || (inferredRoutePath && candidateBundle.Routes[inferredRoutePath])) {
                        appendCandidate(candidateKey);
                    }
                }
                if (candidateKeys.length == 1) menuKey = candidateKeys[0];
                else if (candidateKeys.length == 0 && runtimeBundleKeys.length == 1) menuKey = runtimeBundleKeys[0];
            }
            if (menuKey) runtimeMenu.MicroServiceKey = menuKey;
        }
        if (!menuKey) {
            errors.push('微服务菜单【' + menuLabel + '】缺少 MicroServiceKey');
            continue;
        }
        var runtimeBundle = runtimeBundles[menuKey];
        if (!runtimeBundle) {
            errors.push('微服务菜单【' + menuLabel + '】引用 ' + menuKey
                + '，但当前应用包未交付对应 ApplicationBundle');
            continue;
        }
        var menuRoutePath = firstTextParam([runtimeMenu.MicroServiceRoutePath, runtimeMenu.RoutePath]);
        if (menuRoutePath && !runtimeBundle.Routes[String(menuRoutePath).toLowerCase()]) {
            errors.push('微服务菜单【' + menuLabel + '】引用路由 ' + menuRoutePath
                + '，但 ' + menuKey + ' 的 ApplicationBundle 未包含该路由');
        }
    }
    return { Errors: errors };
};
var packageMenuRuntimeContract = validatePackageMenuRuntimeContract(Package);

// 仅检查包体结构，不写数据库、不上传文件。用于发布前及跨平台安装前的安全验收。
if (V8.Param.ValidateOnly === true || String(V8.Param.Action || '').toLowerCase() == 'validate') {
    var validationErrors = [];
    for (var validationRuntimeErrorIndex = 0; validationRuntimeErrorIndex < packageMenuRuntimeContract.Errors.length; validationRuntimeErrorIndex++) {
        validationErrors.push(packageMenuRuntimeContract.Errors[validationRuntimeErrorIndex]);
    }
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
        var validationStoragePolicy = bundle.AssetStoragePolicy || {};
        if (typeof validationStoragePolicy == 'string') {
            try { validationStoragePolicy = JSON.parse(validationStoragePolicy); }
            catch (validationStoragePolicyError) {
                validationErrors.push('第' + (validationIndex + 1) + '个AI应用的 AssetStoragePolicy 不是有效 JSON');
                validationStoragePolicy = {};
            }
        }
        var validationSourcePolicy = String(validationStoragePolicy.Source || validationStoragePolicy.SourceMode || 'PrivateHdfs').toLowerCase();
        var validationBuildPolicy = String(validationStoragePolicy.Build || validationStoragePolicy.BuildMode || 'PublicHdfs').toLowerCase();
        var validationSourceNotIncluded = /^(notincluded|not-included|none)$/i.test(validationSourcePolicy);
        var validationDatabaseOnlyBuild = /^(databaseonly|database-only|db-only)$/i.test(validationBuildPolicy);
        var validationSharedPublicBuild = /^(sharedpublicruntime|shared-public-runtime|sharedruntime)$/i.test(validationBuildPolicy);
        var validationSharedRuntime = bundle.SharedPublicRuntime || bundle.SharedRuntime || {};
        if (!validationSourceNotIncluded && !/^(privatehdfs|private-hdfs|hdfs)$/i.test(validationSourcePolicy)) {
            validationErrors.push('第' + (validationIndex + 1) + '个AI应用的 AssetStoragePolicy.Source 不受支持：' + validationSourcePolicy);
        }
        if (!validationDatabaseOnlyBuild && !validationSharedPublicBuild && !/^(publichdfs|public-hdfs|privatehdfs|private-hdfs|hdfs)$/i.test(validationBuildPolicy)) {
            validationErrors.push('第' + (validationIndex + 1) + '个AI应用的 AssetStoragePolicy.Build 不受支持：' + validationBuildPolicy);
        }
        if (validationSourceNotIncluded && (validationSourceExpected || sourceCount > 0)) {
            validationErrors.push('第' + (validationIndex + 1) + '个AI应用声明 Source=NotIncluded，但仍声明或携带源码');
        }
        var validationStorageMode = String((bundle.MicroService && bundle.MicroService.StorageMode) || '').toLowerCase();
        if (validationDatabaseOnlyBuild
            && (applicationType != 'MicroService' || !/^(db|database)$/i.test(validationStorageMode))) {
            validationErrors.push('第' + (validationIndex + 1) + '个AI应用的 Build=DatabaseOnly 仅支持 StorageMode=db 的 MicroService');
        }
        if (validationDatabaseOnlyBuild && embeddedAssets.length > 256) {
            validationErrors.push('第' + (validationIndex + 1) + '个数据库内联运行包超过 256 个文件');
        }
        if (validationSharedPublicBuild) {
            var validationSharedEntryUrl = String(validationSharedRuntime.EntryUrl || '');
            var validationSharedManifestHash = String(validationSharedRuntime.ManifestHash || '').toLowerCase();
            var validationSharedVersion = String(validationSharedRuntime.VersionNo || bundle.VersionNo || '');
            if (!validationSourceNotIncluded) {
                validationErrors.push('第' + (validationIndex + 1) + '个共享公共运行时必须声明 Source=NotIncluded');
            }
            if (!/^https:\/\/[^?#]{1,2040}$/i.test(validationSharedEntryUrl)) {
                validationErrors.push('第' + (validationIndex + 1) + '个共享公共运行时 EntryUrl 必须是无查询参数和片段的 HTTPS 地址');
            }
            if (!/^[a-f0-9]{64}$/i.test(validationSharedManifestHash)) {
                validationErrors.push('第' + (validationIndex + 1) + '个共享公共运行时必须提供 64 位 ManifestHash');
            }
            if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/i.test(validationSharedVersion)
                || validationSharedEntryUrl.toLowerCase().indexOf('/' + validationSharedVersion.toLowerCase() + '/') < 0) {
                validationErrors.push('第' + (validationIndex + 1) + '个共享公共运行时 EntryUrl 必须固定到 VersionNo 目录');
            }
        }
        var validationInlineBytes = 0;
        var emptySourceContent = 0;
        var emptyBuildContent = 0;
        for (var validationSourceIndex = 0; validationSourceIndex < embeddedSources.length; validationSourceIndex++) {
            var validationSource = embeddedSources[validationSourceIndex] || {};
            if (!validationSource.FileByteBase64 && validationSource.Content === undefined && !validationSource.ContentBase64 && !validationSource.Base64) emptySourceContent++;
        }
        for (var validationAssetIndex = 0; validationAssetIndex < embeddedAssets.length; validationAssetIndex++) {
            var validationAsset = embeddedAssets[validationAssetIndex] || {};
            if (!validationAsset.FileByteBase64 && validationAsset.Content === undefined && !validationAsset.ContentBase64 && !validationAsset.Base64) emptyBuildContent++;
            if (validationDatabaseOnlyBuild) {
                var validationInlineBase64 = firstTextParam([
                    validationAsset.FileByteBase64,
                    validationAsset.ContentBase64,
                    validationAsset.Base64
                ]);
                if (!validationInlineBase64 && validationAsset.Content !== undefined && validationAsset.Content !== null) {
                    validationInlineBase64 = V8.Base64.StringToBase64(String(validationAsset.Content));
                }
                var validationInlineText = String(validationInlineBase64 || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
                var validationInlinePadding = validationInlineText.substring(Math.max(0, validationInlineText.length - 2)).replace(/[^=]/g, '').length;
                validationInlineBytes += Math.max(0, Math.floor(validationInlineText.length * 3 / 4) - validationInlinePadding);
            }
        }
        if (validationDatabaseOnlyBuild && validationInlineBytes > 5 * 1024 * 1024) {
            validationErrors.push('第' + (validationIndex + 1) + '个数据库内联运行包超过 5MB');
        }
        if (supportedTypes.indexOf(applicationType) < 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用类型不受支持：' + applicationType);
        if (!application.AppKey) validationErrors.push('第' + (validationIndex + 1) + '个AI应用缺少 Application.AppKey');
        if (!application.Name) validationErrors.push('第' + (validationIndex + 1) + '个AI应用缺少 Application.Name');
        if (validationSourceExpected && sourceCount < 1) validationErrors.push('第' + (validationIndex + 1) + '个AI应用声明包含源码但没有源码文件');
        if (emptySourceContent > 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用有' + emptySourceContent + '个源码文件缺少内嵌内容');
        if (emptyBuildContent > 0) validationErrors.push('第' + (validationIndex + 1) + '个AI应用有' + emptyBuildContent + '个编译文件缺少内嵌内容');
        if (assetCount < 1 && !validationSharedPublicBuild) validationErrors.push('第' + (validationIndex + 1) + '个AI应用没有公有编译产物');
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

if (packageMenuRuntimeContract.Errors.length > 0) {
    return {
        Code: 0,
        Data: { Errors: packageMenuRuntimeContract.Errors },
        Msg: '应用数据包预检失败：' + packageMenuRuntimeContract.Errors.join('；')
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
        return /duplicate entry.+primary|duplicate key|primary key constraint|unique constraint|violates unique|ora-00001|唯一约束|主键冲突/i
            .test(writeResultMessage(value));
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

    // STARTUP_DEPENDENCY_API_FAST_BOOTSTRAP_V1：子租户启动事故恢复不能等待
    // 22 条 DDL、数百字段和全部资源分片完成后才补齐前端启动接口。只有后台
    // 批量工作器显式请求、且包体来自固定 iTdos 官方商城并被识别为 Platform
    // 应用时，才从不可变应用商城/SaaS 包中覆盖式写入七个官方 Managed 接口。
    // 目标源码、软删除状态或历史稳定 Id 不再形成冲突；同 Key 原位覆盖，Id 被其它
    // Key 占用时为本接口生成新 Id，官方地址被其它接口占用时由本包收回地址。
    // STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1：BootstrapOnly 只允许受信后台工作器
    // 在完整包安装前执行这一固定闭包；成功后立即返回，不写安装版本、不跳过后续正式导入。
    var startupApiBootstrapRevision = 'startup-api-complete-closure-v4';
    var startupApiBootstrapRequested = V8.Param.StartupDependencyRecovery === true
        || String(V8.Param.StartupDependencyRecovery || '').toLowerCase() == 'true';
    var startupPackageIdentity = String(
        Package.PackageInfo.AppId || Package.PackageInfo.AppKey || V8.Param.AppId || ''
    ).toLowerCase();
    var startupPackageApiKeys = {
        'app.microi.store': ['platform-sys-menu'],
        'app.microi.saas-engine': [
            'platform-os-client-by-domain',
            'platform-sys-config',
            'platform-lang-bundle',
            'platform-current-user',
            'platform-private-file-url',
            'platform-sys-user-public-info'
        ]
    };
    if (startupApiBootstrapRequested
        && backgroundChunkingEnabled
        && trustedOfficialPlatformPackage
        && startupPackageApiKeys[startupPackageIdentity]
        && String(backgroundCheckpoint.StartupApiBootstrapRevision || '')
            != startupApiBootstrapRevision) {
        var startupApiKeys = startupPackageApiKeys[startupPackageIdentity];
        var startupPackageEngineMap = {};
        var startupPackageEngines = Package.SysApiEngines || [];
        for (var startupPackageIndex = 0;
            startupPackageIndex < startupPackageEngines.length;
            startupPackageIndex++) {
            var startupPackageEngine = startupPackageEngines[startupPackageIndex] || {};
            var startupPackageKey = String(startupPackageEngine.ApiEngineKey || '').toLowerCase();
            if (startupPackageKey) startupPackageEngineMap[startupPackageKey] = startupPackageEngine;
        }
        var startupAdded = [];
        var startupReconciled = [];
        var startupOverwritten = [];
        var startupIdentityRemapped = [];
        var normalizeStartupSource = function (value) {
            return String(value || '').replace(/\r\n/g, '\n').trim();
        };
        var readStartupEngine = function (fieldName, value) {
            if (!value) return null;
            return V8.Db.FromSql(
                'SELECT * FROM sys_apiengine WHERE LOWER(' + fieldName + ')=LOWER(@p0)'
            ).AddInParameter('@p0', value).First();
        };
        var normalizeStartupFlag = function (value) {
            if (value === true) return 1;
            if (value === false || value === null || value === undefined || value === '') return 0;
            var normalized = String(value).trim().toLowerCase();
            if (normalized == 'true' || normalized == 'yes' || normalized == 'on') return 1;
            if (normalized == 'false' || normalized == 'no' || normalized == 'off') return 0;
            var numeric = Number(value);
            return isNaN(numeric) ? 0 : (numeric == 0 ? 0 : 1);
        };
        // STARTUP_API_RUNTIME_FLAG_PHYSICAL_RECONCILIATION_V1：部分历史租户已经有
        // AllowAnonymous 等物理列，但缺少对应 diy_field，FormEngine 会返回成功却静默
        // 忽略匿名/启用开关。对上方可信官方包中的 Managed 接口直接按固定字段
        // 参数化补正，保证低代码字段元数据落后时源码、版本、路由和开关仍覆盖落库。
        var reconcileStartupRuntimeFlags = function (incoming, id) {
            V8.Db.FromSql(
                // MySQL BIT(1) 会把 Jint 数字参数按字符串绑定成字节值并报
                // Data too long；这里只拼接内部归一化后的 0/1 常量，Id 仍参数化。
                'UPDATE sys_apiengine SET IsEnable=' + normalizeStartupFlag(incoming.IsEnable)
                + ', StopHttp=' + normalizeStartupFlag(incoming.StopHttp)
                + ', AllowAnonymous=' + normalizeStartupFlag(incoming.AllowAnonymous)
                + ', IsDeleted=0, ApiAddress=@p1, ApiV8Code=@p2, Version=@p3 WHERE Id=@p0'
            )
                .AddInParameter('@p0', id)
                .AddInParameter('@p1', incoming.ApiAddress)
                .AddInParameter('@p2', incoming.ApiV8Code)
                .AddInParameter('@p3', incoming.Version || '')
                .ExecuteNonQuery();
            var readback = readStartupEngine('Id', id);
            if (!readback
                || normalizeStartupFlag(readback.IsEnable) != normalizeStartupFlag(incoming.IsEnable)
                || normalizeStartupFlag(readback.StopHttp) != normalizeStartupFlag(incoming.StopHttp)
                || normalizeStartupFlag(readback.AllowAnonymous)
                    != normalizeStartupFlag(incoming.AllowAnonymous)
                || normalizeStartupSource(readback.ApiV8Code)
                    != normalizeStartupSource(incoming.ApiV8Code)
                || String(readback.ApiAddress || '') != String(incoming.ApiAddress || '')
                || String(readback.Version || '').toLowerCase()
                    != String(incoming.Version || '').toLowerCase()) {
                throw new Error('启动接口运行标志物理补正回读不一致：'
                    + String(incoming.ApiEngineKey || id));
            }
            return readback;
        };
        var removeStartupEngineCacheAliases = function (row) {
            if (!row) return;
            var cacheValues = [row.ApiEngineKey, row.Id, row.ApiAddress]
                .concat(String(row.ApiRoutes || '').split(';'));
            for (var cacheValueIndex = 0; cacheValueIndex < cacheValues.length; cacheValueIndex++) {
                var cacheValue = String(cacheValues[cacheValueIndex] || '').toLowerCase();
                if (!cacheValue) continue;
                V8.Cache.Remove('Microi:' + V8.OsClient + ':FormData:sys_apiengine:' + cacheValue);
            }
        };
        // PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1：包内 Managed 接口声明的主路由和
        // 多路由都属于本次选择的应用版本。其它接口若占用其中任一路由，只移除
        // 该路由并保留其记录、源码和其余路由，不能再把路由冲突抛给安装用户。
        var startupConfiguredRoutes = function (model) {
            model = model || {};
            var values = [model.ApiAddress].concat(String(model.ApiRoutes || '').split(';'));
            var routes = [];
            var seen = {};
            for (var routeIndex = 0; routeIndex < values.length; routeIndex++) {
                var route = String(values[routeIndex] || '').trim();
                var normalizedRoute = route.toLowerCase();
                if (!route || seen[normalizedRoute]) continue;
                seen[normalizedRoute] = true;
                routes.push(route);
            }
            return routes;
        };
        var reclaimStartupEngineRoutes = function (incoming, ownerId) {
            var claimedRoutes = startupConfiguredRoutes(incoming);
            if (claimedRoutes.length == 0) return;
            var claimed = {};
            for (var claimedIndex = 0; claimedIndex < claimedRoutes.length; claimedIndex++) {
                claimed[claimedRoutes[claimedIndex].toLowerCase()] = true;
            }
            var routeOwners = V8.Db.FromSql('SELECT * FROM sys_apiengine').ToArray() || [];
            for (var ownerIndex = 0; ownerIndex < routeOwners.length; ownerIndex++) {
                var routeOwner = routeOwners[ownerIndex] || {};
                if (ownerId && String(routeOwner.Id || '').toLowerCase() == String(ownerId).toLowerCase()) {
                    continue;
                }
                var oldAddress = String(routeOwner.ApiAddress || '').trim();
                var oldRoutes = String(routeOwner.ApiRoutes || '').split(';');
                var keptRoutes = [];
                var removedRoutes = [];
                if (oldAddress && claimed[oldAddress.toLowerCase()]) removedRoutes.push(oldAddress);
                for (var oldRouteIndex = 0; oldRouteIndex < oldRoutes.length; oldRouteIndex++) {
                    var oldRoute = String(oldRoutes[oldRouteIndex] || '').trim();
                    if (!oldRoute) continue;
                    if (claimed[oldRoute.toLowerCase()]) removedRoutes.push(oldRoute);
                    else keptRoutes.push(oldRoute);
                }
                if (removedRoutes.length == 0) continue;
                removeStartupEngineCacheAliases(routeOwner);
                var reclaimCount = V8.Db.FromSql(
                    'UPDATE sys_apiengine SET ApiAddress=@p1, ApiRoutes=@p2 WHERE Id=@p0'
                )
                    .AddInParameter('@p0', routeOwner.Id)
                    .AddInParameter('@p1', oldAddress && !claimed[oldAddress.toLowerCase()] ? oldAddress : null)
                    .AddInParameter('@p2', keptRoutes.length > 0 ? keptRoutes.join(';') : null)
                    .ExecuteNonQuery();
                if (Number(reclaimCount) != 1) {
                    throw new Error('启动接口收回包声明路由未命中唯一记录：'
                        + String(incoming.ApiEngineKey || incoming.Id));
                }
                startupIdentityRemapped.push(
                    String(incoming.ApiEngineKey || incoming.Id) + '：收回路由['
                    + removedRoutes.join('；') + ']，原接口='
                    + String(routeOwner.ApiEngineKey || routeOwner.Id)
                );
            }
        };
        var cacheStartupEngine = function (row) {
            if (!row) return;
            removeStartupEngineCacheAliases(row);
            var rowJson = JSON.stringify(row);
            var cacheValues = [row.ApiEngineKey, row.Id, row.ApiAddress]
                .concat(String(row.ApiRoutes || '').split(';'));
            for (var cacheValueIndex = 0; cacheValueIndex < cacheValues.length; cacheValueIndex++) {
                var cacheValue = String(cacheValues[cacheValueIndex] || '').toLowerCase();
                if (!cacheValue) continue;
                var cacheKey = 'Microi:' + V8.OsClient + ':FormData:sys_apiengine:' + cacheValue;
                V8.Cache.Remove(cacheKey);
                V8.Cache.Set(cacheKey, rowJson);
            }
        };
        for (var startupKeyIndex = 0; startupKeyIndex < startupApiKeys.length; startupKeyIndex++) {
            var startupApiKey = startupApiKeys[startupKeyIndex];
            var incomingStartupEngine = startupPackageEngineMap[startupApiKey];
            if (!incomingStartupEngine || !incomingStartupEngine.Id || !incomingStartupEngine.ApiAddress) {
                throw new Error('官方启动依赖包缺少接口定义：' + startupApiKey);
            }
            var existingStartupEngine = readStartupEngine('ApiEngineKey', startupApiKey);
            reclaimStartupEngineRoutes(
                incomingStartupEngine,
                existingStartupEngine && existingStartupEngine.Id
                    ? existingStartupEngine.Id
                    : null
            );
            if (existingStartupEngine && existingStartupEngine.Id) {
                if (Number(existingStartupEngine.IsDeleted || 0) == 1
                    || normalizeStartupSource(existingStartupEngine.ApiV8Code)
                        != normalizeStartupSource(incomingStartupEngine.ApiV8Code)) {
                    startupOverwritten.push(startupApiKey);
                }
                var startupUpdateModel = {};
                for (var startupUpdateKey in incomingStartupEngine) {
                    if (Object.prototype.hasOwnProperty.call(incomingStartupEngine, startupUpdateKey)) {
                        startupUpdateModel[startupUpdateKey] = incomingStartupEngine[startupUpdateKey];
                    }
                }
                startupUpdateModel.Id = existingStartupEngine.Id;
                startupUpdateModel.OsClient = V8.OsClient;
                startupUpdateModel.IsDeleted = 0;
                V8.Db.FromSql('UPDATE sys_apiengine SET IsDeleted=0 WHERE Id=@p0')
                    .AddInParameter('@p0', existingStartupEngine.Id)
                    .ExecuteNonQuery();
                var startupUpdateResult = runWriteWithRetry(function () {
                    return V8.FormEngine.UptFormData('sys_apiengine', startupUpdateModel);
                }, 'startup_api_upt_' + startupApiKey);
                if (!startupUpdateResult || startupUpdateResult.Code != 1) {
                    throw new Error('启动接口快速补正失败：' + startupApiKey + '，'
                        + writeResultMessage(startupUpdateResult));
                }
                var startupUpdatedRow = reconcileStartupRuntimeFlags(
                    incomingStartupEngine,
                    existingStartupEngine.Id
                );
                if (!startupUpdatedRow || String(startupUpdatedRow.ApiAddress || '')
                    != String(incomingStartupEngine.ApiAddress || '')) {
                    throw new Error('启动接口快速补正回读不一致：' + startupApiKey);
                }
                cacheStartupEngine(startupUpdatedRow);
                startupReconciled.push(startupApiKey);
                continue;
            }

            var startupIdCollision = readStartupEngine('Id', incomingStartupEngine.Id);
            var startupAddModel = {};
            for (var startupAddKey in incomingStartupEngine) {
                if (Object.prototype.hasOwnProperty.call(incomingStartupEngine, startupAddKey)) {
                    startupAddModel[startupAddKey] = incomingStartupEngine[startupAddKey];
                }
            }
            if (startupIdCollision && startupIdCollision.Id) {
                startupAddModel.Id = String(V8.Method.NewGuid());
                startupIdentityRemapped.push(startupApiKey + '：稳定Id已占用，使用新Id');
            }
            startupAddModel.OsClient = V8.OsClient;
            startupAddModel.IsDeleted = 0;
            var startupAddResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('sys_apiengine', startupAddModel);
            }, 'startup_api_add_' + startupApiKey);
            if (!startupAddResult || startupAddResult.Code != 1) {
                throw new Error('启动接口快速创建失败：' + startupApiKey + '，'
                    + writeResultMessage(startupAddResult));
            }
            var startupAddedRow = reconcileStartupRuntimeFlags(
                incomingStartupEngine,
                startupAddModel.Id
            );
            if (!startupAddedRow
                || String(startupAddedRow.Id || '').toLowerCase()
                    != String(startupAddModel.Id || '').toLowerCase()
                || String(startupAddedRow.ApiAddress || '') != String(incomingStartupEngine.ApiAddress || '')
                || normalizeStartupSource(startupAddedRow.ApiV8Code)
                    != normalizeStartupSource(incomingStartupEngine.ApiV8Code)) {
                throw new Error('启动接口快速创建回读不一致：' + startupApiKey);
            }
            cacheStartupEngine(startupAddedRow);
            startupAdded.push(startupApiKey);
        }
        backgroundCheckpoint.StartupApiBootstrapDone = true;
        backgroundCheckpoint.StartupApiBootstrapRevision = startupApiBootstrapRevision;
        debugLog.startup_api_fast_bootstrap = {
            Added: startupAdded,
            Reconciled: startupReconciled,
            Overwritten: startupOverwritten,
            IdentityRemapped: startupIdentityRemapped
        };
        if (startupDependencyBootstrapOnlyRequested) {
            return {
                Code: 1,
                Data: {
                    StartupDependencyBootstrapOnly: true,
                    PackageIdentity: startupPackageIdentity,
                    Added: startupAdded,
                    Reconciled: startupReconciled,
                    Overwritten: startupOverwritten,
                    IdentityRemapped: startupIdentityRemapped
                },
                Msg: '启动依赖接口已在完整应用安装前完成覆盖式快速自举。'
            };
        }
    }
    if (startupDependencyBootstrapOnlyRequested) {
        return {
            Code: 0,
            Data: {
                PackageIdentity: startupPackageIdentity,
                TrustedOfficialPlatformPackage: trustedOfficialPlatformPackage,
                BackgroundChunkingEnabled: backgroundChunkingEnabled
            },
            Msg: '启动接口快速自举只允许受信后台工作器调用固定官方应用商城/SaaS 包。'
        };
    }

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
        ApiEngineDuplicatesRetired: 0,
        ApiEngineHistoryMigrated: 0,
        ApiEngineHistorySkipped: 0,
        VersionRecordUpdated: 0,
        ApplicationInstalled: 0,
        ApplicationSourceFiles: 0,
        ApplicationSourceFilesReused: 0,
        ApplicationBuildAssets: 0,
        ApplicationBuildAssetsReused: 0,
        ApplicationInlineBuildAssets: 0,
        ApplicationRuntimeVerified: 0,
        ApplicationSharedRuntimes: 0,
        AssetRowsPruned: 0,
        MicroServicePages: 0,
        MicroServiceMenus: 0,
        MicroServiceMenusPreserved: 0,
        MicroServiceMenusRetired: 0,
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
        'PhysicalFieldsSkipped', 'PhysicalFieldsErrors',
        'ApplicationInstalled', 'ApplicationSourceFiles', 'ApplicationSourceFilesReused',
        'ApplicationBuildAssets', 'ApplicationBuildAssetsReused',
        'ApplicationInlineBuildAssets', 'ApplicationRuntimeVerified',
        'ApplicationSharedRuntimes', 'AssetRowsPruned',
        'MicroServicePages', 'MicroServiceMenus', 'MicroServiceMenusPreserved', 'MicroServiceMenusRetired',
        'MenuInserted', 'MenuUpdated', 'MenuIdRemapped',
        'AdminRoleLimitInserted', 'AdminRoleLimitUpdated', 'AdminRoleLimitSkipped',
        'ReferenceRowsUpdated', 'FlowInserted', 'FlowUpdated',
        'NodeInserted', 'NodeUpdated', 'LineInserted', 'LineUpdated',
        'ApiEngineInserted', 'ApiEngineUpdated', 'ApiEngineSkipped', 'ApiEngineDuplicatesRetired',
        'ApiEngineHistoryMigrated', 'ApiEngineHistorySkipped',
        'DataSetCount', 'DataInserted', 'DataUpdated', 'DataSkipped',
        'ScheduleJobSaved', 'VersionRecordUpdated'
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
            'LegacyComponentPaths', 'LegacyComponentPath', 'RetireLegacyMenus'
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
    var rewriteApplicationRuntimeContext = function (rootPath, relativePath, base64, serverHostedInline) {
        if (!/^(ai-app-publish|micro-app)\//i.test(String(rootPath || '')) || !/\.html?$/i.test(String(relativePath || ''))) {
            return base64;
        }
        var apiBase = firstTextParam([V8.SysConfig && V8.SysConfig.ApiBase]).replace(/\/+$/g, '');
        var microserviceRuntime = /^micro-app\//i.test(String(rootPath || ''));
        if (!apiBase && serverHostedInline !== true && !microserviceRuntime) {
            throw new Error('SysConfig.ApiBase不能为空，无法写入独立 Web/UniApp 应用运行时上下文；请在目标租户系统设置中配置实际 API 地址后重试。');
        }
        var contextJson = JSON.stringify({ ApiBase: apiBase, OsClient: String(V8.OsClient || '') })
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
        var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(String(base64 || '')));
        // DATABASE_INLINE_SERVING_API_CONTEXT_V1 / MICROSERVICE_HOST_RUNTIME_CONTEXT_V1：
        // 新租户与旧库还原可能没有 ApiBase 字段。微服务的文件无论存储在数据库
        // 还是 HDFS，都由宿主传入当前 API/租户；独立访问使用绑定该租户的 API
        // 稳定入口。禁止把 HDFS/CDN 域名、发布端上下文或另一租户当成目标 API。
        var resolveServingApi = !apiBase && (serverHostedInline === true || microserviceRuntime)
            ? 'var d=window.microApp&&typeof window.microApp.getData==="function"?window.microApp.getData():null;'
                + 'var a=d&&(d.apiBase||d.ApiBase);var t=d&&(d.osClient||d.OsClient);'
                + 'if(a){if(String(t||"").toLowerCase()!==c.OsClient.toLowerCase())throw new Error("微服务宿主与安装租户不一致");'
                + 'var h=new URL(a);if(!/^https?:$/.test(h.protocol)||h.username||h.password||h.search||h.hash)throw new Error("微服务宿主API地址无效");c.ApiBase=h.href.replace(/\\/+$/,"");}'
                + 'else{var u=new URL(window.__MICRO_APP_PUBLIC_PATH__||window.location.href);var p=u.pathname.indexOf("/micro-app/");'
                + 'var s=p<0?[]:u.pathname.substring(p+11).split("/");var tenant=s[0]==="v3"&&s[1]==="tenants"?s[2]:s[0];'
                + 'if(p<0||!/^https?:$/.test(u.protocol)||u.username||u.password||String(decodeURIComponent(tenant||"")).toLowerCase()!==c.OsClient.toLowerCase())'
                + 'throw new Error("无法识别微服务的API服务地址，请从目标租户系统打开，或在系统设置中配置ApiBase后重新安装");'
                + 'c.ApiBase=u.origin+u.pathname.substring(0,p);}'
            : '';
        var runtimeScript = '<script data-microi-runtime-context="true">(function(){var c=' + contextJson + ';' + resolveServingApi + 'window.__MICROI_APP_CONTEXT__=Object.assign({},window.__MICROI_APP_CONTEXT__||{},c);window.MICROI_API_BASE=c.ApiBase;window.MICROI_OS_CLIENT=c.OsClient;})();<\/script>';
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

    // SHARED_PUBLIC_RUNTIME_TENANT_LAUNCH_V1：共享不可变字节不能改写发布端 HTML。
    // 仅启动 URL 绑定目标配置，不改对象路径/摘要，也不把登录凭证写入 URL。
    var buildSharedApplicationLaunchUrl = function (entryUrl) {
        var apiBase = firstTextParam([V8.SysConfig && V8.SysConfig.ApiBase]).replace(/\/+$/g, '');
        var tenant = String(V8.OsClient || '').trim();
        if (!/^https?:\/\/[^\s\/?#@]+(?:\/[^\s?#]*)?$/i.test(apiBase)) {
            throw new Error('共享运行应用需要目标租户配置有效的 SysConfig.ApiBase；不能使用发布端或 CDN 地址作为业务 API。');
        }
        if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(tenant)) {
            throw new Error('共享运行应用缺少有效的目标租户标识。');
        }
        return entryUrl + '?apiBase=' + encodeURIComponent(apiBase) + '&OsClient=' + encodeURIComponent(tenant);
    };

    // PUBLIC_APPLICATION_ENTRY_URL_V1：公有运行文件不得持久化 OSS/S3 内网域名、
    // 临时签名或仅有目录的地址。对象 Key 才是事实源，浏览地址统一由当前租户
    // FileServer + 真实 Key 组成；这也让不同存储供应商的安装结果保持一致。
    var normalizePublicApplicationObjectPath = function (value) {
        var source = firstTextParam([value]).replace(/\\/g, '/');
        if (/^https?:\/\//i.test(source)) source = source.replace(/^https?:\/\/[^/]+/i, '');
        source = source.replace(/[?#][\s\S]*$/g, '');
        return normalizeApplicationPath(source);
    };

    var buildPublicApplicationAssetUrl = function (fileServer, value) {
        var objectPath = normalizePublicApplicationObjectPath(value);
        var server = firstTextParam([fileServer]).replace(/\/+$/g, '');
        if (!objectPath) return '';
        if (!server) return /^https?:\/\//i.test(String(value || ''))
            ? String(value).replace(/[?#][\s\S]*$/g, '')
            : '';
        return server + '/' + objectPath;
    };

    // STANDALONE_APPLICATION_LAUNCH_MENU_V1：Web/UniApp 包即使发布人漏选菜单，
    // 安装后也必须至少得到一个可直接使用的入口。包内已有 Iframe 菜单时只把
    // 发布端地址重绑到目标租户；没有时生成一个稳定 URL 身份的单菜单。生成 Id
    // 可变化，导入器会按 URL 映射到已安装菜单，因此重装/升级不会制造重复项。
    var ensureStandaloneApplicationLaunchMenus = function (packageModel, options) {
        packageModel = packageModel || {};
        options = options || {};
        var menus = packageModel.SysMenus || [];
        var bundles = [];
        var plural = packageModel.ApplicationBundles || [];
        for (var pluralIndex = 0; pluralIndex < plural.length; pluralIndex++) {
            if (plural[pluralIndex]) bundles.push(plural[pluralIndex]);
        }
        var singular = packageModel.ApplicationBundle || packageModel.AiApplication || packageModel.FrontendApplication;
        if (singular) bundles.push(singular);
        var fileServer = firstTextParam([options.FileServer]);
        var osClient = String(firstTextParam([options.OsClient])).toLowerCase();
        var generated = 0;
        var rebound = 0;

        for (var bundleIndex = 0; bundleIndex < bundles.length; bundleIndex++) {
            var bundle = bundles[bundleIndex] || {};
            var app = bundle.Application || bundle.App || {};
            var appType = firstTextParam([
                bundle.ApplicationType,
                app.ApplicationType,
                app.AppType,
                packageModel.PackageInfo && packageModel.PackageInfo.ApplicationType
            ]).toLowerCase();
            if (appType != 'web' && appType != 'uniapp') continue;
            var appKey = firstTextParam([
                app.AppKey,
                app.AppId,
                bundle.AppKey,
                packageModel.PackageInfo && packageModel.PackageInfo.AppId
            ]);
            if (!appKey) continue;
            var appName = firstTextParam([
                app.Name,
                app.AppName,
                packageModel.PackageInfo && packageModel.PackageInfo.Name,
                appKey
            ]);
            var sharedRuntime = bundle.SharedPublicRuntime || bundle.SharedRuntime || {};
            var entryUrl = firstTextParam([sharedRuntime.EntryUrl]);
            if (!entryUrl) {
                var entryPath = normalizeApplicationPath(firstTextParam([bundle.EntryPath, app.EntryPath, 'index.html']));
                var objectPath = normalizeApplicationPath(osClient + '/ai-app-publish/' + appKey + '/' + entryPath);
                entryUrl = buildPublicApplicationAssetUrl(fileServer, objectPath);
            }
            if (!/^https?:\/\/[^?#]+$/i.test(entryUrl)) continue;
            var launchUrl = '/iframe/' + entryUrl;
            var appKeyLower = String(appKey).toLowerCase();
            var iframeMenus = [];
            var matchedMenu = null;
            var namedParent = null;
            for (var menuIndex = 0; menuIndex < menus.length; menuIndex++) {
                var menu = menus[menuIndex] || {};
                var menuUrl = String(menu.Url || '');
                var isIframe = String(menu.OpenType || '').toLowerCase() == 'iframe'
                    || String(menu.ComponentPath || '').toLowerCase().indexOf('/iframe') >= 0
                    || menuUrl.toLowerCase().indexOf('/iframe/') == 0;
                if (isIframe) {
                    iframeMenus.push(menu);
                    if (menuUrl.toLowerCase().indexOf(appKeyLower) >= 0) matchedMenu = menu;
                } else if (!namedParent && String(menu.Name || '').toLowerCase() == String(appName).toLowerCase()) {
                    namedParent = menu;
                }
            }
            if (!matchedMenu && bundles.length == 1 && iframeMenus.length == 1) matchedMenu = iframeMenus[0];
            if (matchedMenu) {
                if (matchedMenu.Url != launchUrl) {
                    matchedMenu.Url = launchUrl;
                    rebound++;
                }
                matchedMenu.OpenType = 'Iframe';
                matchedMenu.ComponentPath = '/form-engine/diy-components/iframe';
                continue;
            }

            var newId = options.NewId ? String(options.NewId()) : '';
            if (!newId) continue;
            menus.push({
                Id: newId,
                Name: namedParent ? '在线使用' : appName,
                ParentId: namedParent && namedParent.Id
                    ? namedParent.Id
                    : (firstTextParam([options.InstallParentSysMenuId]) || null),
                Url: launchUrl,
                OpenType: 'Iframe',
                ComponentPath: '/form-engine/diy-components/iframe',
                ComponentName: '{}',
                DiyTableId: '',
                Display: 1,
                AppDisplay: 1,
                Sort: 0,
                Icon: 'fa fa-rocket',
                IsDeleted: 0
            });
            generated++;
        }
        packageModel.SysMenus = menus;
        return { Generated: generated, Rebound: rebound };
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

    // APPLICATION_FILE_SHA256_V2：运行文件 Hash 的口径必须是 Base64 解码后的
    // 原始字节，而不是 Base64 文本本身。部分存量服务器虽然允许 System.Convert，
    // 却没有向 Jint 暴露 System.Security.Cryptography.SHA256；这里用兼容 ES5 的
    // SHA-256 实现处理真实 byte[]，避免安装包反过来要求目标端先升级框架。
    var applicationFileSha256Bytes = function (bytes) {
        var byteLength = Number(bytes && bytes.Length !== undefined ? bytes.Length : (bytes ? bytes.length : 0));
        var totalLength = Math.floor((byteLength + 72) / 64) * 64;
        var bitLengthHigh = Math.floor(byteLength / 0x20000000) >>> 0;
        var bitLengthLow = (byteLength * 8) >>> 0;
        var constants = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        var hash = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ];
        var words = new Array(64);
        var rotateRight = function (value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        };
        var paddedByte = function (index) {
            if (index < byteLength) return Number(bytes[index]) & 255;
            if (index == byteLength) return 0x80;
            if (index < totalLength - 8) return 0;
            var trailerIndex = index - (totalLength - 8);
            if (trailerIndex < 4) return (bitLengthHigh >>> ((3 - trailerIndex) * 8)) & 255;
            return (bitLengthLow >>> ((7 - trailerIndex) * 8)) & 255;
        };

        for (var blockOffset = 0; blockOffset < totalLength; blockOffset += 64) {
            for (var wordIndex = 0; wordIndex < 16; wordIndex++) {
                var byteOffset = blockOffset + wordIndex * 4;
                words[wordIndex] = (
                    (paddedByte(byteOffset) << 24)
                    | (paddedByte(byteOffset + 1) << 16)
                    | (paddedByte(byteOffset + 2) << 8)
                    | paddedByte(byteOffset + 3)
                ) | 0;
            }
            for (var expandIndex = 16; expandIndex < 64; expandIndex++) {
                var word15 = words[expandIndex - 15];
                var word2 = words[expandIndex - 2];
                var sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
                var sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
                words[expandIndex] = (words[expandIndex - 16] + sigma0 + words[expandIndex - 7] + sigma1) | 0;
            }

            var a = hash[0] | 0;
            var b = hash[1] | 0;
            var c = hash[2] | 0;
            var d = hash[3] | 0;
            var e = hash[4] | 0;
            var f = hash[5] | 0;
            var g = hash[6] | 0;
            var h = hash[7] | 0;
            for (var roundIndex = 0; roundIndex < 64; roundIndex++) {
                var bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
                var choose = (e & f) ^ ((~e) & g);
                var temp1 = (h + bigSigma1 + choose + constants[roundIndex] + words[roundIndex]) | 0;
                var bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
                var majority = (a & b) ^ (a & c) ^ (b & c);
                var temp2 = (bigSigma0 + majority) | 0;
                h = g;
                g = f;
                f = e;
                e = (d + temp1) | 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) | 0;
            }
            hash[0] = (hash[0] + a) | 0;
            hash[1] = (hash[1] + b) | 0;
            hash[2] = (hash[2] + c) | 0;
            hash[3] = (hash[3] + d) | 0;
            hash[4] = (hash[4] + e) | 0;
            hash[5] = (hash[5] + f) | 0;
            hash[6] = (hash[6] + g) | 0;
            hash[7] = (hash[7] + h) | 0;
        }

        var result = '';
        for (var hashIndex = 0; hashIndex < hash.length; hashIndex++) {
            var hex = (hash[hashIndex] >>> 0).toString(16);
            result += ('00000000' + hex).substring(hex.length);
        }
        return result;
    };
    var applicationFileSha256Base64 = function (value) {
        var normalizedBase64 = String(value || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
        var bytes = System.Convert.FromBase64String(normalizedBase64);
        return applicationFileSha256Bytes(bytes);
    };

    var uploadApplicationAsset = function (rootPath, file, limit, rewriteRuntimeContext) {
        var relativePath = normalizeApplicationPath(file.Path || file.FilePath || file.RelativePath || file.FileName);
        if (!relativePath) throw new Error('应用资产路径不能为空');
        var base64 = firstTextParam([file.FileByteBase64, file.ContentBase64, file.Base64]);
        if (!base64 && file.Content !== undefined && file.Content !== null) {
            base64 = V8.Base64.StringToBase64(String(file.Content));
        }
        if (!base64) throw new Error('应用资产缺少文件内容：' + relativePath);
        var originalBase64 = base64;
        // 源码必须逐字节保真。只有真正的运行产物才注入目标租户上下文；
        // 否则源码 index.html 的包内摘要与落库摘要永远不同，后台分片会
        // 在同一个 AssetIndex 上反复上传，无法完成断点续装。
        if (rewriteRuntimeContext !== false) {
            base64 = rewriteApplicationRuntimeContext(rootPath, relativePath, base64);
        }
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
            var storageMessage = String((result && result.Msg) || '接口无返回');
            var storageScope = limit === true ? '私有源码桶' : '公有运行桶';
            var storageErrorType = /403|forbidden|accessdenied|access denied|permission/i.test(storageMessage)
                ? 'OBJECT_STORAGE_FORBIDDEN'
                : (/timeout|timed out|连接|network|endpoint|dns/i.test(storageMessage)
                    ? 'OBJECT_STORAGE_UNREACHABLE'
                    : 'OBJECT_STORAGE_UPLOAD_FAILED');
            var storageSolution = storageErrorType == 'OBJECT_STORAGE_FORBIDDEN'
                ? '请检查目标租户 SaaS 引擎中的 HDFS 类型、桶和 Endpoint 是否匹配，并为当前凭证补齐该对象前缀的读取存在性与写入权限（阿里云 OSS 通常需要 oss:GetObject、oss:PutObject；MinIO/S3 需要 s3:GetObject、s3:PutObject，桶级探测按网关策略补充 ListBucket/GetBucketLocation）。'
                : '请检查目标租户 SaaS 引擎的 HDFS/OSS/MinIO Endpoint、网络路由、桶是否存在及凭证是否完整，再用同一后台任务幂等重试。';
            throw new Error('HDFS 存储不可用或上传失败：' + relativePath
                + '；ErrorType=' + storageErrorType
                + '；StorageScope=' + storageScope
                + '；OsClient=' + String(V8.OsClient || '')
                + '；原始错误=' + storageMessage
                + '；解决方案=' + storageSolution);
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
            : applicationFileSha256Base64(base64);
        return { Path: relativePath, HdfsPath: hdfsPath, FilePathName: hdfsPath, Size: actualSize, Hash: actualHash };
    };

    var getApplicationRow = function (tableName, rowId, where) {
        if (rowId) {
            var existingById = V8.FormEngine.GetFormData(tableName, { Id: rowId, _PageSize: 1 });
            if (!existingById || (existingById.Code != 1 && existingById.Code != 2))
                throw new Error('读取应用资源失败：' + tableName + '；' + ((existingById && existingById.Msg) || '接口无返回'));
            if (existingById && existingById.Code == 1 && existingById.Data && existingById.Data.Id) {
                return existingById.Data;
            }
        }
        if (!where || !where.length) return null;
        var existingByWhere = V8.FormEngine.GetFormData(tableName, { _Where: where, _PageSize: 1 });
        if (!existingByWhere || (existingByWhere.Code != 1 && existingByWhere.Code != 2))
            throw new Error('读取应用资源失败：' + tableName + '；' + ((existingByWhere && existingByWhere.Msg) || '接口无返回'));
        return existingByWhere && existingByWhere.Code == 1 && existingByWhere.Data && existingByWhere.Data.Id
            ? existingByWhere.Data
            : null;
    };

    // 仅为新增安装资源补充目标字段已声明的常量开关默认值，不执行 DefaultValue 脚本，
    // 不覆盖包内显式的 0/false/null，也不改写既有资源的客户配置。
    var applyLiteralSwitchDefaults = function (menuModel, fields) {
        for (var defaultIndex = 0; defaultIndex < fields.length; defaultIndex++) {
            var field = fields[defaultIndex] || {};
            var fieldName = String(field.Name || '');
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)
                || String(field.Component || '').toLowerCase() != 'switch'
                || Object.prototype.hasOwnProperty.call(menuModel, fieldName)) continue;
            var value = String(field.DefaultValue == null ? '' : field.DefaultValue).trim().toLowerCase();
            if (value == '0' || value == 'false') menuModel[fieldName] = 0;
            else if (value == '1' || value == 'true') menuModel[fieldName] = 1;
        }
    };
    var newResourceDefaultFields = {};
    var getNewResourceSwitchDefaults = function (tableName) {
        if (newResourceDefaultFields[tableName]) return newResourceDefaultFields[tableName];
        var resourceTableResult = V8.FormEngine.GetFormData('diy_table', {
            _Where: [['Name', '=', tableName]], _SelectFields: ['Id']
        });
        if (!resourceTableResult || resourceTableResult.Code != 1 || !resourceTableResult.Data || !resourceTableResult.Data.Id) {
            throw new Error('读取安装资源表元数据失败：' + String(resourceTableResult && resourceTableResult.Msg || tableName + ' 不存在'));
        }
        var defaultsResult = V8.FormEngine.GetTableData('diy_field', {
            // TableName 是可空的冗余字段；真实字段归属始终使用 TableId。
            _Where: [['TableId', '=', resourceTableResult.Data.Id], ['Component', '=', 'Switch']],
            _SelectFields: ['Name', 'Component', 'DefaultValue'], _PageSize: 200
        });
        if (!defaultsResult || defaultsResult.Code != 1 || !defaultsResult.Data) {
            throw new Error('读取新增安装资源开关默认值失败：' + String(defaultsResult && defaultsResult.Msg || '接口无返回'));
        }
        newResourceDefaultFields[tableName] = defaultsResult.Data;
        return newResourceDefaultFields[tableName];
    };

    var upsertApplicationRow = function (tableName, where, row) {
        row = row || {};
        if (tableName == 'mci_ai_app_file') return persistApplicationAsset(row);
        var existing = getApplicationRow(tableName, row.Id, where);
        if (existing && existing.Id) {
            row.Id = existing.Id;
            return runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData(tableName, row);
            }, 'app_upt_' + tableName + '_' + row.Id);
        }
        applyLiteralSwitchDefaults(row, getNewResourceSwitchDefaults(tableName));
        return runWriteWithRetry(function () {
            return V8.FormEngine.AddFormData(tableName, row);
        }, 'app_add_' + tableName + '_' + (row.Id || 'new'));
    };

    // APPLICATION_ASSET_CURRENT_ROWS_V1：同一路径可同时有当前、暂存、归档文件。
    // 源码流发布以空 VersionId 表示当前文件；不可把暂存/历史版本用于续传、更新或清理。
    // 恢复列表与写入必须采用同一主库、同一范围和排序，不能列表取旧行而更新新行。
    var applicationAssetCurrentPredicate = function () {
        return '(' + quotePhysicalIdentifier('VersionId') + ' IS NULL OR '
            + quotePhysicalIdentifier('VersionId') + " = '') AND LOWER(COALESCE("
            + quotePhysicalIdentifier('StorageScope') + ", '')) NOT IN ('privatesourcestaged','privatesourcearchived')";
    };
    var readCurrentApplicationAssetRows = function (appId, filePath, includeDeleted) {
        var columns = ['Id', 'AppId', 'FilePath', 'HdfsPath', 'PublishHdfsPath', 'StorageScope', 'ContentHash', 'Size', 'VersionId', 'IsDeleted'];
        var projection = [];
        for (var columnIndex = 0; columnIndex < columns.length; columnIndex++) {
            var quotedColumn = quotePhysicalIdentifier(columns[columnIndex]);
            // 旧 MySQL CHAR(36) 会被 Connector/NET 自动按 Guid 物化；ULID 也是合法
            // 平台标识，读取身份列时显式投影为文本，兼容从旧资产检查点直接恢复。
            if (/^(Id|AppId|VersionId)$/.test(columns[columnIndex])) {
                projection.push((runtimeIsSqlServer ? 'CAST(' + quotedColumn + ' AS nvarchar(128))'
                    : (runtimeIsOracle ? 'CAST(' + quotedColumn + ' AS VARCHAR2(128))'
                    : 'CONCAT(' + quotedColumn + ", '')")) + ' AS ' + quotedColumn);
            } else projection.push(quotedColumn);
        }
        var sql = 'SELECT ' + (runtimeIsSqlServer ? 'TOP (20001) ' : '') + projection.join(',')
            + ' FROM ' + quotePhysicalIdentifier('mci_ai_app_file')
            + ' WHERE ' + quotePhysicalIdentifier('AppId') + '=@p0 AND ' + applicationAssetCurrentPredicate();
        if (!includeDeleted) sql += ' AND COALESCE(' + quotePhysicalIdentifier('IsDeleted') + ',0)=0';
        if (filePath !== undefined) sql += ' AND LOWER(' + quotePhysicalIdentifier('FilePath') + ')=LOWER(@p1)';
        sql += ' ORDER BY COALESCE(' + quotePhysicalIdentifier('IsDeleted') + ',0) ASC,'
            + 'CASE WHEN ' + quotePhysicalIdentifier('UpdateTime') + ' IS NULL AND '
            + quotePhysicalIdentifier('CreateTime') + ' IS NULL THEN 1 ELSE 0 END ASC,'
            + 'COALESCE(' + quotePhysicalIdentifier('UpdateTime') + ',' + quotePhysicalIdentifier('CreateTime') + ') DESC,'
            + quotePhysicalIdentifier('Id') + ' ASC';
        if (!runtimeIsSqlServer) sql += runtimeIsOracle ? ' FETCH FIRST 20001 ROWS ONLY' : ' LIMIT 20001';
        var query = (V8.DbTrans || V8.Db).FromSql(sql).AddInParameter('@p0', appId);
        if (filePath !== undefined) query = query.AddInParameter('@p1', filePath);
        var rows = query.ToArray();
        if (!rows || rows.length === undefined || rows.length > 20000) {
            throw new Error('APPLICATION_ASSET_METADATA_READ_FAILED：当前应用文件元数据返回格式错误或超过20000条，AppId=' + appId);
        }
        return rows;
    };

    var loadExistingApplicationAssets = function (appId) {
        var existingApplicationAssets = Object.create(null);
        if (!resumeInstall || !appId) return existingApplicationAssets;
        // APPLICATION_ASSET_METADATA_READ_REQUIRED_V1：读取失败不能当作没有文件，
        // 否则每片都会重复上传已提交对象，并把元数据故障伪装成安装进度。
        var rows;
        try { rows = readCurrentApplicationAssetRows(appId); }
        catch (readError) {
            throw new Error('APPLICATION_ASSET_METADATA_READ_FAILED：读取应用断点文件元数据失败，AppId='
                + appId + '；' + String(readError && readError.message || readError));
        }
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            var row = rows[rowIndex] || {};
            var path = normalizeApplicationPath(row.FilePath);
            // 新行在前，只保留第一次命中，旧重复行不能覆盖刚验证的当前行。
            if (path && !existingApplicationAssets[path.toLowerCase()]) existingApplicationAssets[path.toLowerCase()] = row;
        }
        return existingApplicationAssets;
    };

    var applicationAssetHasPathHash = null;
    var persistApplicationAsset = function (row) {
        // APPLICATION_ASSET_PRIMARY_WRITE_READBACK_V1：这是安装器自有的文件协议元数据。
        // 普通 FormEngine 在旧字段缓存下会静默丢弃未识别字段，且默认从库读可能滞后；
        // 固定表/列白名单以当前租户主库事务写入并回读。默认每片一文件，最多50个，
        // 查询只发生在实际写入时；不修改其它应用、暂存版本、历史记录或租户配置。
        var appId = String(row.AppId || '');
        var filePath = normalizeApplicationPath(row.FilePath);
        if (!appId || !filePath || !row.HdfsPath || !row.ContentHash) {
            throw new Error('APPLICATION_ASSET_METADATA_INVALID：应用文件缺少身份、路径或摘要：' + filePath);
        }
        var existingRows = readCurrentApplicationAssetRows(appId, filePath, true);
        var existing = existingRows.length ? existingRows[0] : null;
        var rowId = existing ? String(existing.Id) : String(V8.EncryptHelper.MD5Encrypt(
            'marketplace-file:' + String(V8.OsClient || '').toLowerCase() + ':' + appId.toLowerCase() + ':' + filePath.toLowerCase())).toLowerCase();
        var now = nowText('yyyy-MM-dd HH:mm:ss');
        var data = {
            AppId: appId, AppName: row.AppName || '', FilePath: filePath,
            FileName: row.FileName || applicationFileName(filePath), FileType: row.FileType || applicationFileType(filePath),
            HdfsPath: String(row.HdfsPath), PublishHdfsPath: row.PublishHdfsPath || null,
            StorageScope: row.StorageScope || 'Private', ContentHash: String(row.ContentHash).toLowerCase(),
            Size: Number(row.Size || 0), IsDirectory: 0, Version: Number(row.Version || 1),
            VersionId: null, IsDeleted: 0, UpdateTime: now
        };
        if (applicationAssetHasPathHash === null) {
            applicationAssetHasPathHash = false;
            var physicalColumns = runtimeIsOracle
                ? V8.Db.FromSql('SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME=UPPER(@p0)').AddInParameter('@p0', 'mci_ai_app_file').ToArray()
                : readTargetPhysicalColumns('mci_ai_app_file');
            for (var physicalIndex = 0; physicalIndex < physicalColumns.length; physicalIndex++) {
                if (String(getPhysicalValue(physicalColumns[physicalIndex], ['COLUMN_NAME', 'ColumnName', 'Name']) || '').toLowerCase() == 'filepathhash') applicationAssetHasPathHash = true;
            }
        }
        if (applicationAssetHasPathHash) data.FilePathHash = applicationFileSha256Base64(V8.Base64.StringToBase64(filePath));
        if (!existing) {
            data.Id = rowId;
            data.CreateTime = now;
            data.UserId = installUser.Id || '';
            data.UserName = installUser.Name || installUser.Account || '';
        }
        var names = Object.keys(data), assignments = [], values = [], quotedNames = [];
        for (var fieldIndex = 0; fieldIndex < names.length; fieldIndex++) {
            quotedNames.push(quotePhysicalIdentifier(names[fieldIndex]));
            assignments.push(quotePhysicalIdentifier(names[fieldIndex]) + '=@p' + fieldIndex);
            values.push('@p' + fieldIndex);
        }
        var sql = existing
            ? 'UPDATE ' + quotePhysicalIdentifier('mci_ai_app_file') + ' SET ' + assignments.join(',')
                + ' WHERE ' + quotePhysicalIdentifier('Id') + '=@id AND ' + quotePhysicalIdentifier('AppId') + '=@appId AND ' + applicationAssetCurrentPredicate()
            : 'INSERT INTO ' + quotePhysicalIdentifier('mci_ai_app_file') + ' (' + quotedNames.join(',') + ') VALUES (' + values.join(',') + ')';
        var query = (V8.DbTrans || V8.Db).FromSql(sql);
        for (var parameterIndex = 0; parameterIndex < names.length; parameterIndex++) query = query.AddInParameter('@p' + parameterIndex, data[names[parameterIndex]]);
        if (existing) query = query.AddInParameter('@id', rowId).AddInParameter('@appId', appId);
        query.ExecuteNonQuery();
        var verifiedRows = readCurrentApplicationAssetRows(appId, filePath);
        var verified = null;
        for (var verifyIndex = 0; verifyIndex < verifiedRows.length; verifyIndex++) {
            if (String(verifiedRows[verifyIndex].Id) == rowId) { verified = verifiedRows[verifyIndex]; break; }
        }
        if (!verified || String(verified.ContentHash || '').toLowerCase() != data.ContentHash
            || Number(verified.Size) != data.Size || String(verified.HdfsPath || '') != data.HdfsPath) {
            throw new Error('APPLICATION_ASSET_METADATA_WRITE_VERIFY_FAILED：写入文件元数据后主库回读不一致，AppId='
                + appId + '，FilePath=' + filePath + '，Id=' + rowId + '；检查点未推进。');
        }
        row.Id = rowId;
        return { Code: 1, Data: verified };
    };

    var reuseApplicationAsset = function (existingApplicationAssets, filePath, file, runtimeRoot) {
        if (!resumeInstall) return null;
        var normalizedPath = normalizeApplicationPath(filePath);
        var existing = existingApplicationAssets[normalizedPath.toLowerCase()];
        if (!existing || !existing.Id || !existing.HdfsPath) return null;
        var expectedHash = firstTextParam([file && file.Sha256, file && file.Hash, file && file.ContentHash]).toLowerCase();
        var actualHash = firstTextParam([existing.ContentHash]).toLowerCase();
        var expectedSize = Number((file && file.Size) || 0);
        // RUNTIME_CONTEXT_ASSET_RESUME_V1：入口 HTML 上传前会写入目标租户上下文，
        // 因此落库的是改写后字节的摘要。恢复时必须做同样的改写后再比较，不能拿
        // 发布端包内摘要反复否定刚上传的文件；源码及非 HTML 保持原摘要口径。
        if (runtimeRoot && /\.html?$/i.test(String(file && (file.Path || file.FilePath || file.RelativePath || file.FileName) || ''))) {
            var packagedBase64 = firstTextParam([file && file.FileByteBase64, file && file.ContentBase64, file && file.Base64]);
            if (!packagedBase64 && file && file.Content !== undefined && file.Content !== null) {
                packagedBase64 = V8.Base64.StringToBase64(String(file.Content));
            }
            if (!packagedBase64) return null;
            var runtimePath = normalizeApplicationPath(file.Path || file.FilePath || file.RelativePath || file.FileName);
            var rewrittenBase64 = rewriteApplicationRuntimeContext(runtimeRoot, runtimePath, packagedBase64);
            if (rewrittenBase64 != packagedBase64 || !expectedHash) {
                expectedHash = applicationFileSha256Base64(rewrittenBase64);
                expectedSize = base64DecodedSize(rewrittenBase64);
            }
        }
        if (expectedHash && actualHash != expectedHash) return null;
        var actualSize = Number(existing.Size || 0);
        if (expectedSize > 0 && actualSize != expectedSize) return null;
        if (!expectedHash && expectedSize <= 0) return null;
        return {
            Path: normalizedPath,
            HdfsPath: existing.HdfsPath,
            FilePathName: existing.HdfsPath,
            PublishHdfsPath: existing.PublishHdfsPath,
            StorageScope: existing.StorageScope,
            Size: actualSize,
            Hash: actualHash,
            Reused: true
        };
    };

    var pruneApplicationAssets = function (appId, expectedPaths) {
        if (!resumeInstall || !appId) return;
        var existingApplicationAssets = loadExistingApplicationAssets(appId);
        var staleIds = [];
        var preserveExistingPrivateSource = expectedPaths
            && expectedPaths.__PreserveExistingPrivateSource === true;
        for (var existingPath in existingApplicationAssets) {
            if (expectedPaths[existingPath]) continue;
            var existingAsset = existingApplicationAssets[existingPath] || {};
            var storageScope = String(existingAsset.StorageScope || '').toLowerCase();
            var normalizedExistingPath = normalizeApplicationPath(existingAsset.FilePath || existingPath).toLowerCase();
            var isPrivateSource = storageScope == 'private'
                || (normalizedExistingPath.indexOf('dist/') !== 0 && storageScope.indexOf('public') < 0);
            // RUNTIME_ONLY_PACKAGE_PRESERVES_SOURCE_V1：同一个平台微服务可能同时由多个
            // 官方应用包承载运行时基线。Source=NotIncluded 只表示本包不交付源码，绝不能
            // 删除目标租户已经由其它源码包安装的私有文件；显式包含源码的包仍按完整清单裁剪。
            if (preserveExistingPrivateSource && isPrivateSource) continue;
            staleIds.push(String(existingAsset.Id));
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
        // 历史公开包把绝对地址写在 Path；旧导入器遗漏该字段后
        // 误用目标租户去解析 iTdos 相对路径，导致“获取ZIP公开地址失败”。
        var direct = firstTextParam([asset.FullPath, asset.Url, asset.url, asset.FileUrl, asset.Path]);
        if (/^https?:\/\//i.test(direct)) return direct;
        var filePathName = firstTextParam([asset.FilePathName, asset.HdfsPath, asset.FilePath, asset.Path, direct]);
        if (!filePathName) throw new Error('ZIP资产缺少下载地址');
        var normalizedFilePathName = String(filePathName).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        var signedCandidates = [filePathName, normalizedFilePathName, '/' + normalizedFilePathName];
        for (var signedIndex = 0; signedIndex < signedCandidates.length; signedIndex++) {
            var signedCandidate = signedCandidates[signedIndex];
            if (!Object.prototype.hasOwnProperty.call(applicationAssetDownloadUrls, signedCandidate)) continue;
            var signedValue = applicationAssetDownloadUrls[signedCandidate] || {};
            var signedUrl = typeof signedValue == 'string'
                ? signedValue
                : firstTextParam([signedValue.Url, signedValue.url, signedValue.FileUrl, signedValue.FullPath, signedValue.Path]);
            if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
        }
        var storageScope = String(asset.StorageScope || asset.StorageMode || asset.Scope || '').toLowerCase();
        var privateAsset = asset.Limit === true || asset.Limit === 1
            || String(asset.Limit || '').toLowerCase() == 'true'
            || storageScope.indexOf('private') >= 0;
        var urlResult = V8.Method.GetPrivateFileUrl({
            OsClient: V8.OsClient,
            FilePathName: filePathName,
            Limit: privateAsset
        });
        if (!urlResult || urlResult.Code != 1) throw new Error('获取ZIP下载地址失败：' + filePathName);
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
        if (!url) throw new Error(role + ' ZIP 未返回下载地址');
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

    // APPLICATION_ARCHIVE_PATH_NORMALIZATION_V1：ZIP 允许重复文件名，而应用源码表
    // 以 AppId + FilePath 为唯一业务身份。若逐条安装同一路径的不同历史正文，后台
    // 分片会在两个摘要之间来回覆盖，永远无法越过该索引。这里按常规解压语义保留
    // 最后一个同名条目；同时忽略旧发布器误装入源码 ZIP 的 upload/* 发布历史。
    var normalizeApplicationArchiveFiles = function (files, assetKind) {
        var normalizedFiles = [];
        var indexByPath = {};
        var duplicateCount = 0;
        var sourceHistoryCount = 0;
        var input = files && files.length !== undefined ? files : [];
        for (var archiveIndex = 0; archiveIndex < input.length; archiveIndex++) {
            var archiveFile = input[archiveIndex] || {};
            var archivePath = normalizeApplicationPath(
                archiveFile.Path || archiveFile.FilePath || archiveFile.RelativePath || archiveFile.FileName
            );
            if (!archivePath) throw new Error((assetKind == 'Source' ? '源码' : '编译') + ' ZIP 包含空文件路径');
            var archivePathLower = archivePath.toLowerCase();
            if (assetKind == 'Source' && archivePathLower.indexOf('upload/') == 0) {
                sourceHistoryCount++;
                continue;
            }
            var archiveIdentity = 'path:' + archivePathLower;
            if (indexByPath[archiveIdentity] !== undefined) {
                normalizedFiles[indexByPath[archiveIdentity]] = archiveFile;
                duplicateCount++;
            } else {
                indexByPath[archiveIdentity] = normalizedFiles.length;
                normalizedFiles.push(archiveFile);
            }
        }
        if (duplicateCount > 0) {
            stats.ApplicationDuplicateAssetPathsCollapsed = Number(stats.ApplicationDuplicateAssetPathsCollapsed || 0) + duplicateCount;
        }
        if (sourceHistoryCount > 0) {
            stats.ApplicationSourceHistoryFilesSkipped = Number(stats.ApplicationSourceHistoryFilesSkipped || 0) + sourceHistoryCount;
        }
        return normalizedFiles;
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
        var assetStoragePolicy = bundle.AssetStoragePolicy || {};
        if (typeof assetStoragePolicy == 'string') {
            try { assetStoragePolicy = JSON.parse(assetStoragePolicy); }
            catch (assetStoragePolicyError) { throw new Error('AssetStoragePolicy 不是有效 JSON'); }
        }
        var sourceStoragePolicy = String(firstTextParam([
            assetStoragePolicy.Source,
            assetStoragePolicy.SourceMode,
            'PrivateHdfs'
        ])).replace(/^\s+|\s+$/g, '').toLowerCase();
        var buildStoragePolicy = String(firstTextParam([
            assetStoragePolicy.Build,
            assetStoragePolicy.BuildMode,
            'PublicHdfs'
        ])).replace(/^\s+|\s+$/g, '').toLowerCase();
        var sourceNotIncluded = /^(notincluded|not-included|none)$/i.test(sourceStoragePolicy);
        var databaseOnlyBuild = /^(databaseonly|database-only|db-only)$/i.test(buildStoragePolicy);
        var sharedPublicBuild = /^(sharedpublicruntime|shared-public-runtime|sharedruntime)$/i.test(buildStoragePolicy);
        var sharedRuntime = bundle.SharedPublicRuntime || bundle.SharedRuntime || {};
        if (!sourceNotIncluded && !/^(privatehdfs|private-hdfs|hdfs)$/i.test(sourceStoragePolicy)) {
            throw new Error('AssetStoragePolicy.Source 不受支持：' + sourceStoragePolicy);
        }
        if (!databaseOnlyBuild && !sharedPublicBuild && !/^(publichdfs|public-hdfs|privatehdfs|private-hdfs|hdfs)$/i.test(buildStoragePolicy)) {
            throw new Error('AssetStoragePolicy.Build 不受支持：' + buildStoragePolicy);
        }
        if (sharedPublicBuild && !sourceNotIncluded) {
            throw new Error('AssetStoragePolicy.Build=SharedPublicRuntime 时必须同时声明 Source=NotIncluded。');
        }
        var appKey = firstTextParam([app.AppKey, app.MsKey, V8.Param.AppId, Package.PackageInfo.AppId]);
        if (!appKey) throw new Error('ApplicationBundle.Application.AppKey 不能为空');
        // APPLICATION_ASSET_STABLE_APP_ID_V1：省略应用 Id 的旧包在文件上传结束后
        // 才写商城主行，前面的每个分片必须得到同一 Id，才能找到已提交的文件。
        var appId = firstTextParam([app.Id, bundle.AppId]);
        if (!appId) {
            appId = String(V8.EncryptHelper.MD5Encrypt('marketplace-application:'
                + String(V8.OsClient || '').toLowerCase() + ':' + appKey.toLowerCase())).toLowerCase();
        }
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
        var expectedApplicationPaths = {
            __PreserveExistingPrivateSource: sourceNotIncluded
        };
        var packageAssets = parsePackageAssets(bundle.PackageAssets || bundle.ZipAssets || null);
        // 真离线包优先使用 JSON 内嵌文件；没有内嵌文件时才兼容商城公网 ZIP。
        var embeddedSourceFiles = bundle.SourceFiles || bundle.Files || [];
        var sourceFiles = embeddedSourceFiles && embeddedSourceFiles.length !== undefined && embeddedSourceFiles.length
            ? embeddedSourceFiles
            : (packageAssets && packageAssets.SourceZip ? downloadApplicationZip(packageAssets.SourceZip, '源码') : []);
        sourceFiles = normalizeApplicationArchiveFiles(sourceFiles, 'Source');
        var sourceExpected = bundle.IncludeSource === true || bundle.IncludeSource === 1
            || String(bundle.IncludeSource || '').toLowerCase() == 'true'
            || Package.PackageInfo.IncludeSource === true || Package.PackageInfo.IncludeSource === 1
            || String(Package.PackageInfo.IncludeSource || '').toLowerCase() == 'true';
        if (sourceNotIncluded && (sourceExpected || (sourceFiles && sourceFiles.length))) {
            throw new Error('AssetStoragePolicy.Source=NotIncluded 时 IncludeSource 必须为 false 且 SourceFiles 必须为空，禁止伪装为已交付源码。');
        }
        if (sourceExpected && (!sourceFiles || !sourceFiles.length)) {
            throw new Error('安装包声明包含私有源码，但源码文件为空，已停止安装，避免只安装运行产物。');
        }
        var uploadedSource = [];
        reportProgress(60, '正在写入' + appType + '应用私有源码');
        var totalBundleAssets = sourceFiles.length;
        for (var i = 0; i < sourceFiles.length; i++) {
            var sourceFile = sourceFiles[i] || {};
            var sourcePath = normalizeApplicationPath(sourceFile.Path || sourceFile.FilePath || sourceFile.RelativePath || sourceFile.FileName);
            activeImportResource = appKey + ':Source:' + sourcePath;
            expectedApplicationPaths[sourcePath.toLowerCase()] = true;
            var sourceUpload = reuseApplicationAsset(existingApplicationAssets, sourcePath, sourceFile);
            if (!sourceUpload) {
                if (shouldContinueApplicationAssets(sourceFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'Source', i, totalBundleAssets);
                }
                sourceUpload = uploadApplicationAsset(sourceRoot, sourceFile, true, false);
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

        // PACKAGE_RUNTIME_VERSION_SEPARATION_V1：商城发行版可以只更新菜单、说明或
        // 声明式资源并继续复用已经验签的运行时。sys_microistore.AppVersion 表示
        // 本次安装包版本，用于商城更新状态；mci_ai_app_version.VersionNo 继续表示
        // 实际运行时版本。两者只有在重新构建应用时才必然相同。
        var packageVersionNo = firstTextParam([
            Package.PackageInfo.Version,
            Package.PackageInfo.AppVersion,
            V8.Param.AppVersion,
            bundle.VersionNo,
            app.BuildVersion,
            'v1.0.0'
        ]);
        var versionNo = firstTextParam([bundle.VersionNo, app.BuildVersion, packageVersionNo, 'v1.0.0']);
        if (versionNo.charAt(0).toLowerCase() != 'v') versionNo = 'v' + versionNo;
        var sharedEntryUrl = sharedPublicBuild ? firstTextParam([sharedRuntime.EntryUrl]) : '';
        var sharedBaseUrl = sharedPublicBuild ? firstTextParam([sharedRuntime.BaseUrl]) : '';
        var sharedManifestHash = sharedPublicBuild ? firstTextParam([sharedRuntime.ManifestHash]).toLowerCase() : '';
        var sharedRuntimeVersion = sharedPublicBuild ? firstTextParam([sharedRuntime.VersionNo, versionNo]) : '';
        if (sharedPublicBuild) {
            if (!/^https:\/\/[^?#]{1,2040}$/i.test(sharedEntryUrl)) {
                throw new Error('SharedPublicRuntime.EntryUrl 必须是无查询参数和片段的 HTTPS 地址。');
            }
            if (!/^[a-f0-9]{64}$/i.test(sharedManifestHash)) {
                throw new Error('SharedPublicRuntime.ManifestHash 必须是 64 位十六进制摘要。');
            }
            if (sharedRuntimeVersion.toLowerCase() != versionNo.toLowerCase()
                || sharedEntryUrl.toLowerCase().indexOf('/' + versionNo.toLowerCase() + '/') < 0) {
                throw new Error('SharedPublicRuntime.EntryUrl 必须固定到当前 VersionNo 的不可变目录。');
            }
            if (sharedBaseUrl && (!/^https:\/\/[^?#]{1,2040}$/i.test(sharedBaseUrl)
                || sharedEntryUrl.toLowerCase().indexOf(sharedBaseUrl.replace(/\/+$/g, '').toLowerCase() + '/') != 0)) {
                throw new Error('SharedPublicRuntime.BaseUrl 必须是 EntryUrl 的 HTTPS 父路径。');
            }
        }
        var buildRoot = appType == 'MicroService'
            ? 'micro-app/' + appKey + '/' + versionNo
            : 'ai-app-publish/' + appKey + '/versions/' + versionNo;
        var embeddedBuildAssets = bundle.BuildAssets || bundle.Assets || [];
        var buildAssets = sharedPublicBuild
            ? []
            : (embeddedBuildAssets && embeddedBuildAssets.length !== undefined && embeddedBuildAssets.length
            ? embeddedBuildAssets
            : (packageAssets && packageAssets.BuildZip ? downloadApplicationZip(packageAssets.BuildZip, '编译') : []));
        buildAssets = normalizeApplicationArchiveFiles(buildAssets, 'Build');
        if (databaseOnlyBuild) {
            if (appType != 'MicroService' || !inlineRuntimeBuild) {
                throw new Error('AssetStoragePolicy.Build=DatabaseOnly 仅支持 StorageMode=db 的 MicroService。');
            }
            if (buildAssets.length > 256) {
                throw new Error('数据库内联运行包最多允许 256 个编译文件，当前为 ' + buildAssets.length + ' 个；请修复 HDFS 后使用 PublicHdfs。');
            }
            var databaseOnlyBuildBytes = 0;
            for (var databaseOnlyIndex = 0; databaseOnlyIndex < buildAssets.length; databaseOnlyIndex++) {
                var databaseOnlyFile = buildAssets[databaseOnlyIndex] || {};
                var databaseOnlyBase64 = firstTextParam([
                    databaseOnlyFile.FileByteBase64,
                    databaseOnlyFile.ContentBase64,
                    databaseOnlyFile.Base64
                ]);
                if (!databaseOnlyBase64 && databaseOnlyFile.Content !== undefined && databaseOnlyFile.Content !== null) {
                    databaseOnlyBase64 = V8.Base64.StringToBase64(String(databaseOnlyFile.Content));
                }
                if (!databaseOnlyBase64) {
                    throw new Error('数据库内联运行包缺少编译文件内容：' + normalizeApplicationPath(databaseOnlyFile.Path || databaseOnlyFile.FileName));
                }
                databaseOnlyBuildBytes += base64DecodedSize(databaseOnlyBase64);
            }
            if (databaseOnlyBuildBytes > 5 * 1024 * 1024) {
                throw new Error('数据库内联运行包总大小不能超过 5MB，当前为 ' + databaseOnlyBuildBytes + ' bytes；请修复 HDFS 后使用 PublicHdfs。');
            }
        }
        totalBundleAssets += sharedPublicBuild ? 1 : buildAssets.length;
        var uploadedBuild = [];
        var runtimeDbAssets = [];
        var useDatabaseOnlyBuild = typeof databaseOnlyBuild != 'undefined' && databaseOnlyBuild === true;
        var useSharedPublicBuild = typeof sharedPublicBuild != 'undefined' && sharedPublicBuild === true;
        if (useSharedPublicBuild) {
            var sharedEntryPath = firstTextParam([bundle.EntryPath, app.EntryPath, 'index.html']);
            uploadedBuild.push({
                Path: normalizeApplicationPath(sharedEntryPath),
                HdfsPath: sharedEntryUrl,
                FilePathName: sharedEntryUrl,
                PublishHdfsPath: sharedEntryUrl,
                Size: Number(sharedRuntime.TotalSize || 0),
                Hash: sharedManifestHash,
                SharedPublicRuntime: true
            });
            stats.ApplicationSharedRuntimes++;
        }
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
        reportProgress(65, useSharedPublicBuild
            ? '正在登记不可变共享公共运行时'
            : (useDatabaseOnlyBuild
            ? '正在写入' + appType + '应用数据库内联运行文件'
            : '正在写入' + appType + '应用公有编译文件'));
        for (var b = 0; b < buildAssets.length; b++) {
            var buildFile = buildAssets[b] || {};
            var buildRelativePath = normalizeApplicationPath(buildFile.Path || buildFile.FilePath || buildFile.RelativePath || buildFile.FileName);
            activeImportResource = appKey + ':Build:' + buildRelativePath;
            var buildMetadataPath = 'dist/' + buildRelativePath;
            if (!useDatabaseOnlyBuild) expectedApplicationPaths[buildMetadataPath.toLowerCase()] = true;
            var runtimeBuildBase64 = '';
            if (inlineRuntimeBuild) {
                runtimeBuildBase64 = firstTextParam([buildFile.FileByteBase64, buildFile.ContentBase64, buildFile.Base64]);
                if (!runtimeBuildBase64 && buildFile.Content !== undefined && buildFile.Content !== null) {
                    runtimeBuildBase64 = V8.Base64.StringToBase64(String(buildFile.Content));
                }
                if (!runtimeBuildBase64) {
                    throw new Error('DB运行模式缺少内嵌编译内容：' + buildRelativePath);
                }
                runtimeBuildBase64 = rewriteApplicationRuntimeContext(buildRoot, buildRelativePath, runtimeBuildBase64, useDatabaseOnlyBuild);
            }
            var buildUpload = useDatabaseOnlyBuild
                ? null
                : reuseApplicationAsset(existingApplicationAssets, buildMetadataPath, buildFile, buildRoot);
            var buildWasReused = !!buildUpload;
            // MOVE_OBJECT_UNAVAILABLE_RESUME_V1：部分历史节点能够上传并读取公有对象，
            // 但尚未实现 MoveObject，或存储账号只有 Put/Get 而没有 Move/Delete 权限。
            // 首次稳定路径移动失败后会保留刚上传且摘要已校验的真实对象，并在
            // StorageScope 中持久化回退标记；后续分片直接复用该对象，禁止每片
            // 重传同一文件、AssetIndex 永远停在 1。未带标记的历史旧 Key 仍会
            // 先重传一次并尝试修复，兼顾旧脏路径自愈与旧存储节点兼容。
            var buildMoveFallbackScope = 'PrivateSource+PublicBuildMoveFallback';
            var buildUsesPersistedMoveFallback = buildWasReused
                && String(buildUpload.StorageScope || '').toLowerCase()
                    == buildMoveFallbackScope.toLowerCase();
            var reusedBuildHdfsPath = buildWasReused ? normalizeApplicationPath(buildUpload.HdfsPath).toLowerCase() : '';
            if (useDatabaseOnlyBuild) {
                // DATABASE_ONLY_BUILD_ASSETS_V1：仅当包清单显式声明 DatabaseOnly、
                // MicroService 使用 StorageMode=db 且完整字节不超过 256 文件/5MB 时，
                // 才允许完全绕开目标租户 HDFS。普通应用仍保持 fail-closed。
                var packagedBuildBase64 = firstTextParam([buildFile.FileByteBase64, buildFile.ContentBase64, buildFile.Base64]);
                if (!packagedBuildBase64 && buildFile.Content !== undefined && buildFile.Content !== null) {
                    packagedBuildBase64 = V8.Base64.StringToBase64(String(buildFile.Content));
                }
                var databaseRuntimeChanged = runtimeBuildBase64 != packagedBuildBase64;
                var databaseBuildHash = firstTextParam([buildFile.Sha256, buildFile.Hash, buildFile.ContentHash]).toLowerCase();
                if (databaseRuntimeChanged || !databaseBuildHash) {
                    databaseBuildHash = applicationFileSha256Base64(runtimeBuildBase64);
                }
                buildUpload = {
                    Path: buildRelativePath,
                    HdfsPath: '',
                    FilePathName: '',
                    Size: databaseRuntimeChanged ? base64DecodedSize(runtimeBuildBase64) : Number(buildFile.Size || base64DecodedSize(runtimeBuildBase64)),
                    Hash: databaseBuildHash,
                    DatabaseInline: true
                };
                stats.ApplicationInlineBuildAssets++;
            } else if (buildWasReused) {
                buildUpload.Path = buildRelativePath;
                stats.ApplicationBuildAssetsReused++;
            } else {
                if (shouldContinueApplicationAssets(buildFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'Build', b, totalBundleAssets, sourceFiles.length + b);
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
            var buildPathRepaired = useDatabaseOnlyBuild
                ? false
                : (buildUsesPersistedMoveFallback ? false : moveBuildToStablePath(buildUpload, stableBuildPath));
            // SKIP_MOVE_FOR_REUSED_BUILD_V1：已处于当前租户稳定 Key 的断点资产不重复移动。
            // 旧版错误 Key 若已被移动或删除，则从本次自包含包重传，再尝试写入正确 Key。
            if (!useDatabaseOnlyBuild && buildWasReused
                && !buildUsesPersistedMoveFallback && !buildPathRepaired) {
                if (shouldContinueApplicationAssets(buildFile)) {
                    return buildApplicationAssetContinuation(bundleIndex, 'BuildRepair', b, totalBundleAssets, sourceFiles.length + b);
                }
                buildUpload = uploadApplicationAsset(buildRoot, buildFile, false);
                markApplicationAssetUploaded(buildFile);
                buildUpload.Path = buildRelativePath;
                stats.ApplicationBuildAssetsReused--;
                buildWasReused = false;
                moveBuildToStablePath(buildUpload, stableBuildPath);
            }
            var buildUsesMoveFallback = !useDatabaseOnlyBuild && !buildPathRepaired
                && normalizeApplicationPath(buildUpload.HdfsPath) != stableBuildPath;
            uploadedBuild.push(buildUpload);
            // DB_RUNTIME_BUILD_ASSETS_V1：目标环境的 FileServer/CDN 可能与开发环境不同。
            // 离线包显式选择 db/database 时，把编译产物同步写入同源运行清单。
            // 默认策略仍保留 HDFS 副本；只有受限的 DatabaseOnly 策略不写对象存储。
            if (inlineRuntimeBuild) {
                runtimeDbAssets.push({
                    Path: normalizedBuildPath,
                    FileName: buildFile.FileName || applicationFileName(normalizedBuildPath),
                    ContentType: buildFile.ContentType || '',
                    ContentBase64: runtimeBuildBase64,
                    Size: buildUpload.Size,
                    Hash: buildUpload.Hash,
                    IsEntry: buildFile.IsEntry === true || buildFile.IsEntry === 1
                        || normalizedBuildPath.toLowerCase() == normalizeApplicationPath(firstTextParam([
                            bundle.EntryPath,
                            app.EntryPath,
                            'index.html'
                        ])).toLowerCase()
                });
            }
            if (useDatabaseOnlyBuild) continue;
            if (buildWasReused
                && ((buildPathRepaired && reusedBuildHdfsPath == stableBuildPath.toLowerCase())
                    || buildUsesPersistedMoveFallback)) continue;
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
                StorageScope: buildUsesMoveFallback
                    ? buildMoveFallbackScope
                    : 'PrivateSource+PublicBuild',
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
        var previewUrl = useSharedPublicBuild
            ? buildSharedApplicationLaunchUrl(sharedEntryUrl)
            : buildPublicApplicationAssetUrl(V8.SysConfig && V8.SysConfig.FileServer, entryHdfsPath);
        if (useDatabaseOnlyBuild && inlineRuntimeBuild) {
            previewUrl = '/micro-app/' + encodeURIComponent(String(V8.OsClient || ''))
                + '/' + encodeURIComponent(appKey) + '/index.html';
        }
        if (!previewUrl && entryHdfsPath && !/^https?:\/\//i.test(entryHdfsPath) && V8.Method.GetPrivateFileUrl) {
            var urlResult = V8.Method.GetPrivateFileUrl({ OsClient: V8.OsClient, FilePathName: entryHdfsPath, Limit: false });
            if (urlResult && urlResult.Code == 1) {
                var urlData = urlResult.Data || {};
                previewUrl = typeof urlData == 'string' ? urlData : firstTextParam([urlData.Url, urlData.url, urlData.FileUrl, urlData.Path, entryHdfsPath]);
            }
        }
        var installedPublicPublishPath = useSharedPublicBuild
            ? firstTextParam([sharedBaseUrl, sharedEntryUrl])
            : (useDatabaseOnlyBuild
                ? buildRoot
                : (applicationFileDir(normalizePublicApplicationObjectPath(entryHdfsPath)) || buildRoot) + '/');

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
            AppVersion: packageVersionNo,
            IsApprove: uploadedBuild.length ? 1 : 0,
            PreviewUrl: previewUrl,
            PrivateSourcePath: uploadedSource.length ? sourceRoot : firstTextParam([existingApp && existingApp.PrivateSourcePath, app.PrivateSourcePath]),
            PublicPublishPath: installedPublicPublishPath
        };
        // DATABASE_ONLY_PUBLISH_POINTER_RESET_V1：数据库内联运行时属于目标租户
        // 本地投影。空库从官方种子复制时可能带入另一租户的 v3 committed pointer；
        // 若继续保留，稳定入口会在读取 sys_microiservice 前按错误指针失败关闭。
        // DatabaseOnly 安装必须显式降回本租户可验证的 v2 管理入口，并清空全部
        // committed pointer 字段；历史版本行保留作审计，不参与当前入口解析。
        if (useDatabaseOnlyBuild) {
            appRow.PublishProtocolVersion = 2;
            appRow.PublishState = 'LegacyUnverified';
            appRow.PublishFence = 0;
            appRow.PublishRowVersion = 0;
            appRow.ActivePublishVersionId = null;
            appRow.CommittedPublishVersionId = null;
            appRow.CommittedRuntimeManifestHash = null;
        }
        var appResult = upsertApplicationRow('sys_microistore', [['AppKey', '=', appKey]], appRow);
        if (!appResult || appResult.Code != 1) throw new Error('写入统一应用商城失败：' + ((appResult && appResult.Msg) || ''));
        if (useDatabaseOnlyBuild) {
            var pointerResetCount = V8.Db.FromSql(
                    'UPDATE sys_microistore SET PublishProtocolVersion=2, PublishState=@p0, PublishFence=0, PublishRowVersion=0, ActivePublishVersionId=NULL, CommittedPublishVersionId=NULL, CommittedRuntimeManifestHash=NULL WHERE Id=@p1 AND LOWER(AppKey)=LOWER(@p2)'
                )
                .AddInParameter('@p0', 'LegacyUnverified')
                .AddInParameter('@p1', appId)
                .AddInParameter('@p2', appKey)
                .ExecuteNonQuery();
            if (Number(pointerResetCount) != 1) {
                throw new Error('数据库内置微服务发布指针清理未命中唯一应用：' + appKey);
            }
            var pointerRows = V8.Db.FromSql(
                    'SELECT PublishProtocolVersion, PublishState, PublishFence, PublishRowVersion, ActivePublishVersionId, CommittedPublishVersionId, CommittedRuntimeManifestHash FROM sys_microistore WHERE Id=@p0 AND LOWER(AppKey)=LOWER(@p1)'
                )
                .AddInParameter('@p0', appId)
                .AddInParameter('@p1', appKey)
                .ToArray();
            var pointerRow = pointerRows && pointerRows.length == 1 ? pointerRows[0] : null;
            if (!pointerRow
                || Number(pointerRow.PublishProtocolVersion) != 2
                || String(pointerRow.PublishState || '') != 'LegacyUnverified'
                || Number(pointerRow.PublishFence || 0) != 0
                || Number(pointerRow.PublishRowVersion || 0) != 0
                || firstTextParam([
                    pointerRow.ActivePublishVersionId,
                    pointerRow.CommittedPublishVersionId,
                    pointerRow.CommittedRuntimeManifestHash
                ])) {
                throw new Error('数据库内置微服务发布指针清理后强回读不一致：' + appKey);
            }
            debugLog['database_only_pointer_reset_' + appKey] = '已清理跨租户 v3 pointer，并切换为本租户数据库运行时';
        }
        if (sourceExpected) {
            var installedSources = readCurrentApplicationAssetRows(appId);
            var installedPrivateSourceCount = 0;
            for (var sourceCheckIndex = 0; sourceCheckIndex < installedSources.length; sourceCheckIndex++) {
                if (String(installedSources[sourceCheckIndex].StorageScope || '').toLowerCase() == 'private') installedPrivateSourceCount++;
            }
            if (!installedPrivateSourceCount) {
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
                PublishPath: installedPublicPublishPath,
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
            // VERIFIED_RUNTIME_NO_SILENT_DOWNGRADE_V1：多个官方应用可以共享同一个
            // 平台微服务。旧应用包不得把已经完整内联到数据库的运行时静默覆盖回
            // file/HDFS，否则一次无关应用升级就会让所有共享页面重新变成 404。
            if (existingService
                && /^(db|database)$/i.test(String(existingService.StorageMode || ''))
                && !inlineRuntimeBuild) {
                throw new Error('拒绝将已验证的数据库内置微服务降级为文件运行时：' + appKey
                    + '；请重新发布当前应用，并使用 AssetStoragePolicy.Build=DatabaseOnly。');
            }
            var serviceRow = {
                MsKey: appKey,
                MsName: appName,
                MsType: firstTextParam([ms.MsType, '前端']),
                Runtime: firstTextParam([ms.Runtime, 'micro-app']),
                StorageMode: runtimeStorageMode,
                MsUrl: inlineRuntimeBuild ? 'db' : firstTextParam([ms.MsUrl, 'file']),
                IsEnable: ms.IsEnable === 0 ? 0 : 1,
                SourceDirName: firstTextParam([ms.SourceDirName, appKey]),
                EntryPath: entryPath,
                BuildVersion: versionNo,
                AssetCount: uploadedBuild.length,
                AssetsJson: JSON.stringify(inlineRuntimeBuild ? runtimeDbAssets : uploadedBuild),
                AssetManifestJson: JSON.stringify({
                    MsKey: appKey,
                    BuildVersion: versionNo,
                    EntryPath: entryPath,
                    StorageMode: runtimeStorageMode,
                    Assets: uploadedBuild
                }),
                PublishTime: nowText('yyyy-MM-dd HH:mm:ss')
            };
            var installedRuntimeSummary = inlineRuntimeBuild ? summarizeInstalledRuntimeAssets(runtimeDbAssets) : null;
            if (installedRuntimeSummary) {
                serviceRow.DistHash = installedRuntimeSummary.DistHash;
                serviceRow.TotalSize = installedRuntimeSummary.TotalSize;
                var installedRuntimeManifest = JSON.parse(serviceRow.AssetManifestJson);
                installedRuntimeManifest.RuntimeManifestHash = installedRuntimeSummary.DistHash;
                installedRuntimeManifest.TotalSize = installedRuntimeSummary.TotalSize;
                serviceRow.AssetManifestJson = JSON.stringify(installedRuntimeManifest);
            }
            if (existingService && existingService.Id) {
                serviceRow.Id = existingService.Id;
            } else if (ms.Id) {
                serviceRow.Id = ms.Id;
            }
            var serviceResult = upsertApplicationRow('sys_microiservice', [['MsKey', '=', appKey]], serviceRow);
            if (!serviceResult || serviceResult.Code != 1) throw new Error('写入微服务运行元数据失败：' + ((serviceResult && serviceResult.Msg) || ''));
            var serviceData = V8.FormEngine.GetFormData('sys_microiservice', {
                _Where: [['MsKey', '=', appKey]],
                _SelectFields: ['Id', 'MsKey', 'StorageMode', 'MsUrl', 'EntryPath', 'BuildVersion', 'AssetCount', 'AssetsJson', 'DistHash', 'TotalSize']
            });
            if (!serviceData || serviceData.Code != 1 || !serviceData.Data || !serviceData.Data.Id) {
                throw new Error('微服务运行元数据写后回读失败：' + appKey);
            }
            var installedService = serviceData.Data;
            if (String(installedService.MsKey || '').toLowerCase() != String(appKey || '').toLowerCase()
                || String(installedService.EntryPath || '').toLowerCase() != String(entryPath || '').toLowerCase()
                || String(installedService.BuildVersion || '') != String(versionNo || '')) {
                throw new Error('微服务运行元数据写后回读不一致：' + appKey);
            }
            if (inlineRuntimeBuild) {
                if (String(installedService.DistHash || '').toLowerCase() !== installedRuntimeSummary.DistHash
                    || Number(installedService.TotalSize) !== installedRuntimeSummary.TotalSize) {
                    throw new Error('数据库内置微服务运行摘要写后回读不一致：' + appKey);
                }
                if (!/^(db|database)$/i.test(String(installedService.StorageMode || ''))
                    || !/^(db|database)$/i.test(String(installedService.MsUrl || ''))) {
                    throw new Error('数据库内置微服务写后回读未保持 StorageMode=db、MsUrl=db：' + appKey);
                }
                var installedRuntimeAssets = [];
                try { installedRuntimeAssets = JSON.parse(String(installedService.AssetsJson || '[]')); }
                catch (runtimeReadbackParseError) {
                    throw new Error('数据库内置微服务 AssetsJson 写后回读不是有效 JSON：' + appKey);
                }
                if (!installedRuntimeAssets || installedRuntimeAssets.length != runtimeDbAssets.length
                    || Number(installedService.AssetCount || 0) != runtimeDbAssets.length) {
                    throw new Error('数据库内置微服务资产数量写后回读不一致：' + appKey
                        + '，期望' + runtimeDbAssets.length + '个，实际'
                        + (installedRuntimeAssets ? installedRuntimeAssets.length : 0) + '个');
                }
                var installedEntryVerified = false;
                for (var runtimeReadbackIndex = 0; runtimeReadbackIndex < runtimeDbAssets.length; runtimeReadbackIndex++) {
                    var expectedRuntimeAsset = runtimeDbAssets[runtimeReadbackIndex] || {};
                    var expectedRuntimePath = normalizeApplicationPath(expectedRuntimeAsset.Path).toLowerCase();
                    var installedRuntimeAsset = null;
                    for (var installedAssetIndex = 0; installedAssetIndex < installedRuntimeAssets.length; installedAssetIndex++) {
                        var candidateRuntimeAsset = installedRuntimeAssets[installedAssetIndex] || {};
                        if (normalizeApplicationPath(candidateRuntimeAsset.Path).toLowerCase() == expectedRuntimePath) {
                            installedRuntimeAsset = candidateRuntimeAsset;
                            break;
                        }
                    }
                    if (!installedRuntimeAsset) throw new Error('数据库内置微服务写后回读缺少资产：' + expectedRuntimePath);
                    var installedRuntimeBase64 = firstTextParam([
                        installedRuntimeAsset.ContentBase64,
                        installedRuntimeAsset.FileByteBase64,
                        installedRuntimeAsset.Base64
                    ]);
                    if (!installedRuntimeBase64) throw new Error('数据库内置微服务写后回读缺少完整字节：' + expectedRuntimePath);
                    var installedRuntimeSize = base64DecodedSize(installedRuntimeBase64);
                    if (installedRuntimeSize <= 0 || installedRuntimeSize != Number(expectedRuntimeAsset.Size || 0)) {
                        throw new Error('数据库内置微服务写后回读大小不一致：' + expectedRuntimePath);
                    }
                    var expectedRuntimeHash = firstTextParam([
                        expectedRuntimeAsset.Hash,
                        expectedRuntimeAsset.Sha256,
                        expectedRuntimeAsset.ContentHash
                    ]).toLowerCase();
                    var installedRuntimeHash = firstTextParam([
                        installedRuntimeAsset.Hash,
                        installedRuntimeAsset.Sha256,
                        installedRuntimeAsset.ContentHash
                    ]).toLowerCase();
                    var installedRuntimeContentHash = applicationFileSha256Base64(installedRuntimeBase64);
                    if (!installedRuntimeHash || installedRuntimeContentHash != installedRuntimeHash) {
                        throw new Error('数据库内置微服务写后回读字节摘要不一致：' + expectedRuntimePath);
                    }
                    if (expectedRuntimeHash && installedRuntimeHash != expectedRuntimeHash) {
                        throw new Error('数据库内置微服务写后回读摘要不一致：' + expectedRuntimePath);
                    }
                    if (expectedRuntimePath == normalizeApplicationPath(entryPath).toLowerCase()) {
                        var installedEntryHtml = '';
                        try {
                            installedEntryHtml = System.Text.Encoding.UTF8.GetString(
                                System.Convert.FromBase64String(String(installedRuntimeBase64))
                            );
                        } catch (entryDecodeError) {
                            throw new Error('数据库内置微服务入口不是有效 Base64/UTF-8 HTML：' + appKey);
                        }
                        if (!/<!doctype\s+html/i.test(installedEntryHtml)
                            || !/<html\b/i.test(installedEntryHtml)
                            || !/<head\b/i.test(installedEntryHtml)
                            || !/<body\b/i.test(installedEntryHtml)
                            || !/<\/html\s*>/i.test(installedEntryHtml)) {
                            throw new Error('数据库内置微服务入口不是完整 HTML 文档：' + appKey);
                        }
                        installedEntryVerified = true;
                    }
                }
                if (!installedEntryVerified) throw new Error('数据库内置微服务缺少可验证入口：' + entryPath);
                stats.ApplicationRuntimeVerified++;
                debugLog['microservice_runtime_verified_' + appKey] = 'StorageMode=db，资产'
                    + runtimeDbAssets.length + '个，入口HTML完整';
            }
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
                    RetireLegacyMenus: routeMeta.RetireLegacyMenus === true
                        || Number(routeMeta.RetireLegacyMenus || 0) === 1
                        || String(routeMeta.RetireLegacyMenus || '').toLowerCase() == 'true',
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

    // API_ENGINE_RESOURCE_BASELINE_V1：安装成功记录继续保存每个接口引擎的
    // 包摘要用于审计与回读，但不再把 Base/Local 差异作为安装阻断条件。
    // PACKAGE_MANAGED_OVERWRITE_V2：应用包声明的 Managed 资源始终以本次选定
    // 包正文为准覆盖目标记录；CreateIfMissing 已存在时只跳过，因此两类资源
    // 都不会因本地差异进入“冲突待人工处理”的永久失败循环。
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
                    ApiEngineDuplicatesRetired: stats.ApiEngineDuplicatesRetired,
                    ApiEngineHistoryMigrated: stats.ApiEngineHistoryMigrated,
                    ApiEngineHistorySkipped: stats.ApiEngineHistorySkipped,
                    ApplicationSourceFiles: stats.ApplicationSourceFiles,
                    ApplicationBuildAssets: stats.ApplicationBuildAssets,
                    ApplicationInlineBuildAssets: stats.ApplicationInlineBuildAssets,
                    ApplicationRuntimeVerified: stats.ApplicationRuntimeVerified,
                    ApplicationSharedRuntimes: stats.ApplicationSharedRuntimes,
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
                        Url: marketplaceEngineUrl('official_marketplace_install_stat'),
                        PostParam: marketplaceEngineParam('official_marketplace_install_stat', {
                            StoreId: model.StoreId,
                            AppId: model.AppId,
                            AppName: model.AppName,
                            AppVersion: appVersion,
                            TargetOsClient: V8.OsClient,
                            InstallAction: installAction,
                            OperationId: installOperationId,
                            InstallationKey: installationKey
                        }),
                        ParamType: 'json',
                        Timeout: 30
                    });
                    // MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1：V8.Http.Post 在不同
                    // 运行版本中可能直接返回对象，也可能返回 JSON 字符串。
                    // MARKETPLACE_INSTALL_STAT_NON_BLOCKING_V2：安装次数属于幂等遥测，
                    // 旧节点可能返回 True/False 或代理诊断文本。非标准回执必须保留告警，
                    // 但不能把已经成功的应用导入误判失败并回滚；OperationId/InstallationKey
                    // 继续保证远端实际成功但响应丢失时不会重复计数。
                    if (typeof remoteStat == 'string') {
                        var remoteStatText = String(remoteStat || '').replace(/^\s+|\s+$/g, '');
                        if (/^true$/i.test(remoteStatText)) {
                            remoteStat = { Code: 1, Msg: '兼容旧节点布尔成功回执' };
                        } else {
                            try {
                                remoteStat = JSON.parse(remoteStatText);
                            } catch (remoteStatParseError) {
                                debugLog.install_count_warning_remote = '官方商城安装次数回执不是标准JSON：'
                                    + remoteStatText.substring(0, 300) + '，操作Id=' + installOperationId;
                                remoteStat = null;
                            }
                        }
                    }
                    if (remoteStat === true || (remoteStat && remoteStat.Code == 1)) {
                        debugLog.install_count_result = '官方商城安装次数已累计，操作Id=' + installOperationId;
                    } else if (!debugLog.install_count_warning_remote) {
                        debugLog.install_count_warning_remote = '官方商城安装次数累计未确认：'
                            + ((remoteStat && remoteStat.Msg) || '接口无返回') + '，操作Id=' + installOperationId;
                    }
                } catch (statError) {
                    debugLog.install_count_warning_remote = '官方商城安装次数累计请求异常：'
                        + (statError.message || String(statError)) + '，操作Id=' + installOperationId;
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

    // PAGE_ENGINE_DIYTABLE_REFERENCE_REMAP_V1：界面引擎的 diytable 组件同时保存
    // widgetParams[0]=DiyTableId 与 widgetParams[1]=SysMenuId。跨租户安装时表和
    // 菜单都可能按目标库自然键保留既有主键，只做普通字符串 IdMap 仍可能让页面
    // 留下发布端旧 TableId。目标菜单的持久化 DiyTableId 才是运行时权威绑定；
    // 因此随包 mic_page 数据写入前必须按已安装菜单重新投影并强校验目标表存在。
    // PAGE_ENGINE_OPTIONAL_REFERENCE_V1：普通引用继续严格失败；只有组件自身显式声明
    // referencePolicy.onMissing=RemoveWidget 时，才允许在目标租户确实缺少菜单/表后
    // 移除该可选组件。数据库读取异常绝不能被当成“缺少资源”吞掉。
    var pageEngineRemovedReferenceNode = {};
    var pageEngineMenuBindingCache = {};
    var pageEngineMissingReferenceError = function (message) {
        var error = new Error(message);
        error.IsPageEngineMissingReference = true;
        return error;
    };
    var pageEngineMissingReferenceAction = function (widget) {
        var policy = widget && (widget.referencePolicy || widget.ReferencePolicy) || {};
        return String(policy.onMissing || policy.OnMissing || policy.MissingBehavior || '')
            .replace(/^\s+|\s+$/g, '')
            .toLowerCase();
    };
    var readPageEngineMenuBinding = function (sourceMenuId) {
        var targetMenuId = normalizeId(findMappedId(normalizeId(sourceMenuId)));
        if (!targetMenuId) return null;
        var cacheKey = targetMenuId.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(pageEngineMenuBindingCache, cacheKey)) {
            return pageEngineMenuBindingCache[cacheKey];
        }

        var menuResult = V8.FormEngine.GetFormData('sys_menu', {
            Id: targetMenuId,
            _SelectFields: ['Id', 'Name', 'DiyTableId', 'DiyTableName']
        });
        if (menuResult && menuResult.Code == 2) {
            throw pageEngineMissingReferenceError(
                '界面引擎 diytable 引用修复失败：目标菜单不存在，MenuId=' + targetMenuId
            );
        }
        if (!menuResult || menuResult.Code != 1 || !menuResult.Data) {
            throw new Error('界面引擎 diytable 引用修复失败：读取目标菜单失败，MenuId='
                + targetMenuId + '，' + ((menuResult && menuResult.Msg) || '接口无返回'));
        }
        var targetTableId = normalizeId(findMappedId(normalizeId(menuResult.Data.DiyTableId)));
        if (!targetTableId) {
            throw pageEngineMissingReferenceError(
                '界面引擎 diytable 引用修复失败：目标菜单未绑定DIY表，MenuId=' + targetMenuId
            );
        }
        var tableResult = V8.FormEngine.GetFormData('diy_table', {
            Id: targetTableId,
            _SelectFields: ['Id', 'Name']
        });
        if (tableResult && tableResult.Code == 2) {
            throw pageEngineMissingReferenceError(
                '界面引擎 diytable 引用修复失败：目标菜单绑定的DIY表不存在，MenuId='
                + targetMenuId + '，DiyTableId=' + targetTableId
            );
        }
        if (!tableResult || tableResult.Code != 1 || !tableResult.Data) {
            throw new Error('界面引擎 diytable 引用修复失败：读取目标DIY表失败，MenuId='
                + targetMenuId + '，DiyTableId=' + targetTableId + '，'
                + ((tableResult && tableResult.Msg) || '接口无返回'));
        }

        var binding = {
            MenuId: targetMenuId,
            TableId: targetTableId,
            TableName: normalizeId(tableResult.Data.Name || menuResult.Data.DiyTableName)
        };
        pageEngineMenuBindingCache[cacheKey] = binding;
        return binding;
    };

    var remapPageEngineDiyTableWidgets = function (value, state) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) {
            var remappedArray = [];
            for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
                var remappedItem = remapPageEngineDiyTableWidgets(value[arrayIndex], state);
                if (remappedItem !== pageEngineRemovedReferenceNode) remappedArray.push(remappedItem);
            }
            return remappedArray;
        }
        if (typeof value != 'object') return value;

        var hadWidgetList = Array.isArray(value.widgetList) && value.widgetList.length > 0;

        if (String(value.type || '').toLowerCase() == 'diytable'
            && Array.isArray(value.widgetParams)) {
            var tableParam = value.widgetParams.length > 0 ? value.widgetParams[0] : null;
            var menuParam = value.widgetParams.length > 1 ? value.widgetParams[1] : null;
            if (tableParam && tableParam.value) {
                var mappedTableId = findMappedId(normalizeId(tableParam.value));
                if (mappedTableId !== tableParam.value) {
                    tableParam.value = mappedTableId;
                    state.changed = true;
                }
            }
            if (menuParam && menuParam.value) {
                var binding;
                try {
                    binding = readPageEngineMenuBinding(menuParam.value);
                } catch (referenceError) {
                    if (referenceError
                        && referenceError.IsPageEngineMissingReference === true
                        && pageEngineMissingReferenceAction(value) == 'removewidget') {
                        state.changed = true;
                        state.optionalWidgetsRemoved++;
                        state.optionalReferenceMessages.push(referenceError.message);
                        return pageEngineRemovedReferenceNode;
                    }
                    throw referenceError;
                }
                if (binding) {
                    if (menuParam.value !== binding.MenuId) {
                        menuParam.value = binding.MenuId;
                        state.changed = true;
                    }
                    if (!tableParam) {
                        throw new Error('界面引擎 diytable 引用修复失败：组件缺少 widgetParams[0] 模块Id');
                    }
                    if (normalizeId(tableParam.value) !== binding.TableId) {
                        tableParam.value = binding.TableId;
                        state.changed = true;
                    }
                    state.diyTableWidgetCount++;
                }
            }
        }

        for (var objectKey in value) {
            if (!Object.prototype.hasOwnProperty.call(value, objectKey)) continue;
            var remappedValue = remapPageEngineDiyTableWidgets(value[objectKey], state);
            if (remappedValue === pageEngineRemovedReferenceNode) {
                delete value[objectKey];
            } else {
                value[objectKey] = remappedValue;
            }
        }
        if (hadWidgetList && Array.isArray(value.widgetList) && value.widgetList.length == 0) {
            state.optionalWrappersRemoved++;
            return pageEngineRemovedReferenceNode;
        }
        return value;
    };

    var remapPackageDataRowReferences = function (dataTableName, sourceRow, rowIndex) {
        if (String(dataTableName || '').toLowerCase() != 'mic_page'
            || !sourceRow || sourceRow.JsonObj === undefined || sourceRow.JsonObj === null
            || sourceRow.JsonObj === '') {
            return sourceRow;
        }
        var jsonWasText = typeof sourceRow.JsonObj == 'string';
        var pageJson;
        try {
            pageJson = jsonWasText ? JSON.parse(sourceRow.JsonObj) : sourceRow.JsonObj;
        } catch (pageJsonError) {
            throw new Error('界面引擎随包数据 JsonObj 不是有效JSON：Id=' + normalizeId(sourceRow.Id));
        }

        // 先做表/字段/菜单稳定 Id 的精确值映射，再按目标菜单的真实表绑定纠偏。
        var genericState = { changed: false };
        pageJson = replaceIdsDeep(pageJson, genericState);
        var pageState = {
            changed: genericState.changed,
            diyTableWidgetCount: 0,
            optionalWidgetsRemoved: 0,
            optionalWrappersRemoved: 0,
            optionalReferenceMessages: []
        };
        pageJson = remapPageEngineDiyTableWidgets(pageJson, pageState);
        if (!pageState.changed) return sourceRow;

        var remappedRow = {};
        for (var rowKey in sourceRow) {
            if (Object.prototype.hasOwnProperty.call(sourceRow, rowKey)) remappedRow[rowKey] = sourceRow[rowKey];
        }
        remappedRow.JsonObj = jsonWasText ? JSON.stringify(pageJson) : pageJson;
        stats.ReferenceRowsUpdated++;
        debugLog['page_engine_reference_remap_' + normalizeId(sourceRow.Id || rowIndex)] =
            '已按目标菜单重写界面引擎引用，diytable组件=' + pageState.diyTableWidgetCount
            + '，可选组件移除=' + pageState.optionalWidgetsRemoved
            + '，空容器移除=' + pageState.optionalWrappersRemoved;
        if (pageState.optionalReferenceMessages.length > 0) {
            debugLog['page_engine_optional_reference_' + normalizeId(sourceRow.Id || rowIndex)] =
                pageState.optionalReferenceMessages.join('；');
        }
        return remappedRow;
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

    // FIELD_ID_PLAN_BOUNDED_READ_BATCH_V1：仅缓存当前至多 64 个字段的规划读取，
    // 将每字段两次往返合并为两次有界查询。重复自然键继续按旧单条查询选取，
    // 超过行数上限时整体回退，不能把截断结果误当作字段不存在。缓存不跨写入或分片。
    var readFieldPlanningSlice = function (fields, startIndex, endIndex) {
        if (endIndex - startIndex < 2 || endIndex - startIndex > 64) return null;
        var predicates = [];
        var values = [];
        var ids = [];
        var seenIds = Object.create(null);
        var naturalKey = function (tableId, name) {
            return JSON.stringify([normalizeId(tableId).toLowerCase(), String(name || '').toLowerCase()]);
        };
        var includeId = function (id) {
            id = normalizeId(id);
            if (id && !seenIds[id.toLowerCase()]) {
                seenIds[id.toLowerCase()] = true;
                ids.push(id);
            }
        };
        for (var index = startIndex; index < endIndex; index++) {
            var field = fields[index] || {};
            var sourceId = normalizeId(field.Id);
            var tableId = normalizeId(field.TableId);
            var name = String(field.Name || '');
            if (!sourceId || !tableId || !name) continue;
            var parameterIndex = values.length;
            predicates.push('(TableId = @p' + parameterIndex + ' AND LOWER(Name) = LOWER(@p' + (parameterIndex + 1) + '))');
            values.push(tableId, name);
            includeId(sourceId);
            includeId(fieldMapTarget(sourceId));
        }
        if (predicates.length == 0) return null;
        var naturalQuery = V8.Db.FromSql(
            'SELECT Id, TableId, Name FROM diy_field WHERE ' + predicates.join(' OR ') + ' ORDER BY IsDeleted ASC LIMIT 513'
        );
        for (var valueIndex = 0; valueIndex < values.length; valueIndex++) {
            naturalQuery = naturalQuery.AddInParameter('@p' + valueIndex, values[valueIndex]);
        }
        // 保留只实现单条读取的旧宿主兼容入口。
        if (!naturalQuery.ToArray) return null;
        var naturalRows = naturalQuery.ToArray();
        if (!naturalRows || naturalRows.length >= 513) return null;
        var natural = Object.create(null);
        for (var rowIndex = 0; rowIndex < naturalRows.length; rowIndex++) {
            var row = naturalRows[rowIndex];
            var key = naturalKey(row.TableId, row.Name);
            natural[key] = natural[key] === undefined ? row : false;
        }
        var placeholders = [];
        for (var idIndex = 0; idIndex < ids.length; idIndex++) placeholders.push('@p' + idIndex);
        var idQuery = V8.Db.FromSql('SELECT Id, TableId, Name FROM diy_field WHERE Id IN (' + placeholders.join(',') + ')');
        for (var bindIndex = 0; bindIndex < ids.length; bindIndex++) idQuery = idQuery.AddInParameter('@p' + bindIndex, ids[bindIndex]);
        var idRows = idQuery.ToArray();
        if (!idRows) throw new Error('字段主键批量读取未返回结果，已停止本次规划。');
        var byId = Object.create(null);
        for (var rawIndex = 0; rawIndex < idRows.length; rawIndex++) {
            byId[normalizeId(idRows[rawIndex].Id).toLowerCase()] = idRows[rawIndex];
        }
        return { natural: natural, byId: byId, naturalKey: naturalKey };
    };

    // Id 映射先规划、后写入。这样字段 A 的 JSON 即使引用稍后才处理且发生
    // 主键冲突的字段 B，A 在保存前也已经拿到 B 的最终目标 Id。随机生成的冲突
    // Id 会进入共享 CheckpointJson；重试同一分片或换节点不会再次生成新 Id。
    var planPackageFieldIdMaps = function (startIndex, endIndex) {
        var packageFields = Package.DiyFields || [];
        var planningRead = readFieldPlanningSlice(packageFields, startIndex, endIndex);
        for (var planIndex = startIndex; planIndex < endIndex; planIndex++) {
            var packageField = packageFields[planIndex] || {};
            var sourceFieldId = normalizeId(packageField.Id);
            var targetTableId = normalizeId(packageField.TableId);
            var fieldName = String(packageField.Name || '');
            if (!sourceFieldId || !targetTableId || !fieldName) continue;

            var naturalField = planningRead
                ? planningRead.natural[planningRead.naturalKey(targetTableId, fieldName)] : false;
            if (naturalField === false) naturalField = V8.Db.FromSql(
                'SELECT Id, TableId, Name FROM diy_field WHERE TableId = @p0 AND LOWER(Name) = LOWER(@p1) ORDER BY IsDeleted ASC LIMIT 1'
            ).AddInParameter('@p0', targetTableId)
                .AddInParameter('@p1', fieldName)
                .First();
            if (naturalField && naturalField.Id) {
                addIdMap('Field', sourceFieldId, String(naturalField.Id), fieldName + '字段主键预对齐');
                continue;
            }

            var rawSource = planningRead ? planningRead.byId[sourceFieldId.toLowerCase()] : V8.Db.FromSql(
                'SELECT Id, TableId, Name FROM diy_field WHERE Id = @p0 LIMIT 1'
            ).AddInParameter('@p0', sourceFieldId).First();
            var rawSourceMatches = rawSource && rawSource.Id
                && normalizeId(rawSource.TableId).toLowerCase() == targetTableId.toLowerCase()
                && String(rawSource.Name || '').toLowerCase() == fieldName.toLowerCase();
            if (rawSourceMatches) continue;

            var plannedTargetId = fieldMapTarget(sourceFieldId);
            if (plannedTargetId) {
                var rawPlanned = planningRead ? planningRead.byId[normalizeId(plannedTargetId).toLowerCase()] : V8.Db.FromSql(
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

    // DATASET_TABLE_PREFLIGHT_V1：旧包允许显式复用目标已安装的表；目标缺表时
    // 必须在 DDL/字段/接口写入之前发现资源缺口，禁止耗时安装到最后才失败。
    var validateDataSetTablePrerequisites = function () {
        var dataSets = Package.DataSets || [];
        if (typeof dataSets == 'string') dataSets = JSON.parse(dataSets || '[]');
        for (var dataSetIndex = 0; dataSetIndex < dataSets.length; dataSetIndex++) {
            var targetName = String(dataSets[dataSetIndex].TableName || '');
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(targetName)) throw new Error('数据集目标表名无效：' + targetName);
            var declaredTable = false;
            var declaredDdl = false;
            for (var tableIndex = 0; tableIndex < (Package.DiyTables || []).length; tableIndex++) {
                if (String(Package.DiyTables[tableIndex].Name || '').toLowerCase() == targetName.toLowerCase()) declaredTable = true;
            }
            for (var ddlIndex = 0; ddlIndex < (Package.DDLStatements || []).length; ddlIndex++) {
                var definition = Package.DDLStatements[ddlIndex];
                if (String(definition.TableName || '').toLowerCase() == targetName.toLowerCase()
                    && /\bCREATE\s+TABLE\b/i.test(String(definition.DDL || ''))) declaredDdl = true;
            }
            if (declaredTable && declaredDdl) continue;
            var query = runtimeIsSqlServer
                ? 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG=DB_NAME() AND LOWER(TABLE_NAME)=LOWER(@p0)'
                : 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(@p0)';
            if (runtimeIsOracle) query = 'SELECT TABLE_NAME FROM USER_TABLES WHERE LOWER(TABLE_NAME)=LOWER(@p0)';
            var existing = V8.Db.FromSql(query).AddInParameter('@p0', targetName).ToArray();
            if (!existing || existing.length == 0) throw new Error('数据集依赖预检失败：目标表 ' + targetName + ' 尚未创建，应用包必须补齐表定义和建表资源后重新发布。');
        }
    };
    validateDataSetTablePrerequisites();

    // ==================== 步骤0：执行DDL创建表和字段 ====================
    activeImportStage = '步骤0-物理表与DDL';

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

    // 包内字段沿用 MySQL 逻辑类型；在目标库执行物理 DDL 前统一映射为当前方言。
    var mapToMySQLType = function (diyType) {
        if (!diyType) return runtimeIsSqlServer ? 'nvarchar(255)' : 'varchar(255)';

        // 安全转换为字符串并小写
        var typeStr = '';
        try {
            typeStr = String.prototype.toLowerCase.call(String(diyType));
        } catch (e) {
            return 'varchar(255)';
        }

        if (runtimeIsSqlServer) {
            if (/^(?:datetime2|datetimeoffset|time)\(\d+\)$/.test(typeStr)) return typeStr;
            if (/^(?:int|bigint|smallint|tinyint|bit|float|real|date|datetime|smalldatetime|money|smallmoney|uniqueidentifier)$/.test(typeStr)) return typeStr;
            if (/^(?:decimal|numeric)\((\d+),(\d+)\)$/.test(typeStr)) return typeStr;
            if (/^(?:varbinary|binary)\((?:max|\d+)\)$/.test(typeStr)) return typeStr;
            var lengthMatch = typeStr.match(/^(?:var)?char\((\d+)\)$/);
            if (lengthMatch) {
                var length = parseInt(lengthMatch[1], 10);
                return length > 4000 ? 'nvarchar(max)' : 'nvarchar(' + length + ')';
            }
            var unicodeLengthMatch = typeStr.match(/^n(?:var)?char\((max|\d+)\)$/);
            if (unicodeLengthMatch) return 'nvarchar(' + unicodeLengthMatch[1] + ')';
            var decimalMatch = typeStr.match(/^(?:decimal|numeric)\((\d+),(\d+)\)$/);
            if (decimalMatch) return 'decimal(' + decimalMatch[1] + ',' + decimalMatch[2] + ')';
            if (/^(?:tinytext|text|mediumtext|longtext|json|clob)(?:\(|$)/.test(typeStr)) return 'nvarchar(max)';
            if (/^(?:blob|binary|varbinary)(?:\(|$)/.test(typeStr)) return 'varbinary(max)';
            if (/^bigint(?:\(|$)/.test(typeStr)) return 'bigint';
            if (/^(?:int|integer|mediumint)(?:\(|$)/.test(typeStr)) return 'int';
            if (/^smallint(?:\(|$)/.test(typeStr)) return 'smallint';
            if (/^tinyint(?:\(|$)/.test(typeStr)) return 'tinyint';
            if (/^(?:bit|boolean|bool)(?:\(|$)/.test(typeStr)) return 'bit';
            if (/^(?:double|float)(?:\(|$)/.test(typeStr)) return 'float';
            if (typeStr == 'datetime' || typeStr == 'timestamp') return 'datetime2(7)';
            if (typeStr == 'date' || typeStr == 'time') return typeStr;
            if (typeStr == 'uniqueidentifier') return typeStr;
            return 'nvarchar(255)';
        }

        // MYSQL_PHYSICAL_BIT_PRESERVATION_V1：物理 BIT 列不是未知控件类型。
        // 误转 varchar 会重建大型日志表，并破坏旧库的布尔存储约定。
        if (/^bit(?:\((?:[1-9]|[1-5][0-9]|6[0-4])\))?$/.test(typeStr)) return typeStr;
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
        // MySQL 整数显示宽度不影响实际存储容量。
        return String(value || '').toLowerCase().replace(/\s+/g, '')
            .replace(/^(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/, '$1')
            .replace(/^integer(?=unsigned|$)/, 'int')
            .replace(/^bit$/, 'bit(1)');
    };

    // 应用包只能扩宽目标库已有字段，不能为了与来源库完全一致而缩窄字段。
    // 否则目标库中已经存在的配置 JSON、富文本等数据会在 MODIFY COLUMN 时丢失或直接报错。
    var getTextTypeCapacity = function (value) {
        var type = normalizeSqlType(value);
        var varcharMatch = type.match(/^(?:n)?varchar\((\d+)\)/);
        var charMatch = type.match(/^(?:n)?char\((\d+)\)/);
        if (varcharMatch) return parseInt(varcharMatch[1], 10);
        if (charMatch) return parseInt(charMatch[1], 10);
        if (/^(?:n)?varchar\(max\)$/.test(type)) return 4294967295;
        if (type.indexOf('tinytext') == 0) return 255;
        if (type.indexOf('mediumtext') == 0) return 16777215;
        if (type.indexOf('longtext') == 0) return 4294967295;
        if (type == 'ntext') return 4294967295;
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
        if (normalizeSqlType(sourceType) == normalizeSqlType(targetType)) return String(targetType);
        // 旧 INT 可容纳 BIT(1) 全部值，不把客户已有列缩窄为来源库的布尔类型。
        if (normalizeSqlType(sourceType) == 'bit(1)' && getIntegerTypeRank(targetType) > 0) {
            return String(targetType);
        }
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

    var quoteSqlServerCatalogIdentifier = function (value) {
        return '[' + String(value || '').replace(/\]/g, ']]') + ']';
    };

    // SQL Server 不允许直接修改被普通索引或 DEFAULT 约束引用的列。先从
    // 系统目录完整快照相关对象，在同一事务中删除、扩宽字段并重建，任一步
    // 失败都会随应用包事务回滚。主键和 UNIQUE 约束不在这里猜测重建，交由
    // 专用版本迁移处理。
    var alterSqlServerColumnPreservingIndexes = function (tableName, columnName, physicalType, nullableSql) {
        var defaultRows = V8.Db.FromSql(
            "SELECT SCHEMA_NAME(t.schema_id) AS SchemaName, dc.name AS ConstraintName, dc.definition AS Definition " +
            "FROM sys.default_constraints dc " +
            "INNER JOIN sys.tables t ON t.object_id = dc.parent_object_id " +
            "INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id " +
            "WHERE LOWER(t.name) = LOWER(@p0) AND LOWER(c.name) = LOWER(@p1)"
        ).AddInParameter('@p0', tableName)
            .AddInParameter('@p1', columnName)
            .ToArray() || [];

        var indexRows = V8.Db.FromSql(
            "SELECT SCHEMA_NAME(o.schema_id) AS SchemaName, i.name AS IndexName, i.is_unique AS IsUnique, " +
            "i.type_desc AS TypeDesc, i.has_filter AS HasFilter, i.filter_definition AS FilterDefinition, " +
            "ic.key_ordinal AS KeyOrdinal, ic.is_included_column AS IsIncludedColumn, " +
            "ic.index_column_id AS IndexColumnId, ic.is_descending_key AS IsDescendingKey, c.name AS ColumnName " +
            "FROM sys.indexes i " +
            "INNER JOIN sys.objects o ON o.object_id = i.object_id " +
            "INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE LOWER(o.name) = LOWER(@p0) AND i.name IS NOT NULL AND i.is_hypothetical = 0 " +
            "AND i.is_primary_key = 0 AND i.is_unique_constraint = 0 AND i.type IN (1,2) " +
            "AND EXISTS (SELECT 1 FROM sys.index_columns dep " +
            "INNER JOIN sys.columns depc ON depc.object_id = dep.object_id AND depc.column_id = dep.column_id " +
            "WHERE dep.object_id = i.object_id AND dep.index_id = i.index_id AND LOWER(depc.name) = LOWER(@p1)) " +
            "ORDER BY i.index_id, ic.is_included_column, ic.key_ordinal, ic.index_column_id"
        ).AddInParameter('@p0', tableName)
            .AddInParameter('@p1', columnName)
            .ToArray() || [];

        var indexes = [];
        var indexMap = {};
        for (var indexRowIndex = 0; indexRowIndex < indexRows.length; indexRowIndex++) {
            var indexRow = indexRows[indexRowIndex] || {};
            var indexName = String(getPhysicalValue(indexRow, ['IndexName', 'INDEX_NAME']) || '');
            if (!indexName) continue;
            var indexKey = indexName.toLowerCase();
            var indexModel = indexMap[indexKey];
            if (!indexModel) {
                indexModel = {
                    SchemaName: String(getPhysicalValue(indexRow, ['SchemaName', 'SCHEMA_NAME']) || 'dbo'),
                    IndexName: indexName,
                    IsUnique: Number(getPhysicalValue(indexRow, ['IsUnique', 'IS_UNIQUE']) || 0) == 1,
                    TypeDesc: String(getPhysicalValue(indexRow, ['TypeDesc', 'TYPE_DESC']) || 'NONCLUSTERED'),
                    HasFilter: Number(getPhysicalValue(indexRow, ['HasFilter', 'HAS_FILTER']) || 0) == 1,
                    FilterDefinition: String(getPhysicalValue(indexRow, ['FilterDefinition', 'FILTER_DEFINITION']) || ''),
                    Keys: [],
                    Includes: []
                };
                indexMap[indexKey] = indexModel;
                indexes.push(indexModel);
            }
            var indexColumnName = String(getPhysicalValue(indexRow, ['ColumnName', 'COLUMN_NAME']) || '');
            if (!indexColumnName) continue;
            if (Number(getPhysicalValue(indexRow, ['IsIncludedColumn', 'IS_INCLUDED_COLUMN']) || 0) == 1) {
                indexModel.Includes.push(quoteSqlServerCatalogIdentifier(indexColumnName));
            } else {
                indexModel.Keys.push(
                    quoteSqlServerCatalogIdentifier(indexColumnName) +
                    (Number(getPhysicalValue(indexRow, ['IsDescendingKey', 'IS_DESCENDING_KEY']) || 0) == 1 ? ' DESC' : ' ASC')
                );
            }
        }

        for (var dropIndex = 0; dropIndex < indexes.length; dropIndex++) {
            var dropModel = indexes[dropIndex];
            V8.Db.FromSql(
                'DROP INDEX ' + quoteSqlServerCatalogIdentifier(dropModel.IndexName) + ' ON ' +
                quoteSqlServerCatalogIdentifier(dropModel.SchemaName) + '.' + quoteSqlServerCatalogIdentifier(tableName)
            ).ExecuteNonQuery();
        }

        for (var dropDefaultIndex = 0; dropDefaultIndex < defaultRows.length; dropDefaultIndex++) {
            var dropDefault = defaultRows[dropDefaultIndex] || {};
            var dropDefaultSchema = String(getPhysicalValue(dropDefault, ['SchemaName', 'SCHEMA_NAME']) || 'dbo');
            var dropDefaultName = String(getPhysicalValue(dropDefault, ['ConstraintName', 'CONSTRAINT_NAME']) || '');
            if (!dropDefaultName) continue;
            V8.Db.FromSql(
                'ALTER TABLE ' + quoteSqlServerCatalogIdentifier(dropDefaultSchema) + '.' +
                quoteSqlServerCatalogIdentifier(tableName) + ' DROP CONSTRAINT ' +
                quoteSqlServerCatalogIdentifier(dropDefaultName)
            ).ExecuteNonQuery();
        }

        V8.Db.FromSql(
            'ALTER TABLE ' + quotePhysicalIdentifier(tableName) + ' ALTER COLUMN ' +
            quotePhysicalIdentifier(columnName) + ' ' + physicalType + ' ' + nullableSql
        ).ExecuteNonQuery();

        for (var createIndex = 0; createIndex < indexes.length; createIndex++) {
            var createModel = indexes[createIndex];
            if (createModel.Keys.length == 0) throw new Error('SQL Server 索引缺少键列：' + createModel.IndexName);
            var createSql = 'CREATE ' + (createModel.IsUnique ? 'UNIQUE ' : '') +
                (createModel.TypeDesc.toUpperCase().indexOf('CLUSTERED') >= 0 && createModel.TypeDesc.toUpperCase().indexOf('NONCLUSTERED') < 0
                    ? 'CLUSTERED ' : 'NONCLUSTERED ') +
                'INDEX ' + quoteSqlServerCatalogIdentifier(createModel.IndexName) + ' ON ' +
                quoteSqlServerCatalogIdentifier(createModel.SchemaName) + '.' + quoteSqlServerCatalogIdentifier(tableName) +
                ' (' + createModel.Keys.join(', ') + ')';
            if (createModel.Includes.length > 0) createSql += ' INCLUDE (' + createModel.Includes.join(', ') + ')';
            if (createModel.HasFilter && createModel.FilterDefinition) createSql += ' WHERE ' + createModel.FilterDefinition;
            V8.Db.FromSql(createSql).ExecuteNonQuery();
        }

        for (var createDefaultIndex = 0; createDefaultIndex < defaultRows.length; createDefaultIndex++) {
            var createDefault = defaultRows[createDefaultIndex] || {};
            var createDefaultSchema = String(getPhysicalValue(createDefault, ['SchemaName', 'SCHEMA_NAME']) || 'dbo');
            var createDefaultName = String(getPhysicalValue(createDefault, ['ConstraintName', 'CONSTRAINT_NAME']) || '');
            var createDefaultDefinition = String(getPhysicalValue(createDefault, ['Definition', 'DEFINITION']) || '');
            if (!createDefaultName || !createDefaultDefinition) continue;
            V8.Db.FromSql(
                'ALTER TABLE ' + quoteSqlServerCatalogIdentifier(createDefaultSchema) + '.' +
                quoteSqlServerCatalogIdentifier(tableName) + ' ADD CONSTRAINT ' +
                quoteSqlServerCatalogIdentifier(createDefaultName) + ' DEFAULT ' +
                createDefaultDefinition + ' FOR ' + quoteSqlServerCatalogIdentifier(columnName)
            ).ExecuteNonQuery();
        }
        return indexes.length;
    };

    var getPhysicalValue = function (row, names) {
        for (var i = 0; i < names.length; i++) {
            if (row[names[i]] !== undefined && row[names[i]] !== null) return row[names[i]];
        }
        return null;
    };

    var readTargetPhysicalColumns = function (tableName) {
        if (!isSafeIdentifier(tableName)) return [];
        if (runtimeIsSqlServer) {
            return V8.Db.FromSql(
                "SELECT TABLE_NAME, COLUMN_NAME, " +
                "CASE " +
                "WHEN DATA_TYPE IN ('nvarchar','varchar','nchar','char','varbinary','binary') THEN DATA_TYPE + '(' + " +
                "CASE WHEN CHARACTER_MAXIMUM_LENGTH = -1 THEN 'max' ELSE CAST(CHARACTER_MAXIMUM_LENGTH AS varchar(10)) END + ')' " +
                "WHEN DATA_TYPE IN ('decimal','numeric') THEN DATA_TYPE + '(' + CAST(NUMERIC_PRECISION AS varchar(10)) + ',' + CAST(NUMERIC_SCALE AS varchar(10)) + ')' " +
                "WHEN DATA_TYPE IN ('datetime2','datetimeoffset','time') THEN DATA_TYPE + '(' + CAST(DATETIME_PRECISION AS varchar(10)) + ')' " +
                "ELSE DATA_TYPE END AS COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, " +
                "CAST('' AS nvarchar(1)) AS COLUMN_COMMENT, COLLATION_NAME " +
                "FROM INFORMATION_SCHEMA.COLUMNS " +
                "WHERE TABLE_CATALOG = DB_NAME() AND LOWER(TABLE_NAME) = LOWER(@p0)"
            ).AddInParameter('@p0', tableName).ToArray() || [];
        }
        return V8.Db.FromSql(
            "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, EXTRA, CHARACTER_SET_NAME, COLLATION_NAME " +
            "FROM INFORMATION_SCHEMA.COLUMNS " +
            "WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0)"
        ).AddInParameter('@p0', tableName).ToArray() || [];
    };

    var mysqlCurrentTimestampDefault = function (value, columnType) {
        if (!/^(datetime|timestamp)(\(\d\))?$/i.test(String(columnType || '').trim())) return '';
        var match = /^current_timestamp(?:\(([0-6]?)\))?$/i.exec(String(value || '').trim());
        if (!match) return '';
        var precision = Number(match[1] || 0);
        return 'CURRENT_TIMESTAMP' + (precision ? '(' + precision + ')' : '');
    };

    var buildPhysicalColumnDefinition = function (column, includePrimaryKey, overrideColumnType) {
        var columnName = getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']);
        var columnType = overrideColumnType || getPhysicalValue(column, ['COLUMN_TYPE', 'ColumnType', 'Type']);
        if (!columnName || !columnType || !isSafeIdentifier(columnName)) return '';

        columnType = mapToMySQLType(columnType);
        var definition = quotePhysicalIdentifier(columnName) + ' ' + String(columnType);
        var charset = getPhysicalValue(column, ['CHARACTER_SET_NAME', 'CharacterSetName']);
        var collation = getPhysicalValue(column, ['COLLATION_NAME', 'CollationName']);
        if (!runtimeIsSqlServer && /char|text|enum|set/i.test(String(columnType))) {
            if (charset && isSafeIdentifier(String(charset))) definition += ' CHARACTER SET ' + charset;
            if (collation && isSafeIdentifier(String(collation))) definition += ' COLLATE ' + collation;
        }
        // PLATFORM_PHYSICAL_NULLABLE_V1：包里的历史 NOT NULL 不能代替表单必填校验。
        // 除平台主键 Id 外，所有新增/同步的普通字段均允许 NULL，默认值继续独立保留。
        var nullable = String(columnName).toLowerCase() == 'id' ? 'NO' : 'YES';
        definition += nullable == 'NO' ? ' NOT NULL' : ' NULL';

        var extra = getPhysicalValue(column, ['EXTRA', 'Extra']);
        var columnDefault = getPhysicalValue(column, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
        if (columnDefault !== null && columnDefault !== undefined &&
            (columnDefault !== '' || /char|enum|set/i.test(String(columnType))) &&
            !/text|blob|json/i.test(String(columnType)) && !/auto_increment/i.test(String(extra || ''))) {
            var defaultText = String(columnDefault);
            // SQL Server 的时间类型已映射为 datetime2；继续使用其无参时间默认值。
            var timestampDefault = runtimeIsSqlServer && /^current_timestamp(?:\([0-6]?\))?$/i.test(defaultText)
                ? 'CURRENT_TIMESTAMP'
                : mysqlCurrentTimestampDefault(defaultText, columnType);
            if (timestampDefault) {
                definition += ' DEFAULT ' + timestampDefault;
            } else if (/^b'.*'$/i.test(defaultText)) {
                definition += runtimeIsSqlServer
                    ? ' DEFAULT ' + defaultText.substring(2, defaultText.length - 1)
                    : ' DEFAULT ' + defaultText;
            } else {
                definition += " DEFAULT '" + sqlString(defaultText) + "'";
            }
        }
        // MySQL 8 的 DEFAULT_GENERATED 仅是元数据标记，不能写回列定义。
        var writableExtra = String(extra || '').replace(/\bDEFAULT_GENERATED\b/ig, '').trim();
        if (!runtimeIsSqlServer && /auto_increment|on update/i.test(writableExtra)) definition += ' ' + writableExtra;

        var comment = getPhysicalValue(column, ['COLUMN_COMMENT', 'ColumnComment', 'Comment']);
        if (!runtimeIsSqlServer && comment) definition += " COMMENT '" + sqlString(comment) + "'";

        var columnKey = String(getPhysicalValue(column, ['COLUMN_KEY', 'ColumnKey']) || '').toUpperCase();
        if (includePrimaryKey && columnKey == 'PRI') {
            definition += ' PRIMARY KEY';
        }

        return definition;
    };

    var buildDiyFieldAddColumnSql = function (tableName, field, overrideColumnType) {
        field = field || {};
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(field.Name)) return '';
        var columnType = mapToMySQLType(overrideColumnType || field.Type);
        var sql = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName)
            + (runtimeIsSqlServer ? ' ADD ' : ' ADD COLUMN ')
            + quotePhysicalIdentifier(field.Name) + ' ' + columnType;
        sql += field.Name == 'Id' ? ' NOT NULL PRIMARY KEY' : ' NULL';
        if (!runtimeIsSqlServer && field.Label && String(field.Label) !== String(field.Name)) {
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
        var tableExistsSql = runtimeIsSqlServer
            ? 'SELECT COUNT(1) AS ObjectCount FROM INFORMATION_SCHEMA.TABLES ' +
                'WHERE TABLE_CATALOG = DB_NAME() AND LOWER(TABLE_NAME) = LOWER(@p0)'
            : 'SELECT COUNT(1) AS ObjectCount FROM INFORMATION_SCHEMA.TABLES ' +
                'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0)';
        var rows = V8.Db.FromSql(tableExistsSql).AddInParameter('@p0', tableName).ToArray();
        return rows && rows.length > 0 && getScalarCount(rows[0], ['ObjectCount', 'OBJECTCOUNT', 'objectcount']) > 0;
    };

    var ddlIndexExists = function (tableName, indexName) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(indexName)) return false;
        var indexExistsSql = runtimeIsSqlServer
            ? 'SELECT COUNT(1) AS ObjectCount FROM sys.indexes i ' +
                'INNER JOIN sys.tables t ON t.object_id = i.object_id ' +
                'WHERE LOWER(t.name) = LOWER(@p0) AND LOWER(i.name) = LOWER(@p1)'
            : 'SELECT COUNT(1) AS ObjectCount FROM INFORMATION_SCHEMA.STATISTICS ' +
                'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0) AND LOWER(INDEX_NAME) = LOWER(@p1)';
        var rows = V8.Db.FromSql(indexExistsSql).AddInParameter('@p0', tableName)
            .AddInParameter('@p1', indexName)
            .ToArray();
        return rows && rows.length > 0 && getScalarCount(rows[0], ['ObjectCount', 'OBJECTCOUNT', 'objectcount']) > 0;
    };

    // MySQL 严格模式不允许把历史 varchar 空字符串直接改成 int/decimal。
    // 空字符串在平台旧数据中表示“未填写”，可安全规范为 NULL；Switch 字段还兼容
    // 老版本写入的 True/False 文本。其它非数字内容必须阻止迁移，不能静默转成 0。
    var prepareNumericColumnData = function (tableName, columnName, sourceColumn, sourceType, targetType) {
        var normalized = { BlankCount: 0, LegacyBooleanCount: 0, LegacySwitchNumericCount: 0, LegacySwitchBinaryCount: 0 };
        if (!isNumericSqlType(sourceType) || isNumericSqlType(targetType)) return normalized;

        var regexp = isIntegerSqlType(sourceType)
            ? '^[+-]?[0-9]+$'
            : '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$';
        var isSwitchColumn = isPackageSwitchColumn(tableName, columnName);
        // LEGACY_SWITCH_BINARY_TEXT_V1：历史 BIT 经旧导入器错误转成 varchar
        // 后会留下单个 00/01 字节。仅双重声明的 Switch 允许恢复这两个布尔值；
        // 不把任意二进制、普通文本或多字节掩码静默转为零。
        var switchBinaryPredicate = "OCTET_LENGTH(`" + columnName + "`) = 1 AND HEX(`" + columnName + "`) IN ('00','01')";
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
                " AND " + normalizedTextExpression + " <> 'false'" +
                " AND NOT (" + switchBinaryPredicate + ")";
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
                '，请先清理数据；规则=NumericColumnV2，Switch双重声明=' +
                (isSwitchColumn ? '已命中' : '未命中') + invalidHex
            );
        }

        if (isSwitchColumn) {
            var binaryCountRows = V8.Db.FromSql(
                "SELECT COUNT(1) AS LegacySwitchBinaryCount FROM `" + tableName + "` WHERE " + switchBinaryPredicate
            ).ToArray();
            var binaryCount = binaryCountRows && binaryCountRows.length
                ? getScalarCount(binaryCountRows[0], ['LegacySwitchBinaryCount', 'LEGACYSWITCHBINARYCOUNT', 'legacyswitchbinarycount']) : 0;
            if (binaryCount > 0) {
                V8.Db.FromSql("UPDATE `" + tableName + "` SET `" + columnName + "` = CASE HEX(`" + columnName + "`) WHEN '01' THEN 1 ELSE 0 END WHERE " + switchBinaryPredicate).ExecuteNonQuery();
                normalized.LegacySwitchBinaryCount = binaryCount;
            }
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

    // MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1：早期更新日志表允许
    // OsClient=NULL，MySQL 唯一键也允许同一 StoreId+Version 存在多条 NULL。
    // 当新包把 OsClient 收紧为 NOT NULL 时，直接批量回填会在
    // ux_microistore_changelog_store_version 上产生冲突。这里只处理固定平台表、
    // 固定租户列和明确缺失租户的历史行；其它表、其它租户及其它唯一键一律不碰。
    // 重复状态本身已经违反“一应用版本一条日志”的业务合同，因此确定性保留
    // 未删除、已属于目标租户、Id 字典序更小的主记录，并对删除数量做强校验。
    var repairMarketplaceChangeLogTenantBackfillCollisions = function (targetOsClient) {
        var repair = { CollisionGroups: 0, RemovedRows: 0 };
        var targetTenant = String(targetOsClient || '').replace(/^\s+|\s+$/g, '');
        if (!targetTenant) return repair;

        var candidates = V8.Db.FromSql(
            "SELECT c.`Id`, c.`OsClient`, c.`StoreId`, c.`Version`, c.`IsDeleted` " +
            "FROM `sys_microistore_changelog` c " +
            "WHERE (c.`OsClient` IS NULL OR TRIM(CAST(c.`OsClient` AS CHAR)) = '' OR c.`OsClient` = @p0) " +
            "AND c.`StoreId` IS NOT NULL AND c.`Version` IS NOT NULL " +
            "AND EXISTS (SELECT 1 FROM `sys_microistore_changelog` legacy " +
            "WHERE legacy.`StoreId` = c.`StoreId` AND legacy.`Version` = c.`Version` " +
            "AND (legacy.`OsClient` IS NULL OR TRIM(CAST(legacy.`OsClient` AS CHAR)) = '')) " +
            "ORDER BY c.`StoreId`, c.`Version`, c.`Id` LIMIT 5001"
        ).AddInParameter('@p0', targetTenant).ToArray();
        if (!candidates || candidates.length < 2) return repair;
        if (candidates.length > 5000) {
            throw new Error(
                'sys_microistore_changelog 待修复候选超过5000条，已阻止无界自动清理；' +
                '请先备份并分批清理历史空租户重复日志'
            );
        }

        var isMissingTenant = function (value) {
            return value === null || value === undefined || String(value).replace(/^\s+|\s+$/g, '') === '';
        };
        var isDeletedRow = function (row) {
            var value = String(getPhysicalValue(row || {}, ['IsDeleted', 'ISDELETED', 'isdeleted']) || '')
                .toLowerCase();
            return value == '1' || value == 'true';
        };
        var groups = {};
        var groupKeys = [];
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
            var candidate = candidates[candidateIndex] || {};
            var candidateId = String(getPhysicalValue(candidate, ['Id', 'ID', 'id']) || '');
            var storeId = String(getPhysicalValue(candidate, ['StoreId', 'STOREID', 'storeid']) || '')
                .replace(/^\s+|\s+$/g, '');
            var version = String(getPhysicalValue(candidate, ['Version', 'VERSION', 'version']) || '')
                .replace(/^\s+|\s+$/g, '');
            if (!candidateId || !storeId || !version) {
                throw new Error('更新日志租户回填候选缺少 Id、StoreId 或 Version，已阻止自动修复');
            }
            var groupKey = storeId.toLowerCase() + '\u001f' + version.toLowerCase();
            if (!groups[groupKey]) {
                groups[groupKey] = [];
                groupKeys.push(groupKey);
            }
            groups[groupKey].push({
                Id: candidateId,
                OsClient: getPhysicalValue(candidate, ['OsClient', 'OSCLIENT', 'osclient']),
                StoreId: storeId,
                Version: version,
                IsDeleted: isDeletedRow(candidate)
            });
        }

        var loserIds = [];
        var repairDetails = [];
        for (var groupIndex = 0; groupIndex < groupKeys.length; groupIndex++) {
            var rows = groups[groupKeys[groupIndex]];
            if (!rows || rows.length < 2) continue;
            var winner = rows[0];
            for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                var candidateRow = rows[rowIndex];
                var winnerScore = (winner.IsDeleted ? 0 : 100)
                    + (isMissingTenant(winner.OsClient) ? 0 : 10);
                var candidateScore = (candidateRow.IsDeleted ? 0 : 100)
                    + (isMissingTenant(candidateRow.OsClient) ? 0 : 10);
                if (candidateScore > winnerScore
                    || (candidateScore == winnerScore && candidateRow.Id < winner.Id)) {
                    winner = candidateRow;
                }
            }
            for (var loserIndex = 0; loserIndex < rows.length; loserIndex++) {
                if (rows[loserIndex].Id != winner.Id) loserIds.push(rows[loserIndex].Id);
            }
            repair.CollisionGroups++;
            if (repairDetails.length < 20) {
                repairDetails.push(
                    winner.StoreId + '@' + winner.Version + '保留' + winner.Id + '，移除' + (rows.length - 1) + '条'
                );
            }
        }
        if (loserIds.length == 0) return repair;

        for (var batchStart = 0; batchStart < loserIds.length; batchStart += 200) {
            var batch = loserIds.slice(batchStart, batchStart + 200);
            var placeholders = [];
            var deleteSql = "DELETE FROM `sys_microistore_changelog` " +
                "WHERE (`OsClient` IS NULL OR TRIM(CAST(`OsClient` AS CHAR)) = '' OR `OsClient` = @p0) " +
                "AND `Id` IN (";
            var deleteCommand = null;
            for (var parameterIndex = 0; parameterIndex < batch.length; parameterIndex++) {
                placeholders.push('@p' + (parameterIndex + 1));
            }
            deleteSql += placeholders.join(',') + ')';
            deleteCommand = V8.Db.FromSql(deleteSql).AddInParameter('@p0', targetTenant);
            for (var bindIndex = 0; bindIndex < batch.length; bindIndex++) {
                deleteCommand = deleteCommand.AddInParameter('@p' + (bindIndex + 1), batch[bindIndex]);
            }
            var deleted = deleteCommand.ExecuteNonQuery();
            if (Number(deleted) != batch.length) {
                throw new Error(
                    '更新日志历史重复项发生并发变化：计划移除' + batch.length + '条，实际移除' + deleted + '条；' +
                    '事务已阻止提交，请重试'
                );
            }
            repair.RemovedRows += Number(deleted);
        }

        var remainingCollisionRows = V8.Db.FromSql(
            "SELECT COUNT(1) AS CollisionGroupCount FROM (" +
            "SELECT `StoreId`, `Version` FROM `sys_microistore_changelog` " +
            "WHERE (`OsClient` IS NULL OR TRIM(CAST(`OsClient` AS CHAR)) = '' OR `OsClient` = @p0) " +
            "AND `StoreId` IS NOT NULL AND `Version` IS NOT NULL " +
            "GROUP BY `StoreId`, `Version` " +
            "HAVING COUNT(1) > 1 AND SUM(CASE WHEN `OsClient` IS NULL " +
            "OR TRIM(CAST(`OsClient` AS CHAR)) = '' THEN 1 ELSE 0 END) > 0" +
            ") collision_groups"
        ).AddInParameter('@p0', targetTenant).ToArray();
        var remainingCollisionCount = remainingCollisionRows && remainingCollisionRows.length > 0
            ? getScalarCount(remainingCollisionRows[0], [
                'CollisionGroupCount', 'COLLISIONGROUPCOUNT', 'collisiongroupcount'
            ])
            : 0;
        if (remainingCollisionCount > 0) {
            throw new Error(
                '更新日志历史重复项清理后仍有' + remainingCollisionCount + '个冲突组，已阻止租户回填'
            );
        }
        debugLog.physical_schema_changelog_tenant_collision_repair =
            '冲突组' + repair.CollisionGroups + '个，移除无效重复记录' + repair.RemovedRows + '条；' +
            repairDetails.join('；') + (repair.CollisionGroups > repairDetails.length ? '；其余已省略' : '');
        return repair;
    };

    // PHYSICAL_NOT_NULL_BACKFILL_V1：老租户可能已经创建了新字段，但历史行仍为
    // NULL。MySQL 会在 MODIFY ... NOT NULL 之前校验既有数据，因此必须先使用包内
    // 明确声明的默认值做参数化回填，再收紧列约束。没有默认值时失败关闭，不能猜值。
    // PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1：租户字段不能把发布端 iTdos 写成固定默认值；
    // 包可显式声明 BACKFILL_VALUE_SOURCE=TargetOsClient，由可信 V8.OsClient 参数化回填。
    var prepareNotNullColumnData = function (tableName, columnName, sourceColumn, targetColumn) {
        if (!isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) return 0;

        var sourceNullable = String(getPhysicalValue(sourceColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        var targetNullable = String(getPhysicalValue(targetColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
        if (sourceNullable != 'NO' || targetNullable == 'NO') return 0;

        var sourceDefault = getPhysicalValue(sourceColumn, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
        var backfillValueSource = String(getPhysicalValue(sourceColumn, [
            'BACKFILL_VALUE_SOURCE',
            'BackfillValueSource'
        ]) || '').replace(/^\s+|\s+$/g, '');
        var missingValueWhere = "`" + columnName + "` IS NULL";
        if (backfillValueSource) {
            if (sourceDefault !== null && sourceDefault !== undefined) {
                throw new Error('NOT NULL回填契约不能同时声明数据库默认值和BACKFILL_VALUE_SOURCE');
            }
            if (backfillValueSource.toLowerCase() != 'targetosclient') {
                throw new Error('不支持的NOT NULL回填来源：' + backfillValueSource);
            }
            if (String(columnName || '').toLowerCase() != 'osclient') {
                throw new Error('TargetOsClient仅允许用于OsClient字段，当前字段=' + columnName);
            }
            sourceDefault = String(V8.OsClient || '').replace(/^\s+|\s+$/g, '');
            if (!sourceDefault) {
                throw new Error('目标租户标识为空，无法回填OsClient历史NULL数据');
            }
            missingValueWhere = "(`" + columnName + "` IS NULL OR " +
                "TRIM(CAST(`" + columnName + "` AS CHAR)) = '')";
        }

        var nullRows = V8.Db.FromSql(
            "SELECT COUNT(1) AS NullCount FROM `" + tableName + "` WHERE " + missingValueWhere
        ).ToArray();
        var nullCount = nullRows && nullRows.length > 0
            ? getScalarCount(nullRows[0], ['NullCount', 'NULLCOUNT', 'nullcount'])
            : 0;
        if (nullCount == 0) return 0;

        if (sourceDefault === null || sourceDefault === undefined) {
            throw new Error(
                '字段存在' + nullCount + '条NULL数据，但应用包要求NOT NULL且未声明可回填的默认值，已阻止修改'
            );
        }

        var columnType = String(getPhysicalValue(sourceColumn, ['COLUMN_TYPE', 'ColumnType', 'Type']) || '');
        var defaultText = String(sourceDefault);
        if (backfillValueSource.toLowerCase() == 'targetosclient'
            && String(tableName || '').toLowerCase() == 'sys_microistore_changelog') {
            repairMarketplaceChangeLogTenantBackfillCollisions(sourceDefault);
        }

        var updateSql = "UPDATE `" + tableName + "` SET `" + columnName + "` = @p0 WHERE " + missingValueWhere;
        var isCurrentTimestamp = /^(?:CURRENT_TIMESTAMP)(?:\(\d*\))?$/i.test(defaultText)
            && /^(?:datetime|timestamp)(?:\(|$)/i.test(normalizeSqlType(columnType));
        var isBitLiteral = /^b'[01]+'$/i.test(defaultText)
            && /^bit(?:\(|$)/i.test(normalizeSqlType(columnType));

        var updatedCount = 0;
        if (isCurrentTimestamp || isBitLiteral) {
            updateSql = "UPDATE `" + tableName + "` SET `" + columnName + "` = " + defaultText
                + " WHERE " + missingValueWhere;
            updatedCount = V8.Db.FromSql(updateSql).ExecuteNonQuery();
        } else {
            updatedCount = V8.Db.FromSql(updateSql)
                .AddInParameter('@p0', sourceDefault)
                .ExecuteNonQuery();
        }
        var remainingRows = V8.Db.FromSql(
            "SELECT COUNT(1) AS NullCount FROM `" + tableName + "` WHERE " + missingValueWhere
        ).ToArray();
        var remainingCount = remainingRows && remainingRows.length > 0
            ? getScalarCount(remainingRows[0], ['NullCount', 'NULLCOUNT', 'nullcount'])
            : 0;
        if (remainingCount > 0) {
            throw new Error(
                '字段回填后仍有' + remainingCount + '条缺失数据，已阻止收紧NOT NULL约束；请检查并发写入'
            );
        }
        return Number(updatedCount || 0);
    };

    var getTargetPhysicalColumns = function (tableName) {
        var map = {};
        if (!isSafeIdentifier(tableName)) return map;

        var rows = readTargetPhysicalColumns(tableName);

        for (var i = 0; i < rows.length; i++) {
            var columnName = rows[i].COLUMN_NAME;
            if (!columnName) continue;
            map[String(columnName).toLowerCase()] = rows[i];
        }
        if (!runtimeIsSqlServer) {
            // 元数据的 COLUMN_DEFAULT=null 不能区分默认 NULL 与 DROP DEFAULT。
            // 分组编译 DEFAULT 表达式，LIMIT 0 不读取业务行；错误列逐个记录供升级修复。
            var remaining = [];
            for (var key in map) {
                var candidate = map[key];
                if (key != 'id' && isSafeIdentifier(String(candidate.COLUMN_NAME))
                    && String(candidate.IS_NULLABLE || '').toUpperCase() == 'YES'
                    && (candidate.COLUMN_DEFAULT === null || candidate.COLUMN_DEFAULT === undefined)
                    && !/auto_increment|generated/i.test(String(candidate.EXTRA || '')))
                    remaining.push(String(candidate.COLUMN_NAME));
            }
            while (remaining.length) {
                try {
                    var defaults = remaining.map(function (name) { return 'DEFAULT(' + quotePhysicalIdentifier(name) + ')'; });
                    V8.Db.FromSql('SELECT ' + defaults.join(',') + ' FROM ' + quotePhysicalIdentifier(tableName) + ' LIMIT 0').ToScalar();
                    break;
                } catch (error) {
                    var missing = /Field '(.+)' doesn't have a default value/i.exec(String(error.message || error));
                    var missingIndex = -1;
                    if (missing) for (var j = 0; j < remaining.length; j++) {
                        if (remaining[j].toLowerCase() == missing[1].toLowerCase()) { missingIndex = j; break; }
                    }
                    if (missingIndex < 0) throw error;
                    map[remaining[missingIndex].toLowerCase()].MICROI_MISSING_DEFAULT = true;
                    remaining.splice(missingIndex, 1);
                }
            }
        }
        return map;
    };

    // UNUSED_WORKFLOW_PHYSICAL_SCHEMA_V1：旧导出器无条件附带工作流物理列。
    // 没有工作流资源或显式表依赖的包不能修改这些可选插件表，更不能要求它们已安装。
    var isUnusedWorkflowPhysicalSchema = function (tableName) {
        var name = String(tableName || '').toLowerCase();
        if (['wf_flowdesign', 'wf_node', 'wf_line'].indexOf(name) < 0) return false;
        if ((Package.WfFlowDesigns || []).length || (Package.WfNodes || []).length || (Package.WfLines || []).length) return false;
        var resources = (Package.DiyTables || []).concat(Package.DDLStatements || [], Package.DataSets || [], Package.SysMenus || []);
        for (var index = 0; index < resources.length; index++) {
            var resource = resources[index] || {};
            if (String(resource.TableName || resource.DiyTableName || resource.Name || '').toLowerCase() == name) return false;
        }
        return true;
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
            if (isUnusedWorkflowPhysicalSchema(tableKey)) continue;
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

    // 引用表快照只用于补齐缺列。既有列的类型、默认值和约束由声明该表的包维护，
    // 避免视觉等业务包中的旧 sys_menu 快照反向覆盖模块引擎的新结构。
    var packageOwnsPhysicalTable = function (tableName) {
        var expected = String(tableName || '').toLowerCase();
        var tables = Package.DiyTables || [];
        for (var tableIndex = 0; tableIndex < tables.length; tableIndex++) {
            if (String(tables[tableIndex].Name || tables[tableIndex].TableName || '').toLowerCase() == expected) return true;
        }
        return false;
    };

    // SQLSERVER_EXISTING_TEXT_EXPANSION_V1：历史列不能因“已存在”跳过容量修复。
    // 只扩宽文本，保留目标 Unicode、排序规则、可空性及默认约束，不猜测跨类型转换。
    var chooseSqlServerTextExpansion = function (sourceType, targetType, requireUnicode) {
        var target = normalizeSqlType(targetType);
        // SQLSERVER_UNICODE is an explicit, owned physical-column contract.
        // Preserve character capacity and tenant collation; never infer conversion
        // for unrelated legacy ANSI columns or non-text columns.
        if (requireUnicode === true && /^(?:n?(?:var)?char\((?:\d+|max)\)|n?text)$/.test(target)) {
            var unicodeCapacity = Math.max(getTextTypeCapacity(mapToMySQLType(sourceType)), getTextTypeCapacity(target));
            return unicodeCapacity > 4000 ? 'nvarchar(max)' :
                (/^n?char\(/.test(target) ? 'nchar(' : 'nvarchar(') + unicodeCapacity + ')';
        }
        var match = /^(n?)(var)?char\((\d+)\)$/.exec(target);
        if (!match) return String(targetType);
        var sourceCapacity = getTextTypeCapacity(mapToMySQLType(sourceType));
        if (sourceCapacity <= Number(match[3])) return String(targetType);
        var limit = match[1] ? 4000 : 8000;
        return match[1] + (sourceCapacity > limit ? 'varchar(max)' :
            (match[2] || '') + 'char(' + sourceCapacity + ')');
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
                        var addSql = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName)
                            + (runtimeIsSqlServer ? ' ADD ' : ' ADD COLUMN ') + definition;
                        try {
                            V8.Db.FromSql(addSql).ExecuteNonQuery();
                        } catch (physicalAddError) {
                            if (runtimeIsSqlServer
                                || !isMysqlRowSizeTooLargeError(physicalAddError)
                                || !applyPackageColumnTypeOverride(
                                    tableName,
                                    '',
                                    columnName,
                                    'mediumtext',
                                    '物理列新增触发MySQL 65535字节行宽上限'
                                )) throw physicalAddError;
                            definition = buildPhysicalColumnDefinition(sourceColumn, false, 'mediumtext');
                            addSql = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName)
                                + ' ADD COLUMN ' + definition;
                            V8.Db.FromSql(addSql).ExecuteNonQuery();
                        }
                        result.Added++;
                        debugLog['physical_schema_added_' + tableName + '_' + columnName] =
                            String(mysqlOffpageTypeOverrides[mysqlOffpageOverrideKey(tableName, columnName)] || columnType);
                        continue;
                    }

                    if (!packageOwnsPhysicalTable(tableName)) {
                        result.Skipped++;
                        continue;
                    }

                    if (runtimeIsSqlServer) {
                        var expandedType = chooseSqlServerTextExpansion(columnType, targetColumn.COLUMN_TYPE,
                            sourceColumn.SQLSERVER_UNICODE === true);
                        var retainedNullable = String(columnName).toLowerCase() == 'id'
                            ? ' NOT NULL' : ' NULL';
                        if (normalizeSqlType(expandedType) == normalizeSqlType(targetColumn.COLUMN_TYPE)
                            && (String(targetColumn.IS_NULLABLE).toUpperCase() == 'NO' ? ' NOT NULL' : ' NULL') == retainedNullable) {
                            result.Skipped++;
                            continue;
                        }
                        if (targetColumn.COLLATION_NAME && !isSafeIdentifier(targetColumn.COLLATION_NAME))
                            throw new Error('SQL Server 目标列排序规则名称无效');
                        // COLLATE requires a literal collation name, not a bracket-quoted identifier.
                        var retainedCollation = targetColumn.COLLATION_NAME
                            ? ' COLLATE ' + targetColumn.COLLATION_NAME : '';
                        if (sourceColumn.SQLSERVER_UNICODE === true && !/^n/.test(normalizeSqlType(targetColumn.COLUMN_TYPE))) {
                            alterSqlServerColumnPreservingIndexes(tableName, columnName, expandedType + retainedCollation, retainedNullable);
                        } else {
                            V8.Db.FromSql('ALTER TABLE ' + quotePhysicalIdentifier(tableName) + ' ALTER COLUMN '
                                + quotePhysicalIdentifier(columnName) + ' ' + expandedType + retainedCollation + retainedNullable)
                                .ExecuteNonQuery();
                        }
                        var expandedReadback = getTargetPhysicalColumns(tableName)[String(columnName).toLowerCase()];
                        if (!expandedReadback || normalizeSqlType(expandedReadback.COLUMN_TYPE) != normalizeSqlType(expandedType)
                            || (String(expandedReadback.IS_NULLABLE).toUpperCase() == 'NO' ? ' NOT NULL' : ' NULL') != retainedNullable
                            || expandedReadback.COLUMN_DEFAULT != targetColumn.COLUMN_DEFAULT
                            || expandedReadback.COLLATION_NAME != targetColumn.COLLATION_NAME) {
                            throw new Error('SQL Server 文本列扩容后结构回读不一致，已阻止继续升级');
                        }
                        result.Modified++;
                        debugLog['physical_schema_expanded_' + tableName + '_' + columnName] =
                            targetColumn.COLUMN_TYPE + '->' + expandedType;
                        continue;
                    }

                    var sourceNullable = String(columnName).toLowerCase() == 'id' ? 'NO' : 'YES';
                    var targetNullable = String(targetColumn.IS_NULLABLE || '').toUpperCase();
                    var sourceDefault = getPhysicalValue(sourceColumn, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
                    var targetDefault = targetColumn.COLUMN_DEFAULT;
                    var sourceComment = String(getPhysicalValue(sourceColumn, ['COLUMN_COMMENT', 'ColumnComment', 'Comment']) || '');
                    var targetComment = String(targetColumn.COLUMN_COMMENT || '');
                    var sourcePhysicalType = mapToMySQLType(columnType);
                    var effectiveColumnType = chooseCompatibleColumnType(sourcePhysicalType, targetColumn.COLUMN_TYPE);
                    var typeChanged = normalizeSqlType(targetColumn.COLUMN_TYPE) != normalizeSqlType(effectiveColumnType);
                    var nullChanged = sourceNullable && sourceNullable != targetNullable;
                    var comparableDefault = function (value) {
                        if (value === null || value === undefined) return 'null:';
                        var text = String(value);
                        var timestampDefault = mysqlCurrentTimestampDefault(text, effectiveColumnType);
                        if (timestampDefault) return 'timestamp:' + timestampDefault;
                        if (isNumericSqlType(effectiveColumnType) && /^b'[01]'$/i.test(text)) text = text.charAt(2);
                        return 'value:' + text;
                    };
                    var defaultChanged = !runtimeIsSqlServer && (comparableDefault(sourceDefault) != comparableDefault(targetDefault)
                        || targetColumn.MICROI_MISSING_DEFAULT === true);
                    // MYSQL_DEFAULT_METADATA_ONLY_V1：普通默认值只修改元数据。
                    // MYSQL_TEMPORAL_DEFAULT_COMPAT_V1：MySQL 5.7 的 ALTER COLUMN
                    // 不支持 CURRENT_TIMESTAMP；时间默认值改用原目标列完整定义，
                    // 保留类型、精度、可空性与 ON UPDATE，并禁止 COPY/独占 DML 锁回退。
                    if (!typeChanged && !nullChanged && defaultChanged
                        && !/text|blob|json/i.test(effectiveColumnType)
                        && !/auto_increment/i.test(String(targetColumn.EXTRA || ''))) {
                        var timestampDefault = mysqlCurrentTimestampDefault(sourceDefault, effectiveColumnType);
                        // PLATFORM_MYSQL_NULL_DEFAULT_V1：DROP DEFAULT 即使对允许 NULL
                        // 的列也会留下 NO_DEFAULT_VALUE_FLAG，使省略字段的 INSERT 报 1364。
                        var defaultAction = columnName.toLowerCase() == 'id' ? ' DROP DEFAULT' : ' SET DEFAULT NULL';
                        if (sourceDefault !== null && sourceDefault !== undefined) {
                            var defaultLiteral = String(sourceDefault);
                            if (/^b'[01]+'$/i.test(defaultLiteral)) {
                                defaultAction = ' SET DEFAULT ' + defaultLiteral;
                            } else {
                                defaultAction = " SET DEFAULT '" + sqlString(defaultLiteral) + "'";
                            }
                        }
                        var defaultClause = ' ALTER COLUMN ' + quotePhysicalIdentifier(columnName) + defaultAction;
                        if (timestampDefault) {
                            var targetDefinition = {};
                            for (var targetAttribute in targetColumn) targetDefinition[targetAttribute] = targetColumn[targetAttribute];
                            targetDefinition.COLUMN_NAME = columnName;
                            targetDefinition.COLUMN_DEFAULT = timestampDefault;
                            defaultClause = ' MODIFY COLUMN ' + buildPhysicalColumnDefinition(targetDefinition, false, targetColumn.COLUMN_TYPE);
                        }
                        V8.Db.FromSql('ALTER TABLE ' + quotePhysicalIdentifier(tableName) + defaultClause
                            + ', ALGORITHM=INPLACE, LOCK=NONE').ExecuteNonQuery();
                        var defaultReadback = getTargetPhysicalColumns(tableName)[String(columnName).toLowerCase()];
                        if (!defaultReadback
                            || defaultReadback.MICROI_MISSING_DEFAULT === true
                            || comparableDefault(defaultReadback.COLUMN_DEFAULT) != comparableDefault(sourceDefault)) {
                            throw new Error('字段默认值变更后回读不一致，已阻止继续升级');
                        }
                        result.Modified++;
                        debugLog['physical_schema_default_only_' + tableName + '_' + columnName] =
                            '仅更新默认值元数据，未重写字段类型、字符集、排序规则或历史数据';
                        continue;
                    }
                    // 说明保留在 diy_field；仅注释差异不能对线上大表加元数据锁或重建。
                    if (typeChanged || nullChanged || defaultChanged) {
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
                        if (normalizedNumericData.LegacySwitchBinaryCount > 0) {
                            debugLog['physical_schema_normalized_binary_switch_' + tableName + '_' + columnName] =
                                '已将' + normalizedNumericData.LegacySwitchBinaryCount + '条历史单字节00/01开关值规范为0/1';
                        }
                        if (normalizedNumericData.BlankCount > 0) {
                            debugLog['physical_schema_normalized_' + tableName + '_' + columnName] =
                                '已将' + normalizedNumericData.BlankCount + '条历史空字符串规范为NULL';
                        }
                        // 普通字段只放宽约束，保留历史 NULL；不得为了迁就旧包伪造业务值。
                        var backfilledNullCount = String(columnName).toLowerCase() == 'id' ? prepareNotNullColumnData(
                            tableName,
                            columnName,
                            sourceColumn,
                            targetColumn
                        ) : 0;
                        if (backfilledNullCount > 0) {
                            var backfillValueSource = String(getPhysicalValue(sourceColumn, [
                                'BACKFILL_VALUE_SOURCE',
                                'BackfillValueSource'
                            ]) || '').toLowerCase();
                            debugLog['physical_schema_backfilled_' + tableName + '_' + columnName] =
                                '已按' + (backfillValueSource == 'targetosclient'
                                    ? '目标租户标识'
                                    : '应用包默认值')
                                + '回填' + backfilledNullCount + '条历史NULL数据';
                        }
                        var definition = runtimeIsSqlServer
                            ? quotePhysicalIdentifier(columnName) + ' ' + mapToMySQLType(effectiveColumnType)
                                + (sourceNullable == 'NO' ? ' NOT NULL' : ' NULL')
                            : buildPhysicalColumnDefinition(sourceColumn, false, effectiveColumnType);
                        if (!definition) continue;
                        var modifySql = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName)
                            + (runtimeIsSqlServer ? ' ALTER COLUMN ' : ' MODIFY COLUMN ') + definition;
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

    // BACKGROUND_TASK_IDEMPOTENCY_DUPLICATE_REPAIR_V1：极少数旧库在唯一索引
    // 建立前已经因历史竞态留下相同幂等键。只归档明确终态的重复行；活动状态或
    // 未知状态一律视为仍有执行语义，同一键出现两条时失败关闭，绝不删除任务。
    function isTerminalBackgroundTaskStatus(status) {
        var normalized = String(status || '').toLowerCase();
        return normalized == 'succeeded' || normalized == 'failed' || normalized == 'canceled';
    }

    function selectBackgroundTaskDuplicateCanonical(rows) {
        rows = rows || [];
        var activeRows = [];
        var terminalRows = [];
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            var row = rows[rowIndex] || {};
            if (isTerminalBackgroundTaskStatus(row.Status)) terminalRows.push(row);
            else activeRows.push(row);
        }
        if (activeRows.length > 1) {
            var activeIds = [];
            for (var activeIndex = 0; activeIndex < activeRows.length; activeIndex++) {
                activeIds.push(String(activeRows[activeIndex].Id || ''));
            }
            throw new Error(
                '后台任务幂等键存在多条活动记录，拒绝自动归档：' + activeIds.join(',')
                + '；请先确认权威执行记录后再重试'
            );
        }
        if (activeRows.length == 1) return activeRows[0];
        terminalRows.sort(function (left, right) {
            var leftSucceeded = String(left.Status || '').toLowerCase() == 'succeeded' ? 1 : 0;
            var rightSucceeded = String(right.Status || '').toLowerCase() == 'succeeded' ? 1 : 0;
            if (leftSucceeded != rightSucceeded) return rightSucceeded - leftSucceeded;
            var leftTime = String(left.UpdateTime || left.CreateTime || '');
            var rightTime = String(right.UpdateTime || right.CreateTime || '');
            if (leftTime != rightTime) return leftTime > rightTime ? -1 : 1;
            var leftId = String(left.Id || '');
            var rightId = String(right.Id || '');
            return leftId == rightId ? 0 : (leftId > rightId ? -1 : 1);
        });
        return terminalRows.length > 0 ? terminalRows[0] : null;
    }

    var repairBackgroundTaskIdempotencyDuplicates = function (ddlInfo, ddlText, ddlError) {
        if (!isBackgroundTaskBootstrapPackage()
            || !ddlInfo
            || String(ddlInfo.Kind || '').toLowerCase() != 'index'
            || String(ddlInfo.TableName || '').toLowerCase() != 'mci_background_task') return -1;
        var indexName = String(ddlInfo.IndexName || '').toLowerCase();
        if (indexName != 'ux_mci_background_task_idempotency'
            && indexName != 'ux_mci_bg_task_runtime_idem') return -1;
        var errorText = String(ddlError && ddlError.message ? ddlError.message : ddlError || '');
        if (!/duplicate entry|duplicate key|unique constraint|ora-00001/i.test(errorText)) return -1;

        var ddlLower = String(ddlText || '').toLowerCase();
        var scopeColumns = ['OsClient'];
        if (ddlLower.indexOf('runtimeosclienttype') >= 0) scopeColumns.push('RuntimeOsClientType');
        if (ddlLower.indexOf('runtimeosclientnetwork') >= 0) scopeColumns.push('RuntimeOsClientNetwork');
        scopeColumns.push('IdempotencyKey');
        var selectColumns = ['Id', 'Status', 'CreateTime', 'UpdateTime'];
        for (var scopeIndex = 0; scopeIndex < scopeColumns.length; scopeIndex++) {
            if (selectColumns.indexOf(scopeColumns[scopeIndex]) < 0) selectColumns.push(scopeColumns[scopeIndex]);
        }

        var readRows = function () {
            return V8.Db.FromSql(
                'SELECT ' + selectColumns.join(',')
                + ' FROM mci_background_task WHERE IdempotencyKey IS NOT NULL AND IdempotencyKey <> \'\''
            ).ToArray() || [];
        };
        var groupDuplicates = function (rows) {
            var groups = {};
            for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                var row = rows[rowIndex] || {};
                var values = [];
                var completeScope = true;
                for (var columnIndex = 0; columnIndex < scopeColumns.length; columnIndex++) {
                    var value = getPhysicalValue(row, [scopeColumns[columnIndex]]);
                    // 当前物理导入器以 MySQL 为目标；复合唯一索引任一列为 NULL 时
                    // 不会形成冲突，不能把这类记录误判为重复历史。
                    if (value === null || value === undefined) {
                        completeScope = false;
                        break;
                    }
                    values.push(String(value));
                }
                if (!completeScope) continue;
                var groupKey = JSON.stringify(values);
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(row);
            }
            var duplicates = [];
            for (var groupKey in groups) {
                if (Object.prototype.hasOwnProperty.call(groups, groupKey) && groups[groupKey].length > 1) {
                    duplicates.push(groups[groupKey]);
                }
            }
            return duplicates;
        };

        var duplicateGroups = groupDuplicates(readRows());
        var archivedCount = 0;
        for (var groupIndex = 0; groupIndex < duplicateGroups.length; groupIndex++) {
            var groupRows = duplicateGroups[groupIndex];
            var canonical = selectBackgroundTaskDuplicateCanonical(groupRows);
            if (!canonical || !canonical.Id) {
                throw new Error('后台任务历史重复幂等键缺少可保留的权威记录，拒绝自动归档');
            }
            for (var duplicateIndex = 0; duplicateIndex < groupRows.length; duplicateIndex++) {
                var duplicateRow = groupRows[duplicateIndex] || {};
                if (String(duplicateRow.Id || '') == String(canonical.Id)) continue;
                if (!isTerminalBackgroundTaskStatus(duplicateRow.Status)) {
                    throw new Error(
                        '后台任务历史重复幂等键包含非终态记录 ' + String(duplicateRow.Id || '')
                        + '，拒绝自动归档'
                    );
                }
                var originalKey = String(duplicateRow.IdempotencyKey || '');
                var archivedKey = 'archived-duplicate:' + String(duplicateRow.Id || '');
                var updated = V8.Db.FromSql(
                    'UPDATE mci_background_task SET IdempotencyKey=@p0 '
                    + 'WHERE Id=@p1 AND IdempotencyKey=@p2'
                )
                    .AddInParameter('@p0', archivedKey)
                    .AddInParameter('@p1', String(duplicateRow.Id || ''))
                    .AddInParameter('@p2', originalKey)
                    .ExecuteNonQuery();
                if (parseInt(updated || 0, 10) > 0) archivedCount++;
            }
        }
        if (groupDuplicates(readRows()).length > 0) {
            throw new Error('后台任务历史重复幂等键归档后回读仍有冲突，拒绝创建唯一索引');
        }
        return archivedCount;
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

        var indexReadSql = runtimeIsSqlServer
            ? 'SELECT i.name AS INDEX_NAME, c.name AS COLUMN_NAME, ic.key_ordinal AS SEQ_IN_INDEX, '
                + 'CASE WHEN i.is_unique = 1 THEN 0 ELSE 1 END AS NON_UNIQUE '
                + 'FROM sys.indexes i INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id '
                + 'INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id '
                + 'WHERE i.object_id = OBJECT_ID(@p0) AND i.is_disabled = 0 AND i.is_hypothetical = 0 '
                + 'AND ic.key_ordinal > 0 ORDER BY i.name, ic.key_ordinal'
            : 'SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS '
                + 'WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0) ORDER BY INDEX_NAME, SEQ_IN_INDEX';
        var indexRows = V8.Db.FromSql(indexReadSql).AddInParameter('@p0', tableName).ToArray() || [];
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
            { Name: 'ix_mci_bg_task_lane_claim', Columns: ['OsClient', 'ApiEngineKey', 'RuntimeOsClientType', 'RuntimeOsClientNetwork', 'Status', 'NextRunTime', 'LeaseExpiresAt', 'CreateTime'], Unique: false },
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

    // DDL_OBJECT_READBACK_FAIL_CLOSED_V1: do not continue to asset/data import after failed DDL.
    var requirePackageDdlObject = function (ddlInfo, error) {
        if (ddlInfo.Kind != 'table' && ddlInfo.Kind != 'index') return;
        var exists = ddlInfo.Kind == 'table' ? ddlTableExists(ddlInfo.TableName)
            : ddlIndexExists(ddlInfo.TableName, ddlInfo.IndexName);
        if (!exists) throw new Error('应用包物理结构未就绪：' + ddlInfo.TableName
            + (ddlInfo.IndexName ? '.' + ddlInfo.IndexName : '') + '；'
            + (error ? String(error.message || error) : 'DDL 执行后强回读仍不存在'));
    };

    var normalizePackageDdlNullability = function (ddl) {
        if (runtimeIsSqlServer || !/^\s*CREATE\s+TABLE\b/i.test(String(ddl || ''))) return ddl;
        // 历史包可能只有 CREATE TABLE。按最外层列定义切分，保留引号中的逗号、
        // NOT NULL 文本、默认值及表级索引，不能用全局替换破坏注释和主键。
        var start = ddl.indexOf('('), depth = 1, quote = '', partStart = start + 1;
        if (start < 0) return ddl;
        var parts = [], end = -1;
        var makeNullable = function (part) {
            var field = /^\s*`((?:``|[^`])+)`\s+/i.exec(part);
            var constraints = part.replace(/`(?:``|[^`])*`|'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"/g, '');
            if (!field || field[1].toLowerCase() == 'id' || /\b(?:PRIMARY\s+KEY|AUTO_INCREMENT|GENERATED)\b/i.test(constraints)) return part;
            return part.replace(/`(?:``|[^`])*`|'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"|(\bNOT\s+NULL\b)/ig,
                function (token, constraint) { return constraint ? 'NULL' : token; });
        };
        for (var index = start + 1; index < ddl.length; index++) {
            var char = ddl.charAt(index);
            if (quote) {
                if (char == '\\') { index++; continue; }
                if (char == quote) {
                    if (ddl.charAt(index + 1) == quote) index++;
                    else quote = '';
                }
                continue;
            }
            if (char == "'" || char == '"' || char == '`') { quote = char; continue; }
            if (char == '(') depth++;
            if (char == ')') {
                depth--;
                if (depth == 0) { parts.push(makeNullable(ddl.substring(partStart, index))); end = index; break; }
            }
            if (char == ',' && depth == 1) { parts.push(makeNullable(ddl.substring(partStart, index))); partStart = index + 1; }
        }
        if (end < 0) throw new Error('应用包 CREATE TABLE 括号不完整，拒绝执行');
        return ddl.substring(0, start + 1) + parts.join(',') + ddl.substring(end);
    };

    var executePackageDdl = function (ddlItem, ddlInfo) {
        if (!runtimeIsSqlServer) {
            V8.Db.FromSql(ddlItem.DDL).ExecuteNonQuery();
            return;
        }

        if (ddlInfo.Kind == 'table') {
            var physicalColumns = Package.PhysicalColumns || [];
            var definitions = [];
            var primaryColumns = [];
            var seenColumns = {};
            for (var columnIndex = 0; columnIndex < physicalColumns.length; columnIndex++) {
                var column = physicalColumns[columnIndex] || {};
                var physicalTableName = String(getPhysicalValue(column, ['TABLE_NAME', 'TableName']) || '');
                if (physicalTableName.toLowerCase() != String(ddlInfo.TableName).toLowerCase()) continue;
                var physicalColumnName = String(getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']) || '');
                if (!isSafeIdentifier(physicalColumnName) || seenColumns[physicalColumnName.toLowerCase()]) continue;
                var columnDefinition = buildPhysicalColumnDefinition(column, false);
                if (!columnDefinition) continue;
                definitions.push(columnDefinition);
                seenColumns[physicalColumnName.toLowerCase()] = true;
                if (String(getPhysicalValue(column, ['COLUMN_KEY', 'ColumnKey']) || '').toUpperCase() == 'PRI') {
                    primaryColumns.push(quotePhysicalIdentifier(physicalColumnName));
                }
            }
            if (definitions.length == 0) {
                throw new Error('SQL Server 建表失败：应用包未提供 ' + ddlInfo.TableName + ' 的 PhysicalColumns');
            }
            if (primaryColumns.length == 0 && seenColumns.id) primaryColumns.push(quotePhysicalIdentifier('Id'));
            if (primaryColumns.length > 0) {
                definitions.push('PRIMARY KEY (' + primaryColumns.join(',') + ')');
            }
            V8.Db.FromSql(
                'CREATE TABLE ' + quotePhysicalIdentifier(ddlInfo.TableName) + ' (' + definitions.join(',') + ')'
            ).ExecuteNonQuery();
            return;
        }

        if (ddlInfo.Kind == 'index') {
            var ddlText = String(ddlItem.DDL || '');
            var columnMatch = ddlText.match(/\(([^\)]+)\)/);
            if (!columnMatch) throw new Error('SQL Server 索引转换失败：未解析到索引列');
            var rawColumns = columnMatch[1].split(',');
            var indexColumns = [];
            for (var indexColumnIndex = 0; indexColumnIndex < rawColumns.length; indexColumnIndex++) {
                var indexColumn = String(rawColumns[indexColumnIndex] || '')
                    .replace(/[`"\[\]]/g, '')
                    .replace(/\(\d+\)\s*$/g, '')
                    .replace(/^\s+|\s+$/g, '');
                if (!isSafeIdentifier(indexColumn)) throw new Error('SQL Server 索引列不安全：' + indexColumn);
                indexColumns.push(quotePhysicalIdentifier(indexColumn));
            }
            var isUniqueIndex = /^\s*CREATE\s+UNIQUE\s+INDEX/i.test(ddlText)
                || /\bADD\s+UNIQUE\s+(?:INDEX|KEY)\b/i.test(ddlText);
            V8.Db.FromSql(
                'CREATE ' + (isUniqueIndex ? 'UNIQUE ' : '') + 'INDEX '
                + quotePhysicalIdentifier(ddlInfo.IndexName) + ' ON '
                + quotePhysicalIdentifier(ddlInfo.TableName) + ' (' + indexColumns.join(',') + ')'
            ).ExecuteNonQuery();
            return;
        }

        throw new Error('SQL Server 暂不支持的应用包 DDL：' + String(ddlItem.DDL || '').substring(0, 120));
    };

    // PACKAGE_DECLARED_IDENTIFIER_STORAGE_V1: CREATE IF NOT EXISTS does not
    // update old CHAR(36) identifiers. Connector/NET treats those as Guid even
    // when the package now uses ULID strings. Apply only an explicitly declared
    // identifier widening, keeping the target's complete column definition.
    var repairDeclaredLegacyIdentifierStorage = function (ddlItem) {
        if (runtimeIsSqlServer || runtimeIsOracle) return 0;
        var tableName = String(ddlItem.TableName || '');
        var ownsTable = false;
        for (var tableIndex = 0; tableIndex < (Package.DiyTables || []).length; tableIndex++) {
            if (String(Package.DiyTables[tableIndex].Name || '').toLowerCase() === tableName.toLowerCase()) ownsTable = true;
        }
        if (!ownsTable || !isSafeIdentifier(tableName)) return 0;
        var declared = {}, match;
        var pattern = /(?:^|[,\n(])\s*`([A-Za-z_][A-Za-z0-9_]*)`\s+varchar\s*\((\d+)\)/gi;
        while ((match = pattern.exec(String(ddlItem.DDL || ''))) !== null) {
            if (/id$/i.test(match[1]) && Number(match[2]) >= 36) declared[match[1].toLowerCase()] = Number(match[2]);
        }
        if (Object.keys(declared).length === 0) return 0;
        var targetColumns = getTargetPhysicalColumns(tableName);
        var modifications = [];
        var currentDefinition = '';
        for (var columnKey in declared) {
            var column = targetColumns[columnKey];
            if (!column || normalizeSqlType(column.COLUMN_TYPE) !== 'char(36)') continue;
            if (!currentDefinition) {
                var ddlRows = V8.Db.FromSql('SHOW CREATE TABLE ' + quotePhysicalIdentifier(tableName)).ToArray();
                currentDefinition = String(getPhysicalValue(ddlRows && ddlRows[0], ['Create Table', 'CreateTable']) || '');
                if (!currentDefinition) throw new Error('旧标识列兼容无法读取原始DDL：' + tableName);
            }
            var columnName = String(column.COLUMN_NAME);
            var lines = currentDefinition.split(/\r?\n/), original = '';
            var columnPattern = new RegExp('^\\s*`' + columnName + '`\\s+char\\(36\\)', 'i');
            for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                if (columnPattern.test(lines[lineIndex])) original = lines[lineIndex].replace(/,\s*$/, '').trim();
            }
            if (!original) throw new Error('旧标识列兼容无法保留原始定义：' + tableName + '.' + columnName);
            modifications.push('MODIFY COLUMN ' + original.replace(/^(\s*`[^`]+`\s+)char\(36\)/i, '$1varchar(' + declared[columnKey] + ')'));
        }
        if (modifications.length) {
            // MYSQL_IDENTIFIER_FOREIGN_KEY_SCOPE_V1：外键涉及的转换使用后端
            // 专用非池化连接，不删除外键，不把会话检查开关泄漏给其它请求。
            var foreignKeys = V8.Db.FromSql(
                'SELECT COUNT(*) AS ForeignKeyCount FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE '
                + 'WHERE REFERENCED_TABLE_NAME IS NOT NULL AND '
                + '((TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(@p0)) OR '
                + '(REFERENCED_TABLE_SCHEMA=DATABASE() AND LOWER(REFERENCED_TABLE_NAME)=LOWER(@p0)))'
            ).AddInParameter('@p0', tableName).ToArray();
            if (Number(getPhysicalValue(foreignKeys && foreignKeys[0], ['ForeignKeyCount', 'FOREIGNKEYCOUNT', 'foreignkeycount']) || 0) > 0) {
                if (typeof V8.Db.WidenMySqlIdentifierColumns !== 'function')
                    throw new Error('旧标识列涉及外键，当前后端缺少安全兼容方法，请先升级平台框架：' + tableName);
                var specifications = [];
                for (var declaredColumn in declared) specifications.push(declaredColumn + ':' + declared[declaredColumn]);
                V8.Db.WidenMySqlIdentifierColumns(tableName, specifications.join(','));
                debugLog['legacy_identifier_foreign_keys_' + tableName] = '保留外键，在独立非池化连接内完成标识列兼容';
            } else {
                V8.Db.FromSql('ALTER TABLE ' + quotePhysicalIdentifier(tableName) + ' ' + modifications.join(', ')).ExecuteNonQuery();
            }
            var verified = getTargetPhysicalColumns(tableName);
            for (var key in declared) {
                if (targetColumns[key] && normalizeSqlType(targetColumns[key].COLUMN_TYPE) === 'char(36)'
                    && (!verified[key] || normalizeSqlType(verified[key].COLUMN_TYPE) !== 'varchar(' + declared[key] + ')'))
                    throw new Error('旧标识列兼容回读失败：' + tableName + '.' + key);
            }
            debugLog['legacy_identifier_storage_' + tableName] = '按应用包声明无损扩宽' + modifications.length + '个标识列，原默认值、注释和约束保留';
        }
        return modifications.length;
    };
    var ddlTablesChecked = {};
    for (var i = 0; i < ddlStatements.length; i++) {
        var ddlItem = ddlStatements[i];
        if (!ddlItem.DDL || !ddlItem.TableName) continue;
        var normalizedDdlItem = {};
        for (var ddlProperty in ddlItem) normalizedDdlItem[ddlProperty] = ddlItem[ddlProperty];
        normalizedDdlItem.DDL = normalizePackageDdlNullability(String(ddlItem.DDL));
        ddlItem = normalizedDdlItem;

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
                executePackageDdl(ddlItem, ddlInfo);
                ddlExecuted++;
                debugLog['ddl_execute_' + ddlLogKey] = ddlInfo.Kind == 'index' ? '索引创建成功' : 'DDL执行成功';
            } catch (ddlError) {
                var finalDdlError = ddlError;
                var recoveredFromRowSize = false;
                var recoveredFromIdempotencyDuplicate = false;
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
                    try {
                        var archivedDuplicateTasks = repairBackgroundTaskIdempotencyDuplicates(
                            ddlInfo,
                            ddlItem.DDL,
                            finalDdlError
                        );
                        if (archivedDuplicateTasks >= 0) {
                            V8.Db.FromSql(ddlItem.DDL).ExecuteNonQuery();
                            recoveredFromIdempotencyDuplicate = true;
                            ddlExecuted++;
                            debugLog['ddl_duplicate_idempotency_recovered_' + ddlLogKey] =
                                '已保留权威任务并归档' + archivedDuplicateTasks + '条终态历史重复幂等键，唯一索引创建成功';
                        }
                    } catch (idempotencyRepairError) {
                        finalDdlError = idempotencyRepairError;
                    }
                }

                if (!recoveredFromRowSize && !recoveredFromIdempotencyDuplicate) {
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
                        requirePackageDdlObject(ddlInfo, finalDdlError);
                    }
                }
            }
        }

        requirePackageDdlObject(ddlInfo, null);
        // 每张表只检查一次字段；索引语句不能重复触发相同的物理字段同步。
        var ddlTableKey = String(ddlInfo.TableName || ddlItem.TableName).toLowerCase();
        if (ddlInfo.Kind == 'index' || ddlTablesChecked[ddlTableKey]) continue;
        ddlTablesChecked[ddlTableKey] = true;
        repairDeclaredLegacyIdentifierStorage(ddlItem);

        // 无论表是新创建还是已存在，都检查并补充缺失的字段。
        try {
            // 查询表的所有字段
            var columnsData = readTargetPhysicalColumns(ddlItem.TableName);

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
    activeImportStage = '步骤1-表定义';

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
    activeImportStage = '步骤2-字段定义';

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
    activeImportStage = '步骤2.5-物理字段同步';

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
                var oldColumnCount = 0;
                var newColumnCount = 0;
                if (runtimeIsSqlServer) {
                    var renameColumns = readTargetPhysicalColumns(tableName);
                    for (var renameColumnIndex = 0; renameColumnIndex < renameColumns.length; renameColumnIndex++) {
                        var renameColumnName = String(getPhysicalValue(renameColumns[renameColumnIndex], ['COLUMN_NAME', 'ColumnName']) || '');
                        if (renameColumnName.toLowerCase() == String(oldName).toLowerCase()) oldColumnCount++;
                        if (renameColumnName.toLowerCase() == String(newName).toLowerCase()) newColumnCount++;
                    }
                } else {
                    oldColumnCount = V8.Db.FromSql(
                        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1'
                    ).AddInParameter('@p0', tableName)
                        .AddInParameter('@p1', oldName)
                        .ToScalar();
                    newColumnCount = V8.Db.FromSql(
                        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1'
                    ).AddInParameter('@p0', tableName)
                        .AddInParameter('@p1', newName)
                        .ToScalar();
                }

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
                // SQLSERVER_PHYSICAL_FIELD_CHANGE_V1：SQL Server 使用 sp_rename，
                // MySQL 继续使用 CHANGE COLUMN 并同步类型与注释。
                var renameSQL = '';
                if (runtimeIsSqlServer) {
                    renameSQL = "DECLARE @qualified nvarchar(776); " +
                        "SELECT TOP (1) @qualified = QUOTENAME(TABLE_SCHEMA) + N'.' + QUOTENAME(TABLE_NAME) + N'.' + QUOTENAME(COLUMN_NAME) " +
                        "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_CATALOG = DB_NAME() AND LOWER(TABLE_NAME) = LOWER(@p0) AND LOWER(COLUMN_NAME) = LOWER(@p1); " +
                        "IF @qualified IS NULL THROW 50000, '待重命名字段不存在', 1; " +
                        "EXEC sys.sp_rename @qualified, @p2, N'COLUMN';";
                } else {
                    renameSQL = 'ALTER TABLE `' + tableName + '` CHANGE COLUMN `' + oldName + '` `' + newName + '` ' + newType;

                    if (newName == 'Id') {
                        renameSQL += ' NOT NULL PRIMARY KEY';
                    } else {
                        renameSQL += ' NULL';
                    }

                    if (newLabel && newLabel !== newName) {
                        var comment = newLabel.replace(/'/g, "''");
                        renameSQL += " COMMENT '" + comment + "'";
                    }
                }

                try {
                    var renameCommand = V8.Db.FromSql(renameSQL);
                    if (runtimeIsSqlServer) {
                        renameCommand.AddInParameter('@p0', tableName)
                            .AddInParameter('@p1', oldName)
                            .AddInParameter('@p2', newName);
                    }
                    renameCommand.ExecuteNonQuery();
                    physicalFieldsRenamed++;
                    debugLog['rename_' + tableName + '_' + oldName] = '重命名为 ' + newName;
                } catch (renameError) {
                    debugLog['rename_error_' + tableName + '_' + oldName] = renameError.message;
                }
            }
            // 如果只是类型或注释变化，执行修改
            else if (change.OldType != change.NewType || change.OldLabel != change.NewLabel) {
                // 标签只保存在元数据；所有数据库都不能因此重建线上业务/日志大表。
                if (change.OldType == change.NewType) {
                    debugLog['modify_skipped_metadata_only_' + tableName + '_' + newName] =
                        '仅字段标签变化，物理列无需修改';
                    continue;
                }
                var modifySQL = '';
                if (runtimeIsSqlServer) {
                    // Label 属于 diy_field 元数据，不应为了标签变化重写 SQL Server
                    // 物理列。类型确有变化时保留目标列原有可空性和更宽类型。
                    if (change.OldType == change.NewType) {
                        debugLog['modify_skipped_metadata_only_' + tableName + '_' + newName] =
                            '仅字段标签变化，SQL Server 物理列无需修改';
                        continue;
                    }
                    var modifyColumns = readTargetPhysicalColumns(tableName);
                    var modifyColumn = null;
                    for (var modifyColumnIndex = 0; modifyColumnIndex < modifyColumns.length; modifyColumnIndex++) {
                        var modifyColumnName = String(getPhysicalValue(modifyColumns[modifyColumnIndex], ['COLUMN_NAME', 'ColumnName']) || '');
                        if (modifyColumnName.toLowerCase() == String(newName).toLowerCase()) {
                            modifyColumn = modifyColumns[modifyColumnIndex];
                            break;
                        }
                    }
                    if (!modifyColumn) throw new Error('SQL Server 待修改字段不存在：' + tableName + '.' + newName);
                    var currentPhysicalType = String(getPhysicalValue(modifyColumn, ['COLUMN_TYPE', 'ColumnType']) || '');
                    var effectivePhysicalType = chooseCompatibleColumnType(newType, currentPhysicalType);
                    if (normalizeSqlType(effectivePhysicalType) == normalizeSqlType(currentPhysicalType)) {
                        debugLog['modify_skipped_compatible_' + tableName + '_' + newName] =
                            '目标 SQL Server 物理类型已兼容：' + currentPhysicalType;
                        continue;
                    }
                    var currentNullable = String(getPhysicalValue(modifyColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
                    modifySQL = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName) +
                        ' ALTER COLUMN ' + quotePhysicalIdentifier(newName) + ' ' + effectivePhysicalType +
                        (currentNullable == 'NO' ? ' NOT NULL' : ' NULL');
                } else {
                    // 包已携带权威物理列时，统一交给后续物理同步做兼容比较。
                    // 不能先按旧 diy_field.Type 执行一次有损 MODIFY，再按 PhysicalColumns 改回。
                    var hasPhysicalDefinition = packagePhysicalColumns.some(function (column) {
                        return String(getPhysicalValue(column, ['TABLE_NAME', 'TableName']) || '').toLowerCase() == tableName.toLowerCase()
                            && String(getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']) || '').toLowerCase() == newName.toLowerCase();
                    });
                    if (hasPhysicalDefinition) {
                        debugLog['modify_deferred_physical_' + tableName + '_' + newName] = '由物理列同步统一处理';
                        continue;
                    }
                    // 兼容无 PhysicalColumns 的老包，保留目标列默认值、可空性、字符集和附加属性。
                    var mysqlColumn = getTargetPhysicalColumns(tableName)[String(newName).toLowerCase()];
                    if (!mysqlColumn) continue; // 缺列由后续新增字段阶段补齐。
                    var mysqlEffectiveType = chooseCompatibleColumnType(newType, mysqlColumn.COLUMN_TYPE);
                    if (normalizeSqlType(mysqlEffectiveType) == normalizeSqlType(mysqlColumn.COLUMN_TYPE)) {
                        debugLog['modify_skipped_compatible_' + tableName + '_' + newName] =
                            '目标物理类型已兼容：' + mysqlColumn.COLUMN_TYPE;
                        continue;
                    }
                    prepareNumericColumnData(tableName, newName, mysqlColumn, mysqlEffectiveType, mysqlColumn.COLUMN_TYPE);
                    modifySQL = 'ALTER TABLE ' + quotePhysicalIdentifier(tableName) + ' MODIFY COLUMN '
                        + buildPhysicalColumnDefinition(mysqlColumn, false, mysqlEffectiveType);
                }

                try {
                    if (runtimeIsSqlServer) {
                        var rebuiltIndexCount = alterSqlServerColumnPreservingIndexes(
                            tableName,
                            newName,
                            effectivePhysicalType,
                            currentNullable == 'NO' ? 'NOT NULL' : 'NULL'
                        );
                        if (rebuiltIndexCount > 0) {
                            debugLog['modify_indexes_rebuilt_' + tableName + '_' + newName] =
                                '已在同一事务内重建' + rebuiltIndexCount + '个依赖索引';
                        }
                    } else {
                        V8.Db.FromSql(modifySQL).ExecuteNonQuery();
                    }
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
            var columnsData = readTargetPhysicalColumns(tableName);

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
                    var alterSQL = buildDiyFieldAddColumnSql(actualTableName, field, fieldType);

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
    activeImportStage = '步骤2.6-应用源码与运行文件';

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

    activeImportStage = '步骤3-菜单与权限';
    activeImportResource = '';

    // POST_SCHEMA_MICROSERVICE_BINDING_RESTORE_V1：大型应用包会在
    // ApplicationAssets 执行片写入运行时后切换到 PostSchema。执行片切换会
    // 清空内存中的 applicationMenuBindings；如果不从已提交的服务/页面重建，
    // 后续菜单虽然带 RoutePath，却不会写入 MicroServiceId/PageId，最终宿主会
    // 把菜单 Id 当成 AppKey 并报 MICRO_APP_NOT_AVAILABLE。
    var restoreApplicationMenuBindingsFromPackage = function () {
        if (applicationMenuBindings.length > 0
            || !backgroundChunkingEnabled
            || backgroundCheckpointPhase != 'PostSchema') return;

        var restoreBundles = [];
        var packageApplicationBundles = Package.ApplicationBundles;
        if (packageApplicationBundles && packageApplicationBundles.length != null) {
            for (var restoreBundleIndex = 0; restoreBundleIndex < packageApplicationBundles.length; restoreBundleIndex++) {
                if (packageApplicationBundles[restoreBundleIndex]) restoreBundles.push(packageApplicationBundles[restoreBundleIndex]);
            }
        }
        var restoreSingleBundle = Package.ApplicationBundle || Package.AiApplication || Package.FrontendApplication;
        if (restoreSingleBundle) restoreBundles.push(restoreSingleBundle);

        for (var restoreIndex = 0; restoreIndex < restoreBundles.length; restoreIndex++) {
            var restoreBundle = restoreBundles[restoreIndex] || {};
            var restoreApp = restoreBundle.Application || restoreBundle.App || {};
            var restoreAppType = firstTextParam([
                restoreBundle.ApplicationType,
                restoreApp.ApplicationType,
                restoreApp.AppType,
                Package.PackageInfo.ApplicationType,
                'Web'
            ]);
            if (restoreAppType != 'MicroService') continue;

            var restoreAppKey = firstTextParam([
                restoreApp.AppKey,
                restoreApp.MsKey,
                restoreBundle.MicroService && restoreBundle.MicroService.MsKey,
                V8.Param.AppId,
                Package.PackageInfo.AppId
            ]);
            if (!restoreAppKey) throw new Error('PostSchema 恢复菜单绑定失败：MicroService AppKey 为空');

            var restoredService = getApplicationRow('sys_microiservice', '', [['MsKey', '=', restoreAppKey]]);
            if (!restoredService || !restoredService.Id) {
                throw new Error('PostSchema 恢复菜单绑定失败：未找到微服务 ' + restoreAppKey);
            }
            var restoredApplication = getApplicationRow('sys_microistore', '', [['AppKey', '=', restoreAppKey]]);
            var restoreRoutes = restoreBundle.Routes || restoreBundle.Pages || [];
            if (!restoreRoutes.length) {
                restoreRoutes = [{ RoutePath: '/', PageKey: 'home', PageName: '首页' }];
            }
            for (var restoreRouteIndex = 0; restoreRouteIndex < restoreRoutes.length; restoreRouteIndex++) {
                var restoreRoute = restoreRoutes[restoreRouteIndex] || {};
                var restoreRouteMeta = normalizeRouteMeta(restoreRoute);
                var restoreRoutePath = firstTextParam([
                    restoreRoute.RoutePath,
                    restoreRoute.Path,
                    restoreRouteMeta.RoutePath,
                    '/'
                ]);
                var restoredPage = getApplicationRow('sys_microiservice_page', '', [
                    ['MicroServiceId', '=', restoredService.Id],
                    ['AND', 'RoutePath', '=', restoreRoutePath]
                ]);
                if (!restoredPage || !restoredPage.Id) {
                    throw new Error('PostSchema 恢复菜单绑定失败：未找到页面 ' + restoreAppKey + restoreRoutePath);
                }
                applicationMenuBindings.push({
                    ServiceId: restoredService.Id,
                    ServiceKey: restoreAppKey,
                    PageId: restoredPage.Id,
                    RoutePath: restoreRoutePath,
                    PreserveExistingNativeMenus: !!(restoredApplication && restoredApplication.Id),
                    RetireLegacyMenus: restoreRouteMeta.RetireLegacyMenus === true
                        || Number(restoreRouteMeta.RetireLegacyMenus || 0) === 1
                        || String(restoreRouteMeta.RetireLegacyMenus || '').toLowerCase() == 'true',
                    LegacyMenuUrls: legacyRouteValues(restoreRouteMeta, 'LegacyMenuUrls', 'LegacyMenuUrl'),
                    LegacyComponentPaths: legacyRouteValues(restoreRouteMeta, 'LegacyComponentPaths', 'LegacyComponentPath')
                });
            }
        }
    };

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

    // MARKETPLACE_INSTALL_PARENT_MENU_V1：安装任务支持选择现有目录、根目录，或在
    // 本次事务内新建一个目录后再挂载包内根菜单。选择项必须是目标租户中真实存在
    // 的活动菜单，且不能指向包自身菜单，避免悬空 ParentId 或自环。新目录使用稳定
    // ModuleEngineKey 幂等复用；权限在下方 ADMIN_MENU_PERMISSION_V1 中同事务补齐。
    var installContainerMenuModel = null;
    var installContainerNeedsPermission = false;
    var installParentName = String(InstallParentSysMenuName || '').replace(/^\s+|\s+$/g, '');
    var installCreateUnderId = String(InstallParentCreateUnderSysMenuId || '').replace(/^\s+|\s+$/g, '');
    InstallParentSysMenuId = String(InstallParentSysMenuId || '').replace(/^\s+|\s+$/g, '');
    var isRootMenuId = function (value) {
        var normalized = String(value || '').replace(/^\s+|\s+$/g, '');
        return !normalized
            || normalized == '00000000000000000000000000'
            || normalized == '00000000-0000-0000-0000-000000000000';
    };
    var packageOwnsMenuId = function (menuId) {
        var packageMenus = Package.SysMenus || [];
        for (var packageMenuIndex = 0; packageMenuIndex < packageMenus.length; packageMenuIndex++) {
            if (String((packageMenus[packageMenuIndex] || {}).Id || '') == String(menuId || '')) return true;
        }
        return false;
    };
    var requireExistingInstallParent = function (menuId, label) {
        if (isRootMenuId(menuId)) return null;
        if (packageOwnsMenuId(menuId)) throw new Error(label + '不能选择本应用包自身菜单，避免形成父级环');
        var result = V8.FormEngine.GetFormData('sys_menu', {
            Id: menuId,
            _SelectFields: ['Id', 'Name', 'ParentId', 'IsDeleted']
        });
        if (!result || result.Code != 1 || !result.Data || Number(result.Data.IsDeleted || 0) == 1) {
            throw new Error(label + '不存在、已删除或无权访问：' + menuId);
        }
        return result.Data;
    };
    if (installParentName) {
        if (InstallParentSysMenuId) throw new Error('新建安装目录与选择现有安装目录不能同时提交');
        if (installParentName.length > 80 || /[\x00-\x1f\x7f]/.test(installParentName)) {
            throw new Error('新建安装目录名称不能为空、不能超过80个字符且不能包含控制字符');
        }
        requireExistingInstallParent(installCreateUnderId, '新目录的上级菜单');
        var installContainerKeySeed = String(V8.OsClient || '').toLowerCase()
            + '|' + String(installCreateUnderId || 'root').toLowerCase()
            + '|' + installParentName.toLowerCase();
        // sys_menu.ModuleEngineKey 的历史物理契约是 varchar(50)。旧前缀
        // marketplace-folder- 与 32 位 MD5 拼接后为 51 字符，会让部分目标租户
        // 在创建安装目录时事务回滚。固定使用 14 字符前缀，总长保持 46。
        var installContainerModuleKey = 'market-folder-'
            + String(V8.EncryptHelper.MD5Encrypt(installContainerKeySeed)).toLowerCase();
        if (installContainerModuleKey.length > 50) {
            throw new Error('新建安装目录稳定键超过 sys_menu.ModuleEngineKey 的50字符上限');
        }
        var existingContainerResult = V8.FormEngine.GetFormData('sys_menu', {
            _Where: [['ModuleEngineKey', '=', installContainerModuleKey]],
            _SelectFields: ['Id', 'Name', 'ParentId', 'ModuleEngineKey', 'IsDeleted'],
            _PageSize: 1
        });
        if (existingContainerResult && existingContainerResult.Code == 1 && existingContainerResult.Data
            && Number(existingContainerResult.Data.IsDeleted || 0) != 1) {
            installContainerMenuModel = existingContainerResult.Data;
            InstallParentSysMenuId = installContainerMenuModel.Id;
            debugLog.install_parent_menu = '复用目录：' + installParentName + '（' + InstallParentSysMenuId + '）';
        } else {
            var installContainerId = V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
            installContainerMenuModel = {
                Id: installContainerId,
                Name: installParentName,
                ParentId: isRootMenuId(installCreateUnderId) ? '00000000000000000000000000' : installCreateUnderId,
                ModuleEngineKey: installContainerModuleKey,
                OpenType: 'SecondMenu',
                Url: '',
                ComponentPath: '',
                ComponentName: '{}',
                DiyTableId: '',
                Display: 1,
                AppDisplay: 1,
                Sort: 0,
                Icon: 'fa fa-folder-open',
                IsDeleted: 0
            };
            applyLiteralSwitchDefaults(installContainerMenuModel, getNewResourceSwitchDefaults('sys_menu'));
            var addInstallContainerResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('sys_menu', installContainerMenuModel);
            }, 'install_parent_menu_add_' + installContainerId);
            if (!addInstallContainerResult || addInstallContainerResult.Code != 1) {
                throw new Error('新建安装目录失败：' + ((addInstallContainerResult && addInstallContainerResult.Msg) || '接口无返回'));
            }
            InstallParentSysMenuId = installContainerId;
            installContainerNeedsPermission = true;
            stats.MenuInserted++;
            debugLog.install_parent_menu = '新建目录：' + installParentName + '（' + InstallParentSysMenuId + '）';
        }
    } else if (InstallParentSysMenuId) {
        requireExistingInstallParent(InstallParentSysMenuId, '安装目标父菜单');
    }

    var standaloneLaunchMenuResult = ensureStandaloneApplicationLaunchMenus(Package, {
        OsClient: V8.OsClient,
        FileServer: V8.SysConfig && V8.SysConfig.FileServer,
        InstallParentSysMenuId: InstallParentSysMenuId,
        NewId: function () {
            return V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
        }
    });
    if (standaloneLaunchMenuResult.Generated || standaloneLaunchMenuResult.Rebound) {
        debugLog.standalone_application_launch_menu = '新增'
            + standaloneLaunchMenuResult.Generated + '个，目标租户地址重绑'
            + standaloneLaunchMenuResult.Rebound + '个';
    }

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
    // MENU_URL_UPDATE_COLLISION_RECOVERY_V1：升级既有菜单时，包内 Url 可能已被
    // 目标租户的其它首页菜单占用。优先保留该菜单当前仍唯一的 Url；否则生成
    // 有界唯一后缀并重试，禁止因为一个路由冲突回滚整个平台应用。
    var menuUrlOwnerCount = function (url, excludedMenuId) {
        var sql = 'SELECT COUNT(Id) FROM sys_menu WHERE Url=@p0';
        if (excludedMenuId) sql += ' AND Id<>@p1';
        var query = V8.Db.FromSql(sql).AddInParameter('@p0', url);
        if (excludedMenuId) query.AddInParameter('@p1', excludedMenuId);
        return Number(query.ToScalar() || 0);
    };
    var chooseMenuUrlCollisionFallback = function (incomingUrl, currentUrl, menuId) {
        var normalizedCurrent = String(currentUrl || '').trim();
        if (normalizedCurrent
            && normalizedCurrent != String(incomingUrl || '')
            && menuUrlOwnerCount(normalizedCurrent, menuId) == 0) {
            return normalizedCurrent;
        }
        var baseUrl = String(incomingUrl || '').trim();
        for (var suffix = 2; suffix <= 100; suffix++) {
            var candidate = baseUrl + '-' + suffix;
            if (menuUrlOwnerCount(candidate, menuId) == 0) return candidate;
        }
        return baseUrl + '-' + String(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid());
    };
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
    // ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1
    // 部分旧租户保留了平台物理表 sys_rolelimit，却缺少对应 diy_table/diy_field
    // 元数据。仅在确认是此类元数据缺失时才降级到参数化物理表读写；数据库、
    // 鉴权和连接错误仍原样失败，避免把真实故障伪装成兼容问题。
    var administratorRolesForMenuGrant = null;
    var legacyAccountAdministratorRoleId = '';
    var administratorRoleLimitPhysicalFallback = false;
    var administratorRoleLimitMetadataError = '';
    var administratorRoleLimitPhysicalWriteOccurred = false;
    var administratorIdTextSql = 'CAST(Id AS ' + (runtimeIsSqlServer ? 'VARCHAR(64)'
        : runtimeIsOracle ? 'VARCHAR2(64)' : 'CHAR(64)') + ') AS Id';
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
        // ADMIN_ROLE_BOOTSTRAP_PHYSICAL_V1: the first marketplace installation
        // precedes the SaaS package which owns role metadata. Query the current
        // tenant's authoritative physical roles, including legacy NULL deletes.
        var readRoles = function () {
            return V8.Db.FromSql('SELECT ' + administratorIdTextSql + ', Name, ' + quotePhysicalIdentifier('Level')
                + ', IsDeleted FROM sys_role WHERE ' + quotePhysicalIdentifier('Level')
                + ' >= @p0 AND (IsDeleted <> @p1 OR IsDeleted IS NULL) ORDER BY '
                + quotePhysicalIdentifier('Level') + ' DESC')
                .AddInParameter('@p0', 9999).AddInParameter('@p1', 1).ToArray() || [];
        };
        var roleRows = readRoles();
        // ADMIN_MENU_LEGACY_ACCOUNT_ROLE_V1: a legacy tenant can retain the
        // built-in role at 998/9998 while its authoritative account is already
        // a system administrator. Keep the role level and account bindings;
        // only grant menus when every non-deleted holder is an administrator.
        var roleIdFromReference = function (value) {
            return String(value && typeof value === 'object' ? value.Id || '' : value || '').toLowerCase();
        };
        if (roleRows.length === 0 && trustedOfficialPlatformPackage) {
            var accountRoleId = '5db47859-35a3-411a-a1f7-99482e057d24';
            var accountRoles = V8.Db.FromSql('SELECT ' + administratorIdTextSql + ', Name, '
                + quotePhysicalIdentifier('Level') + ', IsDeleted FROM sys_role WHERE Id = @p0')
                .AddInParameter('@p0', accountRoleId).ToArray() || [];
            if (accountRoles.length === 1 && Number(accountRoles[0].IsDeleted || 0) !== 1
                && (Number(accountRoles[0].Level) === 998 || Number(accountRoles[0].Level) === 9998)) {
                var accountUsers = V8.Db.FromSql('SELECT RoleIds, ' + quotePhysicalIdentifier('Level')
                    + ', State, IsDeleted FROM sys_user WHERE RoleIds LIKE @p0')
                    .AddInParameter('@p0', '%' + accountRoleId + '%').ToArray() || [];
                var activeAccountAdministrator = false;
                var ordinaryAccountHolder = false;
                for (var accountIndex = 0; accountIndex < accountUsers.length; accountIndex++) {
                    var account = accountUsers[accountIndex] || {};
                    if (Number(account.IsDeleted || 0) === 1) continue;
                    var accountReferences = parseMenuPermissionArray(account.RoleIds);
                    for (var accountReferenceIndex = 0; accountReferenceIndex < accountReferences.length; accountReferenceIndex++) {
                        if (roleIdFromReference(accountReferences[accountReferenceIndex]) !== accountRoleId) continue;
                        if (!(Number(account.Level) >= 9999)) ordinaryAccountHolder = true;
                        else if (Number(account.State) === 1) activeAccountAdministrator = true;
                    }
                }
                if (activeAccountAdministrator && !ordinaryAccountHolder) {
                    legacyAccountAdministratorRoleId = accountRoleId;
                    roleRows = accountRoles;
                    debugLog.admin_menu_legacy_account_role = '仅为现有系统管理员独占的旧内置角色补充菜单权限；不修改用户、角色等级或绑定';
                }
            }
        }
        if (roleRows.length === 0 && trustedOfficialPlatformPackage) {
            // An early empty tenant may retain its active administrator and the
            // original role reference while both role tables are empty. Restore
            // only that missing link; never promote a user, re-enable a role,
            // overwrite an existing role, or trust a role id supplied by a package.
            var legacyRoleId = '5db47859-35a3-411a-a1f7-99482e057d24';
            var roleCount = Number(V8.Db.FromSql('SELECT COUNT(*) FROM sys_role').ToScalar());
            var limitCount = Number(V8.Db.FromSql('SELECT COUNT(*) FROM sys_rolelimit').ToScalar());
            if (roleCount === 0 && limitCount === 0) {
                var users = V8.Db.FromSql('SELECT RoleIds, ' + quotePhysicalIdentifier('Level')
                    + ', State, IsDeleted FROM sys_user WHERE RoleIds LIKE @p0')
                    .AddInParameter('@p0', '%' + legacyRoleId + '%').ToArray() || [];
                var activeAdministratorFound = false;
                for (var userIndex = 0; userIndex < users.length; userIndex++) {
                    var user = users[userIndex] || {};
                    var roleIds = parseMenuPermissionArray(user.RoleIds);
                    var referencesLegacyRole = false;
                    for (var idIndex = 0; idIndex < roleIds.length; idIndex++) {
                        if (roleIdFromReference(roleIds[idIndex]) === legacyRoleId) referencesLegacyRole = true;
                    }
                    if (!referencesLegacyRole) continue;
                    if (!(Number(user.Level) >= 9999)) {
                        throw new Error('旧管理员角色被非管理员账号引用，已阻止自动恢复，避免扩大权限');
                    }
                    if (Number(user.State) === 1 && Number(user.IsDeleted || 0) !== 1) activeAdministratorFound = true;
                }
                if (activeAdministratorFound) {
                    V8.Db.FromSql('INSERT INTO sys_role (Id, Name, ' + quotePhysicalIdentifier('Level')
                        + ', IsDeleted, CreateTime) VALUES (@p0, @p1, @p2, @p3, CURRENT_TIMESTAMP)')
                        .AddInParameter('@p0', legacyRoleId).AddInParameter('@p1', '系统管理员')
                        .AddInParameter('@p2', 9999).AddInParameter('@p3', 0).ExecuteNonQuery();
                    roleRows = readRoles();
                    if (roleRows.length !== 1 || String(roleRows[0].Id).toLowerCase() !== legacyRoleId)
                        throw new Error('旧管理员角色恢复后回读不一致，已阻止提交');
                    debugLog.admin_role_bootstrap = '仅恢复现有活动管理员已引用的缺失系统角色；账号和角色绑定未修改';
                }
            }
        }
        administratorRolesForMenuGrant = [];
        for (var roleIndex = 0; roleIndex < roleRows.length; roleIndex++) {
            var role = roleRows[roleIndex] || {};
            if (role.Id && (Number(role.Level || 0) >= 9999
                || String(role.Id).toLowerCase() === legacyAccountAdministratorRoleId)
                && Number(role.IsDeleted || 0) !== 1) {
                administratorRolesForMenuGrant.push(role);
            }
        }
        if (administratorRolesForMenuGrant.length === 0) {
            throw new Error('未找到有效的系统管理员角色（sys_role.Level >= 9999），已阻止提交，避免新菜单无人可管理');
        }
        return administratorRolesForMenuGrant;
    };
    var isAdministratorRoleLimitMetadataMissing = function (value) {
        var message = writeResultMessage(value);
        var lower = String(message || '').toLowerCase();
        if (lower.indexOf('sys_rolelimit') < 0) return false;
        return lower.indexOf('diy_table') >= 0
            || lower.indexOf('noexistdata') >= 0
            || lower.indexOf('no exist data') >= 0
            || lower.indexOf('table metadata') >= 0
            || lower.indexOf('form engine metadata') >= 0
            || lower.indexOf('表配置') >= 0
            || lower.indexOf('元数据') >= 0
            || lower.indexOf('不存在的数据') >= 0;
    };
    var readAdministratorMenuRoleLimitsPhysical = function (roleId, menuId) {
        try {
            var rows = V8.Db.FromSql(
                'SELECT ' + administratorIdTextSql + ', Permission FROM sys_rolelimit WHERE RoleId = @p0 AND FkId = @p1 AND Type = @p2'
            )
                .AddInParameter('@p0', roleId)
                .AddInParameter('@p1', menuId)
                .AddInParameter('@p2', 'Menu')
                .ToArray();
            return rows || [];
        } catch (physicalReadError) {
            throw new Error('查询系统管理员菜单权限失败：FormEngine 缺少 sys_rolelimit 元数据，且物理表降级查询失败。'
                + '元数据错误：' + (administratorRoleLimitMetadataError || '未记录')
                + '；物理表错误：' + (physicalReadError.message || String(physicalReadError))
                + '；解决方案：恢复 sys_rolelimit 的 diy_table/diy_field 元数据，或检查租户物理表结构及数据库账号读权限');
        }
    };
    var readAdministratorMenuRoleLimits = function (roleId, menuId) {
        if (!administratorRoleLimitPhysicalFallback) {
            var limitResult = null;
            try {
                limitResult = V8.FormEngine.GetTableData('sys_rolelimit', {
                    _Where: [
                        ['RoleId', '=', roleId],
                        ['AND', 'FkId', '=', menuId],
                        ['AND', 'Type', '=', 'Menu']
                    ],
                    _SelectFields: ['Id', 'Permission'],
                    _PageIndex: 1,
                    _PageSize: 1000
                });
            } catch (limitReadError) {
                limitResult = { Code: 0, Msg: limitReadError.message || String(limitReadError) };
            }
            if (limitResult && (limitResult.Code == 1 || limitResult.Code == 2)) {
                return limitResult.Code == 1 && limitResult.Data ? limitResult.Data : [];
            }
            if (!isAdministratorRoleLimitMetadataMissing(limitResult)) {
                throw new Error('查询系统管理员菜单权限失败：' + ((limitResult && limitResult.Msg) || '接口无返回'));
            }
            administratorRoleLimitPhysicalFallback = true;
            administratorRoleLimitMetadataError = writeResultMessage(limitResult);
            debugLog.admin_menu_permission_physical_fallback = administratorRoleLimitMetadataError;
        }
        return readAdministratorMenuRoleLimitsPhysical(roleId, menuId);
    };
    var writeAdministratorMenuRoleLimitPhysical = function (action, model) {
        try {
            var affected = 0;
            if (action == 'Add') {
                // ADMIN_MENU_PERMISSION_DB_TIME_V1：Jint 将 System.DateTime 参数
                // 跨边界传给旧 Dos.ORM 时可能按当前区域格式化为 MM/dd/yyyy，
                // MySQL 严格模式会拒绝。CURRENT_TIMESTAMP 是 MySQL、SQL Server
                // 与 Oracle 共同支持的数据库时间表达式，且不拼接任何用户输入。
                affected = V8.Db.FromSql(
                    'INSERT INTO sys_rolelimit (Id, RoleId, FkId, Type, Permission, CreateTime) '
                    + 'VALUES (@p0, @p1, @p2, @p3, @p4, CURRENT_TIMESTAMP)'
                )
                    .AddInParameter('@p0', model.Id)
                    .AddInParameter('@p1', model.RoleId)
                    .AddInParameter('@p2', model.FkId)
                    .AddInParameter('@p3', 'Menu')
                    .AddInParameter('@p4', model.Permission)
                    .ExecuteNonQuery();
            } else {
                affected = V8.Db.FromSql('UPDATE sys_rolelimit SET Permission = @p0 WHERE Id = @p1')
                    .AddInParameter('@p0', model.Permission)
                    .AddInParameter('@p1', model.Id)
                    .ExecuteNonQuery();
            }
            if (Number(affected || 0) < 1) {
                return { Code: 0, Msg: '物理表 sys_rolelimit ' + (action == 'Add' ? '新增' : '更新') + '未影响任何记录' };
            }
            administratorRoleLimitPhysicalWriteOccurred = true;
            return { Code: 1, Data: { Id: model.Id, Affected: Number(affected || 0) } };
        } catch (physicalWriteError) {
            return {
                Code: 0,
                Msg: '物理表 sys_rolelimit ' + (action == 'Add' ? '新增' : '更新') + '失败：'
                    + (physicalWriteError.message || String(physicalWriteError))
                    + '；解决方案：检查该表字段、主键约束及数据库账号写权限'
            };
        }
    };
    var writeAdministratorMenuRoleLimit = function (action, model) {
        if (administratorRoleLimitPhysicalFallback) {
            return writeAdministratorMenuRoleLimitPhysical(action, model);
        }
        if (action == 'Add') return V8.FormEngine.AddFormData('sys_rolelimit', model);
        return V8.FormEngine.UptFormData('sys_rolelimit', model);
    };
    var invalidateAdministratorRoleLimitAuthorizationCache = function () {
        if (!administratorRoleLimitPhysicalWriteOccurred) return;
        var versionKey = 'Microi:' + V8.OsClient + ':FormEngineAuthz:Version';
        var bumpVersion = function () {
            var currentRaw = V8.Cache.Get(versionKey);
            var current = parseInt(String(currentRaw || '0'), 10);
            if (isNaN(current) || current < 0) current = 0;
            var clock = new Date().getTime();
            var next = Math.max(current + 1, clock);
            var saved = V8.Cache.Set(versionKey, String(next));
            if (saved === false) throw new Error('Redis 返回写入失败');
        };
        try {
            bumpVersion();
        } catch (cacheError) {
            throw new Error('sys_rolelimit 物理表权限已写入，但授权缓存版本更新失败：'
                + (cacheError.message || String(cacheError))
                + '；已阻止提交以避免数据库权限与登录缓存不一致。解决方案：检查租户 Redis 连接后重试');
        }
        // V8.Db 在接口引擎事务提交前执行。立即失效保证常规读者可见，提交后再
        // bump 一次可封住极小的“新版本快照在事务提交前被重建”竞态窗口。
        try {
            setTimeout(function () {
                try { bumpVersion(); } catch (delayedCacheError) { }
            }, 1200);
        } catch (scheduleError) {
            debugLog.admin_menu_permission_cache_delayed_invalidate_error = scheduleError.message || String(scheduleError);
        }
        administratorRoleLimitPhysicalWriteOccurred = false;
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
                return writeAdministratorMenuRoleLimit('Upt', {
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
                return writeAdministratorMenuRoleLimit('Add', {
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
        invalidateAdministratorRoleLimitAuthorizationCache();
    };
    // ADMIN_MENU_PERMISSION_V1_END
    if (installContainerNeedsPermission && installContainerMenuModel) {
        grantAdministratorPermissionsForNewMenu(installContainerMenuModel);
    }
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

    // LEGACY_MENU_EMPTY_NUMERIC_NULL_V1：引用菜单表的包不能改写该表的既有类型。
    // 旧库 ReportId 等可选关联列可能仍为整数；包内空字符串表示未关联，
    // 应按目标列写 NULL，不能写空字符串或把无关联猜成 0。非空值保持原样。
    var normalizeLegacyMenuEmptyValues = function (model, targetColumns) {
        for (var key in model) {
            if (!Object.prototype.hasOwnProperty.call(model, key) || key.toLowerCase() == 'id') continue;
            if (typeof model[key] != 'string' || model[key].trim() !== '') continue;
            var column = targetColumns[key.toLowerCase()];
            if (!column || String(column.IS_NULLABLE || '').toUpperCase() != 'YES') continue;
            var type = normalizeSqlType(column.COLUMN_TYPE);
            if (/^(bit|tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|double|float)(\(|unsigned|$)/.test(type)) {
                model[key] = null;
            }
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

    var legacyMenuPhysicalColumns = sortedMenus.length ? getTargetPhysicalColumns('sys_menu') : {};
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
                // MENU_URL_IS_PRIMARY_IDENTITY_V1：Url 存在时必须以 Url 为主身份；
                // ModuleEngineKey 只允许补充识别无 Url 的旧菜单，不能把两个不同路由
                // 的菜单合并成同一行。
                if ((menu.Url && sameMenuByUrl) || (!menu.Url && sameMenuByKey)) {
                    // sys_menu 的正式物理契约不包含 OsClient。V8.OsClient 只作为
                    // FormEngine/连接路由上下文使用；旧版这里直接写物理 OsClient，
                    // 会让早期客户库在恢复软删除菜单时因 Unknown column 中断整包。
                    execNonQuery(
                        'UPDATE sys_menu SET IsDeleted = 0 WHERE Id = @p0',
                        [menu.Id]
                    );
                    exists = checkExists('sys_menu', menu.Id);
                    revivedDeletedMenu = !!exists;
                }
            }
        }
        if (!exists) {
            var matchedMenu = null;
            if (menu.Url) {
                var menuByUrlResult = V8.FormEngine.GetFormData('sys_menu', {
                    OsClient: V8.OsClient,
                    _Where: [['Url', '=', menu.Url]],
                    _PageSize: 1
                });
                if (menuByUrlResult.Code == 1 && menuByUrlResult.Data) {
                    matchedMenu = menuByUrlResult.Data;
                }
            }
            if (!matchedMenu && menu.ModuleEngineKey) {
                var menuByKeyResult = V8.FormEngine.GetFormData('sys_menu', {
                    OsClient: V8.OsClient,
                    _Where: [['ModuleEngineKey', '=', menu.ModuleEngineKey]],
                    _PageSize: 1
                });
                if (menuByKeyResult.Code == 1 && menuByKeyResult.Data) {
                    var keyMatchedUrl = String(menuByKeyResult.Data.Url || '').toLowerCase();
                    var incomingMenuUrl = String(menu.Url || '').toLowerCase();
                    if (!incomingMenuUrl || !keyMatchedUrl || keyMatchedUrl == incomingMenuUrl) {
                        matchedMenu = menuByKeyResult.Data;
                    } else {
                        debugLog['menu_key_collision_' + packageMenuId] = '忽略路由不一致的 ModuleEngineKey 匹配：'
                            + menu.ModuleEngineKey + '，目标Url=' + keyMatchedUrl + '，包Url=' + incomingMenuUrl;
                    }
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
                _SelectFields: ['Display', 'AppDisplay', 'DiyConfig', 'Url']
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

        normalizeLegacyMenuEmptyValues(modelCopy, legacyMenuPhysicalColumns);
        if (exists) {
            // 存在则修改
            var uptResult = runWriteWithRetry(function () {
                return V8.FormEngine.UptFormData('sys_menu', modelCopy);
            }, 'menu_upt_' + menu.Id);
            if (uptResult.Code == 1) {
                stats.MenuUpdated++;
                menuWriteSucceeded = true;
            } else if (uptResult.Msg
                && uptResult.Msg.indexOf('[Url]已存在唯一值') > -1
                && modelCopy.Url) {
                var updateOriginalUrl = modelCopy.Url;
                modelCopy.Url = chooseMenuUrlCollisionFallback(
                    updateOriginalUrl,
                    existingMenuVisibility && existingMenuVisibility.Url,
                    menu.Id);
                debugLog['menu_url_update_retry_' + menu.Id] = updateOriginalUrl + ' → ' + modelCopy.Url;
                var updateRetryResult = runWriteWithRetry(function () {
                    return V8.FormEngine.UptFormData('sys_menu', modelCopy);
                }, 'menu_url_update_retry_' + menu.Id);
                if (updateRetryResult.Code == 1) {
                    stats.MenuUpdated++;
                    menuWriteSucceeded = true;
                } else {
                    debugLog['menu_upt_error_' + menu.Id] = updateRetryResult.Msg;
                }
            } else {
                debugLog['menu_upt_error_' + menu.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            applyLiteralSwitchDefaults(modelCopy, getNewResourceSwitchDefaults('sys_menu'));
            var recoveredDuplicateMenu = false;
            var addResult = runWriteWithRetry(function () {
                return V8.FormEngine.AddFormData('sys_menu', modelCopy);
            }, 'menu_add_' + menu.Id);
            if (addResult.Code != 1 && isDuplicatePrimaryError(addResult)) {
                recoveredDuplicateMenu = true;
                execNonQuery(
                    'UPDATE sys_menu SET IsDeleted = 0 WHERE Id = @p0',
                    [menu.Id]
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
                var newUrl = chooseMenuUrlCollisionFallback(originalUrl, '', menu.Id);
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
        if (!menuWriteSucceeded) {
            throw new Error('菜单写入失败：' + (modelCopy.Name || modelCopy.Id)
                + '，Url=' + String(modelCopy.Url || '')
                + '；原因=' + String(debugLog['menu_add_error_' + menu.Id] || debugLog['menu_upt_error_' + menu.Id] || '写入未成功')
                + '；应用安装已回滚。');
        }

        var menuReadbackResult = V8.FormEngine.GetFormData('sys_menu', {
            Id: modelCopy.Id,
            _SelectFields: ['Id', 'Name', 'Url', 'ModuleEngineKey', 'DiyTableId', 'DiyTableName', 'ComponentPath', 'OpenType']
        });
        var menuReadback = menuReadbackResult && menuReadbackResult.Code == 1
            ? menuReadbackResult.Data
            : null;
        if (!menuReadback || String(menuReadback.Id || '') != String(modelCopy.Id || '')) {
            throw new Error('菜单写后回读失败：' + (modelCopy.Name || modelCopy.Id));
        }
        if (modelCopy.Url && String(menuReadback.Url || '').toLowerCase() != String(modelCopy.Url).toLowerCase()) {
            throw new Error('菜单写后回读路由不一致：' + (modelCopy.Name || modelCopy.Id)
                + '，期望' + modelCopy.Url + '，实际' + String(menuReadback.Url || ''));
        }
        if (modelCopy.DiyTableId && String(menuReadback.DiyTableId || '') != String(modelCopy.DiyTableId)) {
            throw new Error('菜单写后回读 DiyTableId 不一致：' + (modelCopy.Name || modelCopy.Id));
        }
        if (modelCopy.DiyTableName
            && String(menuReadback.DiyTableName || '').toLowerCase() != String(modelCopy.DiyTableName).toLowerCase()) {
            throw new Error('菜单写后回读 DiyTableName 不一致：' + (modelCopy.Name || modelCopy.Id));
        }

        //清除缓存
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.Id.toLowerCase()}`);
        if (menu.ModuleEngineKey) {
            V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.ModuleEngineKey.toLowerCase()}`);
        }
    }

    var migratedMenuIds = {};
    var migrateLegacyMenus = function (binding, fieldName, values) {
        if (!binding) return;
        values = values || [];
        // PACKAGE_BOUND_MICROSERVICE_MENU_V1：新应用包已经把菜单声明为
        // MicroService 时，不能仍要求 RouteMeta 额外配置 LegacyMenuUrls 才绑定
        // 运行时。否则菜单会有 RoutePath，却没有 MicroServiceId/PageId，最终把
        // 菜单 Id 当 AppKey 并报 MICRO_APP_NOT_AVAILABLE。
        if (!values.length && fieldName != 'Url') return;
        var menus = [];
        if (values.length) {
            var menuResult = V8.FormEngine.GetTableData('sys_menu', {
                _Where: [[fieldName, 'In', values]],
                _PageIndex: 1,
                _PageSize: 1000
            });
            menus = menuResult && menuResult.Code == 1 && menuResult.Data ? menuResult.Data : [];
        }
        var declaredLegacyMenuIds = {};
        for (var declaredLegacyMenuIndex = 0; declaredLegacyMenuIndex < menus.length; declaredLegacyMenuIndex++) {
            var declaredLegacyMenu = menus[declaredLegacyMenuIndex] || {};
            if (declaredLegacyMenu.Id) declaredLegacyMenuIds[String(declaredLegacyMenu.Id)] = true;
        }
        var packageBoundMenuIds = [];
        for (var packageBoundMenuIndex = 0; packageBoundMenuIndex < sysMenus.length; packageBoundMenuIndex++) {
            var packageBoundMenu = sysMenus[packageBoundMenuIndex] || {};
            var packageBoundKey = firstTextParam([
                packageBoundMenu.MicroServiceKey,
                packageBoundMenu.MsKey,
                packageBoundMenu.MicroServiceAppKey
            ]).toLowerCase();
            var packageBoundRoute = firstTextParam([
                packageBoundMenu.MicroServiceRoutePath,
                packageBoundMenu.RoutePath
            ]).toLowerCase();
            if (packageBoundMenu.Id
                && packageBoundKey == String(binding.ServiceKey || '').toLowerCase()
                && packageBoundRoute == String(binding.RoutePath || '').toLowerCase()) {
                packageBoundMenuIds.push(packageBoundMenu.Id);
            }
        }
        var packageBoundMenus = [];
        if (packageBoundMenuIds.length) {
            var packageBoundResult = V8.FormEngine.GetTableData('sys_menu', {
                _Where: [['Id', 'In', packageBoundMenuIds]],
                _PageIndex: 1,
                _PageSize: 1000
            });
            packageBoundMenus = packageBoundResult && packageBoundResult.Code == 1 && packageBoundResult.Data
                ? packageBoundResult.Data
                : [];
        }
        // v1.4.1 曾把旧 Url 覆盖成稳定微服务 Url。再次安装时同时按微服务绑定回查，
        // 才能恢复旧书签，而不是因为旧 Url 已丢失就永远无法命中。
        var recoverBoundMicroserviceMenus = V8.FormEngine.GetTableData('sys_menu', {
            _Where: [
                ['MicroServiceId', '=', binding.ServiceId],
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
        appendMenus(packageBoundMenus);
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
            if (binding.RetireLegacyMenus && declaredLegacyMenuIds[String(legacyMenu.Id)]) {
                var retireResult = runWriteWithRetry(function () {
                    return V8.FormEngine.DelFormData('sys_menu', { Id: legacyMenu.Id });
                }, 'retire_microservice_legacy_menu_' + legacyMenu.Id);
                if (retireResult && retireResult.Code == 1) {
                    migratedMenuIds[legacyMenu.Id] = true;
                    stats.MicroServiceMenusRetired++;
                    V8.Cache.Remove('Microi:' + V8.OsClient + ':FormData:sys_menu:' + String(legacyMenu.Id).toLowerCase());
                    if (legacyMenu.ModuleEngineKey) {
                        V8.Cache.Remove('Microi:' + V8.OsClient + ':FormData:sys_menu:' + String(legacyMenu.ModuleEngineKey).toLowerCase());
                    }
                    continue;
                }
                debugLog['retire_microservice_legacy_menu_error_' + legacyMenu.Id]
                    = (retireResult && retireResult.Msg) || '接口无返回';
                continue;
            }
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
    // API_ENGINE_CHANGE_HISTORY_TABLECHILD_MIGRATION_V1
    // 只有携带新子表的表单引擎包才执行。物理表与字段已经在前面的 schema
    // 阶段落库；后台分片安装则固定在 PostSchema 执行，避免旧文本先被迁移、
    // 后续建表失败后又留下不可重试的半成品。旧 ChangeHistory 永不清空，
    // 因此旧前端/旧后端与迁移重试都能继续工作。
    var packageContainsApiEngineHistoryTable = function () {
        var targetName = 'mci_apiengine_change_history';
        var packageTables = Package.DiyTables || [];
        for (var historyTableIndex = 0; historyTableIndex < packageTables.length; historyTableIndex++) {
            if (String(packageTables[historyTableIndex] && packageTables[historyTableIndex].Name || '').toLowerCase() == targetName) {
                return true;
            }
        }
        var packageDdls = Package.DDLStatements || [];
        for (var historyDdlIndex = 0; historyDdlIndex < packageDdls.length; historyDdlIndex++) {
            if (String(packageDdls[historyDdlIndex] && packageDdls[historyDdlIndex].TableName || '').toLowerCase() == targetName) {
                return true;
            }
        }
        return false;
    };
    var migrateLegacyApiEngineChangeHistory = function () {
        if (!packageContainsApiEngineHistoryTable()) return;
        if (backgroundChunkingEnabled && backgroundCheckpointPhase != 'PostSchema') return;

        var targetTable = 'mci_apiengine_change_history';
        var legacyApiEngineColumns = getTargetPhysicalColumns('sys_apiengine');
        if (!legacyApiEngineColumns.changehistory) {
            // 极老数据库可能从未有 ChangeHistory；新资源仍可正常安装，后续
            // MCP / VS Code 会直接写子表。只有“物理列确实不存在”才允许跳过；
            // 列存在但读取失败必须失败关闭，避免把暂时性数据库异常误报为迁移成功。
            debugLog.api_engine_history_migration_skipped =
                '旧 sys_apiengine.ChangeHistory 物理列不存在，已跳过历史迁移';
            return;
        }
        var pageIndex = 1;
        var pageSize = 200;
        var reachedLastPage = false;
        while (!reachedLastPage && pageIndex <= 10000) {
            var legacyResult = V8.FormEngine.GetTableData('sys_apiengine', {
                // 老租户的 IsDeleted 可能为 NULL。SQL 中 NULL <> 1 不成立，
                // 若在查询条件里直接使用该表达式会漏迁历史接口；先稳定分页
                // 读取，再只跳过明确等于 1 的软删除行。
                _SelectFields: ['Id', 'Version', 'ChangeHistory', 'CreateTime', 'UpdateTime', 'IsDeleted'],
                _OrderBy: 'Id',
                _OrderByType: 'ASC',
                _PageIndex: pageIndex,
                _PageSize: pageSize
            });
            if (!legacyResult || legacyResult.Code != 1) {
                throw new Error('接口引擎修改历史迁移失败：旧 ChangeHistory 不可读取，'
                    + ((legacyResult && legacyResult.Msg) || '接口无返回'));
            }

            var legacyRows = legacyResult.Data || [];
            reachedLastPage = legacyRows.length < pageSize;
            if (legacyRows.length == 0) break;

            var engineIds = [];
            for (var historyEngineIndex = 0; historyEngineIndex < legacyRows.length; historyEngineIndex++) {
                var historyEngineId = String(legacyRows[historyEngineIndex] && legacyRows[historyEngineIndex].Id || '').trim();
                if (historyEngineId) engineIds.push(historyEngineId);
            }
            var existingKeys = {};
            if (engineIds.length > 0) {
                var existingHistoryResult = V8.FormEngine.GetTableData(targetTable, {
                    _SelectFields: ['EntryKey'],
                    _Where: [['ApiEngineId', 'In', engineIds]],
                    _PageIndex: 1,
                    _PageSize: 100000
                });
                if (!existingHistoryResult || existingHistoryResult.Code != 1) {
                    throw new Error('接口引擎修改历史迁移失败：新子表不可读取，'
                        + ((existingHistoryResult && existingHistoryResult.Msg) || '接口无返回'));
                }
                var existingHistoryRows = existingHistoryResult.Data || [];
                for (var existingHistoryIndex = 0; existingHistoryIndex < existingHistoryRows.length; existingHistoryIndex++) {
                    var existingKey = String(existingHistoryRows[existingHistoryIndex] && existingHistoryRows[existingHistoryIndex].EntryKey || '').trim();
                    if (existingKey) existingKeys[existingKey] = true;
                }
            }

            for (var legacyEngineIndex = 0; legacyEngineIndex < legacyRows.length; legacyEngineIndex++) {
                var legacyEngine = legacyRows[legacyEngineIndex] || {};
                if (Number(legacyEngine.IsDeleted || 0) === 1) continue;
                var apiEngineId = String(legacyEngine.Id || '').trim();
                if (!apiEngineId) continue;
                var legacyLines = String(legacyEngine.ChangeHistory || '').split(/\r?\n/);
                for (var legacyLineIndex = 0; legacyLineIndex < legacyLines.length; legacyLineIndex++) {
                    var legacyLine = String(legacyLines[legacyLineIndex] || '').trim();
                    if (!legacyLine) continue;
                    var entryKey = V8.EncryptHelper.Sha256Hex(apiEngineId + '\n' + legacyLine);
                    if (existingKeys[entryKey]) {
                        stats.ApiEngineHistorySkipped++;
                        continue;
                    }

                    var versionMatch = legacyLine.match(/\b(v\d+\.\d+(?:\.\d+){0,2})\b/i);
                    var dateMatch = legacyLine.match(/^(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/);
                    var historyTime = dateMatch && dateMatch[1]
                        ? (dateMatch[1].length == 10 ? dateMatch[1] + ' 00:00:00' : dateMatch[1])
                        : String(legacyEngine.UpdateTime || legacyEngine.CreateTime || nowText('yyyy-MM-dd HH:mm:ss'));
                    var addHistoryResult = V8.FormEngine.AddFormData(targetTable, {
                        Id: V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid(),
                        ApiEngineId: apiEngineId,
                        Version: versionMatch && versionMatch[1] ? versionMatch[1] : String(legacyEngine.Version || ''),
                        Description: legacyLine,
                        EntryKey: entryKey,
                        Source: '旧 ChangeHistory 逐行迁移',
                        CreateTime: historyTime,
                        UpdateTime: historyTime,
                        IsDeleted: 0
                    });
                    if (!addHistoryResult || addHistoryResult.Code != 1) {
                        // 唯一键并发只算幂等跳过；其它错误回滚本次应用安装，
                        // 保留旧文本后可安全修复并重试。
                        var duplicateHistoryResult = V8.FormEngine.GetFormData(targetTable, {
                            _Where: [['EntryKey', '=', entryKey]],
                            _SelectFields: ['Id', 'EntryKey']
                        });
                        if (duplicateHistoryResult && duplicateHistoryResult.Code == 1 && duplicateHistoryResult.Data) {
                            existingKeys[entryKey] = true;
                            stats.ApiEngineHistorySkipped++;
                            continue;
                        }
                        throw new Error('接口引擎修改历史迁移失败：ApiEngineId=' + apiEngineId
                            + '，' + ((addHistoryResult && addHistoryResult.Msg) || '接口无返回'));
                    }
                    existingKeys[entryKey] = true;
                    stats.ApiEngineHistoryMigrated++;
                }
            }
            pageIndex++;
        }
        if (!reachedLastPage && pageIndex > 10000) {
            throw new Error('接口引擎修改历史迁移超过 2000000 条引擎分页安全上限');
        }
        debugLog.api_engine_history_migration = '逐行迁移' + stats.ApiEngineHistoryMigrated
            + '条，幂等跳过' + stats.ApiEngineHistorySkipped + '条；旧文本保留';
    };
    migrateLegacyApiEngineChangeHistory();

    restoreApplicationMenuBindingsFromPackage();
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
        + '，迁移微服务旧菜单' + stats.MicroServiceMenus + '，退役旧菜单' + stats.MicroServiceMenusRetired
        + '，保留现有原生菜单' + stats.MicroServiceMenusPreserved;

    // ==================== 步骤4：处理wf_flowdesign数据（可选） ====================
    activeImportStage = '步骤4-工作流设计';

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
    activeImportStage = '步骤5-工作流节点';

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
    activeImportStage = '步骤6-工作流连线';

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

    function normalizeApiEngineFlag(value) {
        if (value === true) return 1;
        if (value === false || isMissingValue(value)) return 0;
        var normalized = String(value).trim().toLowerCase();
        if (normalized == 'true' || normalized == 'yes' || normalized == 'on') return 1;
        if (normalized == 'false' || normalized == 'no' || normalized == 'off') return 0;
        var numeric = Number(value);
        return isNaN(numeric) ? 0 : (numeric == 0 ? 0 : 1);
    }

    function removeApiEngineCacheValue(value) {
        if (isMissingValue(value)) return;
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(value).toLowerCase()}`);
    }

    function apiEngineRouteAliases(model) {
        model = model || {};
        var values = [model.ApiEngineKey, model.Id, model.ApiAddress]
            .concat(String(model.ApiRoutes || '').split(';'));
        var aliases = [];
        var seen = {};
        for (var aliasIndex = 0; aliasIndex < values.length; aliasIndex++) {
            var alias = String(values[aliasIndex] || '').trim();
            var lower = alias.toLowerCase();
            if (!alias || seen[lower]) continue;
            seen[lower] = true;
            aliases.push(alias);
        }
        return aliases;
    }

    function removeApiEngineCacheAliases(model) {
        var aliases = apiEngineRouteAliases(model);
        for (var aliasIndex = 0; aliasIndex < aliases.length; aliasIndex++) {
            removeApiEngineCacheValue(aliases[aliasIndex]);
        }
    }

    function configuredApiEngineRoutes(model) {
        model = model || {};
        var values = [model.ApiAddress].concat(String(model.ApiRoutes || '').split(';'));
        var routes = [];
        var seen = {};
        for (var routeIndex = 0; routeIndex < values.length; routeIndex++) {
            var route = String(values[routeIndex] || '').trim();
            var normalizedRoute = route.toLowerCase();
            if (!route || seen[normalizedRoute]) continue;
            seen[normalizedRoute] = true;
            routes.push(route);
        }
        return routes;
    }

    // PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1：应用包 Managed 路由是本次安装的
    // 权威声明。其它接口若占用主路由或 ApiRoutes 中任一路由，只释放相撞别名，
    // 保留该接口本身、源码及其余路由，并清理旧缓存别名。
    function reclaimApiEngineRoutes(expected, ownerId, debugPrefix) {
        var claimedRoutes = configuredApiEngineRoutes(expected);
        if (claimedRoutes.length == 0) return [];
        var claimed = {};
        for (var claimedIndex = 0; claimedIndex < claimedRoutes.length; claimedIndex++) {
            claimed[claimedRoutes[claimedIndex].toLowerCase()] = true;
        }
        var released = [];
        var routeOwners = V8.Db.FromSql('SELECT * FROM sys_apiengine').ToArray() || [];
        for (var ownerIndex = 0; ownerIndex < routeOwners.length; ownerIndex++) {
            var routeOwner = routeOwners[ownerIndex] || {};
            if (ownerId && String(routeOwner.Id || '').toLowerCase() == String(ownerId).toLowerCase()) {
                continue;
            }
            var oldAddress = String(routeOwner.ApiAddress || '').trim();
            var oldRoutes = String(routeOwner.ApiRoutes || '').split(';');
            var keptRoutes = [];
            var removedRoutes = [];
            if (oldAddress && claimed[oldAddress.toLowerCase()]) removedRoutes.push(oldAddress);
            for (var oldRouteIndex = 0; oldRouteIndex < oldRoutes.length; oldRouteIndex++) {
                var oldRoute = String(oldRoutes[oldRouteIndex] || '').trim();
                if (!oldRoute) continue;
                if (claimed[oldRoute.toLowerCase()]) removedRoutes.push(oldRoute);
                else keptRoutes.push(oldRoute);
            }
            if (removedRoutes.length == 0) continue;
            removeApiEngineCacheAliases(routeOwner);
            var reclaimCount = V8.Db.FromSql(
                'UPDATE sys_apiengine SET ApiAddress=@p1, ApiRoutes=@p2 WHERE Id=@p0'
            )
                .AddInParameter('@p0', routeOwner.Id)
                .AddInParameter('@p1', oldAddress && !claimed[oldAddress.toLowerCase()] ? oldAddress : null)
                .AddInParameter('@p2', keptRoutes.length > 0 ? keptRoutes.join(';') : null)
                .ExecuteNonQuery();
            if (Number(reclaimCount) != 1) {
                throw new Error('接口引擎收回包声明路由未命中唯一记录：'
                    + String(expected.ApiEngineKey || expected.Id));
            }
            var release = String(expected.ApiEngineKey || expected.Id) + '：收回路由['
                + removedRoutes.join('；') + ']，原接口='
                + String(routeOwner.ApiEngineKey || routeOwner.Id);
            released.push(release);
            debugLog[debugPrefix + '_' + ownerIndex] = release;
        }
        return released;
    }

    function refreshApiEngineCache(apiEngineKey, apiEngineId, apiAddress) {
        removeApiEngineCacheValue(apiEngineKey);
        removeApiEngineCacheValue(apiEngineId);
        removeApiEngineCacheValue(apiAddress);

        var latest = null;
        // PACKAGE_API_ENGINE_PHYSICAL_READBACK_FALLBACK_V1：部分旧租户的
        // sys_apiengine 物理行完整，但 diy_table/diy_field 元数据损坏或缓存仍是
        // 旧投影，FormEngine 三种别名回读都会返回空。导入器此前已经用参数化
        // 物理查询确定了资源身份，因此这里用同一物理事实完成强回读与缓存重建，
        // 不能把真实存在的 Managed 接口误判成“写入后不存在”。
        // PACKAGE_API_ENGINE_AUTHORITATIVE_READBACK_V2：直接读取当前租户物理行，
        // 不再先经过正在被安装器修改的元数据与旧缓存，避免空投影或空引用阻断强回读。
        var recoveredPhysicalReadback = false;
        // PACKAGE_API_ENGINE_CANONICAL_ID_READBACK_V1：重复 Key 已按稳定 Id
        // 归并，旧记录仍保留为软删除审计。回读必须使用刚写入的 Id；按 Key 的
        // 无序 First() 会重新选中退役记录，并把旧源码写回公共 Key 缓存。
        // 指定 Id 不存在时直接返回空，不能用另一个同 Key 记录掩盖写入失败。
        if (!isMissingValue(apiEngineId)) {
            latest = V8.Db.FromSql('SELECT * FROM sys_apiengine WHERE Id=@p0')
                .AddInParameter('@p0', apiEngineId)
                .First();
            recoveredPhysicalReadback = !!latest;
            if (!latest) return null;
        }
        if (!latest && !isMissingValue(apiEngineKey)) {
            latest = V8.Db.FromSql(
                    'SELECT * FROM sys_apiengine WHERE LOWER(ApiEngineKey)=LOWER(@p0) AND (IsDeleted=0 OR IsDeleted IS NULL)'
                )
                .AddInParameter('@p0', apiEngineKey)
                .First();
            recoveredPhysicalReadback = !!latest;
        }
        if (!latest && !isMissingValue(apiAddress)) {
            latest = V8.Db.FromSql(
                    'SELECT * FROM sys_apiengine WHERE LOWER(ApiAddress)=LOWER(@p0) AND (IsDeleted=0 OR IsDeleted IS NULL)'
                )
                .AddInParameter('@p0', apiAddress)
                .First();
            recoveredPhysicalReadback = !!latest;
        }
        if (recoveredPhysicalReadback) {
            debugLog['apiengine_physical_readback_recovery_'
                + String(apiEngineKey || apiEngineId || apiAddress)] =
                '已按当前租户参数化物理事实重建接口缓存';
        }

        if (!latest) return null;
        normalizeApiEngineModel(latest);
        // IV8Cache.Set 的 value 参数是 string。直接传 Jint/.NET 对象会被转换成
        // "System..." 类型名，污染 v3 与 v6 共用的 sys_apiengine JSON 缓存。
        var latestCacheJson = JSON.stringify(latest);
        var latestAliases = apiEngineRouteAliases(latest);
        for (var latestAliasIndex = 0; latestAliasIndex < latestAliases.length; latestAliasIndex++) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latestAliases[latestAliasIndex]).toLowerCase()}`, latestCacheJson);
        }
        return latest;
    }

    // PACKAGE_API_ENGINE_PHYSICAL_RECONCILIATION_V2：部分历史库已存在运行列，
    // 但对应 diy_field 元数据缺失，FormEngine 会返回成功却静默忽略字段。包资源
    // 已经完成身份选择后，以参数化 SQL 补齐源码、版本、路由和开关，再严格回读。
    function reconcilePersistedApiEngineFlags(expected, latest) {
        if (!latest) return latest;
        var assignments = [];
        var assignmentValues = [];
        var addValueAssignment = function (column, value) {
            assignments.push(column + '=@p' + (assignmentValues.length + 1));
            assignmentValues.push(value);
        };
        if (!isMissingValue(expected.IsEnable)
            && normalizeApiEngineFlag(latest.IsEnable) != normalizeApiEngineFlag(expected.IsEnable)) {
            assignments.push('IsEnable=' + normalizeApiEngineFlag(expected.IsEnable));
        }
        if (!isMissingValue(expected.StopHttp)
            && normalizeApiEngineFlag(latest.StopHttp) != normalizeApiEngineFlag(expected.StopHttp)) {
            assignments.push('StopHttp=' + normalizeApiEngineFlag(expected.StopHttp));
        }
        if (!isMissingValue(expected.AllowAnonymous)
            && normalizeApiEngineFlag(latest.AllowAnonymous) != normalizeApiEngineFlag(expected.AllowAnonymous)) {
            assignments.push('AllowAnonymous=' + normalizeApiEngineFlag(expected.AllowAnonymous));
        }
        if (normalizeApiEngineFlag(latest.IsDeleted) == 1) assignments.push('IsDeleted=0');
        if (Object.prototype.hasOwnProperty.call(expected, 'ApiV8Code')
            && String(latest.ApiV8Code || '') != String(expected.ApiV8Code || '')) {
            addValueAssignment('ApiV8Code', expected.ApiV8Code || '');
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'ApiAddress')
            && String(latest.ApiAddress || '') != String(expected.ApiAddress || '')) {
            addValueAssignment('ApiAddress', expected.ApiAddress || null);
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'ApiRoutes')
            && String(latest.ApiRoutes || '') != String(expected.ApiRoutes || '')) {
            addValueAssignment('ApiRoutes', expected.ApiRoutes || null);
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'Version')
            && String(latest.Version || '') != String(expected.Version || '')) {
            addValueAssignment('Version', expected.Version || '');
        }
        if (assignments.length == 0) return latest;
        var stableId = String(latest.Id || expected.Id || '');
        if (!stableId) throw new Error('接口引擎开关补正缺少稳定Id：' + expected.ApiEngineKey);
        // PACKAGE_API_ENGINE_STALE_ALIAS_INVALIDATION_V1：首次物理回读会按旧
        // ApiAddress/ApiRoutes 重建缓存。物理补正路由前必须清除这份旧事实的
        // 全部别名，随后 refreshApiEngineCache 只按严格回读的新事实重建。
        removeApiEngineCacheAliases(latest);
        var reconcileCommand = V8.Db.FromSql(
            'UPDATE sys_apiengine SET ' + assignments.join(',') + ' WHERE Id=@p0'
        ).AddInParameter('@p0', stableId);
        for (var assignmentValueIndex = 0; assignmentValueIndex < assignmentValues.length; assignmentValueIndex++) {
            reconcileCommand = reconcileCommand.AddInParameter(
                '@p' + (assignmentValueIndex + 1),
                assignmentValues[assignmentValueIndex]
            );
        }
        var affected = reconcileCommand.ExecuteNonQuery();
        if (Number(affected) != 1) {
            throw new Error('接口引擎开关物理补正未命中唯一记录：' + expected.ApiEngineKey);
        }
        debugLog['apiengine_flag_physical_reconcile_' + expected.ApiEngineKey] = assignments.join(',');
        return refreshApiEngineCache(expected.ApiEngineKey, stableId, expected.ApiAddress);
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

    // PACKAGE_API_ENGINE_DUPLICATE_KEY_REPAIR_V1：历史并发安装或旧版写入可能让
    // 同一逻辑 Key 留下多条物理记录。包内 Id 是最强身份；否则优先最早的活跃
    // 记录，再选最早软删除记录，最后以 Id 打破时间并列，保证每次恢复结果稳定。
    function selectApiEngineIdentityCanonical(rows, incomingId) {
        var selected = null;
        var selectedRank = null;
        var expectedId = String(incomingId || '').toLowerCase();
        for (var rowIndex = 0; rows && rowIndex < rows.length; rowIndex++) {
            var row = rows[rowIndex] || {};
            var rowId = String(row.Id || '');
            if (!rowId) continue;
            var deletedText = String(row.IsDeleted === null || row.IsDeleted === undefined ? '' : row.IsDeleted).toLowerCase();
            var isDeleted = row.IsDeleted === true || row.IsDeleted === 1
                || deletedText == '1' || deletedText == 'true';
            var identityRank = expectedId && rowId.toLowerCase() == expectedId ? 0 : (isDeleted ? 2 : 1);
            var createRank = String(row.CreateTime || '9999-12-31 23:59:59');
            var rank = String(identityRank) + '|' + createRank + '|' + rowId.toLowerCase();
            if (selectedRank === null || rank < selectedRank) {
                selected = row;
                selectedRank = rank;
            }
        }
        return selected;
    }

    // PACKAGE_MANAGED_OVERWRITE_V2：安装动作已经明确选择了应用包和版本，所有
    // Managed 接口都以 Incoming 为权威覆盖目标端，不再按来源、BaseHash、本地
    // 版本或历史 Ownership 产生冲突。BaseHash 仅保留为安装审计信息。
    function normalizeApiEngineBaseHashes(value) {
        var source = value;
        if (typeof source == 'string') {
            try { source = JSON.parse(source || '[]'); }
            catch (parseError) { source = String(source || '').split(','); }
        }
        if (!source || source.length === undefined || typeof source == 'string') source = source ? [source] : [];
        var result = [];
        var seen = {};
        for (var hashIndex = 0; hashIndex < source.length; hashIndex++) {
            var hash = String(source[hashIndex] || '').trim().toLowerCase();
            if (!/^[a-f0-9]{64}$/.test(hash) || seen[hash]) continue;
            seen[hash] = true;
            result.push(hash);
        }
        return result;
    }

    function decideManagedApiEngineUpdate(ownership, baseHash, localHash, incomingHash, localVersion, incomingVersion, compatibleBaseHashes, trustedOfficialManagedOverwrite) {
        return localHash == incomingHash ? 'Apply' : 'ApplyPackageManagedOverwrite';
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
        var ownership = String(source.Ownership || (upgradePolicy == 'CreateIfMissing' ? 'Tenant' : 'Application'));
        if (upgradePolicy == 'Managed'
            && ownership.toLowerCase() == 'application'
            && trustedOfficialPlatformPackage) {
            ownership = 'Platform';
        }
        return {
            UpgradePolicy: upgradePolicy,
            Ownership: ownership,
            BaseHash: String(source.BaseHash || '').toLowerCase(),
            CompatibleBaseHashes: normalizeApiEngineBaseHashes(
                source.CompatibleBaseHashes || source.LegacyBaseHashes || []
            )
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
        if (normalizeApiEngineFlag(latest.IsDeleted) === 1) {
            throw new Error('接口引擎写入后仍处于删除状态：' + expected.ApiEngineKey);
        }
        if (!isMissingValue(expected.IsEnable)
            && normalizeApiEngineFlag(latest.IsEnable) !== normalizeApiEngineFlag(expected.IsEnable)) {
            throw new Error('接口引擎写入后启用状态不一致：' + expected.ApiEngineKey);
        }
        if (!isMissingValue(expected.StopHttp)
            && normalizeApiEngineFlag(latest.StopHttp) !== normalizeApiEngineFlag(expected.StopHttp)) {
            throw new Error('接口引擎写入后HTTP状态不一致：' + expected.ApiEngineKey);
        }
        if (!isMissingValue(expected.AllowAnonymous)
            && normalizeApiEngineFlag(latest.AllowAnonymous) !== normalizeApiEngineFlag(expected.AllowAnonymous)) {
            throw new Error('接口引擎写入后匿名状态不一致：' + expected.ApiEngineKey);
        }
        var expectedCode = String(expected.ApiV8Code || '');
        var actualCode = String(latest.ApiV8Code || '');
        if (expectedCode && actualCode !== expectedCode) {
            throw new Error('接口引擎写入后源码回读不一致：' + expected.ApiEngineKey);
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'ApiAddress')
            && String(latest.ApiAddress || '') !== String(expected.ApiAddress || '')) {
            throw new Error('接口引擎写入后主路由回读不一致：' + expected.ApiEngineKey);
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'ApiRoutes')
            && String(latest.ApiRoutes || '') !== String(expected.ApiRoutes || '')) {
            throw new Error('接口引擎写入后多路由回读不一致：' + expected.ApiEngineKey);
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'Version')
            && String(latest.Version || '') !== String(expected.Version || '')) {
            throw new Error('接口引擎写入后版本回读不一致：' + expected.ApiEngineKey);
        }
        if (expected.Id && String(latest.Id || '') !== String(expected.Id)) {
            throw new Error('接口引擎写入后Id回读不一致：' + expected.ApiEngineKey);
        }
    }

    // ==================== 步骤7：处理sys_apiengine数据（可选） ====================
    activeImportStage = '步骤7-接口引擎';

    if (Package.SysApiEngines && Package.SysApiEngines.length > 0) {
        reportProgress(95, '正在导入接口引擎');
        debugLog.step7 = '开始处理sys_apiengine数据';

        var sysApiEngines = Package.SysApiEngines;

        for (var i = 0; i < sysApiEngines.length; i++) {
            var apiEngine = sysApiEngines[i];
            activeImportResource = 'sys_apiengine:' + String(apiEngine && apiEngine.ApiEngineKey || i);
            var apiEnginePolicy = getApiEngineResourcePolicy(apiEngine.ApiEngineKey);

            // 升级资源入口只在官方租户独立维护，禁止应用数据包覆盖或安装它。
            var apiEngineKeyLower = apiEngine.ApiEngineKey ? String(apiEngine.ApiEngineKey).toLowerCase() : '';
            if (apiEngineKeyLower === 'get-microi-upgrade-resource') {
                debugLog['apiengine_protected_' + i] = '跳过受保护接口引擎：' + apiEngine.ApiEngineKey;
                continue;
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

            // TENANT_CREATE_IF_MISSING_TOMBSTONE_V1：CreateIfMissing 首次出现后，
            // 活跃、禁用或软删除记录都归租户维护。软删除不是授权官方包恢复/覆盖的信号；
            // 先从物理表按稳定 Key 读取（包括 IsDeleted=1），避免重装时以相同 Id 新增并
            // 永久主键冲突，也避免把租户主动删除的 Hook 复活。
            if (apiEnginePolicy.UpgradePolicy == 'CreateIfMissing' && apiEngine.ApiEngineKey) {
                var tenantOwnedRows = V8.Db.FromSql(
                        'SELECT * FROM sys_apiengine WHERE LOWER(ApiEngineKey)=LOWER(@p0)'
                    )
                    .AddInParameter('@p0', apiEngine.ApiEngineKey)
                    .ToArray();
                if (tenantOwnedRows && tenantOwnedRows.length > 0) {
                    var tenantOwnedEngine = tenantOwnedRows[0];
                    stats.ApiEngineSkipped++;
                    debugLog['apiengine_tenant_owned_tombstone_skip_' + i] =
                        '保留租户接口引擎（含软删除状态），不恢复、不覆盖：' + apiEngine.ApiEngineKey;
                    recordApiEngineResourceState(tenantOwnedEngine, apiEnginePolicy);
                    continue;
                }
            }

            // PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2：稳定 Key 是接口的逻辑
            // 身份。物理直查同时包含软删除记录；同 Key 永远原位覆盖。仅当新 Key 的包内
            // Id 已被别的接口占用时生成新 Id，避免让无关接口替包内身份冲突买单。
            if (apiEngine.ApiEngineKey) {
                var physicalByKeyRows = V8.Db.FromSql(
                        'SELECT * FROM sys_apiengine WHERE LOWER(ApiEngineKey)=LOWER(@p0)'
                    )
                    .AddInParameter('@p0', apiEngine.ApiEngineKey)
                    .ToArray();
                if (physicalByKeyRows && physicalByKeyRows.length > 0) {
                    var canonicalApiEngine = selectApiEngineIdentityCanonical(physicalByKeyRows, apiEngine.Id);
                    if (!canonicalApiEngine || !canonicalApiEngine.Id) {
                        throw new Error('接口引擎重复 Key 恢复无法选择稳定记录：' + apiEngine.ApiEngineKey);
                    }
                    if (physicalByKeyRows.length > 1) {
                        var retiredForKey = 0;
                        for (var duplicateIndex = 0; duplicateIndex < physicalByKeyRows.length; duplicateIndex++) {
                            var duplicateApiEngine = physicalByKeyRows[duplicateIndex] || {};
                            if (!duplicateApiEngine.Id
                                || String(duplicateApiEngine.Id) == String(canonicalApiEngine.Id)) continue;
                            removeApiEngineCacheAliases(duplicateApiEngine);
                            var retiredCount = V8.Db.FromSql(
                                    'UPDATE sys_apiengine SET IsDeleted=1 WHERE Id=@p0 AND LOWER(ApiEngineKey)=LOWER(@p1) AND (IsDeleted=0 OR IsDeleted IS NULL)'
                                )
                                .AddInParameter('@p0', duplicateApiEngine.Id)
                                .AddInParameter('@p1', apiEngine.ApiEngineKey)
                                .ExecuteNonQuery();
                            retiredForKey += Number(retiredCount || 0);
                            stats.ApiEngineDuplicatesRetired += Number(retiredCount || 0);
                        }
                        var canonicalRevivedCount = V8.Db.FromSql(
                                'UPDATE sys_apiengine SET IsDeleted=0 WHERE Id=@p0 AND LOWER(ApiEngineKey)=LOWER(@p1)'
                            )
                            .AddInParameter('@p0', canonicalApiEngine.Id)
                            .AddInParameter('@p1', apiEngine.ApiEngineKey)
                            .ExecuteNonQuery();
                        if (Number(canonicalRevivedCount) != 1) {
                            throw new Error('接口引擎重复 Key 恢复未命中稳定记录：' + apiEngine.ApiEngineKey);
                        }
                        var activeCanonicalRows = V8.Db.FromSql(
                                'SELECT * FROM sys_apiengine WHERE LOWER(ApiEngineKey)=LOWER(@p0) AND (IsDeleted=0 OR IsDeleted IS NULL)'
                            )
                            .AddInParameter('@p0', apiEngine.ApiEngineKey)
                            .ToArray();
                        if (!activeCanonicalRows || activeCanonicalRows.length != 1
                            || String(activeCanonicalRows[0].Id) != String(canonicalApiEngine.Id)) {
                            throw new Error('接口引擎重复 Key 恢复后强回读不唯一：' + apiEngine.ApiEngineKey);
                        }
                        canonicalApiEngine = activeCanonicalRows[0];
                        debugLog['apiengine_duplicate_key_repaired_' + i] = '保留稳定Id='
                            + canonicalApiEngine.Id + '，退役活跃重复记录'
                            + retiredForKey + '条：' + apiEngine.ApiEngineKey;
                    }
                    existsByKey = true;
                    existingApiEngineByKey = canonicalApiEngine;
                }
            }
            if (apiEngine.Id) {
                var physicalByIdRows = V8.Db.FromSql('SELECT * FROM sys_apiengine WHERE Id=@p0')
                    .AddInParameter('@p0', apiEngine.Id)
                    .ToArray();
                if (physicalByIdRows && physicalByIdRows.length > 0) {
                    existsById = true;
                    existingApiEngineById = physicalByIdRows[0];
                }
            }

            if (existsByKey) {
                existingApiEngine = existingApiEngineByKey;
                existingId = existingApiEngineByKey.Id;
            } else if (existsById
                && (!apiEngine.ApiEngineKey
                    || String(existingApiEngineById.ApiEngineKey || '').toLowerCase() == apiEngineKeyLower)) {
                existingApiEngine = existingApiEngineById;
                existingId = existingApiEngineById.Id;
            }

            var logicalExists = !!(existingApiEngine && existingApiEngine.Id);
            if (logicalExists && apiEnginePolicy.UpgradePolicy == 'CreateIfMissing') {
                stats.ApiEngineSkipped++;
                debugLog['apiengine_tenant_owned_skip_' + i] =
                    '保留租户接口引擎，不覆盖：' + apiEngine.ApiEngineKey;
                recordApiEngineResourceState(existingApiEngine || apiEngine, apiEnginePolicy);
                continue;
            }

            if (logicalExists && apiEnginePolicy.UpgradePolicy == 'Managed') {
                var incomingHash = apiEngineHash(apiEngine.ApiV8Code);
                var localHash = apiEngineHash(existingApiEngine && existingApiEngine.ApiV8Code);
                var previousState = findPreviousApiEngineState(apiEngine.ApiEngineKey) || {};
                var baseHash = String(previousState.BaseHash || apiEnginePolicy.BaseHash || '').toLowerCase();
                var localVersion = parseApiEngineVersion(existingApiEngine);
                var incomingVersion = parseApiEngineVersion(apiEngine);
                var managedDecision = decideManagedApiEngineUpdate(
                    apiEnginePolicy.Ownership,
                    baseHash,
                    localHash,
                    incomingHash,
                    localVersion,
                    incomingVersion,
                    apiEnginePolicy.CompatibleBaseHashes,
                    trustedOfficialPlatformPackage
                        && String(apiEnginePolicy.Ownership || '').toLowerCase() == 'platform'
                );
                if (managedDecision == 'ApplyPackageManagedOverwrite') {
                    debugLog['apiengine_package_managed_overwrite_' + i] =
                        '包内 Managed 资源覆盖目标记录：' + apiEngine.ApiEngineKey
                        + '，local=' + localHash + '，incoming=' + incomingHash
                        + '，previousPolicy=' + String(previousState.UpgradePolicy || 'none')
                        + '，previousOwnership=' + String(previousState.Ownership || 'none')
                        + '，localVersion=' + (localVersion ? localVersion.join('.') : 'unknown')
                        + '，incomingVersion=' + (incomingVersion ? incomingVersion.join('.') : 'unknown')
                        + '，base=' + (baseHash || 'none');
                }
            }

            var modelCopy = {};
            for (var key in apiEngine) {
                modelCopy[key] = apiEngine[key];
            }
            modelCopy.OsClient = V8.OsClient;
            if (existingApiEngine && existingApiEngine.Id) {
                modelCopy.Id = existingApiEngine.Id;
            } else if (existsById && existingApiEngineById
                && String(existingApiEngineById.ApiEngineKey || '').toLowerCase() != apiEngineKeyLower) {
                modelCopy.Id = String(V8.Method.NewGuid());
                debugLog['apiengine_id_remapped_' + i] = '包内 Id 已被其它接口占用，使用新 Id：'
                    + apiEngine.ApiEngineKey + ' -> ' + modelCopy.Id;
            } else {
                modelCopy.Id = apiEngine.Id || String(V8.Method.NewGuid());
            }
            normalizeApiEngineModel(modelCopy);
            modelCopy.IsDeleted = 0;

            reclaimApiEngineRoutes(modelCopy, modelCopy.Id, 'apiengine_route_reclaimed_' + i);

            var exists = !!(existingApiEngine && existingApiEngine.Id);
            if (exists) {
                // 更新前先清理旧主路由和多路由，避免别名变更后旧地址继续命中旧脚本。
                removeApiEngineCacheAliases(existingApiEngine);
                // FormEngine 默认过滤软删除记录；先恢复同 Key 物理记录，再按包模型覆盖。
                V8.Db.FromSql('UPDATE sys_apiengine SET IsDeleted=0 WHERE Id=@p0')
                    .AddInParameter('@p0', modelCopy.Id)
                    .ExecuteNonQuery();
                var uptResult = V8.FormEngine.UptFormData('sys_apiengine', modelCopy);
                if (uptResult.Code == 1) {
                    stats.ApiEngineUpdated++;
                    var updatedEngine = refreshApiEngineCache(modelCopy.ApiEngineKey, modelCopy.Id, modelCopy.ApiAddress);
                    updatedEngine = reconcilePersistedApiEngineFlags(modelCopy, updatedEngine);
                    assertPersistedApiEngine(modelCopy, updatedEngine);
                    recordApiEngineResourceState(modelCopy, apiEnginePolicy);
                } else {
                    debugLog['apiengine_upt_error_' + existingId] = uptResult.Msg;
                    throw new Error('更新接口引擎失败：' + apiEngine.ApiEngineKey + '，' + (uptResult.Msg || '接口无返回'));
                }
            } else {
                // 不存在则新增
                applyLiteralSwitchDefaults(modelCopy, getNewResourceSwitchDefaults('sys_apiengine'));
                var addResult = V8.FormEngine.AddFormData('sys_apiengine', modelCopy);
                if (addResult.Code == 1) {
                    stats.ApiEngineInserted++;
                    var insertedEngine = refreshApiEngineCache(modelCopy.ApiEngineKey, modelCopy.Id, modelCopy.ApiAddress);
                    insertedEngine = reconcilePersistedApiEngineFlags(modelCopy, insertedEngine);
                    assertPersistedApiEngine(modelCopy, insertedEngine);
                    recordApiEngineResourceState(modelCopy, apiEnginePolicy);
                } else {
                    debugLog['apiengine_add_error_' + (apiEngine.Id || apiEngine.ApiEngineKey)] = addResult.Msg;
                    throw new Error('新增接口引擎失败：' + apiEngine.ApiEngineKey + '，' + (addResult.Msg || '接口无返回'));
                }
            }
        }

        debugLog.step7Result = '接口引擎数据处理完成：新增' + stats.ApiEngineInserted
            + '，修改' + stats.ApiEngineUpdated + '，退役重复记录' + stats.ApiEngineDuplicatesRetired
            + '，保留租户扩展' + stats.ApiEngineSkipped;
    }

    // ==================== 步骤8：导入应用随包数据 ====================
    activeImportStage = '步骤8-随包数据';
    activeImportResource = '';

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
    // DATASET_METADATA_UPDATE_V1：InsertIfMissing 仍然保护租户配置值；官方包只可显式
    // 更新分类、说明、排序三项展示元数据。ConfigValue / SecretCipher 等运行值永不参与。
    var normalizeDataMetadataFields = function (dataSet, sourceRow, dataTableName, conflictPolicy) {
        if (conflictPolicy != 'InsertIfMissing') return [];
        var rawFields = dataSet.MetadataFieldsIfExists || [];
        if (typeof rawFields == 'string') {
            try { rawFields = JSON.parse(rawFields || '[]'); }
            catch (metadataFieldsError) {
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的 MetadataFieldsIfExists 不是有效JSON');
            }
        }
        var allowedFields = { category: 'Category', description: 'Description', sort: 'Sort' };
        var fields = [];
        var fieldMap = {};
        if (rawFields && rawFields.length != null) {
            for (var metadataFieldIndex = 0; metadataFieldIndex < rawFields.length; metadataFieldIndex++) {
                var requestedField = String(rawFields[metadataFieldIndex] || '');
                var canonicalField = allowedFields[requestedField.toLowerCase()];
                if (!canonicalField) {
                    throw new Error('应用数据导入失败：表 ' + dataTableName
                        + ' 的 MetadataFieldsIfExists 仅允许 Category、Description、Sort');
                }
                if (!Object.prototype.hasOwnProperty.call(sourceRow, canonicalField)) {
                    throw new Error('应用数据导入失败：表 ' + dataTableName + ' 的元数据字段缺少值：' + canonicalField);
                }
                if (!fieldMap[canonicalField]) {
                    fields.push(canonicalField);
                    fieldMap[canonicalField] = true;
                }
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

    // DATASET_PARENT_BINDING_V1：配置子表种子按目标库真实父记录绑定，不能携带官方主库的记录 Id。
    // 只解析固定表/字段与参数化相等条件，并且只读取 Id；禁止任意 SQL、V8 或动态表达式。
    var resolveDataSetParentBinding = function (dataSet) {
        var binding = dataSet.ParentBinding;
        if (!binding) return null;
        if (String(dataSet.ConflictPolicy || '') != 'InsertIfMissing'
            || !isSafeDataTableName(binding.Field) || !isSafeDataTableName(binding.TableName)
            || !isSafeDataTableName(binding.MatchField)
            || ['string', 'number', 'boolean'].indexOf(typeof binding.MatchValue) < 0) {
            throw new Error('应用数据 ParentBinding 无效：只允许 InsertIfMissing 的固定父记录绑定');
        }
        var parentResult = V8.FormEngine.GetTableData(binding.TableName, {
            _Where: [[binding.MatchField, '=', binding.MatchValue]],
            _SelectFields: ['Id'], _PageSize: 2, _PageIndex: 1
        });
        if (!parentResult || parentResult.Code != 1 || !parentResult.Data
            || parentResult.Data.length != 1 || !parentResult.Data[0].Id) {
            throw new Error('应用数据 ParentBinding 必须匹配唯一父记录：' + binding.TableName);
        }
        return { Field: binding.Field, Id: String(parentResult.Data[0].Id) };
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
        var resolvedParentBinding = resolveDataSetParentBinding(dataSet);

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
            var sourceRow = remapPackageDataRowReferences(
                dataTableName,
                sourceRows[dataRowIndex] || {},
                dataRowIndex
            );
            if (resolvedParentBinding) sourceRow[resolvedParentBinding.Field] = resolvedParentBinding.Id;
            if (!sourceRow.Id) {
                stats.DataSkipped++;
                throw new Error('应用数据导入失败：表 ' + dataTableName + ' 第' + (dataRowIndex + 1) + '条数据缺少Id');
            }
            var conflictFields = normalizeDataConflictFields(dataSet, sourceRow, dataTableName, conflictPolicy);
            var existingData = findExistingPackageData(dataTableName, sourceRow, conflictPolicy, conflictFields);
            if (conflictPolicy == 'InsertIfMissing' && existingData.Exists) {
                var metadataFields = normalizeDataMetadataFields(dataSet, sourceRow, dataTableName, conflictPolicy);
                if (metadataFields.length > 0) {
                    var existingRow = existingData.Result && existingData.Result.Data;
                    var metadataTargetRow = {
                        Id: String((existingRow && existingRow.Id) || sourceRow.Id),
                        OsClient: V8.OsClient
                    };
                    for (var metadataCopyIndex = 0; metadataCopyIndex < metadataFields.length; metadataCopyIndex++) {
                        var metadataFieldName = metadataFields[metadataCopyIndex];
                        metadataTargetRow[metadataFieldName] = sourceRow[metadataFieldName];
                    }
                    var metadataUpdateResult = V8.FormEngine.UptFormData(dataTableName, metadataTargetRow);
                    if (!metadataUpdateResult || metadataUpdateResult.Code != 1) {
                        throw new Error('应用数据元数据更新失败：表 ' + dataTableName + '，Id=' + metadataTargetRow.Id
                            + '，' + ((metadataUpdateResult && metadataUpdateResult.Msg) || '未知错误'));
                    }
                    stats.DataUpdated++;
                    debugLog['data_insert_if_missing_metadata_' + dataTableName + '_' + dataRowIndex]
                        = '仅更新元数据：' + metadataFields.join(',') + '，匹配字段：' + existingData.Match;
                } else {
                    stats.DataSkipped++;
                    debugLog['data_insert_if_missing_skip_' + dataTableName + '_' + dataRowIndex]
                        = '已存在，匹配字段：' + existingData.Match;
                }
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

    if (!backgroundChunkingEnabled || backgroundCheckpointPhase == 'PostSchema') {
        var layoutRetirements = retirePackageLayoutFields(Package, V8.FormEngine, V8.Cache, V8.OsClient);
        debugLog.layout_field_retirements = layoutRetirements.Retired;
    }

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

    activeImportStage = '最终强回读与版本记录';
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
                + '条，退役重复记录' + stats.ApiEngineDuplicatesRetired
                + '条，保留租户扩展' + stats.ApiEngineSkipped + '条',
            接口引擎修改历史: '迁移' + stats.ApiEngineHistoryMigrated
                + '条，幂等跳过' + stats.ApiEngineHistorySkipped + '条，旧文本保留',
            选择数据: '数据集' + stats.DataSetCount + '个，新增' + stats.DataInserted + '条，修改' + stats.DataUpdated + '条，跳过' + stats.DataSkipped + '条',
            定时任务: '保存' + stats.ScheduleJobSaved + '个',
            在线应用: '安装' + stats.ApplicationInstalled + '个，私有源码新增' + stats.ApplicationSourceFiles + '个/复用' + stats.ApplicationSourceFilesReused + '个，公有编译文件新增' + stats.ApplicationBuildAssets + '个/复用' + stats.ApplicationBuildAssetsReused + '个，数据库内联运行文件' + stats.ApplicationInlineBuildAssets + '个，共享公共运行时' + stats.ApplicationSharedRuntimes + '个，清理旧文件元数据' + stats.AssetRowsPruned + '个，微服务页面' + stats.MicroServicePages + '个，迁移旧菜单' + stats.MicroServiceMenus + '个，退役旧菜单' + stats.MicroServiceMenusRetired + '个，保留原生菜单' + stats.MicroServiceMenusPreserved + '个',
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
        Msg: '导入失败（阶段：' + activeImportStage + '）：' + error.message,
        Data: {
            失败阶段: activeImportStage,
            失败资源: activeImportResource,
            错误信息: error.message,
            错误堆栈: error.stack
        }
    };
}
