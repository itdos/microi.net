using System;

namespace Dos.ORM.Dialects.Dm8
{
    /// <summary>
    /// Maps logical model column names that DM8 cannot use as physical columns.
    /// DM8 documents ROWID as forbidden for a table column even when quoted.
    /// </summary>
    internal static class Dm8IdentifierCompatibility
    {
        internal static string ToPhysicalColumn(string logicalIdentifier)
        {
            if (logicalIdentifier == null)
                throw new ArgumentNullException(nameof(logicalIdentifier));

            return string.Equals(
                    logicalIdentifier,
                    "RowId",
                    StringComparison.OrdinalIgnoreCase)
                ? "Row_Id"
                : logicalIdentifier;
        }

        internal static string ToLogicalColumn(string physicalIdentifier)
        {
            if (physicalIdentifier == null)
                throw new ArgumentNullException(nameof(physicalIdentifier));

            return string.Equals(
                    physicalIdentifier,
                    "Row_Id",
                    StringComparison.OrdinalIgnoreCase)
                ? "RowId"
                : physicalIdentifier;
        }
    }
}
