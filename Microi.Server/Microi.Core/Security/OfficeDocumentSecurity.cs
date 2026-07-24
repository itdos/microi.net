using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;

namespace Microi.net
{
    /// <summary>
    /// OnlyOffice/Office 文件回源与类型校验的确定性安全规则。
    /// 不保存进程内状态，可由 API、Worker 和多节点实例复用。
    /// </summary>
    public static class OfficeDocumentSecurity
    {
        public static bool IsAllowedDownloadUrl(string downloadUrl, string onlyOfficeApiBase)
        {
            Uri downloadUri;
            Uri officeUri;
            if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out downloadUri)
                || !Uri.TryCreate(onlyOfficeApiBase, UriKind.Absolute, out officeUri))
            {
                return false;
            }

            if (!IsHttpScheme(downloadUri.Scheme)
                || !IsHttpScheme(officeUri.Scheme)
                || !string.IsNullOrWhiteSpace(downloadUri.UserInfo)
                || !string.IsNullOrWhiteSpace(downloadUri.Fragment)
                || !string.IsNullOrWhiteSpace(officeUri.UserInfo)
                || !string.IsNullOrWhiteSpace(officeUri.Fragment)
                || !string.Equals(downloadUri.Scheme, officeUri.Scheme, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(downloadUri.Host, officeUri.Host, StringComparison.OrdinalIgnoreCase)
                || downloadUri.Port != officeUri.Port)
            {
                return false;
            }

            var basePath = officeUri.AbsolutePath.TrimEnd('/');
            return basePath.Length == 0
                   || basePath == "/"
                   || string.Equals(downloadUri.AbsolutePath, basePath, StringComparison.Ordinal)
                   || downloadUri.AbsolutePath.StartsWith(basePath + "/", StringComparison.Ordinal);
        }

        public static bool HasExpectedFileSignature(string extension, byte[] bytes)
        {
            if (string.IsNullOrWhiteSpace(extension) || bytes == null || bytes.Length == 0)
                return false;

            if (extension.Equals(".csv", StringComparison.OrdinalIgnoreCase))
                return HasExpectedCsvContent(bytes);
            if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                return bytes.Length >= 5
                       && bytes[0] == 0x25
                       && bytes[1] == 0x50
                       && bytes[2] == 0x44
                       && bytes[3] == 0x46
                       && bytes[4] == 0x2D;
            }
            if (extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".docx", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".pptx", StringComparison.OrdinalIgnoreCase))
            {
                return HasExpectedOpenXmlPackage(extension, bytes);
            }
            if (extension.Equals(".xls", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".doc", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".ppt", StringComparison.OrdinalIgnoreCase))
            {
                return bytes.Length >= 4
                       && bytes[0] == 0xD0
                       && bytes[1] == 0xCF
                       && bytes[2] == 0x11
                       && bytes[3] == 0xE0;
            }
            return false;
        }

        private static bool HasExpectedCsvContent(byte[] bytes)
        {
            // CSV没有固定魔数。拒绝常见可执行/HTML内容和无BOM的NUL字节，
            // 但继续兼容带BOM的UTF-16 CSV。
            var prefixLength = Math.Min(bytes.Length, 512);
            var prefix = Encoding.UTF8
                .GetString(bytes, 0, prefixLength)
                .TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
            if (prefix.StartsWith("<!doctype", StringComparison.OrdinalIgnoreCase)
                || prefix.StartsWith("<html", StringComparison.OrdinalIgnoreCase)
                || prefix.StartsWith("<script", StringComparison.OrdinalIgnoreCase)
                || prefix.StartsWith("MZ", StringComparison.Ordinal))
            {
                return false;
            }

            var hasUtf16Bom = bytes.Length >= 2
                              && ((bytes[0] == 0xFF && bytes[1] == 0xFE)
                                  || (bytes[0] == 0xFE && bytes[1] == 0xFF));
            return hasUtf16Bom || !bytes.Take(prefixLength).Any(value => value == 0);
        }

        private static bool HasExpectedOpenXmlPackage(string extension, byte[] bytes)
        {
            if (bytes.Length < 4
                || bytes[0] != 0x50
                || bytes[1] != 0x4B
                || bytes[2] != 0x03
                || bytes[3] != 0x04)
            {
                return false;
            }

            try
            {
                using (var stream = new MemoryStream(bytes, false))
                using (var archive = new ZipArchive(stream, ZipArchiveMode.Read, false))
                {
                    if (archive.Entries.Count == 0 || archive.Entries.Count > 10000) return false;
                    var entries = new HashSet<string>(
                        archive.Entries.Select(item => item.FullName.Replace('\\', '/')),
                        StringComparer.OrdinalIgnoreCase);
                    if (!entries.Contains("[Content_Types].xml")
                        || !entries.Contains("_rels/.rels"))
                    {
                        return false;
                    }

                    if (extension.Equals(".docx", StringComparison.OrdinalIgnoreCase))
                        return entries.Contains("word/document.xml");
                    if (extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                        return entries.Contains("xl/workbook.xml");
                    if (extension.Equals(".pptx", StringComparison.OrdinalIgnoreCase))
                        return entries.Contains("ppt/presentation.xml");
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool IsHttpScheme(string scheme)
        {
            return string.Equals(scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                   || string.Equals(scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
        }
    }
}
