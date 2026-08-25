using System;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using RestSharp;
using System.Collections.Generic;
using Newtonsoft.Json;
using System.IO;

namespace Microi.net
{
    public class V8EngineOfficeParam
    {
        public string _Lang = DiyMessage.Lang;
        public string FileByteBase64 { get; set; }
        /// <summary>
        /// CSV 解析时传 csv 或原始文件名；Excel 保持不传即可兼容旧调用。
        /// </summary>
        public string FileType { get; set; }
        public string FileName { get; set; }
        public string Encoding { get; set; }
        public string Delimiter { get; set; }
        /// <summary>
        /// 从0开始
        /// </summary>
        public int? SheetIndex { get; set; }
        /// <summary>
        /// 表头与数据行号从 1 开始。均可省略以保持首行为表头的旧行为。
        /// </summary>
        public int? HeaderStartRow { get; set; }
        public int? HeaderEndRow { get; set; }
        public int? DataStartRow { get; set; }
        public int? DataEndRow { get; set; }
        public int? MaxDataRows { get; set; }
        public int? MaxColumns { get; set; }
        public List<ExcelImportColumnParam> Columns { get; set; }
        public string OsClient { get; set; }
    }
    // public class V8EngineOffice
    // {
    //     private DiyTableRowParam DynamicParam2(dynamic dynamicParam)
    //     {
    //         string json = JsonConvert.SerializeObject(dynamicParam);
    //         JObject jobjParam = JObject.Parse(json);
    //         DiyTableRowParam param = jobjParam.ToObject<DiyTableRowParam>(DiyCommon.JsonConfig);//这里时间格式化没有用
    //         return param;
    //     }

    //     private EmailParam DynamicParam3(dynamic dynamicParam)
    //     {
    //         string json = JsonConvert.SerializeObject(dynamicParam);
    //         JObject jobjParam = JObject.Parse(json);
    //         EmailParam param = jobjParam.ToObject<EmailParam>(DiyCommon.JsonConfig);//这里时间格式化没有用
    //         return param;
    //     }

    //     public DosResult SendEmail(dynamic dynamicParam)
    //     {
    //         EmailParam param = DynamicParam3(dynamicParam);
    //         return MicroiEngine.Office.SendEmailAsync(param).Result;
    //     }
    //     public DosResult<byte[]> ExportExcel(dynamic dynamicParam)
    //     {
    //         DiyTableRowParam param = DynamicParam2(dynamicParam);
    //         return MicroiEngine.Office.ExportExcel(param).Result;
    //     }

    //     public V8EngineOfficeParam DynamicParam(dynamic dynamicParam)
    //     {
    //         string json = JsonConvert.SerializeObject(dynamicParam);
    //         JObject jobjParam = JObject.Parse(json);
    //         V8EngineOfficeParam param = jobjParam.ToObject<V8EngineOfficeParam>(DiyCommon.JsonConfig);//这里时间格式化没有用
    //         return param;
    //     }
    //     /// <summary>
    //     /// excel转List dynamic ，必传：FileByteBase64（文件流对应的byte转base64字符串）
    //     /// </summary>
    //     /// <returns></returns>
    //     public DosResultList<dynamic> ExcelToList(dynamic dynamicParam)
    //     {
    //         try
    //         {
    //             V8EngineOfficeParam param = DynamicParam(dynamicParam);
    //             if (param.FileByteBase64.DosIsNullOrWhiteSpace())
    //             {
    //                 return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
    //             }
    //             var fileByte = Convert.FromBase64String(param.FileByteBase64);
    //             var npoi = new NPOIHelper(fileByte);
    //             var result = npoi.ExcelToListDynamic(param.SheetIndex ?? 0);
    //             return new DosResultList<dynamic>(1, result);
    //         }
    //         catch (Exception ex)
    //         {
    //             return new DosResultList<dynamic>(0, null, ex.Message);
    //         }
    //     }
    //     ///// <summary>
    //     ///// excel转List<dynamic>，必传：FileByteBase64（文件流对应的byte转base64字符串）
    //     ///// </summary>
    //     ///// <param name="dynamicParam"></param>
    //     ///// <returns></returns>
    //     //public DosResultList<dynamic> ExcelToList(dynamic dynamicParam)
    //     //{
    //     //    try
    //     //    {
    //     //        V8EngineOfficeParam param = DynamicParam(dynamicParam);
    //     //        if (param.FileByteBase64.DosIsNullOrWhiteSpace())
    //     //        {
    //     //            return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
    //     //        }
    //     //        var fileByte = Convert.FromBase64String(param.FileByteBase64);
    //     //        var npoi = new NPOIHelper(fileByte);
    //     //        var result = npoi.ExcelToListDynamic(param.SheetIndex ?? 0);
    //     //        return new DosResultList<dynamic>(1, result);
    //     //    }
    //     //    catch (Exception ex)
    //     //    {
    //     //        return new DosResultList<dynamic>(0, null, ex.Message);
    //     //    }
    //     //}
    // }
}
