import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('platform-message-notification-config.js',import.meta.url),'utf8');
const config={Key:'order_notice',Title:'订单通知',Type:['平台内部'],IsEnable:true,Receivers:[],ReceiversRoles:[]};
function fixture({administrator=true,existing=[],users=[],logs=[],affected=1}={}){
 const rows=new Map(existing.map(row=>[row.Id,{...row}])),queries=[],writes=[];
 const V8={OsClient:'tenant-one',DbTrans:{FromSql(sql){const parameters={};const statement={AddInParameter(name,value){parameters[name]=value;return statement},ExecuteNonQuery(){writes.push({sql,parameters});return affected}};return statement}},Param:{},
  ApiEngine:{Run(key,p){assert.equal(key,'platform-reminder-runtime');assert.deepEqual(p,{Action:'Capabilities'});return {Code:1,Data:{Administrator:administrator}}}},
  EncryptHelper:{Sha256Hex:value=>createHash('sha256').update(value).digest('hex')},
  FormEngine:{GetTableData(table,q,trans){assert.equal(trans,V8.DbTrans);queries.push({table,q});return {Code:1,Data:table==='mic_msgset'?[...rows.values()]:table==='sys_user'?users:table==='mic_msg_event_log'?logs:[],DataCount:table==='mic_msg_event_log'?logs.length:rows.size}},
   GetFormData(table,q,trans){assert.equal(trans,V8.DbTrans);assert.equal(table,'mic_msgset');const row=q.Id?rows.get(q.Id):[...rows.values()].find(r=>r.Key===q._Where[0][2]);return row?{Code:1,Data:row}:{Code:2}},
   AddFormData(table,row,trans){assert.equal(trans,V8.DbTrans);assert.equal(table,'mic_msgset');writes.push({table,row});rows.set(row.Id,{...row});return {Code:1,Data:row}}
  }};
 // Jint 可能把 CLR DateTime 投影为 JS Date，不能依赖大写 ToString；平台 DateNow 是稳定入口。
 const run=(p)=>{V8.Param=p;return new Function('V8','System','DateNow',source)(V8,{DateTime:{Now:new Date()}},()=> '2026-09-10 20:00:00')};
 return {run,queries,writes,rows};
}
test('普通帐号无法绕过统一配置权限，也不执行任何表查询',()=>{
 const f=fixture({administrator:false});for(const Action of ['Capabilities','List','Get','Save','Recipients','Logs'])assert.equal(f.run({Action,Id:'one',Rule:config}).Code,0);
 assert.equal(f.queries.length,0);assert.equal(f.writes.length,0);
});
test('原通知配置兼容旧 CSV 和 Select 对象值，不迁移原数据',()=>{
 const old={...config,Id:'one',Type:'邮件,平台内部',Receivers:'[{"Id":"user-a","Name":"姓名"}]',ReceiversRoles:'["role-a"]',ChannelApiEngineMap:'{"邮件":"send-email"}'};
 const f=fixture({existing:[old]}),result=f.run({Action:'Get',Id:'one'});
 assert.equal(result.Code,1);assert.deepEqual(result.Data.Type,['邮件','平台内部']);assert.deepEqual(result.Data.Receivers,['user-a']);assert.equal(result.Data.ConfigRevision,0);assert.equal(f.writes.length,0);
});
test('Validate 只校验，Save 使用原表并保存确定性配置标识',()=>{
 const f=fixture();assert.equal(f.run({Action:'Validate',Rule:config}).Code,1);assert.equal(f.writes.length,0);
 const saved=f.run({Action:'Save',Rule:config});assert.equal(saved.Code,1);assert.equal(saved.Data.Rule.Key,config.Key);assert.equal(saved.Data.Rule.ConfigRevision,1);
 assert.equal(f.writes[0].table,'mic_msgset');assert.equal(f.rows.size,1);
 assert.equal(f.run({Action:'Save',Rule:config}).Code,0);assert.equal(f.rows.size,1);
});
test('Jint 的 JObject 长度成员不应被误判为通道适配器数组',()=>{
 // 实际 HTTP 参数的 JObject 在 Jint 中暴露 length=Count，序列化仍是 JSON 对象。
 const empty=Object.defineProperty({},'length',{value:0});
 const populated=Object.defineProperty({'邮件':'send-email'},'length',{value:1});
 const f=fixture();
 for(const ChannelApiEngineMap of [empty,populated]) {
  const result=f.run({Action:'Validate',Rule:{...config,IsEnable:false,ChannelApiEngineMap}});
  assert.equal(result.Code,1,result.Msg);
  assert.equal(Object.hasOwn(result.Data.Rule.ChannelApiEngineMap,'length'),false);
 }
 assert.equal(f.run({Action:'Validate',Rule:{...config,ChannelApiEngineMap:[]}}).Code,0);
 assert.equal(f.writes.length,0);
});
test('旧记录并发保存必须带版本，条件写未命中保持失败',()=>{
 const f=fixture({existing:[{...config,Id:'one'}],affected:0});
 assert.equal(f.run({Action:'Save',Id:'one',Rule:config}).Code,0);assert.equal(f.writes.length,0);
 for(const ExpectedRevision of [null,'',false,-1,0.5])assert.equal(f.run({Action:'Save',Id:'one',Rule:config,ExpectedRevision}).Code,0);
 assert.equal(f.writes.length,0);
 assert.equal(f.run({Action:'Save',Id:'one',Rule:config,ExpectedRevision:0}).Code,0);
 assert.match(f.writes[0].sql,/COALESCE\(ConfigRevision,0\)=@revision/);assert.equal(f.writes[0].parameters['@revision'],0);
 assert.equal(f.writes[0].parameters['@time'],'2026-09-10 20:00:00');
});
test('启用时拒绝无效接收人和缺通道适配器，失效旧规则仍可停用',()=>{
 const f=fixture(),rule={...config,Type:['邮件'],Receivers:['deleted-user']};
 assert.equal(f.run({Action:'Validate',Rule:rule}).Code,0);
 assert.equal(f.run({Action:'Validate',Rule:{...rule,Receivers:[]}}).Code,0);
 const disabled=f.run({Action:'Save',Rule:{...rule,IsEnable:false}});assert.equal(disabled.Code,1);assert.equal(disabled.Data.Rule.IsEnable,false);
});
test('用户查询和投递日志有界且不返回帐号密钥或供应商原始响应',()=>{
 const f=fixture();assert.equal(f.run({Action:'Recipients',PageSize:101}).Code,0);
 const result=f.run({Action:'Recipients',PageSize:100,Keyword:'工程'});assert.equal(result.Code,1);
 assert.deepEqual(f.queries.at(-1).q._Where,[['State','=',1],['AND','(','Name','Like','工程'],['OR','Account','Like','工程',')']]);
 f.run({Action:'Logs'});const fields=f.queries.at(-1).q._SelectFields;
 assert.ok(fields.includes('IsRead'));for(const secret of ['Pwd','Token','AppSecret','MsgResult','Payload'])assert.ok(!fields.includes(secret));
});
test('投递日志一次批量解析本页接收帐号，保留旧记录且不读取用户秘密',()=>{
 const f=fixture({logs:[{Id:'log-a',ReceiverUserId:'user-a'},{Id:'log-b',ReceiverUserId:'user-a'},{Id:'log-legacy'}],users:[{Id:'user-a',Name:'采购员',Account:'purchaser'}]});
 const result=f.run({Action:'Logs'});assert.equal(result.Code,1);assert.equal(result.DataCount,3);
 assert.equal(result.Data[0].ReceiverUserName,'采购员');assert.equal(result.Data[1].ReceiverAccount,'purchaser');assert.equal(result.Data[2].ReceiverUserName,'');
 const queries=f.queries.filter(query=>query.table==='sys_user');assert.equal(queries.length,1);assert.deepEqual(queries[0].q._Where,[['Id','In',['user-a']]]);assert.deepEqual(queries[0].q._SelectFields,['Id','Name','Account']);
});
