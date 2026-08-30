using System.Collections.Concurrent;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiyMessageConcurrencyTests
{
    [Fact]
    public void TenantMessageSnapshots_SupportConcurrentReadersAndWriters()
    {
        var osClient = "test-lang-" + Guid.NewGuid().ToString("N");
        var failures = new ConcurrentQueue<Exception>();
        try
        {
            DiyMessage.ReplaceTenantMessages(osClient, new Dictionary<string, JObject>
            {
                ["Greeting"] = Message("你好", "Hello")
            });

            Parallel.For(0, 200, index =>
            {
                try
                {
                    if ((index & 1) == 0)
                    {
                        DiyMessage.UpsertTenantMessage(
                            osClient,
                            "Key" + index,
                            Message("值" + index, "Value" + index));
                    }
                    else
                    {
                        Assert.Equal("Hello", DiyMessage.GetLang(osClient, "Greeting", "en"));
                        _ = DiyMessage.GetLangBundle(osClient, "en");
                    }
                }
                catch (Exception ex)
                {
                    failures.Enqueue(ex);
                }
            });

            Assert.Empty(failures);
            Assert.True(DiyMessage.Msg.TryGetValue(osClient, out var snapshot));
            Assert.NotNull(snapshot);
            Assert.Equal(101, snapshot.Count);
        }
        finally
        {
            DiyMessage.Msg.TryRemove(osClient, out _);
            DiyMessage.ClearSourceTextCache(osClient);
        }
    }

    [Fact]
    public void UpsertTenantMessage_InvalidatesSourceTextLookupCache()
    {
        var osClient = "test-lang-cache-" + Guid.NewGuid().ToString("N");
        try
        {
            DiyMessage.ReplaceTenantMessages(osClient, new Dictionary<string, JObject>
            {
                ["Greeting"] = Message("你好", "Hello")
            });
            Assert.True(DiyMessage.TryGetLangBySourceText(osClient, "你好", "en", out var oldValue));
            Assert.Equal("Hello", oldValue);

            DiyMessage.UpsertTenantMessage(osClient, "Greeting", Message("你好", "Welcome"));

            Assert.True(DiyMessage.TryGetLangBySourceText(osClient, "你好", "en", out var newValue));
            Assert.Equal("Welcome", newValue);
        }
        finally
        {
            DiyMessage.Msg.TryRemove(osClient, out _);
            DiyMessage.ClearSourceTextCache(osClient);
        }
    }

    private static JObject Message(string zhCn, string en)
    {
        return JObject.FromObject(new { ZhCN = zhCn, En = en, Code = zhCn });
    }
}
