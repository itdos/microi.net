using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
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
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangFullSyncStartedAt = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangTranslateUnavailable = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangTranslateUnsupportedTarget = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> DiyLangDbUnavailable = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> DiyLangMetadataSyncQueued = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, ConcurrentQueue<DiyLangMetadataQueueItem>> DiyLangMetadataQueues = new ConcurrentDictionary<string, ConcurrentQueue<DiyLangMetadataQueueItem>>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> DiyLangMetadataQueueWorkers = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, string> DiyLangSchemaEnsured = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, HashSet<string>> DiyLangPhysicalColumnsCache = new ConcurrentDictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> SysConfigLangFieldEnsured = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> SysConfigInitLangButtonEnsured = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> DiyLangTenantDbSemaphores = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, Dictionary<string, string>> DiyLangTreeRootIdsCache = new ConcurrentDictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        private static readonly SemaphoreSlim DiyLangGlobalDbSemaphore = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim DiyLangFullSyncSemaphore = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim DiyLangTranslateSemaphore = new SemaphoreSlim(2, 2);
        private static int DiyLangAllClientSyncRunning = 0;
        private static readonly object DiyLangCacheLock = new object();
        private const int DiyLangTranslateTimeoutSeconds = 8;
        private const int DiyLangDbBackoffMinutes = 5;
        private const int DiyLangDbOperationDelayMs = 15;
        private const int DiyLangMetadataQueueMax = 2000;
        private const int DiyLangTextColumnLength = 2000;
        private const string DefaultSysLangsValue = "zh-CN,zh-TW,en";
        private const string SysConfigInitLangButtonId = "sys-config-init-langs";
        private const string SysConfigInitLangButtonName = "\u521d\u59cb\u5316\u591a\u8bed\u8a00";
        private const string DiyLangRootBusinessData = "\u4e1a\u52a1\u6570\u636e";
        private const string DiyLangRootModuleEngine = "\u6a21\u5757\u5f15\u64ce";
        private const string DiyLangRootFormEngine = "\u8868\u5355\u5f15\u64ce";
        private const string DiyLangRootSystem = "\u7cfb\u7edf";

        private sealed class DiyLangFieldConfig
        {
            public string Locale { get; set; }
            public string Field { get; set; }
            public string Label { get; set; }
            public string TranslateLang { get; set; }
        }

        private sealed class DiyLangMetadataQueueItem
        {
            public string QueueKey { get; set; }
            public string OsClient { get; set; }
            public string Key { get; set; }
            public string SourceText { get; set; }
        }

        private static readonly List<DiyLangFieldConfig> SupportedDiyLangFields = new List<DiyLangFieldConfig>()
        {
            new DiyLangFieldConfig { Locale = "zh-CN", Field = "ZhCN", Label = "中文简体", TranslateLang = "zh" },
            new DiyLangFieldConfig { Locale = "zh-TW", Field = "ZhTW", Label = "中文繁体", TranslateLang = "zh-tw" },
            new DiyLangFieldConfig { Locale = "en", Field = "En", Label = "英语", TranslateLang = "en" },
            new DiyLangFieldConfig { Locale = "ja", Field = "Ja", Label = "日语", TranslateLang = "ja" },
            new DiyLangFieldConfig { Locale = "ko", Field = "Ko", Label = "韩语", TranslateLang = "ko" },
            new DiyLangFieldConfig { Locale = "vi", Field = "Vi", Label = "越南语", TranslateLang = "vi" },
            new DiyLangFieldConfig { Locale = "th", Field = "Th", Label = "泰语", TranslateLang = "th" },
            new DiyLangFieldConfig { Locale = "id", Field = "Idn", Label = "印度尼西亚语", TranslateLang = "id" },
            new DiyLangFieldConfig { Locale = "ms", Field = "Ms", Label = "马来语", TranslateLang = "ms" },
            new DiyLangFieldConfig { Locale = "tl", Field = "Tl", Label = "菲律宾语", TranslateLang = "tl" },
            new DiyLangFieldConfig { Locale = "my", Field = "My", Label = "缅甸语", TranslateLang = "my" },
            new DiyLangFieldConfig { Locale = "hi", Field = "Hi", Label = "印地语", TranslateLang = "hi" },
            new DiyLangFieldConfig { Locale = "ur", Field = "Ur", Label = "乌尔都语", TranslateLang = "ur" },
            new DiyLangFieldConfig { Locale = "ar", Field = "Ar", Label = "阿拉伯语", TranslateLang = "ar" },
            new DiyLangFieldConfig { Locale = "ru", Field = "Ru", Label = "俄语", TranslateLang = "ru" },
            new DiyLangFieldConfig { Locale = "de", Field = "De", Label = "德语", TranslateLang = "de" },
            new DiyLangFieldConfig { Locale = "fr", Field = "Fr", Label = "法语", TranslateLang = "fr" },
            new DiyLangFieldConfig { Locale = "es", Field = "Es", Label = "西班牙语", TranslateLang = "es" },
            new DiyLangFieldConfig { Locale = "pt", Field = "Pt", Label = "葡萄牙语", TranslateLang = "pt" },
            new DiyLangFieldConfig { Locale = "it", Field = "It", Label = "意大利语", TranslateLang = "it" },
            new DiyLangFieldConfig { Locale = "nl", Field = "Nl", Label = "荷兰语", TranslateLang = "nl" },
            new DiyLangFieldConfig { Locale = "tr", Field = "Tr", Label = "土耳其语", TranslateLang = "tr" },
            new DiyLangFieldConfig { Locale = "pl", Field = "Pl", Label = "波兰语", TranslateLang = "pl" },
            new DiyLangFieldConfig { Locale = "uk", Field = "Uk", Label = "乌克兰语", TranslateLang = "uk" }
        };

        public static string GetSysLangsDefaultValue()
        {
            return DefaultSysLangsValue;
        }

        public static string GetSysLangsKeyValueData()
        {
            var data = new JArray();
            foreach (var lang in SupportedDiyLangFields)
            {
                data.Add(new JObject()
                {
                    ["Key"] = lang.Locale,
                    ["Value"] = lang.Label
                });
            }
            return data.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static string GetKeyValueFieldConfig()
        {
            return new JObject()
            {
                ["DataSource"] = "KeyValue",
                ["SelectLabel"] = "Value",
                ["SelectSaveField"] = "Key",
                ["SelectSaveFormat"] = "Text",
                ["EnableSearch"] = true
            }.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static SemaphoreSlim GetDiyLangTenantDbSemaphore(string osClient)
        {
            var key = IsBlank(osClient) ? "__default__" : osClient;
            return DiyLangTenantDbSemaphores.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        }

        private static bool IsDiyLangConnectionPressureMessage(string message)
        {
            if (IsBlank(message))
            {
                return false;
            }
            return message.IndexOf("blocked because of many connection errors", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("mysqladmin flush-hosts", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("too many connections", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("max_user_connections", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("unable to connect to any of the specified mysql hosts", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("timeout expired", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsDiyLangDbBackoffActive(string osClient, out string message)
        {
            message = "";
            var key = IsBlank(osClient) ? "__default__" : osClient;
            if (!DiyLangDbUnavailable.TryGetValue(key, out var unavailableAt))
            {
                return false;
            }
            var elapsed = DateTime.UtcNow - unavailableAt;
            if (elapsed.TotalMinutes < DiyLangDbBackoffMinutes)
            {
                message = $"DiyLang DB operations are in {DiyLangDbBackoffMinutes} minute backoff for [{osClient}] after MySQL connection pressure.";
                return true;
            }
            DiyLangDbUnavailable.TryRemove(key, out _);
            return false;
        }

        private static void MarkDiyLangDbUnavailable(string osClient, string message)
        {
            var key = IsBlank(osClient) ? "__default__" : osClient;
            var isFirstMark = !DiyLangDbUnavailable.ContainsKey(key);
            DiyLangDbUnavailable[key] = DateTime.UtcNow;
            if (isFirstMark)
            {
                Console.WriteLine($"Microi：【多语言】租户[{osClient}]数据库连接压力过高，{DiyLangDbBackoffMinutes}分钟内暂停多语言初始化/同步，原因：{message}");
            }
        }

        private static async Task<T> RunDiyLangDbOperationAsync<T>(string osClient, Func<Task<T>> action)
        {
            if (IsDiyLangDbBackoffActive(osClient, out var backoffMessage))
            {
                throw new Exception(backoffMessage);
            }
            var tenantSemaphore = GetDiyLangTenantDbSemaphore(osClient);
            await DiyLangGlobalDbSemaphore.WaitAsync();
            await tenantSemaphore.WaitAsync();
            try
            {
                return await action();
            }
            catch (Exception ex)
            {
                if (IsDiyLangConnectionPressureMessage(ex.Message))
                {
                    MarkDiyLangDbUnavailable(osClient, ex.Message);
                }
                throw;
            }
            finally
            {
                tenantSemaphore.Release();
                DiyLangGlobalDbSemaphore.Release();
                if (DiyLangDbOperationDelayMs > 0)
                {
                    await Task.Delay(DiyLangDbOperationDelayMs);
                }
            }
        }

        private static Dictionary<string, string> CloneStringMap(Dictionary<string, string> source)
        {
            return source == null
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(source, StringComparer.OrdinalIgnoreCase);
        }

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
            new DiyLangSeed { Key = "Msg.MoreFunctions", ZhCN = "更多功能", En = "More Functions", ZhTW = "更多功能" },
            new DiyLangSeed { Key = "Msg.TranslateBusinessData", ZhCN = "翻译业务数据", En = "Translate Business Data", ZhTW = "翻譯業務資料" },
            new DiyLangSeed { Key = "Msg.TranslateBusinessDataDone", ZhCN = "业务数据翻译完成", En = "Business data translated.", ZhTW = "業務資料翻譯完成" },
            new DiyLangSeed { Key = "Msg.NoTranslatableBusinessData", ZhCN = "当前页没有可翻译的业务数据", En = "No translatable business data on this page.", ZhTW = "目前頁面沒有可翻譯的業務資料" },
            new DiyLangSeed { Key = "Msg.SelectTargetLangFirst", ZhCN = "请先切换到需要翻译的目标语言", En = "Please switch to a target language first.", ZhTW = "請先切換到需要翻譯的目標語言" },
            new DiyLangSeed { Key = "Msg.TableList", ZhCN = "列表", En = "List", ZhTW = "列表" },
            new DiyLangSeed { Key = "Msg.DownloadTemplate", ZhCN = "下载模板", En = "Download Template", ZhTW = "下載模板" },
            new DiyLangSeed { Key = "Msg.Selected", ZhCN = "已选择", En = "Selected", ZhTW = "已選擇" },
            new DiyLangSeed { Key = "Msg.Items", ZhCN = "项", En = "items", ZhTW = "項" },
            new DiyLangSeed { Key = "Msg.SelectAll", ZhCN = "全选", En = "Select All", ZhTW = "全選" },
            new DiyLangSeed { Key = "Msg.StartWorkflow", ZhCN = "发起流程", En = "Start Workflow", ZhTW = "發起流程" },
            new DiyLangSeed { Key = "Msg.DoWorkflow", ZhCN = "处理工作", En = "Process Work", ZhTW = "處理工作" },
            new DiyLangSeed { Key = "Msg.SubmitSave", ZhCN = "提交保存", En = "Submit Save", ZhTW = "提交儲存" },
            new DiyLangSeed { Key = "Msg.CancelChanges", ZhCN = "取消变更", En = "Cancel Changes", ZhTW = "取消變更" },
            new DiyLangSeed { Key = "Msg.ReturnDataTable", ZhCN = "返回数据表", En = "Return to Data Table", ZhTW = "返回資料表" },
            new DiyLangSeed { Key = "Msg.RecycleBin", ZhCN = "回收站", En = "Recycle Bin", ZhTW = "回收站" },
            new DiyLangSeed { Key = "Msg.LoadingMoreData", ZhCN = "正在加载更多数据...", En = "Loading more data...", ZhTW = "正在載入更多資料..." },
            new DiyLangSeed { Key = "Msg.PullOrClickLoadMore", ZhCN = "上拉或点击加载更多", En = "Pull up or click to load more", ZhTW = "上拉或點擊載入更多" },
            new DiyLangSeed { Key = "Msg.ResetSearch", ZhCN = "重置搜索", En = "Reset Search", ZhTW = "重設搜尋" },
            new DiyLangSeed { Key = "Msg.FormDesign", ZhCN = "表单设计", En = "Form Design", ZhTW = "表單設計" },
            new DiyLangSeed { Key = "Msg.ModuleDesign", ZhCN = "模块设计", En = "Module Design", ZhTW = "模組設計" },
            new DiyLangSeed { Key = "Msg.FormPermission", ZhCN = "表单权限", En = "Form Permission", ZhTW = "表單權限" },
            new DiyLangSeed { Key = "Msg.MenuPermission", ZhCN = "菜单权限", En = "Menu Permission", ZhTW = "選單權限" },
            new DiyLangSeed { Key = "Msg.DevDesign", ZhCN = "开发设计", En = "Dev Design", ZhTW = "開發設計" },
            new DiyLangSeed { Key = "Msg.IndexManager", ZhCN = "索引管理", En = "Index Manager", ZhTW = "索引管理" },
            new DiyLangSeed { Key = "Msg.IndexCreateAdvice", ZhCN = "索引创建建议", En = "Index Creation Advice", ZhTW = "索引建立建議" },
            new DiyLangSeed { Key = "Msg.IndexAdviceSearchSortJoin", ZhCN = "为常用于搜索条件、排序、关联查询的字段创建索引", En = "Create indexes for fields commonly used in search conditions, sorting, and joins", ZhTW = "為常用於搜尋條件、排序、關聯查詢的欄位建立索引" },
            new DiyLangSeed { Key = "Msg.IndexAdviceAuto", ZhCN = "可通过自动添加索引功能，自动为搜索字段和外键字段创建索引", En = "Use Auto Add Index to create indexes for search fields and foreign key fields", ZhTW = "可透過自動添加索引功能，自動為搜尋欄位和外鍵欄位建立索引" },
            new DiyLangSeed { Key = "Msg.IndexAdviceLeftPrefix", ZhCN = "联合索引遵循最左前缀原则，将区分度高的字段放在前面", En = "Composite indexes follow the leftmost prefix rule; place highly selective fields first", ZhTW = "複合索引遵循最左前綴原則，將區分度高的欄位放在前面" },
            new DiyLangSeed { Key = "Msg.IndexAdviceLowSelectivity", ZhCN = "避免对频繁更新的字段、低区分度字段单独建索引", En = "Avoid single-column indexes on frequently updated or low-selectivity fields", ZhTW = "避免對頻繁更新的欄位、低區分度欄位單獨建立索引" },
            new DiyLangSeed { Key = "Msg.IndexAdviceCountLimit", ZhCN = "单表索引数量建议不超过 5~6 个，过多索引会影响写入性能", En = "Keep indexes to about 5 or 6 per table; too many indexes slow down writes", ZhTW = "單表索引數量建議不超過 5~6 個，過多索引會影響寫入效能" },
            new DiyLangSeed { Key = "Msg.CurrentIndexes", ZhCN = "当前索引", En = "Current Indexes", ZhTW = "目前索引" },
            new DiyLangSeed { Key = "Msg.AutoAddIndex", ZhCN = "自动添加索引", En = "Auto Add Index", ZhTW = "自動添加索引" },
            new DiyLangSeed { Key = "Msg.CreateIndex", ZhCN = "新建索引", En = "Create Index", ZhTW = "新建索引" },
            new DiyLangSeed { Key = "Msg.IndexName", ZhCN = "索引名称", En = "Index Name", ZhTW = "索引名稱" },
            new DiyLangSeed { Key = "Msg.Unique", ZhCN = "唯一", En = "Unique", ZhTW = "唯一" },
            new DiyLangSeed { Key = "Msg.IndexType", ZhCN = "索引类型", En = "Index Type", ZhTW = "索引類型" },
            new DiyLangSeed { Key = "Msg.PrimaryKey", ZhCN = "主键", En = "Primary Key", ZhTW = "主鍵" },
            new DiyLangSeed { Key = "Msg.ConfirmDeleteIndex", ZhCN = "确认删除索引", En = "Confirm delete index", ZhTW = "確認刪除索引" },
            new DiyLangSeed { Key = "Msg.SelectField", ZhCN = "选择字段", En = "Select Field", ZhTW = "選擇欄位" },
            new DiyLangSeed { Key = "Msg.SelectIndexFields", ZhCN = "请先选择要添加索引的字段", En = "Please select fields to index", ZhTW = "請先選擇要添加索引的欄位" },
            new DiyLangSeed { Key = "Msg.IndexNamePlaceholder", ZhCN = "选择字段后自动生成，也可手动修改", En = "Generated after selecting fields; can be edited", ZhTW = "選擇欄位後自動產生，也可手動修改" },
            new DiyLangSeed { Key = "Msg.UniqueIndex", ZhCN = "唯一索引", En = "Unique Index", ZhTW = "唯一索引" },
            new DiyLangSeed { Key = "Msg.EnterIndexName", ZhCN = "请输入索引名称", En = "Please enter index name", ZhTW = "請輸入索引名稱" },
            new DiyLangSeed { Key = "Msg.SelectAtLeastOneField", ZhCN = "请选择至少一个字段", En = "Please select at least one field", ZhTW = "請至少選擇一個欄位" },
            new DiyLangSeed { Key = "Msg.IndexCreateSuccess", ZhCN = "索引创建成功", En = "Index created successfully", ZhTW = "索引建立成功" },
            new DiyLangSeed { Key = "Msg.IndexDeleteSuccess", ZhCN = "索引删除成功", En = "Index deleted successfully", ZhTW = "索引刪除成功" },
            new DiyLangSeed { Key = "Msg.CreateFailed", ZhCN = "创建失败", En = "Create failed", ZhTW = "建立失敗" },
            new DiyLangSeed { Key = "Msg.DeleteFailed", ZhCN = "删除失败", En = "Delete failed", ZhTW = "刪除失敗" },
            new DiyLangSeed { Key = "Msg.ModuleInfoNotFound", ZhCN = "未找到模块信息", En = "Module information not found", ZhTW = "未找到模組資訊" },
            new DiyLangSeed { Key = "Msg.IndexDone", ZhCN = "完成", En = "Done", ZhTW = "完成" },
            new DiyLangSeed { Key = "Msg.IndexCreated", ZhCN = "新建", En = "Created", ZhTW = "新建" },
            new DiyLangSeed { Key = "Msg.IndexSkipped", ZhCN = "跳过", En = "Skipped", ZhTW = "略過" },
            new DiyLangSeed { Key = "Msg.IndexFailed", ZhCN = "失败", En = "Failed", ZhTW = "失敗" },
            new DiyLangSeed { Key = "Msg.AutoAddIndexFailed", ZhCN = "自动添加索引失败", En = "Auto add index failed", ZhTW = "自動添加索引失敗" },
            new DiyLangSeed { Key = "Msg.ConfirmRestoreTrashData", ZhCN = "确认恢复该回收站数据？", En = "Restore this recycle bin record?", ZhTW = "確認恢復該回收站資料？" },
            new DiyLangSeed { Key = "Msg.NoPendingWork", ZhCN = "未找到您可处理的待办，可能已被处理或非接收人。", En = "No pending work was found for you. It may already be processed or you are not the receiver.", ZhTW = "未找到您可處理的待辦，可能已被處理或非接收人。" },
            new DiyLangSeed { Key = "Msg.SubMenuCount", ZhCN = "{count} 个子菜单", En = "{count} submenus", ZhTW = "{count} 個子選單" },
            new DiyLangSeed { Key = "Msg.NoVisibleMenu", ZhCN = "暂无可显示菜单", En = "No visible menus", ZhTW = "暫無可顯示選單" },
            new DiyLangSeed { Key = "Msg.OpenDoWorkFailed", ZhCN = "打开处理工作页面失败", En = "Failed to open work processing page", ZhTW = "開啟處理工作頁面失敗" },
            new DiyLangSeed { Key = "Msg.AbnormalFieldRepair", ZhCN = "异常字段修复", En = "Repair Abnormal Fields", ZhTW = "異常欄位修復" },
            new DiyLangSeed { Key = "Msg.DiyMissing", ZhCN = "Diy缺少", En = "Missing in DIY", ZhTW = "Diy 缺少" },
            new DiyLangSeed { Key = "Msg.DbMissing", ZhCN = "数据库缺少", En = "Missing in Database", ZhTW = "資料庫缺少" },
            new DiyLangSeed { Key = "Msg.Repair", ZhCN = "修复", En = "Repair", ZhTW = "修復" },
            new DiyLangSeed { Key = "Msg.FieldRecycleBinRestore", ZhCN = "字段回收站恢复", En = "Restore Field from Recycle Bin", ZhTW = "欄位回收站恢復" },
            new DiyLangSeed { Key = "Msg.Deleted", ZhCN = "已删除", En = "Deleted", ZhTW = "已刪除" },
            new DiyLangSeed { Key = "Msg.Recover", ZhCN = "恢复", En = "Recover", ZhTW = "恢復" },
            new DiyLangSeed { Key = "Msg.Detail", ZhCN = "详情", En = "Detail", ZhTW = "詳情" },
            new DiyLangSeed { Key = "Msg.More", ZhCN = "更多", En = "More", ZhTW = "更多" },
            new DiyLangSeed { Key = "Msg.Close", ZhCN = "关闭", En = "Close", ZhTW = "關閉" },
            new DiyLangSeed { Key = "Msg.Edit", ZhCN = "编辑", En = "Edit", ZhTW = "編輯" },
            new DiyLangSeed { Key = "Msg.Copy", ZhCN = "复制", En = "Copy", ZhTW = "複製" },
            new DiyLangSeed { Key = "Msg.View", ZhCN = "查看", En = "View", ZhTW = "查看" },
            new DiyLangSeed { Key = "Msg.Name", ZhCN = "名称", En = "Name", ZhTW = "名稱" },
            new DiyLangSeed { Key = "Msg.Field", ZhCN = "字段", En = "Field", ZhTW = "欄位" },
            new DiyLangSeed { Key = "Msg.Yes", ZhCN = "是", En = "Yes", ZhTW = "是" },
            new DiyLangSeed { Key = "Msg.No", ZhCN = "否", En = "No", ZhTW = "否" },
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
            new DiyLangSeed { Key = "Msg.DraftDeleted", ZhCN = "草稿已删除。", En = "Draft deleted.", ZhTW = "草稿已刪除。" },
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

        private static string ResolveDiyLangTreeRootKey(string key)
        {
            if (IsBlank(key))
            {
                return DiyLangRootSystem;
            }
            if (string.Equals(key, DiyLangRootBusinessData, StringComparison.OrdinalIgnoreCase)
                || string.Equals(key, DiyLangRootModuleEngine, StringComparison.OrdinalIgnoreCase)
                || string.Equals(key, DiyLangRootFormEngine, StringComparison.OrdinalIgnoreCase)
                || string.Equals(key, DiyLangRootSystem, StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }
            if (key.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                return DiyLangRootBusinessData;
            }
            if (key.StartsWith("diy_table:", StringComparison.OrdinalIgnoreCase)
                || key.StartsWith("diy_field:", StringComparison.OrdinalIgnoreCase))
            {
                return DiyLangRootFormEngine;
            }
            if (key.StartsWith("sys_menu:", StringComparison.OrdinalIgnoreCase))
            {
                var parts = key.Split(':');
                return parts.Length == 3 ? DiyLangRootModuleEngine : DiyLangRootFormEngine;
            }
            return DiyLangRootSystem;
        }

        private static IDictionary<string, string> GetDiyLangRootTranslations(string rootKey)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (rootKey == DiyLangRootBusinessData)
            {
                result["En"] = "Business Data";
                result["ZhTW"] = "\u696d\u52d9\u8cc7\u6599";
                result["My"] = "\u1005\u102e\u1038\u1015\u103d\u102c\u1038\u101b\u1031\u1038\u1012\u1031\u1010\u102c";
            }
            else if (rootKey == DiyLangRootModuleEngine)
            {
                result["En"] = "Module Engine";
                result["ZhTW"] = "\u6a21\u7d44\u5f15\u64ce";
                result["My"] = "\u1019\u1031\u102c\u103a\u1002\u103b\u1030\u1038\u1021\u1004\u103a\u1002\u103b\u1004\u103a";
            }
            else if (rootKey == DiyLangRootFormEngine)
            {
                result["En"] = "Form Engine";
                result["ZhTW"] = "\u8868\u55ae\u5f15\u64ce";
                result["My"] = "\u1016\u1031\u102c\u1004\u103a\u1021\u1004\u103a\u1002\u103b\u1004\u103a";
            }
            else if (rootKey == DiyLangRootSystem)
            {
                result["En"] = "System";
                result["ZhTW"] = "\u7cfb\u7d71";
                result["My"] = "\u1005\u1014\u1005\u103a";
            }
            return result;
        }

        private static async Task<Dictionary<string, string>> EnsureDiyLangTreeRootsAsync(string osClient, List<DiyLangFieldConfig> langConfigs)
        {
            var roots = new[] { DiyLangRootBusinessData, DiyLangRootModuleEngine, DiyLangRootFormEngine, DiyLangRootSystem };
            var cacheKey = IsBlank(osClient) ? "__default__" : osClient;
            if (DiyLangTreeRootIdsCache.TryGetValue(cacheKey, out var cachedMap)
                && cachedMap != null
                && roots.All(root => cachedMap.ContainsKey(root)))
            {
                return CloneStringMap(cachedMap);
            }
            foreach (var root in roots)
            {
                await EnsureDiyLangMetadataAsync(osClient, root, root, GetDiyLangRootTranslations(root), false, langConfigs, false);
            }
            var result = await RunDiyLangDbOperationAsync(osClient, () =>
                MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_lang", new
                {
                    OsClient = osClient,
                    _InvokeType = "Server",
                    _Lang = "cn",
                    _PageIndex = 1,
                    _PageSize = 20,
                    _SelectFields = new[] { "Id", "Key" },
                    _Where = new List<DiyWhere>() { new DiyWhere() { Name = "Key", Type = "In", Value = roots.ToList() } }
                }));
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (result.Code == 1 && result.Data != null)
            {
                foreach (var item in result.Data)
                {
                    var row = ToJObjectSafe(item);
                    var key = TokenString(row, "Key");
                    var id = TokenString(row, "Id");
                    if (!IsBlank(key) && !IsBlank(id))
                    {
                        map[key] = id;
                    }
                }
            }
            if (roots.All(root => map.ContainsKey(root)))
            {
                DiyLangTreeRootIdsCache[cacheKey] = CloneStringMap(map);
            }
            return map;
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

        private static string NormalizeSysLocale(string locale)
        {
            locale = (locale ?? "").Trim();
            if (IsBlank(locale))
            {
                return "";
            }
            if (locale.Contains("|"))
            {
                locale = locale.Split('|')[0];
            }
            var lower = locale.Replace("_", "-").ToLowerInvariant();
            if (lower == "cn" || lower == "zh" || lower == "zh-cn" || lower == "zh-hans" || lower == "zh-hans-cn")
            {
                return "zh-CN";
            }
            if (lower == "tw" || lower == "zh-tw" || lower == "zh-hk" || lower == "zh-hant" || lower == "zh-hant-tw" || lower == "zh-mo")
            {
                return "zh-TW";
            }
            if (lower == "jp" || lower == "ja-jp")
            {
                return "ja";
            }
            if (lower == "my-mm" || lower == "burmese" || lower == "myanmar")
            {
                return "my";
            }
            var supported = SupportedDiyLangFields.FirstOrDefault(lang =>
                string.Equals(lang.Locale, lower, StringComparison.OrdinalIgnoreCase)
                || string.Equals(lang.TranslateLang, lower, StringComparison.OrdinalIgnoreCase)
                || string.Equals(lang.Field, locale, StringComparison.OrdinalIgnoreCase));
            return supported?.Locale ?? "";
        }

        private static List<DiyLangFieldConfig> ParseSysLangs(string raw)
        {
            var parts = new List<string>();
            if (!IsBlank(raw))
            {
                try
                {
                    var token = JToken.Parse(raw);
                    if (token is JArray arr)
                    {
                        parts.AddRange(arr.Select(item => TokenString(item)));
                    }
                    else
                    {
                        parts.Add(TokenString(token));
                    }
                }
                catch
                {
                    parts.AddRange(raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries));
                }
            }
            if (parts.Count == 0)
            {
                parts.AddRange(DefaultSysLangsValue.Split(','));
            }

            var localeSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<DiyLangFieldConfig>();
            foreach (var item in parts)
            {
                var locale = NormalizeSysLocale(item);
                if (IsBlank(locale) || !localeSet.Add(locale))
                {
                    continue;
                }
                var config = SupportedDiyLangFields.FirstOrDefault(lang => string.Equals(lang.Locale, locale, StringComparison.OrdinalIgnoreCase));
                if (config != null)
                {
                    result.Add(config);
                }
            }
            if (result.Count == 0)
            {
                return ParseSysLangs(DefaultSysLangsValue);
            }
            return result;
        }

        private static async Task<JObject> GetEnabledSysConfigRowAsync(string osClient)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
            {
                OsClient = osClient,
                _InvokeType = "Server",
                _Lang = "cn",
                _Where = new List<DiyWhere>() { new DiyWhere() { Name = "IsEnable", Type = "=", Value = "1" } }
            });
            return result.Code == 1 && result.Data != null ? ToJObjectSafe(result.Data) : null;
        }

        private static async Task ClearSysConfigCacheAsync(string osClient)
        {
            try
            {
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:SysConfig");
                await MicroiEngine.CacheTenant.Default().RemoveAsync($"Microi:{osClient}:SysConfig");
            }
            catch
            {
            }
        }

        private static async Task ClearDiyFieldListCacheAsync(string osClient, string tableId, string tableName)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                if (!IsBlank(tableId))
                {
                    await cache.RemoveAsync(BuildCacheKey(osClient, ":FormData:diy_table_field_list:", tableId.DosToLower()));
                }
                if (!IsBlank(tableName))
                {
                    await cache.RemoveAsync(BuildCacheKey(osClient, ":FormData:diy_table_field_list:", tableName.DosToLower()));
                }
            }
            catch
            {
            }
        }

        private static async Task<JObject> ResolveDiyTableIdentityAsync(string osClient, string tableName)
        {
            if (IsBlank(osClient) || IsBlank(tableName))
            {
                return null;
            }
            try
            {
                return await Task.Run(() =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var rows = db.FromSql(@"SELECT Id, Name
                            FROM diy_table
                            WHERE LOWER(Name) = LOWER(@p0) AND (IsDeleted <> 1 OR IsDeleted IS NULL)
                            ORDER BY CreateTime DESC
                            LIMIT 1")
                        .AddInParameter("p0", tableName)
                        .ToList<dynamic>();
                    return ToJObjectSafe(rows?.FirstOrDefault());
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Resolve diy_table identity failed. OsClient={osClient}, Table={tableName}, Msg={ex.Message}");
                return null;
            }
        }

        private static async Task EnsureDiyFieldMetadataAsync(
            string osClient,
            string tableName,
            string fieldName,
            string label,
            string type,
            string component,
            string data = "",
            string defaultValue = "",
            int? tableWidth = null,
            int? formWidth = null,
            string config = "")
        {
            if (IsBlank(osClient) || IsBlank(tableName) || IsBlank(fieldName))
            {
                return;
            }

            await RunDiyLangDbOperationAsync(osClient, async () =>
            {
                try
                {
                    var tableIdentity = await ResolveDiyTableIdentityAsync(osClient, tableName);
                    var tableId = TokenString(tableIdentity, "Id");
                    var canonicalTableName = TokenString(tableIdentity, "Name");
                    if (IsBlank(canonicalTableName))
                    {
                        canonicalTableName = tableName;
                    }

                    var db = OsClientExtend.GetClient(osClient).Db;
                    EnsurePhysicalColumnExists(db, canonicalTableName, fieldName, type);

                    var rows = db.FromSql(@"SELECT *
                            FROM diy_field
                            WHERE LOWER(Name) = LOWER(@p0)
                              AND (LOWER(TableName) = LOWER(@p1) OR (@p2 <> '' AND TableId = @p2))
                              AND (IsDeleted <> 1 OR IsDeleted IS NULL)
                            ORDER BY CreateTime DESC
                            LIMIT 1")
                        .AddInParameter("p0", fieldName)
                        .AddInParameter("p1", canonicalTableName)
                        .AddInParameter("p2", tableId ?? "")
                        .ToList<dynamic>();
                    var fieldRow = ToJObjectSafe(rows?.FirstOrDefault());
                    if (fieldRow != null && !IsBlank(TokenString(fieldRow, "Id")))
                    {
                        db.FromSql(@"UPDATE diy_field
                                SET TableId = CASE WHEN @p0 = '' THEN TableId ELSE @p0 END,
                                    TableName = @p1,
                                    Label = CASE WHEN @p2 = '' THEN Label ELSE @p2 END,
                                    Type = CASE WHEN @p3 = '' THEN Type ELSE @p3 END,
                                    Component = CASE WHEN @p4 = '' THEN Component ELSE @p4 END,
                                    Data = CASE WHEN @p5 = '' THEN Data ELSE @p5 END,
                                    Config = CASE WHEN @p6 = '' THEN Config ELSE @p6 END,
                                    DefaultValue = CASE WHEN @p7 = '' THEN DefaultValue ELSE @p7 END,
                                    TableWidth = CASE WHEN @p8 IS NULL THEN TableWidth ELSE @p8 END,
                                    FormWidth = CASE WHEN @p9 IS NULL THEN FormWidth ELSE @p9 END,
                                    Visible = 1,
                                    AppVisible = 1,
                                    UpdateTime = @p10
                                WHERE Id = @p11")
                            .AddInParameter("p0", tableId ?? "")
                            .AddInParameter("p1", canonicalTableName)
                            .AddInParameter("p2", label ?? "")
                            .AddInParameter("p3", type ?? "")
                            .AddInParameter("p4", component ?? "")
                            .AddInParameter("p5", data ?? "")
                            .AddInParameter("p6", config ?? "")
                            .AddInParameter("p7", defaultValue ?? "")
                            .AddInParameter("p8", tableWidth.HasValue ? (object)tableWidth.Value : DBNull.Value)
                            .AddInParameter("p9", formWidth.HasValue ? (object)formWidth.Value : DBNull.Value)
                            .AddInParameter("p10", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                            .AddInParameter("p11", TokenString(fieldRow, "Id"))
                            .ExecuteNonQuery();
                        await ClearDiyFieldListCacheAsync(osClient, tableId, canonicalTableName);
                        return 1;
                    }

                    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    var sort = db.FromSql(@"SELECT IFNULL(MAX(Sort), 0) + 100
                            FROM diy_field
                            WHERE (LOWER(TableName) = LOWER(@p0) OR (@p1 <> '' AND TableId = @p1))
                              AND (IsDeleted <> 1 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", canonicalTableName)
                        .AddInParameter("p1", tableId ?? "")
                        .ToScalar<int>();

                    db.FromSql(@"INSERT INTO diy_field
                            (Id, TableId, TableName, Name, Label, Type, Component, Data, Config,
                             DefaultValue, TableWidth, FormWidth, Visible, AppVisible, Sort,
                             CreateTime, UpdateTime, IsDeleted, OsClient)
                            VALUES
                            (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8,
                             @p9, @p10, @p11, 1, 1, @p12, @p13, @p14, 0, @p15)")
                        .AddInParameter("p0", Guid.NewGuid().ToString())
                        .AddInParameter("p1", tableId ?? "")
                        .AddInParameter("p2", canonicalTableName)
                        .AddInParameter("p3", fieldName)
                        .AddInParameter("p4", label ?? "")
                        .AddInParameter("p5", type ?? "")
                        .AddInParameter("p6", component ?? "")
                        .AddInParameter("p7", data ?? "")
                        .AddInParameter("p8", config ?? "")
                        .AddInParameter("p9", defaultValue ?? "")
                        .AddInParameter("p10", tableWidth.HasValue ? (object)tableWidth.Value : DBNull.Value)
                        .AddInParameter("p11", formWidth.HasValue ? (object)formWidth.Value : DBNull.Value)
                        .AddInParameter("p12", sort)
                        .AddInParameter("p13", now)
                        .AddInParameter("p14", now)
                        .AddInParameter("p15", osClient)
                        .ExecuteNonQuery();
                    await ClearDiyFieldListCacheAsync(osClient, tableId, canonicalTableName);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi: Ensure field metadata failed. OsClient={osClient}, Table={tableName}, Field={fieldName}, Msg={ex.Message}");
                }
                return 1;
            });
        }

        private static string QuoteMysqlIdentifier(string identifier)
        {
            return $"`{(identifier ?? "").Replace("`", "``")}`";
        }

        private static string ResolvePhysicalTableName(DbSession db, string tableName)
        {
            if (db == null || IsBlank(tableName))
            {
                return tableName;
            }
            try
            {
                var row = db.FromSql(@"SELECT TABLE_NAME
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(@p0)
                        LIMIT 1")
                    .AddInParameter("p0", tableName)
                    .ToList<dynamic>()
                    ?.FirstOrDefault();
                var table = TokenString(ToJObjectSafe(row), "TABLE_NAME");
                if (IsBlank(table))
                {
                    table = TokenString(ToJObjectSafe(row), "TableName");
                }
                return IsBlank(table) ? tableName : table;
            }
            catch
            {
                return tableName;
            }
        }

        private static bool PhysicalColumnExists(DbSession db, string tableName, string fieldName)
        {
            try
            {
                return db.FromSql(@"SELECT COUNT(*)
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND LOWER(TABLE_NAME) = LOWER(@p0)
                          AND LOWER(COLUMN_NAME) = LOWER(@p1)")
                    .AddInParameter("p0", tableName)
                    .AddInParameter("p1", fieldName)
                    .ToScalar<int>() > 0;
            }
            catch
            {
                return true;
            }
        }

        private static HashSet<string> GetPhysicalColumnNames(DbSession db, string osClient, string tableName)
        {
            if (db == null || IsBlank(tableName))
            {
                return null;
            }
            var cacheKey = $"{osClient}|{tableName}";
            if (DiyLangPhysicalColumnsCache.TryGetValue(cacheKey, out var cachedColumns))
            {
                return cachedColumns;
            }
            try
            {
                var physicalTableName = ResolvePhysicalTableName(db, tableName);
                var rows = db.FromSql(@"SELECT COLUMN_NAME
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND LOWER(TABLE_NAME) = LOWER(@p0)")
                    .AddInParameter("p0", physicalTableName)
                    .ToList<dynamic>();
                var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var item in rows ?? new List<dynamic>())
                {
                    var row = ToJObjectSafe(item);
                    var name = TokenString(row, "COLUMN_NAME");
                    if (IsBlank(name))
                    {
                        name = TokenString(row, "ColumnName");
                    }
                    if (!IsBlank(name))
                    {
                        columns.Add(name);
                    }
                }
                if (columns.Count > 0)
                {
                    DiyLangPhysicalColumnsCache[cacheKey] = columns;
                    return columns;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: load physical columns failed. OsClient={osClient}, Table={tableName}, Msg={ex.Message}");
            }
            return null;
        }

        private static void EnsurePhysicalColumnExists(DbSession db, string tableName, string fieldName, string type)
        {
            if (db == null || IsBlank(tableName) || IsBlank(fieldName) || IsBlank(type))
            {
                return;
            }
            try
            {
                var physicalTableName = ResolvePhysicalTableName(db, tableName);
                if (PhysicalColumnExists(db, physicalTableName, fieldName))
                {
                    return;
                }
                db.FromSql($"ALTER TABLE {QuoteMysqlIdentifier(physicalTableName)} ADD COLUMN {QuoteMysqlIdentifier(fieldName)} {type} NULL")
                    .ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Ensure physical column failed. Table={tableName}, Field={fieldName}, Msg={ex.Message}");
            }
        }

        protected static JObject NormalizeSysConfigLangForReturn(dynamic data, string sysLangs)
        {
            var row = ToJObjectSafe(data);
            if (row == null)
            {
                row = new JObject();
            }
            if (IsBlank(TokenString(row, "SysLangs")))
            {
                row["SysLangs"] = IsBlank(sysLangs) ? DefaultSysLangsValue : sysLangs;
            }
            var sysLang = NormalizeSysLocale(TokenString(row, "SysLang"));
            if (IsBlank(sysLang))
            {
                row["SysLang"] = "zh-CN";
            }
            else
            {
                row["SysLang"] = sysLang;
            }
            return row;
        }

        protected static async Task<string> EnsureSysConfigLangFieldAsync(string osClient)
        {
            if (!SysConfigLangFieldEnsured.ContainsKey(osClient))
            {
                await EnsureDiyFieldMetadataAsync(
                    osClient,
                    "sys_config",
                    "SysLangs",
                    "多语言",
                    "varchar(500)",
                    "Checkbox",
                    GetSysLangsKeyValueData(),
                    DefaultSysLangsValue,
                    180,
                    24,
                    GetKeyValueFieldConfig());
                await EnsureDiyFieldMetadataAsync(
                    osClient,
                    "sys_config",
                    "SysLang",
                    "默认语言",
                    "varchar(50)",
                    "Select",
                    GetSysLangsKeyValueData(),
                    "zh-CN",
                    120,
                    null,
                    GetKeyValueFieldConfig());
                SysConfigLangFieldEnsured[osClient] = 1;
            }
            await EnsureSysConfigInitLangButtonAsync(osClient);

            var configRow = await GetEnabledSysConfigRowAsync(osClient);
            if (configRow == null)
            {
                return DefaultSysLangsValue;
            }
            var sysLangs = TokenString(configRow, "SysLangs");
            var changed = false;
            if (IsBlank(sysLangs))
            {
                sysLangs = DefaultSysLangsValue;
                configRow["SysLangs"] = sysLangs;
                changed = true;
            }
            var sysLang = NormalizeSysLocale(TokenString(configRow, "SysLang"));
            if (IsBlank(sysLang))
            {
                configRow["SysLang"] = "zh-CN";
                changed = true;
            }
            if (changed)
            {
                try
                {
                    await RunDiyLangDbOperationAsync(osClient, () =>
                    {
                        var db = OsClientExtend.GetClient(osClient).Db;
                        db.FromSql("UPDATE sys_config SET SysLangs = @p0, SysLang = @p1, UpdateTime = @p2 WHERE Id = @p3")
                            .AddInParameter("p0", sysLangs)
                            .AddInParameter("p1", TokenString(configRow, "SysLang"))
                            .AddInParameter("p2", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                            .AddInParameter("p3", TokenString(configRow, "Id"))
                            .ExecuteNonQuery();
                        return Task.FromResult(1);
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi: Ensure sys_config SysLangs failed. OsClient={osClient}, Msg={ex.Message}");
                }
                await ClearSysConfigCacheAsync(osClient);
            }
            return sysLangs;
        }

        private static async Task EnsureSysConfigInitLangButtonAsync(string osClient)
        {
            if (IsBlank(osClient) || SysConfigInitLangButtonEnsured.ContainsKey(osClient))
            {
                return;
            }

            try
            {
                var ensureResult = await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var tableRows = db.FromSql("SELECT Id FROM diy_table WHERE Name = @p0 AND (IsDeleted <> 1 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", "sys_config")
                        .ToList<dynamic>();
                    var tableId = TokenString(ToJObjectSafe(tableRows?.FirstOrDefault()), "Id");
                    if (IsBlank(tableId))
                    {
                        return Task.FromResult<JObject>(null);
                    }

                    var menuRows = db.FromSql(@"SELECT Id, Name, DiyTableId, MoreBtns
                            FROM sys_menu
                            WHERE DiyTableId = @p0 AND (IsDeleted <> 1 OR IsDeleted IS NULL)
                            ORDER BY Sort")
                        .AddInParameter("p0", tableId)
                        .ToList<dynamic>();
                    JObject menuRow = null;
                    foreach (var item in menuRows)
                    {
                        var row = ToJObjectSafe(item);
                        if (!IsBlank(TokenString(row, "Id")))
                        {
                            menuRow = row;
                            break;
                        }
                    }
                    var menuId = TokenString(menuRow, "Id");
                    if (IsBlank(menuId))
                    {
                        return Task.FromResult<JObject>(null);
                    }

                    var buttons = ParseButtonArray(menuRow["MoreBtns"]) ?? new JArray();
                    var changed = false;
                    JObject button = buttons
                        .OfType<JObject>()
                        .FirstOrDefault(item => string.Equals(TokenString(item, "Id"), SysConfigInitLangButtonId, StringComparison.OrdinalIgnoreCase));
                    if (button == null)
                    {
                        button = new JObject();
                        buttons.Add(button);
                        changed = true;
                    }

                    changed = SetButtonValue(button, "Id", SysConfigInitLangButtonId) || changed;
                    changed = SetButtonValue(button, "Sort", 900) || changed;
                    changed = SetButtonValue(button, "Name", SysConfigInitLangButtonName) || changed;
                    changed = SetButtonValue(button, "Icon", "fas fa-language") || changed;
                    changed = SetButtonValue(button, "BtnStyle", "primary") || changed;
                    changed = SetButtonValue(button, "IsVisible", true) || changed;
                    changed = SetButtonValue(button, "ShowRow", false) || changed;
                    changed = SetButtonValue(button, "V8CodeShow", "V8.Result = true;") || changed;
                    changed = SetButtonValue(button, "V8Code", BuildSysConfigInitLangButtonV8Code()) || changed;

                    if (changed)
                    {
                        db.FromSql("UPDATE sys_menu SET MoreBtns = @p0, UpdateTime = @p1 WHERE Id = @p2")
                            .AddInParameter("p0", buttons.ToString(Newtonsoft.Json.Formatting.None))
                            .AddInParameter("p1", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                            .AddInParameter("p2", menuId)
                            .ExecuteNonQuery();
                    }

                    menuRow["MoreBtns"] = buttons;
                    return Task.FromResult<JObject>(new JObject()
                    {
                        ["Changed"] = changed,
                        ["MenuRow"] = menuRow
                    });
                });

                var menuForSync = ensureResult?["MenuRow"] as JObject;
                if (menuForSync != null && ensureResult.Value<bool>("Changed"))
                {
                    await new FormEngineExtend().SyncSysMenuButtonLangRows(osClient, menuForSync);
                }

                SysConfigInitLangButtonEnsured[osClient] = 1;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Ensure sys_config init lang button failed. OsClient={osClient}, Msg={ex.Message}");
            }
        }

        private static string BuildSysConfigInitLangButtonV8Code()
        {
            return "V8.ConfirmTips('\\u786e\\u8ba4\\u6839\\u636e\\u5f53\\u524d\\u7cfb\\u7edf\\u8bbe\\u7f6e\\u7684\\u591a\\u8bed\\u8a00\\u914d\\u7f6e\\u521d\\u59cb\\u5316\\u5e76\\u540c\\u6b65\\u5417\\uff1f', function(){\n"
                + "  V8.Post('/api/FormEngine/SyncLangMetadata?Source=sys_config', { OsClient: V8.OsClient, Wait: false, IncludeClientText: true }, function(r){\n"
                + "    if(r && r.Code == 1){ V8.Tips('\\u5df2\\u5f00\\u59cb\\u521d\\u59cb\\u5316\\u591a\\u8bed\\u8a00\\uff0c\\u53ef\\u5728\\u3010\\u591a\\u8bed\\u8a00\\u65e5\\u5fd7\\u3011\\u67e5\\u770b\\u8fdb\\u5ea6\\u3002', true); }\n"
                + "    else { V8.Tips((r && r.Msg) || '\\u521d\\u59cb\\u5316\\u5931\\u8d25', false); }\n"
                + "  });\n"
                + "});";
        }

        private static bool SetButtonValue(JObject button, string key, JToken value)
        {
            if (JToken.DeepEquals(button[key], value))
            {
                return false;
            }
            button[key] = value;
            return true;
        }

        private static async Task<List<DiyLangFieldConfig>> EnsureDiyLangInfrastructureAsync(string osClient)
        {
            var sysLangs = await EnsureSysConfigLangFieldAsync(osClient);
            var langConfigs = ParseSysLangs(sysLangs);
            var signature = string.Join(",", langConfigs.Select(lang => lang.Field));
            if (DiyLangSchemaEnsured.TryGetValue(osClient, out var oldSignature) && oldSignature == signature)
            {
                return langConfigs;
            }
            foreach (var lang in langConfigs)
            {
                await EnsureDiyFieldMetadataAsync(
                    osClient,
                    "diy_lang",
                    lang.Field,
                    lang.Label,
                    $"varchar({DiyLangTextColumnLength})",
                    "Text",
                    "",
                    "",
                    160,
                    null);
                await EnsureVarcharColumnCapacityAsync(osClient, "diy_lang", lang.Field, DiyLangTextColumnLength);
                await UpdateDiyFieldMetadataDirectAsync(osClient, "diy_lang", lang.Field, lang.Label, $"varchar({DiyLangTextColumnLength})", "Text", 160);
            }
            await EnsureDiyFieldMetadataAsync(osClient, "diy_lang", "Key", "Key", "varchar(500)", "Text", "", "", 220, null);
            await EnsureDiyFieldMetadataAsync(osClient, "diy_lang", "Code", "Code", "varchar(500)", "Text", "", "", 220, null);
            await EnsureDiyFieldMetadataAsync(osClient, "diy_lang", "ParentId", "\u4e0a\u7ea7", "varchar(50)", "Text", "", "", 160, null);
            await EnsureVarcharColumnCapacityAsync(osClient, "diy_lang", "Key", 500);
            await EnsureVarcharColumnCapacityAsync(osClient, "diy_lang", "Code", 500);
            await UpdateDiyFieldMetadataDirectAsync(osClient, "diy_lang", "Key", "Key", "varchar(500)", "Text", 220);
            await UpdateDiyFieldMetadataDirectAsync(osClient, "diy_lang", "Code", "Code", "varchar(500)", "Text", 220);
            await UpdateDiyFieldMetadataDirectAsync(osClient, "diy_lang", "ParentId", "\u4e0a\u7ea7", "varchar(50)", "Text", 160);
            DiyLangPhysicalColumnsCache.TryRemove($"{osClient}|diy_lang", out _);
            DiyLangSchemaEnsured[osClient] = signature;
            return langConfigs;
        }

        private static async Task UpdateDiyFieldMetadataDirectAsync(
            string osClient,
            string tableName,
            string fieldName,
            string label,
            string type,
            string component,
            int? tableWidth)
        {
            try
            {
                await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    db.FromSql(@"UPDATE diy_field
                            SET Label = @p0, Type = @p1, Component = @p2, TableWidth = @p3, UpdateTime = @p4
                            WHERE TableName = @p5 AND Name = @p6 AND IsDeleted = 0")
                        .AddInParameter("p0", label ?? "")
                        .AddInParameter("p1", type ?? "")
                        .AddInParameter("p2", component ?? "")
                        .AddInParameter("p3", tableWidth)
                        .AddInParameter("p4", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                        .AddInParameter("p5", tableName)
                        .AddInParameter("p6", fieldName)
                        .ExecuteNonQuery();
                    return Task.FromResult(1);
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Update diy_field metadata failed. OsClient={osClient}, Table={tableName}, Field={fieldName}, Msg={ex.Message}");
            }
        }

        private static async Task EnsureVarcharColumnCapacityAsync(string osClient, string tableName, string fieldName, int minLength)
        {
            if (IsBlank(osClient) || IsBlank(tableName) || IsBlank(fieldName) || minLength <= 0)
            {
                return;
            }
            try
            {
                await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var clientModel = OsClientExtend.GetClient(osClient);
                    var db = clientModel.Db;
                    var dbType = TokenString(clientModel.OsClientModel?["DbType"]);
                    if (IsBlank(dbType))
                    {
                        dbType = TokenString(clientModel.OsClientModel?["DbReadType"]);
                    }
                    var dbTypeLower = (dbType ?? "").ToLowerInvariant();
                    if (dbTypeLower.Contains("mysql"))
                    {
                        var length = db.FromSql(@"SELECT CHARACTER_MAXIMUM_LENGTH
                                FROM INFORMATION_SCHEMA.COLUMNS
                                WHERE TABLE_SCHEMA = DATABASE()
                                  AND TABLE_NAME = @p0
                                  AND COLUMN_NAME = @p1")
                            .AddInParameter("p0", tableName)
                            .AddInParameter("p1", fieldName)
                            .ToScalar<int?>();
                        if (length.HasValue && length.Value > 0 && length.Value < minLength)
                        {
                            db.FromSql($"ALTER TABLE `{tableName}` MODIFY COLUMN `{fieldName}` varchar({minLength}) NULL")
                                .ExecuteNonQuery();
                        }
                    }
                    else if (dbTypeLower.Contains("sqlserver") || dbTypeLower.Contains("mssql"))
                    {
                        var length = db.FromSql("SELECT COL_LENGTH(@p0, @p1)")
                            .AddInParameter("p0", tableName)
                            .AddInParameter("p1", fieldName)
                            .ToScalar<int?>();
                        if (length.HasValue && length.Value > 0 && length.Value < minLength)
                        {
                            db.FromSql($"ALTER TABLE [{tableName}] ALTER COLUMN [{fieldName}] varchar({minLength}) NULL")
                                .ExecuteNonQuery();
                        }
                    }
                    return Task.FromResult(1);
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Ensure varchar column capacity failed. OsClient={osClient}, Table={tableName}, Field={fieldName}, Msg={ex.Message}");
            }
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
            // Business row data is translated on demand by the client via ApiEngine.
            // Do not auto-create data:* entries in diy_lang; that table is for metadata.
            return source.ToList();
        }

        public DosResult QueueDiyLangFullSync(string osClient = "", bool includeClientText = true, string source = "api")
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }
            if (IsDiyLangDbBackoffActive(osClient, out var backoffMessage))
            {
                return new DosResult(0, null, backoffMessage);
            }
            if (!DiyLangFullSyncRunning.TryAdd(osClient, 1))
            {
                DiyLangFullSyncStartedAt.TryGetValue(osClient, out var startedAt);
                var data = new JObject()
                {
                    ["OsClient"] = osClient,
                    ["StartedAt"] = startedAt == default ? "" : startedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["ElapsedSeconds"] = startedAt == default ? 0 : (int)(DateTime.UtcNow - startedAt).TotalSeconds
                };
                return new DosResult(1, data, $"DiyLang sync is already running for {osClient}.");
            }
            DiyLangFullSyncStartedAt[osClient] = DateTime.UtcNow;
            _ = Task.Run(async () =>
            {
                try
                {
                    await SyncDiyLangFullAsync(osClient, includeClientText, source);
                }
                catch (Exception ex)
                {
                    LogDiyLangSyncException(osClient, "DiyLang full sync failed", ex, osClient);
                }
                finally
                {
                    DiyLangFullSyncRunning.TryRemove(osClient, out _);
                    DiyLangFullSyncStartedAt.TryRemove(osClient, out _);
                }
            });
            return new DosResult(1, null, $"DiyLang sync queued for {osClient}.");
        }

        public DosResult ResetDiyLangFullSync(string osClient = "", string reason = "manual")
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }

            var removed = DiyLangFullSyncRunning.TryRemove(osClient, out _);
            DiyLangFullSyncStartedAt.TryRemove(osClient, out var startedAt);
            ClearDiyLangTranslateRuntimeState(osClient);
            var data = new JObject()
            {
                ["OsClient"] = osClient,
                ["RemovedRunningFlag"] = removed,
                ["StartedAt"] = startedAt == default ? "" : startedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ["Reason"] = IsBlank(reason) ? "manual" : reason
            };
            return new DosResult(1, data, removed
                ? $"DiyLang sync running flag reset for {osClient}."
                : $"DiyLang sync was not marked running for {osClient}.");
        }

        public DosResult ReloadDiyLangRuntimeConfig(string osClient = "")
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }

            ClearSaasConfigCache(osClient);
            ClearDiyLangTranslateRuntimeState(osClient);
            return ReloadRuntimeOsClient(osClient);
        }

        public DosResult QueueDiyLangFullSyncForAllClients(bool includeClientText = true, string source = "startup")
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
            var distinctClients = osClients
                .Where(item => !IsBlank(item))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (Interlocked.Exchange(ref DiyLangAllClientSyncRunning, 1) == 1)
            {
                return new DosResult(1, distinctClients, "DiyLang all-client sync is already running.");
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    foreach (var item in distinctClients)
                    {
                        var osClient = ResolveLangSyncOsClient(item);
                        if (IsBlank(osClient) || IsDiyLangDbBackoffActive(osClient, out _))
                        {
                            continue;
                        }
                        if (!DiyLangFullSyncRunning.TryAdd(osClient, 1))
                        {
                            continue;
                        }
                        DiyLangFullSyncStartedAt[osClient] = DateTime.UtcNow;
                        try
                        {
                            await SyncDiyLangFullAsync(osClient, includeClientText, source);
                        }
                        catch (Exception ex)
                        {
                            LogDiyLangSyncException(osClient, "DiyLang all-client sync failed", ex, osClient);
                        }
                        finally
                        {
                            DiyLangFullSyncRunning.TryRemove(osClient, out _);
                            DiyLangFullSyncStartedAt.TryRemove(osClient, out _);
                        }
                    }
                }
                finally
                {
                    Interlocked.Exchange(ref DiyLangAllClientSyncRunning, 0);
                }
            });
            return new DosResult(1, distinctClients, $"DiyLang sync queued sequentially for {distinctClients.Count} tenant(s).");
        }

        private static int TokenInt(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return 0;
            }
            if (token.Type == JTokenType.Integer)
            {
                return token.Value<int>();
            }
            return int.TryParse(TokenString(token), out var value) ? value : 0;
        }

        private static int TokenInt(JObject obj, string key)
        {
            return obj == null ? 0 : TokenInt(obj[key]);
        }

        private static string NormalizeDiyLangFailureKey(string value)
        {
            value = (value ?? "").Trim();
            if (IsBlank(value))
            {
                return "Unknown";
            }
            return value.Length <= 160 ? value : value.Substring(0, 160);
        }

        private static string LimitDiyLangFailureText(string value, int maxLength = 500)
        {
            value = (value ?? "").Trim();
            if (value.Length <= maxLength)
            {
                return value;
            }
            return value.Substring(0, maxLength);
        }

        private static void AddDiyLangFailureReason(JObject stats, string reasonKey, string reasonText, string sampleKey = "", int count = 1)
        {
            if (stats == null)
            {
                return;
            }
            reasonKey = NormalizeDiyLangFailureKey(reasonKey);
            reasonText = LimitDiyLangFailureText(reasonText);
            var reasons = stats["FailureReasons"] as JArray;
            if (reasons == null)
            {
                reasons = new JArray();
                stats["FailureReasons"] = reasons;
            }
            var existing = reasons
                .OfType<JObject>()
                .FirstOrDefault(item => string.Equals(TokenString(item, "ReasonKey"), reasonKey, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                existing = new JObject()
                {
                    ["ReasonKey"] = reasonKey,
                    ["ReasonText"] = reasonText,
                    ["Count"] = 0,
                    ["Samples"] = new JArray()
                };
                reasons.Add(existing);
            }
            else if (!IsBlank(reasonText) && IsBlank(TokenString(existing, "ReasonText")))
            {
                existing["ReasonText"] = reasonText;
            }

            existing["Count"] = TokenInt(existing, "Count") + Math.Max(1, count);
            if (!IsBlank(sampleKey))
            {
                var samples = existing["Samples"] as JArray;
                if (samples == null)
                {
                    samples = new JArray();
                    existing["Samples"] = samples;
                }
                var safeSample = LimitDiyLangFailureText(sampleKey, 180);
                if (samples.Count < 20 && !samples.Any(item => string.Equals(TokenString(item), safeSample, StringComparison.OrdinalIgnoreCase)))
                {
                    samples.Add(safeSample);
                }
            }
            stats["FailureReasonCount"] = reasons.Count;
        }

        private static string BuildDiyLangFailureSummary(JObject stats)
        {
            var reasons = stats?["FailureReasons"] as JArray;
            if (reasons == null || reasons.Count == 0)
            {
                return "";
            }
            var parts = reasons
                .OfType<JObject>()
                .OrderByDescending(item => TokenInt(item, "Count"))
                .Take(5)
                .Select(item =>
                {
                    var text = TokenString(item, "ReasonText");
                    if (IsBlank(text))
                    {
                        text = TokenString(item, "ReasonKey");
                    }
                    return $"{LimitDiyLangFailureText(text, 120)}({TokenInt(item, "Count")})";
                })
                .Where(item => !IsBlank(item))
                .ToList();
            return LimitDiyLangFailureText(string.Join("；", parts), 1000);
        }

        private static void CopyLangStatsToLogRow(JObject row, JObject stats)
        {
            row["SysLangs"] = TokenString(stats, "SysLangs");
            row["LangCount"] = TokenInt(stats, "LangCount");
            row["TotalCount"] = TokenInt(stats, "TotalCount");
            row["SuccessCount"] = TokenInt(stats, "SuccessCount");
            row["FailedCount"] = TokenInt(stats, "FailedCount");
            row["SkippedCount"] = TokenInt(stats, "SkippedCount");
            row["TableCount"] = TokenInt(stats, "Tables");
            row["FieldCount"] = TokenInt(stats, "Fields");
            row["MenuCount"] = TokenInt(stats, "Menus");
            row["ClientTextCount"] = TokenInt(stats, "ClientTexts");
            row["DetailJson"] = stats?.ToString(Newtonsoft.Json.Formatting.None) ?? "{}";
        }

        private static async Task<string> CreateDiyLangInitLogAsync(string osClient, string source, JObject stats, DateTime startedAt)
        {
            if (IsBlank(osClient))
            {
                return "";
            }
            try
            {
                var logId = Guid.NewGuid().ToString();
                var startText = startedAt.ToString("yyyy-MM-dd HH:mm:ss");
                var row = new JObject()
                {
                    ["Id"] = logId,
                    ["Name"] = $"初始化多语言 {startText}",
                    ["ActionName"] = "初始化多语言",
                    ["Source"] = IsBlank(source) ? "api" : source,
                    ["Status"] = "Running",
                    ["StartTime"] = startText,
                    ["OsClient"] = osClient,
                    ["FormEngineKey"] = "mci_lang_init_log",
                    ["_InvokeType"] = "Server",
                    ["_Lang"] = "cn"
                };
                CopyLangStatsToLogRow(row, stats);
                var result = await RunDiyLangDbOperationAsync(osClient, () =>
                    MicroiEngine.FormEngine.AddFormDataAsync("mci_lang_init_log", row));
                return result.Code == 1 ? logId : "";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: create diy_lang init log failed. OsClient={osClient}, Msg={ex.Message}");
                return "";
            }
        }

        private static async Task UpdateDiyLangInitLogAsync(string osClient, string logId, string status, JObject stats, DateTime startedAt, string errorMessage)
        {
            if (IsBlank(osClient) || IsBlank(logId))
            {
                return;
            }
            try
            {
                var endedAt = DateTime.Now;
                var durationMs = Math.Min(int.MaxValue, Math.Max(0, (int)(endedAt - startedAt).TotalMilliseconds));
                var row = new JObject()
                {
                    ["Id"] = logId,
                    ["Status"] = IsBlank(status) ? "Success" : status,
                    ["DurationMs"] = durationMs,
                    ["ErrorMessage"] = errorMessage ?? "",
                    ["OsClient"] = osClient,
                    ["FormEngineKey"] = "mci_lang_init_log",
                    ["_InvokeType"] = "Server",
                    ["_Lang"] = "cn"
                };
                if (!string.Equals(TokenString(row, "Status"), "Running", StringComparison.OrdinalIgnoreCase))
                {
                    row["EndTime"] = endedAt.ToString("yyyy-MM-dd HH:mm:ss");
                }
                CopyLangStatsToLogRow(row, stats);
                await RunDiyLangDbOperationAsync(osClient, () =>
                    MicroiEngine.FormEngine.UptFormDataAsync("mci_lang_init_log", row));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: update diy_lang init log failed. OsClient={osClient}, LogId={logId}, Msg={ex.Message}");
            }
        }

        private static async Task ReportDiyLangInitProgressAsync(string osClient, string logId, JObject stats, DateTime startedAt)
        {
            if (IsBlank(logId))
            {
                return;
            }
            await UpdateDiyLangInitLogAsync(osClient, logId, "Running", stats, startedAt, "");
        }

        private static bool IsSafeSqlIdentifier(string value)
        {
            return !IsBlank(value) && value.All(ch => char.IsLetterOrDigit(ch) || ch == '_');
        }

        private static async Task ApplyDiyLangCoverageStatsAsync(string osClient, List<DiyLangFieldConfig> langConfigs, JObject stats)
        {
            var coverage = new JArray();
            var totalCount = 0;
            var successCount = 0;
            var failedCount = 0;
            try
            {
                await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    foreach (var lang in langConfigs ?? new List<DiyLangFieldConfig>())
                    {
                        var item = new JObject()
                        {
                            ["Locale"] = lang.Locale,
                            ["Field"] = lang.Field,
                            ["Label"] = lang.Label
                        };
                        if (!IsSafeSqlIdentifier(lang.Field))
                        {
                            item["Error"] = "Unsafe field name.";
                            AddDiyLangFailureReason(stats, $"UnsafeLangField:{lang.Field}", $"多语言字段[{lang.Field}]不是安全的数据库字段名。", lang.Locale);
                            coverage.Add(item);
                            continue;
                        }
                        try
                        {
                            var rows = db.FromSql($@"SELECT `Key`, ZhCN, `{lang.Field}`
                                    FROM diy_lang
                                    WHERE IsDeleted <> 1 OR IsDeleted IS NULL
                                    LIMIT 300000")
                                .ToList<dynamic>()
                                .Select(ToJObjectSafe)
                                .ToList();
                            var total = rows.Count;
                            var filled = rows.Count(row =>
                                IsFilledDiyLangValue(TokenString(row[lang.Field]), TokenString(row, "Key")));
                            var missing = Math.Max(0, total - filled);
                            item["TotalCount"] = total;
                            item["FilledCount"] = filled;
                            item["MissingCount"] = missing;
                            totalCount += total;
                            successCount += filled;
                            failedCount += missing;
                            if (missing > 0)
                            {
                                AddDiyLangFailureReason(
                                    stats,
                                    $"MissingTranslation:{lang.Locale}",
                                    $"语言[{lang.Label}]还有{missing}条词条未填充或仍为词条Key占位，通常是翻译服务不可用、目标语言不支持、任务中断或旧数据尚未初始化。",
                                    lang.Field,
                                    missing);
                            }
                        }
                        catch (Exception ex)
                        {
                            item["Error"] = ex.Message;
                            IncJObjectInt(stats, "Errors");
                            AddDiyLangFailureReason(stats, $"CoverageError:{lang.Locale}", ex.Message, lang.Field);
                        }
                        coverage.Add(item);
                    }
                    return Task.FromResult(1);
                });
            }
            catch (Exception ex)
            {
                IncJObjectInt(stats, "Errors");
                AddDiyLangFailureReason(stats, "CoverageStatsFailed", ex.Message);
                coverage.Add(new JObject()
                {
                    ["Error"] = ex.Message
                });
            }

            stats["Coverage"] = coverage;
            stats["TotalCount"] = totalCount;
            stats["SuccessCount"] = successCount;
            stats["FailedCount"] = failedCount;
            stats["SkippedCount"] = 0;
        }

        private static async Task FillMissingDiyLangTranslationsAsync(string osClient, List<DiyLangFieldConfig> langConfigs, JObject stats)
        {
            if (IsBlank(osClient) || langConfigs == null || langConfigs.Count == 0)
            {
                return;
            }
            foreach (var lang in langConfigs)
            {
                if (string.Equals(lang.Field, "ZhCN", StringComparison.OrdinalIgnoreCase)
                    || !IsSafeSqlIdentifier(lang.Field))
                {
                    continue;
                }
                try
                {
                    var rows = await RunDiyLangDbOperationAsync(osClient, () =>
                    {
                        var db = OsClientExtend.GetClient(osClient).Db;
                        var data = db.FromSql($@"SELECT Id, `Key`, ZhCN, `{lang.Field}`
                                FROM diy_lang
                                WHERE (IsDeleted <> 1 OR IsDeleted IS NULL)
                                  AND ZhCN IS NOT NULL AND ZhCN <> ''
                                LIMIT 50000")
                            .ToList<dynamic>()
                            .Select(ToJObjectSafe)
                            .ToList();
                        return Task.FromResult(data);
                    });
                    foreach (var row in rows ?? new List<JObject>())
                    {
                        var key = TokenString(row, "Key");
                        var sourceText = TokenString(row, "ZhCN");
                        if (IsBlank(key) || IsBlank(sourceText))
                        {
                            continue;
                        }
                        var currentValue = TokenString(row[lang.Field]);
                        if (IsFilledDiyLangValue(currentValue, key))
                        {
                            continue;
                        }
                        await EnsureDiyLangMetadataAsync(osClient, key, sourceText, null, true, langConfigs);
                        IncJObjectInt(stats, "MissingFilled");
                    }
                }
                catch (Exception ex)
                {
                    IncJObjectInt(stats, "Errors");
                    AddDiyLangFailureReason(stats, $"FillMissing:{lang.Locale}", ex.Message, lang.Field);
                }
            }
        }

        private static void PreflightDiyLangTranslateTargets(string osClient, List<DiyLangFieldConfig> langConfigs, JObject stats)
        {
            var providerKey = GetTranslateProviderKey(osClient);
            stats["TranslateProvider"] = providerKey;
            var targets = new JArray();
            var unsupportedCount = 0;
            foreach (var lang in langConfigs ?? new List<DiyLangFieldConfig>())
            {
                var targetLang = DiyMessage.NormalizeTranslateLang(lang.TranslateLang ?? lang.Field);
                if (targetLang == "zh" || targetLang == "cn" || targetLang == "zh-cn")
                {
                    targets.Add(new JObject()
                    {
                        ["Locale"] = lang.Locale,
                        ["Field"] = lang.Field,
                        ["Target"] = targetLang,
                        ["Status"] = "Source"
                    });
                    continue;
                }
                var item = new JObject()
                {
                    ["Locale"] = lang.Locale,
                    ["Field"] = lang.Field,
                    ["Target"] = targetLang
                };
                if (IsBlank(providerKey))
                {
                    item["Status"] = "ProviderNotConfigured";
                    item["Message"] = "Translate provider is not configured.";
                    AddDiyLangFailureReason(stats, "TranslateProviderNotConfigured", "翻译服务未配置，非中文语言只能同步词条，不能自动补齐译文。", lang.Locale);
                    unsupportedCount++;
                    targets.Add(item);
                    continue;
                }
                var unsupportedTargetKey = $"{providerKey}|{targetLang}";
                if (DiyLangTranslateUnsupportedTarget.ContainsKey(unsupportedTargetKey))
                {
                    item["Status"] = "UnsupportedCached";
                    AddDiyLangFailureReason(stats, $"TranslateTargetUnsupported:{targetLang}", $"翻译服务[{providerKey}]缓存标记不支持目标语言[{targetLang}]。", lang.Locale);
                    unsupportedCount++;
                    targets.Add(item);
                    continue;
                }
                try
                {
                    var result = TranslateWithTimeout(new TranslateParam()
                    {
                        SourceText = "\u6d4b\u8bd5",
                        Lang = targetLang,
                        FromLang = "zh",
                        OsClient = osClient
                    });
                    item["Code"] = result.Code;
                    item["Message"] = result.Msg ?? "";
                    if (result.Code == 1)
                    {
                        item["Status"] = "Supported";
                    }
                    else if (result.Code == 2 && IsUnsupportedTranslateTarget(result.Msg))
                    {
                        item["Status"] = "Unsupported";
                        DiyLangTranslateUnsupportedTarget[unsupportedTargetKey] = DateTime.UtcNow;
                        AddDiyLangFailureReason(stats, $"TranslateTargetUnsupported:{targetLang}", result.Msg, lang.Locale);
                        unsupportedCount++;
                    }
                    else
                    {
                        item["Status"] = "Unavailable";
                        MarkTranslateUnavailable(osClient, providerKey, result.Msg);
                        AddDiyLangFailureReason(stats, $"TranslateProviderUnavailable:{providerKey}", result.Msg, lang.Locale);
                        unsupportedCount++;
                    }
                }
                catch (Exception ex)
                {
                    item["Status"] = "Unavailable";
                    item["Message"] = ex.Message;
                    MarkTranslateUnavailable(osClient, providerKey, ex.Message);
                    AddDiyLangFailureReason(stats, $"TranslateProviderException:{providerKey}", ex.Message, lang.Locale);
                    unsupportedCount++;
                }
                targets.Add(item);
            }
            stats["ProviderTargets"] = targets;
            stats["UnsupportedLangCount"] = unsupportedCount;
        }

        public async Task<DosResult> RepairMissingDiyLangTranslationsAsync(string osClient = "", string source = "api")
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }
            if (IsDiyLangDbBackoffActive(osClient, out var backoffMessage))
            {
                return new DosResult(0, null, backoffMessage);
            }

            await DiyLangFullSyncSemaphore.WaitAsync();
            try
            {
                var startedAt = DateTime.Now;
                var stats = new JObject()
                {
                    ["OsClient"] = osClient,
                    ["Source"] = IsBlank(source) ? "api" : source,
                    ["Mode"] = "OnlyFillMissing",
                    ["Tables"] = 0,
                    ["Fields"] = 0,
                    ["Menus"] = 0,
                    ["ClientTexts"] = 0,
                    ["LangFields"] = "",
                    ["SysLangs"] = "",
                    ["LangCount"] = 0,
                    ["TotalCount"] = 0,
                    ["SuccessCount"] = 0,
                    ["FailedCount"] = 0,
                    ["SkippedCount"] = 0,
                    ["TreeFixed"] = 0,
                    ["MissingFilled"] = 0,
                    ["Errors"] = 0,
                    ["UnsupportedLangCount"] = 0,
                    ["FailureReasonCount"] = 0,
                    ["FailureReasons"] = new JArray()
                };
                var logId = "";
                try
                {
                    var langConfigs = await EnsureDiyLangInfrastructureAsync(osClient);
                    stats["LangFields"] = string.Join(",", langConfigs.Select(lang => lang.Field));
                    stats["SysLangs"] = string.Join(",", langConfigs.Select(lang => lang.Locale));
                    stats["LangCount"] = langConfigs.Count;
                    logId = await CreateDiyLangInitLogAsync(osClient, source, stats, startedAt);
                    PreflightDiyLangTranslateTargets(osClient, langConfigs, stats);
                    await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);
                    await FillMissingDiyLangTranslationsAsync(osClient, langConfigs, stats);
                    await ReloadDiyLangCacheAsync(osClient);
                    await NormalizeDiyLangTreeAsync(osClient, langConfigs, stats);
                    await ReloadDiyLangCacheAsync(osClient);
                    await ApplyDiyLangCoverageStatsAsync(osClient, langConfigs, stats);
                    var status = stats.Value<int>("FailedCount") > 0 || stats.Value<int>("Errors") > 0 ? "Partial" : "Success";
                    var failureSummary = status == "Success" ? "" : BuildDiyLangFailureSummary(stats);
                    await UpdateDiyLangInitLogAsync(osClient, logId, status, stats, startedAt, failureSummary);
                    return new DosResult(1, stats, "DiyLang missing translations repaired.", 0, stats);
                }
                catch (Exception ex)
                {
                    IncJObjectInt(stats, "Errors");
                    AddDiyLangFailureReason(
                        stats,
                        IsDiyLangConnectionPressureMessage(ex.Message) ? "DbConnectionPressure" : "DiyLangRepairMissingException",
                        ex.Message);
                    LogDiyLangSyncException(osClient, "DiyLang missing translation repair failed", ex, osClient);
                    if (IsBlank(logId))
                    {
                        logId = await CreateDiyLangInitLogAsync(osClient, source, stats, startedAt);
                    }
                    var failureSummary = BuildDiyLangFailureSummary(stats);
                    await UpdateDiyLangInitLogAsync(osClient, logId, "Failed", stats, startedAt, IsBlank(failureSummary) ? ex.Message : failureSummary);
                    return new DosResult(0, stats, ex.Message, 0, stats);
                }
            }
            finally
            {
                DiyLangFullSyncSemaphore.Release();
            }
        }

        private static async Task NormalizeDiyLangTreeAsync(string osClient, List<DiyLangFieldConfig> langConfigs, JObject stats)
        {
            if (IsBlank(osClient))
            {
                return;
            }
            try
            {
                var rootIds = await EnsureDiyLangTreeRootsAsync(osClient, langConfigs);
                var rows = await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var data = db.FromSql(@"SELECT Id, `Key`, ParentId
                            FROM diy_lang
                            WHERE IsDeleted <> 1 OR IsDeleted IS NULL
                            LIMIT 300000")
                        .ToList<dynamic>()
                        .Select(ToJObjectSafe)
                        .ToList();
                    return Task.FromResult(data);
                });
                if (rows == null)
                {
                    return;
                }
                foreach (var row in rows)
                {
                    var id = TokenString(row, "Id");
                    var key = TokenString(row, "Key");
                    var rootKey = ResolveDiyLangTreeRootKey(key);
                    string parentId = "";
                    if (IsBlank(id) || IsBlank(rootKey) || !rootIds.TryGetValue(rootKey, out parentId) || IsBlank(parentId))
                    {
                        continue;
                    }
                    if (string.Equals(TokenString(row, "ParentId"), parentId, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    await RunDiyLangDbOperationAsync(osClient, () =>
                    {
                        var db = OsClientExtend.GetClient(osClient).Db;
                        db.FromSql("UPDATE diy_lang SET ParentId = @p0, UpdateTime = @p1 WHERE Id = @p2")
                            .AddInParameter("p0", parentId)
                            .AddInParameter("p1", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                            .AddInParameter("p2", id)
                            .ExecuteNonQuery();
                        return Task.FromResult(1);
                    });
                    IncJObjectInt(stats, "TreeFixed");
                }
            }
            catch (Exception ex)
            {
                IncJObjectInt(stats, "Errors");
                LogDiyLangSyncException(osClient, "DiyLang tree normalize failed", ex, osClient);
            }
        }

        public async Task<DosResult> SyncDiyLangFullAsync(string osClient = "", bool includeClientText = true, string source = "api")
        {
            osClient = ResolveLangSyncOsClient(osClient);
            if (IsBlank(osClient))
            {
                return new DosResult(0, null, "OsClient is required.");
            }

            if (IsDiyLangDbBackoffActive(osClient, out var backoffMessage))
            {
                return new DosResult(0, null, backoffMessage);
            }

            await DiyLangFullSyncSemaphore.WaitAsync();
            try
            {
                var startedAt = DateTime.Now;
                var logId = "";
                var stats = new JObject()
                {
                    ["OsClient"] = osClient,
                    ["Source"] = IsBlank(source) ? "api" : source,
                    ["Tables"] = 0,
                    ["Fields"] = 0,
                    ["Menus"] = 0,
                    ["ClientTexts"] = 0,
                    ["LangFields"] = "",
                    ["SysLangs"] = "",
                    ["LangCount"] = 0,
                    ["TotalCount"] = 0,
                    ["SuccessCount"] = 0,
                    ["FailedCount"] = 0,
                    ["SkippedCount"] = 0,
                    ["TreeFixed"] = 0,
                    ["MissingFilled"] = 0,
                    ["Errors"] = 0,
                    ["UnsupportedLangCount"] = 0,
                    ["FailureReasonCount"] = 0,
                    ["FailureReasons"] = new JArray()
                };

                try
                {
                    DiyLangTreeRootIdsCache.TryRemove(IsBlank(osClient) ? "__default__" : osClient, out _);
                    var langConfigs = await EnsureDiyLangInfrastructureAsync(osClient);
                    stats["LangFields"] = string.Join(",", langConfigs.Select(lang => lang.Field));
                    stats["SysLangs"] = string.Join(",", langConfigs.Select(lang => lang.Locale));
                    stats["LangCount"] = langConfigs.Count;
                    logId = await CreateDiyLangInitLogAsync(osClient, source, stats, startedAt);
                    PreflightDiyLangTranslateTargets(osClient, langConfigs, stats);
                    await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);

                var tableRows = await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var data = db.FromSql(@"SELECT Id, Name, Description, Tabs, TableTabs
                            FROM diy_table
                            WHERE IsDeleted <> 1 OR IsDeleted IS NULL
                            LIMIT 100000")
                        .ToList<dynamic>()
                        .Select(ToJObjectSafe)
                        .ToList();
                    return Task.FromResult(data);
                });
                var tableById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (tableRows != null)
                {
                    foreach (var row in tableRows)
                    {
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
                            await EnsureDiyLangMetadataAsync(osClient, LangKeyDiyTable(tableName), description, null, true, langConfigs);
                        }
                        await SyncDiyTableTabLangRows(osClient, tableName, row, "Tabs", langConfigs);
                        await SyncDiyTableTabLangRows(osClient, tableName, row, "TableTabs", langConfigs);
                        IncJObjectInt(stats, "Tables");
                        if (stats.Value<int>("Tables") % 25 == 0)
                        {
                            await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);
                        }
                    }
                }
                await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);

                var fieldRows = await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var data = db.FromSql(@"SELECT Id, Name, Label, TableName, TableId, Config
                            FROM diy_field
                            WHERE IsDeleted <> 1 OR IsDeleted IS NULL
                            LIMIT 200000")
                        .ToList<dynamic>()
                        .Select(ToJObjectSafe)
                        .ToList();
                    return Task.FromResult(data);
                });
                if (fieldRows != null)
                {
                    foreach (var row in fieldRows)
                    {
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
                            await EnsureDiyLangMetadataAsync(osClient, LangKeyDiyField(tableName, fieldName), label, null, true, langConfigs);
                        }
                        await SyncDiyFieldTabLangRows(osClient, tableName, fieldName, row, langConfigs);
                        IncJObjectInt(stats, "Fields");
                        if (stats.Value<int>("Fields") % 100 == 0)
                        {
                            await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);
                        }
                    }
                }
                await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);

                var menuRows = await RunDiyLangDbOperationAsync(osClient, () =>
                {
                    var db = OsClientExtend.GetClient(osClient).Db;
                    var data = db.FromSql(@"SELECT Id, Name, MoreBtns, FormBtns, BatchSelectMoreBtns, PageTabs, ExportMoreBtns, PageBtns
                            FROM sys_menu
                            WHERE IsDeleted <> 1 OR IsDeleted IS NULL
                            LIMIT 100000")
                        .ToList<dynamic>()
                        .Select(ToJObjectSafe)
                        .ToList();
                    return Task.FromResult(data);
                });
                if (menuRows != null)
                {
                    foreach (var row in menuRows)
                    {
                        var menuId = TokenString(row, "Id");
                        var name = TokenString(row, "Name");
                        if (IsBlank(menuId) || IsBlank(name))
                        {
                            continue;
                        }
                        await EnsureDiyLangMetadataAsync(osClient, LangKeySysMenu(menuId), name, null, true, langConfigs);
                        await SyncSysMenuButtonLangRows(osClient, row, langConfigs);
                        IncJObjectInt(stats, "Menus");
                        if (stats.Value<int>("Menus") % 25 == 0)
                        {
                            await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);
                        }
                    }
                }
                await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);

                if (includeClientText)
                {
                    foreach (var seed in ClientLangSeeds)
                    {
                        await EnsureDiyLangMetadataAsync(osClient, seed.Key, seed.ZhCN, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                        {
                            ["En"] = seed.En,
                            ["ZhTW"] = seed.ZhTW
                        }, true, langConfigs);
                        IncJObjectInt(stats, "ClientTexts");
                        if (stats.Value<int>("ClientTexts") % 50 == 0)
                        {
                            await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);
                        }
                    }
                }

                await FillMissingDiyLangTranslationsAsync(osClient, langConfigs, stats);
                await ReportDiyLangInitProgressAsync(osClient, logId, stats, startedAt);

                await ReloadDiyLangCacheAsync(osClient);
                await NormalizeDiyLangTreeAsync(osClient, langConfigs, stats);
                await ReloadDiyLangCacheAsync(osClient);
                await ApplyDiyLangCoverageStatsAsync(osClient, langConfigs, stats);
                var status = stats.Value<int>("FailedCount") > 0 || stats.Value<int>("Errors") > 0 ? "Partial" : "Success";
                var failureSummary = status == "Success" ? "" : BuildDiyLangFailureSummary(stats);
                await UpdateDiyLangInitLogAsync(osClient, logId, status, stats, startedAt, failureSummary);

                return new DosResult(1, stats, "DiyLang sync completed.", 0, stats);
            }
            catch (Exception ex)
            {
                IncJObjectInt(stats, "Errors");
                AddDiyLangFailureReason(
                    stats,
                    IsDiyLangConnectionPressureMessage(ex.Message) ? "DbConnectionPressure" : "DiyLangFullSyncException",
                    ex.Message);
                LogDiyLangSyncException(osClient, "DiyLang full sync failed", ex, osClient);
                if (IsBlank(logId))
                {
                    logId = await CreateDiyLangInitLogAsync(osClient, source, stats, startedAt);
                }
                var failureSummary = BuildDiyLangFailureSummary(stats);
                await UpdateDiyLangInitLogAsync(osClient, logId, "Failed", stats, startedAt, IsBlank(failureSummary) ? ex.Message : failureSummary);
                return new DosResult(0, stats, ex.Message, 0, stats);
            }
            }
            finally
            {
                DiyLangFullSyncSemaphore.Release();
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
            _ = Task.Run(async () =>
            {
                try
                {
                    if (!shouldRemove)
                    {
                        await Task.Delay(800);
                    }
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

        private static async Task ReloadDiyLangCacheAsync(string osClient)
        {
            if (IsBlank(osClient))
            {
                return;
            }
            try
            {
                var result = await RunDiyLangDbOperationAsync(osClient, () =>
                    MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_lang", new
                    {
                        OsClient = osClient,
                        _InvokeType = "Server",
                        _Lang = "cn",
                        _PageIndex = 1,
                        _PageSize = 200000
                    }));
                if (result.Code != 1 || result.Data == null)
                {
                    return;
                }
                var rows = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                foreach (var item in result.Data)
                {
                    var row = ToJObjectSafe(item);
                    var key = TokenString(row, "Key");
                    if (!IsBlank(key))
                    {
                        rows[key] = row;
                    }
                }
                lock (DiyLangCacheLock)
                {
                    DiyMessage.Msg[osClient] = rows;
                    DiyMessage.ClearSourceTextCache(osClient);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Reload diy_lang cache failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        protected void AfterMetadataFormDataSaved(DiyTableRowParam param, DosResult result, DbTrans trans)
        {
            if (param == null || result == null || result.Code != 1)
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
                MicroiEngine.CacheTenant.Default().Remove($"Microi:{configOsClient}:saas-engine:{osClient.DosToLower()}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Clear SaaS config cache failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        private static void ClearDiyLangTranslateRuntimeState(string osClient)
        {
            if (!IsBlank(osClient))
            {
                foreach (var key in DiyLangTranslateUnavailable.Keys.ToList())
                {
                    if (key.StartsWith($"{osClient}|", StringComparison.OrdinalIgnoreCase))
                    {
                        DiyLangTranslateUnavailable.TryRemove(key, out _);
                    }
                }
                DiyLangTreeRootIdsCache.TryRemove(osClient, out _);
                DiyLangSchemaEnsured.TryRemove(osClient, out _);
                DiyLangPhysicalColumnsCache.TryRemove($"{osClient}|diy_lang", out _);
            }

            foreach (var key in DiyLangTranslateUnsupportedTarget.Keys.ToList())
            {
                DiyLangTranslateUnsupportedTarget.TryRemove(key, out _);
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
            JObject paramRow = null;
            if (param?._RowModel != null)
            {
                paramRow = CloneJObject(param._RowModel);
            }
            else if (param != null)
            {
                paramRow = JObject.FromObject(param);
            }

            if (result.Data != null)
            {
                try
                {
                    var resultRow = ToJObjectSafe(result.Data);
                    if (paramRow != null)
                    {
                        foreach (var property in paramRow.Properties())
                        {
                            if (resultRow[property.Name] == null)
                            {
                                resultRow[property.Name] = property.Value.DeepClone();
                            }
                        }
                    }
                    return resultRow;
                }
                catch
                {
                }
            }
            return paramRow ?? new JObject();
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
            if (IsDiyLangPlaceholderValue(value))
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

        private static bool IsFilledDiyLangValue(string value, string key = "")
        {
            return !IsBlank(value) && !IsDiyLangPlaceholderValue(value, key);
        }

        private static bool IsDiyLangPlaceholderValue(string value, string key = "")
        {
            value = (value ?? "").Trim();
            if (IsBlank(value))
            {
                return false;
            }
            if (!IsBlank(key) && string.Equals(value, key, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            var lower = value.ToLowerInvariant();
            return lower.StartsWith("diy_table:", StringComparison.Ordinal)
                || lower.StartsWith("diy_field:", StringComparison.Ordinal)
                || lower.StartsWith("sys_menu:", StringComparison.Ordinal)
                || lower.StartsWith("msg.", StringComparison.Ordinal)
                || lower.StartsWith("data.", StringComparison.Ordinal);
        }

        private static void QueueDiyLangMetadataSyncStatic(string osClient, string key, string sourceText)
        {
            if (IsBlank(osClient) || IsBlank(key) || IsBlank(sourceText))
            {
                return;
            }
            if (DiyLangFullSyncRunning.ContainsKey(osClient)
                || DiyLangMetadataSyncQueued.Count >= DiyLangMetadataQueueMax
                || IsDiyLangDbBackoffActive(osClient, out _))
            {
                return;
            }
            var queueKey = $"{osClient}|{key}|{sourceText}";
            if (!DiyLangMetadataSyncQueued.TryAdd(queueKey, 1))
            {
                return;
            }
            var tenantKey = IsBlank(osClient) ? "__default__" : osClient;
            var queue = DiyLangMetadataQueues.GetOrAdd(tenantKey, _ => new ConcurrentQueue<DiyLangMetadataQueueItem>());
            queue.Enqueue(new DiyLangMetadataQueueItem
            {
                QueueKey = queueKey,
                OsClient = osClient,
                Key = key,
                SourceText = sourceText
            });

            if (DiyLangMetadataQueueWorkers.TryAdd(tenantKey, 1))
            {
                _ = Task.Run(() => DrainDiyLangMetadataQueueAsync(tenantKey));
            }
        }

        private static async Task DrainDiyLangMetadataQueueAsync(string tenantKey)
        {
            var osClient = tenantKey == "__default__" ? "" : tenantKey;
            try
            {
                var queue = DiyLangMetadataQueues.GetOrAdd(tenantKey, _ => new ConcurrentQueue<DiyLangMetadataQueueItem>());
                while (queue.TryDequeue(out var item))
                {
                    try
                    {
                        if (IsDiyLangDbBackoffActive(item.OsClient, out _))
                        {
                            return;
                        }
                        await EnsureDiyLangMetadataAsync(item.OsClient, item.Key, item.SourceText);
                    }
                    catch (Exception ex)
                    {
                        LogDiyLangSyncException(item.OsClient, "DiyLang metadata sync failed", ex, item.Key);
                    }
                    finally
                    {
                        DiyLangMetadataSyncQueued.TryRemove(item.QueueKey, out _);
                    }

                    if (DiyLangDbOperationDelayMs > 0)
                    {
                        await Task.Delay(DiyLangDbOperationDelayMs);
                    }
                }
            }
            finally
            {
                DiyLangMetadataQueueWorkers.TryRemove(tenantKey, out _);
                if (DiyLangMetadataQueues.TryGetValue(tenantKey, out var queue) && !queue.IsEmpty
                    && DiyLangMetadataQueueWorkers.TryAdd(tenantKey, 1))
                {
                    _ = Task.Run(() => DrainDiyLangMetadataQueueAsync(tenantKey));
                }
            }
        }

        private void QueueDiyLangMetadataSync(string osClient, string key, string sourceText)
        {
            QueueDiyLangMetadataSyncStatic(osClient, key, sourceText);
        }

        private static async Task<DosResult> EnsureDiyLangMetadataAsync(
            string osClient,
            string key,
            string sourceText,
            IDictionary<string, string> fixedTranslations = null,
            bool autoTranslate = true,
            List<DiyLangFieldConfig> langConfigs = null,
            bool ensureTreeParent = true)
        {
            langConfigs = langConfigs ?? await EnsureDiyLangInfrastructureAsync(osClient);
            JObject row = await GetDiyLangRowByKeyDirectAsync(osClient, key) ?? new JObject();
            var isNew = IsBlank(TokenString(row, "Id"));
            var changed = isNew;
            row["Key"] = key;
            row["OsClient"] = osClient;
            row["FormEngineKey"] = "diy_lang";
            row["_InvokeType"] = "Server";
            row["_Lang"] = "cn";
            if (ensureTreeParent)
            {
                var rootKey = ResolveDiyLangTreeRootKey(key);
                if (!IsBlank(rootKey))
                {
                    var rootIds = await EnsureDiyLangTreeRootsAsync(osClient, langConfigs);
                    if (rootIds.TryGetValue(rootKey, out var parentId)
                        && !IsBlank(parentId)
                        && !string.Equals(TokenString(row, "ParentId"), parentId, StringComparison.OrdinalIgnoreCase))
                    {
                        row["ParentId"] = parentId;
                        changed = true;
                    }
                }
            }
            if (IsBlank(TokenString(row, "Code")))
            {
                row["Code"] = key;
                changed = true;
            }
            if (IsBlank(TokenString(row, "ZhCN")) || IsDiyLangPlaceholderValue(TokenString(row, "ZhCN"), key))
            {
                row["ZhCN"] = sourceText;
                changed = true;
            }

            foreach (var langField in langConfigs.Select(lang => lang.Field))
            {
                if (langField.Equals("ZhCN", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                var currentValue = TokenString(row[langField]);
                if (!IsBlank(currentValue) && !IsDiyLangPlaceholderValue(currentValue, key))
                {
                    continue;
                }
                if (!IsBlank(currentValue))
                {
                    row[langField] = "";
                    changed = true;
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
                if (IsBlank(translated))
                {
                    translated = GetExistingMetadataTranslation(osClient, sourceText, langField);
                }
                if (IsBlank(translated) && autoTranslate)
                {
                    translated = TranslateForDiyLangField(sourceText, langField, osClient);
                }
                if (!IsBlank(translated))
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
                saveResult = await SaveDiyLangRowDirectAsync(osClient, row, true, langConfigs);
            }
            else
            {
                saveResult = await SaveDiyLangRowDirectAsync(osClient, row, false, langConfigs);
            }

            if (saveResult.Code == 1)
            {
                UpsertLangCache(osClient, row);
            }
            saveResult.DataAppend = new { IsNew = isNew, Changed = true };
            return saveResult;
        }

        private static async Task<JObject> GetDiyLangRowByKeyDirectAsync(string osClient, string key)
        {
            if (IsBlank(osClient) || IsBlank(key))
            {
                return null;
            }
            return await RunDiyLangDbOperationAsync(osClient, () =>
            {
                var db = OsClientExtend.GetClient(osClient).Db;
                var row = db.FromSql(@"SELECT *
                        FROM diy_lang
                        WHERE `Key` = @p0 AND (IsDeleted <> 1 OR IsDeleted IS NULL)
                        ORDER BY CreateTime DESC
                        LIMIT 1")
                    .AddInParameter("p0", key)
                    .ToList<dynamic>()
                    .Select(ToJObjectSafe)
                    .FirstOrDefault();
                return Task.FromResult(row);
            });
        }

        private static async Task<DosResult> SaveDiyLangRowDirectAsync(string osClient, JObject row, bool isNew, List<DiyLangFieldConfig> langConfigs)
        {
            if (row == null)
            {
                return new DosResult(0, null, "diy_lang row is required.");
            }
            return await RunDiyLangDbOperationAsync(osClient, () =>
            {
                var db = OsClientExtend.GetClient(osClient).Db;
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                if (isNew && IsBlank(TokenString(row, "Id")))
                {
                    row["Id"] = Guid.NewGuid().ToString();
                }
                row["OsClient"] = osClient;
                row["UpdateTime"] = now;
                if (isNew)
                {
                    row["CreateTime"] = now;
                }

                var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Id", "Key", "Code", "Name", "ParentId", "OsClient", "CreateTime", "UpdateTime", "ZhCN"
                };
                foreach (var lang in langConfigs ?? new List<DiyLangFieldConfig>())
                {
                    if (IsSafeSqlIdentifier(lang.Field))
                    {
                        allowed.Add(lang.Field);
                    }
                }
                var physicalColumns = GetPhysicalColumnNames(db, osClient, "diy_lang");

                var values = row.Properties()
                    .Where(prop => allowed.Contains(prop.Name)
                                   && IsSafeSqlIdentifier(prop.Name)
                                   && (physicalColumns == null || physicalColumns.Contains(prop.Name)))
                    .ToList();
                if (values.Count == 0)
                {
                    return Task.FromResult(new DosResult(0, row, "No writable diy_lang columns were found."));
                }
                if (isNew)
                {
                    var columns = values.Select(prop => $"`{prop.Name}`").ToList();
                    var parameters = values.Select((prop, index) => $"@p{index}").ToList();
                    var cmd = db.FromSql($"INSERT INTO diy_lang ({string.Join(",", columns)}) VALUES ({string.Join(",", parameters)})");
                    for (var i = 0; i < values.Count; i++)
                    {
                        cmd.AddInParameter($"p{i}", TokenString(values[i].Value));
                    }
                    cmd.ExecuteNonQuery();
                }
                else
                {
                    var id = TokenString(row, "Id");
                    if (IsBlank(id))
                    {
                        return Task.FromResult(new DosResult(0, row, "diy_lang row Id is required for update."));
                    }
                    var updateValues = values
                        .Where(prop => !string.Equals(prop.Name, "Id", StringComparison.OrdinalIgnoreCase)
                                       && !string.Equals(prop.Name, "CreateTime", StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    var setters = updateValues.Select((prop, index) => $"`{prop.Name}` = @p{index}").ToList();
                    var cmd = db.FromSql($"UPDATE diy_lang SET {string.Join(",", setters)} WHERE Id = @p{updateValues.Count}");
                    for (var i = 0; i < updateValues.Count; i++)
                    {
                        cmd.AddInParameter($"p{i}", TokenString(updateValues[i].Value));
                    }
                    cmd.AddInParameter($"p{updateValues.Count}", id);
                    cmd.ExecuteNonQuery();
                }
                return Task.FromResult(new DosResult(1, row, isNew ? "Added." : "Updated."));
            });
        }

        private static string GetExistingMetadataTranslation(string osClient, string sourceText, string langField)
        {
            if (IsBlank(osClient) || IsBlank(sourceText) || IsBlank(langField))
            {
                return "";
            }
            if (DiyMessage.TryGetLangBySourceText(osClient, sourceText, langField, out var value)
                && IsUsableMetadataTranslation(value, sourceText))
            {
                return value;
            }
            return "";
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
                var result = TranslateWithTimeout(new TranslateParam()
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

        private static DosResult TranslateWithTimeout(TranslateParam param)
        {
            if (!DiyLangTranslateSemaphore.Wait(TimeSpan.FromSeconds(2)))
            {
                return new DosResult(0, null, "Translate queue is busy.");
            }
            var releaseOnExit = true;
            try
            {
                var task = Task.Run(() => MicroiEngine.Translate.Translate(param));
                if (!task.Wait(TimeSpan.FromSeconds(DiyLangTranslateTimeoutSeconds)))
                {
                    releaseOnExit = false;
                    task.ContinueWith(_ => DiyLangTranslateSemaphore.Release());
                    return new DosResult(0, null, $"Translate timeout after {DiyLangTranslateTimeoutSeconds}s.");
                }
                return task.Result ?? new DosResult(0, null, "Translate returned empty result.");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
            finally
            {
                if (releaseOnExit)
                {
                    DiyLangTranslateSemaphore.Release();
                }
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
            var apiKey = TokenString(config["TranslateApiKey"]);
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
            url = NormalizeTranslateServiceUrl(url);
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
                if (IsBlank(apiKey))
                {
                    apiKey = key;
                }
                return IsBlank(url) ? "" : $"{provider}:{url}:{apiKey}";
            }
            return IsBlank(endpoint) || IsBlank(key) || IsBlank(secret)
                ? ""
                : $"{provider}:{endpoint}:{key}";
        }

        private static string NormalizeTranslateServiceUrl(string url)
        {
            if (IsBlank(url))
            {
                return "";
            }
            var normalized = url.Trim().TrimEnd('/');
            return normalized.EndsWith("/translate", StringComparison.OrdinalIgnoreCase)
                ? normalized
                : normalized + "/translate";
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

        private async Task SyncDiyTableTabLangRows(string osClient, string tableName, JObject row, string fieldName, List<DiyLangFieldConfig> langConfigs = null)
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
                    LangKeyDiyTableTab(tableName, fieldName, GetNamedItemKey(tab, i)), text, null, true, langConfigs);
            }
        }

        private async Task SyncDiyFieldTabLangRows(string osClient, string tableName, string fieldName, JObject row, List<DiyLangFieldConfig> langConfigs = null)
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
                    LangKeyDiyFieldTab(tableName, fieldName, GetNamedItemKey(tab, i)), text, null, true, langConfigs);
            }
        }

        private async Task SyncSysMenuButtonLangRows(string osClient, JObject row, List<DiyLangFieldConfig> langConfigs = null)
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
                    await EnsureDiyLangMetadataAsync(osClient, LangKeySysMenuButton(menuId, fieldName, buttonKey), name, null, true, langConfigs);
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

