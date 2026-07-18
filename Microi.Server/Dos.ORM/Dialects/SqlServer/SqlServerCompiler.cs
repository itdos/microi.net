using System;
using System.Collections.Generic;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.SqlServer
{
    internal sealed class SqlServerCompiler : SqlCompilerBase
    {
        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile)
        {
            return SqlServerCapabilities.For(profile);
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
            var statement = node.Root as SqlStatement;
            if (statement == null)
            {
                throw Unsupported(
                    context, "sqlserver.statement_family", "$");
            }

            var schema = statement as SchemaOperation;
            if (schema != null)
            {
                return new SqlServerSchemaCompiler().Render(
                    schema, node.ParameterSlots, context);
            }
            if (statement is BulkInsertOperation)
            {
                throw Unsupported(
                    context, "sqlserver.bulk_insert", "$");
            }

            var admin = statement as DatabaseAdminOperation;
            if (admin != null)
            {
                return RenderAdmin(admin, context);
            }
            var select = statement as SelectStatement;
            if (select != null)
            {
                return RenderSelectPlan(
                    select, node.ParameterSlots, context);
            }
            var metadata = statement as MetadataQueryOperation;
            if (metadata != null)
            {
                return RenderMetadata(metadata, context);
            }
            var diagnostic = statement as DatabaseDiagnosticOperation;
            if (diagnostic != null)
            {
                return RenderDiagnostic(diagnostic, context);
            }
            var upsert = statement as UpsertStatement;
            if (upsert != null)
            {
                return RenderUpsert(
                    upsert, node.ParameterSlots, context);
            }

            var writer = NewWriter();
            ReturningClause returning;
            if (statement is InsertStatement)
            {
                returning = ((InsertStatement)statement).Returning;
                WriteInsert(
                    (InsertStatement)statement,
                    writer,
                    node.ParameterSlots,
                    context);
            }
            else if (statement is UpdateStatement)
            {
                returning = ((UpdateStatement)statement).Returning;
                WriteUpdate(
                    (UpdateStatement)statement,
                    writer,
                    node.ParameterSlots,
                    context);
            }
            else if (statement is DeleteStatement)
            {
                returning = ((DeleteStatement)statement).Returning;
                WriteDelete(
                    (DeleteStatement)statement,
                    writer,
                    node.ParameterSlots,
                    context);
            }
            else
            {
                throw Unsupported(context, "sqlserver.statement", "$");
            }

            return RenderedSql.ForCommands(new[]
            {
                CreateCommand(
                    writer.Snapshot(),
                    returning == null
                        ? SqlResultShape.AffectedRows
                        : SqlResultShape.ReturningRows,
                    PlanResultRole.Final,
                    PlanTransactionBehavior.Enlistable,
                    context)
            });
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context)
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

        internal static SqlTextWriter NewWriter()
        {
            return new SqlTextWriter(SqlTextDialectFamily.SqlServer);
        }

        internal static SqlCommandStep CreateCommand(
            SqlCommandTextSnapshot snapshot,
            SqlResultShape resultShape,
            PlanResultRole resultRole,
            PlanTransactionBehavior transactionBehavior,
            SqlLoweringContext context)
        {
            if (StableWireBuffer.GetUtf8ByteCount(snapshot.CommandText)
                > context.Capabilities.MaxCommandTextLength)
            {
                throw Unsupported(
                    context, "sqlserver.max_command_text", "$");
            }
            if (snapshot.Parameters.Count
                > context.Capabilities.MaxParametersPerCommand)
            {
                throw Unsupported(
                    context, "sqlserver.max_parameters", "$");
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

        internal static void WriteObjectName(
            SqlObjectName name,
            SqlTextWriter writer)
        {
            if (name.Catalog != null)
            {
                writer.AppendIdentifierSegment(name.Catalog.Value);
                writer.AppendDot();
            }
            if (name.Schema != null)
            {
                writer.AppendIdentifierSegment(name.Schema.Value);
                writer.AppendDot();
            }
            writer.AppendIdentifierSegment(name.Name.Value);
        }

        internal static void WriteExpression(
            SqlExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
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
                WriteBoolean(boolean.Value, writer);
                return;
            }
            var binary = expression as BinaryExpression;
            if (binary != null)
            {
                writer.AppendOpenParenthesis();
                WriteExpression(binary.Left, writer, slots, context);
                writer.AppendSpace();
                WriteBinaryOperator(binary.Operator, writer);
                writer.AppendSpace();
                WriteExpression(binary.Right, writer, slots, context);
                writer.AppendCloseParenthesis();
                return;
            }
            var unary = expression as UnaryExpression;
            if (unary != null)
            {
                WriteUnary(unary, writer, slots, context);
                return;
            }
            var inExpression = expression as InExpression;
            if (inExpression != null)
            {
                if (inExpression.Values.Count == 0)
                {
                    WriteBoolean(false, writer);
                    return;
                }
                writer.AppendOpenParenthesis();
                WriteExpression(
                    inExpression.Operand, writer, slots, context);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.In);
                writer.AppendSpace();
                writer.AppendOpenParenthesis();
                WriteExpressions(
                    inExpression.Values, writer, slots, context);
                writer.AppendCloseParenthesis();
                writer.AppendCloseParenthesis();
                return;
            }
            var between = expression as BetweenExpression;
            if (between != null)
            {
                writer.AppendOpenParenthesis();
                WriteExpression(between.Operand, writer, slots, context);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Between);
                writer.AppendSpace();
                WriteExpression(between.Lower, writer, slots, context);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.And);
                writer.AppendSpace();
                WriteExpression(between.Upper, writer, slots, context);
                writer.AppendCloseParenthesis();
                return;
            }
            var caseExpression = expression as CaseExpression;
            if (caseExpression != null)
            {
                WriteCase(caseExpression, writer, slots, context);
                return;
            }
            if (expression is CastExpression)
            {
                throw Unsupported(context, "sqlserver.cast", "$");
            }
            var subquery = expression as SubqueryExpression;
            if (subquery != null)
            {
                var query = subquery.Query as SelectStatement;
                if (query == null)
                {
                    throw Unsupported(
                        context, "sqlserver.subquery_family", "$");
                }
                writer.AppendOpenParenthesis();
                WriteSelect(query, writer, slots, context);
                writer.AppendCloseParenthesis();
                return;
            }
            var exists = expression as ExistsExpression;
            if (exists != null)
            {
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
                WriteExpression(exists.Subquery, writer, slots, context);
                return;
            }
            var aggregate = expression as AggregateExpression;
            if (aggregate != null)
            {
                WriteAggregate(aggregate, writer, slots, context);
                return;
            }
            var function = expression as FunctionExpression;
            if (function != null)
            {
                WriteFunction(function, writer, slots, context);
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

            throw Unsupported(context, "sqlserver.expression", "$");
        }

        private static RenderedSql RenderSelectPlan(
            SelectStatement statement,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            var dataWriter = NewWriter();
            WriteSelect(statement, dataWriter, slots, context);
            var data = CreateCommand(
                dataWriter.Snapshot(),
                SqlResultShape.RowSet,
                PlanResultRole.Final,
                PlanTransactionBehavior.Enlistable,
                context);
            if (statement.Page == null)
            {
                return RenderedSql.ForCommands(new[] { data });
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
                context);
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
                context);
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
            SqlLoweringContext context)
        {
            if (statement.SetOperations.Count != 0)
            {
                throw Unsupported(
                    context,
                    "sqlserver.set_operation",
                    "$.SetOperations");
            }
            if (statement.Lock != null)
            {
                throw Unsupported(context, "sqlserver.locking", "$.Lock");
            }
            WriteCtes(statement, writer, slots, context);
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
                    projection.Expression, writer, slots, context);
                if (projection.Alias != null)
                {
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.As);
                    writer.AppendSpace();
                    writer.AppendIdentifierSegment(
                        projection.Alias.Identifier.Value);
                }
            }
            if (statement.From != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.From);
                writer.AppendSpace();
                WriteTableSource(
                    statement.From, writer, slots, context);
            }
            if (statement.Where != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Where);
                writer.AppendSpace();
                WriteExpression(statement.Where, writer, slots, context);
            }
            if (statement.GroupBy.Count != 0)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Group);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.By);
                writer.AppendSpace();
                WriteExpressions(
                    statement.GroupBy, writer, slots, context);
            }
            if (statement.Having != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Having);
                writer.AppendSpace();
                WriteExpression(
                    statement.Having, writer, slots, context);
            }
            WriteOrderBy(statement, writer, slots, context);
            WritePage(statement.Page, writer, context);
        }

        private static void WriteCtes(
            SelectStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
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
                        context, "sqlserver.recursive_cte", "$");
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
                WriteSelect(cte.Query, writer, slots, context);
                writer.AppendCloseParenthesis();
            }
            writer.AppendSpace();
        }

        private static void WriteTableSource(
            SqlTableSource source,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            var named = source as NamedTableSource;
            if (named != null)
            {
                WriteObjectName(named.Name, writer);
                WriteAlias(named.Alias, writer);
                return;
            }
            var derived = source as DerivedTableSource;
            if (derived != null)
            {
                writer.AppendOpenParenthesis();
                WriteSelect(derived.Query, writer, slots, context);
                writer.AppendCloseParenthesis();
                WriteAlias(derived.Alias, writer);
                return;
            }
            var join = source as JoinSource;
            if (join == null)
            {
                throw Unsupported(
                    context, "sqlserver.table_source", "$");
            }
            WriteTableSource(join.Left, writer, slots, context);
            writer.AppendSpace();
            switch (join.JoinType)
            {
                case SqlJoinType.Inner:
                    writer.AppendKeyword(SqlKeyword.Inner);
                    break;
                case SqlJoinType.Left:
                    writer.AppendKeyword(SqlKeyword.Left);
                    break;
                case SqlJoinType.Right:
                    writer.AppendKeyword(SqlKeyword.Right);
                    break;
                case SqlJoinType.Full:
                    writer.AppendKeyword(SqlKeyword.Full);
                    break;
                case SqlJoinType.Cross:
                    writer.AppendKeyword(SqlKeyword.Cross);
                    break;
                default:
                    throw Unsupported(
                        context, "sqlserver.join", "$");
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Join);
            writer.AppendSpace();
            WriteTableSource(join.Right, writer, slots, context);
            if (join.Condition != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.On);
                writer.AppendSpace();
                WriteExpression(
                    join.Condition, writer, slots, context);
            }
        }

        private static void WriteOrderBy(
            SelectStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (statement.OrderBy.Count == 0)
            {
                return;
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Order);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.By);
            writer.AppendSpace();
            for (var index = 0;
                 index < statement.OrderBy.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                var order = statement.OrderBy[index];
                if (order.NullSortOrder != SqlNullSortOrder.Default)
                {
                    throw Unsupported(
                        context,
                        "sqlserver.null_sort_order",
                        "$.OrderBy");
                }
                WriteExpression(
                    order.Expression, writer, slots, context);
                writer.AppendSpace();
                writer.AppendKeyword(
                    order.Direction == SqlSortDirection.Ascending
                        ? SqlKeyword.Asc
                        : SqlKeyword.Desc);
            }
        }

        private static void WritePage(
            PageSpec page,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (page == null)
            {
                return;
            }
            var offset = page as OffsetPageSpec;
            if (offset == null)
            {
                throw Unsupported(
                    context,
                    "sqlserver.keyset_pagination",
                    "$.Page");
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

        private static void WriteInsert(
            InsertStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Insert);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Into);
            writer.AppendSpace();
            WriteObjectName(statement.Table, writer);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            WriteIdentifiers(statement.Columns, writer);
            writer.AppendCloseParenthesis();
            WriteOutput(
                statement.Returning,
                SqlKeyword.Inserted,
                writer,
                context);
            writer.AppendSpace();
            if (statement.Source != null)
            {
                WriteSelect(statement.Source, writer, slots, context);
                return;
            }
            writer.AppendKeyword(SqlKeyword.Values);
            writer.AppendSpace();
            WriteRows(statement.Rows, writer, slots, context);
        }

        private static void WriteUpdate(
            UpdateStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Update);
            writer.AppendSpace();
            WriteObjectName(statement.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Set);
            writer.AppendSpace();
            WriteAssignments(
                statement.Assignments, writer, slots, context);
            WriteOutput(
                statement.Returning,
                SqlKeyword.Inserted,
                writer,
                context);
            if (statement.Where != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Where);
                writer.AppendSpace();
                WriteExpression(
                    statement.Where, writer, slots, context);
            }
        }

        private static void WriteDelete(
            DeleteStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Delete);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.From);
            writer.AppendSpace();
            WriteObjectName(statement.Table, writer);
            WriteOutput(
                statement.Returning,
                SqlKeyword.Deleted,
                writer,
                context);
            if (statement.Where != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Where);
                writer.AppendSpace();
                WriteExpression(
                    statement.Where, writer, slots, context);
            }
        }

        private static void WriteOutput(
            ReturningClause returning,
            SqlKeyword rowImage,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (returning == null)
            {
                return;
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Output);
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
                var column = projection.Expression as ColumnExpression;
                if (column != null)
                {
                    writer.AppendKeyword(rowImage);
                    writer.AppendDot();
                    writer.AppendIdentifierSegment(column.Name.Value);
                }
                else if (projection.Expression is WildcardExpression)
                {
                    writer.AppendKeyword(rowImage);
                    writer.AppendDot();
                    writer.AppendOperator(SqlOperatorToken.Multiply);
                }
                else
                {
                    throw Unsupported(
                        context,
                        "sqlserver.output_projection",
                        "$.Returning");
                }
                if (projection.Alias != null)
                {
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.As);
                    writer.AppendSpace();
                    writer.AppendIdentifierSegment(
                        projection.Alias.Identifier.Value);
                }
            }
        }

        private static RenderedSql RenderUpsert(
            UpsertStatement statement,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (context.Options.RequestedAtomicity
                != AtomicityRequirement.Required)
            {
                throw Unsupported(
                    context, "sqlserver.upsert_atomicity", "$");
            }
            if (statement.Policy != ConflictPolicy.UpdateExisting)
            {
                throw Unsupported(
                    context, "sqlserver.upsert_do_nothing", "$");
            }
            if (statement.Returning != null)
            {
                throw Unsupported(
                    context, "sqlserver.upsert_output", "$");
            }

            var updateWriter = NewWriter();
            updateWriter.AppendKeyword(SqlKeyword.Update);
            updateWriter.AppendSpace();
            WriteObjectName(statement.Table, updateWriter);
            WriteUpsertLockHint(updateWriter);
            updateWriter.AppendSpace();
            updateWriter.AppendKeyword(SqlKeyword.Set);
            updateWriter.AppendSpace();
            WriteAssignments(
                statement.UpdateAssignments,
                updateWriter,
                slots,
                context);
            updateWriter.AppendSpace();
            updateWriter.AppendKeyword(SqlKeyword.Where);
            updateWriter.AppendSpace();
            WriteConflictPredicate(
                statement, updateWriter, slots, context);

            var insertWriter = NewWriter();
            insertWriter.AppendKeyword(SqlKeyword.Insert);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Into);
            insertWriter.AppendSpace();
            WriteObjectName(statement.Table, insertWriter);
            insertWriter.AppendSpace();
            insertWriter.AppendOpenParenthesis();
            WriteAssignmentColumns(
                statement.InsertAssignments, insertWriter);
            insertWriter.AppendCloseParenthesis();
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Select);
            insertWriter.AppendSpace();
            WriteAssignmentValues(
                statement.InsertAssignments,
                insertWriter,
                slots,
                context);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Where);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Not);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Exists);
            insertWriter.AppendSpace();
            insertWriter.AppendOpenParenthesis();
            insertWriter.AppendKeyword(SqlKeyword.Select);
            insertWriter.AppendSpace();
            insertWriter.AppendOperator(SqlOperatorToken.Multiply);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.From);
            insertWriter.AppendSpace();
            WriteObjectName(statement.Table, insertWriter);
            WriteUpsertLockHint(insertWriter);
            insertWriter.AppendSpace();
            insertWriter.AppendKeyword(SqlKeyword.Where);
            insertWriter.AppendSpace();
            WriteConflictPredicate(
                statement, insertWriter, slots, context);
            insertWriter.AppendCloseParenthesis();

            return RenderedSql.ForCommands(new[]
            {
                CreateCommand(
                    updateWriter.Snapshot(),
                    SqlResultShape.AffectedRows,
                    PlanResultRole.Aggregate,
                    PlanTransactionBehavior.Enlistable,
                    context),
                CreateCommand(
                    insertWriter.Snapshot(),
                    SqlResultShape.AffectedRows,
                    PlanResultRole.Aggregate,
                    PlanTransactionBehavior.Enlistable,
                    context)
            });
        }

        private static void WriteUpsertLockHint(SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.With);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            writer.AppendKeyword(SqlKeyword.Updlock);
            writer.AppendComma();
            writer.AppendKeyword(SqlKeyword.Serializable);
            writer.AppendCloseParenthesis();
        }

        private static void WriteConflictPredicate(
            UpsertStatement statement,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendOpenParenthesis();
            for (var index = 0;
                 index < statement.ConflictKeys.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.And);
                    writer.AppendSpace();
                }
                var key = statement.ConflictKeys[index];
                writer.AppendIdentifierSegment(key.Value);
                writer.AppendSpace();
                writer.AppendOperator(SqlOperatorToken.Equal);
                writer.AppendSpace();
                WriteExpression(
                    FindInsertValue(statement, key),
                    writer,
                    slots,
                    context);
            }
            writer.AppendCloseParenthesis();
        }

        private static SqlExpression FindInsertValue(
            UpsertStatement statement,
            SqlIdentifier key)
        {
            for (var index = 0;
                 index < statement.InsertAssignments.Count;
                 index++)
            {
                if (statement.InsertAssignments[index].Column.Equals(key))
                {
                    return statement.InsertAssignments[index].Value;
                }
            }
            throw new InvalidOperationException(
                "An upsert conflict key has no insert value.");
        }

        private static RenderedSql RenderMetadata(
            MetadataQueryOperation operation,
            SqlLoweringContext context)
        {
            var writer = NewWriter();
            writer.AppendKeyword(SqlKeyword.Select);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Multiply);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.From);
            writer.AppendSpace();

            if (operation is ListTablesOperation)
            {
                var scope = ((ListTablesOperation)operation).Scope;
                WriteSystemObject(scope.Catalog, "tables", writer);
                WriteSystemAlias("t", writer);
                WriteSchemaJoin(scope.Catalog, writer);
                if (scope.Schema != null)
                {
                    WriteMetadataFilter(
                        "s", "name", scope.Schema.Value,
                        false, writer);
                }
            }
            else
            {
                SqlObjectName table;
                SqlIdentifier item = null;
                var isIndex = operation is ListIndexesOperation
                    || operation is GetIndexMetadataOperation;
                if (operation is GetTableMetadataOperation)
                {
                    table = ((GetTableMetadataOperation)operation).Table;
                }
                else if (operation is ListColumnsOperation)
                {
                    table = ((ListColumnsOperation)operation).Table;
                }
                else if (operation is GetColumnMetadataOperation)
                {
                    table = ((GetColumnMetadataOperation)operation).Table;
                    item = ((GetColumnMetadataOperation)operation).Column;
                }
                else if (operation is ListIndexesOperation)
                {
                    table = ((ListIndexesOperation)operation).Table;
                }
                else if (operation is GetIndexMetadataOperation)
                {
                    table = ((GetIndexMetadataOperation)operation).Table;
                    item = ((GetIndexMetadataOperation)operation).Index;
                }
                else
                {
                    throw Unsupported(
                        context, "sqlserver.metadata", "$");
                }

                var source = operation is GetTableMetadataOperation
                    ? "tables"
                    : isIndex ? "indexes" : "columns";
                var alias = operation is GetTableMetadataOperation
                    ? "t"
                    : isIndex ? "i" : "c";
                WriteSystemObject(table.Catalog, source, writer);
                WriteSystemAlias(alias, writer);
                if (!(operation is GetTableMetadataOperation))
                {
                    WriteTableJoin(table.Catalog, alias, writer);
                }
                WriteSchemaJoin(table.Catalog, writer);
                WriteMetadataFilter(
                    "t", "name", table.Name.Value, false, writer);
                if (table.Schema != null)
                {
                    WriteMetadataFilter(
                        "s", "name", table.Schema.Value, true, writer);
                }
                if (item != null)
                {
                    WriteMetadataFilter(
                        alias, "name", item.Value, true, writer);
                }
            }

            return RenderedSql.ForCommands(new[]
            {
                CreateCommand(
                    writer.Snapshot(),
                    SqlResultShape.Metadata,
                    PlanResultRole.Final,
                    PlanTransactionBehavior.Enlistable,
                    context)
            });
        }

        private static void WriteSystemObject(
            SqlIdentifier catalog,
            string name,
            SqlTextWriter writer)
        {
            if (catalog != null)
            {
                writer.AppendIdentifierSegment(catalog.Value);
                writer.AppendDot();
            }
            writer.AppendIdentifierSegment("sys");
            writer.AppendDot();
            writer.AppendIdentifierSegment(name);
        }

        private static void WriteSystemAlias(
            string alias,
            SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.As);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(alias);
        }

        private static void WriteTableJoin(
            SqlIdentifier catalog,
            string sourceAlias,
            SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Inner);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Join);
            writer.AppendSpace();
            WriteSystemObject(catalog, "tables", writer);
            WriteSystemAlias("t", writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            WriteQualifiedIdentifier(sourceAlias, "object_id", writer);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Equal);
            writer.AppendSpace();
            WriteQualifiedIdentifier("t", "object_id", writer);
        }

        private static void WriteSchemaJoin(
            SqlIdentifier catalog,
            SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Inner);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Join);
            writer.AppendSpace();
            WriteSystemObject(catalog, "schemas", writer);
            WriteSystemAlias("s", writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            WriteQualifiedIdentifier("t", "schema_id", writer);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Equal);
            writer.AppendSpace();
            WriteQualifiedIdentifier("s", "schema_id", writer);
        }

        private static void WriteMetadataFilter(
            string alias,
            string column,
            string value,
            bool useAnd,
            SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(
                useAnd ? SqlKeyword.And : SqlKeyword.Where);
            writer.AppendSpace();
            WriteQualifiedIdentifier(alias, column, writer);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Equal);
            writer.AppendSpace();
            writer.AppendEscapedSchemaLiteral(
                new SqlSchemaLiteral(value));
        }

        private static RenderedSql RenderDiagnostic(
            DatabaseDiagnosticOperation operation,
            SqlLoweringContext context)
        {
            var writer = NewWriter();
            writer.AppendKeyword(SqlKeyword.Select);
            writer.AppendSpace();
            if (operation.Kind == DatabaseDiagnosticKind.Health)
            {
                writer.AppendStructuralInt(1);
            }
            else
            {
                writer.AppendOperator(SqlOperatorToken.Multiply);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.From);
                writer.AppendSpace();
                WriteSystemObject(
                    null,
                    operation.Kind == DatabaseDiagnosticKind.Information
                        ? "databases"
                        : "database_permissions",
                    writer);
            }
            return RenderedSql.ForCommands(new[]
            {
                CreateCommand(
                    writer.Snapshot(),
                    SqlResultShape.Diagnostic,
                    PlanResultRole.Final,
                    PlanTransactionBehavior.Enlistable,
                    context)
            });
        }

        private static RenderedSql RenderAdmin(
            DatabaseAdminOperation operation,
            SqlLoweringContext context)
        {
            PlanConnectionRole role;
            if (operation is CreateDatabaseOperation)
            {
                if (!context.Capabilities.SupportsCreateDatabase)
                {
                    throw Unsupported(
                        context, "sqlserver.create_database", "$");
                }
                role = PlanConnectionRole.Administrative;
            }
            else if (operation is DropDatabaseOperation)
            {
                if (!context.Capabilities.SupportsDropDatabase)
                {
                    throw Unsupported(
                        context, "sqlserver.drop_database", "$");
                }
                role = PlanConnectionRole.Administrative;
            }
            else if (operation is DatabaseExportOperation
                     || operation is DatabaseImportOperation)
            {
                role = PlanConnectionRole.CurrentDatabase;
            }
            else
            {
                throw Unsupported(context, "sqlserver.admin", "$");
            }
            return RenderedSql.ForAdmin(new AdminStep(
                operation,
                role,
                PlanTransactionBehavior.NotEnlistable));
        }

        private static void WriteFunction(
            FunctionExpression function,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            SqlKeyword keyword;
            if (ReferenceEquals(
                    function.Function,
                    SemanticFunctions.CurrentDateTime))
            {
                keyword = SqlKeyword.SysDateTime;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.JsonValue))
            {
                keyword = SqlKeyword.JsonValue;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.Coalesce))
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
                keyword = SqlKeyword.Len;
            }
            else if (ReferenceEquals(
                         function.Function,
                         SemanticFunctions.Round))
            {
                keyword = SqlKeyword.Round;
            }
            else
            {
                throw Unsupported(
                    context, "sqlserver.function", "$");
            }
            writer.AppendKeyword(keyword);
            writer.AppendOpenParenthesis();
            WriteExpressions(
                function.Arguments, writer, slots, context);
            writer.AppendCloseParenthesis();
        }

        private static void WriteAggregate(
            AggregateExpression aggregate,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            SqlKeyword keyword;
            if (ReferenceEquals(
                    aggregate.Function, SemanticFunctions.Count))
            {
                keyword = SqlKeyword.Count;
            }
            else if (ReferenceEquals(
                         aggregate.Function, SemanticFunctions.Sum))
            {
                keyword = SqlKeyword.Sum;
            }
            else if (ReferenceEquals(
                         aggregate.Function, SemanticFunctions.Avg))
            {
                keyword = SqlKeyword.Avg;
            }
            else if (ReferenceEquals(
                         aggregate.Function, SemanticFunctions.Min))
            {
                keyword = SqlKeyword.Min;
            }
            else if (ReferenceEquals(
                         aggregate.Function, SemanticFunctions.Max))
            {
                keyword = SqlKeyword.Max;
            }
            else
            {
                throw Unsupported(
                    context, "sqlserver.aggregate", "$");
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
                    aggregate.Argument, writer, slots, context);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteCase(
            CaseExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Case);
            if (expression.InputExpression != null)
            {
                writer.AppendSpace();
                WriteExpression(
                    expression.InputExpression, writer, slots, context);
            }
            for (var index = 0;
                 index < expression.WhenClauses.Count;
                 index++)
            {
                var clause = expression.WhenClauses[index];
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.When);
                writer.AppendSpace();
                WriteExpression(clause.When, writer, slots, context);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Then);
                writer.AppendSpace();
                WriteExpression(clause.Then, writer, slots, context);
            }
            if (expression.ElseExpression != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Else);
                writer.AppendSpace();
                WriteExpression(
                    expression.ElseExpression, writer, slots, context);
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.End);
        }

        private static void WriteUnary(
            UnaryExpression expression,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (expression.Operator == SqlUnaryOperator.Not)
            {
                writer.AppendKeyword(SqlKeyword.Not);
                writer.AppendSpace();
                WriteExpression(
                    expression.Operand, writer, slots, context);
                return;
            }
            if (expression.Operator == SqlUnaryOperator.Negate)
            {
                writer.AppendOpenParenthesis();
                writer.AppendStructuralInt(0);
                writer.AppendSpace();
                writer.AppendOperator(SqlOperatorToken.Subtract);
                writer.AppendSpace();
                WriteExpression(
                    expression.Operand, writer, slots, context);
                writer.AppendCloseParenthesis();
                return;
            }
            WriteExpression(
                expression.Operand, writer, slots, context);
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
                    writer.AppendOperator(
                        SqlOperatorToken.GreaterThanOrEqual);
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
            SqlLoweringContext context)
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
                    context);
            }
        }

        private static void WriteAssignmentColumns(
            IReadOnlyList<SqlAssignment> assignments,
            SqlTextWriter writer)
        {
            for (var index = 0; index < assignments.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(
                    assignments[index].Column.Value);
            }
        }

        private static void WriteAssignmentValues(
            IReadOnlyList<SqlAssignment> assignments,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            for (var index = 0; index < assignments.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                WriteExpression(
                    assignments[index].Value,
                    writer,
                    slots,
                    context);
            }
        }

        private static void WriteRows(
            IReadOnlyList<SqlInsertRow> rows,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            for (var index = 0; index < rows.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendOpenParenthesis();
                WriteExpressions(
                    rows[index].Values, writer, slots, context);
                writer.AppendCloseParenthesis();
            }
        }

        private static void WriteExpressions(
            IReadOnlyList<SqlExpression> expressions,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            for (var index = 0; index < expressions.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                WriteExpression(
                    expressions[index], writer, slots, context);
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
                writer.AppendIdentifierSegment(
                    identifiers[index].Value);
            }
        }

        private static void WriteQualifiedIdentifier(
            string source,
            string name,
            SqlTextWriter writer)
        {
            writer.AppendIdentifierSegment(source);
            writer.AppendDot();
            writer.AppendIdentifierSegment(name);
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

        private static void WriteBoolean(
            bool value,
            SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(1);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Equal);
            writer.AppendSpace();
            writer.AppendStructuralInt(value ? 1 : 0);
            writer.AppendCloseParenthesis();
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
            string feature,
            string path)
        {
            return new UnsupportedDatabaseCapabilityException(
                context.DialectProfile, feature, path);
        }
    }
}
