using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class FormEngineExtend
    {
        private static readonly HashSet<string> DiyLangSystemFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id", "Key", "Code", "CreateTime", "UpdateTime", "CreateUser", "UpdateUser",
            "UserId", "UserName", "IsDeleted", "OsClient", "FormEngineKey"
        };
        private static readonly string[] SysMenuButtonFields = new[]
        {
            "MoreBtns", "FormBtns", "BatchSelectMoreBtns", "PageTabs", "ExportMoreBtns", "PageBtns"
        };
        private static readonly ConcurrentDictionary<string, byte> DiyLangFullSyncRunning = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangTranslateUnavailable = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangTranslateUnsupportedTarget = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> DiyLangMetadataSyncQueued = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly object DiyLangCacheLock = new object();

        private sealed class DiyLangSeed
        {
            public string Key { get; set; }
            public string ZhCN { get; set; }
            public string En { get; set; }
            public string ZhTW { get; set; }
        }

        private static readonly List<DiyLangSeed> ClientLangSeeds = new List<DiyLangSeed>()
        {
            new DiyLangSeed { Key = "Msg.Home", ZhCN = "首页", En = "Home", ZhTW = "首頁" },
            new DiyLangSeed { Key = "Msg.All", ZhCN = "全部", En = "All", ZhTW = "全部" },
            new DiyLangSeed { Key = "Msg.System", ZhCN = "系统", En = "System", ZhTW = "系統" },
            new DiyLangSeed { Key = "Msg.Business", ZhCN = "业务", En = "Business", ZhTW = "業務" },
            new DiyLangSeed { Key = "Msg.Feishu", ZhCN = "飞书", En = "Feishu", ZhTW = "飛書" },
            new DiyLangSeed { Key = "Msg.Wechat", ZhCN = "微信", En = "WeChat", ZhTW = "微信" },
            new DiyLangSeed { Key = "Msg.Test", ZhCN = "测试", En = "Test", ZhTW = "測試" },
            new DiyLangSeed { Key = "Msg.Other", ZhCN = "其它", En = "Other", ZhTW = "其他" },
            new DiyLangSeed { Key = "Msg.AppStore", ZhCN = "应用商城", En = "App Store", ZhTW = "應用商城" },
            new DiyLangSeed { Key = "Msg.ApiEngine", ZhCN = "接口引擎", En = "API Engine", ZhTW = "接口引擎" },
            new DiyLangSeed { Key = "Msg.AiEngine", ZhCN = "AI 引擎", En = "AI Engine", ZhTW = "AI 引擎" },
            new DiyLangSeed { Key = "Msg.FormEngine", ZhCN = "表单引擎", En = "Form Engine", ZhTW = "表單引擎" },
            new DiyLangSeed { Key = "Msg.ModuleEngine", ZhCN = "模块引擎", En = "Module Engine", ZhTW = "模組引擎" },
            new DiyLangSeed { Key = "Msg.SystemEngine", ZhCN = "系统引擎", En = "System Engine", ZhTW = "系統引擎" },
            new DiyLangSeed { Key = "Msg.Add", ZhCN = "新增", En = "Add", ZhTW = "新增" },
            new DiyLangSeed { Key = "Msg.Load", ZhCN = "加载", En = "Load", ZhTW = "載入" },
            new DiyLangSeed { Key = "Msg.Delete", ZhCN = "删除", En = "Delete", ZhTW = "刪除" },
            new DiyLangSeed { Key = "Msg.Cancel", ZhCN = "取消", En = "Cancel", ZhTW = "取消" },
            new DiyLangSeed { Key = "Msg.Refresh", ZhCN = "刷新", En = "Refresh", ZhTW = "重新整理" },
            new DiyLangSeed { Key = "Msg.Preview", ZhCN = "预览", En = "Preview", ZhTW = "預覽" },
            new DiyLangSeed { Key = "Msg.Submit", ZhCN = "提交", En = "Submit", ZhTW = "送出" },
            new DiyLangSeed { Key = "Msg.Save", ZhCN = "保存", En = "Save", ZhTW = "儲存" },
            new DiyLangSeed { Key = "Msg.Import", ZhCN = "导入", En = "Import", ZhTW = "匯入" },
            new DiyLangSeed { Key = "Msg.Export", ZhCN = "导出", En = "Export", ZhTW = "匯出" },
            new DiyLangSeed { Key = "Msg.ExportTemplate", ZhCN = "导出模板", En = "Export Template", ZhTW = "匯出模板" },
            new DiyLangSeed { Key = "Msg.Search", ZhCN = "搜索", En = "Search", ZhTW = "搜尋" },
            new DiyLangSeed { Key = "Msg.MoreSearch", ZhCN = "更多搜索", En = "More Search", ZhTW = "更多搜尋" },
            new DiyLangSeed { Key = "Msg.SwitchTableDisplay", ZhCN = "切换显示", En = "Switch Display", ZhTW = "切換顯示" },
            new DiyLangSeed { Key = "Msg.DevDesign", ZhCN = "开发设计", En = "Dev Design", ZhTW = "開發設計" },
            new DiyLangSeed { Key = "Msg.Detail", ZhCN = "详情", En = "Detail", ZhTW = "詳情" },
            new DiyLangSeed { Key = "Msg.More", ZhCN = "更多", En = "More", ZhTW = "更多" },
            new DiyLangSeed { Key = "Msg.Close", ZhCN = "关闭", En = "Close", ZhTW = "關閉" },
            new DiyLangSeed { Key = "Msg.Edit", ZhCN = "编辑", En = "Edit", ZhTW = "編輯" },
            new DiyLangSeed { Key = "Msg.Copy", ZhCN = "复制", En = "Copy", ZhTW = "複製" },
            new DiyLangSeed { Key = "Msg.View", ZhCN = "查看", En = "View", ZhTW = "查看" },
            new DiyLangSeed { Key = "Msg.Name", ZhCN = "名称", En = "Name", ZhTW = "名稱" },
            new DiyLangSeed { Key = "Msg.Key", ZhCN = "Key", En = "Key", ZhTW = "Key" },
            new DiyLangSeed { Key = "Msg.Action", ZhCN = "操作", En = "Action", ZhTW = "操作" },
            new DiyLangSeed { Key = "Msg.CreateTime", ZhCN = "创建时间", En = "CreateTime", ZhTW = "建立時間" },
            new DiyLangSeed { Key = "Msg.Creator", ZhCN = "创建人", En = "Creator", ZhTW = "建立人" },
            new DiyLangSeed { Key = "Msg.UpdateTime", ZhCN = "修改时间", En = "UpdateTime", ZhTW = "修改時間" },
            new DiyLangSeed { Key = "Msg.NoData", ZhCN = "暂无数据", En = "No Data", ZhTW = "暫無資料" },
            new DiyLangSeed { Key = "Msg.DataLog", ZhCN = "数据日志", En = "Data Log", ZhTW = "資料日誌" },
            new DiyLangSeed { Key = "Msg.DataComment", ZhCN = "数据评论", En = "Data Comment", ZhTW = "資料評論" },
            new DiyLangSeed { Key = "Msg.DataVersion", ZhCN = "数据版本", En = "Data Version", ZhTW = "資料版本" },
            new DiyLangSeed { Key = "Msg.DataVersionPreview", ZhCN = "数据版本预览", En = "Data Version Preview", ZhTW = "資料版本預覽" },
            new DiyLangSeed { Key = "Msg.ViewDiff", ZhCN = "查看差异", En = "View Diff", ZhTW = "查看差異" },
            new DiyLangSeed { Key = "Msg.Replying", ZhCN = "正在回复", En = "Replying", ZhTW = "正在回覆" },
            new DiyLangSeed { Key = "Msg.Reply", ZhCN = "回复", En = "Reply", ZhTW = "回覆" },
            new DiyLangSeed { Key = "Msg.PreviousComment", ZhCN = "上一条评论", En = "Previous Comment", ZhTW = "上一則評論" },
            new DiyLangSeed { Key = "Msg.CollapseOriginal", ZhCN = "收起原文", En = "Collapse Original", ZhTW = "收起原文" },
            new DiyLangSeed { Key = "Msg.ExpandOriginal", ZhCN = "展开原文", En = "Expand Original", ZhTW = "展開原文" },
            new DiyLangSeed { Key = "Msg.EnterCommentContent", ZhCN = "请输入评论内容", En = "Please enter comment content", ZhTW = "請輸入評論內容" },
            new DiyLangSeed { Key = "Msg.EnterReplyContent", ZhCN = "请输入回复内容", En = "Please enter reply content", ZhTW = "請輸入回覆內容" },
            new DiyLangSeed { Key = "Msg.NoVersion", ZhCN = "暂无版本", En = "No Version", ZhTW = "暫無版本" },
            new DiyLangSeed { Key = "Msg.DraftBox", ZhCN = "草稿箱", En = "Draft Box", ZhTW = "草稿箱" },
            new DiyLangSeed { Key = "Msg.SaveToDraftBox", ZhCN = "保存至草稿箱", En = "Save to Draft Box", ZhTW = "儲存至草稿箱" },
            new DiyLangSeed { Key = "Msg.LoadFromDraftBox", ZhCN = "从草稿箱加载", En = "Load from Draft Box", ZhTW = "從草稿箱載入" },
            new DiyLangSeed { Key = "Msg.CurrentFormDraft", ZhCN = "当前表单草稿", En = "Current Form Draft", ZhTW = "目前表單草稿" },
            new DiyLangSeed { Key = "Msg.NoDraft", ZhCN = "暂无草稿", En = "No Draft", ZhTW = "暫無草稿" },
            new DiyLangSeed { Key = "Msg.UnnamedDraft", ZhCN = "未命名草稿", En = "Unnamed Draft", ZhTW = "未命名草稿" },
            new DiyLangSeed { Key = "Msg.Current", ZhCN = "当前", En = "Current", ZhTW = "目前" },
            new DiyLangSeed { Key = "Msg.ApiAddress", ZhCN = "自定义接口地址", En = "Custom API URL", ZhTW = "自訂接口地址" },
            new DiyLangSeed { Key = "Msg.ApiDescription", ZhCN = "接口说明", En = "API Description", ZhTW = "接口說明" },
            new DiyLangSeed { Key = "Msg.ApiV8Code", ZhCN = "接口V8代码", En = "API V8 Code", ZhTW = "接口V8代碼" },
            new DiyLangSeed { Key = "Msg.Enabled", ZhCN = "启用", En = "Enabled", ZhTW = "啟用" },
            new DiyLangSeed { Key = "Msg.DistributedLock", ZhCN = "分布式锁", En = "Distributed Lock", ZhTW = "分散式鎖" },
            new DiyLangSeed { Key = "Msg.AllowAnonymous", ZhCN = "允许匿名调用", En = "Allow Anonymous", ZhTW = "允許匿名調用" },
            new DiyLangSeed { Key = "Msg.ResponseFile", ZhCN = "响应文件", En = "Response File", ZhTW = "回應檔案" },
            new DiyLangSeed { Key = "Msg.AvailableRole", ZhCN = "可访问角色", En = "Available Roles", ZhTW = "可訪問角色" },
            new DiyLangSeed { Key = "Msg.Version", ZhCN = "版本号", En = "Version", ZhTW = "版本號" },
            new DiyLangSeed { Key = "Data.SysApiImportMicroiStorePackage", ZhCN = "[系统]应用商城导入数据包", En = "[System] Import App Store Package", ZhTW = "[系統]應用商城匯入資料包" },
            new DiyLangSeed { Key = "Data.SysApiExportMicroiStorePackage", ZhCN = "[系统]应用商城导出数据包", En = "[System] Export App Store Package", ZhTW = "[系統]應用商城匯出資料包" }
        };

        protected static string LangKeyDiyTable(string tableName)
        {
            return $"diy_table:{(tableName ?? "").DosToLower()}:Description";
        }

        protected static string LangKeyDiyField(string tableName, string fieldName)
        {
            return $"diy_field:{(tableName ?? "").DosToLower()}:{(fieldName ?? "").DosToLower()}:Label";
        }

        protected static string LangKeyDiyTableTab(string tableName, string tabFieldName, string tabKey)
        {
            return $"diy_table:{(tableName ?? "").DosToLower()}:{(tabFieldName ?? "").DosToLower()}:{(tabKey ?? "").DosToLower()}:Name";
        }

        protected static string LangKeyDiyFieldTab(string tableName, string fieldName, string tabKey)
        {
            return $"diy_field:{(tableName ?? "").DosToLower()}:{(fieldName ?? "").DosToLower()}:FieldTabs:{(tabKey ?? "").DosToLower()}:Name";
        }

        protected static string LangKeySysMenu(string menuId)
        {
            return $"sys_menu:{menuId}:Name";
        }

        protected static string LangKeySysMenuButton(string menuId, string buttonField, string buttonKey)
        {
            return $"sys_menu:{menuId}:{buttonField}:{(buttonKey ?? "").DosToLower()}:Name";
        }

        // Metadata translations must come from diy_lang and its in-memory cache.
        // Keep this dictionary empty; it only exists so older seed code paths can remain compatible.
        private static readonly Dictionary<string, DiyLangSeed> FixedMetadataTranslations =
            new Dictionary<string, DiyLangSeed>(StringComparer.OrdinalIgnoreCase);

        private static void IncJObjectInt(JObject obj, string key)
        {
            obj[key] = obj[key] == null ? 1 : obj[key].ToObject<int>() + 1;
        }

        private static string TokenString(JToken token)
        {
            return token == null || token.Type == JTokenType.Null ? "" : token.ToString();
        }

        private static string TokenString(JObject obj, string key)
        {
            return obj == null ? "" : TokenString(obj[key]);
        }

        private static bool IsBlank(string value)
        {
            return string.IsNullOrWhiteSpace(value);
        }

        protected static string ResolveReturnLang(BaseParam param)
        {
            return param?._RawMetadata == true ? DiyMessage.Lang : (param?._Lang ?? DiyMessage.Lang);
        }

        protected static JObject TranslateDiyTableForReturn(JObject source, string osClient, string lang)
        {
            if (source == null)
            {
                return null;
            }
            var row = CloneJObject(source);
            var tableName = TokenString(row, "Name");
            var description = TokenString(row, "Description");
            if (!IsBlank(description))
            {
                row["_RawDescription"] = description;
                row["Description"] = GetMetadataLang(osClient, LangKeyDiyTable(tableName), description, lang);
            }
            TranslateDiyTableTabsForReturn(row, osClient, lang, tableName, "Tabs");
            TranslateDiyTableTabsForReturn(row, osClient, lang, tableName, "TableTabs");
            return row;
        }

        protected static JObject TranslateDiyFieldForReturn(JObject source, string osClient, string lang)
        {
            if (source == null)
            {
                return null;
            }
            var row = CloneJObject(source);
            var tableName = TokenString(row, "TableName");
            var fieldName = TokenString(row, "Name");
            var label = TokenString(row, "Label");
            if (!IsBlank(label))
            {
                row["_RawLabel"] = label;
                row["Label"] = GetMetadataLang(osClient, LangKeyDiyField(tableName, fieldName), label, lang);
            }

            var tableDescription = TokenString(row, "TableDescription");
            if (!IsBlank(tableDescription))
            {
                row["_RawTableDescription"] = tableDescription;
                row["TableDescription"] = GetMetadataLang(osClient, LangKeyDiyTable(tableName), tableDescription, lang);
            }
            TranslateDiyFieldConfigTabsForReturn(row, osClient, lang, tableName, fieldName);
            return row;
        }

        protected static JObject TranslateSysMenuForReturn(JObject source, string osClient, string lang)
        {
            if (source == null)
            {
                return null;
            }
            var row = CloneJObject(source);
            var name = TokenString(row, "Name");
            if (!IsBlank(name))
            {
                row["_RawName"] = name;
                row["Name"] = GetMetadataLang(osClient, LangKeySysMenu(TokenString(row, "Id")), name, lang);
            }
            TranslateSysMenuButtonFields(row, osClient, lang);
            TranslateChildMenus(row, osClient, lang);
            return row;
        }

        protected static List<JObject> TranslateDiyFieldListForReturn(IEnumerable<JObject> source, string osClient, string lang)
        {
            return source?.Select(item => TranslateDiyFieldForReturn(item, osClient, lang)).ToList();
        }

        protected static List<dynamic> TranslateDiyTableListForReturn(IEnumerable<dynamic> source, string osClient, string lang)
        {
            if (source == null)
            {
                return null;
            }
            return source.Select(item => (dynamic)TranslateDiyTableForReturn(ToJObjectSafe(item), osClient, lang)).ToList();
        }

        protected static List<T> TranslateDisplayRowListForReturn<T>(IEnumerable<T> source, string tableName, string osClient, string lang, IEnumerable<string> translateFields)
        {
            if (source == null)
            {
                return null;
            }
            var list = source.ToList();
            if (DiyMessage.IsDefaultLang(lang) || translateFields == null)
            {
                return list;
            }
            var fields = translateFields
                .Where(field => !IsBlank(field))
                .Select(field => field.Trim())
                .Where(field => !DiyLangSystemFields.Contains(field))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (fields.Count == 0)
            {
                return list;
            }
            tableName = (tableName ?? "").DosToLower();
            return list.Select(item =>
            {
                var row = ToJObjectSafe(item);
                foreach (var field in fields)
                {
                    var sourceText = TokenString(row, field);
                    if (IsBlank(sourceText) || sourceText.Length > 500)
                    {
                        continue;
                    }
                    var translated = GetMetadataLang(osClient, $"data:{tableName}:{field}:{sourceText}", sourceText, lang);
                    if (!IsBlank(translated) && translated != sourceText)
                    {
                        row["_Raw" + field] = sourceText;
                        row[field] = translated;
                    }
                }
                return ConvertJObjectTo<T>(row);
            }).ToList();
        }

        public DosResult QueueDiyLangFullSync(string osClient = "", bool includeClientText = true)
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }
            if (!DiyLangFullSyncRunning.TryAdd(osClient, 1))
            {
                return new DosResult(1, null, $"DiyLang sync is already running for {osClient}.");
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await SyncDiyLangFullAsync(osClient, includeClientText);
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang full sync failed", ex, osClient);
                }
                finally
                {
                    DiyLangFullSyncRunning.TryRemove(osClient, out _);
                }
            });
            return new DosResult(1, null, $"DiyLang sync queued for {osClient}.");
        }

        public DosResult QueueDiyLangFullSyncForAllClients(bool includeClientText = true)
        {
            var osClients = OsClientExtend.ClientList.Keys.ToList();
            if (osClients.Count == 0)
            {
                var defaultOsClient = ResolveLangSyncOsClient("");
                if (!IsBlank(defaultOsClient))
                {
                    osClients.Add(defaultOsClient);
                }
            }
            foreach (var osClient in osClients.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                QueueDiyLangFullSync(osClient, includeClientText);
            }
            return new DosResult(1, osClients, $"DiyLang sync queued for {osClients.Count} tenant(s).");
        }

        public async Task<DosResult> SyncDiyLangFullAsync(string osClient = "", bool includeClientText = true)
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }

            var stats = new JObject()
            {
                ["OsClient"] = osClient,
                ["Tables"] = 0,
                ["Fields"] = 0,
                ["Menus"] = 0,
                ["ClientTexts"] = 0,
                ["Errors"] = 0
            };

            try
            {
                var tableResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _InvokeType = "Server",
                    _Lang = "cn",
                    _PageIndex = 1,
                    _PageSize = 100000,
                    _SelectFields = new[] { "Id", "Name", "Description", "Tabs", "TableTabs" }
                });
                var tableById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (tableResult.Code == 1 && tableResult.Data != null)
                {
                    foreach (var item in tableResult.Data)
                    {
                        var row = ToJObjectSafe(item);
                        var tableId = TokenString(row, "Id");
                        var tableName = TokenString(row, "Name");
                        var description = TokenString(row, "Description");
                        if (!IsBlank(tableId) && !IsBlank(tableName))
                        {
                            tableById[tableId] = tableName;
                        }
                        if (IsBlank(tableName))
                        {
                            continue;
                        }
                        if (!IsBlank(description))
                        {
                            await EnsureDiyLangMetadataAsync(osClient, LangKeyDiyTable(tableName), description);
                        }
                        await SyncDiyTableTabLangRows(osClient, tableName, row, "Tabs");
                        await SyncDiyTableTabLangRows(osClient, tableName, row, "TableTabs");
                        IncJObjectInt(stats, "Tables");
                    }
                }

                var fieldResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _InvokeType = "Server",
                    _Lang = "cn",
                    _PageIndex = 1,
                    _PageSize = 200000,
                    _SelectFields = new[] { "Id", "Name", "Label", "TableName", "TableId", "Config" }
                });
                if (fieldResult.Code == 1 && fieldResult.Data != null)
                {
                    foreach (var item in fieldResult.Data)
                    {
                        var row = ToJObjectSafe(item);
                        string tableName = TokenString(row, "TableName");
                        if (IsBlank(tableName))
                        {
                            tableById.TryGetValue(TokenString(row, "TableId"), out tableName);
                        }
                        var fieldName = TokenString(row, "Name");
                        var label = TokenString(row, "Label");
                        if (IsBlank(tableName) || IsBlank(fieldName))
                        {
                            continue;
                        }
                        if (!IsBlank(label))
                        {
                            await EnsureDiyLangMetadataAsync(osClient, LangKeyDiyField(tableName, fieldName), label);
                        }
                        await SyncDiyFieldTabLangRows(osClient, tableName, fieldName, row);
                        IncJObjectInt(stats, "Fields");
                    }
                }

                var menuResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _InvokeType = "Server",
                    _Lang = "cn",
                    _PageIndex = 1,
                    _PageSize = 100000,
                    _SelectFields = new[] { "Id", "Name", "MoreBtns", "FormBtns", "BatchSelectMoreBtns", "PageTabs", "ExportMoreBtns", "PageBtns" }
                });
                if (menuResult.Code == 1 && menuResult.Data != null)
                {
                    foreach (var item in menuResult.Data)
                    {
                        var row = ToJObjectSafe(item);
                        var menuId = TokenString(row, "Id");
                        var name = TokenString(row, "Name");
                        if (IsBlank(menuId) || IsBlank(name))
                        {
                            continue;
                        }
                        await EnsureDiyLangMetadataAsync(osClient, LangKeySysMenu(menuId), name);
                        await SyncSysMenuButtonLangRows(osClient, row);
                        IncJObjectInt(stats, "Menus");
                    }
                }

                if (includeClientText)
                {
                    foreach (var seed in ClientLangSeeds)
                    {
                        await EnsureDiyLangMetadataAsync(osClient, seed.Key, seed.ZhCN, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                        {
                            ["En"] = seed.En,
                            ["ZhTW"] = seed.ZhTW
                        }, false);
                        IncJObjectInt(stats, "ClientTexts");
                    }
                }

                return new DosResult(1, stats, "DiyLang sync completed.", 0, stats);
            }
            catch (Exception ex)
            {
                IncJObjectInt(stats, "Errors");
                LogDiyLangSyncException(osClient, "DiyLang full sync failed", ex, osClient);
                return new DosResult(0, stats, ex.Message, 0, stats);
            }
        }

        protected static T TranslateMetadataSingleForReturn<T>(T source, string tableName, string osClient, string lang)
        {
            if (source == null || !IsMetadataTable(tableName))
            {
                return source;
            }
            var translated = TranslateMetadataRow(ToJObjectSafe(source), tableName, osClient, lang);
            return ConvertJObjectTo<T>(translated);
        }

        protected static List<T> TranslateMetadataListForReturn<T>(IEnumerable<T> source, string tableName, string osClient, string lang)
        {
            if (source == null || !IsMetadataTable(tableName))
            {
                return source?.ToList();
            }
            return source.Select(item => ConvertJObjectTo<T>(TranslateMetadataRow(ToJObjectSafe(item), tableName, osClient, lang))).ToList();
        }

        protected void QueueDiyTableLangSync(string osClient, string tableName, string description)
        {
            QueueDiyLangMetadataSync(osClient, LangKeyDiyTable(tableName), description);
        }

        protected void QueueDiyTableTabsLangSync(string osClient, string tableName, JObject row)
        {
            if (IsBlank(osClient) || IsBlank(tableName) || row == null)
            {
                return;
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await SyncDiyTableTabLangRows(osClient, tableName, row, "Tabs");
                    await SyncDiyTableTabLangRows(osClient, tableName, row, "TableTabs");
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang diy_table tabs sync failed", ex, tableName);
                }
            });
        }

        protected void QueueDiyFieldLangSync(string osClient, string tableName, string fieldName, string label)
        {
            QueueDiyLangMetadataSync(osClient, LangKeyDiyField(tableName, fieldName), label);
        }

        protected void QueueDiyFieldTabsLangSync(string osClient, string tableName, string fieldName, JObject row)
        {
            if (IsBlank(osClient) || IsBlank(tableName) || IsBlank(fieldName) || row == null)
            {
                return;
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await SyncDiyFieldTabLangRows(osClient, tableName, fieldName, row);
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang diy_field tabs sync failed", ex, fieldName);
                }
            });
        }

        protected void QueueSysMenuLangSync(string osClient, string menuId, string name)
        {
            QueueDiyLangMetadataSync(osClient, LangKeySysMenu(menuId), name);
        }

        protected void QueueSysMenuButtonLangSync(string osClient, JObject row)
        {
            if (IsBlank(osClient) || row == null)
            {
                return;
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await SyncSysMenuButtonLangRows(osClient, row);
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang sys_menu button sync failed", ex, TokenString(row, "Id"));
                }
            });
        }

        protected void QueueSysOsClientReload(string osClient, JObject row)
        {
            var targetOsClient = TokenString(row, "OsClient");
            if (IsBlank(targetOsClient))
            {
                return;
            }

            var shouldRemove = IsFalseValue(TokenString(row, "IsEnable")) || IsTrueValue(TokenString(row, "IsDeleted"));
            _ = Task.Run(() =>
            {
                try
                {
                    ClearSaasConfigCache(targetOsClient);

                    if (shouldRemove)
                    {
                        OsClientExtend.ClientList.TryRemove(targetOsClient, out _);
                        Console.WriteLine($"Microi: OsClient[{targetOsClient}] removed from runtime ClientList.");
                        return;
                    }

                    var reloadResult = ReloadRuntimeOsClient(targetOsClient);
                    if (reloadResult.Code != 1)
                    {
                        Console.WriteLine($"Microi: OsClient[{targetOsClient}] runtime reload failed. {reloadResult.Msg}");
                    }
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "SaaS engine runtime reload failed", ex, targetOsClient);
                }
            });
        }

        protected static void UpsertLangCache(string osClient, JObject row)
        {
            if (IsBlank(osClient) || row == null)
            {
                return;
            }
            var key = TokenString(row, "Key");
            if (IsBlank(key))
            {
                return;
            }
            lock (DiyLangCacheLock)
            {
                if (!DiyMessage.Msg.ContainsKey(osClient))
                {
                    DiyMessage.Msg[osClient] = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                }
                DiyMessage.Msg[osClient][key] = row;
                DiyMessage.ClearSourceTextCache(osClient);
            }
        }

        protected void AfterMetadataFormDataSaved(DiyTableRowParam param, DosResult result, DbTrans trans)
        {
            if (param == null || result == null || result.Code != 1 || trans != null)
            {
                return;
            }
            var tableName = (param.FormEngineKey ?? param.TableName ?? param._TableName ?? "").DosToLower();
            if (!IsMetadataTable(tableName) && tableName != "diy_lang" && tableName != "sys_osclients")
            {
                return;
            }

            var row = GetSavedRow(param, result);
            if (tableName == "sys_osclients")
            {
                QueueSysOsClientReload(param.OsClient, row);
            }
            else if (tableName == "sys_menu")
            {
                QueueSysMenuLangSync(param.OsClient, TokenString(row, "Id"), TokenString(row, "Name"));
                QueueSysMenuButtonLangSync(param.OsClient, row);
            }
            else if (tableName == "diy_table")
            {
                QueueDiyTableLangSync(param.OsClient, TokenString(row, "Name"), TokenString(row, "Description"));
                QueueDiyTableTabsLangSync(param.OsClient, TokenString(row, "Name"), row);
            }
            else if (tableName == "diy_field")
            {
                QueueDiyFieldLangSync(param.OsClient, TokenString(row, "TableName"), TokenString(row, "Name"), TokenString(row, "Label"));
                QueueDiyFieldTabsLangSync(param.OsClient, TokenString(row, "TableName"), TokenString(row, "Name"), row);
            }
            else if (tableName == "diy_lang")
            {
                UpsertLangCache(param.OsClient, row);
            }
        }

        private static bool IsMetadataTable(string tableName)
        {
            tableName = (tableName ?? "").DosToLower();
            return tableName == "diy_table" || tableName == "diy_field" || tableName == "sys_menu";
        }

        private static bool IsFalseValue(string value)
        {
            value = (value ?? "").Trim();
            return value == "0" || value.Equals("false", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsTrueValue(string value)
        {
            value = (value ?? "").Trim();
            return value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase);
        }

        private static void ClearSaasConfigCache(string osClient)
        {
            if (IsBlank(osClient))
            {
                return;
            }

            try
            {
                var configOsClient = OsClientExtend.GetConfigOsClient();
                MicroiEngine.CacheTenant.Default().Remove($"Microi:{configOsClient}:saas-engine:{osClient}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Clear SaaS config cache failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        private static DosResult ReloadRuntimeOsClient(string osClient)
        {
            try
            {
                var osClientType = Type.GetType("Microi.net.OsClient, Microi.net")
                    ?? AppDomain.CurrentDomain.GetAssemblies()
                        .Select(asm => asm.GetType("Microi.net.OsClient"))
                        .FirstOrDefault(type => type != null);
                if (osClientType == null)
                {
                    return new DosResult(0, null, "Microi.net.OsClient runtime type was not found.");
                }

                var method = osClientType.GetMethods()
                    .FirstOrDefault(item => item.Name == "ReloadSingleOsClient" && item.GetParameters().Length >= 1);
                if (method == null)
                {
                    return new DosResult(0, null, "ReloadSingleOsClient method was not found.");
                }

                var instance = Activator.CreateInstance(osClientType);
                var parameters = method.GetParameters().Length == 1
                    ? new object[] { osClient }
                    : new object[] { osClient, null };
                return method.Invoke(instance, parameters) as DosResult
                       ?? new DosResult(0, null, "ReloadSingleOsClient returned an invalid result.");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        private static JObject GetSavedRow(DiyTableRowParam param, DosResult result)
        {
            if (result.Data != null)
            {
                try
                {
                    return ToJObjectSafe(result.Data);
                }
                catch
                {
                }
            }
            if (param._RowModel != null)
            {
                return CloneJObject(param._RowModel);
            }
            return JObject.FromObject(param);
        }

        private static JObject TranslateMetadataRow(JObject row, string tableName, string osClient, string lang)
        {
            tableName = (tableName ?? "").DosToLower();
            if (tableName == "diy_table")
            {
                return TranslateDiyTableForReturn(row, osClient, lang);
            }
            if (tableName == "diy_field")
            {
                return TranslateDiyFieldForReturn(row, osClient, lang);
            }
            if (tableName == "sys_menu")
            {
                return TranslateSysMenuForReturn(row, osClient, lang);
            }
            return row;
        }

        private static string GetMetadataLang(string osClient, string stableKey, string sourceText, string lang)
        {
            if (IsBlank(sourceText) || DiyMessage.IsDefaultLang(lang))
            {
                return sourceText;
            }
            if (DiyMessage.TryGetLang(osClient, stableKey, lang, out var value) && IsUsableMetadataTranslation(value, sourceText))
            {
                return value;
            }
            if (!IsBlank(stableKey) && DiyMessage.TryGetLang(osClient, stableKey.DosToLower(), lang, out value) && IsUsableMetadataTranslation(value, sourceText))
            {
                return value;
            }
            if (DiyMessage.TryGetLang(osClient, sourceText, lang, out value) && IsUsableMetadataTranslation(value, sourceText))
            {
                return value;
            }
            if (DiyMessage.TryGetLangBySourceText(osClient, sourceText, lang, out value) && IsUsableMetadataTranslation(value, sourceText))
            {
                return value;
            }
            QueueDiyLangMetadataSyncStatic(osClient, stableKey, sourceText);
            return sourceText;
        }

        private static bool IsUsableMetadataTranslation(string value, string sourceText)
        {
            if (IsBlank(value))
            {
                return false;
            }
            if (IsBlank(sourceText))
            {
                return true;
            }
            var normalizedValue = value.Trim().Replace(" ", "");
            var normalizedSource = sourceText.Trim().Replace(" ", "");
            return !string.Equals(normalizedValue, normalizedSource, StringComparison.OrdinalIgnoreCase);
        }

        private static void QueueDiyLangMetadataSyncStatic(string osClient, string key, string sourceText)
        {
            if (IsBlank(osClient) || IsBlank(key) || IsBlank(sourceText))
            {
                return;
            }
            var queueKey = $"{osClient}|{key}|{sourceText}";
            if (!DiyLangMetadataSyncQueued.TryAdd(queueKey, 1))
            {
                return;
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await EnsureDiyLangMetadataAsync(osClient, key, sourceText);
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang metadata sync failed", ex, key);
                }
                finally
                {
                    DiyLangMetadataSyncQueued.TryRemove(queueKey, out _);
                }
            });
        }

        private void QueueDiyLangMetadataSync(string osClient, string key, string sourceText)
        {
            QueueDiyLangMetadataSyncStatic(osClient, key, sourceText);
        }

        private static async Task<DosResult> EnsureDiyLangMetadataAsync(string osClient, string key, string sourceText, IDictionary<string, string> fixedTranslations = null, bool autoTranslate = true)
        {
            var queryResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_lang", new
            {
                _Where = new List<DiyWhere>() { new DiyWhere() { Name = "Key", Type = "=", Value = key } },
                OsClient = osClient,
                _InvokeType = "Server",
                _Lang = "cn"
            });

            JObject row = queryResult.Code == 1 && queryResult.Data != null
                ? ToJObjectSafe(queryResult.Data)
                : new JObject();
            var isNew = IsBlank(TokenString(row, "Id"));
            var changed = isNew;
            row["Key"] = key;
            row["OsClient"] = osClient;
            row["FormEngineKey"] = "diy_lang";
            row["_InvokeType"] = "Server";
            row["_Lang"] = "cn";
            if (IsBlank(TokenString(row, "Code")))
            {
                row["Code"] = key;
                changed = true;
            }
            if (IsBlank(TokenString(row, "ZhCN")))
            {
                row["ZhCN"] = sourceText;
                changed = true;
            }

            foreach (var langField in GetDiyLangFields(osClient))
            {
                if (langField.Equals("ZhCN", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (!IsBlank(TokenString(row[langField])))
                {
                    continue;
                }
                var translated = "";
                if (fixedTranslations != null && fixedTranslations.TryGetValue(langField, out var fixedValue))
                {
                    translated = fixedValue;
                }
                if (IsBlank(translated))
                {
                    translated = GetFixedTranslation(sourceText, langField);
                }
                if (IsBlank(translated) && autoTranslate)
                {
                    translated = TranslateForDiyLangField(sourceText, langField, osClient);
                }
                if (!IsBlank(translated) && translated != sourceText)
                {
                    row[langField] = translated;
                    changed = true;
                }
            }

            if (!changed)
            {
                UpsertLangCache(osClient, row);
                return new DosResult(1, row, "No change.", 0, new { IsNew = isNew, Changed = false });
            }

            DosResult saveResult;
            if (isNew)
            {
                saveResult = await MicroiEngine.FormEngine.AddFormDataAsync("diy_lang", row);
            }
            else
            {
                saveResult = await MicroiEngine.FormEngine.UptFormDataAsync("diy_lang", row);
            }

            if (saveResult.Code == 1)
            {
                UpsertLangCache(osClient, row);
            }
            saveResult.DataAppend = new { IsNew = isNew, Changed = true };
            return saveResult;
        }

        private static IEnumerable<string> GetDiyLangFields(string osClient)
        {
            var fields = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "ZhCN", "En", "ZhTW", "My" };
            try
            {
                if (!IsBlank(osClient)
                    && DiyMessage.Msg.TryGetValue(osClient, out var clientMsg)
                    && clientMsg != null)
                {
                    foreach (var row in clientMsg.Values.Take(20))
                    {
                        foreach (var prop in row.Properties())
                        {
                            if (!DiyLangSystemFields.Contains(prop.Name))
                            {
                                fields.Add(prop.Name);
                            }
                        }
                    }
                }
            }
            catch
            {
            }
            return fields;
        }

        private static string GetFixedTranslation(string sourceText, string langField)
        {
            if (IsBlank(sourceText))
            {
                return "";
            }
            var sourceKey = sourceText.Replace(" ", "");
            if (FixedMetadataTranslations.TryGetValue(sourceKey, out var fixedSeed))
            {
                var fixedField = DiyMessage.NormalizeLangField(langField);
                if (fixedField == "En")
                {
                    return fixedSeed.En;
                }
                if (fixedField == "ZhTW")
                {
                    return fixedSeed.ZhTW;
                }
            }
            var seed = ClientLangSeeds.FirstOrDefault(d => string.Equals((d.ZhCN ?? "").Replace(" ", ""), sourceKey, StringComparison.OrdinalIgnoreCase));
            if (seed == null)
            {
                return "";
            }
            var field = DiyMessage.NormalizeLangField(langField);
            if (field == "En")
            {
                return seed.En;
            }
            if (field == "ZhTW")
            {
                return seed.ZhTW;
            }
            return "";
        }

        private static string TranslateForDiyLangField(string sourceText, string langField, string osClient)
        {
            var targetLang = DiyMessage.NormalizeTranslateLang(langField);
            if (targetLang == "zh" || targetLang == "cn" || targetLang == "zh-cn")
            {
                return sourceText;
            }
            var providerKey = GetTranslateProviderKey(osClient);
            if (IsBlank(providerKey))
            {
                return "";
            }
            var unsupportedTargetKey = $"{providerKey}|{targetLang}";
            if (DiyLangTranslateUnsupportedTarget.TryGetValue(unsupportedTargetKey, out var unsupportedAt))
            {
                if ((DateTime.UtcNow - unsupportedAt).TotalHours < 12)
                {
                    return "";
                }
                DiyLangTranslateUnsupportedTarget.TryRemove(unsupportedTargetKey, out _);
            }
            var unavailableCacheKey = $"{osClient}|{providerKey}";
            if (DiyLangTranslateUnavailable.TryGetValue(unavailableCacheKey, out var unavailableAt))
            {
                if ((DateTime.UtcNow - unavailableAt).TotalMinutes < 10)
                {
                    return "";
                }
                DiyLangTranslateUnavailable.TryRemove(unavailableCacheKey, out _);
            }
            try
            {
                var result = MicroiEngine.Translate.Translate(new TranslateParam()
                {
                    SourceText = sourceText,
                    Lang = targetLang,
                    FromLang = "zh",
                    OsClient = osClient
                });
                if (result.Code == 1)
                {
                    return result.Data?.ToString();
                }
                if (result.Code == 2 && IsUnsupportedTranslateTarget(result.Msg))
                {
                    DiyLangTranslateUnsupportedTarget[unsupportedTargetKey] = DateTime.UtcNow;
                    return "";
                }
                MarkTranslateUnavailable(osClient, providerKey, result.Msg);
                return "";
            }
            catch (Exception ex)
            {
                MarkTranslateUnavailable(osClient, providerKey, ex.Message);
                return "";
            }
        }

        private static bool IsUnsupportedTranslateTarget(string message)
        {
            if (IsBlank(message))
            {
                return false;
            }
            return message.IndexOf("unsupported", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("bad request", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string ResolveLangSyncOsClient(string osClient)
        {
            if (IsBlank(osClient))
            {
                osClient = DiyToken.GetCurrentOsClient(false);
            }
            if (IsBlank(osClient))
            {
                osClient = OsClientExtend.GetConfigOsClient();
            }
            if (IsBlank(osClient))
            {
                osClient = OsClientDefault.OsClient;
            }
            return osClient?.DosTrim();
        }

        private static string GetTranslateProviderKey(string osClient)
        {
            var keys = new List<string>();
            var currentKey = GetTranslateProviderKeyFromClient(osClient);
            if (!IsBlank(currentKey))
            {
                keys.Add(currentKey);
            }

            var configOsClient = OsClientExtend.GetConfigOsClient();
            if (!IsBlank(configOsClient) && !string.Equals(configOsClient, osClient, StringComparison.OrdinalIgnoreCase))
            {
                var configKey = GetTranslateProviderKeyFromClient(configOsClient);
                if (!IsBlank(configKey))
                {
                    keys.Add(configKey);
                }
            }

            var envUrl = Environment.GetEnvironmentVariable("MICROI_TRANSLATE_URL");
            if (!IsBlank(envUrl))
            {
                var envProvider = Environment.GetEnvironmentVariable("MICROI_TRANSLATE_PROVIDER");
                if (IsBlank(envProvider))
                {
                    envProvider = "libretranslate";
                }
                keys.Add($"{envProvider.Trim().ToLower()}:{envUrl}");
            }

            return string.Join("|", keys.Distinct(StringComparer.OrdinalIgnoreCase));
        }

        private static string GetTranslateProviderKeyFromClient(string osClient)
        {
            try
            {
                if (IsBlank(osClient))
                {
                    return "";
                }
                var clientModel = OsClientExtend.GetClient(osClient);
                return GetTranslateProviderKeyFromConfig(clientModel?.OsClientModel);
            }
            catch
            {
                return "";
            }
        }

        private static string GetTranslateProviderKeyFromConfig(JObject config)
        {
            if (config == null)
            {
                return "";
            }
            var endpoint = TokenString(config["TranslateEndpoint"]);
            var key = TokenString(config["TranslateKey"]);
            var secret = TokenString(config["TranslateSecret"]);
            var provider = TokenString(config["TranslateProvider"]);
            var url = TokenString(config["TranslateUrl"]);
            if (IsBlank(url))
            {
                url = TokenString(config["TranslateApiUrl"]);
            }
            if (IsBlank(url))
            {
                url = TokenString(config["LibreTranslateUrl"]);
            }
            if (IsBlank(provider))
            {
                provider = !IsBlank(url)
                    ? "LibreTranslate"
                    : (!IsBlank(endpoint) && !IsBlank(key) && !IsBlank(secret) ? "Aliyun" : "None");
            }
            provider = provider.Trim().ToLower();
            if (provider == "none" || provider == "manual" || provider == "off" || provider == "disabled")
            {
                return "";
            }
            if (provider == "libretranslate" || provider == "http")
            {
                return IsBlank(url) ? "" : $"{provider}:{url}";
            }
            return IsBlank(endpoint) || IsBlank(key) || IsBlank(secret)
                ? ""
                : $"{provider}:{endpoint}:{key}";
        }

        private static void MarkTranslateUnavailable(string osClient, string providerKey, string message)
        {
            if (IsBlank(osClient) || IsBlank(providerKey))
            {
                return;
            }
            var unavailableCacheKey = $"{osClient}|{providerKey}";
            var isFirstMark = !DiyLangTranslateUnavailable.ContainsKey(unavailableCacheKey);
            DiyLangTranslateUnavailable[unavailableCacheKey] = DateTime.UtcNow;
            if (isFirstMark)
            {
                Console.WriteLine($"Microi：【多语言】租户[{osClient}]自动翻译不可用，10分钟内改为仅同步词条，原因：{message}");
            }
        }

        private static string GetNamedItemKey(JObject item, int index)
        {
            var key = TokenString(item, "Id");
            if (IsBlank(key))
            {
                key = TokenString(item, "Key");
            }
            if (IsBlank(key))
            {
                key = TokenString(item, "Name");
            }
            if (IsBlank(key))
            {
                key = TokenString(item, "Label");
            }
            return IsBlank(key) ? $"index-{index}" : key;
        }

        private static JArray ParseJArrayFlexible(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return null;
            }
            if (token is JArray arr)
            {
                return (JArray)arr.DeepClone();
            }
            var text = TokenString(token);
            if (IsBlank(text) || text == "[]")
            {
                return null;
            }
            try
            {
                return JArray.Parse(text);
            }
            catch
            {
                return null;
            }
        }

        private static JObject ParseJObjectFlexible(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return null;
            }
            if (token is JObject obj)
            {
                return CloneJObject(obj);
            }
            var text = TokenString(token);
            if (IsBlank(text) || text == "{}")
            {
                return null;
            }
            try
            {
                return JObject.Parse(text);
            }
            catch
            {
                return null;
            }
        }

        private static void TranslateNamedItems(JArray items, string osClient, string lang, Func<JObject, int, string> keyBuilder)
        {
            if (items == null)
            {
                return;
            }
            for (var i = 0; i < items.Count; i++)
            {
                if (!(items[i] is JObject item))
                {
                    continue;
                }
                var itemKey = keyBuilder(item, i);
                foreach (var nameField in new[] { "Name", "Label", "Title" })
                {
                    var sourceText = TokenString(item, nameField);
                    if (IsBlank(sourceText))
                    {
                        continue;
                    }
                    item[$"_Raw{nameField}"] = sourceText;
                    item[nameField] = GetMetadataLang(osClient, itemKey, sourceText, lang);
                }
            }
        }

        private static void TranslateDiyTableTabsForReturn(JObject row, string osClient, string lang, string tableName, string fieldName)
        {
            var originalToken = row?[fieldName];
            var tabs = ParseJArrayFlexible(originalToken);
            if (tabs == null)
            {
                return;
            }
            TranslateNamedItems(tabs, osClient, lang, (item, index) =>
                LangKeyDiyTableTab(tableName, fieldName, GetNamedItemKey(item, index)));
            if (originalToken is JArray)
            {
                row[fieldName] = tabs;
            }
            else
            {
                row[fieldName] = tabs.ToString(Newtonsoft.Json.Formatting.None);
            }
        }

        private static void TranslateDiyFieldConfigTabsForReturn(JObject row, string osClient, string lang, string tableName, string fieldName)
        {
            var originalToken = row?["Config"];
            var config = ParseJObjectFlexible(originalToken);
            if (config == null)
            {
                return;
            }
            var fieldTabs = config["FieldTabs"] as JObject;
            if (fieldTabs == null)
            {
                fieldTabs = ParseJObjectFlexible(config["FieldTabs"]);
                if (fieldTabs != null)
                {
                    config["FieldTabs"] = fieldTabs;
                }
            }
            var tabs = ParseJArrayFlexible(fieldTabs?["Tabs"]);
            if (tabs == null)
            {
                return;
            }
            TranslateNamedItems(tabs, osClient, lang, (item, index) =>
                LangKeyDiyFieldTab(tableName, fieldName, GetNamedItemKey(item, index)));
            fieldTabs["Tabs"] = tabs;
            if (originalToken is JObject)
            {
                row["Config"] = config;
            }
            else
            {
                row["Config"] = config.ToString(Newtonsoft.Json.Formatting.None);
            }
        }

        private async Task SyncDiyTableTabLangRows(string osClient, string tableName, JObject row, string fieldName)
        {
            var tabs = ParseJArrayFlexible(row?[fieldName]);
            if (tabs == null || IsBlank(osClient) || IsBlank(tableName))
            {
                return;
            }
            for (var i = 0; i < tabs.Count; i++)
            {
                if (!(tabs[i] is JObject tab))
                {
                    continue;
                }
                var text = TokenString(tab, "Name");
                if (IsBlank(text))
                {
                    text = TokenString(tab, "Label");
                }
                if (IsBlank(text))
                {
                    text = TokenString(tab, "Title");
                }
                if (IsBlank(text))
                {
                    continue;
                }
                await EnsureDiyLangMetadataAsync(osClient,
                    LangKeyDiyTableTab(tableName, fieldName, GetNamedItemKey(tab, i)), text);
            }
        }

        private async Task SyncDiyFieldTabLangRows(string osClient, string tableName, string fieldName, JObject row)
        {
            if (IsBlank(osClient) || IsBlank(tableName) || IsBlank(fieldName))
            {
                return;
            }
            var config = ParseJObjectFlexible(row?["Config"]);
            var fieldTabs = config?["FieldTabs"] as JObject;
            if (fieldTabs == null && config != null)
            {
                fieldTabs = ParseJObjectFlexible(config["FieldTabs"]);
            }
            var tabs = ParseJArrayFlexible(fieldTabs?["Tabs"]);
            if (tabs == null)
            {
                return;
            }
            for (var i = 0; i < tabs.Count; i++)
            {
                if (!(tabs[i] is JObject tab))
                {
                    continue;
                }
                var text = TokenString(tab, "Name");
                if (IsBlank(text))
                {
                    text = TokenString(tab, "Label");
                }
                if (IsBlank(text))
                {
                    text = TokenString(tab, "Title");
                }
                if (IsBlank(text))
                {
                    continue;
                }
                await EnsureDiyLangMetadataAsync(osClient,
                    LangKeyDiyFieldTab(tableName, fieldName, GetNamedItemKey(tab, i)), text);
            }
        }

        private async Task SyncSysMenuButtonLangRows(string osClient, JObject row)
        {
            var menuId = TokenString(row?["Id"]);
            if (IsBlank(osClient) || IsBlank(menuId))
            {
                return;
            }
            foreach (var fieldName in SysMenuButtonFields)
            {
                var buttons = ParseButtonArray(row[fieldName]);
                if (buttons == null)
                {
                    continue;
                }
                foreach (var token in buttons)
                {
                    if (!(token is JObject button))
                    {
                        continue;
                    }
                    var name = TokenString(button, "Name");
                    if (IsBlank(name))
                    {
                        continue;
                    }
                    var buttonKey = TokenString(button, "Id");
                    if (IsBlank(buttonKey))
                    {
                        buttonKey = name;
                    }
                    await EnsureDiyLangMetadataAsync(osClient, LangKeySysMenuButton(menuId, fieldName, buttonKey), name);
                }
            }
        }

        private static void TranslateSysMenuButtonFields(JObject row, string osClient, string lang)
        {
            var menuId = TokenString(row?["Id"]);
            if (row == null || IsBlank(menuId))
            {
                return;
            }
            foreach (var fieldName in SysMenuButtonFields)
            {
                var originalToken = row[fieldName];
                var buttons = ParseButtonArray(originalToken);
                if (buttons == null)
                {
                    continue;
                }
                foreach (var token in buttons)
                {
                    if (!(token is JObject button))
                    {
                        continue;
                    }
                    var name = TokenString(button, "Name");
                    if (IsBlank(name))
                    {
                        continue;
                    }
                    var buttonKey = TokenString(button, "Id");
                    if (IsBlank(buttonKey))
                    {
                        buttonKey = name;
                    }
                    button["_RawName"] = name;
                    button["Name"] = GetMetadataLang(osClient, LangKeySysMenuButton(menuId, fieldName, buttonKey), name, lang);
                }
                if (originalToken is JArray)
                {
                    row[fieldName] = buttons;
                }
                else
                {
                    row[fieldName] = buttons.ToString(Newtonsoft.Json.Formatting.None);
                }
            }
        }

        private static JArray ParseButtonArray(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return null;
            }
            if (token is JArray arr)
            {
                return (JArray)arr.DeepClone();
            }
            var text = TokenString(token);
            if (IsBlank(text) || text == "[]")
            {
                return null;
            }
            try
            {
                return JArray.Parse(text);
            }
            catch
            {
                return null;
            }
        }

        private static void LogDiyLangSyncException(string osClient, string title, Exception ex, string key)
        {
            try
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "Exception",
                    Title = title,
                    Content = ex.Message,
                    Param = key,
                    OsClient = osClient
                });
            }
            catch
            {
            }
        }

        private static void TranslateChildMenus(JObject row, string osClient, string lang)
        {
            foreach (var childKey in new[] { "_Child", "Children", "children" })
            {
                var children = row[childKey] as JArray;
                if (children == null)
                {
                    continue;
                }
                for (var i = 0; i < children.Count; i++)
                {
                    if (children[i] is JObject child)
                    {
                        children[i] = TranslateSysMenuForReturn(child, osClient, lang);
                    }
                }
            }
        }

        private static JObject CloneJObject(JObject source)
        {
            return source == null ? null : (JObject)source.DeepClone();
        }

        private static JObject ToJObjectSafe(object source)
        {
            if (source == null)
            {
                return new JObject();
            }
            if (source is JObject jObject)
            {
                return CloneJObject(jObject);
            }
            return JObject.FromObject(source);
        }

        private static T ConvertJObjectTo<T>(JObject row)
        {
            if (typeof(T) == typeof(JObject) || typeof(T) == typeof(object)
                || typeof(T).Name.IndexOf("Dynamic", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return (T)(object)row;
            }
            return row.ToObject<T>();
        }
    }
}

