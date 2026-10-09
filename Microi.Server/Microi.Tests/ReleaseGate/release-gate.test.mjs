import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const begin=source.indexOf('# 选定版本已准备；在官方资源写入、NuGet/Docker 推送之前执行完整业务回归。');
const end=source.indexOf('# 发布只清理所选范围的开发服务',begin);
assert.ok(begin>0&&end>begin,'The release script must contain the actual full-test gate');
const gate=source.slice(begin,end);
const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';

for(const scenario of [
 {name:'configured Hangzhou identity preserves the independent Beijing credential cache',passed:true},
 {name:'configured Beijing identity preserves the independent Hangzhou credential cache',region:'beijing',passed:true},
 {name:'missing configured username',user:'',passed:false},
 {name:'missing configured password',password:'',passed:false},
 {name:'placeholder configured username',user:'your-username',passed:false},
 {name:'placeholder configured password',password:'your-password',passed:false},
 {name:'unsupported configured registry',region:'shanghai',passed:false},
 {name:'configured registry login denied',denyLogin:true,passed:false},
 {name:'independent registry cached credential unavailable',cache:false,passed:false}
])test(`documentation registry credentials: ${scenario.name}`,()=>{
 const directory=fs.mkdtempSync(path.join(root,'.tmp','docs registry credential '));
 const password=scenario.password??'fictional-docs-password-$"\'\\\nonly-fixture';
 const username=scenario.user??'fixture-config-user',region=scenario.region??'hangzhou';
 fs.writeFileSync(path.join(directory,'Microi一键编译发布配置.json'),JSON.stringify({Region:region,Namespace:'fixture-namespace',Username:username,Password:password}));
 const reader=source.slice(source.indexOf('json_value() {'),source.indexOf('# 自动递增版本号'));
 const config=source.slice(source.indexOf('# NuGet 配置'),source.indexOf('# DLL 加密能力检测'));
 const docsStart=source.indexOf('# ─── 阶段（条件）: 发布官方网站文档');
 const marker=source.indexOf('# 官方网站文档镜像仓库登录',docsStart);
 const loginStart=marker>=0?marker:source.indexOf('    print_step "登录 registry.cn-beijing.aliyuncs.com',docsStart);
 const loginEnd=source.indexOf('    print_success "官方网站文档发布成功"',loginStart);
 assert.ok(loginStart>docsStart&&loginEnd>loginStart,'Actual documentation login/push branch must exist');
 try{
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:directory,encoding:'utf8',env:{...process.env,DOC_EXPECTED_USER:username,DOC_EXPECTED_PASSWORD:password},input:`
print_info(){ :; }; print_step(){ :; }; print_success(){ :; }
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
DOCKER_REGION=hangzhou; DOCKER_NAMESPACE=your-namespace; DOCKER_USERNAME=your-username; DOCKER_PASSWORD=your-password
${reader}
${config}
docker(){
 local command="$1"; shift
 if [ "$command" = login ]; then
  local user='' registry='' stdin=false
  while [ "$#" -gt 0 ]; do
   case "$1" in
    --username|-u) user="$2"; shift 2;;
    --username=*) user="\${1#*=}"; shift;;
    --password-stdin) stdin=true; shift;;
    --password|-p|--password=*) printf 'PASSWORD_ARG_REJECTED\\n' >&2; return 23;;
    *) registry="$1"; shift;;
   esac
  done
  [ "$stdin" = true ] || return 23
  local supplied; supplied=$(cat)
  [ "$user" = "$DOC_EXPECTED_USER" ] && [ "$supplied" = "$DOC_EXPECTED_PASSWORD" ] || return 24
  [ "$registry" = "registry.cn-$DOCKER_REGION.aliyuncs.com" ] || return 25
  ${scenario.denyLogin?'return 26':':'}
  printf '%s\\n' "$registry" >> auth.ok
  printf 'LOGIN=%s\\n' "$registry"
 elif [ "$command" = manifest ]; then
  [ "$1" = inspect ] || return 27
  local target="$2" configured="registry.cn-$DOCKER_REGION.aliyuncs.com"
  if [[ "$target" == "$configured/"* ]]; then
   [ -f auth.ok ] && grep -Fxq "$configured" auth.ok || return 28
  else
   ${scenario.cache===false?'return 29':':'}
  fi
  printf 'MANIFEST=%s\\n' "$target" >> manifest.ok
 elif [ "$command" = tag ]; then :
 elif [ "$command" = push ]; then
  [ -f manifest.ok ] && grep -Fxq "MANIFEST=$1" manifest.ok || return 30
  printf 'PUSH=%s\\n' "$1"
 else return 31; fi
}
${source.slice(loginStart,loginEnd)}
printf 'DOC_COMPLETE\\n'
`});
  assert.ifError(run.error);assert.equal(run.status,scenario.passed?0:17,run.stderr);
  assert.equal(run.stdout.includes('DOC_COMPLETE'),scenario.passed);
  if(password){
   assert.equal(run.stdout.includes(password),false,'Password must never enter command output');
   assert.equal(run.stderr.includes(password),false,'Password must never enter error output');
  }
  if(scenario.passed){
   assert.equal(run.stdout.match(/LOGIN=/g)?.length,1,'Only the configured registry may have its credential cache updated');
   assert.ok(run.stdout.includes(`LOGIN=registry.cn-${region}.aliyuncs.com`));
   const targets=['registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest','registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest'];
   assert.deepEqual(run.stdout.split(/\r?\n/).filter(line=>line.startsWith('PUSH=')).map(line=>line.slice(5)),targets,'Existing channels and push order must be retained');
   assert.deepEqual(fs.readFileSync(path.join(directory,'manifest.ok'),'utf8').trim().split(/\r?\n/),targets.map(target=>'MANIFEST='+target));
  }else assert.equal(run.stdout.includes('PUSH='),false,'Credential failures must stop before either upload');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

for (const scenario of [
 {name:'open source checkout without closed projects',projects:[],script:false,passed:true,encrypted:false},
 {name:'all five closed projects and encryption script',projects:['Microi.net','Microi.AI','Microi.MCP','Microi.WorkFlow','Microi.Vision'],script:true,passed:true,encrypted:true},
 {name:'closed sources with missing encryption script',projects:['Microi.net','Microi.AI','Microi.MCP','Microi.WorkFlow','Microi.Vision'],script:false,passed:false},
 ...['Microi.net','Microi.AI','Microi.MCP','Microi.WorkFlow','Microi.Vision'].map(project=>({name:`partial closed source ${project}`,projects:[project],script:true,passed:false}))
]) test(`encryption capability fails closed: ${scenario.name}`,()=>{
 const directory=fs.mkdtempSync(path.join(root,'.tmp','release-encryption-capability-'));
 const names=['Microi.net','Microi.AI','Microi.MCP','Microi.WorkFlow','Microi.Vision'];
 try {
  for(const project of scenario.projects){
   const folder=path.join(directory,'Microi.Server',project);fs.mkdirSync(folder,{recursive:true});
   fs.writeFileSync(path.join(folder,project+'.csproj'),'<Project />');
  }
  if(scenario.script){const script=path.join(directory,'Microi.Server/Microi.net/License/scripts/encrypt-dll.sh');fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'exit 0\n');}
  const begin=source.indexOf('# DLL 加密能力检测'),end=source.indexOf('# 版本信息',begin);
  assert.ok(begin>0&&end>begin);
  const result=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:directory,encoding:'utf8',input:`
print_info(){ :; }
print_success(){ :; }
print_fail(){ printf '%s\\n' "$*"; exit 17; }
ENCRYPTED_PROJECTS=(${names.join(' ')})
${source.slice(begin,end)}
printf 'PUBLICATION_REACHED=%s\\n' "$HAS_ENCRYPT"
`});
  assert.ifError(result.error);assert.equal(result.status,scenario.passed?0:17,result.stderr);
  assert.equal(result.stdout.includes('PUBLICATION_REACHED='),scenario.passed);
  if(scenario.passed)assert.ok(result.stdout.includes(`PUBLICATION_REACHED=${scenario.encrypted}`));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('release JSON reader handles numeric ports, escaped strings, BOM and nested settings',()=>{
 const directory=path.join(root,'.tmp','release-json-reader-fixture');fs.mkdirSync(directory,{recursive:true});
 const filename=path.join(directory,'config.json');
 fs.writeFileSync(filename,'\uFEFF'+JSON.stringify({AppSettings:{OsClientRedisPort:62629,Value:'a"b\\c',Nothing:null}}));
 const helper=source.slice(source.indexOf('json_value() {'),source.indexOf('# 自动递增版本号'));
 const quoted="'"+filename.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
 try{
  for(const [key,expected] of [['OsClientRedisPort','62629'],['Value','a"b\\c'],['Nothing',''],['Missing','']]){
   const run=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:helper+'\njson_value '+key+' '+quoted+'\n'});
   assert.ifError(run.error);assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,expected);
  }
 }finally{fs.unlinkSync(filename);fs.rmdirSync(directory);}
});

test('same-version Docker hotfix keeps full gates and excludes version and remote-resource publication',()=>{
 assert.match(source,/if \[ "\$\{1:-\}" = "--docker-only-hotfix" \]/);
 const hotfix=source.slice(source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]'),source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]')+750);
 for(const marker of ['VERSION="$CURRENT_VERSION"','BUMP_VERSION=false','PUSH_NUGET=false']) assert.ok(hotfix.includes(marker),marker);
 assert.match(source,/if \[ "\$PUBLISH_BACKEND" = true \] && \[ "\$MICROI_DOCKER_ONLY_HOTFIX" != true \]; then[\s\S]*?refresh-resources\.mjs --publish/);
 assert.match(gate,/-Mode Full -Configuration Release/);
 assert.doesNotMatch(gate,/MICROI_DOCKER_ONLY_HOTFIX/);
 assert.ok(gate.includes('-SolutionPath "$SLN_FILE"'),'Full gate must use the detected solution in an isolated checkout');
});

test('isolated release targets its own service ports and retains shared defaults',()=>{
 const preparation=source.slice(source.indexOf('prepare_release_workspace() {'),source.indexOf('handle_session_interrupt() {'));
 for(const ports of [null,{backend:63681,frontend:63683}]){
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:root,encoding:'utf8',input:`
is_windows_shell(){ return 0; }
print_info(){ :; }
powershell.exe(){ printf '%s\\n' "$*"; }
unset MICROI_RELEASE_BACKEND_PORT MICROI_RELEASE_FRONTEND_PORT
${ports?`MICROI_RELEASE_BACKEND_PORT=${ports.backend}\nMICROI_RELEASE_FRONTEND_PORT=${ports.frontend}`:''}
${preparation}
BUILD_BACKEND=true; BUILD_CLIENT=false
prepare_release_workspace
`});
  assert.ifError(run.error);assert.equal(run.status,0,run.stderr);
  assert.ok(run.stdout.includes(`-BackendPort ${ports?.backend||61501}`),run.stdout);
  assert.ok(run.stdout.includes(`-FrontendPort ${ports?.frontend||61500}`),run.stdout);
  assert.match(run.stdout,/-Action PrepareRelease -ReleaseScope api/);
 }
});

for(const scenario of [
 {name:'failed full tests prevent platform publication',backend:true,client:false,exit:19,passed:false,called:true},
 {name:'successful full tests allow platform publication',backend:true,client:false,exit:0,passed:true,called:true},
 {name:'frontend publication also requires full tests',backend:false,client:true,exit:19,passed:false,called:true},
 {name:'prebuilt Docker push cannot bypass failed tests',backend:false,client:false,docker:true,exit:19,passed:false,called:true},
 {name:'documentation-only work avoids the backend gate',backend:false,client:false,exit:19,passed:true,called:false},
 {name:'Full-only mode enforces every test before ending without publication',fullOnly:true,backend:false,client:false,exit:0,passed:false,exitStatus:0,called:true},
 {name:'Full-only test failure prevents successful completion',fullOnly:true,backend:false,client:false,exit:19,passed:false,called:true}
])test(scenario.name,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }
print_success(){ :; }
print_fail(){ exit 1; }
pwsh(){ printf 'TEST_ARGUMENTS=%s\\n' "$*"; return ${scenario.exit}; }
node(){ printf 'CANDIDATE_ARGUMENTS=%s\\n' "$*"; return 0; }
PUBLISH_BACKEND=${scenario.backend}
MICROI_FULL_ONLY=${scenario.fullOnly||false}
BUILD_CLIENT=${scenario.client}
PLATFORM_DOCKER_SELECTED=${scenario.docker||false}
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);
 assert.equal(result.status,scenario.exitStatus??(scenario.passed?0:1),result.stderr);
 assert.equal(result.stdout.includes('PUBLICATION_REACHED'),scenario.passed);
 assert.equal(result.stdout.includes('TEST_ARGUMENTS='),scenario.called);
 if(scenario.called)assert.match(result.stdout,/-Mode Full -Configuration Release/);
});

test('prebuilt artifacts require Full source provenance and are rechecked before every push',()=>{
 assert.match(source,/PLATFORM_DOCKER_SELECTED=true/);
 const start=source.indexOf('docker_push_plan() {'),end=source.indexOf('if [ ${#SELECTED_API_PLANS',start);
 const push=source.slice(start,end);
 assert.match(push,/local receipt_mode=verify/);
 assert.match(push,/release-artifact\.mjs "\$receipt_mode"/);
 assert.ok(push.lastIndexOf('release-artifact.mjs verify')<push.lastIndexOf('docker push'));
 assert.match(push,/release-artifact\.mjs verify[\s\S]*?print_fail/);
});

test('formal frontend plan publishes client latest and version from the same accepted image',()=>{
 const plan=source.split('\n').find(line=>line.includes('"前端镜像-正式和测试|client|'));
 assert.ok(plan,'formal frontend plan must exist');
 const tags=plan.match(/"([^"]+)"/)?.[1].split('|')[3].split(',');
 for(const tag of ['microi-client:{latest}','microi-client:{version}','microi-client-dev:{latest}']){
  assert.ok(tags.includes(tag),`missing ${tag}`);
 }
 const testPlan=source.split('\n').find(line=>line.includes('"前端镜像-测试|client|'));
 assert.ok(testPlan&&!testPlan.includes('microi-client:{latest}'),'test-only plan must not overwrite the formal tag');
});

for(const mode of ['capture','verify'])test(`candidate ${mode} failure prevents publication`,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }
print_success(){ :; }
print_fail(){ exit 1; }
pwsh(){ return 0; }
node(){ [ "$2" != "${mode}" ]; }
PUBLISH_BACKEND=true
BUILD_CLIENT=false
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);assert.equal(result.status,1);assert.equal(result.stdout.includes('PUBLICATION_REACHED'),false);
});

test('publication refuses resource merge drift and preserves the independent Panel version',()=>{
 assert.match(source,/refresh-resources\.mjs --publish[^\n]*--require-unchanged-candidate/);
 assert.match(source,/find Microi\.Server[^\n]*-not -path "\*\/Microi\.Panel\/\*"/);
});

test('selected versions are frozen before Full and every publication still waits for successful Full',()=>{
 const version=source.indexOf('# ─── 阶段（条件）: 更新版本号'),capture=source.indexOf('release-candidate.mjs capture');
 assert.ok(version>0&&version<begin&&begin<capture,'Full must test the selected release version, not the preceding version');
 assert.ok(source.indexOf('# 前端资源预检必须发生')<version,'Resource preflight must still precede version preparation');
 for(const marker of ['refresh-resources.mjs --publish','dotnet nuget push']){
   const offset=source.indexOf(marker);assert.ok(offset>end,`${marker} must follow the full-test gate`);
 }
 assert.equal(source.match(/print_step "更新 Directory\.Build\.props/g)?.length,1,'Selected version preparation must not execute twice');
});

test('real schedule stores belong to Full and their settings fail fast before builds',()=>{
 const runner=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/run-tests.ps1'),'utf8');
 const preflight=runner.slice(runner.indexOf('if ($Mode -eq "Full")'),runner.indexOf('New-Item -ItemType Directory'));
 for(const name of ['MICROI_TEST_SCHEDULE_REDIS','MICROI_TEST_SCHEDULE_MYSQL'])assert.ok(preflight.includes(name),name);
 for(const name of ['MicroiTaskSchedulingCacheTests','MicroiTaskSchedulingSharedStoreTests']){
  const fixture=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/Common',name+'.cs'),'utf8');
  assert.match(fixture,/\[Trait\("Category", "FullStack"\)\]/);
  assert.doesNotMatch(fixture,/Assert\.Skip\(/);
 }
});
