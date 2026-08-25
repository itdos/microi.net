using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class PlatformOsClientDomainResolutionTests
{
    [Fact]
    public void LazyTenant_UsesMainDatabaseFallbackWhenNotLoadedInMemory()
    {
        var databaseCalled = false;
        var candidates = V8Method.ResolveOsClientCandidates(
            "lazy.example.com",
            Array.Empty<OsClientSecret>(),
            normalizedDomain =>
            {
                databaseCalled = true;
                Assert.Equal("lazy.example.com", normalizedDomain);
                return new[] { "lazy-tenant" };
            });

        Assert.True(databaseCalled);
        Assert.Equal(new[] { "lazy-tenant" }, candidates);
    }

    [Fact]
    public void LoadedTenantDomainMatch_UnionsMainDatabaseAndFailsClosedOnConflict()
    {
        var loaded = new OsClientSecret
        {
            OsClient = "loaded-tenant",
            OsClientModel = new JObject
            {
                ["DomainName"] = "https://loaded.example.com;other.example.com"
            }
        };
        var databaseCalls = 0;

        var sameTenant = V8Method.ResolveOsClientCandidates(
            "loaded.example.com",
            new[] { loaded },
            _ =>
            {
                databaseCalls++;
                return new[] { "LOADED-TENANT" };
            });
        Assert.Equal(new[] { "loaded-tenant" }, sameTenant);
        Assert.Equal(1, databaseCalls);

        var conflict = V8Method.ResolveOsClientCandidates(
            "loaded.example.com",
            new[] { loaded },
            _ =>
            {
                databaseCalls++;
                return new[] { "lazy-tenant-b" };
            });
        Assert.Equal(2, conflict.Count);
        Assert.Contains("loaded-tenant", conflict, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("lazy-tenant-b", conflict, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(2, databaseCalls);

        var lookalike = V8Method.ResolveOsClientCandidates(
            "loaded.example.com.evil",
            new[] { loaded },
            _ =>
            {
                databaseCalls++;
                return Array.Empty<string>();
            });
        Assert.Empty(lookalike);
        Assert.Equal(3, databaseCalls);
    }

    [Fact]
    public void MainDatabaseUnavailable_FallsBackToLoadedTenantCandidate()
    {
        var loaded = new OsClientSecret
        {
            OsClient = "loaded-tenant",
            OsClientModel = new JObject
            {
                ["DomainName"] = "loaded.example.com"
            }
        };

        var candidates = V8Method.ResolveOsClientCandidates(
            "loaded.example.com",
            new[] { loaded },
            _ => throw new InvalidOperationException("database unavailable"));

        Assert.Equal(new[] { "loaded-tenant" }, candidates);
    }

    [Fact]
    public void MainDatabaseLookupSql_SelectsOnlyOsClientAndRequiresEnabledExactTokens()
    {
        var variants = V8Method.ExactDomainStorageVariants("https://LAZY.example.com/path");
        Assert.Contains("lazy.example.com", variants);
        Assert.Contains("https://lazy.example.com", variants);
        Assert.DoesNotContain(variants, value => value.Contains("/path", StringComparison.Ordinal));

        var sql = V8Method.BuildExactDomainLookupSql(variants.Count);
        var projection = sql.Substring(0, sql.IndexOf(" FROM ", StringComparison.Ordinal));
        Assert.Equal("SELECT OsClient", projection);
        Assert.Contains("FROM sys_osclients", sql, StringComparison.Ordinal);
        Assert.Contains("IsEnable = @domainEnabled", sql, StringComparison.Ordinal);
        Assert.Contains("COALESCE(IsDeleted, 0) = 0", sql, StringComparison.Ordinal);
        Assert.Contains("= @domainExact0", sql, StringComparison.Ordinal);
        Assert.Contains("LIKE @domainStart0", sql, StringComparison.Ordinal);
        Assert.Contains("LIKE @domainMiddle0", sql, StringComparison.Ordinal);
        Assert.Contains("LIKE @domainEnd0", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("lazy.example.com", sql, StringComparison.OrdinalIgnoreCase);
    }
}
