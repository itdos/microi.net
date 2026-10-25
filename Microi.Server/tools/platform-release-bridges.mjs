// 只做本轮测试的固定目标运输；不创建服务、不记录载荷、不改变共享实例配置。
import fs from 'node:fs';
import net from 'node:net';
// 双 API 连接池可同时占用 64 个连接；保留原生校验/最终冒烟余量，仍逐端点有界。
const maxBridgeConnectionsPerEndpoint=128;
const encode=args=>Buffer.from('*'+args.length+'\r\n'+args.map(x=>'$'+Buffer.byteLength(String(x))+'\r\n'+x+'\r\n').join(''));
const forbidden=new Set(['FLUSHDB','FLUSHALL','CONFIG','SHUTDOWN','SWAPDB','MIGRATE','MOVE','COPY','REPLICAOF','SLAVEOF','DEBUG','ACL','MODULE','SAVE','BGSAVE','BGREWRITEAOF']);

export function readRequest(buffer){
  let pos=buffer.indexOf('\r\n');if(pos<0)return null;
  if(buffer[0]!==42)throw Error('RESP array required');
  const count=Number(buffer.subarray(1,pos).toString());
  if(!Number.isInteger(count)||count<1||count>4096)throw Error('RESP command size rejected');
  pos+=2;const values=[];
  for(let i=0;i<count;i++){
    const end=buffer.indexOf('\r\n',pos);if(end<0)return null;
    if(buffer[pos]!==36)throw Error('RESP bulk argument required');
    const length=Number(buffer.subarray(pos+1,end).toString());
    if(!Number.isInteger(length)||length<0||length>16*1024*1024)throw Error('RESP argument size rejected');
    if(buffer.length<end+2+length+2)return null;
    if(buffer[end+2+length]!==13||buffer[end+3+length]!==10)throw Error('RESP terminator rejected');
    values.push(buffer.subarray(end+2,end+2+length));pos=end+2+length+2;
  }
  return {values,bytes:pos};
}

export function validateCommand(values,allowed){
  const name=values[0].toString().toUpperCase();
  // 实测拒绝及SE.Redis3.0.17握手源码共同确认这4个只读GET键；禁止模式匹配和任何配置写入。
  if(name==='CONFIG'){
    if(values.length===3&&values[1].toString().toUpperCase()==='GET'&&['timeout','databases','replica-read-only','slave-read-only'].includes(values[2].toString().toLowerCase()))return;
    throw Error('Shared Redis administrative command rejected');
  }
  if(forbidden.has(name))throw Error('Shared Redis administrative command rejected');
  if(name==='SELECT'&&(values.length!==2||!allowed.includes(Number(values[1].toString()))))throw Error('Shared Redis database outside approved test scope');
  if(name==='SCRIPT'&&['FLUSH','KILL'].includes(values[1]?.toString().toUpperCase()))throw Error('Shared Redis script administration rejected');
  // Lua的原子操作保持原样，但不能借Lua执行全局管理命令。
  if(['EVAL','EVALSHA_RO','EVAL_RO'].includes(name)&&/\b(?:FLUSHALL|FLUSHDB|CONFIG|SHUTDOWN|SWAPDB|SELECT|MOVE|COPY|MIGRATE)\b/i.test(values[1]?.toString()||''))throw Error('Shared Redis administrative Lua rejected');
}

// 调度夹具的 SE.Redis API 固定使用逻辑 DB0。本端口将它映射到已认领的
// 物理 DB3；客户端不能直接选择其它物理库，主端口仍只允许 DB1/DB2。
export function rewriteScopedCommand(values,spec){
  validateCommand(values,spec.databases);
  if(values[0].toString().toUpperCase()==='SELECT'&&Number.isInteger(spec.virtualDefaultDatabase)){
    if(values[1].toString()!=='0')throw Error('Schedule Redis only exposes virtual database zero');
    return encode(['SELECT',spec.virtualDefaultDatabase]);
  }
  return null;
}

export async function startNativeBridges(scopeFile, expected){
  const scope=JSON.parse(fs.readFileSync(scopeFile,'utf8'));
  if(scope.task!==expected.ownerTask||scope.authorization!==expected.authorization)throw Error('Native scope authority mismatch');
  const task=scope.task;
  const servers=[],sockets=new Set(),counts=new Map(),commandMetadata=new Map();
  const observe=(spec,values,rejected)=>{const raw=values[0]?.toString().toUpperCase(),name=/^[A-Z_]{1,32}$/.test(raw)?raw:'[invalid]';const rawSub=values[1]?.toString().toUpperCase(),subcommand=['CONFIG','SCRIPT'].includes(name)&&/^[A-Z_]{1,32}$/.test(rawSub)?rawSub:null;const rawKey=values[2]?.toString(),configKey=name==='CONFIG'&&subcommand==='GET'&&/^[a-z_-]{1,32}$/.test(rawKey)?rawKey:null;const key=JSON.stringify({endpoint:spec.name,name,subcommand,configKey,rejected});commandMetadata.set(key,(commandMetadata.get(key)||0)+1);};
  const specs=[
    {name:'mysql',port:expected.ports.mysql,target:scope.mysql},
    {name:'mongo',port:expected.ports.mongo,target:scope.mongo},
    {name:'redis',port:expected.ports.redis,target:scope.redis,databases:[1,2],defaultDb:1},
    {name:'scheduleRedis',port:expected.ports.scheduleRedis,target:scope.redis,databases:[0],defaultDb:3,virtualDefaultDatabase:3},
  ];
  const close=async()=>{for(const socket of sockets)socket.destroy();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));};
  try{
    for(const spec of specs){
      const server=net.createServer(client=>{
        if((counts.get(spec.name)||0)>=maxBridgeConnectionsPerEndpoint){client.destroy();return;}
        counts.set(spec.name,(counts.get(spec.name)||0)+1);sockets.add(client);
        const upstream=net.createConnection({host:spec.target.host,port:spec.target.port});sockets.add(upstream);
        const stop=()=>{client.destroy();upstream.destroy();};
        const deadline=setTimeout(stop,5000);
        client.on('error',stop);upstream.on('error',stop);
        client.once('close',()=>{clearTimeout(deadline);counts.set(spec.name,Math.max(0,(counts.get(spec.name)||1)-1));sockets.delete(client);upstream.destroy();});
        upstream.once('close',()=>{sockets.delete(upstream);client.destroy();});
        if(!spec.databases){upstream.once('connect',()=>{clearTimeout(deadline);client.pipe(upstream);upstream.pipe(client);});return;}
        // 旧调度夹具没有密码参数；只在私有运输中认证，随后固定选择本轮独占数据库。
        let authenticated=false,handshake=Buffer.alloc(0),pending=Buffer.alloc(0),replyCount=0;
        const forward=chunk=>{
          pending=Buffer.concat([pending,chunk]);if(pending.length>20*1024*1024){stop();return;}
          if(!authenticated)return;
          try{let request;while((request=readRequest(pending))){let rewritten;try{rewritten=rewriteScopedCommand(request.values,spec);}catch(error){observe(spec,request.values,true);throw error;}observe(spec,request.values,false);upstream.write(rewritten??pending.subarray(0,request.bytes));pending=pending.subarray(request.bytes);}}
          catch{client.end('-ERR command outside approved test scope\r\n');upstream.destroy();}
        };
        client.on('data',forward);
        const receive=chunk=>{
          if(authenticated){if(!client.write(chunk))upstream.pause();return;}
          handshake=Buffer.concat([handshake,chunk]);
          while(replyCount<2){const end=handshake.indexOf('\r\n');if(end<0)return;if(handshake.subarray(0,end).toString()!=='+OK'){stop();return;}handshake=handshake.subarray(end+2);replyCount++;}
          clearTimeout(deadline);authenticated=true;forward(Buffer.alloc(0));if(handshake.length)client.write(handshake);
        };
        client.on('drain',()=>upstream.resume());upstream.on('data',receive);
        upstream.once('connect',()=>upstream.write(Buffer.concat([encode(['AUTH',scope.redis.password]),encode(['SELECT',spec.defaultDb])])));
      });
      servers.push(server);
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(spec.port,'127.0.0.1',resolve);});
    }
    return {close,getCommandMetadata:()=>[...commandMetadata].map(([key,count])=>({...JSON.parse(key),count})),receipt:{task,pid:process.pid,listenHost:'127.0.0.1',ports:specs.map(x=>x.port),
      dockerContainersCreated:0,payloadLogged:false,redisDatabases:[1,2,3],sharedConfigurationChanged:false}};
  }catch(error){await close();throw error;}
}
