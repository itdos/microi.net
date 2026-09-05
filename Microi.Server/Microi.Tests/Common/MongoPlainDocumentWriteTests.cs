using System.Reflection;
using Microi.net;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace Microi.Tests.Common;

public sealed class MongoPlainDocumentWriteTests
{
    [Fact]
    public void InsertDocument_KeepsIdentityAndQueryFieldsAtTheRoot()
    {
        var id = ObjectId.Parse("58da170a41ff9d630a1551c6");
        var document = Build(new Dictionary<string, object>
        {
            ["_id"] = id,
            ["FromUserId"] = "user-a",
            ["ToUserId"] = "user-b",
            ["RequestId"] = "request-a",
            ["IsRead"] = false,
            ["CreateTime"] = new DateTime(2026, 9, 5, 4, 20, 0, DateTimeKind.Utc)
        });

        var stored = BsonSerializer.Deserialize<BsonDocument>(document.ToBson());
        Assert.Equal(id, stored["_id"].AsObjectId);
        Assert.Equal("user-a", stored["FromUserId"].AsString);
        Assert.Equal("request-a", stored["RequestId"].AsString);
        Assert.False(stored["IsRead"].AsBoolean);
        Assert.Equal(BsonType.DateTime, stored["CreateTime"].BsonType);
        Assert.False(stored.Contains("_v"));
        Assert.False(stored.Contains("_t"));
    }

    [Fact]
    public void InsertDocument_PreservesNestedValuesWithoutClrWrappers()
    {
        var document = Build(new Dictionary<string, object>
        {
            ["Details"] = new Dictionary<string, object> { ["Name"] = "device", ["Enabled"] = true },
            ["Tags"] = new List<object> { "gas", 2L },
            ["Empty"] = null!
        });
        Assert.Equal("device", document["Details"]["Name"].AsString);
        Assert.True(document["Details"]["Enabled"].AsBoolean);
        Assert.Equal(2, document["Tags"].AsBsonArray.Count);
        Assert.Equal(BsonNull.Value, document["Empty"]);
        Assert.DoesNotContain("_v", document.ToJson(), StringComparison.Ordinal);
    }

    [Fact]
    public void DynamicDictionary_ReproducesTheLegacyWrapper()
    {
        object legacy = new Dictionary<string, object> { ["UserId"] = "user-a" };
        var stored = BsonSerializer.Deserialize<BsonDocument>(legacy.ToBson());
        Assert.True(stored.Contains("_v"));
        Assert.False(stored.Contains("UserId"));
    }

    private static BsonDocument Build(Dictionary<string, object> model)
    {
        var method = typeof(V8MongoDB).GetMethod("CreateInsertDocument", BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return Assert.IsType<BsonDocument>(method.Invoke(null, new object[] { model }));
    }
}
