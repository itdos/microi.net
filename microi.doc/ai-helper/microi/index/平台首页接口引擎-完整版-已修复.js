/**
 * Microi吾码 - 平台首页数据接口引擎（完整版-已修复）
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
 * - systeminfo: 系统信息（操作系统、版本号等）
 * - performance: 性能指标（CPU/内存/硬盘）
 * - statistics: 数据统计（表单数/模块数等）
 * - loginlogs: 最近登录用户
 * - apirank: 接口调用频率排行
 * - datarank: 表单数据量排行
 * - network: 网络流量
 * - memo: 个人备忘录
 * - all: 获取所有数据
 */

try {
    // 获取请求参数
    var type = V8.Param.type || 'statistics';
    
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
        case 'memo':
            resultData = getMemoData();
            break;
        case 'all':
            resultData = getAllData();
            break;
        default:
            // 默认只返回统计数据，避免超时
            resultData = getStatisticsData();
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
        var currentUserId = V8.CurrentUserId;
        
        // 查询待办事项
        var todoResult = V8.FormEngine.GetTableData('diy_workflow_todo', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['Status', '=', '待处理']
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        return {
            total: todoResult.Code === 1 ? (todoResult.DataCount || 0) : 0,
            list: todoResult.Code === 1 ? (todoResult.Data || []) : []
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
        
        var workflowResult = V8.FormEngine.GetTableData('diy_workflow', {
            _Where: [
                ['CreateUserId', '=', currentUserId]
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        return {
            total: workflowResult.Code === 1 ? (workflowResult.DataCount || 0) : 0,
            list: workflowResult.Code === 1 ? (workflowResult.Data || []) : []
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
        var noticeResult = V8.FormEngine.GetTableData('diy_notice', {
            _Where: [
                ['Status', '=', '已发布']
            ],
            _PageSize: 5,
            _OrderBy: 'PublishTime',
            _OrderByType: 'DESC'
        });
        
        return {
            total: noticeResult.Code === 1 ? (noticeResult.DataCount || 0) : 0,
            list: noticeResult.Code === 1 ? (noticeResult.Data || []) : []
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
        
        var modulesResult = V8.FormEngine.GetTableData('diy_user_favorite', {
            _Where: [
                ['UserId', '=', currentUserId],
                ['Type', '=', '模块']
            ],
            _PageSize: 8,
            _OrderBy: 'UseCount',
            _OrderByType: 'DESC'
        });
        
        return {
            list: modulesResult.Code === 1 ? (modulesResult.Data || []) : []
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
    var osInfo = {
        Platform: 'Unknown',
        OSVersion: 'Unknown',
        MachineName: 'Unknown',
        ProcessorCount: 0
    };
    
    var versionInfo = {
        frontendVersion: '3.0.0',
        backendVersion: '3.0.2',
        edition: '开源版'
    };
    
    // 尝试获取OS信息
    try {
        var systemInfo = new V8.System.SystemInfo();
        var sysInfo = systemInfo.GetOSInfo();
        if (sysInfo && sysInfo.Success !== false) {
            osInfo = sysInfo;
        }
    } catch(e) {
        // 如果V8.System不可用，尝试使用System
        try {
            osInfo.Platform = System.Environment.OSVersion.Platform.ToString();
            osInfo.OSVersion = System.Environment.OSVersion.VersionString;
            osInfo.MachineName = System.Environment.MachineName;
            osInfo.ProcessorCount = System.Environment.ProcessorCount;
        } catch(e2) {
            // 使用默认值
        }
    }
    
    // 获取版本信息
    try {
        var versionResult = V8.FormEngine.GetFormData('diy_system_config', {
            _Where: [['ConfigKey', '=', 'SystemVersion']]
        });
        if (versionResult.Code === 1 && versionResult.Data) {
            var configValue = JSON.parse(versionResult.Data.ConfigValue || '{}');
            versionInfo.frontendVersion = configValue.FrontendVersion || versionInfo.frontendVersion;
            versionInfo.backendVersion = configValue.BackendVersion || versionInfo.backendVersion;
            versionInfo.edition = configValue.Edition || versionInfo.edition;
        }
    } catch(e) {
        // 使用默认值
    }
    
    return {
        os: osInfo,
        version: versionInfo
    };
}

/**
 * 获取性能数据
 */
function getPerformanceData() {
    var cpu = 0;
    var memory = 0;
    var disk = 0; // 改为单个数值，与界面引擎匹配
    
    try {
        var systemInfo = new V8.System.SystemInfo();
        
        // 获取CPU和内存信息
        try {
            var cpuMemInfo = systemInfo.GetCpuMemoryInfo();
            if (cpuMemInfo && cpuMemInfo.Success !== false) {
                cpu = cpuMemInfo.CpuUsagePercent || 0;
                memory = cpuMemInfo.MemoryUsagePercent || 0;
            }
        } catch(e) {
            // 忽略错误
        }
        
        // 获取磁盘信息 - 只返回第一个磁盘的使用率
        try {
            var diskInfo = systemInfo.GetDiskInfo();
            if (diskInfo && diskInfo.Success !== false && diskInfo.Disks && diskInfo.Disks.length > 0) {
                disk = diskInfo.Disks[0].UsagePercent || 0;
            }
        } catch(e) {
            // 忽略错误
        }
    } catch(e) {
        // V8.System不可用
    }
    
    return {
        cpu: cpu,
        memory: memory,
        disk: disk
    };
}

/**
 * 获取统计数据
 */
function getStatisticsData() {
    var formCount = 0;
    var moduleCount = 0;
    var apiEngineCount = 0;
    var userCount = 0;
    
    // 表单数
    try {
        var formCountResult = V8.FormEngine.GetTableData('diy_table', { _PageSize: 1 });
        formCount = formCountResult.Code === 1 ? (formCountResult.DataCount || 0) : 0;
    } catch(e) { }
    
    // 模块数
    try {
        var moduleCountResult = V8.FormEngine.GetTableData('sys_menu', { _PageSize: 1 });
        moduleCount = moduleCountResult.Code === 1 ? (moduleCountResult.DataCount || 0) : 0;
    } catch(e) { }
    
    // 接口引擎数
    try {
        var apiCountResult = V8.FormEngine.GetTableData('diy_apiengine', { _PageSize: 1 });
        apiEngineCount = apiCountResult.Code === 1 ? (apiCountResult.DataCount || 0) : 0;
    } catch(e) { }
    
    // 用户数
    try {
        var userCountResult = V8.FormEngine.GetTableData('sys_user', { _PageSize: 1 });
        userCount = userCountResult.Code === 1 ? (userCountResult.DataCount || 0) : 0;
    } catch(e) { }
    
    return {
        formCount: formCount,
        moduleCount: moduleCount,
        apiEngineCount: apiEngineCount,
        userCount: userCount
    };
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
        
        return {
            list: loginLogsResult.Code === 1 ? (loginLogsResult.Data || []) : []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取接口调用频率排行（优化版）
 */
function getApiRankData() {
    try {
        // 只查询最近500条记录
        var apiRankResult = V8.FormEngine.GetTableData('diy_api_request_log', {
            _PageSize: 500,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (apiRankResult.Code !== 1) {
            return { list: [] };
        }
        
        // 统计每个接口的调用次数
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
 * 获取表单数据量排行（优化版）
 */
function getDataRankData() {
    try {
        // 只获取前20个表
        var tablesResult = V8.FormEngine.GetTableData('diy_table', {
            _PageSize: 20,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        if (tablesResult.Code !== 1) {
            return { list: [] };
        }
        
        var dataRankList = [];
        var tables = tablesResult.Data || [];
        
        // 只统计前10个表
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
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}

/**
 * 获取所有数据（轻量版，移除耗时操作）
 */
function getAllData() {
    return {
        todo: getTodoData(),
        workflow: getWorkflowData(),
        notice: getNoticeData(),
        modules: getModulesData(),
        systemInfo: getSystemInfo(),
        performance: getPerformanceData(),
        statistics: getStatisticsData(),
        loginLogs: getLoginLogsData()
        // 移除耗时的排行查询，需要时单独调用
        // apiRank: getApiRankData(),
        // dataRank: getDataRankData()
    };
}

/**
 * 获取网络流量数据
 */
function getNetworkData() {
    try {
        var systemInfo = new V8.System.SystemInfo();
        var networkInfo = systemInfo.GetNetworkTraffic();
        
        if (networkInfo && networkInfo.Success !== false) {
            return {
                upload: networkInfo.BytesSent || 0,
                download: networkInfo.BytesReceived || 0,
                uploadSpeed: networkInfo.SendSpeed || 0,
                downloadSpeed: networkInfo.ReceiveSpeed || 0
            };
        }
    } catch(e) {
        // 忽略错误
    }
    
    return {
        upload: 0,
        download: 0,
        uploadSpeed: 0,
        downloadSpeed: 0
    };
}

/**
 * 获取个人备忘录
 */
function getMemoData() {
    try {
        var currentUserId = V8.CurrentUserId;
        
        var memoResult = V8.FormEngine.GetTableData('diy_user_memo', {
            _Where: [
                ['UserId', '=', currentUserId]
            ],
            _PageSize: 10,
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC'
        });
        
        return {
            list: memoResult.Code === 1 ? (memoResult.Data || []) : []
        };
    } catch (ex) {
        return {
            list: [],
            error: ex.message
        };
    }
}
