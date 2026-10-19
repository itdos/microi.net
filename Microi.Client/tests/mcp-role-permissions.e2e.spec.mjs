import {test,expect} from '@playwright/test';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {buildUiDensityVariables} from '../src/utils/ui-density.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const stub={
 '@/utils/diy.common':`export const DiyCommon={GetApiBase:()=> 'https://fixture.invalid',GetOsClient:()=> 'fixture',Http:{Post:async p=>window.fixtureApi(p)}};`,
 '@/pinia/modules/diy':`export const useDiyStore=()=>window.fixtureStore;`,
 'vue-router':`export const useRouter=()=>({push:()=>{}});`,
};
const compiled=await build({root,configFile:false,logLevel:'error',resolve:{alias:{'@':root+'src'}},plugins:[{
 name:'mcp-role-fixture',enforce:'pre',resolveId(id){const normalized=id.replaceAll('\\','/');const key=Object.keys(stub).find(key=>key===id||(key.startsWith('@/')&&normalized===(root+'src/'+key.slice(2)).replaceAll('\\','/')));if(id==='mcp-fixture'||key)return '\0'+(key||id);},
 load(id){if(id.startsWith('\0')&&stub[id.slice(1)])return stub[id.slice(1)];if(id==='\0mcp-fixture')return `import {createApp,reactive,h} from 'vue';import ElementPlus from 'element-plus';import Connection from ${JSON.stringify(root+'src/components/MciAiConnectionDialog/index.vue')};import Roles from ${JSON.stringify(root+'src/components/MciMcpRolePermissions/index.vue')};
 window.fixtureStore=reactive({GetCurrentUser:{Level:100},SysConfig:{}});window.view=reactive({mode:'connection',roleName:'编辑角色'});
 createApp({render(){return window.view.mode==='connection'?h(Connection,{text:'Api v8.5.13 - Web v8.5.13'}):h(Roles,{roleId:'one',roleName:window.view.roleName,roleLevel:100,deferred:true,onChange:(value,notify)=>window.formChanges.push({value,notify})});}}).use(ElementPlus).mount('#app');`;}
},vue()],build:{write:false,minify:false,cssCodeSplit:false,rollupOptions:{input:'mcp-fixture',output:{format:'iife',inlineDynamicImports:true}}}});
const css=await readFile(new URL('../node_modules/element-plus/dist/index.css',import.meta.url),'utf8')+'\n'+compiled.output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n');
const js=compiled.output.find(x=>x.type==='chunk').code;
async function setup(page){
 await page.setViewportSize({width:1440,height:1000});await page.setContent('<div id="app"></div>');
 await page.evaluate(()=>{
  window.apiCalls=[];window.formChanges=[];window.failReadback=false;
  window.roleRows=[{Id:'one',Name:'编辑角色',Level:100,Version:'v1',Policy:{Enabled:false,Scope:'Role',CanWrite:false,CanDelete:false}},{Id:'admin',Name:'超级管理员',Level:9999,Version:'none',Policy:{Enabled:false,Scope:'Role',CanWrite:false,CanDelete:false}}];
  window.fixtureApi=async p=>{const data=p.PostParam;window.apiCalls.push(structuredClone(data));
   // 与真实接口一致：默认 form 中的复合值是文本，不能当成原生角色数组被模拟端接受。
   if(data.Action==='SaveMcpRolePermissions'&&p.ParamType!=='json')return{Code:0,Msg:'请提交 1 至 100 个角色的变更。'};
   if(data.Action==='GetConnectionInfo')return{Code:1,Data:{ProductType:'Enterprise'}};
   if(data.Action==='GetMcpRolePermissions'){if(window.failReadback)return{Code:0,Msg:'回读失败'};return{Code:1,Data:structuredClone(window.roleRows.filter(r=>(!data.RoleId||r.Id===data.RoleId)&&(!data.Keyword||r.Name.includes(data.Keyword)))),DataCount:2};}
   if(data.Action==='SaveMcpRolePermissions'){for(const row of data.Roles){const found=window.roleRows.find(r=>r.Id===row.Id);if(found.Version!==row.Version)return{Code:0,Msg:'已被修改，请刷新'};found.Policy=structuredClone(row.Policy);found.Version='v2';}return{Code:1};}
   return{Code:0,Msg:'unexpected fixture action'};
  };
 });
 await page.addStyleTag({content:css});await page.addScriptTag({content:js});
}
test('版本入口按等级限制，角色表可保存并独立回读，超级管理员行不可降权',async({page},info)=>{
 await setup(page);
 expect(await page.getByTestId('runtime-version').evaluate(el=>el.tagName)).toBe('SPAN');
 await page.getByTestId('runtime-version').click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.evaluate(()=>window.fixtureStore.GetCurrentUser.Level=9999);
 await page.getByTestId('runtime-version').click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('tab',{name:'角色 AI 开发权限'}).click();
 await expect(page.getByRole('switch',{name:'编辑角色允许 MCP 连接'}).locator('..')).toBeVisible();
 await expect(page.getByRole('switch',{name:'超级管理员允许 MCP 连接'})).toBeDisabled();
 await page.getByRole('switch',{name:'编辑角色允许 MCP 连接'}).locator('..').click();
 await page.getByRole('checkbox',{name:'编辑角色创建修改'}).locator('..').click();
 await page.getByRole('button',{name:'保存角色授权'}).click();
 await expect(page.getByText('已保存并回读，角色管理同步生效。')).toBeVisible();
 const saved=await page.evaluate(()=>window.apiCalls.find(c=>c.Action==='SaveMcpRolePermissions'));
 expect(saved.Roles).toEqual([{Id:'one',Version:'v1',Policy:{Enabled:true,Scope:'Role',CanWrite:true,CanDelete:false}}]);
 await page.setViewportSize({width:3840,height:2160});
 await page.evaluate(vars=>{document.documentElement.dataset.mciUiDensity='90';Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));},buildUiDensityVariables(90));
 await page.screenshot({path:info.outputPath('mcp-role-dialog-compact-4k.png')});
 await page.evaluate(()=>window.fixtureStore.GetCurrentUser.Level=100);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('角色表单改名保留未保存的授权，初始化不标记表单已修改',async({page})=>{
 await setup(page);await page.evaluate(()=>window.view.mode='role');
 await expect(page.getByRole('switch',{name:'编辑角色允许 MCP 连接'}).locator('..')).toBeVisible();
 expect((await page.evaluate(()=>window.formChanges))[0].notify).toBe(false);
 await page.getByRole('switch',{name:'编辑角色允许 MCP 连接'}).locator('..').click();
 await page.getByRole('checkbox',{name:'编辑角色创建修改'}).locator('..').click();
 const before=await page.evaluate(()=>window.apiCalls.length);await page.evaluate(()=>window.view.roleName='修改的名称');
 await expect(page.getByRole('checkbox',{name:'修改的名称创建修改'})).toBeChecked();
 expect(await page.evaluate(()=>window.apiCalls.length)).toBe(before);
 expect((await page.evaluate(()=>window.formChanges)).at(-1)).toEqual({value:{Version:'v1',Policy:{Enabled:true,Scope:'Role',CanWrite:true,CanDelete:false}},notify:true});
});
test('保存后回读失败明确提示，不能冒充已同步成功',async({page})=>{
 await setup(page);await page.evaluate(()=>window.fixtureStore.GetCurrentUser.Level=9999);
 await page.getByTestId('runtime-version').click();await page.getByRole('tab',{name:'角色 AI 开发权限'}).click();
 await page.getByRole('switch',{name:'编辑角色允许 MCP 连接'}).locator('..').click();await page.evaluate(()=>window.failReadback=true);
 await page.getByRole('button',{name:'保存角色授权'}).click();
 await expect(page.getByText('保存已执行，但回读失败，请刷新核对，勿重复提交。').first()).toBeVisible();
 await expect(page.getByText('已保存并回读，角色管理同步生效。')).toHaveCount(0);
});
