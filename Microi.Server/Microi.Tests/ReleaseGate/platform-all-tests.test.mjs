import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {discoverBrowserTests,readLocalTestDefaults,allPlatformPreflight,validateBrowserReport,runAllBrowserTests,platformFrontendScope,frontendSpecialCases,browserCaseInventory,validatePlatformRuntimeReady} from './platform-all-tests.mjs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

test('live browser endpoint and login variables have actual lexical declarations',()=>{
 const root=path.resolve(import.meta.dirname,'../../..'),client=path.join(root,'Microi.Client');
 const require=createRequire(path.join(client,'package.json'));
 const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
 const missing=[];
 for(const file of discoverBrowserTests(path.join(client,'tests'))){
  const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'unambiguous'});
  traverse(ast,{ReferencedIdentifier(reference){
   const name=reference.node.name;
   if(['FRONTEND','BACKEND','API_BASE','OS_CLIENT','ACCOUNT','PASSWORD'].includes(name)&&!reference.scope.hasBinding(name))missing.push(`${path.basename(file)}:${reference.node.loc.start.line}:${name}`);
  }});
 }
 assert.deepEqual(missing,[],'URL interpolation must use real source declarations, not only variables injected by a test harness.');
});

test('general live browser navigation carries the selected API before bootstrap and legacy endpoint aliases reuse the same fixture',()=>{
 const root=path.resolve(import.meta.dirname,'../../..'),client=path.join(root,'Microi.Client');
 const parser=createRequire(path.join(client,'package.json'))('@babel/parser');
 const frontend='http://127.0.0.1:63970',backend='http://127.0.0.1:63971';
 const files=['ai-content-operations.e2e.spec.mjs','ai-platform-studio.e2e.spec.mjs','ai-workflow-v102.e2e.spec.mjs','mobile-ai-assistant.e2e.spec.mjs','user-access-key-dynamic-button.e2e.spec.mjs','file-sync-remote-connection.spec.mjs','form-engine-freeze-trace.spec.mjs','system-observability.e2e.spec.mjs','core-engine-renderers.e2e.spec.mjs'];
 for(const name of files){
  const source=fs.readFileSync(path.join(client,'tests',name),'utf8'),nodes=[];
  function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
  visit(parser.parse(source,{sourceType:'module'}).program);
  const urls=nodes.filter(node=>node.type==='TemplateLiteral').map(node=>source.slice(node.start,node.end)).filter(text=>text.includes('${FRONTEND}')&&(text.includes('OsClient=')||text.includes('new URLSearchParams')));
  if(files.indexOf(name)<7)assert.ok(urls.length>0,`${name}: live navigation not found`);
  for(const expression of urls){const value=runInNewContext(expression,{FRONTEND:frontend,API_BASE:backend,BACKEND:backend,OS_CLIENT:'fixture',route:'/probe',path:'/#/diy/design?PageType=',hash:'#/probe',URLSearchParams,separator:'&',token:'test-token',toHash:value=>value.slice(1)});const url=new URL(value);assert.equal(url.origin,frontend);assert.equal(url.searchParams.get('OsClient'),'fixture');assert.deepEqual(url.searchParams.getAll('ApiBase'),[backend],name);}
  for(const binding of ['FRONTEND','BACKEND','baseUrl']){
   const declaration=nodes.find(node=>node.type==='VariableDeclarator'&&node.id?.name===binding);
   if(!declaration||!source.slice(declaration.init.start,declaration.init.end).includes('process.env'))continue;
   const expression=source.slice(declaration.init.start,declaration.init.end);
   if(['file-sync-remote-connection.spec.mjs','form-engine-freeze-trace.spec.mjs','system-observability.e2e.spec.mjs','core-engine-renderers.e2e.spec.mjs'].includes(name)){
    const env={MICROI_TEST_FRONTEND_BASE:frontend,MICROI_TEST_API_BASE:backend};assert.equal(runInNewContext(expression,{process:{env}}),binding==='BACKEND'?backend:frontend,`${name}/${binding}`);
   }
  }
 }
});

test('general browser logins honor the existing fixture account and credential fallback without changing assertions',()=>{
 const root=path.resolve(import.meta.dirname,'../../..'),client=path.join(root,'Microi.Client');
 const parser=createRequire(path.join(client,'package.json'))('@babel/parser');
 const names=['form-ui-regression','latest-form-experience','menu-bottom-content','menu-child-expand-mode','module-theme-header','navigation-home-preferences','not-show-fields-corrupt-menu','page-tab-cross-module','platform-shell-regression','realtime-notification-chat','render-source-neutral','richtext-upload-policy','role-dept-tree-regression','role-permission-load-save','webos-comprehensive','webos-four-issues','workflow-engine-live','personal-settings'];
 for(const name of names){
  const source=fs.readFileSync(path.join(client,'tests',`${name}.e2e.spec.mjs`),'utf8');
  const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
  visit(parser.parse(source,{sourceType:'module'}).program);
  const candidates=nodes.flatMap(node=>node.type==='CallExpression'&&node.callee?.property?.name==='fill'?[node.arguments[0]]:node.type==='AssignmentPattern'&&node.left?.name==='account'?[node.right]:node.type==='VariableDeclarator'&&node.id?.name==='ACCOUNT'?[node.init]:[]).filter(Boolean);
  const expression=candidates.map(node=>source.slice(node.start,node.end)).find(text=>text.includes('process.env.PW_TEST_ACCOUNT'));
  assert.ok(expression,`${name}: login must consume the selected account`);
  const evaluate=env=>runInNewContext(expression,{process:{env}});
  assert.equal(evaluate({MICROI_TEST_ACCOUNT:'existing-fixture-user'}),'existing-fixture-user',name);
  assert.equal(evaluate({PW_TEST_ACCOUNT:'explicit-user',MICROI_TEST_ACCOUNT:'existing-fixture-user'}),'explicit-user',name);
  assert.equal(evaluate({}),'admin',`${name}: standalone compatibility`);
  if(name==='personal-settings')assert.equal(evaluate({PW_PERSONAL_SETTINGS_ACCOUNT:'specific-user',PW_TEST_ACCOUNT:'explicit-user'}),'specific-user');
  if(['personal-settings','menu-bottom-content'].includes(name)){
   const node=nodes.find(node=>node.type==='VariableDeclarator'&&node.id?.name==='PASSWORD');
   const password=env=>runInNewContext(source.slice(node.init.start,node.init.end),{process:{env}});
   assert.equal(password({MICROI_TEST_PASSWORD:'fixture-secret'}),'fixture-secret');
   assert.equal(password({PW_TEST_PASSWORD:'explicit-secret',MICROI_TEST_PASSWORD:'fixture-secret'}),'explicit-secret');
   const specific=name==='personal-settings'?'PW_PERSONAL_SETTINGS_PASSWORD':'PW_MENU_BOTTOM_PASSWORD';
   assert.equal(password({[specific]:'specific-secret',PW_TEST_PASSWORD:'explicit-secret'}),'specific-secret');
   assert.equal(password({}),'');
  }
 }
});

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'microi-all-platform-'));
 const api=path.join(root,'Microi.Server/Microi.net.Api'),tests=path.join(root,'Microi.Client/tests'),results=path.join(root,'results');
 for(const folder of [api,tests,results])fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(api,'.microi-local'),'LocalFixture');
 fs.writeFileSync(path.join(api,'appsettings.LocalFixture.json'),JSON.stringify({AppSettings:{OsClient:'fixture',OsClientDbConn:'private-test-secret'}}));
 fs.writeFileSync(path.join(tests,'first.spec.mjs'),"import {test} from '@playwright/test'; const password=process.env.PW_TEST_PASSWORD;");
 fs.writeFileSync(path.join(tests,'second.spec.mjs'),"import {test} from '@playwright/test'; const api=process.env.PW_SPECIAL_API_BASE || 'https://production.invalid';");
 fs.writeFileSync(path.join(tests,'unit.test.mjs'),"import test from 'node:test';");
 return {root,api,tests,results,cleanup:()=>fs.rmSync(root,{recursive:true})};
}
const regularEnvironment={MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_OSCLIENT:'fixture',MICROI_TEST_API_BASE:'http://127.0.0.1:61501',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:61500'};
const environment={MICROI_TEST_MATRIX_FILE:'existing-matrix.json',MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE:'YES',PW_TEST_PASSWORD:'fixture-password'};
function report(files){return {config:{rootDir:path.dirname(files[0])},stats:{expected:files.length,unexpected:0,skipped:0,flaky:0},errors:[],suites:files.map(file=>({file,specs:[{file,title:'general case',line:1,column:1,ok:true,tests:[{status:'expected',results:[{status:'passed'}]}]}]}))};}

test('content-operation business fixtures remain explicit while the real-login MiniMax parameter contract stays in regular and Full scopes',()=>{
 const f=fixture();try{
  const name='ai-content-operations.e2e.spec.mjs';
  fs.copyFileSync(new URL(`../../../Microi.Client/tests/${name}`,import.meta.url),path.join(f.tests,name));
  const regular=platformFrontendScope(f.tests);
  assert.ok(regular.files.some(file=>file.endsWith(name)));
  assert.deepEqual(regular.excluded.map(row=>[row.title,row.reason]),[['AI 内容运营菜单、定时入口与 MiniMax 受保护 API 在共享服务中可用','IndependentApplicationAcceptance']]);
  const all=allPlatformPreflight(f.root,environment);
  assert.equal(all.passed,true);assert.ok(all.files.some(row=>row.path.endsWith(name)));assert.deepEqual(all.excluded,[]);
 }finally{f.cleanup();}
});

test('installed governance application acceptance remains explicit without excluding platform governance contracts',()=>{
 const f=fixture();try{
 const name='ai-platform-studio.e2e.spec.mjs';
 fs.copyFileSync(new URL(`../../../Microi.Client/tests/${name}`,import.meta.url),path.join(f.tests,name));
 const regular=platformFrontendScope(f.tests),full=allPlatformPreflight(f.root,environment);
 assert.deepEqual(regular.excluded.map(row=>[row.title,row.reason]),[
  ['AI 平台治理中心 10 路由在 PC 与 390px 视口真实可见','IndependentApplicationAcceptance'],
  ['AI 平台治理新建门户使用统一大圆角居中可拖动弹层','IndependentApplicationAcceptance']
 ]);
 assert.equal(full.excluded.length,0);
 assert.ok(full.files.some(row=>row.path.endsWith(name)));
 assert.ok(!regular.files.some(file=>file.endsWith(name)));
 assert.equal(frontendSpecialCases['ai-platform-studio.e2e.spec.mjs'].wholeFile,undefined);
 fs.appendFileSync(path.join(f.tests,name),"\ntest('new general governance contract',()=>{});\n");
 const extended=platformFrontendScope(f.tests);
 assert.ok(extended.files.some(file=>file.endsWith(name)));
 assert.equal(extended.excluded.length,2);
 }finally{f.cleanup();}
});

test('real-model chat is explicit while contacts and non-paid SignalR persistence stay in the ordinary scope',()=>{
 const f=fixture();try{
  const name='realtime-notification-chat.e2e.spec.mjs';
  const source=fs.readFileSync(new URL(`../../../Microi.Client/tests/${name}`,import.meta.url),'utf8');
  fs.writeFileSync(path.join(f.tests,name),source);
  const regular=platformFrontendScope(f.tests);
  assert.ok(regular.files.some(file=>file.endsWith(name)));
  assert.deepEqual(regular.excluded.map(row=>[row.title,row.reason]),[['SignalR状态、AI与平台消息合并会话、AI闭环和后台任务事件驱动','RealPaidAI']]);
  for(const title of ['聊天联系人和历史对象始终显示 Name 或 Account','SignalR状态、系统消息持久化与后台任务事件驱动（无付费AI）']){
   assert.ok(source.includes(`test(${JSON.stringify(title)}`));assert.ok(!regular.excluded.some(row=>row.title===title));
  }
  assert.deepEqual(allPlatformPreflight(f.root,environment).excluded,[]);
 }finally{f.cleanup();}
});

test('independent Vision camera UI is classified separately from paid/customer cases and keeps explicit Full coverage',()=>{
 const f=fixture();try{
  const name='vision-engine.e2e.spec.mjs',title='真实 61500 页面：摄像头连续识别支持暂停、继续和强制再次识别';
  fs.copyFileSync(new URL(`../../../Microi.Client/tests/${name}`,import.meta.url),path.join(f.tests,name));
  const scope=platformFrontendScope(f.tests);
  assert.equal(scope.excluded.find(row=>row.title===title)?.reason,'IndependentApplicationAcceptance');
  assert.equal(scope.excluded.filter(row=>row.reason==='RealAIOrCustomerVisionAcceptance').length,3);
  assert.ok(!scope.files.some(file=>file.endsWith(name)));
  assert.deepEqual(allPlatformPreflight(f.root,environment).excluded,[]);
 }finally{f.cleanup();}
});

test('customer framework fixtures stay explicit while common platform source badges remain selected',()=>{
 const f=fixture();try{
  const name='framework-presentation.e2e.spec.mjs';
  const source=fs.readFileSync(new URL(`../../../Microi.Client/tests/${name}`,import.meta.url),'utf8');
  fs.writeFileSync(path.join(f.tests,name),source);
  const selection=platformFrontendScope(f.tests);
  assert.ok(selection.files.some(file=>file.endsWith(name)));
  assert.deepEqual(selection.excluded.map(row=>[row.title,row.reason]),[['real Junchi pages render permanent inspectable source badges and a non-blocking watermark','CustomerSpecificAcceptance']]);
  assert.ok(source.includes('test("platform pages render inspectable source badges and a non-blocking watermark"'));
  assert.deepEqual(allPlatformPreflight(f.root,environment).excluded,[]);
 }finally{f.cleanup();}
});

test('regular frontend scope keeps general cases in mixed files and explicitly classifies paid/customer cases without Full matrix or application maintenance',()=>{
 const f=fixture();try{
  for(const [name,rule]of Object.entries(frontendSpecialCases))fs.writeFileSync(path.join(f.tests,name),`import {test} from '@playwright/test';\n${(rule.titles||['customer-only case']).map(title=>`test(${JSON.stringify(title)},()=>{});`).join('\n')}\ntest('general case',()=>{});`);
  const selection=platformFrontendScope(f.tests);
  assert.equal(selection.files.length,Object.keys(frontendSpecialCases).length+2-Object.values(frontendSpecialCases).filter(rule=>rule.wholeFile).length);assert.equal(selection.discoveredFiles,Object.keys(frontendSpecialCases).length+2);
  assert.ok(selection.files.some(file=>file.endsWith('ai-image-studio.e2e.spec.mjs')));
  assert.ok(!selection.files.some(file=>file.endsWith('tenant-logo-isolation.e2e.spec.mjs')));
  assert.ok(selection.excluded.every(row=>row.status==='NotApplicable'&&row.reason));
  const plan=allPlatformPreflight(f.root,regularEnvironment,true);
  assert.equal(plan.passed,true);assert.equal(plan.scope,'PlatformFrontendTests');
  assert.equal(allPlatformPreflight(f.root,{},true).passed,false);
  fs.appendFileSync(path.join(f.tests,'ai-image-studio.e2e.spec.mjs'),'\n');
  const source=fs.readFileSync(path.join(f.tests,'ai-image-studio.e2e.spec.mjs'),'utf8');
  fs.writeFileSync(path.join(f.tests,'ai-image-studio.e2e.spec.mjs'),source.replace(frontendSpecialCases['ai-image-studio.e2e.spec.mjs'].titles[0],'renamed paid case'));
  assert.throws(()=>platformFrontendScope(f.tests),/classification drifted/);
 }finally{f.cleanup();}
});

test('regular frontend freezes all selected case identities and rejects omitted or wrongly included cases',()=>{
 const f=fixture();try{
  let calls=0;
  const files=discoverBrowserTests(f.tests),data=report(files);
  const proof=runAllBrowserTests(f.root,f.results,regularEnvironment,(exe,args,options)=>{
   assert.equal(options.cwd,path.join(f.root,'Microi.Client'));
   const generated=fs.readFileSync(args[args.indexOf('--config')+1],'utf8');
   const config=runInNewContext(generated.split('\n')[0]+';config;');
   assert.equal(config.use.locale,'zh-CN');
   assert.equal(config.use.actionTimeout,15000);
   assert.equal(config.use.navigationTimeout,30000);
   assert.equal(config.maxFailures,1);
   assert.equal(config.retries,0);
   assert.equal(args.includes('--list'),calls++===0);
   return {status:0,stdout:JSON.stringify(data)};
  },true);
  assert.equal(calls,2);assert.equal(proof.scope,'PlatformFrontendTests');assert.match(proof.listSha256,/^[a-f0-9]{64}$/);
  const inventory=browserCaseInventory(data),changed=structuredClone(data);changed.suites[0].specs[0].title='different case';
  assert.throws(()=>validateBrowserReport(changed,files,inventory),/selected case inventory/);
  assert.throws(()=>validateBrowserReport(data,files,inventory,[{file:path.basename(files[0]),title:'general case'}]),/non-applicable/);
 }finally{f.cleanup();}
});

test('owned browser runtime requires this exact candidate build and three healthy distinct processes',()=>{
 const build={workspace:'candidate',sourceHead:'a'.repeat(40),apiDllSha256:'b'.repeat(64)};
 const ready={schemaVersion:1,...build,buildSha256:createHash('sha256').update(JSON.stringify(build)).digest('hex'),health:{api:true,peerApi:true,frontend:true},processes:['api','peerApi','frontend'].map((kind,index)=>({kind,pid:index+1}))};
 assert.doesNotThrow(()=>validatePlatformRuntimeReady(build,ready));
 for(const mutate of [r=>{r.sourceHead='other'},r=>{r.apiDllSha256='old'},r=>{r.health.api=false},r=>{r.processes[0].pid=2}]){const invalid=structuredClone(ready);mutate(invalid);assert.throws(()=>validatePlatformRuntimeReady(build,invalid));}
});

test('all-platform discovery separates all Playwright files from Node tests and uses selected local defaults without leaking connections',()=>{
 const f=fixture();try{
  assert.equal(discoverBrowserTests(f.tests).length,2);
  const defaults=readLocalTestDefaults(f.api,{});
  assert.equal(defaults.PW_OS_CLIENT,'fixture');
  assert.equal(defaults.PW_APPSETTINGS_PATH,path.join(f.api,'appsettings.LocalFixture.json'));
  assert.ok(!JSON.stringify(defaults).includes('private-test-secret'));
  const plan=allPlatformPreflight(f.root,environment);
  assert.equal(plan.passed,true);assert.equal(plan.files.length,2);
  assert.equal(plan.environment.PW_SPECIAL_API_BASE,'http://127.0.0.1:61501');
  const trailing=allPlatformPreflight(f.root,{...environment,MICROI_TEST_API_BASE:'http://127.0.0.1:61501/',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:61500/',PW_SPECIAL_API_BASE:'http://127.0.0.1:61501/'});
  assert.equal(trailing.passed,true);assert.equal(trailing.environment.PW_BASE_URL,'http://127.0.0.1:61500');assert.equal(trailing.environment.PW_SPECIAL_API_BASE,'http://127.0.0.1:61501');
 }finally{f.cleanup();}
});

test('all-platform preflight lists missing authorization and matrix before running a test or provisioning anything',()=>{
 const f=fixture();try{
  const plan=allPlatformPreflight(f.root,{});
  assert.equal(plan.passed,false);
  for(const key of ['MICROI_TEST_MATRIX_FILE','MICROI_TEST_ALLOW_WRITES','MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE'])assert.ok(plan.missing.some(item=>item.includes(key)));
  assert.equal(allPlatformPreflight(f.root,{...environment,PW_SPECIAL_API_BASE:'https://unrelated.invalid'}).passed,false);
  let invoked=false;
  assert.throws(()=>runAllBrowserTests(f.root,f.results,{},()=>{invoked=true;}),/prerequisites missing/);
  assert.equal(invoked,false);assert.deepEqual(fs.readdirSync(f.results),[]);
 }finally{f.cleanup();}
});

test('browser completeness uses actual cases and rejects skipped, omitted, flaky and empty suites',()=>{
 const files=[path.resolve('first.spec.mjs'),path.resolve('second.spec.mjs')];
 assert.equal(validateBrowserReport(report(files),files).passed,2);
 assert.throws(()=>validateBrowserReport(report(files.slice(0,1)),files),/every discovered/);
 for(const field of ['unexpected','skipped','flaky']){const data=report(files);data.stats[field]=1;assert.throws(()=>validateBrowserReport(data,files),/failed, skipped/);}
 const fake=report(files);fake.suites[0].specs[0].tests[0].results[0].status='skipped';assert.throws(()=>validateBrowserReport(fake,files),/did not pass/);
 assert.throws(()=>validateBrowserReport({suites:[],stats:{expected:0}},files),/empty/);
});

test('browser runner executes the discovered files using existing services, preserves raw results and cleans its generated config',()=>{
 const f=fixture();try{
  let command;
  const proof=runAllBrowserTests(f.root,f.results,environment,(exe,args,options)=>{
   command={exe,args,options};
   assert.equal(options.cwd,path.join(f.root,'Microi.Client'));
   const config=fs.readFileSync(args[args.indexOf('--config')+1],'utf8');
   assert.ok(!config.includes('webServer'));assert.ok(config.includes('first.spec.mjs'));assert.ok(config.includes('second.spec.mjs'));assert.ok(!config.includes('unit.test.mjs'));
   assert.equal(options.env.PW_SPECIAL_API_BASE,'http://127.0.0.1:61501');
   return {status:0,stdout:JSON.stringify(report(discoverBrowserTests(f.tests)))};
  });
  assert.equal(proof.tests,2);assert.match(proof.reportSha256,/^[a-f0-9]{64}$/);
  assert.ok(command.args[0].endsWith('/cli.js')||command.args[0].endsWith('\\cli.js'));
  assert.equal(fs.existsSync(path.join(f.results,'all-platform-browser.config.mjs')),false);
 }finally{f.cleanup();}
});

test('complete maintenance tests restrict actual marketplace plans to the two existing dependencies, never chat',()=>{
 const server=new URL('../../',import.meta.url);
 const source=fs.readFileSync(new URL('Microi.Tests/FullStack/PlatformApplicationMaintenanceTests.cs',server),'utf8');
 const ids=JSON.parse(source.match(/ExistingDependencyIds\s*=\s*(\[[^;]+\]);/)[1]);
 assert.deepEqual(ids,['app.microi.store','app.microi.saas-engine']);
 assert.match(source,/\["RequiredAppIds"\] = DependencyIds\(\)/);
 assert.match(source,/\["MaintenanceScope"\] = "StartupDependencies"/);
 assert.equal((source.match(/await RequireExistingDependencies\(/g)||[]).length,3);
 const client=source.slice(source.indexOf('private static HttpClient Client('));
 assert.ok(client.indexOf('Required("MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE")')<client.indexOf('new HttpClient'));
 assert.match(source,/Assert\.Equal\(0, data\?\["Installed"\]/);
 assert.match(source,/if \(iteration == 1\) Assert\.Equal\(0, data\?\["Planned"\]/);
 const bulk=fs.readFileSync(new URL('OfficialApplications/Resource/bulk-import-packages.js',server),'utf8');
 const require=createRequire(new URL('../Microi.Client/package.json',server));
 const ast=require('@babel/parser').parse(bulk,{sourceType:'script',allowReturnOutsideFunction:true});
 const functions=ast.program.body.filter(item=>item.type==='FunctionDeclaration').map(item=>bulk.slice(item.start,item.end)).join('\n');
 const plan=new Function('ids','rows',`${functions}\nvar requiredAppIds=normalizeRequiredAppIds(ids);var requiredAppIdMap={};for(var id of requiredAppIds)requiredAppIdMap[id]=true;var bulkApplicationType='Platform';var startupDependencyRepairAppIdMap={};var result=[];appendPlanRows(result,rows);return {plan:result,resumed:normalizePlan(rows)};`)(ids,[
  {AppId:ids[0],ApplicationType:'Platform',StoreInstallStatus:'Installed'},
  {AppId:ids[1],ApplicationType:'Platform',StoreInstallStatus:'Outdated',InstallAction:'Update'},
  {AppId:'app.microi.message-notification',ApplicationType:'Platform',StoreInstallStatus:'Uninstalled'},
  {AppId:'app.microi.chat',ApplicationType:'Platform',StoreInstallStatus:'Uninstalled'}
 ]);
 assert.deepEqual(plan.plan.map(item=>[item.AppId,item.InstallAction]),[[ids[1],'Update']]);
 assert.deepEqual(plan.resumed.map(item=>item.AppId),ids);
});

test('missing local selection never falls back to building or running a test dependency container',()=>{
 const f=fixture();try{
  fs.unlinkSync(path.join(f.api,'.microi-local'));
  assert.throws(()=>readLocalTestDefaults(f.api,{}),/existing API .microi-local/);
  fs.writeFileSync(path.join(f.api,'.microi-local'),'../escape');
  assert.throws(()=>readLocalTestDefaults(f.api,{}),/Invalid local/);
 }finally{f.cleanup();}
});

test('all-platform discovers CommonJS and typed browser files without mistaking credential fallbacks for missing authorization',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.tests,'common.spec.cjs'),"const {test}=require('@playwright/test');");
  for(const extension of ['ts','mts','cts','tsx','jsx'])fs.writeFileSync(path.join(f.tests,`typed.spec.${extension}`),`import {test} from '@playwright/test'; ${extension==='jsx'?'const title=<div/>;':'const title: string="fixture";'} `);
  const directory=path.join(f.root,'Microi.Server/Microi.Tests/FullStack');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'ExistingFixtureTests.cs'),'var token = Required("MICROI_TEST_EXISTING_TOKEN");');
  assert.equal(discoverBrowserTests(f.tests).length,8);
  fs.writeFileSync(path.join(f.tests,'fallback.spec.mjs'),"import {test} from '@playwright/test';const pwd=process.env.PW_OPTIONAL_PASSWORD||process.env.PW_TEST_PASSWORD||'existing-session';");
  const {PW_TEST_PASSWORD,...existingSession}=environment;
  const plan=allPlatformPreflight(f.root,existingSession);
  assert.equal(plan.passed,true);
  assert.deepEqual(plan.missing,[]);
 }finally{f.cleanup();}
});
