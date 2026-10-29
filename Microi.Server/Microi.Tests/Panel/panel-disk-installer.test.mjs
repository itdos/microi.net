import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=path.join(root,'Microi.Server/Microi.Panel/HostMaintenance');
const bash=process.platform==='win32'?['D:/Program Files/Git/bin/bash.exe','C:/Program Files/Git/bin/bash.exe'].find(fs.existsSync):'bash';
const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
test('optimized Python still rejects every incomplete root-service readiness predicate',()=>{
 const script=read(path.join(source,'install.sh')).match(/import json,sys\n(x=json\.load\(open\(sys\.argv\[1\]\)\);[^\n]+)\nPY/)?.[1];assert(script);
 const valid={protocol:1,sourceHash:'release',monitoringFresh:true,error:'',volumesNeverDeleted:true};
 const cases=[{protocol:0},{sourceHash:'different'},{monitoringFresh:false},{error:'disk unavailable'},{volumesNeverDeleted:false},{}];
 for(const patch of cases){
  const data={...valid,...patch};
  const prefix='import json,sys,io,builtins\nsys.argv=["fixture","status.json","release"]\nbuiltins.open=lambda *a,**k:io.StringIO('+JSON.stringify(JSON.stringify(data))+')\n';
  const result=spawnSync('python',['-O','-B','-c',prefix+script],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,Object.keys(patch).length?1:0,result.stderr);
 }
});
for(const name of ['install-microi.sh','install-microi-panel.sh'])test(`${name} embeds byte-identical canonical Python and root installer`,()=>{
 const text=read(path.join(root,'数据库、案例、文档、资料',name));
 for(const [file,marker] of [['daemon.py','MICROI_DISK_GUARD_DAEMON_SOURCE'],['install.sh','MICROI_DISK_GUARD_INSTALL_SOURCE']]){
  const match=text.match(new RegExp("<<'"+marker+"'\\n([\\s\\S]*?)\\n"+marker+'\\n'));assert(match);assert.equal(match[1]+'\n',read(path.join(source,file)));
 }
 const syntax=spawnSync(bash,['-n'],{input:text,encoding:'utf8',windowsHide:true});assert.equal(syntax.status,0,syntax.stderr);
});
test('guarded installer passes exact command and conservative budget to one host coordinator',()=>{
 let fn=read(path.join(source,'installer-functions.sh')).match(/^microi_disk_run\(\) \{[\s\S]*?^\}/m)?.[0];assert(fn);
 fn=fn.replaceAll('"$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py guarded','record_guarded');
 const prefix=`set -e\ncat(){ [ "$1" = /proc/sys/kernel/random/uuid ] && printf fixture-uuid || command cat "$@"; }\nmicroi_disk_guard_connect(){ MICROI_DISK_GUARD_PYTHON=python; }\npython(){ if [ "$1" = -E ]; then printf '["api:v1","web:v1"]'; else return 91; fi; }\nrecord_guarded(){ printf '%s\\n' "$@"; }\nAPI_IMAGE=api:v1\nCLIENT_IMAGE=web:v1\n`;
 const r=spawnSync(bash,['-s'],{input:prefix+fn+'\nmicroi_disk_run docker compose -f /owned/compose.yml up -d\n',encoding:'utf8',windowsHide:true});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/--images\n\["api:v1","web:v1"\]/);assert.match(r.stdout,/--required-bytes\n2147483648\n--\ndocker\ncompose\n-f\n\/owned\/compose.yml\nup\n-d/);
});
test('readonly installer operations do not acquire write or deletion permissions',()=>{
 const fn=read(path.join(source,'installer-functions.sh')).match(/^microi_disk_run\(\) \{[\s\S]*?^\}/m)[0];
 const r=spawnSync(bash,['-s'],{input:'set -e\nmicroi_disk_guard_connect(){ echo UNEXPECTED >&2; return 99; }\ndocker(){ printf "%s\\n" "$*"; }\n'+fn+'\nmicroi_disk_run docker compose config --quiet\n',encoding:'utf8',windowsHide:true});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'compose config --quiet');assert.doesNotMatch(r.stderr,/UNEXPECTED/);
});

test('existing-host maintenance initializes the real API and Web image defaults before dispatch',()=>{
 const text=read(path.join(root,'数据库、案例、文档、资料/install-microi.sh'));
 const dispatch=text.match(/^# 已部署平台可单独启用维护，不进入数据库初始化或重装流程。\nif \[ "\$\{1:-\}" = --disk-guard-install \]; then\n[\s\S]*?^fi\n/m)?.[0];assert(dispatch);
 const declarations=['API_IMAGE','CLIENT_IMAGE'].map(name=>text.match(new RegExp('^'+name+'="[^\\n]+"$','m'))?.[0]);
 for(const line of declarations){assert(line);assert(text.indexOf(line)<text.indexOf(dispatch),'Maintenance must use the same defaults as the normal installation');}
 const prefix='set -e\nmicroi_install_disk_guard(){ :; }\nmicroi_disk_enroll_existing(){ printf "%s\\n" "$API_IMAGE" "$CLIENT_IMAGE"; }\n';
 const cases=[
  {api:'',web:'',expected:['registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest','registry.cn-hangzhou.aliyuncs.com/microios/microi-client-dev:latest']},
  {api:'registry.example/api:v3',web:'registry.example/web:v4',expected:['registry.example/api:v3','registry.example/web:v4']}
 ];
 for(const item of cases){
  const result=spawnSync(bash,['-s','--','--disk-guard-install'],{input:prefix+declarations.join('\n')+'\n'+dispatch,encoding:'utf8',windowsHide:true,env:{...process.env,MICROI_INSTALL_API_IMAGE_OVERRIDE:item.api,MICROI_INSTALL_CLIENT_IMAGE_OVERRIDE:item.web}});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(result.stdout.trim().split(/\r?\n/),item.expected);
 }
});
