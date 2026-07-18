using Dos.ORM.Dialects.Dm8;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class Dm8CompilerTests
{
    [Fact]
    public void Dm8_profile_freezes_its_independent_capability_contract()
    {
        var capabilities = Dm8Capabilities.For(TestProfiles.Dm8);

        Assert.True(capabilities.SupportsLimitOffsetPagination);
        Assert.True(capabilities.SupportsOffsetFetchPagination);
        Assert.True(capabilities.SupportsRownumPagination);
        Assert.True(capabilities.SupportsIdentityColumns);
        Assert.False(capabilities.SupportsJson);
        Assert.Equal(2048, capabilities.MaxParametersPerCommand);
        Assert.Equal(65535, capabilities.MaxCommandTextLength);
        Assert.Equal(PlanTransactionBehavior.ImplicitCommit,
            capabilities.DdlTransactionBehavior);
        Assert.False(capabilities.SupportsCreateDatabase);
        Assert.False(capabilities.SupportsDropDatabase);
    }

    [Theory]
    [InlineData(LogicalDbType.String, 10, "NVARCHAR2(11)")]
    [InlineData(LogicalDbType.AnsiString, 10, "VARCHAR2(11)")]
    [InlineData(LogicalDbType.Int64, null, "NUMBER(19)")]
    [InlineData(LogicalDbType.Guid, null, "RAW(16)")]
    public void Dm8_uses_its_own_type_mapper(
        LogicalDbType type,
        int? length,
        string expected)
    {
        var options = StorageContractTestOptions.For(TestProfiles.Dm8);
        var context = new SqlLoweringContext(
            options, Dm8Capabilities.For(TestProfiles.Dm8), null);
        var writer = new SqlTextWriter(SqlTextDialectFamily.Oracle);

        new Dm8TypeMapper().Write(
            new SqlTypeDescriptor(type, length: length), writer, context);

        Assert.Equal(expected, writer.Snapshot().CommandText);
    }

    [Fact]
    public void Dm8_uses_its_own_profile_and_colon_parameters()
    {
        var plan = new Dm8Compiler().Compile(
            AstSamples.UserById(),
            StorageContractTestOptions.For(TestProfiles.Dm8));

        var step = PlanAssert.SingleSql(plan);
        Assert.Contains(":p0", step.CommandText);
        Assert.Equal(DatabaseType.DaMeng, plan.DialectProfile.DatabaseType);
        Assert.Equal("Oracle", plan.DialectProfile.CompatibilityMode);
    }

    [Fact]
    public void Dm8_uses_limit_offset_for_stable_paging()
    {
        var plan = new Dm8Compiler().Compile(
            AstSamples.PagedUsers(),
            StorageContractTestOptions.For(TestProfiles.Dm8));

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.Contains("LIMIT 20 OFFSET 40", data.CommandText);
        PlanAssert.IsCountThenData(plan);
    }

    [Theory]
    [MemberData(nameof(RejectedProfiles))]
    public void Dm8_rejects_wrong_type_version_mode_or_mode_case(
        DialectProfile profile)
    {
        var error = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            new Dm8Compiler().Compile(
                AstSamples.UserById(),
                StorageContractTestOptions.For(profile)));

        Assert.Equal("dm8.profile", error.Feature);
    }

    public static IEnumerable<object[]> RejectedProfiles()
    {
        yield return new object[]
        {
            new DialectProfile(DatabaseType.DaMeng, new Version(7, 9, 9, 9), "Oracle")
        };
        yield return new object[]
        {
            new DialectProfile(
                DatabaseType.DaMeng,
                new Version(8, 1, 3, 140),
                string.Empty)
        };
        yield return new object[]
        {
            new DialectProfile(DatabaseType.DaMeng, new Version(8, 1, 3, 140), "oracle")
        };
        yield return new object[]
        {
            new DialectProfile(DatabaseType.Oracle, new Version(8, 1, 3, 140), "Oracle")
        };
    }
}
