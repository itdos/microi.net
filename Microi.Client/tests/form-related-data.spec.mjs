import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {parse, compileTemplate} from '@vue/compiler-sfc';

const base=new URL('../src/views/form-engine/',import.meta.url);
const source=file=>fs.readFileSync(new URL(file,base),'utf8');
const panelSource=source('form-right-panel.vue');
function load(text){const context={};vm.runInNewContext(text.replace(/^import[^\n]+\n/gm,'').replace('export default','globalThis.subject ='),context);return context.subject;}
const dialog=load(source('mixins/diy-form-full-dialog.mixin.js')).methods;
const data=load(source('mixins/diy-form-full-data.mixin.js')).methods;
const panel=load(parse(panelSource).descriptor.script.content);

test('Counts retains unavailable null and reason instead of displaying zero',()=>{
  const context={TableRowId:'qa-row',FormMode:'View',DiyCommon:{IsNull:x=>!x},GetFormRelatedData:(_,callback)=>callback({Code:1,Data:{DataLog:2,DataComment:null,DataVersion:1},DataAppend:{DataCommentUnavailableReason:'CommentParentTableBindingUnavailable',DataCommentUnavailableMessage:'需要升级',HistoryContentMode:'MetadataOnly'}})};
  dialog.LoadFormRelatedCounts.call(context);
  assert.equal(context.FormRelatedCounts.DataComment,null);
  assert.equal(context.FormRelatedCounts.DataCommentUnavailableMessage,'需要升级');
  assert.equal(context.FormRelatedCounts.DataLog,2);
});

test('right panel has a distinct unavailable badge while keeping valid zero',()=>{
  assert.equal(panel.methods.GetRelatedCount.call({relatedCounts:{DataComment:null}},'DataComment'),'—');
  assert.equal(panel.methods.GetRelatedCount.call({relatedCounts:{DataComment:0}},'DataComment'),0);
});

test('comment refresh does not replace unavailable status with empty-list success',async()=>{
  const ctx={TableRowId:'qa-row',DiyCommon:{IsNull:x=>!x},FormRelatedCounts:{},_DataCommentLoadToken:0,GetFormRelatedData:(_,cb)=>cb({Code:0,DataAppend:{DataCommentUnavailableReason:'CommentParentTableBindingUnavailable',DataCommentUnavailableMessage:'需要升级'}})};
  data.GetCommentList.call(ctx);
  await Promise.resolve();
  assert.equal(ctx.FormRelatedCounts.DataComment,null);
  assert.equal(ctx.FormRelatedCounts.DataCommentUnavailableMessage,'需要升级');
  assert.equal(ctx.DataCommentListLoading,false);
});

test('comment unavailable state blocks posting before ordinary write API',()=>{
  let writes=0,tips=0;
  const ctx={CommentContent:'text',TableRowId:'qa-row',FormRelatedCounts:{DataCommentUnavailableReason:'CommentParentTableBindingUnavailable',DataCommentUnavailableMessage:'需要升级'},DiyCommon:{IsNull:x=>!x,Tips:()=>tips++,FormEngine:{AddFormData:()=>writes++}}};
  data.SubmitComment.call(ctx);
  assert.equal(writes,0);assert.equal(tips,1);
});

test('metadata-only versions cannot open preview, diff, or load even with stale injected Data',async()=>{
  const row={Id:'version',HistoryContentMode:'MetadataOnly',Data:'{"Name":"PRIVATE"}'};
  const ctx={DiyCommon:{IsNull:x=>!x},ParseDataVersionData:data.ParseDataVersionData,GetCurrentDataVersionFormData:()=>{throw Error('must not read');}};
  await data.PreviewDataVersion.call(ctx,row);await data.DiffDataVersion.call(ctx,row);
  assert.equal(await data.LoadDataVersionToForm.call(ctx,row),false);
  assert.equal(ctx.ShowDataVersionPreviewDialog,undefined);assert.equal(ctx.ShowDataVersionDiffDialog,undefined);
});

test('legacy authorized full-version payload remains parseable',()=>{
  const ctx={DiyCommon:{IsNull:x=>!x}};
  assert.equal(data.ParseDataVersionData.call(ctx,{Data:'{"Name":"已授权旧版本"}'}).Name,'已授权旧版本');
});

test('on-demand version action fetches exactly the selected version and parent',async()=>{
  const calls=[];
  const ctx={TableRowId:'qa-row',DiyCommon:{IsNull:x=>!x,Tips:()=>{}},
    GetFormRelatedData:(type,callback,extra)=>{calls.push({type,extra});callback({Code:1,Data:[{Id:'version-a',Data:'{"ApiV8Code":"return 1;"}'}],DataAppend:{HistoryContentMode:'Authorized'}});}};
  const row=await data.EnsureDataVersionContent.call(ctx,{Id:'version-a',HistoryContentMode:'OnDemand'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].type,'DataVersion');
  assert.equal(calls[0].extra.VersionId,'version-a');
  assert.equal(row.HistoryContentMode,'Authorized');
  assert.match(row.Data,/return 1/);
});

test('partial code version diff does not claim untouched fields were removed',()=>{
  const ctx={DiyFieldList:[{Name:'ApiName'},{Name:'ApiV8Code'}],
    StableDataVersionStringify:data.StableDataVersionStringify,FormatDataVersionValue:data.FormatDataVersionValue};
  const rows=data.BuildDataVersionDiffRows.call(ctx,{ApiName:'保留名称',ApiV8Code:'new'},
    {Id:'row',ApiV8Code:'old',__CodeEditorFieldName:'ApiV8Code'});
  assert.deepEqual(Array.from(rows,r=>r.Name),['ApiV8Code']);
});

test('version comparison copies real fields without the circular V8 runtime context',()=>{
  const current={Id:'row',ApiName:'接口名称',ApiV8Code:'return 1;'};
  current._V8={Form:current};
  const result=data.GetCurrentDataVersionFormData.call({_getFieldFormRef:()=>({FormDiyTableModel:current,DiyFieldList:[{Name:'ApiName'},{Name:'ApiV8Code'}]})});
  assert.equal(result.ApiName,'接口名称');assert.equal(result.ApiV8Code,'return 1;');assert.equal(result._V8,undefined);
});

test('on-demand version buttons are usable without eagerly downloading historical Data',()=>{
  assert.equal(panel.methods.CanReadVersionContent.call({}, {Id:'version-a',HistoryContentMode:'OnDemand'}),true);
});

test('comment retries keep the submission id and send only server-verifiable reply identity',()=>{
  const requests=[];let sequence=0,refreshes=0;
  const ctx={TableId:'table',TableRowId:'row',SysMenuId:'menu',CommentContent:'内容',ReplyComment:{Id:'reply',UserId:'forged',Content:'forged'},
    DiyCommon:{IsNull:x=>!x,NewGuid:()=>`id-${++sequence}`,Tips:()=>{},Post:(url,payload,callback)=>requests.push({url,payload,callback})},
    GetCommentList:()=>refreshes++};
  data.SubmitComment.call(ctx);
  assert.equal(requests[0].url,'/api/FormEngine/AddFormComment');
  assert.equal(requests[0].payload.ParentCommentId,'reply');
  assert.equal(requests[0].payload.ReplyToUserId,undefined);
  assert.equal(requests[0].payload.ReplyToContent,undefined);
  requests[0].callback({Code:0,Msg:'网络异常'});
  data.SubmitComment.call(ctx);
  assert.equal(requests[1].payload.RequestId,requests[0].payload.RequestId);
  requests[1].callback({Code:1});
  assert.equal(ctx.CommentContent,'');assert.equal(refreshes,1);
});

test('switching the parent table while historical content loads discards the response',async()=>{
  let callback;
  const ctx={TableId:'table-a',TableRowId:'row',GetFormRelatedData:(_,cb)=>callback=cb};
  const pending=data.EnsureDataVersionContent.call(ctx,{Id:'version',HistoryContentMode:'OnDemand'});
  ctx.TableId='table-b';
  callback({Code:1,Data:[{Id:'version',Data:'{}'}],DataAppend:{HistoryContentMode:'Authorized'}});
  assert.equal(await pending,null);
});

test('authorized code snapshots preview their fields without a blank full configuration form',()=>{
  const file=source('diy-form-full.vue'), descriptor=parse(file).descriptor;
  const computedBody=descriptor.script.content.match(/CodeVersionPreviewFields\(\) \{([\s\S]*?)\n        \},/)[1];
  const computed=new Function(computedBody);
  const fields=computed.call({PreviewDataVersionItem:{HistoryContentMode:'Authorized'},PreviewDataVersionData:{Id:'row',ApiV8Code:'return 1;',__CodeEditorCode:'return 1;'},DiyFieldList:[{Name:'ApiV8Code',Label:'接口代码'}]});
  assert.deepEqual(fields,[{Name:'ApiV8Code',Label:'接口代码',Code:'return 1;'}]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'diy-form-full.vue',id:'version-preview'}).errors,[]);
});

test('panel template hides unavailable comment composer and version payload actions',()=>{
  assert.match(panelSource,/v-if="CommentUnavailableMessage"/);
  assert.match(panelSource,/v-if="!CommentUnavailableMessage" class="comment-input-wrapper"/);
  assert.match(panelSource,/class="version-actions" v-if="CanReadVersionContent\(item\)"/);
  assert.equal(panel.methods.CanReadVersionContent.call({}, {HistoryContentMode:'MetadataOnly',Data:'{}'}),false);
  assert.equal(panel.methods.CanReadVersionContent.call({}, {Data:'{}'}),true);
  const result=compileTemplate({source:parse(panelSource).descriptor.template.content,filename:'form-right-panel.vue',id:'related-data'});
  assert.deepEqual(result.errors,[]);
});
