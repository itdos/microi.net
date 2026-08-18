using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json;

namespace Microi.net.Api;

public sealed class SysLogQueueOptions
{
    public int Capacity { get; init; } = 4096;
    public int OverflowCapacity { get; init; } = 512;
    public int BatchSize { get; init; } = 250;
    public int MaxSpoolFiles { get; init; } = 10000;
    public string? SpoolDirectory { get; init; }
    /// <summary>
    /// 测试注入点。生产环境为空时只从当前租户运行时 SaaS 配置判断，
    /// 禁止通过环境变量或 appsettings 另开一套业务配置来源。
    /// </summary>
    public Func<string, bool>? PersistenceConfigured { get; init; }

    public static SysLogQueueOptions CreateDefault()
    {
        return new SysLogQueueOptions
        {
            Capacity = 4096,
            OverflowCapacity = 512,
            BatchSize = 250,
            MaxSpoolFiles = 10000,
            SpoolDirectory = null
        };
    }
}

/// <summary>
/// 用户行为/系统日志后台队列：请求线程只入队；单消费者批量、幂等写MongoDB。
/// 每个批次先写本地spool再写Mongo，故障批次由后台持续重放，正常停机时会完整排空到spool。
/// </summary>
public sealed class SysLogQueueService : BackgroundService, ISysLogQueue
{
    private static readonly TimeSpan BatchWindow = TimeSpan.FromMilliseconds(150);
    private static readonly TimeSpan ReplayInterval = TimeSpan.FromSeconds(5);
    // 日志落盘前统一遮蔽微信一次性登录 code 与回调 AESKey。
    private static readonly Regex SensitiveJson = new(
        "(?i)(\\\"?(?:password|pwd|token|authorization|apikey|secret|logincode|encodingaeskey|connectionstring)\\\"?\\s*[:=]\\s*\\\"?)[^\\\",}&\\s]+",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly Channel<SysLogParam> _channel;
    private readonly ConcurrentQueue<SysLogParam> _overflow = new();
    private readonly ConcurrentDictionary<string, (bool Configured, long ExpiresAtTicks)> _persistenceConfiguration =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly SysLogQueueOptions _options;
    private readonly IMongoDB _mongo;
    private readonly ILogger<SysLogQueueService> _logger;
    private readonly string _spoolDirectory;
    private readonly string _nodeId;
    private readonly string _serviceName;
    private readonly string _serviceVersion;
    private readonly string _environmentName;
    private long _enqueued;
    private long _persisted;
    private long _retried;
    private long _inMemory;
    private long _failedBatches;
    private long _overflowCount;
    private long _emergencySpooled;
    private long _dropped;
    private long _skippedUnconfigured;
    private long _spoolFileCount;
    private long _lastOverflowDiagnosticTicks;
    private long _lastPersistenceWarningTicks;
    private int _stopping;
    private int _replayFailureStreak;
    private string? _lastError;
    private long _lastPersistedTicks;

    public SysLogQueueService(IMongoDB mongo, ILogger<SysLogQueueService> logger, IHostEnvironment environment)
        : this(mongo, logger, environment, SysLogQueueOptions.CreateDefault())
    {
    }

    public SysLogQueueService(
        IMongoDB mongo,
        ILogger<SysLogQueueService> logger,
        IHostEnvironment environment,
        SysLogQueueOptions options)
    {
        _mongo = mongo;
        _logger = logger;
        _options = options ?? SysLogQueueOptions.CreateDefault();
        _channel = Channel.CreateBounded<SysLogParam>(new BoundedChannelOptions(_options.Capacity)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
            AllowSynchronousContinuations = false
        });
        var configured = _options.SpoolDirectory;
        var candidate = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, "logs", "syslog-spool")
            : Path.GetFullPath(configured);
        try
        {
            Directory.CreateDirectory(candidate);
            _spoolDirectory = candidate;
        }
        catch (Exception ex)
        {
            var appName = Regex.Replace(environment.ApplicationName ?? "microi", "[^a-zA-Z0-9_.-]", "_");
            _spoolDirectory = Path.Combine(Path.GetTempPath(), "microi-syslog-spool", appName);
            Directory.CreateDirectory(_spoolDirectory);
            _logger.LogError(ex, "配置的日志spool目录不可用，已降级到临时目录 {Spool}", _spoolDirectory);
        }
        _nodeId = NormalizeNodeId(Environment.MachineName);
        _serviceName = Limit(environment.ApplicationName, 128) ?? "Microi.net.Api";
        _serviceVersion = Limit(Assembly.GetEntryAssembly()?.GetName().Version?.ToString(), 64);
        _environmentName = Limit(environment.EnvironmentName, 64);
        RecoverTempSpools();
        _spoolFileCount = CountSpoolFiles();
    }

    public bool Enqueue(SysLogParam param)
    {
        if (param == null) return false;
        try
        {
            if (string.IsNullOrWhiteSpace(param.EventId)) param.EventId = Ulid.NewUlid().ToString();
            var snapshot = Snapshot(param);
            if (string.IsNullOrWhiteSpace(snapshot.OsClient)) return false;

            Interlocked.Increment(ref _enqueued);
            // 入队可能发生在 MicroiEngine 初始化缓存之前。这里绝不能读取租户配置，
            // 否则 OsClient -> Cache -> 启动日志 -> Enqueue 会形成初始化依赖环。
            // 是否配置 MongoDB 统一由后台单消费者在持久化前判定。
            Interlocked.Increment(ref _inMemory);
            if (Volatile.Read(ref _stopping) == 1)
                return TryEmergencySpool(snapshot, "服务正在停机");
            if (_channel.Writer.TryWrite(snapshot) || TryEnqueueOverflow(snapshot)) return true;
            return TryEmergencySpool(snapshot, "内存日志队列达到容量上限");
        }
        catch (Exception ex)
        {
            _lastError = "日志入队失败：" + ex.Message;
            _logger.LogError(ex, "Microi用户行为日志入队失败");
            return false;
        }
    }

    public SysLogQueueHealth GetHealth()
    {
        DateTime? last = null;
        var ticks = Interlocked.Read(ref _lastPersistedTicks);
        if (ticks > 0) last = new DateTime(ticks, DateTimeKind.Local);
        var spoolFiles = Math.Max(0, Interlocked.Read(ref _spoolFileCount));
        return new SysLogQueueHealth
        {
            NodeId = _nodeId,
            Enqueued = Interlocked.Read(ref _enqueued),
            Persisted = Interlocked.Read(ref _persisted),
            Retried = Interlocked.Read(ref _retried),
            Pending = Interlocked.Read(ref _inMemory) + spoolFiles,
            Capacity = _options.Capacity,
            OverflowCapacity = _options.OverflowCapacity,
            OverflowPending = Interlocked.Read(ref _overflowCount),
            EmergencySpooled = Interlocked.Read(ref _emergencySpooled),
            Dropped = Interlocked.Read(ref _dropped),
            SkippedUnconfigured = Interlocked.Read(ref _skippedUnconfigured),
            FailedBatches = Interlocked.Read(ref _failedBatches),
            LastError = _lastError,
            LastPersistedAt = last,
            SpoolDirectory = _spoolDirectory
        };
    }

    public async Task FlushAsync(CancellationToken cancellationToken = default)
    {
        while (Interlocked.Read(ref _inMemory) > 0)
            await Task.Delay(25, cancellationToken).ConfigureAwait(false);
        await ReplaySpoolAsync(cancellationToken, 20).ConfigureAwait(false);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Microi异步日志队列已启动，NodeId={NodeId}, Capacity={Capacity}, OverflowCapacity={OverflowCapacity}, BatchSize={BatchSize}, MaxSpoolFiles={MaxSpoolFiles}, Spool={Spool}",
            _nodeId, _options.Capacity, _options.OverflowCapacity, _options.BatchSize, _options.MaxSpoolFiles, _spoolDirectory);
        var replaySucceeded = await ReplaySpoolAsync(stoppingToken, 20).ConfigureAwait(false);
        var nextReplay = DateTime.UtcNow.Add(GetReplayDelay(replaySucceeded));

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var batch = await ReadBatchAsync(stoppingToken).ConfigureAwait(false);
                if (batch.Count > 0) await JournalAndPersistAsync(batch, stoppingToken).ConfigureAwait(false);

                if (DateTime.UtcNow >= nextReplay)
                {
                    replaySucceeded = await ReplaySpoolAsync(stoppingToken, 20).ConfigureAwait(false);
                    nextReplay = DateTime.UtcNow.Add(GetReplayDelay(replaySucceeded));
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally
        {
            await DrainToSpoolAsync().ConfigureAwait(false);
            _logger.LogInformation("Microi异步日志队列已停止，内存队列已落入spool。");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        Volatile.Write(ref _stopping, 1);
        _channel.Writer.TryComplete();
        await base.StopAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<List<SysLogParam>> ReadBatchAsync(CancellationToken cancellationToken)
    {
        var batch = new List<SysLogParam>(_options.BatchSize);
        while (batch.Count < _options.BatchSize && TryDequeueOverflow(out var overflowItem)) batch.Add(overflowItem);
        while (batch.Count < _options.BatchSize && _channel.Reader.TryRead(out var item)) batch.Add(item);
        if (batch.Count == 0)
        {
            if (!await _channel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false)) return batch;
            if (_channel.Reader.TryRead(out var first)) batch.Add(first);
        }

        // 一旦事件已从Channel取出，就必须完成本批次落盘；正常停机取消不能丢掉局部批次。
        if (batch.Count < _options.BatchSize) await Task.Delay(BatchWindow, CancellationToken.None).ConfigureAwait(false);
        while (batch.Count < _options.BatchSize && TryDequeueOverflow(out var overflowItem)) batch.Add(overflowItem);
        while (batch.Count < _options.BatchSize && _channel.Reader.TryRead(out var item)) batch.Add(item);
        return batch;
    }

    private async Task JournalAndPersistAsync(List<SysLogParam> batch, CancellationToken cancellationToken)
    {
        if (batch.Count == 0) return;
        batch = FilterPersistableBatch(batch);
        if (batch.Count == 0) return;
        if (IsSpoolAtCapacity())
        {
            // 已有 spool 超出硬上限时仍优先直写 Mongo；成功则不需要 journal，
            // 失败则丢弃当前可选日志并显式计数，绝不继续侵占磁盘。
            // 必须按租户和月份隔离直写：一个租户的 Mongo 熔断不能连带丢弃
            // 同一队列批次内其它健康租户的日志。
            Interlocked.Add(ref _inMemory, -batch.Count);
            var failed = false;
            var isolatedBatches = batch.GroupBy(item => new
            {
                OsClient = item.OsClient?.Trim().ToLowerInvariant() ?? string.Empty,
                Month = item.OccurredAt.GetValueOrDefault(DateTime.Now).ToString("yyyyMM")
            });
            foreach (var isolatedBatch in isolatedBatches)
            {
                var tenantBatch = isolatedBatch.ToList();
                try
                {
                    var directResult = await _mongo.AddSysLogs(tenantBatch).ConfigureAwait(false);
                    if (directResult.Code != 1)
                        throw new InvalidOperationException(directResult.Msg ?? "MongoDB批量写日志失败。");
                    MarkPersisted(tenantBatch.Count);
                }
                catch (Exception ex) when (!(ex is OperationCanceledException && cancellationToken.IsCancellationRequested))
                {
                    failed = true;
                    Interlocked.Increment(ref _failedBatches);
                    Interlocked.Add(ref _dropped, tenantBatch.Count);
                    _lastError = $"日志spool已达到{_options.MaxSpoolFiles}个文件的硬上限，租户{isolatedBatch.Key.OsClient}的MongoDB直写失败：{ex.Message}";
                    LogPersistenceWarning(ex, "Microi日志持久化暂不可用；spool已达硬上限，仅丢弃失败租户批次；OsClient={OsClient}, Count={Count}, SpoolFiles={SpoolFiles}",
                        isolatedBatch.Key.OsClient, tenantBatch.Count, Interlocked.Read(ref _spoolFileCount));
                }
            }
            if (!failed) _lastError = null;
            return;
        }
        string? spoolPath = null;
        try
        {
            // 本地journal是可靠性边界，已经取出的批次不能被宿主取消中断。
            spoolPath = await WriteSpoolAsync(batch, CancellationToken.None).ConfigureAwait(false);
            Interlocked.Add(ref _inMemory, -batch.Count);
            var result = await _mongo.AddSysLogs(batch).ConfigureAwait(false);
            if (result.Code != 1) throw new InvalidOperationException(result.Msg ?? "MongoDB批量写日志失败。");
            File.Delete(spoolPath);
            Interlocked.Decrement(ref _spoolFileCount);
            MarkPersisted(batch.Count);
        }
        catch (Exception ex) when (!(ex is OperationCanceledException && cancellationToken.IsCancellationRequested))
        {
            Interlocked.Increment(ref _failedBatches);
            _lastError = ex.Message;
            LogPersistenceWarning(ex, "Microi日志批次持久化失败，已保留spool；Count={Count}, File={File}", batch.Count, spoolPath);
            if (spoolPath == null)
            {
                // 内存重试区也必须有硬上限；超过上限时同步尝试耐久化，禁止无界堆积。
                foreach (var item in batch)
                {
                    if (!TryEnqueueOverflow(item)) TryEmergencySpool(item, "日志批次journal失败且内存重试区已满");
                }
            }
        }
    }

    private async Task<bool> ReplaySpoolAsync(CancellationToken cancellationToken, int maxFiles)
    {
        string[] files;
        // 不再对全部历史文件进行 OrderBy。19万文件时，每5秒全量排序本身就会
        // 造成明显的磁盘/CPU抖动；文件名已含时间，重放只需有界枚举。
        try { files = Directory.EnumerateFiles(_spoolDirectory, "*.json").Take(Math.Max(1, maxFiles)).ToArray(); }
        catch (Exception ex) { _lastError = ex.Message; return false; }

        foreach (var file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var json = await File.ReadAllTextAsync(file, cancellationToken).ConfigureAwait(false);
                var batch = JsonConvert.DeserializeObject<List<SysLogParam>>(json) ?? new List<SysLogParam>();
                if (batch.Count == 0)
                {
                    File.Delete(file);
                    Interlocked.Decrement(ref _spoolFileCount);
                    continue;
                }
                if (batch.Any(item => !IsPersistenceConfigured(item?.OsClient)))
                {
                    // 历史文件保留给运维处理，不删除、不反复报警；通过退避降低扫描频率。
                    _lastError = "历史日志spool所属租户未配置DbMongoConnection，已暂停重放且保留原文件。";
                    return false;
                }
                var result = await _mongo.AddSysLogs(batch).ConfigureAwait(false);
                if (result.Code != 1) throw new InvalidOperationException(result.Msg ?? "MongoDB重放日志失败。");
                File.Delete(file);
                Interlocked.Decrement(ref _spoolFileCount);
                Interlocked.Add(ref _retried, batch.Count);
                MarkPersisted(batch.Count);
                _lastError = null;
            }
            catch (Exception ex) when (!(ex is OperationCanceledException && cancellationToken.IsCancellationRequested))
            {
                _lastError = ex.Message;
                Interlocked.Increment(ref _failedBatches);
                LogPersistenceWarning(ex, "Microi历史日志spool重放失败，已进入退避；File={File}", file);
                return false; // Mongo熔断期间不空转扫描其余文件。
            }
        }
        return true;
    }

    private async Task DrainToSpoolAsync()
    {
        var batch = new List<SysLogParam>(_options.BatchSize);
        while (TryDequeueOverflow(out var overflowItem) || _channel.Reader.TryRead(out overflowItem))
        {
            batch.Add(overflowItem);
            if (batch.Count < _options.BatchSize) continue;
            try { await WriteSpoolAsync(batch, CancellationToken.None).ConfigureAwait(false); Interlocked.Add(ref _inMemory, -batch.Count); }
            catch { EmergencySpoolBatch(batch, "服务停机排空日志批次失败"); }
            batch = new List<SysLogParam>(_options.BatchSize);
        }
        if (batch.Count > 0)
        {
            try { await WriteSpoolAsync(batch, CancellationToken.None).ConfigureAwait(false); Interlocked.Add(ref _inMemory, -batch.Count); }
            catch { EmergencySpoolBatch(batch, "服务停机排空尾批次失败"); }
        }
    }

    private bool TryEnqueueOverflow(SysLogParam item)
    {
        if (_options.OverflowCapacity <= 0) return false;
        while (true)
        {
            var current = Interlocked.Read(ref _overflowCount);
            if (current >= _options.OverflowCapacity) return false;
            if (Interlocked.CompareExchange(ref _overflowCount, current + 1, current) != current) continue;
            _overflow.Enqueue(item);
            return true;
        }
    }

    private bool TryDequeueOverflow(out SysLogParam item)
    {
        if (_overflow.TryDequeue(out item!))
        {
            Interlocked.Decrement(ref _overflowCount);
            return true;
        }
        item = null!;
        return false;
    }

    private bool TryEmergencySpool(SysLogParam item, string reason)
    {
        try
        {
            WriteSpoolSynchronously(new List<SysLogParam>(1) { item });
            Interlocked.Decrement(ref _inMemory);
            var count = Interlocked.Increment(ref _emergencySpooled);
            if (count == 1 || count % 1000 == 0)
            {
                WriteOverflowDiagnostic($"{reason}，已同步写入持久化spool；累计={count}。", false);
            }
            return true;
        }
        catch (Exception ex)
        {
            Interlocked.Decrement(ref _inMemory);
            Interlocked.Increment(ref _dropped);
            _lastError = $"{reason}，且紧急spool失败：{ex.Message}";
            WriteOverflowDiagnostic(_lastError, true);
            return false;
        }
    }

    private void EmergencySpoolBatch(IEnumerable<SysLogParam> batch, string reason)
    {
        foreach (var item in batch) TryEmergencySpool(item, reason);
    }

    private void WriteOverflowDiagnostic(string message, bool force)
    {
        var now = DateTime.UtcNow.Ticks;
        var previous = Interlocked.Read(ref _lastOverflowDiagnosticTicks);
        if (previous > 0 && new TimeSpan(now - previous) < TimeSpan.FromSeconds(30)) return;
        if (Interlocked.CompareExchange(ref _lastOverflowDiagnosticTicks, now, previous) != previous) return;
        Console.Error.WriteLine($"Microi：【{(force ? "Error异常" : "⚠️警告")}】SysLogQueueService：{message}");
    }

    private async Task<string> WriteSpoolAsync(List<SysLogParam> batch, CancellationToken cancellationToken)
    {
        if (IsSpoolAtCapacity()) throw new IOException($"日志spool已达到{_options.MaxSpoolFiles}个文件的硬上限。");
        Directory.CreateDirectory(_spoolDirectory);
        // NodeId使共享持久卷上的批次来源可定位；EventId upsert保证多节点并发重放仍然幂等。
        var name = $"{DateTime.UtcNow:yyyyMMddHHmmssfffffff}_{_nodeId}_{batch[0].EventId}.json";
        var final = Path.Combine(_spoolDirectory, name);
        var temp = final + ".tmp";
        var json = JsonConvert.SerializeObject(batch, Formatting.None);
        var bytes = Encoding.UTF8.GetBytes(json);
        await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.Read,
                         64 * 1024, FileOptions.Asynchronous | FileOptions.WriteThrough))
        {
            await stream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
            await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
            stream.Flush(true);
        }
        File.Move(temp, final);
        Interlocked.Increment(ref _spoolFileCount);
        return final;
    }

    private string WriteSpoolSynchronously(List<SysLogParam> batch)
    {
        if (IsSpoolAtCapacity()) throw new IOException($"日志spool已达到{_options.MaxSpoolFiles}个文件的硬上限。");
        Directory.CreateDirectory(_spoolDirectory);
        var name = $"{DateTime.UtcNow:yyyyMMddHHmmssfffffff}_{_nodeId}_{batch[0].EventId}.json";
        var final = Path.Combine(_spoolDirectory, name);
        var temp = final + ".tmp";
        var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(batch, Formatting.None));
        using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.Read,
                   64 * 1024, FileOptions.WriteThrough))
        {
            stream.Write(bytes, 0, bytes.Length);
            stream.Flush(true);
        }
        File.Move(temp, final);
        Interlocked.Increment(ref _spoolFileCount);
        return final;
    }

    private bool IsPersistenceConfigured(string? osClient)
    {
        if (string.IsNullOrWhiteSpace(osClient)) return false;
        if (_options.PersistenceConfigured != null) return _options.PersistenceConfigured(osClient);
        var normalized = osClient.Trim();
        var now = DateTime.UtcNow.Ticks;
        if (_persistenceConfiguration.TryGetValue(normalized, out var cached)
            && cached.ExpiresAtTicks > now)
            return cached.Configured;
        try
        {
            // 日志后台线程只能读取 SaaS 引擎已水合的进程内快照；禁止调用 GetClient，
            // 后者会访问二级缓存，而缓存构造又依赖 GetClient，启动早期会递归。
            // ReloadSingleOsClient 会同步更新 ClientList，因此这里仍能感知运行期配置变化。
            var clients = Microi.net.OsClient.ClientList;
            var found = clients.TryGetValue(normalized, out var client);
            if (!found)
            {
                // ClientList 的键历史上存在大小写差异；先做无关大小写的规范化查找。
                foreach (var candidate in clients.Keys)
                {
                    if (!string.Equals(candidate, normalized, StringComparison.OrdinalIgnoreCase)) continue;
                    found = clients.TryGetValue(candidate, out client);
                    break;
                }
            }
            if (!found)
            {
                // 启动极早期 ClientList 尚为空时仍保守保留日志；一旦租户快照已经水合，
                // 明确不存在的租户就是已删除/无效历史租户，不应反复交给 MongoDB 报错。
                if (clients.Count == 0) return true;
                _persistenceConfiguration[normalized] = (false, now + TimeSpan.FromSeconds(30).Ticks);
                return false;
            }
            if (client?.OsClientModel == null) return true;
            var connection = client.OsClientModel["DbMongoConnection"]?.Val<string>();
            var configured = !connection.DosIsNullOrWhiteSpace();
            var ttl = configured ? TimeSpan.FromMinutes(1) : TimeSpan.FromMinutes(5);
            _persistenceConfiguration[normalized] = (configured, now + ttl.Ticks);
            return configured;
        }
        catch
        {
            // 配置读取异常不能被误判为“租户明确关闭持久化”，否则会静默丢日志。
            _persistenceConfiguration.TryRemove(normalized, out _);
            return true;
        }
    }

    private List<SysLogParam> FilterPersistableBatch(List<SysLogParam> batch)
    {
        var tenantStates = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        var persistable = new List<SysLogParam>(batch.Count);
        var skipped = 0;
        foreach (var item in batch)
        {
            var osClient = item?.OsClient?.Trim() ?? string.Empty;
            if (!tenantStates.TryGetValue(osClient, out var configured))
            {
                configured = IsPersistenceConfigured(osClient);
                tenantStates[osClient] = configured;
            }
            if (configured) persistable.Add(item!);
            else skipped++;
        }

        if (skipped > 0)
        {
            Interlocked.Add(ref _inMemory, -skipped);
            Interlocked.Add(ref _skippedUnconfigured, skipped);
        }
        return persistable;
    }

    private bool IsSpoolAtCapacity()
    {
        return _options.MaxSpoolFiles > 0
               && Interlocked.Read(ref _spoolFileCount) >= _options.MaxSpoolFiles;
    }

    private long CountSpoolFiles()
    {
        try
        {
            // 健康判断只关心是否达到硬上限。历史目录可能已有十几万文件，
            // 启动时全量 LongCount 会无谓扫描整个目录并拖慢 API 就绪。
            var limit = _options.MaxSpoolFiles > 0 ? _options.MaxSpoolFiles : long.MaxValue;
            long count = 0;
            foreach (var pattern in new[] { "*.json", "*.tmp" })
            {
                foreach (var _ in Directory.EnumerateFiles(_spoolDirectory, pattern))
                {
                    count++;
                    if (count >= limit) return count;
                }
            }
            return count;
        }
        catch
        {
            return 0;
        }
    }

    private TimeSpan GetReplayDelay(bool replaySucceeded)
    {
        if (replaySucceeded)
        {
            _replayFailureStreak = 0;
            return ReplayInterval;
        }

        _replayFailureStreak = Math.Min(_replayFailureStreak + 1, 8);
        var seconds = Math.Min(900, ReplayInterval.TotalSeconds * Math.Pow(2, _replayFailureStreak));
        return TimeSpan.FromSeconds(seconds);
    }

    private void LogPersistenceWarning(Exception exception, string message, params object[] args)
    {
        var now = DateTime.UtcNow.Ticks;
        var previous = Interlocked.Read(ref _lastPersistenceWarningTicks);
        if (previous > 0 && new TimeSpan(now - previous) < TimeSpan.FromMinutes(5)) return;
        if (Interlocked.CompareExchange(ref _lastPersistenceWarningTicks, now, previous) != previous) return;
        _logger.LogWarning(exception, message, args);
    }

    private void RecoverTempSpools()
    {
        try
        {
            foreach (var temp in Directory.EnumerateFiles(_spoolDirectory, "*.json.tmp"))
            {
                try
                {
                    var json = File.ReadAllText(temp);
                    var batch = JsonConvert.DeserializeObject<List<SysLogParam>>(json);
                    if (batch == null || batch.Count == 0) continue;
                    var final = temp.Substring(0, temp.Length - ".tmp".Length);
                    File.Move(temp, final, true);
                    _logger.LogWarning("已恢复上次异常退出遗留的日志临时批次 {File}", Path.GetFileName(final));
                }
                catch (Exception ex)
                {
                    // 保留无法确认完整性的临时文件，交由运维检查，禁止静默删除。
                    _lastError = "存在未完成的日志临时批次：" + Path.GetFileName(temp);
                    _logger.LogError(ex, "日志临时批次恢复失败，文件已保留：{File}", temp);
                }
            }
        }
        catch (Exception ex)
        {
            _lastError = ex.Message;
            _logger.LogError(ex, "扫描日志临时批次失败");
        }
    }

    private void MarkPersisted(int count)
    {
        Interlocked.Add(ref _persisted, count);
        Interlocked.Exchange(ref _lastPersistedTicks, DateTime.Now.Ticks);
    }

    private SysLogParam Snapshot(SysLogParam source)
    {
        var now = source.OccurredAt ?? DateTime.Now;
        var activity = Activity.Current;
        Microsoft.AspNetCore.Http.HttpContext? context = null;
        try { context = DiyHttpContext.Current; } catch { /* 非Web宿主或极早期启动阶段没有HttpContextAccessor。 */ }
        var osClient = source.OsClient;
        if (string.IsNullOrWhiteSpace(osClient))
        {
            // 兼容历史 AddSysLog 调用：旧的直写实现会从当前请求/任务上下文补齐租户。
            try { osClient = DiyToken.GetCurrentOsClient(); } catch { /* 无上下文时由 Enqueue 明确拒绝。 */ }
        }
        var userId = source.UserId;
        var userName = source.UserName;
        try
        {
            var currentUser = source._CurrentUser;
            if (string.IsNullOrWhiteSpace(userId)) userId = currentUser?["Id"]?.ToString();
            if (string.IsNullOrWhiteSpace(userName))
            {
                var name = currentUser?["Name"]?.ToString();
                var account = currentUser?["Account"]?.ToString();
                userName = FormatUser(name, account);
            }
        }
        catch { }

        return new SysLogParam
        {
            EventId = source.EventId,
            SessionId = Limit(source.SessionId, 128),
            Category = Limit(source.Category, 64),
            Action = Limit(source.Action, 64),
            Source = Limit(source.Source, 64) ?? "Server",
            ClientType = Limit(source.ClientType, 64),
            Did = Limit(source.Did, 128),
            TargetType = Limit(source.TargetType, 64),
            TargetId = Limit(source.TargetId, 256),
            DurationSeconds = source.DurationSeconds,
            Success = source.Success,
            TraceId = Limit(source.TraceId
                            ?? (activity != null && activity.IdFormat == ActivityIdFormat.W3C
                                ? activity.TraceId.ToHexString()
                                : null)
                            ?? context?.TraceIdentifier, 128),
            SpanId = Limit(source.SpanId
                           ?? (activity != null && activity.IdFormat == ActivityIdFormat.W3C
                               ? activity.SpanId.ToHexString()
                               : null), 32),
            ParentSpanId = Limit(source.ParentSpanId
                                 ?? (activity != null && activity.IdFormat == ActivityIdFormat.W3C
                                     && activity.ParentSpanId != default
                                     ? activity.ParentSpanId.ToHexString()
                                     : null), 32),
            TraceFlags = Limit(source.TraceFlags
                               ?? (activity != null && activity.IdFormat == ActivityIdFormat.W3C
                                   ? ((byte)activity.ActivityTraceFlags).ToString("x2")
                                   : null), 8),
            ServiceName = Limit(!string.IsNullOrWhiteSpace(source.ServiceName)
                ? source.ServiceName
                : (!string.IsNullOrWhiteSpace(activity?.Source.Name) ? activity.Source.Name : _serviceName), 128),
            ServiceVersion = Limit(source.ServiceVersion ?? _serviceVersion, 64),
            NodeId = Limit(source.NodeId ?? _nodeId, 128),
            Environment = Limit(source.Environment ?? _environmentName, 64),
            DurationMs = source.DurationMs ?? (activity != null && activity.Duration > TimeSpan.Zero
                ? activity.Duration.TotalMilliseconds
                : null),
            HttpStatusCode = source.HttpStatusCode ?? context?.Response?.StatusCode,
            OccurredAt = now,
            OsClient = Limit(osClient, 128),
            AppId = Limit(source.AppId, 256),
            Api = Limit(source.Api, 1024),
            Param = Sanitize(source.Param, 8192),
            Remark = Limit(source.Remark, 2048),
            Type = Limit(source.Type, 128),
            UserId = Limit(userId, 128),
            UserName = Limit(string.IsNullOrWhiteSpace(userName) ? "匿名" : userName, 512),
            Title = Sanitize(source.Title, 2048),
            Content = Sanitize(source.Content, 16384),
            IP = Limit(source.IP ?? IPHelper.GetClientIP(context).Data, 128),
            Mac = Limit(source.Mac, 128),
            OtherInfo = Sanitize(source.OtherInfo, 8192),
            Timer = source.Timer,
            Result = Sanitize(source.Result, 8192),
            Level = source.Level
        };
    }

    internal static string FormatUser(string? name, string? account)
    {
        name = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        account = string.IsNullOrWhiteSpace(account) ? null : account.Trim();
        if (name == null && account == null) return "匿名";
        if (name == null) return account!;
        if (account == null || string.Equals(name, account, StringComparison.OrdinalIgnoreCase)) return name;
        return $"{name}({account})";
    }

    private static string? Sanitize(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return Limit(SensitiveJson.Replace(value, "$1***"), max);
    }

    private static string? Limit(string? value, int max)
    {
        if (value == null || value.Length <= max) return value;
        return value.Substring(0, max) + "…";
    }

    private static string NormalizeNodeId(string? value)
    {
        var normalized = Regex.Replace(value.DosIsNullOrWhiteSpace("unknown-node"), "[^a-zA-Z0-9_.-]", "_");
        return normalized.Length <= 64 ? normalized : normalized.Substring(0, 64);
    }
}
