using System.IO;

namespace Microi.net
{
    /// <summary>
    /// 按已校验对象路径确定存储 MIME，避免不同供应商把网页产物统一标成二进制。
    /// 此映射只负责对象元数据，不授予上传权限，也不代替文件内容与路径校验。
    /// </summary>
    public static class ObjectStorageContentTypes
    {
        /// <summary>返回浏览器可识别的类型；未知后缀继续使用通用二进制类型。</summary>
        public static string GetContentType(string objectPath)
        {
            return Path.GetExtension(objectPath ?? string.Empty).ToLowerInvariant() switch
            {
                ".html" => "text/html; charset=utf-8",
                ".htm" => "text/html; charset=utf-8",
                ".js" => "text/javascript; charset=utf-8",
                ".mjs" => "text/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".map" => "application/json; charset=utf-8",
                ".txt" => "text/plain; charset=utf-8",
                ".wasm" => "application/wasm",
                ".pdf" => "application/pdf",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".webp" => "image/webp",
                ".avif" => "image/avif",
                ".ico" => "image/x-icon",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf" => "font/ttf",
                ".otf" => "font/otf",
                _ => "application/octet-stream"
            };
        }
    }
}
