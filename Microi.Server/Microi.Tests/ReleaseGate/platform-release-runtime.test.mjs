import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {validateProfile,profileEnvironment,runProfileCommand,waitForRuntime,stopRuntime} from '../../tools/platform-release-runtime.mjs';
import {validateCommand,rewriteScopedCommand,readRequest} from '../../tools/platform-release-bridges.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const source=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';
const profile={schemaVersion:1,ownerTask:'owned-existing-fixture',authorization:'explicit-human-scope',nodeExecutable:process.execPath,pythonExecutable:'python',environmentFile:'env.json',apiSettings:'api.json',bridgeScopeFile:'scope.json',nativeMysqlConfig:'ddl.json',richTextConfig:'rich.json',ports:{api:63971,peerApi:63972,frontend:63970,smoke:63973,bridges:{mysql:63960,mongo:63963,redis:63962,scheduleRedis:63964}},paths:{nodeExecutable:process.execPath,pythonExecutable:'private/python',apiSettings:'private/api.json',nativeMysqlConfig:'private/ddl.json',richTextConfig:'private/rich.json'},workspace:root};
const environment={MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_OSCLIENT:'fixture',MICROI_TEST_API_BASE:'http://127.0.0.1:63971/',MICROI_TEST_PEER_API_BASE:'http://127.0.0.1:63972/',MICROI_TEST_FRONTEND_BASE:'http://127.0.0.1:63970',MICROI_TEST_PASSWORD:'contract-only-secret'};
function scratch(){const parent=path.join(root,'.tmp');fs.mkdirSync(parent,{recursive:true});const directory=fs.mkdtempSync(path.join(parent,'platform-runtime-contract-'));return {directory,cleanup(){assert.equal(path.dirname(directory),parent);assert.ok(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true});}};}
function section(from,to){const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
test('runtime profile rejects absent authority and conflicting ports',()=>{
 assert.equal(validateProfile(profile),profile);
 assert.throws(()=>validateProfile({...profile,authorization:''}),/authority/);
 assert.throws(()=>validateProfile({...profile,ports:{...profile.ports,smoke:profile.ports.api}}),/distinct/);
 assert.throws(()=>validateProfile({...profile,ports:{...profile.ports,api:0}}),/distinct/);
});
test('selected profile drops stale tokens, desktop, admission and container creation flags',()=>{
 const values=profileEnvironment(profile,{env:{...environment,MICROI_TEST_TOKEN:'old-token',MICROI_TEST_CHILD_TOKEN:'old-child',MICROI_DESKTOP_NODE_HOME:'desktop',MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE:'YES',MICROI_GATE_TEST_MYSQL_AUTO:'YES',MICROI_TEST_MATRIX_FILE:'old-matrix'}},'/owned/control-01');
 for(const name of ['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN','MICROI_DESKTOP_NODE_HOME','MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE','MICROI_GATE_TEST_MYSQL_AUTO','MICROI_TEST_MATRIX_FILE'])assert.equal(values[name],undefined);
 assert.equal(values.MICROI_TEST_PASSWORD,'contract-only-secret');assert.equal(values.MICROI_TEST_DID,'PlatformRelease:control-01');
 assert.throws(()=>profileEnvironment(profile,{env:{...environment,MICROI_TEST_API_BASE:'https://customer.example.com'}},'/owned/control'),/endpoint/);
 assert.throws(()=>profileEnvironment(profile,{env:{...environment,MICROI_TEST_ALLOW_WRITES:'NO'}},'/owned/control'),/authorization/);
});
test('real test-command adapter preserves arguments and nonzero exit while isolating inherited sessions',()=>{
 const selected={...profile,source:{env:environment}},old=process.env.MICROI_TEST_TOKEN;process.env.MICROI_TEST_TOKEN='foreign-old-session';
 try{
  const code=runProfileCommand('/owned/control',['pwsh','-File','run-tests.ps1','-Mode','PlatformRelease'],(exe,args,options)=>{
   assert.equal(exe,'pwsh');assert.deepEqual(args,['-File','run-tests.ps1','-Mode','PlatformRelease']);assert.equal(options.env.MICROI_TEST_TOKEN,undefined);assert.equal(options.env.MICROI_TEST_PASSWORD,'contract-only-secret');assert.equal(options.env.MICROI_PLATFORM_RUNTIME_CONTROL,'/owned/control');assert.equal(options.stdio,'inherit');return {status:7};
  },()=>({profile:selected}));
  assert.equal(code,7);
  assert.equal(runProfileCommand('/owned/control',['pwsh'],()=>({error:Error('spawn')}),()=>({profile:selected})),1);
 }finally{if(old===undefined)delete process.env.MICROI_TEST_TOKEN;else process.env.MICROI_TEST_TOKEN=old;}
});
test('borrowed Redis bridge keeps scoped database and administrative command guards',()=>{
 const args=(...v)=>v.map(x=>Buffer.from(String(x)));
 validateCommand(args('CONFIG','GET','timeout'),[1,2]);
 for(const command of [args('FLUSHALL'),args('SELECT',3),args('CONFIG','SET','timeout',0),args('EVAL','redis.call("FLUSHDB")',0)])assert.throws(()=>validateCommand(command,[1,2]));
 const rewritten=rewriteScopedCommand(args('SELECT',0),{databases:[0],virtualDefaultDatabase:3});assert.deepEqual(readRequest(rewritten).values.map(x=>x.toString()),['SELECT','3']);
 assert.throws(()=>rewriteScopedCommand(args('SELECT',1),{databases:[0],virtualDefaultDatabase:3}));
});
const activation=section('if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ] && [ -z "${MICROI_PLATFORM_RUNTIME_CONTROL:-}" ]; then','\nif [ "$PUBLISH_DOC" = true ]; then');
for(const scenario of [{name:'complete entry',complete:'true',calls:4},{name:'partial PC or website entry',complete:'false',calls:0},{name:'explicit existing supervisor',complete:'true',external:'/external/control',calls:0},{name:'start failure',complete:'true',fail:true,calls:1,exit:91}])test('script bootstrap: '+scenario.name,()=>{
 const f=scratch();try{
  const log=path.join(f.directory,'calls'),script=path.join(f.directory,'run.sh');
  const setup=String.raw`print_phase(){ :; }
print_fail(){ exit 91; }
is_windows_shell(){ return 1; }
run_release_command(){ "$@"; }
node(){ echo "$2" >> "$CALL_LOG"; case "$2" in start) [ "$FAIL_START" != true ] || return 9; echo '/owned/control';; info) case "$4" in smokeConfig) echo '/private/api.json';; smokePort) echo 63973;; nodeHome) echo '/native/node';; esac;; esac; }
START_TIME=1792907552
MICROI_RELEASE_DEADLINE=1792909352
MICROI_RELEASE_GATE_DIR=/owned/gate
MICROI_RELEASE_OWNER_PID=1234
`;
  fs.writeFileSync(script,setup+'\n'+activation+'\nprintf "%s %s\\n" "$START_TIME" "$MICROI_RELEASE_DEADLINE"\n');
  const result=spawnSync(bash,[script],{cwd:root,env:{...process.env,CALL_LOG:log,FAIL_START:String(Boolean(scenario.fail)),MICROI_COMPLETE_PLATFORM_RELEASE:scenario.complete,MICROI_PLATFORM_RUNTIME_CONTROL:scenario.external||''},encoding:'utf8',windowsHide:true});
  assert.equal(result.status,scenario.exit||0,result.stderr);const calls=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n'):[];assert.equal(calls.length,scenario.calls);
  if(!scenario.fail)assert.match(result.stdout,/1792907552 1792909352/);
 }finally{f.cleanup();}
});
const finish=section('finish_windows_session() {','\n}\n')+'\n}\n';
for(const [initial,owned,cleanupExit,expected] of [[7,true,1,7],[0,true,1,1],[0,true,0,0],[0,false,1,0]])test('release finalizer preserves exit '+initial+' with owned='+owned+' and cleanup='+cleanupExit,()=>{
 const f=scratch();try{
  const log=path.join(f.directory,'cleanup'),script=path.join(f.directory,'exit.sh');
  fs.writeFileSync(script,String.raw`stop_active_client_build(){ :; }
cleanup_release_scratch(){ return 0; }
release_workspace_lock(){ :; }
is_windows_shell(){ return 1; }
node(){ echo "$2 $3" >> "$CALL_LOG"; return "$CLEANUP_EXIT"; }
MICROI_RELEASE_WORKSPACE=/workspace
MICROI_RELEASE_DEADLINE=""
`+'\n'+finish+'\n(exit '+initial+')\nfinish_windows_session\n');
  const result=spawnSync(bash,[script],{env:{...process.env,CALL_LOG:log,CLEANUP_EXIT:String(cleanupExit),MICROI_PLATFORM_RUNTIME_OWNED_CONTROL:owned?'/owned/control':''},encoding:'utf8',windowsHide:true});
  assert.equal(result.status,expected,result.stderr);assert.equal(fs.existsSync(log),owned);
  if(owned)assert.equal(fs.readFileSync(log,'utf8').trim(),'stop /owned/control');
 }finally{f.cleanup();}
});
test('readiness rejects a failed or absent supervisor and accepts only its explicit completion file',async()=>{
 const f=scratch();try{
  fs.writeFileSync(path.join(f.directory,'failed.json'),'{}');await assert.rejects(waitForRuntime(f.directory,'ready.json',5),/failed/);fs.unlinkSync(path.join(f.directory,'failed.json'));
  await assert.rejects(waitForRuntime(f.directory,'ready.json',1),/timed out/);
  fs.writeFileSync(path.join(f.directory,'ready.json'),'{"ready":true}');assert.deepEqual(await waitForRuntime(f.directory,'ready.json',1),{ready:true});
 }finally{f.cleanup();}
});
test('profile drift does not prevent registered owned cleanup and invalid supervisor startup leaves a failure receipt',async()=>{
 const f=scratch();try{
  fs.writeFileSync(path.join(f.directory,'owner.json'),JSON.stringify({schemaVersion:1,workspace:root,profile:path.join(f.directory,'missing-profile.json')}));
  fs.writeFileSync(path.join(f.directory,'supervisor.json'),JSON.stringify({pid:1234,control:f.directory}));
  const result=spawnSync(process.execPath,[path.join(root,'Microi.Server/tools/platform-release-runtime.mjs'),'supervise',f.directory],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,1);assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'failed.json'))).failed,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'supervisor-stopped.json'))).processesStarted,0);
  assert.equal((await stopRuntime(f.directory)).stopped,true);assert.ok(fs.existsSync(path.join(f.directory,'shutdown.json')));
 }finally{f.cleanup();}
});
test('bootstrap stays after the release clock and lock, before version mutation, and never re-enters release modes',()=>{
 assert.ok(source.indexOf(activation)>source.indexOf('MICROI_RELEASE_DEADLINE=$((START_TIME + 1800))'));
 assert.ok(source.indexOf(activation)>source.indexOf('    acquire_workspace_lock',source.indexOf('START_TIME=$(date +%s)',10000)));
 assert.ok(source.indexOf(activation)<source.indexOf('# ─── 阶段（条件）: 更新版本号'));
 assert.doesNotMatch(activation,/exec .*Microi一键|--platform-release|START_TIME=/);
 assert.match(source,/_platform_test_command=\(node Microi\.Server\/tools\/platform-release-runtime\.mjs run-tests/);
});
test('supervisor launch survives the creator Node exit and honors its explicit stop marker',async()=>{
 const f=scratch();let pid;
 try{
  const runtime=fs.readFileSync(path.join(root,'Microi.Server/tools/platform-release-runtime.mjs'),'utf8');
  const statement=runtime.split('\n').find(line=>line.includes("const child=spawn(profile.paths.nodeExecutable,[self,'supervise',control]"));
  assert.ok(statement);assert.match(statement,/detached:true/);assert.match(statement,/windowsHide:true/);
  const stub=path.join(f.directory,'supervisor.mjs'),heartbeat=path.join(f.directory,'heartbeat'),stop=path.join(f.directory,'stop'),stopped=path.join(f.directory,'stopped');
  fs.writeFileSync(stub,"import fs from 'node:fs';import path from 'node:path';import {setTimeout as delay} from 'node:timers/promises';const control=process.argv[3];let count=0;while(!fs.existsSync(path.join(control,'stop'))){fs.writeFileSync(path.join(control,'heartbeat'),String(++count));await delay(25);}fs.writeFileSync(path.join(control,'stopped'),'true');");
  const parent=path.join(f.directory,'creator.mjs');
  fs.writeFileSync(parent,"import fs from 'node:fs';import {spawn} from 'node:child_process';const control=process.argv[2],self=process.argv[3],profile={paths:{nodeExecutable:process.execPath},workspace:control};const fd=fs.openSync(control+'/private.log','a');\n"+statement+"\nconsole.log(child.pid);\n");
  const result=spawnSync(process.execPath,[parent,f.directory,stub],{encoding:'utf8',windowsHide:true,timeout:5000});
  assert.equal(result.status,0,result.stderr);pid=Number(result.stdout.trim());assert.ok(Number.isSafeInteger(pid)&&pid>0);
  const deadline=Date.now()+5000;while(!fs.existsSync(heartbeat)&&Date.now()<deadline)await delay(25);
  assert.ok(fs.existsSync(heartbeat),'Detached supervisor did not remain alive after creator exited');
  const before=Number(fs.readFileSync(heartbeat,'utf8'));await delay(100);assert.ok(Number(fs.readFileSync(heartbeat,'utf8'))>before);
  fs.writeFileSync(stop,'{}');while(!fs.existsSync(stopped)&&Date.now()<deadline)await delay(25);
  assert.equal(fs.readFileSync(stopped,'utf8'),'true');
 }finally{
  fs.writeFileSync(path.join(f.directory,'stop'),'{}');
  if(pid){for(let count=0;count<40;count++){try{process.kill(pid,0);}catch{break;}await delay(25);}}
  f.cleanup();
 }
});
