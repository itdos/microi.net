import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, defineStore } from '../node_modules/pinia/dist/pinia.mjs';
import { computed } from '../node_modules/vue/dist/vue.runtime.esm-bundler.js';

const storeSource=fs.readFileSync(new URL('../src/views/page-engine/engine/stores/pageEngine.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export const /g,'const ');
const context={createPinia,defineStore,getCurrentInstance:()=>null,inject:()=>null,localStorage:{getItem:()=>null},generateId:()=>'',deepClone:structuredClone};
vm.runInNewContext(storeSource+'\nglobalThis.make=createIsolatedPageEngineStore;globalThis.key=PAGE_ENGINE_STORE_KEY;',context);
const source=fs.readFileSync(process.env.MICROI_PAGE_RENDERER_SOURCE||new URL('../src/views/page-engine/renderer.vue',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('    setup() {'),source.indexOf('    data() {'));
function mount(){const provided=new Map(),ctx={computed,useDiyStore:()=>({GetCurrentUser:{Level:9999}}),createIsolatedPageEngineStore:context.make,PAGE_ENGINE_STORE_KEY:context.key,provide:(k,v)=>provided.set(k,v)};const options=vm.runInNewContext('({'+setup+'})',ctx);return {state:options.setup(),provided};}

test('cached route and active route do not overwrite each other when a previous response arrives late',()=>{
 const map=mount(),dashboard=mount();
 assert.ok(map.state.pageEngineStore,'route setup must own a runtime store');
 assert.notEqual(map.state.pageEngineStore,dashboard.state.pageEngineStore);
 map.state.pageEngineStore.updateFormData({Id:'map',JsonObj:{wrapperList:[{title:'功能地图'}],formConfig:{}}});
 dashboard.state.pageEngineStore.updateFormData({Id:'dashboard',JsonObj:{wrapperList:[{title:'经营看板'}],formConfig:{}}});
 assert.equal(map.state.pageEngineStore.formData.Id,'map');
 dashboard.state.pageEngineStore.updateFormData({Id:'late-dashboard',JsonObj:{wrapperList:[],formConfig:{}}});
 assert.equal(map.state.pageEngineStore.formData.Id,'map');
 assert.equal(map.provided.get(context.key),map.state.pageEngineStore);
});

test('route runtime layout and theme changes stay inside the provided rendering tree',()=>{
 const a=mount(),b=mount();
 a.state.pageEngineStore.updateFormData({Id:'a',JsonObj:{formConfig:{mobile:false},wrapperList:[]}});
 b.state.pageEngineStore.updateFormData({Id:'b',JsonObj:{formConfig:{mobile:false},wrapperList:[]}});
 a.state.pageEngineStore.formData.JsonObj.formConfig.mobile=true;
 a.state.pageEngineStore.dark=true;
 assert.equal(b.state.pageEngineStore.formData.JsonObj.formConfig.mobile,false);
 assert.equal(b.state.pageEngineStore.dark,false);
});
