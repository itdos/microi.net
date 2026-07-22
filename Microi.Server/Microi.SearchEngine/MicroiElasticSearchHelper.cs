using Dos.Common;
using Elasticsearch.Net;
using Microi.net;
using Nest;
using Newtonsoft.Json;
using NPOI.SS.Formula.Functions;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiElasticSearchHelper : IMicroiSearchEngineHelper
    {
        /// <summary>
        /// 获取当前租户的 OsClient 标识。
        /// HTTP/JWT 与 V8 执行上下文中的租户永远是权威值；只有确实不存在请求/V8
        /// 上下文的后台任务，才允许通过参数显式指定租户。
        /// </summary>
        private string GetOsClient(string explicitOsClient = null)
        {
            var requested = explicitOsClient?.Trim();

            var v8OsClient = V8TenantContext.Current?.OsClient?.Trim();
            if (!string.IsNullOrWhiteSpace(v8OsClient))
            {
                EnsureSameTenant(v8OsClient, requested);
                return v8OsClient;
            }

            Microsoft.AspNetCore.Http.HttpContext httpContext = null;
            try
            {
                httpContext = DiyHttpContext.Current;
            }
            catch
            {
                // 非 Web 宿主没有 IHttpContextAccessor，按后台任务规则继续处理。
            }

            if (httpContext != null)
            {
                // 已通过 ASP.NET Core 身份验证的 JWT Claim 优先级最高。匿名入口则使用
                // DiyToken 已解析的 query/form/header 租户；JSON body 不能成为租户选择器。
                var authenticatedOsClient = httpContext.User?.Claims?
                    .FirstOrDefault(c => string.Equals(c.Type, "OsClient", StringComparison.OrdinalIgnoreCase))
                    ?.Value?.Trim();
                var requestOsClient = !string.IsNullOrWhiteSpace(authenticatedOsClient)
                    ? authenticatedOsClient
                    : DiyToken.GetCurrentOsClient(false)?.Trim();

                if (string.IsNullOrWhiteSpace(requestOsClient))
                {
                    throw new SecurityException("当前请求无法确定租户，已拒绝搜索引擎访问。");
                }

                EnsureSameTenant(requestOsClient, requested);
                return requestOsClient;
            }

            if (string.IsNullOrWhiteSpace(requested))
            {
                throw new InvalidOperationException("后台搜索任务必须显式指定 OsClient。");
            }

            return requested;
        }

        private static void EnsureSameTenant(string authoritativeOsClient, string requestedOsClient)
        {
            if (!string.IsNullOrWhiteSpace(requestedOsClient)
                && !string.Equals(authoritativeOsClient, requestedOsClient, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityException("禁止跨租户访问搜索引擎资源。");
            }
        }

        /// <summary>
        /// 生成租户隔离的ES索引名称
        /// 格式：{osClient}_{tableName}，全部转小写（ES索引名要求小写）
        /// </summary>
        private string GetIndexName(string tableName, string osClient = null)
        {
            var client = GetOsClient(osClient);
            return TenantConfigurationSecurity.NormalizeSearchIndex(tableName, client);
        }

        private ElasticClient GetEsClient(string osClient = null)
        {
            var osClientName = GetOsClient(osClient);
            var clientModel = OsClient.GetClient(osClientName);
            if (clientModel?.OsClientModel == null)
            {
                throw new InvalidOperationException("当前租户的搜索引擎配置不可用。");
            }

            // Host/Port 由 SaaS 运行时安全配置模型解析（可继承共享服务地址），凭据必须来自
            // 当前租户自身配置。这里不读取主租户，也不做管理员凭据回退。
            string host = ReadConfig(clientModel.OsClientModel, "SearchEngineHost");
            int port = ReadIntConfig(clientModel.OsClientModel, "SearchEnginePort");
            string scheme = ReadConfig(clientModel.OsClientModel, "SearchEngineScheme");
            if (string.IsNullOrWhiteSpace(scheme)) scheme = "http";
            if (string.IsNullOrWhiteSpace(host) || port <= 0 || port > 65535)
            {
                throw new InvalidOperationException("当前租户的搜索引擎连接地址未配置或无效。");
            }

            var hostArr = host.DosSplit(',');
            var uris = hostArr
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Select(item => BuildEndpoint(item, port, scheme))
                .ToArray();
            if (uris.Length == 0)
            {
                throw new InvalidOperationException("当前租户的搜索引擎连接地址未配置或无效。");
            }

            //var pool = new SniffingConnectionPool(uris);
            var pool = new StaticConnectionPool(uris);
            var settings = new ConnectionSettings(pool);

            var apiKey = ReadConfig(clientModel.OsClientModel, "SearchEngineApiKey");
            var userName = ReadConfig(clientModel.OsClientModel, "SearchEngineUserName", "SearchEngineUsername");
            var password = ReadConfig(clientModel.OsClientModel, "SearchEnginePassword");
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                var separator = apiKey.IndexOf(':');
                settings = separator > 0 && separator < apiKey.Length - 1
                    ? settings.ApiKeyAuthentication(apiKey.Substring(0, separator), apiKey.Substring(separator + 1))
                    : settings.ApiKeyAuthentication(new ApiKeyAuthenticationCredentials(apiKey));
            }
            else if (!string.IsNullOrWhiteSpace(userName) && !string.IsNullOrWhiteSpace(password))
            {
                settings = settings.BasicAuthentication(userName, password);
            }
            else if (!string.IsNullOrWhiteSpace(userName) || !string.IsNullOrWhiteSpace(password))
            {
                throw new InvalidOperationException("当前租户的搜索引擎凭据配置不完整。");
            }
            else if (!string.Equals(osClientName, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("当前租户尚未配置独立的搜索引擎凭据。");
            }

            var client = new ElasticClient(settings);
            return client;
        }

        private static string ReadConfig(Newtonsoft.Json.Linq.JObject model, params string[] names)
        {
            foreach (var name in names)
            {
                var value = model[name]?.Val<string>()?.Trim();
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }
            return string.Empty;
        }

        private static int ReadIntConfig(Newtonsoft.Json.Linq.JObject model, string name)
        {
            var value = ReadConfig(model, name);
            return int.TryParse(value, out var result) ? result : 0;
        }

        private static Uri BuildEndpoint(string host, int port, string scheme)
        {
            host = host?.Trim();
            scheme = scheme?.Trim().ToLowerInvariant();
            if (scheme != "http" && scheme != "https")
            {
                throw new InvalidOperationException("搜索引擎连接协议无效。");
            }

            if (string.IsNullOrWhiteSpace(host)
                || host.IndexOfAny(new[] { '/', '\\', '?', '#', '@' }) >= 0)
            {
                throw new InvalidOperationException("搜索引擎连接地址无效。");
            }

            try
            {
                return new UriBuilder(scheme, host, port).Uri;
            }
            catch
            {
                throw new InvalidOperationException("搜索引擎连接地址无效。");
            }
        }

        private static MicroiSearchEngineResult Failed(string message)
        {
            return new MicroiSearchEngineResult(0, message);
        }

        /// <summary>
        /// 同步表字段到es
        /// </summary>
        /// <param name="tableId">表id</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AsyncIndex(string tableId, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                var fieldParam = new
                {
                    FormEngineKey = MicroiSearchEngineConst.fieldTableName,
                    _Where = new List<DiyWhere>() {
                        new DiyWhere() {
                            Name = "TableId",
                            Value = tableId,
                            Type = "="
                          }
                        },
                    OsClient = currentOsClient
                };
                var tableParam = new
                {
                    FormEngineKey = MicroiSearchEngineConst.tableName,
                    _Where = new List<DiyWhere>() {
                        new DiyWhere() {
                            Name = "Id",
                            Value = tableId,
                            Type = "="
                          }
                        },
                    OsClient = currentOsClient
                };
                // 依据tableId获取到表名称
                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(tableParam);
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    return new MicroiSearchEngineResult(0, "未获取到表信息");
                }
                // 依据tableId获取到所有的字段
                var fielsResult = await MicroiEngine.FormEngine.GetTableDataAsync(fieldParam);
                if (fielsResult.Code != 1 || fielsResult.Data == null || fielsResult.Data.Count == 0)
                {
                    return new MicroiSearchEngineResult(0, "未获取到表字段信息");
                }
                // 如果不存在索引，直接创建索引，如果存在需要重建索引
                string indexName = GetIndexName(tableResult.Data.Name, currentOsClient);
                bool exist = await IndexExist(indexName, currentOsClient);
                if (exist)
                {
                    DeleteIndexResponse deleteResponse = await GetEsClient(currentOsClient).Indices.DeleteAsync(indexName);
                    if (!deleteResponse.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "删除原index失败");
                    }
                }
                return await CreateIndex(indexName, fielsResult.Data, currentOsClient);
            }
            catch (Exception)
            {
                return Failed("同步索引失败，请检查当前租户的搜索配置与索引名称。");
            }

        }

        /// <summary>
        /// 新增文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据Id</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AddDocument(string tableName, string id, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                string indexName = GetIndexName(tableName, currentOsClient);
                // 依据表名称以及id获取数据
                var dataResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                {
                    FormEngineKey = tableName,
                    Id = id,
                    OsClient = currentOsClient
                });
                if (dataResult.Code == 1 && dataResult.Data != null)
                {
                    string jsonStr = JsonConvert.SerializeObject(dataResult.Data);
                    Dictionary<string, object> dic = JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonStr);
                    var result = await GetEsClient(currentOsClient).IndexAsync<Dictionary<string, object>>(dic, i => i.Index(indexName).Id(id));
                    if (result == null || !result.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "新增失败");
                    }
                }

            }
            catch (Exception)
            {
                return Failed("新增失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(1, "新增成功");
        }

        /// <summary>
        /// 修改文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据Id</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> UpdateDocument(string tableName, string id, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                string indexName = GetIndexName(tableName, currentOsClient);
                // 依据表名称以及id获取数据
                var dataResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                {
                    FormEngineKey = tableName,
                    Id = id,
                    OsClient = currentOsClient
                });
                if (dataResult.Code == 1 && dataResult.Data != null)
                {
                    string jsonStr = JsonConvert.SerializeObject(dataResult.Data);
                    Dictionary<string, object> dic = JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonStr);
                    IUpdateRequest<Dictionary<string, object>, Dictionary<string, object>> request = new UpdateRequest<Dictionary<string, object>, Dictionary<string, object>>(indexName, id)
                    {
                        Doc = dic,
                    };
                    var result = await GetEsClient(currentOsClient).UpdateAsync(request);
                    if (result == null || !result.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "更新失败");
                    }
                }
            }
            catch (Exception)
            {
                return Failed("更新失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(1, "更新成功");
        }

        /// <summary>
        /// 删除文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据id</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> DeleteDocument(string tableName, string id, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                string indexName = GetIndexName(tableName, currentOsClient);
                IDeleteRequest request = new DeleteRequest(indexName, id);
                var result = await GetEsClient(currentOsClient).DeleteAsync(request);
                if (result == null || !result.IsValid)
                {
                    return new MicroiSearchEngineResult(0, "删除失败");
                }
            }
            catch (Exception)
            {
                return Failed("删除失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(1, "删除成功");
        }

        /// <summary>
        /// 新增字段
        /// </summary>
        /// <param name="fieldModel"></param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AddField(MicroiSearchEngineFieldModel fieldModel, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                PutMappingDescriptor<object> putMappingDescriptor = new PutMappingDescriptor<object>();
                if (fieldModel.Type.IndexOf("varchar", StringComparison.OrdinalIgnoreCase) >= 0 && fieldModel.Participle)
                {
                    putMappingDescriptor.Properties(m => m.Text(k => k.Name(fieldModel.Name).Analyzer("ik_max_word").SearchAnalyzer("ik_smart")));
                }
                else if (fieldModel.Type.IndexOf("varchar", StringComparison.OrdinalIgnoreCase) >= 0 && !fieldModel.Participle)
                {
                    putMappingDescriptor.Properties(m => m.Keyword(k => k.Name(fieldModel.Name)));
                }
                else if (fieldModel.Type.IndexOf("int", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Number(k => k.Name(fieldModel.Name).Type(NumberType.Integer)));
                }
                else if (fieldModel.Type.IndexOf("date", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Date(k => k.Name(fieldModel.Name)));
                }
                else if (fieldModel.Type.IndexOf("bool", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Boolean(k => k.Name(fieldModel.Name)));
                }
                else if (fieldModel.Type.IndexOf("decimal", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Number(k => k.Name(fieldModel.Name).Type(NumberType.Float)));
                }
                else if (fieldModel.Type.IndexOf("mediumtext", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Text(k => k.Name(fieldModel.Name)));
                }
                else if (fieldModel.Type.IndexOf("bit", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    putMappingDescriptor.Properties(m => m.Number(k => k.Name(fieldModel.Name).Type(NumberType.Short)));
                }
                else
                {
                    return new MicroiSearchEngineResult(0, "新增字段失败,找不到匹配的类型");
                }
                putMappingDescriptor.Index(GetIndexName(fieldModel.IndexName, currentOsClient));
                var response = await GetEsClient(currentOsClient).Indices.PutMappingAsync(putMappingDescriptor);
                if (!response.IsValid)
                {
                    return new MicroiSearchEngineResult(0, "新增字段失败");
                }
                return new MicroiSearchEngineResult(1, "新增字段成功");
            }
            catch (Exception)
            {
                return Failed("新增字段失败，搜索请求已拒绝。");
            }
        }

        /// <summary>
        /// 查询数据
        /// </summary>
        /// <param name="searchParam"></param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> GetSearchResponse(MicroiSearchEngineParam searchParam)
        {
            try
            {
                return await GetSearchResponseCore(searchParam);
            }
            catch (Exception)
            {
                return Failed("查询失败，搜索请求已拒绝。");
            }
        }

        private async Task<MicroiSearchEngineResult> GetSearchResponseCore(MicroiSearchEngineParam searchParam)
        {
            if (searchParam == null)
            {
                return Failed("查询参数不能为空。");
            }
            var currentOsClient = GetOsClient(searchParam.OsClient);
            // 在访问表元数据前先验证名称，阻止通配符、多索引、路径和外租户前缀。
            GetIndexName(searchParam.TableName, currentOsClient);
            List<QueryContainer> must = new List<QueryContainer>();
            BoolQuery boolQuery = new BoolQuery();
            boolQuery.Must = must;
            //boolQuery.Should = 
            // 依据tableId 获取表字段属性
            var param = new
            {
                FormEngineKey = MicroiSearchEngineConst.fieldTableName,
                _Where = new List<DiyWhere>() {
                new DiyWhere() {
                    Name = "TableId",
                    Value = searchParam.TableId,
                    Type = "="
                  }
                },
                OsClient = currentOsClient
            };
            // 依据tableId获取到所有的字段
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
            if (result.Code != 1 || result.Data == null || result.Data.Count == 0)
            {
                return new MicroiSearchEngineResult(0, "未获取到表字段信息");
            }
            if (searchParam.Query == null || (searchParam.Query.Should == null && searchParam.Query.Must == null))
            {
                must.Add(new MatchAllQuery());
                if (searchParam.PageType == 1)
                {
                    return await Search<Dictionary<string, object>>(searchParam, boolQuery, currentOsClient);
                }
                else
                {
                    return await SearchBySearchAfter<Dictionary<string, object>>(searchParam, boolQuery, currentOsClient);
                }
            }
            string dataStr = JsonConvert.SerializeObject(result.Data);
            List<MicroiSearchEngineFieldModel> fieldList = JsonConvert.DeserializeObject<List<MicroiSearchEngineFieldModel>>(dataStr);
            fieldList.Add(new MicroiSearchEngineFieldModel()
            {
                Name = "Id",
                Type = "KeyWord"
            });
            if (searchParam.Query.Must != null && searchParam.Query.Must.Count > 0)
            {
                foreach (var item in searchParam.Query.Must)
                {
                    var field = fieldList.Find(x => x.Name.Equals(item.Name, StringComparison.OrdinalIgnoreCase));
                    if (field == null) { continue; }
                    if (field.Type.IndexOf("varchar", StringComparison.OrdinalIgnoreCase) >= 0
                        || field.Type.IndexOf("mediumtext", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        MatchQuery matchQuery = new MatchQuery();
                        matchQuery.Field = item.Name;
                        matchQuery.Query = item.Value;
                        must.Add(matchQuery);
                    }
                    else
                    {
                        TermQuery termQuery = new TermQuery();
                        termQuery.Field = item.Name;
                        termQuery.Value = item.Value;
                        must.Add(termQuery);
                    }
                }
            }
            if (searchParam.Query.Should != null && searchParam.Query.Should.Count > 0)
            {
                BoolQuery shouldBoolQuery = new BoolQuery();
                List<QueryContainer> should = new List<QueryContainer>();
                shouldBoolQuery.Should = should;
                must.Add(shouldBoolQuery);
                foreach (var item in searchParam.Query.Should)
                {
                    var field = fieldList.Find(x => x.Name.Equals(item.Name, StringComparison.OrdinalIgnoreCase));
                    if (field == null) { continue; }
                    if (field.Type.IndexOf("varchar", StringComparison.OrdinalIgnoreCase) >= 0
                        || field.Type.IndexOf("mediumtext", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        MatchQuery matchQuery = new MatchQuery();
                        matchQuery.Field = item.Name;
                        matchQuery.Query = item.Value;
                        should.Add(matchQuery);
                    }
                    else
                    {
                        TermQuery termQuery = new TermQuery();
                        termQuery.Field = item.Name;
                        termQuery.Value = item.Value;
                        should.Add(termQuery);
                    }
                }
            }

            if (searchParam.PageType == MicroiSearchEngineConst.page_from_size)
            {
                return await Search<Dictionary<string, object>>(searchParam, boolQuery, currentOsClient);
            }
            else
            {
                return await SearchBySearchAfter<Dictionary<string, object>>(searchParam, boolQuery, currentOsClient);
            }
        }

        /// <summary>
        /// 同步表数据到index
        /// </summary>
        /// <param name="tableId">表id</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AsyncTableDataToIndex(string tableId, string osClient = null)
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                var tableParam = new
                {
                    FormEngineKey = MicroiSearchEngineConst.tableName,
                    _Where = new List<DiyWhere>() {
                        new DiyWhere() {
                            Name = "Id",
                            Value = tableId,
                            Type = "="
                          }
                        },
                    OsClient = currentOsClient
                };
                // 依据tableId获取到表名称
                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(tableParam);
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    return new MicroiSearchEngineResult(0, "未获取到表信息");
                }
                // 删除索引中所有数据
                string indexName = GetIndexName(tableResult.Data.Name, currentOsClient);
                IDeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
                deleteByQueryRequest.Query = new MatchAllQuery();
                var response = await GetEsClient(currentOsClient).DeleteByQueryAsync(deleteByQueryRequest);
                if (!response.IsValid)
                {
                    return Failed("同步失败，请检查当前租户的搜索配置。");
                }
                // 获取表数据
                var param = new
                {
                    FormEngineKey = tableResult.Data.Name,
                    OsClient = currentOsClient
                };
                // 依据tableId获取到所有的字段
                var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
                if (result.Code != 1 || result.Data == null || result.Data.Count == 0)
                {
                    return new MicroiSearchEngineResult(0, "获取表数据失败");
                }
                // 插入表数据到index
                var dataStr = JsonConvert.SerializeObject(result.Data);
                List<Dictionary<string, object>> list = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(dataStr);
                var esClient = GetEsClient(currentOsClient);
                foreach (var item in list)
                {
                    await esClient.IndexAsync<Dictionary<string, object>>(item, i => i.Index(indexName).Id(item["Id"].ToString()));
                }
                return new MicroiSearchEngineResult(1, "同步成功");
            }
            catch (Exception)
            {
                return Failed("同步失败，搜索请求已拒绝。");
            }

        }

        /// <summary>
        /// 重建索引
        /// </summary>
        /// <param name="indexName">索引名称（已含租户前缀）</param>
        /// <param name="data">表所属字段集合</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> ReIndex(string indexName, List<dynamic> data, string osClient = null)
        {
            var currentOsClient = GetOsClient(osClient);
            indexName = TenantConfigurationSecurity.NormalizeSearchIndex(indexName, currentOsClient);
            // 创建新索引
            string destIndexName = TenantConfigurationSecurity.NormalizeSearchIndex(
                $"{indexName}-{Ulid.NewUlid().ToString()}", currentOsClient);
            var createIndexResponse = await CreateIndex(destIndexName, data, currentOsClient);
            if (createIndexResponse.Code != 1)
            {
                return new MicroiSearchEngineResult(0, "创建索引失败");
            }
            bool existIndexAlias = false;
            string id = "";
            // 从别名对应关系表查询是否存在对应关系,存在对应关系，需要获取到indexName
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                FormEngineKey = MicroiSearchEngineConst.nameAliasTable,
                _Where = new List<DiyWhere>() {
                new DiyWhere() {
                    Name = "IndexAlias",
                    Value = indexName,
                    Type = "="
                  }
                },
                OsClient = currentOsClient
            });
            string sourceIndexName = indexName;
            if (result != null && result.Data != null)
            {
                existIndexAlias = true;
                id = result.Data.Id;
                sourceIndexName = TenantConfigurationSecurity.NormalizeSearchIndex(
                    Convert.ToString(result.Data.IndexName), currentOsClient);
            }
            var esClient = GetEsClient(currentOsClient);
            // reindex 复制源index数据到新index
            var reindexResponse = esClient.ReindexOnServer(r => r
                .Source(sou => sou.Index(sourceIndexName))
                .Destination(des => des.Index(destIndexName))
                .WaitForCompletion(true)
                );
            if (!reindexResponse.IsValid)
            {
                // 删除前面创建的新index
                await esClient.Indices.DeleteAsync(destIndexName);
                return new MicroiSearchEngineResult(0, "同步数据失败");
            }
            // 删除原index
            var deleteResponse = esClient.Indices.Delete(sourceIndexName);
            if (!deleteResponse.IsValid)
            {
                // 删除前面创建的新index
                await esClient.Indices.DeleteAsync(destIndexName);
                return new MicroiSearchEngineResult(0, "删除index失败");
            }
            // 更改别名
            var putAliasResponse = await esClient.Indices.PutAliasAsync(destIndexName, indexName);
            if (!putAliasResponse.IsValid)
            {
                return Failed("更改索引别名失败，请联系管理员处理。");
            }

            // 保存indexName和别名对应关系
            if (existIndexAlias)
            {
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync(new
                {
                    FormEngineKey = MicroiSearchEngineConst.nameAliasTable,
                    Id = id,
                    _RowModel = new Dictionary<string, string>()
                    {
                        { "IndexName", destIndexName},
                        { "IndexAlias", indexName}
                    },
                    OsClient = currentOsClient
                });
                if (updateResult == null || updateResult.Code != 1)
                {
                    return Failed("修改索引别名关系失败，请联系管理员处理。");
                }
            }
            else
            {
                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(new
                {
                    FormEngineKey = MicroiSearchEngineConst.nameAliasTable,
                    _RowModel = new Dictionary<string, string>()
                    {
                        { "IndexName", destIndexName},
                        { "IndexAlias", indexName}
                    },
                    OsClient = currentOsClient
                });
                if (addResult == null || addResult.Code != 1)
                {
                    return Failed("新增索引别名关系失败，请联系管理员处理。");
                }
            }
            return new MicroiSearchEngineResult(1, "重建索引成功");
        }

        /// <summary>
        /// 创建索引
        /// </summary>
        /// <param name="indexName">索引名称（已含租户前缀）</param>
        /// <param name="data">表所属字段集合</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> CreateIndex(string indexName, List<dynamic> data, string osClient = null)
        {
            var currentOsClient = GetOsClient(osClient);
            indexName = TenantConfigurationSecurity.NormalizeSearchIndex(indexName, currentOsClient);

            PropertiesDescriptor<object> propertiesDescriptor = new PropertiesDescriptor<object>();
            propertiesDescriptor.Keyword(k => k.Name("Id"));
            propertiesDescriptor.Keyword(k => k.Name("UserId"));
            propertiesDescriptor.Keyword(k => k.Name("TenantId"));
            propertiesDescriptor.Keyword(k => k.Name("UserName"));
            foreach (var item in data)
            {
                if (item.Type != null && item.Type != "")
                {
                    string fieldType = Convert.ToString(item.Type);
                    // 此处还需要判断分词属性
                    if (fieldType.IndexOf("varchar", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        propertiesDescriptor.Text(k => k.Name(item.Name).Analyzer("ik_max_word").SearchAnalyzer("ik_smart"));
                    }
                    if (fieldType.IndexOf("mediumtext", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        propertiesDescriptor.Text(k => k.Name(item.Name).Analyzer("ik_max_word").SearchAnalyzer("ik_smart"));
                    }
                }
            }
            var dateArr = new List<string>() { "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "yyyy/MM/dd" };
            AliasesDescriptor aliasesDescriptor = new AliasesDescriptor();
            aliasesDescriptor.Alias(indexName);
            var response = await GetEsClient(currentOsClient).Indices.CreateAsync(indexName, i => i.Settings(s => s.NumberOfShards(3).NumberOfReplicas(1))
                                                                                    .Map(m => m.AutoMap()
                                                                                               .Dynamic(true)
                                                                                               .NumericDetection()
                                                                                               .DynamicDateFormats(dateArr)
                                                                                               .Properties(p => propertiesDescriptor)));
            if (!response.IsValid)
            {
                return Failed("创建索引失败，请检查当前租户的搜索配置。");
            }
            return new MicroiSearchEngineResult(1, "创建索引成功");
        }

        /// <summary>
        /// 删除索引
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> DeleteIndex(string indexName, string osClient = null)
        {
            var currentOsClient = GetOsClient(osClient);
            indexName = TenantConfigurationSecurity.NormalizeSearchIndex(indexName, currentOsClient);
            var result = await GetEsClient(currentOsClient).Indices.DeleteAsync(indexName);
            if (!result.IsValid)
            {
                return Failed("删除失败");
            }
            return new MicroiSearchEngineResult(1, "删除成功");
        }

        /// <summary>
        /// 索引是否存在
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<bool> IndexExist(string indexName, string osClient = null)
        {
            var currentOsClient = GetOsClient(osClient);
            indexName = TenantConfigurationSecurity.NormalizeSearchIndex(indexName, currentOsClient);
            var response = await GetEsClient(currentOsClient).Indices.ExistsAsync(indexName);
            return response.Exists;
            // 首先从关系表查找有无对应关系
            //var result = await MicroiEngine.FormEngine.GetFormDataAsync(new
            //{
            //    FormEngineKey = MicroiSearchEngineConst.nameAliasTable,
            //    _Where = new List<DiyWhere>() {
            //    new DiyWhere() {
            //        Name = "IndexAlias",
            //        Value = indexName,
            //        Type = "="
            //      }
            //    },
            //    OsClient = OsClientDefault.OsClient
            //});
            //if (result.Data != null)
            //{
            //    var response = await GetEsClient().Indices.ExistsAsync(result.Data.IndexName);
            //    return response.Exists;
            //}
            //else
            //{
            //    var response = await GetEsClient().Indices.ExistsAsync(indexName);
            //    return response.Exists;
            //}

        }

        /// <summary>
        /// 无分页查询
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="index">索引名称</param>
        /// <param name="queryContainer">查询条件</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> GetSearchResponse<T>(string index, QueryContainer queryContainer, string osClient = null) where T : class
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                index = TenantConfigurationSecurity.NormalizeSearchIndex(index, currentOsClient);
                var result = await GetEsClient(currentOsClient).SearchAsync<T>(s => s.Index(index).Query(q => queryContainer));
                if (result != null && result.IsValid)
                {
                    return new MicroiSearchEngineResult()
                    {
                        Code = 1,
                        Data = result.Documents,
                        DataCount = result.Total,
                        Msg = "查询成功"
                    };
                }
            }
            catch (Exception)
            {
                return Failed("查询失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }

        /// <summary>
        /// 依据from、size分页查询,支持跳页，但数据量大时有性能问题
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="searchParam">查询参数</param>
        /// <param name="queryContainer">查询条件</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> Search<T>(MicroiSearchEngineParam searchParam, QueryContainer queryContainer, string osClient = null) where T : class
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                string indexName = GetIndexName(searchParam.TableName, currentOsClient);
                SearchDescriptor<T> search = new SearchDescriptor<T>();
                search.Index(indexName).Query(q => queryContainer).From((searchParam.pageIndex - 1) * searchParam.pageSize).Size(searchParam.pageSize);
                if (searchParam.Sorts != null && searchParam.Sorts.Count > 0)
                {
                    foreach (MicroiSearchEngineSortModel sort in searchParam.Sorts)
                    {
                        if (sort.Order.Equals(MicroiSearchEngineConst.descSort, StringComparison.OrdinalIgnoreCase))
                        {
                            search.Sort(f => f.Field(sort.Field, SortOrder.Descending));
                        }
                        else
                        {
                            search.Sort(f => f.Field(sort.Field, SortOrder.Ascending));
                        }
                    }
                }
                var result = await GetEsClient(currentOsClient).SearchAsync<T>(s => search);
                if (result != null && result.IsValid)
                {
                    return new MicroiSearchEngineResult()
                    {
                        Code = 1,
                        Data = result.Documents,
                        DataCount = result.Total,
                        Msg = "查询成功"
                    };
                }
            }
            catch (Exception)
            {
                return Failed("查询失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }

        /// <summary>
        /// searchAfter分页，不支持随机分页，每次获取下一页的数据需要将上页最后一条记录传过去
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="searchParam">查询参数</param>
        /// <param name="queryContainer">查询条件</param>
        /// <param name="osClient">租户标识</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> SearchBySearchAfter<T>(MicroiSearchEngineParam searchParam, QueryContainer queryContainer, string osClient = null) where T : class
        {
            try
            {
                var currentOsClient = GetOsClient(osClient);
                string indexName = GetIndexName(searchParam.TableName, currentOsClient);
                SearchDescriptor<T> search = new SearchDescriptor<T>();
                search.Index(indexName).Query(q => queryContainer).Size(searchParam.pageSize);
                if (searchParam.SearchAfter != null && searchParam.SearchAfter.Length > 0)
                {
                    search.SearchAfter(searchParam.SearchAfter);
                }
                if (searchParam.Sorts != null && searchParam.Sorts.Count > 0)
                {
                    foreach (MicroiSearchEngineSortModel sort in searchParam.Sorts)
                    {
                        if (sort.Order.Equals(MicroiSearchEngineConst.descSort, StringComparison.OrdinalIgnoreCase))
                        {
                            search.Sort(f => f.Field(sort.Field, SortOrder.Descending));
                        }
                        else
                        {
                            search.Sort(f => f.Field(sort.Field, SortOrder.Ascending));
                        }
                    }
                }
                var result = await GetEsClient(currentOsClient).SearchAsync<T>(s => search);
                if (result != null && result.IsValid)
                {
                    IReadOnlyCollection<object> sorts = null;
                    if (result.Hits != null && result.Hits.Count() > 0)
                    {
                        sorts = result.Hits.LastOrDefault().Sorts;
                    }
                    return new MicroiSearchEngineResult()
                    {
                        Code = 1,
                        Data = result.Documents,
                        DataCount = result.Total,
                        SearchAfter = sorts,
                        Msg = "查询成功"
                    };
                }
            }
            catch (Exception)
            {
                return Failed("查询失败，搜索请求已拒绝。");
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }
    }
}
