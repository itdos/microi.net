using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Platform;

public sealed class DialectCapabilityFactoryContractTests
{
    [Theory]
    [MemberData(
        nameof(CapabilityFactoryCases.All),
        MemberType = typeof(CapabilityFactoryCases))]
    public void Every_factory_has_exact_four_part_version_mode_and_values(
        CapabilityFactoryCase item)
    {
        foreach (var validProfile in item.ValidProfiles)
        {
            var actual = item.Create(validProfile);
            AssertCapabilities(item.Expected, actual);
        }

        Assert.All(
            item.InvalidProfiles,
            profile => Assert.Throws<UnsupportedDatabaseCapabilityException>(
                () => item.Create(profile)));
        Assert.Throws<ArgumentNullException>(() => item.Create(null!));
    }

    private static void AssertCapabilities(
        DatabaseCapabilities expected,
        DatabaseCapabilities actual)
    {
        var properties = typeof(DatabaseCapabilities).GetProperties();
        Assert.Equal(30, properties.Length);
        Assert.All(
            properties,
            property => Assert.Equal(
                property.GetValue(expected),
                property.GetValue(actual)));
    }
}
