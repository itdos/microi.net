import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyHdfsEvidence} from './staged-full-runtime.mjs';
import {releaseBrowserWidths} from './release-browser-viewports.mjs';
import {snapshotDesktopInputs} from '../../tools/release-desktop-inputs.mjs';
import {snapshotCandidate,changedCandidate} from '../../tools/release-candidate.mjs';
import {roots as nodeRoots,discoverTests,assertTestSummary,regressionLogFile} from '../run-node-regressions.mjs';
import {discoverBrowserTests,validateBrowserReport} from './platform-all-tests.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const version=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(value);
const normalizedUrl=value=>{const url=new URL(value);check(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash,'矩阵地址必须是不含凭据的 HTTP(S) 地址');return url.href.replace(/\/$/,'');};
const keys=(value,allowed,label)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key)),label+' 包含未知字段；不得写入凭据或额外配置');
const sameUrl=(a,b)=>normalizedUrl(a)===normalizedUrl(b);
const requiredCommon=['MICROI_TEST_API_BASE','MICROI_TEST_PEER_API_BASE','MICROI_TEST_OSCLIENT','MICROI_TEST_TOKEN','MICROI_TEST_DID','MICROI_TEST_FORM_ENGINE_KEY','MICROI_TEST_API_ENGINE_KEY','MICROI_TEST_IOT_PROBE_ENGINE','MICROI_TEST_CHILD_OSCLIENT','MICROI_TEST_CHILD_TOKEN','MICROI_UPGRADE_TEST_CONN','MICROI_UPGRADE_MYSQL_TEST_CONN','MICROI_TEST_SCHEDULE_REDIS','MICROI_TEST_SCHEDULE_MYSQL','MICROI_TEST_MONGO_CURRENT','MICROI_TEST_MONGO_CURRENT_VERSION','MICROI_TEST_FRONTEND_BASE','MICROI_TEST_ACCOUNT','MICROI_TEST_PASSWORD','MICROI_TEST_CHILD_ACCOUNT','MICROI_TEST_CHILD_PASSWORD'];

// 提供商选择是发行输入，不能从恰好存在的连接或历史 Full 环境推断；所选依赖仍全部必测。
export function createMatrixPlan(matrix,environment){
 keys(matrix,['schemaVersion','observedAt','target','dependencies','fixture','candidateInputs'],'矩阵');
 check(matrix.schemaVersion===1&&Number.isFinite(Date.parse(matrix.observedAt)),'缺少已观测矩阵版本/时间');
 if(matrix.candidateInputs!==undefined){
  keys(matrix.candidateInputs,['desktop'],'候选输入');
  const desktop=matrix.candidateInputs.desktop;
  keys(desktop,['fileCount','filesSha256','formalCandidateModule'],'Desktop Full 输入');
  check(Number.isSafeInteger(desktop.fileCount)&&desktop.fileCount>0&&/^[a-f0-9]{64}$/.test(desktop.filesSha256||'')&&desktop.formalCandidateModule==='Microi.Server/tools/release-desktop-inputs.mjs','Desktop Full 输入指纹无效');
 }
 keys(matrix.target,['profile','apiBase','osClient'],'目标');keys(matrix.fixture,['apiBase','peerApiBase','osClient','childOsClient'],'夹具');
 check(typeof matrix.target.profile==='string'&&matrix.target.profile.length>0,'缺少 MCP Profile');
 normalizedUrl(matrix.target.apiBase);
 for(const key of ['osClient','childOsClient'])check(/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(matrix.fixture[key]||''),'隔离夹具租户无效');
 check(typeof matrix.target.osClient==='string'&&matrix.target.osClient.length>0,'缺少目标租户');
 check(new Set([matrix.target.osClient,matrix.fixture.osClient,matrix.fixture.childOsClient].map(value=>value.toLowerCase())).size===3,'Full 夹具必须与官方/业务租户及另一夹具隔离');
 for(const key of ['apiBase','peerApiBase']){const url=new URL(matrix.fixture[key]);normalizedUrl(url.href);check(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Full 夹具 API 只允许本机回环');}
 check(!sameUrl(matrix.fixture.apiBase,matrix.fixture.peerApiBase),'Full 必须保留两个独立 API 节点');
 for(const [variable,key] of [['MICROI_TEST_API_BASE','apiBase'],['MICROI_TEST_PEER_API_BASE','peerApiBase']])check(sameUrl(environment[variable],matrix.fixture[key]),'实际夹具地址与冻结矩阵不一致：'+variable);
 for(const [variable,key] of [['MICROI_TEST_OSCLIENT','osClient'],['MICROI_TEST_CHILD_OSCLIENT','childOsClient']])check(environment[variable]===matrix.fixture[key],'实际夹具租户与冻结矩阵不一致：'+variable);
 keys(matrix.dependencies,['mysql','redis','mongo','mongoLegacy','storage','sqlServer'],'依赖');
 for(const provider of ['mysql','redis','mongo']){keys(matrix.dependencies[provider],['version'],provider);check(version(matrix.dependencies[provider].version),'缺少 '+provider+' 实际精确版本');}
 keys(matrix.dependencies.storage,['provider'],'存储');check(/^[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(matrix.dependencies.storage.provider||''),'缺少当前生效 HDFS 提供商');
 check(environment.MICROI_TEST_MONGO_CURRENT_VERSION===matrix.dependencies.mongo.version,'Mongo 实际版本变量与冻结矩阵不一致');
 const browserGeometryWidths=releaseBrowserWidths(environment);
 const requiredEnvironment=[...requiredCommon],sql=matrix.dependencies.sqlServer;
 if(sql){keys(sql,['version','explicitlyRequested'],'SQL Server');check(version(sql.version)&&sql.explicitlyRequested===true,'SQL Server 仅在明确专项选择时加入');requiredEnvironment.push('MICROI_UPGRADE_SQLSERVER_TEST_CONN');}
 else check(!environment.MICROI_UPGRADE_SQLSERVER_TEST_CONN,'未选择 SQL Server，拒绝残留连接扩大矩阵');
 const legacy=matrix.dependencies.mongoLegacy;
 if(legacy){keys(legacy,['version','explicitlyRequested'],'额外 Mongo');check(version(legacy.version)&&legacy.explicitlyRequested===true,'额外 Mongo 版本需要明确专项选择');check(environment.MICROI_TEST_MONGO_LEGACY_VERSION===legacy.version,'额外 Mongo 精确版本不一致');requiredEnvironment.push('MICROI_TEST_MONGO_LEGACY','MICROI_TEST_MONGO_LEGACY_VERSION');}
 else check(!environment.MICROI_TEST_MONGO_LEGACY&&!environment.MICROI_TEST_MONGO_LEGACY_VERSION,'未选择额外 Mongo 版本，拒绝残留连接');
 return {schemaVersion:1,matrix,requiredEnvironment,browserGeometryWidths,fullFilter:'Category=FullStack'+(sql?'':'&DatabaseProvider!=SqlServer'),dependencies:{...matrix.dependencies,sqlServer:sql?{...sql,status:'Selected'}:{status:'NotApplicable',reason:'目标未要求 SQL Server 专项；未执行'},mongoLegacy:legacy?{...legacy,status:'Selected'}:{status:'NotApplicable',reason:'常规仅验证当前 MCP 实际 MongoDB 版本'}}};
}

// 可选桌面矩阵记录必须回读正式候选同一快照，不能把孤立 SHA 附件当成测试绑定。
export async function verifyMatrixDesktopInputs(matrix,workspace){
 if(matrix.candidateInputs===undefined)return;
 const files=await snapshotDesktopInputs(workspace),desktop=matrix.candidateInputs.desktop;
 check(Object.keys(files).length===desktop.fileCount&&hash(JSON.stringify(files))===desktop.filesSha256,'Desktop Full 源码与冻结矩阵不一致');
}

function verifySuite(suite,label){
 check(suite&&Array.isArray(suite.tests)&&suite.tests.length>0&&suite.counters,label+' 零用例或缺少 TRX');
 check(['Completed','Passed'].includes(suite.summaryOutcome),label+' TRX 汇总未完成');
 check(suite.tests.every(row=>typeof row.testName==='string'&&row.outcome==='Passed'),label+' 存在失败、取消、跳过或未知结果');
 const count=suite.tests.length,counters=suite.counters;
 check(Number(counters.total)===count&&Number(counters.passed)===count&&Number(counters.executed)===count,label+' TRX 明细与计数不一致');
 for(const key of ['failed','notExecuted','error','timeout','aborted','inconclusive','passedButRunAborted','notRunnable','disconnected','inProgress','pending'])check(Number(counters[key]??0)===0,label+' 异常计数：'+key);
 return suite.tests.map(row=>row.testName);
}

// 存储回执只接受本候选主/子租户的真实字节、匿名权限和权威删除回读；路由 mock 不算存储验收。
export function validateMatrixResults(plan,outcomes,storage){
 const quick=verifySuite(outcomes.quick,'Quick'),full=verifySuite(outcomes.full,'Full');
 // 按冻结时选择的视口核验，不能在回读时降低要求，也不能用相似数字冒充宽度。
 const geometry=outcomes.geometry,widths=plan.browserGeometryWidths;
 check(Array.isArray(widths)&&[2,3].includes(widths.length)&&widths[0]===1366&&widths[1]===1920&&(widths.length===2||widths[2]===3840),'搜索标签真实浏览器视口矩阵缺失或无效');
 check(geometry?.stats?.expected>=widths.length&&['unexpected','skipped','flaky'].every(key=>geometry.stats[key]===0)&&Array.isArray(geometry.caseTitles)&&widths.every(width=>geometry.caseTitles.some(title=>new RegExp('(?:^|[^0-9])'+width+'px(?:$|[^0-9])').test(title))),'搜索标签真实浏览器门禁缺少所选桌面用例或存在失败/跳过');
 const sqlCases=full.filter(name=>/SqlServer/.test(name));
 check(plan.matrix.dependencies.sqlServer?sqlCases.length>0:sqlCases.length===0,plan.matrix.dependencies.sqlServer?'所选 SQL Server 零用例':'未选择 SQL Server 却执行了其用例');
 for(const [name,count] of [['FieldOptionTreePageIntegrationTests.LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter',1],['RoleLimitActiveSnapshotTests.RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls',1],['TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes',4]])check(full.filter(value=>value.includes(name)&&value.includes('"MySql"')).length===count,'MySQL 混合提供商用例缺失或被连带排除：'+name);
 const mongoCases=full.filter(name=>name.includes('MongoLegacyCompatibilityTests.RealServers_'));
 check(mongoCases.length===(plan.matrix.dependencies.mongoLegacy?2:1)&&mongoCases.some(name=>name.includes('MICROI_TEST_MONGO_CURRENT')),'所选 MongoDB 真实版本用例缺失');
 check(mongoCases.some(name=>name.includes('MICROI_TEST_MONGO_LEGACY'))===Boolean(plan.matrix.dependencies.mongoLegacy),'额外 MongoDB 矩阵选择漂移');
 check(full.some(name=>/(Schedule|Quartz)/.test(name)),'Redis/调度真实 Full 用例缺失');
 check(full.some(name=>name.includes('SelectedDependencyVersionTests.MySqlAndRedisMatchTheFrozenMcpDependencyVersions')),'MySQL/Redis 实际精确版本用例缺失');
 check(storage?.schemaVersion===1&&storage.passed===true&&storage.sourceHead===plan.sourceHead&&storage.actualProvider===plan.matrix.dependencies.storage.provider,'存储回执不属于当前候选/生效提供商');
 check(storage.apiProbe?.passed===true&&storage.apiProbe.currentApiAndHdfsPlugin===true&&storage.apiProbe.uploadRoute==='api/HDFS/upload'&&storage.apiProbe.objectsVerified===4&&typeof storage.apiProbe.buildId==='string'&&storage.apiProbe.buildId.length>0&&['apiDllSha256','hdfsDllSha256'].every(key=>/^[a-f0-9]{64}$/.test(storage.apiProbe[key]||'')),'缺少当前候选API/Microi.HDFS真实上传读取回执；直连存储HTTP不能替代');
 check(Number.isFinite(Date.parse(storage.observedAt))&&Date.parse(storage.observedAt)>=Date.parse(plan.matrix.observedAt),'存储回执早于本轮依赖观测');
 const objects=storage.objectProbe?.objects,cleanup=storage.objectProbe?.cleanup;
 check(storage.objectProbe?.passed===true&&Array.isArray(objects)&&objects.length===4&&Array.isArray(cleanup)&&cleanup.length===4,'缺少主/子租户公开/私有存储字节闭环');
 const identities=new Set();
 for(const tenant of [plan.matrix.fixture.osClient,plan.matrix.fixture.childOsClient])for(const scope of ['Public','Private']){
  const rows=objects.filter(row=>row.tenant===tenant&&row.scope===scope);check(rows.length===1,'存储探针租户/范围重复或缺失');const row=rows[0],identity=scope+':'+row.key;
  check(typeof row.key==='string'&&row.key.startsWith(tenant.toLowerCase()+'/')&&!identities.has(identity),'存储对象超出隔离租户或重复');identities.add(identity);
  check(/^[a-f0-9]{64}$/.test(row.sha256)&&Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.apiUpload===200&&row.apiReadGet===200&&row.authenticatedGet===200&&row.currentDomainGet===200&&row.anonymousGet===(scope==='Public'?200:403),'当前API实际存储字节或公开/私有权限验收失败');
  const removed=cleanup.filter(value=>value.scope===scope&&value.key===row.key);check(removed.length===1&&removed[0].signedHeadAfterCleanup===404,'存储对象未完成权威清理回读');
 }
 return {schemaVersion:1,accepted:true,sourceHead:plan.sourceHead,runtimeBuildId:storage.apiProbe.buildId,matrixSha256:plan.matrixSha256,...(plan.matrix.candidateInputs?{candidateInputs:plan.matrix.candidateInputs}:{}),quickPassed:quick.length,fullPassed:full.length,geometry:{status:'Passed',cases:geometry.stats.expected,reportSha256:geometry.reportSha256},dependencies:{...plan.dependencies,mysql:{...plan.dependencies.mysql,status:'Passed'},redis:{...plan.dependencies.redis,status:'Passed'},mongo:{...plan.dependencies.mongo,status:'Passed'},storage:{...plan.dependencies.storage,status:'Passed',objectsVerified:4,currentApiAndHdfsPlugin:true},...(plan.matrix.dependencies.sqlServer?{sqlServer:{...plan.dependencies.sqlServer,status:'Passed',cases:sqlCases.length}}:{})}};
}

function readFile(file){check(path.isAbsolute(file),'矩阵/回执路径必须是绝对路径');const stat=fs.lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink(),'矩阵/回执必须是普通文件');return fs.readFileSync(file);}
export function validateStagedStorageProof(build,plan,storage,outcomesFile){
 check(path.resolve(build.resultsDirectory)===path.dirname(path.resolve(outcomesFile))&&build.sourceHead===plan.sourceHead&&storage.apiProbe?.buildId===build.buildId&&storage.apiProbe.apiDllSha256===build.apiDllSha256&&storage.apiProbe.hdfsDllSha256===verifyHdfsEvidence(build),'实际API/HDFS存储回执不属于本次正式Full的新构建');
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
function readAuthoritativeTrx(trxFile){
 const reader=path.join(path.dirname(fileURLToPath(import.meta.url)),'read-release-matrix-trx.ps1');
 let text;
 try{text=execFileSync('pwsh',['-NoProfile','-File',reader,'-TrxFile',trxFile],{encoding:'utf8',windowsHide:true,timeout:20000});}
 catch(error){if(error.code!=='ENOENT'||process.platform!=='win32')throw error;text=execFileSync('powershell.exe',['-NoProfile','-File',reader,'-TrxFile',trxFile],{encoding:'utf8',windowsHide:true,timeout:20000});}
 return JSON.parse(text.replace(/^\uFEFF/,''));
}
function authoritativeTrx(suite,expectedFile){
 check(path.resolve(suite.trxFile)===path.resolve(expectedFile)&&hash(readFile(suite.trxFile))===suite.trxSha256,'TRX 位置或字节指纹不属于本轮结果目录');
 const actual=readAuthoritativeTrx(suite.trxFile),canonical=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 check(actual.trxSha256===suite.trxSha256&&actual.summaryOutcome===suite.summaryOutcome&&canonical(actual.counters)===canonical(suite.counters)&&JSON.stringify(actual.tests)===JSON.stringify(suite.tests),'矩阵 JSON 明细与权威 TRX 不一致');
}

// 常规平台发行与完整业务 Full 是不同验收范围。这里没有租户创建、应用安装或
// 桌面应用测试，也不把未执行的真实数据库/浏览器/存储标为通过。
export const platformReleaseFilter='Category!=FullStack';
export const allPlatformTestsFilter='AllPlatformTests';
const platformExcluded=['FullStack','NewTenantAdmission','ChatInstallation','CodeDesktop','AgentVsix'];
export function validatePlatformReleaseSummary(receipt,dotnet,groups){
 const all=receipt?.allPlatformTests===true;
 check(receipt?.schemaVersion===1&&receipt.scope==='PlatformRelease'&&receipt.filter===(all?allPlatformTestsFilter:platformReleaseFilter),'PlatformRelease scope/filter 无效');
 const names=verifySuite(dotnet,'PlatformRelease');
 check(Array.isArray(groups)&&groups.length===nodeRoots.length,'PlatformRelease Node 责任范围缺失');
 const total=groups.reduce((sum,row)=>sum+row.tests,0);
 check(groups.every((row,index)=>row.root===nodeRoots[index]&&Number.isSafeInteger(row.tests)&&row.tests>0&&row.tests===row.pass&&['fail','cancelled','skipped','todo'].every(key=>row[key]===0)),'PlatformRelease Node 存在缺失、失败或跳过');
 check(receipt.dotnet?.tests===names.length&&receipt.dotnet.passed===names.length&&receipt.dotnet.failed===0&&receipt.dotnet.skipped===0,'PlatformRelease .NET 回执计数与 TRX 不一致');
 check(receipt.node?.groups===groups.length&&receipt.node.tests===total&&receipt.node.passed===total&&receipt.node.failed===0&&receipt.node.skipped===0,'PlatformRelease Node 回执计数不一致');
 return {scope:'PlatformRelease',filter:receipt.filter,allPlatformTests:all,dotnetPassed:names.length,nodePassed:total,nodeGroups:groups.length,notExecuted:all?['CodeDesktop','AgentVsix']:[...platformExcluded]};
}
async function verifyPlatformPlan(plan){
 check(plan?.schemaVersion===1&&plan.scope==='PlatformRelease'&&plan.filter===(plan.allPlatformTests?allPlatformTestsFilter:platformReleaseFilter)&&plan.sourceHead===head(),'PlatformRelease 冻结范围或候选 HEAD 漂移');
 const bytes=readFile(plan.candidateManifest?.file);
 check(hash(bytes)===plan.candidateManifest.sha256,'PlatformRelease 候选清单字节漂移');
 const candidate=JSON.parse(bytes);
 check(candidate.scope==='PlatformRelease'&&candidate.sourceHead===plan.sourceHead&&changedCandidate(candidate,await snapshotCandidate(undefined,undefined,{testPolicy:'PlatformRelease'})).length===0,'PlatformRelease 候选源码漂移');
}
export async function readPlatformReleaseTests(receiptFile){
 const receiptBytes=readFile(receiptFile),receipt=JSON.parse(receiptBytes.toString('utf8').replace(/^\uFEFF/,'')),directory=path.dirname(receiptFile);
 const trxFile=path.join(directory,'microi-platform.trx');
 check(path.resolve(receipt.dotnet?.trxFile||'')===trxFile&&hash(readFile(trxFile))===receipt.dotnet.trxSha256,'PlatformRelease 原始 TRX 位置或哈希无效');
 // 复用禁用 DTD/外部实体的原始 TRX 读取器，JSON 汇总不能替代真实测试结果。
 const dotnet=readAuthoritativeTrx(trxFile);
 const reportFile=path.join(directory,'node-regressions.json'),reportBytes=readFile(reportFile);
 check(path.resolve(receipt.node?.reportFile||'')===reportFile&&hash(reportBytes)===receipt.node.reportSha256,'PlatformRelease 原始 Node 报告位置或哈希无效');
 const groups=JSON.parse(reportBytes),tapReceipts=[];
 check(Array.isArray(groups)&&groups.length===nodeRoots.length,'PlatformRelease Node 责任范围缺失');
 for(const [index,row] of groups.entries()){
  check(row.root===nodeRoots[index],'PlatformRelease Node 责任范围或顺序漂移');
  const actualFiles=discoverTests(path.join(root,row.root)).map(file=>path.relative(root,file));
  check(actualFiles.length>0&&JSON.stringify(actualFiles)===JSON.stringify(row.files),'PlatformRelease Node 文件发现清单漂移');
  const tapFile=regressionLogFile(directory,row.root),tapBytes=readFile(tapFile),counts=assertTestSummary(tapBytes.toString('utf8'));
  check(Object.entries(counts).every(([key,value])=>row[key]===value),'PlatformRelease Node TAP 与报告计数不一致');
  tapReceipts.push({file:tapFile,sha256:hash(tapBytes)});
 }
 let browser;
 if(receipt.allPlatformTests===true){
  const reportFile=path.join(directory,'all-platform-browser.json'),bytes=readFile(reportFile);
  check(path.resolve(receipt.browser?.reportFile||'')===reportFile&&hash(bytes)===receipt.browser?.reportSha256,'AllPlatformTests browser report location or hash is invalid');
  const counts=validateBrowserReport(JSON.parse(bytes),discoverBrowserTests(path.join(root,'Microi.Client/tests')));
  check(Object.entries(counts).every(([key,value])=>receipt.browser[key]===value),'AllPlatformTests browser report counts do not match');
  browser={...counts,file:reportFile,sha256:hash(bytes)};
 }
 return {...validatePlatformReleaseSummary(receipt,dotnet,groups),...(browser?{browser}:{}),testReceipt:{file:receiptFile,sha256:hash(receiptBytes)},
  dotnet:{file:trxFile,sha256:hash(readFile(trxFile))},node:{file:reportFile,sha256:hash(reportBytes),tapReceipts}};
}
async function platformEvidence(plan,receiptFile){
 await verifyPlatformPlan(plan);
 const tests=await readPlatformReleaseTests(receiptFile);
 check(tests.filter===plan.filter&&tests.allPlatformTests===Boolean(plan.allPlatformTests),'PlatformRelease test coverage differs from frozen plan');
 return {schemaVersion:1,accepted:true,sourceHead:plan.sourceHead,candidateManifest:plan.candidateManifest,...tests};
}
// 制品捕获/推送前再次验证同一范围和原始测试证据，拒绝把 Full 与 PlatformRelease 回执互换。
export async function verifyPlatformReleaseEvidence(resultFile,candidateFile){
 const bytes=readFile(resultFile),result=JSON.parse(bytes),planBytes=readFile(result.planReceipt?.file);
 check(result.scope==='PlatformRelease'&&result.accepted===true&&hash(planBytes)===result.planReceipt.sha256,'PlatformRelease 验收回执或冻结计划无效');
 check(path.resolve(result.candidateManifest?.file||'')===path.resolve(candidateFile)&&hash(readFile(candidateFile))===result.candidateManifest.sha256,'PlatformRelease 制品与测试候选不一致');
 const actual=await platformEvidence(JSON.parse(planBytes),result.testReceipt?.file);
 for(const [key,value] of Object.entries(actual))check(JSON.stringify(value)===JSON.stringify(result[key]),'PlatformRelease 验收回执与原始证据不一致：'+key);
 return {scope:'PlatformRelease',file:resultFile,sha256:hash(bytes)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,receipt,...extra]=process.argv.slice(2);
 if(mode==='freeze-platform'){
  const all=extra.includes('--all-platform-tests');
  const bytes=readFile(file),plan={schemaVersion:1,scope:'PlatformRelease',allPlatformTests:all,filter:all?allPlatformTestsFilter:platformReleaseFilter,sourceHead:head(),candidateManifest:{file,sha256:hash(bytes)},frozenAt:new Date().toISOString()};
  await verifyPlatformPlan(plan);write(receipt,plan);console.log(all?'All Microi.Tests and frontend browser inputs selected; desktop products remain separate.':'PlatformRelease component candidate frozen; FullStack and desktop applications are not selected.');
 }else if(mode==='verify-platform'){
  const planBytes=readFile(file),result=await platformEvidence(JSON.parse(planBytes),receipt);
  write(extra[0],{...result,planReceipt:{file,sha256:hash(planBytes)},verifiedAt:new Date().toISOString()});console.log('PlatformRelease raw TRX and platform Node evidence verified.');
 }else if(mode==='freeze'){
  const bytes=readFile(file),matrix=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  const platformOnly=extra.includes('--platform-only');
  // 平台全套测试复用真实数据库/租户矩阵，不继承历史 Desktop 快照或要求其源码存在。
  // 原始矩阵字节仍绑定哈希，所有依赖版本、fixture 坐标及写入前置校验保持不变。
  const selectedMatrix=platformOnly?{...matrix,candidateInputs:undefined}:matrix;
  const plan={...createMatrixPlan(selectedMatrix,process.env),matrixFile:file,matrixSha256:hash(bytes),sourceHead:head(),...(platformOnly?{scope:'PlatformDependencies'}:{})};
  if(!platformOnly)await verifyMatrixDesktopInputs(plan.matrix,root);
  write(receipt,plan);console.log(JSON.stringify({fullFilter:plan.fullFilter,requiredEnvironment:plan.requiredEnvironment}));
 }else if(mode==='verify'){
  const plan=JSON.parse(readFile(file));check(plan.sourceHead===head()&&hash(readFile(plan.matrixFile))===plan.matrixSha256,'Full 矩阵或候选 HEAD 在验收中漂移');
  await verifyMatrixDesktopInputs(plan.matrix,root);
  const storageFile=process.env.MICROI_TEST_STORAGE_RECEIPT;check(storageFile,'缺少实际 HDFS 存储闭环回执 MICROI_TEST_STORAGE_RECEIPT');
  const outcomes=JSON.parse(readFile(receipt));
  for(const [suite,name]of [['quick','microi-quick.trx'],['full','microi-full-stack.trx']])authoritativeTrx(outcomes[suite],path.join(path.dirname(receipt),name));
  const geometryFile=path.join(path.dirname(receipt),'search-select-label-geometry.json');check(path.resolve(outcomes.geometry.reportFile)===path.resolve(geometryFile)&&hash(readFile(geometryFile))===outcomes.geometry.reportSha256,'真实浏览器结果字节漂移');
  const actualGeometry=JSON.parse(readFile(geometryFile).toString('utf8').replace(/^\uFEFF/,''));check(JSON.stringify(actualGeometry.stats)===JSON.stringify(outcomes.geometry.stats),'真实浏览器统计被改写');
  const actualTitles=[];const collectTitles=suite=>{for(const spec of suite.specs||[])actualTitles.push(spec.title);for(const child of suite.suites||[])collectTitles(child);};for(const suite of actualGeometry.suites||[])collectTitles(suite);check(JSON.stringify(actualTitles)===JSON.stringify(outcomes.geometry.caseTitles),'真实浏览器用例名称与原始报告不一致');
  const storageBytes=readFile(storageFile),storage=JSON.parse(storageBytes);
  if(process.env.MICROI_TEST_RUNTIME_BUILD_FILE)validateStagedStorageProof(JSON.parse(readFile(process.env.MICROI_TEST_RUNTIME_BUILD_FILE)),plan,storage,receipt);
  const result=validateMatrixResults(plan,outcomes,storage);
  write(extra[0],{...result,storageReceipt:{file:storageFile,sha256:hash(storageBytes)},verifiedAt:new Date().toISOString()});console.log('Selected Full dependency matrix passed; unselected providers are NotApplicable.');
 }else throw Error('Usage: release-test-matrix.mjs freeze <matrix> <receipt> | verify <receipt> <outcomes> <result> | freeze-platform <candidate> <plan> | verify-platform <plan> <tests> <result>');
}
