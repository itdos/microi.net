import assert from 'node:assert/strict';
import path from 'node:path';

async function selectTheme(page, mode) {
 const trigger=page.getByRole('button',{name:'主题设置',exact:true});
 await trigger.click();
 const panel=page.locator('.mci-theme-popover:visible');
 await panel.waitFor({state:'visible'});
 await panel.locator('.mci-mode-row').first().locator('button').nth(mode==='dark'?1:0).click();
 await page.locator(`.saas-promotion[data-theme="${mode}"]`).waitFor({state:'visible',timeout:15000});
 const saved=panel.locator('.mci-theme-save-status');
 if(await saved.count())await saved.evaluate(el=>new Promise((resolve,reject)=>{
  const deadline=Date.now()+120000;
  const check=()=>{
   if(el.classList.contains('is-saved')||el.classList.contains('is-local'))return resolve();
   if(el.classList.contains('is-error')||Date.now()>deadline)return reject(Error('主题偏好未成功保存'));
   setTimeout(check,100);
  };check();
 }));
 await trigger.click();
}

async function assertReadable(app) {
 const issues=await app.evaluate(root=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const parse=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
  const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));
  const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const issues=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,el=node.parentElement,text=node.textContent.trim();
   if(!text||el.closest('button:disabled,[aria-hidden="true"]'))continue;
   const range=document.createRange();range.selectNodeContents(node);
   if(![...range.getClientRects()].some(r=>r.width>0&&r.height>0))continue;
   const style=getComputedStyle(el);if(style.visibility==='hidden'||Number(style.opacity)<.5)continue;
   let chain=[],current=el;while(current){chain.push(current);current=current.parentElement;}
   let bg=[255,255,255];for(const ancestor of chain.reverse())bg=blend(parse(getComputedStyle(ancestor).backgroundColor),bg);
   const fg=blend(parse(style.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   if(ratio<4.5)issues.push({text:text.slice(0,40),ratio:Math.round(ratio*100)/100,color:style.color});
  }
  return issues;
 });
 assert.deepEqual(issues,[],'推广页面存在低于 4.5:1 的可见文字：'+JSON.stringify(issues));
}

// 调用方创建的 context 各自绑定 ApiBase + OsClient；本模块不修改接口响应或权限数据。
// 候选静态资源拦截由调用方明确标记，正式线上验收必须关闭该拦截。
export async function verifySaasPromotionBrowser({page,url,directory,trial,actor,name,expectedSettings}) {
 const checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const app=page.locator('.saas-promotion.sp-shell');await app.waitFor({state:'visible',timeout:120000});
 await app.locator('.sp-skeleton').waitFor({state:'hidden',timeout:240000});
 assert.equal(await app.locator('.sp-alert').count(),0);
 assert.equal(await app.getByRole('button',{name:'开通配置',exact:true}).count(),expectedSettings?1:0);
 assert.equal(await app.locator('.sp-cards').first().locator('article').count(),6);
 const total=Number((await app.locator('.sp-cards strong').first().innerText()).replace('套',''));
 assert.ok(Number.isInteger(total)&&total>=1,'总览必须呈现真实非空数据');checks.push('实际总览与岗位配置入口');

 await app.getByRole('button',{name:'租户台账',exact:true}).click();
 await app.locator('.sp-filters input').first().fill(trial.OsClient);
 await app.getByRole('button',{name:'筛选',exact:true}).click();
 const row=app.locator('tbody tr').filter({hasText:trial.OsClient});
 await row.waitFor({state:'visible',timeout:120000});
 await page.waitForFunction(key=>[...document.querySelectorAll('.sp-shell tbody tr')]
  .some(el=>el.innerText.includes(key)&&/正常|部分可读|上次统计/.test(el.innerText)),trial.OsClient,{timeout:120000});
 assert.match(await row.innerText(),new RegExp(actor));
 const cells=await row.locator('td').allInnerTexts();
 for(const i of [2,3,4,5])assert.ok(Number(cells[i])>0,'用量不得只显示占位或零');
 await row.getByRole('button',{name:'详情 / 跟进'}).click();
 const detail=app.getByRole('dialog');await detail.waitFor({state:'visible',timeout:120000});
 await detail.locator('.sp-usage-grid').waitFor({state:'visible'});
 assert.ok(await detail.locator('.sp-usage-grid article').count()>=18);
 assert.equal(await detail.getByText('未记录',{exact:true}).count(),0);
 await page.screenshot({path:path.join(directory,name+'-tenant-detail.png'),fullPage:true});
 await detail.getByRole('button',{name:'关闭租户详情'}).click();checks.push('真实台账、跨库计数及完整详情');

 await app.getByRole('button',{name:'团队统计',exact:true}).click();
 await app.locator('tbody tr').filter({hasText:actor}).waitFor({state:'visible',timeout:120000});
 await app.getByRole('button',{name:'试用跟进',exact:true}).click();
 await app.locator('tbody tr').filter({hasText:trial.OsClient}).waitFor({state:'visible',timeout:120000});
 await app.getByRole('button',{name:'推广链接',exact:true}).click();
 await app.getByText('本任务推广验收20261005',{exact:true}).waitFor({state:'visible',timeout:120000});
 checks.push('团队、试用及真实推广活动切换');

 await app.getByRole('button',{name:'推广总览',exact:true}).click();
 await app.locator('.sp-cards strong').first().waitFor({state:'visible',timeout:120000});
 const originalMode=await page.evaluate(()=>document.documentElement.classList.contains('dark')?'dark':'light');
 await selectTheme(page,'light');await assertReadable(app);
 await page.screenshot({path:path.join(directory,name+'-light.png'),fullPage:true});
 await selectTheme(page,'dark');await assertReadable(app);
 await page.screenshot({path:path.join(directory,name+'-dark.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 // 平台在窄屏切换 AppMain，原微服务宿主会卸载；先等新布局与真实页面完成挂载。
 await page.locator('.app-wrapper-microi.mobile').waitFor({state:'visible',timeout:120000});
 await app.waitFor({state:'visible',timeout:120000});
 await app.locator('.sp-skeleton').waitFor({state:'hidden',timeout:240000});
 const fits=await app.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth+1);
 assert.equal(fits,true);await assertReadable(app);await page.screenshot({path:path.join(directory,name+'-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1536,height:1100});
 await page.locator('.app-wrapper-microi:not(.mobile)').waitFor({state:'visible',timeout:120000});
 await app.waitFor({state:'visible',timeout:120000});
 await selectTheme(page,originalMode);
 assert.deepEqual(errors,[]);checks.push('明暗主题、390像素布局与控制台');
 return {passed:checks.length,failed:0,skipped:0,checks,total};
}

export async function verifyPublicTrialRecovery({page,url,directory,trial,requestId}) {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'您的空间已准备好'}).waitFor({state:'visible',timeout:180000});
 assert.ok((await page.locator('.sp-public-card').innerText()).includes(requestId));
 assert.ok((await page.locator('.sp-public-card').innerText()).includes(trial.OsClient));
 assert.equal(await page.getByRole('link',{name:'进入系统 ↗'}).count(),1);
 const persisted=await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('Microi:SaasPublicTrial:')).map(k=>JSON.parse(sessionStorage.getItem(k))));
 assert.equal(persisted.length,1);assert.ok(!JSON.stringify(persisted).includes('AdminPassword'));
 await page.screenshot({path:path.join(directory,'public-trial-recovery.png'),fullPage:true});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'您的空间已准备好'}).waitFor({state:'visible',timeout:180000});
 assert.deepEqual(errors,[]);
 return {passed:1,failed:0,skipped:0,checks:['真实匿名进度票据、成功入口与刷新恢复；浏览器不保存密码']};
}
