import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
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
