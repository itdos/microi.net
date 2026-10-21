using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Microi.net;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

public enum TcpIngressState
{
    NotStarted,
    Disabled,
    Starting,
    Listening,
    Faulted,
    Stopping,
    Stopped
}

/// <summary>
/// 与 HTTP API 共用同一个进程、DI、租户缓存和接口引擎，但监听独立的原始 TCP 端口。
/// TCP 端口不是 HTTP 路径；只有主租户明确启用且完整配置后才绑定。
/// </summary>
public sealed class TcpIngressHostedService : IHostedService, IDisposable
{
    private readonly IApiEngine _apiEngine;
    private readonly ILogger<TcpIngressHostedService> _logger;
    private readonly ConcurrentDictionary<long, Task> _connections = new();
    private TcpListener? _listener;
    private SemaphoreSlim? _connectionSlots;
    private SemaphoreSlim? _executionSlots;
    private CancellationTokenSource? _shutdown;
    private Task? _acceptTask;
    private Task? _controlTask;
    private long _nextConnectionId;
    private long _missingAckCount;
    private long _lastEngineCheckUtcTicks;
    private int _unreleasedExecutions;
    private int _executionSlotCount;
    private int _ingressStopped;
    private long _controlReadFailureCount;
    private int _state;
    private int _configuredPort;
    private string? _failureStage;
    private long _lastFailureUtcTicks;
    private long _rejectedSourceCount;
    private long _rejectedConnectionSlotCount;

    public TcpIngressState State => (TcpIngressState)Volatile.Read(ref _state);
    public string? FailureStage => Volatile.Read(ref _failureStage);
    public DateTimeOffset? LastFailureUtc
    {
        get
        {
            var ticks = Interlocked.Read(ref _lastFailureUtcTicks);
            return ticks > 0 ? new DateTimeOffset(ticks, TimeSpan.Zero) : null;
        }
    }
    public int? ListenPort
    {
        get
        {
            var port = Volatile.Read(ref _configuredPort);
            return port > 0 ? port : null;
        }
    }

    public TcpIngressHostedService(IApiEngine apiEngine,
        ILogger<TcpIngressHostedService> logger)
    {
        _apiEngine = apiEngine;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // TCP 是可选能力。任何规则、控制面或端口错误只使 TCP 局部失败，
        // 不得阻断同进程中云雀、跃龙等既有 HTTP 接入。
        Interlocked.Exchange(ref _state, (int)TcpIngressState.Starting);
        var stage = "load-main-tenant";
        try
        {
            var mainOsClient = OsClient.GetConfigOsClient();
            if (string.IsNullOrWhiteSpace(mainOsClient))
                throw new InvalidOperationException("TCP 入站无法确定主租户 OsClient。");
            var mainTenant = OsClient.GetClient(mainOsClient);
            stage = "read-switch";
            if (!TcpIngressRules.ParseEnable(mainTenant.OsClientModel?["TcpIngressEnable"]))
            {
                Interlocked.Exchange(ref _state, (int)TcpIngressState.Disabled);
                _logger.LogInformation("Microi TCP 入站已由主租户 TcpIngressEnable=0 关闭；HTTP API 正常启动。");
                return;
            }
            stage = "parse-rule";
            var json = mainTenant.OsClientModel?["TcpIngressRulesJson"]?.ToString();
            var rule = TcpIngressRules.Parse(json, mainTenant.OsClientModel?["TcpIngressPort"]);
            if (rule == null)
            {
                Interlocked.Exchange(ref _state, (int)TcpIngressState.Disabled);
                _logger.LogInformation("Microi TCP 入站尚未配置完整规则，未监听；HTTP API 正常启动。");
                return;
            }
            Volatile.Write(ref _configuredPort, rule.ListenPort);
            if (!string.Equals(rule.OsClient, mainTenant.OsClient, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("TCP 入站规则只能指向当前 API 主租户。");
            if (rule.AllowAnySource)
                _logger.LogWarning("Microi TCP 入站已显式允许任意 IPv4 来源；协议 CRC 和设备编号不能证明设备身份，请配置云侧防护并监控异常连接。");

            // 固定 Key 的内部 Server 调用；要求目标引擎关闭 HTTP 并禁止匿名，
            // 避免公网 /apiengine 路由绕过 TCP 传输层校验。
            stage = "validate-engine-policy";
            var engineResult = await _apiEngine.GetAuthoritativeApiEngineModel(new ApiEngineParam
            {
                OsClient = rule.OsClient,
                ApiEngineKey = rule.ApiEngineKey
            }).ConfigureAwait(false);
            if (engineResult.Code != 1 || engineResult.Data == null)
                throw new InvalidOperationException("TCP 入站配置的接口引擎不存在或未启用。");
            var engineModel = engineResult.Data is JObject model
                ? model : JObject.FromObject((object)engineResult.Data);
            if (!TcpIngressEnginePolicy.IsEligible(engineModel))
                throw new InvalidOperationException("TCP 入站接口引擎必须设置 StopHttp=true、AllowAnonymous=false 且启用，禁止 HTTP 绕过 TCP 传输层校验。");
            Interlocked.Exchange(ref _lastEngineCheckUtcTicks, DateTime.UtcNow.Ticks);

            stage = "bind-listener";
            var listener = new TcpListener(IPAddress.Any, rule.ListenPort);
            _listener = listener;
            listener.Start(rule.MaxConnections);
            _connectionSlots = new SemaphoreSlim(rule.MaxConnections, rule.MaxConnections);
            _executionSlotCount = Math.Min(rule.MaxConnections, 16);
            _executionSlots = new SemaphoreSlim(_executionSlotCount, _executionSlotCount);
            _shutdown = new CancellationTokenSource();
            Interlocked.Exchange(ref _state, (int)TcpIngressState.Listening);
            _acceptTask = AcceptLoopAsync(listener, rule, _shutdown.Token);
            _controlTask = MonitorSwitchAsync(rule.OsClient, _shutdown.Token);
            if (State == TcpIngressState.Listening)
                _logger.LogInformation("Microi TCP 入站已监听端口 {Port}，租户 {OsClient}，接口 {ApiEngineKey}。",
                    rule.ListenPort, rule.OsClient, rule.ApiEngineKey);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            CloseListenerSafely();
            throw;
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            Volatile.Write(ref _failureStage, stage);
            Interlocked.Exchange(ref _lastFailureUtcTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _state, (int)TcpIngressState.Faulted);
            CloseListenerSafely();
            _logger.LogError("Microi TCP 入站启动失败，阶段 {Stage}，类型 {ErrorType}：{ErrorMessage}。TCP 未监听，HTTP API 继续运行。",
                stage, ex.GetType().Name, ex.Message);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        // 先停止接单，再有界等待已接收帧完成；未完成的设备连接在关闭后可重发，
        // 业务幂等仍由目标接口引擎负责，不能把内存中的连接状态当持久事实。
        Interlocked.CompareExchange(ref _state, (int)TcpIngressState.Stopping,
            (int)TcpIngressState.Listening);
        CloseListenerSafely();
        try
        {
            // 接受循环先退出，才能准确快照全部已经接纳的会话。
            if (_acceptTask != null) await _acceptTask.WaitAsync(cancellationToken).ConfigureAwait(false);
            if (_controlTask != null) await _controlTask.WaitAsync(cancellationToken).ConfigureAwait(false);
            await Task.WhenAll(_connections.Values.ToArray()).WaitAsync(cancellationToken)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        Interlocked.CompareExchange(ref _state, (int)TcpIngressState.Stopped,
            (int)TcpIngressState.Stopping);
    }

    private async Task AcceptLoopAsync(TcpListener listener, TcpIngressRule rule,
        CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                TcpClient client;
                try { client = await listener.AcceptTcpClientAsync(stoppingToken).ConfigureAwait(false); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (SocketException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (ObjectDisposedException) when (stoppingToken.IsCancellationRequested) { break; }

                IPAddress? remoteAddress;
                try { remoteAddress = (client.Client.RemoteEndPoint as IPEndPoint)?.Address; }
                catch (SocketException) { remoteAddress = null; }
                catch (ObjectDisposedException) { remoteAddress = null; }
                if (remoteAddress == null || !rule.IsAllowed(remoteAddress))
                {
                    var count = Interlocked.Increment(ref _rejectedSourceCount);
                    if (ShouldLogCount(count))
                        _logger.LogWarning("Microi TCP 入站拒绝非白名单来源 {RemoteAddress}；累计 {Count} 次。",
                            remoteAddress?.ToString() ?? "unknown", count);
                    client.Dispose();
                    continue;
                }
                if (_connectionSlots?.Wait(0) != true)
                {
                    var count = Interlocked.Increment(ref _rejectedConnectionSlotCount);
                    if (ShouldLogCount(count))
                        _logger.LogWarning("Microi TCP 入站连接槽已满，拒绝新连接；累计 {Count} 次。", count);
                    client.Dispose();
                    continue;
                }
                var id = Interlocked.Increment(ref _nextConnectionId);
                // 先登记完成占位任务，再启动会话；极短连接即使同步结束，
                // 也不会发生“先移除、后插入”导致会话表残留的竞态。
                var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _connections[id] = completion.Task;
                var task = HandleClientAsync(client, rule, stoppingToken);
                _ = task.ContinueWith(completed =>
                {
                    _ = completed.Exception;
                    _connections.TryRemove(id, out var ignored);
                    _connectionSlots?.Release();
                    completion.TrySetResult();
                }, CancellationToken.None, TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
            }
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            StopIngressForFailure($"接收循环意外退出（{ex.GetType().Name}）", "accept-loop");
        }
    }

    private async Task MonitorSwitchAsync(string mainOsClient, CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
            {
                try
                {
                    var mainTenant = OsClient.GetClient(mainOsClient);
                    var provider = mainTenant.Db.Db.DbProvider;
                    var left = provider.LeftToken;
                    var right = provider.RightToken;
                    var section = mainTenant.Db.FromSql(
                        TcpIngressSwitchQuery.Build(left.ToString(), right.ToString()));
                    section.AddInParameter("@osClient", mainOsClient);
                    section.AddInParameter("@osClientType", OsClientDefault.OsClientType);
                    section.AddInParameter("@osClientNetwork", OsClientDefault.OsClientNetwork);
                    section.SetCommandTimeout(10);
                    var rows = section.ToList<dynamic>();
                    if (rows == null || rows.Count != 1)
                    {
                        StopIngressForFailure("主租户 TCP 开关权威记录不存在或不唯一", "switch-row-invalid");
                        return;
                    }
                    var row = rows[0] is JObject json ? json : JObject.FromObject((object)rows[0]);
                    bool enabled;
                    try { enabled = TcpIngressRules.ParseEnable(row["TcpIngressEnable"]); }
                    catch (InvalidOperationException)
                    {
                        StopIngressForFailure("主租户 TcpIngressEnable 值无效", "switch-invalid");
                        return;
                    }
                    Interlocked.Exchange(ref _controlReadFailureCount, 0);
                    if (!enabled)
                    {
                        StopIngressAdministratively();
                        return;
                    }
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    // 主库暂时不可读不能被误判为管理员明确设 0；保持当前监听，
                    // 下个周期重试。实际设备处理仍由接口执行超时与有界槽位保护。
                    var count = Interlocked.Increment(ref _controlReadFailureCount);
                    if (ShouldLogCount(count))
                        _logger.LogWarning("Microi TCP 入站开关权威读取失败，类型 {ErrorType}，连续 {Count} 次；暂不改变监听状态。",
                            ex.GetType().Name, count);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            StopIngressForFailure($"TCP 开关监视循环意外退出（{ex.GetType().Name}）", "switch-monitor");
        }
    }

    private void StopIngressAdministratively()
    {
        if (Interlocked.Exchange(ref _ingressStopped, 1) != 0) return;
        Interlocked.Exchange(ref _state, (int)TcpIngressState.Disabled);
        _logger.LogInformation("Microi TCP 入站检测到主租户 TcpIngressEnable=0，已关闭监听；HTTP API 保持运行。重新启用需重启 API。");
        CloseListenerSafely();
    }

    private async Task HandleClientAsync(TcpClient client, TcpIngressRule rule,
        CancellationToken stoppingToken)
    {
        try
        {
            var downlink = rule.Downlink == null ? null
                : new TcpIngressIoTSession(rule, IoTCommandRuntime.CreateStore(rule.OsClient));
            await TcpIngressSession.RunAsync(client, rule,
                (frame, token) => ExecuteFrameAsync(frame, rule, token, downlink), stoppingToken, downlink)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) { }
        catch (IOException) { }
        catch (SocketException) { }
        catch (Exception ex)
        {
            client.Dispose();
            // 帧正文和设备口令均不入日志；诊断只保留错误类别。
            _logger.LogWarning("Microi TCP 入站连接关闭，错误类型 {ErrorType}。", ex.GetType().Name);
        }
    }

    private async Task<byte[]?> ExecuteFrameAsync(byte[] frame, TcpIngressRule rule,
        CancellationToken stoppingToken, TcpIngressIoTSession? downlink = null)
    {
        // 不能只在无 ACK 时复查：管理员若重新开放 HTTP，Server 调用仍可成功，
        // 因而必须在有效帧处理路径上低频核对控制面安全位。
        if (!CheckEnginePolicyIfDue(rule)) return null;
        var slots = _executionSlots!;
        if (!await slots.WaitAsync(TimeSpan.FromSeconds(rule.ExecutionTimeoutSeconds), stoppingToken)
                .ConfigureAwait(false))
        {
            RecordMissingAck("execution-slot-timeout");
            // 只有全部执行槽都被已超时、仍无法取消的底层任务永久占据时，
            // 停止本 TCP 监听；不能重启承载其他租户和 IoT 厂商的 HTTP API。
            if (Volatile.Read(ref _unreleasedExecutions) >= _executionSlotCount)
                StopIngressForFailure("全部 TCP 接口执行槽被未退出的超时任务占据", "execution-slots-exhausted");
            return null;
        }
        Task<dynamic>? execution = null;
        var deferSlotRelease = false;
        object? raw;
        try
        {
            execution = _apiEngine.RunAsync(new JObject
            {
                ["ApiEngineKey"] = rule.ApiEngineKey,
                ["OsClient"] = rule.OsClient,
                ["_InvokeType"] = "Server",
                ["frameHex"] = Convert.ToHexString(frame)
            });
            raw = await execution.WaitAsync(
                TimeSpan.FromSeconds(rule.ExecutionTimeoutSeconds), stoppingToken)
                .ConfigureAwait(false);
        }
        catch (TimeoutException)
        {
            // 旧 ApiEngine.RunAsync 不能直接取消底层事务。超时只关闭设备连接，
            // 不伪造成功 ACK；执行槽要等真实任务结束才释放，防止慢 DB 累积无界任务。
            deferSlotRelease = execution != null && !execution.IsCompleted;
            if (deferSlotRelease)
            {
                Interlocked.Increment(ref _unreleasedExecutions);
                ReleaseSlotWhenDone(execution!, slots);
            }
            RecordMissingAck("engine-execution-timeout");
            if (deferSlotRelease)
            {
                _logger.LogWarning("Microi TCP 入站接口执行超时，底层任务仍未退出；该设备连接关闭，执行槽待任务退出后释放。");
                if (Volatile.Read(ref _unreleasedExecutions) >= _executionSlotCount)
                    StopIngressForFailure("全部 TCP 接口执行槽被未退出的超时任务占据", "execution-slots-exhausted");
            }
            else
            {
                _logger.LogWarning("Microi TCP 入站接口执行超时；设备连接将关闭。");
            }
            return null;
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            deferSlotRelease = execution != null && !execution.IsCompleted;
            if (deferSlotRelease)
            {
                Interlocked.Increment(ref _unreleasedExecutions);
                ReleaseSlotWhenDone(execution!, slots);
            }
            return null;
        }
        catch (Exception ex)
        {
            RecordMissingAck("engine-exception");
            _logger.LogWarning("Microi TCP 入站接口执行异常：{ErrorType}。", ex.GetType().Name);
            return null;
        }
        finally
        {
            if (!deferSlotRelease) slots.Release();
        }
        // 失败业务帧也可能带协议规定的失败 ACK；Code=0 并非静默关闭依据。
        // 有应答时必须完整且同设备同命令；明确授权的 None 结果返回零字节，不能制造 ACK-of-ACK。
        if (TcpIngressFrameCodec.TryDecodeResponse(raw, frame, rule, out var response))
        {
            downlink?.ObserveResponse(frame, raw!);
            Interlocked.Exchange(ref _missingAckCount, 0);
            return response;
        }
        ReportMissingAck(rule, "missing-or-invalid-response-frame");
        return null;
    }

    private void RecordMissingAck(string category)
    {
        var count = Interlocked.Increment(ref _missingAckCount);
        if (count == 1 || (count & (count - 1)) == 0)
            _logger.LogWarning("Microi TCP 入站未回 ACK，类别 {Category}，连续次数 {Count}。",
                category, count);
    }

    private void ReportMissingAck(TcpIngressRule rule, string category)
    {
        RecordMissingAck(category);
        _ = CheckEnginePolicyIfDue(rule);
    }

    private bool CheckEnginePolicyIfDue(TcpIngressRule rule)
    {
        var now = DateTime.UtcNow.Ticks;
        var last = Interlocked.Read(ref _lastEngineCheckUtcTicks);
        if (now - last < TimeSpan.FromSeconds(30).Ticks
            || Interlocked.CompareExchange(ref _lastEngineCheckUtcTicks, now, last) != last)
            return State == TcpIngressState.Listening;
        try
        {
            // GetAuthoritativeApiEngineModel 只查询启用记录，当前实现会把停用/不存在
            // 都转换为 Code=0。这里读取“已配置”记录，才能区分明确停用与主库故障。
            var lookup = ApiEngineAuthoritativeStore.GetConfiguredModel(
                OsClient.GetClient(rule.OsClient), new ApiEngineParam
                {
                    OsClient = rule.OsClient,
                    ApiEngineKey = rule.ApiEngineKey
                });
            if (lookup.Code != 1)
            {
                _logger.LogWarning("Microi TCP 入站接口引擎策略权威检查失败（Code={Code}），暂不停止监听。",
                    lookup.Code);
                return State == TcpIngressState.Listening;
            }
            if (lookup.Data == null)
            {
                StopIngressForFailure("目标接口引擎已不存在或被删除", "engine-missing");
                return false;
            }
            var model = lookup.Data is JObject json
                ? json : JObject.FromObject((object)lookup.Data);
            if (!TcpIngressEnginePolicy.IsEligible(model))
                StopIngressForFailure("目标接口引擎已不满足内部 TCP 调用的 HTTP 禁止及匿名禁用条件", "engine-policy-changed");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Microi TCP 入站接口引擎策略检查异常：{ErrorType}。",
                ex.GetType().Name);
        }
        return State == TcpIngressState.Listening;
    }

    private void StopIngressForFailure(string reason, string category)
    {
        if (Interlocked.Exchange(ref _ingressStopped, 1) != 0) return;
        Volatile.Write(ref _failureStage, category);
        Interlocked.Exchange(ref _lastFailureUtcTicks, DateTime.UtcNow.Ticks);
        Interlocked.Exchange(ref _state, (int)TcpIngressState.Faulted);
        _logger.LogError("Microi TCP 入站已停止接受新连接：{Reason}。HTTP API 保持运行；请检查配置与日志后重启 API。", reason);
        CloseListenerSafely();
    }

    private void CloseListenerSafely()
    {
        try { _shutdown?.Cancel(); }
        catch (AggregateException ex)
        {
            _logger.LogWarning("Microi TCP 入站取消接收时发生回调错误：{ErrorType}。", ex.GetType().Name);
        }
        try { _listener?.Stop(); }
        catch (SocketException ex)
        {
            _logger.LogWarning("Microi TCP 入站停止监听时发生套接字错误：{SocketError}。", ex.SocketErrorCode);
        }
        catch (ObjectDisposedException) { }
    }

    private static bool ShouldLogCount(long count) =>
        count == 1 || (count & (count - 1)) == 0;

    private void ReleaseSlotWhenDone(Task<dynamic> execution, SemaphoreSlim slots)
    {
        _ = execution.ContinueWith(completed =>
        {
            // 观察迟到异常，避免未观察任务异常；绝不在迟到成功后补发 ACK。
            _ = completed.Exception;
            Interlocked.Decrement(ref _unreleasedExecutions);
            slots.Release();
        }, CancellationToken.None, TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
    }

    public void Dispose()
    {
        CloseListenerSafely();
        // Host 的有界 StopAsync 可能在仍有接口事务运行时超时；连接任务后续
        // 仍需读取停止令牌和释放槽位，因此这里不提前 Dispose CTS/SemaphoreSlim。
    }
}

/// <summary>
/// 独立可测的部署先决条件。只有禁用 HTTP 路由且不允许匿名的接口引擎，
/// 才能由受 CIDR/帧校验约束的进程内 TCP 传输层使用固定 Key 调用。
/// </summary>
public static class TcpIngressEnginePolicy
{
    public static bool IsEligible(JObject? model) =>
        model != null
        && !ReadEnabled(model["AllowAnonymous"])
        && ReadEnabled(model["StopHttp"])
        && (model["IsEnable"] == null || ReadEnabled(model["IsEnable"]));

    private static bool ReadEnabled(JToken? value) =>
        value?.Type == JTokenType.Boolean ? value.Value<bool>()
        : value?.ToString() is "1" or "true" or "True";
}

/// <summary>只用数据库 Provider 的标识符引号构造权威开关查询；值始终另行参数化。</summary>
internal static class TcpIngressSwitchQuery
{
    internal static string Build(string left, string right) =>
        $"SELECT {left}TcpIngressEnable{right} FROM {left}sys_osclients{right} "
        + $"WHERE {left}OsClient{right} = @osClient "
        + $"AND {left}OsClientType{right} = @osClientType "
        + $"AND {left}OsClientNetwork{right} = @osClientNetwork "
        + $"AND {left}IsEnable{right} = 1 "
        + $"AND ({left}IsDeleted{right} = 0 OR {left}IsDeleted{right} IS NULL)";
}
