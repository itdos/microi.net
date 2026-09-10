import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const contract=JSON.parse(await readFile(resolve(root,'Microi.Server/Microi.Upgrade/Resource/platform-service-release.json'),'utf8'));
const dist=resolve(root,contract.SourceRoot,'dist');
const work=resolve(process.env.PANEL_TEST_RESULTS||resolve(root,'.tmp/panel-acceptance'),`platform-entry-${Date.now()}`);
await mkdir(work,{recursive:true});
let apiResult={Code:1,Data:{Url:''}},apiDelay=700;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(/apiengine/i.test(url.pathname)){
   await new Promise(r=>setTimeout(r,apiDelay));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(apiResult));return;
  }
  if(url.pathname==='/fixture-panel'){res.setHeader('Content-Type','text/html');res.end('<h1>Isolated frame fixture</h1>');return;}
  const file=resolve(dist,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(dist+sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const browser=await chromium.launch({headless:true,channel:process.env.PANEL_TEST_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',dialog=>{errors.push('Unexpected native dialog');void dialog.dismiss();});
page.on('console',message=>{if(message.type()==='error'&&/Vue warn|Unhandled|TypeError/.test(message.text()))errors.push(message.text());});
const pass=name=>{passed.push(name);console.log('PASS '+name);};
await page.addInitScript(({origin})=>{
 let data={apiBase:origin,osClient:'panel-entry-fixture',token:'fixture-only',microRoute:'/platform-ops',themeMode:'light',themeColor:'#2563eb',themePrimaryText:'#1d4ed8',themePalette:'blue'};
 const listeners=new Set();window.microApp={getData:()=>data,addDataListener:fn=>listeners.add(fn),removeDataListener:fn=>listeners.delete(fn),dispatch:()=>{},forceDispatch:()=>{}};
 window.__panelEntryTheme=patch=>{data={...data,...patch};for(const listener of listeners)listener(data);};
},{origin});
try{
 await page.goto(origin);
 await expect(page.getByRole('heading',{name:'吾码服务器运维面板',exact:true})).toBeVisible();
 await expect(page.locator('.entry-skeleton[aria-busy=true]')).toBeVisible();
 await page.screenshot({path:resolve(work,'loading.png'),fullPage:true});
 await expect(page.getByRole('heading',{name:'配置独立面板地址',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'查看一键安装与使用文档 ↗'})).toHaveAttribute('href','https://microi.net/doc/server-panel/overview.html');
 pass('compiled entry renders loading, empty configuration and installation documentation');
 await page.getByLabel('独立面板地址',{exact:true}).fill('https://user:secret@example.test');
 await page.getByRole('button',{name:'打开服务器面板',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('iframe')).toHaveCount(0);
 pass('credential-bearing temporary URL cannot create an iframe');
 await page.getByLabel('独立面板地址',{exact:true}).fill(origin+'/fixture-panel');
 await page.getByRole('button',{name:'打开服务器面板',exact:true}).click();
 await expect(page.frameLocator('iframe').getByRole('heading',{name:'Isolated frame fixture'})).toBeVisible();
 const link=page.getByRole('link',{name:'在新窗口打开 ↗'});await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer');
 await expect(page.locator('iframe')).toHaveAttribute('title','Microi.Panel 独立服务器运维面板');
 pass('temporary entry embeds the exact URL and offers an independent safe link');
 const themes=[{themeMode:'light',themeColor:'#2563eb',themeOnPrimary:'#ffffff',themePrimaryText:'#1d4ed8',themePalette:'blue'},{themeMode:'dark',themeColor:'#60a5fa',themeOnPrimary:'#172133',themePrimaryText:'#93c5fd',themePalette:'blue'},{themeMode:'light',themeColor:'#eab308',themeOnPrimary:'#172133',themePrimaryText:'#854d0e',themePalette:'yellow'}];
 for(const theme of themes){
  await page.evaluate(t=>window.__panelEntryTheme(t),theme);
  const app=page.locator('.ops-entry');await expect(app).toHaveAttribute('data-theme',theme.themeMode);await expect(app).toHaveAttribute('data-mci-palette',theme.themePalette);
  assert.equal(await app.evaluate(el=>getComputedStyle(el).getPropertyValue('--ops-on-primary').trim()),theme.themeOnPrimary);
  await expect(page.locator('iframe')).toHaveAttribute('src',origin+'/fixture-panel');
  await page.screenshot({path:resolve(work,`${theme.themeMode}-${theme.themePalette}.png`),fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'narrow entry must not overflow horizontally');
 pass('host light dark and yellow themes update without losing iframe and remain usable at 390px');
 apiDelay=0;apiResult={Code:0,Msg:'Fixture authorization rejected'};
 await page.getByRole('button',{name:'刷新入口',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Fixture authorization rejected');
 apiResult={Code:1,Data:{Url:origin+'/fixture-panel'}};
 await page.getByRole('button',{name:'刷新入口',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.frameLocator('iframe').getByRole('heading',{name:'Isolated frame fixture'})).toBeVisible();
 pass('authorization error has a terminal state and refresh recovers');
 assert.deepEqual(errors,[]);
 await writeFile(resolve(work,'report.json'),JSON.stringify({completed:true,scope:'Compiled microservice UI with intercepted API and isolated frame; not real platform authorization or Panel login',entrySha256:createHash('sha256').update(await readFile(resolve(dist,'index.html'))).digest('hex'),passed,errors},null,2));
 console.log('Evidence '+work);
}finally{await browser.close();await new Promise(r=>server.close(r));}
