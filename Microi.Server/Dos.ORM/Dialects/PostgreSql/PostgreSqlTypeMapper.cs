using System;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.PostgreSql
{
    internal sealed class PostgreSqlTypeMapper
    {
        internal void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            PostgreSqlFamilyTypeMapper.Write(type, writer, context,
                "postgresql");
        }
    }

    internal static class PostgreSqlFamilyTypeMapper
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
            if (string.IsNullOrEmpty(featurePrefix))
            {
                throw new ArgumentException(
                    "Feature prefix is required.", nameof(featurePrefix));
            }

            switch (type.LogicalType)
            {
                case LogicalDbType.String:
                case LogicalDbType.AnsiString:
                    WriteText(type.Length, writer);
                    return;
                case LogicalDbType.Int16:
                    writer.AppendKeyword(SqlKeyword.SmallInt);
                    return;
                case LogicalDbType.Int32:
                    writer.AppendKeyword(SqlKeyword.Integer);
                    return;
                case LogicalDbType.Int64:
                    writer.AppendKeyword(SqlKeyword.BigInt);
                    return;
                case LogicalDbType.Decimal:
                    WriteDecimal(
                        type, writer, context, featurePrefix);
                    return;
                case LogicalDbType.Double:
                    writer.AppendKeyword(SqlKeyword.DoublePrecision);
                    return;
                case LogicalDbType.Boolean:
                    writer.AppendKeyword(SqlKeyword.Boolean);
                    return;
                case LogicalDbType.Guid:
                    writer.AppendKeyword(SqlKeyword.Uuid);
                    return;
                case LogicalDbType.Date:
                    writer.AppendKeyword(SqlKeyword.Date);
                    return;
                case LogicalDbType.DateTime:
                    writer.AppendKeyword(SqlKeyword.Timestamp);
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.WithoutTimeZone);
                    return;
                case LogicalDbType.DateTimeOffset:
                    writer.AppendKeyword(SqlKeyword.Timestamp);
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.WithTimeZone);
                    return;
                case LogicalDbType.Binary:
                case LogicalDbType.Blob:
                    writer.AppendKeyword(SqlKeyword.ByteA);
                    return;
                case LogicalDbType.Json:
                    writer.AppendKeyword(SqlKeyword.JsonB);
                    return;
                case LogicalDbType.Clob:
                    writer.AppendKeyword(SqlKeyword.Text);
                    return;
                default:
                    throw new UnsupportedDatabaseCapabilityException(
                        context.DialectProfile,
                        featurePrefix + ".logical_type",
                        "$");
            }
        }

        private static void WriteText(
            int? length,
            SqlTextWriter writer)
        {
            if (!length.HasValue)
            {
                writer.AppendKeyword(SqlKeyword.Text);
                return;
            }
            writer.AppendKeyword(SqlKeyword.VarChar);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(length.Value);
            writer.AppendCloseParenthesis();
        }

        private static void WriteDecimal(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            var precision = type.Precision ?? 38;
            var scale = type.Scale ?? 0;
            if (precision > 1000)
            {
                throw new UnsupportedDatabaseCapabilityException(
                    context.DialectProfile,
                    featurePrefix + ".decimal_precision",
                    "$");
            }
            writer.AppendKeyword(SqlKeyword.Numeric);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(precision);
            writer.AppendComma();
            writer.AppendStructuralInt(scale);
            writer.AppendCloseParenthesis();
        }
    }
}
