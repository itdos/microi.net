import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {currentPlatformEvent,currentPlatformLog} from './platform-log-contract.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,legacy.work);
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const lines=(await readFile(resolve(root,'AI测试要用到的帐号密码.txt'),'utf8')).split(/\r?\n/),hostIndex=lines.findIndex(x=>x.includes('api.itdos.com'));
const credential=lines.slice(hostIndex+1).find(x=>/^帐号/.test(x.trim()))?.match(/^帐号\s*([^，,\s]+).*?密码\s*([^，,\s]+)/);assert(credential?.[1]==='admin');
const env=await readFile(resolve(work,'ops-test.env'),'utf8'),password=env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const diagnostics={frames:[],errors:[],runId:legacy.run};
const controller=JSON.parse(execFileSync('docker',['inspect',legacy.names.ops],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
const candidate=JSON.parse(execFileSync('docker',['image','inspect',legacy.image],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
assert.equal(controller.Config.Labels['io.microi.ops.test'],legacy.run);assert.equal(controller.Image,candidate.Id);
diagnostics.controllerId=controller.Id;diagnostics.imageId=controller.Image;
const browser=await chromium.launch({channel:'msedge',headless:true});let page;
try{
 // 官方平台使用真实系统信任链；仅原有本机开发接口允许其自签名证书。
 page=await browser.newPage({ignoreHTTPSErrors:!process.env.PANEL_PLATFORM_API_BASE,viewport:{width:1600,height:1100}});
 page.on('response',async r=>{if(r.url().includes('GetSysMenuStep')){try{const j=await r.json();diagnostics.menuResponse={code:j.Code,includesOps:JSON.stringify(j).includes('/micro-app/microi-platform-service/platform-ops')};}catch{}}});page.on('pageerror',e=>diagnostics.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/GotoSystem error:|frame-ancestors|frame|CSP/i.test(m.text()))diagnostics.errors.push(m.text());});
 const frontend = new URL(process.env.PANEL_PLATFORM_FRONTEND_BASE || 'http://localhost:61500/');
 assert.equal(frontend.origin,'http://localhost:61500','Use the isolated local browser origin authorized by this fixture');
 assert(!process.env.PANEL_PLATFORM_API_BASE || new URL(process.env.PANEL_PLATFORM_API_BASE).href==='https://api.microi.net/','Remote browser target must match the approved official credential target');
 frontend.searchParams.set('OsClient','iTdos');
 if(process.env.PANEL_PLATFORM_API_BASE)frontend.searchParams.set('ApiBase',process.env.PANEL_PLATFORM_API_BASE);
 await page.goto(frontend.href);
 const endpoint=await page.evaluate(()=>window.__MICROI_RUNTIME_ENDPOINT__);
 assert.equal(endpoint?.osClient,'iTdos');assert.equal(new URL(endpoint.apiBase).origin,new URL(process.env.PANEL_PLATFORM_API_BASE||'https://localhost:61501').origin);
 diagnostics.runtimeEndpoint=endpoint;
 const account=page.locator('input[placeholder*="用户名"],input[placeholder*="账号"],input[placeholder*="帐号"],input[placeholder*="username" i]').first();await account.waitFor({timeout:45000});await account.fill(credential[1]);await page.locator('input[type=password]').first().fill(credential[2]);
 const privacy=page.locator('.privacy-policy-wrapper .el-checkbox').first();if(await privacy.isVisible().catch(()=>false)){if(!await privacy.locator('input').isChecked())await privacy.click();}
 const loginResponse=page.waitForResponse(r=>/\/api\/SysUser\/Login(?:\?|$)/i.test(r.url()),{timeout:30000});await page.getByRole('button',{name:'登录',exact:true}).click();const result=await(await loginResponse).json();assert.equal(Number(result.Code),1,result.Msg);
 // A successful login response precedes route initialization. Forcing a hash
 // navigation here cancels that initialization and can produce a false login error.
 await expect(page.locator('.task-entry[title="通知中心"]')).toBeVisible({timeout:60000});
 await expect(account).toBeHidden({timeout:30000});
 const loginFailure=page.getByText('登录成功，但进入系统失败，请重试。',{exact:true});
 await expect(loginFailure).toHaveCount(0);
 const system=page.locator('.sidebar-main-menu').getByRole('menuitem',{name:'系统引擎',exact:true});
 async function openSystemEntry(name){const item=page.getByRole('menuitem',{name,exact:true});if(!await item.isVisible())await system.click({timeout:30000});await expect(item).toBeVisible({timeout:30000});await item.click();}
 await openSystemEntry('服务器运维面板');
 let entry;for(let i=0;i<60;i++){for(const f of page.frames()){if(await f.getByRole('heading',{name:'吾码服务器运维面板',exact:true}).count()){entry=f;break;}}if(entry)break;await new Promise(r=>setTimeout(r,500));}
 diagnostics.frames=page.frames().map(f=>{const u=new URL(f.url()||'about:blank');return{origin:u.origin,path:u.pathname};});
 assert(entry,'Platform MicroService frame missing');await expect(entry.getByRole('heading',{name:'吾码服务器运维面板',exact:true})).toBeVisible({timeout:30000});
 const temporary=entry.getByLabel('独立面板地址'),blank=entry.getByRole('link',{name:'在新窗口打开 ↗'});
 await expect(temporary.or(blank).first()).toBeVisible({timeout:30000});
 if(await temporary.isVisible()){await temporary.fill('http://localhost:61880');await entry.getByRole('button',{name:'打开服务器面板',exact:true}).click();}
 await expect(blank).toHaveAttribute('target','_blank');await expect(blank).toHaveAttribute('rel','noopener noreferrer');
 assert.equal(new URL(await blank.getAttribute('href')).origin,'http://localhost:61880','Never submit fixture credentials to a different configured panel');
 const ops=entry.frameLocator('iframe[title="Microi.Panel 独立服务器运维面板"]');await ops.getByLabel('运维账号').fill('ops-test',{timeout:25000});await ops.getByLabel('运维密码').fill(password);await ops.getByRole('button',{name:'登录运维中心',exact:true}).click();await expect(ops.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();
 const popupPromise=page.waitForEvent('popup');await blank.click();const popup=await popupPromise;await popup.waitForLoadState();await expect(popup.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();await popup.close();
 const opsFrame=page.frames().find(frame=>frame.url().startsWith('http://localhost:61880/'));assert(opsFrame);
 await expect.poll(async()=>opsFrame.evaluate(async()=>(await(await fetch('/ops-api/snapshot')).json()).platform.pendingEvents),{timeout:60000}).toBe(0);
 const current=await opsFrame.evaluate(async()=>({events:await(await fetch('/ops-api/events')).json(),snapshot:await(await fetch('/ops-api/snapshot')).json()}));
 assert.equal(current.snapshot.platform.pendingEvents,0);assert.equal(current.snapshot.platform.connected,true);
 const deployment=JSON.parse(await readFile(resolve(work,'deployment.json'),'utf8'));
 const expectedEvent=currentPlatformEvent(current.events,{runId:legacy.run,deploymentId:deployment.id,lastSync:current.snapshot.platform.lastSync});
 await expect(loginFailure).toHaveCount(0);assert.deepEqual(diagnostics.errors,[]);
 await page.screenshot({path:resolve(work,'ops-platform-iframe.png'),fullPage:true});
 diagnostics.frontendBase=frontend.origin;diagnostics.platformApiBase=process.env.PANEL_PLATFORM_API_BASE||'local default';
 diagnostics.passed=['real frontend admin login','published system-engine MicroService route','nested Ops iframe independent login','target blank entry opens independently'];
 await openSystemEntry('系统日志/监控');
 const logsPage=page.locator('main.obs-page');await expect(logsPage.getByRole('heading',{name:'系统日志/监控',exact:true})).toBeVisible({timeout:30000});
 await logsPage.locator('.obs-tabs').getByRole('button',{name:'系统日志'}).click();
 const readback=page.waitForResponse(response=>{if(new URL(response.url()).origin!==new URL(endpoint.apiBase).origin||!response.url().includes('/apiengine/mci-system-observability-query'))return false;try{const body=response.request().postDataJSON();return body.Action==='Logs'&&body.Type==='Microi.Ops';}catch{return false;}},{timeout:45000});
 await logsPage.getByRole('button',{name:'平台运维',exact:true}).click();
 const response=await readback;assert.equal(response.status(),200);const payload=await response.json();assert.equal(Number(payload.Code),1);
 const verified=currentPlatformLog(payload.Data,expectedEvent,'iTdos');
 const opsRows=logsPage.locator('.obs-log-panel tbody tr');await expect(opsRows).toHaveCount(payload.Data.length,{timeout:30000});
 const currentRow=opsRows.nth(verified.index);await expect(currentRow).toContainText('平台运维：'+expectedEvent.action);await expect(currentRow).toContainText('Operations');await currentRow.click();
 const detail=page.getByRole('dialog',{name:'日志详情',exact:true});await expect(detail).toBeVisible();await expect(detail.getByText('OpsEventId='+expectedEvent.eventId,{exact:true})).toBeVisible();await expect(detail).toContainText(expectedEvent.deploymentId);
 diagnostics.passed.push('current-run EventId independently matches MongoDB Operations and the opened UI log detail');
 diagnostics.currentRunLog={event:expectedEvent,persistedId:verified.persistedId,row:verified.row,apiBase:endpoint.apiBase,osClient:endpoint.osClient};
 diagnostics.opsLogRows=payload.Data.length;
 await page.screenshot({path:resolve(work,'ops-platform-logs.png'),fullPage:true});
 await expect(loginFailure).toHaveCount(0);assert.deepEqual(diagnostics.errors,[]);
 await writeFile(resolve(work,'platform-menu-result.json'),JSON.stringify(diagnostics,null,2));console.log('PASS platform menu iframe and independent new-window login');
}catch(e){if(page){diagnostics.sidebar=await page.locator('.sidebar-main-menu').textContent().catch(()=>'');diagnostics.frames=page.frames().map(f=>{const u=new URL(f.url()||'about:blank');return{origin:u.origin,path:u.pathname};});await page.screenshot({path:resolve(work,'ops-platform-iframe-failure.png'),fullPage:true}).catch(()=>{});}await writeFile(resolve(work,'platform-menu-diagnostics.json'),JSON.stringify(diagnostics,null,2));throw e;}
finally{await browser.close();}
