using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.SqlServer
{
    internal static class SqlServerCapabilities
    {
        private static readonly DatabaseCapabilities Certified =
            new DatabaseCapabilities(
                supportsLimitOffsetPagination: false,
                supportsOffsetFetchPagination: true,
                supportsRownumPagination: false,
                supportsReturningClause: false,
                supportsReturningIntoClause: false,
                supportsOutputClause: true,
                supportsIdentityColumns: true,
                supportsSequences: true,
                supportsOnDuplicateKeyUpsert: false,
                supportsOnConflictUpsert: false,
                supportsMergeUpsert: false,
                supportsLockedUpdateThenInsertUpsert: true,
                supportsJson: true,
                supportsWindowFunctions: true,
                supportsCommonTableExpressions: true,
                supportsForUpdateLock: false,
                supportsUpdateLockHint: true,
                supportsSkipLocked: false,
                supportsNoWait: true,
                supportsMultipleStatements: false,
                supportsMultipleResultSets: false,
                maxParametersPerCommand: 2100,
                maxCommandTextLength: 1048576,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior:
                    PlanTransactionBehavior.Enlistable,
                supportsSchemas: true,
                supportsCatalogs: true,
                supportsCreateDatabase: true,
                supportsDropDatabase: true,
                supportsNativeBulk: false);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }

            var version = profile.ServerVersion;
            if (profile.DatabaseType == DatabaseType.SqlServer
                && string.Equals(
                    profile.CompatibilityMode,
                    string.Empty,
                    StringComparison.Ordinal)
                && HasFourComponents(version)
                && version.Minor == 0
                && (version.Major == 14 || version.Major == 16))
            {
                return Certified;
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "sqlserver.profile", "$");
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
