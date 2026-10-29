import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,X509Certificate} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert(/^[a-z][a-z0-9-]{5,80}$/.test(config.runId));assert(/^[\d.]+$/.test(config.host));
assert(['before-reboot','post-reboot'].includes(config.phase));
assert.equal(config.baota,true);assert.equal(config.onepanel,true);
const sshUser=config.sshUser||'paneltest';assert(/^[a-z_][a-z0-9_-]{0,31}$/.test(sshUser));
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
function ssh(command){return execFileSync('ssh',['-i',config.keyFile,'-o','BatchMode=yes','-o','ConnectTimeout=10','-o','UserKnownHostsFile='+config.knownHostsFile,'-o','StrictHostKeyChecking=yes',sshUser+'@'+config.host,command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
assert.equal(ssh('sudo cat /var/lib/panel-acceptance-id'),config.runId);
function runtime(){
 const bootId=ssh('cat /proc/sys/kernel/random/boot_id'),proc=ssh('cat /proc/stat');
 const bootStartedAt=Number(proc.match(/^btime (\d+)$/m)?.[1]);assert.match(bootId,/^[a-f0-9-]{36}$/);assert(bootStartedAt>0);
 const controller=JSON.parse(ssh('sudo docker inspect microi-panel'))[0];
 assert.equal(controller.Config.Labels['io.microi.panel.controller'],'true');assert.equal(controller.State.Running,true);
 return{bootId,bootStartedAt,imageId:controller.Image,controllerId:controller.Id};
}
const actual=runtime(),startedAt=Date.now()/1000;
const certificate=new X509Certificate(await readFile(config.certificateFile));
const spki=createHash('sha256').update(certificate.publicKey.export({type:'spki',format:'der'})).digest('base64');
const password=ssh('sudo cat /microi/panel/config/admin-password');
const env=Object.fromEntries(ssh('sudo cat /microi/panel/config/panel.env').split('\n').filter(line=>line.includes('=')).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
assert(env.OPS_ADMIN_USERNAME,'Installed administrator account is required');
const panelUrl=config.panelUrl||'https://'+config.host+':61890';
function targetUrl(value,scheme){const parsed=new URL(value);assert(['http:','https:'].includes(parsed.protocol));if(scheme)assert.equal(parsed.protocol,scheme);assert([config.host,'127.0.0.1','localhost'].includes(parsed.hostname));assert(!parsed.username&&!parsed.password&&!parsed.hash);return parsed.href;}
const targets={panel:targetUrl(panelUrl,'https:'),baota:targetUrl(config.baotaUrl||'http://'+config.host+':18992/panelCoexistA'),onepanel:targetUrl(config.onepanelUrl||'http://'+config.host+':18991/panelCoexistA')};
const work=resolve(config.outputDirectory,config.phase+'-browser');await mkdir(work,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined,args:['--ignore-certificate-errors-spki-list='+spki]});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],passed=[];
let completed=false,failure=null;
page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.goto(targets.panel);assert.equal(response.status(),200);
 await page.getByLabel(/^运维账号/).fill(env.OPS_ADMIN_USERNAME);await page.getByLabel(/^运维密码/).fill(password);await page.getByRole('button',{name:'登录运维中心',exact:true}).click();
 await expect(page.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();await expect(page.locator('.mci-skeleton')).toHaveCount(0);
 await page.screenshot({path:resolve(work,'panel-dashboard.png'),fullPage:true});passed.push('real independent Panel browser login');
 await page.getByRole('navigation',{name:'运维功能'}).getByRole('button',{name:'网站与反向代理',exact:true}).click();await expect(page.getByText('共存验收站点',{exact:true})).toBeVisible();
 await page.screenshot({path:resolve(work,'panel-websites.png'),fullPage:true});passed.push('original Nginx website appears after third-party installation');
 assert.deepEqual(errors,[],'Panel browser runtime errors');
 if(config.baota){
  const third=await context.newPage();third.on('pageerror',e=>errors.push(e.message));const response=await third.goto(targets.baota);assert.equal(response.status(),200);
  await expect(third.locator('input[type=password]')).toBeVisible();await third.screenshot({path:resolve(work,'baota-login.png'),fullPage:true});passed.push('real BaoTa browser login page remains usable');await third.close();
 }
 if(config.onepanel){
  const third=await context.newPage();third.on('pageerror',e=>errors.push(e.message));const response=await third.goto(targets.onepanel);assert.equal(response.status(),200);
  await expect(third.locator('input[type=password]')).toBeVisible();await third.screenshot({path:resolve(work,'1panel-login.png'),fullPage:true});passed.push('real 1Panel browser login page remains usable');await third.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(runtime(),actual,'Host or controller changed during browser acceptance');completed=true;
 console.log(JSON.stringify({runId:config.runId,phase:config.phase,passed,completed:true}));
}catch(error){failure=String(error.message).replaceAll(password,'<redacted>');throw new Error(failure);}
finally{
 await writeFile(resolve(work,'report.json'),JSON.stringify({runId:config.runId,phase:config.phase,passed,completed,errors,failure,runtime:actual,startedAt,finishedAt:Date.now()/1000,certificateSpki:spki,tlsProof:'The separate Linux HTTP acceptance validates the full installed certificate and hostname.'},null,2));
 await browser.close();
}
