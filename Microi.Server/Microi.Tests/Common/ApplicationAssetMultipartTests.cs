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
}
