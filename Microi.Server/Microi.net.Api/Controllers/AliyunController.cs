using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class AliyunController : Controller
    {
        
        /// <summary>
        /// 传入：Limit、FilePathName
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<DosResult> GetOssDownloadUrl(AliOssParam param)
        {
            var result = await DiyAliyun.GetDownloadUrl(param);
            return result;
            //return AppConfigurtaionServices.Configuration["AppSettings:ServerSign"];
        }
    }
}
