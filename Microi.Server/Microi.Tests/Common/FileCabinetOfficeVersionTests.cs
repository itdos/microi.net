using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class FileCabinetOfficeVersionTests
{
    private static object? Invoke(string name, params object[] arguments)
        => typeof(HDFSController).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, arguments);

    [Fact]
    public void HistoryRoot_IsStableAndSeparatesTenantBucketAndObject()
    {
        var original = "itdos/contract/A.docx";
        var privateRoot = (string)Invoke("FileCabinetOfficeRoot", "itdos", true, original)!;
        Assert.Equal(privateRoot, Invoke("FileCabinetOfficeRoot", "itdos", true, original));
        Assert.Equal(privateRoot, Invoke("FileCabinetOfficeRoot", "iTdos", true, original));
        Assert.StartsWith("itdos/.microi-office-history/", privateRoot);
        Assert.DoesNotContain("A.docx", privateRoot);
        Assert.NotEqual(privateRoot, Invoke("FileCabinetOfficeRoot", "itdos", false, original));
        Assert.NotEqual(privateRoot, Invoke("FileCabinetOfficeRoot", "other", true, original));
        Assert.NotEqual(privateRoot, Invoke("FileCabinetOfficeRoot", "itdos", true, "itdos/contract/B.docx"));
    }

    [Fact]
    public void NewFile_HasOneInitialVersionAtOriginalKey()
    {
        var meta = (JObject)Invoke("NewFileCabinetOfficeMeta", "/itdos/contract/A.docx", false)!;
        Assert.Equal("v1.0.0", (string?)meta["Version"]);
        Assert.Equal("/itdos/contract/A.docx", (string?)meta["OriginalPath"]);
        var versions = Assert.IsType<JArray>(meta["Versions"]);
        var initial = Assert.IsType<JObject>(Assert.Single(versions));
        Assert.Equal("v1.0.0", (string?)initial["Version"]);
        Assert.Equal("/itdos/contract/A.docx", (string?)initial["Path"]);
        Assert.False((bool?)initial["Limit"]);
        Assert.True((bool?)initial["IsLatest"]);
    }

    [Fact]
    public void VersionIndex_RejectsCrossTenantSnapshotsAndInconsistentLatest()
    {
        var path = "/itdos/contract/A.docx";
        var root = (string)Invoke("FileCabinetOfficeRoot", "itdos", true, path)!;
        var meta = (JObject)Invoke("NewFileCabinetOfficeMeta", path, true)!;
        bool Valid() => (bool)Invoke("IsValidFileCabinetOfficeMeta", meta, path, true, root)!;
        Assert.True(Valid());
        var versions = (JArray)meta["Versions"]!;
        ((JObject)versions[0])["IsLatest"] = false;
        versions.Add(new JObject
        {
            ["Version"] = "v1.0.1", ["Path"] = path, ["Limit"] = true, ["IsLatest"] = true
        });
        ((JObject)versions[0])["Path"] = "/" + root + "v1.0.0.docx";
        meta["Version"] = "v1.0.1";
        Assert.True(Valid());
        ((JObject)versions[0])["Path"] = "/other/private/v1.0.0.docx";
        Assert.False(Valid());
        ((JObject)versions[0])["Path"] = "/" + root + "v1.0.0.docx";
        meta["Version"] = "v1.0.2";
        Assert.False(Valid());
    }

    [Fact]
    public async Task OfficeAuthorization_FailsClosedBeforeStorageForInvalidContext()
    {
        var param = new DiyUploadParam
        {
            OsClient = "itdos",
            ResourceKind = "FileManagerObject",
            ResourceId = "itdos/contract/A.docx",
            FilePathName = "itdos/contract/B.docx",
            SysMenuId = "file-manager-menu",
            Limit = false,
            _CurrentUser = new JObject { ["Level"] = 9999 }
        };
        var rejected = await PrivateFileAccessAuthorization.AuthorizeFileManagerOfficeAsync(param);
        Assert.NotNull(rejected);
        Assert.Equal(0, rejected.Code);

        param.FilePathName = param.ResourceId;
        param.SysMenuId = "";
        rejected = await PrivateFileAccessAuthorization.AuthorizeFileManagerOfficeAsync(param);
        Assert.NotNull(rejected);
        Assert.Equal(0, rejected.Code);
    }
}
