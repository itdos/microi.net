import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {startNativeBridges} from '../../tools/platform-release-bridges.mjs';

// 只连接测试自行监听的回环端口，复现双 API 池后的短连接容量，不接触真实依赖。
test('native bridge admits 128 scoped connections, rejects 129 and releases closed capacity',async()=>{
 const parent=path.resolve(import.meta.dirname,'../../../.tmp');fs.mkdirSync(parent,{recursive:true});
 const scratch=fs.mkdtempSync(path.join(parent,'bridge-connections-')),clients=[],upstreams=[],reserved=[];
 const target=net.createServer(socket=>{upstreams.push(socket);socket.on('error',()=>{});socket.write('ready');});
 let bridge;
 const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
 const close=server=>new Promise(resolve=>server.close(resolve));
 const greeting=port=>new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:'127.0.0.1',port});clients.push(socket);
  const timer=setTimeout(()=>reject(Error('Loopback greeting timeout')),2000);
  socket.once('data',bytes=>{clearTimeout(timer);assert.equal(bytes.toString(),'ready');resolve(socket);});
  socket.once('error',error=>{clearTimeout(timer);reject(error);});
  socket.once('close',()=>{clearTimeout(timer);reject(Error('Bridge closed before greeting'));});
 });
 try{
  const upstreamPort=await listen(target),ports={};
  for(const name of ['mysql','mongo','redis','scheduleRedis']){const server=net.createServer();reserved.push(server);ports[name]=await listen(server);}
  await Promise.all(reserved.map(close));
  const scopeFile=path.join(scratch,'scope.json'),endpoint={host:'127.0.0.1',port:upstreamPort};
  fs.writeFileSync(scopeFile,JSON.stringify({task:'connection-test',authorization:'loopback-only',mysql:endpoint,mongo:endpoint,redis:{...endpoint,password:'unused'}}));
  bridge=await startNativeBridges(scopeFile,{ownerTask:'connection-test',authorization:'loopback-only',ports});
  for(let index=0;index<128;index++)await greeting(ports.mysql);
  const extra=net.createConnection({host:'127.0.0.1',port:ports.mysql});clients.push(extra);let forwarded=false;
  extra.on('data',()=>{forwarded=true;});extra.on('error',()=>{});
  await Promise.race([once(extra,'close'),new Promise((_,reject)=>{const timeout=setTimeout(()=>reject(Error('Capacity overflow was not rejected')),2000);timeout.unref();})]);
  assert.equal(forwarded,false,'Overflow must not open another upstream connection');
  const firstUpstreamClosed=once(upstreams[0],'close');clients[0].destroy();await firstUpstreamClosed;
  await greeting(ports.mysql);
  await greeting(ports.mongo);
  assert.equal(bridge.receipt.dockerContainersCreated,0);
 }finally{
  for(const client of clients)client.destroy();
  if(bridge)await bridge.close();
  for(const socket of upstreams)socket.destroy();
  for(const server of reserved)if(server.listening)await close(server);
  if(target.listening)await close(target);
  assert.equal(path.dirname(scratch),parent);assert.equal(fs.lstatSync(scratch).isSymbolicLink(),false);fs.rmSync(scratch,{recursive:true});
 }
});
