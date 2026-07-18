using System.Collections;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.SqlAst;

public sealed class ExecutionPlanAndNativeSqlTests
{
    private const string ProfilePg17Default =
        "sha256:8905429883ec365599e47c388ff4e7eeefd7c9ad3a8e68430490b74dcee82acb";
    private const string ProfileDm8NonAscii =
        "sha256:bdc822b34255e8680f1014f8c9d6b7ef435b73dba20d536d16e2a6743a84b56a";
    private const string NativePgSelect1 =
        "sha256:6770365654d0d3cc9105985efdce1a99f71c49d83144b785757427e2e3b1728f";
    private const string NativeDm8Snow =
        "sha256:b05a6980b7d05e04fbbb0870fcace31f7cda9f02dd6024b1608bf4fec179ca42";
    private const string PlanNativePgScalar =
        "sha256:97db9ff64d60f40cff885d690472431a8ba7e321664eb9451f2a7e3196151c9c";

    // Catalog, hierarchy, public/internal surface

    [Fact]
    public void Task7_enum_catalogs_have_exact_names_order_and_namespace()
    {
        var catalogs = new Dictionary<Type, string[]>
        {
            [typeof(AtomicityRequirement)] =
                ["None", "BestEffort", "Required"],
            [typeof(SqlSafetyOrigin)] =
                ["PlatformGenerated", "UserProvided", "LegacyAiGenerated", "LegacyUnknown"],
            [typeof(NativeSqlCommandKind)] =
                ["Read", "Write", "Schema", "DatabaseAdmin", "Unknown"],
            [typeof(SqlResultShape)] =
            [
                "None", "AffectedRows", "Scalar", "RowSet", "ReturningRows",
                "MultipleResultSets", "Metadata", "Diagnostic", "Admin", "Bulk"
            ],
            [typeof(PlanResultRole)] = ["None", "Final", "Aggregate"],
            [typeof(PlanConnectionRole)] =
                ["CurrentDatabase", "Administrative", "DedicatedBulk"],
            [typeof(PlanTransactionBehavior)] =
                ["Enlistable", "ImplicitCommit", "NotEnlistable", "Opaque"],
            [typeof(BulkExecutionKind)] = ["Native", "BatchedSql"],
            [typeof(PlanCachePolicy)] = ["Cacheable", "DoNotCache"]
        };

        Assert.All(catalogs, item =>
            Assert.Equal(item.Value, Enum.GetNames(item.Key)));
        Assert.Equal("Dos.ORM.SqlAst", typeof(SqlSafetyOrigin).Namespace);
        Assert.Equal("Dos.ORM.SqlAst", typeof(NativeSqlCommandKind).Namespace);
        Assert.All(catalogs.Keys.Except(
                [typeof(SqlSafetyOrigin), typeof(NativeSqlCommandKind)]),
            type => Assert.Equal("Dos.ORM.SqlCompilation", type.Namespace));
    }

    [Fact]
    public void Task7_type_hierarchy_is_closed_and_exact()
    {
        AssertSealed(
            typeof(DialectProfile), typeof(NativeSqlText),
            typeof(SqlCompilationOptions), typeof(SqlCommandStep),
            typeof(BulkCommandBatch), typeof(BulkStep), typeof(AdminStep),
            typeof(NativeScriptStep), typeof(CompiledPlanFingerprint),
            typeof(CompiledImpactEntry), typeof(NoTask6ImpactBinding),
            typeof(MigrationPlanSafetyBinding), typeof(DatabaseAdminSafetyBinding),
            typeof(CompiledImpactApproval), typeof(DatabaseExecutionPlan));

        Assert.True(typeof(DatabasePlanStep).IsAbstract);
        Assert.False(typeof(DatabasePlanStep).IsSealed);
        Assert.True(typeof(PlanSafetyBinding).IsAbstract);
        Assert.False(typeof(PlanSafetyBinding).IsSealed);
        Assert.True(typeof(ISqlCompiler).IsInterface);

        Assert.Equal(typeof(object), typeof(DialectProfile).BaseType);
        Assert.Equal(typeof(object), typeof(NativeSqlText).BaseType);
        Assert.Equal(typeof(object), typeof(DatabasePlanStep).BaseType);
        Assert.Equal(typeof(DatabasePlanStep), typeof(SqlCommandStep).BaseType);
        Assert.Equal(typeof(DatabasePlanStep), typeof(BulkStep).BaseType);
        Assert.Equal(typeof(DatabasePlanStep), typeof(AdminStep).BaseType);
        Assert.Equal(typeof(DatabasePlanStep), typeof(NativeScriptStep).BaseType);
        Assert.Equal(typeof(object), typeof(PlanSafetyBinding).BaseType);
        Assert.Equal(typeof(PlanSafetyBinding), typeof(NoTask6ImpactBinding).BaseType);
        Assert.Equal(typeof(PlanSafetyBinding), typeof(MigrationPlanSafetyBinding).BaseType);
        Assert.Equal(typeof(PlanSafetyBinding), typeof(DatabaseAdminSafetyBinding).BaseType);

        Assert.Equal([typeof(IEquatable<DialectProfile>)],
            typeof(DialectProfile).GetInterfaces());
        Assert.Equal([typeof(IEquatable<CompiledPlanFingerprint>)],
            typeof(CompiledPlanFingerprint).GetInterfaces());
        Assert.Empty(typeof(ISqlCompiler).GetInterfaces());
        Assert.All(new[]
        {
            typeof(NativeSqlText), typeof(SqlCompilationOptions),
            typeof(DatabasePlanStep), typeof(SqlCommandStep),
            typeof(BulkCommandBatch), typeof(BulkStep), typeof(AdminStep),
            typeof(NativeScriptStep), typeof(CompiledImpactEntry),
            typeof(PlanSafetyBinding), typeof(NoTask6ImpactBinding),
            typeof(MigrationPlanSafetyBinding),
            typeof(DatabaseAdminSafetyBinding), typeof(CompiledImpactApproval),
            typeof(DatabaseExecutionPlan)
        }, type => Assert.Empty(type.GetInterfaces()));
    }

    [Fact]
    public void Task7_public_properties_are_exact_get_only_and_typed()
    {
        AssertPublicProperties(typeof(DialectProfile),
            ("DatabaseType", typeof(DatabaseType)),
            ("ServerVersion", typeof(Version)),
            ("CompatibilityMode", typeof(string)),
            ("Fingerprint", typeof(string)));
        AssertPublicProperties(typeof(NativeSqlText),
            ("Text", typeof(string)),
            ("TargetProfile", typeof(DialectProfile)),
            ("TargetDatabase", typeof(DatabaseType)),
            ("Kind", typeof(NativeSqlCommandKind)),
            ("Origin", typeof(SqlSafetyOrigin)),
            ("Digest", typeof(string)),
            ("Utf8Length", typeof(int)));
        AssertPublicProperties(typeof(SqlCompilationOptions),
            ("DialectProfile", typeof(DialectProfile)),
            ("RequestedAtomicity", typeof(AtomicityRequirement)),
            ("SchemaToken", typeof(SchemaToken)));
        AssertPublicProperties(typeof(DatabasePlanStep),
            ("ResultShape", typeof(SqlResultShape)),
            ("ResultRole", typeof(PlanResultRole)),
            ("ConnectionRole", typeof(PlanConnectionRole)),
            ("TransactionBehavior", typeof(PlanTransactionBehavior)),
            ("SourceMigrationStepId", typeof(MigrationStepId)));
        AssertPublicProperties(typeof(SqlCommandStep),
            ("CommandText", typeof(string)),
            ("Parameters", typeof(IReadOnlyList<ParameterDefinition>)));
        AssertPublicProperties(typeof(BulkCommandBatch),
            ("Command", typeof(SqlCommandStep)),
            ("RowCount", typeof(int)));
        AssertPublicProperties(typeof(BulkStep),
            ("Operation", typeof(BulkInsertOperation)),
            ("ExecutionKind", typeof(BulkExecutionKind)),
            ("EffectiveBatchSize", typeof(int)),
            ("Batches", typeof(IReadOnlyList<BulkCommandBatch>)));
        AssertPublicProperties(typeof(AdminStep),
            ("Operation", typeof(DatabaseAdminOperation)));
        AssertPublicProperties(typeof(NativeScriptStep),
            ("Text", typeof(NativeSqlText)),
            ("Parameters", typeof(IReadOnlyList<ParameterDefinition>)));
        AssertPublicProperties(typeof(CompiledPlanFingerprint),
            ("Value", typeof(string)));
        AssertPublicProperties(typeof(CompiledImpactEntry),
            ("StepId", typeof(MigrationStepId)),
            ("NeutralImpact", typeof(DestructiveImpact)),
            ("EffectiveImpact", typeof(DestructiveImpact)),
            ("IsElevated", typeof(bool)));
        AssertPublicProperties(typeof(PlanSafetyBinding),
            ("NeutralImpact", typeof(DestructiveImpact)),
            ("EffectiveImpact", typeof(DestructiveImpact)),
            ("RequiresEffectiveImpactApproval", typeof(bool)));
        AssertPublicProperties(typeof(NoTask6ImpactBinding));
        AssertPublicProperties(typeof(MigrationPlanSafetyBinding),
            ("PlanId", typeof(MigrationPlanId)),
            ("SourceFingerprint", typeof(StructuralFingerprint)),
            ("Entries", typeof(IReadOnlyList<CompiledImpactEntry>)));
        AssertPublicProperties(typeof(DatabaseAdminSafetyBinding),
            ("Operation", typeof(DatabaseAdminOperation)),
            ("SourceFingerprint", typeof(StructuralFingerprint)));
        AssertPublicProperties(typeof(CompiledImpactApproval),
            ("SourceFingerprint", typeof(StructuralFingerprint)),
            ("DialectProfile", typeof(DialectProfile)),
            ("SchemaToken", typeof(SchemaToken)),
            ("PlanFingerprint", typeof(CompiledPlanFingerprint)),
            ("EffectiveImpact", typeof(DestructiveImpact)),
            ("ElevatedMigrationSteps", typeof(IReadOnlyList<CompiledImpactEntry>)),
            ("Reference", typeof(ApprovalReference)));
        AssertPublicProperties(typeof(DatabaseExecutionPlan),
            ("Steps", typeof(IReadOnlyList<DatabasePlanStep>)),
            ("ResultShape", typeof(SqlResultShape)),
            ("Origin", typeof(SqlSafetyOrigin)),
            ("Atomicity", typeof(AtomicityRequirement)),
            ("DialectProfile", typeof(DialectProfile)),
            ("SchemaToken", typeof(SchemaToken)),
            ("CachePolicy", typeof(PlanCachePolicy)),
            ("Fingerprint", typeof(CompiledPlanFingerprint)),
            ("Safety", typeof(PlanSafetyBinding)),
            ("RequiresEffectiveImpactApproval", typeof(bool)),
            ("CanApplyEffectiveImpact", typeof(bool)));
    }

    [Fact]
    public void Public_constructors_are_exact_and_internal_construction_is_not_widened()
    {
        AssertPublicConstructor(typeof(DialectProfile),
            typeof(DatabaseType), typeof(Version), typeof(string));
        AssertPublicConstructor(typeof(SqlCompilationOptions),
            typeof(DialectProfile), typeof(AtomicityRequirement), typeof(SchemaToken));

        var profileParameters = Assert.Single(
            typeof(DialectProfile).GetConstructors()).GetParameters();
        Assert.Equal(["databaseType", "serverVersion", "compatibilityMode"],
            profileParameters.Select(parameter => parameter.Name));
        Assert.All(profileParameters, parameter =>
        {
            Assert.False(parameter.IsOptional);
            Assert.False(parameter.HasDefaultValue);
        });
        var optionParameters = Assert.Single(
            typeof(SqlCompilationOptions).GetConstructors()).GetParameters();
        Assert.Equal(["dialectProfile", "requestedAtomicity", "schemaToken"],
            optionParameters.Select(parameter => parameter.Name));
        Assert.False(optionParameters[0].IsOptional);
        Assert.Equal(AtomicityRequirement.None,
            optionParameters[1].DefaultValue);
        Assert.Null(optionParameters[2].DefaultValue);

        Assert.Empty(typeof(NativeSqlText).GetConstructors());
        Assert.Empty(typeof(DatabasePlanStep).GetConstructors());
        Assert.Empty(typeof(SqlCommandStep).GetConstructors());
        Assert.Empty(typeof(BulkCommandBatch).GetConstructors());
        Assert.Empty(typeof(BulkStep).GetConstructors());
        Assert.Empty(typeof(AdminStep).GetConstructors());
        Assert.Empty(typeof(NativeScriptStep).GetConstructors());
        Assert.Empty(typeof(CompiledPlanFingerprint).GetConstructors());
        Assert.Empty(typeof(CompiledImpactEntry).GetConstructors());
        Assert.Empty(typeof(PlanSafetyBinding).GetConstructors());
        Assert.Empty(typeof(NoTask6ImpactBinding).GetConstructors());
        Assert.Empty(typeof(MigrationPlanSafetyBinding).GetConstructors());
        Assert.Empty(typeof(DatabaseAdminSafetyBinding).GetConstructors());
        Assert.Empty(typeof(CompiledImpactApproval).GetConstructors());
        Assert.Empty(typeof(DatabaseExecutionPlan).GetConstructors());

        AssertConstructorVisibility(typeof(NativeSqlText), isPrivate: true,
            typeof(string), typeof(DialectProfile),
            typeof(NativeSqlCommandKind), typeof(SqlSafetyOrigin));
        AssertConstructorVisibility(typeof(DatabasePlanStep), isPrivate: false,
            typeof(SqlResultShape), typeof(PlanResultRole),
            typeof(PlanConnectionRole), typeof(PlanTransactionBehavior),
            typeof(MigrationStepId));
        AssertConstructorVisibility(typeof(SqlCommandStep), isPrivate: false,
            typeof(string), typeof(IEnumerable<ParameterDefinition>),
            typeof(SqlResultShape), typeof(PlanResultRole),
            typeof(PlanConnectionRole), typeof(PlanTransactionBehavior),
            typeof(MigrationStepId));
        AssertConstructorVisibility(typeof(BulkCommandBatch), isPrivate: false,
            typeof(SqlCommandStep), typeof(int));
        AssertConstructorVisibility(typeof(BulkStep), isPrivate: true,
            typeof(BulkInsertOperation), typeof(BulkExecutionKind), typeof(int),
            typeof(IEnumerable<BulkCommandBatch>), typeof(PlanConnectionRole),
            typeof(PlanTransactionBehavior));
        AssertConstructorVisibility(typeof(AdminStep), isPrivate: false,
            typeof(DatabaseAdminOperation), typeof(PlanConnectionRole),
            typeof(PlanTransactionBehavior));
        AssertConstructorVisibility(typeof(NativeScriptStep), isPrivate: false,
            typeof(NativeSqlText), typeof(IEnumerable<ParameterDefinition>),
            typeof(SqlResultShape));
        AssertConstructorVisibility(typeof(CompiledPlanFingerprint), isPrivate: false,
            typeof(string));
        AssertConstructorVisibility(typeof(CompiledImpactEntry), isPrivate: false,
            typeof(MigrationStepId), typeof(DestructiveImpact),
            typeof(DestructiveImpact));
        AssertConstructorVisibility(typeof(PlanSafetyBinding), isPrivate: false,
            typeof(DestructiveImpact), typeof(DestructiveImpact));
        AssertConstructorVisibility(typeof(NoTask6ImpactBinding), isPrivate: true);
        AssertConstructorVisibility(typeof(MigrationPlanSafetyBinding), isPrivate: false,
            typeof(MigrationPlan), typeof(IEnumerable<CompiledImpactEntry>));
        AssertConstructorVisibility(typeof(DatabaseAdminSafetyBinding), isPrivate: true,
            typeof(DatabaseAdminOperation), typeof(StructuralFingerprint),
            typeof(DestructiveImpact));
        AssertConstructorVisibility(typeof(CompiledImpactApproval), isPrivate: false,
            typeof(StructuralFingerprint), typeof(DialectProfile), typeof(SchemaToken),
            typeof(CompiledPlanFingerprint), typeof(DestructiveImpact),
            typeof(IEnumerable<CompiledImpactEntry>), typeof(ApprovalReference));
        AssertConstructorVisibility(typeof(DatabaseExecutionPlan), isPrivate: true,
            typeof(IReadOnlyList<DatabasePlanStep>), typeof(SqlResultShape),
            typeof(SqlSafetyOrigin), typeof(AtomicityRequirement),
            typeof(DialectProfile), typeof(SchemaToken), typeof(PlanCachePolicy),
            typeof(CompiledPlanFingerprint), typeof(PlanSafetyBinding),
            typeof(CompiledImpactApproval));

        Assert.Equal(new[] { "Dos.ORM.Tests" },
            typeof(DatabaseExecutionPlan).Assembly
                .GetCustomAttributes<InternalsVisibleToAttribute>()
                .Select(x => x.AssemblyName)
                .OrderBy(x => x, StringComparer.Ordinal));
    }

    [Fact]
    public void Native_and_plan_factories_are_exact_named_and_visibility_scoped()
    {
        var nativeFactories = typeof(NativeSqlText)
            .GetMethods(BindingFlags.Public | BindingFlags.Static |
                        BindingFlags.DeclaredOnly)
            .OrderBy(method => method.Name, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            ["LegacyAiGenerated", "LegacyUnknown", "UserProvided"],
            nativeFactories.Select(method => method.Name));
        AssertMethod(nativeFactories.Single(m => m.Name == "UserProvided"),
            typeof(NativeSqlText), false,
            typeof(string), typeof(DialectProfile), typeof(NativeSqlCommandKind));
        AssertMethod(nativeFactories.Single(m => m.Name == "LegacyAiGenerated"),
            typeof(NativeSqlText), false,
            typeof(string), typeof(DialectProfile), typeof(NativeSqlCommandKind));
        AssertMethod(nativeFactories.Single(m => m.Name == "LegacyUnknown"),
            typeof(NativeSqlText), false,
            typeof(string), typeof(DialectProfile));

        var planFactories = typeof(DatabaseExecutionPlan)
            .GetMethods(BindingFlags.NonPublic | BindingFlags.Static |
                        BindingFlags.DeclaredOnly)
            .Where(method => method.ReturnType == typeof(DatabaseExecutionPlan))
            .OrderBy(method => method.Name, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
        [
            "ForAdmin", "ForBulk", "ForMigration", "ForNative",
            "ForSchemaOperation", "ForStatement"
        ], planFactories.Select(method => method.Name));
        Assert.All(planFactories, method =>
        {
            Assert.True(method.IsAssembly);
            Assert.False(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly);
            Assert.False(method.IsGenericMethod);
        });

        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForStatement"),
            typeof(DatabaseExecutionPlan), false,
            typeof(SqlStatement), typeof(IEnumerable<SqlCommandStep>),
            typeof(SqlCompilationOptions));
        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForSchemaOperation"),
            typeof(DatabaseExecutionPlan), false,
            typeof(SchemaOperation), typeof(DestructiveImpact),
            typeof(IEnumerable<SqlCommandStep>), typeof(SqlCompilationOptions));
        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForMigration"),
            typeof(DatabaseExecutionPlan), false,
            typeof(MigrationPlan), typeof(IEnumerable<CompiledImpactEntry>),
            typeof(IEnumerable<SqlCommandStep>), typeof(SqlCompilationOptions));
        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForBulk"),
            typeof(DatabaseExecutionPlan), false,
            typeof(BulkInsertOperation), typeof(BulkStep),
            typeof(SqlCompilationOptions));
        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForAdmin"),
            typeof(DatabaseExecutionPlan), false,
            typeof(DatabaseAdminOperation), typeof(DestructiveImpact),
            typeof(AdminStep), typeof(SqlCompilationOptions));
        AssertMethod(NonPublicFactory(typeof(DatabaseExecutionPlan), "ForNative"),
            typeof(DatabaseExecutionPlan), false, typeof(NativeScriptStep));

        AssertExactInternalFactory(typeof(BulkStep), "Native",
            typeof(BulkStep), typeof(BulkInsertOperation), typeof(int),
            typeof(PlanConnectionRole), typeof(PlanTransactionBehavior));
        AssertExactInternalFactory(typeof(BulkStep), "Batched",
            typeof(BulkStep), typeof(BulkInsertOperation), typeof(int),
            typeof(IEnumerable<BulkCommandBatch>), typeof(PlanConnectionRole),
            typeof(PlanTransactionBehavior));
        AssertExactInternalFactory(typeof(DatabaseAdminSafetyBinding),
            "ForDropDatabase", typeof(DatabaseAdminSafetyBinding),
            typeof(DropDatabaseOperation), typeof(DestructiveImpact));
        AssertExactInternalFactory(typeof(DatabaseAdminSafetyBinding),
            "ForImport", typeof(DatabaseAdminSafetyBinding),
            typeof(DatabaseImportOperation), typeof(DestructiveImpact));
    }

    [Fact]
    public void Compiler_interface_has_only_the_two_source_typed_entries()
    {
        var methods = typeof(ISqlCompiler).GetMethods();
        Assert.Equal(2, methods.Length);
        Assert.All(methods, method =>
        {
            Assert.Equal(typeof(DatabaseExecutionPlan), method.ReturnType);
            Assert.False(method.IsGenericMethod);
            Assert.False(method.IsStatic);
        });

        var compile = Assert.Single(methods, method => method.Name == "Compile");
        Assert.Equal(
            [typeof(SqlStatement), typeof(SqlCompilationOptions)],
            compile.GetParameters().Select(parameter => parameter.ParameterType));
        var migration = Assert.Single(
            methods, method => method.Name == "CompileMigration");
        Assert.Equal(
            [typeof(MigrationPlan), typeof(SqlCompilationOptions)],
            migration.GetParameters().Select(parameter => parameter.ParameterType));

        Assert.DoesNotContain(methods.SelectMany(method => method.GetParameters()),
            parameter => parameter.ParameterType == typeof(string) ||
                         parameter.ParameterType == typeof(SqlNode) ||
                         parameter.ParameterType == typeof(NativeSqlText) ||
                         parameter.ParameterType == typeof(ParameterBag) ||
                         parameter.ParameterType == typeof(BoundParameter));
    }

    [Fact]
    public void Native_enums_live_in_native_source_without_compilation_dependency()
    {
        var nativePath = ProductionSourcePath("Dos.ORM", "SqlAst", "NativeSqlText.cs");
        var compilationPath =
            ProductionSourcePath("Dos.ORM", "SqlCompilation", "CompilationModels.cs");
        Assert.True(File.Exists(nativePath), nativePath);
        Assert.True(File.Exists(compilationPath), compilationPath);

        var native = File.ReadAllText(nativePath, Encoding.UTF8);
        var compilation = File.ReadAllText(compilationPath, Encoding.UTF8);
        Assert.Contains("enum SqlSafetyOrigin", native, StringComparison.Ordinal);
        Assert.Contains("enum NativeSqlCommandKind", native, StringComparison.Ordinal);
        Assert.DoesNotContain("Dos.ORM.SqlCompilation", native, StringComparison.Ordinal);
        Assert.DoesNotContain("enum AtomicityRequirement", native, StringComparison.Ordinal);
        Assert.Contains("enum AtomicityRequirement", compilation, StringComparison.Ordinal);
        Assert.Contains("enum PlanCachePolicy", compilation, StringComparison.Ordinal);
        Assert.DoesNotContain("enum SqlSafetyOrigin", compilation, StringComparison.Ordinal);
        Assert.DoesNotContain("enum NativeSqlCommandKind", compilation, StringComparison.Ordinal);
    }

    // DialectProfile

    [Fact]
    public void Dialect_profile_preserves_exact_identity_and_default_mode()
    {
        var version = new Version(17, 2);
        var profile = new DialectProfile(DatabaseType.PostgreSql, version, string.Empty);

        Assert.Equal(DatabaseType.PostgreSql, profile.DatabaseType);
        Assert.Same(version, profile.ServerVersion);
        Assert.Equal(string.Empty, profile.CompatibilityMode);
        Assert.Matches("^sha256:[0-9a-f]{64}$", profile.Fingerprint);
    }

    [Fact]
    public void Dialect_profile_rejects_null_undefined_whitespace_control_and_invalid_utf16()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DialectProfile((DatabaseType)int.MaxValue, new Version(1, 0), ""));
        Assert.Throws<ArgumentNullException>(() =>
            new DialectProfile(DatabaseType.MySql, null!, ""));
        Assert.Throws<ArgumentNullException>(() =>
            new DialectProfile(DatabaseType.MySql, new Version(8, 0), null!));

        foreach (var invalid in new[] { " ", "\t", "\r\n", "mode\u0000", "m\u001fo" })
        {
            Assert.Throws<ArgumentException>(() =>
                new DialectProfile(DatabaseType.MySql, new Version(8, 0), invalid));
        }

        Assert.Throws<EncoderFallbackException>(() =>
            new DialectProfile(DatabaseType.MySql, new Version(8, 0), "bad\uD800"));
    }

    [Fact]
    public void Dialect_profile_uses_all_fields_for_ordinal_equality_hash_and_fingerprint()
    {
        var baseline = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Mode");
        var equal = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Mode");
        var mutations = new[]
        {
            new DialectProfile(DatabaseType.MySql, new Version(17, 2, 3, 4), "Mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(18, 2, 3, 4), "Mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 3, 3, 4), "Mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 2, 4, 4), "Mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 2, 3, 5), "Mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "mode"),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Mode "),
            new DialectProfile(DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Ｍode")
        };

        Assert.Equal(baseline, equal);
        Assert.True(baseline.Equals(equal));
        Assert.True(baseline.Equals((object)equal));
        Assert.Equal(baseline.GetHashCode(), equal.GetHashCode());
        Assert.Equal(baseline.Fingerprint, equal.Fingerprint);
        Assert.All(mutations, mutation =>
        {
            Assert.NotEqual(baseline, mutation);
            Assert.NotEqual(baseline.Fingerprint, mutation.Fingerprint);
        });
    }

    [Fact]
    public void Dialect_profile_fixed_vectors_are_proven_by_independent_encoder()
    {
        var pg = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2), string.Empty);
        var dm = new DialectProfile(
            DatabaseType.DaMeng, new Version(8, 1, 3, 42), "Oracle兼容");

        Assert.Equal(ProfilePg17Default,
            ReferenceWireEncoder.ProfileFingerprint(
                DatabaseType.PostgreSql, new Version(17, 2), string.Empty));
        Assert.Equal(ProfileDm8NonAscii,
            ReferenceWireEncoder.ProfileFingerprint(
                DatabaseType.DaMeng, new Version(8, 1, 3, 42), "Oracle兼容"));
        Assert.Equal(ProfilePg17Default, pg.Fingerprint);
        Assert.Equal(ProfileDm8NonAscii, dm.Fingerprint);
    }

    [Fact]
    public void Dialect_profile_to_string_contains_only_safe_exact_metadata()
    {
        var profile = new DialectProfile(
            DatabaseType.Oracle, new Version(19, 3, 0, 0), "Compatible");

        var text = profile.ToString();

        Assert.Contains(nameof(DatabaseType.Oracle), text, StringComparison.Ordinal);
        Assert.Contains("19.3.0.0", text, StringComparison.Ordinal);
        Assert.Contains("Compatible", text, StringComparison.Ordinal);
        Assert.Contains(profile.Fingerprint, text, StringComparison.Ordinal);
        Assert.DoesNotContain("Password", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ConnectionString", text, StringComparison.OrdinalIgnoreCase);
    }

    // NativeSqlText

    [Theory]
    [InlineData(NativeSqlCommandKind.Read)]
    [InlineData(NativeSqlCommandKind.Write)]
    [InlineData(NativeSqlCommandKind.Schema)]
    [InlineData(NativeSqlCommandKind.DatabaseAdmin)]
    [InlineData(NativeSqlCommandKind.Unknown)]
    public void Native_user_and_ai_factories_accept_every_defined_kind(
        NativeSqlCommandKind kind)
    {
        var profile = PgProfile();
        var user = NativeSqlText.UserProvided(" SELECT 1; -- exact ", profile, kind);
        var ai = NativeSqlText.LegacyAiGenerated(" SELECT 1; -- exact ", profile, kind);

        Assert.Equal(" SELECT 1; -- exact ", user.Text);
        Assert.Same(profile, user.TargetProfile);
        Assert.Equal(profile.DatabaseType, user.TargetDatabase);
        Assert.Equal(kind, user.Kind);
        Assert.Equal(SqlSafetyOrigin.UserProvided, user.Origin);
        Assert.Equal(kind, ai.Kind);
        Assert.Equal(SqlSafetyOrigin.LegacyAiGenerated, ai.Origin);
    }

    [Fact]
    public void Native_legacy_unknown_cannot_be_relabeled()
    {
        var profile = PgProfile();
        var text = NativeSqlText.LegacyUnknown("SELECT 1", profile);

        Assert.Equal(SqlSafetyOrigin.LegacyUnknown, text.Origin);
        Assert.Equal(NativeSqlCommandKind.Unknown, text.Kind);
        Assert.Same(profile, text.TargetProfile);
    }

    [Fact]
    public void Native_factories_reject_invalid_text_profile_kind_and_utf16()
    {
        var profile = PgProfile();
        Assert.Throws<ArgumentNullException>(() =>
            NativeSqlText.UserProvided(null!, profile, NativeSqlCommandKind.Read));
        Assert.Throws<ArgumentNullException>(() =>
            NativeSqlText.UserProvided("SELECT 1", null!, NativeSqlCommandKind.Read));
        foreach (var invalid in new[] { "", " ", "\t\r\n", "SELECT\0secret" })
        {
            var exception = Assert.Throws<ArgumentException>(() =>
                NativeSqlText.UserProvided(invalid, profile, NativeSqlCommandKind.Read));
            Assert.DoesNotContain("secret", exception.Message, StringComparison.Ordinal);
        }
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            NativeSqlText.UserProvided(
                "SELECT 1", profile, (NativeSqlCommandKind)int.MaxValue));
        Assert.Throws<EncoderFallbackException>(() =>
            NativeSqlText.LegacyAiGenerated(
                "SELECT '\uD800'", profile, NativeSqlCommandKind.Unknown));
    }

    [Fact]
    public void Native_digest_and_utf8_length_use_exact_strict_bytes()
    {
        var pg = NativeSqlText.UserProvided(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read);
        var dm = NativeSqlText.LegacyAiGenerated(
            "SELECT '雪'", DmProfile(), NativeSqlCommandKind.Unknown);

        Assert.Equal(8, pg.Utf8Length);
        Assert.Equal(12, dm.Utf8Length);
        Assert.Equal(NativePgSelect1,
            ReferenceWireEncoder.NativeDigest(
                DatabaseType.PostgreSql, new Version(17, 2), string.Empty,
                SqlSafetyOrigin.UserProvided, NativeSqlCommandKind.Read, "SELECT 1"));
        Assert.Equal(NativeDm8Snow,
            ReferenceWireEncoder.NativeDigest(
                DatabaseType.DaMeng, new Version(8, 1, 3, 42), "Oracle兼容",
                SqlSafetyOrigin.LegacyAiGenerated, NativeSqlCommandKind.Unknown,
                "SELECT '雪'"));
        Assert.Equal(NativePgSelect1, pg.Digest);
        Assert.Equal(NativeDm8Snow, dm.Digest);
    }

    [Fact]
    public void Native_digest_binds_profile_origin_kind_and_exact_text()
    {
        var baseline = NativeSqlText.UserProvided(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read);
        var mutations = new[]
        {
            NativeSqlText.UserProvided(
                "SELECT 2", PgProfile(), NativeSqlCommandKind.Read),
            NativeSqlText.UserProvided(
                "SELECT 1 ", PgProfile(), NativeSqlCommandKind.Read),
            NativeSqlText.UserProvided(
                "SELECT 1", new DialectProfile(
                    DatabaseType.PostgreSql, new Version(17, 3), ""),
                NativeSqlCommandKind.Read),
            NativeSqlText.UserProvided(
                "SELECT 1", PgProfile(), NativeSqlCommandKind.Write),
            NativeSqlText.LegacyAiGenerated(
                "SELECT 1", PgProfile(), NativeSqlCommandKind.Read),
            NativeSqlText.LegacyUnknown("SELECT 1", PgProfile())
        };

        Assert.All(mutations, mutation =>
            Assert.NotEqual(baseline.Digest, mutation.Digest));
    }

    [Fact]
    public void Native_to_string_and_validation_never_expose_raw_text()
    {
        const string secretSql = "SELECT 'runtime-secret-value'";
        var native = NativeSqlText.UserProvided(
            secretSql, PgProfile(), NativeSqlCommandKind.Read);

        var text = native.ToString();

        Assert.Contains(native.Digest, text, StringComparison.Ordinal);
        Assert.Contains(native.TargetProfile.Fingerprint, text, StringComparison.Ordinal);
        Assert.Contains(native.Utf8Length.ToString(CultureInfo.InvariantCulture),
            text, StringComparison.Ordinal);
        Assert.Contains(nameof(SqlSafetyOrigin.UserProvided), text,
            StringComparison.Ordinal);
        Assert.Contains(nameof(NativeSqlCommandKind.Read), text,
            StringComparison.Ordinal);
        Assert.DoesNotContain(secretSql, text, StringComparison.Ordinal);
        Assert.DoesNotContain("runtime-secret-value", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Native_surface_has_no_platform_trusted_parser_or_database_overload()
    {
        var publicMethods = typeof(NativeSqlText).GetMethods(
            BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance |
            BindingFlags.DeclaredOnly);
        Assert.DoesNotContain(publicMethods, method =>
            method.Name.Contains("Platform", StringComparison.OrdinalIgnoreCase) ||
            method.Name.Contains("Trusted", StringComparison.OrdinalIgnoreCase) ||
            method.Name.Contains("System", StringComparison.OrdinalIgnoreCase) ||
            method.Name.Contains("Parse", StringComparison.OrdinalIgnoreCase) ||
            method.Name.Contains("Translate", StringComparison.OrdinalIgnoreCase) ||
            method.Name == "Create");
        Assert.DoesNotContain(publicMethods.SelectMany(method => method.GetParameters()),
            parameter => parameter.ParameterType == typeof(DatabaseType) ||
                         parameter.ParameterType == typeof(SqlSafetyOrigin));
    }

    // Compilation options and interface

    [Fact]
    public void Compilation_options_retain_exact_profile_atomicity_and_schema_token()
    {
        var profile = PgProfile();
        var token = new SchemaToken("schema-v1");
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.Required, token);
        var defaults = new SqlCompilationOptions(profile);

        Assert.Same(profile, options.DialectProfile);
        Assert.Equal(AtomicityRequirement.Required, options.RequestedAtomicity);
        Assert.Same(token, options.SchemaToken);
        Assert.Same(profile, defaults.DialectProfile);
        Assert.Equal(AtomicityRequirement.None, defaults.RequestedAtomicity);
        Assert.Null(defaults.SchemaToken);
    }

    [Fact]
    public void Compilation_options_reject_null_profile_and_undefined_atomicity()
    {
        Assert.Throws<ArgumentNullException>(() => new SqlCompilationOptions(null!));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SqlCompilationOptions(
            PgProfile(), (AtomicityRequirement)int.MaxValue));
    }

    [Fact]
    public void Compilation_options_and_plan_models_never_hold_runtime_values_or_provider_state()
    {
        var forbidden = new[]
        {
            typeof(ParameterBag), typeof(BoundParameter), typeof(DbConnection),
            typeof(DbCommand), typeof(DbTransaction), typeof(IDbConnection),
            typeof(IDbCommand), typeof(IDbTransaction), typeof(Stream),
            typeof(Delegate)
        };
        var modelTypes = typeof(DatabaseExecutionPlan).Assembly.GetTypes()
            .Where(type => type.Namespace == "Dos.ORM.SqlCompilation" ||
                           type == typeof(DialectProfile) ||
                           type == typeof(NativeSqlText))
            .ToArray();

        foreach (var type in modelTypes)
        {
            Assert.DoesNotContain(type.GetProperties(
                    BindingFlags.Public | BindingFlags.Instance |
                    BindingFlags.Static | BindingFlags.DeclaredOnly),
                property => forbidden.Any(item =>
                    item.IsAssignableFrom(UnwrapEnumerable(property.PropertyType))));
            Assert.DoesNotContain(type.GetFields(
                    BindingFlags.Public | BindingFlags.Instance |
                    BindingFlags.Static | BindingFlags.DeclaredOnly),
                field => forbidden.Any(item =>
                    item.IsAssignableFrom(UnwrapEnumerable(field.FieldType))));
        }
    }

    // Step construction and immutability

    [Fact]
    public void Sql_command_step_preserves_exact_metadata_and_fully_read_only_definitions()
    {
        var first = Parameter("Name", LogicalDbType.String);
        var second = Parameter("name", LogicalDbType.Int32);
        var input = new List<ParameterDefinition> { first, second };
        var migrationId = new MigrationStepId("step-1");

        var step = Command(
            " SELECT * FROM Users WHERE A = @p0 ", input,
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, migrationId);
        input.Clear();

        Assert.Equal(" SELECT * FROM Users WHERE A = @p0 ", step.CommandText);
        Assert.Equal(SqlResultShape.RowSet, step.ResultShape);
        Assert.Equal(PlanResultRole.Final, step.ResultRole);
        Assert.Equal(PlanConnectionRole.CurrentDatabase, step.ConnectionRole);
        Assert.Equal(PlanTransactionBehavior.Enlistable, step.TransactionBehavior);
        Assert.Same(migrationId, step.SourceMigrationStepId);
        Assert.Equal([first, second], step.Parameters);
        AssertFullyReadOnly(step.Parameters, first);
    }

    [Fact]
    public void Sql_command_step_rejects_invalid_text_null_items_and_ordinal_duplicates()
    {
        var parameter = Parameter("p", LogicalDbType.String);
        Assert.Throws<ArgumentNullException>(() => Command(null!, []));
        Assert.Throws<ArgumentException>(() => Command("", []));
        Assert.Throws<ArgumentException>(() => Command(" \t ", []));
        var nul = Assert.Throws<ArgumentException>(() =>
            Command("SELECT\0runtime-secret", []));
        Assert.DoesNotContain("runtime-secret", nul.Message, StringComparison.Ordinal);
        Assert.Throws<ArgumentNullException>(() =>
            Command("SELECT 1", null!));
        Assert.Throws<ArgumentException>(() =>
            Command("SELECT 1", new ParameterDefinition[] { null! }));
        Assert.Throws<ArgumentException>(() => Command(
            "SELECT 1", [parameter, Parameter("p", LogicalDbType.String)]));

        var caseDistinct = Command("SELECT 1",
            [parameter, Parameter("P", LogicalDbType.String)]);
        Assert.Equal(2, caseDistinct.Parameters.Count);
    }

    [Fact]
    public void Sql_command_step_enforces_result_shape_and_role_matrix()
    {
        var allowed = new[]
        {
            SqlResultShape.None, SqlResultShape.AffectedRows,
            SqlResultShape.Scalar, SqlResultShape.RowSet,
            SqlResultShape.ReturningRows, SqlResultShape.MultipleResultSets,
            SqlResultShape.Metadata, SqlResultShape.Diagnostic
        };
        foreach (var shape in allowed)
        {
            Assert.Equal(shape, Command("command", [], shape,
                PlanResultRole.None).ResultShape);
            if (shape != SqlResultShape.None)
            {
                Assert.Equal(PlanResultRole.Final,
                    Command("command", [], shape, PlanResultRole.Final).ResultRole);
                Assert.Equal(PlanResultRole.Aggregate,
                    Command("command", [], shape, PlanResultRole.Aggregate).ResultRole);
            }
        }

        Assert.Throws<ArgumentException>(() => Command(
            "command", [], SqlResultShape.None, PlanResultRole.Final));
        Assert.Throws<ArgumentException>(() => Command(
            "command", [], SqlResultShape.None, PlanResultRole.Aggregate));
        Assert.Throws<ArgumentException>(() => Command(
            "command", [], SqlResultShape.Admin, PlanResultRole.Final));
        Assert.Throws<ArgumentException>(() => Command(
            "command", [], SqlResultShape.Bulk, PlanResultRole.Final));
    }

    [Fact]
    public void Every_step_enum_slot_rejects_undefined_values()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Command(
            "command", [], (SqlResultShape)int.MaxValue, PlanResultRole.None));
        Assert.Throws<ArgumentOutOfRangeException>(() => Command(
            "command", [], SqlResultShape.RowSet, (PlanResultRole)int.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() => Command(
            "command", [], SqlResultShape.RowSet, PlanResultRole.Final,
            (PlanConnectionRole)int.MaxValue,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentOutOfRangeException>(() => Command(
            "command", [], SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            (PlanTransactionBehavior)int.MaxValue));

        var operation = BulkOperation(1, ParameterExpression("p"));
        Assert.Throws<ArgumentOutOfRangeException>(() => NativeBulk(
            operation, 1, (PlanConnectionRole)int.MaxValue,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentOutOfRangeException>(() => NativeBulk(
            operation, 1, PlanConnectionRole.CurrentDatabase,
            (PlanTransactionBehavior)int.MaxValue));

        var admin = CreateAdmin();
        Assert.Throws<ArgumentOutOfRangeException>(() => Admin(
            admin, (PlanConnectionRole)int.MaxValue,
            PlanTransactionBehavior.NotEnlistable));
        Assert.Throws<ArgumentOutOfRangeException>(() => Admin(
            admin, PlanConnectionRole.Administrative,
            (PlanTransactionBehavior)int.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() => NativeStep(
            NativeSqlText.UserProvided(
                "SELECT 1", PgProfile(), NativeSqlCommandKind.Read),
            [], (SqlResultShape)int.MaxValue));
    }

    [Fact]
    public void Sql_command_step_to_string_redacts_command_and_runtime_secrets()
    {
        const string command = "SELECT 'command-secret-value'";
        var step = Command(command, [Parameter("account", LogicalDbType.String)],
            SqlResultShape.RowSet, PlanResultRole.Final);
        var text = step.ToString();

        Assert.DoesNotContain(command, text, StringComparison.Ordinal);
        Assert.DoesNotContain("command-secret-value", text, StringComparison.Ordinal);
        Assert.Contains(nameof(SqlResultShape.RowSet), text, StringComparison.Ordinal);
        Assert.Contains(nameof(PlanResultRole.Final), text, StringComparison.Ordinal);
        Assert.Contains("sha256:", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Bulk_command_batch_requires_a_positive_correlated_command()
    {
        var command = Command(
            "INSERT", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var batch = BulkBatch(command, 2);

        Assert.Same(command, batch.Command);
        Assert.Equal(2, batch.RowCount);
        Assert.Throws<ArgumentNullException>(() => BulkBatch(null!, 1));
        Assert.Throws<ArgumentOutOfRangeException>(() => BulkBatch(command, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => BulkBatch(command, -1));
    }

    [Fact]
    public void Native_bulk_derives_typed_shape_and_has_fully_read_only_empty_batches()
    {
        var operation = BulkOperation(3,
            ParameterExpression("p"), ParameterExpression("p"),
            ParameterExpression("p"));
        var step = NativeBulk(
            operation, 2, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Same(operation, step.Operation);
        Assert.Equal(BulkExecutionKind.Native, step.ExecutionKind);
        Assert.Equal(2, step.EffectiveBatchSize);
        Assert.Empty(step.Batches);
        AssertFullyReadOnly(step.Batches,
            BulkBatch(Command("INSERT", [], SqlResultShape.AffectedRows), 1));
        Assert.Equal(SqlResultShape.Bulk, step.ResultShape);
        Assert.Equal(PlanResultRole.Final, step.ResultRole);
        Assert.Equal(PlanConnectionRole.CurrentDatabase, step.ConnectionRole);
        Assert.Equal(PlanTransactionBehavior.Enlistable, step.TransactionBehavior);
        Assert.Null(step.SourceMigrationStepId);
    }

    [Fact]
    public void Bulk_effective_batch_size_is_positive_and_never_exceeds_source_maximum()
    {
        var operation = BulkOperation(2,
            ParameterExpression("p"), ParameterExpression("p"));

        Assert.Throws<ArgumentOutOfRangeException>(() => NativeBulk(
            operation, 0, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentOutOfRangeException>(() => NativeBulk(
            operation, 3, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));

        var command = Command(
            "INSERT", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        Assert.Throws<ArgumentOutOfRangeException>(() => BatchedBulk(
            operation, 3, [BulkBatch(command, 2)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_requires_nonempty_exact_row_partition_and_copies_batches()
    {
        var operation = BulkOperation(3,
            ParameterExpression("p"), ParameterExpression("p"),
            ParameterExpression("p"));
        var command = Command(
            "INSERT", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var first = BulkBatch(command, 2);
        var second = BulkBatch(command, 1);
        var input = new List<BulkCommandBatch> { first, second };

        var step = BatchedBulk(
            operation, 2, input, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        input.Clear();

        Assert.Equal(BulkExecutionKind.BatchedSql, step.ExecutionKind);
        Assert.Equal([first, second], step.Batches);
        AssertFullyReadOnly(step.Batches, first);
        Assert.Throws<ArgumentNullException>(() => BatchedBulk(
            operation, 2, null!, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [], PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, new BulkCommandBatch[] { null! },
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [BulkBatch(command, 3)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [BulkBatch(command, 2)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [BulkBatch(command, 2), BulkBatch(command, 2)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_requires_nested_shape_role_source_route_and_transaction_consistency()
    {
        var operation = BulkOperation(1, ParameterExpression("p"));
        SqlCommandStep CommandFor(
            SqlResultShape shape = SqlResultShape.AffectedRows,
            PlanResultRole role = PlanResultRole.None,
            PlanConnectionRole route = PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior transaction = PlanTransactionBehavior.Enlistable,
            MigrationStepId? sourceId = null) =>
            Command("INSERT", [Parameter("p", LogicalDbType.String)],
                shape, role, route, transaction, sourceId);

        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1, [BulkBatch(CommandFor(SqlResultShape.RowSet), 1)],
            PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1,
            [BulkBatch(CommandFor(role: PlanResultRole.Aggregate), 1)],
            PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1,
            [BulkBatch(CommandFor(sourceId: new MigrationStepId("m")), 1)],
            PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1,
            [BulkBatch(CommandFor(route: PlanConnectionRole.DedicatedBulk), 1)],
            PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1,
            [BulkBatch(CommandFor(transaction: PlanTransactionBehavior.NotEnlistable), 1)],
            PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Enlistable));
    }

    [Theory]
    [InlineData("type")]
    [InlineData("direction")]
    [InlineData("nullable")]
    public void Native_bulk_rejects_same_name_source_parameter_conflicts(string mutation)
    {
        var first = Parameter("same", LogicalDbType.String,
            ParameterDirection.Input, true);
        var second = mutation switch
        {
            "type" => Parameter("same", LogicalDbType.Int32,
                ParameterDirection.Input, true),
            "direction" => Parameter("same", LogicalDbType.String,
                ParameterDirection.Output, true),
            "nullable" => Parameter("same", LogicalDbType.String,
                ParameterDirection.Input, false),
            _ => throw new InvalidOperationException()
        };
        var operation = BulkOperation(2,
            new ParameterExpression(first), new ParameterExpression(second));

        Assert.Throws<ArgumentException>(() => NativeBulk(
            operation, 2, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Bulk_parameter_walk_reaches_nested_subquery_query_descendants()
    {
        var direct = new ParameterExpression(Parameter(
            "deep", LogicalDbType.String, ParameterDirection.Input, true));
        var nested = new ParameterExpression(Parameter(
            "deep", LogicalDbType.Int32, ParameterDirection.Input, true));
        var query = DeepQueryWithParameter(nested);
        var operation = new BulkInsertOperation(
            ObjectName("BulkTarget"), [Id("Direct"), Id("Nested")],
            [new SqlInsertRow([direct, new SubqueryExpression(query)])], 1);

        Assert.Throws<ArgumentException>(() => NativeBulk(
            operation, 1, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Bulk_parameter_walk_fails_closed_for_unknown_expression_query_table_and_page_nodes()
    {
        Assert.Throws<ArgumentException>(() => NativeBulk(
            BulkOperation(1, new UnknownExpression()), 1,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => NativeBulk(
            BulkOperation(1, new SubqueryExpression(new UnknownQueryNode())), 1,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => NativeBulk(
            BulkOperation(1, new SubqueryExpression(new SelectStatement(
                new UnknownTableSource(),
                [new SelectProjection(BooleanExpression.True)]))), 1,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
        Assert.Throws<ArgumentException>(() => NativeBulk(
            BulkOperation(1, new SubqueryExpression(new SelectStatement(
                new NamedTableSource(ObjectName("T")),
                [new SelectProjection(BooleanExpression.True)],
                page: new UnknownPageSpec()))), 1,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_rejects_disjoint_source_and_command_parameter_catalogs()
    {
        var operation = BulkOperation(1,
            new ParameterExpression(Parameter("p", LogicalDbType.String)));
        var command = Command(
            "INSERT", [Parameter("q", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1, [BulkBatch(command, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_rejects_command_parameters_outside_source_catalog()
    {
        var operation = BulkOperation(1,
            new ParameterExpression(Parameter("p", LogicalDbType.String)));
        var command = Command(
            "INSERT",
            [
                Parameter("p", LogicalDbType.String),
                Parameter("q", LogicalDbType.Int32)
            ],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1, [BulkBatch(command, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_rejects_source_parameters_omitted_by_command_union()
    {
        var operation = BulkOperation(2,
            new ParameterExpression(Parameter("p", LogicalDbType.String)),
            new ParameterExpression(Parameter("q", LogicalDbType.Int32)));
        var command = Command(
            "INSERT", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [BulkBatch(command, 2)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_rejects_incomplete_parameter_union_across_batches()
    {
        var operation = BulkOperation(3,
            new ParameterExpression(Parameter("p", LogicalDbType.String)),
            new ParameterExpression(Parameter("q", LogicalDbType.Int32)),
            new ParameterExpression(Parameter("r", LogicalDbType.Boolean)));
        var first = Command(
            "INSERT 1", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var second = Command(
            "INSERT 2", [Parameter("q", LogicalDbType.Int32)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2,
            [BulkBatch(first, 2), BulkBatch(second, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Batched_bulk_accepts_exact_source_parameter_union_split_across_batches()
    {
        var operation = BulkOperation(2,
            new ParameterExpression(Parameter("p", LogicalDbType.String)),
            new ParameterExpression(Parameter("q", LogicalDbType.Int32)));
        var first = Command(
            "INSERT 1", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var second = Command(
            "INSERT 2", [Parameter("q", LogicalDbType.Int32)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        var step = BatchedBulk(
            operation, 1,
            [BulkBatch(first, 1), BulkBatch(second, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.Equal([first, second],
            step.Batches.Select(batch => batch.Command));
    }

    [Fact]
    public void Batched_bulk_rejects_source_to_command_and_command_to_command_definition_conflicts()
    {
        var operation = BulkOperation(2,
            new ParameterExpression(Parameter("p", LogicalDbType.String)),
            new ParameterExpression(Parameter("q", LogicalDbType.Int32)));
        var wrongSource = Command(
            "INSERT", [Parameter("p", LogicalDbType.Int64)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 2, [BulkBatch(wrongSource, 2)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));

        var first = Command(
            "INSERT 1", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var second = Command(
            "INSERT 2", [Parameter("p", LogicalDbType.Int64)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        Assert.Throws<ArgumentException>(() => BatchedBulk(
            operation, 1, [BulkBatch(first, 1), BulkBatch(second, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    [Fact]
    public void Bulk_to_string_redacts_nested_command_text_and_has_no_returning_contract()
    {
        const string secret = "INSERT command-secret-value";
        var operation = BulkOperation(1, ParameterExpression("p"));
        var command = Command(secret, [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var step = BatchedBulk(
            operation, 1, [BulkBatch(command, 1)],
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);

        Assert.DoesNotContain(secret, step.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("Returning", step.GetType().GetProperties()
            .Select(property => property.Name));
        Assert.Equal(SqlResultShape.Bulk, step.ResultShape);
    }

    [Fact]
    public void Admin_step_retains_exact_structured_operation_and_derives_typed_result()
    {
        var operation = CreateAdmin();
        var step = Admin(operation, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.NotEnlistable);

        Assert.Same(operation, step.Operation);
        Assert.Equal(SqlResultShape.Admin, step.ResultShape);
        Assert.Equal(PlanResultRole.Final, step.ResultRole);
        Assert.Equal(PlanConnectionRole.Administrative, step.ConnectionRole);
        Assert.Equal(PlanTransactionBehavior.NotEnlistable,
            step.TransactionBehavior);
        Assert.Null(step.SourceMigrationStepId);
        Assert.DoesNotContain("CommandText", step.GetType().GetProperties()
            .Select(property => property.Name));
    }

    [Fact]
    public void Admin_step_rejects_null_and_to_string_redacts_resource_and_credentials()
    {
        Assert.Throws<ArgumentNullException>(() => Admin(
            null!, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.NotEnlistable));
        var operation = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'a',
            DatabaseImportConflictPolicy.FailOnConflict);
        var step = Admin(operation, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var text = step.ToString();

        Assert.DoesNotContain("Password", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ConnectionString", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("resource/path", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Native_step_copies_definitions_and_derives_role_route_and_opaque_behavior()
    {
        var native = NativeSqlText.UserProvided(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read);
        foreach (var shape in new[]
        {
            SqlResultShape.None, SqlResultShape.AffectedRows,
            SqlResultShape.Scalar, SqlResultShape.RowSet,
            SqlResultShape.ReturningRows, SqlResultShape.MultipleResultSets
        })
        {
            var parameter = Parameter("p", LogicalDbType.Int32);
            var input = new List<ParameterDefinition> { parameter };
            var step = NativeStep(native, input, shape);
            input.Clear();

            Assert.Same(native, step.Text);
            Assert.Equal(shape, step.ResultShape);
            Assert.Equal(shape == SqlResultShape.None
                    ? PlanResultRole.None
                    : PlanResultRole.Final,
                step.ResultRole);
            Assert.Equal(PlanConnectionRole.CurrentDatabase, step.ConnectionRole);
            Assert.Equal(PlanTransactionBehavior.Opaque, step.TransactionBehavior);
            Assert.Null(step.SourceMigrationStepId);
            Assert.Single(step.Parameters);
            AssertFullyReadOnly(step.Parameters, parameter);
        }
    }

    [Fact]
    public void Native_step_rejects_invalid_shapes_definitions_and_forged_platform_origin()
    {
        var native = NativeSqlText.UserProvided(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read);
        Assert.Throws<ArgumentNullException>(() => NativeStep(null!, [], SqlResultShape.RowSet));
        Assert.Throws<ArgumentNullException>(() => NativeStep(native, null!, SqlResultShape.RowSet));
        Assert.Throws<ArgumentException>(() => NativeStep(
            native, new ParameterDefinition[] { null! }, SqlResultShape.RowSet));
        Assert.Throws<ArgumentException>(() => NativeStep(
            native,
            [Parameter("p", LogicalDbType.String), Parameter("p", LogicalDbType.String)],
            SqlResultShape.RowSet));
        Assert.Throws<ArgumentException>(() => NativeStep(native, [], SqlResultShape.Metadata));
        Assert.Throws<ArgumentException>(() => NativeStep(native, [], SqlResultShape.Diagnostic));
        Assert.Throws<ArgumentException>(() => NativeStep(native, [], SqlResultShape.Admin));
        Assert.Throws<ArgumentException>(() => NativeStep(native, [], SqlResultShape.Bulk));

        var forged = InvokeNonPublicConstructor<NativeSqlText>(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read,
            SqlSafetyOrigin.PlatformGenerated);
        Assert.Throws<ArgumentException>(() =>
            NativeStep(forged, [], SqlResultShape.RowSet));
    }

    [Fact]
    public void Native_step_to_string_redacts_raw_sql_and_values()
    {
        const string secret = "SELECT 'native-secret-value'";
        var native = NativeSqlText.UserProvided(
            secret, PgProfile(), NativeSqlCommandKind.Read);
        var step = NativeStep(native,
            [Parameter("p", LogicalDbType.String)], SqlResultShape.RowSet);
        var text = step.ToString();

        Assert.Contains(native.Digest, text, StringComparison.Ordinal);
        Assert.DoesNotContain(secret, text, StringComparison.Ordinal);
        Assert.DoesNotContain("native-secret-value", text, StringComparison.Ordinal);
    }

    // Compiled identity and Task 6 safety bindings

    [Fact]
    public void Compiled_fingerprint_is_strict_lower_hex_value_identity()
    {
        var value = "sha256:" + new string('a', 64);
        var first = Fingerprint(value);
        var second = Fingerprint(value);
        var other = Fingerprint("sha256:" + new string('b', 64));

        Assert.Equal(value, first.Value);
        Assert.Equal(first, first);
        Assert.Equal(first, second);
        Assert.Equal(first.GetHashCode(), second.GetHashCode());
        Assert.NotEqual(first, other);
        Assert.False(first.Equals(null));
        Assert.False(first.Equals(new object()));
        Assert.Equal(value, first.ToString());

        foreach (var invalid in new[]
        {
            null, string.Empty, " ", "sha256:",
            "SHA256:" + new string('a', 64),
            "sha256:" + new string('A', 64),
            "sha256:" + new string('g', 64),
            "sha256:" + new string('a', 63),
            "sha256:" + new string('a', 65)
        })
        {
            Assert.ThrowsAny<ArgumentException>(() => Fingerprint(invalid!));
        }
    }

    [Theory]
    [InlineData(DestructiveImpact.None, DestructiveImpact.None, false)]
    [InlineData(DestructiveImpact.CompatibilityRisk, DestructiveImpact.CompatibilityRisk, false)]
    [InlineData(DestructiveImpact.PotentialDataLoss, DestructiveImpact.PotentialDataLoss, false)]
    [InlineData(DestructiveImpact.None, DestructiveImpact.CompatibilityRisk, true)]
    [InlineData(DestructiveImpact.None, DestructiveImpact.PotentialDataLoss, true)]
    [InlineData(DestructiveImpact.CompatibilityRisk, DestructiveImpact.PotentialDataLoss, true)]
    public void Impact_entry_preserves_explicit_rank_and_elevation(
        DestructiveImpact neutral,
        DestructiveImpact effective,
        bool elevated)
    {
        var id = StepId("s1");
        var entry = Impact(id, neutral, effective);

        Assert.Same(id, entry.StepId);
        Assert.Equal(neutral, entry.NeutralImpact);
        Assert.Equal(effective, entry.EffectiveImpact);
        Assert.Equal(elevated, entry.IsElevated);
    }

    [Fact]
    public void Impact_entry_rejects_reduction_unknown_values_and_null_id()
    {
        Assert.Throws<ArgumentNullException>(() => Impact(
            null!, DestructiveImpact.None, DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => Impact(
            StepId("s1"), DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => Impact(
            StepId("s1"), DestructiveImpact.PotentialDataLoss,
            DestructiveImpact.CompatibilityRisk));
        Assert.Throws<ArgumentException>(() => Impact(
            StepId("s1"), (DestructiveImpact)(-1), DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => Impact(
            StepId("s1"), DestructiveImpact.None, (DestructiveImpact)99));
    }

    [Fact]
    public void No_task6_binding_is_singleton_safe_and_cannot_be_constructed_publicly()
    {
        var first = NoImpact();
        var second = NoImpact();

        Assert.Same(first, second);
        Assert.Equal(DestructiveImpact.None, first.NeutralImpact);
        Assert.Equal(DestructiveImpact.None, first.EffectiveImpact);
        Assert.False(first.RequiresEffectiveImpactApproval);
        Assert.Empty(typeof(NoTask6ImpactBinding).GetConstructors());
        Assert.Single(typeof(NoTask6ImpactBinding).GetConstructors(
            BindingFlags.Instance | BindingFlags.NonPublic));
    }

    [Fact]
    public void Migration_binding_copies_exact_order_and_derives_aggregate_impacts()
    {
        var plan = Migration(
            ("safe", SafeSchema("one")),
            ("risk", RiskSchema("two", "three")),
            ("loss", LossSchema("four")));
        var safe = Impact(plan.Steps[0].Id,
            DestructiveImpact.None, DestructiveImpact.None);
        var risk = Impact(plan.Steps[1].Id,
            DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.PotentialDataLoss);
        var loss = Impact(plan.Steps[2].Id,
            DestructiveImpact.PotentialDataLoss,
            DestructiveImpact.PotentialDataLoss);
        var mutable = new List<CompiledImpactEntry> { safe, risk, loss };

        var binding = MigrationSafety(plan, mutable);
        mutable.Clear();

        Assert.Equal(plan.Id, binding.PlanId);
        Assert.Same(plan.Fingerprint, binding.SourceFingerprint);
        Assert.Equal(new[] { safe, risk, loss }, binding.Entries);
        AssertFullyReadOnly(binding.Entries, safe, risk, loss);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            binding.NeutralImpact);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            binding.EffectiveImpact);
        Assert.False(binding.RequiresEffectiveImpactApproval);

        var aggregateElevatedPlan = Migration(
            ("safe", SafeSchema("aggregate_safe")),
            ("risk", RiskSchema("aggregate_old", "aggregate_new")));
        var aggregateElevated = MigrationSafety(aggregateElevatedPlan,
        [
            Impact(aggregateElevatedPlan.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.None),
            Impact(aggregateElevatedPlan.Steps[1].Id,
                DestructiveImpact.CompatibilityRisk,
                DestructiveImpact.PotentialDataLoss)
        ]);
        Assert.True(aggregateElevated.RequiresEffectiveImpactApproval);
    }

    [Fact]
    public void Empty_migration_binding_is_safe_and_read_only()
    {
        var plan = Migration();
        var binding = MigrationSafety(plan, []);

        Assert.Empty(binding.Entries);
        AssertFullyReadOnly(binding.Entries);
        Assert.Equal(DestructiveImpact.None, binding.NeutralImpact);
        Assert.Equal(DestructiveImpact.None, binding.EffectiveImpact);
        Assert.False(binding.RequiresEffectiveImpactApproval);
    }

    [Fact]
    public void Migration_binding_requires_exact_complete_source_order_and_neutral_impact()
    {
        var plan = Migration(
            ("safe", SafeSchema("one")),
            ("risk", RiskSchema("two", "three")));
        var safe = Impact(plan.Steps[0].Id,
            DestructiveImpact.None, DestructiveImpact.None);
        var risk = Impact(plan.Steps[1].Id,
            DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.CompatibilityRisk);

        Assert.Throws<ArgumentNullException>(() => MigrationSafety(null!, []));
        Assert.Throws<ArgumentNullException>(() => MigrationSafety(plan, null!));
        Assert.Throws<ArgumentException>(() => MigrationSafety(
            plan, new CompiledImpactEntry[] { safe, null! }));
        Assert.Throws<ArgumentException>(() => MigrationSafety(plan, [safe]));
        Assert.Throws<ArgumentException>(() => MigrationSafety(plan, [risk, safe]));
        Assert.Throws<ArgumentException>(() => MigrationSafety(plan, [safe, safe]));
        Assert.Throws<ArgumentException>(() => MigrationSafety(plan,
        [
            Impact(plan.Steps[0].Id,
                DestructiveImpact.CompatibilityRisk,
                DestructiveImpact.CompatibilityRisk),
            risk
        ]));
        Assert.Throws<ArgumentException>(() => MigrationSafety(plan,
        [
            Impact(StepId("foreign"),
                DestructiveImpact.None, DestructiveImpact.None),
            risk
        ]));
    }

    [Fact]
    public void Drop_database_binding_uses_authoritative_source_fingerprint()
    {
        var operation = DropAdmin("drop_target");
        var binding = AdminDropSafety(
            operation, DestructiveImpact.PotentialDataLoss);

        Assert.Same(operation, binding.Operation);
        Assert.Same(operation.Fingerprint, binding.SourceFingerprint);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            binding.NeutralImpact);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            binding.EffectiveImpact);
        Assert.False(binding.RequiresEffectiveImpactApproval);
    }

    [Fact]
    public void Drop_database_binding_rejects_reduction_null_and_wrong_admin_subtype()
    {
        var drop = DropAdmin("drop_target");

        Assert.Throws<ArgumentNullException>(() => AdminDropSafety(
            null!, DestructiveImpact.PotentialDataLoss));
        Assert.Throws<ArgumentException>(() => AdminDropSafety(
            drop, DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => AdminDropSafety(
            drop, DestructiveImpact.CompatibilityRisk));
        Assert.Throws<ArgumentException>(() => AdminDropSafety(
            drop, (DestructiveImpact)99));
    }

    [Theory]
    [InlineData(DatabaseImportConflictPolicy.FailOnConflict,
        DestructiveImpact.None, false)]
    [InlineData(DatabaseImportConflictPolicy.SkipExisting,
        DestructiveImpact.None, false)]
    [InlineData(DatabaseImportConflictPolicy.FailOnConflict,
        DestructiveImpact.CompatibilityRisk, true)]
    [InlineData(DatabaseImportConflictPolicy.ReplaceTargetDatabase,
        DestructiveImpact.PotentialDataLoss, false)]
    public void Import_binding_is_always_authoritative_even_when_neutral_safe(
        DatabaseImportConflictPolicy policy,
        DestructiveImpact effective,
        bool elevated)
    {
        var operation = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'b', policy);
        var binding = AdminImportSafety(operation, effective);

        Assert.Same(operation, binding.Operation);
        Assert.Same(operation.Fingerprint, binding.SourceFingerprint);
        Assert.Equal(operation.Impact, binding.NeutralImpact);
        Assert.Equal(effective, binding.EffectiveImpact);
        Assert.Equal(elevated, binding.RequiresEffectiveImpactApproval);
    }

    [Fact]
    public void Import_binding_rejects_reduction_unknown_and_null()
    {
        var replacement = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'c',
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);

        Assert.Throws<ArgumentNullException>(() => AdminImportSafety(
            null!, DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => AdminImportSafety(
            replacement, DestructiveImpact.None));
        Assert.Throws<ArgumentException>(() => AdminImportSafety(
            replacement, DestructiveImpact.CompatibilityRisk));
        Assert.Throws<ArgumentException>(() => AdminImportSafety(
            replacement, (DestructiveImpact)99));
    }

    [Fact]
    public void Admin_binding_factories_accept_only_their_exact_closed_subtypes()
    {
        var dropFactory = FindNonPublicStaticMethod(
            typeof(DatabaseAdminSafetyBinding), "ForDropDatabase");
        var importFactory = FindNonPublicStaticMethod(
            typeof(DatabaseAdminSafetyBinding), "ForImport");
        Assert.Equal(typeof(DropDatabaseOperation),
            dropFactory.GetParameters()[0].ParameterType);
        Assert.Equal(typeof(DatabaseImportOperation),
            importFactory.GetParameters()[0].ParameterType);
        Assert.Empty(typeof(DatabaseAdminSafetyBinding).GetMethods(
            BindingFlags.Public | BindingFlags.Static));
    }

    // Plan family, source correlation, result derivation and atomicity

    [Fact]
    public void Statement_plan_retains_exact_options_derives_identity_and_copies_steps()
    {
        var profile = PgProfile();
        var schema = new SchemaToken("schema-v1");
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.BestEffort, schema);
        var source = SelectSource();
        var step = Command(
            "SELECT account FROM users", [], SqlResultShape.RowSet,
            PlanResultRole.Final, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var mutable = new List<SqlCommandStep> { step };

        var plan = StatementPlan(source, mutable, options);
        mutable.Clear();

        Assert.Single(plan.Steps);
        Assert.Same(step, plan.Steps[0]);
        AssertFullyReadOnly(plan.Steps, step);
        Assert.Equal(SqlResultShape.RowSet, plan.ResultShape);
        Assert.Equal(SqlSafetyOrigin.PlatformGenerated, plan.Origin);
        Assert.Equal(AtomicityRequirement.BestEffort, plan.Atomicity);
        Assert.Same(profile, plan.DialectProfile);
        Assert.Same(schema, plan.SchemaToken);
        Assert.Equal(PlanCachePolicy.Cacheable, plan.CachePolicy);
        Assert.IsType<NoTask6ImpactBinding>(plan.Safety);
        Assert.False(plan.RequiresEffectiveImpactApproval);
        Assert.True(plan.CanApplyEffectiveImpact);
        Assert.Null(GetAttachedApproval(plan));
        AssertFingerprintShape(plan.Fingerprint);
    }

    [Fact]
    public void Every_nonnative_factory_preserves_profile_build_revision_mode_case_and_schema_identity()
    {
        var profile = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Ansi-Strict");
        var schema = new SchemaToken("schema-exact");
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.Required, schema);
        var command = Command(
            "SELECT 1", [], SqlResultShape.Scalar, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var statement = StatementPlan(SelectSource(), [command], options);
        var schemaPlan = SchemaPlan(SafeSchema("safe"),
            DestructiveImpact.None, [command], options);
        var migrationSource = Migration(("m1", SafeSchema("m")));
        var migrationCommand = Command(
            "CREATE SCHEMA m", [], SqlResultShape.None, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, migrationSource.Steps[0].Id);
        var migration = MigrationCompiled(
            migrationSource,
            [Impact(migrationSource.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.None)],
            [migrationCommand], options);
        var bulkSource = BulkOperation(1, ParameterExpression("p"));
        var bulk = BulkPlan(bulkSource,
            NativeBulk(bulkSource, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);

        foreach (var plan in new[] { statement, schemaPlan, migration, bulk })
        {
            Assert.Same(profile, plan.DialectProfile);
            Assert.Same(schema, plan.SchemaToken);
            Assert.Equal(AtomicityRequirement.Required, plan.Atomicity);
            Assert.Equal(17, plan.DialectProfile.ServerVersion.Major);
            Assert.Equal(2, plan.DialectProfile.ServerVersion.Minor);
            Assert.Equal(3, plan.DialectProfile.ServerVersion.Build);
            Assert.Equal(4, plan.DialectProfile.ServerVersion.Revision);
            Assert.Equal("Ansi-Strict", plan.DialectProfile.CompatibilityMode);
        }

        var adminOptions = new SqlCompilationOptions(
            profile, AtomicityRequirement.BestEffort, schema);
        var adminSource = CreateAdmin();
        var admin = AdminPlan(adminSource, DestructiveImpact.None,
            Admin(adminSource, PlanConnectionRole.Administrative,
                PlanTransactionBehavior.ImplicitCommit), adminOptions);
        Assert.Same(profile, admin.DialectProfile);
        Assert.Same(schema, admin.SchemaToken);
        Assert.Equal(AtomicityRequirement.BestEffort, admin.Atomicity);
    }

    [Fact]
    public void Statement_factory_rejects_null_empty_null_item_and_wrong_source_families()
    {
        var options = Options();
        var valid = Command("SELECT 1", [], SqlResultShape.Scalar,
            PlanResultRole.Final);

        Assert.Throws<ArgumentNullException>(() => StatementPlan(
            null!, [valid], options));
        Assert.Throws<ArgumentNullException>(() => StatementPlan(
            SelectSource(), [valid], null!));
        Assert.Throws<ArgumentNullException>(() => StatementPlan(
            SelectSource(), null!, options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), [], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), new SqlCommandStep[] { null! }, options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            SafeSchema("schema"), [valid], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            BulkOperation(1, ParameterExpression("p")), [valid], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            CreateAdmin(), [valid], options));
    }

    [Fact]
    public void Statement_and_schema_factories_reject_foreign_migration_correlation_and_routes()
    {
        var options = Options();
        var migrationTagged = Command(
            "SELECT 1", [], SqlResultShape.Scalar, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, StepId("foreign"));
        var administrative = Command(
            "SELECT 1", [], SqlResultShape.Scalar, PlanResultRole.Final,
            PlanConnectionRole.Administrative,
            PlanTransactionBehavior.NotEnlistable);
        var dedicated = Command(
            "SELECT 1", [], SqlResultShape.Scalar, PlanResultRole.Final,
            PlanConnectionRole.DedicatedBulk,
            PlanTransactionBehavior.Enlistable);

        Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), [migrationTagged], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), [administrative], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), [dedicated], options));
        Assert.Throws<ArgumentException>(() => SchemaPlan(
            SafeSchema("safe"), DestructiveImpact.None,
            [migrationTagged], options));
        Assert.Throws<ArgumentException>(() => SchemaPlan(
            SafeSchema("safe"), DestructiveImpact.None,
            [administrative], options));
    }

    [Fact]
    public void Direct_schema_factory_allows_only_neutral_and_effective_none()
    {
        var options = Options();
        var command = Command("CREATE SCHEMA safe", [], SqlResultShape.None,
            PlanResultRole.None);
        var source = SafeSchema("safe");
        var plan = SchemaPlan(
            source, DestructiveImpact.None, [command], options);

        Assert.IsType<NoTask6ImpactBinding>(plan.Safety);
        Assert.Equal(DestructiveImpact.None, plan.Safety.NeutralImpact);
        Assert.Equal(DestructiveImpact.None, plan.Safety.EffectiveImpact);
        Assert.Equal(SqlSafetyOrigin.PlatformGenerated, plan.Origin);
        Assert.Equal(PlanCachePolicy.Cacheable, plan.CachePolicy);

        Assert.Throws<ArgumentException>(() => SchemaPlan(
            source, DestructiveImpact.CompatibilityRisk, [command], options));
        Assert.Throws<ArgumentException>(() => SchemaPlan(
            RiskSchema("old", "new"), DestructiveImpact.CompatibilityRisk,
            [command], options));
        Assert.Throws<ArgumentException>(() => SchemaPlan(
            RiskSchema("old", "new"), DestructiveImpact.None,
            [command], options));
        Assert.Throws<ArgumentOutOfRangeException>(() => SchemaPlan(
            source, (DestructiveImpact)99, [command], options));
    }

    [Fact]
    public void Empty_plan_is_accepted_only_for_exact_empty_migration()
    {
        var source = Migration();
        var options = new SqlCompilationOptions(
            PgProfile(), AtomicityRequirement.Required,
            new SchemaToken("schema-empty"));
        var plan = MigrationCompiled(source, [], [], options);

        Assert.Empty(plan.Steps);
        AssertFullyReadOnly(plan.Steps);
        Assert.Equal(SqlResultShape.None, plan.ResultShape);
        Assert.Equal(AtomicityRequirement.Required, plan.Atomicity);
        Assert.IsType<MigrationPlanSafetyBinding>(plan.Safety);
        Assert.True(plan.CanApplyEffectiveImpact);
        Assert.Equal(PlanCachePolicy.Cacheable, plan.CachePolicy);
    }

    [Fact]
    public void Migration_factory_requires_schema_token_exact_impacts_and_full_step_id_coverage()
    {
        var source = Migration(
            ("s1", SafeSchema("one")),
            ("s2", RiskSchema("two", "three")));
        var impacts = new[]
        {
            Impact(source.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.None),
            Impact(source.Steps[1].Id,
                DestructiveImpact.CompatibilityRisk,
                DestructiveImpact.CompatibilityRisk)
        };
        var options = Options(schema: new SchemaToken("schema-v2"));
        var firstA = Command("one-a", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var firstB = Command("one-b", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var second = Command("two", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[1].Id);

        var plan = MigrationCompiled(
            source, impacts, [firstA, firstB, second], options);

        Assert.Equal(new DatabasePlanStep[] { firstA, firstB, second }, plan.Steps);
        Assert.Same(options.SchemaToken, plan.SchemaToken);
        Assert.IsType<MigrationPlanSafetyBinding>(plan.Safety);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            plan.Safety.NeutralImpact);

        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts, [firstA], options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts, [second, firstA], options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts, [firstA, second, firstB], options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts,
            [firstA, Command("foreign", [], SqlResultShape.None,
                PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable, StepId("foreign")), second],
            options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts,
            [Command("untagged", [], SqlResultShape.None)], options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, impacts, [firstA, firstB, second],
            Options(schema: null)));
    }

    [Fact]
    public void Migration_factory_rejects_nulls_foreign_impacts_routes_and_non_command_family()
    {
        var source = Migration(("s1", SafeSchema("one")));
        var impact = Impact(source.Steps[0].Id,
            DestructiveImpact.None, DestructiveImpact.None);
        var command = Command("one", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var options = Options(schema: new SchemaToken("schema"));

        Assert.Throws<ArgumentNullException>(() => MigrationCompiled(
            null!, [impact], [command], options));
        Assert.Throws<ArgumentNullException>(() => MigrationCompiled(
            source, null!, [command], options));
        Assert.Throws<ArgumentNullException>(() => MigrationCompiled(
            source, [impact], null!, options));
        Assert.Throws<ArgumentNullException>(() => MigrationCompiled(
            source, [impact], [command], null!));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, new CompiledImpactEntry[] { null! }, [command], options));
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, [Impact(StepId("foreign"),
                DestructiveImpact.None, DestructiveImpact.None)],
            [command], options));
        var adminRoute = Command("one", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.NotEnlistable, source.Steps[0].Id);
        Assert.Throws<ArgumentException>(() => MigrationCompiled(
            source, [impact], [adminRoute], options));
    }

    [Fact]
    public void Bulk_plan_requires_one_reference_identical_bulk_step_and_valid_route()
    {
        var source = BulkOperation(2,
            ParameterExpression("p"), ParameterExpression("p"));
        var step = NativeBulk(source, 1,
            PlanConnectionRole.DedicatedBulk,
            PlanTransactionBehavior.NotEnlistable);
        var options = Options();
        var plan = BulkPlan(source, step, options);

        Assert.Single(plan.Steps);
        Assert.Same(step, plan.Steps[0]);
        Assert.Equal(SqlResultShape.Bulk, plan.ResultShape);
        Assert.Equal(SqlSafetyOrigin.PlatformGenerated, plan.Origin);
        Assert.Equal(PlanCachePolicy.Cacheable, plan.CachePolicy);
        Assert.IsType<NoTask6ImpactBinding>(plan.Safety);

        var equalLooking = BulkOperation(2,
            ParameterExpression("p"), ParameterExpression("p"));
        Assert.Throws<ArgumentException>(() => BulkPlan(equalLooking, step, options));
        Assert.Throws<ArgumentNullException>(() => BulkPlan(null!, step, options));
        Assert.Throws<ArgumentNullException>(() => BulkPlan(source, null!, options));
        Assert.Throws<ArgumentNullException>(() => BulkPlan(source, step, null!));

        var administrative = NativeBulk(source, 1,
            PlanConnectionRole.Administrative,
            PlanTransactionBehavior.NotEnlistable);
        Assert.Throws<ArgumentException>(() => BulkPlan(
            source, administrative, options));
    }

    [Fact]
    public void Admin_plan_enforces_exact_subtype_safety_reference_and_route_matrix()
    {
        var options = Options();
        var create = CreateAdmin("created");
        var createStep = Admin(create, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.ImplicitCommit);
        var createPlan = AdminPlan(
            create, DestructiveImpact.None, createStep, options);
        Assert.IsType<NoTask6ImpactBinding>(createPlan.Safety);

        var drop = DropAdmin("dropped");
        var dropStep = Admin(drop, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.ImplicitCommit);
        var dropPlan = AdminPlan(drop, DestructiveImpact.PotentialDataLoss,
            dropStep, options);
        var dropSafety = Assert.IsType<DatabaseAdminSafetyBinding>(dropPlan.Safety);
        Assert.Same(drop, dropSafety.Operation);

        var import = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'd',
            DatabaseImportConflictPolicy.FailOnConflict);
        var importStep = Admin(import, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.NotEnlistable);
        var importPlan = AdminPlan(
            import, DestructiveImpact.None, importStep, options);
        Assert.IsType<DatabaseAdminSafetyBinding>(importPlan.Safety);

        var export = ExportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'e');
        var exportStep = Admin(export, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.NotEnlistable);
        Assert.IsType<NoTask6ImpactBinding>(AdminPlan(
            export, DestructiveImpact.None, exportStep, options).Safety);

        Assert.Throws<ArgumentException>(() => AdminPlan(
            create, DestructiveImpact.CompatibilityRisk, createStep, options));
        Assert.Throws<ArgumentException>(() => AdminPlan(
            export, DestructiveImpact.CompatibilityRisk, exportStep, options));
        Assert.Throws<ArgumentException>(() => AdminPlan(
            CreateAdmin("other"), DestructiveImpact.None, createStep, options));
        Assert.Throws<ArgumentException>(() => AdminPlan(
            DropAdmin("other"), DestructiveImpact.PotentialDataLoss,
            dropStep, options));

        var dedicated = Admin(create, PlanConnectionRole.DedicatedBulk,
            PlanTransactionBehavior.NotEnlistable);
        Assert.Throws<ArgumentException>(() => AdminPlan(
            create, DestructiveImpact.None, dedicated, options));
        var currentDrop = Admin(drop, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.NotEnlistable);
        Assert.Throws<ArgumentException>(() => AdminPlan(
            drop, DestructiveImpact.PotentialDataLoss, currentDrop, options));
    }

    [Fact]
    public void Admin_plan_rejects_nulls_undefined_impact_and_elevated_safe_operations()
    {
        var operation = CreateAdmin();
        var step = Admin(operation, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.ImplicitCommit);
        var options = Options();

        Assert.Throws<ArgumentNullException>(() => AdminPlan(
            null!, DestructiveImpact.None, step, options));
        Assert.Throws<ArgumentNullException>(() => AdminPlan(
            operation, DestructiveImpact.None, null!, options));
        Assert.Throws<ArgumentNullException>(() => AdminPlan(
            operation, DestructiveImpact.None, step, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() => AdminPlan(
            operation, (DestructiveImpact)99, step, options));
        Assert.Throws<ArgumentException>(() => AdminPlan(
            operation, DestructiveImpact.PotentialDataLoss, step, options));
    }

    [Fact]
    public void Native_plan_derives_all_fixed_properties_and_is_never_cacheable()
    {
        var profile = PgProfile();
        var text = NativeSqlText.UserProvided(
            "SELECT 1", profile, NativeSqlCommandKind.Read);
        var step = NativeStep(text, [], SqlResultShape.Scalar);
        var plan = NativePlan(step);

        Assert.Single(plan.Steps);
        Assert.Same(step, plan.Steps[0]);
        Assert.Equal(SqlResultShape.Scalar, plan.ResultShape);
        Assert.Equal(SqlSafetyOrigin.UserProvided, plan.Origin);
        Assert.Equal(AtomicityRequirement.None, plan.Atomicity);
        Assert.Same(profile, plan.DialectProfile);
        Assert.Null(plan.SchemaToken);
        Assert.Equal(PlanCachePolicy.DoNotCache, plan.CachePolicy);
        Assert.IsType<NoTask6ImpactBinding>(plan.Safety);
        Assert.True(plan.CanApplyEffectiveImpact);
        Assert.Equal(PlanConnectionRole.CurrentDatabase,
            plan.Steps[0].ConnectionRole);
        Assert.Equal(PlanTransactionBehavior.Opaque,
            plan.Steps[0].TransactionBehavior);

        Assert.Throws<ArgumentNullException>(() => NativePlan(null!));
    }

    [Fact]
    public void Admin_and_native_plans_are_noncacheable_while_definition_only_plans_are_cacheable()
    {
        var statement = StatementPlan(
            SelectSource(),
            [Command("SELECT 1", [], SqlResultShape.Scalar,
                PlanResultRole.Final)], Options());
        var migration = Migration();
        var compiledMigration = MigrationCompiled(
            migration, [], [], Options(schema: new SchemaToken("s")));
        var bulk = BulkOperation(1, ParameterExpression("p"));
        var bulkPlan = BulkPlan(bulk,
            NativeBulk(bulk, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), Options());
        var admin = CreateAdmin();
        var adminPlan = AdminPlan(admin, DestructiveImpact.None,
            Admin(admin, PlanConnectionRole.Administrative,
                PlanTransactionBehavior.ImplicitCommit), Options());
        var nativePlan = NativePlan(NativeStep(
            NativeSqlText.UserProvided("SELECT 1", PgProfile(),
                NativeSqlCommandKind.Read), [], SqlResultShape.Scalar));

        Assert.All(new[] { statement, compiledMigration, bulkPlan },
            plan => Assert.Equal(PlanCachePolicy.Cacheable, plan.CachePolicy));
        Assert.All(new[] { adminPlan, nativePlan },
            plan => Assert.Equal(PlanCachePolicy.DoNotCache, plan.CachePolicy));
    }

    [Fact]
    public void Plan_parameter_catalog_allows_only_structurally_identical_ordinal_reuse()
    {
        var source = SelectSource();
        var options = Options();
        var firstDefinition = Parameter(
            "same", LogicalDbType.String, size: 32,
            direction: ParameterDirection.Input, nullable: true);
        var equalDefinition = Parameter(
            "same", LogicalDbType.String, size: 32,
            direction: ParameterDirection.Input, nullable: true);
        var first = Command("one", [firstDefinition],
            SqlResultShape.None, PlanResultRole.None);
        var second = Command("two", [equalDefinition],
            SqlResultShape.Scalar, PlanResultRole.Final);

        var plan = StatementPlan(source, [first, second], options);
        Assert.Equal(2, plan.Steps.Count);

        var conflicts = new[]
        {
            Parameter("same", LogicalDbType.Int32, nullable: true),
            Parameter("same", LogicalDbType.String, size: 64, nullable: true),
            Parameter("same", LogicalDbType.String, size: 32,
                direction: ParameterDirection.Output, nullable: true),
            Parameter("same", LogicalDbType.String, size: 32,
                direction: ParameterDirection.Input, nullable: false)
        };
        foreach (var conflict in conflicts)
        {
            var conflictingStep = Command("two", [conflict],
                SqlResultShape.Scalar, PlanResultRole.Final);
            Assert.Throws<ArgumentException>(() => StatementPlan(
                source, [first, conflictingStep], options));
        }

        var caseDistinct = Command("two",
            [Parameter("Same", LogicalDbType.Int32)],
            SqlResultShape.Scalar, PlanResultRole.Final);
        Assert.Equal(2, StatementPlan(
            source, [first, caseDistinct], options).Steps.Count);
    }

    [Fact]
    public void Plan_result_derivation_handles_none_single_final_and_homogeneous_aggregate()
    {
        var options = Options();
        var source = SelectSource();

        var noContributor = StatementPlan(source,
        [
            Command("one", [], SqlResultShape.AffectedRows, PlanResultRole.None),
            Command("two", [], SqlResultShape.RowSet, PlanResultRole.None)
        ], options);
        Assert.Equal(SqlResultShape.None, noContributor.ResultShape);

        foreach (var shape in new[]
        {
            SqlResultShape.AffectedRows, SqlResultShape.Scalar,
            SqlResultShape.RowSet, SqlResultShape.ReturningRows,
            SqlResultShape.MultipleResultSets, SqlResultShape.Metadata,
            SqlResultShape.Diagnostic
        })
        {
            var single = StatementPlan(source,
                [Command("single", [], shape, PlanResultRole.Final)], options);
            Assert.Equal(shape, single.ResultShape);
        }

        foreach (var shape in new[]
        {
            SqlResultShape.AffectedRows, SqlResultShape.ReturningRows
        })
        {
            var aggregate = StatementPlan(source,
            [
                Command("one", [], shape, PlanResultRole.Aggregate),
                Command("two", [], shape, PlanResultRole.Aggregate)
            ], options);
            Assert.Equal(shape, aggregate.ResultShape);
        }
    }

    [Fact]
    public void Plan_result_derivation_rejects_ambiguous_or_heterogeneous_contributors()
    {
        var source = SelectSource();
        var options = Options();
        var cases = new[]
        {
            new[]
            {
                Command("one", [], SqlResultShape.RowSet, PlanResultRole.Final),
                Command("two", [], SqlResultShape.RowSet, PlanResultRole.Final)
            },
            new[]
            {
                Command("one", [], SqlResultShape.AffectedRows, PlanResultRole.Aggregate),
                Command("two", [], SqlResultShape.ReturningRows, PlanResultRole.Aggregate)
            },
            new[]
            {
                Command("one", [], SqlResultShape.Scalar, PlanResultRole.Final),
                Command("two", [], SqlResultShape.AffectedRows, PlanResultRole.Aggregate)
            },
            new[]
            {
                Command("one", [], SqlResultShape.RowSet, PlanResultRole.Aggregate),
                Command("two", [], SqlResultShape.RowSet, PlanResultRole.Aggregate)
            },
            new[]
            {
                Command("one", [], SqlResultShape.Metadata, PlanResultRole.Aggregate),
                Command("two", [], SqlResultShape.Metadata, PlanResultRole.Aggregate)
            }
        };

        foreach (var steps in cases)
        {
            Assert.Throws<ArgumentException>(() => StatementPlan(
                source, steps, options));
        }
    }

    [Fact]
    public void Paged_query_requires_two_independent_ordered_scalar_then_rowset_results()
    {
        var source = PagedSelectSource();
        var options = Options();
        var count = Command(
            "SELECT COUNT(*) FROM items", [], SqlResultShape.Scalar,
            PlanResultRole.Aggregate);
        var data = Command(
            "SELECT id FROM items LIMIT 10", [], SqlResultShape.RowSet,
            PlanResultRole.Aggregate);

        var plan = StatementPlan(source, [count, data], options);
        Assert.Equal(SqlResultShape.MultipleResultSets, plan.ResultShape);
        Assert.Equal(2, plan.Steps.Count);
        Assert.Same(count, plan.Steps[0]);
        Assert.Same(data, plan.Steps[1]);
        Assert.DoesNotContain(';', ((SqlCommandStep)plan.Steps[0]).CommandText);
        Assert.DoesNotContain(';', ((SqlCommandStep)plan.Steps[1]).CommandText);

        Assert.Throws<ArgumentException>(() => StatementPlan(
            source, [count], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            source, [data], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(
            source, [data, count], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(source,
        [
            Command("SELECT COUNT(*); SELECT id", [],
                SqlResultShape.MultipleResultSets, PlanResultRole.Final)
        ], options));
        Assert.Throws<ArgumentException>(() => StatementPlan(source,
        [
            Command("count", [], SqlResultShape.Scalar, PlanResultRole.Final),
            Command("data", [], SqlResultShape.RowSet, PlanResultRole.Final)
        ], options));
    }

    [Fact]
    public void Paged_query_accepts_quoted_identifier_semicolons_and_trailing_terminators()
    {
        var source = PagedSelectSource();
        var count = Command(
            "SELECT COUNT(*) FROM \"items;archive\";", [],
            SqlResultShape.Scalar, PlanResultRole.Aggregate);
        var data = Command(
            "SELECT \"id;legacy\" FROM \"items;archive\" " +
            "ORDER BY \"id;legacy\" LIMIT 10;", [],
            SqlResultShape.RowSet, PlanResultRole.Aggregate);

        var plan = StatementPlan(source, [count, data], Options());

        Assert.Equal(SqlResultShape.MultipleResultSets, plan.ResultShape);
        Assert.Equal(2, plan.Steps.Count);
        Assert.Same(count, plan.Steps[0]);
        Assert.Same(data, plan.Steps[1]);
    }

    [Fact]
    public void Paged_query_rejects_reversed_commands_even_with_legal_semicolons()
    {
        var source = PagedSelectSource();
        var count = Command(
            "SELECT COUNT(*) FROM \"items;archive\";", [],
            SqlResultShape.Scalar, PlanResultRole.Aggregate);
        var data = Command(
            "SELECT \"id;legacy\" FROM \"items;archive\" LIMIT 10;", [],
            SqlResultShape.RowSet, PlanResultRole.Aggregate);

        Assert.Throws<ArgumentException>(() => StatementPlan(
            source, [data, count], Options()));
    }

    [Fact]
    public void Nonpaged_query_accepts_only_the_same_ordered_scalar_rowset_special_case()
    {
        var plan = StatementPlan(SelectSource(),
        [
            Command("count", [], SqlResultShape.Scalar, PlanResultRole.Aggregate),
            Command("data", [], SqlResultShape.RowSet, PlanResultRole.Aggregate)
        ], Options());
        Assert.Equal(SqlResultShape.MultipleResultSets, plan.ResultShape);

        Assert.Throws<ArgumentException>(() => StatementPlan(SelectSource(),
        [
            Command("data", [], SqlResultShape.RowSet, PlanResultRole.Aggregate),
            Command("count", [], SqlResultShape.Scalar, PlanResultRole.Aggregate)
        ], Options()));
    }

    [Theory]
    [InlineData(AtomicityRequirement.None)]
    [InlineData(AtomicityRequirement.BestEffort)]
    [InlineData(AtomicityRequirement.Required)]
    public void Atomicity_is_preserved_without_ordinal_downgrade_when_evidence_is_valid(
        AtomicityRequirement requested)
    {
        var plan = StatementPlan(
            SelectSource(),
            [Command("SELECT 1", [], SqlResultShape.Scalar,
                PlanResultRole.Final, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable)],
            Options(atomicity: requested));

        Assert.Equal(requested, plan.Atomicity);
    }

    [Theory]
    [InlineData(PlanConnectionRole.Administrative, PlanTransactionBehavior.Enlistable)]
    [InlineData(PlanConnectionRole.DedicatedBulk, PlanTransactionBehavior.Enlistable)]
    [InlineData(PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.ImplicitCommit)]
    [InlineData(PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.NotEnlistable)]
    [InlineData(PlanConnectionRole.CurrentDatabase, PlanTransactionBehavior.Opaque)]
    public void Required_rejects_every_non_current_or_non_enlistable_evidence_without_downgrade(
        PlanConnectionRole connection,
        PlanTransactionBehavior transaction)
    {
        var command = Command(
            "atomicity-secret-command", [], SqlResultShape.Scalar,
            PlanResultRole.Final, connection, transaction);
        var error = Assert.Throws<ArgumentException>(() => StatementPlan(
            SelectSource(), [command],
            Options(atomicity: AtomicityRequirement.Required)));

        Assert.DoesNotContain("atomicity-secret-command", error.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain("None", error.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("BestEffort", error.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Required_rejects_dedicated_bulk_management_and_nonenlistable_admin_plans()
    {
        var bulk = BulkOperation(1, ParameterExpression("p"));
        var dedicated = NativeBulk(
            bulk, 1, PlanConnectionRole.DedicatedBulk,
            PlanTransactionBehavior.Enlistable);
        Assert.Throws<ArgumentException>(() => BulkPlan(
            bulk, dedicated, Options(atomicity: AtomicityRequirement.Required)));

        var create = CreateAdmin();
        var implicitAdmin = Admin(
            create, PlanConnectionRole.Administrative,
            PlanTransactionBehavior.ImplicitCommit);
        Assert.Throws<ArgumentException>(() => AdminPlan(
            create, DestructiveImpact.None, implicitAdmin,
            Options(atomicity: AtomicityRequirement.Required)));

        var import = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'f',
            DatabaseImportConflictPolicy.FailOnConflict);
        var nonEnlistableImport = Admin(
            import, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.NotEnlistable);
        Assert.Throws<ArgumentException>(() => AdminPlan(
            import, DestructiveImpact.None, nonEnlistableImport,
            Options(atomicity: AtomicityRequirement.Required)));
    }

    [Fact]
    public void Native_plan_has_no_public_boundary_for_non_none_atomicity()
    {
        var step = NativeStep(
            NativeSqlText.UserProvided("SELECT 1", PgProfile(),
                NativeSqlCommandKind.Read), [], SqlResultShape.Scalar);
        var plan = NativePlan(step);
        Assert.Equal(AtomicityRequirement.None, plan.Atomicity);
        Assert.DoesNotContain(typeof(DatabaseExecutionPlan).GetMethods(
                BindingFlags.Public | BindingFlags.Static |
                BindingFlags.DeclaredOnly),
            method => method.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(AtomicityRequirement)));
    }

    [Fact]
    public void Plan_to_string_is_deterministic_and_redacts_commands_native_text_and_resources()
    {
        const string commandSecret = "SELECT 'plan-command-secret'";
        var commandPlan = StatementPlan(
            SelectSource(),
            [Command(commandSecret, [], SqlResultShape.Scalar,
                PlanResultRole.Final)], Options());
        var nativeSecret = "SELECT 'plan-native-secret'";
        var nativePlan = NativePlan(NativeStep(
            NativeSqlText.UserProvided(nativeSecret, PgProfile(),
                NativeSqlCommandKind.Read), [], SqlResultShape.Scalar));
        var import = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", '9',
            DatabaseImportConflictPolicy.FailOnConflict);
        var adminPlan = AdminPlan(import, DestructiveImpact.None,
            Admin(import, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), Options());

        foreach (var plan in new[] { commandPlan, nativePlan, adminPlan })
        {
            var first = plan.ToString();
            var second = plan.ToString();
            Assert.Equal(first, second);
            Assert.Contains(plan.Fingerprint.Value, first,
                StringComparison.Ordinal);
            Assert.DoesNotContain(commandSecret, first, StringComparison.Ordinal);
            Assert.DoesNotContain("plan-command-secret", first,
                StringComparison.Ordinal);
            Assert.DoesNotContain(nativeSecret, first, StringComparison.Ordinal);
            Assert.DoesNotContain("plan-native-secret", first,
                StringComparison.Ordinal);
            Assert.DoesNotContain("resource/path", first,
                StringComparison.OrdinalIgnoreCase);
        }
    }

    // Effective-impact approval and stale-plan rejection

    [Fact]
    public void Elevated_migration_starts_closed_and_mints_exact_read_only_approval()
    {
        var specimen = ElevatedMigration();
        var plan = specimen.Plan;
        var reference = new ApprovalReference("compiled-review-001");

        Assert.True(plan.RequiresEffectiveImpactApproval);
        Assert.False(plan.CanApplyEffectiveImpact);
        Assert.Null(GetAttachedApproval(plan));

        var approval = plan.CreateEffectiveImpactApproval(reference);

        Assert.Same(specimen.Source.Fingerprint, approval.SourceFingerprint);
        Assert.Same(specimen.Profile, approval.DialectProfile);
        Assert.Same(specimen.Schema, approval.SchemaToken);
        Assert.Same(plan.Fingerprint, approval.PlanFingerprint);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            approval.EffectiveImpact);
        Assert.Single(approval.ElevatedMigrationSteps);
        Assert.Same(specimen.Impact, approval.ElevatedMigrationSteps[0]);
        AssertFullyReadOnly(approval.ElevatedMigrationSteps, specimen.Impact);
        Assert.Same(reference, approval.Reference);
    }

    [Fact]
    public void Approval_attachment_is_immutable_copy_on_write_and_does_not_change_fingerprint()
    {
        var specimen = ElevatedMigration();
        var plan = specimen.Plan;
        var firstApproval = plan.CreateEffectiveImpactApproval(
            new ApprovalReference("compiled-review-first"));

        var approved = plan.WithEffectiveImpactApproval(firstApproval);

        Assert.NotSame(plan, approved);
        Assert.False(plan.CanApplyEffectiveImpact);
        Assert.Null(GetAttachedApproval(plan));
        Assert.True(approved.CanApplyEffectiveImpact);
        Assert.Same(firstApproval, GetAttachedApproval(approved));
        Assert.Same(plan.Fingerprint, approved.Fingerprint);
        Assert.Equal(plan.Fingerprint, approved.Fingerprint);
        Assert.Equal(plan.Steps, approved.Steps);
        Assert.Same(plan.Safety, approved.Safety);
        Assert.Same(plan.DialectProfile, approved.DialectProfile);
        Assert.Same(plan.SchemaToken, approved.SchemaToken);

        var secondApproval = plan.CreateEffectiveImpactApproval(
            new ApprovalReference("compiled-review-second"));
        var replaced = approved.WithEffectiveImpactApproval(secondApproval);
        Assert.NotSame(approved, replaced);
        Assert.Same(secondApproval, GetAttachedApproval(replaced));
        Assert.Same(firstApproval, GetAttachedApproval(approved));
        Assert.Same(plan.Fingerprint, replaced.Fingerprint);
    }

    [Fact]
    public void Safe_plan_starts_open_and_rejects_needless_approval_creation_or_attachment()
    {
        var plan = StatementPlan(
            SelectSource(),
            [Command("SELECT 1", [], SqlResultShape.Scalar,
                PlanResultRole.Final)], Options());
        var elevated = ElevatedMigration();
        var foreign = elevated.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("foreign"));

        Assert.False(plan.RequiresEffectiveImpactApproval);
        Assert.True(plan.CanApplyEffectiveImpact);
        Assert.Throws<InvalidOperationException>(() =>
            plan.CreateEffectiveImpactApproval(
                new ApprovalReference("needless")));
        Assert.Throws<ArgumentException>(() =>
            plan.WithEffectiveImpactApproval(foreign));
        Assert.Throws<ArgumentNullException>(() =>
            plan.WithEffectiveImpactApproval(null!));
    }

    [Fact]
    public void Approval_creation_rejects_null_reference_without_leaking_plan_text()
    {
        var specimen = ElevatedMigration(commandText: "approval-secret-command");
        var error = Assert.Throws<ArgumentNullException>(() =>
            specimen.Plan.CreateEffectiveImpactApproval(null!));

        Assert.DoesNotContain("approval-secret-command", error.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain("secret", error.Message,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Exact_deterministic_retry_can_reuse_compiled_approval()
    {
        var source = Migration(("s1", SafeSchema("retry")));
        var profile = PgProfile();
        var schema = new SchemaToken("schema-retry");
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.BestEffort, schema);
        var impactOne = Impact(source.Steps[0].Id,
            DestructiveImpact.None, DestructiveImpact.CompatibilityRisk);
        var commandOne = Command(
            "CREATE SCHEMA retry", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var first = MigrationCompiled(
            source, [impactOne], [commandOne], options);
        var approval = first.CreateEffectiveImpactApproval(
            new ApprovalReference("retry-approval"));

        var impactTwo = Impact(source.Steps[0].Id,
            DestructiveImpact.None, DestructiveImpact.CompatibilityRisk);
        var commandTwo = Command(
            "CREATE SCHEMA retry", [], SqlResultShape.None,
            PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var retry = MigrationCompiled(
            source, [impactTwo], [commandTwo], options);

        Assert.NotSame(first, retry);
        Assert.Equal(first.Fingerprint, retry.Fingerprint);
        var approvedRetry = retry.WithEffectiveImpactApproval(approval);
        Assert.True(approvedRetry.CanApplyEffectiveImpact);
        Assert.Same(approval, GetAttachedApproval(approvedRetry));
    }

    [Fact]
    public void Foreign_or_partial_approval_is_rejected_and_never_merged()
    {
        var first = ElevatedMigration(stepId: "first");
        var second = ElevatedMigration(stepId: "second");
        var approval = first.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("foreign-approval"));

        Assert.Throws<ArgumentException>(() =>
            second.Plan.WithEffectiveImpactApproval(approval));

        var partial = InvokeNonPublicConstructor<CompiledImpactApproval>(
            first.Source.Fingerprint, first.Profile, first.Schema,
            first.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
            Array.Empty<CompiledImpactEntry>(),
            new ApprovalReference("partial"));
        Assert.Throws<ArgumentException>(() =>
            first.Plan.WithEffectiveImpactApproval(partial));

        var duplicated = InvokeNonPublicConstructor<CompiledImpactApproval>(
            first.Source.Fingerprint, first.Profile, first.Schema,
            first.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
            new[] { first.Impact, first.Impact },
            new ApprovalReference("duplicate"));
        Assert.Throws<ArgumentException>(() =>
            first.Plan.WithEffectiveImpactApproval(duplicated));
    }

    [Fact]
    public void Task6_neutral_approval_cannot_open_compiled_elevation_gate()
    {
        var source = Migration(("risk", RiskSchema("old_name", "new_name")));
        var task6Approval = source.CreateDestructiveApproval(
            [source.Steps[0].Id], new ApprovalReference("task6-neutral"));
        var neutralApprovedSource = source.WithDestructiveApproval(task6Approval);
        Assert.False(source.CanApplyNeutralDestructiveSteps);
        Assert.True(neutralApprovedSource.CanApplyNeutralDestructiveSteps);

        var options = Options(schema: new SchemaToken("dual-gate"));
        var firstImpact = Impact(source.Steps[0].Id,
            DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.PotentialDataLoss);
        var secondImpact = Impact(neutralApprovedSource.Steps[0].Id,
            DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.PotentialDataLoss);
        var firstCommand = Command(
            "ALTER TABLE old_name RENAME TO new_name", [],
            SqlResultShape.None, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var secondCommand = Command(
            "ALTER TABLE old_name RENAME TO new_name", [],
            SqlResultShape.None, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable,
            neutralApprovedSource.Steps[0].Id);

        var closedNeutral = MigrationCompiled(
            source, [firstImpact], [firstCommand], options);
        var openNeutral = MigrationCompiled(
            neutralApprovedSource, [secondImpact], [secondCommand], options);

        Assert.Equal(closedNeutral.Fingerprint, openNeutral.Fingerprint);
        Assert.False(closedNeutral.CanApplyEffectiveImpact);
        Assert.False(openNeutral.CanApplyEffectiveImpact);
        Assert.True(openNeutral.RequiresEffectiveImpactApproval);
    }

    [Fact]
    public void Compiled_approval_cannot_open_task6_neutral_gate()
    {
        var source = Migration(("risk", RiskSchema("old_name", "new_name")));
        Assert.False(source.CanApplyNeutralDestructiveSteps);
        var options = Options(schema: new SchemaToken("dual-gate"));
        var impact = Impact(source.Steps[0].Id,
            DestructiveImpact.CompatibilityRisk,
            DestructiveImpact.PotentialDataLoss);
        var command = Command(
            "ALTER TABLE old_name RENAME TO new_name", [],
            SqlResultShape.None, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, source.Steps[0].Id);
        var plan = MigrationCompiled(source, [impact], [command], options);
        var approval = plan.CreateEffectiveImpactApproval(
            new ApprovalReference("compiled-only"));

        var approved = plan.WithEffectiveImpactApproval(approval);

        Assert.True(approved.CanApplyEffectiveImpact);
        Assert.False(source.CanApplyNeutralDestructiveSteps);
        Assert.Same(source.Fingerprint, approved.Safety is MigrationPlanSafetyBinding binding
            ? binding.SourceFingerprint
            : null);
    }

    [Fact]
    public void Approval_and_reference_do_not_enter_compiled_fingerprint()
    {
        var specimen = ElevatedMigration();
        var first = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("reference-one"));
        var second = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("reference-two"));
        var firstPlan = specimen.Plan.WithEffectiveImpactApproval(first);
        var secondPlan = specimen.Plan.WithEffectiveImpactApproval(second);

        Assert.Equal(specimen.Plan.Fingerprint, firstPlan.Fingerprint);
        Assert.Equal(specimen.Plan.Fingerprint, secondPlan.Fingerprint);
        Assert.Equal(firstPlan.Fingerprint, secondPlan.Fingerprint);
        Assert.NotEqual(first.Reference, second.Reference);
    }

    [Fact]
    public void Approval_model_constructor_guards_and_copies_elevated_entries()
    {
        var specimen = ElevatedMigration();
        var list = new List<CompiledImpactEntry> { specimen.Impact };
        var reference = new ApprovalReference("manual-approval");
        var approval = InvokeNonPublicConstructor<CompiledImpactApproval>(
            specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
            specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
            list, reference);
        list.Clear();

        Assert.Single(approval.ElevatedMigrationSteps);
        AssertFullyReadOnly(approval.ElevatedMigrationSteps, specimen.Impact);

        Assert.Throws<ArgumentNullException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                null!, specimen.Profile, specimen.Schema,
                specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
                new[] { specimen.Impact }, reference));
        Assert.Throws<ArgumentNullException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, null!, specimen.Schema,
                specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
                new[] { specimen.Impact }, reference));
        Assert.Throws<ArgumentNullException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
                null!, DestructiveImpact.CompatibilityRisk,
                new[] { specimen.Impact }, reference));
        Assert.Throws<ArgumentNullException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
                specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
                null!, reference));
        Assert.Throws<ArgumentException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
                specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
                new CompiledImpactEntry[] { null! }, reference));
        Assert.Throws<ArgumentNullException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
                specimen.Plan.Fingerprint, DestructiveImpact.CompatibilityRisk,
                new[] { specimen.Impact }, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            InvokeNonPublicConstructor<CompiledImpactApproval>(
                specimen.Source.Fingerprint, specimen.Profile, specimen.Schema,
                specimen.Plan.Fingerprint, (DestructiveImpact)99,
                new[] { specimen.Impact }, reference));
    }

    [Fact]
    public void Elevated_import_uses_authoritative_admin_fingerprint_and_empty_migration_entries()
    {
        var operation = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'a',
            DatabaseImportConflictPolicy.FailOnConflict);
        var step = Admin(operation, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.NotEnlistable);
        var profile = PgProfile();
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.None, null);
        var plan = AdminPlan(
            operation, DestructiveImpact.CompatibilityRisk, step, options);

        Assert.True(plan.RequiresEffectiveImpactApproval);
        Assert.False(plan.CanApplyEffectiveImpact);
        var safety = Assert.IsType<DatabaseAdminSafetyBinding>(plan.Safety);
        Assert.Same(operation.Fingerprint, safety.SourceFingerprint);

        var reference = new ApprovalReference("import-elevation");
        var approval = plan.CreateEffectiveImpactApproval(reference);
        Assert.Same(operation.Fingerprint, approval.SourceFingerprint);
        Assert.Same(profile, approval.DialectProfile);
        Assert.Null(approval.SchemaToken);
        Assert.Empty(approval.ElevatedMigrationSteps);
        AssertFullyReadOnly(approval.ElevatedMigrationSteps);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            approval.EffectiveImpact);
        Assert.True(plan.WithEffectiveImpactApproval(approval)
            .CanApplyEffectiveImpact);
    }

    [Fact]
    public void Drop_and_neutral_import_do_not_accept_needless_compiled_approval()
    {
        var drop = DropAdmin("drop");
        var dropPlan = AdminPlan(drop, DestructiveImpact.PotentialDataLoss,
            Admin(drop, PlanConnectionRole.Administrative,
                PlanTransactionBehavior.ImplicitCommit), Options());
        var safeImport = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'b',
            DatabaseImportConflictPolicy.SkipExisting);
        var importPlan = AdminPlan(safeImport, DestructiveImpact.None,
            Admin(safeImport, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), Options());

        Assert.True(dropPlan.CanApplyEffectiveImpact);
        Assert.True(importPlan.CanApplyEffectiveImpact);
        Assert.Throws<InvalidOperationException>(() =>
            dropPlan.CreateEffectiveImpactApproval(
                new ApprovalReference("needless-drop")));
        Assert.Throws<InvalidOperationException>(() =>
            importPlan.CreateEffectiveImpactApproval(
                new ApprovalReference("needless-import")));
    }

    [Fact]
    public void Profile_database_and_every_version_or_mode_field_make_old_approval_stale()
    {
        var specimen = ElevatedMigration();
        var approval = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("profile-stale"));
        var baseline = specimen.Profile;
        var mutations = new[]
        {
            new DialectProfile(DatabaseType.MySql,
                baseline.ServerVersion, baseline.CompatibilityMode),
            new DialectProfile(baseline.DatabaseType,
                new Version(18, 2, 3, 4), baseline.CompatibilityMode),
            new DialectProfile(baseline.DatabaseType,
                new Version(17, 3, 3, 4), baseline.CompatibilityMode),
            new DialectProfile(baseline.DatabaseType,
                new Version(17, 2, 4, 4), baseline.CompatibilityMode),
            new DialectProfile(baseline.DatabaseType,
                new Version(17, 2, 3, 5), baseline.CompatibilityMode),
            new DialectProfile(baseline.DatabaseType,
                baseline.ServerVersion, "MODE"),
            new DialectProfile(baseline.DatabaseType,
                baseline.ServerVersion, "Mode ")
        };

        foreach (var mutation in mutations)
        {
            var changed = RecompileElevatedMigration(
                specimen, profile: mutation);
            Assert.NotEqual(specimen.Plan.Fingerprint, changed.Fingerprint);
            Assert.Throws<ArgumentException>(() =>
                changed.WithEffectiveImpactApproval(approval));
        }
    }

    [Fact]
    public void Schema_source_and_atomicity_changes_make_old_approval_stale()
    {
        var specimen = ElevatedMigration();
        var approval = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("context-stale"));
        var schemaChanged = RecompileElevatedMigration(
            specimen, schema: new SchemaToken("schema-other"));
        var atomicityChanged = RecompileElevatedMigration(
            specimen, atomicity: AtomicityRequirement.BestEffort);
        var otherSource = ElevatedMigration(
            stepId: specimen.Source.Steps[0].Id.Value,
            schemaName: "other-source");

        foreach (var changed in new[]
        {
            schemaChanged, atomicityChanged, otherSource.Plan
        })
        {
            Assert.NotEqual(specimen.Plan.Fingerprint, changed.Fingerprint);
            Assert.Throws<ArgumentException>(() =>
                changed.WithEffectiveImpactApproval(approval));
        }
    }

    [Fact]
    public void Step_command_definition_result_transaction_and_impact_changes_stale_approval()
    {
        var specimen = ElevatedMigration(
            commandText: "command-v1",
            resultShape: SqlResultShape.Scalar,
            resultRole: PlanResultRole.None,
            parameter: Parameter("p", LogicalDbType.String, size: 32));
        var approval = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("step-stale"));
        var mutations = new[]
        {
            RecompileElevatedMigration(specimen, commandText: "command-v2"),
            RecompileElevatedMigration(specimen,
                parameter: Parameter("p", LogicalDbType.String, size: 64)),
            RecompileElevatedMigration(specimen,
                parameter: Parameter("p", LogicalDbType.Int32)),
            RecompileElevatedMigration(specimen,
                parameter: Parameter("p", LogicalDbType.String, size: 32,
                    direction: ParameterDirection.Output)),
            RecompileElevatedMigration(specimen,
                parameter: Parameter("p", LogicalDbType.String, size: 32,
                nullable: false)),
            RecompileElevatedMigration(specimen,
                resultShape: SqlResultShape.RowSet,
                resultRole: PlanResultRole.None),
            RecompileElevatedMigration(specimen,
                resultShape: SqlResultShape.AffectedRows,
                resultRole: PlanResultRole.None),
            RecompileElevatedMigration(specimen,
                transaction: PlanTransactionBehavior.NotEnlistable),
            RecompileElevatedMigration(specimen,
                effectiveImpact: DestructiveImpact.PotentialDataLoss)
        };

        foreach (var changed in mutations)
        {
            Assert.NotEqual(specimen.Plan.Fingerprint, changed.Fingerprint);
            Assert.Throws<ArgumentException>(() =>
                changed.WithEffectiveImpactApproval(approval));
        }
    }

    [Fact]
    public void Migration_step_id_and_order_changes_make_approval_stale()
    {
        var specimen = ElevatedMigration(stepId: "step-one");
        var approval = specimen.Plan.CreateEffectiveImpactApproval(
            new ApprovalReference("order-stale"));
        var changedId = ElevatedMigration(stepId: "step-two").Plan;

        var source = Migration(
            ("a", SafeSchema("a")),
            ("b", SafeSchema("b")));
        var options = new SqlCompilationOptions(
            specimen.Profile, AtomicityRequirement.None, specimen.Schema);
        var impacts = new[]
        {
            Impact(source.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.CompatibilityRisk),
            Impact(source.Steps[1].Id,
                DestructiveImpact.None, DestructiveImpact.None)
        };
        var commands = new[]
        {
            Command("a", [], SqlResultShape.None, PlanResultRole.None,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable, source.Steps[0].Id),
            Command("b", [], SqlResultShape.None, PlanResultRole.None,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable, source.Steps[1].Id)
        };
        var ordered = MigrationCompiled(source, impacts, commands, options);
        var orderedApproval = ordered.CreateEffectiveImpactApproval(
            new ApprovalReference("ordered"));

        var reversedSource = Migration(
            ("b", SafeSchema("b")),
            ("a", SafeSchema("a")));
        var reversedImpacts = new[]
        {
            Impact(reversedSource.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.None),
            Impact(reversedSource.Steps[1].Id,
                DestructiveImpact.None, DestructiveImpact.CompatibilityRisk)
        };
        var reversedCommands = new[]
        {
            Command("b", [], SqlResultShape.None, PlanResultRole.None,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable,
                reversedSource.Steps[0].Id),
            Command("a", [], SqlResultShape.None, PlanResultRole.None,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable,
                reversedSource.Steps[1].Id)
        };
        var reversed = MigrationCompiled(
            reversedSource, reversedImpacts, reversedCommands, options);

        Assert.Throws<ArgumentException>(() =>
            changedId.WithEffectiveImpactApproval(approval));
        Assert.NotEqual(ordered.Fingerprint, reversed.Fingerprint);
        Assert.Throws<ArgumentException>(() =>
            reversed.WithEffectiveImpactApproval(orderedApproval));
    }

    [Fact]
    public void Bulk_batch_size_row_counts_order_and_kind_affect_fingerprint()
    {
        var source = BulkOperation(3,
            ParameterExpression("p"), ParameterExpression("p"),
            ParameterExpression("p"));
        var options = Options();
        var commandA = Command("batch-a", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None);
        var commandB = Command("batch-b", [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None);
        var nativeOne = BulkPlan(source,
            NativeBulk(source, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);
        var nativeTwo = BulkPlan(source,
            NativeBulk(source, 2, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);
        var batched21 = BulkPlan(source,
            BatchedBulk(source, 2,
                [BulkBatch(commandA, 2), BulkBatch(commandB, 1)],
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);
        var batched12 = BulkPlan(source,
            BatchedBulk(source, 2,
                [BulkBatch(commandA, 1), BulkBatch(commandB, 2)],
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);
        var reversed = BulkPlan(source,
            BatchedBulk(source, 2,
                [BulkBatch(commandB, 1), BulkBatch(commandA, 2)],
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);

        AssertPairwiseDistinctFingerprints(
            nativeOne, nativeTwo, batched21, batched12, reversed);
    }

    [Fact]
    public void Admin_target_resource_digest_format_scope_policy_and_effective_impact_affect_fingerprint()
    {
        var options = Options();
        DatabaseExecutionPlan Build(
            string id, char digest, DatabaseTransferFormat format,
            DatabaseTransferScope scope, DatabaseImportConflictPolicy policy,
            DestructiveImpact effective)
        {
            var operation = ImportAdmin(id, digest, policy, format, scope);
            return AdminPlan(operation, effective,
                Admin(operation, PlanConnectionRole.CurrentDatabase,
                    PlanTransactionBehavior.NotEnlistable), options);
        }

        var baseline = Build(
            "00112233-4455-6677-8899-aabbccddeeff", 'a',
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.FailOnConflict,
            DestructiveImpact.CompatibilityRisk);
        var otherTargetOperation = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'a',
            DatabaseImportConflictPolicy.FailOnConflict,
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            database: "other_import_database");
        var otherTarget = AdminPlan(
            otherTargetOperation, DestructiveImpact.CompatibilityRisk,
            Admin(otherTargetOperation, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), options);
        var mutations = new[]
        {
            otherTarget,
            Build("11112233-4455-6677-8899-aabbccddeeff", 'a',
                DatabaseTransferFormat.PortableJson,
                DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.FailOnConflict,
                DestructiveImpact.CompatibilityRisk),
            Build("00112233-4455-6677-8899-aabbccddeeff", 'b',
                DatabaseTransferFormat.PortableJson,
                DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.FailOnConflict,
                DestructiveImpact.CompatibilityRisk),
            Build("00112233-4455-6677-8899-aabbccddeeff", 'a',
                DatabaseTransferFormat.DelimitedText,
                DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.FailOnConflict,
                DestructiveImpact.CompatibilityRisk),
            Build("00112233-4455-6677-8899-aabbccddeeff", 'a',
                DatabaseTransferFormat.PortableJson,
                DatabaseTransferScope.SchemaOnly,
                DatabaseImportConflictPolicy.FailOnConflict,
                DestructiveImpact.CompatibilityRisk),
            Build("00112233-4455-6677-8899-aabbccddeeff", 'a',
                DatabaseTransferFormat.PortableJson,
                DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.SkipExisting,
                DestructiveImpact.CompatibilityRisk),
            Build("00112233-4455-6677-8899-aabbccddeeff", 'a',
                DatabaseTransferFormat.PortableJson,
                DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.FailOnConflict,
                DestructiveImpact.PotentialDataLoss)
        };

        Assert.All(mutations, mutation =>
            Assert.NotEqual(baseline.Fingerprint, mutation.Fingerprint));
        var approval = baseline.CreateEffectiveImpactApproval(
            new ApprovalReference("admin-stale"));
        Assert.All(mutations, mutation =>
            Assert.Throws<ArgumentException>(() =>
                mutation.WithEffectiveImpactApproval(approval)));
    }

    [Fact]
    public void Native_digest_result_shape_and_origin_affect_plan_fingerprint()
    {
        DatabaseExecutionPlan Build(
            NativeSqlText text, SqlResultShape shape) =>
            NativePlan(NativeStep(text, [], shape));

        var baselineText = NativeSqlText.UserProvided(
            "SELECT 1", PgProfile(), NativeSqlCommandKind.Read);
        var baseline = Build(baselineText, SqlResultShape.Scalar);
        var mutations = new[]
        {
            Build(NativeSqlText.UserProvided(
                    "SELECT 2", PgProfile(), NativeSqlCommandKind.Read),
                SqlResultShape.Scalar),
            Build(NativeSqlText.LegacyAiGenerated(
                    "SELECT 1", PgProfile(), NativeSqlCommandKind.Read),
                SqlResultShape.Scalar),
            Build(NativeSqlText.UserProvided(
                    "SELECT 1", PgProfile(), NativeSqlCommandKind.Write),
                SqlResultShape.Scalar),
            Build(baselineText, SqlResultShape.RowSet)
        };

        Assert.All(mutations, mutation =>
            Assert.NotEqual(baseline.Fingerprint, mutation.Fingerprint));
        Assert.All(mutations, mutation =>
            Assert.DoesNotContain("SELECT", mutation.Fingerprint.Value,
                StringComparison.OrdinalIgnoreCase));
    }

    // Normative compiled fingerprints

    [Fact]
    public void Native_scalar_plan_matches_fifth_literal_vector_and_independent_encoder()
    {
        var profile = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2), string.Empty);
        var native = NativeSqlText.UserProvided(
            "SELECT 1", profile, NativeSqlCommandKind.Read);
        var plan = NativePlan(NativeStep(native, [], SqlResultShape.Scalar));

        Assert.Equal(PlanNativePgScalar,
            ReferenceWireEncoder.NativeScalarPlanFingerprint(
                DatabaseType.PostgreSql, new Version(17, 2), string.Empty,
                NativePgSelect1, 8, SqlSafetyOrigin.UserProvided,
                NativeSqlCommandKind.Read));
        Assert.Equal(PlanNativePgScalar,
            ReferenceWireEncoder.PlanFingerprint(plan));
        Assert.Equal(PlanNativePgScalar, plan.Fingerprint.Value);
    }

    [Fact]
    public void Independent_encoder_matches_representative_command_migration_bulk_and_admin_plans()
    {
        var profile = DmProfile();
        var schema = new SchemaToken("模式-雪-v1");
        var statement = StatementPlan(
            SelectSource(),
            [Command("SELECT @雪", [Parameter(
                    "雪", LogicalDbType.Decimal, precision: 19, scale: 4,
                    direction: ParameterDirection.InputOutput, nullable: false)],
                SqlResultShape.Scalar, PlanResultRole.Final,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable)],
            new SqlCompilationOptions(
                profile, AtomicityRequirement.BestEffort, schema));

        var migrationSource = Migration(
            ("安全", SafeSchema("安全")),
            ("风险", RiskSchema("旧", "新")));
        var migrationImpacts = new[]
        {
            Impact(migrationSource.Steps[0].Id,
                DestructiveImpact.None, DestructiveImpact.None),
            Impact(migrationSource.Steps[1].Id,
                DestructiveImpact.CompatibilityRisk,
                DestructiveImpact.PotentialDataLoss)
        };
        var migration = MigrationCompiled(
            migrationSource, migrationImpacts,
            new[]
            {
                Command("CREATE SCHEMA 安全", [], SqlResultShape.None,
                    PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
                    PlanTransactionBehavior.Enlistable,
                    migrationSource.Steps[0].Id),
                Command("ALTER TABLE 旧 RENAME TO 新", [], SqlResultShape.None,
                    PlanResultRole.None, PlanConnectionRole.CurrentDatabase,
                    PlanTransactionBehavior.Enlistable,
                    migrationSource.Steps[1].Id)
            },
            new SqlCompilationOptions(profile, AtomicityRequirement.None, schema));

        var bulkSource = ComplexBulkOperation();
        var bulk = BulkPlan(bulkSource,
            NativeBulk(bulkSource, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable),
            new SqlCompilationOptions(profile));

        var import = ImportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'f',
            DatabaseImportConflictPolicy.FailOnConflict,
            DatabaseTransferFormat.DelimitedText,
            DatabaseTransferScope.DataOnly);
        var admin = AdminPlan(
            import, DestructiveImpact.CompatibilityRisk,
            Admin(import, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable),
            new SqlCompilationOptions(profile));

        foreach (var plan in new[] { statement, migration, bulk, admin })
        {
            Assert.Equal(
                ReferenceWireEncoder.PlanFingerprint(plan),
                plan.Fingerprint.Value);
        }
    }

    [Fact]
    public void Independent_encoder_matches_batched_bulk_and_every_admin_operation_tag()
    {
        var options = Options();
        var bulkSource = BulkOperation(2,
            ParameterExpression("p"), ParameterExpression("p"));
        var batchCommand = Command(
            "INSERT INTO bulk_items(value) VALUES (@p)",
            [Parameter("p", LogicalDbType.String)],
            SqlResultShape.AffectedRows, PlanResultRole.None,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable);
        var batched = BulkPlan(bulkSource,
            BatchedBulk(bulkSource, 1,
                [BulkBatch(batchCommand, 1), BulkBatch(batchCommand, 1)],
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), options);

        var createSource = CreateAdmin("created");
        var create = AdminPlan(createSource, DestructiveImpact.None,
            Admin(createSource, PlanConnectionRole.Administrative,
                PlanTransactionBehavior.ImplicitCommit), options);
        var dropSource = DropAdmin("dropped");
        var drop = AdminPlan(dropSource, DestructiveImpact.PotentialDataLoss,
            Admin(dropSource, PlanConnectionRole.Administrative,
                PlanTransactionBehavior.ImplicitCommit), options);
        var exportSource = ExportAdmin(
            "00112233-4455-6677-8899-aabbccddeeff", 'e',
            DatabaseTransferFormat.ProviderNative,
            DatabaseTransferScope.SchemaOnly);
        var export = AdminPlan(exportSource, DestructiveImpact.None,
            Admin(exportSource, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), options);
        var importSource = ImportAdmin(
            "11112233-4455-6677-8899-aabbccddeeff", '1',
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        var import = AdminPlan(
            importSource, DestructiveImpact.PotentialDataLoss,
            Admin(importSource, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), options);

        foreach (var plan in new[] { batched, create, drop, export, import })
        {
            Assert.Equal(ReferenceWireEncoder.PlanFingerprint(plan),
                plan.Fingerprint.Value);
        }
    }

    [Fact]
    public void Identical_independent_plan_construction_has_identical_fingerprint()
    {
        DatabaseExecutionPlan Build()
        {
            var profile = new DialectProfile(
                DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Mode");
            var schema = new SchemaToken("schema-stable");
            return StatementPlan(
                SelectSource(),
                new[]
                {
                    Command("SELECT @p", [Parameter(
                            "p", LogicalDbType.String, size: 128,
                            direction: ParameterDirection.Input,
                            nullable: true)],
                        SqlResultShape.RowSet, PlanResultRole.Final,
                        PlanConnectionRole.CurrentDatabase,
                        PlanTransactionBehavior.Enlistable)
                },
                new SqlCompilationOptions(
                    profile, AtomicityRequirement.BestEffort, schema));
        }

        var first = Build();
        var second = Build();

        Assert.NotSame(first, second);
        Assert.NotSame(first.DialectProfile, second.DialectProfile);
        Assert.NotSame(first.SchemaToken, second.SchemaToken);
        Assert.Equal(first.Fingerprint, second.Fingerprint);
        Assert.Equal(first.Fingerprint.GetHashCode(),
            second.Fingerprint.GetHashCode());
        Assert.Equal(ReferenceWireEncoder.PlanFingerprint(first),
            first.Fingerprint.Value);
    }

    [Fact]
    public void Runtime_parameter_values_results_timestamps_and_object_hashes_do_not_affect_fingerprint()
    {
        var definition = Parameter("p", LogicalDbType.String);
        var plan = StatementPlan(
            SelectSource(),
            [Command("SELECT @p", [definition], SqlResultShape.Scalar,
                PlanResultRole.Final)], Options());
        var before = plan.Fingerprint;
        var firstValues = new ParameterBag().Add("p", "runtime-secret-one");
        var secondValues = new ParameterBag().Add("p", "runtime-secret-two");
        var timestamp = DateTimeOffset.UtcNow;
        var result = new object();

        Assert.NotEqual(firstValues["p"], secondValues["p"]);
        Assert.NotSame(firstValues, result);
        Assert.NotEqual(default, timestamp);
        Assert.Same(before, plan.Fingerprint);
        Assert.Equal(ReferenceWireEncoder.PlanFingerprint(plan),
            plan.Fingerprint.Value);
        Assert.DoesNotContain("runtime-secret", plan.Fingerprint.Value,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Unknown_bulk_ast_extensions_fail_closed_before_a_fingerprint_is_issued()
    {
        var operations = new[]
        {
            BulkOperation(1, new UnknownExpression()),
            BulkOperation(1,
                new SubqueryExpression(new UnknownQueryNode())),
            BulkOperation(1,
                new SubqueryExpression(new SelectStatement(
                    new UnknownTableSource(),
                    [new SelectProjection(BooleanExpression.True)]))),
            BulkOperation(1,
                new SubqueryExpression(new SelectStatement(
                    [new SelectProjection(BooleanExpression.True)],
                    page: new UnknownPageSpec())))
        };

        foreach (var operation in operations)
        {
            Assert.ThrowsAny<ArgumentException>(() =>
            {
                var step = NativeBulk(
                    operation, 1, PlanConnectionRole.CurrentDatabase,
                    PlanTransactionBehavior.Enlistable);
                _ = BulkPlan(operation, step, Options()).Fingerprint;
            });
        }
    }

    [Fact]
    public void Every_parameter_definition_field_is_independently_fingerprint_sensitive()
    {
        DatabaseExecutionPlan Build(ParameterDefinition definition) =>
            StatementPlan(SelectSource(),
                [Command("SELECT @p", [definition], SqlResultShape.Scalar,
                    PlanResultRole.Final)], Options());

        var baseline = Build(Parameter(
            "p", LogicalDbType.Decimal, size: 32, precision: 19, scale: 4,
            direction: ParameterDirection.Input, nullable: true));
        var mutations = new[]
        {
            Build(Parameter("P", LogicalDbType.Decimal, size: 32,
                precision: 19, scale: 4)),
            Build(Parameter("p", LogicalDbType.Double, size: 32,
                precision: 19, scale: 4)),
            Build(Parameter("p", LogicalDbType.Decimal, size: 64,
                precision: 19, scale: 4)),
            Build(Parameter("p", LogicalDbType.Decimal, size: 32,
                precision: 20, scale: 4)),
            Build(Parameter("p", LogicalDbType.Decimal, size: 32,
                precision: 19, scale: 5)),
            Build(Parameter("p", LogicalDbType.Decimal, size: 32,
                precision: 19, scale: 4,
                direction: ParameterDirection.Output)),
            Build(Parameter("p", LogicalDbType.Decimal, size: 32,
                precision: 19, scale: 4, nullable: false))
        };

        Assert.All(mutations, mutation =>
            Assert.NotEqual(baseline.Fingerprint, mutation.Fingerprint));
    }

    [Fact]
    public void Route_transaction_result_role_schema_presence_and_step_order_affect_fingerprint()
    {
        var bulkSource = BulkOperation(1, ParameterExpression("p"));
        var current = BulkPlan(bulkSource,
            NativeBulk(bulkSource, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), Options());
        var dedicated = BulkPlan(bulkSource,
            NativeBulk(bulkSource, 1, PlanConnectionRole.DedicatedBulk,
                PlanTransactionBehavior.Enlistable), Options());
        var nonEnlistable = BulkPlan(bulkSource,
            NativeBulk(bulkSource, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.NotEnlistable), Options());
        AssertPairwiseDistinctFingerprints(current, dedicated, nonEnlistable);

        var final = StatementPlan(SelectSource(),
            [Command("write", [], SqlResultShape.AffectedRows,
                PlanResultRole.Final)], Options());
        var aggregate = StatementPlan(SelectSource(),
            [Command("write", [], SqlResultShape.AffectedRows,
                PlanResultRole.Aggregate)], Options());
        Assert.NotEqual(final.Fingerprint, aggregate.Fingerprint);

        var withoutSchema = StatementPlan(SelectSource(),
            [Command("SELECT 1", [], SqlResultShape.Scalar,
                PlanResultRole.Final)], Options());
        var withSchema = StatementPlan(SelectSource(),
            [Command("SELECT 1", [], SqlResultShape.Scalar,
                PlanResultRole.Final)],
            Options(schema: new SchemaToken("present")));
        Assert.NotEqual(withoutSchema.Fingerprint, withSchema.Fingerprint);

        var one = Command("one", [], SqlResultShape.None, PlanResultRole.None);
        var two = Command("two", [], SqlResultShape.Scalar, PlanResultRole.Final);
        var ordered = StatementPlan(SelectSource(), [one, two], Options());
        var reversed = StatementPlan(SelectSource(), [two, one], Options());
        Assert.NotEqual(ordered.Fingerprint, reversed.Fingerprint);
    }

    [Fact]
    public void Independent_reference_encoder_uses_strict_utf8_and_not_replacement_fallback()
    {
        Assert.Throws<EncoderFallbackException>(() =>
            ReferenceWireEncoder.ProfileFingerprint(
                DatabaseType.PostgreSql, new Version(17, 2), "bad\uD800"));
        Assert.Throws<EncoderFallbackException>(() =>
            ReferenceWireEncoder.NativeDigest(
                DatabaseType.PostgreSql, new Version(17, 2), string.Empty,
                SqlSafetyOrigin.UserProvided, NativeSqlCommandKind.Read,
                "SELECT '\uD800'"));
    }

    [Fact]
    public void Production_bulk_fingerprint_matches_independent_in_boolean_and_offset_specimen()
    {
        var inParameter = ParameterExpression("in_value", LogicalDbType.String);
        var pageParameter = ParameterExpression("page_value", LogicalDbType.Int32);
        var pagedQuery = new SelectStatement(
            [new SelectProjection(pageParameter)],
            whereExpression: new InExpression(
                pageParameter,
                [BooleanExpression.True, BooleanExpression.False]),
            page: new OffsetPageSpec(3, 7));
        var source = new BulkInsertOperation(
            ObjectName("bulk_expression_catalog"),
            [Id("in_result"), Id("page_result"), Id("boolean_result")],
            [new SqlInsertRow(
            [
                new InExpression(inParameter,
                    [BooleanExpression.True, BooleanExpression.False]),
                new SubqueryExpression(pagedQuery),
                BooleanExpression.False
            ])],
            batchSize: 1);
        var plan = BulkPlan(
            source,
            NativeBulk(source, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable),
            Options());

        Assert.Equal(SqlResultShape.Bulk, plan.ResultShape);
        Assert.Equal(ReferenceWireEncoder.PlanFingerprint(plan),
            plan.Fingerprint.Value);

        var trueSource = new BulkInsertOperation(
            ObjectName("bulk_expression_catalog"),
            [Id("in_result"), Id("page_result"), Id("boolean_result")],
            [new SqlInsertRow(
            [
                new InExpression(inParameter,
                    [BooleanExpression.True, BooleanExpression.False]),
                new SubqueryExpression(pagedQuery),
                BooleanExpression.True
            ])], 1);
        var truePlan = BulkPlan(trueSource,
            NativeBulk(trueSource, 1, PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable), Options());
        Assert.NotEqual(plan.Fingerprint, truePlan.Fingerprint);
    }

    [Fact]
    public void Bulk_parameter_traversal_reaches_in_values_and_offset_query_descendants()
    {
        var sourceDefinition = Parameter(
            "nested_conflict", LogicalDbType.String,
            ParameterDirection.Input, true);
        var queryDefinition = Parameter(
            "nested_conflict", LogicalDbType.Int32,
            ParameterDirection.Input, true);
        var query = new SelectStatement(
            [new SelectProjection(BooleanExpression.True)],
            whereExpression: new InExpression(
                BooleanExpression.True,
                [new ParameterExpression(queryDefinition), BooleanExpression.False]),
            page: new OffsetPageSpec(0, 5));
        var operation = new BulkInsertOperation(
            ObjectName("bulk_conflict"), [Id("left"), Id("right")],
            [new SqlInsertRow(
            [
                new InExpression(new ParameterExpression(sourceDefinition),
                    [BooleanExpression.True, BooleanExpression.False]),
                new SubqueryExpression(query)
            ])], 1);

        Assert.Throws<ArgumentException>(() => NativeBulk(
            operation, 1, PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable));
    }

    // Architecture and sensitive-data boundary

    [Fact]
    public void Task7_accessible_surface_is_complete_closed_and_automatically_discovered()
    {
        var owned = Task7OwnedTypes();
        var actualTopLevel = owned
            .Where(type => type.IsPublic && !type.IsNested)
            .OrderBy(type => type.FullName, StringComparer.Ordinal)
            .ToArray();
        var expectedTopLevel = ExpectedTask7PublicTypes()
            .OrderBy(type => type.FullName, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(expectedTopLevel, actualTopLevel);

        Assert.DoesNotContain(owned, type => type.IsNested &&
            (type.IsNestedPublic || type.IsNestedFamily ||
             type.IsNestedFamORAssem || type.IsNestedFamANDAssem));

        const BindingFlags declared = BindingFlags.Public |
                                      BindingFlags.NonPublic |
                                      BindingFlags.Instance |
                                      BindingFlags.Static |
                                      BindingFlags.DeclaredOnly;
        foreach (var type in actualTopLevel)
        {
            AssertExactTask7PublicTypeContract(type);

            var constructors = type.GetConstructors(declared)
                .Where(IsVisible).ToArray();
            if (type == typeof(DialectProfile) ||
                type == typeof(SqlCompilationOptions))
            {
                Assert.Single(constructors);
                Assert.True(constructors[0].IsPublic);
            }
            else
            {
                Assert.Empty(constructors);
            }

            var properties = type.GetProperties(declared)
                .Where(property =>
                    (property.GetMethod != null && IsVisible(property.GetMethod)) ||
                    (property.SetMethod != null && IsVisible(property.SetMethod)))
                .OrderBy(property => property.Name, StringComparer.Ordinal)
                .ToArray();
            Assert.Equal(
                ExpectedAccessiblePropertyNames(type)
                    .OrderBy(name => name, StringComparer.Ordinal),
                properties.Select(property => property.Name));
            Assert.All(properties, property =>
            {
                Assert.NotNull(property.GetMethod);
                Assert.True(property.GetMethod!.IsPublic);
                Assert.Null(property.SetMethod);
                Assert.Empty(property.GetIndexParameters());
            });

            var specialMethods = type.GetMethods(declared)
                .Where(method => IsVisible(method) && method.IsSpecialName)
                .OrderBy(method => method.Name, StringComparer.Ordinal)
                .ToArray();
            Assert.Equal(
                properties.Select(property => "get_" + property.Name)
                    .OrderBy(name => name, StringComparer.Ordinal),
                specialMethods.Select(method => method.Name));
            Assert.All(specialMethods, method =>
            {
                Assert.True(method.IsPublic);
                Assert.False(method.IsStatic);
                Assert.Empty(method.GetParameters());
            });

            var fields = type.GetFields(declared).Where(field =>
                    field.IsPublic || field.IsFamily ||
                    field.IsFamilyOrAssembly || field.IsFamilyAndAssembly)
                .ToArray();
            if (type.IsEnum)
            {
                Assert.Equal(Enum.GetNames(type),
                    fields.Where(field => field.IsLiteral)
                        .Select(field => field.Name));
                Assert.DoesNotContain(fields,
                    field => !field.IsLiteral && field.Name != "value__");
            }
            else
            {
                Assert.Empty(fields);
            }

            Assert.DoesNotContain(type.GetEvents(declared), @event =>
                (@event.AddMethod != null && IsVisible(@event.AddMethod)) ||
                (@event.RemoveMethod != null && IsVisible(@event.RemoveMethod)));
            Assert.DoesNotContain(type.GetNestedTypes(declared), nested =>
                nested.IsNestedPublic || nested.IsNestedFamily ||
                nested.IsNestedFamORAssem || nested.IsNestedFamANDAssem);

            Assert.DoesNotContain(properties,
                property => UnwrapEnumerable(property.PropertyType) == typeof(object));
        }

        AssertDeclaredVisibleMethods(typeof(ISqlCompiler),
            "Compile(SqlStatement,SqlCompilationOptions)",
            "CompileMigration(MigrationPlan,SqlCompilationOptions)");
    }

    [Fact]
    public void Owned_source_discovery_and_type_attribute_mask_catch_mutations()
    {
        const string source = "public sealed class GlobalOwned { } " +
            @"namespace \u0044os.\u004fRM.Execution { " +
            "[Obsolete] public sealed class AddedExecutor { } " +
            "public delegate void AddedCallback(); } " +
            @"namespace \U00010400 { " +
            "public sealed class SupplementaryOwned { } } " +
            "namespace Dos . ORM . Platform . Extras { " +
            "internal sealed class WrappedProvider { } }";

        var declarations = DeclaredOwnedTypeIdentities(source);

        Assert.Contains(((string?)null, "GlobalOwned"), declarations);
        Assert.Contains(("Dos.ORM.Execution", "AddedExecutor"), declarations);
        Assert.Contains(("Dos.ORM.Execution", "AddedCallback"), declarations);
        Assert.Contains(("\U00010400", "SupplementaryOwned"), declarations);
        Assert.Contains(("Dos.ORM.Platform.Extras", "WrappedProvider"),
            declarations);

        var baseline = NormalizeTask7TypeAttributes(
            typeof(TypeAttributeBaselineFixture).Attributes);
        Assert.NotEqual(baseline, NormalizeTask7TypeAttributes(
            typeof(TypeAttributeSerializableFixture).Attributes));
        Assert.NotEqual(baseline, NormalizeTask7TypeAttributes(
            typeof(TypeAttributeSequentialFixture).Attributes));
        Assert.NotEqual(baseline, NormalizeTask7TypeAttributes(
            typeof(TypeAttributeSpecialNameFixture).Attributes));
        Assert.Equal(baseline, NormalizeTask7TypeAttributes(
            typeof(TypeAttributeExplicitStaticConstructorFixture).Attributes));
        Assert.NotEqual(baseline, NormalizeTask7TypeAttributes(
            baseline | TypeAttributes.CustomFormatClass));
        Assert.NotEqual(baseline, NormalizeTask7TypeAttributes(
            baseline | unchecked((TypeAttributes)0x80000000)));
    }

    [Fact]
    public void Task7_public_and_protected_declared_method_surface_is_exact()
    {
        AssertDeclaredVisibleMethods(typeof(DialectProfile),
            "Equals(DialectProfile)", "Equals(Object)", "GetHashCode()",
            "ToString()");
        AssertDeclaredVisibleMethods(typeof(NativeSqlText),
            "LegacyAiGenerated(String,DialectProfile,NativeSqlCommandKind)",
            "LegacyUnknown(String,DialectProfile)", "ToString()",
            "UserProvided(String,DialectProfile,NativeSqlCommandKind)");
        AssertDeclaredVisibleMethods(typeof(SqlCompilationOptions));
        AssertDeclaredVisibleMethods(typeof(DatabasePlanStep));
        AssertDeclaredVisibleMethods(typeof(SqlCommandStep), "ToString()");
        AssertDeclaredVisibleMethods(typeof(BulkCommandBatch));
        AssertDeclaredVisibleMethods(typeof(BulkStep), "ToString()");
        AssertDeclaredVisibleMethods(typeof(AdminStep), "ToString()");
        AssertDeclaredVisibleMethods(typeof(NativeScriptStep), "ToString()");
        AssertDeclaredVisibleMethods(typeof(CompiledPlanFingerprint),
            "Equals(CompiledPlanFingerprint)", "Equals(Object)",
            "GetHashCode()", "ToString()");
        AssertDeclaredVisibleMethods(typeof(CompiledImpactEntry));
        AssertDeclaredVisibleMethods(typeof(PlanSafetyBinding));
        AssertDeclaredVisibleMethods(typeof(NoTask6ImpactBinding));
        AssertDeclaredVisibleMethods(typeof(MigrationPlanSafetyBinding));
        AssertDeclaredVisibleMethods(typeof(DatabaseAdminSafetyBinding));
        AssertDeclaredVisibleMethods(typeof(CompiledImpactApproval));
        AssertDeclaredVisibleMethods(typeof(DatabaseExecutionPlan),
            "CreateEffectiveImpactApproval(ApprovalReference)", "ToString()",
            "WithEffectiveImpactApproval(CompiledImpactApproval)");

        foreach (var type in Task7ModelTypes())
        {
            Assert.DoesNotContain(type.GetMethods(
                    BindingFlags.Public | BindingFlags.NonPublic |
                    BindingFlags.Instance | BindingFlags.Static |
                    BindingFlags.DeclaredOnly),
                method => IsVisible(method) &&
                          (method.Name.Contains("Execute", StringComparison.Ordinal) ||
                           method.Name.Contains("Materialize", StringComparison.Ordinal) ||
                           method.Name.Contains("CreateCommand", StringComparison.Ordinal) ||
                           method.Name.Contains("BindValue", StringComparison.Ordinal)));
        }
    }

    [Fact]
    public void Task7_models_store_no_runtime_object_value_provider_or_execution_state()
    {
        var forbiddenExact = new HashSet<Type>
        {
            typeof(object), typeof(ParameterBag), typeof(BoundParameter),
            typeof(DbConnection), typeof(DbCommand), typeof(DbTransaction),
            typeof(IDbConnection), typeof(IDbCommand), typeof(IDbTransaction),
            typeof(Stream), typeof(Delegate), typeof(Uri), typeof(FileInfo),
            typeof(DirectoryInfo)
        };

        foreach (var type in Task7ModelTypes())
        {
            foreach (var field in type.GetFields(
                         BindingFlags.Public | BindingFlags.NonPublic |
                         BindingFlags.Instance | BindingFlags.Static |
                         BindingFlags.DeclaredOnly))
            {
                var payload = UnwrapEnumerable(field.FieldType);
                Assert.DoesNotContain(payload, forbiddenExact);
                Assert.False(typeof(DbConnection).IsAssignableFrom(payload),
                    $"{type.FullName}.{field.Name}");
                Assert.False(typeof(DbCommand).IsAssignableFrom(payload),
                    $"{type.FullName}.{field.Name}");
                Assert.False(typeof(DbTransaction).IsAssignableFrom(payload),
                    $"{type.FullName}.{field.Name}");
                Assert.False(typeof(Delegate).IsAssignableFrom(payload),
                    $"{type.FullName}.{field.Name}");
                Assert.False(typeof(Stream).IsAssignableFrom(payload),
                    $"{type.FullName}.{field.Name}");
            }

            foreach (var memberType in VisibleSignatureTypes(type))
            {
                var payload = UnwrapEnumerable(memberType);
                Assert.DoesNotContain(payload, forbiddenExact);
                Assert.False(typeof(DbConnection).IsAssignableFrom(payload));
                Assert.False(typeof(DbCommand).IsAssignableFrom(payload));
                Assert.False(typeof(DbTransaction).IsAssignableFrom(payload));
                Assert.False(typeof(Delegate).IsAssignableFrom(payload));
                Assert.False(typeof(Stream).IsAssignableFrom(payload));
            }
        }
    }

    [Fact]
    public void Every_public_and_internal_task7_type_graph_and_method_body_is_architecture_safe()
    {
        const BindingFlags allDeclared = BindingFlags.Public |
                                         BindingFlags.NonPublic |
                                         BindingFlags.Instance |
                                         BindingFlags.Static |
                                         BindingFlags.DeclaredOnly;
        var ownedTypes = Task7OwnedTypes();
        var ownedSet = new HashSet<Type>(ownedTypes);
        var structuralVisited = new HashSet<Type>();
        foreach (var type in ownedTypes)
        {
            AssertArchitectureTypeGraphSafe(
                type, type.FullName ?? type.Name,
                allowTransientWireBytes: false,
                ownedSet, structuralVisited);
            foreach (var constructor in type.GetConstructors(allDeclared))
            {
                AssertMethodBodyArchitectureSafe(constructor, ownedSet);
            }
            foreach (var method in type.GetMethods(allDeclared))
            {
                AssertMethodBodyArchitectureSafe(method, ownedSet);
            }
        }
    }

    [Fact]
    public void Architecture_type_graph_scanner_is_cycle_safe_and_rejects_private_nested_wrappers()
    {
        var cycleTypes = new HashSet<Type>
        {
            typeof(ArchitectureCycleA), typeof(ArchitectureCycleB)
        };
        AssertArchitectureTypeGraphSafe(
            typeof(ArchitectureCycleA), "cycle",
            allowTransientWireBytes: false,
            cycleTypes, new HashSet<Type>());

        var forbiddenPayloads = new[]
        {
            typeof(ArchitectureProviderFactoryPayload),
            typeof(ArchitectureServiceProviderPayload),
            typeof(ArchitectureDbParameterPayload),
            typeof(ArchitectureByteArrayPayload),
            typeof(ArchitectureObjectPayload)
        };
        foreach (var payload in forbiddenPayloads)
        {
            var envelope = typeof(ArchitectureEnvelope<>).MakeGenericType(payload);
            var owned = new HashSet<Type>
            {
                envelope, payload
            };
            Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
                AssertArchitectureTypeGraphSafe(
                    envelope, payload.Name,
                    allowTransientWireBytes: false,
                    owned, new HashSet<Type>()));
        }

        Assert.True(IsProviderNamespace("System.Data.Common"));
        Assert.True(IsProviderNamespace("Dos.ORM.DaMeng.Client"));
        Assert.True(IsProviderNamespace("Dm"));
        Assert.True(IsProviderNamespace("Dm.Client"));
        Assert.True(IsProviderNamespace("Kdbndp"));
        Assert.True(IsProviderNamespace("Kdbndp.Client"));
        Assert.False(IsProviderNamespace("System.Data.Commonality"));
        Assert.False(IsProviderNamespace("OracleCompatibility"));
        Assert.False(IsProviderNamespace("NpgsqlHelpers"));
        Assert.False(IsProviderNamespace("DmHelpers"));
        Assert.False(IsProviderNamespace("KdbndpHelpers"));

        foreach (var runtimeType in new[]
                 {
                     typeof(DbProvider), typeof(Database), typeof(DbSession),
                     typeof(DbTrans), typeof(DbBatch), typeof(ProviderFactory),
                     typeof(Section), typeof(SqlSection),
                     typeof(IDataParameter), typeof(IDbDataParameter),
                     typeof(IDictionary), typeof(IList), typeof(ArrayList),
                     typeof(Hashtable), typeof(System.Collections.Queue),
                     typeof(System.Collections.Stack), typeof(List<object>),
                     typeof(Dictionary<string, object>)
                 })
        {
            Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
                AssertArchitectureTypeGraphSafe(
                    runtimeType, runtimeType.FullName!,
                    allowTransientWireBytes: false,
                    new HashSet<Type>(), new HashSet<Type>()));
        }

        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertArchitectureTypeGraphSafe(
                typeof(byte[][]), "nested byte array",
                allowTransientWireBytes: true,
                new HashSet<Type>(), new HashSet<Type>()));
        foreach (var multidimensionalBytes in new[]
                 {
                     typeof(byte[,]), typeof(byte[,,])
                 })
        {
            Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
                AssertArchitectureTypeGraphSafe(
                    multidimensionalBytes, "multidimensional byte array",
                    allowTransientWireBytes: true,
                    new HashSet<Type>(), new HashSet<Type>()));
        }
        AssertArchitectureTypeGraphSafe(
            typeof(byte[]), "exact transient byte array",
            allowTransientWireBytes: true,
            new HashSet<Type>(), new HashSet<Type>());

        AssertArchitectureTypeGraphSafe(
            typeof(ArchitectureExternalSafePayload), "external safe payload",
            allowTransientWireBytes: false,
            new HashSet<Type>(), new HashSet<Type>());

        const BindingFlags declaredMethods = BindingFlags.Public |
                                             BindingFlags.NonPublic |
                                             BindingFlags.Instance |
                                             BindingFlags.Static |
                                             BindingFlags.DeclaredOnly;
        var stableWire = Assert.Single(Task7OwnedTypes(), type =>
            type.FullName == "Dos.ORM.Platform.StableWireBuffer");
        Assert.Equal(
            ["ComputeSha256Text", "WriteGuidRfc4122", "WriteUtf8"],
            stableWire.GetMethods(declaredMethods)
                .Where(AllowsStableWireTransientBytes)
                .Select(method => method.Name)
                .OrderBy(name => name, StringComparer.Ordinal));

        var byteMutation = typeof(ArchitectureByteArrayMutationFixture)
            .GetMethod(nameof(ArchitectureByteArrayMutationFixture.CreateBytes),
                BindingFlags.Public | BindingFlags.Static)!;
        Assert.False(AllowsStableWireTransientBytes(byteMutation));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodBodyArchitectureSafe(
                byteMutation,
                new HashSet<Type>
                {
                    typeof(ArchitectureByteArrayMutationFixture)
                }));
    }

    [Fact]
    public void String_bearing_public_model_surface_is_closed_and_exact()
    {
        var actual = Task7ModelTypes()
            .SelectMany(type => type.GetProperties(
                BindingFlags.Public | BindingFlags.Instance |
                BindingFlags.Static | BindingFlags.DeclaredOnly))
            .Where(property => property.PropertyType == typeof(string))
            .Select(property => $"{property.DeclaringType!.Name}.{property.Name}")
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(new[]
        {
            "CompiledPlanFingerprint.Value",
            "DialectProfile.CompatibilityMode",
            "DialectProfile.Fingerprint",
            "NativeSqlText.Digest",
            "NativeSqlText.Text",
            "SqlCommandStep.CommandText"
        }, actual);

        Assert.DoesNotContain(Task7ModelTypes()
                .SelectMany(type => type.GetProperties(
                    BindingFlags.Public | BindingFlags.Instance |
                    BindingFlags.DeclaredOnly)),
            property => Regex.IsMatch(property.Name,
                "Password|Credential|ConnectionString|Path|FileByte|Payload|Runtime|Ticket|Scope",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant));
    }

    [Fact]
    public void Task7_production_sources_have_no_provider_runtime_logging_or_text_emission_dependency()
    {
        var sources = Task7ProductionSourcePaths();
        Assert.All(sources, path => Assert.True(File.Exists(path), path));

        var forbidden = new[]
        {
            "System.Data.Common", "DbConnection", "DbCommand", "DbTransaction",
            "IDbConnection", "IDbCommand", "IDbTransaction", "ParameterBag",
            "BoundParameter", "Microsoft.Extensions.Logging", "ILogger",
            "Console.", "System.Diagnostics.Trace", "System.Diagnostics.Debug",
            "MemoryStream", "FileStream", "NetworkCredential",
            "ConnectionString", "Password", "WriteLine("
        };
        foreach (var path in sources)
        {
            var source = StripCSharpCommentsAndLiterals(
                File.ReadAllText(path, Encoding.UTF8));
            Assert.All(forbidden, item => Assert.DoesNotContain(
                item, source, StringComparison.Ordinal));
            Assert.DoesNotMatch(
                new Regex(@"\bLog(?:Trace|Debug|Information|Warning|Error|Critical)?\s*\(",
                    RegexOptions.CultureInvariant), source);
        }
    }

    [Fact]
    public void Every_task7_owned_type_makes_no_il_calls_to_provider_logging_or_console_apis()
    {
        foreach (var type in Task7OwnedTypes())
        {
            foreach (var method in type.GetMethods(
                         BindingFlags.Public | BindingFlags.NonPublic |
                         BindingFlags.Instance | BindingFlags.Static |
                         BindingFlags.DeclaredOnly)
                     .Cast<MethodBase>()
                     .Concat(type.GetConstructors(
                         BindingFlags.Public | BindingFlags.NonPublic |
                         BindingFlags.Instance | BindingFlags.Static)))
            {
                AssertMethodHasNoLoggingOrProviderCalls(method);
            }
        }
    }

    [Fact]
    public void Il_logging_scanner_rejects_alias_calls_and_interpolation_sanitizer_preserves_expressions()
    {
        var consoleMethod = typeof(LoggingAliasFixture).GetMethod(
            nameof(LoggingAliasFixture.ConsoleExpression),
            BindingFlags.Public | BindingFlags.Static)!;
        var writerMethod = typeof(LoggingAliasFixture).GetMethod(
            nameof(LoggingAliasFixture.TextWriterExpression),
            BindingFlags.Public | BindingFlags.Static)!;
        var fieldMethod = typeof(LoggingAliasFixture).GetMethod(
            nameof(LoggingAliasFixture.ReadTextWriterField),
            BindingFlags.Public | BindingFlags.Static)!;
        var typeMethod = typeof(LoggingAliasFixture).GetMethod(
            nameof(LoggingAliasFixture.CastTextWriterType),
            BindingFlags.Public | BindingFlags.Static)!;
        var tokenMethod = typeof(LoggingAliasFixture).GetMethod(
            nameof(LoggingAliasFixture.TextWriterTypeToken),
            BindingFlags.Public | BindingFlags.Static)!;

        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodHasNoLoggingOrProviderCalls(consoleMethod));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodHasNoLoggingOrProviderCalls(writerMethod));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodHasNoLoggingOrProviderCalls(fieldMethod));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodHasNoLoggingOrProviderCalls(typeMethod));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            AssertMethodHasNoLoggingOrProviderCalls(tokenMethod));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            ResolveIlTokenMember(
                consoleMethod, OperandType.InlineMethod, int.MaxValue));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() =>
            ResolveIlTokenMember(
                consoleMethod, OperandType.InlineSig, token: 0));

        const string source = """
            var value = $"literal {LoggingAliasFixture.ConsoleExpression()} tail";
            """;
        var stripped = StripCSharpCommentsAndLiterals(source);
        Assert.Contains("LoggingAliasFixture.ConsoleExpression()", stripped,
            StringComparison.Ordinal);
        Assert.DoesNotContain("literal", stripped, StringComparison.Ordinal);
        Assert.DoesNotContain("tail", stripped, StringComparison.Ordinal);
    }

    [Fact]
    public void DosOrm_target_remains_netstandard21_and_task7_has_no_friend_assembly_escape()
    {
        var project = ProductionSourcePath("Dos.ORM", "Dos.ORM.csproj");
        var text = File.ReadAllText(project, Encoding.UTF8);

        Assert.Contains("<TargetFramework>netstandard2.1</TargetFramework>",
            text, StringComparison.Ordinal);
        Assert.Equal(new[] { "Dos.ORM.Tests" },
            typeof(DatabaseExecutionPlan).Assembly
                .GetCustomAttributes<InternalsVisibleToAttribute>()
                .Select(x => x.AssemblyName)
                .OrderBy(x => x, StringComparer.Ordinal));
    }

    [Fact]
    public void Validation_exceptions_and_every_model_to_string_redact_sample_secrets()
    {
        const string commandSecret = "SELECT 'sample-runtime-secret'";
        const string nativeSecret = "SELECT 'sample-native-secret'";
        var command = Command(commandSecret, [], SqlResultShape.Scalar,
            PlanResultRole.Final);
        var native = NativeSqlText.UserProvided(
            nativeSecret, PgProfile(), NativeSqlCommandKind.Read);
        var nativeStep = NativeStep(native, [], SqlResultShape.Scalar);
        var nativePlan = NativePlan(nativeStep);
        var values = new ParameterBag().Add("p", "sample-value-secret");
        _ = values;
        var strings = new[]
        {
            command.ToString(), native.ToString(), nativeStep.ToString(),
            nativePlan.ToString(), nativePlan.Fingerprint.ToString(),
            NoImpact().ToString()!, PgProfile().ToString()
        };

        Assert.All(strings, text =>
        {
            Assert.DoesNotContain(commandSecret, text, StringComparison.Ordinal);
            Assert.DoesNotContain("sample-runtime-secret", text,
                StringComparison.Ordinal);
            Assert.DoesNotContain(nativeSecret, text, StringComparison.Ordinal);
            Assert.DoesNotContain("sample-native-secret", text,
                StringComparison.Ordinal);
            Assert.DoesNotContain("sample-value-secret", text,
                StringComparison.Ordinal);
        });

        var nulCommand = Assert.Throws<ArgumentException>(() =>
            Command("SELECT\0sample-runtime-secret", []));
        var nulNative = Assert.Throws<ArgumentException>(() =>
            NativeSqlText.UserProvided(
                "SELECT\0sample-native-secret", PgProfile(),
                NativeSqlCommandKind.Read));
        Assert.DoesNotContain("secret", nulCommand.Message,
            StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret", nulNative.Message,
            StringComparison.OrdinalIgnoreCase);
    }

    // Reflection invocation and specimen helpers

    private static DialectProfile PgProfile() => new(
        DatabaseType.PostgreSql, new Version(17, 2), string.Empty);

    private static DialectProfile DmProfile() => new(
        DatabaseType.DaMeng, new Version(8, 1, 3, 42), "Oracle兼容");

    private static SqlCompilationOptions Options(
        DialectProfile? profile = null,
        AtomicityRequirement atomicity = AtomicityRequirement.None,
        SchemaToken? schema = null) =>
        new(profile ?? PgProfile(), atomicity, schema);

    private static SqlIdentifier Id(string value) => new(value);

    private static SqlObjectName ObjectName(string value) => new(Id(value));

    private static MigrationStepId StepId(string value) => new(value);

    private static ParameterDefinition Parameter(
        string name,
        LogicalDbType logicalType,
        int? size = null,
        int? precision = null,
        int? scale = null,
        ParameterDirection direction = ParameterDirection.Input,
        bool nullable = true) =>
        new(name, new SqlTypeDescriptor(logicalType, size, precision, scale),
            direction, nullable);

    private static ParameterDefinition Parameter(
        string name,
        LogicalDbType logicalType,
        ParameterDirection direction,
        bool nullable) =>
        Parameter(
            name, logicalType,
            size: null, precision: null, scale: null,
            direction: direction, nullable: nullable);

    private static ParameterExpression ParameterExpression(
        string name,
        LogicalDbType logicalType = LogicalDbType.String) =>
        new(Parameter(name, logicalType));

    private static SqlCommandStep Command(
        string commandText,
        IEnumerable<ParameterDefinition> parameters,
        SqlResultShape shape = SqlResultShape.None,
        PlanResultRole role = PlanResultRole.None,
        PlanConnectionRole route = PlanConnectionRole.CurrentDatabase,
        PlanTransactionBehavior transaction = PlanTransactionBehavior.Enlistable,
        MigrationStepId? sourceMigrationStepId = null) =>
        InvokeNonPublicConstructor<SqlCommandStep>(
            commandText, parameters, shape, role, route, transaction,
            sourceMigrationStepId);

    private static BulkCommandBatch BulkBatch(
        SqlCommandStep command,
        int rowCount) =>
        InvokeNonPublicConstructor<BulkCommandBatch>(command, rowCount);

    private static BulkStep NativeBulk(
        BulkInsertOperation operation,
        int effectiveBatchSize,
        PlanConnectionRole route,
        PlanTransactionBehavior transaction) =>
        InvokeNonPublicStatic<BulkStep>(typeof(BulkStep), "Native",
            operation, effectiveBatchSize, route, transaction);

    private static BulkStep BatchedBulk(
        BulkInsertOperation operation,
        int effectiveBatchSize,
        IEnumerable<BulkCommandBatch> batches,
        PlanConnectionRole route,
        PlanTransactionBehavior transaction) =>
        InvokeNonPublicStatic<BulkStep>(typeof(BulkStep), "Batched",
            operation, effectiveBatchSize, batches, route, transaction);

    private static AdminStep Admin(
        DatabaseAdminOperation operation,
        PlanConnectionRole route,
        PlanTransactionBehavior transaction) =>
        InvokeNonPublicConstructor<AdminStep>(operation, route, transaction);

    private static NativeScriptStep NativeStep(
        NativeSqlText text,
        IEnumerable<ParameterDefinition> parameters,
        SqlResultShape shape) =>
        InvokeNonPublicConstructor<NativeScriptStep>(text, parameters, shape);

    private static CompiledPlanFingerprint Fingerprint(string value) =>
        InvokeNonPublicConstructor<CompiledPlanFingerprint>(value);

    private static CompiledImpactEntry Impact(
        MigrationStepId stepId,
        DestructiveImpact neutral,
        DestructiveImpact effective) =>
        InvokeNonPublicConstructor<CompiledImpactEntry>(
            stepId, neutral, effective);

    private static NoTask6ImpactBinding NoImpact()
    {
        var property = typeof(NoTask6ImpactBinding).GetProperty(
            "Instance", BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(property);
        Assert.True(property.GetMethod!.IsAssembly);
        return Assert.IsType<NoTask6ImpactBinding>(property.GetValue(null));
    }

    private static MigrationPlanSafetyBinding MigrationSafety(
        MigrationPlan source,
        IEnumerable<CompiledImpactEntry> entries) =>
        InvokeNonPublicConstructor<MigrationPlanSafetyBinding>(source, entries);

    private static DatabaseAdminSafetyBinding AdminDropSafety(
        DropDatabaseOperation source,
        DestructiveImpact effective) =>
        InvokeNonPublicStatic<DatabaseAdminSafetyBinding>(
            typeof(DatabaseAdminSafetyBinding), "ForDropDatabase",
            source, effective);

    private static DatabaseAdminSafetyBinding AdminImportSafety(
        DatabaseImportOperation source,
        DestructiveImpact effective) =>
        InvokeNonPublicStatic<DatabaseAdminSafetyBinding>(
            typeof(DatabaseAdminSafetyBinding), "ForImport",
            source, effective);

    private static DatabaseExecutionPlan StatementPlan(
        SqlStatement source,
        IEnumerable<SqlCommandStep> steps,
        SqlCompilationOptions options) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForStatement", source, steps, options);

    private static DatabaseExecutionPlan SchemaPlan(
        SchemaOperation source,
        DestructiveImpact effective,
        IEnumerable<SqlCommandStep> steps,
        SqlCompilationOptions options) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForSchemaOperation",
            source, effective, steps, options);

    private static DatabaseExecutionPlan MigrationCompiled(
        MigrationPlan source,
        IEnumerable<CompiledImpactEntry> impacts,
        IEnumerable<SqlCommandStep> steps,
        SqlCompilationOptions options) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForMigration",
            source, impacts, steps, options);

    private static DatabaseExecutionPlan BulkPlan(
        BulkInsertOperation source,
        BulkStep step,
        SqlCompilationOptions options) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForBulk", source, step, options);

    private static DatabaseExecutionPlan AdminPlan(
        DatabaseAdminOperation source,
        DestructiveImpact effective,
        AdminStep step,
        SqlCompilationOptions options) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForAdmin",
            source, effective, step, options);

    private static DatabaseExecutionPlan NativePlan(NativeScriptStep step) =>
        InvokeNonPublicStatic<DatabaseExecutionPlan>(
            typeof(DatabaseExecutionPlan), "ForNative", step);

    private static CompiledImpactApproval? GetAttachedApproval(
        DatabaseExecutionPlan plan)
    {
        var fields = typeof(DatabaseExecutionPlan).GetFields(
                BindingFlags.Instance | BindingFlags.NonPublic)
            .Where(field => field.FieldType == typeof(CompiledImpactApproval))
            .ToArray();
        Assert.Single(fields);
        return (CompiledImpactApproval?)fields[0].GetValue(plan);
    }

    private static SelectStatement SelectSource() => new(
        [new SelectProjection(BooleanExpression.True)]);

    private static SelectStatement PagedSelectSource() => new(
        new NamedTableSource(ObjectName("items"), new SqlAlias("i")),
        [new SelectProjection(new ColumnExpression(Id("id"), new SqlAlias("i")))],
        orderBy:
        [
            new OrderByExpression(
                new ColumnExpression(Id("id"), new SqlAlias("i")))
        ],
        page: new OffsetPageSpec(0, 10));

    private static BulkInsertOperation BulkOperation(
        int batchSize,
        params SqlExpression[] values) =>
        new(ObjectName("bulk_items"), [Id("value")],
            values.Select(value => new SqlInsertRow([value])), batchSize);

    private static SelectStatement DeepQueryWithParameter(
        ParameterExpression parameter)
    {
        var alias = new SqlAlias("d");
        var inner = new SelectStatement(
            [new SelectProjection(
                new FunctionExpression(SemanticFunctions.Coalesce,
                    [NullExpression.Instance, parameter]), IdAlias("nested"))]);
        var cte = new CommonTableExpression(
            Id("recursive_values"), inner, [Id("nested")], recursive: true);
        var derived = new DerivedTableSource(inner, alias);
        var joined = new JoinSource(
            derived, SqlJoinType.Inner,
            new NamedTableSource(ObjectName("other"), new SqlAlias("o")),
            new BinaryExpression(
                new ColumnExpression(Id("nested"), alias),
                SqlBinaryOperator.Equal, parameter));
        return new SelectStatement(
            joined,
            [new SelectProjection(new ColumnExpression(Id("nested"), alias))],
            whereExpression: new ExistsExpression(new SubqueryExpression(inner)),
            groupBy: [new ColumnExpression(Id("nested"), alias)],
            havingExpression: new UnaryExpression(
                SqlUnaryOperator.IsNotNull, parameter),
            orderBy:
            [
                new OrderByExpression(parameter, SqlSortDirection.Descending,
                    SqlNullSortOrder.Last)
            ],
            page: new KeysetPageSpec([parameter], 5),
            lockSpec: new LockSpec(SqlLockMode.Share, SqlLockWait.SkipLocked),
            commonTableExpressions: [cte],
            setOperations:
            [
                new SetOperationClause(SqlSetOperator.UnionAll, inner)
            ]);
    }

    private static SqlAlias IdAlias(string value) => new(value);

    private static BulkInsertOperation ComplexBulkOperation()
    {
        var parameter = ParameterExpression("雪", LogicalDbType.String);
        var query = DeepQueryWithParameter(parameter);
        var expression = new CaseExpression(
        [
            new CaseWhenClause(
                new BetweenExpression(
                    new CastExpression(parameter,
                        new SqlTypeDescriptor(LogicalDbType.String, length: 32)),
                    NullExpression.Instance,
                    new FunctionExpression(SemanticFunctions.Concat,
                        [parameter, new WildcardExpression()])),
                new SubqueryExpression(query))
        ],
        new AggregateExpression(SemanticFunctions.Count, null, distinct: false));
        return new BulkInsertOperation(
            new SqlObjectName(Id("目录"), Id("模式"), Id("批量")),
            [Id("值")], [new SqlInsertRow([expression])], 1);
    }

    private static CreateSchemaOperation SafeSchema(string name) =>
        new(new SchemaName(Id(name)), CreateObjectBehavior.FailIfExists);

    private static RenameTableOperation RiskSchema(
        string source,
        string target) =>
        new(ObjectName(source), ObjectName(target));

    private static DropSchemaOperation LossSchema(string name) =>
        new(new SchemaName(Id(name)), DropObjectBehavior.FailIfMissing,
            DropScope.Restrict);

    private static MigrationPlan Migration(
        params (string Id, SchemaOperation Operation)[] steps) =>
        new(new MigrationPlanId("migration-plan"),
            steps.Select(item => new MigrationStep(
                StepId(item.Id), item.Operation,
                MigrationIdempotencyMode.RequireChange)));

    private static CreateDatabaseOperation CreateAdmin(
        string database = "created_database") =>
        new(Id(database), CreateObjectBehavior.FailIfExists);

    private static DropDatabaseOperation DropAdmin(
        string database = "dropped_database") =>
        new(Id(database), DropObjectBehavior.FailIfMissing);

    private static DatabaseResourceHandle Resource(string guid, char digest) =>
        new(Guid.Parse(guid), new ResourceContentDigest(new string(digest, 64)));

    private static DatabaseExportOperation ExportAdmin(
        string guid,
        char digest,
        DatabaseTransferFormat format = DatabaseTransferFormat.PortableJson,
        DatabaseTransferScope scope = DatabaseTransferScope.SchemaAndData,
        string database = "export_database") =>
        new(Id(database), Resource(guid, digest), format, scope);

    private static DatabaseImportOperation ImportAdmin(
        string guid,
        char digest,
        DatabaseImportConflictPolicy policy,
        DatabaseTransferFormat format = DatabaseTransferFormat.PortableJson,
        DatabaseTransferScope scope = DatabaseTransferScope.SchemaAndData,
        string database = "import_database") =>
        new(Id(database), Resource(guid, digest), format, scope, policy);

    private static ElevatedMigrationSpecimen ElevatedMigration(
        string stepId = "elevated-step",
        string schemaName = "elevated_schema",
        string commandText = "CREATE SCHEMA elevated_schema",
        SqlResultShape resultShape = SqlResultShape.None,
        PlanResultRole resultRole = PlanResultRole.None,
        ParameterDefinition? parameter = null,
        DestructiveImpact effectiveImpact = DestructiveImpact.CompatibilityRisk,
        PlanTransactionBehavior transaction = PlanTransactionBehavior.Enlistable)
    {
        var source = Migration((stepId, SafeSchema(schemaName)));
        var profile = new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 2, 3, 4), "Mode");
        var schema = new SchemaToken("schema-elevated");
        var impact = Impact(source.Steps[0].Id,
            DestructiveImpact.None, effectiveImpact);
        var parameters = parameter == null
            ? Array.Empty<ParameterDefinition>()
            : new[] { parameter };
        var command = Command(
            commandText, parameters, resultShape, resultRole,
            PlanConnectionRole.CurrentDatabase, transaction,
            source.Steps[0].Id);
        var plan = MigrationCompiled(source, [impact], [command],
            new SqlCompilationOptions(profile, AtomicityRequirement.None, schema));
        return new ElevatedMigrationSpecimen(
            source, profile, schema, impact, command, plan);
    }

    private static DatabaseExecutionPlan RecompileElevatedMigration(
        ElevatedMigrationSpecimen specimen,
        DialectProfile? profile = null,
        SchemaToken? schema = null,
        AtomicityRequirement? atomicity = null,
        string? commandText = null,
        ParameterDefinition? parameter = null,
        SqlResultShape? resultShape = null,
        PlanResultRole? resultRole = null,
        PlanTransactionBehavior? transaction = null,
        DestructiveImpact? effectiveImpact = null)
    {
        var originalParameter = specimen.Command.Parameters.SingleOrDefault();
        var definition = parameter ?? originalParameter;
        var definitions = definition == null
            ? Array.Empty<ParameterDefinition>()
            : new[] { definition };
        var impact = Impact(
            specimen.Source.Steps[0].Id,
            DestructiveImpact.None,
            effectiveImpact ?? specimen.Impact.EffectiveImpact);
        var command = Command(
            commandText ?? specimen.Command.CommandText,
            definitions,
            resultShape ?? specimen.Command.ResultShape,
            resultRole ?? specimen.Command.ResultRole,
            PlanConnectionRole.CurrentDatabase,
            transaction ?? specimen.Command.TransactionBehavior,
            specimen.Source.Steps[0].Id);
        return MigrationCompiled(
            specimen.Source, [impact], [command],
            new SqlCompilationOptions(
                profile ?? specimen.Profile,
                atomicity ?? specimen.Plan.Atomicity,
                schema ?? specimen.Schema));
    }

    private sealed class ElevatedMigrationSpecimen
    {
        public ElevatedMigrationSpecimen(
            MigrationPlan source,
            DialectProfile profile,
            SchemaToken schema,
            CompiledImpactEntry impact,
            SqlCommandStep command,
            DatabaseExecutionPlan plan)
        {
            Source = source;
            Profile = profile;
            Schema = schema;
            Impact = impact;
            Command = command;
            Plan = plan;
        }

        public MigrationPlan Source { get; }
        public DialectProfile Profile { get; }
        public SchemaToken Schema { get; }
        public CompiledImpactEntry Impact { get; }
        public SqlCommandStep Command { get; }
        public DatabaseExecutionPlan Plan { get; }
    }

    private static T InvokeNonPublicConstructor<T>(params object?[] arguments)
    {
        var constructor = FindMatchingConstructor(typeof(T), arguments);
        try
        {
            return (T)constructor.Invoke(arguments);
        }
        catch (TargetInvocationException exception)
            when (exception.InnerException != null)
        {
            ExceptionDispatchInfo.Capture(exception.InnerException).Throw();
            throw;
        }
    }

    private static T InvokeNonPublicStatic<T>(
        Type declaringType,
        string name,
        params object?[] arguments)
    {
        var methods = declaringType.GetMethods(
                BindingFlags.Static | BindingFlags.NonPublic)
            .Where(method => method.Name == name &&
                             ParametersMatch(method.GetParameters(), arguments))
            .ToArray();
        var method = Assert.Single(methods);
        try
        {
            return (T)method.Invoke(null, arguments)!;
        }
        catch (TargetInvocationException exception)
            when (exception.InnerException != null)
        {
            ExceptionDispatchInfo.Capture(exception.InnerException).Throw();
            throw;
        }
    }

    private static ConstructorInfo FindMatchingConstructor(
        Type type,
        object?[] arguments)
    {
        var constructors = type.GetConstructors(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic)
            .Where(constructor => ParametersMatch(
                constructor.GetParameters(), arguments))
            .ToArray();
        return Assert.Single(constructors);
    }

    private static bool ParametersMatch(
        ParameterInfo[] parameters,
        object?[] arguments)
    {
        if (parameters.Length != arguments.Length)
        {
            return false;
        }

        for (var index = 0; index < parameters.Length; index++)
        {
            var argument = arguments[index];
            if (argument == null)
            {
                if (parameters[index].ParameterType.IsValueType &&
                    Nullable.GetUnderlyingType(parameters[index].ParameterType) == null)
                {
                    return false;
                }
            }
            else if (!parameters[index].ParameterType.IsInstanceOfType(argument))
            {
                return false;
            }
        }

        return true;
    }

    private static MethodInfo FindNonPublicStaticMethod(
        Type type,
        string name) =>
        Assert.Single(type.GetMethods(
                BindingFlags.Static | BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly),
            method => method.Name == name);

    private static MethodInfo NonPublicFactory(Type type, string name) =>
        FindNonPublicStaticMethod(type, name);

    private static void AssertSealed(params Type[] types) =>
        Assert.All(types, type => Assert.True(type.IsSealed, type.FullName));

    private static void AssertPublicProperties(
        Type type,
        params (string Name, Type Type)[] expected)
    {
        var properties = type.GetProperties(
                BindingFlags.Public | BindingFlags.Instance |
                BindingFlags.Static | BindingFlags.DeclaredOnly)
            .OrderBy(property => property.MetadataToken)
            .ToArray();
        Assert.Equal(expected.Select(item => item.Name),
            properties.Select(property => property.Name));
        for (var index = 0; index < expected.Length; index++)
        {
            Assert.Equal(expected[index].Type, properties[index].PropertyType);
            Assert.NotNull(properties[index].GetMethod);
            Assert.True(properties[index].GetMethod!.IsPublic);
            Assert.Null(properties[index].SetMethod);
            Assert.Empty(properties[index].GetIndexParameters());
        }
    }

    private static void AssertPublicConstructor(
        Type type,
        params Type[] parameterTypes)
    {
        var constructors = type.GetConstructors();
        var constructor = Assert.Single(constructors);
        Assert.Equal(parameterTypes,
            constructor.GetParameters().Select(parameter => parameter.ParameterType));
    }

    private static void AssertConstructorVisibility(
        Type type,
        bool isPrivate,
        params Type[] parameterTypes)
    {
        var constructors = type.GetConstructors(
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        var constructor = Assert.Single(constructors,
            item => item.GetParameters().Select(parameter => parameter.ParameterType)
                .SequenceEqual(parameterTypes));
        Assert.Equal(isPrivate, constructor.IsPrivate);
        Assert.Equal(!isPrivate, constructor.IsAssembly);
        Assert.False(constructor.IsPublic || constructor.IsFamily ||
                     constructor.IsFamilyOrAssembly);
    }

    private static void AssertMethod(
        MethodInfo method,
        Type returnType,
        bool isGeneric,
        params Type[] parameterTypes)
    {
        Assert.Equal(returnType, method.ReturnType);
        Assert.Equal(isGeneric, method.IsGenericMethod);
        Assert.Equal(parameterTypes,
            method.GetParameters().Select(parameter => parameter.ParameterType));
        Assert.All(method.GetParameters(), parameter =>
        {
            Assert.False(parameter.ParameterType.IsByRef);
            Assert.False(parameter.IsOut);
            Assert.False(parameter.IsOptional);
            Assert.False(parameter.HasDefaultValue);
            Assert.Empty(parameter.GetCustomAttributes<ParamArrayAttribute>());
        });
    }

    private static void AssertExactInternalFactory(
        Type type,
        string name,
        Type returnType,
        params Type[] parameterTypes)
    {
        var method = FindNonPublicStaticMethod(type, name);
        Assert.True(method.IsAssembly);
        Assert.False(method.IsPublic || method.IsFamily ||
                     method.IsFamilyOrAssembly);
        AssertMethod(method, returnType, false, parameterTypes);
    }

    private static void AssertFullyReadOnly<T>(
        IReadOnlyList<T> list,
        params T[] expected)
    {
        var generic = Assert.IsAssignableFrom<IList<T>>(list);
        var nonGeneric = Assert.IsAssignableFrom<IList>(list);
        Assert.True(generic.IsReadOnly);
        Assert.True(nonGeneric.IsReadOnly);
        Assert.Throws<NotSupportedException>(() => generic.Clear());
        Assert.Throws<NotSupportedException>(() => nonGeneric.Clear());
        var sample = expected.Length == 0 ? default! : expected[0];
        Assert.Throws<NotSupportedException>(() => generic.Add(sample));
        Assert.Throws<NotSupportedException>(() => nonGeneric.Add(sample));
        if (list.Count != 0)
        {
            Assert.Throws<NotSupportedException>(() => generic[0] = list[0]);
            Assert.Throws<NotSupportedException>(() => nonGeneric[0] = list[0]);
            Assert.Throws<NotSupportedException>(() => generic.RemoveAt(0));
            Assert.Throws<NotSupportedException>(() => nonGeneric.RemoveAt(0));
        }
    }

    private static void AssertFingerprintShape(CompiledPlanFingerprint fingerprint)
    {
        Assert.NotNull(fingerprint);
        Assert.Matches("^sha256:[0-9a-f]{64}$", fingerprint.Value);
    }

    private static void AssertPairwiseDistinctFingerprints(
        params DatabaseExecutionPlan[] plans)
    {
        Assert.Equal(plans.Length,
            plans.Select(plan => plan.Fingerprint.Value)
                .Distinct(StringComparer.Ordinal).ToArray().Length);
    }

    private static string ProductionSourcePath(
        string first,
        params string[] remaining)
    {
        var testDirectory = Path.GetDirectoryName(CurrentFilePath())!;
        var serverDirectory = Directory.GetParent(
            Directory.GetParent(testDirectory)!.FullName)!.FullName;
        return Path.Combine(
            new[] { serverDirectory, first }.Concat(remaining).ToArray());
    }

    private static string StripCSharpCommentsAndLiterals(string source)
    {
        var result = new StringBuilder(source.Length);
        var index = 0;
        while (index < source.Length)
        {
            if (TryStripInterpolatedString(source, ref index, result))
            {
                continue;
            }
            if (index + 1 < source.Length && source[index] == '/' &&
                source[index + 1] == '/')
            {
                result.Append("  ");
                index += 2;
                while (index < source.Length && source[index] != '\r' &&
                       source[index] != '\n')
                {
                    result.Append(' ');
                    index++;
                }
                continue;
            }
            if (index + 1 < source.Length && source[index] == '/' &&
                source[index + 1] == '*')
            {
                result.Append("  ");
                index += 2;
                while (index < source.Length)
                {
                    if (index + 1 < source.Length && source[index] == '*' &&
                        source[index + 1] == '/')
                    {
                        result.Append("  ");
                        index += 2;
                        break;
                    }
                    result.Append(source[index] is '\r' or '\n'
                        ? source[index]
                        : ' ');
                    index++;
                }
                continue;
            }

            var verbatim = index + 1 < source.Length && source[index] == '@' &&
                           source[index + 1] == '"';
            var regular = source[index] == '"';
            var character = source[index] == '\'';
            if (verbatim || regular || character)
            {
                var quote = character ? '\'' : '"';
                if (verbatim)
                {
                    result.Append("  ");
                    index += 2;
                }
                else
                {
                    result.Append(' ');
                    index++;
                }
                while (index < source.Length)
                {
                    var current = source[index];
                    result.Append(current is '\r' or '\n' ? current : ' ');
                    index++;
                    if (verbatim && current == '"' && index < source.Length &&
                        source[index] == '"')
                    {
                        result.Append(' ');
                        index++;
                        continue;
                    }
                    if (!verbatim && current == '\\' && index < source.Length)
                    {
                        result.Append(source[index] is '\r' or '\n'
                            ? source[index]
                            : ' ');
                        index++;
                        continue;
                    }
                    if (current == quote)
                    {
                        break;
                    }
                }
                continue;
            }

            result.Append(source[index]);
            index++;
        }
        return result.ToString();
    }

    private static bool TryStripInterpolatedString(
        string source,
        ref int index,
        StringBuilder result)
    {
        var verbatim = false;
        var prefixLength = 0;
        if (index + 1 < source.Length && source[index] == '$' &&
            source[index + 1] == '"')
        {
            prefixLength = 2;
        }
        else if (index + 2 < source.Length && source[index] == '$' &&
                 source[index + 1] == '@' && source[index + 2] == '"')
        {
            verbatim = true;
            prefixLength = 3;
        }
        else if (index + 2 < source.Length && source[index] == '@' &&
                 source[index + 1] == '$' && source[index + 2] == '"')
        {
            verbatim = true;
            prefixLength = 3;
        }
        if (prefixLength == 0)
        {
            return false;
        }

        result.Append(' ', prefixLength);
        index += prefixLength;
        while (index < source.Length)
        {
            var current = source[index];
            if (current == '"')
            {
                if (verbatim && index + 1 < source.Length &&
                    source[index + 1] == '"')
                {
                    result.Append("  ");
                    index += 2;
                    continue;
                }
                result.Append(' ');
                index++;
                return true;
            }
            if (!verbatim && current == '\\' &&
                index + 1 < source.Length)
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '{' && index + 1 < source.Length &&
                source[index + 1] == '{')
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '}' && index + 1 < source.Length &&
                source[index + 1] == '}')
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '{')
            {
                result.Append('{');
                index++;
                var expressionEnd = FindInterpolationExpressionEnd(
                    source, index);
                result.Append(StripCSharpCommentsAndLiterals(
                    source[index..expressionEnd]));
                index = expressionEnd;
                if (index < source.Length && source[index] == '}')
                {
                    result.Append('}');
                    index++;
                }
                continue;
            }

            result.Append(current is '\r' or '\n' ? current : ' ');
            index++;
        }
        return true;
    }

    private static int FindInterpolationExpressionEnd(
        string source,
        int start)
    {
        var depth = 0;
        var index = start;
        while (index < source.Length)
        {
            if (TrySkipCommentOrLiteralForBraceScan(source, ref index))
            {
                continue;
            }
            if (source[index] == '{')
            {
                depth++;
                index++;
                continue;
            }
            if (source[index] == '}')
            {
                if (depth == 0)
                {
                    return index;
                }
                depth--;
            }
            index++;
        }
        return source.Length;
    }

    private static bool TrySkipCommentOrLiteralForBraceScan(
        string source,
        ref int index)
    {
        if (index + 1 < source.Length && source[index] == '/' &&
            source[index + 1] == '/')
        {
            index += 2;
            while (index < source.Length && source[index] is not '\r' and not '\n')
            {
                index++;
            }
            return true;
        }
        if (index + 1 < source.Length && source[index] == '/' &&
            source[index + 1] == '*')
        {
            index += 2;
            while (index + 1 < source.Length &&
                   (source[index] != '*' || source[index + 1] != '/'))
            {
                index++;
            }
            index = Math.Min(source.Length, index + 2);
            return true;
        }

        var verbatim = index + 1 < source.Length && source[index] == '@' &&
                       source[index + 1] == '"';
        var interpolatedVerbatim = index + 2 < source.Length &&
            ((source[index] == '$' && source[index + 1] == '@') ||
             (source[index] == '@' && source[index + 1] == '$')) &&
            source[index + 2] == '"';
        var interpolated = index + 1 < source.Length && source[index] == '$' &&
                           source[index + 1] == '"';
        var character = source[index] == '\'';
        var regular = source[index] == '"';
        if (!verbatim && !interpolatedVerbatim && !interpolated &&
            !character && !regular)
        {
            return false;
        }

        var isVerbatim = verbatim || interpolatedVerbatim;
        var quote = character ? '\'' : '"';
        index += interpolatedVerbatim ? 3 :
            verbatim || interpolated ? 2 : 1;
        while (index < source.Length)
        {
            var current = source[index++];
            if (isVerbatim && current == '"' && index < source.Length &&
                source[index] == '"')
            {
                index++;
                continue;
            }
            if (!isVerbatim && current == '\\' && index < source.Length)
            {
                index++;
                continue;
            }
            if (current == quote)
            {
                break;
            }
        }
        return true;
    }

    private static string CurrentFilePath(
        [CallerFilePath] string path = "") => path;

    private static IReadOnlyList<Type> Task7ModelTypes() =>
    [
        typeof(DialectProfile), typeof(NativeSqlText),
        typeof(SqlCompilationOptions), typeof(DatabasePlanStep),
        typeof(SqlCommandStep), typeof(BulkCommandBatch), typeof(BulkStep),
        typeof(AdminStep), typeof(NativeScriptStep),
        typeof(CompiledPlanFingerprint), typeof(CompiledImpactEntry),
        typeof(PlanSafetyBinding), typeof(NoTask6ImpactBinding),
        typeof(MigrationPlanSafetyBinding),
        typeof(DatabaseAdminSafetyBinding), typeof(CompiledImpactApproval),
        typeof(DatabaseExecutionPlan)
    ];

    private static Type[] Task7OwnedTypes()
    {
        var assemblyTypes = typeof(DatabaseExecutionPlan).Assembly.GetTypes();
        var owned = new HashSet<Type>();

        foreach (var sourcePath in Task7ProductionSourcePaths())
        {
            var declarations = DeclaredOwnedTypeIdentities(
                File.ReadAllText(sourcePath, Encoding.UTF8));
            foreach (var declaration in declarations)
            {
                foreach (var type in assemblyTypes.Where(type =>
                             string.Equals(type.Namespace,
                                 declaration.Namespace,
                                 StringComparison.Ordinal) &&
                             string.Equals(
                                 RemoveGenericArity(type.Name),
                                 declaration.Name,
                                 StringComparison.Ordinal)))
                {
                    AddTypeAndNestedTypes(owned, type);
                }
            }
        }

        return owned.OrderBy(type => type.FullName, StringComparer.Ordinal)
            .ToArray();
    }

    private static string[] Task7ProductionSourcePaths() =>
    [
        ProductionSourcePath("Dos.ORM", "Platform", "DialectProfile.cs"),
        ProductionSourcePath("Dos.ORM", "SqlAst", "NativeSqlText.cs"),
        ProductionSourcePath("Dos.ORM", "SqlCompilation", "CompilationModels.cs"),
        ProductionSourcePath("Dos.ORM", "SqlCompilation", "ISqlCompiler.cs")
    ];

    private static IReadOnlyList<(string? Namespace, string Name)>
        DeclaredOwnedTypeIdentities(string source)
    {
        var stripped = StripCSharpCommentsAndLiterals(source);
        var tokens = TokenizeCSharpStructure(stripped);
        var declarations = new List<(string? Namespace, string Name)>();
        var namespaceScopes = new Stack<(string Namespace, int Depth)>();
        string? fileNamespace = null;
        var braceDepth = 0;

        for (var index = 0; index < tokens.Count; index++)
        {
            var token = tokens[index];
            if (token == "namespace")
            {
                var parts = new List<string>();
                var cursor = index + 1;
                while (cursor < tokens.Count &&
                       IsCSharpIdentifierToken(tokens[cursor]))
                {
                    parts.Add(tokens[cursor].TrimStart('@'));
                    cursor++;
                    if (cursor >= tokens.Count || tokens[cursor] != ".")
                    {
                        break;
                    }
                    cursor++;
                }
                if (parts.Count != 0 && cursor < tokens.Count &&
                    (tokens[cursor] == "{" || tokens[cursor] == ";"))
                {
                    var parent = namespaceScopes.Count != 0
                        ? namespaceScopes.Peek().Namespace
                        : fileNamespace;
                    var relative = string.Join(".", parts);
                    var fullName = string.IsNullOrEmpty(parent)
                        ? relative
                        : parent + "." + relative;
                    if (tokens[cursor] == ";")
                    {
                        fileNamespace = fullName;
                    }
                    else
                    {
                        braceDepth++;
                        namespaceScopes.Push((fullName, braceDepth));
                    }
                    index = cursor;
                    continue;
                }
            }

            if (token == "{")
            {
                braceDepth++;
                continue;
            }
            if (token == "}")
            {
                if (namespaceScopes.Count != 0 &&
                    namespaceScopes.Peek().Depth == braceDepth)
                {
                    namespaceScopes.Pop();
                }
                braceDepth = Math.Max(0, braceDepth - 1);
                continue;
            }

            var typeName = TryReadDeclaredTypeName(tokens, index);
            if (typeName == null)
            {
                continue;
            }
            var currentNamespace = namespaceScopes.Count != 0
                ? namespaceScopes.Peek().Namespace
                : fileNamespace;
            declarations.Add((currentNamespace, typeName));
        }

        return declarations
            .Distinct()
            .ToArray();
    }

    private static IReadOnlyList<string> TokenizeCSharpStructure(string source)
    {
        var tokens = new List<string>();
        var index = 0;
        while (index < source.Length)
        {
            if (TryReadCSharpIdentifier(
                    source, index, out var identifier, out var nextIndex))
            {
                tokens.Add(identifier);
                index = nextIndex;
                continue;
            }
            var current = source[index];
            if (current is '{' or '}' or ';' or '.' or '<' or '>' or
                '(' or ')' or '[' or ']' or ',' or ':' or '*' or '?')
            {
                tokens.Add(current.ToString());
            }
            index++;
        }
        return tokens;
    }

    private static bool TryReadCSharpIdentifier(
        string source,
        int start,
        out string identifier,
        out int nextIndex)
    {
        var index = start;
        var value = new StringBuilder();
        if (index < source.Length && source[index] == '@')
        {
            value.Append('@');
            index++;
        }

        if (!TryReadCSharpIdentifierCharacter(
                source, index, first: true,
                out var character, out var consumed))
        {
            identifier = string.Empty;
            nextIndex = start;
            return false;
        }
        value.Append(character);
        index += consumed;

        while (TryReadCSharpIdentifierCharacter(
                   source, index, first: false,
                   out character, out consumed))
        {
            value.Append(character);
            index += consumed;
        }

        identifier = value.ToString();
        nextIndex = index;
        return true;
    }

    private static bool TryReadCSharpIdentifierCharacter(
        string source,
        int index,
        bool first,
        out string character,
        out int consumed)
    {
        character = string.Empty;
        consumed = 0;
        if (index >= source.Length)
        {
            return false;
        }

        if (TryDecodeCSharpUnicodeEscape(
                source, index, out var escaped, out var escapeLength))
        {
            if (!IsCSharpIdentifierCharacter(escaped, first))
            {
                return false;
            }
            character = escaped;
            consumed = escapeLength;
            return true;
        }

        if (!Rune.TryGetRuneAt(source, index, out var literalRune))
        {
            return false;
        }
        var literal = literalRune.ToString();
        if (!IsCSharpIdentifierCharacter(literal, first))
        {
            return false;
        }
        character = literal;
        consumed = literalRune.Utf16SequenceLength;
        return true;
    }

    private static bool TryDecodeCSharpUnicodeEscape(
        string source,
        int index,
        out string value,
        out int consumed)
    {
        value = string.Empty;
        consumed = 0;
        if (index + 1 >= source.Length || source[index] != '\\' ||
            source[index + 1] is not ('u' or 'U'))
        {
            return false;
        }

        var digitCount = source[index + 1] == 'u' ? 4 : 8;
        if (index > source.Length - digitCount - 2)
        {
            return false;
        }
        var digits = source.AsSpan(index + 2, digitCount);
        if (!int.TryParse(digits, NumberStyles.AllowHexSpecifier,
                CultureInfo.InvariantCulture, out var scalar) ||
            scalar > 0x10ffff ||
            (digitCount == 8 && scalar is >= 0xd800 and <= 0xdfff))
        {
            return false;
        }

        value = digitCount == 4
            ? ((char)scalar).ToString()
            : char.ConvertFromUtf32(scalar);
        consumed = digitCount + 2;
        return true;
    }

    private static bool IsCSharpIdentifierCharacter(
        string value,
        bool first)
    {
        var enumerator = value.EnumerateRunes().GetEnumerator();
        if (!enumerator.MoveNext())
        {
            return false;
        }
        var rune = enumerator.Current;
        return !enumerator.MoveNext() &&
               IsCSharpIdentifierRune(rune, first);
    }

    private static bool IsCSharpIdentifierRune(Rune rune, bool first)
    {
        if (rune.Value == '_')
        {
            return true;
        }
        var category = Rune.GetUnicodeCategory(rune);
        return category is UnicodeCategory.UppercaseLetter or
                   UnicodeCategory.LowercaseLetter or
                   UnicodeCategory.TitlecaseLetter or
                   UnicodeCategory.ModifierLetter or
                   UnicodeCategory.OtherLetter or
                   UnicodeCategory.LetterNumber ||
               (!first && category is UnicodeCategory.NonSpacingMark or
                   UnicodeCategory.SpacingCombiningMark or
                   UnicodeCategory.DecimalDigitNumber or
                   UnicodeCategory.ConnectorPunctuation or
                   UnicodeCategory.Format);
    }

    private static string? TryReadDeclaredTypeName(
        IReadOnlyList<string> tokens,
        int keywordIndex)
    {
        var keyword = tokens[keywordIndex];
        if (keyword is "class" or "interface" or "struct" or "enum")
        {
            return keywordIndex + 1 < tokens.Count &&
                   IsCSharpIdentifierToken(tokens[keywordIndex + 1])
                ? tokens[keywordIndex + 1].TrimStart('@')
                : null;
        }
        if (keyword == "record")
        {
            var nameIndex = keywordIndex + 1;
            if (nameIndex < tokens.Count &&
                tokens[nameIndex] is "class" or "struct")
            {
                nameIndex++;
            }
            return nameIndex < tokens.Count &&
                   IsCSharpIdentifierToken(tokens[nameIndex])
                ? tokens[nameIndex].TrimStart('@')
                : null;
        }
        if (keyword != "delegate" || keywordIndex + 1 >= tokens.Count ||
            tokens[keywordIndex + 1] == "*")
        {
            return null;
        }

        var angleDepth = 0;
        for (var cursor = keywordIndex + 1; cursor < tokens.Count; cursor++)
        {
            if (tokens[cursor] == "<")
            {
                angleDepth++;
            }
            else if (tokens[cursor] == ">" && angleDepth != 0)
            {
                angleDepth--;
            }
            else if (tokens[cursor] == "(" && angleDepth == 0)
            {
                var nameCursor = cursor - 1;
                if (nameCursor >= 0 && tokens[nameCursor] == ">")
                {
                    var genericDepth = 1;
                    nameCursor--;
                    while (nameCursor >= 0 && genericDepth != 0)
                    {
                        if (tokens[nameCursor] == ">") genericDepth++;
                        if (tokens[nameCursor] == "<") genericDepth--;
                        nameCursor--;
                    }
                }
                return nameCursor > keywordIndex &&
                       IsCSharpIdentifierToken(tokens[nameCursor])
                    ? tokens[nameCursor].TrimStart('@')
                    : null;
            }
            else if (tokens[cursor] is ";" or "{")
            {
                return null;
            }
        }
        return null;
    }

    private static bool IsCSharpIdentifierToken(string token)
    {
        var start = token.Length != 0 && token[0] == '@' ? 1 : 0;
        if (start == token.Length)
        {
            return false;
        }

        var first = true;
        foreach (var rune in token.AsSpan(start).EnumerateRunes())
        {
            if (!IsCSharpIdentifierRune(rune, first))
            {
                return false;
            }
            first = false;
        }
        return !first;
    }

    private static string RemoveGenericArity(string name)
    {
        var separator = name.IndexOf('`');
        return separator < 0 ? name : name[..separator];
    }

    private static void AddTypeAndNestedTypes(ISet<Type> types, Type type)
    {
        if (!types.Add(type))
        {
            return;
        }
        foreach (var nested in type.GetNestedTypes(
                     BindingFlags.Public | BindingFlags.NonPublic))
        {
            AddTypeAndNestedTypes(types, nested);
        }
    }

    private static Type[] ExpectedTask7PublicTypes() =>
        ExpectedTask7PublicTypeAttributes().Keys.ToArray();

    private static IReadOnlyDictionary<Type, TypeAttributes>
        ExpectedTask7PublicTypeAttributes() =>
        new Dictionary<Type, TypeAttributes>
        {
            [typeof(DialectProfile)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(SqlSafetyOrigin)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(NativeSqlCommandKind)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(NativeSqlText)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(AtomicityRequirement)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(SqlResultShape)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(PlanResultRole)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(PlanConnectionRole)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(PlanTransactionBehavior)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(BulkExecutionKind)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(PlanCachePolicy)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(SqlCompilationOptions)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(DatabasePlanStep)] =
                TypeAttributes.Public | TypeAttributes.Abstract,
            [typeof(SqlCommandStep)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(BulkCommandBatch)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(BulkStep)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(AdminStep)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(NativeScriptStep)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(CompiledPlanFingerprint)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(CompiledImpactEntry)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(PlanSafetyBinding)] =
                TypeAttributes.Public | TypeAttributes.Abstract,
            [typeof(NoTask6ImpactBinding)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(MigrationPlanSafetyBinding)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(DatabaseAdminSafetyBinding)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(CompiledImpactApproval)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(DatabaseExecutionPlan)] =
                TypeAttributes.Public | TypeAttributes.Sealed,
            [typeof(ISqlCompiler)] = TypeAttributes.Public |
                                      TypeAttributes.Interface |
                                      TypeAttributes.Abstract
        };

    private static TypeAttributes NormalizeTask7TypeAttributes(
        TypeAttributes attributes) =>
        attributes & ~TypeAttributes.BeforeFieldInit;

    private static void AssertExactTask7PublicTypeContract(Type type)
    {
        var expectedAttributes = ExpectedTask7PublicTypeAttributes();
        Assert.True(expectedAttributes.TryGetValue(type, out var expected),
            "Missing raw TypeAttributes contract for " + type.FullName + ".");
        Assert.Equal(expected,
            NormalizeTask7TypeAttributes(type.Attributes));

        Assert.False(type.IsNested);
        Assert.Equal(TypeAttributes.Public,
            type.Attributes & TypeAttributes.VisibilityMask);
        Assert.False(type.IsGenericTypeDefinition);
        Assert.False(type.IsByRefLike);
        Assert.False(type.IsCOMObject);

        if (type.IsEnum)
        {
            Assert.Equal(typeof(Enum), type.BaseType);
            Assert.True(type.IsSealed);
            Assert.False(type.IsAbstract);
            Assert.False(type.IsInterface);
            Assert.Equal(typeof(int), Enum.GetUnderlyingType(type));
            Assert.Equal(
                typeof(Enum).GetInterfaces()
                    .OrderBy(item => item.FullName, StringComparer.Ordinal),
                type.GetInterfaces()
                    .OrderBy(item => item.FullName, StringComparer.Ordinal));
            return;
        }

        if (type == typeof(ISqlCompiler))
        {
            Assert.True(type.IsInterface);
            Assert.True(type.IsAbstract);
            Assert.False(type.IsSealed);
            Assert.Null(type.BaseType);
            Assert.Empty(type.GetInterfaces());
            return;
        }

        Assert.True(type.IsClass);
        Assert.False(type.IsInterface);
        var expectedBase = type == typeof(SqlCommandStep) ||
                           type == typeof(BulkStep) ||
                           type == typeof(AdminStep) ||
                           type == typeof(NativeScriptStep)
            ? typeof(DatabasePlanStep)
            : type == typeof(NoTask6ImpactBinding) ||
              type == typeof(MigrationPlanSafetyBinding) ||
              type == typeof(DatabaseAdminSafetyBinding)
                ? typeof(PlanSafetyBinding)
                : typeof(object);
        Assert.Equal(expectedBase, type.BaseType);

        var abstractType = type == typeof(DatabasePlanStep) ||
                           type == typeof(PlanSafetyBinding);
        Assert.Equal(abstractType, type.IsAbstract);
        Assert.Equal(!abstractType, type.IsSealed);

        Type[] expectedInterfaces;
        if (type == typeof(DialectProfile))
        {
            expectedInterfaces = [typeof(IEquatable<DialectProfile>)];
        }
        else if (type == typeof(CompiledPlanFingerprint))
        {
            expectedInterfaces =
                [typeof(IEquatable<CompiledPlanFingerprint>)];
        }
        else
        {
            expectedInterfaces = [];
        }
        Assert.Equal(
            expectedInterfaces.OrderBy(item => item.FullName,
                StringComparer.Ordinal),
            type.GetInterfaces().OrderBy(item => item.FullName,
                StringComparer.Ordinal));
    }

    private static string[] ExpectedAccessiblePropertyNames(Type type)
    {
        if (type == typeof(DialectProfile))
            return ["DatabaseType", "ServerVersion", "CompatibilityMode", "Fingerprint"];
        if (type == typeof(NativeSqlText))
            return ["Text", "TargetProfile", "TargetDatabase", "Kind", "Origin", "Digest", "Utf8Length"];
        if (type == typeof(SqlCompilationOptions))
            return ["DialectProfile", "RequestedAtomicity", "SchemaToken"];
        if (type == typeof(DatabasePlanStep))
            return ["ResultShape", "ResultRole", "ConnectionRole", "TransactionBehavior", "SourceMigrationStepId"];
        if (type == typeof(SqlCommandStep))
            return ["CommandText", "Parameters"];
        if (type == typeof(BulkCommandBatch))
            return ["Command", "RowCount"];
        if (type == typeof(BulkStep))
            return ["Operation", "ExecutionKind", "EffectiveBatchSize", "Batches"];
        if (type == typeof(AdminStep))
            return ["Operation"];
        if (type == typeof(NativeScriptStep))
            return ["Text", "Parameters"];
        if (type == typeof(CompiledPlanFingerprint))
            return ["Value"];
        if (type == typeof(CompiledImpactEntry))
            return ["StepId", "NeutralImpact", "EffectiveImpact", "IsElevated"];
        if (type == typeof(PlanSafetyBinding))
            return ["NeutralImpact", "EffectiveImpact", "RequiresEffectiveImpactApproval"];
        if (type == typeof(MigrationPlanSafetyBinding))
            return ["PlanId", "SourceFingerprint", "Entries"];
        if (type == typeof(DatabaseAdminSafetyBinding))
            return ["Operation", "SourceFingerprint"];
        if (type == typeof(CompiledImpactApproval))
            return ["SourceFingerprint", "DialectProfile", "SchemaToken", "PlanFingerprint", "EffectiveImpact", "ElevatedMigrationSteps", "Reference"];
        if (type == typeof(DatabaseExecutionPlan))
            return ["Steps", "ResultShape", "Origin", "Atomicity", "DialectProfile", "SchemaToken", "CachePolicy", "Fingerprint", "Safety", "RequiresEffectiveImpactApproval", "CanApplyEffectiveImpact"];
        return [];
    }

    private static void AssertArchitectureTypeGraphSafe(
        Type? type,
        string path,
        bool allowTransientWireBytes,
        ISet<Type> ownedTypes,
        ISet<Type> visited)
    {
        if (type == null)
        {
            return;
        }
        if (type.IsByRef || type.IsPointer)
        {
            AssertArchitectureTypeGraphSafe(
                type.GetElementType(), path,
                allowTransientWireBytes: false,
                ownedTypes, visited);
            return;
        }
        if (type.IsArray && type.GetElementType() == typeof(byte))
        {
            Assert.True(type == typeof(byte[]) && allowTransientWireBytes,
                path + " exposes a forbidden byte array shape.");
            return;
        }
        Assert.False(IsForbiddenRuntimeContainer(type),
            path + " references a forbidden runtime container " +
            (type.FullName ?? type.Name));
        if (type.IsArray)
        {
            AssertArchitectureTypeGraphSafe(
                type.GetElementType(), path,
                allowTransientWireBytes: false,
                ownedTypes, visited);
            return;
        }

        Assert.False(IsForbiddenDosOrmRuntimeType(type),
            path + " references forbidden Dos.ORM runtime type " +
            (type.FullName ?? type.Name));
        Assert.False(typeof(IServiceProvider).IsAssignableFrom(type), path);
        Assert.False(typeof(IDataParameter).IsAssignableFrom(type), path);
        Assert.False(typeof(IDbDataParameter).IsAssignableFrom(type), path);
        Assert.False(typeof(DbProviderFactory).IsAssignableFrom(type), path);
        Assert.False(typeof(DbConnection).IsAssignableFrom(type), path);
        Assert.False(typeof(DbCommand).IsAssignableFrom(type), path);
        Assert.False(typeof(DbTransaction).IsAssignableFrom(type), path);
        Assert.False(typeof(IDbConnection).IsAssignableFrom(type), path);
        Assert.False(typeof(IDbCommand).IsAssignableFrom(type), path);
        Assert.False(typeof(IDbTransaction).IsAssignableFrom(type), path);
        Assert.False(typeof(Stream).IsAssignableFrom(type), path);
        Assert.False(typeof(Delegate).IsAssignableFrom(type), path);
        Assert.False(typeof(Uri).IsAssignableFrom(type), path);

        var fullName = type.FullName ?? type.Name;
        Assert.DoesNotMatch(
            new Regex(
                @"(^|\.)(NetworkCredential|CredentialCache|ICredentials|SecureString|FileInfo|DirectoryInfo|FileSystemInfo|DriveInfo|Path)$",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            fullName);
        var typeNamespace = type.Namespace ?? string.Empty;
        Assert.False(IsProviderNamespace(typeNamespace),
            path + " references provider namespace " + typeNamespace);

        if (type.IsGenericType)
        {
            foreach (var argument in type.GetGenericArguments())
            {
                AssertArchitectureTypeGraphSafe(
                    argument, path + " generic argument",
                    allowTransientWireBytes: false, ownedTypes, visited);
            }
        }
        if (type.IsGenericParameter)
        {
            foreach (var constraint in type.GetGenericParameterConstraints())
            {
                AssertArchitectureTypeGraphSafe(
                    constraint, path + " generic constraint",
                    allowTransientWireBytes, ownedTypes, visited);
            }
        }

        var ownedDefinition = type.IsGenericType
            ? type.GetGenericTypeDefinition()
            : type;
        if ((!ownedTypes.Contains(type) &&
             !ownedTypes.Contains(ownedDefinition)) ||
            !visited.Add(type))
        {
            return;
        }

        const BindingFlags declared = BindingFlags.Public |
                                      BindingFlags.NonPublic |
                                      BindingFlags.Instance |
                                      BindingFlags.Static |
                                      BindingFlags.DeclaredOnly;
        AssertArchitectureTypeGraphSafe(
            type.BaseType, path + " base", allowTransientWireBytes,
            ownedTypes, visited);
        foreach (var contract in type.GetInterfaces())
        {
            AssertArchitectureTypeGraphSafe(
                contract, path + " interface", allowTransientWireBytes,
                ownedTypes, visited);
        }
        foreach (var field in type.GetFields(declared))
        {
            AssertNoObjectStorageType(
                field.FieldType, path + "." + field.Name);
            AssertArchitectureTypeGraphSafe(
                field.FieldType, path + "." + field.Name,
                allowTransientWireBytes, ownedTypes, visited);
        }
        foreach (var property in type.GetProperties(declared))
        {
            AssertNoObjectStorageType(
                property.PropertyType, path + "." + property.Name);
            AssertArchitectureTypeGraphSafe(
                property.PropertyType, path + "." + property.Name,
                allowTransientWireBytes, ownedTypes, visited);
            foreach (var index in property.GetIndexParameters())
            {
                AssertArchitectureTypeGraphSafe(
                    index.ParameterType, path + "." + property.Name + " index",
                    allowTransientWireBytes, ownedTypes, visited);
            }
        }
        foreach (var @event in type.GetEvents(declared))
        {
            AssertArchitectureTypeGraphSafe(
                @event.EventHandlerType, path + "." + @event.Name,
                allowTransientWireBytes, ownedTypes, visited);
        }
        foreach (var constructor in type.GetConstructors(declared))
        {
            foreach (var parameter in constructor.GetParameters())
            {
                AssertArchitectureTypeGraphSafe(
                    parameter.ParameterType,
                    path + " ctor " + parameter.Name,
                    allowTransientWireBytes, ownedTypes, visited);
            }
        }
        foreach (var method in type.GetMethods(declared))
        {
            AssertArchitectureTypeGraphSafe(
                method.ReturnType, path + "." + method.Name + " return",
                allowTransientWireBytes, ownedTypes, visited);
            foreach (var parameter in method.GetParameters())
            {
                AssertArchitectureTypeGraphSafe(
                    parameter.ParameterType,
                    path + "." + method.Name + " " + parameter.Name,
                    allowTransientWireBytes, ownedTypes, visited);
            }
            foreach (var generic in method.GetGenericArguments())
            {
                AssertArchitectureTypeGraphSafe(
                    generic, path + "." + method.Name + " generic",
                    allowTransientWireBytes, ownedTypes, visited);
            }
        }
    }

    private static bool IsForbiddenDosOrmRuntimeType(Type type) =>
        typeof(DbProvider).IsAssignableFrom(type) ||
        typeof(Database).IsAssignableFrom(type) ||
        typeof(DbSession).IsAssignableFrom(type) ||
        typeof(DbTrans).IsAssignableFrom(type) ||
        typeof(DbBatch).IsAssignableFrom(type) ||
        typeof(ProviderFactory).IsAssignableFrom(type) ||
        typeof(Section).IsAssignableFrom(type) ||
        typeof(IDataParameter).IsAssignableFrom(type) ||
        type == typeof(ParameterBag) ||
        type == typeof(BoundParameter);

    private static bool IsForbiddenRuntimeContainer(Type type)
    {
        if (type != typeof(Array) && !type.IsArray && !type.IsGenericType &&
            typeof(ICollection).IsAssignableFrom(type))
        {
            return true;
        }

        return type != typeof(object) &&
               (type.IsArray || type.IsGenericType) &&
               ContainsObjectStorageType(type, new HashSet<Type>());
    }

    private static void AssertNoObjectStorageType(Type type, string path)
    {
        Assert.False(ContainsObjectStorageType(type, new HashSet<Type>()),
            path + " stores forbidden object runtime state.");
    }

    private static bool ContainsObjectStorageType(
        Type type,
        ISet<Type> visited)
    {
        if (type == typeof(object))
        {
            return true;
        }
        if (!visited.Add(type))
        {
            return false;
        }
        if (type.IsByRef || type.IsPointer || type.IsArray)
        {
            return type.GetElementType() is { } element &&
                   ContainsObjectStorageType(element, visited);
        }
        return type.IsGenericType && type.GetGenericArguments()
            .Any(argument => ContainsObjectStorageType(argument, visited));
    }

    private static bool AllowsStableWireTransientBytes(MethodBase method)
    {
        if (!string.Equals(
                method.DeclaringType?.FullName,
                "Dos.ORM.Platform.StableWireBuffer",
                StringComparison.Ordinal) || method.IsStatic)
        {
            return false;
        }

        var parameters = method.GetParameters()
            .Select(parameter => parameter.ParameterType)
            .ToArray();
        return method is MethodInfo info &&
               ((method.Name == "WriteUtf8" && info.ReturnType == typeof(void) &&
                 parameters.SequenceEqual([typeof(string)])) ||
                (method.Name == "WriteGuidRfc4122" &&
                 info.ReturnType == typeof(void) &&
                 parameters.SequenceEqual([typeof(Guid)])) ||
                (method.Name == "ComputeSha256Text" &&
                 info.ReturnType == typeof(string) && parameters.Length == 0));
    }

    private static void AssertMethodBodyArchitectureSafe(
        MethodBase method,
        ISet<Type> ownedTypes)
    {
        var body = method.GetMethodBody();
        if (body == null)
        {
            return;
        }

        var declaringName = method.DeclaringType?.FullName ?? "<global>";
        var methodPath = declaringName + "." + method.Name;
        var allowTransientWireBytes =
            AllowsStableWireTransientBytes(method);
        var visited = new HashSet<Type>();

        foreach (var local in body.LocalVariables)
        {
            AssertArchitectureTypeGraphSafe(
                local.LocalType,
                methodPath + " local " + local.LocalIndex,
                allowTransientWireBytes, ownedTypes, visited);
        }
        foreach (var clause in body.ExceptionHandlingClauses)
        {
            if (clause.Flags != ExceptionHandlingClauseOptions.Clause)
            {
                continue;
            }
            AssertArchitectureTypeGraphSafe(
                clause.CatchType,
                methodPath + " catch",
                allowTransientWireBytes, ownedTypes, visited);
        }
        foreach (var referencedType in ReferencedArchitectureTypes(method))
        {
            AssertArchitectureTypeGraphSafe(
                referencedType,
                methodPath + " IL reference",
                allowTransientWireBytes, ownedTypes, visited);
        }
    }

    private static IReadOnlyList<Type> ReferencedArchitectureTypes(
        MethodBase method)
    {
        var referenced = new HashSet<Type>();
        foreach (var reference in ReferencedIlMembers(method))
        {
            AddArchitectureMemberTypes(
                reference.Member, referenced,
                reference.OpCode == OpCodes.Newarr);
        }
        return referenced.ToArray();
    }

    private static IReadOnlyList<(MemberInfo Member, OpCode OpCode)>
        ReferencedIlMembers(MethodBase method)
    {
        var bytes = method.GetMethodBody()?.GetILAsByteArray();
        if (bytes == null)
        {
            return [];
        }

        var referenced = new List<(MemberInfo Member, OpCode OpCode)>();
        var offset = 0;
        while (offset < bytes.Length)
        {
            short value = bytes[offset++];
            if (value == 0xfe)
            {
                Assert.True(offset < bytes.Length,
                    method.Name + " ends inside a two-byte IL opcode.");
                value = (short)(0xfe00 | bytes[offset++]);
            }
            Assert.True(OpCodesByValue.TryGetValue(value, out var opCode),
                $"Unknown IL opcode 0x{value:x4} in {method.Name}.");

            if (opCode.OperandType == OperandType.InlineSig)
            {
                ResolveIlTokenMember(
                    method, OperandType.InlineSig, token: 0);
            }

            if (opCode.OperandType is OperandType.InlineField or
                OperandType.InlineMethod or OperandType.InlineTok or
                OperandType.InlineType)
            {
                Assert.True(offset <= bytes.Length - 4,
                    method.Name + " has a truncated metadata token.");
                var token = BitConverter.ToInt32(bytes, offset);
                offset += 4;
                referenced.Add((ResolveIlTokenMember(
                    method, opCode.OperandType, token), opCode));
                continue;
            }

            offset += OperandSize(opCode.OperandType, bytes, offset);
            Assert.True(offset <= bytes.Length,
                method.Name + " has a truncated IL operand.");
        }
        return referenced;
    }

    private static MemberInfo ResolveIlTokenMember(
        MethodBase method,
        OperandType operandType,
        int token)
    {
        if (operandType == OperandType.InlineSig)
        {
            Assert.Fail(method.Name +
                " uses an indirect IL signature that cannot be architecture-audited.");
        }
        if (operandType is not (OperandType.InlineField or
            OperandType.InlineMethod or OperandType.InlineTok or
            OperandType.InlineType))
        {
            Assert.Fail(method.Name + " uses unsupported metadata operand " +
                operandType + ".");
        }

        try
        {
            var declaringArguments = method.DeclaringType?.GetGenericArguments();
            var methodArguments = method is MethodInfo methodInfo
                ? methodInfo.GetGenericArguments()
                : null;
            MemberInfo? member = operandType switch
            {
                OperandType.InlineField => method.Module.ResolveField(
                    token, declaringArguments, methodArguments),
                OperandType.InlineMethod => method.Module.ResolveMethod(
                    token, declaringArguments, methodArguments),
                OperandType.InlineType => method.Module.ResolveType(
                    token, declaringArguments, methodArguments),
                _ => method.Module.ResolveMember(
                    token, declaringArguments, methodArguments)
            };
            Assert.NotNull(member);
            return member!;
        }
        catch (Xunit.Sdk.XunitException)
        {
            throw;
        }
        catch (Exception exception)
        {
            Assert.Fail(method.Name +
                " contains an unresolvable architecture metadata token: " +
                exception.GetType().Name + ": " + exception.Message);
            throw;
        }
    }

    private static void AddArchitectureMemberTypes(
        MemberInfo member,
        ISet<Type> types,
        bool isNewArray)
    {
        if (member.DeclaringType != null)
        {
            types.Add(member.DeclaringType);
        }

        if (member is Type type)
        {
            types.Add(isNewArray ? type.MakeArrayType() : type);
            return;
        }
        if (member is FieldInfo field)
        {
            types.Add(field.FieldType);
            return;
        }
        if (member is MethodBase method)
        {
            if (method is MethodInfo methodInfo)
            {
                types.Add(methodInfo.ReturnType);
                foreach (var generic in methodInfo.GetGenericArguments())
                {
                    types.Add(generic);
                    if (!generic.IsGenericParameter)
                    {
                        continue;
                    }
                    foreach (var constraint in generic
                                 .GetGenericParameterConstraints())
                    {
                        types.Add(constraint);
                    }
                }
            }
            foreach (var parameter in method.GetParameters())
            {
                types.Add(parameter.ParameterType);
            }
            return;
        }

        Assert.Fail("Unexpected IL member kind: " + member.MemberType + ".");
    }

    private static bool IsProviderNamespace(string value) =>
        IsNamespaceOrChild(value, "System.Data.Common",
            StringComparison.Ordinal) ||
        IsNamespaceOrChild(value, "System.Data.SqlClient",
            StringComparison.Ordinal) ||
        IsNamespaceOrChild(value, "Microsoft.Data.SqlClient",
            StringComparison.Ordinal) ||
        IsNamespaceOrChild(value, "Dos.ORM.DaMeng",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Oracle",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "MySql",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Npgsql",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Dm",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "DmProvider",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Dameng",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Kdb",
            StringComparison.OrdinalIgnoreCase) ||
        IsNamespaceOrChild(value, "Kdbndp",
            StringComparison.OrdinalIgnoreCase);

    private static bool IsNamespaceOrChild(
        string value,
        string root,
        StringComparison comparison) =>
        string.Equals(value, root, comparison) ||
        value.StartsWith(root + ".", comparison);

    private static void AssertMethodHasNoLoggingOrProviderCalls(
        MethodBase method)
    {
        foreach (var reference in ReferencedIlMembers(method))
        {
            var referencedTypes = new HashSet<Type>();
            AddArchitectureMemberTypes(
                reference.Member, referencedTypes,
                reference.OpCode == OpCodes.Newarr);
            foreach (var referencedType in referencedTypes)
            {
                AssertNoLoggingOrProviderTypeGraph(
                    referencedType,
                    (method.DeclaringType?.FullName ?? "<global>") + "." +
                    method.Name,
                    new HashSet<Type>());
            }
        }
    }

    private static void AssertNoLoggingOrProviderTypeGraph(
        Type? type,
        string path,
        ISet<Type> visited)
    {
        if (type == null || !visited.Add(type))
        {
            return;
        }
        if (type.IsByRef || type.IsPointer || type.IsArray)
        {
            AssertNoLoggingOrProviderTypeGraph(
                type.GetElementType(), path, visited);
            return;
        }

        var typeNamespace = type.Namespace ?? string.Empty;
        Assert.False(IsProviderNamespace(typeNamespace),
            path + " references provider API " +
            (type.FullName ?? type.Name));
        Assert.False(typeNamespace.StartsWith(
                "Microsoft.Extensions.Logging",
                StringComparison.Ordinal),
            path + " references logging API " +
            (type.FullName ?? type.Name));
        Assert.NotEqual(typeof(Console), type);
        Assert.NotEqual(typeof(System.Diagnostics.Trace), type);
        Assert.NotEqual(typeof(System.Diagnostics.Debug), type);
        Assert.False(typeof(TextWriter).IsAssignableFrom(type),
            path + " references TextWriter API " +
            (type.FullName ?? type.Name));

        if (type.DeclaringType != null)
        {
            AssertNoLoggingOrProviderTypeGraph(
                type.DeclaringType, path + " declaring type", visited);
        }
        if (type.IsGenericType || type.IsGenericParameter)
        {
            foreach (var argument in type.IsGenericParameter
                         ? type.GetGenericParameterConstraints()
                         : type.GetGenericArguments())
            {
                AssertNoLoggingOrProviderTypeGraph(
                    argument, path + " generic type", visited);
            }
        }
    }

    private static Type UnwrapEnumerable(Type type)
    {
        if (type == typeof(string))
        {
            return type;
        }
        if (type.IsArray)
        {
            return UnwrapEnumerable(type.GetElementType()!);
        }
        if (type.IsGenericType)
        {
            var definition = type.GetGenericTypeDefinition();
            if (definition == typeof(IEnumerable<>) ||
                definition == typeof(IReadOnlyList<>) ||
                definition == typeof(IList<>) ||
                definition == typeof(ICollection<>) ||
                definition == typeof(List<>))
            {
                return UnwrapEnumerable(type.GetGenericArguments()[0]);
            }
        }
        return type;
    }

    private static bool IsVisible(MethodBase method) =>
        method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly ||
        method.IsFamilyAndAssembly;

    private static IEnumerable<Type> VisibleSignatureTypes(Type type)
    {
        const BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic |
                                   BindingFlags.Instance | BindingFlags.Static |
                                   BindingFlags.DeclaredOnly;
        foreach (var constructor in type.GetConstructors(flags).Where(IsVisible))
        {
            foreach (var parameter in constructor.GetParameters())
            {
                yield return parameter.ParameterType;
            }
        }
        foreach (var method in type.GetMethods(flags).Where(IsVisible))
        {
            yield return method.ReturnType;
            foreach (var parameter in method.GetParameters())
            {
                if (method.Name == nameof(object.Equals) &&
                    method.ReturnType == typeof(bool) &&
                    method.GetParameters().Length == 1 &&
                    parameter.ParameterType == typeof(object))
                {
                    continue;
                }
                yield return parameter.ParameterType;
            }
        }
        foreach (var property in type.GetProperties(flags)
                     .Where(property =>
                         property.GetMethod != null && IsVisible(property.GetMethod)))
        {
            yield return property.PropertyType;
        }
    }

    private static void AssertDeclaredVisibleMethods(
        Type type,
        params string[] expected)
    {
        var actual = type.GetMethods(
                BindingFlags.Public | BindingFlags.NonPublic |
                BindingFlags.Instance | BindingFlags.Static |
                BindingFlags.DeclaredOnly)
            .Where(method => IsVisible(method) && !method.IsSpecialName)
            .Select(MethodDescriptor)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(expected.OrderBy(value => value, StringComparer.Ordinal), actual);
    }

    private static string MethodDescriptor(MethodInfo method) =>
        method.Name + "(" + string.Join(",",
            method.GetParameters().Select(parameter =>
                FriendlyTypeName(parameter.ParameterType))) + ")";

    private static string FriendlyTypeName(Type type)
    {
        if (!type.IsGenericType)
        {
            return type.Name;
        }
        var tick = type.Name.IndexOf('`');
        var name = tick < 0 ? type.Name : type.Name[..tick];
        return name + "<" + string.Join(",",
            type.GetGenericArguments().Select(FriendlyTypeName)) + ">";
    }

    private static class ReferenceWireEncoder
    {
        public static string ProfileFingerprint(
            DatabaseType databaseType,
            Version version,
            string compatibilityMode)
        {
            var wire = new ReferenceWire();
            wire.Utf8("microi-dialect-profile-v1");
            WriteProfile(wire, databaseType, version, compatibilityMode);
            return wire.Hash();
        }

        public static string NativeDigest(
            DatabaseType databaseType,
            Version version,
            string compatibilityMode,
            SqlSafetyOrigin origin,
            NativeSqlCommandKind kind,
            string text)
        {
            var wire = new ReferenceWire();
            wire.Utf8("microi-native-sql-text-v1");
            WriteProfile(wire, databaseType, version, compatibilityMode);
            wire.Enum(origin);
            wire.Enum(kind);
            wire.Utf8(text);
            return wire.Hash();
        }

        public static string NativeScalarPlanFingerprint(
            DatabaseType databaseType,
            Version version,
            string compatibilityMode,
            string nativeDigest,
            int utf8Length,
            SqlSafetyOrigin origin,
            NativeSqlCommandKind kind)
        {
            var wire = new ReferenceWire();
            wire.Utf8("microi-database-execution-plan-v1");
            WriteProfile(wire, databaseType, version, compatibilityMode);
            wire.Absent();
            wire.Enum(origin);
            wire.Enum(AtomicityRequirement.None);
            wire.Enum(PlanCachePolicy.DoNotCache);
            wire.Enum(SqlResultShape.Scalar);
            wire.Tag("safety:no-task6-impact");
            wire.Enum(DestructiveImpact.None);
            wire.Enum(DestructiveImpact.None);
            wire.Count(1);
            wire.Tag("step:native");
            WriteStepCommon(wire, SqlResultShape.Scalar, PlanResultRole.Final,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Opaque, null);
            wire.Utf8(nativeDigest);
            wire.I32(utf8Length);
            WriteProfile(wire, databaseType, version, compatibilityMode);
            wire.Enum(origin);
            wire.Enum(kind);
            wire.Count(0);
            return wire.Hash();
        }

        public static string PlanFingerprint(DatabaseExecutionPlan plan)
        {
            var wire = new ReferenceWire();
            wire.Utf8("microi-database-execution-plan-v1");
            WriteProfile(wire, plan.DialectProfile);
            wire.Optional(plan.SchemaToken, token => WriteSchemaToken(wire, token));
            wire.Enum(plan.Origin);
            wire.Enum(plan.Atomicity);
            wire.Enum(plan.CachePolicy);
            wire.Enum(plan.ResultShape);
            WriteSafety(wire, plan.Safety);
            wire.Sequence(plan.Steps, step => WriteStep(wire, step));
            return wire.Hash();
        }

        private static void WriteProfile(
            ReferenceWire wire,
            DialectProfile profile) =>
            WriteProfile(wire, profile.DatabaseType, profile.ServerVersion,
                profile.CompatibilityMode);

        private static void WriteProfile(
            ReferenceWire wire,
            DatabaseType databaseType,
            Version version,
            string compatibilityMode)
        {
            wire.Enum(databaseType);
            wire.I32(version.Major);
            wire.I32(version.Minor);
            wire.I32(version.Build);
            wire.I32(version.Revision);
            wire.Utf8(compatibilityMode);
        }

        private static void WriteSafety(
            ReferenceWire wire,
            PlanSafetyBinding safety)
        {
            if (safety is NoTask6ImpactBinding)
            {
                wire.Tag("safety:no-task6-impact");
                wire.Enum(safety.NeutralImpact);
                wire.Enum(safety.EffectiveImpact);
                return;
            }
            if (safety is MigrationPlanSafetyBinding migration)
            {
                wire.Tag("safety:migration");
                wire.Enum(migration.NeutralImpact);
                wire.Enum(migration.EffectiveImpact);
                WriteMigrationPlanId(wire, migration.PlanId);
                WriteStructuralFingerprint(wire, migration.SourceFingerprint);
                wire.Sequence(migration.Entries,
                    entry => WriteImpact(wire, entry));
                return;
            }
            if (safety is DatabaseAdminSafetyBinding admin)
            {
                if (admin.Operation is DropDatabaseOperation)
                {
                    wire.Tag("safety:admin-drop-database");
                }
                else if (admin.Operation is DatabaseImportOperation)
                {
                    wire.Tag("safety:admin-import");
                }
                else
                {
                    throw new NotSupportedException(
                        "Unknown admin safety operation.");
                }
                wire.Enum(admin.NeutralImpact);
                wire.Enum(admin.EffectiveImpact);
                WriteStructuralFingerprint(wire, admin.SourceFingerprint);
                WriteAdmin(wire, admin.Operation);
                return;
            }
            throw new NotSupportedException("Unknown plan safety binding.");
        }

        private static void WriteImpact(
            ReferenceWire wire,
            CompiledImpactEntry entry)
        {
            wire.Tag("compiled-impact-entry");
            WriteMigrationStepId(wire, entry.StepId);
            wire.Enum(entry.NeutralImpact);
            wire.Enum(entry.EffectiveImpact);
        }

        private static void WriteStep(
            ReferenceWire wire,
            DatabasePlanStep step)
        {
            switch (step)
            {
                case SqlCommandStep command:
                    WriteCommand(wire, command);
                    return;
                case BulkStep bulk when bulk.ExecutionKind == BulkExecutionKind.Native:
                    wire.Tag("step:bulk-native");
                    WriteStepCommon(wire, bulk);
                    WriteBulk(wire, bulk.Operation);
                    wire.Enum(bulk.ExecutionKind);
                    wire.I32(bulk.EffectiveBatchSize);
                    wire.Sequence(bulk.Batches,
                        batch => WriteBulkBatch(wire, batch));
                    return;
                case BulkStep bulk when bulk.ExecutionKind == BulkExecutionKind.BatchedSql:
                    wire.Tag("step:bulk-batched-sql");
                    WriteStepCommon(wire, bulk);
                    WriteBulk(wire, bulk.Operation);
                    wire.Enum(bulk.ExecutionKind);
                    wire.I32(bulk.EffectiveBatchSize);
                    wire.Sequence(bulk.Batches,
                        batch => WriteBulkBatch(wire, batch));
                    return;
                case AdminStep admin:
                    wire.Tag("step:admin");
                    WriteStepCommon(wire, admin);
                    WriteAdmin(wire, admin.Operation);
                    return;
                case NativeScriptStep native:
                    wire.Tag("step:native");
                    WriteStepCommon(wire, native);
                    wire.Utf8(native.Text.Digest);
                    wire.I32(native.Text.Utf8Length);
                    WriteProfile(wire, native.Text.TargetProfile);
                    wire.Enum(native.Text.Origin);
                    wire.Enum(native.Text.Kind);
                    wire.Sequence(native.Parameters,
                        definition => WriteParameter(wire, definition));
                    return;
                default:
                    throw new NotSupportedException("Unknown database plan step.");
            }
        }

        private static void WriteCommand(
            ReferenceWire wire,
            SqlCommandStep command)
        {
            wire.Tag("step:sql-command");
            WriteStepCommon(wire, command);
            wire.Utf8(command.CommandText);
            wire.Sequence(command.Parameters,
                definition => WriteParameter(wire, definition));
        }

        private static void WriteStepCommon(
            ReferenceWire wire,
            DatabasePlanStep step) =>
            WriteStepCommon(wire, step.ResultShape, step.ResultRole,
                step.ConnectionRole, step.TransactionBehavior,
                step.SourceMigrationStepId);

        private static void WriteStepCommon(
            ReferenceWire wire,
            SqlResultShape shape,
            PlanResultRole role,
            PlanConnectionRole connection,
            PlanTransactionBehavior transaction,
            MigrationStepId? sourceStepId)
        {
            wire.Enum(shape);
            wire.Enum(role);
            wire.Enum(connection);
            wire.Enum(transaction);
            wire.Optional(sourceStepId,
                id => WriteMigrationStepId(wire, id));
        }

        private static void WriteBulkBatch(
            ReferenceWire wire,
            BulkCommandBatch batch)
        {
            wire.Tag("bulk-command-batch");
            wire.I32(batch.RowCount);
            WriteCommand(wire, batch.Command);
        }

        private static void WriteAdmin(
            ReferenceWire wire,
            DatabaseAdminOperation operation)
        {
            switch (operation)
            {
                case CreateDatabaseOperation create:
                    wire.Tag("admin:create-database");
                    WriteIdentifier(wire, create.Database);
                    wire.Enum(create.Behavior);
                    return;
                case DropDatabaseOperation drop:
                    wire.Tag("admin:drop-database");
                    WriteIdentifier(wire, drop.Database);
                    wire.Enum(drop.Behavior);
                    return;
                case DatabaseExportOperation export:
                    wire.Tag("admin:export-database");
                    WriteIdentifier(wire, export.Database);
                    WriteResource(wire, export.Resource);
                    wire.Enum(export.Format);
                    wire.Enum(export.Scope);
                    return;
                case DatabaseImportOperation import:
                    wire.Tag("admin:import-database");
                    WriteIdentifier(wire, import.Database);
                    WriteResource(wire, import.Resource);
                    wire.Enum(import.Format);
                    wire.Enum(import.Scope);
                    wire.Enum(import.Policy);
                    return;
                default:
                    throw new NotSupportedException("Unknown admin operation.");
            }
        }

        private static void WriteBulk(
            ReferenceWire wire,
            BulkInsertOperation operation)
        {
            wire.Tag("bulk-insert-operation");
            WriteObjectName(wire, operation.Table);
            wire.Sequence(operation.Columns,
                identifier => WriteIdentifier(wire, identifier));
            wire.Sequence(operation.Rows, row =>
            {
                wire.Tag("bulk-insert-row");
                wire.Sequence(row.Values,
                    expression => WriteExpression(wire, expression));
            });
            wire.I32(operation.BatchSize);
        }

        private static void WriteExpression(
            ReferenceWire wire,
            SqlExpression expression)
        {
            switch (expression)
            {
                case ColumnExpression column:
                    wire.Tag("expr:column");
                    WriteIdentifier(wire, column.Name);
                    wire.Optional(column.Source,
                        alias => WriteAlias(wire, alias));
                    return;
                case ParameterExpression parameter:
                    wire.Tag("expr:parameter");
                    WriteParameter(wire, parameter.Definition);
                    return;
                case NullExpression:
                    wire.Tag("expr:null");
                    return;
                case BooleanExpression boolean:
                    wire.Tag("expr:boolean");
                    wire.Bool(boolean.Value);
                    return;
                case BinaryExpression binary:
                    wire.Tag("expr:binary");
                    WriteExpression(wire, binary.Left);
                    wire.Enum(binary.Operator);
                    WriteExpression(wire, binary.Right);
                    return;
                case UnaryExpression unary:
                    wire.Tag("expr:unary");
                    wire.Enum(unary.Operator);
                    WriteExpression(wire, unary.Operand);
                    return;
                case InExpression @in:
                    wire.Tag("expr:in");
                    WriteExpression(wire, @in.Operand);
                    wire.Sequence(@in.Values,
                        value => WriteExpression(wire, value));
                    return;
                case BetweenExpression between:
                    wire.Tag("expr:between");
                    WriteExpression(wire, between.Operand);
                    WriteExpression(wire, between.Lower);
                    WriteExpression(wire, between.Upper);
                    return;
                case CaseExpression @case:
                    wire.Tag("expr:case");
                    wire.Optional(@case.InputExpression,
                        input => WriteExpression(wire, input));
                    wire.Sequence(@case.WhenClauses, clause =>
                    {
                        wire.Tag("expr:case-when");
                        WriteExpression(wire, clause.When);
                        WriteExpression(wire, clause.Then);
                    });
                    wire.Optional(@case.ElseExpression,
                        alternative => WriteExpression(wire, alternative));
                    return;
                case CastExpression cast:
                    wire.Tag("expr:cast");
                    WriteExpression(wire, cast.Expression);
                    WriteType(wire, cast.Type);
                    return;
                case SubqueryExpression subquery:
                    wire.Tag("expr:subquery");
                    if (subquery.Query is not SelectStatement select)
                    {
                        throw new NotSupportedException("Unknown subquery node.");
                    }
                    WriteSelect(wire, select);
                    return;
                case ExistsExpression exists:
                    wire.Tag("expr:exists");
                    WriteExpression(wire, exists.Subquery);
                    return;
                case AggregateExpression aggregate:
                    wire.Tag("expr:aggregate");
                    WriteFunction(wire, aggregate.Function);
                    wire.Optional(aggregate.Argument,
                        argument => WriteExpression(wire, argument));
                    wire.Bool(aggregate.Distinct);
                    return;
                case FunctionExpression function:
                    wire.Tag("expr:function");
                    WriteFunction(wire, function.Function);
                    wire.Sequence(function.Arguments,
                        argument => WriteExpression(wire, argument));
                    return;
                case WildcardExpression wildcard:
                    wire.Tag("expr:wildcard");
                    wire.Optional(wildcard.Source,
                        alias => WriteAlias(wire, alias));
                    return;
                default:
                    throw new NotSupportedException("Unknown SQL expression.");
            }
        }

        private static void WriteSelect(
            ReferenceWire wire,
            SelectStatement select)
        {
            wire.Tag("query:select");
            wire.Optional(select.From, source => WriteTable(wire, source));
            wire.Sequence(select.Projections, projection =>
            {
                wire.Tag("query:projection");
                WriteExpression(wire, projection.Expression);
                wire.Optional(projection.Alias,
                    alias => WriteAlias(wire, alias));
            });
            wire.Bool(select.Distinct);
            wire.Optional(select.Where,
                expression => WriteExpression(wire, expression));
            wire.Sequence(select.GroupBy,
                expression => WriteExpression(wire, expression));
            wire.Optional(select.Having,
                expression => WriteExpression(wire, expression));
            wire.Sequence(select.OrderBy, order =>
            {
                wire.Tag("query:order-by");
                WriteExpression(wire, order.Expression);
                wire.Enum(order.Direction);
                wire.Enum(order.NullSortOrder);
            });
            wire.Optional(select.Page, page => WritePage(wire, page));
            wire.Optional(select.Lock, @lock =>
            {
                wire.Tag("query:lock");
                wire.Enum(@lock.Mode);
                wire.Enum(@lock.Wait);
            });
            wire.Sequence(select.CommonTableExpressions, cte =>
            {
                wire.Tag("query:cte");
                WriteIdentifier(wire, cte.Name);
                WriteSelect(wire, cte.Query);
                wire.Sequence(cte.Columns,
                    identifier => WriteIdentifier(wire, identifier));
                wire.Bool(cte.Recursive);
            });
            wire.Sequence(select.SetOperations, set =>
            {
                wire.Tag("query:set-operation");
                wire.Enum(set.Operator);
                WriteSelect(wire, set.RightQuery);
            });
        }

        private static void WriteTable(
            ReferenceWire wire,
            SqlTableSource source)
        {
            switch (source)
            {
                case NamedTableSource named:
                    wire.Tag("query:named-table");
                    WriteObjectName(wire, named.Name);
                    wire.Optional(named.Alias,
                        alias => WriteAlias(wire, alias));
                    return;
                case DerivedTableSource derived:
                    wire.Tag("query:derived-table");
                    WriteSelect(wire, derived.Query);
                    WriteAlias(wire, derived.Alias);
                    return;
                case JoinSource join:
                    wire.Tag("query:join");
                    WriteTable(wire, join.Left);
                    wire.Enum(join.JoinType);
                    WriteTable(wire, join.Right);
                    wire.Optional(join.Condition,
                        condition => WriteExpression(wire, condition));
                    return;
                default:
                    throw new NotSupportedException("Unknown table source.");
            }
        }

        private static void WritePage(ReferenceWire wire, PageSpec page)
        {
            switch (page)
            {
                case OffsetPageSpec offset:
                    wire.Tag("query:page-offset");
                    wire.I32(offset.Offset);
                    wire.I32(offset.Limit);
                    return;
                case KeysetPageSpec keyset:
                    wire.Tag("query:page-keyset");
                    wire.Sequence(keyset.Boundaries,
                        boundary => WriteExpression(wire, boundary));
                    wire.I32(keyset.Limit);
                    return;
                default:
                    throw new NotSupportedException("Unknown page specification.");
            }
        }

        private static void WriteIdentifier(
            ReferenceWire wire,
            SqlIdentifier identifier)
        {
            wire.Tag("identifier");
            wire.Utf8(identifier.Value);
        }

        private static void WriteObjectName(
            ReferenceWire wire,
            SqlObjectName name)
        {
            wire.Tag("object-name");
            wire.Optional(name.Catalog,
                identifier => WriteIdentifier(wire, identifier));
            wire.Optional(name.Schema,
                identifier => WriteIdentifier(wire, identifier));
            WriteIdentifier(wire, name.Name);
        }

        private static void WriteAlias(
            ReferenceWire wire,
            SqlAlias alias)
        {
            wire.Tag("alias");
            WriteIdentifier(wire, alias.Identifier);
        }

        private static void WriteType(
            ReferenceWire wire,
            SqlTypeDescriptor type)
        {
            wire.Tag("type-descriptor");
            wire.Enum(type.LogicalType);
            wire.OptionalInt32(type.Length);
            wire.OptionalInt32(type.Precision);
            wire.OptionalInt32(type.Scale);
        }

        private static void WriteParameter(
            ReferenceWire wire,
            ParameterDefinition definition)
        {
            wire.Tag("parameter-definition");
            wire.Utf8(definition.Name);
            WriteType(wire, definition.Type);
            wire.Enum(definition.Direction);
            wire.Bool(definition.IsNullable);
        }

        private static void WriteFunction(
            ReferenceWire wire,
            SemanticFunctionId function)
        {
            wire.Tag("semantic-function");
            wire.Utf8(function.Key);
            wire.I32(function.MinArguments);
            wire.OptionalInt32(function.MaxArguments);
            wire.Bool(function.IsAggregate);
        }

        private static void WriteMigrationPlanId(
            ReferenceWire wire,
            MigrationPlanId id)
        {
            wire.Tag("migration-plan-id");
            wire.Utf8(id.Value);
        }

        private static void WriteMigrationStepId(
            ReferenceWire wire,
            MigrationStepId id)
        {
            wire.Tag("migration-step-id");
            wire.Utf8(id.Value);
        }

        private static void WriteSchemaToken(
            ReferenceWire wire,
            SchemaToken token)
        {
            wire.Tag("schema-token");
            wire.Utf8(token.Value);
        }

        private static void WriteStructuralFingerprint(
            ReferenceWire wire,
            StructuralFingerprint fingerprint)
        {
            wire.Tag("structural-fingerprint");
            wire.Utf8(fingerprint.Value);
        }

        private static void WriteResource(
            ReferenceWire wire,
            DatabaseResourceHandle resource)
        {
            wire.Tag("database-resource-handle");
            wire.GuidRfc4122(resource.Id);
            wire.Tag("resource-content-digest");
            wire.Utf8(resource.ContentDigest.Value);
        }
    }

    private sealed class ReferenceWire
    {
        private static readonly UTF8Encoding StrictUtf8 = new(false, true);
        private readonly List<byte> _bytes = [];

        public void Tag(string value) => Utf8(value);

        public void Bool(bool value) => _bytes.Add(value ? (byte)1 : (byte)0);

        public void Absent() => _bytes.Add(0);

        public void I32(int value)
        {
            unchecked
            {
                _bytes.Add((byte)(value >> 24));
                _bytes.Add((byte)(value >> 16));
                _bytes.Add((byte)(value >> 8));
                _bytes.Add((byte)value);
            }
        }

        public void Count(int value)
        {
            if (value < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(value));
            }
            unchecked
            {
                var unsigned = (uint)value;
                _bytes.Add((byte)(unsigned >> 24));
                _bytes.Add((byte)(unsigned >> 16));
                _bytes.Add((byte)(unsigned >> 8));
                _bytes.Add((byte)unsigned);
            }
        }

        public void Utf8(string value)
        {
            var encoded = StrictUtf8.GetBytes(value);
            Count(encoded.Length);
            _bytes.AddRange(encoded);
        }

        public void Enum<T>(T value) where T : struct, Enum
        {
            var name = System.Enum.GetName(typeof(T), value);
            if (name == null)
            {
                throw new ArgumentOutOfRangeException(nameof(value));
            }
            Utf8(name);
        }

        public void Optional<T>(T? value, Action<T> write) where T : class
        {
            if (value == null)
            {
                Absent();
                return;
            }
            _bytes.Add(1);
            write(value);
        }

        public void OptionalInt32(int? value)
        {
            if (!value.HasValue)
            {
                Absent();
                return;
            }
            _bytes.Add(1);
            I32(value.Value);
        }

        public void Sequence<T>(IReadOnlyList<T> values, Action<T> write)
        {
            Count(values.Count);
            foreach (var value in values)
            {
                write(value);
            }
        }

        public void GuidRfc4122(Guid value)
        {
            var mixed = value.ToByteArray();
            _bytes.Add(mixed[3]);
            _bytes.Add(mixed[2]);
            _bytes.Add(mixed[1]);
            _bytes.Add(mixed[0]);
            _bytes.Add(mixed[5]);
            _bytes.Add(mixed[4]);
            _bytes.Add(mixed[7]);
            _bytes.Add(mixed[6]);
            for (var index = 8; index < 16; index++)
            {
                _bytes.Add(mixed[index]);
            }
        }

        public string Hash()
        {
            var hash = SHA256.HashData(_bytes.ToArray());
            return "sha256:" + Convert.ToHexString(hash).ToLowerInvariant();
        }
    }

    private static readonly IReadOnlyDictionary<short, OpCode> OpCodesByValue =
        typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.FieldType == typeof(OpCode))
            .Select(field => (OpCode)field.GetValue(null)!)
            .ToDictionary(opCode => opCode.Value);

    private static int OperandSize(
        OperandType operandType,
        byte[] bytes,
        int offset) =>
        operandType switch
        {
            OperandType.InlineNone => 0,
            OperandType.ShortInlineBrTarget => 1,
            OperandType.ShortInlineI => 1,
            OperandType.ShortInlineVar => 1,
            OperandType.InlineVar => 2,
            OperandType.InlineBrTarget => 4,
            OperandType.InlineField => 4,
            OperandType.InlineI => 4,
            OperandType.InlineSig => 4,
            OperandType.InlineString => 4,
            OperandType.InlineTok => 4,
            OperandType.InlineType => 4,
            OperandType.ShortInlineR => 4,
            OperandType.InlineI8 => 8,
            OperandType.InlineR => 8,
            OperandType.InlineSwitch => 4 +
                (BitConverter.ToInt32(bytes, offset) * 4),
            OperandType.InlineMethod => throw new InvalidOperationException(),
            _ => throw new InvalidOperationException(
                $"Unsupported IL operand type {operandType}.")
        };

    private sealed class TypeAttributeBaselineFixture
    {
    }

    [Serializable]
    private sealed class TypeAttributeSerializableFixture
    {
    }

    [System.Runtime.InteropServices.StructLayout(
        System.Runtime.InteropServices.LayoutKind.Sequential)]
    private sealed class TypeAttributeSequentialFixture
    {
    }

    [System.Runtime.CompilerServices.SpecialName]
    private sealed class TypeAttributeSpecialNameFixture
    {
    }

    private sealed class TypeAttributeExplicitStaticConstructorFixture
    {
        static TypeAttributeExplicitStaticConstructorFixture()
        {
        }
    }

    private sealed class ArchitectureEnvelope<T>
    {
        private ArchitectureEnvelope(T value)
        {
            Value = value;
        }

        private T Value { get; }
    }

    private sealed class ArchitectureCycleA
    {
        private ArchitectureCycleB? Next { get; }
    }

    private sealed class ArchitectureCycleB
    {
        private ArchitectureCycleA? Next { get; }
    }

    private sealed class ArchitectureProviderFactoryPayload
    {
        private DbProviderFactory Value { get; } = null!;
    }

    private sealed class ArchitectureServiceProviderPayload
    {
        private IServiceProvider Value { get; } = null!;
    }

    private sealed class ArchitectureDbParameterPayload
    {
        private IDbDataParameter Value { get; } = null!;
    }

    private sealed class ArchitectureByteArrayPayload
    {
        private byte[] Value { get; } = [];
    }

    private sealed class ArchitectureObjectPayload
    {
        private object Value { get; } = new();
    }

    private sealed class ArchitectureExternalSafePayload
    {
        private object Value { get; } = new();
    }

    private static class ArchitectureByteArrayMutationFixture
    {
        public static int CreateBytes()
        {
            var bytes = new byte[1];
            return bytes.Length;
        }
    }

    private static class LoggingAliasFixture
    {
        private static readonly TextWriter Writer = TextWriter.Null;

        public static int ConsoleExpression()
        {
            Console.WriteLine("fixture");
            return 1;
        }

        public static int TextWriterExpression(TextWriter writer)
        {
            writer.WriteLine("fixture");
            return 1;
        }

        public static object ReadTextWriterField() => Writer;

        public static object CastTextWriterType(object value) =>
            (TextWriter)value;

        public static Type TextWriterTypeToken() => typeof(TextWriter);
    }

    private sealed class UnknownExpression : SqlExpression
    {
    }

    private sealed class UnknownQueryNode : SqlNode
    {
    }

    private sealed class UnknownTableSource : SqlTableSource
    {
    }

    private sealed class UnknownPageSpec : PageSpec
    {
    }
}
