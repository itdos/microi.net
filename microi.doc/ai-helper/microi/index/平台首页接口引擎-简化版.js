/**
 * Microi吾码 - 平台首页数据接口引擎（简化高性能版）
 * 
 * 配置：
 * - 接口引擎Key：platform_dashboard_simple
 * - 自定义接口地址：/apiengine/platform-dashboard-simple
 * 
 * 调用方式：
 * GET/POST: /apiengine/platform-dashboard-simple?type=xxx
 * 
 * 支持的type参数：
 * - statistics: 数据统计（默认）
 * - performance: 性能指标
 * - systeminfo: 系统信息
 */

try {
    var type = V8.Param.type || 'statistics';
    var resultData = {};
    
    switch(type.toLowerCase()) {
        case 'statistics':
            resultData = getStatisticsData();
            break;
        case 'performance':
            resultData = getPerformanceData();
            break;
        case 'systeminfo':
            resultData = getSystemInfo();
            break;
        default:
            resultData = {
                statistics: getStatisticsData(),
                performance: getPerformanceData(),
                systemInfo: getSystemInfo()
            };
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
 * 获取统计数据
 */
function getStatisticsData() {
    try {
        var formCount = 0;
        var moduleCount = 0;
        var apiEngineCount = 0;
        var userCount = 0;
        
        // 表单数
        try {
            var formCountResult = V8.FormEngine.GetTableData('diy_table', { _PageSize: 1 });
            formCount = formCountResult.Code === 1 ? (formCountResult.DataCount || 0) : 0;
        } catch(e) { formCount = 0; }
        
        // 模块数
        try {
            var moduleCountResult = V8.FormEngine.GetTableData('sys_menu', { _PageSize: 1 });
            moduleCount = moduleCountResult.Code === 1 ? (moduleCountResult.DataCount || 0) : 0;
        } catch(e) { moduleCount = 0; }
        
        // 接口引擎数
        try {
            var apiCountResult = V8.FormEngine.GetTableData('diy_apiengine', { _PageSize: 1 });
            apiEngineCount = apiCountResult.Code === 1 ? (apiCountResult.DataCount || 0) : 0;
        } catch(e) { apiEngineCount = 0; }
        
        // 用户数
        try {
            var userCountResult = V8.FormEngine.GetTableData('sys_user', { _PageSize: 1 });
            userCount = userCountResult.Code === 1 ? (userCountResult.DataCount || 0) : 0;
        } catch(e) { userCount = 0; }
        
        return {
            formCount: formCount,
            moduleCount: moduleCount,
            apiEngineCount: apiEngineCount,
            userCount: userCount
        };
    } catch (ex) {
        return {
            formCount: 0,
            moduleCount: 0,
            apiEngineCount: 0,
            userCount: 0,
            error: ex.message
        };
    }
}

/**
 * 获取性能数据
 */
function getPerformanceData() {
    try {
        var cpu = 0;
        var memory = 0;
        var diskUsage = 0;
        
        try {
            var systemInfo = new V8.System.SystemInfo();
            var cpuMemInfo = systemInfo.GetCpuMemoryInfo();
            cpu = cpuMemInfo.CpuUsagePercent || 0;
            memory = cpuMemInfo.MemoryUsagePercent || 0;
            
            var diskInfo = systemInfo.GetDiskInfo();
            if (diskInfo.Disks && diskInfo.Disks.length > 0) {
                diskUsage = diskInfo.Disks[0].UsagePercent || 0;
            }
        } catch(e) {
            // V8.System不可用时返回默认值
        }
        
        return {
            cpu: cpu,
            memory: memory,
            disk: diskUsage
        };
    } catch (ex) {
        return {
            cpu: 0,
            memory: 0,
            disk: 0,
            error: ex.message
        };
    }
}

/**
 * 获取系统信息
 */
function getSystemInfo() {
    try {
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
        
        // 获取OS信息
        try {
            var systemInfo = new V8.System.SystemInfo();
            osInfo = systemInfo.GetOSInfo();
        } catch(e) {
            // 使用默认值
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
    } catch (ex) {
        return {
            os: {
                Platform: 'Unknown',
                OSVersion: 'Unknown'
            },
            version: {
                frontendVersion: '3.0.0',
                backendVersion: '3.0.2',
                edition: '开源版'
            },
            error: ex.message
        };
    }
}
