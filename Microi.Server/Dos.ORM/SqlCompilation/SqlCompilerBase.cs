using System;
using System.Collections.Generic;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal enum SqlCompilationStage
    {
        Bind,
        Normalize,
        Validate,
        Lower,
        Optimize,
        AllocateParameters,
        Render,
        Plan
    }

    internal abstract class SqlCompilerBase : ISqlCompiler
    {
        public DatabaseExecutionPlan Compile(
            SqlStatement statement,
            SqlCompilationOptions options)
        {
            GuardSourceAndOptions(statement, options);
            var result = RunThroughRender(statement, null, options);
            var compiled = BuildOrdinarySourceAwarePlan(
                statement,
                result.Rendered,
                result.EffectiveImpact,
                options);
            Observe(SqlCompilationStage.Plan);
            AssertPlanPostconditions(compiled, options);
            return compiled;
        }

        public DatabaseExecutionPlan CompileMigration(
            MigrationPlan plan,
            SqlCompilationOptions options)
        {
            GuardMigrationAndOptions(plan, options);
            var commands = new List<SqlCommandStep>();
            var impacts = new List<CompiledImpactEntry>();
            for (var index = 0; index < plan.Steps.Count; index++)
            {
                var sourceStep = plan.Steps[index];
                var result = RunThroughRender(
                    sourceStep.Operation,
                    sourceStep.Id,
                    options);
                var stepCommands = BuildMigrationStepCommands(
                    sourceStep,
                    result.Rendered);
                AssertMigrationStepCorrelation(
                    sourceStep.Id,
                    stepCommands,
                    options.StorageContract);
                var impact = new CompiledImpactEntry(
                    sourceStep.Id,
                    sourceStep.Operation.Impact,
                    result.EffectiveImpact);
                commands.AddRange(stepCommands);
                impacts.Add(impact);
                Observe(SqlCompilationStage.Plan);
            }

            var compiled = DatabaseExecutionPlan.ForMigration(
                plan,
                impacts,
                commands,
                options);
            AssertPlanPostconditions(compiled, options);
            return compiled;
        }

        internal abstract DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile);

        internal abstract SqlNode Lower(
            SqlNode node,
            SqlLoweringContext context);

        internal abstract SqlNode Optimize(
            SqlNode node,
            SqlLoweringContext context);

        internal abstract RenderedSql Render(
            AllocatedSqlNode node,
            SqlLoweringContext context);

        internal abstract DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context);

        internal virtual void Observe(SqlCompilationStage stage)
        {
        }

        private PipelineResult RunThroughRender(
            SqlStatement source,
            MigrationStepId sourceMigrationStepId,
            SqlCompilationOptions options)
        {
            var capabilities = ResolveCapabilities(options.DialectProfile);
            if (capabilities == null)
            {
                throw new InvalidOperationException(
                    "A dialect compiler returned no capability contract.");
            }
            var context = new SqlLoweringContext(
                options,
                capabilities,
                sourceMigrationStepId);

            var binding = new SqlAstBinder().Bind(source);
            Observe(SqlCompilationStage.Bind);
            var bound = binding.Root as SqlStatement;
            if (bound == null)
            {
                throw new InvalidOperationException(
                    "The SQL AST binder changed the statement root family.");
            }

            var normalized = new SqlAstNormalizer().Normalize(bound);
            Observe(SqlCompilationStage.Normalize);

            var diagnostics = MergeDiagnostics(
                binding.Diagnostics,
                new SqlAstValidator().Validate(normalized));
            Observe(SqlCompilationStage.Validate);
            if (diagnostics.Count != 0)
            {
                throw new SqlAstValidationException(
                    options.DialectProfile,
                    diagnostics);
            }

            var lowered = Lower(normalized, context);
            if (lowered == null)
            {
                throw new InvalidOperationException(
                    "A dialect compiler returned no lowered SQL node.");
            }
            Observe(SqlCompilationStage.Lower);

            var optimized = Optimize(lowered, context);
            if (optimized == null)
            {
                throw new InvalidOperationException(
                    "A dialect compiler returned no optimized SQL node.");
            }
            Observe(SqlCompilationStage.Optimize);

            var slots = new SqlParameterAllocator().Allocate(optimized);
            var allocated = new AllocatedSqlNode(optimized, slots);
            Observe(SqlCompilationStage.AllocateParameters);

            var rendered = Render(allocated, context);
            if (rendered == null)
            {
                throw new InvalidOperationException(
                    "A dialect compiler returned no rendered SQL result.");
            }
            Observe(SqlCompilationStage.Render);

            var effectiveImpact = DeriveEffectiveImpact(
                source,
                lowered,
                context);
            EnsureEffectiveImpact(source, effectiveImpact);
            return new PipelineResult(
                rendered,
                effectiveImpact);
        }

        private static DatabaseExecutionPlan BuildOrdinarySourceAwarePlan(
            SqlStatement source,
            RenderedSql rendered,
            DestructiveImpact effectiveImpact,
            SqlCompilationOptions options)
        {
            var schema = source as SchemaOperation;
            if (schema != null)
            {
                var commands = rendered.RequireCommands();
                AssertOrdinaryCorrelation(
                    commands, options.StorageContract);
                return DatabaseExecutionPlan.ForSchemaOperation(
                    schema,
                    effectiveImpact,
                    commands,
                    options);
            }

            var bulk = source as BulkInsertOperation;
            if (bulk != null)
            {
                var step = rendered.RequireBulk();
                if (!ReferenceEquals(step.Operation, bulk))
                {
                    throw new InvalidOperationException(
                        "Rendered bulk work lost its source operation identity.");
                }
                for (var index = 0; index < step.Batches.Count; index++)
                {
                    AssertCommandStorageContract(
                        step.Batches[index].Command,
                        options.StorageContract);
                }
                return DatabaseExecutionPlan.ForBulk(bulk, step, options);
            }

            var admin = source as DatabaseAdminOperation;
            if (admin != null)
            {
                var step = rendered.RequireAdmin();
                if (!ReferenceEquals(step.Operation, admin))
                {
                    throw new InvalidOperationException(
                        "Rendered admin work lost its source operation identity.");
                }
                return DatabaseExecutionPlan.ForAdmin(
                    admin,
                    effectiveImpact,
                    step,
                    options);
            }

            var ordinaryCommands = rendered.RequireCommands();
            AssertOrdinaryCorrelation(
                ordinaryCommands, options.StorageContract);
            return DatabaseExecutionPlan.ForStatement(
                source,
                ordinaryCommands,
                options);
        }

        private static IReadOnlyList<SqlCommandStep>
            BuildMigrationStepCommands(
                MigrationStep sourceStep,
                RenderedSql rendered)
        {
            if (sourceStep == null)
            {
                throw new ArgumentNullException(nameof(sourceStep));
            }
            return rendered.RequireCommands();
        }

        private static void AssertMigrationStepCorrelation(
            MigrationStepId sourceStepId,
            IReadOnlyList<SqlCommandStep> commands,
            DatabaseStorageContract storageContract)
        {
            for (var index = 0; index < commands.Count; index++)
            {
                var commandStepId = commands[index].SourceMigrationStepId;
                if (commandStepId == null
                    || !sourceStepId.Equals(commandStepId))
                {
                    throw new InvalidOperationException(
                        "A migration command has an incorrect source step ID.");
                }
                AssertCommandStorageContract(
                    commands[index], storageContract);
            }
        }

        private static void AssertOrdinaryCorrelation(
            IReadOnlyList<SqlCommandStep> commands,
            DatabaseStorageContract storageContract)
        {
            for (var index = 0; index < commands.Count; index++)
            {
                if (commands[index].SourceMigrationStepId != null)
                {
                    throw new InvalidOperationException(
                        "An ordinary command cannot carry a migration step ID.");
                }
                AssertCommandStorageContract(
                    commands[index], storageContract);
            }
        }

        private static void AssertCommandStorageContract(
            SqlCommandStep command,
            DatabaseStorageContract storageContract)
        {
            if (!command.InternalValueContract.StorageContractFingerprint.Equals(
                    storageContract.Fingerprint))
            {
                throw new InvalidOperationException(
                    "A rendered command does not match the compilation storage contract.");
            }
        }

        private static IReadOnlyList<SqlAstDiagnostic> MergeDiagnostics(
            IReadOnlyList<SqlAstDiagnostic> bindingDiagnostics,
            IReadOnlyList<SqlAstDiagnostic> validationDiagnostics)
        {
            if (bindingDiagnostics == null)
            {
                throw new ArgumentNullException(nameof(bindingDiagnostics));
            }
            if (validationDiagnostics == null)
            {
                throw new ArgumentNullException(nameof(validationDiagnostics));
            }
            if (bindingDiagnostics.Count == 0)
            {
                return validationDiagnostics;
            }
            if (validationDiagnostics.Count == 0)
            {
                return bindingDiagnostics;
            }

            var merged = new List<SqlAstDiagnostic>(
                bindingDiagnostics.Count + validationDiagnostics.Count);
            merged.AddRange(bindingDiagnostics);
            merged.AddRange(validationDiagnostics);
            return merged.AsReadOnly();
        }

        private static void EnsureEffectiveImpact(
            SqlStatement source,
            DestructiveImpact effectiveImpact)
        {
            CompilationModelGuard.EnsureImpactArgument(
                effectiveImpact,
                nameof(effectiveImpact));
            var neutralImpact = DestructiveImpact.None;
            var schema = source as SchemaOperation;
            if (schema != null)
            {
                neutralImpact = schema.Impact;
            }
            else
            {
                var admin = source as DatabaseAdminOperation;
                if (admin != null)
                {
                    neutralImpact = admin.Impact;
                }
            }

            if (schema == null
                && !(source is DatabaseAdminOperation)
                && effectiveImpact != DestructiveImpact.None)
            {
                throw new InvalidOperationException(
                    "Only schema or admin sources can carry destructive impact.");
            }

            if (CompilationModelGuard.ImpactRank(effectiveImpact)
                < CompilationModelGuard.ImpactRank(neutralImpact))
            {
                throw new InvalidOperationException(
                    "A dialect compiler cannot reduce source impact.");
            }
        }

        private static void GuardSourceAndOptions(
            SqlStatement statement,
            SqlCompilationOptions options)
        {
            if (statement == null)
            {
                throw new ArgumentNullException(nameof(statement));
            }
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }
        }

        private static void GuardMigrationAndOptions(
            MigrationPlan plan,
            SqlCompilationOptions options)
        {
            if (plan == null)
            {
                throw new ArgumentNullException(nameof(plan));
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
        }

        private static void AssertPlanPostconditions(
            DatabaseExecutionPlan plan,
            SqlCompilationOptions options)
        {
            if (plan == null)
            {
                throw new InvalidOperationException(
                    "Compilation did not produce an execution plan.");
            }
            if (!ReferenceEquals(plan.DialectProfile, options.DialectProfile)
                || !ReferenceEquals(plan.SchemaToken, options.SchemaToken)
                || plan.Atomicity != options.RequestedAtomicity)
            {
                throw new InvalidOperationException(
                    "Compilation plan options do not match the source options.");
            }
        }

        private sealed class PipelineResult
        {
            internal PipelineResult(
                RenderedSql rendered,
                DestructiveImpact effectiveImpact)
            {
                Rendered = rendered;
                EffectiveImpact = effectiveImpact;
            }

            internal RenderedSql Rendered { get; }

            internal DestructiveImpact EffectiveImpact { get; }
        }
    }
}
