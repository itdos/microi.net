using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Dos.ORM.SqlAst
{
    public abstract class SchemaOperation : SqlStatement
    {
        protected SchemaOperation(DestructiveImpact impact)
        {
            Impact = impact;
        }

        public DestructiveImpact Impact { get; }
    }

    public sealed class CreateSchemaOperation : SchemaOperation
    {
        public CreateSchemaOperation(SchemaName schema, CreateObjectBehavior behavior)
            : base(DestructiveImpact.None)
        {
            Schema = schema ?? throw new ArgumentNullException(nameof(schema));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SchemaName Schema { get; }
        public CreateObjectBehavior Behavior { get; }
    }

    public sealed class DropSchemaOperation : SchemaOperation
    {
        public DropSchemaOperation(
            SchemaName schema,
            DropObjectBehavior behavior,
            DropScope scope)
            : base(DestructiveImpact.PotentialDataLoss)
        {
            Schema = schema ?? throw new ArgumentNullException(nameof(schema));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            SchemaStatementGuards.Defined(scope, nameof(scope));
            Behavior = behavior;
            Scope = scope;
        }

        public SchemaName Schema { get; }
        public DropObjectBehavior Behavior { get; }
        public DropScope Scope { get; }
    }

    public sealed class CreateTableOperation : SchemaOperation
    {
        public CreateTableOperation(TableDefinition table, CreateObjectBehavior behavior)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public TableDefinition Table { get; }
        public CreateObjectBehavior Behavior { get; }
    }

    public sealed class RenameTableOperation : SchemaOperation
    {
        public RenameTableOperation(SqlObjectName source, SqlObjectName target)
            : base(DestructiveImpact.CompatibilityRisk)
        {
            Source = source ?? throw new ArgumentNullException(nameof(source));
            Target = target ?? throw new ArgumentNullException(nameof(target));
            if (Source.Equals(Target))
            {
                throw new ArgumentException(
                    "Rename source and target must be different.", nameof(target));
            }
        }

        public SqlObjectName Source { get; }
        public SqlObjectName Target { get; }
    }

    public sealed class DropTableOperation : SchemaOperation
    {
        public DropTableOperation(
            SqlObjectName table,
            DropObjectBehavior behavior,
            DropScope scope)
            : base(DestructiveImpact.PotentialDataLoss)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            SchemaStatementGuards.Defined(scope, nameof(scope));
            Behavior = behavior;
            Scope = scope;
        }

        public SqlObjectName Table { get; }
        public DropObjectBehavior Behavior { get; }
        public DropScope Scope { get; }
    }

    public sealed class AddColumnOperation : SchemaOperation
    {
        public AddColumnOperation(SqlObjectName table, ColumnDefinition column)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Column = column ?? throw new ArgumentNullException(nameof(column));
        }

        public SqlObjectName Table { get; }
        public ColumnDefinition Column { get; }
    }

    public sealed class AlterColumnOperation : SchemaOperation
    {
        public AlterColumnOperation(
            SqlObjectName table,
            ColumnDefinition before,
            ColumnDefinition after)
            : base(Classify(before, after))
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Before = before;
            After = after;
        }

        public SqlObjectName Table { get; }
        public ColumnDefinition Before { get; }
        public ColumnDefinition After { get; }

        private static DestructiveImpact Classify(
            ColumnDefinition before,
            ColumnDefinition after)
        {
            if (before == null)
            {
                throw new ArgumentNullException(nameof(before));
            }
            if (after == null)
            {
                throw new ArgumentNullException(nameof(after));
            }
            if (!before.Name.Equals(after.Name))
            {
                throw new ArgumentException(
                    "Alter-column names must match; use rename separately.",
                    nameof(after));
            }
            if (!Equals(before.Comment, after.Comment))
            {
                throw new ArgumentException(
                    "Column comments must use explicit set/remove operations.",
                    nameof(after));
            }

            if (before.Type.LogicalType != after.Type.LogicalType ||
                !Equals(before.Generation, after.Generation) ||
                before.Nullability == ColumnNullability.Nullable &&
                after.Nullability == ColumnNullability.NotNullable ||
                NarrowsTypeBounds(before.Type, after.Type))
            {
                return DestructiveImpact.PotentialDataLoss;
            }

            return Equals(before.DefaultValue, after.DefaultValue)
                ? DestructiveImpact.None
                : DestructiveImpact.CompatibilityRisk;
        }

        private static bool NarrowsTypeBounds(
            SqlTypeDescriptor before,
            SqlTypeDescriptor after)
        {
            if (AddsOrReduces(before.Length, after.Length))
            {
                return true;
            }

            if (before.LogicalType == LogicalDbType.Decimal)
            {
                if (!before.Precision.HasValue)
                {
                    return after.Precision.HasValue;
                }
                if (!after.Precision.HasValue)
                {
                    return false;
                }

                var beforeScale = before.Scale ?? 0;
                var afterScale = after.Scale ?? 0;
                var beforeIntegral = before.Precision.Value - beforeScale;
                var afterIntegral = after.Precision.Value - afterScale;
                return afterScale < beforeScale || afterIntegral < beforeIntegral;
            }

            return AddsOrReduces(before.Precision, after.Precision) ||
                   AddsOrReduces(before.Scale, after.Scale);
        }

        private static bool AddsOrReduces(int? before, int? after)
        {
            return !before.HasValue && after.HasValue ||
                   before.HasValue && after.HasValue && after.Value < before.Value;
        }
    }

    public sealed class RenameColumnOperation : SchemaOperation
    {
        public RenameColumnOperation(
            SqlObjectName table,
            SqlIdentifier source,
            SqlIdentifier target)
            : base(DestructiveImpact.CompatibilityRisk)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Source = source ?? throw new ArgumentNullException(nameof(source));
            Target = target ?? throw new ArgumentNullException(nameof(target));
            if (Source.Equals(Target))
            {
                throw new ArgumentException(
                    "Rename source and target must be different.", nameof(target));
            }
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Source { get; }
        public SqlIdentifier Target { get; }
    }

    public sealed class DropColumnOperation : SchemaOperation
    {
        public DropColumnOperation(
            SqlObjectName table,
            SqlIdentifier column,
            DropObjectBehavior behavior)
            : base(DestructiveImpact.PotentialDataLoss)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Column = column ?? throw new ArgumentNullException(nameof(column));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Column { get; }
        public DropObjectBehavior Behavior { get; }
    }

    public sealed class AddConstraintOperation : SchemaOperation
    {
        public AddConstraintOperation(
            SqlObjectName table,
            ConstraintDefinition constraint)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Constraint = constraint ?? throw new ArgumentNullException(nameof(constraint));
            SchemaModelGuard.RequireKnownConstraint(
                Constraint, nameof(constraint));
        }

        public SqlObjectName Table { get; }
        public ConstraintDefinition Constraint { get; }
    }

    public sealed class DropConstraintOperation : SchemaOperation
    {
        public DropConstraintOperation(
            SqlObjectName table,
            SqlIdentifier constraint,
            DropObjectBehavior behavior)
            : base(DestructiveImpact.CompatibilityRisk)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Constraint = constraint ?? throw new ArgumentNullException(nameof(constraint));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Constraint { get; }
        public DropObjectBehavior Behavior { get; }
    }

    public sealed class CreateIndexOperation : SchemaOperation
    {
        public CreateIndexOperation(
            SqlObjectName table,
            IndexDefinition index,
            CreateObjectBehavior behavior)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Index = index ?? throw new ArgumentNullException(nameof(index));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlObjectName Table { get; }
        public IndexDefinition Index { get; }
        public CreateObjectBehavior Behavior { get; }
    }

    public sealed class DropIndexOperation : SchemaOperation
    {
        public DropIndexOperation(
            SqlObjectName table,
            SqlIdentifier index,
            DropObjectBehavior behavior)
            : base(DestructiveImpact.CompatibilityRisk)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Index = index ?? throw new ArgumentNullException(nameof(index));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Index { get; }
        public DropObjectBehavior Behavior { get; }
    }

    public sealed class CreateSequenceOperation : SchemaOperation
    {
        public CreateSequenceOperation(
            SequenceDefinition sequence,
            CreateObjectBehavior behavior)
            : base(DestructiveImpact.None)
        {
            Sequence = sequence ?? throw new ArgumentNullException(nameof(sequence));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SequenceDefinition Sequence { get; }
        public CreateObjectBehavior Behavior { get; }
    }

    public sealed class AlterSequenceOperation : SchemaOperation
    {
        public AlterSequenceOperation(
            SequenceDefinition before,
            SequenceDefinition after)
            : base(Classify(before, after))
        {
            Before = before;
            After = after;
        }

        public SequenceDefinition Before { get; }
        public SequenceDefinition After { get; }

        private static DestructiveImpact Classify(
            SequenceDefinition before,
            SequenceDefinition after)
        {
            if (before == null)
            {
                throw new ArgumentNullException(nameof(before));
            }
            if (after == null)
            {
                throw new ArgumentNullException(nameof(after));
            }
            if (!before.Name.Equals(after.Name))
            {
                throw new ArgumentException(
                    "Alter-sequence names must match.", nameof(after));
            }

            if (before.IntegerType != after.IntegerType ||
                Narrows(before.Options.Bounds, after.Options.Bounds))
            {
                return DestructiveImpact.PotentialDataLoss;
            }

            if (before.Options.StartValue != after.Options.StartValue ||
                before.Options.IncrementBy != after.Options.IncrementBy ||
                before.Options.Cycle != after.Options.Cycle)
            {
                return DestructiveImpact.CompatibilityRisk;
            }

            return DestructiveImpact.None;
        }

        private static bool Narrows(SequenceBounds before, SequenceBounds after)
        {
            var minimumNarrows =
                !before.MinimumValue.HasValue && after.MinimumValue.HasValue ||
                before.MinimumValue.HasValue && after.MinimumValue.HasValue &&
                after.MinimumValue.Value > before.MinimumValue.Value;
            var maximumNarrows =
                !before.MaximumValue.HasValue && after.MaximumValue.HasValue ||
                before.MaximumValue.HasValue && after.MaximumValue.HasValue &&
                after.MaximumValue.Value < before.MaximumValue.Value;
            return minimumNarrows || maximumNarrows;
        }
    }

    public sealed class DropSequenceOperation : SchemaOperation
    {
        public DropSequenceOperation(
            SqlObjectName sequence,
            DropObjectBehavior behavior)
            : base(DestructiveImpact.CompatibilityRisk)
        {
            Sequence = sequence ?? throw new ArgumentNullException(nameof(sequence));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlObjectName Sequence { get; }
        public DropObjectBehavior Behavior { get; }
    }

    public sealed class SetTableCommentOperation : SchemaOperation
    {
        public SetTableCommentOperation(SqlObjectName table, SchemaComment comment)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Comment = comment ?? throw new ArgumentNullException(nameof(comment));
        }

        public SqlObjectName Table { get; }
        public SchemaComment Comment { get; }
    }

    public sealed class RemoveTableCommentOperation : SchemaOperation
    {
        public RemoveTableCommentOperation(SqlObjectName table)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
        }

        public SqlObjectName Table { get; }
    }

    public sealed class SetColumnCommentOperation : SchemaOperation
    {
        public SetColumnCommentOperation(
            SqlObjectName table,
            SqlIdentifier column,
            SchemaComment comment)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Column = column ?? throw new ArgumentNullException(nameof(column));
            Comment = comment ?? throw new ArgumentNullException(nameof(comment));
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Column { get; }
        public SchemaComment Comment { get; }
    }

    public sealed class RemoveColumnCommentOperation : SchemaOperation
    {
        public RemoveColumnCommentOperation(SqlObjectName table, SqlIdentifier column)
            : base(DestructiveImpact.None)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Column = column ?? throw new ArgumentNullException(nameof(column));
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Column { get; }
    }

    public sealed class MigrationStep : SqlNode
    {
        public MigrationStep(
            MigrationStepId id,
            SchemaOperation operation,
            MigrationIdempotencyMode idempotency)
        {
            Id = id ?? throw new ArgumentNullException(nameof(id));
            Operation = operation ?? throw new ArgumentNullException(nameof(operation));
            SchemaStatementGuards.Defined(idempotency, nameof(idempotency));
            ValidateIdempotency(operation, idempotency);
            Idempotency = idempotency;
        }

        public MigrationStepId Id { get; }
        public SchemaOperation Operation { get; }
        public MigrationIdempotencyMode Idempotency { get; }

        private static void ValidateIdempotency(
            SchemaOperation operation,
            MigrationIdempotencyMode idempotency)
        {
            CreateObjectBehavior? create = null;
            DropObjectBehavior? drop = null;

            if (operation is CreateSchemaOperation createSchema)
            {
                create = createSchema.Behavior;
            }
            else if (operation is CreateTableOperation createTable)
            {
                create = createTable.Behavior;
            }
            else if (operation is CreateIndexOperation createIndex)
            {
                create = createIndex.Behavior;
            }
            else if (operation is CreateSequenceOperation createSequence)
            {
                create = createSequence.Behavior;
            }
            else if (operation is DropSchemaOperation dropSchema)
            {
                drop = dropSchema.Behavior;
            }
            else if (operation is DropTableOperation dropTable)
            {
                drop = dropTable.Behavior;
            }
            else if (operation is DropColumnOperation dropColumn)
            {
                drop = dropColumn.Behavior;
            }
            else if (operation is DropConstraintOperation dropConstraint)
            {
                drop = dropConstraint.Behavior;
            }
            else if (operation is DropIndexOperation dropIndex)
            {
                drop = dropIndex.Behavior;
            }
            else if (operation is DropSequenceOperation dropSequence)
            {
                drop = dropSequence.Behavior;
            }

            if (create.HasValue)
            {
                var expected = create.Value == CreateObjectBehavior.FailIfExists
                    ? MigrationIdempotencyMode.RequireChange
                    : MigrationIdempotencyMode.AcceptAlreadySatisfied;
                if (idempotency != expected)
                {
                    throw new ArgumentException(
                        "Migration idempotency contradicts create behavior.",
                        nameof(idempotency));
                }
            }
            if (drop.HasValue)
            {
                var expected = drop.Value == DropObjectBehavior.FailIfMissing
                    ? MigrationIdempotencyMode.RequireChange
                    : MigrationIdempotencyMode.AcceptAlreadySatisfied;
                if (idempotency != expected)
                {
                    throw new ArgumentException(
                        "Migration idempotency contradicts drop behavior.",
                        nameof(idempotency));
                }
            }
        }
    }

    public sealed class DestructiveMigrationApproval
    {
        internal DestructiveMigrationApproval(
            MigrationPlanId planId,
            StructuralFingerprint fingerprint,
            IReadOnlyList<MigrationStepId> stepIds,
            ApprovalReference reference)
        {
            PlanId = planId;
            Fingerprint = fingerprint;
            StepIds = stepIds;
            Reference = reference;
        }

        public MigrationPlanId PlanId { get; }
        public StructuralFingerprint Fingerprint { get; }
        public IReadOnlyList<MigrationStepId> StepIds { get; }
        public ApprovalReference Reference { get; }
    }

    public sealed class MigrationPlan : SqlNode
    {
        private readonly DestructiveMigrationApproval _approval;

        public MigrationPlan(
            MigrationPlanId id,
            IEnumerable<MigrationStep> steps,
            ExpectedStructuralFingerprint expectedFingerprint = null)
            : this(id, CopySteps(steps), expectedFingerprint, null)
        {
        }

        private MigrationPlan(
            MigrationPlanId id,
            IReadOnlyList<MigrationStep> steps,
            ExpectedStructuralFingerprint expectedFingerprint,
            DestructiveMigrationApproval approval)
        {
            Id = id ?? throw new ArgumentNullException(nameof(id));
            Steps = steps ?? throw new ArgumentNullException(nameof(steps));
            EnsureUniqueStepIds(Steps);
            Fingerprint = SchemaFingerprintEncoder.ForMigrationPlan(this);
            if (expectedFingerprint != null &&
                !string.Equals(expectedFingerprint.Value, Fingerprint.Value,
                    StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Expected fingerprint does not match the computed structure.",
                    nameof(expectedFingerprint));
            }

            var destructive = new List<MigrationStepId>();
            foreach (var step in Steps)
            {
                if (step.Operation.Impact != DestructiveImpact.None)
                {
                    destructive.Add(step.Id);
                }
            }
            DestructiveStepIds = new ReadOnlyCollection<MigrationStepId>(destructive);
            ContainsDestructiveSteps = destructive.Count != 0;
            _approval = approval;
            CanApplyNeutralDestructiveSteps =
                destructive.Count == 0 || ApprovalCovers(destructive, approval);
        }

        public MigrationPlanId Id { get; }
        public IReadOnlyList<MigrationStep> Steps { get; }
        public StructuralFingerprint Fingerprint { get; }
        public bool ContainsDestructiveSteps { get; }
        public IReadOnlyList<MigrationStepId> DestructiveStepIds { get; }
        public bool CanApplyNeutralDestructiveSteps { get; }

        public DestructiveMigrationApproval CreateDestructiveApproval(
            IEnumerable<MigrationStepId> stepIds,
            ApprovalReference reference)
        {
            if (stepIds == null)
            {
                throw new ArgumentNullException(nameof(stepIds));
            }
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }

            var copy = new List<MigrationStepId>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var stepId in stepIds)
            {
                if (stepId == null)
                {
                    throw new ArgumentException(
                        "Approval IDs cannot contain null.", nameof(stepIds));
                }
                if (!seen.Add(stepId.Value))
                {
                    throw new ArgumentException(
                        "Approval IDs must be unique.", nameof(stepIds));
                }
                if (!ContainsId(DestructiveStepIds, stepId))
                {
                    throw new ArgumentException(
                        "Approval IDs must identify current destructive steps.",
                        nameof(stepIds));
                }
                copy.Add(stepId);
            }
            if (copy.Count == 0)
            {
                throw new ArgumentException(
                    "At least one destructive step is required.", nameof(stepIds));
            }

            return new DestructiveMigrationApproval(
                Id,
                Fingerprint,
                new ReadOnlyCollection<MigrationStepId>(copy),
                reference);
        }

        public MigrationPlan WithDestructiveApproval(
            DestructiveMigrationApproval approval)
        {
            if (approval == null)
            {
                throw new ArgumentNullException(nameof(approval));
            }
            ValidateApproval(approval);
            return new MigrationPlan(Id, Steps, null, approval);
        }

        private void ValidateApproval(DestructiveMigrationApproval approval)
        {
            if (!Id.Equals(approval.PlanId) ||
                !Fingerprint.Equals(approval.Fingerprint))
            {
                throw new ArgumentException(
                    "Approval does not match this exact migration plan.",
                    nameof(approval));
            }
            if (approval.StepIds == null || approval.StepIds.Count == 0)
            {
                throw new ArgumentException(
                    "Approval must contain destructive step IDs.", nameof(approval));
            }

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var stepId in approval.StepIds)
            {
                if (stepId == null || !seen.Add(stepId.Value) ||
                    !ContainsId(DestructiveStepIds, stepId))
                {
                    throw new ArgumentException(
                        "Approval contains an unknown, safe, or duplicate step ID.",
                        nameof(approval));
                }
            }
        }

        private static IReadOnlyList<MigrationStep> CopySteps(
            IEnumerable<MigrationStep> steps)
        {
            if (steps == null)
            {
                throw new ArgumentNullException(nameof(steps));
            }
            var copy = new List<MigrationStep>();
            foreach (var step in steps)
            {
                if (step == null)
                {
                    throw new ArgumentException(
                        "Steps cannot contain null.", nameof(steps));
                }
                copy.Add(step);
            }
            return new ReadOnlyCollection<MigrationStep>(copy);
        }

        private static void EnsureUniqueStepIds(IReadOnlyList<MigrationStep> steps)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var step in steps)
            {
                if (!seen.Add(step.Id.Value))
                {
                    throw new ArgumentException(
                        "Migration step IDs must be unique.", nameof(steps));
                }
            }
        }

        private static bool ApprovalCovers(
            IReadOnlyList<MigrationStepId> destructive,
            DestructiveMigrationApproval approval)
        {
            if (approval == null || approval.StepIds.Count != destructive.Count)
            {
                return false;
            }
            foreach (var stepId in destructive)
            {
                if (!ContainsId(approval.StepIds, stepId))
                {
                    return false;
                }
            }
            return true;
        }

        private static bool ContainsId(
            IReadOnlyList<MigrationStepId> values,
            MigrationStepId value)
        {
            foreach (var candidate in values)
            {
                if (candidate.Equals(value))
                {
                    return true;
                }
            }
            return false;
        }
    }

    public sealed class DatabaseOperationDiagnostic
    {
        public DatabaseOperationDiagnostic(
            DiagnosticCode code,
            string sanitizedMessage)
        {
            Code = code ?? throw new ArgumentNullException(nameof(code));
            SchemaStatementGuards.NonWhitespace(
                sanitizedMessage, nameof(sanitizedMessage));
            SanitizedMessage = sanitizedMessage;
        }

        public DiagnosticCode Code { get; }
        public string SanitizedMessage { get; }
    }

    public sealed class MigrationStepResult
    {
        public MigrationStepResult(
            MigrationStepId stepId,
            MigrationStepOutcome outcome,
            DatabaseOperationDiagnostic diagnostic = null)
        {
            StepId = stepId ?? throw new ArgumentNullException(nameof(stepId));
            SchemaStatementGuards.Defined(outcome, nameof(outcome));
            var success = outcome == MigrationStepOutcome.Applied ||
                          outcome == MigrationStepOutcome.AlreadySatisfied;
            if (success && diagnostic != null)
            {
                throw new ArgumentException(
                    "Successful results cannot carry a diagnostic.",
                    nameof(diagnostic));
            }
            if (!success && diagnostic == null)
            {
                throw new ArgumentNullException(nameof(diagnostic));
            }
            Outcome = outcome;
            Diagnostic = diagnostic;
        }

        public MigrationStepId StepId { get; }
        public MigrationStepOutcome Outcome { get; }
        public DatabaseOperationDiagnostic Diagnostic { get; }
    }

    public sealed class MigrationResult
    {
        public MigrationResult(
            MigrationPlan plan,
            IEnumerable<MigrationStepResult> results)
        {
            Plan = plan ?? throw new ArgumentNullException(nameof(plan));
            Results = CopyResults(results);
            ValidatePrefix(Plan, Results, out var boundary);
            FailureBoundary = boundary;
            CanAdvanceVersion = boundary == null &&
                                Results.Count == Plan.Steps.Count;
        }

        public MigrationPlan Plan { get; }
        public IReadOnlyList<MigrationStepResult> Results { get; }
        public bool CanAdvanceVersion { get; }
        public MigrationStepResult FailureBoundary { get; }

        private static IReadOnlyList<MigrationStepResult> CopyResults(
            IEnumerable<MigrationStepResult> results)
        {
            if (results == null)
            {
                throw new ArgumentNullException(nameof(results));
            }
            var copy = new List<MigrationStepResult>();
            foreach (var result in results)
            {
                if (result == null)
                {
                    throw new ArgumentException(
                        "Results cannot contain null.", nameof(results));
                }
                copy.Add(result);
            }
            return new ReadOnlyCollection<MigrationStepResult>(copy);
        }

        private static void ValidatePrefix(
            MigrationPlan plan,
            IReadOnlyList<MigrationStepResult> results,
            out MigrationStepResult boundary)
        {
            if (results.Count > plan.Steps.Count)
            {
                throw new ArgumentException(
                    "Results cannot exceed the migration plan.", nameof(results));
            }
            boundary = null;
            for (var index = 0; index < results.Count; index++)
            {
                var result = results[index];
                var step = plan.Steps[index];
                if (!step.Id.Equals(result.StepId))
                {
                    throw new ArgumentException(
                        "Result IDs must match the ordered plan prefix.",
                        nameof(results));
                }
                if (boundary != null)
                {
                    throw new ArgumentException(
                        "No result may follow a terminal boundary.", nameof(results));
                }

                var accepted = result.Outcome == MigrationStepOutcome.Applied ||
                    result.Outcome == MigrationStepOutcome.AlreadySatisfied &&
                    step.Idempotency == MigrationIdempotencyMode.AcceptAlreadySatisfied;
                if (!accepted)
                {
                    boundary = result;
                }
            }
        }
    }

    public abstract class MetadataQueryOperation : SqlStatement
    {
    }

    public sealed class ListTablesOperation : MetadataQueryOperation
    {
        public ListTablesOperation(SchemaScope scope)
        {
            Scope = scope ?? throw new ArgumentNullException(nameof(scope));
        }

        public SchemaScope Scope { get; }
    }

    public sealed class GetTableMetadataOperation : MetadataQueryOperation
    {
        public GetTableMetadataOperation(SqlObjectName table)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
        }

        public SqlObjectName Table { get; }
    }

    public sealed class ListColumnsOperation : MetadataQueryOperation
    {
        public ListColumnsOperation(SqlObjectName table)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
        }

        public SqlObjectName Table { get; }
    }

    public sealed class GetColumnMetadataOperation : MetadataQueryOperation
    {
        public GetColumnMetadataOperation(SqlObjectName table, SqlIdentifier column)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Column = column ?? throw new ArgumentNullException(nameof(column));
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Column { get; }
    }

    public sealed class ListIndexesOperation : MetadataQueryOperation
    {
        public ListIndexesOperation(SqlObjectName table)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
        }

        public SqlObjectName Table { get; }
    }

    public sealed class GetIndexMetadataOperation : MetadataQueryOperation
    {
        public GetIndexMetadataOperation(SqlObjectName table, SqlIdentifier index)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Index = index ?? throw new ArgumentNullException(nameof(index));
        }

        public SqlObjectName Table { get; }
        public SqlIdentifier Index { get; }
    }

    public sealed class ColumnMetadata : IEquatable<ColumnMetadata>
    {
        public ColumnMetadata(
            SqlObjectName table,
            ColumnDefinition definition,
            int ordinal)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
            if (ordinal < 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(ordinal), "Column ordinal cannot be negative.");
            }
            Ordinal = ordinal;
        }

        public SqlObjectName Table { get; }
        public ColumnDefinition Definition { get; }
        public int Ordinal { get; }

        public bool Equals(ColumnMetadata other)
        {
            return other != null && Table.Equals(other.Table) &&
                   Definition.Equals(other.Definition) && Ordinal == other.Ordinal;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ColumnMetadata);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = Table.GetHashCode();
                hash = hash * 397 ^ Definition.GetHashCode();
                return hash * 397 ^ Ordinal;
            }
        }
    }

    public sealed class IndexMetadata : IEquatable<IndexMetadata>
    {
        public IndexMetadata(SqlObjectName table, IndexDefinition definition)
        {
            Table = table ?? throw new ArgumentNullException(nameof(table));
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        }

        public SqlObjectName Table { get; }
        public IndexDefinition Definition { get; }

        public bool Equals(IndexMetadata other)
        {
            return other != null && Table.Equals(other.Table) &&
                   Definition.Equals(other.Definition);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as IndexMetadata);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return Table.GetHashCode() * 397 ^ Definition.GetHashCode();
            }
        }
    }

    public sealed class TableMetadata : IEquatable<TableMetadata>
    {
        public TableMetadata(TableDefinition definition)
        {
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        }

        public TableDefinition Definition { get; }

        public bool Equals(TableMetadata other)
        {
            return other != null && Definition.Equals(other.Definition);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as TableMetadata);
        }

        public override int GetHashCode()
        {
            return Definition.GetHashCode();
        }
    }

    public sealed class MetadataLookupResult<T> : IEquatable<MetadataLookupResult<T>>
        where T : class
    {
        private MetadataLookupResult(MetadataLookupStatus status, T value)
        {
            Status = status;
            Value = value;
        }

        public MetadataLookupStatus Status { get; }
        public T Value { get; }

        public static MetadataLookupResult<T> Found(T value)
        {
            if (value == null)
            {
                throw new ArgumentNullException(nameof(value));
            }
            return new MetadataLookupResult<T>(MetadataLookupStatus.Found, value);
        }

        public static MetadataLookupResult<T> NotFound()
        {
            return new MetadataLookupResult<T>(MetadataLookupStatus.NotFound, null);
        }

        public bool Equals(MetadataLookupResult<T> other)
        {
            return other != null && Status == other.Status &&
                   EqualityComparer<T>.Default.Equals(Value, other.Value);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as MetadataLookupResult<T>);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (int)Status * 397 ^
                       (Value == null ? 0 : EqualityComparer<T>.Default.GetHashCode(Value));
            }
        }
    }

    public sealed class TableMetadataCollectionResult :
        IEquatable<TableMetadataCollectionResult>
    {
        public TableMetadataCollectionResult(
            MetadataCollectionStatus status,
            SchemaToken token,
            IEnumerable<TableMetadata> items)
        {
            SchemaStatementGuards.Defined(status, nameof(status));
            Status = status;
            Token = token ?? throw new ArgumentNullException(nameof(token));
            Items = MetadataOrdering.CopyTables(items, nameof(items));
            EnsureMissingIsEmpty(status, Items.Count, nameof(items));
        }

        public MetadataCollectionStatus Status { get; }
        public SchemaToken Token { get; }
        public IReadOnlyList<TableMetadata> Items { get; }

        public bool Equals(TableMetadataCollectionResult other)
        {
            return other != null && Status == other.Status &&
                   Token.Equals(other.Token) &&
                   SchemaStatementGuards.SequenceEqual(Items, other.Items);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as TableMetadataCollectionResult);
        }

        public override int GetHashCode()
        {
            return SchemaStatementGuards.CollectionHash(
                (int)Status * 397 ^ Token.GetHashCode(), Items);
        }

        private static void EnsureMissingIsEmpty(
            MetadataCollectionStatus status,
            int count,
            string parameterName)
        {
            if (status == MetadataCollectionStatus.TargetNotFound && count != 0)
            {
                throw new ArgumentException(
                    "TargetNotFound cannot carry items.", parameterName);
            }
        }
    }

    public sealed class ColumnMetadataCollectionResult :
        IEquatable<ColumnMetadataCollectionResult>
    {
        public ColumnMetadataCollectionResult(
            MetadataCollectionStatus status,
            SchemaToken token,
            IEnumerable<ColumnMetadata> items)
        {
            SchemaStatementGuards.Defined(status, nameof(status));
            Status = status;
            Token = token ?? throw new ArgumentNullException(nameof(token));
            Items = MetadataOrdering.CopyColumns(items, nameof(items));
            if (status == MetadataCollectionStatus.TargetNotFound && Items.Count != 0)
            {
                throw new ArgumentException(
                    "TargetNotFound cannot carry items.", nameof(items));
            }
        }

        public MetadataCollectionStatus Status { get; }
        public SchemaToken Token { get; }
        public IReadOnlyList<ColumnMetadata> Items { get; }

        public bool Equals(ColumnMetadataCollectionResult other)
        {
            return other != null && Status == other.Status &&
                   Token.Equals(other.Token) &&
                   SchemaStatementGuards.SequenceEqual(Items, other.Items);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ColumnMetadataCollectionResult);
        }

        public override int GetHashCode()
        {
            return SchemaStatementGuards.CollectionHash(
                (int)Status * 397 ^ Token.GetHashCode(), Items);
        }
    }

    public sealed class IndexMetadataCollectionResult :
        IEquatable<IndexMetadataCollectionResult>
    {
        public IndexMetadataCollectionResult(
            MetadataCollectionStatus status,
            SchemaToken token,
            IEnumerable<IndexMetadata> items)
        {
            SchemaStatementGuards.Defined(status, nameof(status));
            Status = status;
            Token = token ?? throw new ArgumentNullException(nameof(token));
            Items = MetadataOrdering.CopyIndexes(items, nameof(items));
            if (status == MetadataCollectionStatus.TargetNotFound && Items.Count != 0)
            {
                throw new ArgumentException(
                    "TargetNotFound cannot carry items.", nameof(items));
            }
        }

        public MetadataCollectionStatus Status { get; }
        public SchemaToken Token { get; }
        public IReadOnlyList<IndexMetadata> Items { get; }

        public bool Equals(IndexMetadataCollectionResult other)
        {
            return other != null && Status == other.Status &&
                   Token.Equals(other.Token) &&
                   SchemaStatementGuards.SequenceEqual(Items, other.Items);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as IndexMetadataCollectionResult);
        }

        public override int GetHashCode()
        {
            return SchemaStatementGuards.CollectionHash(
                (int)Status * 397 ^ Token.GetHashCode(), Items);
        }
    }

    public sealed class SchemaMetadataSnapshot : IEquatable<SchemaMetadataSnapshot>
    {
        public SchemaMetadataSnapshot(
            SchemaToken token,
            IEnumerable<TableMetadata> tables)
        {
            Token = token ?? throw new ArgumentNullException(nameof(token));
            Tables = MetadataOrdering.CopyTables(tables, nameof(tables));
        }

        public SchemaToken Token { get; }
        public IReadOnlyList<TableMetadata> Tables { get; }

        public bool Equals(SchemaMetadataSnapshot other)
        {
            return other != null && Token.Equals(other.Token) &&
                   SchemaStatementGuards.SequenceEqual(Tables, other.Tables);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SchemaMetadataSnapshot);
        }

        public override int GetHashCode()
        {
            return SchemaStatementGuards.CollectionHash(Token.GetHashCode(), Tables);
        }
    }

    internal static class MetadataOrdering
    {
        public static IReadOnlyList<TableMetadata> CopyTables(
            IEnumerable<TableMetadata> items,
            string parameterName)
        {
            var copy = Copy(items, parameterName);
            copy.Sort((left, right) => CompareNames(
                left.Definition.Name, right.Definition.Name));
            return new ReadOnlyCollection<TableMetadata>(copy);
        }

        public static IReadOnlyList<ColumnMetadata> CopyColumns(
            IEnumerable<ColumnMetadata> items,
            string parameterName)
        {
            var copy = Copy(items, parameterName);
            copy.Sort((left, right) =>
            {
                var ordinal = left.Ordinal.CompareTo(right.Ordinal);
                return ordinal != 0
                    ? ordinal
                    : StringComparer.Ordinal.Compare(
                        left.Definition.Name.Value,
                        right.Definition.Name.Value);
            });
            return new ReadOnlyCollection<ColumnMetadata>(copy);
        }

        public static IReadOnlyList<IndexMetadata> CopyIndexes(
            IEnumerable<IndexMetadata> items,
            string parameterName)
        {
            var copy = Copy(items, parameterName);
            copy.Sort((left, right) => StringComparer.Ordinal.Compare(
                left.Definition.Name.Value, right.Definition.Name.Value));
            return new ReadOnlyCollection<IndexMetadata>(copy);
        }

        private static List<T> Copy<T>(IEnumerable<T> items, string parameterName)
            where T : class
        {
            if (items == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            var copy = new List<T>();
            foreach (var item in items)
            {
                if (item == null)
                {
                    throw new ArgumentException(
                        "Metadata collections cannot contain null.", parameterName);
                }
                copy.Add(item);
            }
            return copy;
        }

        private static int CompareNames(SqlObjectName left, SqlObjectName right)
        {
            var value = CompareOptional(left.Catalog, right.Catalog);
            if (value != 0)
            {
                return value;
            }
            value = CompareOptional(left.Schema, right.Schema);
            return value != 0
                ? value
                : StringComparer.Ordinal.Compare(left.Name.Value, right.Name.Value);
        }

        private static int CompareOptional(SqlIdentifier left, SqlIdentifier right)
        {
            if (left == null)
            {
                return right == null ? 0 : -1;
            }
            return right == null
                ? 1
                : StringComparer.Ordinal.Compare(left.Value, right.Value);
        }
    }

    public sealed class DatabaseDiagnosticOperation : SqlStatement
    {
        public DatabaseDiagnosticOperation(DatabaseDiagnosticKind kind)
        {
            SchemaStatementGuards.Defined(kind, nameof(kind));
            Kind = kind;
        }

        public DatabaseDiagnosticKind Kind { get; }
    }

    public sealed class DatabaseDiagnosticResult
    {
        public DatabaseDiagnosticResult(
            DiagnosticCode code,
            DatabaseDiagnosticStatus status,
            DiagnosticSeverity severity,
            string sanitizedMessage)
        {
            Code = code ?? throw new ArgumentNullException(nameof(code));
            SchemaStatementGuards.Defined(status, nameof(status));
            SchemaStatementGuards.Defined(severity, nameof(severity));
            SchemaStatementGuards.NonWhitespace(
                sanitizedMessage, nameof(sanitizedMessage));
            if (status == DatabaseDiagnosticStatus.Healthy &&
                    severity != DiagnosticSeverity.Information ||
                status == DatabaseDiagnosticStatus.Warning &&
                    severity != DiagnosticSeverity.Warning ||
                status == DatabaseDiagnosticStatus.Failed &&
                    severity != DiagnosticSeverity.Error)
            {
                throw new ArgumentException(
                    "Diagnostic status and severity do not match.", nameof(severity));
            }
            Status = status;
            Severity = severity;
            SanitizedMessage = sanitizedMessage;
        }

        public DiagnosticCode Code { get; }
        public DatabaseDiagnosticStatus Status { get; }
        public DiagnosticSeverity Severity { get; }
        public string SanitizedMessage { get; }
    }

    public abstract class DatabaseAdminOperation : SqlStatement
    {
        protected DatabaseAdminOperation(
            DestructiveImpact impact,
            bool approved)
        {
            Impact = impact;
            CanExecute = impact == DestructiveImpact.None || approved;
        }

        public DestructiveImpact Impact { get; }
        public bool CanExecute { get; }
    }

    public sealed class CreateDatabaseOperation : DatabaseAdminOperation
    {
        public CreateDatabaseOperation(
            SqlIdentifier database,
            CreateObjectBehavior behavior)
            : base(DestructiveImpact.None, true)
        {
            Database = database ?? throw new ArgumentNullException(nameof(database));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
        }

        public SqlIdentifier Database { get; }
        public CreateObjectBehavior Behavior { get; }
    }

    public sealed class AdminTargetApproval
    {
        internal AdminTargetApproval(
            AdminOperationKind kind,
            SqlIdentifier target,
            StructuralFingerprint fingerprint,
            ApprovalReference reference)
        {
            Kind = kind;
            Target = target;
            Fingerprint = fingerprint;
            Reference = reference;
        }

        public AdminOperationKind Kind { get; }
        public SqlIdentifier Target { get; }
        public StructuralFingerprint Fingerprint { get; }
        public ApprovalReference Reference { get; }
    }

    public sealed class DropDatabaseOperation : DatabaseAdminOperation
    {
        private readonly AdminTargetApproval _approval;

        public DropDatabaseOperation(
            SqlIdentifier database,
            DropObjectBehavior behavior,
            ExpectedStructuralFingerprint expectedFingerprint = null)
            : this(database, behavior, expectedFingerprint, null)
        {
        }

        private DropDatabaseOperation(
            SqlIdentifier database,
            DropObjectBehavior behavior,
            ExpectedStructuralFingerprint expectedFingerprint,
            AdminTargetApproval approval)
            : base(DestructiveImpact.PotentialDataLoss, approval != null)
        {
            Database = database ?? throw new ArgumentNullException(nameof(database));
            SchemaStatementGuards.Defined(behavior, nameof(behavior));
            Behavior = behavior;
            Fingerprint = SchemaFingerprintEncoder.ForDropDatabase(this);
            SchemaStatementGuards.ExpectedMatches(
                expectedFingerprint, Fingerprint, nameof(expectedFingerprint));
            _approval = approval;
        }

        public SqlIdentifier Database { get; }
        public DropObjectBehavior Behavior { get; }
        public StructuralFingerprint Fingerprint { get; }

        public AdminTargetApproval CreateApproval(ApprovalReference reference)
        {
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }
            return new AdminTargetApproval(
                AdminOperationKind.DropDatabase,
                Database,
                Fingerprint,
                reference);
        }

        public DropDatabaseOperation WithApproval(AdminTargetApproval approval)
        {
            ValidateApproval(approval);
            return new DropDatabaseOperation(Database, Behavior, null, approval);
        }

        private void ValidateApproval(AdminTargetApproval approval)
        {
            if (approval == null)
            {
                throw new ArgumentNullException(nameof(approval));
            }
            if (approval.Kind != AdminOperationKind.DropDatabase ||
                !Database.Equals(approval.Target) ||
                !Fingerprint.Equals(approval.Fingerprint))
            {
                throw new ArgumentException(
                    "Approval does not match this exact database drop.",
                    nameof(approval));
            }
        }
    }

    public sealed class DatabaseExportOperation : DatabaseAdminOperation
    {
        public DatabaseExportOperation(
            SqlIdentifier database,
            DatabaseResourceHandle resource,
            DatabaseTransferFormat format,
            DatabaseTransferScope scope)
            : base(DestructiveImpact.None, true)
        {
            Database = database ?? throw new ArgumentNullException(nameof(database));
            Resource = resource ?? throw new ArgumentNullException(nameof(resource));
            SchemaStatementGuards.Defined(format, nameof(format));
            SchemaStatementGuards.Defined(scope, nameof(scope));
            Format = format;
            Scope = scope;
        }

        public SqlIdentifier Database { get; }
        public DatabaseResourceHandle Resource { get; }
        public DatabaseTransferFormat Format { get; }
        public DatabaseTransferScope Scope { get; }
    }

    public sealed class DatabaseImportOperation : DatabaseAdminOperation
    {
        private readonly AdminTargetApproval _approval;

        public DatabaseImportOperation(
            SqlIdentifier database,
            DatabaseResourceHandle resource,
            DatabaseTransferFormat format,
            DatabaseTransferScope scope,
            DatabaseImportConflictPolicy policy,
            ExpectedStructuralFingerprint expectedFingerprint = null)
            : this(
                database,
                resource,
                format,
                scope,
                policy,
                expectedFingerprint,
                null)
        {
        }

        private DatabaseImportOperation(
            SqlIdentifier database,
            DatabaseResourceHandle resource,
            DatabaseTransferFormat format,
            DatabaseTransferScope scope,
            DatabaseImportConflictPolicy policy,
            ExpectedStructuralFingerprint expectedFingerprint,
            AdminTargetApproval approval)
            : base(
                policy == DatabaseImportConflictPolicy.ReplaceTargetDatabase
                    ? DestructiveImpact.PotentialDataLoss
                    : DestructiveImpact.None,
                approval != null)
        {
            Database = database ?? throw new ArgumentNullException(nameof(database));
            Resource = resource ?? throw new ArgumentNullException(nameof(resource));
            SchemaStatementGuards.Defined(format, nameof(format));
            SchemaStatementGuards.Defined(scope, nameof(scope));
            SchemaStatementGuards.Defined(policy, nameof(policy));
            if (policy == DatabaseImportConflictPolicy.ReplaceTargetDatabase &&
                scope != DatabaseTransferScope.SchemaAndData)
            {
                throw new ArgumentException(
                    "ReplaceTargetDatabase requires SchemaAndData scope.",
                    nameof(scope));
            }
            Format = format;
            Scope = scope;
            Policy = policy;
            Fingerprint = SchemaFingerprintEncoder.ForDatabaseImport(this);
            SchemaStatementGuards.ExpectedMatches(
                expectedFingerprint, Fingerprint, nameof(expectedFingerprint));
            _approval = approval;
        }

        public SqlIdentifier Database { get; }
        public DatabaseResourceHandle Resource { get; }
        public DatabaseTransferFormat Format { get; }
        public DatabaseTransferScope Scope { get; }
        public DatabaseImportConflictPolicy Policy { get; }
        public StructuralFingerprint Fingerprint { get; }

        public AdminTargetApproval CreateApproval(ApprovalReference reference)
        {
            if (Policy != DatabaseImportConflictPolicy.ReplaceTargetDatabase)
            {
                throw new InvalidOperationException(
                    "Safe imports do not create destructive approval.");
            }
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }
            return new AdminTargetApproval(
                AdminOperationKind.ReplaceImport,
                Database,
                Fingerprint,
                reference);
        }

        public DatabaseImportOperation WithApproval(AdminTargetApproval approval)
        {
            if (Policy != DatabaseImportConflictPolicy.ReplaceTargetDatabase)
            {
                throw new InvalidOperationException(
                    "Safe imports do not accept destructive approval.");
            }
            if (approval == null)
            {
                throw new ArgumentNullException(nameof(approval));
            }
            if (approval.Kind != AdminOperationKind.ReplaceImport ||
                !Database.Equals(approval.Target) ||
                !Fingerprint.Equals(approval.Fingerprint))
            {
                throw new ArgumentException(
                    "Approval does not match this exact replacement import.",
                    nameof(approval));
            }
            return new DatabaseImportOperation(
                Database, Resource, Format, Scope, Policy, null, approval);
        }
    }

    public sealed class DatabaseAdminResult
    {
        public DatabaseAdminResult(
            DatabaseAdminOperation request,
            DatabaseAdminOutcome outcome,
            DatabaseOperationDiagnostic diagnostic = null)
        {
            Request = request ?? throw new ArgumentNullException(nameof(request));
            SchemaStatementGuards.Defined(outcome, nameof(outcome));
            var success = outcome == DatabaseAdminOutcome.Applied ||
                          outcome == DatabaseAdminOutcome.AlreadySatisfied;
            if (success && diagnostic != null)
            {
                throw new ArgumentException(
                    "Successful admin results cannot carry a diagnostic.",
                    nameof(diagnostic));
            }
            if (!success && diagnostic == null)
            {
                throw new ArgumentNullException(nameof(diagnostic));
            }
            if (success && request.Impact != DestructiveImpact.None &&
                !request.CanExecute)
            {
                throw new ArgumentException(
                    "An unapproved destructive request cannot succeed.",
                    nameof(request));
            }
            if (outcome == DatabaseAdminOutcome.BlockedDestructive &&
                (request.Impact == DestructiveImpact.None || request.CanExecute))
            {
                throw new ArgumentException(
                    "BlockedDestructive requires an unapproved destructive request.",
                    nameof(outcome));
            }
            Outcome = outcome;
            Diagnostic = diagnostic;
        }

        public DatabaseAdminOperation Request { get; }
        public DatabaseAdminOutcome Outcome { get; }
        public DatabaseOperationDiagnostic Diagnostic { get; }
    }

    internal static class SchemaFingerprintEncoder
    {
        private const string VersionDomain = "microi-schema-ast-fingerprint-v1";

        public static StructuralFingerprint ForMigrationPlan(MigrationPlan plan)
        {
            if (plan == null)
            {
                throw new ArgumentNullException(nameof(plan));
            }
            return Hash(writer =>
            {
                writer.String(VersionDomain);
                writer.Tag("MigrationPlan");
                writer.String(plan.Id.Value);
                writer.Count(plan.Steps.Count);
                foreach (var step in plan.Steps)
                {
                    writer.Tag("MigrationStep");
                    writer.String(step.Id.Value);
                    writer.Enum(step.Idempotency);
                    WriteOperation(writer, step.Operation);
                }
            });
        }

        public static StructuralFingerprint ForDropDatabase(
            DropDatabaseOperation operation)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            return Hash(writer =>
            {
                writer.String(VersionDomain);
                writer.Tag("DropDatabaseOperation");
                writer.Enum(AdminOperationKind.DropDatabase);
                WriteIdentifier(writer, operation.Database);
                writer.Enum(operation.Behavior);
            });
        }

        public static StructuralFingerprint ForDatabaseImport(
            DatabaseImportOperation operation)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            return Hash(writer =>
            {
                writer.String(VersionDomain);
                writer.Tag("DatabaseImportOperation");
                writer.Enum(operation.Policy ==
                    DatabaseImportConflictPolicy.ReplaceTargetDatabase
                        ? AdminOperationKind.ReplaceImport
                        : AdminOperationKind.ReplaceImport);
                WriteIdentifier(writer, operation.Database);
                WriteResource(writer, operation.Resource);
                writer.Enum(operation.Format);
                writer.Enum(operation.Scope);
                writer.Enum(operation.Policy);
            });
        }

        private static StructuralFingerprint Hash(Action<FingerprintWriter> encode)
        {
            using (var stream = new MemoryStream())
            {
                var writer = new FingerprintWriter(stream);
                encode(writer);
                using (var sha256 = SHA256.Create())
                {
                    var digest = sha256.ComputeHash(stream.ToArray());
                    var text = new StringBuilder("sha256:", 71);
                    foreach (var value in digest)
                    {
                        text.Append(value.ToString("x2", CultureInfo.InvariantCulture));
                    }
                    return new StructuralFingerprint(text.ToString());
                }
            }
        }

        private static void WriteOperation(
            FingerprintWriter writer,
            SchemaOperation operation)
        {
            if (operation is CreateSchemaOperation createSchema)
            {
                writer.Tag("CreateSchemaOperation");
                WriteSchemaName(writer, createSchema.Schema);
                writer.Enum(createSchema.Behavior);
                return;
            }
            if (operation is DropSchemaOperation dropSchema)
            {
                writer.Tag("DropSchemaOperation");
                WriteSchemaName(writer, dropSchema.Schema);
                writer.Enum(dropSchema.Behavior);
                writer.Enum(dropSchema.Scope);
                return;
            }
            if (operation is CreateTableOperation createTable)
            {
                writer.Tag("CreateTableOperation");
                WriteTable(writer, createTable.Table);
                writer.Enum(createTable.Behavior);
                return;
            }
            if (operation is RenameTableOperation renameTable)
            {
                writer.Tag("RenameTableOperation");
                WriteObjectName(writer, renameTable.Source);
                WriteObjectName(writer, renameTable.Target);
                return;
            }
            if (operation is DropTableOperation dropTable)
            {
                writer.Tag("DropTableOperation");
                WriteObjectName(writer, dropTable.Table);
                writer.Enum(dropTable.Behavior);
                writer.Enum(dropTable.Scope);
                return;
            }
            if (operation is AddColumnOperation addColumn)
            {
                writer.Tag("AddColumnOperation");
                WriteObjectName(writer, addColumn.Table);
                WriteColumn(writer, addColumn.Column);
                return;
            }
            if (operation is AlterColumnOperation alterColumn)
            {
                writer.Tag("AlterColumnOperation");
                WriteObjectName(writer, alterColumn.Table);
                WriteColumn(writer, alterColumn.Before);
                WriteColumn(writer, alterColumn.After);
                return;
            }
            if (operation is RenameColumnOperation renameColumn)
            {
                writer.Tag("RenameColumnOperation");
                WriteObjectName(writer, renameColumn.Table);
                WriteIdentifier(writer, renameColumn.Source);
                WriteIdentifier(writer, renameColumn.Target);
                return;
            }
            if (operation is DropColumnOperation dropColumn)
            {
                writer.Tag("DropColumnOperation");
                WriteObjectName(writer, dropColumn.Table);
                WriteIdentifier(writer, dropColumn.Column);
                writer.Enum(dropColumn.Behavior);
                return;
            }
            if (operation is AddConstraintOperation addConstraint)
            {
                writer.Tag("AddConstraintOperation");
                WriteObjectName(writer, addConstraint.Table);
                WriteConstraint(writer, addConstraint.Constraint);
                return;
            }
            if (operation is DropConstraintOperation dropConstraint)
            {
                writer.Tag("DropConstraintOperation");
                WriteObjectName(writer, dropConstraint.Table);
                WriteIdentifier(writer, dropConstraint.Constraint);
                writer.Enum(dropConstraint.Behavior);
                return;
            }
            if (operation is CreateIndexOperation createIndex)
            {
                writer.Tag("CreateIndexOperation");
                WriteObjectName(writer, createIndex.Table);
                WriteIndex(writer, createIndex.Index);
                writer.Enum(createIndex.Behavior);
                return;
            }
            if (operation is DropIndexOperation dropIndex)
            {
                writer.Tag("DropIndexOperation");
                WriteObjectName(writer, dropIndex.Table);
                WriteIdentifier(writer, dropIndex.Index);
                writer.Enum(dropIndex.Behavior);
                return;
            }
            if (operation is CreateSequenceOperation createSequence)
            {
                writer.Tag("CreateSequenceOperation");
                WriteSequence(writer, createSequence.Sequence);
                writer.Enum(createSequence.Behavior);
                return;
            }
            if (operation is AlterSequenceOperation alterSequence)
            {
                writer.Tag("AlterSequenceOperation");
                WriteSequence(writer, alterSequence.Before);
                WriteSequence(writer, alterSequence.After);
                return;
            }
            if (operation is DropSequenceOperation dropSequence)
            {
                writer.Tag("DropSequenceOperation");
                WriteObjectName(writer, dropSequence.Sequence);
                writer.Enum(dropSequence.Behavior);
                return;
            }
            if (operation is SetTableCommentOperation setTableComment)
            {
                writer.Tag("SetTableCommentOperation");
                WriteObjectName(writer, setTableComment.Table);
                WriteComment(writer, setTableComment.Comment);
                return;
            }
            if (operation is RemoveTableCommentOperation removeTableComment)
            {
                writer.Tag("RemoveTableCommentOperation");
                WriteObjectName(writer, removeTableComment.Table);
                return;
            }
            if (operation is SetColumnCommentOperation setColumnComment)
            {
                writer.Tag("SetColumnCommentOperation");
                WriteObjectName(writer, setColumnComment.Table);
                WriteIdentifier(writer, setColumnComment.Column);
                WriteComment(writer, setColumnComment.Comment);
                return;
            }
            if (operation is RemoveColumnCommentOperation removeColumnComment)
            {
                writer.Tag("RemoveColumnCommentOperation");
                WriteObjectName(writer, removeColumnComment.Table);
                WriteIdentifier(writer, removeColumnComment.Column);
                return;
            }

            throw new ArgumentException(
                "Unknown schema operation cannot be fingerprinted.",
                nameof(operation));
        }

        private static void WriteSchemaName(
            FingerprintWriter writer,
            SchemaName schema)
        {
            writer.Tag("SchemaName");
            writer.Optional(schema.Catalog, value => WriteIdentifier(writer, value));
            WriteIdentifier(writer, schema.Name);
        }

        private static void WriteTable(
            FingerprintWriter writer,
            TableDefinition table)
        {
            writer.Tag("TableDefinition");
            WriteObjectName(writer, table.Name);
            writer.Count(table.Columns.Count);
            foreach (var column in table.Columns)
            {
                WriteColumn(writer, column);
            }
            writer.Count(table.Constraints.Count);
            foreach (var constraint in table.Constraints)
            {
                WriteConstraint(writer, constraint);
            }
            writer.Count(table.Indexes.Count);
            foreach (var index in table.Indexes)
            {
                WriteIndex(writer, index);
            }
            writer.Optional(table.Comment, value => WriteComment(writer, value));
        }

        private static void WriteColumn(
            FingerprintWriter writer,
            ColumnDefinition column)
        {
            writer.Tag("ColumnDefinition");
            WriteIdentifier(writer, column.Name);
            WriteType(writer, column.Type);
            writer.Enum(column.Nullability);
            writer.Optional(column.Generation, value => WriteGeneration(writer, value));
            writer.Optional(column.DefaultValue, value => WriteDefault(writer, value));
            writer.Optional(column.Comment, value => WriteComment(writer, value));
        }

        private static void WriteComment(
            FingerprintWriter writer,
            SchemaComment comment)
        {
            writer.Tag("SchemaComment");
            writer.String(comment.Text);
        }

        private static void WriteDefault(
            FingerprintWriter writer,
            ColumnDefaultDefinition definition)
        {
            if (definition is NullDefaultDefinition)
            {
                writer.Tag("NullDefaultDefinition");
                return;
            }
            if (definition is BooleanDefaultDefinition boolean)
            {
                writer.Tag("BooleanDefaultDefinition");
                writer.Boolean(boolean.Value);
                return;
            }
            if (definition is Int64DefaultDefinition integer)
            {
                writer.Tag("Int64DefaultDefinition");
                writer.Int64(integer.Value);
                return;
            }
            if (definition is DecimalDefaultDefinition decimalValue)
            {
                writer.Tag("DecimalDefaultDefinition");
                writer.Decimal(decimalValue.Value);
                return;
            }
            if (definition is StringDefaultDefinition text)
            {
                writer.Tag("StringDefaultDefinition");
                writer.String(text.Value);
                return;
            }
            if (definition is GuidDefaultDefinition guid)
            {
                writer.Tag("GuidDefaultDefinition");
                writer.Guid(guid.Value);
                return;
            }
            if (definition is DateTimeDefaultDefinition dateTime)
            {
                writer.Tag("DateTimeDefaultDefinition");
                writer.Int64(dateTime.Value.Ticks);
                writer.Enum(dateTime.Value.Kind);
                return;
            }
            if (definition is DateTimeOffsetDefaultDefinition dateTimeOffset)
            {
                writer.Tag("DateTimeOffsetDefaultDefinition");
                writer.Int64(dateTimeOffset.Value.Ticks);
                writer.Int16(checked((short)dateTimeOffset.Value.Offset.TotalMinutes));
                return;
            }
            if (definition is SemanticDefaultDefinition semantic)
            {
                writer.Tag("SemanticDefaultDefinition");
                writer.Enum(semantic.Kind);
                return;
            }
            throw new ArgumentException(
                "Unknown default definition cannot be fingerprinted.",
                nameof(definition));
        }

        private static void WriteGeneration(
            FingerprintWriter writer,
            ColumnGenerationDefinition generation)
        {
            if (generation is IdentityGenerationDefinition identity)
            {
                writer.Tag("IdentityGenerationDefinition");
                writer.Int64(identity.Seed);
                writer.Int64(identity.Increment);
                return;
            }
            if (generation is SequenceGenerationDefinition sequence)
            {
                writer.Tag("SequenceGenerationDefinition");
                WriteObjectName(writer, sequence.Sequence);
                return;
            }
            if (generation is ComputedGenerationDefinition computed)
            {
                writer.Tag("ComputedGenerationDefinition");
                WriteExpression(writer, computed.Expression);
                writer.Enum(computed.Storage);
                return;
            }
            throw new ArgumentException(
                "Unknown generation definition cannot be fingerprinted.",
                nameof(generation));
        }

        private static void WriteConstraint(
            FingerprintWriter writer,
            ConstraintDefinition constraint)
        {
            if (constraint is PrimaryKeyDefinition primary)
            {
                writer.Tag("PrimaryKeyDefinition");
                WriteIdentifier(writer, primary.Name);
                WriteIdentifiers(writer, primary.Columns);
                return;
            }
            if (constraint is UniqueConstraintDefinition unique)
            {
                writer.Tag("UniqueConstraintDefinition");
                WriteIdentifier(writer, unique.Name);
                WriteIdentifiers(writer, unique.Columns);
                return;
            }
            if (constraint is ForeignKeyDefinition foreignKey)
            {
                writer.Tag("ForeignKeyDefinition");
                WriteIdentifier(writer, foreignKey.Name);
                WriteObjectName(writer, foreignKey.ReferencedTable);
                writer.Tag("ForeignKeyColumnSet");
                WriteIdentifiers(writer, foreignKey.Columns.LocalColumns);
                WriteIdentifiers(writer, foreignKey.Columns.ReferencedColumns);
                writer.Tag("ReferentialActions");
                writer.Enum(foreignKey.Actions.OnUpdate);
                writer.Enum(foreignKey.Actions.OnDelete);
                return;
            }
            throw new ArgumentException(
                "Unknown constraint definition cannot be fingerprinted.",
                nameof(constraint));
        }

        private static void WriteIndex(
            FingerprintWriter writer,
            IndexDefinition index)
        {
            writer.Tag("IndexDefinition");
            WriteIdentifier(writer, index.Name);
            writer.Count(index.Columns.Count);
            foreach (var column in index.Columns)
            {
                writer.Tag("IndexColumnDefinition");
                WriteIdentifier(writer, column.Column);
                writer.Enum(column.Direction);
            }
            writer.Enum(index.Uniqueness);
        }

        private static void WriteSequence(
            FingerprintWriter writer,
            SequenceDefinition sequence)
        {
            writer.Tag("SequenceDefinition");
            WriteObjectName(writer, sequence.Name);
            writer.Enum(sequence.IntegerType);
            writer.Tag("SequenceOptions");
            writer.Int64(sequence.Options.StartValue);
            writer.Int64(sequence.Options.IncrementBy);
            writer.Tag("SequenceBounds");
            writer.OptionalInt64(sequence.Options.Bounds.MinimumValue);
            writer.OptionalInt64(sequence.Options.Bounds.MaximumValue);
            writer.OptionalInt32(sequence.Options.CacheSize);
            writer.Enum(sequence.Options.Cycle);
        }

        private static void WriteResource(
            FingerprintWriter writer,
            DatabaseResourceHandle resource)
        {
            writer.Tag("DatabaseResourceHandle");
            writer.Guid(resource.Id);
            writer.Tag("ResourceContentDigest");
            writer.String(resource.ContentDigest.Value);
        }

        private static void WriteExpression(
            FingerprintWriter writer,
            SqlExpression expression)
        {
            if (expression == null)
            {
                throw new ArgumentNullException(nameof(expression));
            }
            if (expression is ColumnExpression column)
            {
                writer.Tag("ColumnExpression");
                WriteIdentifier(writer, column.Name);
                writer.Optional(column.Source, value => WriteAlias(writer, value));
                return;
            }
            if (expression is ParameterExpression parameter)
            {
                writer.Tag("ParameterExpression");
                WriteParameter(writer, parameter.Definition);
                return;
            }
            if (expression is NullExpression)
            {
                writer.Tag("NullExpression");
                return;
            }
            if (expression is BooleanExpression boolean)
            {
                writer.Tag("BooleanExpression");
                writer.Boolean(boolean.Value);
                return;
            }
            if (expression is BinaryExpression binary)
            {
                writer.Tag("BinaryExpression");
                WriteExpression(writer, binary.Left);
                writer.Enum(binary.Operator);
                WriteExpression(writer, binary.Right);
                return;
            }
            if (expression is UnaryExpression unary)
            {
                writer.Tag("UnaryExpression");
                writer.Enum(unary.Operator);
                WriteExpression(writer, unary.Operand);
                return;
            }
            if (expression is InExpression inExpression)
            {
                writer.Tag("InExpression");
                WriteExpression(writer, inExpression.Operand);
                writer.Count(inExpression.Values.Count);
                foreach (var value in inExpression.Values)
                {
                    WriteExpression(writer, value);
                }
                return;
            }
            if (expression is BetweenExpression between)
            {
                writer.Tag("BetweenExpression");
                WriteExpression(writer, between.Operand);
                WriteExpression(writer, between.Lower);
                WriteExpression(writer, between.Upper);
                return;
            }
            if (expression is CaseExpression @case)
            {
                writer.Tag("CaseExpression");
                writer.Optional(@case.InputExpression,
                    value => WriteExpression(writer, value));
                writer.Count(@case.WhenClauses.Count);
                foreach (var clause in @case.WhenClauses)
                {
                    writer.Tag("CaseWhenClause");
                    WriteExpression(writer, clause.When);
                    WriteExpression(writer, clause.Then);
                }
                writer.Optional(@case.ElseExpression,
                    value => WriteExpression(writer, value));
                return;
            }
            if (expression is CastExpression cast)
            {
                writer.Tag("CastExpression");
                WriteExpression(writer, cast.Expression);
                WriteType(writer, cast.Type);
                return;
            }
            if (expression is SubqueryExpression subquery)
            {
                writer.Tag("SubqueryExpression");
                if (!(subquery.Query is SelectStatement select))
                {
                    throw new ArgumentException(
                        "Only SelectStatement subqueries are fingerprintable.",
                        nameof(expression));
                }
                WriteSelect(writer, select);
                return;
            }
            if (expression is ExistsExpression exists)
            {
                writer.Tag("ExistsExpression");
                WriteExpression(writer, exists.Subquery);
                return;
            }
            if (expression is AggregateExpression aggregate)
            {
                writer.Tag("AggregateExpression");
                WriteFunction(writer, aggregate.Function);
                writer.Optional(aggregate.Argument,
                    value => WriteExpression(writer, value));
                writer.Boolean(aggregate.Distinct);
                return;
            }
            if (expression is FunctionExpression function)
            {
                writer.Tag("FunctionExpression");
                WriteFunction(writer, function.Function);
                writer.Count(function.Arguments.Count);
                foreach (var argument in function.Arguments)
                {
                    WriteExpression(writer, argument);
                }
                return;
            }
            if (expression is WildcardExpression wildcard)
            {
                writer.Tag("WildcardExpression");
                writer.Optional(wildcard.Source, value => WriteAlias(writer, value));
                return;
            }

            throw new ArgumentException(
                "Unknown SQL expression cannot be fingerprinted.",
                nameof(expression));
        }

        private static void WriteParameter(
            FingerprintWriter writer,
            ParameterDefinition definition)
        {
            writer.Tag("ParameterDefinition");
            writer.String(definition.Name);
            WriteType(writer, definition.Type);
            writer.Enum(definition.Direction);
            writer.Boolean(definition.IsNullable);
        }

        private static void WriteFunction(
            FingerprintWriter writer,
            SemanticFunctionId function)
        {
            writer.Tag("SemanticFunctionId");
            writer.String(function.Key);
            writer.Int32(function.MinArguments);
            writer.OptionalInt32(function.MaxArguments);
            writer.Boolean(function.IsAggregate);
        }

        private static void WriteSelect(
            FingerprintWriter writer,
            SelectStatement select)
        {
            writer.Tag("SelectStatement");
            writer.Optional(select.From, value => WriteTableSource(writer, value));
            writer.Count(select.Projections.Count);
            foreach (var projection in select.Projections)
            {
                writer.Tag("SelectProjection");
                WriteExpression(writer, projection.Expression);
                writer.Optional(projection.Alias, value => WriteAlias(writer, value));
            }
            writer.Boolean(select.Distinct);
            writer.Optional(select.Where, value => WriteExpression(writer, value));
            writer.Count(select.GroupBy.Count);
            foreach (var expression in select.GroupBy)
            {
                WriteExpression(writer, expression);
            }
            writer.Optional(select.Having, value => WriteExpression(writer, value));
            writer.Count(select.OrderBy.Count);
            foreach (var order in select.OrderBy)
            {
                writer.Tag("OrderByExpression");
                WriteExpression(writer, order.Expression);
                writer.Enum(order.Direction);
                writer.Enum(order.NullSortOrder);
            }
            writer.Optional(select.Page, value => WritePage(writer, value));
            writer.Optional(select.Lock, value => WriteLock(writer, value));
            writer.Count(select.CommonTableExpressions.Count);
            foreach (var commonTable in select.CommonTableExpressions)
            {
                writer.Tag("CommonTableExpression");
                WriteIdentifier(writer, commonTable.Name);
                WriteSelect(writer, commonTable.Query);
                WriteIdentifiers(writer, commonTable.Columns);
                writer.Boolean(commonTable.Recursive);
            }
            writer.Count(select.SetOperations.Count);
            foreach (var setOperation in select.SetOperations)
            {
                writer.Tag("SetOperationClause");
                writer.Enum(setOperation.Operator);
                WriteSelect(writer, setOperation.RightQuery);
            }
        }

        private static void WriteTableSource(
            FingerprintWriter writer,
            SqlTableSource source)
        {
            if (source is NamedTableSource named)
            {
                writer.Tag("NamedTableSource");
                WriteObjectName(writer, named.Name);
                writer.Optional(named.Alias, value => WriteAlias(writer, value));
                return;
            }
            if (source is DerivedTableSource derived)
            {
                writer.Tag("DerivedTableSource");
                WriteSelect(writer, derived.Query);
                WriteAlias(writer, derived.Alias);
                return;
            }
            if (source is JoinSource join)
            {
                writer.Tag("JoinSource");
                WriteTableSource(writer, join.Left);
                writer.Enum(join.JoinType);
                WriteTableSource(writer, join.Right);
                writer.Optional(join.Condition,
                    value => WriteExpression(writer, value));
                return;
            }
            throw new ArgumentException(
                "Unknown table source cannot be fingerprinted.", nameof(source));
        }

        private static void WritePage(FingerprintWriter writer, PageSpec page)
        {
            if (page is OffsetPageSpec offset)
            {
                writer.Tag("OffsetPageSpec");
                writer.Int32(offset.Offset);
                writer.Int32(offset.Limit);
                return;
            }
            if (page is KeysetPageSpec keyset)
            {
                writer.Tag("KeysetPageSpec");
                writer.Count(keyset.Boundaries.Count);
                foreach (var boundary in keyset.Boundaries)
                {
                    WriteExpression(writer, boundary);
                }
                writer.Int32(keyset.Limit);
                return;
            }
            throw new ArgumentException(
                "Unknown page specification cannot be fingerprinted.", nameof(page));
        }

        private static void WriteLock(FingerprintWriter writer, LockSpec value)
        {
            writer.Tag("LockSpec");
            writer.Enum(value.Mode);
            writer.Enum(value.Wait);
        }

        private static void WriteIdentifiers(
            FingerprintWriter writer,
            IReadOnlyList<SqlIdentifier> identifiers)
        {
            writer.Count(identifiers.Count);
            foreach (var identifier in identifiers)
            {
                WriteIdentifier(writer, identifier);
            }
        }

        private static void WriteIdentifier(
            FingerprintWriter writer,
            SqlIdentifier identifier)
        {
            writer.Tag("SqlIdentifier");
            writer.String(identifier.Value);
        }

        private static void WriteObjectName(
            FingerprintWriter writer,
            SqlObjectName name)
        {
            writer.Tag("SqlObjectName");
            writer.Optional(name.Catalog, value => WriteIdentifier(writer, value));
            writer.Optional(name.Schema, value => WriteIdentifier(writer, value));
            WriteIdentifier(writer, name.Name);
        }

        private static void WriteAlias(FingerprintWriter writer, SqlAlias alias)
        {
            writer.Tag("SqlAlias");
            WriteIdentifier(writer, alias.Identifier);
        }

        private static void WriteType(
            FingerprintWriter writer,
            SqlTypeDescriptor type)
        {
            writer.Tag("SqlTypeDescriptor");
            writer.Enum(type.LogicalType);
            writer.OptionalInt32(type.Length);
            writer.OptionalInt32(type.Precision);
            writer.OptionalInt32(type.Scale);
        }
    }

    internal sealed class FingerprintWriter
    {
        private static readonly UTF8Encoding StrictUtf8 =
            new UTF8Encoding(false, true);
        private readonly Stream _stream;

        public FingerprintWriter(Stream stream)
        {
            _stream = stream ?? throw new ArgumentNullException(nameof(stream));
        }

        public void Tag(string value)
        {
            String(value);
        }

        public void String(string value)
        {
            if (value == null)
            {
                throw new ArgumentNullException(nameof(value));
            }
            var bytes = StrictUtf8.GetBytes(value);
            UInt32(checked((uint)bytes.Length));
            _stream.Write(bytes, 0, bytes.Length);
        }

        public void Count(int value)
        {
            if (value < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(value));
            }
            UInt32(checked((uint)value));
        }

        public void Boolean(bool value)
        {
            _stream.WriteByte(value ? (byte)1 : (byte)0);
        }

        public void Enum<T>(T value)
            where T : struct
        {
            if (!typeof(T).IsEnum || !System.Enum.IsDefined(typeof(T), value))
            {
                throw new ArgumentOutOfRangeException(nameof(value));
            }
            String(System.Enum.GetName(typeof(T), value));
        }

        public void Optional<T>(T value, Action<T> encode)
            where T : class
        {
            if (encode == null)
            {
                throw new ArgumentNullException(nameof(encode));
            }
            Boolean(value != null);
            if (value != null)
            {
                encode(value);
            }
        }

        public void OptionalInt32(int? value)
        {
            Boolean(value.HasValue);
            if (value.HasValue)
            {
                Int32(value.Value);
            }
        }

        public void OptionalInt64(long? value)
        {
            Boolean(value.HasValue);
            if (value.HasValue)
            {
                Int64(value.Value);
            }
        }

        public void Int16(short value)
        {
            UInt16(unchecked((ushort)value));
        }

        public void Int32(int value)
        {
            UInt32(unchecked((uint)value));
        }

        public void Int64(long value)
        {
            UInt64(unchecked((ulong)value));
        }

        public void Decimal(decimal value)
        {
            foreach (var component in decimal.GetBits(value))
            {
                Int32(component);
            }
        }

        public void Guid(Guid value)
        {
            var bytes = value.ToByteArray();
            var network = new[]
            {
                bytes[3], bytes[2], bytes[1], bytes[0],
                bytes[5], bytes[4], bytes[7], bytes[6],
                bytes[8], bytes[9], bytes[10], bytes[11],
                bytes[12], bytes[13], bytes[14], bytes[15]
            };
            _stream.Write(network, 0, network.Length);
        }

        private void UInt16(ushort value)
        {
            _stream.WriteByte((byte)(value >> 8));
            _stream.WriteByte((byte)value);
        }

        private void UInt32(uint value)
        {
            _stream.WriteByte((byte)(value >> 24));
            _stream.WriteByte((byte)(value >> 16));
            _stream.WriteByte((byte)(value >> 8));
            _stream.WriteByte((byte)value);
        }

        private void UInt64(ulong value)
        {
            _stream.WriteByte((byte)(value >> 56));
            _stream.WriteByte((byte)(value >> 48));
            _stream.WriteByte((byte)(value >> 40));
            _stream.WriteByte((byte)(value >> 32));
            _stream.WriteByte((byte)(value >> 24));
            _stream.WriteByte((byte)(value >> 16));
            _stream.WriteByte((byte)(value >> 8));
            _stream.WriteByte((byte)value);
        }
    }

    internal static class SchemaStatementGuards
    {
        public static void Defined<T>(T value, string parameterName)
            where T : struct
        {
            if (!typeof(T).IsEnum || !System.Enum.IsDefined(typeof(T), value))
            {
                throw new ArgumentOutOfRangeException(
                    parameterName, "Enum value must be defined.");
            }
        }

        public static void NonWhitespace(string value, string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(
                    "Value cannot be empty or whitespace.", parameterName);
            }
        }

        public static void ExpectedMatches(
            ExpectedStructuralFingerprint expected,
            StructuralFingerprint actual,
            string parameterName)
        {
            if (expected != null && !string.Equals(
                    expected.Value, actual.Value, StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Expected fingerprint does not match computed structure.",
                    parameterName);
            }
        }

        public static bool SequenceEqual<T>(
            IReadOnlyList<T> left,
            IReadOnlyList<T> right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }
            if (left == null || right == null || left.Count != right.Count)
            {
                return false;
            }
            var comparer = EqualityComparer<T>.Default;
            for (var index = 0; index < left.Count; index++)
            {
                if (!comparer.Equals(left[index], right[index]))
                {
                    return false;
                }
            }
            return true;
        }

        public static int CollectionHash<T>(int seed, IReadOnlyList<T> values)
        {
            unchecked
            {
                var hash = seed;
                var comparer = EqualityComparer<T>.Default;
                foreach (var value in values)
                {
                    hash = hash * 397 ^
                           (value == null ? 0 : comparer.GetHashCode(value));
                }
                return hash;
            }
        }
    }
}
