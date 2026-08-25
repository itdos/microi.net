using System.Reflection;
using System.Text.RegularExpressions;
using Microi.net;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace Microi.Tests.Common;

public sealed class MongoDynamicDiscriminatorCompatibilityTests
{
    [Fact]
    public void DynamicReadProjection_ExcludesLegacyClrDiscriminator()
    {
        var projection = BuildReadProjection<object>(null);

        var rendered = projection!.Render(new RenderArgs<object>(
            BsonSerializer.LookupSerializer<object>(),
            BsonSerializer.SerializerRegistry));

        Assert.Equal(0, rendered["_t"].AsInt32);

        // MongoDB applies the exclusion before ObjectSerializer sees the document. Reproduce the
        // materialization boundary without requiring a live MongoDB process.
        var projectedLegacyDocument = new BsonDocument
        {
            { "_t", "MessageChatContactListParam" },
            { "UserId", "user-a" },
            { "ContactUserId", "user-b" }
        };
        projectedLegacyDocument.Remove("_t");

        var exception = Record.Exception(
            () => BsonSerializer.Deserialize<object>(projectedLegacyDocument));
        Assert.Null(exception);
    }

    [Fact]
    public void DynamicReadProjection_DoesNotAllowCallerToRequestInternalDiscriminator()
    {
        var projection = BuildReadProjection<object>(new[] { "UserId", "_t" });

        var rendered = projection!.Render(new RenderArgs<object>(
            BsonSerializer.LookupSerializer<object>(),
            BsonSerializer.SerializerRegistry));

        Assert.Equal(1, rendered["UserId"].AsInt32);
        Assert.False(rendered.Contains("_t"));
    }

    [Fact]
    public void TypedReadProjection_PreservesExistingPolymorphicBehavior()
    {
        Assert.Null(BuildReadProjection<MessageBody>(null));
    }

    [Fact]
    public void AllGenericReadPaths_ApplyTheDiscriminatorSafeProjection()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(), "Microi.MongoDB", "MongodbHelper.cs"));

        Assert.Equal(6, Regex.Matches(
            source,
            @"BuildReadProjection\(field\)",
            RegexOptions.CultureInvariant).Count);
        Assert.Contains("public static DosResult<T> Find(", source, StringComparison.Ordinal);
        Assert.Contains("public static async Task<DosResult<T>> FindAsync(", source, StringComparison.Ordinal);
        Assert.Contains("public static List<T> FindList(", source, StringComparison.Ordinal);
        Assert.Contains("public static async Task<DosResultList<T>> FindListAsync(", source, StringComparison.Ordinal);
        Assert.Contains("public static List<T> FindListByPage(", source, StringComparison.Ordinal);
        Assert.Contains("public static async Task<List<T>> FindListByPageAsync(", source, StringComparison.Ordinal);
    }

    [Fact]
    public void PublicDocumentation_ExplainsThatInternalMongoDiscriminatorIsNotAV8BusinessField()
    {
        var workspaceRoot = Directory.GetParent(FindServerRoot())!.FullName;
        var documentation = File.ReadAllText(Path.Combine(
            workspaceRoot, "microi.doc", "docs", "doc", "v8-engine", "v8-server.md"));
        var skill = File.ReadAllText(Path.Combine(
            workspaceRoot, "microi.skills", "v8-mongodb", "SKILL.md"));

        const string compatibilityContract =
            "服务端会在 MongoDB 投影阶段过滤 BSON 内部 `_t` CLR 类型判别字段";
        const string ownershipContract = "不得读取、筛选或依赖 `_t`";
        Assert.Contains(compatibilityContract, documentation, StringComparison.Ordinal);
        Assert.Contains(ownershipContract, documentation, StringComparison.Ordinal);
        Assert.Contains(compatibilityContract, skill, StringComparison.Ordinal);
        Assert.Contains(ownershipContract, skill, StringComparison.Ordinal);
    }

    private static ProjectionDefinition<T>? BuildReadProjection<T>(string[]? fields)
        where T : class, new()
    {
        var method = typeof(TMongodbHelper<T>).GetMethod(
            "BuildReadProjection",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var value = method.Invoke(null, new object?[] { fields });
        return value == null
            ? null
            : Assert.IsAssignableFrom<ProjectionDefinition<T>>(value);
    }

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.MongoDB", "Microi.MongoDB.csproj")))
                return directory.FullName;

            var nested = Path.Combine(directory.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.MongoDB", "Microi.MongoDB.csproj")))
                return nested;

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Unable to locate Microi.Server root.");
    }
}
