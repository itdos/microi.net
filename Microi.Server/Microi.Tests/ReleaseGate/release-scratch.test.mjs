import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReleaseScratch, cleanupReleaseScratch } from '../../tools/release-scratch.mjs';

const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const tools=path.join(workspace,'Microi.Server/tools');
const source=fs.readFileSync(path.join(workspace,'Microi一键编译发布.sh'),'utf8');
const bash=process.env.MICROI_TEST_BASH || (process.platform==='win32' ? (()=>{
 const git=spawnSync('git',['--exec-path'],{encoding:'utf8',windowsHide:true});
 assert.ifError(git.error);assert.equal(git.status,0,git.stderr);
 return path.resolve(git.stdout.trim(),'../../..','bin/bash.exe');
})() : 'bash');
const quote=value=>`'${value.replaceAll("'", "'\\''")}'`;
function fixture(t){
 const parent=process.env.MICROI_TEST_TMP_ROOT||path.join(workspace,'.tmp');fs.mkdirSync(parent,{recursive:true});
 const root=fs.mkdtempSync(path.join(parent,'release-cleanup-test-'));
 t.after(()=>{
  if(process.platform==='win32'){
   const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(tools,'Remove-MicroiReleaseScratch.ps1'),'-LiteralPath',root,'-ExpectedParent',parent],{encoding:'utf8',windowsHide:true});
   assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
  }else fs.rmSync(root,{recursive:true,force:false});
  assert.equal(fs.existsSync(root),false);
 });
 return root;
}
function shellFunction(name){
 const match=source.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
 assert.ok(match,`Missing real release function ${name}`);return match[0];
}
for(const exit of [0,7,'INT','TERM','HUP','cleanup-failed','both-failed'])test(`实际发布 EXIT 收尾：${exit}`,t=>{
 const root=fixture(t), scratch=createReleaseScratch(root);
 const protectedFile=path.join(root,'other-task.txt');fs.writeFileSync(protectedFile,'uncommitted source');
 fs.writeFileSync(path.join(scratch,'build.log'),'temporary output');
 const cleanupFails=['cleanup-failed','both-failed'].includes(exit);
 if(cleanupFails)fs.writeFileSync(path.join(scratch,'.git'),'fixture worktree marker');
 const script=path.join(root,'exit.sh');
 fs.writeFileSync(script,`set -e\nMICROI_RELEASE_SCRATCH=${quote(scratch)}\nMICROI_RELEASE_SCRATCH_TOOL=${quote(path.join(tools,'release-scratch.mjs'))}\nMICROI_SKIP_EXIT_PAUSE=true\nstop_active_client_build() { printf stopped > ${quote(path.join(root,'stopped'))}; }\nrelease_workspace_lock() { printf released > ${quote(path.join(root,'released'))}; }\nis_windows_shell() { return 1; }\n${['cleanup_release_scratch','finish_windows_session','handle_session_interrupt'].map(shellFunction).join('\n')}\ntrap finish_windows_session EXIT\ntrap 'handle_session_interrupt INT' INT\ntrap 'handle_session_interrupt TERM' TERM\ntrap 'handle_session_interrupt HUP' HUP\n${['INT','TERM','HUP'].includes(exit)?`kill -s ${exit} $$`:`exit ${exit==='cleanup-failed'?0:exit==='both-failed'?7:exit}`}\n`);
 const result=spawnSync(bash,[script],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.ifError(result.error);
 const expected=exit==='INT'?130:['TERM','HUP'].includes(exit)?143:exit==='cleanup-failed'?1:exit==='both-failed'?7:exit;
 assert.equal(result.status,expected,result.stdout+'\n'+result.stderr);
 assert.equal(fs.readFileSync(path.join(root,'stopped'),'utf8'),'stopped');
 assert.equal(fs.readFileSync(path.join(root,'released'),'utf8'),'released');
 assert.equal(fs.readFileSync(protectedFile,'utf8'),'uncommitted source');
 const receipt=JSON.parse(fs.readFileSync(`${scratch}.cleanup.json`,'utf8'));
 assert.equal(receipt.cleaned,!cleanupFails);
 assert.equal(fs.existsSync(scratch),cleanupFails);
 if(cleanupFails){
  assert.match(receipt.error,/Git/);
  // 本测试自行撤销刚注入的标记；真实清理不移除 Git 标记。
  fs.unlinkSync(path.join(scratch,'.git'));cleanupReleaseScratch(scratch);
 }
});

test('目录身份变化、子项链接和既有目录均保留；同级发布证据不变',t=>{
 const root=fixture(t), scratch=createReleaseScratch(root), other=createReleaseScratch(root);
 const original=fs.readFileSync(path.join(scratch,'microi-scratch-owner.json'),'utf8');
 fs.writeFileSync(path.join(scratch,'microi-scratch-owner.json'),fs.readFileSync(path.join(other,'microi-scratch-owner.json')));
 assert.throws(()=>cleanupReleaseScratch(scratch),/identity/);
 fs.writeFileSync(path.join(scratch,'microi-scratch-owner.json'),original);
 const outside=path.join(root,'source');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'changes.txt'),'keep');
 const link=path.join(scratch,'external');fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>cleanupReleaseScratch(scratch),/link/);
 assert.equal(fs.readFileSync(path.join(outside,'changes.txt'),'utf8'),'keep');
 fs.unlinkSync(link);cleanupReleaseScratch(scratch);cleanupReleaseScratch(other);
 assert.throws(()=>cleanupReleaseScratch(outside),/ENOENT/);
 assert.equal(fs.existsSync(outside),true);
});

test('一键入口的四类临时文件全部归属 scratch，删除失败没有强制兜底',()=>{
 assert.match(source,/_BUILD_LOG="\$\(mktemp "\$MICROI_RELEASE_SCRATCH\//);
 assert.match(source,/_PACK_LOG="\$\(mktemp "\$MICROI_RELEASE_SCRATCH\//);
 assert.match(source,/SMOKE_LOG="\$\(mktemp "\$MICROI_RELEASE_SCRATCH\//);
 assert.match(source,/_tmp_dir=\$\(mktemp -d "\$MICROI_RELEASE_SCRATCH\//);
 assert.doesNotMatch(source,/rm -[a-z]*f[^\n]*(?:_BUILD_LOG|_PACK_LOG|SMOKE_LOG|_tmp_dir)/);
 const run=spawnSync(bash,['-n',path.join(workspace,'Microi一键编译发布.sh')],{encoding:'utf8',windowsHide:true});
 assert.ifError(run.error);
 assert.equal(run.status,0,run.stderr);
});
