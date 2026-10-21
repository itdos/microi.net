import assert from 'node:assert/strict';

// 有效配置的笛卡尔积；普通数据/KV 没有远程搜索开关，动态源覆盖关闭/本地/远程。
export function selectModeCases() {
  const result = [];
  for (const source of ['Data', 'LegacyData', 'KeyValue', 'LegacyKeyValue', 'DataObject', 'Sql', 'DataSource', 'ApiEngine', 'Api']) {
    const dynamic = ['Sql', 'DataSource', 'ApiEngine', 'Api'].includes(source);
    const object = dynamic || source === 'DataObject';
    for (const multiple of [false, true])
      for (const mapping of object ? ['id-label', 'code-label', 'label-only', 'save-only', 'none', 'json', 'json-no-save'] : ['native'])
        for (const search of dynamic ? ['off', 'local', 'remote'] : ['off', 'local']) {
          const id = result.length;
          result.push({ id, source, dynamic, object, multiple, mapping, search, width: id % 2 ? 390 : 1440 });
        }
  }
  return result;
}

export function selectMatrixHtml(cases, serializeMethod) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module">
import {createApp,reactive,ref,h,nextTick} from 'vue';
import _ from 'underscore';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import Select from '/src/views/form-engine/diy-field-component/diy-select.vue';
import {createSelectedOptionHydrator,mergeResolvedOptions} from '/src/utils/selected-option-hydration.js';
import {getFormFieldDisplayValue} from '/src/views/form-engine/field-display-value.js';
const scenario=${JSON.stringify(cases)}[Number(new URLSearchParams(location.search).get('id'))];
const source=scenario.source.replace('Legacy','').replace('Object','');
const options=[{Id:'first',Code:'C1',Name:'Alpha',Extra:'keep-a'},{Id:'outside',Code:'C2',Name:'Beta',Extra:'keep-b'},{Id:'search',Code:'C3',Name:'Gamma',Extra:'keep-c'}];
let cfg={DataSource:source,SelectSaveField:'Id',SelectLabel:'Name',SelectSaveFormat:'Text',EnableSearch:scenario.search==='local',DataSourceSqlRemote:scenario.search==='remote',Sql:'select Id,Code,Name from options limit 1',Api:'/custom',DataSourceId:'source-key',DataSourceApiEngineKey:'engine-key',SelectedValueLookup:true};
if(scenario.mapping==='code-label') cfg.SelectSaveField='Code';
if(['label-only','none','json-no-save'].includes(scenario.mapping)) cfg.SelectSaveField='';
if(['save-only','none'].includes(scenario.mapping)) cfg.SelectLabel='';
if(['none','json','json-no-save'].includes(scenario.mapping)) cfg.SelectSaveFormat='Json';
if(scenario.source.includes('KeyValue')) Object.assign(cfg,{SelectSaveField:'Key',SelectLabel:'Value'});
if(['Data','LegacyData'].includes(scenario.source)) Object.assign(cfg,{SelectSaveField:'',SelectLabel:''});
if(scenario.source==='LegacyData') cfg.DataSource='';
const nativeOptions=scenario.object?options:scenario.source.includes('KeyValue')?options.map((o,i)=>scenario.source==='LegacyKeyValue'?{key:i,value:o.Name}:{Key:i,Value:o.Name}):options.map(o=>o.Name);
// 只有保存稳定键 + 显示字段的动态源需要补首屏外名称；其它组合验证既有选择/存储语义。
const lookup=scenario.dynamic&&['id-label','code-label'].includes(scenario.mapping);
const savedIndex=lookup?1:0;
function stored(i){const o=options[i];if(!scenario.object)return source==='KeyValue'?i:o.Name;return cfg.SelectSaveFormat==='Json'?{...o}:o[cfg.SelectSaveField||cfg.SelectLabel];}
const storedValue=scenario.multiple?[stored(savedIndex)]:stored(savedIndex);
const field=reactive({Id:'owner',Name:'Owner',Component:scenario.multiple?'MultipleSelect':'Select',Data:lookup?[nativeOptions[0],nativeOptions[2]]:nativeOptions.map(o=>typeof o==='object'?{...o}:o),Config:cfg});
const form=reactive({Owner:storedValue}), mode=ref('Edit'), readonly=ref(false), readonlyFields=ref([]), changes=ref(0), control=ref(), calls=[];
const label=o=>cfg.SelectLabel?o[cfg.SelectLabel]:(cfg.SelectSaveField?o[cfg.SelectSaveField]:o.Name);
const expectedLabel=scenario.object?String(label(options[savedIndex])):options[savedIndex].Name;
const targetLabel=scenario.object?String(label(options[2])):options[2].Name;
const hydrate=createSelectedOptionHydrator({identity:()=> 'matrix/session',sqlUrl:'/sql',engineUrl:key=>'/engine/'+key,dataSourceUrl:'/source',request:async(url,body)=>{
  calls.push({type:'lookup',url,body});
  const key=cfg.SelectSaveField||cfg.SelectLabel;
  const keys=source==='Sql'?body._SelectedValues.owner:body._SelectedValues;
  const data=options.filter(o=>keys.includes(String(o[key]))).map(o=>({[key]:o[key],[cfg.SelectLabel]:o[cfg.SelectLabel]}));
  const result={Code:1,Data:data,DataAppend:{SelectedValuesResolved:true}};
  return source==='Sql'?{Code:1,Data:[{FieldId:'owner',Result:result}]}:result;
}});
const DiyCommon={IsNull:v=>v===null||v===undefined||v==='',Result:r=>r?.Code===1,MergeResolvedFieldOptions:mergeResolvedOptions,RepalceUrlKey:v=>v,
  Post:(url,body,done)=>{calls.push({type:'candidate',url,body});if(body._Keyword==='__failure__'){done({Code:0,Msg:'fixture failure'});return;}done({Code:1,Data:body._Keyword?nativeOptions.filter(o=>String(scenario.object?label(o):o).includes(body._Keyword)):nativeOptions.slice(0,1)});},SetFieldsData:()=>{},Tips:()=>{},ConvertRowModel:v=>v,
  ${serializeMethod}
};
const app=createApp({setup:()=>()=>h('main',{style:'padding:20px'},[
  h(Select,{ref:control,field,FormDiyTableModel:form,modelValue:form.Owner,FormMode:mode.value,FieldReadonly:readonly.value,ReadonlyFields:readonlyFields.value,onModelChange:()=>changes.value++,'onUpdate:modelValue':()=>changes.value++}),
  h('p',{id:'detail'},getFormFieldDisplayValue(form,field))
])});
app.use(ElementPlus);Object.assign(app.config.globalProperties,{DiyCommon,DiyApi:{GetDiyFieldSqlData:'/sql-candidate',GetDataSourceEngine:'/source',GetApiEngineUrl:key=>'/engine/'+key},$t:k=>k});app.mount('#app');
window.fixture={scenario,field,form,mode,readonly,readonlyFields,changes,calls,control,expectedLabel,expectedDetail:options[savedIndex].Name,targetLabel,lookup,
  resolve:()=>hydrate([field],form,{formData:form}),
  serialize:()=>{const copy=JSON.parse(JSON.stringify(form));DiyCommon.ForRowModelHandler(copy,[field]);return copy.Owner;},
  ready:true};
</script></body></html>`;
}

export async function runSelectModeMatrix(browser, base, cases) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  try {
    for (const c of cases) {
      await page.setViewportSize({width:c.width,height:900});
      await page.goto(`${base}/__matrix?id=${c.id}`);
      await page.waitForFunction(()=>window.fixture?.ready);
      const initial=await page.evaluate(()=>({form:JSON.stringify(window.fixture.form), label:window.fixture.expectedLabel,detail:window.fixture.expectedDetail,target:window.fixture.targetLabel}));
      await page.evaluate(()=>window.fixture.resolve());
      await page.waitForFunction(()=>document.querySelector('.el-select')?.textContent.includes(window.fixture.expectedLabel));
      assert.match(await page.locator('#detail').textContent(),new RegExp(initial.detail));
      assert.equal(await page.evaluate(()=>JSON.stringify(window.fixture.form)),initial.form,`补查不得修改保存值: ${JSON.stringify(c)}`);
      assert.deepEqual(await page.evaluate(()=>window.fixture.serialize()),JSON.parse(initial.form).Owner,'未重新选择直接提交，不得丢失原字符串/数值/对象保存值');
      assert.equal(await page.evaluate(()=>window.fixture.changes.value),0);
      assert.equal(await page.evaluate(()=>window.fixture.calls.filter(x=>x.type==='lookup').length),c.dynamic&&['id-label','code-label'].includes(c.mapping)?1:0);
      // 三种只读入口都必须禁止操作，但保持名称显示。
      for(const mode of ['View','FieldReadonly','ReadonlyFields']){
        await page.evaluate(mode=>{const f=window.fixture;f.mode.value=mode==='View'?'View':'Edit';f.readonly.value=mode==='FieldReadonly';f.readonlyFields.value=mode==='ReadonlyFields'?['Owner']:[];},mode);
        await page.waitForFunction(()=>document.querySelector('.el-select__wrapper')?.classList.contains('is-disabled'));
        assert.match(await page.locator('.el-select').textContent(),new RegExp(initial.label));
      }
      await page.evaluate(()=>{const f=window.fixture;f.mode.value='Edit';f.readonly.value=false;f.readonlyFields.value=[];});
      await page.locator('.el-select__wrapper').click();
      if(c.search!=='off') await page.locator('.el-select__input').fill(initial.target);
      const target=page.locator('.el-select-dropdown__item:visible').filter({hasText:initial.target}).last();
      await target.click();
      if(c.multiple) await page.keyboard.press('Escape');
      await page.waitForFunction(()=>window.fixture.changes.value>0);
      const selected=await page.evaluate(()=>({value:window.fixture.serialize(),calls:window.fixture.calls,label:window.fixture.control.value.GetOptionLabel(window.fixture.control.value.SelectOptionList.at(-1))}));
      // 验证实际平台提交转换函数的结果，不能以 UI 看起来已选替代保存语义。
      let targetValue;
      if(!c.object) targetValue=c.source.includes('KeyValue')?2:'Gamma';
      else if(c.multiple&&['id-label','code-label','save-only'].includes(c.mapping)) targetValue=c.mapping==='code-label'?'C3':'search';
      else if(['none','json','json-no-save'].includes(c.mapping)||c.multiple) targetValue={Id:'search',Code:'C3',Name:'Gamma',Extra:'keep-c'};
      else targetValue=c.mapping==='code-label'?'C3':c.mapping==='label-only'?'Gamma':'search';
      if(c.multiple) assert.deepEqual(selected.value.at(-1),targetValue,`多选保存: ${JSON.stringify(c)}`);
      else assert.deepEqual(selected.value,targetValue,`单选保存: ${JSON.stringify(c)}`);
      if(c.search==='remote'){
        const last=selected.calls.filter(x=>x.type==='candidate').at(-1);
        assert.equal(last.body._Keyword,initial.target);
        assert.equal(last.url,c.source==='Sql'?'/sql-candidate':c.source==='DataSource'?'/source':c.source==='ApiEngine'?'/engine/engine-key':'/custom');
      }else assert.equal(selected.calls.filter(x=>x.type==='candidate').length,0,'本地搜索不请求服务器');
      if(c.search==='remote'&&c.mapping==='id-label'){
        const before=await page.evaluate(()=>JSON.stringify(window.fixture.form));
        for(const keyword of ['__failure__','__empty__']){
          await page.evaluate(keyword=>window.fixture.control.value.SelectRemoteMethod(keyword,window.fixture.field),keyword);
          await page.waitForFunction(()=>window.fixture.field.Config.DataSourceSqlRemoteLoading===false);
          assert.equal(await page.evaluate(()=>JSON.stringify(window.fixture.form)),before,'远程失败/空结果不能清空已选值');
          assert.match(await page.locator('.el-select').textContent(),new RegExp(initial.target));
        }
      }
      // 清空通过真实鼠标事件执行，必须确实可清空且不会写入 undefined。
      await page.locator('.el-select__wrapper').hover();
      await page.locator('.el-select__clear').click();
      await page.waitForFunction(()=>{const v=window.fixture.form.Owner;return v===''||(Array.isArray(v)&&v.length===0);});
      assert.deepEqual(await page.evaluate(()=>window.fixture.serialize()),c.multiple?[]:'','清空提交必须是明确空值');
      assert.deepEqual(errors,[]);
      if((c.id+1)%40===0) console.log(`选择控件浏览器组合已通过 ${c.id+1}/${cases.length}`);
    }
    return {cases:cases.length,passed:true,sources:9,productionWrites:0};
  }catch(error){console.error('选择控件失败场景',await page.evaluate(()=>({case:window.fixture?.scenario,value:window.fixture?.form.Owner,label:document.querySelector('.el-select')?.textContent,errors:window.fixture?.calls})));throw error;}
  finally{await context.close();}
}
