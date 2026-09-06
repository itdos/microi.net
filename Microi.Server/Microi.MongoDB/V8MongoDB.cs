using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Dynamic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
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
        private static readonly ConcurrentDictionary<string, DateTime> _sysLogCircuitOpenUntil = new ConcurrentDictionary<string, DateTime>();
        private static readonly TimeSpan SysLogCircuitBreakDuration = TimeSpan.FromMinutes(1);

        public V8MongoDBParam DynamicToV8MongoDBParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            V8MongoDBParam param = jobjParam.ToObject<V8MongoDBParam>(DiyCommon.GetJsonSerializer());
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
                // V8 租户隔离：非主库租户的 V8 代码不允许跨租户访问 MongoDB
                param.OsClient = V8TenantContext.EnforceOsClient(param.OsClient);

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
                // ObjectSerializer wraps a Dictionary passed as dynamic in _v, hiding both
                // business fields and the deterministic _id from normal MongoDB queries.
                var result = TMongodbHelper<BsonDocument>.Insert(host, CreateInsertDocument(model));

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
                // V8 租户隔离：非主库租户的 V8 代码不允许跨租户访问 MongoDB
                param.OsClient = V8TenantContext.EnforceOsClient(param.OsClient);

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

        private static BsonDocument CreateInsertDocument(Dictionary<string, object> model)
        {
            return new BsonDocument(model);
        }

        /// <summary>
        /// 按非空 _Where 批量更新。MongoDB 不参与 V8.DbTrans；调用方必须将返回成功
        /// 视为已提交事实，并以稳定业务事件 Id 实现幂等。
        /// </summary>
        public DosResult UptFormDataByWhere(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                param.OsClient = ResolveV8MongoTenant(param.OsClient);
                if (param.OsClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                if (param._FormData == null || param._FormData.Count == 0 || param._Where == null)
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));

                string whereError;
                if (!IsSafeMutationWhere(param._Where, out whereError))
                    return new DosResult(0, null, whereError);

                var filters = new List<FilterDefinition<dynamic>>();
                GetWhereSql(param._Where, filters);
                if (filters.Count == 0)
                    return new DosResult(0, null, "MongoDB 批量更新必须提供有效且非空的 _Where。");

                var updates = new List<UpdateDefinition<dynamic>>();
                foreach (var item in param._FormData)
                {
                    if (!IsSafeMongoFieldName(item.Key)
                        || string.Equals(item.Key, "_id", StringComparison.OrdinalIgnoreCase)
                        || item.Key.StartsWith("_id.", StringComparison.OrdinalIgnoreCase))
                    {
                        return new DosResult(0, null, $"MongoDB 批量更新字段[{item.Key}]无效或不可修改。");
                    }
                    updates.Add(Builders<dynamic>.Update.Set(item.Key, ConvertJTokenToNative(item.Value)));
                }

                var result = MongodbClient<dynamic>.MongodbInfoClient(CreateV8MongoHost(param))
                    .UpdateMany(
                        Builders<dynamic>.Filter.And(filters),
                        Builders<dynamic>.Update.Combine(updates));
                return new DosResult(1, new { result.MatchedCount, result.ModifiedCount });
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
                // V8 租户隔离：非主库租户的 V8 代码不允许跨租户访问 MongoDB
                param.OsClient = V8TenantContext.EnforceOsClient(param.OsClient);

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
                // V8 租户隔离：非主库租户的 V8 代码不允许跨租户访问 MongoDB
                param.OsClient = V8TenantContext.EnforceOsClient(param.OsClient);

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
                // V8 租户隔离：非主库租户的 V8 代码不允许跨租户访问 MongoDB
                param.OsClient = V8TenantContext.EnforceOsClient(param.OsClient);

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
                var sortField = param._OrderBy.DosIsNullOrWhiteSpace()
                    ? "CreateTime"
                    : param._OrderBy.Trim();
                if (!IsSafeMongoFieldName(sortField))
                    return new DosResultList<dynamic>(0, null, "MongoDB 排序字段无效。");
                var sort = string.Equals(param._OrderByType?.Trim(), "ASC", StringComparison.OrdinalIgnoreCase)
                    ? Builders<dynamic>.Sort.Ascending(sortField)
                    : Builders<dynamic>.Sort.Descending(sortField);
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

        private static bool IsSafeMongoFieldName(string value)
        {
            return !value.DosIsNullOrWhiteSpace()
                && Regex.IsMatch(value, "^[A-Za-z_][A-Za-z0-9_.]{0,127}$", RegexOptions.CultureInvariant);
        }

        private static string ResolveV8MongoTenant(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = V8TenantContext.Current?.OsClient;
                if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient();
            }
            return V8TenantContext.EnforceOsClient(osClient);
        }

        private static bool IsSafeMutationWhere(object whereObject, out string error)
        {
            error = "MongoDB 批量写入必须提供有效、非空且参数化的 _Where。";
            JArray conditions;
            try
            {
                conditions = whereObject as JArray ?? JArray.FromObject(whereObject);
            }
            catch
            {
                return false;
            }

            if (conditions.Count == 0) return false;
            foreach (var token in conditions)
            {
                var condition = token as JArray;
                if (condition == null) return false;
                var parts = condition
                    .Where(item => item.Type != JTokenType.String
                                   || (item.Val<string>() != "(" && item.Val<string>() != ")"))
                    .ToList();
                var offset = parts.Count >= 4 && IsMutationLogicOperator(parts[0].Val<string>()) ? 1 : 0;
                if (parts.Count - offset < 3) return false;

                var field = parts[offset].Val<string>()?.Trim();
                var operatorText = parts[offset + 1].Val<string>()?.Trim();
                if (!IsSafeMongoFieldName(field)
                    || operatorText.DosIsNullOrWhiteSpace()
                    || !DiyCommon.FieldWhereTypes.ContainsKey(operatorText)
                    || parts[offset + 2].Type == JTokenType.Null
                    || parts[offset + 2].Type == JTokenType.Undefined)
                {
                    return false;
                }
            }

            error = null;
            return true;
        }

        private static bool IsMutationLogicOperator(string value)
        {
            return string.Equals(value, "AND", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "OR", StringComparison.OrdinalIgnoreCase)
                || value == "&&"
                || value == "||";
        }

        private static MongodbHost CreateV8MongoHost(V8MongoDBParam param)
        {
            return new MongodbHost
            {
                Connection = OsClient.GetClient(param.OsClient).OsClientModel["DbMongoConnection"].Val<string>(),
                DataBase = param.DbName,
                Table = param.TableName
            };
        }
        public async Task<DosResult> AddSysLog(SysLogParam param)
        {
            if (param == null) return new DosResult(0, null, "日志参数不能为空。");

            // 所有历史调用统一收口到后台队列，避免调用方忘记await而造成不可控并发和日志丢失。
            var queue = MicroiEngine.SysLogQueue;
            if (queue != null)
            {
                return queue.Enqueue(param)
                    ? new DosResult(1, param.EventId, "日志已进入异步持久化队列。")
                    : new DosResult(0, null, "日志队列拒绝了该事件。");
            }

            // 单元测试、迁移工具等未启动Web宿主的场景仍保持可用。
            return await AddSysLogs(new[] { param }).ConfigureAwait(false);
        }

        public async Task<DosResult> AddSysLogs(IReadOnlyCollection<SysLogParam> parameters)
        {
            try
            {
                var items = parameters?.Where(d => d != null).ToList() ?? new List<SysLogParam>();
                if (items.Count == 0) return new DosResult(1, 0);

                foreach (var param in items)
                {
                    if (param.OsClient.DosIsNullOrWhiteSpace()) param.OsClient = DiyToken.GetCurrentOsClient();
                    if (param.OsClient.DosIsNullOrWhiteSpace())
                        return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                    if (param.OccurredAt == null) param.OccurredAt = DateTime.Now;
                    if (param.EventId.DosIsNullOrWhiteSpace()) param.EventId = Ulid.NewUlid().ToString();
                }

                var persisted = 0;
                var groups = items.GroupBy(d => new
                {
                    OsClient = d.OsClient.ToLowerInvariant(),
                    Month = d.OccurredAt.GetValueOrDefault().ToString("yyyyMM")
                });

                foreach (var group in groups)
                {
                    // Group key is lower-cased only for case-insensitive batching. Runtime SaaS
                    // lookup must retain/canonicalize the configured OsClient casing (for example
                    // iTdos), otherwise OsClient.GetClient("itdos") cannot find a case-sensitive
                    // ClientList entry and every log batch is needlessly sent to spool.
                    var host = CreateTenantMongoHost(group.First().OsClient, "log_" + group.Key.Month);
                    var circuitKey = BuildSysLogCircuitKey(host);
                    if (_sysLogCircuitOpenUntil.TryGetValue(circuitKey, out var openUntil) && openUntil > DateTime.UtcNow)
                        return new DosResult(0, null, "MongoDB sys log is temporarily unavailable.");

                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var writes = new List<WriteModel<SysLog>>();
                    foreach (var param in group)
                    {
                        var model = MapperHelper.Map<SysLogParam, SysLog>(param);
                        model.Id = param.EventId;
                        model.EventId = param.EventId;
                        model.CreateTime = param.OccurredAt.GetValueOrDefault();
                        writes.Add(new ReplaceOneModel<SysLog>(
                            Builders<SysLog>.Filter.Eq(d => d.Id, model.Id), model)
                        { IsUpsert = true });
                    }

                    try
                    {
                        var writeResult = await collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }).ConfigureAwait(false);
                        if (!writeResult.IsAcknowledged)
                            return new DosResult(0, null, "MongoDB did not acknowledge sys log persistence.");
                        await EnsureSysLogIndexesAsync(host).ConfigureAwait(false);
                        _sysLogCircuitOpenUntil.TryRemove(circuitKey, out _);
                        persisted += writes.Count;
                    }
                    catch
                    {
                        _sysLogCircuitOpenUntil[circuitKey] = DateTime.UtcNow.Add(SysLogCircuitBreakDuration);
                        throw;
                    }
                }

                return new DosResult(1, persisted);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 按非空 _Where 批量删除。拒绝空条件，避免脚本误删整个集合。
        /// </summary>
        public DosResult DelFormDataByWhere(dynamic dynamicParam)
        {
            try
            {
                V8MongoDBParam param = DynamicToV8MongoDBParam(dynamicParam);
                param.OsClient = ResolveV8MongoTenant(param.OsClient);
                if (param.OsClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
                if (param._Where == null)
                    return new DosResult(0, null, "MongoDB 批量删除必须提供有效且非空的 _Where。");

                string whereError;
                if (!IsSafeMutationWhere(param._Where, out whereError))
                    return new DosResult(0, null, whereError);

                var filters = new List<FilterDefinition<dynamic>>();
                GetWhereSql(param._Where, filters);
                if (filters.Count == 0)
                    return new DosResult(0, null, "MongoDB 批量删除必须提供有效且非空的 _Where。");

                var result = MongodbClient<dynamic>.MongodbInfoClient(CreateV8MongoHost(param))
                    .DeleteMany(Builders<dynamic>.Filter.And(filters));
                return new DosResult(1, new { result.DeletedCount });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        public async Task<DosResultList<SysLog>> GetSysLog(SysLogParam param)
        {
            try
            {
                return await GetSysLogCore(param).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return new DosResultList<SysLog>(0, null, ex.Message);
            }
        }

        private async Task<DosResultList<SysLog>> GetSysLogCore(SysLogParam param)
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
            var host = CreateTenantMongoHost(param.OsClient, tableName);

            // 确保范围索引存在（CreateTime/Type/Level），提升排序和筛选性能
            await EnsureSysLogIndexesAsync(host);
            string[] field = null;//new SysLog().GetFields().Select(d => d.Name).ToArray();
            var sort = Builders<SysLog>.Sort.Descending("CreateTime");
            var list = new List<FilterDefinition<SysLog>>();
            var hasKeyword = false;

            // var where = new Where<SysLog>();
            if (!param._Keyword.DosIsNullOrWhiteSpace())
            {
                hasKeyword = true;
                // 保留旧日志页最常用的“标题、内容、用户、IP”搜索，并补充 TraceId。
                // Regex 无法使用 B-Tree；下方固定 Hint CreateTime 索引并采用“多取一条”，
                // 避免再为关键字搜索执行一次完整 Count。
                var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(param._Keyword), "i");
                list.Add(Builders<SysLog>.Filter.Or(
                    Builders<SysLog>.Filter.Regex(d => d.Title, rx),
                    Builders<SysLog>.Filter.Regex(d => d.Content, rx),
                    Builders<SysLog>.Filter.Regex(d => d.UserName, rx),
                    Builders<SysLog>.Filter.Regex(d => d.IP, rx),
                    Builders<SysLog>.Filter.Regex(d => d.TraceId, rx)
                ));
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
            if (!param.Type.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Where(d => d.Type == param.Type));
            }
            if (!param.Category.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.Category, param.Category.Trim()));
            }
            if (!param.Action.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.Action, param.Action.Trim()));
            }
            if (!param.Source.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.Source, param.Source.Trim()));
            }
            if (!param.IP.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.IP, param.IP.Trim()));
            }
            if (!param.UserId.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.UserId, param.UserId.Trim()));
            }
            if (!param.TraceId.DosIsNullOrWhiteSpace())
            {
                list.Add(Builders<SysLog>.Filter.Eq(d => d.TraceId, param.TraceId.Trim().ToLowerInvariant()));
            }
            //DbSession dbSession = DiyDatabase.GetDbSession(param.OsClient);
            //DbSession dbSession = OsClient.GetClient(param.OsClient).DbRead;
            //var fs = dbSession.From<SysLog>()
            //    .Where(where);
            //var dataCount = fs.Count();
            var filter = list.Count > 0 ? Builders<SysLog>.Filter.And(list) : Builders<SysLog>.Filter.Empty;

            // ========== 关键字搜索：Hint 强制走 CreateTime 降序索引 ==========
            // Regex 无法使用 B-Tree 索引，默认 COLLSCAN + 内存排序 ＝ 全表扫描 39 万条要 3 分钟。
            // Hint 让 MongoDB 按 CreateTime DESC 索引顺序逐条扫描，
            // 每条文档检查 Regex，找到 pageSize 条就停。第一页几乎瞬间返回。
            // Count 用"多取 1 条"判断是否有下一页，不再做独立计数。
            if (hasKeyword)
            {
                var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                var pageIndex = param._PageIndex ?? 1;
                var pageSize = param._Top ?? param._PageSize ?? 20;
                var hintValue = new BsonString("idx_CreateTime_desc");

                // 多取 1 条：判断是否有下一页
                var data = await collection.Find(filter, new FindOptions(){
                        Hint = hintValue,
                    })
                    .Sort(sort)
                    // .Hint(hintValue)
                    .Skip((pageIndex - 1) * pageSize)
                    .Limit(pageSize + 1)
                    .ToListAsync();

                bool hasMore = data.Count > pageSize;
                if (hasMore) data.RemoveAt(data.Count - 1);

                // DataCount：若有更多则返回 (当前页位置 + pageSize + 1)，前端显示"N+"；否则返回精确值
                int dataCount2 = hasMore
                    ? (int)pageIndex * pageSize + 1
                    : (int)(pageIndex - 1) * pageSize + data.Count;

                return new DosResultList<SysLog>(1, data, "", dataCount2);
            }

            // ========== 非关键字查询（走索引，性能正常） ==========
            Task<long> countTask;
            if (list.Count == 0)
                countTask = TMongodbHelper<SysLog>.CountEstimatedAsync(host);
            else
                countTask = TMongodbHelper<SysLog>.CountAsync(host, filter);

            // Count 和分页查询并行执行，减少总等待时间
            Task<List<SysLog>> dataTask;
            if (param._Top != null)
            {
                dataTask = TMongodbHelper<SysLog>.FindListByPageAsync(host, filter, 1, param._Top.Value, field, sort);
            }
            else if (param._PageSize != null && param._PageIndex != null)
            {
                dataTask = TMongodbHelper<SysLog>.FindListByPageAsync(host, filter, param._PageIndex.Value, param._PageSize.Value, field, sort);
            }
            else
            {
                dataTask = TMongodbHelper<SysLog>.FindListByPageAsync(host, filter, 1, 20, field, sort);
            }

            await Task.WhenAll(countTask, dataTask);
            var dataCount = countTask.Result;
            var result = dataTask.Result;
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

        public async Task<DosResultList<SysLog>> GetTraceTimeline(SysLogTraceQueryParam param)
        {
            try
            {
                if (param == null || param.OsClient.DosIsNullOrWhiteSpace())
                    return new DosResultList<SysLog>(0, null, "OsClient不能为空。");
                var traceId = (param.TraceId ?? "").Trim().ToLowerInvariant();
                if (!Regex.IsMatch(traceId, "^[0-9a-f]{32}$"))
                    return new DosResultList<SysLog>(0, null, "TraceId必须是32位十六进制W3C TraceId。");

                var host = CreateTenantMongoHost(param.OsClient, "");
                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var existingMonths = await GetSystemLogMonthsAsync(database).ConfigureAwait(false);
                var requestedMonth = NormalizeMonth(param.SearchMonth);
                var months = requestedMonth != null
                    ? existingMonths.Where(month => string.Equals(month, requestedMonth, StringComparison.Ordinal)).ToList()
                    : existingMonths.OrderByDescending(month => month).Take(3).ToList();
                var max = Math.Max(1, Math.Min(500, param.PageSize));
                var rows = new List<SysLog>();
                foreach (var month in months)
                {
                    host.Table = "log_" + month;
                    await EnsureSysLogIndexesAsync(host).ConfigureAwait(false);
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var remaining = max - rows.Count;
                    if (remaining <= 0) break;
                    var monthRows = await collection
                        .Find(Builders<SysLog>.Filter.Eq(d => d.TraceId, traceId))
                        .Sort(Builders<SysLog>.Sort.Ascending(d => d.CreateTime).Ascending(d => d.Id))
                        .Limit(remaining)
                        .ToListAsync()
                        .ConfigureAwait(false);
                    rows.AddRange(monthRows);
                }
                rows = rows.OrderBy(row => row.CreateTime).ThenBy(row => row.Id, StringComparer.Ordinal).Take(max).ToList();
                return new DosResultList<SysLog>(1, rows, "", rows.Count);
            }
            catch (Exception ex)
            {
                return new DosResultList<SysLog>(0, null, ex.Message);
            }
        }

        public async Task<DosResult<SysLogSignalResult>> QuerySystemLogSignal(SysLogSignalQueryParam param)
        {
            try
            {
                if (param == null || param.OsClient.DosIsNullOrWhiteSpace())
                    return new DosResult<SysLogSignalResult>(0, null, "OsClient不能为空。");
                // SysLog.CreateTime follows the historical server-local OccurredAt contract.
                // Convert explicit UTC input to local time; keep Local/Unspecified values unchanged.
                var start = param.WindowStart.Kind == DateTimeKind.Utc
                    ? param.WindowStart.ToLocalTime()
                    : param.WindowStart;
                var end = param.WindowEnd.Kind == DateTimeKind.Utc
                    ? param.WindowEnd.ToLocalTime()
                    : param.WindowEnd;
                if (end <= start || end - start > TimeSpan.FromDays(1))
                    return new DosResult<SysLogSignalResult>(0, null, "日志信号窗口必须大于0且不超过24小时。");
                if ((param.Keyword ?? string.Empty).Length > 100)
                    return new DosResult<SysLogSignalResult>(0, null, "日志关键字最长100个字符。");
                var host = CreateSystemLogHost(param.OsClient, null);
                if (host.Connection.DosIsNullOrWhiteSpace())
                    return new DosResult<SysLogSignalResult>(0, null, "当前租户MongoDB配置不可用。");
                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var existingMonths = await GetSystemLogMonthsAsync(database).ConfigureAwait(false);
                var startMonth = start.ToString("yyyyMM", CultureInfo.InvariantCulture);
                var endMonth = end.ToString("yyyyMM", CultureInfo.InvariantCulture);
                var months = existingMonths
                    .Where(month => string.CompareOrdinal(month, startMonth) >= 0
                                    && string.CompareOrdinal(month, endMonth) <= 0)
                    .OrderBy(month => month, StringComparer.Ordinal)
                    .Take(2)
                    .ToList();
                var result = new SysLogSignalResult { MonthsScanned = months };
                var durations = new List<double>();
                var maxDurationSamples = Math.Max(100, Math.Min(10000, param.MaxDurationSamples));
                var maxEventSamples = Math.Max(0, Math.Min(10, param.MaxEventSamples));
                foreach (var month in months)
                {
                    host = CreateSystemLogHost(param.OsClient, month);
                    await EnsureSysLogIndexesAsync(host).ConfigureAwait(false);
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var filters = new List<FilterDefinition<SysLog>>
                    {
                        Builders<SysLog>.Filter.Gte(row => row.CreateTime, start),
                        Builders<SysLog>.Filter.Lt(row => row.CreateTime, end)
                    };
                    if (!param.Keyword.DosIsNullOrWhiteSpace())
                    {
                        var expression = new BsonRegularExpression(Regex.Escape(param.Keyword.Trim()), "i");
                        filters.Add(Builders<SysLog>.Filter.Or(
                            Builders<SysLog>.Filter.Regex(row => row.Title, expression),
                            Builders<SysLog>.Filter.Regex(row => row.Content, expression)));
                    }
                    if (!param.Type.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Type, param.Type.Trim()));
                    if (!param.Category.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Category, param.Category.Trim()));
                    if (!param.Source.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Source, param.Source.Trim()));
                    if (!param.ServiceName.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.ServiceName, param.ServiceName.Trim()));
                    if (param.LevelMin.HasValue) filters.Add(Builders<SysLog>.Filter.Gte(row => row.Level, param.LevelMin.Value));
                    var filter = Builders<SysLog>.Filter.And(filters);
                    var errorFilter = Builders<SysLog>.Filter.And(filter, Builders<SysLog>.Filter.Or(
                        Builders<SysLog>.Filter.Gte(row => row.Level, 2),
                        Builders<SysLog>.Filter.Eq(row => row.Success, false),
                        Builders<SysLog>.Filter.Gte(row => row.HttpStatusCode, 500)));
                    var totalTask = collection.CountDocumentsAsync(filter);
                    var errorTask = collection.CountDocumentsAsync(errorFilter);
                    var durationBudget = Math.Max(0, maxDurationSamples - durations.Count);
                    var durationTask = durationBudget == 0
                        ? Task.FromResult(new List<double?>())
                        : collection.Find(Builders<SysLog>.Filter.And(
                                filter,
                                Builders<SysLog>.Filter.Ne(row => row.DurationMs, null)))
                            .Sort(Builders<SysLog>.Sort.Descending(row => row.CreateTime))
                            .Limit(durationBudget)
                            .Project(row => row.DurationMs)
                            .ToListAsync();
                    var sampleBudget = Math.Max(0, maxEventSamples - result.Samples.Count);
                    var sampleTask = sampleBudget == 0
                        ? Task.FromResult(new List<SysLog>())
                        : collection.Find(filter)
                            .Sort(Builders<SysLog>.Sort.Descending(row => row.CreateTime).Descending(row => row.Id))
                            .Limit(sampleBudget)
                            .ToListAsync();
                    await Task.WhenAll(totalTask, errorTask, durationTask, sampleTask).ConfigureAwait(false);
                    result.TotalCount += totalTask.Result;
                    result.ErrorCount += errorTask.Result;
                    durations.AddRange(durationTask.Result.Where(value => value.HasValue).Select(value => value.GetValueOrDefault()));
                    foreach (var row in sampleTask.Result)
                    {
                        result.Samples.Add(new SysLogSignalSample
                        {
                            EventId = row.EventId ?? row.Id,
                            TraceId = row.TraceId,
                            ServiceName = row.ServiceName,
                            Type = row.Type,
                            Title = row.Title,
                            Level = row.Level,
                            Success = row.Success,
                            HttpStatusCode = row.HttpStatusCode,
                            CreateTime = row.CreateTime
                        });
                    }
                }
                result.Samples = result.Samples
                    .OrderByDescending(row => row.CreateTime)
                    .Take(maxEventSamples)
                    .ToList();
                result.LastSeenTime = result.Samples.FirstOrDefault()?.CreateTime;
                result.ErrorRate = result.TotalCount == 0
                    ? 0
                    : Math.Round((double)result.ErrorCount / result.TotalCount, 6);
                durations.Sort();
                result.DurationSampleCount = durations.Count;
                result.DurationSampled = result.TotalCount > durations.Count;
                if (durations.Count > 0)
                {
                    var index = Math.Max(0, (int)Math.Ceiling(durations.Count * 0.95) - 1);
                    result.P95DurationMs = Math.Round(durations[index], 4);
                }
                return new DosResult<SysLogSignalResult>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResult<SysLogSignalResult>(0, null, ex.Message);
            }
        }

        public async Task<DosResultList<SysLog>> QuerySystemLogRange(SysLogRangeQueryParam param)
        {
            try
            {
                if (param == null || param.OsClient.DosIsNullOrWhiteSpace())
                    return new DosResultList<SysLog>(0, null, "OsClient不能为空。");

                // SysLog.CreateTime 沿用服务端本地时间契约；接口可统一传 UTC。
                var start = param.WindowStart.Kind == DateTimeKind.Utc
                    ? param.WindowStart.ToLocalTime()
                    : param.WindowStart;
                var end = param.WindowEnd.Kind == DateTimeKind.Utc
                    ? param.WindowEnd.ToLocalTime()
                    : param.WindowEnd;
                if (start == default(DateTime) || end == default(DateTime) || end <= start)
                    return new DosResultList<SysLog>(0, null, "日志明细时间范围无效。");
                if (end - start > TimeSpan.FromDays(400))
                    return new DosResultList<SysLog>(0, null, "日志明细时间范围不能超过400天。");
                if ((param.Keyword ?? string.Empty).Length > 100)
                    return new DosResultList<SysLog>(0, null, "日志关键字最长100个字符。");

                var pageIndex = Math.Max(1, Math.Min(1000000, param.PageIndex));
                var pageSize = Math.Max(1, Math.Min(100, param.PageSize));
                var maxMonths = Math.Max(1, Math.Min(14, param.MaxMonths));
                var host = CreateSystemLogHost(param.OsClient, null);
                if (host.Connection.DosIsNullOrWhiteSpace())
                    return new DosResultList<SysLog>(0, null, "当前租户MongoDB配置不可用。");

                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var existingMonths = await GetSystemLogMonthsAsync(database).ConfigureAwait(false);
                var startMonth = start.ToString("yyyyMM", CultureInfo.InvariantCulture);
                var endMonth = end.ToString("yyyyMM", CultureInfo.InvariantCulture);
                var months = existingMonths
                    .Where(month => string.CompareOrdinal(month, startMonth) >= 0
                                    && string.CompareOrdinal(month, endMonth) <= 0)
                    .OrderByDescending(month => month, StringComparer.Ordinal)
                    .Take(maxMonths)
                    .ToList();
                if (months.Count == 0)
                    return new DosResultList<SysLog>(1, new List<SysLog>(), "", 0);

                var monthQueries = new List<(string Month, MongodbHost Host, IMongoCollection<SysLog> Collection, FilterDefinition<SysLog> Filter)>();
                foreach (var month in months)
                {
                    var monthHost = CreateSystemLogHost(param.OsClient, month);
                    await EnsureSysLogIndexesAsync(monthHost).ConfigureAwait(false);
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(monthHost);
                    var filters = new List<FilterDefinition<SysLog>>
                    {
                        Builders<SysLog>.Filter.Gte(row => row.CreateTime, start),
                        Builders<SysLog>.Filter.Lt(row => row.CreateTime, end)
                    };
                    if (!param.Category.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Category, param.Category.Trim()));
                    if (!param.Action.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Action, param.Action.Trim()));
                    if (!param.Source.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Source, param.Source.Trim()));
                    if (!param.IP.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.IP, param.IP.Trim()));
                    if (!param.UserId.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.UserId, param.UserId.Trim()));
                    if (!param.Api.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(row => row.Api, param.Api.Trim()));
                    if (!param.Keyword.DosIsNullOrWhiteSpace())
                    {
                        var expression = new BsonRegularExpression(Regex.Escape(param.Keyword.Trim()), "i");
                        filters.Add(Builders<SysLog>.Filter.Or(
                            Builders<SysLog>.Filter.Regex(row => row.Title, expression),
                            Builders<SysLog>.Filter.Regex(row => row.Content, expression),
                            Builders<SysLog>.Filter.Regex(row => row.UserName, expression),
                            Builders<SysLog>.Filter.Regex(row => row.IP, expression),
                            Builders<SysLog>.Filter.Regex(row => row.Api, expression),
                            Builders<SysLog>.Filter.Regex(row => row.TargetId, expression),
                            Builders<SysLog>.Filter.Regex(row => row.OtherInfo, expression)));
                    }
                    monthQueries.Add((month, monthHost, collection, Builders<SysLog>.Filter.And(filters)));
                }

                var countTasks = monthQueries
                    .Select(query => query.Collection.CountDocumentsAsync(query.Filter))
                    .ToArray();
                await Task.WhenAll(countTasks).ConfigureAwait(false);
                var counts = countTasks.Select(task => task.Result).ToArray();
                var total = counts.Sum();
                var skip = (long)(pageIndex - 1) * pageSize;
                var rows = new List<SysLog>(pageSize);
                for (var index = 0; index < monthQueries.Count && rows.Count < pageSize; index++)
                {
                    if (skip >= counts[index])
                    {
                        skip -= counts[index];
                        continue;
                    }

                    var query = monthQueries[index];
                    var remaining = pageSize - rows.Count;
                    var page = await query.Collection.Find(query.Filter)
                        .Sort(Builders<SysLog>.Sort.Descending(row => row.CreateTime).Descending(row => row.Id))
                        .Skip((int)skip)
                        .Limit(remaining)
                        .ToListAsync()
                        .ConfigureAwait(false);
                    rows.AddRange(page);
                    skip = 0;
                }

                return new DosResultList<SysLog>(1, rows, "", total > int.MaxValue ? int.MaxValue : (int)total);
            }
            catch (Exception ex)
            {
                return new DosResultList<SysLog>(0, null, ex.Message);
            }
        }

        public async Task<DosResult<SysLogLifecyclePlan>> PlanSystemLogLifecycle(SysLogLifecycleParam param)
        {
            try
            {
                var validation = ValidateLifecycleParam(param, requireRun: false);
                if (validation != null) return new DosResult<SysLogLifecyclePlan>(0, null, validation);
                var host = CreateSystemLogHost(param.OsClient, null);
                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var months = await GetLifecycleMonthsAsync(database, param.CutoffTime, param.MaxCollections).ConfigureAwait(false);
                var result = new SysLogLifecyclePlan { CutoffTime = param.CutoffTime };
                foreach (var month in months)
                {
                    host.Table = "log_" + month;
                    await EnsureSysLogIndexesAsync(host).ConfigureAwait(false);
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var count = await collection.CountDocumentsAsync(BuildLifecycleFilter(param)).ConfigureAwait(false);
                    if (count <= 0) continue;
                    result.Collections.Add(new SysLogLifecycleCollectionPlan { SearchMonth = month, EstimatedCount = count });
                    result.EstimatedCount += count;
                }
                return new DosResult<SysLogLifecyclePlan>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResult<SysLogLifecyclePlan>(0, null, ex.Message);
            }
        }

        public async Task<DosResult<SysLogLifecycleBatch>> ReadSystemLogLifecycleBatch(SysLogLifecycleParam param)
        {
            try
            {
                var validation = ValidateLifecycleParam(param, requireRun: true);
                if (validation != null) return new DosResult<SysLogLifecycleBatch>(0, null, validation);
                var host = CreateSystemLogHost(param.OsClient, null);
                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var months = await GetLifecycleMonthsAsync(database, param.CutoffTime, param.MaxCollections).ConfigureAwait(false);
                var startMonth = NormalizeMonth(param.SearchMonth);
                if (startMonth != null) months = months.Where(month => string.CompareOrdinal(month, startMonth) >= 0).ToList();
                var batchSize = Math.Max(1, Math.Min(500, param.BatchSize));
                for (var index = 0; index < months.Count; index++)
                {
                    var month = months[index];
                    host.Table = "log_" + month;
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var items = await collection.Find(BuildLifecycleFilter(param))
                        .Sort(Builders<SysLog>.Sort.Ascending(d => d.CreateTime).Ascending(d => d.Id))
                        .Limit(batchSize)
                        .ToListAsync()
                        .ConfigureAwait(false);
                    if (items.Count == 0) continue;
                    var sameMonthHasMore = items.Count >= batchSize;
                    var nextMonth = sameMonthHasMore
                        ? month
                        : (index + 1 < months.Count ? months[index + 1] : null);
                    return new DosResult<SysLogLifecycleBatch>(1, new SysLogLifecycleBatch
                    {
                        SearchMonth = month,
                        NextSearchMonth = nextMonth,
                        HasMore = sameMonthHasMore || index + 1 < months.Count,
                        Items = items
                    });
                }
                return new DosResult<SysLogLifecycleBatch>(1, new SysLogLifecycleBatch
                {
                    SearchMonth = startMonth,
                    NextSearchMonth = null,
                    HasMore = false,
                    Items = new List<SysLog>()
                });
            }
            catch (Exception ex)
            {
                return new DosResult<SysLogLifecycleBatch>(0, null, ex.Message);
            }
        }

        public async Task<DosResult<SysLogLifecycleRunState>> CommitSystemLogLifecycleBatch(SysLogLifecycleCommitParam param)
        {
            try
            {
                var validation = ValidateLifecycleParam(param, requireRun: true);
                if (validation != null) return new DosResult<SysLogLifecycleRunState>(0, null, validation);
                var month = NormalizeMonth(param.SearchMonth);
                var eventIds = (param.EventIds ?? new List<string>())
                    .Where(id => !id.DosIsNullOrWhiteSpace()).Select(id => id.Trim())
                    .Distinct(StringComparer.Ordinal).Take(501).ToList();
                if (month == null || eventIds.Count == 0 || eventIds.Count > 500)
                    return new DosResult<SysLogLifecycleRunState>(0, null, "SearchMonth和1至500个EventId不能为空。");
                if (param.ArchiveProofHash.DosIsNullOrWhiteSpace()
                    || !Regex.IsMatch(param.ArchiveProofHash, "^[0-9a-f]{64}$", RegexOptions.IgnoreCase))
                    return new DosResult<SysLogLifecycleRunState>(0, null, "ArchiveProofHash必须是64位十六进制摘要。");
                var deleteOnly = string.Equals(param.ArchiveMode, "DeleteOnly", StringComparison.OrdinalIgnoreCase);
                if (!deleteOnly && param.ArchivePath.DosIsNullOrWhiteSpace())
                    return new DosResult<SysLogLifecycleRunState>(0, null, "归档模式必须提供已回读的ArchivePath。");

                var host = CreateSystemLogHost(param.OsClient, month);
                var database = MongodbClient<SysLog>.MongodbDatabase(host);
                var receipts = database.GetCollection<BsonDocument>("_log_lifecycle_receipts");
                var receiptId = param.RunKey + ":" + param.ArchiveProofHash.ToLowerInvariant();
                var receiptFilter = Builders<BsonDocument>.Filter.Eq("_id", receiptId);
                var existing = await receipts.Find(receiptFilter).FirstOrDefaultAsync().ConfigureAwait(false);
                if (existing != null && existing.GetValue("Status", "").AsString == "Committed")
                    return await GetSystemLogLifecycleRunState(param).ConfigureAwait(false);

                var now = DateTime.UtcNow;
                var receiptUpdate = Builders<BsonDocument>.Update
                    .SetOnInsert("_id", receiptId)
                    .SetOnInsert("OsClient", param.OsClient)
                    .SetOnInsert("RunKey", param.RunKey)
                    .SetOnInsert("PolicyKey", param.PolicyKey ?? "")
                    .SetOnInsert("SearchMonth", month)
                    .SetOnInsert("EventIds", new BsonArray(eventIds))
                    .SetOnInsert("ScannedCount", Math.Max(param.ScannedCount, eventIds.Count))
                    .SetOnInsert("ArchivedCount", deleteOnly ? 0 : Math.Max(param.ArchivedCount, eventIds.Count))
                    .SetOnInsert("ArchivePath", param.ArchivePath ?? "")
                    .SetOnInsert("ArchiveProofHash", param.ArchiveProofHash.ToLowerInvariant())
                    .SetOnInsert("BackgroundTaskId", param.BackgroundTaskId ?? "")
                    .SetOnInsert("FencingToken", param.FencingToken)
                    .SetOnInsert("CreateTime", now)
                    .Set("Status", "ArchiveVerified")
                    .Set("UpdateTime", now);
                await receipts.UpdateOneAsync(receiptFilter, receiptUpdate, new UpdateOptions { IsUpsert = true }).ConfigureAwait(false);

                var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                var deleteFilter = Builders<SysLog>.Filter.And(
                    BuildLifecycleFilter(param),
                    Builders<SysLog>.Filter.In(d => d.Id, eventIds));
                await collection.DeleteManyAsync(deleteFilter).ConfigureAwait(false);
                var remaining = await collection.CountDocumentsAsync(Builders<SysLog>.Filter.In(d => d.Id, eventIds)).ConfigureAwait(false);
                if (remaining != 0)
                    return new DosResult<SysLogLifecycleRunState>(0, null, "归档后日志条件删除回读失败，保留ArchiveVerified收据供重试。");

                await receipts.UpdateOneAsync(receiptFilter, Builders<BsonDocument>.Update
                    .Set("Status", "Committed")
                    .Set("DeletedCount", eventIds.Count)
                    .Set("CommitTime", DateTime.UtcNow)
                    .Set("UpdateTime", DateTime.UtcNow)).ConfigureAwait(false);
                return await GetSystemLogLifecycleRunState(param).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return new DosResult<SysLogLifecycleRunState>(0, null, ex.Message);
            }
        }

        public async Task<DosResult<SysLogLifecycleRunState>> GetSystemLogLifecycleRunState(SysLogLifecycleParam param)
        {
            try
            {
                if (param == null || param.OsClient.DosIsNullOrWhiteSpace() || param.RunKey.DosIsNullOrWhiteSpace())
                    return new DosResult<SysLogLifecycleRunState>(0, null, "OsClient和RunKey不能为空。");
                var host = CreateSystemLogHost(param.OsClient, null);
                var receipts = MongodbClient<SysLog>.MongodbDatabase(host).GetCollection<BsonDocument>("_log_lifecycle_receipts");
                var rows = await receipts.Find(Builders<BsonDocument>.Filter.And(
                        Builders<BsonDocument>.Filter.Eq("OsClient", param.OsClient),
                        Builders<BsonDocument>.Filter.Eq("RunKey", param.RunKey),
                        Builders<BsonDocument>.Filter.Eq("Status", "Committed")))
                    .Sort(Builders<BsonDocument>.Sort.Descending("CommitTime"))
                    .ToListAsync()
                    .ConfigureAwait(false);
                var state = new SysLogLifecycleRunState();
                foreach (var row in rows)
                {
                    state.Scanned += ReadInt64(row, "ScannedCount");
                    state.Archived += ReadInt64(row, "ArchivedCount");
                    state.Deleted += ReadInt64(row, "DeletedCount");
                }
                if (rows.Count > 0)
                {
                    state.LastArchivePath = rows[0].GetValue("ArchivePath", "").AsString;
                    state.LastArchiveProofHash = rows[0].GetValue("ArchiveProofHash", "").AsString;
                }
                return new DosResult<SysLogLifecycleRunState>(1, state);
            }
            catch (Exception ex)
            {
                return new DosResult<SysLogLifecycleRunState>(0, null, ex.Message);
            }
        }

        public async Task<DosResult> GetSysLogTypes(SysLogParam param)
        {
            try
            {
                var tableName = "log_";
                if (param._SearchMonth.DosIsNullOrWhiteSpace())
                {
                    tableName += DateTime.Now.ToString("yyyyMM");
                }
                else
                {
                    tableName += param._SearchMonth;
                }
                var host = CreateTenantMongoHost(param.OsClient, tableName);
                var client = MongodbClient<SysLog>.MongodbInfoClient(host);
                var types = await client.DistinctAsync<string>("Type", Builders<SysLog>.Filter.Ne("Type", (string)null));
                var typeList = await types.ToListAsync();
                typeList.Sort();
                return new DosResult(1, typeList);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        public async Task<DosResult> AddApiCallCount(ApiCallCountParam param)
        {
            try
            {
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "OsClient不能为空");
                }

                var host = CreateTenantMongoHost(param.OsClient, "api_call_count");

                var client = MongodbClient<MongoDB.Bson.BsonDocument>.MongodbInfoClient(host);

                var filter = Builders<MongoDB.Bson.BsonDocument>.Filter.And(
                    Builders<MongoDB.Bson.BsonDocument>.Filter.Eq("ApiEngineKey", param.ApiEngineKey),
                    Builders<MongoDB.Bson.BsonDocument>.Filter.Eq("OsClient", param.OsClient)
                );

                var update = Builders<MongoDB.Bson.BsonDocument>.Update
                    .Inc("CallCount", 1L)
                    .Set("LastCallTime", DateTime.Now)
                    .SetOnInsert("ApiEngineKey", param.ApiEngineKey)
                    .SetOnInsert("Name", param.Name ?? param.ApiEngineKey)
                    .SetOnInsert("OsClient", param.OsClient)
                    .SetOnInsert("CreateTime", DateTime.Now);

                var options = new UpdateOptions { IsUpsert = true };
                await client.UpdateOneAsync(filter, update, options);

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        public async Task<DosResultList<ApiCallCount>> GetApiCallCountRank(ApiCallCountParam param)
        {
            try
            {
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    param.OsClient = DiyToken.GetCurrentOsClient();
                }
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResultList<ApiCallCount>(0, null, "OsClient不能为空");
                }

                var host = CreateTenantMongoHost(param.OsClient, "api_call_count");

                var top = param._Top ?? 10;
                var sort = Builders<ApiCallCount>.Sort.Descending("CallCount");
                var filter = Builders<ApiCallCount>.Filter.Eq("OsClient", param.OsClient);

                var result = await TMongodbHelper<ApiCallCount>.FindListByPageAsync(host, filter, 1, top, null, sort);

                return new DosResultList<ApiCallCount>(1, result, "", result.Count);
            }
            catch (Exception ex)
            {
                return new DosResultList<ApiCallCount>(0, null, ex.Message);
            }
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

        /// <summary>
        /// 带上限的 Count（用 CountDocumentsAsync + CountOptions.Limit）。
        /// Regex 无法走索引，39万条全表扫描要3分钟；加上限后最多扫描 maxCount 条就停止。
        /// 前端对超过上限的部分显示为 "10000+" 即可。
        /// </summary>
        private static async Task<long> CountCappedAsync(MongodbHost host, FilterDefinition<SysLog> filter, long maxCount)
        {
            var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
            // return await collection.CountDocumentsAsync(filter, new CountOptions { Limit = maxCount });
            return await collection.CountAsync(filter, new CountOptions { Limit = maxCount });
        }

        private static MongodbHost CreateTenantMongoHost(string osClient, string tableName)
        {
            if (osClient.DosIsNullOrWhiteSpace())
                throw new InvalidOperationException("系统日志不可用：当前登录租户为空，请重新登录后重试。");

            var tenantKey = ResolveRuntimeTenantKey(osClient);
            var client = Microi.net.OsClient.GetClient(tenantKey);
            var connection = client?.OsClientModel?["DbMongoConnection"]?.Val<string>();
            if (connection.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException(
                    $"系统日志不可用：租户[{osClient}]的运行时SaaS配置缺少DbMongoConnection。"
                    + "请在主租户“系统设置 → SaaS引擎 → MongoDB连接字符串”中配置共享MongoDB，"
                    + "保存后执行租户配置刷新，并确认所有API节点已加载新配置。"
                );
            }

            return new MongodbHost
            {
                Connection = connection,
                DataBase = "sys_log_" + tenantKey.ToLowerInvariant(),
                Table = tableName ?? ""
            };
        }

        private static string ResolveRuntimeTenantKey(string osClient)
        {
            var normalized = osClient?.Trim() ?? string.Empty;
            if (Microi.net.OsClient.ClientList.ContainsKey(normalized)) return normalized;

            foreach (var candidate in Microi.net.OsClient.ClientList.Keys)
            {
                if (string.Equals(candidate, normalized, StringComparison.OrdinalIgnoreCase))
                    return candidate;
            }
            return normalized;
        }

        private static string BuildSysLogCircuitKey(MongodbHost host)
        {
            // A transient failure while replaying one historical monthly collection must not
            // block the current month's live log collection for the entire circuit-break window.
            return (host?.Connection ?? string.Empty) + "|"
                   + (host?.DataBase ?? string.Empty) + "|"
                   + (host?.Table ?? string.Empty);
        }

        private static MongodbHost CreateSystemLogHost(string osClient, string month)
        {
            return CreateTenantMongoHost(
                osClient,
                month.DosIsNullOrWhiteSpace() ? "log_" : "log_" + month);
        }

        private static string ValidateLifecycleParam(SysLogLifecycleParam param, bool requireRun)
        {
            if (param == null) return "日志生命周期参数不能为空。";
            if (param.OsClient.DosIsNullOrWhiteSpace()) return "OsClient不能为空。";
            if (param.CutoffTime == default(DateTime)) return "CutoffTime不能为空。";
            if (param.CutoffTime > DateTime.UtcNow.AddMinutes(5)) return "CutoffTime不能晚于当前时间。";
            if (param.MaxCollections < 1 || param.MaxCollections > 120) return "MaxCollections必须在1到120之间。";
            if (param.BatchSize < 1 || param.BatchSize > 500) return "BatchSize必须在1到500之间。";
            if (requireRun)
            {
                if (param.RunKey.DosIsNullOrWhiteSpace() || param.RunKey.Length > 160) return "RunKey不能为空且不能超过160字符。";
                if (param.BackgroundTaskId.DosIsNullOrWhiteSpace() || param.FencingToken <= 0) return "缺少可信后台任务与栅栏令牌。";
            }
            return null;
        }

        private static FilterDefinition<SysLog> BuildLifecycleFilter(SysLogLifecycleParam param)
        {
            var filters = new List<FilterDefinition<SysLog>>
            {
                Builders<SysLog>.Filter.Lt(d => d.CreateTime, param.CutoffTime)
            };
            if (!param.Type.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(d => d.Type, param.Type));
            if (!param.Category.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(d => d.Category, param.Category));
            if (!param.Source.DosIsNullOrWhiteSpace()) filters.Add(Builders<SysLog>.Filter.Eq(d => d.Source, param.Source));
            return Builders<SysLog>.Filter.And(filters);
        }

        private static string NormalizeMonth(string month)
        {
            month = (month ?? "").Trim();
            if (!Regex.IsMatch(month, "^[0-9]{6}$")) return null;
            return DateTime.TryParseExact(month, "yyyyMM", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out _) ? month : null;
        }

        private static async Task<List<string>> GetSystemLogMonthsAsync(IMongoDatabase database)
        {
            using var cursor = await database.ListCollectionNamesAsync().ConfigureAwait(false);
            var names = await cursor.ToListAsync().ConfigureAwait(false);
            return names.Where(name => name != null && name.StartsWith("log_", StringComparison.Ordinal)
                                               && NormalizeMonth(name.Substring(4)) != null)
                .Select(name => name.Substring(4))
                .Distinct(StringComparer.Ordinal)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList();
        }

        private static async Task<List<string>> GetLifecycleMonthsAsync(IMongoDatabase database, DateTime cutoff, int maxCollections)
        {
            var cutoffMonth = cutoff.ToString("yyyyMM", CultureInfo.InvariantCulture);
            var lowerMonth = new DateTime(cutoff.Year, cutoff.Month, 1)
                .AddMonths(-(Math.Max(1, Math.Min(120, maxCollections)) - 1))
                .ToString("yyyyMM", CultureInfo.InvariantCulture);
            var months = await GetSystemLogMonthsAsync(database).ConfigureAwait(false);
            return months.Where(month => string.CompareOrdinal(month, lowerMonth) >= 0
                                         && string.CompareOrdinal(month, cutoffMonth) <= 0)
                .OrderBy(month => month, StringComparer.Ordinal)
                .ToList();
        }

        private static long ReadInt64(BsonDocument document, string name)
        {
            if (document == null || !document.TryGetValue(name, out var value) || value == null || value.IsBsonNull) return 0;
            try { return value.ToInt64(); } catch { return 0; }
        }

        // 范围索引是否已确认（DataBase.Table → true）
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _indexEnsured
            = new System.Collections.Concurrent.ConcurrentDictionary<string, bool>();

        // 同一集合只允许一个索引初始化任务真正访问 MongoDB。Lazy<Task> 很重要：
        // ConcurrentDictionary.GetOrAdd 的 valueFactory 可能并发执行多次，直接存 Task 仍会发起重复请求。
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Lazy<Task>> _indexInitializationFlights
            = new System.Collections.Concurrent.ConcurrentDictionary<string, Lazy<Task>>();

        // 索引初始化失败不能让每个日志批次立即重试。状态只用于单节点降载；MongoDB
        // createIndexes 本身仍是跨节点幂等事实源，成功后会删除冷却状态。
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SysLogIndexRetryState> _indexRetryStates
            = new System.Collections.Concurrent.ConcurrentDictionary<string, SysLogIndexRetryState>();

        private const int SysLogIndexInitializationMaxAttempts = 3;
        private static readonly int[] SysLogIndexInitializationRetryDelaysMs = { 100, 250 };
        private const int SysLogIndexInitialCooldownSeconds = 15;
        private const int SysLogIndexMaxCooldownSeconds = 300;
        private static readonly TimeSpan SysLogIndexDiagnosticInterval = TimeSpan.FromMinutes(1);
        private const int SysLogIndexSanitizerInputLimit = 4096;
        private const string SysLogIndexSanitizerFallback = "异常摘要已隐藏（脱敏处理超时）";

        private static readonly Regex SysLogServiceUriRegex = new Regex(
            @"\b(mongodb(?:\+srv)?|redis(?:s)?|mysql|postgres(?:ql)?|sqlserver)://[^\s,;]+",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogUriUserInfoRegex = new Regex(
            @"\b([a-z][a-z0-9+.-]*://)(?:[^/@\s]+)@",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogSensitiveAssignmentRegex = new Regex(
            @"(?<prefix>(?<![A-Za-z0-9_.-])(?:""|')?(?:(?:connection(?:[_\s-]?string)?|db(?:mongo)?conn(?:ection)?|authorization|cookie)|(?:[A-Za-z0-9_.-]{0,48}(?:password|pwd|passkey|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[A-Za-z0-9_.-]{0,24}))(?:""|')?\s*[:=]\s*)(?:""(?:\\.|[^""\\])*""|'(?:\\.|[^'\\])*'|[^,;}\]\r\n\s]+)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogConnectionSegmentRegex = new Regex(
            @"(?<prefix>(?<![A-Za-z0-9_.-])(?:""|')?(?:server|host|data\s+source|database|initial\s+catalog|user\s+id|uid|username|user)(?:""|')?\s*[:=]\s*)(?:""(?:\\.|[^""\\])*""|'(?:\\.|[^'\\])*'|[^,;}\]\r\n\s]+)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogWindowsPathRegex = new Regex(
            @"(?<![A-Za-z0-9])(?:[A-Za-z]:\\|\\\\)[^""'<>\r\n,;]*",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogUnixPathRegex = new Regex(
            @"(?<![A-Za-z0-9])/(?:home|var|etc|usr|opt|tmp|root|Users)/[^""'<>\r\n,;]*",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
        private static readonly Regex SysLogWhitespaceRegex = new Regex(
            @"\s+",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private sealed class SysLogIndexRetryState
        {
            internal int ConsecutiveFailures;
            internal long RetryNotBeforeUtcTicks;
            internal long LastDiagnosticUtcTicks;
        }

        private sealed class SysLogIndexFailureDecision
        {
            internal int FailureCount { get; set; }
            internal DateTime RetryNotBeforeUtc { get; set; }
            internal bool ShouldWriteDiagnostic { get; set; }
        }

        /// <summary>
        /// 确保 SysLog 集合存在范围查询索引（CreateTime/Type/Level）。
        /// 内存缓存控制：每个集合生命周期内只创建一次，幂等安全。
        /// </summary>
        private static async Task EnsureSysLogIndexesAsync(MongodbHost host)
        {
            var cacheKey = BuildSysLogIndexCacheKey(host);
            await RunSysLogIndexSingleFlightAsync(
                cacheKey,
                () => EnsureSysLogIndexesCoreAsync(host, cacheKey)).ConfigureAwait(false);
        }

        private static async Task RunSysLogIndexSingleFlightAsync(string cacheKey, Func<Task> initializer)
        {
            if (_indexEnsured.ContainsKey(cacheKey)) return;
            if (IsSysLogIndexRetryCoolingDown(cacheKey, DateTime.UtcNow)) return;

            var candidate = new Lazy<Task>(
                // 冷却状态可能在本调用通过首个检查后、抢到 flight 前由另一个调用写入，
                // Lazy 内必须再次检查，避免旧竞争者绕过 retry-not-before。
                () => IsSysLogIndexRetryCoolingDown(cacheKey, DateTime.UtcNow)
                    ? Task.CompletedTask
                    : initializer(),
                System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
            var flight = _indexInitializationFlights.GetOrAdd(cacheKey, candidate);
            try
            {
                await flight.Value.ConfigureAwait(false);
            }
            finally
            {
                // 成功由 _indexEnsured 永久短路；失败移除 flight，让下一次日志写入重新尝试。
                if (_indexInitializationFlights.TryGetValue(cacheKey, out var current)
                    && ReferenceEquals(current, flight))
                {
                    _indexInitializationFlights.TryRemove(cacheKey, out _);
                }
            }
        }

        private static async Task EnsureSysLogIndexesCoreAsync(MongodbHost host, string cacheKey)
        {
            var stage = "创建集合客户端";
            var attempts = 0;
            var finalException = await RunSysLogIndexOperationWithRetryAsync(async () =>
            {
                attempts++;
                stage = "创建集合客户端";
                var collection = MongodbClient<SysLog>.MongodbInfoClient(host);

                stage = "读取现有索引";
                var existingIndexNames = new System.Collections.Generic.HashSet<string>();
                using (var cursor = await collection.Indexes.ListAsync().ConfigureAwait(false))
                {
                    var existing = await cursor.ToListAsync().ConfigureAwait(false);
                    foreach (var idx in existing)
                        if (idx.TryGetValue("name", out var nameVal))
                            existingIndexNames.Add(nameVal.AsString);
                }

                stage = "生成缺失索引";
                var toCreate = new System.Collections.Generic.List<CreateIndexModel<SysLog>>();
                if (!existingIndexNames.Contains("idx_CreateTime_desc"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_CreateTime_desc" }));
                if (!existingIndexNames.Contains("idx_Type_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.Type).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_Type_CreateTime" }));
                if (!existingIndexNames.Contains("idx_Level_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.Level).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_Level_CreateTime" }));
                if (!existingIndexNames.Contains("idx_Category_Action_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.Category).Ascending(d => d.Action).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_Category_Action_CreateTime" }));
                if (!existingIndexNames.Contains("idx_Category_Source_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.Category).Ascending(d => d.Source).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_Category_Source_CreateTime" }));
                if (!existingIndexNames.Contains("idx_Category_IP_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.Category).Ascending(d => d.IP).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_Category_IP_CreateTime" }));
                if (!existingIndexNames.Contains("idx_UserId_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.UserId).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_UserId_CreateTime" }));
                if (!existingIndexNames.Contains("idx_TraceId_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.TraceId).Ascending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_TraceId_CreateTime" }));
                if (!existingIndexNames.Contains("idx_ServiceName_CreateTime"))
                    toCreate.Add(new CreateIndexModel<SysLog>(
                        Builders<SysLog>.IndexKeys.Ascending(d => d.ServiceName).Descending(d => d.CreateTime),
                        new CreateIndexOptions { Name = "idx_ServiceName_CreateTime" }));

                stage = "创建缺失索引";
                if (toCreate.Count > 0)
                    await collection.Indexes.CreateManyAsync(toCreate).ConfigureAwait(false);
            }).ConfigureAwait(false);

            if (finalException == null)
            {
                _indexEnsured.TryAdd(cacheKey, true);
                _indexRetryStates.TryRemove(cacheKey, out _);
                return;
            }

            var failure = RegisterSysLogIndexFailure(cacheKey, DateTime.UtcNow);
            if (failure.ShouldWriteDiagnostic)
            {
                Console.WriteLine(
                    $"[Microi] MongoDB 创建SysLog索引失败({host.DataBase}.{host.Table})；" +
                    $"阶段={stage}；尝试={attempts}/{SysLogIndexInitializationMaxAttempts}；" +
                    $"连续失败={failure.FailureCount}；最早重试={failure.RetryNotBeforeUtc:O}；" +
                    $"异常={BuildSafeExceptionSummary(finalException)}；" +
                    "日志数据写入保持成功，冷却期内跳过索引初始化，避免日志队列被重复重试阻塞。");
            }
        }

        private static string BuildSysLogIndexCacheKey(MongodbHost host)
        {
            // 连接字符串可能在 SaaS 配置热刷新后指向另一台 MongoDB；只用库名和集合名
            // 会把旧端点的成功结果错误复用到新端点。缓存中仅保存不可逆指纹，不暴露凭据。
            var connection = host?.Connection?.Trim() ?? string.Empty;
            byte[] hash;
            using (var sha256 = SHA256.Create())
            {
                hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(connection));
            }
            var fingerprint = BitConverter.ToString(hash, 0, 12).Replace("-", string.Empty);
            return fingerprint + "|" + (host?.DataBase ?? string.Empty) + "|" + (host?.Table ?? string.Empty);
        }

        private static bool IsSysLogIndexRetryCoolingDown(string cacheKey, DateTime utcNow)
        {
            if (!_indexRetryStates.TryGetValue(cacheKey, out var state)) return false;
            var retryTicks = System.Threading.Interlocked.Read(ref state.RetryNotBeforeUtcTicks);
            return retryTicks > utcNow.Ticks;
        }

        private static SysLogIndexFailureDecision RegisterSysLogIndexFailure(string cacheKey, DateTime utcNow)
        {
            var normalizedNow = utcNow.Kind == DateTimeKind.Utc ? utcNow : utcNow.ToUniversalTime();
            var state = _indexRetryStates.GetOrAdd(cacheKey, _ => new SysLogIndexRetryState());
            var failures = System.Threading.Interlocked.Increment(ref state.ConsecutiveFailures);
            var exponent = Math.Min(5, Math.Max(0, failures - 1));
            var cooldownSeconds = Math.Min(
                SysLogIndexMaxCooldownSeconds,
                SysLogIndexInitialCooldownSeconds * (1 << exponent));
            var retryNotBefore = normalizedNow.AddSeconds(cooldownSeconds);
            System.Threading.Interlocked.Exchange(ref state.RetryNotBeforeUtcTicks, retryNotBefore.Ticks);

            var shouldWriteDiagnostic = false;
            while (true)
            {
                var previousTicks = System.Threading.Interlocked.Read(ref state.LastDiagnosticUtcTicks);
                if (previousTicks > 0
                    && normalizedNow.Ticks - previousTicks < SysLogIndexDiagnosticInterval.Ticks)
                {
                    break;
                }
                if (System.Threading.Interlocked.CompareExchange(
                        ref state.LastDiagnosticUtcTicks,
                        normalizedNow.Ticks,
                        previousTicks) == previousTicks)
                {
                    shouldWriteDiagnostic = true;
                    break;
                }
            }

            return new SysLogIndexFailureDecision
            {
                FailureCount = failures,
                RetryNotBeforeUtc = retryNotBefore,
                ShouldWriteDiagnostic = shouldWriteDiagnostic
            };
        }

        private static async Task<Exception?> RunSysLogIndexOperationWithRetryAsync(Func<Task> operation)
        {
            for (var attempt = 1; attempt <= SysLogIndexInitializationMaxAttempts; attempt++)
            {
                try
                {
                    await operation().ConfigureAwait(false);
                    return null;
                }
                catch (Exception ex)
                {
                    if (!IsTransientMongoIndexException(ex) || attempt >= SysLogIndexInitializationMaxAttempts)
                        return ex;

                    await Task.Delay(SysLogIndexInitializationRetryDelaysMs[attempt - 1]).ConfigureAwait(false);
                }
            }

            return new InvalidOperationException("MongoDB SysLog 索引初始化重试状态异常。");
        }

        private static bool IsTransientMongoIndexException(Exception exception)
        {
            foreach (var current in EnumerateMongoExceptionGraph(exception))
            {
                if (current is TimeoutException
                    || current is System.IO.IOException
                    || current is System.Net.Sockets.SocketException
                    || current is MongoConnectionException)
                    return true;

                var message = current.Message ?? string.Empty;
                if (message.IndexOf("receiving a message from the server", StringComparison.OrdinalIgnoreCase) >= 0
                    || message.IndexOf("connection was closed", StringComparison.OrdinalIgnoreCase) >= 0
                    || message.IndexOf("connection reset", StringComparison.OrdinalIgnoreCase) >= 0
                    || message.IndexOf("network", StringComparison.OrdinalIgnoreCase) >= 0
                    || message.IndexOf("timed out", StringComparison.OrdinalIgnoreCase) >= 0)
                    return true;
            }

            return false;
        }

        private static string BuildSafeExceptionSummary(Exception exception)
        {
            var parts = new System.Collections.Generic.List<string>();
            foreach (var current in EnumerateMongoExceptionGraph(exception))
            {
                var message = SanitizeSysLogIndexExceptionMessage(current.Message);
                parts.Add(current.GetType().Name + (message.Length == 0 ? string.Empty : ": " + message));
                if (parts.Count >= 8) break;
            }

            return string.Join(" -> ", parts);
        }

        private static string SanitizeSysLogIndexExceptionMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return string.Empty;
            var safe = message.Length <= SysLogIndexSanitizerInputLimit
                ? message
                : message.Substring(0, SysLogIndexSanitizerInputLimit);
            try
            {
                var builder = new StringBuilder(safe.Length);
                foreach (var character in safe)
                {
                    var category = char.GetUnicodeCategory(character);
                    builder.Append(char.IsControl(character) || category == UnicodeCategory.Format ? ' ' : character);
                }
                safe = builder.ToString();
                safe = SysLogServiceUriRegex.Replace(safe, "$1://***");
                safe = SysLogUriUserInfoRegex.Replace(safe, "$1***@");
                safe = SysLogSensitiveAssignmentRegex.Replace(safe, "${prefix}***");
                safe = SysLogConnectionSegmentRegex.Replace(safe, "${prefix}***");
                safe = SysLogWindowsPathRegex.Replace(safe, "[path]");
                safe = SysLogUnixPathRegex.Replace(safe, "[path]");
                safe = SysLogWhitespaceRegex.Replace(safe, " ").Trim();
            }
            catch (RegexMatchTimeoutException)
            {
                return SysLogIndexSanitizerFallback;
            }

            if (safe.Length > 300) safe = safe.Substring(0, 300) + "...";
            return safe;
        }

        private static IReadOnlyList<Exception> EnumerateMongoExceptionGraph(Exception exception)
        {
            var result = new List<Exception>();
            var seen = new HashSet<Exception>();
            var pending = new Stack<Tuple<Exception, int>>();
            pending.Push(Tuple.Create(exception, 0));
            while (pending.Count > 0 && result.Count < 32)
            {
                var item = pending.Pop();
                var current = item.Item1;
                if (current == null || !seen.Add(current)) continue;
                result.Add(current);
                if (item.Item2 >= 12) continue;

                var children = new List<Exception>();
                if (current is AggregateException aggregate)
                {
                    foreach (var inner in aggregate.InnerExceptions)
                        if (inner != null) children.Add(inner);
                }
                else if (current.InnerException != null)
                {
                    children.Add(current.InnerException);
                }

                for (var index = children.Count - 1; index >= 0; index--)
                    pending.Push(Tuple.Create(children[index], item.Item2 + 1));
            }
            return result;
        }

        /// <summary>
        /// 一次性并行返回当前月份 5 类日志的数量统计，支持关键字过滤。
        /// 前端用一个请求替换原来 5 个独立统计请求，减少网络开销。
        /// </summary>
        public async Task<DosResult> GetSysLogStats(SysLogParam param)
        {
            try
            {
                var tableName = "log_" + (param._SearchMonth.DosIsNullOrWhiteSpace()
                    ? DateTime.Now.ToString("yyyyMM") : param._SearchMonth);
                var host = CreateTenantMongoHost(param.OsClient, tableName);

                // 关键字过滤与 GetSysLog 保持一致，避免统计卡和列表口径不同。
                FilterDefinition<SysLog> kwFilter = null;
                if (!param._Keyword.DosIsNullOrWhiteSpace())
                {
                    var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(param._Keyword), "i");
                    kwFilter = Builders<SysLog>.Filter.Or(
                        Builders<SysLog>.Filter.Regex(d => d.Title, rx),
                        Builders<SysLog>.Filter.Regex(d => d.Content, rx),
                        Builders<SysLog>.Filter.Regex(d => d.UserName, rx),
                        Builders<SysLog>.Filter.Regex(d => d.IP, rx),
                        Builders<SysLog>.Filter.Regex(d => d.TraceId, rx)
                    );
                }

                const long MAX_STAT_COUNT = 10000;

                if (kwFilter != null)
                {
                    // ===== 有关键字：单次聚合流水线代替 5 次独立扫描 =====
                    // $match → $limit(10000) → $group：只扫一遍即可统计所有分类
                    var collection = MongodbClient<SysLog>.MongodbInfoClient(host);
                    var agg = collection.Aggregate()
                        .Match(kwFilter)
                        .Limit((int)MAX_STAT_COUNT)
                        .Group(new BsonDocument
                        {
                            { "_id", BsonNull.Value },
                            { "Total", new BsonDocument("$sum", 1) },
                            { "Error", new BsonDocument("$sum", new BsonDocument("$cond",
                                new BsonArray { new BsonDocument("$eq", new BsonArray { "$Level", 3 }), 1, 0 })) },
                            { "Warn", new BsonDocument("$sum", new BsonDocument("$cond",
                                new BsonArray { new BsonDocument("$eq", new BsonArray { "$Level", 2 }), 1, 0 })) },
                            { "SlowSQL", new BsonDocument("$sum", new BsonDocument("$cond",
                                new BsonArray { new BsonDocument("$eq", new BsonArray { "$Type", "数据库慢SQL" }), 1, 0 })) },
                            { "SlowExec", new BsonDocument("$sum", new BsonDocument("$cond",
                                new BsonArray { new BsonDocument("$eq", new BsonArray { "$Type", "表单V8慢日志" }), 1, 0 })) },
                            { "Exception", new BsonDocument("$sum", new BsonDocument("$cond",
                                new BsonArray { new BsonDocument("$eq", new BsonArray { "$Type", "Exception" }), 1, 0 })) }
                        });
                    var aggResult = await agg.FirstOrDefaultAsync();

                    return new DosResult
                    {
                        Code = 1,
                        Data = new
                        {
                            Total = aggResult?["Total"].ToInt64() ?? 0,
                            Error = aggResult?["Error"].ToInt64() ?? 0,
                            Warn = aggResult?["Warn"].ToInt64() ?? 0,
                            SlowSQL = aggResult?["SlowSQL"].ToInt64() ?? 0,
                            SlowExec = aggResult?["SlowExec"].ToInt64() ?? 0,
                            Exception = aggResult?["Exception"].ToInt64() ?? 0
                        }
                    };
                }

                // ===== 无关键字：直接计数（走索引，非常快） =====
                FilterDefinition<SysLog> Combine(FilterDefinition<SysLog> extra) => extra;

                Func<FilterDefinition<SysLog>, Task<long>> countFn;
                countFn = f => TMongodbHelper<SysLog>.CountAsync(host, f);

                // 分类 Count 并行执行；总量走集合估算，不再增加一次精确全表 Count。
                var totalTask = TMongodbHelper<SysLog>.CountEstimatedAsync(host);
                var t1 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Level == 3)));
                var t2 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Level == 2)));
                var t3 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "数据库慢SQL")));
                var t4 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "表单V8慢日志")));
                var t5 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "Exception")));
                await Task.WhenAll(totalTask, t1, t2, t3, t4, t5);

                return new DosResult
                {
                    Code = 1,
                    Data = new
                    {
                        Total = totalTask.Result,
                        Error = t1.Result,
                        Warn = t2.Result,
                        SlowSQL = t3.Result,
                        SlowExec = t4.Result,
                        Exception = t5.Result
                    }
                };
            }
            catch (Exception ex)
            {
                return new DosResult { Code = 0, Msg = ex.Message };
            }
        }

    }
}
