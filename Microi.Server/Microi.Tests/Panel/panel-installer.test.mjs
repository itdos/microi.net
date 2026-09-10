import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const scripts=resolve(root,'数据库、案例、文档、资料');
const bash=process.platform==='win32'?['D:/Program Files/Git/bin/bash.exe','C:/Program Files/Git/bin/bash.exe'].find(existsSync):'bash';
assert(bash,'Bash is required to verify the real installer function');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
for(const name of ['install-microi.sh','install-microi-offline.sh']){
 const source=readFileSync(resolve(scripts,name),'utf8').replaceAll('\r\n','\n');
 const fn=source.match(/^microi_install_ops\(\) \{[\s\S]*?^\}/m)?.[0];
 assert(fn,'Installer entry function was not found');
 for(const label of ['io.microi.panel.controller=true','io.microi.ops.controller=true'])test(`${name}: preserve existing or stopped ${label}`,()=>{
  // 使用真实函数和拒绝所有写命令的 Docker 桩，证明先装面板时不会拉取、初始化或启动第二个实例。
  const stub=`docker(){ [ "$1" = ps ] && [ "$2" = -aq ] || { echo UNEXPECTED_MUTATION:"$*" >&2; return 92; }; if [ "$4" = ${quote('label='+label)} ]; then printf '%s\\n' existing-stopped-controller; fi; }`;
  const run=spawnSync(bash,['-c',stub+'\n'+fn+'\nmicroi_install_ops'],{encoding:'utf8',windowsHide:true});
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/不创建第二个控制器/);assert.doesNotMatch(run.stderr,/UNEXPECTED_MUTATION/);
 });
 test(`${name}: unavailable Docker inventory fails before initialization`,()=>{
  const run=spawnSync(bash,['-c','docker(){ return 57; }\n'+fn+'\nmicroi_install_ops'],{encoding:'utf8',windowsHide:true});
  assert.notEqual(run.status,0);assert.doesNotMatch(run.stdout,/已就绪|配置完成/);
 });
}
test('standalone panel and platform installers have valid Bash syntax',()=>{
 for(const name of ['install-microi-panel.sh','install-microi.sh','install-microi-offline.sh','microi-offline-prepare.sh']){
  const run=spawnSync(bash,['-n'],{input:readFileSync(resolve(scripts,name),'utf8'),encoding:'utf8',windowsHide:true});assert.equal(run.status,0,name+': '+run.stderr);
 }
});

const standalone=readFileSync(resolve(scripts,'install-microi-panel.sh'),'utf8').replaceAll('\r\n','\n');
const inventoryStart=standalone.indexOf('# 兼容Docker对同一key/不同key过滤的行为');
const inventoryEnd=standalone.indexOf("((EUID==0)) || fail '写入面板配置需要root",inventoryStart);
assert(inventoryStart>=0&&inventoryEnd>inventoryStart,'Standalone controller preflight was not found');
const preflight=standalone.slice(inventoryStart,inventoryEnd);
function runStandalonePreflight(stub){
 const setup=`set -Eeuo pipefail\nfail(){ printf '%s\\n' "$*" >&2; exit 1; }\nPANEL_UPGRADE=0\nPANEL_CHECK=1\nPANEL_ROOT=/tmp/microi-panel-test-never-created-61892\nPANEL_COMPOSE=$PANEL_ROOT/docker-compose.yml\nPANEL_PORT=61892\nss(){ return 0; }\n`;
 return spawnSync(bash,['-c',setup+stub+'\n'+preflight],{encoding:'utf8',windowsHide:true});
}
for(const label of ['io.microi.panel.controller=true','io.microi.ops.controller=true']){
 test(`standalone installer: stopped ${label} prevents a second controller`,()=>{
  const stub=`docker(){ [ "$1" = ps ] || { echo UNEXPECTED_MUTATION >&2; return 92; }; if [ "$2" = -aq ] && [ "$4" = ${quote('label='+label)} ]; then printf '%s\\n' stopped-controller; fi; }`;
  const run=runStandalonePreflight(stub);
  assert.notEqual(run.status,0,'Stopped controllers must block a new installation');
  assert.match(run.stderr,/已有.*Ops\/Panel/);assert.doesNotMatch(run.stderr,/UNEXPECTED_MUTATION/);
 });
 test(`standalone installer: failed ${label} inventory cannot become an empty inventory`,()=>{
  const stub=`docker(){ [ "$1" = ps ] || { echo UNEXPECTED_MUTATION >&2; return 92; }; if [ "$4" = ${quote('label='+label)} ]; then return 57; fi; }`;
  const run=runStandalonePreflight(stub);
  assert.notEqual(run.status,0,'Either controller inventory failure must stop the installer');
  assert.doesNotMatch(run.stdout,/只读检查通过/);assert.doesNotMatch(run.stderr,/UNEXPECTED_MUTATION/);
 });
}

const aptFunction=standalone.match(/^install_docker_apt\(\)\{[\s\S]*?^\}/m)?.[0];
assert(aptFunction,'Signed Docker APT installer was not found');
test('standalone Docker setup preserves a pre-existing container runtime',()=>{
 const stub=`set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\ndpkg-query(){ printf 'install ok installed'; }\napt-get(){ echo UNEXPECTED_PACKAGE_MUTATION >&2; return 92; }\n`;
 const run=spawnSync(bash,['-c',stub+aptFunction+'\ninstall_docker_apt ubuntu noble'],{encoding:'utf8',windowsHide:true});
 assert.notEqual(run.status,0);assert.match(run.stderr,/已有容器运行时包/);assert.doesNotMatch(run.stderr,/UNEXPECTED_PACKAGE_MUTATION/);
});
test('standalone Docker setup rejects a different signing identity before configuring a repository',()=>{
 const stub=`set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\ndpkg-query(){ return 1; }\napt-get(){ return 0; }\nmktemp(){ printf /tmp/panel-signing-key-test; }\ncurl(){ return 0; }\ngpg(){ printf 'fpr:::::::::0000000000000000000000000000000000000000:\\n'; }\ninstall(){ echo UNEXPECTED_REPOSITORY_WRITE >&2; return 92; }\n`;
 const run=spawnSync(bash,['-c',stub+aptFunction+'\ninstall_docker_apt ubuntu noble'],{encoding:'utf8',windowsHide:true});
 assert.notEqual(run.status,0);assert.match(run.stderr,/签名公钥身份不符/);assert.doesNotMatch(run.stderr,/UNEXPECTED_REPOSITORY_WRITE/);
});
