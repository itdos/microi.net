import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',['-c','core.autocrlf=true','-C',cwd,...args],{windowsHide:true,stdio:'pipe',timeout:30000});

test('真实 Git Windows checkout 保留渐进 Skills 的清单字节和完整正文',async()=>{
 const tempRoot=path.join(root,'.tmp');await fs.mkdir(tempRoot,{recursive:true});
 const fixture=await fs.mkdtemp(path.join(tempRoot,'skills-checkout-'));
 const source=path.join(fixture,'source'),clone=path.join(fixture,'clone');
 try{
  await fs.mkdir(source);const manifest=JSON.parse(await fs.readFile(path.join(root,'microi.skills/.progressive-disclosure-manifest.json'),'utf8'));
  const paths=new Set(['.gitattributes','microi.skills/.progressive-disclosure-manifest.json','microi.skills/scripts/validate-progressive-disclosure.mjs']);
  for(const[name,skill]of Object.entries(manifest.skills)){
   paths.add(`microi.skills/${name}/SKILL.md`);
   for(const reference of skill.references)paths.add(`microi.skills/${name}/${reference.path}`);
  }
  const hashes=new Map();
  for(const relative of paths){
   const bytes=await fs.readFile(path.join(root,relative)),target=path.join(source,relative);
   await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
   if(relative.endsWith('.md'))hashes.set(relative,digest(bytes));
  }
  // 实际 clean/checkout 比较保护知识清单；模拟字符串替换不能覆盖 Git 的跨平台行为。
  git(source,'init');git(source,'config','user.email','checkout-test@example.invalid');git(source,'config','user.name','Microi checkout regression');
  git(source,'add','--','.');git(source,'commit','-m','fixture: fixed canonical knowledge');
  git(fixture,'clone','--no-local',source,clone);
  for(const[relative,hash]of hashes)assert.equal(digest(await fs.readFile(path.join(clone,relative))),hash,`Windows checkout changed ${relative}`);
  execFileSync(process.execPath,[path.join(clone,'microi.skills/scripts/validate-progressive-disclosure.mjs')],{cwd:clone,windowsHide:true,stdio:'pipe',timeout:30000});
 }finally{
  const relative=path.relative(tempRoot,fixture);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  await fs.rm(fixture,{recursive:true,force:true});
 }
});
