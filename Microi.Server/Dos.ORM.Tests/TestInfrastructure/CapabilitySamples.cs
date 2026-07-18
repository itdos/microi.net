using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class CapabilitySamples
{
    private static readonly string[] BooleanPropertyNames =
    {
        "SupportsLimitOffsetPagination",
        "SupportsOffsetFetchPagination",
        "SupportsRownumPagination",
        "SupportsReturningClause",
        "SupportsReturningIntoClause",
        "SupportsOutputClause",
        "SupportsIdentityColumns",
        "SupportsSequences",
        "SupportsOnDuplicateKeyUpsert",
        "SupportsOnConflictUpsert",
        "SupportsMergeUpsert",
        "SupportsLockedUpdateThenInsertUpsert",
        "SupportsJson",
        "SupportsWindowFunctions",
        "SupportsCommonTableExpressions",
        "SupportsForUpdateLock",
        "SupportsUpdateLockHint",
        "SupportsSkipLocked",
        "SupportsNoWait",
        "SupportsMultipleStatements",
        "SupportsMultipleResultSets",
        "SupportsSchemas",
        "SupportsCatalogs",
        "SupportsCreateDatabase",
        "SupportsDropDatabase",
        "SupportsNativeBulk"
    };

    internal static DatabaseCapabilities Create(
        int maxParameters = 101,
        int maxCommandText = 1009,
        int maxBulkRows = 37,
        bool supportsLimitOffsetPagination = true,
        bool supportsOffsetFetchPagination = false,
        bool supportsRownumPagination = false,
        bool supportsReturningClause = false,
        bool supportsReturningIntoClause = false,
        bool supportsOutputClause = false,
        bool supportsIdentityColumns = false,
        bool supportsSequences = false,
        bool supportsOnDuplicateKeyUpsert = false,
        bool supportsOnConflictUpsert = false,
        bool supportsMergeUpsert = false,
        bool supportsLockedUpdateThenInsertUpsert = false,
        bool supportsJson = false,
        bool supportsWindowFunctions = false,
        bool supportsCommonTableExpressions = false,
        bool supportsForUpdateLock = true,
        bool supportsUpdateLockHint = false,
        bool supportsSkipLocked = false,
        bool supportsNoWait = false,
        bool supportsMultipleStatements = false,
        bool supportsMultipleResultSets = false,
        PlanTransactionBehavior ddlTransactionBehavior =
            PlanTransactionBehavior.Enlistable,
        bool supportsSchemas = false,
        bool supportsCatalogs = false,
        bool supportsCreateDatabase = false,
        bool supportsDropDatabase = false,
        bool supportsNativeBulk = false) =>
        new(
            supportsLimitOffsetPagination,
            supportsOffsetFetchPagination,
            supportsRownumPagination,
            supportsReturningClause,
            supportsReturningIntoClause,
            supportsOutputClause,
            supportsIdentityColumns,
            supportsSequences,
            supportsOnDuplicateKeyUpsert,
            supportsOnConflictUpsert,
            supportsMergeUpsert,
            supportsLockedUpdateThenInsertUpsert,
            supportsJson,
            supportsWindowFunctions,
            supportsCommonTableExpressions,
            supportsForUpdateLock,
            supportsUpdateLockHint,
            supportsSkipLocked,
            supportsNoWait,
            supportsMultipleStatements,
            supportsMultipleResultSets,
            maxParameters,
            maxCommandText,
            maxBulkRows,
            ddlTransactionBehavior,
            supportsSchemas,
            supportsCatalogs,
            supportsCreateDatabase,
            supportsDropDatabase,
            supportsNativeBulk);

    internal static DatabaseCapabilities CreateWithNoPagination() =>
        Create(
            supportsLimitOffsetPagination: false,
            supportsOffsetFetchPagination: false,
            supportsRownumPagination: false);

    internal static DatabaseCapabilities CreateWithOnlyRownumPagination() =>
        Create(
            supportsLimitOffsetPagination: false,
            supportsOffsetFetchPagination: false,
            supportsRownumPagination: true);

    internal static void AssertEveryConstructorPositionIsCopied()
    {
        for (var focus = 0; focus < BooleanPropertyNames.Length; focus++)
        {
            AssertBooleanRow(focus, false);
            AssertBooleanRow(focus, true);
        }

        var numeric = Create(1013, 2027, 3041);
        Assert.Equal(1013, numeric.MaxParametersPerCommand);
        Assert.Equal(2027, numeric.MaxCommandTextLength);
        Assert.Equal(3041, numeric.MaxBulkRowsPerBatch);

        foreach (var behavior in new[]
                 {
                     PlanTransactionBehavior.Enlistable,
                     PlanTransactionBehavior.ImplicitCommit,
                     PlanTransactionBehavior.NotEnlistable
                 })
        {
            Assert.Equal(
                behavior,
                Create(ddlTransactionBehavior: behavior)
                    .DdlTransactionBehavior);
        }
    }

    private static void AssertBooleanRow(int focus, bool focusValue)
    {
        var values = new bool[BooleanPropertyNames.Length];
        values[0] = true;
        values[15] = true;
        values[focus] = focusValue;

        if (focus == 0 && !focusValue)
        {
            values[1] = true;
        }

        var capabilities = CreateFromBooleanValues(values);
        var type = capabilities.GetType();
        for (var index = 0; index < BooleanPropertyNames.Length; index++)
        {
            var property = type.GetProperty(BooleanPropertyNames[index]);
            Assert.NotNull(property);
            Assert.Equal(values[index], property.GetValue(capabilities));
        }
    }

    private static DatabaseCapabilities CreateFromBooleanValues(bool[] values) =>
        new(
            values[0],
            values[1],
            values[2],
            values[3],
            values[4],
            values[5],
            values[6],
            values[7],
            values[8],
            values[9],
            values[10],
            values[11],
            values[12],
            values[13],
            values[14],
            values[15],
            values[16],
            values[17],
            values[18],
            values[19],
            values[20],
            1013,
            2027,
            3041,
            PlanTransactionBehavior.Enlistable,
            values[21],
            values[22],
            values[23],
            values[24],
            values[25]);
}
