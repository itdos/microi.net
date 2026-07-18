using System;
using System.Collections.Generic;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.PostgreSql
{
    internal sealed class PostgreSqlCompiler : SqlCompilerBase
    {
        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile)
        {
            return PostgreSqlCapabilities.For(profile);
        }

        internal override SqlNode Lower(
            SqlNode node,
            SqlLoweringContext context)
        {
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
            return PostgreSqlFamilyCompiler.Render(
                node,
                context,
                SqlTextDialectFamily.PostgreSql,
                "postgresql");
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context)
        {
            return PostgreSqlFamilyCompiler.DeriveEffectiveImpact(source);
        }
    }

    internal static class PostgreSqlFamilyCompiler
    {
        internal static RenderedSql Render(
            AllocatedSqlNode node,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
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

            var statement = node.Root as SqlStatement;
            if (statement == null)
            {
                throw Unsupported(
                    context, featurePrefix, "statement_family", "$");
            }
            if (statement is BulkInsertOperation)
            {
                throw Unsupported(
                    context, featurePrefix, "bulk_insert", "$");
            }
            if (statement is SchemaOperation)
            {
                throw Unsupported(
                    context, featurePrefix, "schema_operation", "$");
            }
            if (statement is MetadataQueryOperation)
            {
                throw Unsupported(
                    context, featurePrefix, "metadata", "$");
            }
            if (statement is DatabaseAdminOperation)
            {
                throw Unsupported(
                    context, featurePrefix, "admin", "$");
            }
            if (statement is DatabaseDiagnosticOperation)
            {
                throw Unsupported(
                    context, featurePrefix, "diagnostic", "$");
            }

            var select = statement as SelectStatement;
            if (select != null)
            {
                return RenderSelectPlan(
                    select,
                    node.ParameterSlots,
                    context,
                    family,
                    featurePrefix);
            }

            var writer = NewWriter(family);
            ReturningClause returning;
            var insert = statement as InsertStatement;
            if (insert != null)
            {
                WriteInsert(
                    insert,
                    writer,
                    node.ParameterSlots,
                    context,
                    family,
                    featurePrefix);
                returning = insert.Returning;
            }
            else
            {
                var update = statement as UpdateStatement;
                if (update != null)
                {
                    WriteUpdate(
                        update,
                        writer,
                        node.ParameterSlots,
                        context,
                        family,
                        featurePrefix);
                    returning = update.Returning;
                }
                else
                {
                    var delete = statement as DeleteStatement;
                    if (delete != null)
                    {
                        WriteDelete(
                            delete,
                            writer,
                            node.ParameterSlots,
                            context,
                            family,
                            featurePrefix);
                        returning = delete.Returning;
                    }
                    else
                    {
                        var upsert = statement as UpsertStatement;
                        if (upsert == null)
                        {
                            throw Unsupported(
                                context,
                                featurePrefix,
                                "statement",
                                "$");
                        }
                        WriteUpsert(
                            upsert,
                            writer,
                            node.ParameterSlots,
                            context,
                            family,
                            featurePrefix);
                        returning = upsert.Returning;
                    }
                }
            }

            var resultShape = returning == null
                ? SqlResultShape.AffectedRows
                : SqlResultShape.RowSet;
            return RenderedSql.ForCommands(new[]
            {
                CreateCommand(
                    writer.Snapshot(),
                    resultShape,
                    PlanResultRole.Final,
                    PlanTransactionBehavior.Enlistable,
                    context,
                    featurePrefix)
            });
        }

        internal static DestructiveImpact DeriveEffectiveImpact(
            SqlNode source)
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
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            var dataWriter = NewWriter(family);
            WriteSelect(
                statement,
                dataWriter,
                slots,
                context,
                family,
                featurePrefix);
            var data = CreateCommand(
                dataWriter.Snapshot(),
                SqlResultShape.RowSet,
                PlanResultRole.Final,
                PlanTransactionBehavior.Enlistable,
                context,
                featurePrefix);
            if (statement.Page == null)
            {
                return RenderedSql.ForCommands(new[] { data });
            }

            if (!(statement.Page is OffsetPageSpec))
            {
                throw Unsupported(
                    context, featurePrefix, "keyset_page", "$.Page");
            }

            var countWriter = NewWriter(family);
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
                family,
                featurePrefix);
            countWriter.AppendCloseParenthesis();
            countWriter.AppendSpace();
            countWriter.AppendKeyword(SqlKeyword.As);
            countWriter.AppendSpace();
            countWriter.AppendIdentifierSegment("__dosorm_count");
            var count = CreateCommand(
                countWriter.Snapshot(),
                SqlResultShape.Scalar,
                PlanResultRole.Aggregate,
                PlanTransactionBehavior.Enlistable,
                context,
                featurePrefix);
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
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            if (statement.SetOperations.Count != 0)
            {
                throw Unsupported(
                    context,
                    featurePrefix,
                    "set_operation",
                    "$.SetOperations");
            }
            WriteCtes(
                statement,
                writer,
                slots,
                context,
                family,
                featurePrefix);
            writer.AppendKeyword(SqlKeyword.Select);
            if (statement.Distinct)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Distinct);
            }
            writer.AppendSpace();
            for (var index = 0;
                 index < statement.Projections.Count;
                 index++)
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
                    family,
                    featurePrefix);
                WriteAlias(projection.Alias, writer);
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
                    family,
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
                    family,
                    featurePrefix);
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
                    family,
                    featurePrefix);
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
                    family,
                    featurePrefix);
            }
            WriteOrderBy(
                statement.OrderBy,
                writer,
                slots,
                context,
                family,
                featurePrefix);
            WritePage(statement.Page, writer, context, featurePrefix);
            WriteLock(statement.Lock, writer, context, featurePrefix);
        }

        private static void WriteCtes(
            SelectStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
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
                        "$.CommonTableExpressions[" + index + "]");
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
                    family,
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
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            var named = source as NamedTableSource;
            if (named != null)
            {
                WriteObjectName(
                    named.Name, writer, context, featurePrefix);
                WriteAlias(named.Alias, writer);
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
                    family,
                    featurePrefix);
                writer.AppendCloseParenthesis();
                WriteAlias(derived.Alias, writer);
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
                family,
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
                family,
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
                    family,
                    featurePrefix);
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
            SqlTextDialectFamily family,
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
                    family,
                    featurePrefix);
                writer.AppendSpace();
                writer.AppendKeyword(item.Direction == SqlSortDirection.Ascending
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
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Limit);
            writer.AppendSpace();
            writer.AppendStructuralInt(offset.Limit);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Offset);
            writer.AppendSpace();
            writer.AppendStructuralInt(offset.Offset);
        }

        private static void WriteLock(
            LockSpec lockSpec,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string featurePrefix)
        {
            if (lockSpec == null)
            {
                return;
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.For);
            writer.AppendSpace();
            writer.AppendKeyword(lockSpec.Mode == SqlLockMode.Update
                ? SqlKeyword.Update
                : SqlKeyword.Share);
            if (lockSpec.Wait == SqlLockWait.NoWait)
            {
                if (!context.Capabilities.SupportsNoWait)
                {
                    throw Unsupported(
                        context, featurePrefix, "nowait", "$.Lock");
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.NoWait);
            }
            else if (lockSpec.Wait == SqlLockWait.SkipLocked)
            {
                if (!context.Capabilities.SupportsSkipLocked)
                {
                    throw Unsupported(
                        context, featurePrefix, "skip_locked", "$.Lock");
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.SkipLocked);
            }
        }

        private static void WriteInsert(
            InsertStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            writer.AppendKeyword(SqlKeyword.Insert);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Into);
            writer.AppendSpace();
            WriteObjectName(
                statement.Table, writer, context, featurePrefix);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            WriteIdentifiers(statement.Columns, writer);
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            if (statement.Source != null)
            {
                WriteSelect(
                    statement.Source,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            else
            {
                writer.AppendKeyword(SqlKeyword.Values);
                writer.AppendSpace();
                WriteRows(
                    statement.Rows,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            WriteReturning(
                statement.Returning,
                writer,
                slots,
                context,
                family,
                featurePrefix);
        }

        private static void WriteUpdate(
            UpdateStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            writer.AppendKeyword(SqlKeyword.Update);
            writer.AppendSpace();
            WriteObjectName(
                statement.Table, writer, context, featurePrefix);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Set);
            writer.AppendSpace();
            WriteAssignments(
                statement.Assignments,
                writer,
                slots,
                context,
                family,
                featurePrefix);
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
                    family,
                    featurePrefix);
            }
            WriteReturning(
                statement.Returning,
                writer,
                slots,
                context,
                family,
                featurePrefix);
        }

        private static void WriteDelete(
            DeleteStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            writer.AppendKeyword(SqlKeyword.Delete);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.From);
            writer.AppendSpace();
            WriteObjectName(
                statement.Table, writer, context, featurePrefix);
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
                    family,
                    featurePrefix);
            }
            WriteReturning(
                statement.Returning,
                writer,
                slots,
                context,
                family,
                featurePrefix);
        }

        private static void WriteUpsert(
            UpsertStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            if (!context.Capabilities.SupportsOnConflictUpsert)
            {
                throw Unsupported(
                    context, featurePrefix, "upsert", "$");
            }
            writer.AppendKeyword(SqlKeyword.Insert);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Into);
            writer.AppendSpace();
            WriteObjectName(
                statement.Table, writer, context, featurePrefix);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            for (var index = 0;
                 index < statement.InsertAssignments.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(
                    statement.InsertAssignments[index].Column.Value);
            }
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Values);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            for (var index = 0;
                 index < statement.InsertAssignments.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                WriteExpression(
                    statement.InsertAssignments[index].Value,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Conflict);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            WriteIdentifiers(statement.ConflictKeys, writer);
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Do);
            writer.AppendSpace();
            if (statement.Policy == ConflictPolicy.DoNothing)
            {
                writer.AppendKeyword(SqlKeyword.Nothing);
            }
            else
            {
                writer.AppendKeyword(SqlKeyword.Update);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Set);
                writer.AppendSpace();
                WriteAssignments(
                    statement.UpdateAssignments,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            WriteReturning(
                statement.Returning,
                writer,
                slots,
                context,
                family,
                featurePrefix);
        }

        private static void WriteReturning(
            ReturningClause returning,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            if (returning == null)
            {
                return;
            }
            if (!context.Capabilities.SupportsReturningClause)
            {
                throw Unsupported(
                    context, featurePrefix, "returning", "$.Returning");
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Returning);
            writer.AppendSpace();
            for (var index = 0;
                 index < returning.Projections.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                var projection = returning.Projections[index];
                WriteExpression(
                    projection.Expression,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                WriteAlias(projection.Alias, writer);
            }
        }

        private static void WriteExpression(
            SqlExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            var column = expression as ColumnExpression;
            if (column != null)
            {
                if (column.Source != null)
                {
                    writer.AppendIdentifierSegment(
                        column.Source.Identifier.Value);
                    writer.AppendDot();
                }
                writer.AppendIdentifierSegment(column.Name.Value);
                return;
            }
            var parameter = expression as ParameterExpression;
            if (parameter != null)
            {
                writer.AppendParameter(
                    FindSlot(parameter.Definition, slots));
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
                writer.AppendKeyword(
                    boolean.Value ? SqlKeyword.True : SqlKeyword.False);
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
                    family,
                    featurePrefix);
                writer.AppendSpace();
                WriteBinaryOperator(binary.Operator, writer);
                writer.AppendSpace();
                WriteExpression(
                    binary.Right,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
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
                    family,
                    featurePrefix);
                return;
            }
            var inExpression = expression as InExpression;
            if (inExpression != null)
            {
                if (inExpression.Values.Count == 0)
                {
                    writer.AppendKeyword(SqlKeyword.False);
                    return;
                }
                writer.AppendOpenParenthesis();
                WriteExpression(
                    inExpression.Operand,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.In);
                writer.AppendSpace();
                writer.AppendOpenParenthesis();
                WriteExpressions(
                    inExpression.Values,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendCloseParenthesis();
                writer.AppendCloseParenthesis();
                return;
            }
            var between = expression as BetweenExpression;
            if (between != null)
            {
                writer.AppendOpenParenthesis();
                WriteExpression(
                    between.Operand,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Between);
                writer.AppendSpace();
                WriteExpression(
                    between.Lower,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.And);
                writer.AppendSpace();
                WriteExpression(
                    between.Upper,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendCloseParenthesis();
                return;
            }
            var caseExpression = expression as CaseExpression;
            if (caseExpression != null)
            {
                WriteCase(
                    caseExpression,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                return;
            }
            if (expression is CastExpression)
            {
                throw Unsupported(
                    context, featurePrefix, "cast", "$");
            }
            var subquery = expression as SubqueryExpression;
            if (subquery != null)
            {
                var query = subquery.Query as SelectStatement;
                if (query == null)
                {
                    throw Unsupported(
                        context,
                        featurePrefix,
                        "subquery_family",
                        "$");
                }
                writer.AppendOpenParenthesis();
                WriteSelect(
                    query,
                    writer,
                    slots,
                    context,
                    family,
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
                    family,
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
                    family,
                    featurePrefix);
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
                    family,
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
            throw Unsupported(
                context, featurePrefix, "expression", "$");
        }

        private static void WriteFunction(
            FunctionExpression function,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            if (ReferenceEquals(
                    function.Function,
                    SemanticFunctions.CurrentDateTime))
            {
                writer.AppendKeyword(SqlKeyword.CurrentTimestamp);
                return;
            }
            if (ReferenceEquals(
                    function.Function,
                    SemanticFunctions.JsonValue))
            {
                throw Unsupported(
                    context,
                    featurePrefix,
                    "json_value_path",
                    "$.Function");
            }

            SqlKeyword keyword;
            if (ReferenceEquals(function.Function, SemanticFunctions.Coalesce))
            {
                keyword = SqlKeyword.Coalesce;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.Concat))
            {
                keyword = SqlKeyword.Concat;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.Substring))
            {
                keyword = SqlKeyword.Substring;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.Length))
            {
                keyword = SqlKeyword.CharLength;
            }
            else if (ReferenceEquals(function.Function, SemanticFunctions.Round))
            {
                keyword = SqlKeyword.Round;
            }
            else
            {
                throw Unsupported(
                    context, featurePrefix, "function", "$");
            }
            writer.AppendKeyword(keyword);
            writer.AppendOpenParenthesis();
            WriteExpressions(
                function.Arguments,
                writer,
                slots,
                context,
                family,
                featurePrefix);
            writer.AppendCloseParenthesis();
        }

        private static void WriteAggregate(
            AggregateExpression aggregate,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            SqlKeyword keyword;
            if (ReferenceEquals(aggregate.Function, SemanticFunctions.Count))
            {
                keyword = SqlKeyword.Count;
            }
            else if (ReferenceEquals(aggregate.Function, SemanticFunctions.Sum))
            {
                keyword = SqlKeyword.Sum;
            }
            else if (ReferenceEquals(aggregate.Function, SemanticFunctions.Avg))
            {
                keyword = SqlKeyword.Avg;
            }
            else if (ReferenceEquals(aggregate.Function, SemanticFunctions.Min))
            {
                keyword = SqlKeyword.Min;
            }
            else if (ReferenceEquals(aggregate.Function, SemanticFunctions.Max))
            {
                keyword = SqlKeyword.Max;
            }
            else
            {
                throw Unsupported(
                    context, featurePrefix, "aggregate", "$");
            }
            writer.AppendKeyword(keyword);
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
                    family,
                    featurePrefix);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteCase(
            CaseExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            writer.AppendKeyword(SqlKeyword.Case);
            for (var index = 0;
                 index < expression.WhenClauses.Count;
                 index++)
            {
                var clause = expression.WhenClauses[index];
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.When);
                writer.AppendSpace();
                WriteExpression(
                    clause.When,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Then);
                writer.AppendSpace();
                WriteExpression(
                    clause.Then,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            if (expression.ElseExpression != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Else);
                writer.AppendSpace();
                WriteExpression(
                    expression.ElseExpression,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.End);
        }

        private static void WriteUnary(
            UnaryExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
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
                    family,
                    featurePrefix);
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
                    family,
                    featurePrefix);
                return;
            }
            WriteExpression(
                expression.Operand,
                writer,
                slots,
                context,
                family,
                featurePrefix);
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

        private static void WriteAssignments(
            IReadOnlyList<SqlAssignment> assignments,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            for (var index = 0; index < assignments.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(
                    assignments[index].Column.Value);
                writer.AppendSpace();
                writer.AppendOperator(SqlOperatorToken.Equal);
                writer.AppendSpace();
                WriteExpression(
                    assignments[index].Value,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
            }
        }

        private static void WriteRows(
            IReadOnlyList<SqlInsertRow> rows,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
        {
            for (var index = 0; index < rows.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendOpenParenthesis();
                WriteExpressions(
                    rows[index].Values,
                    writer,
                    slots,
                    context,
                    family,
                    featurePrefix);
                writer.AppendCloseParenthesis();
            }
        }

        private static void WriteExpressions(
            IReadOnlyList<SqlExpression> expressions,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            SqlTextDialectFamily family,
            string featurePrefix)
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
                    family,
                    featurePrefix);
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

        private static void WriteAlias(
            SqlAlias alias,
            SqlTextWriter writer)
        {
            if (alias == null)
            {
                return;
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.As);
            writer.AppendSpace();
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

        private static SqlTextWriter NewWriter(
            SqlTextDialectFamily family)
        {
            return new SqlTextWriter(family);
        }

        private static SqlCommandStep CreateCommand(
            SqlCommandTextSnapshot snapshot,
            SqlResultShape resultShape,
            PlanResultRole resultRole,
            PlanTransactionBehavior transactionBehavior,
            SqlLoweringContext context,
            string featurePrefix)
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

            var contracts = new List<SqlParameterValueContract>(
                snapshot.Parameters.Count);
            for (var index = 0;
                 index < snapshot.Parameters.Count;
                 index++)
            {
                var definition = snapshot.Parameters[index];
                contracts.Add(new SqlParameterValueContract(
                    definition,
                    new SqlValueContract(
                        definition.Type.LogicalType,
                        definition.Type.Length,
                        IsText(definition.Type.LogicalType)
                            ? context.StorageContract.TextEncoding
                            : LogicalTextEncoding.Native)));
            }
            var valueContract = new SqlCommandValueContract(
                context.StorageContract,
                contracts,
                Array.Empty<SqlResultValueContract>());
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
