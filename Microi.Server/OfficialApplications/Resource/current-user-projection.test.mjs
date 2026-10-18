import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const run = new Function('V8', fs.readFileSync(new URL('./platform-current-user.js', import.meta.url),'utf8'));
test('个人设置返回本人白名单，权限树、秘密和角色额外属性不出现在响应',()=>{
 const user={Id:'me',Name:'用户',Avatar:'/private/a.png',Pwd:'secret',_RoleLimits:['large'],_Roles:[{Name:'角色',Secret:'no'}]};
 const v8={CurrentUser:user,Param:{View:'PersonalSettings',UserId:'other'},ApiEngine:{Run:()=>({Code:1})}};
 const r=run(v8);assert.equal(r.Data.Id,'me');assert.deepEqual(r.Data._Roles,[{Name:'角色'}]);assert.equal(r.Data.Pwd,undefined);assert.equal(r.Data._RoleLimits,undefined);
 v8.Param={};assert.equal(run(v8).Data,user);v8.CurrentUser={};assert.equal(run(v8).Code,1001);
});
