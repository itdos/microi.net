import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {searchTrainingSlides} from '../docs/.vitepress/theme/training-syllabus-search.js';
const component=fs.readFileSync(new URL('../docs/.vitepress/theme/components/TrainingSyllabusDeck.vue',import.meta.url),'utf8');
test('搜索匹配标题、导航、实际正文，多个词同时匹配且不改变页码',()=>{
 const slides=[{title:'消息通知',nav:'消息'},{title:'接口引擎',nav:'接口'}],content=['重启后仅超级管理员看到版本介绍','参数化 SQL 查询'];
 assert.deepEqual(searchTrainingSlides(slides,content,'消息').map(x=>x.index),[0]);
 assert.deepEqual(searchTrainingSlides(slides,content,'重启 超级管理员').map(x=>x.index),[0]);
 assert.deepEqual(searchTrainingSlides(slides,content,'ＳＱＬ').map(x=>x.index),[1]);
 assert.equal(searchTrainingSlides(slides,content,'重启 SQL').length,0);
 assert.equal(searchTrainingSlides(slides,content,' ').length,2);
});
test('实际键盘处理器保留 Ctrl+F、Cmd+F、Alt、输入法和 F11 默认行为',()=>{
 const start=component.indexOf('function handleKeydown('),end=component.indexOf('function handleWheel(',start);
 assert.ok(start>=0&&end>start);const code=ts.transpileModule(component.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const events=[];const action=name=>()=>events.push(name);
 const activePanel={value:''},previewImage={value:null};
 const dependencies={activePanel,previewImage,deckRef:{value:null},document:{activeElement:null},closePreview:action('close-preview'),isInteractiveTarget:target=>target==='input',nextSlide:action('next'),previousSlide:action('previous'),goTo:(...args)=>events.push(['go',...args]),scrollActiveThumbnail:action('overview'),openPanel:action('help'),downloadPdf:action('pdf'),closePanel:action('close'),slideMeta:{value:Array.from({length:10},()=>({}))}};
 const handler=new Function(...Object.keys(dependencies),code+';return handleKeydown;')(...Object.values(dependencies));
 for(const event of [{key:'f',ctrlKey:true},{key:'f',metaKey:true},{key:'F11'},{key:'f'},{key:'p',ctrlKey:true},{key:'ArrowDown',altKey:true},{key:'ArrowDown',isComposing:true},{key:'ArrowDown',defaultPrevented:true},{key:'ArrowDown',target:'input'}])handler({...event,preventDefault:()=>events.push('prevented')});
 assert.deepEqual(events,[]);handler({key:'ArrowRight',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,['prevented','next']);
 events.length=0;
 for(const key of ['ArrowDown','PageDown',' ','ArrowLeft','ArrowUp','PageUp','Home','End','o','h','?','p'])handler({key,preventDefault:()=>events.push('prevented')});
 assert.deepEqual(events,['prevented','next','prevented','next','prevented','next','prevented','previous','prevented','previous','prevented','previous','prevented',['go',0,'prev'],'prevented',['go',9,'next'],'prevented','overview','prevented','help','prevented','help','prevented','pdf']);
 events.length=0;previewImage.value={src:'image',alt:'preview'};
 handler({key:'ArrowRight',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,[]);
 handler({key:'Escape',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,['prevented','close-preview']);
 events.length=0;previewImage.value=null;activePanel.value='help';
 handler({key:'ArrowRight',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,[]);
 handler({key:'Escape',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,['prevented','close']);
});
test('搜索索引来自全部幻灯片正文，导航提供可反复收起和展开的控制',()=>{
 assert.match(component,/slideSearchContent\.value = slideMeta\.value\.map[\s\S]*?textContent/);
 assert.match(component,/v-for="\{ slide, index \} in visibleSlides"/);
 assert.match(component,/:aria-expanded="!railCollapsed"/);assert.match(component,/@click="railCollapsed = !railCollapsed"/);
 assert.match(component,/v-show="!railCollapsed"/);assert.match(component,/aria-label="搜索标题与内容"/);
});
