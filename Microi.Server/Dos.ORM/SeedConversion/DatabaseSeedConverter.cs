using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Dos.ORM.SeedConversion
{
    public static class DatabaseSeedConverter
    {
        public const string DefaultSourceUrl =
            "https://static.itdos.com/install/microi_empty_temp.sql.zip";

        private static readonly IReadOnlyList<SeedDatabaseTarget> Targets =
            Array.AsReadOnly(new[]
            {
                SeedDatabaseTarget.SqlServer2022,
                SeedDatabaseTarget.PostgreSql17,
                SeedDatabaseTarget.Oracle19c,
                SeedDatabaseTarget.Dm8,
                SeedDatabaseTarget.KingbaseEs
            });

        public static IReadOnlyList<SeedDatabaseTarget> SupportedTargets => Targets;

        public static SeedConversionResult ConvertMySql57(
            TextReader source,
            TextWriter destination,
            SeedDatabaseTarget target)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (destination == null)
            {
                throw new ArgumentNullException(nameof(destination));
            }
            EnsureTarget(target);

            var database = new MySql57DumpParser().Parse(source);
            return Convert(database, destination, target);
        }

        public static IReadOnlyList<SeedConversionResult> ConvertMySql57(
            TextReader source,
            IReadOnlyDictionary<SeedDatabaseTarget, TextWriter> destinations)
        {
            if (source == null)
            {
                throw new ArgumentNullException(nameof(source));
            }
            if (destinations == null || destinations.Count == 0)
            {
                throw new ArgumentException(
                    "At least one seed conversion destination is required.",
                    nameof(destinations));
            }

            foreach (var pair in destinations)
            {
                EnsureTarget(pair.Key);
                if (pair.Value == null)
                {
                    throw new ArgumentException(
                        "A seed conversion destination writer cannot be null.",
                        nameof(destinations));
                }
            }

            var database = new MySql57DumpParser().Parse(source);
            var results = new List<SeedConversionResult>();
            foreach (var target in Targets)
            {
                if (destinations.TryGetValue(target, out var destination))
                {
                    results.Add(Convert(database, destination, target));
                }
            }
            return results.AsReadOnly();
        }

        public static SeedDatabaseTarget ParseTarget(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException("A seed database target is required.", nameof(value));
            }
            switch (value.Trim().ToLowerInvariant().Replace("-", string.Empty))
            {
                case "sqlserver":
                case "sqlserver2022":
                case "mssql":
                    return SeedDatabaseTarget.SqlServer2022;
                case "postgres":
                case "postgresql":
                case "postgresql17":
                case "pg":
                    return SeedDatabaseTarget.PostgreSql17;
                case "oracle":
                case "oracle19":
                case "oracle19c":
                    return SeedDatabaseTarget.Oracle19c;
                case "dm":
                case "dm8":
                case "dameng":
                    return SeedDatabaseTarget.Dm8;
                case "kingbase":
                case "kingbasees":
                case "kingbaseesv9":
                    return SeedDatabaseTarget.KingbaseEs;
                default:
                    throw new ArgumentException(
                        "Unknown seed database target '" + value + "'.",
                        nameof(value));
            }
        }

        public static SeedDatabaseTarget GetTarget(DatabaseType databaseType)
        {
            switch (databaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return SeedDatabaseTarget.SqlServer2022;
                case DatabaseType.PostgreSql:
                    return SeedDatabaseTarget.PostgreSql17;
                case DatabaseType.Oracle:
                    return SeedDatabaseTarget.Oracle19c;
                case DatabaseType.DaMeng:
                    return SeedDatabaseTarget.Dm8;
                case DatabaseType.KingBase:
                    return SeedDatabaseTarget.KingbaseEs;
                default:
                    throw new ArgumentException(
                        "Database type '" + databaseType
                        + "' does not have a generated Microi seed target.",
                        nameof(databaseType));
            }
        }

        public static string GetOutputFileName(SeedDatabaseTarget target)
        {
            EnsureTarget(target);
            switch (target)
            {
                case SeedDatabaseTarget.SqlServer2022:
                    return "microi_empty_sqlserver2022.sql";
                case SeedDatabaseTarget.PostgreSql17:
                    return "microi_empty_postgresql17.sql";
                case SeedDatabaseTarget.Oracle19c:
                    return "microi_empty_oracle19c.sql";
                case SeedDatabaseTarget.Dm8:
                    return "microi_empty_dm8.sql";
                case SeedDatabaseTarget.KingbaseEs:
                    return "microi_empty_kingbasees.sql";
                default:
                    throw new ArgumentOutOfRangeException(nameof(target));
            }
        }

        public static IReadOnlyList<string> GetExecutionBatches(
            string convertedSql,
            SeedConversionResult conversion)
        {
            if (string.IsNullOrWhiteSpace(convertedSql))
            {
                throw new ArgumentException(
                    "Converted seed SQL is required.",
                    nameof(convertedSql));
            }
            if (conversion == null)
            {
                throw new ArgumentNullException(nameof(conversion));
            }
            if (conversion.RequiresNonEmptyEnvelopeRuntime)
            {
                throw new NotSupportedException(
                    conversion.Target
                    + " seed import requires the Dos.ORM NonEmptyEnvelopeV1 "
                    + "runtime parameter encoder and result decoder. Legacy "
                    + "TenantProvisioning must remain fail-closed.");
            }

            if (conversion.Target == SeedDatabaseTarget.Dm8)
            {
                return SplitDmBatches(convertedSql);
            }
            if (conversion.Target != SeedDatabaseTarget.SqlServer2022)
            {
                return Array.AsReadOnly(new[] { convertedSql });
            }

            var batches = new List<string>();
            var batch = new StringBuilder();
            using (var reader = new StringReader(convertedSql))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    if (string.Equals(
                            line.Trim(),
                            "GO",
                            StringComparison.OrdinalIgnoreCase))
                    {
                        AddBatch(batches, batch);
                    }
                    else
                    {
                        batch.AppendLine(line);
                    }
                }
            }
            AddBatch(batches, batch);
            if (batches.Count == 0)
            {
                throw new InvalidDataException(
                    "The converted SQL Server seed contains no executable batches.");
            }
            return batches.AsReadOnly();
        }

        public static string GetDataReplaySql(
            string convertedSql,
            SeedConversionResult conversion,
            IEnumerable<string> logicalTableNames)
        {
            if (conversion == null)
            {
                throw new ArgumentNullException(nameof(conversion));
            }
            if (logicalTableNames == null)
            {
                throw new ArgumentNullException(nameof(logicalTableNames));
            }
            if (conversion.Target != SeedDatabaseTarget.Dm8)
            {
                throw new NotSupportedException(
                    "Data replay SQL is currently supported only for DM8 diagnostics.");
            }

            var tables = new HashSet<string>(
                logicalTableNames.Where(name => !string.IsNullOrWhiteSpace(name))
                    .Select(name => name.Trim()),
                StringComparer.OrdinalIgnoreCase);
            if (tables.Count == 0)
            {
                throw new ArgumentException(
                    "At least one replay table is required.",
                    nameof(logicalTableNames));
            }

            long expectedRows = 0;
            var prefixes = new List<string>();
            foreach (var table in tables)
            {
                if (!conversion.TableRowCounts.TryGetValue(table, out var rowCount))
                {
                    throw new ArgumentException(
                        "The source seed does not define replay table '" + table + "'.",
                        nameof(logicalTableNames));
                }
                expectedRows = checked(expectedRows + rowCount);
                prefixes.Add("INSERT INTO \"" + table.Replace("\"", "\"\"") + "\" ");
            }

            var output = new StringBuilder();
            output.AppendLine("-- DM8 data-only diagnostic replay generated by Dos.ORM.");
            output.AppendLine("SET DEFINE OFF");
            output.AppendLine();
            long actualRows = 0;
            foreach (var batch in GetExecutionBatches(convertedSql, conversion))
            {
                var trimmed = batch.TrimStart();
                if (!prefixes.Any(prefix => trimmed.StartsWith(
                        prefix,
                        StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }
                output.AppendLine(batch.Trim());
                output.AppendLine();
                actualRows++;
            }
            if (actualRows != expectedRows)
            {
                throw new InvalidDataException(
                    "DM8 replay extraction expected " + expectedRows
                    + " rows but found " + actualRows + ".");
            }
            return output.ToString();
        }

        private static void EnsureTarget(SeedDatabaseTarget target)
        {
            if (!Enum.IsDefined(typeof(SeedDatabaseTarget), target))
            {
                throw new ArgumentOutOfRangeException(nameof(target));
            }
        }

        private static SeedConversionResult Convert(
            SeedDatabase database,
            TextWriter destination,
            SeedDatabaseTarget target)
        {
            var writer = SeedSqlWriter.Create(target, destination);
            writer.Write(database);
            destination.Flush();

            long rowCount = 0;
            var tableRowCounts = new Dictionary<string, long>(
                StringComparer.OrdinalIgnoreCase);
            foreach (var table in database.Tables)
            {
                tableRowCounts.Add(table.Name, 0);
            }
            foreach (var insert in database.Inserts)
            {
                rowCount = checked(rowCount + insert.Rows.Count);
                tableRowCounts[insert.Table.Name] = checked(
                    tableRowCounts[insert.Table.Name] + insert.Rows.Count);
            }
            return new SeedConversionResult(
                target,
                database.Tables.Count,
                rowCount,
                tableRowCounts);
        }

        private static void AddBatch(
            ICollection<string> batches,
            StringBuilder batch)
        {
            var value = batch.ToString().Trim();
            batch.Clear();
            if (value.Length > 0)
            {
                batches.Add(value);
            }
        }

        private static IReadOnlyList<string> SplitDmBatches(string sql)
        {
            var batches = new List<string>();
            var regular = new StringBuilder();
            var procedural = new StringBuilder();
            var inSingleQuote = false;
            var inQuotedIdentifier = false;
            var inProceduralBlock = false;

            using (var reader = new StringReader(sql))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    var trimmed = line.Trim();
                    if (inProceduralBlock)
                    {
                        if (trimmed == "/")
                        {
                            AddBatch(batches, procedural);
                            inProceduralBlock = false;
                        }
                        else
                        {
                            procedural.AppendLine(line);
                        }
                        continue;
                    }

                    if (!inSingleQuote
                        && !inQuotedIdentifier
                        && regular.ToString().Trim().Length == 0)
                    {
                        if (trimmed.Length == 0 || trimmed.StartsWith("--", StringComparison.Ordinal))
                        {
                            continue;
                        }
                        if (string.Equals(
                                trimmed,
                                "SET DEFINE OFF",
                                StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                        if (string.Equals(trimmed, "BEGIN", StringComparison.OrdinalIgnoreCase)
                            || trimmed.StartsWith(
                                "CREATE OR REPLACE TRIGGER ",
                                StringComparison.OrdinalIgnoreCase))
                        {
                            inProceduralBlock = true;
                            procedural.AppendLine(line);
                            continue;
                        }
                    }

                    AppendDmRegularLine(
                        line,
                        regular,
                        batches,
                        ref inSingleQuote,
                        ref inQuotedIdentifier);
                }
            }

            if (inProceduralBlock)
            {
                throw new InvalidDataException(
                    "The converted DM8 seed ends inside a procedural block.");
            }
            if (inSingleQuote || inQuotedIdentifier)
            {
                throw new InvalidDataException(
                    "The converted DM8 seed ends inside a quoted value or identifier.");
            }
            AddBatch(batches, regular);
            if (batches.Count == 0)
            {
                throw new InvalidDataException(
                    "The converted DM8 seed contains no executable batches.");
            }
            return batches.AsReadOnly();
        }

        private static void AppendDmRegularLine(
            string line,
            StringBuilder batch,
            ICollection<string> batches,
            ref bool inSingleQuote,
            ref bool inQuotedIdentifier)
        {
            for (var index = 0; index < line.Length; index++)
            {
                var current = line[index];
                var next = index + 1 < line.Length ? line[index + 1] : '\0';
                batch.Append(current);

                if (inSingleQuote)
                {
                    if (current == '\'' && next == '\'')
                    {
                        batch.Append(next);
                        index++;
                    }
                    else if (current == '\'')
                    {
                        inSingleQuote = false;
                    }
                    continue;
                }
                if (inQuotedIdentifier)
                {
                    if (current == '"' && next == '"')
                    {
                        batch.Append(next);
                        index++;
                    }
                    else if (current == '"')
                    {
                        inQuotedIdentifier = false;
                    }
                    continue;
                }
                if (current == '\'')
                {
                    inSingleQuote = true;
                }
                else if (current == '"')
                {
                    inQuotedIdentifier = true;
                }
                else if (current == ';')
                {
                    AddBatch(batches, batch);
                }
            }
            if (batch.Length > 0)
            {
                batch.AppendLine();
            }
        }
    }
}
