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
#if NETFRAMEWORK
using System.Web.Security;
#endif
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
                var des = new DESCryptoServiceProvider();
                des.Key = Encoding.ASCII.GetBytes(Key);
                des.Mode = CipherMode.ECB;
                var mStream = new MemoryStream();
                var cStream = new CryptoStream(mStream, des.CreateEncryptor(), CryptoStreamMode.Write);
                cStream.Write(inputByteArray, 0, inputByteArray.Length);
                cStream.FlushFinalBlock();
                return Convert.ToBase64String(mStream.ToArray());
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
                if (String.IsNullOrEmpty(encryptString))
                    return encryptString;
                using (var sha = System.Security.Cryptography.SHA256.Create())
                {
                    var bytes = Encoding.UTF8.GetBytes(encryptString);
                    var hash = sha.ComputeHash(bytes);
                    //return Convert.ToBase64String(hash);
                    var result = BitConverter.ToString(hash).Replace("-", "");
                    return result;
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
                if (String.IsNullOrEmpty(encryptString))
                    return encryptString;
                using (var sha = System.Security.Cryptography.SHA1.Create())
                {
                    var bytes = Encoding.UTF8.GetBytes(encryptString);
                    var hash = sha.ComputeHash(bytes);
                    //return Convert.ToBase64String(hash);
                    var result = BitConverter.ToString(hash).Replace("-", "");
                    return result;
                }
            }
            catch (Exception)
            {
                return encryptString;
            }
        }
        public static string SHA512(string input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            using (var sha = System.Security.Cryptography.SHA512.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hash = sha.ComputeHash(bytes);
                //return Convert.ToBase64String(hash);
                var result = BitConverter.ToString(hash).Replace("-", "");
                return result;
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
                return DESEncode(encryptString,"");
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
        public static string DESDecode(string decryptString,string Key)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(Key) || Key.Length != 8)
                {
                    Key = _Key;
                }
                byte[] inputByteArray = Convert.FromBase64String(decryptString);
                var des = new DESCryptoServiceProvider();
                des.Key = Encoding.ASCII.GetBytes(Key);
                des.Mode = CipherMode.ECB;
                var mStream = new MemoryStream();
                var cStream = new CryptoStream(mStream, des.CreateDecryptor(), CryptoStreamMode.Write);
                cStream.Write(inputByteArray, 0, inputByteArray.Length);
                cStream.FlushFinalBlock();
                return Encoding.UTF8.GetString(mStream.ToArray());
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
                return DESDecode(decryptString,"");
            }
            catch
            {
                return decryptString;
            }
        }
#if NETFRAMEWORK
        /// <summary>
        /// MD5加密，返回MD5 16位或32位加密后的字符串，默认返回32位。code输入16或32
        /// </summary>
        /// <Param name="str">原始字符串</Param>
        /// <Param name="code">MD5返回16位还是32位？请输入16或32</Param>
        public static string MD5Encrypt(string str, int code)
        {
            if (code == 16) //16位MD5加密（取32位加密的9~25字符）
            {
                return FormsAuthentication.HashPasswordForStoringInConfigFile(str, "MD5").ToLower().Substring(8, 16);
            }
            else if (code == 32) //32位加密  
            {
                return FormsAuthentication.HashPasswordForStoringInConfigFile(str, "MD5").ToLower();
            }
            else
            {
                 return FormsAuthentication.HashPasswordForStoringInConfigFile(str, "MD5").ToLower();
            }
        }
        /// <summary>
        /// MD5加密，返回MD5 16位或32位加密后的字符串，默认返回16位。
        /// </summary>
        /// <Param name="str">原始字符串</Param>
        public static string MD5Encrypt(string str)
        {
            return FormsAuthentication.HashPasswordForStoringInConfigFile(str, "MD5").ToLower().Substring(8, 32);
        }
#else
        public static string MD5Encrypt( string str, int code)
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
#endif
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
    }
}
