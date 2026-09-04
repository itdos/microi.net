using Dos.Common;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

// ASP.NET Core 消息协议适配器；通知业务编排由官方 Managed ApiEngine 承载。
namespace Microi.net.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessageController : ControllerBase
    {
        private const string ChanjetCallbackV2EngineKey = "platform-chanjet-callback-v2";

        [HttpGet]
        public IActionResult OAuth(string code, string state, string OsClient = null)
        {
            if (!TryLoadProtocolSettings(OsClient, out var protocolSettings))
                return NotFound();
            var expectedState = protocolSettings.OAuthState;
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
        public IActionResult Receive([FromBody] ChanjetEncryptMsg encryptMsg, string OsClient = null)
        {
            try
            {
                if (!TryLoadProtocolSettings(OsClient, out var protocolSettings))
                    return NotFound();
                var aesKey = protocolSettings.AesKey;
                var expectedAppKey = protocolSettings.AppKey;
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

        /// <summary>
        /// Opt-in Chanjet callback V2. This route is additive and never falls back to
        /// the legacy callback configuration or process default tenant. Protocol
        /// validation stays in C#; credential persistence and business behavior are
        /// delegated to one fixed Managed ApiEngine.
        /// </summary>
        [HttpPost]
        [Route("ReceiveV2")]
        [RequestSizeLimit(512 * 1024)]
        public async Task<IActionResult> ReceiveV2(
            [FromBody] ChanjetEncryptMsg encryptMsg,
            string OsClient = null)
        {
            try
            {
                if (OsClient.DosIsNullOrWhiteSpace()
                    || !ChanjetV2ProtocolGatewaySettings.TryLoad(OsClient, out var settings))
                {
                    return NotFound();
                }

                var encryptedMessage = encryptMsg?.GetEncryptMsg();
                if (encryptedMessage.DosIsNullOrWhiteSpace()
                    || encryptedMessage.Length > 384 * 1024)
                {
                    return BadRequest(new DosResult(0, null, "消息格式无效。"));
                }

                var decryptedMessage = OpenapiHelper.AesDecrypt(
                    encryptedMessage,
                    settings.AesKey);
                if (decryptedMessage.DosIsNullOrWhiteSpace()
                    || decryptedMessage.Length > 256 * 1024)
                {
                    return BadRequest(new DosResult(0, null, "消息格式无效。"));
                }

                var message = JsonHelper.Deserialize<MessageBase>(decryptedMessage);
                if (!IsSafeV2Message(message)
                    || !settings.IsAllowedAppKey(message.appKey))
                {
                    return BadRequest(new DosResult(0, null, "消息验证失败。"));
                }

                var bizContent = message.bizContent as JToken
                                 ?? (message.bizContent == null
                                     ? JValue.CreateNull()
                                     : JToken.FromObject(message.bizContent));
                if (bizContent.ToString(Formatting.None).Length > 128 * 1024)
                {
                    return BadRequest(new DosResult(0, null, "消息格式无效。"));
                }

                var trustedRequest = new JObject
                {
                    ["Action"] = "ReceiveChanjetCallbackV2",
                    ["MessageId"] = message.id,
                    ["AppKey"] = message.appKey,
                    ["MessageType"] = message.msgType,
                    ["MessageTime"] = message.time ?? string.Empty,
                    ["BizContent"] = bizContent.DeepClone()
                };
                var result = await ManagedApiEngineCompatibility.RunTrustedProtocolAsync(
                        ChanjetCallbackV2EngineKey,
                        settings.OsClient,
                        trustedRequest)
                    .ConfigureAwait(false);
                if (!IsSuccessfulDosResult(result))
                {
                    // A non-success response deliberately asks Chanjet to retry. Never
                    // echo provider credentials or internal engine diagnostics.
                    return StatusCode(503, new DosResult(0, null, "消息暂未处理，请稍后重试。"));
                }

                return Ok(ReceiveMsgOK());
            }
            catch
            {
                return BadRequest(new DosResult(0, null, "消息格式无效。"));
            }
        }

        private static bool TryLoadProtocolSettings(
            string requestedOsClient,
            out ChanjetProtocolGatewaySettings settings)
        {
            var osClient = requestedOsClient;
            if (osClient.DosIsNullOrWhiteSpace())
            {
                // Compatibility for the historical single-tenant callback URL. New
                // callback registrations should always append ?OsClient={tenant}.
                osClient = OsClientExtend.GetConfigOsClient();
                if (osClient.DosIsNullOrWhiteSpace()) osClient = OsClientDefault.OsClient;
            }
            return TenantProtocolGatewaySettings.TryLoadChanjet(osClient, out settings);
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

        private static bool IsSafeV2Message(MessageBase message)
        {
            return message != null
                   && !message.id.DosIsNullOrWhiteSpace()
                   && message.id.Length <= 128
                   && !message.appKey.DosIsNullOrWhiteSpace()
                   && message.appKey.Length <= 128
                   && !message.msgType.DosIsNullOrWhiteSpace()
                   && message.msgType.Length <= 64
                   && (message.time == null || message.time.Length <= 64);
        }

        private static bool IsSuccessfulDosResult(object value)
        {
            try
            {
                var token = value as JToken ?? JToken.FromObject(value);
                return token?["Code"]?.Value<int>() == 1;
            }
            catch
            {
                return false;
            }
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
