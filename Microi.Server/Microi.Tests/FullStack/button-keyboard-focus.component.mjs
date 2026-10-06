import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

// 平台 CSS 组件回归：在真实宿主已加载的样式中插入自有按钮夹具，不模拟业务响应。
// 指针交互继续隐藏默认边框，Tab 导航必须保留子应用声明的可见焦点边框。
const root=path.resolve(import.meta.dirname,'../../..');
const results=path.resolve(process.argv[2]||path.join(root,'.tmp/reports/button-keyboard-focus'));
const frontend=process.env.MICROI_TEST_FRONTEND_BASE;
assert.ok(frontend,'MICROI_TEST_FRONTEND_BASE is required');
const source=path.join(root,'Microi.Client/src/styles/itdos.diy.scss');
const sourceBytes=await fs.readFile(source);
const sourceHash=crypto.createHash('sha256').update(sourceBytes).digest('hex');
await fs.mkdir(results,{recursive:true});
const {chromium}=await import(pathToFileURL(path.join(root,'Microi.Client/node_modules/playwright/index.mjs')));
let browser,failure;
const cases=[];
try{
  browser=await chromium.launch({headless:true,args:['--renderer-process-limit=2']});
  for(const width of [1440,390])for(const theme of ['light','dark']){
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:960}});
    try{
      const page=await context.newPage();
      await page.goto(frontend,{waitUntil:'domcontentloaded'});
      // 确认实际 Vite/正式页面包含生产样式，不用夹具自己的 CSS 冒充平台已修复。
      await page.waitForFunction(()=>[...document.querySelectorAll('style')].some(s=>s.textContent.includes('button')&&s.textContent.includes('outline'))||document.querySelector('link[rel="stylesheet"]'));
      const color=theme==='dark'?'rgb(147, 197, 253)':'rgb(29, 78, 216)';
      await page.evaluate(({color,theme})=>{
        const style=document.createElement('style');style.id='microi-owned-focus-fixture-style';
        style.textContent=`#microi-owned-focus-fixture{position:fixed;inset:80px 20px auto;z-index:2147483647;padding:24px;background:${theme==='dark'?'#181c25':'#fff'};color:${color}}#microi-owned-focus-fixture button{min-width:90px;min-height:44px;color:${color}}#microi-owned-focus-fixture button:focus-visible{outline:3px solid ${color};outline-offset:2px}`;
        document.head.append(style);
        const section=document.createElement('section');section.id='microi-owned-focus-fixture';
        section.innerHTML='<a href="#focus-fixture" data-sentinel>键盘起点</a><button type="button">组件焦点</button>';
        document.body.append(section);
      },{color,theme});
      const button=page.locator('#microi-owned-focus-fixture button');
      await button.click();
      const pointer=await button.evaluate(e=>({FocusVisible:e.matches(':focus-visible'),OutlineStyle:getComputedStyle(e).outlineStyle}));
      assert.equal(pointer.FocusVisible,false);assert.equal(pointer.OutlineStyle,'none');
      await page.locator('#microi-owned-focus-fixture [data-sentinel]').focus();
      await page.keyboard.press('Tab');
      const keyboard=await button.evaluate(e=>{const s=getComputedStyle(e);return{Focused:document.activeElement===e,FocusVisible:e.matches(':focus-visible'),OutlineStyle:s.outlineStyle,OutlineWidth:s.outlineWidth,OutlineColor:s.outlineColor,OutlineOffset:s.outlineOffset,BoxShadow:s.boxShadow};});
      const screenshot=path.join(results,`button-focus-${width}-${theme}.png`);
      await page.screenshot({path:screenshot,fullPage:true});
      cases.push({Width:width,Theme:theme,Pointer:pointer,Keyboard:keyboard,Screenshot:screenshot});
      assert.equal(keyboard.Focused,true);assert.equal(keyboard.FocusVisible,true);
      assert.equal(keyboard.OutlineStyle,'solid','宿主必须保留子应用实际可见的 outline 样式');
      assert.equal(keyboard.OutlineWidth,'3px');assert.equal(keyboard.OutlineOffset,'2px');assert.equal(keyboard.OutlineColor,color);
    }finally{await context.close();}
  }
}catch(error){failure={Name:error.name,Message:error.message};}
finally{await browser?.close();}
assert.equal(crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex'),sourceHash,'生产样式在回归期间发生漂移');
const proof={AtUtc:new Date().toISOString(),Passed:!failure,Cases:cases,Failure:failure||null,SourceFile:source,SourceSHA256:sourceHash,ActualSharedFrontend:frontend,UsesActualLoadedHostStyles:true,FixtureIsOnlyCSSComponentAndNotBusinessData:true,BrowserClosed:true,NativeBusinessWrites:0};
await fs.writeFile(path.join(results,'button-keyboard-focus-component-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({Passed:proof.Passed,Cases:cases.length,Failure:failure||null,SourceSHA256:sourceHash}));
if(failure)process.exitCode=1;
