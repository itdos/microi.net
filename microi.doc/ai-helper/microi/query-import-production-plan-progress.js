/**
 * 查询生产主计划引入进度接口引擎
 * 
 * 功能：查询当前用户的生产主计划引入操作进度
 * 
 * 业务逻辑：
 * 1. 从Redis缓存中读取当前用户的引入进度信息
 * 2. 返回进度状态、当前步骤、百分比等信息
 * 
 * 接口配置：
 * - ApiEngineKey: query_import_production_plan_progress
 * - ApiAddress: /apiengine/query-import-production-plan-progress
 * - 允许匿名调用: 否
 * - 分布式锁: 否
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('query_import_production_plan_progress', {})
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     status: 'processing',      // processing: 处理中, completed: 已完成, error: 错误, notfound: 未找到
 *     step: '插入子表数据',      // 当前步骤描述
 *     progress: 65,              // 当前进度百分比 (0-100)
 *     total: 100,                // 总进度（固定100）
 *     startTime: '2026-01-12 10:30:00',  // 开始时间
 *     endTime: '2026-01-12 10:35:00',    // 结束时间（处理中为null）
 *     insertCount: 10,           // 插入记录数（完成后才有）
 *     updateCount: 5,            // 更新记录数（完成后才有）
 *     skipCount: 3               // 跳过记录数（完成后才有）
 *   },
 *   Msg: '查询成功'
 * }
 */

// ==================== 参数接收与校验 ====================

var isDebug = true;
var debugLog = {};
var progressCacheKey = 'Microi:' + V8.OsClient + ':ImportProductionPlan:Progress:' + V8.CurrentUser.Id;

try {
    // ==================== 查询进度缓存 ====================
    var progressCache = V8.Cache.Get(progressCacheKey);
    
    if (!progressCache) {
        // 没有找到进度信息
        return {
            Code: 1,
            Data: {
                status: 'notfound',
                step: '未找到引入操作',
                progress: 0,
                total: 100,
                message: '当前没有正在执行或最近完成的引入操作'
            },
            Msg: '未找到引入进度信息'
        };
    }
    
    // 解析进度信息
    var progressData = JSON.parse(progressCache);
    
    debugLog.progressData = progressData;
    
    // ==================== 返回进度信息 ====================
    return {
        Code: 1,
        Data: progressData,
        Msg: '查询成功',
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
    
} catch (error) {
    // 收集详细的错误信息，兼容Jint引擎
    debugLog.errorDetails = {
        message: error.message || '',
        toString: error.toString ? error.toString() : '',
        stack: error.stack || '',
        lineNumber: error.lineNumber || '',
        columnNumber: error.columnNumber || '',
        fileName: error.fileName || '',
        name: error.name || '',
        description: error.description || ''
    };
    
    var errorMsg = '查询进度发生异常：' + (error.message || error.toString());
    if (error.lineNumber) {
        errorMsg += ' (行号: ' + error.lineNumber + ')';
    }
    
    return {
        Code: 0,
        Msg: errorMsg,
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
