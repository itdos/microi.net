using System;
using System.Collections.Generic;
using System.Data;

namespace Dos.ORM.SqlAst
{
    public sealed class ParameterDefinition
    {
        public ParameterDefinition(
            string name,
            SqlTypeDescriptor type,
            ParameterDirection direction = ParameterDirection.Input,
            bool isNullable = true)
        {
            ParameterNameRules.Validate(name, nameof(name));
            Type = type ?? throw new ArgumentNullException(nameof(type));
            Name = name;
            Direction = direction;
            IsNullable = isNullable;
        }

        public string Name { get; }

        public SqlTypeDescriptor Type { get; }

        public ParameterDirection Direction { get; }

        public bool IsNullable { get; }
    }

    public sealed class ParameterBag
    {
        private readonly Dictionary<string, object> _values;

        public ParameterBag()
            : this(new Dictionary<string, object>(StringComparer.Ordinal))
        {
        }

        private ParameterBag(Dictionary<string, object> values)
        {
            _values = values;
        }

        public int Count => _values.Count;

        public object this[string name]
        {
            get
            {
                ParameterNameRules.Validate(name, nameof(name));
                return _values[name];
            }
        }

        public ParameterBag Add(string name, object value)
        {
            ParameterNameRules.Validate(name, nameof(name));
            if (_values.ContainsKey(name))
            {
                throw new ArgumentException(
                    "A value already exists for the logical parameter name.",
                    nameof(name));
            }

            var copy = new Dictionary<string, object>(_values, StringComparer.Ordinal)
            {
                { name, value }
            };
            return new ParameterBag(copy);
        }

        public bool Contains(string name)
        {
            ParameterNameRules.Validate(name, nameof(name));
            return _values.ContainsKey(name);
        }

        public bool TryGetValue(string name, out object value)
        {
            ParameterNameRules.Validate(name, nameof(name));
            return _values.TryGetValue(name, out value);
        }
    }

    public sealed class BoundParameter
    {
        public BoundParameter(
            ParameterDefinition definition,
            string placeholder,
            object value)
        {
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
            ValidatePlaceholder(placeholder);

            if (value == null && !definition.IsNullable && IsInput(direction: definition.Direction))
            {
                throw new ArgumentException(
                    "A non-null runtime value is required for a non-nullable input parameter.",
                    nameof(value));
            }

            Placeholder = placeholder;
            Value = value;
        }

        public ParameterDefinition Definition { get; }

        public string Name => Definition.Name;

        public SqlTypeDescriptor Type => Definition.Type;

        public LogicalDbType LogicalType => Definition.Type.LogicalType;

        public int? Length => Definition.Type.Length;

        public int? Precision => Definition.Type.Precision;

        public int? Scale => Definition.Type.Scale;

        public ParameterDirection Direction => Definition.Direction;

        public bool IsNullable => Definition.IsNullable;

        public string Placeholder { get; }

        public object Value { get; }

        public override string ToString()
        {
            return Placeholder + " (" + Name + ": " + Type.LogicalType + ")";
        }

        private static bool IsInput(ParameterDirection direction)
        {
            return direction == ParameterDirection.Input ||
                   direction == ParameterDirection.InputOutput;
        }

        private static void ValidatePlaceholder(string placeholder)
        {
            if (placeholder == null)
            {
                throw new ArgumentNullException(nameof(placeholder));
            }

            if (string.IsNullOrWhiteSpace(placeholder))
            {
                throw new ArgumentException(
                    "Compiled placeholder cannot be empty.", nameof(placeholder));
            }

            for (var i = 0; i < placeholder.Length; i++)
            {
                if (char.IsControl(placeholder[i]))
                {
                    throw new ArgumentException(
                        "Compiled placeholder cannot contain control characters.",
                        nameof(placeholder));
                }
            }
        }
    }

    internal static class ParameterNameRules
    {
        public static void Validate(string name, string parameterName)
        {
            if (name == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException(
                    "Logical parameter name cannot be empty.", parameterName);
            }

            var first = name[0];
            if (first == '@' || first == ':' || first == '?')
            {
                throw new ArgumentException(
                    "Logical parameter name cannot use a provider placeholder prefix.",
                    parameterName);
            }

            for (var i = 0; i < name.Length; i++)
            {
                if (char.IsControl(name[i]))
                {
                    throw new ArgumentException(
                        "Logical parameter name cannot contain control characters.",
                        parameterName);
                }
            }
        }
    }
}
