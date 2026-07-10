using SkiaSharp;

namespace Dos.Common.Tests;

public class ImageHelperProcessingTests
{
    [Fact]
    public void Create_returns_expected_metadata_and_pixels()
    {
        var result = ImageHelper.Create(new ImageCreateParam
        {
            Width = 12,
            Height = 8,
            BackgroundColor = "#ff0000",
            FileName = "solid"
        });

        Assert.Equal(12, result.Width);
        Assert.Equal(8, result.Height);
        Assert.Equal("png", result.Format);
        Assert.Equal("image/png", result.ContentType);
        Assert.Equal("solid.png", result.FileName);
        Assert.Equal(result.Bytes.LongLength, result.Size);

        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 6, 4, new SKColor(255, 0, 0));
    }

    [Fact]
    public void Create_encodes_a_real_bmp_file()
    {
        var result = ImageHelper.Create(new ImageCreateParam
        {
            Width = 7,
            Height = 5,
            BackgroundColor = "#336699",
            OutputFormat = "bmp",
            FileName = "native-bmp"
        });

        Assert.Equal("bmp", result.Format);
        Assert.Equal("image/bmp", result.ContentType);
        Assert.Equal("native-bmp.bmp", result.FileName);
        Assert.Equal((byte)'B', result.Bytes[0]);
        Assert.Equal((byte)'M', result.Bytes[1]);
        using var bitmap = Decode(result.Bytes);
        Assert.Equal(7, bitmap.Width);
        Assert.Equal(5, bitmap.Height);
        AssertColor(bitmap, 3, 2, new SKColor(0x33, 0x66, 0x99));
        var info = ImageHelper.GetInfo(new ImageInfoParam { Bytes = result.Bytes });
        Assert.Equal("bmp", info.Format);
    }

    [Theory]
    [InlineData("horizontal", 8, 3, 1, 1, 6, 1, false)]
    [InlineData("right", 8, 3, 1, 1, 6, 1, false)]
    [InlineData("left", 8, 3, 1, 1, 6, 1, true)]
    [InlineData("vertical", 4, 6, 1, 1, 1, 4, false)]
    [InlineData("bottom", 4, 6, 1, 1, 1, 4, false)]
    [InlineData("top", 4, 6, 1, 1, 1, 4, true)]
    public void Merge_supports_all_linear_layout_aliases(
        string layout,
        int expectedWidth,
        int expectedHeight,
        int firstX,
        int firstY,
        int secondX,
        int secondY,
        bool reverse)
    {
        var red = Solid(4, 3, "#ff0000");
        var blue = Solid(4, 3, "#0000ff");

        var result = ImageHelper.Merge(new ImageMergeParam
        {
            Layout = layout,
            Alignment = "start",
            Images =
            [
                new ImageLayerParam { Bytes = red.Bytes },
                new ImageLayerParam { Bytes = blue.Bytes }
            ]
        });

        Assert.Equal(expectedWidth, result.Width);
        Assert.Equal(expectedHeight, result.Height);
        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, firstX, firstY, reverse ? new SKColor(0, 0, 255) : new SKColor(255, 0, 0));
        AssertColor(bitmap, secondX, secondY, reverse ? new SKColor(255, 0, 0) : new SKColor(0, 0, 255));
    }

    [Fact]
    public void Overlay_honors_explicit_coordinates_and_z_index()
    {
        var red = Solid(10, 10, "#ff0000");
        var blue = Solid(4, 4, "#0000ff");
        var green = Solid(4, 4, "#00ff00");

        var result = ImageHelper.Merge(new ImageMergeParam
        {
            Mode = "overlay",
            CanvasWidth = 10,
            CanvasHeight = 10,
            Images =
            [
                new ImageLayerParam { Bytes = red.Bytes, ZIndex = 0 },
                new ImageLayerParam { Bytes = green.Bytes, X = 3, Y = 4, ZIndex = 2 },
                new ImageLayerParam { Bytes = blue.Bytes, X = 3, Y = 4, ZIndex = 1 }
            ]
        });

        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 1, 1, new SKColor(255, 0, 0));
        AssertColor(bitmap, 4, 5, new SKColor(0, 255, 0));
    }

    [Fact]
    public void Overlay_auto_canvas_accounts_for_a_single_explicit_axis()
    {
        var red = Solid(10, 10, "#ff0000");
        var blue = Solid(5, 20, "#0000ff");

        var result = ImageHelper.Merge(new ImageMergeParam
        {
            Mode = "overlay",
            Images =
            [
                new ImageLayerParam { Bytes = red.Bytes },
                new ImageLayerParam { Bytes = blue.Bytes, X = 12 }
            ]
        });

        Assert.Equal(17, result.Width);
        Assert.Equal(20, result.Height);
        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 14, 18, new SKColor(0, 0, 255));
    }

    [Fact]
    public void Merge_resizes_each_layer_proportionally_by_width_or_scale()
    {
        var red = Solid(20, 10, "#ff0000");
        var blue = Solid(20, 10, "#0000ff");

        var result = ImageHelper.Merge(new ImageMergeParam
        {
            Mode = "horizontal",
            Alignment = "start",
            Images =
            [
                new ImageLayerParam { Bytes = red.Bytes, Width = 8 },
                new ImageLayerParam { Bytes = blue.Bytes, Scale = 0.5 }
            ]
        });

        Assert.Equal(18, result.Width);
        Assert.Equal(5, result.Height);
        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 2, 2, new SKColor(255, 0, 0));
        AssertColor(bitmap, 13, 2, new SKColor(0, 0, 255));
    }

    [Fact]
    public void Watermark_places_scaled_image_at_requested_anchor()
    {
        var red = Solid(10, 8, "#ff0000");
        var blue = Solid(6, 4, "#0000ff");

        var result = ImageHelper.Watermark(new ImageWatermarkParam
        {
            BaseImage = new ImageSourceParam { Bytes = red.Bytes },
            Watermark = new ImageSourceParam { Bytes = blue.Bytes },
            Width = 3,
            Position = "bottom-right",
            Margin = 1
        });

        Assert.Equal(10, result.Width);
        Assert.Equal(8, result.Height);
        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 7, 5, new SKColor(0, 0, 255));
        AssertColor(bitmap, 9, 7, new SKColor(255, 0, 0));
    }

    [Fact]
    public void Draw_renders_vector_elements_over_the_source()
    {
        var white = Solid(10, 8, "#ffffff");

        var result = ImageHelper.Draw(new ImageDrawParam
        {
            Bytes = white.Bytes,
            Elements =
            [
                new ImageDrawElementParam
                {
                    Type = "rectangle",
                    X = 2,
                    Y = 2,
                    Width = 4,
                    Height = 3,
                    FillColor = "#00ff00"
                }
            ]
        });

        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 0, 0, new SKColor(255, 255, 255));
        AssertColor(bitmap, 3, 3, new SKColor(0, 255, 0));
    }

    [Fact]
    public void Draw_multiplies_embedded_alpha_by_element_opacity()
    {
        var result = ImageHelper.Create(new ImageCreateParam
        {
            Width = 4,
            Height = 4,
            BackgroundColor = "transparent",
            Elements =
            [
                new ImageDrawElementParam
                {
                    Type = "rectangle",
                    X = 0,
                    Y = 0,
                    Width = 4,
                    Height = 4,
                    FillColor = "#ff000080",
                    Opacity = 0.5
                }
            ]
        });

        using var bitmap = Decode(result.Bytes);
        AssertColor(bitmap, 2, 2, new SKColor(255, 0, 0, 64), tolerance: 2);
    }

    [Fact]
    public void Rotate_crop_and_get_info_report_the_transformed_dimensions()
    {
        var source = Solid(6, 4, "#ff0000");

        var rotated = ImageHelper.Rotate(new ImageRotateParam
        {
            Bytes = source.Bytes,
            Degrees = 90,
            Expand = true
        });
        Assert.Equal(4, rotated.Width);
        Assert.Equal(6, rotated.Height);

        var cropped = ImageHelper.Crop(new ImageCropParam
        {
            Bytes = source.Bytes,
            X = 1,
            Y = 1,
            Width = 3,
            Height = 2
        });
        Assert.Equal(3, cropped.Width);
        Assert.Equal(2, cropped.Height);

        var info = ImageHelper.GetInfo(new ImageInfoParam
        {
            DataUrl = "data:image/png;base64," + Convert.ToBase64String(cropped.Bytes)
        });
        Assert.Equal(3, info.Width);
        Assert.Equal(2, info.Height);
        Assert.Equal("png", info.Format);
        Assert.Equal("image/png", info.ContentType);
        Assert.True(info.Size > 0);
    }

    [Fact]
    public void Crop_clamp_uses_the_intersection_and_resize_blocks_one_axis_upscale()
    {
        var source = Solid(10, 10, "#ff0000");

        var cropped = ImageHelper.Crop(new ImageCropParam
        {
            Bytes = source.Bytes,
            X = -3,
            Y = -2,
            Width = 5,
            Height = 4,
            Clamp = true
        });
        Assert.Equal(2, cropped.Width);
        Assert.Equal(2, cropped.Height);

        var resized = ImageHelper.Resize(new ImageResizeParam
        {
            Bytes = source.Bytes,
            Width = 20,
            Height = 5,
            Fit = "fill",
            AllowUpscale = false
        });
        Assert.Equal(10, resized.Width);
        Assert.Equal(5, resized.Height);

        var covered = ImageHelper.Resize(new ImageResizeParam
        {
            Bytes = source.Bytes,
            Width = 20,
            Height = 5,
            Fit = "cover",
            AllowUpscale = false
        });
        Assert.Equal(8, covered.Width);
        Assert.Equal(2, covered.Height);
    }

    [Fact]
    public void Invalid_base64_and_processing_limits_are_rejected()
    {
        var invalidBase64 = Assert.Throws<ArgumentException>(() => ImageHelper.GetInfo(new ImageInfoParam
        {
            Base64 = "this-is-not-base64!"
        }));
        Assert.Contains("Base64", invalidBase64.Message);

        Assert.Throws<ArgumentOutOfRangeException>(() => ImageHelper.Create(new ImageCreateParam
        {
            Width = ImageHelper.ImageProcessingMaxDimension + 1,
            Height = 1
        }));

        var tooManyLayers = Enumerable.Range(0, ImageHelper.ImageProcessingMaxImages + 1)
            .Select(_ => new ImageLayerParam())
            .ToList();
        var tooMany = Assert.Throws<ArgumentException>(() => ImageHelper.Merge(new ImageMergeParam
        {
            Images = tooManyLayers
        }));
        Assert.Contains(ImageHelper.ImageProcessingMaxImages.ToString(), tooMany.Message);

        var tiny = Solid(1, 1, "#ffffff");
        var renderedBudget = Assert.Throws<ArgumentException>(() => ImageHelper.Merge(new ImageMergeParam
        {
            Mode = "overlay",
            Images =
            [
                new ImageLayerParam { Bytes = tiny.Bytes, Width = 5000, Height = 5000, Fit = "fill" },
                new ImageLayerParam { Bytes = tiny.Bytes, Width = 5000, Height = 5000, Fit = "fill" },
                new ImageLayerParam { Bytes = tiny.Bytes, Width = 5000, Height = 5000, Fit = "fill" }
            ]
        }));
        Assert.Contains("图层总量", renderedBudget.Message);
    }

    [Fact]
    public void Qr_code_legacy_stream_and_new_processing_result_remain_decodable()
    {
        byte[] legacyBytes;
        using (var stream = ImageHelper.CreateQRCode("https://microi.net/qr-regression"))
        using (var memory = new MemoryStream())
        {
            stream.CopyTo(memory);
            legacyBytes = memory.ToArray();
        }

        Assert.NotEmpty(legacyBytes);
        var legacyInfo = ImageHelper.GetInfo(new ImageInfoParam { Bytes = legacyBytes });
        Assert.Equal(300, legacyInfo.Width);
        Assert.Equal(300, legacyInfo.Height);

        var result = ImageHelper.CreateQRCode(new ImageQrCodeParam
        {
            Content = "https://microi.net/v8-image",
            Size = 96
        });
        Assert.Equal(96, result.Width);
        Assert.Equal(96, result.Height);
        Assert.Equal("image/png", result.ContentType);
        var info = ImageHelper.GetInfo(new ImageInfoParam { Bytes = result.Bytes });
        Assert.Equal(96, info.Width);
        Assert.Equal(96, info.Height);
    }

    private static ImageProcessResult Solid(int width, int height, string color)
    {
        return ImageHelper.Create(new ImageCreateParam
        {
            Width = width,
            Height = height,
            BackgroundColor = color,
            Format = "png"
        });
    }

    private static SKBitmap Decode(byte[] bytes)
    {
        var bitmap = SKBitmap.Decode(bytes);
        return Assert.IsType<SKBitmap>(bitmap);
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
