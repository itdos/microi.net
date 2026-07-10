/*
 * V8 ApiEngine
 * ApiEngineKey: import-microi-store-package
 * Version: v1.0.7
 * Function:
 * - 导入应用商城离线/在线应用数据包，创建或更新表、字段、菜单、工作流、接口引擎等元数据。
 * - 运行在后台任务按钮中时，通过 V8.Method.UpdateBackgroundTask 按阶段写入 Redis 进度，通知中心显示真实百分比。
 * - 前端调用时仅允许 Level >= 9999 的用户安装应用；后端升级程序调用时按 V8.InvokeType=Server 放行。
 * - 支持自定义商城源传入 StoreOsClient/AppStoreOsClient，安装完成后写入当前租户 sys_microistoreversion。
 */

// ==================== 参数接收与校验 ====================

var Package = V8.Param.Package;  // 应用数据包
var InstallParentSysMenuId = V8.Param.InstallParentSysMenuId;  // 安装在哪个父级系统菜单Id下

// 执行日志收集（用于最终构建中文报告）
var debugLog = {};

var invokeType = String(V8.InvokeType || V8.Param._InvokeType || '').toLowerCase();
if (invokeType == 'client') {
    var currentUser = V8.CurrentUser || {};
    var level = parseInt(currentUser.Level || 0, 10);
    if (isNaN(level) || level < 9999) {
        return {
            Code: 0,
            Msg: '权限不足：只有超级管理员才能安装应用。'
        };
    }
}

var backgroundTaskId = V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId || '';
var reportProgress = function (progress, msg) {
    if (!backgroundTaskId || !V8.Method || !V8.Method.UpdateBackgroundTask) return;
    try {
        V8.Method.UpdateBackgroundTask({
            _BackgroundTaskId: backgroundTaskId,
            Progress: progress,
            Msg: msg,
            Message: msg,
            Current: progress,
            Total: 100
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
if (!Package && storeRow && storeRow.AppPakcet) {
    Package = storeRow.AppPakcet;
}
if (!Package && firstTextParam([V8.Param.StoreId, V8.Param.Id, storeRow.Id])) {
    reportProgress(3, '正在从应用商城源获取应用数据包');
    var storeApiBase = trimRightSlash(firstTextParam([V8.Param.StoreApiBase, storeRow.StoreApiBase, storeRow.AppStoreApiBase, 'https://api.itdos.com']));
    var storeOsClient = firstTextParam([V8.Param.StoreOsClient, V8.Param.AppStoreOsClient, storeRow.StoreOsClient, storeRow.AppStoreOsClient, storeRow.SourceOsClient, 'iTdos']);
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

try {
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

    // ==================== 统计变量 ====================

    var stats = {
        TableInserted: 0,
        TableUpdated: 0,
        TableIdRemapped: 0,
        FieldInserted: 0,
        FieldUpdated: 0,
        FieldIdRemapped: 0,
        MenuInserted: 0,
        MenuUpdated: 0,
        MenuIdRemapped: 0,
        ReferenceRowsUpdated: 0,
        FlowInserted: 0,
        FlowUpdated: 0,
        NodeInserted: 0,
        NodeUpdated: 0,
        LineInserted: 0,
        LineUpdated: 0,
        ApiEngineInserted: 0,
        ApiEngineUpdated: 0,
        VersionRecordUpdated: 0
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
        'PageTabs', 'BatchSelectMoreBtns', 'ExportMoreBtns', 'DiyConfig', 'JoinTables'
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

            var where = [];
            if (appId) {
                where.push(['AppId', '=', appId]);
            } else if (storeId) {
                where.push(['StoreId', '=', storeId]);
            } else {
                where.push(['AppName', '=', appName]);
            }

            var now = DateNow('yyyy-MM-dd HH:mm:ss');
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
                    ApiEngineUpdated: stats.ApiEngineUpdated
                }),
                Remark: '应用商城安装完成'
            };

            var existing = V8.FormEngine.GetFormData('sys_microistoreversion', {
                _Where: where,
                _PageSize: 1
            });
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

    var syncReferenceRows = function (tableName, directFields, jsonFields) {
        if (!hasAnyIdMap()) return 0;
        var rowsResult = V8.FormEngine.GetTableData(tableName, {
            OsClient: V8.OsClient,
            _PageSize: 99999
        });
        if (rowsResult.Code != 1 || !rowsResult.Data) return 0;

        var updated = 0;
        var rows = rowsResult.Data || [];
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (!row.Id) continue;
            var model = { Id: row.Id, OsClient: V8.OsClient };
            var changed = false;

            for (var d = 0; d < directFields.length; d++) {
                var directField = directFields[d];
                if (row[directField]) {
                    var mappedDirect = findMappedId(row[directField]);
                    if (mappedDirect !== row[directField]) {
                        model[directField] = mappedDirect;
                        changed = true;
                    }
                }
            }

            for (var j = 0; j < jsonFields.length; j++) {
                var jsonField = jsonFields[j];
                if (row[jsonField]) {
                    var mappedJson = replaceIdsInJsonText(row[jsonField]);
                    if (mappedJson !== row[jsonField]) {
                        model[jsonField] = mappedJson;
                        changed = true;
                    }
                }
            }

            if (changed) {
                var uptReferenceResult = V8.FormEngine.UptFormData(tableName, model);
                if (uptReferenceResult.Code == 1) {
                    updated++;
                } else {
                    debugLog['reference_sync_error_' + tableName + '_' + row.Id] = uptReferenceResult.Msg;
                }
            }
        }
        stats.ReferenceRowsUpdated += updated;
        return updated;
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
        applyPackageIdMaps();
        var updated = 0;
        updated += syncReferenceRows('diy_field', ['TableId'], fieldJsonFields);
        updated += syncReferenceRows('sys_menu', ['ParentId', 'DiyTableId'], menuJsonFields);
        return updated;
    };

    var remapTableIdInDatabase = function (oldId, newId, tableName) {
        try {
            execNonQuery('UPDATE diy_table SET Id = @p0 WHERE Id = @p1 AND IsDeleted<>1', [newId, oldId]);
            execNonQuery('UPDATE diy_field SET TableId = @p0 WHERE TableId = @p1 AND IsDeleted<>1', [newId, oldId]);
            execNonQuery('UPDATE sys_menu SET DiyTableId = @p0 WHERE DiyTableId = @p1 AND IsDeleted<>1', [newId, oldId]);
            addIdMap('Table', oldId, newId, tableName || '');
        } catch (remapError) {
            debugLog['table_id_remap_error_' + newId] = remapError.message;
        }
    };

    var remapFieldIdInDatabase = function (oldId, newId, fieldName) {
        try {
            execNonQuery('UPDATE diy_field SET Id = @p0 WHERE Id = @p1 AND IsDeleted<>1', [newId, oldId]);
            addIdMap('Field', oldId, newId, fieldName || '');
        } catch (remapError) {
            debugLog['field_id_remap_error_' + newId] = remapError.message;
        }
    };

    var remapMenuIdInDatabase = function (oldId, newId, menuName) {
        try {
            execNonQuery('UPDATE sys_menu SET Id = @p0 WHERE Id = @p1 AND IsDeleted<>1', [newId, oldId]);
            execNonQuery('UPDATE sys_menu SET ParentId = @p0 WHERE ParentId = @p1 AND IsDeleted<>1', [newId, oldId]);
            addIdMap('Menu', oldId, newId, menuName || '');
        } catch (remapError) {
            debugLog['menu_id_remap_error_' + newId] = remapError.message;
        }
    };

    // ==================== 步骤0：执行DDL创建表和字段 ====================

    reportProgress(10, '正在创建和检查物理表');
    debugLog.step0 = '开始执行DDL创建表';

    var ddlStatements = Package.DDLStatements || [];
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

    var getPhysicalValue = function (row, names) {
        for (var i = 0; i < names.length; i++) {
            if (row[names[i]] !== undefined && row[names[i]] !== null) return row[names[i]];
        }
        return null;
    };

    var buildPhysicalColumnDefinition = function (column, includePrimaryKey) {
        var columnName = getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']);
        var columnType = getPhysicalValue(column, ['COLUMN_TYPE', 'ColumnType', 'Type']);
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

    var groupPackagePhysicalColumns = function (columns) {
        var grouped = {};
        columns = columns || [];
        for (var i = 0; i < columns.length; i++) {
            var column = columns[i];
            var tableName = getPhysicalValue(column, ['TABLE_NAME', 'TableName']);
            var columnName = getPhysicalValue(column, ['COLUMN_NAME', 'ColumnName', 'Name']);
            if (!tableName || !columnName || !isSafeIdentifier(tableName) || !isSafeIdentifier(columnName)) continue;

            var tableKey = String(tableName).toLowerCase();
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
        var grouped = groupPackagePhysicalColumns(columns);
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

                var definition = buildPhysicalColumnDefinition(sourceColumn, false);
                if (!definition) continue;

                var targetColumn = targetColumns[String(columnName).toLowerCase()];
                try {
                    if (!targetColumn) {
                        var addSql = 'ALTER TABLE `' + tableName + '` ADD COLUMN ' + definition;
                        V8.Db.FromSql(addSql).ExecuteNonQuery();
                        result.Added++;
                        debugLog['physical_schema_added_' + tableName + '_' + columnName] = String(columnType);
                        continue;
                    }

                    var sourceNullable = String(getPhysicalValue(sourceColumn, ['IS_NULLABLE', 'IsNullable']) || '').toUpperCase();
                    var targetNullable = String(targetColumn.IS_NULLABLE || '').toUpperCase();
                    var sourceDefault = getPhysicalValue(sourceColumn, ['COLUMN_DEFAULT', 'ColumnDefault', 'Default']);
                    var targetDefault = targetColumn.COLUMN_DEFAULT;
                    var sourceComment = String(getPhysicalValue(sourceColumn, ['COLUMN_COMMENT', 'ColumnComment', 'Comment']) || '');
                    var targetComment = String(targetColumn.COLUMN_COMMENT || '');
                    var typeChanged = normalizeSqlType(targetColumn.COLUMN_TYPE) != normalizeSqlType(columnType);
                    var nullChanged = sourceNullable && sourceNullable != targetNullable;
                    var defaultChanged = String(sourceDefault === null || sourceDefault === undefined ? '' : sourceDefault) !=
                        String(targetDefault === null || targetDefault === undefined ? '' : targetDefault);
                    var commentChanged = sourceComment != targetComment;

                    if (typeChanged || nullChanged || defaultChanged || commentChanged) {
                        var modifySql = 'ALTER TABLE `' + tableName + '` MODIFY COLUMN ' + definition;
                        V8.Db.FromSql(modifySql).ExecuteNonQuery();
                        result.Modified++;
                        debugLog['physical_schema_modified_' + tableName + '_' + columnName] =
                            'type:' + targetColumn.COLUMN_TYPE + '->' + columnType + ', null:' + targetNullable + '->' + sourceNullable;
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

    for (var i = 0; i < ddlStatements.length; i++) {
        var ddlItem = ddlStatements[i];
        if (!ddlItem.DDL || !ddlItem.TableName) continue;

        var tableCreated = false;

        try {
            // 先尝试创建表（CREATE TABLE IF NOT EXISTS）
            V8.Db.FromSql(ddlItem.DDL).ExecuteNonQuery();
            tableCreated = true;
            ddlExecuted++;
            debugLog['ddl_create_' + ddlItem.TableName] = '表创建成功';
        } catch (ddlError) {
            // 创建失败（表可能已存在）
            debugLog['ddl_create_error_' + ddlItem.TableName] = ddlError.message;
            ddlSkipped++;
        }

        // 无论表是新创建还是已存在，都检查并补充缺失的字段
        try {
            // 查询表的所有字段
            var checkColumnsSQL = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + ddlItem.TableName + "'";
            var columnsData = V8.Db.FromSql(checkColumnsSQL).ToArray();

            if (!columnsData || columnsData.length == 0) {
                debugLog['ddl_check_columns_' + ddlItem.TableName] = '表不存在或查询字段失败';
                continue;
            }

            var existingColumns = {};
            for (var c = 0; c < columnsData.length; c++) {
                try {
                    var colName = columnsData[c].COLUMN_NAME;
                    if (colName != null && colName !== undefined) {
                        // 使用String.prototype确保安全
                        var colNameStr = String.prototype.toLowerCase.call(String(colName));
                        existingColumns[colNameStr] = true;
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
                    if (existingColumns[fieldNameStr.toLowerCase()]) {
                        continue;
                    }
                } catch (e) {
                    debugLog['field_check_error_' + ddlItem.TableName + '_' + fieldNameStr] = 'Error checking field: ' + e.message;
                    continue;
                }

                var fieldType = mapToMySQLType(field.Type);
                var alterSQL = 'ALTER TABLE `' + ddlItem.TableName + '` ADD COLUMN `' + fieldName + '` ' + fieldType;

                // Id字段不允许NULL，其他字段允许NULL
                if (fieldName == 'Id') {
                    alterSQL += ' NOT NULL PRIMARY KEY';
                } else {
                    alterSQL += ' NULL';
                }

                // 添加字段说明（COMMENT）
                if (field.Label && field.Label !== fieldName) {
                    // 转义单引号
                    var comment = field.Label.replace(/'/g, "''");
                    alterSQL += " COMMENT '" + comment + "'";
                }

                try {
                    V8.Db.FromSql(alterSQL).ExecuteNonQuery();
                    fieldsAdded++;
                    fieldsAddedForTable++;
                    debugLog['field_added_' + ddlItem.TableName + '_' + fieldName] = '字段已添加';
                } catch (alterError) {
                    debugLog['field_add_error_' + ddlItem.TableName + '_' + fieldName] = alterError.message;
                }
            }

            if (fieldsAddedForTable > 0) {
                debugLog['ddl_alter_' + ddlItem.TableName] = '添加了' + fieldsAddedForTable + '个字段';
            }

        } catch (checkError) {
            debugLog['ddl_check_error_' + ddlItem.TableName] = checkError.message;
        }
    }

    stats.DDLExecuted = ddlExecuted;
    stats.DDLSkipped = ddlSkipped;
    stats.FieldsAdded = fieldsAdded;
    debugLog.step0Result = 'DDL执行完成：创建表' + ddlExecuted + '，跳过' + ddlSkipped + '，添加字段' + fieldsAdded;

    var earlyPhysicalSync = syncPhysicalColumnsFromPackage(null);
    stats.PhysicalFieldsAdded = (stats.PhysicalFieldsAdded || 0) + earlyPhysicalSync.Added;
    stats.PhysicalFieldsModified = (stats.PhysicalFieldsModified || 0) + earlyPhysicalSync.Modified;
    stats.PhysicalFieldsSkipped = (stats.PhysicalFieldsSkipped || 0) + earlyPhysicalSync.Skipped;
    stats.PhysicalFieldsErrors = (stats.PhysicalFieldsErrors || 0) + earlyPhysicalSync.Errors;
    debugLog.step0_5Result = '真实物理字段预同步完成：修改' + earlyPhysicalSync.Modified + '，新增' + earlyPhysicalSync.Added + '，跳过' + earlyPhysicalSync.Skipped + '，异常' + earlyPhysicalSync.Errors;

    // ==================== 步骤1：处理diy_table数据 ====================

    reportProgress(25, '正在导入表单引擎表定义');
    debugLog.step1 = '开始处理diy_table数据';

    var diyTables = Package.DiyTables || [];

    for (var i = 0; i < diyTables.length; i++) {
        var table = diyTables[i];

        if (!table.Id) {
            debugLog['table_no_id_' + i] = '跳过无Id的表数据';
            continue;
        }

        // 根据Id和Name判断是否存在
        var existsById = checkExists('diy_table', table.Id);
        var existsByName = false;

        if (table.Name) {
            var checkByNameResult = V8.FormEngine.GetFormData('diy_table', {
                OsClient: V8.OsClient,
                _Where: [['Name', '=', table.Name]],
                _PageSize: 1
            });
            existsByName = checkByNameResult.Code == 1 && checkByNameResult.Data;
            //如果存在此tableName，但又不存在taleId，将此tableName的Id修改为应用商城的diy_table的Id
            if (existsByName && !existsById) {
                remapTableIdInDatabase(checkByNameResult.Data.Id, table.Id, table.Name);

                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${checkByNameResult.Data.Id.toLowerCase()}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${checkByNameResult.Data.Name.toLowerCase()}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${checkByNameResult.Data.Id}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${checkByNameResult.Data.Name.toLowerCase()}`);
            }
        }

        var exists = existsById || existsByName;
        var modelCopy = {};
        for (var key in table) {
            modelCopy[key] = table[key];
        }
        modelCopy.OsClient = V8.OsClient;
        modelCopy.Id = table.Id;
        if (exists) {
            var uptResult = V8.FormEngine.UptFormData('diy_table', modelCopy);
            if (uptResult.Code == 1) {
                stats.TableUpdated++;
            } else {
                debugLog['table_upt_error_' + table.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_table', modelCopy);
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

    debugLog.step1Result = '表数据处理完成：新增' + stats.TableInserted + '，修改' + stats.TableUpdated;

    // ==================== 步骤2：处理diy_field数据 ====================

    reportProgress(40, '正在导入字段定义');
    debugLog.step2 = '开始处理diy_field数据';

    var diyFields = Package.DiyFields || [];
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

        var exists = checkExists('diy_field', field.Id);
        if (isSelectApi) {
            debugLog['★SelectApi_existsById'] = exists;
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
                    remapFieldIdInDatabase(oldFieldId, field.Id, field.Name);
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

            if (isZombieRecord) {
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
                        var addFallback2 = V8.FormEngine.AddFormData('diy_field', fieldCopy);
                        if (addFallback2.Code == 1) {
                            stats.FieldInserted++;
                        } else {
                            debugLog['field_zombie_add_error_' + field.Id] = addFallback2.Msg;
                        }
                    }
                } catch(zombieRawErr) {
                    debugLog['field_zombie_raw_error_' + field.Id] = zombieRawErr.message;
                }
            } else {
                // 正常记录：使用 FormEngine 更新（默认不触发V8事件）
                var uptResult = V8.FormEngine.UptFormData('diy_field', fieldCopy);
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
                    var uptRetryResult = V8.FormEngine.UptFormData('diy_field', fieldCopy);
                    if (uptRetryResult.Code == 1) {
                        stats.FieldUpdated++;
                    } else {
                        var addFallback = V8.FormEngine.AddFormData('diy_field', fieldCopy);
                        if (addFallback.Code == 1) {
                            stats.FieldInserted++;
                        } else {
                            debugLog['field_upt_error_' + field.Id] = uptRetryResult.Msg + ' | addFallback:' + addFallback.Msg;
                        }
                    }
                }
            }
        } else {
            var fieldCopy = {};
            for (var key in field) {
                fieldCopy[key] = field[key];
            }
            fieldCopy.OsClient = V8.OsClient;
            fieldCopy.Id = field.Id;
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_field', fieldCopy);
            if (isSelectApi) {
                debugLog['★SelectApi_action'] = 'AddFormData';
                debugLog['★SelectApi_addResult_Code'] = addResult.Code;
                debugLog['★SelectApi_addResult_Msg'] = addResult.Msg || '';
                debugLog['★SelectApi_fieldCopy_keys'] = Object.keys(fieldCopy).join(',');
                debugLog['★SelectApi_fieldCopy_Name'] = fieldCopy.Name;
            }
            if (addResult.Code == 1) {
                stats.FieldInserted++;
            } else {
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
    var diyTables = Package.DiyTables || [];
    var diyFields = Package.DiyFields || [];

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
    for (var ps = 0; ps < diyTables.length; ps++) {
        if (diyTables[ps] && diyTables[ps].Name) physicalSyncTableNames.push(diyTables[ps].Name);
    }
    var packagePhysicalSync = syncPhysicalColumnsFromPackage(buildPhysicalTableFilter(physicalSyncTableNames));
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

    // ==================== 步骤3：处理sys_menu数据 ====================

    reportProgress(70, '正在导入菜单和按钮配置');
    debugLog.step3 = '开始处理sys_menu数据';

    var sysMenus = Package.SysMenus || [];

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

        if (!menu.Id) {
            debugLog['menu_no_id_' + i] = '跳过无Id的菜单数据';
            continue;
        }

        var exists = checkExists('sys_menu', menu.Id);
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
            if (matchedMenu && matchedMenu.Id && matchedMenu.Id != menu.Id) {
                remapMenuIdInDatabase(matchedMenu.Id, menu.Id, menu.Name || menu.ModuleEngineKey || menu.Url);
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
        if (exists) {
            // 存在则修改
            var uptResult = V8.FormEngine.UptFormData('sys_menu', modelCopy);
            if (uptResult.Code == 1) {
                stats.MenuUpdated++;
            } else {
                debugLog['menu_upt_error_' + menu.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('sys_menu', modelCopy);
            if (addResult.Code == 1) {
                stats.MenuInserted++;
            } else if (addResult.Msg && addResult.Msg.indexOf('[Url]已存在唯一值') > -1 && modelCopy.Url) {
                // Url重复，自动追加后缀重试
                var originalUrl = modelCopy.Url;
                var urlCount = V8.Db.FromSql("SELECT COUNT(Id) FROM sys_menu WHERE Url='" + originalUrl.replace(/'/g, "''") + "'").ToScalar();
                var newUrl = originalUrl + '-' + (Number(urlCount) + 1);
                modelCopy.Url = newUrl;
                debugLog['menu_url_retry_' + menu.Id] = originalUrl + ' → ' + newUrl;
                var retryResult = V8.FormEngine.AddFormData('sys_menu', modelCopy);
                if (retryResult.Code == 1) {
                    stats.MenuInserted++;
                } else {
                    debugLog['menu_add_error_' + menu.Id] = retryResult.Msg;
                }
            } else {
                debugLog['menu_add_error_' + menu.Id] = addResult.Msg;
            }
        }

        //清除缓存
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.Id.toLowerCase()}`);
        if (menu.ModuleEngineKey) {
            V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.ModuleEngineKey.toLowerCase()}`);
        }
    }

    var step3ReferenceRowsUpdated = syncMappedReferences();
    if (step3ReferenceRowsUpdated > 0) {
        debugLog.step3ReferenceRowsUpdated = step3ReferenceRowsUpdated;
    }

    debugLog.step3Result = '菜单数据处理完成：新增' + stats.MenuInserted + '，修改' + stats.MenuUpdated;

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

        if (!latest) return;
        normalizeApiEngineModel(latest);
        if (!isMissingValue(latest.ApiEngineKey)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.ApiEngineKey).toLowerCase()}`, latest);
        }
        if (!isMissingValue(latest.Id)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.Id).toLowerCase()}`, latest);
        }
        if (!isMissingValue(latest.ApiAddress)) {
            V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${String(latest.ApiAddress).toLowerCase()}`, latest);
        }
    }

    // ==================== 步骤7：处理sys_apiengine数据（可选） ====================

    if (Package.SysApiEngines && Package.SysApiEngines.length > 0) {
        reportProgress(95, '正在导入接口引擎');
        debugLog.step7 = '开始处理sys_apiengine数据';

        var sysApiEngines = Package.SysApiEngines;

        for (var i = 0; i < sysApiEngines.length; i++) {
            var apiEngine = sysApiEngines[i];

            if (!apiEngine.Id && !apiEngine.ApiEngineKey) {
                debugLog['apiengine_no_id_key_' + i] = '跳过无Id和ApiEngineKey的接口引擎数据';
                continue;
            }

            // 根据Id或ApiEngineKey判断是否存在
            var existsById = false;
            var existsByKey = false;
            var existingId = null;

            if (apiEngine.Id) {
                existsById = checkExists('sys_apiengine', apiEngine.Id);
                if (existsById) {
                    existingId = apiEngine.Id;
                }
            }

            if (!existsById && apiEngine.ApiEngineKey) {
                var checkByKeyResult = V8.FormEngine.GetFormData('sys_apiengine', {
                    OsClient: V8.OsClient,
                    _Where: [['ApiEngineKey', '=', apiEngine.ApiEngineKey]],
                    _PageSize: 1
                });
                existsByKey = checkByKeyResult.Code == 1 && checkByKeyResult.Data;
                //如果存在ApiEngineKey，但不存在Id，将此ApiEngineKey的Id修改为应用商城的sys_apiengine的Id
                if (existsByKey) {
                    try {
                        V8.Db.FromSql("UPDATE sys_apiengine SET Id = '" + apiEngine.Id + "' WHERE ApiEngineKey = '" + apiEngine.ApiEngineKey + "' and IsDeleted<>1")
                            .ExecuteNonQuery();
                    } catch (error) {

                    }

                    //清除旧Id、旧Key的缓存（Id已被替换，旧缓存失效）
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${checkByKeyResult.Data.Id.toLowerCase()}`);
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${checkByKeyResult.Data.ApiEngineKey.toLowerCase()}`);
                    if (checkByKeyResult.Data.ApiAddress) {
                        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${checkByKeyResult.Data.ApiAddress.toLowerCase()}`);
                    }
                    existingId = apiEngine.Id;
                }
            }

            var exists = existsById || existsByKey;
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
                    refreshApiEngineCache(apiEngine.ApiEngineKey, apiEngine.Id, apiEngine.ApiAddress);
                } else {
                    debugLog['apiengine_upt_error_' + existingId] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('sys_apiengine', modelCopy);
                if (addResult.Code == 1) {
                    stats.ApiEngineInserted++;
                    refreshApiEngineCache(apiEngine.ApiEngineKey, apiEngine.Id, apiEngine.ApiAddress);
                } else {
                    debugLog['apiengine_add_error_' + (apiEngine.Id || apiEngine.ApiEngineKey)] = addResult.Msg;
                }
            }
        }

        debugLog.step7Result = '接口引擎数据处理完成：新增' + stats.ApiEngineInserted + '，修改' + stats.ApiEngineUpdated;
    }

    reportProgress(97, '正在写入应用安装版本记录');
    upsertMicroiStoreVersionRecord();

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
            字段定义: '新增' + stats.FieldInserted + '条，修改' + stats.FieldUpdated + '条，Id对齐' + stats.FieldIdRemapped + '条',
            物理字段同步: '重命名' + (stats.PhysicalFieldsRenamed || 0) + '个，修改' + (stats.PhysicalFieldsModified || 0) + '个，新增' + (stats.PhysicalFieldsAdded || 0) + '个',
            菜单: '新增' + stats.MenuInserted + '条，修改' + stats.MenuUpdated + '条，Id对齐' + stats.MenuIdRemapped + '条',
            引用修复: '更新' + stats.ReferenceRowsUpdated + '行',
            工作流: '新增' + stats.FlowInserted + '条，修改' + stats.FlowUpdated + '条',
            工作流节点: '新增' + stats.NodeInserted + '条，修改' + stats.NodeUpdated + '条',
            工作流连线: '新增' + stats.LineInserted + '条，修改' + stats.LineUpdated + '条',
            接口引擎: '新增' + stats.ApiEngineInserted + '条，修改' + stats.ApiEngineUpdated + '条',
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
        Code: 1,
        Data: resultData,
        Msg: hasErrors ? '导入完成，但有' + errors.length + '条异常，请查看失败详情' : '导入成功'
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
