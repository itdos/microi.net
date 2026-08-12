using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Dynamic;
using System.Globalization;
using System.Linq;
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
                    var host = CreateTenantMongoHost(group.Key.OsClient, "log_" + group.Key.Month);
                    var circuitKey = host.Connection + "|" + host.DataBase;
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
                        await collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }).ConfigureAwait(false);
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
                // Regex 搜索 Title + Content（中文无法用 $text 分词，Regex 正确匹配子串）
                // 仅搜 2 个关键字段，比原先 11 字段 OR 快很多
                var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(param._Keyword), "i");
                list.Add(Builders<SysLog>.Filter.Or(
                    Builders<SysLog>.Filter.Regex(d => d.Title, rx),
                    Builders<SysLog>.Filter.Regex(d => d.Content, rx)
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

            var client = Microi.net.OsClient.GetClient(osClient);
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
                DataBase = "sys_log_" + osClient.ToLowerInvariant(),
                Table = tableName ?? ""
            };
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

        /// <summary>
        /// 确保 SysLog 集合存在范围查询索引（CreateTime/Type/Level）。
        /// 内存缓存控制：每个集合生命周期内只创建一次，幂等安全。
        /// </summary>
        private static async Task EnsureSysLogIndexesAsync(MongodbHost host)
        {
            var cacheKey = host.DataBase + "." + host.Table;
            if (_indexEnsured.ContainsKey(cacheKey)) return;

            try
            {
                var collection = MongodbClient<SysLog>.MongodbInfoClient(host);

                var existingIndexNames = new System.Collections.Generic.HashSet<string>();
                using (var cursor = await collection.Indexes.ListAsync())
                {
                    var existing = await cursor.ToListAsync();
                    foreach (var idx in existing)
                        if (idx.TryGetValue("name", out var nameVal))
                            existingIndexNames.Add(nameVal.AsString);
                }

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

                if (toCreate.Count > 0)
                    await collection.Indexes.CreateManyAsync(toCreate);

                _indexEnsured.TryAdd(cacheKey, true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Microi] MongoDB 创建SysLog索引失败({host.DataBase}.{host.Table}): {ex.Message}");
            }
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

                // 关键字过滤（同 GetSysLog 逻辑，Regex 搜 Title + Content）
                FilterDefinition<SysLog> kwFilter = null;
                if (!param._Keyword.DosIsNullOrWhiteSpace())
                {
                    var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(param._Keyword), "i");
                    kwFilter = Builders<SysLog>.Filter.Or(
                        Builders<SysLog>.Filter.Regex(d => d.Title, rx),
                        Builders<SysLog>.Filter.Regex(d => d.Content, rx)
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

                // 5 个 Count 并行执行
                var t1 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Level == 3)));
                var t2 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Level == 2)));
                var t3 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "数据库慢SQL")));
                var t4 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "表单V8慢日志")));
                var t5 = countFn(Combine(Builders<SysLog>.Filter.Where(d => d.Type == "Exception")));
                await Task.WhenAll(t1, t2, t3, t4, t5);

                return new DosResult
                {
                    Code = 1,
                    Data = new
                    {
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
