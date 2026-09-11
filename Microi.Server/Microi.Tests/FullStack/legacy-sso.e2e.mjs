// Read-only customer acceptance. Inputs come from process env, never reports.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../../../Microi.Client/node_modules/playwright/index.mjs';
const entry=process.env.MICROI_TEST_LEGACY_SSO_ENTRY,target=process.env.MICROI_TEST_LEGACY_SSO_TARGET,expectedText=process.env.MICROI_TEST_LEGACY_SSO_EXPECT_TEXT;
if(!entry||!target||!expectedText)throw Error('Set MICROI_TEST_LEGACY_SSO_ENTRY, MICROI_TEST_LEGACY_SSO_TARGET and MICROI_TEST_LEGACY_SSO_EXPECT_TEXT for read-only SSO acceptance');
const report=path.resolve(process.argv[2]||'.tmp/legacy-sso-acceptance');await fs.mkdir(report,{recursive:true});
const freshAssets=process.argv.includes('--fresh-assets');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const safe=s=>String(s).replace(/eyJ[A-Za-z0-9_.-]+/g,'[TOKEN]').replace(/([?&](?:token|_token)=)[^&#\s]*/ig,'$1[REDACTED]');
let page;
const calls=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});page=await context.newPage();
 if(freshAssets){
  // A read-only cache-isolation diagnostic, not a mocked response or CORS bypass.
  // Preserve origin, authentication, response status/body and browser enforcement.
  const nonce=Date.now().toString();
  await context.route('**/micro-app/**',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==new URL(entry).origin||!url.pathname.startsWith('/micro-app/'))return route.continue();
   url.searchParams.set('microi_cache_probe',nonce);
   return route.continue({url:url.href});
  });
 }
 page.on('pageerror',e=>errors.push(safe(e.message)));
 page.on('console',m=>{if(m.type()==='error'||/^\[Vue warn\]/.test(m.text()))errors.push(safe(m.text()).slice(0,600));});
 page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')errors.push(`request failed: ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`);});
 page.on('response',async r=>{if(/TokenLogin|sso_legacy_capabilities/.test(r.url())){let j;try{j=await r.json()}catch{}calls.push({endpoint:new URL(r.url()).pathname,http:r.status(),code:j?.Code});}});
 page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${new URL(r.url()).pathname}`);});
 await page.goto(entry,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForURL(u=>u.hash.startsWith('#'+target)&&!/[?&]token=/i.test(u.href),{timeout:60000});
 await page.getByText(expectedText,{exact:true}).waitFor({state:'visible',timeout:60000});
 await page.waitForTimeout(5000);
 const url=new URL(page.url()),query=new URLSearchParams(url.hash.split('?')[1]);
 assert.equal(query.get('ShowClassicLeft'),'0');assert.equal(query.get('ShowClassicTop'),'0');
 assert.ok(calls.some(c=>/TokenLogin/i.test(c.endpoint)&&c.http===200&&c.code===1),'Expected successful native TokenLogin');
 assert.equal(errors.length,0,errors.join('\n'));
 assert.equal(await page.getByRole('button',{name:'登录',exact:true}).count(),0);
 await page.screenshot({path:path.join(report,'page.png'),fullPage:true});
 await fs.writeFile(path.join(report,'result.json'),JSON.stringify({passed:true,freshAssets,url:safe(page.url()),visibleExpectedText:expectedText,calls,errors},null,2));
 console.log(JSON.stringify({passed:true,path:target,calls,errors}));
 await context.close();
}catch(error){
 if(page){
  await page.screenshot({path:path.join(report,'failure.png'),fullPage:true}).catch(()=>{});
  const structure=await page.evaluate(()=>{
   const app=document.querySelector('#app')?.__vue_app__,r=app?.config.globalProperties.$router?.currentRoute?.value;
   return {matched:r?.matched?.map(m=>({path:m.path,name:m.name,components:Object.fromEntries(Object.entries(m.components||{}).map(([k,c])=>[k,c.name||c.__name||typeof c]))})),frames:[...document.querySelectorAll('iframe,micro-app')].map(e=>({tag:e.tagName,src:e.getAttribute('src'),url:e.getAttribute('url')})),classes:[...document.querySelectorAll('#app [class]')].slice(0,45).map(e=>e.className)};
  });
  await fs.writeFile(path.join(report,'failure.json'),JSON.stringify({passed:false,freshAssets,url:safe(page.url()),message:safe(error.message),calls,errors,structure,visibleText:safe((await page.locator('body').innerText()).slice(0,2500))},null,2));
 }
 throw error;
}finally{await browser.close();}
