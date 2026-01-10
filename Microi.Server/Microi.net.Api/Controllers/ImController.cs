using Ionic.Zlib;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Microi.net.Api
{
    /// <summary>
    /// 腾讯IM即时通信
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class ImController : Controller
    {
        private readonly HttpClient _httpClient;

        public ImController(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        #region 获取用户签名

        /// <summary>
        /// 获取用户签名
        /// </summary>
        /// <param name="userId"></param>
        /// <param name="sdkAppid"></param>
        /// <param name="secretKey"></param>
        /// <param name="expire"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public string GetUserSig([FromQuery] string userId, uint sdkAppid = 0, string secretKey = "", int expire = 604800)
        {
            string userSig = genUserSig(userId, sdkAppid, secretKey, expire, null, false);
            return userSig;
        }

        private string genUserSig(string userId, uint sdkAppid, string secretKey, int expire, byte[] userbuf, bool userBufEnabled)
        {
            DateTime epoch = new DateTime(1970, 1, 1); // unix 时间戳
            Int64 currTime = (Int64)(DateTime.UtcNow - epoch).TotalMilliseconds / 1000;

            string base64UserBuf;
            string jsonData;
            if (true == userBufEnabled)
            {
                base64UserBuf = Convert.ToBase64String(userbuf);
                string base64sig = HMACSHA256(userId, sdkAppid, secretKey, currTime, expire, base64UserBuf, userBufEnabled);
                // 没有引入 json 库，所以这里手动进行组装
                jsonData = String.Format("{{"
                   + "\"TLS.ver\":" + "\"2.0\","
                   + "\"TLS.identifier\":" + "\"{0}\","
                   + "\"TLS.sdkappid\":" + "{1},"
                   + "\"TLS.expire\":" + "{2},"
                   + "\"TLS.time\":" + "{3},"
                   + "\"TLS.sig\":" + "\"{4}\","
                   + "\"TLS.userbuf\":" + "\"{5}\""
                   + "}}", userId, sdkAppid, expire, currTime, base64sig, base64UserBuf);
            }
            else
            {
                // 没有引入 json 库，所以这里手动进行组装
                string base64sig = HMACSHA256(userId, sdkAppid, secretKey, currTime, expire, "", false);
                jsonData = String.Format("{{"
                    + "\"TLS.ver\":" + "\"2.0\","
                    + "\"TLS.identifier\":" + "\"{0}\","
                    + "\"TLS.sdkappid\":" + "{1},"
                    + "\"TLS.expire\":" + "{2},"
                    + "\"TLS.time\":" + "{3},"
                    + "\"TLS.sig\":" + "\"{4}\""
                    + "}}", userId, sdkAppid, expire, currTime, base64sig);
            }

            byte[] buffer = Encoding.UTF8.GetBytes(jsonData);
            return Convert.ToBase64String(CompressBytes(buffer))
                .Replace('+', '*').Replace('/', '-').Replace('=', '_');
        }

        private static byte[] CompressBytes(byte[] sourceByte)
        {
            return ZlibStream.CompressBuffer(sourceByte);
        }

        private string HMACSHA256(string identifier, uint sdkAppid, string secretKey, long currTime, int expire, string base64UserBuf, bool userBufEnabled)
        {
            string rawContentToBeSigned = "TLS.identifier:" + identifier + "\n"
                 + "TLS.sdkappid:" + sdkAppid + "\n"
                 + "TLS.time:" + currTime + "\n"
                 + "TLS.expire:" + expire + "\n";
            if (true == userBufEnabled)
            {
                rawContentToBeSigned += "TLS.userbuf:" + base64UserBuf + "\n";
            }
            using (HMACSHA256 hmac = new HMACSHA256())
            {
                UTF8Encoding encoding = new UTF8Encoding();
                Byte[] textBytes = encoding.GetBytes(rawContentToBeSigned);
                Byte[] keyBytes = encoding.GetBytes(secretKey);
                Byte[] hashBytes;
                using (HMACSHA256 hash = new HMACSHA256(keyBytes))
                    hashBytes = hash.ComputeHash(textBytes);
                return Convert.ToBase64String(hashBytes);
            }
        }

        #endregion 获取用户签名

        #region 多账号导入

        /// <summary>
        /// 多账号导入
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> MultiAccountImport([FromBody] ImAccountImportRequest request)
        {
            var random = new Random().Next(10000000, 99999999); // 生成随机数

            // Step 1: 获取 UserSig
            var userSig = genUserSig(request.Identifier, request.SdkAppId, request.SecretKey, request.Expire, null, false);

            var url = $"https://console.tim.qq.com/v4/im_open_login_svc/multiaccount_import?" +
                      $"sdkappid={request.SdkAppId}&" +
                      $"identifier={request.Identifier}&" +
                      $"usersig={userSig}&" +
                      $"random={random}&" +
                      $"contenttype=json";

            var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            var result = await response.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }

        public class ImAccountImportRequest
        {
            public uint SdkAppId { get; set; }// 应用 ID
            public string Identifier { get; set; }//  管理员用户名
            public string SecretKey { get; set; } // 应用密钥
            public int Expire { get; set; } = 86400; // 过期时间
            public int C2CmsgNosaveFlag { get; set; } = 1; // 不保存离线消息
            public List<ImAccount> AccountList { get; set; }
        }

        public class ImAccount
        {
            public string UserID { get; set; }
            public string Nick { get; set; }
            public string? FaceUrl { get; set; }
        }

        #endregion 多账号导入

        #region 多账号删除

        /// <summary>
        /// 多账号删除
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> MultiAccountDelete([FromBody] ImAccountDeleteRequest request)
        {
            var random = new Random().Next(10000000, 99999999); // 生成随机数

            // Step 1: 获取 UserSig
            var userSig = genUserSig(request.Identifier, request.SdkAppId, request.SecretKey, request.Expire, null, false);

            //var client = _httpClientFactory.CreateClient();
            var url = $"https://console.tim.qq.com/v4/im_open_login_svc/account_delete?" +
                      $"sdkappid={request.SdkAppId}&" +
                      $"identifier={request.Identifier}&" +
                      $"usersig={userSig}&" +
                      $"random={random}&" +
                      $"contenttype=json";

            var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            var result = await response.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }

        public class ImAccountDeleteRequest
        {
            public uint SdkAppId { get; set; }// 应用 ID
            public string Identifier { get; set; }//  管理员用户名
            public string SecretKey { get; set; } // 应用密钥
            public int Expire { get; set; } = 86400; // 过期时间
            public List<DelImAccount> DeleteItem { get; set; }
        }

        public class DelImAccount
        {
            public string UserID { get; set; }
        }

        #endregion 多账号删除
    }
}
