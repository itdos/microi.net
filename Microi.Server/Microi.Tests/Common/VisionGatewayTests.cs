using System.Runtime.CompilerServices;
using Dos.Common;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;
using SkiaSharp;

namespace Microi.Tests.Common;

public sealed class VisionGatewayTests
{
    [Fact]
    public async Task Jint_can_await_the_typed_V8_Vision_contract()
    {
        var fake = new FakeV8Vision();
        var v8 = new V8EngineParam { Vision = fake };
        var engine = new Engine(options =>
            options.ExperimentalFeatures = Jint.ExperimentalFeature.TaskInterop);
        engine.SetValue("V8", v8);

        var evaluated = await engine.EvaluateAsync(
            """
            (async function () {
                return await V8.Vision.Extract({
                    FileByteBase64: 'aW1hZ2U=',
                    FileName: 'carp.jpg',
                    ModelKey: 'dinov2-vits14',
                    Mode: 'General',
                    FrameId: 'frame-7'
                });
            })()
            """);

        var result = JObject.FromObject(evaluated.ToObject());
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.Equal("dinov2-vits14", result.SelectToken("Data.ModelKey")?.Value<string>());
        Assert.NotNull(fake.Captured);
        Assert.Equal("frame-7", fake.Captured!.FrameId);
    }

    [Fact]
    public async Task Builtin_fingerprint_is_deterministic_and_separates_distinct_images()
    {
        using var service = CreateService();
        var red = CreateImageBase64(SKColors.Crimson, SKColors.Gold, false);
        var redVariant = CreateImageBase64(SKColors.Crimson, SKColors.Gold, true);
        var blue = CreateImageBase64(SKColors.Navy, SKColors.Aqua, false);

        var first = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = red,
            FileName = "red.png"
        });
        var same = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = red,
            FileName = "red-again.png"
        });
        var related = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = redVariant,
            FileName = "red-variant.png"
        });
        var distinct = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = blue,
            FileName = "blue.png"
        });

        Assert.Equal(1, first.Code);
        Assert.Equal(first.Data!.EmbeddingBase64, same.Data!.EmbeddingBase64);
        Assert.Equal("float32-le-base64-l2", first.Data.EmbeddingFormat);
        Assert.InRange(first.Data.QualityScore, 0m, 1m);
        Assert.Contains(first.Data.Warnings, warning => warning.Contains("近似样图"));

        var relatedScore = await service.CompareAsync(new MicroiVisionCompareParam
        {
            LeftEmbeddingBase64 = first.Data.EmbeddingBase64,
            RightEmbeddingBase64 = related.Data!.EmbeddingBase64,
            Threshold = 0.7m
        });
        var distinctScore = await service.CompareAsync(new MicroiVisionCompareParam
        {
            LeftEmbeddingBase64 = first.Data.EmbeddingBase64,
            RightEmbeddingBase64 = distinct.Data!.EmbeddingBase64,
            Threshold = 0.7m
        });

        Assert.Equal(1, relatedScore.Code);
        Assert.True(relatedScore.Data!.Similarity > distinctScore.Data!.Similarity,
            $"related={relatedScore.Data.Similarity}, distinct={distinctScore.Data.Similarity}");
    }

    [Fact]
    public async Task Compare_batch_returns_stable_top_k_and_threshold_state()
    {
        using var service = CreateService();
        var query = EncodeNormalized(1f, 0f, 0f);
        var close = EncodeNormalized(0.99f, 0.1f, 0f);
        var far = EncodeNormalized(0f, 1f, 0f);

        var result = await service.CompareBatchAsync(new MicroiVisionCompareBatchParam
        {
            QueryEmbeddingBase64 = query,
            Threshold = 0.9m,
            TopK = 1,
            Candidates = new List<MicroiVisionCandidate>
            {
                new() { Key = "far", Name = "Far", EmbeddingBase64 = far },
                new() { Key = "close", Name = "Close", EmbeddingBase64 = close }
            }
        });

        Assert.Equal(1, result.Code);
        Assert.Equal(2, result.Data!.CandidateCount);
        var best = Assert.Single(result.Data.Matches);
        Assert.Equal("close", best.Key);
        Assert.True(best.Matched);
    }

    [Fact]
    public async Task Hnsw_search_is_tenant_scoped_deterministic_and_reuses_the_index()
    {
        using var service = new MicroiVision(new MicroiVisionOptions
        {
            ModelDirectory = Path.Combine(Path.GetTempPath(), "microi-vision-tests", Guid.NewGuid().ToString("N")),
            HnswMinimumCandidateCount = 32,
            MaximumCandidateCount = 128
        });
        var candidates = Enumerable.Range(0, 40).Select(index =>
        {
            var angle = index * Math.PI * 2 / 40;
            return new MicroiVisionCandidate
            {
                Key = $"candidate-{index:D2}",
                Name = $"Candidate {index:D2}",
                EmbeddingBase64 = EncodeNormalized((float)Math.Cos(angle), (float)Math.Sin(angle), 0f)
            };
        }).ToList();
        var request = new MicroiVisionSearchParam
        {
            OsClient = "tenant-a",
            QueryEmbeddingBase64 = EncodeNormalized(1f, 0f, 0f),
            Candidates = candidates,
            Threshold = 0.9m,
            TopK = 3,
            EfSearch = 40,
            IndexKey = "fish-catalog-v1"
        };

        var first = await service.SearchAsync(request);
        var second = await service.SearchAsync(request);

        Assert.Equal(1, first.Code);
        Assert.Equal("HNSW-Cosine", first.Data!.Algorithm);
        Assert.False(first.Data.CacheHit);
        Assert.Equal("candidate-00", first.Data.Matches[0].Key);
        Assert.Equal(1, second.Code);
        Assert.True(second.Data!.CacheHit);
        Assert.Equal(first.Data.Matches.Select(item => item.Key), second.Data.Matches.Select(item => item.Key));
    }

    [Fact]
    public async Task Continuous_frame_vote_and_builtin_tracking_only_stabilize_repeated_subjects()
    {
        using var service = CreateService();
        var observations = new List<MicroiVisionFrameObservation>
        {
            new() { FrameId = "1", TrackId = "track-1", Key = "carp", Name = "鲤鱼", Confidence = 0.82m, TimestampMilliseconds = 1 },
            new() { FrameId = "2", TrackId = "track-1", Key = "carp", Name = "鲤鱼", Confidence = 0.86m, TimestampMilliseconds = 2 },
            new() { FrameId = "3", TrackId = "track-1", Key = "carp", Name = "鲤鱼", Confidence = 0.84m, TimestampMilliseconds = 3 },
            new() { FrameId = "4", TrackId = "track-2", Key = "bass", Name = "鲈鱼", Confidence = 0.91m, TimestampMilliseconds = 4 }
        };
        var voted = await service.StabilizeAsync(new MicroiVisionTemporalVoteParam
        {
            Observations = observations,
            WindowSize = 4,
            MinimumVotes = 3,
            MinimumAverageConfidence = 0.8m
        });
        Assert.Equal(1, voted.Code);
        Assert.True(voted.Data!.Stable);
        Assert.Equal("carp", voted.Data.Key);
        Assert.Equal(3, voted.Data.VoteCount);

        var image = CreateImageBase64(SKColors.DarkSlateBlue, SKColors.White, false);
        var first = await service.AnalyzeAsync(new MicroiVisionAnalyzeParam
        {
            OsClient = "tenant-a", FileByteBase64 = image, FileName = "1.png",
            PipelineKey = MicroiVision.BuiltinModelKey, StreamSessionId = "checkout-1",
            FrameSequence = 1, ResetStream = true
        });
        var next = await service.AnalyzeAsync(new MicroiVisionAnalyzeParam
        {
            OsClient = "tenant-a", FileByteBase64 = image, FileName = "2.png",
            PipelineKey = MicroiVision.BuiltinModelKey, StreamSessionId = "checkout-1",
            FrameSequence = 2
        });
        Assert.Equal(1, first.Code);
        Assert.Equal(1, next.Code);
        Assert.Equal("track-1", first.Data!.Detections.Single().TrackId);
        Assert.Equal(first.Data.Detections.Single().TrackId, next.Data!.Detections.Single().TrackId);
        Assert.Equal(2, next.Data.FrameSequence);
    }

    [Fact]
    public async Task Invalid_image_and_uninstalled_model_fail_closed_without_paths()
    {
        using var service = CreateService();
        var invalid = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = Convert.ToBase64String("not-an-image"u8.ToArray()),
            FileName = "fake.png"
        });
        var missing = await service.ExtractAsync(new MicroiVisionExtractParam
        {
            FileByteBase64 = CreateImageBase64(SKColors.White, SKColors.Black, false),
            FileName = "image.png",
            ModelKey = "missing-model"
        });

        Assert.Equal(0, invalid.Code);
        Assert.Contains("魔数", invalid.Msg);
        Assert.Equal(0, missing.Code);
        Assert.Contains("模型包未安装", missing.Msg);
        Assert.DoesNotContain(Path.GetTempPath(), missing.Msg, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Frame_batch_and_async_frame_stream_preserve_frame_ids()
    {
        using var service = CreateService();
        var image = CreateImageBase64(SKColors.ForestGreen, SKColors.White, false);
        var batch = await service.ExtractBatchAsync(new MicroiVisionFrameBatchParam
        {
            Frames = new List<MicroiVisionExtractParam>
            {
                new() { FrameId = "a", FileByteBase64 = image, FileName = "a.png" },
                new() { FrameId = "b", FileByteBase64 = image, FileName = "b.png" }
            }
        });

        Assert.Equal(1, batch.Code);
        Assert.Equal(new[] { "a", "b" }, batch.Data!.Frames.Select(item => item.FrameId));

        var streamed = new List<string?>();
        await foreach (var item in service.RecognizeFramesAsync(
                           Frames(image), MicroiVision.BuiltinModelKey, "General"))
        {
            Assert.Equal(1, item.Code);
            streamed.Add(item.Data?.FrameId);
        }
        Assert.Equal(new[] { "stream-1", "stream-2" }, streamed);
    }

    [Fact]
    public void Public_contract_does_not_expose_model_path_endpoint_or_execution_provider()
    {
        var properties = typeof(MicroiVisionExtractParam).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.DoesNotContain("ModelPath", properties);
        Assert.DoesNotContain("Endpoint", properties);
        Assert.DoesNotContain("ExecutionProvider", properties);
        Assert.DoesNotContain("ApiKey", properties);
        Assert.Equal(typeof(IV8Vision), typeof(V8EngineParam).GetProperty("Vision")?.PropertyType);

        using var service = CreateService();
        var capabilities = service.GetCapabilities();
        Assert.Equal(1, capabilities.Code);
        Assert.Contains(capabilities.Data!.Models,
            model => model.ModelKey == MicroiVision.BuiltinModelKey && model.Ready);
    }

    private static MicroiVision CreateService()
    {
        return new MicroiVision(new MicroiVisionOptions
        {
            ModelDirectory = Path.Combine(Path.GetTempPath(), "microi-vision-tests", Guid.NewGuid().ToString("N"))
        });
    }

    private static string CreateImageBase64(SKColor background, SKColor foreground, bool variant)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(128, 96, SKColorType.Rgba8888, SKAlphaType.Premul));
        using (var canvas = new SKCanvas(bitmap))
        using (var paint = new SKPaint { IsAntialias = true, Color = foreground })
        {
            canvas.Clear(background);
            canvas.DrawOval(new SKRect(24, 18, 106, 78), paint);
            if (variant)
            {
                paint.Color = SKColors.White;
                paint.StrokeWidth = 3;
                canvas.DrawLine(22, 47, 108, 49, paint);
            }
            canvas.Flush();
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return Convert.ToBase64String(data.ToArray());
    }

    private static string EncodeNormalized(params float[] values)
    {
        var norm = Math.Sqrt(values.Sum(value => value * value));
        var normalized = values.Select(value => (float)(value / norm)).ToArray();
        var bytes = new byte[normalized.Length * sizeof(float)];
        Buffer.BlockCopy(normalized, 0, bytes, 0, bytes.Length);
        return Convert.ToBase64String(bytes);
    }

    private static async IAsyncEnumerable<MicroiVisionExtractParam> Frames(
        string image,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await Task.Yield();
        cancellationToken.ThrowIfCancellationRequested();
        yield return new MicroiVisionExtractParam { FrameId = "stream-1", FileByteBase64 = image, FileName = "1.png" };
        yield return new MicroiVisionExtractParam { FrameId = "stream-2", FileByteBase64 = image, FileName = "2.png" };
    }

    private sealed class FakeV8Vision : IV8Vision
    {
        public MicroiVisionExtractParam? Captured { get; private set; }

        public Task<DosResult<MicroiVisionExtractResult>> Extract(MicroiVisionExtractParam param)
        {
            Captured = param;
            return Task.FromResult(new DosResult<MicroiVisionExtractResult>(1,
                new MicroiVisionExtractResult
                {
                    ModelKey = param.ModelKey,
                    FrameId = param.FrameId,
                    EmbeddingBase64 = "AAAAAA==",
                    EmbeddingDimensions = 1
                }, "ok"));
        }

        public Task<DosResult<MicroiVisionFrameBatchResult>> ExtractBatch(MicroiVisionFrameBatchParam param) =>
            Task.FromResult(new DosResult<MicroiVisionFrameBatchResult>(1, new MicroiVisionFrameBatchResult(), "ok"));

        public Task<DosResult<MicroiVisionCompareResult>> Compare(MicroiVisionCompareParam param) =>
            Task.FromResult(new DosResult<MicroiVisionCompareResult>(1, new MicroiVisionCompareResult(), "ok"));

        public Task<DosResult<MicroiVisionCompareBatchResult>> CompareBatch(MicroiVisionCompareBatchParam param) =>
            Task.FromResult(new DosResult<MicroiVisionCompareBatchResult>(1, new MicroiVisionCompareBatchResult(), "ok"));

        public Task<DosResult<MicroiVisionAnalyzeResult>> Analyze(MicroiVisionAnalyzeParam param) =>
            Task.FromResult(new DosResult<MicroiVisionAnalyzeResult>(1, new MicroiVisionAnalyzeResult(), "ok"));

        public Task<DosResult<MicroiVisionSearchResult>> Search(MicroiVisionSearchParam param) =>
            Task.FromResult(new DosResult<MicroiVisionSearchResult>(1, new MicroiVisionSearchResult(), "ok"));

        public Task<DosResult<MicroiVisionTemporalVoteResult>> Stabilize(MicroiVisionTemporalVoteParam param) =>
            Task.FromResult(new DosResult<MicroiVisionTemporalVoteResult>(1, new MicroiVisionTemporalVoteResult(), "ok"));

        public DosResult<MicroiVisionCapabilitiesResult> GetCapabilities() =>
            new(1, new MicroiVisionCapabilitiesResult(), "ok");
    }
}
