using Microi.net;

namespace Microi.Tests.Common;

public sealed class MiniMaxImageSupportTests
{
    [Theory]
    [InlineData("帮我副一张美女图片")]
    [InlineData("请生成一张山水插画")]
    [InlineData("给我做一幅 16:9 的产品海报")]
    [InlineData("text-to-image: a quiet lake")]
    public void LooksLikeImageGeneration_AcceptsExplicitGenerationRequests(string text)
    {
        Assert.True(MiniMaxImageSupport.LooksLikeImageGeneration(text));
    }

    [Theory]
    [InlineData("分析这张图片里的表格")]
    [InlineData("查询图片记录数量")]
    [InlineData("这张照片里有什么")]
    public void LooksLikeImageGeneration_DoesNotMisrouteImageUnderstanding(string text)
    {
        Assert.False(MiniMaxImageSupport.LooksLikeImageGeneration(text));
    }

    [Fact]
    public void TryNormalize_UsesDedicatedImageModelAndBase64ServerResponse()
    {
        var ok = MiniMaxImageSupport.TryNormalize(
            new MiniMaxImageGenerateParam
            {
                RequestId = "image:test-request-001",
                Prompt = "  一只在窗边晒太阳的橘猫  ",
                Model = "image-01",
                AspectRatio = "1:1",
                Count = 1
            },
            out var normalized,
            out var error);

        Assert.True(ok, error);
        Assert.NotNull(normalized);
        Assert.Equal("image-01", normalized.Model);
        Assert.Equal("一只在窗边晒太阳的橘猫", normalized.Prompt);
        Assert.Contains("\"response_format\":\"base64\"", normalized.RequestBody, StringComparison.Ordinal);
        Assert.Contains("\"prompt_optimizer\":true", normalized.RequestBody, StringComparison.Ordinal);
        Assert.Equal(64, normalized.Fingerprint.Length);
    }

    [Theory]
    [InlineData("MiniMax-M3", "当前对话图片生成只允许 image-01")]
    [InlineData("image-01-live", "当前对话图片生成只允许 image-01")]
    public void TryNormalize_RejectsConversationOrUnapprovedImageModels(string model, string expectedError)
    {
        var ok = MiniMaxImageSupport.TryNormalize(
            new MiniMaxImageGenerateParam
            {
                RequestId = "image:test-request-002",
                Prompt = "画一只猫",
                Model = model
            },
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains(expectedError, error, StringComparison.Ordinal);
    }

    [Fact]
    public void BuildIdempotencyKey_IsDeterministicAndDoesNotExposeUserId()
    {
        const string userId = "user-sensitive-id";
        var first = MiniMaxImageSupport.BuildIdempotencyKey("iTdos", userId, "image:test-request-003");
        var replay = MiniMaxImageSupport.BuildIdempotencyKey("iTdos", userId, "image:test-request-003");
        var otherTenant = MiniMaxImageSupport.BuildIdempotencyKey("other", userId, "image:test-request-003");

        Assert.Equal(first, replay);
        Assert.NotEqual(first, otherTenant);
        Assert.DoesNotContain(userId, first, StringComparison.Ordinal);
    }
}
