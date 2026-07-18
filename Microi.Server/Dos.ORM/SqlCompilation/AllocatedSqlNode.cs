using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal sealed class AllocatedSqlNode
    {
        internal AllocatedSqlNode(
            SqlNode root,
            IEnumerable<SqlParameterSlot> parameterSlots)
        {
            if (root == null)
            {
                throw new ArgumentNullException(nameof(root));
            }
            if (parameterSlots == null)
            {
                throw new ArgumentNullException(nameof(parameterSlots));
            }

            var copy = new List<SqlParameterSlot>();
            var ordinal = 0;
            foreach (var slot in parameterSlots)
            {
                if (slot == null)
                {
                    throw new ArgumentException(
                        "Allocated parameter slots cannot contain null.",
                        nameof(parameterSlots));
                }
                if (slot.Ordinal != ordinal)
                {
                    throw new ArgumentException(
                        "Allocated parameter slots must be contiguous and ordered.",
                        nameof(parameterSlots));
                }
                copy.Add(slot);
                ordinal++;
            }

            Root = root;
            ParameterSlots = new ReadOnlyCollection<SqlParameterSlot>(copy);
        }

        internal SqlNode Root { get; }

        internal IReadOnlyList<SqlParameterSlot> ParameterSlots { get; }
    }
}
