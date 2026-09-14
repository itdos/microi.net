using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class FileRolePermissionTests
{
    private static readonly JObject Config = JObject.Parse("{EnableRolePermission:true,Multiple:true}");
    private static readonly JObject[] Roles = [
        JObject.Parse("{Id:'r1',Name:'一级文件权限',Level:300}"),
        JObject.Parse("{Id:'r2',Name:'二级文件权限',Level:200}"),
        JObject.Parse("{Id:'r3',Name:'三级文件权限',Level:100}"),
        JObject.Parse("{Id:'peer',Name:'同级角色',Level:200}")];
    private static JObject File(string id, string role) => new() { ["Id"] = id, ["Name"] = id + ".pdf", ["Path"] = "/tenant/file/" + id + ".pdf", ["Limit"] = true, ["VisibleRoleIds"] = new JArray(role), ["Versions"] = new JArray(new JObject { ["Path"] = "/tenant/file/" + id + "-v1.pdf" }) };

    [Fact]
    public void HigherRoleInheritsButEqualOrLowerDoesNot()
    {
        Assert.True(new FileRolePermission(Roles, ["r1"]).CanAccess(File("a", "r2"), Config));
        Assert.True(new FileRolePermission(Roles, ["r1"]).CanAccess(File("a", "r3"), Config));
        Assert.False(new FileRolePermission(Roles, ["r2"]).CanAccess(File("a", "r1"), Config));
        Assert.False(new FileRolePermission(Roles, ["peer"]).CanAccess(File("a", "r2"), Config));
    }

    [Fact]
    public void InheritanceOffStillAllowsDirectMultiRoleMembership()
    {
        var config = (JObject)Config.DeepClone(); config["DisableRoleInheritance"] = true;
        Assert.False(new FileRolePermission(Roles, ["r1"]).CanAccess(File("a", "r2"), config));
        Assert.True(new FileRolePermission(Roles, ["r1", "r2"]).CanAccess(File("a", "r2"), config));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void DeniedProjectionNeverExposesPathsVersionsOrFileSize(bool showName)
    {
        var config = (JObject)Config.DeepClone(); config["ShowUnauthorizedFileName"] = showName;
        var policy = new FileRolePermission(Roles, ["r2"]);
        var output = (JObject)policy.Project(File("secret", "r1"), config);
        Assert.Null(output["Path"]); Assert.Null(output["Versions"]); Assert.Null(output["Size"]);
        Assert.Equal(showName, output["Name"] != null);
        Assert.False(output["_FileAccess"]!["CanRead"]!.Value<bool>());
        Assert.Equal("一级文件权限", output["VisibleRoleNames"]![0]!.Value<string>());
        Assert.False(policy.CanReadPath(File("secret", "r1"), "/tenant/file/secret-v1.pdf", config));
    }

    [Fact]
    public void EditingFiveFilesPreservesThreeDeniedAndAllowsDeletingTwoOwned()
    {
        var policy = new FileRolePermission(Roles, ["r2"]);
        var old = new JArray(File("a", "r1"), File("b", "r1"), File("c", "r1"), File("d", "r2"), File("e", "r2"));
        var projected = (JArray)policy.Project(old, Config);
        projected.RemoveAt(4); projected.RemoveAt(3);
        var merged = (JArray)policy.Merge(old, projected, Config);
        Assert.Equal(3, merged.Count);
        for (var i = 0; i < 3; i++) Assert.True(JToken.DeepEquals(old[i], merged[i]));
        // 隐藏列表或恶意提交 [] 都不能删除无权附件。
        Assert.Equal(3, ((JArray)policy.Merge(old, new JArray(), Config)).Count);
    }

    [Theory]
    [InlineData("Name", "stolen.pdf")]
    [InlineData("Path", "/tenant/file/replaced.pdf")]
    [InlineData("VisibleRoleIds", "[]")]
    public void ForgedDeniedMetadataIsRejected(string key, string value)
    {
        var policy = new FileRolePermission(Roles, ["r2"]);
        var old = new JArray(File("a", "r1"));
        var submitted = (JArray)policy.Project(old, Config);
        submitted[0]![key] = key == "VisibleRoleIds" ? JArray.Parse(value) : new JValue(value);
        Assert.Throws<InvalidOperationException>(() => policy.Merge(old, submitted, Config));
    }

    [Fact]
    public void UnknownRoleDuplicateIdAndPublicStorageFailClosed()
    {
        var policy = new FileRolePermission(Roles, ["r1"]);
        Assert.Throws<InvalidOperationException>(() => policy.Merge(null, new JArray(File("a", "missing")), Config));
        Assert.Throws<InvalidOperationException>(() => policy.Merge(null, new JArray(File("a", "r1"), File("a", "r2")), Config));
        var file = File("a", "r1"); file["Limit"] = false;
        Assert.Throws<InvalidOperationException>(() => policy.Merge(null, new JArray(file), Config));
    }

    [Fact]
    public void ReusingDeniedPathWithDifferentIdCannotBypassPermission()
    {
        var policy = new FileRolePermission(Roles, ["r2"]);
        var old = File("a", "r1"); var forged = (JObject)old.DeepClone(); forged["Id"] = "new"; forged["VisibleRoleIds"] = new JArray("r2");
        Assert.Throws<InvalidOperationException>(() => policy.Merge(new JArray(old), new JArray(forged), Config));
    }

    [Fact]
    public void LegacyUserRoleObjectsUseOnlyAuthoritativeIds()
    {
        Assert.Equal(["r2"], FileRolePermission.ReadIdentityRoleIds(new JValue("[{\"Id\":\"r2\",\"Level\":9999}]")));
        Assert.Equal(["r2"], FileRolePermission.ReadIdentityRoleIds(new JValue("[\"r2\"]")));
        Assert.Throws<InvalidOperationException>(() => FileRolePermission.ReadIds(JArray.Parse("[{Id:'r2'}]")));
    }

    [Fact]
    public void UploadProofBindsEveryContextPart()
    {
        string[] parts = ["9999999999", "tenant", "user", "field", "row", "/tenant/file/a.pdf"];
        var signature = FileUploadProvenance.Sign("secret", parts);
        for (var i = 0; i < parts.Length; i++)
        {
            var changed = (string[])parts.Clone(); changed[i] += "-other";
            Assert.NotEqual(signature, FileUploadProvenance.Sign("secret", changed));
        }
        Assert.NotEqual(signature, FileUploadProvenance.Sign("other-secret", parts));
    }

    [Theory]
    [InlineData("FilePath")]
    [InlineData("FilePathName")]
    [InlineData("path")]
    public void AlternateAndNestedVersionPathsCannotGrantAccess(string alias)
    {
        var original = File("a", "r1");
        var submitted = (JObject)original.DeepClone();
        submitted[alias] = "/tenant/file/secret.pdf";
        Assert.Throws<InvalidOperationException>(() => FileRolePermission.ValidateReferencedPaths(submitted, original, (string)original["Path"]!));
        var nested = new JObject { ["Versions"] = new JObject { ["Versions"] = new JArray(new JObject { [alias] = "/tenant/file/secret.pdf" }) } };
        Assert.Throws<InvalidOperationException>(() => FileRolePermission.ValidateReferencedPaths(nested, original, (string)original["Path"]!));
        FileRolePermission.ValidateReferencedPaths(original, original, (string)original["Path"]!);
    }

    [Fact]
    public void LegacyPathsAndUnrestrictedFilesRemainReadableAndIdsAreStable()
    {
        var policy = new FileRolePermission(Roles, []);
        var legacy = new JValue("/tenant/file/old.pdf");
        Assert.Equal(policy.Project(legacy, Config).ToString(), policy.Project(legacy, Config).ToString());
        Assert.False(policy.ContainsDenied(legacy, Config));
        Assert.True(new FileRolePermission(Roles, [], true).CanAccess(File("a", "r1"), Config));
        Assert.False(new FileRolePermission(Roles, [], false, false).CanAccess(File("a", "r1"), Config));
    }
}
