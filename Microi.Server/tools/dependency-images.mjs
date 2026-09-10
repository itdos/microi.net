import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function registryLocation(config){
 if(!/^[a-z0-9-]+$/.test(config.Region)||!/^[a-z0-9][a-z0-9_-]*$/.test(config.Namespace))throw Error('Invalid registry Region or Namespace');
 return {registry:`registry.cn-${config.Region}.aliyuncs.com`,namespace:config.Namespace};
}
export function sourceByDigest(image){return image.digest?image.source.replace(/:[^/:]+$/,'')+'@'+image.digest:image.source;}
export async function loadImagePlan(configPath=path.join(root,'Microi一键编译发布配置.json')){
 const config=JSON.parse((await fs.readFile(configPath,'utf8')).replace(/^\uFEFF/,''));
 const location=registryLocation(config);
 const manifest=JSON.parse(await fs.readFile(new URL('dependency-images.json',import.meta.url),'utf8'));
 return {config,...location,images:manifest.images.map(x=>({...x,target:`${location.registry}/${location.namespace}/${x.name}`}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2],scope=process.argv.find(a=>a.startsWith('--scope='))?.slice(8);
 const plan=await loadImagePlan();
 const images=plan.images.filter(x=>!scope||x.scopes.includes(scope));
 if(mode==='list'){console.log(JSON.stringify(images,null,2));process.exit(0);}
 if(!['copy','verify'].includes(mode))throw Error('Usage: dependency-images.mjs list|copy|verify [--scope=build|test|install]');
 const regctl=process.env.MICROI_RELEASE_REGCTL||'regctl';
 const resultDir=path.join(root,'.tmp/dependency-images');await fs.mkdir(resultDir,{recursive:true});
 const secrets=[plan.config.Password,plan.config.Username].filter(Boolean);
 const redact=s=>secrets.reduce((v,k)=>v.replaceAll(k,'<redacted>'),s);
 async function run(args,input=''){
  return new Promise((resolve,reject)=>{
   const noProxy=[process.env.NO_PROXY||process.env.no_proxy||'', '.aliyuncs.com', 'm.daocloud.io'].filter(Boolean).join(',');
   const c=spawn(regctl,args,{windowsHide:true,env:{...process.env,NO_PROXY:noProxy,no_proxy:noProxy}});let output='';
   const onData=b=>{output+=b;if(output.length>20000)output=output.slice(-20000);};
   c.stdout.on('data',onData);c.stderr.on('data',onData);c.stdin.end(input);
   c.on('error',reject);c.on('close',code=>code===0?resolve(output.trim()):reject(Error(redact(output.slice(-2400)))));
  });
 }
 if(mode==='copy')await run(['registry','login',plan.registry,'-u',plan.config.Username,'--pass-stdin'],plan.config.Password);
 const receipts=[];
 for(const image of images){
  console.log(`${mode}: ${image.target}`);
  let expected=image.digest;
  if(mode==='copy'){
   let source=sourceByDigest(image);
   // Domestic acceleration is transport only: an explicit upstream SHA-256 is
   // mandatory, and the unmodified multi-platform manifest must survive copying.
   if(process.env.MICROI_RELEASE_SOURCE_MIRROR==='daocloud'&&image.digest&&!source.startsWith(plan.registry+'/'))source='m.daocloud.io/'+source;
   expected ||= await run(['manifest','head',source]);
   const actual=await run(['manifest','head',source]);
   if(actual!==expected)throw Error(`Upstream digest mismatch: ${image.name}`);
   if(source!==image.target)await run(['image','copy','--force-recursive',source,image.target]);
  }
  const digest=await run(['manifest','head',image.target]);
  if(!/^sha256:[a-f0-9]{64}$/.test(digest)||expected&&expected!==digest)throw Error(`Mirror digest mismatch: ${image.name}`);
  const body=JSON.parse(await run(['manifest','get',image.target,'--format','raw-body']));
  const platforms=(body.manifests||[]).map(x=>({...x.platform,digest:x.digest}));
  receipts.push({name:image.name,target:image.target,digest,platforms,verifiedAt:new Date().toISOString()});
  await fs.writeFile(path.join(resultDir,`${scope||'all'}-${mode}.json`),JSON.stringify(receipts,null,2));
  console.log(`verified: ${digest} (${platforms.length||1} manifest(s))`);
 }
}
