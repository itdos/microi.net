import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {validateReady,processIdentities} from './staged-full-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
function fixture(){
 const environment={MICROI_TEST_OSCLIENT:'FixtureMain',MICROI_TEST_CHILD_OSCLIENT:'FixtureChild',MICROI_TEST_DID:'new-device',MICROI_TEST_API_BASE:'http://127.0.0.1:63971/',MICROI_TEST_PEER_API_BASE:'http://127.0.0.1:63972/',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:63970/'};
 const build={schemaVersion:1,sourceHead:'a'.repeat(40),buildId:'fresh-build',builtAt:'2026-10-16T10:00:00Z',runtimeDirectory:path.join(root,'.tmp/unit-fixture/runtime'),apiDllSha256:'d'.repeat(64),runtimeManifestSha256:'e'.repeat(64)};
 const processes=['api','peerApi','frontend'].map((kind,index)=>({kind,pid:100+index,parentPid:99,exe:kind==='frontend'?process.execPath:path.join(build.runtimeDirectory,'Microi.net.Api.exe'),commandLine:kind==='frontend'?'node fixture.mjs':'Microi.net.Api.exe --contentRoot fixture',creationDate:'new-pid-'+index,cwd:path.join(root,kind==='frontend'?'Microi.Client':'Microi.Server/Microi.net.Api'),listeningPorts:[63971+index]}));processes[2].listeningPorts=[63970];
 const ready={...build,supervisorPid:99,credentialsRefreshedAt:'2026-10-16T10:00:10Z',health:{api:true,peerApi:true,frontend:true},processes};
 const credentials={sourceHead:build.sourceHead,buildId:build.buildId,credentialsRefreshedAt:ready.credentialsRefreshedAt,env:{...environment,MICROI_TEST_TOKEN:'new-main-token-'.repeat(3),MICROI_TEST_CHILD_TOKEN:'new-child-token-'.repeat(3)}};
 return {build,ready,credentials,current:structuredClone(processes),environment};
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
 }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
});
