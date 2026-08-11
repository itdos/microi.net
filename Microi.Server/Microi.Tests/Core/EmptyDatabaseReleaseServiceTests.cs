using System.Reflection;
using Microi.net;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Core;

public sealed class EmptyDatabaseReleaseServiceTests
{
    [Fact]
    public void CollectPackageTableNames_FindsNestedTablesAndRejectsUnsafeNames()
    {
        var package = JToken.Parse("""
        {
          "DDLStatements": [
            { "TableName": "app_order", "DDL": "CREATE TABLE IF NOT EXISTS `app_order_item` (`Id` varchar(36));" }
          ],
          "DiyTables": [
            { "Name": "LegacyBusiness" },
            { "Name": "bad-name;DROP TABLE sys_user" }
          ],
          "ApplicationBundles": [
            { "Infrastructure": { "PhysicalColumns": [ { "TableName": "shared_runtime" } ] } }
          ]
        }
        """);
        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var method = typeof(EmptyDatabaseReleaseService).GetMethod(
            "CollectPackageTableNames",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        method!.Invoke(null, new object[] { package, tables });

        Assert.Equal(
            new[] { "app_order", "app_order_item", "LegacyBusiness", "shared_runtime" },
            tables.OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain(tables, value => value.Contains(';'));
    }

    [Fact]
    public void CollectPackageApiEngineKeys_UsesOwnedDefinitionsAndPoliciesOnly()
    {
        var package = JToken.Parse("""
        {
          "SysApiEngines": [
            { "ApiEngineKey": "mci-ai-content-dispatch" },
            { "ApiEngineKey": "bad key;DROP TABLE sys_user" }
          ],
          "ApplicationBundles": [
            {
              "ResourcePolicies": {
                "ApiEngines": [
                  { "ApiEngineKey": "mci_demo_ai_output_contract_lab", "Policy": "CreateIfMissing" }
                ]
              },
              "References": { "ApiEngineKey": "shared-core-engine" }
            }
          ]
        }
        """);
        var engines = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        InvokePrivateStatic("CollectPackageApiEngineKeys", package, engines);

        Assert.Equal(
            new[] { "mci-ai-content-dispatch", "mci_demo_ai_output_contract_lab" },
            engines.OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain("shared-core-engine", engines);
    }

    [Theory]
    [InlineData("microi-platform-service", "", "", true)]
    [InlineData("app.microi.saas-engine", "Platform", "", true)]
    [InlineData("microi-wechat-content-security", "", "Platform", true)]
    [InlineData("ai-content-operations", "Platform", "Platform", false)]
    [InlineData("mci_demo", "MicroService", "MicroService", false)]
    [InlineData("app.microi.saas-engine", "Web", "Platform", false)]
    public void IsCorePlatformApplication_UsesExactOfficialAllowlist(
        string appKey,
        string applicationType,
        string appType,
        bool expected)
    {
        Assert.Equal(
            expected,
            Assert.IsType<bool>(InvokePrivateStatic(
                "IsCorePlatformApplication",
                appKey,
                applicationType,
                appType)));
    }

    [Theory]
    [InlineData("USE itdos; DELETE FROM sys_log;")]
    [InlineData("DROP DATABASE microi_empty_temp;")]
    [InlineData("DELETE FROM itdos.sys_user;")]
    [InlineData("DELETE FROM `itdos`.sys_user;")]
    public void ValidateSanitizationSql_RejectsDatabaseEscape(string sql)
    {
        var exception = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", sql));

        var inner = Assert.IsType<InvalidOperationException>(exception.InnerException);
        Assert.Contains("只能操作固定目标库", inner.Message);
    }

    [Fact]
    public void ValidateSanitizationSql_IgnoresForbiddenWordsInsideCommentsAndLiterals()
    {
        const string sql = """
            -- USE itdos is documentation only
            /* DROP DATABASE microi_empty_temp; */
            UPDATE sys_config SET Remark='itdos.sys_user is an example';
            """;

        InvokePrivateStatic("ValidateSanitizationSql", sql);
    }

    [Fact]
    public void ValidateSanitizationSql_RejectsEmptyAndOversizedPayloads()
    {
        var emptyException = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", "  "));
        Assert.Contains("内容为空", Assert.IsType<InvalidOperationException>(emptyException.InnerException).Message);

        var oversized = new string('x', 2 * 1024 * 1024 + 1);
        var oversizedException = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", oversized));
        Assert.Contains("超过 2MB", Assert.IsType<InvalidOperationException>(oversizedException.InnerException).Message);
    }

    [Fact]
    public void GetUnconditionallyClearedTables_OnlyReturnsWholeTableDeletes()
    {
        const string sql = """
            -- DELETE FROM ignored_comment;
            TRUNCATE TABLE `mic_data_version`;
            DELETE FROM sys_log;
            DELETE FROM sys_user WHERE Account <> 'admin';
            UPDATE sys_config SET Remark='DELETE FROM ignored_literal;';
            """;

        var result = Assert.IsType<HashSet<string>>(InvokePrivateStatic(
            "GetUnconditionallyClearedTables",
            sql));

        Assert.Equal(
            new[] { "mic_data_version", "sys_log" },
            result.OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain("sys_user", result, StringComparer.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("Succeeded", true)]
    [InlineData("Failed", true)]
    [InlineData("Canceled", true)]
    [InlineData("Running", false)]
    [InlineData("Pending", false)]
    [InlineData("", false)]
    public void IsTerminalBackgroundTaskStatus_OnlyAcceptsFinishedStates(
        string status,
        bool expected)
    {
        Assert.Equal(
            expected,
            Assert.IsType<bool>(InvokePrivateStatic(
                "IsTerminalBackgroundTaskStatus",
                status)));
    }

    [Fact]
    public void ReleaseTargets_AreFixedAndCannotComeFromRuntimeInput()
    {
        Assert.Equal("admin_build_sanitized_empty_database", EmptyDatabaseReleaseService.WorkerApiEngineKey);
        Assert.Equal("iTdos", ReadPrivateConstant("RequiredOsClient"));
        Assert.Equal("itdos", ReadPrivateConstant("RequiredSourceDatabase"));
        Assert.Equal("microi_empty_temp", ReadPrivateConstant("TargetDatabase"));
        Assert.Equal("microi_empty_mysql57.sql", ReadPrivateConstant("SqlFileName"));
        Assert.Equal("/install/", ReadPrivateConstant("PublicObjectDirectory"));
        Assert.Equal("https://static.itdos.com/install/", ReadPrivateConstant("PublicDownloadBaseUrl"));
        Assert.Equal(3, ReadPrivateIntConstant("TableOperationMaxAttempts"));
        Assert.Equal(40, ReadPrivateIntConstant("DatabaseCleanupBatchSize"));
        Assert.Equal(120, ReadPrivateIntConstant("DatabaseCleanupCommandTimeoutSeconds"));
    }

    [Fact]
    public void BundledSanitizationEngine_ProtectsCoreTablesFromApplicationOwnership()
    {
        var loader = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(loader);

        var resources = Assert.IsType<Dictionary<string, string>>(loader!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.saas-engine.json"]);
        var engine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.Value<string>() == "admin_get_empty_database_sanitization_sql");
        var code = engine["ApiV8Code"]?.Value<string>() ?? "";

        Assert.Equal("v1.2.8", engine["Version"]?.Value<string>());
        Assert.Contains("protectedPlatformTableNames", code, StringComparison.Ordinal);
        Assert.Contains("operationalResidueTableNames", code, StringComparison.Ordinal);
        Assert.Contains("cleanupOperationalResidueSql", code, StringComparison.Ordinal);
        Assert.Contains("DELETE l FROM diy_lang l", code, StringComparison.Ordinal);
        Assert.Contains("SUBSTRING_INDEX(COALESCE(l.\\`Key\\`, '')", code, StringComparison.Ordinal);
        Assert.Contains("':', 2)", code, StringComparison.Ordinal);
        Assert.DoesNotContain("LIKE CONCAT('diy_field:', LOWER(x.Name)", code, StringComparison.Ordinal);
        Assert.Contains("PackageDiyTableNamesJson", code, StringComparison.Ordinal);
        Assert.Contains("$.DiyTables[*].Name", code, StringComparison.Ordinal);
        Assert.DoesNotContain("JSON_EXTRACT(AppPakcet, '$**.TableName')", code, StringComparison.Ordinal);
        Assert.DoesNotContain("JSON_EXTRACT(AppPakcet, '$**", code, StringComparison.Ordinal);
        Assert.DoesNotContain("JSON_EXTRACT(AppPakcet, '$.DiyFields", code, StringComparison.Ordinal);
        Assert.DoesNotContain("JSON_EXTRACT(AppPakcet, '$.ApplicationBundles", code, StringComparison.Ordinal);
        Assert.DoesNotContain("JSON_EXTRACT(AppPakcet, '$.DDLStatements", code, StringComparison.Ordinal);
        Assert.Contains("PackageApiEngineKeysJson", code, StringComparison.Ordinal);
        Assert.Contains("PackagePolicyEngineKeysJson", code, StringComparison.Ordinal);
        Assert.Contains("$.SysApiEngines[*].ApiEngineKey", code, StringComparison.Ordinal);
        Assert.Contains("$.ResourcePolicies.ApiEngines[*].ApiEngineKey", code, StringComparison.Ordinal);
        Assert.Contains(
            "AND LOWER(table_name) NOT IN (${protectedPlatformTableNotInSql})",
            code,
            StringComparison.Ordinal);
        foreach (var table in new[]
                 {
                     "sys_microistore",
                     "sys_microistoreversion",
                     "sys_appinstalled",
                     "sys_microiservice",
                     "sys_microiservice_page",
                     "mci_ai_app",
                     "mci_ai_project",
                     "microi_job_triggers"
                 })
        {
            Assert.Contains($"\"{table}\"", code, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void BackendSanitization_ReconcilesFullPackageOwnershipAndReportsResidualNames()
    {
        var reconcile = typeof(EmptyDatabaseReleaseService).GetMethod(
            "ReconcileApplicationOwnedTables",
            BindingFlags.NonPublic | BindingFlags.Static);
        var clearOperationalResidue = typeof(EmptyDatabaseReleaseService).GetMethod(
            "ClearOperationalResidue",
            BindingFlags.NonPublic | BindingFlags.Static);
        var protectedTablesField = typeof(EmptyDatabaseReleaseService).GetField(
            "ProtectedPlatformTableNames",
            BindingFlags.NonPublic | BindingFlags.Static);
        var operationalTablesField = typeof(EmptyDatabaseReleaseService).GetField(
            "EmptyDatabaseOperationalTables",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(reconcile);
        Assert.NotNull(clearOperationalResidue);
        Assert.NotNull(protectedTablesField);
        Assert.NotNull(operationalTablesField);
        var protectedTables = Assert.IsAssignableFrom<ISet<string>>(protectedTablesField!.GetValue(null));
        var operationalTables = Assert.IsType<string[]>(operationalTablesField!.GetValue(null));
        Assert.Contains("sys_microistore", protectedTables);
        Assert.Contains("sys_microiservice", protectedTables);
        foreach (var table in new[]
                 {
                     "mci_background_task", "mci_database_backup", "mci_gitee_star_audit",
                     "mci_identity_credential", "mci_identity_device", "mci_identity_totp",
                     "mci_marketplace_install_event", "mci_tenant_quota_log", "mic_msg_event_log",
                     "microi_job_locks", "wx_mini_program", "wx_tpl_msg", "mic_msgset"
                 })
        {
            Assert.Contains(table, protectedTables);
            Assert.Contains(table, operationalTables);
        }
        Assert.Equal("[app_order,app_order_item]", Assert.IsType<string>(InvokePrivateStatic(
            "FormatNameSample",
            new List<string> { "app_order", "app_order_item" })));
        Assert.Equal("mci_ai_content_plan", Assert.IsType<string>(InvokePrivateStatic(
            "ExtractApplicationLanguageTableName",
            "diy_field:mci_ai_content_plan:name:Label")));
        Assert.Equal("mci_ai_publish_task", Assert.IsType<string>(InvokePrivateStatic(
            "ExtractApplicationLanguageTableName",
            "diy_table:mci_ai_publish_task:tabs:runtime:Name")));
        Assert.Equal("", Assert.IsType<string>(InvokePrivateStatic(
            "ExtractApplicationLanguageTableName",
            "sys_menu:content-operations:Name")));
    }

    [Fact]
    public void BuildDropBatchSql_QuotesEveryDatabaseObjectAndKeepsObjectKind()
    {
        var tableSql = Assert.IsType<string>(InvokePrivateStatic(
            "BuildDropBatchSql",
            "TABLE",
            "microi_empty_temp",
            new[] { "sys_user", "name`with`ticks" }));
        var viewSql = Assert.IsType<string>(InvokePrivateStatic(
            "BuildDropBatchSql",
            "VIEW",
            "microi_empty_temp",
            new[] { "v_summary" }));

        Assert.Equal(
            "DROP TABLE IF EXISTS `microi_empty_temp`.`sys_user`,`microi_empty_temp`.`name``with``ticks`;",
            tableSql);
        Assert.Equal(
            "DROP VIEW IF EXISTS `microi_empty_temp`.`v_summary`;",
            viewSql);
    }

    [Fact]
    public void DescribeExceptionChain_PreservesNestedTransportCause()
    {
        var exception = new InvalidOperationException(
            "Fatal error encountered during command execution",
            new IOException("Unable to read data from the transport connection"));

        var result = Assert.IsType<string>(InvokePrivateStatic("DescribeExceptionChain", exception));

        Assert.Contains("InvalidOperationException: Fatal error encountered during command execution", result);
        Assert.Contains("IOException: Unable to read data from the transport connection", result);
    }

    [Fact]
    public void IsTransientDatabaseFailure_DetectsTransportErrorsOnly()
    {
        var transient = new InvalidOperationException(
            "Fatal error encountered during command execution",
            new IOException("Unable to read data from the transport connection"));
        var validation = new InvalidOperationException("单表原子复制计数不一致");

        Assert.True(Assert.IsType<bool>(InvokePrivateStatic("IsTransientDatabaseFailure", transient)));
        Assert.False(Assert.IsType<bool>(InvokePrivateStatic("IsTransientDatabaseFailure", validation)));
    }

    [Fact]
    public void BuildSourceConnectionStringBuilder_NormalizesLegacySslModeNone()
    {
        var result = InvokePrivateStatic(
            "BuildSourceConnectionStringBuilder",
            "Server=localhost;Database=itdos;User Id=test;Password=test;SslMode=None;");

        var builder = Assert.IsType<MySqlConnectionStringBuilder>(result);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
        Assert.True(builder.AllowUserVariables);
        Assert.Equal("itdos", builder.Database);
    }

    private static object? InvokePrivateStatic(string name, params object[] args)
    {
        var method = typeof(EmptyDatabaseReleaseService).GetMethod(
            name,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, args);
    }

    private static string ReadPrivateConstant(string name)
    {
        var field = typeof(EmptyDatabaseReleaseService).GetField(
            name,
            BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static);
        Assert.NotNull(field);
        return Assert.IsType<string>(field!.GetRawConstantValue());
    }

    private static int ReadPrivateIntConstant(string name)
    {
        var field = typeof(EmptyDatabaseReleaseService).GetField(
            name,
            BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static);
        Assert.NotNull(field);
        return Assert.IsType<int>(field!.GetRawConstantValue());
    }
}
