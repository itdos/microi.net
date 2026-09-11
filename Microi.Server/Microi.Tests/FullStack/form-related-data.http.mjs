import assert from 'node:assert/strict';

/**
 * 真实 SDK / HTTP 专项。调用者使用独立普通账号登录，并只提供专用验收表的两条父记录：
 * rowId 通过父表 DataFilter，deniedRowId 同菜单但被该事件拒绝。函数不创建/修改业务或权限。
 * root 的新候选双节点分别调用本函数；缺少负向夹具立即失败，不把管理员测试当普通权限证明。
 */
export async function verifyFormRelatedDataHttp(client, fixture) {
  for (const key of ['tableName','tableId','menuId','rowId','deniedRowId','missingRowId','foreignTenant'])
    assert.ok(typeof fixture[key]==='string' && fixture[key], `缺少真实专项夹具 ${key}`);
  const report={startedAt:new Date().toISOString(),checks:[],passed:false};
  const call=async(name,path,param,check)=>{
    // 运输错误、无效 JSON 或登录过期不能被当成行权限拒绝。适配器必须验证 HTTP 200，
    // 此处只接受真正的 DosResult；checkCode:false 保留业务拒绝供断言。
    const value=await client.post(path,param,{checkCode:false,silentError:true});
    assert.ok(value && typeof value==='object' && Number.isInteger(value.Code),'响应不是有效 DosResult');
    const item={name,Code:value.Code,Msg:value.Msg};report.checks.push(item);
    try {check(value);item.passed=true;}catch(error){item.passed=false;error.relatedDataReport=report;throw error;}
    return value;
  };
  const p={ParentFormEngineKey:fixture.tableId,ParentTableRowId:fixture.rowId,_SysMenuId:fixture.menuId};
  const related='/api/FormEngine/GetFormRelatedData';
  const denied=r=>assert.ok([0,2].includes(Number(r.Code)),`预期业务拒绝，实际 Code=${r.Code}`);
  const success=r=>assert.equal(Number(r.Code),1,r.Msg);
  await call('父记录普通身份真实Get', '/api/FormEngine/GetFormData',
    {FormEngineKey:fixture.tableName,Id:fixture.rowId,_SysMenuId:fixture.menuId}, success);
  await call('同菜单另一归属记录被DataFilter拒绝', '/api/FormEngine/GetFormData',
    {FormEngineKey:fixture.tableName,Id:fixture.deniedRowId,_SysMenuId:fixture.menuId}, denied);
  const counts=await call('Counts真实固定辅助查询', related, {...p,RelatedType:'Counts'}, r=>{
    success(r);assert.equal(r.DataAppend?.HistoryContentMode,'MetadataOnly');
    assert.ok(Number.isInteger(r.Data.DataLog)&&r.Data.DataLog>=0);
    assert.ok(Number.isInteger(r.Data.DataVersion)&&r.Data.DataVersion>=0);
    if(fixture.commentTableBound===false){assert.equal(r.Data.DataComment,null);assert.equal(r.DataAppend.DataCommentUnavailableReason,'CommentParentTableBindingUnavailable');}
  });
  for(const [type,fields] of [['DataLog',['Id','Type','CreateTime']],['DataVersion',['Id','Action','Version','CreateTime']]]) {
    await call(type+'只返回历史元信息',related,{...p,RelatedType:type},r=>{
      success(r);assert.ok(Array.isArray(r.Data));assert.equal(r.DataAppend?.HistoryContentMode,'MetadataOnly');
      for(const row of r.Data)for(const key of Object.keys(row))assert.ok(fields.includes(key),`历史响应出现非许可字段 ${key}`);
      if(fixture.privateSentinel)assert.ok(!JSON.stringify(r).includes(fixture.privateSentinel));
    });
  }
  if(fixture.commentTableBound===false)await call('旧评论缺表归属明确不可用',related,{...p,RelatedType:'DataComment'},r=>{denied(r);assert.equal(r.DataAppend?.DataCommentUnavailableReason,'CommentParentTableBindingUnavailable');});
  for(const RelatedType of ['Counts','DataLog','DataVersion','DataComment']) {
    await call(RelatedType+'父行越权拒绝',related,{...p,RelatedType,ParentTableRowId:fixture.deniedRowId},denied);
    await call(RelatedType+'父Id不存在拒绝',related,{...p,RelatedType,ParentTableRowId:fixture.missingRowId},denied);
  }
  await call('伪造辅助类型拒绝',related,{...p,RelatedType:'sys_osclients'},denied);
  await call('伪造租户不能查询另一租户',related,{...p,RelatedType:'Counts',OsClient:fixture.foreignTenant},r=>{
    // 有的入口在Token过滤器拒绝冲突，有的由DefaultParam覆盖；两种均不能读外租户。
    if(Number(r.Code)===1)assert.deepEqual(r.Data,counts.Data);else denied(r);
  });
  for(const table of ['microi_datalog','mic_data_version','diy_comment'])await call('普通账号不能直接枚举 '+table,
    '/api/FormEngine/GetTableData',{FormEngineKey:table,_PageIndex:1,_PageSize:1,_InvokeType:'Server',_TrustedServerInvocation:true},denied);
  report.passed=true;report.finishedAt=new Date().toISOString();return report;
}
