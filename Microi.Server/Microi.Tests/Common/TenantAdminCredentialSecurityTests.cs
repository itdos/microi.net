using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microi.net;
using Microi.net.Api;

namespace Microi.Tests.Common;

public class TenantAdminCredentialSecurityTests
{
    [Fact]
    public void RandomTenantAdminPassword_IsStrongUnambiguousAndUnique()
    {
        var passwords = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < 128; index++)
        {
            var password = TenantAdminCredentialSecurity.GenerateRandomPassword();

            Assert.Equal(TenantAdminCredentialSecurity.DefaultPasswordLength, password.Length);
            Assert.Matches("[a-z]", password);
            Assert.Matches("[A-Z]", password);
            Assert.Matches("[0-9]", password);
            Assert.Matches("[!@#$%*_=+-]", password);
            Assert.DoesNotContain(' ', password);
            Assert.DoesNotContain('O', password);
            Assert.DoesNotContain('0', password);
            Assert.True(passwords.Add(password), "CSPRNG password unexpectedly repeated.");
        }
    }

    [Theory]
    [InlineData(nameof(SysUserController.GetOwnedTenantAdminPassword))]
    [InlineData(nameof(SysUserController.ResetOwnedTenantAdminPassword))]
    public void OwnedTenantAdminCredentialEndpoints_ArePostOnlyAndAuthenticated(string actionName)
    {
        var action = typeof(SysUserController).GetMethod(actionName);

        Assert.NotNull(action);
        Assert.NotNull(action!.GetCustomAttribute<HttpPostAttribute>());
        Assert.Null(action.GetCustomAttribute<HttpGetAttribute>());
        Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(15)]
    [InlineData(65)]
    public void RandomTenantAdminPassword_RejectsUnsafeLengths(int length)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => TenantAdminCredentialSecurity.GenerateRandomPassword(length));
    }

    [Fact]
    public void PasswordHash_IsSaltedVersionedAndVerifiable()
    {
        const string password = "Microi-Test-Password!9";
        var first = PasswordHashSecurity.HashPassword(password);
        var second = PasswordHashSecurity.HashPassword(password);

        Assert.StartsWith("pbkdf2-sha256$210000$", first, StringComparison.Ordinal);
        Assert.NotEqual(first, second);
        Assert.True(PasswordHashSecurity.IsSupportedEncoding(PasswordHashSecurity.EncodingName));
        Assert.True(PasswordHashSecurity.IsRecognizedHash(first));
        Assert.False(PasswordHashSecurity.IsRecognizedHash("legacy-des-value"));
        Assert.True(PasswordHashSecurity.VerifyPassword(password, first));
        Assert.True(PasswordHashSecurity.VerifyPassword(password, second));
        Assert.False(PasswordHashSecurity.VerifyPassword(password + "-wrong", first));
    }

    [Theory]
    [InlineData("")]
    [InlineData("pbkdf2-sha256$99999$AA==$AA==")]
    [InlineData("pbkdf2-sha256$2000001$AA==$AA==")]
    [InlineData("pbkdf2-sha256$210000$not-base64$not-base64")]
    public void PasswordHash_RejectsMalformedOrUnsafeValues(string storedValue)
    {
        Assert.False(PasswordHashSecurity.VerifyPassword("password", storedValue));
        if (storedValue.StartsWith("pbkdf2-sha256$", StringComparison.Ordinal))
        {
            Assert.True(PasswordHashSecurity.IsRecognizedHash(storedValue));
        }
    }

    [Fact]
    public void ModernPasswordHash_IsNeverReversiblyDisplayed()
    {
        var stored = PasswordHashSecurity.HashPassword("One-Time-Only!8");

        var result = SysUserLogic.DecodeStoredPassword(stored, PasswordHashSecurity.EncodingName);

        Assert.Equal(0, result.Code);
        Assert.Contains("单向密码哈希", result.Msg, StringComparison.Ordinal);
        Assert.Null(result.Data);
    }
}
