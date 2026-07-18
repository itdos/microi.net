using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Dos.ORM.Dialects.Dm8;

namespace Dos.ORM
{
    /// <summary>
    /// Rewrites the small, explicitly supported MySQL compatibility surface used
    /// by legacy <see cref="DbSession.FromSql(string)"/> callers. New code should
    /// prefer the structured SQL APIs. This boundary exists so provider-specific
    /// SQL does not leak into service and controller projects.
    /// </summary>
    public static class LegacySqlDialectRewriter
    {
        /// <summary>
        /// Rewrites supported MySQL constructs for the target provider. MySQL and
        /// providers outside the six officially supported engines are passed
        /// through byte-for-byte.
        /// </summary>
        public static string Rewrite(string sql, DatabaseType targetDatabase)
        {
            if (sql == null) throw new ArgumentNullException(nameof(sql));

            if (targetDatabase == DatabaseType.MySql ||
                !IsCompatibilityTarget(targetDatabase))
            {
                return sql;
            }

            var tokens = Tokenize(sql);
            LimitClause limit;
            if (!TryFindTailLimit(tokens, out limit))
            {
                return RewriteRange(tokens, 0, tokens.Count, targetDatabase);
            }

            var suffix = RenderOriginal(tokens, limit.EndTokenIndex, tokens.Count);
            if (IsSqlServer(targetDatabase))
            {
                if (limit.Offset == 0 &&
                    TryRewriteSelectWithTop(tokens, limit.StartTokenIndex,
                        limit.Count, targetDatabase, out var topSql))
                {
                    return topSql.TrimEnd() + suffix;
                }

                var sqlServerPrefix = RewriteRange(
                    tokens, 0, limit.StartTokenIndex, targetDatabase).TrimEnd();
                if (!HasTopLevelOrderBy(tokens, 0, limit.StartTokenIndex))
                {
                    sqlServerPrefix += " ORDER BY (SELECT NULL)";
                }

                return sqlServerPrefix +
                       " OFFSET " + limit.Offset.ToString(CultureInfo.InvariantCulture) +
                       " ROWS FETCH NEXT " + limit.Count.ToString(CultureInfo.InvariantCulture) +
                       " ROWS ONLY" + suffix;
            }

            var prefix = RewriteRange(
                tokens, 0, limit.StartTokenIndex, targetDatabase).TrimEnd();
            if (targetDatabase == DatabaseType.PostgreSql ||
                targetDatabase == DatabaseType.KingBase)
            {
                var pagination = " LIMIT " +
                    limit.Count.ToString(CultureInfo.InvariantCulture);
                if (limit.Offset > 0)
                {
                    pagination += " OFFSET " +
                        limit.Offset.ToString(CultureInfo.InvariantCulture);
                }
                return prefix + pagination + suffix;
            }

            if (limit.Offset == 0)
            {
                return prefix +
                       " FETCH FIRST " + limit.Count.ToString(CultureInfo.InvariantCulture) +
                       " ROWS ONLY" + suffix;
            }

            return prefix +
                   " OFFSET " + limit.Offset.ToString(CultureInfo.InvariantCulture) +
                   " ROWS FETCH NEXT " + limit.Count.ToString(CultureInfo.InvariantCulture) +
                   " ROWS ONLY" + suffix;
        }

        private static bool IsCompatibilityTarget(DatabaseType databaseType)
        {
            return IsSqlServer(databaseType) ||
                   databaseType == DatabaseType.PostgreSql ||
                   databaseType == DatabaseType.KingBase ||
                   databaseType == DatabaseType.Oracle ||
                   databaseType == DatabaseType.DaMeng;
        }

        private static bool IsSqlServer(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer ||
                   databaseType == DatabaseType.SqlServer9;
        }

        private static string RewriteRange(
            IReadOnlyList<Token> tokens,
            int start,
            int end,
            DatabaseType targetDatabase)
        {
            var result = new StringBuilder();
            var index = start;
            while (index < end)
            {
                var token = tokens[index];
                if (token.Kind == TokenKind.BacktickIdentifier)
                {
                    result.Append(QuoteBacktickIdentifier(token.Text, targetDatabase));
                    index++;
                    continue;
                }

                if (token.Kind != TokenKind.Word)
                {
                    result.Append(token.Text);
                    index++;
                    continue;
                }

                if (IsWord(token, "TIMESTAMPDIFF") &&
                    TryRewriteTimestampDiff(
                        tokens, index, end, targetDatabase,
                        out var timestampDiff, out var nextIndex))
                {
                    result.Append(timestampDiff);
                    index = nextIndex;
                    continue;
                }

                if (IsWord(token, "NOW") &&
                    TryFindEmptyFunctionCall(tokens, index, end, out var nowEnd))
                {
                    result.Append("CURRENT_TIMESTAMP");
                    index = nowEnd;
                    continue;
                }

                if (IsWord(token, "DATABASE") &&
                    TryFindEmptyFunctionCall(tokens, index, end, out var databaseEnd))
                {
                    result.Append(CurrentSchemaExpression(targetDatabase));
                    index = databaseEnd;
                    continue;
                }

                if (IsWord(token, "IFNULL") &&
                    NextNonWhitespaceIs(tokens, index + 1, end, "("))
                {
                    result.Append("COALESCE");
                    index++;
                    continue;
                }

                result.Append(token.Text);
                index++;
            }

            return result.ToString();
        }

        private static string CurrentSchemaExpression(DatabaseType targetDatabase)
        {
            if (IsSqlServer(targetDatabase)) return "SCHEMA_NAME()";
            if (targetDatabase == DatabaseType.Oracle)
                return "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')";
            if (targetDatabase == DatabaseType.PostgreSql ||
                targetDatabase == DatabaseType.KingBase)
            {
                return "CURRENT_SCHEMA()";
            }
            return "CURRENT_SCHEMA";
        }

        private static bool TryRewriteTimestampDiff(
            IReadOnlyList<Token> tokens,
            int functionIndex,
            int end,
            DatabaseType targetDatabase,
            out string rewritten,
            out int nextIndex)
        {
            rewritten = null;
            nextIndex = functionIndex;

            var openIndex = SkipWhitespace(tokens, functionIndex + 1, end);
            if (openIndex >= end || !IsSymbol(tokens[openIndex], "(")) return false;

            var depth = 0;
            var commas = new List<int>(2);
            var closeIndex = -1;
            for (var i = openIndex + 1; i < end; i++)
            {
                if (tokens[i].Kind != TokenKind.Symbol) continue;
                if (tokens[i].Text == "(")
                {
                    depth++;
                }
                else if (tokens[i].Text == ")")
                {
                    if (depth == 0)
                    {
                        closeIndex = i;
                        break;
                    }
                    depth--;
                }
                else if (tokens[i].Text == "," && depth == 0)
                {
                    commas.Add(i);
                }
            }

            if (closeIndex < 0 || commas.Count != 2) return false;

            var unitStart = SkipWhitespace(tokens, openIndex + 1, commas[0]);
            var unitEnd = TrimWhitespaceEnd(tokens, unitStart, commas[0]);
            if (unitEnd - unitStart != 1 || tokens[unitStart].Kind != TokenKind.Word)
                return false;

            var unit = tokens[unitStart].Text.ToUpperInvariant();
            if (unit != "SECOND" && unit != "MINUTE" &&
                unit != "HOUR" && unit != "DAY")
            {
                return false;
            }

            var startExpression = RewriteRange(
                tokens,
                SkipWhitespace(tokens, commas[0] + 1, commas[1]),
                TrimWhitespaceEnd(tokens, commas[0] + 1, commas[1]),
                targetDatabase).Trim();
            var endExpression = RewriteRange(
                tokens,
                SkipWhitespace(tokens, commas[1] + 1, closeIndex),
                TrimWhitespaceEnd(tokens, commas[1] + 1, closeIndex),
                targetDatabase).Trim();
            if (startExpression.Length == 0 || endExpression.Length == 0)
                return false;

            if (IsSqlServer(targetDatabase))
            {
                rewritten = "DATEDIFF(" + unit + ", " +
                            startExpression + ", " + endExpression + ")";
            }
            else if (targetDatabase == DatabaseType.PostgreSql ||
                     targetDatabase == DatabaseType.KingBase)
            {
                var divisor = unit == "SECOND" ? "1" :
                    unit == "MINUTE" ? "60" :
                    unit == "HOUR" ? "3600" : "86400";
                rewritten = "CAST(TRUNC(EXTRACT(EPOCH FROM ((" + endExpression +
                            ") - (" + startExpression + "))) / " + divisor +
                            ") AS BIGINT)";
            }
            else
            {
                var multiplier = unit == "SECOND" ? "86400" :
                    unit == "MINUTE" ? "1440" :
                    unit == "HOUR" ? "24" : "1";
                rewritten = "TRUNC((CAST(" + endExpression + " AS DATE) - CAST(" +
                            startExpression + " AS DATE)) * " + multiplier + ")";
            }

            nextIndex = closeIndex + 1;
            return true;
        }

        private static bool TryFindEmptyFunctionCall(
            IReadOnlyList<Token> tokens,
            int functionIndex,
            int end,
            out int nextIndex)
        {
            nextIndex = functionIndex;
            var openIndex = SkipWhitespace(tokens, functionIndex + 1, end);
            if (openIndex >= end || !IsSymbol(tokens[openIndex], "(")) return false;
            var closeIndex = SkipWhitespace(tokens, openIndex + 1, end);
            if (closeIndex >= end || !IsSymbol(tokens[closeIndex], ")")) return false;
            nextIndex = closeIndex + 1;
            return true;
        }

        private static bool NextNonWhitespaceIs(
            IReadOnlyList<Token> tokens,
            int start,
            int end,
            string symbol)
        {
            var index = SkipWhitespace(tokens, start, end);
            return index < end && IsSymbol(tokens[index], symbol);
        }

        private static string QuoteBacktickIdentifier(
            string tokenText,
            DatabaseType targetDatabase)
        {
            var value = tokenText.Length >= 2
                ? tokenText.Substring(1, tokenText.Length - 2)
                    .Replace("``", "`")
                : string.Empty;
            if (targetDatabase == DatabaseType.DaMeng)
            {
                value = Dm8IdentifierCompatibility.ToPhysicalColumn(value);
            }
            if (IsSqlServer(targetDatabase))
            {
                return "[" + value.Replace("]", "]]" ) + "]";
            }

            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }

        private static bool TryFindTailLimit(
            IReadOnlyList<Token> tokens,
            out LimitClause clause)
        {
            clause = default(LimitClause);
            var meaningful = new List<int>();
            for (var i = 0; i < tokens.Count; i++)
            {
                if (!IsTrivia(tokens[i])) meaningful.Add(i);
            }

            if (meaningful.Count > 0 &&
                IsSymbol(tokens[meaningful[meaningful.Count - 1]], ";"))
            {
                meaningful.RemoveAt(meaningful.Count - 1);
            }

            if (meaningful.Count < 2) return false;

            int limitIndex;
            int endIndex;
            int offset;
            int count;
            var last = meaningful.Count - 1;
            if (meaningful.Count >= 4 &&
                IsWord(tokens[meaningful[last - 3]], "LIMIT") &&
                TryReadInteger(tokens[meaningful[last - 2]], out count) &&
                IsWord(tokens[meaningful[last - 1]], "OFFSET") &&
                TryReadInteger(tokens[meaningful[last]], out offset))
            {
                limitIndex = meaningful[last - 3];
                endIndex = meaningful[last] + 1;
            }
            else if (meaningful.Count >= 4 &&
                     IsWord(tokens[meaningful[last - 3]], "LIMIT") &&
                     TryReadInteger(tokens[meaningful[last - 2]], out offset) &&
                     IsSymbol(tokens[meaningful[last - 1]], ",") &&
                     TryReadInteger(tokens[meaningful[last]], out count))
            {
                limitIndex = meaningful[last - 3];
                endIndex = meaningful[last] + 1;
            }
            else if (IsWord(tokens[meaningful[last - 1]], "LIMIT") &&
                     TryReadInteger(tokens[meaningful[last]], out count))
            {
                offset = 0;
                limitIndex = meaningful[last - 1];
                endIndex = meaningful[last] + 1;
            }
            else
            {
                return false;
            }

            if (GetParenthesisDepth(tokens, 0, limitIndex) != 0 ||
                ContainsComment(tokens, limitIndex, endIndex))
            {
                return false;
            }

            clause = new LimitClause(limitIndex, endIndex, offset, count);
            return true;
        }

        private static bool TryRewriteSelectWithTop(
            IReadOnlyList<Token> tokens,
            int end,
            int count,
            DatabaseType targetDatabase,
            out string sql)
        {
            sql = null;
            var depth = 0;
            var selectIndex = -1;
            for (var i = 0; i < end; i++)
            {
                if (tokens[i].Kind == TokenKind.Symbol)
                {
                    if (tokens[i].Text == "(") depth++;
                    else if (tokens[i].Text == ")" && depth > 0) depth--;
                }
                else if (depth == 0 && IsWord(tokens[i], "SELECT"))
                {
                    selectIndex = i;
                    break;
                }
            }

            if (selectIndex < 0) return false;

            var insertAfter = selectIndex;
            var next = SkipTrivia(tokens, selectIndex + 1, end);
            if (next < end &&
                (IsWord(tokens[next], "DISTINCT") || IsWord(tokens[next], "ALL")))
            {
                insertAfter = next;
            }

            sql = RewriteRange(tokens, 0, insertAfter + 1, targetDatabase) +
                  " TOP (" + count.ToString(CultureInfo.InvariantCulture) + ")" +
                  RewriteRange(tokens, insertAfter + 1, end, targetDatabase);
            return true;
        }

        private static bool HasTopLevelOrderBy(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            var depth = 0;
            for (var i = start; i < end; i++)
            {
                if (tokens[i].Kind == TokenKind.Symbol)
                {
                    if (tokens[i].Text == "(") depth++;
                    else if (tokens[i].Text == ")" && depth > 0) depth--;
                    continue;
                }

                if (depth != 0 || !IsWord(tokens[i], "ORDER")) continue;
                var next = SkipTrivia(tokens, i + 1, end);
                if (next < end && IsWord(tokens[next], "BY")) return true;
            }

            return false;
        }

        private static int GetParenthesisDepth(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            var depth = 0;
            for (var i = start; i < end; i++)
            {
                if (tokens[i].Kind != TokenKind.Symbol) continue;
                if (tokens[i].Text == "(") depth++;
                else if (tokens[i].Text == ")") depth--;
            }
            return depth;
        }

        private static bool ContainsComment(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            for (var i = start; i < end; i++)
            {
                if (tokens[i].Kind == TokenKind.LineComment ||
                    tokens[i].Kind == TokenKind.BlockComment)
                {
                    return true;
                }
            }
            return false;
        }

        private static bool TryReadInteger(Token token, out int value)
        {
            value = 0;
            return token.Kind == TokenKind.Number &&
                   int.TryParse(token.Text, NumberStyles.None,
                       CultureInfo.InvariantCulture, out value);
        }

        private static int SkipWhitespace(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            while (start < end && tokens[start].Kind == TokenKind.Whitespace) start++;
            return start;
        }

        private static int TrimWhitespaceEnd(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            while (end > start && tokens[end - 1].Kind == TokenKind.Whitespace) end--;
            return end;
        }

        private static int SkipTrivia(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            while (start < end && IsTrivia(tokens[start])) start++;
            return start;
        }

        private static bool IsTrivia(Token token)
        {
            return token.Kind == TokenKind.Whitespace ||
                   token.Kind == TokenKind.LineComment ||
                   token.Kind == TokenKind.BlockComment;
        }

        private static bool IsWord(Token token, string value)
        {
            return token.Kind == TokenKind.Word &&
                   string.Equals(token.Text, value, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsSymbol(Token token, string value)
        {
            return token.Kind == TokenKind.Symbol && token.Text == value;
        }

        private static string RenderOriginal(
            IReadOnlyList<Token> tokens,
            int start,
            int end)
        {
            var result = new StringBuilder();
            for (var i = start; i < end; i++) result.Append(tokens[i].Text);
            return result.ToString();
        }

        private static List<Token> Tokenize(string sql)
        {
            var tokens = new List<Token>();
            var index = 0;
            while (index < sql.Length)
            {
                var start = index;
                var current = sql[index];

                if (TryReadOracleAlternativeQuoted(sql, index, out var oracleQuotedEnd))
                {
                    index = oracleQuotedEnd;
                    AddToken(tokens, TokenKind.SingleQuoted, sql, start, index);
                    continue;
                }

                if (char.IsWhiteSpace(current))
                {
                    index++;
                    while (index < sql.Length && char.IsWhiteSpace(sql[index])) index++;
                    AddToken(tokens, TokenKind.Whitespace, sql, start, index);
                    continue;
                }

                if (current == '-' && index + 1 < sql.Length && sql[index + 1] == '-')
                {
                    index += 2;
                    while (index < sql.Length && sql[index] != '\r' && sql[index] != '\n') index++;
                    AddToken(tokens, TokenKind.LineComment, sql, start, index);
                    continue;
                }

                if (current == '#')
                {
                    index++;
                    while (index < sql.Length && sql[index] != '\r' && sql[index] != '\n') index++;
                    AddToken(tokens, TokenKind.LineComment, sql, start, index);
                    continue;
                }

                if (current == '/' && index + 1 < sql.Length && sql[index + 1] == '*')
                {
                    index += 2;
                    var commentDepth = 1;
                    while (index + 1 < sql.Length && commentDepth > 0)
                    {
                        if (sql[index] == '/' && sql[index + 1] == '*')
                        {
                            commentDepth++;
                            index += 2;
                        }
                        else if (sql[index] == '*' && sql[index + 1] == '/')
                        {
                            commentDepth--;
                            index += 2;
                        }
                        else
                        {
                            index++;
                        }
                    }
                    if (commentDepth > 0) index = sql.Length;
                    AddToken(tokens, TokenKind.BlockComment, sql, start, index);
                    continue;
                }

                if (current == '$' && TryReadDollarQuoted(sql, index, out var dollarEnd))
                {
                    index = dollarEnd;
                    AddToken(tokens, TokenKind.DollarQuoted, sql, start, index);
                    continue;
                }

                if (current == '\'' || current == '"' || current == '`' || current == '[')
                {
                    var kind = current == '\'' ? TokenKind.SingleQuoted :
                        current == '"' ? TokenKind.DoubleQuoted :
                        current == '`' ? TokenKind.BacktickIdentifier :
                        TokenKind.BracketQuoted;
                    var closing = current == '[' ? ']' : current;
                    index++;
                    while (index < sql.Length)
                    {
                        if (sql[index] == '\\' && closing != ']')
                        {
                            index = Math.Min(index + 2, sql.Length);
                            continue;
                        }

                        if (sql[index] != closing)
                        {
                            index++;
                            continue;
                        }

                        if (index + 1 < sql.Length && sql[index + 1] == closing)
                        {
                            index += 2;
                            continue;
                        }

                        index++;
                        break;
                    }
                    AddToken(tokens, kind, sql, start, index);
                    continue;
                }

                if (char.IsLetter(current) || current == '_' || current == '$')
                {
                    index++;
                    while (index < sql.Length &&
                           (char.IsLetterOrDigit(sql[index]) || sql[index] == '_' || sql[index] == '$'))
                    {
                        index++;
                    }
                    AddToken(tokens, TokenKind.Word, sql, start, index);
                    continue;
                }

                if (char.IsDigit(current))
                {
                    index++;
                    while (index < sql.Length && char.IsDigit(sql[index])) index++;
                    AddToken(tokens, TokenKind.Number, sql, start, index);
                    continue;
                }

                index++;
                AddToken(tokens, TokenKind.Symbol, sql, start, index);
            }

            return tokens;
        }

        private static bool TryReadOracleAlternativeQuoted(
            string sql,
            int start,
            out int end)
        {
            end = start;
            var quoteIndex = -1;
            if (start + 2 < sql.Length &&
                (sql[start] == 'q' || sql[start] == 'Q') &&
                sql[start + 1] == '\'')
            {
                quoteIndex = start + 1;
            }
            else if (start + 3 < sql.Length &&
                     (sql[start] == 'n' || sql[start] == 'N') &&
                     (sql[start + 1] == 'q' || sql[start + 1] == 'Q') &&
                     sql[start + 2] == '\'')
            {
                quoteIndex = start + 2;
            }

            if (quoteIndex < 0 || quoteIndex + 1 >= sql.Length) return false;
            var opening = sql[quoteIndex + 1];
            var closing = opening == '[' ? ']' :
                opening == '{' ? '}' :
                opening == '(' ? ')' :
                opening == '<' ? '>' : opening;
            for (var i = quoteIndex + 2; i + 1 < sql.Length; i++)
            {
                if (sql[i] == closing && sql[i + 1] == '\'')
                {
                    end = i + 2;
                    return true;
                }
            }

            return false;
        }

        private static bool TryReadDollarQuoted(string sql, int start, out int end)
        {
            end = start;
            var delimiterEnd = start + 1;
            while (delimiterEnd < sql.Length &&
                   (char.IsLetterOrDigit(sql[delimiterEnd]) || sql[delimiterEnd] == '_'))
            {
                delimiterEnd++;
            }

            if (delimiterEnd >= sql.Length || sql[delimiterEnd] != '$') return false;
            var delimiter = sql.Substring(start, delimiterEnd - start + 1);
            var closing = sql.IndexOf(delimiter, delimiterEnd + 1, StringComparison.Ordinal);
            if (closing < 0) return false;
            end = closing + delimiter.Length;
            return true;
        }

        private static void AddToken(
            ICollection<Token> tokens,
            TokenKind kind,
            string sql,
            int start,
            int end)
        {
            tokens.Add(new Token(kind, sql.Substring(start, end - start)));
        }

        private enum TokenKind
        {
            Word,
            Number,
            Symbol,
            Whitespace,
            SingleQuoted,
            DoubleQuoted,
            BracketQuoted,
            BacktickIdentifier,
            DollarQuoted,
            LineComment,
            BlockComment
        }

        private sealed class Token
        {
            internal Token(TokenKind kind, string text)
            {
                Kind = kind;
                Text = text;
            }

            internal TokenKind Kind { get; }
            internal string Text { get; }
        }

        private readonly struct LimitClause
        {
            internal LimitClause(int startTokenIndex, int endTokenIndex, int offset, int count)
            {
                StartTokenIndex = startTokenIndex;
                EndTokenIndex = endTokenIndex;
                Offset = offset;
                Count = count;
            }

            internal int StartTokenIndex { get; }
            internal int EndTokenIndex { get; }
            internal int Offset { get; }
            internal int Count { get; }
        }
    }
}
