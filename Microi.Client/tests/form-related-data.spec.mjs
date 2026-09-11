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

test('metadata-only versions cannot open preview, diff, or load even with stale injected Data',()=>{
  const row={Id:'version',HistoryContentMode:'MetadataOnly',Data:'{"Name":"PRIVATE"}'};
  const ctx={DiyCommon:{IsNull:x=>!x},ParseDataVersionData:data.ParseDataVersionData,GetCurrentDataVersionFormData:()=>{throw Error('must not read');}};
  data.PreviewDataVersion.call(ctx,row);data.DiffDataVersion.call(ctx,row);
  assert.equal(data.LoadDataVersionToForm.call(ctx,row),false);
  assert.equal(ctx.ShowDataVersionPreviewDialog,undefined);assert.equal(ctx.ShowDataVersionDiffDialog,undefined);
});

test('legacy authorized full-version payload remains parseable',()=>{
  const ctx={DiyCommon:{IsNull:x=>!x}};
  assert.equal(data.ParseDataVersionData.call(ctx,{Data:'{"Name":"已授权旧版本"}'}).Name,'已授权旧版本');
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
