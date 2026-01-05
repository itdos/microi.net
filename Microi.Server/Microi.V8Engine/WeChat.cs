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
using Microi.Model.Aliyun;
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
        public string AesGcmDecrypt(string associated_data, string nonce, string ciphertext, string AES_KEY)
        {
            byte[] key = Encoding.UTF8.GetBytes(AES_KEY);
            byte[] nonceBytes = Encoding.UTF8.GetBytes(nonce);
            byte[] associatedDataBytes = associated_data == null ? null : Encoding.UTF8.GetBytes(associated_data);
            byte[] encryptedData = Convert.FromBase64String(ciphertext);

            // 分离密文和认证标签（假设标签长度为16字节）
            int cipherTextLength = encryptedData.Length - 16;
            byte[] cipherText = new byte[cipherTextLength];
            byte[] tag = new byte[16];
            Array.Copy(encryptedData, 0, cipherText, 0, cipherTextLength);
            Array.Copy(encryptedData, cipherTextLength, tag, 0, 16);

            var cipher = new GcmBlockCipher(new AesEngine());
            var parameters = new AeadParameters(
                new KeyParameter(key),
                128, // 认证标签长度（比特）
                nonceBytes,
                associatedDataBytes
            );
            cipher.Init(false, parameters); // false 表示解密

            // 处理密文
            byte[] plaintext = new byte[cipher.GetOutputSize(cipherText.Length)];
            int len = cipher.ProcessBytes(cipherText, 0, cipherText.Length, plaintext, 0);
            cipher.DoFinal(plaintext, len); // 验证标签并完成解密

            return Encoding.UTF8.GetString(plaintext);
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
                //     // 如果需要处理加密的私钥，这里需要密码，但你的场景似乎不需要
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