import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync(new URL('../../Microi.Server/OfficialApplications/Resource/app.microi.saas-engine.json',import.meta.url)));
const userPackage=JSON.parse(fs.readFileSync(new URL('../../Microi.Server/OfficialApplications/Resource/app.microi.sys_user.json',import.meta.url)));
const source=key=>[...pkg.SysApiEngines,...userPackage.SysApiEngines].find(e=>e.ApiEngineKey===key).ApiV8Code;
const run=(key,V8)=>new Function('V8','DateNow',source(key))(V8,()=> '2026-10-01 12:00:00');
test('invitation nodes require a real session and reject unrelated branches before querying children',()=>{
 assert.equal(run('official_account_invitations',{CurrentUser:null,Param:{}}).Code,1001);
 let queried=false;
 const base={CurrentUser:{Id:'owner'},Param:{ParentId:'outsider'},FormEngine:{GetFormData:()=>({Code:1,Data:{Id:'outsider',InvitationPath:'/someone-else'}}),GetTableData:()=>{queried=true;throw Error('must not query')}}};
 assert.equal(run('official_account_invitations',base).Code,0);assert.equal(queried,false);
 base.Param.ParentId="x' OR 1=1";assert.equal(run('official_account_invitations',base).Code,0);
});
test('invitation descendants are paged and only public identity fields leave the server',()=>{
 let query;const bound=[];
 const V8={CurrentUser:{Id:'owner'},Param:{ParentId:'child',PageIndex:2,PageSize:999999},FormEngine:{GetFormData:()=>({Code:1,Data:{InvitationPath:'/root/owner'}}),GetTableData:(_,params)=>{query=params;return{Code:1,DataCount:31,Data:[{Id:'grandchild',Account:'account',Name:'name',PublicAvatar:'/public/avatar.png',Avatar:'/private/avatar.png',Pwd:'secret',LastLoginTime:'backend',LastWebsiteLoginTime:'website',CreateTime:'registered'}]}}},Db:{FromSql(sql){assert.match(sql,/GROUP BY InviterUserId/);return{AddInParameter(k,v){bound.push([k,v]);return this},ToArray:()=>[{InviterUserId:'grandchild'}]}}}};
 const r=run('official_account_invitations',V8);assert.equal(r.Code,1);assert.equal(query._PageSize,30);assert.equal(query._PageIndex,2);assert.deepEqual(query._Where,[['InviterUserId','=','child'],['IsDeleted','=',0]]);assert.deepEqual(bound,[['@p0','grandchild']]);assert.equal(r.Data.Nodes[0].HasChildren,true);assert.equal(r.Data.Nodes[0].LastWebsiteLoginTime,'website');assert.equal(r.Data.Nodes[0].Avatar,'/public/avatar.png');assert.equal(r.Data.Nodes[0].Pwd,undefined);assert.equal(r.Data.Nodes[0].LastLoginTime,undefined);
});
test('license records use the authenticated applicant, exclude secrets and bound pages',()=>{
 let query;const r=run('official_account_licenses',{CurrentUser:{Id:'owner'},Param:{UserId:'other',Phone:'other',PageIndex:-3,PageSize:100000},FormEngine:{GetTableData:(_,p)=>{query=p;return{Code:1,Data:[],DataCount:42}}}});
 assert.equal(r.Code,1);assert.deepEqual(query._Where,[['ApplyUserId','=','owner'],['IsDeleted','=',0]]);assert.equal(query._PageSize,20);assert.equal(query._PageIndex,1);assert.equal(query._SelectFields.includes('LicenseContent'),false);assert.equal(r.Data.Total,42);
});
function authFixture({isNew=true,failVerification=false,existing=false,invite='inviter'}={}){
 const writes=[],calls=[];const user={Id:'new-user',Phone:'13000000000',Account:'13000000000',Name:'new',RoleIds:'[{"Id":"personal"}]',State:1};let verified=false;
 const V8={OsClient:'iTdos',Header:{did:'test-device'},CurrentUser:null,Param:{Action:'register',LoginType:'sms',Phone:user.Phone,Pwd:'TestPassword!1',_SmsCaptchaValue:'123456',InviteCode:invite},FormEngine:{GetFormData(table,p){if(table==='sys_role')return{Code:1,Data:{Id:'personal',Name:'个人版角色',Level:0}};if(table==='sys_config')return{Code:1,Data:{}};if(p.Id===user.Id)return verified?{Code:1,Data:user}:{Code:2};if(p.Id)return{Code:1,Data:{Id:invite,InvitationPath:'/root',State:1,IsDeleted:0}};return verified||existing?{Code:1,Data:user}:{Code:2}},UptFormData(table,p){writes.push(p);return{Code:1}}},ApiEngine:{Run(key,p){calls.push([key,p]);verified=!failVerification;return failVerification?{Code:0,Msg:'invalid proof'}:{Code:1,Data:user,DataAppend:{IsNewUser:isNew}}}},Method:{NewGuid:()=> 'test-trace',SetSysUserRoleInfo:u=>({...u}),GetAccessToken:()=>({Code:1,Data:{Token:'test-token'}}),GetUserTenant:()=>({Code:2}),GetClientIP:()=>({Data:''}),AddSysLog:()=>{} }};
 return{V8,writes,calls};
}
test('only SMS-verified newly created accounts bind an inviter and update website login time',()=>{
 const f=authFixture();const r=run('official_sms_login',f.V8);assert.equal(r.Code,1);assert.equal(f.calls[0][0],'platform_auth_sms_login');assert.equal(f.calls[0][1]._CaptchaValue,'123456');assert.deepEqual(f.writes.find(x=>x.InviterUserId),{Id:'new-user',InviterUserId:'inviter',InvitationPath:'/root/inviter'});assert.equal(f.writes.find(x=>x.LastWebsiteLoginTime).LastWebsiteLoginTime,'2026-10-01 12:00:00');assert.equal(r.Data.Pwd,'');
});
test('existing accounts and invalid SMS proofs never bind invitation relationships',()=>{
 for(const options of [{existing:true},{isNew:false},{failVerification:true}]){const f=authFixture(options);assert.equal(run('official_sms_login',f.V8).Code,0);assert.equal(f.writes.length,0)}
});
test('failed password authentication cannot modify roles or website login time',()=>{
 const f=authFixture({failVerification:true});f.V8.Param={Action:'login',LoginType:'password',Account:'account',Pwd:'wrong',_DevBypassPwd:true};assert.equal(run('official_sms_login',f.V8).Code,0);assert.equal(f.calls[0][0],'platform-sys-user-session');assert.equal(f.calls[0][1]._DevBypassPwd,undefined);assert.equal(f.writes.length,0);
});
test('portable application packages include the invitation schema and explicit Managed ownership',()=>{
 const user=JSON.parse(fs.readFileSync(new URL('../../Microi.Server/OfficialApplications/Resource/app.microi.sys_user.json',import.meta.url)));
 for(const p of [pkg,user])for(const name of ['InviterUserId','InvitationPath','LastWebsiteLoginTime']){assert.ok(p.DiyFields.some(f=>f.Name===name));assert.ok(p.PhysicalColumns.some(c=>c.TABLE_NAME==='sys_user'&&c.COLUMN_NAME===name));assert.match(p.DDLStatements.find(d=>d.TableName==='sys_user').DDL,new RegExp('`'+name+'`'));}
 for(const key of ['official_sms_login','official_account_licenses'])assert.equal(pkg.ResourcePolicies.ApiEngines[key].UpgradePolicy,'Managed');assert.equal(user.ResourcePolicies.ApiEngines.official_account_invitations.UpgradePolicy,'Managed');assert.ok(pkg.DiyTables.some(t=>t.Name==='diy_license'));
});
