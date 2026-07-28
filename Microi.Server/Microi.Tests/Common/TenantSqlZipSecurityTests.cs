using System.IO.Compression;
using System.Text;
using Microi.net;

namespace Dos.Common.Tests;

public class TenantSqlZipSecurityTests
{
    [Fact]
    public void ValidPackage_RequiresExactlyOneRootSqlFile()
    {
        var result = TenantProvisioningService.ValidateTenantSqlZipPackage(
            CreateZip(("tenant.sql", "CREATE TABLE test(Id varchar(50));")));

        Assert.Equal(1, result.Code);
    }

    [Fact]
    public void PackageWithMultipleEntries_IsRejected()
    {
        var result = TenantProvisioningService.ValidateTenantSqlZipPackage(
            CreateZip(("one.sql", "SELECT 1;"), ("two.sql", "SELECT 2;")));

        Assert.Equal(0, result.Code);
        Assert.Contains("必须且只能有一个", result.Msg);
    }

    [Theory]
    [InlineData("nested/tenant.sql")]
    [InlineData("tenant.txt")]
    [InlineData("../tenant.sql")]
    public void UnsafeOrNonSqlEntry_IsRejected(string entryName)
    {
        var result = TenantProvisioningService.ValidateTenantSqlZipPackage(
            CreateZip((entryName, "SELECT 1;")));

        Assert.Equal(0, result.Code);
    }

    [Fact]
    public void InvalidUtf8Sql_IsRejected()
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = archive.CreateEntry("tenant.sql");
            using var stream = entry.Open();
            stream.Write(new byte[] { 0xff, 0xfe, 0xfd });
        }

        var result = TenantProvisioningService.ValidateTenantSqlZipPackage(buffer.ToArray());

        Assert.Equal(0, result.Code);
        Assert.Contains("UTF-8", result.Msg);
    }

    private static byte[] CreateZip(params (string Name, string Sql)[] entries)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var item in entries)
            {
                var entry = archive.CreateEntry(item.Name);
                using var stream = entry.Open();
                var bytes = Encoding.UTF8.GetBytes(item.Sql);
                stream.Write(bytes, 0, bytes.Length);
            }
        }
        return buffer.ToArray();
    }
}
