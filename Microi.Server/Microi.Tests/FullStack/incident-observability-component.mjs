import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Full 浏览器组件回归：真实 Vue 渲染，固定诊断合约；数据库故障由 C# 双进程测试独立验证。
const root=path.resolve(import.meta.dirname,'../../..');
const contract=JSON.parse(await fs.readFile(path.join(root,'Microi.Server/OfficialApplications/Resource/platform-service-release.json'),'utf8'));
const source=path.join(root,contract.SourceRoot),results=path.resolve(process.argv[2]||path.join(root,'.tmp/reports/incident-component'));
await fs.mkdir(results,{recursive:true});
const {createServer}=await import(pathToFileURL(path.join(source,'node_modules/vite/dist/node/index.js')));
const {chromium}=await import(pathToFileURL(path.join(root,'Microi.Client/node_modules/playwright/index.mjs')));
let entry='';
const server=await createServer({root:source,server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'incident-component-fixture',
  resolveId(id){if(id==='virtual:incident-test')return '\0virtual:incident-test'},load(id){if(id==='\0virtual:incident-test')return entry},
  configureServer(vite){vite.middlewares.use('/__incident',async (_req,res,next)=>{try{res.setHeader('content-type','text/html');res.end(await vite.transformIndexHtml('/__incident',html));}catch(e){next(e)}})}}]});
const row={OsClient:'fixture',ApiEngineKey:'slow-device',Kind:'Admission',Stage:'Gate:V8Tenant',Target:'',Count:3,LongestMs:26000,ObservedAtUtc:'2026-01-01T00:00:12Z'};
const live={BootId:'new-boot',NodeId:'test-node',Current:{RssBytes:60000000},RequestWaits:{Groups:[]},Evidence:{CriticalStorage:{AcknowledgedWrites:4,Pending:1,DroppedSnapshots:2,Error:'MySqlError:1146'}}};
const incident={Id:'abcdef0123456789abcdef0123456789',BootId:'old-boot',Trigger:'ObservedLongRequestWait',StorageKind:'MySqlCriticalEvidence',EvidenceTruncated:true,RequestWaits:{Groups:[]},WaitEvidence:{Groups:[row],WorstThreadPoolFrame:{ThreadPoolAvailableWorkers:0}},Executions:[]};
entry=`
import {createApp,h} from 'vue';import Memory from '/src/components/MemoryDiagnostics.vue';
const live=${JSON.stringify(live)},incident=${JSON.stringify(incident)};
async function query(p){if(window.failRead)throw Error('fixture storage unavailable');return {Code:1,Data:p.Action==='Memory'?live:p.Action==='MemoryIncidents'?{Items:[incident],RelationalStorage:'Available',SharedStorage:'Unavailable'}:{Items:[incident]}}}
createApp({render:()=>h(Memory,{query})}).mount('#app');`;
const html=`<!doctype html><meta charset="utf-8"><div id="app"></div><style>:root{--obs-text:#243348;--obs-panel:#fff;--obs-border:#ccd4df;--obs-primary:#2468ce;--obs-soft:#f1f5f9}body{margin:20px}</style><script type="module" src="/@id/__x00__virtual:incident-test"></script>`;
let browser;
try {
  await server.listen(); const port=server.httpServer.address().port;
  browser=await chromium.launch({headless:true,channel:process.env.PW_BROWSER_CHANNEL||'msedge'});
  const context=await browser.newContext({viewport:{width:1365,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  await page.goto(`http://127.0.0.1:${port}/__incident`);
  try { await page.getByText('已确认写入 4 次',{exact:true}).waitFor({timeout:15000}); }
  catch(e) { console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1200)}));throw e; }
  assert.ok((await page.locator('body').innerText()).includes('MySQL：Available · MongoDB：Unavailable'));
  await page.getByRole('button',{name:'观察到请求长时间等待',exact:true}).click();
  await page.getByText('slow-device',{exact:true}).waitFor();
  assert.ok((await page.locator('.memory-incident').innerText()).includes('原始分配栈不在此记录中'));
  assert.ok((await page.locator('.memory-incident').innerText()).includes('证据已按容量截断'));
  await page.screenshot({path:path.join(results,'incident-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'移动端页面横向溢出');
  await page.screenshot({path:path.join(results,'incident-mobile.png'),fullPage:true});
  await page.evaluate(()=>{window.failRead=true});await page.getByRole('button',{name:'刷新诊断',exact:true}).click();
  await page.getByRole('alert').getByText('fixture storage unavailable',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);await context.close();
  console.log(JSON.stringify({Passed:true,RetainedPeakRendered:true,StorageFailureVisible:true,TruncationVisible:true,MobileNoOverflow:true}));
} finally {await browser?.close();await server.close();}
