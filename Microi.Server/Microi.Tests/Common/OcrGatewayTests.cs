using Dos.Common;
using Jint;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class OcrGatewayTests
{
    [Fact]
    public async Task Jint_can_await_the_typed_V8_OCR_contract()
    {
        var fake = new FakeV8Ocr();
        var v8 = new V8EngineParam { OCR = fake };
        var engine = new Engine(options =>
            options.ExperimentalFeatures =
                Jint.ExperimentalFeature.TaskInterop);
        engine.SetValue("V8", v8);

        var evaluated = await engine.EvaluateAsync(
            """
            (async function () {
                return await V8.OCR.Recognize({
                    FileByteBase64: 'aW1hZ2U=',
                    FileName: 'invoice.png',
                    UseDocOrientationClassify: true,
                    TextRecScoreThresh: 0.75
                });
            })()
            """);

        var result = JObject.FromObject(evaluated.ToObject());
        Assert.True(result.Value<int>("Code") == 1, result.ToString(Formatting.None));
        Assert.Equal("吾码 OCR", result.SelectToken("Data.Text")?.Value<string>());
        Assert.NotNull(fake.Captured);
        Assert.Equal("invoice.png", fake.Captured!.FileName);
        Assert.True(fake.Captured.UseDocOrientationClassify);
        Assert.Equal(0.75m, fake.Captured.TextRecScoreThresh);
    }

    [Fact]
    public void PaddleX_basic_response_is_normalized_to_pages_regions_and_confidence()
    {
        var response = new JObject
        {
            ["logId"] = "paddle-log-1",
            ["errorCode"] = 0,
            ["result"] = new JObject
            {
                ["ocrResults"] = new JArray
                {
                    new JObject
                    {
                        ["prunedResult"] = new JObject
                        {
                            ["rec_texts"] = new JArray("吾码", "OCR"),
                            ["rec_scores"] = new JArray(0.98, 0.88),
                            ["rec_polys"] = new JArray
                            {
                                new JArray(new JArray(1, 2), new JArray(11, 2), new JArray(11, 12), new JArray(1, 12)),
                                new JArray(new JArray(2, 20), new JArray(22, 20), new JArray(22, 30), new JArray(2, 30))
                            }
                        }
                    }
                }
            }
        };

        var result = MicroiOcr.ParseProviderResponse(response.ToString(Formatting.None), "PaddleX", 10);

        Assert.Equal(1, result.Code);
        Assert.NotNull(result.Data);
        Assert.Equal("paddle-log-1", result.Data!.TraceId);
        Assert.Equal("吾码\nOCR", result.Data.Text);
        Assert.Equal(1, result.Data.PageCount);
        Assert.Equal(2, result.Data.Pages[0].Regions.Count);
        Assert.Equal(0.93m, result.Data.AverageConfidence);
        Assert.Equal(4, result.Data.Pages[0].Regions[0].Polygon.Count);
    }

    [Fact]
    public void PaddleX_high_stability_envelope_is_unwrapped()
    {
        var inner = new JObject
        {
            ["errorCode"] = 0,
            ["result"] = new JObject
            {
                ["ocrResults"] = new JArray
                {
                    new JObject
                    {
                        ["prunedResult"] = new JObject
                        {
                            ["rec_texts"] = new JArray("第一页"),
                            ["rec_scores"] = new JArray(0.9)
                        }
                    }
                }
            }
        };
        var outer = new JObject
        {
            ["outputs"] = new JArray
            {
                new JObject
                {
                    ["name"] = "output",
                    ["data"] = new JArray(inner.ToString(Formatting.None))
                }
            }
        };

        var result = MicroiOcr.ParseProviderResponse(
            outer.ToString(Formatting.None),
            "PaddleXHighStability",
            10,
            "fallback-trace");

        Assert.Equal(1, result.Code);
        Assert.Equal("第一页", result.Data!.Text);
        Assert.Equal("fallback-trace", result.Data.TraceId);
    }

    [Fact]
    public void Provider_page_count_is_bounded()
    {
        var response = new JObject
        {
            ["errorCode"] = 0,
            ["result"] = new JObject
            {
                ["ocrResults"] = new JArray(
                    Enumerable.Range(0, 3).Select(_ =>
                        new JObject { ["prunedResult"] = new JObject { ["rec_texts"] = new JArray("x") } }))
            }
        };

        var result = MicroiOcr.ParseProviderResponse(response.ToString(Formatting.None), "PaddleX", 2);

        Assert.Equal(0, result.Code);
        Assert.Contains("超过租户上限", result.Msg);
    }

    [Fact]
    public void Minimum_confidence_is_enforced_again_after_provider_response()
    {
        var response = new JObject
        {
            ["errorCode"] = 0,
            ["result"] = new JObject
            {
                ["ocrResults"] = new JArray
                {
                    new JObject
                    {
                        ["prunedResult"] = new JObject
                        {
                            ["rec_texts"] = new JArray("低分文本", "保留文本"),
                            ["rec_scores"] = new JArray(0.4, 0.9)
                        }
                    }
                }
            }
        };

        var result = MicroiOcr.ParseProviderResponse(
            response.ToString(Formatting.None), "PaddleX", 10, null, 0.8m);

        Assert.Equal(1, result.Code);
        Assert.Equal("保留文本", result.Data!.Text);
        Assert.Single(result.Data.Pages[0].Regions);
        Assert.Equal(0.9m, result.Data.AverageConfidence);
    }

    [Fact]
    public void Public_request_contract_does_not_expose_network_or_secret_overrides()
    {
        var properties = typeof(MicroiOcrRecognizeParam).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.DoesNotContain("Endpoint", properties);
        Assert.DoesNotContain("HeadersJson", properties);
        Assert.DoesNotContain("ApiKey", properties);
        Assert.DoesNotContain("Provider", properties);
        Assert.Equal(typeof(IV8Ocr), typeof(V8EngineParam).GetProperty("OCR")?.PropertyType);
    }

    [Fact]
    public void Upgrade29_adds_one_ocr_tab_and_preserves_existing_tabs()
    {
        const string original = "[{\"Id\":\"base\",\"Name\":\"基础\",\"Display\":true}]";

        var once = Upgrade29.ReconcileTabs(original, out var firstChanged);
        var twice = Upgrade29.ReconcileTabs(once, out var secondChanged);
        var tabs = JArray.Parse(twice).OfType<JObject>().ToList();

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        Assert.Contains(tabs, item => item.Value<string>("Id") == "base");
        Assert.Single(tabs, item => item.Value<string>("Name") == Upgrade29.TabName);
        Assert.Equal("6.9.8.4", Upgrade29.Version);

        var migratedFieldTab = Upgrade29.ReconcileFieldTab(Upgrade29.TabName, out var fieldChanged);
        var stableFieldTab = Upgrade29.ReconcileFieldTab(Upgrade29.TabId, out var stableFieldChanged);
        Assert.True(fieldChanged);
        Assert.Equal(Upgrade29.TabId, migratedFieldTab);
        Assert.False(stableFieldChanged);
        Assert.Equal(Upgrade29.TabId, stableFieldTab);
    }

    [Fact]
    public void Upgrade29_rejects_invalid_tabs_without_overwriting_layout()
    {
        Assert.Throws<FormatException>(() => Upgrade29.ReconcileTabs("not-json", out _));
    }

    private sealed class FakeV8Ocr : IV8Ocr
    {
        public MicroiOcrRecognizeParam? Captured { get; private set; }

        public Task<DosResult<MicroiOcrRecognizeResult>> Recognize(MicroiOcrRecognizeParam param)
        {
            Captured = param;
            return Task.FromResult(new DosResult<MicroiOcrRecognizeResult>(
                1,
                new MicroiOcrRecognizeResult
                {
                    Provider = "PaddleX",
                    Text = "吾码 OCR",
                    PageCount = 1,
                    Pages = new List<MicroiOcrPage>
                    {
                        new MicroiOcrPage { PageIndex = 0, Text = "吾码 OCR" }
                    }
                },
                "识别成功。"));
        }
    }
}
