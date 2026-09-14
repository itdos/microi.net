using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>签发绑定租户、用户、字段、记录和私有对象的短期上传凭据，防止复制他人路径后重新授予自己权限。</summary>
    public static class FileUploadProvenance
    {
        public static string Issue(DiyUploadParam param, string path)
        {
            if (param.Limit != true || param._CurrentUser == null || string.IsNullOrWhiteSpace(param.FieldId)
                || string.IsNullOrWhiteSpace(param.FormDataId)) return null;
            var expires = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds().ToString();
            return expires + "." + Sign(Key(param.OsClient), expires, param.OsClient, (string)param._CurrentUser["Id"], param.FieldId, param.FormDataId, path);
        }

        public static bool Validate(string proof, string osClient, string userId, string fieldId, string rowId, string path)
        {
            var parts = (proof ?? "").Split('.');
            if (parts.Length != 2 || !long.TryParse(parts[0], out var expiry) || expiry < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return false;
            var expected = Sign(Key(osClient), parts[0], osClient, userId, fieldId, rowId, path);
            var actualBytes = Encoding.UTF8.GetBytes(parts[1]); var expectedBytes = Encoding.UTF8.GetBytes(expected);
            if (actualBytes.Length != expectedBytes.Length) return false;
            var difference = 0;
            for (var i = 0; i < actualBytes.Length; i++) difference |= actualBytes[i] ^ expectedBytes[i];
            return difference == 0;
        }

        internal static string Sign(string secret, params string[] parts)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
                return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(new JArray(parts).ToString(Newtonsoft.Json.Formatting.None))));
        }

        private static string Key(string osClient)
        {
            var secret = OsClientExtend.GetClient(osClient)?.OsClientModel?["AuthSecret"].Val<string>();
            if (string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("租户上传授权密钥未配置。");
            return "Microi.FileUploadProvenance.v1:" + secret;
        }
    }
}
