using System;
using Dos.ORM.Dialects.Dm8;
using Dos.ORM.Dialects.KingbaseEs;
using Dos.ORM.Dialects.MySql;
using Dos.ORM.Dialects.Oracle;
using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.Dialects.SqlServer;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Platform
{

public static class DatabasePlatformRegistry
{
    private static readonly DatabasePlatformDefinition[] Definitions =
    {
        new DatabasePlatformDefinition(
            DatabaseType.MySql,
            new[] { "mysql" },
            new MySqlCompiler(),
            MySqlCapabilities.For,
            LogicalTextEncoding.Native),
        new DatabasePlatformDefinition(
            DatabaseType.SqlServer,
            new[] { "sqlserver" },
            new SqlServerCompiler(),
            SqlServerCapabilities.For,
            LogicalTextEncoding.Native),
        new DatabasePlatformDefinition(
            DatabaseType.Oracle,
            new[] { "oracle" },
            new OracleCompiler(),
            OracleCapabilities.For,
            LogicalTextEncoding.NonEmptyEnvelopeV1),
        new DatabasePlatformDefinition(
            DatabaseType.PostgreSql,
            new[] { "postgresql" },
            new PostgreSqlCompiler(),
            PostgreSqlCapabilities.For,
            LogicalTextEncoding.Native),
        new DatabasePlatformDefinition(
            DatabaseType.DaMeng,
            new[] { "dm8" },
            new Dm8Compiler(),
            Dm8Capabilities.For,
            LogicalTextEncoding.NonEmptyEnvelopeV1),
        new DatabasePlatformDefinition(
            DatabaseType.KingBase,
            new[] { "kingbasees-v9" },
            new KingbaseEsCompiler(),
            KingbaseEsCapabilities.For,
            LogicalTextEncoding.Native)
    };

    public static DatabasePlatformDescriptor Get(DialectProfile profile)
    {
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }

        var definition = FindByType(profile.DatabaseType);
        if (definition == null)
        {
            throw new NotSupportedException(
                "The database type is not a certified Dos.ORM platform: " +
                profile.DatabaseType + ".");
        }
        return definition.CreateDescriptor(profile);
    }

    public static bool TryGet(
        DialectProfile profile,
        out DatabasePlatformDescriptor descriptor)
    {
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }

        descriptor = null;
        var definition = FindByType(profile.DatabaseType);
        if (definition == null)
        {
            return false;
        }

        try
        {
            descriptor = definition.CreateDescriptor(profile);
            return true;
        }
        catch (UnsupportedDatabaseCapabilityException)
        {
            descriptor = null;
            return false;
        }
    }

    public static DatabasePlatformDescriptor Resolve(
        string alias,
        DialectProfile profile)
    {
        if (alias == null)
        {
            throw new ArgumentNullException(nameof(alias));
        }
        if (string.IsNullOrWhiteSpace(alias))
        {
            throw new ArgumentException(
                "A platform alias cannot be empty or whitespace.",
                nameof(alias));
        }
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }

        var definition = FindByAlias(alias);
        if (definition == null)
        {
            throw new NotSupportedException(
                "The database alias is not a certified Dos.ORM platform.");
        }
        if (definition.Type != profile.DatabaseType)
        {
            throw new ArgumentException(
                "The alias does not match the exact profile type.",
                nameof(profile));
        }
        return definition.CreateDescriptor(profile);
    }

    private static DatabasePlatformDefinition FindByType(DatabaseType type)
    {
        for (var index = 0; index < Definitions.Length; index++)
        {
            if (Definitions[index].Type == type)
            {
                return Definitions[index];
            }
        }
        return null;
    }

    private static DatabasePlatformDefinition FindByAlias(string alias)
    {
        for (var definitionIndex = 0;
             definitionIndex < Definitions.Length;
             definitionIndex++)
        {
            var definition = Definitions[definitionIndex];
            for (var aliasIndex = 0;
                 aliasIndex < definition.Aliases.Count;
                 aliasIndex++)
            {
                if (string.Equals(
                        definition.Aliases[aliasIndex],
                        alias,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return definition;
                }
            }
        }
        return null;
    }
}

}
