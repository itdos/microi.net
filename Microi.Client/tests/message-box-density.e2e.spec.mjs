import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compileString } from 'sass';
import { buildUiDensityVariables } from '../src/utils/ui-density.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const css = [await read('../node_modules/element-plus/dist/index.css'),
    compileString(await read('../src/styles/mci-design.scss')).css,
    compileString(await read('../src/styles/ui-density.scss')).css,
    compileString(await read('../src/styles/theme-shape.scss')).css].join('\n');
const bundle = await build({ stdin: { contents: `import {ElMessageBox} from 'element-plus';
window.openConfirm = () => { void ElMessageBox.confirm('确认退出登录？','提示',{customClass:'mci-unified-message-box',confirmButtonText:'确认',cancelButtonText:'取消'}).catch(()=>{}); };`,
    resolveDir:fileURLToPath(new URL('../',import.meta.url)) }, bundle:true,write:false,format:'iife',logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'} });

for (const width of [1440,3840]) test(`确认框各区随密度缩小，${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:width===3840?2160:900});
    await page.setContent(`<style>${css}</style>`);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const measure=async(scale)=>{
        await page.evaluate(vars=>{document.documentElement.dataset.mciUiDensity=String(vars.scale);document.documentElement.dataset.mciCornerStyle='square';Object.entries(vars.css).forEach(([k,v])=>document.documentElement.style.setProperty(k,v,'important'));},{scale,css:buildUiDensityVariables(scale)});
        return page.locator('.el-message-box').evaluate(async box=>{
            // Element 按钮含高度过渡；测量切换完成后的布局，而非过渡首帧。
            box.getBoundingClientRect();
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            await Promise.all(box.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));
            const rect=s=>box.querySelector(s).getBoundingClientRect();
            return {width:box.getBoundingClientRect().width,height:box.getBoundingClientRect().height,header:rect('.el-message-box__header').height,content:rect('.el-message-box__content').height,footer:rect('.el-message-box__btns').height,button:rect('.el-button').height,radius:getComputedStyle(box).borderRadius};
        });
    };
    await page.evaluate(()=>window.openConfirm());
    await expect(page.getByRole('button',{name:'确认',exact:true})).toBeVisible();
    await page.locator('.el-message-box').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
    const standard=await measure(100),compact=await measure(90),large=await measure(110);
    for(const region of ['width','height','header','content','footer','button']){expect(compact[region],region).toBeLessThan(standard[region]);expect(large[region],region).toBeGreaterThan(standard[region]);}
    expect(compact.button).toBeGreaterThanOrEqual(24);
    expect(compact.button).toBeLessThan(30);
    expect(compact.height).toBeLessThan(190);
    expect(compact.radius).toBe('0px');
    await measure(90);
    await testInfo.attach('geometry',{body:JSON.stringify({standard,compact,large}),contentType:'application/json'});
    await page.screenshot({path:testInfo.outputPath(`compact-confirm-${width}.png`)});
    await page.getByRole('button',{name:'取消',exact:true}).click();
    await expect(page.locator('.el-message-box')).toBeHidden();
});
