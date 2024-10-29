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

namespace iTdos.Api.Controllers
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
        IMicroiMQPublish mqCenter;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="mqCenter"></param>
        public MqController(IMicroiMQPublish mqCenter)
        {
            this.mqCenter = mqCenter;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="sendInfo"></param>
        /// <returns></returns>
        [HttpPost]
        public JsonResult SendMsg([FromBody] MicroiMQSendInfo sendInfo)
        {
            return Json(mqCenter.SendMsg(sendInfo));
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
