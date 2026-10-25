import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const section=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start,from);return source.slice(start,end);};
const policy=section('MICROI_FULL_ONLY=false','# 从交互选项完成开始计时');
const helpers=section('sed_inplace() {','PHASE_NUM=0');
const version=section('if [ ! -f "Microi.Server/Directory.Build.props" ]','# 前置交互');
const selection=section('# --- 发布模式：','# --- Chrome 49');
const update=section('# ─── 阶段（条件）: 更新版本号','# 选定版本已准备');
const plans=section('DOCKER_PLANS=(', '# 【前端 package.json');
const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';

for(const scenario of [
 {name:'blank menu defaults to complete formal release',complete:true},
 {name:'explicit menu 8 completes every channel',mode:'8',complete:true},
 {name:'explicit platform flag needs no scope prompts',flag:'--platform-release',complete:true},
 {name:'dirty version still increments for a new complete flag release',flag:'--platform-release',complete:true,head:'1.2.2'},
 {name:'dirty version still increments for a new menu 8 release',mode:'8',complete:true,head:'1.2.2'},
 {name:'dirty version still increments for the blank default menu',complete:true,head:'1.2.2'},
 {name:'explicit verified-candidate version continues without another increment',flag:'--platform-release --release-version=1.2.3',complete:true,head:'1.2.2',version:'1.2.3'},
 {name:'manual verified-candidate version continues without another increment',mode:'8',manualVersion:'1.2.3',complete:true,head:'1.2.2',version:'1.2.3'},
 {name:'partial backend entry retains its previous dirty-version suggestion',mode:'2',backend:true,head:'1.2.2',version:'1.2.3'},
 {name:'backend-only entry remains partial',mode:'2',backend:true},
 {name:'legacy platform entry remains partial',mode:'4',backend:true,client:true},
 {name:'website-only entry preserves the platform version',mode:'6',website:true,version:'1.2.3'},
 {name:'missing NuGet fails before changing versions',flag:'--platform-release',nuget:false,fail:true},
 {name:'missing PC sources fail before changing versions',flag:'--platform-release',clientAvailable:false,fail:true},
 {name:'missing Docker fails before changing versions',flag:'--platform-release',docker:false,fail:true},
 {name:'missing website fails before changing versions',flag:'--platform-release',docs:false,fail:true},
 {name:'test-only API plans cannot satisfy complete release',flag:'--platform-release',removeFormalApi:true,fail:true},
 {name:'Full cannot be combined with complete publishing',flag:'--full-only --platform-release',fail:true,exit:1},
 {name:'Full cannot be combined in reversed argument order',flag:'--platform-release --full-only',fail:true,exit:1},
 {name:'invalid release version fails before preparation',flag:'--platform-release --release-version=1.2',fail:true,exit:1},
 {name:'release version requires the explicit equals syntax',flag:'--platform-release --release-version',fail:true,exit:1},
 {name:'conflicting release versions fail before preparation',flag:'--platform-release --release-version=1.2.3 --release-version=1.2.4',fail:true,exit:1},
 {name:'a version override cannot change the hotfix contract',flag:'--release-version=1.2.3 --docker-only-hotfix',fail:true,exit:1},
])test(`complete platform entry: ${scenario.name}`,()=>{
  fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});
  const directory=fs.mkdtempSync(path.join(root,'.tmp','release-complete-entry-'));
 const props=path.join(directory,'Microi.Server/Directory.Build.props'),pkg=path.join(directory,'Microi.Client/package.json');
 try{
  fs.mkdirSync(path.dirname(props),{recursive:true});fs.mkdirSync(path.join(directory,'Microi.Server/Fixture'));
  fs.writeFileSync(props,'<Project><MicroiNetVersion>1.2.3</MicroiNetVersion></Project>');
  fs.writeFileSync(path.join(directory,'head.props'),`<MicroiNetVersion>${scenario.head||'1.2.3'}</MicroiNetVersion>`);
  fs.writeFileSync(path.join(directory,'Microi.Server/Fixture/Fixture.csproj'),'<Project><Version>1.2.3</Version></Project>');
  fs.mkdirSync(path.dirname(pkg),{recursive:true});fs.writeFileSync(pkg,'{"version": "1.2.3", "name":"fixture"}');
  if(scenario.docs!==false){fs.mkdirSync(path.join(directory,'microi.doc'));fs.writeFileSync(path.join(directory,'microi.doc/package.json'),'{}');}
  // 回放真实选择和版本更新代码。所有外部发布只保留标志，不调用编译器、Docker 或真实测试入口。
  const result=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:directory,encoding:'utf8',timeout:15000,input:`
set -e
print_fail(){ printf 'REJECTED=%s\\n' "$*"; exit 17; }
print_info(){ :; }; print_warning(){ :; }; print_success(){ :; }; print_phase(){ :; }; print_step(){ printf 'STEP=%s\\n' "$*"; }
read(){
 local target="\${!#}" value=''
 case "$target" in DEPLOY_MODE) value='${scenario.mode||''}' ;; _version_input) value='${scenario.manualVersion||''}' ;; _api_choice|_client_choice) value=2 ;; _skip_nuget_choice|_doc_choice) value=0 ;; esac
 printf -v "$target" '%s' "$value"
}
git(){ case "$1" in rev-parse) printf true ;; show) cat head.props ;; *) return 1 ;; esac; }
set -- ${scenario.flag||''}
${policy}
HAS_CLIENT=${scenario.clientAvailable!==false}; HAS_NUGET=${scenario.nuget!==false}; HAS_DOCKER=${scenario.docker!==false}
${helpers}
${plans}
${scenario.removeFormalApi?'DOCKER_PLANS=("${DOCKER_PLANS[0]}" "${DOCKER_PLANS[2]}" "${DOCKER_PLANS[3]}")':''}
${version}
${selection}
unset -f read
PACKAGE_JSON_FILES=(Microi.Client/package.json)
${update}
printf 'RESULT=%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\\n' "$DEPLOY_MODE" "$VERSION" "$BUMP_VERSION" "$BUILD_BACKEND" "$BUILD_CLIENT" "$PUSH_NUGET" "$PUBLISH_DOC" "\${#SELECTED_API_PLANS[@]}" "\${#SELECTED_CLIENT_PLANS[@]}" "$MICROI_RELEASE_INCLUDE_DOCUMENTATION"
`});
  assert.ifError(result.error);assert.equal(result.status,scenario.fail?(scenario.exit||17):0,result.stdout+'\n'+result.stderr);
  if(scenario.fail){assert.match(fs.readFileSync(props,'utf8'),/>1\.2\.3</);assert.doesNotMatch(result.stdout,/RESULT=/);return;}
  const fields=result.stdout.split(/\r?\n/).find(line=>line.startsWith('RESULT=')).slice(7).split('|');
  assert.equal(fields[1],scenario.version||'1.2.4');
  if(scenario.complete){assert.deepEqual(fields,['8',scenario.version||'1.2.4','true','true','true','true','true','1','1','true']);}
  else{assert.equal(fields[0],scenario.mode);assert.equal(fields[6],String(Boolean(scenario.website)));}
  assert.equal(result.stdout.match(/STEP=更新 Directory\.Build\.props/g)?.length||0,scenario.website?0:1,'Version preparation executes once per invocation');
  assert.match(fs.readFileSync(props,'utf8'),new RegExp(`>${(scenario.version||'1.2.4').replaceAll('.','\\.')}<`));
 }finally{fs.rmSync(directory,{recursive:true});}
});

test('complete release uses one candidate, one elapsed-time target and the existing website gate before version changes',()=>{
 assert.equal((source.match(/release-candidate\.mjs capture/g)||[]).length,1);
 assert.equal((source.match(/MICROI_RELEASE_DEADLINE=\$\(\(START_TIME \+ 1800\)\)/g)||[]).length,1);
 const preflight=source.indexOf('run_release_command node microi.doc/scripts/check-account-portal.mjs --require-committed');
 assert.ok(preflight>0&&preflight<source.indexOf('# ─── 阶段（条件）: 更新版本号'));
 assert.match(source,/MICROI_COMPLETE_PLATFORM_RELEASE" = true.*_release_test_scope_args\+=\(-PlatformFrontendTests\)/);
 const lock=section('acquire_workspace_lock() {','prepare_release_workspace() {');
 assert.match(lock,/\[ "\$PUBLISH_DOC" = true \]; then _requested\+=\(website\)/);
 assert.doesNotMatch(source.slice(source.indexOf('# --- 发布模式：')),/bash [^\n]*Microi一键编译发布/,'The complete entry must not recursively run separate release modes');
});
