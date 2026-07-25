using System.Runtime.CompilerServices;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed class CompilationPipelineTests
{
    private static readonly SqlCompilationStage[] AllEightStages =
    {
        SqlCompilationStage.Bind,
        SqlCompilationStage.Normalize,
        SqlCompilationStage.Validate,
        SqlCompilationStage.Lower,
        SqlCompilationStage.Optimize,
        SqlCompilationStage.AllocateParameters,
        SqlCompilationStage.Render,
        SqlCompilationStage.Plan
    };

    [Fact]
    public void Compiler_runs_all_stages_in_contract_order()
    {
        var observer = new RecordingStageObserver();
        var compiler = new RecordingCompiler(observer);

        var plan = compiler.Compile(
            AstSamples.SimpleSelect(), TestOptions.PostgreSql17);

        Assert.Equal(AllEightStages, observer.Stages);
        Assert.Same(plan.DialectProfile, compiler.LastOptions!.DialectProfile);
        Assert.False(compiler.LowerWasCalledBeforeValidation);
    }

    [Fact]
    public void Validation_diagnostics_throw_before_lower_and_are_value_safe()
    {
        var observer = new RecordingStageObserver();
        var compiler = new RecordingCompiler(observer);
        const string runtimeSentinel = "DO-NOT-LEAK-8f4cc3";
        var source = AstSamples.InvalidSelectWithSensitiveMetadata(
            runtimeSentinel);

        var error = Assert.Throws<SqlAstValidationException>(() =>
            compiler.Compile(source, TestOptions.PostgreSql17));

        Assert.Equal(
            AllEightStages.Take(3), observer.Stages);
        Assert.False(compiler.LowerWasCalled);
        Assert.DoesNotContain(runtimeSentinel, error.ToString());
        Assert.Empty(error.Data.Keys);
    }

    [Fact]
    public void Every_migration_step_runs_the_same_base_owned_eight_stages()
    {
        var observer = new RecordingStageObserver();
        var source = AstSamples.ThreeStepMigration();

        var plan = new RecordingCompiler(observer).CompileMigration(
            source, TestOptions.PostgreSql17RequiredMigration);

        Assert.Equal(source.Steps.Count * 8, observer.Stages.Count);
        Assert.All(Enumerable.Range(0, source.Steps.Count), index =>
            Assert.Equal(
                AllEightStages,
                observer.Stages.Skip(index * 8).Take(8)));
        Assert.Equal(
            source.Steps.Select(x => x.Id),
            Assert.IsType<MigrationPlanSafetyBinding>(plan.Safety)
                .Entries.Select(x => x.StepId));
        Assert.Equal(
            source.Steps.Select(x => x.Id),
            plan.Steps.OfType<SqlCommandStep>()
                .Select(command => command.SourceMigrationStepId));
    }

    [Fact]
    public void Migration_compiler_preserves_options_and_derives_effective_impact()
    {
        var compiler = new RecordingCompiler(new RecordingStageObserver());
        var source = AstSamples.OneStepMigration();
        var options = new SqlCompilationOptions(
            TestProfiles.PostgreSql17,
            AtomicityRequirement.Required,
            new SchemaToken("schema-v1"));

        var plan = compiler.CompileMigration(source, options);

        Assert.Same(options.DialectProfile, plan.DialectProfile);
        Assert.Same(options.SchemaToken, plan.SchemaToken);
        Assert.Equal(options.RequestedAtomicity, plan.Atomicity);
        Assert.Equal(
            source.Fingerprint,
            Assert.IsType<MigrationPlanSafetyBinding>(plan.Safety)
                .SourceFingerprint);
    }

    [Fact]
    public void Multi_command_migration_fragments_keep_contiguous_source_ids()
    {
        var compiler = new RecordingCompiler(new RecordingStageObserver())
        {
            CommandsPerRender = 2
        };
        var source = AstSamples.ThreeStepMigration();

        var plan = compiler.CompileMigration(
            source, TestOptions.PostgreSql17RequiredMigration);

        Assert.Equal(
            source.Steps.SelectMany(step => new[] { step.Id, step.Id }),
            plan.Steps.Cast<SqlCommandStep>()
                .Select(command => command.SourceMigrationStepId));
    }

    [Fact]
    public void Base_rejects_a_command_for_another_storage_contract()
    {
        var compiler = new RecordingCompiler(new RecordingStageObserver())
        {
            UseMismatchedStorageContract = true
        };

        var error = Assert.Throws<InvalidOperationException>(() =>
            compiler.Compile(AstSamples.SimpleSelect(), TestOptions.PostgreSql17));

        Assert.Equal(
            "A rendered command does not match the compilation storage contract.",
            error.Message);
    }

    [Fact]
    public void Base_rejects_destructive_impact_on_an_ordinary_query()
    {
        var compiler = new RecordingCompiler(new RecordingStageObserver())
        {
            EffectiveImpactOverride = DestructiveImpact.PotentialDataLoss
        };

        Assert.Throws<InvalidOperationException>(() =>
            compiler.Compile(AstSamples.SimpleSelect(), TestOptions.PostgreSql17));
    }

    [Fact]
    public void Public_entries_are_base_owned_and_non_virtual()
    {
        var compile = typeof(SqlCompilerBase).GetMethod(nameof(ISqlCompiler.Compile));
        var migration = typeof(SqlCompilerBase).GetMethod(
            nameof(ISqlCompiler.CompileMigration));

        Assert.NotNull(compile);
        Assert.NotNull(migration);
        Assert.True(!compile.IsVirtual || compile.IsFinal);
        Assert.True(!migration.IsVirtual || migration.IsFinal);
        Assert.Equal(typeof(SqlCompilerBase), compile.DeclaringType);
        Assert.Equal(typeof(SqlCompilerBase), migration.DeclaringType);
    }

    [Fact]
    public void Task2_base_has_no_private_ir_extension_before_oracle_red()
    {
        var source = ReadCompilerBaseSource();
        Assert.Contains(
            "new SqlParameterAllocator().Allocate(optimized)", source);
        Assert.DoesNotContain("AllocateAfterLowering", source);
        Assert.DoesNotContain("SqlParameterTraversalDescriptor", source);
        Assert.Null(typeof(SqlCompilerBase).Assembly.GetType(
            "Dos.ORM.SqlCompilation.SqlParameterTraversalDescriptor"));
    }

    private static string ReadCompilerBaseSource(
        [CallerFilePath] string testFile = "")
    {
        var compilationDirectory = Path.GetDirectoryName(testFile)!;
        var testsDirectory = Directory.GetParent(compilationDirectory)!.FullName;
        var serverDirectory = Directory.GetParent(
            Directory.GetParent(testsDirectory)!.FullName)!.FullName;
        var path = Path.Combine(
            serverDirectory, "Dos.ORM", "SqlCompilation", "SqlCompilerBase.cs");
        Assert.True(File.Exists(path), path);
        return File.ReadAllText(path);
    }

    private sealed class RecordingStageObserver
    {
        internal List<SqlCompilationStage> Stages { get; } = new();
    }

    private sealed class RecordingCompiler : SqlCompilerBase
    {
        private readonly RecordingStageObserver _observer;
        private bool _validated;

        internal RecordingCompiler(RecordingStageObserver observer)
        {
            _observer = observer;
        }

        internal bool LowerWasCalled { get; private set; }

        internal bool LowerWasCalledBeforeValidation { get; private set; }

        internal SqlCompilationOptions? LastOptions { get; private set; }

        internal int CommandsPerRender { get; set; } = 1;

        internal bool UseMismatchedStorageContract { get; set; }

        internal DestructiveImpact? EffectiveImpactOverride { get; set; }

        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile) => CapabilitySamples.Create();

        internal override SqlNode Lower(
            SqlNode node, SqlLoweringContext context)
        {
            LowerWasCalled = true;
            LowerWasCalledBeforeValidation = !_validated;
            LastOptions = context.Options;
            return node;
        }

        internal override SqlNode Optimize(
            SqlNode node, SqlLoweringContext context) => node;

        internal override RenderedSql Render(
            AllocatedSqlNode node, SqlLoweringContext context)
        {
            var isQuery = node.Root is SelectStatement;
            var definitions = node.ParameterSlots
                .Select(slot => slot.Definition)
                .ToArray();
            var storageContract = UseMismatchedStorageContract
                ? DatabaseStorageContract.Native(TestProfiles.MySql80)
                : context.StorageContract;
            var commands = new List<SqlCommandStep>();
            for (var index = 0; index < CommandsPerRender; index++)
            {
                commands.Add(new SqlCommandStep(
                    isQuery ? "SELECT 1" : "SCHEMA COMMAND " + index,
                    definitions,
                    isQuery ? SqlResultShape.RowSet : SqlResultShape.None,
                    isQuery ? PlanResultRole.Final : PlanResultRole.None,
                    PlanConnectionRole.CurrentDatabase,
                    PlanTransactionBehavior.Enlistable,
                    context.SourceMigrationStepId,
                    SqlCommandValueContract.Native(
                        storageContract, definitions)));
            }
            return RenderedSql.ForCommands(commands);
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source, SqlNode lowered, SqlLoweringContext context)
        {
            if (EffectiveImpactOverride.HasValue)
            {
                return EffectiveImpactOverride.Value;
            }
            var schema = source as SchemaOperation;
            return schema == null ? DestructiveImpact.None : schema.Impact;
        }

        internal override void Observe(SqlCompilationStage stage)
        {
            _observer.Stages.Add(stage);
            if (stage == SqlCompilationStage.Validate)
            {
                _validated = true;
            }
        }
    }
}
