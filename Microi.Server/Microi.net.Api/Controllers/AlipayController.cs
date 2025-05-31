using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System;
using System.Text;
using System.Threading.Tasks;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    public class AlipayController : Controller
    {
        // private readonly ApiEngine _apiEngine = new ApiEngine();
        // private readonly HttpClient _httpClient = new HttpClient();
        // public async Task<IActionResult> Index()
        // {
        //     var result = _apiEngine.Run("create-alipay-order-v3", new
        //     {
        //         ProductId = "9eca743c-edf1-4c58-ad67-ba75e29f73fe",
        //         TotalAmount = "0.01",
        //         OsClient = "microios"
        //     });
        //     // var url = (string)result.Data;
        //     var postParamStr = (string)result.Data;
        //     // var postParamObj = JsonConvert.DeserializeObject(postParamStr);
        //     var htmlContent = HttpHelper.Post("https://aaa.xiongmao212.com/submit.php", postParamStr);
        //     // var htmlContent = @"";
        //     return Content(htmlContent, "text/html", Encoding.UTF8);
        // }
    }
}
