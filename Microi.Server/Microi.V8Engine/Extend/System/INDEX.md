# SystemInfo - Docker 硬件信息监控扩展

## 📚 文档导航

### 快速开始
- **[QUICKSTART.md](QUICKSTART.md)** - 5分钟快速上手指南，包含常用示例

### 详细文档
- **[README.md](README.md)** - 完整的功能说明和 API 文档
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - Docker 环境部署和优化指南
- **[SUMMARY.md](SUMMARY.md)** - 实现总结和技术细节

### 代码文件
- **[SystemInfo.cs](SystemInfo.cs)** - 核心实现类（C#）
- **[SystemInfoTests.cs](SystemInfoTests.cs)** - 单元测试类
- **[Example.js](Example.js)** - JavaScript 使用示例

---

## 🚀 快速预览

### 功能列表
✅ 获取操作系统信息（Linux、Docker、Windows）  
✅ 监控 CPU 使用率  
✅ 监控内存使用率  
✅ 监控磁盘空间使用  
✅ 监控网络流量（上下行速度）  
✅ 监控磁盘 IO（读写速度）  
✅ Docker 容器环境自动检测  

### 最简示例
```javascript
var systemInfo = new V8.System.SystemInfo();
var data = systemInfo.GetAllSystemInfo();
console.log(JSON.stringify(data, null, 2));
```

### 支持平台
- ✅ **Linux** - 完整支持
- ✅ **Docker** - 完整支持（优化）
- ⚠️ **Windows** - 基础支持
- ⚠️ **macOS** - 基础支持

---

## 📖 使用场景

### 1. 实时监控
在管理后台显示服务器实时状态

### 2. 告警通知
资源使用超过阈值时自动发送通知

### 3. 性能分析
记录历史数据，分析系统性能趋势

### 4. 健康检查
定期检查系统健康状态

### 5. 容量规划
基于历史数据规划服务器容量

---

## 🔧 核心 API

```javascript
var systemInfo = new V8.System.SystemInfo();

// 获取操作系统信息
systemInfo.GetOSInfo()

// 获取 CPU 和内存信息
systemInfo.GetCpuMemoryInfo()

// 获取磁盘信息
systemInfo.GetDiskInfo()

// 获取网络流量（需调用2次计算速率）
systemInfo.GetNetworkTraffic()

// 获取磁盘 IO（需调用2次计算速率）
systemInfo.GetDiskIO()

// 一次性获取所有信息
systemInfo.GetAllSystemInfo()
```

---

## 📊 返回数据示例

```json
{
  "OS": {
    "Platform": "Unix",
    "DistributionName": "Ubuntu 22.04.3 LTS",
    "IsDocker": true,
    "ProcessorCount": 4
  },
  "CpuMemory": {
    "CpuUsagePercent": 15.32,
    "MemoryUsagePercent": 50.00,
    "MemoryTotalMB": 8192.00,
    "MemoryUsedMB": 4096.00
  },
  "Disk": {
    "Disks": [
      {
        "MountPoint": "/",
        "TotalGB": 100.00,
        "UsedGB": 45.50,
        "UsagePercent": 45.50
      }
    ]
  },
  "Network": {
    "RxSpeedKBps": 256.50,
    "TxSpeedKBps": 128.25
  },
  "DiskIO": {
    "ReadSpeedKBps": 1024.50,
    "WriteSpeedKBps": 512.25
  }
}
```

---

## 🐳 Docker 特性

### 自动检测
代码会自动检测是否运行在 Docker 容器中

### 资源限制感知
所有数据都反映容器的资源限制，而非宿主机

### 无需特殊权限
在标准 Docker 容器中即可运行，无需额外权限

### 准确性
直接读取 Linux 内核数据，确保信息准确

---

## ⚙️ 配置建议

### 监控频率
- **CPU/内存**: 1-5 秒
- **网络流量**: 2-10 秒
- **磁盘空间**: 30-60 秒
- **磁盘 IO**: 5-30 秒

### 告警阈值
- **CPU**: > 80%
- **内存**: > 90%
- **磁盘**: > 85%

---

## 📝 开发信息

- **创建日期**: 2026-02-08
- **目标框架**: .NET Standard 2.1
- **主要依赖**: Newtonsoft.Json
- **许可证**: 遵循 Microi.net 项目许可

---

## 💡 提示

1. 网络流量和磁盘 IO 需要**至少调用两次**才能获取速率
2. 建议使用 `GetAllSystemInfo()` 一次性获取所有信息
3. 所有方法都返回包含 `Success` 字段的 JSON 对象
4. 在 Docker 中部署时，数据反映的是**容器内**的资源使用情况

---

## 📞 获取帮助

- 查看 [QUICKSTART.md](QUICKSTART.md) 快速入门
- 阅读 [README.md](README.md) 完整文档
- 参考 [Example.js](Example.js) 代码示例
- 查看 [DOCKER_GUIDE.md](DOCKER_GUIDE.md) Docker 指南

---

**Happy Monitoring! 🎉**
