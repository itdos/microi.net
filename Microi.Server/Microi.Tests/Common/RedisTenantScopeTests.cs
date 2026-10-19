using Microi.Cache;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class RedisTenantScopeTests
{
    [Fact]
    public async Task ManagerRejectsNoOpForeignRenameBeforeConnectionLookup()
    {
        var original = Environment.GetEnvironmentVariable("OsClient");
        try
        {
            Environment.SetEnvironmentVariable("OsClient", "redis-main");
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new MicroiRedisManager().RenameKeyAsync(
                "redis-child", new RedisManagerRenameRequest { Key = "Microi:redis-main:probe", NewKey = "Microi:redis-main:probe" }));
        }
        finally { Environment.SetEnvironmentVariable("OsClient", original); }
    }

    [Theory]
    [InlineData("Key")]
    [InlineData("ReplaceValue")]
    [InlineData("DeleteKeys")]
    [InlineData("RenameKey")]
    [InlineData("SetTtl")]
    [InlineData("Invalidate")]
    [InlineData("InvalidatePattern")]
    [InlineData("Keys")]
    [InlineData("Statistics")]
    public async Task EveryManagementEntryRejectsCrossTenantInputBeforeAnyConnection(string action)
    {
        var original = Environment.GetEnvironmentVariable("OsClient");
        try
        {
            Environment.SetEnvironmentVariable("OsClient", "redis-main");
            var request = new Newtonsoft.Json.Linq.JObject
            {
                ["Key"] = "Microi:redis-main:probe", ["NewKey"] = "Microi:redis-child:renamed",
                ["Pattern"] = "Microi:redis-main:*", ["DataType"] = "string", ["Value"] = "unchanged",
                ["Keys"] = new Newtonsoft.Json.Linq.JArray("Microi:redis-child:own", "Microi:redis-main:probe"),
                // 客户端伪造的主租户/管理员标记不能参与授权。
                ["OsClient"] = "redis-main", ["IsMainTenant"] = true, ["Level"] = 9999,
                ["TtlSeconds"] = 0
            };
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new MicroiRedisManager().ExecuteAsync("redis-child", action, request));
        }
        finally { Environment.SetEnvironmentVariable("OsClient", original); }
    }

    [Theory]
    [InlineData("Microi:iTdos:Session:probe")]
    [InlineData("Microi:child2:probe")]
    [InlineData("Microi:child-extra:probe")]
    [InlineData("Microi:child")]
    [InlineData("Microi:child:")]
    [InlineData("legacy-unscoped")]
    [InlineData(" Microi:child:probe")]
    public void ChildRejectsForeignOrUnscopedExactKeys(string key) =>
        Assert.Throws<UnauthorizedAccessException>(() => new RedisTenantScope("child", "iTdos").RequireKey(key));

    [Theory]
    [InlineData("Microi:child:probe")]
    [InlineData("microi:CHILD:probe")]
    [InlineData("Microi:child:*literal-key")]
    public void ExactOwnKeysRemainUsableWithoutRewritingTheirBytes(string key) =>
        new RedisTenantScope("child", "iTdos").RequireKey(key);

    [Fact]
    public void OnlyServerConfiguredMainTenantCanManageEveryNamespaceAndDatabase()
    {
        var main = new RedisTenantScope("MAIN", "main");
        main.RequireKey("Microi:any-tenant:probe");
        main.RequireKey("legacy-unscoped");
        Assert.Equal(9, main.Database(9, 4));
        Assert.Equal("*", main.Pattern("*", true));
        Assert.False(new RedisTenantScope("iTdos", "another-main").IsMainTenant);
    }

    [Fact]
    public void MissingOrMalformedIdentityNeverGrantsMainTenantAccess()
    {
        foreach (var invalid in new[] { "", "*", "child:*", "child[ab]", "child\\" })
        {
            Assert.Throws<ArgumentException>(() => new RedisTenantScope(invalid, "main"));
            Assert.Throws<ArgumentException>(() => new RedisTenantScope("child", invalid));
        }
    }

    [Fact]
    public void ChildCannotSelectOtherDatabaseAndNullUsesConfiguredDatabase()
    {
        var child = new RedisTenantScope("child", "main");
        Assert.Equal(4, child.Database(null, 4));
        Assert.Equal(4, child.Database(4, 4));
        Assert.Throws<UnauthorizedAccessException>(() => child.Database(0, 4));
    }

    [Theory]
    [InlineData("*", "*")]
    [InlineData("probe", "*probe*")]
    [InlineData("Microi:child:probe", "*probe*")]
    [InlineData("microi:CHILD:probe*", "probe*")]
    [InlineData("[Mm]icroi:*", "[Mm]icroi:*")]
    [InlineData("\\*", "\\*")]
    public void UserGlobCannotReplaceFixedTenantPrefix(string input, string suffix)
    {
        Assert.Equal("[mM][iI][cC][rR][oO][iI]:[cC][hH][iI][lL][dD]:" + suffix,
            new RedisTenantScope("child", "main").Pattern(input, true));
    }

    [Fact]
    public void ForeignExplicitPatternIsRejectedAndInvalidationDoesNotBecomeContainsSearch()
    {
        var child = new RedisTenantScope("child", "main");
        Assert.Throws<UnauthorizedAccessException>(() => child.Pattern("Microi:main:*", true));
        Assert.Throws<UnauthorizedAccessException>(() => child.Pattern("Microi:child*:probe", false));
        Assert.EndsWith(":prefix", child.Pattern("Microi:child:prefix", false));
    }
}
