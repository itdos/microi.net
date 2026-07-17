using System;
using System.Collections.Generic;

namespace Dos.ORM.SqlAst
{
    public enum SemanticDefaultKind
    {
        CurrentDate,
        CurrentDateTime,
        CurrentUtcDateTime,
        NewGuid
    }

    public enum ComputedStorageKind
    {
        Virtual,
        Stored
    }

    public enum ColumnNullability
    {
        Nullable,
        NotNullable
    }

    public enum IndexUniqueness
    {
        NonUnique,
        Unique
    }

    public enum ReferentialAction
    {
        NoAction,
        Restrict,
        Cascade,
        SetNull,
        SetDefault
    }

    public enum SequenceCycleBehavior
    {
        NoCycle,
        Cycle
    }

    public enum DestructiveImpact
    {
        None,
        CompatibilityRisk,
        PotentialDataLoss
    }

    public enum CreateObjectBehavior
    {
        FailIfExists,
        AlreadySatisfiedIfExists
    }

    public enum DropObjectBehavior
    {
        FailIfMissing,
        AlreadySatisfiedIfMissing
    }

    public enum DropScope
    {
        Restrict,
        Cascade
    }

    public enum MigrationIdempotencyMode
    {
        RequireChange,
        AcceptAlreadySatisfied
    }

    public enum MigrationStepOutcome
    {
        Applied,
        AlreadySatisfied,
        PreconditionFailed,
        BlockedDestructive,
        Unsupported,
        Failed
    }

    public enum MetadataLookupStatus
    {
        Found,
        NotFound
    }

    public enum MetadataCollectionStatus
    {
        Found,
        TargetNotFound
    }

    public enum DatabaseDiagnosticKind
    {
        Information,
        Health,
        Permissions
    }

    public enum DatabaseDiagnosticStatus
    {
        Healthy,
        Warning,
        Failed
    }

    public enum DiagnosticSeverity
    {
        Information,
        Warning,
        Error
    }

    public enum DatabaseTransferFormat
    {
        PortableJson,
        DelimitedText,
        ProviderNative
    }

    public enum DatabaseTransferScope
    {
        SchemaAndData,
        SchemaOnly,
        DataOnly
    }

    public enum DatabaseImportConflictPolicy
    {
        FailOnConflict,
        SkipExisting,
        ReplaceTargetDatabase
    }

    public enum AdminOperationKind
    {
        DropDatabase,
        ReplaceImport
    }

    public enum DatabaseAdminOutcome
    {
        Applied,
        AlreadySatisfied,
        BlockedDestructive,
        Unsupported,
        Failed
    }

    public sealed class SchemaComment : IEquatable<SchemaComment>
    {
        public SchemaComment(string text)
        {
            SchemaModelGuard.RequireText(text, nameof(text));
            Text = text;
        }

        public string Text { get; }

        public bool Equals(SchemaComment other)
        {
            return other != null &&
                   string.Equals(Text, other.Text, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SchemaComment);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Text);
        }
    }

    public sealed class MigrationPlanId : IEquatable<MigrationPlanId>
    {
        public MigrationPlanId(string value)
        {
            SchemaModelGuard.RequireText(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(MigrationPlanId other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as MigrationPlanId);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class MigrationStepId : IEquatable<MigrationStepId>
    {
        public MigrationStepId(string value)
        {
            SchemaModelGuard.RequireText(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(MigrationStepId other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as MigrationStepId);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class ApprovalReference : IEquatable<ApprovalReference>
    {
        public ApprovalReference(string value)
        {
            SchemaModelGuard.RequireText(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(ApprovalReference other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ApprovalReference);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class SchemaToken : IEquatable<SchemaToken>
    {
        public SchemaToken(string value)
        {
            SchemaModelGuard.RequireText(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(SchemaToken other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SchemaToken);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class DiagnosticCode : IEquatable<DiagnosticCode>
    {
        public DiagnosticCode(string value)
        {
            SchemaModelGuard.RequireText(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(DiagnosticCode other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as DiagnosticCode);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class StructuralFingerprint : IEquatable<StructuralFingerprint>
    {
        internal StructuralFingerprint(string value)
        {
            SchemaModelGuard.RequireFingerprint(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(StructuralFingerprint other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as StructuralFingerprint);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class ExpectedStructuralFingerprint :
        IEquatable<ExpectedStructuralFingerprint>
    {
        public ExpectedStructuralFingerprint(string value)
        {
            SchemaModelGuard.RequireFingerprint(value, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(ExpectedStructuralFingerprint other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ExpectedStructuralFingerprint);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class ResourceContentDigest : IEquatable<ResourceContentDigest>
    {
        public ResourceContentDigest(string value)
        {
            SchemaModelGuard.RequireLowerHex(value, 64, nameof(value));
            Value = value;
        }

        public string Value { get; }

        public bool Equals(ResourceContentDigest other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ResourceContentDigest);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class DatabaseResourceHandle :
        IEquatable<DatabaseResourceHandle>
    {
        public DatabaseResourceHandle(
            Guid id,
            ResourceContentDigest contentDigest)
        {
            if (id == Guid.Empty)
            {
                throw new ArgumentException(
                    "Resource handle ID cannot be empty.", nameof(id));
            }

            Id = id;
            ContentDigest = contentDigest ??
                throw new ArgumentNullException(nameof(contentDigest));
        }

        public Guid Id { get; }

        public ResourceContentDigest ContentDigest { get; }

        public bool Equals(DatabaseResourceHandle other)
        {
            return other != null &&
                   Id.Equals(other.Id) &&
                   Equals(ContentDigest, other.ContentDigest);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as DatabaseResourceHandle);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Id.GetHashCode() * 397) ^ ContentDigest.GetHashCode();
            }
        }
    }

    public abstract class ColumnDefaultDefinition : SqlNode
    {
    }

    public sealed class NullDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<NullDefaultDefinition>
    {
        public NullDefaultDefinition()
        {
        }

        public bool Equals(NullDefaultDefinition other)
        {
            return other != null;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as NullDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return 17;
        }
    }

    public sealed class BooleanDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<BooleanDefaultDefinition>
    {
        public BooleanDefaultDefinition(bool value)
        {
            Value = value;
        }

        public bool Value { get; }

        public bool Equals(BooleanDefaultDefinition other)
        {
            return other != null && Value == other.Value;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as BooleanDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return Value ? 1 : 0;
        }
    }

    public sealed class Int64DefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<Int64DefaultDefinition>
    {
        public Int64DefaultDefinition(long value)
        {
            Value = value;
        }

        public long Value { get; }

        public bool Equals(Int64DefaultDefinition other)
        {
            return other != null && Value == other.Value;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as Int64DefaultDefinition);
        }

        public override int GetHashCode()
        {
            return Value.GetHashCode();
        }
    }

    public sealed class DecimalDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<DecimalDefaultDefinition>
    {
        public DecimalDefaultDefinition(decimal value)
        {
            Value = value;
        }

        public decimal Value { get; }

        public bool Equals(DecimalDefaultDefinition other)
        {
            return other != null &&
                   SchemaModelEquality.DecimalBitsEqual(Value, other.Value);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as DecimalDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return SchemaModelEquality.DecimalBitsHash(Value);
        }
    }

    public sealed class StringDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<StringDefaultDefinition>
    {
        public StringDefaultDefinition(string value)
        {
            Value = value ?? throw new ArgumentNullException(nameof(value));
        }

        public string Value { get; }

        public bool Equals(StringDefaultDefinition other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as StringDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }
    }

    public sealed class GuidDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<GuidDefaultDefinition>
    {
        public GuidDefaultDefinition(Guid value)
        {
            Value = value;
        }

        public Guid Value { get; }

        public bool Equals(GuidDefaultDefinition other)
        {
            return other != null && Value.Equals(other.Value);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as GuidDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return Value.GetHashCode();
        }
    }

    public sealed class DateTimeDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<DateTimeDefaultDefinition>
    {
        public DateTimeDefaultDefinition(DateTime value)
        {
            Value = value;
        }

        public DateTime Value { get; }

        public bool Equals(DateTimeDefaultDefinition other)
        {
            return other != null &&
                   Value.Ticks == other.Value.Ticks &&
                   Value.Kind == other.Value.Kind;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as DateTimeDefaultDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Value.Ticks.GetHashCode() * 397) ^ (int)Value.Kind;
            }
        }
    }

    public sealed class DateTimeOffsetDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<DateTimeOffsetDefaultDefinition>
    {
        public DateTimeOffsetDefaultDefinition(DateTimeOffset value)
        {
            Value = value;
        }

        public DateTimeOffset Value { get; }

        public bool Equals(DateTimeOffsetDefaultDefinition other)
        {
            return other != null &&
                   Value.Ticks == other.Value.Ticks &&
                   Value.Offset == other.Value.Offset;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as DateTimeOffsetDefaultDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Value.Ticks.GetHashCode() * 397) ^
                       Value.Offset.GetHashCode();
            }
        }
    }

    public sealed class SemanticDefaultDefinition :
        ColumnDefaultDefinition,
        IEquatable<SemanticDefaultDefinition>
    {
        public SemanticDefaultDefinition(SemanticDefaultKind kind)
        {
            SchemaModelGuard.RequireDefined(kind, nameof(kind));
            Kind = kind;
        }

        public SemanticDefaultKind Kind { get; }

        public bool Equals(SemanticDefaultDefinition other)
        {
            return other != null && Kind == other.Kind;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SemanticDefaultDefinition);
        }

        public override int GetHashCode()
        {
            return (int)Kind;
        }
    }

    public abstract class ColumnGenerationDefinition : SqlNode
    {
    }

    public sealed class IdentityGenerationDefinition :
        ColumnGenerationDefinition,
        IEquatable<IdentityGenerationDefinition>
    {
        public IdentityGenerationDefinition(long seed, long increment)
        {
            if (increment == 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(increment), "Identity increment cannot be zero.");
            }

            Seed = seed;
            Increment = increment;
        }

        public long Seed { get; }

        public long Increment { get; }

        public bool Equals(IdentityGenerationDefinition other)
        {
            return other != null &&
                   Seed == other.Seed &&
                   Increment == other.Increment;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as IdentityGenerationDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Seed.GetHashCode() * 397) ^ Increment.GetHashCode();
            }
        }
    }

    public sealed class SequenceGenerationDefinition :
        ColumnGenerationDefinition,
        IEquatable<SequenceGenerationDefinition>
    {
        public SequenceGenerationDefinition(SqlObjectName sequence)
        {
            Sequence = sequence ?? throw new ArgumentNullException(nameof(sequence));
        }

        public SqlObjectName Sequence { get; }

        public bool Equals(SequenceGenerationDefinition other)
        {
            return other != null && Equals(Sequence, other.Sequence);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SequenceGenerationDefinition);
        }

        public override int GetHashCode()
        {
            return Sequence.GetHashCode();
        }
    }

    public sealed class ComputedGenerationDefinition :
        ColumnGenerationDefinition,
        IEquatable<ComputedGenerationDefinition>
    {
        public ComputedGenerationDefinition(
            SqlExpression expression,
            ComputedStorageKind storage)
        {
            Expression = expression ??
                throw new ArgumentNullException(nameof(expression));
            SchemaModelGuard.RequireDefined(storage, nameof(storage));
            SchemaExpressionCatalog.Validate(Expression, nameof(expression));
            Storage = storage;
        }

        public SqlExpression Expression { get; }

        public ComputedStorageKind Storage { get; }

        public bool Equals(ComputedGenerationDefinition other)
        {
            return other != null &&
                   Storage == other.Storage &&
                   SchemaExpressionEquality.Equals(Expression, other.Expression);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ComputedGenerationDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (SchemaExpressionEquality.GetHashCode(Expression) * 397) ^
                       (int)Storage;
            }
        }
    }

    public sealed class ColumnDefinition :
        SqlNode,
        IEquatable<ColumnDefinition>
    {
        public ColumnDefinition(
            SqlIdentifier name,
            SqlTypeDescriptor type,
            ColumnNullability nullability,
            ColumnGenerationDefinition generation = null,
            ColumnDefaultDefinition defaultValue = null,
            SchemaComment comment = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Type = type ?? throw new ArgumentNullException(nameof(type));
            SchemaModelGuard.RequireDefined(nullability, nameof(nullability));
            SchemaModelGuard.RequireKnownGeneration(generation, nameof(generation));
            SchemaModelGuard.RequireKnownDefault(defaultValue, nameof(defaultValue));

            if (generation != null && defaultValue != null)
            {
                throw new ArgumentException(
                    "Column generation and default value are mutually exclusive.",
                    nameof(defaultValue));
            }

            if (generation is IdentityGenerationDefinition ||
                generation is SequenceGenerationDefinition)
            {
                if (!SchemaModelGuard.IsInteger(type.LogicalType))
                {
                    throw new ArgumentException(
                        "Identity and sequence generation require an integer logical type.",
                        nameof(generation));
                }
            }

            if (generation is IdentityGenerationDefinition identity)
            {
                SchemaModelGuard.RequireIntegerRange(
                    identity.Seed, type.LogicalType, nameof(generation));
                SchemaModelGuard.RequireIntegerRange(
                    identity.Increment, type.LogicalType, nameof(generation));
            }

            Nullability = nullability;
            Generation = generation;
            DefaultValue = defaultValue;
            Comment = comment;
        }

        public SqlIdentifier Name { get; }

        public SqlTypeDescriptor Type { get; }

        public ColumnNullability Nullability { get; }

        public ColumnGenerationDefinition Generation { get; }

        public ColumnDefaultDefinition DefaultValue { get; }

        public SchemaComment Comment { get; }

        public bool Equals(ColumnDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   Equals(Type, other.Type) &&
                   Nullability == other.Nullability &&
                   Equals(Generation, other.Generation) &&
                   Equals(DefaultValue, other.DefaultValue) &&
                   Equals(Comment, other.Comment);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ColumnDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = Name.GetHashCode();
                hashCode = (hashCode * 397) ^ Type.GetHashCode();
                hashCode = (hashCode * 397) ^ (int)Nullability;
                hashCode = (hashCode * 397) ^
                           (Generation == null ? 0 : Generation.GetHashCode());
                hashCode = (hashCode * 397) ^
                           (DefaultValue == null ? 0 : DefaultValue.GetHashCode());
                hashCode = (hashCode * 397) ^
                           (Comment == null ? 0 : Comment.GetHashCode());
                return hashCode;
            }
        }
    }

    public sealed class SchemaName : SqlNode, IEquatable<SchemaName>
    {
        public SchemaName(SqlIdentifier name, SqlIdentifier catalog = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Catalog = catalog;
        }

        public SqlIdentifier Name { get; }

        public SqlIdentifier Catalog { get; }

        public bool Equals(SchemaName other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   Equals(Catalog, other.Catalog);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SchemaName);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Name.GetHashCode() * 397) ^
                       (Catalog == null ? 0 : Catalog.GetHashCode());
            }
        }
    }

    public sealed class SchemaScope : SqlNode, IEquatable<SchemaScope>
    {
        private SchemaScope(SqlIdentifier catalog, SqlIdentifier schema)
        {
            Catalog = catalog;
            Schema = schema;
        }

        public SqlIdentifier Catalog { get; }

        public SqlIdentifier Schema { get; }

        public static SchemaScope All()
        {
            return new SchemaScope(null, null);
        }

        public static SchemaScope ForSchema(SqlIdentifier schema)
        {
            return new SchemaScope(
                null,
                schema ?? throw new ArgumentNullException(nameof(schema)));
        }

        public static SchemaScope ForCatalogAndSchema(
            SqlIdentifier catalog,
            SqlIdentifier schema)
        {
            return new SchemaScope(
                catalog ?? throw new ArgumentNullException(nameof(catalog)),
                schema ?? throw new ArgumentNullException(nameof(schema)));
        }

        public bool Equals(SchemaScope other)
        {
            return other != null &&
                   Equals(Catalog, other.Catalog) &&
                   Equals(Schema, other.Schema);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SchemaScope);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return ((Catalog == null ? 0 : Catalog.GetHashCode()) * 397) ^
                       (Schema == null ? 0 : Schema.GetHashCode());
            }
        }
    }

    public sealed class IndexColumnDefinition :
        SqlNode,
        IEquatable<IndexColumnDefinition>
    {
        public IndexColumnDefinition(
            SqlIdentifier column,
            SqlSortDirection direction)
        {
            Column = column ?? throw new ArgumentNullException(nameof(column));
            SchemaModelGuard.RequireDefined(direction, nameof(direction));
            Direction = direction;
        }

        public SqlIdentifier Column { get; }

        public SqlSortDirection Direction { get; }

        public bool Equals(IndexColumnDefinition other)
        {
            return other != null &&
                   Equals(Column, other.Column) &&
                   Direction == other.Direction;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as IndexColumnDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Column.GetHashCode() * 397) ^ (int)Direction;
            }
        }
    }

    public sealed class IndexDefinition : SqlNode, IEquatable<IndexDefinition>
    {
        public IndexDefinition(
            SqlIdentifier name,
            IEnumerable<IndexColumnDefinition> columns,
            IndexUniqueness uniqueness)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            SchemaModelGuard.RequireDefined(uniqueness, nameof(uniqueness));
            Columns = SqlAstCollection.Copy(
                columns, nameof(columns), allowEmpty: false);
            SchemaModelGuard.RequireUnique(
                Columns, item => item.Column, nameof(columns));
            Uniqueness = uniqueness;
        }

        public SqlIdentifier Name { get; }

        public IReadOnlyList<IndexColumnDefinition> Columns { get; }

        public IndexUniqueness Uniqueness { get; }

        public bool Equals(IndexDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   Uniqueness == other.Uniqueness &&
                   SchemaModelEquality.SequenceEqual(Columns, other.Columns);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as IndexDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = Name.GetHashCode();
                hashCode = (hashCode * 397) ^ (int)Uniqueness;
                return SchemaModelEquality.AddSequenceHash(hashCode, Columns);
            }
        }
    }

    public abstract class ConstraintDefinition : SqlNode
    {
        protected ConstraintDefinition(SqlIdentifier name)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
        }

        public SqlIdentifier Name { get; }
    }

    public sealed class PrimaryKeyDefinition :
        ConstraintDefinition,
        IEquatable<PrimaryKeyDefinition>
    {
        public PrimaryKeyDefinition(
            SqlIdentifier name,
            IEnumerable<SqlIdentifier> columns)
            : base(name)
        {
            Columns = SchemaModelGuard.CopyUniqueIdentifiers(
                columns, nameof(columns), allowEmpty: false);
        }

        public IReadOnlyList<SqlIdentifier> Columns { get; }

        public bool Equals(PrimaryKeyDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   SchemaModelEquality.SequenceEqual(Columns, other.Columns);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as PrimaryKeyDefinition);
        }

        public override int GetHashCode()
        {
            return SchemaModelEquality.AddSequenceHash(
                Name.GetHashCode(), Columns);
        }
    }

    public sealed class UniqueConstraintDefinition :
        ConstraintDefinition,
        IEquatable<UniqueConstraintDefinition>
    {
        public UniqueConstraintDefinition(
            SqlIdentifier name,
            IEnumerable<SqlIdentifier> columns)
            : base(name)
        {
            Columns = SchemaModelGuard.CopyUniqueIdentifiers(
                columns, nameof(columns), allowEmpty: false);
        }

        public IReadOnlyList<SqlIdentifier> Columns { get; }

        public bool Equals(UniqueConstraintDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   SchemaModelEquality.SequenceEqual(Columns, other.Columns);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as UniqueConstraintDefinition);
        }

        public override int GetHashCode()
        {
            return SchemaModelEquality.AddSequenceHash(
                Name.GetHashCode(), Columns);
        }
    }

    public sealed class ForeignKeyColumnSet :
        SqlNode,
        IEquatable<ForeignKeyColumnSet>
    {
        public ForeignKeyColumnSet(
            IEnumerable<SqlIdentifier> localColumns,
            IEnumerable<SqlIdentifier> referencedColumns)
        {
            LocalColumns = SchemaModelGuard.CopyUniqueIdentifiers(
                localColumns, nameof(localColumns), allowEmpty: false);
            ReferencedColumns = SchemaModelGuard.CopyUniqueIdentifiers(
                referencedColumns, nameof(referencedColumns), allowEmpty: false);
            if (LocalColumns.Count != ReferencedColumns.Count)
            {
                throw new ArgumentException(
                    "Foreign-key local and referenced columns must have equal arity.",
                    nameof(referencedColumns));
            }
        }

        public IReadOnlyList<SqlIdentifier> LocalColumns { get; }

        public IReadOnlyList<SqlIdentifier> ReferencedColumns { get; }

        public bool Equals(ForeignKeyColumnSet other)
        {
            return other != null &&
                   SchemaModelEquality.SequenceEqual(
                       LocalColumns, other.LocalColumns) &&
                   SchemaModelEquality.SequenceEqual(
                       ReferencedColumns, other.ReferencedColumns);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ForeignKeyColumnSet);
        }

        public override int GetHashCode()
        {
            var hashCode = SchemaModelEquality.AddSequenceHash(
                17, LocalColumns);
            return SchemaModelEquality.AddSequenceHash(
                hashCode, ReferencedColumns);
        }
    }

    public sealed class ReferentialActions :
        SqlNode,
        IEquatable<ReferentialActions>
    {
        public ReferentialActions(
            ReferentialAction onUpdate,
            ReferentialAction onDelete)
        {
            SchemaModelGuard.RequireDefined(onUpdate, nameof(onUpdate));
            SchemaModelGuard.RequireDefined(onDelete, nameof(onDelete));
            OnUpdate = onUpdate;
            OnDelete = onDelete;
        }

        public ReferentialAction OnUpdate { get; }

        public ReferentialAction OnDelete { get; }

        public bool Equals(ReferentialActions other)
        {
            return other != null &&
                   OnUpdate == other.OnUpdate &&
                   OnDelete == other.OnDelete;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ReferentialActions);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return ((int)OnUpdate * 397) ^ (int)OnDelete;
            }
        }
    }

    public sealed class ForeignKeyDefinition :
        ConstraintDefinition,
        IEquatable<ForeignKeyDefinition>
    {
        public ForeignKeyDefinition(
            SqlIdentifier name,
            SqlObjectName referencedTable,
            ForeignKeyColumnSet columns,
            ReferentialActions actions)
            : base(name)
        {
            ReferencedTable = referencedTable ??
                throw new ArgumentNullException(nameof(referencedTable));
            Columns = columns ?? throw new ArgumentNullException(nameof(columns));
            Actions = actions ?? throw new ArgumentNullException(nameof(actions));
        }

        public SqlObjectName ReferencedTable { get; }

        public ForeignKeyColumnSet Columns { get; }

        public ReferentialActions Actions { get; }

        public bool Equals(ForeignKeyDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   Equals(ReferencedTable, other.ReferencedTable) &&
                   Equals(Columns, other.Columns) &&
                   Equals(Actions, other.Actions);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as ForeignKeyDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = Name.GetHashCode();
                hashCode = (hashCode * 397) ^ ReferencedTable.GetHashCode();
                hashCode = (hashCode * 397) ^ Columns.GetHashCode();
                hashCode = (hashCode * 397) ^ Actions.GetHashCode();
                return hashCode;
            }
        }
    }

    public sealed class TableDefinition : SqlNode, IEquatable<TableDefinition>
    {
        public TableDefinition(
            SqlObjectName name,
            IEnumerable<ColumnDefinition> columns,
            IEnumerable<ConstraintDefinition> constraints = null,
            IEnumerable<IndexDefinition> indexes = null,
            SchemaComment comment = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Columns = SqlAstCollection.Copy(
                columns, nameof(columns), allowEmpty: false);
            Constraints = SqlAstCollection.Copy(
                constraints ?? Array.Empty<ConstraintDefinition>(),
                nameof(constraints),
                allowEmpty: true);
            Indexes = SqlAstCollection.Copy(
                indexes ?? Array.Empty<IndexDefinition>(),
                nameof(indexes),
                allowEmpty: true);

            SchemaModelGuard.RequireUnique(
                Columns, item => item.Name, nameof(columns));
            SchemaModelGuard.RequireUnique(
                Constraints, item => item.Name, nameof(constraints));
            SchemaModelGuard.RequireUnique(
                Indexes, item => item.Name, nameof(indexes));
            foreach (var constraint in Constraints)
            {
                SchemaModelGuard.RequireKnownConstraint(
                    constraint, nameof(constraints));
            }

            Comment = comment;
        }

        public SqlObjectName Name { get; }

        public IReadOnlyList<ColumnDefinition> Columns { get; }

        public IReadOnlyList<ConstraintDefinition> Constraints { get; }

        public IReadOnlyList<IndexDefinition> Indexes { get; }

        public SchemaComment Comment { get; }

        public bool Equals(TableDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   SchemaModelEquality.SequenceEqual(Columns, other.Columns) &&
                   SchemaModelEquality.SequenceEqual(
                       Constraints, other.Constraints) &&
                   SchemaModelEquality.SequenceEqual(Indexes, other.Indexes) &&
                   Equals(Comment, other.Comment);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as TableDefinition);
        }

        public override int GetHashCode()
        {
            var hashCode = SchemaModelEquality.AddSequenceHash(
                Name.GetHashCode(), Columns);
            hashCode = SchemaModelEquality.AddSequenceHash(
                hashCode, Constraints);
            hashCode = SchemaModelEquality.AddSequenceHash(
                hashCode, Indexes);
            unchecked
            {
                return (hashCode * 397) ^
                       (Comment == null ? 0 : Comment.GetHashCode());
            }
        }
    }

    public sealed class SequenceBounds : SqlNode, IEquatable<SequenceBounds>
    {
        private SequenceBounds(long? minimumValue, long? maximumValue)
        {
            MinimumValue = minimumValue;
            MaximumValue = maximumValue;
        }

        public long? MinimumValue { get; }

        public long? MaximumValue { get; }

        public static SequenceBounds Unbounded()
        {
            return new SequenceBounds(null, null);
        }

        public static SequenceBounds Minimum(long minimum)
        {
            return new SequenceBounds(minimum, null);
        }

        public static SequenceBounds Maximum(long maximum)
        {
            return new SequenceBounds(null, maximum);
        }

        public static SequenceBounds Between(long minimum, long maximum)
        {
            if (minimum > maximum)
            {
                throw new ArgumentException(
                    "Sequence minimum cannot exceed its maximum.",
                    nameof(minimum));
            }

            return new SequenceBounds(minimum, maximum);
        }

        public bool Equals(SequenceBounds other)
        {
            return other != null &&
                   MinimumValue == other.MinimumValue &&
                   MaximumValue == other.MaximumValue;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SequenceBounds);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (MinimumValue.GetHashCode() * 397) ^
                       MaximumValue.GetHashCode();
            }
        }
    }

    public sealed class SequenceOptions : SqlNode, IEquatable<SequenceOptions>
    {
        public SequenceOptions(
            long startValue,
            long incrementBy,
            SequenceBounds bounds,
            int? cacheSize,
            SequenceCycleBehavior cycle)
        {
            if (incrementBy == 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(incrementBy), "Sequence increment cannot be zero.");
            }

            Bounds = bounds ?? throw new ArgumentNullException(nameof(bounds));
            if (cacheSize.HasValue && cacheSize.Value <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(cacheSize), "Sequence cache size must be positive.");
            }

            SchemaModelGuard.RequireDefined(cycle, nameof(cycle));
            if ((bounds.MinimumValue.HasValue &&
                 startValue < bounds.MinimumValue.Value) ||
                (bounds.MaximumValue.HasValue &&
                 startValue > bounds.MaximumValue.Value))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(startValue), "Sequence start must be inside its bounds.");
            }

            StartValue = startValue;
            IncrementBy = incrementBy;
            CacheSize = cacheSize;
            Cycle = cycle;
        }

        public long StartValue { get; }

        public long IncrementBy { get; }

        public SequenceBounds Bounds { get; }

        public int? CacheSize { get; }

        public SequenceCycleBehavior Cycle { get; }

        public bool Equals(SequenceOptions other)
        {
            return other != null &&
                   StartValue == other.StartValue &&
                   IncrementBy == other.IncrementBy &&
                   Equals(Bounds, other.Bounds) &&
                   CacheSize == other.CacheSize &&
                   Cycle == other.Cycle;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SequenceOptions);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = StartValue.GetHashCode();
                hashCode = (hashCode * 397) ^ IncrementBy.GetHashCode();
                hashCode = (hashCode * 397) ^ Bounds.GetHashCode();
                hashCode = (hashCode * 397) ^ CacheSize.GetHashCode();
                hashCode = (hashCode * 397) ^ (int)Cycle;
                return hashCode;
            }
        }
    }

    public sealed class SequenceDefinition :
        SqlNode,
        IEquatable<SequenceDefinition>
    {
        public SequenceDefinition(
            SqlObjectName name,
            LogicalDbType integerType,
            SequenceOptions options)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            if (!Enum.IsDefined(typeof(LogicalDbType), integerType))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(integerType), "Logical database type must be defined.");
            }

            if (!SchemaModelGuard.IsInteger(integerType))
            {
                throw new ArgumentException(
                    "Sequence logical type must be Int16, Int32, or Int64.",
                    nameof(integerType));
            }

            Options = options ?? throw new ArgumentNullException(nameof(options));
            SchemaModelGuard.RequireIntegerRange(
                options.StartValue, integerType, nameof(options));
            if (options.Bounds.MinimumValue.HasValue)
            {
                SchemaModelGuard.RequireIntegerRange(
                    options.Bounds.MinimumValue.Value,
                    integerType,
                    nameof(options));
            }

            if (options.Bounds.MaximumValue.HasValue)
            {
                SchemaModelGuard.RequireIntegerRange(
                    options.Bounds.MaximumValue.Value,
                    integerType,
                    nameof(options));
            }

            IntegerType = integerType;
        }

        public SqlObjectName Name { get; }

        public LogicalDbType IntegerType { get; }

        public SequenceOptions Options { get; }

        public bool Equals(SequenceDefinition other)
        {
            return other != null &&
                   Equals(Name, other.Name) &&
                   IntegerType == other.IntegerType &&
                   Equals(Options, other.Options);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SequenceDefinition);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = Name.GetHashCode();
                hashCode = (hashCode * 397) ^ (int)IntegerType;
                hashCode = (hashCode * 397) ^ Options.GetHashCode();
                return hashCode;
            }
        }
    }

    internal static class SchemaModelGuard
    {
        public static void RequireText(string value, string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(
                    "Value cannot be empty or whitespace.", parameterName);
            }
        }

        public static void RequireFingerprint(
            string value,
            string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            const string prefix = "sha256:";
            if (!value.StartsWith(prefix, StringComparison.Ordinal) ||
                value.Length != prefix.Length + 64)
            {
                throw new ArgumentException(
                    "Fingerprint must be sha256 followed by 64 lowercase hexadecimal characters.",
                    parameterName);
            }

            RequireLowerHex(
                value.Substring(prefix.Length), 64, parameterName);
        }

        public static void RequireLowerHex(
            string value,
            int length,
            string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            if (value.Length != length)
            {
                throw new ArgumentException(
                    "Value has an invalid digest length.", parameterName);
            }

            for (var index = 0; index < value.Length; index++)
            {
                var character = value[index];
                if (!((character >= '0' && character <= '9') ||
                      (character >= 'a' && character <= 'f')))
                {
                    throw new ArgumentException(
                        "Value must use lowercase hexadecimal characters.",
                        parameterName);
                }
            }
        }

        public static void RequireDefined<T>(T value, string parameterName)
            where T : struct
        {
            if (!Enum.IsDefined(typeof(T), value))
            {
                throw new ArgumentOutOfRangeException(
                    parameterName, "Enumeration value must be defined.");
            }
        }

        public static IReadOnlyList<SqlIdentifier> CopyUniqueIdentifiers(
            IEnumerable<SqlIdentifier> identifiers,
            string parameterName,
            bool allowEmpty)
        {
            var copy = SqlAstCollection.Copy(
                identifiers, parameterName, allowEmpty);
            RequireUnique(copy, item => item, parameterName);
            return copy;
        }

        public static void RequireUnique<TItem, TKey>(
            IReadOnlyList<TItem> items,
            Func<TItem, TKey> keySelector,
            string parameterName)
        {
            var seen = new HashSet<TKey>();
            foreach (var item in items)
            {
                if (!seen.Add(keySelector(item)))
                {
                    throw new ArgumentException(
                        "Collection cannot contain duplicate names.",
                        parameterName);
                }
            }
        }

        public static bool IsInteger(LogicalDbType logicalType)
        {
            return logicalType == LogicalDbType.Int16 ||
                   logicalType == LogicalDbType.Int32 ||
                   logicalType == LogicalDbType.Int64;
        }

        public static void RequireKnownDefault(
            ColumnDefaultDefinition definition,
            string parameterName)
        {
            if (definition == null ||
                definition is NullDefaultDefinition ||
                definition is BooleanDefaultDefinition ||
                definition is Int64DefaultDefinition ||
                definition is DecimalDefaultDefinition ||
                definition is StringDefaultDefinition ||
                definition is GuidDefaultDefinition ||
                definition is DateTimeDefaultDefinition ||
                definition is DateTimeOffsetDefaultDefinition ||
                definition is SemanticDefaultDefinition)
            {
                return;
            }

            throw new ArgumentException(
                "Column default must use the closed default-definition catalog.",
                parameterName);
        }

        public static void RequireKnownGeneration(
            ColumnGenerationDefinition definition,
            string parameterName)
        {
            if (definition == null ||
                definition is IdentityGenerationDefinition ||
                definition is SequenceGenerationDefinition ||
                definition is ComputedGenerationDefinition)
            {
                return;
            }

            throw new ArgumentException(
                "Column generation must use the closed generation-definition catalog.",
                parameterName);
        }

        public static void RequireKnownConstraint(
            ConstraintDefinition definition,
            string parameterName)
        {
            if (definition is PrimaryKeyDefinition ||
                definition is UniqueConstraintDefinition ||
                definition is ForeignKeyDefinition)
            {
                return;
            }

            throw new ArgumentException(
                "Constraint must use the closed constraint-definition catalog.",
                parameterName);
        }

        public static void RequireIntegerRange(
            long value,
            LogicalDbType logicalType,
            string parameterName)
        {
            var inRange = logicalType == LogicalDbType.Int64 ||
                          (logicalType == LogicalDbType.Int32 &&
                           value >= int.MinValue && value <= int.MaxValue) ||
                          (logicalType == LogicalDbType.Int16 &&
                           value >= short.MinValue && value <= short.MaxValue);
            if (!inRange)
            {
                throw new ArgumentOutOfRangeException(
                    parameterName,
                    "Integer value is outside the selected logical type range.");
            }
        }
    }

    internal static class SchemaModelEquality
    {
        public static bool SequenceEqual<T>(
            IReadOnlyList<T> left,
            IReadOnlyList<T> right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null || left.Count != right.Count)
            {
                return false;
            }

            var comparer = EqualityComparer<T>.Default;
            for (var index = 0; index < left.Count; index++)
            {
                if (!comparer.Equals(left[index], right[index]))
                {
                    return false;
                }
            }

            return true;
        }

        public static int AddSequenceHash<T>(
            int seed,
            IReadOnlyList<T> items)
        {
            unchecked
            {
                var hashCode = (seed * 397) ^ items.Count;
                var comparer = EqualityComparer<T>.Default;
                foreach (var item in items)
                {
                    hashCode = (hashCode * 397) ^
                               (item == null ? 0 : comparer.GetHashCode(item));
                }

                return hashCode;
            }
        }

        public static bool DecimalBitsEqual(decimal left, decimal right)
        {
            var leftBits = decimal.GetBits(left);
            var rightBits = decimal.GetBits(right);
            for (var index = 0; index < leftBits.Length; index++)
            {
                if (leftBits[index] != rightBits[index])
                {
                    return false;
                }
            }

            return true;
        }

        public static int DecimalBitsHash(decimal value)
        {
            unchecked
            {
                var hashCode = 17;
                foreach (var component in decimal.GetBits(value))
                {
                    hashCode = (hashCode * 397) ^ component;
                }

                return hashCode;
            }
        }
    }

    internal static class SchemaExpressionCatalog
    {
        // The root expression is depth zero. Depth 128 is accepted; the first
        // child at depth 129 is rejected before it is scheduled for traversal.
        private const int MaximumTraversalDepth = 128;

        // Repeated references count as repeated logical occurrences so a
        // compact shared DAG cannot expand into unbounded validation work.
        private const int MaximumTraversalOccurrences = 4096;

        public static void Validate(SqlExpression expression, string parameterName)
        {
            if (expression == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            var pending = new Stack<TraversalItem>();
            pending.Push(new TraversalItem(expression, 0));
            var occurrences = 0;
            while (pending.Count != 0)
            {
                var item = pending.Pop();
                occurrences++;
                if (occurrences > MaximumTraversalOccurrences)
                {
                    throw new ArgumentOutOfRangeException(
                        parameterName,
                        "Computed expression exceeds the maximum traversal occurrence count.");
                }

                if (item.Node is SqlExpression currentExpression)
                {
                    ScheduleExpressionChildren(
                        currentExpression,
                        item.Depth,
                        occurrences,
                        pending,
                        parameterName);
                    continue;
                }

                if (item.Node is SelectStatement select)
                {
                    ScheduleSelectChildren(
                        select,
                        item.Depth,
                        occurrences,
                        pending,
                        parameterName);
                    continue;
                }

                if (item.Node is SqlTableSource source)
                {
                    ScheduleTableSourceChildren(
                        source,
                        item.Depth,
                        occurrences,
                        pending,
                        parameterName);
                    continue;
                }

                ThrowUnknown(parameterName);
            }
        }

        private static void ScheduleExpressionChildren(
            SqlExpression expression,
            int depth,
            int visitedOccurrences,
            Stack<TraversalItem> pending,
            string parameterName)
        {
            if (expression is ColumnExpression ||
                expression is ParameterExpression ||
                expression is NullExpression ||
                expression is BooleanExpression ||
                expression is WildcardExpression)
            {
                return;
            }

            if (expression is BinaryExpression binary)
            {
                PushChild(
                    pending,
                    binary.Right,
                    depth,
                    visitedOccurrences,
                    parameterName);
                PushChild(
                    pending,
                    binary.Left,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is UnaryExpression unary)
            {
                PushChild(
                    pending,
                    unary.Operand,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is InExpression inExpression)
            {
                PushExpressionsReverse(
                    pending,
                    inExpression.Values,
                    depth,
                    visitedOccurrences,
                    parameterName);
                PushChild(
                    pending,
                    inExpression.Operand,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is BetweenExpression between)
            {
                PushChild(
                    pending,
                    between.Upper,
                    depth,
                    visitedOccurrences,
                    parameterName);
                PushChild(
                    pending,
                    between.Lower,
                    depth,
                    visitedOccurrences,
                    parameterName);
                PushChild(
                    pending,
                    between.Operand,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is CaseExpression caseExpression)
            {
                if (caseExpression.ElseExpression != null)
                {
                    PushChild(
                        pending,
                        caseExpression.ElseExpression,
                        depth,
                        visitedOccurrences,
                        parameterName);
                }

                for (var index = caseExpression.WhenClauses.Count - 1;
                     index >= 0;
                     index--)
                {
                    var clause = caseExpression.WhenClauses[index];
                    PushChild(
                        pending,
                        clause.Then,
                        depth,
                        visitedOccurrences,
                        parameterName);
                    PushChild(
                        pending,
                        clause.When,
                        depth,
                        visitedOccurrences,
                        parameterName);
                }

                if (caseExpression.InputExpression != null)
                {
                    PushChild(
                        pending,
                        caseExpression.InputExpression,
                        depth,
                        visitedOccurrences,
                        parameterName);
                }

                return;
            }

            if (expression is CastExpression cast)
            {
                PushChild(
                    pending,
                    cast.Expression,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is SubqueryExpression subquery)
            {
                if (!(subquery.Query is SelectStatement select))
                {
                    ThrowUnknown(parameterName);
                    return;
                }

                PushChild(
                    pending,
                    select,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is ExistsExpression exists)
            {
                PushChild(
                    pending,
                    exists.Subquery,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (expression is AggregateExpression aggregate)
            {
                if (aggregate.Argument != null)
                {
                    PushChild(
                        pending,
                        aggregate.Argument,
                        depth,
                        visitedOccurrences,
                        parameterName);
                }

                return;
            }

            if (expression is FunctionExpression function)
            {
                PushExpressionsReverse(
                    pending,
                    function.Arguments,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            ThrowUnknown(parameterName);
        }

        private static void PushExpressionsReverse(
            Stack<TraversalItem> pending,
            IReadOnlyList<SqlExpression> expressions,
            int parentDepth,
            int visitedOccurrences,
            string parameterName)
        {
            for (var index = expressions.Count - 1; index >= 0; index--)
            {
                PushChild(
                    pending,
                    expressions[index],
                    parentDepth,
                    visitedOccurrences,
                    parameterName);
            }
        }

        private static void ScheduleSelectChildren(
            SelectStatement select,
            int depth,
            int visitedOccurrences,
            Stack<TraversalItem> pending,
            string parameterName)
        {
            for (var index = select.SetOperations.Count - 1; index >= 0; index--)
            {
                PushChild(
                    pending,
                    select.SetOperations[index].RightQuery,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            for (var index = select.CommonTableExpressions.Count - 1;
                 index >= 0;
                 index--)
            {
                PushChild(
                    pending,
                    select.CommonTableExpressions[index].Query,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            if (select.Page is KeysetPageSpec keyset)
            {
                PushExpressionsReverse(
                    pending,
                    keyset.Boundaries,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }
            else if (select.Page != null && !(select.Page is OffsetPageSpec))
            {
                ThrowUnknown(parameterName);
            }

            for (var index = select.OrderBy.Count - 1; index >= 0; index--)
            {
                PushChild(
                    pending,
                    select.OrderBy[index].Expression,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            if (select.Having != null)
            {
                PushChild(
                    pending,
                    select.Having,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            PushExpressionsReverse(
                pending,
                select.GroupBy,
                depth,
                visitedOccurrences,
                parameterName);

            if (select.Where != null)
            {
                PushChild(
                    pending,
                    select.Where,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            for (var index = select.Projections.Count - 1; index >= 0; index--)
            {
                PushChild(
                    pending,
                    select.Projections[index].Expression,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }

            if (select.From != null)
            {
                PushChild(
                    pending,
                    select.From,
                    depth,
                    visitedOccurrences,
                    parameterName);
            }
        }

        private static void ScheduleTableSourceChildren(
            SqlTableSource source,
            int depth,
            int visitedOccurrences,
            Stack<TraversalItem> pending,
            string parameterName)
        {
            if (source is NamedTableSource)
            {
                return;
            }

            if (source is DerivedTableSource derived)
            {
                PushChild(
                    pending,
                    derived.Query,
                    depth,
                    visitedOccurrences,
                    parameterName);
                return;
            }

            if (source is JoinSource join)
            {
                if (join.Condition != null)
                {
                    PushChild(
                        pending,
                        join.Condition,
                        depth,
                        visitedOccurrences,
                        parameterName);
                }
                PushChild(
                    pending,
                    join.Right,
                    depth,
                    visitedOccurrences,
                    parameterName);
                PushChild(
                    pending,
                    join.Left,
                    depth,
                    visitedOccurrences,
                    parameterName);

                return;
            }

            ThrowUnknown(parameterName);
        }

        private static void PushChild(
            Stack<TraversalItem> pending,
            SqlNode child,
            int parentDepth,
            int visitedOccurrences,
            string parameterName)
        {
            var childDepth = parentDepth + 1;
            if (childDepth > MaximumTraversalDepth)
            {
                throw new ArgumentOutOfRangeException(
                    parameterName,
                    "Computed expression exceeds the maximum traversal depth.");
            }

            if (visitedOccurrences + pending.Count >=
                MaximumTraversalOccurrences)
            {
                throw new ArgumentOutOfRangeException(
                    parameterName,
                    "Computed expression exceeds the maximum traversal occurrence count.");
            }

            pending.Push(new TraversalItem(child, childDepth));
        }

        private static void ThrowUnknown(string parameterName)
        {
            throw new ArgumentException(
                "Computed expressions may contain only the closed SQL expression and SELECT query catalog.",
                parameterName);
        }

        private readonly struct TraversalItem
        {
            public TraversalItem(SqlNode node, int depth)
            {
                Node = node;
                Depth = depth;
            }

            public SqlNode Node { get; }

            public int Depth { get; }
        }
    }

    internal static class SchemaExpressionEquality
    {
        public static bool Equals(SqlExpression left, SqlExpression right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null || left.GetType() != right.GetType())
            {
                return false;
            }

            if (left is ColumnExpression leftColumn)
            {
                var rightColumn = (ColumnExpression)right;
                return object.Equals(leftColumn.Name, rightColumn.Name) &&
                       object.Equals(leftColumn.Source, rightColumn.Source);
            }

            if (left is ParameterExpression leftParameter)
            {
                return ParameterEquals(
                    leftParameter.Definition,
                    ((ParameterExpression)right).Definition);
            }

            if (left is NullExpression)
            {
                return true;
            }

            if (left is BooleanExpression leftBoolean)
            {
                return leftBoolean.Value == ((BooleanExpression)right).Value;
            }

            if (left is BinaryExpression leftBinary)
            {
                var rightBinary = (BinaryExpression)right;
                return leftBinary.Operator == rightBinary.Operator &&
                       Equals(leftBinary.Left, rightBinary.Left) &&
                       Equals(leftBinary.Right, rightBinary.Right);
            }

            if (left is UnaryExpression leftUnary)
            {
                var rightUnary = (UnaryExpression)right;
                return leftUnary.Operator == rightUnary.Operator &&
                       Equals(leftUnary.Operand, rightUnary.Operand);
            }

            if (left is InExpression leftIn)
            {
                var rightIn = (InExpression)right;
                return Equals(leftIn.Operand, rightIn.Operand) &&
                       ExpressionSequenceEqual(leftIn.Values, rightIn.Values);
            }

            if (left is BetweenExpression leftBetween)
            {
                var rightBetween = (BetweenExpression)right;
                return Equals(leftBetween.Operand, rightBetween.Operand) &&
                       Equals(leftBetween.Lower, rightBetween.Lower) &&
                       Equals(leftBetween.Upper, rightBetween.Upper);
            }

            if (left is CaseExpression leftCase)
            {
                var rightCase = (CaseExpression)right;
                if (!Equals(leftCase.InputExpression, rightCase.InputExpression) ||
                    !Equals(leftCase.ElseExpression, rightCase.ElseExpression) ||
                    leftCase.WhenClauses.Count != rightCase.WhenClauses.Count)
                {
                    return false;
                }

                for (var index = 0;
                     index < leftCase.WhenClauses.Count;
                     index++)
                {
                    var leftClause = leftCase.WhenClauses[index];
                    var rightClause = rightCase.WhenClauses[index];
                    if (!Equals(leftClause.When, rightClause.When) ||
                        !Equals(leftClause.Then, rightClause.Then))
                    {
                        return false;
                    }
                }

                return true;
            }

            if (left is CastExpression leftCast)
            {
                var rightCast = (CastExpression)right;
                return Equals(leftCast.Expression, rightCast.Expression) &&
                       object.Equals(leftCast.Type, rightCast.Type);
            }

            if (left is SubqueryExpression leftSubquery)
            {
                return SelectEquals(
                    (SelectStatement)leftSubquery.Query,
                    (SelectStatement)((SubqueryExpression)right).Query);
            }

            if (left is ExistsExpression leftExists)
            {
                return Equals(
                    leftExists.Subquery,
                    ((ExistsExpression)right).Subquery);
            }

            if (left is AggregateExpression leftAggregate)
            {
                var rightAggregate = (AggregateExpression)right;
                return SemanticFunctionEquals(
                           leftAggregate.Function,
                           rightAggregate.Function) &&
                       Equals(leftAggregate.Argument, rightAggregate.Argument) &&
                       leftAggregate.Distinct == rightAggregate.Distinct;
            }

            if (left is FunctionExpression leftFunction)
            {
                var rightFunction = (FunctionExpression)right;
                return SemanticFunctionEquals(
                           leftFunction.Function,
                           rightFunction.Function) &&
                       ExpressionSequenceEqual(
                           leftFunction.Arguments,
                           rightFunction.Arguments);
            }

            if (left is WildcardExpression leftWildcard)
            {
                return object.Equals(
                    leftWildcard.Source,
                    ((WildcardExpression)right).Source);
            }

            throw new InvalidOperationException(
                "Unknown expression reached structural equality.");
        }

        public static int GetHashCode(SqlExpression expression)
        {
            if (expression == null)
            {
                return 0;
            }

            unchecked
            {
                if (expression is ColumnExpression column)
                {
                    var hash = 101;
                    hash = Combine(hash, column.Name.GetHashCode());
                    return Combine(
                        hash,
                        column.Source == null ? 0 : column.Source.GetHashCode());
                }

                if (expression is ParameterExpression parameter)
                {
                    return Combine(
                        102, ParameterHash(parameter.Definition));
                }

                if (expression is NullExpression)
                {
                    return 103;
                }

                if (expression is BooleanExpression boolean)
                {
                    return Combine(104, boolean.Value ? 1 : 0);
                }

                if (expression is BinaryExpression binary)
                {
                    var hash = Combine(105, GetHashCode(binary.Left));
                    hash = Combine(hash, (int)binary.Operator);
                    return Combine(hash, GetHashCode(binary.Right));
                }

                if (expression is UnaryExpression unary)
                {
                    var hash = Combine(106, (int)unary.Operator);
                    return Combine(hash, GetHashCode(unary.Operand));
                }

                if (expression is InExpression inExpression)
                {
                    var hash = Combine(107, GetHashCode(inExpression.Operand));
                    return AddExpressionSequenceHash(hash, inExpression.Values);
                }

                if (expression is BetweenExpression between)
                {
                    var hash = Combine(108, GetHashCode(between.Operand));
                    hash = Combine(hash, GetHashCode(between.Lower));
                    return Combine(hash, GetHashCode(between.Upper));
                }

                if (expression is CaseExpression caseExpression)
                {
                    var hash = Combine(
                        109, GetHashCode(caseExpression.InputExpression));
                    hash = Combine(hash, caseExpression.WhenClauses.Count);
                    foreach (var clause in caseExpression.WhenClauses)
                    {
                        hash = Combine(hash, GetHashCode(clause.When));
                        hash = Combine(hash, GetHashCode(clause.Then));
                    }

                    return Combine(
                        hash, GetHashCode(caseExpression.ElseExpression));
                }

                if (expression is CastExpression cast)
                {
                    var hash = Combine(110, GetHashCode(cast.Expression));
                    return Combine(hash, cast.Type.GetHashCode());
                }

                if (expression is SubqueryExpression subquery)
                {
                    return Combine(
                        111, SelectHash((SelectStatement)subquery.Query));
                }

                if (expression is ExistsExpression exists)
                {
                    return Combine(112, GetHashCode(exists.Subquery));
                }

                if (expression is AggregateExpression aggregate)
                {
                    var hash = Combine(
                        113, SemanticFunctionHash(aggregate.Function));
                    hash = Combine(hash, GetHashCode(aggregate.Argument));
                    return Combine(hash, aggregate.Distinct ? 1 : 0);
                }

                if (expression is FunctionExpression function)
                {
                    var hash = Combine(
                        114, SemanticFunctionHash(function.Function));
                    return AddExpressionSequenceHash(hash, function.Arguments);
                }

                if (expression is WildcardExpression wildcard)
                {
                    return Combine(
                        115,
                        wildcard.Source == null
                            ? 0
                            : wildcard.Source.GetHashCode());
                }
            }

            throw new InvalidOperationException(
                "Unknown expression reached structural hashing.");
        }

        private static bool SelectEquals(
            SelectStatement left,
            SelectStatement right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null ||
                left.Distinct != right.Distinct ||
                !TableSourceEquals(left.From, right.From) ||
                !ProjectionSequenceEqual(left.Projections, right.Projections) ||
                !Equals(left.Where, right.Where) ||
                !ExpressionSequenceEqual(left.GroupBy, right.GroupBy) ||
                !Equals(left.Having, right.Having) ||
                !OrderSequenceEqual(left.OrderBy, right.OrderBy) ||
                !PageEquals(left.Page, right.Page) ||
                !LockEquals(left.Lock, right.Lock) ||
                !CommonTableExpressionSequenceEqual(
                    left.CommonTableExpressions,
                    right.CommonTableExpressions) ||
                !SetOperationSequenceEqual(
                    left.SetOperations,
                    right.SetOperations))
            {
                return false;
            }

            return true;
        }

        private static int SelectHash(SelectStatement select)
        {
            var hash = 201;
            hash = Combine(hash, TableSourceHash(select.From));
            hash = AddProjectionSequenceHash(hash, select.Projections);
            hash = Combine(hash, select.Distinct ? 1 : 0);
            hash = Combine(hash, GetHashCode(select.Where));
            hash = AddExpressionSequenceHash(hash, select.GroupBy);
            hash = Combine(hash, GetHashCode(select.Having));
            hash = AddOrderSequenceHash(hash, select.OrderBy);
            hash = Combine(hash, PageHash(select.Page));
            hash = Combine(hash, LockHash(select.Lock));
            hash = AddCommonTableExpressionSequenceHash(
                hash, select.CommonTableExpressions);
            return AddSetOperationSequenceHash(hash, select.SetOperations);
        }

        private static bool TableSourceEquals(
            SqlTableSource left,
            SqlTableSource right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null || left.GetType() != right.GetType())
            {
                return false;
            }

            if (left is NamedTableSource leftNamed)
            {
                var rightNamed = (NamedTableSource)right;
                return object.Equals(leftNamed.Name, rightNamed.Name) &&
                       object.Equals(leftNamed.Alias, rightNamed.Alias);
            }

            if (left is DerivedTableSource leftDerived)
            {
                var rightDerived = (DerivedTableSource)right;
                return SelectEquals(leftDerived.Query, rightDerived.Query) &&
                       object.Equals(leftDerived.Alias, rightDerived.Alias);
            }

            if (left is JoinSource leftJoin)
            {
                var rightJoin = (JoinSource)right;
                return leftJoin.JoinType == rightJoin.JoinType &&
                       TableSourceEquals(leftJoin.Left, rightJoin.Left) &&
                       TableSourceEquals(leftJoin.Right, rightJoin.Right) &&
                       Equals(leftJoin.Condition, rightJoin.Condition);
            }

            throw new InvalidOperationException(
                "Unknown table source reached structural equality.");
        }

        private static int TableSourceHash(SqlTableSource source)
        {
            if (source == null)
            {
                return 0;
            }

            if (source is NamedTableSource named)
            {
                var hash = Combine(301, named.Name.GetHashCode());
                return Combine(
                    hash, named.Alias == null ? 0 : named.Alias.GetHashCode());
            }

            if (source is DerivedTableSource derived)
            {
                var hash = Combine(302, SelectHash(derived.Query));
                return Combine(hash, derived.Alias.GetHashCode());
            }

            if (source is JoinSource join)
            {
                var hash = Combine(303, TableSourceHash(join.Left));
                hash = Combine(hash, (int)join.JoinType);
                hash = Combine(hash, TableSourceHash(join.Right));
                return Combine(hash, GetHashCode(join.Condition));
            }

            throw new InvalidOperationException(
                "Unknown table source reached structural hashing.");
        }

        private static bool ProjectionSequenceEqual(
            IReadOnlyList<SelectProjection> left,
            IReadOnlyList<SelectProjection> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var index = 0; index < left.Count; index++)
            {
                if (!Equals(left[index].Expression, right[index].Expression) ||
                    !object.Equals(left[index].Alias, right[index].Alias))
                {
                    return false;
                }
            }

            return true;
        }

        private static int AddProjectionSequenceHash(
            int seed,
            IReadOnlyList<SelectProjection> projections)
        {
            var hash = Combine(seed, projections.Count);
            foreach (var projection in projections)
            {
                hash = Combine(hash, GetHashCode(projection.Expression));
                hash = Combine(
                    hash,
                    projection.Alias == null
                        ? 0
                        : projection.Alias.GetHashCode());
            }

            return hash;
        }

        private static bool ExpressionSequenceEqual(
            IReadOnlyList<SqlExpression> left,
            IReadOnlyList<SqlExpression> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var index = 0; index < left.Count; index++)
            {
                if (!Equals(left[index], right[index]))
                {
                    return false;
                }
            }

            return true;
        }

        private static int AddExpressionSequenceHash(
            int seed,
            IReadOnlyList<SqlExpression> expressions)
        {
            var hash = Combine(seed, expressions.Count);
            foreach (var expression in expressions)
            {
                hash = Combine(hash, GetHashCode(expression));
            }

            return hash;
        }

        private static bool OrderSequenceEqual(
            IReadOnlyList<OrderByExpression> left,
            IReadOnlyList<OrderByExpression> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var index = 0; index < left.Count; index++)
            {
                if (!Equals(left[index].Expression, right[index].Expression) ||
                    left[index].Direction != right[index].Direction ||
                    left[index].NullSortOrder != right[index].NullSortOrder)
                {
                    return false;
                }
            }

            return true;
        }

        private static int AddOrderSequenceHash(
            int seed,
            IReadOnlyList<OrderByExpression> expressions)
        {
            var hash = Combine(seed, expressions.Count);
            foreach (var expression in expressions)
            {
                hash = Combine(hash, GetHashCode(expression.Expression));
                hash = Combine(hash, (int)expression.Direction);
                hash = Combine(hash, (int)expression.NullSortOrder);
            }

            return hash;
        }

        private static bool PageEquals(PageSpec left, PageSpec right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null || left.GetType() != right.GetType())
            {
                return false;
            }

            if (left is OffsetPageSpec leftOffset)
            {
                var rightOffset = (OffsetPageSpec)right;
                return leftOffset.Offset == rightOffset.Offset &&
                       leftOffset.Limit == rightOffset.Limit;
            }

            if (left is KeysetPageSpec leftKeyset)
            {
                var rightKeyset = (KeysetPageSpec)right;
                return leftKeyset.Limit == rightKeyset.Limit &&
                       ExpressionSequenceEqual(
                           leftKeyset.Boundaries,
                           rightKeyset.Boundaries);
            }

            throw new InvalidOperationException(
                "Unknown page specification reached structural equality.");
        }

        private static int PageHash(PageSpec page)
        {
            if (page == null)
            {
                return 0;
            }

            if (page is OffsetPageSpec offset)
            {
                return Combine(401, Combine(offset.Offset, offset.Limit));
            }

            if (page is KeysetPageSpec keyset)
            {
                return Combine(
                    AddExpressionSequenceHash(402, keyset.Boundaries),
                    keyset.Limit);
            }

            throw new InvalidOperationException(
                "Unknown page specification reached structural hashing.");
        }

        private static bool LockEquals(LockSpec left, LockSpec right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            return left != null && right != null &&
                   left.Mode == right.Mode && left.Wait == right.Wait;
        }

        private static int LockHash(LockSpec lockSpec)
        {
            return lockSpec == null
                ? 0
                : Combine(501, Combine((int)lockSpec.Mode, (int)lockSpec.Wait));
        }

        private static bool CommonTableExpressionSequenceEqual(
            IReadOnlyList<CommonTableExpression> left,
            IReadOnlyList<CommonTableExpression> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var index = 0; index < left.Count; index++)
            {
                if (!object.Equals(left[index].Name, right[index].Name) ||
                    !SelectEquals(left[index].Query, right[index].Query) ||
                    !SchemaModelEquality.SequenceEqual(
                        left[index].Columns,
                        right[index].Columns) ||
                    left[index].Recursive != right[index].Recursive)
                {
                    return false;
                }
            }

            return true;
        }

        private static int AddCommonTableExpressionSequenceHash(
            int seed,
            IReadOnlyList<CommonTableExpression> expressions)
        {
            var hash = Combine(seed, expressions.Count);
            foreach (var expression in expressions)
            {
                hash = Combine(hash, expression.Name.GetHashCode());
                hash = Combine(hash, SelectHash(expression.Query));
                hash = SchemaModelEquality.AddSequenceHash(
                    hash, expression.Columns);
                hash = Combine(hash, expression.Recursive ? 1 : 0);
            }

            return hash;
        }

        private static bool SetOperationSequenceEqual(
            IReadOnlyList<SetOperationClause> left,
            IReadOnlyList<SetOperationClause> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var index = 0; index < left.Count; index++)
            {
                if (left[index].Operator != right[index].Operator ||
                    !SelectEquals(
                        left[index].RightQuery,
                        right[index].RightQuery))
                {
                    return false;
                }
            }

            return true;
        }

        private static int AddSetOperationSequenceHash(
            int seed,
            IReadOnlyList<SetOperationClause> operations)
        {
            var hash = Combine(seed, operations.Count);
            foreach (var operation in operations)
            {
                hash = Combine(hash, (int)operation.Operator);
                hash = Combine(hash, SelectHash(operation.RightQuery));
            }

            return hash;
        }

        private static bool ParameterEquals(
            ParameterDefinition left,
            ParameterDefinition right)
        {
            return ReferenceEquals(left, right) ||
                   (left != null && right != null &&
                    string.Equals(
                        left.Name, right.Name, StringComparison.Ordinal) &&
                    object.Equals(left.Type, right.Type) &&
                    left.Direction == right.Direction &&
                    left.IsNullable == right.IsNullable);
        }

        private static int ParameterHash(ParameterDefinition parameter)
        {
            unchecked
            {
                var hash = StringComparer.Ordinal.GetHashCode(parameter.Name);
                hash = Combine(hash, parameter.Type.GetHashCode());
                hash = Combine(hash, (int)parameter.Direction);
                return Combine(hash, parameter.IsNullable ? 1 : 0);
            }
        }

        private static bool SemanticFunctionEquals(
            SemanticFunctionId left,
            SemanticFunctionId right)
        {
            return ReferenceEquals(left, right) ||
                   (left != null && right != null &&
                    string.Equals(left.Key, right.Key, StringComparison.Ordinal) &&
                    left.MinArguments == right.MinArguments &&
                    left.MaxArguments == right.MaxArguments &&
                    left.IsAggregate == right.IsAggregate);
        }

        private static int SemanticFunctionHash(SemanticFunctionId function)
        {
            unchecked
            {
                var hash = StringComparer.Ordinal.GetHashCode(function.Key);
                hash = Combine(hash, function.MinArguments);
                hash = Combine(hash, function.MaxArguments.GetHashCode());
                return Combine(hash, function.IsAggregate ? 1 : 0);
            }
        }

        private static int Combine(int left, int right)
        {
            unchecked
            {
                return (left * 397) ^ right;
            }
        }
    }
}
