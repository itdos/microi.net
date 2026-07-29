using System.Diagnostics;

namespace Microi.net.Api;

public enum ProcessMemoryPressureLevel
{
    Normal = 0,
    Soft = 1,
    Hard = 2
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

    public static ProcessMemoryGuardOptions FromConfiguration(
        IHostEnvironment environment,
        IConfiguration? configuration = null)
    {
        const long mb = 1024L * 1024L;
        var reportedAvailableBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
        var reportedAvailableMb = reportedAvailableBytes > 0 && reportedAvailableBytes < long.MaxValue / 2
            ? reportedAvailableBytes / mb
            : 0;
        // A single API node must never be allowed to consume an entire 32-48GB
        // host. Four gigabytes is a deliberately conservative per-process
        // ceiling; operators may raise it explicitly after measuring their
        // workload and accounting for co-located API/Worker nodes.
        const long defaultCeilingMb = 4096;
        var defaultHardMb = reportedAvailableMb > 0
            ? Math.Min(defaultCeilingMb, Math.Max(512, reportedAvailableMb * 70 / 100))
            : defaultCeilingMb;
        var hardMb = Math.Clamp(ReadLong(
            configuration,
            "ProcessMemoryGuard:HardLimitMB",
            "MICROI_PROCESS_MEMORY_GUARD_HARD_LIMIT_MB",
            defaultHardMb), 512, 262144);
        var defaultSoftMb = Math.Max(384, hardMb * 80 / 100);
        var softMb = Math.Clamp(ReadLong(
            configuration,
            "ProcessMemoryGuard:SoftLimitMB",
            "MICROI_PROCESS_MEMORY_GUARD_SOFT_LIMIT_MB",
            defaultSoftMb), 256, Math.Max(256, hardMb - 128));

        return new ProcessMemoryGuardOptions
        {
            Enabled = ReadBool(
                configuration,
                "ProcessMemoryGuard:Enabled",
                "MICROI_PROCESS_MEMORY_GUARD_ENABLED",
                true),
            SoftLimitBytes = softMb * mb,
            HardLimitBytes = hardMb * mb,
            PollSeconds = Math.Clamp(ReadInt(
                configuration,
                "ProcessMemoryGuard:PollSeconds",
                "MICROI_PROCESS_MEMORY_GUARD_POLL_SECONDS",
                2), 1, 60),
            ConsecutiveHardSamples = Math.Clamp(ReadInt(
                configuration,
                "ProcessMemoryGuard:HardSamples",
                "MICROI_PROCESS_MEMORY_GUARD_HARD_SAMPLES",
                3), 1, 30),
            ExitGraceSeconds = Math.Clamp(ReadInt(
                configuration,
                "ProcessMemoryGuard:ExitGraceSeconds",
                "MICROI_PROCESS_MEMORY_GUARD_EXIT_GRACE_SECONDS",
                10), 1, 120),
            HardExit = ReadBool(
                configuration,
                "ProcessMemoryGuard:HardExit",
                "MICROI_PROCESS_MEMORY_GUARD_HARD_EXIT",
                true)
        };
    }

    private static string? ReadValue(
        IConfiguration? configuration,
        string configKey,
        string environmentKey)
    {
        var value = Environment.GetEnvironmentVariable(environmentKey);
        if (!string.IsNullOrWhiteSpace(value)) return value;
        value = configuration?[environmentKey];
        if (!string.IsNullOrWhiteSpace(value)) return value;
        return configuration?[configKey];
    }

    private static long ReadLong(
        IConfiguration? configuration,
        string configKey,
        string environmentKey,
        long defaultValue)
    {
        return long.TryParse(ReadValue(configuration, configKey, environmentKey), out var value)
               && value > 0
            ? value
            : defaultValue;
    }

    private static int ReadInt(
        IConfiguration? configuration,
        string configKey,
        string environmentKey,
        int defaultValue)
    {
        return int.TryParse(ReadValue(configuration, configKey, environmentKey), out var value)
               && value > 0
            ? value
            : defaultValue;
    }

    private static bool ReadBool(
        IConfiguration? configuration,
        string configKey,
        string environmentKey,
        bool defaultValue)
    {
        var value = ReadValue(configuration, configKey, environmentKey);
        if (bool.TryParse(value, out var parsed)) return parsed;
        if (string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "on", StringComparison.OrdinalIgnoreCase)) return true;
        if (string.Equals(value, "0", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "no", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "off", StringComparison.OrdinalIgnoreCase)) return false;
        return defaultValue;
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
            $"Microi：【信息】API进程内存保护已启动：Soft={ToMb(_options.SoftLimitBytes)}MB，" +
            $"Hard={ToMb(_options.HardLimitBytes)}MB，Metric=ResidentSet，" +
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
