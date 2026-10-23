import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
// 从实际发布资源提取相同函数，夹具不维护第二份产品实现。
export function factorySource(source, marker) {
 const start=source.indexOf('function createLegacyLocationIndex(V8, options) {');
 const end=source.indexOf(marker,start);
 if(start<0||end<0)throw Error('missing production location factory');
 return source.slice(start,end).trim();
}
const source=fs.readFileSync(path.join(root,'platform-chat-runtime.js'),'utf8');
const factory=new Function(factorySource(source,'var locationIndex=createLegacyLocationIndex')+';return createLegacyLocationIndex;')();
export const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function match(row,where){return (where||[]).every(([key,op,value])=>op==='='?(value===null?row[key]==null:row[key]===value):op==='<>'?row[key]!==value:op==='In'?value.includes(row[key]):op==='>'?row[key]>value:op==='<'?row[key]<value:false);}
export function fixture({tenant='tenant-a',epoch=Date.parse('2026-01-15T10:00:00Z'),fault=()=>{},physical=true,collectionPage=true}={}){
  const storage=new Map(),calls=[],indexes=new Set();let time=epoch;let generation=0;let protocolConsumes=0;
  const base='diy_chat_'+tenant.toLowerCase();
  const collection=(db,table)=>{const key=db+'/'+table;if(!storage.has(key))storage.set(key,new Map());return storage.get(key);};
  const messageIdFor=id=>sha('chat-message|'+tenant+'|'+id).slice(0,24);
  const fingerprint=m=>sha([tenant,m.RequestId,m.FromUserId,m.ToUserId,m.Type,m.Content,m.OtherInfo,m.IsRead===true?'1':'0'].join('|'));
  const message=(id,extra={})=>{const row={MessageId:messageIdFor(id),RequestId:id,FromUserId:'user-1',ToUserId:'user-2',Type:'text',Content:'hello',OtherInfo:'',IsRead:false,...extra};row._id=row.MessageId;row.PayloadHash=fingerprint(row);return row;};
  function invoke(name,req,body){calls.push([name,clone(req)]);fault({method:name,request:req,stage:'before',storage});const result=body();fault({method:name,request:req,stage:'after',storage,result});return clone(result);}
  function scoped(req,create=false){if(req.OsClient!==tenant||!(req.DbName===base||new RegExp('^'+base+'_\\d{4}$').test(req.DbName)))throw Error('tenant boundary');return create?collection(req.DbName,req.TableName):(storage.get(req.DbName+'/'+req.TableName)||new Map());}
  const mongo={
    GetFormData:req=>invoke('GetFormData',req,()=>({Code:1,Data:scoped(req).get(req.Id)||null})),
    AddFormData:req=>invoke('AddFormData',req,()=>{const rows=scoped(req,true);if(rows.has(req.Id))return {Code:0,Msg:'duplicate key'};rows.set(req.Id,{...clone(req._FormData),_id:req.Id,CreateTime:req.OccurredAt||new Date(time).toISOString()});return {Code:1};}),
    UptFormData:req=>invoke('UptFormData',req,()=>{const row=scoped(req).get(req.Id);if(!row)return {Code:0};Object.assign(row,clone(req._FormData));return {Code:1};}),
    UptFormDataByWhere:req=>invoke('UptFormDataByWhere',req,()=>{if(req._Where.some(c=>c[2]==null))return {Code:0,Msg:'unsafe mutation null'};let count=0;for(const row of scoped(req).values())if(match(row,req._Where)){Object.assign(row,clone(req._FormData));count++;}return {Code:1,Data:{MatchedCount:count,ModifiedCount:count}};}),
    GetTableData:req=>invoke('GetTableData',req,()=>{const rows=[...scoped(req).values()].filter(row=>match(row,req._Where));return {Code:1,Data:rows.slice(0,req._PageSize||100),DataCount:rows.length};}),
    GetPartitionedTableData:req=>invoke('GetPartitionedTableData',req,()=>{
      if(req.OsClient!==tenant||req.DatabasePrefix!=='diy_chat')return {Code:0};
      if(req.PhysicalRows){
        if(!physical)return {Code:1,Data:{Rows:[],HasMore:false}};
        const names=[...storage.keys()].filter(key=>{const [db,table]=key.split('/');return (db===base||new RegExp('^'+base+'_\\d{4}$').test(db))&&/^chat_\d{4}(?:\d{2}|_\d{2})?$/.test(table);}).sort();
        const directoryHash=sha(JSON.stringify([names,generation]));
        if(req.DirectoryHash&&req.DirectoryHash!==directoryHash)return {Code:0,Msg:'directory changed'};
        const scope=sha(tenant+'|'+directoryHash),cursor=req.Cursor?JSON.parse(req.Cursor):{scope,partition:0,after:''};
        if(cursor.scope!==scope)return {Code:0};
        let partition=cursor.partition,after=cursor.after,scanned=0;const selected=[];
        while(partition<names.length&&scanned<Math.min(req.MaxPartitions||8,8)&&selected.length<req.PageSize){
          const key=names[partition],rows=[...storage.get(key).values()].filter(row=>!after||row._id>after).sort((a,b)=>a._id.localeCompare(b._id));
          const capacity=req.PageSize-selected.length;scanned++;
          for(const row of rows.slice(0,capacity)){selected.push({...clone(row),_PartitionDb:key.split('/')[0],_PartitionTable:key.split('/')[1]});after=row._id;}
          if(rows.length>capacity)break;partition++;after='';
        }
        const hasMore=partition<names.length;
        return {Code:1,Data:{FullPhysicalScope:true,Rows:selected,HasMore:hasMore,NextCursor:hasMore?JSON.stringify({scope,partition,after}):'',DirectoryHash:directoryHash,ScannedPartitions:scanned,TotalPartitions:names.length}};
      }
      if(req.CollectionPage){
        if(!collectionPage)return {Code:0,Msg:'missing capability'};
        const identity=JSON.stringify([req.TableName,req.SortField,req.IndexFields,!!req.CountOnly]);
        if(req.EnsureIndex){collection(base,req.TableName);indexes.add(identity);return {Code:1,Data:{PageKind:'Collection',IndexReady:true}};}
        if(!indexes.has(identity))return {Code:0,Msg:'index missing'};
        const rows=[...(storage.get(base+'/'+req.TableName)||new Map()).values()].filter(row=>match(row,req._Where));
        if(req.CountOnly)return {Code:1,Data:{PageKind:'Collection',Count:rows.length}};
        const scope=sha(JSON.stringify([tenant,req.TableName,req._Where,req.SortField]));
        const cursor=req.Cursor?JSON.parse(req.Cursor):null;if(cursor&&cursor.scope!==scope)return {Code:0};
        const candidates=rows.filter(row=>!cursor||row.SortKey<cursor.key).sort((a,b)=>b.SortKey.localeCompare(a.SortKey));
        const page=candidates.slice(0,req.PageSize),hasMore=candidates.length>req.PageSize;
        return {Code:1,Data:{PageKind:'Collection',Rows:page,HasMore:hasMore,NextCursor:hasMore?JSON.stringify({scope,key:page.at(-1).SortKey}):''}};
      }
      // 旧运行时模型：count 是物理总和；仅当前页按 Id 去重，不能掩盖真实缺陷。
      let rows=[];for(const [key,items] of storage){const [db,table]=key.split('/');if((db===base||db.startsWith(base+'_'))&&/^chat_\d{4}(?:\d{2}|_\d{2})?$/.test(table))for(const row of items.values())if(match(row,req._Where))rows.push(row);}
      return {Code:1,Data:{Count:rows.length,Rows:rows.slice(0,req.PageSize||100),HasMore:false,NextCursor:''}};
    })
  };
  const v8={OsClient:tenant,MongoDb:mongo,EncryptHelper:{Sha256Hex:sha},CurrentUser:{Id:'user-1',Account:'u1',Name:'User One',Level:9999},Param:{},DbTrans:{},
    FormEngine:{GetFormData:(_table,q)=>({Code:1,Data:{Id:q.Id,Name:q.Id,Account:q.Id}}),GetTableData:()=>({Code:1,Data:[]})},
    ApiEngine:{Run:()=>({Code:1})},Method:{RequireManagedProtocolContext:()=>++protocolConsumes===1?({Code:1}):({Code:0,Msg:'one-shot context consumed'}),RequireManagedStorageMaintenance:()=>({Code:1,Data:{OsClient:tenant,Scope:'platform-chat-runtime',WritersDrained:true,WriteAdmissionClosed:true,Epoch:'vm-only-not-deployed-1'}})}};
  const api=factory(v8,{now:()=>time,messageIdFor,fingerprint});
  return {api,v8,storage,calls,indexes,base,message,messageIdFor,fingerprint,collection,now:()=>time,tick:ms=>time+=ms,changeDirectory:()=>generation++,seed:(db,table,row)=>collection(db,table).set(row._id||row.MessageId,clone(row)),
    physicalRows:()=>[...storage].filter(([key])=>/^chat_\d{4}(?:\d{2}|_\d{2})?$/.test(key.split('/')[1])).flatMap(([key,rows])=>[...rows.values()].map(row=>({key,...clone(row)}))),
    start:()=>api.start({MaintenanceConfirmed:true,FenceId:'offline-fence-0001'}),
    migrate(size=2){let result=this.start();if(result.Code!==1)return result;let n=0;while(result.Data.Phase==='Running'){result=api.step({OperationId:'offline-batch-'+(++n),ExpectedRevision:result.Data.Revision,PageSize:size});if(result.Code!==1)break;}return result;},
    get protocolConsumes(){return protocolConsumes;},
    runRuntime(source,param){protocolConsumes=0;v8.Param=param;return new Function('V8','System',source)(v8,{DateTime:{Now:{ToString:format=>format==='yyyy'?'2026':'2026-01-15 10:00:00'}}});}
  };
}
