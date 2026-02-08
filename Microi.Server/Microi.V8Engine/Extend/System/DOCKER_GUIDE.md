# Docker 环境部署和测试指南

## 概述

SystemInfo 类已经针对 Docker 容器环境进行了优化，可以准确获取容器内的硬件资源使用情况。

## Docker 环境特性

### 自动检测 Docker 环境
代码会自动检测是否运行在 Docker 容器中，通过以下方式：
1. 检查 `/.dockerenv` 文件是否存在
2. 检查 `/proc/1/cgroup` 文件内容是否包含 "docker"

### 资源隔离支持
- **CPU**：准确反映容器的 CPU 使用率
- **内存**：显示容器可见的内存限制和使用情况
- **磁盘**：显示容器内挂载的磁盘分区
- **网络**：统计容器网络接口的流量（排除 lo 接口）

## 在 Docker 中部署

### 1. Dockerfile 示例

如果你的 Microi.Server 项目已经有 Dockerfile，确保包含必要的系统工具：

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# 安装系统监控必要的工具（可选，代码直接读取 /proc 和 /sys）
# RUN apt-get update && apt-get install -y procps

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["Microi.Server/", "./"]
RUN dotnet restore
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Microi.net.dll"]
```

### 2. docker-compose.yml 配置

```yaml
version: '3.8'

services:
  microi-server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: microi-server
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
    # 资源限制（可选）
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    restart: unless-stopped
```

### 3. 启动容器

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f microi-server

# 进入容器
docker exec -it microi-server /bin/bash
```

## 测试系统信息获取

### 方法 1：通过 V8 脚本测试

在 Microi.net 管理界面中创建一个 V8 脚本：

```javascript
var systemInfo = new V8.System.SystemInfo();

// 获取所有信息
var allInfo = systemInfo.GetAllSystemInfo();
console.log(JSON.stringify(allInfo, null, 2));

// 返回结果
return allInfo;
```

### 方法 2：创建监控脚本

创建一个持续监控的脚本：

```javascript
// 系统资源监控脚本
var systemInfo = new V8.System.SystemInfo();

function monitorSystem() {
    var info = {
        timestamp: new Date().toISOString(),
        os: systemInfo.GetOSInfo(),
        resources: systemInfo.GetCpuMemoryInfo(),
        disk: systemInfo.GetDiskInfo(),
        network: systemInfo.GetNetworkTraffic(),
        diskIO: systemInfo.GetDiskIO()
    };
    
    // 检查告警阈值
    var alerts = [];
    
    if (info.resources.CpuUsagePercent > 80) {
        alerts.push("CPU 使用率超过 80%: " + info.resources.CpuUsagePercent + "%");
    }
    
    if (info.resources.MemoryUsagePercent > 90) {
        alerts.push("内存使用率超过 90%: " + info.resources.MemoryUsagePercent + "%");
    }
    
    // 检查磁盘使用率
    if (info.disk.Disks && info.disk.Disks.length > 0) {
        info.disk.Disks.forEach(function(disk) {
            if (disk.UsagePercent > 85) {
                alerts.push("磁盘 " + disk.MountPoint + " 使用率超过 85%: " + disk.UsagePercent + "%");
            }
        });
    }
    
    info.alerts = alerts;
    
    // 记录日志或保存到数据库
    console.log("系统监控:", JSON.stringify(info, null, 2));
    
    return info;
}

// 执行监控
var result = monitorSystem();
return result;
```

### 方法 3：定时监控任务

创建一个定时任务，每分钟执行一次监控：

```javascript
// 使用 Microi.net 的定时任务功能
// 在定时任务中每分钟调用此脚本

var systemInfo = new V8.System.SystemInfo();
var data = {
    time: new Date().toISOString(),
    cpu: 0,
    memory: 0,
    diskUsage: 0
};

try {
    var cpuMem = systemInfo.GetCpuMemoryInfo();
    if (cpuMem.Success) {
        data.cpu = cpuMem.CpuUsagePercent;
        data.memory = cpuMem.MemoryUsagePercent;
    }
    
    var disk = systemInfo.GetDiskInfo();
    if (disk.Success && disk.Disks && disk.Disks.length > 0) {
        // 获取根分区使用率
        var rootDisk = disk.Disks.find(function(d) { 
            return d.MountPoint === '/'; 
        });
        if (rootDisk) {
            data.diskUsage = rootDisk.UsagePercent;
        }
    }
    
    // 保存监控数据到数据库
    // var result = V8.ORM.Insert("sys_monitor_log", data);
    
    console.log("监控数据已记录:", JSON.stringify(data));
    
} catch (e) {
    console.error("监控失败:", e.message);
}

return data;
```

## 验证容器内的准确性

### 在容器内手动验证

```bash
# 进入容器
docker exec -it microi-server /bin/bash

# 查看 CPU 信息
cat /proc/cpuinfo | grep processor | wc -l

# 查看内存信息
cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable'

# 查看磁盘信息
df -h

# 查看网络流量
cat /sys/class/net/eth0/statistics/rx_bytes
cat /sys/class/net/eth0/statistics/tx_bytes

# 查看磁盘 IO
cat /proc/diskstats

# 检查是否在 Docker 中
ls -la /.dockerenv
cat /proc/1/cgroup | grep docker
```

### 对比验证结果

1. 通过 V8 脚本获取系统信息
2. 在容器内执行上述命令手动获取信息
3. 对比两者结果是否一致

## 性能优化建议

### 1. 监控频率
```javascript
// 不同指标使用不同的监控频率

// 高频监控（每秒）：CPU、内存
// 适用于实时性能监控

// 中频监控（每 5-10 秒）：网络流量、磁盘 IO
// 适用于流量统计

// 低频监控（每分钟）：磁盘使用率
// 磁盘空间变化较慢
```

### 2. 资源限制感知
```javascript
// Docker 资源限制检查
var osInfo = systemInfo.GetOSInfo();

if (osInfo.IsDocker) {
    console.log("运行在 Docker 容器中");
    
    // 获取容器的 CPU 和内存限制
    // 注意：CPU 和内存数据已经是容器可见的范围
    var cpuMem = systemInfo.GetCpuMemoryInfo();
    
    console.log("容器可见处理器数:", osInfo.ProcessorCount);
    console.log("容器可见内存:", cpuMem.MemoryTotalMB + " MB");
}
```

### 3. 错误处理
```javascript
// 始终检查 Success 字段
var info = systemInfo.GetCpuMemoryInfo();

if (!info.Success) {
    console.error("获取信息失败:", info.Error);
    // 进行错误处理或告警
} else {
    // 正常处理数据
    console.log("CPU 使用率:", info.CpuUsagePercent + "%");
}
```

## 常见问题

### Q1: 为什么第一次调用网络流量和磁盘 IO 没有速率信息？
A: 速率需要通过两次采样计算差值得出，第一次调用只能获取累计值。建议：
- 首次调用后等待 1-5 秒再次调用
- 使用定时任务持续监控

### Q2: CPU 使用率是容器的还是宿主机的？
A: 是容器的 CPU 使用率。代码通过 `/proc/stat` 获取数据，这在容器内反映的是容器自身的 CPU 使用情况。

### Q3: 内存信息是否受容器限制影响？
A: 是的。在有内存限制的容器中，`/proc/meminfo` 显示的是容器可见的内存量，而不是宿主机的总内存。

### Q4: 如何获取容器的资源限制配置？
A: 可以读取 cgroup 信息：
```bash
# 内存限制
cat /sys/fs/cgroup/memory/memory.limit_in_bytes

# CPU 限制
cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us
cat /sys/fs/cgroup/cpu/cpu.cfs_period_us
```

## 监控数据可视化

建议在 Microi.net 中创建监控大屏，实时显示：
- CPU 使用率折线图
- 内存使用率仪表盘
- 磁盘使用情况饼图
- 网络流量趋势图
- 磁盘 IO 趋势图

## 告警集成

可以结合 Microi.net 的消息推送功能，在资源使用超过阈值时：
- 发送邮件通知
- 推送微信消息
- 记录告警日志
- 触发自动扩容（如果使用 Kubernetes）
