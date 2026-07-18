using System;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal sealed class SqlLoweringContext
    {
        internal SqlLoweringContext(
            SqlCompilationOptions options,
            DatabaseCapabilities capabilities,
            MigrationStepId sourceMigrationStepId)
        {
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            if (capabilities == null)
            {
                throw new ArgumentNullException(nameof(capabilities));
            }

            Options = options;
            DialectProfile = options.DialectProfile;
            Capabilities = capabilities;
            StorageContract = options.StorageContract;
            SourceMigrationStepId = sourceMigrationStepId;
        }

        internal SqlCompilationOptions Options { get; }

        internal DialectProfile DialectProfile { get; }

        internal DatabaseCapabilities Capabilities { get; }

        internal DatabaseStorageContract StorageContract { get; }

        internal MigrationStepId SourceMigrationStepId { get; }
    }
}
