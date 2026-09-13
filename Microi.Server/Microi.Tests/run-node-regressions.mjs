import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const roots=['Microi.Server/Microi.Tests','Microi.Server/Microi.Upgrade/Resource','Microi.Client/tests'];
// 创始人工作区存在内部桌面仓时，将其确定性回归纳入相同门禁；公开仓不携带私有源码。
const desktopTests='Microi.Code/apps/microi-code/tests';
if(fs.existsSync(path.join(workspace,desktopTests)))roots.push(desktopTests);
export function discoverTests(directory){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())return /^(node_modules|bin|obj|TestResults|\.git)$/.test(entry.name)?[]:discoverTests(file);
  if(!/\.(?:test|spec)\.[cm]?js$/.test(entry.name))return [];
  const source=fs.readFileSync(file,'utf8');
  if(/(?:from\s*|require\(\s*)['"](?:@playwright\/test|playwright\/test)['"]/.test(source))return [];
  // Playwright test-server specs have their own real-environment runner; never
  // invoke them as node:test, or silently omit newly added deterministic tests.
  if(!/(?:from\s*|require\(\s*)['"]node:(?:test|assert(?:\/strict)?)['"]/.test(source))throw Error(`Unclassified regression test: ${file}`);
  return [file];
 }).sort();
}

export function assertTestSummary(output){
 const count=key=>Number([...output.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`,'gm'))].at(-1)?.[1]??NaN);
 const result=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,count(k)]));
 if(!result.tests||result.tests!==result.pass||['fail','cancelled','skipped','todo'].some(k=>result[k]!==0))throw Error(`Regression tests were missing, failed or skipped: ${JSON.stringify(result)}`);
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const results=path.resolve(process.argv[2]||path.join(workspace,'.tmp/node-regressions'));
 fs.mkdirSync(results,{recursive:true});
 const summary=[];
 for(const root of roots){
  const files=discoverTests(path.join(workspace,root));
  if(!files.length)throw Error(`No regression tests discovered: ${root}`);
  const log=path.join(results,root.replaceAll('/','-')+'.tap');
  console.log(`Node regression discovery: ${root}: ${files.length} files`);
  const output=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...files.map(f=>path.relative(workspace,f))],{cwd:workspace,windowsHide:true});
   let text='';child.stdout.on('data',b=>text+=b);child.stderr.on('data',b=>text+=b);
   child.on('error',reject);child.on('close',code=>{fs.writeFileSync(log,text);if(code!==0)reject(Error(`Node regression failed (${code}); inspect ${log}\n${text.split('\n').filter(l=>/^not ok|^# (?:fail|tests)|error:/.test(l)).slice(0,40).join('\n')}`));else resolve(text);});
  });
  const counts=assertTestSummary(output);summary.push({root,files:files.map(f=>path.relative(workspace,f)),...counts});
  console.log(`${root}: ${counts.pass} passed, 0 failed/skipped`);
 }
 fs.writeFileSync(path.join(results,'node-regressions.json'),JSON.stringify(summary,null,2));
}
