using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    public sealed class SqlAstValidationException : InvalidOperationException
    {
        internal SqlAstValidationException(
            DialectProfile profile,
            IReadOnlyList<SqlAstDiagnostic> diagnostics)
            : this(CreateState(profile, diagnostics))
        {
        }

        private SqlAstValidationException(ExceptionState state)
            : base(state.Message)
        {
            DatabaseType = state.DatabaseType;
            ServerVersion = state.ServerVersion;
            CompatibilityMode = state.CompatibilityMode;
            Feature = state.Feature;
            NodePath = state.NodePath;
            Diagnostics = state.Diagnostics;
        }

        public DatabaseType DatabaseType { get; }

        public Version ServerVersion { get; }

        public string CompatibilityMode { get; }

        public string Feature { get; }

        public string NodePath { get; }

        public IReadOnlyList<SqlAstDiagnostic> Diagnostics { get; }

        private static ExceptionState CreateState(
            DialectProfile profile,
            IReadOnlyList<SqlAstDiagnostic> diagnostics)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }
            if (diagnostics == null)
            {
                throw new ArgumentNullException(nameof(diagnostics));
            }
            if (diagnostics.Count == 0)
            {
                throw new ArgumentException(
                    "At least one SQL AST diagnostic is required.",
                    nameof(diagnostics));
            }

            var copy = new List<SqlAstDiagnostic>(diagnostics.Count);
            for (var index = 0; index < diagnostics.Count; index++)
            {
                var diagnostic = diagnostics[index];
                if (diagnostic == null)
                {
                    throw new ArgumentException(
                        "Diagnostics cannot contain null.",
                        nameof(diagnostics));
                }
                string safeMessage;
                if (!SqlAstDiagnosticCatalog.TryGetMessage(
                        diagnostic.Code, out safeMessage))
                {
                    throw new ArgumentException(
                        "Diagnostic code is not in the compiler safe catalog.",
                        nameof(diagnostics));
                }
                UnsupportedDatabaseCapabilityException.EnsureStructuralNodePath(
                    diagnostic.Path, nameof(diagnostics));
                copy.Add(new SqlAstDiagnostic(
                    diagnostic.Code,
                    safeMessage,
                    diagnostic.Path));
            }
            copy.Sort(SqlAstDiagnosticComparer.Instance);

            var snapshot = new ReadOnlyCollection<SqlAstDiagnostic>(copy);
            var first = snapshot[0];
            var version = UnsupportedDatabaseCapabilityException.CopyVersion(
                profile.ServerVersion);
            var message = "SQL AST validation failed"
                + " (DatabaseType=" + profile.DatabaseType
                + ", ServerVersion=" + version
                + ", CompatibilityMode=" + profile.CompatibilityMode
                + ", Feature=" + first.Code
                + ", NodePath=" + first.Path
                + ", DiagnosticCount=" + snapshot.Count + ").";
            return new ExceptionState(
                profile.DatabaseType,
                version,
                profile.CompatibilityMode,
                first.Code,
                first.Path,
                snapshot,
                message);
        }

        private sealed class SqlAstDiagnosticComparer
            : IComparer<SqlAstDiagnostic>
        {
            internal static readonly SqlAstDiagnosticComparer Instance =
                new SqlAstDiagnosticComparer();

            public int Compare(SqlAstDiagnostic left, SqlAstDiagnostic right)
            {
                if (ReferenceEquals(left, right))
                {
                    return 0;
                }
                if (left == null)
                {
                    return -1;
                }
                if (right == null)
                {
                    return 1;
                }
                var path = string.CompareOrdinal(left.Path, right.Path);
                if (path != 0)
                {
                    return path;
                }
                return string.CompareOrdinal(left.Code, right.Code);
            }
        }

        private sealed class ExceptionState
        {
            internal ExceptionState(
                DatabaseType databaseType,
                Version serverVersion,
                string compatibilityMode,
                string feature,
                string nodePath,
                IReadOnlyList<SqlAstDiagnostic> diagnostics,
                string message)
            {
                DatabaseType = databaseType;
                ServerVersion = serverVersion;
                CompatibilityMode = compatibilityMode;
                Feature = feature;
                NodePath = nodePath;
                Diagnostics = diagnostics;
                Message = message;
            }

            internal DatabaseType DatabaseType { get; }
            internal Version ServerVersion { get; }
            internal string CompatibilityMode { get; }
            internal string Feature { get; }
            internal string NodePath { get; }
            internal IReadOnlyList<SqlAstDiagnostic> Diagnostics { get; }
            internal string Message { get; }
        }
    }

    internal static class SqlAstDiagnosticCatalog
    {
        internal static bool TryGetMessage(string code, out string message)
        {
            switch (code)
            {
                case "AST_UNKNOWN_NODE": message = "SQL AST contains an unknown node subtype."; return true;
                case "AST_REQUIRED_CHILD_MISSING": message = "SQL AST contains a missing required child."; return true;
                case "AST_TRAVERSAL_DEPTH_EXCEEDED": message = "SQL AST traversal exceeds maximum depth 128."; return true;
                case "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED": message = "SQL AST traversal exceeds maximum node occurrence count 4096."; return true;
                case "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED": message = "SQL AST traversal exceeds maximum collection slot inspection count 16384."; return true;
                case "AST_INVALID_IDENTIFIER": message = "SQL identifier is not one valid unquoted segment."; return true;
                case "AST_UNDEFINED_ENUM": message = "SQL AST contains an undefined enumeration value."; return true;
                case "AST_SCALAR_INVALID": message = "SQL AST scalar value is invalid."; return true;
                case "AST_STRUCTURAL_SHAPE_INVALID": message = "SQL AST structural shape is invalid."; return true;
                case "AST_COLLECTION_EMPTY": message = "Required SQL AST collection is empty."; return true;
                case "AST_COLLECTION_NULL_ITEM": message = "SQL AST collection contains a null item."; return true;
                case "AST_COLLECTION_DUPLICATE": message = "SQL AST collection contains a duplicate logical name."; return true;
                case "AST_JOIN_CONDITION_REQUIRED": message = "Non-cross join requires a condition."; return true;
                case "AST_JOIN_CONDITION_FORBIDDEN": message = "Cross join cannot have a condition."; return true;
                case "AST_SUBQUERY_SELECT_REQUIRED": message = "Subquery must contain a SelectStatement."; return true;
                case "AST_FUNCTION_NOT_REGISTERED": message = "Function must use the registered semantic catalog instance."; return true;
                case "AST_FUNCTION_ARITY": message = "Function argument count is outside its semantic contract."; return true;
                case "AST_AGGREGATE_FUNCTION_REQUIRED": message = "Aggregate must use a registered aggregate semantic function."; return true;
                case "AST_AGGREGATE_ARITY": message = "Aggregate argument count is outside its semantic contract."; return true;
                case "AST_AGGREGATE_DISTINCT_ARGUMENT_REQUIRED": message = "DISTINCT aggregate requires an argument."; return true;
                case "AST_PAGE_ORDER_REQUIRED": message = "Offset pagination requires at least one ORDER BY expression."; return true;
                case "AST_KEYSET_ORDER_REQUIRED": message = "Keyset pagination requires at least one ORDER BY expression."; return true;
                case "AST_KEYSET_BOUNDARY_REQUIRED": message = "Keyset pagination requires at least one boundary expression."; return true;
                case "AST_KEYSET_ARITY_MISMATCH": message = "Keyset ORDER BY and boundary expression counts must match."; return true;
                case "AST_CTE_COLUMN_ARITY_MISMATCH": message = "CTE column aliases must match the statically known query result-column count."; return true;
                case "AST_SET_OPERATION_ARITY_MISMATCH": message = "Set-operation branches must have the same statically known result-column count."; return true;
                case "AST_PARAMETER_NAME_INVALID": message = "Logical parameter name is invalid."; return true;
                case "AST_PARAMETER_TYPE_INVALID": message = "Logical parameter type descriptor is invalid."; return true;
                case "AST_PARAMETER_DIRECTION_INVALID": message = "Logical parameter direction is undefined."; return true;
                case "AST_PARAMETER_DEFINITION_CONFLICT": message = "Logical parameter name has conflicting definitions."; return true;
                case "AST_WRITE_ALL_ROWS_NOT_ALLOWED": message = "Full-table write requires explicit AllowAllRows."; return true;
                case "AST_DML_COLUMN_DUPLICATE": message = "DML target columns must be ordinally unique."; return true;
                case "AST_DML_ASSIGNMENT_DUPLICATE": message = "DML assignments must target ordinally unique columns."; return true;
                case "AST_DML_ROW_ARITY_MISMATCH": message = "DML row value count must match target column count."; return true;
                case "AST_INSERT_SOURCE_ARITY_MISMATCH": message = "Insert target columns must match the statically known source result-column count."; return true;
                case "AST_INSERT_SOURCE_SHAPE_INVALID": message = "Insert must contain exactly one values or select source."; return true;
                case "AST_UPSERT_SHAPE_INVALID": message = "Upsert conflict policy, keys, and assignments are inconsistent."; return true;
                case "AST_BULK_BATCH_SIZE_INVALID": message = "Bulk batch-size maximum must be positive."; return true;
                case "AST_SCHEMA_DEFAULT_TYPE_MISMATCH": message = "Column default is incompatible with its logical type."; return true;
                case "AST_SCHEMA_GENERATION_TYPE_MISMATCH": message = "Column generation is incompatible with its logical type."; return true;
                case "AST_SCHEMA_COLUMN_REFERENCE_MISSING": message = "Schema object references a column not declared by its table."; return true;
                case "AST_SCHEMA_PRIMARY_KEY_NULLABLE": message = "Primary-key columns must be not nullable."; return true;
                case "AST_SCHEMA_REFERENTIAL_ACTION_INVALID": message = "Foreign-key referential action is incompatible with local columns."; return true;
                case "AST_SCHEMA_FOREIGN_KEY_ARITY_MISMATCH": message = "Foreign-key local and referenced column counts must match."; return true;
                case "AST_SCHEMA_ALTER_MISMATCH": message = "Before and after schema definitions do not identify the same object."; return true;
                case "AST_SCHEMA_SEQUENCE_INVALID": message = "Sequence type, bounds, start, increment, or cache is invalid."; return true;
                case "AST_MIGRATION_STEP_ID_DUPLICATE": message = "Migration step IDs must be ordinally unique."; return true;
                case "AST_MIGRATION_IDEMPOTENCY_MISMATCH": message = "Migration idempotency contradicts create or drop behavior."; return true;
                case "AST_BIND_COLUMN_OWNER_UNRESOLVED": message = "Column reference does not have a visible alias owner."; return true;
                case "AST_BIND_COLUMN_OWNER_AMBIGUOUS": message = "Column reference has multiple visible alias owners."; return true;
                default:
                    message = null;
                    return false;
            }
        }
    }
}
