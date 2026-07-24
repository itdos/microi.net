using Dos.Common;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessageController : ControllerBase
    {
        [HttpGet]
        public IActionResult OAuth(string code, string state)
        {
            var expectedState = ConfigHelper.GetEnvOrConfiguration(
                "MICROI_CHANJET_OAUTH_STATE",
                "Integrations:Chanjet:OAuthState");
            if (expectedState.DosIsNullOrWhiteSpace()
                || code.DosIsNullOrWhiteSpace()
                || !FixedTimeEquals(expectedState, state))
            {
                return NotFound();
            }
            // The authorization code is a credential. Never echo or log it.
            return Ok(new DosResult(1));
        }

        [HttpPost]
        [Route("Receive")]
        [RequestSizeLimit(512 * 1024)]
        public IActionResult Receive([FromBody] ChanjetEncryptMsg encryptMsg)
        {
            try
            {
                var aesKey = ConfigHelper.GetEnvOrConfiguration(
                    "MICROI_CHANJET_AES_KEY",
                    "Integrations:Chanjet:AesKey");
                var expectedAppKey = ConfigHelper.GetEnvOrConfiguration(
                    "MICROI_CHANJET_APP_KEY",
                    "Integrations:Chanjet:AppKey");
                var enMsg = encryptMsg?.GetEncryptMsg();
                var keyLength = Encoding.UTF8.GetByteCount(aesKey ?? "");
                if (aesKey.DosIsNullOrWhiteSpace()
                    || expectedAppKey.DosIsNullOrWhiteSpace()
                    || (keyLength != 16 && keyLength != 24 && keyLength != 32)
                    || enMsg.DosIsNullOrWhiteSpace()
                    || enMsg.Length > 384 * 1024)
                {
                    return NotFound();
                }

                var decryptMsg = OpenapiHelper.AesDecrypt(enMsg, aesKey);
                if (decryptMsg.DosIsNullOrWhiteSpace() || decryptMsg.Length > 256 * 1024)
                {
                    return BadRequest(new DosResult(0, null, "消息格式无效。"));
                }
                var message = JsonHelper.Deserialize<MessageBase>(decryptMsg);
                if (message == null
                    || message.id.DosIsNullOrWhiteSpace()
                    || message.msgType.DosIsNullOrWhiteSpace()
                    || !FixedTimeEquals(expectedAppKey, message.appKey))
                {
                    return BadRequest(new DosResult(0, null, "消息验证失败。"));
                }

                object retObj;
                switch (message.msgType)
                {
                    case "APP_TEST":
                        retObj = DealTestMsg(message);
                        break;

                    case "APP_TICKET":
                        retObj = DealTicketMsg(message);
                        break;

                    case "TEMP_AUTH_CODE":
                        retObj = DealOrgTempAuthMsg(message);
                        break;

                    case "PAY_ORDER_SUCCESS":
                        retObj = DealOrderPayMsg(message);
                        break;

                    default:
                        retObj = DealBussnessMsg(message);
                        break;
                }
                return Ok(retObj);
            }
            catch
            {
                return BadRequest(new DosResult(0, null, "消息格式无效。"));
            }
        }

        private object DealOrderPayMsg(MessageBase message)
        {
            return ReceiveMsgOK();
        }

        private object DealOrgTempAuthMsg(MessageBase message)
        {
            JsonHelper.Deserialize<OrgTempAuthContent>(message.bizContent.ToString());
            return ReceiveMsgOK();
        }

        private object DealTicketMsg(MessageBase message)
        {
            JsonHelper.Deserialize<AppTicketContent>(message.bizContent.ToString());
            return ReceiveMsgOK();
        }

        private static bool FixedTimeEquals(string left, string right)
        {
            if (left == null || right == null) return false;
            using var sha = SHA256.Create();
            var leftHash = sha.ComputeHash(Encoding.UTF8.GetBytes(left));
            var rightHash = sha.ComputeHash(Encoding.UTF8.GetBytes(right));
            var different = 0;
            for (var i = 0; i < leftHash.Length; i++)
            {
                different |= leftHash[i] ^ rightHash[i];
            }
            return different == 0;
        }

        private object DealTestMsg(MessageBase message)
        {
            return ReceiveMsgOK();
        }

        private object DealBussnessMsg(MessageBase message)
        {
            return ReceiveMsgOK();
        }

        private object ReceiveMsgOK()
        {
            Dictionary<string, string> dic = new Dictionary<string, string>
            {
                { "result","success"}
            };

            return JsonHelper.Serialize(dic);
        }
    }

    #region Chanjet OpenAPI 消息模型

    public class ChanjetEncryptMsg
    {
        public string encryptMsg { get; set; }

        public string GetEncryptMsg()
        {
            return encryptMsg;
        }
    }

    public class MessageBase
    {
        public string id;
        public string appKey;
        public string msgType;
        public string time;
        public object bizContent;
    }

    public class AppTestContent
    {
        public string message;
    }

    public class AppTicketContent
    {
        public string appTicket;
    }

    public class OrgTempAuthContent
    {
        public string tempAuthCode;
        public string state;
    }

    public class OrderPayContent
    {
        public string orderNo;
        public string orgId;
    }

    public class OpenapiHelper
    {
        /// <summary>
        /// AES 加密
        /// </summary>
        /// <param name="str">明文（待加密）</param>
        /// <param name="key">密文</param>
        /// <returns></returns>
        public static string AesEncrypt(string str, string key)
        {
            if (string.IsNullOrEmpty(str)) return null;
            Byte[] toEncryptArray = Encoding.UTF8.GetBytes(str);

            RijndaelManaged rm = new RijndaelManaged
            {
                Key = Encoding.UTF8.GetBytes(key),
                Mode = CipherMode.ECB,
                Padding = PaddingMode.PKCS7
            };

            ICryptoTransform cTransform = rm.CreateEncryptor();
            Byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);

            return Convert.ToBase64String(resultArray, 0, resultArray.Length);
        }

        /// <summary>
        /// AES 解密
        /// </summary>
        /// <param name="str">明文（待解密）</param>
        /// <param name="key">密文</param>
        /// <returns></returns>
        public static string AesDecrypt(string str, string key)
        {
            if (string.IsNullOrEmpty(str)) return null;
            Byte[] toEncryptArray = Convert.FromBase64String(str);

            RijndaelManaged rm = new RijndaelManaged
            {
                Key = Encoding.UTF8.GetBytes(key),
                Mode = CipherMode.ECB,
                Padding = PaddingMode.PKCS7
            };

            ICryptoTransform cTransform = rm.CreateDecryptor();
            Byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);

            return Encoding.UTF8.GetString(resultArray);
        }
    }

    #endregion Chanjet OpenAPI 消息模型
}
