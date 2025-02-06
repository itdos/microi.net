#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：IPHelper
* Copyright(c) www.iTdos.com
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2014/10/24 9:46:55
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using Microsoft.AspNetCore.Http;

#if NETSTANDARD
using Microsoft.Extensions.Primitives;
#endif


namespace Dos.Common
{
    /// <summary>
    /// IP帮助类
    /// </summary>
    public class IPHelper
    {
        private static bool IsIPAddress(string str)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(str) || str.Length < 7 || str.Length > 15)
                    return false;
                const string regformat = @"^\d{1,3}[\.]\d{1,3}[\.]\d{1,3}[\.]\d{1,3}{1}";
                var regex = new Regex(regformat, RegexOptions.IgnoreCase);
                return regex.IsMatch(str);
            }
            catch (Exception)
            {
                return false;
            }
        }

        public static string GetLocalhostIP()
        {
            try
            {
                string localIp = NetworkInterface.GetAllNetworkInterfaces()
                .Select(p => p.GetIPProperties())
                .SelectMany(p => p.UnicastAddresses)
                .FirstOrDefault(p => p.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(p.Address))?.Address.ToString();
                return localIp;
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }
#if NETFRAMEWORK
        /// <summary>
        /// 获取访问者IP地址
        /// </summary>
        /// <returns></returns>
        public static string GetClientIP()
        {
            var result = "";
            try
            {
                result = HttpContext.Current.Request.ServerVariables["HTTP_X_FORWARDED_FOR"];
                //可能有代理 
                if (!string.IsNullOrWhiteSpace(result))
                {
                    //没有"." 肯定是非IP格式
                    if (result.IndexOf(".", System.StringComparison.Ordinal) == -1)
                        result = "";
                    else
                    {
                        //有","，估计多个代理。取第一个不是内网的IP。
                        if (result.IndexOf(",", System.StringComparison.Ordinal) != -1)
                        {
                            result = result.Replace(" ", string.Empty).Replace("\"", string.Empty);
                            var temparyip = result.Split(",;".ToCharArray());
                            if (temparyip.Length > 0)
                            {
                                foreach (var t in temparyip.Where(t => IsIPAddress(t)
                                        && t.Substring(0, 3) != "10."
                                        && t.Substring(0, 7) != "192.168"
                                        && t.Substring(0, 7) != "172.16."))
                                {
                                    return t == "::1" ? "127.0.0.1" : t;
                                }
                            }
                        }
                        //代理即是IP格式
                        else if (IsIPAddress(result))
                            return result == "::1" ? "127.0.0.1" : result;
                        //代理中的内容非IP
                        else
                            result = "";
                    }
                }
                if (string.IsNullOrWhiteSpace(result))
                    result = HttpContext.Current.Request.ServerVariables["REMOTE_ADDR"];
                if (string.IsNullOrWhiteSpace(result))
                    result = HttpContext.Current.Request.UserHostAddress;
                return result == "::1" ? "127.0.0.1" : result;
            }
            catch (Exception)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(result))
                        result = HttpContext.Current.Request.ServerVariables["REMOTE_ADDR"];
                    if (string.IsNullOrWhiteSpace(result))
                        result = HttpContext.Current.Request.UserHostAddress;
                    return result == "::1" ? "127.0.0.1" : result;
                }
                catch (Exception ex)
                {
                    return "获取IP失败:" + ex.Message;
                }
            }
        }
#else
public static DosResult<string> GetClientIP(HttpContext context, bool tryUseXForwardHeader = true)
        {
            try
            {
                string ip = null;
                // todo support new "Forwarded" header (2014) https://en.wikipedia.org/wiki/X-Forwarded-For

                // X-Forwarded-For (csv list):  Using the First entry in the list seems to work
                // for 99% of cases however it has been suggested that a better (although tedious)
                // approach might be to read each IP from right to left and use the first public IP.
                // http://stackoverflow.com/a/43554000/538763
                //
                if (tryUseXForwardHeader)
                    ip = GetHeaderValueAs<string>(context, "X-Forwarded-For").SplitCsv().FirstOrDefault();

                // RemoteIpAddress is always null in DNX RC1 Update1 (bug).
                if (ip.DosIsNullOrWhiteSpace() && context?.Connection?.RemoteIpAddress != null)
                    ip = context.Connection.RemoteIpAddress.ToString();

                if (ip.DosIsNullOrWhiteSpace())
                    ip = GetHeaderValueAs<string>(context, "REMOTE_ADDR");

                // _httpContextAccessor.HttpContext?.Request?.Host this is the local host.

                if (ip.DosIsNullOrWhiteSpace())
                    throw new Exception("Unable to determine caller's IP.");

                return new DosResult<string>(1, ip);
            }
            catch (Exception e)
            {
                //LogHelper.Error(e.Message, "获取客户端IP地址失败_");
                return new DosResult<string>(0, null,  e.Message);
            }
        }

        public static T GetHeaderValueAs<T>(HttpContext context, string headerName)
        {
            StringValues values;

            if (context?.Request?.Headers?.TryGetValue(headerName, out values) ?? false)
            {
                string rawValues = values.ToString();   // writes out as Csv when there are multiple.

                if (!rawValues.DosIsNullOrWhiteSpace())
                    return (T)Convert.ChangeType(values.ToString(), typeof(T));
            }
            return default(T);
        }
#endif
        
    }
}