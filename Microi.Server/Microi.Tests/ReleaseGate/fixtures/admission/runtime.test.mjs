import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {requireStaged,validateProfile,mysqlConnection,bootstrapSettings,regular,createPrivate} from './runtime.mjs';
import {configureContext,ACCOUNTS} from './contracts.mjs';

test('non-staged Full fails before any transport or build and identifies the formal configuration',()=>{
  assert.throws(()=>requireStaged({}),/staged runtime.*MICROI_ADMISSION_PROFILE_FILE/);
  const env=Object.fromEntries(['BUILD_FILE','READY_FILE','ENVIRONMENT_FILE'].map(k=>['MICROI_TEST_RUNTIME_'+k,path.resolve('future-'+k)]));
  assert.throws(()=>requireStaged(env));env.MICROI_ADMISSION_PROFILE_FILE=path.resolve('private/profile.json');requireStaged(env);
});
test('profile cannot inject script, root, SQL or production endpoint',()=>{
  const p={schema:1,task:'isolated-run-test',expectedParentOwner:'shared-fixture-owner',python:path.resolve('python'),bootstrapFiles:[path.resolve('a'),path.resolve('b')]};
  validateProfile(p);for(const key of ['sourceRoot','command','sql','base'])assert.throws(()=>validateProfile({...p,[key]:'untrusted'}));
  assert.throws(()=>validateProfile({...p,bootstrapFiles:[p.bootstrapFiles[0],p.bootstrapFiles[0]]}));
});
test('MySQL parsing supports quoted delimiters but rejects alias ambiguity and remote hosts',()=>{
  assert.deepEqual(mysqlConnection('Server=127.0.0.1;Port=63960;Database=owned_main;Uid=test;Pwd="a;b=c";Charset=utf8mb4'),{host:'127.0.0.1',port:63960,database:'owned_main',user:'test',password:'a;b=c'});
  for(const text of ['Server=production;Database=owned_main;Uid=x;Pwd=y','Server=127.0.0.1;Host=127.0.0.1;Database=owned;Uid=x;Pwd=y','Server=127.0.0.1;Database=owned;Uid=x;Pwd="unterminated'])assert.throws(()=>mysqlConnection(text));
});
const app=()=>({AppSettings:{OsClient:'IsolatedMain',OsClientType:'Product',OsClientNetwork:'Internal',OsClientDbType:'MySql',OsClientDbConn:'Server=127.0.0.1;Port=63960;Database=owned_main;Uid=test;Pwd=offline',OsClientRedisHost:'127.0.0.1',OsClientRedisPort:63962,OsClientRedisPwd:'offline',OsClientRedisDataBase:2,OsClientDbMongoConn:'mongodb://127.0.0.1:63963'}});
test('bootstrap uses actual ten-field tuple and preserves effective Redis database',()=>{
  assert.equal(bootstrapSettings([app(),app()],'IsolatedMain').redis.database,2);
  const foreign=app();foreign.AppSettings.OsClientRedisHost='production';assert.throws(()=>bootstrapSettings([foreign,foreign],'IsolatedMain'));
  const extra=app();extra.AppSettings.NewBusinessFlag=true;assert.throws(()=>bootstrapSettings([extra,extra],'IsolatedMain'));
  assert.throws(()=>bootstrapSettings([app(),app()],'OtherTenant'));
});
test('the per-run contract changes owner and tenant without any fixed historical task identity',()=>{
  for(const owner32 of ['a'.repeat(32),'b'.repeat(32)])assert.equal(configureContext({schema:1,task:'future-full-run',owner32,tenant:'StdAdmission_'+owner32,mainTenant:'IsolatedMain',parentDatabase:'owned_main',redis:{host:'127.0.0.1',port:63962,database:2},base:'http://127.0.0.1:64171/'}).owner32,owner32);
  assert.throws(()=>configureContext({schema:1,task:'future-full-run',owner32:'a'.repeat(32),tenant:'StdAdmission_'+'b'.repeat(32)}));
});
test('real admission accounts fit the unchanged production 2 to 20 character contract',()=>{
  const accounts=[];
  for(const owner32 of ['a'.repeat(32),'b'.repeat(32)]){
    configureContext({schema:1,task:'future-full-run',owner32,tenant:'StdAdmission_'+owner32,mainTenant:'IsolatedMain',parentDatabase:'owned_main',redis:{host:'127.0.0.1',port:63962,database:2},base:'http://127.0.0.1:64171/'});
    for(const account of Object.values(ACCOUNTS)){assert.match(account,/^[a-z0-9]{2,20}$/);accounts.push(account);}
  }
  assert.equal(new Set(accounts).size,4,'Owners and ordinary users remain distinct across attempts');
});
test('ordinary fixture files are accepted and ancestor links are rejected',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'admission-path-test-'));
  try{const target=path.join(dir,'target');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'file'),'test');regular(path.join(target,'file'));
    const linked=path.join(dir,'linked');fs.symlinkSync(target,linked,process.platform==='win32'?'junction':'dir');assert.throws(()=>regular(path.join(linked,'file')),/reparse/);
    fs.unlinkSync(linked);
  }finally{fs.rmSync(dir,{recursive:true});}
});
test('new private evidence directory receives actual private ACL and an existing directory is never adopted',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'admission-private-test-')),owned=path.join(dir,'private');
  try{createPrivate(owned,process.env.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON||(process.platform==='win32'?'python':'python3'));
    assert.ok(fs.statSync(owned).isDirectory());assert.throws(()=>createPrivate(owned,'not-run'),/already exists/);
  }finally{fs.rmSync(dir,{recursive:true});}
});

test('actual HTTP Mongo fixture requires the native Code 1 null missing contract after deletion',()=>{
  const source=fs.readFileSync(new URL('../../../FullStack/ManagedStorageAdmissionHttpTests.cs',import.meta.url),'utf8');
  const body=source.match(/var probeCode =[^\r\n]*"""\r?\n([\s\S]*?)\r?\n\s*""";/)?.[1];
  assert.ok(body,'Extract the actual HTTP fixture, not a duplicate implementation');
  const execute=missing=>{
    const calls=[];
    const mongo={NewId:()=> 'owned-id',AddFormData:p=>(calls.push('add'),{Code:1}),DelFormData:p=>(calls.push('delete'),{Code:1}),GetFormData:p=>(calls.push('read'),calls.filter(x=>x==='read').length===1?{Code:1,Data:{Value:'owned-nonce'}}:missing)};
    const result=vm.runInNewContext('(function(){'+body+'})()',{nonce:'owned-nonce',key:'owned-key',V8:{Param:{Action:'MongoPositive'},OsClient:'OwnedTenant',MongoDb:mongo}});
    assert.deepEqual(calls,['add','read','delete','read']);return result;
  };
  const ok=execute({Code:1,Data:null});assert.equal(ok.Code,1);assert.equal(ok.Data.AfterDeleteCode,1);assert.equal(ok.Data.AfterDeleteMissing,true);
  for(const missing of [{Code:2,Data:null},{Code:0,Data:null},{Code:1,Data:{}},{Code:1,Data:{Value:'owned-nonce'}}])assert.equal(execute(missing).Code,0);
  assert.match(source,/Assert\.Equal\(1, mongo\["Data"\]\?\.Value<int>\("AfterDeleteCode"\)\)/);
  assert.match(source,/Assert\.True\(mongo\["Data"\]\?\.Value<bool>\("AfterDeleteMissing"\)\)/);
});
