using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    public enum AtomicityRequirement
    {
        None,
        BestEffort,
        Required
    }

    public enum SqlResultShape
    {
        None,
        AffectedRows,
        Scalar,
        RowSet,
        ReturningRows,
        MultipleResultSets,
        Metadata,
        Diagnostic,
        Admin,
        Bulk
    }

    public enum PlanResultRole
    {
        None,
        Final,
        Aggregate
    }

    public enum PlanConnectionRole
    {
        CurrentDatabase,
        Administrative,
        DedicatedBulk
    }

    public enum PlanTransactionBehavior
    {
        Enlistable,
        ImplicitCommit,
        NotEnlistable,
        Opaque
    }

    public enum BulkExecutionKind
    {
        Native,
        BatchedSql
    }

    public enum PlanCachePolicy
    {
        Cacheable,
        DoNotCache
    }

    public sealed class SqlCompilationOptions
    {
        public SqlCompilationOptions(
            DialectProfile dialectProfile,
            AtomicityRequirement requestedAtomicity = AtomicityRequirement.None,
            SchemaToken schemaToken = null)
        {
            if (dialectProfile == null)
            {
                throw new ArgumentNullException(nameof(dialectProfile));
            }

            CompilationModelGuard.EnsureDefined(
                typeof(AtomicityRequirement), requestedAtomicity,
                nameof(requestedAtomicity));

            DialectProfile = dialectProfile;
            RequestedAtomicity = requestedAtomicity;
            SchemaToken = schemaToken;
        }

        public DialectProfile DialectProfile { get; }

        public AtomicityRequirement RequestedAtomicity { get; }

        public SchemaToken SchemaToken { get; }
    }

    public abstract class DatabasePlanStep
    {
        internal DatabasePlanStep(
            SqlResultShape resultShape,
            PlanResultRole resultRole,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior,
            MigrationStepId sourceMigrationStepId)
        {
            CompilationModelGuard.EnsureDefined(
                typeof(SqlResultShape), resultShape, nameof(resultShape));
            CompilationModelGuard.EnsureDefined(
                typeof(PlanResultRole), resultRole, nameof(resultRole));
            CompilationModelGuard.EnsureDefined(
                typeof(PlanConnectionRole), connectionRole,
                nameof(connectionRole));
            CompilationModelGuard.EnsureDefined(
                typeof(PlanTransactionBehavior), transactionBehavior,
                nameof(transactionBehavior));

            ResultShape = resultShape;
            ResultRole = resultRole;
            ConnectionRole = connectionRole;
            TransactionBehavior = transactionBehavior;
            SourceMigrationStepId = sourceMigrationStepId;
        }

        public SqlResultShape ResultShape { get; }

        public PlanResultRole ResultRole { get; }

        public PlanConnectionRole ConnectionRole { get; }

        public PlanTransactionBehavior TransactionBehavior { get; }

        public MigrationStepId SourceMigrationStepId { get; }
    }

    public sealed class SqlCommandStep : DatabasePlanStep
    {
        internal SqlCommandStep(
            string commandText,
            IEnumerable<ParameterDefinition> parameters,
            SqlResultShape resultShape,
            PlanResultRole resultRole,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior,
            MigrationStepId sourceMigrationStepId)
            : base(resultShape, resultRole, connectionRole,
                transactionBehavior, sourceMigrationStepId)
        {
            CompilationModelGuard.EnsureCommandText(
                commandText, nameof(commandText));
            PlanCompositionValidator.ValidateCommandResult(
                resultShape, resultRole);

            CommandText = commandText;
            Parameters = CompilationModelGuard.CopyUniqueParameters(
                parameters, nameof(parameters));
        }

        public string CommandText { get; }

        public IReadOnlyList<ParameterDefinition> Parameters { get; }

        public override string ToString()
        {
            return "SqlCommandStep(ResultShape=" + ResultShape
                + ", ResultRole=" + ResultRole
                + ", ConnectionRole=" + ConnectionRole
                + ", TransactionBehavior=" + TransactionBehavior
                + ", ParameterCount="
                + Parameters.Count.ToString(CultureInfo.InvariantCulture)
                + ", CommandDigest="
                + CompilationModelGuard.CommandTemplateDigest(CommandText)
                + ")";
        }
    }

    public sealed class BulkCommandBatch
    {
        internal BulkCommandBatch(SqlCommandStep command, int rowCount)
        {
            if (command == null)
            {
                throw new ArgumentNullException(nameof(command));
            }
            if (rowCount <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(rowCount));
            }

            Command = command;
            RowCount = rowCount;
        }

        public SqlCommandStep Command { get; }

        public int RowCount { get; }
    }

    public sealed class BulkStep : DatabasePlanStep
    {
        private BulkStep(
            BulkInsertOperation operation,
            BulkExecutionKind executionKind,
            int effectiveBatchSize,
            IEnumerable<BulkCommandBatch> batches,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior)
            : base(SqlResultShape.Bulk, PlanResultRole.Final,
                connectionRole, transactionBehavior, null)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            CompilationModelGuard.EnsureDefined(
                typeof(BulkExecutionKind), executionKind,
                nameof(executionKind));
            if (effectiveBatchSize <= 0
                || effectiveBatchSize > operation.BatchSize)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(effectiveBatchSize));
            }

            var copiedBatches = CompilationModelGuard.CopyReferences(
                batches, nameof(batches),
                executionKind == BulkExecutionKind.Native);
            var sourceParameters = new ParameterDefinitionCatalog();
            BulkSqlTreeWalker.CollectParameters(operation, sourceParameters);

            if (executionKind == BulkExecutionKind.Native)
            {
                if (copiedBatches.Count != 0)
                {
                    throw new ArgumentException(
                        "Native bulk cannot contain command batches.",
                        nameof(batches));
                }
            }
            else
            {
                ValidateBatches(
                    operation, effectiveBatchSize, copiedBatches,
                    connectionRole, transactionBehavior, sourceParameters);
            }

            Operation = operation;
            ExecutionKind = executionKind;
            EffectiveBatchSize = effectiveBatchSize;
            Batches = copiedBatches;
        }

        internal static BulkStep Native(
            BulkInsertOperation operation,
            int effectiveBatchSize,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior)
        {
            return new BulkStep(
                operation, BulkExecutionKind.Native, effectiveBatchSize,
                CompilationModelGuard.EmptyReadOnly<BulkCommandBatch>(),
                connectionRole, transactionBehavior);
        }

        internal static BulkStep Batched(
            BulkInsertOperation operation,
            int effectiveBatchSize,
            IEnumerable<BulkCommandBatch> batches,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior)
        {
            return new BulkStep(
                operation, BulkExecutionKind.BatchedSql, effectiveBatchSize,
                batches, connectionRole, transactionBehavior);
        }

        public BulkInsertOperation Operation { get; }

        public BulkExecutionKind ExecutionKind { get; }

        public int EffectiveBatchSize { get; }

        public IReadOnlyList<BulkCommandBatch> Batches { get; }

        public override string ToString()
        {
            return "BulkStep(OperationFingerprint="
                + CompilationModelGuard.BulkOperationDigest(Operation)
                + ", ExecutionKind=" + ExecutionKind
                + ", RowCount="
                + Operation.Rows.Count.ToString(CultureInfo.InvariantCulture)
                + ", BatchCount="
                + Batches.Count.ToString(CultureInfo.InvariantCulture)
                + ", EffectiveBatchSize="
                + EffectiveBatchSize.ToString(CultureInfo.InvariantCulture)
                + ", ConnectionRole=" + ConnectionRole
                + ", TransactionBehavior=" + TransactionBehavior + ")";
        }

        private static void ValidateBatches(
            BulkInsertOperation operation,
            int effectiveBatchSize,
            IReadOnlyList<BulkCommandBatch> batches,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior,
            ParameterDefinitionCatalog parameterCatalog)
        {
            if (batches.Count == 0)
            {
                throw new ArgumentException(
                    "Batched bulk requires at least one batch.",
                    nameof(batches));
            }

            long rowCount = 0;
            var batchParameters = new ParameterDefinitionCatalog();
            for (var index = 0; index < batches.Count; index++)
            {
                var batch = batches[index];
                if (batch.RowCount > effectiveBatchSize)
                {
                    throw new ArgumentException(
                        "A bulk batch exceeds the effective batch size.",
                        nameof(batches));
                }

                var command = batch.Command;
                if (command.ResultShape != SqlResultShape.AffectedRows
                    || command.ResultRole != PlanResultRole.None
                    || command.SourceMigrationStepId != null
                    || command.ConnectionRole != connectionRole
                    || command.TransactionBehavior != transactionBehavior)
                {
                    throw new ArgumentException(
                        "A bulk batch command has incompatible metadata.",
                        nameof(batches));
                }

                batchParameters.AddRange(
                    command.Parameters, nameof(batches));
                rowCount += batch.RowCount;
            }

            if (rowCount != operation.Rows.Count)
            {
                throw new ArgumentException(
                    "Bulk batch row counts do not cover the source rows.",
                    nameof(batches));
            }

            parameterCatalog.EnsureEquivalent(
                batchParameters, nameof(batches));
        }
    }

    public sealed class AdminStep : DatabasePlanStep
    {
        internal AdminStep(
            DatabaseAdminOperation operation,
            PlanConnectionRole connectionRole,
            PlanTransactionBehavior transactionBehavior)
            : base(SqlResultShape.Admin, PlanResultRole.Final,
                connectionRole, transactionBehavior, null)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }

            Operation = operation;
        }

        public DatabaseAdminOperation Operation { get; }

        public override string ToString()
        {
            return "AdminStep(Operation=" + Operation.GetType().Name
                + ", OperationFingerprint="
                + CompilationModelGuard.AdminOperationDigest(Operation)
                + ", ConnectionRole=" + ConnectionRole
                + ", TransactionBehavior=" + TransactionBehavior + ")";
        }
    }

    public sealed class NativeScriptStep : DatabasePlanStep
    {
        internal NativeScriptStep(
            NativeSqlText text,
            IEnumerable<ParameterDefinition> parameters,
            SqlResultShape resultShape)
            : base(resultShape,
                resultShape == SqlResultShape.None
                    ? PlanResultRole.None
                    : PlanResultRole.Final,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Opaque,
                null)
        {
            if (text == null)
            {
                throw new ArgumentNullException(nameof(text));
            }
            PlanCompositionValidator.ValidateNativeResult(resultShape);
            CompilationModelGuard.EnsureDefined(
                typeof(SqlSafetyOrigin), text.Origin, "origin");
            if (text.Origin == SqlSafetyOrigin.PlatformGenerated)
            {
                throw new ArgumentException(
                    "Platform-generated origin is invalid for native text.",
                    nameof(text));
            }

            Text = text;
            Parameters = CompilationModelGuard.CopyUniqueParameters(
                parameters, nameof(parameters));
        }

        public NativeSqlText Text { get; }

        public IReadOnlyList<ParameterDefinition> Parameters { get; }

        public override string ToString()
        {
            return "NativeScriptStep(Digest=" + Text.Digest
                + ", Utf8Length="
                + Text.Utf8Length.ToString(CultureInfo.InvariantCulture)
                + ", Origin=" + Text.Origin
                + ", Kind=" + Text.Kind
                + ", ProfileFingerprint=" + Text.TargetProfile.Fingerprint
                + ", ResultShape=" + ResultShape
                + ", ParameterCount="
                + Parameters.Count.ToString(CultureInfo.InvariantCulture)
                + ")";
        }
    }

    public sealed class CompiledPlanFingerprint
        : IEquatable<CompiledPlanFingerprint>
    {
        internal CompiledPlanFingerprint(string value)
        {
            CompilationModelGuard.EnsureFingerprint(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(CompiledPlanFingerprint other)
        {
            return other != null
                && string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as CompiledPlanFingerprint);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }

        public override string ToString()
        {
            return Value;
        }
    }

    public sealed class CompiledImpactEntry
    {
        internal CompiledImpactEntry(
            MigrationStepId stepId,
            DestructiveImpact neutralImpact,
            DestructiveImpact effectiveImpact)
        {
            if (stepId == null)
            {
                throw new ArgumentNullException(nameof(stepId));
            }
            CompilationModelGuard.EnsureImpactArgument(neutralImpact,
                nameof(neutralImpact));
            CompilationModelGuard.EnsureImpactArgument(effectiveImpact,
                nameof(effectiveImpact));
            if (CompilationModelGuard.ImpactRank(effectiveImpact)
                < CompilationModelGuard.ImpactRank(neutralImpact))
            {
                throw new ArgumentException(
                    "Effective impact cannot be lower than neutral impact.",
                    nameof(effectiveImpact));
            }

            StepId = stepId;
            NeutralImpact = neutralImpact;
            EffectiveImpact = effectiveImpact;
            IsElevated = CompilationModelGuard.ImpactRank(effectiveImpact)
                > CompilationModelGuard.ImpactRank(neutralImpact);
        }

        public MigrationStepId StepId { get; }

        public DestructiveImpact NeutralImpact { get; }

        public DestructiveImpact EffectiveImpact { get; }

        public bool IsElevated { get; }
    }

    public abstract class PlanSafetyBinding
    {
        internal PlanSafetyBinding(
            DestructiveImpact neutralImpact,
            DestructiveImpact effectiveImpact)
        {
            CompilationModelGuard.EnsureImpact(neutralImpact,
                nameof(neutralImpact));
            CompilationModelGuard.EnsureImpact(effectiveImpact,
                nameof(effectiveImpact));
            var neutralRank = CompilationModelGuard.ImpactRank(neutralImpact);
            var effectiveRank = CompilationModelGuard.ImpactRank(effectiveImpact);
            if (effectiveRank < neutralRank)
            {
                throw new ArgumentException(
                    "Effective impact cannot be lower than neutral impact.",
                    nameof(effectiveImpact));
            }

            NeutralImpact = neutralImpact;
            EffectiveImpact = effectiveImpact;
            RequiresEffectiveImpactApproval = effectiveRank > neutralRank;
        }

        public DestructiveImpact NeutralImpact { get; }

        public DestructiveImpact EffectiveImpact { get; }

        public bool RequiresEffectiveImpactApproval { get; }
    }

    public sealed class NoTask6ImpactBinding : PlanSafetyBinding
    {
        private static readonly NoTask6ImpactBinding Singleton =
            new NoTask6ImpactBinding();

        private NoTask6ImpactBinding()
            : base(DestructiveImpact.None, DestructiveImpact.None)
        {
        }

        internal static NoTask6ImpactBinding Instance
        {
            get { return Singleton; }
        }
    }

    public sealed class MigrationPlanSafetyBinding : PlanSafetyBinding
    {
        internal MigrationPlanSafetyBinding(
            MigrationPlan plan,
            IEnumerable<CompiledImpactEntry> entries)
            : this(CreateState(plan, entries))
        {
        }

        private MigrationPlanSafetyBinding(MigrationBindingState state)
            : base(state.NeutralImpact, state.EffectiveImpact)
        {
            PlanId = state.PlanId;
            SourceFingerprint = state.SourceFingerprint;
            Entries = state.Entries;
        }

        public MigrationPlanId PlanId { get; }

        public StructuralFingerprint SourceFingerprint { get; }

        public IReadOnlyList<CompiledImpactEntry> Entries { get; }

        private static MigrationBindingState CreateState(
            MigrationPlan plan,
            IEnumerable<CompiledImpactEntry> entries)
        {
            if (plan == null)
            {
                throw new ArgumentNullException(nameof(plan));
            }
            var copied = CompilationModelGuard.CopyReferences(
                entries, nameof(entries), true);
            if (copied.Count != plan.Steps.Count)
            {
                throw new ArgumentException(
                    "Impact entries must exactly cover migration steps.",
                    nameof(entries));
            }

            var neutral = DestructiveImpact.None;
            var effective = DestructiveImpact.None;
            for (var index = 0; index < copied.Count; index++)
            {
                var entry = copied[index];
                var step = plan.Steps[index];
                if (!entry.StepId.Equals(step.Id)
                    || entry.NeutralImpact != step.Operation.Impact)
                {
                    throw new ArgumentException(
                        "Impact entries do not match the migration source.",
                        nameof(entries));
                }
                neutral = CompilationModelGuard.MaxImpact(
                    neutral, entry.NeutralImpact);
                effective = CompilationModelGuard.MaxImpact(
                    effective, entry.EffectiveImpact);
            }

            return new MigrationBindingState(
                plan.Id, plan.Fingerprint, copied, neutral, effective);
        }

        private sealed class MigrationBindingState
        {
            internal MigrationBindingState(
                MigrationPlanId planId,
                StructuralFingerprint sourceFingerprint,
                IReadOnlyList<CompiledImpactEntry> entries,
                DestructiveImpact neutralImpact,
                DestructiveImpact effectiveImpact)
            {
                PlanId = planId;
                SourceFingerprint = sourceFingerprint;
                Entries = entries;
                NeutralImpact = neutralImpact;
                EffectiveImpact = effectiveImpact;
            }

            internal MigrationPlanId PlanId { get; }
            internal StructuralFingerprint SourceFingerprint { get; }
            internal IReadOnlyList<CompiledImpactEntry> Entries { get; }
            internal DestructiveImpact NeutralImpact { get; }
            internal DestructiveImpact EffectiveImpact { get; }
        }
    }

    public sealed class DatabaseAdminSafetyBinding : PlanSafetyBinding
    {
        private DatabaseAdminSafetyBinding(
            DatabaseAdminOperation operation,
            StructuralFingerprint sourceFingerprint,
            DestructiveImpact effectiveImpact)
            : base(RequireOperation(operation).Impact, effectiveImpact)
        {
            if (sourceFingerprint == null)
            {
                throw new ArgumentNullException(nameof(sourceFingerprint));
            }
            var expectedFingerprint = AuthoritativeFingerprint(operation);
            if (!expectedFingerprint.Equals(sourceFingerprint))
            {
                throw new ArgumentException(
                    "Admin safety fingerprint does not match its operation.",
                    nameof(sourceFingerprint));
            }

            Operation = operation;
            SourceFingerprint = sourceFingerprint;
        }

        internal static DatabaseAdminSafetyBinding ForDropDatabase(
            DropDatabaseOperation operation,
            DestructiveImpact effectiveImpact)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            CompilationModelGuard.EnsureImpactArgument(
                effectiveImpact, nameof(effectiveImpact));
            if (effectiveImpact != operation.Impact)
            {
                throw new ArgumentException(
                    "Drop-database effective impact must remain authoritative.",
                    nameof(effectiveImpact));
            }
            return new DatabaseAdminSafetyBinding(
                operation, operation.Fingerprint, effectiveImpact);
        }

        internal static DatabaseAdminSafetyBinding ForImport(
            DatabaseImportOperation operation,
            DestructiveImpact effectiveImpact)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            CompilationModelGuard.EnsureImpactArgument(
                effectiveImpact, nameof(effectiveImpact));
            if (CompilationModelGuard.ImpactRank(effectiveImpact)
                < CompilationModelGuard.ImpactRank(operation.Impact))
            {
                throw new ArgumentException(
                    "Import effective impact cannot reduce neutral impact.",
                    nameof(effectiveImpact));
            }
            return new DatabaseAdminSafetyBinding(
                operation, operation.Fingerprint, effectiveImpact);
        }

        public DatabaseAdminOperation Operation { get; }

        public StructuralFingerprint SourceFingerprint { get; }

        private static DatabaseAdminOperation RequireOperation(
            DatabaseAdminOperation operation)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            return operation;
        }

        private static StructuralFingerprint AuthoritativeFingerprint(
            DatabaseAdminOperation operation)
        {
            var drop = operation as DropDatabaseOperation;
            if (drop != null)
            {
                return drop.Fingerprint;
            }
            var import = operation as DatabaseImportOperation;
            if (import != null)
            {
                return import.Fingerprint;
            }
            throw new ArgumentException(
                "Only drop and import operations have admin safety bindings.",
                nameof(operation));
        }
    }

    public sealed class CompiledImpactApproval
    {
        internal CompiledImpactApproval(
            StructuralFingerprint sourceFingerprint,
            DialectProfile dialectProfile,
            SchemaToken schemaToken,
            CompiledPlanFingerprint planFingerprint,
            DestructiveImpact effectiveImpact,
            IEnumerable<CompiledImpactEntry> elevatedMigrationSteps,
            ApprovalReference reference)
        {
            if (sourceFingerprint == null)
            {
                throw new ArgumentNullException(nameof(sourceFingerprint));
            }
            if (dialectProfile == null)
            {
                throw new ArgumentNullException(nameof(dialectProfile));
            }
            if (planFingerprint == null)
            {
                throw new ArgumentNullException(nameof(planFingerprint));
            }
            CompilationModelGuard.EnsureImpact(
                effectiveImpact, nameof(effectiveImpact));
            var copied = CompilationModelGuard.CopyReferences(
                elevatedMigrationSteps, nameof(elevatedMigrationSteps), true);
            for (var index = 0; index < copied.Count; index++)
            {
                if (!copied[index].IsElevated)
                {
                    throw new ArgumentException(
                        "Compiled approval entries must be elevated.",
                        nameof(elevatedMigrationSteps));
                }
            }
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }

            SourceFingerprint = sourceFingerprint;
            DialectProfile = dialectProfile;
            SchemaToken = schemaToken;
            PlanFingerprint = planFingerprint;
            EffectiveImpact = effectiveImpact;
            ElevatedMigrationSteps = copied;
            Reference = reference;
        }

        public StructuralFingerprint SourceFingerprint { get; }

        public DialectProfile DialectProfile { get; }

        public SchemaToken SchemaToken { get; }

        public CompiledPlanFingerprint PlanFingerprint { get; }

        public DestructiveImpact EffectiveImpact { get; }

        public IReadOnlyList<CompiledImpactEntry> ElevatedMigrationSteps { get; }

        public ApprovalReference Reference { get; }
    }

    public sealed class DatabaseExecutionPlan
    {
        private readonly CompiledImpactApproval _effectiveImpactApproval;

        private DatabaseExecutionPlan(
            IReadOnlyList<DatabasePlanStep> steps,
            SqlResultShape resultShape,
            SqlSafetyOrigin origin,
            AtomicityRequirement atomicity,
            DialectProfile dialectProfile,
            SchemaToken schemaToken,
            PlanCachePolicy cachePolicy,
            CompiledPlanFingerprint fingerprint,
            PlanSafetyBinding safety,
            CompiledImpactApproval effectiveImpactApproval)
        {
            if (steps == null)
            {
                throw new ArgumentNullException(nameof(steps));
            }
            CompilationModelGuard.EnsureDefined(
                typeof(SqlResultShape), resultShape, nameof(resultShape));
            CompilationModelGuard.EnsureDefined(
                typeof(SqlSafetyOrigin), origin, nameof(origin));
            CompilationModelGuard.EnsureDefined(
                typeof(AtomicityRequirement), atomicity, nameof(atomicity));
            if (dialectProfile == null)
            {
                throw new ArgumentNullException(nameof(dialectProfile));
            }
            CompilationModelGuard.EnsureDefined(
                typeof(PlanCachePolicy), cachePolicy, nameof(cachePolicy));
            if (fingerprint == null)
            {
                throw new ArgumentNullException(nameof(fingerprint));
            }
            if (safety == null)
            {
                throw new ArgumentNullException(nameof(safety));
            }

            Steps = steps;
            ResultShape = resultShape;
            Origin = origin;
            Atomicity = atomicity;
            DialectProfile = dialectProfile;
            SchemaToken = schemaToken;
            CachePolicy = cachePolicy;
            Fingerprint = fingerprint;
            Safety = safety;
            _effectiveImpactApproval = effectiveImpactApproval;
        }

        internal static DatabaseExecutionPlan ForStatement(
            SqlStatement source,
            IEnumerable<SqlCommandStep> steps,
            SqlCompilationOptions options)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            if (source is SchemaOperation
                || source is BulkInsertOperation
                || source is DatabaseAdminOperation)
            {
                throw new ArgumentException(
                    "The statement belongs to a source-aware plan family.",
                    nameof(source));
            }

            var commands = CompilationModelGuard.CopyReferences(
                steps, nameof(steps), false);
            var planSteps = CompilationModelGuard.ToPlanSteps(commands);
            PlanCompositionValidator.ValidateOrdinaryCommands(commands);
            var resultShape = PlanCompositionValidator.DeriveStatementResult(
                source, commands);
            PlanCompositionValidator.ValidateAtomicity(
                options.RequestedAtomicity, planSteps,
                options.DialectProfile);

            var safety = NoTask6ImpactBinding.Instance;
            var fingerprint = CompiledPlanWireEncoder.Encode(
                options.DialectProfile, options.SchemaToken,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, PlanCachePolicy.Cacheable,
                resultShape, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, resultShape, SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, options.DialectProfile,
                options.SchemaToken, PlanCachePolicy.Cacheable,
                fingerprint, safety, null);
        }

        internal static DatabaseExecutionPlan ForSchemaOperation(
            SchemaOperation source,
            DestructiveImpact effectiveImpact,
            IEnumerable<SqlCommandStep> steps,
            SqlCompilationOptions options)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            CompilationModelGuard.EnsureImpact(
                effectiveImpact, nameof(effectiveImpact));
            if (source.Impact != DestructiveImpact.None
                || effectiveImpact != DestructiveImpact.None)
            {
                throw new ArgumentException(
                    "Direct schema plans require neutral and effective None impact.",
                    nameof(effectiveImpact));
            }

            var commands = CompilationModelGuard.CopyReferences(
                steps, nameof(steps), false);
            var planSteps = CompilationModelGuard.ToPlanSteps(commands);
            PlanCompositionValidator.ValidateOrdinaryCommands(commands);
            var resultShape = PlanCompositionValidator.DeriveResult(planSteps);
            PlanCompositionValidator.ValidateAtomicity(
                options.RequestedAtomicity, planSteps,
                options.DialectProfile);

            var safety = NoTask6ImpactBinding.Instance;
            var fingerprint = CompiledPlanWireEncoder.Encode(
                options.DialectProfile, options.SchemaToken,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, PlanCachePolicy.Cacheable,
                resultShape, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, resultShape, SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, options.DialectProfile,
                options.SchemaToken, PlanCachePolicy.Cacheable,
                fingerprint, safety, null);
        }

        internal static DatabaseExecutionPlan ForMigration(
            MigrationPlan source,
            IEnumerable<CompiledImpactEntry> impacts,
            IEnumerable<SqlCommandStep> steps,
            SqlCompilationOptions options)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            if (options.SchemaToken == null)
            {
                throw new ArgumentException(
                    "Migration compilation requires a schema token.",
                    nameof(options));
            }

            var safety = new MigrationPlanSafetyBinding(source, impacts);
            var commands = CompilationModelGuard.CopyReferences(
                steps, nameof(steps), source.Steps.Count == 0);
            var planSteps = CompilationModelGuard.ToPlanSteps(commands);
            PlanCompositionValidator.ValidateMigration(commands, safety);
            PlanCompositionValidator.ValidateAtomicity(
                options.RequestedAtomicity, planSteps,
                options.DialectProfile);

            var fingerprint = CompiledPlanWireEncoder.Encode(
                options.DialectProfile, options.SchemaToken,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, PlanCachePolicy.Cacheable,
                SqlResultShape.None, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, SqlResultShape.None,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, options.DialectProfile,
                options.SchemaToken, PlanCachePolicy.Cacheable,
                fingerprint, safety, null);
        }

        internal static DatabaseExecutionPlan ForBulk(
            BulkInsertOperation source,
            BulkStep step,
            SqlCompilationOptions options)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (step == null)
            {
                throw new ArgumentNullException(nameof(step));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            if (!ReferenceEquals(source, step.Operation))
            {
                throw new ArgumentException(
                    "Bulk source and step operation must be reference-identical.",
                    nameof(step));
            }

            PlanCompositionValidator.ValidateBulk(step);
            var planSteps = CompilationModelGuard.SinglePlanStep(step);
            PlanCompositionValidator.ValidateAtomicity(
                options.RequestedAtomicity, planSteps,
                options.DialectProfile);

            var safety = NoTask6ImpactBinding.Instance;
            var fingerprint = CompiledPlanWireEncoder.Encode(
                options.DialectProfile, options.SchemaToken,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, PlanCachePolicy.Cacheable,
                SqlResultShape.Bulk, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, SqlResultShape.Bulk,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, options.DialectProfile,
                options.SchemaToken, PlanCachePolicy.Cacheable,
                fingerprint, safety, null);
        }

        internal static DatabaseExecutionPlan ForAdmin(
            DatabaseAdminOperation source,
            DestructiveImpact effectiveImpact,
            AdminStep step,
            SqlCompilationOptions options)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (step == null)
            {
                throw new ArgumentNullException(nameof(step));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
            CompilationModelGuard.EnsureImpact(
                effectiveImpact, nameof(effectiveImpact));
            if (!ReferenceEquals(source, step.Operation))
            {
                throw new ArgumentException(
                    "Admin source and step operation must be reference-identical.",
                    nameof(step));
            }

            var safety = PlanCompositionValidator.CreateAdminSafety(
                source, effectiveImpact);
            PlanCompositionValidator.ValidateAdminRoute(source, step);
            var planSteps = CompilationModelGuard.SinglePlanStep(step);
            PlanCompositionValidator.ValidateAtomicity(
                options.RequestedAtomicity, planSteps,
                options.DialectProfile);

            var fingerprint = CompiledPlanWireEncoder.Encode(
                options.DialectProfile, options.SchemaToken,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, PlanCachePolicy.DoNotCache,
                SqlResultShape.Admin, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, SqlResultShape.Admin,
                SqlSafetyOrigin.PlatformGenerated,
                options.RequestedAtomicity, options.DialectProfile,
                options.SchemaToken, PlanCachePolicy.DoNotCache,
                fingerprint, safety, null);
        }

        internal static DatabaseExecutionPlan ForNative(
            NativeScriptStep step)
        {
            if (step == null)
            {
                throw new ArgumentNullException(nameof(step));
            }

            var planSteps = CompilationModelGuard.SinglePlanStep(step);
            var safety = NoTask6ImpactBinding.Instance;
            var fingerprint = CompiledPlanWireEncoder.Encode(
                step.Text.TargetProfile, null, step.Text.Origin,
                AtomicityRequirement.None, PlanCachePolicy.DoNotCache,
                step.ResultShape, safety, planSteps);
            return new DatabaseExecutionPlan(
                planSteps, step.ResultShape, step.Text.Origin,
                AtomicityRequirement.None, step.Text.TargetProfile, null,
                PlanCachePolicy.DoNotCache, fingerprint, safety, null);
        }

        public IReadOnlyList<DatabasePlanStep> Steps { get; }

        public SqlResultShape ResultShape { get; }

        public SqlSafetyOrigin Origin { get; }

        public AtomicityRequirement Atomicity { get; }

        public DialectProfile DialectProfile { get; }

        public SchemaToken SchemaToken { get; }

        public PlanCachePolicy CachePolicy { get; }

        public CompiledPlanFingerprint Fingerprint { get; }

        public PlanSafetyBinding Safety { get; }

        public bool RequiresEffectiveImpactApproval
        {
            get { return Safety.RequiresEffectiveImpactApproval; }
        }

        public bool CanApplyEffectiveImpact
        {
            get
            {
                return !RequiresEffectiveImpactApproval
                    || _effectiveImpactApproval != null;
            }
        }

        public CompiledImpactApproval CreateEffectiveImpactApproval(
            ApprovalReference reference)
        {
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }
            if (!RequiresEffectiveImpactApproval)
            {
                throw new InvalidOperationException(
                    "This plan has no effective-impact elevation.");
            }

            return new CompiledImpactApproval(
                CompiledApprovalValidator.SourceFingerprint(Safety),
                DialectProfile, SchemaToken, Fingerprint,
                Safety.EffectiveImpact,
                CompiledApprovalValidator.ElevatedEntries(Safety),
                reference);
        }

        public DatabaseExecutionPlan WithEffectiveImpactApproval(
            CompiledImpactApproval approval)
        {
            if (approval == null)
            {
                throw new ArgumentNullException(nameof(approval));
            }
            if (!RequiresEffectiveImpactApproval)
            {
                throw new ArgumentException(
                    "This plan does not accept an effective-impact approval.",
                    nameof(approval));
            }

            CompiledApprovalValidator.Validate(this, approval);
            return new DatabaseExecutionPlan(
                Steps, ResultShape, Origin, Atomicity, DialectProfile,
                SchemaToken, CachePolicy, Fingerprint, Safety, approval);
        }

        public override string ToString()
        {
            var stepTypes = string.Empty;
            for (var index = 0; index < Steps.Count; index++)
            {
                if (index != 0)
                {
                    stepTypes += ",";
                }
                stepTypes += Steps[index].GetType().Name;
            }

            return "DatabaseExecutionPlan(Fingerprint=" + Fingerprint.Value
                + ", ProfileFingerprint=" + DialectProfile.Fingerprint
                + ", Origin=" + Origin
                + ", Atomicity=" + Atomicity
                + ", ResultShape=" + ResultShape
                + ", CachePolicy=" + CachePolicy
                + ", StepCount="
                + Steps.Count.ToString(CultureInfo.InvariantCulture)
                + ", StepTypes=" + stepTypes
                + ", NeutralImpact=" + Safety.NeutralImpact
                + ", EffectiveImpact=" + Safety.EffectiveImpact + ")";
        }
    }

    internal static class CompilationModelGuard
    {
        internal static void EnsureDefined(
            Type enumType,
            object value,
            string parameterName)
        {
            if (!Enum.IsDefined(enumType, value))
            {
                throw new ArgumentOutOfRangeException(parameterName);
            }
        }

        internal static void EnsureImpact(
            DestructiveImpact impact,
            string parameterName)
        {
            if (impact != DestructiveImpact.None
                && impact != DestructiveImpact.CompatibilityRisk
                && impact != DestructiveImpact.PotentialDataLoss)
            {
                throw new ArgumentOutOfRangeException(parameterName);
            }
        }

        internal static void EnsureImpactArgument(
            DestructiveImpact impact,
            string parameterName)
        {
            if (impact != DestructiveImpact.None
                && impact != DestructiveImpact.CompatibilityRisk
                && impact != DestructiveImpact.PotentialDataLoss)
            {
                throw new ArgumentException(
                    "Undefined impact value.", parameterName);
            }
        }

        internal static int ImpactRank(DestructiveImpact impact)
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
                    throw new ArgumentException("Undefined impact value.",
                        nameof(impact));
            }
        }

        internal static DestructiveImpact MaxImpact(
            DestructiveImpact first,
            DestructiveImpact second)
        {
            return ImpactRank(first) >= ImpactRank(second) ? first : second;
        }

        internal static void EnsureCommandText(
            string commandText,
            string parameterName)
        {
            if (commandText == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (string.IsNullOrWhiteSpace(commandText))
            {
                throw new ArgumentException(
                    "Command text cannot be empty or whitespace.",
                    parameterName);
            }
            if (commandText.IndexOf('\0') >= 0)
            {
                throw new ArgumentException(
                    "Command text cannot contain a NUL character.",
                    parameterName);
            }
        }

        internal static void EnsureFingerprint(
            string value,
            string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (value.Length != 71
                || !value.StartsWith("sha256:", StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Compiled fingerprint has an invalid shape.",
                    parameterName);
            }
            for (var index = 7; index < value.Length; index++)
            {
                var character = value[index];
                if (!((character >= '0' && character <= '9')
                    || (character >= 'a' && character <= 'f')))
                {
                    throw new ArgumentException(
                        "Compiled fingerprint has an invalid shape.",
                        parameterName);
                }
            }
        }

        internal static IReadOnlyList<T> CopyReferences<T>(
            IEnumerable<T> source,
            string parameterName,
            bool allowEmpty)
            where T : class
        {
            if (source == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            var copy = new List<T>();
            foreach (var item in source)
            {
                if (item == null)
                {
                    throw new ArgumentException(
                        "A collection item cannot be null.",
                        parameterName);
                }
                copy.Add(item);
            }
            if (!allowEmpty && copy.Count == 0)
            {
                throw new ArgumentException(
                    "The collection cannot be empty.", parameterName);
            }
            return Array.AsReadOnly(copy.ToArray());
        }

        internal static IReadOnlyList<ParameterDefinition>
            CopyUniqueParameters(
                IEnumerable<ParameterDefinition> parameters,
                string parameterName)
        {
            var copy = CopyReferences(parameters, parameterName, true);
            var names = new HashSet<string>(StringComparer.Ordinal);
            for (var index = 0; index < copy.Count; index++)
            {
                if (!names.Add(copy[index].Name))
                {
                    throw new ArgumentException(
                        "Parameter names must be ordinally unique.",
                        parameterName);
                }
            }
            return copy;
        }

        internal static IReadOnlyList<T> EmptyReadOnly<T>()
            where T : class
        {
            return Array.AsReadOnly(new T[0]);
        }

        internal static IReadOnlyList<DatabasePlanStep> ToPlanSteps<T>(
            IReadOnlyList<T> steps)
            where T : DatabasePlanStep
        {
            var copy = new DatabasePlanStep[steps.Count];
            for (var index = 0; index < steps.Count; index++)
            {
                copy[index] = steps[index];
            }
            return Array.AsReadOnly(copy);
        }

        internal static IReadOnlyList<DatabasePlanStep> SinglePlanStep(
            DatabasePlanStep step)
        {
            return Array.AsReadOnly(new[] { step });
        }

        internal static string CommandTemplateDigest(string commandText)
        {
            var wire = new StableWireBuffer();
            wire.WriteUtf8("microi-sql-command-template-v1");
            wire.WriteUtf8(commandText);
            return wire.ComputeSha256Text();
        }

        internal static string BulkOperationDigest(
            BulkInsertOperation operation)
        {
            return BulkSqlTreeWalker.ComputeOperationDigest(operation);
        }

        internal static string AdminOperationDigest(
            DatabaseAdminOperation operation)
        {
            return CompiledPlanWireEncoder.ComputeAdminDigest(operation);
        }
    }

    internal sealed class ParameterDefinitionCatalog
    {
        private readonly Dictionary<string, ParameterDefinition> _definitions =
            new Dictionary<string, ParameterDefinition>(StringComparer.Ordinal);

        internal void Add(
            ParameterDefinition definition,
            string parameterName)
        {
            if (definition == null)
            {
                throw new ArgumentException(
                    "A parameter definition cannot be null.",
                    parameterName);
            }

            ParameterDefinition existing;
            if (!_definitions.TryGetValue(definition.Name, out existing))
            {
                _definitions.Add(definition.Name, definition);
                return;
            }

            if (!AreEquivalent(existing, definition))
            {
                throw new ArgumentException(
                    "A logical parameter name has conflicting definitions.",
                    parameterName);
            }
        }

        internal void AddRange(
            IReadOnlyList<ParameterDefinition> definitions,
            string parameterName)
        {
            for (var index = 0; index < definitions.Count; index++)
            {
                Add(definitions[index], parameterName);
            }
        }

        internal void EnsureEquivalent(
            ParameterDefinitionCatalog other,
            string parameterName)
        {
            if (other == null)
            {
                throw new ArgumentNullException(nameof(other));
            }

            if (_definitions.Count != other._definitions.Count)
            {
                throw new ArgumentException(
                    "Parameter definition catalogs do not have exact coverage.",
                    parameterName);
            }

            foreach (var item in _definitions)
            {
                ParameterDefinition otherDefinition;
                if (!other._definitions.TryGetValue(
                        item.Key, out otherDefinition)
                    || !AreEquivalent(item.Value, otherDefinition))
                {
                    throw new ArgumentException(
                        "Parameter definition catalogs are not equivalent.",
                        parameterName);
                }
            }
        }

        private static bool AreEquivalent(
            ParameterDefinition first,
            ParameterDefinition second)
        {
            return first.Type.Equals(second.Type)
                && first.Direction == second.Direction
                && first.IsNullable == second.IsNullable;
        }
    }

    internal static class PlanCompositionValidator
    {
        internal static void ValidateCommandResult(
            SqlResultShape resultShape,
            PlanResultRole resultRole)
        {
            switch (resultShape)
            {
                case SqlResultShape.None:
                case SqlResultShape.AffectedRows:
                case SqlResultShape.Scalar:
                case SqlResultShape.RowSet:
                case SqlResultShape.ReturningRows:
                case SqlResultShape.MultipleResultSets:
                case SqlResultShape.Metadata:
                case SqlResultShape.Diagnostic:
                    break;
                default:
                    throw new ArgumentException(
                        "The result shape is not valid for a command step.",
                        nameof(resultShape));
            }

            if (resultRole != PlanResultRole.None
                && resultShape == SqlResultShape.None)
            {
                throw new ArgumentException(
                    "A contributing step requires a non-None result shape.",
                    nameof(resultRole));
            }
        }

        internal static void ValidateNativeResult(SqlResultShape resultShape)
        {
            switch (resultShape)
            {
                case SqlResultShape.None:
                case SqlResultShape.AffectedRows:
                case SqlResultShape.Scalar:
                case SqlResultShape.RowSet:
                case SqlResultShape.ReturningRows:
                case SqlResultShape.MultipleResultSets:
                    return;
                default:
                    throw new ArgumentException(
                        "The result shape is not valid for native text.",
                        nameof(resultShape));
            }
        }

        internal static void ValidateOrdinaryCommands(
            IReadOnlyList<SqlCommandStep> commands)
        {
            var parameters = new ParameterDefinitionCatalog();
            for (var index = 0; index < commands.Count; index++)
            {
                var command = commands[index];
                if (command.SourceMigrationStepId != null)
                {
                    throw new ArgumentException(
                        "An ordinary command cannot carry a migration step ID.",
                        nameof(commands));
                }
                if (command.ConnectionRole != PlanConnectionRole.CurrentDatabase)
                {
                    throw new ArgumentException(
                        "An ordinary command must use the current database route.",
                        nameof(commands));
                }
                parameters.AddRange(command.Parameters, nameof(commands));
            }
        }

        internal static SqlResultShape DeriveStatementResult(
            SqlStatement source,
            IReadOnlyList<SqlCommandStep> commands)
        {
            var select = source as SelectStatement;
            if (select != null && select.Page != null)
            {
                if (commands.Count != 2
                    || commands[0].ResultRole != PlanResultRole.Aggregate
                    || commands[0].ResultShape != SqlResultShape.Scalar
                    || commands[1].ResultRole != PlanResultRole.Aggregate
                    || commands[1].ResultShape != SqlResultShape.RowSet)
                {
                    throw new ArgumentException(
                        "A paged query requires ordered scalar and row-set commands.",
                        nameof(commands));
                }
                return SqlResultShape.MultipleResultSets;
            }
            return DeriveResult(commands);
        }

        internal static SqlResultShape DeriveResult(
            IReadOnlyList<DatabasePlanStep> steps)
        {
            var finalCount = 0;
            DatabasePlanStep final = null;
            var aggregates = new List<DatabasePlanStep>();

            for (var index = 0; index < steps.Count; index++)
            {
                var step = steps[index];
                if (step.ResultRole == PlanResultRole.Final)
                {
                    finalCount++;
                    final = step;
                }
                else if (step.ResultRole == PlanResultRole.Aggregate)
                {
                    aggregates.Add(step);
                }
            }

            if (finalCount == 0 && aggregates.Count == 0)
            {
                return SqlResultShape.None;
            }
            if (finalCount == 1 && aggregates.Count == 0)
            {
                return final.ResultShape;
            }
            if (finalCount != 0)
            {
                throw new ArgumentException(
                    "Final and aggregate result contributors are ambiguous.",
                    nameof(steps));
            }

            if (aggregates.Count == 2
                && aggregates[0].ResultShape == SqlResultShape.Scalar
                && aggregates[1].ResultShape == SqlResultShape.RowSet)
            {
                return SqlResultShape.MultipleResultSets;
            }

            var aggregateShape = aggregates[0].ResultShape;
            if (aggregateShape != SqlResultShape.AffectedRows
                && aggregateShape != SqlResultShape.ReturningRows)
            {
                throw new ArgumentException(
                    "The aggregate result shape is unsupported.",
                    nameof(steps));
            }
            for (var index = 1; index < aggregates.Count; index++)
            {
                if (aggregates[index].ResultShape != aggregateShape)
                {
                    throw new ArgumentException(
                        "Aggregate result shapes must be homogeneous.",
                        nameof(steps));
                }
            }
            return aggregateShape;
        }

        internal static void ValidateMigration(
            IReadOnlyList<SqlCommandStep> commands,
            MigrationPlanSafetyBinding safety)
        {
            if (safety.Entries.Count == 0)
            {
                if (commands.Count != 0)
                {
                    throw new ArgumentException(
                        "An empty migration cannot contain commands.",
                        nameof(commands));
                }
                return;
            }

            var parameters = new ParameterDefinitionCatalog();
            var commandIndex = 0;
            for (var entryIndex = 0;
                entryIndex < safety.Entries.Count;
                entryIndex++)
            {
                var entry = safety.Entries[entryIndex];
                var blockCount = 0;
                while (commandIndex < commands.Count
                    && commands[commandIndex].SourceMigrationStepId != null
                    && commands[commandIndex].SourceMigrationStepId.Equals(
                        entry.StepId))
                {
                    var command = commands[commandIndex];
                    if (command.ConnectionRole
                            != PlanConnectionRole.CurrentDatabase
                        || command.ResultRole != PlanResultRole.None)
                    {
                        throw new ArgumentException(
                            "A migration command has incompatible metadata.",
                            nameof(commands));
                    }
                    parameters.AddRange(command.Parameters, nameof(commands));
                    commandIndex++;
                    blockCount++;
                }
                if (blockCount == 0)
                {
                    throw new ArgumentException(
                        "Every migration step requires one contiguous command block.",
                        nameof(commands));
                }
            }
            if (commandIndex != commands.Count)
            {
                throw new ArgumentException(
                    "Migration commands contain an unknown or reordered step ID.",
                    nameof(commands));
            }
        }

        internal static void ValidateBulk(BulkStep step)
        {
            if (step.ConnectionRole == PlanConnectionRole.Administrative)
            {
                throw new ArgumentException(
                    "Bulk work cannot use the administrative route.",
                    nameof(step));
            }

            var parameters = new ParameterDefinitionCatalog();
            BulkSqlTreeWalker.CollectParameters(step.Operation, parameters);
            for (var index = 0; index < step.Batches.Count; index++)
            {
                parameters.AddRange(
                    step.Batches[index].Command.Parameters, nameof(step));
            }
        }

        internal static PlanSafetyBinding CreateAdminSafety(
            DatabaseAdminOperation operation,
            DestructiveImpact effectiveImpact)
        {
            if (operation is CreateDatabaseOperation)
            {
                RequireNoAdminElevation(effectiveImpact);
                return NoTask6ImpactBinding.Instance;
            }
            var drop = operation as DropDatabaseOperation;
            if (drop != null)
            {
                return DatabaseAdminSafetyBinding.ForDropDatabase(
                    drop, effectiveImpact);
            }
            if (operation is DatabaseExportOperation)
            {
                RequireNoAdminElevation(effectiveImpact);
                return NoTask6ImpactBinding.Instance;
            }
            var import = operation as DatabaseImportOperation;
            if (import != null)
            {
                return DatabaseAdminSafetyBinding.ForImport(
                    import, effectiveImpact);
            }
            throw new ArgumentException(
                "Unknown admin operation subtype.", nameof(operation));
        }

        internal static void ValidateAdminRoute(
            DatabaseAdminOperation operation,
            AdminStep step)
        {
            if (operation is CreateDatabaseOperation
                || operation is DropDatabaseOperation)
            {
                if (step.ConnectionRole != PlanConnectionRole.Administrative)
                {
                    throw new ArgumentException(
                        "This admin operation requires the administrative route.",
                        nameof(step));
                }
                return;
            }
            if (operation is DatabaseExportOperation
                || operation is DatabaseImportOperation)
            {
                if (step.ConnectionRole == PlanConnectionRole.DedicatedBulk)
                {
                    throw new ArgumentException(
                        "Admin work cannot use the dedicated bulk route.",
                        nameof(step));
                }
                return;
            }
            throw new ArgumentException(
                "Unknown admin operation subtype.", nameof(operation));
        }

        internal static void ValidateAtomicity(
            AtomicityRequirement atomicity,
            IReadOnlyList<DatabasePlanStep> steps,
            DialectProfile profile)
        {
            CompilationModelGuard.EnsureDefined(
                typeof(AtomicityRequirement), atomicity,
                nameof(atomicity));
            if (atomicity != AtomicityRequirement.Required)
            {
                return;
            }

            for (var index = 0; index < steps.Count; index++)
            {
                var step = steps[index];
                if (step.ConnectionRole != PlanConnectionRole.CurrentDatabase
                    || step.TransactionBehavior
                        != PlanTransactionBehavior.Enlistable)
                {
                    throw new ArgumentException(
                        "Required atomicity is unsupported for profile "
                        + profile.Fingerprint + " at step "
                        + index.ToString(CultureInfo.InvariantCulture)
                        + " (" + step.GetType().Name
                        + ", route=" + step.ConnectionRole
                        + ", transaction=" + step.TransactionBehavior + ").",
                        nameof(steps));
                }
            }
        }

        private static void RequireNoAdminElevation(
            DestructiveImpact effectiveImpact)
        {
            if (effectiveImpact != DestructiveImpact.None)
            {
                throw new ArgumentException(
                    "This admin operation cannot be elevated.",
                    nameof(effectiveImpact));
            }
        }
    }

    internal static class CompiledApprovalValidator
    {
        internal static StructuralFingerprint SourceFingerprint(
            PlanSafetyBinding safety)
        {
            var migration = safety as MigrationPlanSafetyBinding;
            if (migration != null)
            {
                return migration.SourceFingerprint;
            }
            var admin = safety as DatabaseAdminSafetyBinding;
            if (admin != null)
            {
                return admin.SourceFingerprint;
            }
            throw new InvalidOperationException(
                "The safety binding has no authoritative source fingerprint.");
        }

        internal static IReadOnlyList<CompiledImpactEntry> ElevatedEntries(
            PlanSafetyBinding safety)
        {
            var migration = safety as MigrationPlanSafetyBinding;
            if (migration == null)
            {
                return CompilationModelGuard
                    .EmptyReadOnly<CompiledImpactEntry>();
            }

            var entries = new List<CompiledImpactEntry>();
            for (var index = 0; index < migration.Entries.Count; index++)
            {
                if (migration.Entries[index].IsElevated)
                {
                    entries.Add(migration.Entries[index]);
                }
            }
            return Array.AsReadOnly(entries.ToArray());
        }

        internal static void Validate(
            DatabaseExecutionPlan plan,
            CompiledImpactApproval approval)
        {
            if (!SourceFingerprint(plan.Safety).Equals(
                    approval.SourceFingerprint)
                || !plan.DialectProfile.Equals(approval.DialectProfile)
                || !SchemaEquals(plan.SchemaToken, approval.SchemaToken)
                || !plan.Fingerprint.Equals(approval.PlanFingerprint)
                || plan.Safety.EffectiveImpact != approval.EffectiveImpact)
            {
                throw new ArgumentException(
                    "The compiled approval does not match this plan.",
                    nameof(approval));
            }

            var expected = ElevatedEntries(plan.Safety);
            if (expected.Count != approval.ElevatedMigrationSteps.Count)
            {
                throw new ArgumentException(
                    "The compiled approval entry set is incomplete.",
                    nameof(approval));
            }
            for (var index = 0; index < expected.Count; index++)
            {
                var left = expected[index];
                var right = approval.ElevatedMigrationSteps[index];
                if (!left.StepId.Equals(right.StepId)
                    || left.NeutralImpact != right.NeutralImpact
                    || left.EffectiveImpact != right.EffectiveImpact)
                {
                    throw new ArgumentException(
                        "The compiled approval entries do not match this plan.",
                        nameof(approval));
                }
            }
        }

        private static bool SchemaEquals(
            SchemaToken first,
            SchemaToken second)
        {
            if (first == null || second == null)
            {
                return first == null && second == null;
            }
            return first.Equals(second);
        }
    }

    internal static class BulkSqlTreeWalker
    {
        internal static void CollectParameters(
            BulkInsertOperation operation,
            ParameterDefinitionCatalog catalog)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }
            TraverseOperation(null, operation, catalog);
        }

        internal static void WriteOperation(
            StableWireBuffer wire,
            BulkInsertOperation operation)
        {
            if (wire == null)
            {
                throw new ArgumentNullException(nameof(wire));
            }
            TraverseOperation(wire, operation, null);
        }

        internal static string ComputeOperationDigest(
            BulkInsertOperation operation)
        {
            var wire = new StableWireBuffer();
            wire.WriteUtf8("microi-bulk-operation-summary-v1");
            WriteOperation(wire, operation);
            return wire.ComputeSha256Text();
        }

        internal static void WriteIdentifier(
            StableWireBuffer wire,
            SqlIdentifier identifier)
        {
            wire.WriteUtf8("identifier");
            wire.WriteUtf8(identifier.Value);
        }

        internal static void WriteObjectName(
            StableWireBuffer wire,
            SqlObjectName name)
        {
            wire.WriteUtf8("object-name");
            WriteOptionalIdentifier(wire, name.Catalog);
            WriteOptionalIdentifier(wire, name.Schema);
            WriteIdentifier(wire, name.Name);
        }

        internal static void WriteAlias(
            StableWireBuffer wire,
            SqlAlias alias)
        {
            wire.WriteUtf8("alias");
            WriteIdentifier(wire, alias.Identifier);
        }

        internal static void WriteType(
            StableWireBuffer wire,
            SqlTypeDescriptor type)
        {
            wire.WriteUtf8("type-descriptor");
            wire.WriteEnum(typeof(LogicalDbType), type.LogicalType);
            WriteOptionalInt32(wire, type.Length);
            WriteOptionalInt32(wire, type.Precision);
            WriteOptionalInt32(wire, type.Scale);
        }

        internal static void WriteParameter(
            StableWireBuffer wire,
            ParameterDefinition definition)
        {
            wire.WriteUtf8("parameter-definition");
            wire.WriteUtf8(definition.Name);
            WriteType(wire, definition.Type);
            wire.WriteEnum(
                typeof(System.Data.ParameterDirection),
                definition.Direction);
            wire.WriteBoolean(definition.IsNullable);
        }

        internal static void WriteMigrationPlanId(
            StableWireBuffer wire,
            MigrationPlanId id)
        {
            wire.WriteUtf8("migration-plan-id");
            wire.WriteUtf8(id.Value);
        }

        internal static void WriteMigrationStepId(
            StableWireBuffer wire,
            MigrationStepId id)
        {
            wire.WriteUtf8("migration-step-id");
            wire.WriteUtf8(id.Value);
        }

        internal static void WriteSchemaToken(
            StableWireBuffer wire,
            SchemaToken token)
        {
            wire.WriteUtf8("schema-token");
            wire.WriteUtf8(token.Value);
        }

        internal static void WriteStructuralFingerprint(
            StableWireBuffer wire,
            StructuralFingerprint fingerprint)
        {
            wire.WriteUtf8("structural-fingerprint");
            wire.WriteUtf8(fingerprint.Value);
        }

        internal static void WriteResource(
            StableWireBuffer wire,
            DatabaseResourceHandle resource)
        {
            wire.WriteUtf8("database-resource-handle");
            wire.WriteGuidRfc4122(resource.Id);
            wire.WriteUtf8("resource-content-digest");
            wire.WriteUtf8(resource.ContentDigest.Value);
        }

        private static void TraverseOperation(
            StableWireBuffer wire,
            BulkInsertOperation operation,
            ParameterDefinitionCatalog catalog)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }

            if (wire != null)
            {
                wire.WriteUtf8("bulk-insert-operation");
                WriteObjectName(wire, operation.Table);
                WriteCount(wire, operation.Columns.Count);
                for (var index = 0; index < operation.Columns.Count; index++)
                {
                    WriteIdentifier(wire, operation.Columns[index]);
                }
                WriteCount(wire, operation.Rows.Count);
            }

            for (var rowIndex = 0;
                rowIndex < operation.Rows.Count;
                rowIndex++)
            {
                var row = operation.Rows[rowIndex];
                if (wire != null)
                {
                    wire.WriteUtf8("bulk-insert-row");
                    WriteCount(wire, row.Values.Count);
                }
                for (var valueIndex = 0;
                    valueIndex < row.Values.Count;
                    valueIndex++)
                {
                    TraverseExpression(
                        wire, row.Values[valueIndex], catalog);
                }
            }

            if (wire != null)
            {
                wire.WriteInt32BigEndian(operation.BatchSize);
            }
        }

        private static void TraverseExpression(
            StableWireBuffer wire,
            SqlExpression expression,
            ParameterDefinitionCatalog catalog)
        {
            if (expression == null)
            {
                throw new ArgumentException(
                    "A SQL expression cannot be null.", nameof(expression));
            }

            var column = expression as ColumnExpression;
            if (column != null)
            {
                WriteTag(wire, "expr:column");
                if (wire != null)
                {
                    WriteIdentifier(wire, column.Name);
                    WriteOptionalAlias(wire, column.Source);
                }
                return;
            }

            var parameter = expression as ParameterExpression;
            if (parameter != null)
            {
                WriteTag(wire, "expr:parameter");
                if (catalog != null)
                {
                    catalog.Add(parameter.Definition, nameof(expression));
                }
                if (wire != null)
                {
                    WriteParameter(wire, parameter.Definition);
                }
                return;
            }

            if (expression is NullExpression)
            {
                WriteTag(wire, "expr:null");
                return;
            }

            var boolean = expression as BooleanExpression;
            if (boolean != null)
            {
                WriteTag(wire, "expr:boolean");
                if (wire != null)
                {
                    wire.WriteBoolean(boolean.Value);
                }
                return;
            }

            var binary = expression as BinaryExpression;
            if (binary != null)
            {
                WriteTag(wire, "expr:binary");
                TraverseExpression(wire, binary.Left, catalog);
                WriteEnum(wire, typeof(SqlBinaryOperator), binary.Operator);
                TraverseExpression(wire, binary.Right, catalog);
                return;
            }

            var unary = expression as UnaryExpression;
            if (unary != null)
            {
                WriteTag(wire, "expr:unary");
                WriteEnum(wire, typeof(SqlUnaryOperator), unary.Operator);
                TraverseExpression(wire, unary.Operand, catalog);
                return;
            }

            var inExpression = expression as InExpression;
            if (inExpression != null)
            {
                WriteTag(wire, "expr:in");
                TraverseExpression(wire, inExpression.Operand, catalog);
                WriteCount(wire, inExpression.Values.Count);
                for (var index = 0;
                    index < inExpression.Values.Count;
                    index++)
                {
                    TraverseExpression(
                        wire, inExpression.Values[index], catalog);
                }
                return;
            }

            var between = expression as BetweenExpression;
            if (between != null)
            {
                WriteTag(wire, "expr:between");
                TraverseExpression(wire, between.Operand, catalog);
                TraverseExpression(wire, between.Lower, catalog);
                TraverseExpression(wire, between.Upper, catalog);
                return;
            }

            var caseExpression = expression as CaseExpression;
            if (caseExpression != null)
            {
                WriteTag(wire, "expr:case");
                TraverseOptionalExpression(
                    wire, caseExpression.InputExpression, catalog);
                WriteCount(wire, caseExpression.WhenClauses.Count);
                for (var index = 0;
                    index < caseExpression.WhenClauses.Count;
                    index++)
                {
                    var clause = caseExpression.WhenClauses[index];
                    WriteTag(wire, "expr:case-when");
                    TraverseExpression(wire, clause.When, catalog);
                    TraverseExpression(wire, clause.Then, catalog);
                }
                TraverseOptionalExpression(
                    wire, caseExpression.ElseExpression, catalog);
                return;
            }

            var cast = expression as CastExpression;
            if (cast != null)
            {
                WriteTag(wire, "expr:cast");
                TraverseExpression(wire, cast.Expression, catalog);
                if (wire != null)
                {
                    WriteType(wire, cast.Type);
                }
                return;
            }

            var subquery = expression as SubqueryExpression;
            if (subquery != null)
            {
                WriteTag(wire, "expr:subquery");
                var select = subquery.Query as SelectStatement;
                if (select == null)
                {
                    throw Unsupported("subquery node");
                }
                TraverseSelect(wire, select, catalog);
                return;
            }

            var exists = expression as ExistsExpression;
            if (exists != null)
            {
                WriteTag(wire, "expr:exists");
                TraverseExpression(wire, exists.Subquery, catalog);
                return;
            }

            var aggregate = expression as AggregateExpression;
            if (aggregate != null)
            {
                WriteTag(wire, "expr:aggregate");
                if (wire != null)
                {
                    WriteFunction(wire, aggregate.Function);
                }
                TraverseOptionalExpression(
                    wire, aggregate.Argument, catalog);
                if (wire != null)
                {
                    wire.WriteBoolean(aggregate.Distinct);
                }
                return;
            }

            var function = expression as FunctionExpression;
            if (function != null)
            {
                WriteTag(wire, "expr:function");
                if (wire != null)
                {
                    WriteFunction(wire, function.Function);
                    WriteCount(wire, function.Arguments.Count);
                }
                for (var index = 0;
                    index < function.Arguments.Count;
                    index++)
                {
                    TraverseExpression(
                        wire, function.Arguments[index], catalog);
                }
                return;
            }

            var wildcard = expression as WildcardExpression;
            if (wildcard != null)
            {
                WriteTag(wire, "expr:wildcard");
                if (wire != null)
                {
                    WriteOptionalAlias(wire, wildcard.Source);
                }
                return;
            }

            throw Unsupported("SQL expression");
        }

        private static void TraverseSelect(
            StableWireBuffer wire,
            SelectStatement select,
            ParameterDefinitionCatalog catalog)
        {
            if (select == null)
            {
                throw Unsupported("query node");
            }
            WriteTag(wire, "query:select");

            if (select.From == null)
            {
                WriteAbsent(wire);
            }
            else
            {
                WritePresent(wire);
                TraverseTable(wire, select.From, catalog);
            }

            WriteCount(wire, select.Projections.Count);
            for (var index = 0;
                index < select.Projections.Count;
                index++)
            {
                var projection = select.Projections[index];
                WriteTag(wire, "query:projection");
                TraverseExpression(wire, projection.Expression, catalog);
                if (wire != null)
                {
                    WriteOptionalAlias(wire, projection.Alias);
                }
            }

            if (wire != null)
            {
                wire.WriteBoolean(select.Distinct);
            }
            TraverseOptionalExpression(wire, select.Where, catalog);

            WriteCount(wire, select.GroupBy.Count);
            for (var index = 0; index < select.GroupBy.Count; index++)
            {
                TraverseExpression(wire, select.GroupBy[index], catalog);
            }
            TraverseOptionalExpression(wire, select.Having, catalog);

            WriteCount(wire, select.OrderBy.Count);
            for (var index = 0; index < select.OrderBy.Count; index++)
            {
                var order = select.OrderBy[index];
                WriteTag(wire, "query:order-by");
                TraverseExpression(wire, order.Expression, catalog);
                WriteEnum(wire, typeof(SqlSortDirection), order.Direction);
                WriteEnum(wire, typeof(SqlNullSortOrder), order.NullSortOrder);
            }

            if (select.Page == null)
            {
                WriteAbsent(wire);
            }
            else
            {
                WritePresent(wire);
                TraversePage(wire, select.Page, catalog);
            }

            if (select.Lock == null)
            {
                WriteAbsent(wire);
            }
            else
            {
                WritePresent(wire);
                WriteTag(wire, "query:lock");
                WriteEnum(wire, typeof(SqlLockMode), select.Lock.Mode);
                WriteEnum(wire, typeof(SqlLockWait), select.Lock.Wait);
            }

            WriteCount(wire, select.CommonTableExpressions.Count);
            for (var index = 0;
                index < select.CommonTableExpressions.Count;
                index++)
            {
                var cte = select.CommonTableExpressions[index];
                WriteTag(wire, "query:cte");
                if (wire != null)
                {
                    WriteIdentifier(wire, cte.Name);
                }
                TraverseSelect(wire, cte.Query, catalog);
                WriteCount(wire, cte.Columns.Count);
                if (wire != null)
                {
                    for (var columnIndex = 0;
                        columnIndex < cte.Columns.Count;
                        columnIndex++)
                    {
                        WriteIdentifier(wire, cte.Columns[columnIndex]);
                    }
                    wire.WriteBoolean(cte.Recursive);
                }
            }

            WriteCount(wire, select.SetOperations.Count);
            for (var index = 0;
                index < select.SetOperations.Count;
                index++)
            {
                var set = select.SetOperations[index];
                WriteTag(wire, "query:set-operation");
                WriteEnum(wire, typeof(SqlSetOperator), set.Operator);
                TraverseSelect(wire, set.RightQuery, catalog);
            }
        }

        private static void TraverseTable(
            StableWireBuffer wire,
            SqlTableSource source,
            ParameterDefinitionCatalog catalog)
        {
            var named = source as NamedTableSource;
            if (named != null)
            {
                WriteTag(wire, "query:named-table");
                if (wire != null)
                {
                    WriteObjectName(wire, named.Name);
                    WriteOptionalAlias(wire, named.Alias);
                }
                return;
            }

            var derived = source as DerivedTableSource;
            if (derived != null)
            {
                WriteTag(wire, "query:derived-table");
                TraverseSelect(wire, derived.Query, catalog);
                if (wire != null)
                {
                    WriteAlias(wire, derived.Alias);
                }
                return;
            }

            var join = source as JoinSource;
            if (join != null)
            {
                WriteTag(wire, "query:join");
                TraverseTable(wire, join.Left, catalog);
                WriteEnum(wire, typeof(SqlJoinType), join.JoinType);
                TraverseTable(wire, join.Right, catalog);
                TraverseOptionalExpression(wire, join.Condition, catalog);
                return;
            }

            throw Unsupported("table source");
        }

        private static void TraversePage(
            StableWireBuffer wire,
            PageSpec page,
            ParameterDefinitionCatalog catalog)
        {
            var offset = page as OffsetPageSpec;
            if (offset != null)
            {
                WriteTag(wire, "query:page-offset");
                if (wire != null)
                {
                    wire.WriteInt32BigEndian(offset.Offset);
                    wire.WriteInt32BigEndian(offset.Limit);
                }
                return;
            }

            var keyset = page as KeysetPageSpec;
            if (keyset != null)
            {
                WriteTag(wire, "query:page-keyset");
                WriteCount(wire, keyset.Boundaries.Count);
                for (var index = 0;
                    index < keyset.Boundaries.Count;
                    index++)
                {
                    TraverseExpression(
                        wire, keyset.Boundaries[index], catalog);
                }
                if (wire != null)
                {
                    wire.WriteInt32BigEndian(keyset.Limit);
                }
                return;
            }

            throw Unsupported("page specification");
        }

        private static void TraverseOptionalExpression(
            StableWireBuffer wire,
            SqlExpression expression,
            ParameterDefinitionCatalog catalog)
        {
            if (expression == null)
            {
                WriteAbsent(wire);
                return;
            }
            WritePresent(wire);
            TraverseExpression(wire, expression, catalog);
        }

        private static void WriteFunction(
            StableWireBuffer wire,
            SemanticFunctionId function)
        {
            wire.WriteUtf8("semantic-function");
            wire.WriteUtf8(function.Key);
            wire.WriteInt32BigEndian(function.MinArguments);
            WriteOptionalInt32(wire, function.MaxArguments);
            wire.WriteBoolean(function.IsAggregate);
        }

        private static void WriteOptionalIdentifier(
            StableWireBuffer wire,
            SqlIdentifier identifier)
        {
            if (identifier == null)
            {
                wire.WriteByte(0);
                return;
            }
            wire.WriteByte(1);
            WriteIdentifier(wire, identifier);
        }

        private static void WriteOptionalAlias(
            StableWireBuffer wire,
            SqlAlias alias)
        {
            if (alias == null)
            {
                wire.WriteByte(0);
                return;
            }
            wire.WriteByte(1);
            WriteAlias(wire, alias);
        }

        private static void WriteOptionalInt32(
            StableWireBuffer wire,
            int? value)
        {
            if (!value.HasValue)
            {
                wire.WriteByte(0);
                return;
            }
            wire.WriteByte(1);
            wire.WriteInt32BigEndian(value.Value);
        }

        private static void WriteTag(
            StableWireBuffer wire,
            string tag)
        {
            if (wire != null)
            {
                wire.WriteUtf8(tag);
            }
        }

        private static void WriteEnum(
            StableWireBuffer wire,
            Type enumType,
            object value)
        {
            if (wire != null)
            {
                wire.WriteEnum(enumType, value);
            }
        }

        private static void WriteCount(StableWireBuffer wire, int count)
        {
            if (wire != null)
            {
                wire.WriteUInt32BigEndian(unchecked((uint)count));
            }
        }

        private static void WriteAbsent(StableWireBuffer wire)
        {
            if (wire != null)
            {
                wire.WriteByte(0);
            }
        }

        private static void WritePresent(StableWireBuffer wire)
        {
            if (wire != null)
            {
                wire.WriteByte(1);
            }
        }

        private static ArgumentException Unsupported(string category)
        {
            return new ArgumentException(
                "Unknown or unsupported " + category + " subtype.");
        }
    }

    internal static class CompiledPlanWireEncoder
    {
        internal static CompiledPlanFingerprint Encode(
            DialectProfile dialectProfile,
            SchemaToken schemaToken,
            SqlSafetyOrigin origin,
            AtomicityRequirement atomicity,
            PlanCachePolicy cachePolicy,
            SqlResultShape resultShape,
            PlanSafetyBinding safety,
            IReadOnlyList<DatabasePlanStep> steps)
        {
            if (dialectProfile == null)
            {
                throw new ArgumentNullException(nameof(dialectProfile));
            }
            if (safety == null)
            {
                throw new ArgumentNullException(nameof(safety));
            }
            if (steps == null)
            {
                throw new ArgumentNullException(nameof(steps));
            }

            var wire = new StableWireBuffer();
            wire.WriteUtf8("microi-database-execution-plan-v1");
            DialectProfileWire.Write(wire, dialectProfile);
            WriteOptionalSchemaToken(wire, schemaToken);
            wire.WriteEnum(typeof(SqlSafetyOrigin), origin);
            wire.WriteEnum(typeof(AtomicityRequirement), atomicity);
            wire.WriteEnum(typeof(PlanCachePolicy), cachePolicy);
            wire.WriteEnum(typeof(SqlResultShape), resultShape);
            WriteSafety(wire, safety);
            WriteCount(wire, steps.Count);
            for (var index = 0; index < steps.Count; index++)
            {
                WriteStep(wire, steps[index]);
            }

            return new CompiledPlanFingerprint(wire.ComputeSha256Text());
        }

        internal static string ComputeAdminDigest(
            DatabaseAdminOperation operation)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            var wire = new StableWireBuffer();
            wire.WriteUtf8("microi-admin-operation-summary-v1");
            WriteAdmin(wire, operation);
            return wire.ComputeSha256Text();
        }

        private static void WriteSafety(
            StableWireBuffer wire,
            PlanSafetyBinding safety)
        {
            if (safety is NoTask6ImpactBinding)
            {
                wire.WriteUtf8("safety:no-task6-impact");
                wire.WriteEnum(
                    typeof(DestructiveImpact), safety.NeutralImpact);
                wire.WriteEnum(
                    typeof(DestructiveImpact), safety.EffectiveImpact);
                return;
            }

            var migration = safety as MigrationPlanSafetyBinding;
            if (migration != null)
            {
                wire.WriteUtf8("safety:migration");
                wire.WriteEnum(
                    typeof(DestructiveImpact), migration.NeutralImpact);
                wire.WriteEnum(
                    typeof(DestructiveImpact), migration.EffectiveImpact);
                BulkSqlTreeWalker.WriteMigrationPlanId(
                    wire, migration.PlanId);
                BulkSqlTreeWalker.WriteStructuralFingerprint(
                    wire, migration.SourceFingerprint);
                WriteCount(wire, migration.Entries.Count);
                for (var index = 0;
                    index < migration.Entries.Count;
                    index++)
                {
                    WriteImpact(wire, migration.Entries[index]);
                }
                return;
            }

            var admin = safety as DatabaseAdminSafetyBinding;
            if (admin != null)
            {
                if (admin.Operation is DropDatabaseOperation)
                {
                    wire.WriteUtf8("safety:admin-drop-database");
                }
                else if (admin.Operation is DatabaseImportOperation)
                {
                    wire.WriteUtf8("safety:admin-import");
                }
                else
                {
                    throw new ArgumentException(
                        "Unknown admin safety operation subtype.",
                        nameof(safety));
                }
                wire.WriteEnum(
                    typeof(DestructiveImpact), admin.NeutralImpact);
                wire.WriteEnum(
                    typeof(DestructiveImpact), admin.EffectiveImpact);
                BulkSqlTreeWalker.WriteStructuralFingerprint(
                    wire, admin.SourceFingerprint);
                WriteAdmin(wire, admin.Operation);
                return;
            }

            throw new ArgumentException(
                "Unknown plan safety binding subtype.", nameof(safety));
        }

        private static void WriteImpact(
            StableWireBuffer wire,
            CompiledImpactEntry entry)
        {
            wire.WriteUtf8("compiled-impact-entry");
            BulkSqlTreeWalker.WriteMigrationStepId(wire, entry.StepId);
            wire.WriteEnum(
                typeof(DestructiveImpact), entry.NeutralImpact);
            wire.WriteEnum(
                typeof(DestructiveImpact), entry.EffectiveImpact);
        }

        private static void WriteStep(
            StableWireBuffer wire,
            DatabasePlanStep step)
        {
            var command = step as SqlCommandStep;
            if (command != null)
            {
                WriteCommand(wire, command);
                return;
            }

            var bulk = step as BulkStep;
            if (bulk != null)
            {
                if (bulk.ExecutionKind == BulkExecutionKind.Native)
                {
                    wire.WriteUtf8("step:bulk-native");
                }
                else if (bulk.ExecutionKind == BulkExecutionKind.BatchedSql)
                {
                    wire.WriteUtf8("step:bulk-batched-sql");
                }
                else
                {
                    throw new ArgumentException(
                        "Unknown bulk execution kind.", nameof(step));
                }
                WriteStepCommon(wire, bulk);
                BulkSqlTreeWalker.WriteOperation(wire, bulk.Operation);
                wire.WriteEnum(
                    typeof(BulkExecutionKind), bulk.ExecutionKind);
                wire.WriteInt32BigEndian(bulk.EffectiveBatchSize);
                WriteCount(wire, bulk.Batches.Count);
                for (var index = 0; index < bulk.Batches.Count; index++)
                {
                    WriteBulkBatch(wire, bulk.Batches[index]);
                }
                return;
            }

            var admin = step as AdminStep;
            if (admin != null)
            {
                wire.WriteUtf8("step:admin");
                WriteStepCommon(wire, admin);
                WriteAdmin(wire, admin.Operation);
                return;
            }

            var native = step as NativeScriptStep;
            if (native != null)
            {
                wire.WriteUtf8("step:native");
                WriteStepCommon(wire, native);
                wire.WriteUtf8(native.Text.Digest);
                wire.WriteInt32BigEndian(native.Text.Utf8Length);
                DialectProfileWire.Write(wire, native.Text.TargetProfile);
                wire.WriteEnum(
                    typeof(SqlSafetyOrigin), native.Text.Origin);
                wire.WriteEnum(
                    typeof(NativeSqlCommandKind), native.Text.Kind);
                WriteCount(wire, native.Parameters.Count);
                for (var index = 0;
                    index < native.Parameters.Count;
                    index++)
                {
                    BulkSqlTreeWalker.WriteParameter(
                        wire, native.Parameters[index]);
                }
                return;
            }

            throw new ArgumentException(
                "Unknown database plan step subtype.", nameof(step));
        }

        private static void WriteCommand(
            StableWireBuffer wire,
            SqlCommandStep command)
        {
            wire.WriteUtf8("step:sql-command");
            WriteStepCommon(wire, command);
            wire.WriteUtf8(command.CommandText);
            WriteCount(wire, command.Parameters.Count);
            for (var index = 0;
                index < command.Parameters.Count;
                index++)
            {
                BulkSqlTreeWalker.WriteParameter(
                    wire, command.Parameters[index]);
            }
        }

        private static void WriteStepCommon(
            StableWireBuffer wire,
            DatabasePlanStep step)
        {
            wire.WriteEnum(typeof(SqlResultShape), step.ResultShape);
            wire.WriteEnum(typeof(PlanResultRole), step.ResultRole);
            wire.WriteEnum(
                typeof(PlanConnectionRole), step.ConnectionRole);
            wire.WriteEnum(
                typeof(PlanTransactionBehavior), step.TransactionBehavior);
            if (step.SourceMigrationStepId == null)
            {
                wire.WriteByte(0);
            }
            else
            {
                wire.WriteByte(1);
                BulkSqlTreeWalker.WriteMigrationStepId(
                    wire, step.SourceMigrationStepId);
            }
        }

        private static void WriteBulkBatch(
            StableWireBuffer wire,
            BulkCommandBatch batch)
        {
            wire.WriteUtf8("bulk-command-batch");
            wire.WriteInt32BigEndian(batch.RowCount);
            WriteCommand(wire, batch.Command);
        }

        private static void WriteAdmin(
            StableWireBuffer wire,
            DatabaseAdminOperation operation)
        {
            var create = operation as CreateDatabaseOperation;
            if (create != null)
            {
                wire.WriteUtf8("admin:create-database");
                BulkSqlTreeWalker.WriteIdentifier(wire, create.Database);
                wire.WriteEnum(
                    typeof(CreateObjectBehavior), create.Behavior);
                return;
            }

            var drop = operation as DropDatabaseOperation;
            if (drop != null)
            {
                wire.WriteUtf8("admin:drop-database");
                BulkSqlTreeWalker.WriteIdentifier(wire, drop.Database);
                wire.WriteEnum(
                    typeof(DropObjectBehavior), drop.Behavior);
                return;
            }

            var export = operation as DatabaseExportOperation;
            if (export != null)
            {
                wire.WriteUtf8("admin:export-database");
                BulkSqlTreeWalker.WriteIdentifier(wire, export.Database);
                BulkSqlTreeWalker.WriteResource(wire, export.Resource);
                wire.WriteEnum(
                    typeof(DatabaseTransferFormat), export.Format);
                wire.WriteEnum(
                    typeof(DatabaseTransferScope), export.Scope);
                return;
            }

            var import = operation as DatabaseImportOperation;
            if (import != null)
            {
                wire.WriteUtf8("admin:import-database");
                BulkSqlTreeWalker.WriteIdentifier(wire, import.Database);
                BulkSqlTreeWalker.WriteResource(wire, import.Resource);
                wire.WriteEnum(
                    typeof(DatabaseTransferFormat), import.Format);
                wire.WriteEnum(
                    typeof(DatabaseTransferScope), import.Scope);
                wire.WriteEnum(
                    typeof(DatabaseImportConflictPolicy), import.Policy);
                return;
            }

            throw new ArgumentException(
                "Unknown admin operation subtype.", nameof(operation));
        }

        private static void WriteOptionalSchemaToken(
            StableWireBuffer wire,
            SchemaToken schemaToken)
        {
            if (schemaToken == null)
            {
                wire.WriteByte(0);
                return;
            }
            wire.WriteByte(1);
            BulkSqlTreeWalker.WriteSchemaToken(wire, schemaToken);
        }

        private static void WriteCount(StableWireBuffer wire, int count)
        {
            if (count < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(count));
            }
            wire.WriteUInt32BigEndian(unchecked((uint)count));
        }
    }
}
