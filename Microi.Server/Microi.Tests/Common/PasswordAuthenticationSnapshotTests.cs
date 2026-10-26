using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class PasswordAuthenticationSnapshotTests
{
    [Fact]
    public async Task VerifiedOldPassword_CannotIssueAfterConcurrentResetCompletes()
    {
        var primary = User("old-stored-credential");
        var verified = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var resetComplete = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var login = Task.Run(async () =>
        {
            var proof = PasswordAuthenticationSnapshot.Capture("fixture-tenant", primary, "en");
            verified.SetResult();
            await resetComplete.Task;
            // 与签发器同一 Matches 校验，屏障固定“旧密码校验成功、改密提交、准备签发”的次序。
            return proof.Matches("fixture-tenant", primary);
        });
        await verified.Task;
        primary = User("new-stored-credential");
        resetComplete.SetResult();
        Assert.False(await login);
        Assert.True(PasswordAuthenticationSnapshot.Capture("fixture-tenant", primary, "en")
            .Matches("fixture-tenant", primary));
    }

    [Fact]
    public void CredentialProof_RejectsOtherTenantUserEncodingAndDisabledAccount()
    {
        var user = User("stored-credential");
        var proof = PasswordAuthenticationSnapshot.Capture("tenant-a", user, "cn");
        Assert.False(proof.Matches("tenant-b", user));
        var changed = (JObject)user.DeepClone();
        changed["Id"] = "other-user";
        Assert.False(proof.Matches("tenant-a", changed));
        changed = (JObject)user.DeepClone();
        changed["PwdEncode"] = "DES";
        Assert.False(proof.Matches("tenant-a", changed));
        changed = (JObject)user.DeepClone();
        changed["State"] = 2;
        Assert.False(proof.Matches("tenant-a", changed));
        Assert.False(proof.Matches("tenant-a", null));
    }

    [Fact]
    public void CredentialProof_IsNeitherDeserializedNorSerializedInRequestModels()
    {
        var injected = "{\"PasswordAuthentication\":{\"tenant\":\"forged\"}}";
        Assert.Null(JsonConvert.DeserializeObject<SysUserParam>(injected)!.PasswordAuthentication);
        Assert.Null(JsonConvert.DeserializeObject<DiyTokenParam>(injected)!.PasswordAuthentication);
        var proof = PasswordAuthenticationSnapshot.Capture("tenant-a", User("secret-credential"), "cn");
        var json = JsonConvert.SerializeObject(new DiyTokenParam { PasswordAuthentication = proof });
        Assert.DoesNotContain("PasswordAuthentication", json);
        Assert.DoesNotContain("secret-credential", json);
    }

    private static JObject User(string credential) => new()
    {
        ["Id"] = "fixture-user", ["State"] = 1, ["IsDeleted"] = 0,
        ["Pwd"] = credential, ["PwdEncode"] = PasswordHashSecurity.EncodingName
    };
}
