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
