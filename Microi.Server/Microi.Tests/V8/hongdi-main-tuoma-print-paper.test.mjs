import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const file=process.env.MICROI_TEST_LABEL_TEMPLATE||path.join(root,'Microi-V8-Engine/宁波鸿地-开发环境 (api-dev.chongstech.com)/hongdi-dev.default.default/交付配置/鸿地主构件标签100x60-20260910/打印模板.json');
const raw=JSON.parse(fs.readFileSync(file,'utf8')),template=Array.isArray(raw)?raw[0]:raw;
const page=typeof template.PageObj==='string'?JSON.parse(template.PageObj):template.PageObj;
const panel=page.panels[0],elements=panel.printElements.map(e=>({...e.options,type:e.printElementType.type})),ptPerMm=72/25.4;
const field=name=>elements.find(e=>e.field===name||(!e.field&&e.title===name));

test('100 × 60 mm 标签纸使用相同物理页面，避免按 140 mm 页面缩印',()=>{
 assert.equal(page.panels.length,1);assert.equal(panel.width,100);assert.equal(panel.height,60);assert.equal(panel.paperType,'');
 assert.ok(Math.abs(panel.paperFooter-60*ptPerMm)<0.01);assert.equal(panel.paperNumberDisabled,true);
});
test('所有元素位于纸内并保留窄边距，不靠页面缩放隐藏越界',()=>{
 for(const e of elements){
  assert.ok(e.left>=1*ptPerMm&&e.top>=0,`${e.field||e.title}: origin`);
  assert.ok(e.left+e.width<=99*ptPerMm,`${e.field||e.title}: right overflow`);
  assert.ok(e.top+e.height<=59*ptPerMm,`${e.field||e.title}: bottom overflow`);
  assert.ok(e.width>0&&e.height>0);assert.equal(e.transform,undefined);assert.equal(e.zoom,undefined);
 }
});
test('二维码使用矢量绑定及至少 23 mm 的实物尺寸，并留出周围空白',()=>{
 const qr=field('qrcodeSvg_01');assert.equal(qr.type,'qrcode');assert.equal(qr.width,qr.height);
 assert.ok(qr.width/ptPerMm>=23);assert.ok(qr.left/ptPerMm>=2);
 for(const e of elements.filter(e=>e!==qr&&e.top<qr.top+qr.height&&e.top+e.height>qr.top)){
  assert.ok(e.left-(qr.left+qr.width)>=2*ptPerMm,`${e.field||e.title}: QR quiet zone`);
 }
});
test('标题和关键字段保持可读的物理字号',()=>{
 assert.ok(field('出厂合格证').fontSize>=16);assert.ok(field('gouJianHao').fontSize>=12);
 assert.ok(field('GB50205-2024').fontSize>=12);assert.ok(field('生产单位：').fontSize>=12);
 assert.ok(field('danTiMingCheng').height>=field('danTiMingCheng').lineHeight*2);
});
test('同一标签的文本及二维码矩形不互相覆盖',()=>{
 for(let i=0;i<elements.length;i++)for(let j=i+1;j<elements.length;j++){
  const a=elements[i],b=elements[j];
  const w=Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left);
  const h=Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top);
  assert.ok(w<=0.01||h<=0.01,`${a.field||a.title} overlaps ${b.field||b.title}`);
 }
});
test('整体内容上下居中，保留相近的顶部和底部留白',()=>{
 const top=Math.min(...elements.map(e=>e.top)),bottom=panel.height*ptPerMm-Math.max(...elements.map(e=>e.top+e.height));
 assert.ok(top>=ptPerMm&&bottom>=ptPerMm);assert.ok(Math.abs(top-bottom)/ptPerMm<.5,{top,bottom});
});
test('存量模板身份、字段绑定与租户运行时二维码契约不变',()=>{
 assert.equal(template.Id,'01KWDMSRHGGSZNHERS0VZP88C8');assert.equal(template.Number,'PAGE61');
 assert.deepEqual(elements.filter(e=>e.field).map(e=>e.field).sort(),['qrcodeSvg_01','gouJianHao','guiGe','changDu','anZhuangWeiZhi','gongChengMingCheng','danTiMingCheng'].sort());
 assert.ok(!elements.some(e=>e.type==='html'));assert.equal(template.DataApi,'');
});
test('长度格式兼容空值、数字和已有 L/mm 前后缀',()=>{
 const formatter=new Function(`return (${field('changDu').formatter})`)();
 assert.equal(formatter('L',null),'');assert.equal(formatter('L',9000),'L 9000 mm');
 assert.equal(formatter('L','L 9000 mm'),'L 9000 mm');assert.equal(formatter('L','L： 9000 mm'),'L 9000 mm');
});
