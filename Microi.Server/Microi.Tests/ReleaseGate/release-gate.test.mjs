import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const begin=source.indexOf('# 选定版本已准备；在官方资源写入、NuGet/Docker 推送之前执行平台自动化回归。');
const end=source.indexOf('# 发布只清理所选范围的开发服务',begin);
assert.ok(begin>0&&end>begin,'The release script must contain the actual scoped test gate');
const gate=source.slice(begin,end);
const policy=source.slice(source.indexOf('MICROI_FULL_ONLY=false'),source.indexOf('# Windows (Git Bash) 下'));
const budgetFunctions=source.slice(source.indexOf('# 从交互选项完成开始计时'),source.indexOf('# Windows (Git Bash) 下'));
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
${budgetFunctions}
node(){ if [ "$2" = probe ]; then return 0; fi; command node "$@"; }
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

test('release-only gate directory override is absolute, keeps defaults and relocates every receipt',()=>{
 const setup=source.slice(source.indexOf('# 发布进程专用输出目录'),source.indexOf('MICROI_RELEASE_SCRATCH=$(node'));
 assert.match(setup,/MICROI_RELEASE_GATE_DIR="\$\{MICROI_RELEASE_GATE_DIR:-\$PWD\/\.tmp\/microi-release-gate\}"/);
 const directory=fs.mkdtempSync(path.join(root,'.tmp','release gate path '));
 const custom=path.join(directory,'external gate with spaces');
 try{
  for(const [value,passed] of [[custom,true],['relative-gate',false]]){
   const env={...process.env,MICROI_RELEASE_GATE_DIR:value};
   const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:directory,encoding:'utf8',env,input:`
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
is_windows_shell(){ ${process.platform==='win32'?'return 0':'return 1'}; }
${setup}
printf 'GATE_DIR=%s\\n' "$MICROI_RELEASE_GATE_DIR"
`});
   assert.ifError(run.error);assert.equal(run.status,passed?0:17,run.stderr);
   assert.equal(run.stdout.includes('GATE_DIR='),passed);
  }
  assert.ok(fs.statSync(custom).isDirectory());
  assert.equal(fs.existsSync(path.join(directory,'relative-gate')),false);
  for(const marker of [
   'MICROI_ENCRYPTION_RECEIPT="$MICROI_RELEASE_GATE_DIR/api-encryption.json"',
   'MICROI_RELEASE_CANDIDATE="$MICROI_RELEASE_GATE_DIR/candidate-',
   '_full_test_results="$MICROI_RELEASE_GATE_DIR/',
   '_nupkg_list_file="$MICROI_RELEASE_GATE_DIR/',
   '_nupkg_check_file="$MICROI_RELEASE_GATE_DIR/',
   'local receipt="$MICROI_RELEASE_GATE_DIR/'
  ])assert.ok(source.includes(marker),marker);
  assert.ok(gate.includes('-ResultsDirectory "$_full_test_results"'));
  for(const file of ['release-test-matrix.json','release-test-matrix-outcomes.json','release-test-matrix-result.json','platform-release-plan.json','platform-release-tests.json','platform-release-result.json'])
   assert.ok(gate.includes('"$_full_test_results/'+file+'"'),'Each selected scope must use the same isolated result directory');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('same-version Docker hotfix keeps scoped gates and excludes version and remote-resource publication',()=>{
 assert.match(source,/if \[ "\$\{1:-\}" = "--docker-only-hotfix" \]/);
 const hotfix=source.slice(source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]'),source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]')+750);
 for(const marker of ['VERSION="$CURRENT_VERSION"','BUMP_VERSION=false','PUSH_NUGET=false']) assert.ok(hotfix.includes(marker),marker);
 assert.match(source,/if \[ "\$PUBLISH_BACKEND" = true \] && \[ "\$MICROI_DOCKER_ONLY_HOTFIX" != true \]; then[\s\S]*?refresh-resources\.mjs --publish/);
 assert.match(gate,/-Mode "\$MICROI_RELEASE_TEST_POLICY" -Configuration Release/);
 assert.doesNotMatch(gate,/MICROI_DOCKER_ONLY_HOTFIX/);
 assert.ok(gate.includes('-SolutionPath "$SLN_FILE"'),'The gate must use the detected solution in an isolated checkout');
});

test('direct release refuses the retired skip-tests flag before preparation or publication',()=>{
 for(const args of ['--docker-only-hotfix --skip-tests','--full-only --skip-tests','--skip-tests']){
  const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`set -- ${args}\n${policy}\nprintf 'PREPARATION_REACHED\\n'\n`});
  assert.ifError(result.error);assert.notEqual(result.status,0,args);
  assert.equal(result.stdout.includes('PREPARATION_REACHED'),false,args);
 }
 for(const [args,expected] of [['','PlatformRelease'],['--docker-only-hotfix','PlatformRelease'],['--full-only','Full']]){
  const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',env:{...process.env,MICROI_RELEASE_TEST_POLICY:'SmokeOnly',MICROI_RELEASE_SKIP_TESTS:'true'},input:`set -- ${args}\n${policy}\nprintf '%s' "$MICROI_RELEASE_TEST_POLICY"\n`});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,expected);
 }
});

test('isolated release targets its own service ports and retains shared defaults',()=>{
 const preparation=source.slice(source.indexOf('prepare_release_workspace() {'),source.indexOf('handle_session_interrupt() {'));
 for(const ports of [null,{backend:63681,frontend:63683}]){
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:root,encoding:'utf8',input:`
is_windows_shell(){ return 0; }
print_info(){ :; }
powershell.exe(){ printf '%s\\n' "$*"; }
${budgetFunctions}
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
 {name:'failed platform tests prevent platform publication',backend:true,client:false,exit:19,passed:false,called:true},
 {name:'successful platform tests allow platform publication',backend:true,client:false,exit:0,passed:true,called:true},
 {name:'frontend publication also requires platform tests',backend:false,client:true,exit:19,passed:false,called:true},
 {name:'prebuilt Docker push cannot bypass failed tests',backend:false,client:false,docker:true,exit:19,passed:false,called:true},
 {name:'documentation-only work avoids the backend gate',backend:false,client:false,exit:19,passed:true,called:false},
 {name:'Full-only mode enforces every test before ending without publication',fullOnly:true,backend:false,client:false,exit:0,passed:false,exitStatus:0,called:true},
 {name:'Full-only test failure prevents successful completion',fullOnly:true,backend:false,client:false,exit:19,passed:false,called:true}
])test(scenario.name,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }
print_success(){ :; }
print_fail(){ exit 1; }
is_windows_shell(){ return 1; }
pwsh(){ printf 'TEST_ARGUMENTS=%s\\n' "$*"; return ${scenario.exit}; }
node(){ printf 'CANDIDATE_ARGUMENTS=%s\\n' "$*"; return 0; }
unset MICROI_TEST_SQLSERVER_EXEMPTION_RECEIPT MICROI_TEST_SQLSERVER_EXEMPTION_SHA256
set -- ${scenario.fullOnly?'--full-only':''}
${policy}
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
 if(scenario.called){
  assert.ok(result.stdout.includes(`-Mode ${scenario.fullOnly?'Full':'PlatformRelease'} -Configuration Release`),result.stdout);
  if(scenario.exit===0)assert.ok(result.stdout.includes(`release-test-matrix.mjs ${scenario.fullOnly?'verify ':'verify-platform '}`),result.stdout);
 }
});

for(const [receipt,sha]of [['/fixture/explicit receipt.json','a'.repeat(64)],['/fixture/explicit receipt.json',''],['','a'.repeat(64)]])
test('retired SQL Server skip exemption cannot start platform tests or publication '+Boolean(receipt)+'/'+Boolean(sha),()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',env:{...process.env,
  MICROI_TEST_SQLSERVER_EXEMPTION_RECEIPT:receipt,MICROI_TEST_SQLSERVER_EXEMPTION_SHA256:sha},input:`
print_phase(){ :; }; print_success(){ :; }; print_fail(){ exit 1; }
is_windows_shell(){ return 1; }
pwsh(){ printf 'TEST_ARGUMENTS=%s\\n' "$*"; return 0; }
node(){ return 0; }
set --
${policy}
PUBLISH_BACKEND=true; MICROI_FULL_ONLY=false; BUILD_CLIENT=false; PLATFORM_DOCKER_SELECTED=false
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);assert.equal(result.status,1,result.stderr);
 assert.equal(result.stdout.includes('PUBLICATION_REACHED'),false);
 assert.equal(result.stdout.includes('TEST_ARGUMENTS='),false);
});

for(const fullOnly of [false,true])test(`matrix readback rejection blocks the successful ${fullOnly?'Full':'PlatformRelease'} test process`,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }; print_success(){ :; }; print_fail(){ exit 1; }
is_windows_shell(){ return 1; }
pwsh(){ return 0; }
node(){ case "$1" in *release-test-matrix.mjs) return 23;; *) return 0;; esac; }
unset MICROI_TEST_SQLSERVER_EXEMPTION_RECEIPT MICROI_TEST_SQLSERVER_EXEMPTION_SHA256
set -- ${fullOnly?'--full-only':''}
${policy}
PUBLISH_BACKEND=true; BUILD_CLIENT=false; PLATFORM_DOCKER_SELECTED=false
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);assert.equal(result.status,1,result.stderr);
 assert.equal(result.stdout.includes('PUBLICATION_REACHED'),false);
});

test('prebuilt artifacts require matching source and test scope provenance and are rechecked before every push',()=>{
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
is_windows_shell(){ return 1; }
pwsh(){ return 0; }
node(){ [ "$2" != "${mode}" ]; }
set --
${policy}
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

test('selected versions are frozen before scoped tests and every publication waits for success',()=>{
 const version=source.indexOf('# ─── 阶段（条件）: 更新版本号'),capture=source.indexOf('release-candidate.mjs capture');
 assert.ok(version>0&&version<begin&&begin<capture,'The selected scope must test the selected release version, not the preceding version');
 assert.ok(source.indexOf('# 前端资源预检必须发生')<version,'Resource preflight must still precede version preparation');
 for(const marker of ['refresh-resources.mjs --publish','secure-nuget-push.mjs push']){
   const offset=source.indexOf(marker);assert.ok(offset>end,`${marker} must follow the selected test gate`);
 }
 assert.equal(source.match(/print_step "更新 Directory\.Build\.props/g)?.length,1,'Selected version preparation must not execute twice');
});

test('real schedule stores belong to Full and their settings fail fast before builds',()=>{
 const runner=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/run-tests.ps1'),'utf8');
 const preflight=runner.slice(runner.indexOf('if ($Mode -eq "Full")'),runner.indexOf('New-Item -ItemType Directory'));
 const matrix=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/ReleaseGate/release-test-matrix.mjs'),'utf8');
 assert.match(preflight,/node \$matrixTool freeze/u);
 assert.match(preflight,/\$required = @\(\$matrixPlan\.requiredEnvironment\)/u);
 for(const name of ['MICROI_TEST_SCHEDULE_REDIS','MICROI_TEST_SCHEDULE_MYSQL'])assert.ok(matrix.includes(name),name);
 for(const name of ['MicroiTaskSchedulingCacheTests','MicroiTaskSchedulingSharedStoreTests']){
  const fixture=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/Common',name+'.cs'),'utf8');
  assert.match(fixture,/\[Trait\("Category", "FullStack"\)\]/);
  assert.doesNotMatch(fixture,/Assert\.Skip\(/);
 }
});

for(const mode of ['PlatformRelease','Expired','Full'])test(`actual shell budget integration: ${mode}`,()=>{
 const directory=fs.mkdtempSync(path.join(root,'.tmp','release-budget-shell-'));
 const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
 const start=source.indexOf('START_TIME=$(date +%s)',source.indexOf('# 开始执行')),finish=source.indexOf('# 按所选产品取得锁',start);
 const phaseStart=source.indexOf('print_phase() {'),phaseEnd=source.indexOf('print_step() {',phaseStart);
 assert.ok(start>0&&finish>start&&phaseStart>0&&phaseEnd>phaseStart);
 const now=Math.floor(Date.now()/1000),initial=mode==='PlatformRelease'?now:now-1801;
 const marker=path.join(directory,'executed.txt');
 try{
  // 回放真实初始化、阶段与命令包装器；只用本地短 Node 子进程，不调用编译器或 Docker。
  const result=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:root,encoding:'utf8',timeout:20000,input:`
set -e
print_info(){ :; }; is_windows_shell(){ return 1; }
fixture_now=${initial}
date(){ if [ "$1" = +%s ]; then printf '%s' "$fixture_now"; else command date "$@"; fi; }
${budgetFunctions}
MICROI_RELEASE_GATE_DIR=${quote(directory)}
MICROI_RELEASE_BUDGET_TOOL=${quote(path.join(root,'Microi.Server/tools/release-budget.mjs'))}
MICROI_FULL_ONLY=${mode==='Full'?'true':'false'}
${source.slice(start,finish)}
${source.slice(phaseStart,phaseEnd)}
original_start="$START_TIME"; original_deadline="$MICROI_RELEASE_DEADLINE"
fixture_now=${now}
${mode==='Expired'?`
set +e
( run_release_command ${quote(process.execPath)} -e ${quote('require("fs").writeFileSync(process.argv[1],"unexpected")')} ${quote(marker)} )
command_exit=$?
( check_release_budget ); check_exit=$?
set -e
[ "$command_exit" = 124 ] && [ "$check_exit" = 124 ]
printf 'EXPIRED_BEFORE_EXECUTION\\n'
`:`
for stage in tests build docker; do
  print_phase "$stage"
  [ "$START_TIME" = "$original_start" ] && [ "$MICROI_RELEASE_DEADLINE" = "$original_deadline" ]
  run_release_command ${quote(process.execPath)} -e ${quote('require("fs").appendFileSync(process.argv[1],process.argv[2]+String.fromCharCode(10))')} ${quote(marker)} "$stage"
done
if [ "$MICROI_FULL_ONLY" = true ]; then [ -z "$MICROI_RELEASE_DEADLINE" ]; else [ "$MICROI_RELEASE_DEADLINE" = "$((START_TIME + 1800))" ]; fi
printf 'BUDGET_SCOPE_VALID\\n'
`}
`});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  if(mode==='Expired'){
   assert.match(result.stdout,/EXPIRED_BEFORE_EXECUTION/);assert.equal(fs.existsSync(marker),false);
  }else{
   assert.match(result.stdout,/BUDGET_SCOPE_VALID/);assert.equal(fs.readFileSync(marker,'utf8'),'tests\nbuild\ndocker\n');
   const timing=fs.readdirSync(directory).filter(name=>name.startsWith('release-timing-'));
   if(mode==='Full')assert.deepEqual(timing,[]);
   else{
    assert.equal(timing.length,1);
    const rows=fs.readFileSync(path.join(directory,timing[0]),'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows.map(row=>row.phase),['tests','build']);
    assert.ok(rows.every(row=>row.startedEpochSeconds===initial&&row.deadlineEpochSeconds===initial+1800&&row.scope==='PlatformRelease'));
   }
  }
 }finally{fs.rmSync(directory,{recursive:true});}
});
