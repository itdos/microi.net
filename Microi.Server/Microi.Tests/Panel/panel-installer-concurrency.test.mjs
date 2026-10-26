import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(resolve(root, '数据库、案例、文档、资料/install-microi-panel.sh'), 'utf8').replaceAll('\r\n', '\n');
const bash = process.platform === 'win32' ? ['D:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe'].find(existsSync) : 'bash';
assert(bash, 'Bash is required for installer behavior tests');
function fn(name) {
  const body = source.match(new RegExp('^' + name + '\\(\\)\\{[\\s\\S]*?^\\}', 'm'))?.[0];
  assert(body, 'Missing installer safety function: ' + name);
  return body;
}
const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";
const newId = 'b'.repeat(64), externalId = 'c'.repeat(64);
const image = 'sha256:' + 'd'.repeat(64), otherImage = 'sha256:' + 'e'.repeat(64);
const mounts = '/etc/microi-panel=/microi/panel/config:false;/microi/ops/data=/microi/panel/data:true;';
function inspectCase({id=newId, observedImage=image, owner='true', operation='owned-operation', observedMounts=mounts, dockerExit=0}={}, expectedId=newId) {
  const script = `set -Eeuo pipefail\nPANEL_ROOT=/microi/panel\nfail(){ printf '%s\\n' "$*" >&2; exit 1; }\n`
    + `docker(){ printf '%s\\n' ${quote([id,observedImage,owner,operation,observedMounts].join('|'))}; return ${dockerExit}; }\n`
    + fn('panel_inspect_target') + '\n' + fn('panel_assert_target') + '\n'
    + `panel_assert_target ${quote(image)} ${quote(expectedId)} owned-operation ${quote(mounts)}\nprintf VERIFIED`;
  return spawnSync(bash, ['-c', script], {encoding:'utf8', windowsHide:true});
}
test('installer accepts only the expected candidate identity and retained mounts', () => {
  const result = inspectCase(); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /VERIFIED/);
});
for (const [name, observed] of [
  ['different candidate image', {observedImage:otherImage}],
  ['externally replaced container with identical image', {id:externalId}],
  ['container created by another installer operation', {operation:'other-operation'}],
  ['external container without the panel owner label', {owner:'false'}],
  ['changed data mount', {observedMounts:mounts.replace('/microi/panel/data', '/other/data')}],
  ['changed retained configuration mount', {observedMounts:mounts.replace('/microi/panel/config', '/other/config')}],
  ['unavailable Docker inspect', {dockerExit:57}],
]) test('installer rejects ' + name + ' before reporting success or rolling back', () => {
  const result = inspectCase(observed); assert.notEqual(result.status,0); assert.doesNotMatch(result.stdout,/VERIFIED/);
});
test('installer rejects an occupied host lock before inspecting or mutating Docker', () => {
  // 替换的只有文件打开路径，flock 调用和失败分支使用安装器真实函数；不接触 /run 或 Docker。
  const lock = fn('panel_acquire_install_lock').replace('/run/microi-panel-install.lock', '/dev/null');
  const script = `set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\nflock(){ return 1; }\n${lock}\npanel_acquire_install_lock\nprintf UNEXPECTED_MUTATION`;
  const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
  assert.notEqual(result.status,0); assert.match(result.stderr,/另一个.*安装|另一个.*升级/); assert.doesNotMatch(result.stdout,/UNEXPECTED_MUTATION/);
});
test('the real entry holds one host lock before inventory and verifies both upgrade and rollback identities', () => {
  assert(source.indexOf('panel_acquire_install_lock\n') < source.indexOf('PANEL_EXISTING_NEW='));
  assert.match(source,/docker exec "\$PANEL_CANDIDATE_CONTAINER_ID"/);
  assert.match(source,/panel_assert_target "\$PANEL_IMAGE_ID" "\$PANEL_CANDIDATE_CONTAINER_ID"/);
  assert.match(source,/panel_assert_target "\$PANEL_PREVIOUS_IMAGE" "\$PANEL_ROLLBACK_CONTAINER_ID"/);
  assert.match(source,/PANEL_PREVIOUS_CONTAINER_ID/);
  assert.match(source,/io\.microi\.panel\.installer-operation/);
});
for (const [protocol, expected, warning, legacy] of [['1', 1, false, 0], ['1', 1, false, 1], ['', 0, true, 1], ['<no value>', 0, true, 1]]) {
  test(`installer detects auth guard protocol ${protocol || '(absent)'} without pretending legacy coverage`, () => {
    const script = `set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\nPANEL_IMAGE_ID=${quote(image)}\nPANEL_HAS_AUTH_GUARD=99\nPANEL_LEGACY_PANEL_ONLY=${legacy}\ndocker(){ printf '%s\\n' ${quote(protocol)}; }\n`
      + fn('panel_guard_feature') + '\npanel_guard_feature\nprintf "FEATURE=%s" "$PANEL_HAS_AUTH_GUARD"';
    const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.stderr); assert.match(result.stdout,new RegExp('FEATURE='+expected));
    if(warning) assert.match(result.stderr,/不能视为SSH或数据库已受保护/); else assert.equal(result.stderr,'');
  });
}
for (const [name, stub, legacy] of [['unknown protocol',"printf '2'",1], ['image inspection failure','return 57',1], ['absent protocol without explicit legacy opt-in',"printf ''",0], ['missing protocol without explicit legacy opt-in',"printf '<no value>'",0]]) {
  test(`installer rejects ${name} before attempting host installation`, () => {
    const script=`set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\nPANEL_IMAGE_ID=${quote(image)}\nPANEL_LEGACY_PANEL_ONLY=${legacy}\ndocker(){ ${stub}; }\n`
      + fn('panel_guard_feature') + '\npanel_guard_feature\nprintf UNEXPECTED_INSTALL';
    const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
    assert.notEqual(result.status,0); assert.doesNotMatch(result.stdout,/UNEXPECTED_INSTALL/);
  });
}
for(const [title,upgrade,newGuard,oldProtocol,inspectExit,allowed]of[
 ['legacy first install',0,0,'1',0,true],
 ['new guard upgrade',1,1,'1',0,true],
 ['legacy to legacy upgrade',1,0,'',0,true],
 ['legacy to legacy upgrade with absent label',1,0,'<no value>',0,true],
 ['guard protocol 1 downgrade',1,0,'1',0,false],
 ['unknown newer protocol downgrade',1,0,'2',0,false],
 ['unreadable previous image',1,0,'',57,false],
])test('upgrade compatibility checks '+title,()=>{
 const script=`set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\nPANEL_UPGRADE=${upgrade}\nPANEL_HAS_AUTH_GUARD=${newGuard}\nPANEL_LEGACY_PANEL_ONLY=1\nPANEL_PREVIOUS_IMAGE=${quote(otherImage)}\ndocker(){ [[ "$1" == image && "$2" == inspect && "\${@: -1}" == "$PANEL_PREVIOUS_IMAGE" ]] || { echo WRONG_IMAGE_ID >&2; return 92; }; printf '%s\\n' ${quote(oldProtocol)}; return ${inspectExit}; }\n${fn('panel_guard_upgrade_compatibility')}\npanel_guard_upgrade_compatibility\nprintf COMPATIBLE`;
 const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
 assert.doesNotMatch(result.stderr,/WRONG_IMAGE_ID/);
 if(allowed){assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/COMPATIBLE/);}
 else{assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/COMPATIBLE/);if(inspectExit===0)assert.match(result.stderr,/禁止降级.*--legacy-panel-only/);}
});
test('downgrade protection runs before guard, bootstrap and Compose mutations',()=>{
 const gate=source.indexOf('\npanel_guard_upgrade_compatibility\n');assert(gate>0);
 assert(gate<source.indexOf('\npanel_install_auth_guard\n'));
 assert(gate<source.indexOf('  docker run --rm --name microi-panel-bootstrap'));
 assert(gate<source.indexOf('\npanel_write_image_override "$PANEL_IMAGE_ID"'));
});
for(const enabled of [0,1]) test(`image override ${enabled ? 'adds a readonly guard socket' : 'retains legacy mounts'}`,()=>{
  // 渲染函数只输出Compose；写入与并发回读另由恢复行为测试覆盖。
  const write=fn('panel_render_image_override');
  const script=`set -Eeuo pipefail\nPANEL_HAS_AUTH_GUARD=${enabled}\nPANEL_OPERATION_ID=owned-operation\n${write}\npanel_render_image_override ${quote(image)}`;
  const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr); assert.match(result.stdout,new RegExp('image: '+image));
  assert.match(result.stdout,/installer-operation: "owned-operation"/);
  if(enabled) assert.match(result.stdout,/\/run\/microi-auth-guard:\/run\/microi-auth-guard:ro/);
  else assert.doesNotMatch(result.stdout,/volumes:|microi-auth-guard/);
});
const candidateGateEnd=source.indexOf('\npanel_candidate_gate\n')+'\npanel_candidate_gate\n'.length;
assert(candidateGateEnd>'\npanel_candidate_gate\n'.length,'Candidate gate invocation is required');
for(const [title,args,allowed,flags]of[
 ['rejects an implicit unpublished candidate',[],false,null],
 ['legacy opt-in still requires an explicit image',['--legacy-panel-only'],false,null],
 ['read-only check may keep the unpublished default',['--check'],true,'CHECK=1 IMAGE=0 LEGACY=0'],
 ['explicit local candidate is accepted',['--image','microi-panel:fixture-2.0.1','--offline'],true,'CHECK=0 IMAGE=1 LEGACY=0'],
 ['legacy mode must name its chosen image',['--image','microi-panel:v2.0.0','--legacy-panel-only'],true,'CHECK=0 IMAGE=1 LEGACY=1'],
])test('candidate gate '+title,()=>{
 const result=spawnSync(bash,['-s','--',...args],{input:source.slice(0,candidateGateEnd)+'\nprintf "CHECK=%s IMAGE=%s LEGACY=%s" "$PANEL_CHECK" "$PANEL_IMAGE_EXPLICIT" "$PANEL_LEGACY_PANEL_ONLY"\n',encoding:'utf8',windowsHide:true});
 if(allowed){assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp(flags));}
 else{assert.notEqual(result.status,0);assert.match(result.stderr,/2\.0\.1尚未正式发布/);assert.match(result.stderr,/--image/);}
});
test('the full candidate entry rejects implicit installation before elevation, locks, Docker or writes',()=>{
 const stub=['sudo','docker','flock','install','mkdir'].map(name=>`${name}(){ echo UNEXPECTED_MUTATION >&2; return 91; }`).join('\n');
 const result=spawnSync(bash,['-s','--','--host','example.test','--yes'],{input:stub+'\n'+source,encoding:'utf8',windowsHide:true});
 assert.notEqual(result.status,0);assert.match(result.stderr,/尚未正式发布/);assert.doesNotMatch(result.stderr,/UNEXPECTED_MUTATION/);
});
test('candidate help identifies 2.0.1 as unpublished and explains explicit legacy scope',()=>{
 const result=spawnSync(bash,['-s','--','--help'],{input:source,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/v2\.0\.1（源码候选，尚未正式发布）/);assert.match(result.stdout,/--legacy-panel-only/);
 assert.match(result.stdout,/仅旧版面板，不含SSH\/数据库认证防护/);assert.match(source,/PANEL_IMAGE=.*:v2\.0\.1\n/);
});
for(const [guard,legacy,allowed]of[[1,0,true],[0,1,true],[0,0,false]])test(`completion is truthful for guard=${guard}, explicitLegacy=${legacy}`,()=>{
 const script=`set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\nPANEL_HAS_AUTH_GUARD=${guard}\nPANEL_LEGACY_PANEL_ONLY=${legacy}\nPANEL_URL=https://example.test:61890\nPANEL_ROOT=/fixture/panel\nPANEL_PORT=61890\n${fn('panel_report_completion')}\npanel_report_completion`;
 const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true});
 if(!allowed){assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/安装完成/);return;}
 assert.equal(result.status,0,result.stderr);
 if(guard)assert.match(result.stdout,/宿主防护控制面已回读/);
 else{assert.match(result.stdout,/仅旧版面板，不含SSH\/数据库认证防护/);assert.doesNotMatch(result.stdout,/控制面已回读/);}
});
test('new guard candidates require control plane readiness and leave historical services to explicit migration',()=>{
  assert.match(source,/PANEL_HAS_AUTH_GUARD\)\) && ! docker exec "\$PANEL_CANDIDATE_CONTAINER_ID" dotnet Microi\.Panel\.dll --ready-check/);
  assert.match(source,/--verify-ready --socket \/run\/microi-auth-guard\/control\.sock/);
  assert.doesNotMatch(source,/--strict-coverage/);
  assert.match(source,/原数据库不会自动重建/);
  assert.match(source,/cmp -s "\$target\/microi-auth-guard\.service" \/etc\/systemd\/system\/microi-auth-guard\.service/);
});
