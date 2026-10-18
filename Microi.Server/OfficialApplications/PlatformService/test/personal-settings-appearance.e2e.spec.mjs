import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildUiDensityVariables } from '../../../../Microi.Client/src/utils/ui-density.js';
// 内置应用的真实浏览器用例由 Playwright 运行；Node 发现器据导入识别测试类型。
const require = createRequire(new URL('../../../../Microi.Client/package.json',import.meta.url));
const { test, expect } = require('@playwright/test');
const appRoot=fileURLToPath(new URL('../',import.meta.url));
const compiled=await build({root:appRoot,configFile:false,logLevel:'error',plugins:[vue(),{
    name:'personal-settings-appearance-fixture',resolveId(id){if(id==='appearance-fixture')return '\0appearance-fixture';},
    load(id){if(id==='\0appearance-fixture')return `import {createApp} from 'vue';import Page from ${JSON.stringify(appRoot+'src/PersonalSettings.vue')};import Market from ${JSON.stringify(appRoot+'src/Marketplace.vue')};window.marketplaceComponent=Market;createApp(Page).mount('#app');`;}
}],build:{write:false,minify:false,cssCodeSplit:false,rollupOptions:{input:'appearance-fixture',output:{format:'iife',inlineDynamicImports:true}}}});
const css=compiled.output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n');
const js=compiled.output.find(x=>x.type==='chunk').code;

test('个人中心在商城同时载入时跟随宿主主题和密度，保留未保存表单',async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize({width:3840,height:2160});
    await page.route('https://appearance.invalid/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({Code:1,Data:/RefreshLoginUser|GetCurrentUser/.test(route.request().url())?{Id:'fixture',Name:'管理员',Account:'admin',DeptName:'研发部'}:{}})}));
    await page.route('https://appearance-ui.invalid/',route=>route.fulfill({contentType:'text/html',body:'<div id="app"></div>'}));
    await page.goto('https://appearance-ui.invalid/');
    await page.evaluate(()=>{
        window.hostData={apiBase:'https://appearance.invalid',osClient:'fixture',themeColor:'#b91c1c',themeMode:'light',themePrimaryText:'#991b1b',themeOnPrimary:'#fff',themeTokens:{},uiDensity:{scale:100,variables:{}}};
        window.listeners=[];window.microApp={getData:()=>window.hostData,addDataListener:fn=>window.listeners.push(fn),removeDataListener:fn=>window.listeners=window.listeners.filter(x=>x!==fn),dispatch:()=>{}};
    });
    await page.addStyleTag({content:css});await page.addScriptTag({content:js});
    expect(errors).toEqual([]);
    await expect(page.locator('.personal-hero-copy h1')).toHaveText('管理员');
    const name=page.locator('label').filter({hasText:'显示名称'}).locator('input');
    await name.fill('尚未保存的名称');
    const theme=async(scale,mode)=>{
        await page.evaluate(({scale,variables,mode})=>{
            window.hostData={...window.hostData,themeMode:mode,uiDensity:{scale,variables},themeTokens:{cornerStyle:'square',disableShadow:true,disableGradient:true}};
            window.listeners.forEach(fn=>fn(window.hostData));
        },{scale,variables:buildUiDensityVariables(scale),mode});
        await expect(page.locator('.settings-page')).toHaveAttribute('data-mci-ui-density',String(scale));
        await page.locator('.settings-page').evaluate(async el=>{await new Promise(requestAnimationFrame);await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
        return page.locator('.settings-page').evaluate(el=>{const box=s=>el.querySelector(s).getBoundingClientRect();const copy=el.querySelector('.personal-hero-copy'),h=copy.querySelector('h1');
            return {hero:box('.profile-hero').height,input:box('.form-grid input').height,button:box('.panel-actions button').height,background:getComputedStyle(el).backgroundColor,
                copyBackground:getComputedStyle(copy).backgroundColor,color:getComputedStyle(h).color,h1:box('.personal-hero-copy h1').toJSON(),p:box('.personal-hero-copy p').toJSON(),radius:getComputedStyle(el.querySelector('.profile-hero')).borderRadius};});
    };
    const standard=await theme(100,'light'),compact=await theme(90,'light'),large=await theme(110,'light');
    for(const part of ['hero','input','button']){expect(compact[part],part).toBeLessThan(standard[part]);expect(large[part],part).toBeGreaterThan(standard[part]);}
    expect(compact.copyBackground).toBe('rgba(0, 0, 0, 0)');expect(compact.color).toBe('rgb(255, 255, 255)');expect(compact.radius).toBe('0px');
    expect(compact.h1.top).toBeGreaterThanOrEqual(compact.p.bottom);
    const dark=await theme(90,'dark');expect(dark.background).not.toBe(compact.background);await expect(name).toHaveValue('尚未保存的名称');
    await info.attach('geometry',{body:JSON.stringify({standard,compact,large,dark}),contentType:'application/json'});
    await page.screenshot({path:info.outputPath('personal-settings-dark-compact-4k.png')});
    await page.setViewportSize({width:720,height:1000});await expect(page.locator('.personal-hero-copy h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
});
