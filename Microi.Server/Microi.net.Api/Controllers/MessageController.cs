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
        public string OAuth(string code, string state)
        {
            Console.WriteLine($"Code:{code}");
            return code;
        }

        [HttpPost]
        [Route("Receive")]
        public dynamic Receive([FromBody] ChanjetEncryptMsg encryptMsg)
        {
            string enMsg = encryptMsg.GetEncryptMsg();

            string Key_encryptKey = "1234567890123456";

            Console.WriteLine($"解密前的消息{enMsg}");
            String decryptMsg = OpenapiHelper.AesDecrypt(enMsg, Key_encryptKey);
            Console.WriteLine($"解密后消息{decryptMsg}");

            MessageBase message = JsonHelper.Deserialize<MessageBase>(decryptMsg);
            object retObj = null;
            try
            {
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
            }
            catch (Exception ex)
            {
                throw;
            }
            return retObj;
        }

        private object DealOrderPayMsg(MessageBase message)
        {
            return ReceiveMsgOK();
        }

        private object DealOrgTempAuthMsg(MessageBase message)
        {
            OrgTempAuthContent content = JsonHelper.Deserialize<OrgTempAuthContent>(message.bizContent.ToString());
            Console.WriteLine($"OrgTempAuthCode:{content.tempAuthCode}");
            return ReceiveMsgOK();
        }

        private object DealTicketMsg(MessageBase message)
        {
            AppTicketContent content = JsonHelper.Deserialize<AppTicketContent>(message.bizContent.ToString());
            Console.WriteLine($"AppTicket:{content.appTicket}");
            return ReceiveMsgOK();
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