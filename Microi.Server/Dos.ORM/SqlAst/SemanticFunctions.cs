using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dos.ORM.SqlAst
{
    public sealed class SemanticFunctionId : IEquatable<SemanticFunctionId>
    {
        internal SemanticFunctionId(
            string key,
            int minArguments,
            int? maxArguments,
            bool isAggregate)
        {
            if (key == null)
            {
                throw new ArgumentNullException(nameof(key));
            }

            if (string.IsNullOrWhiteSpace(key))
            {
                throw new ArgumentException(
                    "Semantic function key cannot be empty.", nameof(key));
            }

            if (minArguments < 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(minArguments), "Minimum argument count cannot be negative.");
            }

            if (maxArguments.HasValue && maxArguments.Value < minArguments)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(maxArguments),
                    "Maximum argument count cannot be less than the minimum.");
            }

            Key = key;
            MinArguments = minArguments;
            MaxArguments = maxArguments;
            IsAggregate = isAggregate;
        }

        public string Key { get; }

        public int MinArguments { get; }

        public int? MaxArguments { get; }

        public bool IsAggregate { get; }

        public bool Equals(SemanticFunctionId other)
        {
            return other != null &&
                   string.Equals(Key, other.Key, StringComparison.Ordinal);
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as SemanticFunctionId);
        }

        public override int GetHashCode()
        {
            return StringComparer.Ordinal.GetHashCode(Key);
        }

        public override string ToString()
        {
            return Key;
        }
    }

    public static class SemanticFunctions
    {
        private static readonly IReadOnlyList<SemanticFunctionId> Catalog;
        private static readonly Dictionary<string, SemanticFunctionId> ByKey;

        static SemanticFunctions()
        {
            Concat = new SemanticFunctionId("Concat", 1, null, false);
            Substring = new SemanticFunctionId("Substring", 2, 3, false);
            Length = new SemanticFunctionId("Length", 1, 1, false);
            CurrentDateTime = new SemanticFunctionId("CurrentDateTime", 0, 0, false);
            DateAdd = new SemanticFunctionId("DateAdd", 3, 3, false);
            DateDiff = new SemanticFunctionId("DateDiff", 3, 3, false);
            Coalesce = new SemanticFunctionId("Coalesce", 2, null, false);
            Round = new SemanticFunctionId("Round", 1, 2, false);
            JsonValue = new SemanticFunctionId("JsonValue", 2, 2, false);
            Count = new SemanticFunctionId("Count", 0, 1, true);
            Sum = new SemanticFunctionId("Sum", 1, 1, true);
            Avg = new SemanticFunctionId("Avg", 1, 1, true);
            Min = new SemanticFunctionId("Min", 1, 1, true);
            Max = new SemanticFunctionId("Max", 1, 1, true);

            var functions = new[]
            {
                Concat,
                Substring,
                Length,
                CurrentDateTime,
                DateAdd,
                DateDiff,
                Coalesce,
                Round,
                JsonValue,
                Count,
                Sum,
                Avg,
                Min,
                Max
            };
            ByKey = new Dictionary<string, SemanticFunctionId>(StringComparer.Ordinal);
            foreach (var function in functions)
            {
                if (ByKey.ContainsKey(function.Key))
                {
                    throw new InvalidOperationException(
                        "Semantic function keys must be unique.");
                }

                ByKey.Add(function.Key, function);
            }

            Catalog = new ReadOnlyCollection<SemanticFunctionId>(functions);
        }

        public static SemanticFunctionId Concat { get; }

        public static SemanticFunctionId Substring { get; }

        public static SemanticFunctionId Length { get; }

        public static SemanticFunctionId CurrentDateTime { get; }

        public static SemanticFunctionId DateAdd { get; }

        public static SemanticFunctionId DateDiff { get; }

        public static SemanticFunctionId Coalesce { get; }

        public static SemanticFunctionId Round { get; }

        public static SemanticFunctionId JsonValue { get; }

        public static SemanticFunctionId Count { get; }

        public static SemanticFunctionId Sum { get; }

        public static SemanticFunctionId Avg { get; }

        public static SemanticFunctionId Min { get; }

        public static SemanticFunctionId Max { get; }

        public static IReadOnlyList<SemanticFunctionId> All => Catalog;

        public static bool TryGet(string key, out SemanticFunctionId function)
        {
            if (key == null)
            {
                throw new ArgumentNullException(nameof(key));
            }

            return ByKey.TryGetValue(key, out function);
        }

        internal static bool IsRegistered(SemanticFunctionId function)
        {
            if (function == null)
            {
                return false;
            }

            return ByKey.TryGetValue(function.Key, out var registered) &&
                   ReferenceEquals(registered, function);
        }
    }
}
