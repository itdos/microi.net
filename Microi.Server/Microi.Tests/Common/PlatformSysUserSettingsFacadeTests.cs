using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class PlatformSysUserSettingsFacadeTests
{
    [Fact]
    public void ProfileAtom_BindsExactEngineAndNormalizesOnlyCurrentTenantAvatarPaths()
    {
        var method = new V8Method();
        var user = new JObject
        {
            ["Id"] = "user-a",
            ["Level"] = 1,
            ["Avatar"] = "/tenant-a/member/avatar/old.png"
        };

        using (V8TenantContext.Enter("tenant-a", "lookalike-platform-user-update-profile"))
        using (V8TrustedExecutionContext.EnterForTenant(user, "tenant-a"))
        {
            var wrongEngine = method.PrepareCurrentUserProfileUpdate(new JObject
            {
                ["Avatar"] = "/tenant-a/member/avatar/new.png"
            });
            Assert.Equal(0, wrongEngine.Code);
            Assert.Contains("无权", wrongEngine.Msg);
        }

        using (V8TenantContext.Enter("tenant-a", "platform-user-update-profile"))
        using (V8TrustedExecutionContext.EnterForTenant(user, "tenant-a"))
        {
            var crossTenant = method.PrepareCurrentUserProfileUpdate(new JObject
            {
                ["Avatar"] = "/tenant-b/member/avatar/new.png"
            });
            Assert.Equal(0, crossTenant.Code);

            var valid = method.PrepareCurrentUserProfileUpdate(new JObject
            {
                ["Avatar"] = "/TENANT-A/member/avatar/new.png",
                ["PublicAvatar"] = "/tenant-a/member/public-avatar/public.png",
                ["Id"] = "attacker-user",
                ["OsClient"] = "tenant-b"
            });
            Assert.True(valid.Code == 1, valid.Msg);
            var data = Assert.IsType<JObject>(valid.Data);
            Assert.Equal("user-a", data["UserId"]?.ToString());
            Assert.Equal("tenant-a", data["OsClient"]?.ToString());
            Assert.Equal("/tenant-a/member/avatar/new.png", data["Avatar"]?.ToString());
            Assert.Equal("/tenant-a/member/public-avatar/public.png", data["PublicAvatar"]?.ToString());
            Assert.Null(data["Id"]);
        }
    }

    [Fact]
    public void ProfileAndTenantSettingsAtoms_RejectAccessKeySessions()
    {
        var accessKeyUser = new JObject
        {
            ["Id"] = "access-key-user",
            ["Level"] = 9999,
            ["_AccessKeySession"] = true
        };
        var method = new V8Method();

        using (V8TenantContext.Enter("tenant-a", "platform-user-update-profile"))
        using (V8TrustedExecutionContext.EnterForTenant(accessKeyUser, "tenant-a"))
        {
            var profile = method.PrepareCurrentUserProfileUpdate(new JObject { ["Name"] = "name" });
            Assert.Equal(0, profile.Code);
            Assert.Contains("访问密钥", profile.Msg);
        }

        using (V8TenantContext.Enter("tenant-a", "platform-tenant-system-settings"))
        using (V8TrustedExecutionContext.EnterForTenant(accessKeyUser, "tenant-a"))
        {
            var settings = method.ValidateTenantSystemSettingsOperation(new JObject { ["Action"] = "List" });
            Assert.Equal(0, settings.Code);
            Assert.Contains("访问密钥", settings.Msg);
        }
    }

    [Fact]
    public void TenantSettingsAtom_AllowsOnlyAdminsAndRejectsSensitiveOrMigratedKeys()
    {
        var method = new V8Method();
        using var tenantScope = V8TenantContext.Enter("tenant-a", "platform-tenant-system-settings");

        using (V8TrustedExecutionContext.EnterForTenant(
                   new JObject { ["Id"] = "ordinary", ["Level"] = 1 },
                   "tenant-a"))
        {
            var ordinary = method.ValidateTenantSystemSettingsOperation(new JObject { ["Action"] = "List" });
            Assert.Equal(0, ordinary.Code);
            Assert.Contains("超级管理员", ordinary.Msg);
        }

        using (V8TrustedExecutionContext.EnterForTenant(
                   new JObject { ["Id"] = "admin", ["Level"] = 999 },
                   "tenant-a"))
        {
            var valid = method.ValidateTenantSystemSettingsOperation(new JObject
            {
                ["Action"] = "SaveNonSecret",
                ["ConfigKey"] = "Feature.Mode",
                ["IsSecret"] = false
            });
            Assert.True(valid.Code == 1, valid.Msg);
            Assert.Equal("Feature.Mode", Assert.IsType<JObject>(valid.Data)["ConfigKey"]?.ToString());

            var sensitive = method.ValidateTenantSystemSettingsOperation(new JObject
            {
                ["Action"] = "SaveNonSecret",
                ["ConfigKey"] = "Feature.ApiKey",
                ["IsSecret"] = false
            });
            Assert.Equal(0, sensitive.Code);
            Assert.Contains("Secret", sensitive.Msg);

            var migrated = method.ValidateTenantSystemSettingsOperation(new JObject
            {
                ["Action"] = "Delete",
                ["ConfigKey"] = "Login.Passkey.Enabled"
            });
            Assert.Equal(0, migrated.Code);
            Assert.Contains("已迁移", migrated.Msg);
        }
    }

    [Fact]
    public void TenantSettingsSecurityProjection_NeverContainsValuesOrCiphertext()
    {
        var method = new V8Method();
        using var tenantScope = V8TenantContext.Enter("missing-test-tenant", "platform-tenant-system-settings");
        using var trustedScope = V8TrustedExecutionContext.EnterForTenant(
            new JObject { ["Id"] = "admin", ["Level"] = 999 },
            "missing-test-tenant");

        var result = method.GetTenantSystemSettingsSecurityProjection();
        Assert.Equal(1, result.Code);
        var data = Assert.IsType<JObject>(result.Data);
        Assert.Equal(2, data.Properties().Count());
        Assert.NotNull(data["SecretStateById"]);
        Assert.NotNull(data["MigratedKeys"]);
        Assert.DoesNotContain("SecretCipher", data.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("ConfigValue", data.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void CreateTenantAtom_RejectsWrongEngineAndAccessKeyBeforeProvisioning()
    {
        var method = new V8Method();
        var originalMaster = OsClientDefault.OsClient;
        try
        {
            OsClientDefault.OsClient = "master-test";
            using (V8TenantContext.Enter("master-test", "platform-create-tenant-lookalike"))
            using (V8TrustedExecutionContext.EnterForTenant(
                       new JObject { ["Id"] = "user-a", ["Level"] = 1 },
                       "master-test"))
            {
                var wrongAuthorization = method.AuthorizeCurrentUserTenantProvisioning();
                Assert.Equal(0, wrongAuthorization.Code);
                Assert.Contains("无权", wrongAuthorization.Msg);

                var wrongEngine = method.ProvisionCurrentUserTenant(new JObject { ["TenantKey"] = "safe" });
                Assert.Equal(0, wrongEngine.Code);
                Assert.Contains("无权", wrongEngine.Msg);
            }

            using (V8TenantContext.Enter("master-test", "platform-create-tenant"))
            using (V8TrustedExecutionContext.EnterForTenant(
                       new JObject
                       {
                           ["Id"] = "access-key-user",
                           ["Level"] = 9999,
                           ["_AccessKeySession"] = true
                       },
                       "master-test"))
            {
                var accessKeyAuthorization = method.AuthorizeCurrentUserTenantProvisioning();
                Assert.Equal(0, accessKeyAuthorization.Code);
                Assert.Contains("访问密钥", accessKeyAuthorization.Msg);

                var accessKey = method.ProvisionCurrentUserTenant(new JObject { ["TenantKey"] = "safe" });
                Assert.Equal(0, accessKey.Code);
                Assert.Contains("访问密钥", accessKey.Msg);
            }
        }
        finally
        {
            OsClientDefault.OsClient = originalMaster;
        }
    }

    [Fact]
    public void OfficialResourcePublishAtom_BindsEngineAndOfficialTenantAndRejectsAccessKeys()
    {
        var method = new V8Method();
        var adminProjection = new JObject
        {
            ["Id"] = "admin-user",
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["_IsAdmin"] = true
        };

        using (V8TenantContext.Enter("iTdos", "get-microi-upgrade-resource-lookalike"))
        using (V8TrustedExecutionContext.EnterForTenant(adminProjection, "iTdos"))
        {
            var wrongEngine = method.AuthorizeOfficialResourcePublish();
            Assert.Equal(0, wrongEngine.Code);
            Assert.Contains("无权", wrongEngine.Msg);
        }

        using (V8TenantContext.Enter("tenant-a", "get-microi-upgrade-resource"))
        using (V8TrustedExecutionContext.EnterForTenant(adminProjection, "tenant-a"))
        {
            var wrongTenant = method.AuthorizeOfficialResourcePublish();
            Assert.Equal(1002, wrongTenant.Code);
            Assert.Contains("官方租户", wrongTenant.Msg);
        }

        var accessKeyAdmin = (JObject)adminProjection.DeepClone();
        accessKeyAdmin["_AccessKeySession"] = true;
        using (V8TenantContext.Enter("iTdos", "get-microi-upgrade-resource"))
        using (V8TrustedExecutionContext.EnterForTenant(accessKeyAdmin, "iTdos"))
        {
            var accessKey = method.AuthorizeOfficialResourcePublish();
            Assert.Equal(0, accessKey.Code);
            Assert.Contains("访问密钥", accessKey.Msg);
        }
    }
}
