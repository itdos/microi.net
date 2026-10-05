using System.Net;
using System.Security;
using Microi.net;
using Minio;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class HdfsEmptyDirectoryMarkerDeletionTests
{
    private const string Key = "itdos/file/crm-finance/request/attempt-original/";
    private static EmptyDirectoryMarkerDeletion.PrefixSnapshot Snapshot(params EmptyDirectoryMarkerDeletion.ObjectEntry[] objects)
        => new() { Complete = true, Objects = objects };
    private static EmptyDirectoryMarkerDeletion.ObjectEntry Marker(long? size = 0, string key = Key)
        => new() { Key = key, Size = size };

    [Theory]
    [InlineData("file/crm-finance/request/attempt-original/")]
    [InlineData("/itdos/file/crm-finance/request/attempt-original/")]
    [InlineData("ITdos/file/crm-finance/request/attempt-original/")]
    public void DeleteNormalizerPreservesOnlyTheDirectorySuffix(string path)
    {
        Assert.Equal("/" + Key, TenantConfigurationSecurity.NormalizeStorageDeletePath("iTdos", path));
        Assert.Equal("/" + Key.TrimEnd('/'), TenantConfigurationSecurity.NormalizeStorageDeletePath("iTdos", path.TrimEnd('/')));
    }

    [Theory]
    [InlineData("")]
    [InlineData("/")]
    [InlineData("itdos/")]
    [InlineData("/itdos")]
    [InlineData("/ITdos/")]
    [InlineData("/unknown/file/")]
    [InlineData("/other-tenant/file/")]
    [InlineData("https://store.test/itdos/file/")]
    [InlineData("file/../marker/")]
    [InlineData("file/%2e%2e/marker/")]
    [InlineData("file/%2f/marker/")]
    [InlineData("file\\marker\\")]
    [InlineData("file//marker/")]
    [InlineData("file/*/")]
    [InlineData("file/marker?delete=all")]
    [InlineData("file/\nmarker/")]
    public void RootUnknownNamespaceAndAmbiguousPathsCannotReachStorage(string path)
        => Assert.ThrowsAny<Exception>(() => TenantConfigurationSecurity.NormalizeStorageDeletePath("itdos", path));

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ZeroByteMarkerOrAlreadyAbsentMustPassTwoCompleteReads(bool exists)
    {
        var reads = 0;
        var deleted = new List<string>();
        var result = await EmptyDirectoryMarkerDeletion.DeleteAsync("itdos", "/" + Key,
            (key, _) => { Assert.Equal(Key, key); reads++; return Task.FromResult(exists && reads == 1 ? Snapshot(Marker()) : Snapshot()); },
            (key, _) => { deleted.Add(key); return Task.CompletedTask; }, TestContext.Current.CancellationToken);
        Assert.Equal(1, result.Code);
        Assert.Equal(2, reads);
        Assert.Equal(exists ? new[] { Key } : Array.Empty<string>(), deleted);
        var data = JObject.FromObject((object)result.Data);
        Assert.True(data["VerifiedAbsent"]!.Value<bool>());
        Assert.Equal(!exists, data["AlreadyAbsent"]!.Value<bool>());
    }

    [Theory]
    [InlineData("descendant")]
    [InlineData("other-prefix")]
    [InlineData("nonzero")]
    [InlineData("unknown-size")]
    [InlineData("incomplete")]
    [InlineData("null-objects")]
    [InlineData("duplicate-marker")]
    [InlineData("null-entry")]
    public async Task InvalidOrIncompleteBeforeEvidenceNeverDeletes(string fault)
    {
        var before = fault switch
        {
            "descendant" => Snapshot(Marker(), Marker(12, Key + "receipt.pdf")),
            "other-prefix" => Snapshot(Marker(0, "itdos/unrelated/")),
            "nonzero" => Snapshot(Marker(1)),
            "unknown-size" => Snapshot(Marker(null)),
            "incomplete" => new() { Complete = false, Objects = new[] { Marker() } },
            "null-objects" => new() { Complete = true, Objects = null },
            "duplicate-marker" => Snapshot(Marker(), Marker()),
            _ => Snapshot(null!)
        };
        var deletes = 0;
        var result = await EmptyDirectoryMarkerDeletion.DeleteAsync("itdos", "/" + Key,
            (_, _) => Task.FromResult(before), (_, _) => { deletes++; return Task.CompletedTask; }, TestContext.Current.CancellationToken);
        Assert.Equal(0, result.Code);
        Assert.Equal(0, deletes);
        Assert.False(JObject.FromObject((object)result.Data)["OutcomeUnknown"]!.Value<bool>());
    }

    [Fact]
    public async Task ConcurrentDescendantIsPreservedAndAfterReadCannotClaimSuccess()
    {
        // 外部对象写入不随数据库事务回滚。读后出现文件时仍只删除标记，绝不递归。
        var objects = new Dictionary<string, long> { [Key] = 0 };
        var reads = 0;
        var deletes = new List<string>();
        var result = await EmptyDirectoryMarkerDeletion.DeleteAsync("itdos", "/" + Key,
            (_, _) => { reads++; return Task.FromResult(Snapshot(objects.Select(x => Marker(x.Value, x.Key)).ToArray())); },
            (key, _) => { objects[Key + "concurrent.pdf"] = 60750; deletes.Add(key); objects.Remove(key); return Task.CompletedTask; }, TestContext.Current.CancellationToken);
        Assert.Equal(0, result.Code);
        Assert.Equal(new[] { Key }, deletes);
        Assert.Equal(60750, objects[Key + "concurrent.pdf"]);
        Assert.Equal(2, reads);
        Assert.True(JObject.FromObject((object)result.Data)["OutcomeUnknown"]!.Value<bool>());
    }

    [Theory]
    [InlineData("ReadBefore", false)]
    [InlineData("DeleteExact", true)]
    [InlineData("ReadAfter", true)]
    public async Task UnknownProviderOutcomeKeepsSafeStageWithoutSecrets(string failAt, bool unknown)
    {
        var reads = 0;
        var result = await EmptyDirectoryMarkerDeletion.DeleteAsync("itdos", "/" + Key,
            (_, _) => { reads++; if (failAt == (reads == 1 ? "ReadBefore" : "ReadAfter")) throw new IOException("secret-signed-url"); return Task.FromResult(Snapshot(Marker())); },
            (_, _) => failAt == "DeleteExact" ? Task.FromException(new IOException("secret-credential")) : Task.CompletedTask, TestContext.Current.CancellationToken);
        Assert.Equal(0, result.Code);
        var data = JObject.FromObject((object)result.Data);
        Assert.Equal(failAt, data["Stage"]!.Value<string>());
        Assert.Equal(unknown, data["OutcomeUnknown"]!.Value<bool>());
        Assert.DoesNotContain("secret", JsonConvert.SerializeObject(result));
    }

    [Fact]
    public void ExplicitModeAndBucketRoundTripThroughTheExistingDto()
    {
        var param = JsonConvert.DeserializeObject<DiyUploadParam>("{\"FilePathName\":\"/" + Key + "\",\"Limit\":true,\"EmptyDirectoryOnly\":true}")!;
        Assert.True(param.EmptyDirectoryOnly);
        Assert.True(param.Limit);
        Assert.Null(new DiyUploadParam().EmptyDirectoryOnly);
        Assert.Null(new HDFSParam().EmptyDirectoryOnly);
        Assert.Equal("/" + Key, param.FilePathName);
    }

    [Theory]
    [InlineData("ordinary")]
    [InlineData("cross-tenant")]
    [InlineData("revoked")]
    [InlineData("access-key")]
    [InlineData("no-id")]
    public void CallerClaimsCannotReplaceCurrentTenantAdministratorAuthority(string fault)
    {
        var actor = new JObject { ["Id"] = "admin-id", ["Level"] = DiyCommon.MaxRoleLevel };
        if (fault == "ordinary") actor["Level"] = 0;
        if (fault == "no-id") actor.Remove("Id");
        if (fault == "access-key") actor["_AccessKeySession"] = true;
        var checkedAuthority = false;
        var result = HdfsObjectDeleteAuthorization.ValidateTrustedIdentity("itdos", fault == "cross-tenant" ? "other-tenant" : "itdos", actor,
            (_, _) => { checkedAuthority = true; return fault != "revoked"; });
        Assert.NotNull(result);
        Assert.Equal(0, result.Code);
        if (fault == "revoked") Assert.True(checkedAuthority);
    }

    [Fact]
    public async Task V8EntryRejectsOrdinaryTrustedActorBeforeResolvingProvider()
    {
        using var scope = V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "ordinary", ["Level"] = 0 }, "itdos");
        var result = await new V8TenantHDFS("itdos").DeleteObject(new DiyUploadParam
        { OsClient = "forged", _CurrentUser = new JObject { ["Id"] = "forged-admin", ["Level"] = DiyCommon.MaxRoleLevel },
            FilePathName = "/" + Key, Limit = true, EmptyDirectoryOnly = true });
        Assert.Equal(0, result.Code);
        Assert.Contains("管理员", result.Msg);
    }

    [Theory]
    [InlineData("valid", true)]
    [InlineData("ordinary", false)]
    [InlineData("access-key", false)]
    [InlineData("disabled-user", false)]
    [InlineData("revoked-role", false)]
    [InlineData("forged-id", false)]
    public void AdministratorEvidenceUsesTheExistingPrimaryUserAndRolePolicy(string fault, bool allowed)
    {
        var actor = new JObject { ["Id"] = fault == "forged-id" ? "different-id" : "admin-id", ["Level"] = fault == "ordinary" ? 0 : DiyCommon.MaxRoleLevel };
        if (fault == "access-key") actor["_AccessKeySession"] = true;
        var user = new SysUser { Id = "admin-id", Account = "fixture-admin", State = fault == "disabled-user" ? 0 : 1, IsDeleted = 0,
            Level = DiyCommon.MaxRoleLevel, RoleIds = "[\"admin-role\"]" };
        var roles = new[] { new SysRole { Id = "admin-role", IsDeleted = 0, Level = fault == "revoked-role" ? 0 : DiyCommon.MaxRoleLevel } };
        var result = HdfsObjectDeleteAuthorization.ValidateTrustedIdentity("itdos", "itdos", actor,
            (_, identity) => PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(identity, user, roles));
        Assert.Equal(allowed, result == null);
    }

    [Fact]
    public async Task CancellationBeforeStorageHasNoDeleteAndDoesNotBecomeSuccess()
    {
        using var canceled = new CancellationTokenSource();
        canceled.Cancel();
        var calls = 0;
        var result = await EmptyDirectoryMarkerDeletion.DeleteAsync("itdos", "/" + Key,
            (_, _) => { calls++; return Task.FromResult(Snapshot(Marker())); },
            (_, _) => { calls++; return Task.CompletedTask; }, canceled.Token);
        Assert.Equal(0, result.Code);
        Assert.Equal(0, calls);
    }

    [Theory]
    [InlineData("Aliyun")]
    [InlineData("MinIO")]
    [InlineData("S3")]
    public async Task ProviderAdaptersRejectMissingBucketSelectionBeforeSdk(string provider)
    {
        IMicroiHDFS storage = provider switch { "Aliyun" => new MicroiHDFSAliyun(), "MinIO" => new MicroiHDFSMinIO(), _ => new MicroiHDFSAmazonS3() };
        var result = await storage.DeleteObject(new HDFSParam { ClientModel = new OsClientSecret { OsClient = "itdos" }, FileFullPath = "/" + Key, EmptyDirectoryOnly = true });
        Assert.Equal(0, result.Code);
        Assert.Contains("桶选择", result.Msg);
    }

    // 使用真正 MinIO SDK 的 ListObjects/RemoveObject 协议，夹具仅替换 HTTP 存储端。
    private sealed class StorageHandler(int mode) : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Path, string Query)> Requests { get; } = new();
        public bool MarkerExists = true;
        private int _listCount;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            var uri = request.RequestUri!;
            Requests.Add((request.Method, uri.AbsolutePath, uri.Query));
            if (request.Method == HttpMethod.Delete)
            {
                Assert.Equal("/private/" + Key, Uri.UnescapeDataString(uri.AbsolutePath));
                MarkerExists = false;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent) { RequestMessage = request });
            }
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("/private", uri.AbsolutePath.TrimEnd('/'));
            Assert.Contains(Uri.EscapeDataString(Key), uri.Query);
            _listCount++;
            if (mode == 3) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)
            { Content = new StringContent("secret-denied"), RequestMessage = request });
            var contents = MarkerExists ? Contents(Key, mode == 1 ? 1 : 0) : "";
            if (mode == 2) contents += Contents(Key + "receipt.pdf", 60750);
            if (mode == 4 && _listCount > 1) contents = Contents(Key + "late.pdf", 12);
            if (mode == 5 && _listCount == 2) contents = "";
            if (mode == 19 && _listCount > 1) contents = "";
            if (mode == 7) contents = contents.Replace("<Size>0</Size>", "");
            if (mode == 10) contents = contents.Replace("<Size>0</Size>", "<Size>0</Size><Size>0</Size>");
            if (mode == 11) contents = contents.Replace("</Key>", "</Key><Key>different-key</Key>");
            var truncated = ((mode == 5 || mode == 6) && _listCount == 1) || mode == 18 || mode == 19;
            var next = mode == 19 ? "<NextContinuationToken>page" + _listCount + "</NextContinuationToken>"
                : (mode == 5 && truncated) || mode == 18 ? "<NextContinuationToken>page2</NextContinuationToken>" : "";
            var xml = "<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>private</Name><Prefix>" + Key
                + "</Prefix><MaxKeys>1000</MaxKeys><IsTruncated>" + (truncated ? "true" : "false") + "</IsTruncated>" + next + contents + "</ListBucketResult>";
            if (mode == 8) xml = "<!DOCTYPE ListBucketResult [<!ENTITY unsafe SYSTEM 'file:///not-readable'>]>" + xml;
            if (mode == 9) xml = xml.Replace("<IsTruncated>false</IsTruncated>", "");
            if (mode == 12) xml += new string(' ', 512 * 1024);
            if (mode == 13) xml = xml.Replace("<Prefix>" + Key + "</Prefix>", "<Prefix>itdos/different/</Prefix>");
            if (mode == 16) xml = xml.Replace("<Name>private</Name>", "<Name>different-bucket</Name>");
            if (mode == 17) xml = "<ListBucketResult><invalid";
            if (mode == 20) xml = xml.Replace("<Prefix>" + Key + "</Prefix>", "<EncodingType>url</EncodingType><Prefix>" + Uri.EscapeDataString(Key) + "</Prefix>")
                .Replace("<Key>" + Key + "</Key>", "<Key>" + Uri.EscapeDataString(Key) + "</Key>");
            if (mode == 14 || mode == 15) return Task.FromResult(new HttpResponseMessage(mode == 14 ? HttpStatusCode.PartialContent : HttpStatusCode.Redirect)
            { Content = new StringContent(xml), RequestMessage = request });
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(xml, System.Text.Encoding.UTF8, "application/xml"), RequestMessage = request });
        }
        private static string Contents(string key, int size) => "<Contents><Key>" + SecurityElement.Escape(key)
            + "</Key><LastModified>2026-10-03T00:00:00.000Z</LastModified><ETag>\"marker-etag\"</ETag><Size>"
            + size + "</Size><StorageClass>STANDARD</StorageClass></Contents>";
    }

    [Theory]
    [InlineData(0, 1, 1)]
    [InlineData(1, 0, 0)]
    [InlineData(2, 0, 0)]
    [InlineData(3, 0, 0)]
    [InlineData(4, 0, 1)]
    [InlineData(5, 1, 1)]
    [InlineData(6, 0, 0)]
    [InlineData(7, 0, 0)]
    [InlineData(8, 0, 0)]
    [InlineData(9, 0, 0)]
    [InlineData(10, 0, 0)]
    [InlineData(11, 0, 0)]
    [InlineData(12, 0, 0)]
    [InlineData(13, 0, 0)]
    [InlineData(14, 0, 0)]
    [InlineData(15, 0, 0)]
    [InlineData(16, 0, 0)]
    [InlineData(17, 0, 0)]
    [InlineData(18, 0, 0)]
    [InlineData(19, 0, 0)]
    [InlineData(20, 1, 1)]
    public async Task ActualMinioSdkDeletesOnlyExactZeroMarkerAndChecksAfter(int mode, int code, int expectedDeletes)
    {
        var handler = new StorageHandler(mode);
        using var http = new HttpClient(handler);
        using var client = new MinioClient().WithEndpoint("storage.test", 9000).WithRegion("us-east-1")
            .WithCredentials("fixture-access", "fixture-secret").WithHttpClient(http).Build();
        var result = await EmptyDirectoryMarkerDeletion.DeleteMinioCompatibleAsync(new HDFSParam
        { ClientModel = new OsClientSecret { OsClient = "itdos" }, Limit = true, FileFullPath = "/" + Key, EmptyDirectoryOnly = true }, client, "private");
        Assert.Equal(code, result.Code);
        Assert.Equal(expectedDeletes, handler.Requests.Count(x => x.Method == HttpMethod.Delete));
        Assert.DoesNotContain(handler.Requests, x => x.Method == HttpMethod.Post); // 没有批量 DeleteObjects。
        Assert.DoesNotContain("secret", JsonConvert.SerializeObject(result));
    }
}
