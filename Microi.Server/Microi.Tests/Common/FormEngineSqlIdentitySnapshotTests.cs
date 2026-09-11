using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using Dos.Common;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

/// <summary>
/// 从真实六个原生查询入口提取调用并执行真实占位符代码；不以正则接线代替行为测试。
/// TEST_FORM_SQL_IDENTITY_SOURCE 可指向修复前原文件，给同一测试提供可重复红灯。
/// </summary>
public sealed class FormEngineSqlIdentitySnapshotTests
{
    private static readonly string[] Files = { "FormEngineGet.cs", "FormEngineGetTableData.cs", "FormEngineTable.cs" };
    private static readonly Lazy<Probe> Production = new(BuildProbe);

    [Theory]
    [InlineData(0)] // 详情兼容查询范围
    [InlineData(1)] // 详情关联配置
    [InlineData(2)] // List / Count / SUM / Tree / Export 共用 WHERE
    [InlineData(3)] // List 共用 JOIN
    [InlineData(4)] // 单字段选择器
    [InlineData(5)] // 批量字段选择器
    public async Task NativeQueryUsesEffectiveIdentityInsteadOfOldToken(int entry)
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        const string sql = "SELECT * FROM data A WHERE A.RoleId IN ($CurrentUser.RoleIds$) "
            + "AND A.UserId='$CurrentUser.Id$' AND $CurrentUser.Level$>=9999 AND A.DeptId='$CurrentUser.DeptId$'";
        var scenarios = new[] {
            (Name: "旧Token撤角但保留同表菜单", Roles: new[] { "role-sales" }, Level: 10),
            (Name: "角色已删除但保留另一有效角色", Roles: new[] { "role-reader" }, Level: 3),
            (Name: "管理员降级但仍有菜单", Roles: new[] { "role-finance" }, Level: 20),
            (Name: "全部角色撤销", Roles: Array.Empty<string>(), Level: 0)
        };
        foreach (var scenario in scenarios)
        foreach (var objectRoleIds in new[] { false, true })
        {
            var user = OldSession(objectRoleIds);
            var before = user.ToString(Formatting.None);
            var snapshot = Snapshot(scenario.Roles, scenario.Level);
            var param = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = user };
            Production.Value.Bind(param, snapshot);
            var actual = await Production.Value.Run(entry, sql, param);
            var roles = scenario.Roles.Length == 0 ? "(NULL)" : "(" + string.Join(",", scenario.Roles.Select(r => "'" + r + "'")) + ")";
            var expected = "SELECT * FROM data A WHERE A.RoleId IN " + roles
                + " AND A.UserId='user-1' AND " + scenario.Level + ">=9999 AND A.DeptId='dept-compat'";
            Assert.True(actual == expected, scenario.Name + ": " + actual);
            Assert.Equal(before, user.ToString(Formatting.None));
            Assert.Same(user, param._CurrentUser);
            Assert.Equal(scenario.Roles, snapshot.EffectiveRoleIds);
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public async Task ForeignParentOrInactiveSnapshotCannotBindSql(int entry)
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        foreach (var mismatch in new[] { "parent", "disabled", "missing-id" })
        {
            var snapshot = Snapshot(new[] { "role-finance" }, 9999);
            var user = OldSession(false);
            var before = user.ToString(Formatting.None);
            var param = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = user };
            Production.Value.Bind(param, snapshot);
            if (mismatch == "parent") snapshot.UserId = "other-parent-user";
            if (mismatch == "disabled") snapshot.IsActiveUser = false;
            if (mismatch == "missing-id") snapshot.UserId = "";
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Production.Value.Run(entry,
                "SELECT $CurrentUser.Level$ WHERE Id='$CurrentUser.Id$'", param));
            Assert.Equal(before, user.ToString(Formatting.None));
        }
    }

    [Fact]
    public async Task ProjectionPreservesExtensionsWithoutSharingMutableChildren()
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        var user = OldSession(false);
        user["level"] = 9999;
        user["roleids"] = new JArray("role-foreign");
        user["Extra"] = new JObject { ["Label"] = "original" };
        var before = user.ToString(Formatting.None);
        var snapshot = Snapshot(new[] { "role-reader" }, 2);
        var projected = Production.Value.Project(user, snapshot);
        Assert.NotSame(user, projected);
        Assert.Single(projected.Properties().Where(p => p.Name.Equals("Level", StringComparison.OrdinalIgnoreCase)));
        Assert.Single(projected.Properties().Where(p => p.Name.Equals("RoleIds", StringComparison.OrdinalIgnoreCase)));
        Assert.Equal("dept-compat", projected["DeptId"]!.Value<string>());
        projected["Extra"]!["Label"] = "changed";
        Assert.Equal(before, user.ToString(Formatting.None));

        var quoted = Snapshot(new[] { "role'o" }, 2);
        var quoteParam = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = user };
        Production.Value.Bind(quoteParam, quoted);
        var sql = await Production.Value.Run(2,
            "SELECT 1 WHERE RoleId IN $CurrentUser.RoleIds$ AND NOT 0=$CurrentUser.Level$",
            quoteParam);
        Assert.Equal("SELECT 1 WHERE RoleId IN ('role''o') AND NOT 0=2", sql);
    }

    [Fact]
    public async Task AnonymousIdentityAndSqlWithoutPlaceholdersDoNotLoadOrUseSessionRoles()
    {
        var param = new DiyTableRowParam { _CurrentUser = OldSession(false), _IsAnonymous = true };
        Assert.Equal("SELECT NULL WHERE RoleId IN (NULL)", await Production.Value.Run(2,
            "SELECT $CurrentUser.Level$ WHERE RoleId IN ($CurrentUser.RoleIds$)", param));
        param._IsAnonymous = false;
        Assert.Equal("SELECT 1", await Production.Value.Run(2, "SELECT 1", param));
        Assert.Null(param._AuthorizationSnapshot);
    }

    [Fact]
    public void RequestJsonCannotSupplyAuthorizationSnapshotOrTrustedInvocation()
    {
        // CurrentUser 的 HTTP 登录覆盖仍归既有 Controller；这里验证请求无法构造 CLR 可信快照。
        var param = JsonConvert.DeserializeObject<DiyTableRowParam>("""
            {"_CurrentUser":{"Id":"forged-user","Level":9999,"RoleIds":["forged-role"]},
             "_AuthorizationSnapshot":{"UserId":"forged-user","UserLevel":9999,"IsActiveUser":true,"EffectiveRoleIds":["forged-role"]},
             "_TrustedServerInvocation":true,"_PreserveAuthorizationPolicyForRead":true}
            """)!;
        Assert.Null(param._AuthorizationSnapshot);
        Assert.False(param._TrustedServerInvocation);
        Assert.False(param._PreserveAuthorizationPolicyForRead);
        Assert.Throws<UnauthorizedAccessException>(() => Production.Value.Project(param._CurrentUser, null));
    }

    [Theory]
    [InlineData("copied-param")]
    [InlineData("replaced-snapshot")]
    [InlineData("other-tenant-same-id")]
    public async Task UnboundSnapshotIsDiscardedAndReloadedForActualTenant(string variant)
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        var original = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = OldSession(false) };
        Production.Value.Bind(original, Snapshot(new[] { "role-old" }, 9999));
        var param = original;
        if (variant == "copied-param") param = new DiyTableRowParam {
            OsClient = original.OsClient, _CurrentUser = original._CurrentUser, _AuthorizationSnapshot = original._AuthorizationSnapshot
        };
        if (variant == "replaced-snapshot") param._AuthorizationSnapshot = Snapshot(new[] { "role-forged" }, 9999);
        if (variant == "other-tenant-same-id") param.OsClient = "tenant-b";
        using var otherScope = variant == "other-tenant-same-id" ? V8TenantContext.Enter("tenant-b", "sql-identity-tests") : null;
        Production.Value.SetAuthoritative(Snapshot(new[] { "role-current" }, 5));
        var actual = await Production.Value.Run(2, "SELECT $CurrentUser.Level$ WHERE RoleId IN ($CurrentUser.RoleIds$)", param);
        Assert.Equal("SELECT 5 WHERE RoleId IN ('role-current')", actual);
        Assert.Equal(param.OsClient, Production.Value.LoadedTenant);
        Assert.True(Production.Value.LoadedFreshParameter);
        Assert.NotSame(original._CurrentUser, Production.Value.Project(param._CurrentUser, param._AuthorizationSnapshot));
    }

    [Fact]
    public async Task FreshAuthoritativeLoadStillRejectsDisabledUser()
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        var snapshot = Snapshot(new[] { "role-current" }, 0);
        snapshot.IsActiveUser = false;
        Production.Value.SetAuthoritative(snapshot);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Production.Value.Run(2,
            "SELECT $CurrentUser.Level$", new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = OldSession(false) }));
    }

    [Fact]
    public async Task AccessKeyKeepsItsScopeAndUsesTheActiveOwnersEffectiveRoles()
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        // 使用生产访问密钥投影与表范围判断，密钥身份始终是它绑定的真实账号。
        var scoped = UserAccessKeyService.ApplyRuntimeScope(OldSession(false), AccessKeyRuntime());
        Assert.Equal(1, scoped.Code);
        Assert.True(UserAccessKeySecurity.IsSession(scoped.Data));
        Assert.True(UserAccessKeySecurity.IsTableOperationAllowed(scoped.Data, "allowed-table", true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(scoped.Data, "another-table", true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(scoped.Data, "allowed-table", false));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(scoped.Data, "allowed-table", true, true));
        var original = scoped.Data.ToString(Formatting.None);
        var snapshot = Snapshot(new[] { "role-owner-current" }, 4);
        var param = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = scoped.Data };
        Production.Value.Bind(param, snapshot);
        Assert.Equal("SELECT 4 WHERE RoleId IN ('role-owner-current')", await Production.Value.Run(2,
            "SELECT $CurrentUser.Level$ WHERE RoleId IN ($CurrentUser.RoleIds$)", param));
        var projected = Production.Value.Project(scoped.Data, snapshot);
        Assert.True(UserAccessKeySecurity.IsSession(projected));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(projected, "another-table", true));
        Assert.Equal(original, scoped.Data.ToString(Formatting.None));
    }

    [Fact]
    public async Task AccessKeyCannotManufactureRoleIdentityWhenItsOwnerIsGone()
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        var scoped = UserAccessKeyService.ApplyRuntimeScope(OldSession(false), AccessKeyRuntime());
        Assert.Equal(1, scoped.Code);
        var missingOwner = Snapshot(Array.Empty<string>(), 0);
        missingOwner.IsActiveUser = false;
        Production.Value.SetAuthoritative(missingOwner);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Production.Value.Run(2,
            "SELECT $CurrentUser.Level$ WHERE RoleId IN ($CurrentUser.RoleIds$)",
            new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = scoped.Data }));
    }

    private static UserAccessKeyRuntime AccessKeyRuntime() => new() {
        Id = "key-1", TargetUserId = "user-1", State = 1, Scopes = "[\"form:read\"]",
        AllowedTableNames = "[\"allowed-table\"]", AllowedRoutes = "[\"*\"]"
    };

    [Fact]
    public async Task ReusingTheSameParameterInANewInvocationReloadsAuthorization()
    {
        var param = new DiyTableRowParam { OsClient = "tenant-a", _CurrentUser = OldSession(false) };
        using (V8TenantContext.Enter("tenant-a", "first-invocation"))
            Production.Value.Bind(param, Snapshot(new[] { "role-old" }, 9999));
        using (V8TenantContext.Enter("tenant-a", "next-invocation"))
        {
            Production.Value.SetAuthoritative(Snapshot(new[] { "role-new" }, 1));
            Assert.Equal("SELECT 1 WHERE RoleId IN ('role-new')", await Production.Value.Run(2,
                "SELECT $CurrentUser.Level$ WHERE RoleId IN ($CurrentUser.RoleIds$)", param));
            Assert.True(Production.Value.LoadedFreshParameter);
        }
    }

    [Fact]
    public async Task ForeignTenantCannotBeChosenInsideAnUnprivilegedV8Invocation()
    {
        using var scope = V8TenantContext.Enter("tenant-a", "sql-identity-tests");
        var param = new DiyTableRowParam { OsClient = "tenant-b", _CurrentUser = OldSession(false) };
        Production.Value.Bind(param, Snapshot(new[] { "role-forged" }, 9999));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Production.Value.Run(2,
            "SELECT $CurrentUser.Level$", param));
    }

    private static JObject OldSession(bool objects) => new() {
        ["Id"] = "user-1", ["Level"] = 9999, ["DeptId"] = "dept-compat", ["Name"] = "旧会话姓名",
        ["RoleIds"] = objects ? "[{\"Id\":\"role-finance\",\"Name\":\"已撤销角色\"},{\"Id\":\"role-sales\"}]"
            : "[\"role-finance\",\"role-sales\"]"
    };
    private static FormEngineAuthorizationSnapshot Snapshot(string[] roles, int level) => new() {
        UserId = "user-1", IsActiveUser = true, UserLevel = level, EffectiveRoleIds = roles.ToList(),
        Menus = new() { new() { Id = "still-authorized-menu", DiyTableId = "table-1" } }
    };

    private sealed class Probe(Type type)
    {
        public void Bind(DiyTableRowParam param, FormEngineAuthorizationSnapshot snapshot)
        {
            var method = type.GetMethod("BindAuthorizationSnapshot", BindingFlags.NonPublic | BindingFlags.Static);
            if (method is null) param._AuthorizationSnapshot = snapshot;
            else method.Invoke(null, new object[] { param, snapshot });
        }
        public void SetAuthoritative(FormEngineAuthorizationSnapshot snapshot) => type.GetField("Authoritative")!.SetValue(null, snapshot);
        public string? LoadedTenant => (string?)type.GetField("LoadedTenant")!.GetValue(null);
        public bool LoadedFreshParameter => (bool)type.GetField("LoadedFreshParameter")!.GetValue(null)!;
        public async Task<string> Run(int entry, string sql, DiyTableRowParam param)
        {
            var instance = Activator.CreateInstance(type)!;
            return await (Task<string>)type.GetMethod("Run" + entry)!.Invoke(instance, new object[] { sql, param })!;
        }
        public JObject Project(JObject user, FormEngineAuthorizationSnapshot? snapshot)
        {
            var method = type.GetMethod("CreateAuthorizedSqlUser", BindingFlags.NonPublic | BindingFlags.Static);
            // 修复前仍让行为断言看见实际旧投影，而不是以“缺少新方法”充当安全红灯。
            if (method is null) return user;
            try { return (JObject)method.Invoke(null, new object?[] { user, snapshot })!; }
            catch (TargetInvocationException ex) when (ex.InnerException is not null) {
                System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(ex.InnerException).Throw();
                throw;
            }
        }
    }

    private static Probe BuildProbe()
    {
        var directory = Environment.GetEnvironmentVariable("TEST_FORM_SQL_IDENTITY_SOURCE")
            ?? Path.Combine(FindRoot(), "Microi.Server", "Microi.net", "FormEngine");
        var trees = Files.Select(file => CSharpSyntaxTree.ParseText(File.ReadAllText(Path.Combine(directory, file)),
            cancellationToken: TestContext.Current.CancellationToken).GetRoot()).ToArray();
        var names = new HashSet<string> { "BuildCurrentUserSqlList", "ReplaceCurrentUserSqlLists",
            "ReplaceCurrentUser", "ReplaceAuthorizedCurrentUserAsync", "CreateAuthorizedSqlUser",
            "BindAuthorizationSnapshot", "IsAuthorizationSnapshotBound", "GetAuthorizationSnapshotScope" };
        var fields = new HashSet<string> { "NeedReplaceType", "CurrentUserParenthesizedListRegex", "CurrentUserBareListRegex", "SqlIdentityBindings" };
        var source = new StringBuilder("using System; using System.Linq; using System.Collections.Generic; using System.Threading.Tasks; using System.Text.RegularExpressions; using Dos.Common; using Microi.net; using Newtonsoft.Json; using Newtonsoft.Json.Linq; public class SqlIdentityProductionProbe {");
        foreach (var member in trees[2].DescendantNodes().OfType<MemberDeclarationSyntax>())
        {
            if (member is ClassDeclarationSyntax c && c.Identifier.Text == "SqlIdentityBinding") source.AppendLine(c.ToFullString());
            if (member is FieldDeclarationSyntax f && f.Declaration.Variables.Any(v => fields.Contains(v.Identifier.Text)))
                source.AppendLine(f.ToFullString());
            if (member is MethodDeclarationSyntax m && names.Contains(m.Identifier.Text)
                && !(m.Identifier.Text == "ReplaceCurrentUser" && m.ParameterList.Parameters.Count != 2))
                source.AppendLine(m.ToFullString());
        }
        // 只替换数据库 I/O 为明确的权威夹具；新参数/租户/快照来源绑定仍执行生产方法。
        // 此层不声称验证真实数据库、Redis或Controller；真实HTTP由专项环境另行验收。
        source.AppendLine("public static FormEngineAuthorizationSnapshot Authoritative; public static string LoadedTenant; public static bool LoadedFreshParameter; private sealed class ProbeClient { public object Db = new object(); } private static class OsClient { public static ProbeClient GetClient(string tenant) { LoadedTenant=tenant; return new ProbeClient(); } } private Task<FormEngineAuthorizationSnapshot> GetAuthorizationSnapshotAsync(DiyTableRowParam p, IReadOnlyCollection<string> r, object db) { LoadedFreshParameter=p._AuthorizationSnapshot==null; return Task.FromResult(Authoritative); } private List<string> ParseRoleIds(JObject u) => new List<string>();");
        var entry = 0;
        foreach (var tree in trees)
        {
            var invocations = tree.DescendantNodes().OfType<InvocationExpressionSyntax>().Where(i =>
                i.Expression is IdentifierNameSyntax n && (n.Identifier.Text == "ReplaceCurrentUser" || n.Identifier.Text == "ReplaceAuthorizedCurrentUserAsync")
                && i.ArgumentList.Arguments.Count == 2
                && new[] { "param", "param._CurrentUser" }.Contains(i.ArgumentList.Arguments[1].ToString())).ToArray();
            Assert.Equal(2, invocations.Length);
            foreach (var invocation in invocations)
            {
                var call = invocation.Parent is AwaitExpressionSyntax a ? a.ToString() : invocation.ToString();
                source.AppendLine($"public async Task<string> Run{entry++}(string sql, DiyTableRowParam param) {{ string sqlWhere=sql, sqlJoin=sql, authorizationSqlWhere=sql, authorizationSqlJoin=sql; return {call}; }}");
            }
        }
        source.AppendLine("}");
        var paths = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(DynamicHelper).Assembly.Location, typeof(DiyCommon).Assembly.Location,
                typeof(DiyTableRowParam).Assembly.Location, typeof(Dos.ORM.DbSession).Assembly.Location, typeof(JObject).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase);
        var compilation = CSharpCompilation.Create("SqlIdentityProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source.ToString(), cancellationToken: TestContext.Current.CancellationToken) },
            paths.Select(p => MetadataReference.CreateFromFile(p)), new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var pe = new MemoryStream();
        var result = compilation.Emit(pe, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(result.Success, string.Join(Environment.NewLine, result.Diagnostics));
        pe.Position = 0;
        var context = new AssemblyLoadContext("SqlIdentityProductionProbe", isCollectible: true);
        return new Probe(context.LoadFromStream(pe).GetType("SqlIdentityProductionProbe")!);
    }

    private static string FindRoot()
    {
        for (var at = new DirectoryInfo(AppContext.BaseDirectory); at is not null; at = at.Parent)
            if (Directory.Exists(Path.Combine(at.FullName, "Microi.Server"))) return at.FullName;
        throw new DirectoryNotFoundException("未找到 Microi.Server 工作区");
    }
}
