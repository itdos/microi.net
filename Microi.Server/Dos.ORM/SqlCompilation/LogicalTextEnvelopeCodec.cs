using System;
using System.IO;

namespace Dos.ORM.SqlCompilation
{
    internal static class LogicalTextEnvelopeCodec
    {
        internal const char Marker = '\uE000';

        internal static string Encode(string logicalValue)
        {
            return logicalValue == null
                ? null
                : Marker + logicalValue;
        }

        internal static string Decode(string physicalValue)
        {
            if (physicalValue == null)
            {
                return null;
            }
            if (physicalValue.Length == 0 || physicalValue[0] != Marker)
            {
                throw new InvalidDataException(
                    "The physical text value is missing the required "
                    + "non-empty-envelope marker.");
            }
            return physicalValue.Substring(1);
        }
    }
}
