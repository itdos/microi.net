using System;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8 图片扩展窄门面。JavaScript 中通过 V8.Image 调用。
    /// 只接收内存图片（Base64/Data URI），不直接开放本地路径或 URL。
    /// </summary>
    public class V8Image
    {
        public DosResult Create(object param) => Execute<ImageCreateParam>(param, ImageHelper.Create);

        public DosResult Merge(object param) => Execute<ImageMergeParam>(param, ImageHelper.Merge, NormalizeMerge);

        public DosResult Overlay(object param)
        {
            return Execute<ImageMergeParam>(param, ImageHelper.Merge, json =>
            {
                NormalizeMerge(json);
                SetValue(json, "Mode", new JValue("overlay"));
            });
        }

        public DosResult Resize(object param) => Execute<ImageResizeParam>(param, ImageHelper.Resize, NormalizeSingleSource);

        public DosResult Crop(object param) => Execute<ImageCropParam>(param, ImageHelper.Crop, NormalizeSingleSource);

        public DosResult Rotate(object param) => Execute<ImageRotateParam>(param, ImageHelper.Rotate, NormalizeSingleSource);

        public DosResult Flip(object param) => Execute<ImageFlipParam>(param, ImageHelper.Flip, NormalizeSingleSource);

        public DosResult Convert(object param) => Execute<ImageConvertParam>(param, ImageHelper.Convert, NormalizeSingleSource);

        public DosResult Draw(object param) => Execute<ImageDrawParam>(param, ImageHelper.Draw, NormalizeSingleSource);

        public DosResult Watermark(object param)
        {
            return Execute<ImageWatermarkParam>(param, ImageHelper.Watermark, json =>
            {
                NormalizeOutputAliases(json);
                NormalizeNamedSource(json, "Image");
                NormalizeNamedSource(json, "BaseImage");
                NormalizeNamedSource(json, "Watermark");
                CopyAlias(json, "Base", "BaseImage");
                CopyAlias(json, "Overlay", "Watermark");
                NormalizeNamedSource(json, "BaseImage");
                NormalizeNamedSource(json, "Watermark");
            });
        }

        public DosResult CreateQRCode(object param) => Execute<ImageQrCodeParam>(param, ImageHelper.CreateQRCode);

        public DosResult GetInfo(object param)
        {
            try
            {
                var json = ToJObject(param);
                NormalizeSingleSource(json);
                var options = json.ToObject<ImageInfoParam>();
                var result = ImageHelper.GetInfo(options);
                return new DosResult(1, result);
            }
            catch (Exception ex)
            {
                return Failed(ex);
            }
        }

        private static DosResult Execute<T>(object value, Func<T, ImageProcessResult> action,
            Action<JObject> normalize = null)
        {
            try
            {
                var json = ToJObject(value);
                NormalizeOutputAliases(json);
                normalize?.Invoke(json);
                var options = json.ToObject<T>();
                var result = action(options);
                var base64 = System.Convert.ToBase64String(result.Bytes);
                return new DosResult(1, new
                {
                    result.FileName,
                    result.ContentType,
                    FileByteBase64 = base64,
                    result.Width,
                    result.Height,
                    result.Size,
                    result.Format
                });
            }
            catch (Exception ex)
            {
                return Failed(ex);
            }
        }

        private static DosResult Failed(Exception ex)
        {
            var message = ex is JsonException || ex is FormatException
                ? "图片参数不是有效的 JSON 或 Base64。"
                : ex.Message;
            return new DosResult(0, null, "图片处理失败：" + message);
        }

        private static JObject ToJObject(object param)
        {
            if (param == null) return new JObject();
            if (param is JObject jObject) return (JObject)jObject.DeepClone();
            if (param is string text)
            {
                if (string.IsNullOrWhiteSpace(text)) return new JObject();
                return JObject.Parse(text);
            }
            try
            {
                return JObject.FromObject(param);
            }
            catch
            {
                return JObject.Parse(JsonConvert.SerializeObject(param));
            }
        }

        private static void NormalizeOutputAliases(JObject json)
        {
            CopyAlias(json, "ImageFormat", "OutputFormat");
            CopyAlias(json, "OutputType", "OutputFormat");
            CopyAlias(json, "Background", "BackgroundColor");
            CopyAlias(json, "BgColor", "BackgroundColor");
        }

        private static void NormalizeSingleSource(JObject json)
        {
            NormalizeOutputAliases(json);
            CopyAlias(json, "ImageBase64", "FileByteBase64");
            NormalizeNamedSource(json, "Image");
            NormalizeNamedSource(json, "Source");
        }

        private static void NormalizeMerge(JObject json)
        {
            NormalizeOutputAliases(json);
            CopyAlias(json, "MergeType", "Mode");
            CopyAlias(json, "Type", "Mode");
            CopyAlias(json, "Items", "Images");

            var images = GetValue(json, "Images") ?? GetValue(json, "Layers");
            if (images == null)
            {
                var baseImage = FirstValue(json, "BaseImage", "BackgroundImage", "FirstImage", "Base");
                var overlayImage = FirstValue(json, "OverlayImage", "ForegroundImage", "SecondImage", "Overlay");
                if (baseImage != null || overlayImage != null)
                {
                    var array = new JArray();
                    if (baseImage != null) array.Add(NormalizeLayerToken(baseImage.DeepClone()));
                    if (overlayImage != null)
                    {
                        var layer = NormalizeLayerToken(overlayImage.DeepClone());
                        if (layer is JObject overlayObject)
                        {
                            CopyTopLevelLayerOption(json, overlayObject, "X");
                            CopyTopLevelLayerOption(json, overlayObject, "Y");
                            CopyTopLevelLayerOption(json, overlayObject, "Position", "Anchor");
                            CopyTopLevelLayerOption(json, overlayObject, "Opacity");
                            CopyTopLevelLayerOption(json, overlayObject, "OverlayWidth", "Width");
                            CopyTopLevelLayerOption(json, overlayObject, "OverlayHeight", "Height");
                            CopyTopLevelLayerOption(json, overlayObject, "Scale");
                            SetIfMissing(overlayObject, "ZIndex", 1);
                        }
                        array.Add(layer);
                    }
                    json["Images"] = array;
                    SetIfMissing(json, "Mode", "overlay");
                    images = array;
                }
            }

            if (images is JArray imageArray)
            {
                for (var i = 0; i < imageArray.Count; i++)
                    imageArray[i] = NormalizeLayerToken(imageArray[i]);
            }
            else if (images != null)
            {
                json["Images"] = new JArray(NormalizeLayerToken(images));
            }
        }

        private static JToken NormalizeLayerToken(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return new JObject();
            if (token.Type == JTokenType.String)
                return SourceObject(token.Value<string>());
            if (!(token is JObject layer)) return token;

            CopyAlias(layer, "ImageBase64", "FileByteBase64");
            var nested = FirstValue(layer, "Image", "Source");
            if (nested != null)
            {
                var source = NormalizeLayerToken(nested.DeepClone()) as JObject;
                if (source != null)
                {
                    foreach (var property in source.Properties())
                        SetIfMissing(layer, property.Name, property.Value.DeepClone());
                }
                RemoveProperty(layer, "Image");
                RemoveProperty(layer, "Source");
            }
            CopyAlias(layer, "Order", "ZIndex");
            CopyAlias(layer, "Alpha", "Opacity");
            CopyAlias(layer, "Rotate", "Rotation");
            CopyAlias(layer, "Left", "X");
            CopyAlias(layer, "Top", "Y");
            return layer;
        }

        private static void NormalizeNamedSource(JObject json, string name)
        {
            var token = GetValue(json, name);
            if (token == null) return;
            if (token.Type == JTokenType.String)
                SetValue(json, name, SourceObject(token.Value<string>()));
        }

        private static JObject SourceObject(string value)
        {
            return value != null && value.TrimStart().StartsWith("data:", StringComparison.OrdinalIgnoreCase)
                ? new JObject { ["DataUrl"] = value }
                : new JObject { ["FileByteBase64"] = value };
        }

        private static void CopyTopLevelLayerOption(JObject source, JObject target, string sourceName,
            string targetName = null)
        {
            var token = GetValue(source, sourceName);
            if (token != null) SetIfMissing(target, targetName ?? sourceName, token.DeepClone());
        }

        private static void CopyAlias(JObject json, string alias, string target)
        {
            var value = GetValue(json, alias);
            if (value != null) SetIfMissing(json, target, value.DeepClone());
        }

        private static JToken FirstValue(JObject json, params string[] names)
        {
            foreach (var name in names)
            {
                var value = GetValue(json, name);
                if (value != null && value.Type != JTokenType.Null) return value;
            }
            return null;
        }

        private static JToken GetValue(JObject json, string name)
        {
            return json.GetValue(name, StringComparison.OrdinalIgnoreCase);
        }

        private static void SetIfMissing(JObject json, string name, object value)
        {
            if (GetValue(json, name) == null)
                json[name] = value is JToken token ? token : JToken.FromObject(value);
        }

        private static void SetValue(JObject json, string name, JToken value)
        {
            var property = FindProperty(json, name);
            if (property == null) json[name] = value;
            else property.Value = value;
        }

        private static void RemoveProperty(JObject json, string name)
        {
            FindProperty(json, name)?.Remove();
        }

        private static JProperty FindProperty(JObject json, string name)
        {
            foreach (var property in json.Properties())
                if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) return property;
            return null;
        }
    }
}
