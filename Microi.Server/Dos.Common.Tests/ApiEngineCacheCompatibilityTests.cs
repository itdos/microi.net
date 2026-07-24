using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class ApiEngineCacheCompatibilityTests
{
    private static readonly MethodInfo NormalizeMethod =
        typeof(ApiEngine).GetMethod(
            "TryNormalizeApiEngineCache",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎缓存兼容方法不存在。");

    [Theory]
    [InlineData("{\"ApiEngineKey\":\"get-microi-store\",\"IsEnable\":1}")]
    [InlineData("\"{\\\"ApiEngineKey\\\":\\\"get-microi-store\\\",\\\"IsEnable\\\":1}\"")]
    public void StandardAndDoubleEncodedJsonBecomeDynamicObjects(string cachedValue)
    {
        var arguments = new object?[] { cachedValue, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var model = Assert.IsType<JObject>(arguments[1]);
        Assert.Equal("get-microi-store", model.Value<string>("ApiEngineKey"));
        Assert.Equal(1, model.Value<int>("IsEnable"));
    }

    [Fact]
    public void HistoricalSystemTypeNameIsRejectedForDatabaseFallback()
    {
        var arguments = new object?[]
        {
            "System.Dynamic.ExpandoObject",
            null
        };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.False(success);
        Assert.Null(arguments[1]);
    }

    [Fact]
    public void ExistingJObjectKeepsItsObjectShape()
    {
        var cachedValue = JObject.Parse(
            "{\"ApiEngineKey\":\"get-microi-store\",\"IsEnable\":1}");
        var arguments = new object?[] { cachedValue, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        Assert.Same(cachedValue, arguments[1]);
    }
}
