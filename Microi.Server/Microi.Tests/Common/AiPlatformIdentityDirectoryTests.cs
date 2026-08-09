using System.Net;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class AiPlatformIdentityDirectoryTests
{
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("10.1.2.3")]
    [InlineData("172.16.0.1")]
    [InlineData("192.168.1.1")]
    [InlineData("169.254.10.2")]
    [InlineData("100.64.0.1")]
    [InlineData("198.18.0.1")]
    [InlineData("::1")]
    [InlineData("fe80::1")]
    [InlineData("fd00::1")]
    public void Directory_reader_rejects_private_loopback_and_reserved_addresses(string value)
    {
        Assert.False(V8Method.IsPublicIdentityDirectoryAddress(IPAddress.Parse(value)));
    }

    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("2606:4700:4700::1111")]
    public void Directory_reader_accepts_public_addresses(string value)
    {
        Assert.True(V8Method.IsPublicIdentityDirectoryAddress(IPAddress.Parse(value)));
    }

    [Fact]
    public void Scim_users_are_normalized_without_returning_credentials_or_raw_payload()
    {
        var body = JObject.Parse("""
        {
          "totalResults": 2,
          "startIndex": 1,
          "itemsPerPage": 1,
          "Resources": [{
            "id": "external-1",
            "userName": "ZhangSan",
            "displayName": "张三",
            "active": true,
            "emails": [{"value":"zhangsan@example.com","primary":true}],
            "phoneNumbers": [{"value":"13800000000"}],
            "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {"department":"研发部"},
            "password": "must-never-escape"
          }]
        }
        """);

        var result = V8Method.NormalizeScimListResponse("Users", body);
        var record = Assert.IsType<JObject>(Assert.IsType<JArray>(result["Records"])[0]);

        Assert.Equal("external-1", record["ExternalId"]?.ToString());
        Assert.Equal("ZhangSan", record["Account"]?.ToString());
        Assert.Equal("张三", record["Name"]?.ToString());
        Assert.Equal("研发部", record["DeptName"]?.ToString());
        Assert.True(record["Active"]?.Value<bool>());
        Assert.Null(record["password"]);
        Assert.DoesNotContain("must-never-escape", result.ToString());
        Assert.True(result["HasMore"]?.Value<bool>());
        Assert.Equal(2, result["NextStartIndex"]?.Value<int>());
    }

    [Fact]
    public void Scim_groups_preserve_only_member_identity_and_display_fields()
    {
        var body = JObject.Parse("""
        {
          "totalResults": 1,
          "Resources": [{
            "id": "group-1",
            "displayName": "研发团队",
            "members": [{"value":"user-1","display":"张三","$ref":"https://internal/Users/user-1"}]
          }]
        }
        """);

        var result = V8Method.NormalizeScimListResponse("Groups", body);
        var group = Assert.IsType<JObject>(Assert.IsType<JArray>(result["Records"])[0]);
        var member = Assert.IsType<JObject>(Assert.IsType<JArray>(group["Members"])[0]);

        Assert.Equal("group-1", group["ExternalId"]?.ToString());
        Assert.Equal("研发团队", group["Name"]?.ToString());
        Assert.Equal("user-1", member["ExternalId"]?.ToString());
        Assert.Null(member["$ref"]);
    }

    [Fact]
    public void Authorization_explain_reuses_the_real_form_engine_boundary_and_hashes_row_scope()
    {
        var serverRoot = FindServerRoot();
        var host = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net",
            "V8Engine",
            "V8Method.AuthorizationExplain.cs"));
        var engine = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net",
            "FormEngine",
            "FormEngineAuthorizationExplain.cs"));

        Assert.Contains("ExplainClientTableAuthorizationAsync", host);
        Assert.Contains("AuthorizeClientTableAsync", engine);
        Assert.Contains("PlatformResourceSecurity.RequiresPlatformAdministrator", engine);
        Assert.Contains("DefinitionHash", engine);
        Assert.Contains("MatchedGrants", engine);
        Assert.DoesNotContain("SqlWhere =", engine);
        Assert.DoesNotContain("SqlJoin =", engine);
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(current.FullName, "Microi.net", "Microi.net.csproj")))
                return current.FullName;
            var nested = Path.Combine(current.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(nested, "Microi.net", "Microi.net.csproj")))
                return nested;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("未找到Microi.Server根目录。");
    }
}
