using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 为 AI 模型配置增加“可选向量数据库”模式。
    ///
    /// 兼容约定：
    /// 1. EnableVectorDatabase 缺失、空值或 0 均表示关闭，升级不得主动连接 Qdrant/Ollama。
    /// 2. 保留客户已有 Tab 和字段配置，只幂等补字段并把向量专属字段归入独立 Tab。
    /// 3. 老数据库缺少向量连接字段时一并补齐，但连接地址不设置 localhost 默认值，
    ///    避免客户未启用向量模式时发生隐式外连。
    /// </summary>
    public class Upgrade18
    {
        // 6.5.7 的第 4 个正式迁移修订，确保已经运行过旧版 6.5.6.x
        // 升级程序的客户仍会补齐可选向量模式字段与 Tab。
        public static string Version = "6.5.7.4";

        private const string TableName = "mic_ai";
        private const string VectorTabName = "向量数据库（可选）";
        private const string VectorTabId = "91d1e54c-69da-4696-bf46-f51e2bbb67b0";

        private static readonly HashSet<string> VectorFieldNames =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "EnableVectorDatabase",
                "EmbeddingApiUrl",
                "QdrantHost",
                "QdrantPort",
                "QdrantApiKey",
                "VectorTopK",
                "VectorScoreThreshold"
            };

        private static readonly IReadOnlyList<AiVectorField> RequiredFields =
            new List<AiVectorField>
            {
                new AiVectorField
                {
                    Name = "EnableVectorDatabase",
                    Label = "是否启用向量数据库",
                    Type = "int",
                    Component = "Switch",
                    DefaultValue = "0",
                    Sort = 760,
                    TableWidth = 160,
                    Description =
                        "默认关闭。关闭时使用大模型关键词扩展与权限内 Schema 关键词检索，" +
                        "并且不连接、不初始化、不同步 Ollama/Embedding/Qdrant；开启后向量检索仅作为可选增强。"
                },
                new AiVectorField
                {
                    Name = "EmbeddingApiUrl",
                    Label = "Embedding 接口地址",
                    Type = "varchar(500)",
                    Component = "Text",
                    Sort = 800,
                    TableWidth = 260,
                    Description = "仅在启用向量数据库后使用，例如 Ollama/OpenAI 兼容的 embeddings 地址。"
                },
                new AiVectorField
                {
                    Name = "QdrantHost",
                    Label = "Qdrant 主机",
                    Type = "varchar(200)",
                    Component = "Text",
                    Sort = 900,
                    TableWidth = 200,
                    Description = "仅在启用向量数据库后连接；不要在未部署 Qdrant 时填写。"
                },
                new AiVectorField
                {
                    Name = "QdrantPort",
                    Label = "Qdrant HTTP端口",
                    Type = "int",
                    Component = "NumberText",
                    Sort = 1000,
                    TableWidth = 120,
                    Description =
                        "Qdrant HTTP/REST 端口（Qdrant 默认 6333；若 Docker 做了端口映射，请填写宿主机映射端口）；仅在启用向量数据库后使用。"
                },
                new AiVectorField
                {
                    Name = "QdrantApiKey",
                    Label = "Qdrant ApiKey",
                    Type = "varchar(500)",
                    Component = "Text",
                    Sort = 1100,
                    TableWidth = 220,
                    Description = "Qdrant 鉴权密钥；仅在启用向量数据库后使用。"
                },
                new AiVectorField
                {
                    Name = "VectorTopK",
                    Label = "向量召回数量",
                    Type = "int",
                    Component = "NumberText",
                    DefaultValue = "10",
                    Sort = 1300,
                    TableWidth = 140,
                    Description = "向量模式候选召回数量；未填写时后端使用 10。"
                },
                new AiVectorField
                {
                    Name = "VectorScoreThreshold",
                    Label = "向量相似度阈值",
                    Type = "decimal(18,2)",
                    Component = "NumberText",
                    DefaultValue = "0.35",
                    Sort = 1400,
                    TableWidth = 150,
                    Description = "向量模式最低相似度阈值；未填写时后端使用 0.35。"
                }
            };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(
                    "diy_table",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "Name", "=", TableName }
                        },
                        _SelectFields = new[] { "Id", "Name", "Tabs" }
                    });

                // 部分非常早期或裁剪版数据库没有安装 AI 引擎。不能因此阻断整个平台升级；
                // 将来安装当前 AI 引擎资源时会直接获得完整字段。
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    Console.WriteLine(
                        $"Microi：【提示】平台自动升级【{osClient}】未找到 {TableName}，跳过 AI 向量模式元数据升级。");
                    return messages;
                }

                string tableId = Convert.ToString((object)tableResult.Data.Id);
                string originalTabs = Convert.ToString((object)tableResult.Data.Tabs);
                JArray tabs = ParseTabs(originalTabs, messages);
                if (tabs == null) return messages;

                var vectorTab = tabs
                    .OfType<JObject>()
                    .FirstOrDefault(tab =>
                        string.Equals(
                            Convert.ToString(tab["Name"]),
                            VectorTabName,
                            StringComparison.OrdinalIgnoreCase));
                if (vectorTab == null)
                {
                    vectorTab = new JObject
                    {
                        ["Id"] = VectorTabId,
                        ["Name"] = VectorTabName,
                        ["EnName"] = "vector-db-optional",
                        ["Icon"] = "Connection",
                        ["Display"] = true,
                        ["Sort"] = 2
                    };
                    tabs.Add(vectorTab);
                }
                else if (string.IsNullOrWhiteSpace(Convert.ToString(vectorTab["Id"])))
                {
                    vectorTab["Id"] = VectorTabId;
                }

                var vectorTabId = Convert.ToString(vectorTab["Id"]);
                var updateTableResult = await MicroiEngine.FormEngine.UptDiyTable(
                    new DiyTableParam
                    {
                        Id = tableId,
                        Name = TableName,
                        Tabs = tabs.ToString(Formatting.None),
                        OsClient = osClient
                    });
                if (updateTableResult.Code != 1)
                {
                    messages.Add($"更新 {TableName}.Tabs 失败：{updateTableResult.Msg}");
                    return messages;
                }

                foreach (var field in RequiredFields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync(
                        "diy_field",
                        new
                        {
                            OsClient = osClient,
                            _Where = new List<object>
                            {
                                new List<object> { "TableId", "=", tableId },
                                new List<object> { "Name", "=", field.Name }
                            },
                            _SelectFields = new[]
                            {
                                "Id",
                                "Name",
                                "Label",
                                "Description"
                            }
                        });
                    if (existing.Code == 1 && existing.Data != null)
                    {
                        // 历史 QdrantPort 曾容易被理解成 gRPC 端口。对既有字段也
                        // 幂等修正展示文案，运行时始终按 HTTP/REST 端口解释。
                        if (string.Equals(
                                field.Name,
                                "QdrantPort",
                                StringComparison.OrdinalIgnoreCase))
                        {
                            var existingRow =
                                JObject.FromObject((object)existing.Data);
                            if (!string.Equals(
                                    Convert.ToString(existingRow["Label"]),
                                    field.Label,
                                    StringComparison.Ordinal)
                                || !string.Equals(
                                    Convert.ToString(
                                        existingRow["Description"]),
                                    field.Description,
                                    StringComparison.Ordinal))
                            {
                                var updateMetadataResult =
                                    await UpgradeTrustedFormEngine.UpdateAsync(
                                        "diy_field",
                                        osClient,
                                        new
                                            {
                                                OsClient = osClient,
                                                Id = Convert.ToString(
                                                    existingRow["Id"]),
                                                TableId = tableId,
                                                field.Label,
                                                field.Description
                                            });
                                if (updateMetadataResult.Code != 1)
                                {
                                    messages.Add(
                                        $"修正 {TableName}.{field.Name} HTTP端口说明失败："
                                        + updateMetadataResult.Msg);
                                }
                            }
                        }
                        continue;
                    }

                    var addResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName,
                        field.Name,
                        field.Label,
                        field.Type,
                        field.Component,
                        field.DefaultValue,
                        field.Sort,
                        field.TableWidth,
                        field.Description,
                        Tab = vectorTabId,
                        Visible = 1,
                        AppVisible = 1
                    });
                    if (addResult.Code != 1)
                    {
                        messages.Add($"新增 {TableName}.{field.Name} 失败：{addResult.Msg}");
                    }
                }
                if (messages.Count > 0) return messages;

                // 这里只读取定位字段并做稀疏更新。UptDiyFieldList 会把整张表所有
                // 字段的 Sort 重新按 100 递增，升级程序不能因此改写客户已有布局顺序。
                var fieldListResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                    "diy_field",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "TableId", "=", tableId },
                            new List<object> { "IsDeleted", "<>", 1 }
                        },
                        _OrderBy = "Sort",
                        _OrderByType = "ASC",
                        _SelectFields = new[] { "Id", "TableId", "Name", "Tab", "Visible" },
                        _PageSize = 1000
                    });
                if (fieldListResult.Code != 1 || fieldListResult.Data == null)
                {
                    messages.Add($"读取 {TableName} 字段列表失败：{fieldListResult.Msg}");
                    return messages;
                }

                var changedCount = 0;
                foreach (var fieldRow in fieldListResult.Data
                             .Cast<object>()
                             .Select(JObject.FromObject))
                {
                    if (!VectorFieldNames.Contains(Convert.ToString(fieldRow["Name"])))
                    {
                        continue;
                    }

                    var currentTab = Convert.ToString(fieldRow["Tab"]);
                    var currentVisible = fieldRow["Visible"]?.Value<int?>() ?? 0;
                    if (string.Equals(
                            currentTab,
                            vectorTabId,
                            StringComparison.OrdinalIgnoreCase)
                        && currentVisible == 1)
                    {
                        continue;
                    }

                    var updateFieldResult = await UpgradeTrustedFormEngine.UpdateAsync(
                        "diy_field",
                        osClient,
                        new
                        {
                            OsClient = osClient,
                            Id = Convert.ToString(fieldRow["Id"]),
                            TableId = tableId,
                            Tab = vectorTabId,
                            Visible = 1
                        });
                    if (updateFieldResult.Code != 1)
                    {
                        messages.Add(
                            $"迁移 {TableName}.{Convert.ToString(fieldRow["Name"])} 向量字段配置失败："
                            + updateFieldResult.Msg);
                        continue;
                    }
                    changedCount++;
                }

                if (changedCount > 0)
                {
                    await FormEngineAuthorizationCache.InvalidateAsync(osClient);
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveParentAsync(
                        $"Microi:{osClient}:FormData:diy_table_field_list:*");
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级 AI 可选向量数据库配置失败：" + ex.Message);
            }

            return messages;
        }

        private static JArray ParseTabs(string tabsText, List<string> messages)
        {
            if (string.IsNullOrWhiteSpace(tabsText)) return new JArray();
            try
            {
                return JArray.Parse(tabsText);
            }
            catch (Exception ex)
            {
                messages.Add(
                    $"{TableName}.Tabs 不是有效 JSON，为保护客户现有配置未自动覆盖：{ex.Message}");
                return null;
            }
        }

        private sealed class AiVectorField
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public string DefaultValue { get; set; }
            public int Sort { get; set; }
            public int TableWidth { get; set; }
            public string Description { get; set; }
        }
    }
}
