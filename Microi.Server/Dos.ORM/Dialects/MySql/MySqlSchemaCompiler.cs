using System;
using System.Collections.Generic;
using System.Globalization;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.MySql
{
    internal sealed class MySqlSchemaCompiler
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
            var writer = MySqlCompiler.NewWriter();
            WriteOperation(operation, writer, slots, context);
            return RenderedSql.ForCommands(new[]
            {
                MySqlCompiler.CreateCommand(
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
                WriteCreateSchema((CreateSchemaOperation)operation,
                    writer, context);
                return;
            }
            if (operation is DropSchemaOperation)
            {
                WriteDropSchema((DropSchemaOperation)operation,
                    writer, context);
                return;
            }
            if (operation is CreateTableOperation)
            {
                WriteCreateTable((CreateTableOperation)operation,
                    writer, slots, context);
                return;
            }
            if (operation is RenameTableOperation)
            {
                WriteRenameTable((RenameTableOperation)operation,
                    writer, context);
                return;
            }
            if (operation is DropTableOperation)
            {
                WriteDropTable((DropTableOperation)operation,
                    writer, context);
                return;
            }
            if (operation is AddColumnOperation)
            {
                WriteAddColumn((AddColumnOperation)operation,
                    writer, slots, context);
                return;
            }
            if (operation is AlterColumnOperation)
            {
                WriteAlterColumn((AlterColumnOperation)operation,
                    writer, slots, context);
                return;
            }
            if (operation is RenameColumnOperation)
            {
                WriteRenameColumn((RenameColumnOperation)operation,
                    writer, context);
                return;
            }
            if (operation is DropColumnOperation)
            {
                WriteDropColumn((DropColumnOperation)operation,
                    writer, context);
                return;
            }
            if (operation is AddConstraintOperation)
            {
                WriteAddConstraint((AddConstraintOperation)operation,
                    writer, context);
                return;
            }
            if (operation is CreateIndexOperation)
            {
                WriteCreateIndex((CreateIndexOperation)operation,
                    writer, context);
                return;
            }
            if (operation is DropIndexOperation)
            {
                WriteDropIndex((DropIndexOperation)operation,
                    writer, context);
                return;
            }
            if (operation is SetTableCommentOperation)
            {
                WriteTableComment(
                    ((SetTableCommentOperation)operation).Table,
                    ((SetTableCommentOperation)operation).Comment.Text,
                    writer,
                    context);
                return;
            }
            if (operation is RemoveTableCommentOperation)
            {
                WriteTableComment(
                    ((RemoveTableCommentOperation)operation).Table,
                    string.Empty,
                    writer,
                    context);
                return;
            }
            if (operation is CreateSequenceOperation
                || operation is AlterSequenceOperation
                || operation is DropSequenceOperation)
            {
                throw Unsupported(context, "mysql.sequence", "$");
            }
            if (operation is DropConstraintOperation)
            {
                throw Unsupported(
                    context, "mysql.drop_constraint_kind", "$");
            }
            if (operation is SetColumnCommentOperation
                || operation is RemoveColumnCommentOperation)
            {
                throw Unsupported(
                    context, "mysql.column_comment_requires_definition", "$");
            }
            throw Unsupported(context, "mysql.schema_operation", "$");
        }

        private static void WriteCreateSchema(
            CreateSchemaOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Schema.Catalog != null)
            {
                throw Unsupported(context, "mysql.catalog", "$");
            }
            writer.AppendKeyword(SqlKeyword.Create);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Database);
            if (operation.Behavior
                == CreateObjectBehavior.AlreadySatisfiedIfExists)
            {
                WriteIfNotExists(writer);
            }
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Schema.Name.Value);
        }

        private static void WriteDropSchema(
            DropSchemaOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Schema.Catalog != null)
            {
                throw Unsupported(context, "mysql.catalog", "$");
            }
            if (operation.Scope == DropScope.Restrict)
            {
                throw Unsupported(
                    context, "mysql.drop_schema_restrict", "$");
            }
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Database);
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                WriteIfExists(writer);
            }
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Schema.Name.Value);
        }

        private static void WriteCreateTable(
            CreateTableOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            ValidateAutoIncrementKeys(operation.Table, context);
            writer.AppendKeyword(SqlKeyword.Create);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            if (operation.Behavior
                == CreateObjectBehavior.AlreadySatisfiedIfExists)
            {
                WriteIfNotExists(writer);
            }
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(
                operation.Table.Name, writer, context);
            writer.AppendOpenParenthesis();
            var needsComma = false;
            for (var index = 0;
                 index < operation.Table.Columns.Count;
                 index++)
            {
                WriteSeparator(writer, ref needsComma);
                WriteColumn(
                    operation.Table.Columns[index], writer, slots, context);
            }
            for (var index = 0;
                 index < operation.Table.Constraints.Count;
                 index++)
            {
                WriteSeparator(writer, ref needsComma);
                WriteConstraint(
                    operation.Table.Constraints[index], writer, context);
            }
            for (var index = 0;
                 index < operation.Table.Indexes.Count;
                 index++)
            {
                WriteSeparator(writer, ref needsComma);
                WriteInlineIndex(
                    operation.Table.Indexes[index], writer, context);
            }
            writer.AppendCloseParenthesis();
            if (operation.Table.Comment != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Comment);
                writer.AppendSpace();
                writer.AppendOperator(SqlOperatorToken.Equal);
                writer.AppendSpace();
                writer.AppendEscapedSchemaLiteral(
                    new SqlSchemaLiteral(operation.Table.Comment.Text));
            }
        }

        private static void WriteRenameTable(
            RenameTableOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Rename);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(
                operation.Source, writer, context);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.To);
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(
                operation.Target, writer, context);
        }

        private static void WriteDropTable(
            DropTableOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Scope == DropScope.Cascade)
            {
                throw Unsupported(
                    context, "mysql.drop_table_cascade", "$");
            }
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                WriteIfExists(writer);
            }
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(operation.Table, writer, context);
            writer.AppendSpace();
            writer.AppendKeyword(
                operation.Scope == DropScope.Cascade
                    ? SqlKeyword.Cascade
                    : SqlKeyword.Restrict);
        }

        private static void WriteAddColumn(
            AddColumnOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (operation.Column.Generation
                is IdentityGenerationDefinition)
            {
                throw Unsupported(
                    context, "mysql.add_identity_column", "$");
            }
            WriteAlterTablePrefix(operation.Table, writer, context);
            writer.AppendKeyword(SqlKeyword.Add);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            WriteColumn(operation.Column, writer, slots, context);
        }

        private static void WriteAlterColumn(
            AlterColumnOperation operation,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (operation.After.Generation
                is IdentityGenerationDefinition)
            {
                throw Unsupported(
                    context, "mysql.alter_identity_column", "$");
            }
            WriteAlterTablePrefix(operation.Table, writer, context);
            writer.AppendKeyword(SqlKeyword.Modify);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            WriteColumn(operation.After, writer, slots, context);
        }

        private static void WriteRenameColumn(
            RenameColumnOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (context.DialectProfile.ServerVersion.Major < 8)
            {
                throw Unsupported(
                    context, "mysql.rename_column", "$");
            }
            WriteAlterTablePrefix(operation.Table, writer, context);
            writer.AppendKeyword(SqlKeyword.Rename);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Source.Value);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.To);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Target.Value);
        }

        private static void WriteDropColumn(
            DropColumnOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                throw Unsupported(
                    context, "mysql.drop_column_if_exists", "$");
            }
            WriteAlterTablePrefix(operation.Table, writer, context);
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Column);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Column.Value);
        }

        private static void WriteAddConstraint(
            AddConstraintOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            WriteAlterTablePrefix(operation.Table, writer, context);
            writer.AppendKeyword(SqlKeyword.Add);
            writer.AppendSpace();
            WriteConstraint(operation.Constraint, writer, context);
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
                    context, "mysql.create_index_if_not_exists", "$");
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
            MySqlCompiler.WriteObjectName(
                operation.Table, writer, context);
            writer.AppendOpenParenthesis();
            WriteIndexColumns(operation.Index.Columns, writer, context);
            writer.AppendCloseParenthesis();
        }

        private static void WriteDropIndex(
            DropIndexOperation operation,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (operation.Behavior
                == DropObjectBehavior.AlreadySatisfiedIfMissing)
            {
                throw Unsupported(
                    context, "mysql.drop_index_if_exists", "$");
            }
            writer.AppendKeyword(SqlKeyword.Drop);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Index);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(operation.Index.Value);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.On);
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(
                operation.Table, writer, context);
        }

        private static void WriteTableComment(
            SqlObjectName table,
            string comment,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            WriteAlterTablePrefix(table, writer, context);
            writer.AppendKeyword(SqlKeyword.Comment);
            writer.AppendSpace();
            writer.AppendOperator(SqlOperatorToken.Equal);
            writer.AppendSpace();
            writer.AppendEscapedSchemaLiteral(
                new SqlSchemaLiteral(comment));
        }

        private static void WriteColumn(
            ColumnDefinition column,
            SqlTextWriter writer,
            IReadOnlyList<SqlParameterSlot> slots,
            SqlLoweringContext context)
        {
            if (column.DefaultValue != null && IsLobType(column.Type))
            {
                throw Unsupported(
                    context, "mysql.lob_default", "$");
            }
            writer.AppendIdentifierSegment(column.Name.Value);
            writer.AppendSpace();
            new MySqlTypeMapper().Write(column.Type, writer, context);
            writer.AppendSpace();
            if (column.Nullability == ColumnNullability.NotNullable)
            {
                writer.AppendKeyword(SqlKeyword.Not);
                writer.AppendSpace();
            }
            writer.AppendKeyword(SqlKeyword.Null);

            var identity = column.Generation as IdentityGenerationDefinition;
            if (identity != null)
            {
                if (identity.Seed != 1 || identity.Increment != 1)
                {
                    throw Unsupported(
                        context,
                        "mysql.identity_seed_increment",
                        "$");
                }
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.AutoIncrement);
            }
            else if (column.Generation is SequenceGenerationDefinition)
            {
                throw Unsupported(context, "mysql.sequence", "$");
            }
            else if (column.Generation is ComputedGenerationDefinition)
            {
                throw Unsupported(
                    context, "mysql.computed_column", "$");
            }

            if (column.DefaultValue != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Default);
                writer.AppendSpace();
                WriteDefault(
                    column.DefaultValue, column.Type, writer, context);
            }
            if (column.Comment != null)
            {
                writer.AppendSpace();
                writer.AppendKeyword(SqlKeyword.Comment);
                writer.AppendSpace();
                writer.AppendEscapedSchemaLiteral(
                    new SqlSchemaLiteral(column.Comment.Text));
            }
        }

        private static void WriteDefault(
            ColumnDefaultDefinition value,
            SqlTypeDescriptor targetType,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (value is NullDefaultDefinition)
            {
                writer.AppendKeyword(SqlKeyword.Null);
                return;
            }
            if (value is BooleanDefaultDefinition)
            {
                writer.AppendKeyword(
                    ((BooleanDefaultDefinition)value).Value
                        ? SqlKeyword.True
                        : SqlKeyword.False);
                return;
            }
            if (value is Int64DefaultDefinition)
            {
                var integer = ((Int64DefaultDefinition)value).Value;
                if (integer < 0 || integer > int.MaxValue)
                {
                    throw Unsupported(
                        context, "mysql.signed_int64_default", "$");
                }
                writer.AppendStructuralInt((int)integer);
                return;
            }
            if (value is DecimalDefaultDefinition)
            {
                var decimalValue = ((DecimalDefaultDefinition)value).Value;
                if (targetType.LogicalType != LogicalDbType.Decimal)
                {
                    throw Unsupported(
                        context, "mysql.decimal_default_type", "$");
                }
                if (decimalValue < 0
                    || decimalValue > int.MaxValue
                    || decimal.Truncate(decimalValue) != decimalValue)
                {
                    throw Unsupported(
                        context, "mysql.decimal_default", "$");
                }
                var integerDigits = (targetType.Precision ?? 38)
                    - (targetType.Scale ?? 0);
                if (decimalValue != 0m
                    && CountDecimalIntegerDigits(decimalValue)
                        > integerDigits)
                {
                    throw Unsupported(
                        context, "mysql.decimal_default_bounds", "$");
                }
                writer.AppendStructuralInt((int)decimalValue);
                return;
            }
            if (value is StringDefaultDefinition)
            {
                var text = ((StringDefaultDefinition)value).Value;
                if ((targetType.LogicalType == LogicalDbType.String
                     || targetType.LogicalType == LogicalDbType.AnsiString)
                    && targetType.Length.HasValue
                    && text.Length > targetType.Length.Value)
                {
                    throw Unsupported(
                        context, "mysql.string_default_length", "$");
                }
                WriteLiteral(text, writer);
                return;
            }
            if (value is GuidDefaultDefinition)
            {
                WriteLiteral(
                    ((GuidDefaultDefinition)value).Value.ToString("D"),
                    writer);
                return;
            }
            if (value is DateTimeDefaultDefinition)
            {
                var dateTime = ((DateTimeDefaultDefinition)value).Value;
                if (dateTime.Kind != DateTimeKind.Unspecified)
                {
                    throw Unsupported(
                        context, "mysql.datetime_default_kind", "$");
                }
                if (dateTime.Year < 1000)
                {
                    throw Unsupported(
                        context, "mysql.datetime_default_range", "$");
                }
                if (targetType.LogicalType == LogicalDbType.Date)
                {
                    if (dateTime.TimeOfDay != TimeSpan.Zero)
                    {
                        throw Unsupported(
                            context, "mysql.date_default_time", "$");
                    }
                    WriteLiteral(
                        dateTime.ToString(
                            "yyyy-MM-dd", CultureInfo.InvariantCulture),
                        writer);
                    return;
                }
                if (targetType.LogicalType != LogicalDbType.DateTime)
                {
                    throw Unsupported(
                        context, "mysql.datetime_default_type", "$");
                }
                if ((dateTime.Ticks % 10) != 0)
                {
                    throw Unsupported(
                        context,
                        "mysql.datetime_default_precision",
                        "$");
                }
                WriteLiteral(
                    dateTime.ToString(
                        "yyyy-MM-dd HH:mm:ss.ffffff",
                        CultureInfo.InvariantCulture),
                    writer);
                return;
            }
            if (value is DateTimeOffsetDefaultDefinition)
            {
                WriteLiteral(
                    ((DateTimeOffsetDefaultDefinition)value).Value.ToString(
                        "O", CultureInfo.InvariantCulture),
                    writer);
                return;
            }
            var semantic = value as SemanticDefaultDefinition;
            if (semantic == null)
            {
                throw Unsupported(context, "mysql.default", "$");
            }
            if (semantic.Kind == SemanticDefaultKind.CurrentUtcDateTime)
            {
                throw Unsupported(
                    context, "mysql.current_utc_default", "$");
            }
            if (semantic.Kind == SemanticDefaultKind.CurrentDate)
            {
                throw Unsupported(
                    context, "mysql.current_date_default", "$");
            }
            if (semantic.Kind == SemanticDefaultKind.NewGuid)
            {
                throw Unsupported(
                    context, "mysql.new_guid_default", "$");
            }
            if (semantic.Kind != SemanticDefaultKind.CurrentDateTime
                || targetType.LogicalType != LogicalDbType.DateTime)
            {
                throw Unsupported(
                    context, "mysql.current_datetime_default_type", "$");
            }
            writer.AppendKeyword(SqlKeyword.CurrentTimestamp);
            writer.AppendOpenParenthesis();
            writer.AppendStructuralInt(6);
            writer.AppendCloseParenthesis();
        }

        private static int CountDecimalIntegerDigits(decimal value)
        {
            var integer = decimal.Truncate(value);
            var digits = 0;
            do
            {
                digits++;
                integer = decimal.Truncate(integer / 10m);
            }
            while (integer != 0m);
            return digits;
        }

        private static void ValidateAutoIncrementKeys(
            TableDefinition table,
            SqlLoweringContext context)
        {
            ColumnDefinition identityColumn = null;
            for (var index = 0; index < table.Columns.Count; index++)
            {
                if (!(table.Columns[index].Generation
                    is IdentityGenerationDefinition))
                {
                    continue;
                }
                if (identityColumn != null)
                {
                    throw Unsupported(
                        context, "mysql.auto_increment_count", "$");
                }
                identityColumn = table.Columns[index];
            }
            if (identityColumn == null)
            {
                return;
            }
            if (identityColumn.Nullability != ColumnNullability.NotNullable)
            {
                throw Unsupported(
                    context,
                    "mysql.auto_increment_nullability",
                    "$");
            }
            var identity = identityColumn.Name;
            for (var index = 0; index < table.Constraints.Count; index++)
            {
                var primary = table.Constraints[index]
                    as PrimaryKeyDefinition;
                if (primary != null
                    && primary.Columns.Count != 0
                    && primary.Columns[0].Equals(identity))
                {
                    return;
                }
                var unique = table.Constraints[index]
                    as UniqueConstraintDefinition;
                if (unique != null
                    && unique.Columns.Count != 0
                    && unique.Columns[0].Equals(identity))
                {
                    return;
                }
                var foreign = table.Constraints[index]
                    as ForeignKeyDefinition;
                if (foreign != null
                    && foreign.Columns.LocalColumns.Count != 0
                    && foreign.Columns.LocalColumns[0].Equals(identity))
                {
                    return;
                }
            }
            for (var index = 0; index < table.Indexes.Count; index++)
            {
                if (table.Indexes[index].Columns.Count != 0
                    && table.Indexes[index].Columns[0].Column.Equals(identity))
                {
                    return;
                }
            }
            throw Unsupported(
                context, "mysql.auto_increment_key", "$");
        }

        private static bool IsLobType(SqlTypeDescriptor type)
        {
            switch (type.LogicalType)
            {
                case LogicalDbType.Json:
                case LogicalDbType.Clob:
                case LogicalDbType.Blob:
                    return true;
                case LogicalDbType.String:
                case LogicalDbType.AnsiString:
                case LogicalDbType.Binary:
                    return !type.Length.HasValue
                        || type.Length.Value > 16383;
                default:
                    return false;
            }
        }

        private static void WriteConstraint(
            ConstraintDefinition constraint,
            SqlTextWriter writer,
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
                writer.AppendOpenParenthesis();
                WriteIdentifiers(primary.Columns, writer);
                writer.AppendCloseParenthesis();
                return;
            }
            var unique = constraint as UniqueConstraintDefinition;
            if (unique != null)
            {
                writer.AppendKeyword(SqlKeyword.Unique);
                writer.AppendOpenParenthesis();
                WriteIdentifiers(unique.Columns, writer);
                writer.AppendCloseParenthesis();
                return;
            }
            var foreign = constraint as ForeignKeyDefinition;
            if (foreign == null)
            {
                throw Unsupported(context, "mysql.constraint", "$");
            }
            writer.AppendKeyword(SqlKeyword.Foreign);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Key);
            writer.AppendOpenParenthesis();
            WriteIdentifiers(foreign.Columns.LocalColumns, writer);
            writer.AppendCloseParenthesis();
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.References);
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(
                foreign.ReferencedTable, writer, context);
            writer.AppendOpenParenthesis();
            WriteIdentifiers(foreign.Columns.ReferencedColumns, writer);
            writer.AppendCloseParenthesis();
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
        }

        private static void WriteReferentialAction(
            SqlKeyword operation,
            ReferentialAction action,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (action == ReferentialAction.SetDefault)
            {
                throw Unsupported(
                    context, "mysql.foreign_key_set_default", "$");
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
                    break;
                case ReferentialAction.Restrict:
                    writer.AppendKeyword(SqlKeyword.Restrict);
                    break;
                case ReferentialAction.Cascade:
                    writer.AppendKeyword(SqlKeyword.Cascade);
                    break;
                case ReferentialAction.SetNull:
                    writer.AppendKeyword(SqlKeyword.Set);
                    writer.AppendSpace();
                    writer.AppendKeyword(SqlKeyword.Null);
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(action));
            }
        }

        private static void WriteInlineIndex(
            IndexDefinition index,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            if (index.Uniqueness == IndexUniqueness.Unique)
            {
                writer.AppendKeyword(SqlKeyword.Unique);
                writer.AppendSpace();
            }
            writer.AppendKeyword(SqlKeyword.Key);
            writer.AppendSpace();
            writer.AppendIdentifierSegment(index.Name.Value);
            writer.AppendOpenParenthesis();
            WriteIndexColumns(index.Columns, writer, context);
            writer.AppendCloseParenthesis();
        }

        private static void WriteIndexColumns(
            IReadOnlyList<IndexColumnDefinition> columns,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            for (var index = 0; index < columns.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                if (columns[index].Direction == SqlSortDirection.Descending
                    && context.DialectProfile.ServerVersion.Major < 8)
                {
                    throw Unsupported(
                        context, "mysql57.descending_index", "$");
                }
                writer.AppendIdentifierSegment(columns[index].Column.Value);
                writer.AppendSpace();
                writer.AppendKeyword(
                    columns[index].Direction == SqlSortDirection.Ascending
                        ? SqlKeyword.Asc
                        : SqlKeyword.Desc);
            }
        }

        private static void WriteAlterTablePrefix(
            SqlObjectName table,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            writer.AppendKeyword(SqlKeyword.Alter);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Table);
            writer.AppendSpace();
            MySqlCompiler.WriteObjectName(table, writer, context);
            writer.AppendSpace();
        }

        private static void WriteIfNotExists(SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.If);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Not);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Exists);
        }

        private static void WriteIfExists(SqlTextWriter writer)
        {
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.If);
            writer.AppendSpace();
            writer.AppendKeyword(SqlKeyword.Exists);
        }

        private static void WriteSeparator(
            SqlTextWriter writer,
            ref bool needsComma)
        {
            if (needsComma)
            {
                writer.AppendComma();
            }
            needsComma = true;
        }

        private static void WriteIdentifiers(
            IReadOnlyList<SqlIdentifier> identifiers,
            SqlTextWriter writer)
        {
            for (var index = 0; index < identifiers.Count; index++)
            {
                if (index != 0)
                {
                    writer.AppendComma();
                }
                writer.AppendIdentifierSegment(identifiers[index].Value);
            }
        }

        private static void WriteLiteral(
            string value,
            SqlTextWriter writer)
        {
            writer.AppendEscapedSchemaLiteral(new SqlSchemaLiteral(value));
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
