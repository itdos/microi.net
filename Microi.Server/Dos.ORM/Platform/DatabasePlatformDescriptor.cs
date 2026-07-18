using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Platform
{

public sealed class DatabasePlatformDescriptor
{
    private readonly ReadOnlyCollection<string> _aliases;

    internal DatabasePlatformDescriptor(
        DatabaseType type,
        IEnumerable<string> aliases,
        DialectProfile profile,
        ISqlCompiler compiler,
        DatabaseCapabilities capabilities)
    {
        if (!Enum.IsDefined(typeof(DatabaseType), type))
        {
            throw new ArgumentOutOfRangeException(nameof(type));
        }
        if (aliases == null)
        {
            throw new ArgumentNullException(nameof(aliases));
        }
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }
        if (compiler == null)
        {
            throw new ArgumentNullException(nameof(compiler));
        }
        if (capabilities == null)
        {
            throw new ArgumentNullException(nameof(capabilities));
        }
        if (profile.DatabaseType != type)
        {
            throw new ArgumentException(
                "The descriptor type must match the exact profile type.",
                nameof(profile));
        }

        var snapshot = new List<string>();
        var unique = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var alias in aliases)
        {
            if (string.IsNullOrWhiteSpace(alias))
            {
                throw new ArgumentException(
                    "Platform aliases cannot be null, empty, or whitespace.",
                    nameof(aliases));
            }
            if (!unique.Add(alias))
            {
                throw new ArgumentException(
                    "Platform aliases must be unique ignoring case.",
                    nameof(aliases));
            }
            snapshot.Add(alias);
        }
        if (snapshot.Count == 0)
        {
            throw new ArgumentException(
                "At least one platform alias is required.",
                nameof(aliases));
        }

        Type = type;
        _aliases = new ReadOnlyCollection<string>(snapshot);
        Profile = profile;
        Compiler = compiler;
        Capabilities = capabilities;
    }

    public DatabaseType Type { get; }

    public IReadOnlyList<string> Aliases
    {
        get { return _aliases; }
    }

    public DialectProfile Profile { get; }

    public ISqlCompiler Compiler { get; }

    public DatabaseCapabilities Capabilities { get; }
}

}
