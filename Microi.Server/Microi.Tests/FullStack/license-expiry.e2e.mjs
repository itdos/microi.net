import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// 浏览器使用真实登录。只替换本测试页面的时钟相关接口响应，不修改实际 License 或租户期限。
// 可信日期、两层投递及持久回执由 TenantLicensePolicyTests 和 platform-reminder-presentation.test.mjs 验证。
export async function verifyLicenseExpiryPresentation(page,directory){
 const checks=[],source=await fs.readFile(new URL('../../Microi.Upgrade/Resource/license-expiry-model.js',import.meta.url),'utf8');
 const model=new Function(source+';return createLicenseExpiryModel();')();
 const expiration=new Date(Date.now()+5*86400000+19*3600000+38*60000+20000).toISOString();
 let closed=false,acknowledgements=0,inboxReads=0;
 const session=async route=>{
  if(!route.request().postData()?.includes('GetConnectionInfo'))return route.continue();
  await route.fulfill({json:{Code:1,Data:{ProductType:'Enterprise',LicenseExpirationDate:expiration,OsClient:'iTdos'}}});
 };
 const reminders=async route=>{
  const raw=route.request().postData()||'',p=raw.startsWith('{')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
  if(!['Inbox','Acknowledge'].includes(p.Action))return route.continue();
  if(p.Action==='Acknowledge'){closed=true;acknowledgements++;return route.fulfill({json:{Code:1,Data:{Closed:true}}});}
  inboxReads++;const item={...model.project(null,'Enterprise',expiration,Date.now(),false),Id:'license-ui-fixture',BatchId:'license-ui-fixture',Source:'SystemLicense'};
  return route.fulfill({json:{Code:1,Data:closed?[]:[item],DataAppend:{ActiveIds:[item.Id],ProtocolVersion:2,NextCheckAt:new Date(Date.now()+60000).toISOString()}}});
 };
 await page.route('**/apiengine/platform-sys-user-session*',session);await page.route('**/apiengine/platform-reminder-runtime*',reminders);
 const dialog=page.locator('.mci-platform-reminder:visible'),tag=page.getByTestId('platform-edition');
 const seconds=text=>{const m=text.match(/(\d+)天(\d+)小时(\d+)分(\d+)秒/);assert.ok(m,text);return Number(m[1])*86400+Number(m[2])*3600+Number(m[3])*60+Number(m[4]);};
 try{
  await page.reload({waitUntil:'domcontentloaded'});await dialog.waitFor();
  await page.waitForFunction(()=>/秒/.test(document.querySelector('[data-testid="platform-edition"]')?.textContent||''));
  const first=seconds(await tag.innerText());await page.waitForTimeout(2200);const second=seconds(await tag.innerText());assert.ok(first-second>=2&&first-second<=4);
  assert.match(await dialog.innerText(),/倒计时\d+天\d+小时\d+分/);assert.doesNotMatch(await dialog.locator('.mci-platform-reminder__content').innerText(),/\d+秒/);
  const colors=await dialog.locator('.el-dialog__title').evaluate(el=>{const probe=document.createElement('span');probe.style.color='var(--el-color-danger)';el.appendChild(probe);const expected=getComputedStyle(probe).color;probe.remove();return {actual:getComputedStyle(el).color,expected};});assert.equal(colors.actual,colors.expected);
  await fs.mkdir(directory,{recursive:true});await page.screenshot({path:path.join(directory,'license-countdown-dialog.png')});checks.push('五天内标签秒级递减、红色标题、正文分钟倒计时');
  const pageCount=page.context().pages().length;await dialog.getByRole('link',{name:'查看授权'}).click();await page.waitForURL(/#\/license$/);await dialog.waitFor({state:'hidden'});
  assert.equal(page.context().pages().length,pageCount);assert.equal(acknowledgements,0);checks.push('查看授权站内路由跳转且不确认已读');
  await page.reload({waitUntil:'domcontentloaded'});await dialog.waitFor();assert.equal(acknowledgements,0);checks.push('未确认刷新继续提示');
  await dialog.getByRole('button',{name:'我知道了'}).click();await dialog.waitFor({state:'hidden'});await page.waitForTimeout(250);assert.equal(acknowledgements,1);
  const previous=inboxReads;await page.reload({waitUntil:'domcontentloaded'});await page.waitForResponse(r=>r.url().includes('/apiengine/platform-reminder-runtime')&&r.request().postData()?.includes('Inbox'));
  assert.ok(inboxReads>previous);assert.equal(await dialog.count(),0);checks.push('确认后刷新不再显示');
 }finally{await page.unroute('**/apiengine/platform-sys-user-session*',session);await page.unroute('**/apiengine/platform-reminder-runtime*',reminders);}
 await fs.writeFile(path.join(directory,'license-presentation-results.json'),JSON.stringify({checks,passed:checks.length,fixture:'真实登录、本页面接口日期响应受控；实际授权未修改'},null,2));
 return {passed:checks.length,failed:0,skipped:0};
}
