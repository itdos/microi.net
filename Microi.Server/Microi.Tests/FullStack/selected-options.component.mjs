import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { selectModeCases, selectMatrixHtml, runSelectModeMatrix } from './select-mode-matrix.fixture.mjs';

// 真实 Vue/Element Plus/平台选择组件的浏览器夹具；只模拟选项 HTTP，不连接或写入客户库。
const root = path.resolve(import.meta.dirname, '../../..');
const client = path.join(root, 'Microi.Client');
const { createServer } = await import(pathToFileURL(path.join(client, 'node_modules/vite/dist/node/index.js')));
const { default: vue } = await import(pathToFileURL(path.join(client, 'node_modules/@vitejs/plugin-vue/dist/index.mjs')));
const { chromium } = await import(pathToFileURL(path.join(client, 'node_modules/playwright/index.mjs')));
const { parse } = await import(pathToFileURL(path.join(client, 'node_modules/@babel/parser/lib/index.js')));
const commonSource = await fs.readFile(path.join(client, 'src/utils/diy.common.js'), 'utf8');
const commonAst = parse(commonSource, { sourceType: 'module' });
const commonObject = commonAst.program.body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'DiyCommon')).declarations.find(d => d.id.name === 'DiyCommon').init;
const serializer = commonObject.properties.find(node => node.key.name === 'ForRowModelHandler');
const matrixCases = selectModeCases();
const matrixHtml = selectMatrixHtml(matrixCases, commonSource.slice(serializer.start, serializer.end));
let server, browser, requests = 0;
const scratch = await fs.mkdtemp(path.join(root, '.tmp/selected-options-component-'));
const cases = [];
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module">
import {createApp,reactive,ref,h} from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import Select from '/src/views/form-engine/diy-field-component/diy-select.vue';
import {createSelectedOptionHydrator,mergeResolvedOptions} from '/src/utils/selected-option-hydration.js';
import {getFormFieldDisplayValue} from '/src/views/form-engine/field-display-value.js';
const multiple=new URLSearchParams(location.search).get('multiple')==='true';
const field=reactive({Id:'owner',Name:'owner',Component:multiple?'MultipleSelect':'Select',Data:[{Id:'first',Name:'第一页姓名'}],Config:{DataSource:'Sql',Sql:'select Id,Name from users limit 20',SelectLabel:'Name',SelectSaveField:'Id',SelectSaveFormat:'Text',DataSourceSqlRemote:true}});
const form=reactive({owner:multiple?['first','outside']:'outside'}), changes=ref(0), control=ref();
const hydrate=createSelectedOptionHydrator({identity:()=> 'fixture/session',sqlUrl:'/__lookup',request:async(url,data)=> (await fetch(url,{method:'POST',body:JSON.stringify(data)})).json()});
const common={IsNull:v=>v===null||v===undefined||v==='',Result:r=>r?.Code===1,MergeResolvedFieldOptions:mergeResolvedOptions,RepalceUrlKey:v=>v,
 Post:(url,data,callback)=>callback({Code:1,Data:data._Keyword?[{Id:'search',Name:'搜索结果'}]:[{Id:'first',Name:'第一页姓名'}]}),SetFieldsData:()=>{},Tips:()=>{},ForRowModelHandler:()=>{},ConvertRowModel:v=>v};
const app=createApp({setup:()=>()=>h('main',{style:'padding:20px'},[
 h(Select,{ref:control,field,FormDiyTableModel:form,modelValue:form.owner,FormMode:'Edit',onModelChange:()=>changes.value++,'onUpdate:modelValue':()=>changes.value++}),
 h('p',{id:'detail'},getFormFieldDisplayValue(form,field)),
 h('table',[h('tbody',[h('tr',[h('td',{id:'table-label'},getFormFieldDisplayValue(form,field))])])])
])});
app.use(ElementPlus);app.config.globalProperties.DiyCommon=common;app.config.globalProperties.DiyApi={GetDiyFieldSqlData:'/candidate'};app.config.globalProperties.$t=k=>k;
app.mount('#app');
window.fixture={form,field,changes,resolve:()=>hydrate([field],form,{formData:form}),search:()=>control.value.SelectRemoteMethod('search',field),ready:true};
</script></body></html>`;
try {
  server = await createServer({ configFile: false, root: client, logLevel: 'error', resolve: { alias: { '@': path.join(client, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'element-plus', 'underscore', '@element-plus/icons-vue'] },
    cacheDir: path.join(scratch, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0, watch: null }, plugins: [vue(), {
      name: 'selected-options-fixture', configureServer(s) { s.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/__matrix')) { res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/__matrix', matrixHtml)); return; }
        if (req.url?.startsWith('/__fixture')) { res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/__fixture', html)); return; }
        if (req.url !== '/__lookup') return next();
        try {
          requests++; let body=''; for await (const part of req) body+=part;
          const payload=JSON.parse(body); assert.deepEqual(payload._SelectedValues.owner, ['outside']);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({Code:1,Data:[{FieldId:'owner',Result:{Code:1,Data:[{Id:'outside',Name:'首屏外真实姓名'}],DataAppend:{SelectedValuesResolved:true}}}]}));
        } catch (error) { res.statusCode=500; res.end(JSON.stringify({Code:0,Msg:error.message})); }
      }); }
    }] });
  await server.listen();
  browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const width of [1440, 390]) for (const multiple of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage(), errors=[];
      page.on('pageerror', e=>{errors.push(e.message); console.error('Fixture page error:', e.message);});
      await page.goto(`${base}/__fixture?multiple=${multiple}`);
      await page.waitForFunction(()=>window.fixture?.ready);
      const before = await page.evaluate(()=>JSON.stringify(window.fixture.form));
      await page.evaluate(()=>window.fixture.resolve());
      await page.waitForFunction(()=>document.querySelector('.el-select')?.textContent.includes('首屏外真实姓名'));
      assert.match(await page.locator('#detail').textContent(), /首屏外真实姓名/);
      assert.match(await page.locator('#table-label').textContent(), /首屏外真实姓名/);
      await page.evaluate(()=>window.fixture.search());
      await page.waitForFunction(()=>window.fixture.field.Data.some(o=>o.Id==='search'));
      assert.match(await page.locator('.el-select').textContent(), /首屏外真实姓名/);
      assert.equal(await page.evaluate(()=>JSON.stringify(window.fixture.form)), before);
      assert.equal(await page.evaluate(()=>window.fixture.changes.value), 0);
      assert.deepEqual(errors, []);
      cases.push({ width, multiple, passed: true });
    } finally { await context.close(); }
  }
  assert.equal(requests, 4, '每个新表单只有一次有界补查');
  const modeMatrix = await runSelectModeMatrix(browser, base, matrixCases);
  console.log(JSON.stringify({ passed: true, cases, modeMatrix, lookupRequests: requests, fixtureOnly: true, productionWrites: 0 }));
} finally {
  await browser?.close(); await server?.close();
  // 只回收 mkdtemp 创建的当前用例目录；不碰共享 Vite 缓存或其它浏览器。
  assert.equal(path.dirname(scratch), path.join(root, '.tmp'));
  assert.match(path.basename(scratch), /^selected-options-component-/);
  await fs.rm(scratch, { recursive: true });
}
