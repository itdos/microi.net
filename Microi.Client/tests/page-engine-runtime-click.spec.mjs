import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../src/views/page-engine/engine/components/form-designer/widget/common-widget.vue',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('const handleSetCurWidget ='),source.indexOf('//删除选中组件'));
function click(design, location={wrapper:0,widget:0}) {
  const actions=[];
  const event={preventDefault(){actions.push('prevent');},stopPropagation(){actions.push('stop');}};
  const ctx={isDesignMode:{value:design},thisWrapperIdx:{value:location.wrapper},thisWidgetIdx:{value:location.widget},tabLocation:{value:location.tab},props:{widgetObj:{id:'child'}},EventBus:{emit(...args){actions.push(args);}},pageEngineStore:{setCurWrapperIdx(i){actions.push(['wrapper',i]);},setCurWidgetIdx(i){actions.push(['widget',i]);},setCurWidgetDirect(w){actions.push(['direct',w.id]);}},event};
  vm.runInNewContext(handler+'\nhandleSetCurWidget(event)',ctx);
  return actions;
}
test('runtime links, buttons and keyboard-activated anchors retain their browser default action',()=>{
  assert.deepEqual(click(false),[]);
});
test('designer selection still suppresses navigation and selects its actual widget',()=>{
  assert.deepEqual(click(true),['prevent','stop',['activeName','first'],['wrapper',0],['widget',0]]);
});
test('designer tab children retain direct selection',()=>{
  assert.deepEqual(click(true,{wrapper:1,widget:-1,tab:{tabKey:'x'}}),['prevent','stop',['activeName','first'],['wrapper',1],['direct','child']]);
});
test('runtime missing designer indices do not mutate design state',()=>{
  assert.deepEqual(click(false,{wrapper:-1,widget:-1}),[]);
});
