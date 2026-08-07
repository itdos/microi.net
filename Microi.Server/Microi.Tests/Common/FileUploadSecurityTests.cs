using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class FileUploadSecurityTests
{
    private static readonly FileUploadSecurityOptions SmallLimits = new()
    {
        MaxFileBytes = 8,
        MaxTotalBytes = 12,
        MaxFileCount = 2
    };

    [Fact]
    public void OrdinaryUserPolicy_ForcesPrivateAndAllowsOnlyKnownRoot()
    {
        var param = new DiyUploadParam
        {
            Limit = false,
            Path = "/file"
        };

        var result = FileUploadSecurity.ApplyInteractivePolicy(param, isPlatformAdmin: false);

        Assert.Null(result);
        Assert.True(param.Limit);
        Assert.Equal("file", param.Path);
    }

    [Theory]
    [InlineData("contracts")]
    [InlineData("file/customer-a")]
    [InlineData("../private")]
    public void OrdinaryUserPolicy_RejectsArbitraryPath(string path)
    {
        var result = FileUploadSecurity.ApplyInteractivePolicy(
            new DiyUploadParam { Path = path },
            isPlatformAdmin: false);

        Assert.NotNull(result);
        Assert.Equal(0, result.Code);
    }

    [Fact]
    public void AdminPolicy_DefaultsPrivateButKeepsExplicitPublicPath()
    {
        var defaultPrivate = new DiyUploadParam { Path = "custom" };
        var explicitPublic = new DiyUploadParam { Path = "custom", Limit = false };

        Assert.Null(FileUploadSecurity.ApplyInteractivePolicy(defaultPrivate, isPlatformAdmin: true));
        Assert.Null(FileUploadSecurity.ApplyInteractivePolicy(explicitPublic, isPlatformAdmin: true));
        Assert.True(defaultPrivate.Limit);
        Assert.False(explicitPublic.Limit);
    }

    [Fact]
    public void ValidatePayload_EnforcesPerFileAndTotalLimitsBeforeUpload()
    {
        var tooLarge = new DiyUploadParam
        {
            Files = new Dictionary<string, Stream>
            {
                ["large.bin"] = new MemoryStream(new byte[9])
            }
        };
        var tooMuch = new DiyUploadParam
        {
            Files = new Dictionary<string, Stream>
            {
                ["a.bin"] = new MemoryStream(new byte[7]),
                ["b.bin"] = new MemoryStream(new byte[6])
            }
        };

        Assert.Equal(0, FileUploadSecurity.ValidatePayload(tooLarge, SmallLimits).Code);
        Assert.Equal(0, FileUploadSecurity.ValidatePayload(tooMuch, SmallLimits).Code);
    }

    [Fact]
    public void ValidatePayload_EnforcesCountAndDuplicateNamesAcrossInputKinds()
    {
        var tooMany = new DiyUploadParam
        {
            FilesByte = new Dictionary<string, byte[]>
            {
                ["a.bin"] = new byte[] { 1 },
                ["b.bin"] = new byte[] { 2 },
                ["c.bin"] = new byte[] { 3 }
            }
        };
        var duplicate = new DiyUploadParam
        {
            Files = new Dictionary<string, Stream>
            {
                ["same.bin"] = new MemoryStream(new byte[] { 1 })
            },
            FilesByte = new Dictionary<string, byte[]>
            {
                ["SAME.bin"] = new byte[] { 2 }
            }
        };

        Assert.Equal(0, FileUploadSecurity.ValidatePayload(tooMany, SmallLimits).Code);
        Assert.Equal(0, FileUploadSecurity.ValidatePayload(duplicate, SmallLimits).Code);
    }

    //zhy：回归验证接口引擎 Base64 别名能阻止 HDFS 再次补入同名 multipart 流。
    [Fact]
    public void ContainsPayloadFileName_DetectsApiEngineBase64AliasCaseInsensitively()
    {
        var param = new DiyUploadParam
        {
            FilesByteBase64 = new Dictionary<string, string>
            {
                ["product-image.jpg"] = "AQ=="
            }
        };

        Assert.True(FileUploadSecurity.ContainsPayloadFileName(param, "PRODUCT-IMAGE.JPG"));
        Assert.False(FileUploadSecurity.ContainsPayloadFileName(param, "other-image.jpg"));
    }

    [Fact]
    public void ValidatePayload_ReturnsExactBytesForAtomicQuotaReservation()
    {
        var param = new DiyUploadParam
        {
            FilesByte = new Dictionary<string, byte[]>
            {
                ["a.bin"] = new byte[] { 1, 2, 3 }
            },
            FilesByteBase64 = new Dictionary<string, string>
            {
                ["b.bin"] = "AQIDBA=="
            }
        };

        var result = FileUploadSecurity.ValidatePayload(param, out var totalBytes, SmallLimits);

        Assert.Null(result);
        Assert.Equal(7, totalBytes);
    }

    [Fact]
    public void DailyQuotaKeys_AreTenantAndUserScopedAndShareRedisClusterSlot()
    {
        var day = new DateTime(2026, 7, 23, 12, 0, 0, DateTimeKind.Utc);
        var userA = FileUploadSecurity.BuildDailyQuotaKeys("tenant-a", "user-a", day);
        var userB = FileUploadSecurity.BuildDailyQuotaKeys("tenant-a", "user-b", day);
        var otherTenant = FileUploadSecurity.BuildDailyQuotaKeys("tenant-b", "user-a", day);

        Assert.Equal(userA.HashTag, userB.HashTag);
        Assert.NotEqual(userA.UserKey, userB.UserKey);
        Assert.Equal(userA.TenantKey, userB.TenantKey);
        Assert.NotEqual(userA.HashTag, otherTenant.HashTag);
        Assert.Contains(userA.HashTag, userA.UserKey);
        Assert.Contains(userA.HashTag, userA.TenantKey);
        Assert.Contains("20260723", userA.UserKey);
    }

    [Fact]
    public void TenantOverrides_TakePriorityOverFallbackWithinAbsoluteCaps()
    {
        var hardLimits = new FileUploadSecurityOptions
        {
            MaxFileBytes = 100 * 1024L * 1024L,
            MaxTotalBytes = 200 * 1024L * 1024L,
            MaxFileCount = 10,
            DailyUserQuotaBytes = 2048 * 1024L * 1024L,
            DailyTenantQuotaBytes = 20480 * 1024L * 1024L
        };
        var tenant = JObject.Parse(@"{
            'FileUploadMaxFileMB': 500,
            'FileUploadMaxRequestMB': 800,
            'FileUploadMaxCount': 30,
            'FileUploadDailyUserQuotaMB': 4096,
            'FileUploadDailyTenantQuotaMB': 8192
        }");

        var result = FileUploadSecurityOptions.ApplyTenantOverrides(hardLimits, tenant);

        Assert.Equal(500 * 1024L * 1024L, result.MaxFileBytes);
        Assert.Equal(800 * 1024L * 1024L, result.MaxTotalBytes);
        Assert.Equal(30, result.MaxFileCount);
        Assert.Equal(4096 * 1024L * 1024L, result.DailyUserQuotaBytes);
        Assert.Equal(8192 * 1024L * 1024L, result.DailyTenantQuotaBytes);
    }

    [Fact]
    public void TenantOverrides_CannotBreakIndependentAbsoluteCaps()
    {
        var hardLimits = new FileUploadSecurityOptions
        {
            MaxFileBytes = 100 * 1024L * 1024L,
            MaxTotalBytes = 200 * 1024L * 1024L,
            MaxFileCount = 10,
            DailyUserQuotaBytes = 2048 * 1024L * 1024L,
            DailyTenantQuotaBytes = 20480 * 1024L * 1024L
        };
        var tenant = JObject.Parse(@"{
            'FileUploadMaxFileMB': 5000,
            'FileUploadMaxRequestMB': 5000,
            'FileUploadMaxCount': 1000,
            'FileUploadDailyUserQuotaMB': 99999999,
            'FileUploadDailyTenantQuotaMB': 99999999
        }");

        var result = FileUploadSecurityOptions.ApplyTenantOverrides(hardLimits, tenant);

        Assert.Equal(
            FileUploadSecurityOptions.DefaultAbsoluteMaxFileMegabytes
            * 1024L * 1024L,
            result.MaxFileBytes);
        Assert.Equal(
            FileUploadSecurityOptions.DefaultAbsoluteMaxTotalMegabytes
            * 1024L * 1024L,
            result.MaxTotalBytes);
        Assert.Equal(
            FileUploadSecurityOptions.DefaultAbsoluteMaxFileCount,
            result.MaxFileCount);
        Assert.Equal(
            FileUploadSecurityOptions.DefaultAbsoluteDailyQuotaMegabytes
            * 1024L * 1024L,
            result.DailyUserQuotaBytes);
        Assert.Equal(
            FileUploadSecurityOptions.DefaultAbsoluteDailyQuotaMegabytes
            * 1024L * 1024L,
            result.DailyTenantQuotaBytes);
        Assert.True(result.UploadEnabled);
    }

    [Theory]
    [InlineData("0", false)]
    [InlineData("false", false)]
    [InlineData("1", true)]
    [InlineData("true", true)]
    public void TenantUploadSwitch_IsExplicitAndBlankKeepsCompatibility(
        string configuredValue,
        bool expected)
    {
        var hardLimits = new FileUploadSecurityOptions
        {
            MaxFileBytes = 100,
            MaxTotalBytes = 200,
            MaxFileCount = 10,
            DailyUserQuotaBytes = 1000,
            DailyTenantQuotaBytes = 2000
        };

        var result = FileUploadSecurityOptions.ApplyTenantOverrides(
            hardLimits,
            new JObject { ["FileUploadEnabled"] = configuredValue });
        var blank = FileUploadSecurityOptions.ApplyTenantOverrides(
            hardLimits,
            new JObject { ["FileUploadEnabled"] = "" });

        Assert.Equal(expected, result.UploadEnabled);
        Assert.True(blank.UploadEnabled);
    }

    [Fact]
    public void TenantUploadSwitch_CannotReenableGlobalForceDisable()
    {
        var hardLimits = new FileUploadSecurityOptions
        {
            MaxFileBytes = 100,
            MaxTotalBytes = 200,
            MaxFileCount = 10,
            DailyUserQuotaBytes = 1000,
            DailyTenantQuotaBytes = 2000,
            UploadEnabled = true
        };
        var absoluteCaps = new FileUploadSecurityOptions
        {
            MaxFileBytes = 1000,
            MaxTotalBytes = 2000,
            MaxFileCount = 100,
            DailyUserQuotaBytes = 10000,
            DailyTenantQuotaBytes = 20000,
            UploadEnabled = false
        };

        var result = FileUploadSecurityOptions.ApplyTenantOverrides(
            hardLimits,
            new JObject { ["FileUploadEnabled"] = 1 },
            absoluteCaps);

        Assert.False(result.UploadEnabled);
    }

    [Fact]
    public void MissingTenantValues_KeepPlatformCodeDefaults()
    {
        var fallback = new FileUploadSecurityOptions
        {
            MaxFileBytes = 321,
            MaxTotalBytes = 654,
            MaxFileCount = 7,
            DailyUserQuotaBytes = 987,
            DailyTenantQuotaBytes = 1234,
            UploadEnabled = true
        };

        var result = FileUploadSecurityOptions.ApplyTenantOverrides(
            fallback,
            new JObject
            {
                ["FileUploadMaxFileMB"] = "",
                ["FileUploadMaxRequestMB"] = null
            });

        Assert.Equal(fallback.MaxFileBytes, result.MaxFileBytes);
        Assert.Equal(fallback.MaxTotalBytes, result.MaxTotalBytes);
        Assert.Equal(fallback.MaxFileCount, result.MaxFileCount);
        Assert.Equal(fallback.DailyUserQuotaBytes, result.DailyUserQuotaBytes);
        Assert.Equal(
            fallback.DailyTenantQuotaBytes,
            result.DailyTenantQuotaBytes);
    }

    [Theory]
    [InlineData("AQIDBA==", 4)]
    [InlineData("AQID\nBA==", 4)]
    [InlineData("", 0)]
    public void Base64Length_IsComputedWithoutDecoding(string value, long expected)
    {
        Assert.True(FileUploadSecurity.TryGetBase64DecodedLength(value, out var length));
        Assert.Equal(expected, length);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("!!!!")]
    [InlineData("AQ=IDBA=")]
    public void Base64Length_RejectsInvalidInput(string value)
    {
        Assert.False(FileUploadSecurity.TryGetBase64DecodedLength(value, out _));
    }

    [Fact]
    public void PrivateFileContext_BindsNestedTableChildAuthorizationChain()
    {
        var param = JObject.Parse("""
        {
          "FormEngineKey": "child_table",
          "FormDataId": "child-row",
          "FieldId": "attachment-field",
          "SysMenuId": "hidden-child-menu",
          "_TableChildAuth": {
            "ParentSysMenuId": "customer-menu",
            "ParentTableId": "customer-table",
            "ParentFieldId": "child-field",
            "ParentRowId": "customer-row",
            "ParentValue": "customer-row",
            "ParentFormMode": "View",
            "Parent": {
              "ParentSysMenuId": "root-menu",
              "ParentTableId": "root-table",
              "ParentFieldId": "customer-field",
              "ParentRowId": "root-row",
              "ParentValue": "root-row",
              "ParentFormMode": "View"
            }
          }
        }
        """).ToObject<DiyUploadParam>();

        Assert.NotNull(param);
        Assert.Equal("hidden-child-menu", param.SysMenuId);
        Assert.NotNull(param._TableChildAuth);
        Assert.Equal("customer-menu", param._TableChildAuth.ParentSysMenuId);
        Assert.Equal("child-field", param._TableChildAuth.ParentFieldId);
        Assert.NotNull(param._TableChildAuth.Parent);
        Assert.Equal("root-menu", param._TableChildAuth.Parent.ParentSysMenuId);
        Assert.Equal("root-row", param._TableChildAuth.Parent.ParentRowId);
    }
}
