import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runReleaseBudget,recordReleasePhase} from '../../tools/release-budget.mjs';

test('release deadline preserves exits, rejects expired launch and never resets between phases',async()=>{
 const deadline=Date.now()/1000+10;
 assert.equal(await runReleaseBudget(deadline,process.execPath,['-e','process.exit(0)']),0);
 assert.equal(await runReleaseBudget(deadline,process.execPath,['-e','process.exit(7)']),7);
 assert.equal(await runReleaseBudget(deadline,'microi-no-such-budget-command'),127);
 assert.equal(await runReleaseBudget(Date.now()/1000-1,'microi-no-such-budget-command'),124);
});

test('budget expiry terminates its actual child tree and preserves an unrelated process',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-budget-')),pidFile=path.join(directory,'child.json');
 const other=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
 const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
 let descendant;
 try{
  const source=`const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});fs.writeFileSync(process.argv[1],JSON.stringify({pid:child.pid}));setInterval(()=>{},1000);`;
  const start=Date.now(),code=await runReleaseBudget(start/1000+2,process.execPath,['-e',source,pidFile]);
  descendant=JSON.parse(fs.readFileSync(pidFile)).pid;
  assert.equal(code,124);
  assert.equal(alive(descendant),false);assert.equal(alive(other.pid),true);assert.ok(Date.now()-start<12000);
 }finally{
  other.kill();if(descendant&&alive(descendant))process.kill(descendant);
  fs.rmSync(directory,{recursive:true});
 }
});

test('phase receipts retain actual exit and total deadline without claiming late success',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-budget-record-')),file=path.join(directory,'phases.jsonl');
 try{
  const first=recordReleasePhase(file,100,'test',0,120),last=recordReleasePhase(file,100,'finish',124,1901);
  assert.equal(first.elapsedSeconds,20);assert.equal(last.elapsedSeconds,1781);assert.equal(last.totalElapsedSeconds,1801);assert.equal(last.withinBudget,false);assert.equal(last.exitCode,124);
  assert.equal(fs.readFileSync(file,'utf8').trim().split('\n').length,2);
  assert.throws(()=>recordReleasePhase(file,101,'other',0,1902),/another run/);
  assert.throws(()=>recordReleasePhase(file,100,'finish',0,150),/another run/);
 }finally{fs.rmSync(directory,{recursive:true});}
});

test('budget executes commands and preserves Windows pwsh after nested tree timeout',async()=>{
 const scratch=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../.tmp');
 fs.mkdirSync(scratch,{recursive:true});
 const directory=fs.mkdtempSync(path.join(scratch,'release-budget-pwsh-'));
 const script=path.join(directory,'probe.ps1'),nested=path.join(directory,'nested.mjs'),receipt=path.join(directory,'executed.txt');
 const budgetUrl=new URL('../../tools/release-budget.mjs',import.meta.url).href;
 try{
  fs.writeFileSync(nested,`import {runReleaseBudget} from ${JSON.stringify(budgetUrl)};
const code=await runReleaseBudget(Date.now()/1000+2,process.execPath,['-e',"require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});setInterval(()=>{},1000);"]);
if(code!==124)process.exitCode=9;`);
  // 文件回读证明实际执行，不能仅凭 pwsh 的退出码 0 判为通过；超时后还须能恢复标题与运行 native 命令。
  fs.writeFileSync(script,`param([string]$Node,[string]$Nested,[string]$Receipt,[int]$Result)
$ErrorActionPreference='Stop'
$Host.UI.RawUI.WindowTitle='Microi owned budget regression'
& $Node $Nested
if($LASTEXITCODE -ne 0){exit 91}
$Host.UI.RawUI.WindowTitle='Microi owned budget regression completed'
& $Node -e 'require("node:fs").writeFileSync(process.argv[1],"EXECUTED")' $Receipt
if($LASTEXITCODE -ne 0){exit 92}
exit $Result
`);
  for(const expected of [0,7]){
   if(fs.existsSync(receipt))fs.unlinkSync(receipt);
   const windows=process.platform==='win32';
   const args=windows?['-NoProfile','-NonInteractive','-File',script,'-Node',process.execPath,'-Nested',nested,'-Receipt',receipt,'-Result',String(expected)]:['-e','require("node:fs").writeFileSync(process.argv[1],"EXECUTED");process.exit(Number(process.argv[2]))',receipt,String(expected)];
   const code=await runReleaseBudget(Date.now()/1000+20,windows?'pwsh.exe':process.execPath,args);
   assert.equal(code,expected);assert.equal(fs.readFileSync(receipt,'utf8'),'EXECUTED');
  }
 }finally{
  for(const file of [script,nested,receipt])if(fs.existsSync(file))fs.unlinkSync(file);
  fs.rmdirSync(directory);
 }
});
