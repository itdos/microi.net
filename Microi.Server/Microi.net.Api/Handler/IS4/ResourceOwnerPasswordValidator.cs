/*
using IdentityModel;
using IdentityServer4.Models;
using IdentityServer4.Validation;
using System.Linq;
using System.Security.Claims;
using Dos.Common;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    public class ResourceOwnerPasswordValidator : IResourceOwnerPasswordValidator
    {
        public ResourceOwnerPasswordValidator()
        {

        }
        /// <summary>
        /// 调用http://AuthServer/connect/token时会触发此方法
        /// </summary>
        /// <param name="context"></param>
        /// <returns></returns>
        public async Task ValidateAsync(ResourceOwnerPasswordValidationContext context)
        {
            // var userAccount = context.Request.Raw["UserAccount"].DosIsNullOrWhiteSpace()
            //                         ? context.UserName : context.Request.Raw["UserAccount"];
            if(context.UserName.DosIsNullOrWhiteSpace())
            {
                context.Result = new GrantValidationResult(TokenRequestErrors.InvalidRequest, "Auth签名错误！");
            }
            else
            {
                context.Result = new GrantValidationResult(
                    subject: context.UserName,
                    authenticationMethod: "custom",
                    claims:
                        [
                            new Claim("Id", context.UserName),
                            new Claim("UserId", context.Request.ClientId),//context.UserName
                            // new Claim("OsClient", context.Request.ClientId),
                            // new Claim(JwtClaimTypes.Name, context.UserName),
                        ],
                    customResponse : new Dictionary<string, object>{ 
                        { "OsClient", context.Request.ClientId } 
                    }
                );
            }

        }
    }
}
*/