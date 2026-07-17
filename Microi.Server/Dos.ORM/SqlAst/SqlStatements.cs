using System;
using System.Collections.Generic;

namespace Dos.ORM.SqlAst
{
    public enum ConflictPolicy
    {
        UpdateExisting,
        DoNothing
    }

    public sealed class SqlAssignment : SqlNode
    {
        public SqlAssignment(SqlIdentifier column, SqlExpression value)
        {
            Column = column ?? throw new ArgumentNullException(nameof(column));
            Value = value ?? throw new ArgumentNullException(nameof(value));
        }

        public SqlIdentifier Column { get; }

        public SqlExpression Value { get; }
    }

    public sealed class SqlInsertRow : SqlNode
    {
        public SqlInsertRow(IEnumerable<SqlExpression> values)
        {
            Values = SqlAstCollection.Copy(
                values, nameof(values), allowEmpty: false);
        }

        public IReadOnlyList<SqlExpression> Values { get; }
    }

    /// <summary>
    /// Describes the projections returned for rows affected by a data-modification
    /// statement.
    /// </summary>
    /// <remarks>
    /// Insert, update, and upsert return the written row image; delete returns the
    /// row image that existed immediately before deletion. An upsert conflict with
    /// <see cref="ConflictPolicy.DoNothing"/> returns zero rows. Results from a
    /// multi-row modification have no defined order. A compiler must reject a
    /// returning request when its dialect cannot preserve these semantics atomically;
    /// it must not emulate returning with an unlocked write followed by a read.
    /// </remarks>
    public sealed class ReturningClause : SqlNode
    {
        public ReturningClause(IEnumerable<SelectProjection> projections)
        {
            Projections = SqlAstCollection.Copy(
                projections, nameof(projections), allowEmpty: false);
        }

        public IReadOnlyList<SelectProjection> Projections { get; }
    }

    public sealed class InsertStatement : SqlStatement
    {
        private InsertStatement(
            SqlObjectName table,
            IEnumerable<SqlIdentifier> columns,
            IEnumerable<SqlInsertRow> rows,
            SelectStatement source,
            ReturningClause returning)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Columns = DmlAstGuard.CopyUniqueIdentifiers(
                columns, nameof(columns), allowEmpty: false);
            Source = source;
            Rows = SqlAstCollection.Copy(
                rows,
                nameof(rows),
                allowEmpty: source != null);
            DmlAstGuard.ValidateRowArity(
                Rows, Columns.Count, nameof(rows));
            Returning = returning;
        }

        public static InsertStatement Values(
            SqlObjectName table,
            IEnumerable<SqlIdentifier> columns,
            IEnumerable<SqlInsertRow> rows,
            ReturningClause returning = null)
        {
            return new InsertStatement(
                table, columns, rows, null, returning);
        }

        public static InsertStatement FromSelect(
            SqlObjectName table,
            IEnumerable<SqlIdentifier> columns,
            SelectStatement source,
            ReturningClause returning = null)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }

            return new InsertStatement(
                table,
                columns,
                Array.Empty<SqlInsertRow>(),
                source,
                returning);
        }

        public SqlObjectName Table { get; }

        public IReadOnlyList<SqlIdentifier> Columns { get; }

        public IReadOnlyList<SqlInsertRow> Rows { get; }

        public SelectStatement Source { get; }

        public ReturningClause Returning { get; }
    }

    public sealed class UpdateStatement : SqlStatement
    {
        public UpdateStatement(
            SqlObjectName table,
            IEnumerable<SqlAssignment> assignments,
            SqlExpression where = null,
            bool allowAllRows = false,
            ReturningClause returning = null)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Assignments = DmlAstGuard.CopyUniqueAssignments(
                assignments, nameof(assignments), allowEmpty: false);
            DmlAstGuard.RequireSafeWritePredicate(
                where, allowAllRows, nameof(where));
            Where = where;
            AllowAllRows = allowAllRows;
            Returning = returning;
        }

        public SqlObjectName Table { get; }

        public IReadOnlyList<SqlAssignment> Assignments { get; }

        public SqlExpression Where { get; }

        public bool AllowAllRows { get; }

        public ReturningClause Returning { get; }
    }

    public sealed class DeleteStatement : SqlStatement
    {
        public DeleteStatement(
            SqlObjectName table,
            SqlExpression where = null,
            bool allowAllRows = false,
            ReturningClause returning = null)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            DmlAstGuard.RequireSafeWritePredicate(
                where, allowAllRows, nameof(where));
            Where = where;
            AllowAllRows = allowAllRows;
            Returning = returning;
        }

        public SqlObjectName Table { get; }

        public SqlExpression Where { get; }

        public bool AllowAllRows { get; }

        public ReturningClause Returning { get; }
    }

    public sealed class UpsertStatement : SqlStatement
    {
        public UpsertStatement(
            SqlObjectName table,
            IEnumerable<SqlIdentifier> conflictKeys,
            IEnumerable<SqlAssignment> insertAssignments,
            IEnumerable<SqlAssignment> updateAssignments,
            ConflictPolicy policy = ConflictPolicy.UpdateExisting,
            ReturningClause returning = null)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            if (!Enum.IsDefined(typeof(ConflictPolicy), policy))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(policy), "Conflict policy must be defined.");
            }

            ConflictKeys = DmlAstGuard.CopyUniqueIdentifiers(
                conflictKeys, nameof(conflictKeys), allowEmpty: false);
            InsertAssignments = DmlAstGuard.CopyUniqueAssignments(
                insertAssignments,
                nameof(insertAssignments),
                allowEmpty: false);
            UpdateAssignments = DmlAstGuard.CopyUniqueAssignments(
                updateAssignments,
                nameof(updateAssignments),
                allowEmpty: true);

            var insertColumns = new HashSet<SqlIdentifier>();
            foreach (var assignment in InsertAssignments)
            {
                insertColumns.Add(assignment.Column);
            }

            var conflictColumns = new HashSet<SqlIdentifier>();
            foreach (var conflictKey in ConflictKeys)
            {
                if (!insertColumns.Contains(conflictKey))
                {
                    throw new ArgumentException(
                        "Every conflict key must have an insert assignment.",
                        nameof(conflictKeys));
                }

                conflictColumns.Add(conflictKey);
            }

            foreach (var assignment in UpdateAssignments)
            {
                if (conflictColumns.Contains(assignment.Column))
                {
                    throw new ArgumentException(
                        "Conflict-key columns cannot be update targets.",
                        nameof(updateAssignments));
                }
            }

            if (policy == ConflictPolicy.UpdateExisting &&
                UpdateAssignments.Count == 0)
            {
                throw new ArgumentException(
                    "UpdateExisting requires at least one update assignment.",
                    nameof(updateAssignments));
            }

            if (policy == ConflictPolicy.DoNothing &&
                UpdateAssignments.Count != 0)
            {
                throw new ArgumentException(
                    "DoNothing requires an empty update assignment list.",
                    nameof(updateAssignments));
            }

            Policy = policy;
            Returning = returning;
        }

        public SqlObjectName Table { get; }

        public IReadOnlyList<SqlIdentifier> ConflictKeys { get; }

        public IReadOnlyList<SqlAssignment> InsertAssignments { get; }

        public IReadOnlyList<SqlAssignment> UpdateAssignments { get; }

        public ConflictPolicy Policy { get; }

        public ReturningClause Returning { get; }
    }

    public sealed class BulkInsertOperation : SqlStatement
    {
        public BulkInsertOperation(
            SqlObjectName table,
            IEnumerable<SqlIdentifier> columns,
            IEnumerable<SqlInsertRow> rows,
            int batchSize)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            if (batchSize <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(batchSize), "Batch size maximum must be positive.");
            }

            Columns = DmlAstGuard.CopyUniqueIdentifiers(
                columns, nameof(columns), allowEmpty: false);
            Rows = SqlAstCollection.Copy(
                rows, nameof(rows), allowEmpty: false);
            DmlAstGuard.ValidateRowArity(
                Rows, Columns.Count, nameof(rows));
            BatchSize = batchSize;
        }

        public SqlObjectName Table { get; }

        public IReadOnlyList<SqlIdentifier> Columns { get; }

        public IReadOnlyList<SqlInsertRow> Rows { get; }

        public int BatchSize { get; }
    }

    internal static class DmlAstGuard
    {
        public static IReadOnlyList<SqlIdentifier> CopyUniqueIdentifiers(
            IEnumerable<SqlIdentifier> identifiers,
            string parameterName,
            bool allowEmpty)
        {
            var copy = SqlAstCollection.Copy(
                identifiers, parameterName, allowEmpty);
            var seen = new HashSet<SqlIdentifier>();
            foreach (var identifier in copy)
            {
                if (!seen.Add(identifier))
                {
                    throw new ArgumentException(
                        "Collection cannot contain duplicate identifiers.",
                        parameterName);
                }
            }

            return copy;
        }

        public static IReadOnlyList<SqlAssignment> CopyUniqueAssignments(
            IEnumerable<SqlAssignment> assignments,
            string parameterName,
            bool allowEmpty)
        {
            var copy = SqlAstCollection.Copy(
                assignments, parameterName, allowEmpty);
            var seen = new HashSet<SqlIdentifier>();
            foreach (var assignment in copy)
            {
                if (!seen.Add(assignment.Column))
                {
                    throw new ArgumentException(
                        "Assignments cannot target duplicate columns.",
                        parameterName);
                }
            }

            return copy;
        }

        public static void ValidateRowArity(
            IReadOnlyList<SqlInsertRow> rows,
            int columnCount,
            string parameterName)
        {
            foreach (var row in rows)
            {
                if (row.Values.Count != columnCount)
                {
                    throw new ArgumentException(
                        "Every row must match the target column count.",
                        parameterName);
                }
            }
        }

        public static void RequireSafeWritePredicate(
            SqlExpression where,
            bool allowAllRows,
            string parameterName)
        {
            if (!allowAllRows &&
                (where == null ||
                 ReferenceEquals(where, BooleanExpression.True)))
            {
                throw new ArgumentException(
                    "Full-table writes require explicit opt-in.",
                    parameterName);
            }
        }
    }
}
