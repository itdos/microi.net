using System.Threading.Tasks;
#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif

namespace Microi.net.Api
{
    /// <summary>
    /// Compatibility handler for the historical UEditor catchimage action.
    ///
    /// Remote image crawling is permanently disabled because fetching a
    /// user-controlled URL from the API network is an SSRF primitive. Keeping
    /// this type avoids breaking integrations that referenced it directly.
    /// </summary>
    public class CrawlerHandler : Handler
    {
        public CrawlerHandler(HttpContext context) : base(context)
        {
        }

        public override Task<UEditorResult> Process()
        {
            return Task.FromResult(new UEditorResult
            {
                State = "远程图片抓取已禁用"
            });
        }
    }
}
