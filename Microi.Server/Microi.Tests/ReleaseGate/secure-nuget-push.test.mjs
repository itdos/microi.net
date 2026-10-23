import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {parsePrivateConfig,resolvePublishEndpoint,pushPackage} from '../../tools/secure-nuget-push.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const cli=path.join(root,'Microi.Server/tools/secure-nuget-push.mjs');
const releaseScript=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
function writePackage(file){
 const name=Buffer.from('Example.nuspec'),data=Buffer.from('<package><metadata><id>Example</id><version>8.5.7</version></metadata></package>');
 let crc=0xffffffff;for(const byte of data){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+data.length,16);
 const bytes=Buffer.concat([local,name,data,central,name,end]);fs.writeFileSync(file,bytes);return bytes;
}
const serviceIndex=()=>new Response(JSON.stringify({resources:[
 {'@id':'https://push.example.test/api/v2/package','@type':'PackagePublish/2.0.0'},
 {'@id':'https://flat.example.test/','@type':'PackageBaseAddress/3.0.0'}
]}));

async function withFixture(run){
 const base=path.join(root,'.tmp');fs.mkdirSync(base,{recursive:true});
 const directory=fs.mkdtempSync(path.join(base,'secure-nuget-push-'));
 try{return await run(directory);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}

test('release shell never puts NuGet key in argv and keeps per-package CAS immediately before upload',()=>{
 assert.doesNotMatch(releaseScript,/NUGET_API_KEY|dotnet nuget push|--api-key/);
 const start=releaseScript.indexOf('while IFS= read -r -d \'\' _nupkg; do');
 const end=releaseScript.indexOf('done < "$_nupkg_list_file"',start);
 assert.ok(start>0&&end>start);
 const upload=releaseScript.slice(start,end);
 assert.ok(upload.indexOf('package-cas')>=0&&upload.indexOf('package-cas')<upload.indexOf('secure-nuget-push.mjs push'));
 assert.match(upload,/secure-nuget-push\.mjs push "\$_nupkg" "\$CONFIG_FILE"/);
});

test('private config probe does not expose a key in argv, stdout, stderr or errors',()=>withFixture(directory=>{
 const key='fictional-test-secret-never-print';
 const config=path.join(directory,'private.json');
 fs.writeFileSync(config,'\uFEFF'+JSON.stringify({ApiKey:key,Source:'https://packages.example.test/v3/index.json'}));
 const args=[cli,'probe',config];
 assert.equal(args.join(' ').includes(key),false);
 const result=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.includes(key),false);assert.equal(result.stderr.includes(key),false);
 assert.equal(parsePrivateConfig(fs.readFileSync(config,'utf8')).apiKey,key);
 fs.writeFileSync(config,'{"ApiKey":"'+key+'", broken');
 const invalid=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.equal(invalid.status,1);assert.equal(invalid.stdout.includes(key),false);assert.equal(invalid.stderr.includes(key),false);
}));

test('service index resolves HTTPS PackagePublish resource and refuses redirect or unsafe endpoint',async()=>{
 const source='https://packages.example.test/v3/index.json';
 const endpoint='https://push.example.test/api/v2/package';
 const calls=[];
 const mockFetch=async(url,options)=>{
  calls.push({url:String(url),options});
  return new Response(JSON.stringify({resources:[{'@id':endpoint,'@type':['Other/1.0.0','PackagePublish/2.0.0']}]}),{status:200});
 };
 assert.equal(String(await resolvePublishEndpoint(source,mockFetch)),endpoint);
 assert.equal(calls[0].options.redirect,'manual');
 await assert.rejects(()=>resolvePublishEndpoint('http://packages.example.test/v3/index.json',mockFetch),/unsupported-source/);
 await assert.rejects(()=>resolvePublishEndpoint(source,async()=>new Response(null,{status:302})),/service-index-redirect-without-location/);
 await assert.rejects(()=>resolvePublishEndpoint(source,async()=>new Response(JSON.stringify({resources:[{'@id':'http://push.example.test/api/v2/package','@type':'PackagePublish/2.0.0'}]}),{status:200})),/unsafe-publish-resource/);
});

test('official NuGet source may redirect its keyless index but cannot redirect the API key to another publisher',async()=>{
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url:String(url),options});
  if(calls.length===1)return new Response(null,{status:302,headers:{Location:'https://nuget.azure.cn/v3/index.json'}});
  return new Response(JSON.stringify({resources:[{'@id':'https://www.nuget.org/api/v2/package','@type':'PackagePublish/2.0.0'}]}),{status:200});
 };
 assert.equal(String(await resolvePublishEndpoint('https://api.nuget.org/v3/index.json',fetchImpl)),'https://www.nuget.org/api/v2/package');
 assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.options.redirect==='manual'&&!('X-NuGet-ApiKey' in call.options.headers)));
 await assert.rejects(()=>resolvePublishEndpoint('https://api.nuget.org/v3/index.json',async()=>new Response(JSON.stringify({resources:[{'@id':'https://attacker.example.test/api/v2/package','@type':'PackagePublish/2.0.0'}]}),{status:200})),/unexpected-official-publish-resource/);
});

for(const status of [201,202,409])test(`streamed upload handles HTTP ${status} without exposing key`,async()=>withFixture(async directory=>{
 const secret='fictional-upload-key';
 const file=path.join(directory,'Example.8.5.7.nupkg');
 const packageBytes=writePackage(file);let uploaded=false;
 const fetches=[];
 const fetchImpl=async(url,options)=>{
  fetches.push({url:String(url),options});
  if(options.method==='GET')return String(url).endsWith('/index.json')?serviceIndex():uploaded?new Response(packageBytes):new Response(null,{status:404});
  const pieces=[];for await(const piece of options.body)pieces.push(Buffer.from(piece));
  fetches.at(-1).bytes=Buffer.concat(pieces);
  uploaded=true;return new Response(null,{status});
 };
 const result=await pushPackage(file,{apiKey:secret,source:'https://packages.example.test/v3/index.json'},{fetchImpl,boundary:'a'.repeat(48)});
 assert.equal(result,status===409?'duplicate':'uploaded');
 const upload=fetches.find(call=>call.options.method==='PUT');
 assert.equal(upload.options.redirect,'manual');
 assert.equal(upload.options.headers['X-NuGet-ApiKey'],secret);
 assert.equal(upload.options.headers['X-NuGet-Protocol-Version'],'4.1.0');
 assert.equal(Number(upload.options.headers['Content-Length']),upload.bytes.length);
 assert.ok(upload.bytes.includes(packageBytes));
 assert.ok(upload.bytes.subarray(0,100).toString().includes('--'+'a'.repeat(48)));
}));

test('unknown upload HTTP response fails closed without echoing response body',async()=>withFixture(async directory=>{
 const secret='fictional-upload-key';
 const file=path.join(directory,'Example.8.5.7.nupkg');writePackage(file);
 const fetchImpl=async(url,options)=>options.method==='GET'
  ?String(url).endsWith('/index.json')?serviceIndex():new Response(null,{status:404})
  :new Response('server reflection '+secret,{status:403});
 await assert.rejects(()=>pushPackage(file,{apiKey:secret,source:'https://packages.example.test/v3/index.json'},{fetchImpl}),error=>{
  assert.equal(error.code,'upload-http');assert.equal(error.status,403);assert.equal(String(error).includes(secret),false);return true;
 });
}));

for(const result of ['different','absent','unknown'])test(`409 must not succeed when exact remote bytes are ${result}`,()=>withFixture(async directory=>{
 const file=path.join(directory,'Example.8.5.7.nupkg');writePackage(file);let puts=0;
 const fetchImpl=async(url,options)=>{
  if(options.method==='PUT'){puts++;for await(const _ of options.body){}return new Response(null,{status:409});}
  if(String(url).endsWith('/index.json'))return serviceIndex();
  if(!puts)return new Response(null,{status:404});
  return result==='different'?new Response('other candidate'):new Response(null,{status:result==='absent'?404:503});
 };
 await assert.rejects(()=>pushPackage(file,{apiKey:'fictional-secret',source:'https://packages.example.test/v3/index.json'},{fetchImpl}),/collision|unconfirmed|unknown/);
 assert.equal(puts,1,'unknown outcome must not cause an upload retry');
}));

test('exact already-published package is reused without PUT; different package is never uploaded',()=>withFixture(async directory=>{
 const file=path.join(directory,'Example.8.5.7.nupkg'),bytes=writePackage(file);
 for(const same of [true,false]){
  const fetchImpl=async(url,options)=>{assert.equal(options.method,'GET');return String(url).endsWith('/index.json')?serviceIndex():new Response(same?bytes:Buffer.alloc(bytes.length));};
  const call=()=>pushPackage(file,{apiKey:'fictional-secret',source:'https://packages.example.test/v3/index.json'},{fetchImpl});
  if(same)assert.equal(await call(),'duplicate');else await assert.rejects(call,/collision/);
 }
}));
