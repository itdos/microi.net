using System.Reflection;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApplicationStreamSchemaUpgradeTests
{
    [Fact]
    public void Upgrade25_ExposesTheAuditedV3PhysicalContract()
    {
        Assert.Equal("6.9.7.1", Upgrade25.Version);

        Assert.Equal(new[]
        {
            "PublishProtocolVersion", "PublishState", "PublishFence", "PublishRowVersion",
            "ActivePublishVersionId", "CommittedPublishVersionId", "CommittedRuntimeManifestHash"
        }, FieldNames("sys_microistore"));
        Assert.Equal(new[]
        {
            "PublishProtocolVersion", "PublishState", "RequestId", "DeliveryBatchId",
            "RequestFingerprint", "SourceManifestHash", "RuntimeManifestHash",
            "ExpectedCurrentVersion", "ExpectedAppVersion", "EntryPath", "ReleasePrefix",
            "AssetManifestJson", "FencingToken", "RowVersion", "PointerCommittedAt",
            "CompletedAt", "LastError", "RecoveryEpoch", "RouteSnapshotJson", "RouteSnapshotHash"
        }, FieldNames("mci_ai_app_version"));
        Assert.Equal(new[] { "FilePathHash" }, FieldNames("mci_ai_app_file"));
        Assert.Equal(new[]
        {
            "ApplicationStreamPublishMode", "ApplicationStreamMinProtocol", "ApplicationStreamGateEpoch"
        }, FieldNames("sys_osclients"));
        Assert.Equal(new[]
        {
            "Id", "TransitionId", "OsClient", "OsClientType", "OsClientNetwork",
            "ExpectedMode", "ExpectedMinProtocol", "ExpectedGateEpoch", "TargetMode",
            "TargetMinProtocol", "ResultGateEpoch", "DrainProofJson", "DrainProofSha256",
            "RequestFingerprint", "ConfirmationSha256", "OperatorUserId", "OperatorAccount",
            "OperatorName", "Reason", "CreateTime"
        }, Upgrade25.GateTransitionAuditFields.Select(field => field.Name).ToArray());

        var allNames = Upgrade25.Fields.Select(field => field.Name).ToArray();
        Assert.DoesNotContain("ProtocolVersion", allNames);
        Assert.DoesNotContain("PublishFence", FieldNames("mci_ai_app_version"));
        Assert.DoesNotContain("ReleaseEntryPath", allNames);
        Assert.DoesNotContain("StableResolverPath", allNames);
        Assert.DoesNotContain("ProjectionStatus", allNames);

        Assert.Equal(new[]
        {
            "Prepared", "Verifying", "ReleaseVerified", "PointerCommitted", "ProjectionPending",
            "Completed", "FailedBeforeCommit", "RepairRequired", "LegacyUnverified",
            "ManualReview", "Superseded"
        }, Upgrade25.CanonicalPublishStates);
        Assert.DoesNotContain("Staged", Upgrade25.CanonicalPublishStates);
        Assert.DoesNotContain("Verified", Upgrade25.CanonicalPublishStates);
        Assert.DoesNotContain("Committed", Upgrade25.CanonicalPublishStates);

        var controls = Upgrade25.Fields.Where(field => field.Control).ToArray();
        Assert.Equal(12, controls.Length);
        Assert.All(controls, field => Assert.False(string.IsNullOrWhiteSpace(field.DefaultValue)));
        Assert.Equal("2", Control("sys_microistore", "PublishProtocolVersion").DefaultValue);
        Assert.Equal("LegacyUnverified", Control("mci_ai_app_version", "PublishState").DefaultValue);
        Assert.Equal("int", Control("mci_ai_app_version", "RecoveryEpoch").LogicalType);
        Assert.Equal("LegacyOpen", Control("sys_osclients", "ApplicationStreamPublishMode").DefaultValue);
        Assert.All(
            Upgrade25.Fields.Where(field => field.TableName == "sys_osclients"),
            field => Assert.False(field.Visible));
    }

    [Fact]
    public void Upgrade25_BuildsMySqlSqlServerAndOracleDdlWithoutWeakeningTheContract()
    {
        var entryPath = Upgrade25.Fields.Single(field =>
            field.TableName == "mci_ai_app_version" && field.Name == "EntryPath");
        var manifest = Upgrade25.Fields.Single(field => field.Name == "AssetManifestJson");
        var routeSnapshot = Upgrade25.Fields.Single(field => field.Name == "RouteSnapshotJson");
        var routeSnapshotHash = Upgrade25.Fields.Single(field => field.Name == "RouteSnapshotHash");
        var protocol = Control("sys_microistore", "PublishProtocolVersion");

        Assert.Contains("`EntryPath` varchar(1200) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.MySql, entryPath));
        Assert.Contains("[EntryPath] nvarchar(1200) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.SqlServer, entryPath));
        Assert.Contains("[AssetManifestJson] nvarchar(max) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.SqlServer, manifest));
        Assert.Contains("[RouteSnapshotJson] nvarchar(max) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.SqlServer, routeSnapshot));
        Assert.Contains("[RouteSnapshotHash] char(64) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.SqlServer, routeSnapshotHash));
        Assert.Contains("EntryPath VARCHAR2(1200 CHAR) NULL",
            Upgrade25.BuildAddColumnSql(Upgrade25.SchemaDialect.Oracle, entryPath));

        Assert.Equal(
            "ALTER TABLE `sys_microistore` MODIFY COLUMN `PublishProtocolVersion` int NOT NULL DEFAULT 2",
            Upgrade25.BuildControlAlterSql(Upgrade25.SchemaDialect.MySql, protocol));
        Assert.Equal(
            "ALTER TABLE [sys_microistore] ALTER COLUMN [PublishProtocolVersion] int NOT NULL",
            Upgrade25.BuildControlAlterSql(Upgrade25.SchemaDialect.SqlServer, protocol));
        Assert.Equal(
            "ALTER TABLE sys_microistore MODIFY (PublishProtocolVersion NUMBER(10) DEFAULT 2 NOT NULL)",
            Upgrade25.BuildControlAlterSql(Upgrade25.SchemaDialect.Oracle, protocol));

        var request = Upgrade25.Indexes.Single(index => index.Name == "ux_aav_app_request");
        Assert.DoesNotContain("WHERE", Upgrade25.BuildCreateIndexSql(Upgrade25.SchemaDialect.MySql, request));
        Assert.EndsWith("WHERE [RequestId] IS NOT NULL",
            Upgrade25.BuildCreateIndexSql(Upgrade25.SchemaDialect.SqlServer, request));
        Assert.DoesNotContain("WHERE", Upgrade25.BuildCreateIndexSql(Upgrade25.SchemaDialect.Oracle, request));

        var fileIdentity = Upgrade25.Indexes.Single(index => index.Name == "ux_aaf_version_pathhash");
        Assert.Equal(new[] { "VersionId", "FilePathHash" }, fileIdentity.Columns);
        Assert.DoesNotContain("FilePath`)",
            Upgrade25.BuildCreateIndexSql(Upgrade25.SchemaDialect.MySql, fileIdentity));

        foreach (var dialect in new[]
                 {
                     Upgrade25.SchemaDialect.MySql,
                     Upgrade25.SchemaDialect.SqlServer,
                     Upgrade25.SchemaDialect.Oracle
                 })
        {
            var auditDdl = Upgrade25.BuildCreateGateTransitionAuditTableSql(dialect);
            Assert.Contains(Upgrade25.GateTransitionAuditTable, auditDdl);
            Assert.Contains("TransitionId", auditDdl);
            Assert.Contains("ConfirmationSha256", auditDdl);
        }
    }

    [Fact]
    public void Upgrade25_UsesTheConnectedProviderDialectIncludingSqlServer9()
    {
        Assert.Equal(Upgrade25.SchemaDialect.MySql, Upgrade25.ParseDialect(DatabaseType.MySql));
        Assert.Equal(Upgrade25.SchemaDialect.SqlServer, Upgrade25.ParseDialect(DatabaseType.SqlServer));
        Assert.Equal(Upgrade25.SchemaDialect.SqlServer, Upgrade25.ParseDialect(DatabaseType.SqlServer9));
        Assert.Equal(Upgrade25.SchemaDialect.Oracle, Upgrade25.ParseDialect(DatabaseType.Oracle));
    }

    [Fact]
    public void Upgrade25_OptionalAppStorePresenceClassifiesNoneAllAndPartialForReadinessPolicy()
    {
        Assert.Equal(
            Upgrade25.ApplicationStoreTablePresence.None,
            Upgrade25.ClassifyApplicationStoreTablePresence(_ => false));
        Assert.Equal(
            Upgrade25.ApplicationStoreTablePresence.Complete,
            Upgrade25.ClassifyApplicationStoreTablePresence(_ => true));

        var first = Upgrade25.RequiredApplicationStoreTables[0];
        Assert.Equal(
            Upgrade25.ApplicationStoreTablePresence.Partial,
            Upgrade25.ClassifyApplicationStoreTablePresence(tableName => tableName == first));
        Assert.Equal(3, Upgrade25.RequiredApplicationStoreTables.Count);
    }

    [Fact]
    public void Upgrade25_SqlServerUnicodePathContractPreservesNfcAssetNames()
    {
        var columns = Upgrade25.SqlServerUnicodeColumns.ToDictionary(
            field => field.TableName + "." + field.Name,
            StringComparer.OrdinalIgnoreCase);
        Assert.Equal(
            "ALTER TABLE [mci_ai_app_file] ALTER COLUMN [FilePath] nvarchar(1000) NULL",
            Upgrade25.BuildSqlServerUnicodeAlterSql(columns["mci_ai_app_file.FilePath"]));
        Assert.Equal(
            "ALTER TABLE [mci_ai_app_version] ALTER COLUMN [EntryPath] nvarchar(1200) NULL",
            Upgrade25.BuildSqlServerUnicodeAlterSql(columns["mci_ai_app_version.EntryPath"]));
        Assert.Equal(
            "ALTER TABLE [mci_ai_app_version] ALTER COLUMN [ReleasePrefix] nvarchar(2000) NULL",
            Upgrade25.BuildSqlServerUnicodeAlterSql(columns["mci_ai_app_version.ReleasePrefix"]));

        const string unicodePath = "dist/应用.js";
        Assert.Equal(unicodePath, V8McpLogic.NormalizeApplicationAssetRelativePath(unicodePath));
        Assert.Equal(
            "644ebbb7823e01b82091439ef8dc477ca5e1f2ebc3ea6a993536cabb152ed238",
            Upgrade25.ComputeFilePathHash(unicodePath));
    }

    [Fact]
    public void Upgrade25_AuditsNullsDuplicatesAndProviderSpecificNullableRequestIdentity()
    {
        var appVersion = Upgrade25.Indexes.Single(index => index.Name == "ux_aav_app_version");
        var request = Upgrade25.Indexes.Single(index => index.Name == "ux_aav_app_request");
        var file = Upgrade25.Indexes.Single(index => index.Name == "ux_aaf_version_pathhash");
        var transition = Upgrade25.Indexes.Single(index => index.Name == "ux_asgt_transition_id");

        var mysql = Upgrade25.BuildDuplicateAuditSql(Upgrade25.SchemaDialect.MySql, appVersion);
        Assert.Contains("GROUP BY `AppId`, `VersionNo` HAVING COUNT(*) > 1", mysql);
        Assert.Contains(") AS duplicate_groups", mysql);

        var sqlServer = Upgrade25.BuildDuplicateAuditSql(Upgrade25.SchemaDialect.SqlServer, request);
        Assert.Contains("WHERE [RequestId] IS NOT NULL", sqlServer);
        Assert.Contains("GROUP BY [AppId], [RequestId]", sqlServer);

        var oracle = Upgrade25.BuildDuplicateAuditSql(Upgrade25.SchemaDialect.Oracle, file);
        Assert.Contains("GROUP BY VersionId, FilePathHash", oracle);
        Assert.Contains(") duplicate_groups", oracle);
        Assert.DoesNotContain(") AS duplicate_groups", oracle);

        var exactPathAudit = Upgrade25.BuildFilePathDuplicateAuditSql(Upgrade25.SchemaDialect.MySql);
        Assert.Contains("GROUP BY `VersionId`, `FilePath` HAVING COUNT(*) > 1", exactPathAudit);
        Assert.Contains("GROUP BY `TransitionId` HAVING COUNT(*) > 1",
            Upgrade25.BuildDuplicateAuditSql(Upgrade25.SchemaDialect.MySql, transition));

        Assert.Equal("REQUESTIDISNOTNULL",
            Upgrade25.NormalizeSqlPredicate("(([RequestId] IS NOT NULL))"));
        Assert.Equal("LegacyOpen", Upgrade25.NormalizeDefaultExpression("((N'LegacyOpen'))"));
        Assert.Equal("2", Upgrade25.NormalizeDefaultExpression("((2))"));

        Assert.Contains("LIMIT 500", Upgrade25.BuildFileHashPageSql(Upgrade25.SchemaDialect.MySql, true));
        Assert.Contains("TOP (500)", Upgrade25.BuildFileHashPageSql(Upgrade25.SchemaDialect.SqlServer, false));
        Assert.Contains("ROWNUM<=500", Upgrade25.BuildFileHashPageSql(Upgrade25.SchemaDialect.Oracle, true));
        Assert.Contains("Id>@p0", Upgrade25.BuildFileHashPageSql(Upgrade25.SchemaDialect.Oracle, true));
    }

    [Fact]
    public void Upgrade25_FilePathHashUsesNormalizedLogicalPathAndFullUtf8Sha256()
    {
        const string expected = "36964a51f2abeab494c63882226deaf43cd86dee96f80d02a002bc3011b1e1f5";
        Assert.Equal(expected, Upgrade25.ComputeFilePathHash("dist/app.js"));
        Assert.Equal(expected, Upgrade25.ComputeFilePathHash("  dist\\app.js  "));
        Assert.Equal(
            "644ebbb7823e01b82091439ef8dc477ca5e1f2ebc3ea6a993536cabb152ed238",
            Upgrade25.ComputeFilePathHash("dist/应用.js"));
        Assert.Throws<ArgumentException>(() => Upgrade25.ComputeFilePathHash("dist//app.js"));
        Assert.Throws<ArgumentException>(() => Upgrade25.ComputeFilePathHash("../secret.txt"));
    }

    [Fact]
    public void AppStoreFreshInstallResourceContainsEveryV3ColumnAndMetadataDefinition()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);

        Assert.Equal(package["PackageInfo"]!["FieldCount"]!.Value<int>(),
            package["DiyFields"]!.Count());
        Assert.Equal(package["PackageInfo"]!["PhysicalColumnCount"]!.Value<int>(),
            package["PhysicalColumns"]!.Count());

        foreach (var field in Upgrade25.Fields.Where(field => field.TableName != "sys_osclients"))
        {
            var ddl = Assert.Single(package["DDLStatements"]!.Children<JObject>(), item =>
                item["TableName"]?.ToString() == field.TableName)["DDL"]!.ToString();
            Assert.Contains("`" + field.Name + "`", ddl);
            Assert.Single(package["PhysicalColumns"]!.Children<JObject>(), item =>
                item["TABLE_NAME"]?.ToString() == field.TableName
                && item["COLUMN_NAME"]?.ToString() == field.Name);
            Assert.Single(package["DiyFields"]!.Children<JObject>(), item =>
                item["TableName"]?.ToString() == field.TableName
                && item["Name"]?.ToString() == field.Name);
        }

        var versionDdl = package["DDLStatements"]!.Children<JObject>().Single(item =>
            item["TableName"]?.ToString() == "mci_ai_app_version")["DDL"]!.ToString();
        Assert.Contains("`PublishProtocolVersion` int NOT NULL DEFAULT 2", versionDdl);
        Assert.Contains("`PublishState` varchar(50) NOT NULL DEFAULT 'LegacyUnverified'", versionDdl);
        Assert.Contains("`FencingToken` bigint NOT NULL DEFAULT 0", versionDdl);
        Assert.Contains("`RecoveryEpoch` int NOT NULL DEFAULT 0", versionDdl);
        Assert.Contains("`RouteSnapshotJson` mediumtext NULL", versionDdl);
        Assert.Contains("`RouteSnapshotHash` char(64) NULL", versionDdl);
        var recoveryPhysical = Assert.Single(package["PhysicalColumns"]!.Children<JObject>(), item =>
            item["TABLE_NAME"]?.ToString() == "mci_ai_app_version"
            && item["COLUMN_NAME"]?.ToString() == "RecoveryEpoch");
        Assert.Equal("int", recoveryPhysical["DATA_TYPE"]?.ToString());
        var recoveryMetadata = Assert.Single(package["DiyFields"]!.Children<JObject>(), item =>
            item["TableName"]?.ToString() == "mci_ai_app_version"
            && item["Name"]?.ToString() == "RecoveryEpoch");
        Assert.Equal("int", recoveryMetadata["Type"]?.ToString());
        foreach (var routeFieldName in new[] { "RouteSnapshotJson", "RouteSnapshotHash" })
        {
            var routeMetadata = Assert.Single(package["DiyFields"]!.Children<JObject>(), item =>
                item["TableName"]?.ToString() == "mci_ai_app_version"
                && item["Name"]?.ToString() == routeFieldName);
            Assert.Equal(0, routeMetadata.Value<int>("Visible"));
            Assert.Equal(0, routeMetadata.Value<int>("AppVisible"));
            Assert.Equal(1, routeMetadata.Value<int>("Readonly"));
        }

        var fileDdl = package["DDLStatements"]!.Children<JObject>().Single(item =>
            item["TableName"]?.ToString() == "mci_ai_app_file")["DDL"]!.ToString();
        Assert.Contains("`FilePathHash` char(64) NULL", fileDdl);

        // The portable package describes physical columns but has no provider-
        // specific index section. A database whose ServerVersion is already
        // current must therefore still be detected as missing every v3 index
        // definitions so the startup invariant runs Upgrade25 after import.
        var physicalColumns = package["PhysicalColumns"]!
            .Children<JObject>()
            .Select(item => (Table: item["TABLE_NAME"]?.ToString(), Column: item["COLUMN_NAME"]?.ToString()))
            .Where(item => item.Table != null && item.Column != null)
            .Select(item => item.Table + "." + item.Column)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var freshInstallMissing = Upgrade25.FindMissingSchemaContract(
            (tableName, columnName) => tableName == "sys_osclients"
                                       || tableName == Upgrade25.GateTransitionAuditTable
                                       || physicalColumns.Contains(tableName + "." + columnName),
            _ => false);
        Assert.Null(package["Indexes"]);
        Assert.Equal(7, Upgrade25.Indexes.Count);
        Assert.DoesNotContain(freshInstallMissing, item => item.StartsWith("column:", StringComparison.Ordinal));
        Assert.Equal(
            Upgrade25.Indexes.Select(index => "index:" + index.TableName + "." + index.Name).ToArray(),
            freshInstallMissing.ToArray());
        var metadataFieldNames = package["DiyFields"]!
            .Children<JObject>()
            .Select(item => item["Name"]?.ToString())
            .Where(name => name != null)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var responseOnlyName in new[] { "ReleaseEntryPath", "StableResolverPath", "ProjectionStatus" })
        {
            Assert.DoesNotContain(metadataFieldNames, name =>
                string.Equals(name, responseOnlyName, StringComparison.OrdinalIgnoreCase));
            Assert.DoesNotContain(physicalColumns, column =>
                column.EndsWith("." + responseOnlyName, StringComparison.OrdinalIgnoreCase));
        }
    }

    private static string[] FieldNames(string tableName) => Upgrade25.Fields
        .Where(field => field.TableName == tableName)
        .Select(field => field.Name)
        .ToArray();

    private static Upgrade25.SchemaField Control(string tableName, string fieldName) => Upgrade25.Fields.Single(field =>
        field.TableName == tableName && field.Name == fieldName && field.Control);
}
