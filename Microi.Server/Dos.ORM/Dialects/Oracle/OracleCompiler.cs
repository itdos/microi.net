using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.Platform;
using Dos.ORM.Dialects.Dm8;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Oracle
{
    internal enum OracleFamilyDialect
    {
        Oracle,
        Dm8
    }

    internal sealed class OracleCompiler : SqlCompilerBase
    {
        private static readonly OracleLogicalTextLowerer TextLowerer =
            new OracleLogicalTextLowerer();

        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile)
        {
            return OracleCapabilities.For(profile);
        }

        internal override SqlNode Lower(
            SqlNode node,
            SqlLoweringContext context)
        {
            TextLowerer.ValidateStorageContract(context);
            var select = node as SelectStatement;
            if (select != null
                && select.Page is OffsetPageSpec
                && context.DialectProfile.ServerVersion.Major == 11)
            {
                throw Unsupported(
                    context,
                    "oracle11g.pagination_private_ir_required",
                    "$.Page");
            }
            return node;
        }

        internal override SqlNode Optimize(
            SqlNode node,
            SqlLoweringContext context)
        {
            return node;
        }

        internal override RenderedSql Render(
            AllocatedSqlNode node,
            SqlLoweringContext context)
        {
            return OracleFamilyCompiler.Render(
                node,
                context,
                OracleFamilyDialect.Oracle,
                "oracle");
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context)
        {
            return OracleFamilyCompiler.DeriveEffectiveImpact(source);
        }

        private static UnsupportedDatabaseCapabilityException Unsupported(
            SqlLoweringContext context,
            string feature,
            string path)
        {
            return new UnsupportedDatabaseCapabilityException(
                context.DialectProfile, feature, path);
        }
    }

    internal static class OracleFamilyCompiler
    {
        internal static RenderedSql Render(
            AllocatedSqlNode node,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (node == null)
            {
                throw new ArgumentNullException(nameof(node));
            }
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }
            if (!Enum.IsDefined(typeof(OracleFamilyDialect), dialect))
            {
                throw new ArgumentOutOfRangeException(nameof(dialect));
            }
            if (string.IsNullOrEmpty(featurePrefix))
            {
                throw new ArgumentException(
                    "Feature prefix is required.", nameof(featurePrefix));
            }

            var statement = node.Root as SqlStatement;
            if (statement == null)
            {
                throw Unsupported(
                    context, featurePrefix, "statement_family", "$");
            }
            var select = statement as SelectStatement;
            if (select != null)
            {
                return RenderSelectPlan(
                    select,
                    node.ParameterSlots,
                    context,
                    dialect,
                    featurePrefix);
            }

            throw Unsupported(context, featurePrefix, "statement", "$");
        }

        internal static DestructiveImpact DeriveEffectiveImpact(SqlNode source)
        {
            var schema = source as SchemaOperation;
            if (schema != null)
            {
                return schema.Impact;
            }
            var admin = source as DatabaseAdminOperation;
            return admin == null
                ? DestructiveImpact.None
                : admin.Impact;
        }

        private static RenderedSql RenderSelectPlan(
            SelectStatement statement,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            var dataWriter = NewWriter();
            WriteSelect(
                statement,
                dataWriter,
                slots,
                context,
                dialect,
                featurePrefix);
            var data = CreateCommand(
                dataWriter.Snapshot(),
                SqlResultShape.RowSet,
                PlanResultRole.Final,
                PlanTransactionBehavior.Enlistable,
                context,
                featurePrefix,
                CreateResultContracts(statement, context));
            if (statement.Page == null)
            {
                return RenderedSql.ForCommands(new[] { data });
            }
            if (!(statement.Page is OffsetPageSpec))
            {
                throw Unsupported(
                    context, featurePrefix, "keyset_page", "$.Page");
            }

            var countWriter = NewWriter();
            countWriter.AppendKeyword(SqlKeyword.Select);
            countWriter.AppendSpace();
            countWriter.AppendKeyword(SqlKeyword.Count);
            countWriter.AppendOpenParenthesis();
            countWriter.AppendOperator(SqlOperatorToken.Multiply);
            countWriter.AppendCloseParenthesis();
            countWriter.AppendSpace();
            countWriter.AppendKeyword(SqlKeyword.From);
            countWriter.AppendSpace();
            countWriter.AppendOpenParenthesis();
            WriteSelect(
                WithoutPagination(statement),
                countWriter,
                slots,
                context,
                dialect,
                featurePrefix);
            countWriter.AppendCloseParenthesis();
            countWriter.AppendSpace();
            countWriter.AppendIdentifierSegment("__dosorm_count");
            var count = CreateCommand(
                countWriter.Snapshot(),
                SqlResultShape.Scalar,
                PlanResultRole.Aggregate,
                PlanTransactionBehavior.Enlistable,
                context,
                featurePrefix,
                new[]
                {
                    new SqlResultValueContract(
                        0,
                        new SqlValueContract(LogicalDbType.Int64))
                });
            return RenderedSql.ForCommands(new[] { count, data });
        }

        private static SelectStatement WithoutPagination(
            SelectStatement statement)
        {
            if (statement.From == null)
            {
                return new SelectStatement(
                    statement.Projections,
                    statement.Distinct,
                    statement.Where,
                    statement.GroupBy,
                    statement.Having,
                    Array.Empty<OrderByExpression>(),
                    null,
                    null,
                    statement.CommonTableExpressions,
                    statement.SetOperations);
            }
            return new SelectStatement(
                statement.From,
                statement.Projections,
                statement.Distinct,
                statement.Where,
                statement.GroupBy,
                statement.Having,
                Array.Empty<OrderByExpression>(),
                null,
                null,
                statement.CommonTableExpressions,
                statement.SetOperations);
        }

        private static void WriteSelect(
            SelectStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (statement.SetOperations.Count != 0)
            {
                throw Unsupported(
                    context, featurePrefix, "set_operation", "$.SetOperations");
            }
            WriteCtes(
                statement,
                writer,
                slots,
                context,
                dialect,
                featurePrefix);
            writer.AppendKeyword(SqlKeyword.Select);
            if (statement.Distinct)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Distinct);
            }
            writer.AppendSpace();
            for (var index = 0; index < statement.Projections.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                var projection = statement.Projections[index];
                WriteExpression(
                    projection.Expression,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: true);
                WriteAlias(projection.Alias, writer, allowAs: true);
            }
            if (statement.From != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.From);
                writer.AppendSpace();
                WriteTableSource(
                    statement.From,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
            }
            if (statement.Where != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Where);
                writer.AppendSpace();
                WriteExpression(
                    statement.Where,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
            }
            if (statement.GroupBy.Count != 0)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Group);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.By);
                writer.AppendSpace();
                WriteExpressions(
                    statement.GroupBy,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
            }
            if (statement.Having != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Having);
                writer.AppendSpace();
                WriteExpression(
                    statement.Having,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
            }
            WriteOrderBy(
                statement.OrderBy,
                writer,
                slots,
                context,
                dialect,
                featurePrefix);
            WritePage(statement.Page, writer, context, dialect, featurePrefix);
            WriteLock(statement.Lock, writer, context, featurePrefix);
        }

        private static void WriteCtes(
            SelectStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (statement.CommonTableExpressions.Count == 0)
            {
                return;
            }
            for (var index = 0;
                 index < statement.CommonTableExpressions.Count;
                 index++)
            {
                if (statement.CommonTableExpressions[index].Recursive)
                {
                    throw Unsupported(
                        context,
                        featurePrefix,
                        "recursive_cte",
                        "$.CommonTableExpressions["
                        + index.ToString(CultureInfo.InvariantCulture)
                        + "]");
                }
            }

            writer.AppendKeyword(SqlKeyword.With);
            writer.AppendSpace();
            for (var index = 0;
                 index < statement.CommonTableExpressions.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                var cte = statement.CommonTableExpressions[index];
                writer.AppendIdentifierSegment(cte.Name.Value);
                if (cte.Columns.Count != 0)
                {
                    writer.AppendOpenParenthesis();
                    WriteIdentifiers(cte.Columns, writer);
                    writer.AppendCloseParenthesis();
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.As);
                writer.AppendSpace();
                writer.AppendOpenParenthesis();
                WriteSelect(
                    cte.Query,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                writer.AppendCloseParenthesis();
            }
            writer.AppendSpace();
        }

        private static void WriteTableSource(
            SqlTableSource source,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            var named = source as NamedTableSource;
            if (named != null)
            {
                WriteObjectName(named.Name, writer, context, featurePrefix);
                WriteAlias(named.Alias, writer, allowAs: false);
                return;
            }
            var derived = source as DerivedTableSource;
            if (derived != null)
            {
                writer.AppendOpenParenthesis();
                WriteSelect(
                    derived.Query,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                writer.AppendCloseParenthesis();
                WriteAlias(derived.Alias, writer, allowAs: false);
                return;
            }
            var join = source as JoinSource;
            if (join == null)
            {
                throw Unsupported(
                    context, featurePrefix, "table_source", "$");
            }
            WriteTableSource(
                join.Left,
                writer,
                slots,
                context,
                dialect,
                featurePrefix);
            writer.AppendSpace();
            WriteJoinKeyword(join.JoinType, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Join);
            writer.AppendSpace();
            WriteTableSource(
                join.Right,
                writer,
                slots,
                context,
                dialect,
                featurePrefix);
            if (join.Condition != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.On);
                writer.AppendSpace();
                WriteExpression(
                    join.Condition,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
            }
        }

        private static void WriteJoinKeyword(
            SqlJoinType joinType,
            SqlTextWriter writer)
        {
            switch (joinType)
            {
                case SqlJoinType.Inner:
                    writer.AppendKeyword(SqlKeyword.Inner);
                    return;
                case SqlJoinType.Left:
                    writer.AppendKeyword(SqlKeyword.Left);
                    return;
                case SqlJoinType.Right:
                    writer.AppendKeyword(SqlKeyword.Right);
                    return;
                case SqlJoinType.Full:
                    writer.AppendKeyword(SqlKeyword.Full);
                    return;
                case SqlJoinType.Cross:
                    writer.AppendKeyword(SqlKeyword.Cross);
                    return;
                default:
                    throw new ArgumentOutOfRangeException(nameof(joinType));
            }
        }

        private static void WriteOrderBy(
            IReadOnlyList<OrderByExpression> orderBy,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (orderBy.Count == 0)
            {
                return;
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Order);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.By);
            writer.AppendSpace();
            for (var index = 0; index < orderBy.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                var item = orderBy[index];
                WriteExpression(
                    item.Expression,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendSpace();
                writer.AppendKeyword(
                    item.Direction == SqlSortDirection.Ascending
                        ? SqlKeyword.Asc
                        : SqlKeyword.Desc);
                if (item.NullSortOrder != SqlNullSortOrder.Default)
                {
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.Nulls);
                    writer.AppendSpace();
                    writer.AppendKeyword(
                        item.NullSortOrder == SqlNullSortOrder.First
                            ? SqlKeyword.First
                            : SqlKeyword.Last);
                }
            }
        }

        private static void WritePage(
            PageSpec page,
            SqlTextWriter writer,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (page == null)
            {
                return;
            }
            var offset = page as OffsetPageSpec;
            if (offset == null)
            {
                throw Unsupported(
                    context, featurePrefix, "keyset_page", "$.Page");
            }
            if (dialect == OracleFamilyDialect.Dm8)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Limit);
                writer.AppendSpace();
                writer.AppendStructuralInt(offset.Limit);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Offset);
                writer.AppendSpace();
                writer.AppendStructuralInt(offset.Offset);
                return;
            }
            if (!context.Capabilities.SupportsOffsetFetchPagination)
            {
                throw Unsupported(
                    context, featurePrefix, "offset_fetch", "$.Page");
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Offset);
            writer.AppendSpace();
            writer.AppendStructuralInt(offset.Offset);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Rows);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Fetch);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Next);
            writer.AppendSpace();
            writer.AppendStructuralInt(offset.Limit);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Rows);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Only);
        }

        private static void WriteLock(
            LockSpec spec,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            if (spec == null)
            {
                return;
            }
            if (!context.Capabilities.SupportsForUpdateLock)
            {
                throw Unsupported(
                    context, featurePrefix, "for_update", "$.Lock");
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.For);
            writer.AppendSpace();
            if (spec.Mode == SqlLockMode.Update)
            {
                writer.AppendKeyword(SqlKeyword.Update);
            }
            else
            {
                writer.AppendKeyword(SqlKeyword.Share);
            }
            if (spec.Wait == SqlLockWait.NoWait)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.NoWait);
            }
            else if (spec.Wait == SqlLockWait.SkipLocked)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.SkipLocked);
            }
        }

        private static void WriteExpression(
            SqlExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix,
            bool logicalTextResult)
        {
            var column = expression as ColumnExpression;
            if (column != null)
            {
                if (logicalTextResult
                    && TryGetEncodedColumnContract(
                        column, context, out _, out _))
                {
                    WriteDecodedColumn(column, writer, dialect);
                }
                else
                {
                    WriteColumn(column, writer, dialect);
                }
                return;
            }
            var parameter = expression as ParameterExpression;
            if (parameter != null)
            {
                writer.AppendParameter(FindSlot(parameter.Definition, slots));
                return;
            }
            if (expression is NullExpression)
            {
                writer.AppendKeyword(SqlKeyword.Null);
                return;
            }
            var boolean = expression as BooleanExpression;
            if (boolean != null)
            {
                writer.AppendOpenParenthesis();
                writer.AppendStructuralInt(1);
                writer.AppendOperator(
                    boolean.Value
                        ? SqlOperatorToken.Equal
                        : SqlOperatorToken.NotEqual);
                writer.AppendStructuralInt(1);
                writer.AppendCloseParenthesis();
                return;
            }
            var binary = expression as BinaryExpression;
            if (binary != null)
            {
                writer.AppendOpenParenthesis();
                WriteExpression(
                    binary.Left,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendSpace();
                WriteBinaryOperator(binary.Operator, writer);
                writer.AppendSpace();
                WriteExpression(
                    binary.Right,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendCloseParenthesis();
                return;
            }
            var unary = expression as UnaryExpression;
            if (unary != null)
            {
                WriteUnary(
                    unary,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                return;
            }
            var values = expression as InExpression;
            if (values != null)
            {
                if (values.Values.Count == 0)
                {
                    writer.AppendOpenParenthesis();
                    writer.AppendStructuralInt(1);
                    writer.AppendOperator(SqlOperatorToken.NotEqual);
                    writer.AppendStructuralInt(1);
                    writer.AppendCloseParenthesis();
                    return;
                }
                writer.AppendOpenParenthesis();
                WriteExpression(
                    values.Operand,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.In);
                writer.AppendSpace();
                writer.AppendOpenParenthesis();
                WriteExpressions(
                    values.Values,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendCloseParenthesis();
                writer.AppendCloseParenthesis();
                return;
            }
            var between = expression as BetweenExpression;
            if (between != null)
            {
                writer.AppendOpenParenthesis();
                WriteExpression(
                    between.Operand, writer, slots, context, dialect,
                    featurePrefix, false);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Between);
                writer.AppendSpace();
                WriteExpression(
                    between.Lower, writer, slots, context, dialect,
                    featurePrefix, false);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.And);
                writer.AppendSpace();
                WriteExpression(
                    between.Upper, writer, slots, context, dialect,
                    featurePrefix, false);
                writer.AppendCloseParenthesis();
                return;
            }
            var function = expression as FunctionExpression;
            if (function != null)
            {
                WriteFunction(
                    function,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                return;
            }
            var aggregate = expression as AggregateExpression;
            if (aggregate != null)
            {
                WriteAggregate(
                    aggregate,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                return;
            }
            var wildcard = expression as WildcardExpression;
            if (wildcard != null)
            {
                if (wildcard.Source != null)
                {
                    writer.AppendIdentifierSegment(
                        wildcard.Source.Identifier.Value);
                    writer.AppendDot();
                }
                writer.AppendOperator(SqlOperatorToken.Multiply);
                return;
            }
            var subquery = expression as SubqueryExpression;
            if (subquery != null)
            {
                var query = subquery.Query as SelectStatement;
                if (query == null)
                {
                    throw Unsupported(
                        context, featurePrefix, "subquery_family", "$");
                }
                writer.AppendOpenParenthesis();
                WriteSelect(
                    query,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                writer.AppendCloseParenthesis();
                return;
            }
            var exists = expression as ExistsExpression;
            if (exists != null)
            {
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
                WriteExpression(
                    exists.Subquery,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    false);
                return;
            }
            throw Unsupported(context, featurePrefix, "expression", "$");
        }

        private static void WriteFunction(
            FunctionExpression function,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (function.Function.Equals(SemanticFunctions.Length))
            {
                var argument = function.Arguments[0];
                writer.AppendKeyword(SqlKeyword.Length);
                writer.AppendOpenParenthesis();
                WriteExpression(
                    argument,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: false);
                writer.AppendCloseParenthesis();
                if (IsEncodedTextExpression(argument, context))
                {
                    writer.AppendOperator(SqlOperatorToken.Subtract);
                    writer.AppendStructuralInt(1);
                }
                return;
            }
            if (function.Function.Equals(SemanticFunctions.Substring))
            {
                writer.AppendKeyword(SqlKeyword.Substring);
            }
            else if (function.Function.Equals(SemanticFunctions.Coalesce))
            {
                writer.AppendKeyword(SqlKeyword.Coalesce);
            }
            else if (function.Function.Equals(SemanticFunctions.Round))
            {
                writer.AppendKeyword(SqlKeyword.Round);
            }
            else if (function.Function.Equals(SemanticFunctions.CurrentDateTime))
            {
                writer.AppendKeyword(SqlKeyword.CurrentTimestamp);
                return;
            }
            else if (function.Function.Equals(SemanticFunctions.Concat))
            {
                WriteConcat(
                    function.Arguments,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix);
                return;
            }
            else
            {
                throw Unsupported(
                    context,
                    featurePrefix,
                    "function." + function.Function.Key,
                    "$");
            }
            writer.AppendOpenParenthesis();
            WriteExpressions(
                function.Arguments,
                writer,
                slots,
                context,
                dialect,
                featurePrefix,
                logicalTextResult: true);
            writer.AppendCloseParenthesis();
        }

        private static void WriteConcat(
            IReadOnlyList<SqlExpression> arguments,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            writer.AppendOpenParenthesis();
            for (var index = 0; index < arguments.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendOperator(SqlOperatorToken.Concat);
                }
                WriteExpression(
                    arguments[index],
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: true);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteAggregate(
            AggregateExpression aggregate,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (aggregate.Function.Equals(SemanticFunctions.Count))
            {
                writer.AppendKeyword(SqlKeyword.Count);
            }
            else if (aggregate.Function.Equals(SemanticFunctions.Sum))
            {
                writer.AppendKeyword(SqlKeyword.Sum);
            }
            else if (aggregate.Function.Equals(SemanticFunctions.Avg))
            {
                writer.AppendKeyword(SqlKeyword.Avg);
            }
            else if (aggregate.Function.Equals(SemanticFunctions.Min))
            {
                writer.AppendKeyword(SqlKeyword.Min);
            }
            else if (aggregate.Function.Equals(SemanticFunctions.Max))
            {
                writer.AppendKeyword(SqlKeyword.Max);
            }
            else
            {
                throw Unsupported(
                    context, featurePrefix, "aggregate", "$");
            }
            writer.AppendOpenParenthesis();
            if (aggregate.Distinct)
            {
                writer.AppendKeyword(SqlKeyword.Distinct);
                writer.AppendSpace();
            }
            if (aggregate.Argument == null)
            {
                writer.AppendOperator(SqlOperatorToken.Multiply);
            }
            else
            {
                WriteExpression(
                    aggregate.Argument,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult: true);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteUnary(
            UnaryExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix)
        {
            if (expression.Operator == SqlUnaryOperator.Not)
            {
                writer.AppendKeyword(SqlKeyword.Not);
                writer.AppendSpace();
                WriteExpression(
                    expression.Operand,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    false);
                return;
            }
            if (expression.Operator == SqlUnaryOperator.Negate)
            {
                writer.AppendOperator(SqlOperatorToken.Subtract);
                WriteExpression(
                    expression.Operand,
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    false);
                return;
            }
            WriteExpression(
                expression.Operand,
                writer,
                slots,
                context,
                dialect,
                featurePrefix,
                false);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Is);
            if (expression.Operator == SqlUnaryOperator.IsNotNull)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Not);
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Null);
        }

        private static void WriteBinaryOperator(
            SqlBinaryOperator value,
            SqlTextWriter writer)
        {
            switch (value)
            {
                case SqlBinaryOperator.Equal:
                    writer.AppendOperator(SqlOperatorToken.Equal);
                    return;
                case SqlBinaryOperator.NotEqual:
                    writer.AppendOperator(SqlOperatorToken.NotEqual);
                    return;
                case SqlBinaryOperator.GreaterThan:
                    writer.AppendOperator(SqlOperatorToken.GreaterThan);
                    return;
                case SqlBinaryOperator.GreaterThanOrEqual:
                    writer.AppendOperator(SqlOperatorToken.GreaterThanOrEqual);
                    return;
                case SqlBinaryOperator.LessThan:
                    writer.AppendOperator(SqlOperatorToken.LessThan);
                    return;
                case SqlBinaryOperator.LessThanOrEqual:
                    writer.AppendOperator(SqlOperatorToken.LessThanOrEqual);
                    return;
                case SqlBinaryOperator.Add:
                    writer.AppendOperator(SqlOperatorToken.Add);
                    return;
                case SqlBinaryOperator.Subtract:
                    writer.AppendOperator(SqlOperatorToken.Subtract);
                    return;
                case SqlBinaryOperator.Multiply:
                    writer.AppendOperator(SqlOperatorToken.Multiply);
                    return;
                case SqlBinaryOperator.Divide:
                    writer.AppendOperator(SqlOperatorToken.Divide);
                    return;
                case SqlBinaryOperator.And:
                    writer.AppendKeyword(SqlKeyword.And);
                    return;
                case SqlBinaryOperator.Or:
                    writer.AppendKeyword(SqlKeyword.Or);
                    return;
                case SqlBinaryOperator.Like:
                    writer.AppendKeyword(SqlKeyword.Like);
                    return;
                default:
                    throw new ArgumentOutOfRangeException(nameof(value));
            }
        }

        private static void WriteExpressions(
            IReadOnlyList<SqlExpression> expressions,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            OracleFamilyDialect dialect,
            string featurePrefix,
            bool logicalTextResult)
        {
            for (var index = 0; index < expressions.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                WriteExpression(
                    expressions[index],
                    writer,
                    slots,
                    context,
                    dialect,
                    featurePrefix,
                    logicalTextResult);
            }
        }

        private static void WriteIdentifiers(
            IReadOnlyList<SqlIdentifier> identifiers,
            SqlTextWriter writer)
        {
            for (var index = 0; index < identifiers.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(identifiers[index].Value);
            }
        }

        private static void WriteColumn(
            ColumnExpression column,
            SqlTextWriter writer,
            OracleFamilyDialect dialect)
        {
            if (column.Source != null)
            {
                writer.AppendIdentifierSegment(column.Source.Identifier.Value);
                writer.AppendDot();
            }
            writer.AppendIdentifierSegment(
                PhysicalColumnName(column.Name.Value, dialect));
        }

        private static void WriteDecodedColumn(
            ColumnExpression column,
            SqlTextWriter writer,
            OracleFamilyDialect dialect)
        {
            writer.AppendKeyword(SqlKeyword.Case);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.When);
            writer.AppendSpace();
            WriteColumn(column, writer, dialect);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Is);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Null);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Then);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Null);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Else);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Substring);
            writer.AppendOpenParenthesis();
            WriteColumn(column, writer, dialect);
            writer.AppendComma();
            writer.AppendStructuralInt(2);
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.End);
        }

        private static void WriteAlias(
            SqlAlias alias,
            SqlTextWriter writer,
            bool allowAs)
        {
            if (alias == null)
            {
                return;
            }
            writer.AppendSpace();
            if (allowAs)
            {
                writer.AppendKeyword(SqlKeyword.As);
                writer.AppendSpace();
            }
            writer.AppendIdentifierSegment(alias.Identifier.Value);
        }

        private static void WriteObjectName(
            SqlObjectName name,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            if (name.Catalog != null)
            {
                throw Unsupported(
                    context,
                    featurePrefix,
                    "catalog_qualified_name",
                    "$");
            }
            if (name.Schema != null)
            {
                writer.AppendIdentifierSegment(name.Schema.Value);
                writer.AppendDot();
            }
            writer.AppendIdentifierSegment(name.Name.Value);
        }

        private static string PhysicalColumnName(
            string logicalName,
            OracleFamilyDialect dialect)
        {
            return dialect == OracleFamilyDialect.Dm8
                ? Dm8IdentifierCompatibility.ToPhysicalColumn(logicalName)
                : logicalName;
        }

        private static SqlTextWriter NewWriter()
        {
            return new SqlTextWriter(SqlTextDialectFamily.Oracle);
        }

        private static SqlCommandStep CreateCommand(
            SqlCommandTextSnapshot snapshot,
            SqlResultShape resultShape,
            PlanResultRole resultRole,
            PlanTransactionBehavior transactionBehavior,
            SqlLoweringContext context,
            string featurePrefix,
            IEnumerable<SqlResultValueContract> resultContracts)
        {
            if (StableWireBuffer.GetUtf8ByteCount(snapshot.CommandText)
                > context.Capabilities.MaxCommandTextLength)
            {
                throw Unsupported(
                    context, featurePrefix, "max_command_text", "$");
            }
            if (snapshot.Parameters.Count
                > context.Capabilities.MaxParametersPerCommand)
            {
                throw Unsupported(
                    context, featurePrefix, "max_parameters", "$");
            }

            var parameters = new List<SqlParameterValueContract>(
                snapshot.Parameters.Count);
            for (var index = 0;
                 index < snapshot.Parameters.Count;
                 index++)
            {
                var definition = snapshot.Parameters[index];
                parameters.Add(new SqlParameterValueContract(
                    definition,
                    new SqlValueContract(
                        definition.Type.LogicalType,
                        definition.Type.Length,
                        IsText(definition.Type.LogicalType)
                            ? LogicalTextEncoding.NonEmptyEnvelopeV1
                            : LogicalTextEncoding.Native)));
            }
            var valueContract = new SqlCommandValueContract(
                context.StorageContract,
                parameters,
                resultContracts ?? Array.Empty<SqlResultValueContract>());
            return new SqlCommandStep(
                snapshot.CommandText,
                snapshot.Parameters,
                snapshot.ParameterPlaceholders,
                resultShape,
                resultRole,
                PlanConnectionRole.CurrentDatabase,
                transactionBehavior,
                context.SourceMigrationStepId,
                valueContract);
        }

        private static IReadOnlyList<SqlResultValueContract>
            CreateResultContracts(
                SelectStatement statement,
                SqlLoweringContext context)
        {
            var results = new List<SqlResultValueContract>();
            for (var index = 0;
                 index < statement.Projections.Count;
                 index++)
            {
                var expression = statement.Projections[index].Expression;
                var column = expression as ColumnExpression;
                LogicalDbType logicalType;
                int? length;
                if (column != null
                    && TryGetEncodedColumnContract(
                        column, context, out logicalType, out length))
                {
                    results.Add(new SqlResultValueContract(
                        index,
                        new SqlValueContract(
                            logicalType,
                            length,
                            LogicalTextEncoding.NonEmptyEnvelopeV1)));
                    continue;
                }
                var parameter = expression as ParameterExpression;
                if (parameter != null)
                {
                    results.Add(new SqlResultValueContract(
                        index,
                        new SqlValueContract(
                            parameter.Definition.Type.LogicalType,
                            parameter.Definition.Type.Length,
                            IsText(parameter.Definition.Type.LogicalType)
                                ? LogicalTextEncoding.NonEmptyEnvelopeV1
                                : LogicalTextEncoding.Native)));
                    continue;
                }
                var function = expression as FunctionExpression;
                if (function != null
                    && function.Function.Equals(SemanticFunctions.Length))
                {
                    results.Add(new SqlResultValueContract(
                        index,
                        new SqlValueContract(LogicalDbType.Int32)));
                }
            }
            return results.AsReadOnly();
        }

        private static bool TryGetEncodedColumnContract(
            ColumnExpression column,
            SqlLoweringContext context,
            out LogicalDbType logicalType,
            out int? length)
        {
            var marker = "." + column.Name.Value + ":";
            for (var index = 0;
                 index < context.StorageContract.EncodedColumnKeys.Count;
                 index++)
            {
                var key = context.StorageContract.EncodedColumnKeys[index];
                if (key.IndexOf(marker, StringComparison.Ordinal) < 0)
                {
                    continue;
                }
                var parts = key.Split(':');
                if (parts.Length < 2
                    || !Enum.TryParse(parts[parts.Length - 2], out logicalType)
                    || !IsText(logicalType))
                {
                    continue;
                }
                int parsedLength;
                length = parts.Length >= 3
                    && int.TryParse(
                        parts[parts.Length - 1],
                        NumberStyles.None,
                        CultureInfo.InvariantCulture,
                        out parsedLength)
                    ? parsedLength
                    : (int?)null;
                return true;
            }
            logicalType = default(LogicalDbType);
            length = null;
            return false;
        }

        private static bool IsEncodedTextExpression(
            SqlExpression expression,
            SqlLoweringContext context)
        {
            var column = expression as ColumnExpression;
            if (column != null)
            {
                return TryGetEncodedColumnContract(
                    column, context, out _, out _);
            }
            var parameter = expression as ParameterExpression;
            return parameter != null
                && IsText(parameter.Definition.Type.LogicalType);
        }

        private static SqlParameterSlot FindSlot(
            ParameterDefinition definition,
            IReadOnlyList<SqlParameterSlot> slots)
        {
            for (var index = 0; index < slots.Count; index++)
            {
                var candidate = slots[index].Definition;
                if (ReferenceEquals(candidate, definition)
                    || (string.Equals(
                            candidate.Name,
                            definition.Name,
                            StringComparison.Ordinal)
                        && candidate.Type.Equals(definition.Type)
                        && candidate.Direction == definition.Direction
                        && candidate.IsNullable == definition.IsNullable))
                {
                    return slots[index];
                }
            }
            throw new InvalidOperationException(
                "An allocated parameter definition has no slot.");
        }

        private static bool IsText(LogicalDbType type)
        {
            return type == LogicalDbType.String
                || type == LogicalDbType.AnsiString
                || type == LogicalDbType.Json
                || type == LogicalDbType.Clob;
        }

        private static UnsupportedDatabaseCapabilityException Unsupported(
            SqlLoweringContext context,
            string featurePrefix,
            string feature,
            string path)
        {
            return new UnsupportedDatabaseCapabilityException(
                context.DialectProfile,
                featurePrefix + "." + feature,
                path);
        }
    }
}
