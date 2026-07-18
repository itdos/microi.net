using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.SqlServer
{
    internal sealed class SqlServerSchemaCompiler
    {
        internal RenderedSql Render(
            SchemaOperation operation,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (operation == null)
            {
                throw new ArgumentNullException(nameof(operation));
            }
            if (slots == null)
            {
                throw new ArgumentNullException(nameof(slots));
            }
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }

            var writer = SqlServerCompiler.NewWriter();
            WriteOperation(operation, writer, slots, context);
            return RenderedSql.ForCommands(new[]
            {
                SqlServerCompiler.CreateCommand(
                    writer.Snapshot(),
                    SqlResultShape.None,
                    PlanResultRole.None,
                    context.Capabilities.DdlTransactionBehavior,
                    context)
            });
        }

        private static void WriteOperation(
            SchemaOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (operation is CreateSchemaOperation)
            {
                WriteCreateSchema(
                    (CreateSchemaOperation)operation, writer, context);
                return;
            }
            if (operation is DropSchemaOperation)
            {
                WriteDropSchema(
                    (DropSchemaOperation)operation, writer, context);
                return;
            }
            if (operation is CreateTableOperation)
            {
                WriteCreateTable(
                    (CreateTableOperation)operation,
                    writer,
                    slots,
                    context);
                return;
            }
            if (operation is DropTableOperation)
            {
                WriteDropTable(
                    (DropTableOperation)operation, writer, context);
                return;
            }
            if (operation is AddColumnOperation)
            {
                WriteAddColumn(
                    (AddColumnOperation)operation,
                    writer,
                    slots,
                    context);
                return;
            }
            if (operation is AlterColumnOperation)
            {
                WriteAlterColumn(
                    (AlterColumnOperation)operation,
                    writer,
                    slots,
                    context);
                return;
            }
            if (operation is DropColumnOperation)
            {
                WriteDropColumn(
                    (DropColumnOperation)operation, writer);
                return;
            }
            if (operation is AddConstraintOperation)
            {
                WriteAddConstraint(
                    (AddConstraintOperation)operation,
                    writer,
                    slots,
                    context);
                return;
            }
            if (operation is DropConstraintOperation)
            {
                WriteDropConstraint(
                    (DropConstraintOperation)operation, writer);
                return;
            }
            if (operation is CreateIndexOperation)
            {
                WriteCreateIndex(
                    (CreateIndexOperation)operation, writer, context);
                return;
            }
            if (operation is DropIndexOperation)
            {
                WriteDropIndex(
                    (DropIndexOperation)operation, writer);
                return;
            }
            if (operation is CreateSequenceOperation
                || operation is AlterSequenceOperation
                || operation is DropSequenceOperation)
            {
                throw Unsupported(context, "sqlserver.sequence", "$");
            }
            if (operation is RenameTableOperation
                || operation is RenameColumnOperation)
            {
                throw Unsupported(context, "sqlserver.rename", "$");
            }
            if (operation is SetTableCommentOperation
                || operation is RemoveTableCommentOperation
                || operation is SetColumnCommentOperation
                || operation is RemoveColumnCommentOperation)
            {
                throw Unsupported(context, "sqlserver.comment", "$");
            }
            throw Unsupported(
                context, "sqlserver.schema_operation", "$");
        }

        private static void WriteCreateSchema(
            CreateSchemaOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Behavior
                == CreateObjectBehavior.AlreadySatisfiedIfExists)
            {
                throw Unsupported(
                    context,
                    "sqlserver.create_schema_if_missing",
                    "$");
            }
            if (operation.Schema.Catalog != null)
            {
                throw Unsupported(
                    context,
                    "sqlserver.cross_catalog_schema_ddl",
                    "$");
            }
            writer.AppendKeyword(SqlKeyword.Create);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Schema);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Schema.Name.Value);
        }

        private static void WriteDropSchema(
            DropSchemaOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Scope == DropScope.Cascade)
            {
                throw Unsupported(
                    context, "sqlserver.drop_schema_cascade", "$");
            }
            if (operation.Schema.Catalog != null)
            {
                throw Unsupported(
                    context,
                    "sqlserver.cross_catalog_schema_ddl",
                    "$");
            }
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Schema);
            writer.AppendSpace();
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                writer.AppendKeyword(SqlKeyword.If);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
            }
            writer.AppendIdentifierSegment(operation.Schema.Name.Value);
        }

        private static void WriteCreateTable(
            CreateTableOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (operation.Behavior
                == CreateObjectBehavior.AlreadySatisfiedIfExists)
            {
                throw Unsupported(
                    context,
                    "sqlserver.create_table_if_missing",
                    "$");
            }
            writer.AppendKeyword(SqlKeyword.Create);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            writer.AppendSpace();
            SqlServerCompiler.WriteObjectName(
                operation.Table.Name, writer);
            writer.AppendSpace();
            writer.AppendOpenParenthesis();
            for (var index = 0;
                 index < operation.Table.Columns.Count;
                 index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                WriteColumn(
                    operation.Table.Columns[index],
                    writer,
                    slots,
                    context,
                    includeDefault: true,
                    includeGeneration: true);
            }
            for (var index = 0;
                 index < operation.Table.Constraints.Count;
                 index++)
            {
                writer.AppendComma();
                WriteConstraint(
                    operation.Table.Constraints[index],
                    writer,
                    slots,
                    context);
            }
            for (var index = 0;
                 index < operation.Table.Indexes.Count;
                 index++)
            {
                throw Unsupported(
                    context,
                    "sqlserver.inline_index",
                    "$.Table.Indexes");
            }
            writer.AppendCloseParenthesis();
            if (operation.Table.Comment != null)
            {
                throw Unsupported(
                    context,
                    "sqlserver.inline_table_comment",
                    "$.Table.Comment");
            }
        }

        private static void WriteDropTable(
            DropTableOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Scope == DropScope.Cascade)
            {
                throw Unsupported(
                    context, "sqlserver.drop_table_cascade", "$");
            }
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            writer.AppendSpace();
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                writer.AppendKeyword(SqlKeyword.If);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
            }
            SqlServerCompiler.WriteObjectName(operation.Table, writer);
        }

        private static void WriteAddColumn(
            AddColumnOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            WriteAlterTable(operation.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Add);
            writer.AppendSpace();
            WriteColumn(
                operation.Column,
                writer,
                slots,
                context,
                includeDefault: true,
                includeGeneration: true);
        }

        private static void WriteAlterColumn(
            AlterColumnOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (!Equals(
                    operation.Before.Generation,
                    operation.After.Generation)
                || !Equals(
                    operation.Before.DefaultValue,
                    operation.After.DefaultValue))
            {
                throw Unsupported(
                    context,
                    "sqlserver.alter_column_default_generation",
                    "$");
            }
            WriteAlterTable(operation.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Alter);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            WriteColumn(
                operation.After,
                writer,
                slots,
                context,
                includeDefault: false,
                includeGeneration: false);
        }

        private static void WriteDropColumn(
            DropColumnOperation operation,
            SqlTextWriter writer)
        {
            WriteAlterTable(operation.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                writer.AppendKeyword(SqlKeyword.If);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
            }
            writer.AppendIdentifierSegment(operation.Column.Value);
        }

        private static void WriteAddConstraint(
            AddConstraintOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            WriteAlterTable(operation.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Add);
            writer.AppendSpace();
            WriteConstraint(
                operation.Constraint, writer, slots, context);
        }

        private static void WriteDropConstraint(
            DropConstraintOperation operation,
            SqlTextWriter writer)
        {
            WriteAlterTable(operation.Table, writer);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Constraint);
            writer.AppendSpace();
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                writer.AppendKeyword(SqlKeyword.If);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
            }
            writer.AppendIdentifierSegment(operation.Constraint.Value);
        }

        private static void WriteCreateIndex(
            CreateIndexOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Behavior
                == CreateObjectBehavior.AlreadySatisfiedIfExists)
            {
                throw Unsupported(
                    context,
                    "sqlserver.create_index_if_missing",
                    "$");
            }
            writer.AppendKeyword(SqlKeyword.Create);
            writer.AppendSpace();
            if (operation.Index.Uniqueness == IndexUniqueness.Unique)
            {
                writer.AppendKeyword(SqlKeyword.Unique);
                writer.AppendSpace();
            }
            writer.AppendKeyword(SqlKeyword.Index);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Index.Name.Value);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            SqlServerCompiler.WriteObjectName(operation.Table, writer);
            writer.AppendSpace();
            WriteIndexColumns(operation.Index.Columns, writer);
        }

        private static void WriteDropIndex(
            DropIndexOperation operation,
            SqlTextWriter writer)
        {
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Index);
            writer.AppendSpace();
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                writer.AppendKeyword(SqlKeyword.If);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Exists);
                writer.AppendSpace();
            }
            writer.AppendIdentifierSegment(operation.Index.Value);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            SqlServerCompiler.WriteObjectName(operation.Table, writer);
        }

        private static void WriteColumn(
            ColumnDefinition column,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context,
            bool includeDefault,
            bool includeGeneration)
        {
            if (column.Comment != null)
            {
                throw Unsupported(
                    context, "sqlserver.inline_column_comment", "$");
            }
            writer.AppendIdentifierSegment(column.Name.Value);
            writer.AppendSpace();
            new SqlServerTypeMapper().Write(
                column.Type, writer, context);
            if (column.Generation != null)
            {
                if (!includeGeneration)
                {
                    throw Unsupported(
                        context,
                        "sqlserver.alter_generated_column",
                        "$");
                }
                WriteGeneration(column, writer, slots, context);
            }
            writer.AppendSpace();
            if (column.Nullability == ColumnNullability.NotNullable)
            {
                writer.AppendKeyword(SqlKeyword.Not);
                writer.AppendSpace();
            }
            writer.AppendKeyword(SqlKeyword.Null);
            if (column.DefaultValue != null)
            {
                if (!includeDefault)
                {
                    throw Unsupported(
                        context,
                        "sqlserver.alter_column_default",
                        "$");
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Default);
                writer.AppendSpace();
                WriteDefault(
                    column.Type,
                    column.DefaultValue,
                    writer,
                    context);
            }
        }

        private static void WriteGeneration(
            ColumnDefinition column,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            var identity = column.Generation
                as IdentityGenerationDefinition;
            if (identity != null)
            {
                if (identity.Seed < 0
                    || identity.Seed > int.MaxValue
                    || identity.Increment <= 0
                    || identity.Increment > int.MaxValue)
                {
                    throw Unsupported(
                        context,
                        "sqlserver.identity_structural_number",
                        "$");
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Identity);
                writer.AppendOpenParenthesis();
                writer.AppendStructuralInt((int)identity.Seed);
                writer.AppendComma();
                writer.AppendStructuralInt((int)identity.Increment);
                writer.AppendCloseParenthesis();
                return;
            }
            if (column.Generation is SequenceGenerationDefinition)
            {
                throw Unsupported(
                    context,
                    "sqlserver.sequence_column_generation",
                    "$");
            }
            if (column.Generation is ComputedGenerationDefinition)
            {
                throw Unsupported(
                    context, "sqlserver.computed_column", "$");
            }
            throw Unsupported(
                context, "sqlserver.column_generation", "$");
        }

        private static void WriteDefault(
            SqlTypeDescriptor type,
            ColumnDefaultDefinition value,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (value is NullDefaultDefinition)
            {
                writer.AppendKeyword(SqlKeyword.Null);
                return;
            }
            var boolean = value as BooleanDefaultDefinition;
            if (boolean != null)
            {
                writer.AppendStructuralInt(boolean.Value ? 1 : 0);
                return;
            }
            var integer = value as Int64DefaultDefinition;
            if (integer != null)
            {
                WriteStructuralInt64(
                    integer.Value, writer, context,
                    "sqlserver.int64_default");
                return;
            }
            var decimalValue = value as DecimalDefaultDefinition;
            if (decimalValue != null)
            {
                if (decimal.Truncate(decimalValue.Value)
                        != decimalValue.Value
                    || decimalValue.Value < int.MinValue
                    || decimalValue.Value > int.MaxValue)
                {
                    throw Unsupported(
                        context, "sqlserver.decimal_default", "$");
                }
                WriteStructuralInt64(
                    decimal.ToInt64(decimalValue.Value),
                    writer,
                    context,
                    "sqlserver.decimal_default");
                return;
            }
            var text = value as StringDefaultDefinition;
            if (text != null)
            {
                writer.AppendEscapedSchemaLiteral(
                    new SqlSchemaLiteral(text.Value));
                return;
            }
            var guid = value as GuidDefaultDefinition;
            if (guid != null)
            {
                writer.AppendEscapedSchemaLiteral(new SqlSchemaLiteral(
                    guid.Value.ToString("D", CultureInfo.InvariantCulture)));
                return;
            }
            var dateTime = value as DateTimeDefaultDefinition;
            if (dateTime != null)
            {
                if (dateTime.Value.Kind != DateTimeKind.Unspecified)
                {
                    throw Unsupported(
                        context, "sqlserver.datetime_default_kind", "$");
                }
                var format = type.LogicalType == LogicalDbType.Date
                    ? "yyyy-MM-dd"
                    : "yyyy-MM-ddTHH:mm:ss.fffffff";
                if (type.LogicalType == LogicalDbType.Date
                    && dateTime.Value.TimeOfDay != TimeSpan.Zero)
                {
                    throw Unsupported(
                        context, "sqlserver.date_default_time", "$");
                }
                writer.AppendEscapedSchemaLiteral(new SqlSchemaLiteral(
                    dateTime.Value.ToString(
                        format, CultureInfo.InvariantCulture)));
                return;
            }
            var offset = value as DateTimeOffsetDefaultDefinition;
            if (offset != null)
            {
                writer.AppendEscapedSchemaLiteral(new SqlSchemaLiteral(
                    offset.Value.ToString(
                        "yyyy-MM-ddTHH:mm:ss.fffffffzzz",
                        CultureInfo.InvariantCulture)));
                return;
            }
            var semantic = value as SemanticDefaultDefinition;
            if (semantic != null
                && semantic.Kind == SemanticDefaultKind.CurrentDateTime)
            {
                writer.AppendKeyword(SqlKeyword.SysDateTime);
                writer.AppendOpenParenthesis();
                writer.AppendCloseParenthesis();
                return;
            }
            throw Unsupported(
                context, "sqlserver.semantic_default", "$");
        }

        private static void WriteStructuralInt64(
            long value,
            SqlTextWriter writer,
            SqlLoweringContext context,
            string feature)
        {
            if (value < int.MinValue || value > int.MaxValue)
            {
                throw Unsupported(context, feature, "$");
            }
            if (value < 0)
            {
                writer.AppendOpenParenthesis();
                writer.AppendStructuralInt(0);
                writer.AppendSpace();
                writer.AppendOperator(SqlOperatorToken.Subtract);
                writer.AppendSpace();
                writer.AppendStructuralInt(checked((int)-value));
                writer.AppendCloseParenthesis();
                return;
            }
            writer.AppendStructuralInt((int)value);
        }

        private static void WriteConstraint(
            ConstraintDefinition constraint,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Constraint);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(constraint.Name.Value);
            writer.AppendSpace();
            var primary = constraint as PrimaryKeyDefinition;
            if (primary != null)
            {
                writer.AppendKeyword(SqlKeyword.Primary);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Key);
                writer.AppendSpace();
                WriteIdentifierList(primary.Columns, writer);
                return;
            }
            var unique = constraint as UniqueConstraintDefinition;
            if (unique != null)
            {
                writer.AppendKeyword(SqlKeyword.Unique);
                writer.AppendSpace();
                WriteIdentifierList(unique.Columns, writer);
                return;
            }
            var foreign = constraint as ForeignKeyDefinition;
            if (foreign != null)
            {
                writer.AppendKeyword(SqlKeyword.Foreign);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Key);
                writer.AppendSpace();
                WriteIdentifierList(
                    foreign.Columns.LocalColumns, writer);
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.References);
                writer.AppendSpace();
                SqlServerCompiler.WriteObjectName(
                    foreign.ReferencedTable, writer);
                writer.AppendSpace();
                WriteIdentifierList(
                    foreign.Columns.ReferencedColumns, writer);
                WriteReferentialAction(
                    SqlKeyword.Update,
                    foreign.Actions.OnUpdate,
                    writer,
                    context);
                WriteReferentialAction(
                    SqlKeyword.Delete,
                    foreign.Actions.OnDelete,
                    writer,
                    context);
                return;
            }
            throw Unsupported(
                context, "sqlserver.constraint", "$");
        }

        private static void WriteReferentialAction(
            SqlKeyword operation,
            ReferentialAction action,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (action == ReferentialAction.Restrict)
            {
                throw Unsupported(
                    context,
                    "sqlserver.referential_restrict",
                    "$");
            }
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            writer.AppendKeyword(operation);
            writer.AppendSpace();
            switch (action)
            {
                case ReferentialAction.NoAction:
                    writer.AppendKeyword(SqlKeyword.NoAction);
                    return;
                case ReferentialAction.Cascade:
                    writer.AppendKeyword(SqlKeyword.Cascade);
                    return;
                case ReferentialAction.SetNull:
                    writer.AppendKeyword(SqlKeyword.Set);
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.Null);
                    return;
                case ReferentialAction.SetDefault:
                    writer.AppendKeyword(SqlKeyword.Set);
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.Default);
                    return;
                default:
                    throw Unsupported(
                        context, "sqlserver.referential_action", "$");
            }
        }

        private static void WriteIndexColumns(
            IReadOnlyList<IndexColumnDefinition> columns,
            SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            for (var index = 0; index < columns.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(
                    columns[index].Column.Value);
                writer.AppendSpace();
                writer.AppendKeyword(
                    columns[index].Direction
                        == SqlSortDirection.Ascending
                        ? SqlKeyword.Asc
                        : SqlKeyword.Desc);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteIdentifierList(
            IReadOnlyList<SqlIdentifier> identifiers,
            SqlTextWriter writer)
        {
            writer.AppendOpenParenthesis();
            for (var index = 0; index < identifiers.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(identifiers[index].Value);
            }
            writer.AppendCloseParenthesis();
        }

        private static void WriteAlterTable(
            SqlObjectName table,
            SqlTextWriter writer)
        {
            writer.AppendKeyword(SqlKeyword.Alter);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            writer.AppendSpace();
            SqlServerCompiler.WriteObjectName(table, writer);
        }

        private static UnsupportedDatabaseCapabilityException Unsupported(
            SqlLoweringContext context,
            string feature,
            string path)
        {
            return new UnsupportedDatabaseCapabilityException(
                context.DialectProfile, feature, path);
        }
    }
}
