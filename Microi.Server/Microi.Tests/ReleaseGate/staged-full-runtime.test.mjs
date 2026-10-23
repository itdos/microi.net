import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import * as runtime from './staged-full-runtime.mjs';
import {validateReady,processIdentities} from './staged-full-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('the exact Full HDFS evidence survives build cleanup and rejects changed or foreign bytes',()=>{
 const results=fs.mkdtempSync(path.join(os.tmpdir(),'microi-hdfs-proof-'));
 const directory=path.join(results,'.net-artifacts');fs.mkdirSync(directory);
 const live=path.join(directory,'Microi.HDFS.dll'),bytes=Buffer.from('independent tested DLL bytes');
 fs.writeFileSync(live,bytes);
 try{
  const build={resultsDirectory:results,runtimeDirectory:directory,...runtime.preserveHdfsEvidence(directory,results)};
  const expected=runtime.verifyHdfsEvidence(build);
  assert.throws(()=>runtime.preserveHdfsEvidence(directory,results),/EEXIST/,'existing proof cannot be overwritten');
  fs.writeFileSync(live,'different runtime');assert.throws(()=>runtime.verifyHdfsEvidence(build),/differ/);
  fs.rmSync(directory,{recursive:true});assert.equal(runtime.verifyHdfsEvidence(build),expected);
  assert.throws(()=>runtime.verifyHdfsEvidence({...build,hdfsEvidenceFile:path.join(results,'foreign.dll')}),/belong/);
  assert.throws(()=>runtime.verifyHdfsEvidence({...build,hdfsDllSha256:'0'.repeat(64)}),/changed/);
  fs.writeFileSync(build.hdfsEvidenceFile,'different evidence');assert.throws(()=>runtime.verifyHdfsEvidence(build),/changed/);
  fs.rmSync(build.hdfsEvidenceFile);assert.throws(()=>runtime.verifyHdfsEvidence(build),/ENOENT/);
 }finally{fs.rmSync(results,{recursive:true,force:true});}
});
function fixture(){
 const environment={MICROI_TEST_OSCLIENT:'FixtureMain',MICROI_TEST_CHILD_OSCLIENT:'FixtureChild',MICROI_TEST_DID:'new-device',MICROI_TEST_API_BASE:'http://127.0.0.1:63971/',MICROI_TEST_PEER_API_BASE:'http://127.0.0.1:63972/',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:63970/'};
 const profile=path.join(root,'.tmp/unit-fixture/profile'),attempt='11111111-1111-4111-8111-111111111111';
 Object.assign(environment,{MICROI_TEST_RUNTIME_ENVIRONMENT_FILE:path.join(profile,'private/full-environment.json'),MICROI_TEST_RUNTIME_BUILD_FILE:path.join(profile,'signals',attempt,'final-build.json'),MICROI_DESKTOP_NODE_HOME:path.dirname(process.execPath)});
 const build={schemaVersion:1,sourceHead:'a'.repeat(40),buildId:'fresh-build',builtAt:'2026-10-16T10:00:00Z',runtimeDirectory:path.join(root,'.tmp/unit-fixture/runtime'),apiDllSha256:'d'.repeat(64),runtimeManifestSha256:'e'.repeat(64)};
 const processes=['api','peerApi','frontend'].map((kind,index)=>({kind,pid:100+index,parentPid:99,exe:kind==='frontend'?process.execPath:path.join(build.runtimeDirectory,'Microi.net.Api.exe'),commandLine:kind==='frontend'?'node fixture.mjs':'Microi.net.Api.exe --contentRoot fixture',creationDate:'new-pid-'+index,cwd:path.join(root,kind==='frontend'?'Microi.Client':'Microi.Server/Microi.net.Api'),listeningPorts:[63971+index]}));processes[2].listeningPorts=[63970];
 const supervisor={pid:99,parentPid:88,exe:process.execPath,commandLine:process.execPath+' '+path.join(profile,'runtime-coordinator.mjs'),creationDate:'new-supervisor',cwd:profile,listeningPorts:[63960,63962,63963,63964]};
 const ready={...build,task:'unit-fixture',attempt,supervisorPid:99,supervisor,credentialsRefreshedAt:'2026-10-16T10:00:10Z',health:{api:true,peerApi:true,frontend:true},processes};
 const credentials={sourceHead:build.sourceHead,buildId:build.buildId,credentialsRefreshedAt:ready.credentialsRefreshedAt,env:{...environment,MICROI_TEST_TOKEN:'new-main-token-'.repeat(3),MICROI_TEST_CHILD_TOKEN:'new-child-token-'.repeat(3)}};
 return {build,ready,credentials,current:structuredClone([...processes,supervisor]),environment};
}
const validate=value=>validateReady(value.build,value.ready,value.credentials,value.current,value.environment);
test('staged Full accepts only fresh same-build login and independently matching runtime identities',()=>{
 const value=fixture();assert.deepEqual(Object.keys(validate(value)),['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN']);
 for(const change of [
  v=>v.ready.sourceHead='b'.repeat(40),v=>v.ready.buildId='old',v=>v.ready.apiDllSha256='f'.repeat(64),
  v=>v.ready.runtimeManifestSha256='f'.repeat(64),v=>v.credentials.credentialsRefreshedAt='2026-10-15T10:00:00Z',
  v=>v.credentials.env.MICROI_TEST_DID='other-device',v=>v.credentials.env.MICROI_TEST_CHILD_OSCLIENT='iTdos',
  v=>v.ready.health.peerApi=false,v=>v.current[0].pid=555,v=>v.current[0].parentPid=2,
  v=>v.current[0].cwd=root,v=>v.current[0].commandLine='old-api',v=>v.current[0].creationDate='reused-pid',
  v=>v.current[0].exe=process.execPath,v=>v.current[0].listeningPorts=[],v=>v.credentials.env.MICROI_TEST_TOKEN='',
 ]){const invalid=fixture();change(invalid);assert.throws(()=>validate(invalid));}
});
test('native identity reader independently confirms actual child PID and CWD without controlling unrelated processes',{skip:process.platform!=='win32'},async()=>{
 const cwd=path.join(root,'Microi.Client'),child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd,windowsHide:true,stdio:'ignore'});
 try{
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  const [actual]=processIdentities([child.pid]);assert.equal(actual.pid,child.pid);assert.equal(actual.parentPid,process.pid);
  assert.equal(path.resolve(actual.cwd).toLowerCase(),path.resolve(cwd).toLowerCase());
  assert.equal(path.resolve(actual.exe).toLowerCase(),path.resolve(process.execPath).toLowerCase());
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
 assert.deepEqual(processIdentities([child.pid],{allowMissing:true}),[],'the native reader must independently prove the owned PID is gone');
});
function transportFixture(){
 const value=fixture();value.accepted={accepted:true,sourceHead:value.build.sourceHead,runtimeBuildId:value.build.buildId,verifiedAt:'2026-10-16T10:01:00Z'};value.receiptHash='f'.repeat(64);value.remaining=[];
 value.transport={schemaVersion:1,task:value.ready.task,sourceHead:value.build.sourceHead,buildId:value.build.buildId,attempt:value.ready.attempt,supervisorPid:99,ownerPid:88,phase:'TransportOnlyForEncryptedSmoke',runtimeStopped:true,at:'2026-10-16T10:01:01Z',fullReceiptSha256:value.receiptHash,cleanup:value.ready.processes.map(row=>({kind:row.kind,pid:row.pid,stopped:true})),retainedBridgePorts:[63960,63962,63963,63964]};
 value.currentSupervisor=structuredClone(value.ready.supervisor);return value;
}
const verifyTransport=value=>runtime.validateTransportOnly(value.build,value.ready,value.transport,value.currentSupervisor,value.remaining,value.environment,value.accepted,value.receiptHash);

test('configured native bridge ports retain fresh runtime identity and exact listener ownership',()=>{
 const ports=[63980,63982,63983,63984],value=fixture();
 value.environment.MICROI_TEST_NATIVE_BRIDGE_PORTS=JSON.stringify(ports);
 value.current.find(row=>row.pid===99).listeningPorts=ports;
 assert.deepEqual(Object.keys(validate(value)),['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN']);
 for(const mutate of [v=>v.current.find(row=>row.pid===99).listeningPorts.pop(),v=>v.current.find(row=>row.pid===99).listeningPorts.push(64000),v=>v.current.find(row=>row.pid===99).parentPid=1]){
  const invalid=structuredClone(value);mutate(invalid);assert.throws(()=>validate(invalid));
 }
});

test('configured bridge transport keeps the accepted Full barrier and rejects malformed or colliding ports',()=>{
 const ports=[63980,63982,63983,63984],value=transportFixture();
 value.environment.MICROI_TEST_NATIVE_BRIDGE_PORTS=JSON.stringify(ports);
 value.currentSupervisor.listeningPorts=ports;value.transport.retainedBridgePorts=ports;
 assert.equal(verifyTransport(value),true);
 for(const supplied of ['', 'null','{}','[63980]','[63980,63980,63983,63984]','[0,63982,63983,63984]','[65536,63982,63983,63984]','[63980.5,63982,63983,63984]','["63980",63982,63983,63984]','[63970,63982,63983,63984]']){
  const invalid=transportFixture();invalid.environment.MICROI_TEST_NATIVE_BRIDGE_PORTS=supplied;assert.throws(()=>verifyTransport(invalid));
 }
 const wrong=structuredClone(value);wrong.transport.retainedBridgePorts=[63960,63962,63963,63964];assert.throws(()=>verifyTransport(wrong));
});
test('PrepareRelease barrier requires independently exited runtime PIDs and same-owner live native bridges',()=>{
 assert.equal(typeof runtime.validateTransportOnly,'function');assert.equal(verifyTransport(transportFixture()),true);
 for(const change of [v=>v.transport.sourceHead='b'.repeat(40),v=>v.transport.buildId='old',v=>v.transport.attempt='old-attempt',v=>v.transport.ownerPid=1,v=>v.transport.task='other',v=>v.transport.runtimeStopped=false,v=>v.transport.cleanup.pop(),v=>v.transport.cleanup[0].pid=200,v=>v.transport.cleanup[0].stopped=false,v=>v.currentSupervisor.parentPid=1,v=>v.currentSupervisor.creationDate='reused',v=>v.currentSupervisor.cwd=root,v=>v.currentSupervisor.exe=path.join(root,'foreign.exe'),v=>v.currentSupervisor.commandLine='foreign.js',v=>v.currentSupervisor.listeningPorts=[63960],v=>v.remaining=[v.ready.processes[0]],v=>v.accepted.accepted=false,v=>v.receiptHash='0'.repeat(64),v=>v.transport.at='2026-10-16T09:59:00Z']){
  const invalid=transportFixture();change(invalid);assert.throws(()=>verifyTransport(invalid));
 }
});
test('transport barrier times out or rejects runtime failure without accepting a stale ready path',async()=>{
 assert.equal(typeof runtime.waitForTransportOnly,'function');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-transport-wait-')),file=path.join(directory,'ready.json'),failed=path.join(directory,'failed.json');
 try{
  await assert.rejects(runtime.waitForTransportOnly(file,failed,15,1),/timed out/);
  fs.writeFileSync(failed,'{}');await assert.rejects(runtime.waitForTransportOnly(file,failed,15,1),/failed/);
  fs.unlinkSync(failed);fs.writeFileSync(file,'{}');await runtime.waitForTransportOnly(file,failed,15,1);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Full entry verifies transport-only after accepted matrix and before it announces success',()=>{
 const runner=fs.readFileSync(new URL('../run-tests.ps1',import.meta.url),'utf8');
 const matrix=runner.lastIndexOf("node $matrixTool verify"),barrier=runner.lastIndexOf('verify-transport-only'),passed=runner.lastIndexOf('Write-Host "Microi.Tests $Mode gate passed.');
 assert.ok(matrix>=0&&barrier>matrix&&passed>barrier,'a matching transport-only barrier must precede Full success');
 assert.match(runner.slice(barrier,passed),/\$LASTEXITCODE -ne 0/);
});
