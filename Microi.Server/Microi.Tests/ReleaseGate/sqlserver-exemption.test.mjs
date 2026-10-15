import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SQL_SERVER_CASES,MYSQL_COMPANION_CASES,SQL_SERVER_SOURCE_FILES,currentSqlServerSource,readSqlServerAuthorization,validateSqlServerAuthorization,validateSqlServerOutcomes} from './sqlserver-exemption.mjs';

const current={sourceHead:'a'.repeat(40),sourceFiles:Object.fromEntries(SQL_SERVER_SOURCE_FILES.map(name=>[name,'b'.repeat(64)]))};
const evidence={source:'explicit-human-message',scope:'SQLServer integration only',
  threadId:'00000000-0000-4000-8000-000000000001',turnId:'00000000-0000-4000-8000-000000000002',
  messageId:'00000000-0000-4000-8000-000000000003',reason:'用户明确只允许 SQL Server 集成用例未执行'};
function receipt(){return {schemaVersion:1,kind:'microi-sqlserver-integration-exemption',issuedAt:'2026-10-15T00:00:00.000Z',
  authorization:{...evidence},sourceHead:current.sourceHead,sourceFiles:{...current.sourceFiles},caseNames:[...SQL_SERVER_CASES]};}
function suite(tests){return {tests,counters:{total:tests.length,executed:tests.filter(x=>x.outcome==='Passed').length,passed:tests.filter(x=>x.outcome==='Passed').length,
  notExecuted:tests.filter(x=>x.outcome==='NotExecuted').length,failed:0,error:0,timeout:0,aborted:0}};}
function outcomes(){return {quick:suite([{testName:'existingQuick',outcome:'Passed'}]),
  full:suite([...Array.from({length:38},(_,i)=>({testName:'existingFull-'+i,outcome:'Passed'})),
    ...MYSQL_COMPANION_CASES.map(testName=>({testName,outcome:'Passed'})),
    ...SQL_SERVER_CASES.map(testName=>({testName,outcome:'NotExecuted'}))])};}
const authorized=()=>validateSqlServerAuthorization(receipt(),current);

test('SQL Server exception is explicit, source bound and exactly24 data cases',()=>{
  const value=authorized();assert.equal(value.exemptedCaseCount,24);assert.equal(new Set(SQL_SERVER_CASES).size,24);
  assert.equal(SQL_SERVER_CASES.filter(name=>name.includes('StartupDependencySqlServerIntegrationTests.')).length,12);
  assert.equal(SQL_SERVER_CASES.filter(name=>name.includes('TenantJwtPersistenceIntegrationTests.')).length,4);
  assert.equal(SQL_SERVER_CASES.some(name=>name.includes('providerName: "MySql"')),false);
});
for(const [name,change]of [
  ['missing authorization',value=>delete value.authorization],
  ['machine assertion instead of human message',value=>value.authorization.source='automatic'],
  ['broader dependency exception',value=>value.authorization.scope='all databases'],
  ['missing human evidence',value=>delete value.authorization.messageId],
  ['missing reason',value=>value.authorization.reason=' '],
  ['stale HEAD',value=>value.sourceHead='c'.repeat(40)],
  ['changed test source',value=>value.sourceFiles[SQL_SERVER_SOURCE_FILES[0]]='c'.repeat(64)],
  ['omitted source',value=>delete value.sourceFiles[SQL_SERVER_SOURCE_FILES[0]]],
  ['extra source masquerading as same contract',value=>value.sourceFiles.extra='b'.repeat(64)],
  ['missing SQL data row',value=>value.caseNames.pop()],
  ['duplicate SQL row',value=>value.caseNames[0]=value.caseNames[1]],
  ['Mongo substituted for SQL',value=>value.caseNames[0]='Microi.Tests.Common.MongoLegacyCompatibilityTests.Fake'],
])test('SQL Server authorization rejects '+name,()=>{const value=receipt();change(value);assert.throws(()=>validateSqlServerAuthorization(value,current));});

test('only exact24 SQL rows are N/A and all remaining full cases execute',()=>{
  const value=validateSqlServerOutcomes(outcomes(),authorized());
  assert.equal(value.accepted,true);assert.equal(value.originalZeroSkipFull,false);
  assert.equal(value.quickPassed,1);assert.equal(value.fullStackPassed,44);assert.equal(value.sqlServerNotExecuted,24);
});
test('synthetic authorized outcomes accept VSTest zero skip counters with exact executed rows',()=>{
  // 这是明确的合成 24 行契约夹具，不把六行 SDK 子集冒充授权 Full。
  const value=outcomes();value.full.counters.notExecuted=0;
  const result=validateSqlServerOutcomes(value,authorized());
  assert.equal(result.sqlServerNotExecuted,24);assert.equal(result.mysqlCompanionPassed,6);
});
for(const [name,change]of [
  ['too few executed',value=>value.full.counters.executed--],
  ['too many executed',value=>value.full.counters.executed++],
  ['missing executed',value=>delete value.full.counters.executed],
  ['partial nonzero skip counter',value=>value.full.counters.notExecuted=1],
  ['excess nonzero skip counter',value=>value.full.counters.notExecuted=25],
])test('SQL exception rejects '+name,()=>{
  const value=outcomes();change(value);assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/不一致/);
});
test('VSTest zero skip counters do not authorize unknown skipped rows',()=>{
  const value=outcomes();value.full.counters.notExecuted=0;value.full.tests.at(-1).testName='Unknown.UnexecutedCase';
  assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/24个/);
});
test('SQL exception cannot silently skip a MySQL row',()=>{
  const value=outcomes();value.full.tests.at(-1).testName='Dos.Common.Tests.FieldOptionTreePageIntegrationTests.LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter(provider: "MySql")';
  assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/24个/);
});
test('SQL exception rejects omission of a companion MySQL case even with24 valid SQL skips',()=>{
  const value=outcomes();value.full.tests=value.full.tests.filter(row=>row.testName!==MYSQL_COMPANION_CASES[0]);
  value.full.counters.total--;value.full.counters.passed--;value.full.counters.executed--;
  assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/6个混合 MySQL/);
});
test('SQL exception rejects a missing SQL row or a broader24-count shortcut',()=>{
  const value=outcomes();value.full.tests.pop();value.full.counters.total--;value.full.counters.notExecuted--;
  assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/24个/);
});
test('SQL exception never accepts failed or mismatched TRX results',()=>{
  const failed=outcomes();failed.full.tests[0].outcome='Failed';failed.full.counters.failed=1;
  assert.throws(()=>validateSqlServerOutcomes(failed,authorized()),/失败/);
  const mismatch=outcomes();mismatch.full.counters.passed++;
  assert.throws(()=>validateSqlServerOutcomes(mismatch,authorized()),/不一致/);
});
test('SQL exception does not permit any Quick skip',()=>{
  const value=outcomes();value.quick=suite([{testName:SQL_SERVER_CASES[0],outcome:'NotExecuted'}]);
  assert.throws(()=>validateSqlServerOutcomes(value,authorized()),/Quick/);
});
test('default strict path cannot call exception result acceptance without authorization',()=>{
  assert.throws(()=>validateSqlServerOutcomes(outcomes(),undefined),/先验证/);
});

test('actual receipt IO and oneclick verifier reject changed bytes and a stale source HEAD',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),temporary=path.join(root,'.tmp');
  fs.mkdirSync(temporary,{recursive:true});
  const directory=fs.mkdtempSync(path.join(temporary,'sqlserver-exemption-regression-'));
  try{
    const binding=currentSqlServerSource(root),value={...receipt(),...binding};
    const file=path.join(directory,'fictional-explicit-test-receipt.json');
    fs.writeFileSync(file,JSON.stringify(value));
    const fingerprint=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(readSqlServerAuthorization(file,fingerprint(),root).exemptedCaseCount,24);
    assert.throws(()=>readSqlServerAuthorization(file,'0'.repeat(64),root),/SHA-256/);
    // 仅测试明确传入的本轮临时回执；测试不会设置发行参数、授权实际运行或生成默认可发现的豁免。
    const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./sqlserver-exemption.mjs',import.meta.url)),
      'verify-authorization',file,fingerprint(),root],{encoding:'utf8',windowsHide:true,timeout:10000});
    assert.ifError(cli.error);assert.equal(cli.status,0,cli.stderr);
    assert.equal(JSON.parse(cli.stdout).exemptedCaseCount,24);
    value.sourceHead='0'.repeat(40);fs.writeFileSync(file,JSON.stringify(value));
    assert.throws(()=>readSqlServerAuthorization(file,fingerprint(),root),/HEAD/);
  }finally{
    assert.equal(fs.realpathSync(directory),path.resolve(directory));
    assert.equal(path.dirname(directory),temporary);
    fs.rmSync(directory,{recursive:true});
  }
});

test('actual TRX readback rejects forged JSON, foreign results, aborted summaries and replacement links',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),temporary=path.join(root,'.tmp');
  fs.mkdirSync(temporary,{recursive:true});
  const directory=fs.mkdtempSync(path.join(temporary,'sqlserver-trx-regression-'));
  const fingerprint=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const xmlEscape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const xml=(value,summary='Completed')=>'<?xml version="1.0" encoding="utf-8"?>'+
    '<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Results>'+
    value.tests.map(row=>'<UnitTestResult testName="'+xmlEscape(row.testName)+'" outcome="'+row.outcome+'"/>').join('')+
    '</Results><ResultSummary outcome="'+summary+'"><Counters '+Object.entries(value.counters)
      .map(([key,value])=>key+'="'+value+'"').join(' ')+'/></ResultSummary></TestRun>';
  try{
    const binding=currentSqlServerSource(root),receiptFile=path.join(directory,'fictional-explicit-test-receipt.json');
    fs.writeFileSync(receiptFile,JSON.stringify({...receipt(),...binding}));
    const outcomesFile=path.join(directory,'sqlserver-exemption-outcomes.json'),resultFile=path.join(directory,'sqlserver-exemption-result.json');
    const cli=command=>spawnSync(process.execPath,[fileURLToPath(new URL('./sqlserver-exemption.mjs',import.meta.url)),command,
      receiptFile,fingerprint(receiptFile),root,outcomesFile,resultFile],{encoding:'utf8',windowsHide:true,timeout:30000});
    const write=(changed={},summary='Completed')=>{
      const value=outcomes();
      for(const [name,basename]of [['quick','microi-quick.trx'],['full','microi-full-stack.trx']]){
        const file=path.join(directory,basename);
        fs.writeFileSync(file,xml(changed[name]??value[name],summary));
        Object.assign(value[name],{trxFile:file,trxSha256:fingerprint(file),summaryOutcome:summary});
      }
      fs.writeFileSync(outcomesFile,JSON.stringify(value));return value;
    };
    write();let actual=cli('verify-outcomes');assert.ifError(actual.error);assert.equal(actual.status,0,actual.stderr);
    actual=cli('verify-result');assert.ifError(actual.error);assert.equal(actual.status,0,actual.stderr);
    assert.equal(JSON.parse(fs.readFileSync(resultFile,'utf8')).sqlServerNotExecuted,24);
    actual=cli('verify-outcomes');assert.notEqual(actual.status,0);assert.match(actual.stderr,/EEXIST/);
    fs.unlinkSync(resultFile);

    // 原 TRX 真实失败，JSON 伪造通过且保留真实原文指纹，也必须拒绝。
    const failed=outcomes().full;failed.tests[0].outcome='Failed';failed.counters.failed=1;failed.counters.passed--;
    write({full:failed});actual=cli('verify-outcomes');assert.notEqual(actual.status,0);assert.match(actual.stderr,/权威 TRX 不一致/);
    assert.equal(fs.existsSync(resultFile),false);
    fs.writeFileSync(resultFile,'{}');actual=cli('verify-result');assert.notEqual(actual.status,0);assert.match(actual.stderr,/权威 TRX 不一致/);
    fs.unlinkSync(resultFile);

    write({},'Aborted');actual=cli('verify-outcomes');assert.notEqual(actual.status,0);assert.match(actual.stderr,/TRX 汇总/);
    const foreign=path.join(directory,'previous-run');fs.mkdirSync(foreign);
    const value=write(),oldFile=path.join(foreign,'microi-full-stack.trx');
    fs.copyFileSync(value.full.trxFile,oldFile);value.full.trxFile=oldFile;fs.writeFileSync(outcomesFile,JSON.stringify(value));
    actual=cli('verify-outcomes');assert.notEqual(actual.status,0);assert.match(actual.stderr,/本轮规范/);

    write();const alias=path.join(directory,'linked-results');fs.symlinkSync(foreign,alias,'junction');
    fs.copyFileSync(outcomesFile,path.join(foreign,'sqlserver-exemption-outcomes.json'));
    const linked=spawnSync(process.execPath,[fileURLToPath(new URL('./sqlserver-exemption.mjs',import.meta.url)),
      'verify-outcomes',receiptFile,fingerprint(receiptFile),root,path.join(alias,'sqlserver-exemption-outcomes.json'),
      path.join(alias,'sqlserver-exemption-result.json')],{encoding:'utf8',windowsHide:true,timeout:10000});
    assert.notEqual(linked.status,0);assert.match(linked.stderr,/物理/);
    fs.unlinkSync(alias);

    write();const fullFile=path.join(directory,'microi-full-stack.trx');
    fs.writeFileSync(fullFile,'<!DOCTYPE TestRun [<!ENTITY attack SYSTEM "file:///unavailable">]>'+xml(outcomes().full));
    const malformed=JSON.parse(fs.readFileSync(outcomesFile,'utf8'));malformed.full.trxSha256=fingerprint(fullFile);
    fs.writeFileSync(outcomesFile,JSON.stringify(malformed));actual=cli('verify-outcomes');assert.notEqual(actual.status,0);
    assert.equal(fs.existsSync(resultFile),false);
  }finally{
    assert.equal(fs.realpathSync(directory),path.resolve(directory));assert.equal(path.dirname(directory),temporary);
    fs.rmSync(directory,{recursive:true});
  }
});

test('real mixed database theories keep all6 MySQL rows separate from SQL Server conditions',()=>{
  let mysql=0,sqlServer=0;
  for(const name of ['FieldOptionTreePageIntegrationTests','RoleLimitActiveSnapshotTests','TenantJwtPersistenceIntegrationTests']){
    const source=fs.readFileSync(new URL('../Common/'+name+'.cs',import.meta.url),'utf8');
    assert.doesNotMatch(source,/\[Theory\(Skip\s*=/);
    const provider=name==='FieldOptionTreePageIntegrationTests'?'provider':'providerName';
    // 条件在测试入口求值，既保留六个 MySQL 行，也不改变授权 SQL Server 行名称。
    assert.match(source,new RegExp('Assert\\.SkipUnless\\('+provider+' == "MySql" \\? HasMySqlFixture : HasSqlServerFixture,'));
    assert.match(source,new RegExp(provider+' == "MySql" \\? "Requires an isolated MySQL fixture" : "Requires an isolated SQL Server fixture"'));
    assert.ok(source.indexOf('Assert.SkipUnless(')<source.indexOf('Environment.GetEnvironmentVariable(',source.indexOf('Assert.SkipUnless(')));
    for(const row of source.matchAll(/\[InlineData\("(MySql|SqlServer)"[^\r\n]*\]/g)){
      assert.doesNotMatch(row[0],/\bSkip(?:Unless|When)?\s*=/);
      if(row[1]==='MySql')mysql++;else sqlServer++;
    }
  }
  assert.equal(mysql,6);assert.equal(sqlServer,6);
});

test('real SQL Server structure theories enumerate14 individual unexecuted data cases',()=>{
  for(const [name,count,condition]of [['StartupDependencySqlServerIntegrationTests',12,'HasSqlServerTestConnection'],['SqlServerMenuCapacityTests',2,'HasSqlServerFixture']]){
    const source=fs.readFileSync(new URL('../Common/'+name+'.cs',import.meta.url),'utf8');
    assert.doesNotMatch(source,/\[Theory\(Skip\s*=/);
    assert.equal([...source.matchAll(new RegExp('InlineData[^\\r\\n]+SkipUnless = nameof\\('+condition+'\\)','g'))].length,count);
  }
});

test('shared Mongo memory fixture uses parent-owned nonces and cleanup after child exit',()=>{
  const child=fs.readFileSync(new URL('../Fixtures/MemoryDiagnosticsNode/Program.cs',import.meta.url),'utf8');
  const parent=fs.readFileSync(new URL('../MemoryDiagnostics/MemoryDiagnosticsProcessTests.cs',import.meta.url),'utf8');
  assert.doesNotMatch(child,/"(?:memorytesta|memorytestb|memoryrepositorytest)"/);
  assert.match(child,/FixtureMongoTenant\(args\[2\]\)/);assert.match(child,/FixtureMongoTenant\(args\[3\]\)/);
  const serve=parent.slice(parent.indexOf('public async Task HttpHost_ExposesTraceAndMemoryContracts()'),parent.indexOf('public void MongoFixtureDatabaseNamesRejectFixedAndForeignTenants()'));
  assert.match(serve,/StartFixture\("serve", evidence, tenantA, tenantB\)/);
  assert.ok(serve.lastIndexOf('await StopAsync(host)')<serve.lastIndexOf('await CleanupMongoFixtureAsync(tenantA, tenantB)'));
  const cleanup=parent.slice(parent.indexOf('private static async Task CleanupMongoFixtureAsync'),parent.indexOf('private static string NewEvidenceDirectory'));
  assert.match(cleanup,/tenants\.Select\(OwnedMongoDatabaseName\)/);
  assert.match(cleanup,/new CancellationTokenSource\(TimeSpan\.FromSeconds\(15\)\)/);
  assert.match(cleanup,/DropDatabaseAsync\(database, cleanup\.Token\)/);
  assert.doesNotMatch(cleanup,/TestContext\.Current\.CancellationToken|ListDatabase/);
});
