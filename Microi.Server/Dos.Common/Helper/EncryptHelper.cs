#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：EncryptHelper
* Copyright(c) www.iTdos.com
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2014/10/1 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
namespace Dos.Common
{
    public class EncryptHelper
    {
        /// <summary>
        /// 密钥
        /// </summary>
        public static readonly string _Key = "itdoscom";
        /// <summary>
        /// DES加密字符串
        /// </summary>
        /// <Param name="encryptString">待加密的字符串</Param>
        /// <Param name="Key">8位加密Key</Param>
        /// <returns>加密成功返回加密后的字符串，失败返回源串</returns>
        public static string DESEncode(string encryptString, string Key)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(Key) || Key.Length != 8)
                {
                    Key = _Key;
                }
                var inputByteArray = Encoding.UTF8.GetBytes(encryptString);

                using (var des = new DESCryptoServiceProvider())
                {
                    des.Key = Encoding.ASCII.GetBytes(Key);
                    des.Mode = CipherMode.ECB;

                    using (var mStream = new MemoryStream())
                    using (var cStream = new CryptoStream(mStream, des.CreateEncryptor(), CryptoStreamMode.Write))
                    {
                        cStream.Write(inputByteArray, 0, inputByteArray.Length);
                        cStream.FlushFinalBlock();
                        return Convert.ToBase64String(mStream.ToArray());
                    }
                }
            }
            catch (Exception)
            {
                return encryptString;
            }
        }
        public static string SHA256(string encryptString)
        {
            try
            {
                if (string.IsNullOrEmpty(encryptString))
                    return encryptString;

                using (var sha = System.Security.Cryptography.SHA256.Create())
                {
                    var bytes = Encoding.UTF8.GetBytes(encryptString);
                    var hash = sha.ComputeHash(bytes);
                    return BitConverter.ToString(hash).Replace("-", "");
                }
            }
            catch (Exception)
            {
                return encryptString;
            }
        }
        public static string SHA1(string encryptString)
        {
            try
            {
                if (string.IsNullOrEmpty(encryptString))
                    return encryptString;

                using (var sha = System.Security.Cryptography.SHA1.Create())
                {
                    var bytes = Encoding.UTF8.GetBytes(encryptString);
                    var hash = sha.ComputeHash(bytes);
                    return BitConverter.ToString(hash).Replace("-", "");
                }
            }
            catch (Exception)
            {
                return encryptString;
            }
        }
        public static string SHA512(string input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;

            using (var sha = System.Security.Cryptography.SHA512.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hash = sha.ComputeHash(bytes);
                return BitConverter.ToString(hash).Replace("-", "");
            }
        }

        /// <summary>
        /// DES加密字符串
        /// </summary>
        /// <Param name="encryptString">待加密的字符串</Param>
        /// <returns>加密成功返回加密后的字符串，失败返回源串</returns>
        public static string DESEncode(string encryptString)
        {
            try
            {
                return DESEncode(encryptString, "");
            }
            catch
            {
                return encryptString;
            }
        }
        /// <summary>
        /// DES解密字符串
        /// </summary>
        /// <Param name="decryptString">待解密的字符串</Param>
        /// <Param name="Key">8位解密Key</Param>
        /// <returns>解密成功返回解密后的字符串，失败返源串</returns>
        public static string DESDecode(string decryptString, string Key)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(Key) || Key.Length != 8)
                {
                    Key = _Key;
                }
                byte[] inputByteArray = Convert.FromBase64String(decryptString);

                using (var des = new DESCryptoServiceProvider())
                {
                    des.Key = Encoding.ASCII.GetBytes(Key);
                    des.Mode = CipherMode.ECB;

                    using (var mStream = new MemoryStream())
                    using (var cStream = new CryptoStream(mStream, des.CreateDecryptor(), CryptoStreamMode.Write))
                    {
                        cStream.Write(inputByteArray, 0, inputByteArray.Length);
                        cStream.FlushFinalBlock();
                        return Encoding.UTF8.GetString(mStream.ToArray());
                    }
                }
            }
            catch
            {
                return decryptString;
            }
        }
        /// <summary>
        /// DES解密字符串
        /// </summary>
        /// <Param name="decryptString">待解密的字符串</Param>
        /// <returns>解密成功返回解密后的字符串，失败返源串</returns>
        public static string DESDecode(string decryptString)
        {
            try
            {
                return DESDecode(decryptString, "");
            }
            catch
            {
                return decryptString;
            }
        }

        /// <summary>
        /// AES-256-CBC encryption with HMAC-SHA256 integrity protection.
        /// The caller-provided key is expanded into independent encryption and MAC keys.
        /// </summary>
        public static string AESEncrypt(string plainText, string key)
        {
            if (plainText == null)
            {
                return null;
            }
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new ArgumentException("AES key cannot be empty.", nameof(key));
            }

            byte[] keyMaterial;
            using (var sha512 = System.Security.Cryptography.SHA512.Create())
            {
                keyMaterial = sha512.ComputeHash(Encoding.UTF8.GetBytes(key));
            }

            var encryptionKey = new byte[32];
            var macKey = new byte[32];
            Buffer.BlockCopy(keyMaterial, 0, encryptionKey, 0, encryptionKey.Length);
            Buffer.BlockCopy(keyMaterial, encryptionKey.Length, macKey, 0, macKey.Length);

            byte[] iv = new byte[16];
            using (var random = RandomNumberGenerator.Create())
            {
                random.GetBytes(iv);
            }

            byte[] cipherBytes;
            using (var aes = Aes.Create())
            {
                aes.Key = encryptionKey;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                using (var encryptor = aes.CreateEncryptor())
                {
                    var plainBytes = Encoding.UTF8.GetBytes(plainText);
                    cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
                }
            }

            var authenticatedBytes = new byte[1 + iv.Length + cipherBytes.Length];
            authenticatedBytes[0] = 1;
            Buffer.BlockCopy(iv, 0, authenticatedBytes, 1, iv.Length);
            Buffer.BlockCopy(cipherBytes, 0, authenticatedBytes, 1 + iv.Length, cipherBytes.Length);

            byte[] mac;
            using (var hmac = new HMACSHA256(macKey))
            {
                mac = hmac.ComputeHash(authenticatedBytes);
            }

            var payload = new byte[authenticatedBytes.Length + mac.Length];
            Buffer.BlockCopy(authenticatedBytes, 0, payload, 0, authenticatedBytes.Length);
            Buffer.BlockCopy(mac, 0, payload, authenticatedBytes.Length, mac.Length);
            return "aes1:" + Convert.ToBase64String(payload);
        }

        /// <summary>
        /// Decrypts values produced by AESEncrypt and rejects modified ciphertext.
        /// </summary>
        public static string AESDecrypt(string encryptedText, string key)
        {
            if (encryptedText == null)
            {
                return null;
            }
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new ArgumentException("AES key cannot be empty.", nameof(key));
            }
            if (!encryptedText.StartsWith("aes1:", StringComparison.Ordinal))
            {
                throw new CryptographicException("Unsupported AES payload format.");
            }

            var payload = Convert.FromBase64String(encryptedText.Substring(5));
            const int versionAndIvLength = 17;
            const int macLength = 32;
            if (payload.Length <= versionAndIvLength + macLength || payload[0] != 1)
            {
                throw new CryptographicException("Invalid AES payload.");
            }

            byte[] keyMaterial;
            using (var sha512 = System.Security.Cryptography.SHA512.Create())
            {
                keyMaterial = sha512.ComputeHash(Encoding.UTF8.GetBytes(key));
            }

            var encryptionKey = new byte[32];
            var macKey = new byte[32];
            Buffer.BlockCopy(keyMaterial, 0, encryptionKey, 0, encryptionKey.Length);
            Buffer.BlockCopy(keyMaterial, encryptionKey.Length, macKey, 0, macKey.Length);

            var authenticatedLength = payload.Length - macLength;
            var authenticatedBytes = new byte[authenticatedLength];
            var suppliedMac = new byte[macLength];
            Buffer.BlockCopy(payload, 0, authenticatedBytes, 0, authenticatedLength);
            Buffer.BlockCopy(payload, authenticatedLength, suppliedMac, 0, macLength);

            byte[] expectedMac;
            using (var hmac = new HMACSHA256(macKey))
            {
                expectedMac = hmac.ComputeHash(authenticatedBytes);
            }
            if (!CryptographicOperations.FixedTimeEquals(expectedMac, suppliedMac))
            {
                throw new CryptographicException("AES payload integrity check failed.");
            }

            var iv = new byte[16];
            Buffer.BlockCopy(authenticatedBytes, 1, iv, 0, iv.Length);
            var cipherLength = authenticatedLength - versionAndIvLength;
            var cipherBytes = new byte[cipherLength];
            Buffer.BlockCopy(authenticatedBytes, versionAndIvLength, cipherBytes, 0, cipherLength);

            using (var aes = Aes.Create())
            {
                aes.Key = encryptionKey;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                using (var decryptor = aes.CreateDecryptor())
                {
                    var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
                    return Encoding.UTF8.GetString(plainBytes);
                }
            }
        }

        public static string MD5Encrypt(string str, int code)
        {
            using (var md5 = MD5.Create())
            {
                var result = md5.ComputeHash(Encoding.UTF8.GetBytes(str));
                var strResult = BitConverter.ToString(result);
                var md5str = strResult.Replace("-", "");
                if (code == 16) //16位MD5加密（取32位加密的9~25字符）
                {
                    return md5str.ToLower().Substring(8, 16);
                }
                else if (code == 32) //32位加密  
                {
                    return md5str.ToLower();
                }
                else
                {
                    return md5str.ToLower();
                }
            }
        }
        public static string MD5Encrypt(string str)
        {
            return MD5Encrypt(str, 32);
        }
        /// <summary>
        /// 获取大写的MD5签名结果
        /// </summary>
        /// <param name="encypStr"></param>
        /// <param name="charset">默认值：utf-8</param>
        /// <returns></returns>
        public static string MD5EncryptWeChat(string encypStr, string charset = "")
        {
            var m5 = new MD5CryptoServiceProvider();
            //创建md5对象
            byte[] inputBye;
            //使用GB2312编码方式把字符串转化为字节数组．
            if (!string.IsNullOrWhiteSpace(charset))
            {
                inputBye = Encoding.GetEncoding(charset).GetBytes(encypStr);
            }
            else
            {
                inputBye = Encoding.GetEncoding("utf-8").GetBytes(encypStr);
            }
            var outputBye = m5.ComputeHash(inputBye);
            var retStr = BitConverter.ToString(outputBye);
            retStr = retStr.Replace("-", "").ToUpper();
            return retStr;
        }

        public static string Sha256Hex(string s)
        {
            using (SHA256 algo = System.Security.Cryptography.SHA256.Create())
            {
                byte[] hashbytes = algo.ComputeHash(Encoding.UTF8.GetBytes(s));
                StringBuilder builder = new StringBuilder();
                for (int i = 0; i < hashbytes.Length; ++i)
                {
                    builder.Append(hashbytes[i].ToString("x2"));
                }
                return builder.ToString();
            }
        }

        public static byte[] HmacSha256(byte[] key, byte[] msg)
        {
            using (HMACSHA256 mac = new HMACSHA256(key))
            {
                return mac.ComputeHash(msg);
            }
        }

        /// <summary>
        /// RSA加密
        /// </summary>
        /// <param name="plainText">待加密的明文</param>
        /// <param name="publicKey">PEM格式公钥或Base64格式公钥</param>
        /// <returns>加密后的密文（Base64）</returns>
        public static string RSAEncrypt(string plainText, string publicKey)
        {
            try
            {
                using (var rsa = RSA.Create())
                {
                    byte[] publicKeyBytes;
                    
                    // 移除PEM头尾并转换为字节数组
                    if (publicKey.Contains("BEGIN"))
                    {
                        var pemContent = publicKey
                            .Replace("-----BEGIN PUBLIC KEY-----", "")
                            .Replace("-----END PUBLIC KEY-----", "")
                            .Replace("-----BEGIN RSA PUBLIC KEY-----", "")
                            .Replace("-----END RSA PUBLIC KEY-----", "")
                            .Replace("\r", "")
                            .Replace("\n", "")
                            .Trim();
                        publicKeyBytes = Convert.FromBase64String(pemContent);
                    }
                    else
                    {
                        publicKeyBytes = Convert.FromBase64String(publicKey);
                    }
                    
                    // 导入公钥 - 支持 X.509 SubjectPublicKeyInfo 格式
                    rsa.ImportSubjectPublicKeyInfo(publicKeyBytes, out _);
                    
                    // 加密
                    var plainBytes = Encoding.UTF8.GetBytes(plainText);
                    var encryptedBytes = rsa.Encrypt(plainBytes, RSAEncryptionPadding.Pkcs1);
                    
                    return Convert.ToBase64String(encryptedBytes);
                }
            }
            catch (Exception ex)
            {
                // 加密失败返回原文
                System.Diagnostics.Debug.WriteLine($"[RSAEncrypt] 加密失败: {ex.Message}");
                return plainText;
            }
        }

        /// <summary>
        /// RSA解密
        /// </summary>
        /// <param name="encryptedText">加密的密文（Base64）</param>
        /// <param name="privateKey">PEM格式私钥</param>
        /// <returns>解密后的明文</returns>
        public static string RSADecrypt(string encryptedText, string privateKey)
        {
            try
            {
                using (var rsa = RSA.Create())
                {
                    byte[] privateKeyBytes;
                    bool isPkcs1 = false;
                    
                    // 移除PEM头尾并转换为字节数组
                    if (privateKey.Contains("BEGIN RSA PRIVATE KEY"))
                    {
                        // PKCS#1 格式
                        isPkcs1 = true;
                        var pemContent = privateKey
                            .Replace("-----BEGIN RSA PRIVATE KEY-----", "")
                            .Replace("-----END RSA PRIVATE KEY-----", "")
                            .Replace("\r", "")
                            .Replace("\n", "")
                            .Trim();
                        privateKeyBytes = Convert.FromBase64String(pemContent);
                    }
                    else if (privateKey.Contains("BEGIN PRIVATE KEY"))
                    {
                        // PKCS#8 格式
                        var pemContent = privateKey
                            .Replace("-----BEGIN PRIVATE KEY-----", "")
                            .Replace("-----END PRIVATE KEY-----", "")
                            .Replace("\r", "")
                            .Replace("\n", "")
                            .Trim();
                        privateKeyBytes = Convert.FromBase64String(pemContent);
                    }
                    else
                    {
                        privateKeyBytes = Convert.FromBase64String(privateKey);
                    }
                    
                    // 导入私钥
                    if (isPkcs1)
                    {
                        rsa.ImportRSAPrivateKey(privateKeyBytes, out _);
                    }
                    else
                    {
                        rsa.ImportPkcs8PrivateKey(privateKeyBytes, out _);
                    }
                    
                    // 解密
                    var encryptedBytes = Convert.FromBase64String(encryptedText);
                    
                    var decryptedBytes = rsa.Decrypt(encryptedBytes, RSAEncryptionPadding.Pkcs1);
                    
                    var result = Encoding.UTF8.GetString(decryptedBytes);
                    
                    return result;
                }
            }
            catch (Exception ex)
            {
                // 解密失败返回原文
                System.Diagnostics.Debug.WriteLine($"[RSADecrypt] 解密失败: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"[RSADecrypt] 异常类型: {ex.GetType().Name}");
                System.Diagnostics.Debug.WriteLine($"[RSADecrypt] 堆栈: {ex.StackTrace}");
                return encryptedText;
            }
        }


        /// <summary>
        /// 判断字符串是否是RSA加密的密文
        /// </summary>
        /// <param name="text">待判断的字符串</param>
        /// <returns>是否为RSA密文</returns>
        public static bool IsRSAEncrypted(string text)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(text))
                    return false;

                // RSA加密后的Base64字符串通常长度较长（至少172个字符用于1024位密钥）
                if (text.Length < 100)
                    return false;

                // 尝试解析为Base64
                var bytes = Convert.FromBase64String(text);

                // RSA加密结果的长度应该是128字节（1024位）或256字节（2048位）
                return bytes.Length == 128 || bytes.Length == 256;
            }
            catch
            {
                return false;
            }
        }
    }
}
