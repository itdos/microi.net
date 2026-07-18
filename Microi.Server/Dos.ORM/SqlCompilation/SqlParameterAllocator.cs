using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Data;
using System.Globalization;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    public sealed class SqlParameterSlot
    {
        internal SqlParameterSlot(
            int ordinal,
            string placeholder,
            ParameterDefinition definition)
        {
            if (ordinal < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(ordinal));
            }
            if (definition == null)
            {
                throw new ArgumentNullException(nameof(definition));
            }
            if (placeholder == null)
            {
                throw new ArgumentNullException(nameof(placeholder));
            }
            if (!string.Equals(
                placeholder,
                FormatPlaceholder(ordinal),
                StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Parameter slot placeholder must match its ordinal.",
                    nameof(placeholder));
            }

            Ordinal = ordinal;
            Placeholder = placeholder;
            Definition = definition;
        }

        public int Ordinal { get; }

        public string Placeholder { get; }

        public ParameterDefinition Definition { get; }

        private static string FormatPlaceholder(int ordinal)
        {
            return "p" + ordinal.ToString(CultureInfo.InvariantCulture);
        }
    }

    public sealed class SqlParameterAllocator
    {
        public IReadOnlyList<SqlParameterSlot> Allocate(SqlNode root)
        {
            if (root == null)
            {
                throw new ArgumentNullException(nameof(root));
            }

            var context = new AllocationContext();

            SqlAstTraversal.Walk(
                root,
                "$",
                context.Session,
                context.Visit,
                context.RejectTraversalIssue,
                reportTerminalIssue: true,
                reportMissingRequiredChild:
                    context.RejectMissingRequiredChild);

            return context.CreateSnapshot();
        }

        public IReadOnlyList<BoundParameter> Bind(
            IReadOnlyList<SqlParameterSlot> slots,
            ParameterBag values)
        {
            if (slots == null)
            {
                throw new ArgumentNullException(nameof(slots));
            }
            if (values == null)
            {
                throw new ArgumentNullException(nameof(values));
            }

            var slotSnapshot = SnapshotAndValidateSlots(slots);
            var bound = new List<BoundParameter>(slotSnapshot.Length);
            var presentCount = 0;

            for (var index = 0; index < slotSnapshot.Length; index++)
            {
                var slot = slotSnapshot[index];
                object runtimeValue;
                if (values.TryGetValue(
                    slot.Definition.Name, out runtimeValue))
                {
                    presentCount++;
                }
                else if (slot.Definition.Direction ==
                         ParameterDirection.Output ||
                         slot.Definition.Direction ==
                         ParameterDirection.ReturnValue)
                {
                    runtimeValue = null;
                }
                else
                {
                    throw new ArgumentException(
                        "ParameterBag is missing a required input value.",
                        nameof(values));
                }

                bound.Add(new BoundParameter(
                    slot.Definition,
                    slot.Placeholder,
                    runtimeValue));
            }

            if (presentCount != values.Count)
            {
                throw new ArgumentException(
                    "ParameterBag contains an unreferenced value.",
                    nameof(values));
            }

            return new ReadOnlyCollection<BoundParameter>(
                bound.ToArray());
        }

        private static SqlParameterSlot[] SnapshotAndValidateSlots(
            IReadOnlyList<SqlParameterSlot> slots)
        {
            var count = slots.Count;
            var snapshot = new SqlParameterSlot[count];
            for (var index = 0; index < count; index++)
            {
                snapshot[index] = slots[index];
            }

            var names = new HashSet<string>(StringComparer.Ordinal);
            for (var index = 0; index < snapshot.Length; index++)
            {
                var slot = snapshot[index];
                if (slot == null ||
                    slot.Ordinal != index ||
                    !string.Equals(
                        slot.Placeholder,
                        FormatPlaceholder(index),
                        StringComparison.Ordinal) ||
                    !IsValidDefinition(slot.Definition) ||
                    !names.Add(slot.Definition.Name))
                {
                    throw InvalidSlotSnapshot();
                }
            }
            return snapshot;
        }

        private static bool IsValidDefinition(
            ParameterDefinition definition)
        {
            if (definition == null ||
                !IsValidParameterName(definition.Name) ||
                !IsValidType(definition.Type) ||
                !Enum.IsDefined(
                    typeof(ParameterDirection), definition.Direction))
            {
                return false;
            }
            return true;
        }

        private static bool IsValidParameterName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return false;
            }
            var first = name[0];
            if (first == '@' || first == ':' || first == '?')
            {
                return false;
            }
            for (var index = 0; index < name.Length; index++)
            {
                if (char.IsControl(name[index]))
                {
                    return false;
                }
            }
            return true;
        }

        private static bool IsValidType(SqlTypeDescriptor type)
        {
            return type != null &&
                   Enum.IsDefined(
                       typeof(LogicalDbType), type.LogicalType) &&
                   (!type.Length.HasValue || type.Length.Value > 0) &&
                   (!type.Precision.HasValue ||
                    type.Precision.Value > 0) &&
                   (!type.Scale.HasValue || type.Scale.Value >= 0) &&
                   (!type.Scale.HasValue || type.Precision.HasValue) &&
                   (!type.Scale.HasValue ||
                    type.Scale.Value <= type.Precision.Value);
        }

        private static bool DefinitionsEqual(
            ParameterDefinition left,
            ParameterDefinition right)
        {
            return left != null && right != null &&
                   Equals(left.Type, right.Type) &&
                   left.Direction == right.Direction &&
                   left.IsNullable == right.IsNullable;
        }

        private static string FormatPlaceholder(int ordinal)
        {
            return "p" + ordinal.ToString(CultureInfo.InvariantCulture);
        }

        private static ArgumentException InvalidSlotSnapshot()
        {
            return new ArgumentException(
                "Parameter slot snapshot is invalid.",
                "slots");
        }

        private static Exception CreateTraversalException(
            SqlAstTraversalIssue issue)
        {
            switch (issue.Kind)
            {
                case SqlAstTraversalIssueKind.UnknownNode:
                    return new ArgumentException(
                        "SQL AST contains an unknown node subtype.",
                        "root");
                case SqlAstTraversalIssueKind.DepthExceeded:
                    return new ArgumentOutOfRangeException(
                        "root",
                        "SQL AST traversal exceeds maximum depth 128.");
                case SqlAstTraversalIssueKind.NodeLimitExceeded:
                    return new ArgumentOutOfRangeException(
                        "root",
                        "SQL AST traversal exceeds maximum node occurrence count 4096.");
                case SqlAstTraversalIssueKind.CollectionSlotLimitExceeded:
                    return new ArgumentOutOfRangeException(
                        "root",
                        "SQL AST traversal exceeds maximum collection slot inspection count 16384.");
                default:
                    throw new InvalidOperationException(
                        "SQL AST traversal reported an undefined issue kind.");
            }
        }

        private sealed class AllocationContext
        {
            private readonly List<SqlParameterSlot> slots =
                new List<SqlParameterSlot>();
            private readonly Dictionary<string, SqlParameterSlot> firstByName =
                new Dictionary<string, SqlParameterSlot>(StringComparer.Ordinal);

            internal AllocationContext()
            {
                Session = new SqlAstInspectionSession();
            }

            internal SqlAstInspectionSession Session { get; }

            internal void Visit(SqlAstOccurrence occurrence)
            {
                SqlAstTraversal.ObserveRetainedCollectionsForAllocation(
                    occurrence,
                    Session.Ledger,
                    RejectTraversalIssue,
                    RejectMissingRequiredChild);

                if (!(occurrence.Node is ParameterExpression parameter))
                {
                    return;
                }

                var definition = parameter.Definition;
                if (definition == null ||
                    definition.Name == null ||
                    definition.Type == null)
                {
                    RejectMissingRequiredChild(
                        occurrence.Path + ".Definition");
                    return;
                }

                if (!firstByName.TryGetValue(
                    definition.Name, out var firstSlot))
                {
                    var ordinal = slots.Count;
                    var slot = new SqlParameterSlot(
                        ordinal,
                        FormatPlaceholder(ordinal),
                        definition);
                    firstByName.Add(definition.Name, slot);
                    slots.Add(slot);
                    return;
                }

                if (!DefinitionsEqual(firstSlot.Definition, definition))
                {
                    throw new ArgumentException(
                        "A logical parameter name has conflicting definitions.",
                        "root");
                }
            }

            internal void RejectTraversalIssue(SqlAstTraversalIssue issue)
            {
                throw CreateTraversalException(issue);
            }

            internal void RejectMissingRequiredChild(string path)
            {
                throw new ArgumentException(
                    "SQL AST contains a missing required child.",
                    "root");
            }

            internal IReadOnlyList<SqlParameterSlot> CreateSnapshot()
            {
                return new ReadOnlyCollection<SqlParameterSlot>(
                    slots.ToArray());
            }
        }
    }
}
