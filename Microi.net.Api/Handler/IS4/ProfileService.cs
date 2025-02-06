/*
using IdentityServer4.Services;
using IdentityServer4.Models;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    public class ProfileService : IProfileService
    {
        /// <summary>
        /// 请求http://AuthServer/connect/userinfo时会触发该方法
        /// </summary>
        /// <returns></returns>
        public async Task GetProfileDataAsync(ProfileDataRequestContext context)
        {
            var claims = context.Subject.Claims.ToList();
            context.IssuedClaims = claims.ToList();
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public async Task IsActiveAsync(IsActiveContext context)
        {
            context.IsActive = true;
        }
    }
}
*/