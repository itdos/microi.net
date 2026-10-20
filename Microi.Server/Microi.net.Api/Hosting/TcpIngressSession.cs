using System.Net.Sockets;

namespace Microi.net.Api;

/// <summary>
/// 单条设备连接的有界字节流处理。与监听/数据库分离，便于用真实回环 TCP
/// 验证分片、粘包、连续心跳和同连接二进制回包。
/// </summary>
public static class TcpIngressSession
{
    public static async Task RunAsync(
        TcpClient client,
        TcpIngressRule rule,
        Func<byte[], CancellationToken, Task<byte[]?>> executeFrame,
        CancellationToken stoppingToken,
        TcpIngressIoTSession? downlink = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(rule);
        ArgumentNullException.ThrowIfNull(executeFrame);
        using (client)
        {
            client.NoDelay = true;
            using var stream = client.GetStream();
            using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            stoppingToken = lifetime.Token;
            // 下行任务故障必须中断同一条连接的 ReadAsync，防止僵尸连接继续占有设备身份。
            async Task PumpAsync()
            {
                try { await downlink!.RunAsync(stream, stoppingToken).ConfigureAwait(false); }
                finally { lifetime.Cancel(); }
            }
            var pump = downlink == null ? Task.CompletedTask : PumpAsync();
            try
            {
                var maxBufferedBytes = checked(rule.MaxFrameBytes * rule.MaxQueuedFramesPerConnection);
                var buffer = new byte[maxBufferedBytes];
                var buffered = 0;
                while (!stoppingToken.IsCancellationRequested)
                {
                    // 串行处理每帧并立即写回，TCP 背压保证不会产生无界用户态队列。
                    while (buffered > 0)
                    {
                        var status = TcpIngressFrameCodec.TryReadFrame(
                            buffer.AsSpan(0, buffered), rule, out var frameLength, out _);
                        if (status == TcpIngressFrameReadStatus.Invalid) return;
                        if (status == TcpIngressFrameReadStatus.NeedMore) break;
                        var frame = buffer.AsSpan(0, frameLength).ToArray();
                        Buffer.BlockCopy(buffer, frameLength, buffer, 0, buffered - frameLength);
                        buffered -= frameLength;
                        downlink?.EnsureFrameDevice(frame);
                        var response = await executeFrame(frame, stoppingToken).ConfigureAwait(false);
                        if (response == null || !TcpIngressFrameCodec.ValidateResponse(response, frame, rule))
                            return;
                        using var send = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        send.CancelAfter(TimeSpan.FromSeconds(rule.ExecutionTimeoutSeconds));
                        if (downlink == null) await stream.WriteAsync(response, send.Token).ConfigureAwait(false);
                        else
                        {
                            await downlink.WriteReplyAsync(stream, response, send.Token).ConfigureAwait(false);
                            await downlink.AfterReplyWrittenAsync(stoppingToken).ConfigureAwait(false);
                        }
                    }
                    if (buffered == buffer.Length) return;
                    using var idle = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    idle.CancelAfter(TimeSpan.FromSeconds(rule.IdleTimeoutSeconds));
                    var read = await stream.ReadAsync(
                        buffer.AsMemory(buffered, buffer.Length - buffered), idle.Token)
                        .ConfigureAwait(false);
                    if (read == 0) return;
                    buffered += read;
                    // 单次读取可能带来大量粘包；按完整帧数执行配置的排队上限，
                    // 而不只依赖总字节缓冲上限。
                    var offset = 0;
                    var completeFrames = 0;
                    while (offset < buffered)
                    {
                        var status = TcpIngressFrameCodec.TryReadFrame(
                            buffer.AsSpan(offset, buffered - offset), rule, out var frameLength, out _);
                        if (status == TcpIngressFrameReadStatus.Invalid) return;
                        if (status == TcpIngressFrameReadStatus.NeedMore) break;
                        if (++completeFrames > rule.MaxQueuedFramesPerConnection) return;
                        offset += frameLength;
                    }
                }
            }
            finally
            {
                lifetime.Cancel();
                try { await pump.ConfigureAwait(false); }
                catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
                finally { if (downlink != null) await downlink.ReleaseAsync().ConfigureAwait(false); }
            }
        }
    }
}
