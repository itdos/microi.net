using Dos.Common;
using Elasticsearch.Net;
using Microi.net;
using Nest;
using Newtonsoft.Json;
using NPOI.SS.Formula.Functions;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiElasticSearchHelper : IMicroiSearchEngineHelper
    {
        private ElasticClient GetEsClient()
        {
            var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
            var clientModel = OsClient.GetClient(osClientName);
            string host = clientModel.SearchEngineHost;
            var hostArr = host.Split(',');
            var uris = new Uri[hostArr.Length];
            for (int i = 0; i < hostArr.Length; i++)
            {
                string ipStr = $"http://{hostArr[i]}:{clientModel.SearchEnginePort}";
                uris[i] = new Uri(ipStr);
            }
            //var pool = new SniffingConnectionPool(uris);
            var pool = new StaticConnectionPool(uris);
            var client = new ElasticClient(new ConnectionSettings(pool));
            return client;
        }

        /// <summary>
        /// 同步表字段到es
        /// </summary>
        /// <param name="indexName">表名称</param>
        /// <param name="tableId">表id</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AsyncIndex(string tableId)
        {
            try
            {
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
                    OsClient = OsClient.OsClientName
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
                    OsClient = OsClient.OsClientName
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
                bool exist = await IndexExist(tableResult.Data.Name);
                if (exist)
                {
                    DeleteIndexResponse deleteResponse = await GetEsClient().Indices.DeleteAsync(tableResult.Data.Name);
                    if (!deleteResponse.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "删除原index失败");
                    }
                }
                return await CreateIndex(tableResult.Data.Name, fielsResult.Data);
            }
            catch (Exception ex)
            {
                return new MicroiSearchEngineResult(0, "同步索引失败:" + ex.Message);
            }

        }

        /// <summary>
        /// 新增文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据Id</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AddDocument(string tableName, string id)
        {
            try
            {
                // 依据表名称以及id获取数据
                var dataResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                {
                    FormEngineKey = tableName,
                    Id = id,
                    OsClient = OsClient.OsClientName
                });
                if (dataResult.Code == 1 && dataResult.Data != null)
                {
                    string jsonStr = JsonConvert.SerializeObject(dataResult.Data);
                    Dictionary<string, object> dic = JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonStr);
                    var result = await GetEsClient().IndexAsync<Dictionary<string, object>>(dic, i => i.Index(tableName).Id(id));
                    if (result == null || !result.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "新增失败");
                    }
                }

            }
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(1, "新增成功");
        }

        /// <summary>
        /// 修改文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据Id</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> UpdateDocument(string tableName, string id)
        {
            try
            {
                // 依据表名称以及id获取数据
                var dataResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                {
                    FormEngineKey = tableName,
                    Id = id,
                    OsClient = OsClient.OsClientName
                });
                if (dataResult.Code == 1 && dataResult.Data != null)
                {
                    string jsonStr = JsonConvert.SerializeObject(dataResult.Data);
                    Dictionary<string, object> dic = JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonStr);
                    IUpdateRequest<Dictionary<string, object>, Dictionary<string, object>> request = new UpdateRequest<Dictionary<string, object>, Dictionary<string, object>>(tableName, id)
                    {
                        Doc = dic,
                    };
                    var result = await GetEsClient().UpdateAsync(request);
                    if (result == null || !result.IsValid)
                    {
                        return new MicroiSearchEngineResult(0, "更新失败");
                    }
                }
            }
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(1, "更新成功");
        }

        /// <summary>
        /// 删除文档
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <param name="id">数据id</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> DeleteDocument(string tableName, string id)
        {
            try
            {
                IDeleteRequest request = new DeleteRequest(tableName, id);
                var result = await GetEsClient().DeleteAsync(request);
                if (result == null || !result.IsValid)
                {
                    return new MicroiSearchEngineResult(0, "删除失败");
                }
            }
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(1, "删除成功");
        }

        /// <summary>
        /// 新增字段
        /// </summary>
        /// <param name="fieldModel"></param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AddField(MicroiSearchEngineFieldModel fieldModel)
        {
            try
            {
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
                putMappingDescriptor.Index(fieldModel.IndexName);
                var response = await GetEsClient().Indices.PutMappingAsync(putMappingDescriptor);
                if (!response.IsValid)
                {
                    return new MicroiSearchEngineResult(0, "新增字段失败");
                }
                return new MicroiSearchEngineResult(1, "新增字段成功");
            }
            catch (Exception ex)
            {
                return new MicroiSearchEngineResult(0, "新增字段失败:" + ex.Message);
            }
        }

        /// <summary>
        /// 查询数据
        /// </summary>
        /// <param name="searchParam"></param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> GetSearchResponse(MicroiSearchEngineParam searchParam)
        {
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
                OsClient = OsClient.OsClientName
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
                    return await Search<Dictionary<string, object>>(searchParam, boolQuery);
                }
                else
                {
                    return await SearchBySearchAfter<Dictionary<string, object>>(searchParam, boolQuery);
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
                return await Search<Dictionary<string, object>>(searchParam, boolQuery);
            }
            else
            {
                return await SearchBySearchAfter<Dictionary<string, object>>(searchParam, boolQuery);
            }
        }

        /// <summary>
        /// 同步表数据到index
        /// </summary>
        /// <param name="tableName">表名称</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> AsyncTableDataToIndex(string tableId)
        {
            try
            {
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
                    OsClient = OsClient.OsClientName
                };
                // 依据tableId获取到表名称
                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(tableParam);
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    return new MicroiSearchEngineResult(0, "未获取到表信息");
                }
                // 删除索引中所有数据
                IDeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(tableResult.Data.Name);
                deleteByQueryRequest.Query = new MatchAllQuery();
                var response = await GetEsClient().DeleteByQueryAsync(deleteByQueryRequest);
                if (!response.IsValid)
                {
                    return new MicroiSearchEngineResult(0, "同步失败：" + response.ServerError.ToString());
                }
                // 获取表数据
                var param = new
                {
                    FormEngineKey = tableResult.Data.Name,
                    OsClient = OsClient.OsClientName
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
                foreach (var item in list)
                {
                    await GetEsClient().IndexAsync<Dictionary<string, object>>(item, i => i.Index(tableResult.Data.Name).Id(item["Id"].ToString()));
                }
                return new MicroiSearchEngineResult(1, "同步成功");
            }
            catch (Exception ex)
            {
                return new MicroiSearchEngineResult(0, "同步失败:" + ex.Message);
            }

        }

        /// <summary>
        /// 重建索引
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <param name="data">表所属字段集合</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> ReIndex(string indexName, List<dynamic> data)
        {
            // 创建新索引
            string destIndexName = $"{indexName}-{Ulid.NewUlid().ToString()}";
            var createIndexResponse = await CreateIndex(destIndexName, data);
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
                OsClient = OsClient.OsClientName
            });
            string sourceIndexName = indexName;
            if (result != null && result.Data != null)
            {
                existIndexAlias = true;
                id = result.Data.Id;
                sourceIndexName = result.Data.IndexName;
            }
            // reindex 复制源index数据到新index
            var reindexResponse = GetEsClient().ReindexOnServer(r => r
                .Source(sou => sou.Index(sourceIndexName))
                .Destination(des => des.Index(destIndexName))
                .WaitForCompletion(true)
                );
            if (!reindexResponse.IsValid)
            {
                // 删除前面创建的新index
                await GetEsClient().Indices.DeleteAsync(destIndexName);
                return new MicroiSearchEngineResult(0, "同步数据失败");
            }
            // 删除原index
            var deleteResponse = GetEsClient().Indices.Delete(sourceIndexName);
            if (!deleteResponse.IsValid)
            {
                // 删除前面创建的新index
                await GetEsClient().Indices.DeleteAsync(destIndexName);
                return new MicroiSearchEngineResult(0, "删除index失败");
            }
            // 更改别名
            var putAliasResponse = await GetEsClient().Indices.PutAliasAsync(destIndexName, indexName);
            if (!putAliasResponse.IsValid)
            {
                string message = $"更改别名失败，需要手动修改别名,源index名称为：{destIndexName},别名为：{indexName}";
                return new MicroiSearchEngineResult(0, message);
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
                    OsClient = OsClient.OsClientName
                });
                if (updateResult == null || updateResult.Code != 1)
                {
                    string message = $"修改对应关系失败，需要手动修改,源index名称为：{destIndexName},别名为：{indexName}，Id为：{id}";
                    return new MicroiSearchEngineResult(0, message);
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
                    OsClient = OsClient.OsClientName
                });
                if (addResult == null || addResult.Code != 1)
                {
                    string message = $"新增对应关系失败，需要手动新增,源index名称为：{destIndexName},别名为：{indexName}";
                    return new MicroiSearchEngineResult(0, message);
                }
            }
            return new MicroiSearchEngineResult(1, "重建索引成功");
        }

        /// <summary>
        /// 创建索引
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <param name="data">表所属字段集合</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> CreateIndex(string indexName, List<dynamic> data)
        {

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
            var response = await GetEsClient().Indices.CreateAsync(indexName, i => i.Settings(s => s.NumberOfShards(3).NumberOfReplicas(1))
                                                                                    .Map(m => m.AutoMap()
                                                                                               .Dynamic(true)
                                                                                               .NumericDetection()
                                                                                               .DynamicDateFormats(dateArr)
                                                                                               .Properties(p => propertiesDescriptor)));
            if (!response.IsValid)
            {
                return new MicroiSearchEngineResult(0, "创建索引失败:" + response.ServerError);
            }
            return new MicroiSearchEngineResult(1, "创建索引成功");
        }

        /// <summary>
        /// 删除索引
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> DeleteIndex(string indexName)
        {
            var result = await GetEsClient().Indices.DeleteAsync(indexName);
            if (!result.IsValid)
            {
                return new MicroiSearchEngineResult(1, "删除失败");
            }
            return new MicroiSearchEngineResult(1, "删除成功");
        }

        /// <summary>
        /// 索引是否存在
        /// </summary>
        /// <param name="indexName">索引名称</param>
        /// <returns></returns>
        private async Task<bool> IndexExist(string indexName)
        {
            var response = await GetEsClient().Indices.ExistsAsync(indexName);
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
            //    OsClient = OsClient.OsClientName
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
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> GetSearchResponse<T>(string index, QueryContainer queryContainer) where T : class
        {
            try
            {
                var result = await GetEsClient().SearchAsync<T>(s => s.Index(index).Query(q => queryContainer));
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
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }

        /// <summary>
        /// 依据from、size分页查询,支持跳页，但数据量大时有性能问题
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="searchParam">查询参数</param>
        /// <param name="queryContainer">查询条件</param>
        /// <returns></returns>
        private async Task<MicroiSearchEngineResult> Search<T>(MicroiSearchEngineParam searchParam, QueryContainer queryContainer) where T : class
        {
            try
            {
                SearchDescriptor<T> search = new SearchDescriptor<T>();
                search.Index(searchParam.TableName).Query(q => queryContainer).From((searchParam.pageIndex - 1) * searchParam.pageSize).Size(searchParam.pageSize);
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
                var result = await GetEsClient().SearchAsync<T>(s => search);
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
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }

        /// <summary>
        /// searchAfter分页，不支持随机分页，每次获取下一页的数据需要将上页最后一条记录传过去
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="searchParam">查询参数</param>
        /// <param name="queryContainer">查询条件</param>
        /// <returns></returns>
        public async Task<MicroiSearchEngineResult> SearchBySearchAfter<T>(MicroiSearchEngineParam searchParam, QueryContainer queryContainer) where T : class
        {
            try
            {
                SearchDescriptor<T> search = new SearchDescriptor<T>();
                search.Index(searchParam.TableName).Query(q => queryContainer).Size(searchParam.pageSize);
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
                var result = await GetEsClient().SearchAsync<T>(s => search);
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
            catch (Exception ex)
            {


                return new MicroiSearchEngineResult(0, ex.Message);
            }
            return new MicroiSearchEngineResult(0, "查询失败");
        }
    }
}
