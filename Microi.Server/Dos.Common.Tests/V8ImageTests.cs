using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;
using SkiaSharp;

namespace Dos.Common.Tests;

public class V8ImageTests
{
    [Fact]
    public void Overlay_accepts_object_aliases_and_returns_standard_dos_result()
    {
        var large = ImageHelper.Create(new ImageCreateParam
        {
            Width = 8,
            Height = 6,
            BackgroundColor = "#ff0000"
        });
        var small = ImageHelper.Create(new ImageCreateParam
        {
            Width = 4,
            Height = 4,
            BackgroundColor = "#0000ff"
        });

        var result = new V8Image().Overlay(new
        {
            BaseImage = Convert.ToBase64String(large.Bytes),
            OverlayImage = new
            {
                ImageBase64 = Convert.ToBase64String(small.Bytes),
                X = 3,
                Y = 2,
                Scale = 0.5,
                Order = 5
            },
            OutputType = "png"
        });

        Assert.Equal(1, result.Code);
        Assert.NotNull(result.Data);
        var payload = JObject.FromObject(result.Data);
        Assert.Equal(8, payload.Value<int>("Width"));
        Assert.Equal(6, payload.Value<int>("Height"));
        Assert.Equal("image/png", payload.Value<string>("ContentType"));

        var bytes = Convert.FromBase64String(payload.Value<string>("FileByteBase64")!);
        using var bitmap = Assert.IsType<SKBitmap>(SKBitmap.Decode(bytes));
        AssertColor(bitmap, 0, 0, new SKColor(255, 0, 0));
        AssertColor(bitmap, 3, 2, new SKColor(0, 0, 255));
    }

    [Fact]
    public void Invalid_base64_is_converted_to_failed_dos_result()
    {
        var result = new V8Image().GetInfo(new { Base64 = "not-valid-base64!" });

        Assert.Equal(0, result.Code);
        Assert.Null(result.Data);
        Assert.Contains("图片处理失败", result.Msg);
        Assert.Contains("Base64", result.Msg);
    }

    [Fact]
    public void Registry_exposes_image_on_v8_and_accepts_real_javascript_objects()
    {
        Assert.Contains(V8ExtensionRegistry.GetRegisteredNames(),
            name => string.Equals(name, "Image", StringComparison.OrdinalIgnoreCase));

        var engine = new Engine();
        engine.Execute("var V8 = {};");
        V8ExtensionRegistry.InjectAll(engine);

        var mergedBase64 = engine.Evaluate(
            """
            (function () {
                var large = V8.Image.Create({
                    Width: 8,
                    Height: 6,
                    BackgroundColor: '#ff0000'
                });
                var small = V8.Image.Create({
                    Width: 4,
                    Height: 4,
                    BackgroundColor: '#0000ff'
                });
                if (large.Code !== 1) throw new Error('Create large failed: ' + large.Msg);
                if (small.Code !== 1) throw new Error('Create small failed: ' + small.Msg);

                var merged = V8.Image.Merge({
                    BaseImage: large.Data.FileByteBase64,
                    OverlayImage: {
                        ImageBase64: small.Data.FileByteBase64,
                        X: 3,
                        Y: 2,
                        Width: 2,
                        ZIndex: 1
                    },
                    OutputType: 'png'
                });
                if (merged.Code !== 1) throw new Error('Merge failed: ' + merged.Msg);
                return merged.Data.FileByteBase64;
            })()
            """).AsString();

        using var bitmap = Assert.IsType<SKBitmap>(
            SKBitmap.Decode(Convert.FromBase64String(mergedBase64)));
        Assert.Equal(8, bitmap.Width);
        Assert.Equal(6, bitmap.Height);
        AssertColor(bitmap, 0, 0, new SKColor(255, 0, 0));
        AssertColor(bitmap, 3, 2, new SKColor(0, 0, 255));
    }

    private static void AssertColor(SKBitmap bitmap, int x, int y, SKColor expected, int tolerance = 2)
    {
        var actual = bitmap.GetPixel(x, y);
        Assert.InRange(Math.Abs(actual.Red - expected.Red), 0, tolerance);
        Assert.InRange(Math.Abs(actual.Green - expected.Green), 0, tolerance);
        Assert.InRange(Math.Abs(actual.Blue - expected.Blue), 0, tolerance);
        Assert.InRange(Math.Abs(actual.Alpha - expected.Alpha), 0, tolerance);
    }
}
