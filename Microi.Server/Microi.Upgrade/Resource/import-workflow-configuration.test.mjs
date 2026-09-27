import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const start=source.indexOf("    activeImportStage = '步骤4-工作流设计';"),end=source.indexOf('    function isMissingValue(value)',start);
assert.ok(start>0&&end>start);
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const p={Installation:{ConfigurationPolicy:'PreserveTenantValues'},WfFlowDesigns:[{Id:'flow',TableId:'business',FlowName:'业务审批',IsEnable:0}],WfNodes:[{Id:'start',FlowDesignId:'flow',NodeType:'Start',Users:'[]',Roles:'[]',Depts:'[]'},{Id:'review',FlowDesignId:'flow',NodeType:'Approve',Users:'[]',Roles:'[]',Depts:'[]',StartV8Server:'new guard',AllowSelectUsers:0},{Id:'end',FlowDesignId:'flow',NodeType:'AutoEnd',Users:'[]',Roles:'[]',Depts:'[]'}],WfLines:[{Id:'first',FlowDesignId:'flow',FromNodeId:'start',ToNodeId:'review'},{Id:'last',FlowDesignId:'flow',FromNodeId:'review',ToNodeId:'end'}]};
 const rows={wf_flowdesign:copy(p.WfFlowDesigns),wf_node:copy(p.WfNodes),wf_line:copy(p.WfLines)};
 rows.wf_flowdesign[0].IsEnable=1;Object.assign(rows.wf_node[1],{Users:'[{"Id":"tenant-user","Name":"审核人"}]',Roles:'[{"Id":"tenant-role","Name":"审核岗"}]',Depts:'[{"Id":"tenant-dept","Name":"业务部"}]',StartV8Server:'old guard'});
 return{p,rows};
}
function run(p,rows,fault={}){
 // 模拟可重复读：共享事务首次读取后只看自己的快照和写入；未传事务的写入独立提交。
 // 只有完整阶段成功才提交快照，用真实可见性与回滚结果检查参数遗漏造成的半套流程。
 const writes=[],shared={scope:'shared'};let snapshot;
 const data=trans=>fault.snapshot&&trans===shared?(snapshot??=copy(rows)):rows;
 const context={Package:copy(p),V8:{OsClient:'test-tenant',DbTrans:shared,FormEngine:{
  GetFormData(table,q,trans){if(fault.readFailure)return{Code:0,Msg:'read failed'};let row=data(trans)[table]?.find(x=>x.Id===q.Id);if(!row)return{Code:2};row=copy(row);if(fault.readbackMismatch&&writes.length&&table==='wf_node')row.Users='[]';return{Code:1,Data:row};},
  GetTableData(table,q,trans){if(fault.readFailure)return{Code:0,Msg:'read failed'};let found=data(trans)[table]||[];for(const w of q._Where||[]){const [key,op,value]=w;found=found.filter(r=>op==='In'?value.includes(r[key]):r[key]===value);}const n=q._PageSize||200,i=q._PageIndex||1;return{Code:1,Data:copy(found.slice((i-1)*n,i*n)),DataCount:found.length};},
  UptFormData(table,row,trans){writes.push({table,row:copy(row),shared:trans===shared});if(fault.writeFailure===table)return{Code:0,Msg:'write failed'};Object.assign(data(trans)[table].find(x=>x.Id===row.Id),copy(row));return{Code:1};},
  AddFormData(table,row,trans){writes.push({table,row:copy(row),shared:trans===shared});if(fault.writeFailure===table)return{Code:0,Msg:'write failed'};(data(trans)[table]??=[]).push(copy(row));return{Code:1};}
 }},checkExists:(table,id)=>!!rows[table]?.some(x=>x.Id===id),reportProgress:()=>{},debugLog:{},stats:{FlowUpdated:0,FlowInserted:0,NodeUpdated:0,NodeInserted:0,LineUpdated:0,LineInserted:0}};
 vm.runInNewContext(source.slice(start,end),context,{timeout:3000});
 if(fault.snapshot&&snapshot)Object.assign(rows,copy(snapshot));
 return{writes,debug:context.debugLog,stats:context.stats};
}

test('compatible workflow upgrade retains tenant enabled state and user/role/department bindings while replacing managed guards',()=>{const{p,rows}=fixture(),old=copy(rows.wf_node[1]);run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,1);for(const k of ['Users','Roles','Depts'])assert.equal(rows.wf_node[1][k],old[k]);assert.equal(rows.wf_node[1].StartV8Server,'new guard');assert.equal(rows.wf_node[1].AllowSelectUsers,0);});
test('compatible reinstall never re-enables a tenant-disabled workflow',()=>{const{p,rows}=fixture();rows.wf_flowdesign[0].IsEnable=0;p.WfFlowDesigns[0].IsEnable=1;run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);});
test('same package repeated twice retains exact bindings and creates no duplicate nodes',()=>{const{p,rows}=fixture();run(p,rows);const once=copy(rows);run(p,rows);assert.deepEqual(rows,once);assert.match(rows.wf_node[1].Users,/tenant-user/);assert.equal(rows.wf_node.length,3);});
test('first install retains declared disabled template and empty bindings',()=>{const{p}=fixture(),rows={wf_flowdesign:[],wf_node:[],wf_line:[]};run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_node[1].Users,'[]');});
test('packages without tenant preservation declaration keep legacy authoritative workflow behavior',()=>{const{p,rows}=fixture();delete p.Installation;run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_node[1].Users,'[]');assert.equal(rows.wf_node[1].StartV8Server,'new guard');});
test('adding an approval node disables the changed topology and retains compatible existing bindings',()=>{const{p,rows}=fixture();p.WfNodes.push({Id:'second',FlowDesignId:'flow',NodeType:'Approve',Users:'[]',Roles:'[]',Depts:'[]'});p.WfLines[1].ToNodeId='second';p.WfLines.push({Id:'final',FlowDesignId:'flow',FromNodeId:'second',ToNodeId:'end'});const r=run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.match(rows.wf_node[1].Users,/tenant-user/);assert.equal(r.stats.WorkflowRebindRequired,1);});
test('changed node type does not transfer old approver bindings to a different node purpose',()=>{const{p,rows}=fixture();p.WfNodes[1].NodeType='AutoEnd';const r=run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_node[1].Users,'[]');assert.equal(r.stats.WorkflowRebindRequired,1);});
test('changed business table invalidates inherited approval configuration',()=>{const{p,rows}=fixture();p.WfFlowDesigns[0].TableId='other-business';const r=run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_node[1].Users,'[]');assert.equal(r.stats.WorkflowRebindRequired,1);});
test('changed route values disable enabled workflows until target verification',()=>{const{p,rows}=fixture();p.WfLines[1].LineValue='new-branch';const r=run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(r.stats.WorkflowRebindRequired,1);});
test('changing topology with an active approval fails before mutating the graph',()=>{const{p,rows}=fixture();p.WfLines[1].LineValue='new-branch';rows.wf_work=[{Id:'todo',FlowDesignId:'flow',WorkState:'Todo'}];const before=copy(rows);assert.throws(()=>run(p,rows),/在途待办/);assert.deepEqual(rows,before);});
test('completed approval history does not block a changed but disabled template',()=>{const{p,rows}=fixture();p.WfLines[1].LineValue='new-branch';rows.wf_work=[{Id:'history',FlowDesignId:'flow',WorkState:'Done'}];run(p,rows);assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_work[0].WorkState,'Done');});
test('moving a stable node id between workflow owners fails before any writes',()=>{const{p,rows}=fixture();rows.wf_node[1].FlowDesignId='other-flow';const before=copy(rows);assert.throws(()=>run(p,rows),/节点归属/);assert.deepEqual(rows,before);});
test('tenant configuration read failure fails before any writes',()=>{const{p,rows}=fixture(),before=copy(rows);assert.throws(()=>run(p,rows,{readFailure:true}),/工作流.*读取/);assert.deepEqual(rows,before);});
for(const table of ['wf_flowdesign','wf_node','wf_line'])test(table+' write failure aborts import instead of reporting success',()=>{const{p,rows}=fixture();assert.throws(()=>run(p,rows,{writeFailure:table}),/工作流.*写入/);});
test('successful write response with lost target bindings fails strict readback',()=>{const{p,rows}=fixture();assert.throws(()=>run(p,rows,{readbackMismatch:true}),/工作流.*回读/);});

test('repeatable-read first install creates the entire workflow in one visible transaction',()=>{
 const{p}=fixture(),rows={wf_flowdesign:[],wf_node:[],wf_line:[]};
 const r=run(p,rows,{snapshot:true});assert.equal(r.writes.length,6);assert.ok(r.writes.every(w=>w.shared));
 assert.deepEqual([rows.wf_flowdesign.length,rows.wf_node.length,rows.wf_line.length],[1,3,2]);
 assert.equal(rows.wf_flowdesign[0].IsEnable,0);assert.equal(rows.wf_node[1].Users,'[]');
});
test('repeatable-read upgrade sees new managed guards and retains target bindings',()=>{
 const{p,rows}=fixture(),old=copy(rows.wf_node[1]);run(p,rows,{snapshot:true});
 assert.equal(rows.wf_node[1].StartV8Server,'new guard');assert.equal(rows.wf_flowdesign[0].IsEnable,1);
 for(const k of ['Users','Roles','Depts'])assert.equal(rows.wf_node[1][k],old[k]);
});
for(const table of ['wf_node','wf_line'])test('repeatable-read '+table+' failure rolls back all workflow changes',()=>{
 const{p,rows}=fixture(),before=copy(rows);
 assert.throws(()=>run(p,rows,{snapshot:true,writeFailure:table}),/工作流.*写入/);assert.deepEqual(rows,before);
});
test('legacy package first install also shares workflow readback transaction',()=>{
 const{p}=fixture();delete p.Installation;const rows={wf_flowdesign:[],wf_node:[],wf_line:[]};
 run(p,rows,{snapshot:true});assert.equal(rows.wf_node.length,3);assert.equal(rows.wf_line.length,2);
});
