import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstat,readFile} from 'node:fs/promises';
import path from 'node:path';

// 与 run-tests.ps1 保持相同优先级：Full 实际执行的桌面测试源码也是正式候选输入。
// 这里只记录文件哈希，不把内部 Agent 源码复制或暂存到根公开仓。
const desktopRoots=['Microi.Agent/apps/microi-code','Microi.Code/apps/microi-code'];
const generated=/(^|\/)(?:dist|bin|obj|node_modules|TestResults|\.resource-sync-base|\.git)(?:\/|$)|\.(?:vsix|nupkg|snupkg)$/i;
const pretestOutputs=new Set([
 'build/microi-platform-worker.cjs',
 'packages/microi-code-client-ui/client.bundle.js',
]);

async function regularSource(root,name){
 let current=root;
 for(const part of name.split('/')){
  current=path.join(current,part);
  const stat=await lstat(current);
  if(stat.isSymbolicLink())throw Error(`Desktop Full source uses a symbolic link: ${name}`);
 }
 if(!(await lstat(current)).isFile())throw Error(`Desktop Full source must be a regular file: ${name}`);
 return current;
}

export async function snapshotDesktopInputs(root){
 const files={};
 for(const desktop of desktopRoots){
  try{await lstat(path.join(root,desktop,'package.json'));}
  catch(error){if(error.code==='ENOENT')continue;throw error;}
  await regularSource(root,desktop+'/package.json');
  const cwd=path.join(root,desktop);
  const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true}).split('\0').filter(Boolean);
  for(const name of [...new Set(names)].sort()){
   if(path.isAbsolute(name)||name.includes('\\')||name.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe Desktop Full input path');
   // pretest 每次重建 worker/UI bundle 及 Office/PPT 安装投影；冻结生成器、源、锁文件，
   // 不能将 build 整目录排除，里面的安装脚本和静态资源仍影响真实测试。
   if(generated.test(name)||pretestOutputs.has(name)||name.startsWith('.build/')||name.startsWith('build/microi-skills/'))continue;
   const key=desktop+'/'+name;
   try{files[key]=createHash('sha256').update(await readFile(await regularSource(root,key))).digest('hex');}
   catch(error){if(error.code==='ENOENT')files[key]=null;else throw error;}
  }
  if(!Object.hasOwn(files,desktop+'/package.json'))throw Error('Desktop Full package.json must be a Git-visible candidate input');
  return files;
 }
 return files;
}
