using System.Diagnostics;
using System.Globalization;

namespace Microi.net.Api;

public enum ProcessMemoryPressureLevel
{
    Normal = 0,
    Soft = 1,
    Hard = 2
}

public readonly record struct ProcessMemoryCapacity(long TotalBytes, string Source)
{
    private const long MinimumUsefulCapacityBytes = 128L * 1024 * 1024;

    public static ProcessMemoryCapacity Detect()
    {
        var hostBytes = TryReadLinuxHostMemory();
        var cgroup = TryReadCgroupLimit();
        if (cgroup.TotalBytes >= MinimumUsefulCapacityBytes)
        {
            return hostBytes >= MinimumUsefulCapacityBytes && hostBytes < cgroup.TotalBytes
                ? new ProcessMemoryCapacity(hostBytes, "LinuxMemTotal")
                : cgroup;
        }

        if (hostBytes >= MinimumUsefulCapacityBytes)
        {
            return new ProcessMemoryCapacity(hostBytes, "LinuxMemTotal");
        }

        var gcBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
        return gcBytes >= MinimumUsefulCapacityBytes && gcBytes < long.MaxValue / 2
            ? new ProcessMemoryCapacity(gcBytes, "GC.TotalAvailableMemoryBytes")
            : new ProcessMemoryCapacity(64L * 1024 * 1024 * 1024, "Fallback64GiB");
    }

    public static ProcessMemoryCapacity SelectForTest(
        long hostBytes,
        long cgroupBytes,
        string cgroupSource = "CgroupMemoryLimit")
    {
        if (cgroupBytes >= MinimumUsefulCapacityBytes)
        {
            return hostBytes >= MinimumUsefulCapacityBytes && hostBytes < cgroupBytes
                ? new ProcessMemoryCapacity(hostBytes, "HostPhysicalMemory")
                : new ProcessMemoryCapacity(cgroupBytes, cgroupSource);
        }

        return hostBytes >= MinimumUsefulCapacityBytes
            ? new ProcessMemoryCapacity(hostBytes, "HostPhysicalMemory")
            : new ProcessMemoryCapacity(64L * 1024 * 1024 * 1024, "Fallback64GiB");
    }

    private static ProcessMemoryCapacity TryReadCgroupLimit()
    {
        if (!OperatingSystem.IsLinux()) return default;

        var candidates = new[]
        {
            (Path: "/sys/fs/cgroup/memory.max", Source: "CgroupV2MemoryMax"),
            (Path: "/sys/fs/cgroup/memory/memory.limit_in_bytes", Source: "CgroupV1MemoryLimit")
        };
        foreach (var candidate in candidates)
        {
            try
            {
                if (!File.Exists(candidate.Path)) continue;
                var raw = File.ReadAllText(candidate.Path).Trim();
                if (string.Equals(raw, "max", StringComparison.OrdinalIgnoreCase)) continue;
                if (long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var bytes)
                    && bytes >= MinimumUsefulCapacityBytes
                    && bytes < long.MaxValue / 2)
                {
                    return new ProcessMemoryCapacity(bytes, candidate.Source);
                }
            }
            catch
            {
                // 诊断保护不能因 cgroup 文件读取失败阻止 API 启动，继续回退到宿主机/GC 指标。
            }
        }

        return default;
    }

    private static long TryReadLinuxHostMemory()
    {
        if (!OperatingSystem.IsLinux()) return 0;
        try
        {
            foreach (var line in File.ReadLines("/proc/meminfo"))
            {
                if (!line.StartsWith("MemTotal:", StringComparison.OrdinalIgnoreCase)) continue;
                var parts = line.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
                return parts.Length >= 2
                       && long.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var kb)
                    ? checked(kb * 1024)
                    : 0;
            }
        }
        catch
        {
            // 非 Linux 或受限容器中回退到 GC 可用内存。
        }

        return 0;
    }
}

public sealed class ProcessMemoryGuardOptions
{
    public bool Enabled { get; init; } = true;
    public long SoftLimitBytes { get; init; }
    public long HardLimitBytes { get; init; }
    public int PollSeconds { get; init; } = 2;
    public int ConsecutiveHardSamples { get; init; } = 3;
    public int ExitGraceSeconds { get; init; } = 10;
    public bool HardExit { get; init; } = true;
    public long EffectiveMemoryBytes { get; init; }
    public string EffectiveMemorySource { get; init; } = "Unknown";
    public int SoftLimitPercent { get; init; }
    public int HardLimitPercent { get; init; }

    public static ProcessMemoryGuardOptions CreateDefault()
    {
        return ForCapacity(ProcessMemoryCapacity.Detect());
    }

    public static ProcessMemoryGuardOptions ForCapacity(ProcessMemoryCapacity capacity)
    {
        const long mb = 1024L * 1024L;
        const int softPercent = 95;
        const int hardPercent = 98;
        var effectiveBytes = capacity.TotalBytes >= 128L * mb
            ? capacity.TotalBytes
            : 64L * 1024 * mb;
        var effectiveMb = Math.Max(512, effectiveBytes / mb);
        var hardMb = Math.Max(512, effectiveMb * hardPercent / 100);
        var softMb = Math.Max(384, effectiveMb * softPercent / 100);

        return new ProcessMemoryGuardOptions
        {
            Enabled = true,
            SoftLimitBytes = softMb * mb,
            HardLimitBytes = hardMb * mb,
            EffectiveMemoryBytes = effectiveBytes,
            EffectiveMemorySource = string.IsNullOrWhiteSpace(capacity.Source)
                ? "Fallback64GiB"
                : capacity.Source,
            SoftLimitPercent = ToPercent(softMb, effectiveMb),
            HardLimitPercent = ToPercent(hardMb, effectiveMb),
            PollSeconds = 2,
            ConsecutiveHardSamples = 3,
            ExitGraceSeconds = 10,
            HardExit = true
        };
    }

    private static int ToPercent(long limitMb, long effectiveMb)
    {
        if (effectiveMb <= 0) return 0;
        return (int)Math.Clamp((limitMb * 100 + effectiveMb / 2) / effectiveMb, 0, 999);
    }

    public ProcessMemoryPressureLevel Evaluate(long processBytes)
    {
        if (!Enabled || processBytes < SoftLimitBytes) return ProcessMemoryPressureLevel.Normal;
        return processBytes >= HardLimitBytes
            ? ProcessMemoryPressureLevel.Hard
            : ProcessMemoryPressureLevel.Soft;
    }
}

public sealed class ProcessMemorySnapshot
{
    public bool RejectingRequests { get; init; }
    public bool ShutdownRequested { get; init; }
    public long ProcessBytes { get; init; }
    public long WorkingSetBytes { get; init; }
    public long PrivateBytes { get; init; }
    public long ManagedHeapBytes { get; init; }
    public long SoftLimitBytes { get; init; }
    public long HardLimitBytes { get; init; }
    public long EffectiveMemoryBytes { get; init; }
    public string EffectiveMemorySource { get; init; } = "Unknown";
    public int SoftLimitPercent { get; init; }
    public int HardLimitPercent { get; init; }
    public DateTime SampledAt { get; init; }
}

public sealed class ProcessMemoryPressureState
{
    private long _processBytes;
    private long _workingSetBytes;
    private long _privateBytes;
    private long _managedHeapBytes;
    private long _sampledAtTicks;
    private int _rejectingRequests;
    private int _shutdownRequested;
    private readonly ProcessMemoryGuardOptions _options;

    public ProcessMemoryPressureState(ProcessMemoryGuardOptions options)
    {
        _options = options;
    }

    public bool RejectingRequests => Volatile.Read(ref _rejectingRequests) == 1;

    internal void Update(long workingSetBytes, long privateBytes, long managedHeapBytes, bool rejecting)
    {
        Interlocked.Exchange(ref _workingSetBytes, workingSetBytes);
        Interlocked.Exchange(ref _privateBytes, privateBytes);
        // WorkingSet64 represents resident physical memory (RSS on Linux) and is
        // the metric that can actually exhaust the host/container. On Linux,
        // PrivateMemorySize64 may include the very large virtual address ranges
        // reserved by the .NET GC (hundreds of GB on a much smaller host). Using
        // that value for pressure decisions makes every healthy Linux node look
        // out of memory. Keep private bytes only as a diagnostic signal.
        Interlocked.Exchange(ref _processBytes, workingSetBytes);
        Interlocked.Exchange(ref _managedHeapBytes, managedHeapBytes);
        Interlocked.Exchange(ref _sampledAtTicks, DateTime.UtcNow.Ticks);
        Volatile.Write(ref _rejectingRequests, rejecting ? 1 : 0);
    }

    internal void MarkShutdownRequested()
    {
        Volatile.Write(ref _shutdownRequested, 1);
        Volatile.Write(ref _rejectingRequests, 1);
    }

    public ProcessMemorySnapshot GetSnapshot()
    {
        var ticks = Interlocked.Read(ref _sampledAtTicks);
        return new ProcessMemorySnapshot
        {
            RejectingRequests = RejectingRequests,
            ShutdownRequested = Volatile.Read(ref _shutdownRequested) == 1,
            ProcessBytes = Interlocked.Read(ref _processBytes),
            WorkingSetBytes = Interlocked.Read(ref _workingSetBytes),
            PrivateBytes = Interlocked.Read(ref _privateBytes),
            ManagedHeapBytes = Interlocked.Read(ref _managedHeapBytes),
            SoftLimitBytes = _options.SoftLimitBytes,
            HardLimitBytes = _options.HardLimitBytes,
            EffectiveMemoryBytes = _options.EffectiveMemoryBytes,
            EffectiveMemorySource = _options.EffectiveMemorySource,
            SoftLimitPercent = _options.SoftLimitPercent,
            HardLimitPercent = _options.HardLimitPercent,
            SampledAt = ticks > 0 ? new DateTime(ticks, DateTimeKind.Utc) : DateTime.MinValue
        };
    }
}

/// <summary>
/// API 进程级内存最后防线。软阈值先停止接收普通请求，硬阈值连续命中后
/// 请求宿主退出；若失控任务不响应取消，则在有界宽限期后强制退出，交由编排器重启。
/// </summary>
public sealed class ProcessMemoryGuardService : BackgroundService
{
    private readonly ProcessMemoryGuardOptions _options;
    private readonly ProcessMemoryPressureState _state;
    private readonly IHostApplicationLifetime _lifetime;
    private int _hardSamples;
    private bool _softPressureLogged;

    public ProcessMemoryGuardService(
        ProcessMemoryGuardOptions options,
        ProcessMemoryPressureState state,
        IHostApplicationLifetime lifetime)
    {
        _options = options;
        _state = state;
        _lifetime = lifetime;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            Console.WriteLine("Microi：【信息】API进程内存保护已通过配置禁用。");
            return;
        }

        Console.WriteLine(
            $"Microi：【信息】API进程内存保护已启动：Capacity={ToMb(_options.EffectiveMemoryBytes)}MB，" +
            $"Source={_options.EffectiveMemorySource}，Soft={ToMb(_options.SoftLimitBytes)}MB" +
            $"({_options.SoftLimitPercent}%)，Hard={ToMb(_options.HardLimitBytes)}MB" +
            $"({_options.HardLimitPercent}%)，Metric=ResidentSet，" +
            $"Samples={_options.ConsecutiveHardSamples}。");

        while (!stoppingToken.IsCancellationRequested)
        {
            var sample = ReadSample();
            var level = _options.Evaluate(sample.ProcessBytes);
            var recoveryLimit = _options.SoftLimitBytes * 85 / 100;
            var reject = level != ProcessMemoryPressureLevel.Normal
                         || (_state.RejectingRequests && sample.ProcessBytes >= recoveryLimit);
            _state.Update(sample.WorkingSetBytes, sample.PrivateBytes, sample.ManagedHeapBytes, reject);

            if (level == ProcessMemoryPressureLevel.Normal)
            {
                _hardSamples = 0;
                if (!reject && _softPressureLogged)
                {
                    _softPressureLogged = false;
                    Console.WriteLine($"Microi：【成功】API进程内存已恢复，当前={ToMb(sample.ProcessBytes)}MB，已恢复接收请求。");
                }
            }
            else
            {
                if (!_softPressureLogged)
                {
                    _softPressureLogged = true;
                    Console.Error.WriteLine(
                        $"Microi：【⚠️警告】API进程内存保护进入拒绝新请求状态：" +
                        $"Resident={ToMb(sample.ProcessBytes)}MB，Soft={ToMb(_options.SoftLimitBytes)}MB，" +
                        $"Hard={ToMb(_options.HardLimitBytes)}MB，Managed={ToMb(sample.ManagedHeapBytes)}MB，" +
                        $"PrivateAddressSpace={ToMb(sample.PrivateBytes)}MB。");
                }

                _hardSamples = level == ProcessMemoryPressureLevel.Hard ? _hardSamples + 1 : 0;
                if (_hardSamples >= _options.ConsecutiveHardSamples)
                {
                    await StopRunawayProcessAsync(sample).ConfigureAwait(false);
                    return;
                }
            }

            await Task.Delay(TimeSpan.FromSeconds(_options.PollSeconds), stoppingToken).ConfigureAwait(false);
        }
    }

    private async Task StopRunawayProcessAsync(MemorySample sample)
    {
        _state.MarkShutdownRequested();
        Console.Error.WriteLine(
            $"Microi：【Error异常】API进程内存保护触发有界停机：Resident={ToMb(sample.ProcessBytes)}MB，" +
            $"Hard={ToMb(_options.HardLimitBytes)}MB，连续样本={_hardSamples}。节点已退出流量并请求宿主停止。");
        _lifetime.StopApplication();
        await Task.Delay(TimeSpan.FromSeconds(_options.ExitGraceSeconds), CancellationToken.None).ConfigureAwait(false);

        var finalSample = ReadSample();
        if (_options.HardExit && finalSample.ProcessBytes >= _options.HardLimitBytes)
        {
            Console.Error.WriteLine(
                $"Microi：【Error异常】API进程内存保护宽限期结束后仍超硬阈值：" +
                $"Resident={ToMb(finalSample.ProcessBytes)}MB，将以退出码137强制结束进程。");
            Environment.Exit(137);
        }
    }

    private static MemorySample ReadSample()
    {
        using var process = Process.GetCurrentProcess();
        process.Refresh();
        var workingSet = process.WorkingSet64;
        var privateBytes = process.PrivateMemorySize64;
        return new MemorySample(
            workingSet,
            privateBytes,
            GC.GetTotalMemory(false));
    }

    private static long ToMb(long bytes) => bytes / (1024L * 1024L);

    private readonly record struct MemorySample(long WorkingSetBytes, long PrivateBytes, long ManagedHeapBytes)
    {
        // Never use PrivateBytes for the guard threshold on Linux: it can
        // represent reserved virtual address space rather than resident RAM.
        public long ProcessBytes => WorkingSetBytes;
    }
}
