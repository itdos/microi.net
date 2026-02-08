using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8引擎扩展 - 系统硬件信息获取（支持 Docker 环境）
    /// </summary>
    public class SystemInfo
    {
        private static DateTime _lastCheckTime = DateTime.MinValue;
        private static long _lastRxBytes = 0;
        private static long _lastTxBytes = 0;
        private static long _lastDiskReadBytes = 0;
        private static long _lastDiskWriteBytes = 0;

        /// <summary>
        /// 获取操作系统信息
        /// </summary>
        /// <returns>包含操作系统详细信息的 JObject</returns>
        public JObject GetOSInfo()
        {
            try
            {
                var osInfo = new JObject();

                // 基本信息
                osInfo["Platform"] = Environment.OSVersion.Platform.ToString();
                osInfo["OSVersion"] = Environment.OSVersion.VersionString;
                osInfo["Is64Bit"] = Environment.Is64BitOperatingSystem;
                osInfo["MachineName"] = Environment.MachineName;
                osInfo["ProcessorCount"] = Environment.ProcessorCount;
                osInfo["SystemPageSize"] = Environment.SystemPageSize;
                osInfo["RuntimeVersion"] = RuntimeInformation.FrameworkDescription;

                // 在 Linux/Docker 环境中获取更详细的系统信息
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    try
                    {
                        // 读取 /etc/os-release 获取发行版信息
                        if (File.Exists("/etc/os-release"))
                        {
                            var osRelease = File.ReadAllLines("/etc/os-release");
                            var osDict = new Dictionary<string, string>();
                            foreach (var line in osRelease)
                            {
                                var parts = line.Split('=', 2);
                                if (parts.Length == 2)
                                {
                                    osDict[parts[0]] = parts[1].Trim('"');
                                }
                            }

                            if (osDict.ContainsKey("PRETTY_NAME"))
                                osInfo["DistributionName"] = osDict["PRETTY_NAME"];
                            if (osDict.ContainsKey("VERSION"))
                                osInfo["DistributionVersion"] = osDict["VERSION"];
                        }

                        // 获取内核版本
                        var kernelVersion = ExecuteCommand("uname", "-r");
                        if (!string.IsNullOrWhiteSpace(kernelVersion))
                        {
                            osInfo["KernelVersion"] = kernelVersion.Trim();
                        }

                        // 检查是否在 Docker 容器中
                        osInfo["IsDocker"] = IsRunningInDocker();
                    }
                    catch (Exception ex)
                    {
                        osInfo["LinuxInfoError"] = ex.Message;
                    }
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    osInfo["OSType"] = "Windows";
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    osInfo["OSType"] = "macOS";
                }

                osInfo["Success"] = true;
                return osInfo;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// 获取 CPU 和内存使用情况
        /// </summary>
        /// <returns>包含 CPU 和内存使用率的 JObject</returns>
        public JObject GetCpuMemoryInfo()
        {
            try
            {
                var info = new JObject();

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    // 获取 CPU 使用率
                    var cpuUsage = GetLinuxCpuUsage();
                    info["CpuUsagePercent"] = Math.Round(cpuUsage, 2);

                    // 获取内存信息
                    var memInfo = GetLinuxMemoryInfo();
                    info["MemoryTotal"] = memInfo.Total;
                    info["MemoryUsed"] = memInfo.Used;
                    info["MemoryFree"] = memInfo.Free;
                    info["MemoryAvailable"] = memInfo.Available;
                    info["MemoryUsagePercent"] = Math.Round(memInfo.UsagePercent, 2);
                    info["MemoryTotalMB"] = Math.Round(memInfo.Total / 1024.0 / 1024.0, 2);
                    info["MemoryUsedMB"] = Math.Round(memInfo.Used / 1024.0 / 1024.0, 2);
                    info["MemoryFreeMB"] = Math.Round(memInfo.Free / 1024.0 / 1024.0, 2);
                }
                else
                {
                    // Windows 或其他平台
                    info["CpuUsagePercent"] = GetWindowsCpuUsage();
                    var memInfo = GetWindowsMemoryInfo();
                    info["MemoryUsagePercent"] = memInfo.UsagePercent;
                    info["MemoryTotalMB"] = memInfo.TotalMB;
                    info["MemoryUsedMB"] = memInfo.UsedMB;
                }

                info["Success"] = true;
                return info;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// 获取磁盘使用情况
        /// </summary>
        /// <returns>包含磁盘使用信息的 JObject</returns>
        public JObject GetDiskInfo()
        {
            try
            {
                var info = new JObject();

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    var diskInfos = GetLinuxDiskInfo();
                    var disksArray = new JArray();

                    foreach (var disk in diskInfos)
                    {
                        var diskObj = new JObject
                        {
                            ["Filesystem"] = disk.Filesystem,
                            ["MountPoint"] = disk.MountPoint,
                            ["TotalGB"] = Math.Round(disk.Total / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsedGB"] = Math.Round(disk.Used / 1024.0 / 1024.0 / 1024.0, 2),
                            ["FreeGB"] = Math.Round(disk.Free / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsagePercent"] = Math.Round(disk.UsagePercent, 2)
                        };
                        disksArray.Add(diskObj);
                    }

                    info["Disks"] = disksArray;
                }
                else
                {
                    // Windows 磁盘信息
                    var drives = DriveInfo.GetDrives().Where(d => d.IsReady).ToList();
                    var disksArray = new JArray();

                    foreach (var drive in drives)
                    {
                        var diskObj = new JObject
                        {
                            ["Name"] = drive.Name,
                            ["DriveType"] = drive.DriveType.ToString(),
                            ["TotalGB"] = Math.Round(drive.TotalSize / 1024.0 / 1024.0 / 1024.0, 2),
                            ["FreeGB"] = Math.Round(drive.AvailableFreeSpace / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsedGB"] = Math.Round((drive.TotalSize - drive.AvailableFreeSpace) / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsagePercent"] = Math.Round((double)(drive.TotalSize - drive.AvailableFreeSpace) / drive.TotalSize * 100, 2)
                        };
                        disksArray.Add(diskObj);
                    }

                    info["Disks"] = disksArray;
                }

                info["Success"] = true;
                return info;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// 获取网络流量信息（需要至少调用两次才能计算速率）
        /// </summary>
        /// <returns>包含网络流量信息的 JObject</returns>
        public JObject GetNetworkTraffic()
        {
            try
            {
                var info = new JObject();

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    var (rxBytes, txBytes) = GetLinuxNetworkBytes();
                    var now = DateTime.Now;

                    info["RxBytesTotal"] = rxBytes;
                    info["TxBytesTotal"] = txBytes;
                    info["RxMBTotal"] = Math.Round(rxBytes / 1024.0 / 1024.0, 2);
                    info["TxMBTotal"] = Math.Round(txBytes / 1024.0 / 1024.0, 2);

                    // 计算流量速率
                    if (_lastCheckTime != DateTime.MinValue)
                    {
                        var timeElapsed = (now - _lastCheckTime).TotalSeconds;
                        if (timeElapsed > 0)
                        {
                            var rxSpeed = (rxBytes - _lastRxBytes) / timeElapsed; // bytes/s
                            var txSpeed = (txBytes - _lastTxBytes) / timeElapsed;

                            info["RxSpeedKBps"] = Math.Round(rxSpeed / 1024.0, 2);
                            info["TxSpeedKBps"] = Math.Round(txSpeed / 1024.0, 2);
                            info["RxSpeedMbps"] = Math.Round(rxSpeed * 8 / 1024.0 / 1024.0, 2);
                            info["TxSpeedMbps"] = Math.Round(txSpeed * 8 / 1024.0 / 1024.0, 2);
                        }
                    }

                    _lastRxBytes = rxBytes;
                    _lastTxBytes = txBytes;
                    _lastCheckTime = now;
                }
                else
                {
                    info["Message"] = "Network traffic monitoring is currently only supported on Linux/Docker";
                }

                info["Success"] = true;
                return info;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// 获取磁盘 IO 信息
        /// </summary>
        /// <returns>包含磁盘 IO 信息的 JObject</returns>
        public JObject GetDiskIO()
        {
            try
            {
                var info = new JObject();

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    var diskStats = GetLinuxDiskStats();
                    var now = DateTime.Now;
                    var statsArray = new JArray();

                    foreach (var stat in diskStats)
                    {
                        var statObj = new JObject
                        {
                            ["Device"] = stat.Device,
                            ["ReadBytesTotal"] = stat.ReadBytes,
                            ["WriteBytesTotal"] = stat.WriteBytes,
                            ["ReadMBTotal"] = Math.Round(stat.ReadBytes / 1024.0 / 1024.0, 2),
                            ["WriteMBTotal"] = Math.Round(stat.WriteBytes / 1024.0 / 1024.0, 2)
                        };

                        statsArray.Add(statObj);
                    }

                    info["DiskStats"] = statsArray;

                    // 计算 IO 速率（需要多次调用）
                    if (_lastCheckTime != DateTime.MinValue && diskStats.Count > 0)
                    {
                        var timeElapsed = (now - _lastCheckTime).TotalSeconds;
                        if (timeElapsed > 0)
                        {
                            var totalRead = diskStats.Sum(s => s.ReadBytes);
                            var totalWrite = diskStats.Sum(s => s.WriteBytes);

                            var readSpeed = (totalRead - _lastDiskReadBytes) / timeElapsed;
                            var writeSpeed = (totalWrite - _lastDiskWriteBytes) / timeElapsed;

                            info["ReadSpeedKBps"] = Math.Round(readSpeed / 1024.0, 2);
                            info["WriteSpeedKBps"] = Math.Round(writeSpeed / 1024.0, 2);

                            _lastDiskReadBytes = totalRead;
                            _lastDiskWriteBytes = totalWrite;
                        }
                    }
                    else if (diskStats.Count > 0)
                    {
                        _lastDiskReadBytes = diskStats.Sum(s => s.ReadBytes);
                        _lastDiskWriteBytes = diskStats.Sum(s => s.WriteBytes);
                        _lastCheckTime = now;
                    }
                }
                else
                {
                    info["Message"] = "Disk IO monitoring is currently only supported on Linux/Docker";
                }

                info["Success"] = true;
                return info;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// 获取所有系统信息（综合方法）
        /// </summary>
        /// <returns>包含所有系统信息的 JObject</returns>
        public JObject GetAllSystemInfo()
        {
            try
            {
                var allInfo = new JObject
                {
                    ["OS"] = GetOSInfo(),
                    ["CpuMemory"] = GetCpuMemoryInfo(),
                    ["Disk"] = GetDiskInfo(),
                    ["Network"] = GetNetworkTraffic(),
                    ["DiskIO"] = GetDiskIO(),
                    ["Timestamp"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["Success"] = true
                };

                return allInfo;
            }
            catch (Exception ex)
            {
                return JObject.FromObject(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        #region Linux 平台辅助方法

        /// <summary>
        /// 检查是否在 Docker 容器中运行
        /// </summary>
        private bool IsRunningInDocker()
        {
            try
            {
                return File.Exists("/.dockerenv") || 
                       (File.Exists("/proc/1/cgroup") && File.ReadAllText("/proc/1/cgroup").Contains("docker"));
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 获取 Linux CPU 使用率
        /// </summary>
        private double GetLinuxCpuUsage()
        {
            try
            {
                // 第一次读取
                var stat1 = ReadCpuStat();
                Thread.Sleep(100); // 等待 100ms
                // 第二次读取
                var stat2 = ReadCpuStat();

                var totalDiff = stat2.Total - stat1.Total;
                var idleDiff = stat2.Idle - stat1.Idle;

                if (totalDiff == 0) return 0;

                return (1.0 - (double)idleDiff / totalDiff) * 100.0;
            }
            catch
            {
                return 0;
            }
        }

        private (long Total, long Idle) ReadCpuStat()
        {
            var lines = File.ReadAllLines("/proc/stat");
            var cpuLine = lines.FirstOrDefault(l => l.StartsWith("cpu "));
            if (cpuLine == null) return (0, 0);

            var parts = cpuLine.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 5) return (0, 0);

            long user = long.Parse(parts[1]);
            long nice = long.Parse(parts[2]);
            long system = long.Parse(parts[3]);
            long idle = long.Parse(parts[4]);
            long iowait = parts.Length > 5 ? long.Parse(parts[5]) : 0;
            long irq = parts.Length > 6 ? long.Parse(parts[6]) : 0;
            long softirq = parts.Length > 7 ? long.Parse(parts[7]) : 0;

            long total = user + nice + system + idle + iowait + irq + softirq;
            return (total, idle);
        }

        /// <summary>
        /// 获取 Linux 内存信息
        /// </summary>
        private (long Total, long Used, long Free, long Available, double UsagePercent) GetLinuxMemoryInfo()
        {
            try
            {
                var lines = File.ReadAllLines("/proc/meminfo");
                var memDict = new Dictionary<string, long>();

                foreach (var line in lines)
                {
                    var parts = line.Split(new[] { ':', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2)
                    {
                        var key = parts[0];
                        if (long.TryParse(parts[1], out long value))
                        {
                            memDict[key] = value * 1024; // Convert to bytes
                        }
                    }
                }

                long total = memDict.ContainsKey("MemTotal") ? memDict["MemTotal"] : 0;
                long free = memDict.ContainsKey("MemFree") ? memDict["MemFree"] : 0;
                long available = memDict.ContainsKey("MemAvailable") ? memDict["MemAvailable"] : free;
                long buffers = memDict.ContainsKey("Buffers") ? memDict["Buffers"] : 0;
                long cached = memDict.ContainsKey("Cached") ? memDict["Cached"] : 0;

                long used = total - free - buffers - cached;
                double usagePercent = total > 0 ? (double)used / total * 100.0 : 0;

                return (total, used, free, available, usagePercent);
            }
            catch
            {
                return (0, 0, 0, 0, 0);
            }
        }

        /// <summary>
        /// 获取 Linux 磁盘信息
        /// </summary>
        private List<(string Filesystem, string MountPoint, long Total, long Used, long Free, double UsagePercent)> GetLinuxDiskInfo()
        {
            var diskInfos = new List<(string, string, long, long, long, double)>();

            try
            {
                var output = ExecuteCommand("df", "-B1");
                if (string.IsNullOrWhiteSpace(output)) return diskInfos;

                var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                for (int i = 1; i < lines.Length; i++) // Skip header
                {
                    var parts = lines[i].Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 6)
                    {
                        var filesystem = parts[0];
                        var mountPoint = parts[5];

                        // 过滤掉一些虚拟文件系统
                        if (filesystem.StartsWith("/dev/") && !mountPoint.StartsWith("/sys") && !mountPoint.StartsWith("/proc"))
                        {
                            if (long.TryParse(parts[1], out long total) &&
                                long.TryParse(parts[2], out long used) &&
                                long.TryParse(parts[3], out long free))
                            {
                                double usagePercent = total > 0 ? (double)used / total * 100.0 : 0;
                                diskInfos.Add((filesystem, mountPoint, total, used, free, usagePercent));
                            }
                        }
                    }
                }
            }
            catch
            {
                // Ignore errors
            }

            return diskInfos;
        }

        /// <summary>
        /// 获取 Linux 网络字节数
        /// </summary>
        private (long RxBytes, long TxBytes) GetLinuxNetworkBytes()
        {
            long totalRx = 0;
            long totalTx = 0;

            try
            {
                var netDevices = Directory.GetDirectories("/sys/class/net");

                foreach (var device in netDevices)
                {
                    var deviceName = Path.GetFileName(device);
                    
                    // 忽略 lo (loopback) 接口
                    if (deviceName == "lo") continue;

                    var rxFile = Path.Combine(device, "statistics", "rx_bytes");
                    var txFile = Path.Combine(device, "statistics", "tx_bytes");

                    if (File.Exists(rxFile) && File.Exists(txFile))
                    {
                        if (long.TryParse(File.ReadAllText(rxFile).Trim(), out long rx))
                            totalRx += rx;
                        if (long.TryParse(File.ReadAllText(txFile).Trim(), out long tx))
                            totalTx += tx;
                    }
                }
            }
            catch
            {
                // Ignore errors
            }

            return (totalRx, totalTx);
        }

        /// <summary>
        /// 获取 Linux 磁盘统计信息
        /// </summary>
        private List<(string Device, long ReadBytes, long WriteBytes)> GetLinuxDiskStats()
        {
            var stats = new List<(string, long, long)>();

            try
            {
                if (!File.Exists("/proc/diskstats")) return stats;

                var lines = File.ReadAllLines("/proc/diskstats");

                foreach (var line in lines)
                {
                    var parts = line.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 14)
                    {
                        var device = parts[2];
                        
                        // 只关注主要磁盘设备（如 sda, vda, nvme0n1 等），忽略分区
                        if (device.Contains("loop") || char.IsDigit(device[device.Length - 1]))
                            continue;

                        // sectors read (field 5) * 512 = bytes read
                        // sectors written (field 9) * 512 = bytes written
                        if (long.TryParse(parts[5], out long sectorsRead) &&
                            long.TryParse(parts[9], out long sectorsWritten))
                        {
                            long readBytes = sectorsRead * 512;
                            long writeBytes = sectorsWritten * 512;
                            stats.Add((device, readBytes, writeBytes));
                        }
                    }
                }
            }
            catch
            {
                // Ignore errors
            }

            return stats;
        }

        #endregion

        #region Windows 平台辅助方法

        private double GetWindowsCpuUsage()
        {
            try
            {
                using (var cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total"))
                {
                    cpuCounter.NextValue();
                    Thread.Sleep(100);
                    return cpuCounter.NextValue();
                }
            }
            catch
            {
                return 0;
            }
        }

        private (double UsagePercent, double TotalMB, double UsedMB) GetWindowsMemoryInfo()
        {
            try
            {
                using (var availableCounter = new PerformanceCounter("Memory", "Available MBytes"))
                {
                    var availableMB = availableCounter.NextValue();
                    
                    // 获取总内存（需要多次调用才能获取准确值）
                    // Windows 环境下使用性能计数器
                    var totalMemory = 0.0;
                    
                    // 尝试通过 WMI 获取，如果失败则估算
                    try
                    {
                        // 简单估算：假设物理内存至少是可用内存的 2 倍
                        // 这是一个近似值，实际应用中可以通过 WMI 获取更准确的值
                        totalMemory = availableMB * 2; // 临时估算
                    }
                    catch
                    {
                        totalMemory = 8192; // 默认 8GB
                    }
                    
                    var usedMB = totalMemory - availableMB;
                    var usagePercent = totalMemory > 0 ? (usedMB / totalMemory) * 100.0 : 0;

                    return (usagePercent, totalMemory, usedMB);
                }
            }
            catch
            {
                return (0, 0, 0);
            }
        }

        #endregion

        #region 通用辅助方法

        /// <summary>
        /// 执行命令行命令
        /// </summary>
        private string ExecuteCommand(string command, string arguments = "")
        {
            try
            {
                var processInfo = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(processInfo))
                {
                    if (process == null) return string.Empty;

                    var output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit();
                    return output;
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        #endregion
    }
}
