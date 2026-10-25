import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {compileString} from 'sass';

const read=relative=>readFile(new URL(relative,import.meta.url),'utf8');
const css=[await read('../node_modules/element-plus/dist/index.css'),
 ...await Promise.all(['itdos.diy.scss','diy-table.scss','mci-admin-theme.scss'].map(async name=>
  compileString(await read('../src/styles/'+name),{url:new URL('../src/styles/'+name,import.meta.url),logger:{warn(){},debug(){}}}).css))].join('\n');
const bundle=await build({stdin:{contents:`import {createApp,h} from 'vue';
import {ElButton} from 'element-plus';
import {getThemePalettes,setThemeColor,getContrastRatio} from './src/utils/theme-color.js';
createApp({render:()=>h('div',[h(ElButton,{id:'solid',type:'primary'},()=> '新增'),
h(ElButton,{id:'disabled',type:'primary',disabled:true},()=> '禁用'),
h(ElButton,{id:'plain',type:'primary',plain:true},()=> '朴素')])}).mount('#buttons');
window.themeProbe={getThemePalettes,setThemeColor,getContrastRatio};`,
 resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'iife',
 logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'}});

for(const mode of ['light','dark'])test(`实心主按钮与模块描述在12种${mode}主题中保持可读`,async({page})=>{
 await page.setContent(`<style>${css}</style><style>button{transition:none!important}</style>
 <main><div id="buttons"></div><div id="description-bg"><span class="module-presentation-description">管理周期任务与下次执行计划</span></div></main>`);
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const palettes=await page.evaluate(mode=>window.themeProbe.getThemePalettes(mode),mode);
 expect(palettes).toHaveLength(12);
 const button=page.locator('#solid');
 for(const palette of palettes){
  await page.evaluate(({mode,color})=>{window.themeProbe.setThemeColor(color,{mode});
   document.querySelector('#description-bg').style.background='var(--mci-presentation-header-bg)';
  },{mode,color:palette.value});
  const inspect=()=>button.evaluate(element=>{
   const style=getComputedStyle(element),text=getComputedStyle(element.querySelector('span'));
   const hex=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(Number);return '#'+channels.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('')};
   return {ratio:window.themeProbe.getContrastRatio(hex(text.color),hex(style.backgroundColor)),
    backgroundImage:style.backgroundImage,highlight:getComputedStyle(element,'::before').display};
  });
  for(const state of ['normal','hover','active']){
   if(state==='normal')await page.mouse.move(500,400);
   if(state==='hover')await button.hover();
   if(state==='active')await page.mouse.down();
   try{
    const value=await inspect();
    expect(value.ratio,`${mode}/${palette.key}/${state}`).toBeGreaterThanOrEqual(4.5);
    expect(value.backgroundImage).toBe('none');
    expect(value.highlight).toBe('none');
   }finally{if(state==='active')await page.mouse.up()}
  }
  const description=await page.locator('.module-presentation-description').evaluate(element=>{
   const root=getComputedStyle(document.documentElement),theme=window.themeProbe;
   const base=root.getPropertyValue('--mci-bg-card').trim(),primary=root.getPropertyValue('--el-color-primary').trim();
   const toRgb=value=>value.match(/[a-f\d]{2}/gi).map(channel=>parseInt(channel,16));
   const background=toRgb(base),tint=toRgb(primary),alpha=document.documentElement.dataset.theme==='dark'?.16:.10;
   const mixed='#'+background.map((value,index)=>Math.round(value*(1-alpha)+tint[index]*alpha).toString(16).padStart(2,'0')).join('');
   const foreground='#'+getComputedStyle(element).color.match(/[\d.]+/g).slice(0,3).map(value=>Number(value).toString(16).padStart(2,'0')).join('');
   return theme.getContrastRatio(foreground,mixed);
  });
  expect(description,`${mode}/${palette.key}/description`).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('#disabled')).toBeDisabled();
  await expect(page.locator('#disabled')).toHaveCSS('cursor','not-allowed');
  await expect(page.locator('#plain')).toHaveClass(/is-plain/);
  const solidBackground=await button.evaluate(element=>getComputedStyle(element).backgroundColor);
  expect(await page.locator('#plain').evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe(solidBackground);
  expect(await page.locator('#disabled').evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe(solidBackground);
 }
});
