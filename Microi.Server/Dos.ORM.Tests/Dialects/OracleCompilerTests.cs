using Dos.ORM.Dialects.Oracle;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class OracleCompilerTests
{
    [Fact]
    public void Oracle_profiles_freeze_the_11g_and_19c_capability_differences()
    {
        var eleven = OracleCapabilities.For(TestProfiles.Oracle11g);
        var nineteen = OracleCapabilities.For(TestProfiles.Oracle19c);

        Assert.True(eleven.SupportsRownumPagination);
        Assert.False(eleven.SupportsOffsetFetchPagination);
        Assert.False(eleven.SupportsIdentityColumns);
        Assert.False(eleven.SupportsJson);
        Assert.True(nineteen.SupportsRownumPagination);
        Assert.True(nineteen.SupportsOffsetFetchPagination);
        Assert.True(nineteen.SupportsIdentityColumns);
        Assert.True(nineteen.SupportsJson);
        Assert.Equal(1000, nineteen.MaxParametersPerCommand);
        Assert.Equal(65535, nineteen.MaxCommandTextLength);
        Assert.Equal(PlanTransactionBehavior.ImplicitCommit,
            nineteen.DdlTransactionBehavior);
        Assert.False(nineteen.SupportsCreateDatabase);
        Assert.False(nineteen.SupportsDropDatabase);
    }

    [Theory]
    [InlineData(LogicalDbType.String, 10, "NVARCHAR2(11)")]
    [InlineData(LogicalDbType.AnsiString, 10, "VARCHAR2(11)")]
    [InlineData(LogicalDbType.Int32, null, "NUMBER(10)")]
    [InlineData(LogicalDbType.Guid, null, "RAW(16)")]
    [InlineData(LogicalDbType.DateTime, null, "TIMESTAMP(6)")]
    public void Oracle_type_mapper_preserves_logical_types_and_expands_text(
        LogicalDbType type,
        int? length,
        string expected)
    {
        var options = StorageContractTestOptions.For(TestProfiles.Oracle19c);
        var context = new SqlLoweringContext(
            options, OracleCapabilities.For(TestProfiles.Oracle19c), null);
        var writer = new SqlTextWriter(SqlTextDialectFamily.Oracle);

        new OracleTypeMapper().Write(
            new SqlTypeDescriptor(type, length: length), writer, context);

        Assert.Equal(expected, writer.Snapshot().CommandText);
    }

    [Fact]
    public void Oracle19c_uses_offset_fetch_for_stable_paging()
    {
        var plan = new OracleCompiler().Compile(
            AstSamples.PagedUsers(),
            StorageContractTestOptions.For(TestProfiles.Oracle19c));

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.Contains("OFFSET 40 ROWS", data.CommandText);
        Assert.Contains("FETCH NEXT 20 ROWS ONLY", data.CommandText);
        Assert.Empty(data.Parameters);
        PlanAssert.IsCountThenData(plan);
    }

    [Fact]
    public void Oracle_uses_colon_parameters_and_its_exact_profile()
    {
        var plan = new OracleCompiler().Compile(
            AstSamples.UserById(),
            StorageContractTestOptions.For(TestProfiles.Oracle19c));

        var step = PlanAssert.SingleSql(plan);
        Assert.Contains(":p0", step.CommandText);
        Assert.Equal(new[] { "id" }, step.Parameters.Select(x => x.Name));
        Assert.Equal(DatabaseType.Oracle, plan.DialectProfile.DatabaseType);
    }

    [Theory]
    [MemberData(nameof(RejectedProfiles))]
    public void Oracle_rejects_every_non_certified_profile(DialectProfile profile)
    {
        var error = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            new OracleCompiler().Compile(
                AstSamples.UserById(),
                StorageContractTestOptions.For(profile)));

        Assert.Equal("oracle.profile", error.Feature);
    }

    public static IEnumerable<object[]> RejectedProfiles()
    {
        yield return new object[]
        {
            new DialectProfile(
                DatabaseType.Oracle,
                new Version(11, 2, 0, 3),
                string.Empty)
        };
        yield return new object[]
        {
            new DialectProfile(
                DatabaseType.Oracle,
                new Version(18, 0, 0, 0),
                string.Empty)
        };
        yield return new object[]
        {
            new DialectProfile(DatabaseType.Oracle, new Version(19, 0, 0, 0), "Oracle")
        };
        yield return new object[]
        {
            new DialectProfile(
                DatabaseType.DaMeng,
                new Version(19, 0, 0, 0),
                string.Empty)
        };
    }
}
