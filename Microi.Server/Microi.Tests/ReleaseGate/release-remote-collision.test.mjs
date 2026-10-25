import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {inspectNugetPackage,inspectNugetSet,captureDockerPlan,recheckDockerPlan,inspectDockerRemote,confirmDockerPublication,writeDockerPublicationReceipt} from '../../tools/release-remote-collision.mjs';

const source='https://packages.example.test/v3/index.json';
const index=()=>new Response(JSON.stringify({resources:[{'@type':'PackageBaseAddress/3.0.0','@id':'https://flat.example.test/'}]}));
function zip(file,id='Example',version='8.6.4'){
 const name=Buffer.from('package.nuspec'),data=Buffer.from(`<package><metadata><id>${id}</id><version>${version}</version></metadata></package>`);
 let crc=0xffffffff;for(const byte of data){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+data.length,16);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.concat([local,name,data,central,name,end]));return fs.readFileSync(file);
}
async function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'microi-remote-collision-'));try{return await run(root);}finally{fs.rmSync(root,{recursive:true});}}

for(const state of ['absent','same','different','unauthorized','forbidden','server-error','network-unknown','truncated'])test(`actual NuGet identity and complete bytes: ${state}`,()=>fixture(async root=>{
 const file=path.join(root,'filename-is-not-identity.nupkg'),bytes=zip(file),calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url:String(url),options});assert.equal(options.headers['X-NuGet-ApiKey'],undefined);
  if(String(url)===source)return index();
  assert.equal(String(url),'https://flat.example.test/example/8.6.4/example.8.6.4.nupkg');
  if(state==='network-unknown')throw Error('fictional private response');
  if(state==='absent')return new Response(null,{status:404});
  if(state==='unauthorized'||state==='forbidden'||state==='server-error')return new Response(null,{status:{unauthorized:401,forbidden:403,'server-error':503}[state]});
  return new Response(state==='same'?bytes:state==='truncated'?bytes.subarray(0,bytes.length-1):Buffer.alloc(bytes.length));
 };
 if(state==='same'||state==='absent'){
  const result=await inspectNugetPackage(file,source,{fetchImpl});assert.equal(result.state,state);assert.equal(result.localSha256,createHash('sha256').update(bytes).digest('hex'));
 }else await assert.rejects(()=>inspectNugetPackage(file,source,{fetchImpl}),/nuget-package-collision|nuget-package-unknown|remote-read-unknown/);
 assert.equal(calls.length,2);
}));
test('409 readback cannot accept a CDN 404 as confirmation',()=>fixture(async root=>{
 const file=path.join(root,'Example.8.6.4.nupkg');zip(file);
 await assert.rejects(()=>inspectNugetPackage(file,source,{requirePresent:true,fetchImpl:async url=>String(url)===source?index():new Response(null,{status:404})}),/duplicate-unconfirmed/);
}));
test('keyless package reads follow bounded HTTPS mirrors without sending secrets and reject unsafe redirects',()=>fixture(async root=>{
 const file=path.join(root,'Example.8.6.4.nupkg'),bytes=zip(file);
 for(const safe of [true,false]){
  const fetchImpl=async(url,options)=>{
   assert.equal(options.headers['X-NuGet-ApiKey'],undefined);
   if(String(url)===source)return index();
   if(String(url).startsWith('https://flat.'))return new Response(null,{status:302,headers:{Location:(safe?'https:':'http:')+'//mirror.example.test/package.nupkg'}});
   return new Response(bytes);
  };
  if(safe)assert.equal((await inspectNugetPackage(file,source,{fetchImpl})).state,'same');else await assert.rejects(()=>inspectNugetPackage(file,source,{fetchImpl}),/unsafe-remote-url/);
 }
}));
test('all actual pending NuGet packages must be clear before any upload; later collision fails whole preflight',()=>fixture(async root=>{
 const server=path.join(root,'Microi.Server'),list=path.join(root,'pending.nul'),files=['Example','Another'].map(id=>{const file=path.join(server,id,'bin/Release',`${id}.8.6.4.nupkg`);zip(file,id);return file;});
 fs.writeFileSync(list,files.join('\0')+'\0');const reads=[];
 await assert.rejects(()=>inspectNugetSet(server,'8.6.4',list,source,{fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');if(String(url)===source)return index();reads.push(String(url));return String(url).includes('/example/')?new Response('different'):new Response(null,{status:404});}}),/collision/);
 assert.equal(reads.length,2);
}));

const imageId='sha256:'+'a'.repeat(64),remoteDigest='sha256:'+'b'.repeat(64),otherDigest='sha256:'+'c'.repeat(64);
function dockerMock(remote,{repoDigests=[],id=imageId,unknown=false,ambiguous=false}={}){
 return args=>{
  if(args[0]==='image')return {status:0,stdout:JSON.stringify({id,repoDigests})};
  const tag=args[0]==='buildx'?args[3]:args[2],value=remote[tag];
  if(args[0]==='buildx'&&value)return {status:0,stdout:value+'\n'};
  return {status:1,stdout:'',stderr:unknown?'TLS timeout':ambiguous?'not found':`no such manifest: ${tag}`};
 };
}
test('Docker only explicit manifest absence is absence; network and ambiguous failures remain unknown',()=>{
 assert.equal(inspectDockerRemote('registry.test/repo:v8.6.4',{run:dockerMock({})}).state,'absent');
 for(const options of [{unknown:true},{ambiguous:true}])assert.throws(()=>inspectDockerRemote('registry.test/repo:v8.6.4',{run:dockerMock({},options)}),/unknown/);
});
test('fixed Docker tag needs the accepted local image exact RepoDigest; another existing tag stops the entire plan',()=>{
 const remote={'registry.test/team/api:v8.6.4':remoteDigest};
 assert.throws(()=>captureDockerPlan('local','registry.test/team','api:{latest},api:{version}','8.6.4',{run:dockerMock(remote)}),/version-collision/);
 const plan=captureDockerPlan('local','registry.test/team','api:{latest},api:{version}','8.6.4',{run:dockerMock(remote,{repoDigests:[`registry.test/team/api@${remoteDigest}`]})});
 assert.equal(plan.tags[1].digest,remoteDigest);assert.equal(plan.atomicAcrossRegistry,false);
});
test('Docker every push recheck rejects absent-to-present, digest mutation, local-image drift and unknown for latest too',()=>{
 const remote={'registry.test/team/api:latest':remoteDigest};const plan=captureDockerPlan('local','registry.test/team','api:{latest},api:{version}','8.6.4',{run:dockerMock(remote)});
 recheckDockerPlan(plan,'registry.test/team/api:latest',{run:dockerMock(remote)});
 assert.throws(()=>recheckDockerPlan(plan,'registry.test/team/api:latest',{run:dockerMock({'registry.test/team/api:latest':otherDigest})}),/state-changed/);
 assert.throws(()=>recheckDockerPlan(plan,'registry.test/team/api:v8.6.4',{run:dockerMock({'registry.test/team/api:v8.6.4':otherDigest})}),/state-changed/);
 assert.throws(()=>recheckDockerPlan(plan,'registry.test/team/api:latest',{run:dockerMock(remote,{id:otherDigest})}),/local-image-changed/);
 assert.throws(()=>recheckDockerPlan(plan,'registry.test/team/api:latest',{run:dockerMock({},{unknown:true})}),/unknown/);
});

test('Docker publication is confirmed only when the remote tag matches this accepted image repository digest',()=>{
 const tag='registry.test/team/api:v8.6.4',repo='registry.test/team/api';
 const plan=captureDockerPlan('local','registry.test/team','api:{version}','8.6.4',{run:dockerMock({})});
 const proof=confirmDockerPublication(plan,tag,{run:dockerMock({[tag]:remoteDigest},{repoDigests:[`${repo}@${remoteDigest}`]})});
 assert.equal(proof.published,true);assert.equal(proof.localImageId,imageId);assert.equal(proof.digest,remoteDigest);
 for(const [remote,options,message] of [
  [{},{repoDigests:[`${repo}@${remoteDigest}`]},/published-tag-missing/],
  [{[tag]:otherDigest},{repoDigests:[`${repo}@${remoteDigest}`]},/published-digest-mismatch/],
  [{[tag]:remoteDigest},{repoDigests:[`registry.test/other/api@${remoteDigest}`]},/published-digest-mismatch/],
  [{[tag]:remoteDigest},{id:otherDigest,repoDigests:[`${repo}@${remoteDigest}`]},/local-image-changed/],
  [{},{unknown:true},/remote-state-unknown/]
 ])assert.throws(()=>confirmDockerPublication(plan,tag,{run:dockerMock(remote,options)}),message);
 let reads=0;const mock=dockerMock({[tag]:remoteDigest},{repoDigests:[`${repo}@${remoteDigest}`]});
 assert.throws(()=>confirmDockerPublication(plan,tag,{run:args=>args[0]==='image'&&++reads===2?{status:0,stdout:JSON.stringify({id:otherDigest,repoDigests:[`${repo}@${remoteDigest}`]})}:mock(args)}),/local-image-changed/);
});

test('actual Docker confirmation writes its receipt only after verification and never overwrites earlier evidence',()=>fixture(root=>{
 const tag='registry.test/team/api:v8.6.4',repo='registry.test/team/api';
 const planFile=path.join(root,'plan.json'),receipt=path.join(root,'published.json');
 fs.writeFileSync(planFile,JSON.stringify(captureDockerPlan('local','registry.test/team','api:{version}','8.6.4',{run:dockerMock({})})));
 for(const run of [dockerMock({}),dockerMock({},{unknown:true}),dockerMock({[tag]:otherDigest},{repoDigests:[`${repo}@${remoteDigest}`]})]){
  assert.throws(()=>writeDockerPublicationReceipt(planFile,tag,receipt,{run}));
  assert.equal(fs.existsSync(receipt),false,'A failed or unknown readback must not create a success receipt');
 }
 const run=dockerMock({[tag]:remoteDigest},{repoDigests:[`${repo}@${remoteDigest}`]});
 const proof=writeDockerPublicationReceipt(planFile,tag,receipt,{run}),bytes=fs.readFileSync(receipt);
 assert.deepEqual(JSON.parse(bytes),proof);assert.equal(proof.published,true);
 assert.throws(()=>writeDockerPublicationReceipt(planFile,tag,receipt,{run}),/EEXIST/);
 assert.deepEqual(fs.readFileSync(receipt),bytes);
}));

for(const scenario of ['success','digest-mismatch','readback-timeout','push-failed'])test(`actual platform Docker loop requires post-push confirmation before completion: ${scenario}`,()=>fixture(root=>{
 const script=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
 const start=script.indexOf('docker_push_plan() {'),end=script.indexOf('\nif [ ${#SELECTED_API_PLANS',start);
 assert.ok(start>0&&end>start);const loop=script.slice(start,end);
 fs.mkdirSync(path.join(root,'Microi.Server/Microi.net.Api/bin/Release'),{recursive:true});
 const git=process.platform==='win32'?spawnSync('git',['--exec-path'],{encoding:'utf8'}):null;
 const bash=git?path.resolve(git.stdout.trim(),'../../..','bin/bash.exe'):'bash';
 const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:root,encoding:'utf8',timeout:15000,input:`set -e
MICROI_RELEASE_GATE_DIR="$PWD"; MICROI_RELEASE_CANDIDATE=fixture; PUBLISH_DIR=fixture; MICROI_ENCRYPTION_RECEIPT=fixture
COMMAND_LOG="$PWD/budget-calls.txt"
PUBLISH_BACKEND=true; BUILD_CLIENT=false; HAS_ENCRYPT=true; DOCKER_REGISTRY=registry.test; DOCKER_NAMESPACE=team
print_step(){ :; }; print_info(){ :; }; print_warning(){ :; }; print_fail(){ printf 'FAILED=%s\\n' "$*"; exit 17; }; print_success(){ printf 'COMPLETE=%s\\n' "$*"; }
run_release_command(){ printf 'BUDGET=%s\\n' "$*" >> "$COMMAND_LOG"; "$@"; }
node(){
 if [ "$2" = docker-confirm ]; then
  printf 'CONFIRM=%s\\n' "$4"
  ${scenario==='digest-mismatch'?'return 1':scenario==='readback-timeout'?'return 124':':' }
  printf 'verified' > "$5"
 fi
}
docker(){
 if [ "$1" = push ]; then printf 'PUSH=%s\\n' "$2"; ${scenario==='push-failed'?'return 42':':'}; fi
}
${loop}
docker_push_plan 'fixture|api|local|api:{latest},api:{version}' 8.6.4
`});
 assert.ifError(run.error);
 const success=scenario==='success';assert.equal(run.status===0,success,run.stdout+'\n'+run.stderr);
 assert.equal(run.stdout.includes('COMPLETE='),success);
 const proofs=fs.readdirSync(root).filter(file=>/-published-\d+\.json$/.test(file));assert.equal(proofs.length,success?2:0);
 if(success){assert.match(run.stdout,/PUSH=.*:latest[\s\S]*CONFIRM=.*:latest[\s\S]*PUSH=.*:v8\.6\.4[\s\S]*CONFIRM=.*:v8\.6\.4[\s\S]*COMPLETE=/);}
 else assert.equal(run.stdout.includes('PUSH=registry.test/team/api:v8.6.4'),false,'Failed first tag prevents the next tag');
 const budgetCalls=fs.readFileSync(path.join(root,'budget-calls.txt'),'utf8');
 for(const command of ['release-artifact.mjs','release-encryption.mjs image','docker tag','docker image inspect','docker push'])assert.ok(budgetCalls.includes(`BUDGET=${command.startsWith('release-')?'node Microi.Server/tools/':''}${command}`),budgetCalls);
 if(scenario!=='push-failed')assert.match(budgetCalls,/BUDGET=node Microi.Server\/tools\/release-remote-collision.mjs docker-confirm/);
}));
test('formal shell runs whole-set preflight before first NuGet and Docker baseline before any version/latest push',()=>{
 const script=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
 const nuget=script.indexOf('release-remote-collision.mjs nuget-preflight'),loop=script.indexOf('while IFS= read -r -d');assert.ok(nuget>0&&nuget<loop);
 const docker=script.slice(script.indexOf('docker_push_plan() {'));assert.ok(docker.indexOf('docker-baseline')<docker.indexOf('for _img_tag'));
 assert.match(docker,/docker-recheck[^\n]+\|\| print_fail[^\n]+\n\s*run_release_command docker push/);
});
test('two same-version formal preflights create independent proof files and preserve both originals',()=>fixture(root=>{
 const script=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
 const lines=script.split('\n').filter(line=>line.includes('_nuget_remote_receipt=')||line.includes('release-remote-collision.mjs nuget-preflight')).join('\n');
 const budget=script.slice(script.indexOf('# 从交互选项完成开始计时'),script.indexOf('# Windows (Git Bash) 下'));
 assert.equal(lines.split('\n').length,2);
 const git=process.platform==='win32'?spawnSync('git',['--exec-path'],{encoding:'utf8'}):null;
 const bash=git?path.resolve(git.stdout.trim(),'../../..','bin/bash.exe'):'bash';
 const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:root,encoding:'utf8',input:`set -e\nMICROI_RELEASE_GATE_DIR="$PWD"; VERSION=8.6.4; _nupkg_list_file=fixture; CONFIG_FILE=fixture\nprint_fail(){ exit 17; }\n${budget}\nnode(){ ${quote(process.execPath)} -e 'require("fs").writeFileSync(process.argv[1],"fresh remote proof",{flag:"wx"})' "\${@: -1}"; }\n${lines}\n${lines}\n`});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
 const files=fs.readdirSync(root);assert.equal(files.length,2);assert.ok(files.every(file=>/^nuget-remote-8\.6\.4-\d+-\d+\.json$/.test(file)));
 assert.ok(files.every(file=>fs.readFileSync(path.join(root,file),'utf8')==='fresh remote proof'));
}));
