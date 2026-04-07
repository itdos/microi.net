using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 系统监控 - 获取服务器硬件、运行时信息（支持 Linux/Docker/macOS/Windows）
    /// </summary>
    public class SystemMonitorLogic
    {
        private static DateTime _lastCheckTime = DateTime.MinValue;
        private static long _lastRxBytes = 0;
        private static long _lastTxBytes = 0;
        private static long _lastDiskReadBytes = 0;
        private static long _lastDiskWriteBytes = 0;
        private static readonly object _lock = new object();

        // ======== macOS 后台缓存：避免 top/iostat 阻塞请求线程 ========
        private static double _cachedMacCpuUsage = 0;
        private static double _cachedMacDiskRead = 0;
        private static double _cachedMacDiskWrite = 0;
        private static bool _macBgStarted = false;
        private static readonly object _macBgLock = new object();
        /// <summary>
        /// 最近一次监控API被调用的时间（心跳），后台线程据此判断是否继续工作
        /// </summary>
        private static DateTime _lastMonitorAccess = DateTime.MinValue;
        private const int MonitorIdleTimeoutSeconds = 30;

        /// <summary>
        /// 前端访问时调用，刷新心跳
        /// </summary>
        public static void TouchMonitorAccess()
        {
            _lastMonitorAccess = DateTime.UtcNow;
        }

        private static void EnsureMacBgRefresh()
        {
            TouchMonitorAccess();
            if (_macBgStarted) return;
            lock (_macBgLock)
            {
                if (_macBgStarted) return;
                _macBgStarted = true;
                Thread t = new Thread(() =>
                {
                    while (true)
                    {
                        // 超过30秒没有前端访问，停止后台线程
                        if ((DateTime.UtcNow - _lastMonitorAccess).TotalSeconds > MonitorIdleTimeoutSeconds)
                        {
                            lock (_macBgLock) { _macBgStarted = false; }
                            return; // 线程退出，下次请求时 EnsureMacBgRefresh 会重启
                        }
                        try
                        {
                            // CPU: top -l 2 -n 0 采样两次取第2次（约0.5s）
                            var topOut = ExecuteCommandTimeout("top", "-l 2 -n 0 -stats cpu", 4000);
                            if (!string.IsNullOrWhiteSpace(topOut))
                            {
                                double lastCpu = 0;
                                foreach (var line in topOut.Split('\n'))
                                {
                                    if (line.Contains("CPU usage"))
                                    {
                                        var m = System.Text.RegularExpressions.Regex.Match(line, @"(\d+\.?\d*)\%\s*user.*?(\d+\.?\d*)\%\s*sys");
                                        if (m.Success)
                                        {
                                            double.TryParse(m.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var user);
                                            double.TryParse(m.Groups[2].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var sys);
                                            lastCpu = Math.Round(user + sys, 2);
                                        }
                                    }
                                }
                                _cachedMacCpuUsage = lastCpu;
                            }
                        }
                        catch { }
                        try
                        {
                            // DiskIO: iostat -d 1 1（只采一次即时快照，约0.2s）
                            var ioOut = ExecuteCommandTimeout("iostat", "-d 1 1", 3000);
                            if (!string.IsNullOrWhiteSpace(ioOut))
                            {
                                // 格式: KB/t  tps  MB/s—取最后一条有效数值行
                                foreach (var line in ioOut.Split('\n').Reverse())
                                {
                                    var parts = line.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                    if (parts.Length >= 3 && double.TryParse(parts[0], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var kbt))
                                    {
                                        double.TryParse(parts.Length > 2 ? parts[2] : "0", System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var mbs);
                                        _cachedMacDiskRead = Math.Round(mbs * 1024, 2);
                                        break;
                                    }
                                }
                            }
                        }
                        catch { }
                        Thread.Sleep(5000);
                    }
                })
                { IsBackground = true, Name = "MacMonitorBg" };
                t.Start();
            }
        }

        /// <summary>
        /// 非macOS平台也需要刷新心跳（保持统一调用）
        /// </summary>
        public static void EnsureMonitorActive()
        {
            TouchMonitorAccess();
            // macOS 平台同时确保后台线程运行
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                EnsureMacBgRefresh();
        }

        // 应用内日志环形缓冲区
        private static readonly object _logLock = new object();
        private static readonly string[] _logBuffer = new string[2000];
        private static int _logWriteIndex = 0;
        private static int _logTotalCount = 0;

        /// <summary>
        /// 写入一行日志到环形缓冲区（供 ConsoleLogInterceptor 调用）
        /// </summary>
        public static void WriteLog(string line)
        {
            if (string.IsNullOrEmpty(line)) return;
            lock (_logLock)
            {
                _logBuffer[_logWriteIndex] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + line;
                _logWriteIndex = (_logWriteIndex + 1) % _logBuffer.Length;
                _logTotalCount++;
            }
        }

        /// <summary>
        /// 读取最近N条应用日志
        /// </summary>
        public static string[] GetAppLogs(int count)
        {
            lock (_logLock)
            {
                int total = Math.Min(count, Math.Min(_logTotalCount, _logBuffer.Length));
                var result = new string[total];
                int startIdx = (_logWriteIndex - total + _logBuffer.Length) % _logBuffer.Length;
                for (int i = 0; i < total; i++)
                {
                    result[i] = _logBuffer[(startIdx + i) % _logBuffer.Length];
                }
                return result;
            }
        }

        /// <summary>
        /// 获取综合系统监控信息
        /// </summary>
        public static JObject GetSystemOverview()
        {
            try
            {
                var data = new JObject
                {
                    ["OS"] = GetOSInfo(),
                    ["Runtime"] = GetRuntimeInfo(),
                    ["CpuMemory"] = GetCpuMemoryInfo(),
                    ["Disk"] = GetDiskInfo(),
                    ["Network"] = GetNetworkTraffic(),
                    ["DiskIO"] = GetDiskIO(),
                    ["Timestamp"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };
                return data;
            }
            catch (Exception ex)
            {
                return new JObject { ["Error"] = ex.Message };
            }
        }

        /// <summary>
        /// 获取操作系统信息
        /// </summary>
        public static JObject GetOSInfo()
        {
            var info = new JObject();
            try
            {
                info["Platform"] = Environment.OSVersion.Platform.ToString();
                info["OSVersion"] = Environment.OSVersion.VersionString;
                info["Is64Bit"] = Environment.Is64BitOperatingSystem;
                info["MachineName"] = Environment.MachineName;
                info["ProcessorCount"] = Environment.ProcessorCount;

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    info["OSType"] = "Linux";
                    if (File.Exists("/etc/os-release"))
                    {
                        var lines = File.ReadAllLines("/etc/os-release");
                        foreach (var line in lines)
                        {
                            var parts = line.Split('=', 2);
                            if (parts.Length == 2 && parts[0] == "PRETTY_NAME")
                            {
                                info["DistributionName"] = parts[1].Trim('"');
                                break;
                            }
                        }
                    }
                    var kernel = ExecuteCommand("uname", "-r");
                    if (!string.IsNullOrWhiteSpace(kernel))
                        info["KernelVersion"] = kernel.Trim();

                    info["IsDocker"] = File.Exists("/.dockerenv") ||
                        (File.Exists("/proc/1/cgroup") && File.ReadAllText("/proc/1/cgroup").Contains("docker"));

                    // 系统运行时间
                    if (File.Exists("/proc/uptime"))
                    {
                        var uptime = File.ReadAllText("/proc/uptime").Split(' ')[0];
                        if (double.TryParse(uptime, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var seconds))
                        {
                            var ts = TimeSpan.FromSeconds(seconds);
                            info["Uptime"] = $"{(int)ts.TotalDays}天{ts.Hours}时{ts.Minutes}分";
                            info["UptimeSeconds"] = (long)seconds;
                        }
                    }
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    info["OSType"] = "Windows";
                    info["IsDocker"] = false;
                    var uptimeMs = (long)Environment.TickCount;
                    var ts = TimeSpan.FromMilliseconds(uptimeMs);
                    info["Uptime"] = $"{(int)ts.TotalDays}天{ts.Hours}时{ts.Minutes}分";
                    info["UptimeSeconds"] = (long)ts.TotalSeconds;
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    info["OSType"] = "macOS";
                    info["IsDocker"] = false;

                    var swVers = ExecuteCommand("sw_vers", "-productVersion");
                    if (!string.IsNullOrWhiteSpace(swVers))
                        info["DistributionName"] = "macOS " + swVers.Trim();

                    var kernel = ExecuteCommand("uname", "-r");
                    if (!string.IsNullOrWhiteSpace(kernel))
                        info["KernelVersion"] = kernel.Trim();

                    var bootTimeStr = ExecuteCommand("sysctl", "-n kern.boottime");
                    if (!string.IsNullOrWhiteSpace(bootTimeStr))
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(bootTimeStr, @"sec\s*=\s*(\d+)");
                        if (match.Success && long.TryParse(match.Groups[1].Value, out long bootSec))
                        {
                            var bootTime = DateTimeOffset.FromUnixTimeSeconds(bootSec).LocalDateTime;
                            var uptime = DateTime.Now - bootTime;
                            info["Uptime"] = $"{(int)uptime.TotalDays}天{uptime.Hours}时{uptime.Minutes}分";
                            info["UptimeSeconds"] = (long)uptime.TotalSeconds;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取.NET运行时信息
        /// </summary>
        public static JObject GetRuntimeInfo()
        {
            var info = new JObject();
            try
            {
                var process = Process.GetCurrentProcess();
                info["RuntimeVersion"] = RuntimeInformation.FrameworkDescription;
                info["ProcessId"] = process.Id;
                info["ProcessMemoryMB"] = Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 2);
                info["ThreadCount"] = process.Threads.Count;
                info["HandleCount"] = process.HandleCount;
                info["StartTime"] = process.StartTime.ToString("yyyy-MM-dd HH:mm:ss");
                var running = DateTime.Now - process.StartTime;
                info["RunningTime"] = $"{(int)running.TotalDays}天{running.Hours}时{running.Minutes}分";
                info["GCMemoryMB"] = Math.Round(GC.GetTotalMemory(false) / 1024.0 / 1024.0, 2);
                info["Gen0Collections"] = GC.CollectionCount(0);
                info["Gen1Collections"] = GC.CollectionCount(1);
                info["Gen2Collections"] = GC.CollectionCount(2);

                // 后端版本号
                info["BackendVersion"] = "4.9.9";

                // ProductEdition 由 Controller 层补充（DiyLicense 在 Microi.net 项目中）
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取CPU和内存使用情况
        /// </summary>
        public static JObject GetCpuMemoryInfo()
        {
            var info = new JObject();
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    // CPU
                    var stat1 = ReadCpuStat();
                    Thread.Sleep(100);
                    var stat2 = ReadCpuStat();
                    var totalDiff = stat2.Total - stat1.Total;
                    var idleDiff = stat2.Idle - stat1.Idle;
                    info["CpuUsagePercent"] = totalDiff > 0 ? Math.Round((1.0 - (double)idleDiff / totalDiff) * 100.0, 2) : 0;

                    // 内存
                    var memDict = new Dictionary<string, long>();
                    if (File.Exists("/proc/meminfo"))
                    {
                        foreach (var line in File.ReadAllLines("/proc/meminfo"))
                        {
                            var parts = line.Split(new[] { ':', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length >= 2 && long.TryParse(parts[1], out long val))
                                memDict[parts[0]] = val * 1024;
                        }
                    }
                    long total = memDict.GetValueOrDefault("MemTotal");
                    long free = memDict.GetValueOrDefault("MemFree");
                    long buffers = memDict.GetValueOrDefault("Buffers");
                    long cached = memDict.GetValueOrDefault("Cached");
                    long used = total - free - buffers - cached;

                    info["MemoryTotalMB"] = Math.Round(total / 1024.0 / 1024.0, 2);
                    info["MemoryUsedMB"] = Math.Round(used / 1024.0 / 1024.0, 2);
                    info["MemoryFreeMB"] = Math.Round(free / 1024.0 / 1024.0, 2);
                    info["MemoryUsagePercent"] = total > 0 ? Math.Round((double)used / total * 100.0, 2) : 0;

                    // 额外：CPU负载
                    if (File.Exists("/proc/loadavg"))
                    {
                        var loadParts = File.ReadAllText("/proc/loadavg").Split(' ');
                        if (loadParts.Length >= 3)
                        {
                            info["LoadAvg1"] = loadParts[0];
                            info["LoadAvg5"] = loadParts[1];
                            info["LoadAvg15"] = loadParts[2];
                        }
                    }
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    // macOS: 使用后台缓存，不阻塞请求
                    EnsureMacBgRefresh();
                    info["CpuUsagePercent"] = _cachedMacCpuUsage;

                    // macOS: vm_stat + sysctl 获取内存
                    var memSize = ExecuteCommand("sysctl", "-n hw.memsize");
                    var vmStat = ExecuteCommand("vm_stat", "");
                    long totalMem = 0;
                    if (long.TryParse(memSize?.Trim(), out var ms)) totalMem = ms;

                    if (!string.IsNullOrWhiteSpace(vmStat))
                    {
                        var pageSize = ExecuteCommand("sysctl", "-n hw.pagesize");
                        long pageSizeBytes = 4096;
                        if (long.TryParse(pageSize?.Trim(), out var ps)) pageSizeBytes = ps;

                        long freePages = 0, activePages = 0, wiredPages = 0, compressedPages = 0, speculativePages = 0, inactivePages = 0;
                        foreach (var line in vmStat.Split('\n'))
                        {
                            if (line.Contains("Pages free")) freePages = ParseVmStatValue(line);
                            else if (line.Contains("Pages active")) activePages = ParseVmStatValue(line);
                            else if (line.Contains("Pages inactive")) inactivePages = ParseVmStatValue(line);
                            else if (line.Contains("Pages wired")) wiredPages = ParseVmStatValue(line);
                            else if (line.Contains("Pages occupied by compressor")) compressedPages = ParseVmStatValue(line);
                            else if (line.Contains("Pages speculative")) speculativePages = ParseVmStatValue(line);
                        }
                        long usedMem = (activePages + wiredPages + compressedPages) * pageSizeBytes;
                        long freeMem = (freePages + inactivePages + speculativePages) * pageSizeBytes;
                        info["MemoryTotalMB"] = Math.Round(totalMem / 1024.0 / 1024.0, 2);
                        info["MemoryUsedMB"] = Math.Round(usedMem / 1024.0 / 1024.0, 2);
                        info["MemoryFreeMB"] = Math.Round(freeMem / 1024.0 / 1024.0, 2);
                        info["MemoryUsagePercent"] = totalMem > 0 ? Math.Round((double)usedMem / totalMem * 100.0, 2) : 0;
                    }

                    var loadAvg = ExecuteCommand("sysctl", "-n vm.loadavg");
                    if (!string.IsNullOrWhiteSpace(loadAvg))
                    {
                        var parts = loadAvg.Trim().Trim('{', '}').Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 3)
                        {
                            info["LoadAvg1"] = parts[0];
                            info["LoadAvg5"] = parts[1];
                            info["LoadAvg15"] = parts[2];
                        }
                    }
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    info["CpuUsagePercent"] = GetWindowsCpuUsage();
                    var winMemInfo = GetWindowsMemoryInfo();
                    info["MemoryTotalMB"] = winMemInfo.TotalMB;
                    info["MemoryUsedMB"] = winMemInfo.UsedMB;
                    info["MemoryFreeMB"] = winMemInfo.FreeMB;
                    info["MemoryUsagePercent"] = winMemInfo.UsagePercent;
                }
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取磁盘使用信息
        /// </summary>
        public static JObject GetDiskInfo()
        {
            var info = new JObject();
            try
            {
                var disksArray = new JArray();

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    var output = ExecuteCommand("df", "-B1");
                    if (!string.IsNullOrWhiteSpace(output))
                    {
                        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                        for (int i = 1; i < lines.Length; i++)
                        {
                            var parts = lines[i].Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length >= 6)
                            {
                                var fs = parts[0];
                                var mp = parts[5];
                                if (fs.StartsWith("/dev/") && !mp.StartsWith("/sys") && !mp.StartsWith("/proc"))
                                {
                                    if (long.TryParse(parts[1], out long t) && long.TryParse(parts[2], out long u) && long.TryParse(parts[3], out long f))
                                    {
                                        disksArray.Add(new JObject
                                        {
                                            ["Filesystem"] = fs,
                                            ["MountPoint"] = mp,
                                            ["TotalGB"] = Math.Round(t / 1024.0 / 1024.0 / 1024.0, 2),
                                            ["UsedGB"] = Math.Round(u / 1024.0 / 1024.0 / 1024.0, 2),
                                            ["FreeGB"] = Math.Round(f / 1024.0 / 1024.0 / 1024.0, 2),
                                            ["UsagePercent"] = t > 0 ? Math.Round((double)u / t * 100, 2) : 0
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady))
                    {
                        disksArray.Add(new JObject
                        {
                            ["Filesystem"] = drive.Name,
                            ["MountPoint"] = drive.Name,
                            ["TotalGB"] = Math.Round(drive.TotalSize / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsedGB"] = Math.Round((drive.TotalSize - drive.AvailableFreeSpace) / 1024.0 / 1024.0 / 1024.0, 2),
                            ["FreeGB"] = Math.Round(drive.AvailableFreeSpace / 1024.0 / 1024.0 / 1024.0, 2),
                            ["UsagePercent"] = drive.TotalSize > 0 ? Math.Round((double)(drive.TotalSize - drive.AvailableFreeSpace) / drive.TotalSize * 100, 2) : 0
                        });
                    }
                }

                info["Disks"] = disksArray;
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取网络流量
        /// </summary>
        public static JObject GetNetworkTraffic()
        {
            var info = new JObject();
            try
            {
                long totalRx = 0, totalTx = 0;

                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    if (Directory.Exists("/sys/class/net"))
                    {
                        foreach (var device in Directory.GetDirectories("/sys/class/net"))
                        {
                            var name = Path.GetFileName(device);
                            if (name == "lo") continue;
                            var rxFile = Path.Combine(device, "statistics", "rx_bytes");
                            var txFile = Path.Combine(device, "statistics", "tx_bytes");
                            if (File.Exists(rxFile) && long.TryParse(File.ReadAllText(rxFile).Trim(), out long rx)) totalRx += rx;
                            if (File.Exists(txFile) && long.TryParse(File.ReadAllText(txFile).Trim(), out long tx)) totalTx += tx;
                        }
                    }
                }
                else
                {
                    // macOS / Windows 通用回退: .NET NetworkInterface
                    try
                    {
                        foreach (var ni in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
                        {
                            if (ni.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up &&
                                ni.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback)
                            {
                                var stats = ni.GetIPStatistics();
                                totalRx += stats.BytesReceived;
                                totalTx += stats.BytesSent;
                            }
                        }
                    }
                    catch { }
                }

                info["RxMBTotal"] = Math.Round(totalRx / 1024.0 / 1024.0, 2);
                info["TxMBTotal"] = Math.Round(totalTx / 1024.0 / 1024.0, 2);

                lock (_lock)
                {
                    if (_lastCheckTime != DateTime.MinValue)
                    {
                        var elapsed = (DateTime.Now - _lastCheckTime).TotalSeconds;
                        if (elapsed > 0)
                        {
                            info["RxSpeedKBps"] = Math.Round((totalRx - _lastRxBytes) / elapsed / 1024.0, 2);
                            info["TxSpeedKBps"] = Math.Round((totalTx - _lastTxBytes) / elapsed / 1024.0, 2);
                        }
                    }
                    _lastRxBytes = totalRx;
                    _lastTxBytes = totalTx;
                    _lastCheckTime = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取磁盘IO
        /// </summary>
        public static JObject GetDiskIO()
        {
            var info = new JObject();
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux) && File.Exists("/proc/diskstats"))
                {
                    long totalRead = 0, totalWrite = 0;
                    foreach (var line in File.ReadAllLines("/proc/diskstats"))
                    {
                        var parts = line.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 14)
                        {
                            var dev = parts[2];
                            if (dev.Contains("loop") || char.IsDigit(dev[dev.Length - 1])) continue;
                            if (long.TryParse(parts[5], out long sr) && long.TryParse(parts[9], out long sw))
                            {
                                totalRead += sr * 512;
                                totalWrite += sw * 512;
                            }
                        }
                    }

                    info["ReadMBTotal"] = Math.Round(totalRead / 1024.0 / 1024.0, 2);
                    info["WriteMBTotal"] = Math.Round(totalWrite / 1024.0 / 1024.0, 2);

                    lock (_lock)
                    {
                        if (_lastDiskReadBytes > 0)
                        {
                            var elapsed = (DateTime.Now - _lastCheckTime).TotalSeconds;
                            if (elapsed > 0)
                            {
                                info["ReadSpeedKBps"] = Math.Round((totalRead - _lastDiskReadBytes) / elapsed / 1024.0, 2);
                                info["WriteSpeedKBps"] = Math.Round((totalWrite - _lastDiskWriteBytes) / elapsed / 1024.0, 2);
                            }
                        }
                        _lastDiskReadBytes = totalRead;
                        _lastDiskWriteBytes = totalWrite;
                    }
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    // macOS: 使用后台缓存的IO数据
                    EnsureMacBgRefresh();
                    info["ReadSpeedKBps"] = _cachedMacDiskRead;
                    info["WriteSpeedKBps"] = _cachedMacDiskWrite;
                }
            }
            catch (Exception ex)
            {
                info["Error"] = ex.Message;
            }
            return info;
        }

        /// <summary>
        /// 获取Docker容器统计信息（兼容Linux/Windows/macOS）
        /// </summary>
        public static JObject GetDockerStats()
        {
            var info = new JObject();
            try
            {
                // 先检测docker是否可用
                var versionOutput = ExecuteCommandTimeout("docker", "version --format \"{{.Server.Version}}\"", 5000);
                if (string.IsNullOrWhiteSpace(versionOutput) || versionOutput.Contains("error") || versionOutput.Contains("Cannot connect"))
                {
                    info["Available"] = false;
                    info["Msg"] = "Docker未安装或未运行";
                    return info;
                }

                info["Available"] = true;
                info["DockerVersion"] = versionOutput.Trim();

                // 获取docker info概要
                try
                {
                    var containersRunning = ExecuteCommandTimeout("docker", "info --format \"{{.ContainersRunning}}\"", 5000);
                    var containersStopped = ExecuteCommandTimeout("docker", "info --format \"{{.ContainersStopped}}\"", 5000);
                    var containersTotal = ExecuteCommandTimeout("docker", "info --format \"{{.Containers}}\"", 5000);
                    var images = ExecuteCommandTimeout("docker", "info --format \"{{.Images}}\"", 5000);

                    int.TryParse(containersRunning?.Trim(), out var running);
                    int.TryParse(containersStopped?.Trim(), out var stopped);
                    int.TryParse(containersTotal?.Trim(), out var total);
                    int.TryParse(images?.Trim(), out var imgCount);

                    info["ContainersRunning"] = running;
                    info["ContainersStopped"] = stopped;
                    info["ContainersTotal"] = total;
                    info["Images"] = imgCount;
                }
                catch
                {
                    info["ContainersRunning"] = 0;
                    info["ContainersStopped"] = 0;
                    info["ContainersTotal"] = 0;
                    info["Images"] = 0;
                }

                // 获取所有容器状态（包括停止的）
                var containers = new JArray();
                try
                {
                    var psOutput = ExecuteCommandTimeout("docker", "ps -a --format \"{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.State}}\\t{{.Ports}}\"", 8000);
                    if (!string.IsNullOrWhiteSpace(psOutput))
                    {
                        var psMap = new Dictionary<string, JObject>();
                        foreach (var line in psOutput.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                        {
                            var parts = line.Split('\t');
                            if (parts.Length >= 5)
                            {
                                var ct = new JObject
                                {
                                    ["ContainerId"] = parts[0].Trim(),
                                    ["Name"] = parts[1].Trim(),
                                    ["Image"] = parts[2].Trim(),
                                    ["Status"] = parts[3].Trim(),
                                    ["State"] = parts[4].Trim(),
                                    ["Ports"] = parts.Length > 5 ? parts[5].Trim() : ""
                                };
                                psMap[parts[1].Trim()] = ct;
                            }
                        }

                        // 获取运行中容器的stats
                        var statsOutput = ExecuteCommandTimeout("docker", "stats --no-stream --format \"{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.NetIO}}\\t{{.BlockIO}}\\t{{.PIDs}}\"", 15000);
                        var statsMap = new Dictionary<string, JObject>();
                        if (!string.IsNullOrWhiteSpace(statsOutput))
                        {
                            foreach (var line in statsOutput.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                            {
                                var parts = line.Split('\t');
                                if (parts.Length >= 7)
                                {
                                    var name = parts[0].Trim();
                                    var stat = new JObject
                                    {
                                        ["CPUPerc"] = parts[1].Trim(),
                                        ["MemUsage"] = parts[2].Trim(),
                                        ["MemPerc"] = parts[3].Trim(),
                                        ["NetIO"] = parts[4].Trim(),
                                        ["BlockIO"] = parts[5].Trim(),
                                        ["PIDs"] = parts[6].Trim()
                                    };

                                    // 解析CPU百分比为数字
                                    var cpuStr = parts[1].Trim().Replace("%", "");
                                    if (double.TryParse(cpuStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var cpuVal))
                                        stat["CPUPercNum"] = Math.Round(cpuVal, 2);
                                    else
                                        stat["CPUPercNum"] = 0;

                                    // 解析内存百分比为数字
                                    var memStr = parts[3].Trim().Replace("%", "");
                                    if (double.TryParse(memStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var memVal))
                                        stat["MemPercNum"] = Math.Round(memVal, 2);
                                    else
                                        stat["MemPercNum"] = 0;

                                    statsMap[name] = stat;
                                }
                            }
                        }

                        // 合并ps和stats数据
                        foreach (var kv in psMap)
                        {
                            var ct = kv.Value;
                            if (statsMap.TryGetValue(kv.Key, out var stat))
                            {
                                ct.Merge(stat);
                            }
                            else
                            {
                                // 未运行的容器填充默认值
                                ct["CPUPerc"] = "0.00%";
                                ct["MemUsage"] = "0B / 0B";
                                ct["MemPerc"] = "0.00%";
                                ct["NetIO"] = "0B / 0B";
                                ct["BlockIO"] = "0B / 0B";
                                ct["PIDs"] = "0";
                                ct["CPUPercNum"] = 0;
                                ct["MemPercNum"] = 0;
                            }
                            containers.Add(ct);
                        }
                    }
                }
                catch { }

                info["Containers"] = containers;
            }
            catch (Exception ex)
            {
                info["Available"] = false;
                info["Msg"] = ex.Message;
            }
            return info;
        }

        #region 辅助方法

        /// <summary>
        /// macOS CPU使用率（保留兼容，不再直接调用）
        /// </summary>
        private static double GetMacCpuUsage()
        {
            EnsureMacBgRefresh();
            return _cachedMacCpuUsage;
        }

        private static long ParseVmStatValue(string line)
        {
            var match = System.Text.RegularExpressions.Regex.Match(line, @":\s*(\d+)");
            if (match.Success && long.TryParse(match.Groups[1].Value, out long val))
                return val;
            return 0;
        }

        /// <summary>
        /// Windows CPU使用率
        /// </summary>
        private static double GetWindowsCpuUsage()
        {
            try
            {
                var output = ExecuteCommand("wmic", "cpu get loadpercentage /format:value");
                if (!string.IsNullOrWhiteSpace(output))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(output, @"LoadPercentage=(\d+)");
                    if (match.Success && double.TryParse(match.Groups[1].Value, out var cpu))
                        return cpu;
                }
            }
            catch { }
            return 0;
        }

        /// <summary>
        /// Windows 内存信息
        /// </summary>
        private static (double TotalMB, double UsedMB, double FreeMB, double UsagePercent) GetWindowsMemoryInfo()
        {
            try
            {
                var output = ExecuteCommand("wmic", "OS get TotalVisibleMemorySize,FreePhysicalMemory /format:csv");
                if (!string.IsNullOrWhiteSpace(output))
                {
                    var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        var parts = line.Split(',');
                        if (parts.Length >= 3)
                        {
                            if (long.TryParse(parts[1].Trim(), out long freeKB) && long.TryParse(parts[2].Trim(), out long totalKB))
                            {
                                double totalMB = totalKB / 1024.0;
                                double freeMB = freeKB / 1024.0;
                                double usedMB = totalMB - freeMB;
                                double percent = totalMB > 0 ? Math.Round(usedMB / totalMB * 100, 2) : 0;
                                return (Math.Round(totalMB, 2), Math.Round(usedMB, 2), Math.Round(freeMB, 2), percent);
                            }
                        }
                    }
                }
            }
            catch { }
            var process = Process.GetCurrentProcess();
            var procMem = Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 2);
            return (0, procMem, 0, 0);
        }

        private static (long Total, long Idle) ReadCpuStat()
        {
            if (!File.Exists("/proc/stat")) return (0, 0);
            var cpuLine = File.ReadAllLines("/proc/stat").FirstOrDefault(l => l.StartsWith("cpu "));
            if (cpuLine == null) return (0, 0);
            var p = cpuLine.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (p.Length < 5) return (0, 0);
            long user = long.Parse(p[1]), nice = long.Parse(p[2]), sys = long.Parse(p[3]), idle = long.Parse(p[4]);
            long iow = p.Length > 5 ? long.Parse(p[5]) : 0;
            long irq = p.Length > 6 ? long.Parse(p[6]) : 0;
            long sirq = p.Length > 7 ? long.Parse(p[7]) : 0;
            return (user + nice + sys + idle + iow + irq + sirq, idle);
        }

        private static string ExecuteCommand(string command, string arguments = "")
        {
            return ExecuteCommandTimeout(command, arguments, 5000);
        }

        private static string ExecuteCommandTimeout(string command, string arguments, int timeoutMs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var process = Process.Start(psi);
                if (process == null) return string.Empty;
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(timeoutMs);
                return output;
            }
            catch
            {
                return string.Empty;
            }
        }

        #endregion
    }

    /// <summary>
    /// Console输出拦截器，将Console.WriteLine输出同时写入环形缓冲区
    /// 在Program.cs中注册：Console.SetOut(new ConsoleLogInterceptor(Console.Out));
    /// </summary>
    public class ConsoleLogInterceptor : TextWriter
    {
        private readonly TextWriter _original;

        public ConsoleLogInterceptor(TextWriter original)
        {
            _original = original;
        }

        public override System.Text.Encoding Encoding => _original.Encoding;

        public override void Write(string value)
        {
            _original.Write(value);
        }

        public override void WriteLine(string value)
        {
            _original.WriteLine(value);
            SystemMonitorLogic.WriteLog(value);
        }

        public override void WriteLine()
        {
            _original.WriteLine();
        }

        public override void Flush()
        {
            _original.Flush();
        }
    }
}
