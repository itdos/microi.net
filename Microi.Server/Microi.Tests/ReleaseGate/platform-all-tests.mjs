import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareBrowserFixtureConfig} from './prepare-browser-fixture.mjs';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
let parser;
function parseTest(source,file){
 // 矩阵模块也供局部 API 发布使用；只有实际盘点浏览器测试时才加载前端解析依赖。
 parser??=createRequire(path.join(workspace,'Microi.Client/package.json'))('@babel/parser');
 return parser.parse(source,{sourceType:'unambiguous',plugins:[...(/\.[cm]?tsx?$/.test(file)?['typescript']:[]),'jsx']});
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const check=(ok,message)=>{if(!ok)throw Error(message);};
// 测试 URL 会追加 /src 或 /api；统一去掉基址尾斜杠，避免 // 被 Vite 当作 SPA 路由。
const baseUrl=value=>String(value).replace(/\/+$/,'');

// 只盘点真实 Playwright 责任文件；Node 单元用例继续由原自动发现入口完整执行。
export function discoverBrowserTests(directory){
 const files=[];
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()){if(!/^(node_modules|bin|obj|\.git|test-results|playwright-report)$/.test(entry.name))files.push(...discoverBrowserTests(file));continue;}
  if(!/\.(test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name))continue;
  const ast=parseTest(fs.readFileSync(file,'utf8'),file);
  let browser=false;
  function visit(node){
   if(!node||typeof node!=='object')return;
   const name=node.type==='ImportDeclaration'?node.source?.value:
    node.type==='CallExpression'&&node.callee?.name==='require'?node.arguments?.[0]?.value:null;
   if(/^(?:@playwright\/test|playwright\/test)$/.test(name||''))browser=true;
   for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  }
  visit(ast.program);if(browser)files.push(file);
 }
 return files.sort();
}

export function readLocalTestDefaults(project,environment={}){
 const marker=path.join(project,'.microi-local');
 check(fs.existsSync(marker),'AllPlatformTests requires the existing API .microi-local marker; no test containers are created.');
 const name=fs.readFileSync(marker,'utf8').replace(/^\uFEFF/,'').trim();
 check(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name)&&!name.includes('..'),'Invalid local environment marker.');
 const selected=path.join(project,`appsettings.${name}.json`);
 check(fs.existsSync(selected),'The configuration selected by .microi-local is missing.');
 const base=fs.existsSync(path.join(project,'appsettings.json'))?json(path.join(project,'appsettings.json')):{};
 const settings={...base.AppSettings,...json(selected).AppSettings};
 check(typeof settings.OsClient==='string'&&settings.OsClient.length>0,'The selected local configuration has no OsClient.');
 // 连接串和密码不复制到报告；测试仅获取已有配置文件路径，写权限仍由独立前置校验决定。
 return {PW_APPSETTINGS_PATH:selected,ASPNETCORE_ENVIRONMENT:name,
  PW_API_BASE:baseUrl(environment.MICROI_TEST_API_BASE||'http://127.0.0.1:61501'),
  PW_BASE_URL:baseUrl(environment.MICROI_TEST_FRONTEND_BASE||'http://127.0.0.1:61500'),
  PW_OS_CLIENT:environment.MICROI_TEST_OSCLIENT||settings.OsClient,
  MICROI_OSCLIENT:environment.MICROI_TEST_OSCLIENT||settings.OsClient};
}

// 普通发行只排除有明确专项前提的案例；同一文件的通用 UI 案例仍自动发现并执行。
// 修改/新增专项必须维护此清单，不能通过 Playwright skip 把未执行案例算作通过。
export const frontendSpecialCases={
 'realtime-notification-chat.e2e.spec.mjs':{reason:'RealPaidAI',prerequisite:'The original complete conversation acceptance sends a real model prompt; ordinary SignalR, system-message persistence and background-task assertions remain separate general cases',titles:['SignalR状态、AI与平台消息合并会话、AI闭环和后台任务事件驱动']},
 'ai-content-operations.e2e.spec.mjs':{reason:'IndependentApplicationAcceptance',prerequisite:'The official tenant internal AI content operations application has its own build/test entry; its README owns /mci-ai-content-plan, /mci-ai-content-asset and the fixed seed as an independent application, not a public platform application',titles:['AI 内容运营菜单、定时入口与 MiniMax 受保护 API 在共享服务中可用']},
 'ai-platform-studio.e2e.spec.mjs':{reason:'IndependentApplicationAcceptance',prerequisite:'Independently installed ai-platform-studio marketplace application: its README owns a separate Manifest with 40 tables, 64 engines, 10 microservice routes, tests and npm build; platform AI governance SDK and protocol tests remain in scope',titles:['AI 平台治理中心 10 路由在 PC 与 390px 视口真实可见','AI 平台治理新建门户使用统一大圆角居中可拖动弹层']},
 'three-engine-microservice.e2e.spec.mjs':{reason:'IndependentApplicationAcceptance',prerequisite:'Independently published microi-3d-engine application; README test ownership keeps its release separate',wholeFile:true},
 'ai-image-studio.e2e.spec.mjs':{reason:'RealPaidAI',titles:['MiniMax 文生图和私有参考图图生图均返回持久 HDFS 资产','音乐工作台通过托管接口或官方开源 Music3 回退返回持久 HDFS 音轨']},
 'form-ui-regression.e2e.spec.mjs':{reason:'CustomerJunchi',titles:['君驰项目表单：必填内联提示、数字步进无断层、紧凑分组随主题','君驰托码表单：折叠分组保留装饰短线、无外框且字段间隙为纯白','君驰设计器：双击折叠分组保留图标与视觉风格专项配置']},
 'latest-form-experience.e2e.spec.mjs':{reason:'CustomerXjy',titles:['xjy 订单使用标准表单 Banner、只读业务值和单一纵向滚动容器']},
 'framework-presentation.e2e.spec.mjs':{reason:'CustomerSpecificAcceptance',prerequisite:'The original Junchi acceptance requires its customer extension fields and chemical-bid-management microservice; generic platform source badges and watermark remain a separate ordinary case',titles:['real Junchi pages render permanent inspectable source badges and a non-blocking watermark']},
 'role-dept-tree-regression.e2e.spec.mjs':{reason:'CustomerOrPreconfiguredAccountAcceptance',prerequisite:'JUNCHI customer data or a manually prepared anderson account with level-500 role and a fixed model ID',titles:['君驰左右树表只发 _Where，空树显示全部且单击树节点不重复初始化','500 级接口引擎专员可见菜单但服务端拒绝 sys_apiengine 控制面模型']},
 'menu-child-expand-mode.e2e.spec.mjs':{reason:'OfficialApplicationVersionAcceptance',prerequisite:'Explicit PW_EXPECT_SYS_CONFIG_STORE_VERSION for an independently published official application',titles:['官方商城回读系统设置应用版本']},
 'platform-shell-regression.e2e.spec.mjs':{reason:'OfficialTenantSpecificAcceptance',prerequisite:'Official main-tenant identity, not a general isolated fixture tenant',titles:['通知中心：吾码官方主租户不检查或展示应用安装提醒']},
 'vision-engine.e2e.spec.mjs':{reason:'RealAIOrCustomerVisionAcceptance',titleMetadata:{'真实 61500 页面：摄像头连续识别支持暂停、继续和强制再次识别':{reason:'IndependentApplicationAcceptance',prerequisite:'The separately versioned microi-vision MicroService owns this camera workbench and its package test/build entry; platform Microi.Vision and V8.Vision unit/protocol tests remain in scope'}},titles:['真实 61501 链路：样本库优先、AI 异步回退及人脸同意门禁','真实 61500 页面：视觉引擎工作台跟随平台主题、可识别且人脸同意前禁用提交','真实目标租户 v1.4.13：PC 全宽、移动横竖屏、历史画面与纠错入口完整可用','真实 61500 页面：摄像头连续识别支持暂停、继续和强制再次识别']},
 'system-settings-microservice-production.e2e.spec.mjs':{reason:'CustomerJunchiProduction',wholeFile:true},
 'tenant-logo-isolation.e2e.spec.mjs':{reason:'CustomerLsgProduction',wholeFile:true}
};
function declaredTitles(file){
 const titles=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee?.name==='test'&&typeof node.arguments?.[0]?.value==='string')titles.push(node.arguments[0].value);
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
 }
 visit(parseTest(fs.readFileSync(file,'utf8'),file).program);return titles;
}
export function platformFrontendScope(directory){
 const discovered=discoverBrowserTests(directory),files=[],excluded=[];
 for(const file of discovered){
  const rule=frontendSpecialCases[path.basename(file)],titles=rule?declaredTitles(file):[];
  if(rule){
   for(const title of rule.titles||[])check(titles.includes(title),`Frontend special-case classification drifted: ${path.basename(file)} / ${title}`);
   excluded.push(...(rule.wholeFile?titles:rule.titles).map(title=>({file:path.relative(directory,file).replaceAll('\\','/'),title,reason:rule.reason,...(rule.prerequisite?{prerequisite:rule.prerequisite}:{}),...rule.titleMetadata?.[title],status:'NotApplicable'})));
  }
  // 精确分类覆盖当前文件全部案例时不要求执行零案例文件；新增通用案例会自动重新纳入。
  if(!rule?.wholeFile&&(!rule?.titles||titles.some(title=>!rule.titles.includes(title))))files.push(file);
 }
 return {files,excluded,discoveredFiles:discovered.length};
}
export function allPlatformPreflight(workspaceRoot,environment={},frontendOnly=false){
 const defaults=readLocalTestDefaults(path.join(workspaceRoot,'Microi.Server/Microi.net.Api'),environment);
 const directory=path.join(workspaceRoot,'Microi.Client/tests'),selection=frontendOnly?platformFrontendScope(directory):{files:discoverBrowserTests(directory),excluded:[]},files=selection.files,missing=[];
 check(files.length>0,'AllPlatformTests discovered no frontend browser test files.');
 if(!frontendOnly&&!environment.MICROI_TEST_MATRIX_FILE)missing.push('Existing FullStack dependency matrix: MICROI_TEST_MATRIX_FILE');
 if(environment.MICROI_TEST_ALLOW_WRITES!=='YES')missing.push('Existing isolated fixture write authorization: MICROI_TEST_ALLOW_WRITES=YES');
 if(frontendOnly){
  if(!environment.MICROI_TEST_OSCLIENT)missing.push('Existing authorized test tenant: MICROI_TEST_OSCLIENT (the project bootstrap tenant is not write authorization).');
  for(const name of ['MICROI_TEST_API_BASE','MICROI_TEST_FRONTEND_BASE']){
   let local=false;try{const url=new URL(environment[name]);local=['http:','https:'].includes(url.protocol)&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password;}catch{}
   if(!local)missing.push(`${name} must identify an existing local fixture service.`);
  }
 }
 // 全部 C# 用例含真实平台应用维护。普通启动配置不能自动授权安装或升级租户应用。
 if(!frontendOnly&&environment.MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE!=='YES')missing.push('FullStack/PlatformApplicationMaintenanceTests.cs: existing isolated fixture application maintenance authorization is absent (MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE=YES).');
 const bindings={...defaults};
 for(const file of files){
  const source=fs.readFileSync(file,'utf8'),relative=path.relative(workspaceRoot,file).replaceAll('\\','/');
  for(const match of source.matchAll(/process\.env\.((?:PW|MICROI)_[A-Z0-9_]+)/g)){
   const name=match[1];
   // 环境变量出现不等于必填：用例可能回退到其它凭据或已有登录态。
   // 凭据充分性由原测试契约和零跳过结果判断，不用源码名称扫描制造授权缺口。
   // 历史专项有客户生产默认地址；统一重绑定到已选本地 fixture，不沿用硬编码默认目标。
   let expected;
   if(name==='PW_API_BASE'||/^PW_.*_API_BASE$/.test(name))expected=defaults.PW_API_BASE;
   else if(name==='PW_BASE_URL'||/^PW_.*_(?:WEB_BASE|BASE_URL)$/.test(name))expected=defaults.PW_BASE_URL;
   else if(name==='PW_OS_CLIENT'||/^PW_.*_OSCLIENT$/.test(name))expected=defaults.PW_OS_CLIENT;
   if(expected){const actual=/^https?:\/\//.test(expected)?baseUrl(environment[name]||''):environment[name];if(actual&&actual!==expected)missing.push(`${relative}: ${name} does not match the existing local fixture`);bindings[name]=expected;}
  }
 }
 return {schemaVersion:1,scope:frontendOnly?'PlatformFrontendTests':'AllPlatformTests',passed:missing.length===0,missing:[...new Set(missing)],excluded:selection.excluded,
  files:files.map(file=>({path:path.relative(workspaceRoot,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))})),
  environment:bindings};
}

export function browserCaseInventory(report){
 const cases=[];
 function walk(suite){
  for(const spec of suite.specs||[])for(const test of spec.tests||[])cases.push({file:spec.file||suite.file,title:spec.title,line:spec.line,column:spec.column,projectName:test.projectName||''});
  for(const child of suite.suites||[])walk(child);
 }
 (report.suites||[]).forEach(walk);return cases.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function validateBrowserReport(report,expectedFiles,inventory,excluded=[]){
 const suites=report?.suites,stats=report?.stats;
 check(Array.isArray(suites)&&stats&&Number.isInteger(stats.expected)&&stats.expected>0,'Browser report is empty or malformed.');
 check(stats.unexpected===0&&stats.skipped===0&&stats.flaky===0&&!(report.errors||[]).length,'Browser tests failed, skipped, flaky or did not load.');
 const seen=new Set();let count=0;
 function walk(suite){
  for(const spec of suite.specs||[]){
   seen.add(path.resolve(report.config?.rootDir||path.dirname(expectedFiles[0]),spec.file||suite.file));
   check(spec.ok===true&&Array.isArray(spec.tests)&&spec.tests.length>0,'Browser spec did not execute successfully.');
   for(const test of spec.tests){check(test.status==='expected'&&test.results?.length===1&&test.results[0].status==='passed','Browser test did not pass on its actual execution.');count++;}
  }
  for(const child of suite.suites||[])walk(child);
 }
 suites.forEach(walk);
 check(count===stats.expected,'Browser JSON counts do not match actual results.');
 check(expectedFiles.length>0&&expectedFiles.every(file=>seen.has(path.resolve(file)))&&seen.size===expectedFiles.length,'Browser report did not execute every discovered frontend file.');
 const actual=browserCaseInventory(report);
 if(inventory)check(inventory.length>0&&JSON.stringify(actual)===JSON.stringify(inventory),'Browser executed cases differ from the complete selected case inventory.');
 check(!actual.some(row=>excluded.some(other=>row.title===other.title&&row.file.replaceAll('\\','/').endsWith(other.file))),'A non-applicable special case executed in the regular frontend scope.');
 return {tests:count,passed:count,failed:0,skipped:0,files:expectedFiles.length};
}

export function runAllBrowserTests(workspaceRoot,results,environment=process.env,run=spawnSync,frontendOnly=false){
 const plan=allPlatformPreflight(workspaceRoot,environment,frontendOnly);
 check(plan.passed,'AllPlatformTests prerequisites missing:\n'+plan.missing.join('\n'));
 const client=path.join(workspaceRoot,'Microi.Client'),directory=path.join(client,'tests');
 const files=plan.files.map(row=>path.join(workspaceRoot,row.path));
 const prefix=frontendOnly?'platform-frontend-browser':'all-platform-browser';
 const config=path.join(results,`${prefix}.config.mjs`),output=path.join(results,`${prefix}-results`);
 const reportFile=path.join(results,`${prefix}.json`),listFile=path.join(results,`${prefix}-list.json`);
 check(!fs.existsSync(config)&&!fs.existsSync(reportFile),'AllPlatformTests requires fresh browser output.');
 // 不调用 webServer / docker / 安装器；复用现有 frontend/API 和配置对应的依赖。
 const escaped=plan.excluded.map(row=>row.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 fs.writeFileSync(config,`const config=${JSON.stringify({testDir:directory,testMatch:files.map(file=>path.relative(directory,file).replaceAll('\\','/')),workers:1,fullyParallel:false,maxFailures:1,timeout:90000,retries:0,outputDir:output,use:{headless:true,locale:'zh-CN',...(frontendOnly?{actionTimeout:15000,navigationTimeout:30000}:{}),trace:'retain-on-failure',...(environment.PW_BROWSER_CHANNEL?{channel:environment.PW_BROWSER_CHANNEL}:{})}})};\n${escaped.length?`config.grepInvert=new RegExp(${JSON.stringify(`(?:${escaped.join('|')})$`)});\n`:''}export default config;\n`,{flag:'wx'});
 try{
  const args=[path.join(client,'node_modules/@playwright/test/cli.js'),'test','--config',config,'--reporter=json'];
  const options={cwd:client,env:{...environment,...plan.environment},encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024};
  let inventory;
  if(frontendOnly){
   const list=run(process.execPath,[...args,'--list'],options);
   check(!list.error&&list.status===0,'Frontend case discovery failed before execution.');
   fs.writeFileSync(listFile,list.stdout||'',{flag:'wx'});
   const report=json(listFile);check(!(report.errors||[]).length,'Frontend case discovery has load errors.');inventory=browserCaseInventory(report);
   check(inventory.length>0,'Frontend case discovery selected no general cases.');
  }
  const result=run(process.execPath,args,options);
  if(result.error)throw Error('Frontend browser runner could not execute.');
  fs.writeFileSync(reportFile,result.stdout||'',{flag:'wx'});
  check(result.status===0,'Frontend browser runner failed; inspect the private result file.');
  return {...validateBrowserReport(json(reportFile),files,inventory,plan.excluded),scope:plan.scope,excluded:plan.excluded,reportFile,reportSha256:sha(fs.readFileSync(reportFile)),...(frontendOnly?{listFile,listSha256:sha(fs.readFileSync(listFile))}:{})};
 }finally{fs.unlinkSync(config);}
}

// 可选的已登记原生 supervisor 握手：只宣布本轮编译结果，不创建依赖、租户或安装应用。
// supervisor 负责从这些精确字节启动已有 fixture；测试结束先释放 API 文件锁，再清理 SDK 输出。
export function validatePlatformRuntimeReady(build,ready){
 check(ready?.schemaVersion===1&&ready.sourceHead===build.sourceHead&&ready.workspace===build.workspace&&ready.buildSha256===sha(JSON.stringify(build)),'Platform browser runtime belongs to another candidate/build.');
 check(ready.apiDllSha256===build.apiDllSha256&&ready.health?.api===true&&ready.health?.peerApi===true&&ready.health?.frontend===true,'Platform browser runtime is not healthy on the tested API bytes.');
 check(Array.isArray(ready.processes)&&ready.processes.length===3&&new Set(ready.processes.map(row=>row.pid)).size===3,'Platform browser runtime needs distinct owned API and frontend processes.');
 for(const kind of ['api','peerApi','frontend'])check(ready.processes.filter(row=>row.kind===kind&&Number.isSafeInteger(row.pid)&&row.pid>0).length===1,'Platform browser runtime process identity is missing.');
}
async function platformRuntime(mode,results,artifacts,control){
 check(path.isAbsolute(control),'Platform runtime control must be an absolute task-owned directory.');
 const buildFile=path.join(control,'build.json'),readyFile=path.join(control,'ready.json');
 const wait=async name=>{const deadline=Date.now()+180000;while(!fs.existsSync(path.join(control,name))){check(!fs.existsSync(path.join(control,'failed.json')),'Owned platform runtime failed; inspect its private logs.');check(Date.now()<deadline,'Owned platform runtime readiness deadline exceeded.');await delay(250);}return json(path.join(control,name));};
 if(mode==='runtime-prepare'){
  const runtimeDirectory=path.join(artifacts,'bin','Microi.net.Api','release'),api=path.join(runtimeDirectory,'Microi.net.Api.dll');
  check(fs.existsSync(api),'This exact platform build has no API runtime.');
  const build={schemaVersion:1,workspace,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:workspace,encoding:'utf8',windowsHide:true}).trim(),runtimeDirectory,resultsDirectory:results,apiDllSha256:sha(fs.readFileSync(api)),builtAt:new Date().toISOString()};
  fs.writeFileSync(buildFile,JSON.stringify(build,null,2)+'\n',{flag:'wx'});
  const ready=await wait('ready.json');validatePlatformRuntimeReady(build,ready);
  for(const row of ready.processes){
   process.kill(row.pid,0);
   if(process.platform==='win32'){
    const source=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${row.pid}';$ports=@(Get-NetTCPConnection -State Listen -OwningProcess ${row.pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort);@{exe=$p.ExecutablePath;ports=$ports}|ConvertTo-Json -Compress`;
    const actual=JSON.parse(execFileSync('powershell',['-NoProfile','-Command',source],{encoding:'utf8',windowsHide:true}));
    check(fs.realpathSync(actual.exe).toLowerCase()===fs.realpathSync(row.exe).toLowerCase()&&actual.ports.includes(row.port),'Owned platform process or listening port drifted.');
   }
  }
  const proof={...ready,buildFile,buildFileSha256:sha(fs.readFileSync(buildFile)),readyFile,readyFileSha256:sha(fs.readFileSync(readyFile))};
  fs.writeFileSync(path.join(results,'platform-browser-runtime.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  const credentials=json(path.join(control,'private','environment.json'));
  check(credentials.sourceHead===build.sourceHead&&Date.parse(credentials.credentialsRefreshedAt)>=Date.parse(build.builtAt),'Platform login was not refreshed on this build.');
  return {proof,environment:Object.fromEntries(['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN'].map(name=>{check(typeof credentials.env?.[name]==='string'&&credentials.env[name].length>20,'Platform login token missing.');return [name,credentials.env[name]];}))};
 }
 if(fs.existsSync(buildFile)){
  fs.writeFileSync(path.join(control,'stop.json'),'{}\n',{flag:'wx'});
  await wait('stopped.json');
 }
 return {stopped:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,results,artifacts,control]=process.argv.slice(2);
 try{
  if(mode==='preflight'||mode==='frontend-preflight'){
   const plan=allPlatformPreflight(workspace,process.env,mode==='frontend-preflight');fs.mkdirSync(results,{recursive:true});
   fs.writeFileSync(path.join(results,mode==='frontend-preflight'?'platform-frontend-preflight.json':'all-platform-preflight.json'),JSON.stringify({...plan,environment:undefined},null,2)+'\n',{flag:'wx'});
   check(plan.passed,'AllPlatformTests prerequisites missing:\n'+plan.missing.join('\n'));
   if(mode==='frontend-preflight'){
    const fixture=prepareBrowserFixtureConfig(workspace,results,{...process.env,...plan.environment});
    Object.assign(plan.environment,fixture.environment);
    fs.writeFileSync(path.join(results,'platform-browser-fixture.json'),JSON.stringify(fixture.receipt,null,2)+'\n',{flag:'wx'});
   }
   console.log(JSON.stringify(plan.environment));
  }else if(mode==='browser'||mode==='frontend-browser')console.log(JSON.stringify(runAllBrowserTests(workspace,results,process.env,spawnSync,mode==='frontend-browser')));
  else if(mode==='runtime-prepare'||mode==='runtime-stop')console.log(JSON.stringify(await platformRuntime(mode,results,artifacts,control)));
  else throw Error('Usage: platform-all-tests.mjs preflight|browser|frontend-preflight|frontend-browser <results>');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
