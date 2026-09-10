/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-message-notification-config
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-message-notification-config
 * Version: v1.0.1
 * Function:
 * - 当前租户管理员统一维护原 mic_msgset 多渠道配置，按配置版本安全保存，查询用户、角色、模板、适配器与脱敏投递记录；配置校验不发送消息，实际投递继续由 msg_event 编排。
 */

var p = V8.Param || {};
var channels = ['平台内部','邮件','短信','微信公众号模板消息'];
var fields = ['Id','Key','Title','Type','IsEnable','Receivers','ReceiversRoles','WxTplMsgId','ChannelApiEngineMap','ConfigRevision','UpdateTime'];
function checked(result) {
  if (!result || Number(result.Code) !== 1) throw new Error(result && result.Msg || '操作未完成。');
  return result;
}
function text(value) { return String(value == null ? '' : value).trim(); }
function identifier(value) {
  var result = text(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(result)) throw new Error('数据标识格式无效。');
  return result;
}
// 兼容历史 Select 保存的字符串、JSON、对象数组；新数据统一保存 Id 数组。
function list(value, limit) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (_) { value = value.split(','); }
  }
  if (value && typeof value.length !== 'number') throw new Error('接收对象必须为列表。');
  var result = [], seen = Object.create(null);
  for (var i = 0; value && i < value.length; i++) {
    var item = value[i], id = identifier(typeof item === 'object' ? item.Id : item);
    if (!seen[id.toLowerCase()]) { result.push(id); seen[id.toLowerCase()] = true; }
  }
  if (result.length > limit) throw new Error('接收对象超出允许数量。');
  return result;
}
function page(value, fallback, maximum) {
  var result = Number(value || fallback);
  if (!isFinite(result) || result < 1 || result > maximum || Math.floor(result) !== result) throw new Error('分页参数无效。');
  return result;
}
// 每个动作只读取所需列，列表始终分页，敏感帐号配置不进入此接口。
function query(table, where, selected, limit) {
  return checked(V8.FormEngine.GetTableData(table, {
    _Where: where || [], _SelectFields: selected,
    _PageIndex: page(p.PageIndex,1,100000), _PageSize: limit || page(p.PageSize,50,100),
    _OrderBy: 'Id', _OrderByType: 'DESC'
  }, V8.DbTrans));
}
function get(id) {
  var result = V8.FormEngine.GetFormData('mic_msgset', {Id:identifier(id),_SelectFields:fields}, V8.DbTrans);
  if (Number(result.Code) === 2) throw new Error('消息通知配置不存在。');
  return checked(result).Data;
}
function json(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  // HTTP 参数可能是 .NET JObject，Jint 会为其暴露 length=Count；先还原为普通
  // JSON 值再检查对象/数组，避免空或非空适配器映射被误判为数组。
  return JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
}
function project(row) {
  return {Id:row.Id,Key:row.Key,Title:row.Title,Type:channelList(row.Type),IsEnable:row.IsEnable === true || Number(row.IsEnable) === 1,
    Receivers:list(row.Receivers,200),ReceiversRoles:list(row.ReceiversRoles,50),WxTplMsgId:row.WxTplMsgId || '',
    ChannelApiEngineMap:json(row.ChannelApiEngineMap,{}),ConfigRevision:Number(row.ConfigRevision || 0),UpdateTime:row.UpdateTime};
}
// 同一批取回选定对象，避免按用户/角色循环查询；仅核验当前租户的有效记录。
function verifyIds(table, ids, conditions) {
  if (!ids.length) return;
  var result = checked(V8.FormEngine.GetTableData(table, {_Where:[['Id','In',ids]].concat(conditions || []),_SelectFields:['Id'],_PageIndex:1,_PageSize:ids.length}, V8.DbTrans));
  var present = Object.create(null);
  for (var i=0;result.Data && i<result.Data.length;i++) present[String(result.Data[i].Id).toLowerCase()] = true;
  if (ids.some(function(id){return !present[id.toLowerCase()];})) throw new Error('部分选定对象已停用、不存在或不属于当前租户。');
}
function channelList(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { value = value.split(','); } }
  return value || [];
}
function normalize(input) {
  input = input || {};
  var key = identifier(input.Key), title = text(input.Title);
  if (key.length > 50 || !title || title.length > 50) throw new Error('消息 Key 和标题为必填项，最多 50 个字符。');
  var types = channelList(input.Type), selected = [], enabled = input.IsEnable === true || Number(input.IsEnable) === 1;
  if (!types || typeof types.length !== 'number' || typeof types === 'string') throw new Error('通知通道必须为列表。');
  for (var i=0;i<types.length;i++) {
    var channel = text(types[i]);
    if (channels.indexOf(channel) < 0) throw new Error('通知通道无效。');
    if (selected.indexOf(channel)<0) selected.push(channel);
  }
  if (!selected.length) throw new Error('至少选择一个通知通道。');
  var receivers = list(input.Receivers,200), roles = list(input.ReceiversRoles,50);
  // 停用旧配置不依赖接收人仍存在；再次启用时必须重新核验，避免失效对象阻止停用。
  if (enabled) { verifyIds('sys_user',receivers,[['State','=',1]]); verifyIds('sys_role',roles); }
  var adapters = json(input.ChannelApiEngineMap,{}), safeAdapters = {}, keys = [];
  if (!adapters || typeof adapters !== 'object' || typeof adapters.length === 'number') throw new Error('通道适配器格式无效。');
  for (var name in adapters) {
    if (!Object.prototype.hasOwnProperty.call(adapters,name)) continue;
    if (['邮件','短信'].indexOf(name)<0) throw new Error('仅邮件和短信可配置自定义适配器，不能在此填写密钥。');
    if (text(adapters[name])) { var adapter = identifier(adapters[name]); safeAdapters[name]=adapter; if(keys.indexOf(adapter)<0)keys.push(adapter); }
  }
  if (enabled && keys.length) {
    var engines = checked(V8.FormEngine.GetTableData('sys_apiengine',{_Where:[['ApiEngineKey','In',keys],['IsEnable','=',1]],_SelectFields:['ApiEngineKey'],_PageIndex:1,_PageSize:keys.length},V8.DbTrans)).Data || [];
    var found=Object.create(null); for(var n=0;n<engines.length;n++)found[String(engines[n].ApiEngineKey).toLowerCase()]=true;
    if(keys.some(function(k){return !found[k.toLowerCase()];}))throw new Error('适配器接口不存在或未启用。');
  }
  var template = text(input.WxTplMsgId);
  if (template) identifier(template);
  if (enabled && template) verifyIds('wx_tpl_msg',[template]);
  var warnings=[];
  for(var c=0;c<selected.length;c++) {
    var name=selected[c];
    if (['邮件','短信'].indexOf(name)>=0 && !safeAdapters[name]) warnings.push(name+'尚未选择通道适配器。');
    if (name==='微信公众号模板消息' && !template) warnings.push('尚未选择微信消息模板。');
  }
  if (enabled && warnings.length) throw new Error(warnings.join(' '));
  if(!receivers.length&&!roles.length)warnings.push('未设置固定接收人，业务调用时需传入接收帐号。');
  return {Rule:{Key:key,Title:title,Type:selected,IsEnable:enabled,Receivers:receivers,ReceiversRoles:roles,WxTplMsgId:template,ChannelApiEngineMap:safeAdapters},Warnings:warnings};
}
try {
  var capabilities=checked(V8.ApiEngine.Run('platform-reminder-runtime',{Action:'Capabilities'},V8.DbTrans)).Data;
  if (!capabilities || !capabilities.Administrator) return {Code:0,Msg:'只有当前租户的平台管理员可以维护消息通知。'};
  var action=text(p.Action || 'Capabilities');
  if(action==='Capabilities')return {Code:1,Data:{Administrator:true,Channels:channels,ConfigTable:'mic_msgset',LogTable:'mic_msg_event_log',ConfigurationProtocol:1,CanSendFromConfiguration:false}};
  if(action==='List') {
    var where=[];
    if(text(p.Keyword))where=[['AND','(','Title','Like',text(p.Keyword).slice(0,100)],['OR','Key','Like',text(p.Keyword).slice(0,100),')']];
    if(p.IsEnable!==undefined)where.push(['IsEnable','=',p.IsEnable===true||Number(p.IsEnable)===1?1:0]);
    return query('mic_msgset',where,['Id','Key','Title','Type','IsEnable','ConfigRevision','UpdateTime']);
  }
  if(action==='Get')return {Code:1,Data:project(get(p.Id))};
  if(action==='Recipients') {
    var roles=p.Kind==='Roles', search=text(p.Keyword).slice(0,100), conditions=roles?[]:[['State','=',1]];
    if(search) {
      if(roles) conditions.push(['Name','Like',search]);
      else conditions=conditions.concat([['AND','(','Name','Like',search],['OR','Account','Like',search,')']]);
    }
    var options=query(roles?'sys_role':'sys_user',conditions,roles?['Id','Name']:['Id','Name','Account']);
    return {Code:1,Data:(options.Data||[]).map(function(row){return {Key:row.Id,Name:row.Name||row.Account};}),DataCount:options.DataCount};
  }
  if(action==='Templates')return query('wx_tpl_msg',text(p.Keyword)?[['Title','Like',text(p.Keyword).slice(0,100)]]:[],['Id','Title','TemplateId','WxMpName']);
  if(action==='Adapters')return query('sys_apiengine',[['IsEnable','=',1]].concat(text(p.Keyword)?[['ApiEngineKey','Like',text(p.Keyword).slice(0,100)]]:[]),['ApiEngineKey','ApiName']);
  if(action==='Logs') {
    var filters=[];
    if(p.ConfigId)filters.push(['MsgEventId','=',identifier(p.ConfigId)]);
    if(p.ChannelType){if(channels.indexOf(p.ChannelType)<0)throw new Error('通道无效。');filters.push(['ChannelType','=',p.ChannelType]);}
    if(p.IsSuccess!==undefined)filters.push(['IsSuccess','=',p.IsSuccess===true||Number(p.IsSuccess)===1?1:0]);
    if(text(p.Keyword))filters.push(['Title','Like',text(p.Keyword).slice(0,100)]);
    var logs=query('mic_msg_event_log',filters,['Id','CreateTime','Title','ChannelType','ReceiverUserId','IsSuccess','IsRead','ReadTime','MsgEventId','EventId']);
    var logRows=logs.Data||[],userIds=[],userNames=Object.create(null);
    for(var l=0;l<logRows.length;l++)if(logRows[l].ReceiverUserId&&userIds.indexOf(String(logRows[l].ReceiverUserId))<0)userIds.push(String(logRows[l].ReceiverUserId));
    // 一次查询本页接收帐号，帮助管理员定位每人的投递结果；只读本租户公开姓名与帐号列。
    if(userIds.length){
      var logUsers=checked(V8.FormEngine.GetTableData('sys_user',{_Where:[['Id','In',userIds]],_SelectFields:['Id','Name','Account'],_PageIndex:1,_PageSize:userIds.length},V8.DbTrans)).Data||[];
      for(var u=0;u<logUsers.length;u++)userNames[String(logUsers[u].Id).toLowerCase()]=logUsers[u];
    }
    return {Code:1,Data:logRows.map(function(log){var user=userNames[String(log.ReceiverUserId||'').toLowerCase()];log.ReceiverUserName=user&&user.Name||'';log.ReceiverAccount=user&&user.Account||'';return log;}),DataCount:logs.DataCount};
  }
  if(action==='Validate'||action==='Save') {
    var validation=normalize(p.Rule),rule=validation.Rule;
    if(action==='Validate')return {Code:1,Data:validation,Msg:'配置已检查，没有发送消息。'};
    var old=p.Id?get(p.Id):null;
    if(old&&old.Key!==rule.Key)throw new Error('消息 Key 被业务调用引用，保存后不能修改。');
    var data={Title:rule.Title,Type:JSON.stringify(rule.Type),IsEnable:rule.IsEnable?1:0,Receivers:JSON.stringify(rule.Receivers),ReceiversRoles:JSON.stringify(rule.ReceiversRoles),WxTplMsgId:rule.WxTplMsgId,ChannelApiEngineMap:JSON.stringify(rule.ChannelApiEngineMap)};
    var id;
    if(!old){
      var exists=V8.FormEngine.GetFormData('mic_msgset',{_Where:[['Key','=',rule.Key]],_SelectFields:fields},V8.DbTrans);
      if(Number(exists.Code)===1)throw new Error('消息 Key 已存在，请打开现有配置后修改。');
      if(Number(exists.Code)!==2)checked(exists);
      id=V8.EncryptHelper.Sha256Hex(String(V8.OsClient).toLowerCase()+'|MessageConfiguration|'+rule.Key.toLowerCase()).substring(0,32);
      data.Id=id;data.Key=rule.Key;data.ConfigRevision=1;
      checked(V8.FormEngine.AddFormData('mic_msgset',data,V8.DbTrans));
    }else{
      id=old.Id;
      var revision=Number(old.ConfigRevision||0);
      // 不能把 null、空串或 false 隐式转成旧记录的版本 0，否则会绕过显式并发校验。
      var expected=p.ExpectedRevision;
      if(expected===null||expected===undefined||typeof expected==='boolean'||text(expected)===''||!isFinite(Number(expected))||Math.floor(Number(expected))!==Number(expected)||Number(expected)!==revision)throw new Error('配置已被其他人修改，请刷新后重试。');
      var update=V8.DbTrans.FromSql('UPDATE mic_msgset SET Title=@title,Type=@types,IsEnable=@enabled,Receivers=@receivers,ReceiversRoles=@roles,WxTplMsgId=@template,ChannelApiEngineMap=@adapters,ConfigRevision=COALESCE(ConfigRevision,0)+1,UpdateTime=@time WHERE Id=@id AND COALESCE(ConfigRevision,0)=@revision AND IsDeleted<>1')
        .AddInParameter('@title',data.Title).AddInParameter('@types',data.Type).AddInParameter('@enabled',data.IsEnable)
        .AddInParameter('@receivers',data.Receivers).AddInParameter('@roles',data.ReceiversRoles).AddInParameter('@template',data.WxTplMsgId)
        .AddInParameter('@adapters',data.ChannelApiEngineMap).AddInParameter('@id',id).AddInParameter('@revision',revision)
        .AddInParameter('@time',DateNow('yyyy-MM-dd HH:mm:ss')).ExecuteNonQuery();
      if(Number(update)!==1)throw new Error('配置保存冲突，请刷新后重新编辑。');
    }
    return {Code:1,Data:{Rule:project(get(id)),Warnings:validation.Warnings},Msg:'消息通知配置已保存。'};
  }
  throw new Error('不支持的消息通知配置动作。');
}catch(error){return {Code:0,Msg:String(error.message||error)};}
