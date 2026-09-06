using Dos.Common;
using Microi.net;

namespace Microi.Tests.Common;

public class TenantRuntimeRecoveryTests
{
    [Fact]
    public async Task ConcurrentCacheMisses_ReloadOnceAndReturnTheCommittedSnapshot()
    {
        OsClientSecret? snapshot = null;
        var calls = 0;
        var key = "main:Product:Internal:recovery-" + Guid.NewGuid();
        var results = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => Task.Run(() =>
            TenantRuntimeRecovery.Resolve(key, () => snapshot, () =>
            {
                Interlocked.Increment(ref calls);
                Thread.Sleep(20);
                snapshot = new OsClientSecret { OsClient = key };
                return new DosResult(1);
            }))));
        Assert.Equal(1, calls);
        Assert.All(results, result => Assert.Same(snapshot, result));
    }

    [Fact]
    public void FailedOrRecursiveLoad_DoesNotPoisonLaterRecovery()
    {
        var key = "main:Product:Internet:retry-" + Guid.NewGuid();
        OsClientSecret? snapshot = null;
        Assert.Null(TenantRuntimeRecovery.Resolve(key, () => snapshot, () =>
        {
            Assert.Null(TenantRuntimeRecovery.Resolve(key, () => snapshot, () => throw new Exception("recursive reload")));
            return new DosResult(0);
        }));
        Assert.Throws<InvalidOperationException>(() => TenantRuntimeRecovery.Resolve(key,
            () => snapshot, () => throw new InvalidOperationException("temporary dependency failure")));
        var result = TenantRuntimeRecovery.Resolve(key, () => snapshot, () =>
        {
            snapshot = new OsClientSecret { OsClient = key };
            return new DosResult(1);
        });
        Assert.Same(snapshot, result);
    }

    [Fact]
    public void RegistrationIdentity_IsStableAndSeparatesTenantsTypesAndNetworks()
    {
        var id = TenantProvisioningService.RuntimeRegistrationId("Tenant-A", "Product", "Internal");
        Assert.Equal(id, TenantProvisioningService.RuntimeRegistrationId(" tenant-a ", "product", "INTERNAL"));
        Assert.NotEqual(id, TenantProvisioningService.RuntimeRegistrationId("tenant-b", "Product", "Internal"));
        Assert.NotEqual(id, TenantProvisioningService.RuntimeRegistrationId("tenant-a", "Dev", "Internal"));
        Assert.NotEqual(id, TenantProvisioningService.RuntimeRegistrationId("tenant-a", "Product", "Internet"));
    }

    [Fact]
    public void BootstrapEncoding_DetectsActualDESAndHashInsteadOfInheritedV8Marker()
    {
        var cipher = EncryptHelper.DESEncode("Bootstrap-Only-Test!9");
        Assert.Equal("DES", TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding(cipher));
        Assert.Equal(PasswordHashSecurity.EncodingName,
            TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding(PasswordHashSecurity.HashPassword("Bootstrap-Test!9")));
        Assert.Null(TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding("custom-one-way-value"));
        Assert.Null(TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding(""));
        // Generic V8 password reveal remains denied; only the separate trusted repair can change metadata.
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword(cipher, "V8").Code);
        Assert.Equal(PasswordHashSecurity.EncodingName,
            TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding("pbkdf2-sha256$malformed"));
    }
}
