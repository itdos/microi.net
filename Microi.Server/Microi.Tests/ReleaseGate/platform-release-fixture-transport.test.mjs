import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {startNativeBridges} from '../../tools/platform-release-bridges.mjs';
import {buildBrowserFixtureConfig,prepareBrowserFixtureConfigAsync,runBrowserFixtureVerification} from './prepare-browser-fixture.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const close=server=>new Promise(resolve=>server.close(resolve));

test('fixture child verifies through bridges owned by the same active supervisor event loop',async()=>{
 const parent=path.join(root,'.tmp');fs.mkdirSync(parent,{recursive:true});
 const scratch=fs.mkdtempSync(path.join(parent,'fixture-transport-')),reserved=[],connections=[];
 let bridge,ownerVerified=true,verifications=0;
 const upstream=net.createServer(socket=>{
  connections.push(socket);socket.on('error',()=>{});let input='';
  socket.on('data',bytes=>{input+=bytes;if(!input.endsWith('\n'))return;const request=JSON.parse(input);
   assert.deepEqual(request,{ownerTask:'loopback-owner',osClient:'fixture',database:'owned_fixture',action:'verify'});
   verifications++;socket.end(JSON.stringify({ownerVerified})+'\n');
  });
 });
 try{
  const targetPort=await listen(upstream),ports={};
  for(const name of ['mysql','mongo','redis','scheduleRedis']){const server=net.createServer();reserved.push(server);ports[name]=await listen(server);}
  await Promise.all(reserved.map(close));
  const scopeFile=path.join(scratch,'bridge-scope.json'),target={host:'127.0.0.1',port:targetPort};
  fs.writeFileSync(scopeFile,JSON.stringify({task:'loopback-owner',authorization:'loopback-only',mysql:target,mongo:target,redis:{...target,password:'unused'}}));
  bridge=await startNativeBridges(scopeFile,{ownerTask:'loopback-owner',authorization:'loopback-only',ports});
  const scope={task:'loopback-owner',authorization:'loopback-only',databases:['owned_fixture'],mysql:{host:'127.0.0.1',port:ports.mysql,user:'fixture',password:'fixture-only'}};
  const settings={OsClient:'fixture',OsClientDbType:'MySQL',OsClientDbConn:`Server=127.0.0.1;Port=${ports.mysql};Database=owned_fixture;Uid=fixture;Pwd=fixture-only;`};
  const config=path.join(scratch,'fixture.json'),settingsFile=path.join(scratch,'appsettings.json');
  fs.writeFileSync(config,JSON.stringify(buildBrowserFixtureConfig(scope,settings,'fixture')));fs.writeFileSync(settingsFile,JSON.stringify({AppSettings:settings}));
  const environment={MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_OSCLIENT:'fixture',MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON:process.execPath,PW_RICHTEXT_FIXTURE_CONFIG:config,MICROI_TEST_UI_FIXTURE_APPSETTINGS:settingsFile};
  const childSource=`import fs from 'node:fs';import net from 'node:net';let input='';for await(const part of process.stdin)input+=part;const request=JSON.parse(input),config=JSON.parse(fs.readFileSync(request.config));const socket=net.createConnection({host:'127.0.0.1',port:Number(process.argv[1])});const timeout=setTimeout(()=>{socket.destroy();process.exitCode=1;},5000);let output='';socket.on('error',()=>{clearTimeout(timeout);process.exitCode=1;});socket.on('connect',()=>socket.write(JSON.stringify({ownerTask:config.ownerTask,osClient:request.osClient,database:config.database,action:request.action})+'\\n'));socket.on('data',chunk=>output+=chunk);socket.on('end',()=>{clearTimeout(timeout);process.stdout.write(output);});`;
  let aclChecks=0;
  const acl=()=>{aclChecks++;return {status:0,stdout:''};};
  const verify=(exe,args,input)=>{assert.equal(JSON.parse(input).action,'verify');assert.ok(args.at(-1).endsWith('richtext-fixture.py'));return runBrowserFixtureVerification(process.execPath,['--input-type=module','-e',childSource,String(ports.mysql)],input);};
  const result=await prepareBrowserFixtureConfigAsync(root,scratch,environment,acl,verify);
  assert.equal(result.receipt.ownerVerified,true);assert.equal(aclChecks,3);assert.equal(verifications,1);
  ownerVerified=false;
  await assert.rejects(prepareBrowserFixtureConfigAsync(root,scratch,environment,acl,verify),/owner verification/);
  assert.equal(verifications,2);
  const runtime=fs.readFileSync(path.join(root,'Microi.Server/tools/platform-release-runtime.mjs'),'utf8');
  assert.match(runtime,/bridges=await startNativeBridges[\s\S]*?await prepareBrowserFixtureConfigAsync\(profile\.workspace,control,environment\);[\s\S]*?write\('transport-ready\.json'/);
 }finally{
  if(bridge)await bridge.close();for(const socket of connections)socket.destroy();
  for(const server of reserved)if(server.listening)await close(server);if(upstream.listening)await close(upstream);
  assert.equal(path.dirname(scratch),parent);assert.equal(fs.lstatSync(scratch).isSymbolicLink(),false);fs.rmSync(scratch,{recursive:true});
 }
});

test('failed asynchronous verifier remains a failure and never produces an owner proof',async()=>{
 await assert.rejects(runBrowserFixtureVerification(process.execPath,['-e','process.exit(7)'],'{}'),/ownership verification failed/);
});
