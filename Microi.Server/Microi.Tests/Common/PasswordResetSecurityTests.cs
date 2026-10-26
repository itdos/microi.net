using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class PasswordResetSecurityTests
{
    [Fact]
    public void Registration_PreservesPasswordBytesUsedByLoginAndReset()
    {
        const string original = "  Exact-Fixture!9  ";
        var value = PasswordResetSecurity.ReadRegistrationPassword(new JValue(original));
        Assert.Equal(original, value);
        var stored = PasswordHashSecurity.HashPassword(value);
        Assert.True(PasswordHashSecurity.VerifyPassword(original, stored));
        Assert.False(PasswordHashSecurity.VerifyPassword(original.Trim(), stored));
        Assert.Equal("", PasswordResetSecurity.ReadRegistrationPassword(null));
    }

    [Theory]
    [InlineData("      ")]
    [InlineData("\t\r\n")]
    public void Registration_RejectsExplicitWhitespacePasswords(string value)
    {
        Assert.Throws<ArgumentException>(() => PasswordResetSecurity.ReadRegistrationPassword(new JValue(value)));
    }

    [Fact]
    public void Registration_RejectsOversizedPasswordRatherThanSilentlyTruncating()
    {
        Assert.Throws<ArgumentException>(() => PasswordResetSecurity.ReadRegistrationPassword(new JValue(new string('a', 201))));
    }

    [Theory]
    [InlineData("ResetPlatformSmsPassword")]
    [InlineData("RepairPlatformPasswordEncoding")]
    public void RequiredPackageCapabilities_AreExposedByTheV8Contract(string method)
    {
        Assert.NotNull(typeof(IV8Method).GetMethod(method));
        Assert.Equal(typeof(DosResult), typeof(V8Method).GetMethod(method)!.ReturnType);
    }

    [Fact]
    public void LegacySmsResetMismatch_IsRepairedWithoutChangingThePassword()
    {
        const string newPassword = "Reset-Fixture!9";
        var damaged = User(EncryptHelper.DESEncode(newPassword), PasswordHashSecurity.EncodingName);
        // 重现旧接口仅写 DES Pwd、保留 PBKDF2 标识后的真实校验失败。
        Assert.False(PasswordHashSecurity.VerifyPassword(newPassword, damaged.Value<string>("Pwd")));
        Assert.Equal("LegacyCipherWithHashEncoding", PasswordResetSecurity.Classify(damaged));
        var repaired = PasswordResetSecurity.CreateRepairedHash(damaged);
        Assert.True(PasswordHashSecurity.VerifyPassword(newPassword, repaired));
        Assert.False(PasswordHashSecurity.VerifyPassword("Old-Fixture!9", repaired));
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword(repaired, PasswordHashSecurity.EncodingName).Code);
    }

    [Theory]
    [InlineData("pbkdf2-sha256$broken", "PBKDF2-SHA256", "HashPresent")]
    [InlineData("not-cipher", "PBKDF2-SHA256", "UnsupportedMaterial")]
    [InlineData("not-cipher", "V8", "OtherEncoding")]
    public void Repair_NeverDowngradesOrRewritesUnprovenMaterials(string stored, string encoding, string classification)
    {
        var user = User(stored, encoding);
        Assert.Equal(classification, PasswordResetSecurity.Classify(user));
        Assert.Null(PasswordResetSecurity.CreateRepairedHash(user));
    }

    [Fact]
    public void Repair_LeavesValidHashAndNormalLegacyAccountUntouched()
    {
        var modern = User(PasswordHashSecurity.HashPassword("Existing-Fixture!9"), PasswordHashSecurity.EncodingName);
        Assert.Equal("HashPresent", PasswordResetSecurity.Classify(modern));
        Assert.Null(PasswordResetSecurity.CreateRepairedHash(modern));
        var legacy = User(EncryptHelper.DESEncode("Existing-Fixture!9"), "DES");
        Assert.Equal("OtherEncoding", PasswordResetSecurity.Classify(legacy));
        Assert.Null(PasswordResetSecurity.CreateRepairedHash(legacy));
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    [InlineData(1, true)]
    [InlineData(2, false)]
    public void Reset_PreservesLegacyActiveStateSemantics(int state, bool expected)
    {
        var user = User("", "");
        user["State"] = state;
        Assert.Equal(expected, PasswordResetSecurity.IsResettable(user));
        user["IsDeleted"] = 1;
        Assert.False(PasswordResetSecurity.IsResettable(user));
    }

    [Fact]
    public void Reset_PreservesExactPasswordAndRejectsTruncatedOrMismatchedInput()
    {
        var request = Request("  Fixture!9  ");
        Assert.Null(PasswordResetSecurity.Validate(request));
        request["ConfirmPassword"] = "Fixture!9";
        Assert.Equal("PasswordResetConfirmationMismatch", PasswordResetSecurity.Validate(request));
        request = Request(new string('x', 33));
        Assert.Equal("PasswordResetInvalidPassword", PasswordResetSecurity.Validate(request));
        request = Request("12345");
        Assert.Equal("PasswordResetInvalidPassword", PasswordResetSecurity.Validate(request));
        request = Request("Fixture!9");
        request["SmsCode"] = "Allow";
        Assert.Equal("PasswordResetInvalidSms", PasswordResetSecurity.Validate(request));
    }

    [Theory]
    [InlineData(-2)]
    [InlineData(-1)]
    [InlineData(0)]
    public void Reset_DoesNotHashBeforeSmsProofIsConsumed(long status)
    {
        Assert.Throws<InvalidOperationException>(() => PasswordResetSecurity.HashVerifiedPassword(status, "Fixture!9"));
    }

    [Fact]
    public void Reset_AcceptedProofProducesTheExpectedModernCredential()
    {
        var hash = PasswordResetSecurity.HashVerifiedPassword(1, "Fixture!9");
        Assert.True(PasswordHashSecurity.VerifyPassword("Fixture!9", hash));
        Assert.False(PasswordHashSecurity.VerifyPassword("Other!9", hash));
    }

    [Fact]
    public void Repair_RequiresAnExplicitBoundedUserSelection()
    {
        Assert.Null(PasswordResetSecurity.ReadRepairUserIds(new JObject()));
        Assert.Null(PasswordResetSecurity.ReadRepairUserIds(new JObject { ["UserIds"] = new JArray() }));
        Assert.Null(PasswordResetSecurity.ReadRepairUserIds(new JObject { ["UserIds"] = new JArray(Enumerable.Range(0, 21).Select(x => "user-" + x)) }));
        Assert.Null(PasswordResetSecurity.ReadRepairUserIds(new JObject { ["UserIds"] = new JArray("user' OR 1=1") }));
        Assert.Equal(new[] { "user-1", "user-2" }, PasswordResetSecurity.ReadRepairUserIds(
            new JObject { ["UserIds"] = new JArray("user-1", "USER-1", "user-2") }));
    }

    [Fact]
    public void CommittedPasswordReset_RetriesTransientRevocationWithoutFailureAudit()
    {
        var attempts = 0;
        var failures = 0;
        V8Method.CompletePasswordResetSessionRevocation(
            () => new Dos.Common.DosResult(++attempts == 2 ? 1 : 0), () => failures++);
        Assert.Equal(2, attempts);
        Assert.Equal(0, failures);
    }

    [Fact]
    public void CommittedPasswordReset_PersistentRevocationFailureIsBoundedAndAudited()
    {
        var attempts = 0;
        var failures = 0;
        var error = Assert.Throws<InvalidOperationException>(() => V8Method.CompletePasswordResetSessionRevocation(
            () => { attempts++; throw new InvalidOperationException("sensitive backend diagnostic"); },
            () => failures++));
        Assert.Equal(2, attempts);
        Assert.Equal(1, failures);
        Assert.Equal("PasswordResetSessionRevocationFailed", error.Message);
        Assert.Null(error.InnerException);
    }

    [Fact]
    public void TrustedPasswordAtoms_RejectMissingAndWrongEngineContexts()
    {
        var method = new V8Method();
        Assert.NotEqual(1, method.ResetPlatformSmsPassword(Request("Fixture!9")).Code);
        Assert.NotEqual(1, method.RepairPlatformPasswordEncoding(new JObject()).Code);
        using (V8TenantContext.Enter("test-tenant", "arbitrary-tenant-engine"))
        {
            Assert.NotEqual(1, method.ResetPlatformSmsPassword(Request("Fixture!9")).Code);
            Assert.NotEqual(1, method.RepairPlatformPasswordEncoding(new JObject()).Code);
        }
    }

    private static JObject Request(string password) => new()
    {
        ["Phone"] = "13000000000", ["SmsCode"] = "123456",
        ["NewPassword"] = password, ["ConfirmPassword"] = password
    };

    private static JObject User(string stored, string encoding) => new()
    {
        ["Id"] = "fixture-user", ["State"] = 1, ["IsDeleted"] = 0,
        ["Pwd"] = stored, ["PwdEncode"] = encoding
    };
}
