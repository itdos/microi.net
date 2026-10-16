using System.Reflection;

namespace Microi.Tests.Common;

/// <summary>锁住真实集成用例的提供商归属；离线 SQL 编译测试仍由 Quick 完整执行。</summary>
public sealed class ReleaseTestMatrixClassificationTests
{
    [Fact]
    public void MixedProviderRowsKeepEveryMySqlCaseAndCarryIndependentProviderTraits()
    {
        foreach (var (type, methodName, mySqlCount) in new[]
        {
            (typeof(Dos.Common.Tests.FieldOptionTreePageIntegrationTests), "LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter", 1),
            (typeof(RoleLimitActiveSnapshotTests), "RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls", 1),
            (typeof(TenantJwtPersistenceIntegrationTests), "NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes", 4)
        })
        {
            var method = type.GetMethod(methodName)!;
            var rows = method.GetCustomAttributes<InlineDataAttribute>().ToArray();
            Assert.Equal(mySqlCount, rows.Count(row => Equals(row.Data[0], "MySql")));
            Assert.Equal(mySqlCount, rows.Count(row => Equals(row.Data[0], "SqlServer")));
            foreach (var row in rows)
                Assert.Equal(new[] { "DatabaseProvider", row.Data[0]!.ToString() }, row.Traits);
            // 依赖由具体行检查，不能再让整个 Theory 同时依赖两种连接而全部跳过。
            Assert.Null(method.GetCustomAttribute<TheoryAttribute>()!.Skip);
        }
    }

    [Fact]
    public void SqlServerOnlyIntegrationMethodsAreFilteredWithoutRemovingOfflineTests()
    {
        foreach (var (type, methodName) in new[]
        {
            (typeof(DatabasePoolRecoveryIntegrationTests), "RealSqlServer_RotationRecoversPool_AndPreservesBorrowedTransaction"),
            (typeof(StartupDependencySqlServerIntegrationTests), "ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites"),
            (typeof(ORM.Compatibility.SqlServerColumnDescriptionIntegrationTests), "ChangeColumn_AddsMissingDescription_UpdatesAndRenamesWithoutLosingData"),
            (typeof(SqlServerMenuCapacityTests), "LegacyMenuMigrationWidensBeforeBackfillAndKeepsConstraintsAcrossRestart"),
            (typeof(FormEngineSqlServerWriteTests), "CurrentFileIndex_RepairsNullIdentitySemantics_AndPreservesVersionUniqueness"),
            (typeof(StartupPhysicalContractTests), "LegacyLoginSchema_IsRepairedRegardlessOfRecordedVersion_AndPreservesRows"),
            (typeof(SelectedDependencyVersionTests), "SqlServerMatchesItsExplicitlySelectedVersion")
        })
        {
            var attributes = type.GetCustomAttributesData().Concat(type.GetMethod(methodName)!.GetCustomAttributesData());
            Assert.Contains(attributes, attribute => attribute.AttributeType == typeof(TraitAttribute)
                && Equals(attribute.ConstructorArguments[0].Value, "DatabaseProvider")
                && Equals(attribute.ConstructorArguments[1].Value, "SqlServer"));
        }
    }
}
