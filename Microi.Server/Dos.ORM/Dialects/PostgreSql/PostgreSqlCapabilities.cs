using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.PostgreSql
{
    internal static class PostgreSqlCapabilities
    {
        private static readonly DatabaseCapabilities PostgreSql14 =
            Create(supportsMergeUpsert: false);

        private static readonly DatabaseCapabilities PostgreSql17 =
            Create(supportsMergeUpsert: true);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }

            if (profile.DatabaseType == DatabaseType.PostgreSql
                && string.Equals(
                    profile.CompatibilityMode,
                    string.Empty,
                    StringComparison.Ordinal)
                && HasFourComponents(profile.ServerVersion))
            {
                if (profile.ServerVersion.Major == 14)
                {
                    return PostgreSql14;
                }
                if (profile.ServerVersion.Major == 17)
                {
                    return PostgreSql17;
                }
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "postgresql.profile", "$");
        }

        private static bool HasFourComponents(Version version)
        {
            return version != null
                && version.Major >= 0
                && version.Minor >= 0
                && version.Build >= 0
                && version.Revision >= 0;
        }

        private static DatabaseCapabilities Create(bool supportsMergeUpsert)
        {
            return new DatabaseCapabilities(
                supportsLimitOffsetPagination: true,
                supportsOffsetFetchPagination: true,
                supportsRownumPagination: false,
                supportsReturningClause: true,
                supportsReturningIntoClause: false,
                supportsOutputClause: false,
                supportsIdentityColumns: true,
                supportsSequences: true,
                supportsOnDuplicateKeyUpsert: false,
                supportsOnConflictUpsert: true,
                supportsMergeUpsert: supportsMergeUpsert,
                supportsLockedUpdateThenInsertUpsert: false,
                supportsJson: true,
                supportsWindowFunctions: true,
                supportsCommonTableExpressions: true,
                supportsForUpdateLock: true,
                supportsUpdateLockHint: false,
                supportsSkipLocked: true,
                supportsNoWait: true,
                supportsMultipleStatements: false,
                supportsMultipleResultSets: false,
                maxParametersPerCommand: 65535,
                maxCommandTextLength: 1048576,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior: PlanTransactionBehavior.Enlistable,
                supportsSchemas: true,
                supportsCatalogs: false,
                supportsCreateDatabase: true,
                supportsDropDatabase: true,
                supportsNativeBulk: false);
        }
    }
}
