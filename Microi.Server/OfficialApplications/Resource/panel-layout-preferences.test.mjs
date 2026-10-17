import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const execute=new Function('V8',readFileSync(new URL('./platform-user-update-preferences.js',import.meta.url),'utf8'));
function run(param,user={Id:'signed-user'}) { let saved=null;const result=execute({ CurrentUser:user,OsClient:'signed-tenant',Param:param,ApiEngine:{Run:()=>({Code:1})},FormEngine:{UptFormData:(_table,model)=>(saved=model,{Code:1})},Method:{RefreshLoginUser:(id,tenant)=>{assert.equal(id,user.Id);assert.equal(tenant,'signed-tenant');return {Code:1,Data:{...user,...saved}};}} });return {result,saved}; }
test('布局偏好仅更新可信账号，四字段和空值回退完整保留',()=>{
    const {result,saved}=run({SidebarWidth:320,RoleTreeWidth:'280',SidebarCollapsed:true,RoleTreeCollapsed:'0',Id:'other',OsClient:'other',RoleIds:['admin']});
    assert.equal(result.Code,1);assert.deepEqual(saved,{Id:'signed-user',SidebarWidth:320,RoleTreeWidth:280,SidebarCollapsed:1,RoleTreeCollapsed:0});
    assert.deepEqual(run({SidebarWidth:null,RoleTreeWidth:'',SidebarCollapsed:null,RoleTreeCollapsed:''},{Id:'signed-user',SidebarWidth:300,RoleTreeWidth:300,SidebarCollapsed:1,RoleTreeCollapsed:1}).saved,{Id:'signed-user',SidebarWidth:null,RoleTreeWidth:null,SidebarCollapsed:null,RoleTreeCollapsed:null});
});
test('拒绝异常宽度和布尔值，失败不能产生部分更新',()=>{
    for(const width of [0,159,601,240.5,'240px','Infinity','1e999','<script>']) {const {result,saved}=run({SidebarWidth:width,RoleTreeWidth:300});assert.equal(result.Code,0,String(width));assert.equal(saved,null);}
    for(const value of ['falseish',2,[],{}])assert.equal(run({SidebarCollapsed:value}).result.Code,0);
    assert.equal(run({SidebarWidth:300},{}).result.Code,1001);
});
test('相同偏好不重复写库或刷新身份',()=>{
    const {result,saved}=run({SidebarWidth:'320',SidebarCollapsed:'1'},{Id:'signed-user',SidebarWidth:320,SidebarCollapsed:1});assert.equal(result.Code,1);assert.equal(result.Changed,false);assert.equal(saved,null);
});
test('系统账号与基础空库均携带官方四字段、真实物理列和DDL，接口仍唯一归系统账号',()=>{
    const names=['SidebarWidth','RoleTreeWidth','SidebarCollapsed','RoleTreeCollapsed'];
    for(const name of ['sys_user','saas-engine']) {
        const pkg=JSON.parse(readFileSync(new URL(`./app.microi.${name}.json`,import.meta.url),'utf8'));
        const table=pkg.DiyTables.find(item=>String(item.Name).toLowerCase()==='sys_user');
        for(const fieldName of names) {
            const fields=pkg.DiyFields.filter(field=>field.TableId===table.Id&&field.Name===fieldName);assert.equal(fields.length,1);
            assert.equal(fields[0].Sort,5980+names.indexOf(fieldName));assert.equal(fields[0].Tab,'01KGFAYTX109WCP98XJZP395VY');assert.equal(fields[0].FormWidth,null);
            const column=pkg.PhysicalColumns.find(column=>column.TABLE_NAME.toLowerCase()==='sys_user'&&column.COLUMN_NAME===fieldName);
            assert.equal(column.IS_NULLABLE,'YES');assert.equal(column.COLUMN_DEFAULT,null);
            assert.ok(pkg.DDLStatements.find(item=>item.TableName.toLowerCase()==='sys_user').DDL.includes('`'+fieldName+'` int(11) NULL'));
        }
        assert.equal(pkg.SysApiEngines.filter(engine=>engine.ApiEngineKey==='platform-user-update-preferences').length,name==='sys_user'?1:0);
    }
});
