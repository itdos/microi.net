using System;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net;

public partial class V8EngineParam
{
    public partial class V8Method
    {
        public string AesGcmDecrypt(string associated_data, string nonce, string ciphertext, string AES_KEY)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(AES_KEY);
            byte[] bytes2 = Encoding.UTF8.GetBytes(nonce);
            byte[] associatedData = ((associated_data == null) ? null : Encoding.UTF8.GetBytes(associated_data));
            byte[] array = Convert.FromBase64String(ciphertext);
            byte[] subArray = array[..^16];
            byte[] subArray2 = array[^16..];
            byte[] array2 = new byte[subArray.Length];
            using AesGcm aesGcm = new AesGcm(bytes);
            aesGcm.Decrypt(bytes2, subArray, subArray2, array2, associatedData);
            return Encoding.UTF8.GetString(array2);
            return "";
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public string GetWeChatSign(string privateKey, string[] paramList)
        {
            var message = "";
            foreach (var param in paramList)
            {
                message += param + "\n";
            }
            byte[] data = System.Text.Encoding.UTF8.GetBytes(message);

            // NOTE： 私钥不包括私钥文件起始的-----BEGIN PRIVATE KEY-----
            //        亦不包括结尾的-----END PRIVATE KEY-----
            byte[] keyData = Convert.FromBase64String(privateKey);
            var rsa = RSA.Create();
            //适用该方法的版本https://learn.microsoft.com/zh-cn/dotnet/api/system.security.cryptography.asymmetricalgorithm.importpkcs8privatekey?view=net-7.0
            rsa.ImportPkcs8PrivateKey(keyData, out _);
            rsa.ImportPkcs8PrivateKey(keyData, out _);
            var signature = Convert.ToBase64String(rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));

            return signature;
        }
        /// <summary>
            /// 用于指定微信接口 Authorization 请求头，返回string
            /// </summary>
            /// <param name="mchid">支付商户Id</param>
            /// <param name="serialNo">商户API证书序列号serial_no，用于声明所使用的证书</param>
            /// <param name="privateKey">私有key</param>
            /// <param name="wxApiAddress">请求的微信接口地址</param>
            /// <param name="body">请求方法为GET时，报文主体为空。  当请求方法为POST或PUT时，请使用真实发送的JSON报文。</param>
            /// <returns></returns>
            public string GetWeChatAuthorization(string mchid, string serialNo, string privateKey, string wxApiAddress, string body)
            {
                var method = "POST";//微信接口的请求方式
                var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();//时间戳
                string nonce = Path.GetRandomFileName();//随机字符串

                string message = $"{method}\n{wxApiAddress}\n{timestamp}\n{nonce}\n{body}\n";

                // NOTE： 私钥不包括私钥文件起始的-----BEGIN PRIVATE KEY-----
                //        亦不包括结尾的-----END PRIVATE KEY-----
                byte[] keyData = Convert.FromBase64String(privateKey);

                var rsa = RSA.Create();
                //适用该方法的版本https://learn.microsoft.com/zh-cn/dotnet/api/system.security.cryptography.asymmetricalgorithm.importpkcs8privatekey?view=net-7.0
                rsa.ImportPkcs8PrivateKey(keyData, out _);
                rsa.ImportPkcs8PrivateKey(keyData, out _);
                byte[] data = System.Text.Encoding.UTF8.GetBytes(message);
                var signature = Convert.ToBase64String(rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));


                var auth = $"mchid=\"{mchid}\",nonce_str=\"{nonce}\",timestamp=\"{timestamp}\",serial_no=\"{serialNo}\",signature=\"{signature}\"";

                string value = $"WECHATPAY2-SHA256-RSA2048 {auth}";
                return value;
            }
    }
}
