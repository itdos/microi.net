using System;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.SqlServer
{
    internal sealed class SqlServerTypeMapper
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
                    WriteVariableLength(
                        SqlKeyword.NVarChar, type.Length, writer);
                    return;
                case LogicalDbType.AnsiString:
                    WriteVariableLength(
                        SqlKeyword.VarChar, type.Length, writer);
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
                    writer.AppendKeyword(SqlKeyword.Float);
                    WriteLength(53, writer);
                    return;
                case LogicalDbType.Boolean:
                    writer.AppendKeyword(SqlKeyword.Bit);
                    return;
                case LogicalDbType.Guid:
                    writer.AppendKeyword(SqlKeyword.UniqueIdentifier);
                    return;
                case LogicalDbType.Date:
                    writer.AppendKeyword(SqlKeyword.Date);
                    return;
                case LogicalDbType.DateTime:
                    writer.AppendKeyword(SqlKeyword.DateTime2);
                    WriteLength(7, writer);
                    return;
                case LogicalDbType.DateTimeOffset:
                    writer.AppendKeyword(SqlKeyword.DateTimeOffset);
                    WriteLength(7, writer);
                    return;
                case LogicalDbType.Binary:
                    WriteVariableLength(
                        SqlKeyword.VarBinary, type.Length, writer);
                    return;
                case LogicalDbType.Json:
                case LogicalDbType.Clob:
                    writer.AppendKeyword(SqlKeyword.NVarChar);
                    WriteMax(writer);
                    return;
                case LogicalDbType.Blob:
                    writer.AppendKeyword(SqlKeyword.VarBinary);
                    WriteMax(writer);
                    return;
                default:
                    throw new ArgumentOutOfRangeException(nameof(type));
            }
        }

        private static void WriteVariableLength(
            SqlKeyword keyword,
            int? length,
            SqlTextWriter writer)
        {
            writer.AppendKeyword(keyword);
            if (!length.HasValue || length.Value > 4000)
            {
                WriteMax(writer);
                return;
            }
            WriteLength(length.Value, writer);
        }

        private static void WriteDecimal(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            var precision = type.Precision ?? 38;
            var scale = type.Scale ?? 0;
            if (precision > 38 || scale > precision)
            {
                throw new UnsupportedDatabaseCapabilityException(
                    context.DialectProfile,
                    "sqlserver.decimal_precision_scale",
                    "$");
            }

            writer.AppendKeyword(SqlKeyword.Decimal);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(precision);
            writer.AppendComma();
            writer.AppendStructuralInt(scale);
            writer.AppendCloseParenthesis();
        }

        private static void WriteMax(SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            writer.AppendKeyword(SqlKeyword.Max);
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
