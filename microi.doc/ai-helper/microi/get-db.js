/**
 * 获取数据库结构接口引擎
 * 
 * 功能：获取【吾码】数据库的表结构、字段信息、菜单结构数据
 * 
 * 业务逻辑：
 * 1. 查询diy_table表获取所有表及说明（Id、Name、Description）
 * 2. 查询diy_field表获取所有字段及说明
 *    - 基础字段：Id、Name、Label、Description、Type、Component、TableId
 *    - 解析Config字段，提取TableChildTableId、TableChildSysMenuId
 * 3. 查询sys_menu表获取系统菜单树形结构
 *    - 基础字段：Id、Name、ParentId、DiyTableId
 * 4. 组装数据：
 *    - Tables: 将字段信息嵌套到对应的表中（_Fields属性）
 *    - Menus: 将子菜单嵌套到父菜单中（_Child属性）
 * 
 * 接口配置：
 * - ApiEngineKey: get_db
 * - ApiAddress: /apiengine/get-db
 * - 允许匿名调用: 否
 * - 分布式锁: 否
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('get_db', {})
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     Tables: [{
 *       Id: "01KEMDAT9ARD75943VSCB7B4J6",
 *       Name: "table1",
 *       Description: "表1",
 *       _Fields: [{
 *         Id: "01KEMDAVG6H7HSN6WWVRYK2NPR",
 *         Name: "CreateTime",
 *         Label: "创建时间",
 *         Description: null,
 *         Type: "datetime",
 *         Component: "DateTime",
 *         TableChildTableId: null,
 *         TableChildSysMenuId: null
 *       }]
 *     }],
 *     Menus: [{
 *       Id: "01KEMDAT9ARD75943VSCB7B4J6",
 *       Name: "菜单名称",
 *       ParentId: "ParentId",
 *       DiyTableId: "DiyTableId",
 *       _Child: [{
 *         Id: "01KEMDAT9ARD75943VSCB7B4J6",
 *         Name: "子菜单名称",
 *         ParentId: "上级菜单Id",
 *         DiyTableId: "DiyTableId"
 *       }]
 *     }]
 *   },
 *   Msg: '获取成功'
 * }
 */

// ==================== 参数接收与校验 ====================

// 定义调试模式
var isDebug = true;
var debugLog = {};

try {
    debugLog.startTime = new Date().toISOString();

    // ==================== 步骤1：查询diy_table表数据 ====================
    
    var tableResult = V8.FormEngine.GetTableData('diy_table', {
        _SelectFields: ['Id', 'Name', 'Description'],
        _PageSize: 10000, // 获取所有数据
        _OrderBy: 'Name',
        _OrderByType: 'ASC'
    });

    if (tableResult.Code !== 1) {
        return {
            Code: 0,
            Msg: '查询diy_table表失败：' + tableResult.Msg
        };
    }

    var tables = tableResult.Data || [];
    debugLog.tableCount = tables.length;

    // ==================== 步骤2：查询diy_field表数据 ====================
    
    var fieldResult = V8.FormEngine.GetTableData('diy_field', {
        _SelectFields: ['Id', 'Name', 'Label', 'Description', 'Type', 'Component', 'TableId', 'Config'],
        _PageSize: 50000, // 获取所有数据
        _OrderBy: 'TableId',
        _OrderByType: 'ASC'
    });

    if (fieldResult.Code !== 1) {
        return {
            Code: 0,
            Msg: '查询diy_field表失败：' + fieldResult.Msg
        };
    }

    var fields = fieldResult.Data || [];
    debugLog.fieldCount = fields.length;

    // ==================== 步骤3：处理字段数据，解析Config字段 ====================
    
    var processedFields = [];
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var processedField = {
            Id: field.Id,
            Name: field.Name,
            Label: field.Label,
            Description: field.Description,
            Type: field.Type,
            Component: field.Component,
            TableId: field.TableId,
            TableChildTableId: null,
            TableChildSysMenuId: null
        };

        // 解析Config字段，提取TableChildTableId和TableChildSysMenuId
        if (field.Config) {
            try {
                var configObj = typeof field.Config === 'string' ? JSON.parse(field.Config) : field.Config;
                if (configObj) {
                    processedField.TableChildTableId = configObj.TableChildTableId || null;
                    processedField.TableChildSysMenuId = configObj.TableChildSysMenuId || null;
                }
            } catch (e) {
                // 解析失败时，保持为null
                if (isDebug) {
                    debugLog['configParseError_' + field.Id] = e.message;
                }
            }
        }

        processedFields.push(processedField);
    }

    // ==================== 步骤4：将字段信息嵌套到对应的表中 ====================
    
    // 创建TableId到字段列表的映射
    var tableFieldsMap = {};
    for (var i = 0; i < processedFields.length; i++) {
        var field = processedFields[i];
        var tableId = field.TableId;
        
        if (!tableFieldsMap[tableId]) {
            tableFieldsMap[tableId] = [];
        }
        
        // 创建字段对象（不包含TableId，因为已经在表层级了）
        var fieldObj = {
            Id: field.Id,
            Name: field.Name,
            Label: field.Label,
            Description: field.Description,
            Type: field.Type,
            Component: field.Component,
            TableChildTableId: field.TableChildTableId,
            TableChildSysMenuId: field.TableChildSysMenuId
        };
        
        tableFieldsMap[tableId].push(fieldObj);
    }

    // 为每个表添加_Fields属性
    var processedTables = [];
    for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        processedTables.push({
            Id: table.Id,
            Name: table.Name,
            Description: table.Description,
            _Fields: tableFieldsMap[table.Id] || []
        });
    }

    // ==================== 步骤5：查询sys_menu表数据 ====================
    
    var menuResult = V8.FormEngine.GetTableData('sys_menu', {
        _SelectFields: ['Id', 'Name', 'ParentId', 'DiyTableId'],
        _PageSize: 10000, // 获取所有数据
        _OrderBy: 'Id',
        _OrderByType: 'ASC'
    });

    if (menuResult.Code !== 1) {
        return {
            Code: 0,
            Msg: '查询sys_menu表失败：' + menuResult.Msg
        };
    }

    var menus = menuResult.Data || [];
    debugLog.menuCount = menus.length;

    // ==================== 步骤6：构建菜单树形结构 ====================
    
    // 创建菜单ID到菜单对象的映射
    var menuMap = {};
    for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];
        menuMap[menu.Id] = {
            Id: menu.Id,
            Name: menu.Name,
            ParentId: menu.ParentId,
            DiyTableId: menu.DiyTableId,
            _Child: []
        };
    }

    // 构建树形结构
    var rootMenus = [];
    for (var menuId in menuMap) {
        var menu = menuMap[menuId];
        if (menu.ParentId && menuMap[menu.ParentId]) {
            // 有父级菜单，添加到父级的_Child数组中
            menuMap[menu.ParentId]._Child.push(menu);
        } else {
            // 没有父级菜单或父级不存在，作为根菜单
            rootMenus.push(menu);
        }
    }

    // ==================== 步骤7：组装返回数据 ====================
    
    var result = {
        Tables: processedTables,
        Menus: rootMenus
    };

    debugLog.endTime = new Date().toISOString();
    debugLog.resultSummary = {
        tableCount: processedTables.length,
        totalFieldCount: processedFields.length,
        menuCount: rootMenus.length
    };

    // ==================== 返回结果 ====================
    
    return {
        Code: 1,
        Data: result,
        Msg: '获取数据库结构成功',
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
        Msg: '获取数据库结构失败：' + error.message,
        Debug: isDebug ? debugLog : undefined
    };
}
