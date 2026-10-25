using System.Text;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class AiProxySseForwarderTests
{
    private const string Content = "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"中文\"}}]}\n\n";
    private static string Finish(string reason) => "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"" + reason + "\"}]}\n\n";
    private static async Task<(bool Complete, string Wire, string Capture)> Run(string wire, int choices = 1)
    {
        using var source = new MemoryStream(Encoding.UTF8.GetBytes(wire));
        using var output = new MemoryStream();
        var result = await AiProxySseForwarder.ForwardAsync(source, output, CancellationToken.None, choices);
        return (result.Complete, Encoding.UTF8.GetString(output.ToArray()), result.Capture);
    }

    [Theory]
    [InlineData("stop")]
    [InlineData("length")]
    [InlineData("content_filter")]
    public async Task ExplicitProviderFinishCompletesFramingWithoutChangingItsReason(string reason)
    {
        var result = await Run(Content + Finish(reason));
        Assert.True(result.Complete);
        Assert.EndsWith("data: [DONE]\n\n", result.Wire);
        Assert.Contains("\"finish_reason\":\"" + reason + "\"", result.Wire);
        Assert.Equal(result.Wire, result.Capture);
    }

    [Fact]
    public async Task EofOrDoneWithoutProviderFinishCannotBecomeComplete()
    {
        foreach (var ending in new[] { "", "data: [DONE]\n\n" })
            Assert.False((await Run(Content + ending)).Complete);
    }

    [Fact]
    public async Task DoneIsTerminalAndCannotBeRepairedByLaterData()
    {
        var result = await Run(Content + "data: [DONE]\n\n" + Finish("stop"));
        Assert.False(result.Complete);
        Assert.DoesNotContain("finish_reason", result.Wire);
    }

    [Fact]
    public async Task ExplicitErrorAndMalformedFramesNeverReceiveSyntheticSuccess()
    {
        foreach (var error in new[] { "data: {\"error\":{\"message\":\"synthetic\"}}\n\n", "data: malformed\n\n" })
        {
            var result = await Run(Content + error + Finish("stop"));
            Assert.False(result.Complete);
            Assert.DoesNotContain("[DONE]", result.Wire);
        }
    }

    [Fact]
    public async Task EmptyFinishIsNotAnAnswerAndUsageIsForwardedUnmodified()
    {
        Assert.False((await Run(Finish("stop"))).Complete);
        const string usage = "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":2,\"total_tokens\":9}}\n\n";
        var result = await Run(Content + Finish("stop") + usage + "data: [DONE]\n\n");
        Assert.True(result.Complete);
        Assert.Contains(usage, result.Wire);
        Assert.Equal(1, result.Wire.Split("[DONE]").Length - 1);
    }

    [Fact]
    public async Task CancellationInterruptsAnActualPendingBodyRead()
    {
        using var source = new BlockingReadStream();
        using var output = new MemoryStream();
        using var cancel = new CancellationTokenSource();
        var run = AiProxySseForwarder.ForwardAsync(source, output, cancel.Token);
        await source.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
        cancel.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run.WaitAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task CancellationAlsoInterruptsAnErrorResponseBodyRead()
    {
        using var source = new BlockingReadStream();
        using var cancel = new CancellationTokenSource();
        var run = AiProxySseForwarder.ReadErrorBodyAsync(source, cancel.Token);
        await source.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
        cancel.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run.WaitAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task CommentsCrLfAndMultilineDataRemainValidAndKeepUsage()
    {
        var result = await Run(": heartbeat\r\n\r\n" + Content.Replace("\n", "\r\n")
            + "data: {\"choices\":\n" + "data: [{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n");
        Assert.True(result.Complete);
        Assert.Contains("中文", result.Wire);
        Assert.EndsWith("data: [DONE]\n\n", result.Wire);
    }

    [Fact]
    public async Task IncompleteLastLineNeedsARealFinishAndCannotBorrowALaterReason()
    {
        Assert.True((await Run(Content + Finish("stop").TrimEnd())).Complete);
        Assert.False((await Run(Content + Finish("unexpected"))).Complete);
        Assert.False((await Run(Content + Finish("stop") + Content)).Complete);
        Assert.False((await Run(Content + Finish("length") + Finish("stop"))).Complete);
    }

    [Fact]
    public async Task EveryRequestedChoiceMustFinishBeforeASyntheticDone()
    {
        var first = Content + Finish("stop");
        Assert.False((await Run(first, 2)).Complete);
        var second = first.Replace("\"index\":0", "\"index\":1");
        Assert.True((await Run(first + second, 2)).Complete);
        Assert.False((await Run(first + second.Replace("\"stop\"", "\"unexpected\""), 2)).Complete);
    }

    [Fact]
    public async Task ToolCallsPreservePayloadAndTheirFinishReason()
    {
        var result = await Run("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"synthetic\",\"arguments\":\"{}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n");
        Assert.True(result.Complete);
        Assert.EndsWith("data: [DONE]\n\n", result.Wire);
    }

    [Fact]
    public async Task DoneWithoutItsFinalNewlineIsNotDuplicated()
    {
        var result = await Run(Content + Finish("stop") + "data: [DONE]");
        Assert.True(result.Complete);
        Assert.Equal(1, result.Wire.Split("[DONE]").Length - 1);
        Assert.EndsWith("data: [DONE]\n\n", result.Wire);
    }

    [Fact]
    public async Task ErrorsAfterTheCaptureBudgetStillPreventSyntheticCompletion()
    {
        var heartbeats = string.Concat(Enumerable.Repeat(": heartbeat\n\n", 17000));
        var result = await Run(heartbeats + Content + "data: {\"error\":{\"message\":\"late synthetic error\"}}\n\n" + Finish("stop"));
        Assert.False(result.Complete);
        Assert.DoesNotContain("[DONE]", result.Wire);
        Assert.True(result.Capture.Length <= 200000);
    }

    private sealed class BlockingReadStream : Stream
    {
        internal TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken token = default)
        { Started.TrySetResult(); await Task.Delay(Timeout.Infinite, token); return 0; }
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token)
            => ReadAsync(buffer.AsMemory(offset, count), token).AsTask();
        public override bool CanRead => true; public override bool CanSeek => false; public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() => throw new NotSupportedException();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
