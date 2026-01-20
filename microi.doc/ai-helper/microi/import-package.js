/**
 * 导入应用数据包接口引擎（B系统）
 * 
 * 功能：导入应用数据包，根据Id判断新增或修改
 * 
 * 业务逻辑：
 * 1. 接收应用数据包
 * 2. 解析数据包中的各类数据
 * 3. 依次处理：diy_table -> diy_field -> sys_menu -> wf_flowdesign -> wf_node
 * 4. 每条数据根据Id判断是否存在：
 *    - 不存在：新增
 *    - 存在：修改
 * 5. 使用事务保证数据一致性
 * 
 * 接口配置：
 * - ApiEngineKey: import_package
 * - ApiAddress: /apiengine/import-package
 * - 允许匿名调用: 否
 * - 分布式锁: 是（防止并发导入）
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('import_package', {
 *   Package: packageData  // 从export_package接口导出的数据包
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
 *     LineUpdated: 3
 *   },
 *   Msg: '导入成功'
 * }
 */

// ==================== 参数接收与校验 ====================

var Package = V8.Param.Package;  // 应用数据包

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
            Id: id
        }, V8.DbTrans);
        return result.Code === 1 && result.Data;
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
        LineUpdated: 0
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
        
        var typeStr = diyType.toLowerCase();
        
        if (typeStr.match(/^(varchar|int|bigint|datetime|text|longtext|decimal|double|float|tinyint|date|time|timestamp|json)\(/)) {
            return diyType;
        }
        if (typeStr === 'int' || typeStr === 'bigint' || typeStr === 'text' || typeStr === 'longtext' || 
            typeStr === 'datetime' || typeStr === 'date' || typeStr === 'time' || typeStr === 'timestamp' || 
            typeStr === 'json' || typeStr === 'tinyint' || typeStr === 'double' || typeStr === 'float') {
            return diyType;
        }
        
        if (typeStr.indexOf('varchar') === 0) return diyType;
        if (typeStr.indexOf('decimal') === 0) return diyType;
        
        return 'varchar(255)';
    };
    
    for (var i = 0; i < ddlStatements.length; i++) {
        var ddlItem = ddlStatements[i];
        if (!ddlItem.DDL || !ddlItem.TableName) continue;
        
        var tableCreated = false;
        
        try {
            // 先尝试创建表（CREATE TABLE IF NOT EXISTS）
            V8.DbTrans.FromSql(ddlItem.DDL).ExecuteNonQuery();
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
            var columnsData = V8.DbTrans.FromSql(checkColumnsSQL).ToArray();
            
            if (!columnsData || columnsData.length === 0) {
                debugLog['ddl_check_columns_' + ddlItem.TableName] = '表不存在或查询字段失败';
                continue;
            }
            
            var existingColumns = {};
            for (var c = 0; c < columnsData.length; c++) {
                var colName = columnsData[c].COLUMN_NAME;
                // 确保colName是字符串类型才调用toLowerCase
                if (colName) {
                    try {
                        var colNameStr = String(colName);
                        existingColumns[colNameStr.toLowerCase()] = true;
                    } catch (e) {
                        debugLog['field_parse_error_' + ddlItem.TableName + '_' + c] = 'Failed to parse column name: ' + e.message;
                    }
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
            // 排除已在fixedDiyField中的字段名
            var fixedFieldNames = {};
            for (var ff = 0; ff < fixedDiyField.length; ff++) {
                fixedFieldNames[fixedDiyField[ff].Name] = true;
            }
            
            for (var f = 0; f < diyFields.length; f++) {
                if (diyFields[f].TableId === ddlItem.TableId && !fixedFieldNames[diyFields[f].Name]) {
                    tableFields.push(diyFields[f]);
                }
            }
            
            // 检查缺失的字段并添加
            var fieldsAddedForTable = 0;
            for (var f = 0; f < tableFields.length; f++) {
                var field = tableFields[f];
                var fieldName = field.Name;
                
                if (!fieldName) continue;
                
                // 转换为字符串确保安全
                var fieldNameStr = String(fieldName);
                
                // MySQL字段名长度限制为64字符
                if (fieldNameStr.length > 64) {
                    debugLog['field_name_too_long_' + ddlItem.TableName + '_' + fieldNameStr.substring(0, 30)] = '字段名过长，已跳过：' + fieldNameStr.length + '字符';
                    continue;
                }
                
                // 字段已存在，跳过（忽略大小写）
                if (existingColumns[fieldNameStr.toLowerCase()]) {
                    continue;
                }
                
                var fieldType = mapToMySQLType(field.Type);
                var alterSQL = 'ALTER TABLE `' + ddlItem.TableName + '` ADD COLUMN `' + fieldName + '` ' + fieldType;
                
                // Id字段不允许NULL，其他字段允许NULL
                if (fieldName === 'Id') {
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
                    V8.DbTrans.FromSql(alterSQL).ExecuteNonQuery();
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

        var exists = checkExists('diy_table', table.Id);
        
        if (exists) {
            // 存在则修改
            var uptResult = V8.FormEngine.UptFormData('diy_table', table, V8.DbTrans);
            if (uptResult.Code === 1) {
                stats.TableUpdated++;
            } else {
                debugLog['table_upt_error_' + table.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_table', table, V8.DbTrans);
            if (addResult.Code === 1) {
                stats.TableInserted++;
            } else {
                debugLog['table_add_error_' + table.Id] = addResult.Msg;
            }
        }
    }

    debugLog.step1Result = '表数据处理完成：新增' + stats.TableInserted + '，修改' + stats.TableUpdated;

    // ==================== 步骤2：处理diy_field数据 ====================
    
    debugLog.step2 = '开始处理diy_field数据';
    
    var diyFields = Package.DiyFields || [];
    
    for (var i = 0; i < diyFields.length; i++) {
        var field = diyFields[i];
        
        if (!field.Id) {
            debugLog['field_no_id_' + i] = '跳过无Id的字段数据';
            continue;
        }

        var exists = checkExists('diy_field', field.Id);
        
        if (exists) {
            // 存在则修改
            var uptResult = V8.FormEngine.UptFormData('diy_field', field, V8.DbTrans);
            if (uptResult.Code === 1) {
                stats.FieldUpdated++;
            } else {
                debugLog['field_upt_error_' + field.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('diy_field', field, V8.DbTrans);
            if (addResult.Code === 1) {
                stats.FieldInserted++;
            } else {
                debugLog['field_add_error_' + field.Id] = addResult.Msg;
            }
        }
    }

    debugLog.step2Result = '字段数据处理完成：新增' + stats.FieldInserted + '，修改' + stats.FieldUpdated;

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
        if (!sysMenus[i].ParentId || sysMenus[i].ParentId === null) {
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
        
        if (exists) {
            // 存在则修改
            var uptResult = V8.FormEngine.UptFormData('sys_menu', menu, V8.DbTrans);
            if (uptResult.Code === 1) {
                stats.MenuUpdated++;
            } else {
                debugLog['menu_upt_error_' + menu.Id] = uptResult.Msg;
            }
        } else {
            // 不存在则新增
            var addResult = V8.FormEngine.AddFormData('sys_menu', menu, V8.DbTrans);
            if (addResult.Code === 1) {
                stats.MenuInserted++;
            } else {
                debugLog['menu_add_error_' + menu.Id] = addResult.Msg;
            }
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
            
            if (exists) {
                // 存在则修改
                var uptResult = V8.FormEngine.UptFormData('wf_flowdesign', flow, V8.DbTrans);
                if (uptResult.Code === 1) {
                    stats.FlowUpdated++;
                } else {
                    debugLog['flow_upt_error_' + flow.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_flowdesign', flow, V8.DbTrans);
                if (addResult.Code === 1) {
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
            
            if (exists) {
                // 存在则修改
                var uptResult = V8.FormEngine.UptFormData('wf_node', node, V8.DbTrans);
                if (uptResult.Code === 1) {
                    stats.NodeUpdated++;
                } else {
                    debugLog['node_upt_error_' + node.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_node', node, V8.DbTrans);
                if (addResult.Code === 1) {
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
            
            if (exists) {
                // 存在则修改
                var uptResult = V8.FormEngine.UptFormData('wf_line', line, V8.DbTrans);
                if (uptResult.Code === 1) {
                    stats.LineUpdated++;
                } else {
                    debugLog['line_upt_error_' + line.Id] = uptResult.Msg;
                }
            } else {
                // 不存在则新增
                var addResult = V8.FormEngine.AddFormData('wf_line', line, V8.DbTrans);
                if (addResult.Code === 1) {
                    stats.LineInserted++;
                } else {
                    debugLog['line_add_error_' + line.Id] = addResult.Msg;
                }
            }
        }

        debugLog.step6Result = '连线数据处理完成：新增' + stats.LineInserted + '，修改' + stats.LineUpdated;
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
