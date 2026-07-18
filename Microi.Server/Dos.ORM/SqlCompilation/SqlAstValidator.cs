using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Data;
using System.Runtime.CompilerServices;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal sealed class SqlAstRetainedInspection
    {
        internal SqlAstRetainedInspection(
            SqlAstInspectionSession session,
            IReadOnlyList<SqlAstDiagnostic> diagnostics)
        {
            Session = session ?? throw new ArgumentNullException(nameof(session));
            Diagnostics = diagnostics ??
                throw new ArgumentNullException(nameof(diagnostics));
        }

        internal SqlAstInspectionSession Session { get; }

        internal IReadOnlyList<SqlAstDiagnostic> Diagnostics { get; }
    }

    internal enum SqlAstLocalEntryKind
    {
        Diagnostic,
        Deferred
    }

    internal enum SqlAstDeferredRuleKind
    {
        CteResultArity,
        SelectSetOperationArities,
        InsertSourceArity,
        SelectKeysetPolicies,
        InsertRowArities,
        BulkInsertRowArities,
        UpsertAssignmentShape,
        TableCrossReferences
    }

    internal readonly struct SqlAstDeferredRule
    {
        internal SqlAstDeferredRule(
            SqlAstDeferredRuleKind kind,
            int ownerOccurrenceId,
            string anchorPath)
        {
            Kind = kind;
            OwnerOccurrenceId = ownerOccurrenceId;
            AnchorPath = anchorPath;
        }

        internal SqlAstDeferredRuleKind Kind { get; }
        internal int OwnerOccurrenceId { get; }
        internal string AnchorPath { get; }
    }

    internal sealed class SqlAstLocalEntry
    {
        internal SqlAstLocalEntry(SqlAstDiagnostic diagnostic)
        {
            Kind = SqlAstLocalEntryKind.Diagnostic;
            Diagnostic = diagnostic;
        }

        internal SqlAstLocalEntry(SqlAstDeferredRule deferredRule)
        {
            Kind = SqlAstLocalEntryKind.Deferred;
            DeferredRule = deferredRule;
        }

        internal SqlAstLocalEntryKind Kind { get; }
        internal SqlAstDiagnostic Diagnostic { get; }
        internal SqlAstDeferredRule DeferredRule { get; }
        internal List<SqlAstDiagnostic> ResolvedDiagnostics { get; } =
            new List<SqlAstDiagnostic>();
    }

    internal enum SqlAstParameterFactKind
    {
        MissingOrInvalid,
        FirstValidDefinition,
        EquivalentReuse,
        ConflictingRedefinition
    }

    internal readonly struct SqlAstParameterOccurrenceFact
    {
        internal SqlAstParameterOccurrenceFact(
            SqlAstParameterFactKind kind,
            int? firstOccurrenceId)
        {
            Kind = kind;
            FirstOccurrenceId = firstOccurrenceId;
        }

        internal SqlAstParameterFactKind Kind { get; }
        internal int? FirstOccurrenceId { get; }
    }

    internal sealed class SqlAstCanonicalParameterCatalog
    {
        private readonly Dictionary<string, CanonicalParameter> _byName =
            new Dictionary<string, CanonicalParameter>(StringComparer.Ordinal);
        private readonly Dictionary<int, SqlAstParameterOccurrenceFact>
            _byOccurrence =
                new Dictionary<int, SqlAstParameterOccurrenceFact>();

        internal bool IsSealed { get; private set; }

        internal SqlAstParameterOccurrenceFact Record(
            int occurrenceId,
            ParameterDefinition definition,
            bool valid)
        {
            if (IsSealed)
            {
                throw new InvalidOperationException(
                    "SQL AST parameter catalog is sealed.");
            }

            SqlAstParameterOccurrenceFact fact;
            if (!valid || definition == null)
            {
                fact = new SqlAstParameterOccurrenceFact(
                    SqlAstParameterFactKind.MissingOrInvalid, null);
            }
            else if (!_byName.TryGetValue(
                definition.Name, out var first))
            {
                first = new CanonicalParameter(definition, occurrenceId);
                _byName.Add(definition.Name, first);
                fact = new SqlAstParameterOccurrenceFact(
                    SqlAstParameterFactKind.FirstValidDefinition,
                    occurrenceId);
            }
            else if (DefinitionsEqual(first.Definition, definition))
            {
                fact = new SqlAstParameterOccurrenceFact(
                    SqlAstParameterFactKind.EquivalentReuse,
                    first.OccurrenceId);
            }
            else
            {
                fact = new SqlAstParameterOccurrenceFact(
                    SqlAstParameterFactKind.ConflictingRedefinition,
                    first.OccurrenceId);
            }

            _byOccurrence.Add(occurrenceId, fact);
            return fact;
        }

        internal bool TryGetFact(
            int occurrenceId,
            out SqlAstParameterOccurrenceFact fact)
        {
            return _byOccurrence.TryGetValue(occurrenceId, out fact);
        }

        internal void Seal()
        {
            IsSealed = true;
        }

        private static bool DefinitionsEqual(
            ParameterDefinition left,
            ParameterDefinition right)
        {
            return left != null && right != null &&
                   Equals(left.Type, right.Type) &&
                   left.Direction == right.Direction &&
                   left.IsNullable == right.IsNullable;
        }

        private sealed class CanonicalParameter
        {
            internal CanonicalParameter(
                ParameterDefinition definition,
                int occurrenceId)
            {
                Definition = definition;
                OccurrenceId = occurrenceId;
            }

            internal ParameterDefinition Definition { get; }
            internal int OccurrenceId { get; }
        }
    }

    public sealed class SqlAstValidator
    {
        public IReadOnlyList<SqlAstDiagnostic> Validate(SqlNode root)
        {
            if (root == null)
            {
                throw new ArgumentNullException(nameof(root));
            }

            return InspectRetained(root).Diagnostics;
        }

        internal static int? GetKnownSelectWidth(
            SelectStatement query,
            bool coreOnly)
        {
            if (query == null)
            {
                throw new ArgumentNullException(nameof(query));
            }
            var inspection = InspectRetained(query);
            var session = inspection.Session;
            if (session.Occurrences.Count == 0)
            {
                return null;
            }
            var root = session.Occurrences[0];
            return coreOnly ? root.CoreWidth : root.ResultWidth;
        }

        internal static bool HasRetainedDiagnostics(SqlNode root)
        {
            return InspectRetained(root).Diagnostics.Count != 0;
        }

        internal static SqlAstRetainedInspection InspectRetained(SqlNode root)
        {
            if (root == null)
            {
                throw new ArgumentNullException(nameof(root));
            }

            var session = new SqlAstInspectionSession();
            var context = new ValidationContext(
                session, validateStaticArity: true);
            SqlAstTraversal.Walk(
                root,
                session,
                context.ValidateOccurrence,
                context.AddTraversalIssue);
            var diagnostics = new ReadOnlyCollection<SqlAstDiagnostic>(
                context.MaterializeDiagnostics());
            return new SqlAstRetainedInspection(session, diagnostics);
        }

        private sealed class ValidationContext
        {
            private readonly SqlAstInspectionSession _session;
            private readonly SqlAstCollectionInspectionLedger _ledger;
            private readonly bool _validateStaticArity;
            private readonly Dictionary<int, ColumnFact> _columnFacts =
                new Dictionary<int, ColumnFact>();
            private readonly Dictionary<int, IndexColumnFact> _indexColumnFacts =
                new Dictionary<int, IndexColumnFact>();
            private readonly Dictionary<int, ReferentialActionsFact>
                _referentialActionsFacts =
                    new Dictionary<int, ReferentialActionsFact>();
            private readonly Dictionary<int, AssignmentFact> _assignmentFacts =
                new Dictionary<int, AssignmentFact>();
            private readonly Dictionary<int, UpsertShapeFact> _upsertShapeFacts =
                new Dictionary<int, UpsertShapeFact>();
            private readonly Dictionary<string, IdentifierListFact>
                _identifierListFacts =
                    new Dictionary<string, IdentifierListFact>(
                        StringComparer.Ordinal);
            private readonly Dictionary<string, ObjectNameFact> _objectNameFacts =
                new Dictionary<string, ObjectNameFact>(StringComparer.Ordinal);
            private SqlAstOccurrence _currentOccurrence;
            private bool _deferredResolved;

            internal ValidationContext(
                SqlAstInspectionSession session,
                bool validateStaticArity)
            {
                _session = session ?? throw new ArgumentNullException(nameof(session));
                _ledger = session.Ledger;
                _validateStaticArity = validateStaticArity;
            }

            internal void ValidateOccurrence(SqlAstOccurrence occurrence)
            {
                _currentOccurrence = occurrence ??
                    throw new ArgumentNullException(nameof(occurrence));
                try
                {
                    ValidateNode(occurrence.Node, occurrence.Path);
                }
                catch (TerminalCollectionSignalException)
                {
                    // The traversal loop owns the sole public terminal issue.
                    // This signal only seals the current local validation path.
                }
            }

            internal List<SqlAstDiagnostic> MaterializeDiagnostics()
            {
                ResolveDeferredRules();
                var diagnostics = new List<SqlAstDiagnostic>();
                for (var index = 0; index < _session.Segments.Count; index++)
                {
                    var segment = _session.Segments[index];
                    if (segment.Kind ==
                        SqlAstCanonicalSegmentKind.TraversalIssue)
                    {
                        diagnostics.Add(DiagnosticFor(segment.Issue));
                        continue;
                    }

                    var occurrence =
                        _session.Occurrences[segment.OccurrenceId];
                    for (var entryIndex = 0;
                         entryIndex < occurrence.LocalEntries.Count;
                         entryIndex++)
                    {
                        var entry = occurrence.LocalEntries[entryIndex];
                        if (entry.Kind == SqlAstLocalEntryKind.Diagnostic)
                        {
                            diagnostics.Add(entry.Diagnostic);
                        }
                        else
                        {
                            diagnostics.AddRange(entry.ResolvedDiagnostics);
                        }
                    }
                }
                return diagnostics;
            }

            private void ResolveDeferredRules()
            {
                if (_deferredResolved)
                {
                    return;
                }
                _deferredResolved = true;

                for (var occurrenceIndex =
                         _session.Occurrences.Count - 1;
                     occurrenceIndex >= 0;
                     occurrenceIndex--)
                {
                    var occurrence =
                        _session.Occurrences[occurrenceIndex];
                    var state = InitialRetainedState(occurrence);
                    var canResolve = occurrence.ExpansionComplete &&
                        occurrence.Phase == SqlAstOccurrencePhase.Closed;
                    if (canResolve && occurrence.Node is SelectStatement)
                    {
                        occurrence.CoreWidth =
                            ComputeSelectCoreWidth(occurrence);
                    }

                    for (var entryIndex = 0;
                         entryIndex < occurrence.LocalEntries.Count;
                         entryIndex++)
                    {
                        var entry = occurrence.LocalEntries[entryIndex];
                        if (entry.Kind != SqlAstLocalEntryKind.Deferred)
                        {
                            continue;
                        }
                        if (canResolve)
                        {
                            ResolveDeferredEntry(occurrence, entry);
                        }
                        if (entry.ResolvedDiagnostics.Count != 0)
                        {
                            state = SqlAstRetainedState.Invalid;
                        }
                    }

                    if (canResolve && occurrence.Node is SelectStatement &&
                        !occurrence.ShapeWidth.HasValue)
                    {
                        occurrence.ShapeWidth = ShapeWithoutDeferredSets(
                            occurrence);
                    }

                    occurrence.FinalState = state;
                    if (occurrence.Node is SelectStatement)
                    {
                        occurrence.ResultWidth = occurrence.ShapeWidth;
                    }
                }
            }

            private SqlAstRetainedState InitialRetainedState(
                SqlAstOccurrence occurrence)
            {
                var state = occurrence.BaseState ==
                    SqlAstRetainedState.Invalid
                    ? SqlAstRetainedState.Invalid
                    : SqlAstRetainedState.Valid;
                if (!occurrence.ExpansionComplete ||
                    occurrence.Phase == SqlAstOccurrencePhase.TerminalCut)
                {
                    if (state == SqlAstRetainedState.Valid)
                    {
                        state = SqlAstRetainedState.UnknownIncomplete;
                    }
                }

                for (var edgeIndex = 0;
                     edgeIndex < occurrence.ChildEdges.Count;
                     edgeIndex++)
                {
                    var edge = occurrence.ChildEdges[edgeIndex];
                    if (edge.Issue.HasValue)
                    {
                        if (state == SqlAstRetainedState.Valid)
                        {
                            state = SqlAstRetainedState.UnknownIncomplete;
                        }
                        continue;
                    }
                    if (!edge.ChildOccurrenceId.HasValue)
                    {
                        continue;
                    }

                    var child = _session.Occurrences[
                        edge.ChildOccurrenceId.Value];
                    if (child.FinalState == SqlAstRetainedState.Invalid)
                    {
                        state = SqlAstRetainedState.Invalid;
                    }
                    else if (child.FinalState != SqlAstRetainedState.Valid &&
                             state == SqlAstRetainedState.Valid)
                    {
                        state = SqlAstRetainedState.UnknownIncomplete;
                    }
                }
                return state;
            }

            private int? ComputeSelectCoreWidth(
                SqlAstOccurrence occurrence)
            {
                var path = occurrence.Path + ".Projections";
                if (!_ledger.TryGetCompleteSnapshot<SelectProjection>(
                        path, out var projections) ||
                    projections.Count == 0)
                {
                    return null;
                }

                for (var index = 0; index < projections.Count; index++)
                {
                    var projectionPath = Indexed(path, index);
                    if (projections[index] == null ||
                        !_session.TryGetOccurrence(
                            projectionPath + ".Expression",
                            out var expressionOccurrence) ||
                        expressionOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        expressionOccurrence.Node is WildcardExpression)
                    {
                        return null;
                    }
                }
                return projections.Count;
            }

            private int? ShapeWithoutDeferredSets(
                SqlAstOccurrence occurrence)
            {
                if (!_ledger.TryGetCompleteSnapshot<SetOperationClause>(
                        occurrence.Path + ".SetOperations", out var sets) ||
                    sets.Count != 0)
                {
                    return null;
                }
                return occurrence.CoreWidth;
            }

            private void ResolveDeferredEntry(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                switch (entry.DeferredRule.Kind)
                {
                    case SqlAstDeferredRuleKind.CteResultArity:
                        ResolveCteResultArity(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.SelectSetOperationArities:
                        ResolveSelectSetOperationArities(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.InsertSourceArity:
                        ResolveInsertSourceArity(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.SelectKeysetPolicies:
                        ResolveSelectKeysetPolicies(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.InsertRowArities:
                        ResolveRowArities(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.BulkInsertRowArities:
                        ResolveRowArities(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.UpsertAssignmentShape:
                        ResolveUpsertAssignmentShape(occurrence, entry);
                        break;
                    case SqlAstDeferredRuleKind.TableCrossReferences:
                        ResolveTableCrossReferences(occurrence, entry);
                        break;
                    default:
                        throw new InvalidOperationException(
                            "SQL AST deferred rule kind is undefined.");
                }
            }

            private void ResolveCteResultArity(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!_ledger.TryGetCompleteSnapshot<SqlIdentifier>(
                        occurrence.Path + ".Columns", out var columns) ||
                    !_session.TryGetOccurrence(
                        occurrence.Path + ".Query", out var query) ||
                    !query.ResultWidth.HasValue)
                {
                    return;
                }
                if (query.ResultWidth.Value != columns.Count)
                {
                    ResolveAdd(entry, "AST_CTE_COLUMN_ARITY_MISMATCH",
                        occurrence.Path + ".Columns");
                }
            }

            private void ResolveSelectSetOperationArities(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!occurrence.CoreWidth.HasValue ||
                    !_ledger.TryGetCompleteSnapshot<SetOperationClause>(
                        occurrence.Path + ".SetOperations", out var sets))
                {
                    occurrence.ShapeWidth = null;
                    return;
                }

                var shapeKnown = true;
                for (var index = 0; index < sets.Count; index++)
                {
                    var itemPath = Indexed(
                        occurrence.Path + ".SetOperations", index);
                    if (sets[index] == null ||
                        !_session.TryGetOccurrence(
                            itemPath, out _) ||
                        !_session.TryGetOccurrence(
                            itemPath + ".RightQuery", out var right) ||
                        !right.ResultWidth.HasValue)
                    {
                        shapeKnown = false;
                        continue;
                    }

                    if (right.ResultWidth.Value !=
                        occurrence.CoreWidth.Value)
                    {
                        shapeKnown = false;
                        ResolveAdd(
                            entry,
                            "AST_SET_OPERATION_ARITY_MISMATCH",
                            itemPath + ".RightQuery.Projections");
                    }
                }
                occurrence.ShapeWidth = shapeKnown
                    ? occurrence.CoreWidth
                    : null;
            }

            private void ResolveInsertSourceArity(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!_ledger.TryGetCompleteSnapshot<SqlIdentifier>(
                        occurrence.Path + ".Columns", out var columns) ||
                    !_session.TryGetOccurrence(
                        occurrence.Path + ".Source", out var source) ||
                    !source.ResultWidth.HasValue)
                {
                    return;
                }
                if (source.ResultWidth.Value != columns.Count)
                {
                    ResolveAdd(entry, "AST_INSERT_SOURCE_ARITY_MISMATCH",
                        occurrence.Path + ".Source.Projections");
                }
            }

            private void ResolveSelectKeysetPolicies(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!_session.TryGetOccurrence(
                        occurrence.Path + ".Page", out var pageOccurrence) ||
                    !(pageOccurrence.Node is KeysetPageSpec) ||
                    !_ledger.TryGetCompleteSnapshot<OrderByExpression>(
                        occurrence.Path + ".OrderBy", out var orderBy) ||
                    !_ledger.TryGetCompleteSnapshot<SqlExpression>(
                        occurrence.Path + ".Page.Boundaries",
                        out var boundaries))
                {
                    return;
                }

                if (orderBy.Count == 0)
                {
                    ResolveAdd(entry, "AST_KEYSET_ORDER_REQUIRED",
                        occurrence.Path + ".Page");
                }
                if (boundaries.Count == 0)
                {
                    ResolveAdd(entry, "AST_KEYSET_BOUNDARY_REQUIRED",
                        occurrence.Path + ".Page");
                }
                if (AllNonNull(orderBy) && AllNonNull(boundaries) &&
                    AllChildOccurrencesValid(
                        occurrence.Path + ".OrderBy", orderBy.Count) &&
                    AllChildOccurrencesValid(
                        occurrence.Path + ".Page.Boundaries",
                        boundaries.Count) &&
                    orderBy.Count != boundaries.Count)
                {
                    ResolveAdd(entry, "AST_KEYSET_ARITY_MISMATCH",
                        occurrence.Path + ".Page");
                }
            }

            private void ResolveRowArities(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!_ledger.TryGetCompleteSnapshot<SqlIdentifier>(
                        occurrence.Path + ".Columns", out var columns) ||
                    !_ledger.TryGetCompleteSnapshot<SqlInsertRow>(
                        occurrence.Path + ".Rows", out var rows))
                {
                    return;
                }

                for (var index = 0; index < rows.Count; index++)
                {
                    var rowPath = Indexed(
                        occurrence.Path + ".Rows", index);
                    if (rows[index] == null ||
                        !_session.TryGetOccurrence(
                            rowPath, out var rowOccurrence) ||
                        rowOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !_ledger.TryGetCompleteSnapshot<SqlExpression>(
                            rowPath + ".Values", out var values) ||
                        !AllNonNull(values))
                    {
                        continue;
                    }
                    if (values.Count != columns.Count)
                    {
                        ResolveAdd(entry, "AST_DML_ROW_ARITY_MISMATCH",
                            rowPath + ".Values");
                    }
                }
            }

            private void ResolveUpsertAssignmentShape(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!_upsertShapeFacts.TryGetValue(
                        occurrence.Id, out var shape) ||
                    !_identifierListFacts.TryGetValue(
                        occurrence.Path + ".ConflictKeys", out var keys))
                {
                    return;
                }

                if (shape.CheckInsertAssignments &&
                    _ledger.TryGetCompleteSnapshot<SqlAssignment>(
                        occurrence.Path + ".InsertAssignments",
                        out var inserts))
                {
                    var columns = new HashSet<string>(StringComparer.Ordinal);
                    var columnsKnown = true;
                    for (var index = 0; index < inserts.Count; index++)
                    {
                        var itemPath = Indexed(
                            occurrence.Path + ".InsertAssignments", index);
                        if (inserts[index] == null ||
                            !_session.TryGetOccurrence(
                                itemPath, out var assignmentOccurrence) ||
                            !_assignmentFacts.TryGetValue(
                                assignmentOccurrence.Id, out var assignment) ||
                            !assignment.ColumnValid)
                        {
                            columnsKnown = false;
                            break;
                        }
                        columns.Add(assignment.ColumnValue);
                    }

                    if (columnsKnown)
                    {
                        for (var index = 0; index < keys.Count; index++)
                        {
                            if (!columns.Contains(keys[index]))
                            {
                                ResolveAdd(
                                    entry,
                                    "AST_UPSERT_SHAPE_INVALID",
                                    occurrence.Path + ".InsertAssignments");
                            }
                        }
                    }
                }

                if (!shape.CheckUpdateAssignments ||
                    !_ledger.TryGetCompleteSnapshot<SqlAssignment>(
                        occurrence.Path + ".UpdateAssignments",
                        out var updates))
                {
                    return;
                }

                var conflictKeys = new HashSet<string>(StringComparer.Ordinal);
                for (var index = 0; index < keys.Count; index++)
                {
                    conflictKeys.Add(keys[index]);
                }
                for (var index = 0; index < updates.Count; index++)
                {
                    var itemPath = Indexed(
                        occurrence.Path + ".UpdateAssignments", index);
                    if (updates[index] == null ||
                        !_session.TryGetOccurrence(
                            itemPath, out var assignmentOccurrence) ||
                        !_assignmentFacts.TryGetValue(
                            assignmentOccurrence.Id, out var assignment) ||
                        !assignment.ColumnValid)
                    {
                        continue;
                    }
                    if (conflictKeys.Contains(assignment.ColumnValue))
                    {
                        ResolveAdd(
                            entry,
                            "AST_UPSERT_SHAPE_INVALID",
                            itemPath + ".Column");
                    }
                }
            }

            private void ResolveTableCrossReferences(
                SqlAstOccurrence occurrence,
                SqlAstLocalEntry entry)
            {
                if (!occurrence.ExpansionComplete ||
                    !(occurrence.Node is TableDefinition) ||
                    !_ledger.TryGetCompleteSnapshot<ColumnDefinition>(
                        occurrence.Path + ".Columns", out var tableColumns) ||
                    !_ledger.TryGetCompleteSnapshot<ConstraintDefinition>(
                        occurrence.Path + ".Constraints", out var constraints) ||
                    !_ledger.TryGetCompleteSnapshot<IndexDefinition>(
                        occurrence.Path + ".Indexes", out var indexes) ||
                    !_objectNameFacts.TryGetValue(
                        occurrence.Path + ".Name", out var tableName))
                {
                    return;
                }

                var pending = new List<SqlAstDiagnostic>();
                var columns = new Dictionary<string, ColumnReference>(
                    StringComparer.Ordinal);
                for (var index = 0; index < tableColumns.Count; index++)
                {
                    if (!_session.TryGetOccurrence(
                            Indexed(
                                occurrence.Path + ".Columns", index),
                            out var columnOccurrence) ||
                        columnOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !_columnFacts.TryGetValue(
                            columnOccurrence.Id, out var column))
                    {
                        return;
                    }
                    if (column.Name != null &&
                        !columns.ContainsKey(column.Name))
                    {
                        columns.Add(
                            column.Name,
                            new ColumnReference(column, index));
                    }
                }

                var nullablePrimaryKeyDiagnostics =
                    new List<SqlAstDiagnostic>();
                for (var constraintIndex = 0;
                     constraintIndex < constraints.Count;
                     constraintIndex++)
                {
                    var constraintPath = Indexed(
                        occurrence.Path + ".Constraints",
                        constraintIndex);
                    if (!_session.TryGetOccurrence(
                        constraintPath, out var constraintOccurrence) ||
                        constraintOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !(constraintOccurrence.Node is
                          PrimaryKeyDefinition))
                    {
                        continue;
                    }
                    var columnsPath = constraintPath + ".Columns";
                    if (!_identifierListFacts.TryGetValue(
                            columnsPath, out var primaryColumns))
                    {
                        return;
                    }
                    for (var itemIndex = 0;
                         itemIndex < primaryColumns.Count;
                         itemIndex++)
                    {
                        var identifier = primaryColumns[itemIndex];
                        if (identifier == null)
                        {
                            continue;
                        }
                        if (!columns.TryGetValue(
                            identifier, out var reference))
                        {
                            PendingAdd(
                                pending,
                                "AST_SCHEMA_COLUMN_REFERENCE_MISSING",
                                Indexed(columnsPath, itemIndex));
                        }
                        else if (reference.Column.Nullability ==
                                 ColumnNullability.Nullable)
                        {
                            PendingAdd(
                                nullablePrimaryKeyDiagnostics,
                                "AST_SCHEMA_PRIMARY_KEY_NULLABLE",
                                Indexed(
                                    occurrence.Path + ".Columns",
                                    reference.Index) + ".Nullability");
                        }
                    }
                }
                pending.AddRange(nullablePrimaryKeyDiagnostics);

                for (var constraintIndex = 0;
                     constraintIndex < constraints.Count;
                     constraintIndex++)
                {
                    var constraintPath = Indexed(
                        occurrence.Path + ".Constraints",
                        constraintIndex);
                    if (!_session.TryGetOccurrence(
                        constraintPath, out var constraintOccurrence) ||
                        constraintOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !(constraintOccurrence.Node is
                          UniqueConstraintDefinition))
                    {
                        continue;
                    }
                    var columnsPath = constraintPath + ".Columns";
                    if (!TryAppendReferences(
                        columnsPath, columns, pending))
                    {
                        return;
                    }
                }

                for (var constraintIndex = 0;
                     constraintIndex < constraints.Count;
                     constraintIndex++)
                {
                    var foreignPath = Indexed(
                        occurrence.Path + ".Constraints",
                        constraintIndex);
                    if (!_session.TryGetOccurrence(
                        foreignPath, out var constraintOccurrence) ||
                        constraintOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !(constraintOccurrence.Node is
                          ForeignKeyDefinition))
                    {
                        continue;
                    }
                    if (!TryAppendReferences(
                        foreignPath + ".Columns.LocalColumns",
                        columns,
                        pending))
                    {
                        return;
                    }
                    if (!_objectNameFacts.TryGetValue(
                            foreignPath + ".ReferencedTable",
                            out var referencedTable))
                    {
                        return;
                    }
                    if (referencedTable.Equals(tableName) &&
                        !TryAppendReferences(
                            foreignPath + ".Columns.ReferencedColumns",
                            columns,
                            pending))
                    {
                        return;
                    }
                }

                for (var indexIndex = 0;
                     indexIndex < indexes.Count;
                     indexIndex++)
                {
                    var indexPath = Indexed(
                        occurrence.Path + ".Indexes", indexIndex);
                    if (!_session.TryGetOccurrence(
                            indexPath, out var indexOccurrence) ||
                        indexOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !(indexOccurrence.Node is IndexDefinition))
                    {
                        continue;
                    }
                    var indexColumnsPath = indexPath + ".Columns";
                    if (!_ledger.TryGetCompleteSnapshot<IndexColumnDefinition>(
                            indexColumnsPath, out var indexColumns))
                    {
                        return;
                    }
                    for (var itemIndex = 0;
                         itemIndex < indexColumns.Count;
                         itemIndex++)
                    {
                        if (!_session.TryGetOccurrence(
                                Indexed(indexColumnsPath, itemIndex),
                                out var itemOccurrence) ||
                            itemOccurrence.FinalState !=
                                SqlAstRetainedState.Valid ||
                            !_indexColumnFacts.TryGetValue(
                                itemOccurrence.Id, out var item))
                        {
                            return;
                        }
                        if (item.Column != null &&
                            !columns.ContainsKey(item.Column))
                        {
                            PendingAdd(
                                pending,
                                "AST_SCHEMA_COLUMN_REFERENCE_MISSING",
                                Indexed(indexColumnsPath, itemIndex) +
                                ".Column");
                        }
                    }
                }

                for (var constraintIndex = 0;
                     constraintIndex < constraints.Count;
                     constraintIndex++)
                {
                    var foreignPath = Indexed(
                        occurrence.Path + ".Constraints",
                        constraintIndex);
                    if (!_session.TryGetOccurrence(
                        foreignPath, out var constraintOccurrence) ||
                        constraintOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !(constraintOccurrence.Node is
                          ForeignKeyDefinition) ||
                        !_session.TryGetOccurrence(
                            foreignPath + ".Actions",
                            out var actionsOccurrence) ||
                        actionsOccurrence.FinalState !=
                            SqlAstRetainedState.Valid ||
                        !_referentialActionsFacts.TryGetValue(
                            actionsOccurrence.Id, out var actions))
                    {
                        continue;
                    }
                    if (!TryAppendReferentialAction(
                            actions.OnUpdate,
                            foreignPath + ".Actions.OnUpdate",
                            foreignPath + ".Columns.LocalColumns",
                            columns,
                            pending) ||
                        !TryAppendReferentialAction(
                            actions.OnDelete,
                            foreignPath + ".Actions.OnDelete",
                            foreignPath + ".Columns.LocalColumns",
                            columns,
                            pending))
                    {
                        return;
                    }
                }

                entry.ResolvedDiagnostics.AddRange(pending);
            }

            private bool TryAppendReferences(
                string path,
                IDictionary<string, ColumnReference> columns,
                ICollection<SqlAstDiagnostic> pending)
            {
                if (!_identifierListFacts.TryGetValue(
                        path, out var identifiers))
                {
                    return false;
                }
                for (var index = 0;
                     index < identifiers.Count;
                     index++)
                {
                    var identifier = identifiers[index];
                    if (identifier != null &&
                        !columns.ContainsKey(identifier))
                    {
                        PendingAdd(
                            pending,
                            "AST_SCHEMA_COLUMN_REFERENCE_MISSING",
                            Indexed(path, index));
                    }
                }
                return true;
            }

            private bool TryAppendReferentialAction(
                ReferentialAction action,
                string path,
                string localColumnsPath,
                IDictionary<string, ColumnReference> columns,
                ICollection<SqlAstDiagnostic> pending)
            {
                if (!Enum.IsDefined(typeof(ReferentialAction), action) ||
                    (action != ReferentialAction.SetNull &&
                     action != ReferentialAction.SetDefault))
                {
                    return true;
                }
                if (!_identifierListFacts.TryGetValue(
                        localColumnsPath, out var localColumns))
                {
                    return false;
                }
                for (var index = 0;
                     index < localColumns.Count;
                     index++)
                {
                    var identifier = localColumns[index];
                    if (identifier == null ||
                        !columns.TryGetValue(
                            identifier, out var reference))
                    {
                        continue;
                    }
                    if (action == ReferentialAction.SetNull &&
                        reference.Column.Nullability !=
                        ColumnNullability.Nullable ||
                        action == ReferentialAction.SetDefault &&
                        !reference.Column.HasDefault)
                    {
                        PendingAdd(
                            pending,
                            "AST_SCHEMA_REFERENTIAL_ACTION_INVALID",
                            path);
                        break;
                    }
                }
                return true;
            }

            private static void PendingAdd(
                ICollection<SqlAstDiagnostic> diagnostics,
                string code,
                string path)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    code, MessageFor(code), path));
            }

            private static bool AllNonNull<T>(
                SqlAstCollectionSnapshot<T> snapshot)
                where T : class
            {
                for (var index = 0; index < snapshot.Count; index++)
                {
                    if (snapshot[index] == null)
                    {
                        return false;
                    }
                }
                return true;
            }

            private bool AllChildOccurrencesValid(
                string path,
                int count)
            {
                for (var index = 0; index < count; index++)
                {
                    if (!_session.TryGetOccurrence(
                            Indexed(path, index), out var child) ||
                        child.FinalState != SqlAstRetainedState.Valid)
                    {
                        return false;
                    }
                }
                return true;
            }

            private static void ResolveAdd(
                SqlAstLocalEntry entry,
                string code,
                string path)
            {
                entry.ResolvedDiagnostics.Add(new SqlAstDiagnostic(
                    code, MessageFor(code), path));
            }

            internal void ValidateNode(SqlNode node, string path)
            {
                switch (node)
                {
                    case ColumnExpression column:
                        RequireIdentifier(column.Name, path + ".Name");
                        ValidateAlias(column.Source, path + ".Source", required: false);
                        break;
                    case ParameterExpression parameter:
                        ValidateParameterExpression(parameter, path);
                        break;
                    case BinaryExpression binary:
                        Require(binary.Left, path + ".Left");
                        Require(binary.Right, path + ".Right");
                        Defined(binary.Operator, path + ".Operator");
                        break;
                    case UnaryExpression unary:
                        Defined(unary.Operator, path + ".Operator");
                        Require(unary.Operand, path + ".Operand");
                        break;
                    case InExpression @in:
                        Require(@in.Operand, path + ".Operand");
                        ValidateNodeCollection(@in.Values, path + ".Values", nonempty: false);
                        break;
                    case BetweenExpression between:
                        Require(between.Operand, path + ".Operand");
                        Require(between.Lower, path + ".Lower");
                        Require(between.Upper, path + ".Upper");
                        break;
                    case CaseExpression @case:
                        ValidateCase(@case, path);
                        break;
                    case CastExpression cast:
                        Require(cast.Expression, path + ".Expression");
                        ValidateType(cast.Type, path + ".Type", parameterOwned: false);
                        break;
                    case SubqueryExpression subquery:
                        if (Require(subquery.Query, path + ".Query") &&
                            !(subquery.Query is SelectStatement))
                        {
                            Add("AST_SUBQUERY_SELECT_REQUIRED", path + ".Query");
                        }
                        break;
                    case ExistsExpression exists:
                        Require(exists.Subquery, path + ".Subquery");
                        break;
                    case AggregateExpression aggregate:
                        ValidateAggregate(aggregate, path);
                        break;
                    case FunctionExpression function:
                        ValidateFunction(function, path);
                        break;
                    case WildcardExpression wildcard:
                        ValidateAlias(wildcard.Source, path + ".Source", required: false);
                        break;
                    case NamedTableSource named:
                        ValidateObjectName(named.Name, path + ".Name", required: true);
                        ValidateAlias(named.Alias, path + ".Alias", required: false);
                        break;
                    case DerivedTableSource derived:
                        Require(derived.Query, path + ".Query");
                        ValidateAlias(derived.Alias, path + ".Alias", required: true);
                        break;
                    case JoinSource join:
                        ValidateJoin(join, path);
                        break;
                    case SelectProjection projection:
                        Require(projection.Expression, path + ".Expression");
                        ValidateAlias(projection.Alias, path + ".Alias", required: false);
                        break;
                    case OrderByExpression order:
                        Require(order.Expression, path + ".Expression");
                        Defined(order.Direction, path + ".Direction");
                        Defined(order.NullSortOrder, path + ".NullSortOrder");
                        break;
                    case OffsetPageSpec offset:
                        if (offset.Offset < 0) Add("AST_SCALAR_INVALID", path + ".Offset");
                        if (offset.Limit <= 0) Add("AST_SCALAR_INVALID", path + ".Limit");
                        break;
                    case KeysetPageSpec keyset:
                        ValidateNodeCollection(keyset.Boundaries, path + ".Boundaries", nonempty: false);
                        if (keyset.Limit <= 0) Add("AST_SCALAR_INVALID", path + ".Limit");
                        break;
                    case LockSpec lockSpec:
                        Defined(lockSpec.Mode, path + ".Mode");
                        Defined(lockSpec.Wait, path + ".Wait");
                        break;
                    case CommonTableExpression commonTableExpression:
                        ValidateCommonTableExpression(commonTableExpression, path);
                        break;
                    case SetOperationClause setOperation:
                        Defined(setOperation.Operator, path + ".Operator");
                        Require(setOperation.RightQuery, path + ".RightQuery");
                        break;
                    case SelectStatement select:
                        ValidateSelect(select, path);
                        break;
                    case SqlAssignment assignment:
                        _assignmentFacts[_currentOccurrence.Id] =
                            new AssignmentFact(
                                assignment.Column == null
                                    ? null
                                    : assignment.Column.Value,
                                IsValidIdentifier(assignment.Column));
                        RequireIdentifier(assignment.Column, path + ".Column");
                        Require(assignment.Value, path + ".Value");
                        break;
                    case SqlInsertRow row:
                        ValidateNodeCollection(row.Values, path + ".Values", nonempty: true);
                        break;
                    case ReturningClause returning:
                        ValidateNodeCollection(returning.Projections, path + ".Projections", nonempty: true);
                        break;
                    case InsertStatement insert:
                        ValidateInsert(insert, path);
                        break;
                    case UpdateStatement update:
                        ValidateUpdate(update, path);
                        break;
                    case DeleteStatement delete:
                        ValidateDelete(delete, path);
                        break;
                    case UpsertStatement upsert:
                        ValidateUpsert(upsert, path);
                        break;
                    case BulkInsertOperation bulk:
                        ValidateBulk(bulk, path);
                        break;
                    case StringDefaultDefinition stringDefault:
                        if (stringDefault.Value == null)
                            Add("AST_SCALAR_INVALID", path + ".Value");
                        break;
                    case SemanticDefaultDefinition semanticDefault:
                        Defined(semanticDefault.Kind, path + ".Kind");
                        break;
                    case IdentityGenerationDefinition identity:
                        if (identity.Increment == 0)
                            Add("AST_SCALAR_INVALID", path + ".Increment");
                        break;
                    case SequenceGenerationDefinition sequenceGeneration:
                        ValidateObjectName(
                            sequenceGeneration.Sequence,
                            path + ".Sequence", required: true);
                        break;
                    case ComputedGenerationDefinition computed:
                        Require(computed.Expression, path + ".Expression");
                        Defined(computed.Storage, path + ".Storage");
                        break;
                    case ColumnDefinition columnDefinition:
                        ValidateColumnDefinition(columnDefinition, path);
                        break;
                    case SchemaName schemaName:
                        if (schemaName.Catalog != null)
                            RequireIdentifier(schemaName.Catalog, path + ".Catalog");
                        RequireIdentifier(schemaName.Name, path + ".Name");
                        break;
                    case SchemaScope schemaScope:
                        ValidateSchemaScope(schemaScope, path);
                        break;
                    case IndexColumnDefinition indexColumn:
                        _indexColumnFacts[_currentOccurrence.Id] =
                            new IndexColumnFact(
                                indexColumn.Column == null
                                    ? null
                                    : indexColumn.Column.Value);
                        RequireIdentifier(indexColumn.Column, path + ".Column");
                        Defined(indexColumn.Direction, path + ".Direction");
                        break;
                    case IndexDefinition indexDefinition:
                        ValidateIndexDefinition(indexDefinition, path);
                        break;
                    case PrimaryKeyDefinition primaryKey:
                        ValidateConstraintColumns(primaryKey.Name, primaryKey.Columns, path);
                        break;
                    case UniqueConstraintDefinition uniqueConstraint:
                        ValidateConstraintColumns(uniqueConstraint.Name, uniqueConstraint.Columns, path);
                        break;
                    case ForeignKeyColumnSet foreignKeyColumns:
                        ValidateForeignKeyColumnSet(foreignKeyColumns, path);
                        break;
                    case ReferentialActions actions:
                        _referentialActionsFacts[_currentOccurrence.Id] =
                            new ReferentialActionsFact(
                                actions.OnUpdate, actions.OnDelete);
                        Defined(actions.OnUpdate, path + ".OnUpdate");
                        Defined(actions.OnDelete, path + ".OnDelete");
                        break;
                    case ForeignKeyDefinition foreignKey:
                        RequireIdentifier(foreignKey.Name, path + ".Name");
                        ValidateObjectName(
                            foreignKey.ReferencedTable,
                            path + ".ReferencedTable", required: true);
                        Require(foreignKey.Columns, path + ".Columns");
                        Require(foreignKey.Actions, path + ".Actions");
                        break;
                    case TableDefinition tableDefinition:
                        ValidateTableDefinition(tableDefinition, path);
                        break;
                    case SequenceBounds sequenceBounds:
                        if (sequenceBounds.MinimumValue.HasValue &&
                            sequenceBounds.MaximumValue.HasValue &&
                            sequenceBounds.MinimumValue.Value >
                            sequenceBounds.MaximumValue.Value)
                        {
                            Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".MaximumValue");
                        }
                        break;
                    case SequenceOptions sequenceOptions:
                        ValidateSequenceOptions(sequenceOptions, path);
                        break;
                    case SequenceDefinition sequenceDefinition:
                        ValidateSequenceDefinition(sequenceDefinition, path);
                        break;
                    case CreateSchemaOperation createSchema:
                        Require(createSchema.Schema, path + ".Schema");
                        Defined(createSchema.Behavior, path + ".Behavior");
                        break;
                    case DropSchemaOperation dropSchema:
                        Require(dropSchema.Schema, path + ".Schema");
                        Defined(dropSchema.Behavior, path + ".Behavior");
                        Defined(dropSchema.Scope, path + ".Scope");
                        break;
                    case CreateTableOperation createTable:
                        Require(createTable.Table, path + ".Table");
                        Defined(createTable.Behavior, path + ".Behavior");
                        break;
                    case RenameTableOperation renameTable:
                        ValidateRenameTable(renameTable, path);
                        break;
                    case DropTableOperation dropTable:
                        ValidateObjectName(dropTable.Table, path + ".Table", required: true);
                        Defined(dropTable.Behavior, path + ".Behavior");
                        Defined(dropTable.Scope, path + ".Scope");
                        break;
                    case AddColumnOperation addColumn:
                        ValidateObjectName(addColumn.Table, path + ".Table", required: true);
                        Require(addColumn.Column, path + ".Column");
                        break;
                    case AlterColumnOperation alterColumn:
                        ValidateAlterColumn(alterColumn, path);
                        break;
                    case RenameColumnOperation renameColumn:
                        ValidateRenameColumn(renameColumn, path);
                        break;
                    case DropColumnOperation dropColumn:
                        ValidateObjectName(dropColumn.Table, path + ".Table", required: true);
                        RequireIdentifier(dropColumn.Column, path + ".Column");
                        Defined(dropColumn.Behavior, path + ".Behavior");
                        break;
                    case AddConstraintOperation addConstraint:
                        ValidateObjectName(addConstraint.Table, path + ".Table", required: true);
                        Require(addConstraint.Constraint, path + ".Constraint");
                        break;
                    case DropConstraintOperation dropConstraint:
                        ValidateObjectName(dropConstraint.Table, path + ".Table", required: true);
                        RequireIdentifier(dropConstraint.Constraint, path + ".Constraint");
                        Defined(dropConstraint.Behavior, path + ".Behavior");
                        break;
                    case CreateIndexOperation createIndex:
                        ValidateObjectName(createIndex.Table, path + ".Table", required: true);
                        Require(createIndex.Index, path + ".Index");
                        Defined(createIndex.Behavior, path + ".Behavior");
                        break;
                    case DropIndexOperation dropIndex:
                        ValidateObjectName(dropIndex.Table, path + ".Table", required: true);
                        RequireIdentifier(dropIndex.Index, path + ".Index");
                        Defined(dropIndex.Behavior, path + ".Behavior");
                        break;
                    case CreateSequenceOperation createSequence:
                        Require(createSequence.Sequence, path + ".Sequence");
                        Defined(createSequence.Behavior, path + ".Behavior");
                        break;
                    case AlterSequenceOperation alterSequence:
                        ValidateAlterSequence(alterSequence, path);
                        break;
                    case DropSequenceOperation dropSequence:
                        ValidateObjectName(dropSequence.Sequence, path + ".Sequence", required: true);
                        Defined(dropSequence.Behavior, path + ".Behavior");
                        break;
                    case SetTableCommentOperation setTableComment:
                        ValidateObjectName(setTableComment.Table, path + ".Table", required: true);
                        ValidateComment(setTableComment.Comment, path + ".Comment", required: true);
                        break;
                    case RemoveTableCommentOperation removeTableComment:
                        ValidateObjectName(removeTableComment.Table, path + ".Table", required: true);
                        break;
                    case SetColumnCommentOperation setColumnComment:
                        ValidateObjectName(setColumnComment.Table, path + ".Table", required: true);
                        RequireIdentifier(setColumnComment.Column, path + ".Column");
                        ValidateComment(setColumnComment.Comment, path + ".Comment", required: true);
                        break;
                    case RemoveColumnCommentOperation removeColumnComment:
                        ValidateObjectName(removeColumnComment.Table, path + ".Table", required: true);
                        RequireIdentifier(removeColumnComment.Column, path + ".Column");
                        break;
                    case MigrationStep migrationStep:
                        ValidateMigrationStep(migrationStep, path);
                        break;
                    case MigrationPlan migrationPlan:
                        ValidateMigrationPlan(migrationPlan, path);
                        break;
                    case ListTablesOperation listTables:
                        Require(listTables.Scope, path + ".Scope");
                        break;
                    case GetTableMetadataOperation getTable:
                        ValidateObjectName(getTable.Table, path + ".Table", required: true);
                        break;
                    case ListColumnsOperation listColumns:
                        ValidateObjectName(listColumns.Table, path + ".Table", required: true);
                        break;
                    case GetColumnMetadataOperation getColumn:
                        ValidateObjectName(getColumn.Table, path + ".Table", required: true);
                        RequireIdentifier(getColumn.Column, path + ".Column");
                        break;
                    case ListIndexesOperation listIndexes:
                        ValidateObjectName(listIndexes.Table, path + ".Table", required: true);
                        break;
                    case GetIndexMetadataOperation getIndex:
                        ValidateObjectName(getIndex.Table, path + ".Table", required: true);
                        RequireIdentifier(getIndex.Index, path + ".Index");
                        break;
                    case DatabaseDiagnosticOperation diagnostic:
                        Defined(diagnostic.Kind, path + ".Kind");
                        break;
                    case CreateDatabaseOperation createDatabase:
                        RequireIdentifier(createDatabase.Database, path + ".Database");
                        Defined(createDatabase.Behavior, path + ".Behavior");
                        break;
                    case DropDatabaseOperation dropDatabase:
                        RequireIdentifier(dropDatabase.Database, path + ".Database");
                        Defined(dropDatabase.Behavior, path + ".Behavior");
                        ValidateFingerprint(dropDatabase.Fingerprint, path + ".Fingerprint");
                        break;
                    case DatabaseExportOperation export:
                        ValidateDatabaseExport(export, path);
                        break;
                    case DatabaseImportOperation import:
                        ValidateDatabaseImport(import, path);
                        break;
                }
            }

            internal void AddTraversalIssue(SqlAstTraversalIssue issue)
            {
                CodeForIssue(issue.Kind);
            }

            private void StopOnTraversalIssue(SqlAstTraversalIssue issue)
            {
                AddTraversalIssue(issue);
                if (issue.Kind ==
                    SqlAstTraversalIssueKind.CollectionSlotLimitExceeded)
                {
                    throw new TerminalCollectionSignalException();
                }
            }

            private static SqlAstDiagnostic DiagnosticFor(
                SqlAstTraversalIssue issue)
            {
                var code = CodeForIssue(issue.Kind);
                return new SqlAstDiagnostic(
                    code, MessageFor(code), issue.Path);
            }

            private static string CodeForIssue(
                SqlAstTraversalIssueKind kind)
            {
                switch (kind)
                {
                    case SqlAstTraversalIssueKind.UnknownNode:
                        return "AST_UNKNOWN_NODE";
                    case SqlAstTraversalIssueKind.DepthExceeded:
                        return "AST_TRAVERSAL_DEPTH_EXCEEDED";
                    case SqlAstTraversalIssueKind.NodeLimitExceeded:
                        return "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED";
                    case SqlAstTraversalIssueKind.CollectionSlotLimitExceeded:
                        return "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED";
                    default:
                        throw new InvalidOperationException(
                            "SQL AST traversal reported an undefined issue kind.");
                }
            }

            private void ValidateParameterExpression(
                ParameterExpression expression,
                string path)
            {
                var definitionPath = path + ".Definition";
                if (!Require(expression.Definition, definitionPath))
                {
                    _session.Parameters.Record(
                        _currentOccurrence.Id, null, valid: false);
                    return;
                }

                var definition = expression.Definition;
                var nameValid = ValidateParameterName(
                    definition.Name, definitionPath + ".Name");
                var typeValid = ValidateType(
                    definition.Type, definitionPath + ".Type", parameterOwned: true);
                var directionValid = Enum.IsDefined(
                    typeof(ParameterDirection), definition.Direction);
                if (!directionValid)
                {
                    Add("AST_PARAMETER_DIRECTION_INVALID", definitionPath + ".Direction");
                }

                if (!nameValid || !typeValid || !directionValid)
                {
                    _session.Parameters.Record(
                        _currentOccurrence.Id, definition, valid: false);
                    return;
                }
                var fact = _session.Parameters.Record(
                    _currentOccurrence.Id, definition, valid: true);
                if (fact.Kind ==
                    SqlAstParameterFactKind.ConflictingRedefinition)
                {
                    Add("AST_PARAMETER_DEFINITION_CONFLICT", definitionPath);
                }
            }

            private void ValidateCase(CaseExpression expression, string path)
            {
                var clausesPath = path + ".WhenClauses";
                if (expression.WhenClauses == null)
                {
                    Add("AST_REQUIRED_CHILD_MISSING", clausesPath);
                }
                else
                {
                    var count = _ledger.GetCount(
                        expression.WhenClauses, clausesPath);
                    if (count == 0)
                    {
                        Add("AST_COLLECTION_EMPTY", clausesPath);
                    }
                    for (var index = 0; index < count; index++)
                    {
                        if (!_ledger.TryObserve(
                            expression.WhenClauses, clausesPath, index,
                            StopOnTraversalIssue, out CaseWhenClause clause))
                        {
                            return;
                        }
                        var itemPath = Indexed(clausesPath, index);
                        if (clause == null)
                        {
                            Add("AST_REQUIRED_CHILD_MISSING", itemPath);
                            continue;
                        }
                        Require(clause.When, itemPath + ".When");
                        Require(clause.Then, itemPath + ".Then");
                    }
                }
            }

            private void ValidateAggregate(AggregateExpression aggregate, string path)
            {
                var registered = aggregate.Function != null &&
                    !string.IsNullOrWhiteSpace(aggregate.Function.Key) &&
                    SemanticFunctions.IsRegistered(aggregate.Function) &&
                    aggregate.Function.IsAggregate;
                if (!registered)
                {
                    Add("AST_AGGREGATE_FUNCTION_REQUIRED", path + ".Function");
                }
                else
                {
                    var count = aggregate.Argument == null ? 0 : 1;
                    if (!ArityValid(aggregate.Function, count))
                    {
                        Add("AST_AGGREGATE_ARITY", path + ".Argument");
                    }
                }
                if (aggregate.Distinct && aggregate.Argument == null)
                {
                    Add("AST_AGGREGATE_DISTINCT_ARGUMENT_REQUIRED", path + ".Distinct");
                }
            }

            private void ValidateFunction(FunctionExpression function, string path)
            {
                var registered = function.Function != null &&
                    !string.IsNullOrWhiteSpace(function.Function.Key) &&
                    SemanticFunctions.IsRegistered(function.Function) &&
                    !function.Function.IsAggregate;
                if (!registered)
                {
                    Add("AST_FUNCTION_NOT_REGISTERED", path + ".Function");
                }
                var argumentsPresent = ValidateNodeCollection(
                    function.Arguments, path + ".Arguments", nonempty: false);
                if (registered && argumentsPresent &&
                    !ArityValid(
                        function.Function,
                        _ledger.GetCount(
                            function.Arguments, path + ".Arguments")))
                {
                    Add("AST_FUNCTION_ARITY", path + ".Arguments");
                }
            }

            private void ValidateJoin(JoinSource join, string path)
            {
                Require(join.Left, path + ".Left");
                var defined = Defined(join.JoinType, path + ".JoinType");
                Require(join.Right, path + ".Right");
                if (!defined)
                {
                    return;
                }
                if (join.JoinType == SqlJoinType.Cross && join.Condition != null)
                {
                    Add("AST_JOIN_CONDITION_FORBIDDEN", path + ".Condition");
                }
                else if (join.JoinType != SqlJoinType.Cross && join.Condition == null)
                {
                    Add("AST_JOIN_CONDITION_REQUIRED", path + ".Condition");
                }
            }

            private void ValidateCommonTableExpression(
                CommonTableExpression commonTableExpression,
                string path)
            {
                RequireIdentifier(commonTableExpression.Name, path + ".Name");
                var queryPresent = Require(
                    commonTableExpression.Query, path + ".Query");
                var columnsPresent = ValidateIdentifierCollection(
                    commonTableExpression.Columns, path + ".Columns",
                    nonempty: false, duplicateCode: "AST_COLLECTION_DUPLICATE");
                var columnCount = commonTableExpression.Columns == null
                    ? 0
                    : _ledger.GetCount(
                        commonTableExpression.Columns, path + ".Columns");
                if (_validateStaticArity && queryPresent && columnsPresent &&
                    columnCount != 0)
                {
                    AppendDeferred(
                        SqlAstDeferredRuleKind.CteResultArity, path);
                }
            }

            private void ValidateSelect(SelectStatement select, string path)
            {
                var projectionsPath = path + ".Projections";
                var groupByPath = path + ".GroupBy";
                var orderByPath = path + ".OrderBy";
                var setOperationsPath = path + ".SetOperations";
                ValidateNodeCollection(select.Projections, projectionsPath, nonempty: true);
                ValidateNodeCollection(select.GroupBy, groupByPath, nonempty: false);
                ValidateNodeCollection(select.OrderBy, orderByPath, nonempty: false);
                ValidateNamedCteCollection(
                    select.CommonTableExpressions, path + ".CommonTableExpressions");
                var setsPresent = ValidateNodeCollection(
                    select.SetOperations, setOperationsPath, nonempty: false);

                var orderByCount = select.OrderBy == null
                    ? 0
                    : _ledger.GetCount(select.OrderBy, orderByPath);

                if (select.Page is OffsetPageSpec &&
                    select.OrderBy != null && orderByCount == 0)
                {
                    Add("AST_PAGE_ORDER_REQUIRED", path + ".Page");
                }
                else if (select.Page is KeysetPageSpec)
                {
                    AppendDeferred(
                        SqlAstDeferredRuleKind.SelectKeysetPolicies, path);
                }

                if (_validateStaticArity && setsPresent)
                {
                    AppendDeferred(
                        SqlAstDeferredRuleKind.SelectSetOperationArities,
                        path);
                }
            }

            private void ValidateInsert(InsertStatement insert, string path)
            {
                ValidateObjectName(insert.Table, path + ".Table", required: true);
                var columnsPath = path + ".Columns";
                var rowsPath = path + ".Rows";
                var columnsPresent = ValidateIdentifierCollection(
                    insert.Columns, columnsPath, nonempty: true,
                    duplicateCode: "AST_DML_COLUMN_DUPLICATE");
                var rowsPresent = ValidateNodeCollection(
                    insert.Rows, rowsPath, nonempty: false);
                var columnCount = insert.Columns == null
                    ? 0
                    : _ledger.GetCount(insert.Columns, columnsPath);
                var rowCount = insert.Rows == null
                    ? 0
                    : _ledger.GetCount(insert.Rows, rowsPath);
                if (rowsPresent)
                {
                    var hasRows = rowCount != 0;
                    if (hasRows == (insert.Source != null))
                    {
                        Add("AST_INSERT_SOURCE_SHAPE_INVALID", path + ".Source");
                    }
                    if (columnsPresent)
                    {
                        AppendDeferred(
                            SqlAstDeferredRuleKind.InsertRowArities,
                            path);
                    }
                }
                if (_validateStaticArity && columnsPresent && insert.Source != null)
                {
                    AppendDeferred(
                        SqlAstDeferredRuleKind.InsertSourceArity, path);
                }
            }

            private void ValidateUpdate(UpdateStatement update, string path)
            {
                ValidateObjectName(update.Table, path + ".Table", required: true);
                ValidateAssignmentCollection(
                    update.Assignments, path + ".Assignments", nonempty: true);
                if (!update.AllowAllRows &&
                    (update.Where == null ||
                     SafeWriteClassifier.Classify(update.Where) ==
                     SafeWriteTruth.True))
                {
                    Add("AST_WRITE_ALL_ROWS_NOT_ALLOWED", path + ".Where");
                }
            }

            private void ValidateDelete(DeleteStatement delete, string path)
            {
                ValidateObjectName(delete.Table, path + ".Table", required: true);
                if (!delete.AllowAllRows &&
                    (delete.Where == null ||
                     SafeWriteClassifier.Classify(delete.Where) ==
                     SafeWriteTruth.True))
                {
                    Add("AST_WRITE_ALL_ROWS_NOT_ALLOWED", path + ".Where");
                }
            }

            private void ValidateUpsert(UpsertStatement upsert, string path)
            {
                ValidateObjectName(upsert.Table, path + ".Table", required: true);
                var conflictKeysPath = path + ".ConflictKeys";
                var insertsPath = path + ".InsertAssignments";
                var updatesPath = path + ".UpdateAssignments";
                var keysPresent = ValidateIdentifierCollection(
                    upsert.ConflictKeys, conflictKeysPath, nonempty: true,
                    duplicateCode: "AST_DML_COLUMN_DUPLICATE");
                var insertsPresent = ValidateAssignmentCollection(
                    upsert.InsertAssignments, insertsPath, nonempty: true);
                var updatesPresent = ValidateAssignmentCollection(
                    upsert.UpdateAssignments, updatesPath, nonempty: false);
                var policyDefined = Enum.IsDefined(typeof(ConflictPolicy), upsert.Policy);
                if (!policyDefined)
                {
                    Add("AST_UNDEFINED_ENUM", path + ".Policy");
                }

                var checkInsertAssignments = keysPresent && insertsPresent;
                var checkUpdateAssignments = keysPresent && updatesPresent;
                if (checkInsertAssignments || checkUpdateAssignments)
                {
                    _upsertShapeFacts[_currentOccurrence.Id] =
                        new UpsertShapeFact(
                            checkInsertAssignments,
                            checkUpdateAssignments);
                    AppendDeferred(
                        SqlAstDeferredRuleKind.UpsertAssignmentShape,
                        path);
                }

                if (policyDefined && updatesPresent)
                {
                    var updateCount = _ledger.GetCount(
                        upsert.UpdateAssignments, updatesPath);
                    if (upsert.Policy == ConflictPolicy.UpdateExisting &&
                        updateCount == 0)
                    {
                        Add("AST_UPSERT_SHAPE_INVALID", path + ".UpdateAssignments");
                    }
                    else if (upsert.Policy == ConflictPolicy.DoNothing &&
                             updateCount != 0)
                    {
                        Add("AST_UPSERT_SHAPE_INVALID", path + ".Policy");
                    }
                }
            }

            private void ValidateBulk(BulkInsertOperation bulk, string path)
            {
                ValidateObjectName(bulk.Table, path + ".Table", required: true);
                var columnsPath = path + ".Columns";
                var rowsPath = path + ".Rows";
                var columnsPresent = ValidateIdentifierCollection(
                    bulk.Columns, columnsPath, nonempty: true,
                    duplicateCode: "AST_DML_COLUMN_DUPLICATE");
                var rowsPresent = ValidateNodeCollection(
                    bulk.Rows, rowsPath, nonempty: true);
                if (columnsPresent && rowsPresent)
                {
                    AppendDeferred(
                        SqlAstDeferredRuleKind.BulkInsertRowArities,
                        path);
                }
                if (bulk.BatchSize <= 0)
                {
                    Add("AST_BULK_BATCH_SIZE_INVALID", path + ".BatchSize");
                }
            }

            private bool ValidateAssignmentCollection(
                IReadOnlyList<SqlAssignment> assignments,
                string path,
                bool nonempty)
            {
                if (!ValidateNodeCollection(assignments, path, nonempty))
                {
                    return false;
                }
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var validForDependentRules = true;
                var count = _ledger.GetCount(assignments, path);
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        assignments, path, index, StopOnTraversalIssue,
                        out SqlAssignment assignment))
                    {
                        return false;
                    }
                    if (assignment == null ||
                        !IsValidIdentifier(assignment.Column))
                    {
                        continue;
                    }
                    if (!seen.Add(assignment.Column.Value))
                    {
                        Add("AST_DML_ASSIGNMENT_DUPLICATE",
                            Indexed(path, index) + ".Column");
                        validForDependentRules = false;
                    }
                }
                return validForDependentRules;
            }

            private void ValidateColumnDefinition(
                ColumnDefinition column,
                string path)
            {
                _columnFacts[_currentOccurrence.Id] = new ColumnFact(
                    column.Name == null ? null : column.Name.Value,
                    column.Nullability,
                    column.DefaultValue != null);
                RequireIdentifier(column.Name, path + ".Name");
                ValidateType(column.Type, path + ".Type", parameterOwned: false);
                Defined(column.Nullability, path + ".Nullability");
                ValidateComment(column.Comment, path + ".Comment", required: false);

                if (column.Generation != null && column.DefaultValue != null)
                {
                    Add("AST_STRUCTURAL_SHAPE_INVALID", path + ".DefaultValue");
                }
                ValidateGeneration(column, path);
                ValidateDefault(column, path);
            }

            private void ValidateGeneration(ColumnDefinition column, string path)
            {
                if (column.Generation == null || column.Type == null ||
                    !Enum.IsDefined(typeof(LogicalDbType), column.Type.LogicalType))
                {
                    return;
                }
                if (column.Generation is IdentityGenerationDefinition identity)
                {
                    if (!IsInteger(column.Type.LogicalType))
                    {
                        Add("AST_SCHEMA_GENERATION_TYPE_MISMATCH", path + ".Generation");
                        return;
                    }
                    if (!FitsInteger(identity.Seed, column.Type.LogicalType))
                        Add("AST_SCHEMA_GENERATION_TYPE_MISMATCH", path + ".Generation.Seed");
                    if (!FitsInteger(identity.Increment, column.Type.LogicalType))
                        Add("AST_SCHEMA_GENERATION_TYPE_MISMATCH", path + ".Generation.Increment");
                }
                else if (column.Generation is SequenceGenerationDefinition &&
                         !IsInteger(column.Type.LogicalType))
                {
                    Add("AST_SCHEMA_GENERATION_TYPE_MISMATCH", path + ".Generation");
                }
            }

            private void ValidateDefault(ColumnDefinition column, string path)
            {
                var value = column.DefaultValue;
                if (value == null || column.Type == null ||
                    !Enum.IsDefined(typeof(LogicalDbType), column.Type.LogicalType) ||
                    !Enum.IsDefined(typeof(ColumnNullability), column.Nullability))
                {
                    return;
                }

                var logicalType = column.Type.LogicalType;
                var compatible = false;
                if (value is NullDefaultDefinition)
                    compatible = column.Nullability == ColumnNullability.Nullable;
                else if (value is BooleanDefaultDefinition)
                    compatible = logicalType == LogicalDbType.Boolean;
                else if (value is Int64DefaultDefinition integer)
                {
                    compatible = IsInteger(logicalType);
                    if (compatible && !FitsInteger(integer.Value, logicalType))
                    {
                        Add("AST_SCHEMA_DEFAULT_TYPE_MISMATCH",
                            path + ".DefaultValue.Value");
                        return;
                    }
                }
                else if (value is DecimalDefaultDefinition)
                    compatible = logicalType == LogicalDbType.Decimal;
                else if (value is StringDefaultDefinition)
                    compatible = logicalType == LogicalDbType.String ||
                                 logicalType == LogicalDbType.AnsiString ||
                                 logicalType == LogicalDbType.Json ||
                                 logicalType == LogicalDbType.Clob;
                else if (value is GuidDefaultDefinition)
                    compatible = logicalType == LogicalDbType.Guid;
                else if (value is DateTimeDefaultDefinition)
                    compatible = logicalType == LogicalDbType.Date ||
                                 logicalType == LogicalDbType.DateTime;
                else if (value is DateTimeOffsetDefaultDefinition)
                    compatible = logicalType == LogicalDbType.DateTimeOffset;
                else if (value is SemanticDefaultDefinition semantic)
                {
                    if (!Enum.IsDefined(
                        typeof(SemanticDefaultKind), semantic.Kind))
                    {
                        return;
                    }
                    if (semantic.Kind == SemanticDefaultKind.CurrentDate)
                        compatible = logicalType == LogicalDbType.Date;
                    else if (semantic.Kind == SemanticDefaultKind.CurrentDateTime)
                        compatible = logicalType == LogicalDbType.DateTime;
                    else if (semantic.Kind == SemanticDefaultKind.CurrentUtcDateTime)
                        compatible = logicalType == LogicalDbType.DateTime ||
                                     logicalType == LogicalDbType.DateTimeOffset;
                    else if (semantic.Kind == SemanticDefaultKind.NewGuid)
                        compatible = logicalType == LogicalDbType.Guid;
                }
                else return;

                if (!compatible)
                {
                    Add("AST_SCHEMA_DEFAULT_TYPE_MISMATCH", path + ".DefaultValue");
                }
            }

            private void ValidateSchemaScope(SchemaScope scope, string path)
            {
                var catalogValid = true;
                if (scope.Catalog != null)
                {
                    catalogValid = RequireIdentifier(
                        scope.Catalog, path + ".Catalog");
                }
                if (scope.Schema != null)
                    RequireIdentifier(scope.Schema, path + ".Schema");
                if (catalogValid && scope.Catalog != null && scope.Schema == null)
                    Add("AST_STRUCTURAL_SHAPE_INVALID", path + ".Schema");
            }

            private void ValidateIndexDefinition(IndexDefinition index, string path)
            {
                RequireIdentifier(index.Name, path + ".Name");
                var columnsPath = path + ".Columns";
                if (ValidateNodeCollection(index.Columns, columnsPath, nonempty: true))
                {
                    var seen = new HashSet<string>(StringComparer.Ordinal);
                    var count = _ledger.GetCount(index.Columns, columnsPath);
                    for (var itemIndex = 0; itemIndex < count; itemIndex++)
                    {
                        if (!_ledger.TryObserve(
                            index.Columns, columnsPath, itemIndex,
                            StopOnTraversalIssue, out IndexColumnDefinition item))
                        {
                            return;
                        }
                        if (item != null && IsValidIdentifier(item.Column) &&
                            !seen.Add(item.Column.Value))
                        {
                            Add("AST_COLLECTION_DUPLICATE",
                                Indexed(path + ".Columns", itemIndex) + ".Column");
                        }
                    }
                }
                Defined(index.Uniqueness, path + ".Uniqueness");
            }

            private void ValidateConstraintColumns(
                SqlIdentifier name,
                IReadOnlyList<SqlIdentifier> columns,
                string path)
            {
                RequireIdentifier(name, path + ".Name");
                ValidateIdentifierCollection(
                    columns, path + ".Columns", nonempty: true,
                    duplicateCode: "AST_COLLECTION_DUPLICATE");
            }

            private void ValidateForeignKeyColumnSet(
                ForeignKeyColumnSet columns,
                string path)
            {
                var local = ValidateIdentifierCollection(
                    columns.LocalColumns, path + ".LocalColumns", nonempty: true,
                    duplicateCode: "AST_COLLECTION_DUPLICATE");
                var referenced = ValidateIdentifierCollection(
                    columns.ReferencedColumns, path + ".ReferencedColumns", nonempty: true,
                    duplicateCode: "AST_COLLECTION_DUPLICATE");
                if (local && referenced &&
                    _ledger.GetCount(
                        columns.LocalColumns, path + ".LocalColumns") !=
                    _ledger.GetCount(
                        columns.ReferencedColumns, path + ".ReferencedColumns"))
                {
                    Add("AST_SCHEMA_FOREIGN_KEY_ARITY_MISMATCH",
                        path + ".ReferencedColumns");
                }
            }

            private void ValidateTableDefinition(TableDefinition table, string path)
            {
                var columnsPath = path + ".Columns";
                var constraintsPath = path + ".Constraints";
                var indexesPath = path + ".Indexes";
                var namePresent = ValidateObjectName(
                    table.Name, path + ".Name", required: true);
                var columnsPresent = ValidateNamedColumnCollection(
                    table.Columns, columnsPath);
                var constraintsPresent = ValidateNamedConstraintCollection(
                    table.Constraints, constraintsPath);
                var indexesPresent = ValidateNamedIndexCollection(
                    table.Indexes, indexesPath);
                ValidateComment(table.Comment, path + ".Comment", required: false);
                if (!namePresent || !columnsPresent || !constraintsPresent ||
                    !indexesPresent)
                {
                    return;
                }
                AppendDeferred(
                    SqlAstDeferredRuleKind.TableCrossReferences, path);
            }

            private bool ValidateNamedColumnCollection(
                IReadOnlyList<ColumnDefinition> items, string path)
            {
                if (!ValidateNodeCollection(items, path, nonempty: true)) return false;
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var validForDependentRules = true;
                var count = _ledger.GetCount(items, path);
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        items, path, index, StopOnTraversalIssue,
                        out ColumnDefinition item))
                    {
                        return false;
                    }
                    if (item != null && IsValidIdentifier(item.Name) &&
                        !seen.Add(item.Name.Value))
                    {
                        Add("AST_COLLECTION_DUPLICATE", Indexed(path, index) + ".Name");
                        validForDependentRules = false;
                    }
                }
                return validForDependentRules;
            }

            private bool ValidateNamedConstraintCollection(
                IReadOnlyList<ConstraintDefinition> items, string path)
            {
                if (!ValidateNodeCollection(items, path, nonempty: false)) return false;
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var validForDependentRules = true;
                var count = _ledger.GetCount(items, path);
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        items, path, index, StopOnTraversalIssue,
                        out ConstraintDefinition item))
                    {
                        return false;
                    }
                    if (item == null) continue;
                    if (!(item is PrimaryKeyDefinition) &&
                        !(item is UniqueConstraintDefinition) &&
                        !(item is ForeignKeyDefinition))
                    {
                        continue;
                    }
                    if (IsValidIdentifier(item.Name) &&
                        !seen.Add(item.Name.Value))
                    {
                        Add("AST_COLLECTION_DUPLICATE", Indexed(path, index) + ".Name");
                        validForDependentRules = false;
                    }
                }
                return validForDependentRules;
            }

            private bool ValidateNamedIndexCollection(
                IReadOnlyList<IndexDefinition> items, string path)
            {
                if (!ValidateNodeCollection(items, path, nonempty: false)) return false;
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var validForDependentRules = true;
                var count = _ledger.GetCount(items, path);
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        items, path, index, StopOnTraversalIssue,
                        out IndexDefinition item))
                    {
                        return false;
                    }
                    if (item != null && IsValidIdentifier(item.Name) &&
                        !seen.Add(item.Name.Value))
                    {
                        Add("AST_COLLECTION_DUPLICATE", Indexed(path, index) + ".Name");
                        validForDependentRules = false;
                    }
                }
                return validForDependentRules;
            }

            private void ValidateSequenceOptions(SequenceOptions options, string path)
            {
                if (options.IncrementBy == 0)
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".IncrementBy");
                var boundsPresent = Require(options.Bounds, path + ".Bounds");
                if (options.CacheSize.HasValue && options.CacheSize.Value <= 0)
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".CacheSize");
                Defined(options.Cycle, path + ".Cycle");
                var boundsCoherent = boundsPresent &&
                    !(options.Bounds.MinimumValue.HasValue &&
                      options.Bounds.MaximumValue.HasValue &&
                      options.Bounds.MinimumValue.Value >
                      options.Bounds.MaximumValue.Value);
                if (boundsCoherent &&
                    (options.Bounds.MinimumValue.HasValue &&
                     options.StartValue < options.Bounds.MinimumValue.Value ||
                     options.Bounds.MaximumValue.HasValue &&
                     options.StartValue > options.Bounds.MaximumValue.Value))
                {
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".StartValue");
                }
            }

            private void ValidateSequenceDefinition(
                SequenceDefinition sequence, string path)
            {
                ValidateObjectName(sequence.Name, path + ".Name", required: true);
                var typeDefined = Enum.IsDefined(typeof(LogicalDbType), sequence.IntegerType);
                if (!typeDefined)
                    Add("AST_UNDEFINED_ENUM", path + ".IntegerType");
                else if (!IsInteger(sequence.IntegerType))
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".IntegerType");
                if (!Require(sequence.Options, path + ".Options") ||
                    !typeDefined || !IsInteger(sequence.IntegerType)) return;
                if (!FitsInteger(sequence.Options.StartValue, sequence.IntegerType))
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".Options.StartValue");
                if (!FitsInteger(sequence.Options.IncrementBy, sequence.IntegerType))
                    Add("AST_SCHEMA_SEQUENCE_INVALID", path + ".Options.IncrementBy");
                if (sequence.Options.Bounds != null)
                {
                    if (sequence.Options.Bounds.MinimumValue.HasValue &&
                        !FitsInteger(sequence.Options.Bounds.MinimumValue.Value,
                            sequence.IntegerType))
                        Add("AST_SCHEMA_SEQUENCE_INVALID",
                            path + ".Options.Bounds.MinimumValue");
                    if (sequence.Options.Bounds.MaximumValue.HasValue &&
                        !FitsInteger(sequence.Options.Bounds.MaximumValue.Value,
                            sequence.IntegerType))
                        Add("AST_SCHEMA_SEQUENCE_INVALID",
                            path + ".Options.Bounds.MaximumValue");
                }
            }

            private void ValidateRenameTable(RenameTableOperation rename, string path)
            {
                var source = ValidateObjectName(rename.Source, path + ".Source", required: true);
                var target = ValidateObjectName(rename.Target, path + ".Target", required: true);
                if (source && target && rename.Source.Equals(rename.Target))
                    Add("AST_STRUCTURAL_SHAPE_INVALID", path + ".Target");
            }

            private void ValidateRenameColumn(RenameColumnOperation rename, string path)
            {
                ValidateObjectName(rename.Table, path + ".Table", required: true);
                var source = RequireIdentifier(rename.Source, path + ".Source");
                var target = RequireIdentifier(rename.Target, path + ".Target");
                if (source && target && rename.Source.Equals(rename.Target))
                    Add("AST_STRUCTURAL_SHAPE_INVALID", path + ".Target");
            }

            private void ValidateAlterColumn(AlterColumnOperation alter, string path)
            {
                ValidateObjectName(alter.Table, path + ".Table", required: true);
                var before = Require(alter.Before, path + ".Before");
                var after = Require(alter.After, path + ".After");
                if (!before || !after) return;
                if (IsValidIdentifier(alter.Before.Name) &&
                    IsValidIdentifier(alter.After.Name) &&
                    !alter.Before.Name.Equals(alter.After.Name))
                    Add("AST_SCHEMA_ALTER_MISMATCH", path + ".After.Name");
                if (IsValidComment(alter.Before.Comment) &&
                    IsValidComment(alter.After.Comment) &&
                    !Equals(alter.Before.Comment, alter.After.Comment))
                    Add("AST_SCHEMA_ALTER_MISMATCH", path + ".After.Comment");
            }

            private void ValidateAlterSequence(AlterSequenceOperation alter, string path)
            {
                var before = Require(alter.Before, path + ".Before");
                var after = Require(alter.After, path + ".After");
                if (before && after &&
                    IsValidObjectName(alter.Before.Name) &&
                    IsValidObjectName(alter.After.Name) &&
                    !alter.Before.Name.Equals(alter.After.Name))
                    Add("AST_SCHEMA_ALTER_MISMATCH", path + ".After.Name");
            }

            private void ValidateMigrationStep(MigrationStep step, string path)
            {
                if (step.Id == null)
                    Add("AST_REQUIRED_CHILD_MISSING", path + ".Id");
                else
                    ValidateTextId(step.Id.Value, path + ".Id");
                var operationPresent = Require(step.Operation, path + ".Operation");
                var modeDefined = Defined(step.Idempotency, path + ".Idempotency");
                if (!operationPresent || !modeDefined) return;
                MigrationIdempotencyMode? expected = null;
                if (TryCreateBehavior(step.Operation, out var create))
                    expected = create == CreateObjectBehavior.FailIfExists
                        ? MigrationIdempotencyMode.RequireChange
                        : MigrationIdempotencyMode.AcceptAlreadySatisfied;
                else if (TryDropBehavior(step.Operation, out var drop))
                    expected = drop == DropObjectBehavior.FailIfMissing
                        ? MigrationIdempotencyMode.RequireChange
                        : MigrationIdempotencyMode.AcceptAlreadySatisfied;
                if (expected.HasValue && step.Idempotency != expected.Value)
                    Add("AST_MIGRATION_IDEMPOTENCY_MISMATCH", path + ".Idempotency");
            }

            private void ValidateMigrationPlan(MigrationPlan plan, string path)
            {
                var stepsPath = path + ".Steps";
                if (plan.Id == null)
                    Add("AST_REQUIRED_CHILD_MISSING", path + ".Id");
                else
                    ValidateTextId(plan.Id.Value, path + ".Id");
                if (ValidateNodeCollection(plan.Steps, stepsPath, nonempty: false))
                {
                    var seen = new HashSet<string>(StringComparer.Ordinal);
                    var count = _ledger.GetCount(plan.Steps, stepsPath);
                    for (var index = 0; index < count; index++)
                    {
                        if (!_ledger.TryObserve(
                            plan.Steps, stepsPath, index,
                            StopOnTraversalIssue, out MigrationStep step))
                        {
                            return;
                        }
                        if (step != null && step.Id != null &&
                            !string.IsNullOrWhiteSpace(step.Id.Value) &&
                            !seen.Add(step.Id.Value))
                            Add("AST_MIGRATION_STEP_ID_DUPLICATE",
                                Indexed(path + ".Steps", index) + ".Id");
                    }
                }
                ValidateFingerprint(plan.Fingerprint, path + ".Fingerprint");
            }

            private void ValidateDatabaseExport(DatabaseExportOperation export, string path)
            {
                RequireIdentifier(export.Database, path + ".Database");
                ValidateResource(export.Resource, path + ".Resource");
                Defined(export.Format, path + ".Format");
                Defined(export.Scope, path + ".Scope");
            }

            private void ValidateDatabaseImport(DatabaseImportOperation import, string path)
            {
                RequireIdentifier(import.Database, path + ".Database");
                ValidateResource(import.Resource, path + ".Resource");
                var format = Defined(import.Format, path + ".Format");
                var scope = Defined(import.Scope, path + ".Scope");
                var policy = Defined(import.Policy, path + ".Policy");
                if (format && scope && policy &&
                    import.Policy == DatabaseImportConflictPolicy.ReplaceTargetDatabase &&
                    import.Scope != DatabaseTransferScope.SchemaAndData)
                    Add("AST_STRUCTURAL_SHAPE_INVALID", path + ".Scope");
                ValidateFingerprint(import.Fingerprint, path + ".Fingerprint");
            }

            private void ValidateResource(DatabaseResourceHandle resource, string path)
            {
                if (!Require(resource, path)) return;
                if (resource.Id == Guid.Empty)
                    Add("AST_SCALAR_INVALID", path + ".Id");
                if (resource.ContentDigest == null)
                    Add("AST_REQUIRED_CHILD_MISSING", path + ".ContentDigest");
                else if (!IsLowerHex(resource.ContentDigest.Value, 64))
                    Add("AST_SCALAR_INVALID", path + ".ContentDigest.Value");
            }

            private void ValidateFingerprint(StructuralFingerprint value, string path)
            {
                if (value == null) return;
                var text = value.Value;
                if (text == null || text.Length != 71 ||
                    !text.StartsWith("sha256:", StringComparison.Ordinal) ||
                    !IsLowerHex(text.Substring(7), 64))
                    Add("AST_SCALAR_INVALID", path + ".Value");
            }

            private void ValidateComment(SchemaComment comment, string path, bool required)
            {
                if (comment == null)
                {
                    if (required) Add("AST_REQUIRED_CHILD_MISSING", path);
                }
                else if (string.IsNullOrWhiteSpace(comment.Text))
                    Add("AST_SCALAR_INVALID", path + ".Text");
            }

            private void ValidateTextId(string value, string path)
            {
                if (string.IsNullOrWhiteSpace(value))
                    Add("AST_SCALAR_INVALID", path + ".Value");
            }

            private static bool TryCreateBehavior(
                SchemaOperation operation,
                out CreateObjectBehavior behavior)
            {
                if (operation is CreateSchemaOperation createSchema)
                    behavior = createSchema.Behavior;
                else if (operation is CreateTableOperation createTable)
                    behavior = createTable.Behavior;
                else if (operation is CreateIndexOperation createIndex)
                    behavior = createIndex.Behavior;
                else if (operation is CreateSequenceOperation createSequence)
                    behavior = createSequence.Behavior;
                else
                {
                    behavior = default(CreateObjectBehavior);
                    return false;
                }
                return Enum.IsDefined(typeof(CreateObjectBehavior), behavior);
            }

            private static bool TryDropBehavior(
                SchemaOperation operation,
                out DropObjectBehavior behavior)
            {
                if (operation is DropSchemaOperation dropSchema)
                    behavior = dropSchema.Behavior;
                else if (operation is DropTableOperation dropTable)
                    behavior = dropTable.Behavior;
                else if (operation is DropColumnOperation dropColumn)
                    behavior = dropColumn.Behavior;
                else if (operation is DropConstraintOperation dropConstraint)
                    behavior = dropConstraint.Behavior;
                else if (operation is DropIndexOperation dropIndex)
                    behavior = dropIndex.Behavior;
                else if (operation is DropSequenceOperation dropSequence)
                    behavior = dropSequence.Behavior;
                else
                {
                    behavior = default(DropObjectBehavior);
                    return false;
                }
                return Enum.IsDefined(typeof(DropObjectBehavior), behavior);
            }

            private static bool IsInteger(LogicalDbType type)
            {
                return type == LogicalDbType.Int16 ||
                       type == LogicalDbType.Int32 ||
                       type == LogicalDbType.Int64;
            }

            private static bool FitsInteger(long value, LogicalDbType type)
            {
                if (type == LogicalDbType.Int16)
                    return value >= short.MinValue && value <= short.MaxValue;
                if (type == LogicalDbType.Int32)
                    return value >= int.MinValue && value <= int.MaxValue;
                return type == LogicalDbType.Int64;
            }

            private static bool IsLowerHex(string value, int length)
            {
                if (value == null || value.Length != length) return false;
                for (var index = 0; index < value.Length; index++)
                {
                    var character = value[index];
                    if (!((character >= '0' && character <= '9') ||
                          (character >= 'a' && character <= 'f')))
                        return false;
                }
                return true;
            }

            private readonly struct ColumnReference
            {
                internal ColumnReference(ColumnFact column, int index)
                {
                    Column = column;
                    Index = index;
                }

                internal ColumnFact Column { get; }
                internal int Index { get; }
            }

            private readonly struct ColumnFact
            {
                internal ColumnFact(
                    string name,
                    ColumnNullability nullability,
                    bool hasDefault)
                {
                    Name = name;
                    Nullability = nullability;
                    HasDefault = hasDefault;
                }

                internal string Name { get; }
                internal ColumnNullability Nullability { get; }
                internal bool HasDefault { get; }
            }

            private readonly struct AssignmentFact
            {
                internal AssignmentFact(
                    string columnValue,
                    bool columnValid)
                {
                    ColumnValue = columnValue;
                    ColumnValid = columnValid;
                }

                internal string ColumnValue { get; }
                internal bool ColumnValid { get; }
            }

            private readonly struct UpsertShapeFact
            {
                internal UpsertShapeFact(
                    bool checkInsertAssignments,
                    bool checkUpdateAssignments)
                {
                    CheckInsertAssignments = checkInsertAssignments;
                    CheckUpdateAssignments = checkUpdateAssignments;
                }

                internal bool CheckInsertAssignments { get; }
                internal bool CheckUpdateAssignments { get; }
            }

            private readonly struct IndexColumnFact
            {
                internal IndexColumnFact(string column)
                {
                    Column = column;
                }

                internal string Column { get; }
            }

            private readonly struct ReferentialActionsFact
            {
                internal ReferentialActionsFact(
                    ReferentialAction onUpdate,
                    ReferentialAction onDelete)
                {
                    OnUpdate = onUpdate;
                    OnDelete = onDelete;
                }

                internal ReferentialAction OnUpdate { get; }
                internal ReferentialAction OnDelete { get; }
            }

            private readonly struct IdentifierListFact
            {
                private readonly string[] _values;

                internal IdentifierListFact(string[] values)
                {
                    _values = values ?? throw new ArgumentNullException(
                        nameof(values));
                }

                internal int Count => _values.Length;
                internal string this[int index] => _values[index];
            }

            private readonly struct ObjectNameFact :
                IEquatable<ObjectNameFact>
            {
                internal ObjectNameFact(
                    string catalog,
                    string schema,
                    string name)
                {
                    Catalog = catalog;
                    Schema = schema;
                    Name = name;
                }

                internal string Catalog { get; }
                internal string Schema { get; }
                internal string Name { get; }

                public bool Equals(ObjectNameFact other)
                {
                    return string.Equals(
                               Catalog, other.Catalog,
                               StringComparison.Ordinal) &&
                           string.Equals(
                               Schema, other.Schema,
                               StringComparison.Ordinal) &&
                           string.Equals(
                               Name, other.Name,
                               StringComparison.Ordinal);
                }
            }

            private bool ValidateNodeCollection<T>(
                IReadOnlyList<T> collection,
                string path,
                bool nonempty)
                where T : class
            {
                if (collection == null)
                {
                    Add("AST_REQUIRED_CHILD_MISSING", path);
                    return false;
                }
                var validForDependentRules = true;
                var count = _ledger.GetCount(collection, path);
                if (nonempty && count == 0)
                {
                    Add("AST_COLLECTION_EMPTY", path);
                    validForDependentRules = false;
                }
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        collection, path, index, StopOnTraversalIssue, out T item))
                    {
                        return false;
                    }
                    if (item == null)
                    {
                        Add("AST_COLLECTION_NULL_ITEM", Indexed(path, index));
                        validForDependentRules = false;
                    }
                }
                return validForDependentRules;
            }

            private bool ValidateIdentifierCollection(
                IReadOnlyList<SqlIdentifier> collection,
                string path,
                bool nonempty,
                string duplicateCode)
            {
                if (!ValidateNodeCollection(collection, path, nonempty))
                {
                    return false;
                }
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var validForDependentRules = true;
                var count = _ledger.GetCount(collection, path);
                var values = new string[count];
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        collection, path, index, StopOnTraversalIssue,
                        out SqlIdentifier identifier))
                    {
                        return false;
                    }
                    if (identifier == null)
                    {
                        continue;
                    }
                    values[index] = identifier.Value;
                    var identifierValid = RequireIdentifier(
                        identifier, Indexed(path, index));
                    if (!identifierValid)
                    {
                        validForDependentRules = false;
                        continue;
                    }
                    if (!seen.Add(identifier.Value))
                    {
                        Add(duplicateCode, Indexed(path, index));
                        validForDependentRules = false;
                    }
                }
                _identifierListFacts[path] = new IdentifierListFact(values);
                return validForDependentRules;
            }

            private void ValidateNamedCteCollection(
                IReadOnlyList<CommonTableExpression> collection,
                string path)
            {
                if (!ValidateNodeCollection(collection, path, nonempty: false))
                {
                    return;
                }
                var seen = new HashSet<string>(StringComparer.Ordinal);
                var count = _ledger.GetCount(collection, path);
                for (var index = 0; index < count; index++)
                {
                    if (!_ledger.TryObserve(
                        collection, path, index, StopOnTraversalIssue,
                        out CommonTableExpression item))
                    {
                        return;
                    }
                    if (item != null && IsValidIdentifier(item.Name) &&
                        !seen.Add(item.Name.Value))
                    {
                        Add("AST_COLLECTION_DUPLICATE",
                            Indexed(path, index) + ".Name");
                    }
                }
            }

            private bool ValidateParameterName(string name, string path)
            {
                var valid = !string.IsNullOrWhiteSpace(name);
                if (valid)
                {
                    var first = name[0];
                    valid = first != '@' && first != ':' && first != '?';
                    for (var index = 0; valid && index < name.Length; index++)
                    {
                        valid = !char.IsControl(name[index]);
                    }
                }
                if (!valid)
                {
                    Add("AST_PARAMETER_NAME_INVALID", path);
                }
                return valid;
            }

            private bool ValidateType(
                SqlTypeDescriptor type,
                string path,
                bool parameterOwned)
            {
                if (type == null)
                {
                    Add(parameterOwned
                        ? "AST_PARAMETER_TYPE_INVALID"
                        : "AST_REQUIRED_CHILD_MISSING", path);
                    return false;
                }
                if (!Enum.IsDefined(typeof(LogicalDbType), type.LogicalType))
                {
                    Add(parameterOwned
                        ? "AST_PARAMETER_TYPE_INVALID"
                        : "AST_UNDEFINED_ENUM",
                        parameterOwned ? path : path + ".LogicalType");
                    return false;
                }
                var valid = true;
                if (type.Length.HasValue && type.Length.Value <= 0)
                {
                    Add(parameterOwned ? "AST_PARAMETER_TYPE_INVALID" : "AST_SCALAR_INVALID",
                        parameterOwned ? path : path + ".Length");
                    valid = false;
                }
                if (type.Precision.HasValue && type.Precision.Value <= 0)
                {
                    Add(parameterOwned ? "AST_PARAMETER_TYPE_INVALID" : "AST_SCALAR_INVALID",
                        parameterOwned ? path : path + ".Precision");
                    valid = false;
                }
                if (type.Scale.HasValue &&
                    (type.Scale.Value < 0 || !type.Precision.HasValue ||
                     type.Scale.Value > type.Precision.Value))
                {
                    Add(parameterOwned ? "AST_PARAMETER_TYPE_INVALID" : "AST_SCALAR_INVALID",
                        parameterOwned ? path : path + ".Scale");
                    valid = false;
                }
                return valid;
            }

            private bool ValidateObjectName(
                SqlObjectName name,
                string path,
                bool required)
            {
                if (name == null)
                {
                    if (required) Add("AST_REQUIRED_CHILD_MISSING", path);
                    return false;
                }
                _objectNameFacts[path] = new ObjectNameFact(
                    name.Catalog == null ? null : name.Catalog.Value,
                    name.Schema == null ? null : name.Schema.Value,
                    name.Name == null ? null : name.Name.Value);
                var valid = true;
                if (name.Catalog != null &&
                    !RequireIdentifier(name.Catalog, path + ".Catalog"))
                {
                    valid = false;
                }
                if (name.Schema != null &&
                    !RequireIdentifier(name.Schema, path + ".Schema"))
                {
                    valid = false;
                }
                if (!RequireIdentifier(name.Name, path + ".Name"))
                {
                    valid = false;
                }
                return valid;
            }

            private sealed class TerminalCollectionSignalException : Exception
            {
            }

            private void ValidateAlias(SqlAlias alias, string path, bool required)
            {
                if (alias == null)
                {
                    if (required) Add("AST_REQUIRED_CHILD_MISSING", path);
                    return;
                }
                RequireIdentifier(alias.Identifier, path + ".Identifier");
            }

            private bool RequireIdentifier(SqlIdentifier identifier, string path)
            {
                if (identifier == null)
                {
                    Add("AST_REQUIRED_CHILD_MISSING", path);
                    return false;
                }
                var valid = IsValidIdentifier(identifier);
                if (!valid)
                {
                    Add("AST_INVALID_IDENTIFIER", path);
                }
                return valid;
            }

            private static bool IsValidIdentifier(SqlIdentifier identifier)
            {
                if (identifier == null)
                {
                    return false;
                }
                var value = identifier.Value;
                var valid = !string.IsNullOrWhiteSpace(value) &&
                    !string.Equals(value, "*", StringComparison.Ordinal);
                for (var index = 0; valid && index < value.Length; index++)
                {
                    var character = value[index];
                    valid = character != '.' && character != '`' &&
                            character != '[' && character != ']' &&
                            character != '"' && !char.IsControl(character);
                }
                return valid;
            }

            private static bool IsValidObjectName(SqlObjectName name)
            {
                return name != null &&
                    (name.Catalog == null || IsValidIdentifier(name.Catalog)) &&
                    (name.Schema == null || IsValidIdentifier(name.Schema)) &&
                    IsValidIdentifier(name.Name);
            }

            private static bool IsValidComment(SchemaComment comment)
            {
                return comment == null ||
                    !string.IsNullOrWhiteSpace(comment.Text);
            }

            private bool Require(object value, string path)
            {
                if (value != null)
                {
                    return true;
                }
                Add("AST_REQUIRED_CHILD_MISSING", path);
                return false;
            }

            private bool Defined<T>(T value, string path) where T : struct
            {
                if (Enum.IsDefined(typeof(T), value))
                {
                    return true;
                }
                Add("AST_UNDEFINED_ENUM", path);
                return false;
            }

            private void Add(string code, string path)
            {
                if (_ledger.IsTerminal)
                {
                    return;
                }
                if (_currentOccurrence == null)
                {
                    throw new InvalidOperationException(
                        "SQL AST diagnostic has no logical occurrence owner.");
                }
                _currentOccurrence.LocalEntries.Add(new SqlAstLocalEntry(
                    new SqlAstDiagnostic(code, MessageFor(code), path)));
                _currentOccurrence.BaseState = SqlAstRetainedState.Invalid;
            }

            private void AppendDeferred(
                SqlAstDeferredRuleKind kind,
                string anchorPath)
            {
                if (_ledger.IsTerminal)
                {
                    return;
                }
                if (_currentOccurrence == null)
                {
                    throw new InvalidOperationException(
                        "SQL AST deferred rule has no logical occurrence owner.");
                }
                _currentOccurrence.LocalEntries.Add(new SqlAstLocalEntry(
                    new SqlAstDeferredRule(
                        kind,
                        _currentOccurrence.Id,
                        anchorPath)));
            }
        }

        private static bool ArityValid(SemanticFunctionId function, int count)
        {
            return count >= function.MinArguments &&
                   (!function.MaxArguments.HasValue ||
                    count <= function.MaxArguments.Value);
        }

        private static string Indexed(string path, int index)
        {
            return path + "[" + index.ToString(
                System.Globalization.CultureInfo.InvariantCulture) + "]";
        }

        private static string MessageFor(string code)
        {
            switch (code)
            {
                case "AST_UNKNOWN_NODE": return "SQL AST contains an unknown node subtype.";
                case "AST_REQUIRED_CHILD_MISSING": return "SQL AST contains a missing required child.";
                case "AST_TRAVERSAL_DEPTH_EXCEEDED": return "SQL AST traversal exceeds maximum depth 128.";
                case "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED": return "SQL AST traversal exceeds maximum node occurrence count 4096.";
                case "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED": return "SQL AST traversal exceeds maximum collection slot inspection count 16384.";
                case "AST_INVALID_IDENTIFIER": return "SQL identifier is not one valid unquoted segment.";
                case "AST_UNDEFINED_ENUM": return "SQL AST contains an undefined enumeration value.";
                case "AST_SCALAR_INVALID": return "SQL AST scalar value is invalid.";
                case "AST_STRUCTURAL_SHAPE_INVALID": return "SQL AST structural shape is invalid.";
                case "AST_COLLECTION_EMPTY": return "Required SQL AST collection is empty.";
                case "AST_COLLECTION_NULL_ITEM": return "SQL AST collection contains a null item.";
                case "AST_COLLECTION_DUPLICATE": return "SQL AST collection contains a duplicate logical name.";
                case "AST_JOIN_CONDITION_REQUIRED": return "Non-cross join requires a condition.";
                case "AST_JOIN_CONDITION_FORBIDDEN": return "Cross join cannot have a condition.";
                case "AST_SUBQUERY_SELECT_REQUIRED": return "Subquery must contain a SelectStatement.";
                case "AST_FUNCTION_NOT_REGISTERED": return "Function must use the registered semantic catalog instance.";
                case "AST_FUNCTION_ARITY": return "Function argument count is outside its semantic contract.";
                case "AST_AGGREGATE_FUNCTION_REQUIRED": return "Aggregate must use a registered aggregate semantic function.";
                case "AST_AGGREGATE_ARITY": return "Aggregate argument count is outside its semantic contract.";
                case "AST_AGGREGATE_DISTINCT_ARGUMENT_REQUIRED": return "DISTINCT aggregate requires an argument.";
                case "AST_PAGE_ORDER_REQUIRED": return "Offset pagination requires at least one ORDER BY expression.";
                case "AST_KEYSET_ORDER_REQUIRED": return "Keyset pagination requires at least one ORDER BY expression.";
                case "AST_KEYSET_BOUNDARY_REQUIRED": return "Keyset pagination requires at least one boundary expression.";
                case "AST_KEYSET_ARITY_MISMATCH": return "Keyset ORDER BY and boundary expression counts must match.";
                case "AST_CTE_COLUMN_ARITY_MISMATCH": return "CTE column aliases must match the statically known query result-column count.";
                case "AST_SET_OPERATION_ARITY_MISMATCH": return "Set-operation branches must have the same statically known result-column count.";
                case "AST_PARAMETER_NAME_INVALID": return "Logical parameter name is invalid.";
                case "AST_PARAMETER_TYPE_INVALID": return "Logical parameter type descriptor is invalid.";
                case "AST_PARAMETER_DIRECTION_INVALID": return "Logical parameter direction is undefined.";
                case "AST_PARAMETER_DEFINITION_CONFLICT": return "Logical parameter name has conflicting definitions.";
                case "AST_WRITE_ALL_ROWS_NOT_ALLOWED": return "Full-table write requires explicit AllowAllRows.";
                case "AST_DML_COLUMN_DUPLICATE": return "DML target columns must be ordinally unique.";
                case "AST_DML_ASSIGNMENT_DUPLICATE": return "DML assignments must target ordinally unique columns.";
                case "AST_DML_ROW_ARITY_MISMATCH": return "DML row value count must match target column count.";
                case "AST_INSERT_SOURCE_ARITY_MISMATCH": return "Insert target columns must match the statically known source result-column count.";
                case "AST_INSERT_SOURCE_SHAPE_INVALID": return "Insert must contain exactly one values or select source.";
                case "AST_UPSERT_SHAPE_INVALID": return "Upsert conflict policy, keys, and assignments are inconsistent.";
                case "AST_BULK_BATCH_SIZE_INVALID": return "Bulk batch-size maximum must be positive.";
                case "AST_SCHEMA_DEFAULT_TYPE_MISMATCH": return "Column default is incompatible with its logical type.";
                case "AST_SCHEMA_GENERATION_TYPE_MISMATCH": return "Column generation is incompatible with its logical type.";
                case "AST_SCHEMA_COLUMN_REFERENCE_MISSING": return "Schema object references a column not declared by its table.";
                case "AST_SCHEMA_PRIMARY_KEY_NULLABLE": return "Primary-key columns must be not nullable.";
                case "AST_SCHEMA_REFERENTIAL_ACTION_INVALID": return "Foreign-key referential action is incompatible with local columns.";
                case "AST_SCHEMA_FOREIGN_KEY_ARITY_MISMATCH": return "Foreign-key local and referenced column counts must match.";
                case "AST_SCHEMA_ALTER_MISMATCH": return "Before and after schema definitions do not identify the same object.";
                case "AST_SCHEMA_SEQUENCE_INVALID": return "Sequence type, bounds, start, increment, or cache is invalid.";
                case "AST_MIGRATION_STEP_ID_DUPLICATE": return "Migration step IDs must be ordinally unique.";
                case "AST_MIGRATION_IDEMPOTENCY_MISMATCH": return "Migration idempotency contradicts create or drop behavior.";
                default: throw new InvalidOperationException("Unknown SQL AST diagnostic code.");
            }
        }
    }

    internal enum SafeWriteTruth
    {
        Unknown,
        False,
        True
    }

    internal static class SafeWriteClassifier
    {
        internal static SafeWriteTruth Classify(SqlExpression expression)
        {
            if (expression == null)
            {
                return SafeWriteTruth.Unknown;
            }
            if (!WithinLocalBudget(expression))
            {
                return SafeWriteTruth.Unknown;
            }

            var comparer = ExpressionReferenceComparer.Instance;
            var states = new Dictionary<SqlExpression, byte>(comparer);
            var results = new Dictionary<SqlExpression, SafeWriteTruth>(comparer);
            var cyclic = new HashSet<SqlExpression>(comparer);
            var stack = new Stack<ClassifierFrame>();
            stack.Push(new ClassifierFrame(expression, complete: false, depth: 0));
            var occurrences = 0;

            while (stack.Count != 0)
            {
                var frame = stack.Pop();
                if (frame.Complete)
                {
                    var result = Evaluate(frame.Expression, results);
                    if (cyclic.Contains(frame.Expression))
                    {
                        result = SafeWriteTruth.Unknown;
                    }
                    results[frame.Expression] = result;
                    states[frame.Expression] = 2;
                    continue;
                }

                if (frame.Depth > SqlAstTraversal.MaximumDepth ||
                    occurrences == SqlAstTraversal.MaximumNodeOccurrences)
                {
                    results[frame.Expression] = SafeWriteTruth.Unknown;
                    states[frame.Expression] = 2;
                    continue;
                }
                occurrences++;

                if (states.TryGetValue(frame.Expression, out var state))
                {
                    if (state == 1) cyclic.Add(frame.Expression);
                    continue;
                }
                states.Add(frame.Expression, 1);
                stack.Push(new ClassifierFrame(
                    frame.Expression, complete: true, frame.Depth));

                if (frame.Expression is UnaryExpression unary &&
                    unary.Operator == SqlUnaryOperator.Not &&
                    unary.Operand != null)
                {
                    PushChild(unary.Operand, frame.Depth + 1, frame.Expression,
                        stack, states, cyclic);
                }
                else if (frame.Expression is BinaryExpression binary &&
                         (binary.Operator == SqlBinaryOperator.And ||
                          binary.Operator == SqlBinaryOperator.Or))
                {
                    PushChild(binary.Right, frame.Depth + 1, frame.Expression,
                        stack, states, cyclic);
                    PushChild(binary.Left, frame.Depth + 1, frame.Expression,
                        stack, states, cyclic);
                }
            }

            return results.TryGetValue(expression, out var truth)
                ? truth
                : SafeWriteTruth.Unknown;
        }

        private static bool WithinLocalBudget(SqlExpression expression)
        {
            var stack = new Stack<ClassifierFrame>();
            stack.Push(new ClassifierFrame(
                expression, complete: false, depth: 0));
            var occurrences = 0;

            while (stack.Count != 0)
            {
                var frame = stack.Pop();
                if (frame.Depth > SqlAstTraversal.MaximumDepth ||
                    occurrences == SqlAstTraversal.MaximumNodeOccurrences)
                {
                    return false;
                }
                occurrences++;

                if (frame.Expression is UnaryExpression unary &&
                    unary.Operator == SqlUnaryOperator.Not &&
                    unary.Operand != null)
                {
                    stack.Push(new ClassifierFrame(
                        unary.Operand, complete: false, frame.Depth + 1));
                }
                else if (frame.Expression is BinaryExpression binary &&
                         (binary.Operator == SqlBinaryOperator.And ||
                          binary.Operator == SqlBinaryOperator.Or))
                {
                    if (binary.Right != null)
                    {
                        stack.Push(new ClassifierFrame(
                            binary.Right, complete: false, frame.Depth + 1));
                    }
                    if (binary.Left != null)
                    {
                        stack.Push(new ClassifierFrame(
                            binary.Left, complete: false, frame.Depth + 1));
                    }
                }
            }

            return true;
        }

        private static void PushChild(
            SqlExpression child,
            int depth,
            SqlExpression parent,
            Stack<ClassifierFrame> stack,
            IDictionary<SqlExpression, byte> states,
            ISet<SqlExpression> cyclic)
        {
            if (child == null)
            {
                return;
            }
            if (states.TryGetValue(child, out var state) && state == 1)
            {
                cyclic.Add(parent);
                cyclic.Add(child);
                return;
            }
            if (!states.ContainsKey(child))
            {
                stack.Push(new ClassifierFrame(child, complete: false, depth));
            }
        }

        private static SafeWriteTruth Evaluate(
            SqlExpression expression,
            IDictionary<SqlExpression, SafeWriteTruth> results)
        {
            if (expression is BooleanExpression boolean)
            {
                return boolean.Value ? SafeWriteTruth.True : SafeWriteTruth.False;
            }
            if (expression is UnaryExpression unary &&
                unary.Operator == SqlUnaryOperator.Not && unary.Operand != null)
            {
                var operand = ResultFor(unary.Operand, results);
                if (operand == SafeWriteTruth.True) return SafeWriteTruth.False;
                if (operand == SafeWriteTruth.False) return SafeWriteTruth.True;
                return SafeWriteTruth.Unknown;
            }
            if (!(expression is BinaryExpression binary) ||
                binary.Left == null || binary.Right == null)
            {
                return SafeWriteTruth.Unknown;
            }

            var left = ResultFor(binary.Left, results);
            var right = ResultFor(binary.Right, results);
            if (binary.Operator == SqlBinaryOperator.And)
            {
                if (left == SafeWriteTruth.False || right == SafeWriteTruth.False)
                    return SafeWriteTruth.False;
                if (left == SafeWriteTruth.True && right == SafeWriteTruth.True)
                    return SafeWriteTruth.True;
                return SafeWriteTruth.Unknown;
            }
            if (binary.Operator == SqlBinaryOperator.Or)
            {
                if (left == SafeWriteTruth.True || right == SafeWriteTruth.True)
                    return SafeWriteTruth.True;
                if (left == SafeWriteTruth.False && right == SafeWriteTruth.False)
                    return SafeWriteTruth.False;
            }
            return SafeWriteTruth.Unknown;
        }

        private static SafeWriteTruth ResultFor(
            SqlExpression expression,
            IDictionary<SqlExpression, SafeWriteTruth> results)
        {
            return expression != null && results.TryGetValue(expression, out var result)
                ? result
                : SafeWriteTruth.Unknown;
        }

        private readonly struct ClassifierFrame
        {
            internal ClassifierFrame(
                SqlExpression expression, bool complete, int depth)
            {
                Expression = expression;
                Complete = complete;
                Depth = depth;
            }

            internal SqlExpression Expression { get; }
            internal bool Complete { get; }
            internal int Depth { get; }
        }

        private sealed class ExpressionReferenceComparer :
            IEqualityComparer<SqlExpression>
        {
            internal static ExpressionReferenceComparer Instance { get; } =
                new ExpressionReferenceComparer();

            public bool Equals(SqlExpression left, SqlExpression right)
            {
                return ReferenceEquals(left, right);
            }

            public int GetHashCode(SqlExpression value)
            {
                return RuntimeHelpers.GetHashCode(value);
            }
        }
    }

    internal static class SqlStaticResultArity
    {
        internal static int? GetKnownCoreColumnCount(SelectStatement query)
        {
            return SqlAstValidator.GetKnownSelectWidth(
                query, coreOnly: true);
        }

        internal static int? GetKnownResultColumnCount(SelectStatement query)
        {
            return SqlAstValidator.GetKnownSelectWidth(
                query, coreOnly: false);
        }

    }
}
