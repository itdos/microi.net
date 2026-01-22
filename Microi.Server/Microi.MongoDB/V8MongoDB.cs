using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Dynamic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using MongoDB.Bson;
using MongoDB.Driver;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8MongoDB : IMongoDB
    {
        public V8MongoDBParam DynamicToV8MongoDBParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            V8MongoDBParam param = jobjParam.ToObject<V8MongoDBParam>(DiyCommon.JsonConfig);
            return param;
        }

        public string NewId()
        {
            return ObjectId.GenerateNewId().ToString();
        }

        /// <summary>
        /// 传入osClient
        /// </summary>
        public DosResult AddFormData(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }
                if (param._FormData == null || param._FormData.Count == 0)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }

                // 直接将 JObject 转换为 Dictionary，避免使用 ExpandoObject
                var model = new Dictionary<string, object>();
                
                foreach (var item in param._FormData)
                {
                    if (item.Key != "_id")
                    {
                        // 转换 JValue/JObject 等为原生类型，避免 MongoDB 序列化错误
                        model[item.Key] = ConvertJTokenToNative(item.Value);
                    }
                    else
                    {
                        param.Id = item.Value.ToString();
                    }
                }
                
                model["CreateTime"] = DateTime.Now;
                if (!param.Id.DosIsNullOrWhiteSpace())
                {
                    model["_id"] = new ObjectId(param.Id);
                }
                var host = new MongodbHost()
                {
                    Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                    DataBase = param.DbName,
                    Table = param.TableName
                };
                var result = TMongodbHelper<dynamic>.Insert(host, model);

                return new DosResult(result.Code, model, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 传入osClient
        /// </summary>
        public DosResult UptFormData(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                if (param.Id.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }
                if (param._FormData == null || param._FormData.Count == 0)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }

                // 直接将 JObject 转换为 Dictionary，避免使用 ExpandoObject
                var model = new Dictionary<string, object>();
                
                foreach (var item in param._FormData)
                {
                    // 转换 JValue/JObject 等为原生类型，避免 MongoDB 序列化错误
                    model[item.Key] = ConvertJTokenToNative(item.Value);
                }
                
                var host = new MongodbHost()
                {
                    Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                    DataBase = param.DbName,
                    Table = param.TableName
                };
                var result = TMongodbHelper<dynamic>.Update(host, model, param.Id);

                return new DosResult(result.Code, model, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 传入osClient
        /// </summary>
        public DosResult DelFormData(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                if (param.Id.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }
                var host = new MongodbHost()
                {
                    Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                    DataBase = param.DbName,
                    Table = param.TableName
                };
                var result = TMongodbHelper<dynamic>.Delete(host, param.Id);

                return result;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 传入osClient
        /// </summary>
        public DosResult<dynamic> GetFormData(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                if (param.Id.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }
                var host = new MongodbHost()
                {
                    Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                    DataBase = param.DbName,
                    Table = param.TableName
                };
                var result = TMongodbHelper<dynamic>.Find(host, param.Id);

                return result;
            }
            catch (Exception ex)
            {
                return new DosResult<dynamic>(0, null, ex.Message);
            }
        }

        public DosResultList<dynamic> GetTableData(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }

                var host = new MongodbHost()
                {
                    Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                    DataBase = param.DbName,
                    Table = param.TableName
                };

                string[] field = null;
                var sort = Builders<dynamic>.Sort.Descending("CreateTime");
                var list = new List<FilterDefinition<dynamic>>();

                if (param._Where != null)
                {
                    GetWhereSql(param._Where, list);
                }

                var filter = list.Count > 0 ? Builders<dynamic>.Filter.And(list) : Builders<dynamic>.Filter.Empty;

                var dataCount = TMongodbHelper<dynamic>.Count(host, filter);

                var result = new List<dynamic>();

                if (param._PageSize != null && param._PageIndex != null)
                {
                    result = TMongodbHelper<dynamic>.FindListByPage(host, filter, param._PageIndex.Value, param._PageSize.Value, field, sort);
                }
                else if (param._Top != null)
                {
                    result = TMongodbHelper<dynamic>.FindListByPage(host, filter, 1, param._Top.Value, field, sort);
                }
                else
                {
                    // 最多取1000条，防止业务卡死
                    result = TMongodbHelper<dynamic>.FindListByPage(host, filter, 1, 1000, field, sort);
                }

                return new DosResultList<dynamic>(1, result, "", int.Parse(dataCount.ToString()));
            }
            catch (Exception ex)
            {
                return new DosResultList<dynamic>(0, null, ex.Message);
            }
        }
        public async Task<DosResult> AddSysLog(SysLogParam param)
        {
            try
            {
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }

                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                }
                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
                #region  通用新增
                var model = MapperHelper.Map<SysLogParam, SysLog>(param);
                model.Id = Ulid.NewUlid().ToString();
                #endregion end

                DateTime localTime = DateTime.Now;
                DateTime utcTime = localTime.ToUniversalTime();
                model.CreateTime = localTime;// DateTime.Now;
                //var count = dbSession.Insert(model);

                var host = new MongodbHost()
                {
                    Connection = Microi.net.OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),//链接字符串
                    DataBase = "sys_log_" + param.OsClient.ToString().ToLower(),//库名
                    Table = "log_" + DateTime.Now.ToString("yyyyMM")//表名
                };
                var result = await TMongodbHelper<SysLog>.InsertAsync(host, model);

                return result;
            }
            catch (Exception ex)
            {

                //LogHelper.Error(ex.Message, "AddSysLog_");
                return new DosResult(0, null, ex.Message);
            }
        }
        public async Task<DosResultList<SysLog>> GetSysLog(SysLogParam param)
        {
            //如果传入了时间
            var tableName = "log_";
            if (param._SearchMonth.DosIsNullOrWhiteSpace())
            {
                tableName += DateTime.Now.ToString("yyyyMM");
            }
            else
            {
                tableName += param._SearchMonth;
            }
            var host = new MongodbHost()
            {
                Connection = Microi.net.OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),//链接字符串
                DataBase = "sys_log_" + param.OsClient.ToString().ToLower(),//库名
                Table = tableName//表名
            };
            string[] field = null;//new SysLog().GetFields().Select(d => d.Name).ToArray();
            var sort = Builders<SysLog>.Sort.Descending("CreateTime");
            var list = new List<FilterDefinition<SysLog>>();

            // var where = new Where<SysLog>();
            if (!param._Keyword.DosIsNullOrWhiteSpace())
            {
                list.Add(
                        Builders<SysLog>.Filter.Where(d => d.Title.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Content.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Type.Contains(param._Keyword))
                        //| Builders<SysLog>.Filter.Where(d => d.UserId != null && d.UserId.Value.ToString().Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.UserName.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.IP.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Mac.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.OtherInfo.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Api.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.AppId.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Param.Contains(param._Keyword))
                        | Builders<SysLog>.Filter.Where(d => d.Remark.Contains(param._Keyword))
                    );
                //where.And(d => d.Title.Like(param._Keyword)
                //                || d.Content.Like(param._Keyword)
                //                || d.Type.Like(param._Keyword)
                //                || d.UserId.Like(param._Keyword)
                //                || d.UserName.Like(param._Keyword)
                //                || d.IP.Like(param._Keyword)
                //                || d.Mac.Like(param._Keyword)
                //                || d.OtherInfo.Like(param._Keyword)
                //                );
            }
            if (param.Level != null)
            {
                list.Add(Builders<SysLog>.Filter.Where(d => d.Level == param.Level));
            }
            //DbSession dbSession = DiyDatabase.GetDbSession(param.OsClient);
            //DbSession dbSession = OsClient.GetClient(param.OsClient).DbRead;
            //var fs = dbSession.From<SysLog>()
            //    .Where(where);
            //var dataCount = fs.Count();
            var filter = list.Count > 0 ? Builders<SysLog>.Filter.And(list) : Builders<SysLog>.Filter.Empty;
            var dataCount = await TMongodbHelper<SysLog>.CountAsync(host, filter);
            var result = new List<SysLog>();
            if (param._PageSize != null && param._PageIndex != null)
            {
                //fs.Page(param._PageSize.Value, param._PageIndex.Value);
                result = await TMongodbHelper<SysLog>.FindListByPageAsync(host, filter, param._PageIndex.Value, param._PageSize.Value, field, sort);
            }
            if (param._Top != null)
            {
                //fs.Top(param._Top.Value);
                result = await TMongodbHelper<SysLog>.FindListByPageAsync(host, filter, 1, param._Top.Value, field, sort);
            }
            #region 自定义排序，默认 desc
            ////如果传入了排序字段名参数
            //var orderBy = OrderByClip.None;
            //if (!string.IsNullOrWhiteSpace(param._OrderBy))
            //{
            //    //取该表所有字段
            //    var fields = new SysLog().GetFields();
            //    var f = fields.Where(d => string.Equals(d.Name, param._OrderBy, StringComparison.CurrentCultureIgnoreCase));
            //    //若传入的字段名确实存在于表字段集中，则按照_OrderByType进行排序
            //    if (f.Any())
            //    {
            //        if (param._OrderByType.ToLower() == "asc")
            //            orderBy = orderBy && f.First().Asc && SysLog._.Id.Asc;
            //        else
            //            orderBy = orderBy && f.First().Desc && SysLog._.Id.Asc;
            //    }
            //    else
            //    {
            //        orderBy = orderBy && SysLog._.CreateTime.Desc && SysLog._.Id.Asc;
            //    }
            //}
            //else
            //{
            //    orderBy = orderBy && SysLog._.CreateTime.Desc && SysLog._.Id.Asc;
            //}
            #endregion

            //fs.OrderBy(orderBy);
            //var list = fs.ToList();
            return new DosResultList<SysLog>(1, result, "", int.Parse(dataCount.ToString()));
        }

        /// <summary>
        /// 将 JToken/JValue/JObject 转换为原生 .NET 类型
        /// 避免 MongoDB 序列化时报错：Type Newtonsoft.Json.Linq.JValue is not configured
        /// </summary>
        private object ConvertJTokenToNative(object value)
        {
            if (value == null)
                return null;

            // 如果是 JToken 类型，转换为原生类型
            if (value is JToken jToken)
            {
                switch (jToken.Type)
                {
                    case JTokenType.Null:
                        return null;
                    case JTokenType.Integer:
                        return jToken.Value<long>();
                    case JTokenType.Float:
                        return jToken.Value<double>();
                    case JTokenType.String:
                        return jToken.Value<string>();
                    case JTokenType.Boolean:
                        return jToken.Value<bool>();
                    case JTokenType.Date:
                        return jToken.Value<DateTime>();
                    case JTokenType.Array:
                        return jToken.ToObject<List<object>>();
                    case JTokenType.Object:
                        return jToken.ToObject<Dictionary<string, object>>();
                    default:
                        // 其他类型转为字符串
                        return jToken.ToString();
                }
            }

            return value;
        }

    }
}