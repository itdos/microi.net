import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createMatrixPlan, validateMatrixResults,validateStagedStorageProof,verifyMatrixDesktopInputs} from './release-test-matrix.mjs';
import {snapshotDesktopInputs} from '../../tools/release-desktop-inputs.mjs';
import {createHash} from 'node:crypto';
import {preserveHdfsEvidence} from './staged-full-runtime.mjs';
import os from 'node:os';

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
