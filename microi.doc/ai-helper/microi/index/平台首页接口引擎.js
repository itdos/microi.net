/**
 * Microi吾码 - 平台首页数据接口引擎
 * 
 * 功能：获取平台首页所需的各种统计数据
 * 
 * 使用说明：
 * 1. 在Microi吾码平台的【接口引擎】中创建一个新接口
 * 2. 将此代码粘贴到接口引擎的V8代码编辑器中
 * 3. 配置接口引擎Key为：platform_dashboard
 * 4. 配置自定义接口地址为：/apiengine/platform-dashboard
 * 5. 配置是否允许匿名调用（建议不允许，需要登录）
 * 
 * 调用方式：
 * GET/POST: {ApiBase}/apiengine/platform-dashboard?type=xxx
 * 
 * 支持的type参数：
 * - todo: 我的待办
 * - workflow: 我的流程发起
 * - notice: 通知公告
 * - modules: 常用模块
 * - calendar: 日历事件
 * - systeminfo: 系统信息（操作系统、版本号等）
 * - performance: 性能指标（CPU/内存/硬盘）
 * - statistics: 数据统计（表单数/模块数等）
 * - loginlogs: 最近登录用户
 * - apirank: 接口调用频率排行
 * - datarank: 表单数据量排行
 * - network: 服务器网络流量
 * - diskio: 磁盘IO
 * - memo: 个人备忘录
 * - all: 获取所有数据（默认）
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: { ... },
 *   Msg: '获取成功'
 * }
 */

try {
    // 获取请求参数
    var type = V8.Param.type || 'all';
    
    // 初始化返回数据
    var resultData = {};
    
    // 根据type参数返回相应数据
    switch(type.toLowerCase()) {
        case 'todo':
            resultData = getTodoData();
            break;
        case 'workflow':
            resultData = getWorkflowData();
            break;
        case 'notice':
            resultData = getNoticeData();
            break;
        case 'modules':
            resultData = getModulesData();
            break;
        case 'calendar':
            resultData = getCalendarData();
            break;
        case 'systeminfo':
            resultData = getSystemInfo();
            break;
        case 'performance':
            resultData = getPerformanceData();
            break;
        case 'statistics':
            resultData = getStatisticsData();
            break;
        case 'loginlogs':
            resultData = getLoginLogsData();
            break;
        case 'apirank':
            resultData = getApiRankData();
            break;
        case 'datarank':
            resultData = getDataRankData();
            break;
        case 'network':
            resultData = getNetworkData();
            break;
        case 'diskio':
            resultData = getDiskIOData();
            break;
        case 'memo':
            resultData = getMemoData();
            break;
        case 'all':
        default:
            resultData = getAllData();
            break;
    }
    
    return {
        Code: 1,
        Data: resultData,
        Msg: '获取成功'
    };
    
} catch (ex) {
    return {
        Code: 0,
        Data: null,
        Msg: '获取失败：' + ex.message
    };
}

// ============ 数据获取函数 ============

/**
 * 获取我的待办
 */
function getTodoData() {
    try {
        // 获取当前登录用户
        var currentUserId = V8.CurrentUserId;
        
        // 查询待办事项（示例：从工作流待办表查询）
        var todoResult = V8.FormEngine.GetTableData('diy_workflow_todo', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['Status', '=', '待处理']
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (todoResult.Code !== 1) {
            return {
                total: 0,
                list: []
            };
        }
        
        return {
            total: todoResult.DataCount || 0,
            list: todoResult.Data || []
        };
    } catch (ex) {
        return {
            total: 0,
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取我的流程发起
 */
function getWorkflowData() {
    try {
        var currentUserId = V8.CurrentUserId;
        
        // 查询我发起的流程
        var workflowResult = V8.FormEngine.GetTableData('diy_workflow', {
            _Where: [
                ['CreateUserId', '=', currentUserId]
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (workflowResult.Code !== 1) {
            return {
                total: 0,
                list: []
            };
        }
        
        return {
            total: workflowResult.DataCount || 0,
            list: workflowResult.Data || []
        };
    } catch (ex) {
        return {
            total: 0,
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取通知公告
 */
function getNoticeData() {
    try {
        // 查询最新的通知公告
        var noticeResult = V8.FormEngine.GetTableData('diy_notice', {
            _Where: [
                ['Status', '=', '已发布']
            ],
            _PageSize: 5,
            _OrderBy: 'PublishTime',
            _OrderByType: 'DESC'
        });
        
        if (noticeResult.Code !== 1) {
            return {
                total: 0,
                list: []
            };
        }
        
        return {
            total: noticeResult.DataCount || 0,
            list: noticeResult.Data || []
        };
    } catch (ex) {
        return {
            total: 0,
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取常用模块
 */
function getModulesData() {
    try {
        var currentUserId = V8.CurrentUserId;
        
        // 查询用户常用模块
        var modulesResult = V8.FormEngine.GetTableData('diy_user_favorite', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['Type', '=', '模块']
            ],
            _PageSize: 8,
            _OrderBy: 'UseCount',
            _OrderByType: 'DESC'
        });
        
        if (modulesResult.Code !== 1) {
            return {
                list: []
            };
        }
        
        return {
            list: modulesResult.Data || []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取日历事件
 */
function getCalendarData() {
    try {
        var currentUserId = V8.CurrentUserId;
        var currentDate = new Date();
        
        // 获取当前月份的开始和结束日期
        var startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        var endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        // 格式化日期
        var startDateStr = startDate.getFullYear() + '-' + 
            String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(startDate.getDate()).padStart(2, '0');
        var endDateStr = endDate.getFullYear() + '-' + 
            String(endDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(endDate.getDate()).padStart(2, '0');
        
        // 查询日历事件
        var calendarResult = V8.FormEngine.GetTableData('diy_calendar', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['EventDate', '>=', startDateStr],
                ['EventDate', '<=', endDateStr]
            ],
            _PageSize: 100,
            _OrderBy: 'EventDate',
            _OrderByType: 'ASC'
        });
        
        if (calendarResult.Code !== 1) {
            return {
                list: []
            };
        }
        
        return {
            list: calendarResult.Data || []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取系统信息
 */
function getSystemInfo() {
    try {
        // 使用V8.System扩展获取系统信息
        var systemInfo = new V8.System.SystemInfo();
        var osInfo = systemInfo.GetOSInfo();
        
        // 获取版本信息
        var versionInfo = getVersionInfo();
        
        return {
            os: osInfo,
            version: versionInfo
        };
    } catch (ex) {
        // 出错时返回基本信息
        var basicInfo = {
            Platform: 'Unknown',
            OSVersion: 'Unknown',
            MachineName: 'Unknown',
            ProcessorCount: 0
        };
        
        try {
            basicInfo.Platform = System.Environment.OSVersion.Platform.ToString();
            basicInfo.OSVersion = System.Environment.OSVersion.VersionString;
            basicInfo.MachineName = System.Environment.MachineName;
            basicInfo.ProcessorCount = System.Environment.ProcessorCount;
        } catch(e) {
            // 忽略System调用错误
        }
        
        return {
            os: basicInfo,
            version: getVersionInfo(),
            error: ex.message
        };
    }
}

/**
 * 获取版本信息
 */
function getVersionInfo() {
    try {
        // 从配置或数据库中获取版本信息
        var versionResult = V8.FormEngine.GetFormData('diy_system_config', {
            _Where: [
                ['ConfigKey', '=', 'SystemVersion']
            ]
        });
        
        var frontendVersion = '3.0.0'; // 前端版本
        var backendVersion = '3.0.2';  // 后端版本
        var edition = '开源版';  // 版本类型：开源版/个人版/企业版
        
        if (versionResult.Code === 1 && versionResult.Data) {
            var configValue = JSON.parse(versionResult.Data.ConfigValue || '{}');
            frontendVersion = configValue.FrontendVersion || frontendVersion;
            backendVersion = configValue.BackendVersion || backendVersion;
            edition = configValue.Edition || edition;
        }
        
        return {
            frontendVersion: frontendVersion,
            backendVersion: backendVersion,
            edition: edition
        };
    } catch (ex) {
        return {
            frontendVersion: '3.0.0',
            backendVersion: '3.0.2',
            edition: '开源版',
            error: ex.message
        };
    }
}

/**
 * 获取性能数据
 */
function getPerformanceData() {
    try {
        var systemInfo = new V8.System.SystemInfo();
        
        // 获取CPU和内存信息
        var cpuMemInfo = systemInfo.GetCpuMemoryInfo();
        
        // 获取磁盘信息
        var diskInfo = systemInfo.GetDiskInfo();
        
        return {
            cpu: cpuMemInfo.CpuUsagePercent || 0,
            memory: cpuMemInfo.MemoryUsagePercent || 0,
            memoryTotalMB: cpuMemInfo.MemoryTotalMB || 0,
            memoryUsedMB: cpuMemInfo.MemoryUsedMB || 0,
            disk: diskInfo.Disks || []
        };
    } catch (ex) {
        return {
            cpu: 0,
            memory: 0,
            memoryTotalMB: 0,
            memoryUsedMB: 0,
            disk: [],
            error: ex.message
        };
    }
}

/**
 * 获取统计数据
 */
function getStatisticsData() {
    try {
        // 表单数
        var formCountResult = V8.FormEngine.GetTableData('diy_table', {
            _PageSize: 1
        });
        var formCount = formCountResult.DataCount || 0;
        
        // 模块数
        var moduleCountResult = V8.FormEngine.GetTableData('sys_menu', {
            _Where: [
                ['DiyTableId', '<>', null]
            ],
            _PageSize: 1
        });
        var moduleCount = moduleCountResult.DataCount || 0;
        
        // 接口引擎数
        var apiEngineCountResult = V8.FormEngine.GetTableData('diy_apiengine', {
            _PageSize: 1
        });
        var apiEngineCount = apiEngineCountResult.DataCount || 0;
        
        // SaaS引擎数（如果有）
        var saasEngineCount = 0;
        try {
            var saasEngineCountResult = V8.FormEngine.GetTableData('diy_saas_engine', {
                _PageSize: 1
            });
            saasEngineCount = saasEngineCountResult.DataCount || 0;
        } catch (e) {
            saasEngineCount = 0;
        }
        
        // 用户数
        var userCountResult = V8.FormEngine.GetTableData('sys_user', {
            _PageSize: 1
        });
        var userCount = userCountResult.DataCount || 0;
        
        // DIY表总数据量 - 注释掉性能问题函数，改为返回0或使用缓存
        var diyTableDataCount = 0; // getDiyTableTotalDataCount(); 此函数性能消耗大，已禁用
        
        // 接口请求次数（近30天）- 优化查询
        var apiRequestCount = 0;
        try {
            var requestLogCountResult = V8.FormEngine.GetTableData('diy_api_request_log', {
                _PageSize: 1
            });
            apiRequestCount = requestLogCountResult.DataCount || 0;
        } catch(e) {
            apiRequestCount = 0;
        }
        
        return {
            formCount: formCount,
            moduleCount: moduleCount,
            apiEngineCount: apiEngineCount,
            saasEngineCount: saasEngineCount,
            userCount: userCount,
            diyTableDataCount: diyTableDataCount,
            apiRequestCount30Days: apiRequestCount
        };
    } catch (ex) {
        return {
            formCount: 0,
            moduleCount: 0,
            apiEngineCount: 0,
            saasEngineCount: 0,
            userCount: 0,
            diyTableDataCount: 0,
            apiRequestCount30Days: 0,
            error: ex.message
        };
    }
}

/**
 * 获取DIY表总数据量（已禁用 - 性能问题）
 * 此函数会遍历所有表查询数据量，性能消耗极大
 * 建议：
 * 1. 使用定时任务预先统计并存储到缓存
 * 2. 或者创建一个汇总表定期更新
 * 3. 或者只统计部分重要表的数据量
 */
function getDiyTableTotalDataCount() {
    // 禁用此函数，返回0或从缓存读取
    return 0;
    
    /* 原代码已注释 - 性能问题
    try {
        var tablesResult = V8.FormEngine.GetTableData('diy_table', {
            _PageSize: 1000
        });
        
        if (tablesResult.Code !== 1) {
            return 0;
        }
        
        var totalCount = 0;
        var tables = tablesResult.Data || [];
        
        for (var i = 0; i < tables.length; i++) {
            try {
                var tableName = tables[i].Name;
                var countResult = V8.FormEngine.GetTableData(tableName, {
                    _PageSize: 1
                });
                if (countResult.Code === 1) {
                    totalCount += countResult.DataCount || 0;
                }
            } catch (e) {
            }
        }
        
        return totalCount;
    } catch (ex（已优化）
 * 注意：原函数已移到 getStatisticsData 中直接调用，避免重复代码
 */
function getApiRequestCount30Days() {
    try {
        // 直接返回总数，不过滤日期（性能优化）
        var requestLogResult = V8.FormEngine.GetTableData('diy_api_request_log', {
            _PageSize: 1
        });// 查询接口请求日志
        var requestLogResult = V8.FormEngine.GetTableData('diy_api_request_log', {
            _Where: [
                ['CreateTime', '>=', dateStr]
            ],
            _PageSize: 1
        });
        
        return requestLogResult.DataCount || 0;
    } catch (ex) {
        return 0;
    }
}

/**
 * 获取最近登录用户
 */
function getLoginLogsData() {
    try {
        var loginLogsResult = V8.FormEngine.GetTableData('sys_login_log', {
            _PageSize: 10,
            _OrderBy: 'LoginTime',
            _OrderByType: 'DESC'
        });
        
        if (loginLogsResult.Code !== 1) {
            return {
                list: []
            };
        }
        
        return {
            list: loginLogsResult.Data || []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取接口调用频率排行
 */
function getApiRankData() {
    try {
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        var dateStr = thirtyDaysAgo.getFullYear() + '-' + 
            String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0') + '-' + 
            String(thirtyDaysAgo.getDate()).padStart(2, '0');
        （性能优化版）
 */
function getApiRankData() {
    try {
        // 只获取最近500条记录进行统计，避免性能问题
        var apiRankResult = V8.FormEngine.GetTableData('diy_api_request_log', {
            _PageSize: 500,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        var apiCallCount = {};
        var logs = apiRankResult.Data || [];
        
        for (var i = 0; i < logs.length; i++) {
            var apiKey = logs[i].ApiKey || logs[i].ApiUrl || 'Unknown';
            if (!apiCallCount[apiKey]) {
                apiCallCount[apiKey] = {
                    apiKey: apiKey,
                    apiName: logs[i].ApiName || apiKey,
                    count: 0
                };
            }
            apiCallCount[apiKey].count++;
        }
        
        // 转换为数组并排序
        var rankList = [];
        for (var key in apiCallCount) {
            rankList.push(apiCallCount[key]);
        }
        rankList.sort(function(a, b) {
            return b.count - a.count;
        });
        
        // 只返回前10个
        return {
            list: rankList.slice(0, 10)
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取表单数据量排行
 */
function getDataRankData() {
    try {
        // 获取所有DIY表
        var tablesResult = V8.FormEngine.GetTableData('diy_table', {
            _PageSize: 1000
        });
        
        if (（性能优化版 - 只统计前20个表）
 */
function getDataRankData() {
    try {
        // 只获取前20个表进行统计，避免性能问题
        var tablesResult = V8.FormEngine.GetTableData('diy_table', {
            _PageSize: 20,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (tablesResult.Code !== 1) {
            return {
                list: []
            };
        }
        
        var dataRankList = [];
        var tables = tablesResult.Data || [];
        
        // 遍历每个表统计数据量
        for (var i = 0; i < Math.min(tables.length, 10); i++) {
            try {
                var tableName = tables[i].Name;
                var tableDesc = tables[i].Description || tableName;
                var countResult = V8.FormEngine.GetTableData(tableName, {
                    _PageSize: 1
                });
                if (countResult.Code === 1) {
                    dataRankList.push({
                        tableName: tableName,
                        tableDesc: tableDesc,
                        count: countResult.DataCount || 0
                    });
                }
            } catch (e) {
                // 忽略单个表的错误
            }
        }
        
        // 排序
        dataRankList.sort(function(a, b) {
            return b.count - a.count;
        });
        
        return {
            list: dataRankList
/**
 * 获取服务器网络流量
 */
function getNetworkData() {
    try {
        var systemInfo = new V8.System.SystemInfo();
        var networkTraffic = systemInfo.GetNetworkTraffic();
        
        return {
            rxSpeedKBps: networkTraffic.RxSpeedKBps || 0,
            txSpeedKBps: networkTraffic.TxSpeedKBps || 0,
            rxSpeedMbps: networkTraffic.RxSpeedMbps || 0,
            txSpeedMbps: networkTraffic.TxSpeedMbps || 0,
            rxMBTotal: networkTraffic.RxMBTotal || 0,
            txMBTotal: networkTraffic.TxMBTotal || 0
        };
    } catch (ex) {
        return {
            rxSpeedKBps: 0,
            txSpeedKBps: 0,
            rxSpeedMbps: 0,
            txSpeedMbps: 0,
            rxMBTotal: 0,
            txMBTotal: 0,
            error: ex.message
        };
    }
}

/**
 * 获取磁盘IO
 */
function getDiskIOData() {
    try {
        var systemInfo = new V8.System.SystemInfo();
        var diskIO = systemInfo.GetDiskIO();
        
        return {
            readSpeedKBps: diskIO.ReadSpeedKBps || 0,
            writeSpeedKBps: diskIO.WriteSpeedKBps || 0,
            diskStats: diskIO.DiskStats || []
        };
    } catch (ex) {
        return {
            readSpeedKBps: 0,
            writeSpeedKBps: 0,
            diskStats: [],
            error: ex.message
        };
    }
}

/**
 * 获取个人备忘录
 */
function getMemoData() {
    try {
        var currentUserId = V8.CurrentUserId;
        
        var memoResult = V8.FormEngine.GetTableData('diy_user_memo', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['IsDeleted', '=', false]
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (memoResult.Code !== 1) {
            return {
                list: []
            };
        }
        
        return {
            list: memoResult.Data || []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取所有数据
 */
function getAllData() {
    return {
        todo: getTodoData(),
        workflow: getWorkflowData(),
        notice: getNoticeData(),
        modules: getModulesData(),
        calendar: getCalendarData(),
        systemInfo: getSystemInfo(),
        performance: getPerformanceData(),
        statistics: getStatisticsData(),
        loginLogs: getLoginLogsData(),
        apiRank: getApiRankData(),
        dataRank: getDataRankData(),
        network: getNetworkData(),
        diskIO: getDiskIOData(),
        memo: getMemoData()
    };
}
