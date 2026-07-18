using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Text;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal enum SqlTextDialectFamily
    {
        MySql,
        PostgreSql,
        KingbaseEs,
        SqlServer,
        Oracle
    }

    internal enum SqlOperatorToken
    {
        Equal,
        NotEqual,
        GreaterThan,
        GreaterThanOrEqual,
        LessThan,
        LessThanOrEqual,
        Add,
        Subtract,
        Multiply,
        Divide,
        Modulo,
        Concat
    }

    internal enum SqlKeyword
    {
        Action,
        Add,
        All,
        Alter,
        Always,
        Analyze,
        And,
        As,
        Asc,
        AutoIncrement,
        Avg,
        Begin,
        Between,
        BigInt,
        Binary,
        BinaryDouble,
        Bit,
        Blob,
        Boolean,
        By,
        ByteA,
        Cache,
        Cascade,
        Case,
        Cast,
        Char,
        CharLength,
        Change,
        Check,
        Clob,
        Coalesce,
        Collate,
        Column,
        Comment,
        Commit,
        Concat,
        Conflict,
        Constraint,
        Count,
        Create,
        Cross,
        CurrentTimestamp,
        Cycle,
        Data,
        Database,
        Date,
        DateAdd,
        DateDiff,
        DateTime,
        DateTime2,
        Decimal,
        Default,
        Delete,
        Deleted,
        Desc,
        Distinct,
        Do,
        Double,
        DoublePrecision,
        Drop,
        Duplicate,
        Else,
        End,
        Except,
        Exists,
        False,
        Fetch,
        First,
        Float,
        For,
        Foreign,
        From,
        Full,
        Generated,
        Group,
        Having,
        Identity,
        If,
        Ignore,
        In,
        Increment,
        Index,
        Inner,
        Insert,
        Inserted,
        Int,
        Integer,
        Intersect,
        Into,
        Is,
        Join,
        Json,
        JsonB,
        JsonExtract,
        JsonbExtractPathText,
        JsonValue,
        Key,
        Last,
        Left,
        Len,
        Length,
        Like,
        Limit,
        Locked,
        LongBlob,
        LongText,
        Max,
        MaxValue,
        Merge,
        Min,
        MinValue,
        Modify,
        NClob,
        Next,
        NextVal,
        No,
        NoAction,
        NoMaxValue,
        NoMinValue,
        Not,
        Nothing,
        NoWait,
        Null,
        Nulls,
        Numeric,
        NVarChar,
        NVarChar2,
        Number,
        Offset,
        On,
        Only,
        Or,
        Order,
        Outer,
        Output,
        Precision,
        Primary,
        Raw,
        Real,
        References,
        Rename,
        Replace,
        Restrict,
        Returning,
        Right,
        Rollback,
        Round,
        Row,
        RowId,
        RowNum,
        RowNumber,
        RowCount,
        Rows,
        Schema,
        Select,
        Sequence,
        Set,
        Share,
        Skip,
        SkipLocked,
        SmallInt,
        Start,
        Stored,
        Substring,
        Sum,
        SysDate,
        SysDateTime,
        Table,
        Text,
        Then,
        Time,
        Timestamp,
        TinyInt,
        To,
        Top,
        True,
        Truncate,
        Type,
        Union,
        UnionAll,
        Unique,
        UniqueIdentifier,
        Update,
        Using,
        Uuid,
        Values,
        VarBinary,
        VarChar,
        VarChar2,
        View,
        Virtual,
        When,
        Where,
        With,
        WithTimeZone,
        WithoutTimeZone
    }

    internal sealed class SqlSchemaLiteral
    {
        internal const int MaximumLength = 4096;

        internal SqlSchemaLiteral(string value)
        {
            if (value == null)
            {
                throw new ArgumentNullException(nameof(value));
            }
            if (value.Length > MaximumLength)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(value),
                    "Schema literal exceeds the maximum length.");
            }

            for (var index = 0; index < value.Length; index++)
            {
                var character = value[index];
                if (char.IsControl(character))
                {
                    throw new ArgumentException(
                        "Schema literal cannot contain control characters.",
                        nameof(value));
                }
                if (char.IsHighSurrogate(character))
                {
                    if (index + 1 >= value.Length ||
                        !char.IsLowSurrogate(value[index + 1]))
                    {
                        throw new ArgumentException(
                            "Schema literal must contain valid Unicode.",
                            nameof(value));
                    }

                    index++;
                    continue;
                }
                if (char.IsLowSurrogate(character))
                {
                    throw new ArgumentException(
                        "Schema literal must contain valid Unicode.",
                        nameof(value));
                }
            }

            Value = value;
        }

        internal string Value { get; }
    }

    internal sealed class SqlCommandTextSnapshot
    {
        internal SqlCommandTextSnapshot(
            string commandText,
            IEnumerable<ParameterDefinition> parameters)
        {
            if (commandText == null)
            {
                throw new ArgumentNullException(nameof(commandText));
            }
            if (parameters == null)
            {
                throw new ArgumentNullException(nameof(parameters));
            }

            var copied = new List<ParameterDefinition>();
            foreach (var parameter in parameters)
            {
                if (parameter == null)
                {
                    throw new ArgumentException(
                        "Parameter definitions cannot contain null.",
                        nameof(parameters));
                }

                copied.Add(parameter);
            }

            CommandText = commandText;
            Parameters = new ReadOnlyCollection<ParameterDefinition>(copied);
        }

        internal string CommandText { get; }

        internal IReadOnlyList<ParameterDefinition> Parameters { get; }
    }

    internal sealed class SqlTextWriter
    {
        private readonly SqlTextDialectFamily _family;
        private readonly StringBuilder _text = new StringBuilder();
        private readonly List<ParameterDefinition> _parameters =
            new List<ParameterDefinition>();
        private readonly Dictionary<string, ParameterDefinition>
            _parametersByPlaceholder =
                new Dictionary<string, ParameterDefinition>(
                    StringComparer.Ordinal);
        private int _parenthesisDepth;
        private bool _isTerminal;

        internal SqlTextWriter(SqlTextDialectFamily family)
        {
            if (!Enum.IsDefined(typeof(SqlTextDialectFamily), family))
            {
                throw new ArgumentOutOfRangeException(nameof(family));
            }

            _family = family;
        }

        internal void AppendKeyword(SqlKeyword keyword)
        {
            EnsureWritable();
            _text.Append(KeywordText(keyword));
        }

        internal void AppendIdentifierSegment(string value)
        {
            EnsureWritable();
            var segment = new SqlIdentifier(value).Value;

            switch (_family)
            {
                case SqlTextDialectFamily.MySql:
                    _text.Append('`').Append(segment).Append('`');
                    break;
                case SqlTextDialectFamily.PostgreSql:
                case SqlTextDialectFamily.KingbaseEs:
                case SqlTextDialectFamily.Oracle:
                    _text.Append('"').Append(segment).Append('"');
                    break;
                case SqlTextDialectFamily.SqlServer:
                    _text.Append('[').Append(segment).Append(']');
                    break;
                default:
                    throw new InvalidOperationException(
                        "SQL text dialect family is invalid.");
            }
        }

        internal void AppendParameter(SqlParameterSlot slot)
        {
            EnsureWritable();
            if (slot == null)
            {
                throw new ArgumentNullException(nameof(slot));
            }

            ParameterDefinition existing;
            if (_parametersByPlaceholder.TryGetValue(
                    slot.Placeholder, out existing))
            {
                if (!ReferenceEquals(existing, slot.Definition))
                {
                    throw new ArgumentException(
                        "One placeholder cannot identify different parameter definitions.",
                        nameof(slot));
                }
            }
            else
            {
                _parametersByPlaceholder.Add(
                    slot.Placeholder, slot.Definition);
                _parameters.Add(slot.Definition);
            }

            _text.Append(ParameterPrefix(_family));
            _text.Append(slot.Placeholder);
        }

        internal void AppendOperator(SqlOperatorToken token)
        {
            EnsureWritable();
            _text.Append(OperatorText(token));
        }

        internal void AppendOpenParenthesis()
        {
            EnsureWritable();
            _parenthesisDepth++;
            _text.Append('(');
        }

        internal void AppendCloseParenthesis()
        {
            EnsureWritable();
            if (_parenthesisDepth == 0)
            {
                throw new InvalidOperationException(
                    "SQL text contains an unmatched closing parenthesis.");
            }

            _parenthesisDepth--;
            _text.Append(')');
        }

        internal void AppendComma()
        {
            EnsureWritable();
            _text.Append(',');
        }

        internal void AppendDot()
        {
            EnsureWritable();
            _text.Append('.');
        }

        internal void AppendSpace()
        {
            EnsureWritable();
            _text.Append(' ');
        }

        internal void AppendStructuralInt(int value)
        {
            EnsureWritable();
            if (value < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(value));
            }

            _text.Append(value.ToString(CultureInfo.InvariantCulture));
        }

        internal void AppendEscapedSchemaLiteral(SqlSchemaLiteral literal)
        {
            EnsureWritable();
            if (literal == null)
            {
                throw new ArgumentNullException(nameof(literal));
            }

            if (_family == SqlTextDialectFamily.SqlServer)
            {
                _text.Append('N');
            }

            var escaped = literal.Value;
            if (_family == SqlTextDialectFamily.MySql)
            {
                escaped = escaped.Replace("\\", "\\\\");
            }
            escaped = escaped.Replace("'", "''");

            _text.Append('\'');
            _text.Append(escaped);
            _text.Append('\'');
        }

        internal SqlCommandTextSnapshot Snapshot()
        {
            EnsureWritable();
            if (_parenthesisDepth != 0)
            {
                throw new InvalidOperationException(
                    "SQL text contains unclosed parentheses.");
            }

            var snapshot = new SqlCommandTextSnapshot(
                _text.ToString(), _parameters);
            _isTerminal = true;
            return snapshot;
        }

        private void EnsureWritable()
        {
            if (_isTerminal)
            {
                throw new InvalidOperationException(
                    "SQL text writer is terminal after Snapshot.");
            }
        }

        private static string ParameterPrefix(SqlTextDialectFamily family)
        {
            switch (family)
            {
                case SqlTextDialectFamily.MySql:
                    return "?";
                case SqlTextDialectFamily.PostgreSql:
                case SqlTextDialectFamily.SqlServer:
                    return "@";
                case SqlTextDialectFamily.KingbaseEs:
                case SqlTextDialectFamily.Oracle:
                    return ":";
                default:
                    throw new ArgumentOutOfRangeException(nameof(family));
            }
        }

        private static string OperatorText(SqlOperatorToken token)
        {
            switch (token)
            {
                case SqlOperatorToken.Equal:
                    return "=";
                case SqlOperatorToken.NotEqual:
                    return "<>";
                case SqlOperatorToken.GreaterThan:
                    return ">";
                case SqlOperatorToken.GreaterThanOrEqual:
                    return ">=";
                case SqlOperatorToken.LessThan:
                    return "<";
                case SqlOperatorToken.LessThanOrEqual:
                    return "<=";
                case SqlOperatorToken.Add:
                    return "+";
                case SqlOperatorToken.Subtract:
                    return "-";
                case SqlOperatorToken.Multiply:
                    return "*";
                case SqlOperatorToken.Divide:
                    return "/";
                case SqlOperatorToken.Modulo:
                    return "%";
                case SqlOperatorToken.Concat:
                    return "||";
                default:
                    throw new ArgumentOutOfRangeException(nameof(token));
            }
        }

        private static string KeywordText(SqlKeyword keyword)
        {
            switch (keyword)
            {
                case SqlKeyword.Action: return "ACTION";
                case SqlKeyword.Add: return "ADD";
                case SqlKeyword.All: return "ALL";
                case SqlKeyword.Alter: return "ALTER";
                case SqlKeyword.Always: return "ALWAYS";
                case SqlKeyword.Analyze: return "ANALYZE";
                case SqlKeyword.And: return "AND";
                case SqlKeyword.As: return "AS";
                case SqlKeyword.Asc: return "ASC";
                case SqlKeyword.AutoIncrement: return "AUTO_INCREMENT";
                case SqlKeyword.Avg: return "AVG";
                case SqlKeyword.Begin: return "BEGIN";
                case SqlKeyword.Between: return "BETWEEN";
                case SqlKeyword.BigInt: return "BIGINT";
                case SqlKeyword.Binary: return "BINARY";
                case SqlKeyword.BinaryDouble: return "BINARY_DOUBLE";
                case SqlKeyword.Bit: return "BIT";
                case SqlKeyword.Blob: return "BLOB";
                case SqlKeyword.Boolean: return "BOOLEAN";
                case SqlKeyword.By: return "BY";
                case SqlKeyword.ByteA: return "BYTEA";
                case SqlKeyword.Cache: return "CACHE";
                case SqlKeyword.Cascade: return "CASCADE";
                case SqlKeyword.Case: return "CASE";
                case SqlKeyword.Cast: return "CAST";
                case SqlKeyword.Char: return "CHAR";
                case SqlKeyword.CharLength: return "CHAR_LENGTH";
                case SqlKeyword.Change: return "CHANGE";
                case SqlKeyword.Check: return "CHECK";
                case SqlKeyword.Clob: return "CLOB";
                case SqlKeyword.Coalesce: return "COALESCE";
                case SqlKeyword.Collate: return "COLLATE";
                case SqlKeyword.Column: return "COLUMN";
                case SqlKeyword.Comment: return "COMMENT";
                case SqlKeyword.Commit: return "COMMIT";
                case SqlKeyword.Concat: return "CONCAT";
                case SqlKeyword.Conflict: return "CONFLICT";
                case SqlKeyword.Constraint: return "CONSTRAINT";
                case SqlKeyword.Count: return "COUNT";
                case SqlKeyword.Create: return "CREATE";
                case SqlKeyword.Cross: return "CROSS";
                case SqlKeyword.CurrentTimestamp: return "CURRENT_TIMESTAMP";
                case SqlKeyword.Cycle: return "CYCLE";
                case SqlKeyword.Data: return "DATA";
                case SqlKeyword.Database: return "DATABASE";
                case SqlKeyword.Date: return "DATE";
                case SqlKeyword.DateAdd: return "DATEADD";
                case SqlKeyword.DateDiff: return "DATEDIFF";
                case SqlKeyword.DateTime: return "DATETIME";
                case SqlKeyword.DateTime2: return "DATETIME2";
                case SqlKeyword.Decimal: return "DECIMAL";
                case SqlKeyword.Default: return "DEFAULT";
                case SqlKeyword.Delete: return "DELETE";
                case SqlKeyword.Deleted: return "DELETED";
                case SqlKeyword.Desc: return "DESC";
                case SqlKeyword.Distinct: return "DISTINCT";
                case SqlKeyword.Do: return "DO";
                case SqlKeyword.Double: return "DOUBLE";
                case SqlKeyword.DoublePrecision: return "DOUBLE PRECISION";
                case SqlKeyword.Drop: return "DROP";
                case SqlKeyword.Duplicate: return "DUPLICATE";
                case SqlKeyword.Else: return "ELSE";
                case SqlKeyword.End: return "END";
                case SqlKeyword.Except: return "EXCEPT";
                case SqlKeyword.Exists: return "EXISTS";
                case SqlKeyword.False: return "FALSE";
                case SqlKeyword.Fetch: return "FETCH";
                case SqlKeyword.First: return "FIRST";
                case SqlKeyword.Float: return "FLOAT";
                case SqlKeyword.For: return "FOR";
                case SqlKeyword.Foreign: return "FOREIGN";
                case SqlKeyword.From: return "FROM";
                case SqlKeyword.Full: return "FULL";
                case SqlKeyword.Generated: return "GENERATED";
                case SqlKeyword.Group: return "GROUP";
                case SqlKeyword.Having: return "HAVING";
                case SqlKeyword.Identity: return "IDENTITY";
                case SqlKeyword.If: return "IF";
                case SqlKeyword.Ignore: return "IGNORE";
                case SqlKeyword.In: return "IN";
                case SqlKeyword.Increment: return "INCREMENT";
                case SqlKeyword.Index: return "INDEX";
                case SqlKeyword.Inner: return "INNER";
                case SqlKeyword.Insert: return "INSERT";
                case SqlKeyword.Inserted: return "INSERTED";
                case SqlKeyword.Int: return "INT";
                case SqlKeyword.Integer: return "INTEGER";
                case SqlKeyword.Intersect: return "INTERSECT";
                case SqlKeyword.Into: return "INTO";
                case SqlKeyword.Is: return "IS";
                case SqlKeyword.Join: return "JOIN";
                case SqlKeyword.Json: return "JSON";
                case SqlKeyword.JsonB: return "JSONB";
                case SqlKeyword.JsonExtract: return "JSON_EXTRACT";
                case SqlKeyword.JsonbExtractPathText: return "JSONB_EXTRACT_PATH_TEXT";
                case SqlKeyword.JsonValue: return "JSON_VALUE";
                case SqlKeyword.Key: return "KEY";
                case SqlKeyword.Last: return "LAST";
                case SqlKeyword.Left: return "LEFT";
                case SqlKeyword.Len: return "LEN";
                case SqlKeyword.Length: return "LENGTH";
                case SqlKeyword.Like: return "LIKE";
                case SqlKeyword.Limit: return "LIMIT";
                case SqlKeyword.Locked: return "LOCKED";
                case SqlKeyword.LongBlob: return "LONGBLOB";
                case SqlKeyword.LongText: return "LONGTEXT";
                case SqlKeyword.Max: return "MAX";
                case SqlKeyword.MaxValue: return "MAXVALUE";
                case SqlKeyword.Merge: return "MERGE";
                case SqlKeyword.Min: return "MIN";
                case SqlKeyword.MinValue: return "MINVALUE";
                case SqlKeyword.Modify: return "MODIFY";
                case SqlKeyword.NClob: return "NCLOB";
                case SqlKeyword.Next: return "NEXT";
                case SqlKeyword.NextVal: return "NEXTVAL";
                case SqlKeyword.No: return "NO";
                case SqlKeyword.NoAction: return "NO ACTION";
                case SqlKeyword.NoMaxValue: return "NOMAXVALUE";
                case SqlKeyword.NoMinValue: return "NOMINVALUE";
                case SqlKeyword.Not: return "NOT";
                case SqlKeyword.Nothing: return "NOTHING";
                case SqlKeyword.NoWait: return "NOWAIT";
                case SqlKeyword.Null: return "NULL";
                case SqlKeyword.Nulls: return "NULLS";
                case SqlKeyword.Numeric: return "NUMERIC";
                case SqlKeyword.NVarChar: return "NVARCHAR";
                case SqlKeyword.NVarChar2: return "NVARCHAR2";
                case SqlKeyword.Number: return "NUMBER";
                case SqlKeyword.Offset: return "OFFSET";
                case SqlKeyword.On: return "ON";
                case SqlKeyword.Only: return "ONLY";
                case SqlKeyword.Or: return "OR";
                case SqlKeyword.Order: return "ORDER";
                case SqlKeyword.Outer: return "OUTER";
                case SqlKeyword.Output: return "OUTPUT";
                case SqlKeyword.Precision: return "PRECISION";
                case SqlKeyword.Primary: return "PRIMARY";
                case SqlKeyword.Raw: return "RAW";
                case SqlKeyword.Real: return "REAL";
                case SqlKeyword.References: return "REFERENCES";
                case SqlKeyword.Rename: return "RENAME";
                case SqlKeyword.Replace: return "REPLACE";
                case SqlKeyword.Restrict: return "RESTRICT";
                case SqlKeyword.Returning: return "RETURNING";
                case SqlKeyword.Right: return "RIGHT";
                case SqlKeyword.Rollback: return "ROLLBACK";
                case SqlKeyword.Round: return "ROUND";
                case SqlKeyword.Row: return "ROW";
                case SqlKeyword.RowId: return "ROWID";
                case SqlKeyword.RowNum: return "ROWNUM";
                case SqlKeyword.RowNumber: return "ROW_NUMBER";
                case SqlKeyword.RowCount: return "@@ROWCOUNT";
                case SqlKeyword.Rows: return "ROWS";
                case SqlKeyword.Schema: return "SCHEMA";
                case SqlKeyword.Select: return "SELECT";
                case SqlKeyword.Sequence: return "SEQUENCE";
                case SqlKeyword.Set: return "SET";
                case SqlKeyword.Share: return "SHARE";
                case SqlKeyword.Skip: return "SKIP";
                case SqlKeyword.SkipLocked: return "SKIP LOCKED";
                case SqlKeyword.SmallInt: return "SMALLINT";
                case SqlKeyword.Start: return "START";
                case SqlKeyword.Stored: return "STORED";
                case SqlKeyword.Substring: return "SUBSTRING";
                case SqlKeyword.Sum: return "SUM";
                case SqlKeyword.SysDate: return "SYSDATE";
                case SqlKeyword.SysDateTime: return "SYSDATETIME";
                case SqlKeyword.Table: return "TABLE";
                case SqlKeyword.Text: return "TEXT";
                case SqlKeyword.Then: return "THEN";
                case SqlKeyword.Time: return "TIME";
                case SqlKeyword.Timestamp: return "TIMESTAMP";
                case SqlKeyword.TinyInt: return "TINYINT";
                case SqlKeyword.To: return "TO";
                case SqlKeyword.Top: return "TOP";
                case SqlKeyword.True: return "TRUE";
                case SqlKeyword.Truncate: return "TRUNCATE";
                case SqlKeyword.Type: return "TYPE";
                case SqlKeyword.Union: return "UNION";
                case SqlKeyword.UnionAll: return "UNION ALL";
                case SqlKeyword.Unique: return "UNIQUE";
                case SqlKeyword.UniqueIdentifier: return "UNIQUEIDENTIFIER";
                case SqlKeyword.Update: return "UPDATE";
                case SqlKeyword.Using: return "USING";
                case SqlKeyword.Uuid: return "UUID";
                case SqlKeyword.Values: return "VALUES";
                case SqlKeyword.VarBinary: return "VARBINARY";
                case SqlKeyword.VarChar: return "VARCHAR";
                case SqlKeyword.VarChar2: return "VARCHAR2";
                case SqlKeyword.View: return "VIEW";
                case SqlKeyword.Virtual: return "VIRTUAL";
                case SqlKeyword.When: return "WHEN";
                case SqlKeyword.Where: return "WHERE";
                case SqlKeyword.With: return "WITH";
                case SqlKeyword.WithTimeZone: return "WITH TIME ZONE";
                case SqlKeyword.WithoutTimeZone: return "WITHOUT TIME ZONE";
                default:
                    throw new ArgumentOutOfRangeException(nameof(keyword));
            }
        }
    }
}
