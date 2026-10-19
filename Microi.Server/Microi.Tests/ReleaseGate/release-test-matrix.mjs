import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyHdfsEvidence} from './staged-full-runtime.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const version=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(value);
const normalizedUrl=value=>{const url=new URL(value);check(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash,'矩阵地址必须是不含凭据的 HTTP(S) 地址');return url.href.replace(/\/$/,'');};
const keys=(value,allowed,label)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key)),label+' 包含未知字段；不得写入凭据或额外配置');
const sameUrl=(a,b)=>normalizedUrl(a)===normalizedUrl(b);
const requiredCommon=['MICROI_TEST_API_BASE','MICROI_TEST_PEER_API_BASE','MICROI_TEST_OSCLIENT','MICROI_TEST_TOKEN','MICROI_TEST_DID','MICROI_TEST_FORM_ENGINE_KEY','MICROI_TEST_API_ENGINE_KEY','MICROI_TEST_CHILD_OSCLIENT','MICROI_TEST_CHILD_TOKEN','MICROI_UPGRADE_TEST_CONN','MICROI_UPGRADE_MYSQL_TEST_CONN','MICROI_TEST_SCHEDULE_REDIS','MICROI_TEST_SCHEDULE_MYSQL','MICROI_TEST_MONGO_CURRENT','MICROI_TEST_MONGO_CURRENT_VERSION','MICROI_TEST_FRONTEND_BASE','MICROI_TEST_ACCOUNT','MICROI_TEST_PASSWORD','MICROI_TEST_CHILD_ACCOUNT','MICROI_TEST_CHILD_PASSWORD'];

// 提供商选择是发行输入，不能从恰好存在的连接或历史 Full 环境推断；所选依赖仍全部必测。
export function createMatrixPlan(matrix,environment){
 keys(matrix,['schemaVersion','observedAt','target','dependencies','fixture'],'矩阵');
 check(matrix.schemaVersion===1&&Number.isFinite(Date.parse(matrix.observedAt)),'缺少已观测矩阵版本/时间');
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
 const requiredEnvironment=[...requiredCommon],sql=matrix.dependencies.sqlServer;
 if(sql){keys(sql,['version','explicitlyRequested'],'SQL Server');check(version(sql.version)&&sql.explicitlyRequested===true,'SQL Server 仅在明确专项选择时加入');requiredEnvironment.push('MICROI_UPGRADE_SQLSERVER_TEST_CONN');}
 else check(!environment.MICROI_UPGRADE_SQLSERVER_TEST_CONN,'未选择 SQL Server，拒绝残留连接扩大矩阵');
 const legacy=matrix.dependencies.mongoLegacy;
 if(legacy){keys(legacy,['version','explicitlyRequested'],'额外 Mongo');check(version(legacy.version)&&legacy.explicitlyRequested===true,'额外 Mongo 版本需要明确专项选择');check(environment.MICROI_TEST_MONGO_LEGACY_VERSION===legacy.version,'额外 Mongo 精确版本不一致');requiredEnvironment.push('MICROI_TEST_MONGO_LEGACY','MICROI_TEST_MONGO_LEGACY_VERSION');}
 else check(!environment.MICROI_TEST_MONGO_LEGACY&&!environment.MICROI_TEST_MONGO_LEGACY_VERSION,'未选择额外 Mongo 版本，拒绝残留连接');
 return {schemaVersion:1,matrix,requiredEnvironment,fullFilter:'Category=FullStack'+(sql?'':'&DatabaseProvider!=SqlServer'),dependencies:{...matrix.dependencies,sqlServer:sql?{...sql,status:'Selected'}:{status:'NotApplicable',reason:'目标未要求 SQL Server 专项；未执行'},mongoLegacy:legacy?{...legacy,status:'Selected'}:{status:'NotApplicable',reason:'常规仅验证当前 MCP 实际 MongoDB 版本'}}};
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
 const geometry=outcomes.geometry;check(geometry?.stats?.expected>=2&&['unexpected','skipped','flaky'].every(key=>geometry.stats[key]===0)&&['1366','3840'].every(width=>geometry.caseTitles.some(title=>title.includes(width))),'搜索标签真实浏览器门禁缺少普通桌面/4K用例或存在失败/跳过');
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
 return {schemaVersion:1,accepted:true,sourceHead:plan.sourceHead,runtimeBuildId:storage.apiProbe.buildId,matrixSha256:plan.matrixSha256,quickPassed:quick.length,fullPassed:full.length,geometry:{status:'Passed',cases:geometry.stats.expected,reportSha256:geometry.reportSha256},dependencies:{...plan.dependencies,mysql:{...plan.dependencies.mysql,status:'Passed'},redis:{...plan.dependencies.redis,status:'Passed'},mongo:{...plan.dependencies.mongo,status:'Passed'},storage:{...plan.dependencies.storage,status:'Passed',objectsVerified:4,currentApiAndHdfsPlugin:true},...(plan.matrix.dependencies.sqlServer?{sqlServer:{...plan.dependencies.sqlServer,status:'Passed',cases:sqlCases.length}}:{})}};
}

function readFile(file){check(path.isAbsolute(file),'矩阵/回执路径必须是绝对路径');const stat=fs.lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink(),'矩阵/回执必须是普通文件');return fs.readFileSync(file);}
export function validateStagedStorageProof(build,plan,storage,outcomesFile){
 check(path.resolve(build.resultsDirectory)===path.dirname(path.resolve(outcomesFile))&&build.sourceHead===plan.sourceHead&&storage.apiProbe?.buildId===build.buildId&&storage.apiProbe.apiDllSha256===build.apiDllSha256&&storage.apiProbe.hdfsDllSha256===verifyHdfsEvidence(build),'实际API/HDFS存储回执不属于本次正式Full的新构建');
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
function authoritativeTrx(suite,expectedFile){
 check(path.resolve(suite.trxFile)===path.resolve(expectedFile)&&hash(readFile(suite.trxFile))===suite.trxSha256,'TRX 位置或字节指纹不属于本轮结果目录');
 const reader=path.join(path.dirname(fileURLToPath(import.meta.url)),'read-release-matrix-trx.ps1');
 let text;
 try{text=execFileSync('pwsh',['-NoProfile','-File',reader,'-TrxFile',suite.trxFile],{encoding:'utf8',windowsHide:true,timeout:20000});}
 catch(error){if(error.code!=='ENOENT'||process.platform!=='win32')throw error;text=execFileSync('powershell.exe',['-NoProfile','-File',reader,'-TrxFile',suite.trxFile],{encoding:'utf8',windowsHide:true,timeout:20000});}
 const actual=JSON.parse(text.replace(/^\uFEFF/,'')),canonical=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 check(actual.trxSha256===suite.trxSha256&&actual.summaryOutcome===suite.summaryOutcome&&canonical(actual.counters)===canonical(suite.counters)&&JSON.stringify(actual.tests)===JSON.stringify(suite.tests),'矩阵 JSON 明细与权威 TRX 不一致');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,receipt,...extra]=process.argv.slice(2);
 if(mode==='freeze'){
  const bytes=readFile(file),plan={...createMatrixPlan(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),process.env),matrixFile:file,matrixSha256:hash(bytes),sourceHead:head()};
  write(receipt,plan);console.log(JSON.stringify({fullFilter:plan.fullFilter,requiredEnvironment:plan.requiredEnvironment}));
 }else if(mode==='verify'){
  const plan=JSON.parse(readFile(file));check(plan.sourceHead===head()&&hash(readFile(plan.matrixFile))===plan.matrixSha256,'Full 矩阵或候选 HEAD 在验收中漂移');
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
 }else throw Error('Usage: release-test-matrix.mjs freeze <matrix> <receipt> | verify <receipt> <outcomes> <result>');
}
