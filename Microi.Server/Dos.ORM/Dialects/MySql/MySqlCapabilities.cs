using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.MySql
{
    internal static class MySqlCapabilities
    {
        private static readonly DatabaseCapabilities MySql57 = Create(
            supportsWindowFunctions: false,
            supportsCommonTableExpressions: false,
            supportsSkipLocked: false,
            supportsNoWait: false);

        private static readonly DatabaseCapabilities MySql80 = Create(
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsSkipLocked: true,
            supportsNoWait: true);

        internal static DatabaseCapabilities For(DialectProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }

            var version = profile.ServerVersion;
            if (profile.DatabaseType == DatabaseType.MySql
                && string.Equals(
                    profile.CompatibilityMode,
                    string.Empty,
                    StringComparison.Ordinal)
                && HasFourComponents(version))
            {
                if (version.Major == 5
                    && version.Minor == 7
                    && Compare(version, 5, 7, 8, 0) >= 0)
                {
                    return MySql57;
                }
                if (version.Major == 8
                    && version.Minor == 0
                    && Compare(version, 8, 0, 11, 0) >= 0)
                {
                    return MySql80;
                }
            }

            throw new UnsupportedDatabaseCapabilityException(
                profile, "mysql.profile", "$");
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
            if (version.Major != major)
            {
                return version.Major.CompareTo(major);
            }
            if (version.Minor != minor)
            {
                return version.Minor.CompareTo(minor);
            }
            if (version.Build != build)
            {
                return version.Build.CompareTo(build);
            }
            return version.Revision.CompareTo(revision);
        }

        private static DatabaseCapabilities Create(
            bool supportsWindowFunctions,
            bool supportsCommonTableExpressions,
            bool supportsSkipLocked,
            bool supportsNoWait)
        {
            return new DatabaseCapabilities(
                supportsLimitOffsetPagination: true,
                supportsOffsetFetchPagination: false,
                supportsRownumPagination: false,
                supportsReturningClause: false,
                supportsReturningIntoClause: false,
                supportsOutputClause: false,
                supportsIdentityColumns: true,
                supportsSequences: false,
                supportsOnDuplicateKeyUpsert: true,
                supportsOnConflictUpsert: false,
                supportsMergeUpsert: false,
                supportsLockedUpdateThenInsertUpsert: false,
                supportsJson: true,
                supportsWindowFunctions: supportsWindowFunctions,
                supportsCommonTableExpressions:
                    supportsCommonTableExpressions,
                supportsForUpdateLock: true,
                supportsUpdateLockHint: false,
                supportsSkipLocked: supportsSkipLocked,
                supportsNoWait: supportsNoWait,
                supportsMultipleStatements: false,
                supportsMultipleResultSets: false,
                maxParametersPerCommand: 65535,
                maxCommandTextLength: 1048576,
                maxBulkRowsPerBatch: 1000,
                ddlTransactionBehavior:
                    PlanTransactionBehavior.ImplicitCommit,
                supportsSchemas: true,
                supportsCatalogs: false,
                supportsCreateDatabase: true,
                supportsDropDatabase: true,
                supportsNativeBulk: false);
        }
    }
}
