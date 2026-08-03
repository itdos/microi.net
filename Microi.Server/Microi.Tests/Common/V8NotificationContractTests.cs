using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class V8NotificationContractTests
{
    private static readonly MethodInfo NormalizeMethod = typeof(V8Notification).GetMethod(
        "Normalize",
        BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("V8.Notification 参数归一化方法不存在。");

    [Fact]
    public void Contract_uses_a_fixed_event_and_bounded_payloads()
    {
        Assert.Equal("ReceivePlatformNotification", V8Notification.ClientEventName);
        Assert.Equal("平台内部", V8Notification.ChannelType);
        Assert.InRange(V8Notification.MaximumReceivers, 1, 500);
        Assert.InRange(V8Notification.MaximumContentBytes, 1024, 64 * 1024);
        Assert.InRange(V8Notification.MaximumPayloadBytes, 1024, 64 * 1024);
    }

    [Fact]
    public void Normalize_deduplicates_receivers_and_keeps_current_tenant()
    {
        var (error, request) = Normalize(new JObject
        {
            ["NotificationId"] = "notice-1",
            ["EventId"] = "event-1",
            ["ReceiverUserIds"] = new JArray("user-1", "USER-1", "user-2"),
            ["Title"] = "待办提醒",
            ["Content"] = "请及时处理",
            ["LinkUrl"] = "/mic/todo/1",
            ["Payload"] = new JObject { ["Version"] = 1 }
        }, "iTdos");

        Assert.Null(error);
        Assert.NotNull(request);
        Assert.Equal("iTdos", ReadProperty<string>(request!, "OsClient"));
        Assert.Equal("notice-1", ReadProperty<string>(request!, "NotificationId"));
        Assert.Equal(2, ReadEnumerableProperty(request!, "ReceiverUserIds").Count());
        Assert.Equal("/mic/todo/1", ReadProperty<string>(request!, "LinkUrl"));
    }

    [Theory]
    [InlineData("../../other-user", "", "接收用户")]
    [InlineData("user-1", "javascript:alert(1)", "LinkUrl")]
    [InlineData("user-1", "//evil.example/x", "LinkUrl")]
    public void Normalize_rejects_invalid_receiver_or_unsafe_link(
        string receiverUserId,
        string linkUrl,
        string expectedMessage)
    {
        var (error, request) = Normalize(new JObject
        {
            ["ReceiverUserId"] = receiverUserId,
            ["Title"] = "安全提醒",
            ["Content"] = "内容",
            ["LinkUrl"] = linkUrl
        }, "iTdos");

        Assert.Null(request);
        Assert.NotNull(error);
        Assert.Equal(0, error!.Code);
        Assert.Contains(expectedMessage, error.Msg);
    }

    [Fact]
    public void Normalize_rejects_oversized_content_before_any_realtime_side_effect()
    {
        var (error, request) = Normalize(new JObject
        {
            ["ReceiverUserId"] = "user-1",
            ["Title"] = "容量限制",
            ["Content"] = new string('界', V8Notification.MaximumContentBytes)
        }, "iTdos");

        Assert.Null(request);
        Assert.NotNull(error);
        Assert.Equal(0, error!.Code);
        Assert.Contains("Content", error.Msg);
    }

    private static (DosResult? Error, object? Request) Normalize(JObject input, string osClient)
    {
        var arguments = new object?[] { input, osClient, null };
        var result = NormalizeMethod.Invoke(null, arguments);
        return (result as DosResult, arguments[2]);
    }

    private static T? ReadProperty<T>(object source, string name)
    {
        return (T?)source.GetType().GetProperty(name)?.GetValue(source);
    }

    private static IEnumerable<string> ReadEnumerableProperty(object source, string name)
    {
        return Assert.IsAssignableFrom<IEnumerable<string>>(
            source.GetType().GetProperty(name)?.GetValue(source));
    }
}
