/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：export-microi-store-package
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: export-microi-store-package
 * Version: v1.2.9
 * Function:
 * - 导出或持久发布 Microi 应用安装包；支持预制平台包、UTF-8 HDFS、FormEngine fence CAS、两阶段不可变快照收口，并同步服务端与客户端最低版本门禁。
 */

// ==================== 参数接收与校验 ====================

var MenuIds = V8.Param.MenuIds;  // 菜单Id数组
var ExactMenuIds = V8.Param.ExactMenuIds === true || V8.Param.ExactMenuIds === 1 || String(V8.Param.ExactMenuIds || '').toLowerCase() == 'true';  // true时仅导出明确传入的菜单，不递归兄弟/子孙
var FlowIds = V8.Param.FlowIds;  // 工作流Id数组（可选）
var ApiEngineKeys = V8.Param.ApiEngineKeys;  // 接口引擎Key数组（可选）
var TableIds = V8.Param.TableIds;  // 表Id数组（可选，额外需要导出的表，与MenuIds中的表自动去重）
var DataSelections = V8.Param.DataSelections || V8.Param.DataSets;  // 需要随应用包固化的数据选择配置
var AiAppIds = V8.Param.AiAppIds || V8.Param.ApplicationIds;  // 随常规应用包一起安装的在线AI应用Id数组
var AiAppSelections = V8.Param.AiAppSelections || V8.Param.SelectAiApp || [];
var PreparedAssets = V8.Param.PreparedAssets || V8.Param.AiAppPackageManifest || [];
var PackageName = V8.Param.PackageName || '未命名应用包';  // 应用包名称
var PackageVersion = V8.Param.PackageVersion || '1.0.0';  // 应用包版本
var PersistStoreId = String(V8.Param.PersistStoreId || '').replace(/^\s+|\s+$/g, '');
var PersistAppKey = String(V8.Param.PersistAppKey || '').replace(/^\s+|\s+$/g, '');
var HasExpectedPersistAppVersion = typeof V8.Param.ExpectedPersistAppVersion != 'undefined';
var HasExpectedPersistPackageSha256 = typeof V8.Param.ExpectedPersistPackageSha256 != 'undefined';
var ExpectedPersistAppVersion = String(V8.Param.ExpectedPersistAppVersion || '').replace(/^\s+|\s+$/g, '');
var ExpectedPersistPackageSha256 = String(V8.Param.ExpectedPersistPackageSha256 || '').replace(/^\s+|\s+$/g, '').toLowerCase();
var PreparedPersistPackageByteBase64 = String(V8.Param.PreparedPersistPackageByteBase64 || '').replace(/\s+/g, '');
var ResourcePolicies = V8.Param.ResourcePolicies || null;
if (typeof ResourcePolicies == 'string') {
    try { ResourcePolicies = JSON.parse(ResourcePolicies || '{}'); }
    catch (resourcePoliciesError) {
        return { Code: 0, Msg: '参数错误：ResourcePolicies 不是有效JSON' };
    }
}
var PersistChangeLog = V8.Param.PersistChangeLog || null;
if (typeof PersistChangeLog == 'string') {
    try { PersistChangeLog = JSON.parse(PersistChangeLog || '{}'); }
    catch (persistChangeLogError) {
        return { Code: 0, Msg: '参数错误：PersistChangeLog 不是有效JSON' };
    }
}

// 定义调试模式
var isDebug = true;
var debugLog = {};

var invokeType = String(V8.InvokeType || V8.Param._InvokeType || '').toLowerCase();
if (invokeType == 'client' || PersistStoreId) {
    var currentUser = V8.CurrentUser || {};
    var level = parseInt(currentUser.Level || 0, 10);
    if (isNaN(level) || level < 9999) {
        return {
            Code: 0,
            Msg: '权限不足：只有超级管理员才能制作应用离线数据包。'
        };
    }
}



var copyArray = function (value) {
    var list = [];
    if (!value || value.length == null) return list;
    for (var i = 0; i < value.length; i++) list.push(value[i]);
    return list;
};
if (typeof DataSelections == 'string') {
    try { DataSelections = JSON.parse(DataSelections || '[]'); }
    catch (dataSelectionError) {
        return { Code: 0, Msg: '参数错误：DataSelections 不是有效JSON' };
    }
}
DataSelections = copyArray(DataSelections);
TableIds = copyArray(TableIds);
if (typeof AiAppSelections == 'string') {
    try { AiAppSelections = JSON.parse(AiAppSelections || '[]'); } catch (aiSelectionError) { AiAppSelections = []; }
}
if (typeof PreparedAssets == 'string') {
    try { PreparedAssets = JSON.parse(PreparedAssets || '[]'); } catch (preparedAssetError) { PreparedAssets = []; }
}
AiAppSelections = copyArray(AiAppSelections);
PreparedAssets = copyArray(PreparedAssets);
AiAppIds = copyArray(AiAppIds);
if (!AiAppIds.length && AiAppSelections.length) {
    for (var aiSelectionIndex = 0; aiSelectionIndex < AiAppSelections.length; aiSelectionIndex++) {
        var aiSelection = AiAppSelections[aiSelectionIndex] || {};
        var selectedAppId = aiSelection.AppId || aiSelection.Id || aiSelection.id || aiSelection.Value;
        if (selectedAppId) AiAppIds.push(selectedAppId);
    }
}

var PersistFinalizeSnapshot = V8.Param.PersistFinalizeSnapshot === true
    || V8.Param.PersistFinalizeSnapshot === 1
    || String(V8.Param.PersistFinalizeSnapshot || '').toLowerCase() == 'true';
if (PersistStoreId && PersistFinalizeSnapshot) {
    try {
        if (!HasExpectedPersistAppVersion || !HasExpectedPersistPackageSha256) {
            throw new Error('快照收口必须显式提供 ExpectedPersistAppVersion 与 ExpectedPersistPackageSha256');
        }
        var finalizeStoreResult = V8.FormEngine.GetFormData('sys_microistore', {
            Id: PersistStoreId,
            _SelectFields: ['Id', 'AppKey', 'AppVersion', 'PackageHdfsPath', 'PackageSha256', 'PackageSize', 'BuildStatus']
        });
        var finalizeStore = finalizeStoreResult && finalizeStoreResult.Code == 1 ? finalizeStoreResult.Data : null;
        if (!finalizeStore
            || String(finalizeStore.AppVersion || '') != ExpectedPersistAppVersion
            || String(finalizeStore.PackageSha256 || '').toLowerCase() != ExpectedPersistPackageSha256) {
            throw new Error('CAS_CONFLICT：快照收口前商城版本或包摘要已变化');
        }
        var finalizeHistoryResult = V8.FormEngine.GetTableData('mic_data_version', {
            _Where: [
                ['TableRowId', '=', PersistStoreId],
                ['AND', 'TableName', '=', 'sys_microistore']
            ],
            _SelectFields: ['Id', 'Data'],
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC',
            _PageIndex: 1,
            _PageSize: 8
        });
        var finalizeHistoryRows = finalizeHistoryResult && finalizeHistoryResult.Code == 1
            ? copyArray(finalizeHistoryResult.Data)
            : [];
        for (var finalizeHistoryIndex = 0; finalizeHistoryIndex < finalizeHistoryRows.length; finalizeHistoryIndex++) {
            var finalizeSnapshot = finalizeHistoryRows[finalizeHistoryIndex] && finalizeHistoryRows[finalizeHistoryIndex].Data;
            if (typeof finalizeSnapshot == 'string') {
                try { finalizeSnapshot = JSON.parse(finalizeSnapshot); }
                catch (finalizeSnapshotParseError) { finalizeSnapshot = null; }
            }
            if (finalizeSnapshot
                && String(finalizeSnapshot.Id || '') == PersistStoreId
                && String(finalizeSnapshot.AppVersion || '') == ExpectedPersistAppVersion
                && String(finalizeSnapshot.PackageHdfsPath || '') == String(finalizeStore.PackageHdfsPath || '')
                && String(finalizeSnapshot.PackageSha256 || '').toLowerCase() == ExpectedPersistPackageSha256
                && Number(finalizeSnapshot.PackageSize || 0) == Number(finalizeStore.PackageSize || 0)) {
                return {
                    Code: 1,
                    Data: { StoreId: PersistStoreId, AppVersion: ExpectedPersistAppVersion, VersionId: finalizeHistoryRows[finalizeHistoryIndex].Id, Reused: true },
                    Msg: '当前版本不可变安装快照已就绪'
                };
            }
        }

        // MARKETPLACE_ASYNC_SNAPSHOT_FINALIZE_V1：外部共享事务会按设计跳过数据版本队列；
        // 首次发布提交后再单独触碰当前行，让 FormEngine 在自己的已提交事务后异步写入
        // 当前完整行快照。调用方随后用 get-microi-store-model PinCurrentVersion 轮询强回读。
        var finalizeTouchResult = V8.FormEngine.UptFormData('sys_microistore', {
            Id: PersistStoreId,
            BuildStatus: String(finalizeStore.BuildStatus || 'Success')
        });
        if (!finalizeTouchResult || finalizeTouchResult.Code != 1) {
            throw new Error('当前版本不可变安装快照触发失败：' + ((finalizeTouchResult && finalizeTouchResult.Msg) || '接口无返回'));
        }
        return {
            Code: 1,
            Data: { StoreId: PersistStoreId, AppVersion: ExpectedPersistAppVersion, Reused: false, SnapshotPending: true },
            Msg: '当前版本不可变安装快照已触发，请轮询强回读'
        };
    } catch (finalizeSnapshotError) {
        return { Code: 0, Msg: '快照收口失败：' + finalizeSnapshotError.message };
    }
}

// 数据选择依赖表结构。自动将所选数据表合并进 TableIds，避免只导出数据却漏掉表定义和DDL。
var selectedTableIdMap = {};
for (var initialTableIndex = 0; initialTableIndex < TableIds.length; initialTableIndex++) {
    if (TableIds[initialTableIndex]) selectedTableIdMap[String(TableIds[initialTableIndex])] = true;
}
for (var selectionIndex = 0; selectionIndex < DataSelections.length; selectionIndex++) {
    var selectionTableId = DataSelections[selectionIndex] && DataSelections[selectionIndex].TableId;
    if (selectionTableId && !selectedTableIdMap[String(selectionTableId)]) {
        TableIds.push(selectionTableId);
        selectedTableIdMap[String(selectionTableId)] = true;
    }
}

// 参数校验：模块、流程、接口引擎、表单、数据集至少要有一个非空
var hasMenuIds = MenuIds && MenuIds.length > 0;
var hasFlowIds = FlowIds && FlowIds.length > 0;
var hasApiEngineKeys = ApiEngineKeys && ApiEngineKeys.length > 0;
var hasTableIds = TableIds && TableIds.length > 0;
var hasDataSelections = DataSelections.length > 0;
var hasAiAppIds = AiAppIds.length > 0;

if (!hasMenuIds && !hasFlowIds && !hasApiEngineKeys && !hasTableIds && !hasDataSelections && !hasAiAppIds) {
    return {
        Code: 0,
        Msg: '参数错误：MenuIds、FlowIds、ApiEngineKeys、TableIds、DataSelections、AiAppIds 至少要传入一个非空数组'
    };
}

try {
    debugLog.startTime = new Date().toISOString();
    debugLog.inputMenuIds = MenuIds;
    debugLog.exactMenuIds = ExactMenuIds;
    debugLog.inputFlowIds = FlowIds;
    debugLog.inputApiEngineKeys = ApiEngineKeys;
    debugLog.inputTableIds = TableIds;

    var fixedDiyField = [
        { Name: "Id", Label: "Id", Type: "varchar(36)", Component: "Guid", Sort: 1, Visible: 0, TableWidth: 150 },
        { Name: "CreateTime", Label: "创建时间", Type: "datetime", Component: "DateTime", Sort: 2, Visible: 1, TableWidth: 150 },
        { Name: "UpdateTime", Label: "修改时间", Type: "datetime", Component: "DateTime", Sort: 3, Visible: 1, TableWidth: 150 },
        { Name: "UserId", Label: "创建人Id", Type: "varchar(36)", Component: "Guid", Sort: 4, Visible: 0, TableWidth: 150 },
        { Name: "UserName", Label: "创建人", Type: "varchar(255)", Component: "Text", Sort: 5, Visible: 1, TableWidth: 150 },
        { Name: "IsDeleted", Label: "是否已删除", Type: "int", Component: "Switch", Sort: 6, Visible: 0, TableWidth: 50 }
    ];


    var someTableList = V8.FormEngine.GetTableData('diy_table', {
        _Where: [
            ['Name', 'In', ['sys_menu', 'diy_table', 'diy_field', 'wf_flowdesign', 'wf_node', 'wf_line', 'sys_apiengine']]
        ]
    });
    if (someTableList.Code != 1) {
        return someTableList;
    }
    someTableList = someTableList.Data;
    var someTableIds = someTableList.map(item => item.Id);

    var someFieldList = V8.FormEngine.GetTableData('diy_field', {
        _Where: [
            ['TableId', 'In', someTableIds]
        ]
    });
    if (someFieldList.Code != 1) {
        return someFieldList;
    }
    someFieldList = someFieldList.Data;

    // 清理函数：移除对象中值为 null 或空字符串的属性，并移除跨租户字段
    var cleanObject = function (obj) {
        var cleaned = {};
        // 需要移除的字段列表（跨租户数据）
        var excludeFields = {
            'OsClient': true,
            'CreateUserId': true,
            'UpdateUserId': true,
            'CreateUser': true,
            'UpdateUser': true
        };

        for (var key in obj) {
            var value = obj[key];
            // 跳过需要排除的字段
            if (excludeFields[key] || key.indexOf('_Raw') == 0 || key.charAt(0) == '_') {
                continue;
            }
            // 只保留有值的字段（排除 null、undefined、空字符串）
            if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = value;
            }
        }
        return cleaned;
    };

    var isSafeIdentifier = function (name) {
        return !!name && /^[A-Za-z0-9_]+$/.test(String(name));
    };

    var addUniqueTableName = function (map, list, tableName) {
        if (!tableName || !isSafeIdentifier(tableName)) return;
        var key = String(tableName).toLowerCase();
        if (map[key]) return;
        map[key] = true;
        list.push(String(tableName));
    };

    var cleanPhysicalColumn = function (obj) {
        var cleaned = {};
        for (var key in obj) {
            if (obj[key] !== undefined) cleaned[key] = obj[key];
        }
        return cleaned;
    };

    var getPhysicalColumns = function (tableNames) {
        var result = [];
        if (!tableNames || tableNames.length == 0) return result;

        for (var i = 0; i < tableNames.length; i++) {
            var tableName = tableNames[i];
            if (!isSafeIdentifier(tableName)) {
                debugLog['physical_schema_skip_' + i] = 'Unsafe table name: ' + tableName;
                continue;
            }

            try {
                var columns = V8.Db.FromSql(
                    "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_KEY, EXTRA, ORDINAL_POSITION " +
                    "FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0) " +
                    "ORDER BY ORDINAL_POSITION"
                ).AddInParameter('@p0', tableName).ToArray();

                for (var c = 0; c < columns.length; c++) {
                    result.push(cleanPhysicalColumn(columns[c]));
                }
            } catch (schemaError) {
                debugLog['physical_schema_error_' + tableName] = schemaError.message;
            }
        }

        return result;
    };

    // ==================== 步骤1：查询所有菜单数据 ====================

    var exportMenus = [];
    var tableIds = [];
    var tableIdMap = {};

    if (hasMenuIds) {
        // 获取菜单单所有字段 START
        var sysMenuTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'sys_menu');
        var sysMenuTableId = sysMenuTableModel.Id;
        var sysMenuFields = someFieldList.filter(item => item.TableId == sysMenuTableId);
        var sysMenuFieldNames = sysMenuFields.map(item => {
            return item.Name;
        });

        // 去重：使用对象键值特性去除重复字段
        var fieldMap = {};
        for (var i = 0; i < sysMenuFieldNames.length; i++) {
            fieldMap[sysMenuFieldNames[i]] = true;
        }
        sysMenuFieldNames = [];
        for (var fieldName in fieldMap) {
            sysMenuFieldNames.push(fieldName);
        }

        // 确保必要字段存在
        if (sysMenuFieldNames.indexOf('Id') <= -1) {
            sysMenuFieldNames.push('Id');
        }
        if (sysMenuFieldNames.indexOf('ParentId') <= -1) {
            sysMenuFieldNames.push('ParentId');
        }
        if (sysMenuFieldNames.indexOf('DiyTableId') <= -1) {
            sysMenuFieldNames.push('DiyTableId');
        }
        if (sysMenuFieldNames.indexOf('CreateTime') <= -1) {
            sysMenuFieldNames.push('CreateTime');
        }
        // 获取菜单单所有字段 END

        debugLog.sysMenuFieldNames = sysMenuFieldNames;
        debugLog.sysMenuFieldNamesCount = sysMenuFieldNames.length;

        var allMenusResult = V8.FormEngine.GetTableData('sys_menu', {
            _SelectFields: sysMenuFieldNames,
        });

        if (allMenusResult.Code !== 1) {
            return {
                Code: 0,
                Msg: '查询sys_menu表失败：' + allMenusResult.Msg
            };
        }

        var allMenus = allMenusResult.Data || [];
        debugLog.totalMenusInDb = allMenus.length;

        // 检查传入的MenuId是否在查询结果中
        var targetMenu = allMenus.find(m => m.Id == MenuIds[0]);
        debugLog.targetMenuFound = !!targetMenu;
        debugLog.targetMenuData = targetMenu;

        // ==================== 步骤2：递归获取所有子菜单 ====================

        // 递归获取所有子菜单ID（带循环引用检测）
        var getAllChildMenuIds = function (parentId, allMenus, visited) {
            // 初始化访问记录
            if (!visited) {
                visited = {};
            }

            // parentId 必须有值，防止用 null 去匹配导致查询到所有根菜单
            // 注意：用户传入的 MenuId 永远不会是 null，只有在递归过程中数据异常时才可能出现
            if (!parentId) {
                return [];
            }

            // 防止循环引用导致死循环
            if (visited[parentId]) {
                return [];
            }

            visited[parentId] = true;
            var childIds = [parentId]; // 包含自己

            for (var i = 0; i < allMenus.length; i++) {
                // 查找子菜单：ParentId 等于当前 parentId
                // 必须确保子菜单的 Id 有值，防止递归时传入 null
                if (allMenus[i].ParentId == parentId && allMenus[i].Id && allMenus[i].Id != parentId) {
                    var subChildIds = getAllChildMenuIds(allMenus[i].Id, allMenus, visited);
                    childIds = childIds.concat(subChildIds);
                }
            }
            return childIds;
        };

        // 收集所有相关菜单ID
        var allRelatedMenuIds = [];
        var menuIdMap = {};

        for (var i = 0; i < MenuIds.length; i++) {
            var menuId = MenuIds[i];
            var childIds = ExactMenuIds ? [menuId] : getAllChildMenuIds(menuId, allMenus);
            for (var j = 0; j < childIds.length; j++) {
                if (!menuIdMap[childIds[j]]) {
                    allRelatedMenuIds.push(childIds[j]);
                    menuIdMap[childIds[j]] = true;
                }
            }
        }

        debugLog.relatedMenuIdsCount = allRelatedMenuIds.length;
        debugLog.relatedMenuIds = allRelatedMenuIds;

        // 过滤出所有相关菜单数据并清理空字段
        var exportMenus = [];
        for (var i = 0; i < allMenus.length; i++) {
            if (menuIdMap[allMenus[i].Id]) {
                exportMenus.push(cleanObject(allMenus[i]));
            }
        }

        debugLog.exportMenusCount = exportMenus.length;
        if (ExactMenuIds && exportMenus.length != allRelatedMenuIds.length) {
            throw new Error('精确菜单导出失败：部分指定 MenuId 不存在，requested=' + allRelatedMenuIds.length + ' exported=' + exportMenus.length);
        }
        debugLog.exportMenusSample = exportMenus.slice(0, 3);  // 返回前3条菜单数据样本

        // ==================== 步骤3：获取所有菜单关联的表ID ====================

        for (var i = 0; i < exportMenus.length; i++) {
            if (exportMenus[i].DiyTableId) {
                if (!tableIdMap[exportMenus[i].DiyTableId]) {
                    tableIds.push(exportMenus[i].DiyTableId);
                    tableIdMap[exportMenus[i].DiyTableId] = true;
                }
            }
        }

        debugLog.relatedTableIds = tableIds;

        // ==================== 步骤3.5：发现子表控件（TableChild）关联的菜单 ====================
        // 查询当前已收集的tableIds对应的字段，找到Component='TableChild'的字段
        // 从其Config中提取TableChildSysMenuId，将对应的菜单及其子菜单也加入导出范围

        if (!ExactMenuIds && tableIds.length > 0) {
            var tableChildFieldsResult = V8.FormEngine.GetTableData('diy_field', {
                _Where: [
                    ['TableId', 'In', JSON.stringify(tableIds)],
                    ['Component', '=', 'TableChild']
                ],
                _SelectFields: ['Id', 'TableId', 'Config', 'Name']
            });

            if (tableChildFieldsResult.Code == 1 && tableChildFieldsResult.Data && tableChildFieldsResult.Data.length > 0) {
                var tableChildMenuIds = [];
                debugLog.tableChildFieldsCount = tableChildFieldsResult.Data.length;

                for (var tc = 0; tc < tableChildFieldsResult.Data.length; tc++) {
                    var tcField = tableChildFieldsResult.Data[tc];
                    if (tcField.Config) {
                        try {
                            var tcConfig = typeof tcField.Config === 'string' ? JSON.parse(tcField.Config) : tcField.Config;
                            if (tcConfig.TableChildSysMenuId && !menuIdMap[tcConfig.TableChildSysMenuId]) {
                                tableChildMenuIds.push(tcConfig.TableChildSysMenuId);
                                debugLog['tableChild_found_' + tcField.Name] = 'TableChildSysMenuId=' + tcConfig.TableChildSysMenuId;
                            }
                        } catch (tcParseError) {
                            debugLog['tableChild_config_parse_error_' + tcField.Id] = tcParseError.message;
                        }
                    }
                }

                // 对发现的子表菜单ID进行递归展开（获取其所有子菜单）
                if (tableChildMenuIds.length > 0) {
                    debugLog.tableChildMenuIds = tableChildMenuIds;

                    for (var tci = 0; tci < tableChildMenuIds.length; tci++) {
                        var tcMenuId = tableChildMenuIds[tci];
                        var tcChildIds = getAllChildMenuIds(tcMenuId, allMenus);
                        for (var tcj = 0; tcj < tcChildIds.length; tcj++) {
                            if (!menuIdMap[tcChildIds[tcj]]) {
                                allRelatedMenuIds.push(tcChildIds[tcj]);
                                menuIdMap[tcChildIds[tcj]] = true;
                            }
                        }
                    }

                    // 将新发现的菜单加入exportMenus，并收集其关联的表ID
                    for (var tci = 0; tci < allMenus.length; tci++) {
                        if (menuIdMap[allMenus[tci].Id]) {
                            var tcAlreadyExported = false;
                            for (var tce = 0; tce < exportMenus.length; tce++) {
                                if (exportMenus[tce].Id == allMenus[tci].Id) {
                                    tcAlreadyExported = true;
                                    break;
                                }
                            }
                            if (!tcAlreadyExported) {
                                exportMenus.push(cleanObject(allMenus[tci]));
                                // 收集新菜单关联的表ID
                                if (allMenus[tci].DiyTableId && !tableIdMap[allMenus[tci].DiyTableId]) {
                                    tableIds.push(allMenus[tci].DiyTableId);
                                    tableIdMap[allMenus[tci].DiyTableId] = true;
                                }
                            }
                        }
                    }

                    debugLog.afterTableChildMenuCount = exportMenus.length;
                    debugLog.afterTableChildTableIds = tableIds.slice();
                }
            }
        }

    } else {
        debugLog.step1Skip = '未传入MenuIds，跳过菜单数据查询';
    }

    // ==================== 步骤3.6：合并额外传入的TableIds（去重） ====================

    if (hasTableIds) {
        for (var eti = 0; eti < TableIds.length; eti++) {
            if (TableIds[eti] && !tableIdMap[TableIds[eti]]) {
                tableIds.push(TableIds[eti]);
                tableIdMap[TableIds[eti]] = true;
            }
        }
        debugLog.afterMergeExtraTableIds = tableIds.slice();
        debugLog.extraTableIdsCount = TableIds.length;
    }

    // ==================== 步骤4：查询所有相关的diy_table数据 ====================
    // 获取 diy_table 所有字段 START
    var diyTableTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'diy_table');
    var diyTableTableId = diyTableTableModel.Id;
    var diyTableFields = someFieldList.filter(item => item.TableId == diyTableTableId);
    var diyTableFieldNames = diyTableFields.map(item => {
        return item.Name;
    });
    if (diyTableFieldNames.indexOf('Id') <= -1) {
        diyTableFieldNames.push('Id');
    }
    if (diyTableFieldNames.indexOf('CreateTime') <= -1) {
        diyTableFieldNames.push('CreateTime');
    }
    // 获取 diy_table 所有字段 END

    var exportTables = [];

    if (tableIds.length > 0) {
        var tablesResult = V8.FormEngine.GetTableData('diy_table', {
            _SelectFields: diyTableFieldNames,
            _Where: [
                ['Id', 'In', JSON.stringify(tableIds)]
            ]
        });

        if (tablesResult.Code !== 1) {
            return {
                Code: 0,
                Msg: '查询diy_table表失败：' + tablesResult.Msg
            };
        }

        exportTables = tablesResult.Data || [];
    }

    // 清理 diy_table 数据
    exportTables = exportTables.map(cleanObject);

    debugLog.exportTablesCount = exportTables.length;

    // ==================== 步骤5：查询所有相关的diy_field数据 ====================
    // 获取 diy_field 所有字段 START
    var diyFieldTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'diy_field');
    var diyFieldTableId = diyFieldTableModel.Id;
    var diyFieldFields = someFieldList.filter(item => item.TableId == diyFieldTableId);
    var diyFieldFieldNames = diyFieldFields.map(item => {
        return item.Name;
    });
    if (diyFieldFieldNames.indexOf('Id') <= -1) {
        diyFieldFieldNames.push('Id');
    }
    if (diyFieldFieldNames.indexOf('CreateTime') <= -1) {
        diyFieldFieldNames.push('CreateTime');
    }
    // 获取 diy_field 所有字段 END
    var exportFields = [];

    if (tableIds.length > 0) {
        var fieldsResult = V8.FormEngine.GetTableData('diy_field', {
            _SelectFields: diyFieldFieldNames,
            _Where: [
                ['TableId', 'In', JSON.stringify(tableIds)]
            ],
        });

        if (fieldsResult.Code !== 1) {
            return {
                Code: 0,
                Msg: '查询diy_field表失败：' + fieldsResult.Msg
            };
        }

        exportFields = fieldsResult.Data || [];
    }

    // 清理 diy_field 数据
    exportFields = exportFields.map(cleanObject);

    debugLog.exportFieldsCount = exportFields.length;

    // ==================== 步骤5.5：生成DDL语句 ====================

    // MySQL类型映射函数
    var mapToMySQLType = function (diyType) {
        if (!diyType) return 'varchar(255)';

        var typeStr = diyType.toLowerCase();

        // 已经是标准MySQL类型，直接返回
        if (typeStr.match(/^(varchar|int|bigint|datetime|text|longtext|decimal|double|float|tinyint|date|time|timestamp|json)\(/)) {
            return diyType;
        }
        if (typeStr == 'int' || typeStr == 'bigint' || typeStr == 'text' || typeStr == 'mediumtext' || typeStr == 'longtext' ||
            typeStr == 'datetime' || typeStr == 'date' || typeStr == 'time' || typeStr == 'timestamp' ||
            typeStr == 'json' || typeStr == 'tinyint' || typeStr == 'double' || typeStr == 'float') {
            return diyType;
        }

        // 类型映射
        if (typeStr.indexOf('varchar') == 0) return diyType;
        if (typeStr.indexOf('decimal') == 0) return diyType;
        if (typeStr.indexOf('mediumtext') == 0) return diyType;

        // 默认映射规则
        return 'varchar(255)';
    };

    // 为每个表生成DDL
    var ddlStatements = [];
    for (var i = 0; i < exportTables.length; i++) {
        var table = exportTables[i];
        var tableName = table.Name;
        var tableFields = exportFields.filter(f => f.TableId == table.Id);

        if (!tableName) continue;

        // 合并审计字段：先添加fixedDiyField，再添加表的自定义字段
        var allFields = [];

        // 1. 添加审计字段
        for (var k = 0; k < fixedDiyField.length; k++) {
            allFields.push({
                Name: fixedDiyField[k].Name,
                Type: fixedDiyField[k].Type,
                Label: fixedDiyField[k].Label,
                IsFixed: true
            });
        }

        // 2. 添加表的自定义字段（排除已在fixedDiyField中的字段）
        var fixedFieldNames = {};
        for (var k = 0; k < fixedDiyField.length; k++) {
            fixedFieldNames[fixedDiyField[k].Name] = true;
        }

        for (var j = 0; j < tableFields.length; j++) {
            if (!fixedFieldNames[tableFields[j].Name]) {
                allFields.push({
                    Name: tableFields[j].Name,
                    Type: tableFields[j].Type,
                    Label: tableFields[j].Label || tableFields[j].Name,
                    IsFixed: false
                });
            }
        }

        if (allFields.length == 0) continue;

        var fieldDefs = [];
        var fieldNameMap = {};  // 用于字段去重

        for (var j = 0; j < allFields.length; j++) {
            var field = allFields[j];
            var fieldName = field.Name;

            if (!fieldName) continue;

            // MySQL字段名长度限制为64字符，超过则截断并记录
            if (fieldName.length > 64) {
                debugLog['field_name_too_long_' + table.Name + '_' + fieldName] = '字段名过长，已截断：' + fieldName.length + '字符';
                fieldName = fieldName.substring(0, 64);
            }

            // 字段去重：如果字段名已存在，跳过
            if (fieldNameMap[fieldName]) {
                debugLog['field_duplicate_' + table.Name + '_' + fieldName] = '字段重复，已跳过';
                continue;
            }
            fieldNameMap[fieldName] = true;

            var fieldType = mapToMySQLType(field.Type);
            var fieldDef = '`' + fieldName + '` ' + fieldType;

            // 主键不允许NULL
            if (fieldName == 'Id') {
                fieldDef += ' NOT NULL PRIMARY KEY';
            } else {
                // 其他字段允许NULL
                fieldDef += ' NULL';
            }

            // 添加字段说明（COMMENT）
            if (field.Label && field.Label !== fieldName) {
                // 转义单引号
                var comment = field.Label.replace(/'/g, "''");
                fieldDef += " COMMENT '" + comment + "'";
            }

            fieldDefs.push(fieldDef);
        }

        if (fieldDefs.length > 0) {
            var ddl = 'CREATE TABLE IF NOT EXISTS `' + tableName + '` (\n  ' +
                fieldDefs.join(',\n  ') +
                '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
            ddlStatements.push({
                TableName: tableName,
                TableId: table.Id,
                DDL: ddl
            });
        }
    }

    debugLog.ddlStatementsCount = ddlStatements.length;

    // ==================== 步骤6：查询工作流数据（可选） ====================

    var exportFlows = [];
    var exportNodes = [];
    var exportLines = [];

    // 检查是否要导出所有工作流
    var exportAllFlows = FlowIds && FlowIds.length == 1 && FlowIds[0] == '*';

    if (exportAllFlows || (FlowIds && FlowIds.length > 0)) {
        // 获取 wf_flowdesign 所有字段 START
        var wfFlowdesignTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'wf_flowdesign');
        var wfFlowdesignTableId = wfFlowdesignTableModel.Id;
        var wfFlowdesignFields = someFieldList.filter(item => item.TableId == wfFlowdesignTableId);
        var wfFlowdesignFieldNames = wfFlowdesignFields.map(item => {
            return item.Name;
        });
        if (wfFlowdesignFieldNames.indexOf('Id') <= -1) {
            wfFlowdesignFieldNames.push('Id');
        }
        if (wfFlowdesignFieldNames.indexOf('CreateTime') <= -1) {
            wfFlowdesignFieldNames.push('CreateTime');
        }
        // 获取 wf_flowdesign 所有字段 END

        // 查询工作流设计数据
        var flowsWhere = [];
        if (!exportAllFlows) {
            // 只导出指定的工作流
            flowsWhere.push(['Id', 'In', JSON.stringify(FlowIds)]);
        }
        // 如果是导出所有工作流，不添加Where条件

        var flowsResult = V8.FormEngine.GetTableData('wf_flowdesign', {
            _SelectFields: wfFlowdesignFieldNames,
            _Where: flowsWhere.length > 0 ? flowsWhere : undefined,
        });

        if (flowsResult.Code == 1) {
            exportFlows = flowsResult.Data || [];
            exportFlows = exportFlows.map(cleanObject);
            debugLog.exportFlowsCount = exportFlows.length;
            debugLog.exportAllFlows = exportAllFlows;

            // 查询工作流节点数据
            if (exportFlows.length > 0) {
                // 收集实际导出的工作流Id列表
                var actualFlowIds = exportFlows.map(function (flow) { return flow.Id; });
                debugLog.actualFlowIds = actualFlowIds;
                // 获取 wf_node 所有字段 START
                var wfNodeTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'wf_node');
                var wfNodeTableId = wfNodeTableModel.Id;
                var wfNodeFields = someFieldList.filter(item => item.TableId == wfNodeTableId);
                var wfNodeFieldNames = wfNodeFields.map(item => {
                    return item.Name;
                });
                if (wfNodeFieldNames.indexOf('Id') <= -1) {
                    wfNodeFieldNames.push('Id');
                }
                if (wfNodeFieldNames.indexOf('CreateTime') <= -1) {
                    wfNodeFieldNames.push('CreateTime');
                }
                // 获取 wf_node 所有字段 END

                var nodesResult = V8.FormEngine.GetTableData('wf_node', {
                    _SelectFields: wfNodeFieldNames,
                    _Where: [
                        ['FlowDesignId', 'In', JSON.stringify(actualFlowIds)]
                    ],
                });

                if (nodesResult.Code == 1) {
                    exportNodes = nodesResult.Data || [];
                    exportNodes = exportNodes.map(cleanObject);
                    debugLog.exportNodesCount = exportNodes.length;
                }

                // 获取 wf_line 所有字段 START
                var wfLineTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'wf_line');
                var wfLineTableId = wfLineTableModel.Id;
                var wfLineFields = someFieldList.filter(item => item.TableId == wfLineTableId);
                var wfLineFieldNames = wfLineFields.map(item => {
                    return item.Name;
                });
                if (wfLineFieldNames.indexOf('Id') <= -1) {
                    wfLineFieldNames.push('Id');
                }
                if (wfLineFieldNames.indexOf('CreateTime') <= -1) {
                    wfLineFieldNames.push('CreateTime');
                }
                // 获取 wf_line 所有字段 END

                // 查询工作流连线数据
                var linesResult = V8.FormEngine.GetTableData('wf_line', {
                    _SelectFields: wfLineFieldNames,
                    _Where: [
                        ['FlowDesignId', 'In', JSON.stringify(actualFlowIds)]
                    ],
                });

                if (linesResult.Code == 1) {
                    exportLines = linesResult.Data || [];
                    exportLines = exportLines.map(cleanObject);
                    debugLog.exportLinesCount = exportLines.length;
                }
            }
        }
    }

    // ==================== 步骤7：查询接口引擎数据（可选） ====================

    var exportApiEngines = [];

    if (hasApiEngineKeys) {
        // 获取 sys_apiengine 所有字段 START
        var sysApiEngineTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() == 'sys_apiengine');
        if (sysApiEngineTableModel) {
            var sysApiEngineTableId = sysApiEngineTableModel.Id;
            var sysApiEngineFields = someFieldList.filter(item => item.TableId == sysApiEngineTableId);
            var sysApiEngineFieldNames = sysApiEngineFields.map(item => {
                return item.Name;
            });
            if (sysApiEngineFieldNames.indexOf('Id') <= -1) {
                sysApiEngineFieldNames.push('Id');
            }
            if (sysApiEngineFieldNames.indexOf('ApiEngineKey') <= -1) {
                sysApiEngineFieldNames.push('ApiEngineKey');
            }
            if (sysApiEngineFieldNames.indexOf('CreateTime') <= -1) {
                sysApiEngineFieldNames.push('CreateTime');
            }
            // 获取 sys_apiengine 所有字段 END

            // 检查是否要导出所有接口引擎
            var exportAllApiEngines = ApiEngineKeys.length == 1 && ApiEngineKeys[0] == '*';

            // 查询接口引擎数据
            var apiEnginesWhere = [];
            if (!exportAllApiEngines) {
                // 只导出指定的接口引擎
                apiEnginesWhere.push(['ApiEngineKey', 'In', JSON.stringify(ApiEngineKeys)]);
            }
            // 如果是导出所有接口引擎，不添加Where条件

            var apiEnginesResult = V8.FormEngine.GetTableData('sys_apiengine', {
                _SelectFields: sysApiEngineFieldNames,
                _Where: apiEnginesWhere.length > 0 ? apiEnginesWhere : undefined,
            });

            if (apiEnginesResult.Code == 1) {
                exportApiEngines = apiEnginesResult.Data || [];
                exportApiEngines = exportApiEngines.map(cleanObject);
                debugLog.exportApiEnginesCount = exportApiEngines.length;
                debugLog.exportAllApiEngines = exportAllApiEngines;
            }
        } else {
            debugLog.apiEngineTableNotFound = 'sys_apiengine表定义未找到';
        }
    }


    // ==================== 步骤8：固化用户选择的数据 ====================

    var exportDataSets = [];
    var exportDataRowCount = 0;
    var allowedDataOperators = {
        '=': true, '==': true, 'Equal': true, '<>': true, '!=': true, 'NotEqual': true,
        '>': true, '>=': true, '<': true, '<=': true,
        'Like': true, 'NotLike': true, 'StartLike': true, 'EndLike': true,
        'NotStartLike': true, 'NotEndLike': true, 'In': true, 'NotIn': true
    };
    var protectedDataTables = {
        'diy_table': true, 'diy_field': true, 'sys_menu': true, 'sys_user': true,
        'sys_role': true, 'sys_rolelimit': true, 'sys_osclients': true,
        'sys_config': true, 'sys_apiengine': true, 'sys_token': true,
        'sys_userlogin': true, 'sys_microistore': true
    };
    var isSafeDataName = function (name) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ''));
    };

    for (var dataSetIndex = 0; dataSetIndex < DataSelections.length; dataSetIndex++) {
        var selection = DataSelections[dataSetIndex] || {};
        var selectedTable = null;
        for (var exportedTableIndex = 0; exportedTableIndex < exportTables.length; exportedTableIndex++) {
            var exportedTable = exportTables[exportedTableIndex] || {};
            if ((selection.TableId && String(exportedTable.Id) == String(selection.TableId)) ||
                (selection.TableName && String(exportedTable.Name).toLowerCase() == String(selection.TableName).toLowerCase())) {
                selectedTable = exportedTable;
                break;
            }
        }
        if (!selectedTable || !isSafeDataName(selectedTable.Name)) {
            throw new Error('选择数据失败：数据表不存在或名称不合法（' + (selection.TableName || selection.TableId || '') + '）');
        }
        var lowerSelectedTableName = String(selectedTable.Name).toLowerCase();
        if (protectedDataTables[lowerSelectedTableName] || lowerSelectedTableName.indexOf('wf_') == 0) {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 属于平台结构或安全表，不允许作为应用数据导出');
        }

        var selectionMode = String(selection.SelectionMode || 'Ids');
        var rowIds = copyArray(selection.RowIds);
        var safeWhere = [];
        var sourceWhere = copyArray(selection.Where);
        if (selectionMode.toLowerCase() == 'where') {
            if (sourceWhere.length == 0) {
                throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 使用按条件选择时，条件不能为空');
            }
            for (var whereIndex = 0; whereIndex < sourceWhere.length; whereIndex++) {
                var whereItem = copyArray(sourceWhere[whereIndex]);
                if (whereItem.length < 3 || !isSafeDataName(whereItem[0]) || !allowedDataOperators[String(whereItem[1])]) {
                    throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 存在不合法的筛选条件');
                }
                safeWhere.push([whereItem[0], whereItem[1], whereItem[2]]);
            }
        } else {
            selectionMode = 'Ids';
            var uniqueRowIds = [];
            var rowIdMap = {};
            for (var rowIdIndex = 0; rowIdIndex < rowIds.length; rowIdIndex++) {
                var rowId = String(rowIds[rowIdIndex] || '');
                if (rowId && !rowIdMap[rowId]) {
                    uniqueRowIds.push(rowId);
                    rowIdMap[rowId] = true;
                }
            }
            rowIds = uniqueRowIds;
            if (rowIds.length == 0) {
                throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 至少要选择一条数据');
            }
        }

        var dataQuery = { _PageIndex: 1, _PageSize: 5001 };
        if (selectionMode == 'Ids') dataQuery.Ids = rowIds;
        else dataQuery._Where = safeWhere;
        var selectedRowsResult = V8.FormEngine.GetTableData(selectedTable.Name, dataQuery);
        if (!selectedRowsResult || selectedRowsResult.Code != 1) {
            throw new Error('选择数据失败：读取表 ' + selectedTable.Name + ' 失败，' + ((selectedRowsResult && selectedRowsResult.Msg) || '未知错误'));
        }
        var selectedRows = copyArray(selectedRowsResult.Data);
        var selectedDataCount = parseInt(selectedRowsResult.DataCount || selectedRows.length || 0, 10);
        if (selectedRows.length > 5000 || selectedDataCount > 5000) {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 单次最多导出5000条，请缩小筛选条件');
        }
        if (selectionMode == 'Ids' && selectedRows.length != rowIds.length) {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 中部分已选记录不存在，请重新选择');
        }

        var conflictPolicy = String(selection.ConflictPolicy || 'UpsertById');
        if (conflictPolicy != 'UpsertById' && conflictPolicy != 'InsertIfMissing') {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 仅支持 UpsertById 或 InsertIfMissing 冲突策略');
        }
        var rawConflictFields = selection.ConflictFields || [];
        if (typeof rawConflictFields == 'string') {
            try { rawConflictFields = JSON.parse(rawConflictFields || '[]'); }
            catch (conflictFieldsError) {
                throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 的 ConflictFields 不是有效JSON');
            }
        }
        rawConflictFields = copyArray(rawConflictFields);
        var conflictFields = [];
        var conflictFieldMap = {};
        for (var conflictFieldIndex = 0; conflictFieldIndex < rawConflictFields.length; conflictFieldIndex++) {
            var conflictField = String(rawConflictFields[conflictFieldIndex] || '');
            if (!isSafeDataName(conflictField)) {
                throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 存在不合法的 ConflictFields 字段');
            }
            var conflictFieldKey = conflictField.toLowerCase();
            if (!conflictFieldMap[conflictFieldKey]) {
                conflictFields.push(conflictField);
                conflictFieldMap[conflictFieldKey] = true;
            }
        }
        if (conflictFields.length > 5) {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 的 ConflictFields 最多5个字段');
        }
        if (conflictPolicy == 'InsertIfMissing' && conflictFields.length == 0) {
            throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 使用 InsertIfMissing 时必须声明 ConflictFields');
        }

        var cleanRows = [];
        for (var cleanRowIndex = 0; cleanRowIndex < selectedRows.length; cleanRowIndex++) {
            var cleanRow = cleanObject(selectedRows[cleanRowIndex]);
            for (var validateConflictIndex = 0; validateConflictIndex < conflictFields.length; validateConflictIndex++) {
                var validateConflictField = conflictFields[validateConflictIndex];
                if (!Object.prototype.hasOwnProperty.call(cleanRow, validateConflictField)
                    || cleanRow[validateConflictField] === null
                    || cleanRow[validateConflictField] === undefined
                    || String(cleanRow[validateConflictField]).trim() === '') {
                    throw new Error('选择数据失败：表 ' + selectedTable.Name + ' 的冲突字段缺少值：' + validateConflictField);
                }
            }
            cleanRows.push(cleanRow);
        }
        exportDataRowCount += cleanRows.length;
        exportDataSets.push({
            TableId: selectedTable.Id,
            TableName: selectedTable.Name,
            TableDescription: selectedTable.Description || selectedTable.Name,
            SelectionMode: selectionMode,
            RowIds: selectionMode == 'Ids' ? rowIds : [],
            Where: selectionMode == 'Where' ? safeWhere : [],
            ConflictPolicy: conflictPolicy,
            ConflictFields: conflictFields,
            Rows: cleanRows
        });
    }
    debugLog.exportDataSetCount = exportDataSets.length;
    debugLog.exportDataRowCount = exportDataRowCount;

    var physicalTableNameMap = {};
    var physicalTableNames = [];

    for (var pt = 0; pt < exportTables.length; pt++) {
        addUniqueTableName(physicalTableNameMap, physicalTableNames, exportTables[pt].Name);
    }

    for (var st = 0; st < someTableList.length; st++) {
        addUniqueTableName(physicalTableNameMap, physicalTableNames, someTableList[st].Name);
    }

    var physicalColumns = getPhysicalColumns(physicalTableNames);
    debugLog.physicalTableNames = physicalTableNames;
    debugLog.physicalColumnsCount = physicalColumns.length;

    // ==================== 步骤8：打包所选在线AI应用 ====================

    var applicationBundles = [];
    var applicationPackages = [];
    for (var aiAppIndex = 0; aiAppIndex < AiAppIds.length; aiAppIndex++) {
        var aiAppId = AiAppIds[aiAppIndex];
        if (!aiAppId) continue;
        var aiAppOption = {};
        for (var aiOptionIndex = 0; aiOptionIndex < AiAppSelections.length; aiOptionIndex++) {
            var candidateOption = AiAppSelections[aiOptionIndex] || {};
            if (String(candidateOption.AppId || candidateOption.Id || '') == String(aiAppId)) { aiAppOption = candidateOption; break; }
        }
        var aiPreparedAsset = null;
        for (var aiPreparedIndex = 0; aiPreparedIndex < PreparedAssets.length; aiPreparedIndex++) {
            var candidateAsset = PreparedAssets[aiPreparedIndex] || {};
            if (String(candidateAsset.AppId || '') == String(aiAppId)) { aiPreparedAsset = candidateAsset; break; }
        }
        var aiPackageResult = V8.ApiEngine.Run('ai_app_publish_store', {
            Action: 'PackageOnly',
            AppId: aiAppId,
            IncludeSource: aiAppOption.IncludeSource === true || aiAppOption.IncludeSource === 1,
            DatabaseOnlyBuild: aiAppOption.DatabaseOnlyBuild === true
                || aiAppOption.DatabaseOnlyBuild === 1
                || String(aiAppOption.DatabaseOnlyBuild || '').toLowerCase() === 'true',
            PreparedAssets: aiPreparedAsset,
            ReturnPackageModel: true,
            PackageModelOnly: true,
            DataSelections: []
        });
        if (!aiPackageResult || aiPackageResult.Code != 1 || !aiPackageResult.Data || !aiPackageResult.Data.Package) {
            throw new Error('AI应用打包失败：' + aiAppId + '，' + ((aiPackageResult && aiPackageResult.Msg) || '接口无返回'));
        }
        var aiPackage = aiPackageResult.Data.Package;
        if (!aiPackage.ApplicationBundle) {
            throw new Error('AI应用打包失败：' + aiAppId + ' 未返回 ApplicationBundle');
        }
        applicationBundles.push(aiPackage.ApplicationBundle);
        applicationPackages.push(aiPackage);
    }
    debugLog.applicationBundleCount = applicationBundles.length;

    // ==================== 步骤9：组装数据包 ====================

    var packageData = {
        PackageInfo: {
            Name: PackageName,
            Version: PackageVersion,
            CreateTime: new Date().toISOString(),
            CreateUser: V8.CurrentUser.Name || '未知',
            MenuCount: exportMenus.length,
            TableCount: exportTables.length,
            FieldCount: exportFields.length,
            FlowCount: exportFlows.length,
            NodeCount: exportNodes.length,
            LineCount: exportLines.length,
            DDLCount: ddlStatements.length,
            PhysicalColumnCount: physicalColumns.length,
            ApiEngineCount: exportApiEngines.length,
            DataSetCount: exportDataSets.length,
            DataRowCount: exportDataRowCount,
            AiApplicationCount: applicationBundles.length
        },
        DDLStatements: ddlStatements,  // DDL语句数组
        PhysicalColumns: physicalColumns,
        SysMenus: exportMenus,
        DiyTables: exportTables,
        DiyFields: exportFields,
        DataSets: exportDataSets
    };

    var appendUnique = function (target, source, keyGetter) {
        var exists = {};
        for (var targetIndex = 0; targetIndex < target.length; targetIndex++) {
            exists[keyGetter(target[targetIndex], targetIndex)] = true;
        }
        for (var sourceIndex = 0; sourceIndex < source.length; sourceIndex++) {
            var sourceItem = source[sourceIndex];
            var sourceKey = keyGetter(sourceItem, sourceIndex);
            if (!exists[sourceKey]) {
                target.push(sourceItem);
                exists[sourceKey] = true;
            }
        }
    };

    if (applicationBundles.length > 0) {
        packageData.ApplicationBundles = applicationBundles;
        for (var appPackageIndex = 0; appPackageIndex < applicationPackages.length; appPackageIndex++) {
            var infrastructurePackage = applicationPackages[appPackageIndex] || {};
            appendUnique(packageData.DDLStatements, copyArray(infrastructurePackage.DDLStatements), function (item) {
                return String((item && (item.TableName || item.Name)) || JSON.stringify(item));
            });
            appendUnique(packageData.PhysicalColumns, copyArray(infrastructurePackage.PhysicalColumns), function (item) {
                return String((item && (item.TableName || item.Name)) || JSON.stringify(item));
            });
            appendUnique(packageData.DiyTables, copyArray(infrastructurePackage.DiyTables), function (item) {
                return String((item && (item.Name || item.Id)) || JSON.stringify(item));
            });
            appendUnique(packageData.DiyFields, copyArray(infrastructurePackage.DiyFields), function (item) {
                return String((item && item.TableId) || '') + ':' + String((item && (item.Name || item.Id)) || '');
            });
        }
        packageData.PackageInfo.DDLCount = packageData.DDLStatements.length;
        packageData.PackageInfo.PhysicalColumnCount = packageData.PhysicalColumns.length;
        packageData.PackageInfo.TableCount = packageData.DiyTables.length;
        packageData.PackageInfo.FieldCount = packageData.DiyFields.length;
    }

    // 只有在有工作流数据时才添加
    if (exportFlows.length > 0) {
        packageData.WfFlowDesigns = exportFlows;
        packageData.WfNodes = exportNodes;
        packageData.WfLines = exportLines;
    }

    // 只有在有接口引擎数据时才添加
    if (exportApiEngines.length > 0) {
        packageData.SysApiEngines = exportApiEngines;
    }

    if (ResourcePolicies) {
        packageData.ResourcePolicies = ResourcePolicies;
    }

    debugLog.endTime = new Date().toISOString();
    debugLog.packageSize = JSON.stringify(packageData).length;

    // 可选后台持久化模式：大包永不经 HTTP/MCP 回传。FormEngine 的数据版本
    // 能力会为 sys_microistore 自动产生不可变 mic_data_version 安装快照。
    if (PersistStoreId) {
        var exactPackageVersion = String(PackageVersion || '').replace(/^\s+|\s+$/g, '');
        if (!/^v\d+\.\d+\.\d+$/.test(exactPackageVersion)) {
            throw new Error('持久化发布必须提供 vX.Y.Z 精确 PackageVersion');
        }
        if (!HasExpectedPersistAppVersion || !HasExpectedPersistPackageSha256) {
            throw new Error('持久化发布必须显式提供 ExpectedPersistAppVersion 与 ExpectedPersistPackageSha256');
        }
        var storeResult = V8.FormEngine.GetFormData('sys_microistore', {
            Id: PersistStoreId,
            _SelectFields: [
                'Id', 'AppKey', 'AppId', 'AppName', 'Name', 'ApplicationType', 'IsApprove',
                'AppVersion', 'Status', 'BuildStatus', 'AppPakcet', 'PackageId', 'PackageStorageMode',
                'PackageHdfsPath', 'PackageSha256', 'PackageSize', 'PackageContentType',
                'PackageFormatVersion', 'PackageUploadedAt', 'ServerMinVersion', 'ClientMinVersion'
            ]
        });
        if (!storeResult || storeResult.Code != 1 || !storeResult.Data) {
            throw new Error('持久化发布失败：商城记录不存在，StoreId=' + PersistStoreId);
        }
        var storeRow = storeResult.Data;
        if (PersistAppKey && String(storeRow.AppKey || storeRow.AppId || '').toLowerCase() != PersistAppKey.toLowerCase()) {
            throw new Error('持久化发布失败：PersistAppKey 与商城记录不一致');
        }
        if (String(storeRow.AppVersion || '').replace(/^\s+|\s+$/g, '') != ExpectedPersistAppVersion
            || String(storeRow.PackageSha256 || '').replace(/^\s+|\s+$/g, '').toLowerCase() != ExpectedPersistPackageSha256) {
            throw new Error('CAS_CONFLICT：商城记录版本或包摘要已变化，请重新读取后发布');
        }
        if (PreparedPersistPackageByteBase64) {
            // MARKETPLACE_PREPARED_PACKAGE_BASE64_V1：少数平台基础包需要保留经审计的最小
            // 物理列与跨库 DDL，不能由普通表导出器把系统字段或全库物理列再次膨胀。
            // 仅超级管理员持久发布可用；UTF-8 字节往返、AppKey、版本与数量全部失败关闭。
            var preparedPackageBytes = System.Convert.FromBase64String(PreparedPersistPackageByteBase64);
            var preparedPackageText = String(System.Text.Encoding.UTF8.GetString(preparedPackageBytes));
            var preparedRoundTrip = String(System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(preparedPackageText)));
            if (preparedRoundTrip != PreparedPersistPackageByteBase64) {
                throw new Error('持久化发布失败：预制包 UTF-8 Base64 往返不一致');
            }
            var preparedPackageData = null;
            try { preparedPackageData = JSON.parse(preparedPackageText); }
            catch (preparedPackageError) {
                throw new Error('持久化发布失败：预制包不是有效 JSON');
            }
            var preparedInfo = preparedPackageData && preparedPackageData.PackageInfo;
            var preparedAppKey = String(preparedInfo && (preparedInfo.AppKey || preparedInfo.AppId) || '');
            if (!preparedInfo
                || preparedAppKey.toLowerCase() != String(storeRow.AppKey || storeRow.AppId || '').toLowerCase()
                || String(preparedInfo.Version || '') != exactPackageVersion) {
                throw new Error('持久化发布失败：预制包 AppKey 或精确版本与商城记录不一致');
            }
            var preparedMenus = copyArray(preparedPackageData.SysMenus);
            var preparedTables = copyArray(preparedPackageData.DiyTables);
            var preparedFields = copyArray(preparedPackageData.DiyFields);
            var preparedEngines = copyArray(preparedPackageData.SysApiEngines);
            var preparedDdl = copyArray(preparedPackageData.DDLStatements);
            var preparedPhysicalColumns = copyArray(preparedPackageData.PhysicalColumns);
            if (Number(preparedInfo.MenuCount || 0) != preparedMenus.length
                || Number(preparedInfo.TableCount || 0) != preparedTables.length
                || Number(preparedInfo.FieldCount || 0) != preparedFields.length
                || Number(preparedInfo.ApiEngineCount || 0) != preparedEngines.length
                || Number(preparedInfo.DDLCount || 0) != preparedDdl.length
                || Number(preparedInfo.PhysicalColumnCount || 0) != preparedPhysicalColumns.length) {
                throw new Error('持久化发布失败：预制包资源计数与正文不一致');
            }
            packageData = preparedPackageData;
        }
        var persistTitle = '';
        var persistContent = '';
        var persistReleaseTime = '';
        var persistChangeType = '';
        var persistSort = 100;
        var changeLogNeedsAdd = false;
        if (PersistChangeLog) {
            persistTitle = String(PersistChangeLog.Title || '').replace(/^\s+|\s+$/g, '');
            persistContent = String(PersistChangeLog.Content || '').replace(/^\s+|\s+$/g, '');
            persistReleaseTime = String(PersistChangeLog.ReleaseTime || '').replace(/^\s+|\s+$/g, '');
            persistChangeType = String(PersistChangeLog.ChangeType || 'Feature');
            persistSort = parseInt(PersistChangeLog.Sort || 100, 10);
            if (!persistTitle || !persistContent || !persistReleaseTime) {
                throw new Error('持久化发布失败：PersistChangeLog 必须包含 Title、Content、ReleaseTime');
            }
            var existingChangeLogResult = V8.FormEngine.GetTableData('sys_microistore_changelog', {
                _Where: [
                    ['StoreId', '=', PersistStoreId],
                    ['AND', 'Version', '=', exactPackageVersion],
                    ['AND', 'IsDeleted', '<>', 1]
                ],
                _SelectFields: ['Id', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort'],
                _PageIndex: 1,
                _PageSize: 2
            });
            var existingChangeLogs = existingChangeLogResult && existingChangeLogResult.Code == 1
                ? copyArray(existingChangeLogResult.Data)
                : [];
            if (existingChangeLogs.length > 1) {
                throw new Error('持久化发布失败：精确版本更新日志存在重复记录 ' + exactPackageVersion);
            }
            if (existingChangeLogs.length == 0) {
                changeLogNeedsAdd = true;
            } else if (String(existingChangeLogs[0].Title || '') != persistTitle
                || String(existingChangeLogs[0].ChangeType || '') != persistChangeType
                || String(existingChangeLogs[0].Content || '') != persistContent
                || String(existingChangeLogs[0].ReleaseTime || '') != persistReleaseTime
                || Number(existingChangeLogs[0].Sort || 0) != Number(persistSort || 0)) {
                throw new Error('持久化发布失败：精确版本更新日志已存在但内容不一致');
            }
        }
        var changeLogResult = V8.FormEngine.GetTableData('sys_microistore_changelog', {
            _Where: [
                ['StoreId', '=', PersistStoreId],
                ['AND', 'Version', '=', exactPackageVersion],
                ['AND', 'IsDeleted', '<>', 1]
            ],
            _SelectFields: ['Id', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort'],
            _PageIndex: 1,
            _PageSize: 2
        });
        var changeLogs = changeLogResult && changeLogResult.Code == 1 ? copyArray(changeLogResult.Data) : [];
        if (changeLogNeedsAdd && changeLogs.length == 0) {
            changeLogs = [{
                Version: exactPackageVersion,
                Title: persistTitle,
                ChangeType: persistChangeType,
                Content: persistContent,
                ReleaseTime: persistReleaseTime,
                Sort: persistSort
            }];
        } else if (changeLogs.length != 1) {
            throw new Error('持久化发布失败：必须先维护且仅维护一条精确版本更新日志 ' + exactPackageVersion);
        }
        packageData.PackageInfo.Name = storeRow.AppName || storeRow.Name || PackageName;
        packageData.PackageInfo.Version = exactPackageVersion;
        packageData.PackageInfo.AppId = storeRow.AppKey || storeRow.AppId || PersistAppKey;
        packageData.PackageInfo.ApplicationType = storeRow.ApplicationType || 'Platform';
        packageData.PackageInfo.ChangeLog = {
            Version: changeLogs[0].Version,
            Title: changeLogs[0].Title,
            Content: changeLogs[0].Content,
            ReleaseTime: changeLogs[0].ReleaseTime
        };
        var packageJson = JSON.stringify(packageData);
        // MARKETPLACE_HDFS_PACKAGE_PERSIST_V1：包体先进入 HDFS 并完成大小/SHA-256 回读，
        // 当前行与 mic_data_version 只保存不可变小指针，避免每次版本快照复制数 MB JSON。
        // MARKETPLACE_PACKAGE_UTF8_BASE64_TRANSPORT_V1：长中文 JSON 先按 UTF-8 编码成
        // 纯 ASCII Base64 再跨嵌套接口边界，存储端继续做无损往返和 HDFS 强回读。
        var packageByteBase64 = String(System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(packageJson)));
        var packageStorageResult = V8.ApiEngine.Run('microi-store-package-storage', {
            Action: 'Store', StoreId: PersistStoreId, AppVersion: exactPackageVersion, PackageByteBase64: packageByteBase64
        });
        if (!packageStorageResult || packageStorageResult.Code != 1 || !packageStorageResult.Data) {
            throw new Error('持久化发布 HDFS 包失败：' + ((packageStorageResult && packageStorageResult.Msg) || '接口无返回'));
        }
        var packagePointer = packageStorageResult.Data;
        var isExactPublishedStore = function (row) {
            return !!row
                && String(row.AppVersion || '') == exactPackageVersion
                && String(row.Status || '') == 'Published'
                && String(row.BuildStatus || '') == 'Success'
                && String(row.AppPakcet || '') == ''
                && String(row.PackageId || '') == String(packagePointer.PackageId || '')
                && String(row.PackageStorageMode || '') == String(packagePointer.PackageStorageMode || '')
                && String(row.PackageHdfsPath || '') == String(packagePointer.PackageHdfsPath || '')
                && String(row.PackageSha256 || '').toLowerCase() == String(packagePointer.PackageSha256 || '').toLowerCase()
                && Number(row.PackageSize || 0) == Number(packagePointer.PackageSize || 0)
                && String(row.ServerMinVersion || '') == String(packageData.PackageInfo.ServerMinVersion || '')
                && String(row.ClientMinVersion || '') == String(packageData.PackageInfo.ClientMinVersion || '');
        };
        var hasExactPinnedSnapshot = function () {
            var historyResult = V8.FormEngine.GetTableData('mic_data_version', {
                _Where: [
                    ['TableRowId', '=', PersistStoreId],
                    ['AND', 'TableName', '=', 'sys_microistore']
                ],
                _SelectFields: ['Id', 'Data'],
                _OrderBy: 'CreateTime',
                _OrderByType: 'DESC',
                _PageIndex: 1,
                _PageSize: 8
            }, V8.DbTrans);
            if (!historyResult || historyResult.Code != 1) return false;
            var historyRows = copyArray(historyResult.Data);
            for (var historyIndex = 0; historyIndex < historyRows.length; historyIndex++) {
                var snapshot = historyRows[historyIndex] && historyRows[historyIndex].Data;
                if (typeof snapshot == 'string') {
                    try { snapshot = JSON.parse(snapshot); }
                    catch (snapshotParseError) { snapshot = null; }
                }
                if (snapshot
                    && String(snapshot.Id || '') == PersistStoreId
                    && String(snapshot.AppVersion || '') == exactPackageVersion
                    && String(snapshot.PackageHdfsPath || '') == String(packagePointer.PackageHdfsPath || '')
                    && String(snapshot.PackageSha256 || '').toLowerCase() == String(packagePointer.PackageSha256 || '').toLowerCase()
                    && Number(snapshot.PackageSize || 0) == Number(packagePointer.PackageSize || 0)) return true;
            }
            return false;
        };
        if (!changeLogNeedsAdd && isExactPublishedStore(storeRow) && hasExactPinnedSnapshot()) {
            return {
                Code: 1,
                Data: {
                    StoreId: PersistStoreId,
                    AppKey: storeRow.AppKey,
                    AppVersion: storeRow.AppVersion,
                    PackageId: packagePointer.PackageId,
                    PackageStorageMode: packagePointer.PackageStorageMode,
                    PackageHdfsPath: packagePointer.PackageHdfsPath,
                    PackageSha256: packagePointer.PackageSha256,
                    PackageSize: packagePointer.PackageSize,
                    Reused: true
                },
                Msg: '应用商城数据包已存在且不可变快照完整，本次未重复写入'
            };
        }

        // MARKETPLACE_STORE_PUBLISH_CAS_V2：所有数据库写统一经过 FormEngine 的接口引擎
        // 事务。禁止使用 V8.Db 做占位，因为旧运行时的 V8.Db 可能使用独立连接并提前
        // 提交。唯一 fence 写入 BuildStatus，随后强回读 fence、旧版本和旧摘要；没有抢到
        // 当前行的并发会话无法伪装成功，Code=0 时 fence 与更新日志一起回滚。
        var publishFence = 'Publishing:' + String(V8.Method.NewUlid());
        var casWhere = [['Id', '=', PersistStoreId]];
        if (ExpectedPersistAppVersion) {
            casWhere.push(['AND', 'AppVersion', '=', ExpectedPersistAppVersion]);
        } else {
            casWhere.push(['AND', '(', 'AppVersion', '=', null]);
            casWhere.push(['OR', 'AppVersion', '=', '', ')']);
        }
        if (ExpectedPersistPackageSha256) {
            casWhere.push(['AND', 'PackageSha256', '=', ExpectedPersistPackageSha256]);
        } else {
            casWhere.push(['AND', '(', 'PackageSha256', '=', null]);
            casWhere.push(['OR', 'PackageSha256', '=', '', ')']);
        }
        var expectedBuildStatus = String(storeRow.BuildStatus || '');
        if (expectedBuildStatus) {
            casWhere.push(['AND', 'BuildStatus', '=', expectedBuildStatus]);
        } else {
            casWhere.push(['AND', '(', 'BuildStatus', '=', null]);
            casWhere.push(['OR', 'BuildStatus', '=', '', ')']);
        }
        var casResult = V8.FormEngine.UptFormDataByWhere('sys_microistore', {
            _Where: casWhere,
            BuildStatus: publishFence
        }, V8.DbTrans);
        if (!casResult || casResult.Code != 1) {
            throw new Error('CAS_CONFLICT：商城记录已被其它发布会话更新，请重新读取后发布');
        }
        var casReadResult = V8.FormEngine.GetFormData('sys_microistore', {
            Id: PersistStoreId,
            _SelectFields: ['Id', 'AppVersion', 'PackageSha256', 'BuildStatus']
        }, V8.DbTrans);
        var casReadRow = casReadResult && casReadResult.Code == 1 ? casReadResult.Data : null;
        if (!casReadRow
            || String(casReadRow.BuildStatus || '') != publishFence
            || String(casReadRow.AppVersion || '') != ExpectedPersistAppVersion
            || String(casReadRow.PackageSha256 || '').toLowerCase() != ExpectedPersistPackageSha256) {
            throw new Error('CAS_CONFLICT：未能取得当前商城记录的唯一发布 fence');
        }
        if (changeLogNeedsAdd) {
            var addChangeLogResult = V8.FormEngine.AddFormData('sys_microistore_changelog', {
                OsClient: V8.OsClient,
                StoreId: PersistStoreId,
                Version: exactPackageVersion,
                Title: persistTitle,
                ChangeType: persistChangeType,
                Content: persistContent,
                ReleaseTime: persistReleaseTime,
                Sort: persistSort
            }, V8.DbTrans);
            if (!addChangeLogResult || addChangeLogResult.Code != 1) {
                throw new Error('持久化发布失败：新增精确版本更新日志失败，'
                    + ((addChangeLogResult && addChangeLogResult.Msg) || '接口无返回'));
            }
        }
        var exactChangeLogReadback = V8.FormEngine.GetTableData('sys_microistore_changelog', {
            _Where: [
                ['StoreId', '=', PersistStoreId],
                ['AND', 'Version', '=', exactPackageVersion],
                ['AND', 'IsDeleted', '<>', 1]
            ],
            _SelectFields: ['Id', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort'],
            _PageIndex: 1,
            _PageSize: 2
        }, V8.DbTrans);
        var exactChangeLogRows = exactChangeLogReadback && exactChangeLogReadback.Code == 1
            ? copyArray(exactChangeLogReadback.Data)
            : [];
        if (exactChangeLogRows.length != 1
            || String(exactChangeLogRows[0].Title || '') != String(changeLogs[0].Title || '')
            || String(exactChangeLogRows[0].Content || '') != String(changeLogs[0].Content || '')) {
            throw new Error('持久化发布失败：CAS 后精确版本更新日志回读不一致');
        }
        var updateResult = V8.FormEngine.UptFormData('sys_microistore', {
            Id: PersistStoreId,
            AppVersion: exactPackageVersion,
            AppPakcet: '',
            PackageId: packagePointer.PackageId,
            PackageStorageMode: packagePointer.PackageStorageMode,
            PackageHdfsPath: packagePointer.PackageHdfsPath,
            PackageSha256: packagePointer.PackageSha256,
            PackageSize: packagePointer.PackageSize,
            PackageContentType: packagePointer.PackageContentType,
            PackageFormatVersion: packagePointer.PackageFormatVersion,
            PackageUploadedAt: packagePointer.PackageUploadedAt,
            ServerMinVersion: String(packageData.PackageInfo.ServerMinVersion || ''),
            ClientMinVersion: String(packageData.PackageInfo.ClientMinVersion || ''),
            Status: 'Published',
            BuildStatus: 'Success',
            AppPublishTime: DateNow('yyyy-MM-dd HH:mm:ss'),
            AppUpdateTime: DateNow('yyyy-MM-dd HH:mm:ss')
        }, V8.DbTrans);
        if (!updateResult || updateResult.Code != 1) {
            throw new Error('持久化发布失败：' + ((updateResult && updateResult.Msg) || '商城记录更新无返回'));
        }
        var verifyResult = V8.FormEngine.GetFormData('sys_microistore', {
            Id: PersistStoreId,
            _SelectFields: ['Id', 'AppKey', 'AppVersion', 'Status', 'BuildStatus', 'AppPakcet', 'PackageId', 'PackageStorageMode', 'PackageHdfsPath', 'PackageSha256', 'PackageSize', 'ServerMinVersion', 'ClientMinVersion']
        }, V8.DbTrans);
        var verifyRow = verifyResult && verifyResult.Code == 1 ? verifyResult.Data : null;
        if (!verifyRow
            || String(verifyRow.AppVersion || '') != exactPackageVersion
            || String(verifyRow.Status || '') != 'Published'
            || String(verifyRow.BuildStatus || '') != 'Success'
            || String(verifyRow.AppPakcet || '') != ''
            || String(verifyRow.PackageHdfsPath || '') != String(packagePointer.PackageHdfsPath || '')
            || String(verifyRow.PackageSha256 || '').toLowerCase() != String(packagePointer.PackageSha256 || '').toLowerCase()
            || Number(verifyRow.PackageSize || 0) != Number(packagePointer.PackageSize || 0)
            || String(verifyRow.ServerMinVersion || '') != String(packageData.PackageInfo.ServerMinVersion || '')
            || String(verifyRow.ClientMinVersion || '') != String(packageData.PackageInfo.ClientMinVersion || '')) {
            throw new Error('持久化发布回读不一致，已停止返回成功');
        }
        return {
            Code: 1,
            Data: {
                StoreId: PersistStoreId,
                AppKey: verifyRow.AppKey,
                AppVersion: verifyRow.AppVersion,
                PackageId: packagePointer.PackageId,
                PackageStorageMode: packagePointer.PackageStorageMode,
                PackageHdfsPath: packagePointer.PackageHdfsPath,
                PackageSha256: packagePointer.PackageSha256,
                PackageSize: packagePointer.PackageSize,
                Reused: false,
                SnapshotPending: true,
                MenuCount: packageData.SysMenus.length,
                TableCount: packageData.DiyTables.length,
                FieldCount: packageData.DiyFields.length,
                ApiEngineCount: copyArray(packageData.SysApiEngines).length,
                AiApplicationCount: applicationBundles.length
            },
            Msg: '应用商城数据包已原子发布并完成回读'
        };
    }

    // ==================== 返回结果 ====================

    return {
        Code: 1,
        Data: packageData,
        Msg: '导出成功',
        Debug: isDebug ? debugLog : undefined
    };

} catch (error) {
    // ==================== 异常处理 ====================

    debugLog.error = {
        message: error.message,
        stack: error.stack,
        endTime: new Date().toISOString()
    };

    return {
        Code: 0,
        Msg: '导出失败：' + error.message,
        Debug: isDebug ? debugLog : undefined
    };
}

