using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.KingbaseEs
{
    internal static class KingbaseEsCapabilities
    {
        private static readonly DatabaseCapabilities KingbaseEsV9 =
            new DatabaseCapabilities(
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
                supportsMergeUpsert: true,
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
                maxParametersPerCommand: 32767,
                maxCommandTextLength: 1048576,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior: PlanTransactionBehavior.Enlistable,
                supportsSchemas: true,
                supportsCatalogs: false,
                supportsCreateDatabase: true,
                supportsDropDatabase: true,
                supportsNativeBulk: false);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }

            if (profile.DatabaseType == DatabaseType.KingBase
                && string.Equals(
                    profile.CompatibilityMode,
                    "PostgreSQL",
                    StringComparison.Ordinal)
                && HasFourComponents(profile.ServerVersion)
                && profile.ServerVersion.Major == 9
                && profile.ServerVersion.Minor == 4
                && profile.ServerVersion.CompareTo(
                    new Version(9, 4, 12, 0)) >= 0)
            {
                return KingbaseEsV9;
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "kingbasees.profile", "$");
        }

        private static bool HasFourComponents(Version version)
        {
            return version != null
                && version.Major >= 0
                && version.Minor >= 0
                && version.Build >= 0
                && version.Revision >= 0;
        }
    }
}
