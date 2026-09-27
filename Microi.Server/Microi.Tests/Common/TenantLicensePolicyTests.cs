using Microi.License;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;
public class TenantLicensePolicyTests
{
    [Fact]
    public void RuntimePolicyReadsDoNotRecollectOrMutateHardwareIdentity()
    {
        // 隔离已验签运行态；旧 Snapshot 会调用诊断 API 重采集 HID，此断言锁定请求热路径边界。
        var flags = System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic;
        var initialized = typeof(MicroiLicense).GetField("_initialized", flags)!;
        var information = typeof(MicroiLicense).GetField("_licenseInfo", flags)!;
        var product = typeof(MicroiLicense).GetProperty("ProductType")!;
        var previousInitialized = initialized.GetValue(null); var previousInformation = information.GetValue(null); var previousProduct = product.GetValue(null);
        var signed = new Microi.License.LicenseInfo { HID = "signed-hardware-id", ProductType = "Enterprise", ExpirationDate = DateTime.UtcNow.AddDays(2) };
        try
        {
            initialized.SetValue(null, true); information.SetValue(null, signed); product.SetValue(null, "Enterprise");
            for (var i = 0; i < 3; i++) Assert.Equal("Enterprise", TenantLicensePolicy.Snapshot(null)["ProductType"]);
            Assert.Equal("signed-hardware-id", signed.HID);
            product.SetValue(null, "");
            var expired = TenantLicensePolicy.Snapshot(null);
            Assert.Equal("OpenSource", expired["ProductType"]);
            Assert.Equal("Enterprise", expired["SystemProductType"]);
            information.SetValue(null, null);
            Assert.Equal("OpenSource", TenantLicensePolicy.Snapshot(null)["ProductType"]);
        }
        finally
        {
            initialized.SetValue(null, previousInitialized); information.SetValue(null, previousInformation); product.SetValue(null, previousProduct);
        }
    }

    private static readonly DateTime Now = new(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc);
    [Fact]
    public void MissingOverrideInheritsAndNeverCopiesAnEmptyLicense()
    {
        Assert.False(Microi.net.TenantConfigurationSecurity.ShouldCopyFromMain("LicenseProductType"));
        Assert.False(Microi.net.TenantConfigurationSecurity.ShouldCopyFromMain("LicenseExpirationDate"));
        Assert.Equal("Enterprise", TenantLicensePolicy.Resolve("Enterprise", Now.AddYears(10), null, true, Now)["ProductType"]);
        Assert.Equal("OpenSource", TenantLicensePolicy.Resolve("", null, null, true, Now)["ProductType"]);
    }
    [Fact]
    public void ChildCannotOutliveOrUpgradeParentAndExpiresIndependently()
    {
        var child = new JObject { ["LicenseProductType"] = "Enterprise", ["LicenseExpirationDate"] = Now.AddYears(20).ToString("o") };
        var value = TenantLicensePolicy.Resolve("Personal", Now.AddYears(10), child, true, Now);
        Assert.Equal("Personal", value["ProductType"]);
        Assert.Equal(Now.AddYears(10).ToString("o"), value["LicenseExpirationDate"]);
        Assert.Equal(value["LicenseExpirationDate"], value["TenantLicenseExpirationDate"]);
        Assert.Equal("Personal", value["TenantProductType"]);
        child["LicenseExpirationDate"] = Now.AddMinutes(-1).ToString("o");
        Assert.Equal("OpenSource", TenantLicensePolicy.Resolve("Enterprise", Now.AddYears(10), child, true, Now)["ProductType"]);
        child["LicenseExpirationDate"] = "bad";
        Assert.Equal("OpenSource", TenantLicensePolicy.Resolve("Enterprise", Now.AddYears(10), child, true, Now)["ProductType"]);
    }
    [Theory]
    [InlineData("Enterprise", "Personal", 5, true)]
    [InlineData("Enterprise", "Enterprise", 10, true)]
    [InlineData("Enterprise", "Enterprise", 11, false)]
    [InlineData("Personal", "Enterprise", 1, false)]
    [InlineData("OpenSource", "Personal", 1, false)]
    [InlineData("Enterprise", "Personal", 0, false)]
    public void WritesValidateParentUpperBound(string parent, string child, int years, bool valid)
        => Assert.Equal(valid, TenantLicensePolicy.Validate(parent, Now.AddYears(10), child, Now.AddYears(years).ToString("o"), Now) == null);

    [Fact]
    public void ExpiredParentRetainsChildReminderWhileRuntimeRightsStayRevoked()
    {
        var child = new JObject { ["LicenseProductType"] = "Personal", ["LicenseExpirationDate"] = Now.AddDays(-2).ToString("o") };
        var value = TenantLicensePolicy.Resolve("", Now.AddDays(-1), child, true, Now, "Enterprise");
        Assert.Equal("OpenSource", value["ProductType"]);
        Assert.Equal("Personal", value["TenantProductType"]);
        Assert.Equal(Now.AddDays(-2).ToString("o"), value["TenantLicenseExpirationDate"]);
    }

    [Fact]
    public void ByWhereCannotBypassLicenseGuardEvenWithARecordId()
    {
        Assert.Throws<InvalidOperationException>(() => TenantLicensePolicy.ValidateWrite("sys_osclients",
            new Microi.net.DiyTableRowParam { Id = "selected-row" }, new JObject { ["LicenseProductType"] = "Enterprise" }, byWhere: true));
        TenantLicensePolicy.ValidateWrite("sys_osclients", new Microi.net.DiyTableRowParam(), new JObject { ["ClientName"] = "普通配置" }, byWhere: true);
    }
}
