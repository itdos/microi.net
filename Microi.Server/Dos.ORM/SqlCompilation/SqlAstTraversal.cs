using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal enum SqlAstTraversalIssueKind
    {
        UnknownNode,
        DepthExceeded,
        NodeLimitExceeded,
        CollectionSlotLimitExceeded
    }

    internal readonly struct SqlAstTraversalIssue
    {
        internal SqlAstTraversalIssue(SqlAstTraversalIssueKind kind, string path)
        {
            Kind = kind;
            Path = path;
        }

        internal SqlAstTraversalIssueKind Kind { get; }
        internal string Path { get; }
    }

    internal enum SqlAstCollectionObservationState
    {
        Observing,
        Complete,
        TerminalIncomplete
    }

    internal readonly struct SqlAstCollectionSnapshot<T>
    {
        private readonly IReadOnlyList<object> _items;
        private readonly object _nullValue;

        internal SqlAstCollectionSnapshot(
            int count,
            IReadOnlyList<object> items,
            object nullValue)
        {
            Count = count;
            _items = items;
            _nullValue = nullValue;
        }

        internal int Count { get; }

        internal T this[int index]
        {
            get
            {
                var value = _items[index];
                return ReferenceEquals(value, _nullValue)
                    ? default(T)
                    : (T)value;
            }
        }
    }

    internal enum SqlAstOccurrencePhase
    {
        Scheduled,
        Entering,
        InspectingLocal,
        LocalComplete,
        ExpandingChildren,
        Closed,
        TerminalCut
    }

    internal enum SqlAstRetainedState
    {
        Pending,
        Valid,
        Invalid,
        UnknownIncomplete
    }

    internal sealed class SqlAstChildEdge
    {
        internal SqlAstChildEdge(
            string path,
            int? childOccurrenceId,
            bool isNull,
            SqlAstTraversalIssue? issue)
        {
            Path = path;
            ChildOccurrenceId = childOccurrenceId;
            IsNull = isNull;
            Issue = issue;
        }

        internal string Path { get; }
        internal int? ChildOccurrenceId { get; }
        internal bool IsNull { get; }
        internal SqlAstTraversalIssue? Issue { get; }
    }

    internal sealed class SqlAstOccurrence
    {
        internal SqlAstOccurrence(
            int id,
            SqlNode node,
            string path,
            int depth,
            int? parentId)
        {
            Id = id;
            Node = node;
            Path = path;
            Depth = depth;
            ParentId = parentId;
            Phase = SqlAstOccurrencePhase.Scheduled;
            BaseState = SqlAstRetainedState.Pending;
            FinalState = SqlAstRetainedState.Pending;
        }

        internal int Id { get; }
        internal SqlNode Node { get; }
        internal string Path { get; }
        internal int Depth { get; }
        internal int? ParentId { get; }
        internal SqlAstTraversalCursor Cursor { get; set; }
        internal List<SqlAstLocalEntry> LocalEntries { get; } =
            new List<SqlAstLocalEntry>();
        internal List<SqlAstChildEdge> ChildEdges { get; } =
            new List<SqlAstChildEdge>();
        internal SqlAstOccurrencePhase Phase { get; set; }
        internal SqlAstRetainedState BaseState { get; set; }
        internal SqlAstRetainedState FinalState { get; set; }
        internal bool ExpansionComplete { get; set; }
        internal int? CoreWidth { get; set; }
        internal int? ShapeWidth { get; set; }
        internal int? ResultWidth { get; set; }
    }

    internal enum SqlAstCanonicalSegmentKind
    {
        OccurrenceLocalBuffer,
        TraversalIssue
    }

    internal readonly struct SqlAstCanonicalSegment
    {
        internal SqlAstCanonicalSegment(int occurrenceId)
        {
            Kind = SqlAstCanonicalSegmentKind.OccurrenceLocalBuffer;
            OccurrenceId = occurrenceId;
            Issue = default(SqlAstTraversalIssue);
        }

        internal SqlAstCanonicalSegment(SqlAstTraversalIssue issue)
        {
            Kind = SqlAstCanonicalSegmentKind.TraversalIssue;
            OccurrenceId = -1;
            Issue = issue;
        }

        internal SqlAstCanonicalSegmentKind Kind { get; }
        internal int OccurrenceId { get; }
        internal SqlAstTraversalIssue Issue { get; }
    }

    internal sealed class SqlAstInspectionSession
    {
        private int _nextOccurrenceId;
        private readonly Dictionary<string, SqlAstOccurrence> _byPath =
            new Dictionary<string, SqlAstOccurrence>(StringComparer.Ordinal);

        internal SqlAstInspectionSession()
            : this(new SqlAstCollectionInspectionLedger())
        {
        }

        internal SqlAstInspectionSession(
            SqlAstCollectionInspectionLedger ledger)
        {
            Ledger = ledger ?? throw new ArgumentNullException(nameof(ledger));
        }

        internal SqlAstCollectionInspectionLedger Ledger { get; }
        internal SqlAstCanonicalParameterCatalog Parameters { get; } =
            new SqlAstCanonicalParameterCatalog();
        internal List<SqlAstOccurrence> Occurrences { get; } =
            new List<SqlAstOccurrence>();
        internal List<SqlAstCanonicalSegment> Segments { get; } =
            new List<SqlAstCanonicalSegment>();
        internal SqlAstTraversalIssue? TerminalIssue { get; private set; }
        internal bool IsSealed { get; private set; }

        internal SqlAstOccurrence AddOccurrence(
            SqlNode node,
            string path,
            int depth,
            int? parentId)
        {
            var occurrence = new SqlAstOccurrence(
                _nextOccurrenceId++, node, path, depth, parentId);
            Occurrences.Add(occurrence);
            _byPath.Add(path, occurrence);
            Segments.Add(new SqlAstCanonicalSegment(occurrence.Id));
            return occurrence;
        }

        internal bool TryGetOccurrence(
            string path,
            out SqlAstOccurrence occurrence)
        {
            return _byPath.TryGetValue(path, out occurrence);
        }

        internal void AddIssue(SqlAstTraversalIssue issue)
        {
            Segments.Add(new SqlAstCanonicalSegment(issue));
            if (issue.Kind == SqlAstTraversalIssueKind.NodeLimitExceeded ||
                issue.Kind == SqlAstTraversalIssueKind.CollectionSlotLimitExceeded)
            {
                TerminalIssue = issue;
                IsSealed = true;
            }
        }

        internal void Seal()
        {
            Parameters.Seal();
            IsSealed = true;
        }
    }

    /// <summary>
    /// One ledger is shared by every validation and traversal operation in a
    /// public validator call. Observations are occurrence-local (the logical
    /// collection path is the key), while each permitted slot is read once.
    /// </summary>
    internal sealed class SqlAstCollectionInspectionLedger
    {
        private static readonly object NullValue = new object();
        private readonly Dictionary<string, CollectionObservation> _collections =
            new Dictionary<string, CollectionObservation>(StringComparer.Ordinal);
        private int _inspectedSlots;
        private SqlAstTraversalIssue? _terminalIssue;
        private bool _terminalIssueReported;

        internal bool IsTerminal { get; private set; }

        internal bool TryTakeTerminalIssue(
            out SqlAstTraversalIssue issue)
        {
            if (!_terminalIssueReported && _terminalIssue.HasValue)
            {
                _terminalIssueReported = true;
                issue = _terminalIssue.Value;
                return true;
            }
            issue = default(SqlAstTraversalIssue);
            return false;
        }

        internal int GetCount<T>(IReadOnlyList<T> collection, string path)
        {
            if (collection == null || IsTerminal)
            {
                return 0;
            }

            return GetOrCreate(collection, path).Count;
        }

        internal bool TryObserve<T>(
            IReadOnlyList<T> collection,
            string collectionPath,
            int index,
            Action<SqlAstTraversalIssue> reportIssue,
            out T value)
        {
            value = default(T);
            if (collection == null || IsTerminal)
            {
                return false;
            }

            var observation = GetOrCreate(collection, collectionPath);
            if (index < 0 || index >= observation.Count)
            {
                return false;
            }

            if (index < observation.CachedPrefix.Count)
            {
                var cached = observation.CachedPrefix[index];
                value = ReferenceEquals(cached, NullValue)
                    ? default(T)
                    : (T)cached;
                return true;
            }

            if (index != observation.CachedPrefix.Count)
            {
                throw new InvalidOperationException(
                    "SQL AST collection slots must be observed in ascending order.");
            }

            var inspectedSlots = _inspectedSlots;
            if (inspectedSlots == 16384)
            {
                IsTerminal = true;
                observation.State =
                    SqlAstCollectionObservationState.TerminalIncomplete;
                _terminalIssue = new SqlAstTraversalIssue(
                    SqlAstTraversalIssueKind.CollectionSlotLimitExceeded,
                    Indexed(collectionPath, index));
                reportIssue(_terminalIssue.Value);
                return false;
            }

            value = collection[index];
            _inspectedSlots++;
            observation.CachedPrefix.Add(
                ReferenceEquals(value, null) ? NullValue : (object)value);
            if (observation.CachedPrefix.Count == observation.Count)
            {
                observation.State = SqlAstCollectionObservationState.Complete;
            }
            return true;
        }

        internal bool TryGetCompleteSnapshot<T>(
            string path,
            out SqlAstCollectionSnapshot<T> snapshot)
        {
            snapshot = default(SqlAstCollectionSnapshot<T>);
            if (!_collections.TryGetValue(path, out var observation) ||
                observation.ItemType != typeof(T) ||
                observation.State != SqlAstCollectionObservationState.Complete)
            {
                return false;
            }

            snapshot = new SqlAstCollectionSnapshot<T>(
                observation.Count,
                observation.CachedPrefix,
                NullValue);
            return true;
        }

        private CollectionObservation GetOrCreate<T>(
            IReadOnlyList<T> collection,
            string path)
        {
            if (!_collections.TryGetValue(path, out var observation))
            {
                observation = new CollectionObservation(
                    collection,
                    typeof(T),
                    collection.Count);
                _collections.Add(path, observation);
            }
            else if (!ReferenceEquals(observation.SourceReference, collection) ||
                     observation.ItemType != typeof(T))
            {
                throw new InvalidOperationException(
                    "SQL AST collection path was rebound to a different source or item type.");
            }
            return observation;
        }

        private static string Indexed(string path, int index)
        {
            return path + "[" +
                index.ToString(CultureInfo.InvariantCulture) + "]";
        }

        private sealed class CollectionObservation
        {
            internal CollectionObservation(
                object sourceReference,
                Type itemType,
                int count)
            {
                SourceReference = sourceReference;
                ItemType = itemType;
                Count = count;
                State = count == 0
                    ? SqlAstCollectionObservationState.Complete
                    : SqlAstCollectionObservationState.Observing;
            }

            internal object SourceReference { get; }
            internal Type ItemType { get; }
            internal int Count { get; }
            internal List<object> CachedPrefix { get; } =
                new List<object>();
            internal SqlAstCollectionObservationState State { get; set; }
        }
    }

    internal static class SqlAstTraversal
    {
        internal const int MaximumDepth = 128;
        internal const int MaximumNodeOccurrences = 4096;
        internal const int MaximumCollectionSlotInspections = 16384;

        internal static void Walk(
            SqlNode root,
            SqlAstInspectionSession session,
            Action<SqlAstOccurrence> visit,
            Action<SqlAstTraversalIssue> reportIssue)
        {
            Walk(
                root,
                "$",
                session,
                visit,
                reportIssue,
                reportTerminalIssue: true,
                reportMissingRequiredChild: null);
        }

        internal static void Walk(
            SqlNode root,
            string rootPath,
            SqlAstInspectionSession session,
            Action<SqlAstOccurrence> visit,
            Action<SqlAstTraversalIssue> reportIssue,
            bool reportTerminalIssue = true,
            Action<string> reportMissingRequiredChild = null)
        {
            if (root == null) throw new ArgumentNullException(nameof(root));
            if (rootPath == null) throw new ArgumentNullException(nameof(rootPath));
            if (session == null) throw new ArgumentNullException(nameof(session));
            if (visit == null) throw new ArgumentNullException(nameof(visit));
            if (reportIssue == null)
                throw new ArgumentNullException(nameof(reportIssue));

            var ledger = session.Ledger;
            var rootOccurrence = session.AddOccurrence(
                root, rootPath, 0, parentId: null);
            var stack = new Stack<TraversalFrame>();
            stack.Push(TraversalFrame.ForNode(rootOccurrence));
            var scheduledOccurrences = 1;

            while (stack.Count != 0)
            {
                if (ledger.IsTerminal)
                {
                    if (reportTerminalIssue)
                    {
                        ReportTerminalIssue(session, ledger, reportIssue);
                    }
                    session.Seal();
                    return;
                }
                var frame = stack.Pop();
                if (!frame.IsContinuation)
                {
                    var occurrence = frame.Occurrence;
                    occurrence.Phase = SqlAstOccurrencePhase.Entering;
                    if (!SqlAstTraversalCursor.TryCreate(
                        occurrence.Node, occurrence.Path, out var cursor))
                    {
                        occurrence.BaseState = SqlAstRetainedState.Invalid;
                        occurrence.FinalState = SqlAstRetainedState.Invalid;
                        occurrence.Phase = SqlAstOccurrencePhase.Closed;
                        var issue = new SqlAstTraversalIssue(
                            SqlAstTraversalIssueKind.UnknownNode,
                            occurrence.Path);
                        session.AddIssue(issue);
                        reportIssue(issue);
                        continue;
                    }

                    occurrence.Cursor = cursor;
                    occurrence.Phase = SqlAstOccurrencePhase.InspectingLocal;
                    visit(occurrence);
                    if (ledger.IsTerminal)
                    {
                        occurrence.Phase = SqlAstOccurrencePhase.TerminalCut;
                        if (reportTerminalIssue)
                        {
                            ReportTerminalIssue(session, ledger, reportIssue);
                        }
                        session.Seal();
                        return;
                    }

                    occurrence.Phase = SqlAstOccurrencePhase.LocalComplete;
                    stack.Push(TraversalFrame.ForContinuation(
                        occurrence));
                    continue;
                }

                frame.Occurrence.Phase =
                    SqlAstOccurrencePhase.ExpandingChildren;
                if (!frame.Cursor.TryMoveNext(
                    ledger, reportIssue, out var child))
                {
                    if (ledger.IsTerminal)
                    {
                        frame.Occurrence.Phase =
                            SqlAstOccurrencePhase.TerminalCut;
                        if (reportTerminalIssue)
                        {
                            ReportTerminalIssue(session, ledger, reportIssue);
                        }
                        session.Seal();
                        return;
                    }
                    frame.Occurrence.ExpansionComplete = true;
                    frame.Occurrence.Phase = SqlAstOccurrencePhase.Closed;
                    continue;
                }

                if (ledger.IsTerminal)
                {
                    frame.Occurrence.Phase = SqlAstOccurrencePhase.TerminalCut;
                    if (reportTerminalIssue)
                    {
                        ReportTerminalIssue(session, ledger, reportIssue);
                    }
                    session.Seal();
                    return;
                }

                stack.Push(frame);
                if (child.Node == null)
                {
                    frame.Occurrence.ChildEdges.Add(new SqlAstChildEdge(
                        child.Path, null, isNull: true, issue: null));
                    if (child.IsRequired &&
                        reportMissingRequiredChild != null)
                    {
                        reportMissingRequiredChild(child.Path);
                    }
                    continue;
                }

                var childDepth = frame.Occurrence.Depth + 1;
                // These literal prospective-schedule guards are part of the
                // traversal contract. Rejected children are never scheduled.
                if (childDepth > 128)
                {
                    var issue = new SqlAstTraversalIssue(
                        SqlAstTraversalIssueKind.DepthExceeded, child.Path);
                    frame.Occurrence.ChildEdges.Add(new SqlAstChildEdge(
                        child.Path, null, isNull: false, issue));
                    session.AddIssue(issue);
                    reportIssue(issue);
                    continue;
                }
                if (scheduledOccurrences == 4096)
                {
                    var issue = new SqlAstTraversalIssue(
                        SqlAstTraversalIssueKind.NodeLimitExceeded, child.Path);
                    frame.Occurrence.ChildEdges.Add(new SqlAstChildEdge(
                        child.Path, null, isNull: false, issue));
                    session.AddIssue(issue);
                    reportIssue(issue);
                    session.Seal();
                    return;
                }

                scheduledOccurrences++;
                var childOccurrence = session.AddOccurrence(
                    child.Node,
                    child.Path,
                    childDepth,
                    frame.Occurrence.Id);
                frame.Occurrence.ChildEdges.Add(new SqlAstChildEdge(
                    child.Path,
                    childOccurrence.Id,
                    isNull: false,
                    issue: null));
                stack.Push(TraversalFrame.ForNode(childOccurrence));
            }

            session.Seal();
        }

        /// <summary>
        /// Allocation has no validator-local rule pass, but it must charge
        /// every retained collection through the same occurrence-local
        /// ledger that the child cursor consumes. This observer deliberately
        /// performs only presence/read-once/budget work; it does not validate
        /// scalar values, collection shapes, duplicates, or cross-references.
        /// </summary>
        internal static void ObserveRetainedCollectionsForAllocation(
            SqlAstOccurrence occurrence,
            SqlAstCollectionInspectionLedger ledger,
            Action<SqlAstTraversalIssue> reportIssue,
            Action<string> reportMissingRequiredChild)
        {
            if (occurrence == null)
                throw new ArgumentNullException(nameof(occurrence));
            if (ledger == null)
                throw new ArgumentNullException(nameof(ledger));
            if (reportIssue == null)
                throw new ArgumentNullException(nameof(reportIssue));
            if (reportMissingRequiredChild == null)
                throw new ArgumentNullException(
                    nameof(reportMissingRequiredChild));

            var node = occurrence.Node;
            var path = occurrence.Path;

            switch (node)
            {
                case InExpression @in:
                    ObserveRetainedCollection(
                        @in.Values, path + ".Values", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case CaseExpression @case:
                    ObserveRetainedCollection(
                        @case.WhenClauses, path + ".WhenClauses", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case FunctionExpression function:
                    ObserveRetainedCollection(
                        function.Arguments, path + ".Arguments", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case KeysetPageSpec keyset:
                    ObserveRetainedCollection(
                        keyset.Boundaries, path + ".Boundaries", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case CommonTableExpression commonTableExpression:
                    ObserveRetainedCollection(
                        commonTableExpression.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case SelectStatement select:
                    ObserveRetainedCollection(
                        select.Projections, path + ".Projections", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        select.GroupBy, path + ".GroupBy", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        select.OrderBy, path + ".OrderBy", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        select.CommonTableExpressions,
                        path + ".CommonTableExpressions", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        select.SetOperations, path + ".SetOperations", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case SqlInsertRow row:
                    ObserveRetainedCollection(
                        row.Values, path + ".Values", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case ReturningClause returning:
                    ObserveRetainedCollection(
                        returning.Projections, path + ".Projections", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case InsertStatement insert:
                    ObserveRetainedCollection(
                        insert.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        insert.Rows, path + ".Rows", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case UpdateStatement update:
                    ObserveRetainedCollection(
                        update.Assignments, path + ".Assignments", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case UpsertStatement upsert:
                    ObserveRetainedCollection(
                        upsert.ConflictKeys, path + ".ConflictKeys", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        upsert.InsertAssignments,
                        path + ".InsertAssignments", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        upsert.UpdateAssignments,
                        path + ".UpdateAssignments", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case BulkInsertOperation bulk:
                    ObserveRetainedCollection(
                        bulk.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        bulk.Rows, path + ".Rows", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case IndexDefinition index:
                    ObserveRetainedCollection(
                        index.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case PrimaryKeyDefinition primaryKey:
                    ObserveRetainedCollection(
                        primaryKey.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case UniqueConstraintDefinition unique:
                    ObserveRetainedCollection(
                        unique.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case ForeignKeyColumnSet foreignKeyColumns:
                    ObserveRetainedCollection(
                        foreignKeyColumns.LocalColumns,
                        path + ".LocalColumns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        foreignKeyColumns.ReferencedColumns,
                        path + ".ReferencedColumns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case TableDefinition table:
                    ObserveRetainedCollection(
                        table.Columns, path + ".Columns", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        table.Constraints, path + ".Constraints", ledger,
                        reportIssue, reportMissingRequiredChild);
                    ObserveRetainedCollection(
                        table.Indexes, path + ".Indexes", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
                case MigrationPlan plan:
                    ObserveRetainedCollection(
                        plan.Steps, path + ".Steps", ledger,
                        reportIssue, reportMissingRequiredChild);
                    break;
            }
        }

        private static void ObserveRetainedCollection<T>(
            IReadOnlyList<T> collection,
            string path,
            SqlAstCollectionInspectionLedger ledger,
            Action<SqlAstTraversalIssue> reportIssue,
            Action<string> reportMissingRequiredChild)
            where T : class
        {
            if (collection == null)
            {
                reportMissingRequiredChild(path);
                return;
            }

            var count = ledger.GetCount(collection, path);
            for (var index = 0; index < count; index++)
            {
                if (!ledger.TryObserve(
                    collection,
                    path,
                    index,
                    reportIssue,
                    out T item))
                {
                    return;
                }
                if (item == null)
                {
                    reportMissingRequiredChild(Indexed(path, index));
                }
            }
        }

        private static string Indexed(string path, int index)
        {
            return path + "[" +
                index.ToString(CultureInfo.InvariantCulture) + "]";
        }

        private static void ReportTerminalIssue(
            SqlAstInspectionSession session,
            SqlAstCollectionInspectionLedger ledger,
            Action<SqlAstTraversalIssue> reportIssue)
        {
            if (ledger.TryTakeTerminalIssue(out var issue))
            {
                session.AddIssue(issue);
                reportIssue(issue);
            }
        }

        private readonly struct TraversalFrame
        {
            private TraversalFrame(
                SqlAstOccurrence occurrence,
                SqlAstTraversalCursor cursor,
                bool isContinuation)
            {
                Occurrence = occurrence;
                Cursor = cursor;
                IsContinuation = isContinuation;
            }

            internal SqlAstOccurrence Occurrence { get; }
            internal SqlAstTraversalCursor Cursor { get; }
            internal bool IsContinuation { get; }

            internal static TraversalFrame ForNode(SqlAstOccurrence occurrence)
            {
                return new TraversalFrame(occurrence, null, false);
            }

            internal static TraversalFrame ForContinuation(
                SqlAstOccurrence occurrence)
            {
                return new TraversalFrame(
                    occurrence, occurrence.Cursor, true);
            }
        }
    }

    internal readonly struct SqlAstTraversalCandidate
    {
        internal SqlAstTraversalCandidate(
            SqlNode node,
            string path,
            bool isRequired)
        {
            Node = node;
            Path = path;
            IsRequired = isRequired;
        }

        internal SqlNode Node { get; }
        internal string Path { get; }
        internal bool IsRequired { get; }
    }

    internal enum SqlAstTraversalCursorKind
    {
        Leaf,
        Binary,
        Unary,
        In,
        Between,
        Case,
        Cast,
        Subquery,
        Exists,
        Aggregate,
        Function,
        Derived,
        Join,
        Projection,
        OrderBy,
        Keyset,
        CommonTableExpression,
        SetOperation,
        Select,
        Assignment,
        InsertRow,
        Returning,
        Insert,
        Update,
        Delete,
        Upsert,
        BulkInsert,
        ColumnDefinition,
        ComputedGeneration,
        IndexDefinition,
        ForeignKeyDefinition,
        TableDefinition,
        SequenceOptions,
        SequenceDefinition,
        CreateSchema,
        DropSchema,
        CreateTable,
        AddColumn,
        AlterColumn,
        AddConstraint,
        CreateIndex,
        CreateSequence,
        AlterSequence,
        MigrationStep,
        MigrationPlan,
        ListTables
    }

    /// <summary>
    /// Explicit resumable child cursor. This is also the single exhaustive
    /// catalog of retained SQL AST node types.
    /// </summary>
    internal sealed class SqlAstTraversalCursor
    {
        private readonly SqlNode _node;
        private readonly string _path;
        private readonly SqlAstTraversalCursorKind _kind;
        private int _phase;
        private int _index;
        private CaseWhenClause _caseClause;

        private SqlAstTraversalCursor(
            SqlNode node,
            string path,
            SqlAstTraversalCursorKind kind)
        {
            _node = node;
            _path = path;
            _kind = kind;
        }

        internal static bool TryCreate(
            SqlNode node,
            string path,
            out SqlAstTraversalCursor cursor)
        {
            SqlAstTraversalCursorKind kind;
            switch (node)
            {
                case BinaryExpression _: kind = SqlAstTraversalCursorKind.Binary; break;
                case UnaryExpression _: kind = SqlAstTraversalCursorKind.Unary; break;
                case InExpression _: kind = SqlAstTraversalCursorKind.In; break;
                case BetweenExpression _: kind = SqlAstTraversalCursorKind.Between; break;
                case CaseExpression _: kind = SqlAstTraversalCursorKind.Case; break;
                case CastExpression _: kind = SqlAstTraversalCursorKind.Cast; break;
                case SubqueryExpression _: kind = SqlAstTraversalCursorKind.Subquery; break;
                case ExistsExpression _: kind = SqlAstTraversalCursorKind.Exists; break;
                case AggregateExpression _: kind = SqlAstTraversalCursorKind.Aggregate; break;
                case FunctionExpression _: kind = SqlAstTraversalCursorKind.Function; break;
                case DerivedTableSource _: kind = SqlAstTraversalCursorKind.Derived; break;
                case JoinSource _: kind = SqlAstTraversalCursorKind.Join; break;
                case SelectProjection _: kind = SqlAstTraversalCursorKind.Projection; break;
                case OrderByExpression _: kind = SqlAstTraversalCursorKind.OrderBy; break;
                case KeysetPageSpec _: kind = SqlAstTraversalCursorKind.Keyset; break;
                case CommonTableExpression _: kind = SqlAstTraversalCursorKind.CommonTableExpression; break;
                case SetOperationClause _: kind = SqlAstTraversalCursorKind.SetOperation; break;
                case SelectStatement _: kind = SqlAstTraversalCursorKind.Select; break;
                case SqlAssignment _: kind = SqlAstTraversalCursorKind.Assignment; break;
                case SqlInsertRow _: kind = SqlAstTraversalCursorKind.InsertRow; break;
                case ReturningClause _: kind = SqlAstTraversalCursorKind.Returning; break;
                case InsertStatement _: kind = SqlAstTraversalCursorKind.Insert; break;
                case UpdateStatement _: kind = SqlAstTraversalCursorKind.Update; break;
                case DeleteStatement _: kind = SqlAstTraversalCursorKind.Delete; break;
                case UpsertStatement _: kind = SqlAstTraversalCursorKind.Upsert; break;
                case BulkInsertOperation _: kind = SqlAstTraversalCursorKind.BulkInsert; break;
                case ColumnDefinition _: kind = SqlAstTraversalCursorKind.ColumnDefinition; break;
                case ComputedGenerationDefinition _: kind = SqlAstTraversalCursorKind.ComputedGeneration; break;
                case IndexDefinition _: kind = SqlAstTraversalCursorKind.IndexDefinition; break;
                case ForeignKeyDefinition _: kind = SqlAstTraversalCursorKind.ForeignKeyDefinition; break;
                case TableDefinition _: kind = SqlAstTraversalCursorKind.TableDefinition; break;
                case SequenceOptions _: kind = SqlAstTraversalCursorKind.SequenceOptions; break;
                case SequenceDefinition _: kind = SqlAstTraversalCursorKind.SequenceDefinition; break;
                case CreateSchemaOperation _: kind = SqlAstTraversalCursorKind.CreateSchema; break;
                case DropSchemaOperation _: kind = SqlAstTraversalCursorKind.DropSchema; break;
                case CreateTableOperation _: kind = SqlAstTraversalCursorKind.CreateTable; break;
                case AddColumnOperation _: kind = SqlAstTraversalCursorKind.AddColumn; break;
                case AlterColumnOperation _: kind = SqlAstTraversalCursorKind.AlterColumn; break;
                case AddConstraintOperation _: kind = SqlAstTraversalCursorKind.AddConstraint; break;
                case CreateIndexOperation _: kind = SqlAstTraversalCursorKind.CreateIndex; break;
                case CreateSequenceOperation _: kind = SqlAstTraversalCursorKind.CreateSequence; break;
                case AlterSequenceOperation _: kind = SqlAstTraversalCursorKind.AlterSequence; break;
                case MigrationStep _: kind = SqlAstTraversalCursorKind.MigrationStep; break;
                case MigrationPlan _: kind = SqlAstTraversalCursorKind.MigrationPlan; break;
                case ListTablesOperation _: kind = SqlAstTraversalCursorKind.ListTables; break;

                case ColumnExpression _:
                case ParameterExpression _:
                case NullExpression _:
                case BooleanExpression _:
                case WildcardExpression _:
                case NamedTableSource _:
                case OffsetPageSpec _:
                case LockSpec _:
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
                case PrimaryKeyDefinition _:
                case UniqueConstraintDefinition _:
                case ForeignKeyColumnSet _:
                case ReferentialActions _:
                case SequenceBounds _:
                case RenameTableOperation _:
                case DropTableOperation _:
                case RenameColumnOperation _:
                case DropColumnOperation _:
                case DropConstraintOperation _:
                case DropIndexOperation _:
                case DropSequenceOperation _:
                case SetTableCommentOperation _:
                case RemoveTableCommentOperation _:
                case SetColumnCommentOperation _:
                case RemoveColumnCommentOperation _:
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
                    kind = SqlAstTraversalCursorKind.Leaf;
                    break;
                default:
                    cursor = null;
                    return false;
            }

            cursor = new SqlAstTraversalCursor(node, path, kind);
            return true;
        }

        internal bool TryMoveNext(
            SqlAstCollectionInspectionLedger ledger,
            Action<SqlAstTraversalIssue> reportIssue,
            out SqlAstTraversalCandidate child)
        {
            child = default(SqlAstTraversalCandidate);
            switch (_kind)
            {
                case SqlAstTraversalCursorKind.Leaf:
                    return false;
                case SqlAstTraversalCursorKind.Binary:
                    return NextBinary((BinaryExpression)_node, out child);
                case SqlAstTraversalCursorKind.Unary:
                    return NextSingle(
                        ((UnaryExpression)_node).Operand,
                        ".Operand",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.In:
                    return NextIn((InExpression)_node, ledger, out child);
                case SqlAstTraversalCursorKind.Between:
                    return NextBetween((BetweenExpression)_node, out child);
                case SqlAstTraversalCursorKind.Case:
                    return NextCase((CaseExpression)_node, ledger, out child);
                case SqlAstTraversalCursorKind.Cast:
                    return NextSingle(
                        ((CastExpression)_node).Expression,
                        ".Expression",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Subquery:
                    return NextSingle(
                        ((SubqueryExpression)_node).Query,
                        ".Query",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Exists:
                    return NextSingle(
                        ((ExistsExpression)_node).Subquery,
                        ".Subquery",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Aggregate:
                    return NextSingle(
                        ((AggregateExpression)_node).Argument,
                        ".Argument",
                        isRequired: false,
                        out child);
                case SqlAstTraversalCursorKind.Function:
                    return NextCollection<SqlExpression>(".Arguments", ledger, out child);
                case SqlAstTraversalCursorKind.Derived:
                    return NextSingle(
                        ((DerivedTableSource)_node).Query,
                        ".Query",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Join:
                    return NextJoin((JoinSource)_node, out child);
                case SqlAstTraversalCursorKind.Projection:
                    return NextSingle(
                        ((SelectProjection)_node).Expression,
                        ".Expression",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.OrderBy:
                    return NextSingle(
                        ((OrderByExpression)_node).Expression,
                        ".Expression",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Keyset:
                    return NextCollection<SqlExpression>(".Boundaries", ledger, out child);
                case SqlAstTraversalCursorKind.CommonTableExpression:
                    return NextSingle(
                        ((CommonTableExpression)_node).Query,
                        ".Query",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.SetOperation:
                    return NextSingle(
                        ((SetOperationClause)_node).RightQuery,
                        ".RightQuery",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.Select:
                    return NextSelect((SelectStatement)_node, ledger, out child);
                case SqlAstTraversalCursorKind.Assignment:
                    return NextSingle(
                        ((SqlAssignment)_node).Value,
                        ".Value",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.InsertRow:
                    return NextCollection<SqlExpression>(".Values", ledger, out child);
                case SqlAstTraversalCursorKind.Returning:
                    return NextCollection<SelectProjection>(".Projections", ledger, out child);
                case SqlAstTraversalCursorKind.Insert:
                    return NextInsert((InsertStatement)_node, ledger, out child);
                case SqlAstTraversalCursorKind.Update:
                    return NextUpdate((UpdateStatement)_node, ledger, out child);
                case SqlAstTraversalCursorKind.Delete:
                    return NextDelete((DeleteStatement)_node, out child);
                case SqlAstTraversalCursorKind.Upsert:
                    return NextUpsert((UpsertStatement)_node, ledger, out child);
                case SqlAstTraversalCursorKind.BulkInsert:
                    return NextCollection<SqlInsertRow>(".Rows", ledger, out child);
                case SqlAstTraversalCursorKind.ColumnDefinition:
                    return NextColumn((ColumnDefinition)_node, out child);
                case SqlAstTraversalCursorKind.ComputedGeneration:
                    return NextSingle(
                        ((ComputedGenerationDefinition)_node).Expression,
                        ".Expression",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.IndexDefinition:
                    return NextCollection<IndexColumnDefinition>(".Columns", ledger, out child);
                case SqlAstTraversalCursorKind.ForeignKeyDefinition:
                    return NextForeignKey((ForeignKeyDefinition)_node, out child);
                case SqlAstTraversalCursorKind.TableDefinition:
                    return NextTable((TableDefinition)_node, ledger, out child);
                case SqlAstTraversalCursorKind.SequenceOptions:
                    return NextSingle(
                        ((SequenceOptions)_node).Bounds,
                        ".Bounds",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.SequenceDefinition:
                    return NextSingle(
                        ((SequenceDefinition)_node).Options,
                        ".Options",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.CreateSchema:
                    return NextSingle(
                        ((CreateSchemaOperation)_node).Schema,
                        ".Schema",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.DropSchema:
                    return NextSingle(
                        ((DropSchemaOperation)_node).Schema,
                        ".Schema",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.CreateTable:
                    return NextSingle(
                        ((CreateTableOperation)_node).Table,
                        ".Table",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.AddColumn:
                    return NextSingle(
                        ((AddColumnOperation)_node).Column,
                        ".Column",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.AlterColumn:
                    return NextPair(
                        ((AlterColumnOperation)_node).Before,
                        ".Before",
                        firstRequired: true,
                        ((AlterColumnOperation)_node).After,
                        ".After",
                        secondRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.AddConstraint:
                    return NextSingle(
                        ((AddConstraintOperation)_node).Constraint,
                        ".Constraint",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.CreateIndex:
                    return NextSingle(
                        ((CreateIndexOperation)_node).Index,
                        ".Index",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.CreateSequence:
                    return NextSingle(
                        ((CreateSequenceOperation)_node).Sequence,
                        ".Sequence",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.AlterSequence:
                    return NextPair(
                        ((AlterSequenceOperation)_node).Before,
                        ".Before",
                        firstRequired: true,
                        ((AlterSequenceOperation)_node).After,
                        ".After",
                        secondRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.MigrationStep:
                    return NextSingle(
                        ((MigrationStep)_node).Operation,
                        ".Operation",
                        isRequired: true,
                        out child);
                case SqlAstTraversalCursorKind.MigrationPlan:
                    return NextCollection<MigrationStep>(".Steps", ledger, out child);
                case SqlAstTraversalCursorKind.ListTables:
                    return NextSingle(
                        ((ListTablesOperation)_node).Scope,
                        ".Scope",
                        isRequired: true,
                        out child);
                default:
                    throw new InvalidOperationException("Unknown SQL AST traversal cursor kind.");
            }
        }

        private bool NextSingle(
            SqlNode node,
            string suffix,
            bool isRequired,
            out SqlAstTraversalCandidate child)
        {
            if (_phase != 0)
            {
                child = default(SqlAstTraversalCandidate);
                return false;
            }
            _phase = 1;
            child = new SqlAstTraversalCandidate(
                node, _path + suffix, isRequired);
            return true;
        }

        private bool NextPair(
            SqlNode first,
            string firstSuffix,
            bool firstRequired,
            SqlNode second,
            string secondSuffix,
            bool secondRequired,
            out SqlAstTraversalCandidate child)
        {
            if (_phase == 0)
            {
                _phase = 1;
                child = new SqlAstTraversalCandidate(
                    first, _path + firstSuffix, firstRequired);
                return true;
            }
            if (_phase == 1)
            {
                _phase = 2;
                child = new SqlAstTraversalCandidate(
                    second, _path + secondSuffix, secondRequired);
                return true;
            }
            child = default(SqlAstTraversalCandidate);
            return false;
        }

        private bool NextBinary(BinaryExpression node, out SqlAstTraversalCandidate child)
        {
            return NextPair(
                node.Left,
                ".Left",
                firstRequired: true,
                node.Right,
                ".Right",
                secondRequired: true,
                out child);
        }

        private bool NextBetween(BetweenExpression node, out SqlAstTraversalCandidate child)
        {
            if (_phase == 0)
            {
                _phase = 1;
                child = new SqlAstTraversalCandidate(
                    node.Operand, _path + ".Operand", isRequired: true);
                return true;
            }
            if (_phase == 1)
            {
                _phase = 2;
                child = new SqlAstTraversalCandidate(
                    node.Lower, _path + ".Lower", isRequired: true);
                return true;
            }
            if (_phase == 2)
            {
                _phase = 3;
                child = new SqlAstTraversalCandidate(
                    node.Upper, _path + ".Upper", isRequired: true);
                return true;
            }
            child = default(SqlAstTraversalCandidate);
            return false;
        }

        private bool NextIn(
            InExpression node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            if (_phase == 0)
            {
                _phase = 1;
                child = new SqlAstTraversalCandidate(
                    node.Operand, _path + ".Operand", isRequired: true);
                return true;
            }
            return NextCollection<SqlExpression>(".Values", ledger, out child);
        }

        private bool NextCase(
            CaseExpression node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            if (_phase == 0)
            {
                _phase = 1;
                child = new SqlAstTraversalCandidate(
                    node.InputExpression,
                    _path + ".InputExpression",
                    isRequired: false);
                return true;
            }

            var collectionPath = _path + ".WhenClauses";
            while (_phase == 1)
            {
                if (_caseClause != null)
                {
                    _phase = 2;
                    child = new SqlAstTraversalCandidate(
                        _caseClause.Then,
                        Indexed(collectionPath, _index - 1) + ".Then",
                        isRequired: true);
                    return true;
                }

                if (!ledger.TryGetCompleteSnapshot<CaseWhenClause>(
                        collectionPath, out var clauses) ||
                    _index >= clauses.Count)
                {
                    _phase = 3;
                    break;
                }
                var itemIndex = _index++;
                _caseClause = clauses[itemIndex];
                if (_caseClause == null)
                {
                    continue;
                }
                child = new SqlAstTraversalCandidate(
                    _caseClause.When,
                    Indexed(collectionPath, itemIndex) + ".When",
                    isRequired: true);
                return true;
            }

            if (_phase == 2)
            {
                _caseClause = null;
                _phase = 1;
                return NextCase(node, ledger, out child);
            }
            if (_phase == 3)
            {
                _phase = 4;
                child = new SqlAstTraversalCandidate(
                    node.ElseExpression,
                    _path + ".ElseExpression",
                    isRequired: false);
                return true;
            }
            child = default(SqlAstTraversalCandidate);
            return false;
        }

        private bool NextJoin(JoinSource node, out SqlAstTraversalCandidate child)
        {
            if (_phase == 0)
            {
                _phase = 1;
                child = new SqlAstTraversalCandidate(
                    node.Left, _path + ".Left", isRequired: true);
                return true;
            }
            if (_phase == 1)
            {
                _phase = 2;
                child = new SqlAstTraversalCandidate(
                    node.Right, _path + ".Right", isRequired: true);
                return true;
            }
            if (_phase == 2)
            {
                _phase = 3;
                child = new SqlAstTraversalCandidate(
                    node.Condition,
                    _path + ".Condition",
                    isRequired: false);
                return true;
            }
            child = default(SqlAstTraversalCandidate);
            return false;
        }

        private bool NextSelect(
            SelectStatement node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            while (true)
            {
                switch (_phase)
                {
                    case 0:
                        _phase = 1;
                        child = new SqlAstTraversalCandidate(
                            node.From, _path + ".From", isRequired: false);
                        return true;
                    case 1:
                        if (NextCollection<SelectProjection>(".Projections", ledger, out child)) return true;
                        _phase = 2; _index = 0; continue;
                    case 2:
                        _phase = 3;
                        child = new SqlAstTraversalCandidate(
                            node.Where, _path + ".Where", isRequired: false);
                        return true;
                    case 3:
                        if (NextCollection<SqlExpression>(".GroupBy", ledger, out child)) return true;
                        _phase = 4; _index = 0; continue;
                    case 4:
                        _phase = 5;
                        child = new SqlAstTraversalCandidate(
                            node.Having, _path + ".Having", isRequired: false);
                        return true;
                    case 5:
                        if (NextCollection<OrderByExpression>(".OrderBy", ledger, out child)) return true;
                        _phase = 6; _index = 0; continue;
                    case 6:
                        _phase = 7;
                        child = new SqlAstTraversalCandidate(
                            node.Page, _path + ".Page", isRequired: false);
                        return true;
                    case 7:
                        _phase = 8;
                        child = new SqlAstTraversalCandidate(
                            node.Lock, _path + ".Lock", isRequired: false);
                        return true;
                    case 8:
                        if (NextCollection<CommonTableExpression>(".CommonTableExpressions", ledger, out child)) return true;
                        _phase = 9; _index = 0; continue;
                    case 9:
                        if (NextCollection<SetOperationClause>(".SetOperations", ledger, out child)) return true;
                        _phase = 10; continue;
                    default:
                        child = default(SqlAstTraversalCandidate);
                        return false;
                }
            }
        }

        private bool NextInsert(
            InsertStatement node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            while (true)
            {
                if (_phase == 0)
                {
                    if (NextCollection<SqlInsertRow>(".Rows", ledger, out child)) return true;
                    _phase = 1; _index = 0; continue;
                }
                if (_phase == 1)
                {
                    _phase = 2;
                    child = new SqlAstTraversalCandidate(
                        node.Source, _path + ".Source", isRequired: false);
                    return true;
                }
                if (_phase == 2)
                {
                    _phase = 3;
                    child = new SqlAstTraversalCandidate(
                        node.Returning,
                        _path + ".Returning",
                        isRequired: false);
                    return true;
                }
                child = default(SqlAstTraversalCandidate);
                return false;
            }
        }

        private bool NextUpdate(
            UpdateStatement node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            while (true)
            {
                if (_phase == 0)
                {
                    if (NextCollection<SqlAssignment>(".Assignments", ledger, out child)) return true;
                    _phase = 1; _index = 0; continue;
                }
                if (_phase == 1)
                {
                    _phase = 2;
                    child = new SqlAstTraversalCandidate(
                        node.Where, _path + ".Where", isRequired: false);
                    return true;
                }
                if (_phase == 2)
                {
                    _phase = 3;
                    child = new SqlAstTraversalCandidate(
                        node.Returning,
                        _path + ".Returning",
                        isRequired: false);
                    return true;
                }
                child = default(SqlAstTraversalCandidate);
                return false;
            }
        }

        private bool NextDelete(DeleteStatement node, out SqlAstTraversalCandidate child)
        {
            return NextPair(
                node.Where,
                ".Where",
                firstRequired: false,
                node.Returning,
                ".Returning",
                secondRequired: false,
                out child);
        }

        private bool NextUpsert(
            UpsertStatement node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            while (true)
            {
                if (_phase == 0)
                {
                    if (NextCollection<SqlAssignment>(".InsertAssignments", ledger, out child)) return true;
                    _phase = 1; _index = 0; continue;
                }
                if (_phase == 1)
                {
                    if (NextCollection<SqlAssignment>(".UpdateAssignments", ledger, out child)) return true;
                    _phase = 2; _index = 0; continue;
                }
                if (_phase == 2)
                {
                    _phase = 3;
                    child = new SqlAstTraversalCandidate(
                        node.Returning,
                        _path + ".Returning",
                        isRequired: false);
                    return true;
                }
                child = default(SqlAstTraversalCandidate);
                return false;
            }
        }

        private bool NextColumn(ColumnDefinition node, out SqlAstTraversalCandidate child)
        {
            return NextPair(
                node.Generation,
                ".Generation",
                firstRequired: false,
                node.DefaultValue,
                ".DefaultValue",
                secondRequired: false,
                out child);
        }

        private bool NextForeignKey(ForeignKeyDefinition node, out SqlAstTraversalCandidate child)
        {
            return NextPair(
                node.Columns,
                ".Columns",
                firstRequired: true,
                node.Actions,
                ".Actions",
                secondRequired: true,
                out child);
        }

        private bool NextTable(
            TableDefinition node,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
        {
            while (true)
            {
                if (_phase == 0)
                {
                    if (NextCollection<ColumnDefinition>(".Columns", ledger, out child)) return true;
                    _phase = 1; _index = 0; continue;
                }
                if (_phase == 1)
                {
                    if (NextCollection<ConstraintDefinition>(".Constraints", ledger, out child)) return true;
                    _phase = 2; _index = 0; continue;
                }
                if (_phase == 2)
                {
                    if (NextCollection<IndexDefinition>(".Indexes", ledger, out child)) return true;
                    _phase = 3; _index = 0; continue;
                }
                child = default(SqlAstTraversalCandidate);
                return false;
            }
        }

        private bool NextCollection<T>(
            string suffix,
            SqlAstCollectionInspectionLedger ledger,
            out SqlAstTraversalCandidate child)
            where T : SqlNode
        {
            var collectionPath = _path + suffix;
            if (!ledger.TryGetCompleteSnapshot<T>(
                    collectionPath, out var snapshot) ||
                _index >= snapshot.Count)
            {
                child = default(SqlAstTraversalCandidate);
                return false;
            }

            var itemIndex = _index++;
            var node = snapshot[itemIndex];
            child = new SqlAstTraversalCandidate(
                node,
                Indexed(collectionPath, itemIndex),
                isRequired: true);
            return true;
        }

        private static string Indexed(string path, int index)
        {
            return path + "[" +
                index.ToString(CultureInfo.InvariantCulture) + "]";
        }
    }
}
