import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// 只连接显式提供的本机隔离夹具；不沿用用户浏览器或客户业务账号，不修改宿主策略。
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
assert(process.env.PANEL_DISK_BROWSER_CONTEXT,'Specify the verified local fixture context');
const input=JSON.parse(await readFile(process.env.PANEL_DISK_BROWSER_CONTEXT,'utf8'));
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(input.base).hostname),'Only a loopback acceptance fixture is allowed');
assert.match(input.imageId,/^sha256:[a-f0-9]{64}$/);assert.match(input.sourceHash,/^[a-f0-9]{64}$/);
const output=resolve(input.results);assert(output.startsWith(resolve(root,'.tmp')+sep));await mkdir(output,{recursive:true});
const {chromium,expect}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const report={completed:false,candidate:{imageId:input.imageId,sourceHash:input.sourceHash},scope:'Explicit local fixture; container identity independently verified by host acceptance',passed:[],screenshots:[],errors:[],startedAt:new Date().toISOString()};
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('requestfailed',request=>report.errors.push('Request failed: '+new URL(request.url()).pathname));
 page.on('response',response=>{if(response.status()>=500)report.errors.push('HTTP '+response.status()+': '+new URL(response.url()).pathname);});
 await page.goto(input.base);await page.getByRole('textbox',{name:'运维账号',exact:true}).fill(input.account);
 await page.getByRole('textbox',{name:'运维密码',exact:true}).fill((await readFile(input.passwordFile,'utf8')).trim());
 await page.getByRole('button',{name:'登录运维中心',exact:true}).click();
 await expect(page.getByRole('heading',{name:'服务器总览',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'运维功能'}).getByRole('button',{name:'磁盘与安全清理',exact:true}).click();
 await expect(page.getByText('监测状态有效',{exact:true})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'开启自动安全清理',exact:true})).toBeChecked();
 report.passed.push('independent browser login and live root maintenance status');
 for(const size of [{width:1366,height:900},{width:390,height:844}])for(const theme of ['亮色','暗色']){
  await page.setViewportSize(size);await page.getByRole('button',{name:'主题',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'外观设置',exact:true});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:theme,exact:true}).click();await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  const geometry=await page.locator('.disk-workspace').evaluate(element=>{
   const form=element.querySelector('.disk-policy'),row=element.querySelector('.mci-panel-row');
   const title=row.querySelector('h2').getBoundingClientRect(),button=row.querySelector('button').getBoundingClientRect();
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,formDisplay:getComputedStyle(form).display,
    columns:getComputedStyle(form).gridTemplateColumns.split(' ').length,rowDisplay:getComputedStyle(row).display,
    noOverlap:title.right<=button.left||button.right<=title.left||title.bottom<=button.top||button.bottom<=title.top,
    tableOverflow:getComputedStyle(element.querySelector('.mci-panel-table-scroll')).overflowX,
    overflowElements:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,css:e.className,width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+2&&e.width>0).slice(0,8)};
  });
  assert.equal(geometry.width,size.width,'Actual CSS viewport differs from requested test width');
  assert.equal(geometry.formDisplay,'grid','Disk policy must own its grid layout instead of depending on a sibling scoped stylesheet');
  assert.equal(geometry.columns,size.width>700?2:1,'Policy uses two desktop columns and one mobile column');
  assert.equal(geometry.rowDisplay,'flex');assert(geometry.noOverlap,'Heading and action overlap');
  if(geometry.scrollWidth>geometry.width+1)console.log(JSON.stringify({layoutFailure:geometry}));
  assert(['auto','scroll'].includes(geometry.tableOverflow));assert(geometry.scrollWidth<=geometry.width+1,'Page has horizontal overflow');
  const file='disk-'+size.width+'-'+(theme==='亮色'?'light':'dark')+'.png';
  await page.getByRole('heading',{name:'磁盘与安全清理',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(output,file),fullPage:false});
  report.passed.push(size.width+'px '+theme+' layout, table scrolling and no overlap');report.screenshots.push({file,geometry});
 }
 assert.deepEqual(report.errors,[],'Unexpected browser or network errors');report.completed=true;
}catch(error){report.failure=error.message;throw error;}
finally{
 await browser.close();report.finishedAt=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({completed:report.completed,checks:report.passed.length,errors:report.errors,report:resolve(output,'report.json')}));
}
