import assert from 'node:assert/strict';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';

test('legacy form tools use the MCP permission route and cannot override tenant/table through row or query', async()=>{
  const calls:{endpoint:string;data:any}[]=[];
  const fake={config:{osClient:'tenant-one'},post:async(endpoint:string,data:any)=>{calls.push({endpoint,data});return{Code:0,Msg:'MCP permission denied'};}};
  const query={OsClient:'other',FormEngineKey:'sys_user',_Where:[['Id','=','one']]};
  const row={Id:'one',OsClient:'other',FormEngineKey:'sys_user',_TrustedServerInvocation:true};
  for(const [method,payload,op] of [[MicroiClient.prototype.getTableData,query,'query'],[MicroiClient.prototype.addFormData,row,'add'],[MicroiClient.prototype.updateFormData,row,'update']] as const){
    const result=await method.call(fake as any,'Biz_Allowed',payload);
    assert.equal(result.Code,0);assert.equal(calls.at(-1)?.endpoint,'/api/V8Engine/McpFormData');
    assert.equal(calls.at(-1)?.data.OsClient,'tenant-one');assert.equal(calls.at(-1)?.data.TableName,'Biz_Allowed');assert.equal(calls.at(-1)?.data.Operation,op);
    assert.equal(calls.at(-1)?.data._TrustedServerInvocation,undefined);
  }
});
