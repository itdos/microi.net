/**
 * 导入应用数据包接口引擎（B系统）
 * 
 * 功能：导入应用数据包，根据Id判断新增或修改
 * 
 * 业务逻辑：
 * 1. 接收应用数据包
 * 2. 解析数据包中的各类数据
 * 3. 依次处理：diy_table -> diy_field -> sys_menu -> wf_flowdesign -> wf_node -> sys_apiengine
 * 4. 每条数据根据判断规则决定新增或修改：
 *    - diy_table: 根据 Id 和 Name 判断（不修改 Id 和 Name）
 *    - sys_apiengine: 根据 Id 或 ApiEngineKey 判断（不修改 Id 和 ApiEngineKey）
 *    - 其他表: 根据 Id 判断
 * 5. 使用事务保证数据一致性
 * 
 * 接口配置：
 * - ApiEngineKey: import-microi-store-package
 * - ApiAddress: /apiengine/import-microi-store-package
 * - 允许匿名调用: 否
 * - 分布式锁: 是（防止并发导入）
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('import-microi-store-package', {
 *   Package: packageData  // 从export-microi-store-package接口导出的数据包
 * })
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     MenuInserted: 5,
 *     MenuUpdated: 3,
 *     TableInserted: 2,
 *     TableUpdated: 1,
 *     FieldInserted: 50,
 *     FieldUpdated: 20,
 *     FlowInserted: 1,
 *     FlowUpdated: 0,
 *     NodeInserted: 10,
 *     NodeUpdated: 5,
 *     LineInserted: 8,
 *     LineUpdated: 3,
 *     ApiEngineInserted: 3,
 *     ApiEngineUpdated: 2
 *   },
 *   Msg: '导入成功'
 * }
 */

// ==================== 参数接收与校验 ====================

var Package = V8.Param.Package;  // 应用数据包
var InstallParentSysMenuId = V8.Param.InstallParentSysMenuId;  // 安装在哪个父级系统菜单Id下

// 定义调试模式
var isDebug = true;
var debugLog = {};

// 参数校验
if (!Package) {
    return {
        Code: 0,
        Msg: '参数错误：Package不能为空'
    };
}
if(typeof(Package) == 'string'){
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

    // ==================== 辅助函数：判断数据是否存在 ====================
    
    var checkExists = function(tableName, id) {
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
        FieldInserted: 0,
        FieldUpdated: 0,
        MenuInserted: 0,
        MenuUpdated: 0,
        FlowInserted: 0,
        FlowUpdated: 0,
        NodeInserted: 0,
        NodeUpdated: 0,
        LineInserted: 0,
        LineUpdated: 0,
        ApiEngineInserted: 0,
        ApiEngineUpdated: 0
    };

    // ==================== 步骤0：执行DDL创建表和字段 ====================
    
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
    var mapToMySQLType = function(diyType) {
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
        if (typeStr == 'int' || typeStr == 'bigint' || typeStr == 'text' || typeStr == 'longtext' || 
            typeStr == 'datetime' || typeStr == 'date' || typeStr == 'time' || typeStr == 'timestamp' || 
            typeStr == 'json' || typeStr == 'tinyint' || typeStr == 'double' || typeStr == 'float') {
            return String(diyType);
        }
        
        if (typeStr.indexOf('varchar') == 0) return String(diyType);
        if (typeStr.indexOf('decimal') == 0) return String(diyType);
        
        return 'varchar(255)';
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

    // ==================== 步骤1：处理diy_table数据 ====================
    
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
                try {
                    V8.Db.FromSql("UPDATE diy_table SET Id = '" + table.Id + "' WHERE Name = '" + table.Name + "' and IsDeleted<>1")
                    .ExecuteNonQuery();
                } catch (error) {
                    
                }
                try {
                    V8.Db.FromSql("UPDATE diy_field SET TableId = '" + table.Id + "' WHERE TableId = '" + checkByNameResult.Data.Id + "' and IsDeleted<>1")
                    .ExecuteNonQuery();
                } catch (error) {
                    
                }
                try {
                    V8.Db.FromSql("UPDATE sys_menu SET DiyTableId = '" + table.Id + "' WHERE DiyTableId = '" + checkByNameResult.Data.Id + "' and IsDeleted<>1")
                    .ExecuteNonQuery();
                } catch (error) {
                    
                }
                
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${checkByNameResult.Data.Id.toLowerCase()}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${checkByNameResult.Data.Name.toLowerCase()}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${checkByNameResult.Data.Id}`);
                V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table_field_list:${checkByNameResult.Data.Name.toLowerCase()}`);
            }
        }
        
        var exists = existsById || existsByName;
        table.OsClient = V8.OsClient;
        if (exists) {
            var uptResult = V8.FormEngine.UptFormData('diy_table', table);
            if (uptResult.Code == 1) {
                stats.TableUpdated++;
            } else {
                debugLog['table_upt_error_' + table.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_table', table);
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
    
    debugLog.step2 = '开始处理diy_field数据';
    
    var diyFields = Package.DiyFields || [];
    var fieldChanges = []; // 记录字段的变化（Name、Type、Label）
    
    for (var i = 0; i < diyFields.length; i++) {
        var field = diyFields[i];
        
        if (!field.Id) {
            debugLog['field_no_id_' + i] = '跳过无Id的字段数据';
            continue;
        }

        var exists = checkExists('diy_field', field.Id);

        if(!exists){
            //判断根据Name和TableId是否存在，如果存在，则需要将Id改到以应用商城的为准
            var checkByNameResult = V8.FormEngine.GetFormData('diy_field', {
                OsClient: V8.OsClient,
                _Where: [
                    ['TableId', '=', field.TableId], 
                    ['Name', '=', field.Name]
                ]
            });
            if(checkByNameResult.Code == 1){
                try {
                    V8.Db.FromSql("UPDATE diy_field SET Id = '" + field.Id + "' WHERE TableId = '" + field.TableId + "' AND Name = '" + field.Name + "' and IsDeleted<>1").ExecuteNonQuery();
                } catch (error) {
                    
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
            fieldCopy._Where = [
                ['TableId', '=', field.TableId],
                ['Name', '=', field.Name],
            ];
            fieldCopy.OsClient = V8.OsClient;
            
            var uptResult = V8.FormEngine.UptFormDataByWhere('diy_field', fieldCopy);
            if (uptResult.Code == 1) {
                stats.FieldUpdated++;
            } else {
                debugLog['field_upt_error_' + field.Id] = uptResult.Msg;
            }
        } else {
            field.OsClient = V8.OsClient;
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_field', field);
            if (addResult.Code == 1) {
                stats.FieldInserted++;
            } else {
                debugLog['field_add_error_' + field.Id] = addResult.Msg;
            }
            
        }
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

    // ==================== 步骤2.5：同步物理表字段（补充所有表的缺失字段） ====================
    
    debugLog.step2_5 = '开始同步物理表字段';
    
    var physicalFieldsAdded = 0;
    var physicalFieldsRenamed = 0;
    var physicalFieldsModified = 0;
    var diyTables = Package.DiyTables || [];
    var diyFields = Package.DiyFields || [];
    
    // 阶段0：执行字段变更（重命名、修改类型/注释）
    debugLog.step2_5_phase0 = '开始处理字段变更';
    for (var i = 0; i < fieldChanges.length; i++) {
        var change = fieldChanges[i];
        if (!change.TableName || !change.OldName || !change.NewName) continue;
        
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
    
    stats.PhysicalFieldsAdded = physicalFieldsAdded;
    stats.PhysicalFieldsRenamed = physicalFieldsRenamed;
    stats.PhysicalFieldsModified = physicalFieldsModified;
    debugLog.step2_5Result = '物理表字段同步完成：重命名' + physicalFieldsRenamed + '，修改' + physicalFieldsModified + '，新增' + physicalFieldsAdded;

    // ==================== 步骤3：处理sys_menu数据 ====================
    
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

        //如果传入了 InstallParentSysMenuId，并且当前菜单的ParentId并不存在于待导入的菜单中
        if(InstallParentSysMenuId && sysMenus.findIndex(m => m.Id === menu.ParentId) === -1){
            //并且当前菜单的ParentId等于InstallParentSysMenuId，则将ParentId修改为新导入应用的根菜单Id
            menu.ParentId = InstallParentSysMenuId;
        }
        //如果当前菜单的ParentId并不存在于待导入的菜单中，并且当前菜单的Id不存在于sys_menu表中，则置为顶级
        else if(menu.ParentId 
                && menu.ParentId != '00000000000000000000000000'
                && menu.ParentId != '00000000-0000-0000-0000-000000000000' 
                && sysMenus.findIndex(m => m.Id === menu.ParentId) === -1){
            var existsParent = checkExists('sys_menu', menu.ParentId);
            if(!existsParent){
                menu.ParentId = '00000000000000000000000000';
            }
        }
        menu.OsClient = V8.OsClient;
        if (exists) {
            // 存在则修改
            var uptResult = V8.FormEngine.UptFormData('sys_menu', menu);
            if (uptResult.Code == 1) {
                stats.MenuUpdated++;
            } else {
                debugLog['menu_upt_error_' + menu.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('sys_menu', menu);
            if (addResult.Code == 1) {
                stats.MenuInserted++;
            } else {
                //新增的时候可能会报错【[Url]已存在唯一值：】【[ModuleEngineKey]已存在唯一值：】,暂时不处理，发布包的时候尽量避免重复
                debugLog['menu_add_error_' + menu.Id] = addResult.Msg;
            }
        }

        //清除缓存
        V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.Id.toLowerCase()}`);
        if(menu.ModuleEngineKey){
            V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${menu.ModuleEngineKey.toLowerCase()}`);
        }
    }

    debugLog.step3Result = '菜单数据处理完成：新增' + stats.MenuInserted + '，修改' + stats.MenuUpdated;

    // ==================== 步骤4：处理wf_flowdesign数据（可选） ====================
    
    if (Package.WfFlowDesigns && Package.WfFlowDesigns.length > 0) {
        debugLog.step4 = '开始处理wf_flowdesign数据';
        
        var wfFlows = Package.WfFlowDesigns;
        
        for (var i = 0; i < wfFlows.length; i++) {
            var flow = wfFlows[i];
            
            if (!flow.Id) {
                debugLog['flow_no_id_' + i] = '跳过无Id的工作流数据';
                continue;
            }

            var exists = checkExists('wf_flowdesign', flow.Id);
            flow.OsClient = V8.OsClient;
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('wf_flowdesign', flow);
                if (uptResult.Code == 1) {
                    stats.FlowUpdated++;
                } else {
                    debugLog['flow_upt_error_' + flow.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_flowdesign', flow);
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
        debugLog.step5 = '开始处理wf_node数据';
        
        var wfNodes = Package.WfNodes;
        
        for (var i = 0; i < wfNodes.length; i++) {
            var node = wfNodes[i];
            
            if (!node.Id) {
                debugLog['node_no_id_' + i] = '跳过无Id的节点数据';
                continue;
            }

            var exists = checkExists('wf_node', node.Id);
            node.OsClient = V8.OsClient;
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('wf_node', node);
                if (uptResult.Code == 1) {
                    stats.NodeUpdated++;
                } else {
                    debugLog['node_upt_error_' + node.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_node', node);
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
        debugLog.step6 = '开始处理wf_line数据';
        
        var wfLines = Package.WfLines;
        
        for (var i = 0; i < wfLines.length; i++) {
            var line = wfLines[i];
            
            if (!line.Id) {
                debugLog['line_no_id_' + i] = '跳过无Id的连线数据';
                continue;
            }

            var exists = checkExists('wf_line', line.Id);
            line.OsClient = V8.OsClient;
            if (exists) {
                // 存在则修改
                var uptResult = V8.FormEngine.UptFormData('wf_line', line);
                if (uptResult.Code == 1) {
                    stats.LineUpdated++;
                } else {
                    debugLog['line_upt_error_' + line.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_line', line);
                if (addResult.Code == 1) {
                    stats.LineInserted++;
                } else {
                    debugLog['line_add_error_' + line.Id] = addResult.Msg;
                }
            }
        }

        debugLog.step6Result = '连线数据处理完成：新增' + stats.LineInserted + '，修改' + stats.LineUpdated;
    }

    // ==================== 步骤7：处理sys_apiengine数据（可选） ====================
    
    if (Package.SysApiEngines && Package.SysApiEngines.length > 0) {
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
                    
                    //清除缓存
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${checkByKeyResult.Data.Id.toLowerCase()}`);
                    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${checkByKeyResult.Data.ApiEngineKey.toLowerCase()}`);
                    existingId = apiEngine.Id;
                }
            }
            
            var exists = existsById || existsByKey;
            apiEngine.OsClient = V8.OsClient;
            if (exists) {
                var uptResult = V8.FormEngine.UptFormData('sys_apiengine', apiEngine);
                if (uptResult.Code == 1) {
                    stats.ApiEngineUpdated++;
                } else {
                    debugLog['apiengine_upt_error_' + existingId] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('sys_apiengine', apiEngine);
                if (addResult.Code == 1) {
                    stats.ApiEngineInserted++;
                } else {
                    debugLog['apiengine_add_error_' + (apiEngine.Id || apiEngine.ApiEngineKey)] = addResult.Msg;
                }
            }
        }

        debugLog.step7Result = '接口引擎数据处理完成：新增' + stats.ApiEngineInserted + '，修改' + stats.ApiEngineUpdated;
    }

    debugLog.endTime = new Date().toISOString();

    // ==================== 返回结果 ====================
    // 注意：平台会根据返回Code自动管理事务
    // Code=1 时自动提交事务，Code=0 时自动回滚事务
    
    return {
        Code: 1,
        Data: stats,
        Msg: '导入成功',
        Debug: isDebug ? debugLog : undefined
    };

} catch (error) {
    // ==================== 异常处理 ====================
    // 注意：返回Code=0时，平台会自动回滚事务
    
    debugLog.error = {
        message: error.message,
        stack: error.stack,
        endTime: new Date().toISOString()
    };

    return {
        Code: 0,
        Msg: '导入失败：' + error.message,
        Debug: isDebug ? debugLog : undefined
    };
}
