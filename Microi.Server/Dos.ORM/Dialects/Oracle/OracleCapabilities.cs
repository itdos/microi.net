using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Oracle
{
    internal static class OracleCapabilities
    {
        private static readonly DatabaseCapabilities Oracle11g = Create(
            supportsOffsetFetchPagination: false,
            supportsIdentityColumns: false,
            supportsJson: false);

        private static readonly DatabaseCapabilities Oracle19c = Create(
            supportsOffsetFetchPagination: true,
            supportsIdentityColumns: true,
            supportsJson: true);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }

            if (profile.DatabaseType == DatabaseType.Oracle
                && string.Equals(
                    profile.CompatibilityMode,
                    string.Empty,
                    StringComparison.Ordinal)
                && HasFourComponents(profile.ServerVersion))
            {
                var version = profile.ServerVersion;
                if (version.Major == 11
                    && version.Minor == 2
                    && Compare(version, 11, 2, 0, 4) >= 0)
                {
                    return Oracle11g;
                }
                if (version.Major == 19)
                {
                    return Oracle19c;
                }
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "oracle.profile", "$");
        }

        private static DatabaseCapabilities Create(
            bool supportsOffsetFetchPagination,
            bool supportsIdentityColumns,
            bool supportsJson)
        {
            return new DatabaseCapabilities(
                supportsLimitOffsetPagination: false,
                supportsOffsetFetchPagination: supportsOffsetFetchPagination,
                supportsRownumPagination: true,
                supportsReturningClause: false,
                supportsReturningIntoClause: true,
                supportsOutputClause: false,
                supportsIdentityColumns: supportsIdentityColumns,
                supportsSequences: true,
                supportsOnDuplicateKeyUpsert: false,
                supportsOnConflictUpsert: false,
                supportsMergeUpsert: true,
                supportsLockedUpdateThenInsertUpsert: false,
                supportsJson: supportsJson,
                supportsWindowFunctions: true,
                supportsCommonTableExpressions: true,
                supportsForUpdateLock: true,
                supportsUpdateLockHint: false,
                supportsSkipLocked: true,
                supportsNoWait: true,
                supportsMultipleStatements: false,
                supportsMultipleResultSets: false,
                maxParametersPerCommand: 1000,
                maxCommandTextLength: 65535,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior: PlanTransactionBehavior.ImplicitCommit,
                supportsSchemas: true,
                supportsCatalogs: false,
                supportsCreateDatabase: false,
                supportsDropDatabase: false,
                supportsNativeBulk: false);
        }

        private static bool HasFourComponents(Version version)
        {
            return version != null
                && version.Major >= 0
                && version.Minor >= 0
                && version.Build >= 0
                && version.Revision >= 0;
        }

        private static int Compare(
            Version version,
            int major,
            int minor,
            int build,
            int revision)
        {
            return version.CompareTo(new Version(major, minor, build, revision));
        }
    }
}
