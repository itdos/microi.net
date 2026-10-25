import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

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
  PW_API_BASE:environment.MICROI_TEST_API_BASE||'http://127.0.0.1:61501',
  PW_BASE_URL:environment.MICROI_TEST_FRONTEND_BASE||'http://127.0.0.1:61500',
  PW_OS_CLIENT:environment.MICROI_TEST_OSCLIENT||settings.OsClient,
  MICROI_OSCLIENT:environment.MICROI_TEST_OSCLIENT||settings.OsClient};
}

export function allPlatformPreflight(workspaceRoot,environment={}){
 const defaults=readLocalTestDefaults(path.join(workspaceRoot,'Microi.Server/Microi.net.Api'),environment);
 const directory=path.join(workspaceRoot,'Microi.Client/tests'),files=discoverBrowserTests(directory),missing=[];
 check(files.length>0,'AllPlatformTests discovered no frontend browser test files.');
 if(!environment.MICROI_TEST_MATRIX_FILE)missing.push('Existing FullStack dependency matrix: MICROI_TEST_MATRIX_FILE');
 if(environment.MICROI_TEST_ALLOW_WRITES!=='YES')missing.push('Existing isolated fixture write authorization: MICROI_TEST_ALLOW_WRITES=YES');
 // 全部 C# 用例含真实平台应用维护。普通启动配置不能自动授权安装或升级租户应用。
 if(environment.MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE!=='YES')missing.push('FullStack/PlatformApplicationMaintenanceTests.cs: existing isolated fixture application maintenance authorization is absent (MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE=YES).');
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
   if(expected){if(environment[name]&&environment[name]!==expected)missing.push(`${relative}: ${name} does not match the existing local fixture`);bindings[name]=expected;}
  }
 }
 return {schemaVersion:1,scope:'AllPlatformTests',passed:missing.length===0,missing:[...new Set(missing)],
  files:files.map(file=>({path:path.relative(workspaceRoot,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))})),
  environment:bindings};
}

export function validateBrowserReport(report,expectedFiles){
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
 return {tests:count,passed:count,failed:0,skipped:0,files:expectedFiles.length};
}

export function runAllBrowserTests(workspaceRoot,results,environment=process.env,run=spawnSync){
 const plan=allPlatformPreflight(workspaceRoot,environment);
 check(plan.passed,'AllPlatformTests prerequisites missing:\n'+plan.missing.join('\n'));
 const client=path.join(workspaceRoot,'Microi.Client'),directory=path.join(client,'tests');
 const files=plan.files.map(row=>path.join(workspaceRoot,row.path));
 const config=path.join(results,'all-platform-browser.config.mjs'),output=path.join(results,'all-platform-browser-results');
 const reportFile=path.join(results,'all-platform-browser.json');
 check(!fs.existsSync(config)&&!fs.existsSync(reportFile),'AllPlatformTests requires fresh browser output.');
 // 不调用 webServer / docker / 安装器；复用现有 frontend/API 和配置对应的依赖。
 fs.writeFileSync(config,`export default ${JSON.stringify({testDir:directory,testMatch:files.map(file=>path.relative(directory,file).replaceAll('\\','/')),workers:1,fullyParallel:false,timeout:90000,retries:0,outputDir:output,use:{headless:true,trace:'retain-on-failure',...(environment.PW_BROWSER_CHANNEL?{channel:environment.PW_BROWSER_CHANNEL}:{})}})};\n`,{flag:'wx'});
 try{
  const result=run(process.execPath,[path.join(client,'node_modules/@playwright/test/cli.js'),'test','--config',config,'--reporter=json'],{cwd:client,env:{...environment,...plan.environment},encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  if(result.error)throw Error('Frontend browser runner could not execute.');
  fs.writeFileSync(reportFile,result.stdout||'',{flag:'wx'});
  check(result.status===0,'Frontend browser runner failed; inspect the private result file.');
  return {...validateBrowserReport(json(reportFile),files),reportFile,reportSha256:sha(fs.readFileSync(reportFile))};
 }finally{fs.unlinkSync(config);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,results]=process.argv.slice(2);
 try{
  if(mode==='preflight'){
   const plan=allPlatformPreflight(workspace,process.env);fs.mkdirSync(results,{recursive:true});
   fs.writeFileSync(path.join(results,'all-platform-preflight.json'),JSON.stringify({...plan,environment:undefined},null,2)+'\n',{flag:'wx'});
   check(plan.passed,'AllPlatformTests prerequisites missing:\n'+plan.missing.join('\n'));
   console.log(JSON.stringify(plan.environment));
  }else if(mode==='browser')console.log(JSON.stringify(runAllBrowserTests(workspace,results)));
  else throw Error('Usage: platform-all-tests.mjs preflight|browser <results>');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
