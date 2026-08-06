using System;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Microi.net.Api
{
    /// <summary>
    /// Protects platform-management endpoints whose effects are not safely
    /// expressible as ordinary menu visibility (jobs, queues, search indexes,
    /// data-source execution and host diagnostics).
    ///
    /// This is a server-side, non-overridable baseline.  Menu permissions may
    /// hide or further restrict these features, but can never grant them to a
    /// non-platform-administrator.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public sealed class PlatformAdminOnlyAttribute : TypeFilterAttribute
    {
        public PlatformAdminOnlyAttribute() : base(typeof(PlatformAdminOnlyFilter))
        {
        }
    }

    public sealed class PlatformAdminOnlyFilter : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            var currentUser = currentToken?.CurrentUser;

            var tokenClaimsAdmin = currentUser?["_IsAdmin"].Val<bool>() == true
                || currentUser?["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
            var isAdmin = tokenClaimsAdmin
                && PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    currentToken?.OsClient,
                    currentUser);

            if (!isAdmin)
            {
                context.Result = new ObjectResult(new DosResult(
                    0,
                    null,
                    DiyMessage.GetLang(currentToken?.OsClient, "NoAuth", null)))
                {
                    StatusCode = 403
                };
                return;
            }

            await next();
        }
    }
}
