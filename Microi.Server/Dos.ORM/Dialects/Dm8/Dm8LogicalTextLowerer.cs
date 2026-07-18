using System;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Dm8
{
    internal sealed class Dm8LogicalTextLowerer
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
                    "dm8.storage_contract.non_empty_envelope_v1",
                    "$");
            }
        }
    }
}
