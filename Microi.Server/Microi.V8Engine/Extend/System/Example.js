// SystemInfo 测试示例
// 此脚本演示如何在 V8 引擎中使用 SystemInfo 类获取系统硬件信息

// 创建 SystemInfo 实例
var systemInfo = new V8.System.SystemInfo();

console.log("========================================");
console.log("系统硬件信息监控测试");
console.log("========================================\n");

// 1. 获取操作系统信息
console.log("1. 操作系统信息:");
console.log("----------------------------------------");
var osInfo = systemInfo.GetOSInfo();
console.log(JSON.stringify(osInfo, null, 2));
console.log("\n");

// 2. 获取 CPU 和内存信息
console.log("2. CPU 和内存信息:");
console.log("----------------------------------------");
var cpuMemInfo = systemInfo.GetCpuMemoryInfo();
console.log(JSON.stringify(cpuMemInfo, null, 2));
console.log("\n");

// 3. 获取磁盘信息
console.log("3. 磁盘使用信息:");
console.log("----------------------------------------");
var diskInfo = systemInfo.GetDiskInfo();
console.log(JSON.stringify(diskInfo, null, 2));
console.log("\n");

// 4. 获取网络流量信息（第一次调用）
console.log("4. 网络流量信息（第一次调用 - 仅总量）:");
console.log("----------------------------------------");
var netInfo1 = systemInfo.GetNetworkTraffic();
console.log(JSON.stringify(netInfo1, null, 2));
console.log("\n");

// 5. 获取磁盘 IO 信息（第一次调用）
console.log("5. 磁盘 IO 信息（第一次调用 - 仅总量）:");
console.log("----------------------------------------");
var ioInfo1 = systemInfo.GetDiskIO();
console.log(JSON.stringify(ioInfo1, null, 2));
console.log("\n");

// 等待 2 秒后再次调用，以获取速率信息
console.log("等待 2 秒后再次获取网络和磁盘 IO 信息...\n");

// 注意：在实际的 V8 引擎中，可能需要使用适当的异步方式
// 这里使用伪代码表示延迟执行
// setTimeout(function() {
    
//     console.log("6. 网络流量信息（第二次调用 - 包含速率）:");
//     console.log("----------------------------------------");
//     var netInfo2 = systemInfo.GetNetworkTraffic();
//     console.log(JSON.stringify(netInfo2, null, 2));
//     console.log("\n");

//     console.log("7. 磁盘 IO 信息（第二次调用 - 包含速率）:");
//     console.log("----------------------------------------");
//     var ioInfo2 = systemInfo.GetDiskIO();
//     console.log(JSON.stringify(ioInfo2, null, 2));
//     console.log("\n");

// }, 2000);

// 8. 一次性获取所有信息
console.log("8. 获取所有系统信息（综合）:");
console.log("----------------------------------------");
var allInfo = systemInfo.GetAllSystemInfo();
console.log(JSON.stringify(allInfo, null, 2));
console.log("\n");

console.log("========================================");
console.log("测试完成");
console.log("========================================");

// 实际应用示例：监控 CPU 和内存使用率
function monitorResources() {
    var cpuMem = systemInfo.GetCpuMemoryInfo();
    
    if (cpuMem.Success) {
        console.log("CPU 使用率: " + cpuMem.CpuUsagePercent + "%");
        console.log("内存使用率: " + cpuMem.MemoryUsagePercent + "%");
        console.log("内存使用: " + cpuMem.MemoryUsedMB + " MB / " + cpuMem.MemoryTotalMB + " MB");
        
        // 可以根据阈值发出警报
        if (cpuMem.CpuUsagePercent > 80) {
            console.log("警告：CPU 使用率过高！");
        }
        if (cpuMem.MemoryUsagePercent > 90) {
            console.log("警告：内存使用率过高！");
        }
    }
}

// 调用监控函数
console.log("\n资源监控示例:");
console.log("----------------------------------------");
monitorResources();
