/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；租户扩展请使用独立 Provider 接口。
 * ApiEngineKey: mci-cdn-aliyun | Version: v1.0.0 | StopHttp: 1
 * 固定阿里云端点、当前租户凭据；不接受调用方传入密钥、端点或任意 SQL。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-cdn-aliyun
 * Version: v1.1.4
 * Function:
 * - CDN与OSS费用诊断、计费用量、离线取证、可信流量预警和可回读安全处置；当前租户固定云端点与密钥隔离。
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
function rpc(action,args,method,billing) {
    method=method||'GET';
    var endpoint=billing?'https://business.aliyuncs.com/':'https://cdn.aliyuncs.com/';
    var c=credentials(false), data={Action:action,Version:billing?'2017-12-14':'2018-05-10',Format:'JSON',AccessKeyId:c.id,SignatureMethod:'HMAC-SHA1',SignatureVersion:'1.0',SignatureNonce:V8.Method.NewGuid(),Timestamp:utc(new Date().toISOString())};
    Object.keys(args||{}).forEach(function(k){if(args[k]!==undefined&&args[k]!==null)data[k]=String(args[k]);});
    var query=Object.keys(data).sort().map(function(k){return encode(k)+'='+encode(data[k]);}).join('&');
    data.Signature=V8.Method.HmacSha1Sign(method+'&%2F&'+encode(query),c.secret+'&');
    // Keep lexical UTC timestamp in the query; JObject form conversion otherwise parses ISO date strings.
    var response=method==='POST'?V8.Http.PostResponse({Url:endpoint+'?'+Object.keys(data).filter(function(k){return k!=='ObjectPath'&&k!=='ObjectType'&&k!=='Signature';}).sort().map(function(k){return encode(k)+'='+encode(data[k]);}).join('&')+'&Signature='+encode(data.Signature),RequireSsrfProtection:true,PostParam:{ObjectPath:data.ObjectPath,ObjectType:data.ObjectType},ParamType:'form',Timeout:15,Headers:{Accept:'application/json'}}):V8.Http.GetResponse({RequireSsrfProtection:true,Url:endpoint+'?'+query+'&Signature='+encode(data.Signature),Timeout:15,Headers:{Accept:'application/json'}});
    var body=object(response.Content);
    if(Number(response.StatusCode)<200||Number(response.StatusCode)>=300||(billing?body.Success!==true:(body.Code!=null&&String(body.Code)!=='0'))) {
        return {Code:0,Msg:'阿里云 '+(billing?'账单':'CDN')+' 请求失败：'+text(body.Code||response.StatusCode),Data:{Provider:'aliyun',RequestId:text(body.RequestId),CloudCode:text(body.Code),PermissionDenied:/forbidden|denied|permission|unauthorized/i.test(text(body.Code)),Uncertain:!Number(response.StatusCode)||Number(response.StatusCode)>=500,Hint:'请检查 RAM 权限、域名和服务开通状态；管理请求结果未知时先回读，勿重复提交。'}};
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
    function querySls(query){
        var body=JSON.stringify({from:from,to:to,line:0,offset:0,query:query,powerSql:false,isAccurate:true}),c=credentials(true);
    var date=new Date().toUTCString(),path='/logstores/'+store+'/logs',size=encodeURIComponent(body).replace(/%[A-F\d]{2}/gi,'x').length;
    var headers={'x-log-apiversion':'0.6.0','x-log-bodyrawsize':String(size),'x-log-signaturemethod':'hmac-sha1'};
    var md5=String(V8.EncryptHelper.MD5Encrypt(body)).toUpperCase();
    var sign='POST\n'+md5+'\napplication/json\n'+date+'\n'+Object.keys(headers).sort().map(function(k){return k+':'+headers[k]+'\n';}).join('')+path;
    headers.Date=date;headers['Content-MD5']=md5;headers.Authorization='LOG '+c.id+':'+V8.Method.HmacSha1Sign(sign,c.secret);headers.Accept='application/json';
    var resp=V8.Http.PostResponse({Url:'https://'+project+'.'+region+'.log.aliyuncs.com'+path,PostParamString:body,ParamType:'json',Headers:headers,Timeout:15});
    var result=object(resp.Content);
    if(Number(resp.StatusCode)!==200||result.errorCode)fail('SLS 查询失败：'+text(result.errorCode||resp.StatusCode));
        return result;
    }
    var result=querySls(query);
    // 全窗口健康聚合独立于TOP截断，避免某一新鲜IP掩盖其它行缺字段。查询完成仍不保证投递全部完成。
    var health=querySls('* | SELECT count(*) AS requests, max(__time__) AS last_seen, count_if(try_cast(response_size AS bigint) IS NULL) AS missing_bytes FROM log WHERE '+where),healthRow=array(health.data)[0]||{};
    var meta=result.meta||{},rows=array(result.data),last=0,missing=0;
    rows.forEach(function(r){last=Math.max(last,Number(r.last_seen)||0);missing+=Number(r.missing_bytes)||0;});
    return {Code:1,Data:{Rows:rows,Source:'SLS',From:from,To:to,Unit:'bytes',IpSource:'remote_ip',Complete:text(meta.progress)==='Complete',HealthComplete:text(health.meta&&health.meta.progress)==='Complete',DeliveryNotGuaranteed:true,TotalRequests:Number(healthRow.requests)||0,MissingBytes:Number(healthRow.missing_bytes)||0,LastSeen:Number(healthRow.last_seen)||0,Truncated:rows.length>=top,ScanBytes:Number(meta.scanBytes)||0,RetrievedAt:utc(new Date().toISOString()),Notice:'查询完整不代表日志已全部送达。自动规则另行检查数据延迟；SLS 查询可能产生费用。'}};
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
// 计费、流量与日志各有独立统计口径；固定API白名单，拒绝把查询参数变为任意RPC代理。
function timeRange(maxDays) {var start=utc(p.StartTime),end=utc(p.EndTime),span=Date.parse(end)-Date.parse(start);if(span<=0||span>maxDays*86400000)fail('查询时间跨度必须大于0且不超过 '+maxDays+' 天');return {StartTime:start,EndTime:end};}
function metricRead(action,d){
    if(!d)fail('必须指定一个CDN域名');var interval=num(p.Interval,300,86400,3600);if([300,3600,86400].indexOf(interval)<0)fail('统计间隔仅支持300、3600或86400秒');
    var maxDays=action==='Usage'?(interval===300?3:interval===3600?7:31):(interval===300?3:interval===3600?31:366),q=timeRange(maxDays);q.DomainName=d;q.Interval=interval;
    if(action==='Usage'){q.Field=text(p.Field||'traf');q.Type=text(p.UsageType||'all');q.DataProtocol=text(p.DataProtocol||'all');q.Area=text(p.Area||'all');if(['traf','bps','acc'].indexOf(q.Field)<0||['static','dynamic','all'].indexOf(q.Type)<0||['http','https','quic','all'].indexOf(q.DataProtocol)<0||['CN','OverSeas','AP1','AP2','AP3','NA','SA','EU','MEAA','all'].indexOf(q.Area)<0)fail('计费用量筛选无效');if(q.Field!=='acc'&&(q.Type!=='all'||q.DataProtocol!=='all'))fail('流量/带宽计费用量的Type与DataProtocol必须为all');if(q.Field==='acc'&&q.Area!=='all')fail('请求数计费用量不按地域筛选');}
    var r=rpc(action==='Usage'?'DescribeDomainUsageData':action==='CacheHit'?'DescribeDomainHitRateData':'DescribeDomainSrcTrafficData',q);if(r.Code===1){r.Data.Metric=action;r.Data.Unit=action==='CacheHit'?'percent':action==='Usage'&&q.Field==='bps'?'bps':action==='Usage'&&q.Field==='acc'?'requests':'bytes';r.Data.RequestedInterval=interval;r.Data.Notice='以供应商返回DataInterval为实际统计间隔；计费用量与账单金额需分别核对，近期数据可能延迟。';}return r;
}
function billingRead(){
    var kind=text(p.Kind||'Overview'),cycle=text(p.BillingCycle),q={},api='';if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(cycle)&&kind!=='Packages'&&kind!=='PackageUsage')fail('账期必须为YYYY-MM');
    if(kind==='Overview'){api='QueryBillOverview';q.BillingCycle=cycle;}
    else if(kind==='Instance'){api='DescribeInstanceBill';q.BillingCycle=cycle;q.ProductCode=text(p.ProductCode);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(q.ProductCode))fail('请选择账单概览返回的产品代码');q.Granularity=text(p.Granularity||'MONTHLY');if(['MONTHLY','DAILY'].indexOf(q.Granularity)<0)fail('账单粒度无效');if(q.Granularity==='DAILY'){q.BillingDate=text(p.BillingDate);if(!/^20\d{2}-\d{2}-\d{2}$/.test(q.BillingDate)||q.BillingDate.slice(0,7)!==cycle||!isFinite(Date.parse(q.BillingDate)))fail('账单日期必须属于账期');}q.IsBillingItem=true;q.IsHideZeroCharge=false;q.MaxResults=num(p.MaxResults,1,300,100);if(p.NextToken){if(text(p.NextToken).length>4096)fail('账单游标过长');q.NextToken=text(p.NextToken);}}
    else if(kind==='Packages'){api='QueryResourcePackageInstances';q.PageNum=num(p.Page,1,10000,1);q.PageSize=num(p.PageSize,1,300,100);}
    else if(kind==='PackageUsage'){api='QueryDPUtilizationDetail';var from=text(p.StartTime),to=text(p.EndTime);if(!/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(from)||!/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(to))fail('资源包使用时间须为中国站账单本地时间YYYY-MM-dd HH:mm:ss');var span=Date.parse(to.replace(' ','T')+'+08:00')-Date.parse(from.replace(' ','T')+'+08:00');if(!isFinite(span)||span<=0||span>31*86400000)fail('资源包查询跨度必须大于0且不超过31天');q.StartTime=from;q.EndTime=to;q.InstanceId=text(p.InstanceId);if(!/^[a-zA-Z0-9_-]{1,128}$/.test(q.InstanceId))fail('资源包ID无效');q.IncludeShare=false;q.Limit=num(p.MaxResults,1,300,100);if(p.NextToken){if(text(p.NextToken).length>4096)fail('资源包游标过长');q.LastToken=text(p.NextToken);}}
    else fail('不支持的账单查询类型');
    var r=rpc(api,q,'GET',true);if(r.Code!==1)return r;var data=r.Data.Data||{};
    return {Code:1,Data:{Kind:kind,BillingCycle:cycle,RequestId:text(r.Data.RequestId),Result:data,QueryStart:q.StartTime||'',QueryEnd:q.EndTime||'',ReadOnly:true,Provisional:kind==='Overview'||kind==='Instance',Notice:'当前账期可能延迟24小时；应付金额PretaxAmount、原价PretaxGrossAmount与实付PaymentAmount不可混用。资源包列表仅代表当前有效包，不能推断历史抵扣。'}};
}
// OSS_COST_READINESS_V1：仅读取当前租户已配置桶的元数据，不接受外部桶名、密钥或URL。
function storageHealth(){
    var saas=V8.OsClientModel||{},result=[];
    // 运行时可裁剪存储配置。仅补读当前租户非秘密字段；多环境值不一致时拒绝猜测。
    if(!text(saas.AliOssPublicBucketName)&&!text(saas.AliOssPrivateBucketName)){
        var fields=['OsClientType','OsClientNetwork','AliOssPublicBucketName','AliOssPublicEndpoint','AliOssPrivateBucketName','AliOssPrivateEndpoint'];
        var configs=V8.FormEngine.GetTableData('sys_osclients',{_Where:[['OsClient','=',V8.OsClient]],_SelectFields:fields,_PageSize:50,_ReadPrimary:true});
        if(!configs||configs.Code!==1)fail('无法读取当前租户OSS配置');var records=array(configs.Data);
        if(!records.length||records.length>=50)fail('当前租户OSS配置缺失或超出诊断范围');
        var chosen={};fields.slice(2).forEach(function(k){var values={};records.forEach(function(x){var value=text(x[k]);if(value)values[value]=true;});var keys=Object.keys(values);if(keys.length>1)fail('当前租户多个环境的OSS配置不同，不能猜测实际运行配置');chosen[k]=keys[0]||'';});saas=chosen;
    }
    function xml(body,name){var m=String(body||'').match(new RegExp('<'+name+'(?:\\s[^>]*)?>([^<]*)</'+name+'>'));return m?m[1].replace(/&amp;/g,'&').slice(0,1000):'';}
    ['Public','Private'].forEach(function(scope){
        var prefix='AliOss'+scope,bucket=text(saas[prefix+'BucketName']),configured=text(saas[prefix+'Endpoint']).replace(/^https?:\/\//,'').replace(/\/$/,'');
        var match=configured.match(/^oss-([a-z]{2}-[a-z0-9-]+?)(-internal)?\.aliyuncs\.com$/),row={Scope:scope,Bucket:bucket,ConfiguredEndpoint:configured,ConfiguredInternal:!!(match&&match[2]),ReadOnly:true};
        result.push(row);if(!match||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)){row.Error='SaaS OSS桶/地域Endpoint未配置或不受支持';return;}
        var accessId=text(saas[prefix+'AccessKeyId']),secret=text(saas[prefix+'AccessKeySecret']);
        if(!accessId||!secret){var current=credentials(false);accessId=current.id;secret=current.secret;row.CredentialSource='当前租户云诊断凭据';}
        var endpoint='oss-'+match[1]+'.aliyuncs.com';row.InternalCandidate='oss-'+match[1]+'-internal.aliyuncs.com';
        function read(kind,internal){
            var date=new Date().toUTCString(),host=bucket+'.'+(internal?row.InternalCandidate:endpoint),canonical='/'+bucket+'/?'+kind;
            try{
                var response=V8.Http.GetResponse({Url:'https://'+host+'/?'+kind,RequireSsrfProtection:true,Timeout:internal?3:10,Headers:{Date:date,Authorization:'OSS '+accessId+':'+V8.Method.HmacSha1Sign('GET\n\n\n'+date+'\n'+canonical,secret)}}),body=String(response.Content||''),status=Number(response.StatusCode)||0;
                if(body.length>65536)return {Success:false,StatusCode:status,CloudCode:'ResponseTooLarge'};
                if(status!==200)return {Success:false,StatusCode:status,CloudCode:xml(body,'Code')||'NetworkOrPolicyError',RequestId:xml(body,'RequestId')};
                if(kind==='logging')return {Success:true,Enabled:!!xml(body,'TargetBucket'),TargetBucket:xml(body,'TargetBucket'),TargetPrefix:xml(body,'TargetPrefix')};
                return {Success:true,StorageBytes:Number(xml(body,'Storage'))||0,ObjectCount:Number(xml(body,'ObjectCount'))||0,LastModifiedTime:Number(xml(body,'LastModifiedTime'))||0};
            }catch(_){return {Success:false,CloudCode:'NetworkOrPolicyError'};}
        }
        row.Logging=read('logging',false);row.Stat=read('stat',false);
        if(p.ProbeInternal===true)row.InternalProbe=read('stat',true);
    });
    return {Code:1,Data:{Buckets:result,ReadOnly:true,Notice:'公网Endpoint的服务端读对象可能产生OSS公网流出费；内网候选必须在实际服务节点验证网络和权限，不能只依据Internal标签切换。日志未开启时不能还原历史来源。'}};
}
function storageLogAccess(download){
    var scope=text(p.StorageScope||'Public'),day=text(p.Day);if(['Public','Private'].indexOf(scope)<0||!/^20\d{2}-\d{2}-\d{2}$/.test(day)||!isFinite(Date.parse(day)))fail('OSS日志范围/日期无效');
    var health=storageHealth(),row=array(health.Data.Buckets).filter(function(x){return x.Scope===scope;})[0];
    if(!row||!row.Logging||!row.Logging.Success)fail('无法核验OSS日志配置');if(!row.Logging.Enabled)return {Code:1,Data:{Files:[],HasMore:false,LoggingEnabled:false,Notice:'此桶没有已启用的访问日志，不能回溯历史来源'}};
    var target=text(row.Logging.TargetBucket),prefix=text(row.Logging.TargetPrefix)+row.Bucket+day,endpoint=row.InternalCandidate.replace('-internal.','.');
    if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(target)||/[\u0000-\u001f\u007f]/.test(prefix)||prefix.length>800)fail('OSS日志目标配置不受支持');
    var marker=text(p.Marker);if(marker&&(marker.indexOf(prefix)!==0||marker.length>1024))fail('OSS日志游标超出当前范围');
    var c=credentials(false),date=new Date().toUTCString(),canonical='/'+target+'/',url='https://'+target+'.'+endpoint+'/?max-keys=1000&prefix='+encode(prefix)+(marker?'&marker='+encode(marker):'');
    var response=V8.Http.GetResponse({Url:url,RequireSsrfProtection:true,Timeout:10,Headers:{Date:date,Authorization:'OSS '+c.id+':'+V8.Method.HmacSha1Sign('GET\n\n\n'+date+'\n'+canonical,c.secret)}}),body=String(response.Content||'');
    function value(xml,name){var m=String(xml).match(new RegExp('<'+name+'>([^<]*)</'+name+'>'));return m?m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"):'';}
    if(Number(response.StatusCode)!==200)return {Code:0,Msg:'OSS日志清单读取失败：'+value(body,'Code'),Data:{CloudCode:value(body,'Code'),StatusCode:Number(response.StatusCode)||0}};
    if(body.length>2097152)fail('OSS日志清单超过大小限制');var blocks=body.match(/<Contents>[\s\S]*?<\/Contents>/g)||[],files=[];
    blocks.forEach(function(block){var name=value(block,'Key'),size=Number(value(block,'Size'));if(name.indexOf(prefix)!==0||name.length>1024||!isFinite(size)||size<0)fail('OSS日志清单范围无效');files.push({Name:name,Bytes:size,LastModified:value(block,'LastModified')});});
    if(download){var selected=files.filter(function(f){return f.Name===text(p.LogName);});if(selected.length!==1||selected[0].Bytes>134217728)fail('OSS日志必须来自当前清单且不超过128MiB');var name=selected[0].Name,expires=Math.floor(Date.now()/1000)+300,resource='/'+target+'/'+name,sig=V8.Method.HmacSha1Sign('GET\n\n\n'+expires+'\n'+resource,c.secret);return {Code:1,Data:{Name:name,Bytes:selected[0].Bytes,DownloadUrl:'https://'+target+'.'+endpoint+'/'+name.split('/').map(encode).join('/')+'?OSSAccessKeyId='+encode(c.id)+'&Expires='+expires+'&Signature='+encode(sig),EphemeralCredential:true,Notice:'仅供受控审计进程下载并脱敏，不得记录或公开临时下载地址'}};}
    return {Code:1,Data:{StorageScope:scope,SourceBucket:row.Bucket,Day:day,Files:files,HasMore:value(body,'IsTruncated')==='true',NextMarker:value(body,'NextMarker'),LoggingEnabled:true,ReadOnly:true}};
}
function logFiles(d,download){
    if(!d)fail('必须指定一个CDN域名');var q=timeRange(1);q.DomainName=d;q.PageNumber=num(p.Page,1,10000,1);q.PageSize=num(p.PageSize,1,100,100);var r=rpc('DescribeCdnDomainLogs',q);if(r.Code!==1)return r;
    var groups=array(r.Data.DomainLogDetails&&r.Data.DomainLogDetails.DomainLogDetail),files=[],total=0;groups.forEach(function(g){if(text(g.DomainName)!==d)fail('日志域名回执不一致');total+=Number(g.PageInfos&&g.PageInfos.Total)||0;array(g.LogInfos&&g.LogInfos.LogInfoDetail).forEach(function(f){files.push({Domain:d,Name:text(f.LogName),Bytes:Number(f.LogSize)||0,StartTime:text(f.StartTime),EndTime:text(f.EndTime),path:text(f.LogPath)});});});
    // 下载是独立管理员取证动作：只匹配本次云端清单中的精确文件，调用方不能指定URL或任意主机。
    if(download){var selected=files.filter(function(f){return f.Name===text(p.LogName);});if(selected.length!==1)fail('日志文件不在本次云端清单内');var f=selected[0],url=f.path;if(url.indexOf('//')===0)url='https:'+url;else if(!/^[a-z]+:/i.test(url))url='https://'+url;url=url.replace(/^http:/,'https:');var host=/^https:\/\/([a-zA-Z0-9.-]+)\/[^\s]*$/.exec(url);if(!host||!/(?:\.aliyuncs\.com|\.alicdn\.com)$/i.test(host[1]))fail('日志下载地址不属于受信阿里云域名');return {Code:1,Data:{Domain:d,Name:f.Name,Bytes:f.Bytes,DownloadUrl:url,EphemeralCredential:true,Notice:'仅供受控审计进程下载；不得写入日志、前端持久化或公开展示。原始日志需有界流式脱敏。'}};}
    return {Code:1,Data:{Domain:d,Files:files.map(function(f){return {Domain:f.Domain,Name:f.Name,Bytes:f.Bytes,StartTime:f.StartTime,EndTime:f.EndTime};}),Page:q.PageNumber,PageSize:q.PageSize,Total:total,HasMore:q.PageNumber*q.PageSize<total,Notice:'离线日志小时粒度、保留31天且存在延迟；不作为自动封禁的实时依据。'}};
}
try {
    var action=text(p.Action);if(action==='RefreshCmsMedia')return cmsRefreshMedia();if(action==='CmsRefreshTasks')return cmsRefreshTasks();var d=p.Domain?domain(p.Domain):'';
    if(action==='Capabilities') { var configured=false,source='',message='';try{var cred=credentials(false);configured=true;source=cred.source;}catch(e){message=e.message;} return {Code:1,Data:{Provider:'aliyun',Configured:configured,CredentialSource:source,Message:message,Features:{Domains:true,Reports:true,Sls:true,DomainIpAcl:true,GlobalIpBlock:true,DownloadRate:true,Referer:true,CmsMediaRefresh:true,CmsRefreshTaskReadback:true},GlobalBlockScope:'account',GlobalBlockRequiresPaidService:true,ReportsAreRealtime:false,AutoRulesSource:'SLS'}}; }
    if(action==='Domains')return rpc('DescribeUserDomains',{PageNumber:num(p.Page,1,10000,1),PageSize:num(p.PageSize,1,50,50),DomainName:text(p.Search).slice(0,253)});
    if(action==='Domain')return rpc('DescribeCdnServiceDetail',{DomainName:d});
    if(action==='Trend')return rpc('DescribeDomainBpsData',{DomainName:d,StartTime:utc(p.StartTime),EndTime:utc(p.EndTime),Interval:num(p.Interval,300,86400,300)});
    if(['Usage','CacheHit','OriginTraffic'].indexOf(action)>=0)return metricRead(action,d);
    if(action==='Billing')return billingRead();
    if(action==='StorageHealth')return storageHealth();
    if(action==='StorageLogs'||action==='StorageLogDownload')return storageLogAccess(action==='StorageLogDownload');
    if(action==='Logs'||action==='LogDownload')return logFiles(d,action==='LogDownload');
    if(action==='LogDelivery'){if(!d)fail('必须指定一个CDN域名');return rpc('DescribeDomainRealtimeLogDelivery',{Domain:d});}
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
    if(action==='SubscribeReports'){var sub=object(p.Subscription),ds=array(sub.Domains),ids=array(sub.ReportIds);if(!ds.length||!ids.length)fail('缺少完整订阅计划');ds=ds.map(function(x){return x==='all'&&sub.Existing===true?'all':domain(x);});var subArgs={DomainName:ds.join(','),ReportIds:ids.map(function(x){return num(x,1,10000,0);}).join(',')};if(sub.Existing===true){if(sub.StartTime)subArgs.StartTime=utc(sub.StartTime);if(sub.EndTime)subArgs.EndTime=utc(sub.EndTime);}return rpc(sub.Existing===true?'UpdateCdnSubTask':'CreateCdnSubTask',subArgs);}
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


