# SystemInfo 快速入门

## 5 分钟快速上手

### 第一步：验证部署

在 Microi.net V8 脚本编辑器中运行：

```javascript
// 测试 SystemInfo 是否可用
try {
    var systemInfo = new V8.System.SystemInfo();
    console.log("✓ SystemInfo 已成功加载");
    return { success: true, message: "SystemInfo 可用" };
} catch (e) {
    console.log("✗ SystemInfo 加载失败:", e.message);
    return { success: false, error: e.message };
}
```

### 第二步：查看系统概览

```javascript
var systemInfo = new V8.System.SystemInfo();

// 获取基本信息
var os = systemInfo.GetOSInfo();
var resources = systemInfo.GetCpuMemoryInfo();

// 输出摘要
var summary = {
    系统: os.DistributionName || os.OSVersion,
    是否Docker: os.IsDocker,
    CPU数量: os.ProcessorCount,
    CPU使用率: resources.CpuUsagePercent + "%",
    内存使用率: resources.MemoryUsagePercent + "%",
    总内存: resources.MemoryTotalMB + " MB"
};

console.log("系统概览:", JSON.stringify(summary, null, 2));
return summary;
```

### 第三步：监控资源使用

创建一个定时任务（每分钟执行）：

```javascript
var systemInfo = new V8.System.SystemInfo();

// 获取关键指标
var metrics = {
    timestamp: new Date().toISOString(),
    cpu: 0,
    memory: 0,
    disk: 0
};

try {
    var cpuMem = systemInfo.GetCpuMemoryInfo();
    if (cpuMem.Success) {
        metrics.cpu = Math.round(cpuMem.CpuUsagePercent * 100) / 100;
        metrics.memory = Math.round(cpuMem.MemoryUsagePercent * 100) / 100;
    }
    
    var disk = systemInfo.GetDiskInfo();
    if (disk.Success && disk.Disks && disk.Disks.length > 0) {
        var rootDisk = disk.Disks.find(d => d.MountPoint === '/');
        if (rootDisk) {
            metrics.disk = Math.round(rootDisk.UsagePercent * 100) / 100;
        }
    }
    
    // 保存到数据库（根据你的 ORM 配置）
    // V8.ORM.Insert("sys_monitor", metrics);
    
    // 或直接记录日志
    console.log("监控数据:", JSON.stringify(metrics));
    
    return metrics;
    
} catch (e) {
    console.error("监控失败:", e.message);
    return { error: e.message };
}
```

### 第四步：设置告警

```javascript
var systemInfo = new V8.System.SystemInfo();

// 告警阈值配置
var thresholds = {
    cpu: 80,      // CPU 使用率超过 80%
    memory: 90,   // 内存使用率超过 90%
    disk: 85      // 磁盘使用率超过 85%
};

var alerts = [];

try {
    // 检查 CPU 和内存
    var cpuMem = systemInfo.GetCpuMemoryInfo();
    if (cpuMem.Success) {
        if (cpuMem.CpuUsagePercent > thresholds.cpu) {
            alerts.push({
                type: "CPU",
                value: cpuMem.CpuUsagePercent,
                threshold: thresholds.cpu,
                message: "CPU 使用率过高: " + cpuMem.CpuUsagePercent.toFixed(2) + "%"
            });
        }
        
        if (cpuMem.MemoryUsagePercent > thresholds.memory) {
            alerts.push({
                type: "内存",
                value: cpuMem.MemoryUsagePercent,
                threshold: thresholds.memory,
                message: "内存使用率过高: " + cpuMem.MemoryUsagePercent.toFixed(2) + "%"
            });
        }
    }
    
    // 检查磁盘
    var disk = systemInfo.GetDiskInfo();
    if (disk.Success && disk.Disks) {
        disk.Disks.forEach(function(d) {
            if (d.UsagePercent > thresholds.disk) {
                alerts.push({
                    type: "磁盘",
                    partition: d.MountPoint,
                    value: d.UsagePercent,
                    threshold: thresholds.disk,
                    message: "磁盘 " + d.MountPoint + " 使用率过高: " + d.UsagePercent.toFixed(2) + "%"
                });
            }
        });
    }
    
    // 如果有告警，发送通知
    if (alerts.length > 0) {
        alerts.forEach(function(alert) {
            console.warn("⚠️", alert.message);
            
            // 发送邮件/微信/钉钉通知
            // V8.WeChat.SendMessage(...);
            // V8.Mail.Send(...);
        });
    } else {
        console.log("✓ 系统资源使用正常");
    }
    
    return {
        alertCount: alerts.length,
        alerts: alerts
    };
    
} catch (e) {
    console.error("告警检查失败:", e.message);
    return { error: e.message };
}
```

### 第五步：创建监控大屏

将以下数据接口集成到前端监控页面：

```javascript
// 创建一个 API 接口，返回实时监控数据
var systemInfo = new V8.System.SystemInfo();

function getMonitoringData() {
    var data = {
        updateTime: new Date().toISOString()
    };
    
    try {
        // 系统信息
        var os = systemInfo.GetOSInfo();
        data.system = {
            name: os.DistributionName || os.OSVersion,
            isDocker: os.IsDocker,
            processorCount: os.ProcessorCount
        };
        
        // CPU 和内存
        var cpuMem = systemInfo.GetCpuMemoryInfo();
        if (cpuMem.Success) {
            data.cpu = {
                usage: Math.round(cpuMem.CpuUsagePercent * 100) / 100
            };
            data.memory = {
                total: Math.round(cpuMem.MemoryTotalMB),
                used: Math.round(cpuMem.MemoryUsedMB),
                usage: Math.round(cpuMem.MemoryUsagePercent * 100) / 100
            };
        }
        
        // 磁盘
        var disk = systemInfo.GetDiskInfo();
        if (disk.Success && disk.Disks) {
            data.disks = disk.Disks.map(function(d) {
                return {
                    name: d.MountPoint,
                    total: d.TotalGB,
                    used: d.UsedGB,
                    usage: Math.round(d.UsagePercent * 100) / 100
                };
            });
        }
        
        // 网络流量
        var network = systemInfo.GetNetworkTraffic();
        if (network.Success) {
            data.network = {
                rxTotal: network.RxMBTotal,
                txTotal: network.TxMBTotal,
                rxSpeed: network.RxSpeedKBps || 0,
                txSpeed: network.TxSpeedKBps || 0
            };
        }
        
        return data;
        
    } catch (e) {
        return { error: e.message };
    }
}

// 返回监控数据
return getMonitoringData();
```

## 常用命令速查

### 获取操作系统信息
```javascript
var os = new V8.System.SystemInfo().GetOSInfo();
```

### 获取 CPU 使用率
```javascript
var cpu = new V8.System.SystemInfo().GetCpuMemoryInfo().CpuUsagePercent;
```

### 获取内存使用率
```javascript
var mem = new V8.System.SystemInfo().GetCpuMemoryInfo().MemoryUsagePercent;
```

### 获取磁盘使用情况
```javascript
var disks = new V8.System.SystemInfo().GetDiskInfo().Disks;
```

### 获取网络流量
```javascript
var net = new V8.System.SystemInfo().GetNetworkTraffic();
```

### 一次性获取所有信息
```javascript
var all = new V8.System.SystemInfo().GetAllSystemInfo();
```

## 实用脚本模板

### 1. 简单的性能报告
```javascript
var systemInfo = new V8.System.SystemInfo();
var data = systemInfo.GetAllSystemInfo();

var report = 
    "=== 系统性能报告 ===\n" +
    "时间: " + data.Timestamp + "\n" +
    "CPU 使用率: " + data.CpuMemory.CpuUsagePercent + "%\n" +
    "内存使用率: " + data.CpuMemory.MemoryUsagePercent + "%\n" +
    "磁盘使用率: " + (data.Disk.Disks[0]?.UsagePercent || "N/A") + "%\n";

console.log(report);
return report;
```

### 2. 健康检查
```javascript
var systemInfo = new V8.System.SystemInfo();
var cpuMem = systemInfo.GetCpuMemoryInfo();

var health = {
    status: "healthy",
    checks: {
        cpu: cpuMem.CpuUsagePercent < 80,
        memory: cpuMem.MemoryUsagePercent < 90
    }
};

if (!health.checks.cpu || !health.checks.memory) {
    health.status = "unhealthy";
}

return health;
```

### 3. 定时监控（配合定时任务）
```javascript
var systemInfo = new V8.System.SystemInfo();
var timestamp = new Date().toISOString();

// 获取数据
var cpuMem = systemInfo.GetCpuMemoryInfo();
var disk = systemInfo.GetDiskInfo();

// 构建监控记录
var record = {
    time: timestamp,
    cpu: cpuMem.CpuUsagePercent,
    memory: cpuMem.MemoryUsagePercent,
    disk: disk.Disks[0]?.UsagePercent || 0
};

// 保存到数据库
// V8.ORM.Insert("monitor_log", record);

console.log("监控记录已保存:", JSON.stringify(record));
return record;
```

## 故障排查

### 问题：调用报错 "未找到 SystemInfo"
**解决**：
1. 确认项目已重新编译
2. 确认 Docker 容器已重启
3. 检查 V8Engine 版本

### 问题：网络流量和磁盘 IO 速率为 0
**解决**：需要调用两次才能计算速率
```javascript
var systemInfo = new V8.System.SystemInfo();
systemInfo.GetNetworkTraffic(); // 第一次调用
// 等待几秒
setTimeout(() => {
    var net = systemInfo.GetNetworkTraffic(); // 第二次调用会有速率
    console.log(net);
}, 2000);
```

### 问题：内存信息不准确（Windows）
**说明**：Windows 平台上内存信息是估算值，Linux/Docker 上是准确值

## 下一步

- 📖 阅读完整文档：[README.md](README.md)
- 🐳 Docker 部署：[DOCKER_GUIDE.md](DOCKER_GUIDE.md)
- 📝 查看更多示例：[Example.js](Example.js)
- 🧪 运行测试：使用 SystemInfoTests.cs

## 技术支持

如有问题，请查阅：
1. 项目文档
2. Microi.net 官方文档
3. GitHub Issues
