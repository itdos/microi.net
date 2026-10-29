import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=path.join(root,'Microi.Server/Microi.Panel/HostMaintenance');
const targets=['install-microi.sh','install-microi-panel.sh'].map(file=>path.join(root,'数据库、案例、文档、资料',file));
const open='# MICROI_DISK_GUARD_GENERATED_BEGIN',close='# MICROI_DISK_GUARD_GENERATED_END';
const daemon=fs.readFileSync(path.join(source,'daemon.py'),'utf8').replace(/\r\n/g,'\n').trimEnd();
const installer=fs.readFileSync(path.join(source,'install.sh'),'utf8').replace(/\r\n/g,'\n').trimEnd();
let template=fs.readFileSync(path.join(source,'installer-functions.sh'),'utf8').replace(/\r\n/g,'\n').trimEnd();
assert.equal(template.split('@@DAEMON_SOURCE@@').length,2);assert.equal(template.split('@@INSTALL_SOURCE@@').length,2);
assert(!daemon.includes('\nMICROI_DISK_GUARD_DAEMON_SOURCE\n'));assert(!installer.includes('\nMICROI_DISK_GUARD_INSTALL_SOURCE\n'));
template=template.replace('@@DAEMON_SOURCE@@',()=>daemon).replace('@@INSTALL_SOURCE@@',()=>installer);
const block=open+'\n'+template+'\n'+close+'\n';
for(const target of targets){
const before=fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n');
const begin=before.indexOf(open),end=before.indexOf(close);
let next;
if(begin<0){assert.equal(end,-1);const anchor=target.endsWith('install-microi-panel.sh')?'panel_select_install_scope(){':'SCRIPT_VERSION=';const index=before.indexOf(anchor);assert(index>0);next=before.slice(0,index)+block+'\n'+before.slice(index);}
else {assert(end>begin);next=before.slice(0,begin)+block+before.slice(end+close.length+1);}
if(process.argv.includes('--check')){assert.equal(before,next,'Installer embedded host maintenance source is stale');}
else fs.writeFileSync(target,next,'utf8');
}
console.log(JSON.stringify({check:process.argv.includes('--check'),daemonSha256:createHash('sha256').update(daemon+'\n').digest('hex'),bytes:Buffer.byteLength(block)}));
