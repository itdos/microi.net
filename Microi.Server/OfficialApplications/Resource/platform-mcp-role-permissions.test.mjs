import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import test from 'node:test';
const body=fs.readFileSync(new URL('./platform-mcp-role-permissions.body.js',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const policy=(scope='Role',write=false,del=false)=>({Enabled:true,Scope:scope,CanWrite:write,CanDelete:del});
function fixture({authorized=true,rows=[],race=false}={}){
 const limits=structuredClone(rows),writes=[],roles=[{Id:'one',Name:'编辑',Level:100},{Id:'two',Name:'读者',Level:100}];
 const V8={Param:{},DbTrans:{FromSql:sql=>{const params={};const command={AddInParameter:(k,v)=>{params[k]=v;return command;},ExecuteNonQuery:()=>{assert.match(sql,/Permission=@old/);const found=limits.find(r=>r.Id===params['@id']&&r.RoleId===params['@role']);if(race||!found||found.Permission!==params['@old'])return 0;found.Permission=params['@new'];writes.push(params);return 1;}};return command;}},EncryptHelper:{Sha256Hex:hash},Method:{ManageSystemDirectory:p=>{if(!authorized)return{Code:0,Msg:'forbidden'};return{Code:1,Data:p.Param?.Policy};}},FormEngine:{
  GetTableData:(table,p)=>{let data=table==='sys_rolelimit'?limits.filter(r=>r.RoleId===p._Where[0][2]):roles.filter(r=>p._Where.every(w=>w[0]==='Id'?r.Id===w[2]:r.Name.includes(w[2])));return{Code:1,Data:structuredClone(data),DataCount:data.length};},
  GetFormData:(_t,p)=>({Code:roles.some(r=>r.Id===p.Id)?1:2,Data:roles.find(r=>r.Id===p.Id)}),
  AddFormData:(_t,row)=>{assert.equal(limits.some(r=>r.Id===row.Id),false);limits.push({...row});writes.push(row);return{Code:1};}
 }};
 const run=(action,request={})=>{V8.Param=request;return JSON.parse(JSON.stringify(vm.runInNewContext(`(function(){${body}})()`,{V8,action})));};
 return{run,limits,writes};
}
test('role directory reads exact policy/version and does not write on read or unauthorized request',()=>{
 const f=fixture();const result=f.run('GetMcpRolePermissions',{Keyword:'编辑'});assert.equal(result.Code,1);assert.equal(result.Data.length,1);assert.equal(result.Data[0].Version,'none');assert.equal(result.Data[0].Policy.Enabled,false);assert.equal(f.writes.length,0);
 assert.equal(fixture({authorized:false}).run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:'none',Policy:policy()}]}).Code,0);
});
test('create once, read back version, CAS update and reject stale two-window overwrite',()=>{
 const f=fixture();assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:'none',Policy:policy()}]}).Code,1);
 const first=f.run('GetMcpRolePermissions',{RoleId:'one'}).Data[0];assert.equal(first.Version,hash(JSON.stringify(policy())));
 assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:first.Version,Policy:policy('Role',true)}]}).Code,1);
 assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:first.Version,Policy:policy('Full',true,true)}]}).Code,0);
 assert.deepEqual(JSON.parse(f.limits[0].Permission),policy('Role',true));
});
test('batch preflight prevents partial writes; database CAS race never reports success',()=>{
 const f=fixture();assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:'none',Policy:policy()},{Id:'two',Version:'stale',Policy:policy()}]}).Code,0);assert.equal(f.writes.length,0);
 const old=JSON.stringify(policy());const race=fixture({race:true,rows:[{Id:'limit',RoleId:'one',FkId:'McpDevelopment',Permission:old}]});
 assert.equal(race.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:hash(old),Policy:policy('Role',true)}]}).Code,0);assert.equal(race.writes.length,0);
});
test('unchanged role form preserves the policy without a no-op update; stale version remains rejected',()=>{
 const old=JSON.stringify(policy());const f=fixture({rows:[{Id:'limit',RoleId:'one',FkId:'McpDevelopment',Permission:old}]});
 assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:hash(old),Policy:policy()}]}).Code,1);assert.equal(f.writes.length,0);
 assert.equal(f.run('SaveMcpRolePermissions',{Roles:[{Id:'one',Version:'stale',Policy:policy()}]}).Code,0);assert.equal(f.writes.length,0);
});
test('official engine embeds the reviewed permission body exactly',()=>{
 const engine=fs.readFileSync(new URL('./platform-sys-role.js',import.meta.url),'utf8');assert.ok(engine.includes(body));
 const app=JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json',import.meta.url),'utf8'));
 assert.equal(app.SysApiEngines.find(x=>x.ApiEngineKey==='platform-sys-role').ApiV8Code,engine);
});
