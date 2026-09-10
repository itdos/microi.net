import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,X509Certificate} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert(/^panel-order-[a-z]-\d{8}$/.test(config.runId));assert(/^[\d.]+$/.test(config.host));
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
function ssh(command){return execFileSync('ssh',['-i',config.keyFile,'-o','UserKnownHostsFile='+config.knownHostsFile,'-o','StrictHostKeyChecking=yes','paneltest@'+config.host,command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
assert.equal(ssh('cat /var/lib/panel-acceptance-id'),config.runId);
const certificate=new X509Certificate(await readFile(config.certificateFile));
const spki=createHash('sha256').update(certificate.publicKey.export({type:'spki',format:'der'})).digest('base64');
const password=ssh('sudo cat /microi/panel/config/admin-password');
const work=resolve(config.outputDirectory,config.phase+'-browser');await mkdir(work,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined,args:['--ignore-certificate-errors-spki-list='+spki]});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.goto('https://'+config.host+':61890');assert.equal(response.status(),200);
 await page.getByLabel(/^运维账号/).fill('paneladmin');await page.getByLabel(/^运维密码/).fill(password);await page.getByRole('button',{name:'登录运维中心',exact:true}).click();
 await expect(page.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();await expect(page.locator('.mci-skeleton')).toHaveCount(0);
 await page.screenshot({path:resolve(work,'panel-dashboard.png'),fullPage:true});passed.push('real independent Panel browser login');
 await page.getByRole('navigation',{name:'运维功能'}).getByRole('button',{name:'网站与反向代理',exact:true}).click();await expect(page.getByText('共存验收站点',{exact:true})).toBeVisible();
 await page.screenshot({path:resolve(work,'panel-websites.png'),fullPage:true});passed.push('original Nginx website appears after third-party installation');
 assert.deepEqual(errors,[],'Panel browser runtime errors');
 if(config.baota){
  const third=await context.newPage();const response=await third.goto('http://'+config.host+':18992/panelCoexistA');assert.equal(response.status(),200);
  await expect(third.locator('input[type=password]')).toBeVisible();await third.screenshot({path:resolve(work,'baota-login.png'),fullPage:true});passed.push('real BaoTa browser login page remains usable');await third.close();
 }
 if(config.onepanel){
  const third=await context.newPage();const response=await third.goto('http://'+config.host+':18991/panelCoexistA');assert.equal(response.status(),200);
  await expect(third.locator('input[type=password]')).toBeVisible();await third.screenshot({path:resolve(work,'1panel-login.png'),fullPage:true});passed.push('real 1Panel browser login page remains usable');await third.close();
 }
 await writeFile(resolve(work,'report.json'),JSON.stringify({runId:config.runId,phase:config.phase,passed,completed:true,certificateSpki:spki,tlsProof:'The separate Linux HTTP acceptance validates the full installed certificate and hostname.'},null,2));
 console.log(JSON.stringify({runId:config.runId,phase:config.phase,passed,completed:true}));
}finally{await browser.close();}
