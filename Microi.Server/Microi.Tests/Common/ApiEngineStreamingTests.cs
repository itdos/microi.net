using System.Reflection;
using System.Threading;
using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApiEngineStreamingTests
{
    [Fact]
    public async Task StreamWriter_EmitsProvisionalOrderedFrames()
    {
        var sink = new RecordingSink();
        using (ApiEngineStreamContext.Enter(sink, 4096, 8192))
        {
            var writer = ApiEngineStreamContext.Current;
            var first = await writer.WriteAsync(new { Value = 1 }, "progress", "step-1");
            var second = writer.Write("完成", "chunk");

            Assert.Equal(1, first.Code);
            Assert.Equal(1, second.Code);
            Assert.Equal(2, writer.WrittenChunks);
            Assert.Collection(
                sink.Frames,
                frame =>
                {
                    Assert.Equal(1, frame.Sequence);
                    Assert.Equal("progress", frame.EventName);
                    Assert.Equal("step-1", frame.Id);
                    Assert.True(frame.Provisional);
                    Assert.Equal(1, frame.Data["Value"]?.Value<int>());
                },
                frame =>
                {
                    Assert.Equal(2, frame.Sequence);
                    Assert.Equal("chunk", frame.EventName);
                    Assert.True(frame.Provisional);
                    Assert.Equal("完成", frame.Data.Value<string>());
                });
        }
    }

    [Theory]
    [InlineData("done")]
    [InlineData("error")]
    [InlineData("heartbeat")]
    [InlineData("bad\nevent")]
    public async Task StreamWriter_RejectsReservedOrInvalidEvents(string eventName)
    {
        var sink = new RecordingSink();
        using (ApiEngineStreamContext.Enter(sink, 4096, 8192))
        {
            var result = await ApiEngineStreamContext.Current.WriteAsync("x", eventName);

            Assert.Equal(0, result.Code);
            Assert.Empty(sink.Frames);
        }
    }

    [Fact]
    public async Task StreamWriter_EnforcesChunkAndTotalBudgets()
    {
        var sink = new RecordingSink();
        using (ApiEngineStreamContext.Enter(sink, 4096, 5000))
        {
            var writer = ApiEngineStreamContext.Current;
            var tooLarge = await writer.WriteAsync(new string('x', 5000));
            var accepted = await writer.WriteAsync(new string('x', 3000));
            var totalExceeded = await writer.WriteAsync(new string('x', 3000));

            Assert.Equal(0, tooLarge.Code);
            Assert.Equal(1, accepted.Code);
            Assert.Equal(0, totalExceeded.Code);
            Assert.Single(sink.Frames);
        }
    }

    [Fact]
    public async Task StreamWriter_StopsAfterClientCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var sink = new RecordingSink(cancellation.Token);
        using (ApiEngineStreamContext.Enter(sink, 4096, 8192))
        {
            cancellation.Cancel();
            var result = await ApiEngineStreamContext.Current.WriteAsync("x");

            Assert.Equal(0, result.Code);
            Assert.Empty(sink.Frames);
        }
    }

    [Theory]
    [InlineData("Stream")]
    [InlineData("stream")]
    [InlineData("SSE")]
    [InlineData("2")]
    public void DynamicRoute_MapsEveryStreamAliasForJsonRequests(string responseType)
    {
        var route = new DynamicRoute();
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.ContentType = "application/json";
        var model = new JObject { ["ResponseType"] = responseType };
        var method = typeof(DynamicRoute).GetMethod(
            "DetermineApiAction",
            BindingFlags.Instance | BindingFlags.NonPublic);

        var action = method?.Invoke(route, new object[] { context, model }) as string;

        Assert.Equal("Run_Response_Stream", action);
    }

    [Theory]
    [InlineData("Stream", "Stream")]
    [InlineData("SSE", "Stream")]
    [InlineData("2", "Stream")]
    [InlineData("json", "JSON")]
    [InlineData("HTML", "HTML")]
    public void McpRuntimeConfiguration_NormalizesSupportedResponseTypes(
        string responseType,
        string expected)
    {
        var method = typeof(V8McpLogic).GetMethod(
            "TryNormalizeApiEngineResponseType",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var arguments = new object?[] { responseType, null, null };

        var ok = Assert.IsType<bool>(method!.Invoke(null, arguments));

        Assert.True(ok);
        Assert.Equal(expected, arguments[1]);
        Assert.Equal(string.Empty, arguments[2]);
    }

    [Fact]
    public void McpRuntimeConfiguration_RejectsUnknownResponseType()
    {
        var method = typeof(V8McpLogic).GetMethod(
            "TryNormalizeApiEngineResponseType",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var arguments = new object?[] { "WebSocket", null, null };

        var ok = Assert.IsType<bool>(method!.Invoke(null, arguments));

        Assert.False(ok);
        Assert.Null(arguments[1]);
        Assert.Contains("不支持", arguments[2]?.ToString());
    }

    private sealed class RecordingSink : IApiEngineStreamSink
    {
        public RecordingSink(CancellationToken cancellationToken = default)
        {
            CancellationToken = cancellationToken;
        }

        public List<ApiEngineStreamFrame> Frames { get; } = new();
        public bool IsConnected => !CancellationToken.IsCancellationRequested;
        public CancellationToken CancellationToken { get; }

        public Task<DosResult> WriteAsync(ApiEngineStreamFrame frame)
        {
            Frames.Add(frame);
            return Task.FromResult(new DosResult(1));
        }
    }
}
