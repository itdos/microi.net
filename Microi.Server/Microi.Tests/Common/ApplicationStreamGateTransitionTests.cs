using Dos.ORM;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class ApplicationStreamGateTransitionTests
{
    private const string CanonicalProof =
        "{\"activeV2Publishes\":0,\"checkedAtUtc\":\"2026-08-02T00:00:00Z\",\"nodes\":[\"api-1\",\"api-2\"]}";
    private const string ProofHash =
        "ea1cc9eeeebc60275703e1c1d4f088257ba8cf2e8916ab0a4b125dfcff09161e";

    [Theory]
    [InlineData("LegacyOpen", 2, "Drain", 2, false)]
    [InlineData("Drain", 2, "LegacyOpen", 2, false)]
    [InlineData("Drain", 2, "V3Only", 3, true)]
    public void TransitionGraph_AllowsOnlyTheThreeMonotonicEdges(
        string expectedMode,
        int expectedMin,
        string targetMode,
        int targetMin,
        bool requiresDrainProof)
    {
        var result = V8McpLogic.ValidateApplicationStreamGateTransitionGraph(
            expectedMode, expectedMin, 41, targetMode, targetMin);

        Assert.True(result.IsValid, result.Error);
        Assert.Equal(42, result.ResultGateEpoch);
        Assert.Equal(requiresDrainProof, result.RequiresDrainProof);
    }

    [Theory]
    [InlineData("LegacyOpen", 2, "V3Only", 3)]
    [InlineData("LegacyOpen", 2, "LegacyOpen", 2)]
    [InlineData("Drain", 2, "Drain", 2)]
    [InlineData("V3Only", 3, "Drain", 2)]
    [InlineData("V3Only", 3, "LegacyOpen", 2)]
    [InlineData("Drain", 3, "V3Only", 3)]
    [InlineData("Drain", 2, "V3Only", 2)]
    public void TransitionGraph_RejectsDirectJumpEpochReuseAndAutomaticDowngrade(
        string expectedMode,
        int expectedMin,
        string targetMode,
        int targetMin)
    {
        var result = V8McpLogic.ValidateApplicationStreamGateTransitionGraph(
            expectedMode, expectedMin, 8, targetMode, targetMin);
        Assert.False(result.IsValid);
        Assert.NotEmpty(result.Error);
    }

    [Fact]
    public void TransitionGraph_RejectsEpochOverflow()
    {
        var result = V8McpLogic.ValidateApplicationStreamGateTransitionGraph(
            "LegacyOpen", 2, long.MaxValue, "Drain", 2);
        Assert.False(result.IsValid);
    }

    [Fact]
    public void AdministratorGate_IsExactLevel999()
    {
        Assert.Null(V8McpLogic.ValidateApplicationStreamGateTransitionAdministratorLevel(999));
        Assert.NotNull(V8McpLogic.ValidateApplicationStreamGateTransitionAdministratorLevel(998));
        Assert.NotNull(V8McpLogic.ValidateApplicationStreamGateTransitionAdministratorLevel(1000));
    }

    [Fact]
    public void AllThreeApplicationStoreTablesAreMandatory()
    {
        Assert.Equal(3, V8McpLogic.RequiredApplicationStreamGateStoreTables.Count);
        Assert.Empty(V8McpLogic.FindMissingApplicationStreamGateStoreTables(_ => true));
        var existing = V8McpLogic.RequiredApplicationStreamGateStoreTables[0];
        Assert.Equal(2, V8McpLogic.FindMissingApplicationStreamGateStoreTables(
            table => table == existing).Count);
    }

    [Fact]
    public void Upgrade25Readiness_RequiresFiveTableColumnContractAndSevenIndexes()
    {
        Assert.Equal(5, V8McpLogic.RequiredApplicationStreamGateTransitionColumns.Count);
        Assert.Equal(7, V8McpLogic.RequiredApplicationStreamGateTransitionIndexes.Count);
        Assert.Equal(new[]
        {
            "ux_aav_app_version", "ux_aav_app_request", "ux_aaf_version_pathhash",
            "ix_aav_state_time_app", "ix_aaf_app_version_scope", "ix_store_active_fence",
            "ux_asgt_transition_id"
        }, V8McpLogic.RequiredApplicationStreamGateTransitionIndexes.Select(index => index.Name));
        Assert.Contains("ConfirmationSha256",
            V8McpLogic.RequiredApplicationStreamGateTransitionColumns[
                V8McpLogic.ApplicationStreamGateTransitionAuditTable]);
        Assert.Empty(V8McpLogic.FindMissingApplicationStreamGateTransitionColumns((_, _) => true));
        var missing = V8McpLogic.FindMissingApplicationStreamGateTransitionColumns(
            (table, column) => table != "sys_osclients" || column != "ApplicationStreamGateEpoch");
        Assert.Equal(new[] { "sys_osclients.ApplicationStreamGateEpoch" }, missing);
    }

    [Fact]
    public void IndexReadiness_AcceptsEquivalentButRejectsWrongCanonicalDefinition()
    {
        var required = V8McpLogic.RequiredApplicationStreamGateTransitionIndexes.Single(index =>
            index.Name == "ux_asgt_transition_id");
        var equivalent = new V8McpLogic.TableIndexInfo
        {
            Key_name = "ux_equivalent_transition",
            Non_unique = 0,
            Columns = new List<string> { "TransitionId" }
        };
        var selected = V8McpLogic.ResolveApplicationStreamGateRequiredIndex(
            new[] { equivalent }, required, out var equivalentError);
        Assert.Same(equivalent, selected);
        Assert.Null(equivalentError);

        var wrongCanonical = new V8McpLogic.TableIndexInfo
        {
            Key_name = "ux_asgt_transition_id",
            Non_unique = 1,
            Columns = new List<string> { "TransitionId" }
        };
        selected = V8McpLogic.ResolveApplicationStreamGateRequiredIndex(
            new[] { equivalent, wrongCanonical }, required, out var conflictError);
        Assert.Null(selected);
        Assert.Contains("同名索引定义冲突", conflictError);

        Assert.Equal("REQUESTIDISNOTNULL",
            V8McpLogic.NormalizeApplicationStreamGateIndexPredicate("(([RequestId] IS NOT NULL))"));
    }

    [Fact]
    public void SqlDialect_UsesConnectedProviderIncludingSqlServer9()
    {
        Assert.Equal(V8McpLogic.ApplicationStreamGateSqlDialect.MySql,
            V8McpLogic.ParseApplicationStreamGateSqlDialect(DatabaseType.MySql));
        Assert.Equal(V8McpLogic.ApplicationStreamGateSqlDialect.SqlServer,
            V8McpLogic.ParseApplicationStreamGateSqlDialect(DatabaseType.SqlServer));
        Assert.Equal(V8McpLogic.ApplicationStreamGateSqlDialect.SqlServer,
            V8McpLogic.ParseApplicationStreamGateSqlDialect(DatabaseType.SqlServer9));
        Assert.Equal(V8McpLogic.ApplicationStreamGateSqlDialect.Oracle,
            V8McpLogic.ParseApplicationStreamGateSqlDialect(DatabaseType.Oracle));
    }

    [Theory]
    [InlineData(V8McpLogic.ApplicationStreamGateSqlDialect.MySql, "FOR UPDATE", "LIMIT 2")]
    [InlineData(V8McpLogic.ApplicationStreamGateSqlDialect.SqlServer, "UPDLOCK", "HOLDLOCK")]
    [InlineData(V8McpLogic.ApplicationStreamGateSqlDialect.Oracle, "FOR UPDATE", "ROWNUM<=2")]
    public void SqlBuilders_UseRowLocksAndParameterizedThreeCoordinateCas(
        V8McpLogic.ApplicationStreamGateSqlDialect dialect,
        string lockMarker,
        string limitMarker)
    {
        var gateLock = V8McpLogic.BuildApplicationStreamGateLockSql(dialect);
        Assert.Contains(lockMarker, gateLock, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(limitMarker, gateLock, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("@os", gateLock);
        Assert.Contains("@type", gateLock);
        Assert.Contains("@network", gateLock);
        Assert.Contains("COALESCE", gateLock, StringComparison.OrdinalIgnoreCase);

        var cas = V8McpLogic.BuildApplicationStreamGateCasUpdateSql(dialect);
        Assert.Contains("@expectedMode", cas);
        Assert.Contains("@expectedMin", cas);
        Assert.Contains("@expectedEpoch", cas);
        Assert.Contains("@resultEpoch", cas);
        Assert.Contains("COALESCE", cas, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("LegacyOpen", cas);

        var auditLock = V8McpLogic.BuildApplicationStreamGateAuditLockSql(dialect);
        Assert.Contains(lockMarker, auditLock, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("@transitionId", auditLock);
        var auditInsert = V8McpLogic.BuildApplicationStreamGateAuditInsertSql(dialect);
        Assert.Contains("@transitionId", auditInsert);
        Assert.Contains("@requestFingerprint", auditInsert);
        Assert.Contains("@confirmationSha256", auditInsert);
    }

    [Fact]
    public void DrainProofCanonicalizer_IsOrdinalRecursiveArrayStableAndSafeIntegerOnly()
    {
        Assert.Equal(
            "{\"a\":{\"a\":1,\"z\":2},\"b\":[3,2,1]}",
            V8McpLogic.CanonicalizeApplicationStreamGateDrainProof(
                "{\"b\":[3,2,1],\"a\":{\"z\":2,\"a\":1}}"));
        Assert.Equal(ProofHash, V8McpLogic.ComputeApplicationStreamGateDrainProofSha256(CanonicalProof));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.CanonicalizeApplicationStreamGateDrainProof("{\"n\":1.5}"));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.CanonicalizeApplicationStreamGateDrainProof("{\"n\":9007199254740992}"));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.CanonicalizeApplicationStreamGateDrainProof("[]"));
    }

    [Fact]
    public void ConfirmationHash_MatchesTheFixedMcpCrossLanguageVector()
    {
        var confirmation = V8McpLogic.BuildApplicationStreamGateTransitionFingerprint(
            "gate-20260802-0001",
            "iTdos",
            "Product",
            "Internal",
            "LegacyOpen",
            2,
            7,
            "Drain",
            2,
            CanonicalProof,
            ProofHash,
            "Begin an audited v2 drain window");

        Assert.Equal("75ca82954e5909bfef4a4da4459dd3b48dabf31f844bcc8419d0385edf932cf0",
            confirmation);
        Assert.NotEqual(confirmation, V8McpLogic.BuildApplicationStreamGateTransitionFingerprint(
            "gate-20260802-0001", "iTdos", "Product", "Internal", "LegacyOpen", 2, 7,
            "Drain", 2, CanonicalProof, ProofHash, "changed reason"));
    }

    [Fact]
    public void TransitionIdReplay_SucceedsOnlyForExactFingerprintAndConfirmation()
    {
        const string fingerprint = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string confirmation = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        Assert.Null(V8McpLogic.ValidateApplicationStreamGateTransitionReplay(
            fingerprint, confirmation, fingerprint, confirmation));
        Assert.NotNull(V8McpLogic.ValidateApplicationStreamGateTransitionReplay(
            fingerprint, confirmation, new string('c', 64), confirmation));
        Assert.NotNull(V8McpLogic.ValidateApplicationStreamGateTransitionReplay(
            fingerprint, confirmation, fingerprint, new string('d', 64)));
    }

    [Fact]
    public void AuditId_IsDeterministicAndBounded()
    {
        var first = V8McpLogic.BuildApplicationStreamGateTransitionAuditId("gate-20260802-0001");
        Assert.Equal(first, V8McpLogic.BuildApplicationStreamGateTransitionAuditId("gate-20260802-0001"));
        Assert.Equal(36, first.Length);
        Assert.NotEqual(first, V8McpLogic.BuildApplicationStreamGateTransitionAuditId("gate-20260802-0002"));
    }
}
