using System;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Platform
{

public sealed class DatabaseCapabilities
{
    internal DatabaseCapabilities(
        bool supportsLimitOffsetPagination,
        bool supportsOffsetFetchPagination,
        bool supportsRownumPagination,
        bool supportsReturningClause,
        bool supportsReturningIntoClause,
        bool supportsOutputClause,
        bool supportsIdentityColumns,
        bool supportsSequences,
        bool supportsOnDuplicateKeyUpsert,
        bool supportsOnConflictUpsert,
        bool supportsMergeUpsert,
        bool supportsLockedUpdateThenInsertUpsert,
        bool supportsJson,
        bool supportsWindowFunctions,
        bool supportsCommonTableExpressions,
        bool supportsForUpdateLock,
        bool supportsUpdateLockHint,
        bool supportsSkipLocked,
        bool supportsNoWait,
        bool supportsMultipleStatements,
        bool supportsMultipleResultSets,
        int maxParametersPerCommand,
        int maxCommandTextLength,
        int maxBulkRowsPerBatch,
        PlanTransactionBehavior ddlTransactionBehavior,
        bool supportsSchemas,
        bool supportsCatalogs,
        bool supportsCreateDatabase,
        bool supportsDropDatabase,
        bool supportsNativeBulk)
    {
        if (!supportsLimitOffsetPagination &&
            !supportsOffsetFetchPagination &&
            !supportsRownumPagination)
        {
            throw new ArgumentException(
                "At least one pagination strategy must be supported.");
        }
        if (maxParametersPerCommand <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(maxParametersPerCommand));
        }
        if (maxCommandTextLength <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxCommandTextLength));
        }
        if (maxBulkRowsPerBatch <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxBulkRowsPerBatch));
        }
        if (!Enum.IsDefined(
                typeof(PlanTransactionBehavior),
                ddlTransactionBehavior))
        {
            throw new ArgumentOutOfRangeException(
                nameof(ddlTransactionBehavior));
        }
        if (ddlTransactionBehavior == PlanTransactionBehavior.Opaque)
        {
            throw new ArgumentException(
                "Opaque DDL transaction behavior cannot be certified.",
                nameof(ddlTransactionBehavior));
        }
        if ((supportsSkipLocked || supportsNoWait) &&
            !supportsForUpdateLock &&
            !supportsUpdateLockHint)
        {
            throw new ArgumentException(
                "Skip-locked and no-wait require a supported lock strategy.");
        }

        SupportsLimitOffsetPagination = supportsLimitOffsetPagination;
        SupportsOffsetFetchPagination = supportsOffsetFetchPagination;
        SupportsRownumPagination = supportsRownumPagination;
        SupportsReturningClause = supportsReturningClause;
        SupportsReturningIntoClause = supportsReturningIntoClause;
        SupportsOutputClause = supportsOutputClause;
        SupportsIdentityColumns = supportsIdentityColumns;
        SupportsSequences = supportsSequences;
        SupportsOnDuplicateKeyUpsert = supportsOnDuplicateKeyUpsert;
        SupportsOnConflictUpsert = supportsOnConflictUpsert;
        SupportsMergeUpsert = supportsMergeUpsert;
        SupportsLockedUpdateThenInsertUpsert =
            supportsLockedUpdateThenInsertUpsert;
        SupportsJson = supportsJson;
        SupportsWindowFunctions = supportsWindowFunctions;
        SupportsCommonTableExpressions = supportsCommonTableExpressions;
        SupportsForUpdateLock = supportsForUpdateLock;
        SupportsUpdateLockHint = supportsUpdateLockHint;
        SupportsSkipLocked = supportsSkipLocked;
        SupportsNoWait = supportsNoWait;
        SupportsMultipleStatements = supportsMultipleStatements;
        SupportsMultipleResultSets = supportsMultipleResultSets;
        MaxParametersPerCommand = maxParametersPerCommand;
        MaxCommandTextLength = maxCommandTextLength;
        MaxBulkRowsPerBatch = maxBulkRowsPerBatch;
        DdlTransactionBehavior = ddlTransactionBehavior;
        SupportsSchemas = supportsSchemas;
        SupportsCatalogs = supportsCatalogs;
        SupportsCreateDatabase = supportsCreateDatabase;
        SupportsDropDatabase = supportsDropDatabase;
        SupportsNativeBulk = supportsNativeBulk;
    }

    public bool SupportsLimitOffsetPagination { get; }
    public bool SupportsOffsetFetchPagination { get; }
    public bool SupportsRownumPagination { get; }
    public bool SupportsReturningClause { get; }
    public bool SupportsReturningIntoClause { get; }
    public bool SupportsOutputClause { get; }
    public bool SupportsIdentityColumns { get; }
    public bool SupportsSequences { get; }
    public bool SupportsOnDuplicateKeyUpsert { get; }
    public bool SupportsOnConflictUpsert { get; }
    public bool SupportsMergeUpsert { get; }
    public bool SupportsLockedUpdateThenInsertUpsert { get; }
    public bool SupportsJson { get; }
    public bool SupportsWindowFunctions { get; }
    public bool SupportsCommonTableExpressions { get; }
    public bool SupportsForUpdateLock { get; }
    public bool SupportsUpdateLockHint { get; }
    public bool SupportsSkipLocked { get; }
    public bool SupportsNoWait { get; }
    public bool SupportsMultipleStatements { get; }
    public bool SupportsMultipleResultSets { get; }
    public int MaxParametersPerCommand { get; }
    public int MaxCommandTextLength { get; }
    public int MaxBulkRowsPerBatch { get; }
    public PlanTransactionBehavior DdlTransactionBehavior { get; }
    public bool SupportsSchemas { get; }
    public bool SupportsCatalogs { get; }
    public bool SupportsCreateDatabase { get; }
    public bool SupportsDropDatabase { get; }
    public bool SupportsNativeBulk { get; }
}

}
