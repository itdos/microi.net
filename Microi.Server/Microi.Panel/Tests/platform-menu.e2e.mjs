import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,legacy.work);
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const lines=(await readFile(resolve(root,'AI测试要用到的帐号密码.txt'),'utf8')).split(/\r?\n/),hostIndex=lines.findIndex(x=>x.includes('api.itdos.com'));
const credential=lines.slice(hostIndex+1).find(x=>/^帐号/.test(x.trim()))?.match(/^帐号\s*([^，,\s]+).*?密码\s*([^，,\s]+)/);assert(credential?.[1]==='admin');
const env=await readFile(resolve(work,'ops-test.env'),'utf8'),password=env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const browser=await chromium.launch({channel:'msedge',headless:true});let page;
const diagnostics={frames:[],errors:[]};
try{
 // 官方平台使用真实系统信任链；仅原有本机开发接口允许其自签名证书。
 page=await browser.newPage({ignoreHTTPSErrors:!process.env.PANEL_PLATFORM_API_BASE,viewport:{width:1600,height:1100}});
 page.on('response',async r=>{if(r.url().includes('GetSysMenuStep')){try{const j=await r.json();diagnostics.menuResponse={code:j.Code,includesOps:JSON.stringify(j).includes('吾码服务器运维面板')};}catch{}}});page.on('pageerror',e=>diagnostics.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/GotoSystem error:|frame-ancestors|frame|CSP/i.test(m.text()))diagnostics.errors.push(m.text());});
 const frontend = new URL(process.env.PANEL_PLATFORM_FRONTEND_BASE || 'http://localhost:61500/');
 assert.equal(frontend.origin,'http://localhost:61500','Use the isolated local browser origin authorized by this fixture');
 assert(!process.env.PANEL_PLATFORM_API_BASE || new URL(process.env.PANEL_PLATFORM_API_BASE).href==='https://api.itdos.com/','Remote browser target must match the approved official credential target');
 frontend.searchParams.set('OsClient','iTdos');
 if(process.env.PANEL_PLATFORM_API_BASE)frontend.searchParams.set('ApiBase',process.env.PANEL_PLATFORM_API_BASE);
 await page.goto(frontend.href);
 const account=page.locator('input[placeholder*="用户名"],input[placeholder*="账号"],input[placeholder*="帐号"],input[placeholder*="username" i]').first();await account.waitFor({timeout:45000});await account.fill(credential[1]);await page.locator('input[type=password]').first().fill(credential[2]);
 const privacy=page.locator('.privacy-policy-wrapper .el-checkbox').first();if(await privacy.isVisible().catch(()=>false)){if(!await privacy.locator('input').isChecked())await privacy.click();}
 const loginResponse=page.waitForResponse(r=>/\/api\/SysUser\/Login(?:\?|$)/i.test(r.url()),{timeout:30000});await page.getByRole('button',{name:'登录',exact:true}).click();const result=await(await loginResponse).json();assert.equal(Number(result.Code),1,result.Msg);
 // A successful login response precedes route initialization. Forcing a hash
 // navigation here cancels that initialization and can produce a false login error.
 await expect(page.locator('.task-entry[title="通知中心"]')).toBeVisible({timeout:60000});
 await expect(account).toBeHidden({timeout:30000});
 const loginFailure=page.getByText('登录成功，但进入系统失败，请重试。',{exact:true});
 await expect(loginFailure).toHaveCount(0);
 const system=page.locator('.el-sub-menu__title').filter({hasText:'系统引擎'}).first();
 await system.click({timeout:30000});
 await expect(page.getByText('服务器运维面板',{exact:true}).first()).toBeVisible({timeout:5000}).catch(async()=>{await system.click();});
 await page.getByText('服务器运维面板',{exact:true}).first().click({timeout:30000});
 let entry;for(let i=0;i<60;i++){for(const f of page.frames()){if(await f.getByRole('heading',{name:'吾码服务器运维面板',exact:true}).count()){entry=f;break;}}if(entry)break;await new Promise(r=>setTimeout(r,500));}
 diagnostics.frames=page.frames().map(f=>{const u=new URL(f.url()||'about:blank');return{origin:u.origin,path:u.pathname};});
 assert(entry,'Platform MicroService frame missing');await expect(entry.getByRole('heading',{name:'吾码服务器运维面板',exact:true})).toBeVisible({timeout:30000});
 const temporary=entry.getByLabel('独立面板地址'),blank=entry.getByRole('link',{name:'在新窗口打开 ↗'});
 await expect(temporary.or(blank).first()).toBeVisible({timeout:30000});
 if(await temporary.isVisible()){await temporary.fill('http://localhost:61880');await entry.getByRole('button',{name:'打开服务器面板',exact:true}).click();}
 await expect(blank).toHaveAttribute('target','_blank');await expect(blank).toHaveAttribute('rel','noopener noreferrer');
 const ops=entry.frameLocator('iframe[title="Microi.Panel 独立服务器运维面板"]');await ops.getByLabel('运维账号').fill('ops-test',{timeout:25000});await ops.getByLabel('运维密码').fill(password);await ops.getByRole('button',{name:'登录运维中心',exact:true}).click();await expect(ops.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();
 const popupPromise=page.waitForEvent('popup');await blank.click();const popup=await popupPromise;await popup.waitForLoadState();await expect(popup.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();await popup.close();
 await expect(loginFailure).toHaveCount(0);assert.deepEqual(diagnostics.errors,[]);
 await page.screenshot({path:resolve(work,'ops-platform-iframe.png'),fullPage:true});
 diagnostics.frontendBase=frontend.origin;diagnostics.platformApiBase=process.env.PANEL_PLATFORM_API_BASE||'local default';
 diagnostics.passed=['real frontend admin login','published system-engine MicroService route','nested Ops iframe independent login','target blank entry opens independently'];
 await page.getByText('系统日志/监控',{exact:true}).first().click();
 const logsPage=page.locator('main.obs-page');await expect(logsPage.getByRole('heading',{name:'系统日志/监控',exact:true})).toBeVisible({timeout:30000});
 await logsPage.locator('.obs-tabs').getByRole('button',{name:'系统日志'}).click();
 await logsPage.getByRole('button',{name:'平台运维',exact:true}).click();
 const opsRows=logsPage.locator('.obs-log-panel tbody tr').filter({hasText:'Microi.Ops'});
 await expect(opsRows.first()).toBeVisible({timeout:30000});
 assert.match(await opsRows.first().textContent(),/Operations/);
 diagnostics.passed.push('platform system logs show MongoDB Operations / Microi.Ops events');
 diagnostics.opsLogRows=await opsRows.count();
 await page.screenshot({path:resolve(work,'ops-platform-logs.png'),fullPage:true});
 await expect(loginFailure).toHaveCount(0);assert.deepEqual(diagnostics.errors,[]);
 await writeFile(resolve(work,'platform-menu-result.json'),JSON.stringify(diagnostics,null,2));console.log('PASS platform menu iframe and independent new-window login');
}catch(e){if(page){diagnostics.sidebar=await page.locator('.sidebar-main-menu').textContent().catch(()=>'');diagnostics.frames=page.frames().map(f=>{const u=new URL(f.url()||'about:blank');return{origin:u.origin,path:u.pathname};});await page.screenshot({path:resolve(work,'ops-platform-iframe-failure.png'),fullPage:true}).catch(()=>{});}await writeFile(resolve(work,'platform-menu-diagnostics.json'),JSON.stringify(diagnostics,null,2));throw e;}
finally{await browser.close();}
