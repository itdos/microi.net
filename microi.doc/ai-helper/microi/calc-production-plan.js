/**
 * 【生产主计划】计算接口引擎
 * 功能：重新计算【生产主计划-任务栈列表】的排产时间等字段
 * 
 * 涉及表：
 * - 【生产主计划】：diy_scxqdd1766715873794 (APS生产总计划)
 * - 【生产主计划-任务栈列表】：diy_APSgylxsczx1766717760801，通过RequirementOrderId与主表关联
 * 
 * 计算字段：
 * - JiagongSC (加工时长)：生产数量 / 小时产能
 * - ShengchanXS (生产系数)：默认1
 * - PaichanKSSJ (排产开始时间)：根据叠加天数和任务栈类型计算
 * - YaoqiuDLSJ (要求到料时间)：下道开工时间 - 前置天数
 * - PaichanJSSJ (排产结束时间)：下道开工时间 - 前置天数
 * 
 * 调用方式：GET/POST /apiengine/calc-production-plan
 * 参数：
 * - startDate: 开始日期（可选，默认当前日期减30天）
 * - endDate: 结束日期（可选，默认当前日期）
 * - planId: 指定计划Id（可选，如果传入则只计算该计划）
 * - workHoursPerDay: 每天工作时长（可选，默认8小时）
 */

// ==================== 配置区 ====================
var isDebug = true; // 是否开启调试日志
var debugLog = {};
var WORK_HOURS_PER_DAY = V8.Param.workHoursPerDay ? parseInt(V8.Param.workHoursPerDay) : 8; // 每天工作时长（小时）

// 缓存Key
var lockCacheKey = 'Microi:' + V8.OsClient + ':CalcPlan:Lock';
var progressCacheKey = 'Microi:' + V8.OsClient + ':CalcPlan:Progress';

try {
    // ==================== 辅助函数：格式化日期时间为ISO格式 ====================
    function formatDateTime(date) {
        if (!date) return null;
        var d = new Date(date);
        if (isNaN(d.getTime())) return null;
        
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        var hours = ('0' + d.getHours()).slice(-2);
        var minutes = ('0' + d.getMinutes()).slice(-2);
        var seconds = ('0' + d.getSeconds()).slice(-2);
        
        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    }

    // ==================== 辅助函数：格式化日期为yyyy-MM-dd格式 ====================
    function formatDate(date) {
        if (!date) return null;
        var d = new Date(date);
        if (isNaN(d.getTime())) return null;
        
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        
        return year + '-' + month + '-' + day;
    }

    // ==================== 辅助函数：日期加减天数 ====================
    function addDays(date, days) {
        if (!date) return null;
        var d = new Date(date);
        if (isNaN(d.getTime())) return null;
        d.setDate(d.getDate() + days);
        return d;
    }

    // ==================== 辅助函数：日期减去天数 ====================
    function subtractDays(date, days) {
        return addDays(date, -days);
    }

    // ==================== 辅助函数：计算小时转天数 ====================
    function hoursToDays(hours, workHoursPerDay) {
        if (!hours || hours <= 0) return 0;
        return Math.ceil(hours / workHoursPerDay);
    }

    // ==================== 辅助函数：解析日期字符串 ====================
    function parseDate(dateStr) {
        if (!dateStr) return null;
        var d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }

    debugLog.startTime = formatDateTime(new Date());
    debugLog.params = {
        startDate: V8.Param.startDate,
        endDate: V8.Param.endDate,
        planId: V8.Param.planId,
        workHoursPerDay: WORK_HOURS_PER_DAY
    };

    // ==================== 步骤1：检查是否正在执行（防止重复执行）====================
    var existingLock = V8.Cache.Get(lockCacheKey);
    if (existingLock) {
        return {
            Code: 0,
            Msg: '计算任务正在执行中，请稍后再试',
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    // 设置锁（5分钟过期）
    V8.Cache.Set(lockCacheKey, 'running', '0.00:05:00');

    // ==================== 步骤2：计算查询日期范围 ====================
    var now = new Date();
    var endDate = V8.Param.endDate ? parseDate(V8.Param.endDate) : now;
    var startDate = V8.Param.startDate ? parseDate(V8.Param.startDate) : subtractDays(now, 30);

    debugLog.dateRange = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };

    // ==================== 步骤3：查询生产主计划数据 ====================
    var planWhere = [
        ['CreateTime', '>=', formatDateTime(startDate)],
        ['CreateTime', '<=', formatDateTime(endDate)],
        ['IsDeleted', '<>', 1]
    ];

    // 如果指定了planId，则只查询该计划
    if (V8.Param.planId) {
        planWhere = [
            ['Id', '=', V8.Param.planId],
            ['IsDeleted', '<>', 1]
        ];
    }

    var planQuery = V8.FormEngine.GetTableData('diy_scxqdd1766715873794', {
        _Where: planWhere,
        _PageSize: 1000,
        _OrderBy: 'CreateTime',
        _OrderByType: 'DESC'
    }, V8.DbTrans);

    if (planQuery.Code != 1) {
        V8.Cache.Remove(lockCacheKey);
        return {
            Code: 0,
            Msg: '查询生产主计划失败：' + planQuery.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    var planList = planQuery.Data || [];
    debugLog.planCount = planList.length;

    if (planList.length === 0) {
        V8.Cache.Remove(lockCacheKey);
        return {
            Code: 1,
            Msg: '没有需要计算的生产主计划数据',
            Data: {
                planCount: 0,
                taskStackCount: 0,
                updateCount: 0
            },
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    // ==================== 步骤4：初始化进度 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '开始计算',
        progress: 0,
        total: planList.length,
        current: 0,
        startTime: formatDateTime(new Date())
    }));

    // ==================== 步骤5：循环处理每个生产主计划 ====================
    var totalUpdateCount = 0;
    var totalTaskStackCount = 0;
    var errorList = [];

    for (var i = 0; i < planList.length; i++) {
        var plan = planList[i];
        var planId = plan.Id;
        var dueDate = parseDate(plan.due_date); // 订单交付时间
        var dingdanSL = parseFloat(plan.DingdanSL) || 0; // 订单数量

        // 更新进度
        V8.Cache.Set(progressCacheKey, JSON.stringify({
            status: 'processing',
            step: '处理计划 ' + (i + 1) + '/' + planList.length,
            progress: Math.round((i / planList.length) * 100),
            total: planList.length,
            current: i + 1,
            currentPlanId: planId
        }));

        // ==================== 步骤5.1：查询该计划的任务栈列表 ====================
        var taskStackQuery = V8.FormEngine.GetTableData('diy_APSgylxsczx1766717760801', {
            _Where: [
                ['RequirementOrderId', '=', planId],
                ['IsDeleted', '<>', 1]
            ],
            _PageSize: 1000,
            _OrderBy: 'PaixuM',
            _OrderByType: 'ASC'
        }, V8.DbTrans);

        if (taskStackQuery.Code != 1) {
            errorList.push({
                planId: planId,
                error: '查询任务栈失败：' + taskStackQuery.Msg
            });
            continue;
        }

        var taskStackList = taskStackQuery.Data || [];
        totalTaskStackCount += taskStackList.length;

        if (taskStackList.length === 0) {
            continue;
        }

        // ==================== 步骤5.2：按排序码排序，构建任务栈链 ====================
        // 按PaixuM排序（升序），排序码小的是前道工序
        taskStackList.sort(function(a, b) {
            var sortA = parseInt(a.PaixuM) || 0;
            var sortB = parseInt(b.PaixuM) || 0;
            return sortA - sortB;
        });

        // 构建任务栈索引（用于查找上道/下道）
        var taskStackMap = {};
        for (var t = 0; t < taskStackList.length; t++) {
            taskStackMap[taskStackList[t].Id] = taskStackList[t];
            taskStackMap[taskStackList[t].Id]._index = t;
        }

        // ==================== 步骤5.3：从末道向首道计算（倒推法） ====================
        // 末道的结束时间 = 订单交付时间
        var updateList = [];

        for (var j = taskStackList.length - 1; j >= 0; j--) {
            var taskStack = taskStackList[j];
            var taskStackId = taskStack.Id;
            var renwuZLX = taskStack.RenwuZLX || ''; // 任务栈类型：自制、外购（委外）
            var shengchanSL = parseInt(taskStack.ShengchanSL) || 0; // 生产数量
            var xiaoshiCN = parseInt(taskStack.XiaoshiCN) || 1; // 小时产能
            var chanxianSL = parseInt(taskStack.ChanxianSL) || 1; // 产线条数（默认1）
            var qianzhiTS = parseInt(taskStack.QianzhiTS) || 0; // 前置天数
            var diejiaTS = parseInt(taskStack.DiejiaTS) || 0; // 叠加天数
            var jiaoqiFDBL = parseInt(taskStack.JiaoqiFDBL) || 1; // 交期放大比例（默认1）
            var shengchanXS = parseInt(taskStack.ShengchanXS) || 1; // 生产系数（默认1）
            var shifouMD = taskStack.ShifouMD == 1; // 是否末道
            var shifouSD = taskStack.ShifouSD == 1; // 是否首道

            // 计算更新的字段
            var updateData = {
                FormEngineKey: 'diy_APSgylxsczx1766717760801',
                Id: taskStackId
            };

            // 2.1、【加工时长 JiagongSC】= 生产数量 / 小时产能（类型：外购委外隐藏）
            var jiagongSC = 0;
            if (renwuZLX.indexOf('外购') === -1 && renwuZLX.indexOf('委外') === -1) {
                // 自制类型才计算加工时长
                if (xiaoshiCN > 0) {
                    jiagongSC = Math.ceil(shengchanSL / xiaoshiCN);
                }
            }
            updateData.JiagongSC = jiagongSC;

            // 2.2、【生产系数 ShengchanXS】默认是1
            if (!shengchanXS || shengchanXS <= 0) {
                updateData.ShengchanXS = 1;
            }

            // 获取下道任务栈的信息（用于计算本道的时间）
            var nextTaskStack = null;
            var nextKaigongDate = null; // 下道开工日
            
            if (j < taskStackList.length - 1) {
                nextTaskStack = taskStackList[j + 1];
                // 下道开工时间 = 下道的排产开始时间
                nextKaigongDate = parseDate(nextTaskStack._calcPaichanKSSJ || nextTaskStack.PaichanKSSJ);
            } else {
                // 末道工序，下道开工日 = 订单交付时间
                nextKaigongDate = dueDate;
            }

            // 2.5、【排产结束时间 PaichanJSSJ】= 下道开工时间 - 前置天数
            var paichanJSSJ = null;
            if (nextKaigongDate) {
                paichanJSSJ = subtractDays(nextKaigongDate, qianzhiTS);
            }
            updateData.PaichanJSSJ = formatDateTime(paichanJSSJ);

            // 2.3、【排产开始时间 PaichanKSSJ】
            var paichanKSSJ = null;
            if (renwuZLX.indexOf('外购') === -1 && renwuZLX.indexOf('委外') === -1) {
                // 类型：自制
                if (diejiaTS > 0) {
                    // 如果叠加天数>0，等于下道开工日-叠加天数
                    if (nextKaigongDate) {
                        paichanKSSJ = subtractDays(nextKaigongDate, diejiaTS);
                    }
                } else {
                    // 如果叠加天数<=0
                    // 等于本道结束时间 - (生产数量/(小时产能*产线条数))/每天工作时长)*交期放大比例
                    if (paichanJSSJ && xiaoshiCN > 0 && chanxianSL > 0) {
                        var productionHours = shengchanSL / (xiaoshiCN * chanxianSL);
                        var productionDays = Math.ceil((productionHours / WORK_HOURS_PER_DAY) * jiaoqiFDBL);
                        paichanKSSJ = subtractDays(paichanJSSJ, productionDays);
                    }
                }
            }
            // 外购（委外）类型的排产开始时间隐藏，不计算
            updateData.PaichanKSSJ = formatDateTime(paichanKSSJ);

            // 保存计算后的开始时间，供上道工序使用
            taskStack._calcPaichanKSSJ = formatDateTime(paichanKSSJ || paichanJSSJ);

            // 2.4、【要求到料时间 YaoqiuDLSJ】类型：外购（委外）
            // 要求到料时间 = 下道开工时间 - 前置天数
            var yaoqiuDLSJ = null;
            if (renwuZLX.indexOf('外购') !== -1 || renwuZLX.indexOf('委外') !== -1) {
                // 外购（委外）类型才计算要求到料时间
                if (nextKaigongDate) {
                    yaoqiuDLSJ = subtractDays(nextKaigongDate, qianzhiTS);
                }
            }
            updateData.YaoqiuDLSJ = formatDateTime(yaoqiuDLSJ);

            updateList.push(updateData);
        }

        // ==================== 步骤5.4：批量更新任务栈数据 ====================
        if (updateList.length > 0) {
            var updateResult = V8.FormEngine.UptTableData(updateList, V8.DbTrans);
            if (updateResult.Code != 1) {
                errorList.push({
                    planId: planId,
                    error: '更新任务栈失败：' + updateResult.Msg
                });
            } else {
                totalUpdateCount += updateList.length;
            }
        }

        // ==================== 步骤5.5：更新主计划的排产时间（取首道和末道）====================
        if (taskStackList.length > 0) {
            var firstTaskStack = taskStackList[0]; // 首道工序
            var lastTaskStack = taskStackList[taskStackList.length - 1]; // 末道工序

            var planUpdateData = {
                Id: planId
            };

            // 主计划的排产开始时间 = 首道任务栈的排产开始时间
            if (firstTaskStack._calcPaichanKSSJ) {
                planUpdateData.PaichanKSSJ = firstTaskStack._calcPaichanKSSJ;
            }

            // 主计划的排产结束时间 = 末道任务栈的排产结束时间（即订单交付时间）
            planUpdateData.PaichanJSSJ = formatDateTime(dueDate);

            var planUpdateResult = V8.FormEngine.UptFormData('diy_scxqdd1766715873794', planUpdateData, V8.DbTrans);
            if (planUpdateResult.Code != 1) {
                errorList.push({
                    planId: planId,
                    error: '更新主计划失败：' + planUpdateResult.Msg
                });
            }
        }
    }

    // ==================== 步骤6：完成处理 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'completed',
        step: '计算完成',
        progress: 100,
        total: planList.length,
        updateCount: totalUpdateCount,
        endTime: formatDateTime(new Date())
    }));

    // 清理锁
    V8.Cache.Remove(lockCacheKey);

    debugLog.endTime = formatDateTime(new Date());
    debugLog.totalUpdateCount = totalUpdateCount;
    debugLog.totalTaskStackCount = totalTaskStackCount;
    debugLog.errorList = errorList;

    // ==================== 返回结果 ====================
    return {
        Code: 1,
        Data: {
            planCount: planList.length,
            taskStackCount: totalTaskStackCount,
            updateCount: totalUpdateCount,
            errorCount: errorList.length
        },
        Msg: '计算完成！处理 ' + planList.length + ' 个生产主计划，' +
             '更新 ' + totalUpdateCount + ' 条任务栈数据。' +
             (errorList.length > 0 ? '有 ' + errorList.length + ' 个错误。' : ''),
        DataAppend: {
            DebugLog: isDebug ? debugLog : null,
            Errors: errorList.length > 0 ? errorList : null
        }
    };

} catch (error) {
    // 清理锁和进度缓存
    V8.Cache.Remove(lockCacheKey);
    V8.Cache.Remove(progressCacheKey);

    // 收集详细的错误信息
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

    var errorMsg = '计算生产主计划发生异常：' + (error.message || error.toString());
    if (error.lineNumber) {
        errorMsg += ' (行号: ' + error.lineNumber + ')';
    }
    if (error.stack) {
        errorMsg += '\n堆栈: ' + error.stack;
    }

    return {
        Code: 0,
        Msg: errorMsg,
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
