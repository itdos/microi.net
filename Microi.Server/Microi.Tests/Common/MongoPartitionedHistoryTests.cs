using System.Reflection;
using Microi.net;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class MongoPartitionedHistoryTests
{
    private static MethodInfo Method(string name) => typeof(V8MongoDB).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance)!;

    [Theory]
    [InlineData("2026-03-12T12:00:00.0000000Z", "2026-03-12T12:00:00.0000000Z")]
    [InlineData("2026-03-12T20:00:00.0000000+08:00", "2026-03-12T12:00:00.0000000Z")]
    [InlineData("2025-12-31T16:00:00.0000000-08:00", "2026-01-01T00:00:00.0000000Z")]
    public void Cursor_PreservesTimestampAndObjectIdAcrossTimeZones(string time, string expectedUtc)
    {
        var id = ObjectId.Parse("000000000000000000000006");
        var text = new JObject { ["v"] = 1, ["scope"] = "bound-scope", ["time"] = time, ["id"] = id.ToString() }.ToString();
        object[] args = { text, "bound-scope", default(DateTime), ObjectId.Empty };
        Assert.True((bool)Method("TryParsePageCursor").Invoke(null, args)!);
        var parsed = (DateTime)args[2];
        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
        Assert.Equal(expectedUtc, parsed.ToString("O"));
        Assert.Equal(id, args[3]);
        var serialized = (string)Method("PageCursor").Invoke(null, new object[] { "bound-scope", parsed, id })!;
        object[] repeated = { serialized, "bound-scope", default(DateTime), ObjectId.Empty };
        Assert.True((bool)Method("TryParsePageCursor").Invoke(null, repeated)!);
        Assert.Equal(parsed, repeated[2]); Assert.Equal(id, repeated[3]);
    }

    [Theory]
    [InlineData("2026-03-12T12:00:00", "bound-scope", "000000000000000000000006")]
    [InlineData("not-a-date", "bound-scope", "000000000000000000000006")]
    [InlineData("2026-03-12T12:00:00Z", "other-scope", "000000000000000000000006")]
    [InlineData("2026-03-12T12:00:00Z", "bound-scope", "invalid-id")]
    public void Cursor_RejectsAmbiguousTimeOrUnboundIdentity(string time, string scope, string id)
    {
        var text = new JObject { ["v"] = 1, ["scope"] = scope, ["time"] = time, ["id"] = id }.ToString();
        object[] args = { text, "bound-scope", default(DateTime), ObjectId.Empty };
        Assert.False((bool)Method("TryParsePageCursor").Invoke(null, args)!);
    }

    [Theory]
    [InlineData("diy_chat_tenant", "chat_2025", true)]
    [InlineData("diy_chat_tenant_2026", "chat_202601", true)]
    [InlineData("diy_chat_tenant_2026", "chat_2026_01", true)]
    [InlineData("diy_chat_tenant_2025", "chat_202601", false)]
    [InlineData("diy_chat_other_2026", "chat_202601", false)]
    [InlineData("diy_chat_tenant_2026", "chat_202613", false)]
    [InlineData("diy_chat_tenant", "chat_last_contact", false)]
    public void Directory_OnlyAcceptsOwnTenantYearAndMonth(string database, string table, bool expected)
    {
        var location = Method("ParsePageLocation").Invoke(null, new object[] {database, table, "diy_chat_tenant", "chat"});
        Assert.Equal(expected, location != null);
    }

    [Fact]
    public void AnnualAndMonthBoundaries_AreContiguousAcrossYear()
    {
        var parse = Method("ParsePageLocation");
        var previous = parse.Invoke(null, new object[] { "diy_chat_tenant", "chat_2025", "diy_chat_tenant", "chat" })!;
        var current = parse.Invoke(null, new object[] { "diy_chat_tenant_2026", "chat_202601", "diy_chat_tenant", "chat" })!;
        Assert.Equal(previous.GetType().GetProperty("EndExclusive")!.GetValue(previous), current.GetType().GetProperty("StartInclusive")!.GetValue(current));
    }

    [Fact]
    public void InvalidOrUnboundedQuery_FailsBeforeOpeningConnection()
    {
        using var scope = V8TenantContext.Enter("history-tenant", "test", "test");
        var mongo = new V8MongoDB();
        foreach (var size in new[] { 0, 101 })
        {
            var result = mongo.GetPartitionedTableData(new JObject { ["DatabasePrefix"]="diy_chat", ["TablePrefix"]="chat", ["PageSize"]=size });
            Assert.Equal(0, result.Code);
            Assert.Contains("参数", result.Msg);
        }
        var empty = mongo.GetPartitionedTableData(new JObject { ["DatabasePrefix"]="diy_chat", ["TablePrefix"]="chat", ["_Where"]=new JArray() });
        Assert.Equal(0, empty.Code);
        Assert.Contains("_Where", empty.Msg);
        var foreign = mongo.GetPartitionedTableData(new JObject {
            ["DatabasePrefix"]="diy_chat", ["TablePrefix"]="chat", ["_Where"]=new JArray { new JArray("ToUserId", "=", "me") },
            ["Cursor"]="{\"v\":1,\"scope\":\"foreign\",\"time\":\"2026-01-01T00:00:00Z\",\"id\":\"aaaaaaaaaaaaaaaaaaaaaaaa\"}"
        });
        Assert.Equal(0, foreign.Code);
        Assert.Contains("不属于", foreign.Msg);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void IdIn_RendersNativeObjectIdsForCsvAndArray(bool array)
    {
        var first = "aaaaaaaaaaaaaaaaaaaaaaaa";
        var second = "bbbbbbbbbbbbbbbbbbbbbbbb";
        object values = array ? new JArray(first, second) : first + "," + second;
        var filter = (FilterDefinition<dynamic>)Method("CreateObjectIdFilter").Invoke(null, new[] { "IN", values })!;
        var registry = BsonSerializer.SerializerRegistry;
        var bson = filter.Render(new RenderArgs<dynamic>(registry.GetSerializer<dynamic>(), registry));
        Assert.Equal(new BsonArray {ObjectId.Parse(first), ObjectId.Parse(second)}, bson["_id"]["$in"].AsBsonArray);
    }

    [Fact]
    public void InvalidId_DoesNotSilentlyDropItsFilter()
    {
        var filters = new List<FilterDefinition<dynamic>>();
        var error = Assert.Throws<TargetInvocationException>(() => Method("GetWhereSql").Invoke(new V8MongoDB(), new object[] {
            new JArray { new JArray("_id", "In", "aaaaaaaaaaaaaaaaaaaaaaaa,not-an-id") }, filters
        }));
        Assert.IsType<ArgumentException>(error.InnerException);
        Assert.Contains("ObjectId", error.InnerException!.Message);
        Assert.Empty(filters);
    }
}
