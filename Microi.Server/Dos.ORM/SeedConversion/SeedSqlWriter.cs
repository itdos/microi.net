using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.SeedConversion
{
    internal abstract class SeedSqlWriter
    {
        protected SeedSqlWriter(TextWriter output)
        {
            Output = output ?? throw new ArgumentNullException(nameof(output));
        }

        protected TextWriter Output { get; }

        protected virtual bool UsesTextEnvelope => false;

        internal static SeedSqlWriter Create(
            SeedDatabaseTarget target,
            TextWriter output)
        {
            switch (target)
            {
                case SeedDatabaseTarget.SqlServer2022:
                    return new SqlServerSeedSqlWriter(output);
                case SeedDatabaseTarget.PostgreSql17:
                    return new PostgreSqlSeedSqlWriter(output, false);
                case SeedDatabaseTarget.Oracle19c:
                    return new OracleSeedSqlWriter(output, false);
                case SeedDatabaseTarget.Dm8:
                    return new OracleSeedSqlWriter(output, true);
                case SeedDatabaseTarget.KingbaseEs:
                    return new PostgreSqlSeedSqlWriter(output, true);
                default:
                    throw new ArgumentOutOfRangeException(nameof(target));
            }
        }

        internal void Write(SeedDatabase database)
        {
            WriteHeader();
            WriteDrops(database);
            foreach (var table in database.Tables)
            {
                WriteCreateTable(table);
            }
            foreach (var insert in database.Inserts)
            {
                WriteInsert(insert);
            }
            foreach (var table in database.Tables)
            {
                WriteIndexes(table);
            }
            foreach (var table in database.Tables)
            {
                WriteForeignKeys(table);
            }
            foreach (var table in database.Tables)
            {
                WriteComments(table);
                WriteUpdateTimestampTriggers(table);
            }
            WriteFooter();
        }

        protected abstract void WriteHeader();

        protected abstract void WriteDrops(SeedDatabase database);

        protected abstract void WriteCreateTable(SeedTable table);

        protected abstract void WriteInsert(SeedInsert insert);

        protected abstract void WriteIndexes(SeedTable table);

        protected abstract void WriteForeignKeys(SeedTable table);

        protected abstract void WriteComments(SeedTable table);

        protected abstract void WriteUpdateTimestampTriggers(SeedTable table);

        protected virtual void WriteFooter()
        {
        }

        protected abstract string QuoteIdentifier(string value);

        protected abstract string MapType(SeedColumnType type);

        protected abstract string BooleanLiteral(bool value);

        protected abstract string CurrentTimestampLiteral { get; }

        protected abstract void WriteStringLiteral(string value, bool isLargeText);

        protected abstract void WriteBinaryLiteral(string hexadecimalValue);

        protected void WriteColumnDefinition(SeedColumn column)
        {
            Output.Write(QuoteIdentifier(column.Name));
            Output.Write(' ');
            Output.Write(MapType(column.Type));
            Output.Write(column.IsNullable ? " NULL" : " NOT NULL");
            if (column.DefaultValue != null)
            {
                Output.Write(" DEFAULT ");
                WriteDefault(column);
            }
        }

        protected void WriteDefault(SeedColumn column)
        {
            var value = column.DefaultValue;
            switch (value.Kind)
            {
                case SeedDefaultKind.Null:
                    Output.Write("NULL");
                    return;
                case SeedDefaultKind.CurrentTimestamp:
                    Output.Write(CurrentTimestampLiteral);
                    return;
                case SeedDefaultKind.Boolean:
                    Output.Write(BooleanLiteral(value.Value == "1"));
                    return;
                case SeedDefaultKind.Number:
                    if (column.Type.IsBoolean)
                    {
                        Output.Write(BooleanLiteral(value.Value != "0"));
                    }
                    else
                    {
                        Output.Write(value.Value);
                    }
                    return;
                case SeedDefaultKind.String:
                    if (column.Type.IsNumeric)
                    {
                        WriteNumericStringDefault(column, value.Value);
                    }
                    else
                    {
                        WriteTextValue(column, value.Value);
                    }
                    return;
                default:
                    throw new InvalidDataException("Unsupported seed default kind.");
            }
        }

        protected void WriteRowValue(SeedColumn column, SeedValue value)
        {
            if (value.Kind == SeedValueKind.Null)
            {
                Output.Write("NULL");
                return;
            }
            if (column.Type.IsBoolean)
            {
                if ((value.Kind != SeedValueKind.Boolean
                     && value.Kind != SeedValueKind.Number
                     && value.Kind != SeedValueKind.String)
                    || (value.Value != "0" && value.Value != "1"))
                {
                    throw InvalidValue(column, value, "boolean 0 or 1");
                }
                Output.Write(BooleanLiteral(value.Value == "1"));
                return;
            }
            if (column.Type.IsNumeric)
            {
                if (value.Kind != SeedValueKind.Number
                    && value.Kind != SeedValueKind.String)
                {
                    throw InvalidValue(column, value, "numeric value");
                }
                if (!decimal.TryParse(
                        value.Value,
                        NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                        CultureInfo.InvariantCulture,
                        out _))
                {
                    throw InvalidValue(column, value, "invariant numeric value");
                }
                Output.Write(value.Value);
                return;
            }
            if (column.Type.IsText)
            {
                if (value.Kind != SeedValueKind.String
                    && value.Kind != SeedValueKind.Number)
                {
                    throw InvalidValue(column, value, "text value");
                }
                WriteTextValue(column, value.Value);
                return;
            }
            if (string.Equals(column.Type.Name, "datetime", StringComparison.OrdinalIgnoreCase))
            {
                if (value.Kind != SeedValueKind.String
                    || !DateTime.TryParseExact(
                        value.Value,
                        new[]
                        {
                            "yyyy-MM-dd HH:mm:ss",
                            "yyyy-MM-dd HH:mm:ss.F",
                            "yyyy-MM-dd HH:mm:ss.FF",
                            "yyyy-MM-dd HH:mm:ss.FFF",
                            "yyyy-MM-dd HH:mm:ss.FFFF",
                            "yyyy-MM-dd HH:mm:ss.FFFFF",
                            "yyyy-MM-dd HH:mm:ss.FFFFFF"
                        },
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out _))
                {
                    throw InvalidValue(column, value, "MySQL datetime value");
                }
                WriteStringLiteral(value.Value, false);
                return;
            }
            if (string.Equals(column.Type.Name, "blob", StringComparison.OrdinalIgnoreCase))
            {
                if (value.Kind != SeedValueKind.Binary)
                {
                    throw InvalidValue(column, value, "MySQL 0x hexadecimal literal");
                }
                WriteBinaryLiteral(value.Value);
                return;
            }
            throw InvalidValue(column, value, "supported target value");
        }

        protected void WriteIndexColumnExpression(
            SeedIndexColumn column,
            Func<string, int, string> prefixExpression)
        {
            if (column.PrefixLength.HasValue)
            {
                Output.Write(prefixExpression(
                    QuoteIdentifier(column.Name),
                    column.PrefixLength.Value));
            }
            else
            {
                Output.Write(QuoteIdentifier(column.Name));
            }
        }

        protected void WriteColumnList(IReadOnlyList<SeedIndexColumn> columns)
        {
            for (var index = 0; index < columns.Count; index++)
            {
                if (index > 0)
                {
                    Output.Write(',');
                }
                if (columns[index].PrefixLength.HasValue)
                {
                    throw new InvalidDataException(
                        "Prefix lengths are unsupported in primary/foreign keys.");
                }
                Output.Write(QuoteIdentifier(columns[index].Name));
            }
        }

        protected static string GeneratedName(
            string prefix,
            string table,
            string column = null,
            int maximumLength = 120)
        {
            var value = prefix + "_" + table
                + (string.IsNullOrEmpty(column) ? string.Empty : "_" + column);
            if (value.Length <= maximumLength)
            {
                return value;
            }
            return value.Substring(0, maximumLength - 9)
                + "_" + StableHash(value).ToString("X8", CultureInfo.InvariantCulture);
        }

        protected static string EscapeSqlString(string value)
        {
            if (value.IndexOf('\0') >= 0)
            {
                throw new InvalidDataException(
                    "NUL characters cannot be represented in portable SQL text literals.");
            }
            return value.Replace("'", "''");
        }

        private void WriteTextValue(SeedColumn column, string value)
        {
            var physical = UsesTextEnvelope
                ? LogicalTextEnvelopeCodec.Encode(value)
                : value;
            var isBoundedText = string.Equals(
                    column.Type.Name,
                    "varchar",
                    StringComparison.OrdinalIgnoreCase)
                || string.Equals(
                    column.Type.Name,
                    "char",
                    StringComparison.OrdinalIgnoreCase);
            var isLarge = !isBoundedText
                || (column.Type.Arguments.Count > 0
                    && column.Type.Arguments[0] > 2000);
            WriteStringLiteral(physical, isLarge);
        }

        private void WriteNumericStringDefault(SeedColumn column, string value)
        {
            if (column.Type.IsBoolean)
            {
                if (value != "0" && value != "1")
                {
                    throw new InvalidDataException(
                        "Boolean default on column '" + column.Name
                        + "' must be 0 or 1.");
                }
                Output.Write(BooleanLiteral(value == "1"));
                return;
            }
            if (!decimal.TryParse(
                    value,
                    NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                    CultureInfo.InvariantCulture,
                    out _))
            {
                throw new InvalidDataException(
                    "Numeric default on column '" + column.Name
                    + "' is invalid: '" + value + "'.");
            }
            Output.Write(value);
        }

        private static InvalidDataException InvalidValue(
            SeedColumn column,
            SeedValue value,
            string expected)
        {
            return new InvalidDataException(
                "Column '" + column.Name + "' expected " + expected
                + ", but received " + value.Kind + ".");
        }

        private static uint StableHash(string value)
        {
            unchecked
            {
                uint hash = 2166136261;
                foreach (var character in value)
                {
                    hash ^= character;
                    hash *= 16777619;
                }
                return hash;
            }
        }
    }

    internal sealed class SqlServerSeedSqlWriter : SeedSqlWriter
    {
        internal SqlServerSeedSqlWriter(TextWriter output) : base(output)
        {
        }

        protected override string CurrentTimestampLiteral => "SYSDATETIME()";

        protected override void WriteHeader()
        {
            Output.WriteLine("-- Generated by Dos.ORM from the Microi MySQL 5.7 seed dump.");
            Output.WriteLine("SET NOCOUNT ON;");
            Output.WriteLine("SET XACT_ABORT ON;");
            Output.WriteLine();
        }

        protected override void WriteDrops(SeedDatabase database)
        {
            foreach (var table in database.Tables)
            {
                foreach (var foreignKey in table.ForeignKeys)
                {
                    Output.Write("IF OBJECT_ID(N'");
                    Output.Write(EscapeSqlString("dbo." + table.Name));
                    Output.Write("', N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'");
                    Output.Write(EscapeSqlString(foreignKey.Name));
                    Output.Write("' AND parent_object_id = OBJECT_ID(N'");
                    Output.Write(EscapeSqlString("dbo." + table.Name));
                    Output.Write("')) ALTER TABLE ");
                    Output.Write(Qualified(table.Name));
                    Output.Write(" DROP CONSTRAINT ");
                    Output.Write(QuoteIdentifier(foreignKey.Name));
                    Output.WriteLine(';');
                }
            }
            for (var index = database.Tables.Count - 1; index >= 0; index--)
            {
                Output.Write("DROP TABLE IF EXISTS ");
                Output.Write(Qualified(database.Tables[index].Name));
                Output.WriteLine(';');
            }
            Output.WriteLine("GO");
            Output.WriteLine();
        }

        protected override void WriteCreateTable(SeedTable table)
        {
            Output.Write("CREATE TABLE ");
            Output.Write(Qualified(table.Name));
            Output.WriteLine(" (");
            for (var index = 0; index < table.Columns.Count; index++)
            {
                Output.Write("  ");
                WriteColumnDefinition(table.Columns[index]);
                if (index < table.Columns.Count - 1 || table.PrimaryKey.Count > 0)
                {
                    Output.Write(',');
                }
                Output.WriteLine();
            }
            if (table.PrimaryKey.Count > 0)
            {
                Output.Write("  PRIMARY KEY (");
                WriteColumnList(table.PrimaryKey);
                Output.WriteLine(")");
            }
            Output.WriteLine(");");
            Output.WriteLine("GO");
            Output.WriteLine();
        }

        protected override void WriteInsert(SeedInsert insert)
        {
            const int maximumRows = 1000;
            for (var start = 0; start < insert.Rows.Count; start += maximumRows)
            {
                var count = Math.Min(maximumRows, insert.Rows.Count - start);
                Output.Write("INSERT INTO ");
                Output.Write(Qualified(insert.Table.Name));
                Output.Write(" (");
                WriteInsertColumnNames(insert.Columns);
                Output.WriteLine(") VALUES");
                for (var offset = 0; offset < count; offset++)
                {
                    WriteInsertRow(insert, start + offset);
                    Output.WriteLine(offset == count - 1 ? ";" : ",");
                }
                Output.WriteLine("GO");
            }
            Output.WriteLine();
        }

        protected override void WriteIndexes(SeedTable table)
        {
            foreach (var index in table.Indexes)
            {
                var mappedColumns = new List<string>();
                for (var columnIndex = 0; columnIndex < index.Columns.Count; columnIndex++)
                {
                    var column = index.Columns[columnIndex];
                    if (column.PrefixLength.HasValue)
                    {
                        var computed = GeneratedName(
                            "MCI_IDX", index.Name,
                            column.Name + "_" + columnIndex);
                        Output.Write("ALTER TABLE ");
                        Output.Write(Qualified(table.Name));
                        Output.Write(" ADD ");
                        Output.Write(QuoteIdentifier(computed));
                        Output.Write(" AS LEFT(");
                        Output.Write(QuoteIdentifier(column.Name));
                        Output.Write(',');
                        Output.Write(column.PrefixLength.Value.ToString(
                            CultureInfo.InvariantCulture));
                        Output.WriteLine(") PERSISTED;");
                        mappedColumns.Add(QuoteIdentifier(computed));
                    }
                    else
                    {
                        mappedColumns.Add(QuoteIdentifier(column.Name));
                    }
                }
                Output.Write("CREATE ");
                if (index.IsUnique)
                {
                    Output.Write("UNIQUE ");
                }
                Output.Write("INDEX ");
                Output.Write(QuoteIdentifier(index.Name));
                Output.Write(" ON ");
                Output.Write(Qualified(table.Name));
                Output.Write(" (");
                Output.Write(string.Join(",", mappedColumns));
                Output.WriteLine(");");
            }
            if (table.Indexes.Count > 0)
            {
                Output.WriteLine("GO");
                Output.WriteLine();
            }
        }

        protected override void WriteForeignKeys(SeedTable table)
        {
            foreach (var foreignKey in table.ForeignKeys)
            {
                Output.Write("ALTER TABLE ");
                Output.Write(Qualified(table.Name));
                Output.Write(" ADD CONSTRAINT ");
                Output.Write(QuoteIdentifier(foreignKey.Name));
                Output.Write(" FOREIGN KEY (");
                WriteColumnList(foreignKey.Columns);
                Output.Write(") REFERENCES ");
                Output.Write(Qualified(foreignKey.ReferencedTable));
                Output.Write(" (");
                WriteColumnList(foreignKey.ReferencedColumns);
                Output.WriteLine(");");
            }
            if (table.ForeignKeys.Count > 0)
            {
                Output.WriteLine("GO");
                Output.WriteLine();
            }
        }

        protected override void WriteComments(SeedTable table)
        {
            var wroteComment = false;
            if (table.Comment != null)
            {
                WriteExtendedProperty(table.Name, null, table.Comment);
                wroteComment = true;
            }
            foreach (var column in table.Columns)
            {
                if (column.Comment != null)
                {
                    WriteExtendedProperty(table.Name, column.Name, column.Comment);
                    wroteComment = true;
                }
            }
            if (wroteComment)
            {
                Output.WriteLine("GO");
                Output.WriteLine();
            }
        }

        protected override void WriteUpdateTimestampTriggers(SeedTable table)
        {
            foreach (var column in table.Columns)
            {
                if (!column.UpdateWithCurrentTimestamp)
                {
                    continue;
                }
                if (table.PrimaryKey.Count == 0)
                {
                    throw new InvalidDataException(
                        "ON UPDATE CURRENT_TIMESTAMP requires a primary key on table '"
                        + table.Name + "'.");
                }
                var triggerName = GeneratedName("TRG", table.Name, column.Name);
                Output.Write("CREATE TRIGGER ");
                Output.Write(QuoteIdentifier(triggerName));
                Output.Write(" ON ");
                Output.Write(Qualified(table.Name));
                Output.WriteLine(" AFTER UPDATE AS");
                Output.WriteLine("BEGIN");
                Output.WriteLine("  SET NOCOUNT ON;");
                Output.WriteLine("  IF TRIGGER_NESTLEVEL() > 1 RETURN;");
                Output.Write("  UPDATE target SET ");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" = SYSDATETIME() FROM ");
                Output.Write(Qualified(table.Name));
                Output.Write(" AS target INNER JOIN inserted AS source ON ");
                for (var index = 0; index < table.PrimaryKey.Count; index++)
                {
                    if (index > 0)
                    {
                        Output.Write(" AND ");
                    }
                    Output.Write("target.");
                    Output.Write(QuoteIdentifier(table.PrimaryKey[index].Name));
                    Output.Write(" = source.");
                    Output.Write(QuoteIdentifier(table.PrimaryKey[index].Name));
                }
                Output.Write(" INNER JOIN deleted AS prior ON ");
                for (var index = 0; index < table.PrimaryKey.Count; index++)
                {
                    if (index > 0)
                    {
                        Output.Write(" AND ");
                    }
                    Output.Write("prior.");
                    Output.Write(QuoteIdentifier(table.PrimaryKey[index].Name));
                    Output.Write(" = source.");
                    Output.Write(QuoteIdentifier(table.PrimaryKey[index].Name));
                }
                Output.Write(" WHERE (source.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" = prior.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" OR (source.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS NULL AND prior.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS NULL))");
                Output.WriteLine(';');
                Output.WriteLine("END;");
                Output.WriteLine("GO");
                Output.WriteLine();
            }
        }

        protected override string QuoteIdentifier(string value)
        {
            return "[" + value.Replace("]", "]]" ) + "]";
        }

        protected override string MapType(SeedColumnType type)
        {
            switch (type.Name)
            {
                case "char":
                case "varchar":
                    return type.Arguments[0] <= 4000
                        ? "NVARCHAR(" + type.Arguments[0] + ")"
                        : "NVARCHAR(MAX)";
                case "mediumtext":
                case "longtext": return "NVARCHAR(MAX)";
                case "tinyint": return "SMALLINT";
                case "smallint": return "SMALLINT";
                case "int": return "INT";
                case "bigint": return "BIGINT";
                case "bit": return "BIT";
                case "decimal": return "DECIMAL(" + type.Arguments[0] + "," + type.Arguments[1] + ")";
                case "datetime": return "DATETIME2(6)";
                case "blob": return "VARBINARY(MAX)";
                default: throw UnsupportedType(type);
            }
        }

        protected override string BooleanLiteral(bool value)
        {
            return value ? "1" : "0";
        }

        protected override void WriteStringLiteral(string value, bool isLargeText)
        {
            WriteChunkedUnicodeLiteral(value, "CAST(", " AS NVARCHAR(MAX))", " + ");
        }

        protected override void WriteBinaryLiteral(string hexadecimalValue)
        {
            Output.Write("0x");
            Output.Write(hexadecimalValue);
        }

        private void WriteInsertColumnNames(IReadOnlyList<SeedColumn> columns)
        {
            for (var index = 0; index < columns.Count; index++)
            {
                if (index > 0) Output.Write(',');
                Output.Write(QuoteIdentifier(columns[index].Name));
            }
        }

        private void WriteInsertRow(SeedInsert insert, int rowIndex)
        {
            Output.Write('(');
            for (var index = 0; index < insert.Columns.Count; index++)
            {
                if (index > 0) Output.Write(',');
                WriteRowValue(insert.Columns[index], insert.Rows[rowIndex][index]);
            }
            Output.Write(')');
        }

        private void WriteExtendedProperty(
            string table,
            string column,
            string comment)
        {
            Output.Write("EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'");
            Output.Write(EscapeSqlString(comment));
            Output.Write("', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'");
            Output.Write(EscapeSqlString(table));
            Output.Write('\'');
            if (column != null)
            {
                Output.Write(", @level2type=N'COLUMN', @level2name=N'");
                Output.Write(EscapeSqlString(column));
                Output.Write('\'');
            }
            Output.WriteLine(';');
        }

        private void WriteChunkedUnicodeLiteral(
            string value,
            string firstPrefix,
            string firstSuffix,
            string separator)
        {
            const int chunkSize = 3500;
            if (value.Length <= chunkSize)
            {
                Output.Write("N'");
                Output.Write(EscapeSqlString(value));
                Output.Write('\'');
                return;
            }
            var start = 0;
            var first = true;
            while (start < value.Length)
            {
                var length = Math.Min(chunkSize, value.Length - start);
                if (start + length < value.Length
                    && char.IsHighSurrogate(value[start + length - 1]))
                {
                    length--;
                }
                if (!first) Output.Write(separator);
                if (first) Output.Write(firstPrefix);
                Output.Write("N'");
                Output.Write(EscapeSqlString(value.Substring(start, length)));
                Output.Write('\'');
                if (first) Output.Write(firstSuffix);
                first = false;
                start += length;
            }
        }

        private string Qualified(string table)
        {
            return "[dbo]." + QuoteIdentifier(table);
        }

        private static InvalidDataException UnsupportedType(SeedColumnType type)
        {
            return new InvalidDataException("Unsupported SQL Server seed type '" + type.Name + "'.");
        }
    }

    internal sealed class PostgreSqlSeedSqlWriter : SeedSqlWriter
    {
        private readonly bool _kingbase;

        internal PostgreSqlSeedSqlWriter(TextWriter output, bool kingbase)
            : base(output)
        {
            _kingbase = kingbase;
        }

        protected override string CurrentTimestampLiteral => "CURRENT_TIMESTAMP";

        protected override void WriteHeader()
        {
            Output.WriteLine("-- Generated by Dos.ORM from the Microi MySQL 5.7 seed dump.");
            Output.WriteLine("SET standard_conforming_strings = on;");
            Output.WriteLine();
        }

        protected override void WriteDrops(SeedDatabase database)
        {
            for (var index = database.Tables.Count - 1; index >= 0; index--)
            {
                Output.Write("DROP TABLE IF EXISTS ");
                Output.Write(QuoteIdentifier(database.Tables[index].Name));
                Output.WriteLine(" CASCADE;");
            }
            Output.WriteLine();
        }

        protected override void WriteCreateTable(SeedTable table)
        {
            Output.Write("CREATE TABLE ");
            Output.Write(QuoteIdentifier(table.Name));
            Output.WriteLine(" (");
            for (var index = 0; index < table.Columns.Count; index++)
            {
                Output.Write("  ");
                WriteColumnDefinition(table.Columns[index]);
                if (index < table.Columns.Count - 1 || table.PrimaryKey.Count > 0)
                {
                    Output.Write(',');
                }
                Output.WriteLine();
            }
            if (table.PrimaryKey.Count > 0)
            {
                Output.Write("  PRIMARY KEY (");
                WriteColumnList(table.PrimaryKey);
                Output.WriteLine(")");
            }
            Output.WriteLine(");");
            Output.WriteLine();
        }

        protected override void WriteInsert(SeedInsert insert)
        {
            Output.Write("INSERT INTO ");
            Output.Write(QuoteIdentifier(insert.Table.Name));
            Output.Write(" (");
            for (var index = 0; index < insert.Columns.Count; index++)
            {
                if (index > 0) Output.Write(',');
                Output.Write(QuoteIdentifier(insert.Columns[index].Name));
            }
            Output.WriteLine(") VALUES");
            for (var row = 0; row < insert.Rows.Count; row++)
            {
                Output.Write('(');
                for (var column = 0; column < insert.Columns.Count; column++)
                {
                    if (column > 0) Output.Write(',');
                    WriteRowValue(insert.Columns[column], insert.Rows[row][column]);
                }
                Output.WriteLine(row == insert.Rows.Count - 1 ? ");" : "),");
            }
            Output.WriteLine();
        }

        protected override void WriteIndexes(SeedTable table)
        {
            foreach (var index in table.Indexes)
            {
                Output.Write("CREATE ");
                if (index.IsUnique) Output.Write("UNIQUE ");
                Output.Write("INDEX ");
                Output.Write(QuoteIdentifier(index.Name));
                Output.Write(" ON ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" (");
                for (var column = 0; column < index.Columns.Count; column++)
                {
                    if (column > 0) Output.Write(',');
                    WriteIndexColumnExpression(
                        index.Columns[column],
                        (name, length) => "LEFT(" + name + "," + length + ")");
                }
                Output.WriteLine(");");
            }
            if (table.Indexes.Count > 0) Output.WriteLine();
        }

        protected override void WriteForeignKeys(SeedTable table)
        {
            foreach (var foreignKey in table.ForeignKeys)
            {
                Output.Write("ALTER TABLE ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" ADD CONSTRAINT ");
                Output.Write(QuoteIdentifier(foreignKey.Name));
                Output.Write(" FOREIGN KEY (");
                WriteColumnList(foreignKey.Columns);
                Output.Write(") REFERENCES ");
                Output.Write(QuoteIdentifier(foreignKey.ReferencedTable));
                Output.Write(" (");
                WriteColumnList(foreignKey.ReferencedColumns);
                Output.WriteLine(");");
            }
            if (table.ForeignKeys.Count > 0) Output.WriteLine();
        }

        protected override void WriteComments(SeedTable table)
        {
            if (table.Comment != null)
            {
                Output.Write("COMMENT ON TABLE ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" IS '");
                Output.Write(EscapeSqlString(table.Comment));
                Output.WriteLine("';");
            }
            foreach (var column in table.Columns)
            {
                if (column.Comment == null) continue;
                Output.Write("COMMENT ON COLUMN ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write('.');
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS '");
                Output.Write(EscapeSqlString(column.Comment));
                Output.WriteLine("';");
            }
            if (table.Comment != null || table.Columns.Exists(column => column.Comment != null))
            {
                Output.WriteLine();
            }
        }

        protected override void WriteUpdateTimestampTriggers(SeedTable table)
        {
            foreach (var column in table.Columns)
            {
                if (!column.UpdateWithCurrentTimestamp) continue;
                var triggerName = GeneratedName("TRG", table.Name, column.Name);
                var functionName = GeneratedName("FN", table.Name, column.Name);
                Output.Write("CREATE OR REPLACE FUNCTION ");
                Output.Write(QuoteIdentifier(functionName));
                Output.WriteLine("() RETURNS trigger AS $$");
                Output.WriteLine("BEGIN");
                Output.Write("  IF NEW.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS NOT DISTINCT FROM OLD.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.WriteLine(" THEN");
                Output.Write("    NEW.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.WriteLine(" := CURRENT_TIMESTAMP;");
                Output.WriteLine("  END IF;");
                Output.WriteLine("  RETURN NEW;");
                Output.WriteLine("END;");
                Output.WriteLine("$$ LANGUAGE plpgsql;");
                Output.Write("CREATE TRIGGER ");
                Output.Write(QuoteIdentifier(triggerName));
                Output.Write(" BEFORE UPDATE ON ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" FOR EACH ROW EXECUTE FUNCTION ");
                Output.Write(QuoteIdentifier(functionName));
                Output.WriteLine("();");
                Output.WriteLine();
            }
        }

        protected override string QuoteIdentifier(string value)
        {
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }

        protected override string MapType(SeedColumnType type)
        {
            switch (type.Name)
            {
                case "char":
                case "varchar": return "VARCHAR(" + type.Arguments[0] + ")";
                case "mediumtext":
                case "longtext": return "TEXT";
                case "tinyint":
                case "smallint": return "SMALLINT";
                case "int": return "INTEGER";
                case "bigint": return "BIGINT";
                case "bit": return "BOOLEAN";
                case "decimal": return "NUMERIC(" + type.Arguments[0] + "," + type.Arguments[1] + ")";
                case "datetime": return "TIMESTAMP(6) WITHOUT TIME ZONE";
                case "blob": return "BYTEA";
                default:
                    throw new InvalidDataException(
                        "Unsupported " + (_kingbase ? "KingbaseES" : "PostgreSQL")
                        + " seed type '" + type.Name + "'.");
            }
        }

        protected override string BooleanLiteral(bool value)
        {
            return value ? "TRUE" : "FALSE";
        }

        protected override void WriteStringLiteral(string value, bool isLargeText)
        {
            Output.Write('\'');
            Output.Write(EscapeSqlString(value));
            Output.Write('\'');
        }

        protected override void WriteBinaryLiteral(string hexadecimalValue)
        {
            Output.Write("decode('");
            Output.Write(hexadecimalValue);
            Output.Write("','hex')");
        }
    }

    internal sealed class OracleSeedSqlWriter : SeedSqlWriter
    {
        private readonly bool _dm;

        internal OracleSeedSqlWriter(TextWriter output, bool dm) : base(output)
        {
            _dm = dm;
        }

        protected override bool UsesTextEnvelope => !_dm;

        protected override string CurrentTimestampLiteral => "CURRENT_TIMESTAMP";

        protected override void WriteHeader()
        {
            Output.WriteLine("-- Generated by Dos.ORM from the Microi MySQL 5.7 seed dump.");
            if (_dm)
            {
                Output.WriteLine("-- DM8 preserves native non-null and empty text without an envelope.");
                Output.WriteLine("-- RequiresNonEmptyEnvelopeRuntime=false");
            }
            else
            {
                Output.WriteLine("-- Non-null text uses Dos.ORM NonEmptyEnvelopeV1 (U+E000 prefix).");
                Output.WriteLine("-- RequiresNonEmptyEnvelopeRuntime=true");
                Output.WriteLine("-- Do not connect a legacy runtime that lacks parameter encoding and result decoding.");
            }
            Output.WriteLine("SET DEFINE OFF");
            Output.WriteLine();
        }

        protected override void WriteDrops(SeedDatabase database)
        {
            for (var index = database.Tables.Count - 1; index >= 0; index--)
            {
                Output.WriteLine("BEGIN");
                Output.Write("  EXECUTE IMMEDIATE 'DROP TABLE ");
                Output.Write(QuoteIdentifier(database.Tables[index].Name).Replace("'", "''"));
                Output.WriteLine(" CASCADE CONSTRAINTS PURGE';");
                Output.WriteLine("EXCEPTION WHEN OTHERS THEN");
                Output.Write("  IF SQLCODE != ");
                Output.Write(_dm ? "-2106" : "-942");
                Output.WriteLine(" THEN RAISE; END IF;");
                Output.WriteLine("END;");
                Output.WriteLine("/");
            }
            Output.WriteLine();
        }

        protected override void WriteCreateTable(SeedTable table)
        {
            Output.Write("CREATE TABLE ");
            Output.Write(QuoteIdentifier(table.Name));
            Output.WriteLine(" (");
            for (var index = 0; index < table.Columns.Count; index++)
            {
                Output.Write("  ");
                WriteColumnDefinition(table.Columns[index]);
                if (index < table.Columns.Count - 1 || table.PrimaryKey.Count > 0)
                {
                    Output.Write(',');
                }
                Output.WriteLine();
            }
            if (table.PrimaryKey.Count > 0)
            {
                Output.Write("  PRIMARY KEY (");
                WriteColumnList(table.PrimaryKey);
                Output.WriteLine(")");
            }
            Output.WriteLine(");");
            Output.WriteLine();
        }

        protected override void WriteInsert(SeedInsert insert)
        {
            foreach (var row in insert.Rows)
            {
                Output.Write("INSERT INTO ");
                Output.Write(QuoteIdentifier(insert.Table.Name));
                Output.Write(" (");
                for (var index = 0; index < insert.Columns.Count; index++)
                {
                    if (index > 0) Output.Write(',');
                    Output.Write(QuoteIdentifier(insert.Columns[index].Name));
                }
                Output.Write(") VALUES (");
                for (var index = 0; index < insert.Columns.Count; index++)
                {
                    if (index > 0) Output.Write(',');
                    WriteRowValue(insert.Columns[index], row[index]);
                }
                Output.WriteLine(");");
            }
            Output.WriteLine();
        }

        protected override void WriteIndexes(SeedTable table)
        {
            foreach (var index in table.Indexes)
            {
                Output.Write("CREATE ");
                if (index.IsUnique) Output.Write("UNIQUE ");
                Output.Write("INDEX ");
                Output.Write(QuoteIdentifier(index.Name));
                Output.Write(" ON ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" (");
                for (var column = 0; column < index.Columns.Count; column++)
                {
                    if (column > 0) Output.Write(',');
                    WriteIndexColumnExpression(
                        index.Columns[column],
                        (name, length) => "SUBSTR(" + name + ",1," + length + ")");
                }
                Output.WriteLine(");");
            }
            if (table.Indexes.Count > 0) Output.WriteLine();
        }

        protected override void WriteForeignKeys(SeedTable table)
        {
            foreach (var foreignKey in table.ForeignKeys)
            {
                Output.Write("ALTER TABLE ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" ADD CONSTRAINT ");
                Output.Write(QuoteIdentifier(foreignKey.Name));
                Output.Write(" FOREIGN KEY (");
                WriteColumnList(foreignKey.Columns);
                Output.Write(") REFERENCES ");
                Output.Write(QuoteIdentifier(foreignKey.ReferencedTable));
                Output.Write(" (");
                WriteColumnList(foreignKey.ReferencedColumns);
                Output.WriteLine(");");
            }
            if (table.ForeignKeys.Count > 0) Output.WriteLine();
        }

        protected override void WriteComments(SeedTable table)
        {
            if (table.Comment != null)
            {
                Output.Write("COMMENT ON TABLE ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write(" IS '");
                Output.Write(EscapeSqlString(table.Comment));
                Output.WriteLine("';");
            }
            foreach (var column in table.Columns)
            {
                if (column.Comment == null) continue;
                Output.Write("COMMENT ON COLUMN ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.Write('.');
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS '");
                Output.Write(EscapeSqlString(column.Comment));
                Output.WriteLine("';");
            }
            if (table.Comment != null || table.Columns.Exists(column => column.Comment != null))
            {
                Output.WriteLine();
            }
        }

        protected override void WriteUpdateTimestampTriggers(SeedTable table)
        {
            foreach (var column in table.Columns)
            {
                if (!column.UpdateWithCurrentTimestamp) continue;
                var triggerName = GeneratedName("TRG", table.Name, column.Name);
                Output.Write("CREATE OR REPLACE TRIGGER ");
                Output.Write(QuoteIdentifier(triggerName));
                Output.Write(" BEFORE UPDATE ON ");
                Output.Write(QuoteIdentifier(table.Name));
                Output.WriteLine(" FOR EACH ROW");
                Output.WriteLine("BEGIN");
                Output.Write("  IF (:NEW.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" = :OLD.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(") OR (:NEW.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.Write(" IS NULL AND :OLD.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.WriteLine(" IS NULL) THEN");
                Output.Write("    :NEW.");
                Output.Write(QuoteIdentifier(column.Name));
                Output.WriteLine(" := CURRENT_TIMESTAMP;");
                Output.WriteLine("  END IF;");
                Output.WriteLine("END;");
                Output.WriteLine("/");
                Output.WriteLine();
            }
        }

        protected override string QuoteIdentifier(string value)
        {
            if (_dm && string.Equals(value, "RowId", StringComparison.OrdinalIgnoreCase))
            {
                value = "Row_Id";
            }
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }

        protected override string MapType(SeedColumnType type)
        {
            switch (type.Name)
            {
                case "char":
                case "varchar":
                    var physicalLength = _dm
                        ? type.Arguments[0]
                        : type.Arguments[0] + 1;
                    return physicalLength <= 2000
                        ? "NVARCHAR2(" + physicalLength + ")"
                        : "NCLOB";
                case "mediumtext":
                case "longtext": return "NCLOB";
                case "tinyint": return "NUMBER(3)";
                case "smallint": return "NUMBER(5)";
                case "int": return "NUMBER(10)";
                case "bigint": return "NUMBER(19)";
                case "bit": return "NUMBER(1)";
                case "decimal": return "NUMBER(" + type.Arguments[0] + "," + type.Arguments[1] + ")";
                case "datetime": return "TIMESTAMP(6)";
                case "blob": return "BLOB";
                default:
                    throw new InvalidDataException(
                        "Unsupported " + (_dm ? "DM8" : "Oracle")
                        + " seed type '" + type.Name + "'.");
            }
        }

        protected override string BooleanLiteral(bool value)
        {
            return value ? "1" : "0";
        }

        protected override void WriteStringLiteral(string value, bool isLargeText)
        {
            const int chunkSize = 1000;
            char? carriageReturnPlaceholder;
            char? lineFeedPlaceholder;
            var encoded = EncodePhysicalLineBreaks(
                value,
                out carriageReturnPlaceholder,
                out lineFeedPlaceholder);
            if (encoded.Length <= chunkSize && !isLargeText)
            {
                WriteTextChunk(
                    encoded,
                    false,
                    carriageReturnPlaceholder,
                    lineFeedPlaceholder);
                return;
            }

            if (encoded.Length == 0)
            {
                WriteTextChunk(
                    string.Empty,
                    true,
                    carriageReturnPlaceholder,
                    lineFeedPlaceholder);
                return;
            }

            var start = 0;
            var first = true;
            while (start < encoded.Length)
            {
                var length = Math.Min(chunkSize, encoded.Length - start);
                if (start + length < encoded.Length
                    && char.IsHighSurrogate(encoded[start + length - 1]))
                {
                    length--;
                }
                WriteExpressionSeparator(ref first);
                WriteTextChunk(
                    encoded.Substring(start, length),
                    true,
                    carriageReturnPlaceholder,
                    lineFeedPlaceholder);
                start += length;
            }
        }

        private void WriteExpressionSeparator(ref bool first)
        {
            if (!first)
            {
                Output.Write(" || ");
            }
            first = false;
        }

        private void WriteTextChunk(
            string value,
            bool isLargeText,
            char? carriageReturnPlaceholder,
            char? lineFeedPlaceholder)
        {
            var restoreCarriageReturn = carriageReturnPlaceholder.HasValue
                && value.IndexOf(carriageReturnPlaceholder.Value) >= 0;
            var restoreLineFeed = lineFeedPlaceholder.HasValue
                && value.IndexOf(lineFeedPlaceholder.Value) >= 0;
            if (restoreCarriageReturn)
            {
                Output.Write("REPLACE(");
            }
            if (restoreLineFeed)
            {
                Output.Write("REPLACE(");
            }

            if (isLargeText)
            {
                WriteLargeTextChunk(value);
            }
            else
            {
                Output.Write("N'");
                Output.Write(EscapeSqlString(value));
                Output.Write('\'');
            }

            if (restoreLineFeed)
            {
                Output.Write(",N'");
                Output.Write(lineFeedPlaceholder.Value);
                Output.Write("',CHR(10))");
            }
            if (restoreCarriageReturn)
            {
                Output.Write(",N'");
                Output.Write(carriageReturnPlaceholder.Value);
                Output.Write("',CHR(13))");
            }
        }

        private static string EncodePhysicalLineBreaks(
            string value,
            out char? carriageReturnPlaceholder,
            out char? lineFeedPlaceholder)
        {
            carriageReturnPlaceholder = null;
            lineFeedPlaceholder = null;
            if (value.IndexOf('\r') >= 0)
            {
                carriageReturnPlaceholder = FindUnusedPrivateUsePlaceholder(
                    value,
                    null);
            }
            if (value.IndexOf('\n') >= 0)
            {
                lineFeedPlaceholder = FindUnusedPrivateUsePlaceholder(
                    value,
                    carriageReturnPlaceholder);
            }
            if (!carriageReturnPlaceholder.HasValue
                && !lineFeedPlaceholder.HasValue)
            {
                return value;
            }

            var encoded = value;
            if (carriageReturnPlaceholder.HasValue)
            {
                encoded = encoded.Replace(
                    '\r',
                    carriageReturnPlaceholder.Value);
            }
            if (lineFeedPlaceholder.HasValue)
            {
                encoded = encoded.Replace(
                    '\n',
                    lineFeedPlaceholder.Value);
            }
            return encoded;
        }

        private static char FindUnusedPrivateUsePlaceholder(
            string value,
            char? reserved)
        {
            // U+E000 is reserved by Dos.ORM NonEmptyEnvelopeV1. Keep seed
            // transport placeholders separate so DM8 never looks enveloped.
            for (var codePoint = 0xE001; codePoint <= 0xF8FF; codePoint++)
            {
                var candidate = (char)codePoint;
                if ((!reserved.HasValue || candidate != reserved.Value)
                    && value.IndexOf(candidate) < 0)
                {
                    return candidate;
                }
            }
            throw new InvalidDataException(
                "A collision-free private-use placeholder could not be allocated "
                + "for an Oracle/DM seed text value containing physical line breaks.");
        }

        private void WriteLargeTextChunk(string value)
        {
            if (_dm)
            {
                Output.Write("TO_CLOB(N'");
                Output.Write(EscapeSqlString(value));
                Output.Write("')");
            }
            else
            {
                Output.Write("TO_NCLOB(N'");
                Output.Write(EscapeSqlString(value));
                Output.Write("')");
            }
        }

        protected override void WriteBinaryLiteral(string hexadecimalValue)
        {
            Output.Write("HEXTORAW('");
            Output.Write(hexadecimalValue);
            Output.Write("')");
        }
    }
}
