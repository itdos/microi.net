using Dos.ORM;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
// 通过扩展方法使用Dos.ORM API
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Diagnostics;

namespace Microi.net
{
    /// <summary>
    /// 表单引擎
    /// </summary>
    public partial class FormEngineExtend
    {
        // 静态字段缓存，避免重复创建
        private static readonly Dos.ORM.Field[] _cachedDiyTableFields = new DiyTable().GetFields();
        private static readonly Dos.ORM.Field[] _cachedDiyFieldFields = new DiyField().GetFields();
        #region 缓存操作方法 
        /// <summary>
        /// 构建缓存Key（优化字符串拼接）
        /// </summary>
        private static string BuildCacheKey(string osClient, string prefix, string key)
        {
            return string.Concat("Microi:", osClient, prefix, key.ToLowerInvariant());
        }
        public string CacheKeySqlCount(string osClient, string tableIdOrName, string sqlCount, List<System.Data.Common.DbParameter> sqlParams = null)
        {
            if (sqlCount.DosIsNullOrWhiteSpace())
            {
                return $"Microi:{osClient}:FormEngine:SqlCount:{tableIdOrName}:*";
            }
            else
            {
                // 将参数值序列化为签名字符串，避免不同参数值共享缓存
                var paramSignature = "";
                if (sqlParams != null && sqlParams.Any())
                {
                    var paramPairs = sqlParams.OrderBy(p => p.ParameterName)
                                              .Select(p => $"{p.ParameterName}={p.Value ?? "NULL"}");
                    paramSignature = string.Join(";", paramPairs);
                }
                
                var combinedKey = sqlCount + (paramSignature.DosIsNullOrWhiteSpace() ? "" : "|" + paramSignature);
                return $"Microi:{osClient}:FormEngine:SqlCount:{tableIdOrName}:{EncryptHelper.MD5Encrypt(combinedKey, 16)}";
            }
        }
        public enum FormSubmitType
        {
            Add,
            Upt,
            Del,
            Null,
        }
        /// <summary>
        /// 目前只会在FormEngine的【增删改】中调用
        /// </summary>
        public async Task CacheClear(string osClient, string tableId, string tableName, 
                                FormSubmitType formSubmitType,
                                JObject formData = null
                            )
        {
            //如果【增删改】diy_field表
            if(tableName.DosToLower() == "diy_field")
            {
                //注意方法传入过来的tableId、tableName并不是[diy_field]表的主表diy_table的Id和Name
                if(formData != null && !formData["TableId"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    var tempTableId = formData["TableId"].Val<string>();
                    //从缓存中获取diy_table数据
                    var diyTableModelResult = await GetDiyTable(tempTableId, osClient);

                    if (diyTableModelResult.Code == 1)
                    {
                        var diyTableModel = diyTableModelResult.Data;
                        //清除该表[diy_field]的主表diy_table的字段列表缓存
                        var cacheKey = BuildCacheKey(osClient, ":FormData:diy_table_field_list:", (string)diyTableModel.Id);
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(cacheKey);
                        //清除该表[diy_field]的主表diy_table的字段列表缓存
                        var cacheKey2 = BuildCacheKey(osClient, ":FormData:diy_table_field_list:", (string)diyTableModel.Name);
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(cacheKey2);
                    }
                }
            }
            //如果【增删改】diy_table表
            if(tableName.DosToLower() == "diy_table")
            {
                if (!tableId.DosIsNullOrWhiteSpace())
                {
                    //清除该表的缓存
                    var cacheKey = BuildCacheKey(osClient, ":FormData:diy_table:", tableId);
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(cacheKey);
                }
                if (!tableName.DosIsNullOrWhiteSpace())
                {
                    //清除该表的缓存
                    var cacheKey = BuildCacheKey(osClient, ":FormData:diy_table:", tableName);
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(cacheKey);
                }
            }
            //如果是给某张表【增、删】数据
            if(formSubmitType == FormSubmitType.Add || formSubmitType == FormSubmitType.Del)
            {
                if (!tableId.DosIsNullOrWhiteSpace())
                {
                    //清除该表的SqlCount缓存
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveParentAsync(CacheKeySqlCount(osClient, tableId, null));
                }
                if (!tableName.DosIsNullOrWhiteSpace())
                {
                    //清除该表的SqlCount缓存
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveParentAsync(CacheKeySqlCount(osClient, tableName, null));
                }
            }
        }
        #endregion
        public static TimeSpan DefaultCacheSqlCountTimeSpan = TimeSpan.FromMinutes(5);

        // ThreadStatic Random，避免高并发下的线程竞争
        [ThreadStatic]
        private static Random _threadRandom;
        private static Random ThreadRandom => _threadRandom ?? (_threadRandom = new Random(Guid.NewGuid().GetHashCode()));

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public static async Task<JObject> DefaultParam(JObject param)
        {
            try
            {
                if (param["OsClient"] == null || param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    var osClient = DiyTokenExtend.GetCurrentOsClient();
                    param["OsClient"] = osClient;
                }
            }
            catch (Exception ex)
            {

            }
            return param;
        }
        /// <summary>
        /// 新增表
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public async Task<DosResult> AddTableAsync(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            //DiyTableRowParam diyParam = await DynamicParamToDiyParam(dynamicParam);
            //var param = JsonHelper.Deserialize<DiyTableRowParam>(JsonHelper.Serialize(dynamicParam));
            // DiyTableParam fieldParam = await DynamicToDiyTableParam(dynamicParam);
            //2023-08-04不再使用此方法创建表
            //var result = await AddDiyTable(fieldParam, _trans);
            var result = await AddDiyTable(dynamicParam, _trans);

            return result;
        }
        /// <summary>
        /// 新增表。传入Name、Description、DataBaseId、DataBaseName
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult AddTable(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            return AddTableAsync(dynamicParam, _trans).ConfigureAwait(false).GetAwaiter().GetResult();
        }
        /// <summary>
        /// 添加一张自定义表，会同时创建实体表、表单引擎数据，除非传入_OnlyCreateTable=true
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> AddDiyTable(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            JObject param = await DefaultParam(JsonHelper.ToJObject(dynamicParam));
            if (param["_Lang"] == null || param["_Lang"].Val<string>().DosIsNullOrWhiteSpace())
            {
                param["_Lang"] = DiyMessage.Lang;
            }
            #region Check
            if (param["Name"] == null || param["Name"].Val<string>().DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param["OsClient"].Val<string>(), "ParamError", param["_Lang"].Val<string>()) + "[AddDiyTable]", 0, new
                {
                    Param = param,
                });
            }
            if (param["OsClient"] == null || param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
            {
                param["OsClient"] = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param["OsClient"] == null || param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param["OsClient"].Val<string>(), "OsClientNotNull", param["_Lang"].Val<string>()));
            }
            #endregion
            try
            {
                var tableId = Ulid.NewUlid().ToString();
                if (param["Id"] != null && !param["Id"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    tableId = param["Id"].Val<string>();
                }
                //判断是否已经存在
                var tableName = DiyCommon.FilterTableFieldName(param["Name"].Val<string>().DosTrim());
                var osClient = param["OsClient"].Val<string>();
                var osClientModel = OsClientExtend.GetClient(osClient);

                var dbSession = osClientModel.Db;
                var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
                if (!(param["DataBaseId"].Val<string>()).DosIsNullOrWhiteSpace())
                {
                    dbInfo = DiyCommon.GetDbInfo(OsClientExtend.GetClientDataBase(osClientModel, param["DataBaseId"].Val<string>()).DbType);
                }
                IMicroiDbTransaction trans = _trans == null ? dbSession.BeginTransaction() : _trans;
                try
                {
                    if (trans.From<DiyTable>().Where(d => d.IsDeleted != 1 && d.Name == tableName).Count() > 0)
                    {
                        if (_trans == null)
                        {
                            trans.Rollback();
                        }
                        return new DosResult(0, null, DiyMessage.GetLang(osClient, "AlreadyExistData", param["_Lang"].Val<string>()));
                    }
                    try
                    {
                        var dbSessionDataBase = OsClientExtend.GetClientDbSession(osClientModel, param["DataBaseId"].Val<string>());
                        //可能是扩展库。这里不能传入trans，因为trans是主库的，有可能这张表是要在扩展库中创建。
                        var result = MicroiEngine.ORM(dbInfo.DbType).AddDiyTable(new DbServiceParam()
                        {
                            TableName = tableName,
                            OsClientModel = osClientModel,
                            DbInfo = dbInfo,
                            DataBaseId = param["DataBaseId"].Val<string>(),
                            OsClient = osClient,
                            DbSession = dbSessionDataBase,
                        });//, trans
                        if (result.Code != 1)
                        {
                            if (_trans == null)
                                trans.Rollback();
                            return new DosResult(result.Code, result.Data, result.Msg, 0, result.DataAppend);
                        }
                        //如果只是创建实体表，则直接返回
                        if (param["_OnlyCreateTable"].Val<bool?>() == true)
                        {
                            if (_trans == null)
                                trans.Commit();
                            return new DosResult(1);
                        }
                        //开始创建diy_table数据
                        param["FormEngineKey"] = "Diy_Table";
                        param["Id"] = tableId;

                        //只可能是主数据库。这里不会触发后端V8事件中的创建实体表
                        param["_InvokeType"] = InvokeType.Server.ToString();
                        var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(param, trans);
                        if (addResult.Code != 1)
                        {
                            if (_trans == null)
                                trans.Rollback();
                            return addResult;
                        }
                        //创建审计字段 --2025-09-18 by anderson
                        foreach (var item in DiyCommon.FixedDiyField)
                        {
                            var addFixedFieldResult = await MicroiEngine.FormEngine.AddFormDataAsync("diy_field", new
                            {
                                Label = item.Label,
                                Name = item.Name,
                                Type = item.Type,
                                Component = item.Component,
                                Sort = item.Sort,
                                IsLockField = 1,
                                Visible = item.Visible,
                                Readonly = 1,
                                TableId = tableId,
                                NameConfirm = 1,
                                TableWidth = item.TableWidth,
                                Unique = 0
                            }, trans);
                            if (addFixedFieldResult.Code != 1)
                            {
                                if (_trans == null)
                                    trans.Rollback();
                                return addFixedFieldResult;
                            }
                        }
                        if (_trans == null)
                            trans.Commit();
                        return new DosResult(1);
                    }
                    //外部一般会处理，所以这里不需要rollback
                    //2023-05-25：如果trans不是外部传入进来的，这里还是要处理rollback
                    catch (Exception ex)
                    {
                        if (_trans == null)
                            trans.Rollback();
                        return new DosResult(0, null, ex.Message + "[AddDiyTable]", null, new
                        {
                            Param = param,
                            StackTrace = ex.StackTrace
                        });
                    }

                }
                catch (System.Exception ex)
                {
                    if (_trans == null)
                        trans.Rollback();
                    return new DosResult(0, null, ex.Message + "[AddDiyTable]", null, new
                    {
                        Param = param,
                        StackTrace = ex.StackTrace
                    });
                }
                finally
                {
                    if (_trans == null)
                        trans.Close();
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message + "[AddDiyTable]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 逻辑删除一张表，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelDiyTable(DiyTableParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) + "[DelDiyTable]", null, new
                {
                    Param = param,
                });
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            // 【重要】.From<T>() 必须使用 Dos.ORM
            var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
            //var model = DiyTableRepository.First(d => d.Id == param.Id);
            var model = dosOrmDbRead.From<DiyTable>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, "不存在的DiyTable数据，Id：" + (param.Id ?? ""));
            }

            model.IsDeleted = 1;
            //DiyTableCache.DelDiyTableModel(model, param.OsClient);
            //var count = DiyTableRepository.Update(model);
            var count = dbSession.Update(model);
            MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
            {
                Type = "DIY数据删除",
                Title = (param._CurrentUser == null ? "" : param._CurrentUser?["Account"].Val<string>()) + "删除了表",
                Content = "param：" + JsonHelper.Serialize(param),
                //IP = IPHelper.GetClientIP(HttpContext),
                OsClient = param.OsClient
            });
            return new DosResult(1, model);
        }
        /// <summary>
        /// 必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptDiyTable(DiyTableParam param)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) + " UptDiyTable.");
            }
            param.Name = param.Name.DosTrim();

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            #endregion
            var osClientModel = GetOsClientModelSafe(param.OsClient);
            if (osClientModel == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotFound", param._Lang));
            }
            IMicroiDbSession dbSession = osClientModel.Db;
            IMicroiDbSession dbRead = osClientModel.DbRead;
            // 【重要】.From<T>() 必须使用 Dos.ORM
            var dosOrmDbRead = osClientModel.DosOrmDbRead;
            var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
            var model = dosOrmDbRead.From<DiyTable>().Select(_cachedDiyTableFields).Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, "不存在的DiyTable数据，Id：" + (param.Id ?? ""));
            }
            try
            {
                param.Name = DiyCommon.FilterTableFieldName(param.Name);
                if (dbSession != null)
                {
                    using (var trans = dbSession.BeginTransaction())
                    {

                        if (model.Name != param.Name)
                        {
                            //var sql = $"ALTER TABLE {dbInfo.L}{model.Name}{dbInfo.R} rename {dbInfo.L}{param.Name}{dbInfo.R}";
                            ////注意：这里即使成功，也是返回受影响行数0，navicat中执行也是，并且trans.Rollback()不会有效果。
                            ////在客户数据库中修改表名
                            //count2 += trans.FromSql(sql)
                            //    .ExecuteNonQuery();
                            var dbSessionDataBase = OsClientExtend.GetClientDbSession(osClientModel, param.DataBaseId);
                            var uptDbTableNameResult = MicroiEngine.ORM(dbInfo.DbType).UptDiyTable(new DbServiceParam()
                            {
                                TableName = param.Name,
                                OldTableName = model.Name,
                                OsClient = param.OsClient,
                                DataBaseId = model.DataBaseId,
                                DbSession = dbSessionDataBase
                            });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象
                            if (uptDbTableNameResult.Code != 1)
                            {
                                return uptDbTableNameResult;
                            }
                        }

                        #region  通用修改
                        model = MapperHelper.MapNotNull<object, DiyTable>(param);
                        #endregion end

                        model.UpdateTime = DateTime.Now;

                        if (model.IsTree == 1)
                        {
                            if (model.TreeParentField.DosIsNullOrWhiteSpace() || model.TreeParentFields.DosIsNullOrWhiteSpace())
                            {
                                trans.Rollback();
                                return new DosResult(0, null, "当表单为树型结构时，【树形结构父级字段、树形结构完整父级字段】必填！");
                            }
                            var fieldListResult = await GetDiyField(new DiyFieldParam()
                            {
                                TableId = model.Id,
                                OsClient = param.OsClient,
                                IsDeleted = 0
                            });
                            if (fieldListResult.Code != 1)
                            {
                                return new DosResult(0, null, fieldListResult.Msg);
                            }
                            if (fieldListResult.Data == null 
                                || !fieldListResult.Data.Any(d => d["Name"].Val<string>()?.ToLower() 
                                    == model.TreeParentField.ToLower()) 
                                || !fieldListResult.Data.Any(d => d["Name"].Val<string>() ?.ToLower() 
                                    == model.TreeParentFields.ToLower()))
                            {
                                trans.Rollback();
                                return new DosResult(0, null, "当表单为树型结构时，必须存在【树形结构父级字段、树形结构完整父级字段】！");
                            }
                        }
                        var count = trans.Update(model);
                        //DiyTableCache.DelDiyTableModel(model, param.OsClient);
                        trans.Commit();
                        return new DosResult(1, model, "");
                    }
                }
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) + " UptDiyTable.");
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResult(0, null, ex.Message + "[UptDiyTable]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 获取所有自定义表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<dynamic>> GetDiyTable(DiyTableParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) + "[GetTableTable]", null, new
                {
                    Param = param
                });
            }
            #endregion
            try
            {
                //IMicroiDbSession dbSession = DiyDatabase.GetDbSession(param.OsClient);
                IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
                if (dbSession != null)
                {
                    var where = new Where<DiyTable>();
                    //where.And(d => d.OsClient == param.OsClient);
                    if (param.IsDeleted != null)
                    {
                        where.And(d => d.IsDeleted == param.IsDeleted);
                    }


                    if (param.Names != null && param.Names.Any() && param.Ids != null && param.Ids.Any())
                    {
                        where.And(d => (d.Name.In(param.Names) || d.Id.In(param.Ids)));
                    }
                    else
                    {
                        if (param.Names != null && param.Names.Any())
                        {
                            where.And(d => d.Name.In(param.Names));
                        }
                        if (param.Ids != null && param.Ids.Any())
                        {
                            where.And(d => d.Id.In(param.Ids));
                        }
                    }

                    if (!param._Keyword.DosIsNullOrWhiteSpace())
                    {
                        where.And(d => d.Name.Like(param._Keyword) || d.Description.Like(param._Keyword));
                    }
                    // 【重要】.From<T>() 必须使用 Dos.ORM
                    var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
                    //var fs = DbClassiTdos.DbSession.From<DiyTable>()
                    //    .Where(where);
                    var fs = dosOrmDbRead.From<DiyTable>()
                        .Where(where);
                    var dataCount = fs.Count();

                    if (param._PageSize != null && param._PageIndex != null)
                    {
                        fs.Page(param._PageSize.Value, param._PageIndex.Value);
                    }
                    if (param._Top != null)
                    {
                        fs.Top(param._Top.Value);
                    }

                    #region 自定义排序，默认 desc
                    //如果传入了排序字段名参数
                    var orderBy = OrderByClip.None;
                    if (!string.IsNullOrWhiteSpace(param._OrderBy))
                    {
                        //取该表所有字段（使用缓存）
                        var f = _cachedDiyTableFields.Where(d => string.Equals(d.Name, param._OrderBy, StringComparison.CurrentCultureIgnoreCase));
                        //若传入的字段名确实存在于表字段集中，则按照_OrderByType进行排序
                        if (f.Any())
                        {
                            if (param._OrderByType.ToLower() == "asc")
                                orderBy = orderBy && f.First().Asc;
                            else
                                orderBy = orderBy && f.First().Desc;
                        }
                        else
                        {
                            orderBy = orderBy && DiyTable._.CreateTime.Desc;
                        }
                    }
                    else
                    {
                        orderBy = orderBy && DiyTable._.CreateTime.Desc;
                    }
                    #endregion


                    fs.OrderBy(orderBy);
                    if (param._Cache != null)
                    {
                        fs.SetCacheTimeOut(param._Cache.Value);
                    }
                    var list = fs.ToList<dynamic>();
                    return new DosResultList<dynamic>(1, list, "", dataCount);
                }
                return new DosResultList<dynamic>(0, null, "数据库参数错误！" + "[GetTableTable]", null, new
                {
                    Param = param
                });
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResultList<dynamic>(0, null, ex.Message + "[GetDiyTable]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        // 保持向后兼容的静态字段
        public static Dos.ORM.Field[] _diyTableFields => _cachedDiyTableFields;
        public static Dos.ORM.Field[] _diyFieldFields => _cachedDiyFieldFields;

        /// <summary>
        /// 获取OsClientSecret，包含错误处理
        /// </summary>
        private static OsClientSecret GetOsClientModelSafe(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient))
            {
                return null;
            }
            return OsClientExtend.GetClient(osClient);
        }

        

        /// <summary>
        /// 
        /// </summary>
        public List<string> CantAddField = new List<string>()
        {
            "OsClient",
            "FormEngineKey",
            "TableId",
            "TableName",
            "_Ids", "_OsClient", "_TableId", "_TableName",
            "_PageSize",  "_PageIndex", "_Top",
            "_FormData", "_RowModel",
            // "Id", "Ids", "IsDeleted", "CreateTime", "UpdateTime", "UserId", "UserName",
        };
        /// <summary>
        /// 新增一个字段
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public async Task<DosResult> AddFieldAsync(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            //DiyTableRowParam diyParam = await DynamicParamToDiyParam(dynamicParam);
            //var param = JsonHelper.Deserialize<DiyTableRowParam>(JsonHelper.Serialize(dynamicParam));
            // DiyFieldParam fieldParam = await DynamicToDiyFieldParam(dynamicParam);
            var result = await AddDiyField(dynamicParam, _trans);
            return result;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult AddField(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            return AddFieldAsync(dynamicParam, _trans).ConfigureAwait(false).GetAwaiter().GetResult();
        }
        /// <summary>
        /// 添加一个自定义字段。必传 TableId或TableName、Name。
        /// 会同时创建实体表字段、表单引擎数据，除非传入_OnlyCreateField=true
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> AddDiyField(dynamic dynamicParam, IMicroiDbTransaction _trans = null)
        {
            try
            {
                JObject param = await DefaultParam2(JsonHelper.ToJObject(dynamicParam));
                var lang = DiyMessage.Lang;
                if (param["_Lang"] == null || param["_Lang"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    param["_Lang"] = DiyMessage.Lang;
                }
                else
                {
                    lang = param["_Lang"].Val<string>();
                }
                #region Check
                if (param["OsClient"] == null || param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    param["OsClient"] = DiyTokenExtend.GetCurrentOsClient();
                }
                if (param["OsClient"] == null || param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param["OsClient"].Val<string>(), "OsClientNotNull", param["_Lang"].Val<string>()));
                }

                if (
                    //param.Name.DosIsNullOrWhiteSpace() //这里不再判断Name(FieldName)是因为可能不传字段名，自动生成 类似Text2 这种字段名
                    (param["TableId"] == null || param["TableId"].Val<string>().DosIsNullOrWhiteSpace())
                    && (param["TableName"] == null || param["TableName"].Val<string>().DosIsNullOrWhiteSpace())
                    //|| param.Type.DosIsNullOrWhiteSpace() // 这里不再判断 Type是因为有可能添加一个没有Type的字段，如分割线
                    )
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param["OsClient"].Val<string>(), "ParamError", lang));
                }
                var fieldName = DiyCommon.FilterTableFieldName(param["Name"].Val<string>().DosTrim());
                var fieldLabel = param["Label"].Val<string>();
                var fieldType = param["Type"].Val<string>().DosTrim();
                var osClient = param["OsClient"].Val<string>().DosTrim();
                var tableId = param["TableId"].Val<string>().DosTrim();
                var tableName = param["TableName"].Val<string>().DosTrim();
                var fieldComponent = param["Component"].Val<string>().DosTrim() ?? "";
                if (fieldComponent.DosIsNullOrWhiteSpace())
                {
                    fieldComponent = "Field";
                }
                if (CantAddField.Contains(fieldName))
                {
                    return new DosResult(0, null, "系统内置字段名，请更换：" + fieldName);
                }
                if (!fieldName.DosIsNullOrWhiteSpace() && fieldName.Length > 30)
                {
                    return new DosResult(0, null, "字段名过长：" + fieldName);
                }
                if (!fieldLabel.DosIsNullOrWhiteSpace() && fieldLabel.Length > 60)
                {
                    return new DosResult(0, null, "字段显示名称过长：" + fieldLabel);
                }
                #endregion
                var osClientModel = OsClientExtend.GetClient(osClient);
                IMicroiDbSession dbSession = osClientModel.Db;
                IMicroiDbSession dbRead = osClientModel.DbRead;
                var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
                //查询TableName
                //先获取 DiyTable的model
                var diyTableModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<DiyTable>(new
                {
                    FormEngineKey = "Diy_Table",
                    _Where = new List<DiyWhere>() { new DiyWhere() {
                        Name = "Id", Value = tableId, Type = "="
                    },new DiyWhere() {
                        Name = "Name", Value = tableName, Type = "=", AndOr = "Or"
                    } },
                    OsClient = osClient,
                    // _CurrentUser = param._CurrentUser,
                    // 
                }, _trans);
                if (diyTableModelResult.Code != 1)
                {
                    return new DosResult(0, null, diyTableModelResult.Msg);
                }
                var diyTableModel = diyTableModelResult.Data;
                if (!diyTableModel.DataBaseId.DosIsNullOrWhiteSpace())
                {
                    var dbReadDataBase = OsClientExtend.GetClientDataBase(osClientModel, diyTableModel.DataBaseId);
                    dbInfo = DiyCommon.GetDbInfo(dbReadDataBase.DbType);
                }
                tableId = (string)diyTableModel.Id;
                tableName = (string)diyTableModel.Name;
                IMicroiDbTransaction trans = _trans == null ? dbSession.BeginTransaction() : _trans;
                try
                {
                    JObject model = null;
                    // 【重要】.From<T>() 必须使用 Dos.ORM
                    var dosOrmDbRead = OsClientExtend.GetClient(osClient).DosOrmDbRead;
                    if (fieldName.DosIsNullOrWhiteSpace())
                    {
                        var fieldCount = dosOrmDbRead.From<DiyField>()
                            .Where(d => d.Component == fieldComponent && d.TableId == tableId)
                            .Count();
                        fieldName = string.Concat(fieldComponent, (fieldCount + 1).ToString(), ThreadRandom.Next(10, 100).ToString());
                    }
                    else
                    {
                        model = (await GetDiyFieldModel(new DiyFieldParam()
                        {
                            TableId = diyTableModel.Id,
                            Name = fieldName,
                            OsClient = osClient,
                        })).Data;
                        if (model != null)
                        {
                            if (_trans == null)
                            {
                                trans.Rollback();
                            }
                            return new DosResult(0, null, "已存在的字段：" + fieldName);
                        }
                    }
                    var dbSessionDataBase = OsClientExtend.GetClientDbSession(osClientModel, param["DataBaseId"].Val<string>());
                    var addColResult = MicroiEngine.ORM(dbInfo.DbType).AddColumn(new DbServiceParam()
                    {
                        TableName = diyTableModel.Name,
                        FieldName = fieldName,
                        FieldType = fieldType,
                        FieldNotNull = false,
                        FieldLabel = fieldLabel,
                        OsClientModel = osClientModel,
                        DbInfo = dbInfo,
                        DataBaseId = diyTableModel.DataBaseId,
                        OsClient = osClientModel.OsClient,
                        DbSession = dbSessionDataBase
                    });//, trans  可能是在扩展数据库中操作，所以暂时不传入主库的trans对象
                    // var count = trans.Insert(model);
                    if (addColResult.Code != 1)
                    {
                        if (_trans == null)
                            trans.Rollback();
                        return addColResult;
                    }
                    if (param["_OnlyCreateField"].Val<bool?>() == true)
                    {
                        if (_trans == null)
                            trans.Commit();
                        return new DosResult(1);
                    }
                    param["Name"] = fieldName;
                    if (param["Sort"].Val<int?>() == null)
                    {
                        //model.UpdateTime = model.CreateTime;
                        //设置sort
                        var sort = dosOrmDbRead.From<DiyField>()
                                                .Select(DiyField._.Sort.Max())
                                                .Where(d => d.TableId == tableId && d.IsDeleted != 1)
                                                .ToScalar<int?>();
                        if (sort == null)
                        {
                            param["Sort"] = 100;
                        }
                        else
                        {
                            param["Sort"] = sort.Value + 100;
                        }
                    }
                    #region  通用新增
                    param["FormEngineKey"] = "diy_field";
                    //这里会触发后端V8事件中的创建实体表，因为自动传入了_InvokeType=Client
                    param["_InvokeType"] = InvokeType.Server.ToString();
                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(param, _trans);
                    if (addResult.Code != 1)
                    {
                        if (_trans == null)
                            trans.Rollback();
                        return addResult;
                    }
                    if (_trans == null)
                        trans.Commit();
                    //上面已经调用了AddFormDataAsync，因此会触发以下代码
                    // await CacheClear(osClient, null, "diy_field", 
                    //             FormSubmitType.Add, new JObject()
                    //             {
                    //                 ["TableId"] = model.TableId,
                    //             });
                    return new DosResult(1, addResult.Data);//这里必须要返回新增后的model，前端要用到
                    #endregion end
                }
                catch (Exception ex)
                {
                    if (_trans == null)
                        trans.Rollback();
                    return new DosResult(0, null, ex.Message + "[AddDiyField]", null, new
                    {
                        Param = param,
                        StackTrace = ex.StackTrace
                    });
                }
                finally
                {
                    if (_trans == null)
                        trans.Close();
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message + "[AddDiyField]", null, new
                {
                    Param = JsonHelper.Serialize(dynamicParam),
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 修改一个自定义字段。传入Id(FieldId)，Name（FieldName），  TableName（如果传入TableName，就可以不用传入Id）
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> UptDiyField(DiyFieldParam param, IMicroiDbTransaction _trans = null)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace()
                && param.Name.DosIsNullOrWhiteSpace()
                && param.TableName.DosIsNullOrWhiteSpace()
                && param.TableId.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            var osClientModel = OsClientExtend.GetClient(param.OsClient);
            IMicroiDbSession dbSession = osClientModel.Db;
            IMicroiDbSession dbRead = osClientModel.DbRead;
            var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
            //var fieldModel = DiyFieldRepository.First(d => d.Id == param.Id);
            DiyTable diyTableModel = null;
            var tableId = "";
            #region 查询TableName
            if (!param.TableId.DosIsNullOrWhiteSpace() || !param.TableName.DosIsNullOrWhiteSpace())
            {
                //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
                //var diyTableModelResult = await new FormEngine().GetDiyTableModel(new DiyTableParam()
                //{
                //    Id = param.TableId,
                //    Name = param.TableName,
                //    IsDeleted = 0,
                //    OsClient = param.OsClient,

                //    _CurrentUser = param._CurrentUser,
                //});
                var diyTableModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<DiyTable>(new
                {
                    FormEngineKey = "Diy_Table",
                    _Where = new List<DiyWhere>() { new DiyWhere() {
                            Name = "Id", Value = param.TableId, Type = "="
                        },new DiyWhere() {
                            Name = "Name", Value = param.TableName, Type = "=", AndOr = "Or"
                        } },
                    //Id = param.TableId,
                    //Name = param.TableName,
                    //IsDeleted = 0,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,

                });
                if (diyTableModelResult.Code != 1)
                {
                    return new DosResult(0, null, diyTableModelResult.Msg);
                }
                diyTableModel = diyTableModelResult.Data;
                tableId = (string)diyTableModel.Id;


                if (!diyTableModel.DataBaseId.DosIsNullOrWhiteSpace())
                {
                    var dbReadDataBase = OsClientExtend.GetClientDataBase(osClientModel, diyTableModel.DataBaseId);
                    dbInfo = DiyCommon.GetDbInfo(dbReadDataBase.DbType);
                }
            }

            #endregion

            var where = new Where<DiyField>();
            if (!param.Id.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.Id == param.Id);
            }
            else
            {
                where.And(d => d.TableId == tableId && d.Name == param.Name && d.IsDeleted != 1);
            }
            // 【重要】.From<T>() 必须使用 Dos.ORM
            var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
            var fieldModel = dosOrmDbRead.From<DiyField>().Where(where).First();
            if (fieldModel == null)
            {
                return new DosResult(0, null, "不存在的Field！");
            }
            param.Name = DiyCommon.FilterTableFieldName(param.Name.DosTrim());
            // if (CantAddField.Contains(param.Name))
            // {
            //     return new DosResult(0, null, "系统内置字段名，请更换：" + param.Name);
            // }
            param.Type = param.Type.DosTrim();
            #endregion
            try
            {
                if (dbSession != null)
                {
                    using (var trans = dbSession.BeginTransaction())
                    {
                        //查询TableName
                        //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
                        if (diyTableModel == null)
                        {
                            //diyTableModel = dbRead.From<DiyTable>()
                            //                        .Select(_diyTableFields)
                            //                        .Where(d => d.Id == fieldModel.TableId)
                            //                        .First();

                            //var diyTableModelResult = await new FormEngine().GetDiyTableModel(new DiyTableParam()
                            //{
                            //    Id = param.TableId,
                            //    Name = param.TableName,
                            //    IsDeleted = 0,
                            //    OsClient = param.OsClient,

                            //    _CurrentUser = param._CurrentUser,
                            //});

                            var diyTableModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<DiyTable>(new
                            {
                                FormEngineKey = "Diy_Table",
                                _Where = new List<DiyWhere>() { new DiyWhere() {
                                    Name = "Id", Value = param.TableId, Type = "="
                                },new DiyWhere() {
                                    Name = "Name", Value = param.TableName, Type = "=", AndOr = "Or"
                                } },
                                //Id = param.TableId,
                                //Name = param.TableName,
                                //IsDeleted = 0,
                                OsClient = param.OsClient,
                                _CurrentUser = param._CurrentUser,

                            });
                            if (diyTableModelResult.Code != 1)
                            {
                                return new DosResult(0, null, diyTableModelResult.Msg);
                            }
                            diyTableModel = diyTableModelResult.Data;
                        }

                        var dbSessionDataBase = OsClientExtend.GetClientDbSession(osClientModel, diyTableModel.DataBaseId);


                        //如果修改了列名，或类型
                        //修改为强制修改物理表，不再判断列名、类型
                        //if (fieldModel.Name != param.Name 
                        //    || fieldModel.Type != param.Type
                        //    || fieldModel.Label != param.Label
                        //    )
                        {
                            //判断字段是否已存在
                            if (
                                (
                                    fieldModel.Name != param.Name
                                    || fieldModel.Type != param.Type
                                )
                                && dosOrmDbRead.From<DiyField>().Where(d => d.TableId == fieldModel.TableId
                                                                    && d.Id != fieldModel.Id
                                                                    && d.Name == param.Name).First() != null)
                            {
                                //trans.Rollback();
                                return new DosResult(0, null, "已存在该字段名，请修改字段名称！");
                            }
                            //注意：如分割线等一些字段，是不需要操作客户的数据库的
                            if (!param.Type.DosIsNullOrWhiteSpace()
                                && !DiyCommon.NotRealField.Any(d => d == fieldModel.Component))
                            {
                                var dbOpResult = MicroiEngine.ORM(dbInfo.DbType).ChangeColumn(new DbServiceParam()
                                {
                                    TableName = diyTableModel.Name,

                                    FieldName = fieldModel.Name,
                                    NewFieldName = param.Name,
                                    FieldType = param.Type,
                                    OldFieldType = fieldModel.Type,
                                    FieldLabel = param.Label,

                                    OsClientModel = osClientModel,
                                    DbInfo = dbInfo,
                                    DataBaseId = diyTableModel.DataBaseId,
                                    OsClient = osClientModel.OsClient,
                                    DbSession = dbSessionDataBase
                                });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象
                                if (dbOpResult.Code != 1)
                                {
                                    trans.Rollback();
                                    return dbOpResult;
                                }

                            }

                            param.NameConfirm = 1;
                        }

                        //iTdos数据库中修改数据
                        #region  通用修改
                        //TODO 注意：这里当param.Id为null时，也会把model的Id设置为null，这时更新就会返回0，应该是MapNotNull的bug，需要解决
                        //TableId也是一样
                        param.Id = fieldModel.Id;
                        //param.TableId = fieldModel.TableId;
                        param.TableId = (string)diyTableModel.Id;
                        fieldModel = MapperHelper.MapNotNull<object, DiyField>(param);
                        #endregion end
                        fieldModel.UpdateTime = DateTime.Now;

                        //var count = DiyFieldRepository.Update(fieldModel);
                        var count = trans.Update(fieldModel);
                        trans.Commit();
                        //DiyFieldCache.DelDiyFieldModel(fieldModel, param.OsClient);
                        //DiyFieldCache.DelDiyFieldList(fieldModel.TableId, param.OsClient);
                        await CacheClear(osClientModel.OsClient,null, "diy_field", 
                                FormSubmitType.Upt, new JObject()
                                {
                                    ["TableId"] = fieldModel.TableId,
                                });
                        return new DosResult(1, fieldModel, "");
                    }
                }
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message == null ? "" : ex.InnerException.Message)) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResult(0, null, ex.Message + "[UptDiyField]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        public async Task<DosResult> UptDiyFieldList(DiyFieldParam param)
        {
            #region Check
            if (
                param._FieldList.DosIsNullOrWhiteSpace()
                || param.TableId.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            var osClientModel = OsClientExtend.GetClient(param.OsClient);
            IMicroiDbSession dbSession = osClientModel.Db;
            IMicroiDbSession dbRead = osClientModel.DbRead;
            var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
            //var diyTableModel = dbRead.From<DiyTable>()
            //                            .Select(_diyTableFields)
            //                            .Where(d => d.Id == param.TableId)
            //                            .First();
            var diyTableModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<DiyTable>(new
            {
                FormEngineKey = "Diy_Table",
                _Where = new List<DiyWhere>() { new DiyWhere() {
                                    Name = "Id", Value = param.TableId, Type = "="
                                },new DiyWhere() {
                                    Name = "Name", Value = param.TableName, Type = "=", AndOr = "Or"
                                } },
                //Id = param.TableId,
                //Name = param.TableName,
                //IsDeleted = 0,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser,

            });
            if (diyTableModelResult.Code != 1)
            {
                return new DosResult(0, null, diyTableModelResult.Msg);
            }
            var diyTableModel = diyTableModelResult.Data;

            if (diyTableModel == null)
            {
                return new DosResult(0, null, "不存在的Table！");
            }
            var newFieldList = JsonHelper.Deserialize<List<DiyField>>(param._FieldList);
            newFieldList = newFieldList.OrderBy(d => d.Sort).ToList();
            var newSort = 100;
            newFieldList.ForEach(d =>
            {
                d.Sort = newSort;
                newSort = newSort + 100;
            });
            // 【重要】.From<T>() 必须使用 Dos.ORM
            var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
            var oldFieldList = dosOrmDbRead.From<DiyField>().Where(d => d.Id.In(newFieldList.Select(o => o.Id).ToList()))
                                        .ToList();
            #endregion
            try
            {
                if (dbSession != null)
                {
                    using (var trans = dbSession.BeginTransaction())
                    {
                        var count = 0;
                        foreach (var newField in newFieldList)
                        {
                            newField.Name = DiyCommon.FilterTableFieldName(newField.Name.DosTrim());
                            // if (CantAddField.Contains(newField.Name))
                            // {
                            //     return new DosResult(0, null, "系统内置字段名，请更换：" + newField.Name);
                            // }
                            var oldModel = oldFieldList.FirstOrDefault(d => d.Id == newField.Id);
                            if (oldModel == null)
                            {
                                continue;
                            }
                            var dbSessionDataBase = OsClientExtend.GetClientDbSession(osClientModel, diyTableModel.DataBaseId);

                            //如果修改了列名
                            if (oldModel.Name != newField.Name || oldModel.Type != newField.Type)
                            {

                                ////判断字段是否已存在
                                //if (oldModel.Name != newField.Name
                                //    && DiyFieldRepository.First(d => d.TableId == param.TableId
                                //                                        && d.Id != oldModel.Id
                                //                                        && d.Name == newField.Name) != null)
                                //{
                                //    trans.Rollback();
                                //    return new DosResult(0, null, "已存在该字段！" + newField.Name);
                                //}
                                //注意：如分割线等一些字段，是不需要操作客户的数据库的
                                if (!oldModel.Type.DosIsNullOrWhiteSpace() && !DiyCommon.NotRealField.Any(d => d == oldModel.Component))
                                {

                                    // //如果是地图控件，额外存2个字段
                                    // if (newField.Component == "Map")
                                    // {
                                    //     //在客户数据库表中创建列
                                    //     //count2 += trans.FromSql(
                                    //     //        string.Format(@"ALTER TABLE `{0}` CHANGE `{1}` `{2}` {3} COMMENT '{4}';",
                                    //     //            diyTableModel.Name,
                                    //     //            oldModel.Name,
                                    //     //            newField.Name,
                                    //     //            "varchar(255)",//param.Type,
                                    //     //            param.Label
                                    //     //        )
                                    //     //    )
                                    //     //    .ExecuteNonQuery();

                                    //     _microiPlugins.Db(dbInfo.DbType).ChangeColumn(new DbServiceParam()
                                    //     {
                                    //         TableName = diyTableModel.Name,
                                    //         Field = new DiyField()
                                    //         {
                                    //             Name = oldModel.Name,
                                    //             _NewName = newField.Name,
                                    //             Type = "varchar(255)",
                                    //             _NotNull = false,
                                    //             Label = param.Label
                                    //         },
                                    //         OsClientModel = osClientModel,
                                    //         DbInfo = dbInfo,
                                    //         DataBaseId = diyTableModel.DataBaseId,
                                    //         OsClient = osClientModel.OsClient,
                                    //         DbSession = dbSessionDataBase
                                    //     });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象

                                    //     //在客户数据库表中创建列
                                    //     //count2 += trans.FromSql(
                                    //     //        string.Format(@"ALTER TABLE `{0}` CHANGE `{1}` `{2}` {3} COMMENT '{4}';",
                                    //     //            diyTableModel.Name,
                                    //     //            oldModel.Name + "_Lng",
                                    //     //            newField.Name + "_Lng",
                                    //     //            "decimal(18, 7)",
                                    //     //            param.Label + "经度"
                                    //     //        )
                                    //     //    )
                                    //     //    .ExecuteNonQuery();
                                    //     _microiPlugins.Db(dbInfo.DbType).ChangeColumn(new DbServiceParam()
                                    //     {
                                    //         TableName = diyTableModel.Name,
                                    //         Field = new DiyField()
                                    //         {
                                    //             Name = oldModel.Name + "_Lng",
                                    //             _NewName = newField.Name + "_Lng",
                                    //             Type = "decimal(18, 7)",
                                    //             _NotNull = false,
                                    //             Label = param.Label + "经度"
                                    //         },
                                    //         OsClientModel = osClientModel,
                                    //         DbInfo = dbInfo,
                                    //         DataBaseId = diyTableModel.DataBaseId,
                                    //         OsClient = osClientModel.OsClient,
                                    //         DbSession = dbSessionDataBase
                                    //     });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象
                                    //     //在客户数据库表中创建列
                                    //     //count2 += trans.FromSql(
                                    //     //        string.Format(@"ALTER TABLE `{0}` CHANGE `{1}` `{2}` {3} COMMENT '{4}';",
                                    //     //            diyTableModel.Name,
                                    //     //            oldModel.Name + "_Lat",
                                    //     //            newField.Name + "_Lat",
                                    //     //            "decimal(18, 7)",
                                    //     //            param.Label + "纬度"
                                    //     //        )
                                    //     //    )
                                    //     //    .ExecuteNonQuery();
                                    //     _microiPlugins.Db(dbInfo.DbType).ChangeColumn(new DbServiceParam()
                                    //     {
                                    //         TableName = diyTableModel.Name,
                                    //         Field = new DiyField()
                                    //         {
                                    //             Name = oldModel.Name + "_Lat",
                                    //             _NewName = newField.Name + "_Lat",
                                    //             Type = "decimal(18, 7)",
                                    //             _NotNull = false,
                                    //             Label = param.Label + "纬度"
                                    //         },
                                    //         OsClientModel = osClientModel,
                                    //         DbInfo = dbInfo,
                                    //         DataBaseId = diyTableModel.DataBaseId,
                                    //         OsClient = osClientModel.OsClient,
                                    //         DbSession = dbSessionDataBase
                                    //     });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象
                                    // }
                                    // else
                                    {
                                        //在客户数据库表中创建列
                                        //count2 += trans.FromSql(
                                        //        string.Format(@"ALTER TABLE `{0}` CHANGE `{1}` `{2}` {3} COMMENT '{4}';",
                                        //            diyTableModel.Name,
                                        //            oldModel.Name,
                                        //            newField.Name,
                                        //            newField.Type,
                                        //            "null",
                                        //            param.Label
                                        //        )
                                        //    )
                                        //    .ExecuteNonQuery();
                                        var dbOpResult = MicroiEngine.ORM(dbInfo.DbType).ChangeColumn(new DbServiceParam()
                                        {
                                            TableName = diyTableModel.Name,
                                            // Field = new DiyField()
                                            // {
                                            //     Name = oldModel.Name,
                                            //     _NewName = newField.Name,
                                            //     Type = newField.Type,
                                            //     _OldType = oldModel.Type,
                                            //     _NotNull = false,
                                            //     Label = param.Label
                                            // },

                                            FieldName = oldModel.Name,
                                            NewFieldName = newField.Name,
                                            FieldType = newField.Type,
                                            OldFieldType = oldModel.Type,
                                            FieldLabel = param.Label,

                                            OsClientModel = osClientModel,
                                            DbInfo = dbInfo,
                                            DataBaseId = diyTableModel.DataBaseId,
                                            OsClient = osClientModel.OsClient,
                                            DbSession = dbSessionDataBase
                                        });//, trans  可能是在扩展中操作，所以暂时不传入主库的trans对象
                                        if (dbOpResult.Code != 1)
                                        {
                                            trans.Rollback();
                                            return dbOpResult;
                                        }
                                    }
                                }
                                newField.NameConfirm = 1;
                            }

                            #region  通用修改
                            oldModel = MapperHelper.MapNotNull<object, DiyField>(newField);
                            #endregion end
                            oldModel.UpdateTime = DateTime.Now;

                            count += trans.Update(oldModel);
                            //DiyFieldCache.DelDiyFieldModel(oldModel, param.OsClient);
                            await CacheClear(osClientModel.OsClient,null, "diy_field", 
                                FormSubmitType.Upt, new JObject()
                                {
                                    ["TableId"] = newField.TableId,
                                });
                        }
                        //DiyFieldCache.DelDiyFieldList(param.TableId, param.OsClient);
                        trans.Commit();
                        return new DosResult(1);
                    }
                }
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {


                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message == null ? "" : ex.InnerException.Message)) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResult(0, null, ex.Message + "[UptDiyFieldList]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 删除菜单，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelDiyField(DiyFieldParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            // 【重要】.From<T>() 必须使用 Dos.ORM
            var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
            //var model = DiyFieldRepository.First(d => d.Id == param.Id);
            var model = dosOrmDbRead.From<DiyField>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, "不存在的DiyField数据，Id：" + param.Id);
            }
            try
            {
                if (dbSession != null)
                {
                    using (var trans = dbSession.BeginTransaction())
                    {
                        //查询TableName
                        //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
                        //if (diyTableModel == null)
                        //{
                        //    return new DosResult(0, null, "不存在的Table！");
                        //}

                        ////如果修改了列名
                        //if (model.Name != param.Name)
                        //{
                        //    //在客户数据库表中创建列
                        //    count2 += trans.FromSql(
                        //            string.Format(@"ALTER TABLE `{0}` CHANGE `{1}` `{2}` {3};",
                        //                diyTableModel.Name,
                        //                model.Name,
                        //                param.Name,
                        //                param.Type,
                        //                "null"
                        //            )
                        //        )
                        //        .ExecuteNonQuery();
                        //}

                        //iTdos数据库中修改数据
                        #region  通用修改
                        //var modelJson = JObject.Parse(JsonHelper.Serialize(model));
                        //var paramJson = JObject.Parse(JsonHelper.Serialize(param));
                        //var modelList = modelJson.Properties();
                        //var paramList = paramJson.Properties();
                        //foreach (var l in modelList)
                        //{
                        //    if (paramList.Any(d => d.Name == l.Name))
                        //    {
                        //        var val = paramList.First(d => d.Name == l.Name).Value;
                        //        if (val.Type == JTokenType.Object || val.Type == JTokenType.Array || (val.Type != JTokenType.Null && ((Newtonsoft.Json.Linq.JValue)(val)).Value != null))
                        //        {
                        //            if (val.Type == JTokenType.Object || val.Type == JTokenType.Array) { l.Value = JsonHelper.Serialize(val); } else { l.Value = val; }
                        //        }
                        //    }
                        //}
                        //model = JsonHelper.Deserialize<DiyField>(JsonHelper.Serialize(modelJson));
                        //model = MapperHelper.MapNotNull<object, DiyField>(param);
                        model = MapperHelper.MapNotNull(param, model);


                        #endregion end
                        model.UpdateTime = DateTime.Now;
                        model.IsDeleted = 1;


                        //var count = DiyFieldRepository.Update(model);
                        var count = trans.Update(model);
                        if (count > 0)
                        {
                            MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                            {
                                Type = "DIY数据删除",
                                Title = (param._CurrentUser == null ? "" : param._CurrentUser?["Account"].Val<string>()) + "删除了字段",
                                Content = "param：" + JsonHelper.Serialize(param),
                                //IP = IPHelper.GetClientIP(HttpContext),
                                OsClient = param.OsClient
                            });
                            trans.Commit();
                            //DiyFieldCache.DelDiyFieldModel(model, param.OsClient);
                            //DiyFieldCache.DelDiyFieldList(model.TableId, model.OsClient);
                            await CacheClear(param.OsClient,null, "diy_field", 
                                FormSubmitType.Del, new JObject()
                                {
                                    ["TableId"] = model.TableId,
                                });
                            return new DosResult(1, model, "");
                        }
                        else
                        {
                            trans.Rollback();
                        }
                    }
                }
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message == null ? "" : ex.InnerException.Message)) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResult(0, null, ex.Message + "[DelDiyField]", null, new
                {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 
        /// </summary>
        public class FULL_COLUMNS
        {
            /// <summary>
            /// 
            /// </summary>
            public string Field { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Type { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Collation { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Null { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Key { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Default { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public string Comment { get; set; }
        }

        /// <summary>
        /// 必传：TableId
        /// 此方法内部禁止使用FormEngine对象，否则可能导致死循环
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<JObject>> GetDiyField(DiyFieldParam param)
        {
            #region Check
            if (param.TableId.DosIsNullOrWhiteSpace() && param.TableName.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            #endregion
            try
            {
                var tableIdOrName = !param.TableId.DosIsNullOrWhiteSpace() ? param.TableId : param.TableName;
                //缓存
                var cache = MicroiEngine.CacheTenant.Cache(param.OsClient);
                var cacheFieldList = BuildCacheKey(param.OsClient, ":FormData:diy_table_field_list:", tableIdOrName);
                var diyTableCache = await cache.GetAsync<List<JObject>>(cacheFieldList);
                if (diyTableCache != null)
                {
                    if (param.IsDeleted != null)
                    {
                        diyTableCache = diyTableCache.Where(d => d["IsDeleted"].Val<int>() == param.IsDeleted).ToList();
                    }
                    else
                    {
                        diyTableCache = diyTableCache.Where(d => d["IsDeleted"].Val<int>() != 1).ToList();
                    }
                    if(param._OnlyRealField == true)
                    {
                        diyTableCache = diyTableCache.Where(d => d["Type"] != null && d["Type"].Val<string>() != ""
                                        && !DiyCommon.NotRealField.Contains(d["Component"].Val<string>())).ToList();
                    }
                    if (param._SelectFields.Any())
                    {
                        diyTableCache = diyTableCache.Where(d => param._SelectFields.Contains(d["Name"].Val<string>())).ToList();
                    }
                    return new DosResultList<JObject>(1, diyTableCache);
                }

                var osClientModel = OsClientExtend.GetClient(param.OsClient);
                IMicroiDbSession dbSession = osClientModel.DbRead;
                var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
                if (dbSession != null)
                {
                    var _where = new Where<DiyTable>();
                    
                    if (!param.TableId.DosIsNullOrWhiteSpace())
                    {
                        _where.And(d => d.Id == param.TableId);
                    }
                    else if (!param.TableName.DosIsNullOrWhiteSpace())
                    {
                        _where.And(d => d.Name == param.TableName);
                    }

                    dynamic diyTableModel = null;
                    if (param._DiyTableModel != null)
                    {
                        diyTableModel = param._DiyTableModel;
                    }
                    else
                    {
                        //先看缓存有没有
                        var cacheKey = BuildCacheKey(param.OsClient, ":FormData:diy_table:", tableIdOrName);
                        diyTableModel = await cache.GetAsync<dynamic>(cacheKey);
                        if (diyTableModel == null)
                        {
                            // 【重要】.From<T>() 必须使用 Dos.ORM
                            var dosOrmDbRead2 = osClientModel.DosOrmDbRead;
                            diyTableModel = dosOrmDbRead2.From<DiyTable>()
                                .Select(_cachedDiyTableFields)
                                //.Where(d => d.Id == (param.TableId ?? "") || d.Name == (param.TableName ?? ""))
                                .Where(_where)
                                .First<DiyTable>();
                        }
                    }

                    var tableId = (string)diyTableModel.Id;
                    var result = new List<JObject>();
                    var isCache = false;
                    var where = new Where<DiyField>();
                    where.And(d => d.TableId == tableId);
          
                    // 【重要】.From<T>() 必须使用 Dos.ORM
                    var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
                    var fs = dosOrmDbRead.From<DiyField>()
                        .Where(where);


                    fs.OrderBy(DiyField._.Sort.Asc);
                    if (param._Cache != null)
                    {
                        fs.SetCacheTimeOut(param._Cache.Value);
                    }
                    var dynamicResult = fs.ToList<dynamic>();
                    result = JArray.FromObject(dynamicResult).ToObject<List<JObject>>();

                    //设置缓存
                    cache.SetAsync(cacheFieldList, result);

                    if (param.IsDeleted != null)
                    {
                        result = result.Where(d => d["IsDeleted"].Val<int>() == param.IsDeleted).ToList();
                    }
                    else
                    {
                        result = result.Where(d => d["IsDeleted"].Val<int>() != 1).ToList();
                    }
                    if(param._OnlyRealField == true)
                    {
                        result = result.Where(d => d["Type"] != null && d["Type"].Val<string>() != ""
                                        && !DiyCommon.NotRealField.Contains(d["Component"].Val<string>())).ToList();
                    }
                    if (param._SelectFields.Any())
                    {
                        result = result.Where(d => param._SelectFields.Contains(d["Name"].Val<string>())).ToList();
                    }

                    foreach (var item in result)
                    {
                        item["TableName"] = (string)diyTableModel.Name;
                        item["TableDescription'"] = (string)diyTableModel.Description;
                    }
                    return new DosResultList<JObject>(1, result);
                }
                return new DosResultList<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {


                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message == null ? "" : ex.InnerException.Message)) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResultList<JObject>(0, null, ex.Message, null, new {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 必传：TableId
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<JObject>> GetDiyFieldByDiyTables(DiyFieldParam param)
        {
            #region Check
            if ((param.TableIds == null || !param.TableIds.Any())
                && (param.TableNames == null || !param.TableNames.Any())
                && param.SysMenuId.DosIsNullOrWhiteSpace()
                && param._SysMenuId.DosIsNullOrWhiteSpace()
                && param._ModuleEngineKey.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResultList<JObject>(1, new List<JObject>());
            }
            if (param.TableIds == null)
            {
                param.TableIds = new List<string>();
            }
            if (param.TableNames == null)
            {
                param.TableNames = new List<string>();
            }
            if (param.SysMenuId.DosIsNullOrWhiteSpace() && !param._SysMenuId.DosIsNullOrWhiteSpace())
            {
                param.SysMenuId = param._SysMenuId;
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            #endregion
            try
            {
                //IMicroiDbSession dbSession = DiyDatabase.GetDbSession(param.OsClient);
                // IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
                // if (dbSession != null)
                {
                    //注意：如果传入了SysMenuId，那么需要将SysMenu中的JoinTables里面的TableId也要全部拿出来
                    //暂时未处理_ModuleEngineKey --2025-04-04 --by anderson
                    if (!param.SysMenuId.DosIsNullOrWhiteSpace() || !param._ModuleEngineKey.DosIsNullOrWhiteSpace())
                    {
                        //var sysMenuModelResult = await new SysMenuLogic().GetSysMenuModel(new SysMenuParam()
                        //{
                        //    Id = param.SysMenuId,
                        //    OsClient = param.OsClient,
                        //});
                        var _where = new List<DiyWhere>();
                        var idOrKey = "";
                        if (!param._ModuleEngineKey.DosIsNullOrWhiteSpace())
                        {
                            // _where.Add(new DiyWhere()
                            // {
                            //     Name = "ModuleEngineKey",
                            //     Value = param._ModuleEngineKey,
                            //     Type = "="
                            // });
                            idOrKey = param._ModuleEngineKey;
                        }
                        if (!param.SysMenuId.DosIsNullOrWhiteSpace())
                        {
                            // _where.Add(new DiyWhere()
                            // {
                            //     Name = "Id",
                            //     Value = param.SysMenuId,
                            //     Type = "="
                            // });
                            idOrKey = param.SysMenuId;
                        }
                        // var sysMenuModelResult = await GetFormDataAsync<dynamic>(new
                        // {
                        //     FormEngineKey = "Sys_Menu",
                        //     // Id = param.SysMenuId,
                        //     _Where = _where,
                        //     OsClient = param.OsClient,
                        // });
                        var sysMenuModelResult = await GetSysMenu(idOrKey, param.OsClient, param._Lang);

                        var sysMenuModel = sysMenuModelResult.Data;
                        if (sysMenuModel != null)
                        {
                            var joinTables = (string)sysMenuModel.JoinTables;
                            var diyTableId = (string)sysMenuModel.DiyTableId;
                            if (!joinTables.DosIsNullOrWhiteSpace())
                            {
                                var tables = JsonHelper.Deserialize<List<DiyTable>>(joinTables);
                                param.TableIds.AddRange(tables.Select(d => d.Id).ToList());
                            }
                            if (!diyTableId.DosIsNullOrWhiteSpace())
                            {
                                param.TableIds.Add(diyTableId);
                            }
                        }
                    }
                    if (!param.TableIds.Any() && !param.TableNames.Any())
                    {
                        return new DosResultList<JObject>(0, null, "未找到任何表！");
                    }
                    //先获取 DiyTable的model
                    var diyTableList = new List<dynamic>();
                    // var diyTableList = await new FormEngine().GetDiyTable(new DiyTableParam()
                    // {
                    //     Ids = param.TableIds,
                    //     Names = param.TableNames,
                    //     IsDeleted = 0,
                    //     OsClient = param.OsClient
                    // });
                    // if (diyTableList.Code != 1)
                    // {
                    //     return new DosResultList<DiyField>(0, null, diyTableList.Msg);
                    // }
                    param.TableIds = param.TableIds.Distinct().ToList();
                    foreach (var table in param.TableIds)
                    {
                        var getDiTableResult = await GetDiyTable(table, param.OsClient, param._Lang);
                        if (getDiTableResult.Code == 1)
                        {
                            diyTableList.Add(getDiTableResult.Data);
                        }
                        else
                        {
                            return new DosResultList<JObject>(0, null, getDiTableResult.Msg, null, getDiTableResult.DataAppend);
                        }
                    }
                    param.TableNames = param.TableNames.Distinct().ToList();
                    foreach (var table in param.TableNames)
                    {
                        var getDiTableResult = await GetDiyTable(table, param.OsClient, param._Lang);
                        if (getDiTableResult.Code == 1)
                        {
                            diyTableList.Add(getDiTableResult.Data);
                        }
                        else
                        {
                            return new DosResultList<JObject>(0, null, getDiTableResult.Msg, null, getDiTableResult.DataAppend);
                        }
                    }

                    var result = new List<JObject>();

                    foreach (var diyTable in diyTableList)//.Data
                    {
                        param.TableId = (string)diyTable.Id;
                        param._DiyTableModel = diyTable;
                        var tempFieldList = await GetDiyField(param);
                        if (tempFieldList.Code != 1)
                        {
                            return new DosResultList<JObject>(0, null, tempFieldList.Msg, null, tempFieldList.DataAppend);
                        }
                        result.AddRange(tempFieldList.Data);
                    }
                    return new DosResultList<JObject>(1, result, "", result.Count);
                }
                return new DosResultList<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {


                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = "捕获到异常",
                    Param = JsonHelper.Serialize(param),
                    Content = ex.Message,// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message == null ? "" : ex.InnerException.Message)) + "。-->" + ex.StackTrace,
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
                return new DosResultList<JObject>(0, null, ex.Message, null, new {
                    Param = param,
                    StackTrace = ex.StackTrace
                });
            }
        }
        /// <summary>
        /// 传入Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<JObject>> GetDiyFieldModel(DiyFieldParam param)
        {
            // var msg = "";
            if (param.Id.DosIsNullOrWhiteSpace()
                && param.TableId.DosIsNullOrWhiteSpace()
                && param.Name.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            //IMicroiDbSession dbSession = DiyDatabase.GetDbSession(param.OsClient);
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            JObject model = null;
            var where = new Where<DiyField>();
            if (param.IsDeleted != null)
            {
                where.And(d => d.IsDeleted == param.IsDeleted);
            }
            if (!param.Id.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.Id == param.Id);
            }
            else
            {
                where.And(d => d.TableId == param.TableId && d.Name == param.Name);
            }

            if (model == null)
            {
                // 【重要】.From<T>() 必须使用 Dos.ORM
                var dosOrmDbRead = OsClientExtend.GetClient(param.OsClient).DosOrmDbRead;
                var tempResult = dosOrmDbRead.From<DiyField>()
                            // .Select(_cachedDiyFieldFields)
                            .Where(where)
                            .First<dynamic>();
                if (tempResult == null)
                {
                    return new DosResult<JObject>(0, null, "不存在的DiyField数据，Id：" + param.Id);
                }
                model = JObject.FromObject(tempResult);
            }

            return new DosResult<JObject>(1, model);
        }
        /// <summary>
        /// 
        /// </summary>
        private static async Task<JObject> DefaultParam2(JObject param)
        {
            try
            {
                if (param["OsClient"] == null || param["OsClient"].ToString().DosIsNullOrWhiteSpace())
                {
                    var osClient = DiyTokenExtend.GetCurrentOsClient();
                    param["OsClient"] = osClient;
                }
            }
            catch (Exception ex)
            {

            }
            return param;
        }
        /// <summary>
        /// 从缓存中获取
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult<dynamic>> GetSysMenu(string idOrKey, string osClient, string _Lang = "cn")
        {
            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<dynamic>(0, null, DiyMessage.GetLang(osClient, "ParamError", _Lang));
                }
                //缓存
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var cacheKey = BuildCacheKey(osClient, ":FormData:sys_menu:", idOrKey);
                var sysMenuCache = await cache.GetAsync<JObject>(cacheKey);
                if (sysMenuCache != null)
                {
                    return new DosResult<dynamic>(1, sysMenuCache);
                }

                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(new
                {
                    FormEngineKey = "sys_menu",
                    _Where = new List<DiyWhere>() { new DiyWhere() {
                                    Name = "Id", Value = idOrKey, Type = "="
                                },new DiyWhere() {
                                    Name = "ModuleEngineKey", Value = idOrKey, Type = "=", AndOr = "Or"
                                }},
                    //Id = param.TableId,
                    //Name = param.TableName,
                    //IsDeleted = 0,
                    OsClient = osClient,
                    // _CurrentUser = param._CurrentUser,
                    // 
                });

                if (result.Code == 1)
                {
                    // 转换为 JObject 后再存入缓存，确保序列化后类型一致
                    var jObjectData = result.Data is JObject ? (JObject)result.Data : JObject.FromObject(result.Data);
                    await cache.SetAsync<JObject>(cacheKey, jObjectData);
                }
                return result;
            }
            catch (System.Exception ex)
            {
                return new DosResult<dynamic>(0, null, ex.Message + "[GetSysMenu]", new
                {
                    IdOrKey = idOrKey,
                    OsClient = osClient,
                });
            }
        }
        /// <summary>
        /// 从缓存中获取
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult<dynamic>> GetDiyTable(string idOrName, string osClient, string _Lang = "cn")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(osClient, "ParamError", _Lang));
            }
            //缓存
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var cacheKey = BuildCacheKey(osClient, ":FormData:diy_table:", idOrName);
            var diyTableCache = await cache.GetAsync<JObject>(cacheKey);
            if (diyTableCache != null)
            {
                return new DosResult<dynamic>(1, diyTableCache);
            }

            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(new
            {
                FormEngineKey = "Diy_Table",
                _Where = new List<DiyWhere>() { new DiyWhere() {
                                    Name = "Id", Value = idOrName, Type = "="
                                },new DiyWhere() {
                                    Name = "Name", Value = idOrName, Type = "=", AndOr = "Or"
                                } },
                //Id = param.TableId,
                //Name = param.TableName,
                //IsDeleted = 0,
                OsClient = osClient,
                // _CurrentUser = param._CurrentUser,
                // 
            });

            if (result.Code == 1)
            {
                // 转换为 JObject 后再存入缓存，确保序列化后类型一致
                var jObjectData = result.Data is JObject ? (JObject)result.Data : JObject.FromObject(result.Data);
                await cache.SetAsync<JObject>(cacheKey, jObjectData);
            }
            return result;
        }
    }
}