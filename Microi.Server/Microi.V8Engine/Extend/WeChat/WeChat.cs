using System;
using System.IO;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net;
using System.Net.Mime;
using Aop.Api;
using Aop.Api.Request;
using Aop.Api.Response;
using Aop.Api.Domain;
using Aop.Api.Util;
using Dos.Common;
using System.Threading.Tasks;
using System.Text;
using Org.BouncyCastle.Crypto.Engines;
using Org.BouncyCastle.Crypto.Modes;
using Org.BouncyCastle.Crypto.Parameters;
using System.Security.Cryptography;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;

namespace Microi.net
{
    /// <summary>
    /// V8引擎扩展封装V8.WeChat。注意项目源码中的【Microi.WeChat】类库项目是后端二次开发，并非给V8引擎使用
    /// </summary>
    public class WeChat
    {
        /// <summary>
        /// 解密微信支付 API v3 回调资源。
        /// </summary>
        /// <remarks>
        /// nonce 是 12 字节 UTF-8 原文，不是 Base64；ciphertext 才是 Base64，
        /// 其解码结果末尾包含 GCM 所需的 16 字节认证标签。
        /// </remarks>
        public string AesGcmDecrypt(string associated_data, string nonce, string ciphertext, string AES_KEY)
        {
            if (AES_KEY == null)
            {
                throw new ArgumentNullException(nameof(AES_KEY));
            }
            if (nonce == null)
            {
                throw new ArgumentNullException(nameof(nonce));
            }
            if (ciphertext == null)
            {
                throw new ArgumentNullException(nameof(ciphertext));
            }

            byte[] key = Encoding.UTF8.GetBytes(AES_KEY);
            if (key.Length != 32)
            {
                throw new ArgumentException("微信支付 APIv3 密钥必须是 32 字节 UTF-8 文本。", nameof(AES_KEY));
            }

            byte[] nonceBytes = Encoding.UTF8.GetBytes(nonce);
            if (nonceBytes.Length != 12)
            {
                throw new ArgumentException("微信支付 resource.nonce 必须是 12 字节 UTF-8 文本。", nameof(nonce));
            }

            byte[] associatedDataBytes = Encoding.UTF8.GetBytes(associated_data ?? string.Empty);
            byte[] encryptedData = Convert.FromBase64String(ciphertext);
            const int tagLengthBytes = 16;
            if (encryptedData.Length <= tagLengthBytes)
            {
                throw new ArgumentException("微信支付 resource.ciphertext 必须包含密文和 16 字节认证标签。", nameof(ciphertext));
            }

            var cipher = new GcmBlockCipher(new AesEngine());
            var parameters = new AeadParameters(
                new KeyParameter(key),
                tagLengthBytes * 8,
                nonceBytes,
                associatedDataBytes
            );
            cipher.Init(false, parameters);

            // BouncyCastle 解密时必须接收“密文 + 尾部认证标签”的完整字节串，否则无法校验 GCM 标签。
            byte[] plaintext = new byte[cipher.GetOutputSize(encryptedData.Length)];
            int plaintextLength = cipher.ProcessBytes(encryptedData, 0, encryptedData.Length, plaintext, 0);
            plaintextLength += cipher.DoFinal(plaintext, plaintextLength);

            return Encoding.UTF8.GetString(plaintext, 0, plaintextLength);
        }


        public string GetWeChatSign(string privateKey, string[] paramList)
        {
            var message = string.Join("\n", paramList) + "\n"; // 更高效的字符串拼接
            byte[] data = Encoding.UTF8.GetBytes(message);

            // 使用 BouncyCastle 解析 PEM 格式的私钥（支持 PKCS#8）
            AsymmetricKeyParameter asymmetricKey;
            using (var reader = new StringReader(privateKey))
            {
                // 处理 PEM 格式的私钥（包含 "-----BEGIN PRIVATE KEY-----" 头部和 "-----END PRIVATE KEY-----" 尾部）
                PemReader pemReader = new PemReader(reader);
                object keyObject = pemReader.ReadObject();

                if (keyObject is AsymmetricCipherKeyPair keyPair)
                {
                    // PKCS#1 格式的私钥通常位于 KeyPair 中
                    asymmetricKey = keyPair.Private;
                }
                else if (keyObject is RsaPrivateCrtKeyParameters)
                {
                    // 直接读取的 PKCS#1 格式私钥
                    asymmetricKey = (AsymmetricKeyParameter)keyObject;
                }
                // else if (keyObject is Org.BouncyCastle.Pkcs.EncryptedPrivateKeyInfo) 
                // {
                //     // 如果需要处理加密的私钥，这里需要密码，但这里场景似乎不需要
                //     throw new NotSupportedException("Encrypted private keys are not supported in this method.");
                // }
                else
                {
                    throw new InvalidOperationException("Unsupported private key format. Expected PKCS#1 or PKCS#8.");
                }
            }

            // 将 BouncyCastle 私钥转换为 .NET RSA 参数
            RsaPrivateCrtKeyParameters rsaParams = (RsaPrivateCrtKeyParameters)asymmetricKey;
            RSAParameters dotNetRsaParams = DotNetUtilities.ToRSAParameters(rsaParams);

            // 使用 .NET RSA 进行签名
            using (RSACryptoServiceProvider rsa = new RSACryptoServiceProvider())
            {
                rsa.ImportParameters(dotNetRsaParams);
                byte[] signatureBytes = rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                return Convert.ToBase64String(signatureBytes);
            }
        }

        public string GetWeChatAuthorization(string mchid, string serialNo, string privateKey, string wxApiAddress, string body)
        {
            var method = "POST";
            var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds().ToString();
            string nonce = Path.GetRandomFileName().Replace(".", ""); // 移除路径分隔符，得到更干净的随机字符串

            string message = $"{method}\n{wxApiAddress}\n{timestamp}\n{nonce}\n{body}\n";
            byte[] data = Encoding.UTF8.GetBytes(message);

            // 使用 BouncyCastle 解析 PEM 格式的私钥（支持 PKCS#8）
            AsymmetricKeyParameter asymmetricKey;
            using (var reader = new StringReader(privateKey))
            {
                PemReader pemReader = new PemReader(reader);
                object keyObject = pemReader.ReadObject();

                if (keyObject is AsymmetricCipherKeyPair keyPair)
                {
                    asymmetricKey = keyPair.Private;
                }
                else if (keyObject is RsaPrivateCrtKeyParameters)
                {
                    asymmetricKey = (AsymmetricKeyParameter)keyObject;
                }
                else
                {
                    throw new InvalidOperationException("Unsupported private key format.");
                }
            }

            // 将 BouncyCastle 私钥转换为 .NET RSA 参数
            RsaPrivateCrtKeyParameters rsaParams = (RsaPrivateCrtKeyParameters)asymmetricKey;
            RSAParameters dotNetRsaParams = DotNetUtilities.ToRSAParameters(rsaParams);

            // 使用 .NET RSA 进行签名
            using (RSACryptoServiceProvider rsa = new RSACryptoServiceProvider())
            {
                rsa.ImportParameters(dotNetRsaParams);
                byte[] signatureBytes = rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                string signature = Convert.ToBase64String(signatureBytes);

                // 构造 Authorization header
                return $"WECHATPAY2-SHA256-RSA2048 mchid=\"{mchid}\",nonce_str=\"{nonce}\",timestamp=\"{timestamp}\",serial_no=\"{serialNo}\",signature=\"{signature}\"";
            }
        }

        public static string RSAEncryptHasBegin(string text, string publicKeyPem)
        {
            // 解析 PEM 格式的公钥
            var base64Key = publicKeyPem
                .Replace("-----BEGIN PUBLIC KEY-----", "")
                .Replace("-----END PUBLIC KEY-----", "")
                .Replace("\n", "")
                .Replace("\r", "")
                .Trim();

            var publicKeyBytes = Convert.FromBase64String(base64Key);

            using (var rsa = RSA.Create())
            {
                rsa.ImportSubjectPublicKeyInfo(publicKeyBytes, out _);

                var encryptedBytes = rsa.Encrypt(Encoding.UTF8.GetBytes(text), RSAEncryptionPadding.Pkcs1);
                return Convert.ToBase64String(encryptedBytes);
            }
        }
        public static string RSAEncrypt(string text, string publicKeyPem)
        {
            // 如果已经是纯Base64字符串（不包含PEM头尾），直接使用
            if (!publicKeyPem.Contains("BEGIN PUBLIC KEY"))
            {
                // 假设传入的是Base64字符串
                var publicKeyBytes = Convert.FromBase64String(publicKeyPem);
                using (var rsa = RSA.Create())
                {
                    rsa.ImportSubjectPublicKeyInfo(publicKeyBytes, out _);
                    var encryptedBytes = rsa.Encrypt(Encoding.UTF8.GetBytes(text), RSAEncryptionPadding.Pkcs1);
                    return Convert.ToBase64String(encryptedBytes);
                }
            }

            // 否则按PEM格式解析
            return RSAEncryptHasBegin(text, publicKeyPem);
        }
    }
}
