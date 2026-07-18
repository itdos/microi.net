using System.IO.Compression;
using System.Text;
using Dos.ORM.SeedConversion;

return await SeedConverterCommand.RunAsync(args);

internal static class SeedConverterCommand
{
    internal static async Task<int> RunAsync(string[] args)
    {
        try
        {
            var options = CommandOptions.Parse(args);
            if (options.Help)
            {
                PrintHelp();
                return 0;
            }

            Directory.CreateDirectory(options.OutputDirectory);
            var prepared = await PrepareSourceAsync(options.InputPath);
            try
            {
                var writers = new Dictionary<SeedDatabaseTarget, TextWriter>();
                IReadOnlyList<SeedConversionResult> results;
                try
                {
                    foreach (var target in options.Targets)
                    {
                        var path = Path.Combine(
                            options.OutputDirectory,
                            DatabaseSeedConverter.GetOutputFileName(target));
                        writers.Add(
                            target,
                            new StreamWriter(
                                path,
                                false,
                                new UTF8Encoding(false),
                                128 * 1024));
                    }

                    using var input = new StreamReader(
                        prepared.SqlPath,
                        Encoding.UTF8,
                        true,
                        128 * 1024);
                    results = DatabaseSeedConverter.ConvertMySql57(
                        input,
                        writers);
                    foreach (var result in results)
                    {
                        Console.WriteLine(
                            $"{result.Target}: {result.TableCount} tables, "
                            + $"{result.RowCount} rows -> "
                            + Path.Combine(
                                options.OutputDirectory,
                                DatabaseSeedConverter.GetOutputFileName(result.Target)));
                        if (result.RequiresNonEmptyEnvelopeRuntime)
                        {
                            Console.WriteLine(
                                "  WARNING: RequiresNonEmptyEnvelopeRuntime=true; "
                                + "do not connect a legacy runtime without Dos.ORM "
                                + "parameter encoding and result decoding.");
                        }
                        foreach (var table in options.TableCounts)
                        {
                            if (!result.TableRowCounts.TryGetValue(table, out var count))
                            {
                                throw new InvalidDataException(
                                    "The source seed does not define table '" + table + "'.");
                            }
                            Console.WriteLine("  " + table + ": " + count + " rows");
                        }
                    }
                }
                finally
                {
                    foreach (var writer in writers.Values)
                    {
                        writer.Dispose();
                    }
                }
                foreach (var result in results)
                {
                    if (options.ReplayTables.Count == 0)
                    {
                        continue;
                    }
                    var outputFile = DatabaseSeedConverter.GetOutputFileName(
                        result.Target);
                    var outputPath = Path.Combine(
                        options.OutputDirectory,
                        outputFile);
                    var replayPath = Path.Combine(
                        options.OutputDirectory,
                        Path.GetFileNameWithoutExtension(outputFile)
                        + ".data-replay.sql");
                    var replaySql = DatabaseSeedConverter.GetDataReplaySql(
                        await File.ReadAllTextAsync(outputPath, Encoding.UTF8),
                        result,
                        options.ReplayTables);
                    await File.WriteAllTextAsync(
                        replayPath,
                        replaySql,
                        new UTF8Encoding(false));
                    Console.WriteLine("Data replay -> " + replayPath);
                }
            }
            finally
            {
                prepared.Dispose();
            }
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static async Task<PreparedSource> PrepareSourceAsync(string? inputPath)
    {
        var sourcePath = inputPath;
        string? downloadedPath = null;
        if (string.IsNullOrWhiteSpace(sourcePath))
        {
            downloadedPath = Path.Combine(
                Path.GetTempPath(),
                "microi_empty_temp_" + Guid.NewGuid().ToString("N") + ".sql.zip");
            Console.WriteLine("Downloading " + DatabaseSeedConverter.DefaultSourceUrl);
            using var client = new HttpClient();
            using var response = await client.GetAsync(
                DatabaseSeedConverter.DefaultSourceUrl,
                HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            await using var destination = File.Create(downloadedPath);
            await response.Content.CopyToAsync(destination);
            sourcePath = downloadedPath;
        }

        sourcePath = Path.GetFullPath(sourcePath);
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException("Seed input file was not found.", sourcePath);
        }
        if (string.Equals(
                Path.GetExtension(sourcePath),
                ".sql",
                StringComparison.OrdinalIgnoreCase))
        {
            return new PreparedSource(sourcePath, downloadedPath, null);
        }
        if (!string.Equals(
                Path.GetExtension(sourcePath),
                ".zip",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException(
                "Seed input must be a .sql file or a .zip containing exactly one .sql file.");
        }

        var extractedPath = Path.Combine(
            Path.GetTempPath(),
            "microi_empty_temp_" + Guid.NewGuid().ToString("N") + ".sql");
        using (var archive = ZipFile.OpenRead(sourcePath))
        {
            var entries = archive.Entries
                .Where(entry => string.Equals(
                    Path.GetExtension(entry.Name),
                    ".sql",
                    StringComparison.OrdinalIgnoreCase))
                .ToArray();
            if (entries.Length != 1)
            {
                throw new InvalidDataException(
                    "The seed zip must contain exactly one .sql file, but found "
                    + entries.Length + ".");
            }
            await using var source = entries[0].Open();
            await using var destination = File.Create(extractedPath);
            await source.CopyToAsync(destination);
        }
        return new PreparedSource(extractedPath, downloadedPath, extractedPath);
    }

    private static void PrintHelp()
    {
        Console.WriteLine("Microi MySQL 5.7 database seed converter");
        Console.WriteLine();
        Console.WriteLine("Usage:");
        Console.WriteLine("  dotnet run --project Microi.Server/tools/Microi.DatabaseSeedConverter -- [options]");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  --input <file>     Local .sql or .zip. Omit to download the current official seed.");
        Console.WriteLine("  --output <folder>  Output folder. Default: ./seed-output");
        Console.WriteLine("  --targets <list>   Comma-separated targets. Default: all");
        Console.WriteLine("                     sqlserver,postgresql,oracle,dm8,kingbase");
        Console.WriteLine("  --table-counts <list>  Report source row counts for named tables.");
        Console.WriteLine("  --replay-tables <list> Generate a DM8 data-only diagnostic replay.");
        Console.WriteLine("  --help             Show this help.");
    }
}

internal sealed class CommandOptions
{
    private CommandOptions(
        string? inputPath,
        string outputDirectory,
        IReadOnlyList<SeedDatabaseTarget> targets,
        IReadOnlyList<string> tableCounts,
        IReadOnlyList<string> replayTables,
        bool help)
    {
        InputPath = inputPath;
        OutputDirectory = outputDirectory;
        Targets = targets;
        TableCounts = tableCounts;
        ReplayTables = replayTables;
        Help = help;
    }

    internal string? InputPath { get; }

    internal string OutputDirectory { get; }

    internal IReadOnlyList<SeedDatabaseTarget> Targets { get; }

    internal IReadOnlyList<string> TableCounts { get; }

    internal IReadOnlyList<string> ReplayTables { get; }

    internal bool Help { get; }

    internal static CommandOptions Parse(string[] args)
    {
        string? input = null;
        var output = Path.GetFullPath("seed-output");
        IReadOnlyList<SeedDatabaseTarget> targets =
            DatabaseSeedConverter.SupportedTargets;
        IReadOnlyList<string> tableCounts = Array.Empty<string>();
        IReadOnlyList<string> replayTables = Array.Empty<string>();
        var help = false;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case "--help":
                case "-h":
                    help = true;
                    break;
                case "--input":
                    input = ReadValue(args, ref index, "--input");
                    break;
                case "--output":
                    output = Path.GetFullPath(ReadValue(args, ref index, "--output"));
                    break;
                case "--targets":
                    var parsed = ReadValue(args, ref index, "--targets")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries
                            | StringSplitOptions.TrimEntries)
                        .Select(DatabaseSeedConverter.ParseTarget)
                        .Distinct()
                        .ToArray();
                    if (parsed.Length == 0)
                    {
                        throw new ArgumentException("--targets cannot be empty.");
                    }
                    targets = parsed;
                    break;
                case "--table-counts":
                    tableCounts = ReadValue(args, ref index, "--table-counts")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries
                            | StringSplitOptions.TrimEntries)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();
                    if (tableCounts.Count == 0)
                    {
                        throw new ArgumentException("--table-counts cannot be empty.");
                    }
                    break;
                case "--replay-tables":
                    replayTables = ReadValue(args, ref index, "--replay-tables")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries
                            | StringSplitOptions.TrimEntries)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();
                    if (replayTables.Count == 0)
                    {
                        throw new ArgumentException("--replay-tables cannot be empty.");
                    }
                    break;
                default:
                    throw new ArgumentException(
                        "Unknown argument '" + args[index] + "'. Use --help for usage.");
            }
        }
        return new CommandOptions(
            input,
            output,
            targets,
            tableCounts,
            replayTables,
            help);
    }

    private static string ReadValue(string[] args, ref int index, string option)
    {
        index++;
        if (index >= args.Length || string.IsNullOrWhiteSpace(args[index]))
        {
            throw new ArgumentException(option + " requires a value.");
        }
        return args[index];
    }
}

internal sealed class PreparedSource : IDisposable
{
    internal PreparedSource(
        string sqlPath,
        string? downloadedPath,
        string? extractedPath)
    {
        SqlPath = sqlPath;
        DownloadedPath = downloadedPath;
        ExtractedPath = extractedPath;
    }

    internal string SqlPath { get; }

    private string? DownloadedPath { get; }

    private string? ExtractedPath { get; }

    public void Dispose()
    {
        DeleteIfTemporary(ExtractedPath);
        DeleteIfTemporary(DownloadedPath);
    }

    private static void DeleteIfTemporary(string? path)
    {
        if (!string.IsNullOrEmpty(path) && File.Exists(path))
        {
            File.Delete(path);
        }
    }
}
