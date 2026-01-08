using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using Dos.Common;

namespace Microi.net
{
    public partial class DiyTokenExtend
    {
         /// <summary>
        /// 获取当前 OsClient
        /// </summary>
        /// <returns></returns>
        public static string GetCurrentOsClient(Microsoft.AspNetCore.Http.HttpContext _context = null)
        {
            try
            {
                var context = DiyHttpContext.Current;
                if(context == null)
                {
                    context = _context;
                }
                if(context == null)
                {
                    return OsClientExtend.GetConfigOsClient();
                    return "";
                }
                var claims = context.User.Claims;
                //.NET8
                var token = context.Request.Headers["authorization"].ToString();
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                    }
                    catch (System.Exception)
                    {
                        
                    }
                }

                var osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if (osClient == null)
                {
                    if (_context != null)
                    {
                        claims = _context.User.Claims;
                        //.NET8
                        token = _context.Request.Headers["Authorization"].ToString();
                        if(token.DosIsNullOrWhiteSpace())
                        {
                            token = _context.Request.Headers["authorization"].ToString();
                        }
                        if (!token.DosIsNullOrWhiteSpace())
                        {
                            try
                            {
                                claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                            }
                            catch (System.Exception)
                            {
                                
                            }
                        }

                        osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;   
                        if (osClient == null)
                        {
                            return OsClientExtend.GetConfigOsClient();
                            return "";
                        }
                    }
                    return OsClientExtend.GetConfigOsClient();
                    return "";
                }
                return osClient;
            }
            catch (Exception ex)
            {
                
                return OsClientExtend.GetConfigOsClient();
                return "";
            }
        }
    }
}
