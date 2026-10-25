import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildBrowserFixtureConfig,parseFixtureConnection,prepareBrowserFixtureConfig} from './prepare-browser-fixture.mjs';
import {runAllBrowserTests,discoverBrowserTests} from './platform-all-tests.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const scope={task:'contract-fixture-owner',authorization:'human-test-fixture-scope',databases:['owned_fixture'],mysql:{host:'127.0.0.1',port:16306,user:'fixture',password:'test;quoted'}};
const settings={OsClient:'fixture',OsClientDbType:'MySQL',OsClientDbConn:'Server=127.0.0.1;Port=16306;Database=owned_fixture;User Id=fixture;Password="test;quoted";'};
function scratch(){
 const parent=path.join(root,'.tmp');fs.mkdirSync(parent,{recursive:true});const directory=fs.mkdtempSync(path.join(parent,'browser-fixture-contract-'));
 return {directory,cleanup(){assert.equal(path.dirname(directory),parent);assert.ok(path.basename(directory).startsWith('browser-fixture-contract-'));assert.ok(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true});}};
}
function save(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value),{mode:0o600});return file;}
function existing(directory){const config=save(path.join(directory,'existing.json'),buildBrowserFixtureConfig(scope,settings,'fixture'));return {MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_OSCLIENT:'fixture',MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON:process.execPath,PW_RICHTEXT_FIXTURE_CONFIG:config,MICROI_TEST_UI_FIXTURE_APPSETTINGS:save(path.join(directory,'appsettings.json'),{AppSettings:settings})};}
test('quoted connection delimiters remain intact and duplicate aliases fail closed',()=>{
 assert.equal(parseFixtureConnection(settings.OsClientDbConn).password,'test;quoted');
 assert.throws(()=>parseFixtureConnection(settings.OsClientDbConn+'Uid=other'),/Ambiguous/);
 assert.throws(()=>parseFixtureConnection(settings.OsClientDbConn.replace('127.0.0.1','example.com')),/local/);
});
test('only the selected existing tenant and authorized database/transport can produce a cleanup configuration',()=>{
 assert.equal(buildBrowserFixtureConfig(scope,settings,'fixture').database,'owned_fixture');
 for(const [s,c,t] of [[{...scope,authorization:''},settings,'fixture'],[scope,settings,'other'],[{...scope,databases:['different']},settings,'fixture'],[{...scope,mysql:{...scope.mysql,user:'other'}},settings,'fixture']])assert.throws(()=>buildBrowserFixtureConfig(s,c,t));
});
test('existing private configuration is owner-verified and only its path is returned',()=>{
 const f=scratch();try{
  const env=existing(f.directory),calls=[];
  const result=prepareBrowserFixtureConfig(root,f.directory,env,(exe,args,options)=>{calls.push({exe,args,input:options.input});return {status:0,stdout:options.input?'{"ownerVerified":true}':''};});
  assert.equal(calls.length,4);assert.equal(JSON.parse(calls.at(-1).input).action,'verify');
  assert.equal(result.environment.PW_RICHTEXT_FIXTURE_CONFIG,env.PW_RICHTEXT_FIXTURE_CONFIG);assert.ok(!JSON.stringify(result).includes(scope.mysql.password));assert.equal(result.receipt.createdTenant,false);
 }finally{f.cleanup();}
});
test('private ACL rejection or wrong database owner never yields a runnable fixture binding',()=>{
 const f=scratch();try{
  const env=existing(f.directory);
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env,()=>({status:1,stderr:'private detail'})),/private-input/);
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env,(exe,args,options)=>({status:0,stdout:options.input?'{"ownerVerified":false}':''})),/owner verification/);
  save(env.MICROI_TEST_UI_FIXTURE_APPSETTINGS,{AppSettings:{...settings,OsClientDbConn:settings.OsClientDbConn.replace('owned_fixture','different_database')}});
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env,()=>({status:0,stdout:''})),/outside the authorized/);
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,{...env,MICROI_TEST_ALLOW_WRITES:'NO'}),/authorization/);
 }finally{f.cleanup();}
});
test('existing authorized source creates a private snapshot and verifies ownership without provisioning',()=>{
 const f=scratch();try{
  const env={MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_OSCLIENT:'fixture',MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON:process.execPath,MICROI_TEST_UI_FIXTURE_SCOPE:save(path.join(f.directory,'scope.json'),scope),MICROI_TEST_UI_FIXTURE_APPSETTINGS:save(path.join(f.directory,'appsettings.json'),{AppSettings:settings})},calls=[];
  const result=prepareBrowserFixtureConfig(root,f.directory,env,(exe,args,options)=>{calls.push({exe,args,input:options.input});return {status:0,stdout:options.input?'{"ownerVerified":true}':''};});
  assert.deepEqual(JSON.parse(fs.readFileSync(result.environment.PW_RICHTEXT_FIXTURE_CONFIG)),buildBrowserFixtureConfig(scope,settings,'fixture'));
  assert.equal(calls.filter(call=>call.input).length,1);assert.equal(JSON.parse(calls.find(call=>call.input).input).action,'verify');
  assert.equal(result.receipt.source,'ExistingAuthorizedScope');
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env,()=>({status:0,stdout:''})),/already exists/);
 }finally{f.cleanup();}
});
test('missing or conflicting authorization sources fail before output creation',()=>{
 const f=scratch();try{
  const env=existing(f.directory);delete env.PW_RICHTEXT_FIXTURE_CONFIG;
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env),/no tenant will be created/);
  env.MICROI_TEST_UI_FIXTURE_SCOPE=save(path.join(f.directory,'scope.json'),{...scope,databases:['other']});env.MICROI_TEST_UI_FIXTURE_APPSETTINGS=save(path.join(f.directory,'appsettings.json'),{AppSettings:settings});
  assert.throws(()=>prepareBrowserFixtureConfig(root,f.directory,env,()=>({status:0,stdout:''})),/outside/);
  assert.equal(fs.existsSync(path.join(f.directory,'browser-fixture-private')),false);
 }finally{f.cleanup();}
});
test('preflight fixture path reaches the actual browser child environment',()=>{
 const f=scratch();try{
  const selected=existing(f.directory),prepared=prepareBrowserFixtureConfig(root,f.directory,selected,(exe,args,options)=>({status:0,stdout:options.input?'{"ownerVerified":true}':''}));
  const api=path.join(f.directory,'Microi.Server/Microi.net.Api'),tests=path.join(f.directory,'Microi.Client/tests'),results=path.join(f.directory,'results');
  fs.mkdirSync(api,{recursive:true});fs.mkdirSync(tests,{recursive:true});fs.mkdirSync(results);
  fs.writeFileSync(path.join(api,'.microi-local'),'Test');save(path.join(api,'appsettings.Test.json'),{AppSettings:{OsClient:'fixture'}});
  fs.writeFileSync(path.join(tests,'general.spec.mjs'),"import {test} from '@playwright/test';test('generic',()=>{});");
  const files=discoverBrowserTests(tests),env={...selected,...prepared.environment,MICROI_TEST_API_BASE:'http://127.0.0.1:63971',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:63970'};
  const spec={file:files[0],title:'generic',line:1,column:1,ok:true,tests:[{status:'expected',results:[{status:'passed'}]}]};
  const report={config:{rootDir:tests},stats:{expected:1,unexpected:0,skipped:0,flaky:0},errors:[],suites:[{file:files[0],specs:[spec]}]};
  let invoked=0;runAllBrowserTests(f.directory,results,env,(exe,args,options)=>{invoked++;assert.equal(options.env.PW_RICHTEXT_FIXTURE_CONFIG,selected.PW_RICHTEXT_FIXTURE_CONFIG);return {status:0,stdout:JSON.stringify(report)};},true);assert.equal(invoked,2);
  const runner=fs.readFileSync(new URL('../run-tests.ps1',import.meta.url),'utf8');assert.match(runner,/SetEnvironmentVariable\(\$binding.Name, \[string\]\$binding.Value, 'Process'\)/);
 }finally{f.cleanup();}
});
