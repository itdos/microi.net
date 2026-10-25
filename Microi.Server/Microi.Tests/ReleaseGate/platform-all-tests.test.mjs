import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {discoverBrowserTests,readLocalTestDefaults,allPlatformPreflight,validateBrowserReport,runAllBrowserTests} from './platform-all-tests.mjs';

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
const environment={MICROI_TEST_MATRIX_FILE:'existing-matrix.json',MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE:'YES',PW_TEST_PASSWORD:'fixture-password'};
function report(files){return {config:{rootDir:path.dirname(files[0])},stats:{expected:files.length,unexpected:0,skipped:0,flaky:0},errors:[],suites:files.map(file=>({file,specs:[{file,ok:true,tests:[{status:'expected',results:[{status:'passed'}]}]}]}))};}

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
