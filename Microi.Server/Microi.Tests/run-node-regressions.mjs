import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {parse}=createRequire(path.join(workspace,'Microi.Client/package.json'))('@babel/parser');
// 仅发现平台测试、平台内置资源和平台 PC 测试；独立应用不得以转调文件接入。
export const roots=['Microi.Server/Microi.Tests','Microi.Server/OfficialApplications/Resource','Microi.Client/tests'];
// 内置微服务迁入契约指定的正式源码根后，全部行为测试继续归平台门禁。
// 普通独立应用仍不参与自动发现，也不通过同步镜像目录选择另一份源码。
const platformContract=JSON.parse(fs.readFileSync(path.join(workspace,'Microi.Server/OfficialApplications/Resource/platform-service-release.json'),'utf8'));
const platformRoot=path.resolve(workspace,platformContract.SourceRoot||'');
if(platformContract.SchemaVersion!==1||platformContract.AppKey!=='microi-platform-service'
 ||path.isAbsolute(platformContract.SourceRoot||'')||!platformRoot.startsWith(workspace+path.sep))
 throw Error('Invalid built-in platform-service source contract.');
roots.push(path.relative(workspace,path.join(platformRoot,'test')).replaceAll('\\','/'));
// Microi Code 桌面仓的当前测试使用 Vitest + TypeScript，由 run-tests.ps1 通过
// 该应用自己的 npm test 入口执行。不要把它误交给 node --test，也不要因为旧的
// 空 tests/ 目录存在就把零用例当作一个有效回归根。
export function discoverTests(directory){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())return /^(node_modules|bin|obj|TestResults|\.git)$/.test(entry.name)?[]:discoverTests(file);
  if(!/\.(?:test|spec)\.[cm]?js$/.test(entry.name))return [];
  const source=fs.readFileSync(file,'utf8');
  const references=moduleReferences(source);
  if(references.some(name=>/^(?:@playwright\/test|playwright\/test)$/.test(name)))return [];
  // Playwright test-server specs have their own real-environment runner; never
  // invoke them as node:test, or silently omit newly added deterministic tests.
  const nodeRegression=references=>references.some(name=>/^node:(?:test|assert(?:\/strict)?)$/.test(name));
  if(!nodeRegression(references)){
   // Pure import barrels are real responsibility entries when each declared
   // child is a Node regression. Missing children and browser/unknown modules
   // still fail classification instead of turning an entry into zero cases.
   const imports=parse(source,{sourceType:'unambiguous'}).program.body
    .filter(node=>node.type==='ImportDeclaration'&&node.specifiers.length===0&&node.source.value.startsWith('.'))
    .map(node=>node.source.value);
   if(!imports.length)throw Error(`Unclassified regression test: ${file}`);
   for(const specifier of imports){
    const dependency=path.resolve(path.dirname(file),specifier);
    if(!fs.existsSync(dependency)||!fs.statSync(dependency).isFile())throw Error(`Missing regression import: ${file} -> ${dependency}`);
    const childSource=fs.readFileSync(dependency,'utf8');
    const childReferences=moduleReferences(childSource);
    if(!nodeRegression(childReferences)||childReferences.some(name=>/^(?:@playwright\/test|playwright\/test)$/.test(name)))throw Error(`Unclassified regression import: ${file} -> ${dependency}`);
   }
  }
  return [file];
 }).sort();
}

function moduleReferences(source){
 const references=[],ast=parse(source,{sourceType:'unambiguous'});
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='ImportDeclaration'||node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration'){
   if(node.source?.value)references.push(node.source.value);
  }
  if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='require'
   &&node.arguments.length===1&&node.arguments[0].type==='StringLiteral')references.push(node.arguments[0].value);
  for(const [key,value]of Object.entries(node)){
   if(['loc','start','end','extra','comments','leadingComments','trailingComments','innerComments'].includes(key))continue;
   if(Array.isArray(value))for(const child of value)visit(child);else if(value&&typeof value==='object')visit(value);
  }
 }
 visit(ast.program);return references;
}

export function regressionLogFile(directory,root){
 return path.join(directory,root.replace(/[\\/]/g,'-')+'.tap');
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
  const log=regressionLogFile(results,root);
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
