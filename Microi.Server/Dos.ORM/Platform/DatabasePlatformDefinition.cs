using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Platform
{

internal sealed class DatabasePlatformDefinition
{
    private readonly ReadOnlyCollection<string> _aliases;
    private readonly Func<DialectProfile, DatabaseCapabilities>
        _capabilityResolver;

    internal DatabasePlatformDefinition(
        DatabaseType type,
        IEnumerable<string> aliases,
        ISqlCompiler compiler,
        Func<DialectProfile, DatabaseCapabilities> capabilityResolver,
        LogicalTextEncoding expectedTextEncoding)
    {
        if (!Enum.IsDefined(typeof(DatabaseType), type))
        {
            throw new ArgumentOutOfRangeException(nameof(type));
        }
        if (aliases == null)
        {
            throw new ArgumentNullException(nameof(aliases));
        }
        if (compiler == null)
        {
            throw new ArgumentNullException(nameof(compiler));
        }
        if (capabilityResolver == null)
        {
            throw new ArgumentNullException(nameof(capabilityResolver));
        }
        if (!Enum.IsDefined(
                typeof(LogicalTextEncoding),
                expectedTextEncoding))
        {
            throw new ArgumentOutOfRangeException(
                nameof(expectedTextEncoding));
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
        Compiler = compiler;
        _capabilityResolver = capabilityResolver;
        ExpectedTextEncoding = expectedTextEncoding;
    }

    internal DatabaseType Type { get; }

    internal IReadOnlyList<string> Aliases
    {
        get { return _aliases; }
    }

    internal ISqlCompiler Compiler { get; }

    internal LogicalTextEncoding ExpectedTextEncoding { get; }

    internal DatabasePlatformDescriptor CreateDescriptor(
        DialectProfile profile)
    {
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }
        if (profile.DatabaseType != Type)
        {
            throw new ArgumentException(
                "The definition type must match the exact profile type.",
                nameof(profile));
        }

        var capabilities = _capabilityResolver(profile);
        if (capabilities == null)
        {
            throw new InvalidOperationException(
                "A platform capability resolver returned null.");
        }
        return new DatabasePlatformDescriptor(
            Type,
            _aliases,
            profile,
            Compiler,
            capabilities);
    }
}

}
