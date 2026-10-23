using Microi.net;
using Newtonsoft.Json.Linq;
namespace Microi.Tests.Common;
public sealed class ChatUnreadProjectionTests
{
    [Theory]
    [InlineData("null")][InlineData("-1")][InlineData("1.0")][InlineData("1.5")]
    [InlineData("\"0\"")][InlineData("\"\"")][InlineData("true")][InlineData("[]")][InlineData("{}")]
    [InlineData("9223372036854775808")]
    public void Unknown_or_invalid_count_does_not_clear_existing_badge(string json)
    {
        long displayed = 9;
        if (ChatUnreadProjection.TryGetCount(JToken.Parse(json), out var count)) displayed = count;
        Assert.Equal(9, displayed);
    }
    [Fact] public void Missing_and_undefined_are_not_zero()
    {
        Assert.False(ChatUnreadProjection.TryGetCount(null, out _));
        Assert.False(ChatUnreadProjection.TryGetCount(JValue.CreateUndefined(), out _));
    }
    [Theory][InlineData(0L)][InlineData(7L)][InlineData(long.MaxValue)]
    public void Known_count_including_zero_is_delivered(long expected)
    {
        Assert.True(ChatUnreadProjection.TryGetCount(new JValue(expected), out var count));
        Assert.Equal(expected,count);
    }
    [Fact] public void Each_party_has_an_independent_projection()
    {
        var data=JObject.Parse("{\"ActorUnreadCount\":3,\"TargetUnreadCount\":null}");
        Assert.True(ChatUnreadProjection.TryGetCount(data["ActorUnreadCount"],out var count));
        Assert.Equal(3,count);
        Assert.False(ChatUnreadProjection.TryGetCount(data["TargetUnreadCount"],out _));
    }
}
