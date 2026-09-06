import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const repositories=['.','Microi.Server/Microi.net','Microi.Server/Microi.AI','Microi.VSCode','Microi.Client/src/views/webos','Microi.Server/Microi.WorkFlow','Microi.Server/Microi.Vision'];
// Build products and the synchronization receipt are not executable source candidates.
const generated=/(^|\/)(?:dist|bin|obj|node_modules|TestResults|\.resource-sync-base|\.git)(?:\/|$)|\.(?:vsix|nupkg|snupkg)$/i;

export async function snapshotCandidate(root=workspace,repos=repositories){
 const files={};
 for(const repository of repos){
  const cwd=path.resolve(root,repository);
  const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd,encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
  for(const name of [...new Set(names)].sort()){
   const key=path.posix.join(repository.replaceAll('\\','/'),name.replaceAll('\\','/'));
   if(generated.test(key))continue;
   try{files[key]=createHash('sha256').update(await readFile(path.resolve(cwd,name))).digest('hex');}
   catch(error){if(error.code==='ENOENT')files[key]=null;else throw error;}
  }
 }
 return {files};
}

export function changedCandidate(before,after){
 return [...new Set([...Object.keys(before.files),...Object.keys(after.files)])].filter(name=>before.files[name]!==after.files[name]).sort();
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,manifest]=process.argv.slice(2);
 if(!['capture','verify'].includes(mode)||!manifest)throw new Error('Usage: release-candidate.mjs capture|verify <manifest>');
 const current=await snapshotCandidate();
 if(mode==='capture'){
  await mkdir(path.dirname(path.resolve(manifest)),{recursive:true});
  await writeFile(manifest,JSON.stringify({...current,capturedAt:new Date().toISOString()},null,2));
  console.log(`Recorded ${Object.keys(current.files).length} candidate source files across seven repositories.`);
 }else{
  const previous=JSON.parse(await readFile(manifest,'utf8'));
  const changed=changedCandidate(previous,current);
  if(changed.length)throw new Error(`Full 验收后候选源码发生变化，必须重新加载并验收；尚未允许继续发布：\n${changed.slice(0,40).join('\n')}`);
  console.log('Final candidate source is identical to the Full acceptance candidate.');
 }
}
