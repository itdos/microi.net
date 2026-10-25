import fs from 'node:fs';
import path from 'node:path';
import {createRequire,isBuiltin} from 'node:module';
import {pathToFileURL} from 'node:url';

const here=import.meta.dirname;
const binding={candidate:process.argv[2]};
if(!binding.candidate||!path.isAbsolute(binding.candidate))throw Error('An explicit candidate workspace is required.');
const port=Number(process.argv[4]);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid owned frontend port.');
const runtime=process.argv[3]||here;

const project=path.join(binding.candidate,'Microi.Client');
const original=path.join(project,'vite.config.js'),resolve=createRequire(original);
const {createServer}=await import(pathToFileURL(resolve.resolve('vite')));
// native loader 不在共享 node_modules/.vite-temp 写临时配置；依赖优化缓存也独占本任务目录。
let source=fs.readFileSync(original,'utf8');
source=source.replace(/(from\s+)(['"])([^'"]+)\2/g,(all,prefix,quote,specifier)=>{
  if(isBuiltin(specifier))return all;
  const file=specifier.startsWith('.')?path.resolve(project,specifier):resolve.resolve(specifier);
  return prefix+JSON.stringify(pathToFileURL(file).href);
});
source='const __dirname='+JSON.stringify(project)+';\n'+source;
const config=path.join(runtime,'native-vite.config.mjs');fs.writeFileSync(config,source);
// 候选复用已安装的依赖目录；只允许该依赖实际路径，避免字体等资源被 Vite 的严格文件边界拒绝。
const dependencyRoot=fs.realpathSync(path.join(project,'node_modules'));
const server=await createServer({root:project,configFile:config,configLoader:'native',cacheDir:path.join(runtime,'vite-cache'),server:{host:'127.0.0.1',port,strictPort:true,https:false,fs:{strict:true,allow:[project,dependencyRoot]}}});
await server.listen();console.log('Owned platform frontend ready.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
