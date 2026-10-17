import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRenderer, nextTick } from 'vue';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
const source = readFileSync(new URL('../src/components/MciResizablePane/index.vue',import.meta.url),'utf8');
const { descriptor } = parse(source);
const compiled = compileScript(descriptor,{ id:'pane-regression',inlineTemplate:true }).content
    .replaceAll(/from ['"]vue['"]/g,`from ${JSON.stringify(import.meta.resolve('vue'))}`)
    .replace("'../../utils/panel-layout-preferences.js'",JSON.stringify(new URL('../src/utils/panel-layout-preferences.js',import.meta.url).href));
const Pane = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;
function mount(props={},gap=0) {
    const listeners = new Set(), emitted=[]; let disconnected=0;
    const oldWindow=globalThis.window, oldObserver=globalThis.ResizeObserver;
    globalThis.window={ innerWidth:1200,getComputedStyle:()=>({columnGap:gap+'px'}),addEventListener:(...args)=>listeners.add(args[1]),removeEventListener:(...args)=>listeners.delete(args[1]) };
    globalThis.ResizeObserver=class { observe() {} disconnect(){disconnected++;} };
    function node(tag) { return { tag,children:[],props:{},style:{},captures:new Set(),setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);} }; }
    const renderer=createRenderer({ createElement:node,createText:text=>({text}),createComment:text=>({comment:text}),setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,patchProp:(n,k,_o,v)=>n.props[k]=v,
        insert(n,parent){parent.children.push(n);n.parentElement=parent;},remove(n){ const p=n.parentElement;if(p)p.children=p.children.filter(x=>x!==n); },parentNode:n=>n.parentElement,nextSibling:()=>null });
    const root=node('root');root.clientWidth=1000;
    const app=renderer.createApp(Pane,{ width:240,...props,onCommit:value=>emitted.push(value) });app.config.globalProperties.$t=(_key,params)=>params.label;app.mount(root);
    function find(n,fn){if(fn(n))return n;for(const child of n.children||[]){const found=find(child,fn);if(found)return found;}}
    const handle=find(root,n=>n.props?.role==='separator');
    const event=extra=>({ button:0,pointerId:1,clientX:0,currentTarget:handle,preventDefault(){},...extra });
    return { root,handle,event,emitted,listeners,get disconnected(){return disconnected;},dispose(){app.unmount();globalThis.window=oldWindow;globalThis.ResizeObserver=oldObserver;} };
}
test('真实Vue组件只在pointerup提交，cancel恢复且卸载释放指针/观察器',async()=>{
    const f=mount();try { await nextTick();f.handle.props.onPointerdown(f.event({clientX:10}));f.handle.props.onPointermove(f.event({clientX:90}));await nextTick();assert.deepEqual(f.emitted,[]);
        f.handle.props.onPointerup(f.event({clientX:90}));assert.deepEqual(f.emitted,[320]);
        f.handle.props.onPointerdown(f.event({clientX:10}));f.handle.props.onPointermove(f.event({clientX:140}));f.handle.props.onPointercancel(f.event());assert.deepEqual(f.emitted,[320]);
        f.handle.props.onPointerdown(f.event());
    } finally { f.dispose(); }
    assert.equal(f.handle.captures.size,0);assert.equal(f.listeners.size,0);assert.equal(f.disconnected,1);
});
test('键盘调整受父容器和主内容最小宽度约束，Shift步长与Home可用',async()=>{
    const f=mount();try{await nextTick();for(const key of ['End','Home','ArrowRight'])f.handle.props.onKeydown(f.event({key,shiftKey:true}));assert.deepEqual(f.emitted,[520,160,280]);}finally{f.dispose();}
});
test('折叠不丢失展开宽度，handle具备可访问分隔条语义',async()=>{
    const f=mount({collapsed:true});try{await nextTick();assert.equal(f.handle,undefined);assert.equal(f.root.children[0].props.style.width,'32px');}finally{f.dispose();}
    const css=compileStyle({source:descriptor.styles[0].content,id:'data-v-pane-regression',scoped:true});assert.deepEqual(css.errors,[]);assert.match(css.code,/touch-action:none/);
});

test('父容器间距也预留在主区边界内，不把gap挤占到480px主区',async()=>{
    const f=mount({},12);try{await nextTick();f.handle.props.onKeydown(f.event({key:'End'}));assert.deepEqual(f.emitted,[508]);assert.equal(f.root.clientWidth-f.emitted[0]-12,480);}finally{f.dispose();}
});
