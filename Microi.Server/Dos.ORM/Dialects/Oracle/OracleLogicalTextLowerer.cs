using System;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Oracle
{
    internal sealed class OracleLogicalTextLowerer
    {
        internal void ValidateStorageContract(SqlLoweringContext context)
        {
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }
            if (context.StorageContract.Version != 1
                || context.StorageContract.TextEncoding
                    != LogicalTextEncoding.NonEmptyEnvelopeV1
                || context.StorageContract.EncodedColumnKeys.Count == 0)
            {
                throw new UnsupportedDatabaseCapabilityException(
                    context.DialectProfile,
                    "oracle.storage_contract.non_empty_envelope_v1",
                    "$");
            }
        }
    }
}
