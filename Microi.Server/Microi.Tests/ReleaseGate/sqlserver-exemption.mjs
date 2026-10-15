import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// 仅用于本次候选的显式 SQL Server 集成例外。默认 Full 仍要求零跳过，调用方不能自选其它豁免用例。
export const SQL_SERVER_CASES = [
  "Dos.Common.Tests.FieldOptionTreePageIntegrationTests.LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter(provider: \"SqlServer\")",
  "Microi.Tests.Common.DatabasePoolRecoveryIntegrationTests.RealSqlServer_RotationRecoversPool_AndPreservesBorrowedTransaction",
  "Microi.Tests.Common.FormEngineSqlServerWriteTests.CurrentFileIndex_RepairsNullIdentitySemantics_AndPreservesVersionUniqueness",
  "Microi.Tests.Common.RoleLimitActiveSnapshotTests.RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls(providerName: \"SqlServer\")",
  "Microi.Tests.Common.SqlServerMenuCapacityTests.LegacyMenuMigrationWidensBeforeBackfillAndKeepsConstraintsAcrossRestart(provider: SqlServer)",
  "Microi.Tests.Common.SqlServerMenuCapacityTests.LegacyMenuMigrationWidensBeforeBackfillAndKeepsConstraintsAcrossRestart(provider: SqlServer9)",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"AS CONVERT(nvarchar(50), 'v0.0.0')\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"char(3)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"char(50)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"int\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nchar(3)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nchar(50)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nvarchar(1) COLLATE Latin1_General_100_BIN2 NOT NU\"···)",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nvarchar(1) NOT NULL\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nvarchar(1)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"nvarchar(50)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: \"varchar(3)\")",
  "Microi.Tests.Common.StartupDependencySqlServerIntegrationTests.ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(versionType: null)",
  "Microi.Tests.Common.StartupPhysicalContractTests.LegacyLoginSchema_IsRepairedRegardlessOfRecordedVersion_AndPreservesRows",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"SqlServer\", previousSecret: \" \\t \")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"SqlServer\", previousSecret: \"\")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"SqlServer\", previousSecret: \"short\")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"SqlServer\", previousSecret: null)",
  "Microi.Tests.ORM.Compatibility.SqlServerColumnDescriptionIntegrationTests.ChangeColumn_AddsMissingDescription_UpdatesAndRenamesWithoutLosingData"
];
export const MYSQL_COMPANION_CASES = [
  "Dos.Common.Tests.FieldOptionTreePageIntegrationTests.LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter(provider: \"MySql\")",
  "Microi.Tests.Common.RoleLimitActiveSnapshotTests.RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls(providerName: \"MySql\")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"MySql\", previousSecret: \" \\t \")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"MySql\", previousSecret: \"\")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"MySql\", previousSecret: \"short\")",
  "Microi.Tests.Common.TenantJwtPersistenceIntegrationTests.NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(providerName: \"MySql\", previousSecret: null)"
];
export const SQL_SERVER_SOURCE_FILES = [
  'Microi.Server/Microi.Tests/ORM/Compatibility/SqlServerColumnDescriptionIntegrationTests.cs',
  'Microi.Server/Microi.Tests/Common/DatabasePoolRecoveryIntegrationTests.cs',
  'Microi.Server/Microi.Tests/Common/FieldOptionTreePageIntegrationTests.cs',
  'Microi.Server/Microi.Tests/Common/FormEngineSqlServerWriteTests.cs',
  'Microi.Server/Microi.Tests/Common/RoleLimitActiveSnapshotTests.cs',
  'Microi.Server/Microi.Tests/Common/SqlServerMenuCapacityTests.cs',
  'Microi.Server/Microi.Tests/Common/StartupDependencySqlServerIntegrationTests.cs',
  'Microi.Server/Microi.Tests/Common/StartupPhysicalContractTests.cs',
  'Microi.Server/Microi.Tests/Common/TenantJwtPersistenceIntegrationTests.cs',
  'Microi.Server/Microi.Tests/run-tests.ps1',
  'Microi.Server/Microi.Tests/ReleaseGate/sqlserver-exemption.mjs',
  'Microi.Server/Microi.Tests/ReleaseGate/sqlserver-exemption.test.mjs',
  'Microi.Server/Microi.Tests/ReleaseGate/read-sqlserver-trx.ps1',
  'Microi.Server/Microi.Tests/ReleaseGate/release-gate.test.mjs',
  'Microi一键编译发布.sh',
];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(condition,message)=>{if(!condition)throw Error(message);};
const canonicalCases=names=>JSON.stringify([...names].sort());
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

export function currentSqlServerSource(root){
  root=path.resolve(root);
  check(fs.realpathSync(root)===root,'SQL Server 例外必须绑定真实物理候选');
  const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
  check(/^[a-f0-9]{40}$/.test(sourceHead),'候选 HEAD 无效');
  const sourceFiles={};
  for(const relative of SQL_SERVER_SOURCE_FILES){
    const file=path.join(root,relative),stat=fs.lstatSync(file);
    check(stat.isFile()&&!stat.isSymbolicLink()&&fs.realpathSync(file)===file,'SQL Server 例外源码不能通过链接替换');
    sourceFiles[relative]=digest(fs.readFileSync(file));
  }
  return {sourceHead,sourceFiles};
}

export function validateSqlServerAuthorization(receipt,current){
  check(receipt?.schemaVersion===1&&receipt.kind==='microi-sqlserver-integration-exemption','SQL Server 授权回执类型无效');
  const authorization=receipt.authorization;
  check(authorization?.source==='explicit-human-message'&&authorization.scope==='SQLServer integration only',
    '只有明确的人类 SQL Server 专项授权可以启用例外');
  check(['threadId','turnId','messageId'].every(key=>uuid(authorization[key]))
    &&typeof authorization.reason==='string'&&authorization.reason.trim().length>0,'授权证据或原因缺失');
  check(typeof receipt.issuedAt==='string'&&Number.isFinite(Date.parse(receipt.issuedAt)),'授权时间无效');
  check(receipt.sourceHead===current.sourceHead&&/^[a-f0-9]{40}$/.test(receipt.sourceHead),'SQL Server 授权不属于当前 HEAD');
  check(receipt.sourceFiles&&Object.keys(receipt.sourceFiles).length===SQL_SERVER_SOURCE_FILES.length
    &&SQL_SERVER_SOURCE_FILES.every(file=>hex64(receipt.sourceFiles[file])&&receipt.sourceFiles[file]===current.sourceFiles[file]),
    'SQL Server 授权源码清单缺失或漂移');
  check(Array.isArray(receipt.caseNames)&&receipt.caseNames.length===24&&new Set(receipt.caseNames).size===24
    &&canonicalCases(receipt.caseNames)===canonicalCases(SQL_SERVER_CASES),'SQL Server 授权必须精确覆盖既定24个数据用例');
  return {sourceHead:current.sourceHead,authorization,exemptedCaseCount:24};
}

export function readSqlServerAuthorization(file,sha256,root){
  check(path.isAbsolute(file)&&hex64(sha256),'必须显式传入授权回执绝对路径与 SHA-256');
  const stat=fs.lstatSync(file);
  check(stat.isFile()&&!stat.isSymbolicLink()&&fs.realpathSync(file)===path.resolve(file),'授权回执不能通过链接替换');
  const bytes=fs.readFileSync(file);
  check(digest(bytes)===sha256,'SQL Server 授权回执 SHA-256 不匹配');
  const receipt=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  return {...validateSqlServerAuthorization(receipt,currentSqlServerSource(root)),receiptFile:file,receiptSha256:sha256};
}

function checkedSuite(suite,name){
  check(suite&&Array.isArray(suite.tests)&&suite.tests.length>0&&suite.counters,'测试结果不能为空：'+name);
  const rows=suite.tests,counters=suite.counters;
  check(rows.every(row=>typeof row.testName==='string'&&['Passed','NotExecuted'].includes(row.outcome)),
    '测试失败、取消或未知结果不能被 SQL Server 例外接受：'+name);
  const skipped=rows.filter(row=>row.outcome==='NotExecuted'),passed=rows.length-skipped.length;
  check(Number(counters.total)===rows.length&&Number(counters.passed)===passed&&Number(counters.notExecuted)===skipped.length,
    'TRX 用例明细与统计不一致：'+name);
  for(const key of ['failed','error','timeout','aborted','inconclusive','passedButRunAborted','notRunnable','disconnected','inProgress','pending'])
    check(Number(counters[key]??0)===0,'SQL Server 例外不能接受异常统计：'+name+'/'+key);
  return {passed,skipped};
}

export function validateSqlServerOutcomes(outcomes,authorization){
  check(authorization?.exemptedCaseCount===24,'必须先验证 SQL Server 授权');
  const quick=checkedSuite(outcomes.quick,'Quick'),full=checkedSuite(outcomes.full,'FullStack');
  check(quick.skipped.length===0,'SQL Server 例外不能跳过 Quick 测试');
  check(full.skipped.length===24&&canonicalCases(full.skipped.map(row=>row.testName))===canonicalCases(SQL_SERVER_CASES),
    '只能未执行明确授权的24个 SQL Server 数据用例，不能夹带 MySQL、Mongo 或未知用例');
  check(full.passed>0,'FullStack 必须实际执行其余测试');
  check(MYSQL_COMPANION_CASES.every(name=>outcomes.full.tests.some(row=>row.testName===name&&row.outcome==='Passed')),
    'SQL Server 例外必须保留并通过全部6个混合 MySQL 数据用例');
  return {accepted:true,profile:'FullWithSqlServerExemption',originalZeroSkipFull:false,
    quickPassed:quick.passed,fullStackPassed:full.passed,sqlServerNotExecuted:24,
    mysqlCompanionPassed:6,
    sqlServerCaseNames:full.skipped.map(row=>row.testName),authorization:authorization.authorization,
    sourceHead:authorization.sourceHead,authorizationReceipt:authorization.receiptFile,
    authorizationReceiptSha256:authorization.receiptSha256};
}

function physicalFile(file,message){
  check(typeof file==='string'&&path.isAbsolute(file),message);
  const stat=fs.lstatSync(file);
  check(stat.isFile()&&!stat.isSymbolicLink()&&fs.realpathSync(file)===path.resolve(file),message);
}
const sortedJson=value=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)
  ?Object.fromEntries(Object.entries(entry).sort(([left],[right])=>left.localeCompare(right))):entry);

function readOutcomes(file,root,resultFile,readingResult){
  physicalFile(file,'例外明细必须是本轮物理文件');
  const directory=path.dirname(file);
  check(fs.realpathSync(directory)===path.resolve(directory)&&path.basename(file)==='sqlserver-exemption-outcomes.json',
    '例外明细必须位于本轮物理结果目录');
  check(path.isAbsolute(resultFile)&&path.resolve(resultFile)===path.join(directory,'sqlserver-exemption-result.json'),
    '例外结果必须属于同一本轮结果目录');
  if(readingResult)physicalFile(resultFile,'例外结果不能通过链接替换');
  const bytes=fs.readFileSync(file),value=JSON.parse(bytes.toString('utf8'));
  check(Object.keys(value).sort().join(',')==='full,quick','例外明细只能包含本轮两组结果');
  for(const [suite,basename]of [['quick','microi-quick.trx'],['full','microi-full-stack.trx']]){
    const expectedTrx=path.join(directory,basename);
    check(value[suite]?.trxFile===expectedTrx&&hex64(value[suite]?.trxSha256),'TRX 必须来自本轮规范结果文件');
    physicalFile(expectedTrx,'TRX 必须是同一本轮物理结果文件');
    check(digest(fs.readFileSync(expectedTrx))===value[suite].trxSha256,'TRX 产物已漂移');
    // 独立回读重新解析原始 XML，禁止仅修改 JSON 明细和统计后冒充通过。
    const parser=path.join(root,'Microi.Server/Microi.Tests/ReleaseGate/read-sqlserver-trx.ps1');
    const arguments_=['-NoProfile','-File',parser,'-TrxFile',expectedTrx];
    let output;
    try{output=execFileSync('pwsh',arguments_,{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:32*1024*1024});}
    catch(error){
      if(process.platform!=='win32'||error.code!=='ENOENT')throw error;
      output=execFileSync('powershell.exe',arguments_,{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:32*1024*1024});
    }
    const projection=JSON.parse(output.replace(/^\uFEFF/,''));
    check(['Completed','Passed'].includes(projection.summaryOutcome),'TRX 汇总失败、取消或未知');
    check(sortedJson(projection)===sortedJson(value[suite]),'例外 JSON 明细与权威 TRX 不一致');
  }
  return {value,sha256:digest(bytes)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,receiptFile,receiptSha256,root,outcomesFile,resultFile]=process.argv.slice(2);
  check(['verify-authorization','verify-outcomes','verify-result'].includes(command),'未知 SQL Server 例外命令');
  check(path.resolve(root,'Microi.Server/Microi.Tests/ReleaseGate/sqlserver-exemption.mjs')===fileURLToPath(import.meta.url),
    'SQL Server 例外执行器必须来自同一候选');
  const authorization=readSqlServerAuthorization(receiptFile,receiptSha256,root);
  if(command==='verify-authorization')console.log(JSON.stringify({...authorization,authorization:undefined}));
  else{
    const outcomes=readOutcomes(outcomesFile,root,resultFile,command==='verify-result'),result=validateSqlServerOutcomes(outcomes.value,authorization);
    const expected={...result,outcomesFile:path.resolve(outcomesFile),outcomesSha256:outcomes.sha256};
    if(command==='verify-outcomes'){
      check(path.isAbsolute(resultFile),'例外结果必须写入本轮绝对路径');
      fs.writeFileSync(resultFile,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});
    }else check(JSON.stringify(JSON.parse(fs.readFileSync(resultFile,'utf8')))===JSON.stringify(expected),'SQL Server 例外结果已漂移');
    console.log(JSON.stringify({accepted:true,sourceHead:result.sourceHead,originalZeroSkipFull:false,
      quickPassed:result.quickPassed,fullStackPassed:result.fullStackPassed,sqlServerNotExecuted:24,resultFile}));
  }
}
