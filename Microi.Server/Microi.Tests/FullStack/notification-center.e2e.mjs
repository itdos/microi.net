import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '../../../Microi.Client/node_modules/playwright/index.mjs';

const required=name=>{const value=process.env[name]?.trim();if(!value)throw Error(`Notification regression requires ${name}`);return value;};
assert.equal(required('MICROI_TEST_ALLOW_WRITES'),'YES');
const directory=path.resolve(process.argv[2]||'.tmp/microi-notification-tests');
fs.mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[];
try{
 for(const child of [false,true]){
  const tenant=required(child?'MICROI_TEST_CHILD_OSCLIENT':'MICROI_TEST_OSCLIENT');
  const apiBase=(process.env[child?'MICROI_TEST_CHILD_API_BASE':'MICROI_TEST_API_BASE']||required('MICROI_TEST_API_BASE')).replace(/\/+$/,'');
  const context=await browser.newContext({ignoreHTTPSErrors:new URL(apiBase).hostname==='localhost',viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  try{
   await page.route('**/api/SysUser/Login',route=>route.continue({postData:JSON.stringify({...route.request().postDataJSON(),_AutomationTestLogin:true})}));
   await page.goto(`${required('MICROI_TEST_FRONTEND_BASE')}/?OsClient=${encodeURIComponent(tenant)}&ApiBase=${encodeURIComponent(apiBase)}`,{waitUntil:'domcontentloaded',timeout:60000});
   await page.getByPlaceholder(/用户名|账号|帐号|username/i).first().fill(required(child?'MICROI_TEST_CHILD_ACCOUNT':'MICROI_TEST_ACCOUNT'));
   await page.getByPlaceholder(/密码|password/i).first().fill(required(child?'MICROI_TEST_CHILD_PASSWORD':'MICROI_TEST_PASSWORD'));
   const checkbox=page.locator('.el-checkbox').first();
   if(await checkbox.count()&&!(await checkbox.getAttribute('class')).includes('is-checked'))await checkbox.click();
   const loginPromise=page.waitForResponse(r=>r.url().includes('/api/SysUser/Login'));
   await page.getByRole('button',{name:/^登\s*录$/}).click();
   const login=await (await loginPromise).json();assert.equal(login.Code,1,'Real credential login must succeed');
   await page.locator('.task-entry[title="通知中心"]').click({timeout:60000});
   const endpoint=await page.evaluate(()=>window.__MICROI_RUNTIME_ENDPOINT__);
   assert.equal(endpoint.osClient.toLowerCase(),tenant.toLowerCase());
   assert.equal(endpoint.apiBase.replace(/\/$/,''),apiBase.replace(/\/$/,''));
   await page.getByRole('tab',{name:/平台应用/}).click();
   const button=page.getByRole('button',{name:'安装/更新全部平台应用',exact:true});
   if(!child&&tenant.toLowerCase()==='itdos'){
    assert.equal(await button.count(),0,'Official publishing tenant must not install its own packages');
    results.push({tenant,status:'Passed',scenario:'Official publishing source exclusion'});
   }else{
    await button.click();
    const submittedPromise=page.waitForResponse(r=>r.url().includes('/apiengine/platform-background-task')&&r.request().postData()?.includes('RunApiEngine'),{timeout:45000}).catch(error=>({error}));
    await page.locator('.el-message-box').getByRole('button',{name:/确定|确认/}).click();
    const submitted=await submittedPromise;if(submitted.error)throw submitted.error;
    const result=await submitted.json();assert.equal(result.Code,1,result.Msg);assert.ok(result.Data?.Id);
    const request=submitted.request();
    const headers=request.headers();
    let completed=false;
    for(let attempt=0;attempt<750;attempt++){
     const response=await context.request.post(apiBase+'/apiengine/platform-background-task',{headers:{authorization:headers.authorization,did:headers.did||'Microi.Tests'},data:{OsClient:tenant,Action:'Status',Id:result.Data.Id}});
     assert.ok(response.ok(),`Maintenance status request failed: HTTP ${response.status()}`);
     if(response.headers().authorization)headers.authorization=response.headers().authorization;
     const state=await response.json();assert.equal(state.Code,1,state.Msg);
     assert.ok(!['Failed','Canceled'].includes(state.Data.Status),state.Data.Msg);
     if(state.Data.Status==='Succeeded'){assert.equal(state.Data.Progress,100);completed=true;break;}
     await page.waitForTimeout(2000);
    }
    assert.ok(completed,'UI submitted task must reach Succeeded/100% within 25 minutes');
    results.push({tenant,status:'Passed',scenario:'Notification center maintenance',taskId:result.Data.Id});
   }
   await page.screenshot({path:path.join(directory,`${child?'child':'main'}-notification.png`),animations:'disabled'});
  }finally{await context.close();}
 }
 assert.equal(results.length,2);
 fs.writeFileSync(path.join(directory,'notification-results.json'),JSON.stringify(results,null,2));
 console.log('Notification center: 2 passed, 0 failed, 0 skipped');
}finally{await browser.close();}
