/**
 * 批量排班接口引擎
 * 
 * 功能：根据选择的任务栈和日历数据，自动按月生成工作日历
 * 
 * 业务逻辑：
 * 1. 接收前端传入的任务栈列表、日历数据、每天工作时长
 * 2. 将日历数据按月分组，找出每个月的连续时间周期
 * 3. 为每个任务栈的每个连续周期生成工作日历记录
 * 4. 检测时间段重叠冲突（相同任务栈 + 时间段有重叠则报错）
 * 5. 使用Redis缓存记录处理进度
 * 
 * 接口配置：
 * - ApiEngineKey: batch_schedule_calendar
 * - ApiAddress: /apiengine/batch-schedule-calendar
 * - 允许匿名调用: 否
 * - 分布式锁: 是（防止并发操作）
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('batch_schedule_calendar', {
 *   XuanzeSCZX: [{Id:'xxx', Name:'任务栈1', ...}],
 *   XuanzeGZR: ['星期一', '星期二'],
 *   XuanzeYF: ['2026-02', '2026-03'],
 *   MeitianGZSC: 8,
 *   Rili: ['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-09']
 * })
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     successCount: 5,        // 成功生成的记录数
 *     taskStackCount: 2,      // 任务栈数量
 *     periodCount: 3,         // 时间周期数量
 *     details: [...]          // 详细信息
 *   },
 *   Msg: '批量排班成功'
 * }
 */

// ==================== 参数接收与校验 ====================

var XuanzeSCZX = V8.Param.XuanzeSCZX;      // 选择的任务栈（表diy_APSsczx），JSON数组
var XuanzeGZR = V8.Param.XuanzeGZR;        // 选择的工作日，格式：["星期一", "星期二"]
var XuanzeYF = V8.Param.XuanzeYF;          // 选择的月份，格式：['2026-02', '2026-03']
var MeitianGZSC = V8.Param.MeitianGZSC;    // 每天工作时长，int数字，单位小时
var Rili = V8.Param.Rili;                  // 日历数据，格式：['2026-02-02', '2026-02-03']

// 定义调试模式和进度缓存Key
var isDebug = true;
var debugLog = {};
var progressCacheKey = 'Microi:' + V8.OsClient + ':BatchSchedule:Progress:' + V8.CurrentUser.Id;

// 参数校验
if (!XuanzeSCZX || XuanzeSCZX.length === 0) {
    return {
        Code: 0,
        Msg: '参数错误：任务栈列表不能为空'
    };
}

if (!XuanzeGZR || XuanzeGZR.length === 0) {
    return {
        Code: 0,
        Msg: '参数错误：工作日列表不能为空'
    };
}

if (!XuanzeYF || XuanzeYF.length === 0) {
    return {
        Code: 0,
        Msg: '参数错误：月份列表不能为空'
    };
}

if (!MeitianGZSC || MeitianGZSC <= 0) {
    return {
        Code: 0,
        Msg: '参数错误：每天工作时长必须大于0'
    };
}

if (!Rili || Rili.length === 0) {
    return {
        Code: 0,
        Msg: '参数错误：日历数据不能为空'
    };
}

debugLog.params = {
    taskStackCount: XuanzeSCZX.length,
    workDays: XuanzeGZR,
    selectedMonths: XuanzeYF,
    calendarDays: Rili.length,
    dailyWorkHours: MeitianGZSC
};

try {
    // ==================== 辅助函数：格式化日期时间为ISO格式 ====================
    var formatDateTime = function(date) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        
        var monthStr = month < 10 ? '0' + month : '' + month;
        var dayStr = day < 10 ? '0' + day : '' + day;
        var hoursStr = hours < 10 ? '0' + hours : '' + hours;
        var minutesStr = minutes < 10 ? '0' + minutes : '' + minutes;
        var secondsStr = seconds < 10 ? '0' + seconds : '' + seconds;
        
        return year + '-' + monthStr + '-' + dayStr + ' ' + hoursStr + ':' + minutesStr + ':' + secondsStr;
    };

    // ==================== 初始化进度 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '开始处理',
        progress: 0,
        total: 0,
        startTime: formatDateTime(new Date())
    }));

    // ==================== 辅助函数：日期排序 ====================
    var sortDates = function(dates) {
        return dates.sort(function(a, b) {
            return new Date(a) - new Date(b);
        });
    };

    // ==================== 辅助函数：计算两个日期相差天数 ====================
    var getDaysDiff = function(date1, date2) {
        var d1 = new Date(date1);
        var d2 = new Date(date2);
        var diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // ==================== 辅助函数：日期加1天 ====================
    var addOneDay = function(dateStr) {
        var date = new Date(dateStr);
        date.setDate(date.getDate() + 1);
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        // 使用传统方式补零，兼容Jint引擎
        var monthStr = month < 10 ? '0' + month : '' + month;
        var dayStr = day < 10 ? '0' + day : '' + day;
        return year + '-' + monthStr + '-' + dayStr;
    };

    // ==================== 步骤1：按月分组日历数据 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '按月分组日历数据',
        progress: 10,
        total: 100
    }));

    var sortedDates = sortDates(Rili);
    var monthGroups = {}; // { '2026-02': ['2026-02-02', '2026-02-03', ...] }

    for (var i = 0; i < sortedDates.length; i++) {
        var dateStr = sortedDates[i];
        var monthKey = dateStr.substring(0, 7); // 取 yyyy-MM
        if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
        }
        monthGroups[monthKey].push(dateStr);
    }

    debugLog.monthGroups = monthGroups;

    // ==================== 步骤2：找出每个月的连续时间周期 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '识别连续时间周期',
        progress: 20,
        total: 100
    }));

    var allPeriods = []; // 存储所有时间周期 [{month, startDate, endDate, days}]

    for (var monthKey in monthGroups) {
        var dates = monthGroups[monthKey];
        var periods = [];
        
        if (dates.length === 0) continue;

        var periodStart = dates[0];
        var periodEnd = dates[0];

        for (var j = 1; j < dates.length; j++) {
            var prevDate = dates[j - 1];
            var currDate = dates[j];
            
            // 计算日期差，判断是否连续
            var expectedNextDate = addOneDay(prevDate);
            
            if (currDate === expectedNextDate) {
                // 连续，扩展当前周期
                periodEnd = currDate;
            } else {
                // 不连续，保存当前周期，开始新周期
                var days = getDaysDiff(periodStart, periodEnd) + 1;
                periods.push({
                    month: monthKey,
                    startDate: periodStart,
                    endDate: periodEnd,
                    days: days
                });
                
                periodStart = currDate;
                periodEnd = currDate;
            }
        }

        // 保存最后一个周期
        var days = getDaysDiff(periodStart, periodEnd) + 1;
        periods.push({
            month: monthKey,
            startDate: periodStart,
            endDate: periodEnd,
            days: days
        });

        allPeriods = allPeriods.concat(periods);
    }

    debugLog.periods = allPeriods;
    debugLog.periodCount = allPeriods.length;

    if (allPeriods.length === 0) {
        return {
            Code: 0,
            Msg: '没有找到有效的连续时间周期',
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    // ==================== 步骤3：为每个任务栈检测冲突并生成工作日历 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '检测冲突并生成工作日历',
        progress: 30,
        total: 100
    }));

    var successCount = 0;
    var totalOperations = allPeriods.length;
    var currentOperation = 0;
    var generatedRecords = [];

    // 将整个任务栈数组JSON化
    var allTaskStackJson = JSON.stringify(XuanzeSCZX);

    // 查询已存在的工作日历（用于冲突检测）
    var existingCalendars = V8.FormEngine.GetTableData('diy_gzrl', {
        _Where: [],
        _PageSize: 1000
    });

    if (existingCalendars.Code != 1) {
        return {
            Code: 0,
            Msg: '查询已存在的工作日历失败：' + existingCalendars.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    var existingPeriods = existingCalendars.Data || [];
    debugLog.existingCount = existingPeriods.length;

    // 遍历每个时间周期
    for (var periodIdx = 0; periodIdx < allPeriods.length; periodIdx++) {
        var period = allPeriods[periodIdx];
        currentOperation++;

        // 更新进度
        var progress = 30 + Math.floor((currentOperation / totalOperations) * 60);
        V8.Cache.Set(progressCacheKey, JSON.stringify({
            status: 'processing',
            step: '处理周期 ' + (periodIdx + 1) + '/' + allPeriods.length,
            progress: progress,
            total: 100,
            currentPeriod: period.startDate + '～' + period.endDate
        }));

        // ==================== 冲突检测：时间段重叠 ====================
        var hasConflict = false;
        var conflictPeriod = null;

        for (var k = 0; k < existingPeriods.length; k++) {
            var existing = existingPeriods[k];
            var existingStart = existing.StartTime;
            var existingEnd = existing.EndTime;

            // 判断时间段是否重叠
            // 重叠条件：新周期开始 <= 已存在周期结束 AND 新周期结束 >= 已存在周期开始
            if (period.startDate <= existingEnd && period.endDate >= existingStart) {
                hasConflict = true;
                conflictPeriod = {
                    existing: existingStart + '～' + existingEnd,
                    new: period.startDate + '～' + period.endDate
                };
                break;
            }
        }

        if (hasConflict) {
            // 清理进度缓存
            V8.Cache.Remove(progressCacheKey);
            
            return {
                Code: 0,
                Msg: '时间段【' + period.startDate + '～' + period.endDate + '】存在重叠冲突',
                DataAppend: {
                    conflict: conflictPeriod,
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }

        // ==================== 生成工作日历记录 ====================
        var gongzuoRLMC = period.startDate + '～' + period.endDate;
        var shezhiGS = period.days * MeitianGZSC;

        var addResult = V8.FormEngine.AddFormData('diy_gzrl', {
            Code: '',  // 空字符串，使用自动编号
            Name: gongzuoRLMC,
            RenwuZ: allTaskStackJson,  // 存储整个任务栈数组JSON
            StartTime: period.startDate,
            EndTime: period.endDate,
            ShezhiGS: shezhiGS
        }, V8.DbTrans);

        if (addResult.Code != 1) {
            // 清理进度缓存
            V8.Cache.Remove(progressCacheKey);
            
            return {
                Code: 0,
                Msg: '生成工作日历失败：' + addResult.Msg,
                DataAppend: {
                    period: period,
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }

        successCount++;
        generatedRecords.push({
            period: gongzuoRLMC,
            days: period.days,
            workHours: shezhiGS,
            recordId: addResult.Data.Id
        });
    }

    // ==================== 步骤4：完成处理 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'completed',
        step: '批量排班完成',
        progress: 100,
        total: 100,
        successCount: successCount,
        endTime: formatDateTime(new Date())
    }));

    debugLog.summary = {
        successCount: successCount,
        taskStackCount: XuanzeSCZX.length,
        periodCount: allPeriods.length,
        totalOperations: totalOperations
    };

    // ==================== 返回结果 ====================
    // 计算总工时（使用for循环代替reduce，兼容Jint）
    var totalWorkHours = 0;
    for (var m = 0; m < generatedRecords.length; m++) {
        totalWorkHours += generatedRecords[m].workHours;
    }
    
    return {
        Code: 1,
        Data: {
            successCount: successCount,
            taskStackCount: XuanzeSCZX.length,
            periodCount: allPeriods.length,
            totalWorkHours: totalWorkHours,
            details: generatedRecords
        },
        Msg: '批量排班成功！共为 ' + XuanzeSCZX.length + ' 个任务栈生成 ' + successCount + ' 条工作日历记录',
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };

} catch (error) {
    // 清理进度缓存
    V8.Cache.Remove(progressCacheKey);
    
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
    
    var errorMsg = '批量排班发生异常：' + (error.message || error.toString());
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
