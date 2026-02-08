# SystemInfo - Docker 环境系统硬件信息获取

## 功能说明

这是一个为 Microi.net V8Engine 扩展的系统硬件信息获取类，专门优化支持 Docker 容器环境。可以获取以下信息：

### 1. 操作系统信息
- 平台类型、版本
- 是否64位系统
- 机器名称
- 处理器数量
- Linux 发行版信息
- 内核版本
- 是否运行在 Docker 容器中

### 2. CPU 和内存信息
- CPU 使用率百分比
- 内存总量、已用、空闲、可用
- 内存使用率百分比

### 3. 磁盘信息
- 各个磁盘分区的总容量、已用、空闲空间
- 磁盘使用率百分比

### 4. 网络流量信息
- 网络总接收字节数、总发送字节数
- 实时上下行速度（KB/s 和 Mbps）
- **注意：需要至少调用两次才能计算速率**

### 5. 磁盘 IO 信息
- 各磁盘设备的总读写字节数
- 实时读写速度（KB/s）
- **注意：需要至少调用两次才能计算速率**

## 使用方法

在 V8 JavaScript 脚本中调用：

### 获取操作系统信息
```javascript
var systemInfo = new V8.System.SystemInfo();
var osInfo = systemInfo.GetOSInfo();
console.log(JSON.stringify(osInfo, null, 2));
```

输出示例：
```json
{
  "Platform": "Unix",
  "OSVersion": "Unix 5.15.0.1052",
  "Is64Bit": true,
  "MachineName": "docker-container",
  "ProcessorCount": 4,
  "SystemPageSize": 4096,
  "RuntimeVersion": ".NET 6.0.0",
  "DistributionName": "Ubuntu 22.04.3 LTS",
  "DistributionVersion": "22.04.3 LTS (Jammy Jellyfish)",
  "KernelVersion": "5.15.0-1052-generic",
  "IsDocker": true,
  "Success": true
}
```

### 获取 CPU 和内存信息
```javascript
var systemInfo = new V8.System.SystemInfo();
var cpuMemInfo = systemInfo.GetCpuMemoryInfo();
console.log(JSON.stringify(cpuMemInfo, null, 2));
```

输出示例：
```json
{
  "CpuUsagePercent": 15.32,
  "MemoryTotal": 8589934592,
  "MemoryUsed": 4294967296,
  "MemoryFree": 2147483648,
  "MemoryAvailable": 3221225472,
  "MemoryUsagePercent": 50.00,
  "MemoryTotalMB": 8192.00,
  "MemoryUsedMB": 4096.00,
  "MemoryFreeMB": 2048.00,
  "Success": true
}
```

### 获取磁盘信息
```javascript
var systemInfo = new V8.System.SystemInfo();
var diskInfo = systemInfo.GetDiskInfo();
console.log(JSON.stringify(diskInfo, null, 2));
```

输出示例：
```json
{
  "Disks": [
    {
      "Filesystem": "/dev/sda1",
      "MountPoint": "/",
      "TotalGB": 100.00,
      "UsedGB": 45.50,
      "FreeGB": 54.50,
      "UsagePercent": 45.50
    }
  ],
  "Success": true
}
```

### 获取网络流量信息
```javascript
var systemInfo = new V8.System.SystemInfo();

// 第一次调用
var netInfo1 = systemInfo.GetNetworkTraffic();
console.log("第一次调用:", JSON.stringify(netInfo1, null, 2));

// 等待一段时间后再次调用，可以获取速率
setTimeout(function() {
  var netInfo2 = systemInfo.GetNetworkTraffic();
  console.log("第二次调用（含速率）:", JSON.stringify(netInfo2, null, 2));
}, 2000);
```

输出示例：
```json
{
  "RxBytesTotal": 1073741824,
  "TxBytesTotal": 536870912,
  "RxMBTotal": 1024.00,
  "TxMBTotal": 512.00,
  "RxSpeedKBps": 256.50,
  "TxSpeedKBps": 128.25,
  "RxSpeedMbps": 2.05,
  "TxSpeedMbps": 1.03,
  "Success": true
}
```

### 获取磁盘 IO 信息
```javascript
var systemInfo = new V8.System.SystemInfo();

// 第一次调用
var ioInfo1 = systemInfo.GetDiskIO();
console.log("第一次调用:", JSON.stringify(ioInfo1, null, 2));

// 等待一段时间后再次调用，可以获取速率
setTimeout(function() {
  var ioInfo2 = systemInfo.GetDiskIO();
  console.log("第二次调用（含速率）:", JSON.stringify(ioInfo2, null, 2));
}, 2000);
```

输出示例：
```json
{
  "DiskStats": [
    {
      "Device": "sda",
      "ReadBytesTotal": 10737418240,
      "WriteBytesTotal": 5368709120,
      "ReadMBTotal": 10240.00,
      "WriteMBTotal": 5120.00
    }
  ],
  "ReadSpeedKBps": 1024.50,
  "WriteSpeedKBps": 512.25,
  "Success": true
}
```

### 获取所有系统信息（推荐）
```javascript
var systemInfo = new V8.System.SystemInfo();
var allInfo = systemInfo.GetAllSystemInfo();
console.log(JSON.stringify(allInfo, null, 2));
```

## Docker 环境特别说明

1. **容器检测**：代码会自动检测是否运行在 Docker 容器中
2. **资源限制**：在 Docker 中，某些资源信息（如 CPU、内存）可能受到容器资源限制的影响
3. **网络接口**：会自动排除 loopback (lo) 接口，只统计实际网络接口的流量
4. **磁盘挂载**：只显示实际挂载的磁盘分区，会过滤掉虚拟文件系统

## 性能建议

1. **流量和 IO 监控**：需要定期调用（建议间隔 1-5 秒）才能获取准确的速率信息
2. **CPU 监控**：内部会等待 100ms 来计算 CPU 使用率
3. **批量获取**：如果需要多个指标，建议使用 `GetAllSystemInfo()` 一次性获取所有信息

## 错误处理

所有方法都会返回包含 `Success` 字段的 JSON 对象：
- `Success: true` - 操作成功
- `Success: false` - 操作失败，会包含 `Error` 和 `StackTrace` 字段

## 平台支持

- ✅ Linux (完整支持)
- ✅ Docker 容器 (完整支持)
- ⚠️ Windows (基础支持，部分功能受限)
- ⚠️ macOS (基础支持，部分功能受限)

## 技术实现

- 通过读取 `/proc` 文件系统获取 Linux 系统信息
- 使用 `/sys/class/net` 获取网络统计信息
- 使用 `/proc/diskstats` 获取磁盘 IO 统计
- 支持 PerformanceCounter 获取 Windows 平台信息
