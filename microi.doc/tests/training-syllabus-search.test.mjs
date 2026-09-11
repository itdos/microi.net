import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 assert.ok(start>=0&&end>start);const code=component.slice(start,end).replace('event: KeyboardEvent','event');
 const events=[];const action=name=>()=>events.push(name);
 const handler=new Function('activePanel','isInteractiveTarget','nextSlide','previousSlide','goTo','scrollActiveThumbnail','openPanel','downloadPdf','closePanel','slideMeta',code+';return handleKeydown;')({value:''},target=>target==='input',action('next'),action('previous'),action('go'),action('overview'),action('help'),action('pdf'),action('close'),[{},{}]);
 for(const event of [{key:'f',ctrlKey:true},{key:'f',metaKey:true},{key:'F11'},{key:'f'},{key:'ArrowDown',altKey:true},{key:'ArrowDown',isComposing:true},{key:'ArrowDown',target:'input'}])handler({...event,preventDefault:()=>events.push('prevented')});
 assert.deepEqual(events,[]);handler({key:'ArrowRight',preventDefault:()=>events.push('prevented')});assert.deepEqual(events,['prevented','next']);
});
test('搜索索引来自全部幻灯片正文，导航提供可反复收起和展开的控制',()=>{
 assert.match(component,/slideSearchContent\.value = slideMeta\.map[\s\S]*?textContent/);
 assert.match(component,/v-for="\{ slide, index \} in visibleSlides"/);
 assert.match(component,/:aria-expanded="!railCollapsed"/);assert.match(component,/@click="railCollapsed = !railCollapsed"/);
 assert.match(component,/v-show="!railCollapsed"/);assert.match(component,/aria-label="搜索标题与内容"/);
});
