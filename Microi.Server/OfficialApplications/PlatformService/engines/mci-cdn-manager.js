/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-cdn-manager | Version: v1.0.0
 * 管理员统一入口；云凭据和后台任务标志不允许从 HTTP 透传。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-cdn-manager
 * Version: v1.1.1
 * Function:
 * - CDN与OSS费用诊断、计费用量、离线取证、可信流量预警和可回读安全处置；当前租户固定云端点与密钥隔离。
 */

var auth=V8.Method.GetSystemObservability({Action:'Snapshot',IncludeHost:false,WindowMinutes:1,Top:1});
if(!auth||auth.Code!=1)return auth||{Code:0,Msg:'需要当前租户平台管理员权限'};
var source=V8.Param||{}, request={};
var actions=['Capabilities','Domains','Trend','Usage','CacheHit','OriginTraffic','Billing','StorageHealth','StorageLogs','StorageLogDownload','Logs','LogDownload','LogDelivery','Readiness','ReportList','Reports','Configs','GlobalBlocks','Sls','Config','SaveConfig','Rules','SaveRule','DeleteRule','Preview','Submit','Operations','Reconcile','RefreshCmsMedia','CmsRefreshStatus'];
if(actions.indexOf(String(source.Action||''))<0)return {Code:0,Msg:'不支持的 CDN 操作'};
['RendId','CmsTaskId','Action','Provider','Domain','Search','Page','PageSize','StartTime','EndTime','Interval','ReportId','Area','HttpCode','IsOverseas','From','To','Dimension','Metric','Top','Ip','Config','Id','Name','Enabled','Rule','Command','BeforeHash','ExpiresAt','PreviewToken','RequestKey','Field','UsageType','DataProtocol','Kind','BillingCycle','ProductCode','Granularity','BillingDate','MaxResults','NextToken','InstanceId','LogName','ProbeInternal','StorageScope','Day','Marker'].forEach(function(k){if(source[k]!==undefined)request[k]=source[k];});
request.ActorAccount=String(V8.CurrentUser&&(V8.CurrentUser.Account||V8.CurrentUser.Name||V8.CurrentUser.Id)||'平台管理员');
return V8.ApiEngine.Run('mci-cdn-core',request);

