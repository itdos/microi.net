using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class ApiControllerOwnershipCatalogTests
{
    [Fact]
    public void Catalog_CoversEveryRemainingControllerAndNoRemovedFacadeExists()
    {
        var serverRoot = FindServerRoot();
        var apiRoot = Path.Combine(serverRoot, "Microi.net.Api");
        var controllersRoot = Path.Combine(apiRoot, "Controllers");
        var catalog = JObject.Parse(File.ReadAllText(Path.Combine(
            apiRoot,
            "api-ownership-catalog.json")));
        var catalogControllers = ((JObject)catalog["Controllers"]!)
            .Properties()
            .Select(property => property.Name)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        var sourceControllers = Directory.GetFiles(controllersRoot, "*Controller*.cs")
            .SelectMany(file => Regex.Matches(
                File.ReadAllText(file),
                @"\bclass\s+(?<name>[A-Za-z0-9_]+Controller)\b")
                .Select(match => match.Groups["name"].Value))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(sourceControllers, catalogControllers);
        Assert.DoesNotContain(
            ((JObject)catalog["Controllers"]!).Properties(),
            property => string.Equals(
                property.Value["Disposition"]?.ToString(),
                "ManagedBusinessFacade",
                StringComparison.Ordinal));

        foreach (var migrated in ((JObject)catalog["MigratedControllers"]!).Properties())
        {
            Assert.False(File.Exists(Path.Combine(
                controllersRoot,
                migrated.Name + ".cs")),
                $"已迁移 Controller 不得重新进入宿主源码：{migrated.Name}");
            Assert.False(string.IsNullOrWhiteSpace(migrated.Value["Target"]?.ToString()));
        }
    }

    [Fact]
    public void DynamicRoute_DoesNotReserveRemovedControllerPrefixes()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.net.Api",
            "Handler",
            "DynamicApiEngine.cs"));
        foreach (var prefix in new[]
        {
            "/api/aiworkflow/", "/api/backgroundtask/", "/api/cache/", "/api/im/",
            "/api/job/", "/api/mq/", "/api/mqtt/", "/api/onlineterminal/",
            "/api/searchengine/", "/api/spider/", "/api/syslog/"
        })
        {
            Assert.DoesNotContain($"\"{prefix}\"", source, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.net.Api"))
                && Directory.Exists(Path.Combine(directory.FullName, "Microi.Core")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }
}
