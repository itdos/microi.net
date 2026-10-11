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
 const packageBytes=Buffer.from([0x50,0x4b,0x03,0x04,0x00,0xff,0x2d,0x2d,0x0a]);
 fs.writeFileSync(file,packageBytes);
 const fetches=[];
 const fetchImpl=async(url,options)=>{
  fetches.push({url:String(url),options});
  if(options.method==='GET')return new Response(JSON.stringify({resources:[{'@id':'https://push.example.test/api/v2/package','@type':'PackagePublish/2.0.0'}]}),{status:200});
  const pieces=[];for await(const piece of options.body)pieces.push(Buffer.from(piece));
  fetches.at(-1).bytes=Buffer.concat(pieces);
  return new Response(null,{status});
 };
 const result=await pushPackage(file,{apiKey:secret,source:'https://packages.example.test/v3/index.json'},{fetchImpl,boundary:'a'.repeat(48)});
 assert.equal(result,status===409?'duplicate':'uploaded');
 const upload=fetches[1];
 assert.equal(upload.options.redirect,'manual');
 assert.equal(upload.options.headers['X-NuGet-ApiKey'],secret);
 assert.equal(upload.options.headers['X-NuGet-Protocol-Version'],'4.1.0');
 assert.equal(Number(upload.options.headers['Content-Length']),upload.bytes.length);
 assert.ok(upload.bytes.includes(packageBytes));
 assert.ok(upload.bytes.subarray(0,100).toString().includes('--'+'a'.repeat(48)));
}));

test('unknown upload HTTP response fails closed without echoing response body',async()=>withFixture(async directory=>{
 const secret='fictional-upload-key';
 const file=path.join(directory,'Example.8.5.7.nupkg');fs.writeFileSync(file,'not-a-real-package');
 const fetchImpl=async(_url,options)=>options.method==='GET'
  ?new Response(JSON.stringify({resources:[{'@id':'https://push.example.test/api/v2/package','@type':'PackagePublish/2.0.0'}]}),{status:200})
  :new Response('server reflection '+secret,{status:403});
 await assert.rejects(()=>pushPackage(file,{apiKey:secret,source:'https://packages.example.test/v3/index.json'},{fetchImpl}),error=>{
  assert.equal(error.code,'upload-http');assert.equal(error.status,403);assert.equal(String(error).includes(secret),false);return true;
 });
}));
