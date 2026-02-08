# SystemInfo 实现总结

## 已完成的工作

### 1. 文件结构
已在 `Microi.Server/Microi.V8Engine/Extend/System/` 目录下创建以下文件：

```
System/
├── SystemInfo.cs           # 主要实现类
├── SystemInfoTests.cs      # 单元测试类
├── README.md               # 使用说明文档
├── DOCKER_GUIDE.md         # Docker部署指南
└── Example.js              # JavaScript使用示例
```

### 2. 核心功能实现

#### SystemInfo.cs
实现了以下公共方法：

1. **GetOSInfo()** - 获取操作系统信息
   - 平台类型和版本
   - 处理器数量
   - Linux 发行版信息
   - 内核版本
   - Docker 容器检测

2. **GetCpuMemoryInfo()** - 获取 CPU 和内存信息
   - CPU 使用率百分比
   - 内存总量、已用、空闲、可用（字节和 MB）
   - 内存使用率百分比

3. **GetDiskInfo()** - 获取磁盘信息
   - 各分区的文件系统、挂载点
   - 总容量、已用、空闲空间（GB）
   - 使用率百分比

4. **GetNetworkTraffic()** - 获取网络流量
   - 总接收/发送字节数
   - 实时上下行速度（KB/s 和 Mbps）
   - 需要至少调用两次才能计算速率

5. **GetDiskIO()** - 获取磁盘 IO
   - 各磁盘设备的总读写字节数
   - 实时读写速度（KB/s）
   - 需要至少调用两次才能计算速率

6. **GetAllSystemInfo()** - 一次性获取所有信息
   - 包含上述所有信息的综合方法

### 3. Docker 环境优化

#### 自动检测
- 检查 `/.dockerenv` 文件
- 检查 `/proc/1/cgroup` 内容

#### Linux/Docker 实现方式
- **CPU**: 读取 `/proc/stat` 计算使用率
- **内存**: 读取 `/proc/meminfo` 获取详细信息
- **磁盘**: 执行 `df` 命令获取分区信息
- **网络**: 读取 `/sys/class/net/*/statistics/*` 获取流量
- **磁盘IO**: 读取 `/proc/diskstats` 获取 IO 统计

#### Windows 实现（基础支持）
- 使用 PerformanceCounter 获取性能指标
- 使用 DriveInfo 获取磁盘信息

### 4. 技术特点

#### 无外部依赖
- 不依赖外部命令行工具
- 直接读取 Linux 系统文件
- 仅依赖 .NET Standard 2.1 内置类型

#### 资源限制感知
- 在 Docker 容器中，所有数据都反映容器的视角
- 自动过滤虚拟文件系统和 loopback 接口
- 准确反映容器的资源使用情况

#### 性能优化
- CPU 监控：内部等待 100ms 采样
- 流量和 IO：使用静态变量缓存上次数据，计算增量
- 错误处理：所有方法都有完整的异常处理

### 5. 使用示例

#### V8 JavaScript 调用
```javascript
var systemInfo = new V8.System.SystemInfo();

// 获取所有信息
var allInfo = systemInfo.GetAllSystemInfo();
console.log(JSON.stringify(allInfo, null, 2));

// 单独获取 CPU 和内存
var cpuMem = systemInfo.GetCpuMemoryInfo();
console.log("CPU:", cpuMem.CpuUsagePercent + "%");
console.log("内存:", cpuMem.MemoryUsagePercent + "%");
```

#### 监控告警示例
```javascript
var systemInfo = new V8.System.SystemInfo();
var cpuMem = systemInfo.GetCpuMemoryInfo();

if (cpuMem.CpuUsagePercent > 80) {
    console.log("警告：CPU 使用率过高！");
    // 发送告警通知
}

if (cpuMem.MemoryUsagePercent > 90) {
    console.log("警告：内存使用率过高！");
    // 发送告警通知
}
```

### 6. 测试验证

#### 单元测试
提供了完整的测试类 `SystemInfoTests.cs`，包含：
- 所有公共方法的独立测试
- 网络和 IO 的双次调用测试
- 统一的测试运行入口

#### Docker 验证
可以通过以下方式验证：
```bash
# 进入容器
docker exec -it microi-server /bin/bash

# 对比系统命令结果
cat /proc/meminfo
df -h
cat /sys/class/net/eth0/statistics/rx_bytes
```

### 7. 文档说明

#### README.md
- 功能说明
- 使用方法和代码示例
- 输出示例
- 平台支持说明

#### DOCKER_GUIDE.md
- Docker 部署配置
- 容器环境特性说明
- 监控脚本示例
- 常见问题解答
- 性能优化建议

#### Example.js
- 完整的使用示例
- 监控脚本模板
- 告警阈值示例

## 编译和部署

### 1. 编译项目
```bash
cd Microi.Server/Microi.V8Engine
dotnet build -c Release
```

### 2. Docker 构建
```bash
cd Microi.Server
docker build -t microi-server .
```

### 3. 运行测试
在 Microi.net 管理界面中创建 V8 脚本并调用：
```javascript
var systemInfo = new V8.System.SystemInfo();
var result = systemInfo.GetAllSystemInfo();
return result;
```

## 注意事项

1. **平台兼容性**
   - Linux/Docker: 完整支持
   - Windows: 基础支持，部分功能受限
   - macOS: 基础支持，部分功能受限

2. **速率计算**
   - 网络流量和磁盘 IO 的速率需要至少调用两次
   - 建议间隔 1-5 秒获取准确的速率数据

3. **权限要求**
   - 需要读取 `/proc` 和 `/sys` 文件系统
   - 在标准 Docker 容器中无需特殊权限

4. **资源开销**
   - CPU 监控会等待 100ms
   - 其他操作都是轻量级文件读取
   - 建议监控频率：1-60 秒

## 扩展建议

1. **容器资源限制检测**
   - 读取 cgroup 信息获取容器的 CPU/内存限制
   - 对比实际使用和限制值

2. **进程级监控**
   - 获取当前进程的 CPU 和内存使用
   - 监控特定进程的资源占用

3. **历史数据存储**
   - 将监控数据保存到数据库
   - 生成趋势图表

4. **告警系统集成**
   - 邮件通知
   - 微信/钉钉推送
   - 自动化运维响应

## 版本信息

- 创建日期: 2026-02-08
- 目标框架: .NET Standard 2.1
- 主要依赖: Newtonsoft.Json
- 支持环境: Linux, Docker, Windows
