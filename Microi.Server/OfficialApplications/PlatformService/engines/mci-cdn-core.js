/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-cdn-core | Version: v1.0.0
 * StopHttp=1。业务编排、持久化操作、白名单、规则评估。云厂商协议由适配器实现。
 * FormEngine 不传 DbTrans，操作状态独立提交，避免云端成功后外层事务回滚丢失回执。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-cdn-core
 * Version: v1.1.3
 * Function:
 * - CDN与OSS费用诊断、计费用量、离线取证、可信流量预警和可回读安全处置；当前租户固定云端点与密钥隔离。
 */

var p=V8.Param||{}, tenant=String(V8.OsClient||''), now=Math.floor(new Date().getTime()/1000);
function txt(v){return v==null?'':String(v).trim();}
function obj(v){if(typeof v==='string'){try{return JSON.parse(v);}catch(_){return {};}}return v||{};}
function list(v){var a=[];if(v&&typeof v.length==='number')for(var i=0;i<v.length;i++)a.push(v[i]);return a;}
function fail(m){throw Error(m);}
function number(v,min,max,def){var n=Number(v==null?def:v);if(!isFinite(n)||n<min||n>max||Math.floor(n)!==n)fail('数值须在 '+min+' 至 '+max+' 之间');return n;}
function hash(v){return String(V8.EncryptHelper.Sha256Hex(typeof v==='string'?v:JSON.stringify(v)));}
function id(v){return hash(tenant+'|'+v).slice(0,32);}
function ok(v){return {Code:1,Data:v};}
function must(r){if(!r||r.Code!=1){var e=Error(r&&r.Msg||'操作失败');e.result=r;throw e;}return r.Data;}
function domain(v){var s=txt(v).toLowerCase();if(s.length>253||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(s))fail('请输入有效域名');return s;}
function provider(v){var k=txt(v||'aliyun');if(k!=='aliyun')fail('该云厂商暂未接入。适配器协议已预留。');return k;}
function cloud(action,args){var req=args||{};req.Action=action;return must(V8.ApiEngine.Run('mci-cdn-'+provider(req.Provider),req));}
function rows(table,where,fields,size,order,asc){return list(must(V8.FormEngine.GetTableData(table,{_Where:[['Tenant','=',tenant]].concat(where||[]),_SelectFields:fields,_PageSize:size||100,_PageIndex:1,_OrderBy:order||'CreateTime',_OrderByType:asc?'ASC':'DESC',_ReadPrimary:true})));}
function one(table,key){var r=V8.FormEngine.GetFormData(table,{Id:key,_Where:[['Tenant','=',tenant]],_ReadPrimary:true});return r&&r.Code==1?r.Data:null;}
function add(table,row){row.Tenant=tenant;return must(V8.FormEngine.AddFormData(table,row));}
function update(table,row){var old=one(table,row.Id);if(!old)fail('数据不存在或不属于当前租户');return must(V8.FormEngine.UptFormData(table,row));}
function address(v){
    var raw=txt(v),parts=raw.split('/');if(parts.length>2||! /^[a-fA-F0-9:.]+$/.test(parts[0]))fail('IP / CIDR 格式不正确：'+raw.slice(0,64));
    function ipv4(s){var p=s.split('.');if(p.length!==4||p.some(function(x){return !/^(0|[1-9]\d{0,2})$/.test(x)||Number(x)>255;}))fail('IPv4 必须使用四段十进制格式');return p.map(Number);}
    var bytes=[],input=parts[0];
    if(input.indexOf(':')<0)bytes=ipv4(input);
    else {
        if(input.indexOf('.')>=0){var cut=input.lastIndexOf(':'),tail=ipv4(input.slice(cut+1));input=input.slice(0,cut+1)+((tail[0]<<8)+tail[1]).toString(16)+':'+((tail[2]<<8)+tail[3]).toString(16);}
        var halves=input.split('::');if(halves.length>2)fail('IPv6 格式不正确');var left=halves[0]?halves[0].split(':'):[],right=halves.length===2&&halves[1]?halves[1].split(':'):[],missing=8-left.length-right.length;
        if(halves.length===1&&missing!==0||halves.length===2&&missing<1)fail('IPv6 长度不正确');
        var words=left.slice();if(halves.length===2)for(var z=0;z<missing;z++)words.push('0');words=words.concat(right);
        words.forEach(function(w){if(!/^[a-fA-F0-9]{1,4}$/.test(w))fail('IPv6 分段不正确');var n=parseInt(w,16);bytes.push(n>>8,n&255);});
    }
    var bits=bytes.length*8;if(parts.length===2&&!/^\d{1,3}$/.test(parts[1]))fail('CIDR 前缀不正确');var prefix=parts.length===2?number(parts[1],0,bits,bits):bits;
    if(parts.length===2)for(var bit=prefix;bit<bits;bit++)bytes[Math.floor(bit/8)]&=~(128>>(bit%8));
    var canonical='';if(bytes.length===4)canonical=bytes.join('.');else {var words=[];for(var i=0;i<16;i+=2)words.push(((bytes[i]<<8)+bytes[i+1]).toString(16).padStart(4,'0'));canonical=words.join(':');}
    return {value:canonical+(parts.length===2?'/'+prefix:''),bytes:bytes,prefix:prefix};
}
function addresses(v,max){var values=typeof v==='string'?v.split(/[\s,;]+/):list(v),result=[];values.filter(function(x){return txt(x);}).forEach(function(x){var ip=address(x).value;if(result.indexOf(ip)<0)result.push(ip);});if(result.length>max)fail('一次最多 '+max+' 个 IP / CIDR');return result;}
function matches(ip,cidr){var a=address(ip),b=address(cidr);if(a.bytes.length!==b.bytes.length)return false;for(var i=0;i<b.prefix;i++)if((a.bytes[Math.floor(i/8)]&(128>>(i%8)))!==(b.bytes[Math.floor(i/8)]&(128>>(i%8))))return false;return true;}
function protectedIp(ip,white){return white.some(function(w){return matches(ip,w)||matches(w,ip);});}
var builtInWhite=['127.0.0.0/8','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','169.254.0.0/16','224.0.0.0/4','0.0.0.0/8','::/128','::1/128','::ffff:0:0/96','fc00::/7','fe80::/10','ff00::/8'];
function setting(d,prov){return one('mci_cdn_setting',id('setting|'+prov+'|'+d));}
function config(d,prov){var row=setting(d,prov);return obj(row&&row.ConfigJson);}
function cleanConfig(v){var c=obj(v);return {SlsRegion:txt(c.SlsRegion).slice(0,40),SlsProject:txt(c.SlsProject).slice(0,63),SlsLogstore:txt(c.SlsLogstore).slice(0,63),DelaySeconds:number(c.DelaySeconds,60,3600,300),MaxLagSeconds:number(c.MaxLagSeconds,60,3600,600),Whitelist:addresses(c.Whitelist,200),AutoEnabled:c.AutoEnabled===true,MaxActionsPerHour:number(c.MaxActionsPerHour,1,100,10)};}
function saveConfig(){var d=domain(p.Domain),prov=provider(p.Provider),c=cleanConfig(p.Config),key=id('setting|'+prov+'|'+d),old=setting(d,prov);var model={Id:key,Domain:d,Provider:prov,ConfigJson:JSON.stringify(c)};if(old)update('mci_cdn_setting',model);else add('mci_cdn_setting',model);return ok(c);}
function configs(d,prov){var r=cloud('Configs',{Domain:d,Provider:prov}),a=list(r.DomainConfigs&&r.DomainConfigs.DomainConfig);return a;}
function args(c){var output={};list(c&&c.FunctionArgs&&c.FunctionArgs.FunctionArg).forEach(function(a){output[txt(a.ArgName)]=txt(a.ArgValue);});return output;}
function findConfig(a,name){var found=a.filter(function(c){return c.FunctionName===name;});if(found.length>1)fail('域名存在多条 '+name+' 配置，请先在阿里云整理条件配置');return found[0]||null;}
function fingerprint(a){return hash(a.map(function(c){var x=args(c);return {ConfigId:txt(c.ConfigId),FunctionName:txt(c.FunctionName),Args:Object.keys(x).sort().map(function(k){return [k,x[k]];})};}).sort(function(a,b){return (a.FunctionName+a.ConfigId).localeCompare(b.FunctionName+b.ConfigId);}));}
function rule(v){var r=obj(v),source=txt(r.Source||'SLS'),mode=txt(r.Mode||'observe');if(['SLS','CDN'].indexOf(source)<0)fail('规则来源无效');if(source==='CDN'){if(r.Metric&&r.Metric!=='bytes'||r.ThresholdType&&r.ThresholdType!=='fixed'||r.Mode==='enforce')fail('CDN域名告警仅支持固定字节阈值，不执行IP封禁');if(Number(r.WindowMinutes||5)%5!==0)fail('CDN告警窗口必须为5分钟的倍数');}if(['observe','enforce'].indexOf(mode)<0)fail('规则模式无效');var metric=txt(r.Metric||'bytes');if(['bytes','requests'].indexOf(metric)<0)fail('指标无效');var thresholdType=txt(r.ThresholdType||'fixed');if(['fixed','dynamic'].indexOf(thresholdType)<0)fail('阈值类型无效');return {Source:source,Mode:mode,Metric:metric,ThresholdType:thresholdType,Threshold:number(r.Threshold,1,1000000000000,1073741824),Multiplier:number(r.Multiplier,2,100,3),BaselineWindows:number(r.BaselineWindows,3,24,7),WindowMinutes:number(r.WindowMinutes,1,60,5),Consecutive:number(r.Consecutive,1,10,2),Duration:number(r.Duration,60,2592000,3600),CooldownSeconds:number(r.CooldownSeconds,60,86400,3600),MaxIps:number(r.MaxIps,1,20,3)};}
function saveRule(){var d=domain(p.Domain),prov=provider(p.Provider),r=rule(p.Rule),key=txt(p.Id)||V8.Method.NewGuid();if(!/^[a-zA-Z0-9-]{1,36}$/.test(key))fail('规则 ID 无效');var old=one('mci_cdn_rule',key);if(old&&(old.Domain!==d||old.Provider!==prov))fail('不能更改规则所属域名');var data={Id:key,Domain:d,Provider:prov,Name:txt(p.Name).slice(0,100)||'CDN 流量规则',Enabled:p.Enabled===true?1:0,Mode:r.Mode,RuleJson:JSON.stringify(r),StateJson:'{}',LastScan:0};if(old)update('mci_cdn_rule',data);else add('mci_cdn_rule',data);var scheduled=V8.Method.SaveScheduleJob({JobName:'mci-cdn-rule-'+key.replace(/-/g,''),JobDesc:'CDN规则 '+data.Name,ApiEngineKey:'mci-cdn-worker',CronExpression:String(parseInt(hash(key).slice(0,2),16)%60)+' * * * * ?',JobParam:JSON.stringify({RuleId:key}),Status:data.Enabled?'正常':'暂停'});if(!scheduled||scheduled.Code!=1){update('mci_cdn_rule',{Id:key,Enabled:0});fail('规则已保存但已停用：调度保存失败，请检查任务引擎。');}must(V8.Method.ManageScheduleJob({Action:data.Enabled?'Resume':'Pause',JobName:'mci-cdn-rule-'+key.replace(/-/g,'')}));return ok(data);}
function command(v){var c=obj(v),action=txt(c.Action),prov=provider(c.Provider),d=domain(c.Domain),duration=number(c.Duration,0,31536000,3600),ips=addresses(c.IPList,100);
    if(['Block','Unblock','GlobalBlock','GlobalUnblock','RateLimit','RemoveRateLimit','Referer','RemoveReferer','SubscribeReports'].indexOf(action)<0)fail('不支持的安全操作');
    if(/Block|Unblock/.test(action)&&!ips.length)fail('请填写 IP / CIDR');
    var settings=config(d,prov),white=builtInWhite.concat(list(settings.Whitelist));
    if(/Block$/.test(action))ips.forEach(function(ip){if(protectedIp(ip,white))fail('IP / CIDR 与保护白名单重叠：'+ip);});
    if(action.indexOf('Global')===0&&ips.length>50)fail('全账号操作每批最多 50 个 IP，便于完整回读');
    if(action.indexOf('Global')===0&&c.ScopeConfirmation!=='ALL_CDN_DOMAINS')fail('全账号封禁必须明确确认 ALL_CDN_DOMAINS');
    var rate=txt(c.Rate||'1m').toLowerCase();if(action==='RateLimit'&&(!/^\d+[km]$/.test(rate)||parseInt(rate)*(rate.endsWith('m')?1024:1)<100))fail('下载限速至少为 100k（KB/s），例如 1m');
    var refs=list(c.Referers).map(function(x){var h=txt(x).toLowerCase();if(h!=='*'&&!/^(\*\.)?[a-z0-9.-]+$/.test(h))fail('Referer 只填写域名或通配域名');return h;});if(refs.length>100)fail('Referer 最多 100 项');
    if(action.indexOf('Global')===0)fail('全账号海量IP写入暂不开放：无法在当前租户证明账号级白名单与并发归属，请使用单域名处置');
    var domains=action==='SubscribeReports'?(c.Domains?list(c.Domains):[d]).map(domain):[];if(action==='SubscribeReports'&&(!domains.length||domains.length>100))fail('订阅必须显式指定1至100个域名');domains=domains.filter(function(x,i,a){return a.indexOf(x)===i;}).sort();
    return {Action:action,Provider:prov,Domain:d,Domains:domains,Duration:duration,IPList:ips,Rate:rate,Referers:refs,AllowEmpty:c.AllowEmpty===true,Reason:txt(c.Reason).slice(0,300),ScopeConfirmation:txt(c.ScopeConfirmation)};
}
function subscriptionPlan(c,before){
    var tasks=list(obj(before.Content).data);if(tasks.length>1)fail('账号报告订阅任务不唯一，拒绝覆盖');var old=tasks[0],domains=c.Domains.slice(),reports=[1,3,5,7,9,11,13,15,17,19,21,23];
    if(old){if(txt(old.status)!=='enable')fail('现有订阅已停用，请先在阿里云确认有效期和启用意图');var prior=list(old.domains);if(!prior.length)fail('现有订阅域名范围缺失，拒绝扩大');if(prior.indexOf('all')>=0)domains=['all'];else prior.map(domain).forEach(function(d){if(domains.indexOf(d)<0)domains.push(d);});list(old.reportId).forEach(function(x){var n=number(x,1,10000,0);if(reports.indexOf(n)<0)reports.push(n);});var end=Date.parse(txt(old.effectiveEnd));if(isFinite(end)&&end<=Date.now())fail('现有订阅已到期，请先在阿里云确认续订意图');}
    return {Domains:domains.sort(),ReportIds:reports.sort(function(a,b){return a-b;}),Existing:!!old,SubId:txt(old&&old.subId),StartTime:txt(old&&old.effectiveFrom),EndTime:txt(old&&old.effectiveEnd)};
}
function snapshot(c){if(c.Action.indexOf('Global')===0)return cloud('GlobalBlocks',{Provider:c.Provider,IPList:c.IPList.slice(0,50).join(',')});if(c.Action==='SubscribeReports')return cloud('ReportList',{Provider:c.Provider});return configs(c.Domain,c.Provider);}
function snapshotHash(c,s){if(c.Action.indexOf('Global')===0)return hash(list(s.Entries).sort(function(a,b){return a.Ip.localeCompare(b.Ip);}));if(c.Action==='SubscribeReports')return hash(s.Content);return fingerprint(s);}
function preview(){var c=command(p.Command),s=snapshot(c),plan=c.Action==='SubscribeReports'?subscriptionPlan(c,s):null,digest=snapshotHash(c,s),expires=now+300;return ok({Command:c,Subscription:plan,Before:s,BeforeHash:digest,ExpiresAt:expires,PreviewToken:hash({Tenant:tenant,Command:c,BeforeHash:digest,ExpiresAt:expires}),Scope:c.Action.indexOf('Global')===0?'当前阿里云账号下全部 CDN 域名':c.Domain,Warning:c.Action.indexOf('Global')===0?'海量 IP 服务需已开通，可能涉及服务费用，影响账号下全部 CDN 域名。':c.Action==='RateLimit'?'这是单请求下载速度限制（KB/s 或 MB/s），不是边缘 QPS 限制。':'提交后创建安全操作，云端配置生效存在传播延迟。'});}
function enqueue(c,before,beforeHash,requestKey,origin,expiryOf){var key=id('operation|'+requestKey),existing=one('mci_cdn_operation',key);if(existing){if(hash(obj(existing.PayloadJson))!==hash(c))fail('幂等请求号已绑定其它操作');return existing;}
    return add('mci_cdn_operation',{Id:key,RequestKey:requestKey,Provider:c.Provider,Domain:c.Domain,Action:c.Action,Status:'Pending',PayloadJson:JSON.stringify(c),BeforeJson:JSON.stringify(before),BeforeHash:beforeHash,ResultJson:'{}',ExpireAt:0,Origin:origin||'Manual',ExpiryOf:expiryOf||'',CreatedBy:txt(p.ActorAccount)||'Scheduler',StartedAt:0});}
function submit(){var c=command(p.Command),expires=number(p.ExpiresAt,now,now+300,0),digest=txt(p.BeforeHash);if(txt(p.PreviewToken)!==hash({Tenant:tenant,Command:c,BeforeHash:digest,ExpiresAt:expires}))fail('确认信息已失效，请重新预览');var request=txt(p.RequestKey);if(!/^[a-zA-Z0-9-]{8,80}$/.test(request))fail('请提供有效幂等请求号');var existing=one('mci_cdn_operation',id('operation|'+request));if(existing){if(hash(obj(existing.PayloadJson))!==hash(c))fail('幂等请求号已绑定其它操作');return ok(existing);}var s=snapshot(c);if(snapshotHash(c,s)!==digest)fail('云端配置已变化，请重新预览');var op=enqueue(c,s,digest,request,'Manual','');return ok(execute(op));}
function functionChange(c,before){var name=/RateLimit$/.test(c.Action)?'limit_rate':/Referer$/.test(c.Action)?'referer_black_list_set':'ip_black_list_set',existing=findConfig(before,name),values=args(existing),remove=c.Action.indexOf('Remove')===0;
    if(name==='ip_black_list_set'){
        if(findConfig(before,'ip_allow_list_set'))fail('域名启用了 IP 白名单，不能同时设置黑名单');
        if(existing&&txt(values.ip_acl_xfwd)!=='off')fail('现有黑名单使用或缺省使用 X-Forwarded-For；请先在阿里云改为 TCP 连接 IP，确保与分析口径一致');
        var ips=addresses(values.ip_list||'',2000),owned=[];
        if(c.Action==='Block')c.IPList.forEach(function(ip){if(ips.indexOf(ip)<0){ips.push(ip);owned.push(ip);}});
        else ips=ips.filter(function(ip){return c.IPList.indexOf(ip)<0;});
        if(ips.length>700&&ips.some(function(ip){return ip.indexOf(':')>=0;}))fail('混合 IPv6 黑名单最多支持 700 项');
        values.ip_list=ips.join(',');if(values.ip_list.length>30000)fail('IP 黑名单超过阿里云长度限制');values.ip_acl_xfwd='off';values.customize_response_status_code=values.customize_response_status_code||'403';remove=!ips.length;
        return {Name:name,Config:existing,Values:values,Remove:remove,Owned:owned};
    }
    if(name==='limit_rate'){values.ali_limit_rate=c.Rate;delete values.traffic_limit_arg;}
    if(name==='referer_black_list_set'){if(findConfig(before,'referer_white_list_set'))fail('域名已配置 Referer 白名单，请先在阿里云协调现有策略');if(!remove&&!c.Referers.length)fail('请填写 Referer 域名');values.refer_domain_deny_list=c.Referers.join(',');values.allow_empty=c.AllowEmpty?'on':'off';}
    return {Name:name,Config:existing,Values:values,Remove:remove,Owned:[]};
}
function apply(c,before){if(c.Action.indexOf('Global')===0)return {Response:cloud('GlobalBlock',{Provider:c.Provider,IPList:c.IPList.join(','),Duration:c.Duration,Unblock:c.Action==='GlobalUnblock'}),Owned:[]};
    if(c.Action==='SubscribeReports'){var plan=subscriptionPlan(c,before);return {Response:cloud('SubscribeReports',{Domain:c.Domain,Provider:c.Provider,Subscription:plan}),Subscription:plan,Owned:[]};}
    var change=functionChange(c,before);if(change.Remove){if(change.Config)cloud('DeleteConfig',{Provider:c.Provider,Domain:c.Domain,ConfigId:change.Config.ConfigId});}
    else {var fn={functionName:change.Name,functionArgs:Object.keys(change.Values).sort().map(function(k){return {argName:k,argValue:change.Values[k]};})};if(change.Config)fn.ConfigId=change.Config.ConfigId;var res=cloud('SetConfigs',{Provider:c.Provider,Domain:c.Domain,Functions:[fn]});var failures=list(res.DomainConfigList&&res.DomainConfigList.DomainConfigModel).filter(function(x){return !Number(x.ConfigId);});if(failures.length)fail('阿里云返回配置失败，请回读核实');}
    return {Owned:change.Owned,Expected:change};
}
function verifies(c,result,after){
    if(c.Action.indexOf('Global')===0){var entries=list(after.Entries);return c.IPList.every(function(ip){var found=entries.filter(function(e){try{return address(e.Ip).value===ip;}catch(_){return false;}});return c.Action==='GlobalUnblock'?found.length===0:found.length>0;});}
    if(c.Action==='SubscribeReports'){var tasks=list(obj(after.Content).data),plan=result.Subscription;if(!plan||tasks.length!==1)return false;var task=tasks[0],ds=list(task.domains).map(txt).sort(),rs=list(task.reportId).map(Number).sort(function(a,b){return a-b;}),end=Date.parse(txt(task.effectiveEnd));return txt(task.status)==='enable'&&JSON.stringify(ds)===JSON.stringify(plan.Domains)&&JSON.stringify(rs)===JSON.stringify(plan.ReportIds)&&(!isFinite(end)||end>Date.now());}
    var expected=result.Expected;if(!expected)return false;var actual=findConfig(after,expected.Name);if(expected.Remove)return !actual;if(!actual)return false;var v=args(actual);return Object.keys(expected.Values).every(function(k){return txt(v[k])===txt(expected.Values[k]);});}
function lease(d,prov,owner){var key=id('setting|'+prov+'|'+d);if(!setting(d,prov))add('mci_cdn_setting',{Id:key,Provider:prov,Domain:d,ConfigJson:JSON.stringify(cleanConfig({})),LeaseUntil:0,LeaseOwner:''});return Number(V8.Db.FromSql('UPDATE mci_cdn_setting SET LeaseOwner=@owner,LeaseUntil=@until WHERE Id=@id AND Tenant=@tenant AND (LeaseUntil IS NULL OR LeaseUntil<@now)').AddInParameter('@owner',owner).AddInParameter('@until',Math.floor(Date.now()/1000)+900).AddInParameter('@id',key).AddInParameter('@tenant',tenant).AddInParameter('@now',Math.floor(Date.now()/1000)).ExecuteNonQuery())===1;}
function renew(d,prov,owner){var clock=Math.floor(Date.now()/1000);if(Number(V8.Db.FromSql('UPDATE mci_cdn_setting SET LeaseUntil=@until WHERE Id=@id AND Tenant=@tenant AND LeaseOwner=@owner AND LeaseUntil>@clock').AddInParameter('@until',clock+900).AddInParameter('@id',id('setting|'+prov+'|'+d)).AddInParameter('@tenant',tenant).AddInParameter('@owner',owner).AddInParameter('@clock',clock).ExecuteNonQuery())!==1)fail('处置租约已失效，拒绝云端写入');}
function release(d,prov,owner){V8.Db.FromSql('UPDATE mci_cdn_setting SET LeaseUntil=0,LeaseOwner=@empty WHERE Id=@id AND Tenant=@tenant AND LeaseOwner=@owner').AddInParameter('@empty','').AddInParameter('@id',id('setting|'+prov+'|'+d)).AddInParameter('@tenant',tenant).AddInParameter('@owner',owner).ExecuteNonQuery();}
function execute(op){if(op&&op.Id)op=one('mci_cdn_operation',op.Id);if(!op||op.Status!=='Pending')return op;if(obj(op.PayloadJson).Action==='RefreshCmsMedia')return cmsExecute(op);var c=obj(op.PayloadJson),owner=V8.Method.NewGuid(),lockDomain=c.Action==='SubscribeReports'?'__subscription__':c.Domain;if(!lease(lockDomain,c.Provider,owner))return op;
    try {
        var claimed=Number(V8.Db.FromSql('UPDATE mci_cdn_operation SET Status=@running,StartedAt=@now WHERE Id=@id AND Tenant=@tenant AND Status=@pending').AddInParameter('@running','Running').AddInParameter('@now',now).AddInParameter('@id',op.Id).AddInParameter('@tenant',tenant).AddInParameter('@pending','Pending').ExecuteNonQuery());if(claimed!==1)return one('mci_cdn_operation',op.Id);
        var before=snapshot(c);if(snapshotHash(c,before)!==op.BeforeHash){update('mci_cdn_operation',{Id:op.Id,Status:'Conflict',ResultJson:JSON.stringify({Message:'云端配置已变化，请重新预览；未执行写入'})});return one('mci_cdn_operation',op.Id);}
        // Save expected ownership before the network write, so crash recovery can inspect it.
        var planned=c.Action==='SubscribeReports'?{Subscription:subscriptionPlan(c,before)}:functionChange(c,before);
        update('mci_cdn_operation',{Id:op.Id,ResultJson:JSON.stringify({Owned:planned.Owned||[],Expected:planned,Subscription:planned.Subscription}),ExpireAt:c.Action==='Block'&&c.Duration?now+c.Duration:0});
        if(op.Origin==='Automatic'){var policy=cleanConfig(config(c.Domain,c.Provider));var count=rows('mci_cdn_operation',[['Domain','=',c.Domain],['Origin','=','Automatic'],['StartedAt','>=',now-3600]],['Id'],policy.MaxActionsPerHour+1);if(!policy.AutoEnabled||count.length>policy.MaxActionsPerHour)fail('域名自动处置已关闭或达到每小时上限');}
        renew(lockDomain,c.Provider,owner);var result=apply(c,before),after=snapshot(c),verified=verifies(c,result,after);
        update('mci_cdn_operation',{Id:op.Id,Status:verified?'Succeeded':'AwaitingVerification',AfterJson:JSON.stringify(after),ResultJson:JSON.stringify(result)});
    } catch(e) {update('mci_cdn_operation',{Id:op.Id,Status:'Unknown',ResultJson:JSON.stringify({Message:txt(e.message).slice(0,400),Previous:obj(one('mci_cdn_operation',op.Id).ResultJson),RequiresReadback:true})});}
    finally {release(lockDomain,c.Provider,owner);}
    return one('mci_cdn_operation',op.Id);
}
function reconcile(op){if(!op||['Running','Unknown','AwaitingVerification'].indexOf(op.Status)<0)return op;if(obj(op.PayloadJson).Action==='RefreshCmsMedia')return cmsReconcile(op);var c=obj(op.PayloadJson),result=obj(op.ResultJson);if(result.Previous)result=result.Previous;var after=snapshot(c),verified=verifies(c,result,after);if(verified)update('mci_cdn_operation',{Id:op.Id,Status:'Succeeded',AfterJson:JSON.stringify(after),ResultJson:JSON.stringify(result)});return one('mci_cdn_operation',op.Id);}
function operations(){return rows('mci_cdn_operation',p.Domain?[['Domain','=',domain(p.Domain)]]:[],['Id','Provider','Domain','Action','Status','Origin','CreateTime','StartedAt','ExpireAt','CreatedBy','PayloadJson','ResultJson','ExpiryOf'],100);}
function expiry(op){
    var result=obj(op.ResultJson),owned=list(result.Owned),c=obj(op.PayloadJson);
    if(!owned.length){update('mci_cdn_operation',{Id:op.Id,ExpireAt:0});return {Skipped:'原有云端黑名单不归本应用到期解封'};}
    var overlaps=rows('mci_cdn_operation',[['Domain','=',op.Domain],['Provider','=',op.Provider],['Action','=','Block'],['Status','In',['Pending','Running','Unknown','Succeeded','AwaitingVerification']]],['Id','Status','PayloadJson','ExpireAt'],1001),defer=0,permanent=false;
    if(overlaps.length>=1000){update('mci_cdn_operation',{Id:op.Id,ExpireAt:now+300});return {DeferredUntil:now+300,Reason:'重叠操作超过安全查询上限'};}
    overlaps.forEach(function(other){if(other.Id===op.Id)return;var payload=obj(other.PayloadJson);if(!list(payload.IPList).some(function(ip){return owned.indexOf(ip)>=0;}))return;if(['Pending','Running','Unknown','AwaitingVerification'].indexOf(other.Status)>=0){defer=Math.max(defer,now+300);return;}if(!Number(payload.Duration))permanent=true;else if(Number(other.ExpireAt)>now)defer=Math.max(defer,Number(other.ExpireAt));});
    if(permanent||defer){update('mci_cdn_operation',{Id:op.Id,ExpireAt:permanent?0:defer});return {DeferredUntil:permanent?'permanent':defer};}
    var commandValue={Action:'Unblock',Provider:c.Provider,Domain:c.Domain,Duration:0,IPList:owned,Reason:'封禁到期自动解封',Rate:'1m',Referers:[],AllowEmpty:false,ScopeConfirmation:''};
    var before=snapshot(commandValue),request='expiry-'+op.Id+'-'+op.ExpireAt;
    var released=execute(enqueue(commandValue,before,snapshotHash(commandValue,before),request,'Expiry',op.Id));
    if(released.Status==='Succeeded')update('mci_cdn_operation',{Id:op.Id,ExpireAt:0,Status:'Expired'});
    return released;
}
// 域名预警只使用计费用量的字节总量；带宽峰值不能积分为账单流量，更不能作为IP封禁证据。
function scanTrafficRule(row,r){
    var state=obj(row.StateJson),width=r.WindowMinutes*60,end=Math.floor((now-900)/width)*width,start=end-width;
    update('mci_cdn_rule',{Id:row.Id,LastScan:now});if(Number(state.LastWindow)===end)return {Skipped:'同一计费用量窗口已处理'};
    var data=cloud('Usage',{Provider:row.Provider,Domain:row.Domain,StartTime:new Date(start*1000).toISOString(),EndTime:new Date(end*1000).toISOString(),Interval:300,Field:'traf',UsageType:'all',DataProtocol:'all',Area:'all'}),samples=list(data.UsageDataPerInterval&&data.UsageDataPerInterval.DataModule),slots={},total=0;
    samples.forEach(function(x){var at=Date.parse(txt(x.TimeStamp))/1000,value=Number(x.Value);if(at>=start&&at<end&&isFinite(value)&&value>=0&&!slots[at]){slots[at]=true;total+=value;}});
    var complete=Number(data.DataInterval)===300;for(var at=start;at<end;at+=300)if(!slots[at])complete=false;
    if(!complete){state.LastError='计费用量采样未完整或实际间隔变化，本次不判定为零流量、不发阈值告警';update('mci_cdn_rule',{Id:row.Id,StateJson:JSON.stringify(state)});return {Skipped:state.LastError};}
    var hits=total>=r.Threshold?(Number(state.LastWindow)===start?Number(state.Hits)||0:0)+1:0,summary={Source:'CDN',WindowStart:start,WindowEnd:end,Bytes:total,Threshold:r.Threshold,Hits:hits,Mode:'alert',DataInterval:300};
    if(hits>=r.Consecutive&&now-(Number(state.LastAlertAt)||0)>=r.CooldownSeconds){
        var event='cdn-alert-'+id(row.Id+'|'+end),opid=id('alert|'+event),existing=one('mci_cdn_operation',opid);
        if(!existing)add('mci_cdn_operation',{Id:opid,RequestKey:event,Provider:row.Provider,Domain:row.Domain,Action:'TrafficAlert',Status:'AlertPending',PayloadJson:JSON.stringify(summary),ResultJson:'{}',Origin:'Rule',ExpireAt:0,StartedAt:now,CreatedBy:'Scheduler'});
        // 接收人来自当前租户主库，固定admin，避免把全体测试/超级管理员自动加入通知。
        var recipient=must(V8.FormEngine.GetTableData('sys_user',{_Where:[['Account','=','admin'],['Level','>=',9999]],_SelectFields:['Id'],_PageSize:2,_ReadPrimary:true}));if(list(recipient).length!==1)fail('CDN预警接收管理员不唯一或不可用');
        var sent=V8.ApiEngine.Run('msg_event',{MsgKey:'cdn_traffic_alert',EventId:event,ReceiverUserIds:[recipient[0].Id],Title:'CDN流量阈值告警',Content:row.Domain+' 在 '+new Date(start*1000).toISOString()+' 至 '+new Date(end*1000).toISOString()+' 使用 '+(total/1073741824).toFixed(3)+' GiB，达到配置阈值。请核对费用与TOP来源。',LinkUrl:'/micro-app/microi-platform-service/system-observability',Payload:{Domain:row.Domain,RuleId:row.Id,WindowStart:start,WindowEnd:end,Bytes:total}}),receipt=sent&&sent.Data||{};
        var succeeded=sent&&sent.Code===1&&Number(receipt.Failed)===0&&Number(receipt.Succeeded)>0&&list(receipt.LogIds).length>0;
        // 重试只复用已确认成功的操作；不能把SkippedDuplicate当成发送成功。
        if(existing&&existing.Status==='AlertSent')succeeded=true;
        update('mci_cdn_operation',{Id:opid,Status:succeeded?'AlertSent':'AlertFailed',ResultJson:JSON.stringify({EventId:event,Claimed:Number(receipt.Claimed)||0,Succeeded:Number(receipt.Succeeded)||0,Failed:Number(receipt.Failed)||0,LogIds:list(receipt.LogIds),Message:succeeded?'站内告警已持久化确认':txt(sent&&sent.Msg||'消息未取得成功回执'),Errors:list(receipt.Errors)})});
        if(!succeeded){state.LastError='站内预警发送失败，保留同一EventId等待核实';update('mci_cdn_rule',{Id:row.Id,StateJson:JSON.stringify(state)});summary.AlertFailed=true;return summary;}state.LastAlertAt=now;summary.AlertEventId=event;
    }
    state.LastWindow=end;state.Hits=hits;state.LastError='';state.LastEvaluation=summary;update('mci_cdn_rule',{Id:row.Id,StateJson:JSON.stringify(state)});return summary;
}
function scanRule(row){
    var selectedRule=rule(obj(row.RuleJson));if(selectedRule.Source==='CDN')return scanTrafficRule(row,selectedRule);
    var r=rule(obj(row.RuleJson)),settings=cleanConfig(config(row.Domain,row.Provider)),state=obj(row.StateJson),end=Math.floor((now-settings.DelaySeconds)/(r.WindowMinutes*60))*r.WindowMinutes*60,start=end-r.WindowMinutes*60;
    update('mci_cdn_rule',{Id:row.Id,LastScan:now});
    if(Number(state.LastWindow)===end)return {Skipped:'同一窗口已处理'};
    var data=cloud('Sls',{Provider:row.Provider,Domain:row.Domain,Config:settings,From:start,To:end,Dimension:'ip',Metric:r.Metric,Top:100});
    if(!data.Complete||data.Truncated===true||data.HealthComplete!==true||!Number(data.LastSeen)||end-Number(data.LastSeen)>settings.MaxLagSeconds||r.Metric==='bytes'&&Number(data.MissingBytes)>0){state.LastError='数据不完整、未及时送达或缺少流量字段，本窗口不执行封禁';update('mci_cdn_rule',{Id:row.Id,StateJson:JSON.stringify(state)});return {Skipped:state.LastError};}
    var history=obj(state.Ips),next={},candidates=[],white=builtInWhite.concat(settings.Whitelist),gap=Number(state.LastWindow)!==start;
    list(data.Rows).forEach(function(entry){var ip;try{ip=address(entry.remote_ip).value;}catch(_){return;}var val=Number(entry[r.Metric])||0,old=obj(history[ip]),samples=gap?[]:list(old.Samples),limit=r.Threshold,ready=true;
        if(r.ThresholdType==='dynamic'){ready=samples.length>=r.BaselineWindows;var sorted=samples.slice().sort(function(a,b){return a-b;});if(ready)limit=Math.max(limit,Number(sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)])*r.Multiplier);}
        var hit=ready&&val>=limit&&!protectedIp(ip,white),hits=hit?(gap?0:Number(old.Hits)||0)+1:0;
        samples.push(val);samples=samples.slice(-r.BaselineWindows);next[ip]={Samples:samples,Hits:hits,LastAction:Number(old.LastAction)||0,Value:val,Threshold:limit,Ready:ready};
        if(hit&&hits>=r.Consecutive&&now-next[ip].LastAction>=r.CooldownSeconds)candidates.push({Ip:ip,Value:val,Threshold:limit});
    });
    candidates.sort(function(a,b){return b.Value-a.Value;});candidates=candidates.slice(0,r.MaxIps);
    var automatic=r.Mode==='enforce'&&settings.AutoEnabled,summary={WindowStart:start,WindowEnd:end,Mode:automatic?'enforce':'observe',Candidates:candidates,SampleCount:list(data.Rows).length,Source:'SLS',IpSource:'remote_ip'};
    state={LastWindow:end,LastScan:now,LastError:'',Ips:next,LastEvaluation:summary};
    // Persist the window before sending any cloud command. The deterministic operation key survives retries.
    candidates.forEach(function(c){next[c.Ip].LastAction=now;});update('mci_cdn_rule',{Id:row.Id,StateJson:JSON.stringify(state)});
    if(!candidates.length)return summary;
    if(!automatic){var observationKey=id('observe|'+row.Id+'|'+end);if(!one('mci_cdn_operation',observationKey))add('mci_cdn_operation',{Id:observationKey,RequestKey:'observe-'+row.Id+'-'+end,Provider:row.Provider,Domain:row.Domain,Action:'RuleObserve',Status:'Observed',PayloadJson:JSON.stringify(summary),ResultJson:JSON.stringify({Message:'观察模式未调用云端封禁'}),Origin:'Rule',ExpireAt:0,StartedAt:now,CreatedBy:'Scheduler'});return summary;}
    var recent=rows('mci_cdn_operation',[['Domain','=',row.Domain],['Origin','=','Automatic'],['StartedAt','>=',now-3600]],['Id'],settings.MaxActionsPerHour+1);
    if(recent.length>=settings.MaxActionsPerHour){summary.Skipped='已达到每小时自动处置上限';return summary;}
    var c=command({Action:'Block',Provider:row.Provider,Domain:row.Domain,Duration:r.Duration,IPList:candidates.map(function(x){return x.Ip;}),Reason:'自动规则 '+row.Name+'：'+r.Metric+'，窗口 '+start+'-'+end}),before=snapshot(c);
    summary.Operation=execute(enqueue(c,before,snapshotHash(c,before),'rule-'+row.Id+'-'+end,'Automatic',''));return summary;
}

// CMS_CDN_DURABLE_REFRESH_OUTBOX_V1. Independent writes precede the external side effect.
function cmsCloud(action,rid,tid,ids){return cloud(action,{Provider:'aliyun',RendId:rid,CmsTaskId:tid,TaskIds:ids||[]});}
function cmsPayload(op){var c=obj(op.PayloadJson);if(c.Action!=='RefreshCmsMedia'||c.Provider!=='aliyun'||!/^[a-zA-Z0-9-]{1,36}$/.test(c.RendId)||!/^[a-zA-Z0-9-]{1,36}$/.test(c.CmsTaskId)||!/^https:\/\/[a-z0-9.-]+(?::\d+)?\//i.test(c.Url)||!/^[a-f0-9]{64}$/.test(c.InputHash))fail('CMS_CDN_OPERATION_INVALID');return c;}
function cmsProof(data,c){if(data.RendId!==c.RendId||data.CmsTaskId!==c.CmsTaskId||data.Url!==c.Url||data.InputHash!==c.InputHash)fail('CMS_CDN_AUTHORITY_DRIFT');return data;}
function cmsReconcile(op){op=one('mci_cdn_operation',op.Id);var c=cmsPayload(op),stored=obj(op.ResultJson),before=obj(op.BeforeJson),tasks=cmsProof(cmsCloud('CmsRefreshTasks',c.RendId,c.CmsTaskId,list(stored.TaskIds)),c),ids=list(stored.TaskIds),observed=list(tasks.Tasks),started=Number(op.StartedAt);
 if(!ids.length){if(stored.CloudWriteStarted!==true||!Object.prototype.hasOwnProperty.call(before,'TaskIds'))return op;var prior=list(before.TaskIds),candidates=observed.filter(function(t){return prior.indexOf(t.TaskId)<0&&Date.parse(t.CreationTime)>=started*1000-5000;});if(candidates.length!==1)return op;ids=[candidates[0].TaskId];stored={TaskIds:ids,CloudWriteStarted:true,RecoveredAfterTransportError:true,RequiresReadback:true};update('mci_cdn_operation',{Id:op.Id,Status:'AwaitingVerification',ResultJson:JSON.stringify(stored)});observed=candidates;}
 var selected=observed.filter(function(t){return ids.indexOf(t.TaskId)>=0;});if(selected.length!==ids.length)return one('mci_cdn_operation',op.Id);
 if(selected.some(function(t){return Date.parse(t.CreationTime)<started*1000-5000;}))fail('CMS_CDN_STALE_TASK');
 if(selected.some(function(t){return t.Status==='Failed';})){update('mci_cdn_operation',{Id:op.Id,Status:'Failed',AfterJson:JSON.stringify(tasks),ResultJson:JSON.stringify({TaskIds:ids,CloudTaskFailed:true,AutomaticResubmission:false})});return one('mci_cdn_operation',op.Id);}
 if(!selected.every(function(t){return t.Status==='Complete'&&t.Process==='100%';}))return one('mci_cdn_operation',op.Id);
 // Original URL only: a cache-busting query cannot establish withdrawal of the old cache key.
 var response=V8.Http.GetResponse({Url:c.Url,RequireSsrfProtection:true,Timeout:15,Headers:{Accept:'*/*'}});if(Number(response.StatusCode)!==404){update('mci_cdn_operation',{Id:op.Id,Status:'AwaitingVerification',AfterJson:JSON.stringify(tasks),ResultJson:JSON.stringify({TaskIds:ids,ProviderComplete:true,OriginalUrlHttpStatus:Number(response.StatusCode)||0,CacheVerified:false,AutomaticResubmission:false})});return one('mci_cdn_operation',op.Id);}
 // Re-read authoritative CMS ownership/version after HTTP; drift fails closed.
 var latest=cmsProof(cmsCloud('CmsRefreshTasks',c.RendId,c.CmsTaskId,ids),c);if(list(latest.Tasks).length!==ids.length||!list(latest.Tasks).every(function(t){return ids.indexOf(t.TaskId)>=0&&t.Status==='Complete'&&t.Process==='100%'&&Date.parse(t.CreationTime)>=started*1000-5000;}))fail('CMS_CDN_TASK_CHANGED');
 update('mci_cdn_operation',{Id:op.Id,Status:'Succeeded',AfterJson:JSON.stringify(tasks),ResultJson:JSON.stringify({TaskIds:ids,ProviderComplete:true,OriginalUrlHttpStatus:404,CacheVerified:true,BrowserCopiesRecallable:false,AutomaticResubmission:false})});return one('mci_cdn_operation',op.Id);
}
function cmsExecute(op){op=one('mci_cdn_operation',op.Id);if(!op||op.Status!=='Pending')return op;var c=cmsPayload(op),owner=V8.Method.NewGuid();if(!lease(c.Domain,c.Provider,owner))return op;
 try{var claimed=Number(V8.Db.FromSql('UPDATE mci_cdn_operation SET Status=@running,StartedAt=@now WHERE Id=@id AND Tenant=@tenant AND Status=@pending').AddInParameter('@running','Running').AddInParameter('@now',now).AddInParameter('@id',op.Id).AddInParameter('@tenant',tenant).AddInParameter('@pending','Pending').ExecuteNonQuery());if(claimed!==1)return one('mci_cdn_operation',op.Id);
 var before=cmsProof(cmsCloud('CmsRefreshTasks',c.RendId,c.CmsTaskId),c);update('mci_cdn_operation',{Id:op.Id,BeforeJson:JSON.stringify(before),BeforeHash:hash(c),ResultJson:JSON.stringify({CloudWriteStarted:true,TaskIds:[],RequiresReadback:true})});
 var accepted=cmsProof(cmsCloud('RefreshCmsMedia',c.RendId,c.CmsTaskId),c);if(accepted.Accepted!==true||!list(accepted.TaskIds).length)fail('CMS_CDN_ACCEPTANCE_MISSING');
 update('mci_cdn_operation',{Id:op.Id,Status:'AwaitingVerification',ResultJson:JSON.stringify({TaskIds:list(accepted.TaskIds),CloudWriteStarted:true,ProviderRequestId:accepted.ProviderRequestId,Accepted:true,CacheVerified:false,RequiresReadback:true})});return cmsReconcile(one('mci_cdn_operation',op.Id));
 }catch(e){var current=one('mci_cdn_operation',op.Id),prior=obj(current.ResultJson);update('mci_cdn_operation',{Id:op.Id,Status:'Unknown',ResultJson:JSON.stringify({TaskIds:list(prior.TaskIds),CloudWriteStarted:prior.CloudWriteStarted===true,Accepted:prior.Accepted===true,RequiresReadback:true,AutomaticResubmission:false,Reason:'CMS_CDN_OUTCOME_UNKNOWN'})});return one('mci_cdn_operation',op.Id);}
 finally{release(c.Domain,c.Provider,owner);}
}
function cmsSubmit(){['Url','Urls','ObjectPath','ObjectType','Command','Domain','Provider','TaskIds','RequestKey','Endpoint','Config'].forEach(function(k){if(p[k]!==undefined)fail('CMS_CDN_UNTRUSTED_ARGUMENT');});var rid=txt(p.RendId),tid=txt(p.CmsTaskId),discovery=cmsCloud('CmsRefreshTasks',rid,tid),match=/^https:\/\/([^/:]+)(?::\d+)?\//i.exec(discovery.Url);if(!match)fail('CMS_CDN_AUTHORITY_URL');var c={Action:'RefreshCmsMedia',Provider:'aliyun',Domain:domain(match[1]),RendId:discovery.RendId,CmsTaskId:discovery.CmsTaskId,Url:discovery.Url,InputHash:discovery.InputHash},request='cms-revoke-'+tid,op=one('mci_cdn_operation',id('operation|'+request));
 if(op){if(hash(c)!==hash(cmsPayload(op)))fail('CMS_CDN_REQUEST_CONFLICT');return ok(op.Status==='Pending'?cmsExecute(op):['Running','Unknown','AwaitingVerification'].indexOf(op.Status)>=0?cmsReconcile(op):op);}
 var created=enqueue(c,discovery,hash(c),request,'CmsRevocation','');return ok(cmsExecute(created));
}
function cmsStatus(){var op=one('mci_cdn_operation',txt(p.Id));if(!op||obj(op.PayloadJson).Action!=='RefreshCmsMedia')fail('CMS_CDN_OPERATION_NOT_FOUND');return ok(['Running','Unknown','AwaitingVerification'].indexOf(op.Status)>=0?cmsReconcile(op):op);}

function worker(){
    var owner=V8.Method.NewGuid();if(!lease('__worker__','aliyun',owner))return ok({Skipped:'另一个节点正在运行'});
    try {
        var pending=rows('mci_cdn_operation',[['Status','=','Pending']],['Id','Status','PayloadJson','BeforeHash'],1);if(pending.length)return ok(execute(pending[0]));
        var uncertain=rows('mci_cdn_operation',[['Status','In',['Running','Unknown','AwaitingVerification']],['StartedAt','<',now-300]],['Id','Status','PayloadJson','ResultJson','ExpiryOf'],10,'UpdateTime',true);
        uncertain.forEach(function(item){try{var recover=reconcile(item);if(recover.Status==='Succeeded'&&recover.ExpiryOf)update('mci_cdn_operation',{Id:recover.ExpiryOf,Status:'Expired',ExpireAt:0});}catch(e){var result=obj(item.ResultJson);result.LastReadbackAt=now;result.ReadbackError=txt(e.message).slice(0,300);update('mci_cdn_operation',{Id:item.Id,ResultJson:JSON.stringify(result)});}});
        var due=rows('mci_cdn_operation',[['Status','=','Succeeded'],['ExpireAt','>',0],['ExpireAt','<=',now]],['Id','Provider','Domain','PayloadJson','ResultJson','ExpireAt'],1);if(due.length)return ok(expiry(due[0]));
        // Each rule has its own staggered, leased schedule; this sweep only handles durable operations.
        return ok({Idle:true});
    } finally {release('__worker__','aliyun',owner);}
}
try {
    var action=txt(p.Action);
    if(action==='RefreshCmsMedia')return cmsSubmit();if(action==='CmsRefreshStatus')return cmsStatus();
    if(action==='Capabilities')return ok({Providers:[cloud('Capabilities',{Provider:'aliyun'}),{Provider:'tencent',Configured:false,Message:'适配器预留，尚未开放'}],DefaultMode:'observe',SchedulerRequired:true});
    if(action==='SaveConfig')return saveConfig();
    if(action==='Readiness'){var readinessDomain=domain(p.Domain),cfg=cleanConfig(config(readinessDomain,provider(p.Provider))),rr=rows('mci_cdn_rule',[['Domain','=',readinessDomain]],['Id','Enabled','RuleJson','StateJson','LastScan'],100),subs=cloud('ReportList',{Provider:'aliyun'});return ok({Domain:readinessDomain,SlsConfigured:!!(cfg.SlsRegion&&cfg.SlsProject&&cfg.SlsLogstore),AutoEnabled:cfg.AutoEnabled,WhitelistCount:cfg.Whitelist.length,RuleCount:rr.length,EnabledRuleCount:rr.filter(function(x){return Number(x.Enabled)===1;}).length,Rules:rr,Subscriptions:subs,Notice:'未配置或无数据表示监控未就绪，不表示无异常。域名流量告警不依赖SLS；IP自动处置仍需可信新鲜日志。'});}
    if(action==='Config')return ok(cleanConfig(config(domain(p.Domain),provider(p.Provider))));
    if(action==='SaveRule')return saveRule();
    if(action==='DeleteRule'){var removed=one('mci_cdn_rule',txt(p.Id));if(!removed)fail('规则不存在');update('mci_cdn_rule',{Id:removed.Id,Enabled:0});must(V8.Method.ManageScheduleJob({Action:'Delete',JobName:'mci-cdn-rule-'+removed.Id.replace(/-/g,'')}));must(V8.FormEngine.DelFormData('mci_cdn_rule',{Id:removed.Id}));return ok({Deleted:true,Id:removed.Id});}
    if(action==='Rules')return ok(rows('mci_cdn_rule',p.Domain?[['Domain','=',domain(p.Domain)]]:[],['Id','Name','Domain','Provider','Enabled','Mode','RuleJson','StateJson','LastScan'],100));
    if(action==='Preview')return preview();
    if(action==='Submit')return submit();
    if(action==='Operations')return ok(operations());
    if(action==='Reconcile'){var op=one('mci_cdn_operation',txt(p.Id));if(!op)fail('操作不存在');return ok(reconcile(op));}
    if(action==='Worker')return worker();
    if(action==='RuleTick'||action==='EvaluateRule'){var target=one('mci_cdn_rule',txt(p.Id));if(!target||Number(target.Enabled)!==1)return ok({Skipped:'规则未启用'});var ruleOwner=V8.Method.NewGuid(),lockName='rule-'+target.Id;if(!lease(lockName,target.Provider,ruleOwner))return ok({Skipped:'规则正在另一节点执行'});try{return ok(scanRule(target));}catch(scanError){
        // 云权限或网络失败必须留在规则状态中；不推进成功窗口，下一轮可安全重试。
        var failedState=obj((one('mci_cdn_rule',target.Id)||target).StateJson);failedState.LastError=txt(scanError.message||'规则扫描失败').slice(0,300);failedState.LastFailureAt=now;update('mci_cdn_rule',{Id:target.Id,LastScan:now,StateJson:JSON.stringify(failedState)});throw scanError;
    }finally{release(lockName,target.Provider,ruleOwner);}}
    if(['Domains','Trend','Usage','CacheHit','OriginTraffic','Billing','StorageHealth','StorageLogs','StorageLogDownload','Logs','LogDownload','LogDelivery','ReportList','Reports','Configs','GlobalBlocks'].indexOf(action)>=0)return ok(cloud(action,p));
    if(action==='Sls'){var slsDomain=domain(p.Domain),slsProvider=provider(p.Provider);return ok(cloud('Sls',{Provider:slsProvider,Domain:slsDomain,Config:config(slsDomain,slsProvider),From:p.From,To:p.To,Dimension:p.Dimension,Metric:p.Metric,Top:p.Top,Ip:p.Ip}));}
    return {Code:0,Msg:'不支持的 CDN 管理动作'};
} catch(e){return {Code:0,Msg:txt(e.message||'CDN 操作失败').slice(0,400),Data:e.result&&e.result.Data};}



