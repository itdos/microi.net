import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createMatrixPlan, validateMatrixResults,validateStagedStorageProof,verifyMatrixDesktopInputs,validatePlatformReleaseSummary,readPlatformReleaseTests} from './release-test-matrix.mjs';
import {roots as nodeRoots,discoverNodeScope,regularNodeSpecialists,regressionLogFile} from '../run-node-regressions.mjs';
import {snapshotDesktopInputs} from '../../tools/release-desktop-inputs.mjs';
import {createHash} from 'node:crypto';
import {preserveHdfsEvidence} from './staged-full-runtime.mjs';
import os from 'node:os';
import {platformFrontendScope} from './platform-all-tests.mjs';

test('post-cleanup storage verification accepts Git Bash mixed separators and rejects another results directory',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-matrix-proof-'));
 const runtime=path.join(directory,'.net-artifacts');fs.mkdirSync(runtime);fs.writeFileSync(path.join(runtime,'Microi.HDFS.dll'),'tested HDFS bytes');
 try{
  const build={resultsDirectory:directory,runtimeDirectory:runtime,sourceHead:'a'.repeat(40),buildId:'same-build',apiDllSha256:'b'.repeat(64),...preserveHdfsEvidence(runtime,directory)};
  const proof={apiProbe:{buildId:build.buildId,apiDllSha256:build.apiDllSha256,hdfsDllSha256:build.hdfsDllSha256}};
  fs.rmSync(runtime,{recursive:true});
  const outcomes=directory+'/release-test-matrix-outcomes.json';
  assert.doesNotThrow(()=>validateStagedStorageProof(build,{sourceHead:build.sourceHead},proof,outcomes));
  assert.throws(()=>validateStagedStorageProof(build,{sourceHead:build.sourceHead},proof,path.join(directory,'foreign','outcomes.json')),/存储回执/u);
  for(const key of ['sourceHead','buildId','apiDllSha256'])assert.throws(()=>validateStagedStorageProof({...build,[key]:'other'},{sourceHead:build.sourceHead},proof,outcomes),/存储回执/u);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

const matrix=()=>({schemaVersion:1,observedAt:'2026-10-16T09:00:00.000Z',target:{profile:'microi_demo',apiBase:'https://api.example.com',osClient:'demo'},dependencies:{mysql:{version:'5.7.44'},redis:{version:'7.4.2'},mongo:{version:'5.0.5'},storage:{provider:'Aliyun'},sqlServer:null},fixture:{apiBase:'http://127.0.0.1:63971/',peerApiBase:'http://127.0.0.1:63972/',osClient:'FullMain_123',childOsClient:'FullChild_123'}});
const environment=()=>({MICROI_TEST_API_BASE:'http://127.0.0.1:63971/',MICROI_TEST_PEER_API_BASE:'http://127.0.0.1:63972/',MICROI_TEST_OSCLIENT:'FullMain_123',MICROI_TEST_CHILD_OSCLIENT:'FullChild_123',MICROI_TEST_MONGO_CURRENT_VERSION:'5.0.5'});
test('IoT HTTP integration prerequisites are declared before the expensive Full build',()=>{
 const consumer=fs.readFileSync(new URL('../FullStack/IoTDownlinkHttpTests.cs',import.meta.url),'utf8');
 const required=[...consumer.matchAll(/Required\("(MICROI_[A-Z_]+)"\)/g)].map(match=>match[1]);
 assert.ok(required.includes('MICROI_TEST_IOT_PROBE_ENGINE'));
 const planned=new Set(createMatrixPlan(matrix(),environment()).requiredEnvironment);
 assert.deepEqual(required.filter(name=>!planned.has(name)),[],'Full preflight must cover the real HTTP test environment contract');
});
const suite=names=>({summaryOutcome:'Completed',tests:names.map(testName=>({testName,outcome:'Passed'})),counters:{total:names.length,passed:names.length,executed:names.length,notExecuted:0,failed:0}});
const fullNames=['Dos.Common.Tests.FieldOptionTreePageIntegrationTests.LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter(provider: "MySql")','Microi.Tests.Common.RoleLimitActiveSnapshotTests.RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls(providerName: "MySql")',...['null','empty','blank','short'].map(value=>'Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: "MySql", previousSecret: '+value+')'),'Microi.Tests.Common.MongoLegacyCompatibilityTests.RealServers_Authenticate_PersistLogsOnce_PageWithoutDuplicates_AndIsolateTenants(variable: "MICROI_TEST_MONGO_CURRENT", versionVariable: "MICROI_TEST_MONGO_CURRENT_VERSION")','Microi.Tests.Common.MicroiQuartzSchemaRepairIntegrationTests.RealSchedule','Microi.Tests.Common.SelectedDependencyVersionTests.MySqlAndRedisMatchTheFrozenMcpDependencyVersions'];
const geometry=()=>({stats:{expected:2,unexpected:0,skipped:0,flaky:0},caseTitles:['桌面1366px','桌面1920px']});
const outcomes=()=>({quick:suite(['OfflineSqlServerCompiler']),full:suite(fullNames),geometry:geometry()});
const storage=()=>({schemaVersion:1,sourceHead:'a'.repeat(40),observedAt:'2026-10-16T09:01:00.000Z',passed:true,actualProvider:'Aliyun',apiProbe:{passed:true,currentApiAndHdfsPlugin:true,uploadRoute:'api/HDFS/upload',objectsVerified:4,buildId:'synthetic-parser-fixture',apiDllSha256:'d'.repeat(64),hdfsDllSha256:'e'.repeat(64)},objectProbe:{passed:true,objects:['FullMain_123','FullChild_123'].flatMap(tenant=>['Public','Private'].map(scope=>({tenant,scope,key:tenant.toLowerCase()+'/full/run/'+scope,sha256:'b'.repeat(64),bytes:32,apiUpload:200,apiReadGet:200,authenticatedGet:200,anonymousGet:scope==='Public'?200:403,currentDomainGet:200}))),cleanup:['FullMain_123','FullChild_123'].flatMap(tenant=>['Public','Private'].map(scope=>({scope,key:tenant.toLowerCase()+'/full/run/'+scope,signedHeadAfterCleanup:404})))}});
const frozen=()=>({...createMatrixPlan(matrix(),environment()),sourceHead:'a'.repeat(40)});

test('PlatformRelease is a separate zero-skip scope and does not claim FullStack or desktop acceptance',()=>{
 const groups=nodeRoots.map(root=>({root,tests:2,pass:2,fail:0,cancelled:0,skipped:0,todo:0}));
 const receipt={schemaVersion:1,scope:'PlatformRelease',filter:'Category!=FullStack',dotnet:{tests:1,passed:1,failed:0,skipped:0},node:{groups:groups.length,tests:groups.length*2,passed:groups.length*2,failed:0,skipped:0}};
 const result=validatePlatformReleaseSummary(receipt,suite(['component']),groups);
 assert.equal(result.scope,'PlatformRelease');assert.equal(result.dotnetPassed,1);assert.ok(result.notExecuted.includes('FullStack'));assert.ok(result.notExecuted.includes('CodeDesktop'));
 for(const mutate of [r=>{r.scope='Full'},r=>{r.filter='Category=FullStack'},r=>{r.dotnet.passed=0},r=>{r.node.skipped=1},r=>{r.node.groups=0}]){const value=structuredClone(receipt);mutate(value);assert.throws(()=>validatePlatformReleaseSummary(value,suite(['component']),groups));}
 assert.throws(()=>validatePlatformReleaseSummary(receipt,suite([]),groups));
 assert.throws(()=>validatePlatformReleaseSummary(receipt,suite(['component']),groups.slice(1)));
 assert.throws(()=>validatePlatformReleaseSummary(receipt,suite(['component']),groups.map((row,index)=>index?row:{...row,skipped:1})));
});

test('PlatformRelease rereads raw TRX and each Node TAP and rejects hashes, omitted files and forged counts',async()=>{
 const workspace=fileURLToPath(new URL('../../../',import.meta.url)),directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-platform-parser-'));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{
  // 仅验证解析器的合成夹具；正式回执由实际 dotnet/node 进程生成，测试不发布任何制品。
  const trxFile=path.join(directory,'microi-platform.trx'),reportFile=path.join(directory,'node-regressions.json'),receiptFile=path.join(directory,'platform-release-tests.json');
  const xml='<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Results><UnitTestResult testName="parser fixture" outcome="Passed"/></Results><ResultSummary outcome="Completed"><Counters total="1" passed="1" executed="1" failed="0" notExecuted="0"/></ResultSummary></TestRun>';
  fs.writeFileSync(trxFile,xml);
  const groups=nodeRoots.map(root=>{const selected=discoverNodeScope(path.join(workspace,root),{regularPlatform:true});return {root,...selected,files:selected.files.map(file=>path.relative(workspace,file)),tests:2,pass:2,fail:0,cancelled:0,skipped:0,todo:0};});
  const tap='# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  for(const row of groups)fs.writeFileSync(regressionLogFile(directory,row.root),tap);
  fs.writeFileSync(reportFile,JSON.stringify(groups));
  const receipt={schemaVersion:1,scope:'PlatformRelease',filter:'Category!=FullStack',dotnet:{trxFile,trxSha256:sha(xml),tests:1,passed:1,failed:0,skipped:0},node:{reportFile,reportSha256:sha(fs.readFileSync(reportFile)),groups:groups.length,tests:groups.length*2,passed:groups.length*2,failed:0,skipped:0}};
  const save=()=>fs.writeFileSync(receiptFile,'\uFEFF'+JSON.stringify(receipt));save();
  const actual=await readPlatformReleaseTests(receiptFile);assert.equal(actual.node.tapReceipts.length,nodeRoots.length);
  assert.equal(actual.node.tapReceipts.flatMap(row=>row.notApplicable).length,Object.keys(regularNodeSpecialists).length);
  const classification=groups[0].notApplicable;groups[0].notApplicable=[];fs.writeFileSync(reportFile,JSON.stringify(groups));receipt.node.reportSha256=sha(fs.readFileSync(reportFile));save();await assert.rejects(readPlatformReleaseTests(receiptFile),/专项分类/u);
  groups[0].notApplicable=classification;fs.writeFileSync(reportFile,JSON.stringify(groups));receipt.node.reportSha256=sha(fs.readFileSync(reportFile));save();
  const selected=platformFrontendScope(path.join(workspace,'Microi.Client/tests'));
  const browserReport={config:{rootDir:path.join(workspace,'Microi.Client/tests')},stats:{expected:selected.files.length,unexpected:0,skipped:0,flaky:0},suites:selected.files.map(file=>({file,specs:[{file,title:'general parser fixture',line:1,column:1,ok:true,tests:[{status:'expected',results:[{status:'passed'}]}]}]}))};
  const browserFile=path.join(directory,'platform-frontend-browser.json'),listFile=path.join(directory,'platform-frontend-browser-list.json');
  for(const file of [browserFile,listFile])fs.writeFileSync(file,JSON.stringify(browserReport));
  receipt.platformFrontendTests=true;receipt.browser={tests:selected.files.length,passed:selected.files.length,failed:0,skipped:0,files:selected.files.length,reportFile:browserFile,reportSha256:sha(fs.readFileSync(browserFile)),listFile,listSha256:sha(fs.readFileSync(listFile)),excluded:selected.excluded};save();
  const regular=await readPlatformReleaseTests(receiptFile);assert.equal(regular.platformFrontendTests,true);assert.equal(regular.browser.scope,'PlatformFrontendTests');assert.equal(regular.browser.excluded.length,selected.excluded.length);
  fs.appendFileSync(listFile,' ');await assert.rejects(readPlatformReleaseTests(receiptFile),/inventory/);fs.writeFileSync(listFile,JSON.stringify(browserReport));
  receipt.browser.excluded=[];save();await assert.rejects(readPlatformReleaseTests(receiptFile),/exclusion scope/);
  delete receipt.browser;delete receipt.platformFrontendTests;save();
  fs.appendFileSync(trxFile,' ');await assert.rejects(readPlatformReleaseTests(receiptFile),/TRX/);fs.writeFileSync(trxFile,xml);
  fs.writeFileSync(regressionLogFile(directory,groups[0].root),tap.replace('# skipped 0','# skipped 1'));await assert.rejects(readPlatformReleaseTests(receiptFile),/skipped/);fs.writeFileSync(regressionLogFile(directory,groups[0].root),tap);
  receipt.dotnet.passed=2;save();await assert.rejects(readPlatformReleaseTests(receiptFile),/计数/u);receipt.dotnet.passed=1;
  groups[0].files.pop();fs.writeFileSync(reportFile,JSON.stringify(groups));receipt.node.reportSha256=sha(fs.readFileSync(reportFile));save();await assert.rejects(readPlatformReleaseTests(receiptFile),/发现清单/u);
 }finally{fs.rmSync(directory,{recursive:true});}
});

test('Desktop candidate matrix binds the actual Full snapshot and rejects unknown metadata or source drift',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-desktop-matrix-'));
 try{
  const init=spawnSync('git',['init','--quiet'],{cwd:directory,windowsHide:true});assert.equal(init.status,0);
  const desktop=path.join(directory,'Microi.Agent/apps/microi-code');fs.mkdirSync(desktop,{recursive:true});fs.writeFileSync(path.join(desktop,'package.json'),'{}');
  const files=await snapshotDesktopInputs(directory),input=matrix();
  input.candidateInputs={desktop:{fileCount:Object.keys(files).length,filesSha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),formalCandidateModule:'Microi.Server/tools/release-desktop-inputs.mjs'}};
  const plan={...createMatrixPlan(input,environment()),sourceHead:'a'.repeat(40)};
  assert.deepEqual(validateMatrixResults(plan,outcomes(),storage()).candidateInputs,input.candidateInputs);
  await verifyMatrixDesktopInputs(input,directory);
  for(const mutate of [m=>{m.candidateInputs.extra={}},m=>{m.candidateInputs.desktop.fileCount=0},m=>{m.candidateInputs.desktop.filesSha256='unknown'},m=>{m.candidateInputs.desktop.formalCandidateModule='arbitrary.mjs'},m=>{m.candidateInputs.desktop.Token='secret'}]){
   const invalid=structuredClone(input);mutate(invalid);assert.throws(()=>createMatrixPlan(invalid,environment()));
  }
  fs.writeFileSync(path.join(desktop,'package.json'),'{"version":"changed"}');
  await assert.rejects(verifyMatrixDesktopInputs(input,directory),/Desktop Full/u);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('all-platform dependency freeze ignores inherited Desktop snapshots while preserving actual database and fixture validation',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-platform-dependencies-'));
 const tool=fileURLToPath(new URL('./release-test-matrix.mjs',import.meta.url));
 const input=path.join(directory,'matrix.json'),receipt=path.join(directory,'platform.json');
 const env={...process.env,...environment(),MICROI_UPGRADE_SQLSERVER_TEST_CONN:'',MICROI_TEST_MONGO_LEGACY:'',MICROI_TEST_MONGO_LEGACY_VERSION:''};
 try{
  const value=matrix();
  value.candidateInputs={desktop:{fileCount:1,filesSha256:'obsolete-desktop-hash',formalCandidateModule:'removed-desktop-repository.mjs'}};
  fs.writeFileSync(input,JSON.stringify(value));
  const result=spawnSync(process.execPath,[tool,'freeze',input,receipt,'--platform-only'],{env,encoding:'utf8',windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
  const plan=JSON.parse(fs.readFileSync(receipt));assert.equal(plan.scope,'PlatformDependencies');
  assert.equal(plan.matrix.candidateInputs,undefined);assert.ok(plan.requiredEnvironment.includes('MICROI_TEST_TOKEN'));
  const full=spawnSync(process.execPath,[tool,'freeze',input,path.join(directory,'full.json')],{env,encoding:'utf8',windowsHide:true});
  assert.notEqual(full.status,0);assert.equal(fs.existsSync(path.join(directory,'full.json')),false);
  delete value.dependencies.mongo;fs.writeFileSync(input,JSON.stringify(value));
  const invalid=spawnSync(process.execPath,[tool,'freeze',input,path.join(directory,'invalid.json'),'--platform-only'],{env,encoding:'utf8',windowsHide:true});
  assert.notEqual(invalid.status,0);assert.equal(fs.existsSync(path.join(directory,'invalid.json')),false);
 }finally{fs.rmSync(directory,{recursive:true});}
});

test('常规桌面足以验收，显式4K选择冻结并要求额外用例',()=>{
 const common=frozen();assert.deepEqual(common.browserGeometryWidths,[1366,1920]);
 assert.doesNotThrow(()=>validateMatrixResults(common,outcomes(),storage()));
 const selected={...createMatrixPlan(matrix(),{...environment(),MICROI_TEST_BROWSER_4K:'1'}),sourceHead:'a'.repeat(40)};
 assert.deepEqual(selected.browserGeometryWidths,[1366,1920,3840]);
 assert.throws(()=>validateMatrixResults(selected,outcomes(),storage()),/浏览器/u);
 const complete=outcomes();complete.geometry.stats.expected=3;complete.geometry.caseTitles.push('4K3840px');
 assert.doesNotThrow(()=>validateMatrixResults(selected,complete,storage()));
 for(const mutate of [v=>{v.geometry.stats.skipped=1},v=>{v.geometry.caseTitles[0]='桌面11366px'},v=>{v.geometry.caseTitles.pop()}]){
  const value=outcomes();mutate(value);assert.throws(()=>validateMatrixResults(common,value,storage()),/浏览器/u);
 }
 assert.throws(()=>createMatrixPlan(matrix(),{...environment(),MICROI_TEST_BROWSER_4K:'maybe'}),/4K/u);
});

test('常规矩阵只执行当前Mongo和MySQL，SQLServer不适用且不是跳过例外',()=>{
 const plan=frozen();assert.equal(plan.fullFilter,'Category=FullStack&DatabaseProvider!=SqlServer');assert.equal(plan.dependencies.sqlServer.status,'NotApplicable');
 const result=validateMatrixResults(plan,outcomes(),storage());assert.equal(result.accepted,true);assert.equal(result.fullPassed,9);assert.equal(result.dependencies.mongo.version,'5.0.5');assert.equal(result.dependencies.sqlServer.status,'NotApplicable');
});
test('专项SQLServer需明确选择，不能从残留连接偷偷加入矩阵',()=>{
 const input=matrix(),env=environment();env.MICROI_UPGRADE_SQLSERVER_TEST_CONN='private connection';assert.throws(()=>createMatrixPlan(input,env),/未选择/u);
 input.dependencies.sqlServer={version:'16.0.4210.1',explicitlyRequested:true};const plan=createMatrixPlan(input,env);assert.equal(plan.fullFilter,'Category=FullStack');assert.throws(()=>validateMatrixResults({...plan,sourceHead:'a'.repeat(40)},outcomes(),storage()),/SQL Server.*零用例/u);
});
test('缺少真实版本、远端夹具、官方业务租户、串号或重复双节点一律拒绝',()=>{
 for(const mutate of [m=>{delete m.dependencies.mongo.version},m=>{m.fixture.osClient='demo'},m=>{m.fixture.peerApiBase=m.fixture.apiBase},m=>{m.fixture.apiBase='https://api.example.com/'},m=>{m.dependencies.sqlServer={version:'16.0.1'}}]){const m=matrix();mutate(m);assert.throws(()=>createMatrixPlan(m,environment()));}
 assert.throws(()=>createMatrixPlan(matrix(),{...environment(),MICROI_TEST_MONGO_CURRENT_VERSION:'7.0.41'}),/Mongo/u);
 assert.throws(()=>createMatrixPlan(matrix(),{...environment(),MICROI_TEST_OSCLIENT:'another'}),/夹具/u);
 assert.throws(()=>createMatrixPlan(matrix(),{...environment(),MICROI_TEST_MONGO_LEGACY:'mongodb://localhost:27018'}),/额外 Mongo/u);
});
test('所选失败、取消、零用例和计数掩盖跳过都不能成为Full成功',()=>{
 for(const outcome of ['Failed','NotExecuted','Aborted','Pending']){const value=outcomes();value.full.tests[0].outcome=outcome;assert.throws(()=>validateMatrixResults(frozen(),value,storage()));}
 const zero=outcomes();zero.full=suite([]);assert.throws(()=>validateMatrixResults(frozen(),zero,storage()));
 const mixed=outcomes();mixed.full=suite(fullNames.filter(name=>!name.includes('previousSecret')));assert.throws(()=>validateMatrixResults(frozen(),mixed,storage()),/MySQL/u);
 const foreign=outcomes();foreign.full=suite([...fullNames,'SqlServerIntegration.RealSqlServer']);assert.throws(()=>validateMatrixResults(frozen(),foreign,storage()),/未选择/u);
});
test('实际存储字节闭环和清理证据必须匹配当前候选与主子夹具',()=>{
 for(const mutate of [p=>{delete p.apiProbe},p=>{p.apiProbe.currentApiAndHdfsPlugin=false},p=>{p.objectProbe.objects[0].apiReadGet=0},p=>{p.sourceHead='c'.repeat(40)},p=>{p.actualProvider='MinIO'},p=>{p.objectProbe.cleanup[0].signedHeadAfterCleanup=200},p=>{p.objectProbe.objects[1].anonymousGet=200},p=>{p.objectProbe.objects[0].tenant='demo'},p=>{p.objectProbe.objects[0].sha256=''},p=>{p.observedAt='2026-10-15T00:00:00Z'}]){const value=storage();mutate(value);assert.throws(()=>validateMatrixResults(frozen(),outcomes(),value));}
});
test('正式矩阵CLI冻结原始字节和HEAD，独立回读拒绝漂移且不输出凭据',()=>{
 const root=fileURLToPath(new URL('../../../',import.meta.url)),directory=fs.mkdtempSync(path.join(root,'.tmp','matrix cli '));
 const tool=fileURLToPath(new URL('./release-test-matrix.mjs',import.meta.url));
 const file=path.join(directory,'matrix.json'),receipt=path.join(directory,'frozen.json'),evidence=path.join(directory,'storage.json'),results=path.join(directory,'outcomes.json'),accepted=path.join(directory,'accepted.json');
 const env={...process.env,...environment(),MICROI_UPGRADE_SQLSERVER_TEST_CONN:'',MICROI_TEST_MONGO_LEGACY:'',MICROI_TEST_MONGO_LEGACY_VERSION:'',MICROI_TEST_RUNTIME_BUILD_FILE:'',MICROI_TEST_STORAGE_RECEIPT:evidence,MICROI_TEST_TOKEN:'fixture-secret-token'};
 try{
  fs.writeFileSync(file,JSON.stringify(matrix()));
  const frozenRun=spawnSync(process.execPath,[tool,'freeze',file,receipt],{env,encoding:'utf8',windowsHide:true});assert.ifError(frozenRun.error);assert.equal(frozenRun.status,0,frozenRun.stderr);
  const plan=JSON.parse(fs.readFileSync(receipt));assert.match(plan.sourceHead,/^[a-f0-9]{40}$/);assert.match(plan.matrixSha256,/^[a-f0-9]{64}$/);
  fs.writeFileSync(evidence,JSON.stringify({...storage(),sourceHead:plan.sourceHead}));
  // 这是结果解析器的离线夹具；正式 Full 的文件由真实 dotnet/Playwright 生成。
  const fixture=outcomes(),escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  for(const [key,name]of [['quick','microi-quick.trx'],['full','microi-full-stack.trx']]){
   const value=fixture[key],xml=`<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Results>${value.tests.map(row=>`<UnitTestResult testName="${escape(row.testName)}" outcome="${row.outcome}"/>`).join('')}</Results><ResultSummary outcome="Completed"><Counters ${Object.entries(value.counters).map(([key,count])=>`${key}="${count}"`).join(' ')}/></ResultSummary></TestRun>`;
   fs.writeFileSync(path.join(directory,name),xml);
  }
  fs.writeFileSync(path.join(directory,'search-select-label-geometry.json'),JSON.stringify({stats:fixture.geometry.stats,suites:[{specs:fixture.geometry.caseTitles.map(title=>({title}))}]}));
  const reader=fileURLToPath(new URL('./read-release-matrix-trx.ps1',import.meta.url));
  const projected=spawnSync('pwsh',['-NoProfile','-File',reader,'-ResultsDirectory',directory,'-OutputFile',results],{encoding:'utf8',windowsHide:true});assert.ifError(projected.error);assert.equal(projected.status,0,projected.stderr);
  const run=spawnSync(process.execPath,[tool,'verify',receipt,results,accepted],{env,encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(fs.readFileSync(accepted)).accepted,true);
  assert.equal(fs.readFileSync(receipt,'utf8').includes(env.MICROI_TEST_TOKEN),false);assert.equal((run.stdout+run.stderr).includes(env.MICROI_TEST_TOKEN),false);
  const forged=JSON.parse(fs.readFileSync(results));forged.full.tests[0].testName='forged passed case';fs.writeFileSync(results,JSON.stringify(forged));
  const forgedRun=spawnSync(process.execPath,[tool,'verify',receipt,results,path.join(directory,'forged.json')],{env,encoding:'utf8',windowsHide:true});assert.notEqual(forgedRun.status,0);assert.match(forgedRun.stderr,/权威 TRX/u);
  fs.appendFileSync(file,'\n');const changed=spawnSync(process.execPath,[tool,'verify',receipt,results,path.join(directory,'drift.json')],{env,encoding:'utf8',windowsHide:true});assert.notEqual(changed.status,0);assert.equal(fs.existsSync(path.join(directory,'drift.json')),false);
 }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(root,'.tmp')+path.sep));fs.rmSync(directory,{recursive:true,force:true});}
});
