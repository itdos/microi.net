using System.Data;
using System.Reflection;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    public static IEnumerable<object[]> AllocationDmlOrderCases
    {
        get
        {
            var table = AstSamples.ObjectName("T");
            var id = AstSamples.Id("Id");
            var value = AstSamples.Id("Value");

            yield return new object[]
            {
                "values-insert",
                InsertStatement.Values(
                    table,
                    new[] { id, value },
                    new[]
                    {
                        new SqlInsertRow(new SqlExpression[]
                        {
                            AllocationParameterExpression("row_1_id"),
                            AllocationParameterExpression("row_1_value")
                        }),
                        new SqlInsertRow(new SqlExpression[]
                        {
                            AllocationParameterExpression("row_2_id"),
                            AllocationParameterExpression("row_2_value")
                        })
                    },
                    AllocationReturning("returning")),
                new[]
                {
                    "row_1_id", "row_1_value", "row_2_id", "row_2_value",
                    "returning"
                }
            };

            yield return new object[]
            {
                "select-insert",
                InsertStatement.FromSelect(
                    table,
                    new[] { id },
                    AllocationSelect("source"),
                    AllocationReturning("returning")),
                new[] { "source", "returning" }
            };

            yield return new object[]
            {
                "update",
                new UpdateStatement(
                    table,
                    new[]
                    {
                        new SqlAssignment(id, AllocationParameterExpression("assignment_id")),
                        new SqlAssignment(value, AllocationParameterExpression("assignment_value"))
                    },
                    AllocationParameterExpression("where"),
                    returning: AllocationReturning("returning")),
                new[] { "assignment_id", "assignment_value", "where", "returning" }
            };

            yield return new object[]
            {
                "delete",
                new DeleteStatement(
                    table,
                    AllocationParameterExpression("where"),
                    returning: AllocationReturning("returning")),
                new[] { "where", "returning" }
            };

            yield return new object[]
            {
                "upsert",
                new UpsertStatement(
                    table,
                    new[] { id },
                    new[]
                    {
                        new SqlAssignment(id, AllocationParameterExpression("insert_id")),
                        new SqlAssignment(value, AllocationParameterExpression("insert_value"))
                    },
                    new[]
                    {
                        new SqlAssignment(
                            AstSamples.Id("UpdatedValue"),
                            AllocationParameterExpression("update_value"))
                    },
                    returning: AllocationReturning("returning")),
                new[] { "insert_id", "insert_value", "update_value", "returning" }
            };

            yield return new object[]
            {
                "bulk-insert",
                new BulkInsertOperation(
                    table,
                    new[] { id, value },
                    new[]
                    {
                        new SqlInsertRow(new SqlExpression[]
                        {
                            AllocationParameterExpression("bulk_1_id"),
                            AllocationParameterExpression("bulk_1_value")
                        }),
                        new SqlInsertRow(new SqlExpression[]
                        {
                            AllocationParameterExpression("bulk_2_id"),
                            AllocationParameterExpression("bulk_2_value")
                        })
                    },
                    batchSize: 2),
                new[] { "bulk_1_id", "bulk_1_value", "bulk_2_id", "bulk_2_value" }
            };
        }
    }

    public static IEnumerable<object[]>
        AllocationRetainedCollectionPropertyCases
    {
        get
        {
            yield return new object[] { 0, "InExpression.Values" };
            yield return new object[] { 1, "CaseExpression.WhenClauses" };
            yield return new object[] { 2, "FunctionExpression.Arguments" };
            yield return new object[] { 3, "KeysetPageSpec.Boundaries" };
            yield return new object[] { 4, "CommonTableExpression.Columns" };
            yield return new object[] { 5, "SelectStatement.Projections" };
            yield return new object[] { 6, "SelectStatement.GroupBy" };
            yield return new object[] { 7, "SelectStatement.OrderBy" };
            yield return new object[]
            {
                8, "SelectStatement.CommonTableExpressions"
            };
            yield return new object[] { 9, "SelectStatement.SetOperations" };
            yield return new object[] { 10, "SqlInsertRow.Values" };
            yield return new object[] { 11, "ReturningClause.Projections" };
            yield return new object[] { 12, "InsertStatement.Columns" };
            yield return new object[] { 13, "InsertStatement.Rows" };
            yield return new object[] { 14, "UpdateStatement.Assignments" };
            yield return new object[] { 15, "UpsertStatement.ConflictKeys" };
            yield return new object[]
            {
                16, "UpsertStatement.InsertAssignments"
            };
            yield return new object[]
            {
                17, "UpsertStatement.UpdateAssignments"
            };
            yield return new object[] { 18, "BulkInsertOperation.Columns" };
            yield return new object[] { 19, "BulkInsertOperation.Rows" };
            yield return new object[] { 20, "IndexDefinition.Columns" };
            yield return new object[] { 21, "PrimaryKeyDefinition.Columns" };
            yield return new object[]
            {
                22, "UniqueConstraintDefinition.Columns"
            };
            yield return new object[]
            {
                23, "ForeignKeyColumnSet.LocalColumns"
            };
            yield return new object[]
            {
                24, "ForeignKeyColumnSet.ReferencedColumns"
            };
            yield return new object[] { 25, "TableDefinition.Columns" };
            yield return new object[] { 26, "TableDefinition.Constraints" };
            yield return new object[] { 27, "TableDefinition.Indexes" };
            yield return new object[] { 28, "MigrationPlan.Steps" };
        }
    }

    [Fact]
    public void User_query_parameter_slots_are_canonical()
    {
        var query = AstSamples.UserByAccountAndStatus();
        var slots = AllocationAssertSlots(query, "account", "status");

        var conjunction = Assert.IsType<BinaryExpression>(query.Where);
        var accountComparison = Assert.IsType<BinaryExpression>(conjunction.Left);
        var statusComparison = Assert.IsType<BinaryExpression>(conjunction.Right);
        var account = Assert.IsType<ParameterExpression>(accountComparison.Right);
        var status = Assert.IsType<ParameterExpression>(statusComparison.Right);

        Assert.Same(account.Definition, slots[0].Definition);
        Assert.Same(status.Definition, slots[1].Definition);
    }

    [Fact]
    public void Expression_parameter_order_is_canonical()
    {
        var expression = new FunctionExpression(
            SemanticFunctions.Coalesce,
            new SqlExpression[]
            {
                new BinaryExpression(
                    AllocationParameterExpression("binary_left"),
                    SqlBinaryOperator.Add,
                    AllocationParameterExpression("binary_right")),
                new UnaryExpression(
                    SqlUnaryOperator.Negate,
                    AllocationParameterExpression("unary")),
                new InExpression(
                    AllocationParameterExpression("in_operand"),
                    new SqlExpression[]
                    {
                        AllocationParameterExpression("in_value_1"),
                        AllocationParameterExpression("in_value_2")
                    }),
                new BetweenExpression(
                    AllocationParameterExpression("between_operand"),
                    AllocationParameterExpression("between_lower"),
                    AllocationParameterExpression("between_upper")),
                new CaseExpression(
                    AllocationParameterExpression("case_input"),
                    new[]
                    {
                        new CaseWhenClause(
                            AllocationParameterExpression("case_when"),
                            AllocationParameterExpression("case_then"))
                    },
                    AllocationParameterExpression("case_else")),
                new CastExpression(
                    AllocationParameterExpression("cast"),
                    new SqlTypeDescriptor(LogicalDbType.Int64)),
                new SubqueryExpression(AllocationSelect("subquery")),
                new ExistsExpression(
                    new SubqueryExpression(AllocationSelect("exists"))),
                new AggregateExpression(
                    SemanticFunctions.Sum,
                    AllocationParameterExpression("aggregate"))
            });

        AllocationAssertSlots(
            expression,
            "binary_left", "binary_right", "unary",
            "in_operand", "in_value_1", "in_value_2",
            "between_operand", "between_lower", "between_upper",
            "case_input", "case_when", "case_then", "case_else",
            "cast", "subquery", "exists", "aggregate");
    }

    [Fact]
    public void Case_parameters_follow_input_when_then_else_order()
    {
        var expression = new CaseExpression(
            AllocationParameterExpression("input"),
            new[]
            {
                new CaseWhenClause(
                    AllocationParameterExpression("when"),
                    AllocationParameterExpression("then"))
            },
            AllocationParameterExpression("else"));

        Assert.Equal(
            new[] { "input", "when", "then", "else" },
            new SqlParameterAllocator().Allocate(expression)
                .Select(slot => slot.Definition.Name)
                .ToArray());
    }

    [Fact]
    public void Query_parameter_order_is_canonical()
    {
        var from = new JoinSource(
            new DerivedTableSource(
                AllocationSelect("from_left"), new SqlAlias("left_source")),
            SqlJoinType.Inner,
            new DerivedTableSource(
                AllocationSelect("from_right"), new SqlAlias("right_source")),
            AllocationParameterExpression("join_condition"));
        var query = new SelectStatement(
            from,
            new[]
            {
                new SelectProjection(AllocationParameterExpression("projection"))
            },
            whereExpression: AllocationParameterExpression("where"),
            groupBy: new[] { AllocationParameterExpression("group") },
            havingExpression: AllocationParameterExpression("having"),
            orderBy: new[]
            {
                new OrderByExpression(AllocationParameterExpression("order"))
            },
            page: new KeysetPageSpec(
                new[] { AllocationParameterExpression("boundary") }, 10),
            lockSpec: new LockSpec(SqlLockMode.Share),
            commonTableExpressions: new[]
            {
                new CommonTableExpression(
                    AstSamples.Id("Cte"), AllocationSelect("cte"))
            },
            setOperations: new[]
            {
                new SetOperationClause(
                    SqlSetOperator.UnionAll, AllocationSelect("set"))
            });

        AllocationAssertSlots(
            query,
            "from_left", "from_right", "join_condition", "projection",
            "where", "group", "having", "order", "boundary", "cte", "set");
    }

    [Fact]
    public void Join_condition_parameter_is_traversed()
    {
        var join = new JoinSource(
            new NamedTableSource(AstSamples.ObjectName("LeftTable")),
            SqlJoinType.Inner,
            new NamedTableSource(AstSamples.ObjectName("RightTable")),
            AllocationParameterExpression("condition"));

        Assert.Equal(
            new[] { "condition" },
            new SqlParameterAllocator().Allocate(join)
                .Select(slot => slot.Definition.Name)
                .ToArray());
    }

    [Theory]
    [MemberData(nameof(AllocationDmlOrderCases))]
    public void Dml_parameter_order_is_canonical(
        string caseName,
        SqlNode root,
        string[] expectedNames)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        AllocationAssertSlots(root, expectedNames);
    }

    [Fact]
    public void Schema_parameter_order_is_canonical()
    {
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                AllocationComputedColumn("First", "first_generation"),
                AllocationComputedColumn("Second", "second_generation")
            });

        AllocationAssertSlots(table, "first_generation", "second_generation");
    }

    [Fact]
    public void Migration_parameter_order_is_canonical()
    {
        var tableName = AstSamples.ObjectName("T");
        var before = AllocationComputedColumn("Altered", "alter_before");
        var after = AllocationComputedColumn("Altered", "alter_after");
        var steps = new[]
        {
            new MigrationStep(
                new MigrationStepId("create"),
                new CreateTableOperation(
                    new TableDefinition(
                        tableName,
                        new[] { AllocationComputedColumn("Created", "create") }),
                    CreateObjectBehavior.FailIfExists),
                MigrationIdempotencyMode.RequireChange),
            new MigrationStep(
                new MigrationStepId("add"),
                new AddColumnOperation(
                    tableName, AllocationComputedColumn("Added", "add")),
                MigrationIdempotencyMode.RequireChange),
            new MigrationStep(
                new MigrationStepId("alter"),
                new AlterColumnOperation(tableName, before, after),
                MigrationIdempotencyMode.RequireChange)
        };
        var plan = new MigrationPlan(new MigrationPlanId("allocation"), steps);

        AllocationAssertSlots(
            plan, "create", "add", "alter_before", "alter_after");
    }

    [Fact]
    public void Allocate_closed_catalog_covers_all_93_concrete_nodes()
    {
        var nodes = AstSamples.AllConcreteNodes();
        Assert.Equal(93, nodes.Count);
        Assert.Equal(
            93,
            nodes.Select(node => node.GetType()).Distinct().ToArray().Length);

        var expectedNamesByIndex = Enumerable.Range(0, 93)
            .Select(_ => Array.Empty<string>())
            .ToArray();
        expectedNamesByIndex[1] = new[] { "p" };
        expectedNamesByIndex[4] = new[] { "p" };

        var allocator = new SqlParameterAllocator();
        for (var index = 0; index < nodes.Count; index++)
        {
            var slots = allocator.Allocate(nodes[index]);
            Assert.Equal(
                expectedNamesByIndex[index],
                slots.Select(slot => slot.Definition.Name).ToArray());
            Assert.Equal(
                Enumerable.Range(0, expectedNamesByIndex[index].Length),
                slots.Select(slot => slot.Ordinal));
            Assert.Equal(
                Enumerable.Range(0, expectedNamesByIndex[index].Length)
                    .Select(ordinal => "p" + ordinal),
                slots.Select(slot => slot.Placeholder));
        }
    }

    [Fact]
    public void Repeated_equivalent_name_reuses_first_slot()
    {
        var definition = AllocationParameter("p");
        var root = new FunctionExpression(
            SemanticFunctions.Coalesce,
            new SqlExpression[]
            {
                new ParameterExpression(definition),
                new ParameterExpression(definition),
                new ParameterExpression(definition)
            });

        var slot = Assert.Single(new SqlParameterAllocator().Allocate(root));
        Assert.Equal(0, slot.Ordinal);
        Assert.Equal("p0", slot.Placeholder);
        Assert.Same(definition, slot.Definition);
    }

    [Fact]
    public void Distinct_equivalent_definitions_reuse_first_slot()
    {
        var first = AllocationParameter(
            "p", new SqlTypeDescriptor(LogicalDbType.String, length: 64));
        var second = AllocationParameter(
            "p", new SqlTypeDescriptor(LogicalDbType.String, length: 64));

        var slot = Assert.Single(
            new SqlParameterAllocator().Allocate(AllocationPair(first, second)));
        Assert.Same(first, slot.Definition);
    }

    [Fact]
    public void Conflict_in_logical_type_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter("p", new SqlTypeDescriptor(LogicalDbType.Int32)),
            AllocationParameter("p", new SqlTypeDescriptor(LogicalDbType.Int64)));
    }

    [Fact]
    public void Conflict_in_length_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter(
                "p", new SqlTypeDescriptor(LogicalDbType.String, length: 64)),
            AllocationParameter(
                "p", new SqlTypeDescriptor(LogicalDbType.String, length: 65)));
    }

    [Fact]
    public void Conflict_in_precision_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter(
                "p", new SqlTypeDescriptor(
                    LogicalDbType.Decimal, precision: 10, scale: 2)),
            AllocationParameter(
                "p", new SqlTypeDescriptor(
                    LogicalDbType.Decimal, precision: 11, scale: 2)));
    }

    [Fact]
    public void Conflict_in_scale_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter(
                "p", new SqlTypeDescriptor(
                    LogicalDbType.Decimal, precision: 10, scale: 2)),
            AllocationParameter(
                "p", new SqlTypeDescriptor(
                    LogicalDbType.Decimal, precision: 10, scale: 3)));
    }

    [Fact]
    public void Conflict_in_direction_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter("p", direction: ParameterDirection.Input),
            AllocationParameter("p", direction: ParameterDirection.Output));
    }

    [Fact]
    public void Conflict_in_nullability_is_rejected()
    {
        AllocationAssertConflict(
            AllocationParameter("p", isNullable: true),
            AllocationParameter("p", isNullable: false));
    }

    [Fact]
    public void Parameter_names_are_ordinal_case_sensitive()
    {
        var lower = AllocationParameter("p");
        var upper = AllocationParameter("P");
        var slots = new SqlParameterAllocator().Allocate(AllocationPair(lower, upper));

        Assert.Equal(new[] { "p", "P" },
            slots.Select(slot => slot.Definition.Name).ToArray());
        Assert.Equal(new[] { "p0", "p1" },
            slots.Select(slot => slot.Placeholder).ToArray());
    }

    [Fact]
    public void Placeholders_are_canonical_unprefixed_pn()
    {
        var parameters = Enumerable.Range(0, 12)
            .Select(index => (SqlExpression)AllocationParameterExpression("n" + index))
            .ToArray();
        var root = new FunctionExpression(SemanticFunctions.Coalesce, parameters);

        var slots = new SqlParameterAllocator().Allocate(root);
        Assert.Equal(
            new[]
            {
                "p0", "p1", "p2", "p3", "p4", "p5",
                "p6", "p7", "p8", "p9", "p10", "p11"
            },
            slots.Select(slot => slot.Placeholder).ToArray());
    }

    [Fact]
    public async Task Shared_allocator_is_concurrent_and_resets_per_call()
    {
        var statement = AstSamples.UserByAccountAndStatus();
        var allocator = new SqlParameterAllocator();
        var first = allocator.Allocate(statement);
        var second = allocator.Allocate(statement);

        Assert.Equal(new[] { 0, 1 }, first.Select(slot => slot.Ordinal).ToArray());
        Assert.Equal(new[] { "p0", "p1" },
            first.Select(slot => slot.Placeholder).ToArray());
        Assert.Equal(new[] { 0, 1 }, second.Select(slot => slot.Ordinal).ToArray());
        Assert.Equal(new[] { "p0", "p1" },
            second.Select(slot => slot.Placeholder).ToArray());

        var pending = Enumerable.Range(0, 50)
            .Select(_ => Task.Run(() => allocator.Allocate(statement)))
            .ToArray();

        var results = await Task.WhenAll(pending);

        Assert.Equal(50, results.Length);
        Assert.All(results, slots =>
        {
            Assert.Equal(new[] { 0, 1 }, slots.Select(slot => slot.Ordinal).ToArray());
            Assert.Equal(new[] { "p0", "p1" },
                slots.Select(slot => slot.Placeholder).ToArray());
            Assert.Equal(new[] { "account", "status" },
                slots.Select(slot => slot.Definition.Name).ToArray());
        });
    }

    [Fact]
    public void Slot_keeps_first_definition_reference()
    {
        var first = AllocationParameter(
            "same", new SqlTypeDescriptor(LogicalDbType.String, length: 32));
        var later = AllocationParameter(
            "same", new SqlTypeDescriptor(LogicalDbType.String, length: 32));

        var slot = Assert.Single(
            new SqlParameterAllocator().Allocate(AllocationPair(first, later)));
        Assert.Same(first, slot.Definition);
        Assert.NotSame(later, slot.Definition);
    }

    [Fact]
    public void Allocate_does_not_implicitly_normalize_empty_in()
    {
        var definition = AllocationParameter("operand");
        var expression = new InExpression(
            new ParameterExpression(definition), Array.Empty<SqlExpression>());

        var slot = Assert.Single(new SqlParameterAllocator().Allocate(expression));
        Assert.Same(definition, slot.Definition);
        Assert.Equal("p0", slot.Placeholder);
    }

    [Fact]
    public void Root_without_parameters_returns_empty_read_only_snapshot()
    {
        var slots = new SqlParameterAllocator().Allocate(BooleanExpression.True);

        Assert.Empty(slots);
        if (slots is ICollection<SqlParameterSlot> collection)
        {
            Assert.True(collection.IsReadOnly);
        }
    }

    [Fact]
    public void Allocate_returns_fresh_read_only_snapshots()
    {
        var allocator = new SqlParameterAllocator();
        var root = AllocationPair(AllocationParameter("first"), AllocationParameter("second"));

        var first = allocator.Allocate(root);
        var second = allocator.Allocate(root);

        Assert.NotSame(first, second);
        Assert.NotSame(first[0], second[0]);
        Assert.Equal(new[] { "p0", "p1" },
            second.Select(slot => slot.Placeholder).ToArray());
        Assert.False(first is List<SqlParameterSlot>);
        Assert.False(first is SqlParameterSlot[]);
        if (first is ICollection<SqlParameterSlot> mutableView)
        {
            Assert.True(mutableView.IsReadOnly);
            Assert.Throws<NotSupportedException>(() => mutableView.Add(first[0]));
        }
        Assert.Equal(2, first.Count);
        Assert.Equal(2, second.Count);
    }

    [Fact]
    public void Allocate_null_root_uses_root_parameter_name()
    {
        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(null!),
            new ArgumentNullException("root"));
    }

    [Fact]
    public void Allocate_unknown_node_is_rejected_exactly()
    {
        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(new UnknownSqlNode()),
            new ArgumentException(
                "SQL AST contains an unknown node subtype.", "root"));
    }

    [Fact]
    public void Allocate_missing_required_child_is_rejected_exactly()
    {
        var malformed = new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.And, BooleanExpression.False);
        SetAutoProperty(malformed, nameof(BinaryExpression.Left), null);

        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(malformed),
            new ArgumentException(
                "SQL AST contains a missing required child.", "root"));
    }

    [Fact]
    public void Allocate_missing_parameter_definition_is_rejected_exactly()
    {
        var malformed = AllocationParameterExpression("missing_definition");
        SetAutoProperty(
            malformed,
            nameof(ParameterExpression.Definition),
            null);

        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(malformed),
            new ArgumentException(
                "SQL AST contains a missing required child.", "root"));
    }

    [Fact]
    public void Allocate_depth_128_is_accepted()
    {
        Assert.Empty(new SqlParameterAllocator().Allocate(UnaryChain(128)));
    }

    [Fact]
    public void Allocate_depth_129_is_rejected_exactly()
    {
        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(UnaryChain(129)),
            new ArgumentOutOfRangeException(
                "root", "SQL AST traversal exceeds maximum depth 128."));
    }

    [Fact]
    public void Allocate_node_occurrence_4096_is_accepted()
    {
        Assert.Empty(new SqlParameterAllocator().Allocate(WideIn(4094)));
    }

    [Fact]
    public void Allocate_node_occurrence_4097_is_rejected_exactly()
    {
        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(WideIn(4095)),
            new ArgumentOutOfRangeException(
                "root",
                "SQL AST traversal exceeds maximum node occurrence count 4096."));
    }

    [Fact]
    public void Allocate_collection_slot_16384_is_accepted()
    {
        var columns = new IndexedSlotList<SqlIdentifier>(
            16383,
            index => AstSamples.Id("C" + index),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var cte = new CommonTableExpression(
            AstSamples.Id("Cte"),
            new SelectStatement(new[]
            {
                new SelectProjection(BooleanExpression.True)
            }),
            new[] { AstSamples.Id("C0") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns), columns);

        Assert.Empty(new SqlParameterAllocator().Allocate(cte));
        Assert.Equal(1, columns.CountReads);
        Assert.Equal(16383, columns.TotalReads);
    }

    [Fact]
    public void Allocate_collection_slot_16385_is_rejected_before_reading_slot()
    {
        var columns = new IndexedSlotList<SqlIdentifier>(
            int.MaxValue,
            index => AstSamples.Id("C" + index),
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var cte = new CommonTableExpression(
            AstSamples.Id("Cte"),
            new SelectStatement(new[]
            {
                new SelectProjection(new UnknownSqlExpression())
            }),
            new[] { AstSamples.Id("C0") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns), columns);

        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(cte),
            new ArgumentOutOfRangeException(
                "root",
                "SQL AST traversal exceeds maximum collection slot inspection count 16384."));
        Assert.False(columns.PoisonIndexWasRead);
        Assert.Equal(1, columns.CountReads);
        Assert.Equal(16384, columns.TotalReads);
        Assert.Equal(16383, columns.HighestReadIndex);
    }

    [Fact]
    public void Allocate_reads_value_node_and_nested_collections_once()
    {
        var first = AllocationParameterExpression("first");
        var second = AllocationParameterExpression("second");
        var row = new SqlInsertRow(new SqlExpression[] { first, second });
        var insert = InsertStatement.Values(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("First"), AstSamples.Id("Second") },
            new[] { row });
        var columns = new IndexedSlotList<SqlIdentifier>(
            2,
            index => AstSamples.Id(index == 0 ? "First" : "Second"),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var rows = new IndexedSlotList<SqlInsertRow>(
            1,
            _ => row,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var values = new IndexedSlotList<SqlExpression>(
            2,
            index => index == 0 ? first : second,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        SetAutoProperty(insert, nameof(InsertStatement.Columns), columns);
        SetAutoProperty(insert, nameof(InsertStatement.Rows), rows);
        SetAutoProperty(row, nameof(SqlInsertRow.Values), values);

        AllocationAssertSlots(insert, "first", "second");
        AllocationAssertReadOnce(columns, expectedSlots: 2);
        AllocationAssertReadOnce(rows, expectedSlots: 1);
        AllocationAssertReadOnce(values, expectedSlots: 2);
    }

    [Fact]
    public void Allocate_reads_case_holder_collection_once_in_canonical_order()
    {
        var first = new CaseWhenClause(
            AllocationParameterExpression("when_1"),
            AllocationParameterExpression("then_1"));
        var second = new CaseWhenClause(
            AllocationParameterExpression("when_2"),
            AllocationParameterExpression("then_2"));
        var expression = new CaseExpression(
            AllocationParameterExpression("input"),
            new[] { first },
            AllocationParameterExpression("else"));
        var clauses = new IndexedSlotList<CaseWhenClause>(
            2,
            index => index == 0 ? first : second,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        SetAutoProperty(expression, nameof(CaseExpression.WhenClauses), clauses);

        AllocationAssertSlots(
            expression, "input", "when_1", "then_1", "when_2", "then_2", "else");
        AllocationAssertReadOnce(clauses, expectedSlots: 2);
    }

    [Theory]
    [MemberData(nameof(AllocationRetainedCollectionPropertyCases))]
    public void Allocate_observes_every_retained_collection_property(
        int caseIndex,
        string caseName)
    {
        Assert.Equal(
            29,
            System.Linq.Enumerable.Count(
                AllocationRetainedCollectionPropertyCases));
        var testCase = AllocationRetainedCollectionCaseAt(caseIndex);
        Assert.Equal(caseName, testCase.Name);

        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(testCase.Root),
            new ArgumentException(
                "SQL AST contains a missing required child.", "root"));

        Assert.Equal(1, testCase.CountReads);
        Assert.Equal(1, testCase.TotalReads);
        Assert.Equal(1, testCase.ReadsAtZero);
    }

    [Fact]
    public void Allocate_null_retained_collection_is_rejected_exactly()
    {
        var root = Assert.Single(
            AstSamples.AllConcreteNodes().OfType<UpsertStatement>());
        SetAutoProperty(
            root,
            nameof(UpsertStatement.ConflictKeys),
            null);

        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(root),
            new ArgumentException(
                "SQL AST contains a missing required child.", "root"));
    }

    [Fact]
    public void Parameter_slot_constructor_surface_is_internal_and_exact()
    {
        var constructor = AllocationSlotConstructor();
        Assert.True(constructor.IsAssembly);
        Assert.Equal(
            new[] { typeof(int), typeof(string), typeof(ParameterDefinition) },
            constructor.GetParameters().Select(parameter => parameter.ParameterType).ToArray());
        Assert.Equal(
            new[] { "ordinal", "placeholder", "definition" },
            constructor.GetParameters().Select(parameter => parameter.Name).ToArray());
    }

    [Fact]
    public void Parameter_slot_constructor_accepts_matching_placeholder()
    {
        var definition = AllocationParameter("value");
        var slot = Assert.IsType<SqlParameterSlot>(
            AllocationSlotConstructor().Invoke(
                new object?[] { 7, "p7", definition }));

        Assert.Equal(7, slot.Ordinal);
        Assert.Equal("p7", slot.Placeholder);
        Assert.Same(definition, slot.Definition);
    }

    [Fact]
    public void Parameter_slot_negative_ordinal_is_rejected()
    {
        AllocationAssertSlotConstructorThrows(
            -1,
            "p0",
            AllocationParameter("value"),
            new ArgumentOutOfRangeException("ordinal"));
    }

    [Fact]
    public void Parameter_slot_null_definition_is_rejected()
    {
        AllocationAssertSlotConstructorThrows(
            0,
            "p0",
            null,
            new ArgumentNullException("definition"));
    }

    [Fact]
    public void Parameter_slot_null_placeholder_is_rejected()
    {
        AllocationAssertSlotConstructorThrows(
            0,
            null,
            AllocationParameter("value"),
            new ArgumentNullException("placeholder"));
    }

    [Theory]
    [InlineData(0, "")]
    [InlineData(0, "p1")]
    [InlineData(0, "P0")]
    [InlineData(0, "@p0")]
    [InlineData(0, "p00")]
    public void Parameter_slot_placeholder_must_match_ordinal(
        int ordinal,
        string placeholder)
    {
        AllocationAssertSlotConstructorThrows(
            ordinal,
            placeholder,
            AllocationParameter("value"),
            new ArgumentException(
                "Parameter slot placeholder must match its ordinal.",
                "placeholder"),
            exactMessage: true);
    }

    [Fact]
    public void Parameter_slot_is_immutable_and_contains_no_runtime_value()
    {
        var type = typeof(SqlParameterSlot);
        Assert.True(type.IsSealed);
        Assert.Empty(type.GetConstructors(BindingFlags.Instance | BindingFlags.Public));

        var properties = type.GetProperties(
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.Equal(
            new[] { "Definition", "Ordinal", "Placeholder" },
            properties.Select(property => property.Name).OrderBy(name => name).ToArray());
        Assert.All(properties, property => Assert.Null(property.SetMethod));
        Assert.Equal(typeof(ParameterDefinition),
            properties.Single(property => property.Name == "Definition").PropertyType);
        Assert.Equal(typeof(int),
            properties.Single(property => property.Name == "Ordinal").PropertyType);
        Assert.Equal(typeof(string),
            properties.Single(property => property.Name == "Placeholder").PropertyType);

        var fields = type.GetFields(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        Assert.Equal(3, fields.Length);
        Assert.All(fields, field => Assert.True(field.IsInitOnly));
        Assert.DoesNotContain(fields, field =>
            field.FieldType == typeof(object) ||
            field.FieldType == typeof(ParameterBag) ||
            field.FieldType == typeof(BoundParameter));
        Assert.DoesNotContain(type.GetMembers(
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly),
            member => string.Equals(member.Name, "Value", StringComparison.Ordinal));
    }

    private static IReadOnlyList<SqlParameterSlot> AllocationAssertSlots(
        SqlNode root,
        params string[] expectedNames)
    {
        var slots = new SqlParameterAllocator().Allocate(root);
        Assert.Equal(expectedNames,
            slots.Select(slot => slot.Definition.Name).ToArray());
        Assert.Equal(Enumerable.Range(0, expectedNames.Length),
            slots.Select(slot => slot.Ordinal));
        Assert.Equal(
            Enumerable.Range(0, expectedNames.Length)
                .Select(ordinal => "p" + ordinal),
            slots.Select(slot => slot.Placeholder));
        return slots;
    }

    private static AllocationRetainedCollectionCase
        AllocationRetainedCollectionCaseAt(int caseIndex)
    {
        switch (caseIndex)
        {
            case 0:
                return AllocationRetainedCollectionCaseFor<
                    InExpression, SqlExpression>(
                    "InExpression.Values", nameof(InExpression.Values));
            case 1:
                return AllocationRetainedCollectionCaseFor<
                    CaseExpression, CaseWhenClause>(
                    "CaseExpression.WhenClauses",
                    nameof(CaseExpression.WhenClauses));
            case 2:
                return AllocationRetainedCollectionCaseFor<
                    FunctionExpression, SqlExpression>(
                    "FunctionExpression.Arguments",
                    nameof(FunctionExpression.Arguments));
            case 3:
                return AllocationRetainedCollectionCaseFor<
                    KeysetPageSpec, SqlExpression>(
                    "KeysetPageSpec.Boundaries",
                    nameof(KeysetPageSpec.Boundaries));
            case 4:
                return AllocationRetainedCollectionCaseFor<
                    CommonTableExpression, SqlIdentifier>(
                    "CommonTableExpression.Columns",
                    nameof(CommonTableExpression.Columns));
            case 5:
                return AllocationRetainedCollectionCaseFor<
                    SelectStatement, SelectProjection>(
                    "SelectStatement.Projections",
                    nameof(SelectStatement.Projections));
            case 6:
                return AllocationRetainedCollectionCaseFor<
                    SelectStatement, SqlExpression>(
                    "SelectStatement.GroupBy",
                    nameof(SelectStatement.GroupBy));
            case 7:
                return AllocationRetainedCollectionCaseFor<
                    SelectStatement, OrderByExpression>(
                    "SelectStatement.OrderBy",
                    nameof(SelectStatement.OrderBy));
            case 8:
                return AllocationRetainedCollectionCaseFor<
                    SelectStatement, CommonTableExpression>(
                    "SelectStatement.CommonTableExpressions",
                    nameof(SelectStatement.CommonTableExpressions));
            case 9:
                return AllocationRetainedCollectionCaseFor<
                    SelectStatement, SetOperationClause>(
                    "SelectStatement.SetOperations",
                    nameof(SelectStatement.SetOperations));
            case 10:
                return AllocationRetainedCollectionCaseFor<
                    SqlInsertRow, SqlExpression>(
                    "SqlInsertRow.Values", nameof(SqlInsertRow.Values));
            case 11:
                return AllocationRetainedCollectionCaseFor<
                    ReturningClause, SelectProjection>(
                    "ReturningClause.Projections",
                    nameof(ReturningClause.Projections));
            case 12:
                return AllocationRetainedCollectionCaseFor<
                    InsertStatement, SqlIdentifier>(
                    "InsertStatement.Columns",
                    nameof(InsertStatement.Columns));
            case 13:
                return AllocationRetainedCollectionCaseFor<
                    InsertStatement, SqlInsertRow>(
                    "InsertStatement.Rows", nameof(InsertStatement.Rows));
            case 14:
                return AllocationRetainedCollectionCaseFor<
                    UpdateStatement, SqlAssignment>(
                    "UpdateStatement.Assignments",
                    nameof(UpdateStatement.Assignments));
            case 15:
                return AllocationRetainedCollectionCaseFor<
                    UpsertStatement, SqlIdentifier>(
                    "UpsertStatement.ConflictKeys",
                    nameof(UpsertStatement.ConflictKeys));
            case 16:
                return AllocationRetainedCollectionCaseFor<
                    UpsertStatement, SqlAssignment>(
                    "UpsertStatement.InsertAssignments",
                    nameof(UpsertStatement.InsertAssignments));
            case 17:
                return AllocationRetainedCollectionCaseFor<
                    UpsertStatement, SqlAssignment>(
                    "UpsertStatement.UpdateAssignments",
                    nameof(UpsertStatement.UpdateAssignments));
            case 18:
                return AllocationRetainedCollectionCaseFor<
                    BulkInsertOperation, SqlIdentifier>(
                    "BulkInsertOperation.Columns",
                    nameof(BulkInsertOperation.Columns));
            case 19:
                return AllocationRetainedCollectionCaseFor<
                    BulkInsertOperation, SqlInsertRow>(
                    "BulkInsertOperation.Rows",
                    nameof(BulkInsertOperation.Rows));
            case 20:
                return AllocationRetainedCollectionCaseFor<
                    IndexDefinition, IndexColumnDefinition>(
                    "IndexDefinition.Columns",
                    nameof(IndexDefinition.Columns));
            case 21:
                return AllocationRetainedCollectionCaseFor<
                    PrimaryKeyDefinition, SqlIdentifier>(
                    "PrimaryKeyDefinition.Columns",
                    nameof(PrimaryKeyDefinition.Columns));
            case 22:
                return AllocationRetainedCollectionCaseFor<
                    UniqueConstraintDefinition, SqlIdentifier>(
                    "UniqueConstraintDefinition.Columns",
                    nameof(UniqueConstraintDefinition.Columns));
            case 23:
                return AllocationRetainedCollectionCaseFor<
                    ForeignKeyColumnSet, SqlIdentifier>(
                    "ForeignKeyColumnSet.LocalColumns",
                    nameof(ForeignKeyColumnSet.LocalColumns));
            case 24:
                return AllocationRetainedCollectionCaseFor<
                    ForeignKeyColumnSet, SqlIdentifier>(
                    "ForeignKeyColumnSet.ReferencedColumns",
                    nameof(ForeignKeyColumnSet.ReferencedColumns));
            case 25:
                return AllocationRetainedCollectionCaseFor<
                    TableDefinition, ColumnDefinition>(
                    "TableDefinition.Columns",
                    nameof(TableDefinition.Columns));
            case 26:
                return AllocationRetainedCollectionCaseFor<
                    TableDefinition, ConstraintDefinition>(
                    "TableDefinition.Constraints",
                    nameof(TableDefinition.Constraints));
            case 27:
                return AllocationRetainedCollectionCaseFor<
                    TableDefinition, IndexDefinition>(
                    "TableDefinition.Indexes",
                    nameof(TableDefinition.Indexes));
            case 28:
                return AllocationRetainedCollectionCaseFor<
                    MigrationPlan, MigrationStep>(
                    "MigrationPlan.Steps", nameof(MigrationPlan.Steps));
            default:
                throw new ArgumentOutOfRangeException(nameof(caseIndex));
        }
    }

    private static AllocationRetainedCollectionCase
        AllocationRetainedCollectionCaseFor<TNode, TItem>(
            string name,
            string propertyName)
        where TNode : SqlNode
        where TItem : class
    {
        var root = Assert.Single(
            AstSamples.AllConcreteNodes().OfType<TNode>());
        return new AllocationRetainedCollectionCase<TItem>(
            name, root, propertyName);
    }

    private static void AllocationAssertConflict(
        ParameterDefinition first,
        ParameterDefinition second)
    {
        AllocationAssertExact(
            () => new SqlParameterAllocator().Allocate(AllocationPair(first, second)),
            new ArgumentException(
                "A logical parameter name has conflicting definitions.", "root"));
    }

    private static T AllocationAssertExact<T>(Action action, T expected)
        where T : ArgumentException
    {
        var actual = Assert.Throws<T>(action);
        Assert.Equal(expected.ParamName, actual.ParamName);
        Assert.Equal(expected.Message, actual.Message);
        return actual;
    }

    private static void AllocationAssertSlotConstructorThrows<T>(
        int ordinal,
        string? placeholder,
        ParameterDefinition? definition,
        T expected,
        bool exactMessage = false)
        where T : ArgumentException
    {
        var invocation = Assert.Throws<TargetInvocationException>(() =>
            AllocationSlotConstructor().Invoke(
                new object?[] { ordinal, placeholder, definition }));
        var actual = Assert.IsType<T>(invocation.InnerException);
        Assert.Equal(expected.ParamName, actual.ParamName);
        if (exactMessage)
        {
            Assert.Equal(expected.Message, actual.Message);
        }
    }

    private static ConstructorInfo AllocationSlotConstructor() =>
        Assert.Single(typeof(SqlParameterSlot).GetConstructors(
            BindingFlags.Instance | BindingFlags.NonPublic));

    private static void AllocationAssertReadOnce<T>(
        IndexedSlotList<T> collection,
        int expectedSlots)
        where T : class
    {
        Assert.Equal(1, collection.CountReads);
        Assert.Equal(expectedSlots, collection.TotalReads);
        for (var index = 0; index < expectedSlots; index++)
        {
            Assert.Equal(1, collection.ReadsAt(index));
        }
    }

    private static ParameterDefinition AllocationParameter(
        string name,
        SqlTypeDescriptor? type = null,
        ParameterDirection direction = ParameterDirection.Input,
        bool isNullable = true) =>
        new(
            name,
            type ?? new SqlTypeDescriptor(LogicalDbType.Int32),
            direction,
            isNullable);

    private static ParameterExpression AllocationParameterExpression(string name) =>
        new(AllocationParameter(name));

    private static FunctionExpression AllocationPair(
        ParameterDefinition first,
        ParameterDefinition second) =>
        new(
            SemanticFunctions.Coalesce,
            new SqlExpression[]
            {
                new ParameterExpression(first),
                new ParameterExpression(second)
            });

    private static SelectStatement AllocationSelect(string parameterName) =>
        new(new[]
        {
            new SelectProjection(AllocationParameterExpression(parameterName))
        });

    private static ReturningClause AllocationReturning(string parameterName) =>
        new(new[]
        {
            new SelectProjection(AllocationParameterExpression(parameterName))
        });

    private static ColumnDefinition AllocationComputedColumn(
        string columnName,
        string parameterName) =>
        new(
            AstSamples.Id(columnName),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            generation: new ComputedGenerationDefinition(
                AllocationParameterExpression(parameterName),
                ComputedStorageKind.Virtual));

    private abstract class AllocationRetainedCollectionCase
    {
        protected AllocationRetainedCollectionCase(
            string name,
            SqlNode root)
        {
            Name = name;
            Root = root;
        }

        internal string Name { get; }

        internal SqlNode Root { get; }

        internal abstract int CountReads { get; }

        internal abstract int TotalReads { get; }

        internal abstract int ReadsAtZero { get; }
    }

    private sealed class AllocationRetainedCollectionCase<TItem> :
        AllocationRetainedCollectionCase
        where TItem : class
    {
        private readonly IndexedSlotList<TItem> _items;

        internal AllocationRetainedCollectionCase(
            string name,
            SqlNode root,
            string propertyName)
            : base(name, root)
        {
            _items = new IndexedSlotList<TItem>(
                1,
                _ => null!,
                throwOnSecondRead: true,
                throwOnSecondCountRead: true);
            SetAutoProperty(root, propertyName, _items);
        }

        internal override int CountReads => _items.CountReads;

        internal override int TotalReads => _items.TotalReads;

        internal override int ReadsAtZero => _items.ReadsAt(0);
    }
}
