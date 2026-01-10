using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using MySqlX.XDevAPI.Common;
using Nest;
using Senparc.CO2NET.Extensions;
using System;
using System.Threading.Tasks;
using static Aliyun.OSS.Model.CreateSelectObjectMetaInputFormatModel;
using static Quartz.Logging.OperationName;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class SearchEngineController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        private IMicroiSearchEngineHelper searchEngineHelper;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="searchEngineHelper"></param>
        public SearchEngineController(IMicroiSearchEngineHelper searchEngineHelper)
        {
            this.searchEngineHelper = searchEngineHelper;
        }

        /// <summary>
        /// 表结构同步到es
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> AsyncIndex([FromForm] string tableId)
        {
            return await searchEngineHelper.AsyncIndex(tableId);
        }

        /// <summary>
        /// 新增文档
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> AddDocument([FromBody] MicroiSearchEngineParam param)
        {
            return await searchEngineHelper.AddDocument(param.TableName, param.Id);
        }

        /// <summary>
        /// 修改文档
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> UpdateDocument([FromBody] MicroiSearchEngineParam param)
        {
            return await searchEngineHelper.UpdateDocument(param.TableName, param.Id);
        }

        /// <summary>
        /// 删除文档
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> DeleteDocument([FromBody] MicroiSearchEngineParam param)
        {
            return await searchEngineHelper.DeleteDocument(param.TableName, param.Id);
        }

        /// <summary>
        /// 新增字段
        /// </summary>
        /// <param name="fieldModel"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> AddField([FromBody] MicroiSearchEngineFieldModel fieldModel)
        {
            return await searchEngineHelper.AddField(fieldModel);
        }

        /// <summary>
        /// 依据from、size分页查询,支持跳页，但数据量大时有性能问题
        /// </summary>
        /// <param name="searchParam"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> SearchByPage([FromBody] MicroiSearchEngineParam searchParam)
        {
            searchParam.PageType = MicroiSearchEngineConst.page_from_size;
            return await searchEngineHelper.GetSearchResponse(searchParam);
        }

        /// <summary>
        /// 分页查询依据searchafter,需要传最后一条数据的id，不能跳页，无性能问题
        /// </summary>
        /// <param name="searchParam"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> SearchBySearchAfter([FromBody] MicroiSearchEngineParam searchParam)
        {
            searchParam.PageType = MicroiSearchEngineConst.page_searchafter;
            return await searchEngineHelper.GetSearchResponse(searchParam);
        }

        /// <summary>
        /// 同步表数据到index
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<MicroiSearchEngineResult> AsyncTableDataToIndex([FromForm] string tableId)
        {
            return await searchEngineHelper.AsyncTableDataToIndex(tableId);
        }
    }
}
