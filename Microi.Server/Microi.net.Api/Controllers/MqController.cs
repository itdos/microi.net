using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Minio.DataModel;
using MySqlX.XDevAPI.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quartz.Impl.AdoJobStore.Common;
using Senparc.CO2NET.Extensions;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Threading.Tasks;
using static Aliyun.OSS.Model.CreateSelectObjectMetaInputFormatModel;

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
    public class MqController : Controller
    {
        IMicroiMQ mqCenter;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="mqCenter"></param>
        public MqController(IMicroiMQ mqCenter)
        {
            this.mqCenter = mqCenter;
        }
        /// <summary>
        /// 
        /// </summary>
        private async Task<MicroiMQSendInfo> DefaultParam(JObject dynamicParam)//MicroiMQSendInfo param
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            var param = dynamicParam.ToObject<MicroiMQSendInfo>(DiyCommon.JsonConfig);//这里时间格式化没有用
            if (param != null)
            {
                param.CurrentToken = currentTokenDynamic;
            }
            return param ?? new MicroiMQSendInfo();
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> SendMsg([FromBody] JObject dynamicParam)//[FromBody] MicroiMQSendInfo param
        {
            var param = await DefaultParam(dynamicParam);
            return Json(await mqCenter.SendMsg(param));
        }

        //[HttpPost]
        //public void AddTableIndex()
        //{
        //    DbSession.SetDefault(DatabaseType.MySql, OsClient.OsClientDbConn);
        //    DbCommand dbCommand = DbSession.Default.Db.DbProviderFactory.CreateCommand();
        //    dbCommand.CommandType = System.Data.CommandType.Text;
        //    dbCommand.CommandText = "CREATE INDEX idx_name ON cwtest (Name);";

        //    //DbCommand dbCommand = DbSession.Default.
        //    DbSession.Default.ExecuteNonQuery(dbCommand);
        //}
    }
}
