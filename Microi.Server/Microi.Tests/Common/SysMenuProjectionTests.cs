using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class SysMenuProjectionTests
{
    [Fact]
    public void MenuDiscoveryQuery_DoesNotDelegateProjectionToDiyFieldMetadata()
    {
        var currentUser = new JObject
        {
            ["Id"] = "user-1",
            ["Account"] = "admin"
        };
        var request = new SysMenuParam
        {
            OsClient = "test",
            _Lang = "zh-cn",
            _CurrentUser = currentUser,
            _SelectFields = new List<string> { "Id", "Name" }
        };
        var where = new List<List<object>>
        {
            new() { "IsDeleted", "<>", 1 }
        };

        var query = SysMenuLogic.CreateMenuDiscoveryQuery(request, where);

        Assert.Null(query._SelectFields);
        Assert.True(query._TrustedServerInvocation);
        Assert.Equal("Server", query._InvokeType);
        Assert.Same(where, query._Where);
        Assert.Same(currentUser, query._CurrentUser);
    }

    [Fact]
    public void MenuProjection_UsesPhysicalRowAndKeepsTreeFields()
    {
        var rows = new List<dynamic>
        {
            new JObject
            {
                ["Id"] = "menu-1",
                ["Name"] = "系统管理",
                ["ParentId"] = "root",
                ["Sort"] = 10,
                ["MoreBtns"] = "sensitive-large-script"
            }
        };

        var result = SysMenuLogic.ProjectMenuRows(rows, new[] { "id", "name" });

        var menu = Assert.IsType<JObject>(Assert.Single(result));
        Assert.Equal("menu-1", menu["Id"]?.ToString());
        Assert.Equal("系统管理", menu["Name"]?.ToString());
        Assert.Equal("root", menu["ParentId"]?.ToString());
        Assert.Equal("10", menu["Sort"]?.ToString());
        Assert.Null(menu["MoreBtns"]);
    }

    [Fact]
    public void MenuProjection_WithoutExplicitFields_PreservesThePhysicalRow()
    {
        var source = new JObject
        {
            ["Id"] = "menu-1",
            ["Name"] = "系统管理",
            ["ComponentPath"] = "/system/index"
        };
        var rows = new List<dynamic> { source };

        var result = SysMenuLogic.ProjectMenuRows(rows, null);

        Assert.Same(source, Assert.Single(result));
    }
}
