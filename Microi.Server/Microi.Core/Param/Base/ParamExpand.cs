#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) 道斯软件
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2016/09/10 14:08:52
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;

//using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class DiyDocumentParam : BaseParam //DiyBaseParam
    {
        public string Title { get; set; }
        public string ParentId { get; set; }
        public string ParentIds { get; set; }
        public int? Display { get; set; }
        public int? IsDeleted { get; set; }
    }

    public partial class SysLogParam : BaseParam
    {
        /// <summary>全局唯一事件Id，用于异步重放时幂等去重。</summary>
        public string EventId { get; set; }
        /// <summary>登录会话Id（通常为服务端Token摘要或终端会话Id，不保存原始Token）。</summary>
        public string SessionId { get; set; }
        /// <summary>行为大类，例如 Navigation/Data/Session/File/Security。</summary>
        public string Category { get; set; }
        /// <summary>结构化行为，例如 MenuVisit/DataUpdate/PrivateFileOpen。</summary>
        public string Action { get; set; }
        /// <summary>可信事件来源，例如 Server/ClientSignal/TokenLifecycle。</summary>
        public string Source { get; set; }
        public string ClientType { get; set; }
        public string Did { get; set; }
        public string TargetType { get; set; }
        public string TargetId { get; set; }
        public long? DurationSeconds { get; set; }
        public bool? Success { get; set; }
        public string TraceId { get; set; }
        /// <summary>W3C SpanId（16位十六进制）。</summary>
        public string SpanId { get; set; }
        /// <summary>父级 W3C SpanId；根 Span 为空。</summary>
        public string ParentSpanId { get; set; }
        /// <summary>W3C TraceFlags，例如 01 表示 sampled。</summary>
        public string TraceFlags { get; set; }
        /// <summary>产生该日志的逻辑服务名。</summary>
        public string ServiceName { get; set; }
        public string ServiceVersion { get; set; }
        /// <summary>运行节点标识，只用于诊断，不能作为全局事实源。</summary>
        public string NodeId { get; set; }
        public string Environment { get; set; }
        public double? DurationMs { get; set; }
        public int? HttpStatusCode { get; set; }
        /// <summary>行为实际发生时间。异步重试时不得改成重试时间。</summary>
        public DateTime? OccurredAt { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string AppId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Api { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Param { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Type { get; set; }
        public string UserId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string UserName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Title { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Content { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string IP { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Mac { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string OtherInfo { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _SearchMonth { get; set; }
        public int? Timer { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Result { get; set; }
    }

    /// <summary>按 W3C TraceId 查询跨月系统日志时间线。</summary>
    public sealed class SysLogTraceQueryParam
    {
        public string OsClient { get; set; }
        public string TraceId { get; set; }
        public string SearchMonth { get; set; }
        public int PageSize { get; set; } = 200;
    }

    /// <summary>受限的系统日志窗口信号查询，只返回聚合值和少量净化样例。</summary>
    public sealed class SysLogSignalQueryParam
    {
        public string OsClient { get; set; }
        public DateTime WindowStart { get; set; }
        public DateTime WindowEnd { get; set; }
        public string Keyword { get; set; }
        public string Type { get; set; }
        public string Category { get; set; }
        public string Source { get; set; }
        public string ServiceName { get; set; }
        public int? LevelMin { get; set; }
        public int MaxDurationSamples { get; set; } = 10000;
        public int MaxEventSamples { get; set; } = 5;
    }

    public sealed class SysLogSignalSample
    {
        public string EventId { get; set; }
        public string TraceId { get; set; }
        public string ServiceName { get; set; }
        public string Type { get; set; }
        public string Title { get; set; }
        public int? Level { get; set; }
        public bool? Success { get; set; }
        public int? HttpStatusCode { get; set; }
        public DateTime CreateTime { get; set; }
    }

    public sealed class SysLogSignalResult
    {
        public long TotalCount { get; set; }
        public long ErrorCount { get; set; }
        public double ErrorRate { get; set; }
        public double P95DurationMs { get; set; }
        public int DurationSampleCount { get; set; }
        public bool DurationSampled { get; set; }
        public DateTime? LastSeenTime { get; set; }
        public List<string> MonthsScanned { get; set; } = new List<string>();
        public List<SysLogSignalSample> Samples { get; set; } = new List<SysLogSignalSample>();
    }

    /// <summary>系统日志生命周期的可信物理执行参数。</summary>
    public class SysLogLifecycleParam
    {
        public string OsClient { get; set; }
        public DateTime CutoffTime { get; set; }
        public string Type { get; set; }
        public string Category { get; set; }
        public string Source { get; set; }
        public int MaxCollections { get; set; } = 120;
        public int BatchSize { get; set; } = 200;
        public string SearchMonth { get; set; }
        public string PolicyKey { get; set; }
        public string RunKey { get; set; }
        public string ArchiveMode { get; set; }
        public string BackgroundTaskId { get; set; }
        public long FencingToken { get; set; }
    }

    public sealed class SysLogLifecycleCollectionPlan
    {
        public string SearchMonth { get; set; }
        public long EstimatedCount { get; set; }
    }

    public sealed class SysLogLifecyclePlan
    {
        public DateTime CutoffTime { get; set; }
        public long EstimatedCount { get; set; }
        public List<SysLogLifecycleCollectionPlan> Collections { get; set; } = new List<SysLogLifecycleCollectionPlan>();
    }

    public sealed class SysLogLifecycleBatch
    {
        public string SearchMonth { get; set; }
        public string NextSearchMonth { get; set; }
        public bool HasMore { get; set; }
        public List<SysLog> Items { get; set; } = new List<SysLog>();
    }

    public sealed class SysLogLifecycleCommitParam : SysLogLifecycleParam
    {
        public List<string> EventIds { get; set; } = new List<string>();
        public string ArchivePath { get; set; }
        public string ArchiveProofHash { get; set; }
        public long ScannedCount { get; set; }
        public long ArchivedCount { get; set; }
    }

    public sealed class SysLogLifecycleRunState
    {
        public long Scanned { get; set; }
        public long Archived { get; set; }
        public long Deleted { get; set; }
        public string LastArchivePath { get; set; }
        public string LastArchiveProofHash { get; set; }
    }
    /// <summary>
    /// 接口引擎调用次数统计参数
    /// </summary>
    public class ApiCallCountParam : BaseParam
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ApiEngineKey { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        // public int? _Top { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public partial class DiyTableParam : BaseParam
    {
        public bool? _OnlyCreateTable { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DataBaseId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DataBaseName { get; set; }
        public DiyTableParam()
        {
        }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TreeHasChildren { get; set; }
        public int? TreeLazy { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TreeParentField { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TreeParentFields { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ServerDataV8 { get; set; }
        /// <summary>
        /// Whether backend table V8 events use process-resident-memory protection
        /// instead of configurable per-execution Jint limits.
        /// </summary>
        public int? V8Unlimited { get; set; }

        public List<string> Ids { get; set; }
        /// <summary>
        /// 是否真实创建表
        /// </summary>
        public bool? _IsCreateTable { get; set; }
        /// <summary>
        /// 是否匿名请求
        /// </summary>

        public bool? _IsAnonymous { get; set; }
        public int? IsAnonymousRead { get; set; }
        public int? IsAnonymousAdd { get; set; }
        /// <summary>
        /// ["A.Id as AID", "A.Name as AName"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendSelect { get; set; }
        /// <summary>
        /// ["AND A.Id=1", "OR A.Name=2"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendWhere { get; set; }

        /// <summary>
        /// ["A.Id as AID", "A.Name as AName"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendHavingSelect { get; set; }
        /// <summary>
        /// ["AND A.Id=1", "OR A.Name=2"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendHaving { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SubmitFormV8 { get; set; }
        public int? DataEncryptSave { get; set; }
        public int? DataEncryptTransfer { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string CacheParentKey { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ApiReplace { get; set; }
        public int? EnableCache { get; set; }


        public string ParentId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DelCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string UptCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string AddCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string BindRole { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string InputBorderStyle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormOpenWidth { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string OutFormV8 { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string InFormV8 { get; set; }
        //[DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _SysMenuId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Sql { get; set; }

        public int? Unique { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FieldBorder { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormLabelPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormOpenType { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormArticle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableArticle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableTabsPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableTabs { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TabsPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Tabs { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string OldTableName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> Names { get; set; }
        public string TableId { get; set; }
        public string UserId { get; set; }
        public int? IsDeleted { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Description { get; set; }
        public int? IsTree { get; set; }
        public int? Column { get; set; }
        public int? TableInEdit { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string RowAction { get; set; }

        /// <summary>
        /// 表单数据（使用JObject以避免序列化类型丢失，支持动态字段访问）
        /// </summary>
        private JObject _rowModel = null;
        public JObject _RowModel
        {
            get
            {
                return _rowModel;
            }
            set
            {
                _rowModel = value;
            }
        }
        public JObject _FormData
        {
            get
            {
                return _rowModel;
            }
            set
            {
                _rowModel = value;
            }
        }

        public List<DiyTableParam> _List { get; set; }
        public string _TableRowId { get; set; }
        public List<string> _TableRowIds { get; set; }
        public string _FieldId { get; set; }

        /// <summary>
        /// 索引名称
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string IndexName { get; set; }
        /// <summary>
        /// 索引字段（逗号分隔）
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string IndexColumns { get; set; }
        /// <summary>
        /// 是否唯一索引
        /// </summary>
        public bool? IndexUnique { get; set; }
    }
    /// <summary>
    /// 2021-11-01新增：Id的类型从string修改为String，为了兼容非string的老数据库
    /// </summary>
    public partial class DiyTableRowParam : BaseParam
    {
        /// <summary>
        /// Internal legacy-client authorization scope inferred from the user's
        /// granted menus. It is intentionally separate from _SysMenuId so a fallback
        /// does not apply presentation settings such as SelectFields or sorting.
        /// </summary>
        [JsonIgnore]
        public FormEngineAuthorizationPolicy _AuthorizationPolicy { get; set; }

        /// <summary>
        /// Server-only marker used by an internal row-scope probe. Trusted calls
        /// normally discard any policy left on a reused request object; this marker
        /// allows the probe to carry a freshly constructed policy into its final
        /// SELECT. JsonIgnore prevents an HTTP caller from preserving or supplying
        /// an authorization policy.
        /// </summary>
        [JsonIgnore]
        public bool _PreserveAuthorizationPolicyForRead { get; set; }

        /// <summary>
        /// Per-request memoization for the shared authorization snapshot. This avoids
        /// a second Redis/version lookup when metadata authorization falls back from
        /// direct table access to a menu/JoinTables metadata check.
        /// </summary>
        [JsonIgnore]
        public FormEngineAuthorizationSnapshot _AuthorizationSnapshot { get; set; }

        /// <summary>
        /// Server-only projection marker set after an ordinary role is authorized
        /// to read sys_user. Query builders use it to remove password storage fields
        /// even when a legacy menu SelectFields list contains them.
        /// </summary>
        [JsonIgnore]
        public bool _RedactSysUserSensitiveFields { get; set; }

        public List<dynamic> ExcelData { get; set; }
        public List<JObject> ExcelHeader { get; set; }
        public List<ExcelSheetParam> ExcelSheets { get; set; }
        public List<ExcelSheetParam> Sheets { get; set; }
        public OfficeExcelExportOptionsParam ExcelOptions { get; set; }
        public OfficeExcelLayoutParam ExcelLayout { get; set; }
        public int? _TreeLazy { get; set; }
        /// <summary>
        /// 动态加载时传入的父级值，用于加载指定父节点的子级数据
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _ParentValue { get; set; }
        /// <summary>
        /// 数据日志
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _DataLog { get; set; }
        public bool? _NoLineForAdd { get; set; }
        public bool? _OnlyDataCount { get; set; }

        private string _formEngineKey = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormEngineKey
        {
            get
            {
                return _formEngineKey;
            }
            set
            {
                _formEngineKey = value;
            }
        }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FormEngineKey
        {
            get
            {
                return _formEngineKey;
            }
            set
            {
                _formEngineKey = value;
            }
        }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Token { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Authorization { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Query { get; set; }
        public bool? _IsTree { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ModuleEngineKey { get; set; }
        public List<string> _NotSaveField { get; set; }

        /// <summary>
        /// 是否真实创建表
        /// </summary>
        public bool? _IsCreateTable { get; set; }
        /// <summary>
        /// 是否匿名请求
        /// </summary>

        public bool? _IsAnonymous { get; set; }
        public bool? _IsAnonymousRead { get; set; }
        public bool? _IsAnonymousAdd { get; set; }
        /// <summary>
        /// ["A.Id as AID", "A.Name as AName"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendSelect { get; set; }
        /// <summary>
        /// ["AND A.Id=1", "OR A.Name=2"]
        /// </summary>
        // [DisplayFormat(ConvertEmptyStringToNull = false)]
        // public List<string> _AppendWhere { get; set; }

        /// <summary>
        /// ["A.Id as AID", "A.Name as AName"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendHavingSelect { get; set; }
        /// <summary>
        /// ["AND A.Id=1", "OR A.Name=2"]
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _AppendHaving { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _SubmitFormV8 { get; set; }
        public bool? _DataEncryptSave { get; set; }
        public bool? _DataEncryptTransfer { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _CacheParentKey { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _ApiReplace { get; set; }
        public bool? _EnableCache { get; set; }


        public string _ParentId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _DelCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _UptCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _AddCallbakApi { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _BindRole { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _InputBorderStyle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FormOpenWidth { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _OutFormV8 { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _InFormV8 { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _SysMenuId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Sql { get; set; }
        public bool? _Unique { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FieldBorder { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FormLabelPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FormOpenType { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FormArticle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableArticle { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableTabsPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableTabs { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TabsPosition { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Tabs { get; set; }

        private string __tableName = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableName
        {
            get
            {
                return __tableName;
            }
            set
            {
                __tableName = value;
            }
        }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableName
        {
            get
            {
                return __tableName;
            }
            set
            {
                __tableName = value;
            }
        }

        //[DisplayFormat(ConvertEmptyStringToNull = false)]
        //public string TableName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> _Names { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableId
        {
            get
            {
                return __tableId;
            }
            set
            {
                __tableId = value;
            }
        }

        private string __tableId = "";

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableId
        {
            get
            {
                return __tableId;
            }
            set
            {
                __tableId = value;
            }
        }

        public string _UserId { get; set; }
        /// <summary>
        /// true：已删除
        /// false、null：未删除（默认）
        /// </summary>
        public int? IsDeleted { get; set; }
        /// <summary>
        /// 若传入true，无视IsDeleted参数，返回已删除+未删除的数据
        /// </summary>
        public bool? _IsContainDeleted { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _Description { get; set; }
        public int? _Column { get; set; }
        public bool? _TableInEdit { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _RowAction { get; set; }
        public bool? _ForceUpt { get; set; }
        public bool? _IsTrashRestore { get; set; }

        /// <summary>
        /// 表单数据（使用JObject以避免序列化类型丢失，支持动态字段访问）
        /// </summary>
        private JObject _rowModel = null;

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public JObject _RowModel
        {
            get
            {
                return _rowModel;
            }
            set
            {
                _rowModel = value;
            }
        }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public JObject _FormData
        {
            get
            {
                return _rowModel;
            }
            set
            {
                _rowModel = value;
            }
        }
        public List<DiyTableRowParam> _List { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _TableRowId { get; set; }
        public List<string> _TableRowIds { get; set; }
        public List<string> Ids { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FieldId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _FieldName { get; set; }
        /// <summary>
        /// TableChild 聚合授权上下文。客户端只能提供关系线索；后端必须逐层
        /// 回查 diy_field/sys_menu 并验证父记录范围，不能直接信任此对象。
        /// Parent 用于嵌套子表，服务端会限制最大深度并检测关系环。
        /// </summary>
        public TableChildAuthorizationContext _TableChildAuth { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormEngineFieldKey { get; set; }
        public List<string> FormEngineFieldKeys { get; set; }
        public List<string> FieldIds { get; set; }
    }

    public sealed class TableChildAuthorizationContext
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentSysMenuId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentTableId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentFieldId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentRowId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentValue { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentFormMode { get; set; }
        public TableChildAuthorizationContext Parent { get; set; }
    }

    public class ExcelSheetParam : DiyTableRowParam
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SheetName { get; set; }
    }
    public partial class DiyFieldParam : BaseParam
    {
        [JsonIgnore]
        public dynamic _DiyTableModel { get; set; }
        /// <summary>
        /// TableChild 聚合授权上下文。字段元数据接口与数据接口必须使用
        /// 同一份委托授权链，避免子表字段列表因模型绑定丢参而被误拒绝。
        /// </summary>
        public TableChildAuthorizationContext _TableChildAuth { get; set; }
        public bool? _NotAddDbField { get; set; }
        public int? Encrypt { get; set; }
        public string SysMenuId { get; set; }
        public string Placeholder { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<string> TableNames { get; set; }
        public int? IsLockField { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string KeyupV8Code { get; set; }
        public int? InTableEdit { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DataAppend { get; set; }


        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string V8TmpEngineForm { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string V8TmpEngineTable { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string BindRole { get; set; }
        public bool? _OnlyRealField { get; set; }
        public bool? _OnlyCreateField { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public int? NameConfirm { get; set; }
        public string _SysMenuId { get; set; }
        public string _ModuleEngineKey { get; set; }
        public List<string> Ids { get; set; }
        public int? Unique { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public List<JObject> FieldList { get; set; }
        public string _FieldList { get; set; }


        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Data { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Config { get; set; }
        public int? FormWidth { get; set; }
        public int? TableWidth { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DefaultValue { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Type { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableId { get; set; }

        public List<string> TableIds { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Label { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Code { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Component { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Description { get; set; }
        public int? NotEmpty { get; set; }
        public int? Visible { get; set; }
        public int? AppVisible { get; set; }
        public int? Readonly { get; set; }
        public string UserId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Tab { get; set; }
        public int? Sort { get; set; }
        public int? IsDeleted { get; set; }


    }
    public partial class SysMenuParam : BaseParam
    {
        public string _ChildSystemId { get; set; }
        public bool? _All { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ModuleEngineKey { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string RoleGroup { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string JoinTables { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SelectFields { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string FormBtns { get; set; }
        public bool? IsMicroiService { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string EnName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string EnDescription { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableHeaders { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string InTableEditFields { get; set; }
        public bool? InTableEdit { get; set; }


        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Link { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ImportTemplateName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ExportMoreBtns { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DetailPageV8 { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string BatchSelectMoreBtns { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string PageBtns { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string PageTabs { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ImportTemplate { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string MoreBtns { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ImportV8 { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ExportV8 { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SqlJoin { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string NotShowFields { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DefaultOrderBy { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string StatisticsFields { get; set; }

        public int? IsDeleted { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SearchFieldIds { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        // Legacy compatibility only. New module configuration uses physical columns.
        public string DiyConfig { get; set; }
        public int? MenuBadgeEnabled { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string MenuBadgeApiEngineKey { get; set; }
        public int? EnableViewSchema { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ViewSchemaVersion { get; set; }
        public int? ViewConfigVersion { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ViewSchema { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SortFieldIds { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SqlWhere { get; set; }
        public string StoreId { get; set; }

        //public bool? _OnlyShop { get; set; }
        //public bool? _OnlyQds { get; set; }
        //public bool? _NotTzy { get; set; }
        public string UserId { get; set; }
        //public SysUser _SysUser { get; set; }
        public List<string> Ids { get; set; }
        public int? Sort { get; set; }
        public string ParentId { get; set; }
        public string SysUserId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Url { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Icon { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Type { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Code { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Class { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string IconClass { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string OpenType { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ComponentName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ComponentPath { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string JquerySelector { get; set; }
        public int? MultRun { get; set; }
        public int? Display { get; set; }
        public int? AppDisplay { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Description { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string PageTemplate { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TableDiyFieldIds { get; set; }
        public string DiyTableId { get; set; }
    }
    public partial class SysBaseDataParam : BaseParam
    {
        public int? IsDeleted { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string ParentKey { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string IDs { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string SortValue { get; set; }
        public string ParentId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Value { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Key { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        public int? Sort { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Customer { get; set; }
    }
    public partial class SysUserFkParam : BaseParam
    {
        public string UserId { get; set; }
        public List<string> UserIds { get; set; }
        public string FkId { get; set; }
        public List<string> FkIds { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Type { get; set; }
        public string _Types { get; set; }
    }

    public partial class SysRoleLimitParam : BaseParam
    {
        public List<string> RoleIds { get; set; }
        public string RoleId { get; set; }
        public string FkId { get; set; }
        public List<string> FkIds { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Type { get; set; }
    }

    public partial class SysDeptParam : BaseParam
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TenantId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TenantName { get; set; }
        public List<string> UserIds { get; set; }
        public List<string> Ids { get; set; }
        public string ParentId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        public int? IsDeleted { get; set; }
        public int? Sort { get; set; }
        public int? State { get; set; }
        /// <summary>
        /// 是否独立机构/是否子公司/是否独立公司
        /// </summary>
        public bool? IsCompany { get; set; }
    }

    public partial class SysRoleParam : BaseParam
    {
        public KeyValue _Test { get; set; }
        public List<string> Ids { get; set; }
        public List<string> BaseLimit { get; set; }
        public string ParentId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        public int? Sort { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Class { get; set; }
        //public List<string> SysMenuIds { get; set; }
        public List<SysRoleLimits> SysRoleLimits { get; set; }
        /// <summary>
        /// Advanced direct table permissions. These do not override the
        /// platform protected-table baseline.
        /// </summary>
        public List<SysRoleLimits> TableRoleLimits { get; set; }
        public int? IsDeleted { get; set; }
        public string Remark { get; set; }
        public string _DeptId { get; set; }
        public List<List<string>> DeptIds { get; set; }
    }

    public partial class SysRichTextParam : BaseParam
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Customer { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Key { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Title { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Content { get; set; }
        public string ParentId { get; set; }
        public int? Sort { get; set; }
        public string Type { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
    }

    public partial class SysUserParam : BaseParam
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _CaptchaId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _CaptchaValue { get; set; }
        /// <summary>
        /// 自动化测试登录标记。sys_config.AutoTestSkipCaptcha=true 时可跳过验证码，但仍必须校验真实账号密码。
        /// </summary>
        public bool _AutomationTestLogin { get; set; }
        /// <summary>
        /// _AutomationTestLogin 的兼容别名。仅跳过验证码，不跳过密码。
        /// </summary>
        public bool _SkipCaptchaForAutomation { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string _token { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Token { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string TokenName { get; set; }
        public bool? _LevelLimit { get; set; }
        public List<string> Ids { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Email { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DeptName { get; set; }
        public List<List<string>> DeptIds { get; set; }
        public List<string> RoleIds { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string LastLoginIP { get; set; }
        public int? PwdErrorCount { get; set; }
        public string Sex { get; set; }
        public bool? InitCalendar { get; set; }
        public int? IsDeleted { get; set; }
        public List<string> GroupIds { get; set; }
        public List<string> PostIds { get; set; }
        public List<string> _RoleIds { get; set; }
        public string GroupId { get; set; }
        public string DeptId { get; set; }
        public string RoleId { get; set; }
        public string PostId { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Account { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string OldAccount { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Pwd { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string NewPwd { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Name { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string RealName { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Phone { get; set; }
        public int? State { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Remark { get; set; }
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Avatar { get; set; }
        /// <summary>
        /// 加密后的pwd
        /// </summary>
        public string _EncodePwd { get; set; }
        public string _EncodeNewPwd { get; set; }
        /// <summary>
        /// 修改本人密码时可携带的 Passkey/人脸二次认证一次性票据。
        /// </summary>
        public string _IdentityVerificationTicket { get; set; }
        /// <summary>
        /// 票据绑定的操作摘要；服务端会按实际 NewPwd 重新计算并比对。
        /// </summary>
        public string _IdentityVerificationActionHash { get; set; }
        /// <summary>
        /// 历史兼容字段：登录逻辑不再允许通过任何自动化参数跳过密码校验。
        /// </summary>
        public bool _DevBypassPwd { get; set; }

    }
}
