using System.Reflection;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Platform;

public sealed class DatabasePlatformRegistryTests
{
    [Theory]
    [InlineData("mysql", DatabaseType.MySql)]
    [InlineData("sqlserver", DatabaseType.SqlServer)]
    [InlineData("oracle", DatabaseType.Oracle)]
    [InlineData("postgresql", DatabaseType.PostgreSql)]
    [InlineData("dm8", DatabaseType.DaMeng)]
    [InlineData("kingbasees-v9", DatabaseType.KingBase)]
    public void Official_alias_resolves_only_after_all_real_compilers_exist(
        string alias,
        DatabaseType expected)
    {
        var profile = TestProfiles.For(expected);

        var descriptor = DatabasePlatformRegistry.Resolve(alias, profile);
        var caseVariant = DatabasePlatformRegistry.Resolve(
            alias.ToUpperInvariant(),
            profile);

        Assert.Equal(expected, descriptor.Type);
        Assert.Equal(expected, caseVariant.Type);
        Assert.Same(profile, descriptor.Profile);
        Assert.NotNull(descriptor.Compiler);
        Assert.NotNull(descriptor.Capabilities);
    }

    [Fact]
    public void Value_equal_distinct_profiles_keep_each_lookup_input_reference()
    {
        var getProfile = TestProfiles.PostgreSql17;
        var resolveProfile = TestProfiles.Clone(getProfile);
        var tryProfile = TestProfiles.Clone(getProfile);
        Assert.Equal(getProfile, resolveProfile);
        Assert.Equal(getProfile, tryProfile);
        Assert.NotSame(getProfile, resolveProfile);
        Assert.NotSame(getProfile, tryProfile);

        var fromGet = DatabasePlatformRegistry.Get(getProfile);
        var fromResolve = DatabasePlatformRegistry.Resolve(
            "postgresql",
            resolveProfile);
        Assert.True(DatabasePlatformRegistry.TryGet(
            tryProfile,
            out var fromTryGet));

        Assert.Same(getProfile, fromGet.Profile);
        Assert.Same(resolveProfile, fromResolve.Profile);
        Assert.Same(tryProfile, fromTryGet.Profile);
        Assert.NotSame(fromGet, fromResolve);
        Assert.NotSame(fromGet, fromTryGet);
        Assert.Same(fromGet.Compiler, fromResolve.Compiler);
        Assert.Same(fromGet.Capabilities, fromTryGet.Capabilities);
    }

    [Fact]
    public void Descriptor_aliases_are_defensive_and_registry_surface_is_closed()
    {
        var registered = DatabasePlatformRegistry.Get(
            TestProfiles.PostgreSql17);
        var mutableAliases = new List<string> { "postgresql" };
        var descriptor = new DatabasePlatformDescriptor(
            DatabaseType.PostgreSql,
            mutableAliases,
            registered.Profile,
            registered.Compiler,
            registered.Capabilities);
        mutableAliases[0] = "mutated";

        Assert.Equal("postgresql", Assert.Single(descriptor.Aliases));
        Assert.NotSame(mutableAliases, descriptor.Aliases);
        Assert.Equal(
            typeof(IReadOnlyList<string>),
            typeof(DatabasePlatformDescriptor)
                .GetProperty(nameof(DatabasePlatformDescriptor.Aliases))!
                .PropertyType);

        var publicMethods = typeof(DatabasePlatformRegistry).GetMethods(
            BindingFlags.Public |
            BindingFlags.Static |
            BindingFlags.DeclaredOnly);
        Assert.Equal(
            new[] { "Get", "Resolve", "TryGet" },
            publicMethods.Select(x => x.Name)
                .OrderBy(x => x, StringComparer.Ordinal));
        Assert.DoesNotContain(
            publicMethods,
            method => method.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(DatabaseType)));
    }

    [Fact]
    public void Descriptor_rejects_invalid_constructor_inputs()
    {
        var registered = DatabasePlatformRegistry.Get(TestProfiles.MySql80);

        Assert.Throws<ArgumentNullException>(() =>
            new DatabasePlatformDescriptor(
                DatabaseType.MySql,
                null!,
                registered.Profile,
                registered.Compiler,
                registered.Capabilities));
        Assert.Throws<ArgumentException>(() =>
            new DatabasePlatformDescriptor(
                DatabaseType.MySql,
                new[] { "mysql", "MYSQL" },
                registered.Profile,
                registered.Compiler,
                registered.Capabilities));
        Assert.Throws<ArgumentException>(() =>
            new DatabasePlatformDescriptor(
                DatabaseType.PostgreSql,
                new[] { "postgresql" },
                registered.Profile,
                registered.Compiler,
                registered.Capabilities));
    }

    [Fact]
    public void Unknown_alias_profile_mismatch_and_legacy_types_fail_closed()
    {
        Assert.Throws<NotSupportedException>(() =>
            DatabasePlatformRegistry.Resolve(
                "unknown-db",
                TestProfiles.PostgreSql17));
        Assert.Throws<ArgumentException>(() =>
            DatabasePlatformRegistry.Resolve(
                "mysql",
                TestProfiles.PostgreSql17));
        Assert.Throws<NotSupportedException>(() =>
            DatabasePlatformRegistry.Get(new DialectProfile(
                DatabaseType.Sqlite3,
                new Version(3, 0, 0, 0),
                string.Empty)));
        Assert.False(DatabasePlatformRegistry.TryGet(
            new DialectProfile(
                DatabaseType.MsAccess,
                new Version(1, 0, 0, 0),
                string.Empty),
            out _));
    }

    [Fact]
    public void Unsupported_profiles_fail_or_return_false_without_fallback()
    {
        var unsupported = new DialectProfile(
            DatabaseType.PostgreSql,
            new Version(16, 0, 0, 0),
            string.Empty);

        Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            DatabasePlatformRegistry.Get(unsupported));
        Assert.False(DatabasePlatformRegistry.TryGet(unsupported, out _));
        Assert.Throws<ArgumentNullException>(() =>
            DatabasePlatformRegistry.Get(null!));
        Assert.Throws<ArgumentNullException>(() =>
            DatabasePlatformRegistry.TryGet(null!, out _));
    }
}
