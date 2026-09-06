import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,'.tmp/microi-ops-20260906');
const {chromium,request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const ops='microi-ops-e2e-20260906',proxy='microi-ops-e2e-proxy-20260906',label='io.microi.ops.test=20260906';
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function remove(name){let c;try{c=JSON.parse(docker(['inspect',name]))[0];}catch{return;}assert.equal(c.Config.Labels['io.microi.ops.test'],'20260906');docker(['rm','-f',name]);}
function start(trusted=''){
 docker(['run','-d','--name',ops,'--label',label,'--memory','512m','--cpus','1','--env-file',resolve(work,'ops-test.env'),'--network','microi-ops-e2e-network','-p','127.0.0.1:61880:8080',
 '-e','OPS_PUBLIC_URL='+(trusted?'https://localhost:61885':'http://localhost:61880'),'-e','OPS_TRUSTED_PROXY_IPS='+trusted,
 '-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${resolve(work,'deployment.json')}:/etc/microi-ops/deployment.json:ro`,'-v',`${resolve(work,'platform.cer')}:/etc/microi-ops/platform.cer:ro`,
 '-v',`${resolve(work,'data')}:/microi/ops/data`,'-v',`${resolve(work,'logs')}:/microi/logs/ops`,'microi-ops:local-20260906']);
}
await writeFile(resolve(work,'fixture-tls/proxy.mjs'),`import https from 'node:https';import http from 'node:http';import fs from 'node:fs';https.createServer({cert:fs.readFileSync('/fixture/fixture-cert.pem'),key:fs.readFileSync('/fixture/fixture-key.pem')},(req,res)=>{const out=http.request({hostname:'${ops}',port:8080,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},back=>{res.writeHead(back.statusCode,back.headers);back.pipe(res)});out.on('error',()=>{res.writeHead(502);res.end()});req.pipe(out)}).listen(8443,'0.0.0.0');`);
const env=await readFile(resolve(work,'ops-test.env'),'utf8'),password=env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const context=await request.newContext({ignoreHTTPSErrors:true});let browser;
try{
 remove(proxy);docker(['run','-d','--name',proxy,'--label',label,'--memory','128m','--cpus','0.5','--network','microi-ops-e2e-network','-p','127.0.0.1:61885:8443','-v',`${resolve(work,'fixture-tls')}:/fixture:ro`,'node:22-bookworm-slim','node','/fixture/proxy.mjs']);
 const ip=JSON.parse(docker(['inspect',proxy]))[0].NetworkSettings.Networks['microi-ops-e2e-network'].IPAddress;
 remove(ops);start(ip);
 for(let i=0;i<45;i++){try{if((await context.get('https://localhost:61885/health')).ok())break;}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.equal((await context.get('http://localhost:61880/ops-api/session',{headers:{'X-Forwarded-Proto':'https'}})).status(),503,'untrusted client cannot forge HTTPS');
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({ignoreHTTPSErrors:true});
 await page.goto('https://localhost:61885');await page.getByLabel('运维账号').fill('ops-test');await page.getByLabel('运维密码').fill(password);await page.getByRole('button',{name:'登录运维中心',exact:true}).click();
 await page.getByRole('heading',{name:'运行总览',exact:true}).waitFor();
 const cookie=(await page.context().cookies()).find(c=>c.name==='__Host-MicroiOps');assert(cookie?.secure&&cookie.httpOnly&&cookie.sameSite==='None');
 await page.getByRole('button',{name:'自动更新',exact:true}).click();await page.getByRole('button',{name:'保存更新策略',exact:true}).click();
 await page.getByRole('status').filter({hasText:'更新策略已保存'}).waitFor();
 await writeFile(resolve(work,'https-proxy-result.json'),JSON.stringify({passed:['untrusted forwarded proto rejected','HTTPS proxy login and secure Host cookie','CSRF-protected policy mutation through trusted proxy']},null,2));
 console.log('PASS HTTPS proxy login, secure cookies, CSRF and untrusted proxy rejection');
}finally{if(browser)await browser.close();await context.dispose();remove(ops);start();remove(proxy);}
