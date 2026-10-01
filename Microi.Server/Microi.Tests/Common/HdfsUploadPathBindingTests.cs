using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class HdfsUploadPathBindingTests
{
    private const string AllowedPath = "/img/fqc/LG-GD02-2609210064/P01";

    [Fact]
    public async Task MultipartParser_PreservesPathAndLowercasePath_ForNormalization()
    {
        using var body = new MultipartFormDataContent();
        body.Add(new StringContent(AllowedPath), "Path");
        body.Add(new StringContent(AllowedPath), "path");
        body.Add(new StringContent("false"), "Limit");
        body.Add(new ByteArrayContent(new byte[] { 1, 2, 3 }), "file", "probe.png");

        var context = new DefaultHttpContext();
        context.Request.ContentType = body.Headers.ContentType!.ToString();
        context.Request.Body = await body.ReadAsStreamAsync(TestContext.Current.CancellationToken);
        var parsed = await context.Request.ReadFormAsync(TestContext.Current.CancellationToken);
        var upload = new DiyUploadParam { Path = "model-bound-duplicate", Limit = false };

        Assert.Null(HDFSController.ResolveUploadPathForRequest(upload, context.Request.Query, parsed));
        Assert.Equal(AllowedPath, upload.Path);
        Assert.Single(parsed.Files);
    }

    [Fact]
    public void EqualPathAndLowercasePath_KeepOneAuthorizedDirectory()
    {
        var upload = new DiyUploadParam
        {
            Path = AllowedPath + "," + AllowedPath,
            Limit = false,
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" }
        };
        var form = new Dictionary<string, StringValues>(StringComparer.Ordinal)
        {
            ["Path"] = AllowedPath,
            ["path"] = AllowedPath
        };

        Assert.Null(HDFSController.ResolveUploadPathForRequest(upload, null, form));
        Assert.Equal(AllowedPath, upload.Path);

        var rules = HdfsUploadDirectoryPolicy.Parse(new JArray(new JObject
        {
            ["Path"] = "/img",
            ["AllAuthenticated"] = true,
            ["IncludeSubdirectories"] = true,
            ["AllowPublic"] = true
        }));
        var identity = new FormEngineAuthorizationSnapshot
        {
            UserId = "ordinary-user",
            IsActiveUser = true
        };
        Assert.Equal(1, HdfsUploadDirectoryPolicy.Apply(upload, rules, identity)!.Code);
        Assert.False(upload.Limit);
    }

    [Fact]
    public void AggregatedDuplicateValues_AreAcceptedOnlyWhenEqual()
    {
        var upload = new DiyUploadParam { Path = "model-bound-duplicate" };
        var form = new Dictionary<string, StringValues>
        {
            ["Path"] = new StringValues(new[] { AllowedPath, AllowedPath })
        };
        Assert.Null(HDFSController.ResolveUploadPathForRequest(upload, null, form));
        Assert.Equal(AllowedPath, upload.Path);

        form["Path"] = new StringValues(new[] { AllowedPath, "/img/other" });
        Assert.Equal(0, HDFSController.ResolveUploadPathForRequest(upload, null, form)!.Code);
        Assert.Equal(AllowedPath, upload.Path);
    }

    [Fact]
    public void QueryAndFormConflict_IsRejectedWithoutChoosingAnAuthorizedPath()
    {
        var upload = new DiyUploadParam { Path = AllowedPath };
        var query = new Dictionary<string, StringValues> { ["Path"] = "/img/other" };
        var form = new Dictionary<string, StringValues> { ["path"] = AllowedPath };

        Assert.Equal(0, HDFSController.ResolveUploadPathForRequest(upload, query, form)!.Code);
        Assert.Equal(AllowedPath, upload.Path);
    }

    [Fact]
    public void MissingPath_PreservesExistingDefault()
    {
        var upload = new DiyUploadParam { Path = "upload" };
        Assert.Null(HDFSController.ResolveUploadPathForRequest(upload, null, null));
        Assert.Equal("upload", upload.Path);
    }
}
