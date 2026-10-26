using System.Reflection;
using Microi.License;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class TenantLicenseWriteNoiseTests
{
    private static bool Prune(JObject stored,JObject form) => (bool)typeof(TenantLicensePolicy)
        .GetMethod("RemoveUnchangedLicenseFields",BindingFlags.NonPublic|BindingFlags.Static)!
        .Invoke(null,new object[] {stored,form})!;

    private static JObject Stored() => new() { ["OsClient"]="iTdos",["LicenseProductType"]="Enterprise",
        ["LicenseExpirationDate"]="2030-01-01T00:00:00Z" };

    [Fact]
    public void OrdinaryMinioSaveRemovesUnchangedLicenseNoiseAndPreservesOtherFields()
    {
        var stored=Stored();var form=(JObject)stored.DeepClone();form["MinIOSecretKey"]="fixture-secret";
        var before=stored.ToString();
        Assert.True(Prune(stored,form));
        Assert.Null(form["LicenseProductType"]);Assert.Null(form["LicenseExpirationDate"]);
        Assert.Equal("fixture-secret",form.Value<string>("MinIOSecretKey"));
        Assert.Equal(before,stored.ToString());
    }

    [Fact]
    public void SameExpiryRoundTripAndEmptyNullableValuesDoNotChangeLicense()
    {
        var form=new JObject { ["licenseexpirationdate"]="2030-01-01T08:00:00+08:00" };
        Assert.True(Prune(Stored(),form));Assert.Empty(form.Properties());
        Assert.True(Prune(new JObject { ["OsClient"]="child",["LicenseProductType"]=JValue.CreateNull() },
            new JObject { ["LicenseProductType"]="" }));
    }

    [Theory]
    [InlineData("LicenseProductType","Personal")]
    [InlineData("LicenseExpirationDate","2035-01-01T00:00:00Z")]
    [InlineData("OsClient","other")]
    public void RealLicenseOrTargetChangesRemainForTheAuthoritativeGuard(string field,string value)
    {
        var form=(JObject)Stored().DeepClone();form[field]=value;var before=form.ToString();
        Assert.False(Prune(Stored(),form));Assert.Equal(before,form.ToString());
    }

    [Fact]
    public void DuplicateCaseAliasesCannotHideAChangedLicense()
    {
        var form=(JObject)Stored().DeepClone();form["licenseproducttype"]="Personal";
        Assert.False(Prune(Stored(),form));Assert.Equal("Personal",form.Value<string>("licenseproducttype"));
    }
}
