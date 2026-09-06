using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class AiMediaStorageAuthorizationTests
{
    private static DiyUploadParam Request(string path, bool limit) => new()
    { OsClient = "tenant-a", Path = path, Limit = limit, _CurrentUser = new JObject { ["Id"] = "ordinary-user", ["Level"] = 1 } };

    [Theory]
    [InlineData("ai-images", false)]
    [InlineData("ai-image-references", true)]
    [InlineData("ai-music", false)]
    [InlineData("ai-speech", false)]
    [InlineData("ai-video", false)]
    public void TrustedGeneratedMediaKeepsIntendedBucketButClientCannotForgeGrant(string path, bool limit)
    {
        var trusted = AiMediaStorageAuthorization.Authorize(Request(path, limit));
        Assert.Null(FileUploadSecurity.ApplyInteractivePolicy(trusted, false));
        Assert.Equal(limit, trusted.Limit);
        Assert.Equal(0, FileUploadSecurity.ApplyInteractivePolicy(Request(path, limit), false).Code);
        var copy = JsonConvert.DeserializeObject<DiyUploadParam>(JsonConvert.SerializeObject(trusted))!;
        Assert.False(AiMediaStorageAuthorization.Allows(copy));
        Assert.Equal(0, FileUploadSecurity.ApplyInteractivePolicy(copy, false).Code);
    }

    [Theory]
    [InlineData("tenant")]
    [InlineData("user")]
    [InlineData("path")]
    [InlineData("bucket")]
    public void GrantCannotBeReusedAfterBoundaryChanges(string field)
    {
        var request = AiMediaStorageAuthorization.Authorize(Request("ai-images", false));
        if (field == "tenant") request.OsClient = "tenant-b";
        if (field == "user") request._CurrentUser["Id"] = "another-user";
        if (field == "path") request.Path = "ai-video";
        if (field == "bucket") request.Limit = true;
        Assert.False(AiMediaStorageAuthorization.Allows(request));
    }

    [Fact]
    public void ReferenceMaterialCannotBeMadePublic()
    { Assert.Throws<InvalidOperationException>(() => AiMediaStorageAuthorization.Authorize(Request("ai-image-references", false))); }
}
