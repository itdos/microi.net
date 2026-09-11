using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class HdfsUploadDirectoryPolicyTests
{
    private static FormEngineAuthorizationSnapshot User(params string[] roles) => new()
    { UserId = "user-a", IsActiveUser = true, EffectiveRoleIds = roles.ToList() };

    private static DiyUploadParam Upload(string path, bool? limit = false) => new()
    { OsClient = "tenant-a", Path = path, Limit = limit, _CurrentUser = new JObject { ["Id"] = "user-a" } };

    private static IReadOnlyList<HdfsUploadDirectoryPolicy.Rule> Rules(bool publicFiles = false, bool descendants = true) =>
        HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject
        {
            ["Path"] = "files/processRoute", ["RoleIds"] = new JArray("role-a"),
            ["AllowPublic"] = publicFiles, ["IncludeSubdirectories"] = descendants
        }));

    [Fact]
    public void MissingConfiguration_DoesNotGrantAccess() => Assert.Empty(HdfsUploadDirectoryPolicy.Parse(null));

    [Theory]
    [InlineData("/files/processRoute/")]
    [InlineData("files/processRoute/detail")]
    public void AuthorizedLegacyDirectory_KeepsPathAndIsPrivateByDefault(string path)
    {
        var param = Upload(path);
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(param, Rules(), User("role-a"))!.Code);
        Assert.True(param.Limit);
        Assert.Equal(path.Trim('/'), param.Path);
    }

    [Theory]
    [InlineData("files/processRoute-evil")]
    [InlineData("files/processRoutes")]
    [InlineData("Files/processRoute")]
    [InlineData("files")]
    public void PrefixBoundaryAndCase_DoNotGrantSiblingPaths(string path) =>
        Assert.Null(HdfsUploadDirectoryPolicy.Apply(Upload(path), Rules(), User("role-a")));

    [Fact]
    public void SubdirectoriesMustBeExplicitlyEnabled() =>
        Assert.Null(HdfsUploadDirectoryPolicy.Apply(Upload("files/processRoute/child"), Rules(false, false), User("role-a")));

    [Theory]
    [InlineData("role-a-extra")]
    [InlineData("role-b")]
    public void RoleMembershipIsExact(string role) =>
        Assert.Null(HdfsUploadDirectoryPolicy.Apply(Upload("files/processRoute"), Rules(), User(role)));

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    [InlineData(null, true)]
    public void ExplicitPublicGrant_PreservesRequestedPrivate(bool? requested, bool expected)
    {
        var param = Upload("files/processRoute", requested);
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(param, Rules(true), User("role-a"))!.Code);
        Assert.Equal(expected, param.Limit);
    }

    [Fact]
    public void PendingModerationStaysPrivate()
    {
        var param = Upload("files/processRoute");
        param.ContentSecurityRequired = true;
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(param, Rules(true), User("role-a"))!.Code);
        Assert.True(param.Limit);
    }

    [Fact]
    public void AllAuthenticatedDoesNotAllowAnonymousOrInactiveUser()
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(JToken.Parse("[{\"Path\":\"Quality\",\"AllAuthenticated\":true,\"AllowPublic\":true}]"));
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(Upload("Quality"), rules, User())!.Code);
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(Upload("Quality"), rules, null)!.Code);
        var user = User(); user.IsActiveUser = false;
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(Upload("Quality"), rules, user)!.Code);
        var param = Upload("Quality"); param._CurrentUser = null;
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(param, rules, User())!.Code);
    }

    [Fact]
    public void JsonTableTextRoleArray_IsSupported()
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(new JValue("[{\"Path\":\"Quality\",\"RoleIds\":\"[\\\"role-a\\\"]\"}]"));
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(Upload("Quality"), rules, User("role-a"))!.Code);
    }

    [Fact]
    public void JsonTableBlankRoles_RequiresExplicitAllAuthenticated()
    {
        var row = new JObject { ["Path"] = "Quality", ["RoleIds"] = "", ["AllAuthenticated"] = true };
        Assert.Single(HdfsUploadDirectoryPolicy.Parse(new JArray(row)));
        row["AllAuthenticated"] = false;
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.Parse(new JArray(row)));
    }

    [Fact]
    public void ConfigurationSave_RejectsMalformedOnlyWhenFieldSubmitted()
    {
        HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("sys_config", new JObject { ["SysTitle"] = "title" });
        HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("business", new JObject { ["HdfsUploadRules"] = "invalid" });
        HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("SYS_CONFIG", new JObject { ["HdfsUploadRules"] = "[]" });
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("sys_config",
            new JObject { ["HdfsUploadRules"] = "invalid" }));
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("sys_config",
            new JObject { ["HdfsUploadRules"] = "[{\"Path\":\"/\",\"AllAuthenticated\":true}]" }));
    }

    [Fact]
    public void DifferentPrincipalCannotUseSnapshot()
    {
        var identity = User("role-a"); identity.UserId = "user-b";
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(Upload("files/processRoute"), Rules(), identity)!.Code);
    }

    [Fact]
    public void AccessKeySessionCannotAcquireDirectoryGrant()
    {
        var param = Upload("files/processRoute");
        param._CurrentUser["_AccessKeySession"] = true;
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(param, Rules(), User("role-a"))!.Code);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("../file")]
    [InlineData("file//a")]
    [InlineData("file/%252e%252e")]
    [InlineData("https://example.com/file")]
    [InlineData("file\\a")]
    [InlineData("micro-app/app")]
    [InlineData("ai-app-source-staged/abc")]
    [InlineData("database-backups")]
    [InlineData("file/_origin")]
    public void UnsafeAndPlatformPathsCannotBeGranted(string path) =>
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject
        { ["Path"] = path, ["AllAuthenticated"] = true })));

    [Theory]
    [InlineData("{}")]
    [InlineData("[{\"Path\":\"file\"}]")]
    [InlineData("[{\"Path\":\"file\",\"RoleIds\":[\"*\"]}]")]
    [InlineData("[{\"Path\":\"file\",\"AllAuthenticated\":\"yes\"}]")]
    public void MalformedPolicyFailsClosed(string value) =>
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.Parse(new JValue(value)));

    [Fact]
    public void RulesHaveBoundedSize()
    {
        var rows = new JArray(Enumerable.Range(0,129).Select(i => new JObject { ["Path"] = "file"+i, ["AllAuthenticated"] = true }));
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.Parse(rows));
    }

    [Fact]
    public void AvatarRemainsPrivateEvenWithPublicRule()
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(JToken.Parse("[{\"Path\":\"avatar\",\"AllAuthenticated\":true,\"AllowPublic\":true}]"));
        var param = Upload("avatar");
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(param,rules,User())!.Code);
        Assert.True(param.Limit);
    }

    [Fact]
    public async Task NoFieldContextNeverBypassesIncompleteFieldContext()
    {
        var result = await FileUploadSecurity.ApplyInteractivePolicyAsync(new DiyUploadParam
        { FormEngineKey = "business", Path = "Quality", Limit = false }, false);
        Assert.Equal(0, result.Code);
        Assert.Contains("FieldId", result.Msg);
    }

    [Theory]
    [InlineData("files/*", "files/inspection", true)]
    [InlineData("files/*", "files/inspection/photos", false)]
    [InlineData("files/*", "files", false)]
    [InlineData("files/inspect*", "files/inspect", true)]
    [InlineData("files/inspect*", "files/inspection", true)]
    [InlineData("files/inspect*", "files/inspect-1", true)]
    [InlineData("files/inspect*", "Files/inspection", false)]
    [InlineData("files/**", "files", true)]
    [InlineData("files/**", "files/a/b/c", true)]
    [InlineData("files/**/photos", "files/photos", true)]
    [InlineData("files/**/photos", "files/a/b/photos", true)]
    [InlineData("files/**/photos", "files/a/b/photos/new", false)]
    [InlineData("**/photos/**", "photos", true)]
    [InlineData("**/photos/**", "department/photos/2026/09", true)]
    [InlineData("files/line?", "files/line1", true)]
    [InlineData("files/line?", "files/line12", false)]
    [InlineData("files/line?", "files/line", false)]
    [InlineData("车间/产线?", "车间/产线甲", true)]
    [InlineData("files/[abc]", "files/b", true)]
    [InlineData("files/[abc]", "files/d", false)]
    [InlineData("files/202[0-9]", "files/2026", true)]
    [InlineData("files/[a-zA-Z]", "files/Q", true)]
    [InlineData("files/[!0-9]*", "files/photo", true)]
    [InlineData("files/[^0-9]*", "files/9photo", false)]
    [InlineData("files/{inspection,quality}/**", "files/quality/photo", true)]
    [InlineData("files/{inspection,quality}/**", "files/inventory", false)]
    [InlineData("{files,images}/{inspection,quality}", "images/quality", true)]
    [InlineData("files/{inspection,{quality,inventory}}", "files/inventory", true)]
    [InlineData("files/{workshop/a,quality}", "files/workshop/a", true)]
    [InlineData("*", "business", true)]
    [InlineData("*", "business/child", false)]
    [InlineData("**", "business/child", true)]
    [InlineData("/files/{a,b}/", "/files/b/", true)]
    [InlineData("files/a.b", "files/axb", false)]
    [InlineData("files/(a|b)", "files/a", false)]
    public void GlobSyntax_HasExplicitDirectorySemantics(string pattern, string path, bool expected)
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject { ["Path"] = pattern, ["AllAuthenticated"] = true }));
        var result = HdfsUploadDirectoryPolicy.Apply(Upload(path), rules, User());
        Assert.Equal(expected, result?.Code == 1);
    }

    [Theory]
    [InlineData("files/[abc")]
    [InlineData("files/a]")]
    [InlineData("files/[]")]
    [InlineData("files/[!]")]
    [InlineData("files/[z-a]")]
    [InlineData("files/[a*]")]
    [InlineData("files/{a,b")]
    [InlineData("files/a,b}")]
    [InlineData("files/{a,}")]
    [InlineData("files/{a}")]
    [InlineData("files/a**b")]
    [InlineData("files/***")]
    [InlineData("files/{a,../b}")]
    [InlineData("{business,micro-app}/**")]
    [InlineData("files/{a,_origin}/**")]
    [InlineData("files/{a,b}/{a,b}/{a,b}/{a,b}/{a,b}/{a,b}")]
    [InlineData("{a,{b,{c,{d,{e,f}}}}}")]
    public void MalformedOrExcessiveGlob_IsRejectedAtSave(string pattern) =>
        Assert.Throws<ArgumentException>(() => HdfsUploadDirectoryPolicy.ValidateConfigurationWrite("sys_config",
            new JObject { ["HdfsUploadRules"] = new JArray(new JObject { ["Path"] = pattern, ["AllAuthenticated"] = true }) }));

    [Theory]
    [InlineData("micro-app/test")]
    [InlineData("Micro-App/test")]
    [InlineData("ai-app-source-staged/test")]
    [InlineData("app-store/test")]
    [InlineData("database-backups/test")]
    [InlineData("business/_origin")]
    [InlineData("business/../secret")]
    [InlineData("business/%2e%2e")]
    [InlineData("business/*")]
    [InlineData("business/[ab]")]
    [InlineData("business/{a,b}")]
    [InlineData("business/line?")]
    [InlineData("/")]
    public void BroadGlob_CannotBypassActualPathValidation(string path)
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject { ["Path"] = "**", ["AllAuthenticated"] = true, ["AllowPublic"] = true }));
        Assert.Equal(0, HdfsUploadDirectoryPolicy.Apply(Upload(path), rules, User())!.Code);
    }

    [Fact]
    public void GlobStillRequiresRoleAndPreservesExplicitPrivateAndSubdirectorySwitch()
    {
        var rules = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject
        { ["Path"] = "files/{inspection,quality}*", ["RoleIds"] = new JArray("role-a"), ["IncludeSubdirectories"] = true, ["AllowPublic"] = true }));
        Assert.Null(HdfsUploadDirectoryPolicy.Apply(Upload("files/quality/photo"), rules, User("role-b")));
        var upload = Upload("files/quality/photo", true);
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(upload, rules, User("role-a"))!.Code);
        Assert.True(upload.Limit);
    }

    [Fact]
    public void CompiledPatternCache_DoesNotCachePolicyOrIdentity()
    {
        var allow = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject { ["Path"] = "business/**", ["RoleIds"] = new JArray("role-a") }));
        var revoke = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject { ["Path"] = "business/**", ["RoleIds"] = new JArray("role-b") }));
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(Upload("business/child"), allow, User("role-a"))!.Code);
        Assert.Null(HdfsUploadDirectoryPolicy.Apply(Upload("business/child"), revoke, User("role-a")));
        for (var i = 0; i < 256; i++) HdfsUploadPathPattern.Parse("business" + i + "/**");
        Assert.True(HdfsUploadPathPattern.Parse("business/**").IsMatch(new[] { "business", "child" }, false));
    }

    [Fact]
    public void LongStarNearMiss_IsBoundedWithoutRegexBacktracking()
    {
        var pattern = HdfsUploadPathPattern.Parse("business/" + string.Concat(Enumerable.Repeat("*a", 200)) + "b");
        var watch = System.Diagnostics.Stopwatch.StartNew();
        Assert.False(pattern.IsMatch(new[] { "business", new string('a', 400) + "c" }, false));
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(2));
    }
}
