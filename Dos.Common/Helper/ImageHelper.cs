#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：ImageHelper
* Copyright(c) www.iTdos.com
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2010/04/01 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using SkiaSharp;
using SkiaSharp.QrCode;

namespace Dos.Common
{
    /// <summary>
    /// ImageHelper参数类
    /// </summary>
    public class ImageParam
    {
        public string FileSuffix { get; set; }
        /// <summary>
        /// 最大体积，单位kb
        /// </summary>
        public int? MaxLength { get; set; }

        private int _nearlyLength = 20;
        /// <summary>
        /// 允许误差，单位kb，默认20kb。只有当设置了MaxLength参数时，此参数才生效。
        /// </summary>
        public int NearlyLength
        {
            get
            {
                return _nearlyLength;
            }
            set
            {
                this._nearlyLength = value;
            }
        }
        /// <summary>
        /// 水印图离原图边界的距离
        /// </summary>
        public int? WaterPadding { get; set; }
        /// <summary>
        /// 最大宽度
        /// </summary>
        public int? MaxWidth { get; set; }
        /// <summary>
        /// 最大高度
        /// </summary>
        public int? MaxHeight { get; set; }
        /// <summary>
        /// 图片文件
        /// </summary>
        public Stream Image { get; set; }
        /// <summary>
        /// 水印图片文件
        /// </summary>
        public Stream WaterImage { get; set; }
        /// <summary>
        /// 生成缩略图的模式：WH：指定宽高缩放（可能变形）、W：指定宽，高按比例，MaxHeight参数失效、H：指定高，宽按比例，MaxWidth参数失效、CUT：指定高宽裁减。
        /// </summary>
        public EnumHelper.ImageMode? Mode { get; set; }
        /// <summary>
        /// 加图片水印的位置，TopLeft-左上角 TopCenter-上中间 TopRight-右上角 BottomLeft-左下角 BottomCenter-下中间 右下角-右下角 Middle-正中间。
        /// </summary>
        public EnumHelper.ImageWaterPosition? ImageWaterPosition { get; set; }
    }

    /// <summary>
    /// 图片水印处理类
    /// </summary>
    public class ImageHelper
    {
        public static class ContentType
        {
            public static string TextHtml { get { return "text/html"; } }
            public static string TextPlain { get { return "text/plain"; } }
            public static string TextXml { get { return "text/xml"; } }
            public static string ImageGif { get { return "image/gif"; } }
            public static string ImageJpeg { get { return "image/jpeg"; } }
            public static string ImagePng { get { return "image/png"; } }
            public static string ApplicationXml { get { return "application/xml"; } }
            public static string ApplicationJson { get { return "application/json"; } }
            public static string ApplicationPdf { get { return "application/pdf"; } }
            public static string ApplicationMsWord { get { return "application/msword"; } }
            public static string ApplicationOctetStream { get { return "application/octet-stream"; } }
        }
        /// <summary>
        /// 生成二维码图片
        /// </summary>
        public static Stream CreateQRCode(string qrCodeContent)
        {
            using (var generator = new QRCodeGenerator())
            {
                // 创建二维码（并设置纠错能力最高级）
                var createQrCode = generator.CreateQrCode(qrCodeContent, ECCLevel.H);

                // 计算二维码模块的数量  
                //int qrCodeWidth = createQrCode.

                var skImageInfo = new SKImageInfo(300, 300);
                // 创建SkiaSharp画布
                using (var surface = SKSurface.Create(skImageInfo))
                {
                    var canvas = surface.Canvas;
                    // 渲染二维码到画布
                    canvas.Render(createQrCode, skImageInfo.Width, skImageInfo.Height);

                    using (var image = surface.Snapshot())
                    // 编码画布快照为PNG格式的数据
                    using (var data = image.Encode(SKEncodedImageFormat.Png, 100))
                    {
                       return data.AsStream();
                    }
                    //using (var stream = File.OpenWrite(@"MyQRCode.png"))
                    //{
                    //    data.SaveTo(stream);// 将数据保存到文件流中，生成二维码图片
                    //}
                }
            }
        }


        /// <summary>
        /// 获取图片格式。
        /// </summary>
        /// <Param name="fileName">文件名</Param>
        /// <returns></returns>
        public static ImageFormat GetImageFormat(string fileName)
        {
            string extension = fileName.Substring(fileName.LastIndexOf(".")).Trim().ToLower();

            switch (extension)
            {
                case ".jpg":
                    return System.Drawing.Imaging.ImageFormat.Jpeg;
                case ".jpeg":
                    return System.Drawing.Imaging.ImageFormat.Jpeg;
                case ".gif":
                    return System.Drawing.Imaging.ImageFormat.Gif;
                case ".png":
                    return System.Drawing.Imaging.ImageFormat.Png;
                case ".bmp":
                    return System.Drawing.Imaging.ImageFormat.Bmp;
                case ".ico":
                    return System.Drawing.Imaging.ImageFormat.Icon;
                default:
                    goto case ".jpg";
            }
        }

        /// <summary>
        /// 加水印图片并保存。
        /// </summary>  
        public static Stream MakeWaterImage(ImageParam param)//MemoryStream
        {
            Stream originalImageStream = param.Image;
            int edge = param.WaterPadding ?? 10;
            EnumHelper.ImageWaterPosition position = param.ImageWaterPosition.Value;
            bool success = false;

            int x = 0;
            int y = 0;
            Image waterImage = null;
            Image image = null;
            Bitmap bitmap = null;
            Graphics graphics = null;

            //加载原图
            image = Image.FromStream(originalImageStream);
            //加载水印图
            waterImage = new Bitmap(param.WaterImage);
            bitmap = new Bitmap(image);
            graphics = Graphics.FromImage(bitmap);

            int newEdge = edge;
            if (newEdge >= image.Width + waterImage.Width) newEdge = 10;

            switch (position)
            {
                case EnumHelper.ImageWaterPosition.LeftTop:
                    x = newEdge;
                    y = newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.CenterTop:
                    x = (image.Width - waterImage.Width) / 2;
                    y = newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.RightTop:
                    x = image.Width - waterImage.Width - newEdge;
                    y = newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.LeftBottom:
                    x = newEdge;
                    y = image.Height - waterImage.Height - newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.CenterBottom:
                    x = (image.Width - waterImage.Width) / 2;
                    y = image.Height - waterImage.Height - newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.RightBottom:
                    x = image.Width - waterImage.Width - newEdge;
                    y = image.Height - waterImage.Height - newEdge;
                    break;
                case EnumHelper.ImageWaterPosition.Middle:
                    x = (image.Width - waterImage.Width) / 2;
                    y = (image.Height - waterImage.Height) / 2;
                    break;
                default:
                    goto case EnumHelper.ImageWaterPosition.RightBottom;
            }

            // 画水印图片
            graphics.DrawImage(waterImage, new Rectangle(x, y, waterImage.Width, waterImage.Height), 0, 0, waterImage.Width, waterImage.Height, GraphicsUnit.Pixel);

            // 关闭打开着的文件并保存（覆盖）新图片
            originalImageStream.Close();
            //var ms = new MemoryStream();
            var ms = param.Image;
            ms.Position = 0;//非常重要
            bitmap.Save(ms, image.RawFormat);
            ms.Position = 0;//非常重要
            return ms;
        }

        /// <summary>
        /// 实测垃圾算法，还不如我2010年写的
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public static Stream MakeThumbnailV2(ImageParam param)//string inputFilePath, string outputFilePath, int targetSizeInKB
        {
            var targetSizeInKB = param.MaxLength;

            //var inputStream = param.Image;//这将导致postion不为0，下次访问流报错

            var format = GetImageFormatFromFileName(param.FileSuffix);

            // 计算原始图像的质量
            var originalSize = GetStreamSizeInKB(param.Image);

            param.Image.Seek(0, SeekOrigin.Begin);

            // 加载图像
            using (var originalBitmap = SKBitmap.Decode(param.Image))
            {
                
                var originalQuality = 100;

                // 逐步降低质量，直到达到目标大小
                var compressedBitmap = originalBitmap;
                var compressedSize = originalSize;
                while (compressedSize > targetSizeInKB && originalQuality > 0)
                {
                    // 减小质量
                    originalQuality -= 5;

                    // 压缩图像
                    using (var outputStream = new MemoryStream())
                    {
                        var encodedData = compressedBitmap.Encode(format, originalQuality);
                        encodedData.SaveTo(outputStream);
                        outputStream.Seek(0, SeekOrigin.Begin);
                        compressedBitmap = SKBitmap.Decode(outputStream);
                    }

                    // 计算压缩后的文件大小
                    using (var compressedStream = new MemoryStream())
                    {
                        var encodedData = compressedBitmap.Encode(format, originalQuality);
                        encodedData.SaveTo(compressedStream);
                        compressedSize = GetStreamSizeInKB(compressedStream);
                    }
                }

                // 将压缩后的图像转换为流
                var compressedImageStream = new MemoryStream();
                var finalEncodedData = compressedBitmap.Encode(format, originalQuality);
                finalEncodedData.SaveTo(compressedImageStream);
                compressedImageStream.Seek(0, SeekOrigin.Begin);
                return compressedImageStream;
            }
        }
        public static int GetStreamSizeInKB(Stream stream)
        {
            if (stream.CanSeek)
            {
                long originalPosition = stream.Position;
                stream.Seek(0, SeekOrigin.End);
                long sizeInBytes = stream.Position;
                stream.Seek(originalPosition, SeekOrigin.Begin);
                return (int)(sizeInBytes / 1024);
            }
            else
            {
                using (var memoryStream = new MemoryStream())
                {
                    stream.CopyTo(memoryStream);
                    return (int)(memoryStream.Length / 1024);
                }
            }
        }
        public static SKEncodedImageFormat GetImageFormatFromFileName(string fileName)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            switch (extension)
            {
                case ".jpg":
                case ".jpeg":
                    return SKEncodedImageFormat.Jpeg;
                case ".png":
                    return SKEncodedImageFormat.Png;
                case ".gif":
                    return SKEncodedImageFormat.Gif;
                case ".bmp":
                    return SKEncodedImageFormat.Bmp;
                case ".webp":
                    return SKEncodedImageFormat.Webp;
                case ".ico":
                    return SKEncodedImageFormat.Ico;
                default:
                    return SKEncodedImageFormat.Jpeg;
            }
        }
        /// <summary>
        /// 生成缩略图。必传：Image。 可传：Mode、MaxLength、MaxWidth、MaxHeight、NearlyLength
        /// </summary>
        public static Stream MakeThumbnail(ImageParam param)
        {
            Stream ms = param.Image;
            if (param.MaxLength != null && param.Image != null && param.MaxLength + (param.NearlyLength * 1024) >= param.Image.Length)
            {
                //2023-11-30
                ms.Position = 0;//非常重要
                //----END
                return ms;// StreamHelper.StreamToMemoryStream(param.Image);
            }
            if (param.Mode != null)
            {
                Stream originalImageStream = param.Image;
                int maxWidth = param.MaxWidth ?? 0;
                int maxheight = param.MaxHeight ?? 0;
                EnumHelper.ImageMode mode = param.Mode.Value;
                bool success = false;

                int x = 0;
                int y = 0;
                int toW = maxWidth;
                int toH = maxheight;
                Image image = null;
                Image bitmap = null;
                Graphics graphics = null;
                //System.Drawing.Image
                image = Image.FromStream(originalImageStream);
                int w = image.Width;
                int h = image.Height;

                //定义是否跳过更改分辨率这步。
                var needChange = true;

                switch (mode)
                {
                    case EnumHelper.ImageMode.WH:
                        break;
                    case EnumHelper.ImageMode.W:
                        if (w <= maxWidth)
                        {
                            toW = w;
                            toH = h;
                            needChange = false;
                        }
                        else
                        {
                            toH = h * maxWidth / w;
                        }
                        break;
                    case EnumHelper.ImageMode.H:
                        if (h <= maxheight)
                        {
                            toW = w;
                            toH = h;
                            needChange = false;
                        }
                        else
                        {
                            toW = w * maxheight / h;
                        }
                        break;
                    case EnumHelper.ImageMode.CUT:
                        if (((double)w / (double)h) > ((double)toW / (double)toH))
                        {
                            w = h * toW / toH;
                            y = 0;
                            x = (image.Width - w) / 2;
                        }
                        else
                        {
                            h = w * toH / toW;
                            x = 0;
                            y = (image.Height - h) / 2;
                        }
                        break;
                    default:
                        goto case EnumHelper.ImageMode.CUT;
                }
                //是否跳过更改分辨率这步。
                if (needChange)
                {
                    bitmap = new Bitmap(toW, toH);
                    graphics = Graphics.FromImage(bitmap);
                    graphics.InterpolationMode = InterpolationMode.High;   //设置高质量,低速度呈现平滑程度
                    graphics.SmoothingMode = SmoothingMode.HighQuality;    //清空画布并以透明背景色填充
                    graphics.Clear(Color.Transparent);

                    // 在指定位置并且按指定大小绘制原图片的指定部分
                    graphics.DrawImage(image, new Rectangle(0, 0, toW, toH), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
                    //ms = new Stream();
                    ms.Position = 0;//非常重要
                    bitmap.Save(ms, image.RawFormat);
                }

            }
            if (param.MaxLength != null)
            {
                if (ms != null)
                {
                    param.Image = ms;
                }
                ms = Compress(param);
            }
            ms.Position = 0;//非常重要
            return ms;
        }
        /// <summary>
        /// 压缩图片体积，不会改变图片分辨率。
        /// 传入：Image、MaxLength、NearlyLength
        /// </summary>
        private static Stream Compress(ImageParam param)
        {
            long srcLen = 0;
            //设置允许大小偏差幅度 默认20kb, 单位 Byte
            long nearlyLen = param.NearlyLength * 1024;
            var img = new Bitmap(param.Image);
            var format = img.RawFormat;
            //返回内存流  如果参数中原图大小没有传递 则使用内存流读取
            var ms = new MemoryStream();
            if (0 == srcLen)
            {
                img.Save(ms, format);
                srcLen = ms.Length;
            }
            var MaxKB = param.MaxLength.Value;
            //单位 由Kb转为byte 若目标大小高于原图大小，则满足条件退出
            MaxKB *= 1024;
            if (MaxKB >= srcLen)
            {
                ms.SetLength(0);
                ms.Position = 0;
                img.Save(ms, format);
                return ms;
            }

            //获取目标大小最低值
            var exitLen = MaxKB - nearlyLen;

            //初始化质量压缩参数 图像 内存流等
            var quality = (long)1;// (long)Math.Floor(100.00 * targetLen / srcLen);
            var parms = new EncoderParameters(1);

            //获取编码器信息
            ImageCodecInfo formatInfo = null;
            var encoders = ImageCodecInfo.GetImageEncoders();
            foreach (ImageCodecInfo icf in encoders)
            {
                if (icf.FormatID == format.Guid)
                {
                    formatInfo = icf;
                    break;
                }
            }

            //使用二分法进行查找 最接近的质量参数
            long startQuality = quality;
            long endQuality = 100;
            quality = (startQuality + endQuality) / 2;

            while (true)
            {
                //设置质量
                parms.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);

                //清空内存流 然后保存图片
                ms.SetLength(0);
                ms.Position = 0;
                img.Save(ms, formatInfo, parms);

                //若压缩后大小低于目标大小，则满足条件退出
                if (ms.Length >= exitLen && ms.Length <= MaxKB)
                {
                    break;
                }
                else if (startQuality >= endQuality) //区间相等无需再次计算
                {
                    break;
                }
                else if (ms.Length < exitLen) //压缩过小,起始质量右移
                {
                    startQuality = quality;
                }
                else //压缩过大 终止质量左移
                {
                    endQuality = quality;
                }

                //重新设置质量参数 如果计算出来的质量没有发生变化，则终止查找。这样是为了避免重复计算情况{start:16,end:18} 和 {start:16,endQuality:17}
                var newQuality = (startQuality + endQuality) / 2;
                if (newQuality == quality)
                {
                    break;
                }
                quality = newQuality;
            }
            //有可能png压缩后图片体积却变大，所以判断下直接返回
            if (ms.Length > param.Image.Length)
            {
                return param.Image;
                //return StreamHelper.StreamToMemoryStream(param.Image);
            }
            return ms;
        }



        /// <summary>
        /// 生成缩略图。必传：Image。 可传：Mode、MaxLength、MaxWidth、MaxHeight、NearlyLength
        /// </summary>
        //public static MemoryStream MakeThumbnail(ImageParam param)
        //{
        //    MemoryStream ms = null;
        //    if (param.MaxLength != null && param.Image != null && param.MaxLength + (param.NearlyLength * 1024) >= param.Image.Length)
        //    {
        //        return StreamHelper.StreamToMemoryStream(param.Image);
        //    }
        //    if (param.Mode != null)
        //    {
        //        Stream originalImageStream = param.Image;
        //        int maxWidth = param.MaxWidth ?? 0;
        //        int maxheight = param.MaxHeight ?? 0;
        //        EnumHelper.ImageMode mode = param.Mode.Value;
        //        bool success = false;

        //        int x = 0;
        //        int y = 0;
        //        int toW = maxWidth;
        //        int toH = maxheight;
        //        Image image = null;
        //        Image bitmap = null;
        //        Graphics graphics = null;
        //        image = Image.FromStream(originalImageStream);
        //        int w = image.Width;
        //        int h = image.Height;

        //        //定义是否跳过更改分辨率这步。
        //        var needChange = true;

        //        switch (mode)
        //        {
        //            case EnumHelper.ImageMode.WH:
        //                break;
        //            case EnumHelper.ImageMode.W:
        //                if (w <= maxWidth)
        //                {
        //                    toW = w;
        //                    toH = h;
        //                    needChange = false;
        //                }
        //                else
        //                {
        //                    toH = h * maxWidth / w;
        //                }
        //                break;
        //            case EnumHelper.ImageMode.H:
        //                if (h <= maxheight)
        //                {
        //                    toW = w;
        //                    toH = h;
        //                    needChange = false;
        //                }
        //                else
        //                {
        //                    toW = w * maxheight / h;
        //                }
        //                break;
        //            case EnumHelper.ImageMode.CUT:
        //                if (((double)w / (double)h) > ((double)toW / (double)toH))
        //                {
        //                    w = h * toW / toH;
        //                    y = 0;
        //                    x = (image.Width - w) / 2;
        //                }
        //                else
        //                {
        //                    h = w * toH / toW;
        //                    x = 0;
        //                    y = (image.Height - h) / 2;
        //                }
        //                break;
        //            default:
        //                goto case EnumHelper.ImageMode.CUT;
        //        }
        //        if (needChange)
        //        {
        //            bitmap = new Bitmap(toW, toH);
        //            graphics = Graphics.FromImage(bitmap);
        //            graphics.InterpolationMode = InterpolationMode.High;   //设置高质量,低速度呈现平滑程度
        //            graphics.SmoothingMode = SmoothingMode.HighQuality;    //清空画布并以透明背景色填充
        //            graphics.Clear(Color.Transparent);

        //            // 在指定位置并且按指定大小绘制原图片的指定部分
        //            graphics.DrawImage(image, new Rectangle(0, 0, toW, toH), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
        //            ms = new MemoryStream();
        //            bitmap.Save(ms, image.RawFormat);
        //        }

        //    }
        //    if (param.MaxLength != null)
        //    {
        //        if (ms != null)
        //        {
        //            param.Image = ms;
        //        }
        //        ms = Compress(param);
        //    }
        //    return ms;
        //}

        /// <summary>
        /// 压缩图片体积，不会改变图片分辨率。
        /// 传入：Image、MaxLength、NearlyLength
        /// </summary>
        //private static MemoryStream Compress(ImageParam param)
        //{
        //    long srcLen = 0;
        //    //设置允许大小偏差幅度 默认20kb, 单位 Byte
        //    long nearlyLen = param.NearlyLength * 1024;
        //    var img = new Bitmap(param.Image);
        //    var format = img.RawFormat;
        //    //返回内存流  如果参数中原图大小没有传递 则使用内存流读取
        //    var ms = new MemoryStream();
        //    if (0 == srcLen)
        //    {
        //        img.Save(ms, format);
        //        srcLen = ms.Length;
        //    }
        //    var MaxKB = param.MaxLength.Value;
        //    //单位 由Kb转为byte 若目标大小高于原图大小，则满足条件退出
        //    MaxKB *= 1024;
        //    if (MaxKB >= srcLen)
        //    {
        //        ms.SetLength(0);
        //        ms.Position = 0;
        //        img.Save(ms, format);
        //        return ms;
        //    }

        //    //获取目标大小最低值
        //    var exitLen = MaxKB - nearlyLen;

        //    //初始化质量压缩参数 图像 内存流等
        //    var quality = (long)1;// (long)Math.Floor(100.00 * targetLen / srcLen);
        //    var parms = new EncoderParameters(1);

        //    //获取编码器信息
        //    ImageCodecInfo formatInfo = null;
        //    var encoders = ImageCodecInfo.GetImageEncoders();
        //    foreach (ImageCodecInfo icf in encoders)
        //    {
        //        if (icf.FormatID == format.Guid)
        //        {
        //            formatInfo = icf;
        //            break;
        //        }
        //    }

        //    //使用二分法进行查找 最接近的质量参数
        //    long startQuality = quality;
        //    long endQuality = 100;
        //    quality = (startQuality + endQuality) / 2;

        //    while (true)
        //    {
        //        //设置质量
        //        parms.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);

        //        //清空内存流 然后保存图片
        //        ms.SetLength(0);
        //        ms.Position = 0;
        //        img.Save(ms, formatInfo, parms);

        //        //若压缩后大小低于目标大小，则满足条件退出
        //        if (ms.Length >= exitLen && ms.Length <= MaxKB)
        //        {
        //            break;
        //        }
        //        else if (startQuality >= endQuality) //区间相等无需再次计算
        //        {
        //            break;
        //        }
        //        else if (ms.Length < exitLen) //压缩过小,起始质量右移
        //        {
        //            startQuality = quality;
        //        }
        //        else //压缩过大 终止质量左移
        //        {
        //            endQuality = quality;
        //        }

        //        //重新设置质量参数 如果计算出来的质量没有发生变化，则终止查找。这样是为了避免重复计算情况{start:16,end:18} 和 {start:16,endQuality:17}
        //        var newQuality = (startQuality + endQuality) / 2;
        //        if (newQuality == quality)
        //        {
        //            break;
        //        }
        //        quality = newQuality;
        //    }
        //    //有可能png压缩后图片体积却变大，所以判断下直接返回
        //    if (ms.Length > param.Image.Length)
        //    {
        //        return StreamHelper.StreamToMemoryStream(param.Image);
        //    }
        //    return ms;
        //}
    }
}
