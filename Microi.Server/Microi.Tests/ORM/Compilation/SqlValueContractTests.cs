using System.Data;
using System.Reflection;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed class SqlValueContractTests
{
    private static readonly StructuralFingerprint CatalogFingerprint =
        Fingerprint('1');
    private static readonly StructuralFingerprint LogicalSchemaFingerprint =
        Fingerprint('2');
    private static readonly StructuralFingerprint ActiveContractFingerprint =
        Fingerprint('3');

    [Fact]
    public void Logical_text_encoding_has_only_the_frozen_values()
    {
        Assert.Equal(
            new[]
            {
                nameof(LogicalTextEncoding.Native),
                nameof(LogicalTextEncoding.NonEmptyEnvelopeV1)
            },
            Enum.GetNames<LogicalTextEncoding>());
        Assert.Equal(0, (int)LogicalTextEncoding.Native);
        Assert.Equal(1, (int)LogicalTextEncoding.NonEmptyEnvelopeV1);
    }

    [Fact]
    public void Database_storage_state_has_only_pending_and_active()
    {
        Assert.Equal(
            new[]
            {
                nameof(DatabaseStorageContractState.PendingImport),
                nameof(DatabaseStorageContractState.Active)
            },
            Enum.GetNames<DatabaseStorageContractState>());
        Assert.Equal(0, (int)DatabaseStorageContractState.PendingImport);
        Assert.Equal(1, (int)DatabaseStorageContractState.Active);
    }

    [Fact]
    public void Value_contract_defaults_to_native_and_freezes_logical_shape()
    {
        var contract = new SqlValueContract(LogicalDbType.String, 120);

        Assert.Equal(LogicalDbType.String, contract.LogicalType);
        Assert.Equal(120, contract.Length);
        Assert.Equal(LogicalTextEncoding.Native, contract.TextEncoding);
    }

    [Fact]
    public void Value_contract_rejects_invalid_values_and_non_text_envelopes()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlValueContract((LogicalDbType)int.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlValueContract(LogicalDbType.String, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlValueContract(
                LogicalDbType.String,
                null,
                (LogicalTextEncoding)int.MaxValue));
        Assert.Throws<ArgumentException>(() =>
            new SqlValueContract(
                LogicalDbType.Int32,
                null,
                LogicalTextEncoding.NonEmptyEnvelopeV1));
    }

    [Fact]
    public void Parameter_contract_requires_the_definition_shape_to_match()
    {
        var definition = new ParameterDefinition(
            "name",
            new SqlTypeDescriptor(LogicalDbType.String, 40),
            ParameterDirection.InputOutput,
            false);
        var value = new SqlValueContract(
            LogicalDbType.String,
            40,
            LogicalTextEncoding.NonEmptyEnvelopeV1);

        var contract = new SqlParameterValueContract(definition, value);

        Assert.Same(definition, contract.Definition);
        Assert.Same(value, contract.ValueContract);
        Assert.Throws<ArgumentException>(() =>
            new SqlParameterValueContract(
                definition,
                new SqlValueContract(LogicalDbType.String, 41)));
    }

    [Fact]
    public void Result_contract_rejects_negative_ordinals()
    {
        var value = new SqlValueContract(LogicalDbType.String);

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlResultValueContract(-1, value));

        var contract = new SqlResultValueContract(0, value);
        Assert.Equal(0, contract.Ordinal);
        Assert.Same(value, contract.ValueContract);
    }

    [Fact]
    public void Command_contract_defensively_copies_ordered_contracts()
    {
        var parameters = new List<SqlParameterValueContract>
        {
            Parameter("first", LogicalDbType.String, 20),
            Parameter("second", LogicalDbType.Int32)
        };
        var results = new List<SqlResultValueContract>
        {
            Result(0, LogicalDbType.String, 20),
            Result(1, LogicalDbType.Int32)
        };
        var storage = EnvelopeStorage("app.users.name");

        var contract = new SqlCommandValueContract(
            storage, parameters, results);
        parameters.Clear();
        results.Clear();

        Assert.Equal(new[] { "first", "second" },
            contract.Parameters.Select(item => item.Definition.Name));
        Assert.Equal(new[] { 0, 1 },
            contract.Results.Select(item => item.Ordinal));
        Assert.Equal(storage.Fingerprint,
            contract.StorageContractFingerprint);
        Assert.False(contract.IsNative);
        Assert.Throws<NotSupportedException>(() =>
            ((IList<SqlParameterValueContract>)contract.Parameters).Add(
                Parameter("third", LogicalDbType.Int64)));
    }

    [Fact]
    public void Command_contract_rejects_duplicate_parameters_and_ordinals()
    {
        var storage = EnvelopeStorage("app.users.name");

        Assert.Throws<ArgumentException>(() =>
            new SqlCommandValueContract(
                storage,
                new[]
                {
                    Parameter("value", LogicalDbType.String, 20),
                    Parameter("value", LogicalDbType.String, 20)
                },
                Array.Empty<SqlResultValueContract>()));
        Assert.Throws<ArgumentException>(() =>
            new SqlCommandValueContract(
                storage,
                Array.Empty<SqlParameterValueContract>(),
                new[]
                {
                    Result(0, LogicalDbType.String, 20),
                    Result(0, LogicalDbType.String, 20)
                }));
    }

    [Fact]
    public void Command_fingerprint_is_deterministic_and_covers_ordered_metadata()
    {
        var storage = EnvelopeStorage("app.users.name");
        var first = new SqlCommandValueContract(
            storage,
            new[]
            {
                Parameter("name", LogicalDbType.String, 20),
                Parameter("id", LogicalDbType.Int32)
            },
            new[] { Result(0, LogicalDbType.String, 20) });
        var equivalent = new SqlCommandValueContract(
            EnvelopeStorage("app.users.name"),
            new[]
            {
                Parameter("name", LogicalDbType.String, 20),
                Parameter("id", LogicalDbType.Int32)
            },
            new[] { Result(0, LogicalDbType.String, 20) });
        var reordered = new SqlCommandValueContract(
            storage,
            new[]
            {
                Parameter("id", LogicalDbType.Int32),
                Parameter("name", LogicalDbType.String, 20)
            },
            new[] { Result(0, LogicalDbType.String, 20) });
        var differentStorage = new SqlCommandValueContract(
            EnvelopeStorage("app.users.display_name"),
            first.Parameters,
            first.Results);

        Assert.Equal(first.Fingerprint, equivalent.Fingerprint);
        Assert.NotEqual(first.Fingerprint, reordered.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentStorage.Fingerprint);
    }

    [Fact]
    public void Native_contract_is_the_default_and_needs_no_plan_extension()
    {
        var storage = DatabaseStorageContract.Native(
            TestProfiles.PostgreSql17);
        var command = new SqlCommandValueContract(
            storage,
            new[] { Parameter("id", LogicalDbType.Int32) },
            new[] { Result(0, LogicalDbType.Int32) });

        Assert.Equal(DatabaseStorageContractState.Active, storage.State);
        Assert.Equal(1, storage.Version);
        Assert.Equal(LogicalTextEncoding.Native, storage.TextEncoding);
        Assert.Empty(storage.EncodedColumnKeys);
        Assert.Equal(TestProfiles.PostgreSql17.Fingerprint,
            storage.TargetProfileFingerprint);
        Assert.True(command.IsNative);
    }

    [Fact]
    public void Native_storage_factory_is_profile_bound_and_deterministic()
    {
        var first = DatabaseStorageContract.Native(
            TestProfiles.PostgreSql17);
        var equivalent = DatabaseStorageContract.Native(
            TestProfiles.Clone(TestProfiles.PostgreSql17));
        var differentProfile = DatabaseStorageContract.Native(
            TestProfiles.PostgreSql14);

        Assert.Equal(first.Fingerprint, equivalent.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentProfile.Fingerprint);
    }

    [Fact]
    public void Profileless_native_factory_is_deterministic_for_legacy_commands()
    {
        var definitions = new[]
        {
            new ParameterDefinition(
                "id", new SqlTypeDescriptor(LogicalDbType.Int32))
        };

        var first = SqlCommandValueContract.Native(definitions);
        var second = SqlCommandValueContract.Native(definitions);

        Assert.True(first.IsNative);
        Assert.NotNull(first.StorageContractFingerprint);
        Assert.Equal(first.StorageContractFingerprint,
            second.StorageContractFingerprint);
        Assert.Equal(first.Fingerprint, second.Fingerprint);
    }

    [Fact]
    public void Value_contract_is_internal_and_part_of_plan_command_identity()
    {
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        var profile = TestProfiles.Oracle19c;
        var nativeStorage = DatabaseStorageContract.Native(profile);
        var envelopeStorage = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            profile.Fingerprint,
            new[] { "app.users.name" });
        var publicOptions = new SqlCompilationOptions(profile);
        var nativeOptions = new SqlCompilationOptions(
            profile, AtomicityRequirement.None, null, nativeStorage);
        var envelopeOptions = new SqlCompilationOptions(
            profile, AtomicityRequirement.None, null, envelopeStorage);

        var legacyNative = Command(
            new SqlCommandStep(
                "SELECT 1",
                Array.Empty<ParameterDefinition>(),
                SqlResultShape.RowSet,
                PlanResultRole.Final,
                PlanConnectionRole.CurrentDatabase,
                PlanTransactionBehavior.Enlistable,
                null),
            source,
            publicOptions);
        var exactNativeContract = SqlCommandValueContract.Native(
            nativeStorage, Array.Empty<ParameterDefinition>());
        var exactNative = Command(
            CommandWithContract(exactNativeContract),
            source,
            nativeOptions);
        var envelopeContract = new SqlCommandValueContract(
            envelopeStorage,
            Array.Empty<SqlParameterValueContract>(),
            new[]
            {
                new SqlResultValueContract(
                    0,
                    new SqlValueContract(
                        LogicalDbType.String,
                        200,
                        LogicalTextEncoding.NonEmptyEnvelopeV1))
            });
        var envelope = Command(
            CommandWithContract(envelopeContract),
            source,
            envelopeOptions);

        Assert.Equal(
            envelopeStorage.Fingerprint,
            Assert.IsType<SqlCommandStep>(Assert.Single(envelope.Steps))
                .InternalValueContract.StorageContractFingerprint);
        Assert.Equal(legacyNative.Fingerprint, exactNative.Fingerprint);
        Assert.NotEqual(exactNative.Fingerprint, envelope.Fingerprint);
    }

    [Fact]
    public void Native_nondefault_result_contract_mutations_change_plan_identity()
    {
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        var profile = TestProfiles.PostgreSql17;
        var storage = DatabaseStorageContract.Native(profile);
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.None, null, storage);
        var defaultContract = SqlCommandValueContract.Native(
            storage, Array.Empty<ParameterDefinition>());
        var defaultPlan = Command(
            CommandWithContract(defaultContract), source, options);

        var variants = new[]
        {
            NativeResultContract(storage, 0, LogicalDbType.String, 20),
            NativeResultContract(storage, 1, LogicalDbType.String, 20),
            NativeResultContract(storage, 0, LogicalDbType.String, 21),
            NativeResultContract(storage, 0, LogicalDbType.Int32, null)
        };
        var fingerprints = variants.Select(contract => Command(
                CommandWithContract(contract), source, options).Fingerprint)
            .ToArray();

        Assert.False(defaultContract.RequiresPlanExtension);
        Assert.All(variants, contract =>
            Assert.True(contract.RequiresPlanExtension));
        Assert.All(fingerprints, fingerprint =>
            Assert.NotEqual(defaultPlan.Fingerprint, fingerprint));
        Assert.Equal(
            fingerprints.Length,
            fingerprints.Select(value => value.Value)
                .Distinct(StringComparer.Ordinal).ToArray().Length);
    }

    [Fact]
    public void Command_parameter_placeholder_mapping_is_defensive_and_fingerprinted()
    {
        var definitions = new[]
        {
            new ParameterDefinition(
                "late", new SqlTypeDescriptor(LogicalDbType.String)),
            new ParameterDefinition(
                "early", new SqlTypeDescriptor(LogicalDbType.Int32))
        };
        var profile = TestProfiles.PostgreSql17;
        var storage = DatabaseStorageContract.Native(profile);
        var options = new SqlCompilationOptions(
            profile, AtomicityRequirement.None, null, storage);
        var contract = SqlCommandValueContract.Native(storage, definitions);
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        var placeholders = new List<string> { "p7", "p2" };

        var sparse = new SqlCommandStep(
            "SELECT @p7,@p2", definitions, placeholders,
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract);
        placeholders[0] = "p0";
        var swapped = new SqlCommandStep(
            "SELECT @p7,@p2", definitions, new[] { "p2", "p7" },
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract);
        var denseLegacy = new SqlCommandStep(
            "SELECT @p0,@p1", definitions,
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract);
        var denseExplicit = new SqlCommandStep(
            "SELECT @p0,@p1", definitions, new[] { "p0", "p1" },
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract);

        Assert.Equal(new[] { "p7", "p2" },
            sparse.InternalParameterPlaceholders);
        Assert.NotEqual(
            Command(sparse, source, options).Fingerprint,
            Command(swapped, source, options).Fingerprint);
        Assert.Equal(
            Command(denseLegacy, source, options).Fingerprint,
            Command(denseExplicit, source, options).Fingerprint);

        Assert.Throws<ArgumentException>(() => new SqlCommandStep(
            "SELECT @p0", definitions, new[] { "p0" },
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract));
        Assert.Throws<ArgumentException>(() => new SqlCommandStep(
            "SELECT @p0,@p0", definitions, new[] { "p0", "p0" },
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract));
        Assert.Throws<ArgumentException>(() => new SqlCommandStep(
            "SELECT @p01,@p2", definitions, new[] { "p01", "p2" },
            SqlResultShape.RowSet, PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable, null, contract));
    }

    [Fact]
    public void Compilation_options_reject_a_storage_contract_for_another_profile()
    {
        Assert.Throws<ArgumentException>(() =>
            new SqlCompilationOptions(
                TestProfiles.PostgreSql17,
                AtomicityRequirement.None,
                null,
                DatabaseStorageContract.Native(TestProfiles.MySql80)));
    }

    [Fact]
    public void Storage_contract_copies_sorts_and_rejects_duplicate_column_keys()
    {
        var keys = new List<string>
        {
            "app.users.name",
            "app.people.display_name"
        };
        var contract = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            keys);
        keys.Clear();

        Assert.Equal(
            new[] { "app.people.display_name", "app.users.name" },
            contract.EncodedColumnKeys);
        Assert.Throws<ArgumentException>(() =>
            new DatabaseStorageContract(
                1,
                LogicalTextEncoding.NonEmptyEnvelopeV1,
                CatalogFingerprint,
                TestProfiles.Oracle19c.Fingerprint,
                new[] { "app.users.name", "app.users.name" }));
        Assert.Throws<NotSupportedException>(() =>
            ((IList<string>)contract.EncodedColumnKeys).Add("app.users.bio"));
    }

    [Fact]
    public void Storage_fingerprint_is_order_independent_but_covers_every_field()
    {
        var first = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            new[] { "app.users.name", "app.users.bio" });
        var reordered = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            new[] { "app.users.bio", "app.users.name" });
        var differentCatalog = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            Fingerprint('4'),
            TestProfiles.Oracle19c.Fingerprint,
            first.EncodedColumnKeys);
        var differentVersion = new DatabaseStorageContract(
            2,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            first.EncodedColumnKeys);
        var differentProfile = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Dm8.Fingerprint,
            first.EncodedColumnKeys);
        var differentColumns = new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            new[] { "app.users.name" });

        Assert.Equal(first.Fingerprint, reordered.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentCatalog.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentVersion.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentProfile.Fingerprint);
        Assert.NotEqual(first.Fingerprint, differentColumns.Fingerprint);
    }

    [Fact]
    public void Storage_contract_rejects_invalid_or_inconsistent_values()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseStorageContract(
                0,
                LogicalTextEncoding.Native,
                CatalogFingerprint,
                TestProfiles.PostgreSql17.Fingerprint,
                Array.Empty<string>()));
        Assert.Throws<ArgumentException>(() =>
            new DatabaseStorageContract(
                1,
                LogicalTextEncoding.Native,
                CatalogFingerprint,
                TestProfiles.PostgreSql17.Fingerprint,
                new[] { "app.users.name" }));
        Assert.Throws<ArgumentException>(() =>
            new DatabaseStorageContract(
                1,
                LogicalTextEncoding.NonEmptyEnvelopeV1,
                CatalogFingerprint,
                TestProfiles.Oracle19c.Fingerprint,
                new[] { " " }));
    }

    [Fact]
    public void Pending_import_binding_is_cycle_free_and_covers_only_stable_inputs()
    {
        var pending = Pending();
        var equivalent = Pending();
        var differentCompiler = new PendingImportStorageContract(
            new ResourceContentDigest(new string('a', 64)),
            TestProfiles.Oracle19c,
            LogicalSchemaFingerprint,
            ActiveContractFingerprint,
            "dosorm-sql-compiler-v2");
        var differentSource = new PendingImportStorageContract(
            new ResourceContentDigest(new string('b', 64)),
            TestProfiles.Oracle19c,
            LogicalSchemaFingerprint,
            ActiveContractFingerprint,
            "dosorm-sql-compiler-v1");
        var differentProfile = new PendingImportStorageContract(
            new ResourceContentDigest(new string('a', 64)),
            TestProfiles.Dm8,
            LogicalSchemaFingerprint,
            ActiveContractFingerprint,
            "dosorm-sql-compiler-v1");
        var differentSchema = new PendingImportStorageContract(
            new ResourceContentDigest(new string('a', 64)),
            TestProfiles.Oracle19c,
            Fingerprint('4'),
            ActiveContractFingerprint,
            "dosorm-sql-compiler-v1");
        var differentActive = new PendingImportStorageContract(
            new ResourceContentDigest(new string('a', 64)),
            TestProfiles.Oracle19c,
            LogicalSchemaFingerprint,
            Fingerprint('5'),
            "dosorm-sql-compiler-v1");

        Assert.Equal(DatabaseStorageContractState.PendingImport, pending.State);
        Assert.Equal(pending.ImportBindingFingerprint,
            equivalent.ImportBindingFingerprint);
        Assert.NotEqual(pending.ImportBindingFingerprint,
            differentCompiler.ImportBindingFingerprint);
        Assert.NotEqual(pending.ImportBindingFingerprint,
            differentSource.ImportBindingFingerprint);
        Assert.NotEqual(pending.ImportBindingFingerprint,
            differentProfile.ImportBindingFingerprint);
        Assert.NotEqual(pending.ImportBindingFingerprint,
            differentSchema.ImportBindingFingerprint);
        Assert.NotEqual(pending.ImportBindingFingerprint,
            differentActive.ImportBindingFingerprint);
        Assert.Equal(new string('a', 64), pending.SourceContentDigest.Value);
        Assert.Equal(TestProfiles.Oracle19c.Fingerprint,
            pending.TargetProfile.Fingerprint);
        Assert.Equal(LogicalSchemaFingerprint,
            pending.ExpectedLogicalSchemaFingerprint);
        Assert.Equal(ActiveContractFingerprint,
            pending.ExpectedActiveContractFingerprint);
        Assert.Equal("dosorm-sql-compiler-v1", pending.CompilerVersion);
    }

    [Fact]
    public void Pending_and_active_fingerprints_are_domain_separated()
    {
        var pending = Pending();
        var active = EnvelopeStorage("app.users.name");

        Assert.NotEqual(
            pending.ImportBindingFingerprint,
            active.Fingerprint);
    }

    [Fact]
    public void Pending_import_contract_contains_only_cycle_free_binding_fields()
    {
        var propertyNames = typeof(PendingImportStorageContract)
            .GetProperties(
                BindingFlags.Instance
                | BindingFlags.Public
                | BindingFlags.NonPublic)
            .Select(property => property.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(
            new[]
            {
                nameof(PendingImportStorageContract.CompilerVersion),
                nameof(PendingImportStorageContract.ExpectedActiveContractFingerprint),
                nameof(PendingImportStorageContract.ExpectedLogicalSchemaFingerprint),
                nameof(PendingImportStorageContract.ImportBindingFingerprint),
                nameof(PendingImportStorageContract.SourceContentDigest),
                nameof(PendingImportStorageContract.State),
                nameof(PendingImportStorageContract.TargetProfile)
            },
            propertyNames);
    }

    [Fact]
    public void Storage_read_result_is_a_closed_absent_pending_active_union()
    {
        var pendingContract = Pending();
        var activeContract = EnvelopeStorage("app.users.name");

        var absent = DatabaseStorageContractReadResult.Absent();
        var pending = DatabaseStorageContractReadResult.FromPendingImport(
            pendingContract);
        var active = DatabaseStorageContractReadResult.FromActive(
            activeContract);

        Assert.True(absent.IsAbsent);
        Assert.Null(absent.State);
        Assert.Null(absent.PendingImportContract);
        Assert.Null(absent.ActiveContract);

        Assert.False(pending.IsAbsent);
        Assert.Equal(DatabaseStorageContractState.PendingImport, pending.State);
        Assert.Same(pendingContract, pending.PendingImportContract);
        Assert.Null(pending.ActiveContract);

        Assert.False(active.IsAbsent);
        Assert.Equal(DatabaseStorageContractState.Active, active.State);
        Assert.Null(active.PendingImportContract);
        Assert.Same(activeContract, active.ActiveContract);
    }

    [Fact]
    public void Storage_contract_types_do_not_expand_the_public_api()
    {
        var publicTypes = typeof(SqlCompilationOptions).Assembly
            .GetExportedTypes()
            .Select(type => type.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.DoesNotContain(nameof(LogicalTextEncoding), publicTypes);
        Assert.DoesNotContain(nameof(SqlValueContract), publicTypes);
        Assert.DoesNotContain(nameof(SqlParameterValueContract), publicTypes);
        Assert.DoesNotContain(nameof(SqlResultValueContract), publicTypes);
        Assert.DoesNotContain(nameof(SqlCommandValueContract), publicTypes);
        Assert.DoesNotContain(nameof(DatabaseStorageContract), publicTypes);
        Assert.DoesNotContain(nameof(PendingImportStorageContract), publicTypes);
        Assert.DoesNotContain(nameof(DatabaseStorageContractReadResult), publicTypes);
    }

    private static SqlParameterValueContract Parameter(
        string name,
        LogicalDbType type,
        int? length = null)
    {
        var encoding = IsEnvelopeText(type)
            ? LogicalTextEncoding.NonEmptyEnvelopeV1
            : LogicalTextEncoding.Native;
        return new SqlParameterValueContract(
            new ParameterDefinition(
                name,
                new SqlTypeDescriptor(type, length)),
            new SqlValueContract(type, length, encoding));
    }

    private static SqlCommandStep CommandWithContract(
        SqlCommandValueContract contract)
    {
        return new SqlCommandStep(
            "SELECT 1",
            Array.Empty<ParameterDefinition>(),
            SqlResultShape.RowSet,
            PlanResultRole.Final,
            PlanConnectionRole.CurrentDatabase,
            PlanTransactionBehavior.Enlistable,
            null,
            contract);
    }

    private static SqlCommandValueContract NativeResultContract(
        DatabaseStorageContract storage,
        int ordinal,
        LogicalDbType logicalType,
        int? length)
    {
        return new SqlCommandValueContract(
            storage,
            Array.Empty<SqlParameterValueContract>(),
            new[]
            {
                new SqlResultValueContract(
                    ordinal,
                    new SqlValueContract(logicalType, length))
            });
    }

    private static DatabaseExecutionPlan Command(
        SqlCommandStep command,
        SelectStatement source,
        SqlCompilationOptions options)
    {
        return DatabaseExecutionPlan.ForStatement(
            source, new[] { command }, options);
    }

    private static SqlResultValueContract Result(
        int ordinal,
        LogicalDbType type,
        int? length = null)
    {
        var encoding = IsEnvelopeText(type)
            ? LogicalTextEncoding.NonEmptyEnvelopeV1
            : LogicalTextEncoding.Native;
        return new SqlResultValueContract(
            ordinal,
            new SqlValueContract(type, length, encoding));
    }

    private static bool IsEnvelopeText(LogicalDbType type)
    {
        return type == LogicalDbType.String;
    }

    private static DatabaseStorageContract EnvelopeStorage(
        params string[] columnKeys)
    {
        return new DatabaseStorageContract(
            1,
            LogicalTextEncoding.NonEmptyEnvelopeV1,
            CatalogFingerprint,
            TestProfiles.Oracle19c.Fingerprint,
            columnKeys);
    }

    private static PendingImportStorageContract Pending()
    {
        return new PendingImportStorageContract(
            new ResourceContentDigest(new string('a', 64)),
            TestProfiles.Oracle19c,
            LogicalSchemaFingerprint,
            ActiveContractFingerprint,
            "dosorm-sql-compiler-v1");
    }

    private static StructuralFingerprint Fingerprint(char value)
    {
        return new StructuralFingerprint("sha256:" + new string(value, 64));
    }
}
