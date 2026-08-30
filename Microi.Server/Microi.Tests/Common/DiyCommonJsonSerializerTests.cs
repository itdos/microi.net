using System.Collections.Concurrent;
using System.Threading;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiyCommonJsonSerializerTests
{
    [Fact]
    public void GetJsonSerializer_ReusesWithinThreadAndIsolatesDifferentThreads()
    {
        var serializers = new ConcurrentBag<Newtonsoft.Json.JsonSerializer>();
        var failures = new ConcurrentBag<Exception>();
        var threads = Enumerable.Range(0, 4)
            .Select(index => new Thread(() =>
            {
                try
                {
                    var first = DiyCommon.GetJsonSerializer();
                    var second = DiyCommon.GetJsonSerializer();
                    if (!ReferenceEquals(first, second))
                    {
                        throw new InvalidOperationException("同一线程未复用序列化器。");
                    }

                    var value = JObject.FromObject(
                        new SerializerFixture { Id = index },
                        first).ToObject<SerializerFixture>(first);
                    if (value?.Id != index)
                    {
                        throw new InvalidOperationException("并发序列化结果不正确。");
                    }
                    serializers.Add(first);
                }
                catch (Exception ex)
                {
                    failures.Add(ex);
                }
            }))
            .ToArray();

        foreach (var thread in threads) thread.Start();
        foreach (var thread in threads) thread.Join();

        Assert.Empty(failures);
        Assert.Equal(4, serializers.Count);
        var instances = serializers.ToArray();
        for (var left = 0; left < instances.Length; left++)
        {
            for (var right = left + 1; right < instances.Length; right++)
            {
                Assert.NotSame(instances[left], instances[right]);
            }
        }
        Assert.NotNull(typeof(DiyCommon).GetField(nameof(DiyCommon.JsonConfig)));
    }

    private sealed class SerializerFixture
    {
        public int Id { get; set; }
    }
}
