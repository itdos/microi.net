/**
 * Microi吾码数据库结构获取接口引擎
 * 
 * 功能：获取数据库的表结构和字段信息
 * 包括：
 * 1. diy_table - 数据库所有表及说明
 * 2. diy_field - 数据库所有字段及说明
 * 
 * 使用说明：
 * 1. 在Microi吾码平台的【接口引擎】中创建一个新接口
 * 2. 将此代码粘贴到接口引擎的V8代码编辑器中
 * 3. 配置接口引擎Key为：get_db_structure
 * 4. 配置自定义接口地址为：/apiengine/get-db-structure
 * 5. 根据需要配置是否允许匿名调用
 * 6. 运行后将返回的JSON数据保存到 db.json 文件
 * 
 * 调用方式：
 * GET/POST: {ApiBase}/apiengine/get-db-structure
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: [{
 *     Id: "01KEMDAT9ARD75943VSCB7B4J6",
 *     Name: "table1",
 *     Description: "表1",
 *     _Fields: [{
 *       Id: "01KEMDAVG6H7HSN6WWVRYK2NPR",
 *       Name: "CreateTime",
 *       Label: "创建时间",
 *       Description: null,
 *       Type: "datetime",
 *       Component: "DateTime"
 *     }]
 *   }],
 *   Msg: '获取成功'
 * }
 */

// 定义调试模式
var isDebug = true;
var debugLog = {};

try {
    // 1. 获取 diy_table 表数据（数据库所有表及说明）
    debugLog.step1 = '开始获取diy_table表数据';
    var diyTableResult = V8.FormEngine.GetTableData('diy_table', {
        _Where: [],  // 取所有数据，不添加任何条件
        _PageSize: 10000,  // 设置较大的分页大小，确保获取所有数据
        _OrderBy: 'Name',  // 按表名排序
        _OrderByType: 'ASC',
        _SelectFields: ['Id', 'Name', 'Description']  // 只获取关键字段
    });
    
    if (diyTableResult.Code != 1) {
        debugLog.diyTableError = diyTableResult.Msg;
        return {
            Code: 0,
            Msg: '获取diy_table表数据失败：' + diyTableResult.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }
    debugLog.diyTableCount = diyTableResult.Data.length;

    // 2. 获取 diy_field 表数据（数据库所有字段及说明）
    debugLog.step2 = '开始获取diy_field表数据';
    var diyFieldResult = V8.FormEngine.GetTableData('diy_field', {
        _Where: [],  // 取所有数据
        _PageSize: 10000,
        _OrderBy: 'TableId',  // 按关联表ID排序
        _OrderByType: 'ASC',
        _SelectFields: ['Id', 'Name', 'Label', 'Description', 'Type', 'Component', 'TableId']  // 只获取关键字段
    });
    
    if (diyFieldResult.Code != 1) {
        debugLog.diyFieldError = diyFieldResult.Msg;
        return {
            Code: 0,
            Msg: '获取diy_field表数据失败：' + diyFieldResult.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }
    debugLog.diyFieldCount = diyFieldResult.Data.length;

    // 3. 将字段数据组装到对应的表数据中
    debugLog.step3 = '开始组装数据';
    
    // 构建字段映射表（按TableId分组）
    var fieldMap = {};
    for (var i = 0; i < diyFieldResult.Data.length; i++) {
        var field = diyFieldResult.Data[i];
        var tableId = field.TableId;
        
        if (!fieldMap[tableId]) {
            fieldMap[tableId] = [];
        }
        
        fieldMap[tableId].push({
            Id: field.Id,
            Name: field.Name,
            Label: field.Label,
            Description: field.Description,
            Type: field.Type,
            Component: field.Component
        });
    }
    
    // 组装表数据
    var resultData = [];
    for (var j = 0; j < diyTableResult.Data.length; j++) {
        var table = diyTableResult.Data[j];
        var tableId = table.Id;
        
        // 为每个表添加 _Fields 字段
        resultData.push({
            Id: table.Id,
            Name: table.Name,
            Description: table.Description,
            _Fields: fieldMap[tableId] || []  // 如果该表没有字段，则返回空数组
        });
    }

    debugLog.step4 = '数据组装完成';
    debugLog.resultCount = resultData.length;

    // 返回结果
    return {
        Code: 1,
        Data: resultData,
        Msg: '获取数据库结构成功',
        DataAppend: {
            DebugLog: isDebug ? debugLog : null,
            Summary: {
                description: 'Microi吾码数据库结构',
                tableCount: diyTableResult.Data.length,
                fieldCount: diyFieldResult.Data.length,
                exportTime: new Date().toISOString()
            }
        }
    };

} catch (error) {
    // 异常处理
    debugLog.error = error.message || error.toString();
    return {
        Code: 0,
        Msg: '获取数据时发生异常：' + (error.message || error.toString()),
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
