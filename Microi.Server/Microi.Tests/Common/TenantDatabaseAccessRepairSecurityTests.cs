namespace Dos.Common.Tests;

public sealed class TenantDatabaseAccessRepairSecurityTests
{
    [Fact]
    public void RepairAtom_PreservesDatabaseAndKeepsCredentialsInsideTrustedBoundary()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "Runtime",
            "TenantProvisioningService.cs"));
        var block = ExtractBlock(
            source,
            "public DosResult RepairAdminTenantDatabaseAccess(",
            "private static string ReadConnectionStringValue(");

        Assert.Contains("BuildTenantRotationPrincipalName", block, StringComparison.Ordinal);
        Assert.Contains("object row = mainClient.Db.FromSql", block, StringComparison.Ordinal);
        Assert.Contains("JObject rowData = JObject.FromObject(row)", block, StringComparison.Ordinal);
        Assert.Contains("object durableReadback = mainClient.Db.FromSql", block, StringComparison.Ordinal);
        Assert.Contains("JObject durableData = durableReadback == null", block, StringComparison.Ordinal);
        Assert.Contains("CreateSql", block, StringComparison.Ordinal);
        Assert.Contains("GrantSql", block, StringComparison.Ordinal);
        Assert.Contains("DropSql", block, StringComparison.Ordinal);
        Assert.Contains("BuildScopedConnectionString", block, StringComparison.Ordinal);
        Assert.Contains("SELECT DATABASE()", block, StringComparison.Ordinal);
        Assert.Contains("'sys_config', 'sys_user'", block, StringComparison.Ordinal);
        Assert.Contains("SELECT CURRENT_USER()", block, StringComparison.Ordinal);
        Assert.Contains("AND DbConn = @OldDbConn", block, StringComparison.Ordinal);
        Assert.Contains("COALESCE(DbReadConn, '') = @OldDbReadConn", block, StringComparison.Ordinal);
        Assert.Contains("AddSensitiveInParameter(\"NewDbConn\"", block, StringComparison.Ordinal);
        Assert.Contains("AddSensitiveInParameter(\"OldDbConn\"", block, StringComparison.Ordinal);
        Assert.Contains("AddSensitiveInParameter(\"OldDbReadConn\"", block, StringComparison.Ordinal);
        Assert.Contains("InvalidateSaasConfigurationCache(tenantKey)", block, StringComparison.Ordinal);
        Assert.Contains("ReloadSingleOsClient(tenantKey)", block, StringComparison.Ordinal);
        Assert.Contains("runtimeClient?.DbRead?.FromSql(\"SELECT DATABASE()\")", block, StringComparison.Ordinal);
        Assert.Contains("\"admin:\" + tenantKey.ToLowerInvariant()", block, StringComparison.Ordinal);
        Assert.Contains("ExpectedStaleReadDatabaseName", block, StringComparison.Ordinal);
        Assert.Contains("parsedReadDatabaseName", block, StringComparison.Ordinal);
        Assert.Contains("expectedStaleReadDatabaseName", block, StringComparison.Ordinal);
        Assert.Contains("StaleReadConnectionReplaced", block, StringComparison.Ordinal);
        Assert.Contains("禁止自动覆盖真实读副本", block, StringComparison.Ordinal);
        Assert.DoesNotContain("DropDatabase(", block, StringComparison.Ordinal);
        Assert.DoesNotContain("ImportEmptySql(", block, StringComparison.Ordinal);
        Assert.DoesNotContain("CreateTenantDatabaseAccess(", block, StringComparison.Ordinal);
        Assert.DoesNotContain("ConnectionFingerprint", block, StringComparison.Ordinal);
    }

    [Fact]
    public void RepairFacade_IsBoundToExactManagedEngineAndCurrentPlatformAdministrator()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "V8Engine", "Runtime",
            "V8Method.cs"));
        var block = ExtractBlock(
            source,
            "public DosResult RepairAdminTenantDatabaseAccess(object param)",
            "public bool SupportsDistributedTenantProvisioningLease()");

        Assert.Contains(
            "admin_repair_saas_tenant_database_access",
            block,
            StringComparison.Ordinal);
        Assert.Contains("ResolveTrustedManagedCurrentUser(", block, StringComparison.Ordinal);
        Assert.Contains("true,", block, StringComparison.Ordinal);
        Assert.Contains("DiyCommon.MaxRoleLevel", block, StringComparison.Ordinal);
        Assert.Contains(
            "PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(",
            block,
            StringComparison.Ordinal);
        Assert.Contains("OsClientDefault.OsClient", block, StringComparison.Ordinal);
    }

    private static string ExtractBlock(string source, string startMarker, string endMarker)
    {
        var start = source.IndexOf(startMarker, StringComparison.Ordinal);
        var end = source.IndexOf(endMarker, start + startMarker.Length, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Missing marker: {startMarker}");
        Assert.True(end > start, $"Missing marker: {endMarker}");
        return source.Substring(start, end - start);
    }

    private static string FindRepositoryRoot(
        [System.Runtime.CompilerServices.CallerFilePath] string sourceFilePath = "")
    {
        if (!string.IsNullOrWhiteSpace(sourceFilePath))
        {
            var sourceDirectoryRoot = FindRepositoryRootFrom(
                new DirectoryInfo(Path.GetDirectoryName(sourceFilePath)!));
            if (sourceDirectoryRoot != null) return sourceDirectoryRoot;
        }

        var currentDirectoryRoot = FindRepositoryRootFrom(
            new DirectoryInfo(Directory.GetCurrentDirectory()));
        if (currentDirectoryRoot != null) return currentDirectoryRoot;

        var appBaseRoot = FindRepositoryRootFrom(new DirectoryInfo(AppContext.BaseDirectory));
        if (appBaseRoot != null) return appBaseRoot;
        throw new DirectoryNotFoundException("Repository root was not found.");
    }

    private static string? FindRepositoryRootFrom(DirectoryInfo? directory)
    {
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Server", "Microi.net.sln")))
                return directory.FullName;
            if (File.Exists(Path.Combine(directory.FullName, "Microi.net.sln"))
                && Directory.Exists(Path.Combine(directory.FullName, "Microi.Core")))
                return directory.Parent?.FullName ?? directory.FullName;
            directory = directory.Parent;
        }
        return null;
    }
}
