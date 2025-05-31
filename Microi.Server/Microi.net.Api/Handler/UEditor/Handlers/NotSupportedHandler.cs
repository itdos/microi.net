#if NETSTANDARD || NETCOREAPP
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif

namespace Microi.net
{
    /// <summary>
    /// NotSupportedHandler 的摘要说明
    /// </summary>
    public class NotSupportedHandler : Handler
    {
        public NotSupportedHandler(HttpContext context)
            : base(context)
        {
        }

        public async override Task<UEditorResult> Process()
        {
            return new UEditorResult
            {
                State = "action 参数为空或者 action 不被支持。"
            };
        }
    }
}