using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using SkiaSharp;
using SkiaSharp.QrCode;

namespace Dos.Common
{
    /// <summary>
    /// 图片二进制来源。面向 V8 时推荐使用 FileByteBase64、Base64 或 DataUrl；
    /// 不接受本地路径和 URL，避免目录穿越与 SSRF。
    /// </summary>
    public class ImageSourceParam
    {
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
        public string FileName { get; set; }
    }

    public class ImageLayerParam : ImageSourceParam
    {
        public int? Width { get; set; }
        public int? Height { get; set; }
        public double? Scale { get; set; }
        public string Fit { get; set; } = "contain";
        public int? X { get; set; }
        public int? Y { get; set; }
        public int OffsetX { get; set; }
        public int OffsetY { get; set; }
        public string Anchor { get; set; } = "top-left";
        public string Position { get; set; }
        public double Opacity { get; set; } = 1D;
        public double Rotation { get; set; }
        public int ZIndex { get; set; }
        public bool FlipHorizontal { get; set; }
        public bool FlipVertical { get; set; }
        public int? CropX { get; set; }
        public int? CropY { get; set; }
        public int? CropWidth { get; set; }
        public int? CropHeight { get; set; }
        public double CornerRadius { get; set; }
        public string BorderColor { get; set; }
        public double BorderWidth { get; set; }
        public string BlendMode { get; set; } = "src-over";
    }

    public class ImageOutputParam
    {
        public string Format { get; set; } = "png";
        public string OutputFormat { get; set; }
        public int Quality { get; set; } = 90;
        public string BackgroundColor { get; set; }
        public string FileName { get; set; }
    }

    public class ImageCreateParam : ImageOutputParam
    {
        public int Width { get; set; } = 800;
        public int Height { get; set; } = 600;
        public int? CanvasWidth { get; set; }
        public int? CanvasHeight { get; set; }
        public string BackgroundColorEnd { get; set; }
        public string GradientDirection { get; set; } = "left-to-right";
        public string Text { get; set; }
        public string TextColor { get; set; } = "#111827";
        public double FontSize { get; set; } = 32D;
        public string FontFamily { get; set; }
        public List<ImageDrawElementParam> Elements { get; set; }
    }

    public class ImageMergeParam : ImageOutputParam
    {
        public string Mode { get; set; } = "horizontal";
        public string Layout { get; set; }
        public string Direction { get; set; }
        public List<ImageLayerParam> Images { get; set; }
        public List<ImageLayerParam> Layers { get; set; }
        public int? CanvasWidth { get; set; }
        public int? CanvasHeight { get; set; }
        public int Padding { get; set; }
        public int Gap { get; set; }
        public string Alignment { get; set; } = "center";
        public int? Columns { get; set; }
    }

    public class ImageResizeParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public string Fit { get; set; } = "contain";
        public bool Pad { get; set; }
        public bool AllowUpscale { get; set; } = true;
        public string Alignment { get; set; } = "center";
    }

    public class ImageCropParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool Clamp { get; set; }
    }

    public class ImageRotateParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
        public double Degrees { get; set; }
        public bool Expand { get; set; } = true;
    }

    public class ImageFlipParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
        public bool Horizontal { get; set; } = true;
        public bool Vertical { get; set; }
    }

    public class ImageConvertParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
        public byte[] Bytes { get; set; }
        public string FileByteBase64 { get; set; }
        public string Base64 { get; set; }
        public string DataUrl { get; set; }
    }

    public class ImageDrawParam : ImageConvertParam
    {
        public List<ImageDrawElementParam> Elements { get; set; }
    }

    public class ImageDrawElementParam
    {
        public string Type { get; set; } = "text";
        public double X { get; set; }
        public double Y { get; set; }
        public double? X2 { get; set; }
        public double? Y2 { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
        public string Text { get; set; }
        public string Color { get; set; } = "#111827";
        public string FillColor { get; set; }
        public string StrokeColor { get; set; }
        public double StrokeWidth { get; set; }
        public double CornerRadius { get; set; }
        public double FontSize { get; set; } = 24D;
        public string FontFamily { get; set; }
        public string FontStyle { get; set; } = "normal";
        public string Align { get; set; } = "left";
        public string VerticalAlign { get; set; } = "top";
        public double Opacity { get; set; } = 1D;
        public double Rotation { get; set; }
    }

    public class ImageWatermarkParam : ImageOutputParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam BaseImage { get; set; }
        public ImageSourceParam Watermark { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public double? Scale { get; set; }
        public string Position { get; set; } = "bottom-right";
        public int Margin { get; set; } = 10;
        public int OffsetX { get; set; }
        public int OffsetY { get; set; }
        public double Opacity { get; set; } = 1D;
        public double Rotation { get; set; }
    }

    public class ImageInfoParam : ImageSourceParam
    {
        public ImageSourceParam Image { get; set; }
        public ImageSourceParam Source { get; set; }
    }

    public class ImageQrCodeParam : ImageOutputParam
    {
        public string Content { get; set; }
        public string Text { get; set; }
        public int Size { get; set; } = 300;
    }

    public class ImageProcessResult
    {
        public byte[] Bytes { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public string Format { get; set; }
        public string ContentType { get; set; }
        public string FileName { get; set; }
        public long Size { get; set; }
    }

    public class ImageInfoResult
    {
        public int Width { get; set; }
        public int Height { get; set; }
        public string Format { get; set; }
        public string ContentType { get; set; }
        public long Size { get; set; }
        public int FrameCount { get; set; }
        public int RepetitionCount { get; set; }
        public string Origin { get; set; }
        public bool HasAlpha { get; set; }
    }

    /// <summary>
    /// ImageHelper 的跨平台 SkiaSharp 图片处理能力。
    /// 所有方法均返回新的字节数组，不关闭、覆盖或修改调用方的输入。
    /// </summary>
    public partial class ImageHelper
    {
        public const int ImageProcessingMaxImages = 50;
        public const int ImageProcessingMaxDimension = 16384;
        public const long ImageProcessingMaxPixels = 25_000_000L;
        public const long ImageProcessingMaxTotalPixels = 50_000_000L;
        public const long ImageProcessingMaxRenderedPixels = 50_000_000L;
        public const int ImageProcessingMaxInputBytesPerImage = 25 * 1024 * 1024;
        public const long ImageProcessingMaxTotalInputBytes = 100L * 1024 * 1024;
        public const int ImageProcessingMaxOutputBytes = 50 * 1024 * 1024;
        private const string EmbeddedFallbackFontResource =
            "Dos.Common.Resource.NotoSansCJKsc-Regular.otf";
        private static readonly Lazy<byte[]> EmbeddedFallbackFontBytes =
            new Lazy<byte[]>(LoadEmbeddedFallbackFontBytes);

        public static ImageProcessResult Create(ImageCreateParam param)
        {
            param = param ?? new ImageCreateParam();
            var width = param.CanvasWidth ?? param.Width;
            var height = param.CanvasHeight ?? param.Height;
            ValidateCanvas(width, height);
            var format = ResolveFormat(param.OutputFormat, param.Format);
            var elements = param.Elements == null
                ? new List<ImageDrawElementParam>()
                : new List<ImageDrawElementParam>(param.Elements);
            if (!string.IsNullOrWhiteSpace(param.Text))
            {
                elements.Add(new ImageDrawElementParam
                {
                    Type = "text",
                    Text = param.Text,
                    X = width / 2D,
                    Y = height / 2D,
                    Color = param.TextColor,
                    FontSize = param.FontSize,
                    FontFamily = param.FontFamily,
                    Align = "center",
                    VerticalAlign = "middle"
                });
            }

            return Render(width, height, format, param.Quality, param.FileName, param.BackgroundColor,
                canvas =>
                {
                    DrawCreateBackground(canvas, width, height, param.BackgroundColor,
                        param.BackgroundColorEnd, param.GradientDirection, format);
                    DrawElements(canvas, elements);
                }, clearBeforeDraw: false);
        }

        public static ImageProcessResult Merge(ImageMergeParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var layers = param.Images ?? param.Layers;
            if (layers == null || layers.Count == 0)
                throw new ArgumentException("Images/Layers 至少需要一张图片。", nameof(param));
            if (layers.Count > ImageProcessingMaxImages)
                throw new ArgumentException($"单次最多处理 {ImageProcessingMaxImages} 张图片。", nameof(param));

            var budget = new InputBudget();
            var prepared = new List<PreparedLayer>();
            try
            {
                for (var i = 0; i < layers.Count; i++)
                {
                    var layer = layers[i] ?? throw new ArgumentException($"第 {i + 1} 个图片参数不能为空。", nameof(param));
                    prepared.Add(PrepareLayer(layer, budget, i));
                }

                var mode = NormalizeMode(param.Layout, param.Mode, out var impliedDirection);
                var direction = NormalizeDirection(param.Direction, impliedDirection, mode);
                if ((direction == "rtl" || direction == "btt") && mode != "overlay")
                    prepared.Reverse();

                var size = CalculateMergeSize(param, prepared, mode);
                ValidateCanvas(size.Width, size.Height);
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(size.Width, size.Height, format, param.Quality, param.FileName, param.BackgroundColor,
                    canvas => DrawMerged(canvas, param, prepared, mode, size.Width, size.Height));
            }
            finally
            {
                foreach (var layer in prepared) layer.Dispose();
            }
        }

        public static ImageProcessResult Resize(ImageResizeParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            if (!param.Width.HasValue && !param.Height.HasValue)
                throw new ArgumentException("Width、Height 至少需要设置一个。", nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            var layerParam = CopyToLayer(source);
            layerParam.Width = param.Width;
            layerParam.Height = param.Height;
            layerParam.Fit = param.Fit;
            using (var layer = PrepareLayer(layerParam, new InputBudget(), 0))
            {
                if (!param.AllowUpscale &&
                    (layer.TargetWidth > layer.SourceRect.Width || layer.TargetHeight > layer.SourceRect.Height))
                {
                    var fit = NormalizeToken(param.Fit);
                    if (fit == "fill" || fit == "stretch")
                    {
                        layer.ResetTarget(
                            Math.Min(layer.TargetWidth, (int)layer.SourceRect.Width),
                            Math.Min(layer.TargetHeight, (int)layer.SourceRect.Height));
                    }
                    else
                    {
                        var divisor = GreatestCommonDivisor(layer.TargetWidth, layer.TargetHeight);
                        var unitWidth = layer.TargetWidth / divisor;
                        var unitHeight = layer.TargetHeight / divisor;
                        var multiples = Math.Min(
                            (int)Math.Floor(layer.SourceRect.Width / unitWidth),
                            (int)Math.Floor(layer.SourceRect.Height / unitHeight));
                        if (multiples > 0)
                        {
                            layer.ResetTarget(unitWidth * multiples, unitHeight * multiples);
                        }
                        else
                        {
                            var downscale = Math.Min(1D, Math.Min(
                                layer.SourceRect.Width / layer.TargetWidth,
                                layer.SourceRect.Height / layer.TargetHeight));
                            layer.ResetTarget(
                                Math.Max(1, (int)Math.Floor(layer.TargetWidth * downscale)),
                                Math.Max(1, (int)Math.Floor(layer.TargetHeight * downscale)));
                        }
                    }
                }
                var width = param.Pad && param.Width.HasValue ? param.Width.Value : (int)Math.Ceiling(layer.BoundsWidth);
                var height = param.Pad && param.Height.HasValue ? param.Height.Value : (int)Math.Ceiling(layer.BoundsHeight);
                ValidateCanvas(width, height);
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(width, height, format, param.Quality, param.FileName, param.BackgroundColor,
                    canvas =>
                    {
                        var position = ResolveBoxAlignment(param.Alignment, width, height, layer.BoundsWidth, layer.BoundsHeight);
                        DrawPreparedLayer(canvas, layer, position.X, position.Y);
                    });
            }
        }

        public static ImageProcessResult Crop(ImageCropParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            if (param.Width <= 0 || param.Height <= 0)
                throw new ArgumentException("裁剪 Width 和 Height 必须大于 0。", nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            using (var bitmap = Decode(source, new InputBudget(), out _))
            {
                var x = param.X;
                var y = param.Y;
                var width = param.Width;
                var height = param.Height;
                if (param.Clamp)
                {
                    var left = Math.Max(0L, x);
                    var top = Math.Max(0L, y);
                    var right = Math.Min((long)bitmap.Width, (long)x + width);
                    var bottom = Math.Min((long)bitmap.Height, (long)y + height);
                    x = (int)left;
                    y = (int)top;
                    width = (int)Math.Max(0L, right - left);
                    height = (int)Math.Max(0L, bottom - top);
                }
                if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > bitmap.Width || y + height > bitmap.Height)
                    throw new ArgumentException("裁剪区域超出原图范围。", nameof(param));
                ValidateCanvas(width, height);
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(width, height, format, param.Quality, param.FileName, param.BackgroundColor,
                    canvas => canvas.DrawBitmap(bitmap,
                        new SKRect(x, y, x + width, y + height),
                        new SKRect(0, 0, width, height)));
            }
        }

        public static ImageProcessResult Rotate(ImageRotateParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            var layerParam = CopyToLayer(source);
            layerParam.Rotation = param.Degrees;
            using (var layer = PrepareLayer(layerParam, new InputBudget(), 0))
            {
                var width = param.Expand ? (int)Math.Ceiling(layer.BoundsWidth) : layer.Bitmap.Width;
                var height = param.Expand ? (int)Math.Ceiling(layer.BoundsHeight) : layer.Bitmap.Height;
                ValidateCanvas(width, height);
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(width, height, format, param.Quality, param.FileName, param.BackgroundColor,
                    canvas => DrawPreparedLayer(canvas, layer,
                        (width - layer.BoundsWidth) / 2F,
                        (height - layer.BoundsHeight) / 2F));
            }
        }

        public static ImageProcessResult Flip(ImageFlipParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            var layerParam = CopyToLayer(source);
            layerParam.FlipHorizontal = param.Horizontal;
            layerParam.FlipVertical = param.Vertical;
            using (var layer = PrepareLayer(layerParam, new InputBudget(), 0))
            {
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(layer.Bitmap.Width, layer.Bitmap.Height, format, param.Quality,
                    param.FileName, param.BackgroundColor,
                    canvas => DrawPreparedLayer(canvas, layer, 0, 0));
            }
        }

        public static ImageProcessResult Convert(ImageConvertParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            using (var bitmap = Decode(source, new InputBudget(), out _))
            {
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(bitmap.Width, bitmap.Height, format, param.Quality, param.FileName,
                    param.BackgroundColor,
                    canvas => canvas.DrawBitmap(bitmap, 0, 0));
            }
        }

        public static ImageProcessResult Draw(ImageDrawParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var source = ResolveOperationSource(param.Image, param.Source, param.Bytes,
                param.FileByteBase64, param.Base64, param.DataUrl);
            using (var bitmap = Decode(source, new InputBudget(), out _))
            {
                var format = ResolveFormat(param.OutputFormat, param.Format);
                return Render(bitmap.Width, bitmap.Height, format, param.Quality, param.FileName,
                    param.BackgroundColor,
                    canvas =>
                    {
                        canvas.DrawBitmap(bitmap, 0, 0);
                        DrawElements(canvas, param.Elements);
                    });
            }
        }

        public static ImageProcessResult Watermark(ImageWatermarkParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var baseImage = param.BaseImage ?? param.Image;
            if (baseImage == null) throw new ArgumentException("Image/BaseImage 不能为空。", nameof(param));
            if (param.Watermark == null) throw new ArgumentException("Watermark 不能为空。", nameof(param));
            var position = NormalizeAnchor(param.Position);
            var offsetX = param.OffsetX;
            var offsetY = param.OffsetY;
            if (position.IndexOf("left", StringComparison.Ordinal) >= 0) offsetX += param.Margin;
            if (position.IndexOf("right", StringComparison.Ordinal) >= 0) offsetX -= param.Margin;
            if (position.IndexOf("top", StringComparison.Ordinal) >= 0) offsetY += param.Margin;
            if (position.IndexOf("bottom", StringComparison.Ordinal) >= 0) offsetY -= param.Margin;
            return Merge(new ImageMergeParam
            {
                Mode = "overlay",
                Format = param.Format,
                OutputFormat = param.OutputFormat,
                Quality = param.Quality,
                BackgroundColor = param.BackgroundColor,
                FileName = param.FileName,
                Images = new List<ImageLayerParam>
                {
                    CopyToLayer(baseImage),
                    new ImageLayerParam
                    {
                        Bytes = param.Watermark.Bytes,
                        Base64 = param.Watermark.Base64,
                        FileByteBase64 = param.Watermark.FileByteBase64,
                        DataUrl = param.Watermark.DataUrl,
                        Width = param.Width,
                        Height = param.Height,
                        Scale = param.Scale,
                        Anchor = position,
                        OffsetX = offsetX,
                        OffsetY = offsetY,
                        Opacity = param.Opacity,
                        Rotation = param.Rotation,
                        ZIndex = 1
                    }
                }
            });
        }

        public static ImageProcessResult CreateQRCode(ImageQrCodeParam param)
        {
            param = param ?? new ImageQrCodeParam();
            var content = string.IsNullOrWhiteSpace(param.Content) ? param.Text : param.Content;
            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("Content/Text 不能为空。", nameof(param));
            if (param.Size <= 0 || param.Size > ImageProcessingMaxDimension)
                throw new ArgumentOutOfRangeException(nameof(param), "Size 超出允许范围。");
            var format = ResolveFormat(param.OutputFormat, param.Format);
            using (var generator = new QRCodeGenerator())
            using (var qrCode = generator.CreateQrCode(content, ECCLevel.H))
            {
                return Render(param.Size, param.Size, format, param.Quality, param.FileName,
                    param.BackgroundColor,
                    canvas => canvas.Render(qrCode, param.Size, param.Size));
            }
        }

        public static ImageInfoResult GetInfo(ImageInfoParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var source = param.Image ?? param.Source ?? param;
            var bytes = ReadSourceBytes(source, new InputBudget());
            using (var data = SKData.CreateCopy(bytes))
            using (var codec = SKCodec.Create(data))
            {
                if (codec == null) throw new ArgumentException("无法识别图片格式或图片已损坏。", nameof(param));
                ValidateSource(codec.Info.Width, codec.Info.Height);
                var format = EncodedFormatName(codec.EncodedFormat);
                return new ImageInfoResult
                {
                    Width = codec.Info.Width,
                    Height = codec.Info.Height,
                    Format = format,
                    ContentType = ContentTypeFor(format),
                    Size = bytes.LongLength,
                    FrameCount = codec.FrameCount,
                    RepetitionCount = codec.RepetitionCount,
                    Origin = codec.EncodedOrigin.ToString(),
                    HasAlpha = codec.Info.AlphaType != SKAlphaType.Opaque
                };
            }
        }

        private static ImageProcessResult Render(int width, int height, string format, int quality,
            string fileName, string backgroundColor, Action<SKCanvas> draw, bool clearBeforeDraw = true)
        {
            ValidateCanvas(width, height);
            quality = Math.Max(1, Math.Min(quality, 100));
            var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
            using (var surface = SKSurface.Create(info))
            {
                if (surface == null) throw new InvalidOperationException("无法创建图片画布。");
                var canvas = surface.Canvas;
                if (clearBeforeDraw)
                    canvas.Clear(ResolveBackgroundColor(format, backgroundColor));
                draw(canvas);
                canvas.Flush();
                byte[] bytes;
                if (format == "bmp")
                {
                    using (var pixmap = surface.PeekPixels())
                    {
                        if (pixmap == null) throw new InvalidOperationException("无法读取 BMP 画布像素。");
                        bytes = EncodeBmp(pixmap, width, height);
                    }
                }
                else
                {
                    using (var image = surface.Snapshot())
                    using (var data = image.Encode(ToEncodedFormat(format), quality))
                    {
                        if (data == null) throw new InvalidOperationException($"当前运行环境不支持编码为 {format}。");
                        bytes = data.ToArray();
                    }
                }
                if (bytes.Length > ImageProcessingMaxOutputBytes)
                    throw new InvalidOperationException($"输出图片超过 {ImageProcessingMaxOutputBytes / 1024 / 1024} MB 限制。");
                var extension = ExtensionFor(format);
                var resolvedName = string.IsNullOrWhiteSpace(fileName)
                    ? $"image.{extension}"
                    : EnsureFileExtension(fileName, extension);
                return new ImageProcessResult
                {
                    Bytes = bytes,
                    Width = width,
                    Height = height,
                    Format = format,
                    ContentType = ContentTypeFor(format),
                    FileName = resolvedName,
                    Size = bytes.LongLength
                };
            }
        }

        private static byte[] EncodeBmp(SKPixmap pixmap, int width, int height)
        {
            const int fileHeaderSize = 14;
            const int dibHeaderSize = 108;
            const int pixelOffset = fileHeaderSize + dibHeaderSize;
            var rowBytes = checked(width * 4);
            var pixelBytes = checked(rowBytes * height);
            var fileBytes = checked(pixelOffset + pixelBytes);
            if (fileBytes > ImageProcessingMaxOutputBytes)
                throw new InvalidOperationException($"输出图片超过 {ImageProcessingMaxOutputBytes / 1024 / 1024} MB 限制。");

            var sourceRowBytes = checked((int)pixmap.RowBytes);
            var sourceRow = new byte[rowBytes];
            using (var stream = new MemoryStream(fileBytes))
            using (var writer = new BinaryWriter(stream, Encoding.UTF8, leaveOpen: true))
            {
                writer.Write((byte)'B');
                writer.Write((byte)'M');
                writer.Write(fileBytes);
                writer.Write(0);
                writer.Write(pixelOffset);

                writer.Write(dibHeaderSize);
                writer.Write(width);
                writer.Write(-height); // top-down，避免逐行倒序
                writer.Write((ushort)1);
                writer.Write((ushort)32);
                writer.Write(3); // BI_BITFIELDS
                writer.Write(pixelBytes);
                writer.Write(3780);
                writer.Write(3780);
                writer.Write(0);
                writer.Write(0);
                writer.Write(0x00FF0000u);
                writer.Write(0x0000FF00u);
                writer.Write(0x000000FFu);
                writer.Write(0xFF000000u);
                writer.Write(0x73524742u); // LCS_sRGB
                writer.Write(new byte[36]);
                writer.Write(0u);
                writer.Write(0u);
                writer.Write(0u);

                var pixels = pixmap.GetPixels();
                if (pixels == IntPtr.Zero) throw new InvalidOperationException("无法读取 BMP 画布像素。");
                for (var y = 0; y < height; y++)
                {
                    Marshal.Copy(IntPtr.Add(pixels, checked(y * sourceRowBytes)), sourceRow, 0, rowBytes);
                    for (var x = 0; x < width; x++)
                    {
                        var source = x * 4;
                        var alpha = sourceRow[source + 3];
                        var red = Unpremultiply(sourceRow[source], alpha);
                        var green = Unpremultiply(sourceRow[source + 1], alpha);
                        var blue = Unpremultiply(sourceRow[source + 2], alpha);
                        writer.Write(blue);
                        writer.Write(green);
                        writer.Write(red);
                        writer.Write(alpha);
                    }
                }
                writer.Flush();
                return stream.ToArray();
            }
        }

        private static byte Unpremultiply(byte value, byte alpha)
        {
            if (alpha == 0) return 0;
            if (alpha == 255) return value;
            return (byte)Math.Min(255, (value * 255 + alpha / 2) / alpha);
        }

        private static void DrawMerged(SKCanvas canvas, ImageMergeParam param, List<PreparedLayer> layers,
            string mode, int canvasWidth, int canvasHeight)
        {
            if (mode == "overlay")
            {
                foreach (var layer in layers.OrderBy(x => x.Param.ZIndex).ThenBy(x => x.OriginalIndex))
                {
                    var point = ResolveOverlayPosition(layer.Param, canvasWidth, canvasHeight,
                        layer.BoundsWidth, layer.BoundsHeight, param.Padding);
                    DrawPreparedLayer(canvas, layer, point.X, point.Y);
                }
                return;
            }

            if (mode == "grid")
            {
                var columns = Math.Max(1, Math.Min(param.Columns ?? (int)Math.Ceiling(Math.Sqrt(layers.Count)), layers.Count));
                var rows = (int)Math.Ceiling(layers.Count / (double)columns);
                var columnWidths = new float[columns];
                var rowHeights = new float[rows];
                for (var i = 0; i < layers.Count; i++)
                {
                    columnWidths[i % columns] = Math.Max(columnWidths[i % columns], layers[i].BoundsWidth);
                    rowHeights[i / columns] = Math.Max(rowHeights[i / columns], layers[i].BoundsHeight);
                }
                for (var i = 0; i < layers.Count; i++)
                {
                    var column = i % columns;
                    var row = i / columns;
                    var cellX = param.Padding + columnWidths.Take(column).Sum() + column * param.Gap;
                    var cellY = param.Padding + rowHeights.Take(row).Sum() + row * param.Gap;
                    var aligned = ResolveBoxAlignment(param.Alignment, columnWidths[column], rowHeights[row],
                        layers[i].BoundsWidth, layers[i].BoundsHeight);
                    DrawPreparedLayer(canvas, layers[i], cellX + aligned.X, cellY + aligned.Y);
                }
                return;
            }

            var cursor = (float)param.Padding;
            foreach (var layer in layers)
            {
                if (mode == "horizontal")
                {
                    var aligned = ResolveCrossAlignment(param.Alignment, canvasHeight - param.Padding * 2F,
                        layer.BoundsHeight, horizontal: true);
                    DrawPreparedLayer(canvas, layer, cursor, param.Padding + aligned);
                    cursor += layer.BoundsWidth + param.Gap;
                }
                else
                {
                    var aligned = ResolveCrossAlignment(param.Alignment, canvasWidth - param.Padding * 2F,
                        layer.BoundsWidth, horizontal: false);
                    DrawPreparedLayer(canvas, layer, param.Padding + aligned, cursor);
                    cursor += layer.BoundsHeight + param.Gap;
                }
            }
        }

        private static MergeSize CalculateMergeSize(ImageMergeParam param, List<PreparedLayer> layers, string mode)
        {
            var padding = Math.Max(0, param.Padding);
            var gap = Math.Max(0, param.Gap);
            param.Padding = padding;
            param.Gap = gap;
            int width;
            int height;
            if (mode == "horizontal")
            {
                width = (int)Math.Ceiling(layers.Sum(x => x.BoundsWidth) + gap * (layers.Count - 1) + padding * 2D);
                height = (int)Math.Ceiling(layers.Max(x => x.BoundsHeight) + padding * 2D);
            }
            else if (mode == "vertical")
            {
                width = (int)Math.Ceiling(layers.Max(x => x.BoundsWidth) + padding * 2D);
                height = (int)Math.Ceiling(layers.Sum(x => x.BoundsHeight) + gap * (layers.Count - 1) + padding * 2D);
            }
            else if (mode == "grid")
            {
                var columns = Math.Max(1, Math.Min(param.Columns ?? (int)Math.Ceiling(Math.Sqrt(layers.Count)), layers.Count));
                var rows = (int)Math.Ceiling(layers.Count / (double)columns);
                var columnWidths = new float[columns];
                var rowHeights = new float[rows];
                for (var i = 0; i < layers.Count; i++)
                {
                    columnWidths[i % columns] = Math.Max(columnWidths[i % columns], layers[i].BoundsWidth);
                    rowHeights[i / columns] = Math.Max(rowHeights[i / columns], layers[i].BoundsHeight);
                }
                width = (int)Math.Ceiling(columnWidths.Sum() + gap * (columns - 1) + padding * 2D);
                height = (int)Math.Ceiling(rowHeights.Sum() + gap * (rows - 1) + padding * 2D);
            }
            else
            {
                width = (int)Math.Ceiling(layers[0].BoundsWidth + padding * 2D);
                height = (int)Math.Ceiling(layers[0].BoundsHeight + padding * 2D);
                foreach (var layer in layers)
                {
                    if (!layer.Param.X.HasValue && !layer.Param.Y.HasValue) continue;
                    var x = (long)(layer.Param.X ?? padding) + layer.Param.OffsetX;
                    var y = (long)(layer.Param.Y ?? padding) + layer.Param.OffsetY;
                    width = Math.Max(width, (int)Math.Min(int.MaxValue,
                        Math.Ceiling(x + layer.BoundsWidth + padding)));
                    height = Math.Max(height, (int)Math.Min(int.MaxValue,
                        Math.Ceiling(y + layer.BoundsHeight + padding)));
                }
            }
            return new MergeSize(param.CanvasWidth ?? width, param.CanvasHeight ?? height);
        }

        private static PreparedLayer PrepareLayer(ImageLayerParam param, InputBudget budget, int index)
        {
            var bitmap = Decode(param, budget, out _);
            try
            {
                var sourceRect = ResolveSourceRect(param, bitmap.Width, bitmap.Height);
                var target = ResolveTargetSize(sourceRect.Width, sourceRect.Height, param.Width, param.Height,
                    param.Scale, param.Fit, out var cover);
                if (cover)
                    sourceRect = CalculateCoverSource(sourceRect, target.Width, target.Height);
                ValidateCanvas(target.Width, target.Height);
                budget.AddRenderedPixels((long)target.Width * target.Height);
                return new PreparedLayer(bitmap, param, sourceRect, target.Width, target.Height, index);
            }
            catch
            {
                bitmap.Dispose();
                throw;
            }
        }

        private static void DrawPreparedLayer(SKCanvas canvas, PreparedLayer layer, float boundsX, float boundsY)
        {
            var centerX = boundsX + layer.BoundsWidth / 2F;
            var centerY = boundsY + layer.BoundsHeight / 2F;
            using (var paint = new SKPaint
            {
                IsAntialias = true,
                FilterQuality = SKFilterQuality.High,
                Color = ApplyOpacity(SKColors.White, layer.Param.Opacity),
                BlendMode = ParseBlendMode(layer.Param.BlendMode)
            })
            {
                canvas.Save();
                canvas.Translate(centerX, centerY);
                if (Math.Abs(layer.Param.Rotation) > 0.0001D)
                    canvas.RotateDegrees((float)layer.Param.Rotation);
                canvas.Scale(layer.Param.FlipHorizontal ? -1F : 1F, layer.Param.FlipVertical ? -1F : 1F);
                var destination = new SKRect(-layer.TargetWidth / 2F, -layer.TargetHeight / 2F,
                    layer.TargetWidth / 2F, layer.TargetHeight / 2F);
                if (layer.Param.CornerRadius > 0D)
                {
                    var radius = (float)Math.Min(layer.Param.CornerRadius,
                        Math.Min(layer.TargetWidth, layer.TargetHeight) / 2D);
                    canvas.Save();
                    canvas.ClipRoundRect(new SKRoundRect(destination, radius, radius), SKClipOperation.Intersect, true);
                    canvas.DrawBitmap(layer.Bitmap, layer.SourceRect, destination, paint);
                    canvas.Restore();
                }
                else
                {
                    canvas.DrawBitmap(layer.Bitmap, layer.SourceRect, destination, paint);
                }
                if (layer.Param.BorderWidth > 0D && !string.IsNullOrWhiteSpace(layer.Param.BorderColor))
                {
                    using (var border = new SKPaint
                    {
                        IsAntialias = true,
                        Style = SKPaintStyle.Stroke,
                        StrokeWidth = (float)layer.Param.BorderWidth,
                        Color = ApplyOpacity(ParseColor(layer.Param.BorderColor), layer.Param.Opacity)
                    })
                    {
                        var radius = (float)Math.Max(0D, layer.Param.CornerRadius);
                        canvas.DrawRoundRect(destination, radius, radius, border);
                    }
                }
                canvas.Restore();
            }
        }

        private static void DrawElements(SKCanvas canvas, IList<ImageDrawElementParam> elements)
        {
            if (elements == null) return;
            if (elements.Count > 500) throw new ArgumentException("单次最多绘制 500 个元素。", nameof(elements));
            foreach (var element in elements)
            {
                if (element == null) continue;
                var type = NormalizeToken(element.Type);
                var width = (float)(element.Width ?? 0D);
                var height = (float)(element.Height ?? 0D);
                var x = (float)element.X;
                var y = (float)element.Y;
                canvas.Save();
                if (Math.Abs(element.Rotation) > 0.0001D)
                {
                    var rotationCenterX = x + width / 2F;
                    var rotationCenterY = y + height / 2F;
                    canvas.RotateDegrees((float)element.Rotation, rotationCenterX, rotationCenterY);
                }

                if (type == "text")
                {
                    DrawTextElement(canvas, element);
                    canvas.Restore();
                    continue;
                }

                var fillColor = ApplyOpacity(ParseColor(element.FillColor ?? element.Color), element.Opacity);
                using (var fill = new SKPaint { IsAntialias = true, Style = SKPaintStyle.Fill, Color = fillColor })
                using (var stroke = new SKPaint
                {
                    IsAntialias = true,
                    Style = SKPaintStyle.Stroke,
                    StrokeWidth = (float)Math.Max(0D, element.StrokeWidth),
                    Color = ApplyOpacity(ParseColor(element.StrokeColor ?? element.Color), element.Opacity)
                })
                {
                    var shouldStroke = element.StrokeWidth > 0D;
                    if (type == "rectangle" || type == "rect" || type == "round-rect")
                    {
                        var rect = new SKRect(x, y, x + width, y + height);
                        var radius = (float)Math.Max(0D, element.CornerRadius);
                        canvas.DrawRoundRect(rect, radius, radius, fill);
                        if (shouldStroke) canvas.DrawRoundRect(rect, radius, radius, stroke);
                    }
                    else if (type == "ellipse" || type == "circle")
                    {
                        var rect = new SKRect(x, y, x + width, y + height);
                        canvas.DrawOval(rect, fill);
                        if (shouldStroke) canvas.DrawOval(rect, stroke);
                    }
                    else if (type == "line")
                    {
                        var x2 = (float)(element.X2 ?? (element.X + (element.Width ?? 0D)));
                        var y2 = (float)(element.Y2 ?? (element.Y + (element.Height ?? 0D)));
                        if (!shouldStroke) stroke.StrokeWidth = 1F;
                        canvas.DrawLine(x, y, x2, y2, stroke);
                    }
                    else
                    {
                        canvas.Restore();
                        throw new ArgumentException($"不支持的绘制元素 Type：{element.Type}");
                    }
                }
                canvas.Restore();
            }
        }

        private static void DrawTextElement(SKCanvas canvas, ImageDrawElementParam element)
        {
            if (string.IsNullOrEmpty(element.Text)) return;
            var styleToken = NormalizeToken(element.FontStyle);
            var slant = styleToken.Contains("italic") ? SKFontStyleSlant.Italic : SKFontStyleSlant.Upright;
            var weight = styleToken.Contains("bold") ? SKFontStyleWeight.Bold : SKFontStyleWeight.Normal;
            var ownedTypefaces = new List<SKTypeface>();
            try
            {
                var primaryTypeface = ResolveTypeface(element.FontFamily, weight, slant);
                ownedTypefaces.Add(primaryTypeface);
                var runs = ResolveTextRuns(element.Text, element.FontFamily, weight, slant,
                    primaryTypeface, ownedTypefaces);

                using (var paint = new SKPaint
                {
                    IsAntialias = true,
                    TextSize = (float)Math.Max(1D, element.FontSize),
                    Color = ApplyOpacity(ParseColor(element.Color), element.Opacity),
                    TextAlign = SKTextAlign.Left
                })
                {
                    var totalWidth = 0F;
                    var lineAscent = 0F;
                    var lineDescent = 0F;
                    foreach (var run in runs)
                    {
                        paint.Typeface = run.Typeface;
                        run.Width = paint.MeasureText(run.Text);
                        totalWidth += run.Width;
                        var metrics = paint.FontMetrics;
                        lineAscent = Math.Min(lineAscent, metrics.Ascent);
                        lineDescent = Math.Max(lineDescent, metrics.Descent);
                    }

                    var x = (float)element.X;
                    var alignment = ParseTextAlign(element.Align);
                    if (alignment == SKTextAlign.Center)
                        x -= totalWidth / 2F;
                    else if (alignment == SKTextAlign.Right)
                        x -= totalWidth;

                    var y = (float)element.Y;
                    var vertical = NormalizeToken(element.VerticalAlign);
                    if (vertical == "middle" || vertical == "center")
                        y -= (lineAscent + lineDescent) / 2F;
                    else if (vertical == "bottom")
                        y -= lineDescent;
                    else
                        y -= lineAscent;

                    foreach (var run in runs)
                    {
                        paint.Typeface = run.Typeface;
                        canvas.DrawText(run.Text, x, y, paint);
                        x += run.Width;
                    }
                }
            }
            finally
            {
                foreach (var typeface in ownedTypefaces)
                    typeface.Dispose();
            }
        }

        private static List<TextDrawRun> ResolveTextRuns(string text, string fontFamily,
            SKFontStyleWeight weight, SKFontStyleSlant slant, SKTypeface primaryTypeface,
            List<SKTypeface> ownedTypefaces)
        {
            var runs = new List<TextDrawRun>();
            TextDrawRun currentRun = null;
            for (var index = 0; index < text.Length;)
            {
                var codepoint = char.ConvertToUtf32(text, index);
                var charLength = char.IsSurrogatePair(text, index) ? 2 : 1;
                var value = text.Substring(index, charLength);
                var typeface = FindExistingTypeface(ownedTypefaces, codepoint);
                if (typeface == null)
                {
                    typeface = MatchFallbackTypeface(fontFamily, weight, slant, codepoint);
                    if (typeface != null && !typeface.ContainsGlyph(codepoint))
                    {
                        typeface.Dispose();
                        typeface = null;
                    }

                    if (typeface != null)
                        ownedTypefaces.Add(typeface);
                }

                if (typeface == null)
                {
                    var category = CharUnicodeInfo.GetUnicodeCategory(text, index);
                    if (category == UnicodeCategory.Control || category == UnicodeCategory.Format ||
                        category == UnicodeCategory.LineSeparator || category == UnicodeCategory.ParagraphSeparator)
                    {
                        typeface = currentRun?.Typeface ?? primaryTypeface;
                    }
                    else
                    {
                        throw new InvalidOperationException(
                            $"系统字体和内置 Noto Sans CJK SC 均不包含字符“{value}”（U+{codepoint:X4}），无法绘制；" +
                            "已拒绝输出缺字方框。可通过安装包含该字符的业务字体扩展字形范围。");
                    }
                }

                if (currentRun == null || !ReferenceEquals(currentRun.Typeface, typeface))
                {
                    currentRun = new TextDrawRun(typeface);
                    runs.Add(currentRun);
                }
                currentRun.Builder.Append(value);
                index += charLength;
            }

            foreach (var run in runs)
                run.Text = run.Builder.ToString();
            return runs;
        }

        private static SKTypeface FindExistingTypeface(IEnumerable<SKTypeface> typefaces, int codepoint)
        {
            foreach (var typeface in typefaces)
                if (typeface.ContainsGlyph(codepoint))
                    return typeface;
            return null;
        }

        private static SKTypeface MatchFallbackTypeface(string fontFamily, SKFontStyleWeight weight,
            SKFontStyleSlant slant, int codepoint)
        {
            SKTypeface typeface = null;
            try
            {
                var manager = SKFontManager.Default;
                var languageTags = new[] { "zh-Hans", "zh-CN", "zh", "en" };
                var familyHint = string.IsNullOrWhiteSpace(fontFamily) ? null : fontFamily;
                typeface = manager.MatchCharacter(familyHint, weight, SKFontStyleWidth.Normal, slant,
                    languageTags, codepoint);
                if (typeface == null && familyHint != null)
                    typeface = manager.MatchCharacter(null, weight, SKFontStyleWidth.Normal, slant,
                        languageTags, codepoint);
            }
            catch
            {
                // fontconfig 在精简 Linux / NAS 环境可能不可用，继续使用程序集内置字体。
            }

            if (typeface != null && typeface.ContainsGlyph(codepoint))
                return typeface;

            typeface?.Dispose();
            typeface = CreateEmbeddedFallbackTypeface();
            if (typeface.ContainsGlyph(codepoint))
                return typeface;

            typeface.Dispose();
            return null;
        }

        private static SKTypeface CreateEmbeddedFallbackTypeface()
        {
            // FromStream 会接管流的所有权；每次绘制创建独立 typeface，随后由调用方释放，
            // 字体原始字节只在托管内存中缓存一份，避免并发共享可释放的 Skia 句柄。
            var stream = new MemoryStream(EmbeddedFallbackFontBytes.Value, false);
            var typeface = SKTypeface.FromStream(stream);
            if (typeface == null)
                throw new InvalidOperationException("内置 Noto Sans CJK SC 字体资源无效，无法绘制文字。");
            return typeface;
        }

        private static byte[] LoadEmbeddedFallbackFontBytes()
        {
            var assembly = typeof(ImageHelper).Assembly;
            using (var stream = assembly.GetManifestResourceStream(EmbeddedFallbackFontResource))
            {
                if (stream == null)
                    throw new InvalidOperationException(
                        $"缺少内置字体资源 {EmbeddedFallbackFontResource}，请重新发布完整程序集。");
                using (var buffer = new MemoryStream())
                {
                    stream.CopyTo(buffer);
                    return buffer.ToArray();
                }
            }
        }

        private sealed class TextDrawRun
        {
            public TextDrawRun(SKTypeface typeface)
            {
                Typeface = typeface;
            }

            public SKTypeface Typeface { get; }
            public StringBuilder Builder { get; } = new StringBuilder();
            public string Text { get; set; }
            public float Width { get; set; }
        }

        private static SKTypeface ResolveTypeface(string fontFamily, SKFontStyleWeight weight,
            SKFontStyleSlant slant)
        {
            var typeface = string.IsNullOrWhiteSpace(fontFamily)
                ? SKTypeface.Default
                : SKTypeface.FromFamilyName(fontFamily, weight, SKFontStyleWidth.Normal, slant);
            return typeface ?? CreateEmbeddedFallbackTypeface();
        }

        private static void DrawCreateBackground(SKCanvas canvas, int width, int height, string start,
            string end, string direction, string format)
        {
            var startColor = string.IsNullOrWhiteSpace(start) ? ResolveBackgroundColor(format, start) : ParseColor(start);
            if (string.IsNullOrWhiteSpace(end))
            {
                canvas.Clear(startColor);
                return;
            }
            var endColor = ParseColor(end);
            var token = NormalizeToken(direction);
            SKPoint from;
            SKPoint to;
            if (token == "top-to-bottom" || token == "vertical" || token == "down")
            {
                from = new SKPoint(0, 0);
                to = new SKPoint(0, height);
            }
            else if (token == "diagonal" || token == "top-left-to-bottom-right")
            {
                from = new SKPoint(0, 0);
                to = new SKPoint(width, height);
            }
            else
            {
                from = new SKPoint(0, 0);
                to = new SKPoint(width, 0);
            }
            using (var shader = SKShader.CreateLinearGradient(from, to,
                new[] { startColor, endColor }, null, SKShaderTileMode.Clamp))
            using (var paint = new SKPaint { Shader = shader })
            {
                canvas.DrawRect(new SKRect(0, 0, width, height), paint);
            }
        }

        private static SKBitmap Decode(ImageSourceParam source, InputBudget budget, out byte[] bytes)
        {
            bytes = ReadSourceBytes(source, budget);
            using (var data = SKData.CreateCopy(bytes))
            using (var codec = SKCodec.Create(data))
            {
                if (codec == null) throw new ArgumentException("无法识别图片格式或图片已损坏。");
                ValidateSource(codec.Info.Width, codec.Info.Height);
                budget.AddPixels((long)codec.Info.Width * codec.Info.Height);
                var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
                var bitmap = new SKBitmap(info);
                var result = codec.GetPixels(info, bitmap.GetPixels());
                if (result != SKCodecResult.Success && result != SKCodecResult.IncompleteInput)
                {
                    bitmap.Dispose();
                    throw new ArgumentException($"图片解码失败：{result}。");
                }
                return bitmap;
            }
        }

        private static byte[] ReadSourceBytes(ImageSourceParam source, InputBudget budget)
        {
            if (source == null) throw new ArgumentNullException(nameof(source), "图片来源不能为空。");
            byte[] bytes;
            if (source.Bytes != null && source.Bytes.Length > 0)
            {
                bytes = source.Bytes;
            }
            else
            {
                var value = FirstNonEmpty(source.FileByteBase64, source.Base64, source.DataUrl);
                if (string.IsNullOrWhiteSpace(value))
                    throw new ArgumentException("图片必须提供 Bytes、FileByteBase64、Base64 或 DataUrl。", nameof(source));
                var commaIndex = value.IndexOf(',');
                if (value.TrimStart().StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    if (commaIndex < 0) throw new ArgumentException("DataUrl 格式不正确。", nameof(source));
                    value = value.Substring(commaIndex + 1);
                }
                var maxEncodedChars = ((long)ImageProcessingMaxInputBytesPerImage + 2L) / 3L * 4L;
                if (value.Length > maxEncodedChars + 1024L * 1024L)
                    throw new ArgumentException(
                        $"单张图片不能超过 {ImageProcessingMaxInputBytesPerImage / 1024 / 1024} MB。", nameof(source));
                var clean = RemoveWhitespace(value);
                var estimated = clean.Length * 3L / 4L;
                if (estimated > ImageProcessingMaxInputBytesPerImage)
                    throw new ArgumentException($"单张图片不能超过 {ImageProcessingMaxInputBytesPerImage / 1024 / 1024} MB。", nameof(source));
                try
                {
                    bytes = System.Convert.FromBase64String(clean);
                }
                catch (FormatException)
                {
                    throw new ArgumentException("图片 Base64 格式不正确。", nameof(source));
                }
            }
            if (bytes.Length == 0) throw new ArgumentException("图片内容为空。", nameof(source));
            if (bytes.Length > ImageProcessingMaxInputBytesPerImage)
                throw new ArgumentException($"单张图片不能超过 {ImageProcessingMaxInputBytesPerImage / 1024 / 1024} MB。", nameof(source));
            budget.Add(bytes.LongLength);
            return bytes;
        }

        private static ImageSourceParam ResolveOperationSource(ImageSourceParam image, ImageSourceParam source,
            byte[] bytes, string fileByteBase64, string base64, string dataUrl)
        {
            return image ?? source ?? new ImageSourceParam
            {
                Bytes = bytes,
                FileByteBase64 = fileByteBase64,
                Base64 = base64,
                DataUrl = dataUrl
            };
        }

        private static ImageLayerParam CopyToLayer(ImageSourceParam source)
        {
            if (source == null) return null;
            return new ImageLayerParam
            {
                Bytes = source.Bytes,
                FileByteBase64 = source.FileByteBase64,
                Base64 = source.Base64,
                DataUrl = source.DataUrl,
                FileName = source.FileName
            };
        }

        private static SKRect ResolveSourceRect(ImageLayerParam param, int width, int height)
        {
            var x = param.CropX ?? 0;
            var y = param.CropY ?? 0;
            var cropWidth = param.CropWidth ?? (width - x);
            var cropHeight = param.CropHeight ?? (height - y);
            if (x < 0 || y < 0 || cropWidth <= 0 || cropHeight <= 0 || x + cropWidth > width || y + cropHeight > height)
                throw new ArgumentException("图层 CropX/CropY/CropWidth/CropHeight 超出原图范围。", nameof(param));
            return new SKRect(x, y, x + cropWidth, y + cropHeight);
        }

        private static TargetSize ResolveTargetSize(float sourceWidth, float sourceHeight, int? width, int? height,
            double? scale, string fit, out bool cover)
        {
            cover = false;
            double targetWidth;
            double targetHeight;
            var fitToken = NormalizeToken(fit);
            if (width.HasValue && height.HasValue)
            {
                if (fitToken == "fill" || fitToken == "stretch")
                {
                    targetWidth = width.Value;
                    targetHeight = height.Value;
                }
                else if (fitToken == "cover")
                {
                    targetWidth = width.Value;
                    targetHeight = height.Value;
                    cover = true;
                }
                else if (fitToken == "none")
                {
                    targetWidth = sourceWidth;
                    targetHeight = sourceHeight;
                }
                else
                {
                    var ratio = Math.Min(width.Value / sourceWidth, height.Value / sourceHeight);
                    targetWidth = sourceWidth * ratio;
                    targetHeight = sourceHeight * ratio;
                }
            }
            else if (width.HasValue)
            {
                targetWidth = width.Value;
                targetHeight = sourceHeight * width.Value / sourceWidth;
            }
            else if (height.HasValue)
            {
                targetHeight = height.Value;
                targetWidth = sourceWidth * height.Value / sourceHeight;
            }
            else
            {
                targetWidth = sourceWidth;
                targetHeight = sourceHeight;
            }
            var resolvedScale = scale ?? 1D;
            if (resolvedScale <= 0D || resolvedScale > 100D)
                throw new ArgumentOutOfRangeException(nameof(scale), "Scale 必须大于 0 且不超过 100。");
            targetWidth *= resolvedScale;
            targetHeight *= resolvedScale;
            var finalWidth = Math.Max(1, (int)Math.Round(targetWidth));
            var finalHeight = Math.Max(1, (int)Math.Round(targetHeight));
            return new TargetSize(finalWidth, finalHeight);
        }

        private static SKRect CalculateCoverSource(SKRect source, int targetWidth, int targetHeight)
        {
            var sourceRatio = source.Width / source.Height;
            var targetRatio = targetWidth / (float)targetHeight;
            if (sourceRatio > targetRatio)
            {
                var width = source.Height * targetRatio;
                var x = source.Left + (source.Width - width) / 2F;
                return new SKRect(x, source.Top, x + width, source.Bottom);
            }
            var height = source.Width / targetRatio;
            var y = source.Top + (source.Height - height) / 2F;
            return new SKRect(source.Left, y, source.Right, y + height);
        }

        private static BoxPoint ResolveOverlayPosition(ImageLayerParam param, int canvasWidth, int canvasHeight,
            float width, float height, int padding)
        {
            if (param.X.HasValue || param.Y.HasValue)
                return new BoxPoint((param.X ?? padding) + param.OffsetX, (param.Y ?? padding) + param.OffsetY);
            var anchor = NormalizeAnchor(param.Position ?? param.Anchor);
            float x;
            float y;
            if (anchor.Contains("right")) x = canvasWidth - padding - width;
            else if (anchor == "top" || anchor == "bottom" || anchor == "center" || anchor == "middle")
                x = (canvasWidth - width) / 2F;
            else x = padding;
            if (anchor.Contains("bottom")) y = canvasHeight - padding - height;
            else if (anchor == "left" || anchor == "right" || anchor == "center" || anchor == "middle")
                y = (canvasHeight - height) / 2F;
            else y = padding;
            return new BoxPoint(x + param.OffsetX, y + param.OffsetY);
        }

        private static BoxPoint ResolveBoxAlignment(string alignment, float boxWidth, float boxHeight,
            float width, float height)
        {
            var token = NormalizeAnchor(alignment);
            var x = token.Contains("right") ? boxWidth - width :
                token.Contains("left") ? 0F : (boxWidth - width) / 2F;
            var y = token.Contains("bottom") ? boxHeight - height :
                token.Contains("top") ? 0F : (boxHeight - height) / 2F;
            return new BoxPoint(x, y);
        }

        private static float ResolveCrossAlignment(string alignment, float available, float size, bool horizontal)
        {
            var token = NormalizeToken(alignment);
            if ((horizontal && (token == "bottom" || token == "end")) ||
                (!horizontal && (token == "right" || token == "end")))
                return available - size;
            if ((horizontal && token == "top") || (!horizontal && token == "left") || token == "start")
                return 0F;
            return (available - size) / 2F;
        }

        private static string NormalizeMode(string layout, string mode, out string impliedDirection)
        {
            var token = NormalizeToken(string.IsNullOrWhiteSpace(layout) ? mode : layout);
            impliedDirection = null;
            switch (token)
            {
                case "left": impliedDirection = "rtl"; return "horizontal";
                case "right": impliedDirection = "ltr"; return "horizontal";
                case "top":
                case "up": impliedDirection = "btt"; return "vertical";
                case "bottom":
                case "down": impliedDirection = "ttb"; return "vertical";
                case "row": return "horizontal";
                case "column": return "vertical";
                case "canvas":
                case "cover": return "overlay";
                case "horizontal":
                case "vertical":
                case "overlay":
                case "grid": return token;
                default: throw new ArgumentException($"不支持的合并 Mode/Layout：{layout ?? mode}");
            }
        }

        private static string NormalizeDirection(string direction, string implied, string mode)
        {
            var token = NormalizeToken(string.IsNullOrWhiteSpace(direction) ? implied : direction);
            if (string.IsNullOrEmpty(token)) return mode == "vertical" ? "ttb" : "ltr";
            switch (token)
            {
                case "left-to-right":
                case "ltr":
                case "right": return "ltr";
                case "right-to-left":
                case "rtl":
                case "left": return "rtl";
                case "top-to-bottom":
                case "ttb":
                case "down": return "ttb";
                case "bottom-to-top":
                case "btt":
                case "up": return "btt";
                default: throw new ArgumentException($"不支持的 Direction：{direction}");
            }
        }

        private static string NormalizeAnchor(string value)
        {
            var token = NormalizeToken(value);
            if (string.IsNullOrEmpty(token)) return "top-left";
            token = token.Replace("left-top", "top-left").Replace("right-top", "top-right")
                .Replace("left-bottom", "bottom-left").Replace("right-bottom", "bottom-right")
                .Replace("centre", "center");
            return token;
        }

        private static string NormalizeToken(string value)
        {
            return (value ?? string.Empty).Trim().ToLowerInvariant().Replace('_', '-').Replace(' ', '-');
        }

        private static string ResolveFormat(string outputFormat, string format)
        {
            var token = NormalizeToken(string.IsNullOrWhiteSpace(outputFormat) ? format : outputFormat)
                .TrimStart('.');
            if (token == "jpg") token = "jpeg";
            if (token != "png" && token != "jpeg" && token != "webp" && token != "bmp")
                throw new ArgumentException($"不支持的输出格式：{token}。支持 png、jpeg/jpg、webp、bmp。");
            return token;
        }

        private static SKEncodedImageFormat ToEncodedFormat(string format)
        {
            switch (format)
            {
                case "jpeg": return SKEncodedImageFormat.Jpeg;
                case "webp": return SKEncodedImageFormat.Webp;
                default: return SKEncodedImageFormat.Png;
            }
        }

        private static string EncodedFormatName(SKEncodedImageFormat format)
        {
            switch (format)
            {
                case SKEncodedImageFormat.Png: return "png";
                case SKEncodedImageFormat.Jpeg: return "jpeg";
                case SKEncodedImageFormat.Webp: return "webp";
                case SKEncodedImageFormat.Bmp: return "bmp";
                case SKEncodedImageFormat.Gif: return "gif";
                case SKEncodedImageFormat.Ico: return "ico";
                case SKEncodedImageFormat.Wbmp: return "wbmp";
                default: return format.ToString().ToLowerInvariant();
            }
        }

        private static string ContentTypeFor(string format)
        {
            switch (format)
            {
                case "jpeg": return "image/jpeg";
                case "webp": return "image/webp";
                case "bmp": return "image/bmp";
                case "gif": return "image/gif";
                case "ico": return "image/x-icon";
                case "png": return "image/png";
                case "heif": return "image/heif";
                case "wbmp": return "image/vnd.wap.wbmp";
                default: return "application/octet-stream";
            }
        }

        private static string ExtensionFor(string format) => format == "jpeg" ? "jpg" : format;

        private static string EnsureFileExtension(string fileName, string extension)
        {
            var safeName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeName)) return $"image.{extension}";
            return string.Equals(Path.GetExtension(safeName), "." + extension, StringComparison.OrdinalIgnoreCase)
                ? safeName
                : Path.GetFileNameWithoutExtension(safeName) + "." + extension;
        }

        private static SKColor ResolveBackgroundColor(string format, string color)
        {
            if (string.IsNullOrWhiteSpace(color)) return format == "jpeg" ? SKColors.White : SKColors.Transparent;
            var parsed = ParseColor(color);
            if (format == "jpeg" && parsed.Alpha < 255)
                return new SKColor(parsed.Red, parsed.Green, parsed.Blue, 255);
            return parsed;
        }

        private static SKColor ParseColor(string value)
        {
            var text = (value ?? "transparent").Trim().ToLowerInvariant();
            switch (text)
            {
                case "transparent": return SKColors.Transparent;
                case "white": return SKColors.White;
                case "black": return SKColors.Black;
                case "red": return SKColors.Red;
                case "green": return SKColors.Green;
                case "blue": return SKColors.Blue;
                case "yellow": return SKColors.Yellow;
                case "gray":
                case "grey": return SKColors.Gray;
                case "orange": return SKColors.Orange;
                case "purple": return SKColors.Purple;
            }
            if (text.StartsWith("#", StringComparison.Ordinal))
            {
                var hex = text.Substring(1);
                if (hex.Length == 3 || hex.Length == 4)
                    hex = string.Concat(hex.Select(c => new string(c, 2)));
                if ((hex.Length == 6 || hex.Length == 8) && uint.TryParse(hex, NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture, out var rgba))
                {
                    if (hex.Length == 6)
                        return new SKColor((byte)(rgba >> 16), (byte)(rgba >> 8), (byte)rgba, 255);
                    return new SKColor((byte)(rgba >> 24), (byte)(rgba >> 16), (byte)(rgba >> 8), (byte)rgba);
                }
            }
            if ((text.StartsWith("rgb(", StringComparison.Ordinal) || text.StartsWith("rgba(", StringComparison.Ordinal))
                && text.EndsWith(")", StringComparison.Ordinal))
            {
                var values = text.Substring(text.IndexOf('(') + 1).TrimEnd(')').Split(',');
                if ((values.Length == 3 || values.Length == 4) &&
                    byte.TryParse(values[0].Trim(), out var r) && byte.TryParse(values[1].Trim(), out var g) &&
                    byte.TryParse(values[2].Trim(), out var b))
                {
                    var a = (byte)255;
                    if (values.Length == 4 && double.TryParse(values[3].Trim(), NumberStyles.Float,
                        CultureInfo.InvariantCulture, out var alpha))
                        a = alpha <= 1D ? ToAlpha(alpha) : (byte)Math.Max(0D, Math.Min(255D, alpha));
                    return new SKColor(r, g, b, a);
                }
            }
            throw new ArgumentException($"无法识别颜色：{value}");
        }

        private static SKBlendMode ParseBlendMode(string value)
        {
            switch (NormalizeToken(value))
            {
                case "multiply": return SKBlendMode.Multiply;
                case "screen": return SKBlendMode.Screen;
                case "overlay": return SKBlendMode.Overlay;
                case "darken": return SKBlendMode.Darken;
                case "lighten": return SKBlendMode.Lighten;
                case "plus":
                case "add": return SKBlendMode.Plus;
                case "src": return SKBlendMode.Src;
                case "dst-over": return SKBlendMode.DstOver;
                default: return SKBlendMode.SrcOver;
            }
        }

        private static SKTextAlign ParseTextAlign(string value)
        {
            switch (NormalizeToken(value))
            {
                case "center":
                case "middle": return SKTextAlign.Center;
                case "right":
                case "end": return SKTextAlign.Right;
                default: return SKTextAlign.Left;
            }
        }

        private static byte ToAlpha(double opacity)
        {
            return (byte)Math.Round(Math.Max(0D, Math.Min(1D, opacity)) * 255D);
        }

        private static int GreatestCommonDivisor(int left, int right)
        {
            left = Math.Abs(left);
            right = Math.Abs(right);
            while (right != 0)
            {
                var remainder = left % right;
                left = right;
                right = remainder;
            }
            return Math.Max(1, left);
        }

        private static SKColor ApplyOpacity(SKColor color, double opacity)
        {
            var multiplier = Math.Max(0D, Math.Min(1D, opacity));
            return color.WithAlpha((byte)Math.Round(color.Alpha * multiplier));
        }

        private static string FirstNonEmpty(params string[] values)
        {
            return values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        }

        private static string RemoveWhitespace(string value)
        {
            if (value.All(c => !char.IsWhiteSpace(c))) return value;
            var builder = new StringBuilder(value.Length);
            foreach (var c in value)
                if (!char.IsWhiteSpace(c)) builder.Append(c);
            return builder.ToString();
        }

        private static void ValidateSource(int width, int height)
        {
            if (width <= 0 || height <= 0 || width > ImageProcessingMaxDimension || height > ImageProcessingMaxDimension)
                throw new ArgumentOutOfRangeException(nameof(width),
                    $"输入图片单边不能超过 {ImageProcessingMaxDimension} 像素。");
            if ((long)width * height > ImageProcessingMaxPixels)
                throw new ArgumentOutOfRangeException(nameof(width),
                    $"输入图片不能超过 {ImageProcessingMaxPixels:N0} 像素。");
        }

        private static void ValidateCanvas(int width, int height)
        {
            if (width <= 0 || height <= 0 || width > ImageProcessingMaxDimension || height > ImageProcessingMaxDimension)
                throw new ArgumentOutOfRangeException(nameof(width),
                    $"输出画布单边必须在 1 到 {ImageProcessingMaxDimension} 像素之间。");
            if ((long)width * height > ImageProcessingMaxPixels)
                throw new ArgumentOutOfRangeException(nameof(width),
                    $"输出画布不能超过 {ImageProcessingMaxPixels:N0} 像素。");
        }

        private sealed class InputBudget
        {
            private long _total;
            private long _pixels;
            private long _renderedPixels;
            public void Add(long bytes)
            {
                _total += bytes;
                if (_total > ImageProcessingMaxTotalInputBytes)
                    throw new ArgumentException($"单次图片输入总量不能超过 {ImageProcessingMaxTotalInputBytes / 1024 / 1024} MB。");
            }

            public void AddPixels(long pixels)
            {
                _pixels += pixels;
                if (_pixels > ImageProcessingMaxTotalPixels)
                    throw new ArgumentException($"单次解码图片总量不能超过 {ImageProcessingMaxTotalPixels:N0} 像素。");
            }

            public void AddRenderedPixels(long pixels)
            {
                _renderedPixels += pixels;
                if (_renderedPixels > ImageProcessingMaxRenderedPixels)
                    throw new ArgumentException($"单次缩放后图层总量不能超过 {ImageProcessingMaxRenderedPixels:N0} 像素。");
            }
        }

        private sealed class PreparedLayer : IDisposable
        {
            public PreparedLayer(SKBitmap bitmap, ImageLayerParam param, SKRect sourceRect,
                int targetWidth, int targetHeight, int originalIndex)
            {
                Bitmap = bitmap;
                Param = param;
                SourceRect = sourceRect;
                OriginalIndex = originalIndex;
                ResetTarget(targetWidth, targetHeight);
            }

            public SKBitmap Bitmap { get; }
            public ImageLayerParam Param { get; }
            public SKRect SourceRect { get; private set; }
            public int TargetWidth { get; private set; }
            public int TargetHeight { get; private set; }
            public float BoundsWidth { get; private set; }
            public float BoundsHeight { get; private set; }
            public int OriginalIndex { get; }

            public void ResetTarget(int width, int height)
            {
                TargetWidth = Math.Max(1, width);
                TargetHeight = Math.Max(1, height);
                var radians = Math.Abs(Param.Rotation % 360D) * Math.PI / 180D;
                BoundsWidth = (float)(Math.Abs(TargetWidth * Math.Cos(radians)) + Math.Abs(TargetHeight * Math.Sin(radians)));
                BoundsHeight = (float)(Math.Abs(TargetWidth * Math.Sin(radians)) + Math.Abs(TargetHeight * Math.Cos(radians)));
            }

            public void Dispose() => Bitmap.Dispose();
        }

        private readonly struct TargetSize
        {
            public TargetSize(int width, int height) { Width = width; Height = height; }
            public int Width { get; }
            public int Height { get; }
        }

        private readonly struct MergeSize
        {
            public MergeSize(int width, int height) { Width = width; Height = height; }
            public int Width { get; }
            public int Height { get; }
        }

        private readonly struct BoxPoint
        {
            public BoxPoint(float x, float y) { X = x; Y = y; }
            public float X { get; }
            public float Y { get; }
        }
    }
}
