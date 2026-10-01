import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const password = process.env.PW_TEST_PASSWORD;
const output = path.resolve(process.env.PW_SCREENSHOT_DIR || '../.tmp/navigation-home-20260930');
test.use({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, channel: 'msedge', locale: 'zh-CN', actionTimeout:30000 });
test.setTimeout(240000);

async function login(page) {
  if (!password) throw new Error('A protected local test credential is required.');
  await page.goto('http://localhost:61500/?OsClient=iTdos');
  await page.locator('input[placeholder*="账号"],input[placeholder*="帐号"],input[placeholder*="用户名"],input[placeholder*="user name" i],input[placeholder*="username" i]').first().fill('admin',{timeout:45000});
  await page.locator('input[type="password"]').first().fill(password);
  const privacy=page.locator('.privacy-policy-wrapper .el-checkbox');
  if(await privacy.isVisible() && !(await privacy.getAttribute('class')).includes('is-checked')) await privacy.click();
  const response=page.waitForResponse(r=>/\/api\/SysUser\/Login(?:\?|$)/i.test(r.url()));
  await page.getByRole('button',{name:'登录',exact:true}).click();
  expect(Number((await(await response).json()).Code)).toBe(1);
  await page.getByRole('button',{name:'主题设置',exact:true}).first().waitFor({timeout:60000});
}
async function current(page) {
  return page.evaluate(async()=>{
    const p=await import('/src/pinia/index.js'); const user=p.useDiyStore().GetCurrentUser;
    return Object.fromEntries(['CornerStyle','NavigationLayout','MenuChildExpandMode','ThemeMode'].map(k=>[k,user[k]]));
  });
}
async function panel(page) {
  const popover=page.locator('.mci-theme-popover:visible');
  if(!await popover.isVisible()) await page.getByRole('button',{name:'主题设置',exact:true}).first().click();
  await expect(popover).toBeVisible();return popover;
}
async function choose(page,group,label) {
  await fs.writeFile(path.join(output,'e2e-stage.txt'),group+' / '+label);
  const popover=await panel(page);
  await popover.getByRole('group',{name:group,exact:true}).getByRole('button',{name:label,exact:true}).click();
  await expect(popover.locator('.mci-theme-save-status')).toHaveText('已自动保存',{timeout:45000});
}
async function closePanel(page) { await page.mouse.click(500,70); }

test('global inheritance, personal persistence, top navigation and compact home work together',async({page,browser})=>{
  await fs.mkdir(output,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error' && /TypeError|ReferenceError|Unhandled/.test(message.text()))errors.push(message.text().split('\n')[0]);});
  await login(page);
  const baseline=JSON.parse(await fs.readFile(path.join(output,'ui-preferences-before.json'),'utf8'));
  const original=baseline.user;
  try {
    await choose(page,'边角风格','直角');
    await expect(page.locator('html')).toHaveAttribute('data-mci-corner-style','square');
    await choose(page,'菜单子级展开方式','向下展开');
    await choose(page,'导航菜单位置','顶部导航');
    await closePanel(page);
    const navigation=page.getByRole('navigation',{name:'顶部导航',exact:true});
    await expect(navigation).toBeVisible();
    await expect(page.locator('.sidebar-container:visible')).toHaveCount(0);
    await expect(navigation.getByText('系统引擎',{exact:true})).toBeVisible();
    await navigation.getByText('系统引擎',{exact:true}).hover();
    await expect(page.locator('.mci-top-navigation-popup:visible').first().getByText('接口引擎',{exact:true})).toBeVisible();
    await page.mouse.move(900,180);
    await page.reload();
    await expect(navigation).toBeVisible({timeout:60000});
    await expect(page.locator('html')).toHaveAttribute('data-mci-corner-style','square');
    expect(await current(page)).toMatchObject({CornerStyle:'square',NavigationLayout:'Top',MenuChildExpandMode:'Down'});

    const other=await browser.newContext({viewport:{width:1366,height:900},ignoreHTTPSErrors:true});
    try {
      const otherPage=await other.newPage();await login(otherPage);
      await expect(otherPage.getByRole('navigation',{name:'顶部导航',exact:true})).toBeVisible();
      expect(await current(otherPage)).toMatchObject({CornerStyle:'square',NavigationLayout:'Top',MenuChildExpandMode:'Down'});
      await otherPage.screenshot({path:path.join(output,'top-navigation-1366.png'),fullPage:true});
    }finally{await other.close();}

    const overview=page.getByTestId('platform-home-overview');
    await expect(overview.locator('.overview-skeleton')).toHaveCount(0,{timeout:60000});
    await expect(overview.getByTestId('home-usage-chart')).toBeVisible();
    const composer=page.locator('.aiengine-widget [data-testid="unified-ai-assistant"]:visible').last();
    await expect(composer.getByTestId('unified-ai-input')).toBeVisible();
    const aiBox=await composer.boundingBox(), overviewBox=await overview.boundingBox();
    expect(Math.abs(aiBox.y-overviewBox.y)).toBeLessThan(80);
    expect(overviewBox.x).toBeGreaterThan(aiBox.x);
    await expect(page.locator('.workcenter-widget').first().locator('.el-pagination__total')).toBeVisible({timeout:60000});
    await page.screenshot({path:path.join(output,'compact-home-top-1920.png'),fullPage:true});
    await choose(page,'边角风格','跟随系统');
    await expect(page.locator('html')).toHaveAttribute('data-mci-corner-style','round');
    await choose(page,'显示模式','暗色');await closePanel(page);
    await page.screenshot({path:path.join(output,'compact-home-dark.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect(navigation).toHaveCount(0);
    await expect(composer.getByTestId('unified-ai-input')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:path.join(output,'compact-home-mobile.png'),fullPage:true});
    expect(errors).toEqual([]);
  } finally {
    await page.setViewportSize({width:1920,height:1080});
    await choose(page,'边角风格',original.CornerStyle==='square'?'直角':original.CornerStyle==='round'?'圆角':'跟随系统');
    await choose(page,'导航菜单位置',original.NavigationLayout==='Top'?'顶部导航':original.NavigationLayout==='Side'?'侧边导航':'跟随系统');
    await choose(page,'菜单子级展开方式',original.MenuChildExpandMode==='Down'?'向下展开':original.MenuChildExpandMode==='Right'?'向右展开':'跟随系统');
    await choose(page,'显示模式',original.ThemeMode==='dark'?'暗色':'浅色');
  }
});

test('desktop content scroll stays below navigation and homepage calendar persists events',async({page})=>{
  await fs.mkdir(output,{recursive:true});
  await login(page);
  await expect(page.getByTestId('home-usage-chart')).toBeVisible({timeout:60000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // 仅修改一次性浏览器内的布局投影，不改写共享管理员的个人偏好。
  for(const navigation of ['Top','Side','Top']) {
    await page.evaluate(async navigation=>{const p=await import('/src/pinia/index.js');p.useDiyStore().GetCurrentUser.NavigationLayout=navigation;},navigation);
    for(const width of [1920,1366]) {
      await page.setViewportSize({width,height:760});
      await expect.poll(()=>page.evaluate(()=>{
        const chart=document.querySelector('.usage-chart');const canvas=chart?.querySelector('canvas');
        return !!canvas&&Math.abs(canvas.getBoundingClientRect().width-chart.clientWidth)<2;
      })).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
      const shell=await page.evaluate(()=>{const e=document.querySelector('.main-container-microi');return {width:e.clientWidth,scrollWidth:e.scrollWidth};});
      expect(shell.scrollWidth).toBeLessThanOrEqual(shell.width+1);
      const strip=page.locator('.tags-view-strip'),navbar=page.locator('.navbar-microi');
      const before={tab:await strip.boundingBox(),nav:await navbar.boundingBox()};
      await page.locator('.mci-route-view-host').evaluate(e=>{e.scrollTop=e.scrollHeight;});
      expect(await page.locator('.mci-route-view-host').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
      expect((await strip.boundingBox()).y).toBe(before.tab.y);
      expect((await navbar.boundingBox()).y).toBe(before.nav.y);
      await page.screenshot({path:path.join(output,`scroll-${navigation}-${width}.png`)});
      await page.locator('.mci-route-view-host').evaluate(e=>{e.scrollTop=0;});
    }
  }
  const calendar=page.locator('.diycalendar-widget .microi-calendar');
  await expect(calendar).toBeVisible();
  await calendar.locator('.fc-day-today .fc-daygrid-day-frame').click({position:{x:15,y:25}});
  const dialog=page.getByRole('dialog',{name:'新建日程',exact:true});
  await expect(dialog).toBeVisible();
  const title=`日历滚动验收-${Date.now()}`;
  let ownedEventId;
  try {
  await dialog.locator('input[placeholder="请输入日程标题"]').fill(title);
  await dialog.locator('textarea[placeholder="请输入备注信息"]').fill('日程备注持久化验收');
  const added=page.waitForResponse(r=>/\/FormEngine\/AddFormData(?:\?|$)/i.test(r.url())&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'创建',exact:true}).click();
  const addResult=await(await added).json();
  expect(Number(addResult.Code)).toBe(1);
  ownedEventId=addResult.Data?.Id || (typeof addResult.Data==='string' ? addResult.Data : undefined);
  if(!ownedEventId) ownedEventId=await page.evaluate(async title=>{
    const {DiyCommon:common}=await import('/src/utils/diy.common.js');
    const result=await common.FormEngine.GetTableData({FormEngineKey:'microi_calendar',_Where:[['Title','=',title]],_SelectFields:['Id'],_PageSize:2});
    if(result.Code!==1||result.Data?.length!==1) throw Error('Owned test event could not be identified');
    return result.Data[0].Id;
  },title);
  await expect(dialog).not.toBeVisible();
  await expect(calendar.locator('.event-title').filter({hasText:title}).first()).toBeVisible();
  await page.screenshot({path:path.join(output,'calendar-created.png')});
  await page.reload();
  await expect(calendar.locator('.event-title').filter({hasText:title}).first()).toBeVisible({timeout:60000});
  await calendar.locator('.event-title').filter({hasText:title}).first().click();
  const edit=page.getByRole('dialog',{name:'编辑日程',exact:true});
  await expect(edit.locator('textarea[placeholder="请输入备注信息"]')).toHaveValue('日程备注持久化验收');
  await page.screenshot({path:path.join(output,'calendar-edit.png')});
  await edit.locator('input[placeholder="请输入日程标题"]').fill(title+'-已编辑');
  const updated=page.waitForResponse(r=>/\/FormEngine\/UptFormData(?:\?|$)/i.test(r.url())&&r.request().method()==='POST');
  await edit.getByRole('button',{name:'保存',exact:true}).click();
  expect(Number((await(await updated).json()).Code)).toBe(1);
  await expect(calendar.locator('.event-title').filter({hasText:title+'-已编辑'}).first()).toBeVisible();
  await calendar.locator('.event-title').filter({hasText:title+'-已编辑'}).first().click();
  await edit.getByRole('button',{name:'删除',exact:true}).click();
  const deleted=page.waitForResponse(r=>/\/FormEngine\/DelFormData(?:\?|$)/i.test(r.url())&&r.request().method()==='POST');
  await page.locator('.el-message-box').getByRole('button',{name:/确定|确认/,exact:true}).click();
  expect(Number((await(await deleted).json()).Code)).toBe(1);
  ownedEventId=undefined;
  await expect(calendar.locator('.event-title').filter({hasText:title})).toHaveCount(0);
  await page.evaluate(async()=>{const p=await import('/src/pinia/index.js');p.useSettingsStore().tagsView=false;});
  await expect(page.locator('.tags-view-strip')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  const navY=(await page.locator('.navbar-microi').boundingBox()).y;
  await page.locator('.main-container-microi > .app-main-microi').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  expect((await page.locator('.navbar-microi').boundingBox()).y).toBe(navY);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.app-wrapper-microi')).not.toHaveClass(/desktop-shell/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:path.join(output,'mobile-scroll.png'),fullPage:true});
  expect(errors).toEqual([]);
  } finally {
    if(ownedEventId) {
      const result=await page.evaluate(async id=>{
        const {DiyCommon:common}=await import('/src/utils/diy.common.js');
        return common.FormEngine.DelFormData({FormEngineKey:'microi_calendar',Id:id});
      },ownedEventId);
      expect(Number(result.Code)).toBe(1);
    }
  }
});
