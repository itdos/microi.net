using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal sealed class SqlAstBindingResult
    {
        internal SqlAstBindingResult(
            SqlNode root,
            IEnumerable<SqlAstDiagnostic> diagnostics)
        {
            Root = root ?? throw new ArgumentNullException(nameof(root));
            if (diagnostics == null)
            {
                throw new ArgumentNullException(nameof(diagnostics));
            }

            var copy = new List<SqlAstDiagnostic>();
            foreach (var diagnostic in diagnostics)
            {
                if (diagnostic == null)
                {
                    throw new ArgumentException(
                        "Binding diagnostics cannot contain null items.",
                        nameof(diagnostics));
                }

                copy.Add(diagnostic);
            }

            Diagnostics = new ReadOnlyCollection<SqlAstDiagnostic>(copy);
        }

        internal SqlNode Root { get; }

        internal IReadOnlyList<SqlAstDiagnostic> Diagnostics { get; }
    }

    internal sealed class SqlAstBinder
    {
        private const string UnresolvedCode =
            "AST_BIND_COLUMN_OWNER_UNRESOLVED";
        private const string UnresolvedMessage =
            "Column reference does not have a visible alias owner.";
        private const string AmbiguousCode =
            "AST_BIND_COLUMN_OWNER_AMBIGUOUS";
        private const string AmbiguousMessage =
            "Column reference has multiple visible alias owners.";

        internal SqlAstBindingResult Bind(SqlNode root)
        {
            if (root == null)
            {
                throw new ArgumentNullException(nameof(root));
            }

            var diagnostics = new List<SqlAstDiagnostic>();
            SqlNode bound;
            try
            {
                bound = BindNode(root, null, "$", diagnostics);
            }
            catch (ArgumentException)
            {
                // Malformed neutral nodes are retained for the dedicated
                // validation stage, whose diagnostics own shape failures.
                bound = root;
                diagnostics.Clear();
            }

            diagnostics.Sort(CompareDiagnostics);
            return new SqlAstBindingResult(bound, diagnostics);
        }

        private static int CompareDiagnostics(
            SqlAstDiagnostic left,
            SqlAstDiagnostic right)
        {
            var path = string.CompareOrdinal(left.Path, right.Path);
            return path != 0
                ? path
                : string.CompareOrdinal(left.Code, right.Code);
        }

        private static SqlNode BindNode(
            SqlNode node,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            switch (node)
            {
                case ColumnExpression column:
                    return BindColumn(column, scope, path, diagnostics);
                case ParameterExpression parameter:
                    return new ParameterExpression(parameter.Definition);
                case NullExpression _:
                    return NullExpression.Instance;
                case BooleanExpression boolean:
                    return boolean.Value
                        ? BooleanExpression.True
                        : BooleanExpression.False;
                case BinaryExpression binary:
                    return new BinaryExpression(
                        BindExpression(
                            binary.Left, scope, path + ".Left", diagnostics),
                        binary.Operator,
                        BindExpression(
                            binary.Right, scope, path + ".Right", diagnostics));
                case UnaryExpression unary:
                    return new UnaryExpression(
                        unary.Operator,
                        BindExpression(
                            unary.Operand,
                            scope,
                            path + ".Operand",
                            diagnostics));
                case InExpression @in:
                    return new InExpression(
                        BindExpression(
                            @in.Operand,
                            scope,
                            path + ".Operand",
                            diagnostics),
                        BindExpressions(
                            @in.Values,
                            scope,
                            path + ".Values",
                            diagnostics));
                case BetweenExpression between:
                    return new BetweenExpression(
                        BindExpression(
                            between.Operand,
                            scope,
                            path + ".Operand",
                            diagnostics),
                        BindExpression(
                            between.Lower,
                            scope,
                            path + ".Lower",
                            diagnostics),
                        BindExpression(
                            between.Upper,
                            scope,
                            path + ".Upper",
                            diagnostics));
                case CaseExpression @case:
                    return BindCase(@case, scope, path, diagnostics);
                case CastExpression cast:
                    return new CastExpression(
                        BindExpression(
                            cast.Expression,
                            scope,
                            path + ".Expression",
                            diagnostics),
                        cast.Type);
                case SubqueryExpression subquery:
                    return new SubqueryExpression(BindNode(
                        subquery.Query,
                        scope,
                        path + ".Query",
                        diagnostics));
                case ExistsExpression exists:
                    return new ExistsExpression((SubqueryExpression)BindNode(
                        exists.Subquery,
                        scope,
                        path + ".Subquery",
                        diagnostics));
                case AggregateExpression aggregate:
                    return new AggregateExpression(
                        aggregate.Function,
                        aggregate.Argument == null
                            ? null
                            : BindExpression(
                                aggregate.Argument,
                                scope,
                                path + ".Argument",
                                diagnostics),
                        aggregate.Distinct);
                case FunctionExpression function:
                    return new FunctionExpression(
                        function.Function,
                        BindExpressions(
                            function.Arguments,
                            scope,
                            path + ".Arguments",
                            diagnostics));
                case WildcardExpression wildcard:
                    return new WildcardExpression(wildcard.Source);
                case NamedTableSource named:
                    return new NamedTableSource(named.Name, named.Alias);
                case DerivedTableSource derived:
                    return new DerivedTableSource(
                        BindSelect(
                            derived.Query,
                            scope,
                            path + ".Query",
                            diagnostics),
                        derived.Alias);
                case JoinSource join:
                    return BindJoin(join, scope, path, diagnostics);
                case SelectProjection projection:
                    return BindProjection(
                        projection, scope, path, diagnostics);
                case OrderByExpression order:
                    return new OrderByExpression(
                        BindExpression(
                            order.Expression,
                            scope,
                            path + ".Expression",
                            diagnostics),
                        order.Direction,
                        order.NullSortOrder);
                case OffsetPageSpec offset:
                    return new OffsetPageSpec(offset.Offset, offset.Limit);
                case KeysetPageSpec keyset:
                    return new KeysetPageSpec(
                        BindExpressions(
                            keyset.Boundaries,
                            scope,
                            path + ".Boundaries",
                            diagnostics),
                        keyset.Limit);
                case LockSpec @lock:
                    return new LockSpec(@lock.Mode, @lock.Wait);
                case CommonTableExpression common:
                    return new CommonTableExpression(
                        common.Name,
                        BindSelect(
                            common.Query,
                            scope,
                            path + ".Query",
                            diagnostics),
                        common.Columns,
                        common.Recursive);
                case SetOperationClause set:
                    return new SetOperationClause(
                        set.Operator,
                        BindSelect(
                            set.RightQuery,
                            scope,
                            path + ".RightQuery",
                            diagnostics));
                case SelectStatement select:
                    return BindSelect(select, scope, path, diagnostics);
                case SqlAssignment assignment:
                    return new SqlAssignment(
                        assignment.Column,
                        BindExpression(
                            assignment.Value,
                            scope,
                            path + ".Value",
                            diagnostics));
                case SqlInsertRow row:
                    return new SqlInsertRow(BindExpressions(
                        row.Values,
                        scope,
                        path + ".Values",
                        diagnostics));
                case ReturningClause returning:
                    return new ReturningClause(BindProjections(
                        returning.Projections,
                        scope,
                        path + ".Projections",
                        diagnostics));
                case InsertStatement insert:
                    return BindInsert(insert, scope, path, diagnostics);
                case UpdateStatement update:
                    return BindUpdate(update, scope, path, diagnostics);
                case DeleteStatement delete:
                    return BindDelete(delete, scope, path, diagnostics);
                case UpsertStatement upsert:
                    return BindUpsert(upsert, scope, path, diagnostics);
                case BulkInsertOperation bulk:
                    return BindBulk(bulk, scope, path, diagnostics);
                case ComputedGenerationDefinition computed:
                    return new ComputedGenerationDefinition(
                        BindExpression(
                            computed.Expression,
                            scope,
                            path + ".Expression",
                            diagnostics),
                        computed.Storage);
                case ColumnDefinition columnDefinition:
                    return BindColumnDefinition(
                        columnDefinition, scope, path, diagnostics);
                case TableDefinition table:
                    return BindTableDefinition(table, scope, path, diagnostics);
                case CreateTableOperation createTable:
                    return new CreateTableOperation(
                        BindTableDefinition(
                            createTable.Table,
                            scope,
                            path + ".Table",
                            diagnostics),
                        createTable.Behavior);
                case AddColumnOperation addColumn:
                    return new AddColumnOperation(
                        addColumn.Table,
                        BindColumnDefinition(
                            addColumn.Column,
                            TargetScope(addColumn.Table, scope),
                            path + ".Column",
                            diagnostics));
                case AlterColumnOperation alterColumn:
                    return new AlterColumnOperation(
                        alterColumn.Table,
                        BindColumnDefinition(
                            alterColumn.Before,
                            TargetScope(alterColumn.Table, scope),
                            path + ".Before",
                            diagnostics),
                        BindColumnDefinition(
                            alterColumn.After,
                            TargetScope(alterColumn.Table, scope),
                            path + ".After",
                            diagnostics));
                case MigrationStep step:
                    return new MigrationStep(
                        step.Id,
                        (SchemaOperation)BindNode(
                            step.Operation,
                            scope,
                            path + ".Operation",
                            diagnostics),
                        step.Idempotency);

                // These neutral nodes carry no bindable column expression.
                // Retaining them is their explicit closed-set disposition and
                // preserves approvals/fingerprints that have no public copier.
                case NullDefaultDefinition _:
                case BooleanDefaultDefinition _:
                case Int64DefaultDefinition _:
                case DecimalDefaultDefinition _:
                case StringDefaultDefinition _:
                case GuidDefaultDefinition _:
                case DateTimeDefaultDefinition _:
                case DateTimeOffsetDefaultDefinition _:
                case SemanticDefaultDefinition _:
                case IdentityGenerationDefinition _:
                case SequenceGenerationDefinition _:
                case SchemaName _:
                case SchemaScope _:
                case IndexColumnDefinition _:
                case IndexDefinition _:
                case PrimaryKeyDefinition _:
                case UniqueConstraintDefinition _:
                case ForeignKeyColumnSet _:
                case ReferentialActions _:
                case ForeignKeyDefinition _:
                case SequenceBounds _:
                case SequenceOptions _:
                case SequenceDefinition _:
                case CreateSchemaOperation _:
                case DropSchemaOperation _:
                case RenameTableOperation _:
                case DropTableOperation _:
                case RenameColumnOperation _:
                case DropColumnOperation _:
                case AddConstraintOperation _:
                case DropConstraintOperation _:
                case CreateIndexOperation _:
                case DropIndexOperation _:
                case CreateSequenceOperation _:
                case AlterSequenceOperation _:
                case DropSequenceOperation _:
                case SetTableCommentOperation _:
                case RemoveTableCommentOperation _:
                case SetColumnCommentOperation _:
                case RemoveColumnCommentOperation _:
                case MigrationPlan _:
                case ListTablesOperation _:
                case GetTableMetadataOperation _:
                case ListColumnsOperation _:
                case GetColumnMetadataOperation _:
                case ListIndexesOperation _:
                case GetIndexMetadataOperation _:
                case DatabaseDiagnosticOperation _:
                case CreateDatabaseOperation _:
                case DropDatabaseOperation _:
                case DatabaseExportOperation _:
                case DatabaseImportOperation _:
                    return node;
                default:
                    // Unknown nodes are retained for SqlAstValidator, which
                    // owns the closed-set shape diagnostic.
                    return node;
            }
        }

        private static ColumnExpression BindColumn(
            ColumnExpression column,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            if (column.Source != null)
            {
                var explicitOwner = scope == null
                    ? AliasResolution.None
                    : scope.Resolve(column.Source);
                if (explicitOwner.Kind == AliasResolutionKind.None)
                {
                    diagnostics.Add(new SqlAstDiagnostic(
                        UnresolvedCode, UnresolvedMessage, path));
                }
                else if (explicitOwner.Kind == AliasResolutionKind.Multiple)
                {
                    diagnostics.Add(new SqlAstDiagnostic(
                        AmbiguousCode, AmbiguousMessage, path));
                }

                return new ColumnExpression(column.Name, column.Source);
            }

            var visible = scope == null
                ? AliasResolution.None
                : scope.ResolveUnqualified();
            if (visible.Kind == AliasResolutionKind.Single)
            {
                return new ColumnExpression(column.Name, visible.Alias);
            }

            if (visible.Kind == AliasResolutionKind.Multiple)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    AmbiguousCode, AmbiguousMessage, path));
            }
            else
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    UnresolvedCode, UnresolvedMessage, path));
            }

            return new ColumnExpression(column.Name);
        }

        private static CaseExpression BindCase(
            CaseExpression @case,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var clauses = new List<CaseWhenClause>();
            for (var index = 0; index < @case.WhenClauses.Count; index++)
            {
                var clause = @case.WhenClauses[index];
                var clausePath = path + ".WhenClauses[" + index + "]";
                clauses.Add(new CaseWhenClause(
                    BindExpression(
                        clause.When,
                        scope,
                        clausePath + ".When",
                        diagnostics),
                    BindExpression(
                        clause.Then,
                        scope,
                        clausePath + ".Then",
                        diagnostics)));
            }

            var elseExpression = @case.ElseExpression == null
                ? null
                : BindExpression(
                    @case.ElseExpression,
                    scope,
                    path + ".ElseExpression",
                    diagnostics);
            if (@case.InputExpression == null)
            {
                return new CaseExpression(clauses, elseExpression);
            }

            return new CaseExpression(
                BindExpression(
                    @case.InputExpression,
                    scope,
                    path + ".InputExpression",
                    diagnostics),
                clauses,
                elseExpression);
        }

        private static JoinSource BindJoin(
            JoinSource join,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var aliases = VisibleAliases(join);
            var conditionScope = AliasScope.Create(aliases, outerScope);
            return new JoinSource(
                (SqlTableSource)BindNode(
                    join.Left,
                    outerScope,
                    path + ".Left",
                    diagnostics),
                join.JoinType,
                (SqlTableSource)BindNode(
                    join.Right,
                    outerScope,
                    path + ".Right",
                    diagnostics),
                join.Condition == null
                    ? null
                    : BindExpression(
                        join.Condition,
                        conditionScope,
                        path + ".Condition",
                        diagnostics));
        }

        private static SelectStatement BindSelect(
            SelectStatement select,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var localScope = AliasScope.Create(
                VisibleAliases(select.From), outerScope);
            var from = select.From == null
                ? null
                : (SqlTableSource)BindNode(
                    select.From,
                    outerScope,
                    path + ".From",
                    diagnostics);
            var projections = BindProjections(
                select.Projections,
                localScope,
                path + ".Projections",
                diagnostics);
            var where = select.Where == null
                ? null
                : BindExpression(
                    select.Where,
                    localScope,
                    path + ".Where",
                    diagnostics);
            var groupBy = BindExpressions(
                select.GroupBy,
                localScope,
                path + ".GroupBy",
                diagnostics);
            var having = select.Having == null
                ? null
                : BindExpression(
                    select.Having,
                    localScope,
                    path + ".Having",
                    diagnostics);
            var orderBy = new List<OrderByExpression>();
            for (var index = 0; index < select.OrderBy.Count; index++)
            {
                orderBy.Add((OrderByExpression)BindNode(
                    select.OrderBy[index],
                    localScope,
                    path + ".OrderBy[" + index + "]",
                    diagnostics));
            }

            var page = select.Page == null
                ? null
                : (PageSpec)BindNode(
                    select.Page,
                    localScope,
                    path + ".Page",
                    diagnostics);
            var lockSpec = select.Lock == null
                ? null
                : (LockSpec)BindNode(
                    select.Lock,
                    localScope,
                    path + ".Lock",
                    diagnostics);
            var common = new List<CommonTableExpression>();
            for (var index = 0;
                index < select.CommonTableExpressions.Count;
                index++)
            {
                common.Add((CommonTableExpression)BindNode(
                    select.CommonTableExpressions[index],
                    outerScope,
                    path + ".CommonTableExpressions[" + index + "]",
                    diagnostics));
            }

            var sets = new List<SetOperationClause>();
            for (var index = 0; index < select.SetOperations.Count; index++)
            {
                sets.Add((SetOperationClause)BindNode(
                    select.SetOperations[index],
                    outerScope,
                    path + ".SetOperations[" + index + "]",
                    diagnostics));
            }

            if (from == null)
            {
                return new SelectStatement(
                    projections,
                    select.Distinct,
                    where,
                    groupBy,
                    having,
                    orderBy,
                    page,
                    lockSpec,
                    common,
                    sets);
            }

            return new SelectStatement(
                from,
                projections,
                select.Distinct,
                where,
                groupBy,
                having,
                orderBy,
                page,
                lockSpec,
                common,
                sets);
        }

        private static SelectProjection BindProjection(
            SelectProjection projection,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            return new SelectProjection(
                BindExpression(
                    projection.Expression,
                    scope,
                    path + ".Expression",
                    diagnostics),
                projection.Alias);
        }

        private static InsertStatement BindInsert(
            InsertStatement insert,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(insert.Table, outerScope);
            var returning = insert.Returning == null
                ? null
                : (ReturningClause)BindNode(
                    insert.Returning,
                    scope,
                    path + ".Returning",
                    diagnostics);
            if (insert.Source != null)
            {
                return InsertStatement.FromSelect(
                    insert.Table,
                    insert.Columns,
                    BindSelect(
                        insert.Source,
                        scope,
                        path + ".Source",
                        diagnostics),
                    returning);
            }

            var rows = new List<SqlInsertRow>();
            for (var index = 0; index < insert.Rows.Count; index++)
            {
                rows.Add((SqlInsertRow)BindNode(
                    insert.Rows[index],
                    scope,
                    path + ".Rows[" + index + "]",
                    diagnostics));
            }

            return InsertStatement.Values(
                insert.Table, insert.Columns, rows, returning);
        }

        private static UpdateStatement BindUpdate(
            UpdateStatement update,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(update.Table, outerScope);
            return new UpdateStatement(
                update.Table,
                BindAssignments(
                    update.Assignments,
                    scope,
                    path + ".Assignments",
                    diagnostics),
                update.Where == null
                    ? null
                    : BindExpression(
                        update.Where,
                        scope,
                        path + ".Where",
                        diagnostics),
                update.AllowAllRows,
                update.Returning == null
                    ? null
                    : (ReturningClause)BindNode(
                        update.Returning,
                        scope,
                        path + ".Returning",
                        diagnostics));
        }

        private static DeleteStatement BindDelete(
            DeleteStatement delete,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(delete.Table, outerScope);
            return new DeleteStatement(
                delete.Table,
                delete.Where == null
                    ? null
                    : BindExpression(
                        delete.Where,
                        scope,
                        path + ".Where",
                        diagnostics),
                delete.AllowAllRows,
                delete.Returning == null
                    ? null
                    : (ReturningClause)BindNode(
                        delete.Returning,
                        scope,
                        path + ".Returning",
                        diagnostics));
        }

        private static UpsertStatement BindUpsert(
            UpsertStatement upsert,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(upsert.Table, outerScope);
            return new UpsertStatement(
                upsert.Table,
                upsert.ConflictKeys,
                BindAssignments(
                    upsert.InsertAssignments,
                    scope,
                    path + ".InsertAssignments",
                    diagnostics),
                BindAssignments(
                    upsert.UpdateAssignments,
                    scope,
                    path + ".UpdateAssignments",
                    diagnostics),
                upsert.Policy,
                upsert.Returning == null
                    ? null
                    : (ReturningClause)BindNode(
                        upsert.Returning,
                        scope,
                        path + ".Returning",
                        diagnostics));
        }

        private static BulkInsertOperation BindBulk(
            BulkInsertOperation bulk,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(bulk.Table, outerScope);
            var rows = new List<SqlInsertRow>();
            for (var index = 0; index < bulk.Rows.Count; index++)
            {
                rows.Add((SqlInsertRow)BindNode(
                    bulk.Rows[index],
                    scope,
                    path + ".Rows[" + index + "]",
                    diagnostics));
            }

            return new BulkInsertOperation(
                bulk.Table, bulk.Columns, rows, bulk.BatchSize);
        }

        private static ColumnDefinition BindColumnDefinition(
            ColumnDefinition column,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var generation = column.Generation == null
                ? null
                : (ColumnGenerationDefinition)BindNode(
                    column.Generation,
                    scope,
                    path + ".Generation",
                    diagnostics);
            return new ColumnDefinition(
                column.Name,
                column.Type,
                column.Nullability,
                generation,
                column.DefaultValue,
                column.Comment);
        }

        private static TableDefinition BindTableDefinition(
            TableDefinition table,
            AliasScope outerScope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var scope = TargetScope(table.Name, outerScope);
            var columns = new List<ColumnDefinition>();
            for (var index = 0; index < table.Columns.Count; index++)
            {
                columns.Add(BindColumnDefinition(
                    table.Columns[index],
                    scope,
                    path + ".Columns[" + index + "]",
                    diagnostics));
            }

            return new TableDefinition(
                table.Name,
                columns,
                table.Constraints,
                table.Indexes,
                table.Comment);
        }

        private static SqlExpression BindExpression(
            SqlExpression expression,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            return (SqlExpression)BindNode(
                expression, scope, path, diagnostics);
        }

        private static List<SqlExpression> BindExpressions(
            IReadOnlyList<SqlExpression> expressions,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var bound = new List<SqlExpression>(expressions.Count);
            for (var index = 0; index < expressions.Count; index++)
            {
                bound.Add(BindExpression(
                    expressions[index],
                    scope,
                    path + "[" + index + "]",
                    diagnostics));
            }

            return bound;
        }

        private static List<SelectProjection> BindProjections(
            IReadOnlyList<SelectProjection> projections,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var bound = new List<SelectProjection>(projections.Count);
            for (var index = 0; index < projections.Count; index++)
            {
                bound.Add(BindProjection(
                    projections[index],
                    scope,
                    path + "[" + index + "]",
                    diagnostics));
            }

            return bound;
        }

        private static List<SqlAssignment> BindAssignments(
            IReadOnlyList<SqlAssignment> assignments,
            AliasScope scope,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            var bound = new List<SqlAssignment>(assignments.Count);
            for (var index = 0; index < assignments.Count; index++)
            {
                bound.Add((SqlAssignment)BindNode(
                    assignments[index],
                    scope,
                    path + "[" + index + "]",
                    diagnostics));
            }

            return bound;
        }

        private static AliasScope TargetScope(
            SqlObjectName table,
            AliasScope parent)
        {
            return AliasScope.Create(
                new[] { new SqlAlias(table.Name) }, parent);
        }

        private static IReadOnlyList<SqlAlias> VisibleAliases(
            SqlTableSource source)
        {
            var aliases = new List<SqlAlias>();
            CollectVisibleAliases(source, aliases);
            return aliases;
        }

        private static void CollectVisibleAliases(
            SqlTableSource source,
            ICollection<SqlAlias> aliases)
        {
            if (source == null)
            {
                return;
            }

            if (source is NamedTableSource named)
            {
                aliases.Add(
                    named.Alias ?? new SqlAlias(named.Name.Name));
                return;
            }

            if (source is DerivedTableSource derived)
            {
                aliases.Add(derived.Alias);
                return;
            }

            if (source is JoinSource join)
            {
                CollectVisibleAliases(join.Left, aliases);
                CollectVisibleAliases(join.Right, aliases);
            }
        }

        private enum AliasResolutionKind
        {
            None,
            Single,
            Multiple
        }

        private readonly struct AliasResolution
        {
            internal static readonly AliasResolution None =
                new AliasResolution(AliasResolutionKind.None, null);

            internal AliasResolution(
                AliasResolutionKind kind,
                SqlAlias alias)
            {
                Kind = kind;
                Alias = alias;
            }

            internal AliasResolutionKind Kind { get; }

            internal SqlAlias Alias { get; }
        }

        private sealed class AliasScope
        {
            private readonly IReadOnlyList<SqlAlias> _aliases;
            private readonly AliasScope _parent;

            private AliasScope(
                IReadOnlyList<SqlAlias> aliases,
                AliasScope parent)
            {
                _aliases = aliases;
                _parent = parent;
            }

            internal static AliasScope Create(
                IReadOnlyList<SqlAlias> aliases,
                AliasScope parent)
            {
                if (aliases == null || aliases.Count == 0)
                {
                    return parent;
                }

                return new AliasScope(aliases, parent);
            }

            internal AliasResolution Resolve(SqlAlias alias)
            {
                for (var current = this;
                    current != null;
                    current = current._parent)
                {
                    var matches = 0;
                    for (var index = 0;
                        index < current._aliases.Count;
                        index++)
                    {
                        if (current._aliases[index].Equals(alias))
                        {
                            matches++;
                        }
                    }
                    if (matches == 1)
                    {
                        return new AliasResolution(
                            AliasResolutionKind.Single,
                            alias);
                    }
                    if (matches > 1)
                    {
                        return new AliasResolution(
                            AliasResolutionKind.Multiple,
                            null);
                    }
                }

                return AliasResolution.None;
            }

            internal AliasResolution ResolveUnqualified()
            {
                for (var current = this;
                    current != null;
                    current = current._parent)
                {
                    if (current._aliases.Count == 1)
                    {
                        return new AliasResolution(
                            AliasResolutionKind.Single,
                            current._aliases[0]);
                    }

                    if (current._aliases.Count > 1)
                    {
                        return new AliasResolution(
                            AliasResolutionKind.Multiple,
                            null);
                    }
                }

                return AliasResolution.None;
            }
        }
    }
}
