using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Dos.ORM.SeedConversion
{
    internal sealed class MySql57DumpParser
    {
        internal SeedDatabase Parse(TextReader reader)
        {
            if (reader == null)
            {
                throw new ArgumentNullException(nameof(reader));
            }

            var database = new SeedDatabase();
            var statementNumber = 0;
            foreach (var statement in SplitStatements(reader.ReadToEnd()))
            {
                statementNumber++;
                try
                {
                    ParseStatement(statement, database);
                }
                catch (SeedConversionException)
                {
                    throw;
                }
                catch (Exception error)
                {
                    throw new SeedConversionException(
                        statementNumber,
                        error.Message + " Near: " + Preview(statement),
                        error);
                }
            }

            Validate(database, statementNumber);
            return database;
        }

        private static void ParseStatement(string statement, SeedDatabase database)
        {
            var lexer = new SeedLexer(statement);
            if (lexer.TryReadKeyword("SET"))
            {
                ParseSet(lexer);
            }
            else if (lexer.TryReadKeyword("DROP"))
            {
                ParseDrop(lexer);
            }
            else if (lexer.TryReadKeyword("CREATE"))
            {
                ParseCreateTable(lexer, database);
            }
            else if (lexer.TryReadKeyword("INSERT"))
            {
                ParseInsert(lexer, database);
            }
            else
            {
                throw new InvalidDataException(
                    "Unsupported statement '" + lexer.Peek().Text + "'.");
            }
            lexer.ExpectEnd();
        }

        private static void ParseSet(SeedLexer lexer)
        {
            if (lexer.TryReadKeyword("NAMES"))
            {
                var encoding = lexer.ReadIdentifier();
                if (!string.Equals(encoding, "utf8mb4", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(encoding, "utf8", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidDataException(
                        "Only SET NAMES utf8/utf8mb4 is supported.");
                }
                return;
            }

            if (lexer.TryReadKeyword("FOREIGN_KEY_CHECKS"))
            {
                lexer.ExpectSymbol("=");
                var value = lexer.ReadNumber();
                if (value != "0" && value != "1")
                {
                    throw new InvalidDataException(
                        "FOREIGN_KEY_CHECKS must be 0 or 1.");
                }
                return;
            }

            throw new InvalidDataException(
                "Only SET NAMES and SET FOREIGN_KEY_CHECKS are supported.");
        }

        private static void ParseDrop(SeedLexer lexer)
        {
            lexer.ExpectKeyword("TABLE");
            lexer.ExpectKeyword("IF");
            lexer.ExpectKeyword("EXISTS");
            lexer.ReadIdentifier();
        }

        private static void ParseCreateTable(
            SeedLexer lexer,
            SeedDatabase database)
        {
            lexer.ExpectKeyword("TABLE");
            var table = new SeedTable(lexer.ReadIdentifier());
            if (database.TablesByName.ContainsKey(table.Name))
            {
                throw new InvalidDataException(
                    "Duplicate table '" + table.Name + "'.");
            }

            lexer.ExpectSymbol("(");
            while (!lexer.TryReadSymbol(")"))
            {
                if (lexer.Peek().Kind == SeedTokenKind.QuotedIdentifier)
                {
                    ParseColumn(lexer, table);
                }
                else if (lexer.TryReadKeyword("PRIMARY"))
                {
                    lexer.ExpectKeyword("KEY");
                    table.PrimaryKey.AddRange(ParseIndexColumns(lexer));
                    ParseOptionalUsingBtree(lexer);
                }
                else if (lexer.TryReadKeyword("UNIQUE"))
                {
                    lexer.ExpectKeyword("KEY");
                    ParseIndex(lexer, table, true);
                }
                else if (lexer.TryReadKeyword("KEY"))
                {
                    ParseIndex(lexer, table, false);
                }
                else if (lexer.TryReadKeyword("CONSTRAINT"))
                {
                    ParseForeignKey(lexer, table);
                }
                else
                {
                    throw new InvalidDataException(
                        "Unsupported CREATE TABLE definition '"
                        + lexer.Peek().Text + "'.");
                }

                if (lexer.TryReadSymbol(","))
                {
                    continue;
                }
                lexer.ExpectSymbol(")");
                break;
            }

            while (!lexer.IsEnd)
            {
                if (lexer.TryReadKeyword("ENGINE"))
                {
                    lexer.ExpectSymbol("=");
                    var engine = lexer.ReadIdentifier();
                    if (!string.Equals(engine, "InnoDB", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException(
                            "Only the InnoDB table engine is supported.");
                    }
                }
                else if (lexer.TryReadKeyword("DEFAULT"))
                {
                    lexer.ExpectKeyword("CHARSET");
                    lexer.ExpectSymbol("=");
                    ReadSupportedCharacterSet(lexer);
                }
                else if (lexer.TryReadKeyword("CHARSET"))
                {
                    lexer.ExpectSymbol("=");
                    ReadSupportedCharacterSet(lexer);
                }
                else if (lexer.TryReadKeyword("COLLATE"))
                {
                    lexer.ExpectSymbol("=");
                    ReadSupportedCollation(lexer);
                }
                else if (lexer.TryReadKeyword("COMMENT"))
                {
                    lexer.ExpectSymbol("=");
                    table.Comment = lexer.ReadString();
                }
                else
                {
                    throw new InvalidDataException(
                        "Unsupported table option '" + lexer.Peek().Text + "'.");
                }
            }

            if (table.Columns.Count == 0)
            {
                throw new InvalidDataException(
                    "Table '" + table.Name + "' has no columns.");
            }
            database.Tables.Add(table);
            database.TablesByName.Add(table.Name, table);
        }

        private static void ParseColumn(SeedLexer lexer, SeedTable table)
        {
            var name = lexer.ReadIdentifier();
            var typeName = lexer.ReadWord().ToLowerInvariant();
            var arguments = new List<int>();
            if (lexer.TryReadSymbol("("))
            {
                do
                {
                    arguments.Add(ParsePositiveInt(lexer.ReadNumber(), "type argument"));
                }
                while (lexer.TryReadSymbol(","));
                lexer.ExpectSymbol(")");
            }
            EnsureSupportedType(typeName, arguments);

            var column = new SeedColumn(
                name,
                new SeedColumnType(typeName, arguments.AsReadOnly()));
            if (table.ColumnsByName.ContainsKey(name))
            {
                throw new InvalidDataException(
                    "Duplicate column '" + name + "' in table '" + table.Name + "'.");
            }

            while (!lexer.IsEnd
                   && !lexer.PeekSymbol(",")
                   && !lexer.PeekSymbol(")"))
            {
                if (lexer.TryReadKeyword("NOT"))
                {
                    lexer.ExpectKeyword("NULL");
                    column.IsNullable = false;
                }
                else if (lexer.TryReadKeyword("NULL"))
                {
                    column.IsNullable = true;
                }
                else if (lexer.TryReadKeyword("DEFAULT"))
                {
                    column.DefaultValue = ParseDefault(lexer);
                }
                else if (lexer.TryReadKeyword("COMMENT"))
                {
                    column.Comment = lexer.ReadString();
                }
                else if (lexer.TryReadKeyword("COLLATE"))
                {
                    ReadSupportedCollation(lexer);
                }
                else if (lexer.TryReadKeyword("ON"))
                {
                    lexer.ExpectKeyword("UPDATE");
                    lexer.ExpectKeyword("CURRENT_TIMESTAMP");
                    ParseOptionalEmptyParentheses(lexer);
                    column.UpdateWithCurrentTimestamp = true;
                }
                else
                {
                    throw new InvalidDataException(
                        "Unsupported column option '" + lexer.Peek().Text
                        + "' on '" + table.Name + "." + name + "'.");
                }
            }

            table.Columns.Add(column);
            table.ColumnsByName.Add(name, column);
        }

        private static SeedDefaultValue ParseDefault(SeedLexer lexer)
        {
            if (lexer.TryReadKeyword("NULL"))
            {
                return new SeedDefaultValue(SeedDefaultKind.Null);
            }
            if (lexer.TryReadKeyword("CURRENT_TIMESTAMP"))
            {
                ParseOptionalEmptyParentheses(lexer);
                return new SeedDefaultValue(SeedDefaultKind.CurrentTimestamp);
            }
            if (lexer.TryReadKeyword("B"))
            {
                return new SeedDefaultValue(
                    SeedDefaultKind.Boolean,
                    ReadBit(lexer.ReadString()));
            }
            if (lexer.Peek().Kind == SeedTokenKind.String)
            {
                return new SeedDefaultValue(
                    SeedDefaultKind.String,
                    lexer.ReadString());
            }
            if (lexer.Peek().Kind == SeedTokenKind.Number)
            {
                return new SeedDefaultValue(
                    SeedDefaultKind.Number,
                    lexer.ReadNumber());
            }
            throw new InvalidDataException(
                "Unsupported DEFAULT value '" + lexer.Peek().Text + "'.");
        }

        private static void ParseIndex(
            SeedLexer lexer,
            SeedTable table,
            bool unique)
        {
            var name = lexer.ReadIdentifier();
            var columns = ParseIndexColumns(lexer);
            ParseOptionalUsingBtree(lexer);
            table.Indexes.Add(new SeedIndex(name, unique, columns));
        }

        private static void ParseForeignKey(SeedLexer lexer, SeedTable table)
        {
            var name = lexer.ReadIdentifier();
            lexer.ExpectKeyword("FOREIGN");
            lexer.ExpectKeyword("KEY");
            var columns = ParseIndexColumns(lexer);
            lexer.ExpectKeyword("REFERENCES");
            var referencedTable = lexer.ReadIdentifier();
            var referencedColumns = ParseIndexColumns(lexer);
            table.ForeignKeys.Add(new SeedForeignKey(
                name,
                columns,
                referencedTable,
                referencedColumns));
        }

        private static List<SeedIndexColumn> ParseIndexColumns(SeedLexer lexer)
        {
            var columns = new List<SeedIndexColumn>();
            lexer.ExpectSymbol("(");
            do
            {
                var name = lexer.ReadIdentifier();
                int? prefixLength = null;
                if (lexer.TryReadSymbol("("))
                {
                    prefixLength = ParsePositiveInt(
                        lexer.ReadNumber(), "index prefix length");
                    lexer.ExpectSymbol(")");
                }
                columns.Add(new SeedIndexColumn(name, prefixLength));
            }
            while (lexer.TryReadSymbol(","));
            lexer.ExpectSymbol(")");
            return columns;
        }

        private static void ParseOptionalUsingBtree(SeedLexer lexer)
        {
            if (lexer.TryReadKeyword("USING"))
            {
                lexer.ExpectKeyword("BTREE");
            }
        }

        private static void ParseInsert(SeedLexer lexer, SeedDatabase database)
        {
            lexer.ExpectKeyword("INTO");
            var tableName = lexer.ReadIdentifier();
            if (!database.TablesByName.TryGetValue(tableName, out var table))
            {
                throw new InvalidDataException(
                    "INSERT references unknown table '" + tableName + "'.");
            }

            var columns = new List<SeedColumn>();
            lexer.ExpectSymbol("(");
            do
            {
                var columnName = lexer.ReadIdentifier();
                if (!table.ColumnsByName.TryGetValue(columnName, out var column))
                {
                    throw new InvalidDataException(
                        "INSERT references unknown column '" + tableName
                        + "." + columnName + "'.");
                }
                columns.Add(column);
            }
            while (lexer.TryReadSymbol(","));
            lexer.ExpectSymbol(")");
            lexer.ExpectKeyword("VALUES");

            var rows = new List<IReadOnlyList<SeedValue>>();
            do
            {
                var row = new List<SeedValue>();
                lexer.ExpectSymbol("(");
                if (!lexer.PeekSymbol(")"))
                {
                    do
                    {
                        row.Add(ParseValue(lexer));
                    }
                    while (lexer.TryReadSymbol(","));
                }
                lexer.ExpectSymbol(")");
                if (row.Count != columns.Count)
                {
                    throw new InvalidDataException(
                        "INSERT into '" + tableName + "' has " + row.Count
                        + " values for " + columns.Count + " columns.");
                }
                rows.Add(row.AsReadOnly());
            }
            while (lexer.TryReadSymbol(","));

            if (rows.Count == 0)
            {
                throw new InvalidDataException(
                    "INSERT into '" + tableName + "' has no rows.");
            }
            database.Inserts.Add(new SeedInsert(
                table,
                columns.AsReadOnly(),
                rows.AsReadOnly()));
        }

        private static SeedValue ParseValue(SeedLexer lexer)
        {
            if (lexer.TryReadKeyword("NULL"))
            {
                return new SeedValue(SeedValueKind.Null);
            }
            if (lexer.TryReadKeyword("B"))
            {
                return new SeedValue(
                    SeedValueKind.Boolean,
                    ReadBit(lexer.ReadString()));
            }
            if (lexer.Peek().Kind == SeedTokenKind.String)
            {
                return new SeedValue(SeedValueKind.String, lexer.ReadString());
            }
            if (lexer.Peek().Kind == SeedTokenKind.Number)
            {
                return new SeedValue(SeedValueKind.Number, lexer.ReadNumber());
            }
            if (lexer.Peek().Kind == SeedTokenKind.Hex)
            {
                return new SeedValue(SeedValueKind.Binary, lexer.ReadHex());
            }
            throw new InvalidDataException(
                "Unsupported INSERT value '" + lexer.Peek().Text + "'.");
        }

        private static void Validate(SeedDatabase database, int statementNumber)
        {
            foreach (var table in database.Tables)
            {
                ValidateColumns(table, table.PrimaryKey, "primary key", statementNumber);
                foreach (var index in table.Indexes)
                {
                    ValidateColumns(table, index.Columns, "index " + index.Name,
                        statementNumber);
                }
                foreach (var foreignKey in table.ForeignKeys)
                {
                    ValidateColumns(table, foreignKey.Columns,
                        "foreign key " + foreignKey.Name, statementNumber);
                    if (!database.TablesByName.TryGetValue(
                            foreignKey.ReferencedTable,
                            out var referencedTable))
                    {
                        throw new SeedConversionException(
                            statementNumber,
                            "Foreign key '" + foreignKey.Name
                            + "' references unknown table '"
                            + foreignKey.ReferencedTable + "'.");
                    }
                    ValidateColumns(
                        referencedTable,
                        foreignKey.ReferencedColumns,
                        "foreign key " + foreignKey.Name,
                        statementNumber);
                    if (foreignKey.Columns.Count != foreignKey.ReferencedColumns.Count)
                    {
                        throw new SeedConversionException(
                            statementNumber,
                            "Foreign key '" + foreignKey.Name
                            + "' has mismatched column counts.");
                    }
                }
            }
        }

        private static void ValidateColumns(
            SeedTable table,
            IReadOnlyList<SeedIndexColumn> columns,
            string owner,
            int statementNumber)
        {
            foreach (var column in columns)
            {
                if (!table.ColumnsByName.ContainsKey(column.Name))
                {
                    throw new SeedConversionException(
                        statementNumber,
                        "The " + owner + " on table '" + table.Name
                        + "' references unknown column '" + column.Name + "'.");
                }
            }
        }

        private static void EnsureSupportedType(
            string typeName,
            IReadOnlyList<int> arguments)
        {
            switch (typeName)
            {
                case "varchar":
                    RequireArgumentCount(typeName, arguments, 1);
                    return;
                case "decimal":
                    RequireArgumentCount(typeName, arguments, 2);
                    return;
                case "tinyint":
                case "smallint":
                case "int":
                case "bigint":
                case "bit":
                    RequireArgumentCount(typeName, arguments, 1);
                    return;
                case "datetime":
                case "mediumtext":
                case "longtext":
                case "blob":
                    RequireArgumentCount(typeName, arguments, 0);
                    return;
                default:
                    throw new InvalidDataException(
                        "Unsupported MySQL column type '" + typeName + "'.");
            }
        }

        private static void RequireArgumentCount(
            string typeName,
            IReadOnlyList<int> arguments,
            int expected)
        {
            if (arguments.Count != expected)
            {
                throw new InvalidDataException(
                    "MySQL type '" + typeName + "' requires " + expected
                    + " argument(s), but found " + arguments.Count + ".");
            }
        }

        private static void ReadSupportedCharacterSet(SeedLexer lexer)
        {
            var characterSet = lexer.ReadIdentifier();
            if (!string.Equals(characterSet, "utf8", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(characterSet, "utf8mb4", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    "Only utf8 and utf8mb4 character sets are supported.");
            }
        }

        private static void ReadSupportedCollation(SeedLexer lexer)
        {
            var collation = lexer.ReadIdentifier();
            if (!string.Equals(
                    collation,
                    "utf8mb4_unicode_ci",
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    "Unsupported MySQL collation '" + collation + "'.");
            }
        }

        private static string ReadBit(string value)
        {
            if (value != "0" && value != "1")
            {
                throw new InvalidDataException("BIT value must be 0 or 1.");
            }
            return value;
        }

        private static int ParsePositiveInt(string value, string label)
        {
            if (!int.TryParse(
                    value,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var result)
                || result <= 0)
            {
                throw new InvalidDataException(
                    "Invalid " + label + " '" + value + "'.");
            }
            return result;
        }

        private static void ParseOptionalEmptyParentheses(SeedLexer lexer)
        {
            if (lexer.TryReadSymbol("("))
            {
                lexer.ExpectSymbol(")");
            }
        }

        private static string Preview(string value)
        {
            var normalized = value.Replace('\r', ' ').Replace('\n', ' ').Trim();
            return normalized.Length <= 120
                ? normalized
                : normalized.Substring(0, 120) + "...";
        }

        private static IEnumerable<string> SplitStatements(string sql)
        {
            var buffer = new StringBuilder();
            var inString = false;
            var inIdentifier = false;
            var inLineComment = false;
            var inBlockComment = false;

            for (var index = 0; index < sql.Length; index++)
            {
                var current = sql[index];
                var next = index + 1 < sql.Length ? sql[index + 1] : '\0';

                if (inLineComment)
                {
                    if (current == '\r' || current == '\n')
                    {
                        inLineComment = false;
                        buffer.Append(' ');
                    }
                    continue;
                }
                if (inBlockComment)
                {
                    if (current == '*' && next == '/')
                    {
                        inBlockComment = false;
                        index++;
                        buffer.Append(' ');
                    }
                    continue;
                }
                if (inString)
                {
                    buffer.Append(current);
                    if (current == '\\' && next != '\0')
                    {
                        buffer.Append(next);
                        index++;
                    }
                    else if (current == '\'' && next == '\'')
                    {
                        buffer.Append(next);
                        index++;
                    }
                    else if (current == '\'')
                    {
                        inString = false;
                    }
                    continue;
                }
                if (inIdentifier)
                {
                    buffer.Append(current);
                    if (current == '`' && next == '`')
                    {
                        buffer.Append(next);
                        index++;
                    }
                    else if (current == '`')
                    {
                        inIdentifier = false;
                    }
                    continue;
                }

                if (current == '-' && next == '-'
                    && (index + 2 >= sql.Length
                        || char.IsWhiteSpace(sql[index + 2])))
                {
                    inLineComment = true;
                    index++;
                }
                else if (current == '#')
                {
                    inLineComment = true;
                }
                else if (current == '/' && next == '*')
                {
                    if (index + 2 < sql.Length && sql[index + 2] == '!')
                    {
                        throw new InvalidDataException(
                            "Versioned MySQL comments are not supported.");
                    }
                    inBlockComment = true;
                    index++;
                }
                else if (current == '\'')
                {
                    inString = true;
                    buffer.Append(current);
                }
                else if (current == '`')
                {
                    inIdentifier = true;
                    buffer.Append(current);
                }
                else if (current == ';')
                {
                    var statement = buffer.ToString().Trim();
                    buffer.Clear();
                    if (statement.Length > 0)
                    {
                        yield return statement;
                    }
                }
                else
                {
                    buffer.Append(current);
                }
            }

            if (inString || inIdentifier || inBlockComment)
            {
                throw new InvalidDataException(
                    "The MySQL dump ends inside a quoted value, identifier, or comment.");
            }
            var trailing = buffer.ToString().Trim();
            if (trailing.Length > 0)
            {
                throw new InvalidDataException(
                    "The final MySQL statement is missing a semicolon: "
                    + Preview(trailing));
            }
        }
    }

    internal enum SeedTokenKind
    {
        Word = 0,
        QuotedIdentifier = 1,
        String = 2,
        Number = 3,
        Symbol = 4,
        Hex = 5,
        End = 6
    }

    internal sealed class SeedToken
    {
        internal SeedToken(SeedTokenKind kind, string text, int position)
        {
            Kind = kind;
            Text = text;
            Position = position;
        }

        internal SeedTokenKind Kind { get; }

        internal string Text { get; }

        internal int Position { get; }
    }

    internal sealed class SeedLexer
    {
        private readonly string _source;
        private int _position;
        private SeedToken _lookahead;

        internal SeedLexer(string source)
        {
            _source = source ?? throw new ArgumentNullException(nameof(source));
        }

        internal bool IsEnd => Peek().Kind == SeedTokenKind.End;

        internal SeedToken Peek()
        {
            return _lookahead ?? (_lookahead = ReadNext());
        }

        internal bool PeekSymbol(string symbol)
        {
            var token = Peek();
            return token.Kind == SeedTokenKind.Symbol && token.Text == symbol;
        }

        internal bool TryReadKeyword(string keyword)
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.Word
                || !string.Equals(token.Text, keyword, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            _lookahead = null;
            return true;
        }

        internal void ExpectKeyword(string keyword)
        {
            if (!TryReadKeyword(keyword))
            {
                throw Expected(keyword);
            }
        }

        internal bool TryReadSymbol(string symbol)
        {
            if (!PeekSymbol(symbol))
            {
                return false;
            }
            _lookahead = null;
            return true;
        }

        internal void ExpectSymbol(string symbol)
        {
            if (!TryReadSymbol(symbol))
            {
                throw Expected(symbol);
            }
        }

        internal string ReadIdentifier()
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.QuotedIdentifier
                && token.Kind != SeedTokenKind.Word)
            {
                throw Expected("identifier");
            }
            _lookahead = null;
            return token.Text;
        }

        internal string ReadWord()
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.Word)
            {
                throw Expected("word");
            }
            _lookahead = null;
            return token.Text;
        }

        internal string ReadString()
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.String)
            {
                throw Expected("string");
            }
            _lookahead = null;
            return token.Text;
        }

        internal string ReadNumber()
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.Number)
            {
                throw Expected("number");
            }
            _lookahead = null;
            return token.Text;
        }

        internal string ReadHex()
        {
            var token = Peek();
            if (token.Kind != SeedTokenKind.Hex)
            {
                throw Expected("hexadecimal literal");
            }
            _lookahead = null;
            return token.Text;
        }

        internal void ExpectEnd()
        {
            if (!IsEnd)
            {
                throw Expected("end of statement");
            }
        }

        private SeedToken ReadNext()
        {
            while (_position < _source.Length && char.IsWhiteSpace(_source[_position]))
            {
                _position++;
            }
            if (_position >= _source.Length)
            {
                return new SeedToken(SeedTokenKind.End, string.Empty, _position);
            }

            var start = _position;
            var current = _source[_position];
            if (current == '`')
            {
                return ReadQuotedIdentifier(start);
            }
            if (current == '\'')
            {
                return ReadStringToken(start);
            }
            if (current == '0'
                && _position + 2 < _source.Length
                && (_source[_position + 1] == 'x'
                    || _source[_position + 1] == 'X')
                && IsHex(_source[_position + 2]))
            {
                _position += 2;
                var hexStart = _position;
                while (_position < _source.Length && IsHex(_source[_position]))
                {
                    _position++;
                }
                var hex = _source.Substring(hexStart, _position - hexStart);
                if ((hex.Length & 1) != 0)
                {
                    throw new InvalidDataException(
                        "Hexadecimal literal at offset " + start
                        + " must contain an even number of digits.");
                }
                return new SeedToken(SeedTokenKind.Hex, hex, start);
            }
            if (char.IsDigit(current)
                || ((current == '-' || current == '+')
                    && _position + 1 < _source.Length
                    && char.IsDigit(_source[_position + 1])))
            {
                return ReadNumberToken(start);
            }
            if (char.IsLetter(current) || current == '_')
            {
                _position++;
                while (_position < _source.Length)
                {
                    current = _source[_position];
                    if (!char.IsLetterOrDigit(current)
                        && current != '_'
                        && current != '$')
                    {
                        break;
                    }
                    _position++;
                }
                return new SeedToken(
                    SeedTokenKind.Word,
                    _source.Substring(start, _position - start),
                    start);
            }
            if ("(),=.".IndexOf(current) >= 0)
            {
                _position++;
                return new SeedToken(
                    SeedTokenKind.Symbol,
                    current.ToString(),
                    start);
            }
            throw new InvalidDataException(
                "Unexpected character '" + current + "' at offset " + start + ".");
        }

        private SeedToken ReadQuotedIdentifier(int start)
        {
            _position++;
            var value = new StringBuilder();
            while (_position < _source.Length)
            {
                var current = _source[_position++];
                if (current == '`')
                {
                    if (_position < _source.Length && _source[_position] == '`')
                    {
                        value.Append('`');
                        _position++;
                        continue;
                    }
                    return new SeedToken(
                        SeedTokenKind.QuotedIdentifier,
                        value.ToString(),
                        start);
                }
                value.Append(current);
            }
            throw new InvalidDataException(
                "Unterminated quoted identifier at offset " + start + ".");
        }

        private SeedToken ReadStringToken(int start)
        {
            _position++;
            var value = new StringBuilder();
            while (_position < _source.Length)
            {
                var current = _source[_position++];
                if (current == '\'')
                {
                    if (_position < _source.Length && _source[_position] == '\'')
                    {
                        value.Append('\'');
                        _position++;
                        continue;
                    }
                    return new SeedToken(
                        SeedTokenKind.String,
                        value.ToString(),
                        start);
                }
                if (current == '\\')
                {
                    if (_position >= _source.Length)
                    {
                        throw new InvalidDataException(
                            "Unterminated string escape at offset " + start + ".");
                    }
                    value.Append(DecodeEscape(_source[_position++]));
                }
                else
                {
                    value.Append(current);
                }
            }
            throw new InvalidDataException(
                "Unterminated string at offset " + start + ".");
        }

        private SeedToken ReadNumberToken(int start)
        {
            if (_source[_position] == '-' || _source[_position] == '+')
            {
                _position++;
            }
            while (_position < _source.Length && char.IsDigit(_source[_position]))
            {
                _position++;
            }
            if (_position < _source.Length && _source[_position] == '.')
            {
                _position++;
                if (_position >= _source.Length || !char.IsDigit(_source[_position]))
                {
                    throw new InvalidDataException(
                        "Invalid number at offset " + start + ".");
                }
                while (_position < _source.Length && char.IsDigit(_source[_position]))
                {
                    _position++;
                }
            }
            return new SeedToken(
                SeedTokenKind.Number,
                _source.Substring(start, _position - start),
                start);
        }

        private static char DecodeEscape(char value)
        {
            switch (value)
            {
                case '0': return '\0';
                case 'b': return '\b';
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'Z': return (char)26;
                case '\\': return '\\';
                case '\'': return '\'';
                case '"': return '"';
                case '%': return '%';
                case '_': return '_';
                default: return value;
            }
        }

        private static bool IsHex(char value)
        {
            return (value >= '0' && value <= '9')
                || (value >= 'a' && value <= 'f')
                || (value >= 'A' && value <= 'F');
        }

        private InvalidDataException Expected(string expected)
        {
            var token = Peek();
            return new InvalidDataException(
                "Expected " + expected + " at offset " + token.Position
                + ", but found '" + token.Text + "'.");
        }
    }
}
