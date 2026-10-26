import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,copyFileSync,readdirSync,lstatSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=readFileSync(resolve(root,'数据库、案例、文档、资料/install-microi-panel.sh'),'utf8').replaceAll('\r\n','\n');
const bash=process.platform==='win32'?['D:/Program Files/Git/bin/bash.exe','C:/Program Files/Git/bin/bash.exe'].find(existsSync):'bash';
assert(bash,'Bash is required');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const shellPath=path=>path.replaceAll('\\','/');
function fn(name){const value=source.match(new RegExp('^'+name+'\\(\\)\\{[\\s\\S]*?^\\}','m'))?.[0];assert(value,'Missing '+name);return value;}
function fixture(action){
 const parent=join(root,'.tmp');mkdirSync(parent,{recursive:true});
 const directory=mkdtempSync(join(parent,'panel-installer-recovery-'));
 try{return action(directory);}finally{
  assert(resolve(directory).startsWith(resolve(parent)+sep));assert(!lstatSync(directory).isSymbolicLink());
  rmSync(directory,{recursive:true});
 }
}
function run(script){return spawnSync(bash,['-c','set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\n'+script],{encoding:'utf8',windowsHide:true,timeout:20000});}
const image='sha256:'+'a'.repeat(64), nextImage='sha256:'+'b'.repeat(64), operation='01234567-89ab-cdef-0123-456789abcdef';
const legacy=`services:\n  microi-panel:\n    image: ${image}\n`;
const modern=legacy+`    labels:\n      io.microi.panel.installer-operation: "${operation}"\n    volumes:\n      - /run/microi-auth-guard:/run/microi-auth-guard:ro\n`;
const overrideFunctions=['panel_file_receipt','panel_capture_image_override','panel_assert_image_override','panel_render_image_override','panel_write_image_override'].map(fn).join('\n');
for(const [name,body] of [['new installation',null],['legacy image-only override',legacy],['current installer override',modern]])test('override preserves supported schema: '+name,()=>fixture(directory=>{
 const path=join(directory,'docker-compose.image.yml');if(body!==null)writeFileSync(path,body);
 const result=run(`PANEL_ROOT=${quote(shellPath(directory))}\nPANEL_OPERATION_ID=${quote(operation)}\nPANEL_HAS_AUTH_GUARD=1\n${overrideFunctions}\npanel_capture_image_override\npanel_write_image_override ${quote(nextImage)}\npanel_assert_image_override\n`);
 assert.equal(result.status,0,result.stderr);assert.match(readFileSync(path,'utf8'),new RegExp(nextImage));assert.match(readFileSync(path,'utf8'),/microi-auth-guard:ro/);
 assert(!readdirSync(directory).some(name=>name.endsWith('.pending')));
}));
for(const [name,body] of [
 ['environment',legacy+'    environment:\n      KEEP: custom\n'],
 ['published ports',legacy+'    ports:\n      - 443:8443\n'],
 ['custom bind mount',modern.replace('/run/microi-auth-guard:/run/microi-auth-guard:ro','/data:/custom:ro')],
 ['custom label',modern.replace('io.microi.panel.installer-operation','custom.owner')],
 ['duplicate image key',legacy+'    image: other\n'],
 ['another service',legacy+'  another:\n    image: business\n'],
 ['YAML merge reference',legacy+'    <<: *custom\n'],
 ['empty existing override',''],
])test('override refuses and preserves '+name,()=>fixture(directory=>{
 const path=join(directory,'docker-compose.image.yml');writeFileSync(path,body);
 const result=run(`PANEL_ROOT=${quote(shellPath(directory))}\n${overrideFunctions}\npanel_capture_image_override\nprintf UNEXPECTED_WRITE\n`);
 assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/UNEXPECTED_WRITE/);assert.equal(readFileSync(path,'utf8'),body);
}));
test('override rejects a later edit even when it still uses an accepted schema',()=>fixture(directory=>{
 const path=join(directory,'docker-compose.image.yml');writeFileSync(path,legacy);
 const changed=legacy.replace(image,nextImage);
 const result=run(`PANEL_ROOT=${quote(shellPath(directory))}\nPANEL_OPERATION_ID=${quote(operation)}\nPANEL_HAS_AUTH_GUARD=1\n${overrideFunctions}\npanel_capture_image_override\nprintf '%s' ${quote(changed)} > "$PANEL_ROOT/docker-compose.image.yml"\npanel_write_image_override ${quote(image)}\n`);
 assert.notEqual(result.status,0);assert.match(result.stderr,/外部修改/);assert.equal(readFileSync(path,'utf8'),changed);
}));
test('override rejects an external same-content file replacement',()=>fixture(directory=>{
 writeFileSync(join(directory,'docker-compose.image.yml'),legacy);
 const result=run(`PANEL_ROOT=${quote(shellPath(directory))}\nPANEL_OPERATION_ID=${quote(operation)}\nPANEL_HAS_AUTH_GUARD=1\n${overrideFunctions}\npanel_capture_image_override\ncp "$PANEL_ROOT/docker-compose.image.yml" "$PANEL_ROOT/replacement"\nmv -T "$PANEL_ROOT/replacement" "$PANEL_ROOT/docker-compose.image.yml"\npanel_write_image_override ${quote(nextImage)}\n`);
 assert.notEqual(result.status,0);assert.equal(readFileSync(join(directory,'docker-compose.image.yml'),'utf8'),legacy);
}));
test('override preflight precedes guard installation and image pull',()=>{
 assert(source.indexOf('\npanel_capture_image_override\n')<source.indexOf('\nelse docker pull "$PANEL_IMAGE"; fi'));
 assert(source.indexOf('\npanel_assert_image_override\npanel_install_auth_guard')>0);
});

const required=['daemon.py','store.py','firewall.py','collectors.py','redis_proxy.py','run.sh','microi-auth-guard.service'];
function guardTree(path,version,ready=true){
 mkdirSync(path,{recursive:true});writeFileSync(join(path,'manifest.json'),JSON.stringify({protocol:1,entrypoint:'daemon.py',files:required}));
 for(const file of required)writeFileSync(join(path,file),file==='daemon.py'?`# ${version}\nimport sys\nprint('{"ready":${ready?'true':'false'}}')\nsys.exit(${ready?0:1})\n`:`${version}:${file}\n`);
}
function rollbackCase({mutate='',previousActive='active',previousEnabled='enabled',oldReady=true}={}){
 return fixture(directory=>{
  const target=join(directory,'guard'),backup=target+'.before-'+operation,failed=target+'.failed-'+operation,unit=join(directory,'unit.service');
  guardTree(backup,'old',oldReady);guardTree(target,'candidate');writeFileSync(join(target,'.installer-operation'),operation+'\n');copyFileSync(join(target,'microi-auth-guard.service'),unit);
  for(const [file,value]of Object.entries({invocation:'candidate-instance',enabled:'enabled',active:'active',dropins:''}))writeFileSync(join(directory,file),value);
  const functions=['panel_file_receipt','panel_guard_tree_receipt','panel_guard_service_receipt','panel_guard_assert_rollback_files','panel_guard_wait_ready','panel_guard_rollback'].map(name=>fn(name)
   .replaceAll('/etc/systemd/system/microi-auth-guard.service',shellPath(unit))
   .replaceAll('/opt/microi-auth-guard',shellPath(target))).join('\n');
  const script=`D=${quote(shellPath(directory))}\nPANEL_OPERATION_ID=${quote(operation)}\nPANEL_GUARD_PREVIOUS_ACTIVE=${quote(previousActive)}\nPANEL_GUARD_PREVIOUS_ENABLED=${quote(previousEnabled)}\n`
   +`python3(){ command ${process.platform==='win32'?'python':'python3'} "$@"; }\nsleep(){ :; }\n`
   +`systemctl(){
 case "$1" in
 show) case "$3" in
 --property=FragmentPath) printf '%s' ${quote(shellPath(unit))};;
 --property=DropInPaths) cat "$D/dropins";;
 --property=InvocationID) cat "$D/invocation";;
 *) return 88;; esac;;
 is-enabled) cat "$D/enabled";;
 is-active) cat "$D/active";;
 stop) printf inactive > "$D/active"; echo stop >> "$D/actions";;
 restart) printf active > "$D/active"; echo restart >> "$D/actions";;
 enable) printf enabled > "$D/enabled"; echo enable >> "$D/actions";;
 disable) printf disabled > "$D/enabled"; echo disable >> "$D/actions";;
 daemon-reload) echo reload >> "$D/actions";;
 *) return 89;; esac
}\n`
   +functions+`\nPANEL_GUARD_PREVIOUS_TREE=$(panel_guard_tree_receipt ${quote(shellPath(backup))})\nPANEL_GUARD_CANDIDATE_TREE=$(panel_guard_tree_receipt ${quote(shellPath(target))})\nPANEL_GUARD_CANDIDATE_UNIT=$(panel_file_receipt ${quote(shellPath(unit))})\nPANEL_GUARD_CANDIDATE_SERVICE=$(panel_guard_service_receipt)\n`
   +mutate.replaceAll('$TARGET',quote(shellPath(target))).replaceAll('$BACKUP',quote(shellPath(backup))).replaceAll('$UNIT',quote(shellPath(unit))).replaceAll('$FAILED',quote(shellPath(failed)))
   +'\npanel_guard_rollback\nprintf RESTORED\n';
  const result=run(script);
  return {result,actions:existsSync(join(directory,'actions'))?readFileSync(join(directory,'actions'),'utf8'):'',
   target:readFileSync(join(target,'daemon.py'),'utf8'),backupExists:existsSync(backup),failedExists:existsSync(failed),
   unit:readFileSync(unit,'utf8'),enabled:readFileSync(join(directory,'enabled'),'utf8'),active:readFileSync(join(directory,'active'),'utf8')};
 });
}
test('guard rollback restores only the captured old tree and verifies the restored active service',()=>{
 const value=rollbackCase();assert.equal(value.result.status,0,value.result.stderr);assert.match(value.target,/# old/);assert.match(value.unit,/old:microi-auth-guard/);
 assert(value.failedExists&&!value.backupExists);assert.equal(value.actions,'stop\nreload\nenable\nrestart\n');assert.match(value.result.stderr,/已恢复并通过控制面回读/);
});
test('guard rollback restores the prior disabled inactive state without claiming readiness',()=>{
 const value=rollbackCase({previousActive:'inactive',previousEnabled:'disabled'});assert.equal(value.result.status,0,value.result.stderr);
 assert.equal(value.enabled,'disabled');assert.equal(value.active,'inactive');assert.doesNotMatch(value.actions,/restart/);assert.match(value.result.stderr,/未宣称网络保护就绪/);
});
for(const [name,mutate]of[
 ['candidate source edit',`printf changed >> $TARGET/daemon.py`],
 ['backup source edit',`printf changed >> $BACKUP/daemon.py`],
 ['unit edit',`printf changed >> $UNIT`],
 ['foreign operation marker',`printf foreign > $TARGET/.installer-operation`],
 ['external service restart',`printf foreign-instance > "$D/invocation"`],
 ['external enable state change',`printf disabled > "$D/enabled"`],
 ['new systemd drop-in',`printf foreign.conf > "$D/dropins"`],
 ['existing diagnostic directory',`mkdir $FAILED`],
 ['unexpected extra candidate file',`printf foreign > $TARGET/foreign.conf`],
 ['lost previous ownership receipt',`PANEL_GUARD_PREVIOUS_TREE=''`],
 ['changed backup manifest protocol',`printf '{"protocol":2}' > $BACKUP/manifest.json`],
])test('guard rollback refuses '+name+' before stopping any service',()=>{
 const value=rollbackCase({mutate});assert.notEqual(value.result.status,0);assert.equal(value.actions,'');assert(value.backupExists);assert.match(value.target,/# candidate/);assert.doesNotMatch(value.result.stdout,/RESTORED/);
});
test('guard rollback reports failure if old service files restore but readiness does not',()=>{
 const value=rollbackCase({oldReady:false});assert.notEqual(value.result.status,0);assert.match(value.target,/# old/);assert(value.failedExists);assert.match(value.result.stderr,/不能报告恢复成功/);assert.doesNotMatch(value.result.stdout,/RESTORED/);
});
test('both startup and readiness failure paths retain the installation failure result',()=>{
 assert.match(fn('panel_install_auth_guard'),/panel_guard_abort '候选宿主防护启动失败'/);
 assert.match(fn('panel_install_auth_guard'),/panel_guard_wait_ready \|\| panel_guard_abort/);
 assert.match(fn('panel_guard_abort'),/panel_guard_rollback/);assert.match(fn('panel_guard_abort'),/本次安装仍记为失败/);
});
