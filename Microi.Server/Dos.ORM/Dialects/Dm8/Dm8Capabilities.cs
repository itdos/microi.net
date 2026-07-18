using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Dm8
{
    internal static class Dm8Capabilities
    {
        private static readonly DatabaseCapabilities Dm8 =
            new DatabaseCapabilities(
                supportsLimitOffsetPagination: true,
                supportsOffsetFetchPagination: true,
                supportsRownumPagination: true,
                supportsReturningClause: false,
                supportsReturningIntoClause: true,
                supportsOutputClause: false,
                supportsIdentityColumns: true,
                supportsSequences: true,
                supportsOnDuplicateKeyUpsert: false,
                supportsOnConflictUpsert: false,
                supportsMergeUpsert: true,
                supportsLockedUpdateThenInsertUpsert: false,
                supportsJson: false,
                supportsWindowFunctions: true,
                supportsCommonTableExpressions: true,
                supportsForUpdateLock: true,
                supportsUpdateLockHint: false,
                supportsSkipLocked: true,
                supportsNoWait: true,
                supportsMultipleStatements: false,
                supportsMultipleResultSets: false,
                maxParametersPerCommand: 2048,
                maxCommandTextLength: 65535,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior: PlanTransactionBehavior.ImplicitCommit,
                supportsSchemas: true,
                supportsCatalogs: false,
                supportsCreateDatabase: false,
                supportsDropDatabase: false,
                supportsNativeBulk: false);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }
            if (profile.DatabaseType == DatabaseType.DaMeng
                && profile.ServerVersion != null
                && profile.ServerVersion.Major == 8
                && profile.ServerVersion.Minor >= 0
                && profile.ServerVersion.Build >= 0
                && profile.ServerVersion.Revision >= 0
                && string.Equals(
                    profile.CompatibilityMode,
                    "Oracle",
                    StringComparison.Ordinal))
            {
                return Dm8;
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "dm8.profile", "$");
        }
    }
}
