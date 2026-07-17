using System;

namespace Dos.ORM.SqlAst
{
    public sealed class SqlIdentifier : IEquatable<SqlIdentifier>
    {
        public SqlIdentifier(string value)
        {
            if (value == null)
            {
                throw new ArgumentNullException(nameof(value));
            }

            if (string.IsNullOrWhiteSpace(value) ||
                string.Equals(value, "*", StringComparison.Ordinal) ||
                ContainsInvalidCharacter(value))
            {
                throw new ArgumentException(
                    "Identifier must be one non-empty, unquoted segment.",
                    nameof(value));
            }

            Value = value;
        }

        public string Value { get; }

        public bool Equals(SqlIdentifier other)
        {
            return other != null &&
                   string.Equals(Value, other.Value, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SqlIdentifier);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Value);
        }

        public override string ToString()
        {
            return Value;
        }

        private static bool ContainsInvalidCharacter(string value)
        {
            for (var i = 0; i < value.Length; i++)
            {
                var character = value[i];
                if (character == '.' || character == '`' ||
                    character == '[' || character == ']' ||
                    character == '"' || char.IsControl(character))
                {
                    return true;
                }
            }

            return false;
        }
    }

    public sealed class SqlObjectName : IEquatable<SqlObjectName>
    {
        public SqlObjectName(SqlIdentifier name)
            : this(null, null, name)
        {
        }

        public SqlObjectName(
            SqlIdentifier catalog,
            SqlIdentifier schema,
            SqlIdentifier name)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Catalog = catalog;
            Schema = schema;
        }

        public SqlIdentifier Catalog { get; }

        public SqlIdentifier Schema { get; }

        public SqlIdentifier Name { get; }

        public bool Equals(SqlObjectName other)
        {
            return other != null &&
                   Equals(Catalog, other.Catalog) &&
                   Equals(Schema, other.Schema) &&
                   Equals(Name, other.Name);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SqlObjectName);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hashCode = Catalog == null ? 0 : Catalog.GetHashCode();
                hashCode = (hashCode * 397) ^ (Schema == null ? 0 : Schema.GetHashCode());
                hashCode = (hashCode * 397) ^ Name.GetHashCode();
                return hashCode;
            }
        }
    }

    public sealed class SqlAlias : IEquatable<SqlAlias>
    {
        public SqlAlias(string value)
            : this(new SqlIdentifier(value))
        {
        }

        public SqlAlias(SqlIdentifier identifier)
        {
            Identifier = identifier ?? throw new ArgumentNullException(nameof(identifier));
        }

        public SqlIdentifier Identifier { get; }

        public bool Equals(SqlAlias other)
        {
            return other != null && Equals(Identifier, other.Identifier);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SqlAlias);
        }

        public override int GetHashCode()
        {
            return Identifier.GetHashCode();
        }

        public override string ToString()
        {
            return Identifier.ToString();
        }
    }
}
