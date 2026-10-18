import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {parse} from '@vue/compiler-sfc';

const base = new URL('../src/views/form-engine/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, base), 'utf8');
function load(text) {
  const context = {};
  vm.runInNewContext(text.replace(/^import[^\n]+\n/gm, '').replace('export default', 'globalThis.subject ='), context);
  return context.subject;
}
const dialog = load(read('mixins/diy-form-full-dialog.mixin.js')).methods;
const data = load(read('mixins/diy-form-full-data.mixin.js')).methods;
const state = load(read('mixins/diy-form-full-state.mixin.js'));
const panel = load(parse(read('form-right-panel.vue')).descriptor.script.content);
const tick = () => new Promise(resolve => setImmediate(resolve));
function context() {
  return {...dialog, ...data, ...state.methods,
    TableId:'table-a', TableRowId:'record-a', SysMenuId:'menu-a', FormMode:'View',
    CurrentDiyTableModel:{Id:'table-a',EnableDataLog:1,EnableDataComment:1,EnableDataVersion:1},
    GetCurrentUser:{RoleIds:[]}, FormRelatedCounts:{DataLog:0,DataComment:0,DataVersion:0},
    DataLogList:[], DataCommentList:[], DataVersionList:[],
    _DataLogLoadToken:0,_DataCommentLoadToken:0,_DataVersionLoadToken:0,
    DiyCommon:{IsNull:value=>!value,GetServerPath:value=>value,Tips:()=>{}}};
}

test('record switch clears every related list, pending editor and historical dialog',()=>{
  const c=context(); Object.assign(c,{DataLogList:[{}],DataCommentList:[{},{},{}],DataVersionList:[{}],CommentContent:'old',ReplyComment:{Id:'old'},ShowDataVersionPreviewDialog:true,ShowDataVersionDiffDialog:true});
  state.watch.TableRowId.call(c,'record-b','record-a');
  assert.equal(c.DataCommentList.length,0); assert.equal(c.DataLogList.length,0); assert.equal(c.DataVersionList.length,0);
  assert.equal(c.CommentContent,''); assert.equal(c.ReplyComment,null);
  assert.equal(c.ShowDataVersionPreviewDialog,false); assert.equal(c.ShowDataVersionDiffDialog,false);
});

test('late counts and version list cannot populate a different record without another request',()=>{
  for(const kind of ['Counts','DataVersion']) {
    const c=context(); let callback;
    c.GetFormRelatedData=(_,cb)=>{callback=cb;};
    if(kind==='Counts')c.LoadFormRelatedCounts();else c.LoadDataVersion();
    c.TableRowId='record-b'; callback({Code:1,Data:kind==='Counts'?{DataComment:3,DataVersion:4}:[{Id:'old'}],DataCount:4});
    assert.equal(c.FormRelatedCounts.DataComment,0);assert.equal(c.FormRelatedCounts.DataVersion,0);assert.equal(c.DataVersionList.length,0);
  }
});

test('a comment avatar await cannot publish the previous record after a switch',async()=>{
  const c=context(); let callback,release;
  c.DiyCommon.GetUserAvatarUrl=()=>new Promise(resolve=>{release=resolve;});
  c.GetFormRelatedData=(_,cb)=>{callback=cb;}; c.GetCommentList();
  const pending=callback({Code:1,Data:[{Id:'old',UserId:'user',Avatar:'old.png'}],DataCount:3});
  c.TableRowId='record-b';release('avatar-url');await pending;
  assert.equal(c.DataCommentList.length,0);assert.equal(c.FormRelatedCounts.DataComment,0);
});

test('a log avatar await cannot replace newer related data',async()=>{
  const c=context();let callback,release;
  c.DiyCommon.GetUserAvatarUrl=()=>new Promise(resolve=>{release=resolve;});
  c.GetFormRelatedData=(_,cb)=>{callback=cb;};c.LoadDataLog();
  const pending=callback({Code:1,Data:[{Id:'old',UserId:'user',Avatar:'old.png'}]});
  c.TableRowId='record-b';c.DataLogList=[{Id:'new'}];release('avatar-url');await pending;
  assert.equal(c.DataLogList[0].Id,'new');
});

test('a completed comment submission cannot clear the next records editor',()=>{
  const c=context();let callback;
  c.CommentContent='old';c.DiyCommon.NewGuid=()=> 'request-id';c.DiyCommon.Post=(_,__,cb)=>{callback=cb;};
  c.GetCommentList=()=>{};c.SubmitComment();c.TableRowId='record-b';c.CommentContent='new draft';
  callback({Code:1});assert.equal(c.CommentContent,'new draft');
});

test('the request wrapper rejects late replies after changing parent menu or table',()=>{
  for(const changed of ['menu','table','tenant','api']) {
    const c=context();let callback,delivered,tenant='tenant-a',api='https://a.invalid';
    c.DiyCommon.GetOsClient=()=>tenant;c.DiyCommon.GetApiBase=()=>api;
    c.DiyCommon.Post=(_,__,cb)=>{callback=cb;};c.GetFormRelatedData('DataComment',value=>{delivered=value;});
    if(changed==='menu')c.SysMenuId='menu-b';if(changed==='table')c.TableId='table-b';if(changed==='tenant')tenant='tenant-b';if(changed==='api')api='https://b.invalid';
    callback({Code:1,Data:[]});assert.equal(delivered.Data,undefined);assert.equal(delivered._StaleFormRelatedData,true);
  }
});

test('log detail reads only the selected item and rejects a stale record',async()=>{
  const c=context();assert.equal(typeof c.EnsureDataLogContent,'function');let callback,request;
  c.GetFormRelatedData=(type,cb,extra)=>{request={type,extra};callback=cb;};
  const pending=c.EnsureDataLogContent({Id:'log-a',HistoryContentMode:'OnDemand'});
  assert.equal(request.type,'DataLog');assert.equal(request.extra.LogId,'log-a');
  c.TableRowId='record-b';callback({Code:1,Data:[{Id:'log-a',Content:'[]'}],DataAppend:{HistoryContentMode:'Authorized'}});
  assert.equal(await pending,null);await tick();
});

test('custom tab text is trimmed, escaped by interpolation and blank values use defaults',()=>{
  assert.equal(typeof panel.methods.GetRelatedTitle,'function');
  const c={dataLogTitle:'  审计  ',dataCommentTitle:'<b>讨论</b>',dataVersionTitle:'  ',$t:key=>({'Msg.DataVersion':'版本'}[key]||key)};
  assert.equal(panel.methods.GetRelatedTitle.call(c,'DataLog'),'审计');
  assert.equal(panel.methods.GetRelatedTitle.call(c,'DataComment'),'<b>讨论</b>');
  assert.equal(panel.methods.GetRelatedTitle.call(c,'DataVersion'),'版本');
});

test('version actions recheck the parent after the content promise settles',async()=>{
  for(const action of ['PreviewDataVersion','DiffDataVersion','LoadDataVersionToForm']) {
    const c=context();let callback,applied=0;
    c.GetFormRelatedData=(_,cb)=>{callback=cb;};c.$nextTick=()=>{};
    c._getFieldFormRef=()=>({ApplyVersionData:()=>applied++});
    c.GetCurrentDataVersionFormData=()=>({});c.BuildDataVersionDiffRows=()=>[];
    const pending=c[action]({Id:'version-a',HistoryContentMode:'OnDemand'});
    callback({Code:1,Data:[{Data:'{"Name":"old"}'}],DataAppend:{HistoryContentMode:'Authorized',HistoryContentKind:'Data'}});
    // 先让内层按需请求通过身份检查，再在外层动作恢复前切换记录。
    queueMicrotask(()=>{c.TableRowId='record-b';});await pending;
    assert.equal(c.ShowDataVersionPreviewDialog,undefined);assert.equal(c.ShowDataVersionDiffDialog,undefined);assert.equal(applied,0);
  }
});

test('reopening the same record invalidates a pending comment without clearing the new draft',()=>{
  const c=context();let callback;c.CommentContent='old';c.DiyCommon.NewGuid=()=> 'old-request';
  c.DiyCommon.Post=(_,__,cb)=>{callback=cb;};c.SubmitComment();
  c.ResetFormRelatedData();c.CommentContent='new draft';callback({Code:1});
  assert.equal(c.CommentContent,'new draft');assert.equal(c.BtnLoading,false);assert.equal(c.FormRelatedGeneration,1);
});
