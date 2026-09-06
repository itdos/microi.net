using Microi.net;

namespace Microi.Tests.Common;

public sealed class MiniMaxImageSupportTests
{
    private const string OnePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    [Fact]
    public void ReferenceEditingDoesNotRewriteTheUserInstruction()
    {
        var ok = MiniMaxImageSupport.TryNormalize(new MiniMaxImageGenerateParam
        {
            RequestId = "image:reference-no-expansion",
            Operation = "erase",
            Prompt = "移除图片中的男人",
            ReferenceImages = new() { new() { FileName = "source.png", DataUrl = OnePixelPng } }
        }, out var normalized, out var error);
        Assert.True(ok, error);
        Assert.Contains("\"prompt_optimizer\":false", normalized.RequestBody);
        Assert.Equal("移除图片中的男人", normalized.Prompt);
    }
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
    [InlineData("image model with spaces", "所选模型")]
    [InlineData("image-01\r\nAuthorization: x", "所选模型")]
    public void TryNormalize_RejectsInvalidModelIdentifiers(string model, string expectedError)
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

    [Fact]
    public void TryNormalize_AcceptsPrivateReferencePayloadWithoutLeakingItIntoUpstreamBody()
    {
        var ok = MiniMaxImageSupport.TryNormalize(
            new MiniMaxImageGenerateParam
            {
                RequestId = "image:reference-request-001",
                Prompt = "保留人物身份特征，改为专业证件照",
                Operation = "id-photo",
                ReferenceImages =
                [
                    new MiniMaxImageReferenceParam { FileName = "portrait.png", DataUrl = OnePixelPng }
                ],
                Width = 1024,
                Height = 1024,
                Seed = 42
            },
            out var normalized,
            out var error);

        Assert.True(ok, error);
        Assert.Single(normalized.ReferenceImages);
        Assert.Equal("png", normalized.ReferenceImages[0].Extension);
        Assert.Equal(64, normalized.ReferenceImages[0].Sha256.Length);
        Assert.DoesNotContain("iVBOR", normalized.RequestBody, StringComparison.Ordinal);
        Assert.DoesNotContain("aspect_ratio", normalized.RequestBody, StringComparison.Ordinal);
        Assert.Contains("\"width\":1024", normalized.RequestBody, StringComparison.Ordinal);
        Assert.Contains("\"height\":1024", normalized.RequestBody, StringComparison.Ordinal);
        Assert.Contains("\"seed\":42", normalized.RequestBody, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("image-to-image", null, "至少需要上传一张参考图")]
    [InlineData("text-to-image", OnePixelPng, "文生图不接收参考图")]
    public void TryNormalize_EnforcesReferenceRequirements(string operation, string? dataUrl, string expectedError)
    {
        var references = dataUrl == null
            ? null
            : new List<MiniMaxImageReferenceParam>
            {
                new MiniMaxImageReferenceParam { FileName = "source.png", DataUrl = dataUrl }
            };
        var ok = MiniMaxImageSupport.TryNormalize(
            new MiniMaxImageGenerateParam
            {
                RequestId = "image:reference-request-002",
                Prompt = "测试",
                Operation = operation,
                ReferenceImages = references
            },
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains(expectedError, error, StringComparison.Ordinal);
    }
}
