using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class PlatformAccountAuthenticationRegressionTests
{
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public void SmsProof_ValidatesJsonInputWithoutDynamicExtensionBinding(string code)
    {
        using var scope = V8TenantContext.Enter("tenant-account-test", "platform_auth_sms_login");
        var result = new V8Method().CreatePlatformSmsProof(new JObject
        {
            ["Phone"] = "19900000001", ["Code"] = code
        });

        Assert.Equal(0, result.Code);
        Assert.Equal("手机号或短信验证码无效。", result.Msg);
    }

    [Fact]
    public void SmsProof_RejectsUntrustedEngineBeforeReadingInput()
    {
        using var scope = V8TenantContext.Enter("tenant-account-test", "untrusted-engine");
        var result = new V8Method().CreatePlatformSmsProof(new JObject
        {
            ["Phone"] = "19900000001", ["Code"] = "123456"
        });
        Assert.Equal(0, result.Code);
        Assert.Contains("无权", result.Msg);
    }

    [Fact]
    public void PasswordOnlyPatch_DoesNotRevalidateAnUnchangedLegacyDepartment()
    {
        var root = FindRoot();
        var source = File.ReadAllText(Path.Combine(root,
            "Microi.Server/Microi.Core/Logic/SysUserLogic.cs"));
        var update = source.Substring(source.IndexOf("public async Task<DosResult> UptSysUser(", StringComparison.Ordinal));
        Assert.Contains("if (param.DeptId != null && !model.DeptId.DosIsNullOrWhiteSpace())", update);
        Assert.Contains("OsClient = param.OsClient", update);
        var existing = new SysUser { Id = "account-test", DeptId = "legacy-dept", DeptCode = "", Name = "原名称", State = 1 };
        var patch = new SysUserParam { Id = existing.Id, Pwd = "new-hash" };
        var merged = SysUserLogic.MergeUpdateModel(patch, existing);
        Assert.Null(patch.DeptId);
        Assert.Equal("legacy-dept", merged.DeptId);
        Assert.True(string.IsNullOrEmpty(merged.DeptCode));
        Assert.Equal("原名称", merged.Name);
        Assert.Equal(1, merged.State);
    }

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory != null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "Microi一键编译发布.sh"))) return directory.FullName;
        throw new DirectoryNotFoundException("未找到测试工作区。");
    }
}
