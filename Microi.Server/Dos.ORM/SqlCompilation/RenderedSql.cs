using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dos.ORM.SqlCompilation
{
    internal enum RenderedSqlKind
    {
        Commands,
        Bulk,
        Admin
    }

    internal sealed class RenderedSql
    {
        private RenderedSql(
            RenderedSqlKind kind,
            IReadOnlyList<SqlCommandStep> commands,
            BulkStep bulk,
            AdminStep admin)
        {
            Kind = kind;
            Commands = commands;
            Bulk = bulk;
            Admin = admin;
        }

        internal RenderedSqlKind Kind { get; }

        private IReadOnlyList<SqlCommandStep> Commands { get; }

        private BulkStep Bulk { get; }

        private AdminStep Admin { get; }

        internal static RenderedSql ForCommands(
            IReadOnlyList<SqlCommandStep> commands)
        {
            if (commands == null)
            {
                throw new ArgumentNullException(nameof(commands));
            }

            var copy = new List<SqlCommandStep>(commands.Count);
            for (var index = 0; index < commands.Count; index++)
            {
                var command = commands[index];
                if (command == null)
                {
                    throw new ArgumentException(
                        "Rendered commands cannot contain null.",
                        nameof(commands));
                }
                copy.Add(command);
            }
            if (copy.Count == 0)
            {
                throw new ArgumentException(
                    "Rendered commands cannot be empty.", nameof(commands));
            }

            return new RenderedSql(
                RenderedSqlKind.Commands,
                new ReadOnlyCollection<SqlCommandStep>(copy),
                null,
                null);
        }

        internal static RenderedSql ForBulk(BulkStep step)
        {
            if (step == null)
            {
                throw new ArgumentNullException(nameof(step));
            }
            return new RenderedSql(
                RenderedSqlKind.Bulk, null, step, null);
        }

        internal static RenderedSql ForAdmin(AdminStep step)
        {
            if (step == null)
            {
                throw new ArgumentNullException(nameof(step));
            }
            return new RenderedSql(
                RenderedSqlKind.Admin, null, null, step);
        }

        internal IReadOnlyList<SqlCommandStep> RequireCommands()
        {
            if (Kind != RenderedSqlKind.Commands || Commands == null)
            {
                throw new InvalidOperationException(
                    "Rendered SQL does not contain command templates.");
            }
            return Commands;
        }

        internal BulkStep RequireBulk()
        {
            if (Kind != RenderedSqlKind.Bulk || Bulk == null)
            {
                throw new InvalidOperationException(
                    "Rendered SQL does not contain a bulk step.");
            }
            return Bulk;
        }

        internal AdminStep RequireAdmin()
        {
            if (Kind != RenderedSqlKind.Admin || Admin == null)
            {
                throw new InvalidOperationException(
                    "Rendered SQL does not contain an admin step.");
            }
            return Admin;
        }
    }
}
