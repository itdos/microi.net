using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class SaasPromotionSecurityTests
{
    [Theory]
    [InlineData("2026-10-05T15:44:31.1234567Z")]
    [InlineData("2026-10-05T23:44:31.1234567+08:00")]
    public void SignedCapabilityTimes_KeepTheirOriginalUtcOrOffsetAfterJsonRoundTrip(string value)
    {
        var json = new JObject { ["CreatedUtc"] = value, ["ExpiresUtc"] = value }.ToString();
        Assert.Equal(JTokenType.Date, JObject.Parse(json)["CreatedUtc"].Type);
        var parsed = SaasPromotionSecurity.ParseCapabilityPayload(json);
        Assert.Equal(JTokenType.String, parsed["CreatedUtc"].Type);
        Assert.Equal(value, parsed["CreatedUtc"].ToString());
        Assert.Equal(DateTimeOffset.Parse(value).UtcDateTime,
            DateTimeOffset.Parse(parsed["CreatedUtc"].ToString()).UtcDateTime);
    }

    [Theory]
    [InlineData("trial_with_underscore", "", true, true, "")]
    [InlineData("trial-with-dash", "", true, true, "")]
    [InlineData("trial", "customer.example.com", true, false, "customer.example.com")]
    [InlineData("trial", "", false, true, "trial.microi.net")]
    [InlineData("trial_with_underscore", "", false, false, "trial_with_underscore.microi.net")]
    [InlineData("trial_with_underscore", "customer.example.com", false, true, "customer.example.com")]
    [InlineData("trial", "https://customer.example.com/path", false, false, "https://customer.example.com/path")]
    public void PublicProvisioning_UsesMainLaunchUrlAndPreservesAdminDomainCompatibility(
        string tenantKey, string requested, bool publicTrial, bool expected, string expectedDomain)
    {
        Assert.Equal(expected, SaasPromotionSecurity.TryResolveProvisioningDomain(tenantKey, requested, publicTrial, out var domain));
        Assert.Equal(expectedDomain, domain);
    }

    [Fact]
    public void NonHumanTrialPrincipal_FitsLegacyUserIdAndCanonicalizesUuidAliases()
    {
        const string requestId = "fb3a14d1-981a-497c-bd12-36a1896e9c12";
        var principal = SaasPromotionSecurity.PublicTrialPrincipalId(requestId);
        Assert.Equal(35, principal.Length);
        Assert.StartsWith("pt:", principal);
        Assert.Equal(principal, SaasPromotionSecurity.PublicTrialPrincipalId(requestId.Replace("-", "").ToUpperInvariant()));
        Assert.Throws<FormatException>(() => SaasPromotionSecurity.PublicTrialPrincipalId("invalid"));
    }

    [Theory]
    [InlineData("Failed", 1, 3, 0, "mci_saas_referral_link", true)]
    [InlineData("Failed", 2, 3, 0, "mci_saas_referral_link", true)]
    [InlineData("Failed", 3, 3, 0, "mci_saas_referral_link", false)]
    [InlineData("Failed", 0, 3, 0, "mci_saas_referral_link", false)]
    [InlineData("Running", 1, 3, 0, "mci_saas_referral_link", false)]
    [InlineData("Succeeded", 1, 3, 0, "mci_saas_referral_link", false)]
    [InlineData("Failed", 1, 4, 0, "mci_saas_referral_link", false)]
    [InlineData("Failed", 1, 3, 1, "mci_saas_referral_link", false)]
    [InlineData("Failed", 1, 3, 0, "another_table", false)]
    public void TaskResume_OnlyAllowsBoundFailedAttemptsWithinBudget(
        string status, int attempt, int maximum, int canceled, string table, bool expected)
    {
        var task = new BackgroundTaskRecord { ApiEngineKey = SaasPromotionSecurity.WorkerEngine,
            Status = status, AttemptCount = 0, ExecutionCount = attempt, MaxAttempts = maximum, CancelRequested = canceled != 0,
            BusinessTable = table, BusinessId = "link" };
        Assert.Equal(expected, SaasPromotionSecurity.CanResumePublicTrialTask(task));
        task.ApiEngineKey = "another-worker";
        Assert.False(SaasPromotionSecurity.CanResumePublicTrialTask(task));
        task.ApiEngineKey = SaasPromotionSecurity.WorkerEngine;
        task.BusinessId = "";
        Assert.False(SaasPromotionSecurity.CanResumePublicTrialTask(task));
    }

    [Fact]
    public void UrlTenantAndUnverifiedTokenWithoutCachedUser_AreNotAuthenticatedSessions()
    {
        Assert.False(SaasPromotionSecurity.HasAuthenticatedSession(null));
        Assert.False(SaasPromotionSecurity.HasAuthenticatedSession(new CurrentToken { OsClient = "main" }));
        Assert.False(SaasPromotionSecurity.HasAuthenticatedSession(new CurrentToken { OsClient = "main", Token = "unverified" }));
        Assert.False(SaasPromotionSecurity.HasAuthenticatedSession(new CurrentToken { OsClient = "main", CurrentUser = new JObject { ["Id"] = "admin" } }));
        Assert.False(SaasPromotionSecurity.HasAuthenticatedSession(new CurrentToken { Token = "verified", CurrentUser = new JObject { ["Id"] = "admin" } }));
        Assert.True(SaasPromotionSecurity.HasAuthenticatedSession(new CurrentToken { OsClient = "main", Token = "verified-by-DiyToken", CurrentUser = new JObject { ["Id"] = "admin" } }));
    }

    [Fact]
    public void PublicResolver_ReachesItsOwnFixedPageAuthorizationBeforeGenericLoginFilter()
    {
        var method = typeof(Microi.net.Api.MicroAppController).GetMethod("Resolve");
        Assert.NotNull(method);
        Assert.NotEmpty(method.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), true));
    }

    [Theory]
    [InlineData("13800138000", true)]
    [InlineData("+86 (010) 1234-5678", true)]
    [InlineData("      ", false)]
    [InlineData("+++---", false)]
    [InlineData("12345", false)]
    [InlineData("1234567890123456", false)]
    public void PublicContactPhone_RequiresActualDigits(string value, bool expected) =>
        Assert.Equal(expected, SaasPromotionSecurity.ValidContactPhone(value));

    [Theory]
    [InlineData("unrelated-engine")]
    [InlineData("platform-saas-promotion-hook")]
    public void PublicAtoms_CannotBeInvokedFromAnotherV8Engine(string key)
    {
        using var scope = V8TenantContext.Enter("main", key);
        var method = new V8Method();
        var forged = new JObject { ["Action"] = "Queue", ["GrantCipher"] = "forged",
            ["_CurrentUser"] = new JObject { ["Id"] = "admin", ["Level"] = 9999 } };
        Assert.NotEqual(1, method.SaasPublicTrialAtom(forged).Code);
        Assert.NotEqual(1, method.ProvisionPublicSaasTrial(forged).Code);
        Assert.NotEqual(1, method.AuthorizeSaasPromotion().Code);
        Assert.NotEqual(1, method.ReadSaasTenantUsage(new JObject { ["TenantIds"] = new JArray("foreign") }).Code);
        Assert.NotEqual(1, method.CreateSaasReferralCapability("foreign").Code);
        Assert.NotEqual(1, method.ResumeSaasPublicTrialTask("foreign").Code);
    }

    [Fact]
    public void Worker_CannotForgeTheDurableTaskAndFence()
    {
        using var scope = V8TenantContext.Enter("main", SaasPromotionSecurity.WorkerEngine);
        var result = new V8Method().ProvisionPublicSaasTrial(new JObject
        { ["GrantCipher"] = "forged", ["_BackgroundTaskId"] = "forged-task", ["_BackgroundTaskFencingToken"] = 1 });
        Assert.NotEqual(1, result.Code);
    }

    [Theory]
    [InlineData("main", "microi-platform-service", "/saas-trial", true)]
    [InlineData("child", "microi-platform-service", "/saas-trial", false)]
    [InlineData("main", "other-app", "/saas-trial", false)]
    [InlineData("main", "microi-platform-service", "/system-settings", false)]
    [InlineData("main", "microi-platform-service", "/saas-trial/", false)]
    [InlineData("main", "microi-platform-service", "/saas-trial?src=other", false)]
    public void PublicResolver_AllowsOnlyFixedMainApplicationPage(string tenant, string app, string route, bool expected) =>
        Assert.Equal(expected, SaasPromotionSecurity.IsPublicTrialRoute(tenant, app, route, "main"));

    [Fact]
    public void ReferralScope_DoesNotGrantUnassignedOrAnotherSalesperson()
    {
        var tenant = new JObject { ["ReferralUserId"] = "sales-a" };
        Assert.True(SaasPromotionSecurity.CanReadTenant(false, "sales-a", tenant));
        Assert.False(SaasPromotionSecurity.CanReadTenant(false, "sales-b", tenant));
        Assert.False(SaasPromotionSecurity.CanReadTenant(false, "sales-a", new JObject()));
        Assert.False(SaasPromotionSecurity.CanReadTenant(false, "", new JObject()));
        Assert.True(SaasPromotionSecurity.CanReadTenant(true, "manager", tenant));
    }

    [Theory]
    [InlineData("fb3a14d1-981a-497c-bd12-36a1896e9c12", true)]
    [InlineData("fb3a14d1981a497cbd1236a1896e9c12", true)]
    [InlineData("--------------------------------", false)]
    [InlineData("customer-trial", false)]
    public void IdempotencyIdentifier_MustBeRealUuid(string value, bool expected) =>
        Assert.Equal(expected, SaasPromotionSecurity.ValidRequestId(value));

    [Theory]
    [InlineData("customer_a", true)]
    [InlineData("a", false)]
    [InlineData("123customer", false)]
    [InlineData("../main", false)]
    [InlineData("customer' OR 1=1", false)]
    public void PublicTenantIdentifier_IsBoundedAndCannotBecomeSqlOrPath(string value, bool expected) =>
        Assert.Equal(expected, SaasPromotionSecurity.ValidTenantKey(value));

    [Fact]
    public void TrialDates_AreUtcAndMissingLegacyDatesAreUnclassified()
    {
        var utc = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var row = new JObject { ["IsEnable"] = 1 };
        Assert.Equal("Unclassified", SaasPromotionSecurity.TrialState(row, utc));
        row["TrialEndTime"] = "2026-10-05 11:59:00";
        Assert.Equal("Expired", SaasPromotionSecurity.TrialState(row, utc));
        row["TrialEndTime"] = "2026-10-08 12:00:00";
        Assert.Equal("Expiring", SaasPromotionSecurity.TrialState(row, utc));
        row["TrialEndTime"] = "2026-11-08 12:00:00";
        Assert.Equal("Trial", SaasPromotionSecurity.TrialState(row, utc));
        row["PromotionStage"] = "Converted";
        Assert.Equal("Converted", SaasPromotionSecurity.TrialState(row, utc));
        row["IsEnable"] = 0;
        Assert.Equal("Disabled", SaasPromotionSecurity.TrialState(row, utc));
    }

    [Fact]
    public void PublicProgress_NeverReturnsCredentialConnectionOrTaskGrant()
    {
        var data = new JObject { ["OsClient"] = "customer", ["AdminAccount"] = "admin", ["LaunchUrl"] = "https://main.example/?OsClient=customer",
            ["DbConn"] = "database-secret", ["EncryptedPwd"] = "password-hash", ["GrantCipher"] = "task-capability",
            ["Upgrade"] = new JObject { ["DbConn"] = "nested-secret" } };
        var projected = SaasPromotionSecurity.SafeTrialProgress(new JObject { ["Data"] = data });
        Assert.Equal(3, projected.Count);
        Assert.Equal("customer", projected["OsClient"]?.ToString());
        Assert.DoesNotContain("secret", projected.ToString(), StringComparison.Ordinal);
        Assert.Null(projected["EncryptedPwd"]);
        Assert.Null(projected["GrantCipher"]);
        Assert.Null(projected["Upgrade"]);
    }

    [Theory]
    [InlineData("ReferralUserId")]
    [InlineData("PublicTrialRequestId")]
    [InlineData("PublicTrialProvisioned")]
    [InlineData("TrialEndTime")]
    [InlineData("PromotionContact")]
    [InlineData("SaasPublicTrialEnabled")]
    [InlineData("SaasPromotionManagerRoleIds")]
    public void MainConfigurationAndReferralIdentity_AreNeverCopiedIntoChild(string field)
    {
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain(field));
    }
}
