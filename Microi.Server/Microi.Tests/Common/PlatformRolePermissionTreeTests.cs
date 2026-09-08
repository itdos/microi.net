using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class PlatformRolePermissionTreeTests
{
    private static readonly string[] ExpectedFields =
    {
        "Id", "Name", "IconClass", "ParentId", "Sort", "MoreBtns",
        "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"
    };

    [Fact]
    public void RolePermissionTree_UsesAllMenusAndFixedNarrowProjection()
    {
        var param = new SysMenuParam
        {
            _All = false,
            _SelectFields = new List<string> { "Id", "LargePayload" }
        };

        V8Method.ConfigureRolePermissionTreeParam(param);

        Assert.True(param._All);
        Assert.Equal(ExpectedFields, param._SelectFields);
    }

    [Fact]
    public void AppStorePackage_DeliversRolePermissionTreeManagedAction()
    {
        var root = FindRepositoryRoot();
        var resourceDirectory = Path.Combine(
            root,
            "Microi.Server",
            "Microi.Upgrade",
            "Resource");
        var source = File.ReadAllText(Path.Combine(resourceDirectory, "platform-sys-menu.js"))
            .Replace("\r\n", "\n");
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            resourceDirectory,
            "app.microi.store.json")));
        var engine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-sys-menu");

        // v1.0.4 保留角色权限树，并增加旧客户端菜单入口兼容；锁定实际发行契约。
        Assert.Equal("v1.0.4", engine["Version"]?.ToString());
        Assert.Equal(source.TrimEnd(), engine["ApiV8Code"]?.ToString().Replace("\r\n", "\n").TrimEnd());
        Assert.Contains("GetRolePermissionTree", engine["ApiRoutes"]?.ToString());
        Assert.Contains("GetRolePermissionTree", source, StringComparison.Ordinal);
        Assert.Equal(
            "Managed",
            package["ResourcePolicies"]?["ApiEngines"]?["platform-sys-menu"]?["UpgradePolicy"]?.ToString());
        Assert.Contains(
            package["PackageInfo"]?["Capabilities"]!.Values<string>(),
            value => value == "ClientFeature:RolePermissionTreeCachedV1");
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Cannot locate repository root.");
    }
}
