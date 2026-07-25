using System.Collections;
using System.Data;
using System.Globalization;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Text;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class SchemaAndAdminStatementTests
{
    [Fact]
    public void Task6_enum_catalogs_are_exact()
    {
        var catalogs = new Dictionary<Type, string[]>
        {
            [typeof(SemanticDefaultKind)] =
                ["CurrentDate", "CurrentDateTime", "CurrentUtcDateTime", "NewGuid"],
            [typeof(ComputedStorageKind)] = ["Virtual", "Stored"],
            [typeof(ColumnNullability)] = ["Nullable", "NotNullable"],
            [typeof(IndexUniqueness)] = ["NonUnique", "Unique"],
            [typeof(ReferentialAction)] =
                ["NoAction", "Restrict", "Cascade", "SetNull", "SetDefault"],
            [typeof(SequenceCycleBehavior)] = ["NoCycle", "Cycle"],
            [typeof(DestructiveImpact)] =
                ["None", "CompatibilityRisk", "PotentialDataLoss"],
            [typeof(CreateObjectBehavior)] =
                ["FailIfExists", "AlreadySatisfiedIfExists"],
            [typeof(DropObjectBehavior)] =
                ["FailIfMissing", "AlreadySatisfiedIfMissing"],
            [typeof(DropScope)] = ["Restrict", "Cascade"],
            [typeof(MigrationIdempotencyMode)] =
                ["RequireChange", "AcceptAlreadySatisfied"],
            [typeof(MigrationStepOutcome)] =
            [
                "Applied", "AlreadySatisfied", "PreconditionFailed",
                "BlockedDestructive", "Unsupported", "Failed"
            ],
            [typeof(MetadataLookupStatus)] = ["Found", "NotFound"],
            [typeof(MetadataCollectionStatus)] = ["Found", "TargetNotFound"],
            [typeof(DatabaseDiagnosticKind)] =
                ["Information", "Health", "Permissions"],
            [typeof(DatabaseDiagnosticStatus)] = ["Healthy", "Warning", "Failed"],
            [typeof(DiagnosticSeverity)] = ["Information", "Warning", "Error"],
            [typeof(DatabaseTransferFormat)] =
                ["PortableJson", "DelimitedText", "ProviderNative"],
            [typeof(DatabaseTransferScope)] =
                ["SchemaAndData", "SchemaOnly", "DataOnly"],
            [typeof(DatabaseImportConflictPolicy)] =
                ["FailOnConflict", "SkipExisting", "ReplaceTargetDatabase"],
            [typeof(AdminOperationKind)] = ["DropDatabase", "ReplaceImport"],
            [typeof(DatabaseAdminOutcome)] =
                ["Applied", "AlreadySatisfied", "BlockedDestructive", "Unsupported", "Failed"]
        };

        Assert.All(catalogs, catalog =>
            Assert.Equal(catalog.Value, Enum.GetNames(catalog.Key)));
    }

    [Fact]
    public void Public_constructor_shapes_are_exact_and_unambiguous()
    {
        var constructors = new Dictionary<Type, Type[]>
        {
            [typeof(SchemaComment)] = [typeof(string)],
            [typeof(MigrationPlanId)] = [typeof(string)],
            [typeof(MigrationStepId)] = [typeof(string)],
            [typeof(ApprovalReference)] = [typeof(string)],
            [typeof(SchemaToken)] = [typeof(string)],
            [typeof(DiagnosticCode)] = [typeof(string)],
            [typeof(ExpectedStructuralFingerprint)] = [typeof(string)],
            [typeof(ResourceContentDigest)] = [typeof(string)],
            [typeof(DatabaseResourceHandle)] =
                [typeof(Guid), typeof(ResourceContentDigest)],
            [typeof(NullDefaultDefinition)] = [],
            [typeof(BooleanDefaultDefinition)] = [typeof(bool)],
            [typeof(Int64DefaultDefinition)] = [typeof(long)],
            [typeof(DecimalDefaultDefinition)] = [typeof(decimal)],
            [typeof(StringDefaultDefinition)] = [typeof(string)],
            [typeof(GuidDefaultDefinition)] = [typeof(Guid)],
            [typeof(DateTimeDefaultDefinition)] = [typeof(DateTime)],
            [typeof(DateTimeOffsetDefaultDefinition)] = [typeof(DateTimeOffset)],
            [typeof(SemanticDefaultDefinition)] = [typeof(SemanticDefaultKind)],
            [typeof(IdentityGenerationDefinition)] = [typeof(long), typeof(long)],
            [typeof(SequenceGenerationDefinition)] = [typeof(SqlObjectName)],
            [typeof(ComputedGenerationDefinition)] =
                [typeof(SqlExpression), typeof(ComputedStorageKind)],
            [typeof(ColumnDefinition)] =
            [
                typeof(SqlIdentifier), typeof(SqlTypeDescriptor),
                typeof(ColumnNullability), typeof(ColumnGenerationDefinition),
                typeof(ColumnDefaultDefinition), typeof(SchemaComment)
            ],
            [typeof(SchemaName)] = [typeof(SqlIdentifier), typeof(SqlIdentifier)],
            [typeof(IndexColumnDefinition)] =
                [typeof(SqlIdentifier), typeof(SqlSortDirection)],
            [typeof(IndexDefinition)] =
            [
                typeof(SqlIdentifier), typeof(IEnumerable<IndexColumnDefinition>),
                typeof(IndexUniqueness)
            ],
            [typeof(PrimaryKeyDefinition)] =
                [typeof(SqlIdentifier), typeof(IEnumerable<SqlIdentifier>)],
            [typeof(UniqueConstraintDefinition)] =
                [typeof(SqlIdentifier), typeof(IEnumerable<SqlIdentifier>)],
            [typeof(ForeignKeyColumnSet)] =
            [
                typeof(IEnumerable<SqlIdentifier>),
                typeof(IEnumerable<SqlIdentifier>)
            ],
            [typeof(ReferentialActions)] =
                [typeof(ReferentialAction), typeof(ReferentialAction)],
            [typeof(ForeignKeyDefinition)] =
            [
                typeof(SqlIdentifier), typeof(SqlObjectName),
                typeof(ForeignKeyColumnSet), typeof(ReferentialActions)
            ],
            [typeof(TableDefinition)] =
            [
                typeof(SqlObjectName), typeof(IEnumerable<ColumnDefinition>),
                typeof(IEnumerable<ConstraintDefinition>),
                typeof(IEnumerable<IndexDefinition>), typeof(SchemaComment)
            ],
            [typeof(SequenceOptions)] =
            [
                typeof(long), typeof(long), typeof(SequenceBounds),
                typeof(int?), typeof(SequenceCycleBehavior)
            ],
            [typeof(SequenceDefinition)] =
                [typeof(SqlObjectName), typeof(LogicalDbType), typeof(SequenceOptions)],
            [typeof(CreateSchemaOperation)] =
                [typeof(SchemaName), typeof(CreateObjectBehavior)],
            [typeof(DropSchemaOperation)] =
                [typeof(SchemaName), typeof(DropObjectBehavior), typeof(DropScope)],
            [typeof(CreateTableOperation)] =
                [typeof(TableDefinition), typeof(CreateObjectBehavior)],
            [typeof(RenameTableOperation)] =
                [typeof(SqlObjectName), typeof(SqlObjectName)],
            [typeof(DropTableOperation)] =
                [typeof(SqlObjectName), typeof(DropObjectBehavior), typeof(DropScope)],
            [typeof(AddColumnOperation)] =
                [typeof(SqlObjectName), typeof(ColumnDefinition)],
            [typeof(AlterColumnOperation)] =
            [
                typeof(SqlObjectName), typeof(ColumnDefinition),
                typeof(ColumnDefinition)
            ],
            [typeof(RenameColumnOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier), typeof(SqlIdentifier)],
            [typeof(DropColumnOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier), typeof(DropObjectBehavior)],
            [typeof(AddConstraintOperation)] =
                [typeof(SqlObjectName), typeof(ConstraintDefinition)],
            [typeof(DropConstraintOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier), typeof(DropObjectBehavior)],
            [typeof(CreateIndexOperation)] =
            [
                typeof(SqlObjectName), typeof(IndexDefinition),
                typeof(CreateObjectBehavior)
            ],
            [typeof(DropIndexOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier), typeof(DropObjectBehavior)],
            [typeof(CreateSequenceOperation)] =
                [typeof(SequenceDefinition), typeof(CreateObjectBehavior)],
            [typeof(AlterSequenceOperation)] =
                [typeof(SequenceDefinition), typeof(SequenceDefinition)],
            [typeof(DropSequenceOperation)] =
                [typeof(SqlObjectName), typeof(DropObjectBehavior)],
            [typeof(SetTableCommentOperation)] =
                [typeof(SqlObjectName), typeof(SchemaComment)],
            [typeof(RemoveTableCommentOperation)] = [typeof(SqlObjectName)],
            [typeof(SetColumnCommentOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier), typeof(SchemaComment)],
            [typeof(RemoveColumnCommentOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier)],
            [typeof(MigrationStep)] =
                [typeof(MigrationStepId), typeof(SchemaOperation), typeof(MigrationIdempotencyMode)],
            [typeof(MigrationPlan)] =
            [
                typeof(MigrationPlanId), typeof(IEnumerable<MigrationStep>),
                typeof(ExpectedStructuralFingerprint)
            ],
            [typeof(DatabaseOperationDiagnostic)] =
                [typeof(DiagnosticCode), typeof(string)],
            [typeof(MigrationStepResult)] =
                [typeof(MigrationStepId), typeof(MigrationStepOutcome), typeof(DatabaseOperationDiagnostic)],
            [typeof(MigrationResult)] =
                [typeof(MigrationPlan), typeof(IEnumerable<MigrationStepResult>)],
            [typeof(ListTablesOperation)] = [typeof(SchemaScope)],
            [typeof(GetTableMetadataOperation)] = [typeof(SqlObjectName)],
            [typeof(ListColumnsOperation)] = [typeof(SqlObjectName)],
            [typeof(GetColumnMetadataOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier)],
            [typeof(ListIndexesOperation)] = [typeof(SqlObjectName)],
            [typeof(GetIndexMetadataOperation)] =
                [typeof(SqlObjectName), typeof(SqlIdentifier)],
            [typeof(ColumnMetadata)] =
                [typeof(SqlObjectName), typeof(ColumnDefinition), typeof(int)],
            [typeof(IndexMetadata)] =
                [typeof(SqlObjectName), typeof(IndexDefinition)],
            [typeof(TableMetadata)] = [typeof(TableDefinition)],
            [typeof(TableMetadataCollectionResult)] =
            [
                typeof(MetadataCollectionStatus), typeof(SchemaToken),
                typeof(IEnumerable<TableMetadata>)
            ],
            [typeof(ColumnMetadataCollectionResult)] =
            [
                typeof(MetadataCollectionStatus), typeof(SchemaToken),
                typeof(IEnumerable<ColumnMetadata>)
            ],
            [typeof(IndexMetadataCollectionResult)] =
            [
                typeof(MetadataCollectionStatus), typeof(SchemaToken),
                typeof(IEnumerable<IndexMetadata>)
            ],
            [typeof(SchemaMetadataSnapshot)] =
                [typeof(SchemaToken), typeof(IEnumerable<TableMetadata>)],
            [typeof(DatabaseDiagnosticOperation)] = [typeof(DatabaseDiagnosticKind)],
            [typeof(DatabaseDiagnosticResult)] =
            [
                typeof(DiagnosticCode), typeof(DatabaseDiagnosticStatus),
                typeof(DiagnosticSeverity), typeof(string)
            ],
            [typeof(CreateDatabaseOperation)] =
                [typeof(SqlIdentifier), typeof(CreateObjectBehavior)],
            [typeof(DropDatabaseOperation)] =
            [
                typeof(SqlIdentifier), typeof(DropObjectBehavior),
                typeof(ExpectedStructuralFingerprint)
            ],
            [typeof(DatabaseExportOperation)] =
            [
                typeof(SqlIdentifier), typeof(DatabaseResourceHandle),
                typeof(DatabaseTransferFormat), typeof(DatabaseTransferScope)
            ],
            [typeof(DatabaseImportOperation)] =
            [
                typeof(SqlIdentifier), typeof(DatabaseResourceHandle),
                typeof(DatabaseTransferFormat), typeof(DatabaseTransferScope),
                typeof(DatabaseImportConflictPolicy),
                typeof(ExpectedStructuralFingerprint)
            ],
            [typeof(DatabaseAdminResult)] =
            [
                typeof(DatabaseAdminOperation), typeof(DatabaseAdminOutcome),
                typeof(DatabaseOperationDiagnostic)
            ]
        };

        Assert.All(constructors, entry =>
        {
            var constructor = Assert.Single(entry.Key.GetConstructors());
            Assert.Equal(
                entry.Value,
                constructor.GetParameters()
                    .Select(parameter => parameter.ParameterType));
        });

        Assert.Empty(typeof(StructuralFingerprint).GetConstructors());
        Assert.Empty(typeof(SchemaScope).GetConstructors());
        Assert.Empty(typeof(SequenceBounds).GetConstructors());
        Assert.Empty(typeof(DestructiveMigrationApproval).GetConstructors());
        Assert.Empty(typeof(AdminTargetApproval).GetConstructors());
        Assert.Empty(typeof(MetadataLookupResult<TableMetadata>).GetConstructors());
    }

    [Fact]
    public void Narrow_text_and_fingerprint_values_validate_shape_and_equality()
    {
        AssertValueObject(() => new SchemaComment("comment"), value => value.Text);
        AssertValueObject(() => new MigrationPlanId("plan"), value => value.Value);
        AssertValueObject(() => new MigrationStepId("step"), value => value.Value);
        AssertValueObject(() => new ApprovalReference("audit-1"), value => value.Value);
        AssertValueObject(() => new SchemaToken("schema-v1"), value => value.Value);
        AssertValueObject(() => new DiagnosticCode("DB-001"), value => value.Value);

        Assert.Throws<ArgumentNullException>(() => new SchemaComment(null!));
        Assert.Throws<ArgumentException>(() => new MigrationPlanId(" "));
        Assert.Throws<ArgumentException>(() => new MigrationStepId(""));
        Assert.Throws<ArgumentException>(() => new ApprovalReference("\t"));
        Assert.Throws<ArgumentException>(() => new SchemaToken(" "));
        Assert.Throws<ArgumentException>(() => new DiagnosticCode(" "));

        var fingerprintText = "sha256:" + new string('a', 64);
        Assert.Equal(
            fingerprintText,
            new ExpectedStructuralFingerprint(fingerprintText).Value);
        Assert.Throws<ArgumentException>(() =>
            new ExpectedStructuralFingerprint(new string('a', 64)));
        Assert.Throws<ArgumentException>(() =>
            new ExpectedStructuralFingerprint("sha256:" + new string('A', 64)));

        var digest = new ResourceContentDigest(new string('b', 64));
        Assert.Equal(new string('b', 64), digest.Value);
        Assert.Throws<ArgumentException>(() =>
            new ResourceContentDigest("sha256:" + new string('b', 64)));
        Assert.Throws<ArgumentException>(() =>
            new ResourceContentDigest(new string('B', 64)));

        var id = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var handle = new DatabaseResourceHandle(id, digest);
        Assert.Equal(id, handle.Id);
        Assert.Same(digest, handle.ContentDigest);
        Assert.Throws<ArgumentException>(() =>
            new DatabaseResourceHandle(Guid.Empty, digest));
        Assert.Throws<ArgumentNullException>(() =>
            new DatabaseResourceHandle(id, null!));
    }

    [Fact]
    public void Default_definitions_are_closed_typed_and_structurally_equal()
    {
        var guid = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var dateTime = new DateTime(638712864000000000L, DateTimeKind.Utc);
        var dateTimeOffset = new DateTimeOffset(
            638712864000000000L, TimeSpan.FromHours(8));

        var defaults = new ColumnDefaultDefinition[]
        {
            new NullDefaultDefinition(),
            new BooleanDefaultDefinition(true),
            new Int64DefaultDefinition(-42),
            new DecimalDefaultDefinition(1234.5600m),
            new StringDefaultDefinition(string.Empty),
            new GuidDefaultDefinition(guid),
            new DateTimeDefaultDefinition(dateTime),
            new DateTimeOffsetDefaultDefinition(dateTimeOffset),
            new SemanticDefaultDefinition(SemanticDefaultKind.CurrentUtcDateTime)
        };

        Assert.IsType<NullDefaultDefinition>(defaults[0]);
        Assert.True(((BooleanDefaultDefinition)defaults[1]).Value);
        Assert.Equal(-42, ((Int64DefaultDefinition)defaults[2]).Value);
        Assert.Equal(1234.5600m, ((DecimalDefaultDefinition)defaults[3]).Value);
        Assert.Equal(string.Empty, ((StringDefaultDefinition)defaults[4]).Value);
        Assert.Equal(guid, ((GuidDefaultDefinition)defaults[5]).Value);
        Assert.Equal(dateTime, ((DateTimeDefaultDefinition)defaults[6]).Value);
        Assert.Equal(
            dateTimeOffset,
            ((DateTimeOffsetDefaultDefinition)defaults[7]).Value);
        Assert.Equal(
            SemanticDefaultKind.CurrentUtcDateTime,
            ((SemanticDefaultDefinition)defaults[8]).Kind);

        AssertEqualAndHash(
            new DecimalDefaultDefinition(1234.5600m),
            new DecimalDefaultDefinition(1234.5600m));
        AssertEqualAndHash(
            new DateTimeOffsetDefaultDefinition(dateTimeOffset),
            new DateTimeOffsetDefaultDefinition(dateTimeOffset));
        Assert.NotEqual(
            new Int64DefaultDefinition(1),
            new Int64DefaultDefinition(2));
        Assert.Throws<ArgumentNullException>(() =>
            new StringDefaultDefinition(null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SemanticDefaultDefinition((SemanticDefaultKind)(-1)));
    }

    [Fact]
    public void Generation_and_column_invariants_are_fail_closed()
    {
        var identity = new IdentityGenerationDefinition(1, 2);
        var sequenceName = ObjectName("UserSequence", "app");
        var sequence = new SequenceGenerationDefinition(sequenceName);
        var computed = new ComputedGenerationDefinition(
            new BinaryExpression(
                ColumnExpression("Price"),
                SqlBinaryOperator.Multiply,
                ColumnExpression("Quantity")),
            ComputedStorageKind.Stored);

        Assert.Equal(1, identity.Seed);
        Assert.Equal(2, identity.Increment);
        Assert.Same(sequenceName, sequence.Sequence);
        Assert.Equal(ComputedStorageKind.Stored, computed.Storage);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new IdentityGenerationDefinition(1, 0));
        Assert.Throws<ArgumentNullException>(() =>
            new SequenceGenerationDefinition(null!));
        Assert.Throws<ArgumentNullException>(() =>
            new ComputedGenerationDefinition(null!, ComputedStorageKind.Virtual));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ComputedGenerationDefinition(
                BooleanExpression.True, (ComputedStorageKind)(-1)));
        Assert.Throws<ArgumentException>(() =>
            new ComputedGenerationDefinition(
                new UnknownExpression(), ComputedStorageKind.Virtual));
        Assert.Throws<ArgumentException>(() =>
            new ComputedGenerationDefinition(
                new SubqueryExpression(new UnknownQueryNode()),
                ComputedStorageKind.Virtual));
        Assert.Throws<ArgumentException>(() =>
            new ComputedGenerationDefinition(
                new SubqueryExpression(new SelectStatement(
                    new UnknownTableSource(),
                    new[] { new SelectProjection(BooleanExpression.True) })),
                ComputedStorageKind.Virtual));

        var id = Column(
            "Id", LogicalDbType.Int16,
            generation: new IdentityGenerationDefinition(short.MaxValue, 1));
        Assert.Same(identity.GetType(), id.Generation.GetType());
        Assert.Throws<ArgumentException>(() =>
            Column(
                "Id", LogicalDbType.String,
                generation: new IdentityGenerationDefinition(1, 1)));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Column(
                "Id", LogicalDbType.Int16,
                generation: new IdentityGenerationDefinition(
                    (long)short.MaxValue + 1, 1)));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Column(
                "Id", LogicalDbType.Int16,
                generation: new IdentityGenerationDefinition(
                    1, (long)short.MinValue - 1)));
        Assert.Throws<ArgumentException>(() =>
            Column(
                "Id", LogicalDbType.Int32,
                generation: new SequenceGenerationDefinition(sequenceName),
                defaultValue: new Int64DefaultDefinition(1)));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ColumnDefinition(
                Id("Id"), Type(LogicalDbType.Int32),
                (ColumnNullability)(-1)));
        Assert.Throws<ArgumentNullException>(() =>
            new ColumnDefinition(
                null!, Type(LogicalDbType.Int32), ColumnNullability.Nullable));
        Assert.Throws<ArgumentNullException>(() =>
            new ColumnDefinition(
                Id("Id"), null!, ColumnNullability.Nullable));
        Assert.Throws<ArgumentException>(() =>
            new ColumnDefinition(
                Id("Id"), Type(LogicalDbType.Int32),
                ColumnNullability.Nullable,
                generation: new UnknownGenerationDefinition()));
        Assert.Throws<ArgumentException>(() =>
            new ColumnDefinition(
                Id("Id"), Type(LogicalDbType.Int32),
                ColumnNullability.Nullable,
                defaultValue: new UnknownDefaultDefinition()));
    }

    [Fact]
    public void Known_expression_and_query_catalog_is_accepted_for_computed_columns()
    {
        var definition = new ParameterDefinition(
            "p0", Type(LogicalDbType.Int32));
        var named = new NamedTableSource(ObjectName("Orders"), new SqlAlias("o"));
        var select = new SelectStatement(
            named,
            new[]
            {
                new SelectProjection(new WildcardExpression(new SqlAlias("o")))
            },
            distinct: true,
            whereExpression: new ExistsExpression(new SubqueryExpression(
                new SelectStatement(new[]
                {
                    new SelectProjection(BooleanExpression.True)
                }))),
            groupBy: new SqlExpression[] { ColumnExpression("Status", "o") },
            havingExpression: new BinaryExpression(
                new AggregateExpression(SemanticFunctions.Count),
                SqlBinaryOperator.GreaterThan,
                new ParameterExpression(definition)),
            orderBy: new[]
            {
                new OrderByExpression(
                    ColumnExpression("Id", "o"),
                    SqlSortDirection.Descending,
                    SqlNullSortOrder.Last)
            },
            page: new OffsetPageSpec(5, 10),
            lockSpec: new LockSpec(SqlLockMode.Update, SqlLockWait.NoWait),
            commonTableExpressions: new[]
            {
                new CommonTableExpression(
                    Id("Recent"),
                    new SelectStatement(new[]
                    {
                        new SelectProjection(BooleanExpression.False)
                    }),
                    new[] { Id("Flag") },
                    recursive: true)
            },
            setOperations: new[]
            {
                new SetOperationClause(
                    SqlSetOperator.UnionAll,
                    new SelectStatement(new[]
                    {
                        new SelectProjection(NullExpression.Instance)
                    }))
            });

        var expressions = new SqlExpression[]
        {
            ColumnExpression("Id"),
            new ParameterExpression(definition),
            NullExpression.Instance,
            BooleanExpression.False,
            new BinaryExpression(
                BooleanExpression.True, SqlBinaryOperator.And,
                BooleanExpression.False),
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True),
            new InExpression(
                ColumnExpression("Id"),
                new SqlExpression[] { new ParameterExpression(definition) }),
            new BetweenExpression(
                ColumnExpression("Id"), NullExpression.Instance,
                new ParameterExpression(definition)),
            new CaseExpression(
                new[]
                {
                    new CaseWhenClause(BooleanExpression.True, NullExpression.Instance)
                },
                BooleanExpression.False),
            new CaseExpression(
                ColumnExpression("Status"),
                new[]
                {
                    new CaseWhenClause(BooleanExpression.True, NullExpression.Instance)
                }),
            new CastExpression(ColumnExpression("Id"), Type(LogicalDbType.Int64)),
            new SubqueryExpression(select),
            new ExistsExpression(new SubqueryExpression(select)),
            new AggregateExpression(
                SemanticFunctions.Sum, ColumnExpression("Amount"), distinct: true),
            new FunctionExpression(
                SemanticFunctions.Coalesce,
                new SqlExpression[] { ColumnExpression("Name"), NullExpression.Instance }),
            new WildcardExpression()
        };

        Assert.All(expressions, expression =>
            Assert.Same(
                expression,
                new ComputedGenerationDefinition(
                    expression, ComputedStorageKind.Virtual).Expression));

        var keyset = new SelectStatement(
            new DerivedTableSource(select, new SqlAlias("d")),
            new[] { new SelectProjection(ColumnExpression("Id", "d")) },
            orderBy: new[] { new OrderByExpression(ColumnExpression("Id", "d")) },
            page: new KeysetPageSpec(
                new SqlExpression[] { new ParameterExpression(definition) }, 10),
            lockSpec: new LockSpec(SqlLockMode.Share, SqlLockWait.SkipLocked));
        var joined = new SelectStatement(
            new JoinSource(
                new NamedTableSource(ObjectName("A")),
                SqlJoinType.Left,
                new DerivedTableSource(keyset, new SqlAlias("k")),
                BooleanExpression.True),
            new[] { new SelectProjection(BooleanExpression.True) });
        Assert.NotNull(new ComputedGenerationDefinition(
            new SubqueryExpression(joined), ComputedStorageKind.Stored));
    }

    [Fact]
    public void Computed_expression_depth_budget_accepts_boundary_and_rejects_next_depth()
    {
        const int maximumDepth = 128;
        var accepted = new ComputedGenerationDefinition(
            UnaryChain(maximumDepth), ComputedStorageKind.Virtual);
        var equivalent = new ComputedGenerationDefinition(
            UnaryChain(maximumDepth), ComputedStorageKind.Virtual);

        AssertEqualAndHash(accepted, equivalent);
        Assert.StartsWith("sha256:", FingerprintForComputed(accepted.Expression));

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ComputedGenerationDefinition(
                UnaryChain(maximumDepth + 1),
                ComputedStorageKind.Virtual));
        Assert.Equal("expression", exception.ParamName);
        Assert.DoesNotContain(nameof(UnaryExpression), exception.Message);
    }

    [Fact]
    public void Computed_expression_occurrence_budget_counts_shared_dag_expansion()
    {
        var accepted = SharedBinaryDag(11);
        var generation = new ComputedGenerationDefinition(
            accepted, ComputedStorageKind.Virtual);
        var equivalent = new ComputedGenerationDefinition(
            SharedBinaryDag(11), ComputedStorageKind.Virtual);

        AssertEqualAndHash(generation, equivalent);
        Assert.StartsWith("sha256:", FingerprintForComputed(accepted));

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ComputedGenerationDefinition(
                SharedBinaryDag(12), ComputedStorageKind.Virtual));
        Assert.Equal("expression", exception.ParamName);
        Assert.DoesNotContain(nameof(BinaryExpression), exception.Message);
    }

    [Fact]
    public void Computed_expression_occurrence_budget_accepts_exact_boundary()
    {
        const int maximumOccurrences = 4096;
        var accepted = new InExpression(
            BooleanExpression.True,
            Enumerable.Repeat<SqlExpression>(
                BooleanExpression.False,
                maximumOccurrences - 2));

        Assert.StartsWith("sha256:", FingerprintForComputed(accepted));

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ComputedGenerationDefinition(
                new InExpression(
                    BooleanExpression.True,
                    Enumerable.Repeat<SqlExpression>(
                        BooleanExpression.False,
                        maximumOccurrences - 1)),
                ComputedStorageKind.Virtual));
        Assert.Equal("expression", exception.ParamName);
        Assert.DoesNotContain(nameof(InExpression), exception.Message);
    }

    [Fact]
    public void Fingerprint_rechecks_computed_expression_budget_before_encoding()
    {
        var computed = (ComputedGenerationDefinition)
            RuntimeHelpers.GetUninitializedObject(
                typeof(ComputedGenerationDefinition));
        SetAutoProperty(
            computed,
            nameof(ComputedGenerationDefinition.Expression),
            UnaryChain(129));
        SetAutoProperty(
            computed,
            nameof(ComputedGenerationDefinition.Storage),
            ComputedStorageKind.Virtual);

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            FingerprintForGeneration(computed));
        Assert.Equal("Expression", exception.ParamName);
        Assert.DoesNotContain(nameof(UnaryExpression), exception.Message);
    }

    [Fact]
    public void Schema_scope_has_only_named_unambiguous_factories()
    {
        var all = SchemaScope.All();
        var schema = SchemaScope.ForSchema(Id("app"));
        var catalogSchema = SchemaScope.ForCatalogAndSchema(
            Id("catalog"), Id("app"));

        Assert.Null(all.Catalog);
        Assert.Null(all.Schema);
        Assert.Null(schema.Catalog);
        Assert.Equal(Id("app"), schema.Schema);
        Assert.Equal(Id("catalog"), catalogSchema.Catalog);
        Assert.Equal(Id("app"), catalogSchema.Schema);
        Assert.Throws<ArgumentNullException>(() => SchemaScope.ForSchema(null!));
        Assert.Throws<ArgumentNullException>(() =>
            SchemaScope.ForCatalogAndSchema(null!, Id("app")));
        Assert.Throws<ArgumentNullException>(() =>
            SchemaScope.ForCatalogAndSchema(Id("catalog"), null!));

        Assert.Equal(
            new[] { "All", "ForCatalogAndSchema", "ForSchema" },
            typeof(SchemaScope)
                .GetMethods(BindingFlags.Public | BindingFlags.Static |
                            BindingFlags.DeclaredOnly)
                .Where(method => method.ReturnType == typeof(SchemaScope))
                .Select(method => method.Name)
                .OrderBy(name => name, StringComparer.Ordinal));
    }

    [Fact]
    public void Index_constraint_and_table_definitions_enforce_ordered_unique_copies()
    {
        var indexColumns = new List<IndexColumnDefinition>
        {
            new IndexColumnDefinition(Id("Name"), SqlSortDirection.Ascending),
            new IndexColumnDefinition(Id("CreatedAt"), SqlSortDirection.Descending)
        };
        var index = new IndexDefinition(
            Id("IX_User_Name"), indexColumns, IndexUniqueness.Unique);
        indexColumns.Clear();
        Assert.Equal(new[] { "Name", "CreatedAt" },
            index.Columns.Select(item => item.Column.Value));
        Assert.Throws<NotSupportedException>(() =>
            ((IList<IndexColumnDefinition>)index.Columns).Add(
                new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending)));
        Assert.Throws<ArgumentException>(() => new IndexDefinition(
            Id("IX"),
            new[]
            {
                new IndexColumnDefinition(Id("Name"), SqlSortDirection.Ascending),
                new IndexColumnDefinition(Id("Name"), SqlSortDirection.Descending)
            },
            IndexUniqueness.NonUnique));
        Assert.Throws<ArgumentException>(() => new IndexDefinition(
            Id("IX"), Array.Empty<IndexColumnDefinition>(),
            IndexUniqueness.NonUnique));

        var primary = new PrimaryKeyDefinition(
            Id("PK_User"), new[] { Id("TenantId"), Id("Id") });
        var unique = new UniqueConstraintDefinition(
            Id("UQ_User_Account"), new[] { Id("TenantId"), Id("Account") });
        Assert.Equal(new[] { "TenantId", "Id" },
            primary.Columns.Select(item => item.Value));
        Assert.Equal(new[] { "TenantId", "Account" },
            unique.Columns.Select(item => item.Value));
        Assert.Throws<ArgumentException>(() =>
            new PrimaryKeyDefinition(Id("PK"), Array.Empty<SqlIdentifier>()));
        Assert.Throws<ArgumentException>(() => new PrimaryKeyDefinition(
            Id("PK"), new[] { Id("Id"), Id("Id") }));
        Assert.Throws<ArgumentException>(() =>
            new UniqueConstraintDefinition(
                Id("UQ"), Array.Empty<SqlIdentifier>()));
        Assert.Throws<ArgumentException>(() => new UniqueConstraintDefinition(
            Id("UQ"), new[] { Id("Id"), Id("Id") }));

        var columnSet = new ForeignKeyColumnSet(
            new[] { Id("TenantId"), Id("RoleId") },
            new[] { Id("TenantId"), Id("Id") });
        var actions = new ReferentialActions(
            ReferentialAction.Cascade, ReferentialAction.Restrict);
        var foreignKey = new ForeignKeyDefinition(
            Id("FK_User_Role"), ObjectName("Role", "app"), columnSet, actions);
        Assert.Same(columnSet, foreignKey.Columns);
        Assert.Same(actions, foreignKey.Actions);
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new[] { Id("RoleId") }, new[] { Id("TenantId"), Id("Id") }));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new[] { Id("RoleId"), Id("RoleId") },
            new[] { Id("TenantId"), Id("Id") }));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new[] { Id("TenantId"), Id("RoleId") },
            new[] { Id("Id"), Id("Id") }));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            Array.Empty<SqlIdentifier>(), Array.Empty<SqlIdentifier>()));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            Array.Empty<SqlIdentifier>(), new[] { Id("Id") }));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new[] { Id("RoleId") }, Array.Empty<SqlIdentifier>()));

        var columns = new List<ColumnDefinition>
        {
            Column("Id", LogicalDbType.Int64, ColumnNullability.NotNullable),
            Column("Name", LogicalDbType.String)
        };
        var constraints = new List<ConstraintDefinition> { primary, unique, foreignKey };
        var indexes = new List<IndexDefinition> { index };
        var table = new TableDefinition(
            ObjectName("User", "app"), columns, constraints, indexes,
            new SchemaComment("users"));
        columns.Clear();
        constraints.Clear();
        indexes.Clear();
        Assert.Equal(2, table.Columns.Count);
        Assert.Equal(3, table.Constraints.Count);
        Assert.Single(table.Indexes);
        Assert.Equal("users", table.Comment!.Text);
        Assert.Throws<NotSupportedException>(() =>
            ((IList<ColumnDefinition>)table.Columns).Clear());

        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("Empty"), Array.Empty<ColumnDefinition>()));
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("Duplicate"),
            new[] { Column("Id", LogicalDbType.Int32), Column("Id", LogicalDbType.Int64) }));
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("Duplicate"), new[] { Column("Id", LogicalDbType.Int32) },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(Id("Same"), new[] { Id("Id") }),
                new UniqueConstraintDefinition(Id("Same"), new[] { Id("Id") })
            }));
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("Duplicate"), new[] { Column("Id", LogicalDbType.Int32) },
            indexes: new[]
            {
                new IndexDefinition(Id("Same"),
                    new[] { new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending) },
                    IndexUniqueness.NonUnique),
                new IndexDefinition(Id("Same"),
                    new[] { new IndexColumnDefinition(Id("Id"), SqlSortDirection.Descending) },
                    IndexUniqueness.Unique)
            }));

        AssertEqualAndHash(index, new IndexDefinition(
            Id("IX_User_Name"),
            new[]
            {
                new IndexColumnDefinition(Id("Name"), SqlSortDirection.Ascending),
                new IndexColumnDefinition(Id("CreatedAt"), SqlSortDirection.Descending)
            }, IndexUniqueness.Unique));
        AssertEqualAndHash(table, CloneTable(table));
        Assert.NotEqual(table, new TableDefinition(
            table.Name, table.Columns, table.Constraints, table.Indexes,
            new SchemaComment("changed")));
    }

    [Fact]
    public void Sequence_bounds_options_and_types_are_explicit_and_range_checked()
    {
        var unbounded = SequenceBounds.Unbounded();
        var minimum = SequenceBounds.Minimum(-10);
        var maximum = SequenceBounds.Maximum(10);
        var between = SequenceBounds.Between(-10, 10);
        Assert.Null(unbounded.MinimumValue);
        Assert.Null(unbounded.MaximumValue);
        Assert.Equal(-10, minimum.MinimumValue);
        Assert.Null(minimum.MaximumValue);
        Assert.Null(maximum.MinimumValue);
        Assert.Equal(10, maximum.MaximumValue);
        Assert.Equal(-10, between.MinimumValue);
        Assert.Equal(10, between.MaximumValue);
        Assert.Throws<ArgumentException>(() => SequenceBounds.Between(2, 1));
        Assert.Equal(
            new[] { "Between", "Maximum", "Minimum", "Unbounded" },
            typeof(SequenceBounds).GetMethods(
                    BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Where(method => method.ReturnType == typeof(SequenceBounds))
                .Select(method => method.Name)
                .OrderBy(name => name, StringComparer.Ordinal));

        var options = new SequenceOptions(
            1, 2, SequenceBounds.Between(-10, 100), 20,
            SequenceCycleBehavior.Cycle);
        var sequence = new SequenceDefinition(
            ObjectName("OrderNo", "app"), LogicalDbType.Int32, options);
        Assert.Equal(1, sequence.Options.StartValue);
        Assert.Equal(2, sequence.Options.IncrementBy);
        Assert.Equal(20, sequence.Options.CacheSize);
        Assert.Equal(SequenceCycleBehavior.Cycle, sequence.Options.Cycle);
        Assert.Throws<ArgumentOutOfRangeException>(() => new SequenceOptions(
            1, 0, SequenceBounds.Unbounded(), null, SequenceCycleBehavior.NoCycle));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SequenceOptions(
            1, 1, SequenceBounds.Unbounded(), 0, SequenceCycleBehavior.NoCycle));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SequenceOptions(
            11, 1, SequenceBounds.Between(0, 10), null,
            SequenceCycleBehavior.NoCycle));
        Assert.Throws<ArgumentException>(() => new SequenceDefinition(
            ObjectName("Wrong"), LogicalDbType.String, options));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SequenceDefinition(
            ObjectName("TooLarge"), LogicalDbType.Int16,
            new SequenceOptions(
                short.MaxValue, 1,
                SequenceBounds.Maximum((long)short.MaxValue + 1), null,
                SequenceCycleBehavior.NoCycle)));
        AssertEqualAndHash(sequence, new SequenceDefinition(
            ObjectName("OrderNo", "app"), LogicalDbType.Int32,
            new SequenceOptions(
                1, 2, SequenceBounds.Between(-10, 100), 20,
                SequenceCycleBehavior.Cycle)));
    }

    [Fact]
    public void Every_schema_operation_has_exact_neutral_impact_and_get_only_state()
    {
        var table = SampleTable();
        var column = Column("Status", LogicalDbType.Int32);
        var index = new IndexDefinition(
            Id("IX_Status"),
            new[] { new IndexColumnDefinition(Id("Status"), SqlSortDirection.Ascending) },
            IndexUniqueness.NonUnique);
        var constraint = new UniqueConstraintDefinition(
            Id("UQ_Status"), new[] { Id("Status") });
        var sequence = SampleSequence();
        var operations = new Dictionary<SchemaOperation, DestructiveImpact>
        {
            [new CreateSchemaOperation(new SchemaName(Id("app")), CreateObjectBehavior.FailIfExists)] = DestructiveImpact.None,
            [new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing, DropScope.Restrict)] = DestructiveImpact.PotentialDataLoss,
            [new CreateTableOperation(table, CreateObjectBehavior.FailIfExists)] = DestructiveImpact.None,
            [new RenameTableOperation(ObjectName("A"), ObjectName("B"))] = DestructiveImpact.CompatibilityRisk,
            [new DropTableOperation(table.Name, DropObjectBehavior.FailIfMissing, DropScope.Cascade)] = DestructiveImpact.PotentialDataLoss,
            [new AddColumnOperation(table.Name, column)] = DestructiveImpact.None,
            [new AlterColumnOperation(table.Name, column,
                Column("Status", LogicalDbType.Int32, defaultValue: new Int64DefaultDefinition(1)))] = DestructiveImpact.CompatibilityRisk,
            [new RenameColumnOperation(table.Name, Id("A"), Id("B"))] = DestructiveImpact.CompatibilityRisk,
            [new DropColumnOperation(table.Name, Id("Status"), DropObjectBehavior.FailIfMissing)] = DestructiveImpact.PotentialDataLoss,
            [new AddConstraintOperation(table.Name, constraint)] = DestructiveImpact.None,
            [new DropConstraintOperation(table.Name, Id("UQ_Status"), DropObjectBehavior.FailIfMissing)] = DestructiveImpact.CompatibilityRisk,
            [new CreateIndexOperation(table.Name, index, CreateObjectBehavior.FailIfExists)] = DestructiveImpact.None,
            [new DropIndexOperation(table.Name, Id("IX_Status"), DropObjectBehavior.FailIfMissing)] = DestructiveImpact.CompatibilityRisk,
            [new CreateSequenceOperation(sequence, CreateObjectBehavior.FailIfExists)] = DestructiveImpact.None,
            [new AlterSequenceOperation(sequence,
                new SequenceDefinition(sequence.Name, sequence.IntegerType,
                    new SequenceOptions(1, 1, SequenceBounds.Unbounded(), 10,
                        SequenceCycleBehavior.NoCycle)))] = DestructiveImpact.None,
            [new DropSequenceOperation(sequence.Name, DropObjectBehavior.FailIfMissing)] = DestructiveImpact.CompatibilityRisk,
            [new SetTableCommentOperation(table.Name, new SchemaComment("table"))] = DestructiveImpact.None,
            [new RemoveTableCommentOperation(table.Name)] = DestructiveImpact.None,
            [new SetColumnCommentOperation(table.Name, Id("Id"), new SchemaComment("id"))] = DestructiveImpact.None,
            [new RemoveColumnCommentOperation(table.Name, Id("Id"))] = DestructiveImpact.None
        };

        Assert.Equal(20, operations.Count);
        Assert.All(operations, item => Assert.Equal(item.Value, item.Key.Impact));
        Assert.All(operations.Keys, operation =>
            Assert.IsAssignableFrom<SqlStatement>(operation));
    }

    [Fact]
    public void Rename_and_alter_guards_and_column_impact_table_are_conservative()
    {
        var table = ObjectName("T");
        Assert.Throws<ArgumentException>(() =>
            new RenameTableOperation(table, ObjectName("T")));
        Assert.Throws<ArgumentException>(() =>
            new RenameColumnOperation(table, Id("A"), Id("A")));
        Assert.Throws<ArgumentException>(() => new AlterColumnOperation(
            table, Column("A", LogicalDbType.Int32), Column("B", LogicalDbType.Int32)));

        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32),
            Column("A", LogicalDbType.Int64),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32),
            Column("A", LogicalDbType.Int32,
                generation: new IdentityGenerationDefinition(1, 1)),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32, ColumnNullability.Nullable),
            Column("A", LogicalDbType.Int32, ColumnNullability.NotNullable),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32, ColumnNullability.NotNullable),
            Column("A", LogicalDbType.Int32, ColumnNullability.Nullable),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String)),
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String, 100)),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String, 100)),
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String, 200)),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String, 100)),
            Column("A", LogicalDbType.String, type: new SqlTypeDescriptor(LogicalDbType.String)),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10)),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal)),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 2)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 12, scale: 2)),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 2)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 12, scale: 3)),
            DestructiveImpact.None);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 12, scale: 3)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 3)),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 12, scale: 3)),
            Column("A", LogicalDbType.Decimal, type: new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 12, scale: 2)),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32),
            Column("A", LogicalDbType.Int32, defaultValue: new Int64DefaultDefinition(1)),
            DestructiveImpact.CompatibilityRisk);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32, defaultValue: new Int64DefaultDefinition(1)),
            Column("A", LogicalDbType.Int32),
            DestructiveImpact.CompatibilityRisk);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32, defaultValue: new Int64DefaultDefinition(1)),
            Column("A", LogicalDbType.Int32, defaultValue: new Int64DefaultDefinition(2)),
            DestructiveImpact.CompatibilityRisk);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32,
                generation: new IdentityGenerationDefinition(1, 1)),
            Column("A", LogicalDbType.Int32),
            DestructiveImpact.PotentialDataLoss);
        AssertAlterColumnImpact(
            Column("A", LogicalDbType.Int32,
                generation: new IdentityGenerationDefinition(1, 1)),
            Column("A", LogicalDbType.Int32,
                generation: new IdentityGenerationDefinition(2, 1)),
            DestructiveImpact.PotentialDataLoss);
        Assert.Throws<ArgumentException>(() => new AlterColumnOperation(
            table,
            Column("A", LogicalDbType.Int32, comment: new SchemaComment("before")),
            Column("A", LogicalDbType.Int32, comment: new SchemaComment("after"))));
    }

    [Fact]
    public void Alter_sequence_impact_table_distinguishes_narrowing_policy_and_cache()
    {
        var name = ObjectName("S");
        SequenceDefinition Seq(
            LogicalDbType type, long start, long increment,
            SequenceBounds bounds, int? cache, SequenceCycleBehavior cycle) =>
            new(name, type, new SequenceOptions(start, increment, bounds, cache, cycle));

        var baseline = Seq(LogicalDbType.Int32, 1, 1,
            SequenceBounds.Between(0, 100), 10, SequenceCycleBehavior.NoCycle);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int16, 1, 1,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(1, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(0, 99), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.None,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(-1, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.None,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(0, 101), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.None,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Unbounded(), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 2, 1,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 2,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, -1,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Equal(DestructiveImpact.CompatibilityRisk,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.Cycle)).Impact);
        Assert.Equal(DestructiveImpact.None,
            new AlterSequenceOperation(baseline,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(0, 100), 20,
                    SequenceCycleBehavior.NoCycle)).Impact);
        var unbounded = Seq(LogicalDbType.Int32, 1, 1,
            SequenceBounds.Unbounded(), 10, SequenceCycleBehavior.NoCycle);
        Assert.Equal(DestructiveImpact.PotentialDataLoss,
            new AlterSequenceOperation(unbounded,
                Seq(LogicalDbType.Int32, 1, 1,
                    SequenceBounds.Between(0, 100), 10,
                    SequenceCycleBehavior.NoCycle)).Impact);
        Assert.Throws<ArgumentException>(() => new AlterSequenceOperation(
            baseline,
            new SequenceDefinition(ObjectName("Other"), LogicalDbType.Int32,
                baseline.Options)));
    }

    [Fact]
    public void Migration_step_idempotency_matches_create_and_drop_behavior()
    {
        var table = SampleTable();
        var pairs = new (SchemaOperation Operation, MigrationIdempotencyMode Valid)[]
        {
            (new CreateSchemaOperation(new SchemaName(Id("app")), CreateObjectBehavior.FailIfExists), MigrationIdempotencyMode.RequireChange),
            (new CreateSchemaOperation(new SchemaName(Id("app")), CreateObjectBehavior.AlreadySatisfiedIfExists), MigrationIdempotencyMode.AcceptAlreadySatisfied),
            (new CreateTableOperation(table, CreateObjectBehavior.FailIfExists), MigrationIdempotencyMode.RequireChange),
            (new CreateIndexOperation(table.Name, table.Indexes[0], CreateObjectBehavior.AlreadySatisfiedIfExists), MigrationIdempotencyMode.AcceptAlreadySatisfied),
            (new CreateSequenceOperation(SampleSequence(), CreateObjectBehavior.FailIfExists), MigrationIdempotencyMode.RequireChange),
            (new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing, DropScope.Restrict), MigrationIdempotencyMode.RequireChange),
            (new DropTableOperation(table.Name, DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Restrict), MigrationIdempotencyMode.AcceptAlreadySatisfied),
            (new DropColumnOperation(table.Name, Id("Old"), DropObjectBehavior.FailIfMissing), MigrationIdempotencyMode.RequireChange),
            (new DropConstraintOperation(table.Name, Id("Old"), DropObjectBehavior.AlreadySatisfiedIfMissing), MigrationIdempotencyMode.AcceptAlreadySatisfied),
            (new DropIndexOperation(table.Name, Id("Old"), DropObjectBehavior.FailIfMissing), MigrationIdempotencyMode.RequireChange),
            (new DropSequenceOperation(SampleSequence().Name, DropObjectBehavior.AlreadySatisfiedIfMissing), MigrationIdempotencyMode.AcceptAlreadySatisfied)
        };

        foreach (var pair in pairs)
        {
            var step = new MigrationStep(new MigrationStepId("step"), pair.Operation, pair.Valid);
            Assert.Same(pair.Operation, step.Operation);
            var invalid = pair.Valid == MigrationIdempotencyMode.RequireChange
                ? MigrationIdempotencyMode.AcceptAlreadySatisfied
                : MigrationIdempotencyMode.RequireChange;
            Assert.Throws<ArgumentException>(() =>
                new MigrationStep(new MigrationStepId("step"), pair.Operation, invalid));
        }

        Assert.NotNull(new MigrationStep(
            new MigrationStepId("rename"),
            new RenameTableOperation(ObjectName("A"), ObjectName("B")),
            MigrationIdempotencyMode.AcceptAlreadySatisfied));
    }

    [Fact]
    public void Migration_plan_fingerprint_is_versioned_deterministic_and_comparison_only()
    {
        var empty = new MigrationPlan(
            new MigrationPlanId("计划"), Array.Empty<MigrationStep>());
        Assert.Equal(
            "sha256:c72890e2555365ace86d8050a83b621f0ee443fe4643ad329f0252d5cc818747",
            empty.Fingerprint.Value);
        Assert.False(empty.ContainsDestructiveSteps);
        Assert.Empty(empty.DestructiveStepIds);
        Assert.True(empty.CanApplyNeutralDestructiveSteps);
        Assert.Throws<NotSupportedException>(() =>
            ((IList<MigrationStep>)empty.Steps).Clear());

        var step = new MigrationStep(
            new MigrationStepId("create-users"),
            new CreateTableOperation(SampleTable(), CreateObjectBehavior.FailIfExists),
            MigrationIdempotencyMode.RequireChange);
        var first = new MigrationPlan(new MigrationPlanId("v1"), new[] { step });
        var second = new MigrationPlan(
            new MigrationPlanId("v1"),
            new[]
            {
                new MigrationStep(
                    new MigrationStepId("create-users"),
                    new CreateTableOperation(CloneTable(SampleTable()), CreateObjectBehavior.FailIfExists),
                    MigrationIdempotencyMode.RequireChange)
            },
            new ExpectedStructuralFingerprint(first.Fingerprint.Value));
        Assert.Equal(first.Fingerprint.Value, second.Fingerprint.Value);
        Assert.Throws<ArgumentException>(() => new MigrationPlan(
            new MigrationPlanId("v1"), new[] { step },
            new ExpectedStructuralFingerprint("sha256:" + new string('0', 64))));
        Assert.Throws<ArgumentException>(() => new MigrationPlan(
            new MigrationPlanId("dup"), new[]
            {
                step,
                new MigrationStep(new MigrationStepId("create-users"),
                    new SetTableCommentOperation(ObjectName("Other"), new SchemaComment("x")),
                    MigrationIdempotencyMode.RequireChange)
            }));

        Assert.NotEqual(first.Fingerprint.Value,
            new MigrationPlan(new MigrationPlanId("v2"), new[] { step }).Fingerprint.Value);
        Assert.NotEqual(first.Fingerprint.Value,
            new MigrationPlan(new MigrationPlanId("v1"), new[]
            {
                new MigrationStep(new MigrationStepId("create-users-2"), step.Operation,
                    MigrationIdempotencyMode.RequireChange)
            }).Fingerprint.Value);
        Assert.NotEqual(first.Fingerprint.Value,
            PlanForOperation(
                "v1", "mode",
                new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")),
                MigrationIdempotencyMode.RequireChange).Fingerprint.Value);
        Assert.NotEqual(
            PlanForOperation(
                "v1", "mode",
                new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")),
                MigrationIdempotencyMode.RequireChange).Fingerprint.Value,
            PlanForOperation(
                "v1", "mode",
                new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")),
                MigrationIdempotencyMode.AcceptAlreadySatisfied).Fingerprint.Value);
    }

    [Fact]
    public void Fingerprint_covers_literal_bits_and_rejects_invalid_utf16()
    {
        var guid = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var date = new DateTime(638712864000000000L, DateTimeKind.Utc);
        var offset = new DateTimeOffset(638712864000000000L, TimeSpan.FromHours(8));

        string Fingerprint(ColumnDefaultDefinition value) =>
            PlanForDefault(value).Fingerprint.Value;

        Assert.NotEqual(
            Fingerprint(new DecimalDefaultDefinition(1.0m)),
            Fingerprint(new DecimalDefaultDefinition(1.00m)));
        Assert.NotEqual(
            Fingerprint(new DateTimeDefaultDefinition(date)),
            Fingerprint(new DateTimeDefaultDefinition(
                DateTime.SpecifyKind(date, DateTimeKind.Local))));
        Assert.NotEqual(
            Fingerprint(new DateTimeOffsetDefaultDefinition(offset)),
            Fingerprint(new DateTimeOffsetDefaultDefinition(
                new DateTimeOffset(offset.Ticks, TimeSpan.Zero))));
        Assert.NotEqual(
            Fingerprint(new GuidDefaultDefinition(guid)),
            Fingerprint(new GuidDefaultDefinition(
                Guid.Parse("00112233-4455-6677-8899-aabbccddeefe"))));
        Assert.Throws<EncoderFallbackException>(() => new MigrationPlan(
            new MigrationPlanId("bad\ud800"), Array.Empty<MigrationStep>()));
    }

    [Fact]
    public void Fingerprint_v1_rich_literal_vector_is_frozen()
    {
        var table = new TableDefinition(
            ObjectName("订单", "应用", "目录"),
            new[]
            {
                Column("标识", LogicalDbType.Guid,
                    defaultValue: new GuidDefaultDefinition(
                        Guid.Parse("00112233-4455-6677-8899-aabbccddeeff"))),
                Column("金额", LogicalDbType.Decimal,
                    defaultValue: new DecimalDefaultDefinition(1.00m),
                    type: Type(LogicalDbType.Decimal, precision: 12, scale: 2)),
                Column("创建时间", LogicalDbType.DateTime,
                    defaultValue: new DateTimeDefaultDefinition(
                        new DateTime(638712864000000000L, DateTimeKind.Utc))),
                Column("本地时间", LogicalDbType.DateTimeOffset,
                    defaultValue: new DateTimeOffsetDefaultDefinition(
                        new DateTimeOffset(
                            638712864000000000L, TimeSpan.FromHours(8))))
            },
            comment: new SchemaComment("固定向量"));
        var plan = PlanForOperation(
            "向量-v1", "建表-1",
            new CreateTableOperation(table, CreateObjectBehavior.FailIfExists),
            MigrationIdempotencyMode.RequireChange);

        Assert.Equal(
            "sha256:1808adf2e58e488636d98d2e18e706807476f464c056c543821e85321f4701e2",
            plan.Fingerprint.Value);
    }

    [Fact]
    public void Fingerprint_changes_for_every_operation_field_and_collection_order()
    {
        var table = SampleTable();
        var mutations = new SchemaOperation[]
        {
            new CreateSchemaOperation(new SchemaName(Id("other")), CreateObjectBehavior.FailIfExists),
            new CreateSchemaOperation(new SchemaName(Id("app")), CreateObjectBehavior.AlreadySatisfiedIfExists),
            new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Cascade),
            new CreateTableOperation(table, CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(new TableDefinition(table.Name,
                table.Columns.Reverse(), table.Constraints, table.Indexes, table.Comment),
                CreateObjectBehavior.FailIfExists),
            new RenameTableOperation(ObjectName("A"), ObjectName("B")),
            new RenameTableOperation(ObjectName("A"), ObjectName("C")),
            new DropTableOperation(table.Name, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new DropTableOperation(table.Name, DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Cascade),
            new AddColumnOperation(table.Name, Column("X", LogicalDbType.Int32)),
            new AddColumnOperation(table.Name, Column("Y", LogicalDbType.Int32)),
            new AlterColumnOperation(table.Name, Column("X", LogicalDbType.Int32), Column("X", LogicalDbType.Int64)),
            new RenameColumnOperation(table.Name, Id("A"), Id("B")),
            new DropColumnOperation(table.Name, Id("A"), DropObjectBehavior.FailIfMissing),
            new AddConstraintOperation(table.Name,
                new UniqueConstraintDefinition(Id("UQ"), new[] { Id("Id") })),
            new DropConstraintOperation(table.Name, Id("UQ"), DropObjectBehavior.FailIfMissing),
            new CreateIndexOperation(table.Name, table.Indexes[0], CreateObjectBehavior.FailIfExists),
            new DropIndexOperation(table.Name, table.Indexes[0].Name, DropObjectBehavior.FailIfMissing),
            new CreateSequenceOperation(SampleSequence(), CreateObjectBehavior.FailIfExists),
            new AlterSequenceOperation(SampleSequence(), new SequenceDefinition(
                SampleSequence().Name, LogicalDbType.Int64, SampleSequence().Options)),
            new DropSequenceOperation(SampleSequence().Name, DropObjectBehavior.FailIfMissing),
            new SetTableCommentOperation(table.Name, new SchemaComment("one")),
            new RemoveTableCommentOperation(table.Name),
            new SetColumnCommentOperation(table.Name, Id("Id"), new SchemaComment("one")),
            new RemoveColumnCommentOperation(table.Name, Id("Id"))
        };

        var fingerprints = mutations.Select(operation =>
            new MigrationPlan(new MigrationPlanId("p"), new[]
            {
                new MigrationStep(new MigrationStepId("s"), operation,
                    CompatibleIdempotency(operation))
            }).Fingerprint.Value).ToArray();
        Assert.Equal(
            fingerprints.Length,
            fingerprints.Distinct(StringComparer.Ordinal).ToArray().Length);
    }

    [Fact]
    public void Fingerprint_same_type_schema_definition_fields_are_all_bound()
    {
        var tableName = ObjectName("Users", "app", "catalog");
        var baseColumn = Column(
            "Value", LogicalDbType.Decimal, ColumnNullability.Nullable,
            defaultValue: new DecimalDefaultDefinition(1.00m),
            comment: new SchemaComment("value"),
            type: Type(LogicalDbType.Decimal, precision: 12, scale: 2));
        var baseIndex = new IndexDefinition(
            Id("IX_Value"),
            new[]
            {
                new IndexColumnDefinition(Id("Value"), SqlSortDirection.Ascending),
                new IndexColumnDefinition(Id("Id"), SqlSortDirection.Descending)
            },
            IndexUniqueness.NonUnique);
        var basePrimary = new PrimaryKeyDefinition(
            Id("PK_Users"), new[] { Id("TenantId"), Id("Id") });
        var baseUnique = new UniqueConstraintDefinition(
            Id("UQ_Users"), new[] { Id("TenantId"), Id("Value") });
        var baseForeign = new ForeignKeyDefinition(
            Id("FK_Users_Role"), ObjectName("Roles", "app", "catalog"),
            new ForeignKeyColumnSet(
                new[] { Id("TenantId"), Id("RoleId") },
                new[] { Id("TenantId"), Id("Id") }),
            new ReferentialActions(
                ReferentialAction.NoAction, ReferentialAction.Restrict));
        TableDefinition Table(
            ColumnDefinition? column = null,
            IEnumerable<ConstraintDefinition>? constraints = null,
            IEnumerable<IndexDefinition>? indexes = null,
            SchemaComment? comment = null,
            SqlObjectName? name = null) =>
            new(name ?? tableName,
                new[]
                {
                    Column("TenantId", LogicalDbType.Int64),
                    Column("Id", LogicalDbType.Int64),
                    Column("RoleId", LogicalDbType.Int64),
                    column ?? baseColumn
                },
                constraints ?? new ConstraintDefinition[]
                {
                    basePrimary, baseUnique, baseForeign
                },
                indexes ?? new[] { baseIndex },
                comment ?? new SchemaComment("users"));
        var baseline = new CreateTableOperation(
            Table(), CreateObjectBehavior.FailIfExists);

        var variants = new List<SchemaOperation>
        {
            new CreateTableOperation(Table(name: ObjectName("Users", "app", "other")), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(comment: new SchemaComment("changed")), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Changed", LogicalDbType.Decimal,
                defaultValue: new DecimalDefaultDefinition(1.00m),
                comment: new SchemaComment("value"),
                type: Type(LogicalDbType.Decimal, precision: 12, scale: 2))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Value", LogicalDbType.Double,
                defaultValue: new DecimalDefaultDefinition(1.00m),
                comment: new SchemaComment("value"))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Value", LogicalDbType.Decimal, ColumnNullability.NotNullable,
                defaultValue: new DecimalDefaultDefinition(1.00m),
                comment: new SchemaComment("value"),
                type: Type(LogicalDbType.Decimal, precision: 12, scale: 2))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Value", LogicalDbType.Decimal,
                defaultValue: new DecimalDefaultDefinition(2.00m),
                comment: new SchemaComment("value"),
                type: Type(LogicalDbType.Decimal, precision: 12, scale: 2))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Value", LogicalDbType.Decimal,
                defaultValue: new DecimalDefaultDefinition(1.00m),
                comment: new SchemaComment("changed"),
                type: Type(LogicalDbType.Decimal, precision: 12, scale: 2))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(column: Column(
                "Value", LogicalDbType.Decimal,
                generation: new ComputedGenerationDefinition(
                    BooleanExpression.True, ComputedStorageKind.Virtual),
                type: Type(LogicalDbType.Decimal, precision: 12, scale: 2))), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(indexes: new[]
            {
                new IndexDefinition(Id("IX_Changed"), baseIndex.Columns, baseIndex.Uniqueness)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(indexes: new[]
            {
                new IndexDefinition(baseIndex.Name,
                    baseIndex.Columns.Reverse(), baseIndex.Uniqueness)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(indexes: new[]
            {
                new IndexDefinition(baseIndex.Name, baseIndex.Columns, IndexUniqueness.Unique)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(basePrimary.Name, new[] { Id("Id"), Id("TenantId") }),
                baseUnique, baseForeign
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary,
                new UniqueConstraintDefinition(baseUnique.Name, new[] { Id("Value"), Id("TenantId") }),
                baseForeign
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary, baseUnique,
                new ForeignKeyDefinition(baseForeign.Name, ObjectName("Other", "app", "catalog"), baseForeign.Columns, baseForeign.Actions)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary, baseUnique,
                new ForeignKeyDefinition(baseForeign.Name, baseForeign.ReferencedTable,
                    new ForeignKeyColumnSet(
                        new[] { Id("TenantId"), Id("Id") },
                        baseForeign.Columns.ReferencedColumns), baseForeign.Actions)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary, baseUnique,
                new ForeignKeyDefinition(baseForeign.Name, baseForeign.ReferencedTable,
                    new ForeignKeyColumnSet(
                        baseForeign.Columns.LocalColumns,
                        new[] { Id("TenantId"), Id("OtherId") }), baseForeign.Actions)
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary, baseUnique,
                new ForeignKeyDefinition(baseForeign.Name, baseForeign.ReferencedTable,
                    baseForeign.Columns,
                    new ReferentialActions(
                        ReferentialAction.Cascade, ReferentialAction.Restrict))
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(Table(constraints: new ConstraintDefinition[]
            {
                basePrimary, baseUnique,
                new ForeignKeyDefinition(baseForeign.Name, baseForeign.ReferencedTable,
                    baseForeign.Columns,
                    new ReferentialActions(
                        ReferentialAction.NoAction, ReferentialAction.Cascade))
            }), CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(new TableDefinition(
                tableName, Table().Columns.Reverse(), Table().Constraints,
                Table().Indexes, Table().Comment), CreateObjectBehavior.FailIfExists)
        };

        AssertOperationFingerprintChanges(baseline, variants);

        var baseSequence = new SequenceDefinition(
            ObjectName("S", "app", "catalog"), LogicalDbType.Int64,
            new SequenceOptions(10, 2, SequenceBounds.Between(0, 100), 10,
                SequenceCycleBehavior.NoCycle));
        SequenceDefinition Sequence(
            SqlObjectName? name = null,
            LogicalDbType type = LogicalDbType.Int64,
            long start = 10,
            long increment = 2,
            SequenceBounds? bounds = null,
            int? cache = 10,
            SequenceCycleBehavior cycle = SequenceCycleBehavior.NoCycle) =>
            new(name ?? baseSequence.Name, type,
                new SequenceOptions(start, increment,
                    bounds ?? SequenceBounds.Between(0, 100), cache, cycle));
        AssertOperationFingerprintChanges(
            new CreateSequenceOperation(baseSequence, CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateSequenceOperation(Sequence(name: ObjectName("Other", "app", "catalog")), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(type: LogicalDbType.Int32), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(start: 11), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(increment: -2), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(bounds: SequenceBounds.Between(-1, 100)), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(bounds: SequenceBounds.Between(0, 101)), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(cache: 11), CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(Sequence(cycle: SequenceCycleBehavior.Cycle), CreateObjectBehavior.FailIfExists)
            });
    }

    [Fact]
    public void Fingerprint_same_type_schema_operation_fields_are_all_bound()
    {
        var table = SampleTable();
        var otherTable = ObjectName("Other", "app");
        var column = Column("Status", LogicalDbType.Int32);
        var changedColumn = Column("Changed", LogicalDbType.Int32);
        var constraint = new UniqueConstraintDefinition(
            Id("UQ_Status"), new[] { Id("Status") });
        var changedConstraint = new UniqueConstraintDefinition(
            Id("UQ_Changed"), new[] { Id("Status") });
        var index = new IndexDefinition(
            Id("IX_Status"),
            new[]
            {
                new IndexColumnDefinition(Id("Status"), SqlSortDirection.Ascending)
            }, IndexUniqueness.NonUnique);
        var changedIndex = new IndexDefinition(
            Id("IX_Changed"), index.Columns, index.Uniqueness);
        var sequence = SampleSequence();
        var changedSequence = new SequenceDefinition(
            ObjectName("ChangedSequence", "app"), sequence.IntegerType,
            sequence.Options);

        AssertOperationFingerprintChanges(
            new CreateSchemaOperation(
                new SchemaName(Id("app"), Id("catalog")),
                CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateSchemaOperation(new SchemaName(Id("other"), Id("catalog")), CreateObjectBehavior.FailIfExists),
                new CreateSchemaOperation(new SchemaName(Id("app"), Id("otherCatalog")), CreateObjectBehavior.FailIfExists),
                new CreateSchemaOperation(new SchemaName(Id("app"), Id("catalog")), CreateObjectBehavior.AlreadySatisfiedIfExists)
            });
        AssertOperationFingerprintChanges(
            new DropSchemaOperation(new SchemaName(Id("app")),
                DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new SchemaOperation[]
            {
                new DropSchemaOperation(new SchemaName(Id("other")), DropObjectBehavior.FailIfMissing, DropScope.Restrict),
                new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Restrict),
                new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing, DropScope.Cascade)
            });
        AssertOperationFingerprintChanges(
            new CreateTableOperation(table, CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateTableOperation(CloneTableWithName(table, otherTable), CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(table, CreateObjectBehavior.AlreadySatisfiedIfExists)
            });
        AssertOperationFingerprintChanges(
            new RenameTableOperation(table.Name, otherTable),
            new SchemaOperation[]
            {
                new RenameTableOperation(ObjectName("Source2", "app"), otherTable),
                new RenameTableOperation(table.Name, ObjectName("Target2", "app"))
            });
        AssertOperationFingerprintChanges(
            new DropTableOperation(table.Name, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new SchemaOperation[]
            {
                new DropTableOperation(otherTable, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
                new DropTableOperation(table.Name, DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Restrict),
                new DropTableOperation(table.Name, DropObjectBehavior.FailIfMissing, DropScope.Cascade)
            });
        AssertOperationFingerprintChanges(
            new AddColumnOperation(table.Name, column),
            new SchemaOperation[]
            {
                new AddColumnOperation(otherTable, column),
                new AddColumnOperation(table.Name, changedColumn)
            });

        var before = Column("Status", LogicalDbType.Int32);
        var after = Column("Status", LogicalDbType.Int32,
            defaultValue: new Int64DefaultDefinition(1));
        AssertOperationFingerprintChanges(
            new AlterColumnOperation(table.Name, before, after),
            new SchemaOperation[]
            {
                new AlterColumnOperation(otherTable, before, after),
                new AlterColumnOperation(table.Name,
                    Column("Status", LogicalDbType.Int64), after),
                new AlterColumnOperation(table.Name, before,
                    Column("Status", LogicalDbType.Int32,
                        defaultValue: new Int64DefaultDefinition(2)))
            });
        AssertOperationFingerprintChanges(
            new RenameColumnOperation(table.Name, Id("Old"), Id("New")),
            new SchemaOperation[]
            {
                new RenameColumnOperation(otherTable, Id("Old"), Id("New")),
                new RenameColumnOperation(table.Name, Id("Old2"), Id("New")),
                new RenameColumnOperation(table.Name, Id("Old"), Id("New2"))
            });
        AssertOperationFingerprintChanges(
            new DropColumnOperation(table.Name, Id("Old"), DropObjectBehavior.FailIfMissing),
            new SchemaOperation[]
            {
                new DropColumnOperation(otherTable, Id("Old"), DropObjectBehavior.FailIfMissing),
                new DropColumnOperation(table.Name, Id("Other"), DropObjectBehavior.FailIfMissing),
                new DropColumnOperation(table.Name, Id("Old"), DropObjectBehavior.AlreadySatisfiedIfMissing)
            });
        AssertOperationFingerprintChanges(
            new AddConstraintOperation(table.Name, constraint),
            new SchemaOperation[]
            {
                new AddConstraintOperation(otherTable, constraint),
                new AddConstraintOperation(table.Name, changedConstraint)
            });
        AssertOperationFingerprintChanges(
            new DropConstraintOperation(table.Name, Id("UQ"), DropObjectBehavior.FailIfMissing),
            new SchemaOperation[]
            {
                new DropConstraintOperation(otherTable, Id("UQ"), DropObjectBehavior.FailIfMissing),
                new DropConstraintOperation(table.Name, Id("Other"), DropObjectBehavior.FailIfMissing),
                new DropConstraintOperation(table.Name, Id("UQ"), DropObjectBehavior.AlreadySatisfiedIfMissing)
            });
        AssertOperationFingerprintChanges(
            new CreateIndexOperation(table.Name, index, CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateIndexOperation(otherTable, index, CreateObjectBehavior.FailIfExists),
                new CreateIndexOperation(table.Name, changedIndex, CreateObjectBehavior.FailIfExists),
                new CreateIndexOperation(table.Name, index, CreateObjectBehavior.AlreadySatisfiedIfExists)
            });
        AssertOperationFingerprintChanges(
            new DropIndexOperation(table.Name, Id("IX"), DropObjectBehavior.FailIfMissing),
            new SchemaOperation[]
            {
                new DropIndexOperation(otherTable, Id("IX"), DropObjectBehavior.FailIfMissing),
                new DropIndexOperation(table.Name, Id("Other"), DropObjectBehavior.FailIfMissing),
                new DropIndexOperation(table.Name, Id("IX"), DropObjectBehavior.AlreadySatisfiedIfMissing)
            });
        AssertOperationFingerprintChanges(
            new CreateSequenceOperation(sequence, CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateSequenceOperation(changedSequence, CreateObjectBehavior.FailIfExists),
                new CreateSequenceOperation(sequence, CreateObjectBehavior.AlreadySatisfiedIfExists)
            });
        AssertOperationFingerprintChanges(
            new AlterSequenceOperation(sequence,
                new SequenceDefinition(sequence.Name, sequence.IntegerType,
                    new SequenceOptions(1, 1, SequenceBounds.Unbounded(), 10,
                        SequenceCycleBehavior.NoCycle))),
            new SchemaOperation[]
            {
                new AlterSequenceOperation(
                    new SequenceDefinition(sequence.Name, sequence.IntegerType,
                        new SequenceOptions(2, 1, SequenceBounds.Unbounded(), null,
                            SequenceCycleBehavior.NoCycle)),
                    new SequenceDefinition(sequence.Name, sequence.IntegerType,
                        new SequenceOptions(1, 1, SequenceBounds.Unbounded(), 10,
                            SequenceCycleBehavior.NoCycle))),
                new AlterSequenceOperation(sequence,
                    new SequenceDefinition(sequence.Name, sequence.IntegerType,
                        new SequenceOptions(1, 1, SequenceBounds.Unbounded(), 11,
                            SequenceCycleBehavior.NoCycle)))
            });
        AssertOperationFingerprintChanges(
            new DropSequenceOperation(sequence.Name, DropObjectBehavior.FailIfMissing),
            new SchemaOperation[]
            {
                new DropSequenceOperation(changedSequence.Name, DropObjectBehavior.FailIfMissing),
                new DropSequenceOperation(sequence.Name, DropObjectBehavior.AlreadySatisfiedIfMissing)
            });
        AssertOperationFingerprintChanges(
            new SetTableCommentOperation(table.Name, new SchemaComment("one")),
            new SchemaOperation[]
            {
                new SetTableCommentOperation(otherTable, new SchemaComment("one")),
                new SetTableCommentOperation(table.Name, new SchemaComment("two"))
            });
        AssertOperationFingerprintChanges(
            new RemoveTableCommentOperation(table.Name),
            new SchemaOperation[] { new RemoveTableCommentOperation(otherTable) });
        AssertOperationFingerprintChanges(
            new SetColumnCommentOperation(table.Name, Id("Id"), new SchemaComment("one")),
            new SchemaOperation[]
            {
                new SetColumnCommentOperation(otherTable, Id("Id"), new SchemaComment("one")),
                new SetColumnCommentOperation(table.Name, Id("Other"), new SchemaComment("one")),
                new SetColumnCommentOperation(table.Name, Id("Id"), new SchemaComment("two"))
            });
        AssertOperationFingerprintChanges(
            new RemoveColumnCommentOperation(table.Name, Id("Id")),
            new SchemaOperation[]
            {
                new RemoveColumnCommentOperation(otherTable, Id("Id")),
                new RemoveColumnCommentOperation(table.Name, Id("Other"))
            });

        var operation = new SetTableCommentOperation(
            table.Name, new SchemaComment("mode"));
        Assert.NotEqual(
            PlanForOperation("field-plan", "field-step", operation,
                MigrationIdempotencyMode.RequireChange).Fingerprint.Value,
            PlanForOperation("field-plan", "field-step", operation,
                MigrationIdempotencyMode.AcceptAlreadySatisfied).Fingerprint.Value);

        var strictBehavior = PlanForOperation(
            "behavior-plan", "behavior-step",
            new CreateSchemaOperation(
                new SchemaName(Id("app")), CreateObjectBehavior.FailIfExists),
            MigrationIdempotencyMode.RequireChange).Fingerprint.Value;
        var satisfiedBehavior = PlanForOperation(
            "behavior-plan", "behavior-step",
            new CreateSchemaOperation(
                new SchemaName(Id("app")),
                CreateObjectBehavior.AlreadySatisfiedIfExists),
            MigrationIdempotencyMode.AcceptAlreadySatisfied).Fingerprint.Value;
        Assert.Equal(
            "sha256:b24f00fb209254596278168c9aa394275f139c43c5a31bffcbfb85622d54d777",
            strictBehavior);
        Assert.Equal(
            "sha256:d0b84389931a28ebdb3f0191ab729a4a2ced2fc86cb962dfb6aa4aae8f8892e7",
            satisfiedBehavior);

        var first = Step("first", MigrationIdempotencyMode.RequireChange);
        var second = new MigrationStep(
            new MigrationStepId("second"),
            new SetTableCommentOperation(ObjectName("T"), new SchemaComment("y")),
            MigrationIdempotencyMode.RequireChange);
        Assert.NotEqual(
            new MigrationPlan(new MigrationPlanId("order"),
                new[] { first, second }).Fingerprint.Value,
            new MigrationPlan(new MigrationPlanId("order"),
                new[] { second, first }).Fingerprint.Value);
    }

    [Fact]
    public void Fingerprint_computed_expression_and_query_fields_are_all_bound()
    {
        var intType = Type(LogicalDbType.Int32);
        var expressionPairs = new (SqlExpression Before, SqlExpression After)[]
        {
            (ColumnExpression("A"), ColumnExpression("B")),
            (ColumnExpression("A"), ColumnExpression("A", "t")),
            (new ParameterExpression(new ParameterDefinition("p", intType)),
                new ParameterExpression(new ParameterDefinition("q", intType))),
            (new ParameterExpression(new ParameterDefinition("p", intType)),
                new ParameterExpression(new ParameterDefinition("p", Type(LogicalDbType.Int64)))),
            (new ParameterExpression(new ParameterDefinition("p", intType)),
                new ParameterExpression(new ParameterDefinition(
                    "p", intType, ParameterDirection.Output))),
            (new ParameterExpression(new ParameterDefinition("p", intType)),
                new ParameterExpression(new ParameterDefinition(
                    "p", intType, isNullable: false))),
            (BooleanExpression.True, BooleanExpression.False),
            (new BinaryExpression(ColumnExpression("A"), SqlBinaryOperator.Add, ColumnExpression("B")),
                new BinaryExpression(ColumnExpression("Changed"), SqlBinaryOperator.Add, ColumnExpression("B"))),
            (new BinaryExpression(ColumnExpression("A"), SqlBinaryOperator.Add, ColumnExpression("B")),
                new BinaryExpression(ColumnExpression("A"), SqlBinaryOperator.Subtract, ColumnExpression("B"))),
            (new BinaryExpression(ColumnExpression("A"), SqlBinaryOperator.Add, ColumnExpression("B")),
                new BinaryExpression(ColumnExpression("A"), SqlBinaryOperator.Add, ColumnExpression("Changed"))),
            (new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True),
                new UnaryExpression(SqlUnaryOperator.IsNull, BooleanExpression.True)),
            (new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True),
                new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False)),
            (new InExpression(ColumnExpression("A"), new SqlExpression[] { ColumnExpression("B"), ColumnExpression("C") }),
                new InExpression(ColumnExpression("Changed"), new SqlExpression[] { ColumnExpression("B"), ColumnExpression("C") })),
            (new InExpression(ColumnExpression("A"), new SqlExpression[] { ColumnExpression("B"), ColumnExpression("C") }),
                new InExpression(ColumnExpression("A"), new SqlExpression[] { ColumnExpression("C"), ColumnExpression("B") })),
            (new BetweenExpression(ColumnExpression("A"), ColumnExpression("B"), ColumnExpression("C")),
                new BetweenExpression(ColumnExpression("Changed"), ColumnExpression("B"), ColumnExpression("C"))),
            (new BetweenExpression(ColumnExpression("A"), ColumnExpression("B"), ColumnExpression("C")),
                new BetweenExpression(ColumnExpression("A"), ColumnExpression("Changed"), ColumnExpression("C"))),
            (new BetweenExpression(ColumnExpression("A"), ColumnExpression("B"), ColumnExpression("C")),
                new BetweenExpression(ColumnExpression("A"), ColumnExpression("B"), ColumnExpression("Changed"))),
            (CaseExpressionFor("input", "when", "then", "else"),
                CaseExpressionFor("changed", "when", "then", "else")),
            (CaseExpressionFor("input", "when", "then", "else"),
                CaseExpressionFor("input", "changed", "then", "else")),
            (CaseExpressionFor("input", "when", "then", "else"),
                CaseExpressionFor("input", "when", "changed", "else")),
            (CaseExpressionFor("input", "when", "then", "else"),
                CaseExpressionFor("input", "when", "then", "changed")),
            (new CastExpression(ColumnExpression("A"), intType),
                new CastExpression(ColumnExpression("B"), intType)),
            (new CastExpression(ColumnExpression("A"), intType),
                new CastExpression(ColumnExpression("A"), Type(LogicalDbType.Int64))),
            (new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("A")),
                new AggregateExpression(SemanticFunctions.Avg, ColumnExpression("A"))),
            (new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("A")),
                new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("B"))),
            (new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("A")),
                new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("A"), distinct: true)),
            (new FunctionExpression(SemanticFunctions.Coalesce,
                    new SqlExpression[] { ColumnExpression("A"), ColumnExpression("B") }),
                new FunctionExpression(SemanticFunctions.Concat,
                    new SqlExpression[] { ColumnExpression("A"), ColumnExpression("B") })),
            (new FunctionExpression(SemanticFunctions.Coalesce,
                    new SqlExpression[] { ColumnExpression("A"), ColumnExpression("B") }),
                new FunctionExpression(SemanticFunctions.Coalesce,
                    new SqlExpression[] { ColumnExpression("B"), ColumnExpression("A") })),
            (new WildcardExpression(), new WildcardExpression(new SqlAlias("t")))
        };
        Assert.All(expressionPairs, pair =>
            AssertExpressionFingerprintChanges(pair.Before, pair.After));

        Assert.NotEqual(
            FingerprintForComputed(BooleanExpression.True, ComputedStorageKind.Virtual),
            FingerprintForComputed(BooleanExpression.True, ComputedStorageKind.Stored));

        var queryMutations = new[]
        {
            "fromName", "fromAlias", "projectionExpression", "projectionAlias",
            "projectionOrder", "distinct", "where", "groupBy", "groupOrder",
            "having", "orderExpression", "orderDirection", "orderNulls",
            "orderOrder", "pageOffset", "pageLimit", "pageKind", "lockMode",
            "lockWait", "cteName", "cteQuery", "cteColumns", "cteRecursive",
            "cteOrder", "setOperator", "setQuery", "setOrder"
        };
        var baselineQuery = FingerprintQuery("base");
        Assert.All(queryMutations, mutation => AssertExpressionFingerprintChanges(
            new SubqueryExpression(baselineQuery),
            new SubqueryExpression(FingerprintQuery(mutation))));

        foreach (var mutation in new[] { "joinLeft", "joinType", "joinRight", "joinCondition" })
        {
            AssertExpressionFingerprintChanges(
                new SubqueryExpression(FingerprintQuery("joinBase")),
                new SubqueryExpression(FingerprintQuery(mutation)));
        }
        foreach (var mutation in new[] { "derivedQuery", "derivedAlias" })
        {
            AssertExpressionFingerprintChanges(
                new SubqueryExpression(FingerprintQuery("derivedBase")),
                new SubqueryExpression(FingerprintQuery(mutation)));
        }
        AssertExpressionFingerprintChanges(
            new ExistsExpression(new SubqueryExpression(FingerprintQuery("base"))),
            new ExistsExpression(new SubqueryExpression(FingerprintQuery("where"))));
    }

    [Fact]
    public void Fingerprint_typed_defaults_types_generations_and_nested_order_are_all_bound()
    {
        void AssertDefaultChanges(
            ColumnDefaultDefinition before,
            ColumnDefaultDefinition after) =>
            Assert.NotEqual(
                PlanForDefault(before).Fingerprint.Value,
                PlanForDefault(after).Fingerprint.Value);

        AssertDefaultChanges(
            new NullDefaultDefinition(), new BooleanDefaultDefinition(false));
        AssertDefaultChanges(
            new BooleanDefaultDefinition(false),
            new BooleanDefaultDefinition(true));
        AssertDefaultChanges(
            new Int64DefaultDefinition(1), new Int64DefaultDefinition(2));
        AssertDefaultChanges(
            new DecimalDefaultDefinition(1.00m),
            new DecimalDefaultDefinition(2.00m));
        AssertDefaultChanges(
            new StringDefaultDefinition("one"),
            new StringDefaultDefinition("two"));
        AssertDefaultChanges(
            new GuidDefaultDefinition(
                Guid.Parse("00112233-4455-6677-8899-aabbccddeeff")),
            new GuidDefaultDefinition(
                Guid.Parse("10112233-4455-6677-8899-aabbccddeeff")));

        const long ticks = 638712864000000000L;
        AssertDefaultChanges(
            new DateTimeDefaultDefinition(
                new DateTime(ticks, DateTimeKind.Utc)),
            new DateTimeDefaultDefinition(
                new DateTime(ticks + 1, DateTimeKind.Utc)));
        AssertDefaultChanges(
            new DateTimeDefaultDefinition(
                new DateTime(ticks, DateTimeKind.Utc)),
            new DateTimeDefaultDefinition(
                new DateTime(ticks, DateTimeKind.Local)));
        AssertDefaultChanges(
            new DateTimeOffsetDefaultDefinition(
                new DateTimeOffset(ticks, TimeSpan.Zero)),
            new DateTimeOffsetDefaultDefinition(
                new DateTimeOffset(ticks + 1, TimeSpan.Zero)));
        AssertDefaultChanges(
            new DateTimeOffsetDefaultDefinition(
                new DateTimeOffset(ticks, TimeSpan.Zero)),
            new DateTimeOffsetDefaultDefinition(
                new DateTimeOffset(ticks, TimeSpan.FromHours(1))));
        AssertDefaultChanges(
            new SemanticDefaultDefinition(SemanticDefaultKind.CurrentDate),
            new SemanticDefaultDefinition(SemanticDefaultKind.CurrentDateTime));

        Assert.NotEqual(
            FingerprintForType(Type(LogicalDbType.String, length: 10)),
            FingerprintForType(Type(LogicalDbType.String, length: 11)));
        Assert.NotEqual(
            FingerprintForType(Type(LogicalDbType.Decimal, precision: 10, scale: 2)),
            FingerprintForType(Type(LogicalDbType.Decimal, precision: 11, scale: 2)));
        Assert.NotEqual(
            FingerprintForType(Type(LogicalDbType.Decimal, precision: 10, scale: 2)),
            FingerprintForType(Type(LogicalDbType.Decimal, precision: 10, scale: 3)));

        Assert.NotEqual(
            FingerprintForGeneration(new IdentityGenerationDefinition(1, 2)),
            FingerprintForGeneration(new IdentityGenerationDefinition(2, 2)));
        Assert.NotEqual(
            FingerprintForGeneration(new IdentityGenerationDefinition(1, 2)),
            FingerprintForGeneration(new IdentityGenerationDefinition(1, 3)));
        Assert.NotEqual(
            FingerprintForGeneration(
                new SequenceGenerationDefinition(ObjectName("S", "app", "catalog"))),
            FingerprintForGeneration(
                new SequenceGenerationDefinition(ObjectName("Other", "app", "catalog"))));

        var tableName = ObjectName("Nested", "app");
        var columns = new[]
        {
            Column("Id", LogicalDbType.Int64),
            Column("TenantId", LogicalDbType.Int64),
            Column("RoleId", LogicalDbType.Int64)
        };
        var primary = new PrimaryKeyDefinition(
            Id("PK"), new[] { Id("TenantId"), Id("Id") });
        var unique = new UniqueConstraintDefinition(
            Id("UQ"), new[] { Id("TenantId"), Id("RoleId") });
        var foreign = new ForeignKeyDefinition(
            Id("FK"), ObjectName("Role", "app"),
            new ForeignKeyColumnSet(
                new[] { Id("TenantId"), Id("RoleId") },
                new[] { Id("TenantId"), Id("Id") }),
            new ReferentialActions(
                ReferentialAction.NoAction, ReferentialAction.Restrict));
        var firstIndex = new IndexDefinition(
            Id("IX_One"),
            new[]
            {
                new IndexColumnDefinition(
                    Id("Id"), SqlSortDirection.Ascending)
            }, IndexUniqueness.NonUnique);
        var secondIndex = new IndexDefinition(
            Id("IX_Two"),
            new[]
            {
                new IndexColumnDefinition(
                    Id("RoleId"), SqlSortDirection.Descending)
            }, IndexUniqueness.NonUnique);
        TableDefinition Nested(
            IEnumerable<ConstraintDefinition> constraints,
            IEnumerable<IndexDefinition> indexes) =>
            new(tableName, columns, constraints, indexes);

        AssertOperationFingerprintChanges(
            new CreateTableOperation(
                Nested(new ConstraintDefinition[] { primary, unique, foreign },
                    new[] { firstIndex, secondIndex }),
                CreateObjectBehavior.FailIfExists),
            new SchemaOperation[]
            {
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[]
                        {
                            new PrimaryKeyDefinition(
                                Id("PK_Changed"), primary.Columns),
                            unique, foreign
                        }, new[] { firstIndex, secondIndex }),
                    CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[]
                        {
                            primary,
                            new UniqueConstraintDefinition(
                                Id("UQ_Changed"), unique.Columns),
                            foreign
                        }, new[] { firstIndex, secondIndex }),
                    CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[]
                        {
                            primary, unique,
                            new ForeignKeyDefinition(
                                Id("FK_Changed"), foreign.ReferencedTable,
                                foreign.Columns, foreign.Actions)
                        }, new[] { firstIndex, secondIndex }),
                    CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[] { foreign, unique, primary },
                        new[] { firstIndex, secondIndex }),
                    CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[] { primary, unique, foreign },
                        new[] { secondIndex, firstIndex }),
                    CreateObjectBehavior.FailIfExists),
                new CreateTableOperation(
                    Nested(new ConstraintDefinition[] { primary, unique, foreign },
                        new[]
                        {
                            new IndexDefinition(
                                firstIndex.Name,
                                new[]
                                {
                                    new IndexColumnDefinition(
                                        Id("Id"), SqlSortDirection.Descending)
                                }, firstIndex.Uniqueness),
                            secondIndex
                        }),
                    CreateObjectBehavior.FailIfExists)
            });
    }

    [Fact]
    public void Fingerprint_encodes_every_concrete_expression_and_function_metadata_field()
    {
        var simpleQuery = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        var expressions = new SqlExpression[]
        {
            ColumnExpression("A"),
            new ParameterExpression(new ParameterDefinition(
                "p", Type(LogicalDbType.Int32))),
            NullExpression.Instance,
            BooleanExpression.True,
            new BinaryExpression(
                ColumnExpression("A"), SqlBinaryOperator.Add,
                ColumnExpression("B")),
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True),
            new InExpression(
                ColumnExpression("A"), new SqlExpression[] { ColumnExpression("B") }),
            new BetweenExpression(
                ColumnExpression("A"), ColumnExpression("B"), ColumnExpression("C")),
            CaseExpressionFor("input", "when", "then", "else"),
            new CastExpression(ColumnExpression("A"), Type(LogicalDbType.Int64)),
            new SubqueryExpression(simpleQuery),
            new ExistsExpression(new SubqueryExpression(simpleQuery)),
            new AggregateExpression(SemanticFunctions.Sum, ColumnExpression("A")),
            new FunctionExpression(
                SemanticFunctions.Coalesce,
                new SqlExpression[] { ColumnExpression("A"), ColumnExpression("B") }),
            new WildcardExpression()
        };
        var fingerprints = expressions
            .Select(expression => FingerprintForComputed(expression))
            .ToArray();
        var closedExpressionTypes = typeof(SqlExpression).Assembly.GetTypes()
            .Where(type => type.IsSealed && typeof(SqlExpression).IsAssignableFrom(type))
            .OrderBy(type => type.FullName, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            closedExpressionTypes,
            expressions.Select(expression => expression.GetType())
                .Distinct()
                .OrderBy(type => type.FullName, StringComparer.Ordinal)
                .ToArray());
        Assert.Equal(
            expressions.Length,
            fingerprints.Distinct(StringComparer.Ordinal).ToArray().Length);

        Assert.NotEqual(
            FingerprintForUncheckedFunction("same", 1, 2, false),
            FingerprintForUncheckedFunction("same", 2, 2, false));
        Assert.NotEqual(
            FingerprintForUncheckedFunction("same", 1, 2, false),
            FingerprintForUncheckedFunction("same", 1, 3, false));
        Assert.NotEqual(
            FingerprintForUncheckedFunction("same", 1, 2, false),
            FingerprintForUncheckedFunction("same", 1, 2, true));
    }

    [Fact]
    public void Destructive_approval_is_exact_partial_replaceable_and_stale_safe()
    {
        var safe = new MigrationStep(
            new MigrationStepId("safe"),
            new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")),
            MigrationIdempotencyMode.RequireChange);
        var rename = new MigrationStep(
            new MigrationStepId("rename"),
            new RenameTableOperation(ObjectName("T"), ObjectName("T2")),
            MigrationIdempotencyMode.RequireChange);
        var drop = new MigrationStep(
            new MigrationStepId("drop"),
            new DropTableOperation(ObjectName("Old"), DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            MigrationIdempotencyMode.RequireChange);
        var preview = new MigrationPlan(
            new MigrationPlanId("migration-1"), new[] { safe, rename, drop });
        Assert.True(preview.ContainsDestructiveSteps);
        Assert.Equal(new[] { "rename", "drop" },
            preview.DestructiveStepIds.Select(item => item.Value));
        Assert.False(preview.CanApplyNeutralDestructiveSteps);

        Assert.Throws<ArgumentException>(() => preview.CreateDestructiveApproval(
            Array.Empty<MigrationStepId>(), new ApprovalReference("audit")));
        Assert.Throws<ArgumentException>(() => preview.CreateDestructiveApproval(
            new[] { safe.Id }, new ApprovalReference("audit")));
        Assert.Throws<ArgumentException>(() => preview.CreateDestructiveApproval(
            new[] { rename.Id, rename.Id }, new ApprovalReference("audit")));

        var partialApproval = preview.CreateDestructiveApproval(
            new[] { rename.Id }, new ApprovalReference("audit-partial"));
        Assert.Equal(preview.Id, partialApproval.PlanId);
        Assert.Equal(preview.Fingerprint, partialApproval.Fingerprint);
        Assert.Equal(new[] { rename.Id }, partialApproval.StepIds);
        var partial = preview.WithDestructiveApproval(partialApproval);
        Assert.False(partial.CanApplyNeutralDestructiveSteps);
        Assert.False(preview.CanApplyNeutralDestructiveSteps);

        var fullApproval = preview.CreateDestructiveApproval(
            new[] { rename.Id, drop.Id }, new ApprovalReference("audit-full"));
        var approved = partial.WithDestructiveApproval(fullApproval);
        Assert.True(approved.CanApplyNeutralDestructiveSteps);

        var replacement = partial.WithDestructiveApproval(
            preview.CreateDestructiveApproval(
                new[] { drop.Id }, new ApprovalReference("audit-replacement")));
        Assert.False(replacement.CanApplyNeutralDestructiveSteps);

        var retry = new MigrationPlan(preview.Id, new[]
        {
            new MigrationStep(safe.Id,
                new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")), safe.Idempotency),
            new MigrationStep(rename.Id,
                new RenameTableOperation(ObjectName("T"), ObjectName("T2")), rename.Idempotency),
            new MigrationStep(drop.Id,
                new DropTableOperation(ObjectName("Old"), DropObjectBehavior.FailIfMissing, DropScope.Restrict), drop.Idempotency)
        });
        Assert.True(retry.WithDestructiveApproval(fullApproval).CanApplyNeutralDestructiveSteps);

        var stale = new MigrationPlan(preview.Id, new[]
        {
            safe, rename,
            new MigrationStep(drop.Id,
                new DropTableOperation(ObjectName("Different"), DropObjectBehavior.FailIfMissing, DropScope.Restrict),
                drop.Idempotency)
        });
        Assert.Throws<ArgumentException>(() => stale.WithDestructiveApproval(fullApproval));
        var wrongPlan = new MigrationPlan(new MigrationPlanId("migration-2"),
            new[] { safe, rename, drop });
        Assert.Throws<ArgumentException>(() => wrongPlan.WithDestructiveApproval(fullApproval));
    }

    [Fact]
    public void Migration_results_are_ordered_terminal_prefixes_with_contextual_success()
    {
        var accept = Step("accept", MigrationIdempotencyMode.AcceptAlreadySatisfied);
        var require = Step("require", MigrationIdempotencyMode.RequireChange);
        var plan = new MigrationPlan(new MigrationPlanId("result-plan"),
            new[] { accept, require });
        var diagnostic = Diagnostic();

        var incomplete = new MigrationResult(plan, new[]
        {
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Applied)
        });
        Assert.False(incomplete.CanAdvanceVersion);
        Assert.Null(incomplete.FailureBoundary);

        var complete = new MigrationResult(plan, new[]
        {
            new MigrationStepResult(accept.Id, MigrationStepOutcome.AlreadySatisfied),
            new MigrationStepResult(require.Id, MigrationStepOutcome.Applied)
        });
        Assert.True(complete.CanAdvanceVersion);
        Assert.Null(complete.FailureBoundary);

        var contextualTerminal = new MigrationResult(plan, new[]
        {
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Applied),
            new MigrationStepResult(require.Id, MigrationStepOutcome.AlreadySatisfied)
        });
        Assert.False(contextualTerminal.CanAdvanceVersion);
        Assert.Same(contextualTerminal.Results[1], contextualTerminal.FailureBoundary);

        Assert.Throws<ArgumentException>(() => new MigrationResult(plan, new[]
        {
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Failed, diagnostic),
            new MigrationStepResult(require.Id, MigrationStepOutcome.Applied)
        }));
        Assert.Throws<ArgumentException>(() => new MigrationResult(plan, new[]
        {
            new MigrationStepResult(require.Id, MigrationStepOutcome.Applied)
        }));
        Assert.Throws<ArgumentException>(() => new MigrationResult(plan, new[]
        {
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Applied),
            new MigrationStepResult(require.Id, MigrationStepOutcome.Applied),
            new MigrationStepResult(new MigrationStepId("extra"), MigrationStepOutcome.Applied)
        }));

        Assert.True(new MigrationResult(
            new MigrationPlan(new MigrationPlanId("empty"), Array.Empty<MigrationStep>()),
            Array.Empty<MigrationStepResult>()).CanAdvanceVersion);
        Assert.Throws<ArgumentException>(() =>
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Applied, diagnostic));
        Assert.Throws<ArgumentNullException>(() =>
            new MigrationStepResult(accept.Id, MigrationStepOutcome.Failed));
    }

    [Theory]
    [InlineData(MigrationStepOutcome.PreconditionFailed)]
    [InlineData(MigrationStepOutcome.BlockedDestructive)]
    [InlineData(MigrationStepOutcome.Unsupported)]
    [InlineData(MigrationStepOutcome.Failed)]
    public void Migration_terminal_outcomes_freeze_the_exact_boundary(
        MigrationStepOutcome terminalOutcome)
    {
        var first = Step("terminal", MigrationIdempotencyMode.RequireChange);
        var second = Step("unreached", MigrationIdempotencyMode.RequireChange);
        var plan = new MigrationPlan(
            new MigrationPlanId("terminal-plan"), new[] { first, second });
        var terminal = new MigrationStepResult(
            first.Id, terminalOutcome, Diagnostic());

        var result = new MigrationResult(plan, new[] { terminal });

        Assert.False(result.CanAdvanceVersion);
        Assert.Same(terminal, result.FailureBoundary);
        Assert.Throws<ArgumentException>(() => new MigrationResult(plan, new[]
        {
            terminal,
            new MigrationStepResult(second.Id, MigrationStepOutcome.Applied)
        }));
    }

    [Fact]
    public void Metadata_requests_are_scoped_structured_and_separate_from_results()
    {
        var table = ObjectName("Users", "app");
        var operations = new MetadataQueryOperation[]
        {
            new ListTablesOperation(SchemaScope.ForSchema(Id("app"))),
            new GetTableMetadataOperation(table),
            new ListColumnsOperation(table),
            new GetColumnMetadataOperation(table, Id("Id")),
            new ListIndexesOperation(table),
            new GetIndexMetadataOperation(table, Id("IX_Users_Id"))
        };
        Assert.All(operations, operation => Assert.IsAssignableFrom<SqlStatement>(operation));
        Assert.Equal(Id("app"), ((ListTablesOperation)operations[0]).Scope.Schema);
        Assert.Same(table, ((GetTableMetadataOperation)operations[1]).Table);
        Assert.Same(table, ((ListColumnsOperation)operations[2]).Table);
        Assert.Equal(Id("Id"), ((GetColumnMetadataOperation)operations[3]).Column);
        Assert.Same(table, ((ListIndexesOperation)operations[4]).Table);
        Assert.Equal(Id("IX_Users_Id"), ((GetIndexMetadataOperation)operations[5]).Index);
        Assert.All(operations, operation => Assert.False(operation.GetType().IsAbstract));
    }

    [Fact]
    public void Metadata_lookup_factories_cannot_construct_contradictory_state()
    {
        var table = new TableMetadata(SampleTable());
        var found = MetadataLookupResult<TableMetadata>.Found(table);
        var missing = MetadataLookupResult<TableMetadata>.NotFound();
        Assert.Equal(MetadataLookupStatus.Found, found.Status);
        Assert.Same(table, found.Value);
        Assert.Equal(MetadataLookupStatus.NotFound, missing.Status);
        Assert.Null(missing.Value);
        AssertEqualAndHash(
            found,
            MetadataLookupResult<TableMetadata>.Found(
                new TableMetadata(CloneTable(table.Definition))));
        AssertEqualAndHash(
            missing,
            MetadataLookupResult<TableMetadata>.NotFound());
        Assert.NotEqual(found, missing);
        Assert.Throws<ArgumentNullException>(() =>
            MetadataLookupResult<TableMetadata>.Found(null!));
        Assert.Equal(
            new[] { "Found", "NotFound" },
            typeof(MetadataLookupResult<TableMetadata>)
                .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Select(method => method.Name)
                .OrderBy(name => name, StringComparer.Ordinal));
    }

    [Fact]
    public void Metadata_collections_are_canonical_read_only_and_structurally_equal()
    {
        var a = new TableMetadata(new TableDefinition(
            new SqlObjectName(Id("catalog"), Id("app"), Id("A")),
            new[] { Column("Id", LogicalDbType.Int32) }));
        var b = new TableMetadata(new TableDefinition(
            new SqlObjectName(null, Id("app"), Id("B")),
            new[] { Column("Id", LogicalDbType.Int32) }));
        var c = new TableMetadata(new TableDefinition(
            new SqlObjectName(null, null, Id("C")),
            new[] { Column("Id", LogicalDbType.Int32) }));
        var token = new SchemaToken("token-1");
        var list = new List<TableMetadata> { a, c, b };
        var tables = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found, token, list);
        list.Clear();
        Assert.Equal(new[] { "C", "B", "A" },
            tables.Items.Select(item => item.Definition.Name.Name.Value));
        Assert.Throws<NotSupportedException>(() =>
            ((IList<TableMetadata>)tables.Items).Clear());

        var columns = new ColumnMetadataCollectionResult(
            MetadataCollectionStatus.Found, token,
            new[]
            {
                new ColumnMetadata(a.Definition.Name, Column("B", LogicalDbType.Int32), 1),
                new ColumnMetadata(a.Definition.Name, Column("Z", LogicalDbType.Int32), 0),
                new ColumnMetadata(a.Definition.Name, Column("A", LogicalDbType.Int32), 1)
            });
        Assert.Equal(new[] { "Z", "A", "B" },
            columns.Items.Select(item => item.Definition.Name.Value));

        var indexes = new IndexMetadataCollectionResult(
            MetadataCollectionStatus.Found, token,
            new[]
            {
                new IndexMetadata(a.Definition.Name, Index("Z")),
                new IndexMetadata(a.Definition.Name, Index("A"))
            });
        Assert.Equal(new[] { "A", "Z" },
            indexes.Items.Select(item => item.Definition.Name.Value));

        var snapshot = new SchemaMetadataSnapshot(token, new[] { a, c, b });
        Assert.Equal(tables.Items, snapshot.Tables);
        AssertEqualAndHash(snapshot,
            new SchemaMetadataSnapshot(new SchemaToken("token-1"), new[] { b, a, c }));
        AssertEqualAndHash(tables,
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found, new SchemaToken("token-1"),
                new[] { b, a, c }));

        var empty = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found, token, Array.Empty<TableMetadata>());
        Assert.Empty(empty.Items);
        Assert.Throws<NotSupportedException>(() =>
            ((IList<TableMetadata>)empty.Items).Add(a));
        Assert.Throws<ArgumentException>(() =>
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token, new[] { a }));
        Assert.Throws<ArgumentException>(() =>
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token,
                new[] { new ColumnMetadata(a.Definition.Name,
                    Column("Id", LogicalDbType.Int32), 0) }));
        Assert.Throws<ArgumentException>(() =>
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token,
                new[] { new IndexMetadata(a.Definition.Name, Index("A")) }));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ColumnMetadata(a.Definition.Name,
                Column("Id", LogicalDbType.Int32), -1));
    }

    [Fact]
    public void Metadata_collections_reject_duplicate_canonical_keys_in_both_orders()
    {
        var token = new SchemaToken("duplicate-key-token");
        var tableName = ObjectName("Users", "app");
        var firstTable = new TableMetadata(new TableDefinition(
            tableName,
            new[] { Column("Id", LogicalDbType.Int32) }));
        var secondTable = new TableMetadata(new TableDefinition(
            ObjectName("Users", "app"),
            new[] { Column("Id", LogicalDbType.Int64) }));

        AssertRejectedInBothOrders(firstTable, secondTable, items =>
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found, token, items));
        AssertRejectedInBothOrders(firstTable, secondTable, items =>
            new SchemaMetadataSnapshot(token, items));

        var legalTables = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            token,
            new[]
            {
                firstTable,
                new TableMetadata(new TableDefinition(
                    ObjectName("Users", "other"),
                    new[] { Column("Id", LogicalDbType.Int32) })),
                new TableMetadata(new TableDefinition(
                    ObjectName("Users", "app", "catalog"),
                    new[] { Column("Id", LogicalDbType.Int32) }))
            });
        Assert.Equal(3, legalTables.Items.Count);

        var firstColumn = new ColumnMetadata(
            tableName, Column("Status", LogicalDbType.Int32), 3);
        var secondColumn = new ColumnMetadata(
            tableName, Column("Status", LogicalDbType.String), 3);
        AssertRejectedInBothOrders(firstColumn, secondColumn, items =>
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found, token, items));

        var legalColumns = new ColumnMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            token,
            new[]
            {
                new ColumnMetadata(
                    tableName, Column("Status", LogicalDbType.Int32), 3),
                new ColumnMetadata(
                    tableName, Column("Status", LogicalDbType.Int64), 4),
                new ColumnMetadata(
                    tableName, Column("Other", LogicalDbType.Int64), 3)
            });
        Assert.Equal(3, legalColumns.Items.Count);

        var firstIndex = new IndexMetadata(
            tableName,
            new IndexDefinition(
                Id("IX_Users_Status"),
                new[]
                {
                    new IndexColumnDefinition(
                        Id("Status"), SqlSortDirection.Ascending)
                },
                IndexUniqueness.NonUnique));
        var secondIndex = new IndexMetadata(
            tableName,
            new IndexDefinition(
                Id("IX_Users_Status"),
                new[]
                {
                    new IndexColumnDefinition(
                        Id("Status"), SqlSortDirection.Descending)
                },
                IndexUniqueness.Unique));
        AssertRejectedInBothOrders(firstIndex, secondIndex, items =>
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found, token, items));
    }

    [Fact]
    public void Every_metadata_value_and_result_has_structural_equality_and_field_sensitivity()
    {
        var tableName = ObjectName("T", "app");
        var tableDefinition = new TableDefinition(
            tableName, new[] { Column("Id", LogicalDbType.Int32) });
        var columnDefinition = Column("Id", LogicalDbType.Int32);
        var indexDefinition = Index("IX");

        var column = new ColumnMetadata(tableName, columnDefinition, 0);
        AssertEqualAndHash(
            column,
            new ColumnMetadata(
                ObjectName("T", "app"),
                Column("Id", LogicalDbType.Int32), 0));
        Assert.NotEqual(column,
            new ColumnMetadata(ObjectName("Other", "app"), columnDefinition, 0));
        Assert.NotEqual(column,
            new ColumnMetadata(tableName, Column("Other", LogicalDbType.Int32), 0));
        Assert.NotEqual(column,
            new ColumnMetadata(tableName, columnDefinition, 1));

        var index = new IndexMetadata(tableName, indexDefinition);
        AssertEqualAndHash(
            index,
            new IndexMetadata(ObjectName("T", "app"), Index("IX")));
        Assert.NotEqual(index,
            new IndexMetadata(ObjectName("Other", "app"), indexDefinition));
        Assert.NotEqual(index,
            new IndexMetadata(tableName, Index("Other")));

        var table = new TableMetadata(tableDefinition);
        AssertEqualAndHash(
            table,
            new TableMetadata(CloneTable(tableDefinition)));
        Assert.NotEqual(table,
            new TableMetadata(new TableDefinition(
                ObjectName("Other", "app"), tableDefinition.Columns)));

        var token = new SchemaToken("token");
        var tableResult = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found, token, new[] { table });
        AssertEqualAndHash(
            tableResult,
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("token"),
                new[] { new TableMetadata(CloneTable(tableDefinition)) }));
        Assert.NotEqual(tableResult,
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("other"), new[] { table }));
        Assert.NotEqual(tableResult,
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                new[]
                {
                    new TableMetadata(new TableDefinition(
                        ObjectName("Other", "app"), tableDefinition.Columns))
                }));
        Assert.NotEqual(
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                Array.Empty<TableMetadata>()),
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token,
                Array.Empty<TableMetadata>()));

        var columnResult = new ColumnMetadataCollectionResult(
            MetadataCollectionStatus.Found, token, new[] { column });
        AssertEqualAndHash(
            columnResult,
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("token"),
                new[]
                {
                    new ColumnMetadata(
                        ObjectName("T", "app"),
                        Column("Id", LogicalDbType.Int32), 0)
                }));
        Assert.NotEqual(columnResult,
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("other"), new[] { column }));
        Assert.NotEqual(columnResult,
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                new[]
                {
                    new ColumnMetadata(tableName, columnDefinition, 1)
                }));
        Assert.NotEqual(
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                Array.Empty<ColumnMetadata>()),
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token,
                Array.Empty<ColumnMetadata>()));

        var indexResult = new IndexMetadataCollectionResult(
            MetadataCollectionStatus.Found, token, new[] { index });
        AssertEqualAndHash(
            indexResult,
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("token"),
                new[]
                {
                    new IndexMetadata(
                        ObjectName("T", "app"), Index("IX"))
                }));
        Assert.NotEqual(indexResult,
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("other"), new[] { index }));
        Assert.NotEqual(indexResult,
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                new[] { new IndexMetadata(tableName, Index("Other")) }));
        Assert.NotEqual(
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found, token,
                Array.Empty<IndexMetadata>()),
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.TargetNotFound, token,
                Array.Empty<IndexMetadata>()));

        var snapshot = new SchemaMetadataSnapshot(token, new[] { table });
        AssertEqualAndHash(
            snapshot,
            new SchemaMetadataSnapshot(
                new SchemaToken("token"),
                new[] { new TableMetadata(CloneTable(tableDefinition)) }));
        Assert.NotEqual(snapshot,
            new SchemaMetadataSnapshot(
                new SchemaToken("other"), new[] { table }));
        Assert.NotEqual(snapshot,
            new SchemaMetadataSnapshot(
                token,
                new[]
                {
                    new TableMetadata(new TableDefinition(
                        ObjectName("Other", "app"), tableDefinition.Columns))
                }));
    }

    [Fact]
    public void Metadata_canonical_order_is_ordinal_not_current_culture()
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
            var table = ObjectName("T");
            var result = new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("token"),
                new[]
                {
                    new IndexMetadata(table, Index("ı")),
                    new IndexMetadata(table, Index("İ")),
                    new IndexMetadata(table, Index("i")),
                    new IndexMetadata(table, Index("I"))
                });

            Assert.Equal(new[] { "I", "i", "İ", "ı" },
                result.Items.Select(item => item.Definition.Name.Value));
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void Diagnostic_request_and_result_matrix_is_exact_and_sanitized_only()
    {
        foreach (var kind in Enum.GetValues<DatabaseDiagnosticKind>())
        {
            var operation = new DatabaseDiagnosticOperation(kind);
            Assert.Equal(kind, operation.Kind);
            Assert.IsAssignableFrom<SqlStatement>(operation);
        }

        var valid = new[]
        {
            new DatabaseDiagnosticResult(new DiagnosticCode("INFO"),
                DatabaseDiagnosticStatus.Healthy, DiagnosticSeverity.Information, "healthy"),
            new DatabaseDiagnosticResult(new DiagnosticCode("WARN"),
                DatabaseDiagnosticStatus.Warning, DiagnosticSeverity.Warning, "warning"),
            new DatabaseDiagnosticResult(new DiagnosticCode("FAIL"),
                DatabaseDiagnosticStatus.Failed, DiagnosticSeverity.Error, "failed")
        };
        Assert.Equal("healthy", valid[0].SanitizedMessage);
        Assert.All(valid, result => Assert.False(
            typeof(SqlNode).IsAssignableFrom(result.GetType())));

        foreach (var status in Enum.GetValues<DatabaseDiagnosticStatus>())
        foreach (var severity in Enum.GetValues<DiagnosticSeverity>())
        {
            var isValid =
                status == DatabaseDiagnosticStatus.Healthy && severity == DiagnosticSeverity.Information ||
                status == DatabaseDiagnosticStatus.Warning && severity == DiagnosticSeverity.Warning ||
                status == DatabaseDiagnosticStatus.Failed && severity == DiagnosticSeverity.Error;
            if (!isValid)
            {
                Assert.Throws<ArgumentException>(() => new DatabaseDiagnosticResult(
                    new DiagnosticCode("X"), status, severity, "message"));
            }
        }
        Assert.Throws<ArgumentException>(() => new DatabaseDiagnosticResult(
            new DiagnosticCode("X"), DatabaseDiagnosticStatus.Healthy,
            DiagnosticSeverity.Information, " "));
        Assert.False(typeof(SqlAstDiagnostic).IsAssignableFrom(typeof(DatabaseDiagnosticResult)));
    }

    [Fact]
    public void Admin_operations_have_neutral_shapes_scopes_and_direct_denial()
    {
        var database = Id("appdb");
        var handle = Resource("00112233-4455-6677-8899-aabbccddeeff", 'a');
        var create = new CreateDatabaseOperation(
            database, CreateObjectBehavior.AlreadySatisfiedIfExists);
        var export = new DatabaseExportOperation(
            database, handle, DatabaseTransferFormat.ProviderNative,
            DatabaseTransferScope.DataOnly);
        var safeImport = new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaOnly,
            DatabaseImportConflictPolicy.SkipExisting);
        var drop = new DropDatabaseOperation(
            database, DropObjectBehavior.FailIfMissing);
        var replace = new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);

        Assert.Equal(DestructiveImpact.None, create.Impact);
        Assert.True(create.CanExecute);
        Assert.Equal(DestructiveImpact.None, export.Impact);
        Assert.True(export.CanExecute);
        Assert.Equal(DestructiveImpact.None, safeImport.Impact);
        Assert.True(safeImport.CanExecute);
        Assert.Equal(DestructiveImpact.PotentialDataLoss, drop.Impact);
        Assert.False(drop.CanExecute);
        Assert.Equal(DestructiveImpact.PotentialDataLoss, replace.Impact);
        Assert.False(replace.CanExecute);
        Assert.Matches("^sha256:[0-9a-f]{64}$", drop.Fingerprint.Value);
        Assert.Matches("^sha256:[0-9a-f]{64}$", replace.Fingerprint.Value);

        Assert.Throws<ArgumentException>(() => new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaOnly,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase));
        Assert.Throws<ArgumentException>(() => new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.DataOnly,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase));
        Assert.Throws<ArgumentException>(() => new DropDatabaseOperation(
            database, DropObjectBehavior.FailIfMissing,
            new ExpectedStructuralFingerprint("sha256:" + new string('0', 64))));
        Assert.Throws<ArgumentException>(() => new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase,
            new ExpectedStructuralFingerprint("sha256:" + new string('0', 64))));
    }

    [Fact]
    public void Admin_approval_is_copy_on_write_and_bound_to_every_destructive_field()
    {
        var database = Id("appdb");
        var handle = Resource("00112233-4455-6677-8899-aabbccddeeff", 'a');
        var drop = new DropDatabaseOperation(
            database, DropObjectBehavior.FailIfMissing);
        var approval = drop.CreateApproval(new ApprovalReference("drop-audit"));
        Assert.Equal(AdminOperationKind.DropDatabase, approval.Kind);
        Assert.Equal(database, approval.Target);
        Assert.Equal(drop.Fingerprint, approval.Fingerprint);
        var approvedDrop = drop.WithApproval(approval);
        Assert.True(approvedDrop.CanExecute);
        Assert.False(drop.CanExecute);
        Assert.True(new DropDatabaseOperation(
                database, DropObjectBehavior.FailIfMissing)
            .WithApproval(approval).CanExecute);
        Assert.Throws<ArgumentException>(() => new DropDatabaseOperation(
            Id("other"), DropObjectBehavior.FailIfMissing).WithApproval(approval));
        Assert.Throws<ArgumentException>(() => new DropDatabaseOperation(
            database, DropObjectBehavior.AlreadySatisfiedIfMissing).WithApproval(approval));

        var replace = new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        var replaceApproval = replace.CreateApproval(
            new ApprovalReference("replace-audit"));
        Assert.Equal(AdminOperationKind.ReplaceImport, replaceApproval.Kind);
        Assert.True(replace.WithApproval(replaceApproval).CanExecute);
        Assert.False(replace.CanExecute);

        var stale = new DatabaseAdminOperation[]
        {
            new DatabaseImportOperation(Id("other"), handle,
                DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.ReplaceTargetDatabase),
            new DatabaseImportOperation(database,
                Resource("00112233-4455-6677-8899-aabbccddeefe", 'a'),
                DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.ReplaceTargetDatabase),
            new DatabaseImportOperation(database,
                Resource("00112233-4455-6677-8899-aabbccddeeff", 'b'),
                DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.ReplaceTargetDatabase),
            new DatabaseImportOperation(database, handle,
                DatabaseTransferFormat.DelimitedText, DatabaseTransferScope.SchemaAndData,
                DatabaseImportConflictPolicy.ReplaceTargetDatabase)
        };
        Assert.All(stale, operation => Assert.Throws<ArgumentException>(() =>
            ((DatabaseImportOperation)operation).WithApproval(replaceApproval)));

        var safe = new DatabaseImportOperation(
            database, handle, DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.FailOnConflict);
        Assert.Throws<InvalidOperationException>(() =>
            safe.CreateApproval(new ApprovalReference("not-needed")));
        Assert.Throws<InvalidOperationException>(() =>
            safe.WithApproval(replaceApproval));
    }

    [Fact]
    public void Admin_results_correlate_request_approval_and_diagnostic_matrix()
    {
        var safe = new CreateDatabaseOperation(
            Id("db"), CreateObjectBehavior.FailIfExists);
        var drop = new DropDatabaseOperation(
            Id("db"), DropObjectBehavior.FailIfMissing);
        var approvedDrop = drop.WithApproval(
            drop.CreateApproval(new ApprovalReference("audit")));
        var diagnostic = Diagnostic();

        Assert.Same(safe, new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.Applied).Request);
        Assert.Same(approvedDrop, new DatabaseAdminResult(
            approvedDrop, DatabaseAdminOutcome.AlreadySatisfied).Request);
        Assert.Same(drop, new DatabaseAdminResult(
            drop, DatabaseAdminOutcome.BlockedDestructive, diagnostic).Request);
        Assert.Same(diagnostic, new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.Unsupported, diagnostic).Diagnostic);
        Assert.NotNull(new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.Failed, diagnostic));

        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.Applied, diagnostic));
        Assert.Throws<ArgumentNullException>(() => new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.Unsupported));
        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            drop, DatabaseAdminOutcome.Applied));
        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            safe, DatabaseAdminOutcome.BlockedDestructive, diagnostic));
        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            approvedDrop, DatabaseAdminOutcome.BlockedDestructive, diagnostic));
    }

    [Fact]
    public void Database_admin_base_constructor_cannot_be_used_as_boolean_approval()
    {
        var constructor = Assert.Single(typeof(DatabaseAdminOperation)
            .GetConstructors(BindingFlags.Instance | BindingFlags.NonPublic |
                             BindingFlags.DeclaredOnly));

        Assert.True(constructor.IsFamilyAndAssembly);
        Assert.False(constructor.IsFamily);
        Assert.Equal(
            new[] { typeof(DestructiveImpact), typeof(AdminTargetApproval) },
            constructor.GetParameters().Select(parameter => parameter.ParameterType));
        Assert.DoesNotContain(constructor.GetParameters(),
            parameter => parameter.ParameterType == typeof(bool));
    }

    [Fact]
    public void Admin_results_reject_unknown_admin_operation_subtypes()
    {
        var forged = CreateUninitializedAdminSubtype();

        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            forged, DatabaseAdminOutcome.Applied));
        Assert.Throws<ArgumentException>(() => new DatabaseAdminResult(
            forged, DatabaseAdminOutcome.Failed, Diagnostic()));
    }

    [Fact]
    public void Every_task6_constructor_required_reference_is_null_guarded()
    {
        var constructors = typeof(MigrationPlan).Assembly.GetTypes()
            .Where(type => Task6ConcreteTypeNames.Contains(type.Name))
            .Where(type => !type.ContainsGenericParameters)
            .SelectMany(type => type.GetConstructors())
            .OrderBy(constructor => constructor.DeclaringType!.Name,
                StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(constructors);
        foreach (var constructor in constructors)
        {
            var baseline = ValidTask6ConstructorArguments(constructor);
            Assert.Equal(constructor.GetParameters().Length, baseline.Length);
            constructor.Invoke(baseline);

            var parameters = constructor.GetParameters();
            for (var index = 0; index < parameters.Length; index++)
            {
                var parameter = parameters[index];
                if (parameter.ParameterType.IsValueType ||
                    parameter.HasDefaultValue && parameter.DefaultValue == null)
                {
                    continue;
                }

                var mutated = (object?[])baseline.Clone();
                mutated[index] = null;
                var exception = Assert.Throws<TargetInvocationException>(() =>
                    constructor.Invoke(mutated));
                Assert.IsAssignableFrom<ArgumentNullException>(
                    exception.InnerException);
            }
        }
    }

    [Fact]
    public void Every_task6_factory_required_reference_is_null_guarded()
    {
        Assert.Throws<ArgumentNullException>(() => SchemaScope.ForSchema(null!));
        Assert.Throws<ArgumentNullException>(() =>
            SchemaScope.ForCatalogAndSchema(null!, Id("app")));
        Assert.Throws<ArgumentNullException>(() =>
            SchemaScope.ForCatalogAndSchema(Id("catalog"), null!));
        Assert.Throws<ArgumentNullException>(() =>
            MetadataLookupResult<TableMetadata>.Found(null!));

        var destructive = new MigrationPlan(
            new MigrationPlanId("null-factory-plan"),
            new[]
            {
                new MigrationStep(
                    new MigrationStepId("drop"),
                    new DropTableOperation(
                        ObjectName("Old"),
                        DropObjectBehavior.FailIfMissing,
                        DropScope.Restrict),
                    MigrationIdempotencyMode.RequireChange)
            });
        Assert.Throws<ArgumentNullException>(() =>
            destructive.CreateDestructiveApproval(
                null!, new ApprovalReference("audit")));
        Assert.Throws<ArgumentNullException>(() =>
            destructive.CreateDestructiveApproval(
                destructive.DestructiveStepIds, null!));
        Assert.Throws<ArgumentNullException>(() =>
            destructive.WithDestructiveApproval(null!));

        var drop = new DropDatabaseOperation(
            Id("db"), DropObjectBehavior.FailIfMissing);
        Assert.Throws<ArgumentNullException>(() => drop.CreateApproval(null!));
        Assert.Throws<ArgumentNullException>(() => drop.WithApproval(null!));

        var replacement = new DatabaseImportOperation(
            Id("db"),
            Resource("00112233-4455-6677-8899-aabbccddeeff", 'a'),
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData,
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        Assert.Throws<ArgumentNullException>(() =>
            replacement.CreateApproval(null!));
        Assert.Throws<ArgumentNullException>(() =>
            replacement.WithApproval(null!));
    }

    [Fact]
    public void Every_task6_collection_is_defensively_copied_and_fully_read_only()
    {
        var indexColumn = new IndexColumnDefinition(
            Id("Id"), SqlSortDirection.Ascending);
        var indexColumns = new List<IndexColumnDefinition> { indexColumn };
        var index = new IndexDefinition(
            Id("IX"), indexColumns, IndexUniqueness.NonUnique);
        indexColumns.Clear();
        Assert.Single(index.Columns);
        AssertFullyReadOnly(index.Columns, indexColumn);
        Assert.Throws<ArgumentException>(() => new IndexDefinition(
            Id("IX_Null"), new IndexColumnDefinition[] { null! },
            IndexUniqueness.NonUnique));

        var primaryColumn = Id("Id");
        var primaryColumns = new List<SqlIdentifier> { primaryColumn };
        var primary = new PrimaryKeyDefinition(Id("PK"), primaryColumns);
        primaryColumns.Clear();
        Assert.Single(primary.Columns);
        AssertFullyReadOnly(primary.Columns, primaryColumn);
        Assert.Throws<ArgumentException>(() => new PrimaryKeyDefinition(
            Id("PK_Null"), new SqlIdentifier[] { null! }));

        var uniqueColumn = Id("Value");
        var uniqueColumns = new List<SqlIdentifier> { uniqueColumn };
        var unique = new UniqueConstraintDefinition(Id("UQ"), uniqueColumns);
        uniqueColumns.Clear();
        Assert.Single(unique.Columns);
        AssertFullyReadOnly(unique.Columns, uniqueColumn);
        Assert.Throws<ArgumentException>(() => new UniqueConstraintDefinition(
            Id("UQ_Null"), new SqlIdentifier[] { null! }));

        var localColumn = Id("RoleId");
        var referencedColumn = Id("Id");
        var localColumns = new List<SqlIdentifier> { localColumn };
        var referencedColumns = new List<SqlIdentifier> { referencedColumn };
        var foreignColumns = new ForeignKeyColumnSet(
            localColumns, referencedColumns);
        localColumns.Clear();
        referencedColumns.Clear();
        Assert.Single(foreignColumns.LocalColumns);
        Assert.Single(foreignColumns.ReferencedColumns);
        AssertFullyReadOnly(foreignColumns.LocalColumns, localColumn);
        AssertFullyReadOnly(foreignColumns.ReferencedColumns, referencedColumn);
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new SqlIdentifier[] { null! }, new[] { referencedColumn }));
        Assert.Throws<ArgumentException>(() => new ForeignKeyColumnSet(
            new[] { localColumn }, new SqlIdentifier[] { null! }));

        var column = Column("Id", LogicalDbType.Int64);
        var constraints = new List<ConstraintDefinition> { primary, unique };
        var indexes = new List<IndexDefinition> { index };
        var columns = new List<ColumnDefinition> { column };
        var table = new TableDefinition(
            ObjectName("T"), columns, constraints, indexes);
        columns.Clear();
        constraints.Clear();
        indexes.Clear();
        Assert.Single(table.Columns);
        Assert.Equal(2, table.Constraints.Count);
        Assert.Single(table.Indexes);
        AssertFullyReadOnly(table.Columns, column);
        AssertFullyReadOnly(table.Constraints, primary);
        AssertFullyReadOnly(table.Indexes, index);
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("NullColumn"), new ColumnDefinition[] { null! }));
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("NullConstraint"), new[] { column },
            new ConstraintDefinition[] { null! }));
        Assert.Throws<ArgumentException>(() => new TableDefinition(
            ObjectName("NullIndex"), new[] { column },
            indexes: new IndexDefinition[] { null! }));

        var minimalTable = new TableDefinition(
            ObjectName("Minimal"), new[] { column });
        AssertFullyReadOnly(minimalTable.Constraints, primary);
        AssertFullyReadOnly(minimalTable.Indexes, index);

        var step = new MigrationStep(
            new MigrationStepId("drop"),
            new DropTableOperation(
                ObjectName("Old"), DropObjectBehavior.FailIfMissing,
                DropScope.Restrict),
            MigrationIdempotencyMode.RequireChange);
        var stepInput = new List<MigrationStep> { step };
        var plan = new MigrationPlan(
            new MigrationPlanId("copy-plan"), stepInput);
        stepInput.Clear();
        Assert.Single(plan.Steps);
        AssertFullyReadOnly(plan.Steps, step);
        AssertFullyReadOnly(plan.DestructiveStepIds, step.Id);
        Assert.Throws<ArgumentException>(() => new MigrationPlan(
            new MigrationPlanId("null-step"),
            new MigrationStep[] { null! }));

        var approvalIds = new List<MigrationStepId> { step.Id };
        var approval = plan.CreateDestructiveApproval(
            approvalIds, new ApprovalReference("audit"));
        approvalIds.Clear();
        Assert.Single(approval.StepIds);
        AssertFullyReadOnly(approval.StepIds, step.Id);
        Assert.Throws<ArgumentException>(() =>
            plan.CreateDestructiveApproval(
                new MigrationStepId[] { null! },
                new ApprovalReference("audit-null")));

        var stepResult = new MigrationStepResult(
            step.Id, MigrationStepOutcome.Applied);
        var resultInput = new List<MigrationStepResult> { stepResult };
        var migrationResult = new MigrationResult(plan, resultInput);
        resultInput.Clear();
        Assert.Single(migrationResult.Results);
        AssertFullyReadOnly(migrationResult.Results, stepResult);
        Assert.Throws<ArgumentException>(() => new MigrationResult(
            plan, new MigrationStepResult[] { null! }));

        var tableMetadata = new TableMetadata(table);
        var tableItems = new List<TableMetadata> { tableMetadata };
        var tableResult = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("tables"), tableItems);
        tableItems.Clear();
        Assert.Single(tableResult.Items);
        AssertFullyReadOnly(tableResult.Items, tableMetadata);
        Assert.Throws<ArgumentException>(() =>
            new TableMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("null-table"),
                new TableMetadata[] { null! }));

        var columnMetadata = new ColumnMetadata(table.Name, column, 0);
        var columnItems = new List<ColumnMetadata> { columnMetadata };
        var columnResult = new ColumnMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("columns"), columnItems);
        columnItems.Clear();
        Assert.Single(columnResult.Items);
        AssertFullyReadOnly(columnResult.Items, columnMetadata);
        Assert.Throws<ArgumentException>(() =>
            new ColumnMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("null-column"),
                new ColumnMetadata[] { null! }));

        var indexMetadata = new IndexMetadata(table.Name, index);
        var indexItems = new List<IndexMetadata> { indexMetadata };
        var indexResult = new IndexMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("indexes"), indexItems);
        indexItems.Clear();
        Assert.Single(indexResult.Items);
        AssertFullyReadOnly(indexResult.Items, indexMetadata);
        Assert.Throws<ArgumentException>(() =>
            new IndexMetadataCollectionResult(
                MetadataCollectionStatus.Found,
                new SchemaToken("null-index"),
                new IndexMetadata[] { null! }));

        var snapshotItems = new List<TableMetadata> { tableMetadata };
        var snapshot = new SchemaMetadataSnapshot(
            new SchemaToken("snapshot"), snapshotItems);
        snapshotItems.Clear();
        Assert.Single(snapshot.Tables);
        AssertFullyReadOnly(snapshot.Tables, tableMetadata);
        Assert.Throws<ArgumentException>(() => new SchemaMetadataSnapshot(
            new SchemaToken("null-snapshot"),
            new TableMetadata[] { null! }));

        var emptyPlan = new MigrationPlan(
            new MigrationPlanId("empty-copy-plan"),
            Array.Empty<MigrationStep>());
        AssertFullyReadOnly(emptyPlan.Steps, step);
        AssertFullyReadOnly(emptyPlan.DestructiveStepIds, step.Id);
        var emptyMigrationResult = new MigrationResult(
            emptyPlan, Array.Empty<MigrationStepResult>());
        AssertFullyReadOnly(emptyMigrationResult.Results, stepResult);

        var emptyTables = new TableMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("empty-tables"), Array.Empty<TableMetadata>());
        var emptyColumns = new ColumnMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("empty-columns"), Array.Empty<ColumnMetadata>());
        var emptyIndexes = new IndexMetadataCollectionResult(
            MetadataCollectionStatus.Found,
            new SchemaToken("empty-indexes"), Array.Empty<IndexMetadata>());
        var emptySnapshot = new SchemaMetadataSnapshot(
            new SchemaToken("empty-snapshot"), Array.Empty<TableMetadata>());
        AssertFullyReadOnly(emptyTables.Items, tableMetadata);
        AssertFullyReadOnly(emptyColumns.Items, columnMetadata);
        AssertFullyReadOnly(emptyIndexes.Items, indexMetadata);
        AssertFullyReadOnly(emptySnapshot.Tables, tableMetadata);
    }

    [Fact]
    public void Every_task6_enum_input_rejects_undefined_values()
    {
        var table = SampleTable();
        var handle = Resource("00112233-4455-6677-8899-aabbccddeeff", 'a');
        const int bad = -1;

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SemanticDefaultDefinition((SemanticDefaultKind)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ComputedGenerationDefinition(BooleanExpression.True, (ComputedStorageKind)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ColumnDefinition(Id("A"), Type(LogicalDbType.Int32), (ColumnNullability)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() => new IndexDefinition(
            Id("IX"), new[]
            {
                new IndexColumnDefinition(Id("A"), SqlSortDirection.Ascending)
            }, (IndexUniqueness)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ReferentialActions((ReferentialAction)bad, ReferentialAction.NoAction));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SequenceOptions(
            1, 1, SequenceBounds.Unbounded(), null, (SequenceCycleBehavior)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new CreateTableOperation(table, (CreateObjectBehavior)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DropTableOperation(table.Name, (DropObjectBehavior)bad, DropScope.Restrict));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DropTableOperation(table.Name, DropObjectBehavior.FailIfMissing, (DropScope)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new MigrationStep(new MigrationStepId("s"),
                new SetTableCommentOperation(table.Name, new SchemaComment("x")),
                (MigrationIdempotencyMode)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new MigrationStepResult(new MigrationStepId("s"), (MigrationStepOutcome)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new TableMetadataCollectionResult((MetadataCollectionStatus)bad,
                new SchemaToken("t"), Array.Empty<TableMetadata>()));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseDiagnosticOperation((DatabaseDiagnosticKind)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseDiagnosticResult(new DiagnosticCode("X"),
                (DatabaseDiagnosticStatus)bad, DiagnosticSeverity.Information, "x"));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseDiagnosticResult(new DiagnosticCode("X"),
                DatabaseDiagnosticStatus.Healthy, (DiagnosticSeverity)bad, "x"));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseExportOperation(Id("db"), handle,
                (DatabaseTransferFormat)bad, DatabaseTransferScope.SchemaAndData));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseExportOperation(Id("db"), handle,
                DatabaseTransferFormat.PortableJson, (DatabaseTransferScope)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseImportOperation(Id("db"), handle,
                DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData,
                (DatabaseImportConflictPolicy)bad));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new DatabaseAdminResult(new CreateDatabaseOperation(
                    Id("db"), CreateObjectBehavior.FailIfExists),
                (DatabaseAdminOutcome)bad));
    }

    [Fact]
    public void Every_task6_enum_taking_constructor_rejects_every_undefined_slot()
    {
        var constructors = typeof(MigrationPlan).Assembly.GetTypes()
            .Where(type => Task6ConcreteTypeNames.Contains(type.Name))
            .Where(type => !type.ContainsGenericParameters)
            .SelectMany(type => type.GetConstructors())
            .ToArray();
        var enumSlots = 0;

        foreach (var constructor in constructors)
        {
            var parameters = constructor.GetParameters();
            for (var index = 0; index < parameters.Length; index++)
            {
                var enumType = parameters[index].ParameterType;
                if (!enumType.IsEnum)
                {
                    continue;
                }

                enumSlots++;
                var arguments = ValidTask6ConstructorArguments(constructor);
                arguments[index] = Enum.ToObject(enumType, -1);
                var exception = Assert.Throws<TargetInvocationException>(() =>
                    constructor.Invoke(arguments));
                Assert.True(
                    exception.InnerException is ArgumentOutOfRangeException,
                    $"{constructor.DeclaringType!.Name}.{parameters[index].Name} " +
                    $"accepted an undefined {enumType.Name}: {exception.InnerException}");
            }
        }

        Assert.True(enumSlots > 0);
    }

    [Fact]
    public void Task6_hierarchy_sealing_and_plain_runtime_results_are_exact()
    {
        var abstractNodes = new[]
        {
            typeof(ColumnDefaultDefinition), typeof(ColumnGenerationDefinition),
            typeof(ConstraintDefinition), typeof(SchemaOperation),
            typeof(MetadataQueryOperation), typeof(DatabaseAdminOperation)
        };
        Assert.All(abstractNodes, type => Assert.True(type.IsAbstract));
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(ColumnDefaultDefinition)));
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(ColumnGenerationDefinition)));
        Assert.True(typeof(SqlStatement).IsAssignableFrom(typeof(SchemaOperation)));
        Assert.True(typeof(SqlStatement).IsAssignableFrom(typeof(MetadataQueryOperation)));
        Assert.True(typeof(SqlStatement).IsAssignableFrom(typeof(DatabaseAdminOperation)));
        Assert.True(typeof(SqlStatement).IsAssignableFrom(typeof(DatabaseDiagnosticOperation)));
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(MigrationStep)));
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(MigrationPlan)));
        Assert.False(typeof(SqlStatement).IsAssignableFrom(typeof(MigrationPlan)));

        var runtimeResults = new[]
        {
            typeof(DatabaseOperationDiagnostic), typeof(MigrationStepResult),
            typeof(MigrationResult), typeof(ColumnMetadata), typeof(IndexMetadata),
            typeof(TableMetadata), typeof(TableMetadataCollectionResult),
            typeof(ColumnMetadataCollectionResult), typeof(IndexMetadataCollectionResult),
            typeof(SchemaMetadataSnapshot),
            typeof(MetadataLookupResult<TableMetadata>),
            typeof(DatabaseDiagnosticResult),
            typeof(DatabaseAdminResult)
        };
        Assert.All(runtimeResults, type =>
        {
            Assert.True(type.IsSealed);
            Assert.False(typeof(SqlNode).IsAssignableFrom(type));
        });

        var concreteTask6Types = typeof(MigrationPlan).Assembly.GetTypes()
            .Where(type => type.Namespace == typeof(MigrationPlan).Namespace)
            .Where(type => !type.GetCustomAttributesData().Any(attribute =>
                attribute.AttributeType == typeof(CompilerGeneratedAttribute)))
            .Where(type => Task6ConcreteTypeNames.Contains(type.Name))
            .ToArray();
        Assert.Equal(Task6ConcreteTypeNames.Count, concreteTask6Types.Length);
        Assert.All(concreteTask6Types, type => Assert.True(type.IsSealed));
        Assert.All(concreteTask6Types.SelectMany(type =>
                type.GetProperties(BindingFlags.Public | BindingFlags.Instance)),
            property => Assert.Null(property.SetMethod));
    }

    [Fact]
    public void Structural_models_expose_typed_equality_and_no_mutable_or_raw_escape_hatch()
    {
        var structural = new[]
        {
            typeof(SchemaComment), typeof(MigrationPlanId), typeof(MigrationStepId),
            typeof(ApprovalReference), typeof(SchemaToken), typeof(DiagnosticCode),
            typeof(StructuralFingerprint), typeof(ExpectedStructuralFingerprint),
            typeof(ResourceContentDigest), typeof(DatabaseResourceHandle),
            typeof(NullDefaultDefinition), typeof(BooleanDefaultDefinition),
            typeof(Int64DefaultDefinition), typeof(DecimalDefaultDefinition),
            typeof(StringDefaultDefinition), typeof(GuidDefaultDefinition),
            typeof(DateTimeDefaultDefinition), typeof(DateTimeOffsetDefaultDefinition),
            typeof(SemanticDefaultDefinition), typeof(IdentityGenerationDefinition),
            typeof(SequenceGenerationDefinition), typeof(ComputedGenerationDefinition),
            typeof(ColumnDefinition), typeof(SchemaName), typeof(SchemaScope),
            typeof(IndexColumnDefinition), typeof(IndexDefinition),
            typeof(PrimaryKeyDefinition), typeof(UniqueConstraintDefinition),
            typeof(ForeignKeyColumnSet), typeof(ReferentialActions),
            typeof(ForeignKeyDefinition), typeof(TableDefinition),
            typeof(SequenceBounds), typeof(SequenceOptions), typeof(SequenceDefinition),
            typeof(ColumnMetadata), typeof(IndexMetadata), typeof(TableMetadata),
            typeof(MetadataLookupResult<TableMetadata>),
            typeof(TableMetadataCollectionResult), typeof(ColumnMetadataCollectionResult),
            typeof(IndexMetadataCollectionResult), typeof(SchemaMetadataSnapshot)
        };
        Assert.All(structural, type => Assert.Contains(
            typeof(IEquatable<>).MakeGenericType(type), type.GetInterfaces()));

        foreach (var type in structural)
        {
            var constructor = type.GetConstructors().SingleOrDefault();
            if (constructor == null)
            {
                continue;
            }

            var first = constructor.Invoke(
                ValidTask6ConstructorArguments(constructor));
            var second = constructor.Invoke(
                ValidTask6ConstructorArguments(constructor));
            Assert.NotSame(first, second);
            Assert.Equal(first, second);
            Assert.Equal(first.GetHashCode(), second.GetHashCode());
        }

        AssertEqualAndHash(SchemaScope.All(), SchemaScope.All());
        AssertEqualAndHash(
            SequenceBounds.Between(-1, 1),
            SequenceBounds.Between(-1, 1));
        AssertEqualAndHash(
            PlanForOperation(
                "structural-fingerprint", "step",
                new RemoveTableCommentOperation(ObjectName("T")),
                MigrationIdempotencyMode.RequireChange).Fingerprint,
            PlanForOperation(
                "structural-fingerprint", "step",
                new RemoveTableCommentOperation(ObjectName("T")),
                MigrationIdempotencyMode.RequireChange).Fingerprint);

        var publicSurface = typeof(MigrationPlan).Assembly.GetTypes()
            .Where(type => Task6PublicTypeNames.Contains(type.Name))
            .SelectMany(type =>
                type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Select(property => (Owner: type, Property: property)))
            .ToArray();
        Assert.DoesNotContain(publicSurface, item =>
            item.Property.PropertyType == typeof(object) ||
            typeof(IDictionary).IsAssignableFrom(item.Property.PropertyType) ||
            typeof(Stream).IsAssignableFrom(item.Property.PropertyType) ||
            typeof(Delegate).IsAssignableFrom(item.Property.PropertyType));
        Assert.DoesNotContain(publicSurface, item =>
            ForbiddenPublicNames.Any(forbidden =>
                item.Property.Name.Contains(forbidden, StringComparison.OrdinalIgnoreCase)));
        Assert.DoesNotContain(typeof(MigrationPlan).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(IEnumerable<SchemaOperation>)));
        Assert.Null(typeof(MigrationPlan).Assembly.GetType(
            "Dos.ORM.SqlAst.MetadataQueryStatement", throwOnError: false));
    }

    private static readonly HashSet<string> Task6ConcreteTypeNames = new(
        new[]
        {
            "SchemaComment", "MigrationPlanId", "MigrationStepId", "ApprovalReference",
            "SchemaToken", "DiagnosticCode", "StructuralFingerprint",
            "ExpectedStructuralFingerprint", "ResourceContentDigest", "DatabaseResourceHandle",
            "NullDefaultDefinition", "BooleanDefaultDefinition", "Int64DefaultDefinition",
            "DecimalDefaultDefinition", "StringDefaultDefinition", "GuidDefaultDefinition",
            "DateTimeDefaultDefinition", "DateTimeOffsetDefaultDefinition",
            "SemanticDefaultDefinition", "IdentityGenerationDefinition",
            "SequenceGenerationDefinition", "ComputedGenerationDefinition", "ColumnDefinition",
            "SchemaName", "SchemaScope", "IndexColumnDefinition", "IndexDefinition",
            "PrimaryKeyDefinition", "UniqueConstraintDefinition", "ForeignKeyColumnSet",
            "ReferentialActions", "ForeignKeyDefinition", "TableDefinition", "SequenceBounds",
            "SequenceOptions", "SequenceDefinition", "CreateSchemaOperation",
            "DropSchemaOperation", "CreateTableOperation", "RenameTableOperation",
            "DropTableOperation", "AddColumnOperation", "AlterColumnOperation",
            "RenameColumnOperation", "DropColumnOperation", "AddConstraintOperation",
            "DropConstraintOperation", "CreateIndexOperation", "DropIndexOperation",
            "CreateSequenceOperation", "AlterSequenceOperation", "DropSequenceOperation",
            "SetTableCommentOperation", "RemoveTableCommentOperation",
            "SetColumnCommentOperation", "RemoveColumnCommentOperation", "MigrationStep",
            "MigrationPlan", "DestructiveMigrationApproval", "DatabaseOperationDiagnostic",
            "MigrationStepResult", "MigrationResult", "ListTablesOperation",
            "GetTableMetadataOperation", "ListColumnsOperation", "GetColumnMetadataOperation",
            "ListIndexesOperation", "GetIndexMetadataOperation", "ColumnMetadata",
            "IndexMetadata", "TableMetadata", "TableMetadataCollectionResult",
            "MetadataLookupResult`1",
            "ColumnMetadataCollectionResult", "IndexMetadataCollectionResult",
            "SchemaMetadataSnapshot", "DatabaseDiagnosticOperation", "DatabaseDiagnosticResult",
            "CreateDatabaseOperation", "DropDatabaseOperation", "DatabaseExportOperation",
            "DatabaseImportOperation", "AdminTargetApproval", "DatabaseAdminResult"
        },
        StringComparer.Ordinal);

    private static readonly HashSet<string> Task6PublicTypeNames = new(
        Task6ConcreteTypeNames.Concat(new[]
        {
            "ColumnDefaultDefinition", "ColumnGenerationDefinition", "ConstraintDefinition",
            "SchemaOperation", "MetadataQueryOperation", "DatabaseAdminOperation"
        }),
        StringComparer.Ordinal);

    private static readonly string[] ForbiddenPublicNames =
    {
        "Sql", "Connection", "Command", "Transaction", "Rollback", "Atomic",
        "Credential", "Password", "Secret", "Path", "Stream", "Driver",
        "ProviderType", "Placeholder", "ParameterBag", "BoundParameter"
    };

    private static object?[] ValidTask6ConstructorArguments(
        ConstructorInfo constructor)
    {
        var owner = constructor.DeclaringType!;
        if (owner == typeof(RenameTableOperation))
        {
            return new object?[] { ObjectName("Before"), ObjectName("After") };
        }
        if (owner == typeof(AlterColumnOperation))
        {
            return new object?[]
            {
                ObjectName("T"),
                Column("Value", LogicalDbType.Int32),
                Column("Value", LogicalDbType.Int64)
            };
        }
        if (owner == typeof(RenameColumnOperation))
        {
            return new object?[] { ObjectName("T"), Id("Before"), Id("After") };
        }
        if (owner == typeof(AlterSequenceOperation))
        {
            var before = SampleSequence();
            return new object?[]
            {
                before,
                new SequenceDefinition(
                    before.Name,
                    before.IntegerType,
                    new SequenceOptions(
                        2, 1, SequenceBounds.Unbounded(), null,
                        SequenceCycleBehavior.NoCycle))
            };
        }

        return constructor.GetParameters()
            .Select(ValidTask6ParameterValue)
            .ToArray();
    }

    private static object? ValidTask6ParameterValue(ParameterInfo parameter)
    {
        if (parameter.HasDefaultValue)
        {
            return parameter.DefaultValue;
        }

        var type = parameter.ParameterType;
        var owner = parameter.Member.DeclaringType!;
        if (type == typeof(string))
        {
            if (owner == typeof(ExpectedStructuralFingerprint))
            {
                return "sha256:" + new string('a', 64);
            }
            if (owner == typeof(ResourceContentDigest))
            {
                return new string('b', 64);
            }
            return "value";
        }
        if (type == typeof(Guid))
        {
            return Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        }
        if (type == typeof(DateTime))
        {
            return new DateTime(638712864000000000L, DateTimeKind.Utc);
        }
        if (type == typeof(DateTimeOffset))
        {
            return new DateTimeOffset(
                638712864000000000L, TimeSpan.FromHours(8));
        }
        if (type == typeof(long))
        {
            return 1L;
        }
        if (type == typeof(decimal))
        {
            return 1m;
        }
        if (type == typeof(bool))
        {
            return true;
        }
        if (type == typeof(int))
        {
            return 0;
        }
        if (Nullable.GetUnderlyingType(type) != null)
        {
            return null;
        }
        if (type.IsEnum)
        {
            if (type == typeof(LogicalDbType))
            {
                return LogicalDbType.Int64;
            }
            return Enum.ToObject(type, 0);
        }
        if (type == typeof(SqlIdentifier))
        {
            return Id(parameter.Name ?? "Id");
        }
        if (type == typeof(SqlObjectName))
        {
            return ObjectName("T", "app");
        }
        if (type == typeof(SqlTypeDescriptor))
        {
            return Type(LogicalDbType.Int32);
        }
        if (type == typeof(SqlExpression))
        {
            return BooleanExpression.True;
        }
        if (type == typeof(ResourceContentDigest))
        {
            return new ResourceContentDigest(new string('b', 64));
        }
        if (type == typeof(SchemaComment))
        {
            return new SchemaComment("comment");
        }
        if (type == typeof(SchemaName))
        {
            return new SchemaName(Id("app"));
        }
        if (type == typeof(SchemaScope))
        {
            return SchemaScope.All();
        }
        if (type == typeof(ColumnDefinition))
        {
            return Column("Value", LogicalDbType.Int32);
        }
        if (type == typeof(TableDefinition))
        {
            return SampleTable();
        }
        if (type == typeof(ConstraintDefinition))
        {
            return new UniqueConstraintDefinition(Id("UQ"), new[] { Id("Id") });
        }
        if (type == typeof(IndexDefinition))
        {
            return Index("IX");
        }
        if (type == typeof(ForeignKeyColumnSet))
        {
            return new ForeignKeyColumnSet(
                new[] { Id("RoleId") }, new[] { Id("Id") });
        }
        if (type == typeof(ReferentialActions))
        {
            return new ReferentialActions(
                ReferentialAction.NoAction, ReferentialAction.Restrict);
        }
        if (type == typeof(SequenceBounds))
        {
            return SequenceBounds.Unbounded();
        }
        if (type == typeof(SequenceOptions))
        {
            return new SequenceOptions(
                1, 1, SequenceBounds.Unbounded(), null,
                SequenceCycleBehavior.NoCycle);
        }
        if (type == typeof(SequenceDefinition))
        {
            return SampleSequence();
        }
        if (type == typeof(MigrationPlanId))
        {
            return new MigrationPlanId("plan");
        }
        if (type == typeof(MigrationStepId))
        {
            return new MigrationStepId("step");
        }
        if (type == typeof(ApprovalReference))
        {
            return new ApprovalReference("audit");
        }
        if (type == typeof(SchemaToken))
        {
            return new SchemaToken("token");
        }
        if (type == typeof(DiagnosticCode))
        {
            return new DiagnosticCode("TEST");
        }
        if (type == typeof(DatabaseResourceHandle))
        {
            return Resource("00112233-4455-6677-8899-aabbccddeeff", 'a');
        }
        if (type == typeof(SchemaOperation))
        {
            return new SetTableCommentOperation(
                ObjectName("T"), new SchemaComment("comment"));
        }
        if (type == typeof(MigrationPlan))
        {
            return PlanForOperation(
                "plan", "step",
                new SetTableCommentOperation(
                    ObjectName("T"), new SchemaComment("comment")),
                MigrationIdempotencyMode.RequireChange);
        }
        if (type == typeof(DatabaseAdminOperation))
        {
            return new CreateDatabaseOperation(
                Id("db"), CreateObjectBehavior.FailIfExists);
        }
        if (type == typeof(TableMetadata))
        {
            return new TableMetadata(SampleTable());
        }
        if (type == typeof(ColumnMetadata))
        {
            return new ColumnMetadata(
                ObjectName("T"), Column("Id", LogicalDbType.Int32), 0);
        }
        if (type == typeof(IndexMetadata))
        {
            return new IndexMetadata(ObjectName("T"), Index("IX"));
        }
        if (type.IsGenericType &&
            type.GetGenericTypeDefinition() == typeof(IEnumerable<>))
        {
            return ValidTask6Enumerable(type.GetGenericArguments()[0]);
        }

        throw new InvalidOperationException(
            $"No valid Task6 specimen for {owner.Name}.{parameter.Name}: {type}.");
    }

    private static object ValidTask6Enumerable(Type itemType)
    {
        if (itemType == typeof(IndexColumnDefinition))
        {
            return new[]
            {
                new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending)
            };
        }
        if (itemType == typeof(SqlIdentifier))
        {
            return new[] { Id("Id") };
        }
        if (itemType == typeof(ColumnDefinition))
        {
            return new[] { Column("Id", LogicalDbType.Int32) };
        }
        if (itemType == typeof(ConstraintDefinition))
        {
            return Array.Empty<ConstraintDefinition>();
        }
        if (itemType == typeof(IndexDefinition))
        {
            return Array.Empty<IndexDefinition>();
        }
        if (itemType == typeof(MigrationStep))
        {
            return new[]
            {
                new MigrationStep(
                    new MigrationStepId("step"),
                    new SetTableCommentOperation(
                        ObjectName("T"), new SchemaComment("comment")),
                    MigrationIdempotencyMode.RequireChange)
            };
        }
        if (itemType == typeof(MigrationStepResult))
        {
            return new[]
            {
                new MigrationStepResult(
                    new MigrationStepId("step"), MigrationStepOutcome.Applied)
            };
        }
        if (itemType == typeof(TableMetadata))
        {
            return new[] { new TableMetadata(SampleTable()) };
        }
        if (itemType == typeof(ColumnMetadata))
        {
            return new[]
            {
                new ColumnMetadata(
                    ObjectName("T"), Column("Id", LogicalDbType.Int32), 0)
            };
        }
        if (itemType == typeof(IndexMetadata))
        {
            return new[]
            {
                new IndexMetadata(ObjectName("T"), Index("IX"))
            };
        }

        throw new InvalidOperationException(
            $"No valid Task6 enumerable specimen for {itemType}.");
    }

    private static void AssertFullyReadOnly<T>(
        IReadOnlyList<T> values, T value)
    {
        var generic = Assert.IsAssignableFrom<IList<T>>(values);
        Assert.True(generic.IsReadOnly);
        Assert.Throws<NotSupportedException>(() => generic.Add(value));
        Assert.Throws<NotSupportedException>(() => generic.Clear());

        var nonGeneric = Assert.IsAssignableFrom<IList>(values);
        Assert.True(nonGeneric.IsReadOnly);
        Assert.True(nonGeneric.IsFixedSize);
        Assert.Throws<NotSupportedException>(() => nonGeneric.Add(value));
        Assert.Throws<NotSupportedException>(() => nonGeneric.Clear());
    }

    private static SqlIdentifier Id(string value) => new(value);

    private static SqlObjectName ObjectName(
        string name, string? schema = null, string? catalog = null) =>
        new(catalog == null ? null : Id(catalog),
            schema == null ? null : Id(schema), Id(name));

    private static SqlTypeDescriptor Type(
        LogicalDbType type, int? length = null, int? precision = null,
        int? scale = null) => new(type, length, precision, scale);

    private static ColumnDefinition Column(
        string name,
        LogicalDbType logicalType,
        ColumnNullability nullability = ColumnNullability.Nullable,
        ColumnGenerationDefinition? generation = null,
        ColumnDefaultDefinition? defaultValue = null,
        SchemaComment? comment = null,
        SqlTypeDescriptor? type = null) =>
        new(Id(name), type ?? Type(logicalType), nullability,
            generation, defaultValue, comment);

    private static ColumnExpression ColumnExpression(
        string name, string? alias = null) =>
        new(Id(name), alias == null ? null : new SqlAlias(alias));

    private static IndexDefinition Index(string name) =>
        new(Id(name),
            new[]
            {
                new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending)
            },
            IndexUniqueness.NonUnique);

    private static TableDefinition SampleTable() =>
        new(ObjectName("Users", "app"),
            new[]
            {
                Column("Id", LogicalDbType.Int64, ColumnNullability.NotNullable),
                Column("Name", LogicalDbType.String,
                    type: Type(LogicalDbType.String, length: 100))
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(Id("PK_Users"), new[] { Id("Id") })
            },
            new[] { Index("IX_Users_Id") },
            new SchemaComment("用户"));

    private static TableDefinition CloneTable(TableDefinition table) =>
        new(new SqlObjectName(table.Name.Catalog, table.Name.Schema, table.Name.Name),
            table.Columns.Select(column => new ColumnDefinition(
                column.Name, column.Type, column.Nullability, column.Generation,
                column.DefaultValue, column.Comment)),
            table.Constraints, table.Indexes, table.Comment);

    private static TableDefinition CloneTableWithName(
        TableDefinition table, SqlObjectName name) =>
        new(name, table.Columns, table.Constraints, table.Indexes, table.Comment);

    private static void AssertOperationFingerprintChanges(
        SchemaOperation baseline,
        IEnumerable<SchemaOperation> variants)
    {
        var operations = new[] { baseline }.Concat(variants).ToArray();
        var fingerprints = operations.Select(operation =>
            PlanForOperation(
                "field-plan",
                "field-step",
                operation,
                CompatibleIdempotency(operation)).Fingerprint.Value).ToArray();

        // Create/drop behavior and step idempotency are an intentional invariant:
        // changing behavior must use the only compatible idempotency value.
        Assert.Equal(
            fingerprints.Length,
            fingerprints.Distinct(StringComparer.Ordinal).ToArray().Length);
    }

    private static CaseExpression CaseExpressionFor(
        string input, string when, string then, string @else) =>
        new(
            ColumnExpression(input),
            new[]
            {
                new CaseWhenClause(
                    ColumnExpression(when), ColumnExpression(then))
            },
            ColumnExpression(@else));

    private static void AssertExpressionFingerprintChanges(
        SqlExpression before, SqlExpression after) =>
        Assert.NotEqual(FingerprintForComputed(before), FingerprintForComputed(after));

    private static string FingerprintForComputed(
        SqlExpression expression,
        ComputedStorageKind storage = ComputedStorageKind.Virtual) =>
        PlanForOperation(
            "computed-plan",
            "computed-step",
            new AddColumnOperation(
                ObjectName("ComputedTable", "app"),
                Column(
                    "ComputedValue",
                    LogicalDbType.Int32,
                    generation: new ComputedGenerationDefinition(
                        expression, storage))),
            MigrationIdempotencyMode.RequireChange).Fingerprint.Value;

    private static string FingerprintForType(SqlTypeDescriptor type) =>
        PlanForOperation(
            "type-plan",
            "type-step",
            new AddColumnOperation(
                ObjectName("TypedTable", "app"),
                new ColumnDefinition(
                    Id("Value"), type, ColumnNullability.Nullable)),
            MigrationIdempotencyMode.RequireChange).Fingerprint.Value;

    private static string FingerprintForGeneration(
        ColumnGenerationDefinition generation) =>
        PlanForOperation(
            "generation-plan",
            "generation-step",
            new AddColumnOperation(
                ObjectName("GeneratedTable", "app"),
                Column(
                    "GeneratedValue", LogicalDbType.Int64,
                    generation: generation)),
            MigrationIdempotencyMode.RequireChange).Fingerprint.Value;

    private static string FingerprintForUncheckedFunction(
        string key, int minArguments, int? maxArguments, bool isAggregate)
    {
        var semanticConstructor = Assert.Single(
            typeof(SemanticFunctionId).GetConstructors(
                BindingFlags.Instance | BindingFlags.NonPublic));
        var semantic = (SemanticFunctionId)semanticConstructor.Invoke(
            new object?[] { key, minArguments, maxArguments, isAggregate });
        var function = (FunctionExpression)
            RuntimeHelpers.GetUninitializedObject(typeof(FunctionExpression));
        SetAutoProperty(function, nameof(FunctionExpression.Function), semantic);
        SetAutoProperty(
            function,
            nameof(FunctionExpression.Arguments),
            Array.AsReadOnly<SqlExpression>(new[] { BooleanExpression.True }));
        var computed = (ComputedGenerationDefinition)
            RuntimeHelpers.GetUninitializedObject(
                typeof(ComputedGenerationDefinition));
        SetAutoProperty(
            computed,
            nameof(ComputedGenerationDefinition.Expression),
            function);
        SetAutoProperty(
            computed,
            nameof(ComputedGenerationDefinition.Storage),
            ComputedStorageKind.Virtual);
        return FingerprintForGeneration(computed);
    }

    private static void SetAutoProperty(
        object target, string propertyName, object value)
    {
        var field = target.GetType().GetField(
            $"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field);
        field!.SetValue(target, value);
    }

    private static SelectStatement FingerprintQuery(string mutation)
    {
        SelectStatement SimpleQuery(string marker) =>
            new(new[]
            {
                new SelectProjection(ColumnExpression(marker), new SqlAlias("value"))
            });

        SqlTableSource from;
        if (mutation is "joinBase" or "joinLeft" or "joinType" or
            "joinRight" or "joinCondition")
        {
            from = new JoinSource(
                new NamedTableSource(
                    ObjectName(mutation == "joinLeft" ? "ChangedLeft" : "Left", "app"),
                    new SqlAlias("l")),
                mutation == "joinType" ? SqlJoinType.Left : SqlJoinType.Inner,
                new NamedTableSource(
                    ObjectName(mutation == "joinRight" ? "ChangedRight" : "Right", "app"),
                    new SqlAlias("r")),
                mutation == "joinCondition" ? BooleanExpression.False : BooleanExpression.True);
        }
        else if (mutation is "derivedBase" or "derivedQuery" or "derivedAlias")
        {
            from = new DerivedTableSource(
                SimpleQuery(mutation == "derivedQuery" ? "Changed" : "Derived"),
                new SqlAlias(mutation == "derivedAlias" ? "changed" : "d"));
        }
        else
        {
            from = new NamedTableSource(
                ObjectName(mutation == "fromName" ? "Changed" : "Users", "app"),
                new SqlAlias(mutation == "fromAlias" ? "changed" : "u"));
        }

        var firstProjection = new SelectProjection(
            ColumnExpression(mutation == "projectionExpression" ? "Changed" : "A", "u"),
            new SqlAlias(mutation == "projectionAlias" ? "changed" : "a"));
        var secondProjection = new SelectProjection(
            ColumnExpression("B", "u"), new SqlAlias("b"));
        var projections = mutation == "projectionOrder"
            ? new[] { secondProjection, firstProjection }
            : new[] { firstProjection, secondProjection };

        var firstGroup = ColumnExpression(
            mutation == "groupBy" ? "Changed" : "A", "u");
        var secondGroup = ColumnExpression("B", "u");
        var groupBy = mutation == "groupOrder"
            ? new SqlExpression[] { secondGroup, firstGroup }
            : new SqlExpression[] { firstGroup, secondGroup };

        var firstOrder = new OrderByExpression(
            ColumnExpression(mutation == "orderExpression" ? "Changed" : "A", "u"),
            mutation == "orderDirection"
                ? SqlSortDirection.Descending
                : SqlSortDirection.Ascending,
            mutation == "orderNulls"
                ? SqlNullSortOrder.First
                : SqlNullSortOrder.Default);
        var secondOrder = new OrderByExpression(
            ColumnExpression("B", "u"),
            SqlSortDirection.Descending,
            SqlNullSortOrder.Last);
        var orderBy = mutation == "orderOrder"
            ? new[] { secondOrder, firstOrder }
            : new[] { firstOrder, secondOrder };

        PageSpec page = mutation switch
        {
            "pageOffset" => new OffsetPageSpec(2, 10),
            "pageLimit" => new OffsetPageSpec(1, 11),
            "pageKind" => new KeysetPageSpec(
                new SqlExpression[] { ColumnExpression("A", "u") }, 10),
            _ => new OffsetPageSpec(1, 10)
        };

        var lockSpec = new LockSpec(
            mutation == "lockMode" ? SqlLockMode.Share : SqlLockMode.Update,
            mutation == "lockWait" ? SqlLockWait.NoWait : SqlLockWait.Wait);

        var firstCte = new CommonTableExpression(
            Id(mutation == "cteName" ? "changed" : "cte_one"),
            SimpleQuery(mutation == "cteQuery" ? "Changed" : "CteOne"),
            mutation == "cteColumns"
                ? new[] { Id("Changed"), Id("B") }
                : new[] { Id("A"), Id("B") },
            mutation == "cteRecursive");
        var secondCte = new CommonTableExpression(
            Id("cte_two"), SimpleQuery("CteTwo"), new[] { Id("C") });
        var commonTableExpressions = mutation == "cteOrder"
            ? new[] { secondCte, firstCte }
            : new[] { firstCte, secondCte };

        var firstSet = new SetOperationClause(
            mutation == "setOperator" ? SqlSetOperator.Except : SqlSetOperator.Union,
            SimpleQuery(mutation == "setQuery" ? "Changed" : "SetOne"));
        var secondSet = new SetOperationClause(
            SqlSetOperator.Intersect, SimpleQuery("SetTwo"));
        var setOperations = mutation == "setOrder"
            ? new[] { secondSet, firstSet }
            : new[] { firstSet, secondSet };

        return new SelectStatement(
            from,
            projections,
            distinct: mutation == "distinct",
            whereExpression: mutation == "where"
                ? BooleanExpression.False
                : BooleanExpression.True,
            groupBy: groupBy,
            havingExpression: mutation == "having"
                ? BooleanExpression.False
                : BooleanExpression.True,
            orderBy: orderBy,
            page: page,
            lockSpec: lockSpec,
            commonTableExpressions: commonTableExpressions,
            setOperations: setOperations);
    }

    private static SequenceDefinition SampleSequence() =>
        new(ObjectName("UserSequence", "app"), LogicalDbType.Int64,
            new SequenceOptions(1, 1, SequenceBounds.Unbounded(), null,
                SequenceCycleBehavior.NoCycle));

    private static DatabaseResourceHandle Resource(string id, char digest) =>
        new(Guid.Parse(id), new ResourceContentDigest(new string(digest, 64)));

    private static DatabaseOperationDiagnostic Diagnostic() =>
        new(new DiagnosticCode("TEST"), "sanitized failure");

    private static DatabaseAdminOperation CreateUninitializedAdminSubtype()
    {
        var assembly = AssemblyBuilder.DefineDynamicAssembly(
            new AssemblyName("DosOrmTask6ForgedAdmin"),
            AssemblyBuilderAccess.Run);
        var module = assembly.DefineDynamicModule("main");
        var builder = module.DefineType(
            "ForgedDatabaseAdminOperation",
            TypeAttributes.Public | TypeAttributes.Class | TypeAttributes.Sealed,
            typeof(DatabaseAdminOperation));
        var baseConstructor = Assert.Single(typeof(DatabaseAdminOperation)
            .GetConstructors(BindingFlags.Instance | BindingFlags.NonPublic |
                             BindingFlags.DeclaredOnly));
        var constructor = builder.DefineConstructor(
            MethodAttributes.Public,
            CallingConventions.Standard,
            System.Type.EmptyTypes);
        var generator = constructor.GetILGenerator();
        generator.Emit(OpCodes.Ldarg_0);
        generator.Emit(OpCodes.Ldc_I4, (int)DestructiveImpact.PotentialDataLoss);
        if (baseConstructor.GetParameters()[1].ParameterType == typeof(bool))
        {
            generator.Emit(OpCodes.Ldc_I4_1);
        }
        else
        {
            generator.Emit(OpCodes.Ldnull);
        }
        generator.Emit(OpCodes.Call, baseConstructor);
        generator.Emit(OpCodes.Ret);
        var forgedType = builder.CreateType()!;
        return (DatabaseAdminOperation)
            RuntimeHelpers.GetUninitializedObject(forgedType);
    }

    private static MigrationStep Step(
        string id, MigrationIdempotencyMode mode) =>
        new(new MigrationStepId(id),
            new SetTableCommentOperation(ObjectName("T"), new SchemaComment("x")),
            mode);

    private static MigrationPlan PlanForDefault(ColumnDefaultDefinition value) =>
        PlanForOperation("literal-plan", "literal-step",
            new CreateTableOperation(
                new TableDefinition(ObjectName("Literal"),
                    new[] { Column("Value", LogicalDbType.Decimal, defaultValue: value) }),
                CreateObjectBehavior.FailIfExists),
            MigrationIdempotencyMode.RequireChange);

    private static MigrationPlan PlanForOperation(
        string planId,
        string stepId,
        SchemaOperation operation,
        MigrationIdempotencyMode mode) =>
        new(new MigrationPlanId(planId),
            new[] { new MigrationStep(new MigrationStepId(stepId), operation, mode) });

    private static MigrationIdempotencyMode CompatibleIdempotency(
        SchemaOperation operation)
    {
        if (operation is CreateSchemaOperation createSchema)
        {
            return createSchema.Behavior == CreateObjectBehavior.FailIfExists
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is CreateTableOperation createTable)
        {
            return createTable.Behavior == CreateObjectBehavior.FailIfExists
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is CreateIndexOperation createIndex)
        {
            return createIndex.Behavior == CreateObjectBehavior.FailIfExists
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is CreateSequenceOperation createSequence)
        {
            return createSequence.Behavior == CreateObjectBehavior.FailIfExists
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropSchemaOperation dropSchema)
        {
            return dropSchema.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropTableOperation dropTable)
        {
            return dropTable.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropColumnOperation dropColumn)
        {
            return dropColumn.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropConstraintOperation dropConstraint)
        {
            return dropConstraint.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropIndexOperation dropIndex)
        {
            return dropIndex.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        if (operation is DropSequenceOperation dropSequence)
        {
            return dropSequence.Behavior == DropObjectBehavior.FailIfMissing
                ? MigrationIdempotencyMode.RequireChange
                : MigrationIdempotencyMode.AcceptAlreadySatisfied;
        }
        return MigrationIdempotencyMode.RequireChange;
    }

    private static void AssertAlterColumnImpact(
        ColumnDefinition before, ColumnDefinition after, DestructiveImpact expected) =>
        Assert.Equal(expected,
            new AlterColumnOperation(ObjectName("T"), before, after).Impact);

    private static void AssertValueObject<T>(
        Func<T> factory, Func<T, string> accessor)
        where T : class
    {
        var first = factory();
        var second = factory();
        Assert.Equal(accessor(first), accessor(second));
        AssertEqualAndHash(first, second);
    }

    private static void AssertEqualAndHash<T>(T first, T second)
    {
        Assert.Equal(first, second);
        Assert.Equal(first!.GetHashCode(), second!.GetHashCode());
    }

    private static SqlExpression UnaryChain(int wrapperCount)
    {
        SqlExpression expression = BooleanExpression.True;
        for (var index = 0; index < wrapperCount; index++)
        {
            expression = new UnaryExpression(SqlUnaryOperator.Not, expression);
        }
        return expression;
    }

    private static SqlExpression SharedBinaryDag(int wrapperCount)
    {
        SqlExpression expression = BooleanExpression.True;
        for (var index = 0; index < wrapperCount; index++)
        {
            expression = new BinaryExpression(
                expression, SqlBinaryOperator.And, expression);
        }
        return expression;
    }

    private static void AssertRejectedInBothOrders<T>(
        T first,
        T second,
        Action<IEnumerable<T>> construct)
    {
        var forward = Assert.Throws<ArgumentException>(() =>
            construct(new[] { first, second }));
        var reverse = Assert.Throws<ArgumentException>(() =>
            construct(new[] { second, first }));
        Assert.Equal(forward.ParamName, reverse.ParamName);
        Assert.Equal(forward.Message, reverse.Message);
    }

    private sealed class UnknownExpression : SqlExpression
    {
    }

    private sealed class UnknownDefaultDefinition : ColumnDefaultDefinition
    {
    }

    private sealed class UnknownGenerationDefinition : ColumnGenerationDefinition
    {
    }

    private sealed class UnknownQueryNode : SqlNode
    {
    }

    private sealed class UnknownTableSource : SqlTableSource
    {
    }
}
