using Dos.ORM.Dialects.Dm8;
using Dos.ORM.Dialects.Oracle;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class LogicalTextStorageCompilerTests
{
    [Theory]
    [MemberData(nameof(OracleAndDm))]
    public void Oracle_family_text_uses_the_exact_non_empty_envelope_contract(
        ISqlCompiler compiler,
        DialectProfile profile)
    {
        var options = StorageContractTestOptions.For(profile);
        var storage = options.StorageContract;

        var plan = compiler.Compile(
            AstSamples.LogicalTextRoundTripAndPredicates(), options);
        var step = PlanAssert.SingleSql(plan);

        Assert.Equal(storage.Fingerprint,
            step.InternalValueContract.StorageContractFingerprint);
        Assert.All(
            step.InternalValueContract.Parameters,
            parameter => Assert.Equal(
                LogicalTextEncoding.NonEmptyEnvelopeV1,
                parameter.ValueContract.TextEncoding));
        Assert.Contains(
            step.InternalValueContract.Results,
            result => result.ValueContract.TextEncoding
                == LogicalTextEncoding.NonEmptyEnvelopeV1);
        Assert.Contains("SUBSTRING", step.CommandText);
        Assert.Contains("-1", step.CommandText);
        Assert.Contains("LIKE :p0", step.CommandText);
        Assert.Contains("NULLS LAST", step.CommandText);
        Assert.DoesNotContain("NativeSql", step.CommandText);
    }

    [Theory]
    [MemberData(nameof(OracleAndDm))]
    public void Oracle_family_rejects_native_storage_for_logical_text(
        ISqlCompiler compiler,
        DialectProfile profile)
    {
        var error = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            compiler.Compile(
                AstSamples.LogicalTextRoundTripAndPredicates(),
                new SqlCompilationOptions(profile)));

        Assert.Contains("storage_contract", error.Feature);
    }

    public static IEnumerable<object[]> OracleAndDm()
    {
        yield return new object[] { new OracleCompiler(), TestProfiles.Oracle19c };
        yield return new object[] { new Dm8Compiler(), TestProfiles.Dm8 };
    }

}

internal static class StorageContractTestOptions
{
    internal static SqlCompilationOptions For(
        DialectProfile profile)
    {
        var storage = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            Fingerprint("logical-text-catalog", profile),
            profile.Fingerprint,
            new[] { "Sys_User.Name:String:200" });
        return new SqlCompilationOptions(
            profile,
            AtomicityRequirement.None,
            null,
            storage);
    }

    private static StructuralFingerprint Fingerprint(
        string value,
        DialectProfile profile)
    {
        var wire = new StableWireBuffer();
        wire.WriteUtf8(value);
        wire.WriteUtf8(profile.Fingerprint);
        return new StructuralFingerprint(wire.ComputeSha256Text());
    }
}
