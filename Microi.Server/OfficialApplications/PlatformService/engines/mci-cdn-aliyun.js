/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；租户扩展请使用独立 Provider 接口。
 * ApiEngineKey: mci-cdn-aliyun | Version: v1.0.0 | StopHttp: 1
 * 固定阿里云端点、当前租户凭据；不接受调用方传入密钥、端点或任意 SQL。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-cdn-aliyun
 * Version: v1.0.8
 * Function:
 * - 系统日志/监控官方Managed CDN能力；当前租户CMS历史公开媒体只允许权威撤销记录计算的精确单URL。独立持久化outbox和租约先于云刷新，固定SaaS密钥签名；未知结果只回读，同任务供应商完成与原URL严格404后消费回执。
 */

var p = V8.Param || {};
function text(v) { return v == null ? '' : String(v).trim(); }
function fail(m) { throw new Error(m); }
function object(v) { if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return {}; } } return v || {}; }
function array(v) { var a = []; if (v && typeof v.length === 'number') for (var i=0;i<v.length;i++) a.push(v[i]); return a; }
function num(v, low, high, fallback) { var n=Number(v == null ? fallback : v); if (!isFinite(n)||n<low||n>high||Math.floor(n)!==n) fail('参数数值超出允许范围'); return n; }
function domain(v) { var d=text(v).toLowerCase(); if(d.length>253||! /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(d)) fail('域名格式不正确'); return d; }
function utc(v) { var d=new Date(text(v)); if(!isFinite(d.getTime())) fail('时间格式不正确'); return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function credentials(sls) {
    var settings=V8.SysConfig.ServerPrivateSettings || {}, saas=V8.OsClientModel || {};
    var prefixes=sls ? ['Integration.Cdn.Aliyun.Sls.','Integration.Cdn.Aliyun.','Integration.Dns.Aliyun.'] : ['Integration.Cdn.Aliyun.','Integration.Dns.Aliyun.'];
    for(var i=0;i<prefixes.length;i++) {
        var id=text(settings[prefixes[i]+'AccessKeyId']), secret=text(settings[prefixes[i]+'AccessKeySecret']);
        if(id||secret) { if(!id||!secret) fail('系统设置中 '+prefixes[i]+' 的 AccessKeyId / AccessKeySecret 必须成对配置'); return {id:id,secret:secret,source:prefixes[i]}; }
    }
    var oldId=text(saas.AlidnsKeyId), oldSecret=text(saas.AlidnsKeySecret);
    if(!oldId||!oldSecret) fail('请在当前租户系统设置 → 安全与服务接入配置阿里云 CDN 凭据，并授予 CDN 查询/管理权限');
    return {id:oldId,secret:oldSecret,source:'SaaS.Alidns'};
}
function encode(v) { return encodeURIComponent(String(v)).replace(/[!'()*]/g,function(c){return '%'+c.charCodeAt(0).toString(16).toUpperCase();}); }
function rpc(action,args,method) {
    method=method||'GET';
    var c=credentials(false), data={Action:action,Version:'2018-05-10',Format:'JSON',AccessKeyId:c.id,SignatureMethod:'HMAC-SHA1',SignatureVersion:'1.0',SignatureNonce:V8.Method.NewGuid(),Timestamp:utc(new Date().toISOString())};
    Object.keys(args||{}).forEach(function(k){if(args[k]!==undefined&&args[k]!==null)data[k]=String(args[k]);});
    var query=Object.keys(data).sort().map(function(k){return encode(k)+'='+encode(data[k]);}).join('&');
    data.Signature=V8.Method.HmacSha1Sign(method+'&%2F&'+encode(query),c.secret+'&');
    // Keep lexical UTC timestamp in the query; JObject form conversion otherwise parses ISO date strings.
    var response=method==='POST'?V8.Http.PostResponse({Url:'https://cdn.aliyuncs.com/?'+Object.keys(data).filter(function(k){return k!=='ObjectPath'&&k!=='ObjectType'&&k!=='Signature';}).sort().map(function(k){return encode(k)+'='+encode(data[k]);}).join('&')+'&Signature='+encode(data.Signature),RequireSsrfProtection:true,PostParam:{ObjectPath:data.ObjectPath,ObjectType:data.ObjectType},ParamType:'form',Timeout:15,Headers:{Accept:'application/json'}}):V8.Http.GetResponse({RequireSsrfProtection:action==='DescribeRefreshTasks',Url:'https://cdn.aliyuncs.com/?'+query+'&Signature='+encode(data.Signature),Timeout:15,Headers:{Accept:'application/json'}});
    var body=object(response.Content);
    if(Number(response.StatusCode)<200||Number(response.StatusCode)>=300||body.Code!=null&&String(body.Code)!=='0') {
        return {Code:0,Msg:'阿里云 CDN 请求失败：'+text(body.Code||response.StatusCode),Data:{Provider:'aliyun',RequestId:text(body.RequestId),CloudCode:text(body.Code),Uncertain:!Number(response.StatusCode)||Number(response.StatusCode)>=500,Hint:'请检查 RAM 权限、域名和服务开通状态；管理请求结果未知时先回读，勿重复提交。'}};
    }
    return {Code:1,Data:body};
}

// CMS_CDN_EXACT_MEDIA_REFRESH_V1: paths come only from current-tenant authoritative offline records.
function cmsCanonical(v){if(v&&typeof v==='object'){if(typeof v.length==='number')return array(v).map(cmsCanonical);var clean={};Object.keys(v).sort().forEach(function(k){clean[k]=cmsCanonical(v[k]);});return clean;}return v;}
function cmsHash(v){return String(V8.EncryptHelper.Sha256Hex(typeof v==='string'?v:JSON.stringify(cmsCanonical(v)))).toLowerCase();}
function cmsRefreshContext(){
 ['Url','Urls','ObjectPath','ObjectType','Domain','Endpoint','AccessKeyId','AccessKeySecret','Files','Directory','Config'].forEach(function(k){if(p[k]!==undefined)fail('CMS_CDN_UNTRUSTED_ARGUMENT');});
 if(p.Provider!==undefined&&p.Provider!=='aliyun')fail('CMS_CDN_PROVIDER');
 var rid=text(p.RendId),tid=text(p.CmsTaskId),tenant=text(V8.OsClient).toLowerCase();
 if(!/^[a-zA-Z0-9-]{1,36}$/.test(rid)||!/^[a-zA-Z0-9-]{1,36}$/.test(tid)||!/^[a-z0-9_-]{1,50}$/.test(tenant))fail('CMS_CDN_IDENTITY');
 function read(table,key){var r=V8.FormEngine.GetFormData(table,{Id:key,_ReadPrimary:true});if(!r||r.Code!==1||!r.Data)fail('CMS_CDN_RECORD');return r.Data;}
 var r=read('mci_cms_rend',rid),t=read('mci_cms_task',tid),path=text(r.PublicPath),size=Number(r.Bytes),ver=Number(r.Ver);
 if(r.Id!==rid||t.Id!==tid||Number(r.IsDeleted)===1||Number(t.IsDeleted)===1||r.Status!=='Offline'||r.StoreKind==='PrivateProxyV1'||text(r.PrivatePath)||!path.startsWith('/'+tenant+'/mci-cms-public/')||/[\\:%?#\u0000-\u0020\u007f-\uffff]/.test(path)||path.split('/').slice(1).some(function(x){return !x||x==='.'||x==='..';})||!isFinite(size)||size<=0||size>268435456||Math.floor(size)!==size||!isFinite(ver)||ver<2||Math.floor(ver)!==ver||!/^[a-f0-9]{64}$/.test(text(r.DataHash)))fail('CMS_CDN_MEDIA_STATE');
 if(t.Kind!=='RendRevoke'||t.TargetId!==rid||t.ResultId!==rid||t.SiteId!==r.SiteId||Number(t.ResultVer)!==ver||t.Status!=='CacheUnverified'||t.Step!=='VerifyLegacyCache'||t.ReqKey!=='rend-revoke:'+cmsHash(rid))fail('CMS_CDN_REVOKE_STATE');
 var input={Id:r.Id,SiteId:r.SiteId,StoreKind:r.StoreKind||'',PrivatePath:r.PrivatePath||'',PublicPath:r.PublicPath||'',DataHash:r.DataHash||'',Bytes:size,Ver:ver-1};if(text(t.InputHash)!==cmsHash(input))fail('CMS_CDN_REVOKE_DRIFT');
 var base=text(V8.SysConfig.FileServer).replace(/\/$/,'');if(!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._/-]+)?$/.test(base)||base.split('/').indexOf('..')>=0)fail('CMS_CDN_FILESERVER');
 return {RendId:rid,CmsTaskId:tid,Url:base+path,InputHash:text(t.InputHash)};
}
function cmsTaskIds(value){var ids=array(value);if(ids.length>20)fail('CMS_CDN_TASK_LIMIT');var seen={};return ids.map(function(v){var id=text(v);if(!/^\d{1,30}$/.test(id)||seen[id])fail('CMS_CDN_TASK_ID');seen[id]=true;return id;});}
function cmsRefreshTasks(){var context=cmsRefreshContext(),ids=cmsTaskIds(p.TaskIds),r=rpc('DescribeRefreshTasks',{ObjectPath:context.Url,TaskId:ids.length?ids.join(','):undefined,PageNumber:1,PageSize:100});if(r.Code!==1)return r;var tasks=array(r.Data.Tasks&&r.Data.Tasks.CDNTask);if(tasks.length>=100)fail('CMS_CDN_TASK_PAGE_LIMIT');
 var unique={};tasks=tasks.map(function(t){var id=text(t.TaskId);if(!/^\d{1,30}$/.test(id)||unique[id]||text(t.ObjectPath)!==context.Url||text(t.ObjectType).toLowerCase()!=='file'||['Complete','Refreshing','Failed'].indexOf(text(t.Status))<0||!/^\d{1,3}%$/.test(text(t.Process))||Number(text(t.Process).slice(0,-1))>100||!isFinite(Date.parse(text(t.CreationTime))))fail('CMS_CDN_TASK_PROOF');unique[id]=true;if(ids.length&&ids.indexOf(id)<0)fail('CMS_CDN_TASK_SCOPE');return {TaskId:id,ObjectPath:context.Url,ObjectType:'file',Status:text(t.Status),Process:text(t.Process),CreationTime:text(t.CreationTime)};});
 return {Code:1,Data:{RendId:context.RendId,CmsTaskId:context.CmsTaskId,Url:context.Url,InputHash:context.InputHash,Tasks:tasks,TaskIds:tasks.map(function(t){return t.TaskId;}),ProviderRequestId:text(r.Data.RequestId),LastThreeDaysOnly:true,RetrievedAt:utc(new Date().toISOString())}};
}
function cmsRefreshMedia(){var context=cmsRefreshContext(),r=rpc('RefreshObjectCaches',{ObjectPath:context.Url,ObjectType:'File'},'POST');if(r.Code!==1)return r;var raw=text(r.Data.RefreshTaskId);if(!raw)fail('CMS_CDN_ACCEPTANCE_MISSING');var ids=cmsTaskIds(raw.split(','));if(!ids.length)fail('CMS_CDN_ACCEPTANCE_MISSING');return {Code:1,Data:{RendId:context.RendId,CmsTaskId:context.CmsTaskId,Url:context.Url,InputHash:context.InputHash,TaskIds:ids,ProviderRequestId:text(r.Data.RequestId),Accepted:true,Complete:false}};
}

function readSls(config,args) {
    var region=text(config.SlsRegion),project=text(config.SlsProject),store=text(config.SlsLogstore);
    if(!/^(cn|ap|eu|us|me)-[a-z]+(?:-\d+)?$/.test(region)||!/^[a-z][a-z0-9-]{2,62}$/.test(project)||!/^[a-z][a-z0-9_-]{1,62}$/.test(store)) fail('请先配置有效的 SLS 地域、Project 和 Logstore');
    var from=num(args.From,0,4102444800,0),to=num(args.To,1,4102444800,0);
    if(to<=from||to-from>7*86400)fail('实时日志查询窗口必须大于 0 且不超过 7 天');
    var d=domain(args.Domain),dimension=text(args.Dimension||'ip'),metric=text(args.Metric||'bytes'),top=num(args.Top,1,500,100);
    var dimensions={ip:'remote_ip',url:'uri',referer:'refer_domain',ipUrl:'remote_ip, uri',status:'return_code',minute:'floor(__time__ / 60) * 60'};
    if(!dimensions[dimension]||['bytes','requests'].indexOf(metric)<0)fail('不支持的日志维度');
    var fields=dimensions[dimension],where='domain = \''+d+'\'';
    if(args.Ip) { if(!/^[a-fA-F0-9:.]{2,45}$/.test(text(args.Ip)))fail('IP 格式不正确'); where+=" AND remote_ip = '"+text(args.Ip)+"'"; }
    // uri excludes query credentials; remote_ip is the TCP peer, not user-controlled X-Forwarded-For.
    var query='* | SELECT '+fields+', count(*) AS requests, sum(try_cast(response_size AS bigint)) AS bytes, max(__time__) AS last_seen, count_if(try_cast(response_size AS bigint) IS NULL) AS missing_bytes FROM log WHERE '+where+' GROUP BY '+fields+' ORDER BY '+metric+' DESC LIMIT '+top;
    if(dimension==='minute')query=query.replace('ORDER BY '+metric+' DESC','ORDER BY 1 ASC');
    var body=JSON.stringify({from:from,to:to,line:0,offset:0,query:query,powerSql:false,isAccurate:true}),c=credentials(true);
    var date=new Date().toUTCString(),path='/logstores/'+store+'/logs',size=encodeURIComponent(body).replace(/%[A-F\d]{2}/gi,'x').length;
    var headers={'x-log-apiversion':'0.6.0','x-log-bodyrawsize':String(size),'x-log-signaturemethod':'hmac-sha1'};
    var md5=String(V8.EncryptHelper.MD5Encrypt(body)).toUpperCase();
    var sign='POST\n'+md5+'\napplication/json\n'+date+'\n'+Object.keys(headers).sort().map(function(k){return k+':'+headers[k]+'\n';}).join('')+path;
    headers.Date=date;headers['Content-MD5']=md5;headers.Authorization='LOG '+c.id+':'+V8.Method.HmacSha1Sign(sign,c.secret);headers.Accept='application/json';
    var resp=V8.Http.PostResponse({Url:'https://'+project+'.'+region+'.log.aliyuncs.com'+path,PostParamString:body,ParamType:'json',Headers:headers,Timeout:15});
    var result=object(resp.Content);
    if(Number(resp.StatusCode)!==200||result.errorCode)return {Code:0,Msg:'SLS 查询失败：'+text(result.errorCode||resp.StatusCode),Data:{Hint:'请检查 SLS 日志投递、字段索引与 log:GetLogStoreLogs 权限。'}};
    var meta=result.meta||{},rows=array(result.data),last=0,missing=0;
    rows.forEach(function(r){last=Math.max(last,Number(r.last_seen)||0);missing+=Number(r.missing_bytes)||0;});
    return {Code:1,Data:{Rows:rows,Source:'SLS',From:from,To:to,Unit:'bytes',IpSource:'remote_ip',Complete:text(meta.progress)==='Complete',MissingBytes:missing,LastSeen:last,Truncated:rows.length>=top,ScanBytes:Number(meta.scanBytes)||0,RetrievedAt:utc(new Date().toISOString()),Notice:'查询完整不代表日志已全部送达。自动规则另行检查数据延迟；SLS 查询可能产生费用。'}};
}
function globalBlocks(ips) {
    var r=rpc('DescribeCdnFullDomainsBlockIPConfig',ips?{IPList:ips}:{});if(r.Code!==1)return r;
    var url=text(r.Data.Message);
    if(!/^https?:\/\/[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com\//i.test(url))return {Code:0,Msg:'阿里云未返回有效封禁列表下载地址'};
    // The signed URL is provider-issued and remains backend-only.
    var response=V8.Http.GetResponse({Url:url.replace(/^http:/,'https:'),Timeout:15});
    if(Number(response.StatusCode)!==200)return {Code:0,Msg:'阿里云封禁清单下载失败'};
    var body=text(response.Content);if(body.length>2000000)return {Code:0,Msg:'封禁清单过大，请缩小 IP 查询范围'};
    var entries=[];body.split(/\r?\n/).forEach(function(line){var m=line.trim().match(/^([a-fA-F0-9:./]+)[,\s-]+(.+)$/);if(m)entries.push({Ip:m[1],ExpiresAt:m[2]});});
    return {Code:1,Data:{Entries:entries,RequestId:r.Data.RequestId,Count:entries.length}};
}
function redactReport(value,depth) {
    if(depth>10)return null;
    if(typeof value==='string'){
        if(/^https?:\/\//i.test(value))return value.split(/[?#]/)[0];
        if(/^[\[{]/.test(value)){try{return redactReport(JSON.parse(value),depth+1);}catch(_){}}
        return value;
    }
    if(!value||typeof value!=='object')return value;
    if(typeof value.length==='number')return array(value).map(function(x){return redactReport(x,depth+1);});
    var clean={};Object.keys(value).forEach(function(k){if(!/secret|token|signature|password|authorization/i.test(k))clean[k]=redactReport(value[k],depth+1);});return clean;
}
try {
    var action=text(p.Action);if(action==='RefreshCmsMedia')return cmsRefreshMedia();if(action==='CmsRefreshTasks')return cmsRefreshTasks();var d=p.Domain?domain(p.Domain):'';
    if(action==='Capabilities') { var configured=false,source='',message='';try{var cred=credentials(false);configured=true;source=cred.source;}catch(e){message=e.message;} return {Code:1,Data:{Provider:'aliyun',Configured:configured,CredentialSource:source,Message:message,Features:{Domains:true,Reports:true,Sls:true,DomainIpAcl:true,GlobalIpBlock:true,DownloadRate:true,Referer:true,CmsMediaRefresh:true,CmsRefreshTaskReadback:true},GlobalBlockScope:'account',GlobalBlockRequiresPaidService:true,ReportsAreRealtime:false,AutoRulesSource:'SLS'}}; }
    if(action==='Domains')return rpc('DescribeUserDomains',{PageNumber:num(p.Page,1,10000,1),PageSize:num(p.PageSize,1,50,50),DomainName:text(p.Search).slice(0,253)});
    if(action==='Domain')return rpc('DescribeCdnServiceDetail',{DomainName:d});
    if(action==='Trend')return rpc('DescribeDomainBpsData',{DomainName:d,StartTime:utc(p.StartTime),EndTime:utc(p.EndTime),Interval:num(p.Interval,300,86400,300)});
    if(action==='ReportList')return rpc('DescribeCdnSubList',{});
    if(action==='Reports') {
        var report=num(p.ReportId,1,23,13);if([1,3,5,7,9,11,13,15,17,19,21,23].indexOf(report)<0)fail('不支持的报表类型');
        var reportArgs={ReportId:report,StartTime:utc(p.StartTime),EndTime:utc(p.EndTime)};
        if(report!==17)reportArgs.DomainName=d;
        if([13,15].indexOf(report)>=0&&text(p.Area))reportArgs.Area=text(p.Area);
        if([1,3,9,11].indexOf(report)>=0&&text(p.HttpCode)){if(['2xx','3xx','4xx','5xx'].indexOf(text(p.HttpCode))<0)fail('HTTP 状态筛选须为 2xx/3xx/4xx/5xx');reportArgs.HttpCode=text(p.HttpCode);}
        if([21,23].indexOf(report)>=0){reportArgs.IsOverseas=text(p.IsOverseas||'0');if(['0','1'].indexOf(reportArgs.IsOverseas)<0)fail('地域范围须为中国内地或境外');}
        var reports=rpc('DescribeCdnReport',reportArgs);
        if(reports.Code===1)reports.Data.Content=redactReport(reports.Data.Content,0);return reports;
    }
    if(action==='SubscribeReports')return rpc('CreateCdnSubTask',{DomainName:d,ReportIds:'1,3,5,7,9,11,13,15,17,19,21,23'});
    if(action==='Configs')return rpc('DescribeCdnDomainConfigs',{DomainName:d,FunctionNames:'ip_black_list_set,ip_allow_list_set,limit_rate,referer_black_list_set,referer_white_list_set'});
    if(action==='SetConfigs') {
        var functions=array(p.Functions);if(functions.length!==1)fail('每次只能更新一项 CDN 配置');
        if(['ip_black_list_set','limit_rate','referer_black_list_set','referer_white_list_set'].indexOf(text(functions[0].functionName))<0)fail('不支持的 CDN 配置');
        return rpc('BatchSetCdnDomainConfig',{DomainNames:d,Functions:JSON.stringify(functions)});
    }
    if(action==='DeleteConfig')return rpc('DeleteSpecificConfig',{DomainName:d,ConfigId:text(p.ConfigId)});
    if(action==='GlobalBlocks')return globalBlocks(text(p.IPList));
    if(action==='GlobalBlock')return rpc('SetCdnFullDomainsBlockIP',{IPList:text(p.IPList),OperationType:p.Unblock?'unblock':'block',BlockInterval:num(p.Duration,0,31536000,3600),UpdateType:'uncover'});
    if(action==='Sls')return readSls(object(p.Config),p);
    return {Code:0,Msg:'不支持的阿里云 CDN 操作'};
} catch(e) { return {Code:0,Msg:text(e.message||'CDN 请求失败').slice(0,400)}; }

