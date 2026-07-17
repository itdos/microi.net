using System;

namespace Dos.ORM.SqlAst
{
    public enum LogicalDbType
    {
        String,
        AnsiString,
        Int16,
        Int32,
        Int64,
        Decimal,
        Double,
        Boolean,
        Guid,
        Date,
        DateTime,
        DateTimeOffset,
        Binary,
        Json,
        Clob,
        Blob
    }

    public sealed class SqlTypeDescriptor : IEquatable<SqlTypeDescriptor>
    {
        public SqlTypeDescriptor(
            LogicalDbType logicalType,
            int? length = null,
            int? precision = null,
            int? scale = null)
        {
            if (!Enum.IsDefined(typeof(LogicalDbType), logicalType))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(logicalType), "Logical database type must be defined.");
            }

            if (length.HasValue && length.Value <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(length), "Length must be positive when specified.");
            }

            if (precision.HasValue && precision.Value <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(precision), "Precision must be positive when specified.");
            }

            if (scale.HasValue && scale.Value < 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(scale), "Scale must be non-negative when specified.");
            }

            if (scale.HasValue && !precision.HasValue)
            {
                throw new ArgumentException(
                    "Scale requires an explicit precision.", nameof(scale));
            }

            if (scale.HasValue && scale.Value > precision.Value)
            {
                throw new ArgumentException(
                    "Scale cannot be greater than precision.", nameof(scale));
            }

            LogicalType = logicalType;
            Length = length;
            Precision = precision;
            Scale = scale;
        }

        public LogicalDbType LogicalType { get; }

        public int? Length { get; }

        public int? Precision { get; }

        public int? Scale { get; }

        public bool Equals(SqlTypeDescriptor other)
        {
            return other != null &&
                   LogicalType == other.LogicalType &&
                   Length == other.Length &&
                   Precision == other.Precision &&
                   Scale == other.Scale;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SqlTypeDescriptor);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = (int)LogicalType;
                hashCode = (hashCode * 397) ^ Length.GetHashCode();
                hashCode = (hashCode * 397) ^ Precision.GetHashCode();
                hashCode = (hashCode * 397) ^ Scale.GetHashCode();
                return hashCode;
            }
        }
    }
}
