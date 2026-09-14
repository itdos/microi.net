using Dos.Common;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ApiEngineLogParametersTests
{
    [Fact]
    public void InternalIdentityIsNotTraversedAndBusinessValuesKeepTheirExactJson()
    {
        var identity = new JObject { ["RoleLimits"] = new PoisonValue() };
        var business = new JObject { ["_CurrentUser"] = "business nested field", ["Name"] = "中文", ["Null"] = null };
        var payload = new JObject { ["_CurrentUser"] = identity, ["Form"] = business, ["Amount"] = 1.25m,
            ["At"] = new DateTime(2026, 9, 13, 12, 0, 0), ["Enabled"] = true, ["__proto__"] = "value", ["Null"] = null };
        var expected = new JObject { ["Form"] = business.DeepClone(), ["Amount"] = 1.25m,
            ["At"] = new DateTime(2026, 9, 13, 12, 0, 0), ["Enabled"] = true, ["__proto__"] = "value", ["Null"] = null };
        Assert.Equal(JsonHelper.Serialize(expected), ApiEngineLogParameters.Serialize(payload));
        Assert.Same(identity, payload["_CurrentUser"]);
        Assert.Same(business, payload["Form"]);
        Assert.Equal("{}", ApiEngineLogParameters.Serialize(new JObject()));
        Assert.Null(ApiEngineLogParameters.Serialize(null!));
    }

    [Fact]
    public void LargeAdministratorDoesNotScaleLogAllocationOrLogSize()
    {
        var roles = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["Permission"] = new string('x', 96) }));
        var payload = new JObject { ["_CurrentUser"] = new JObject { ["Id"] = "trusted", ["RoleLimits"] = roles },
            ["Action"] = "Get", ["PageSize"] = 15, ["FilePathName"] = "tenant/private/report.pdf" };
        _ = ApiEngineLogParameters.Serialize(payload);
        var before = GC.GetAllocatedBytesForCurrentThread();
        var json = ApiEngineLogParameters.Serialize(payload);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.True(allocated < 128 * 1024, $"Log parameter encoding allocated {allocated:N0} bytes.");
        Assert.True(json.Length < 512);
        Assert.Null(JObject.Parse(json)["_CurrentUser"]);
        Assert.Equal(7403, roles.Count);
    }

    private sealed class PoisonValue : JValue
    {
        public PoisonValue() : base("internal") { }
        public override void WriteTo(JsonWriter writer, params JsonConverter[] converters)
            => throw new InvalidOperationException("Internal identity must never be visited by the log serializer.");
    }
}
