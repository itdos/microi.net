using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MongoV8BulkMutationContractTests
{
    [Fact]
    public void PublicContract_ExposesOnlyConditionBoundBulkMutations()
    {
        Assert.NotNull(typeof(IMongoDB).GetMethod(nameof(IMongoDB.UptFormDataByWhere)));
        Assert.NotNull(typeof(IMongoDB).GetMethod(nameof(IMongoDB.DelFormDataByWhere)));
        Assert.NotNull(typeof(V8MongoDB).GetMethod(nameof(V8MongoDB.UptFormDataByWhere)));
        Assert.NotNull(typeof(V8MongoDB).GetMethod(nameof(V8MongoDB.DelFormDataByWhere)));
    }

    [Fact]
    public void BulkMutation_RejectsEmptyWhereBeforeOpeningMongoConnection()
    {
        var mongo = new V8MongoDB();
        using var scope = V8TenantContext.Enter("bulk-mutation-tenant-a", "test", "test");

        var update = mongo.UptFormDataByWhere(new JObject
        {
            ["DbName"] = "test",
            ["TableName"] = "rows",
            ["_Where"] = new JArray(),
            ["_FormData"] = new JObject { ["IsRead"] = true }
        });
        var delete = mongo.DelFormDataByWhere(new JObject
        {
            ["DbName"] = "test",
            ["TableName"] = "rows",
            ["_Where"] = new JArray()
        });

        Assert.Equal(0, update.Code);
        Assert.Equal(0, delete.Code);
        Assert.Contains("_Where", update.Msg);
        Assert.Contains("_Where", delete.Msg);
    }

    [Theory]
    [InlineData("_id")]
    [InlineData("_ID")]
    [InlineData("_id.child")]
    public void BulkUpdate_RejectsImmutableIdFieldsBeforeOpeningMongoConnection(string field)
    {
        var mongo = new V8MongoDB();
        using var scope = V8TenantContext.Enter("bulk-mutation-tenant-a", "test", "test");

        var result = mongo.UptFormDataByWhere(new JObject
        {
            ["DbName"] = "test",
            ["TableName"] = "rows",
            ["_Where"] = Where("UserId", "=", "user-a"),
            ["_FormData"] = new JObject { [field] = "forged" }
        });

        Assert.Equal(0, result.Code);
        Assert.Contains("不可修改", result.Msg);
    }

    [Fact]
    public void BulkMutation_RejectsUnsafeOrPartiallyInvalidWhereFields()
    {
        var validate = typeof(V8MongoDB).GetMethod(
            "IsSafeMutationWhere",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(validate);

        var normalArguments = new object?[] { Where("UserId", "=", "user-a"), null };
        Assert.True(Assert.IsType<bool>(validate!.Invoke(null, normalArguments)));
        Assert.Null(normalArguments[1]);

        var unsafeArguments = new object?[]
        {
            new JArray
            {
                new JArray("UserId", "=", "user-a"),
                new JArray("$where", "=", "forged")
            },
            null
        };
        Assert.False(Assert.IsType<bool>(validate.Invoke(null, unsafeArguments)));
        Assert.Contains("_Where", Assert.IsType<string>(unsafeArguments[1]));
    }

    [Fact]
    public void BulkMutation_UsesAmbientTenantAndRejectsForgedTenantSelection()
    {
        var resolve = typeof(V8MongoDB).GetMethod(
            "ResolveV8MongoTenant",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(resolve);

        using var scope = V8TenantContext.Enter("bulk-mutation-tenant-a", "test", "test");
        Assert.Equal("bulk-mutation-tenant-a", resolve!.Invoke(null, new object?[] { null }));
        Assert.Equal("bulk-mutation-tenant-a", resolve.Invoke(null, new object?[] { "tenant-b" }));
    }

    [Fact]
    public void SourceContract_ValidatesTenantWhereAndIdBeforeMongoWrite()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(), "Microi.MongoDB", "V8MongoDB.cs"));
        var updateStart = source.IndexOf("public DosResult UptFormDataByWhere", StringComparison.Ordinal);
        var deleteStart = source.IndexOf("public DosResult DelFormDataByWhere", StringComparison.Ordinal);
        Assert.True(updateStart >= 0 && deleteStart > updateStart);
        var update = source.Substring(updateStart, deleteStart - updateStart);
        var delete = source.Substring(deleteStart);

        Assert.True(update.IndexOf("ResolveV8MongoTenant", StringComparison.Ordinal)
                    < update.IndexOf("UpdateMany", StringComparison.Ordinal));
        Assert.True(update.IndexOf("IsSafeMutationWhere", StringComparison.Ordinal)
                    < update.IndexOf("UpdateMany", StringComparison.Ordinal));
        Assert.True(update.IndexOf("_id.", StringComparison.OrdinalIgnoreCase)
                    < update.IndexOf("UpdateMany", StringComparison.Ordinal));
        Assert.True(delete.IndexOf("IsSafeMutationWhere", StringComparison.Ordinal)
                    < delete.IndexOf("DeleteMany", StringComparison.Ordinal));
        Assert.Contains("filters.Count == 0", update);
        Assert.Contains("filters.Count == 0", delete);
    }

    private static JArray Where(string field, string operation, object value)
    {
        return new JArray
        {
            new JArray(field, operation, JToken.FromObject(value))
        };
    }

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(directory.FullName, "Microi.MongoDB", "Microi.MongoDB.csproj")))
                return directory.FullName;
            var nested = Path.Combine(directory.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(nested, "Microi.MongoDB", "Microi.MongoDB.csproj")))
                return nested;
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Microi.Server root was not found.");
    }
}
