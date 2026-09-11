using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HdfsUploadCompatibilityTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("0", false)]
    [InlineData("false", false)]
    [InlineData("invalid", false)]
    [InlineData("2", false)]
    [InlineData("1", true)]
    [InlineData("TRUE", true)]
    public void LegacySwitchRequiresExplicitEnable(string? value, bool expected)
        => Assert.Equal(expected, LegacyUploadResponse.IsEnabled(value));

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FallbackPreservesModernFieldsAndRestoresLegacyArray(bool multiple)
    {
        var row = new JObject { ["Name"] = "前.jpg", ["Path"] = "/tenant/img/前.jpg",
            ["Url"] = "https://example.test/private-ticket", ["Size"] = 575599, ["Id"] = "id", ["Limit"] = true };
        var result = new DosResult(1, multiple ? new JArray(row) : row);
        var original = JToken.FromObject(result.Data);
        Assert.Same(result, LegacyUploadResponse.Apply(result, false));
        Assert.True(JToken.DeepEquals(original, JToken.FromObject(result.Data)));
        LegacyUploadResponse.Apply(result, true);
        var token = JToken.FromObject(result.Data);
        Assert.IsType<JArray>(token);
        Assert.Single((JArray)token);
        var actual = (JObject)token[0]!;
        Assert.All(row.Properties(), property => Assert.True(JToken.DeepEquals(property.Value, actual[property.Name])));
        Assert.Equal("image", actual["type"]);
        Assert.Equal("前", actual["name"]);
        Assert.Equal(actual["Url"], actual["url"]);
        Assert.Equal(false, actual["uploading"]);
        Assert.Equal(100, actual["progress"]);
        Assert.Equal(0, actual["duration"]);
    }

    [Fact]
    public void CompatibilityNeverDoubleWrapsMultipleFiles()
    {
        var input = new JArray(new JObject { ["Name"] = "a.jpg", ["Id"] = "a" },
            new JObject { ["Name"] = "b.jpg", ["Id"] = "b" });
        var result = new DosResult(1, input);
        LegacyUploadResponse.Apply(result, true);
        var once = JToken.FromObject(result.Data);
        LegacyUploadResponse.Apply(result, true);
        Assert.True(JToken.DeepEquals(once, JToken.FromObject(result.Data)));
        var rows = Assert.IsType<JArray>((object)result.Data);
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.IsType<JObject>(row));
    }

    [Fact]
    public void FailedUploadIsNeverMarkedComplete()
    {
        var failed = new DosResult(0, new JObject { ["Path"] = "/partial" }, "denied");
        Assert.Same(failed, LegacyUploadResponse.Apply(failed, true));
        Assert.Null(((JObject)failed.Data)["progress"]);
    }

    [Fact]
    public async Task RequestAtomBindsExactTenantAndEngineAndExecutesOnlyOnce()
    {
        var calls = 0;
        var uploaded = new DosResult(1, new JObject { ["Path"] = "/tenant/img/a.jpg" });
        using (HdfsUploadRequestContext.Enter("tenant", "custom-upload", true, () =>
        {
            Interlocked.Increment(ref calls);
            return Task.FromResult(uploaded);
        }))
        {
            Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("other", "custom-upload"))
                Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("tenant", "other-engine"))
                Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("tenant", "custom-upload"))
            {
                Assert.True(HdfsUploadRequestContext.IsLegacyEnabled());
                var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => HdfsUploadRequestContext.UploadAsync()));
                Assert.All(results, result => Assert.Same(uploaded, result));
            }
            Assert.Equal(1, calls);
        }
        Assert.False(HdfsUploadRequestContext.HasCurrentRequest);
        Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
    }

    [Fact]
    public async Task FailedStorageIsNotRetriedWithinTheSameRequest()
    {
        var calls = 0;
        using var scope = HdfsUploadRequestContext.Enter("tenant", "upload", false, () =>
        {
            calls++;
            return Task.FromException<DosResult>(new IOException("uncertain storage result"));
        });
        using var tenant = V8TenantContext.Enter("tenant", "upload");
        await Assert.ThrowsAsync<IOException>(() => HdfsUploadRequestContext.UploadAsync());
        await Assert.ThrowsAsync<IOException>(() => HdfsUploadRequestContext.UploadAsync());
        Assert.Equal(1, calls);
    }
}
