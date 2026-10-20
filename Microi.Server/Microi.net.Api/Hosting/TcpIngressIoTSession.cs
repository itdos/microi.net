using System.Net.Sockets;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>
/// 一条物理连接的下行适配器。内部上报引擎明确授权且应答写入/显式免应答处理完成后，才注册设备；
/// Redis 所有权用于跨节点路由，本机只持有无法跨进程共享的 Socket 与串行写锁。
/// </summary>
public sealed class TcpIngressIoTSession
{
    private readonly TcpIngressRule _rule;
    private readonly IIoTCommandStore _store;
    private readonly string _session = Guid.NewGuid().ToString("N");
    private readonly SemaphoreSlim _writer = new(1, 1);
    private string? _device;
    private string? _candidate;
    private int _authorized;
    private DateTime _nextRenew;
    private IoTDownlinkPolicy Policy => _rule.Downlink!;

    public TcpIngressIoTSession(TcpIngressRule rule, IIoTCommandStore store)
    {
        _rule = rule;
        _store = store;
        if (rule.Downlink == null) throw new ArgumentException("未启用 IoT 下行。");
    }

    public void EnsureFrameDevice(byte[] frame)
    {
        if (_device != null && Policy.ReadDeviceId(frame) != _device)
            throw new InvalidOperationException("同一 TCP 会话不得切换设备身份。");
    }

    public void ObserveResponse(byte[] frame, object raw)
    {
        var result = raw as JObject ?? JObject.FromObject(raw);
        var address = result.Value<int?>("Code") == 1
            ? (result["Data"] as JObject)?.Value<string>("IoTDeviceId") : null;
        _candidate = string.IsNullOrEmpty(address) ? null : Policy.NormalizeDeviceId(address);
        if (_candidate != null && _candidate != Policy.ReadDeviceId(frame))
            throw new InvalidOperationException("上报引擎授权的设备与物理帧地址不匹配。");
        // 每次有效上报都复核授权。解绑或拒绝后立即停止主动写入，ACK 仍按原规则返回。
        Volatile.Write(ref _authorized, _candidate == null ? 0 : 1);
    }

    /// <summary>兼容原调用方；有线应答必须先写入成功，再调用连接登记。</summary>
    public Task AfterReplyWrittenAsync(CancellationToken token) => AfterFrameAcceptedAsync(token);

    /// <summary>帧通过校验并按协议完成处理后登记/复核设备；None 不产生虚构的线缆 ACK。</summary>
    public async Task AfterFrameAcceptedAsync(CancellationToken token)
    {
        if (_device != null && _candidate != _device)
            throw new InvalidOperationException("设备下行授权已撤销。");
        if (_device != null || _candidate == null) return;
        await _store.BindAsync(_rule.OsClient, _candidate, _session, Policy)
            .WaitAsync(TimeSpan.FromSeconds(_rule.ExecutionTimeoutSeconds), token).ConfigureAwait(false);
        _nextRenew = DateTime.UtcNow.AddSeconds(Policy.LeaseSeconds / 3.0);
        Volatile.Write(ref _device, _candidate);
    }

    public async Task WriteReplyAsync(NetworkStream stream, byte[] bytes, CancellationToken token)
    {
        await _writer.WaitAsync(token).ConfigureAwait(false);
        try { await stream.WriteAsync(bytes, token).ConfigureAwait(false); }
        finally { _writer.Release(); }
    }

    public async Task RunAsync(NetworkStream stream, CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            await Task.Delay(Policy.PollIntervalMilliseconds, token).ConfigureAwait(false);
            var device = Volatile.Read(ref _device);
            if (device == null || Volatile.Read(ref _authorized) == 0) continue;
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
            deadline.CancelAfter(TimeSpan.FromSeconds(_rule.ExecutionTimeoutSeconds));
            await _writer.WaitAsync(deadline.Token).ConfigureAwait(false);
            JObject? command = null;
            try
            {
                if (Volatile.Read(ref _authorized) == 0) continue;
                if (DateTime.UtcNow >= _nextRenew)
                {
                    if (!await _store.RenewAsync(_rule.OsClient, device, _session, Policy)
                            .WaitAsync(deadline.Token).ConfigureAwait(false))
                        throw new InvalidOperationException("连接所有权已转移或租约已失效。");
                    _nextRenew = DateTime.UtcNow.AddSeconds(Policy.LeaseSeconds / 3.0);
                }
                // 先取得写锁，再以当前连接令牌原子出队，避免排队等待期间指令过期。
                var claim = await _store.ClaimAsync(_rule.OsClient, device, _session, Policy)
                    .WaitAsync(deadline.Token).ConfigureAwait(false);
                if (!claim.OwnsConnection) throw new InvalidOperationException("设备已在其它连接重连。");
                command = claim.Command;
                if (command == null) continue;
                var bytes = Policy.ValidateDownlink(device, command.Value<string>("FrameHex")!);
                await stream.WriteAsync(bytes, deadline.Token).ConfigureAwait(false);
                await _store.CompleteAsync(_rule.OsClient, device, _session, command.Value<string>("CommandId")!, "Written", Policy)
                    .WaitAsync(deadline.Token).ConfigureAwait(false);
            }
            catch
            {
                if (command != null)
                {
                    // TCP 写入或状态保存失败都可能已经产生物理副作用，禁止自动重新投递。
                    try { await _store.CompleteAsync(_rule.OsClient, device, _session,
                        command.Value<string>("CommandId")!, "Unknown", Policy).WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false); }
                    catch { /* 保留 Sending 状态，同样不得自动重发。 */ }
                }
                throw;
            }
            finally { _writer.Release(); }
        }
    }

    public async Task ReleaseAsync()
    {
        if (_device != null)
        {
            try { await _store.ReleaseAsync(_rule.OsClient, _device, _session).WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false); }
            catch { /* Redis 不可用时依赖有界租约自然失效，不能删除其它连接。 */ }
        }
        _writer.Dispose();
    }
}
