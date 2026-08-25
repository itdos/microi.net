using System;

namespace Microi.net
{
    /// <summary>
    /// CAD 上传转换器与私有文件授权共享的唯一派生预览路径规则。
    /// 这里只允许同目录、同 basename 的固定后缀映射，不提供前缀匹配。
    /// </summary>
    public static class CadDerivedPreviewPath
    {
        public static string GetTargetExtension(string fileSuffix)
        {
            var extension = NormalizeExtension(fileSuffix);
            switch (extension)
            {
                case ".dwg": return ".dxf";
                case ".step":
                case ".stp": return ".stl";
                default: return null;
            }
        }

        public static bool TryGetConvertedPath(
            string originalPath,
            string fileSuffix,
            out string convertedPath)
        {
            convertedPath = null;
            if (string.IsNullOrWhiteSpace(originalPath)
                || originalPath.Length > 2048
                || originalPath.IndexOfAny(new[] { '?', '#', '\0', '\r', '\n' }) >= 0)
                return false;

            var normalized = originalPath.Trim().Replace('\\', '/');
            var fileNameIndex = normalized.LastIndexOf('/');
            var extensionIndex = normalized.LastIndexOf('.');
            if (extensionIndex <= fileNameIndex + 1 || extensionIndex == normalized.Length - 1)
                return false;

            var actualExtension = NormalizeExtension(normalized.Substring(extensionIndex));
            var declaredExtension = NormalizeExtension(fileSuffix);
            if (!string.Equals(actualExtension, declaredExtension, StringComparison.OrdinalIgnoreCase))
                return false;
            var targetExtension = GetTargetExtension(actualExtension);
            if (targetExtension == null) return false;

            convertedPath = normalized.Substring(0, extensionIndex) + "_preview" + targetExtension;
            return true;
        }

        public static bool TryGetConvertedPath(string originalPath, out string convertedPath)
        {
            convertedPath = null;
            if (string.IsNullOrWhiteSpace(originalPath)) return false;
            var normalized = originalPath.Trim().Replace('\\', '/');
            var fileNameIndex = normalized.LastIndexOf('/');
            var extensionIndex = normalized.LastIndexOf('.');
            return extensionIndex > fileNameIndex + 1
                   && TryGetConvertedPath(
                       normalized,
                       normalized.Substring(extensionIndex),
                       out convertedPath);
        }

        private static string NormalizeExtension(string value)
        {
            var extension = (value ?? string.Empty).Trim();
            if (extension.Length == 0) return string.Empty;
            if (!extension.StartsWith(".", StringComparison.Ordinal)) extension = "." + extension;
            return extension.ToLowerInvariant();
        }
    }
}
