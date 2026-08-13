using Microi.net;

namespace Dos.Common.Tests;

public class ApplicationAssetMultipartTests
{
    private const long MiB = 1024L * 1024L;

    [Fact]
    public void FiveGiB_UsesBoundedSixteenMiBChunksWithoutAnyFileSizeCap()
    {
        const long totalBytes = 5L * 1024L * MiB;

        var chunkBytes = V8McpLogic.CalculateApplicationAssetMultipartChunkBytes(totalBytes);
        var partCount = V8McpLogic.CalculateApplicationAssetMultipartPartCount(
            totalBytes,
            chunkBytes);

        Assert.Equal(16L * MiB, chunkBytes);
        Assert.Equal(320, partCount);
    }

    [Fact]
    public void VeryLargeSafeIntegerObject_GrowsChunksInsteadOfRejectingTheUpload()
    {
        const long totalBytes = 4L * 1024L * 1024L * 1024L * 1024L;

        var chunkBytes = V8McpLogic.CalculateApplicationAssetMultipartChunkBytes(totalBytes);
        var partCount = V8McpLogic.CalculateApplicationAssetMultipartPartCount(
            totalBytes,
            chunkBytes);

        Assert.InRange(chunkBytes, 16L * MiB, 1024L * MiB);
        Assert.InRange(partCount, 1, 10_000);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(9_007_199_254_740_992L)]
    public void JavaScriptUnsafeOrNegativeObjectSize_IsRejected(long totalBytes)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            V8McpLogic.CalculateApplicationAssetMultipartChunkBytes(totalBytes));
    }

    [Fact]
    public void Completion_IsNotCancelledWhenTheCallingTransportDisconnects()
    {
        var sourcePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "../../../../Microi.net.Api/Controllers/V8EngineController.cs"));
        var source = File.ReadAllText(sourcePath);
        var actionIndex = source.IndexOf(
            "CompleteApplicationAssetMultipart([FromBody] JObject param)",
            StringComparison.Ordinal);
        var nextActionIndex = source.IndexOf(
            "AbortApplicationAssetMultipart([FromBody] JObject param)",
            actionIndex,
            StringComparison.Ordinal);

        Assert.True(actionIndex >= 0 && nextActionIndex > actionIndex);
        var action = source.Substring(actionIndex, nextActionIndex - actionIndex);
        Assert.Contains("System.Threading.CancellationToken.None", action, StringComparison.Ordinal);
        Assert.DoesNotContain("HttpContext.RequestAborted", action, StringComparison.Ordinal);
    }

    [Fact]
    public void LargeApplicationObjects_UseTheExistingLongHdfsTimeoutCeiling()
    {
        var sourcePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "../../../../Microi.Core/V8Engine/V8McpLogic.ApplicationAssetStream.cs"));
        var source = File.ReadAllText(sourcePath);
        var methodIndex = source.IndexOf(
            "private static async Task<DosResult> PutApplicationObject(",
            StringComparison.Ordinal);
        var nextMethodIndex = source.IndexOf(
            "private static async Task<DosResult> CopyApplicationObject(",
            methodIndex,
            StringComparison.Ordinal);

        Assert.True(methodIndex >= 0 && nextMethodIndex > methodIndex);
        var method = source.Substring(methodIndex, nextMethodIndex - methodIndex);
        Assert.Contains(
            "effectiveContentLength >= 64L * 1024 * 1024",
            method,
            StringComparison.Ordinal);
        Assert.Contains("TimeoutSeconds =", method, StringComparison.Ordinal);
        Assert.Contains("? 7200", method, StringComparison.Ordinal);
    }

    [Fact]
    public void FinalObjectComposition_UsesVerifiedSeekableTemporaryFileInsteadOfAnonymousPipe()
    {
        var sourcePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "../../../../Microi.Core/V8Engine/V8McpLogic.ApplicationAssetMultipart.Runtime.cs"));
        var source = File.ReadAllText(sourcePath);

        Assert.DoesNotContain("AnonymousPipe", source, StringComparison.Ordinal);
        Assert.Contains("microi-application-asset-compose-", source, StringComparison.Ordinal);
        Assert.Contains("FileOptions.Asynchronous | FileOptions.DeleteOnClose", source, StringComparison.Ordinal);

        var composeIndex = source.IndexOf("ComposeApplicationAssetMultipartAsync(", StringComparison.Ordinal);
        var putIndex = source.IndexOf("PutApplicationObject(", composeIndex, StringComparison.Ordinal);
        Assert.True(composeIndex >= 0 && putIndex > composeIndex,
            "最终对象只能在全部 HDFS 分片已顺序回读并校验后写入。");
    }
}
