#if NETSTANDARD || NETCOREAPP
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif

namespace Microi.net
{
    public abstract class Handler
    {
        public Handler(HttpContext context)
        {
            this.Request = context.Request;
            this.Response = context.Response;
            this.Context = context;
        }

        public abstract Task<UEditorResult> Process();

        public HttpRequest Request { get; private set; }
        public HttpResponse Response { get; private set; }
        public HttpContext Context { get; private set; }
    }
}