using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    public sealed class SqlAstNormalizer
    {
        public SqlExpression Normalize(SqlExpression expression)
        {
            if (expression == null)
            {
                throw new ArgumentNullException(nameof(expression));
            }

            return (SqlExpression)NormalizeCore(expression, nameof(expression));
        }

        public SqlStatement Normalize(SqlStatement statement)
        {
            if (statement == null)
            {
                throw new ArgumentNullException(nameof(statement));
            }

            return (SqlStatement)NormalizeCore(statement, nameof(statement));
        }

        public MigrationPlan Normalize(MigrationPlan plan)
        {
            if (plan == null)
            {
                throw new ArgumentNullException(nameof(plan));
            }

            return (MigrationPlan)NormalizeCore(plan, nameof(plan));
        }

        internal static bool RequiresOriginalRoot(
            IReadOnlyList<SqlAstDiagnostic> diagnostics)
        {
            return diagnostics.Count != 0;
        }

        private static SqlNode NormalizeCore(SqlNode root, string parameterName)
        {
            var inspection = SqlAstValidator.InspectRetained(root);
            ThrowIfBudgetExceeded(inspection.Session, parameterName);
            if (RequiresOriginalRoot(inspection.Diagnostics))
            {
                return root;
            }

            var occurrences = inspection.Session.Occurrences;
            var rewritten = new SqlNode[occurrences.Count];
            for (var index = occurrences.Count - 1; index >= 0; index--)
            {
                var occurrence = occurrences[index];
                rewritten[occurrence.Id] = RewriteOccurrence(
                    occurrence,
                    inspection.Session,
                    rewritten);
            }

            return rewritten[0];
        }

        private static void ThrowIfBudgetExceeded(
            SqlAstInspectionSession session,
            string parameterName)
        {
            for (var index = 0; index < session.Segments.Count; index++)
            {
                var segment = session.Segments[index];
                if (segment.Kind != SqlAstCanonicalSegmentKind.TraversalIssue)
                {
                    continue;
                }

                switch (segment.Issue.Kind)
                {
                    case SqlAstTraversalIssueKind.DepthExceeded:
                        throw new ArgumentOutOfRangeException(
                            parameterName,
                            "SQL AST traversal exceeds maximum depth 128.");
                    case SqlAstTraversalIssueKind.NodeLimitExceeded:
                        throw new ArgumentOutOfRangeException(
                            parameterName,
                            "SQL AST traversal exceeds maximum node occurrence count 4096.");
                    case SqlAstTraversalIssueKind.CollectionSlotLimitExceeded:
                        throw new ArgumentOutOfRangeException(
                            parameterName,
                            "SQL AST traversal exceeds maximum collection slot inspection count 16384.");
                }
            }
        }

        private static SqlNode RewriteOccurrence(
            SqlAstOccurrence occurrence,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var node = occurrence.Node;
            var path = occurrence.Path;

            switch (node)
            {
                case BinaryExpression binary:
                    return RewriteBinary(binary, path, session, rewritten);
                case UnaryExpression unary:
                    return RewriteUnary(unary, path, session, rewritten);
                case InExpression @in:
                    return RewriteIn(@in, path, session, rewritten);
                case BetweenExpression between:
                    return RewriteBetween(between, path, session, rewritten);
                case CaseExpression @case:
                    return RewriteCase(@case, path, session, rewritten);
                case CastExpression cast:
                    return RewriteCast(cast, path, session, rewritten);
                case SubqueryExpression subquery:
                    return RewriteSubquery(subquery, path, session, rewritten);
                case ExistsExpression exists:
                    return RewriteExists(exists, path, session, rewritten);
                case AggregateExpression aggregate:
                    return RewriteAggregate(aggregate, path, session, rewritten);
                case FunctionExpression function:
                    return RewriteFunction(function, path, session, rewritten);
                case DerivedTableSource derived:
                    return RewriteDerived(derived, path, session, rewritten);
                case JoinSource join:
                    return RewriteJoin(join, path, session, rewritten);
                case SelectProjection projection:
                    return RewriteProjection(projection, path, session, rewritten);
                case OrderByExpression order:
                    return RewriteOrderBy(order, path, session, rewritten);
                case KeysetPageSpec keyset:
                    return RewriteKeyset(keyset, path, session, rewritten);
                case CommonTableExpression commonTableExpression:
                    return RewriteCommonTableExpression(
                        commonTableExpression, path, session, rewritten);
                case SetOperationClause setOperation:
                    return RewriteSetOperation(
                        setOperation, path, session, rewritten);
                case SelectStatement select:
                    return RewriteSelect(select, path, session, rewritten);
                case SqlAssignment assignment:
                    return RewriteAssignment(assignment, path, session, rewritten);
                case SqlInsertRow row:
                    return RewriteInsertRow(row, path, session, rewritten);
                case ReturningClause returning:
                    return RewriteReturning(returning, path, session, rewritten);
                case InsertStatement insert:
                    return RewriteInsert(insert, path, session, rewritten);
                case UpdateStatement update:
                    return RewriteUpdate(update, path, session, rewritten);
                case DeleteStatement delete:
                    return RewriteDelete(delete, path, session, rewritten);
                case UpsertStatement upsert:
                    return RewriteUpsert(upsert, path, session, rewritten);
                case BulkInsertOperation bulk:
                    return RewriteBulkInsert(bulk, path, session, rewritten);
                case ComputedGenerationDefinition computed:
                    return RewriteComputedGeneration(
                        computed, path, session, rewritten);
                case ColumnDefinition column:
                    return RewriteColumn(column, path, session, rewritten);
                case TableDefinition table:
                    return RewriteTable(table, path, session, rewritten);
                case CreateTableOperation createTable:
                    return RewriteCreateTable(
                        createTable, path, session, rewritten);
                case AddColumnOperation addColumn:
                    return RewriteAddColumn(
                        addColumn, path, session, rewritten);
                case AlterColumnOperation alterColumn:
                    return RewriteAlterColumn(
                        alterColumn, path, session, rewritten);
                case MigrationStep step:
                    return RewriteMigrationStep(
                        step, path, session, rewritten);
                case MigrationPlan plan:
                    return RewriteMigrationPlan(
                        plan, path, session, rewritten);
                default:
                    return node;
            }
        }

        private static SqlNode RewriteBinary(
            BinaryExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var left = Child<SqlExpression>(
                session, rewritten, path + ".Left", node.Left);
            var right = Child<SqlExpression>(
                session, rewritten, path + ".Right", node.Right);

            if (node.Operator == SqlBinaryOperator.Equal)
            {
                if (ReferenceEquals(right, NullExpression.Instance))
                {
                    return new UnaryExpression(SqlUnaryOperator.IsNull, left);
                }
                if (ReferenceEquals(left, NullExpression.Instance))
                {
                    return new UnaryExpression(SqlUnaryOperator.IsNull, right);
                }
            }
            else if (node.Operator == SqlBinaryOperator.NotEqual)
            {
                if (ReferenceEquals(right, NullExpression.Instance))
                {
                    return new UnaryExpression(SqlUnaryOperator.IsNotNull, left);
                }
                if (ReferenceEquals(left, NullExpression.Instance))
                {
                    return new UnaryExpression(SqlUnaryOperator.IsNotNull, right);
                }
            }

            if (ReferenceEquals(left, node.Left) &&
                ReferenceEquals(right, node.Right))
            {
                return node;
            }
            return new BinaryExpression(left, node.Operator, right);
        }

        private static SqlNode RewriteUnary(
            UnaryExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var operand = Child<SqlExpression>(
                session, rewritten, path + ".Operand", node.Operand);
            return ReferenceEquals(operand, node.Operand)
                ? (SqlNode)node
                : new UnaryExpression(node.Operator, operand);
        }

        private static SqlNode RewriteIn(
            InExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var operand = Child<SqlExpression>(
                session, rewritten, path + ".Operand", node.Operand);
            var values = new NodeCollectionRewrite<SqlExpression>(
                session, rewritten, path + ".Values");
            if (values.Count == 0)
            {
                return BooleanExpression.False;
            }
            if (ReferenceEquals(operand, node.Operand) && !values.Changed)
            {
                return node;
            }
            return new InExpression(operand, values.Materialize());
        }

        private static SqlNode RewriteBetween(
            BetweenExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var operand = Child<SqlExpression>(
                session, rewritten, path + ".Operand", node.Operand);
            var lower = Child<SqlExpression>(
                session, rewritten, path + ".Lower", node.Lower);
            var upper = Child<SqlExpression>(
                session, rewritten, path + ".Upper", node.Upper);
            if (ReferenceEquals(operand, node.Operand) &&
                ReferenceEquals(lower, node.Lower) &&
                ReferenceEquals(upper, node.Upper))
            {
                return node;
            }
            return new BetweenExpression(operand, lower, upper);
        }

        private static SqlNode RewriteCase(
            CaseExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var input = Child<SqlExpression>(
                session,
                rewritten,
                path + ".InputExpression",
                node.InputExpression);
            var clauses = new CaseClauseRewrite(
                session, rewritten, path + ".WhenClauses");
            var @else = Child<SqlExpression>(
                session,
                rewritten,
                path + ".ElseExpression",
                node.ElseExpression);
            if (ReferenceEquals(input, node.InputExpression) &&
                !clauses.Changed &&
                ReferenceEquals(@else, node.ElseExpression))
            {
                return node;
            }
            return input == null
                ? (SqlNode)new CaseExpression(clauses.Materialize(), @else)
                : new CaseExpression(input, clauses.Materialize(), @else);
        }

        private static SqlNode RewriteCast(
            CastExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var expression = Child<SqlExpression>(
                session, rewritten, path + ".Expression", node.Expression);
            return ReferenceEquals(expression, node.Expression)
                ? (SqlNode)node
                : new CastExpression(expression, node.Type);
        }

        private static SqlNode RewriteSubquery(
            SubqueryExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var query = Child<SqlNode>(
                session, rewritten, path + ".Query", node.Query);
            return ReferenceEquals(query, node.Query)
                ? (SqlNode)node
                : new SubqueryExpression(query);
        }

        private static SqlNode RewriteExists(
            ExistsExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var subquery = Child<SubqueryExpression>(
                session, rewritten, path + ".Subquery", node.Subquery);
            return ReferenceEquals(subquery, node.Subquery)
                ? (SqlNode)node
                : new ExistsExpression(subquery);
        }

        private static SqlNode RewriteAggregate(
            AggregateExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var argument = Child<SqlExpression>(
                session, rewritten, path + ".Argument", node.Argument);
            return ReferenceEquals(argument, node.Argument)
                ? (SqlNode)node
                : new AggregateExpression(
                    node.Function, argument, node.Distinct);
        }

        private static SqlNode RewriteFunction(
            FunctionExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var arguments = new NodeCollectionRewrite<SqlExpression>(
                session, rewritten, path + ".Arguments");
            return !arguments.Changed
                ? (SqlNode)node
                : new FunctionExpression(node.Function, arguments.Materialize());
        }

        private static SqlNode RewriteDerived(
            DerivedTableSource node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var query = Child<SelectStatement>(
                session, rewritten, path + ".Query", node.Query);
            return ReferenceEquals(query, node.Query)
                ? (SqlNode)node
                : new DerivedTableSource(query, node.Alias);
        }

        private static SqlNode RewriteJoin(
            JoinSource node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var left = Child<SqlTableSource>(
                session, rewritten, path + ".Left", node.Left);
            var right = Child<SqlTableSource>(
                session, rewritten, path + ".Right", node.Right);
            var condition = Child<SqlExpression>(
                session, rewritten, path + ".Condition", node.Condition);
            if (ReferenceEquals(left, node.Left) &&
                ReferenceEquals(right, node.Right) &&
                ReferenceEquals(condition, node.Condition))
            {
                return node;
            }
            return new JoinSource(left, node.JoinType, right, condition);
        }

        private static SqlNode RewriteProjection(
            SelectProjection node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var expression = Child<SqlExpression>(
                session, rewritten, path + ".Expression", node.Expression);
            return ReferenceEquals(expression, node.Expression)
                ? (SqlNode)node
                : new SelectProjection(expression, node.Alias);
        }

        private static SqlNode RewriteOrderBy(
            OrderByExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var expression = Child<SqlExpression>(
                session, rewritten, path + ".Expression", node.Expression);
            return ReferenceEquals(expression, node.Expression)
                ? (SqlNode)node
                : new OrderByExpression(
                    expression, node.Direction, node.NullSortOrder);
        }

        private static SqlNode RewriteKeyset(
            KeysetPageSpec node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var boundaries = new NodeCollectionRewrite<SqlExpression>(
                session, rewritten, path + ".Boundaries");
            return !boundaries.Changed
                ? (SqlNode)node
                : new KeysetPageSpec(boundaries.Materialize(), node.Limit);
        }

        private static SqlNode RewriteCommonTableExpression(
            CommonTableExpression node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var query = Child<SelectStatement>(
                session, rewritten, path + ".Query", node.Query);
            if (ReferenceEquals(query, node.Query))
            {
                return node;
            }
            var columns = ValueCollection<SqlIdentifier>(
                session, path + ".Columns");
            return new CommonTableExpression(
                node.Name, query, columns, node.Recursive);
        }

        private static SqlNode RewriteSetOperation(
            SetOperationClause node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var right = Child<SelectStatement>(
                session, rewritten, path + ".RightQuery", node.RightQuery);
            return ReferenceEquals(right, node.RightQuery)
                ? (SqlNode)node
                : new SetOperationClause(node.Operator, right);
        }

        private static SqlNode RewriteSelect(
            SelectStatement node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var from = Child<SqlTableSource>(
                session, rewritten, path + ".From", node.From);
            var projections = new NodeCollectionRewrite<SelectProjection>(
                session, rewritten, path + ".Projections");
            var where = Child<SqlExpression>(
                session, rewritten, path + ".Where", node.Where);
            var groupBy = new NodeCollectionRewrite<SqlExpression>(
                session, rewritten, path + ".GroupBy");
            var having = Child<SqlExpression>(
                session, rewritten, path + ".Having", node.Having);
            var orderBy = new NodeCollectionRewrite<OrderByExpression>(
                session, rewritten, path + ".OrderBy");
            var page = Child<PageSpec>(
                session, rewritten, path + ".Page", node.Page);
            var lockSpec = Child<LockSpec>(
                session, rewritten, path + ".Lock", node.Lock);
            var commonTableExpressions =
                new NodeCollectionRewrite<CommonTableExpression>(
                    session,
                    rewritten,
                    path + ".CommonTableExpressions");
            var setOperations = new NodeCollectionRewrite<SetOperationClause>(
                session, rewritten, path + ".SetOperations");

            var changed = !ReferenceEquals(from, node.From) ||
                projections.Changed ||
                !ReferenceEquals(where, node.Where) ||
                groupBy.Changed ||
                !ReferenceEquals(having, node.Having) ||
                orderBy.Changed ||
                !ReferenceEquals(page, node.Page) ||
                !ReferenceEquals(lockSpec, node.Lock) ||
                commonTableExpressions.Changed ||
                setOperations.Changed;
            if (!changed)
            {
                return node;
            }

            if (from != null)
            {
                return new SelectStatement(
                    from,
                    projections.Materialize(),
                    node.Distinct,
                    where,
                    groupBy.Materialize(),
                    having,
                    orderBy.Materialize(),
                    page,
                    lockSpec,
                    commonTableExpressions.Materialize(),
                    setOperations.Materialize());
            }
            return new SelectStatement(
                projections.Materialize(),
                node.Distinct,
                where,
                groupBy.Materialize(),
                having,
                orderBy.Materialize(),
                page,
                lockSpec,
                commonTableExpressions.Materialize(),
                setOperations.Materialize());
        }

        private static SqlNode RewriteAssignment(
            SqlAssignment node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var value = Child<SqlExpression>(
                session, rewritten, path + ".Value", node.Value);
            return ReferenceEquals(value, node.Value)
                ? (SqlNode)node
                : new SqlAssignment(node.Column, value);
        }

        private static SqlNode RewriteInsertRow(
            SqlInsertRow node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var values = new NodeCollectionRewrite<SqlExpression>(
                session, rewritten, path + ".Values");
            return !values.Changed
                ? (SqlNode)node
                : new SqlInsertRow(values.Materialize());
        }

        private static SqlNode RewriteReturning(
            ReturningClause node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var projections = new NodeCollectionRewrite<SelectProjection>(
                session, rewritten, path + ".Projections");
            return !projections.Changed
                ? (SqlNode)node
                : new ReturningClause(projections.Materialize());
        }

        private static SqlNode RewriteInsert(
            InsertStatement node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var rows = new NodeCollectionRewrite<SqlInsertRow>(
                session, rewritten, path + ".Rows");
            var source = Child<SelectStatement>(
                session, rewritten, path + ".Source", node.Source);
            var returning = Child<ReturningClause>(
                session, rewritten, path + ".Returning", node.Returning);
            if (!rows.Changed &&
                ReferenceEquals(source, node.Source) &&
                ReferenceEquals(returning, node.Returning))
            {
                return node;
            }

            var columns = ValueCollection<SqlIdentifier>(
                session, path + ".Columns");
            return source != null
                ? (SqlNode)InsertStatement.FromSelect(
                    node.Table, columns, source, returning)
                : InsertStatement.Values(
                    node.Table, columns, rows.Materialize(), returning);
        }

        private static SqlNode RewriteUpdate(
            UpdateStatement node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var assignments = new NodeCollectionRewrite<SqlAssignment>(
                session, rewritten, path + ".Assignments");
            var where = Child<SqlExpression>(
                session, rewritten, path + ".Where", node.Where);
            var returning = Child<ReturningClause>(
                session, rewritten, path + ".Returning", node.Returning);
            if (!assignments.Changed &&
                ReferenceEquals(where, node.Where) &&
                ReferenceEquals(returning, node.Returning))
            {
                return node;
            }
            return new UpdateStatement(
                node.Table,
                assignments.Materialize(),
                where,
                node.AllowAllRows,
                returning);
        }

        private static SqlNode RewriteDelete(
            DeleteStatement node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var where = Child<SqlExpression>(
                session, rewritten, path + ".Where", node.Where);
            var returning = Child<ReturningClause>(
                session, rewritten, path + ".Returning", node.Returning);
            if (ReferenceEquals(where, node.Where) &&
                ReferenceEquals(returning, node.Returning))
            {
                return node;
            }
            return new DeleteStatement(
                node.Table, where, node.AllowAllRows, returning);
        }

        private static SqlNode RewriteUpsert(
            UpsertStatement node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var insertAssignments = new NodeCollectionRewrite<SqlAssignment>(
                session, rewritten, path + ".InsertAssignments");
            var updateAssignments = new NodeCollectionRewrite<SqlAssignment>(
                session, rewritten, path + ".UpdateAssignments");
            var returning = Child<ReturningClause>(
                session, rewritten, path + ".Returning", node.Returning);
            if (!insertAssignments.Changed &&
                !updateAssignments.Changed &&
                ReferenceEquals(returning, node.Returning))
            {
                return node;
            }
            var conflictKeys = ValueCollection<SqlIdentifier>(
                session, path + ".ConflictKeys");
            return new UpsertStatement(
                node.Table,
                conflictKeys,
                insertAssignments.Materialize(),
                updateAssignments.Materialize(),
                node.Policy,
                returning);
        }

        private static SqlNode RewriteBulkInsert(
            BulkInsertOperation node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var rows = new NodeCollectionRewrite<SqlInsertRow>(
                session, rewritten, path + ".Rows");
            if (!rows.Changed)
            {
                return node;
            }
            var columns = ValueCollection<SqlIdentifier>(
                session, path + ".Columns");
            return new BulkInsertOperation(
                node.Table, columns, rows.Materialize(), node.BatchSize);
        }

        private static SqlNode RewriteComputedGeneration(
            ComputedGenerationDefinition node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var expression = Child<SqlExpression>(
                session, rewritten, path + ".Expression", node.Expression);
            return ReferenceEquals(expression, node.Expression)
                ? (SqlNode)node
                : new ComputedGenerationDefinition(expression, node.Storage);
        }

        private static SqlNode RewriteColumn(
            ColumnDefinition node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var generation = Child<ColumnGenerationDefinition>(
                session, rewritten, path + ".Generation", node.Generation);
            var defaultValue = Child<ColumnDefaultDefinition>(
                session, rewritten, path + ".DefaultValue", node.DefaultValue);
            if (ReferenceEquals(generation, node.Generation) &&
                ReferenceEquals(defaultValue, node.DefaultValue))
            {
                return node;
            }
            return new ColumnDefinition(
                node.Name,
                node.Type,
                node.Nullability,
                generation,
                defaultValue,
                node.Comment);
        }

        private static SqlNode RewriteTable(
            TableDefinition node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var columns = new NodeCollectionRewrite<ColumnDefinition>(
                session, rewritten, path + ".Columns");
            var constraints = new NodeCollectionRewrite<ConstraintDefinition>(
                session, rewritten, path + ".Constraints");
            var indexes = new NodeCollectionRewrite<IndexDefinition>(
                session, rewritten, path + ".Indexes");
            if (!columns.Changed &&
                !constraints.Changed &&
                !indexes.Changed)
            {
                return node;
            }
            return new TableDefinition(
                node.Name,
                columns.Materialize(),
                constraints.Materialize(),
                indexes.Materialize(),
                node.Comment);
        }

        private static SqlNode RewriteCreateTable(
            CreateTableOperation node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var table = Child<TableDefinition>(
                session, rewritten, path + ".Table", node.Table);
            return ReferenceEquals(table, node.Table)
                ? (SqlNode)node
                : new CreateTableOperation(table, node.Behavior);
        }

        private static SqlNode RewriteAddColumn(
            AddColumnOperation node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var column = Child<ColumnDefinition>(
                session, rewritten, path + ".Column", node.Column);
            return ReferenceEquals(column, node.Column)
                ? (SqlNode)node
                : new AddColumnOperation(node.Table, column);
        }

        private static SqlNode RewriteAlterColumn(
            AlterColumnOperation node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var before = Child<ColumnDefinition>(
                session, rewritten, path + ".Before", node.Before);
            var after = Child<ColumnDefinition>(
                session, rewritten, path + ".After", node.After);
            if (ReferenceEquals(before, node.Before) &&
                ReferenceEquals(after, node.After))
            {
                return node;
            }

            var candidate = new AlterColumnOperation(node.Table, before, after);
            return ImpactRank(candidate.Impact) < ImpactRank(node.Impact)
                ? (SqlNode)node
                : candidate;
        }

        private static SqlNode RewriteMigrationStep(
            MigrationStep node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var operation = Child<SchemaOperation>(
                session, rewritten, path + ".Operation", node.Operation);
            return ReferenceEquals(operation, node.Operation)
                ? (SqlNode)node
                : new MigrationStep(node.Id, operation, node.Idempotency);
        }

        private static SqlNode RewriteMigrationPlan(
            MigrationPlan node,
            string path,
            SqlAstInspectionSession session,
            SqlNode[] rewritten)
        {
            var steps = new NodeCollectionRewrite<MigrationStep>(
                session, rewritten, path + ".Steps");
            return !steps.Changed
                ? (SqlNode)node
                : new MigrationPlan(node.Id, steps.Materialize());
        }

        private static int ImpactRank(DestructiveImpact impact)
        {
            switch (impact)
            {
                case DestructiveImpact.None:
                    return 0;
                case DestructiveImpact.CompatibilityRisk:
                    return 1;
                case DestructiveImpact.PotentialDataLoss:
                    return 2;
                default:
                    throw new InvalidOperationException(
                        "Destructive impact must be defined.");
            }
        }

        private static T Child<T>(
            SqlAstInspectionSession session,
            SqlNode[] rewritten,
            string path,
            T original)
            where T : SqlNode
        {
            if (original == null)
            {
                return null;
            }
            if (!session.TryGetOccurrence(path, out var occurrence))
            {
                throw new InvalidOperationException(
                    "Inspected SQL AST child occurrence is unavailable.");
            }
            return (T)rewritten[occurrence.Id];
        }

        private static T[] ValueCollection<T>(
            SqlAstInspectionSession session,
            string path)
        {
            if (!session.Ledger.TryGetCompleteSnapshot<T>(
                    path, out var snapshot))
            {
                throw new InvalidOperationException(
                    "Inspected SQL AST collection snapshot is unavailable.");
            }

            var result = new T[snapshot.Count];
            for (var index = 0; index < snapshot.Count; index++)
            {
                result[index] = snapshot[index];
            }
            return result;
        }

        private readonly struct NodeCollectionRewrite<T>
            where T : SqlNode
        {
            private readonly SqlAstInspectionSession _session;
            private readonly SqlNode[] _rewritten;
            private readonly string _path;
            private readonly SqlAstCollectionSnapshot<T> _snapshot;

            internal NodeCollectionRewrite(
                SqlAstInspectionSession session,
                SqlNode[] rewritten,
                string path)
            {
                _session = session;
                _rewritten = rewritten;
                _path = path;
                if (!session.Ledger.TryGetCompleteSnapshot<T>(
                        path, out var snapshot))
                {
                    throw new InvalidOperationException(
                        "Inspected SQL AST collection snapshot is unavailable.");
                }
                _snapshot = snapshot;
                Changed = false;

                var changed = false;
                for (var index = 0; index < snapshot.Count; index++)
                {
                    var original = snapshot[index];
                    if (original != null &&
                        !ReferenceEquals(NormalizedAt(index), original))
                    {
                        changed = true;
                    }
                }
                Changed = changed;
            }

            internal bool Changed { get; }

            internal int Count => _snapshot.Count;

            internal T[] Materialize()
            {
                var result = new T[_snapshot.Count];
                for (var index = 0; index < _snapshot.Count; index++)
                {
                    result[index] = NormalizedAt(index);
                }
                return result;
            }

            private T NormalizedAt(int index)
            {
                var original = _snapshot[index];
                return original == null
                    ? null
                    : Child<T>(
                        _session,
                        _rewritten,
                        Indexed(_path, index),
                        original);
            }
        }

        private readonly struct CaseClauseRewrite
        {
            private readonly SqlAstInspectionSession _session;
            private readonly SqlNode[] _rewritten;
            private readonly string _path;
            private readonly SqlAstCollectionSnapshot<CaseWhenClause> _snapshot;

            internal CaseClauseRewrite(
                SqlAstInspectionSession session,
                SqlNode[] rewritten,
                string path)
            {
                _session = session;
                _rewritten = rewritten;
                _path = path;
                if (!session.Ledger.TryGetCompleteSnapshot<CaseWhenClause>(
                        path, out var snapshot))
                {
                    throw new InvalidOperationException(
                        "Inspected SQL AST case-clause snapshot is unavailable.");
                }
                _snapshot = snapshot;

                var changed = false;
                for (var index = 0; index < snapshot.Count; index++)
                {
                    var original = snapshot[index];
                    if (original == null)
                    {
                        continue;
                    }
                    var itemPath = Indexed(path, index);
                    var when = Child<SqlExpression>(
                        session,
                        rewritten,
                        itemPath + ".When",
                        original.When);
                    var then = Child<SqlExpression>(
                        session,
                        rewritten,
                        itemPath + ".Then",
                        original.Then);
                    if (!ReferenceEquals(when, original.When) ||
                        !ReferenceEquals(then, original.Then))
                    {
                        changed = true;
                    }
                }
                Changed = changed;
            }

            internal bool Changed { get; }

            internal CaseWhenClause[] Materialize()
            {
                var result = new CaseWhenClause[_snapshot.Count];
                for (var index = 0; index < _snapshot.Count; index++)
                {
                    var original = _snapshot[index];
                    if (original == null)
                    {
                        result[index] = null;
                        continue;
                    }
                    var itemPath = Indexed(_path, index);
                    var when = Child<SqlExpression>(
                        _session,
                        _rewritten,
                        itemPath + ".When",
                        original.When);
                    var then = Child<SqlExpression>(
                        _session,
                        _rewritten,
                        itemPath + ".Then",
                        original.Then);
                    result[index] = ReferenceEquals(when, original.When) &&
                        ReferenceEquals(then, original.Then)
                        ? original
                        : new CaseWhenClause(when, then);
                }
                return result;
            }
        }

        private static string Indexed(string path, int index)
        {
            return path + "[" +
                index.ToString(CultureInfo.InvariantCulture) + "]";
        }
    }
}
