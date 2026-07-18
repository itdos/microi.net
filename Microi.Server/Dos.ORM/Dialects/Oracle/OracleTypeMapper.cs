using System;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Oracle
{
    internal sealed class OracleTypeMapper
    {
        internal void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            OracleFamilyTypeMapper.Write(
                type, writer, context, "oracle");
        }
    }

    internal static class OracleFamilyTypeMapper
    {
        internal static void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            if (type == null)
            {
                throw new ArgumentNullException(nameof(type));
            }
            if (writer == null)
            {
                throw new ArgumentNullException(nameof(writer));
            }
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }

            switch (type.LogicalType)
            {
                case LogicalDbType.String:
                    WriteText(type.Length, true, writer, context, featurePrefix);
                    return;
                case LogicalDbType.AnsiString:
                    WriteText(type.Length, false, writer, context, featurePrefix);
                    return;
                case LogicalDbType.Int16:
                    WriteNumber(5, null, writer);
                    return;
                case LogicalDbType.Int32:
                    WriteNumber(10, null, writer);
                    return;
                case LogicalDbType.Int64:
                    WriteNumber(19, null, writer);
                    return;
                case LogicalDbType.Decimal:
                    WriteDecimal(type, writer, context, featurePrefix);
                    return;
                case LogicalDbType.Double:
                    writer.AppendKeyword(SqlKeyword.BinaryDouble);
                    return;
                case LogicalDbType.Boolean:
                    WriteNumber(1, null, writer);
                    return;
                case LogicalDbType.Guid:
                    writer.AppendKeyword(SqlKeyword.Raw);
                    WriteLength(16, writer);
                    return;
                case LogicalDbType.Date:
                    writer.AppendKeyword(SqlKeyword.Date);
                    return;
                case LogicalDbType.DateTime:
                    WriteTimestamp(writer, false);
                    return;
                case LogicalDbType.DateTimeOffset:
                    WriteTimestamp(writer, true);
                    return;
                case LogicalDbType.Binary:
                    if (type.Length.HasValue && type.Length.Value <= 2000)
                    {
                        writer.AppendKeyword(SqlKeyword.Raw);
                        WriteLength(type.Length.Value, writer);
                    }
                    else
                    {
                        writer.AppendKeyword(SqlKeyword.Blob);
                    }
                    return;
                case LogicalDbType.Blob:
                    writer.AppendKeyword(SqlKeyword.Blob);
                    return;
                case LogicalDbType.Json:
                case LogicalDbType.Clob:
                    EnsureEnvelope(context, featurePrefix);
                    writer.AppendKeyword(SqlKeyword.NClob);
                    return;
                default:
                    throw Unsupported(context, featurePrefix, "logical_type");
            }
        }

        private static void WriteText(
            int? logicalLength,
            bool unicode,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            EnsureEnvelope(context, featurePrefix);
            if (!logicalLength.HasValue)
            {
                writer.AppendKeyword(
                    unicode ? SqlKeyword.NClob : SqlKeyword.Clob);
                return;
            }

            int physicalLength;
            try
            {
                physicalLength = checked(logicalLength.Value + 1);
            }
            catch (OverflowException)
            {
                throw Unsupported(context, featurePrefix, "text_length");
            }

            var maximum = unicode ? 2000 : 4000;
            if (physicalLength > maximum)
            {
                throw Unsupported(context, featurePrefix, "text_length");
            }
            writer.AppendKeyword(
                unicode ? SqlKeyword.NVarChar2 : SqlKeyword.VarChar2);
            WriteLength(physicalLength, writer);
        }

        private static void WriteDecimal(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            var precision = type.Precision ?? 38;
            var scale = type.Scale ?? 0;
            if (precision > 38)
            {
                throw Unsupported(context, featurePrefix, "decimal_precision");
            }
            WriteNumber(precision, scale, writer);
        }

        private static void WriteNumber(
            int precision,
            int? scale,
            SqlTextWriter writer)
        {
            writer.AppendKeyword(SqlKeyword.Number);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(precision);
            if (scale.HasValue)
            {
                writer.AppendComma();
                writer.AppendStructuralInt(scale.Value);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteTimestamp(
            SqlTextWriter writer,
            bool withTimeZone)
        {
            writer.AppendKeyword(SqlKeyword.Timestamp);
            WriteLength(6, writer);
            if (withTimeZone)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.WithTimeZone);
            }
        }

        private static void WriteLength(int length, SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(length);
            writer.AppendCloseParenthesis();
        }

        private static void EnsureEnvelope(
            SqlLoweringContext context,
            string featurePrefix)
        {
            if (context.StorageContract.Version != 1
                || context.StorageContract.TextEncoding
                    != LogicalTextEncoding.NonEmptyEnvelopeV1)
            {
                throw Unsupported(context, featurePrefix, "storage_contract");
            }
        }

        private static UnsupportedDatabaseCapabilityException Unsupported(
            SqlLoweringContext context,
            string featurePrefix,
            string feature)
        {
            return new UnsupportedDatabaseCapabilityException(
                context.DialectProfile,
                featurePrefix + "." + feature,
                "$");
        }
    }
}
