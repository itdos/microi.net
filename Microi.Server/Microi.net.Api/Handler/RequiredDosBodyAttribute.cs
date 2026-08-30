using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Reflection;
using Dos.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Microi.net.Api
{
    /// <summary>
    /// Converts a missing non-optional reference-type request body into the
    /// standard DosResult before the action can dereference it. Parameters with
    /// a default value remain optional for legacy GET/POST compatibility routes.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public class RequiredDosBodyAttribute : ActionFilterAttribute
    {
        private static readonly ConcurrentDictionary<MethodInfo, string[]> RequiredBodyParameters
            = new ConcurrentDictionary<MethodInfo, string[]>();

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            if (context?.ActionDescriptor is not ControllerActionDescriptor descriptor) return;

            var requiredNames = RequiredBodyParameters.GetOrAdd(
                descriptor.MethodInfo,
                ResolveRequiredBodyParameters);
            foreach (var name in requiredNames)
            {
                if (context.ActionArguments.TryGetValue(name, out var value) && value != null) continue;
                context.Result = new OkObjectResult(new DosResult(0, null, "请求参数不能为空"));
                return;
            }
        }

        private static string[] ResolveRequiredBodyParameters(MethodInfo method)
        {
            return method.GetParameters()
                .Where(parameter => !parameter.HasDefaultValue
                                    && !parameter.ParameterType.IsValueType
                                    && parameter.GetCustomAttribute<FromBodyAttribute>(true) != null)
                .Select(parameter => parameter.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToArray();
        }
    }
}
