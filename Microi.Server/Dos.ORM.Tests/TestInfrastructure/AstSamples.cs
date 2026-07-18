using System.Data;
using System.Reflection;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class AstSamples
{
    internal static SelectStatement UserByAccountAndStatus()
    {
        var user = new SqlAlias("u");
        var account = new ParameterDefinition(
            "account",
            new SqlTypeDescriptor(LogicalDbType.String, length: 200),
            ParameterDirection.Input,
            isNullable: false);
        var status = new ParameterDefinition(
            "status",
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ParameterDirection.Input,
            isNullable: false);

        return new SelectStatement(
            new NamedTableSource(ObjectName("Sys_User"), user),
            new[]
            {
                new SelectProjection(new ColumnExpression(Id("Id"), user)),
                new SelectProjection(new ColumnExpression(Id("Account"), user))
            },
            whereExpression: new BinaryExpression(
                new BinaryExpression(
                    new ColumnExpression(Id("Account"), user),
                    SqlBinaryOperator.Equal,
                    new ParameterExpression(account)),
                SqlBinaryOperator.And,
                new BinaryExpression(
                    new ColumnExpression(Id("Status"), user),
                    SqlBinaryOperator.Equal,
                    new ParameterExpression(status))));
    }

    internal static IReadOnlyList<SqlNode> AllConcreteNodes()
    {
        var id = Id("Id");
        var table = ObjectName("T");
        var alias = new SqlAlias("t");
        var parameter = new ParameterDefinition(
            "p", new SqlTypeDescriptor(LogicalDbType.Int32));
        var column = new ColumnExpression(id, alias);
        var projection = new SelectProjection(column);
        var simpleSelect = new SelectStatement(new[] { projection });
        var named = new NamedTableSource(table, alias);
        var columnDefinition = new ColumnDefinition(
            id, new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.NotNullable);
        var nullableColumn = new ColumnDefinition(
            Id("Value"), new SqlTypeDescriptor(LogicalDbType.String),
            ColumnNullability.Nullable);
        var primaryKey = new PrimaryKeyDefinition(Id("PK_T"), new[] { id });
        var indexColumn = new IndexColumnDefinition(id, SqlSortDirection.Ascending);
        var index = new IndexDefinition(
            Id("IX_T_Id"), new[] { indexColumn }, IndexUniqueness.Unique);
        var fkColumns = new ForeignKeyColumnSet(new[] { id }, new[] { id });
        var actions = new ReferentialActions(
            ReferentialAction.NoAction, ReferentialAction.NoAction);
        var foreignKey = new ForeignKeyDefinition(
            Id("FK_T_T"), table, fkColumns, actions);
        var tableDefinition = new TableDefinition(
            table,
            new[] { columnDefinition, nullableColumn },
            new ConstraintDefinition[] { primaryKey, foreignKey },
            new[] { index });
        var bounds = SequenceBounds.Between(1, 100);
        var options = new SequenceOptions(
            1, 1, bounds, 10, SequenceCycleBehavior.NoCycle);
        var sequence = new SequenceDefinition(
            ObjectName("Seq_T"), LogicalDbType.Int64, options);
        var createTable = new CreateTableOperation(
            tableDefinition, CreateObjectBehavior.FailIfExists);
        var migrationStep = new MigrationStep(
            new MigrationStepId("step"), createTable,
            MigrationIdempotencyMode.RequireChange);
        var resource = new DatabaseResourceHandle(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            new ResourceContentDigest(new string('a', 64)));

        var nodes = new SqlNode[]
        {
            column,
            new ParameterExpression(parameter),
            NullExpression.Instance,
            BooleanExpression.True,
            new BinaryExpression(column, SqlBinaryOperator.Equal, new ParameterExpression(parameter)),
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False),
            new InExpression(column, Array.Empty<SqlExpression>()),
            new BetweenExpression(column, BooleanExpression.False, BooleanExpression.True),
            new CaseExpression(new[] { new CaseWhenClause(BooleanExpression.True, column) }),
            new CastExpression(column, new SqlTypeDescriptor(LogicalDbType.Int64)),
            new SubqueryExpression(simpleSelect),
            new ExistsExpression(new SubqueryExpression(simpleSelect)),
            new AggregateExpression(SemanticFunctions.Count),
            new FunctionExpression(SemanticFunctions.Length, new[] { column }),
            new WildcardExpression(alias),

            named,
            new DerivedTableSource(simpleSelect, new SqlAlias("d")),
            new JoinSource(named, SqlJoinType.Inner, new NamedTableSource(ObjectName("R"), new SqlAlias("r")), BooleanExpression.True),
            projection,
            new OrderByExpression(column),
            new OffsetPageSpec(0, 10),
            new KeysetPageSpec(new[] { column }, 10),
            new LockSpec(SqlLockMode.Update),
            new CommonTableExpression(Id("Cte"), simpleSelect),
            new SetOperationClause(SqlSetOperator.UnionAll, simpleSelect),
            simpleSelect,
            new SqlAssignment(id, column),
            new SqlInsertRow(new[] { column }),
            new ReturningClause(new[] { projection }),
            InsertStatement.Values(table, new[] { id }, new[] { new SqlInsertRow(new[] { column }) }),
            new UpdateStatement(table, new[] { new SqlAssignment(id, column) }, column),
            new DeleteStatement(table, column),
            new UpsertStatement(
                table,
                new[] { id },
                new[] { new SqlAssignment(id, column), new SqlAssignment(Id("Value"), column) },
                new[] { new SqlAssignment(Id("Value"), column) }),
            new BulkInsertOperation(table, new[] { id }, new[] { new SqlInsertRow(new[] { column }) }, 10),

            new NullDefaultDefinition(),
            new BooleanDefaultDefinition(true),
            new Int64DefaultDefinition(1),
            new DecimalDefaultDefinition(1m),
            new StringDefaultDefinition("x"),
            new GuidDefaultDefinition(Guid.Empty),
            new DateTimeDefaultDefinition(new DateTime(2020, 1, 1)),
            new DateTimeOffsetDefaultDefinition(new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero)),
            new SemanticDefaultDefinition(SemanticDefaultKind.CurrentDate),
            new IdentityGenerationDefinition(1, 1),
            new SequenceGenerationDefinition(sequence.Name),
            new ComputedGenerationDefinition(column, ComputedStorageKind.Virtual),
            columnDefinition,
            new SchemaName(Id("app")),
            SchemaScope.ForSchema(Id("app")),
            indexColumn,
            index,
            primaryKey,
            new UniqueConstraintDefinition(Id("UQ_T_Value"), new[] { Id("Value") }),
            fkColumns,
            actions,
            foreignKey,
            tableDefinition,
            bounds,
            options,
            sequence,

            new CreateSchemaOperation(new SchemaName(Id("app")), CreateObjectBehavior.FailIfExists),
            new DropSchemaOperation(new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            createTable,
            new RenameTableOperation(table, ObjectName("T2")),
            new DropTableOperation(table, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new AddColumnOperation(table, nullableColumn),
            new AlterColumnOperation(table, columnDefinition, new ColumnDefinition(id, new SqlTypeDescriptor(LogicalDbType.Int32), ColumnNullability.NotNullable, defaultValue: new Int64DefaultDefinition(1))),
            new RenameColumnOperation(table, id, Id("Id2")),
            new DropColumnOperation(table, id, DropObjectBehavior.FailIfMissing),
            new AddConstraintOperation(table, primaryKey),
            new DropConstraintOperation(table, primaryKey.Name, DropObjectBehavior.FailIfMissing),
            new CreateIndexOperation(table, index, CreateObjectBehavior.FailIfExists),
            new DropIndexOperation(table, index.Name, DropObjectBehavior.FailIfMissing),
            new CreateSequenceOperation(sequence, CreateObjectBehavior.FailIfExists),
            new AlterSequenceOperation(sequence, new SequenceDefinition(sequence.Name, LogicalDbType.Int64, new SequenceOptions(1, 2, bounds, 10, SequenceCycleBehavior.NoCycle))),
            new DropSequenceOperation(sequence.Name, DropObjectBehavior.FailIfMissing),
            new SetTableCommentOperation(table, new SchemaComment("table")),
            new RemoveTableCommentOperation(table),
            new SetColumnCommentOperation(table, id, new SchemaComment("column")),
            new RemoveColumnCommentOperation(table, id),
            migrationStep,
            new MigrationPlan(new MigrationPlanId("plan"), new[] { migrationStep }),
            new ListTablesOperation(SchemaScope.All()),
            new GetTableMetadataOperation(table),
            new ListColumnsOperation(table),
            new GetColumnMetadataOperation(table, id),
            new ListIndexesOperation(table),
            new GetIndexMetadataOperation(table, index.Name),
            new DatabaseDiagnosticOperation(DatabaseDiagnosticKind.Health),
            new CreateDatabaseOperation(Id("db"), CreateObjectBehavior.FailIfExists),
            new DropDatabaseOperation(Id("db"), DropObjectBehavior.FailIfMissing),
            new DatabaseExportOperation(Id("db"), resource, DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData),
            new DatabaseImportOperation(Id("db"), resource, DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaAndData, DatabaseImportConflictPolicy.FailOnConflict)
        };

        return Array.AsReadOnly(nodes);
    }

    internal static IEnumerable<object[]> ExpressionTraversalEdgeCases()
    {
        yield return Edge("binary-left",
            new BinaryExpression(InvalidColumn(), SqlBinaryOperator.And, BooleanExpression.True),
            InvalidIdentifier("$.Left.Name"));
        yield return Edge("binary-right",
            new BinaryExpression(BooleanExpression.True, SqlBinaryOperator.And, InvalidColumn()),
            InvalidIdentifier("$.Right.Name"));
        yield return Edge("unary-operand",
            new UnaryExpression(SqlUnaryOperator.Not, InvalidColumn()),
            InvalidIdentifier("$.Operand.Name"));
        yield return Edge("in-operand",
            new InExpression(InvalidColumn(), new[] { BooleanExpression.True }),
            InvalidIdentifier("$.Operand.Name"));
        yield return Edge("in-value",
            new InExpression(BooleanExpression.True, new[] { InvalidColumn() }),
            InvalidIdentifier("$.Values[0].Name"));
        yield return Edge("between-all-children",
            new BetweenExpression(InvalidColumn(), InvalidColumn(), InvalidColumn()),
            InvalidIdentifier("$.Operand.Name"),
            InvalidIdentifier("$.Lower.Name"),
            InvalidIdentifier("$.Upper.Name"));
        yield return Edge("case-all-children",
            new CaseExpression(InvalidColumn(),
                new[] { new CaseWhenClause(InvalidColumn(), InvalidColumn()) },
                InvalidColumn()),
            InvalidIdentifier("$.InputExpression.Name"),
            InvalidIdentifier("$.WhenClauses[0].When.Name"),
            InvalidIdentifier("$.WhenClauses[0].Then.Name"),
            InvalidIdentifier("$.ElseExpression.Name"));
        yield return Edge("cast-expression",
            new CastExpression(InvalidColumn(), new SqlTypeDescriptor(LogicalDbType.Int32)),
            InvalidIdentifier("$.Expression.Name"));
        yield return Edge("subquery-query",
            new SubqueryExpression(SelectOf(InvalidColumn())),
            InvalidIdentifier("$.Query.Projections[0].Expression.Name"));
        yield return Edge("exists-subquery",
            new ExistsExpression(new SubqueryExpression(SelectOf(InvalidColumn()))),
            InvalidIdentifier("$.Subquery.Query.Projections[0].Expression.Name"));
        yield return Edge("aggregate-argument",
            new AggregateExpression(SemanticFunctions.Sum, InvalidColumn()),
            InvalidIdentifier("$.Argument.Name"));
        yield return Edge("function-argument",
            new FunctionExpression(SemanticFunctions.Length, new[] { InvalidColumn() }),
            InvalidIdentifier("$.Arguments[0].Name"));
    }

    internal static IEnumerable<object[]> QueryDmlTraversalEdgeCases()
    {
        var named = new NamedTableSource(ObjectName("T"));
        yield return Edge("derived-query",
            new DerivedTableSource(SelectOf(InvalidColumn()), new SqlAlias("d")),
            InvalidIdentifier("$.Query.Projections[0].Expression.Name"));
        yield return Edge("join-all-children",
            new JoinSource(
                new DerivedTableSource(SelectOf(InvalidColumn()), new SqlAlias("l")),
                SqlJoinType.Inner,
                new DerivedTableSource(SelectOf(InvalidColumn()), new SqlAlias("r")),
                InvalidColumn()),
            InvalidIdentifier("$.Left.Query.Projections[0].Expression.Name"),
            InvalidIdentifier("$.Right.Query.Projections[0].Expression.Name"),
            InvalidIdentifier("$.Condition.Name"));
        yield return Edge("projection-expression",
            new SelectProjection(InvalidColumn()),
            InvalidIdentifier("$.Expression.Name"));
        yield return Edge("order-expression",
            new OrderByExpression(InvalidColumn()),
            InvalidIdentifier("$.Expression.Name"));
        yield return Edge("keyset-boundary",
            new KeysetPageSpec(new[] { InvalidColumn() }, 10),
            InvalidIdentifier("$.Boundaries[0].Name"));
        yield return Edge("cte-query",
            new CommonTableExpression(Id("C"), SelectOf(InvalidColumn())),
            InvalidIdentifier("$.Query.Projections[0].Expression.Name"));
        yield return Edge("set-right-query",
            new SetOperationClause(SqlSetOperator.UnionAll, SelectOf(InvalidColumn())),
            InvalidIdentifier("$.RightQuery.Projections[0].Expression.Name"));
        yield return Edge("select-core-children",
            new SelectStatement(
                new DerivedTableSource(SelectOf(InvalidColumn()), new SqlAlias("d")),
                new[] { new SelectProjection(InvalidColumn()) },
                whereExpression: InvalidColumn(),
                groupBy: new[] { InvalidColumn() },
                havingExpression: InvalidColumn(),
                orderBy: new[] { new OrderByExpression(InvalidColumn()) }),
            InvalidIdentifier("$.From.Query.Projections[0].Expression.Name"),
            InvalidIdentifier("$.Projections[0].Expression.Name"),
            InvalidIdentifier("$.Where.Name"),
            InvalidIdentifier("$.GroupBy[0].Name"),
            InvalidIdentifier("$.Having.Name"),
            InvalidIdentifier("$.OrderBy[0].Expression.Name"));

        var invalidPage = new OffsetPageSpec(0, 10);
        SetAutoProperty(invalidPage, nameof(OffsetPageSpec.Offset), -1);
        var invalidLock = new LockSpec(SqlLockMode.Update);
        SetAutoProperty(invalidLock, nameof(LockSpec.Mode), (SqlLockMode)999);
        yield return Edge("select-page-and-lock",
            new SelectStatement(
                new[] { new SelectProjection(BooleanExpression.True) },
                orderBy: new[] { new OrderByExpression(BooleanExpression.True) },
                page: invalidPage,
                lockSpec: invalidLock),
            ScalarInvalid("$.Page.Offset"),
            UndefinedEnum("$.Lock.Mode"));
        yield return Edge("select-cte-and-set",
            new SelectStatement(
                new[] { new SelectProjection(BooleanExpression.True) },
                commonTableExpressions: new[]
                {
                    new CommonTableExpression(Id("C"), SelectOf(InvalidColumn()))
                },
                setOperations: new[]
                {
                    new SetOperationClause(SqlSetOperator.UnionAll, SelectOf(InvalidColumn()))
                }),
            InvalidIdentifier("$.CommonTableExpressions[0].Query.Projections[0].Expression.Name"),
            InvalidIdentifier("$.SetOperations[0].RightQuery.Projections[0].Expression.Name"));
        yield return Edge("assignment-value",
            new SqlAssignment(Id("Value"), InvalidColumn()),
            InvalidIdentifier("$.Value.Name"));
        yield return Edge("insert-row-value",
            new SqlInsertRow(new[] { InvalidColumn() }),
            InvalidIdentifier("$.Values[0].Name"));
        yield return Edge("insert-rows",
            InsertStatement.Values(ObjectName("T"), new[] { Id("Value") },
                new[] { new SqlInsertRow(new[] { InvalidColumn() }) }),
            InvalidIdentifier("$.Rows[0].Values[0].Name"));
        yield return Edge("insert-source",
            InsertStatement.FromSelect(ObjectName("T"), new[] { Id("Value") },
                SelectOf(InvalidColumn())),
            InvalidIdentifier("$.Source.Projections[0].Expression.Name"));
        yield return Edge("insert-returning",
            InsertStatement.Values(ObjectName("T"), new[] { Id("Value") },
                new[] { new SqlInsertRow(new[] { BooleanExpression.True }) },
                Returning(InvalidColumn())),
            InvalidIdentifier("$.Returning.Projections[0].Expression.Name"));
        yield return Edge("update-assignment",
            new UpdateStatement(ObjectName("T"),
                new[] { new SqlAssignment(Id("Value"), InvalidColumn()) },
                BooleanExpression.False),
            InvalidIdentifier("$.Assignments[0].Value.Name"));
        yield return Edge("update-where",
            new UpdateStatement(ObjectName("T"),
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.True) },
                InvalidColumn()),
            InvalidIdentifier("$.Where.Name"));
        yield return Edge("update-returning",
            new UpdateStatement(ObjectName("T"),
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.True) },
                BooleanExpression.False, returning: Returning(InvalidColumn())),
            InvalidIdentifier("$.Returning.Projections[0].Expression.Name"));
        yield return Edge("delete-where",
            new DeleteStatement(ObjectName("T"), InvalidColumn()),
            InvalidIdentifier("$.Where.Name"));
        yield return Edge("delete-returning",
            new DeleteStatement(ObjectName("T"), BooleanExpression.False,
                returning: Returning(InvalidColumn())),
            InvalidIdentifier("$.Returning.Projections[0].Expression.Name"));
        yield return Edge("upsert-insert-assignment",
            new UpsertStatement(ObjectName("T"), new[] { Id("Id") },
                new[]
                {
                    new SqlAssignment(Id("Id"), InvalidColumn()),
                    new SqlAssignment(Id("Value"), BooleanExpression.True)
                },
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.False) }),
            InvalidIdentifier("$.InsertAssignments[0].Value.Name"));
        yield return Edge("upsert-update-assignment",
            new UpsertStatement(ObjectName("T"), new[] { Id("Id") },
                new[]
                {
                    new SqlAssignment(Id("Id"), BooleanExpression.True),
                    new SqlAssignment(Id("Value"), BooleanExpression.True)
                },
                new[] { new SqlAssignment(Id("Value"), InvalidColumn()) }),
            InvalidIdentifier("$.UpdateAssignments[0].Value.Name"));
        yield return Edge("upsert-returning",
            new UpsertStatement(ObjectName("T"), new[] { Id("Id") },
                new[]
                {
                    new SqlAssignment(Id("Id"), BooleanExpression.True),
                    new SqlAssignment(Id("Value"), BooleanExpression.True)
                },
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.False) },
                returning: Returning(InvalidColumn())),
            InvalidIdentifier("$.Returning.Projections[0].Expression.Name"));
        yield return Edge("bulk-row",
            new BulkInsertOperation(ObjectName("T"), new[] { Id("Value") },
                new[] { new SqlInsertRow(new[] { InvalidColumn() }) }, 10),
            InvalidIdentifier("$.Rows[0].Values[0].Name"));
    }

    internal static IEnumerable<object[]> SchemaMigrationTraversalEdgeCases()
    {
        yield return Edge("computed-expression",
            new ComputedGenerationDefinition(InvalidColumn(), ComputedStorageKind.Virtual),
            InvalidIdentifier("$.Expression.Name"));
        yield return Edge("column-generation",
            new ColumnDefinition(Id("Value"), new SqlTypeDescriptor(LogicalDbType.Int32),
                ColumnNullability.Nullable,
                generation: new ComputedGenerationDefinition(
                    InvalidColumn(), ComputedStorageKind.Stored)),
            InvalidIdentifier("$.Generation.Expression.Name"));

        var invalidDefault = new StringDefaultDefinition("valid");
        SetAutoProperty(invalidDefault, nameof(StringDefaultDefinition.Value), null);
        yield return Edge("column-default",
            new ColumnDefinition(Id("Value"), new SqlTypeDescriptor(LogicalDbType.String),
                ColumnNullability.Nullable, defaultValue: invalidDefault),
            ScalarInvalid("$.DefaultValue.Value"));

        yield return Edge("index-columns",
            new IndexDefinition(Id("IX"),
                new[] { new IndexColumnDefinition(InvalidId(), SqlSortDirection.Ascending) },
                IndexUniqueness.NonUnique),
            InvalidIdentifier("$.Columns[0].Column"));
        yield return Edge("foreign-key-columns",
            new ForeignKeyDefinition(Id("FK"), ObjectName("Other"),
                new ForeignKeyColumnSet(new[] { InvalidId() }, new[] { Id("OtherId") }),
                new ReferentialActions(ReferentialAction.NoAction, ReferentialAction.NoAction)),
            InvalidIdentifier("$.Columns.LocalColumns[0]"));

        var invalidActions = new ReferentialActions(
            ReferentialAction.NoAction, ReferentialAction.NoAction);
        SetAutoProperty(invalidActions, nameof(ReferentialActions.OnUpdate),
            (ReferentialAction)999);
        yield return Edge("foreign-key-actions",
            new ForeignKeyDefinition(Id("FK"), ObjectName("Other"),
                new ForeignKeyColumnSet(new[] { Id("OtherId") }, new[] { Id("Id") }),
                invalidActions),
            UndefinedEnum("$.Actions.OnUpdate"));

        yield return Edge("table-columns",
            new TableDefinition(ObjectName("T"), new[] { InvalidColumnDefinition() }),
            InvalidIdentifier("$.Columns[0].Name"));
        yield return Edge("table-constraints",
            new TableDefinition(ObjectName("T"),
                new[] { IntColumn("Id") },
                new ConstraintDefinition[]
                {
                    new PrimaryKeyDefinition(InvalidId(), new[] { Id("Id") })
                }),
            InvalidIdentifier("$.Constraints[0].Name"));
        yield return Edge("table-indexes",
            new TableDefinition(ObjectName("T"),
                new[] { IntColumn("Id") }, indexes: new[]
                {
                    new IndexDefinition(InvalidId(),
                        new[] { new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending) },
                        IndexUniqueness.NonUnique)
                }),
            InvalidIdentifier("$.Indexes[0].Name"));

        var invalidBounds = SequenceBounds.Between(0, 10);
        var optionsWithInvalidBounds = new SequenceOptions(
            5, 1, invalidBounds, 10, SequenceCycleBehavior.NoCycle);
        SetAutoProperty(invalidBounds, nameof(SequenceBounds.MinimumValue), (long?)6);
        SetAutoProperty(invalidBounds, nameof(SequenceBounds.MaximumValue), (long?)4);
        yield return Edge("sequence-options-bounds",
            optionsWithInvalidBounds,
            SequenceInvalid("$.Bounds.MaximumValue"));

        yield return Edge("create-schema",
            new CreateSchemaOperation(new SchemaName(InvalidId()),
                CreateObjectBehavior.FailIfExists),
            InvalidIdentifier("$.Schema.Name"));
        yield return Edge("drop-schema",
            new DropSchemaOperation(new SchemaName(InvalidId()),
                DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            InvalidIdentifier("$.Schema.Name"));
        yield return Edge("create-table",
            new CreateTableOperation(
                new TableDefinition(ObjectName("T"), new[] { InvalidColumnDefinition() }),
                CreateObjectBehavior.FailIfExists),
            InvalidIdentifier("$.Table.Columns[0].Name"));
        yield return Edge("add-column",
            new AddColumnOperation(ObjectName("T"), InvalidColumnDefinition()),
            InvalidIdentifier("$.Column.Name"));

        var invalidSharedComment = new SchemaComment("valid");
        var before = new ColumnDefinition(Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.String), ColumnNullability.Nullable,
            comment: invalidSharedComment);
        var after = new ColumnDefinition(Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.String), ColumnNullability.Nullable,
            comment: invalidSharedComment);
        var alterColumn = new AlterColumnOperation(ObjectName("T"), before, after);
        SetAutoProperty(invalidSharedComment, nameof(SchemaComment.Text), " ");
        yield return Edge("alter-column-before-after", alterColumn,
            ScalarInvalid("$.Before.Comment.Text"),
            ScalarInvalid("$.After.Comment.Text"));

        yield return Edge("add-constraint",
            new AddConstraintOperation(ObjectName("T"),
                new PrimaryKeyDefinition(InvalidId(), new[] { Id("Id") })),
            InvalidIdentifier("$.Constraint.Name"));
        yield return Edge("create-index",
            new CreateIndexOperation(ObjectName("T"),
                new IndexDefinition(InvalidId(),
                    new[] { new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending) },
                    IndexUniqueness.NonUnique),
                CreateObjectBehavior.FailIfExists),
            InvalidIdentifier("$.Index.Name"));

        var invalidCreatedSequence = new SequenceDefinition(
            ObjectName("S"), LogicalDbType.Int64, ValidSequenceOptions());
        SetAutoProperty(
            invalidCreatedSequence.Options,
            nameof(SequenceOptions.IncrementBy),
            0L);
        yield return Edge("create-sequence-child",
            new CreateSequenceOperation(
                invalidCreatedSequence,
                CreateObjectBehavior.FailIfExists),
            SequenceInvalid("$.Sequence.Options.IncrementBy"));

        var beforeSequence = new SequenceDefinition(
            ObjectName("S"), LogicalDbType.Int64, ValidSequenceOptions());
        var afterSequence = new SequenceDefinition(
            ObjectName("S"), LogicalDbType.Int64,
            new SequenceOptions(1, 2, SequenceBounds.Between(1, 100), 10,
                SequenceCycleBehavior.NoCycle));
        var alterSequence = new AlterSequenceOperation(beforeSequence, afterSequence);
        SetAutoProperty(beforeSequence.Options, nameof(SequenceOptions.IncrementBy), 0L);
        SetAutoProperty(afterSequence.Options, nameof(SequenceOptions.Cycle),
            (SequenceCycleBehavior)999);
        yield return Edge("alter-sequence-before-after", alterSequence,
            SequenceInvalid("$.Before.Options.IncrementBy"),
            UndefinedEnum("$.After.Options.Cycle"));

        var invalidComment = new SchemaComment("valid");
        var commentOperation = new SetTableCommentOperation(ObjectName("T"), invalidComment);
        var step = new MigrationStep(new MigrationStepId("step"), commentOperation,
            MigrationIdempotencyMode.RequireChange);
        var plan = new MigrationPlan(new MigrationPlanId("plan"), new[] { step });
        SetAutoProperty(invalidComment, nameof(SchemaComment.Text), " ");
        yield return Edge("migration-plan-step-operation", plan,
            ScalarInvalid("$.Steps[0].Operation.Comment.Text"));

        var invalidScope = SchemaScope.ForCatalogAndSchema(Id("catalog"), Id("schema"));
        SetAutoProperty(invalidScope, nameof(SchemaScope.Schema), null);
        yield return Edge("list-tables-scope", new ListTablesOperation(invalidScope),
            StructuralInvalid("$.Scope.Schema"));
    }

    internal static IEnumerable<object[]> RetainedHolderCases()
    {
        yield return Edge("identifier-value", InvalidColumn(),
            InvalidIdentifier("$.Name"));
        var source = new SqlAlias(InvalidId());
        yield return Edge("alias-identifier",
            new ColumnExpression(Id("Value"), source),
            InvalidIdentifier("$.Source.Identifier"));
        var objectName = new SqlObjectName(InvalidId(), InvalidId(), InvalidId());
        yield return Edge("object-name-order", new NamedTableSource(objectName),
            InvalidIdentifier("$.Name.Catalog"),
            InvalidIdentifier("$.Name.Schema"),
            InvalidIdentifier("$.Name.Name"));
    }

    internal static IEnumerable<object[]> RetainedExpressionCases()
    {
        var missing = new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.And, BooleanExpression.False);
        SetAutoProperty(missing, nameof(BinaryExpression.Left), null);
        yield return Edge("binary-missing-left", missing,
            RequiredMissing("$.Left"));

        var undefined = new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True);
        SetAutoProperty(undefined, nameof(UnaryExpression.Operator), (SqlUnaryOperator)999);
        yield return Edge("unary-undefined-operator", undefined,
            UndefinedEnum("$.Operator"));

        var emptyCase = new CaseExpression(
            new[] { new CaseWhenClause(BooleanExpression.True, BooleanExpression.False) });
        SetAutoProperty(emptyCase, nameof(CaseExpression.WhenClauses),
            Array.AsReadOnly(Array.Empty<CaseWhenClause>()));
        yield return Edge("case-empty-clauses", emptyCase,
            CollectionEmpty("$.WhenClauses"));

        var between = new BetweenExpression(
            BooleanExpression.True, BooleanExpression.False, BooleanExpression.True);
        SetAutoProperty(between, nameof(BetweenExpression.Operand), null);
        SetAutoProperty(between, nameof(BetweenExpression.Lower), null);
        SetAutoProperty(between, nameof(BetweenExpression.Upper), null);
        yield return Edge("between-required-order", between,
            RequiredMissing("$.Operand"),
            RequiredMissing("$.Lower"),
            RequiredMissing("$.Upper"));

        var cast = new CastExpression(
            BooleanExpression.True, new SqlTypeDescriptor(LogicalDbType.Boolean));
        SetAutoProperty(cast, nameof(CastExpression.Expression), null);
        SetAutoProperty(cast, nameof(CastExpression.Type), null);
        yield return Edge("cast-required-order", cast,
            RequiredMissing("$.Expression"),
            RequiredMissing("$.Type"));

        yield return Edge("subquery-select-required",
            new SubqueryExpression(BooleanExpression.True),
            SubquerySelectRequired("$.Query"));

        var exists = new ExistsExpression(
            new SubqueryExpression(SelectOf(BooleanExpression.True)));
        SetAutoProperty(exists, nameof(ExistsExpression.Subquery), null);
        yield return Edge("exists-missing-subquery", exists,
            RequiredMissing("$.Subquery"));

        yield return Edge("wildcard-invalid-source",
            new WildcardExpression(new SqlAlias(InvalidId())),
            InvalidIdentifier("$.Source.Identifier"));
    }

    internal static IEnumerable<object[]> RetainedQueryCases()
    {
        var page = new OffsetPageSpec(0, 1);
        SetAutoProperty(page, nameof(OffsetPageSpec.Offset), -1);
        SetAutoProperty(page, nameof(OffsetPageSpec.Limit), 0);
        yield return Edge("offset-ranges", page,
            ScalarInvalid("$.Offset"), ScalarInvalid("$.Limit"));

        var keyset = new KeysetPageSpec(Array.Empty<SqlExpression>(), 1);
        yield return Edge("keyset-empty-boundaries", keyset);

        var set = new SetOperationClause(SqlSetOperator.Union, SelectOf(BooleanExpression.True));
        SetAutoProperty(set, nameof(SetOperationClause.Operator), (SqlSetOperator)999);
        yield return Edge("set-undefined-operator", set,
            UndefinedEnum("$.Operator"));

        var derived = new DerivedTableSource(
            SelectOf(BooleanExpression.True), new SqlAlias("d"));
        SetAutoProperty(derived, nameof(DerivedTableSource.Query), null);
        SetAutoProperty(derived, nameof(DerivedTableSource.Alias), null);
        yield return Edge("derived-required-order", derived,
            RequiredMissing("$.Query"),
            RequiredMissing("$.Alias"));

        var join = new JoinSource(
            new NamedTableSource(ObjectName("L")),
            SqlJoinType.Inner,
            new NamedTableSource(ObjectName("R")),
            BooleanExpression.True);
        SetAutoProperty(join, nameof(JoinSource.Left), null);
        SetAutoProperty(join, nameof(JoinSource.Right), null);
        SetAutoProperty(join, nameof(JoinSource.JoinType), (SqlJoinType)999);
        SetAutoProperty(join, nameof(JoinSource.Condition), null);
        yield return Edge("join-required-before-enum", join,
            RequiredMissing("$.Left"),
            RequiredMissing("$.Right"),
            UndefinedEnum("$.JoinType"));

        var projection = new SelectProjection(BooleanExpression.True);
        SetAutoProperty(projection, nameof(SelectProjection.Expression), null);
        yield return Edge("projection-missing-expression", projection,
            RequiredMissing("$.Expression"));

        var order = new OrderByExpression(BooleanExpression.True);
        SetAutoProperty(order, nameof(OrderByExpression.Expression), null);
        SetAutoProperty(order, nameof(OrderByExpression.Direction), (SqlSortDirection)999);
        SetAutoProperty(order, nameof(OrderByExpression.NullSortOrder), (SqlNullSortOrder)999);
        yield return Edge("order-required-before-enums", order,
            RequiredMissing("$.Expression"),
            UndefinedEnum("$.Direction"),
            UndefinedEnum("$.NullSortOrder"));
    }

    internal static IEnumerable<object[]> RetainedDmlCases()
    {
        var dual = DualSourceInsertWithNormalizableDescendant();
        yield return Edge("insert-dual-source", dual,
            InsertShapeInvalid("$.Source"));

        var badArity = BadRowArityInsertWithNormalizableDescendant();
        yield return Edge("insert-bad-row-arity", badArity,
            RowArityInvalid("$.Rows[0].Values"));

        var unsafeDelete = new DeleteStatement(ObjectName("T"),
            BooleanExpression.False, allowAllRows: true);
        SetAutoProperty(unsafeDelete, nameof(DeleteStatement.Where), BooleanExpression.True);
        SetAutoProperty(unsafeDelete, nameof(DeleteStatement.AllowAllRows), false);
        yield return Edge("delete-proven-true", unsafeDelete,
            WriteAllRows("$.Where"));

        var assignment = new SqlAssignment(Id("Value"), BooleanExpression.True);
        SetAutoProperty(assignment, nameof(SqlAssignment.Column), null);
        SetAutoProperty(assignment, nameof(SqlAssignment.Value), null);
        yield return Edge("assignment-required-order", assignment,
            RequiredMissing("$.Column"),
            RequiredMissing("$.Value"));

        var emptyRow = new SqlInsertRow(new[] { BooleanExpression.True });
        SetAutoProperty(emptyRow, nameof(SqlInsertRow.Values),
            Array.AsReadOnly(Array.Empty<SqlExpression>()));
        yield return Edge("insert-row-empty-values", emptyRow,
            CollectionEmpty("$.Values"));

        var emptyReturning = Returning(BooleanExpression.True);
        SetAutoProperty(emptyReturning, nameof(ReturningClause.Projections),
            Array.AsReadOnly(Array.Empty<SelectProjection>()));
        yield return Edge("returning-empty-projections", emptyReturning,
            CollectionEmpty("$.Projections"));

        var update = new UpdateStatement(ObjectName("T"),
            new[] { new SqlAssignment(Id("Value"), BooleanExpression.True) },
            BooleanExpression.False);
        SetAutoProperty(update, nameof(UpdateStatement.Assignments),
            Array.AsReadOnly(Array.Empty<SqlAssignment>()));
        yield return Edge("update-empty-assignments", update,
            CollectionEmpty("$.Assignments"));
    }

    internal static IEnumerable<object[]> RetainedSchemaCases()
    {
        var column = GenerationAndDefaultColumnWithNormalizableDescendant();
        yield return Edge("generation-plus-default", column,
            StructuralInvalid("$.DefaultValue"));

        var identity = new IdentityGenerationDefinition(1, 1);
        SetAutoProperty(identity, nameof(IdentityGenerationDefinition.Increment), 0L);
        yield return Edge("identity-zero-increment", identity,
            ScalarInvalid("$.Increment"));

        var scope = SchemaScope.ForCatalogAndSchema(Id("catalog"), Id("schema"));
        SetAutoProperty(scope, nameof(SchemaScope.Schema), null);
        yield return Edge("catalog-without-schema", scope,
            StructuralInvalid("$.Schema"));

        var sequenceGeneration = new SequenceGenerationDefinition(ObjectName("S"));
        SetAutoProperty(sequenceGeneration,
            nameof(SequenceGenerationDefinition.Sequence), null);
        yield return Edge("sequence-generation-missing-name", sequenceGeneration,
            RequiredMissing("$.Sequence"));

        var computed = new ComputedGenerationDefinition(
            BooleanExpression.True, ComputedStorageKind.Virtual);
        SetAutoProperty(computed, nameof(ComputedGenerationDefinition.Expression), null);
        SetAutoProperty(computed, nameof(ComputedGenerationDefinition.Storage),
            (ComputedStorageKind)999);
        yield return Edge("computed-required-before-storage", computed,
            RequiredMissing("$.Expression"),
            UndefinedEnum("$.Storage"));

        var foreignKey = new ForeignKeyDefinition(
            Id("FK"), ObjectName("Other"),
            new ForeignKeyColumnSet(new[] { Id("Id") }, new[] { Id("OtherId") }),
            new ReferentialActions(
                ReferentialAction.NoAction, ReferentialAction.NoAction));
        SetAutoProperty(foreignKey, nameof(ForeignKeyDefinition.ReferencedTable), null);
        SetAutoProperty(foreignKey, nameof(ForeignKeyDefinition.Columns), null);
        SetAutoProperty(foreignKey, nameof(ForeignKeyDefinition.Actions), null);
        yield return Edge("foreign-key-required-order", foreignKey,
            RequiredMissing("$.ReferencedTable"),
            RequiredMissing("$.Columns"),
            RequiredMissing("$.Actions"));
    }

    internal static IEnumerable<object[]> RetainedOperationAdminCases()
    {
        var diagnostic = new DatabaseDiagnosticOperation(DatabaseDiagnosticKind.Health);
        SetAutoProperty(diagnostic, nameof(DatabaseDiagnosticOperation.Kind),
            (DatabaseDiagnosticKind)999);
        yield return Edge("diagnostic-undefined-kind", diagnostic,
            UndefinedEnum("$.Kind"));

        var resource = Resource();
        var import = new DatabaseImportOperation(Id("db"), resource,
            DatabaseTransferFormat.PortableJson, DatabaseTransferScope.SchemaOnly,
            DatabaseImportConflictPolicy.FailOnConflict);
        SetAutoProperty(import, nameof(DatabaseImportOperation.Policy),
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        yield return Edge("replacement-import-schema-only", import,
            StructuralInvalid("$.Scope"));

        var plan = MigrationPlanWithMalformedFingerprintAndNormalizableDescendant();
        yield return Edge("migration-malformed-fingerprint", plan,
            ScalarInvalid("$.Fingerprint.Value"));

        var createSchema = new CreateSchemaOperation(
            new SchemaName(Id("app")), CreateObjectBehavior.FailIfExists);
        SetAutoProperty(createSchema, nameof(CreateSchemaOperation.Behavior),
            (CreateObjectBehavior)999);
        yield return Edge("create-schema-undefined-behavior", createSchema,
            UndefinedEnum("$.Behavior"));

        var dropSchema = new DropSchemaOperation(
            new SchemaName(Id("app")), DropObjectBehavior.FailIfMissing,
            DropScope.Restrict);
        SetAutoProperty(dropSchema, nameof(DropSchemaOperation.Behavior),
            (DropObjectBehavior)999);
        SetAutoProperty(dropSchema, nameof(DropSchemaOperation.Scope), (DropScope)999);
        yield return Edge("drop-schema-enum-order", dropSchema,
            UndefinedEnum("$.Behavior"),
            UndefinedEnum("$.Scope"));

        var tableDefinition = new TableDefinition(
            ObjectName("T"), new[] { IntColumn("Id") });
        var createTable = new CreateTableOperation(
            tableDefinition, CreateObjectBehavior.FailIfExists);
        SetAutoProperty(createTable, nameof(CreateTableOperation.Behavior),
            (CreateObjectBehavior)999);
        yield return Edge("create-table-undefined-behavior", createTable,
            UndefinedEnum("$.Behavior"));

        var dropTable = new DropTableOperation(
            ObjectName("T"), DropObjectBehavior.FailIfMissing, DropScope.Restrict);
        SetAutoProperty(dropTable, nameof(DropTableOperation.Behavior),
            (DropObjectBehavior)999);
        SetAutoProperty(dropTable, nameof(DropTableOperation.Scope), (DropScope)999);
        yield return Edge("drop-table-enum-order", dropTable,
            UndefinedEnum("$.Behavior"),
            UndefinedEnum("$.Scope"));

        var addColumn = new AddColumnOperation(ObjectName("T"), IntColumn("Value"));
        SetAutoProperty(addColumn, nameof(AddColumnOperation.Column), null);
        yield return Edge("add-column-missing-column", addColumn,
            RequiredMissing("$.Column"));

        var beforeColumn = IntColumn("Value");
        var afterColumn = IntColumn("Value");
        var alterColumn = new AlterColumnOperation(
            ObjectName("T"), beforeColumn, afterColumn);
        SetAutoProperty(afterColumn, nameof(ColumnDefinition.Name), Id("Changed"));
        yield return Edge("alter-column-name-mismatch", alterColumn,
            SchemaAlterMismatch("$.After.Name"));

        var renameColumn = new RenameColumnOperation(
            ObjectName("T"), Id("Source"), Id("Target"));
        SetAutoProperty(renameColumn, nameof(RenameColumnOperation.Target),
            renameColumn.Source);
        yield return Edge("rename-column-noop", renameColumn,
            StructuralInvalid("$.Target"));

        var dropColumn = new DropColumnOperation(
            ObjectName("T"), Id("Value"), DropObjectBehavior.FailIfMissing);
        SetAutoProperty(dropColumn, nameof(DropColumnOperation.Behavior),
            (DropObjectBehavior)999);
        yield return Edge("drop-column-undefined-behavior", dropColumn,
            UndefinedEnum("$.Behavior"));

        var addConstraint = new AddConstraintOperation(
            ObjectName("T"), new PrimaryKeyDefinition(Id("PK"), new[] { Id("Id") }));
        SetAutoProperty(addConstraint, nameof(AddConstraintOperation.Constraint), null);
        yield return Edge("add-constraint-missing-constraint", addConstraint,
            RequiredMissing("$.Constraint"));

        var dropConstraint = new DropConstraintOperation(
            ObjectName("T"), Id("PK"), DropObjectBehavior.FailIfMissing);
        SetAutoProperty(dropConstraint, nameof(DropConstraintOperation.Behavior),
            (DropObjectBehavior)999);
        yield return Edge("drop-constraint-undefined-behavior", dropConstraint,
            UndefinedEnum("$.Behavior"));

        var index = new IndexDefinition(Id("IX"),
            new[] { new IndexColumnDefinition(Id("Id"), SqlSortDirection.Ascending) },
            IndexUniqueness.NonUnique);
        var createIndex = new CreateIndexOperation(
            ObjectName("T"), index, CreateObjectBehavior.FailIfExists);
        SetAutoProperty(createIndex, nameof(CreateIndexOperation.Behavior),
            (CreateObjectBehavior)999);
        yield return Edge("create-index-undefined-behavior", createIndex,
            UndefinedEnum("$.Behavior"));

        var dropIndex = new DropIndexOperation(
            ObjectName("T"), Id("IX"), DropObjectBehavior.FailIfMissing);
        SetAutoProperty(dropIndex, nameof(DropIndexOperation.Behavior),
            (DropObjectBehavior)999);
        yield return Edge("drop-index-undefined-behavior", dropIndex,
            UndefinedEnum("$.Behavior"));

        var sequence = new SequenceDefinition(
            ObjectName("S"), LogicalDbType.Int64, ValidSequenceOptions());
        var createSequence = new CreateSequenceOperation(
            sequence, CreateObjectBehavior.FailIfExists);
        SetAutoProperty(createSequence, nameof(CreateSequenceOperation.Behavior),
            (CreateObjectBehavior)999);
        yield return Edge("create-sequence-undefined-behavior", createSequence,
            UndefinedEnum("$.Behavior"));

        var alteredSequence = new SequenceDefinition(
            ObjectName("S"), LogicalDbType.Int64, ValidSequenceOptions());
        var alterSequence = new AlterSequenceOperation(sequence, alteredSequence);
        SetAutoProperty(alteredSequence, nameof(SequenceDefinition.Name), ObjectName("Other"));
        yield return Edge("alter-sequence-name-mismatch", alterSequence,
            SchemaAlterMismatch("$.After.Name"));

        var dropSequence = new DropSequenceOperation(
            ObjectName("S"), DropObjectBehavior.FailIfMissing);
        SetAutoProperty(dropSequence, nameof(DropSequenceOperation.Behavior),
            (DropObjectBehavior)999);
        yield return Edge("drop-sequence-undefined-behavior", dropSequence,
            UndefinedEnum("$.Behavior"));

        var removeTableComment = new RemoveTableCommentOperation(ObjectName("T"));
        SetAutoProperty(removeTableComment,
            nameof(RemoveTableCommentOperation.Table), null);
        yield return Edge("remove-table-comment-missing-table", removeTableComment,
            RequiredMissing("$.Table"));

        var setColumnComment = new SetColumnCommentOperation(
            ObjectName("T"), Id("Value"), new SchemaComment("comment"));
        SetAutoProperty(setColumnComment,
            nameof(SetColumnCommentOperation.Comment), null);
        yield return Edge("set-column-comment-missing-comment", setColumnComment,
            RequiredMissing("$.Comment"));

        var removeColumnComment = new RemoveColumnCommentOperation(
            ObjectName("T"), Id("Value"));
        SetAutoProperty(removeColumnComment,
            nameof(RemoveColumnCommentOperation.Column), null);
        yield return Edge("remove-column-comment-missing-column", removeColumnComment,
            RequiredMissing("$.Column"));

        var tableMetadata = new GetTableMetadataOperation(ObjectName("T"));
        SetAutoProperty(tableMetadata, nameof(GetTableMetadataOperation.Table), null);
        yield return Edge("table-metadata-missing-table", tableMetadata,
            RequiredMissing("$.Table"));

        var columnMetadata = new GetColumnMetadataOperation(ObjectName("T"), Id("Value"));
        SetAutoProperty(columnMetadata, nameof(GetColumnMetadataOperation.Table), null);
        SetAutoProperty(columnMetadata, nameof(GetColumnMetadataOperation.Column), null);
        yield return Edge("column-metadata-required-order", columnMetadata,
            RequiredMissing("$.Table"),
            RequiredMissing("$.Column"));

        var indexMetadata = new GetIndexMetadataOperation(ObjectName("T"), Id("IX"));
        SetAutoProperty(indexMetadata, nameof(GetIndexMetadataOperation.Table), null);
        SetAutoProperty(indexMetadata, nameof(GetIndexMetadataOperation.Index), null);
        yield return Edge("index-metadata-required-order", indexMetadata,
            RequiredMissing("$.Table"),
            RequiredMissing("$.Index"));

        var createDatabase = new CreateDatabaseOperation(
            Id("db"), CreateObjectBehavior.FailIfExists);
        SetAutoProperty(createDatabase, nameof(CreateDatabaseOperation.Behavior),
            (CreateObjectBehavior)999);
        yield return Edge("create-database-undefined-behavior", createDatabase,
            UndefinedEnum("$.Behavior"));

        var dropDatabase = new DropDatabaseOperation(
            Id("db"), DropObjectBehavior.FailIfMissing);
        SetAutoProperty(dropDatabase.Fingerprint,
            nameof(StructuralFingerprint.Value), "invalid");
        yield return Edge("drop-database-invalid-fingerprint", dropDatabase,
            ScalarInvalid("$.Fingerprint.Value"));
    }

    internal static SelectStatement NestedQueryGraph()
    {
        var leaf = SelectOf(new ColumnExpression(Id("Id")));
        var cte = new CommonTableExpression(Id("C"), leaf, new[] { Id("Id") });
        var derived = new DerivedTableSource(leaf, new SqlAlias("d"));
        var join = new JoinSource(derived, SqlJoinType.Left,
            new NamedTableSource(ObjectName("R"), new SqlAlias("r")),
            BooleanExpression.True);
        return new SelectStatement(join,
            new[] { new SelectProjection(new ColumnExpression(Id("Id"), new SqlAlias("d"))) },
            orderBy: new[] { new OrderByExpression(new ColumnExpression(Id("Id"))) },
            page: new KeysetPageSpec(new[] { new ColumnExpression(Id("Id")) }, 10),
            commonTableExpressions: new[] { cte },
            setOperations: new[] { new SetOperationClause(SqlSetOperator.UnionAll, leaf) });
    }

    internal static IReadOnlyList<SqlNode> AllDmlDescendants()
    {
        var returning = Returning(new ColumnExpression(Id("Id")));
        var row = new SqlInsertRow(new SqlExpression[] { BooleanExpression.True });
        return Array.AsReadOnly<SqlNode>(new SqlNode[]
        {
            new SqlAssignment(Id("Value"), BooleanExpression.True),
            row,
            returning,
            InsertStatement.Values(ObjectName("T"), new[] { Id("Value") },
                new[] { row }, returning),
            new UpdateStatement(ObjectName("T"),
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.True) },
                BooleanExpression.False, returning: returning),
            new DeleteStatement(ObjectName("T"), BooleanExpression.False,
                returning: returning),
            new UpsertStatement(ObjectName("T"), new[] { Id("Id") },
                new[]
                {
                    new SqlAssignment(Id("Id"), BooleanExpression.True),
                    new SqlAssignment(Id("Value"), BooleanExpression.True)
                },
                new[] { new SqlAssignment(Id("Value"), BooleanExpression.False) },
                returning: returning),
            new BulkInsertOperation(ObjectName("T"), new[] { Id("Value") },
                new[] { row }, 10)
        });
    }

    internal static MigrationPlan MigrationWithComputedGeneration()
    {
        var column = new ColumnDefinition(Id("Computed"),
            new SqlTypeDescriptor(LogicalDbType.Int32), ColumnNullability.Nullable,
            generation: new ComputedGenerationDefinition(
                new BinaryExpression(new ColumnExpression(Id("Source")),
                    SqlBinaryOperator.Add, IntParameterExpression("delta")),
                ComputedStorageKind.Stored));
        var operation = new CreateTableOperation(
            new TableDefinition(ObjectName("T"), new[] { column }),
            CreateObjectBehavior.FailIfExists);
        return new MigrationPlan(new MigrationPlanId("computed"), new[]
        {
            new MigrationStep(new MigrationStepId("create"), operation,
                MigrationIdempotencyMode.RequireChange)
        });
    }

    internal static IEnumerable<object[]> ResultAritySamples()
    {
        yield return new object[] { "explicit-one", SelectOf(BooleanExpression.True) };
        yield return new object[] { "explicit-two", ExplicitSelect(2) };
        yield return new object[] { "wildcard-unknown", SelectOf(new WildcardExpression()) };
        yield return new object[] { "insert-explicit-match",
            InsertStatement.FromSelect(ObjectName("T"), new[] { Id("A"), Id("B") },
                ExplicitSelect(2)) };
        yield return new object[] { "insert-wildcard-unknown",
            InsertStatement.FromSelect(ObjectName("T"), new[] { Id("A") },
                SelectOf(new WildcardExpression())) };
        yield return new object[] { "cte-explicit",
            new CommonTableExpression(Id("C"), ExplicitSelect(2),
                new[] { Id("A"), Id("B") }) };
        yield return new object[] { "set-coherent",
            new SelectStatement(
                new[] { new SelectProjection(BooleanExpression.True) },
                setOperations: new[]
                {
                    new SetOperationClause(SqlSetOperator.UnionAll,
                        SelectOf(BooleanExpression.False))
                }) };
    }

    internal static IEnumerable<object[]> SafeWriteSamples()
    {
        var unknown = IntParameterExpression("p");
        yield return Truth("true", BooleanExpression.True, "True");
        yield return Truth("false", BooleanExpression.False, "False");
        yield return Truth("not-true",
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True), "False");
        yield return Truth("not-false",
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False), "True");
        yield return Truth("true-and-true",
            new BinaryExpression(BooleanExpression.True, SqlBinaryOperator.And,
                BooleanExpression.True), "True");
        yield return Truth("false-and-unknown",
            new BinaryExpression(BooleanExpression.False, SqlBinaryOperator.And, unknown),
            "False");
        yield return Truth("unknown-and-false",
            new BinaryExpression(unknown, SqlBinaryOperator.And, BooleanExpression.False),
            "False");
        yield return Truth("true-or-unknown",
            new BinaryExpression(BooleanExpression.True, SqlBinaryOperator.Or, unknown),
            "True");
        yield return Truth("unknown-or-true",
            new BinaryExpression(unknown, SqlBinaryOperator.Or, BooleanExpression.True),
            "True");
        yield return Truth("false-or-false",
            new BinaryExpression(BooleanExpression.False, SqlBinaryOperator.Or,
                BooleanExpression.False), "False");
        var column = new ColumnExpression(Id("Value"));
        yield return Truth("reference-tautology-not-proven",
            new BinaryExpression(column, SqlBinaryOperator.Equal, column), "Unknown");
        yield return Truth("excluded-middle-not-proven",
            new BinaryExpression(column, SqlBinaryOperator.Or,
                new UnaryExpression(SqlUnaryOperator.Not, column)), "Unknown");
    }

    internal static IEnumerable<object[]> RetainedInvalidNormalizationRoots()
    {
        yield return new object[] { "dual-source", DualSourceInsertWithNormalizableDescendant(),
            "AST_INSERT_SOURCE_SHAPE_INVALID", "$.Source" };
        yield return new object[] { "bad-row-arity", BadRowArityInsertWithNormalizableDescendant(),
            "AST_DML_ROW_ARITY_MISMATCH", "$.Rows[0].Values" };
        yield return new object[] { "generation-plus-default",
            GenerationAndDefaultColumnWithNormalizableDescendant(),
            "AST_STRUCTURAL_SHAPE_INVALID", "$.DefaultValue" };
        yield return new object[] { "malformed-fingerprint",
            MigrationPlanWithMalformedFingerprintAndNormalizableDescendant(),
            "AST_SCALAR_INVALID", "$.Fingerprint.Value" };
    }

    internal static SqlExpression ExactDepthChain(int edges)
    {
        SqlExpression current = BooleanExpression.True;
        for (var index = 0; index < edges; index++)
            current = new UnaryExpression(SqlUnaryOperator.Not, current);
        return current;
    }

    internal static InExpression SharedDagOccurrences(int occurrenceCount)
    {
        if (occurrenceCount < 2)
            throw new ArgumentOutOfRangeException(nameof(occurrenceCount));
        var shared = BooleanExpression.True;
        return new InExpression(shared,
            Enumerable.Repeat<SqlExpression>(shared, occurrenceCount - 2));
    }

    internal static SqlExpression SharedDagTree(int layers)
    {
        SqlExpression current = BooleanExpression.True;
        for (var index = 0; index < layers; index++)
            current = new BinaryExpression(current, SqlBinaryOperator.And, current);
        return current;
    }

    internal static IEnumerable<object[]> ParameterDefinitionSamples()
    {
        yield return ParameterPair("equivalent",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.String, length: 64)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.String, length: 64)), true);
        yield return ParameterPair("logical-type",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Int32)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Int64)), false);
        yield return ParameterPair("length",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.String, length: 64)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.String, length: 65)), false);
        yield return ParameterPair("precision",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 2)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 11, scale: 2)), false);
        yield return ParameterPair("scale",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 2)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 10, scale: 3)), false);
        yield return ParameterPair("direction",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Int32)),
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Int32),
                ParameterDirection.Output), false);
        yield return ParameterPair("nullable",
            Parameter("p", new SqlTypeDescriptor(LogicalDbType.Int32)),
            new ParameterDefinition("p", new SqlTypeDescriptor(LogicalDbType.Int32),
                ParameterDirection.Input, isNullable: false), false);
    }

    internal static InsertStatement DualSourceInsertWithNormalizableDescendant()
    {
        var insert = InsertStatement.Values(ObjectName("T"), new[] { Id("Value") },
            new[] { new SqlInsertRow(new[] { NormalizableNullComparison() }) });
        SetAutoProperty(insert, nameof(InsertStatement.Source), ExplicitSelect(1));
        return insert;
    }

    internal static InsertStatement BadRowArityInsertWithNormalizableDescendant()
    {
        var row = new SqlInsertRow(new[] { NormalizableNullComparison() });
        var insert = InsertStatement.Values(ObjectName("T"), new[] { Id("Value") },
            new[] { row });
        SetAutoProperty(row, nameof(SqlInsertRow.Values),
            Array.AsReadOnly<SqlExpression>(new SqlExpression[]
            {
                NormalizableNullComparison(), BooleanExpression.True
            }));
        return insert;
    }

    internal static ColumnDefinition GenerationAndDefaultColumnWithNormalizableDescendant()
    {
        var column = new ColumnDefinition(Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32), ColumnNullability.Nullable,
            generation: new ComputedGenerationDefinition(
                NormalizableNullComparison(), ComputedStorageKind.Virtual));
        SetAutoProperty(column, nameof(ColumnDefinition.DefaultValue),
            new Int64DefaultDefinition(1));
        return column;
    }

    internal static MigrationPlan MigrationPlanWithMalformedFingerprintAndNormalizableDescendant()
    {
        var plan = MigrationWithComputedGeneration();
        SetAutoProperty(plan.Fingerprint, nameof(StructuralFingerprint.Value), "invalid");
        return plan;
    }

    private static object[] Edge(string name, SqlNode root, params string[] snapshot) =>
        new object[] { name, root, snapshot };

    private static object[] Truth(string name, SqlExpression expression, string truth) =>
        new object[] { name, expression, truth };

    private static object[] ParameterPair(
        string name, ParameterDefinition first, ParameterDefinition second, bool equivalent) =>
        new object[] { name, first, second, equivalent };

    private static ParameterDefinition Parameter(
        string name, SqlTypeDescriptor type,
        ParameterDirection direction = ParameterDirection.Input) =>
        new(name, type, direction, isNullable: true);

    private static ParameterExpression IntParameterExpression(string name) =>
        new(new ParameterDefinition(name, new SqlTypeDescriptor(LogicalDbType.Int32)));

    private static SelectStatement SelectOf(SqlExpression expression) =>
        new(new[] { new SelectProjection(expression) });

    private static SelectStatement ExplicitSelect(int width) =>
        new(Enumerable.Range(0, width)
            .Select(index => new SelectProjection(
                new ColumnExpression(Id("C" + index)))).ToArray());

    private static ReturningClause Returning(SqlExpression expression) =>
        new(new[] { new SelectProjection(expression) });

    private static SqlExpression NormalizableNullComparison() =>
        new BinaryExpression(new ColumnExpression(Id("Value")),
            SqlBinaryOperator.Equal, NullExpression.Instance);

    private static ColumnDefinition InvalidColumnDefinition() =>
        new(InvalidId(), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);

    private static ColumnDefinition IntColumn(string name) =>
        new(Id(name), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.NotNullable);

    private static SequenceOptions ValidSequenceOptions() =>
        new(1, 1, SequenceBounds.Between(1, 100), 10,
            SequenceCycleBehavior.NoCycle);

    private static DatabaseResourceHandle Resource() =>
        new(Guid.Parse("11111111-1111-1111-1111-111111111111"),
            new ResourceContentDigest(new string('a', 64)));

    private static ColumnExpression InvalidColumn() => new(InvalidId());

    private static SqlIdentifier InvalidId()
    {
        var identifier = Id("Invalid");
        SetAutoProperty(identifier, nameof(SqlIdentifier.Value), "invalid.identifier");
        return identifier;
    }

    private static string Diagnostic(string code, string message, string path) =>
        code + "\u001f" + message + "\u001f" + path;

    private static string InvalidIdentifier(string path) => Diagnostic(
        "AST_INVALID_IDENTIFIER", "SQL identifier is not one valid unquoted segment.", path);
    private static string UndefinedEnum(string path) => Diagnostic(
        "AST_UNDEFINED_ENUM", "SQL AST contains an undefined enumeration value.", path);
    private static string ScalarInvalid(string path) => Diagnostic(
        "AST_SCALAR_INVALID", "SQL AST scalar value is invalid.", path);
    private static string StructuralInvalid(string path) => Diagnostic(
        "AST_STRUCTURAL_SHAPE_INVALID", "SQL AST structural shape is invalid.", path);
    private static string RequiredMissing(string path) => Diagnostic(
        "AST_REQUIRED_CHILD_MISSING", "SQL AST contains a missing required child.", path);
    private static string CollectionEmpty(string path) => Diagnostic(
        "AST_COLLECTION_EMPTY", "Required SQL AST collection is empty.", path);
    private static string InsertShapeInvalid(string path) => Diagnostic(
        "AST_INSERT_SOURCE_SHAPE_INVALID", "Insert must contain exactly one values or select source.", path);
    private static string RowArityInvalid(string path) => Diagnostic(
        "AST_DML_ROW_ARITY_MISMATCH", "DML row value count must match target column count.", path);
    private static string WriteAllRows(string path) => Diagnostic(
        "AST_WRITE_ALL_ROWS_NOT_ALLOWED", "Full-table write requires explicit AllowAllRows.", path);
    private static string SubquerySelectRequired(string path) => Diagnostic(
        "AST_SUBQUERY_SELECT_REQUIRED", "Subquery must contain a SelectStatement.", path);
    private static string SchemaAlterMismatch(string path) => Diagnostic(
        "AST_SCHEMA_ALTER_MISMATCH",
        "Before and after schema definitions do not identify the same object.", path);
    private static string SequenceInvalid(string path) => Diagnostic(
        "AST_SCHEMA_SEQUENCE_INVALID", "Sequence type, bounds, start, increment, or cache is invalid.", path);

    private static void SetAutoProperty(object target, string propertyName, object? value)
    {
        var field = target.GetType().GetField(
            $"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        if (field == null)
            throw new InvalidOperationException("Auto-property backing field was not found: " + propertyName);
        field.SetValue(target, value);
    }

    internal static SqlIdentifier Id(string value) => new(value);

    internal static SqlObjectName ObjectName(string name) => new(Id(name));
}
