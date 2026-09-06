using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class AiMediaModelSupportTests
{
    [Fact]
    public void LegacyM3RowExpandsActualMediaModelsWithoutCallingM3ForImages()
    {
        var models = AiMediaModelSupport.ConfiguredModels("MiniMax-M3", null, null).OfType<JObject>().ToArray();
        Assert.Contains(models, x => x["Id"]!.ToString() == "image-01" && x["Capability"]!.ToString() == "image");
        Assert.DoesNotContain(models, x => x["Id"]!.ToString() == "MiniMax-M3");
        Assert.Equal(new[] { "image", "music", "speech", "video" }, models.Select(x => x["Capability"]!.ToString()).Distinct().OrderBy(x => x));
    }

    [Fact]
    public void ConfiguredProtocolAllowsFutureModelNamesAndNeverReturnsSecrets()
    {
        var models = AiMediaModelSupport.ConfiguredModels("chat", "openai-image",
            "[{\"Id\":\"future-picture-v3\",\"Name\":\"图片模型\",\"Capability\":\"image\",\"ApiKey\":\"do-not-return\",\"Endpoint\":\"https://example.com\"}]");
        Assert.True(models[0]["Supported"]!.Value<bool>());
        Assert.Equal("openai-image", models[0]["Protocol"]!.ToString());
        Assert.DoesNotContain("do-not-return", models.ToString());
        Assert.DoesNotContain("Endpoint", models.ToString());
        Assert.True(AiMediaModelSupport.ConfiguredModels("future-image", "openai-image", "")[0]["Supported"]!.Value<bool>());
    }

    [Fact]
    public void UnknownAdapterIsExplicitlyUnavailable()
    {
        var models = AiMediaModelSupport.ConfiguredModels("chat", "vendor-x",
            "[{\"Id\":\"future-video\",\"Capability\":\"video\"}]");
        Assert.False(models[0]["Supported"]!.Value<bool>());
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("[42]")]
    [InlineData("[{\"Id\":\"same\",\"Capability\":\"image\"},{\"Id\":\"SAME\",\"Capability\":\"image\"}]")]
    [InlineData("[{\"Id\":\"bad id\",\"Capability\":\"image\"}]")]
    [InlineData("[{\"Id\":\"valid\",\"Capability\":\"arbitrary-code\"}]")]
    public void InvalidDirectoriesAreRejected(string json)
        => Assert.Throws<InvalidOperationException>(() => AiMediaModelSupport.ConfiguredModels("chat", "auto", json));

    [Fact]
    public void ModelSelectionParticipatesInIdempotencyFingerprint()
    {
        var input = new MiniMaxImageGenerateParam { RequestId = "model-test-0001", Prompt = "一个蓝色花瓶", Model = "image-01" };
        Assert.True(MiniMaxImageSupport.TryNormalize(input, out var legacy, out _));
        input.AiModelId = "engine-a";
        Assert.True(MiniMaxImageSupport.TryNormalize(input, out var first, out _));
        input.AiModelId = "engine-b";
        Assert.True(MiniMaxImageSupport.TryNormalize(input, out var second, out _));
        Assert.NotEqual(legacy.Fingerprint, first.Fingerprint);
        Assert.NotEqual(first.Fingerprint, second.Fingerprint);
    }

    [Fact]
    public void ProviderSpecificDimensionsAreCheckedBeforeGeneration()
    {
        var image = new MiniMaxImageGenerateParam { Model = "image-01-live", Width = 1024, Height = 1024 };
        Assert.NotNull(AiMediaModelSupport.ValidateImageSettings(image, "minimax-image"));
        image.Width = image.Height = null;
        image.AspectRatio = "21:9";
        Assert.NotNull(AiMediaModelSupport.ValidateImageSettings(image, "minimax-image"));
        image.Model = "gpt-image-2";
        image.AspectRatio = "3:2";
        Assert.Null(AiMediaModelSupport.ValidateImageSettings(image, "openai-image"));
    }

    [Theory]
    [InlineData("erase")]
    [InlineData("sketch-to-image")]
    [InlineData("multi-composite")]
    public void CharacterReferenceCannotBeAdvertisedAsImageEditing(string operation)
    {
        var image = new MiniMaxImageGenerateParam { Model = "image-01", Operation = operation, AspectRatio = "1:1" };
        Assert.Contains("图像编辑", AiMediaModelSupport.ValidateImageSettings(image, "minimax-image"));
        Assert.Null(AiMediaModelSupport.ValidateImageSettings(image, "openai-image"));
        image.Operation = "image-to-image";
        Assert.Null(AiMediaModelSupport.ValidateImageSettings(image, "minimax-image"));
    }

    [Fact]
    public void MiniMaxRejectsMultipleReferencesBeforeProviderSubmission()
    {
        var image = new MiniMaxImageGenerateParam { Model = "image-01", Operation = "image-to-image",
            ReferenceImages = new() { new(), new() } };
        Assert.Contains("一张", AiMediaModelSupport.ValidateImageSettings(image, "minimax-image"));
        Assert.Null(AiMediaModelSupport.ValidateImageSettings(image, "openai-image"));
        Assert.Equal(1, AiMediaModelSupport.Describe("image-01")["MaxReferenceCount"]!.Value<int>());
    }
}
