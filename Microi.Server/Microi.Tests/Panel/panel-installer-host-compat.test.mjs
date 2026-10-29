import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,lstatSync,existsSync} from 'node:fs';
import {join,resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=readFileSync(join(root,'数据库、案例、文档、资料/install-microi-panel.sh'),'utf8').replaceAll('\r\n','\n');
const bash=process.platform==='win32'?['D:/Program Files/Git/bin/bash.exe','C:/Program Files/Git/bin/bash.exe'].find(existsSync):'bash';
assert(bash,'Bash is required');
const python=process.platform==='win32'?'python':'python3';
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const fn=name=>{const value=source.match(new RegExp('^'+name+'\\(\\)\\{[\\s\\S]*?^\\}','m'))?.[0];assert(value,'Missing '+name);return value;};
const run=script=>spawnSync(bash,['-s'],{input:'set -Eeuo pipefail\nfail(){ echo "$*" >&2; exit 1; }\n'+script,encoding:'utf8',windowsHide:true,timeout:20000});
function fixture(action){
 const parent=join(root,'.tmp');mkdirSync(parent,{recursive:true});
 const directory=mkdtempSync(join(parent,'panel-installer-host-compat-'));
 try{return action(directory);}finally{assert(resolve(directory).startsWith(resolve(parent)+sep));assert(!lstatSync(directory).isSymbolicLink());rmSync(directory,{recursive:true});}
}
const renderer=()=>fn('panel_guard_render_unit').match(/<<'PANEL_RENDER_UNIT'\n([\s\S]*?)\nPANEL_RENDER_UNIT/)[1];
function render(version,{mutate=text=>text}={}){return fixture(directory=>{
 const unit=mutate(readFileSync(join(root,'Microi.Server/Microi.Panel/AuthGuard/microi-auth-guard.service'),'utf8').replaceAll('\r\n','\n'));
 const launcher=readFileSync(join(root,'Microi.Server/Microi.Panel/AuthGuard/run.sh'),'utf8').replaceAll('\r\n','\n');
 writeFileSync(join(directory,'microi-auth-guard.service'),unit);writeFileSync(join(directory,'run.sh'),launcher);
 const result=spawnSync(python,['-X','utf8','-',''+directory,'/opt/microi-panel-runtime/python/bin/python3.11',''+version],{input:renderer(),encoding:'utf8',windowsHide:true,timeout:20000});
 return {result,original:unit,unit:readFileSync(join(directory,'microi-auth-guard.service'),'utf8').replaceAll('\r\n','\n'),launcher:readFileSync(join(directory,'run.sh'),'utf8').replaceAll('\r\n','\n')};
});}
for(const version of [219,231])test('old systemd keeps root read-only and exactly the existing writable exceptions: '+version,()=>{
 const {result,unit,original,launcher}=render(version);assert.equal(result.status,0,result.stderr);
 assert.match(unit,/^ProtectSystem=full$/m);assert.match(unit,/^ReadOnlyDirectories=\/$/m);
 assert.equal(unit.match(/^ReadWriteDirectories=(.*)$/m)[1],original.match(/^ReadWritePaths=(.*)$/m)[1]);
 for(const key of ['NoNewPrivileges','CapabilityBoundingSet','SystemCallFilter','RestrictAddressFamilies','ProtectHome','PrivateTmp','TasksMax','RuntimeDirectory','RuntimeDirectoryMode','UMask'])assert.equal(unit.match(new RegExp('^'+key+'=(.*)$','m'))[1],original.match(new RegExp('^'+key+'=(.*)$','m'))[1]);
 assert.match(unit,/^MemoryLimit=256M$/m);assert.doesNotMatch(unit,/^(StateDirectory|StateDirectoryMode|RuntimeDirectoryPreserve|LockPersonality|MemoryMax|ReadWritePaths)=/m);
 assert.match(launcher,/exec \/opt\/microi-panel-runtime\/python\/bin\/python3\.11 -E -s -B \/opt\/microi-auth-guard\/daemon\.py/);
 assert.doesNotMatch(unit,/CAP_SYS_ADMIN|^ReadWriteDirectories=\/\s*$/m);
});
for(const version of [232,234,235,255])test('modern systemd keeps strict isolation and version-supported state handling: '+version,()=>{
 const {result,unit,original}=render(version);assert.equal(result.status,0,result.stderr);
 const expected=original.replaceAll('/usr/bin/python3 -B ','/opt/microi-panel-runtime/python/bin/python3.11 -E -s -B ');
 const supported=version<235?expected.split('\n').filter(line=>!line.startsWith('RuntimeDirectoryPreserve=')&&!line.startsWith('StateDirectory=')&&!line.startsWith('StateDirectoryMode=')).join('\n'):expected;
 assert.equal(unit,supported);assert.match(unit,/^ProtectSystem=strict$/m);
});
test('an unexpected service entrypoint refuses rendering before changing stage files',()=>{
 const {result,unit,original}=render(219,{mutate:text=>text.replace('ExecStart=/usr/bin/python3','ExecStart=/unexpected/python3')});assert.notEqual(result.status,0);assert.equal(unit,original);
});
for(const [name,output,status,expected] of [['normal','LoadState=loaded',0,'loaded'],['empty property','DropInPaths=',0,''],['missing property','',0,null],['command failure','LoadState=loaded',9,null],['wrong field','Other=loaded',0,null],['full property list','Other=value\nLoadState=loaded\nMore=ok',0,'loaded'],['duplicate property','LoadState=loaded\nLoadState=other',0,null]])test('systemd property preserves failure semantics: '+name,()=>{
 const field=name==='empty property'?'DropInPaths':'LoadState';
 const result=run(`systemctl(){ printf '%s' ${quote(output)}; return ${status}; }\n${fn('panel_systemd_property')}\npanel_systemd_property fixture.service ${field}\n`);
 if(expected===null){assert.notEqual(result.status,0);assert.equal(result.status,['missing property','wrong field'].includes(name)?2:1);}else{assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,expected);}
});
function service({missing=true,failed=false,mutating=false,pid='123',stamp='456',active='active',dropins='',fragment='/etc/systemd/system/microi-auth-guard.service'}={}){return fixture(directory=>{
 const counter=join(directory,'counter').replaceAll('\\','/');
 const stub=`systemctl(){\n if [[ "$1" == is-enabled ]]; then printf enabled; return; fi\n [[ "$3" == --all && "$4" == --no-pager ]] || return 1\n ${failed?'return 9':''}\n local reads=0; if [[ -e ${quote(counter)} ]]; then reads=$(cat ${quote(counter)}); fi\n reads=$((reads+1)); printf '%s' "$reads" > ${quote(counter)}\n printf '%s\\n' ${quote('FragmentPath='+fragment)} ${quote('DropInPaths='+dropins)} ${quote('ExecMainStartTimestampMonotonic='+stamp)} ${quote('ActiveState='+active)}\n if ((reads>6)); then printf '%s\\n' ${quote('MainPID='+(mutating?'789':pid))}; else printf '%s\\n' ${quote('MainPID='+pid)}; fi\n ${missing?':':"printf 'InvocationID=modern-instance\\n'"}\n }\n`;
 return run(stub+fn('panel_systemd_property')+'\n'+fn('panel_guard_service_receipt')+'\npanel_guard_service_receipt\n');
});}
test('old systemd service identity binds PID and monotonic start time',()=>{const result=service();assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'legacy:123:456:active|enabled');});
test('modern systemd keeps its invocation identity',()=>{const result=service({missing:false});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'modern-instance|enabled');});
test('missing InvocationID does not hide a failed systemctl command',()=>assert.notEqual(service({failed:true}).status,0));
test('legacy process changing during readback refuses a receipt',()=>assert.notEqual(service({mutating:true}).status,0));
test('an active service without a real process refuses a receipt',()=>assert.notEqual(service({pid:'0',stamp:'0'}).status,0));
test('a stopped service may have no previous process',()=>{const result=service({pid:'0',stamp:'0',active:'inactive'});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'legacy:0:0:inactive|enabled');});
test('foreign service unit and later drop-ins stay protected',()=>{assert.notEqual(service({fragment:'/lib/systemd/system/foreign.service'}).status,0);assert.notEqual(service({dropins:'/etc/systemd/system/microi-auth-guard.service.d/custom.conf'}).status,0);});
for(const value of ['relative/python','/opt/python with spaces','/opt/python\nother','/opt/python;id','/opt/$(id)/python','/opt/python"'])test('runtime path syntax rejects untrusted shell tokens: '+JSON.stringify(value),()=>{
 const result=run(`PANEL_GUARD_PYTHON=${quote(value)}\npython3(){ echo UNEXPECTED_EXECUTION; return 0; }\n${fn('panel_guard_runtime_preflight')}\npanel_guard_runtime_preflight\n`);assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/UNEXPECTED_EXECUTION/);
});
test('unit verification rejects ignored security directives even when systemd exits zero',()=>{
 const result=run(`systemd-analyze(){ echo 'Failed to parse protect system value, ignoring: strict' >&2; return 0; }\n${fn('panel_guard_verify_unit')}\npanel_guard_verify_unit /fixture\n`);assert.notEqual(result.status,0);assert.match(result.stderr,/未通过完整解析/);
});
test('unrelated vendor unit warnings do not masquerade as Microi sandbox failure',()=>{
 const result=run(`systemd-analyze(){ echo '/etc/systemd/system/1panel-core.service:12: Unknown key name StartLimitIntervalSec in section Service, ignoring.' >&2; return 0; }\n${fn('panel_guard_verify_unit')}\npanel_guard_verify_unit /fixture\n`);assert.equal(result.status,0,result.stderr);
});
test('own unit warning remains a failure even beside vendor warnings',()=>{
 const result=run(`systemd-analyze(){ echo '/etc/systemd/system/1panel-core.service:12: Unknown key name Other, ignoring.'; echo '/fixture/microi-auth-guard.service:12: Unknown key name ProtectSystem, ignoring.'; return 0; }\n${fn('panel_guard_verify_unit')}\npanel_guard_verify_unit /fixture\n`);assert.notEqual(result.status,0);
});
test('read-only check invokes runtime preflight before returning success',()=>{
 assert.match(source,/--guard-python/);const start=source.indexOf('if ((PANEL_CHECK)); then\n');assert(start>0);assert(source.indexOf('panel_guard_runtime_preflight',start)<source.indexOf("只读检查通过",start));
});
