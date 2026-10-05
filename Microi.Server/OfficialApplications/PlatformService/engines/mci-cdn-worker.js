/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-cdn-worker | Version: v1.0.0
 * StopHttp=1；持久化调度每分钟执行一轮，数据库租约防止多节点重复处置。
 */
var job=V8.Param&&V8.Param.JobParam||{};
if(typeof job==='string'){try{job=JSON.parse(job);}catch(_){return {Code:0,Msg:'CDN 调度参数无效'};}}
if(job.RuleId)return V8.ApiEngine.Run('mci-cdn-core',{Action:'RuleTick',Id:String(job.RuleId)});
return V8.ApiEngine.Run('mci-cdn-core',{Action:'Worker'});
