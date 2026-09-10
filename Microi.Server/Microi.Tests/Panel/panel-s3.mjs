import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,createHmac} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
// 显式 Content-Length 和独立连接使空桶 PUT/DELETE 的 HTTP 消息边界可复核。
export async function s3Request(port,password,method,path,body=''){
 const host=`127.0.0.1:${port}`,date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=`${day}/us-east-1/s3/aws4_request`,payload=sha(body),signed='host;x-amz-content-sha256;x-amz-date';
 const canonical=[method,path,'',`host:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${date}\n`,signed,payload].join('\n');
 const key=hmac(hmac(hmac(hmac('AWS4'+password,day),'us-east-1'),'s3'),'aws4_request');
 const signature=createHmac('sha256',key).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha(canonical)}`).digest('hex');
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path,method,agent:false,timeout:30000,headers:{Host:host,'Content-Length':Buffer.byteLength(body),'x-amz-date':date,'x-amz-content-sha256':payload,Authorization:`AWS4-HMAC-SHA256 Credential=paneltest/${scope}, SignedHeaders=${signed}, Signature=${signature}`}},response=>{
   let content='';response.on('data',chunk=>content+=chunk);response.on('error',reject);response.on('end',()=>{try{assert(response.statusCode>=200&&response.statusCode<300,`${method} ${path} ${response.statusCode}: ${content.slice(0,500)}`);resolve(content);}catch(error){reject(error);}});
  });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('S3 request timeout')));req.end(body);
 });
}
