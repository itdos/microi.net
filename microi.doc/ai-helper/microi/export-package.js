/**
 * 导出应用数据包接口引擎（A系统）
 * 
 * 功能：导出菜单、表定义、字段定义、工作流等元数据，形成应用数据包
 * 
 * 业务逻辑：
 * 1. 接收一个或多个sys_menu的Id，获取它们及所有子菜单数据
 * 2. 获取每个菜单对应的diy_table数据
 * 3. 获取每个diy_table对应的diy_field数据
 * 4. 可选：接收一个或多个wf_flowdesign的Id，获取它们及对应的wf_node数据
 * 5. 将所有数据打包成一个JSON数据包返回
 * 
 * 接口配置：
 * - ApiEngineKey: export_package
 * - ApiAddress: /apiengine/export-package
 * - 允许匿名调用: 否
 * - 分布式锁: 否
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('export_package', {
 *   MenuIds: ['menu-id-1', 'menu-id-2'],
 *   FlowIds: ['flow-id-1', 'flow-id-2']  // 可选
 * })
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     PackageInfo: { name: '', version: '', createTime: '' },
 *     SysMenus: [...],
 *     DiyTables: [...],
 *     DiyFields: [...],
 *     WfFlowDesigns: [...],  // 可选
 *     WfNodes: [...],  // 可选
 *     WfLines: [...]  // 可选
 *   },
 *   Msg: '导出成功'
 * }
 */

// ==================== 参数接收与校验 ====================

var MenuIds = V8.Param.MenuIds;  // 菜单Id数组
var FlowIds = V8.Param.FlowIds;  // 工作流Id数组（可选）
var PackageName = V8.Param.PackageName || '未命名应用包';  // 应用包名称
var PackageVersion = V8.Param.PackageVersion || '1.0.0';  // 应用包版本

// 定义调试模式
var isDebug = true;
var debugLog = {};

// 参数校验
if (!MenuIds || MenuIds.length === 0) {
    return {
        Code: 0,
        Msg: '参数错误：MenuIds必须是非空数组'
    };
}

try {
    debugLog.startTime = new Date().toISOString();
    debugLog.inputMenuIds = MenuIds;
    debugLog.inputFlowIds = FlowIds;

    var fixedDiyField = [
        { Name: "Id" , Label: "Id", Type: "varchar(36)", Component: "Guid", Sort: 1, Visible: 0, TableWidth: 150 },
        { Name: "CreateTime" , Label: "创建时间", Type: "datetime", Component: "DateTime", Sort: 2, Visible: 1, TableWidth: 150 },
        { Name: "UpdateTime" , Label: "修改时间", Type: "datetime", Component: "DateTime", Sort: 3, Visible: 1, TableWidth: 150 },
        { Name: "UserId" , Label: "创建人Id", Type: "varchar(36)", Component: "Guid", Sort: 4, Visible: 0, TableWidth: 150 },
        { Name: "UserName" , Label: "创建人", Type: "varchar(255)", Component: "Text", Sort: 5, Visible: 1, TableWidth: 150 },
        { Name: "IsDeleted" , Label: "是否已删除", Type: "int", Component: "Switch", Sort: 6, Visible: 0, TableWidth: 50 }
    ];

    
    var someTableList = V8.FormEngine.GetTableData('diy_table', {
        _Where: [
            ['Name', 'In', ['sys_menu', 'diy_table', 'diy_field', 'wf_flowdesign', 'wf_node', 'wf_line']]
        ]
    });
    if(someTableList.Code !=1){
        return someTableList;
    }
    someTableList = someTableList.Data;
    var someTableIds = someTableList.map(item => item.Id);

    var someFieldList = V8.FormEngine.GetTableData('diy_field', {
        _Where: [
            ['TableId', 'In', someTableIds]
        ]
    });
    if(someFieldList.Code !=1){
        return someFieldList;
    }
    someFieldList = someFieldList.Data;

    // ==================== 步骤1：查询所有菜单数据 ====================
    
    // 获取菜单单所有字段 START
    var sysMenuTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'sys_menu');
    var sysMenuTableId = sysMenuTableModel.Id;
    var sysMenuFields = someFieldList.filter(item => item.TableId === sysMenuTableId);
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
    if(sysMenuFieldNames.indexOf('Id') <= -1){
        sysMenuFieldNames.push('Id');
    }
    if(sysMenuFieldNames.indexOf('ParentId') <= -1){
        sysMenuFieldNames.push('ParentId');
    }
    if(sysMenuFieldNames.indexOf('DiyTableId') <= -1){
        sysMenuFieldNames.push('DiyTableId');
    }
    if(sysMenuFieldNames.indexOf('CreateTime') <= -1){
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
    
    // 清理函数：移除对象中值为 null 或空字符串的属性，并移除跨租户字段
    var cleanObject = function(obj) {
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
            if (excludeFields[key]) {
                continue;
            }
            // 只保留有值的字段（排除 null、undefined、空字符串）
            if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = value;
            }
        }
        return cleaned;
    };
    
    // 检查传入的MenuId是否在查询结果中
    var targetMenu = allMenus.find(m => m.Id == MenuIds[0]);
    debugLog.targetMenuFound = !!targetMenu;
    debugLog.targetMenuData = targetMenu;

    // ==================== 步骤2：递归获取所有子菜单 ====================
    
    // 递归获取所有子菜单ID（带循环引用检测）
    var getAllChildMenuIds = function(parentId, allMenus, visited) {
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
        var childIds = getAllChildMenuIds(menuId, allMenus);
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
    debugLog.exportMenusSample = exportMenus.slice(0, 3);  // 返回前3条菜单数据样本

    // ==================== 步骤3：获取所有菜单关联的表ID ====================
    
    var tableIds = [];
    var tableIdMap = {};
    
    for (var i = 0; i < exportMenus.length; i++) {
        if (exportMenus[i].DiyTableId) {
            if (!tableIdMap[exportMenus[i].DiyTableId]) {
                tableIds.push(exportMenus[i].DiyTableId);
                tableIdMap[exportMenus[i].DiyTableId] = true;
            }
        }
    }

    debugLog.relatedTableIds = tableIds;

    // ==================== 步骤4：查询所有相关的diy_table数据 ====================
    // 获取 diy_table 所有字段 START
    var diyTableTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'diy_table');
    var diyTableTableId = diyTableTableModel.Id;
    var diyTableFields = someFieldList.filter(item => item.TableId === diyTableTableId);
    var diyTableFieldNames = diyTableFields.map(item => {
        return item.Name;
    });
    if(diyTableFieldNames.indexOf('Id') <= -1){
        diyTableFieldNames.push('Id');
    }
    if(diyTableFieldNames.indexOf('CreateTime') <= -1){
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
    var diyFieldTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'diy_field');
    var diyFieldTableId = diyFieldTableModel.Id;
    var diyFieldFields = someFieldList.filter(item => item.TableId === diyFieldTableId);
    var diyFieldFieldNames = diyFieldFields.map(item => {
        return item.Name;
    });
    if(diyFieldFieldNames.indexOf('Id') <= -1){
        diyFieldFieldNames.push('Id');
    }
    if(diyFieldFieldNames.indexOf('CreateTime') <= -1){
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
    var mapToMySQLType = function(diyType) {
        if (!diyType) return 'varchar(255)';
        
        var typeStr = diyType.toLowerCase();
        
        // 已经是标准MySQL类型，直接返回
        if (typeStr.match(/^(varchar|int|bigint|datetime|text|longtext|decimal|double|float|tinyint|date|time|timestamp|json)\(/)) {
            return diyType;
        }
        if (typeStr === 'int' || typeStr === 'bigint' || typeStr === 'text' || typeStr === 'longtext' || 
            typeStr === 'datetime' || typeStr === 'date' || typeStr === 'time' || typeStr === 'timestamp' || 
            typeStr === 'json' || typeStr === 'tinyint' || typeStr === 'double' || typeStr === 'float') {
            return diyType;
        }
        
        // 类型映射
        if (typeStr.indexOf('varchar') === 0) return diyType;
        if (typeStr.indexOf('decimal') === 0) return diyType;
        
        // 默认映射规则
        return 'varchar(255)';
    };
    
    // 为每个表生成DDL
    var ddlStatements = [];
    for (var i = 0; i < exportTables.length; i++) {
        var table = exportTables[i];
        var tableName = table.Name;
        var tableFields = exportFields.filter(f => f.TableId === table.Id);
        
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
        
        if (allFields.length === 0) continue;
        
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
            if (fieldName === 'Id') {
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
    var exportAllFlows = FlowIds && FlowIds.length === 1 && FlowIds[0] === '*';
    
    if (exportAllFlows || (FlowIds && FlowIds.length > 0)) {
        // 获取 wf_flowdesign 所有字段 START
        var wfFlowdesignTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'wf_flowdesign');
        var wfFlowdesignTableId = wfFlowdesignTableModel.Id;
        var wfFlowdesignFields = someFieldList.filter(item => item.TableId === wfFlowdesignTableId);
        var wfFlowdesignFieldNames = wfFlowdesignFields.map(item => {
            return item.Name;
        });
        if(wfFlowdesignFieldNames.indexOf('Id') <= -1){
            wfFlowdesignFieldNames.push('Id');
        }
        if(wfFlowdesignFieldNames.indexOf('CreateTime') <= -1){
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

        if (flowsResult.Code === 1) {
            exportFlows = flowsResult.Data || [];
            exportFlows = exportFlows.map(cleanObject);
            debugLog.exportFlowsCount = exportFlows.length;
            debugLog.exportAllFlows = exportAllFlows;

            // 查询工作流节点数据
            if (exportFlows.length > 0) {
                // 收集实际导出的工作流Id列表
                var actualFlowIds = exportFlows.map(function(flow) { return flow.Id; });
                debugLog.actualFlowIds = actualFlowIds;
                // 获取 wf_node 所有字段 START
                var wfNodeTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'wf_node');
                var wfNodeTableId = wfNodeTableModel.Id;
                var wfNodeFields = someFieldList.filter(item => item.TableId === wfNodeTableId);
                var wfNodeFieldNames = wfNodeFields.map(item => {
                    return item.Name;
                });
                if(wfNodeFieldNames.indexOf('Id') <= -1){
                    wfNodeFieldNames.push('Id');
                }
                if(wfNodeFieldNames.indexOf('CreateTime') <= -1){
                    wfNodeFieldNames.push('CreateTime');
                }
                // 获取 wf_node 所有字段 END
                
                var nodesResult = V8.FormEngine.GetTableData('wf_node', {
                    _SelectFields: wfNodeFieldNames,
                    _Where: [
                        ['FlowDesignId', 'In', JSON.stringify(actualFlowIds)]
                    ],
                });

                if (nodesResult.Code === 1) {
                    exportNodes = nodesResult.Data || [];
                    exportNodes = exportNodes.map(cleanObject);
                    debugLog.exportNodesCount = exportNodes.length;
                }
                
                // 获取 wf_line 所有字段 START
                var wfLineTableModel = someTableList.find(item => item.Name && item.Name.toLowerCase() === 'wf_line');
                var wfLineTableId = wfLineTableModel.Id;
                var wfLineFields = someFieldList.filter(item => item.TableId === wfLineTableId);
                var wfLineFieldNames = wfLineFields.map(item => {
                    return item.Name;
                });
                if(wfLineFieldNames.indexOf('Id') <= -1){
                    wfLineFieldNames.push('Id');
                }
                if(wfLineFieldNames.indexOf('CreateTime') <= -1){
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

                if (linesResult.Code === 1) {
                    exportLines = linesResult.Data || [];
                    exportLines = exportLines.map(cleanObject);
                    debugLog.exportLinesCount = exportLines.length;
                }
            }
        }
    }

    // ==================== 步骤7：组装数据包 ====================
    
    var packageData = {
        PackageInfo: {
            Name: PackageName,
            Version: PackageVersion,
            CreateTime: new Date().toISOString(),
            CreateUser: V8.CurrentUser.Name || '未知',
            OsClient: V8.OsClient,
            MenuCount: exportMenus.length,
            TableCount: exportTables.length,
            FieldCount: exportFields.length,
            FlowCount: exportFlows.length,
            NodeCount: exportNodes.length,
            LineCount: exportLines.length,
            DDLCount: ddlStatements.length
        },
        DDLStatements: ddlStatements,  // DDL语句数组
        SysMenus: exportMenus,
        DiyTables: exportTables,
        DiyFields: exportFields
    };

    // 只有在有工作流数据时才添加
    if (exportFlows.length > 0) {
        packageData.WfFlowDesigns = exportFlows;
        packageData.WfNodes = exportNodes;
        packageData.WfLines = exportLines;
    }

    debugLog.endTime = new Date().toISOString();
    debugLog.packageSize = JSON.stringify(packageData).length;

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
