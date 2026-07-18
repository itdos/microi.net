using System;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.MySql
{
    internal sealed class MySqlTypeMapper
    {
        internal void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
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
                case LogicalDbType.AnsiString:
                    WriteText(type.Length, writer);
                    return;
                case LogicalDbType.Int16:
                    writer.AppendKeyword(SqlKeyword.SmallInt);
                    return;
                case LogicalDbType.Int32:
                    writer.AppendKeyword(SqlKeyword.Int);
                    return;
                case LogicalDbType.Int64:
                    writer.AppendKeyword(SqlKeyword.BigInt);
                    return;
                case LogicalDbType.Decimal:
                    WriteDecimal(type, writer, context);
                    return;
                case LogicalDbType.Double:
                    writer.AppendKeyword(SqlKeyword.Double);
                    return;
                case LogicalDbType.Boolean:
                    writer.AppendKeyword(SqlKeyword.Boolean);
                    return;
                case LogicalDbType.Guid:
                    writer.AppendKeyword(SqlKeyword.Char);
                    WriteLength(36, writer);
                    return;
                case LogicalDbType.Date:
                    writer.AppendKeyword(SqlKeyword.Date);
                    return;
                case LogicalDbType.DateTime:
                    writer.AppendKeyword(SqlKeyword.DateTime);
                    WriteLength(6, writer);
                    return;
                case LogicalDbType.DateTimeOffset:
                    writer.AppendKeyword(SqlKeyword.VarChar);
                    WriteLength(35, writer);
                    return;
                case LogicalDbType.Binary:
                    WriteBinary(type.Length, writer);
                    return;
                case LogicalDbType.Json:
                    writer.AppendKeyword(SqlKeyword.Json);
                    return;
                case LogicalDbType.Clob:
                    writer.AppendKeyword(SqlKeyword.LongText);
                    return;
                case LogicalDbType.Blob:
                    writer.AppendKeyword(SqlKeyword.LongBlob);
                    return;
                default:
                    throw new ArgumentOutOfRangeException(nameof(type));
            }
        }

        private static void WriteText(
            int? length,
            SqlTextWriter writer)
        {
            if (!length.HasValue || length.Value > 16383)
            {
                writer.AppendKeyword(SqlKeyword.LongText);
                return;
            }
            writer.AppendKeyword(SqlKeyword.VarChar);
            WriteLength(length.Value, writer);
        }

        private static void WriteBinary(
            int? length,
            SqlTextWriter writer)
        {
            if (!length.HasValue || length.Value > 16383)
            {
                writer.AppendKeyword(SqlKeyword.LongBlob);
                return;
            }
            writer.AppendKeyword(SqlKeyword.VarBinary);
            WriteLength(length.Value, writer);
        }

        private static void WriteDecimal(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            var precision = type.Precision ?? 38;
            var scale = type.Scale ?? 0;
            if (precision > 65 || scale > 30)
            {
                throw new UnsupportedDatabaseCapabilityException(
                    context.DialectProfile,
                    "mysql.decimal_precision_scale",
                    "$");
            }

            writer.AppendKeyword(SqlKeyword.Decimal);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(precision);
            writer.AppendComma();
            writer.AppendStructuralInt(scale);
            writer.AppendCloseParenthesis();
        }

        private static void WriteLength(
            int length,
            SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(length);
            writer.AppendCloseParenthesis();
        }
    }
}
