import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DID,MAIN,TENANT,CONTEXT,success,mcpStatus,sha} from './contracts.mjs';

export function verifySources() {
  assert.ok(CONTEXT,'Admission context must be verified before transport');
  for(const [relative,hash] of Object.entries(CONTEXT.sourceHashes)) {
    assert.ok(!relative.split(/[\\/]/).includes('..')&&!path.isAbsolute(relative));
    assert.equal(sha(fs.readFileSync(path.join(CONTEXT.candidateRoot,relative))),hash,'Source input changed; review and re-freeze candidate');
  }
  assert.ok(Object.keys(CONTEXT.sourceHashes).length>=10,'Source closure is incomplete');
}

// 运输始终固定本任务 loopback 宿主，不接受任意服务器、租户、SQL 或脚本入口。
export class HttpSession {
  constructor(tenant,token='') {assert.ok([MAIN,TENANT].includes(tenant));this.tenant=tenant;this.token=token;}
  async post(route,body,{timeout=90000}={}) {
    assert.ok(['api/SysUser/Login','api/SysUserAccessKey/Exchange','apiengine/platform-current-user',
      'apiengine/platform-sys-user-admin','apiengine/platform-create-tenant'].includes(route));
    const response=await fetch(new URL(route,CONTEXT.base),{method:'POST',redirect:'error',headers:{'content-type':'application/json',osclient:this.tenant,
      osclienttype:'Product',osclientnetwork:'Internal',did:DID,...(this.token?{authorization:this.token}:{})},
      body:JSON.stringify({...body,OsClient:this.tenant}),signal:AbortSignal.timeout(timeout)});
    assert.equal(response.ok,true,'HTTP failed; outcome may be unknown, no automatic retry');
    const result=await response.json();
    const token=response.headers.get('authorization'); if(token)this.token=token;
    return result;
  }
  async login(account,password) {
    this.token=''; // 每次 fresh login 都必须收到新凭据，禁止沿用旧 token 掩盖失败。
    const result=await this.post('api/SysUser/Login',{Account:account,Pwd:password,_ClientType:'PC',_AutomationTestLogin:true});
    success(result); this.token=this.token||result.Data?.Token||result.Token;
    assert.ok(typeof this.token==='string'&&this.token.length>=20,'Login returned no real token');
    return success(await this.post('apiengine/platform-current-user',{}));
  }
  async user(payload){return this.post('apiengine/platform-sys-user-admin',payload);}
}

export async function connectMcp(session) {
  assert.equal(session.tenant,TENANT);assert.ok(session.token?.length>=20);
  const sdk=path.join(CONTEXT.candidateRoot,'microi.mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client');
  const {Client}=await import(pathToFileURL(path.join(sdk,'index.js')));
  const {StdioClientTransport,getDefaultEnvironment}=await import(pathToFileURL(path.join(sdk,'stdio.js')));
  const dist=path.join(CONTEXT.candidateRoot,'microi.mcp/dist/index.js');assert.ok(fs.statSync(dist).isFile());
  // 只继承 SDK 的基础 OS 环境；不继承其它任务的密码、Token 文件或 MCP profile。
  const env={...getDefaultEnvironment(),MICROI_API_URL:CONTEXT.base.replace(/\/$/,''),MICROI_OS_CLIENT:TENANT,
    MICROI_OS_CLIENT_TYPE:'Product',MICROI_OS_CLIENT_NETWORK:'Internal',MICROI_TOKEN:session.token,
    MICROI_USERNAME:'',MICROI_PASSWORD:'',MICROI_TOKEN_FILE:'',MICROI_WORKSPACE_CREDENTIAL_FILE:'',
    MICROI_MCP_DID:DID,MCP_TRANSPORT:'stdio',MICROI_CODEX_MODE:'0'};
  const transport=new StdioClientTransport({command:process.execPath,args:['--max-old-space-size=256',dist],cwd:CONTEXT.candidateRoot,env,stderr:'pipe'});
  // MCP 日志可能包含服务端错误正文；候选只保留字节计数，不复制可能出现的秘密。
  let stderrBytes=0;transport.stderr?.on('data',buffer=>{stderrBytes+=buffer.length;});
  const client=new Client({name:'admission-owned-fixture',version:'1.0.0'});
  try {
    await client.connect(transport);
    const tools=await client.listTools();
    for(const name of ['microi_get_status','microi_create_my_access_key','microi_list_my_access_keys','microi_revoke_my_access_key'])
      assert.ok(tools.tools.some(tool=>tool.name===name),'Required official MCP tool missing');
    mcpStatus(await client.callTool({name:'microi_get_status',arguments:{}},undefined,{timeout:60000}),TENANT);
    return {call:(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:90000}),
      close:()=>client.close(),diagnostic:()=>({stderrBytes})};
  } catch(error) {await client.close();throw error;}
}
