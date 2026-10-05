/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【官方应用托管接口，请勿承载个性化代码】所属官方应用：SaaS引擎
 * ApiEngineKey: platform-saas-promotion; Managed; Version: v1.0.0
 * 主租户推广授权、台账、链接和跟进；扩展使用 platform-saas-promotion-hook。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-promotion
 * Version: v1.0.4
 * Function:
 * - 主租户推广授权、推荐归属、试用跟进、团队与用量统计、推广链接及公开开通配置。
 */

var authorization = V8.Method.AuthorizeSaasPromotion();
if (authorization.Code !== 1) return authorization;
var actor = JSON.parse(JSON.stringify(authorization.Data));
var p = JSON.parse(JSON.stringify(V8.Param || {}));
var action = String(p.Action || 'Dashboard');
function fail(message) { return { Code: 0, Msg: message }; }
function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
// Jint 将 DateTime 值转换为 JavaScript Date，使用标准 UTC 字符串避免依赖 .NET 实例方法。
function utcTime(ms) { return new Date(ms).toISOString().slice(0,19).replace('T',' '); }
function now() { return utcTime(Date.now()); }
function integer(value, fallback, max) { var n = Number(value); return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback; }
function rows(sql, params) {
  var q = V8.Db.FromSql(sql);
  Object.keys(params || {}).forEach(function(key) { q = q.AddInParameter('@' + key, params[key]); });
  return JSON.parse(JSON.stringify(q.ToArray()));
}
function write(sql, params) {
  var q = V8.Db.FromSql(sql);
  Object.keys(params).forEach(function(key) { q = q.AddInParameter('@' + key, params[key]); });
  return Number(q.ExecuteNonQuery());
}
var scope = { main: actor.OsClient, type: actor.OsClientType, network: actor.OsClientNetwork, actor: actor.UserId };
var partition = ' AND OsClientType=@type AND OsClientNetwork=@network';
var tenantWhere = ' WHERE (IsDeleted IS NULL OR IsDeleted=0) AND OsClient<>@main' + partition + (actor.CanViewAll ? '' : ' AND ReferralUserId=@actor');
var linkWhere = ' WHERE (IsDeleted IS NULL OR IsDeleted=0)' + partition + (actor.CanViewAll ? '' : ' AND ReferralUserId=@actor');
var tenantFields = 'Id,OsClient,ClientName,IsEnable,CreateTime,ReferralUserId,ReferralLinkId,TrialStartTime,TrialEndTime,PromotionStage,PromotionContact,PromotionPhone,PromotionNotes,PromotionNextFollowup,SignupSource,PublicTrialProvisioned';
var linkFields = 'Id,Title,ReferralUserId,IsEnable,ExpiresAt,MaxTenants,TrialDays,CreateTime,Remark';
function settings() {
  var r = rows('SELECT Id,SaasPublicTrialEnabled,SaasPublicTrialDays,SaasPublicTrialDailyLimit,SaasPublicTrialLinkLimit,SaasPublicTrialWebBase,SaasPromotionManagerRoleIds FROM sys_osclients WHERE OsClient=@main' + partition + ' AND (IsDeleted IS NULL OR IsDeleted=0)', scope);
  if (r.length !== 1) throw new Error('当前运行分区的主租户配置必须唯一。');
  return r[0];
}
function users() {
  var sql = 'SELECT Id,Name,Account FROM sys_user WHERE State=1 AND (IsDeleted IS NULL OR IsDeleted=0)';
  if (!actor.CanViewAll) sql += ' AND Id=@actor';
  return rows(sql + ' ORDER BY Name LIMIT 1000', scope);
}
function activeUser(id) {
  if (!actor.CanViewAll && id !== actor.UserId) return false;
  return rows('SELECT Id FROM sys_user WHERE Id=@id AND State=1 AND (IsDeleted IS NULL OR IsDeleted=0)', { id: id }).length === 1;
}
function state(t) {
  if (Number(t.IsEnable) !== 1) return 'Disabled';
  if (t.PromotionStage === 'Converted') return 'Converted';
  if (!t.TrialEndTime) return 'Unclassified';
  var end = new Date(String(t.TrialEndTime).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(end)) return 'Unclassified';
  return end <= Date.now() ? 'Expired' : end <= Date.now() + 3 * 86400000 ? 'Expiring' : 'Trial';
}
function decorate(list) {
  var names = {}; users().forEach(function(u) { names[u.Id] = u.Name || u.Account; });
  return list.map(function(t) { t.TrialState = state(t); t.ReferralUserName = names[t.ReferralUserId] || (t.ReferralUserId ? '账号未加载或已停用' : '未分配'); return t; });
}
function tenants() { return decorate(rows('SELECT ' + tenantFields + ' FROM sys_osclients' + tenantWhere + ' ORDER BY CreateTime DESC LIMIT 5001', scope)); }
function filtered(list) {
  var keyword = text(p.Keyword, 100).toLowerCase();
  return list.filter(function(t) {
    return (!keyword || [t.OsClient,t.ClientName,t.PromotionContact,t.PromotionPhone,t.ReferralUserName].join(' ').toLowerCase().indexOf(keyword) >= 0)
      && (!p.State || t.TrialState === p.State) && (!p.ReferralUserId || t.ReferralUserId === p.ReferralUserId)
      && (!p.FromDate || String(t.CreateTime || '').slice(0,10) >= text(p.FromDate,10))
      && (!p.ToDate || String(t.CreateTime || '').slice(0,10) <= text(p.ToDate,10));
  });
}
function hook(event, data) {
  var r = V8.ApiEngine.Run('platform-saas-promotion-hook', { Event: event, Actor: { Id: actor.UserId, CanViewAll: actor.CanViewAll }, Data: data });
  return r && r.Code === 1 ? null : r || fail('租户扩展校验未通过。');
}
try {
  if (action === 'Bootstrap') {
    var defaults=settings();if(!actor.CanConfigure)delete defaults.SaasPromotionManagerRoleIds;
    return { Code:1, Data:{ Actor:actor, Users:users(), Settings: defaults,
    Roles: actor.CanConfigure ? rows('SELECT Id,Name FROM sys_role WHERE IsDeleted IS NULL OR IsDeleted=0 ORDER BY Name', {}) : [], ServerTime:now() } };
  }
  if (action === 'Usage') return V8.Method.ReadSaasTenantUsage({ TenantIds:p.TenantIds, Refresh:p.Refresh === true });
  if (['Dashboard','Tenants','Trials','Team','Export'].indexOf(action) >= 0) {
    var list = tenants();
    if (list.length > 5000) return fail('当前授权租户超过 5000 个，请按团队拆分授权范围后查询。');
    if (action === 'Dashboard' || action === 'Team') {
      var counts = { Total:list.length,Trial:0,Expiring:0,Expired:0,Converted:0,Disabled:0,Unclassified:0,Unassigned:0,New30Days:0,FollowupDue:0 };
      var team = {}, days = {}, current = now(), since = utcTime(Date.now() - 30 * 86400000);
      users().forEach(function(u) { team[u.Id] = { Id:u.Id,Name:u.Name || u.Account,Total:0,Trial:0,Expiring:0,Expired:0,Converted:0,New30Days:0 }; });
      list.forEach(function(t) {
        counts[t.TrialState] += 1; if (!t.ReferralUserId) counts.Unassigned++;
        var fresh = String(t.CreateTime || '') >= since; if (fresh) { counts.New30Days++; var day=String(t.CreateTime).slice(0,10); days[day]=(days[day]||0)+1; }
        if (t.PromotionNextFollowup && t.PromotionNextFollowup <= current && t.TrialState !== 'Converted') counts.FollowupDue++;
        var key=t.ReferralUserId || 'unassigned';
        if (!team[key]) team[key]={ Id:key,Name:t.ReferralUserName,Total:0,Trial:0,Expiring:0,Expired:0,Converted:0,New30Days:0 };
        var member=team[key]; member.Total++; if (member[t.TrialState] !== undefined) member[t.TrialState]++; if (fresh) member.New30Days++;
      });
      return { Code:1, Data:{ Counts:counts,Team:Object.keys(team).map(function(k){return team[k];}).sort(function(a,b){return b.Total-a.Total;}),
        NewTenantTrend:Object.keys(days).sort().map(function(day){return {Day:day,Tenants:days[day]};}),
        Attention:list.filter(function(t){return ['Expiring','Expired'].indexOf(t.TrialState)>=0 || t.PromotionNextFollowup && t.PromotionNextFollowup<=current;}).slice(0,20),
        Recent:list.slice(0,10),UsageTargets:list.map(function(t){return {Id:t.Id,ReferralUserId:t.ReferralUserId||'unassigned'};}),ServerTime:current,Scope:actor.CanViewAll?'All':'Own' } };
    }
    list = filtered(list);
    if (action === 'Trials') list=list.filter(function(t){return ['Trial','Expiring','Expired'].indexOf(t.TrialState)>=0;});
    if (action === 'Export') return { Code:1,Data:{Items:list,ServerTime:now()} };
    var page=integer(p.Page,1,100000), size=integer(p.PageSize,20,20);
    return { Code:1,Data:{Items:list.slice((page-1)*size,page*size),Total:list.length,Page:page,PageSize:size,ServerTime:now()} };
  }
  if (action === 'TenantDetail') {
    var detail=decorate(rows('SELECT ' + tenantFields + ' FROM sys_osclients' + tenantWhere + ' AND Id=@id', Object.assign({},scope,{id:text(p.Id,50)})));
    return detail.length===1 ? {Code:1,Data:detail[0]} : {Code:1002,Msg:'租户不在当前授权范围内。'};
  }
  if (action === 'UpdateFollowup' || action === 'Assign') {
    var target=rows('SELECT Id,ReferralUserId FROM sys_osclients' + tenantWhere + ' AND Id=@id',Object.assign({},scope,{id:text(p.Id,50)}));
    if (target.length !== 1) return {Code:1002,Msg:'租户不在当前授权范围内。'};
    var values=Object.assign({},scope,{id:target[0].Id});
    var set='';
    if (action==='Assign') {
      if (!actor.CanViewAll || !activeUser(text(p.ReferralUserId,50))) return {Code:1002,Msg:'只有管理者可以分配给有效的主租户用户。'};
      values.ref=text(p.ReferralUserId,50); set='ReferralUserId=@ref';
    } else {
      if (['Trial','Converted'].indexOf(p.Stage)<0) return fail('请选择试用或已转化状态。');
      var due=text(p.NextFollowup,25); if(due && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(due)) return fail('跟进时间格式不正确。');
      values.stage=p.Stage;values.notes=text(p.Notes,5000);values.due=due||null;set='PromotionStage=@stage,PromotionNotes=@notes,PromotionNextFollowup=@due';
    }
    var blocked=hook(action, {TenantId:target[0].Id,ReferralUserId:values.ref||target[0].ReferralUserId,Stage:values.stage}); if(blocked)return blocked;
    var affected=write('UPDATE sys_osclients SET '+set+',UpdateTime=@updated'+tenantWhere+' AND Id=@id',Object.assign(values,{updated:now()}));
    return affected===1?{Code:1,Msg:'已保存。'}:fail('记录归属已变化，请刷新后重试。');
  }
  if (action === 'Links') {
    var links=rows('SELECT '+linkFields+' FROM mci_saas_referral_link'+linkWhere+' ORDER BY CreateTime DESC LIMIT 500',scope);
    var totals=rows('SELECT ReferralLinkId,COUNT(*) AS Total FROM sys_osclients'+tenantWhere+' AND ReferralLinkId IS NOT NULL GROUP BY ReferralLinkId',scope);
    var counts={};totals.forEach(function(t){counts[t.ReferralLinkId]=Number(t.Total);});
    links.forEach(function(l){l.Tenants=counts[l.Id]||0;});return {Code:1,Data:{Items:links}};
  }
  if (action === 'CreateLink') {
    var owner=text(p.ReferralUserId || actor.UserId,50); if(!activeUser(owner))return {Code:1002,Msg:'推荐人不可用或超出权限。'};
    var title=text(p.Title,100);if(!title)return fail('请输入推广活动名称。');
    var config=settings();var days=integer(p.TrialDays,Number(config.SaasPublicTrialDays)||14,90);
    var cap=integer(p.MaxTenants,Number(config.SaasPublicTrialLinkLimit)||50,10000);
    if(!actor.CanViewAll && (days>(Number(config.SaasPublicTrialDays)||14)||cap>(Number(config.SaasPublicTrialLinkLimit)||50)))return fail('业务员只能在主租户配置的试用期限和开通额度内创建链接。');
    var rejected=hook('BeforeCreateLink',{ReferralUserId:owner,Title:title,TrialDays:days,MaxTenants:cap});if(rejected)return rejected;
    var id=V8.Method.NewGuid();
    var added=V8.FormEngine.AddFormData('mci_saas_referral_link',{Id:id,Title:title,ReferralUserId:owner,IsEnable:1,
      ExpiresAt:utcTime(Date.now() + integer(p.ValidDays,30,365) * 86400000),MaxTenants:cap,TrialDays:days,
      CapabilityRevision:V8.Method.NewGuid(),OsClientType:actor.OsClientType,OsClientNetwork:actor.OsClientNetwork,Remark:text(p.Remark,1000)});
    return added.Code===1?{Code:1,Data:{Id:id}}:added;
  }
  if (action === 'UpdateLink') {
    var link=rows('SELECT Id FROM mci_saas_referral_link'+linkWhere+' AND Id=@id',Object.assign({},scope,{id:text(p.Id,50)}));
    if(link.length!==1)return {Code:1002,Msg:'推广链接不在授权范围内。'};
    var changed=write('UPDATE mci_saas_referral_link SET IsEnable=@enabled,CapabilityRevision=@revision,UpdateTime=@updated'+linkWhere+' AND Id=@id',Object.assign({},scope,{id:link[0].Id,enabled:p.Enabled===true?1:0,revision:V8.Method.NewGuid(),updated:now()}));
    return changed===1?{Code:1,Msg:'链接状态已更新，旧分享地址已失效。'}:fail('链接归属已变化。');
  }
  if (action === 'ShareLink') {
    var capability=V8.Method.CreateSaasReferralCapability(text(p.Id,50));if(capability.Code!==1)return capability;
    var base=text(settings().SaasPublicTrialWebBase,2000).replace(/\/$/,'');
    if(!/^https:\/\//i.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base))return fail('管理员尚未配置公开开通 Web 地址。');
    var capData=JSON.parse(JSON.stringify(capability.Data));
    return {Code:1,Data:{Url:base+'/?OsClient='+encodeURIComponent(actor.OsClient)+'#/micro-app/microi-platform-service/saas-trial?ref='+encodeURIComponent(capData.ReferralUserId)+'&link='+encodeURIComponent(capData.LinkToken)}};
  }
  if(action==='SaveSettings') {
    if(!actor.CanConfigure)return {Code:1002,Msg:'只有平台管理员可以配置公开开通和管理角色。'};
    var web=text(p.WebBase,2000).replace(/\/$/,'');
    if(!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9_\/-]*)?$/.test(web) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(web))return fail('Web 地址应为 HTTPS；本地测试允许 localhost HTTP。');
    var roleIds=p.ManagerRoleIds || []; if(!Array.isArray(roleIds)||roleIds.length>100)return fail('管理角色格式不正确。');
    var roles=rows('SELECT Id FROM sys_role WHERE IsDeleted IS NULL OR IsDeleted=0',{}).map(function(r){return r.Id;});
    if(roleIds.some(function(id){return roles.indexOf(id)<0;}))return fail('存在不可用的主租户角色。');
    var row=settings();
    var saved=V8.FormEngine.UptFormData('sys_osclients',{Id:row.Id,SaasPublicTrialEnabled:p.Enabled===true?1:0,
      SaasPublicTrialDays:integer(p.TrialDays,14,90),SaasPublicTrialDailyLimit:integer(p.DailyLimit,20,10000),
      SaasPublicTrialLinkLimit:integer(p.LinkLimit,50,10000),SaasPublicTrialWebBase:web,SaasPromotionManagerRoleIds:JSON.stringify(roleIds)});
    return saved;
  }
  if(action==='ResumeTask') return V8.Method.ResumeSaasPublicTrialTask(text(p.Id,50));
  if(action==='Tasks') {
    var owned=rows('SELECT Id FROM mci_saas_referral_link'+linkWhere,scope).map(function(r){return r.Id;});
    if(!owned.length)return {Code:1,Data:{Items:[]}};
    var taskParams=Object.assign({},scope,{engine:'platform-saas-public-trial-worker'}), place=[];
    owned.slice(0,500).forEach(function(id,i){taskParams['l'+i]=id;place.push('@l'+i);});
    var tasks=rows('SELECT Id,Title,Status,Progress,CreateTime,EndTime,BusinessId FROM mci_background_task WHERE ApiEngineKey=@engine AND RuntimeOsClientType=@type AND RuntimeOsClientNetwork=@network AND BusinessId IN ('+place.join(',')+') ORDER BY CreateTime DESC LIMIT 50',taskParams);
    return {Code:1,Data:{Items:tasks}};
  }
  return fail('不支持的推广动作。');
} catch(e) { return fail('推广操作暂时失败，请确认 SaaS 应用与后端已更新。'); }
